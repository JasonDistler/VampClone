/*
 * Gamepad input system. Uses the raw Web Gamepad API (navigator.getGamepads)
 * instead of Phaser's gamepad plugin so we can drive UI events from the
 * same poll regardless of which scene is currently active or paused.
 *
 * Lifecycle:
 *   - On `gamepadconnected`, identifies the controller as 'xbox', 'ps5',
 *     or 'generic' and sets `document.body.dataset.gamepad` so CSS can
 *     swap keyboard hints to controller glyphs.
 *   - `pollFrame()` is called once per game tick (wired from main.js to
 *     Phaser's `prestep` event) to capture the current button states for
 *     edge-detection.
 *   - `wasJustPressed(GP.A)` returns true exactly once per press, even
 *     across multiple consumers in the same frame.
 *   - `isDown(GP.DUP)` returns the held state.
 *   - `movement()` returns left/right/up/down booleans combining the
 *     left stick (deadzoned) and the d-pad.
 *
 * Connect listeners via `gamepad.onConnect(kind => ...)` to react when
 * a pad is plugged in mid-game (HUD updates, etc).
 */

/* Standard Gamepad API button indices. Same layout for Xbox, DualSense
 * (PS5), and most generic XInput pads when the Standard Mapping is in
 * effect. The browser performs the remap from raw HID, so we just code
 * to the canonical indices. */
export const GP = {
    A: 0,        // bottom face   - Xbox: A,    PS5: Cross
    B: 1,        // right face    - Xbox: B,    PS5: Circle
    X: 2,        // left face     - Xbox: X,    PS5: Square
    Y: 3,        // top face      - Xbox: Y,    PS5: Triangle
    LB: 4,       // top-left bumper
    RB: 5,       // top-right bumper
    LT: 6,       // analog trigger left
    RT: 7,       // analog trigger right
    BACK: 8,     // Xbox: View / PS5: Share / Create
    START: 9,    // Xbox: Menu / PS5: Options
    L3: 10,      // left stick click
    R3: 11,      // right stick click
    DUP: 12,
    DDOWN: 13,
    DLEFT: 14,
    DRIGHT: 15
};

const DEADZONE = 0.28;

function detectKind(id) {
    const lower = (id || '').toLowerCase();
    /* DualSense and PlayStation pads */
    if (lower.includes('dualsense') ||
        lower.includes('dualshock') ||
        lower.includes('playstation') ||
        lower.includes('054c') ||
        lower.includes('wireless controller')) {
        return 'ps5';
    }
    /* Xbox / XInput */
    if (lower.includes('xbox') ||
        lower.includes('xinput') ||
        lower.includes('045e')) {
        return 'xbox';
    }
    return 'generic';
}

class GamepadSystem {
    constructor() {
        this.connected = false;
        this.padIndex = -1;
        this.kind = 'xbox';
        this.id = '';
        this.curButtons = [];
        this.prevButtons = [];
        this.consumed = new Set();
        this.connectHandlers = [];
        this.disconnectHandlers = [];
        this._wired = false;
    }

    /*
     * One-time wiring of the browser's gamepad events. Safe to call
     * multiple times - subsequent calls are no-ops.
     */
    init() {
        if (this._wired) return;
        this._wired = true;
        window.addEventListener('gamepadconnected', e => this._onConnect(e.gamepad));
        window.addEventListener('gamepaddisconnected', e => this._onDisconnect(e.gamepad));
        /* Some browsers (Safari) don't fire connected at all until first
         * input. As a fallback, try to pick up an already-connected pad. */
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (const pad of pads) {
            if (pad && pad.connected) { this._onConnect(pad); break; }
        }
    }

    onConnect(handler) {
        this.connectHandlers.push(handler);
        if (this.connected) handler(this.kind);
    }

    onDisconnect(handler) {
        this.disconnectHandlers.push(handler);
    }

    _onConnect(pad) {
        if (!pad) return;
        this.connected = true;
        this.padIndex = pad.index;
        this.id = pad.id || '';
        this.kind = detectKind(this.id);
        this.curButtons = [];
        this.prevButtons = [];
        this.consumed.clear();
        document.body.dataset.gamepad = this.kind;
        for (const h of this.connectHandlers) h(this.kind);
    }

    _onDisconnect(pad) {
        if (pad && pad.index !== this.padIndex) return;
        this.connected = false;
        this.padIndex = -1;
        this.id = '';
        this.curButtons = [];
        this.prevButtons = [];
        this.consumed.clear();
        delete document.body.dataset.gamepad;
        for (const h of this.disconnectHandlers) h();
    }

    _activePad() {
        if (!this.connected || !navigator.getGamepads) return null;
        const pads = navigator.getGamepads();
        return pads[this.padIndex] || null;
    }

    /*
     * Snapshot the current button + axis state once per frame. Must be
     * called before any wasJustPressed/isDown/movement queries to keep
     * edge detection consistent across consumers.
     */
    pollFrame() {
        const pad = this._activePad();
        this.prevButtons = this.curButtons;
        if (!pad) {
            this.curButtons = [];
            this.consumed.clear();
            return;
        }
        const next = new Array(pad.buttons.length);
        for (let i = 0; i < pad.buttons.length; i++) {
            next[i] = !!(pad.buttons[i] && pad.buttons[i].pressed);
        }
        this.curButtons = next;
        this.consumed.clear();
    }

    isDown(idx) {
        return !!this.curButtons[idx];
    }

    /*
     * True exactly once per physical press, regardless of how many
     * times any consumer calls it during the same frame. The first
     * caller in a frame "consumes" the press; later callers see false.
     * This matches the behavior of Phaser.Input.Keyboard.JustDown.
     */
    wasJustPressed(idx) {
        if (this.consumed.has(idx)) return false;
        const fresh = !!this.curButtons[idx] && !this.prevButtons[idx];
        if (fresh) this.consumed.add(idx);
        return fresh;
    }

    axes() {
        const pad = this._activePad();
        if (!pad) return { lx: 0, ly: 0, rx: 0, ry: 0 };
        const dz = v => Math.abs(v) < DEADZONE ? 0 : v;
        return {
            lx: dz(pad.axes[0] || 0),
            ly: dz(pad.axes[1] || 0),
            rx: dz(pad.axes[2] || 0),
            ry: dz(pad.axes[3] || 0)
        };
    }

    /*
     * Combined left-stick + d-pad movement, returned as the same shape
     * the keyboard code uses so callers can OR them together.
     */
    movement() {
        if (!this.connected) return { left: false, right: false, up: false, down: false };
        const a = this.axes();
        return {
            left: a.lx <= -DEADZONE || this.isDown(GP.DLEFT),
            right: a.lx >= DEADZONE || this.isDown(GP.DRIGHT),
            up: a.ly <= -DEADZONE || this.isDown(GP.DUP),
            down: a.ly >= DEADZONE || this.isDown(GP.DDOWN)
        };
    }
}

export const gamepad = new GamepadSystem();
