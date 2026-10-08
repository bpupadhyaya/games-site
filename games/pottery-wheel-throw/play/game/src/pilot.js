// Pottery Wheel: the pilot. It plans the next stroke for a session from the current clay, then performs it as a stream of fingertip positions.
// Used by Watch and Learn (a whole demonstration) and by Hint (just the next stroke's caption and target spot). Pure and deterministic.
import { roAt, floorTop, isOpen, wallStats, targetR, N, TMIN } from './sim.js';
import { stationId } from './session.js';
import { CAPTIONS, TRADITIONS } from './content.js';

const glide = (p, gx, gy, speed, dt) => {
  const dx = gx - p.X, dy = gy - p.Y, d = Math.hypot(dx, dy), m = speed * dt;
  if (d <= m) { p.X = gx; p.Y = gy; return true; }
  p.X += dx / d * m; p.Y += dy / d * m; return false;
};
const side = (s) => (s.pilotSide ?? 1);

// ---- strokes: each returns { id, station, caption:[title, text], mark(s) -> {X,Y}, begin(s), run(s, dt) -> {X,Y,down} | null } ------------------
function centreStroke(s) {
  const sd = side(s), st = { ph: 0, hold: 0 };
  const tgt = () => ({ X: sd * (roAt(s.pot, 0.55) + s.pot.ecc * 0.8 - 0.22), Y: 0.55 });
  return {
    id: 'centre', caption: CAPTIONS.centre, mark: () => tgt(),
    begin: (p) => { p.X = sd * 2.2; p.Y = 0.7; p.down = false; },
    run(ses, dt, p) {
      const g = tgt();
      if (st.ph === 0) { if (glide(p, g.X, g.Y, 3.2, dt)) st.ph = 1; p.down = false; return p; }
      if (st.ph === 1) { p.down = true; p.X += (g.X - p.X) * Math.min(1, 6 * dt); p.Y = g.Y; if (ses.pot.ecc < 0.012) st.ph = 2; return p; }
      p.down = false; return glide(p, sd * 2.2, p.Y, 3.5, dt) ? null : p;
    },
  };
}
function openStroke(s) {
  const st = { ph: 0 }, floorY = 0.22, reach = 0.66;
  return {
    id: 'open', caption: CAPTIONS.open, mark: () => ({ X: 0, Y: s.pot.H }),
    begin: (p) => { p.X = 0.9; p.Y = s.pot.H + 0.5; p.down = false; },
    run(ses, dt, p) {
      if (st.ph === 0) { p.down = false; if (glide(p, 0.0, ses.pot.H + 0.15, 2.5, dt)) st.ph = 1; return p; }
      if (st.ph === 1) { p.down = true; if (glide(p, 0.03, floorY, 0.8, dt)) st.ph = 2; return p; }
      if (st.ph === 2) { p.down = true; if (glide(p, reach, floorY, 0.42, dt)) st.ph = 3; return p; }
      p.down = false; return glide(p, reach + 0.5, floorY + 0.7, 3, dt) ? null : p;
    },
  };
}
function pullStroke(s, goalH) {
  const sd = side(s), st = { ph: 0 }, y0 = Math.max(floorTop(s.pot) + 0.18, 0.3), inset = 0.14;
  const xAt = (y) => sd * (roAt(s.pot, Math.min(y, s.pot.H)) - inset);
  return {
    id: 'pull', caption: CAPTIONS.pull, mark: () => ({ X: sd * roAt(s.pot, y0), Y: y0 }),
    begin: (p) => { p.X = sd * (roAt(s.pot, y0) + 0.5); p.Y = y0; p.down = false; },
    run(ses, dt, p) {
      if (st.ph === 0) { p.down = false; if (glide(p, sd * (roAt(ses.pot, y0) + 0.05), y0, 2.6, dt)) st.ph = 1; return p; }
      if (st.ph === 1) { p.down = true; p.Y = y0; p.X += (xAt(y0) - p.X) * Math.min(1, 8 * dt); if (Math.abs(p.X - xAt(y0)) < 0.02) st.ph = 2; return p; }
      if (st.ph === 2) {
        p.down = true; p.Y += 0.95 * dt; p.X += (xAt(p.Y) - p.X) * Math.min(1, 9 * dt);
        if (p.Y >= ses.pot.H - 0.12 || (goalH && ses.pot.H >= goalH * 0.92 && p.Y > 0.5)) st.ph = 3;
        return p;
      }
      p.down = false; return glide(p, sd * (roAt(ses.pot, ses.pot.H) + 0.6), ses.pot.H + 0.2, 3, dt) ? null : p;
    },
  };
}
function shapeStroke(s, y, goal) {
  const sd = side(s), st = { ph: 0, t: 0 };
  return {
    id: 'shape', caption: CAPTIONS.shape, mark: () => ({ X: sd * roAt(s.pot, y), Y: y }),
    begin: (p) => { p.X = sd * (roAt(s.pot, y) + 0.5); p.Y = y; p.down = false; },
    run(ses, dt, p) {
      const cur = roAt(ses.pot, y);
      if (st.ph === 0) { p.down = false; if (glide(p, sd * (cur + 0.02), y, 2.8, dt)) st.ph = 1; return p; }
      if (st.ph === 1) {
        p.down = true; st.t += dt; p.Y = y;
        const gx = sd * goal, dx = gx - p.X, m = 0.8 * dt;
        p.X += Math.abs(dx) <= m ? dx : Math.sign(dx) * m;
        if ((Math.abs(roAt(ses.pot, y) - goal) < 0.035 && Math.abs(dx) < 0.03) || st.t > 2.4) st.ph = 2;
        return p;
      }
      p.down = false; return glide(p, sd * (cur + 0.7), y, 3, dt) ? null : p;
    },
  };
}
function trimStroke(s, kind) {
  const sd = side(s), st = { ph: 0, t: 0 };
  return {
    id: 'trim', caption: CAPTIONS.trim, mark: () => ({ X: sd * roAt(s.pot, kind === 'foot' ? 0.12 : 0.3), Y: kind === 'foot' ? 0.12 : 0.3 }),
    begin: (p) => { p.X = sd * (roAt(s.pot, 0.3) + 0.5); p.Y = 0.3; p.down = false; },
    run(ses, dt, p) {
      if (kind === 'foot') {
        if (st.ph === 0) { p.down = false; if (glide(p, sd * (roAt(ses.pot, 0.1) + 0.03), 0.1, 2.6, dt)) st.ph = 1; return p; }
        if (st.ph === 1) { p.down = true; st.t += dt; p.Y = 0.1; p.X += (sd * (roAt(ses.pot, 0.1) - 0.16) - p.X) * Math.min(1, 3 * dt); if (st.t > 1.3) st.ph = 2; return p; }
        p.down = false; return glide(p, sd * (roAt(ses.pot, 0.1) + 0.6), 0.3, 3, dt) ? null : p;
      }
      if (st.ph === 0) { p.down = false; if (glide(p, sd * (roAt(ses.pot, 0.3) + 0.02), 0.3, 2.6, dt)) st.ph = 1; return p; }
      if (st.ph === 1) {
        p.down = true; p.Y += 0.8 * dt; p.X += (sd * (roAt(ses.pot, Math.min(p.Y, ses.pot.H)) + 0.01) - p.X) * Math.min(1, 9 * dt);
        if (p.Y >= ses.pot.H - 0.05) st.ph = 2;
        return p;
      }
      p.down = false; return glide(p, sd * (roAt(ses.pot, ses.pot.H) + 0.6), ses.pot.H + 0.2, 3, dt) ? null : p;
    },
  };
}
function glazeBand(s, yFrac, motif, acc) {
  const st = { ph: 0, t: 0 };
  const y = () => Math.max(0.3, s.pot.H * yFrac);
  return {
    id: 'glaze', caption: CAPTIONS.glaze, mark: () => ({ X: side(s) * (roAt(s.pot, y()) + 0.02), Y: y() }),
    begin: (p, ses) => { ses.glaze.motif = motif; ses.glaze.acc = acc; p.X = side(s) * 2.2; p.Y = y(); p.down = false; },
    run(ses, dt, p) {
      const yy = y();
      if (st.ph === 0) { p.down = false; if (glide(p, side(s) * (roAt(ses.pot, yy) + 0.02), yy, 3.2, dt)) st.ph = 1; return p; }
      if (st.ph === 1) { p.down = true; st.t += dt; p.Y = yy; if (st.t > 1.1 + (yFrac < 0.5 ? 0.9 : 0.4)) st.ph = 2; return p; }
      p.down = false; return glide(p, side(s) * 2.2, yy, 3.5, dt) ? null : p;
    },
  };
}

