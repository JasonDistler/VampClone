/*
 * Crawler Mode UI layer.
 *
 * Pure DOM rendering on top of the engine in CrawlerRun.js. The pattern is
 * "render from state": every interaction (card click, end turn, reward
 * pick, etc.) mutates the engine and then re-renders the visible stage.
 *
 * The engine uses a phase machine (run.phase) that the UI mirrors with a
 * one-stage-visible-at-a-time approach:
 *
 *   pre-run        → #crawler-charselect    (pick hero + daily toggle)
 *   map            → #crawler-map           (SVG branching path)
 *   in-combat      → #crawler-combat        (battlefield + hand + log)
 *   reward         → #crawler-reward        (1 of N cards, skippable)
 *   free-reward    → #crawler-reward        (same, from '?' nodes)
 *   boss-reward    → #crawler-reward        (extra cards, then descend)
 *   elite-reward   → #crawler-elite-reward  (relic picker, then card picker)
 *   rest           → #crawler-rest          (heal or upgrade a card)
 *   shop           → #crawler-shop          (buy cards / heal / remove)
 *   victory        → #crawler-summary       (run-end stats + deck dump)
 *   defeat         → #crawler-summary       (same, red title)
 *
 * The class is exported as a singleton so MainMenuScene can call
 * `crawlerUI.start(onExit)` from the menu without juggling instances.
 */

import { CrawlerRun, currentIntent, startDailyRun } from './CrawlerRun.js';
import { CARD_LIBRARY, getCard, isUpgradable, previewDamage, STARTER_DECKS } from './Cards.js';
import { describeIntent, intentIcon, projectIntentDamage } from './Enemies.js';
import { paintSprite, spriteKeyForIntent } from './CrawlerSprites.js';
import { RELIC_LIBRARY, getRelic } from './Relics.js';
import { renderMap } from './CrawlerMapRenderer.js';
import { todaySeedString } from './Rng.js';
import { audio } from '../systems/AudioSystem.js';
import { CHARACTERS, CHARACTER_ORDER } from '../characters/Characters.js';

/* ------------------------------------------------------------------
 *  Stage IDs (must match the element ids in index.html, with the
 *  'crawler-' prefix stripped). Order isn't significant; existence
 *  is — _setStage hides all stages not in this list.
 * ------------------------------------------------------------------ */
const STAGE_IDS = [
    'charselect', 'map', 'prefight', 'combat',
    'reward', 'elite-reward', 'rest', 'shop', 'summary'
];

/* ------------------------------------------------------------------
 *  Enemy → biome lookup for the parallax background. Floor 2 / 3
 *  enemies map to repurposed Floor 1 biomes (crypt for boneyard
 *  vibes, throne for boss / fire). The first enemy in an encounter
 *  decides the biome.
 * ------------------------------------------------------------------ */
const ENEMY_BIOMES = {
    /* Floor 1 */
    goblinScout: 'forest',
    caveBat:     'forest',
    skeleton:    'crypt',
    beholder:    'sanctum',
    goblinChieftain: 'forest',
    bogWraith:   'sanctum',
    wraithBoss:  'throne',
    /* Floor 2 */
    orcBrute:    'crypt',
    zombie:      'crypt',
    necroAcolyte: 'sanctum',
    orcWarchief: 'throne',
    darkPriest:  'sanctum',
    balor:       'throne',
    /* Floor 3 */
    deathKnight: 'throne',
    shadowmancer: 'sanctum',
    iceTroll:    'crypt',
    skeleKing:   'crypt',
    demonWarlock: 'sanctum',
    balorPrime:  'throne'
};

/* Default biome by floor for non-combat stages (map / rest / shop). */
const FLOOR_BIOME = { 1: 'entry', 2: 'crypt', 3: 'throne' };

/* Music routing — maps biome → AudioSystem pattern name. */
const BIOME_MUSIC = {
    entry:   'menu',
    forest:  'forest',
    crypt:   'swamp',
    sanctum: 'library',
    throne:  'boss'
};

/*
 * Length of the card-play fly-out animation. The hand DOM is held
 * back from re-rendering until the played card finishes lifting off
 * the table, matching the cardPlay keyframe in style.css.
 */
const CARD_PLAY_ANIM_MS = 220;

/* ------------------------------------------------------------------
 *  Status-effect tooltip copy. Surfaced on hover over the pips
 *  rendered next to each fighter, and the engine action descriptions
 *  on intent badges. Keep these terse and player-facing.
 * ------------------------------------------------------------------ */
const STATUS_TIPS = {
    block:      { title: 'Block', text: 'Soaks incoming damage 1:1. <b>Resets to 0</b> at the start of your turn (unless a relic says otherwise).' },
    strength:   { title: 'Strength', text: 'All of your damage actions deal <b>+1</b> per stack. Lasts the rest of this combat.' },
    vulnerable: { title: 'Vulnerable', text: 'Target takes <b>50% extra damage</b>. Decays by 1 at the end of the affected side\'s turn.' }
};

/*
 * Intent tooltip copy. Same shape as STATUS_TIPS — title + html. The
 * UI generates the player-facing damage figure dynamically (taking
 * the enemy's Strength buff and the player's Vulnerable stacks into
 * account) so we only need the static descriptive text here.
 */
const INTENT_TIPS = {
    attack:      { title: 'Attack', text: 'Single hit. Soak with Block to negate, or buy time with debuffs.' },
    multiAttack: { title: 'Flurry', text: 'Multiple hits in one turn. Each hit checks Block separately.' },
    attackVuln:  { title: 'Hex Strike', text: 'Damage AND applies Vulnerable, so the next swing bites harder.' },
    block:       { title: 'Bracing', text: 'Adds to the enemy\'s Block pool. Your next attacks bounce off until it\'s depleted.' },
    debuff:      { title: 'Curse', text: 'Applies Vulnerable. You take 50% extra damage until it decays.' },
    drain:       { title: 'Drain', text: 'Damages you AND heals the caster. Burst it down before it stabilizes.' },
    buffSelf:    { title: 'Empower', text: 'Permanently increases the enemy\'s Strength for the rest of combat.' },
    summonBlock: { title: 'Formation', text: 'Block for itself AND every other living ally. Punishes split-attacks.' }
};

/* ====================================================================
 *  CrawlerUI
 * ==================================================================== */

class CrawlerUI {
    constructor() {
        /* ---- Run / combat state cache ---- */
        this.run = null;
        this.selectedTarget = 0;
        this._onExit = null;

        /* ---- One-time setup ---- */
        this._wired = false;

        /* ---- Char-select state (pre-run) ---- */
        this.selectedCharId = null;
        this.dailyEnabled = false;

        /* ---- Elite-reward sub-state ---- */
        /* After picking (or skipping) the relic, we switch to the
         * normal #crawler-reward stage to pick a card. This flag
         * tells _onRewardPick which queue to clear after the pick. */
        this._eliteRelicResolved = false;

        /* ---- Rest sub-state ---- */
        this._restUpgradeOpen = false;

        /* ---- Combat input lock ---- */
        /* True while the card-play animation is in flight so the
         * player can't double-click during the resolve delay. */
        this._busy = false;

        /* ---- Render-to-render snapshots ---- */
        /* Used by _emitDeltas to figure out what floaters / flashes
         * to spawn. Cleared at the start of each combat. */
        this._lastFighterState = null;
        this._lastEnergy = null;

        /* ---- Audio bookkeeping ---- */
        this._currentMusic = null;
    }

    /* ====================================================================
     *  Public API
     * ==================================================================== */

    /*
     * Show the crawler shell. `onExit` is invoked when the player quits,
     * dies, or finishes the final boss — the host (MainMenuScene) uses
     * it to restore the main menu.
     */
    start(onExit) {
        this._onExit = onExit;
        if (!this._wired) {
            this._wireOnce();
            this._wired = true;
        }
        this._resetRunState();
        this._show();
        this._goToCharSelect();
    }

