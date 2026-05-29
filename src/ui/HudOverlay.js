/*
 * HudOverlay - thin bridge between Phaser scenes and the HD HTML overlay.
 * The DOM elements live in index.html. This module just reads/writes them.
 *
 * Why DOM and not canvas text? The game canvas uses pixelArt + integer scale
 * which makes Phaser-drawn text look chunky after browser upscaling. By
 * placing UI in HTML instead, the browser renders text at native viewport
 * resolution with proper sub-pixel anti-aliasing - readable at any size.
 */

import { CHARACTERS, CHARACTER_ORDER } from '../characters/Characters.js';
import { settings } from '../systems/Settings.js';
import { graphicsMode } from '../systems/GraphicsMode.js';
import { viewAngle } from '../systems/ViewAngle.js';
import { bestRuns, formatDuration } from '../systems/BestRuns.js';
import { gamepad, GP } from '../systems/Gamepad.js';
import { audio } from '../systems/AudioSystem.js';

const ICONS = {
    maxhp: '\u2665',
    heal: '\u2764',
    speed: '\u27A4',
    magnet: '\u29C9',
    armor: '\u26E8',
    lifesteal: '\u2620',
    wp_damage: '\u2694',
    wp_cooldown: '\u26A1',
    wp_radius: '\u2733',
    wp_count: '\u2734',
    wp_pierce: '\u2716',
    wp_speed: '\u27A4',
    unlock_aura: '\u2600',
    aura_damage: '\u2734',
    aura_radius: '\u25EF',
    aura_tick: '\u29B5',
    unlock_daggers: '\u2694',
    daggers_damage: '\u2716',
    daggers_cooldown: '\u26A1',
    daggers_count: '\u2723',
    daggers_pierce: '\u2733',
    generic: '\u2756'
};

function iconFor(card) {
    if (card && card.id && ICONS[card.id]) return ICONS[card.id];
    return ICONS.generic;
}

const DIFFICULTY_HINTS = {
    easy: 'Reduced spawn rate and enemy damage. A gentler descent.',
    normal: 'Standard spawn rate and damage.',
    hard: 'Faster spawns and stronger blows. Only for the bold.'
};

const GRAPHICS_HINTS = {
    pixel: 'Crisp retro pixel-art for characters and enemies.',
    hd: 'Bilinear-smoothed sprites - characters and enemies look like HD art.'
};

const VIEW_HINTS = {
    topdown: 'Camera looks straight down at the play field.',
    tilted: '3/4 oblique view - the world tilts away into the distance.'
};

class HudOverlay {
    constructor() {
        /*
         * Centralized gamepad navigation context. When non-null, every
         * tickGamepadNav() pumps d-pad / stick movement into focus
         * changes on the registered DOM items, A confirms the focused
         * item, B cancels. Each show*() builds a context, hide*() tears
         * it down via endNav().
         */
        this._nav = null;
        this._stickHeldH = 0;
        this._stickHeldV = 0;

        this.hud = document.getElementById('hud');
        this.hpFill = document.getElementById('hp-fill');
        this.hpText = document.getElementById('hp-text');
        this.timerText = document.getElementById('timer-text');
        this.killsText = document.getElementById('kills-text');
        this.levelText = document.getElementById('level-text');
        this.xpFill = document.getElementById('xp-fill');
        this.envText = document.getElementById('env-text');

        this.modalLevelUp = document.getElementById('modal-levelup');
        this.levelUpSubtitle = document.getElementById('levelup-subtitle');
        this.levelUpCards = document.getElementById('levelup-cards');

        this.modalPause = document.getElementById('modal-pause');
        this.pauseSubtitle = document.getElementById('pause-subtitle');
        this.btnResume = document.getElementById('btn-resume');
        this.btnPauseSettings = document.getElementById('btn-pause-settings');
        this.btnPauseMenu = document.getElementById('btn-pause-menu');

        this.modalGameOver = document.getElementById('modal-gameover');
        this.goTime = document.getElementById('go-time');
        this.goLevel = document.getElementById('go-level');
        this.goKills = document.getElementById('go-kills');
        this.goTimeBadge = document.getElementById('go-time-badge');
        this.goLevelBadge = document.getElementById('go-level-badge');
        this.goKillsBadge = document.getElementById('go-kills-badge');
        this.goBestSummary = document.getElementById('go-best-summary');
        this.restartBtn = document.getElementById('restart-btn');

        this.mainMenu = document.getElementById('main-menu');
        this.btnStart = document.getElementById('btn-start');
        this.btnSettings = document.getElementById('btn-settings');
        this.btnMeta = document.getElementById('btn-meta');
        this.btnCrawler = document.getElementById('btn-crawler');
        this.metaSummary = document.getElementById('meta-summary');

        this.metaModal = document.getElementById('meta-modal');
        this.metaGrid = document.getElementById('meta-grid');
        this.metaAchGrid = document.getElementById('meta-ach-grid');
        this.metaGoldAmount = document.getElementById('meta-gold-amount');
        this.btnMetaClose = document.getElementById('btn-meta-close');

        this.charSelect = document.getElementById('char-select');
        this.charGrid = document.getElementById('char-grid');
        this.btnCharBack = document.getElementById('btn-char-back');
        this.btnCharConfirm = document.getElementById('btn-char-confirm');
        this.optDaily = document.getElementById('opt-daily');
        this.dailyHint = document.getElementById('daily-hint');
        this.curseOptions = document.getElementById('curse-options');
        this._activeCurses = new Set();

        this.settingsModal = document.getElementById('settings-modal');
        this.diffControl = document.getElementById('diff-control');
        this.diffHint = document.getElementById('diff-hint');
        this.gfxControl = document.getElementById('gfx-control');
        this.gfxHint = document.getElementById('gfx-hint');
        this.viewControl = document.getElementById('view-control');
        this.viewHint = document.getElementById('view-hint');
        this.btnSettingsClose = document.getElementById('btn-settings-close');
        this.optShake = document.getElementById('opt-shake');
        this.optBlurPause = document.getElementById('opt-blur-pause');
        this.optDmgNumbers = document.getElementById('opt-dmg-numbers');

        this.volMaster = document.getElementById('vol-master');
        this.volMusic = document.getElementById('vol-music');
        this.volSfx = document.getElementById('vol-sfx');
        this.volMasterValue = document.getElementById('vol-master-value');
        this.volMusicValue = document.getElementById('vol-music-value');
        this.volSfxValue = document.getElementById('vol-sfx-value');

        this.bossBanner = document.getElementById('boss-banner');
        this.bossBannerName = document.getElementById('boss-banner-name');
        this.bossHp = document.getElementById('boss-hp');
        this.bossHpName = document.getElementById('boss-hp-name');
        this.bossHpFill = document.getElementById('boss-hp-fill');

        this.lowHpVignette = document.getElementById('low-hp-vignette');
        this.achievementToast = document.getElementById('achievement-toast');
        this.achIcon = document.getElementById('ach-icon');
        this.achName = document.getElementById('ach-name');
        this._achQueue = [];

        this.statsPanel = document.getElementById('stats-panel');
        this.statsRows = document.getElementById('stats-rows');

        this.tutorialOverlay = document.getElementById('tutorial-overlay');
        this.btnTutorialClose = document.getElementById('btn-tutorial-close');
        if (this.btnTutorialClose) {
            this.btnTutorialClose.addEventListener('click', () => this.hideTutorial());
        }

        this.introCallout = document.getElementById('intro-callout');
        this.introName = document.getElementById('intro-name');
        this.introWeapon = document.getElementById('intro-weapon');
        this.introEyebrow = document.getElementById('intro-eyebrow');

        this.selectedCharacterId = null;
        this.difficulty = 'normal';

        this._restartHandler = null;
        this._lastHpPct = 1;

        this._wireSettings();
    }

