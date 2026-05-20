#!/usr/bin/env bash
#
# Build a self-contained macOS .app and .pkg installer for Sir Velorian's
# Last Stand. No Electron, no Node - just a Swift WKWebView wrapper around
# the existing HTML/JS game.
#
# Output:
#   mac-pkg/dist/Sir Velorian's Last Stand.app
#   mac-pkg/dist/SirVeloriansLastStand-1.0.0.pkg
#
# Requires:
#   - macOS 11+ with Xcode Command Line Tools (`xcode-select --install`)
#   - Internet on first run (to vendor phaser.min.js into the bundle so
#     the game runs offline thereafter)
#
# Usage:
#   ./mac-pkg/build.sh
#
# Re-running rebuilds in place. Pass --clean to wipe build artifacts first.

set -euo pipefail

# ---------- paths ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_NAME="Sir Velorian's Last Stand"
EXEC_NAME="SirVeloriansLastStand"
BUNDLE_ID="com.local.sirvelorianslaststand"
VERSION="1.0.0"

PHASER_VERSION="3.80.1"
PHASER_URL="https://cdn.jsdelivr.net/npm/phaser@${PHASER_VERSION}/dist/phaser.min.js"
VENDOR_DIR="$PROJECT_ROOT/vendor"
PHASER_LOCAL="$VENDOR_DIR/phaser-${PHASER_VERSION}.min.js"

DIST_DIR="$SCRIPT_DIR/dist"
APP_BUNDLE="$DIST_DIR/${APP_NAME}.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
WEB_ROOT="$APP_RESOURCES/web"

PKG_PATH="$DIST_DIR/${EXEC_NAME}-${VERSION}.pkg"
ZIP_PATH="$DIST_DIR/${EXEC_NAME}-${VERSION}.zip"

# ---------- args ----------
if [[ "${1:-}" == "--clean" ]]; then
    echo "[clean] removing $DIST_DIR"
    rm -rf "$DIST_DIR"
fi

mkdir -p "$DIST_DIR"

# ---------- step 1: vendor phaser ----------
# We rewrite index.html at copy time to point at this local file instead
# of the CDN, so the .app runs fully offline once installed.
if [[ ! -f "$PHASER_LOCAL" ]]; then
    echo "[vendor] downloading phaser ${PHASER_VERSION}"
    mkdir -p "$VENDOR_DIR"
    if ! curl -fSL --retry 3 -o "$PHASER_LOCAL" "$PHASER_URL"; then
        echo "[vendor] download failed - need internet on first build" >&2
        echo "[vendor]   tried: $PHASER_URL" >&2
        exit 1
    fi
    echo "[vendor] saved $(du -h "$PHASER_LOCAL" | cut -f1) -> $PHASER_LOCAL"
else
    echo "[vendor] reusing cached $PHASER_LOCAL"
fi

# ---------- step 2: scaffold the .app bundle ----------
echo "[bundle] scaffolding ${APP_BUNDLE}"
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_MACOS" "$APP_RESOURCES" "$WEB_ROOT"

# Info.plist drops in unchanged.
cp "$SCRIPT_DIR/Info.plist" "$APP_CONTENTS/Info.plist"

# ---------- step 3: copy web assets ----------
# Mirror the project structure under Resources/web/. Only the runtime
# files - the build script and Swift sources stay outside.
echo "[bundle] copying game assets"
cp "$PROJECT_ROOT/index.html" "$WEB_ROOT/index.html"
cp "$PROJECT_ROOT/style.css"  "$WEB_ROOT/style.css"
cp -R "$PROJECT_ROOT/src"     "$WEB_ROOT/src"

mkdir -p "$WEB_ROOT/vendor"
cp "$PHASER_LOCAL" "$WEB_ROOT/vendor/phaser-${PHASER_VERSION}.min.js"

# Rewrite the CDN <script src=...> to a relative vendor path. This is a
# one-line surgical replacement; the rest of the file is untouched.
echo "[bundle] rewriting index.html for offline phaser"
PHASER_REL="vendor/phaser-${PHASER_VERSION}.min.js"
PHASER_PATTERN='https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'
# Use python for portable in-place replacement (sed -i syntax differs across BSD/GNU).
python3 - "$WEB_ROOT/index.html" "$PHASER_PATTERN" "$PHASER_REL" <<'PY'
import sys, pathlib
path, needle, replace = sys.argv[1], sys.argv[2], sys.argv[3]
p = pathlib.Path(path)
text = p.read_text()
if needle not in text:
    sys.stderr.write(f"warn: pattern not found in {path}; skipping rewrite\n")