    isOpen() {
        const el = document.getElementById('crawler-mode');
        return !!(el && !el.classList.contains('hidden'));
    }

    /* ====================================================================
     *  One-time DOM wiring
     * ==================================================================== */

    _wireOnce() {
        const $ = (id) => document.getElementById(id);

        this.el = {
            root:                $('crawler-mode'),
            floorLabel:          $('crawler-floor-label'),
            fightLabel:          $('crawler-fight-label'),
            hpValue:             $('crawler-hp-value'),
            goldValue:           $('crawler-gold-value'),
            relicsStrip:         $('crawler-relics-strip'),
            quit:                $('crawler-quit'),
            deckBtn:             $('crawler-deck-btn'),
            tooltip:             $('crawler-tooltip'),
            tooltipTitle:        $('crawler-tooltip-title'),
            tooltipText:         $('crawler-tooltip-text'),

            /* Char-select */
            stageCharSelect:     $('crawler-charselect'),
            charGrid:            $('crawler-charselect-grid'),
            dailyCheckbox:       $('crawler-daily-checkbox'),
            dailySeedLabel:      $('crawler-daily-seed-label'),
            charSelectBack:      $('crawler-charselect-back'),
            charSelectConfirm:   $('crawler-charselect-confirm'),

            /* Map */
            stageMap:            $('crawler-map'),
            mapTitle:            $('crawler-map-title'),
            mapSvg:              $('crawler-map-svg'),

            /* Prefight */
            stagePrefight:       $('crawler-prefight'),
            prefightTitle:       $('crawler-prefight-title'),
            prefightSub:         $('crawler-prefight-sub'),
            prefightPrev:        $('crawler-prefight-preview'),
            beginFight:          $('crawler-begin-fight'),

            /* Combat */
            stageCombat:         $('crawler-combat'),
            enemies:             $('crawler-enemies'),
            playerPanel:         $('crawler-player'),
            energyValue:         $('crawler-energy-value'),
            drawCount:           $('crawler-draw-count'),
            discardCount:        $('crawler-discard-count'),
            exhaustCount:        $('crawler-exhaust-count'),
            endTurn:             $('crawler-end-turn'),
            hand:                $('crawler-hand'),
            log:                 $('crawler-log'),

            /* Reward (also used for free-reward and boss-reward) */
            stageReward:         $('crawler-reward'),
            rewardTitle:         $('crawler-reward-title'),
            rewardSub:           $('crawler-reward-sub'),
            rewardCards:         $('crawler-reward-cards'),
            rewardSkip:          $('crawler-reward-skip'),

            /* Elite reward (relic picker) */
            stageEliteReward:    $('crawler-elite-reward'),
            eliteRelicChoices:   $('crawler-elite-relic-choices'),
            eliteRelicSkip:      $('crawler-elite-relic-skip'),

            /* Rest */
            stageRest:           $('crawler-rest'),
            restHeal:            $('crawler-rest-heal'),
            restUpgrade:         $('crawler-rest-upgrade'),
            upgradePicker:       $('crawler-upgrade-picker'),
            upgradeGrid:         $('crawler-upgrade-grid'),
            upgradeCancel:       $('crawler-upgrade-cancel'),

            /* Shop (created lazily — may not exist in older HTML) */
            stageShop:           $('crawler-shop'),
            shopCards:           $('crawler-shop-cards'),
            shopHeal:            $('crawler-shop-heal'),
            shopRemove:          $('crawler-shop-remove'),
            shopRemoveGrid:      $('crawler-shop-remove-grid'),
            shopLeave:           $('crawler-shop-leave'),

            /* Summary */
            stageSummary:        $('crawler-summary'),
            summaryTitle:        $('crawler-summary-title'),
            summarySub:          $('crawler-summary-sub'),
            summaryGrid:         $('crawler-summary-grid'),
            summaryDeck:         $('crawler-summary-deck'),
            summaryRelics:       $('crawler-summary-relics'),
            summaryMeta:         $('crawler-summary-meta'),
            summaryReturn:       $('crawler-summary-return'),

            /* Deck modal */
            deckModal:           $('crawler-deck-modal'),
            deckModalList:       $('crawler-deck-modal-list'),
            deckModalClose:      $('crawler-deck-modal-close')
        };

        /* Top bar */
        this.el.quit?.addEventListener('click', () => this._confirmQuit());
        this.el.deckBtn?.addEventListener('click', () => this._showDeckModal());

        /* Char-select */
        this.el.charSelectBack?.addEventListener('click', () => this._exit());
        this.el.charSelectConfirm?.addEventListener('click', () => this._confirmCharSelect());
        this.el.dailyCheckbox?.addEventListener('change', () => {
            this.dailyEnabled = !!this.el.dailyCheckbox.checked;
        });
        if (this.el.dailySeedLabel) {
            this.el.dailySeedLabel.textContent = todaySeedString();
        }

        /* Prefight */
        this.el.beginFight?.addEventListener('click', () => this._beginFight());

        /* Combat */
        this.el.endTurn?.addEventListener('click', () => this._onEndTurn());

        /* Reward */
        this.el.rewardSkip?.addEventListener('click', () => this._onRewardPick(null));

        /* Elite reward */
        this.el.eliteRelicSkip?.addEventListener('click', () => this._onElitePickRelic(null));

        /* Rest */
        this.el.restHeal?.addEventListener('click', () => this._onRestHeal());
        this.el.restUpgrade?.addEventListener('click', () => this._onRestUpgradeBegin());
        this.el.upgradeCancel?.addEventListener('click', () => this._onRestUpgradeCancel());

        /* Shop */
        this.el.shopHeal?.addEventListener('click', () => this._onShopHeal());
        this.el.shopRemove?.addEventListener('click', () => this._onShopRemoveBegin());
        this.el.shopLeave?.addEventListener('click', () => this._onShopLeave());

        /* Summary */
        this.el.summaryReturn?.addEventListener('click', () => this._exit());

        /* Deck modal */
        this.el.deckModalClose?.addEventListener('click', () => this._hideDeckModal());

        /* Tooltip dismiss on any click outside */
        document.addEventListener('click', (ev) => {
            if (!this.el.tooltip || this.el.tooltip.classList.contains('hidden')) return;
            if (!ev.target.closest('[data-tooltip]')) this._hideTooltip();
        });
    }

    /* ====================================================================
     *  Show / hide / exit
     * ==================================================================== */

    _show() {
        this.el.root?.classList.remove('hidden');
    }

    _hide() {
        this.el.root?.classList.add('hidden');
    }

    _exit() {
        this._stopMusic();
        this._hide();
        this.run = null;
        if (typeof this._onExit === 'function') this._onExit();
    }

    _confirmQuit() {
        if (this.run && this.run.phase !== 'victory' && this.run.phase !== 'defeat' && this.run.phase !== 'pre-run') {
            if (!window.confirm('Abandon this Crawler run? All progress will be lost.')) return;
        }
        this._exit();
    }

    _resetRunState() {
        this.run = null;
        this.selectedTarget = 0;
        this.selectedCharId = null;
        this.dailyEnabled = false;
        this._eliteRelicResolved = false;
        this._restUpgradeOpen = false;
        this._busy = false;
        this._lastFighterState = null;
        this._lastEnergy = null;
        if (this.el && this.el.dailyCheckbox) this.el.dailyCheckbox.checked = false;
    }

    /* ====================================================================
     *  Stage routing
     * ==================================================================== */

    _setStage(stage) {
        for (const s of STAGE_IDS) {
            const id = 'crawler-' + s;
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', s !== stage);
        }
    }

    _goToCharSelect() {
        this._setBiome('entry');
        this._playMusic('menu');
        this._renderTopbar();
        this._renderCharSelect();
        this._setStage('charselect');
    }

    _goToMap() {
        if (!this.run) return;
        this._setBiome(FLOOR_BIOME[this.run.floor] || 'entry');
        this._playMusic('menu');
        this._renderTopbar();
        this._renderMap();
        this._setStage('map');
    }

