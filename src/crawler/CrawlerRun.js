/*
 * Run-state + combat engine for Crawler Mode.
 *
 * This file is intentionally pure-logic — it never touches the DOM, never
 * reads from `document`, never creates a sprite. It exposes a small object
 * graph that the UI layer (CrawlerUI.js) reads from each frame to render
 * the screen.
 *
 *   CrawlerRun
 *     ├── persistent state: hp, maxHp, deck, gold, relics, floor
 *     ├── map: CrawlerMap with node graph for the current floor
 *     ├── stats: biggestHit, kills, fightsCleared, eliteKills, totalDamage
 *     └── current CombatState (or null between encounters)
 *
 *   CombatState
 *     ├── player block / strength / vulnerable
 *     ├── enemies[] — each with hp, block, strength, vulnerable, intent
 *     ├── piles: drawPile, hand, discardPile, exhaustPile
 *     ├── energy / maxEnergy / handSize
 *     ├── phase: 'player' | 'enemy' | 'won' | 'lost'
 *     └── log[] — short event log surfaced in the combat log UI
 *
 * Run lifecycle:
 *   constructor → 'map' phase, floor 1, full HP, starter deck shuffled
 *   selectMapNode(id) → routes to one of:
 *     - startCombat(encounter)  for fight/pack/elite/boss
 *     - 'rest'                  for rest sites (heal or upgrade card)
 *     - 'reward'                for free reward node (no combat)
 *   finishCombat(victory)
 *     - on loss: 'defeat'
 *     - on boss kill of last floor: 'victory' (then 'summary')
 *     - on boss kill of non-last floor: advance floor, regenerate map
 *     - on elite kill: queue a relic offer + reward
 *     - on normal/pack kill: queue a card reward
 *
 * Relics are passive effects that hook into named events. See Relics.js
 * for the hook contract. The engine fires:
 *   onCombatStart, onTurnStart, onTurnEnd, onCardPlayed, onDamageDealt,
 *   onPlayerHit, onCombatEnd, modifyEnergy (modifier), modifyMaxHp
 *   (modifier, applied once at run start).
 */

import { CARD_LIBRARY, getCard, STARTER_DECKS, REWARD_POOL, isUpgradable } from './Cards.js';
import { ENEMY_LIBRARY, getEnemy, getEncounterPool } from './Enemies.js';
import { CrawlerMap } from './CrawlerMap.js';
import { fireHook, applyModifier, getRelic, rollRelics } from './Relics.js';
import { mulberry32, seedFromString, todaySeedString, pickN, pickOne, shuffle } from './Rng.js';

const RUN_DEFAULTS = {
    maxHp: 80,
    handSize: 5,
    maxEnergy: 3,
    finalFloor: 3
};

/*
 * Number of cards offered at non-boss reward / reward-node picks.
 * Relics like Omen Stone bump this up via the onRewardOffer hook.
 */
const BASE_REWARD_COUNT = 3;

/* ============================================================
 *  CrawlerRun — top-level run state, persists across combats
 * ============================================================ */