    /* -------- Gamepad navigation -------- */

    /*
     * Begin a navigation context for the controller. `items` is a list
     * of DOM elements (cards or buttons). `axis` is 'horizontal' or
     * 'vertical' and decides which d-pad/stick direction moves focus.
     * `onConfirm(idx)` fires on the A button. `onCancel()` fires on B.
     * `wrap` controls whether navigation wraps around at the ends
     * (default true).
     */
    beginNav({ items, axis = 'horizontal', focusIdx = 0, onConfirm, onCancel, wrap = true } = {}) {
        if (!items || items.length === 0) {
            this._nav = null;
            return;
        }
        this.endNav();
        this._nav = { items, axis, focusIdx, onConfirm, onCancel, wrap };
        this._applyNavFocus();
    }

    endNav() {
        if (this._nav) {
            for (const el of this._nav.items) el.classList.remove('gp-focus');
        }
        this._nav = null;
        this._stickHeldH = 0;
        this._stickHeldV = 0;
    }

    setNavFocus(idx) {
        if (!this._nav) return;
        const n = this._nav;
        const c = Math.max(0, Math.min(n.items.length - 1, idx));
        n.focusIdx = c;
        this._applyNavFocus();
    }

    _applyNavFocus() {
        if (!this._nav) return;
        this._nav.items.forEach((el, i) => el.classList.toggle('gp-focus', i === this._nav.focusIdx));
    }

    /*
     * Called once per frame from the global prestep loop in main.js.
     * No-ops when no nav is active or no controller is connected, so
     * it's free to leave wired up at all times.
     */
    tickGamepadNav() {
        if (!gamepad.connected || !this._nav) return;
        const n = this._nav;
        const horizontal = n.axis === 'horizontal';

        let prev = false, next = false;
        if (horizontal) {
            prev = gamepad.wasJustPressed(GP.DLEFT) || this._stickJust('h', -1);
            next = gamepad.wasJustPressed(GP.DRIGHT) || this._stickJust('h', 1);
        } else {
            prev = gamepad.wasJustPressed(GP.DUP) || this._stickJust('v', -1);
            next = gamepad.wasJustPressed(GP.DDOWN) || this._stickJust('v', 1);
        }

        if (prev || next) {
            const dir = next ? 1 : -1;
            let nextIdx = n.focusIdx + dir;
            const last = n.items.length - 1;
            if (n.wrap) {
                if (nextIdx < 0) nextIdx = last;
                if (nextIdx > last) nextIdx = 0;
            } else {
                nextIdx = Math.max(0, Math.min(last, nextIdx));
            }
            n.focusIdx = nextIdx;
            this._applyNavFocus();
        }

        if (gamepad.wasJustPressed(GP.A)) {
            n.onConfirm && n.onConfirm(n.focusIdx);
        }
        if (gamepad.wasJustPressed(GP.B)) {
            n.onCancel && n.onCancel();
        }
    }

    /*
     * Edge-detect stick movement past 0.5 in the given direction.
     * Returns true exactly once per "tilt past threshold from neutral",
     * matching the d-pad's just-pressed semantics so stick + d-pad
     * navigation don't double-count.
     */
    _stickJust(axis, dir) {
        const a = gamepad.axes();
        const v = axis === 'h' ? a.lx : a.ly;
        const heldKey = axis === 'h' ? '_stickHeldH' : '_stickHeldV';
        const wasHeld = this[heldKey];
        if (dir > 0) {
            if (v >= 0.5 && wasHeld <= 0) { this[heldKey] = 1; return true; }
            if (v < 0.5) this[heldKey] = (v <= -0.5) ? -1 : 0;
            return false;
        } else {
            if (v <= -0.5 && wasHeld >= 0) { this[heldKey] = -1; return true; }
            if (v > -0.5) this[heldKey] = (v >= 0.5) ? 1 : 0;
            return false;
        }
    }