    _goToPrefightOrCombat() {
        if (!this.run || !this.run.combat) return;
        /* Pre-fight gate only for boss encounters (gives the boss a
         * splash); normal / pack / elite drop straight into combat. */
        const c = this.run.combat;
        const headEnemy = c.enemies[0];
        const biome = (headEnemy && ENEMY_BIOMES[headEnemy.id]) || FLOOR_BIOME[this.run.floor] || 'entry';
        this._setBiome(biome);

        if (c.isBoss) {
            audio.crawlerBossEntry?.();
            this._playMusic('boss');
            this._renderPrefight();
            this._setStage('prefight');
        } else {
            if (c.isElite) audio.crawlerEliteRoar?.();
            this._playMusic(BIOME_MUSIC[biome] || 'forest');
            this._goToCombat();
        }
    }

    _goToCombat() {
        if (!this.run || !this.run.combat) return;
        this.selectedTarget = this.run.combat.enemies.findIndex((e) => e.hp > 0);
        if (this.selectedTarget === -1) this.selectedTarget = 0;
        this._lastFighterState = null;
        this._lastEnergy = null;
        audio.crawlerCardDraw?.();
        this._renderTopbar();
        this._renderCombat();
        this._setStage('combat');
    }

    _goToReward() {
        if (!this.run) return;
        const isBossReward = this.run.phase === 'boss-reward';
        if (this.el.rewardTitle) {
            this.el.rewardTitle.textContent = isBossReward ? 'BOSS REWARD' : 'CHOOSE A REWARD';
        }
        if (this.el.rewardSub) {
            this.el.rewardSub.textContent = isBossReward
                ? 'A trophy of the kill. Take one card before descending.'
                : 'Pick one card to add to your deck.';
        }
        if (this.el.rewardSkip) {
            /* Free reward and boss reward are skippable; elite-card pick is
             * also skippable. All reward stages get a skip button. */
            this.el.rewardSkip.style.display = '';
        }
        this._setBiome('entry');
        this._renderTopbar();
        this._renderReward();
        this._setStage('reward');
        audio.crawlerCombatWin?.();
        this._flash('flash-gold');
    }

    _goToEliteReward() {
        this._setBiome('entry');
        this._renderTopbar();
        this._renderEliteReward();
        this._setStage('elite-reward');
        audio.crawlerEliteRoar?.();
        this._flash('flash-gold');
    }

    _goToRest() {
        this._setBiome('entry');
        this._playMusic('menu');
        this._renderTopbar();
        this._renderRest();
        this._setStage('rest');
    }

    _goToShop() {
        this._setBiome('entry');
        this._playMusic('menu');
        this._renderTopbar();
        this._renderShop();
        this._setStage('shop');
    }

    _goToSummary(victory) {
        this._setBiome('entry');
        this._stopMusic();
        this._renderTopbar();
        this._renderSummary(victory);
        this._setStage('summary');
        if (victory) {
            audio.crawlerRunVictory?.();
            this._flash('flash-gold');
        } else {
            audio.crawlerRunDefeat?.();
            this._flash('flash-red');
        }
    }

    /* ====================================================================
     *  Char-select stage
     * ==================================================================== */

    _renderCharSelect() {
        if (!this.el.charGrid) return;
        this.el.charGrid.innerHTML = '';
        /* Only show characters that have a starter deck defined. The
         * character roster in Characters.js may include heroes that
         * haven't been written into STARTER_DECKS yet. */
        const order = CHARACTER_ORDER.filter((id) => STARTER_DECKS[id]);

        for (const id of order) {
            const char = CHARACTERS[id];
            if (!char) continue;

            const card = document.createElement('div');
            card.className = 'crawler-char-card';
            if (this.selectedCharId === id) card.classList.add('selected');
            card.dataset.charId = id;

            const portrait = document.createElement('div');
            portrait.className = 'crawler-char-card-portrait';
            const canvas = paintSprite(char.portraitKey || (id + '_0'));
            if (canvas) portrait.appendChild(canvas);
            card.appendChild(portrait);

            const name = document.createElement('div');
            name.className = 'crawler-char-card-name';
            name.textContent = char.name;
            card.appendChild(name);

            const title = document.createElement('div');
            title.className = 'crawler-char-card-title';
            title.textContent = char.title || '';
            card.appendChild(title);

            const deck = document.createElement('div');
            deck.className = 'crawler-char-card-deck';
            const starter = STARTER_DECKS[id] || [];
            const counts = {};
            for (const cid of starter) counts[cid] = (counts[cid] || 0) + 1;
            const lines = Object.keys(counts).map((cid) => {
                const def = getCard(cid);
                return `<b>${counts[cid]}×</b> ${def ? def.name : cid}`;
            });
            deck.innerHTML = lines.join(' &middot; ');
            card.appendChild(deck);

            card.addEventListener('click', () => this._selectChar(id));
            card.addEventListener('dblclick', () => {
                this._selectChar(id);
                this._confirmCharSelect();
            });
            this.el.charGrid.appendChild(card);
        }

        if (this.el.dailySeedLabel) {
            this.el.dailySeedLabel.textContent = todaySeedString();
        }
        if (this.el.charSelectConfirm) {
            this.el.charSelectConfirm.disabled = !this.selectedCharId;
        }
    }

    _selectChar(id) {
        if (!STARTER_DECKS[id]) return;
        this.selectedCharId = id;
        for (const card of this.el.charGrid.querySelectorAll('.crawler-char-card')) {
            card.classList.toggle('selected', card.dataset.charId === id);
        }
        if (this.el.charSelectConfirm) this.el.charSelectConfirm.disabled = false;
        audio.uiClick?.();
    }

    _confirmCharSelect() {
        if (!this.selectedCharId) return;
        try {
            if (this.dailyEnabled) {
                this.run = startDailyRun(this.selectedCharId);
            } else {
                this.run = new CrawlerRun(this.selectedCharId);
            }
        } catch (e) {
            console.error('[CrawlerUI] could not start run:', e);
            this._exit();
            return;
        }
        audio.crawlerNodeSelect?.();
        this.run.enterFloor(1);
        audio.crawlerMapReveal?.();
        this._goToMap();
    }

    /* ====================================================================
     *  Map stage
     * ==================================================================== */

    _renderMap() {
        if (!this.run || !this.run.map) return;
        if (this.el.mapTitle) {
            this.el.mapTitle.textContent = `FLOOR ${this.run.floor}`;
        }
        if (this.el.mapSvg) {
            renderMap(this.run.map, this.el.mapSvg, (nodeId) => this._onMapNodeClick(nodeId));
        }
    }

    _onMapNodeClick(nodeId) {
        if (!this.run) return;
        if (!this.run.map.isAvailable(nodeId)) return;
        audio.crawlerNodeSelect?.();
        const res = this.run.selectMapNode(nodeId);
        if (!res) return;
        switch (this.run.phase) {
            case 'in-combat':   this._goToPrefightOrCombat(); break;
            case 'rest':        this._goToRest(); break;
            case 'free-reward': this._rollFreeReward(); this._goToReward(); break;
            case 'shop':        this._rollShop(); this._goToShop(); break;
            default:
                /* Fall back to redrawing the map so the player isn't
                 * stuck if a node kind isn't recognized. */
                this._goToMap();
        }
    }

    /* ====================================================================
     *  Prefight stage (boss only)
     * ==================================================================== */

