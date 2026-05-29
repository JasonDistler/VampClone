/*
 * Map generator + state for Crawler Mode.
 *
 * A floor is a small directed acyclic graph laid out left-to-right in
 * COLUMNS. The leftmost column is the start (always a fight), the
 * rightmost column is the boss, and the middle columns mix node kinds.
 * Edges only go forward (col c → col c+1) and only between nearby
 * rows so the resulting graph is tractable to render and read.
 *
 * Node kinds:
 *   'fight'   — normal combat, single enemy from the floor's pool
 *   'pack'    — combat with a 2-enemy pack (multi-enemy encounter)
 *   'elite'   — combat with an elite enemy, guaranteed relic drop
 *   'rest'    — heal 30% OR upgrade a card
 *   'reward'  — free card pick (no combat)
 *   'boss'    — final fight of the floor
 *
 * The graph is generated once per floor when the player first enters
 * the floor, then walked by clicking forward-edge nodes. Visited and
 * available state is tracked on the map object directly so the UI can
 * render dimming / highlighting purely from data.
 */

import { pickOne, shuffle } from './Rng.js';

/*
 * Per-floor map shape config. Tuning targets:
 *   floor 1 — short and forgiving (~6 nodes)
 *   floor 2 — medium length, more elites (~8 nodes)
 *   floor 3 — long, dense, choice-heavy (~10 nodes)
 */
const FLOOR_LAYOUTS = {
    1: { columns: 5, rowsPerColumn: [1, 2, 3, 2, 1] },
    2: { columns: 6, rowsPerColumn: [1, 2, 3, 3, 2, 1] },
    3: { columns: 7, rowsPerColumn: [1, 3, 3, 3, 3, 2, 1] }
};

/*
 * Distribution of node kinds in middle columns. The first column is
 * always a single 'fight' and the last column is always a single
 * 'boss', so this only governs the in-between.
 */
const MIDDLE_KIND_WEIGHTS = {
    fight:  6,
    pack:   2,
    elite:  1,
    rest:   2,
    reward: 1,
    shop:   1
};

export class CrawlerMap {
    constructor(floor, rng) {
        this.floor = floor;
        this.rng = rng;
        this.nodes = {};         /* id → node */
        this.startNodeId = null;
        this.bossNodeId = null;
        this.currentNodeId = null;
        this.visitedNodeIds = new Set();
        this._build();
    }

    /* ---------- public API ---------- */

    getNode(id) { return this.nodes[id] || null; }

    getCurrentNode() { return this.currentNodeId ? this.nodes[this.currentNodeId] : null; }

    /*
     * The set of nodes the player can currently click. If they haven't
     * entered the map yet, only the start node is available. Otherwise
     * it's the forward-edge children of the most-recently-visited node.
     */
    getAvailableNodeIds() {
        if (!this.currentNodeId) return [this.startNodeId];
        const cur = this.nodes[this.currentNodeId];
        if (!cur) return [];
        return cur.edges.slice();
    }

    /*
     * Mark a node as visited and set it as the current node. Returns
     * the node so the engine can dispatch on its kind.
     */
    enterNode(nodeId) {
        const node = this.nodes[nodeId];
        if (!node) return null;
        this.currentNodeId = nodeId;
        this.visitedNodeIds.add(nodeId);
        return node;
    }

    isCleared() { return this.currentNodeId === this.bossNodeId && this.visitedNodeIds.has(this.bossNodeId); }

    isAvailable(nodeId) {
        return this.getAvailableNodeIds().indexOf(nodeId) !== -1;
    }

    /* ---------- generation ---------- */

