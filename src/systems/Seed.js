/*
 * Seedable PRNG for daily-run determinism.
 *
 * mulberry32 is a tiny, well-distributed 32-bit PRNG that's exactly
 * the right tool for "I want runs on the same day to play the same".
 * We expose:
 *
 *   seededRandom.seed(x)   - reset the stream to a 32-bit integer seed
 *   seededRandom.next()    - 0..1 float (drop-in replacement for Math.random)
 *
 * The hot path inside SpawnDirector uses Math.random() in a few
 * places. Daily-run mode swaps the global Math.random pointer to the
 * seeded version when active, then restores it on scene shutdown. This
 * avoids touching every callsite while keeping non-daily runs using the
 * native, statistically-best PRNG.
 */
const seededRandom = {
    _state: 0x9E3779B9, // initial state - just a non-zero default
    _enabled: false,
    _origRandom: null,

    seed(s) {
        // Mix in a couple of rounds so close seeds (e.g. consecutive
        // daily seeds) don't produce visibly correlated streams.
        let x = (s >>> 0) || 1;
        x = Math.imul(x ^ (x >>> 16), 2246822507);
        x = Math.imul(x ^ (x >>> 13), 3266489909);
        x = (x ^ (x >>> 16)) >>> 0;
        this._state = x || 1;
    },

    next() {
        let t = (this._state += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    /*
     * Replace global Math.random with our seeded one. Returns a
     * disposer that restores the original. Daily-run mode invokes
     * install() on scene start and dispose() on scene shutdown.
     */
    install() {
        if (this._enabled) return () => {};
        this._origRandom = Math.random;
        Math.random = () => this.next();
        this._enabled = true;
        return () => this.dispose();
    },

    dispose() {
        if (!this._enabled) return;
        Math.random = this._origRandom;
        this._enabled = false;
        this._origRandom = null;
    }
};

/*
 * Daily seed = YYYYMMDD as a 32-bit integer. Uses local date so the
 * "today's daily" feels right to the player even though their friends
 * across timezones are technically running a different stream.
 */
export function todaysDailySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export function dailySeedString() {
    return String(todaysDailySeed());
}

export { seededRandom };