    _renderPrefight() {
        if (!this.run || !this.run.combat) return;
        const c = this.run.combat;
        const boss = c.enemies[0];
        if (this.el.prefightTitle) {
            this.el.prefightTitle.textContent = boss ? boss.name.toUpperCase() : 'BOSS';
        }
        if (this.el.prefightSub) {
            this.el.prefightSub.textContent = `Floor ${this.run.floor} — a great evil bars the way.`;
        }
        if (this.el.prefightPrev) {
            this.el.prefightPrev.innerHTML = '';
            if (boss) {
                const canvas = paintSprite(boss.spriteKey);
                if (canvas) {
                    const wrap = document.createElement('div');
                    wrap.className = 'crawler-fighter-portrait';
                    wrap.style.background = 'transparent';
                    wrap.appendChild(canvas);
                    this.el.prefightPrev.appendChild(wrap);
                }
            }
            const meta = document.createElement('div');
            meta.style.color = 'var(--silver-dim)';
            meta.style.fontSize = '12px';
            meta.style.letterSpacing = '0.18em';
            meta.style.textTransform = 'uppercase';
            meta.style.marginTop = '6px';
            meta.textContent = `HP ${this.run.hp} / ${this.run.maxHp}    Deck ${this.run.deck.length}    Relics ${this.run.relics.length}`;
            this.el.prefightPrev.appendChild(meta);
        }
    }

    _beginFight() {
        this._goToCombat();
    }

    /* ====================================================================
     *  Combat stage
     * ==================================================================== */

    _renderCombat() {
        const c = this.run && this.run.combat;
        if (!c) return;

        this._renderTopbar();
        this._renderEnemies(c);
        this._renderPlayer(c);
        this._renderResources(c);
        this._renderHand(c);
        this._renderLog(c);

        /* Snapshot fighter state at the end of the render so the NEXT
         * render can detect just-died transitions and play the death
         * animation exactly once. */
        this._lastFighterState = this._snapshotFighters(c);

        if (this.el.endTurn) {
            this.el.endTurn.disabled = c.phase !== 'player';
        }
    }

    _renderEnemies(c) {
        if (!this.el.enemies) return;
        this.el.enemies.innerHTML = '';
        const prev = (this._lastFighterState && this._lastFighterState.enemies) || [];
        c.enemies.forEach((enemy, idx) => {
            const wasAlive = prev[idx] ? prev[idx].hp > 0 : enemy.hp > 0;
            const justDied = wasAlive && enemy.hp <= 0;
            const intent = currentIntent(enemy);
            const card = this._buildFighterCard({
                isEnemy:    true,
                idx,
                name:       enemy.name,
                spriteKey:  spriteKeyForIntent(enemy.spriteKey, intent),
                hp:         enemy.hp,
                maxHp:      enemy.maxHp,
                block:      enemy.block,
                vulnerable: enemy.vulnerable,
                strength:   enemy.strength || 0,
                intent,
                dead:       enemy.hp <= 0 && !justDied,
                dying:      justDied,
                targetable: c.phase === 'player' && enemy.hp > 0,
                targeted:   idx === this.selectedTarget && enemy.hp > 0,
                isBoss:     enemy.isBoss,
                isElite:    enemy.isElite
            });
            this.el.enemies.appendChild(card);
        });
    }

    _renderPlayer(c) {
        if (!this.el.playerPanel) return;
        this.el.playerPanel.innerHTML = '';
        const prev = this._lastFighterState && this._lastFighterState.player;
        const wasAlive = prev ? prev.hp > 0 : c.player.hp > 0;
        const justDied = wasAlive && c.player.hp <= 0;
        const charDef = CHARACTERS[this.run.characterId] || CHARACTERS.velorian;
        const card = this._buildFighterCard({
            isEnemy:    false,
            idx:        -1,
            name:       charDef.name,
            spriteKey:  charDef.portraitKey || 'velorian_down_0',
            hp:         c.player.hp,
            maxHp:      c.player.maxHp,
            block:      c.player.block,
            vulnerable: c.player.vulnerable,
            strength:   c.player.strength,
            intent:     null,
            dead:       c.player.hp <= 0 && !justDied,
            dying:      justDied,
            targetable: false,
            targeted:   false
        });
        this.el.playerPanel.appendChild(card);
    }

    _buildFighterCard(opts) {
        const node = document.createElement('div');
        const cls = ['crawler-fighter'];
        if (opts.dying) cls.push('dying');
        else if (opts.dead) cls.push('dead');
        if (opts.targetable) cls.push('targetable');
        if (opts.targeted) cls.push('targeted');
        if (opts.isBoss) cls.push('boss');
        if (opts.isElite) cls.push('elite');
        node.className = cls.join(' ');
        node.dataset.fighter = opts.isEnemy ? ('enemy:' + opts.idx) : 'player';

        if (opts.isEnemy && opts.targetable) {
            node.addEventListener('click', () => this._onEnemyClick(opts.idx));
        }

        /* Intent badge with hover tooltip. */
        if (opts.intent && opts.isEnemy) {
            const intentEl = document.createElement('div');
            intentEl.className = 'crawler-intent';
            intentEl.dataset.tooltip = 'intent:' + opts.intent.kind;
            const projected = projectIntentDamage(opts.intent, { strength: opts.strength }, (this.run && this.run.combat && this.run.combat.player.vulnerable > 0));
            const damageHint = projected > 0 ? ` <small style="opacity:0.75">(${projected})</small>` : '';
            intentEl.innerHTML =
                `<span class="crawler-intent-icon">${intentIcon(opts.intent)}</span>` +
                `<span>${describeIntent(opts.intent)}${damageHint}</span>`;
            intentEl.addEventListener('mouseenter', () => this._showIntentTooltip(intentEl, opts.intent, opts.strength));
            intentEl.addEventListener('mouseleave', () => this._hideTooltip());
            node.appendChild(intentEl);
        }

        const portrait = document.createElement('div');
        portrait.className = 'crawler-fighter-portrait';
        const canvas = paintSprite(opts.spriteKey);
        if (canvas) portrait.appendChild(canvas);
        node.appendChild(portrait);

        const nameEl = document.createElement('div');
        nameEl.className = 'crawler-fighter-name';
        nameEl.textContent = opts.name;
        node.appendChild(nameEl);

        /* HP bar. */
        const hpRow = document.createElement('div');
        hpRow.className = 'crawler-hp-row';
        const track = document.createElement('div');
        track.className = 'crawler-hp-track';
        const fill = document.createElement('div');
        fill.className = 'crawler-hp-fill';
        const pct = opts.maxHp > 0 ? Math.max(0, Math.min(100, (opts.hp / opts.maxHp) * 100)) : 0;
        fill.style.width = pct + '%';
        const txt = document.createElement('div');
        txt.className = 'crawler-hp-text';
        txt.textContent = `${opts.hp} / ${opts.maxHp}`;
        track.appendChild(fill);
        track.appendChild(txt);
        hpRow.appendChild(track);
        node.appendChild(hpRow);

        /* Status pip row with hover tooltips. */
        const statusRow = document.createElement('div');
        statusRow.className = 'crawler-status-row';
        if (opts.block > 0) {
            const pip = this._makeStatusPip('block', '🛡 ' + opts.block);
            statusRow.appendChild(pip);
        }
        if (opts.strength > 0) {
            const pip = this._makeStatusPip('strength', '⚔ +' + opts.strength);
            statusRow.appendChild(pip);
        }
        if (opts.vulnerable > 0) {
            const pip = this._makeStatusPip('vulnerable', 'Vuln ' + opts.vulnerable);
            statusRow.appendChild(pip);
        }
        node.appendChild(statusRow);

        return node;
    }

    _makeStatusPip(kind, text) {
        const pip = document.createElement('span');
        pip.className = 'crawler-pip ' + kind;
        pip.dataset.tooltip = 'status:' + kind;
        pip.textContent = text;
        pip.addEventListener('mouseenter', () => this._showStatusTooltip(pip, kind));
        pip.addEventListener('mouseleave', () => this._hideTooltip());
        return pip;
    }

    _renderResources(c) {
        if (this.el.energyValue) {
            const newVal = c.energy;
            const refilled = this._lastEnergy != null && newVal > this._lastEnergy;
            this.el.energyValue.textContent = `${newVal} / ${c.maxEnergy}`;
            if (refilled) {
                this._pulseClass(this.el.energyValue, 'refilled', 460);
                audio.crawlerEnergyRefill?.();
            }
            this._lastEnergy = newVal;
        }
        if (this.el.drawCount)    this.el.drawCount.textContent = c.drawPile.length;
        if (this.el.discardCount) this.el.discardCount.textContent = c.discardPile.length;
        if (this.el.exhaustCount) this.el.exhaustCount.textContent = c.exhaustPile.length;
    }