    /* -------- HUD -------- */

    showHud(envName) {
        this.hud?.classList.remove('hidden');
        if (this.envText) this.envText.textContent = envName ? envName.toUpperCase() : '';
    }

    hideHud() {
        this.hud?.classList.add('hidden');
    }

    update(rs) {
        if (!rs) return;
        const hpPct = Math.max(0, rs.hp / rs.maxHp);
        if (this.hpFill) this.hpFill.style.width = (hpPct * 100).toFixed(1) + '%';
        if (this.hpText) this.hpText.textContent = `${Math.floor(rs.hp)} / ${rs.maxHp}`;

        if (this.hpFill) {
            if (hpPct > 0.5) this.hpFill.style.background = 'linear-gradient(90deg, #c8302a 0%, #ff5050 60%, #ff8888 100%)';
            else if (hpPct > 0.25) this.hpFill.style.background = 'linear-gradient(90deg, #d68a2a 0%, #ffb84a 60%, #ffd676 100%)';
            else this.hpFill.style.background = 'linear-gradient(90deg, #c8302a 0%, #ff3030 60%, #ff7070 100%)';
        }
        this._lastHpPct = hpPct;

        const totalSec = Math.floor(rs.elapsedMs / 1000);
        const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const s = String(totalSec % 60).padStart(2, '0');
        if (this.timerText) this.timerText.textContent = `${m}:${s}`;

        if (this.killsText) this.killsText.textContent = String(rs.kills);
        if (this.levelText) this.levelText.textContent = `LV ${rs.level}`;

        const xpPct = rs.xpToNext > 0 ? (rs.xp / rs.xpToNext) * 100 : 0;
        if (this.xpFill) this.xpFill.style.width = xpPct.toFixed(1) + '%';
    }

    /* -------- Level Up modal -------- */

    showLevelUp(level, range, cards, onPick) {
        if (!this.modalLevelUp || !this.levelUpCards) return;
        this.levelUpSubtitle.textContent = `LEVEL ${level} \u2014 Power-Up Range: ${range[0]}-${range[1]}%`;

        this.levelUpCards.innerHTML = '';
        const cardEls = [];
        cards.forEach((card, i) => {
            const div = document.createElement('div');
            const isUnlock = card.id && card.id.startsWith('unlock_');
            div.className = 'card' + (isUnlock ? ' unlock' : '');
            div.innerHTML = `
                <span class="card-number">${i + 1}</span>
                ${isUnlock ? '<span class="card-tag">NEW</span>' : ''}
                <div class="card-icon">${iconFor(card)}</div>
                <h3 class="card-title">${card.title}</h3>
                <p class="card-desc">${card.desc.replace(/\n/g, '<br>')}</p>
            `;
            div.addEventListener('click', () => onPick(card));
            this.levelUpCards.appendChild(div);
            cardEls.push(div);
        });

        this.modalLevelUp.classList.remove('hidden');

        this.beginNav({
            items: cardEls,
            axis: 'horizontal',
            focusIdx: 0,
            onConfirm: idx => onPick(cards[idx])
        });
    }

    hideLevelUp() {
        this.endNav();
        this.modalLevelUp?.classList.add('hidden');
    }

    /* -------- Pause -------- */

    showPause(handlers = {}) {
        if (!this.modalPause) return;
        if (this.pauseSubtitle) {
            const kbdHint = handlers.autoPaused
                ? 'Window lost focus \u2014 press <kbd>Esc</kbd> / <kbd>P</kbd> / <kbd>Enter</kbd> to resume'
                : 'Press <kbd>Esc</kbd> / <kbd>P</kbd> / <kbd>Enter</kbd> to resume';
            const gpHint = handlers.autoPaused
                ? 'Window lost focus \u2014 press <span class="gp-glyph" data-glyph="menu"></span> to resume'
                : '<span class="gp-glyph" data-glyph="menu"></span> resume &middot; <span class="gp-glyph" data-glyph="confirm"></span> select &middot; <span class="gp-glyph" data-glyph="cancel"></span> resume';
            this.pauseSubtitle.innerHTML =
                `<span class="kbd-only">${kbdHint}</span><span class="gp-only">${gpHint}</span>`;
        }
        if (this.btnResume) this.btnResume.onclick = () => handlers.onResume && handlers.onResume();
        if (this.btnPauseSettings) this.btnPauseSettings.onclick = () => handlers.onSettings && handlers.onSettings();
        if (this.btnPauseMenu) this.btnPauseMenu.onclick = () => handlers.onMainMenu && handlers.onMainMenu();
        this.modalPause.classList.remove('hidden');

        const items = [this.btnResume, this.btnPauseSettings, this.btnPauseMenu].filter(Boolean);
        const fns = [handlers.onResume, handlers.onSettings, handlers.onMainMenu];
        this.beginNav({
            items,
            axis: 'vertical',
            focusIdx: 0,
            onConfirm: idx => fns[idx] && fns[idx](),
            onCancel: () => handlers.onResume && handlers.onResume()
        });
    }

    hidePause() {
        this.endNav();
        this.modalPause?.classList.add('hidden');
    }

    isSettingsOpen() {
        return this.settingsModal && !this.settingsModal.classList.contains('hidden');
    }

    /* -------- Game Over -------- */

