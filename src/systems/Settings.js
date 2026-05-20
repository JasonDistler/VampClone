/*
 * Global player-facing settings. Single source of truth for all gameplay
 * scenes to consult. Persisted to localStorage so a player's preferences
 * survive a refresh.
 */

const STORAGE_KEY = 'svls_settings';

const DEFAULTS = {
    screenShake: true,
    autoPauseOnBlur: true,
    damageNumbers: true,
    /*
     * 'pixel' = original blocky retro look (default).
     * 'hd'    = bilinear smoothing on the canvas + linear texture filtering
     *           on character/enemy sprites so they read as smoother art
     *           rather than a chunky 16x16 grid.
     */
    graphicsMode: 'pixel',
    /*
     * 'topdown' = camera looks straight down (the original view).
     * 'tilted'  = the world canvas gets a CSS perspective + rotateX so
     *             you see the floor receding into the distance — the
     *             classic "3/4" or oblique top-down look. Pure CSS
     *             transform; no gameplay or physics changes. HUD,
     *             menus, and modals stay flat for readability.
     */
    viewAngle: 'topdown',
    /*
     * Audio bus volumes, all 0..1. Master multiplies music & sfx; each
     * sub-bus also has its own slider in the settings modal so a player
     * can keep ambient music quiet while SFX punch through.
     */
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.7
};

function clamp01(v, fallback) {
    if (typeof v !== 'number' || Number.isNaN(v)) return fallback;
    return Math.max(0, Math.min(1, v));
}

function load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed };
    } catch (e) {
        return { ...DEFAULTS };
    }
}

function save(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        /* localStorage may be unavailable - silently ignore */
    }
}

export const settings = (() => {
    const state = load();
    return {
        get screenShake() { return state.screenShake; },
        get autoPauseOnBlur() { return state.autoPauseOnBlur; },
        get damageNumbers() { return state.damageNumbers; },
        get graphicsMode() { return state.graphicsMode === 'hd' ? 'hd' : 'pixel'; },
        get viewAngle()    { return state.viewAngle    === 'tilted' ? 'tilted' : 'topdown'; },
        get masterVolume() { return clamp01(state.masterVolume, 0.7); },
        get musicVolume() { return clamp01(state.musicVolume, 0.5); },
        get sfxVolume() { return clamp01(state.sfxVolume, 0.7); },
        set(key, value) {
            state[key] = value;
            save(state);
        },
        snapshot() { return { ...state }; }
    };
})();