    _renderHand(c) {
        if (!this.el.hand) return;
        this.el.hand.innerHTML = '';
        c.hand.forEach((cardInst, idx) => {
            const def = getCard(cardInst.cardId);
            if (!def) return;
            const cardEl = this._buildCardElement(def, {
                playable: c.energy >= def.cost && c.phase === 'player',
                onClick:  () => this._onCardClick(idx),
                combat:   c
            });
            cardEl.style.animationDelay = (idx * 45) + 'ms';
            this.el.hand.appendChild(cardEl);
        });
    }

    _buildCardElement(def, { playable, onClick, asReward = false, combat = null }) {
        const el = document.createElement('div');
        const cls = ['crawler-card', def.type];
        if (asReward) cls.push('reward');
        else if (!playable) cls.push('unplayable');
        if (def.isUpgrade) cls.push('upgrade-preview');
        el.className = cls.join(' ');

        const cost = document.createElement('div');
        cost.className = 'crawler-card-cost';
        cost.textContent = def.cost;
        el.appendChild(cost);

        const name = document.createElement('div');
        name.className = 'crawler-card-name';
        name.textContent = def.name;
        el.appendChild(name);

        const text = document.createElement('div');
        text.className = 'crawler-card-text';
        text.innerHTML = def.text.replace(/(\d+)/g, '<b>$1</b>');
        el.appendChild(text);

        const type = document.createElement('div');
        type.className = 'crawler-card-type';
        type.textContent = def.type;
        el.appendChild(type);

        /* Damage preview badge (only meaningful in combat) */
        if (combat && !asReward) {
            const preview = this._buildCardPreview(def, combat);
            if (preview) el.appendChild(preview);
        }

        if (typeof onClick === 'function') {
            el.addEventListener('click', onClick);
        }
        return el;
    }

    _buildCardPreview(def, combat) {
        const player = combat.player;
        const targetEnemy = combat.enemies[this.selectedTarget];
        const targetVuln = !!(targetEnemy && targetEnemy.vulnerable > 0);
        const dmg = previewDamage(def, player.strength, targetVuln);
        if (!dmg) return null;
        const node = document.createElement('div');
        node.className = 'crawler-card-preview';
        if (targetVuln) node.classList.add('vuln');
        node.textContent = dmg.hits > 1 ? `${dmg.perHit}×${dmg.hits} (${dmg.total})` : `${dmg.perHit}`;
        return node;
    }

    _renderLog(c) {
        if (!this.el.log) return;
        this.el.log.innerHTML = '';
        c.log.slice(-6).forEach((msg) => {
            const row = document.createElement('div');
            row.className = 'log-entry';
            if (msg.startsWith('--')) row.classList.add('turn');
            row.textContent = msg;
            this.el.log.appendChild(row);
        });
        this.el.log.scrollTop = this.el.log.scrollHeight;
    }

    /* ---- Combat input ---- */

    _onCardClick(handIndex) {
        const c = this.run && this.run.combat;
        if (!c || c.phase !== 'player' || this._busy) return;
        if (!c.canPlayCard(handIndex, this.selectedTarget)) return;

        const handEl = this.el.hand;
        const cardEl = handEl ? handEl.children[handIndex] : null;
        if (cardEl) cardEl.classList.add('playing');

        const pre = this._snapshotFighters(c);
        this._busy = true;
        audio.crawlerCardPlay?.();

        setTimeout(() => {
            const ok = c.playCard(handIndex, this.selectedTarget);
            if (!ok) {
                if (cardEl) cardEl.classList.remove('playing');
                this._busy = false;
                return;
            }
            if (!c.enemies[this.selectedTarget] || c.enemies[this.selectedTarget].hp <= 0) {
                const idx = c.enemies.findIndex((e) => e.hp > 0);
                if (idx !== -1) this.selectedTarget = idx;
            }
            this._renderCombat();
            this._emitDeltas(pre, c);
            /* The engine fires damage sfx during playCard but we keep a
             * single follow-up hit sfx here as a fallback if there was
             * any actual damage delta. */
            this._playPostActionSfx(pre, c, true);
            this._busy = false;
            this._maybeAdvanceFromCombat();
        }, CARD_PLAY_ANIM_MS);
    }

    _onEndTurn() {
        const c = this.run && this.run.combat;
        if (!c || c.phase !== 'player' || this._busy) return;
        const pre = this._snapshotFighters(c);
        audio.uiClick?.();
        c.endPlayerTurn();
        if (c.enemies[this.selectedTarget] && c.enemies[this.selectedTarget].hp <= 0) {
            const idx = c.enemies.findIndex((e) => e.hp > 0);
            if (idx !== -1) this.selectedTarget = idx;
        }
        this._renderCombat();
        this._emitDeltas(pre, c);
        this._playPostActionSfx(pre, c, false);
        this._maybeAdvanceFromCombat();
    }

    _onEnemyClick(idx) {
        const c = this.run && this.run.combat;
        if (!c || this._busy) return;
        const enemy = c.enemies[idx];
        if (!enemy || enemy.hp <= 0) return;
        this.selectedTarget = idx;
        audio.uiClick?.();
        this._renderCombat();
    }

    _maybeAdvanceFromCombat() {
        const c = this.run && this.run.combat;
        if (!c) return;
        if (c.phase === 'won') {
            setTimeout(() => this._onCombatWon(), 600);
        } else if (c.phase === 'lost') {
            setTimeout(() => this._onCombatLost(), 700);
        }
    }

    _onCombatWon() {
        if (!this.run) return;
        this.run.finishCombat(true);
        switch (this.run.phase) {
            case 'victory':       this._goToSummary(true); break;
            case 'boss-reward':   this._goToReward(); break;
            case 'elite-reward':  this._eliteRelicResolved = false; this._goToEliteReward(); break;
            case 'reward':
            default:              this._goToReward(); break;
        }
    }

    _onCombatLost() {
        if (!this.run) return;
        this.run.finishCombat(false);
        this._goToSummary(false);
    }

    _playPostActionSfx(pre, c, fromPlayer) {
        /* Determine if anything noteworthy happened: enemy took damage
         * → enemyHit; player took damage → playerHit; enemy died →
         * enemyDeath. We use the same throttling as survivor mode. */
        if (!pre || !c) return;
        let enemyHurt = false, enemyDied = false, playerHurt = false;
        c.enemies.forEach((e, idx) => {
            const b = pre.enemies[idx];
            if (!b) return;
            if (e.hp < b.hp) enemyHurt = true;
            if (b.hp > 0 && e.hp <= 0) enemyDied = true;
        });
        if (c.player.hp < pre.player.hp) playerHurt = true;
        if (enemyHurt) audio.crawlerAttackHit?.();
        if (enemyDied) audio.enemyDeath?.();
        if (playerHurt) audio.crawlerEnemyAttack?.();
        const blockGainPlayer = c.player.block > pre.player.block;
        if (blockGainPlayer && fromPlayer) audio.crawlerBlockGain?.();
        const playerVulnUp = c.player.vulnerable > pre.player.vulnerable;
        if (playerVulnUp) audio.crawlerVulnApply?.();
    }

    /* ====================================================================
     *  Reward stage (normal, free, and boss rewards)
     * ==================================================================== */

    _rollFreeReward() {
        /* Free-reward nodes call selectMapNode which sets phase='free-
         * reward' but doesn't pre-roll cards (the engine's _queueRewards
         * is only called by finishCombat). Roll them here. */
        if (!this.run) return;
        const { REWARD_POOL } = window.__crawlerRewardPool || {};
        /* Lazy-load reward pool via dynamic import-free path: just
         * use Object.keys on CARD_LIBRARY filtered by upgrade flag. */
        if (!this.run.rewardChoices) {
            const candidates = Object.keys(CARD_LIBRARY).filter((id) => !CARD_LIBRARY[id].isUpgrade);
            const picks = [];
            for (let i = 0; i < 3 && candidates.length > 0; i++) {
                const idx = Math.floor(this.run.rng() * candidates.length);
                picks.push(candidates.splice(idx, 1)[0]);
            }
            this.run.rewardChoices = picks;
        }
    }