    showGameOver(rs, onRestart, onMenu, bestInfo) {
        if (!this.modalGameOver) return;
        const totalSec = Math.floor(rs.elapsedMs / 1000);
        const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const s = String(totalSec % 60).padStart(2, '0');
        if (this.goTime) this.goTime.textContent = `${m}:${s}`;
        if (this.goLevel) this.goLevel.textContent = String(rs.level);
        if (this.goKills) this.goKills.textContent = String(rs.kills);

        const newBests = bestInfo?.newBests || {};
        const toggleBadge = (el, on) => { if (el) el.classList.toggle('hidden', !on); };
        toggleBadge(this.goTimeBadge, !!newBests.timeMs);
        toggleBadge(this.goLevelBadge, !!newBests.level);
        toggleBadge(this.goKillsBadge, !!newBests.kills);

        if (this.goBestSummary) {
            const rec = bestInfo?.record;
            const goldEarned = rs.metaGoldEarned ?? 0;
            const goldLine = goldEarned > 0
                ? `<div class="go-gold">\u2728 +<strong>${goldEarned}</strong> gold earned</div>`
                : '';

            // Per-weapon damage chart - tiny inline horizontal bars
            // weighted by damageByWeapon. Skipped if the run dealt no
            // damage (so the chart doesn't show 0/0/0 for instant deaths).
            let chartHtml = '';
            const dbw = rs.damageByWeapon || {};
            const total = (dbw.primary || 0) + (dbw.aura || 0) + (dbw.daggers || 0);
            if (total > 0) {
                const pct = (k) => Math.round(((dbw[k] || 0) / total) * 100);
                chartHtml = `
                    <div class="go-chart">
                        <div class="go-chart-title">DAMAGE BREAKDOWN</div>
                        <div class="go-bar"><span class="go-bar-label">${rs.weaponName || 'Primary'}</span>
                          <span class="go-bar-track"><span class="go-bar-fill primary" style="width:${pct('primary')}%"></span></span>
                          <span class="go-bar-pct">${pct('primary')}%</span></div>
                        <div class="go-bar"><span class="go-bar-label">Aura</span>
                          <span class="go-bar-track"><span class="go-bar-fill aura" style="width:${pct('aura')}%"></span></span>
                          <span class="go-bar-pct">${pct('aura')}%</span></div>
                        <div class="go-bar"><span class="go-bar-label">Projectile</span>
                          <span class="go-bar-track"><span class="go-bar-fill daggers" style="width:${pct('daggers')}%"></span></span>
                          <span class="go-bar-pct">${pct('daggers')}%</span></div>
                    </div>
                `;
            }

            let bestLine = '';
            if (!rec) bestLine = '';
            else if (newBests.isFirstRun) bestLine = `First run with this hero &mdash; <strong>baseline set</strong>`;
            else {
                const bm = String(Math.floor(rec.timeMs / 60000)).padStart(2, '0');
                const bs = String(Math.floor(rec.timeMs / 1000) % 60).padStart(2, '0');
                bestLine = `Best &mdash; <strong>Lv ${rec.level}</strong> &middot; ` +
                    `<strong>${bm}:${bs}</strong> &middot; ` +
                    `<strong>${rec.kills}</strong> kills`;
            }

            this.goBestSummary.innerHTML = bestLine + goldLine + chartHtml;
        }

        if (this.restartBtn) {
            if (this._restartHandler) this.restartBtn.removeEventListener('click', this._restartHandler);
            this._restartHandler = () => onRestart();
            this.restartBtn.addEventListener('click', this._restartHandler);
        }

        const menuBtn = document.getElementById('go-menu-btn');
        if (!menuBtn && this.modalGameOver) {
            const inner = this.modalGameOver.querySelector('.modal-inner');
            const btn = document.createElement('button');
            btn.id = 'go-menu-btn';
            btn.className = 'menu-btn ghost';
            btn.style.margin = '12px auto 0';
            btn.style.display = 'block';
            btn.textContent = 'MAIN MENU';
            inner.insertBefore(btn, inner.querySelector('.modal-hint'));
        }
        const finalMenuBtn = document.getElementById('go-menu-btn');
        if (finalMenuBtn) {
            finalMenuBtn.onclick = () => onMenu && onMenu();
        }

        this.modalGameOver.classList.remove('hidden');

        const items = [this.restartBtn, finalMenuBtn].filter(Boolean);
        const fns = [() => onRestart && onRestart(), () => onMenu && onMenu()];
        this.beginNav({
            items,
            axis: 'vertical',
            focusIdx: 0,
            onConfirm: idx => fns[idx] && fns[idx](),
            onCancel: () => onMenu && onMenu()
        });
    }

    hideGameOver() {
        this.endNav();
        this.modalGameOver?.classList.add('hidden');
    }

    /* -------- Main Menu -------- */

    showMainMenu(handlers) {
        this.hideHud();
        this.hideCharSelect();
        this.hideSettings();
        this.hideGameOver();
        this.hideLevelUp();
        this.hidePause();
        if (!this.mainMenu) return;
        this.mainMenu.classList.remove('hidden');

        if (this.btnStart) this.btnStart.onclick = () => handlers.onStart && handlers.onStart();
        if (this.btnCrawler) this.btnCrawler.onclick = () => handlers.onCrawler && handlers.onCrawler();
        if (this.btnSettings) this.btnSettings.onclick = () => this.showSettings();
        if (this.btnMeta) this.btnMeta.onclick = () => this.showMetaModal();

        // Refresh the gold/runs summary line under the menu buttons so
        // returning players see their progress at a glance.
        this._refreshMetaSummary();

        const items = [this.btnStart, this.btnCrawler, this.btnMeta, this.btnSettings].filter(Boolean);
        const fns = [
            () => handlers.onStart && handlers.onStart(),
            () => handlers.onCrawler && handlers.onCrawler(),
            () => this.showMetaModal(),
            () => this.showSettings()
        ];
        this.beginNav({
            items,
            axis: 'vertical',
            focusIdx: 0,
            onConfirm: idx => fns[idx] && fns[idx]()
        });
    }

