import { settings } from './Settings.js';

/*
 * Procedural WebAudio system. No audio assets are loaded - every sound
 * effect and every note in the biome music loops is synthesized in real
 * time from oscillators and noise bursts. Matches the project's
 * "everything is generated at runtime" philosophy that the pixel art
 * already follows.
 *
 * Two output buses sit under a master gain so the player can balance:
 *   master -> destination
 *   music  -> master
 *   sfx    -> master
 *
 * Browser autoplay policy: an AudioContext created before any user
 * gesture is suspended. We attach one-shot listeners (pointerdown,
 * keydown) that lazily create-and-resume the context on first input,
 * which is also when MainMenuScene shows up so menu music kicks in
 * the moment the player first interacts with the page.
 */
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.musicBus = null;
        this.sfxBus = null;

        this._musicTimer = null;
        this._currentMusic = null;
        this._unlocked = false;
    }

    /*
     * Wire up first-touch listeners. Safe to call multiple times - we
     * only attach once and the listeners self-remove on first fire.
     */
    install() {
        if (this._installed) return;
        this._installed = true;
        const unlock = () => this.ensureContext();
        document.addEventListener('pointerdown', unlock, { once: true });
        document.addEventListener('keydown', unlock, { once: true });
        document.addEventListener('touchstart', unlock, { once: true });
    }

    ensureContext() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                /* resume() returns a Promise, but we don't care about
                 * the await - subsequent scheduled notes will simply be
                 * silent until the resume settles, which is typically
                 * within one frame of the user gesture. */
                try { this.ctx.resume(); } catch (e) { /* ignore */ }
            }
            return this.ctx;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        try {
            this.ctx = new Ctx();
        } catch (e) {
            /* Some browsers throw if a context is created before any
             * user gesture. We'll get another shot the next time a
             * tool calls ensureContext() (post-input). */
            return null;
        }
        this.master = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.gain.value = settings.masterVolume;
        this.musicBus.gain.value = settings.musicVolume;
        this.sfxBus.gain.value = settings.sfxVolume;
        this._unlocked = true;
        return this.ctx;
    }

    setVolumes() {
        if (!this.ctx) return;
        this.master.gain.value = settings.masterVolume;
        this.musicBus.gain.value = settings.musicVolume;
        this.sfxBus.gain.value = settings.sfxVolume;
    }

    /* -----------------------------------------------------------------
     * SFX primitives
     * ----------------------------------------------------------------- */

    /*
     * Schedules a tone with an attack-decay envelope on the SFX bus.
     * `bend` is a frequency multiplier ramped to over the note's life,
     * useful for "blip"-style downward chirps on enemy hits.
     */
    note(freq, dur, opts = {}) {
        const ctx = this.ensureContext();
        if (!ctx || settings.sfxVolume <= 0) return;
        const t = ctx.currentTime + (opts.delay || 0);
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = opts.type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (opts.bend !== undefined) {
            osc.frequency.linearRampToValueAtTime(freq * opts.bend, t + dur);
        }
        const peak = opts.vol ?? 0.25;
        const attack = opts.attack ?? 0.005;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(this.sfxBus);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    /*
     * White-noise burst with optional band-pass filter. Used for swings,
     * heavy thuds, and the boss warning rumble.
     */
    noise(dur, opts = {}) {
        const ctx = this.ensureContext();
        if (!ctx || settings.sfxVolume <= 0) return;
        const t = ctx.currentTime + (opts.delay || 0);
        const samples = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
        const data = buf.getChannelData(0);
        const decay = opts.decay ?? 4;
        for (let i = 0; i < samples; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / samples) * decay);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = opts.vol ?? 0.35;
        if (opts.filter) {
            const f = ctx.createBiquadFilter();
            f.type = opts.filter;
            f.frequency.value = opts.freq ?? 1000;
            f.Q.value = opts.Q ?? 1;
            src.connect(f).connect(g).connect(this.sfxBus);
        } else {
            src.connect(g).connect(this.sfxBus);
        }
        src.start(t);
        src.stop(t + dur);
    }

    /* -----------------------------------------------------------------
     * SFX presets - call these from gameplay code
     * ----------------------------------------------------------------- */

    swordSwing() {
        this.noise(0.18, { filter: 'highpass', freq: 700, vol: 0.18, decay: 6 });
        this.note(420, 0.14, { type: 'sawtooth', vol: 0.08, bend: 2.0 });
    }

    /*
     * Hit and death effects can fire dozens of times per frame during
     * AOE swings, so we throttle them to at most one per ~25ms to keep
     * the mix from clipping into a wall of noise.
     */
    enemyHit() {
        const now = performance.now();
        if (now - (this._lastHitSfx || 0) < 25) return;
        this._lastHitSfx = now;
        this.note(220, 0.07, { type: 'square', vol: 0.16, bend: 0.4 });
    }

    enemyDeath() {
        const now = performance.now();
        if (now - (this._lastDeathSfx || 0) < 35) return;
        this._lastDeathSfx = now;
        this.noise(0.18, { filter: 'lowpass', freq: 600, vol: 0.18, decay: 5 });
    }

    gemPickup() {
        const now = performance.now();
        if (now - (this._lastGemSfx || 0) < 50) return;
        this._lastGemSfx = now;
        this.note(660, 0.07, { type: 'triangle', vol: 0.18 });
        this.note(990, 0.09, { type: 'triangle', vol: 0.16, delay: 0.05 });
    }

    levelUp() {
        const notes = [392.0, 523.25, 659.25, 783.99]; // G4 C5 E5 G5 - bright fanfare
        notes.forEach((f, i) => this.note(f, 0.18, { type: 'sawtooth', vol: 0.18, delay: i * 0.07 }));
    }

    heartPickup() {
        this.note(440, 0.10, { type: 'sine', vol: 0.22 });
        this.note(660, 0.16, { type: 'sine', vol: 0.20, delay: 0.07 });
    }

    playerHit() {
        this.noise(0.22, { filter: 'lowpass', freq: 350, vol: 0.45, decay: 3 });
        this.note(120, 0.14, { type: 'sawtooth', vol: 0.18, bend: 0.6 });
    }

    death() {
        const notes = [261.63, 246.94, 233.08, 220.00]; // descending semitones
        notes.forEach((f, i) => this.note(f, 0.45, { type: 'sawtooth', vol: 0.28, bend: 0.85, delay: i * 0.18 }));
    }

    bossWarning() {
        this.noise(0.5, { filter: 'lowpass', freq: 220, vol: 0.5, decay: 1.5 });
        this.note(55, 0.6, { type: 'sawtooth', vol: 0.18, delay: 0.25 });
    }

    bossDeath() {
        // Triumphant descending chord - V to i resolution
        const chord1 = [392.0, 493.88, 587.33];   // G B D
        const chord2 = [261.63, 329.63, 392.0];   // C E G
        chord1.forEach((f) => this.note(f, 0.4, { type: 'sawtooth', vol: 0.16 }));
        chord2.forEach((f) => this.note(f, 0.6, { type: 'sawtooth', vol: 0.18, delay: 0.35 }));
    }

    uiClick() {
        this.note(900, 0.05, { type: 'square', vol: 0.10, bend: 1.2 });
    }

    /* -----------------------------------------------------------------
     * Crawler Mode SFX
     *
     * Tuned to match the survivor-mode presets above (same vol scale,
     * same throttling pattern where appropriate). All routed through
     * the shared sfxGain bus so the global sfx slider controls them.
     * ----------------------------------------------------------------- */

    crawlerCardPlay() {
        this.noise(0.08, { filter: 'highpass', freq: 1800, vol: 0.10, decay: 8 });
        this.note(720, 0.06, { type: 'triangle', vol: 0.10, bend: 1.1 });
    }

    crawlerCardDraw() {
        this.noise(0.05, { filter: 'highpass', freq: 1400, vol: 0.06, decay: 12 });
    }

    crawlerAttackHit() {
        const now = performance.now();
        if (now - (this._lastCrawlerHit || 0) < 25) return;
        this._lastCrawlerHit = now;
        this.noise(0.10, { filter: 'highpass', freq: 900, vol: 0.16, decay: 8 });
        this.note(180, 0.10, { type: 'sawtooth', vol: 0.16, bend: 0.5 });
    }

    crawlerEnemyAttack() {
        const now = performance.now();
        if (now - (this._lastCrawlerEnemyHit || 0) < 40) return;
        this._lastCrawlerEnemyHit = now;
        this.noise(0.18, { filter: 'lowpass', freq: 320, vol: 0.30, decay: 4 });
        this.note(110, 0.10, { type: 'sawtooth', vol: 0.16, bend: 0.5 });
    }

    crawlerBlockGain() {
        this.note(660, 0.07, { type: 'square', vol: 0.10, bend: 0.9 });
        this.note(990, 0.10, { type: 'square', vol: 0.08, delay: 0.04, bend: 0.6 });
    }

    crawlerVulnApply() {
        this.note(140, 0.18, { type: 'sawtooth', vol: 0.14, bend: 0.55 });
        this.note(180, 0.14, { type: 'sine',     vol: 0.10, delay: 0.06 });
    }

    crawlerEnergyRefill() {
        this.note(880, 0.08, { type: 'triangle', vol: 0.10 });
        this.note(1320, 0.10, { type: 'triangle', vol: 0.10, delay: 0.05 });
    }

    crawlerCombatWin() {
        // Short uplift: I-V-I quick chord
        this.note(523.25, 0.16, { type: 'triangle', vol: 0.16 });
        this.note(659.25, 0.18, { type: 'triangle', vol: 0.16, delay: 0.07 });
        this.note(783.99, 0.22, { type: 'triangle', vol: 0.18, delay: 0.14 });
    }

    crawlerRunVictory() {
        // Big fanfare: quintuple ascending then sustained chord
        const rise = [392.0, 523.25, 659.25, 783.99, 987.77];
        rise.forEach((f, i) => this.note(f, 0.20, { type: 'sawtooth', vol: 0.20, delay: i * 0.10 }));
        // Sustained C-E-G chord on top
        const chord = [523.25, 659.25, 783.99];
        chord.forEach((f) => this.note(f, 0.55, { type: 'triangle', vol: 0.20, delay: 0.55 }));
    }

    crawlerRunDefeat() {
        // Slower, lower descending tones than survivor-mode death
        const notes = [220.00, 207.65, 196.00, 184.99];
        notes.forEach((f, i) => this.note(f, 0.45, { type: 'sawtooth', vol: 0.24, bend: 0.85, delay: i * 0.20 }));
        this.noise(0.5, { filter: 'lowpass', freq: 240, vol: 0.30, decay: 2, delay: 0.3 });
    }

    crawlerMapReveal() {
        // Soft ascending arpeggio when the map is revealed
        const notes = [440.0, 554.37, 659.25, 880.0];
        notes.forEach((f, i) => this.note(f, 0.18, { type: 'triangle', vol: 0.12, delay: i * 0.06 }));
    }

    crawlerNodeSelect() {
        // Slightly warmer than uiClick for the bigger commit-to-a-node moment
        this.note(700, 0.06, { type: 'square', vol: 0.10, bend: 1.1 });
        this.note(1050, 0.07, { type: 'triangle', vol: 0.08, delay: 0.04 });
    }

    crawlerEliteRoar() {
        // Low rumble + growl
        this.noise(0.55, { filter: 'lowpass', freq: 180, vol: 0.40, decay: 1.6 });
        this.note(70,  0.50, { type: 'sawtooth', vol: 0.20, bend: 0.6 });
        this.note(95,  0.40, { type: 'sawtooth', vol: 0.16, delay: 0.10 });
    }

    crawlerBossEntry() {
        // Deep horn: re-uses bossWarning's vibe but harmonized
        this.noise(0.6, { filter: 'lowpass', freq: 220, vol: 0.5, decay: 1.5 });
        this.note(55,  0.7, { type: 'sawtooth', vol: 0.20, delay: 0.20 });
        this.note(82.4, 0.5, { type: 'sawtooth', vol: 0.16, delay: 0.40 });
    }

    crawlerRestHeal() {
        // Warm bell + breath
        this.note(523.25, 0.30, { type: 'triangle', vol: 0.18 });
        this.note(659.25, 0.40, { type: 'triangle', vol: 0.16, delay: 0.10 });
        this.noise(0.30, { filter: 'lowpass', freq: 800, vol: 0.06, decay: 4, delay: 0.05 });
    }

    crawlerCardUpgrade() {
        // Bright sparkle
        this.note(880,  0.10, { type: 'triangle', vol: 0.16 });
        this.note(1175, 0.12, { type: 'triangle', vol: 0.14, delay: 0.06 });
        this.note(1480, 0.18, { type: 'triangle', vol: 0.14, delay: 0.12 });
        this.noise(0.18, { filter: 'highpass', freq: 4000, vol: 0.06, decay: 8, delay: 0.04 });
    }

    crawlerRelicGet() {
        // Pickup with bell tail
        this.note(440, 0.10, { type: 'triangle', vol: 0.18 });
        this.note(660, 0.16, { type: 'triangle', vol: 0.18, delay: 0.05 });
        this.note(880, 0.30, { type: 'sine',     vol: 0.12, delay: 0.12 });
    }

    /* -----------------------------------------------------------------
     * Music looper
     *
     * Uses a "look-ahead scheduler" pattern: every 60ms we look at the
     * next ~250ms of audio time and queue any pattern events that fall
     * inside it. The scheduler self-loops a pattern by wrapping the
     * step pointer at pattern.steps.
     * ----------------------------------------------------------------- */

    playMusic(name) {
        const pattern = MUSIC_PATTERNS[name];
        if (!pattern) {
            this.stopMusic();
            return;
        }
        if (this._currentMusic === name && this._musicTimer) return;
        this.stopMusic();
        this._currentMusic = name;

        const ctx = this.ensureContext();
        if (!ctx) return;

        const stepDur = 60 / pattern.tempo / 4; // 16th note in seconds
        const steps = pattern.steps;
        let nextStep = 0;
        let nextStepTime = ctx.currentTime + 0.1;
        const lookahead = 0.28;

        const tick = () => {
            if (this._currentMusic !== name) return;
            while (nextStepTime < ctx.currentTime + lookahead) {
                for (const ev of pattern.events) {
                    if (ev.step === nextStep) this._scheduleMusicEvent(ev, nextStepTime);
                }
                nextStepTime += stepDur;
                nextStep = (nextStep + 1) % steps;
            }
        };

        tick();
        this._musicTimer = setInterval(tick, 60);
    }

    stopMusic() {
        if (this._musicTimer) {
            clearInterval(this._musicTimer);
            this._musicTimer = null;
        }
        this._currentMusic = null;
    }

    _scheduleMusicEvent(ev, t) {
        const ctx = this.ctx;
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = ev.type || 'triangle';
        osc.frequency.value = ev.freq;
        const dur = ev.dur || 0.18;
        const vol = ev.vol ?? 0.10;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g).connect(this.musicBus);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }
}