export class CrawlerRun {
    constructor(characterId, options = {}) {
        const starter = STARTER_DECKS[characterId];
        if (!starter) {
            throw new Error(`No starter deck for character "${characterId}"`);
        }

        this.characterId = characterId;

        /* Seed: callers can pass a string seed (daily run) or omit
         * for a fresh random run. The same seed produces the same
         * map shape, encounter rolls, and reward draws end-to-end. */
        const seedStr = options.seed || ('rand-' + Date.now() + '-' + Math.floor(Math.random() * 1e9));
        this.seedString = seedStr;
        this.isDaily = !!options.daily;
        this.rng = mulberry32(seedFromString(seedStr));

        /* Apply maxHp modifier hook ONCE at run start (e.g. Blood Pact
         * +10 HP). After that maxHp can drift via per-fight bonuses
         * but never re-runs the modifier. */
        this.relics = [];
        const baseMax = applyModifier(this, 'modifyMaxHp', 'baseMaxHp', { run: this, baseMaxHp: RUN_DEFAULTS.maxHp });
        this.maxHp = baseMax;
        this.hp = baseMax;

        /* Deck is a flat array of card ids. Duplicates are intentional. */
        this.deck = [...starter];
        this.gold = 0;
        this.combat = null;

        /* Map / floor state. Floor N's map is regenerated each time the
         * player descends. Until then `map` is null and `phase` is
         * 'pre-fight' on the very first prefight prompt the UI shows. */
        this.floor = 1;
        this.totalFloors = options.totalFloors || RUN_DEFAULTS.finalFloor;
        this.map = null;

        /* Phase machine for the UI:
         *   'pre-run'    initial splash before the map is generated
         *   'map'        showing the floor map for node selection
         *   'pre-fight'  pre-combat splash for the chosen encounter
         *   'in-combat'  active combat state in this.combat
         *   'reward'     post-combat card pick (or relic pick if elite)
         *   'rest'       at a rest site (heal or upgrade)
         *   'free-reward'  free card pick at a '?' reward node
         *   'victory'    completed final floor's boss — show summary
         *   'defeat'     player HP hit 0 mid-combat */
        this.phase = 'pre-run';

        /* Most-recently-resolved encounter context — what node kind it
         * was, the enemy ids, etc. The UI consults this to pick stage
         * art and relic-drop logic. */
        this.lastNode = null;

        /* Stats for the summary screen + meta-gold calc. */
        this.stats = {
            biggestHit: 0,
            kills: 0,
            eliteKills: 0,
            fightsCleared: 0,
            damageDealt: 0,
            damageTaken: 0,
            cardsPlayed: 0,
            relicsCollected: 0,
            startedAt: Date.now()
        };

        /* Pending relic-drop queue: an elite kill stages one relic-pick
         * here so the UI can prompt the player on the reward stage. */
        this.pendingRelicChoices = null;
    }

    /* ---------- run flow ---------- */

    /* Generate (or regenerate) the map for the current floor and put
     * the player in 'map' phase ready to pick a node. */
    enterFloor(floor) {
        this.floor = floor;
        this.map = new CrawlerMap(floor, this.rng);
        this.phase = 'map';
    }

    /* Select a node and dispatch on its kind. Returns an object
     * describing what happened so the UI can route stages without
     * re-reading run.phase off a stale frame. */
    selectMapNode(nodeId) {
        if (!this.map) return null;
        const node = this.map.enterNode(nodeId);
        if (!node) return null;
        this.lastNode = node;

        switch (node.kind) {
            case 'fight':
            case 'pack':
            case 'elite':
            case 'boss':
                this._startCombatForNode(node);
                return { phase: 'in-combat', node };
            case 'rest':
                this.phase = 'rest';
                return { phase: 'rest', node };
            case 'reward':
                this.phase = 'free-reward';
                return { phase: 'free-reward', node };
            case 'shop':
                this.phase = 'shop';
                return { phase: 'shop', node };
            default:
                console.warn('[CrawlerRun] unknown node kind', node.kind);
                this.phase = 'map';
                return { phase: 'map', node };
        }
    }

    /* Roll the encounter for a given map node and create the combat. */
    _startCombatForNode(node) {
        const pool = getEncounterPool(this.floor, node.kind === 'boss' ? 'boss' : node.kind);
        const enemyIds = pool[Math.floor(this.rng() * pool.length)] || pool[0];
        const isElite = node.kind === 'elite';
        const isBoss = node.kind === 'boss';
        this.combat = new CombatState(this, enemyIds, this.rng, { isElite, isBoss });
        this.combat.start();
        this.phase = 'in-combat';
    }