// ---- planner -----------------------------------------------------------------------------------------------------------------------------
export const goalHeight = (s) => (s.target ? s.target.H * 1.0 : (s.sample ? s.sample.H : 3.0));
export function maxShapeError(s) {
  const tg = s.target, P = s.pot;
  let best = { e: 0, y: 0, goal: 0 };
  const top = Math.min(P.H, tg.H);
  for (let k = 1; k < 24; k++) {
    const y = (k + 0.5) / 24 * top, goal = targetR(tg, y), e = roAt(P, y) - goal;
    if (Math.abs(e) > Math.abs(best.e)) best = { e, y, goal };
  }
  return best;
}

// Returns the next stroke, or { advance: true } when this station is done, or null when the whole pot is finished.
export function nextStroke(s) {
  s.pilot = s.pilot ?? { opens: 0, passes: 0, shapes: 0, trims: 0, bands: 0, picked: false };
  const pl = s.pilot, id = stationId(s), P = s.pot;
  s.pilotSide = s.pilotSide ?? 1;
  if (id === 'centre') return P.ecc > 0.012 ? centreStroke(s) : { advance: true };
  if (id === 'open') return (!isOpen(P) || floorTop(P) < 0.1 || P.Ri[N - 1] < 0.5) && pl.opens < 3 ? ((pl.opens = (pl.opens ?? 0) + 1), openStroke(s)) : { advance: true };
  if (id === 'pull') {
    const ws = wallStats(P);
    if (P.H < goalHeight(s) * 0.92 && ws.mean > 0.19 && pl.passes < 14) { pl.passes += 1; s.pilotSide = -s.pilotSide; return pullStroke(s, goalHeight(s)); }
    return { advance: true };
  }
  if (id === 'shape') {
    const tg = s.target ?? (s.sample ? s.sample : null);
    if (tg && pl.shapes < 90) {
      const err = maxShapeErrorFor(s, tg);
      if (Math.abs(err.e) > 0.05) { pl.shapes += 1; s.pilotSide = -s.pilotSide; return shapeStroke(s, err.y, err.goal); }
    }
    return { advance: true };
  }
  if (id === 'trim') {
    if (pl.trims === 0) { pl.trims = 1; return trimStroke(s, 'smooth'); }
    if (pl.trims === 1) { pl.trims = 2; return trimStroke(s, 'foot'); }
    if (pl.trims === 2) { pl.trims = 3; return trimStroke(s, 'smooth'); }
    return { advance: true };
  }
  if (id === 'glaze') {
    if (!pl.picked) {
      pl.picked = true;
      return { pick: true, caption: ['Choose a tradition', `${TRADITIONS[s.glaze.trad].name}: ${TRADITIONS[s.glaze.trad].craft}`], mark: () => null, begin: () => {}, run: () => null, id: 'pick' };
    }
    if (pl.bands < 2) { const b = pl.bands++; return glazeBand(s, b === 0 ? 0.3 : 0.72, b === 0 ? 0 : 1, b === 0 ? 0 : 1); }
    return { advance: true };
  }
  if (id === 'fire') return s.fireDone ? null : { wait: true };
  return null;
}
function maxShapeErrorFor(s, tg) {
  const P = s.pot;
  let best = { e: 0, y: 0, goal: 0 };
  const top = Math.min(P.H, tg.H);
  for (let k = 0; k < 28; k++) {
    const y = (k + 0.5) / 28 * top, goal = targetR(tg, y);
    if (y < 0.18) continue;
    const e = roAt(P, y) - goal;
    if (Math.abs(e) > Math.abs(best.e)) best = { e, y, goal };
  }
  return best;
}
export { TMIN };

// Run the pilot headlessly until `until(s)` is true (screenshots, shelf demo pots, tests). Returns the elapsed simulated seconds.
import { applyFinger, stepSession, advance } from './session.js';
export function runPilot(s, { until = () => false, maxSec = 900, dt = 1 / 60 } = {}) {
  const p = { X: 0, Y: 0, down: false };
  let cur = null, t = 0, guard = 0;
  while (t < maxSec && !until(s)) {
    if (!cur) {
      const n = nextStroke(s);
      if (!n) break;
      if (n.advance) { if (++guard > 400 || !advance(s)) break; continue; }
      if (n.wait) { applyFinger(s, { X: 0, Y: 0, down: false }, dt); stepSession(s, dt); t += dt; continue; }
      if (n.pick) continue;
      cur = n; cur.begin?.(p, s);
    }
    const r = cur.run(s, dt, p);
    applyFinger(s, r ?? { X: p.X, Y: p.Y, down: false }, dt);
    stepSession(s, dt); t += dt;
    if (!r) cur = null;
  }
  return t;
}