/* ---------------------------------------------------------------------
 * Music patterns
 *
 * Each pattern is a 32-step (two-bar) loop at the given tempo. Steps
 * are 16th notes. Events are { step, freq, dur, vol, type }.
 *
 * Sticking to minor-mode chord progressions keeps a consistent
 * dungeon-crawl mood. All three biomes use the same instrument palette
 * (triangle bass + sine pad) for tonal cohesion when biomes change.
 * --------------------------------------------------------------------- */

const NOTE = {
    E2: 82.41, G2: 98.00, A2: 110.00, B2: 123.47, C3: 130.81, D3: 146.83,
    E3: 164.81, G3: 196.00, A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66,
    E4: 329.63, G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33,
    E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
    F2: 87.31, F3: 174.61, F4: 349.23, Bb1: 58.27, Bb2: 116.54, Bb3: 233.08,
    Bb4: 466.16, A1: 55.00
};

const MUSIC_PATTERNS = {
    /*
     * Forest: Em - Am - C - G progression.
     * Mellow / mysterious. Bass plays whole-bar root, lead arpeggiates
     * the chord on every other 16th.
     */
    forest: {
        tempo: 92,
        steps: 32,
        events: [
            // Bass (root every 8 steps)
            { step: 0,  freq: NOTE.E2,  dur: 1.6, type: 'triangle', vol: 0.12 },
            { step: 8,  freq: NOTE.A2,  dur: 1.6, type: 'triangle', vol: 0.12 },
            { step: 16, freq: NOTE.C3,  dur: 1.6, type: 'triangle', vol: 0.12 },
            { step: 24, freq: NOTE.G2,  dur: 1.6, type: 'triangle', vol: 0.12 },
            // Em arpeggio (steps 0-7)
            { step: 0,  freq: NOTE.E4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 2,  freq: NOTE.G4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 4,  freq: NOTE.B4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 6,  freq: NOTE.E5, dur: 0.30, type: 'sine', vol: 0.08 },
            // Am arpeggio (steps 8-15)
            { step: 8,  freq: NOTE.A3, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 10, freq: NOTE.C4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 12, freq: NOTE.E4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 14, freq: NOTE.A4, dur: 0.30, type: 'sine', vol: 0.08 },
            // C arpeggio (steps 16-23)
            { step: 16, freq: NOTE.C4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 18, freq: NOTE.E4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 20, freq: NOTE.G4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 22, freq: NOTE.C5, dur: 0.30, type: 'sine', vol: 0.08 },
            // G arpeggio (steps 24-31)
            { step: 24, freq: NOTE.G3, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 26, freq: NOTE.B3, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 28, freq: NOTE.D4, dur: 0.18, type: 'sine', vol: 0.08 },
            { step: 30, freq: NOTE.G4, dur: 0.30, type: 'sine', vol: 0.08 }
        ]
    },

    /*
     * Swamp: drone-heavy, slow, dissonant. A1 pedal tone with sparse
     * minor-mode bell hits.
     */
    swamp: {
        tempo: 70,
        steps: 32,
        events: [
            // Drone every 4 steps so it doesn't decay to silence
            { step: 0,  freq: NOTE.A1,  dur: 1.0, type: 'sawtooth', vol: 0.10 },
            { step: 4,  freq: NOTE.A1,  dur: 1.0, type: 'sawtooth', vol: 0.10 },
            { step: 8,  freq: NOTE.A1,  dur: 1.0, type: 'sawtooth', vol: 0.10 },
            { step: 12, freq: NOTE.A1,  dur: 1.0, type: 'sawtooth', vol: 0.10 },
            { step: 16, freq: NOTE.E2,  dur: 1.0, type: 'sawtooth', vol: 0.10 },
            { step: 20, freq: NOTE.E2,  dur: 1.0, type: 'sawtooth', vol: 0.10 },
            { step: 24, freq: NOTE.A1,  dur: 1.0, type: 'sawtooth', vol: 0.10 },
            { step: 28, freq: NOTE.A1,  dur: 1.0, type: 'sawtooth', vol: 0.10 },
            // Sparse high bell hits
            { step: 0,  freq: NOTE.A4,  dur: 0.6, type: 'triangle', vol: 0.07 },
            { step: 12, freq: NOTE.C5,  dur: 0.6, type: 'triangle', vol: 0.07 },
            { step: 20, freq: NOTE.E5,  dur: 0.6, type: 'triangle', vol: 0.07 },
            { step: 28, freq: NOTE.D5,  dur: 0.6, type: 'triangle', vol: 0.07 }
        ]
    },

    /*
     * Library / castle: regal, march-like. Dm - Bb - F - C, with a
     * marching quarter-pulse bass and a descending lead phrase.
     */
    library: {
        tempo: 108,
        steps: 32,
        events: [
            // Marching bass (quarter notes - every 4 steps)
            { step: 0,  freq: NOTE.D3,  dur: 0.30, type: 'sawtooth', vol: 0.13 },
            { step: 4,  freq: NOTE.D3,  dur: 0.30, type: 'sawtooth', vol: 0.13 },
            { step: 8,  freq: NOTE.Bb2, dur: 0.30, type: 'sawtooth', vol: 0.13 },
            { step: 12, freq: NOTE.Bb2, dur: 0.30, type: 'sawtooth', vol: 0.13 },
            { step: 16, freq: NOTE.F2,  dur: 0.30, type: 'sawtooth', vol: 0.13 },
            { step: 20, freq: NOTE.F2,  dur: 0.30, type: 'sawtooth', vol: 0.13 },
            { step: 24, freq: NOTE.C3,  dur: 0.30, type: 'sawtooth', vol: 0.13 },
            { step: 28, freq: NOTE.C3,  dur: 0.30, type: 'sawtooth', vol: 0.13 },
            // Descending lead phrase
            { step: 0,  freq: NOTE.D5,  dur: 0.22, type: 'triangle', vol: 0.09 },
            { step: 3,  freq: NOTE.C5,  dur: 0.22, type: 'triangle', vol: 0.09 },
            { step: 6,  freq: NOTE.A4,  dur: 0.22, type: 'triangle', vol: 0.09 },
            { step: 8,  freq: NOTE.Bb4, dur: 0.30, type: 'triangle', vol: 0.09 },
            { step: 12, freq: NOTE.A4,  dur: 0.22, type: 'triangle', vol: 0.09 },
            { step: 16, freq: NOTE.F4,  dur: 0.22, type: 'triangle', vol: 0.09 },
            { step: 19, freq: NOTE.A4,  dur: 0.22, type: 'triangle', vol: 0.09 },
            { step: 22, freq: NOTE.C5,  dur: 0.30, type: 'triangle', vol: 0.09 },
            { step: 24, freq: NOTE.D5,  dur: 0.22, type: 'triangle', vol: 0.09 },
            { step: 28, freq: NOTE.A4,  dur: 0.30, type: 'triangle', vol: 0.09 }
        ]
    },

    /*
     * Menu / out-of-game theme. Slow, contemplative E minor.
     */
    menu: {
        tempo: 80,
        steps: 32,
        events: [
            { step: 0,  freq: NOTE.E2, dur: 1.8, type: 'triangle', vol: 0.10 },
            { step: 16, freq: NOTE.A2, dur: 1.8, type: 'triangle', vol: 0.10 },
            { step: 0,  freq: NOTE.B3, dur: 0.8, type: 'sine', vol: 0.08 },
            { step: 8,  freq: NOTE.G4, dur: 0.5, type: 'sine', vol: 0.08 },
            { step: 16, freq: NOTE.A4, dur: 0.8, type: 'sine', vol: 0.08 },
            { step: 24, freq: NOTE.E4, dur: 0.5, type: 'sine', vol: 0.08 }
        ]
    },

    /*
     * Boss music - faster, more intense. Variant on E minor with a
     * driving bass pulse on every beat.
     */
    boss: {
        tempo: 130,
        steps: 32,
        events: [
            // Pulsing bass on every beat (every 4 steps)
            { step: 0,  freq: NOTE.E2, dur: 0.20, type: 'sawtooth', vol: 0.16 },
            { step: 4,  freq: NOTE.E2, dur: 0.20, type: 'sawtooth', vol: 0.16 },
            { step: 8,  freq: NOTE.E2, dur: 0.20, type: 'sawtooth', vol: 0.16 },
            { step: 12, freq: NOTE.E2, dur: 0.20, type: 'sawtooth', vol: 0.16 },
            { step: 16, freq: NOTE.G2, dur: 0.20, type: 'sawtooth', vol: 0.16 },
            { step: 20, freq: NOTE.G2, dur: 0.20, type: 'sawtooth', vol: 0.16 },
            { step: 24, freq: NOTE.A2, dur: 0.20, type: 'sawtooth', vol: 0.16 },
            { step: 28, freq: NOTE.B2, dur: 0.20, type: 'sawtooth', vol: 0.16 },
            // Ominous high lead
            { step: 0,  freq: NOTE.B4, dur: 0.4, type: 'square', vol: 0.06 },
            { step: 4,  freq: NOTE.E5, dur: 0.4, type: 'square', vol: 0.06 },
            { step: 12, freq: NOTE.G5, dur: 0.4, type: 'square', vol: 0.06 },
            { step: 16, freq: NOTE.F5, dur: 0.4, type: 'square', vol: 0.06 },
            { step: 24, freq: NOTE.E5, dur: 0.4, type: 'square', vol: 0.06 }
        ]
    }
};

export const audio = new AudioSystem();