    _build() {
        const layout = FLOOR_LAYOUTS[this.floor] || FLOOR_LAYOUTS[1];
        const cols = layout.columns;
        const rowCounts = layout.rowsPerColumn;

        /* Step 1: spawn nodes column-by-column. */
        const grid = []; /* grid[col] = [nodeId, nodeId, ...] */
        for (let c = 0; c < cols; c++) {
            const rowCount = rowCounts[c];
            const rowIds = [];
            for (let r = 0; r < rowCount; r++) {
                const id = `f${this.floor}-c${c}-r${r}`;
                this.nodes[id] = {
                    id,
                    floor: this.floor,
                    col: c,
                    row: r,
                    rowCount,
                    kind: this._pickKindForColumn(c, cols),
                    edges: [],
                    /* lazily set when player enters the node */
                    payload: null
                };
                rowIds.push(id);
            }
            grid.push(rowIds);
        }

        this.startNodeId = grid[0][0];
        this.bossNodeId = grid[cols - 1][0];

        /* Step 2: connect forward edges. Each node connects to one or
         * two of the nearest rows in the next column so the graph
         * always has a forward path. We bias connections toward the
         * closest row to keep paths visually clean. */
        for (let c = 0; c < cols - 1; c++) {
            const here = grid[c];
            const next = grid[c + 1];
            for (const fromId of here) {
                const fromNode = this.nodes[fromId];
                const candidates = this._chooseNextNeighbors(fromNode, next);
                fromNode.edges.push(...candidates);
            }
            /* Guarantee every node in `next` has at least one incoming
             * edge — pick a random source from `here` if none. */
            for (const toId of next) {
                const incoming = here.some((fromId) => this.nodes[fromId].edges.includes(toId));
                if (!incoming) {
                    const fromId = pickOne(here, this.rng);
                    if (fromId && !this.nodes[fromId].edges.includes(toId)) {
                        this.nodes[fromId].edges.push(toId);
                    }
                }
            }
        }

        /* Step 3: dedupe edges in case any node ended up with the same
         * neighbor twice (rare but possible from the guarantee step). */
        for (const id of Object.keys(this.nodes)) {
            this.nodes[id].edges = Array.from(new Set(this.nodes[id].edges));
        }
    }

    _pickKindForColumn(col, totalCols) {
        if (col === 0) return 'fight';
        if (col === totalCols - 1) return 'boss';
        if (col === totalCols - 2) {
            /* Penultimate column biases toward rest so the player can
             * patch up before the boss. */
            return this.rng() < 0.55 ? 'rest' : this._weightedKind();
        }
        return this._weightedKind();
    }

    _weightedKind() {
        const total = Object.values(MIDDLE_KIND_WEIGHTS).reduce((a, b) => a + b, 0);
        let r = this.rng() * total;
        for (const [kind, weight] of Object.entries(MIDDLE_KIND_WEIGHTS)) {
            r -= weight;
            if (r <= 0) return kind;
        }
        return 'fight';
    }

    _chooseNextNeighbors(fromNode, nextRowIds) {
        if (nextRowIds.length === 0) return [];
        if (nextRowIds.length === 1) return [nextRowIds[0]];

        /* Map fromNode.row (0..fromNode.rowCount-1) onto the next
         * column's row index space, then pick the closest row plus
         * sometimes an adjacent one for branching. */
        const myFrac = fromNode.row / Math.max(1, fromNode.rowCount - 1);
        const targetRow = Math.round(myFrac * (nextRowIds.length - 1));

        const picks = [nextRowIds[targetRow]];
        if (this.rng() < 0.5) {
            const drift = this.rng() < 0.5 ? -1 : 1;
            const altRow = targetRow + drift;
            if (altRow >= 0 && altRow < nextRowIds.length) {
                picks.push(nextRowIds[altRow]);
            }
        }
        return Array.from(new Set(picks));
    }
}

/*
 * Cosmetic icon for a node kind, used by the map UI. Kept here so the
 * UI never has to know what kinds exist.
 */
export function nodeIcon(kind) {
    switch (kind) {
        case 'fight':  return '⚔';
        case 'pack':   return '⚔⚔';
        case 'elite':  return '☠';
        case 'rest':   return '🔥';
        case 'reward': return '?';
        case 'shop':   return '$';
        case 'boss':   return '👑';
        default:       return '·';
    }
}

export function nodeLabel(kind) {
    switch (kind) {
        case 'fight':  return 'Fight';
        case 'pack':   return 'Pack';
        case 'elite':  return 'Elite';
        case 'rest':   return 'Rest';
        case 'reward': return 'Reward';
        case 'shop':   return 'Shop';
        case 'boss':   return 'Boss';
        default:       return 'Node';
    }
}