    /*
     * Called by the UI when a combat ends. Routes into reward / rest
     * / floor-advance / victory / defeat depending on the node kind
     * and current floor.
     */
    finishCombat(victory) {
        const c = this.combat;
        const node = this.lastNode;

        if (!victory) {
            this.phase = 'defeat';
            this.combat = null;
            return;
        }

        /* Snapshot the player's leftover HP back into run state so it
         * persists into the next fight. Block / strength / vulnerable
         * are per-combat and intentionally don't persist. */
        if (c) this.hp = c.player.hp;

        /* Run end-of-combat relic hooks (heals, +max HP, +gold). */
        fireHook(this, 'onCombatEnd', { combat: c, run: this, victory: true });
        /* Hp may have been bumped by a relic; clamp to (possibly
         * just-grown) maxHp. */
        this.hp = Math.min(this.maxHp, this.hp);

        /* Stat bookkeeping. */
        this.stats.fightsCleared++;
        if (node && node.kind === 'elite') this.stats.eliteKills++;

        /* Standard gold per fight. Boss + elite pay more. */
        const goldGained = (node && node.kind === 'boss') ? 60 : (node && node.kind === 'elite') ? 35 : 18;
        this.gold += goldGained;

        this.combat = null;

        /* Boss path: advance floor or finish run. */
        if (node && node.kind === 'boss') {
            if (this.floor >= this.totalFloors) {
                this.phase = 'victory';
                return;
            }
            /* New floor's map gets generated when the player clicks
             * "descend" on the boss-victory screen. We use
             * 'reward' phase here only for the boss-card-pick. */
            this._queueRewards(BASE_REWARD_COUNT + 1);
            this.phase = 'boss-reward';
            return;
        }

        /* Elite path: queue a relic pick AND a card pick. The UI shows
         * the relic picker first, then the card picker. */
        if (node && node.kind === 'elite') {
            const ownedSet = new Set(this.relics);
            this.pendingRelicChoices = rollRelics(3, ownedSet, this.rng);
            this._queueRewards(BASE_REWARD_COUNT);
            this.phase = 'elite-reward';
            return;
        }

        /* Default normal/pack path: card reward. */
        this._queueRewards(BASE_REWARD_COUNT);
        this.phase = 'reward';
    }

    /* Roll the offered card rewards. Stored on the run so the UI can
     * read them; cleared when the player picks (or skips). Relics with
     * onRewardOffer hooks (e.g. Omen Stone) can bump the count. */
    _queueRewards(baseCount) {
        const rewardCards = pickN(REWARD_POOL, baseCount, this.rng);
        rewardCards._wantExtra = 0;
        fireHook(this, 'onRewardOffer', { run: this, rewardCards });
        const wantExtra = rewardCards._wantExtra || 0;
        if (wantExtra > 0) {
            const remaining = REWARD_POOL.filter((id) => !rewardCards.includes(id));
            const extras = pickN(remaining, wantExtra, this.rng);
            rewardCards.push(...extras);
        }
        delete rewardCards._wantExtra;
        this.rewardChoices = rewardCards;
    }

    /* ---------- mutations ---------- */

    addCardToDeck(cardId) {
        if (!CARD_LIBRARY[cardId]) return;
        this.deck.push(cardId);
    }

    /*
     * Upgrade a card in the deck by its index. Looks up the card's
     * `upgradedId` and replaces the entry. Returns true on success.
     */
    upgradeDeckCard(deckIndex) {
        const cardId = this.deck[deckIndex];
        if (!cardId) return false;
        const def = getCard(cardId);
        if (!def || def.isUpgrade || !def.upgradedId) return false;
        if (!getCard(def.upgradedId)) return false;
        this.deck[deckIndex] = def.upgradedId;
        return true;
    }

    /*
     * Filter the deck down to upgrade-eligible (cardId, deckIndex)
     * pairs. Used by the rest-site upgrade picker.
     */
    upgradableDeckEntries() {
        const out = [];
        this.deck.forEach((cardId, idx) => {
            const def = getCard(cardId);
            if (isUpgradable(def)) out.push({ cardId, deckIndex: idx });
        });
        return out;
    }

    addRelic(relicId) {
        if (!getRelic(relicId)) return false;
        if (this.relics.includes(relicId)) return false;
        this.relics.push(relicId);
        this.stats.relicsCollected++;
        return true;
    }

    healByPercent(pct) {
        const heal = Math.floor(this.maxHp * pct);
        this.hp = Math.min(this.maxHp, this.hp + heal);
        return heal;
    }
}

/* ============================================================
 *  CombatState — one encounter
 * ============================================================ */

