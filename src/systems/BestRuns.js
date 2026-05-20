/*
 * Per-character best-run tracking. Each character keeps their own personal
 * bests for level reached, longest survival time (ms), and most kills in a
 * single run. Persisted to localStorage so the character-select screen can
 * show progression across sessions.
 */

const STORAGE_KEY = 'svls_best_runs';

function loadAll() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}

function saveAll(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        /* localStorage unavailable - silently ignore */
    }
}

function emptyRecord() {
    return { level: 0, timeMs: 0, kills: 0, runs: 0 };
}

export const bestRuns = (() => {
    const state = loadAll();
    return {
        /*
         * Returns the best record for the given character id. Always
         * returns an object (zeroed out if the character has no runs yet)
         * so callers don't need to null-check.
         */
        get(characterId) {
            return { ...emptyRecord(), ...(state[characterId] || {}) };
        },

        /*
         * Submit a run's results. Each metric is tracked independently so
         * a long survival run and a high-kill run both count - we never
         * overwrite a higher value with a lower one. Increments the runs
         * counter and persists.
         *
         * Returns an object describing which fields were newly set, useful
         * for showing "NEW BEST!" callouts on the game-over screen.
         */
        record(characterId, { level = 0, timeMs = 0, kills = 0 } = {}) {
            const prev = state[characterId] || emptyRecord();
            const next = {
                level: Math.max(prev.level || 0, level),
                timeMs: Math.max(prev.timeMs || 0, timeMs),
                kills: Math.max(prev.kills || 0, kills),
                runs: (prev.runs || 0) + 1
            };
            const records = {
                level: next.level > (prev.level || 0),
                timeMs: next.timeMs > (prev.timeMs || 0),
                kills: next.kills > (prev.kills || 0),
                isFirstRun: !prev.runs
            };
            state[characterId] = next;
            saveAll(state);
            return { record: next, newBests: records };
        },

        /*
         * Reset every character's bests. Currently unused by UI but kept
         * exposed so a future settings option can clear progress.
         */
        clear() {
            for (const k of Object.keys(state)) delete state[k];
            saveAll(state);
        }
    };
})();

/*
 * Format a duration in ms as M:SS, used by the character select cards
 * and the game-over screen.
 */
export function formatDuration(ms) {
    if (!ms || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
