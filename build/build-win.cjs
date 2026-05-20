/*
 * Programmatic Electron-Packager build for the Windows target.
 *
 * We use the JS API instead of the CLI for two reasons:
 *   1. The `ignore` matchers are regular expressions and several of
 *      them contain shell-meta characters (parens, $, dots) that are
 *      a nightmare to escape across npm script -> bash -> npx layers.
 *   2. We can derive the project name + version from package.json so
 *      bumping the version doesn't drift across multiple files.
 *
 * After packaging, we zip the output dir into a single artifact under
 * dist/ so the produced bundle is easy to ship.
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

/*
 * MONKEY-PATCH: electron-packager auto-infers `appVersion` from the
 * project's package.json `version` field. As soon as appVersion is
 * defined the WindowsApp.runRcedit() step kicks in and tries to
 * shell out to `wine64` to rewrite the .exe header - which fails
 * hard on a stock macOS host without Wine installed.
 *
 * We don't actually need the rewritten metadata for a working
 * portable build, so we override needsRcedit() to always return false.
 * The produced .exe just keeps the default Electron icon + version
 * string; the game inside it is identical. To get a fully-branded
 * shipping build, install Wine (`brew install --cask wine-stable`)
 * and remove this patch.
 */
const win32Module = require('electron-packager/src/win32');
if (win32Module && win32Module.App && win32Module.App.prototype) {
    win32Module.App.prototype.needsRcedit = () => false;
}

const packager = require('electron-packager');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PKG  = require(path.join(ROOT, 'package.json'));

/*
 * Files / dirs that should never end up inside the packaged app:
 *   - dist            old build output (recursive packaging would explode)
 *   - node_modules/electron  the electron binary itself - packager
 *                            substitutes its own copy
 *   - node_modules/.cache    npm/electron build caches
 *   - .git, mac-pkg          unrelated source-control + macOS-only stuff
 *   - .DS_Store              macOS finder droppings
 *
 * electron-packager treats each entry as a regular expression that's
 * tested against the path *relative to the project root*, with a
 * leading slash. Parens are valid regex, no shell escaping needed.
 */
const IGNORE = [
    /^\/dist($|\/)/,
    // The game runs entirely in the renderer (browser) process and
    // doesn't import any npm packages. node_modules only contains
    // build-time tooling (electron, electron-packager, their deps),
    // so we exclude it wholesale from the asar.
    /^\/node_modules($|\/)/,
    /^\/\.git($|\/)/,
    /^\/mac-pkg($|\/)/,
    /^\/build($|\/)/,
    /\.DS_Store$/,
    /\/\.npmrc$/,
    /\/package-lock\.json$/,
    // Stray sh-thd-* temp files left by earlier shell sessions
    /^\/sh-thd-/
];

async function main() {
    if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

    const opts = {
        dir: ROOT,
        out: DIST,
        name: 'SirVelorian',
        platform: 'win32',
        arch: 'x64',
        overwrite: true,
        // Bundle source into an asar archive so the dist tree contains
        // a single resources/app.asar instead of thousands of loose
        // files. Smaller, faster startup, and harder for users to
        // accidentally tamper with.
        asar: true,
        ignore: IGNORE
        // appVersion / buildVersion / icon / win32metadata all need
        // Wine on a non-Windows host to write into the .exe header
        // via rcedit. We omit them entirely; the .exe still launches
        // and the produced bundle is functional. To produce a final
        // shipping build with proper metadata + a custom .ico file,
        // run this same script on a Windows machine or install Wine
        // on macOS (`brew install --cask wine-stable`) and add
        // appVersion/buildVersion/icon back here.
    };

    console.log('[build-win] packaging', PKG.name, PKG.version);
    const appPaths = await packager(opts);
    console.log('[build-win] produced:', appPaths);

    /*
     * Wrap the produced folder into a zip so it's a single artifact
     * users can download. Output sits next to the folder under dist/.
     */
    for (const p of appPaths) {
        const folder = path.basename(p);
        const zipName = `${folder}.zip`;
        console.log(`[build-win] zipping ${folder} -> ${zipName}`);
        try {
            execFileSync('zip', ['-rq', zipName, folder], { cwd: DIST, stdio: 'inherit' });
            const zipPath = path.join(DIST, zipName);
            const sz = fs.statSync(zipPath).size;
            console.log(`[build-win] zip ready: ${zipPath} (${(sz / (1024 * 1024)).toFixed(1)} MB)`);
        } catch (e) {
            console.warn('[build-win] zip step failed (non-fatal); folder is still usable:', e.message);
        }
    }
}

main().catch(err => {
    console.error('[build-win] FAILED:', err);
    process.exit(1);
});