class CombatState {
    constructor(run, enemyIds, rng, opts = {}) {
        this.run = run;
        this.rng = rng || Math.random;

        this.player = {
            hp: run.hp,
            maxHp: run.maxHp,
            block: 0,
            strength: 0,
            vulnerable: 0
        };

        this.enemies = enemyIds.map((id) => this._spawnEnemy(id));
        this.isElite = !!opts.isElite;
        this.isBoss = !!opts.isBoss;

        this.drawPile = this._shuffle([...run.deck]);
        this.hand = [];
        this.discardPile = [];
        this.exhaustPile = [];

        this.energy = 0;
        this.maxEnergy = RUN_DEFAULTS.maxEnergy;
        this.handSize = RUN_DEFAULTS.handSize;

        this.turn = 0;
        this.phase = 'starting'; /* set to 'player' by start() */
        this.log = [];

        /* Persistent block flag (set by Living Shield relic) — engine
         * checks before resetting block at start of player turn. */
        this._blockPersists = false;

        /* Monotonic id given to every dealt-card instance for stable
         * UI keying. */
        this._instanceCounter = 1;
    }

    /* -------- public API consumed by CrawlerUI.js -------- */

    start() {
        /* Run onCombatStart relic hooks BEFORE the first player turn,
         * so block / HP / strength bonuses land before turn 1's draw
         * and energy. */
        fireHook(this.run, 'onCombatStart', { combat: this, run: this.run, rng: this.rng });
        this._startPlayerTurn();
    }

    canPlayCard(handIndex, targetIndex = 0) {
        if (this.phase !== 'player') return false;
        const card = this.hand[handIndex];
        if (!card) return false;
        const def = getCard(card.cardId);
        if (!def) return false;
        if (def.cost > this.energy) return false;
        const needsTarget = def.actions.some(
            (a) => a.kind === 'damage' || a.kind === 'multiAttack' || a.kind === 'applyVulnerable'
        );
        if (needsTarget) {
            const enemy = this.enemies[targetIndex];
            if (!enemy || enemy.hp <= 0) {
                if (!this.enemies.some((e) => e.hp > 0)) return false;
            }
        }
        return true;
    }

    playCard(handIndex, targetIndex = 0) {
        if (!this.canPlayCard(handIndex, targetIndex)) return false;

        const card = this.hand[handIndex];
        const def = getCard(card.cardId);

        this.energy -= def.cost;
        this.hand.splice(handIndex, 1);
        this._log(`Played ${def.name}`);
        this.run.stats.cardsPlayed++;

        for (const action of def.actions) {
            this._applyPlayerAction(action, targetIndex);
            if (this._checkWin() || this._checkLoss()) break;
        }

        /* Powers exhaust on play; everything else discards. */
        if (def.type === 'power') this.exhaustPile.push(card);
        else this.discardPile.push(card);

        /* Fire onCardPlayed AFTER the actions resolve so per-attack
         * relic counters see the post-state (e.g. Venom Fang counts
         * the strike that just happened). */
        fireHook(this.run, 'onCardPlayed', {
            combat: this, run: this.run,
            cardDef: def, cardType: def.type, target: this.enemies[targetIndex] || null
        });

        this._checkWin();
        this._checkLoss();
        return true;
    }

    endPlayerTurn() {
        if (this.phase !== 'player') return;
        if (this.hand.length > 0) {
            this.discardPile.push(...this.hand);
            this.hand = [];
        }
        this.phase = 'enemy';
        if (this.player.vulnerable > 0) this.player.vulnerable--;

        fireHook(this.run, 'onTurnEnd', { combat: this, run: this.run });

        this._executeEnemyTurn();
    }

    /* -------- private helpers -------- */

    _spawnEnemy(id) {
        const def = ENEMY_LIBRARY[id];
        if (!def) throw new Error(`Unknown enemy id: ${id}`);
        return {
            id: def.id,
            name: def.name,
            spriteKey: def.spriteKey,
            accent: def.accent,
            isBoss: !!def.isBoss,
            isElite: !!def.isElite,
            maxHp: def.hp,
            hp: def.hp,
            block: 0,
            strength: 0,
            vulnerable: 0,
            intentPattern: def.intentPattern,
            intentIndex: 0
        };
    }

    _shuffle(arr) {
        const a = [...arr];
        shuffle(a, this.rng);
        return a.map((cardId) => ({
            cardId,
            instanceId: this._instanceCounter++
        }));
    }

