/*
 * Seedable PRNG for Crawler Mode.
 *
 * mulberry32 — 32-bit state, very fast, good enough for game-grade
 * randomness (encounter rolls, reward draws, map shape). Returns a
 * function that produces a float in [0, 1) on each call, just like
 * Math.random, so the rest of the engine can stay agnostic.
 *
 *   const rng = mulberry32(seedFromString('2026-05-24'));
 *   rng(); // 0.7634...
 *
 * The "Daily Crawler" mode uses today's UTC date as a string, hashed
 * to a 32-bit seed via xfnv1a so every player on a given day rolls the
 * same map / encounters / rewards.
 */

export function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/*
 * xfnv1a — short-hash a string to a 32-bit unsigned integer suitable
 * for seeding mulberry32. Cheap, deterministic, and avalanches well
 * enough for run-seed purposes.
 */
export function seedFromString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

/*
 * Build the canonical "today" daily-seed string in the player's local
 * date (YYYY-MM-DD). Local rather than UTC so a player in any timezone
 * gets a fresh daily on midnight wherever they are; the wiki/leaderboard
 * implication is fine for a personal project.
 */
export function todaySeedString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/*
 * Pick a random element from an array using the supplied rng. Returns
 * undefined for an empty array (caller's responsibility to gate).
 */
export function pickOne(arr, rng) {
    if (!arr || arr.length === 0) return undefined;
    return arr[Math.floor(rng() * arr.length)];
}

/*
 * Pick `n` distinct elements from an array (without replacement). If
 * `n` exceeds the array length, returns a shuffled copy of the whole
 * array.
 */
export function pickN(arr, n, rng) {
    const remaining = [...(arr || [])];
    const out = [];
    for (let i = 0; i < n && remaining.length > 0; i++) {
        const idx = Math.floor(rng() * remaining.length);
        out.push(remaining.splice(idx, 1)[0]);
    }
    return out;
}

/*
 * In-place Fisher-Yates shuffle. Returns the array for chaining.
 */
export function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