    _refreshMetaSummary() {
        if (!this.metaSummary) return;
        import('../systems/MetaProgress.js').then(({ metaProgress }) => {
            const gold = metaProgress.getGold();
            const best = metaProgress.state;
            const bestKills = best.bestKills || 0;
            const bestSec = best.bestSurvivalSec || 0;
            const min = Math.floor(bestSec / 60);
            const sec = bestSec % 60;
            const bestStr = bestKills
                ? ` \u2022 Best: ${bestKills} kills, ${min}:${sec.toString().padStart(2, '0')}`
                : '';
            this.metaSummary.textContent = `\u2728 ${gold} gold${bestStr}`;
        });
    }

    showMetaModal() {
        if (!this.metaModal) return;
        this.metaModal.classList.remove('hidden');
        this._renderMetaModal();
        if (this.btnMetaClose) this.btnMetaClose.onclick = () => this.hideMetaModal();
    }

    hideMetaModal() {
        this.metaModal?.classList.add('hidden');
        this._refreshMetaSummary();
    }

    _renderMetaModal() {
        import('../systems/MetaProgress.js').then(({ metaProgress }) => {
            if (this.metaGoldAmount) this.metaGoldAmount.textContent = String(metaProgress.getGold());
            if (this.metaGrid) {
                this.metaGrid.innerHTML = '';
                const defs = metaProgress.unlockDefs();
                for (const def of defs) {
                    const purchased = metaProgress.isUnlocked(def.id);
                    const locked = def.requires && !metaProgress.isUnlocked(def.requires);
                    const canBuy = metaProgress.canPurchase(def.id);
                    const card = document.createElement('div');
                    card.className = 'meta-card';
                    if (purchased) card.classList.add('purchased');
                    if (locked) card.classList.add('locked');
                    card.innerHTML = `
                        <div class="meta-name">${def.name}</div>
                        <div class="meta-desc">${def.desc}${def.requires && !metaProgress.isUnlocked(def.requires) ? `<br><em>Requires: ${def.requires}</em>` : ''}</div>
                        <div class="meta-cost">${purchased ? 'OWNED' : `${def.cost} gold`}</div>
                        <button data-id="${def.id}" ${purchased || !canBuy ? 'disabled' : ''}>
                            ${purchased ? 'PURCHASED' : 'BUY'}
                        </button>
                    `;
                    const btn = card.querySelector('button');
                    btn?.addEventListener('click', () => {
                        if (metaProgress.purchase(def.id)) {
                            audio.uiClick?.();
                            this._renderMetaModal();
                        }
                    });
                    this.metaGrid.appendChild(card);
                }
            }
            if (this.metaAchGrid) {
                this.metaAchGrid.innerHTML = '';
                const defs = metaProgress.achievementDefs();
                for (const def of defs) {
                    const got = metaProgress.state.achievements[def.id];
                    const el = document.createElement('div');
                    el.className = 'meta-ach' + (got ? ' unlocked' : '');
                    el.innerHTML = `<span class="ach-glyph">${def.icon}</span><span>${got ? def.name : '???'}</span>`;
                    this.metaAchGrid.appendChild(el);
                }
            }
        });
    }

    hideMainMenu() {
        this.endNav();
        this.mainMenu?.classList.add('hidden');
    }

    /* -------- Character Select -------- */

