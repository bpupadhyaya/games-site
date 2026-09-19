// Pure ballistics: no state, no rng, no drawing. Units are virtual pixels and seconds.
import { GRAVITY, SLING } from './tuning.js';

// pull = how far the pouch was dragged back (vector from rest position to the finger, reversed):
// dragging down-left gives a pull pointing up-right, which is the direction the stone flies.
export function clampPull(px, py) {
  const len = Math.hypot(px, py);
  if (len <= SLING.maxPull) return { x: px, y: py, len };
  const k = SLING.maxPull / len;
  return { x: px * k, y: py * k, len: SLING.maxPull };
}

export const launchVelocity = (pull) => ({ vx: pull.x * SLING.power, vy: pull.y * SLING.power });

export function stepStone(stone, dt, wind) {
  stone.px = stone.x;
  stone.py = stone.y;
  stone.vx += wind * dt;
  stone.vy += GRAVITY * dt;
  stone.x += stone.vx * dt;
  stone.y += stone.vy * dt;
}

// Points along the start of the flight path, for the dotted aim guide.
export function previewArc(pull, wind, dots, spacing = 0.06) {
  const { vx, vy } = launchVelocity(pull);
  const out = [];
  for (let i = 1; i <= dots; i++) {
    const t = i * spacing;
    out.push({ x: SLING.x + vx * t + 0.5 * wind * t * t, y: SLING.y + vy * t + 0.5 * GRAVITY * t * t });
  }
  return out;
}

// The pull that makes a stone pass through (tx, ty) after `time` seconds. Used by scripted tests
// and by any future "assist"/tutorial ghost. Returns null when it would exceed the maximum pull.
export function aimAt(tx, ty, wind, time) {
  const vx = (tx - SLING.x - 0.5 * wind * time * time) / time;
  const vy = (ty - SLING.y - 0.5 * GRAVITY * time * time) / time;
  const pull = { x: vx / SLING.power, y: vy / SLING.power };
  pull.len = Math.hypot(pull.x, pull.y);
  return pull.len <= SLING.maxPull ? pull : null;
}

// Swept test: did the segment (x0,y0)-(x1,y1) pass within r of (cx,cy)? Stops fast stones
// tunnelling through small birds between two ticks.
export function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x0) * dx + (cy - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x0 + dx * t - cx;
  const ny = y0 + dy * t - cy;
  return nx * nx + ny * ny <= r * r;
}

export function distanceToSegment(x0, y0, x1, y1, cx, cy) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((cx - x0) * dx + (cy - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x0 + dx * t - cx, y0 + dy * t - cy);
}