else:
    p.write_text(text.replace(needle, replace))
PY

# ---------- step 4: compile the Swift host ----------
echo "[swift] compiling App.swift -> $EXEC_NAME"
SWIFTC_OPTS=(
    -sdk "$(xcrun --sdk macosx --show-sdk-path)"
    -target "$(uname -m)-apple-macos11.0"
    -O
    -framework Cocoa
    -framework WebKit
    -o "$APP_MACOS/$EXEC_NAME"
    "$SCRIPT_DIR/App.swift"
)
xcrun -sdk macosx swiftc "${SWIFTC_OPTS[@]}"
chmod +x "$APP_MACOS/$EXEC_NAME"

# ---------- step 5: ad-hoc codesign ----------
# Apple Silicon refuses to launch unsigned binaries. An ad-hoc signature
# (no developer cert) is enough for local install/run; users can also
# right-click -> Open if Gatekeeper still complains.
echo "[sign] ad-hoc codesigning bundle"
codesign --force --deep --sign - "$APP_BUNDLE" 2>/dev/null || {
    echo "[sign] codesign failed - app may need right-click Open the first time" >&2
}

# ---------- step 6: build the .pkg installer ----------
# Drops the .app into /Applications when the user double-clicks the .pkg.
# Includes a postinstall script that strips the quarantine attribute on
# the installed app so Gatekeeper doesn't block first launch when the
# .pkg has been transferred to a different Mac.
echo "[pkg] assembling ${PKG_PATH}"
PKG_STAGE="$DIST_DIR/.pkgroot"
PKG_SCRIPTS="$DIST_DIR/.pkgscripts"
rm -rf "$PKG_STAGE" "$PKG_SCRIPTS"
mkdir -p "$PKG_STAGE/Applications" "$PKG_SCRIPTS"
cp -R "$APP_BUNDLE" "$PKG_STAGE/Applications/"

cat >"$PKG_SCRIPTS/postinstall" <<EOF
#!/bin/bash
# Runs as root after the package is installed. We remove the quarantine
# extended attribute that macOS attaches to anything downloaded or
# transferred between machines. Without this strip, Gatekeeper blocks
# the unsigned/ad-hoc-signed app on first launch with a "move to Trash"
# prompt - even though the .pkg was just allowed to install.
INSTALLED="/Applications/${APP_NAME}.app"
if [ -d "\$INSTALLED" ]; then
    /usr/bin/xattr -dr com.apple.quarantine "\$INSTALLED" 2>/dev/null || true
fi
exit 0
EOF
chmod +x "$PKG_SCRIPTS/postinstall"

pkgbuild \
    --root "$PKG_STAGE" \
    --scripts "$PKG_SCRIPTS" \
    --identifier "$BUNDLE_ID" \
    --version "$VERSION" \
    --install-location "/" \
    "$PKG_PATH" >/dev/null

rm -rf "$PKG_STAGE" "$PKG_SCRIPTS"

# ---------- step 7: ship a double-clickable installer for non-pkg flow --
# Some recipients prefer dragging the .app rather than running a .pkg.
# This .command script lives next to the .app in dist/ and (when copied
# alongside the .app on another Mac) strips the quarantine flag, copies
# the app into /Applications, and launches it - all in one double click.
INSTALL_CMD="$DIST_DIR/Install (double-click me).command"
echo "[install] writing $INSTALL_CMD"
cat >"$INSTALL_CMD" <<'INSTALL_EOF'
#!/usr/bin/env bash
#
# Double-click this file in Finder. It will:
#   1. Strip macOS's "downloaded from the internet" quarantine flag
#      from the .app sitting next to it (this is what causes the
#      "Move to Trash" Gatekeeper dialog on a non-build machine).
#   2. Copy the .app into /Applications (asks for admin password).
#   3. Launch it.
#
# If you'd rather do this manually, just open Terminal and run:
#     xattr -dr com.apple.quarantine "/path/to/Sir Velorian's Last Stand.app"
# then drag the app to /Applications.

set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="Sir Velorian's Last Stand"
SRC="$HERE/$APP_NAME.app"
DST="/Applications/$APP_NAME.app"

if [[ ! -d "$SRC" ]]; then
    osascript -e "display alert \"Installer error\" message \"$APP_NAME.app must be in the same folder as this script.\""
    exit 1
fi