    /*
     * portraits: { [characterId]: { src: dataUrl, width, height } }
     * Pre-rendered by MainMenuScene from the registered Phaser canvas
     * textures. We don't reach into Phaser's TextureManager from here.
     */
    showCharSelect(portraits, handlers) {
        this.hideMainMenu();
        if (!this.charSelect || !this.charGrid) return;
        this.charSelect.classList.remove('hidden');

        this.charGrid.innerHTML = '';
        this.selectedCharacterId = null;
        if (this.btnCharConfirm) this.btnCharConfirm.disabled = true;

        // Lazy-load metaProgress to keep this module dep-light. We
        // gate locked characters here at the UI layer rather than at
        // CHARACTER_ORDER so the unlock flag stays the single source
        // of truth.
        const isLocked = (c) => {
            if (!c.unlockId) return false;
            try {
                const mp = window.__metaProgress;
                return !mp?.isUnlocked(c.unlockId);
            } catch (e) { return false; }
        };
        // Make sure metaProgress is on the window so the sync check
        // works without await. Safe because everything in MetaProgress
        // is small + idempotent.
        if (!window.__metaProgress) {
            import('../systems/MetaProgress.js').then(m => { window.__metaProgress = m.metaProgress; });
        }

        for (const id of CHARACTER_ORDER) {
            const c = CHARACTERS[id];
            const card = document.createElement('div');
            card.className = 'char-card';
            card.dataset.id = id;
            if (isLocked(c)) {
                card.classList.add('locked');
            }

            const portraitBox = document.createElement('div');
            portraitBox.className = 'char-portrait-box';
            const portrait = document.createElement('img');
            portrait.className = 'char-portrait';
            portrait.alt = c.name;
            const data = portraits && portraits[id];
            if (data) {
                portrait.src = data.src;
                // Scale each portrait to a target visual height (~80px) so all
                // four cards weigh the same regardless of their underlying
                // sprite size. Width scales proportionally.
                const targetH = 80;
                const scale = Math.max(1, Math.round(targetH / data.height));
                portrait.style.width = (data.width * scale) + 'px';
                portrait.style.height = (data.height * scale) + 'px';
            } else {
                portrait.style.width = '64px';
                portrait.style.height = '80px';
            }
            portraitBox.appendChild(portrait);

            const stats = c.baseStats;
            const best = bestRuns.get(id);
            const hasRuns = best.runs > 0;
            const bestBlock = hasRuns
                ? `<div class="char-best">
                       <span class="char-best-label">Best Run</span>
                       <div class="char-best-row">
                           <span>Lv <strong>${best.level}</strong></span>
                           <span><strong>${formatDuration(best.timeMs)}</strong></span>
                           <span><strong>${best.kills}</strong> kills</span>
                       </div>
                       <span class="char-best-runs">${best.runs} run${best.runs === 1 ? '' : 's'}</span>
                   </div>`
                : `<div class="char-best char-best-empty">
                       <span class="char-best-label">No runs yet</span>
                   </div>`;
            card.innerHTML = `
                <h3 class="char-name">${c.name}</h3>
                <p class="char-title">${c.title}</p>
                <p class="char-weapon">\u2694 ${c.weaponName}</p>
                <p class="char-desc">${c.description}</p>
                <div class="char-stats">
                    <span class="char-stat">HP <strong>${stats.maxHp}</strong></span>
                    <span class="char-stat">SPD <strong>${stats.speed}</strong></span>
                    <span class="char-stat">MAG <strong>${stats.magnet}</strong></span>
                </div>
                ${bestBlock}
            `;
            card.insertBefore(portraitBox, card.firstChild);

            card.addEventListener('click', () => {
                if (isLocked(c)) return;
                this._selectCharacter(id);
            });
            card.addEventListener('dblclick', () => {
                if (isLocked(c)) return;
                this._selectCharacter(id);
                handlers.onConfirm && handlers.onConfirm(id, this._collectRunOpts());
            });
            this.charGrid.appendChild(card);
        }

        // Render curses checkboxes (each call rebuilds them so toggle
        // state is fresh per char-select visit).
        this._renderCurses();
        // Daily seed hint - show today's date
        if (this.dailyHint) {
            const today = new Date().toISOString().slice(0, 10);
            this.dailyHint.textContent = today;
        }

        if (this.btnCharBack) this.btnCharBack.onclick = () => handlers.onBack && handlers.onBack();
        if (this.btnCharConfirm) {
            this.btnCharConfirm.onclick = () => {
                if (this.selectedCharacterId) handlers.onConfirm && handlers.onConfirm(this.selectedCharacterId, this._collectRunOpts());
            };
        }

        /*
         * Gamepad nav across the four character cards: A both selects
         * (highlight) and confirms in one press, since there's no other
         * destructive option on this screen. B backs out to main menu.
         * The "begin run" button is reachable with keyboard/mouse but
         * the controller path skips that extra click.
         */
        const cardEls = Array.from(this.charGrid.querySelectorAll('.char-card'));
        if (cardEls.length > 0) {
            this.beginNav({
                items: cardEls,
                axis: 'horizontal',
                focusIdx: 0,
                onConfirm: idx => {
                    const id = cardEls[idx]?.dataset.id;
                    if (!id) return;
                    if (this.selectedCharacterId === id) {
                        handlers.onConfirm && handlers.onConfirm(id, this._collectRunOpts());
                    } else {
                        this._selectCharacter(id);
                    }
                },
                onCancel: () => handlers.onBack && handlers.onBack()
            });
        }
    }

    /*
     * Build the run-options object passed back to MainMenuScene when
     * the player confirms a character. Reads the daily checkbox + the
     * curses set we maintain.
     */
    _collectRunOpts() {
        const opts = { dailySeed: null, curses: [] };
        if (this.optDaily?.checked) {
            // Daily seed = YYYYMMDD as int, matched server-side / shared
            // across players who play on the same date.
            const d = new Date();
            opts.dailySeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
        }
        opts.curses = Array.from(this._activeCurses);
        return opts;
    }

    _renderCurses() {
        if (!this.curseOptions) return;
        // Lazy-load CURSES so HudOverlay doesn't statically import a
        // gameplay system module
        import('../systems/Curses.js').then(({ CURSES }) => {
            this.curseOptions.innerHTML = '';
            for (const c of CURSES) {
                const wrap = document.createElement('label');
                wrap.dataset.id = c.id;
                wrap.classList.toggle('checked', this._activeCurses.has(c.id));
                wrap.innerHTML = `
                    <input type="checkbox" ${this._activeCurses.has(c.id) ? 'checked' : ''} />
                    <span class="curse-name">${c.name}</span>
                    <span class="curse-bonus">+${Math.round(c.scoreBonus * 100)}%</span>
                `;
                wrap.title = c.desc;
                wrap.addEventListener('click', e => {
                    if (this._activeCurses.has(c.id)) this._activeCurses.delete(c.id);
                    else this._activeCurses.add(c.id);
                    wrap.classList.toggle('checked', this._activeCurses.has(c.id));
                    const cb = wrap.querySelector('input');
                    if (cb) cb.checked = this._activeCurses.has(c.id);
                    e.preventDefault();
                });
            }
        });
    }

    _selectCharacter(id) {
        this.selectedCharacterId = id;
        if (this.charGrid) {
            for (const c of this.charGrid.querySelectorAll('.char-card')) {
                c.classList.toggle('selected', c.dataset.id === id);
            }
        }
        if (this.btnCharConfirm) this.btnCharConfirm.disabled = false;
    }

    hideCharSelect() {
        this.endNav();
        this.charSelect?.classList.add('hidden');
    }

    /* -------- Settings -------- */

