// The shape of every stroke as the paddle (or the player's bat) moves: where it winds up, where it meets the ball, where it follows
// through, and how its face is tilted. Shared by the opponent athlete and the player's bat. Pure functions of the published swing.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeIn = (t) => t * t;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Stroke shapes: back = where the paddle winds up (depth toward the body, height offset), fol = follow-through, tilt = face angle (+ opens it upward).
export const STROKE = {
  loop: { back: [0.17, -0.2], fol: [0.2, 0.24], tilt: -0.3 }, drive: { back: [0.22, -0.02], fol: [0.24, 0.06], tilt: -0.12 },
  push: { back: [0.1, 0.16], fol: [0.15, -0.14], tilt: 0.6 }, chop: { back: [0.12, 0.26], fol: [0.18, -0.2], tilt: 0.75 },
  block: { back: [0.05, 0.0], fol: [0.07, 0.02], tilt: -0.05 }, smash: { back: [0.12, 0.34], fol: [0.18, -0.3], tilt: -0.55 },
  touch: { back: [0.08, -0.04], fol: [0.1, 0.03], tilt: 0.4 }, lob: { back: [0.1, -0.3], fol: [0.1, 0.4], tilt: 0.95 },
  flick: { back: [0.12, -0.1], fol: [0.16, 0.12], tilt: -0.2 },
  serveShort: { back: [0.1, 0.16], fol: [0.14, -0.1], tilt: 0.55 }, serveLong: { back: [0.16, -0.05], fol: [0.2, 0.06], tilt: -0.1 }, serveSpin: { back: [0.15, 0.1], fol: [0.18, -0.08], tilt: 0.2 },
};
export const kindOfFlick = (f) => (f.dir === 'down' ? (f.f < 0.5 ? 'push' : 'chop') : f.f < 0.24 ? 'touch' : f.f < 0.6 ? 'loop' : 'drive');
export const swingKind = (sw) => sw.kind ?? (sw.intent ? sw.intent.kind : sw.flick ? (sw.serve ? (sw.flick.dir === 'down' ? 'serveShort' : sw.flick.f >= 0.62 ? 'serveLong' : 'serveSpin') : kindOfFlick(sw.flick)) : sw.block ? 'block' : 'drive');


// desired paddle (blade centre position and orientation) for a side at time tNow
export function padTarget(side, pad, tNow, clock, ballPos, serveHold, opts = {}) {
  const sg = side === 'p' ? 1 : -1;
  let ready = opts.ready ? [pad.x, opts.ready[0], sg * opts.ready[1]] : [pad.x, 1.12, sg * 1.78];
  if (serveHold) ready = opts.serveReady ? [pad.x + sg * 0.2, opts.serveReady[0], sg * opts.serveReady[1]] : [pad.x + sg * 0.2, 1.1, sg * 1.58];
  let pos = ready, tilt = 0.25, yaw = 0, u = 0, kind = null;
  const sw = pad.swing;
  if (sw && tNow < sw.tc + 0.55) {
    kind = swingKind(sw);
    const st = STROKE[kind] ?? STROKE.drive;
    const c = sw.cpos ?? ready;
    const back = [c[0], c[1] + st.back[1] * 0.8, c[2] + sg * st.back[0] * 0.9];
    const fol = [c[0] + (sw.flick ? sw.flick.aim * -0.1 : 0), c[1] + st.fol[1] * 0.7, c[2] - sg * st.fol[0] * 0.45];
    const tback = Math.max(sw.t0, sw.tc - 0.085);
    const dt = tNow - sw.t0;
    if (tNow < tback) { u = 0.25 * clamp(dt / Math.max(0.02, tback - sw.t0), 0, 1); pos = lerp3(ready, back, ease(clamp(dt / Math.max(0.02, tback - sw.t0), 0, 1))); tilt = 0.25 + (st.tilt - 0.25) * clamp(dt / 0.1, 0, 1); }
    else if (tNow < sw.tc) { const k = easeIn(clamp((tNow - tback) / Math.max(0.02, sw.tc - tback), 0, 1)); u = 0.25 + 0.4 * k; pos = lerp3(back, c, k); tilt = st.tilt; }
    else if (tNow < sw.tc + 0.22) { const k = easeOut(clamp((tNow - sw.tc) / 0.22, 0, 1)); u = 0.65 + 0.35 * k; pos = lerp3(c, fol, k); tilt = st.tilt; }
    else { const k = ease(clamp((tNow - sw.tc - 0.22) / 0.33, 0, 1)); u = 1 - k; pos = lerp3(fol, ready, k); tilt = st.tilt + (0.25 - st.tilt) * k; }
    yaw = sw.intent ? clamp((sw.intent.tx - c[0]) * 0.25, -0.5, 0.5) * -sg : sw.flick ? -sw.flick.aim * 0.3 * sg : 0;
  } else pos = [ready[0], ready[1] + Math.sin(clock * 2 + sg) * 0.006, ready[2]];
  // away from the contact the blade leans forward (a natural carry), so the wrist is not bent to its limit; at contact it is exactly as the stroke needs
  const wc = sw ? clamp(1 - Math.abs(tNow - sw.tc) / 0.14, 0, 1) : 0;
  tilt -= (opts.carry ?? 0.55) * (1 - wc * wc * (3 - 2 * wc));
  return { pos, tilt, yaw, u, kind, ready };
}

