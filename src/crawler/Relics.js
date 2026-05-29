/*
 * Relic library for Crawler Mode.
 *
 * A relic is a passive effect that fires on specific game events. Each
 * relic is pure data plus a small `hooks` object whose keys match the
 * event names the engine fires. Hook handlers receive a context object
 * the engine builds for that event and either mutate it or read it.
 *
 * Hooks (all optional):
 *   onCombatStart(ctx)
 *     ctx = { combat, run, rng }
 *     Fired after the player & enemies are spawned, just before the
 *     first player turn begins. Best place for "+ N max HP this combat",
 *     "draw +1 each turn this combat", etc.
 *
 *   onTurnStart(ctx)
 *     ctx = { combat, run }
 *     Fired at the start of each player turn (after block decay /
 *     energy reset / hand draw) so a relic can give bonus block,
 *     bonus energy, etc.
 *
 *   onTurnEnd(ctx)
 *     ctx = { combat, run }
 *     Fired at the end of the player turn, just before enemies act.
 *
 *   onCardPlayed(ctx)
 *     ctx = { combat, run, cardDef, cardType, target }
 *     Fired after a card resolves. cardType is 'attack' / 'skill' /
 *     'power'. Useful for "every Nth Attack apply Vulnerable" etc.
 *
 *   onDamageDealt(ctx)
 *     ctx = { combat, run, target, baseAmount, finalAmount }
 *     Fired after damage lands on an enemy.
 *
 *   onPlayerHit(ctx)
 *     ctx = { combat, run, source, baseAmount, finalAmount }
 *     Fired after damage lands on the player.
 *
 *   modifyEnergy(ctx)
 *     ctx = { combat, run, baseEnergy }
 *     Pure "modifier" hook. Return a number; engine assigns it as
 *     the final maxEnergy at start of each player turn.
 *
 *   modifyMaxHp(ctx)
 *     ctx = { run, baseMaxHp }
 *     Pure modifier. Return a number; engine assigns as run.maxHp at
 *     run start (only).
 *
 *   onCombatEnd(ctx)
 *     ctx = { combat, run, victory }
 *     Fired after a combat resolves, before reward / map flow.
 *
 *   onRewardOffer(ctx)
 *     ctx = { run, rewardCards }
 *     Lets a relic mutate the offered rewards (e.g. always offer
 *     a Power, +1 reward count).
 *
 * Adding a new relic = adding a new entry here. The engine looks up
 * each fired hook by name, so unknown hook names are silently ignored.
 *
 * Tier guidance (loosely): common (gold start, draw bonus), uncommon
 * (per-attack effects), rare (game-changing — extra energy, conditional
 * heal). For MVP rarity is uniform; a Phase 2 revision can weight.
 */