    _startPlayerTurn() {
        this.turn++;
        /* Block decays unless a relic kept it persistent. */
        if (!this._blockPersists) this.player.block = 0;

        const baseEnergy = RUN_DEFAULTS.maxEnergy;
        this.energy = applyModifier(this.run, 'modifyEnergy', 'baseEnergy', {
            combat: this, run: this.run, baseEnergy
        });
        this.maxEnergy = this.energy;

        this._draw(this.handSize);
        this.phase = 'player';
        this._log(`-- Turn ${this.turn} --`);

        fireHook(this.run, 'onTurnStart', { combat: this, run: this.run });
    }

    _draw(n) {
        for (let i = 0; i < n; i++) {
            if (this.drawPile.length === 0) {
                if (this.discardPile.length === 0) return;
                this.drawPile = this._reshuffleDiscard();
                this.discardPile = [];
            }
            this.hand.push(this.drawPile.pop());
        }
    }

    _reshuffleDiscard() {
        const a = [...this.discardPile];
        shuffle(a, this.rng);
        return a;
    }

    _applyPlayerAction(action, targetIndex) {
        switch (action.kind) {
            case 'damage': {
                const t = this._resolveTarget(targetIndex);
                if (t) this._dealDamageToEnemy(t, action.amount);
                break;
            }
            case 'damageAll': {
                for (const e of this.enemies) {
                    if (e.hp > 0) this._dealDamageToEnemy(e, action.amount);
                }
                break;
            }
            case 'multiAttack': {
                const hits = action.hits || 1;
                for (let i = 0; i < hits; i++) {
                    const t = this._resolveTarget(targetIndex);
                    if (!t) break;
                    this._dealDamageToEnemy(t, action.amount);
                    if (this._checkWin()) break;
                }
                break;
            }
            case 'block': {
                this.player.block += action.amount;
                break;
            }
            case 'draw': {
                this._draw(action.amount);
                break;
            }
            case 'gainStrength': {
                this.player.strength += action.amount;
                break;
            }
            case 'gainEnergy': {
                this.energy += action.amount;
                break;
            }
            case 'heal': {
                this.player.hp = Math.min(this.player.maxHp, this.player.hp + action.amount);
                break;
            }
            case 'applyVulnerable': {
                const t = this._resolveTarget(targetIndex);
                if (t) t.vulnerable += action.amount;
                break;
            }
            case 'applyVulnerableAll': {
                for (const e of this.enemies) {
                    if (e.hp > 0) e.vulnerable += action.amount;
                }
                break;
            }
            default:
                console.warn('[CrawlerRun] unknown action kind:', action.kind);
        }
    }

    _resolveTarget(targetIndex) {
        let t = this.enemies[targetIndex];
        if (!t || t.hp <= 0) {
            const idx = this.enemies.findIndex((e) => e.hp > 0);
            if (idx === -1) return null;
            t = this.enemies[idx];
        }
        return t;
    }

    _dealDamageToEnemy(enemy, base) {
        let amount = Math.max(0, base + this.player.strength);
        if (enemy.vulnerable > 0) amount = Math.floor(amount * 1.5);
        const blockAbsorbed = Math.min(enemy.block, amount);
        enemy.block -= blockAbsorbed;
        const through = amount - blockAbsorbed;
        enemy.hp = Math.max(0, enemy.hp - through);

        this.run.stats.damageDealt += through;
        if (through > this.run.stats.biggestHit) this.run.stats.biggestHit = through;

        fireHook(this.run, 'onDamageDealt', {
            combat: this, run: this.run, target: enemy,
            baseAmount: base, finalAmount: through
        });

        if (enemy.hp === 0) {
            this._log(`${enemy.name} falls!`);
            this.run.stats.kills++;
        }
    }

    _dealDamageToPlayer(base, source = null) {
        let amount = Math.max(0, base);
        if (this.player.vulnerable > 0) amount = Math.floor(amount * 1.5);
        const blockAbsorbed = Math.min(this.player.block, amount);
        this.player.block -= blockAbsorbed;
        const through = amount - blockAbsorbed;
        this.player.hp = Math.max(0, this.player.hp - through);
        this.run.stats.damageTaken += through;

        fireHook(this.run, 'onPlayerHit', {
            combat: this, run: this.run,
            source, baseAmount: base, finalAmount: through
        });
    }