# Strip quarantine on the staging copy first so Gatekeeper doesn't
# pop a dialog as we move it.
/usr/bin/xattr -dr com.apple.quarantine "$SRC" 2>/dev/null || true

# Replace any existing install. /Applications is admin-owned so we may
# need to escalate; cp without sudo will silently fail on protected
# locations and the sudo branch picks up the slack.
if [[ -d "$DST" ]]; then
    rm -rf "$DST" 2>/dev/null || sudo rm -rf "$DST"
fi
cp -R "$SRC" "$DST" 2>/dev/null || sudo cp -R "$SRC" "$DST"

/usr/bin/xattr -dr com.apple.quarantine "$DST" 2>/dev/null || true
sudo /usr/bin/xattr -dr com.apple.quarantine "$DST" 2>/dev/null || true

open "$DST"

osascript -e "display notification \"Installed $APP_NAME to /Applications\" with title \"$APP_NAME\""
INSTALL_EOF
chmod +x "$INSTALL_CMD"

# ---------- step 8: write a plain-text README for recipients ------------
# Some users won't trust a .command file (rightly so). Plain instructions
# they can copy-paste are the most universally reliable.
README_TXT="$DIST_DIR/READ-ME-FIRST.txt"
cat >"$README_TXT" <<EOF
Sir Velorian's Last Stand - macOS install
==========================================

This app is locally built and not Apple-notarized, so macOS Gatekeeper
will block first launch on a different Mac than the one it was built
on. You'll see a "[App] is damaged and can't be opened. You should
move it to the Trash" or "Apple could not verify..." dialog.

Pick ONE of the three install options below.


OPTION 1 - Easiest (double-click installer)
-------------------------------------------
1. Make sure these two files are in the SAME folder:
       Sir Velorian's Last Stand.app
       Install (double-click me).command
2. Double-click "Install (double-click me).command".
3. If macOS warns about the .command file, right-click it and choose
   "Open" instead, then click Open in the warning dialog.
4. Enter your password when prompted (used to copy into /Applications).
5. The game launches automatically.


OPTION 2 - Run the .pkg installer
---------------------------------
1. Double-click SirVeloriansLastStand-${VERSION}.pkg.
2. If macOS blocks it, open System Settings -> Privacy & Security,
   scroll to the "Security" section, and click "Open Anyway".
3. Step through the installer; the postinstall script automatically
   removes the quarantine flag.
4. Launch from Launchpad or /Applications.


OPTION 3 - Manual (always works)
--------------------------------
1. Drag "Sir Velorian's Last Stand.app" into /Applications.
2. Open Terminal (Applications > Utilities > Terminal).
3. Paste this and press Enter:

       xattr -dr com.apple.quarantine "/Applications/Sir Velorian's Last Stand.app"

4. Launch the app from Launchpad.


Why?
----
Apple requires apps from the internet to be signed by a paid Apple
Developer account (\$99/year) and notarized through Apple's servers
to launch without warnings. This is a personal local build so neither
applies; the quarantine bit just needs removing once.
EOF

# ---------- step 9: bundle a release zip for easy transfer --------------
# Packs the .app + the install command + the README into a single zip
# you can AirDrop / email / drop into Dropbox.
echo "[zip] packaging release archive ${ZIP_PATH}"
rm -f "$ZIP_PATH"
(
    cd "$DIST_DIR"
    zip -qry "$ZIP_PATH" \
        "${APP_NAME}.app" \
        "Install (double-click me).command" \
        "READ-ME-FIRST.txt"
)

# ---------- summary ----------
APP_SIZE=$(du -sh "$APP_BUNDLE" | cut -f1)
PKG_SIZE=$(du -sh "$PKG_PATH"  | cut -f1)
ZIP_SIZE=$(du -sh "$ZIP_PATH"  | cut -f1)
echo
echo "===================================================================="
echo "Built $APP_NAME v$VERSION"
echo "  .app : $APP_BUNDLE  ($APP_SIZE)"
echo "  .pkg : $PKG_PATH  ($PKG_SIZE)"
echo "  .zip : $ZIP_PATH  ($ZIP_SIZE)   <-- ship this to other Macs"
echo
echo "Run the .app directly on this machine:"
echo "  open \"$APP_BUNDLE\""
echo
echo "To install on ANOTHER Mac:"
echo "  Send them the .zip. They unzip and double-click"
echo "  'Install (double-click me).command' (or follow READ-ME-FIRST.txt)."
echo "===================================================================="