export const RELIC_LIBRARY = {

    /* ----- Common ----- */

    bandage: {
        id: 'bandage',
        name: 'Frayed Bandage',
        text: 'Heal 5 HP at the end of each combat.',
        rarity: 'common',
        hooks: {
            onCombatEnd({ run, victory }) {
                if (!victory) return;
                run.hp = Math.min(run.maxHp, run.hp + 5);
            }
        }
    },

    ironHelm: {
        id: 'ironHelm',
        name: 'Iron Helm',
        text: 'Start each combat with 4 Block.',
        rarity: 'common',
        hooks: {
            onCombatStart({ combat }) { combat.player.block += 4; }
        }
    },

    sharpeningStone: {
        id: 'sharpeningStone',
        name: 'Sharpening Stone',
        text: 'Start each combat with 1 Strength.',
        rarity: 'common',
        hooks: {
            onCombatStart({ combat }) { combat.player.strength += 1; }
        }
    },

    coinPurse: {
        id: 'coinPurse',
        name: 'Coin Purse',
        text: '+15 gold at the end of each combat.',
        rarity: 'common',
        hooks: {
            onCombatEnd({ run, victory }) {
                if (!victory) return;
                run.gold += 15;
            }
        }
    },

    /* ----- Uncommon ----- */

    silverChalice: {
        id: 'silverChalice',
        name: 'Silver Chalice',
        text: '+1 maximum HP for the rest of the run on each combat won.',
        rarity: 'uncommon',
        hooks: {
            onCombatEnd({ run, victory }) {
                if (!victory) return;
                run.maxHp += 1;
                run.hp = Math.min(run.maxHp, run.hp + 1);
            }
        }
    },

    venomFang: {
        id: 'venomFang',
        name: 'Venom Fang',
        text: 'Every 3rd Attack you play applies 1 Vulnerable.',
        rarity: 'uncommon',
        hooks: {
            onCombatStart({ combat }) {
                /* per-combat counter lives on combat so it resets */
                combat._venomCount = 0;
            },
            onCardPlayed({ combat, cardType }) {
                if (cardType !== 'attack') return;
                combat._venomCount = (combat._venomCount || 0) + 1;
                if (combat._venomCount % 3 === 0) {
                    /* hit the first alive enemy */
                    const t = combat.enemies.find((e) => e.hp > 0);
                    if (t) t.vulnerable += 1;
                }
            }
        }
    },

    runeOfVigor: {
        id: 'runeOfVigor',
        name: 'Rune of Vigor',
        text: 'Draw 1 extra card on the first turn of each combat.',
        rarity: 'uncommon',
        hooks: {
            onCombatStart({ combat }) {
                combat._vigorPending = 1;
            },
            onTurnStart({ combat }) {
                if (!combat._vigorPending) return;
                combat._vigorPending = 0;
                combat._draw(1);
            }
        }
    },

    bramblecloak: {
        id: 'bramblecloak',
        name: 'Bramble Cloak',
        text: 'When you take damage, deal 2 back to the attacker.',
        rarity: 'uncommon',
        hooks: {
            onPlayerHit({ source, finalAmount }) {
                if (!source || source.hp <= 0 || finalAmount <= 0) return;
                source.hp = Math.max(0, source.hp - 2);
            }
        }
    },

    /* ----- Rare ----- */

    sunCrown: {
        id: 'sunCrown',
        name: 'Crown of the Sun',
        text: 'Gain +1 Energy at the start of each turn.',
        rarity: 'rare',
        hooks: {
            modifyEnergy({ baseEnergy }) { return baseEnergy + 1; }
        }
    },

    bloodPact: {
        id: 'bloodPact',
        name: 'Blood Pact',
        text: '+10 maximum HP, but take 2 damage at the start of each combat.',
        rarity: 'rare',
        hooks: {
            modifyMaxHp({ baseMaxHp }) { return baseMaxHp + 10; },
            onCombatStart({ combat }) {
                combat.player.hp = Math.max(1, combat.player.hp - 2);
            }
        }
    },

    livingShield: {
        id: 'livingShield',
        name: 'Living Shield',
        text: 'Block carries over to the next turn.',
        rarity: 'rare',
        /* Implemented via a flag on combat the engine checks before
         * the start-of-turn block reset. */
        hooks: {
            onCombatStart({ combat }) { combat._blockPersists = true; }
        }
    },

    omenStone: {
        id: 'omenStone',
        name: 'Omen Stone',
        text: 'Reward picks offer 4 cards instead of 3.',
        rarity: 'rare',
        hooks: {
            onRewardOffer({ rewardCards }) {
                /* engine pre-rolls 3, this hook just signals "want one
                 * more". The hook receiver in CrawlerRun.rollRewards
                 * checks for a sentinel field. */
                rewardCards._wantExtra = (rewardCards._wantExtra || 0) + 1;
            }
        }
    }
};

export const RELIC_POOL = Object.keys(RELIC_LIBRARY);

export function getRelic(id) {
    return RELIC_LIBRARY[id] || null;
}

/*
 * Run a hook by name across every relic the run owns. Errors in one
 * relic don't stop the others — relics are content, not core engine.
 *
 * For pure-modifier hooks (those that return a value rather than
 * mutating ctx), use `applyModifier` instead.
 */
export function fireHook(run, hookName, ctx) {
    if (!run || !run.relics) return;
    for (const relicId of run.relics) {
        const relic = RELIC_LIBRARY[relicId];
        if (!relic || !relic.hooks) continue;
        const fn = relic.hooks[hookName];
        if (typeof fn !== 'function') continue;
        try { fn(ctx); }
        catch (e) { console.warn('[Relic]', relicId, hookName, 'threw:', e); }
    }
}

/*
 * Apply every relic's pure modifier hook in sequence. Each hook receives
 * the ctx with the latest base value and returns the new value. Used
 * for modifyEnergy, modifyMaxHp, etc.
 */
export function applyModifier(run, hookName, baseFieldName, ctx) {
    if (!run || !run.relics) return ctx[baseFieldName];
    let cur = ctx[baseFieldName];
    for (const relicId of run.relics) {
        const relic = RELIC_LIBRARY[relicId];
        if (!relic || !relic.hooks) continue;
        const fn = relic.hooks[hookName];
        if (typeof fn !== 'function') continue;
        try {
            const next = fn({ ...ctx, [baseFieldName]: cur });
            if (typeof next === 'number' && Number.isFinite(next)) cur = next;
        } catch (e) {
            console.warn('[Relic]', relicId, hookName, 'threw:', e);
        }
    }
    return cur;
}

/*
 * Roll N distinct relics from the pool, optionally excluding ones the
 * run already owns. Used by relic-reward nodes (elite drop, boss drop).
 */
export function rollRelics(count, ownedSet, rng) {
    const owned = ownedSet || new Set();
    const remaining = RELIC_POOL.filter((id) => !owned.has(id));
    const out = [];
    for (let i = 0; i < count && remaining.length > 0; i++) {
        const idx = Math.floor(rng() * remaining.length);
        out.push(remaining.splice(idx, 1)[0]);
    }
    return out;
}