    _renderReward() {
        if (!this.el.rewardCards) return;
        this.el.rewardCards.innerHTML = '';
        const choices = (this.run && this.run.rewardChoices) || [];
        choices.forEach((cardId, idx) => {
            const def = getCard(cardId);
            if (!def) return;
            const cardEl = this._buildCardElement(def, {
                playable: true,
                asReward: true,
                onClick:  () => this._onRewardPick(cardId)
            });
            cardEl.style.animationDelay = (idx * 90) + 'ms';
            this.el.rewardCards.appendChild(cardEl);
        });
    }

    _onRewardPick(cardId) {
        if (!this.run) return;
        if (cardId) {
            this.run.addCardToDeck(cardId);
            audio.crawlerCardUpgrade?.();
        } else {
            audio.uiClick?.();
        }
        const wasPhase = this.run.phase;
        this.run.rewardChoices = null;

        if (wasPhase === 'boss-reward') {
            /* Descend to next floor or finish run. */
            const nextFloor = this.run.floor + 1;
            if (nextFloor > this.run.totalFloors) {
                this.run.phase = 'victory';
                this._goToSummary(true);
                return;
            }
            this.run.enterFloor(nextFloor);
            audio.crawlerMapReveal?.();
            this._goToMap();
            return;
        }

        /* Normal / free / elite-card reward → back to the map. */
        this.run.phase = 'map';
        this._goToMap();
    }

    /* ====================================================================
     *  Elite reward stage (relic picker, then card picker)
     * ==================================================================== */

    _renderEliteReward() {
        if (!this.el.eliteRelicChoices) return;
        const choices = (this.run && this.run.pendingRelicChoices) || [];
        this.el.eliteRelicChoices.innerHTML = '';
        choices.forEach((relicId, idx) => {
            const relic = getRelic(relicId);
            if (!relic) return;
            const card = document.createElement('div');
            card.className = 'crawler-relic-card ' + (relic.rarity || 'common');
            card.style.animationDelay = (idx * 90) + 'ms';

            const icon = document.createElement('div');
            icon.className = 'crawler-relic-card-icon';
            icon.textContent = '✦';
            card.appendChild(icon);

            const name = document.createElement('div');
            name.className = 'crawler-relic-card-name';
            name.textContent = relic.name;
            card.appendChild(name);

            const text = document.createElement('div');
            text.className = 'crawler-relic-card-text';
            text.textContent = relic.text || '';
            card.appendChild(text);

            const rarity = document.createElement('div');
            rarity.className = 'crawler-relic-card-rarity';
            rarity.textContent = (relic.rarity || 'common').toUpperCase();
            card.appendChild(rarity);

            card.addEventListener('click', () => this._onElitePickRelic(relicId));
            this.el.eliteRelicChoices.appendChild(card);
        });
    }

    _onElitePickRelic(relicId) {
        if (!this.run) return;
        if (relicId) {
            this.run.addRelic(relicId);
            audio.crawlerRelicGet?.();
        } else {
            audio.uiClick?.();
        }
        this.run.pendingRelicChoices = null;
        this._eliteRelicResolved = true;
        /* Fall through to the card picker. Engine has already queued
         * the rewardChoices in finishCombat. */
        this._goToReward();
    }

    /* ====================================================================
     *  Rest stage
     * ==================================================================== */

    _renderRest() {
        if (!this.el.upgradePicker) return;
        this.el.upgradePicker.classList.add('hidden');
        this._restUpgradeOpen = false;
    }

    _onRestHeal() {
        if (!this.run) return;
        const healed = this.run.healByPercent(0.30);
        audio.crawlerRestHeal?.();
        this._renderTopbar();
        /* Brief delay so the topbar HP value visually updates before
         * we leave the stage. */
        setTimeout(() => {
            this.run.phase = 'map';
            this._goToMap();
        }, 400);
    }

    _onRestUpgradeBegin() {
        if (!this.run) return;
        const upgradables = this.run.upgradableDeckEntries();
        if (upgradables.length === 0) {
            window.alert('No upgradable cards remain in your deck.');
            return;
        }
        audio.uiClick?.();
        this._restUpgradeOpen = true;
        this._renderUpgradePicker(upgradables);
        if (this.el.upgradePicker) this.el.upgradePicker.classList.remove('hidden');
    }

    _renderUpgradePicker(entries) {
        if (!this.el.upgradeGrid) return;
        this.el.upgradeGrid.innerHTML = '';
        entries.forEach(({ cardId, deckIndex }, idx) => {
            const def = getCard(cardId);
            if (!def) return;
            const upgraded = def.upgradedId ? getCard(def.upgradedId) : null;
            const wrap = document.createElement('div');
            wrap.className = 'crawler-card';
            wrap.style.cursor = 'pointer';
            wrap.style.animationDelay = (idx * 40) + 'ms';

            const cost = document.createElement('div');
            cost.className = 'crawler-card-cost';
            cost.textContent = (upgraded ? upgraded.cost : def.cost);
            wrap.appendChild(cost);

            const name = document.createElement('div');
            name.className = 'crawler-card-name';
            name.textContent = (upgraded ? upgraded.name : def.name);
            wrap.appendChild(name);

            const text = document.createElement('div');
            text.className = 'crawler-card-text';
            text.innerHTML = ((upgraded ? upgraded.text : def.text) || '').replace(/(\d+)/g, '<b>$1</b>');
            wrap.appendChild(text);

            const type = document.createElement('div');
            type.className = 'crawler-card-type';
            type.textContent = 'upgrade';
            wrap.appendChild(type);

            wrap.addEventListener('click', () => this._onUpgradePickCard(deckIndex));
            this.el.upgradeGrid.appendChild(wrap);
        });
    }

    _onUpgradePickCard(deckIndex) {
        if (!this.run) return;
        const ok = this.run.upgradeDeckCard(deckIndex);
        if (!ok) return;
        audio.crawlerCardUpgrade?.();
        this.run.phase = 'map';
        this._renderTopbar();
        this._goToMap();
    }

    _onRestUpgradeCancel() {
        if (this.el.upgradePicker) this.el.upgradePicker.classList.add('hidden');
        this._restUpgradeOpen = false;
    }

    /* ====================================================================
     *  Shop stage
     * ==================================================================== */

    _rollShop() {
        /* Roll three cards for sale on entry. Card prices are flat
         * for MVP simplicity. */
        if (!this.run) return;
        const candidates = Object.keys(CARD_LIBRARY).filter((id) => !CARD_LIBRARY[id].isUpgrade);
        const picks = [];
        for (let i = 0; i < 3 && candidates.length > 0; i++) {
            const idx = Math.floor(this.run.rng() * candidates.length);
            picks.push(candidates.splice(idx, 1)[0]);
        }
        this.run.shopOffer = picks;
        this.run.shopBought = {};
    }

    _renderShop() {
        if (!this.run) return;
        if (this.el.shopCards) {
            this.el.shopCards.innerHTML = '';
            const offer = this.run.shopOffer || [];
            offer.forEach((cardId, idx) => {
                const def = getCard(cardId);
                if (!def) return;
                const price = 50;
                const bought = !!this.run.shopBought && this.run.shopBought[idx];
                const wrap = document.createElement('div');
                wrap.className = 'crawler-card';
                if (bought) wrap.classList.add('unplayable');
                wrap.style.animationDelay = (idx * 70) + 'ms';

                const cost = document.createElement('div');
                cost.className = 'crawler-card-cost';
                cost.textContent = def.cost;
                wrap.appendChild(cost);

                const name = document.createElement('div');
                name.className = 'crawler-card-name';
                name.textContent = def.name;
                wrap.appendChild(name);

                const text = document.createElement('div');
                text.className = 'crawler-card-text';
                text.innerHTML = def.text.replace(/(\d+)/g, '<b>$1</b>');
                wrap.appendChild(text);

                const tag = document.createElement('div');
                tag.className = 'crawler-card-type';
                tag.textContent = bought ? 'BOUGHT' : `${price}g`;
                wrap.appendChild(tag);

                if (!bought) {
                    wrap.addEventListener('click', () => this._onShopBuy(idx, cardId, price));
                }
                this.el.shopCards.appendChild(wrap);
            });
        }
        /* Update gold/HP visible state */
        this._renderTopbar();
    }

