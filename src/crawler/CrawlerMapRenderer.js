/*
 * SVG renderer for the Crawler Mode floor map.
 *
 * Pure helper module: takes a CrawlerMap instance + the host SVG element
 * and paints node circles + forward edges with the right state classes
 * (available / visited / boss / elite / etc.). The CSS in style.css
 * does the rest — pulse on available, dim on locked, tint per kind.
 *
 * Wires up click handlers on each available node by calling the
 * provided `onNodeClick(nodeId)` callback. Re-rendering replaces the
 * SVG contents in place; nodes that were available last frame and
 * aren't this frame stop pulsing automatically.
 */

import { nodeIcon, nodeLabel } from './CrawlerMap.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Map size in SVG user units. The host wraps the SVG in a flex
 * container with preserveAspectRatio="none" so it stretches; we just
 * need consistent internal coords for layout math. */
const VIEW_W = 1000;
const VIEW_H = 540;

/*
 * Paint a CrawlerMap onto an SVG element. Returns nothing; the SVG
 * is mutated in place.
 */
export function renderMap(map, svgEl, onNodeClick) {
    if (!map || !svgEl) return;

    /* Reset SVG and viewBox. */
    svgEl.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

    /* Lay out nodes by column. */
    const positions = layoutNodes(map);
    const availableSet = new Set(map.getAvailableNodeIds());

    /* Pass 1: edges. Drawn first so node circles paint on top. */
    for (const id of Object.keys(map.nodes)) {
        const node = map.nodes[id];
        const from = positions[id];
        if (!from) continue;
        for (const toId of node.edges) {
            const to = positions[toId];
            if (!to) continue;
            const cls = ['crawler-map-edge'];
            const fromVisited = map.visitedNodeIds.has(id);
            const toAvailable = availableSet.has(toId);
            /* Highlight edges leaving the most-recently-visited node
             * to currently-available children. */
            if (fromVisited && toAvailable) cls.push('available');
            else if (fromVisited) cls.push('visited');
            const line = document.createElementNS(SVG_NS, 'path');
            const d = curvedEdge(from.x, from.y, to.x, to.y);
            line.setAttribute('d', d);
            line.setAttribute('class', cls.join(' '));
            svgEl.appendChild(line);
        }
    }

    /* Pass 2: nodes (circles + icon + label). */
    for (const id of Object.keys(map.nodes)) {
        const node = map.nodes[id];
        const pos = positions[id];
        if (!pos) continue;

        const isVisited = map.visitedNodeIds.has(id);
        const isAvailable = availableSet.has(id);
        const isBoss = node.kind === 'boss';

        const g = document.createElementNS(SVG_NS, 'g');
        const cls = ['crawler-map-node', node.kind];
        if (isAvailable) cls.push('available');
        if (isVisited) cls.push('visited');
        if (isBoss) cls.push('boss');
        g.setAttribute('class', cls.join(' '));
        g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

        const radius = isBoss ? 28 : 22;
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('class', 'crawler-map-node-circle');
        circle.setAttribute('r', String(radius));
        g.appendChild(circle);

        const iconEl = document.createElementNS(SVG_NS, 'text');
        iconEl.setAttribute('class', 'crawler-map-node-icon');
        iconEl.setAttribute('y', '6');
        iconEl.textContent = nodeIcon(node.kind);
        g.appendChild(iconEl);

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('class', 'crawler-map-node-label');
        label.setAttribute('y', String(radius + 16));
        label.textContent = nodeLabel(node.kind);
        g.appendChild(label);

        if (isAvailable && typeof onNodeClick === 'function') {
            g.style.cursor = 'pointer';
            g.addEventListener('click', () => onNodeClick(id));
        }
        svgEl.appendChild(g);
    }
}

/*
 * Spread the floor's columns evenly across VIEW_W and the rows in each
 * column evenly across VIEW_H, with comfortable padding. Returns
 * { [nodeId]: { x, y } }.
 */
function layoutNodes(map) {
    const ids = Object.keys(map.nodes);
    const cols = new Map(); /* col → row → nodeId */
    let maxCol = 0;
    for (const id of ids) {
        const n = map.nodes[id];
        if (!cols.has(n.col)) cols.set(n.col, []);
        cols.get(n.col)[n.row] = id;
        if (n.col > maxCol) maxCol = n.col;
    }

    const colCount = maxCol + 1;
    const xPad = 80;
    const yPad = 70;
    const xStep = colCount > 1 ? (VIEW_W - xPad * 2) / (colCount - 1) : 0;

    const positions = {};
    for (let c = 0; c <= maxCol; c++) {
        const rowIds = cols.get(c) || [];
        const rowCount = rowIds.length;
        for (let r = 0; r < rowCount; r++) {
            const id = rowIds[r];
            if (!id) continue;
            const x = xPad + c * xStep;
            const y = rowCount === 1
                ? VIEW_H / 2
                : yPad + (VIEW_H - yPad * 2) * (r / (rowCount - 1));
            positions[id] = { x, y };
        }
    }
    return positions;
}

/*
 * Build an SVG path between two points with a gentle horizontal
 * S-curve so edges feel less rigid than straight lines.
 */
function curvedEdge(x1, y1, x2, y2) {
    const dx = (x2 - x1) * 0.5;
    const c1x = x1 + dx;
    const c1y = y1;
    const c2x = x2 - dx;
    const c2y = y2;
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
