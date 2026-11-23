const GRAVITY = 9.8;
const MAX_BOUNCE_HEIGHT = 0.18;
const RESTITUTION = 0.12;
const DAMPING = 4.5;

export function stepDropMotion(state, dt, surfaceY, {reducedMotion = false} = {}) {
  const next = {...state, impacted: false};
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(surfaceY)) return next;

  if (state.phase === 'settled') {
    next.y = surfaceY;
    return next;
  }

  if (state.phase === 'airborne') {
    if (reducedMotion) {
      next.elapsed = (state.elapsed || 0) + dt;
      const progress = Math.min(next.elapsed / 0.12, 1);
      next.reducedStartY = Number.isFinite(state.reducedStartY) ? state.reducedStartY : state.y;
      next.y = next.reducedStartY + (surfaceY - next.reducedStartY) * progress;
      if (progress === 1) {
        next.y = surfaceY;
        next.velocity = 0;
        next.phase = 'settled';
        next.impacted = true;
      }
      return next;
    }

    next.velocity = state.velocity - GRAVITY * dt;
    next.y = state.y + next.velocity * dt;
    if (next.y <= surfaceY) {
      next.y = surfaceY;
      next.velocity = Math.min(Math.abs(next.velocity) * RESTITUTION, Math.sqrt(2 * GRAVITY * MAX_BOUNCE_HEIGHT));
      next.phase = 'settling';
      next.settledFor = 0;
      next.impacted = true;
    }
    return next;
  }

  if (state.phase === 'settling') {
    if (reducedMotion) {
      next.y = surfaceY;
      next.velocity = 0;
      next.phase = 'settled';
      return next;
    }
    next.settledFor = (state.settledFor || 0) + dt;
    next.y = Math.max(surfaceY, state.y + state.velocity * dt);
    next.velocity = state.velocity * Math.exp(-DAMPING * dt);
    if (next.y === surfaceY || next.settledFor >= 1.1 || next.velocity < 0.015) {
      next.y = surfaceY;
      next.velocity = 0;
      next.phase = 'settled';
    }
  }
  return next;
}