    _onShopBuy(slotIdx, cardId, price) {
        if (!this.run) return;
        if (this.run.gold < price) {
            audio.uiClick?.();
            return;
        }
        this.run.gold -= price;
        this.run.addCardToDeck(cardId);
        this.run.shopBought = this.run.shopBought || {};
        this.run.shopBought[slotIdx] = true;
        audio.crawlerCardUpgrade?.();
        this._renderShop();
    }

    _onShopHeal() {
        if (!this.run) return;
        const price = 40;
        if (this.run.gold < price) { audio.uiClick?.(); return; }
        this.run.gold -= price;
        this.run.healByPercent(0.30);
        audio.crawlerRestHeal?.();
        this._renderShop();
    }

    _onShopRemoveBegin() {
        if (!this.run) return;
        const price = 75;
        if (this.run.gold < price) { audio.uiClick?.(); return; }
        if (!this.el.shopRemoveGrid) return;
        this.el.shopRemoveGrid.innerHTML = '';
        this.run.deck.forEach((cardId, deckIdx) => {
            const def = getCard(cardId);
            if (!def) return;
            const wrap = document.createElement('div');
            wrap.className = 'crawler-summary-deck-pip';
            if (def.isUpgrade) wrap.classList.add('upgrade');
            wrap.textContent = def.name;
            wrap.style.cursor = 'pointer';
            wrap.addEventListener('click', () => {
                this.run.gold -= price;
                this.run.deck.splice(deckIdx, 1);
                audio.crawlerCardUpgrade?.();
                if (this.el.shopRemoveGrid) this.el.shopRemoveGrid.innerHTML = '';
                this._renderShop();
            });
            this.el.shopRemoveGrid.appendChild(wrap);
        });
    }

    _onShopLeave() {
        if (!this.run) return;
        audio.uiClick?.();
        this.run.phase = 'map';
        this._goToMap();
    }

    /* ====================================================================
     *  Summary stage
     * ==================================================================== */

    _renderSummary(victory) {
        if (!this.run) return;
        if (this.el.summaryTitle) {
            this.el.summaryTitle.textContent = victory ? 'VICTORY' : 'DEFEATED';
            this.el.summaryTitle.classList.toggle('crawler-title-gold', !!victory);
            this.el.summaryTitle.classList.toggle('crawler-title-red', !victory);
        }
        if (this.el.summarySub) {
            this.el.summarySub.textContent = victory
                ? 'The dungeon falls silent. Your name will be sung.'
                : 'Your run ends here. The dungeon claims another.';
        }

        const stats = this.run.stats || {};
        const elapsedSec = Math.floor((Date.now() - (stats.startedAt || Date.now())) / 1000);
        const m = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const s = String(elapsedSec % 60).padStart(2, '0');

        const rows = [
            ['Floor Reached', this.run.floor],
            ['Fights Won',    stats.fightsCleared || 0],
            ['Elites Slain',  stats.eliteKills || 0],
            ['Kills',         stats.kills || 0],
            ['Biggest Hit',   stats.biggestHit || 0],
            ['Damage Dealt',  stats.damageDealt || 0],
            ['Damage Taken',  stats.damageTaken || 0],
            ['Cards Played',  stats.cardsPlayed || 0],
            ['Relics Found',  stats.relicsCollected || 0],
            ['Gold Banked',   this.run.gold || 0],
            ['Run Time',      `${m}:${s}`]
        ];

        if (this.el.summaryGrid) {
            this.el.summaryGrid.innerHTML = '';
            for (const [label, value] of rows) {
                const wrap = document.createElement('div');
                wrap.className = 'crawler-summary-stat';
                wrap.innerHTML =
                    `<div class="crawler-summary-stat-label">${label}</div>` +
                    `<div class="crawler-summary-stat-value">${value}</div>`;
                this.el.summaryGrid.appendChild(wrap);
            }
        }

        if (this.el.summaryDeck) {
            this.el.summaryDeck.innerHTML = '';
            const counts = {};
            for (const cid of this.run.deck) counts[cid] = (counts[cid] || 0) + 1;
            for (const cid of Object.keys(counts)) {
                const def = getCard(cid);
                if (!def) continue;
                const pip = document.createElement('span');
                pip.className = 'crawler-summary-deck-pip';
                if (def.isUpgrade) pip.classList.add('upgrade');
                pip.textContent = `${counts[cid]}× ${def.name}`;
                this.el.summaryDeck.appendChild(pip);
            }
        }

        if (this.el.summaryRelics) {
            this.el.summaryRelics.innerHTML = '';
            for (const rid of this.run.relics) {
                const relic = getRelic(rid);
                if (!relic) continue;
                const pip = document.createElement('span');
                pip.className = 'crawler-summary-relic-pip';
                pip.textContent = relic.name;
                this.el.summaryRelics.appendChild(pip);
            }
            if (this.run.relics.length === 0) {
                const empty = document.createElement('span');
                empty.style.color = 'var(--silver-dim)';
                empty.style.fontStyle = 'italic';
                empty.textContent = 'No relics collected.';
                this.el.summaryRelics.appendChild(empty);
            }
        }

        if (this.el.summaryMeta) {
            const seedLine = this.run.isDaily
                ? `<div>Daily Seed — <b>${this.run.seedString.replace('daily-', '')}</b></div>`
                : `<div>Seed — <b>${this.run.seedString}</b></div>`;
            this.el.summaryMeta.innerHTML = seedLine;
        }
    }

    /* ====================================================================
     *  Topbar (HP, gold, relics, floor label, fight label)
     * ==================================================================== */

    _renderTopbar() {
        if (!this.run) {
            if (this.el.floorLabel) this.el.floorLabel.textContent = 'CRAWLER MODE';
            if (this.el.fightLabel) this.el.fightLabel.textContent = '';
            if (this.el.hpValue)    this.el.hpValue.textContent = '';
            if (this.el.goldValue)  this.el.goldValue.textContent = '0';
            if (this.el.relicsStrip) this.el.relicsStrip.innerHTML = '';
            return;
        }
        if (this.el.floorLabel) this.el.floorLabel.textContent = `FLOOR ${this.run.floor}`;
        if (this.el.fightLabel) {
            const labels = {
                'pre-run':      'Choose a hero',
                'map':          'Pick a path',
                'in-combat':    'Combat',
                'reward':       'Reward',
                'elite-reward': 'Elite Reward',
                'boss-reward':  'Boss Reward',
                'free-reward':  'Free Reward',
                'rest':         'Rest Site',
                'shop':         'Shop',
                'victory':      'Victory',
                'defeat':       'Defeat'
            };
            this.el.fightLabel.textContent = labels[this.run.phase] || '';
        }
        if (this.el.hpValue) this.el.hpValue.textContent = `${this.run.hp} / ${this.run.maxHp}`;
        if (this.el.goldValue) this.el.goldValue.textContent = String(this.run.gold);

        if (this.el.relicsStrip) {
            this.el.relicsStrip.innerHTML = '';
            for (const rid of this.run.relics) {
                const relic = getRelic(rid);
                if (!relic) continue;
                const pip = document.createElement('span');
                pip.className = 'crawler-relic-pip ' + (relic.rarity || 'common');
                pip.dataset.tooltip = 'relic:' + rid;
                pip.textContent = '✦';
                pip.addEventListener('mouseenter', () => this._showRelicTooltip(pip, relic));
                pip.addEventListener('mouseleave', () => this._hideTooltip());
                this.el.relicsStrip.appendChild(pip);
            }
        }
    }

