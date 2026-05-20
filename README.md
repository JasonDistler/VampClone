# Sir Velorian's Last Stand

A web-based, Vampire Survivors-style bullet-heaven roguelike starring **Sir Velorian** (Heavy Armor Tank, LV 12) of the Iron Order. Hold the line against an endless tide of D&D-style monsters until your last breath.

All sprites are procedurally drawn at boot - no external art assets, no build step.

## Enemies (unlock as time passes)

| Time | Enemy | Tier | Notes |
| --- | --- | --- | --- |
| 0:00 | Goblin | common | Fast swarmer |
| 0:20 | Goblin Sniper | common | Keeps distance, shoots arrows |
| 0:30 | Bat | common | Tiny, very fast, low HP |
| 1:00 | Goblin Berserker | common | Charging dual-scimitar attacker |
| 1:30 | Skeleton | common | Throws bones |
| 2:10 | Zombie | mid | Slow, tanky, knockback-resistant |
| 2:30 | Fire Elemental | mid | Lobs fire bolts |
| 3:20 | Wraith | mid | Ghostly, phases through other enemies |
| 3:50 | Necrotech Construct | elite | Slow, regenerates 5 HP/s, 130 HP |
| 4:20 | Orc Brute | mid | Slow tank, heavy contact damage |
| 5:00 | Shadowmancer | elite | Void caster, 3-bolt spread |
| 5:40 | Beholder | elite | Floating, fires magic bolts |
| 6:20 | Death Knight | elite | 220 HP, lobs hellfire orbs |
| 7:40 | Frost Giant | boss | 380 HP, hurls ice shards |
| 9:00 | Balor Demon | boss | 500 HP, fires fire-bolt fan |

## Weapons

- **Lion's Bane** (greatsword) - auto-swings a 180-degree arc on alternating sides. Always equipped.
- **Holy Aura** - persistent ring of light that ticks damage to nearby foes. Unlocks at level 4.
- **Daggers of Avalon** - thrown daggers in your facing direction. Unlocks at level 8.

## Power-up scaling

Stat power-ups (damage, move speed, healing, magnet, lifesteal, etc.) start small and grow with level so each pick stays meaningful as enemy density increases:

| Level range | Roll range |
| --- | --- |
| 1 - 5 | 2 - 5% |
| 6 - 10 | 4 - 7% |
| 11 - 15 | 6 - 9% |
| 16 - 20 | 8 - 11% |
| 21+ | +2% / +2% per 5 levels |

## How to play

Move with `WASD` or the arrow keys.

That's it. The greatsword **Lion's Bane** swings on its own. Survive.

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` or arrow keys |
| Pick a level-up reward | Click a card, or `1` / `2` / `3` |
| Restart on game over | `Space` / `Enter` / `R` or click `RESTART` |

## Run it locally

ES module imports require a real HTTP server. From the project root:

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765/>.

(Any static file server works - `npx serve`, `php -S`, etc.)

## Build a native macOS app + .pkg installer

The project ships with a Swift/WKWebView wrapper under `mac-pkg/` so you can play offline as a real Mac app, no Node or Electron required.

Requirements: macOS 11+, Xcode Command Line Tools (`xcode-select --install`), and an internet connection on the **first** build (to vendor `phaser.min.js`).

```bash
./mac-pkg/build.sh
```

This produces (in `mac-pkg/dist/`):

- `Sir Velorian's Last Stand.app` — drag-and-drop runnable on the build machine
- `SirVeloriansLastStand-1.0.0.pkg` — double-click installer (drops the app into `/Applications` and strips the quarantine flag in its postinstall script)
- `Install (double-click me).command` — convenience installer for the .app
- `READ-ME-FIRST.txt` — install instructions for recipients
- `SirVeloriansLastStand-1.0.0.zip` — bundles all four files above; ship this to other Macs

### Distributing to another Mac

Local-only builds aren't Apple-notarized, so macOS Gatekeeper will block first launch on any machine other than the one it was built on (the dialog says *"can't be opened, move to Trash"* or *"Apple could not verify…"*). Pick one of:

1. **Send the .zip.** The recipient unzips it and double-clicks `Install (double-click me).command`. The script strips the quarantine attribute, copies the .app into `/Applications`, and launches it.
2. **Send the .pkg.** Its postinstall script removes the quarantine attribute automatically. The recipient may need to allow the .pkg itself once via *System Settings → Privacy & Security → Open Anyway*.
3. **Manual one-liner.** Drag the .app to `/Applications`, then run in Terminal:
   ```bash
   xattr -dr com.apple.quarantine "/Applications/Sir Velorian's Last Stand.app"
   ```

Pass `--clean` to wipe `mac-pkg/dist/` before rebuilding.

## Tech

- [Phaser 3](https://phaser.io/) loaded from CDN
- Vanilla ES modules, no bundler
- Procedural 32-bit pixel art rendered to offscreen canvases at boot, then registered as Phaser textures
- Logical resolution 480x270, integer-scaled to viewport via `Phaser.Scale.FIT` + `pixelArt: true`

## Project layout

```
index.html
style.css
src/
  main.js                       # Phaser game config & boot
  art/PixelArt.js               # procedural pixel art generators
  scenes/
    BootScene.js                # generate textures + animations
    GameScene.js                # main arena
    UIScene.js                  # HUD overlay
    LevelUpScene.js             # 3-card upgrade picker
    GameOverScene.js
  entities/
    Player.js                   # Sir Velorian
    Enemy.js                    # base AI w/ seek + separation
    enemies/{Goblin,Skeleton,OrcBrute,Bat,Zombie,Wraith,Beholder,
             GoblinSniper,GoblinBerserker,FireElemental,Necrotech,
             Shadowmancer,DeathKnight,FrostGiant,Balor}.js
  weapons/
    Greatsword.js               # Lion's Bane auto-swing arc
    HolyAura.js                 # divine zone of damage
    Daggers.js                  # thrown dagger projectiles
  systems/
    SpawnDirector.js            # time-based difficulty curve
    XpSystem.js                 # gems, magnet, level curve
    DamageNumbers.js
    RunState.js                 # shared run-time state
```

## Building a Windows .exe

The game ships as a portable Windows desktop app via Electron. The build
runs from macOS or Linux without needing Wine for a working (though
unbranded) .exe.

```bash
# One-time deps (modern Node required; we used Node 26 + npm 11)
npm install --registry=https://registry.npmjs.org/

# Produce dist/SirVelorian-win32-x64/SirVelorian.exe (and a zip)
npm run build:win
```

Output:

- `dist/SirVelorian-win32-x64/` — extract-and-run portable bundle
- `dist/SirVelorian-win32-x64.zip` — single-file artifact (~106 MB)

The Electron main process lives in `electron-main.cjs` (CommonJS so it
plays nicely with `"type": "module"` in `package.json`). The actual
build steps are in `build/build-win.cjs`, which:

1. Calls `electron-packager` programmatically (regex ignore matchers
   are easier to maintain in JS than in shell-escaped CLI args).
2. Monkey-patches `WindowsApp#needsRcedit` to a no-op so the build
   doesn't try to shell out to `wine64` for `.exe` header rewrites.
3. Zips the produced folder into a single distributable.

To get a fully-branded build with a custom icon, file metadata, and
copyright string, install Wine (`brew install --cask wine-stable`) and
remove the monkey-patch in `build/build-win.cjs`.

## Roadmap (post-MVP)

- Mobile touch controls
- True online daily-run leaderboard
- Custom .ico + signed Windows + macOS shipping builds