    _executeEnemyTurn() {
        for (const enemy of this.enemies) {
            if (enemy.hp <= 0) continue;
            const intent = enemy.intentPattern[enemy.intentIndex];
            this._executeIntent(enemy, intent);
            enemy.intentIndex = (enemy.intentIndex + 1) % enemy.intentPattern.length;
            if (this._checkLoss()) return;
        }
        for (const e of this.enemies) {
            if (e.vulnerable > 0) e.vulnerable--;
        }
        if (this._checkWin()) return;
        this._startPlayerTurn();
    }

    _executeIntent(enemy, intent) {
        switch (intent.kind) {
            case 'attack':
                this._dealDamageToPlayer(intent.amount + (enemy.strength || 0), enemy);
                this._log(`${enemy.name} attacks for ${intent.amount}.`);
                break;
            case 'block':
                enemy.block += intent.amount;
                this._log(`${enemy.name} braces (Block ${intent.amount}).`);
                break;
            case 'attackVuln':
                this._dealDamageToPlayer(intent.amount + (enemy.strength || 0), enemy);
                this.player.vulnerable += intent.vuln;
                this._log(`${enemy.name} hits for ${intent.amount} + Vuln ${intent.vuln}.`);
                break;
            case 'debuff':
                this.player.vulnerable += intent.vuln;
                this._log(`${enemy.name} curses you (Vuln ${intent.vuln}).`);
                break;
            case 'drain': {
                this._dealDamageToPlayer(intent.amount + (enemy.strength || 0), enemy);
                const heal = intent.heal || 0;
                enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
                this._log(`${enemy.name} drains ${intent.amount} HP.`);
                break;
            }
            case 'multiAttack': {
                const hits = intent.hits || 1;
                for (let i = 0; i < hits; i++) {
                    this._dealDamageToPlayer(intent.amount + (enemy.strength || 0), enemy);
                    if (this._checkLoss()) return;
                }
                this._log(`${enemy.name} flurries ${intent.amount}x${hits}.`);
                break;
            }
            case 'buffSelf':
                enemy.strength = (enemy.strength || 0) + (intent.strength || 0);
                this._log(`${enemy.name} grows stronger (+${intent.strength} Str).`);
                break;
            case 'summonBlock': {
                enemy.block += (intent.amount || 0);
                for (const ally of this.enemies) {
                    if (ally !== enemy && ally.hp > 0) {
                        ally.block += (intent.allyAmount || 0);
                    }
                }
                this._log(`${enemy.name} commands a Block formation.`);
                break;
            }
        }
    }

    _checkWin() {
        if (this.phase === 'won' || this.phase === 'lost') return false;
        if (this.enemies.every((e) => e.hp <= 0)) {
            this.phase = 'won';
            this._log('Victory!');
            return true;
        }
        return false;
    }

    _checkLoss() {
        if (this.phase === 'won' || this.phase === 'lost') return false;
        if (this.player.hp <= 0) {
            this.phase = 'lost';
            this._log('You fall...');
            return true;
        }
        return false;
    }

    _log(msg) {
        this.log.push(msg);
        if (this.log.length > 8) this.log.splice(0, this.log.length - 8);
    }
}

/*
 * Helper for the UI: peek at the current intent for an enemy without
 * advancing it. Used by the intent-tooltip render path.
 */
export function currentIntent(enemy) {
    if (!enemy || enemy.hp <= 0) return null;
    return enemy.intentPattern[enemy.intentIndex];
}

/*
 * Daily-seed factory: builds a CrawlerRun with today's local-date seed.
 * Same date → same map / encounters / rewards for everyone running it.
 */
export function startDailyRun(characterId) {
    const seed = todaySeedString();
    return new CrawlerRun(characterId, { seed: 'daily-' + seed, daily: true });
}

/*
 * Pull `count` random distinct cards from the reward pool. Kept exported
 * for back-compat with callers that don't go through the run-state
 * reward queue. Uses Math.random unless the caller passes their own RNG.
 */
export function rollRewardCards(count = 3, rng = Math.random) {
    return pickN(REWARD_POOL, count, rng);
}
