/*
 * Status effects on enemies.
 *
 * Applied by weapons that opt in via runState.statusEffects[weaponId]
 * and by elite-spawn behaviors. Each effect is a tiny FSM stored
 * directly on the enemy:
 *
 *   enemy.status = {
 *       burn:   { until: <wallClock>, dps: <number>, lastTick: <wallClock> }
 *       freeze: { until: <wallClock>, slowFactor: <0..1> }
 *       poison: { until: <wallClock>, stacks: <int>, lastTick: <wallClock> }
 *       shock:  { until: <wallClock>, jumpsLeft: <int> }
 *   }
 *
 * Tick logic lives here in StatusEffects.update(scene, time, dt) which
 * iterates the enemies group once per frame, advances each effect, and
 * removes expired ones. Visual feedback is driven from Enemy.update()
 * via tint priorities (already in place there).
 */

const STATUS_TINTS = {
    burn:   0xff8a3a,
    freeze: 0x9bdcff,
    poison: 0x6fff6a,
    shock:  0xfff088
};

export function statusTint(enemy) {
    if (!enemy?.status) return null;
    // Priority order if stacked: shock > burn > freeze > poison
    if (enemy.status.shock) return STATUS_TINTS.shock;
    if (enemy.status.burn) return STATUS_TINTS.burn;
    if (enemy.status.freeze) return STATUS_TINTS.freeze;
    if (enemy.status.poison) return STATUS_TINTS.poison;
    return null;
}

/* Apply or refresh an effect. Returns the live effect object. */
export function applyBurn(enemy, durationMs, dps) {
    if (!enemy.status) enemy.status = {};
    const now = performance.now();
    const cur = enemy.status.burn;
    enemy.status.burn = {
        until: Math.max(cur?.until || 0, now + durationMs),
        dps: Math.max(cur?.dps || 0, dps),
        lastTick: now
    };
    return enemy.status.burn;
}

export function applyFreeze(enemy, durationMs, slowFactor = 0.5) {
    if (!enemy.status) enemy.status = {};
    const now = performance.now();
    const cur = enemy.status.freeze;
    enemy.status.freeze = {
        until: Math.max(cur?.until || 0, now + durationMs),
        slowFactor: Math.min(cur?.slowFactor ?? 1, slowFactor)
    };
    return enemy.status.freeze;
}

export function applyPoison(enemy, durationMs, stackDps) {
    if (!enemy.status) enemy.status = {};
    const now = performance.now();
    const cur = enemy.status.poison;
    const stacks = Math.min(5, (cur?.stacks || 0) + 1);
    enemy.status.poison = {
        until: Math.max(cur?.until || 0, now + durationMs),
        stacks,
        dps: stackDps,
        lastTick: now
    };
    return enemy.status.poison;
}

export function applyShock(enemy, durationMs, jumps = 2) {
    if (!enemy.status) enemy.status = {};
    const now = performance.now();
    enemy.status.shock = {
        until: now + durationMs,
        jumpsLeft: jumps
    };
    return enemy.status.shock;
}

/*
 * Per-frame tick: deal DoT damage, advance freeze countdown, expire
 * effects whose `until` timestamp has passed. Shock chains are handled
 * by the source weapon at apply-time, not here.
 */
export function updateStatusEffects(scene, time, dt) {
    if (!scene.enemies) return;
    const wallNow = performance.now();
    const enemies = scene.enemies.getChildren();
    for (const e of enemies) {
        if (!e.active || !e.status) continue;
        const s = e.status;

        // BURN - DoT, ticks every 250ms
        if (s.burn) {
            if (wallNow >= s.burn.until) {
                s.burn = null;
            } else if (wallNow - s.burn.lastTick >= 250) {
                const dmg = Math.max(1, Math.round(s.burn.dps * 0.25));
                s.burn.lastTick = wallNow;
                e.takeDamage(dmg, null);
            }
        }

        // POISON - stacks; ticks every 400ms; total dps scales with stacks
        if (s.poison) {
            if (wallNow >= s.poison.until) {
                s.poison = null;
            } else if (wallNow - s.poison.lastTick >= 400) {
                const dmg = Math.max(1, Math.round(s.poison.dps * 0.4 * s.poison.stacks));
                s.poison.lastTick = wallNow;
                e.takeDamage(dmg, null);
            }
        }

        // FREEZE - slow factor applied via velocity multiplier in
        // Enemy.update; just clear when expired.
        if (s.freeze && wallNow >= s.freeze.until) s.freeze = null;

        // SHOCK - short stun; clear on expiry
        if (s.shock && wallNow >= s.shock.until) s.shock = null;
    }
}

/*
 * Velocity multiplier applied to enemies under status effects. Called
 * from Enemy.update (extension point). Freeze slows, shock pins (set
 * to ~0.1).
 */
export function statusSpeedMult(enemy) {
    if (!enemy?.status) return 1;
    let mult = 1;
    if (enemy.status.freeze) mult *= enemy.status.freeze.slowFactor;
    if (enemy.status.shock) mult *= 0.1;
    return mult;
}