    _wireSettings() {
        if (this.diffControl) {
            this.diffControl.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const v = btn.dataset.value;
                    this.difficulty = v;
                    this.diffControl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
                    if (this.diffHint) this.diffHint.textContent = DIFFICULTY_HINTS[v];
                });
            });
        }

        if (this.gfxControl) {
            const initial = settings.graphicsMode;
            this.gfxControl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === initial));
            if (this.gfxHint) this.gfxHint.textContent = GRAPHICS_HINTS[initial];
            this.gfxControl.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const v = btn.dataset.value;
                    this.gfxControl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
                    if (this.gfxHint) this.gfxHint.textContent = GRAPHICS_HINTS[v] || '';
                    graphicsMode.set(v);
                });
            });
        }

        if (this.viewControl) {
            const initialView = settings.viewAngle;
            this.viewControl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === initialView));
            if (this.viewHint) this.viewHint.textContent = VIEW_HINTS[initialView];
            this.viewControl.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const v = btn.dataset.value;
                    this.viewControl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
                    if (this.viewHint) this.viewHint.textContent = VIEW_HINTS[v] || '';
                    viewAngle.set(v);
                });
            });
        }

        if (this.btnSettingsClose) this.btnSettingsClose.addEventListener('click', () => this.hideSettings());

        const wireToggle = (el, key) => {
            if (!el) return;
            el.checked = settings[key];
            el.addEventListener('change', () => settings.set(key, el.checked));
        };
        wireToggle(this.optShake, 'screenShake');
        wireToggle(this.optBlurPause, 'autoPauseOnBlur');
        wireToggle(this.optDmgNumbers, 'damageNumbers');

        const wireVolume = (slider, valueEl, key) => {
            if (!slider) return;
            const init = Math.round(settings[key] * 100);
            slider.value = init;
            if (valueEl) valueEl.textContent = `${init}%`;
            slider.addEventListener('input', () => {
                const pct = Math.max(0, Math.min(100, parseInt(slider.value, 10) || 0));
                const v = pct / 100;
                settings.set(key, v);
                if (valueEl) valueEl.textContent = `${pct}%`;
                audio.setVolumes();
            });
        };
        wireVolume(this.volMaster, this.volMasterValue, 'masterVolume');
        wireVolume(this.volMusic, this.volMusicValue, 'musicVolume');
        wireVolume(this.volSfx, this.volSfxValue, 'sfxVolume');
    }

    /* -------- Boss UI -------- */

    /*
     * Show the dramatic centered "A POWERFUL FOE APPROACHES" banner. Auto-
     * hides after `holdMs` (default 2.4s). Used by SpawnDirector when a
     * scheduled boss is about to spawn so the player gets a heads-up.
     */
    showBossBanner(name, holdMs = 2400) {
        if (!this.bossBanner) return;
        if (this.bossBannerName) this.bossBannerName.textContent = (name || 'BOSS').toUpperCase();
        this.bossBanner.classList.remove('hidden');
        if (this._bossBannerTimer) clearTimeout(this._bossBannerTimer);
        this._bossBannerTimer = setTimeout(() => this.hideBossBanner(), holdMs);
    }

    hideBossBanner() {
        if (this._bossBannerTimer) {
            clearTimeout(this._bossBannerTimer);
            this._bossBannerTimer = null;
        }
        if (this.bossBanner) this.bossBanner.classList.add('hidden');
    }

    /*
     * Persistent top-of-screen boss HP bar visible while at least one boss
     * is alive. SpawnDirector tracks the active boss(es) and feeds combined
     * hp/maxHp here every frame.
     */
    showBossHp(name) {
        if (!this.bossHp) return;
        if (this.bossHpName) this.bossHpName.textContent = (name || 'BOSS').toUpperCase();
        if (this.bossHpFill) this.bossHpFill.style.width = '100%';
        this.bossHp.classList.remove('hidden');
    }

    setBossHp(hp, maxHp) {
        if (!this.bossHpFill) return;
        const pct = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
        this.bossHpFill.style.width = `${pct * 100}%`;
    }

    hideBossHp() {
        if (this.bossHp) this.bossHp.classList.add('hidden');
    }

    /* -------- Low HP vignette -------- */

    /*
     * Drive the vignette intensity from HP fraction. Three discrete
     * tiers prevent the CSS animation from re-starting on every HP
     * delta - we only swap the data-intensity attribute when the
     * tier actually changes, which keeps the heartbeat pulse smooth.
     */
    updateLowHpVignette(hpFrac) {
        if (!this.lowHpVignette) return;
        let tier = null;
        if (hpFrac <= 0.10) tier = 'critical';
        else if (hpFrac <= 0.18) tier = 'mid';
        else if (hpFrac <= 0.25) tier = 'low';
        if (tier === this._lastVignetteTier) return;
        this._lastVignetteTier = tier;
        if (tier == null) {
            this.lowHpVignette.classList.add('hidden');
            this.lowHpVignette.removeAttribute('data-intensity');
        } else {
            this.lowHpVignette.classList.remove('hidden');
            this.lowHpVignette.setAttribute('data-intensity', tier);
        }
    }

    hideLowHpVignette() {
        if (!this.lowHpVignette) return;
        this.lowHpVignette.classList.add('hidden');
        this.lowHpVignette.removeAttribute('data-intensity');
        this._lastVignetteTier = null;
    }

    /* -------- Achievement toasts -------- */

    /*
     * Slide-in toast in the upper-right. We queue if one is already
     * showing so multiple unlocks in the same frame don't overlap.
     */
    showAchievement(name, icon = '\u2605') {
        if (!this.achievementToast) return;
        this._achQueue.push({ name, icon });
        if (!this._achShowing) this._pumpAchievementQueue();
    }

    _pumpAchievementQueue() {
        if (this._achQueue.length === 0) {
            this._achShowing = false;
            return;
        }
        this._achShowing = true;
        const next = this._achQueue.shift();
        if (this.achName) this.achName.textContent = next.name;
        if (this.achIcon) this.achIcon.textContent = next.icon || '\u2605';
        this.achievementToast.classList.remove('hidden');
        // Force a reflow so the transition fires
        void this.achievementToast.offsetWidth;
        this.achievementToast.classList.add('show');
        clearTimeout(this._achHideTimer);
        this._achHideTimer = setTimeout(() => {
            this.achievementToast.classList.remove('show');
            setTimeout(() => {
                this.achievementToast.classList.add('hidden');
                this._pumpAchievementQueue();
            }, 400);
        }, 2800);
    }

    /* -------- In-run stats panel (Tab key) -------- */

    showStatsPanel(rs, character) {
        if (!this.statsPanel || !this.statsRows) return;
        const fmtPct = v => `${Math.round(v * 100) / 100}`;
        const rows = [];
        rows.push(['Character', character?.name ?? '—']);
        rows.push(['HP', `${Math.round(rs.hp)} / ${rs.maxHp}`]);
        rows.push(['Speed', fmtPct(rs.speed)]);
        rows.push(['Magnet', fmtPct(rs.magnet)]);
        rows.push(['Armor', `${rs.armor}`]);
        rows.push(['Lifesteal', fmtPct((rs.lifestealPct || 0) * 100) + '%']);
        rows.push(['__sect__', 'PRIMARY WEAPON']);
        rows.push(['Damage', fmtPct(rs.weapon?.damage)]);
        rows.push(['Cooldown', `${Math.round(rs.weapon?.cooldownMs)}ms`]);
        if (rs.weapon?.arcRadius) rows.push(['Arc Radius', fmtPct(rs.weapon.arcRadius)]);
        if (rs.weapon?.count) rows.push(['Projectiles', rs.weapon.count]);
        if (rs.weapon?.pierce) rows.push(['Pierce', rs.weapon.pierce]);
        if (rs.aura?.unlocked) {
            rows.push(['__sect__', 'AURA']);
            rows.push(['Damage', fmtPct(rs.aura.damage)]);
            rows.push(['Radius', fmtPct(rs.aura.radius)]);
        }
        if (rs.daggers?.unlocked) {
            rows.push(['__sect__', 'PROJECTILE']);
            rows.push(['Damage', fmtPct(rs.daggers.damage)]);
            rows.push(['Count', rs.daggers.count || 1]);
        }
        const rowHtml = rows.map(([k, v]) => {
            if (k === '__sect__') return `<div class="section-title">${v}</div>`;
            return `<div class="row"><span class="label">${k}</span><span class="val">${v}</span></div>`;
        }).join('');
        this.statsRows.innerHTML = rowHtml;
        this.statsPanel.classList.remove('hidden');
    }

    hideStatsPanel() {
        if (this.statsPanel) this.statsPanel.classList.add('hidden');
    }

    /* -------- First-run tutorial -------- */

    showTutorial() {
        if (this.tutorialOverlay) this.tutorialOverlay.classList.remove('hidden');
    }
    hideTutorial() {
        if (this.tutorialOverlay) this.tutorialOverlay.classList.add('hidden');
    }

    /*
     * Settings is a true modal: while it's open, the underlying menu
     * (main menu or char select) is hidden so there's zero chance of
     * stacking-context bleed-through or click hijacking from a sibling
     * overlay. We track which screen was visible so hideSettings()
     * can restore exactly that one.
     *
     * Inline `style.zIndex` is also set as a belt-and-suspenders
     * measure in case a cached stylesheet doesn't have the latest
     * z-index rule for #settings-modal.
     */
    showSettings() {
        if (!this.settingsModal) return;

        this._underlyingScreen = null;
        if (this.mainMenu && !this.mainMenu.classList.contains('hidden')) {
            this._underlyingScreen = 'main';
            this.mainMenu.classList.add('hidden');
        } else if (this.charSelect && !this.charSelect.classList.contains('hidden')) {
            this._underlyingScreen = 'char';
            this.charSelect.classList.add('hidden');
        }

        this._navBeforeSettings = this._nav;
        this._nav = null;

        this.settingsModal.style.zIndex = '9999';
        this.settingsModal.classList.remove('hidden');

        this.beginNav({
            items: [this.btnSettingsClose].filter(Boolean),
            axis: 'vertical',
            onConfirm: () => this.hideSettings(),
            onCancel: () => this.hideSettings()
        });
    }

    hideSettings() {
        this.endNav();
        this.settingsModal?.classList.add('hidden');

        /* Restore whichever menu was underneath when settings opened. */
        if (this._underlyingScreen === 'main' && this.mainMenu) {
            this.mainMenu.classList.remove('hidden');
        } else if (this._underlyingScreen === 'char' && this.charSelect) {
            this.charSelect.classList.remove('hidden');
        }
        this._underlyingScreen = null;

        if (this._navBeforeSettings) {
            this._nav = this._navBeforeSettings;
            this._applyNavFocus();
            this._navBeforeSettings = null;
        }
    }

    getDifficulty() { return this.difficulty; }

    /*
     * Brief intro fanfare at the start of a run. Pure CSS animation - we
     * just toggle .show, the keyframes do the rest. The accent color comes
     * from each character's hex string.
     */
    showIntroCallout(character) {
        if (!this.introCallout) return;
        if (this.introName) this.introName.textContent = character.name.toUpperCase();
        if (this.introWeapon) this.introWeapon.textContent = character.weaponName;
        if (this.introEyebrow) this.introEyebrow.textContent = character.title.toUpperCase();
        const accent = character.accent || '#f5c54b';
        if (this.introName) {
            this.introName.style.color = accent;
            this.introName.style.textShadow = `0 0 22px ${accent}88, 0 0 6px rgba(0,0,0,0.9), 2px 2px 0 #000`;
        }

        // Restart animation cleanly: remove .show, force reflow, add .show
        this.introCallout.classList.remove('show', 'hidden');
        // eslint-disable-next-line no-unused-expressions
        void this.introCallout.offsetWidth;
        this.introCallout.classList.add('show');

        clearTimeout(this._introTimer);
        this._introTimer = setTimeout(() => {
            this.introCallout?.classList.remove('show');
            this.introCallout?.classList.add('hidden');
        }, 2500);
    }
}

export const hudOverlay = new HudOverlay();
