/*
 * Sir Velorian's Last Stand — local web-app launcher.
 *
 * Tiny zero-dependency static file server, written for Node.js
 * (>= 14.8 so we can use top-level await in ES modules — `package.json`
 * sets `"type": "module"` for the rest of the project).
 *
 * Step 1 (per the spec): make sure we don't collide with anything else
 * already listening on common dev ports. We probe a short list of
 * preferred ports (8765 first since other tooling in this repo also
 * defaults to it, then 8766..8775). If every preferred port is taken,
 * we fall back to an OS-picked ephemeral port (port 0) so the launcher
 * is still useful when other dev servers are crowding the namespace.
 *
 * Step 2: serve the project root over http://localhost:<port>/ and
 * pop the default browser at the URL. Closing the terminal window or
 * pressing Ctrl-C stops the server.
 *
 * Why not Express/serve/http-server?
 *   - Keeps the launcher truly zero-install: anyone with a working
 *     Node binary can run the .bat without first running `npm install`.
 *   - The static-serving surface area we need (a dozen MIME types,
 *     directory traversal guard, default-to-index.html) is < 80 lines.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/*
 * The project root (where index.html lives) is always the directory
 * containing this script. Resolved at startup so we never accidentally
 * serve files relative to wherever the user happened to launch the
 * .bat from.
 */
const ROOT = __dirname;

/*
 * MIME map. We deliberately set `Content-Type` for `.js` to a
 * JavaScript flavor — without this header, browsers refuse to load
 * `<script type="module">` resources, which would silently break the
 * entire game (the boot path is ESM-only).
 */
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.htm':  'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.cjs':  'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map':  'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.svg':  'image/svg+xml; charset=utf-8',
    '.ico':  'image/x-icon',
    '.wav':  'audio/wav',
    '.mp3':  'audio/mpeg',
    '.ogg':  'audio/ogg',
    '.txt':  'text/plain; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.otf':  'font/otf'
};

const PREFERRED_PORTS = [8765, 8766, 8767, 8768, 8769, 8770, 8771, 8772, 8773, 8774, 8775];

/*
 * Try to bind to each preferred port in order. Returns the first that
 * isn't already in use. Each probe creates a throwaway server, listens,
 * then immediately closes — that's the most reliable cross-platform
 * way to detect "is port X free" because it actually attempts a bind
 * (versus parsing `netstat`, which lies about IPv4-vs-IPv6 collisions).
 *
 * Falls through to port 0 (OS-picked ephemeral) if every preferred
 * port is occupied, so the launcher always succeeds.
 */
function probePort(port) {
    return new Promise((resolve) => {
        const probe = http.createServer();
        probe.once('error', err => {
            if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
                resolve(false);
            } else {
                /* Anything else (e.g., EAFNOSUPPORT) means we can't bind
                 * here for reasons unrelated to a conflict — treat as
                 * unavailable and let the caller try the next port. */
                resolve(false);
            }
        });
        probe.listen(port, '127.0.0.1', () => {
            probe.close(() => resolve(true));
        });
    });
}

async function findFreePort() {
    for (const p of PREFERRED_PORTS) {
        const free = await probePort(p);
        if (free) return p;
    }
    /* Nothing in our preferred range was free. Hand the choice to the
     * OS — port 0 means "give me any free port". */
    return 0;
}

/*
 * Resolve a request path to a real file under ROOT, or null if the
 * request is asking for something outside the project tree (a
 * directory-traversal attempt) or a file that doesn't exist.
 */
function resolveRequestPath(reqUrl) {
    const decoded = decodeURIComponent((reqUrl || '/').split('?')[0].split('#')[0]);
    const target  = decoded === '/' || decoded === '' ? '/index.html' : decoded;
    const rel     = path.normalize(target).replace(/^[\\/]+/, '');
    const abs     = path.resolve(ROOT, rel);
    /* Guard against `..` traversal — `path.resolve` would otherwise
     * happily yield a path outside ROOT. */
    if (!abs.startsWith(ROOT + path.sep) && abs !== ROOT) return null;
    return abs;
}

function serve(req, res) {
    const filePath = resolveRequestPath(req.url);
    if (!filePath) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            /* Disable caching during dev so reloads always see the
             * latest file on disk. */
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma':        'no-cache',
            'Expires':       '0'
        });
        fs.createReadStream(filePath).pipe(res);
    });
}

function openInBrowser(url) {
    /* Per-platform "open URL" command. We fire-and-forget the child
     * process: the launcher's job is done once the URL is dispatched. */
    let cmd;
    if (process.platform === 'win32') {
        /* `start ""` consumes a quoted title argument so the URL is
         * treated as the actual target. */
        cmd = `start "" "${url}"`;
    } else if (process.platform === 'darwin') {
        cmd = `open "${url}"`;
    } else {
        cmd = `xdg-open "${url}"`;
    }
    exec(cmd, () => { /* swallow errors; user can paste the URL themselves */ });
}

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');

const port = await findFreePort();

const server = http.createServer(serve);

server.on('error', err => {
    console.error(`[server] failed to start: ${err.message}`);
    process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
    const actual = server.address().port;
    const url = `http://localhost:${actual}/`;
    const fallbackNote = port === 0
        ? ' (preferred 8765-8775 were busy; using OS-picked port)'
        : '';
    console.log('');
    console.log('  Sir Velorian\'s Last Stand — dev server');
    console.log('  ' + '\u2500'.repeat(40));
    console.log(`  Serving:  ${ROOT}`);
    console.log(`  URL:      ${url}${fallbackNote}`);
    console.log('');
    console.log('  Press Ctrl-C to stop.');
    console.log('');
    if (!noOpen) openInBrowser(url);
});

/*
 * Clean shutdown on Ctrl-C so the port is released immediately
 * (otherwise it can sit in TIME_WAIT for a few seconds).
 */
function shutdown() {
    server.close(() => process.exit(0));
    /* Hard-kill after a short grace period in case a stuck connection
     * holds the close open. */
    setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
