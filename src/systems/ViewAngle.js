import { settings } from './Settings.js';

/*
 * Player-facing "View Angle" toggle.
 *
 * 'topdown' (default): the camera looks straight down at the play field —
 * the original look the rest of the systems were authored against.
 *
 * 'tilted': applies a CSS `perspective() rotateX()` transform to the
 * Phaser canvas (and the floating-damage-numbers overlay that pins to it),
 * yielding the classic 3/4 / oblique top-down view that genre staples
 * like Vampire Survivors and Zelda LTTP use. Crucially this is *purely a
 * visual change*:
 *
 *   - World coords, physics, hitboxes, AI, weapon ranges, camera scroll,
 *     and input mapping all keep operating in flat 2D as they always have.
 *   - HUD, menus, modals, and toasts all stay flat because the transform
 *     only targets `#game canvas` and `#damage-numbers` (see style.css).
 *
 * The controller mirrors the GraphicsMode pattern: it stamps a
 * `body[data-view]` attribute on the document so all the actual styling
 * lives in CSS rules and the Phaser side never has to care that the view
 * angle exists.
 */
class ViewAngleController {
    constructor() {
        /* Nothing else to do — the controller is a thin wrapper around
         * settings.viewAngle, kept as a class for symmetry with
         * GraphicsMode and so callers can future-extend without
         * importing the raw settings object. */
    }

    applyToBody() {
        const mode = settings.viewAngle;
        if (typeof document !== 'undefined' && document.body) {
            document.body.dataset.view = mode;
        }
    }

    apply() {
        this.applyToBody();
    }

    set(mode) {
        const safe = mode === 'tilted' ? 'tilted' : 'topdown';
        settings.set('viewAngle', safe);
        this.apply();
    }

    get current() { return settings.viewAngle; }
}

export const viewAngle = new ViewAngleController();