    /* ====================================================================
     *  Deck modal
     * ==================================================================== */

    _showDeckModal() {
        if (!this.el.deckModal || !this.run) return;
        if (!this.el.deckModalList) return;
        this.el.deckModalList.innerHTML = '';
        const counts = {};
        for (const cid of this.run.deck) counts[cid] = (counts[cid] || 0) + 1;
        const ids = Object.keys(counts);
        ids.sort((a, b) => {
            const da = getCard(a), db = getCard(b);
            return (da?.name || '').localeCompare(db?.name || '');
        });
        for (const cid of ids) {
            const def = getCard(cid);
            if (!def) continue;
            const row = document.createElement('div');
            row.className = 'crawler-summary-deck-pip';
            if (def.isUpgrade) row.classList.add('upgrade');
            row.textContent = `${counts[cid]}× ${def.name} (${def.cost}E)`;
            this.el.deckModalList.appendChild(row);
        }
        this.el.deckModal.classList.remove('hidden');
        audio.uiClick?.();
    }

    _hideDeckModal() {
        this.el.deckModal?.classList.add('hidden');
    }

    /* ====================================================================
     *  Visual helpers (biome, floaters, flashes, snapshots)
     * ==================================================================== */

    _setBiome(biome) {
        const root = this.el && this.el.root;
        if (!root) return;
        root.dataset.biome = biome || 'entry';
    }

    _snapshotFighters(c) {
        if (!c) return null;
        return {
            player: {
                hp: c.player.hp,
                block: c.player.block,
                vulnerable: c.player.vulnerable,
                strength: c.player.strength
            },
            enemies: c.enemies.map((e) => ({
                hp: e.hp,
                block: e.block,
                vulnerable: e.vulnerable,
                strength: e.strength || 0
            }))
        };
    }

    _emitDeltas(pre, c) {
        if (!pre || !c) return;
        let stagger = 0;
        const STEP = 90;

        const playerEl = this._findFighterEl('player');
        const dHp = c.player.hp - pre.player.hp;
        const dBlock = c.player.block - pre.player.block;
        const dVuln = c.player.vulnerable - pre.player.vulnerable;
        const dStr = c.player.strength - pre.player.strength;

        if (dHp < 0) {
            this._floatOn(playerEl, '-' + (-dHp), 'damage', stagger); stagger += STEP;
            this._pulseClass(playerEl, 'hit', 380);
        } else if (dHp > 0) {
            this._floatOn(playerEl, '+' + dHp, 'heal', stagger); stagger += STEP;
            this._pulseClass(playerEl, 'flash-heal', 480);
        }
        if (dBlock > 0) {
            this._floatOn(playerEl, '+' + dBlock + ' BLK', 'block', stagger); stagger += STEP;
            this._pulseClass(playerEl, 'flash-block', 480);
        }
        if (dVuln > 0) {
            this._floatOn(playerEl, 'Vuln +' + dVuln, 'vuln', stagger); stagger += STEP;
        }
        if (dStr > 0) {
            this._floatOn(playerEl, 'Str +' + dStr, 'crit', stagger); stagger += STEP;
        }

        c.enemies.forEach((enemy, idx) => {
            const before = pre.enemies[idx];
            if (!before) return;
            const enemyEl = this._findFighterEl('enemy:' + idx);
            const eHp = enemy.hp - before.hp;
            const eBlock = enemy.block - before.block;
            const eVuln = enemy.vulnerable - before.vulnerable;
            const eStr = (enemy.strength || 0) - (before.strength || 0);

            if (eHp < 0) {
                this._floatOn(enemyEl, '-' + (-eHp), 'damage', stagger); stagger += STEP;
                this._pulseClass(enemyEl, 'hit', 380);
            } else if (eHp > 0) {
                this._floatOn(enemyEl, '+' + eHp, 'heal', stagger); stagger += STEP;
            }
            if (eBlock > 0) {
                this._floatOn(enemyEl, '+' + eBlock + ' BLK', 'block', stagger); stagger += STEP;
                this._pulseClass(enemyEl, 'flash-block', 480);
            }
            if (eVuln > 0) {
                this._floatOn(enemyEl, 'Vuln +' + eVuln, 'vuln', stagger); stagger += STEP;
            }
            if (eStr > 0) {
                this._floatOn(enemyEl, 'Str +' + eStr, 'crit', stagger); stagger += STEP;
            }
        });
    }

    _floatOn(parentEl, text, kind, delay = 0) {
        if (!parentEl) return;
        const span = document.createElement('span');
        span.className = 'crawler-floater ' + (kind || '');
        span.textContent = text;
        if (delay > 0) span.style.animationDelay = delay + 'ms';
        parentEl.appendChild(span);
        setTimeout(() => { if (span.parentNode) span.parentNode.removeChild(span); }, 1000 + delay);
    }

    _findFighterEl(tag) {
        const root = this.el && this.el.root;
        if (!root) return null;
        return root.querySelector('[data-fighter="' + tag + '"]');
    }

    _pulseClass(el, cls, ms) {
        if (!el) return;
        el.classList.remove(cls);
        // eslint-disable-next-line no-unused-expressions
        el.offsetWidth;
        el.classList.add(cls);
        setTimeout(() => el.classList.remove(cls), ms);
    }

    _flash(kind) {
        const flashEl = document.getElementById('crawler-flash');
        if (!flashEl) return;
        flashEl.classList.remove('flash-gold', 'flash-red', 'flash-white');
        // eslint-disable-next-line no-unused-expressions
        flashEl.offsetWidth;
        flashEl.classList.add(kind);
        setTimeout(() => flashEl.classList.remove(kind), 800);
    }

    /* ====================================================================
     *  Tooltips
     * ==================================================================== */

    _showStatusTooltip(anchorEl, kind) {
        const tip = STATUS_TIPS[kind];
        if (!tip) return;
        this._showTooltip(anchorEl, tip.title, tip.text);
    }

    _showIntentTooltip(anchorEl, intent, enemyStrength) {
        const tip = INTENT_TIPS[intent.kind];
        if (!tip) return;
        let body = tip.text;
        const playerVuln = !!(this.run && this.run.combat && this.run.combat.player.vulnerable > 0);
        const projected = projectIntentDamage(intent, { strength: enemyStrength || 0 }, playerVuln);
        if (projected > 0) {
            body += `<br><br>Incoming: <b>${projected}</b> damage` +
                (playerVuln ? ' (incl. Vulnerable)' : '') +
                ((enemyStrength || 0) > 0 ? ' (incl. enemy Strength)' : '');
        }
        this._showTooltip(anchorEl, tip.title, body);
    }

    _showRelicTooltip(anchorEl, relic) {
        this._showTooltip(anchorEl, relic.name, relic.text || '');
    }

    _showTooltip(anchorEl, title, html) {
        const tooltip = this.el.tooltip;
        if (!tooltip || !anchorEl) return;
        if (this.el.tooltipTitle) this.el.tooltipTitle.textContent = title;
        if (this.el.tooltipText)  this.el.tooltipText.innerHTML = html;
        tooltip.classList.remove('hidden');
        /* Position above the anchor, clamped into the viewport. */
        const rect = anchorEl.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - tipRect.width / 2;
        let top = rect.top - tipRect.height - 10;
        left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, left));
        if (top < 8) top = rect.bottom + 10;
        tooltip.style.left = left + 'px';
        tooltip.style.top  = top + 'px';
    }

    _hideTooltip() {
        if (!this.el.tooltip) return;
        this.el.tooltip.classList.add('hidden');
    }

    /* ====================================================================
     *  Audio
     * ==================================================================== */

    _playMusic(name) {
        if (this._currentMusic === name) return;
        this._currentMusic = name;
        audio.playMusic?.(name);
    }

    _stopMusic() {
        this._currentMusic = null;
        audio.stopMusic?.();
    }
}

export const crawlerUI = new CrawlerUI();
