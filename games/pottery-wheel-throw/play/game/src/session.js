// Pottery Wheel: one pot from lump to kiln. Pure and deterministic. The game (game.js) and the Watch-and-Learn pilot (pilot.js) both drive
// a session through applyFinger(), so a demonstration uses exactly the same clay rules as a player's finger.
import { newPot, lumpHeightFor, relayout, conserve, centreTool, openTool, pullTool, shapeTool, trimTool, stepPot, roAt, isOpen, floorTop, snapshot, restore, scorePot, N, Y_MAX } from './sim.js';
import { STATIONS, TRADITIONS } from './content.js';

export const MAX_BANDS = 4;
export const BAND_MAX_HALF = 0.34;

export function newSession({ target = null, rng, mode = 'studio', trad = 0 } = {}) {
  const pot = newPot(target ? lumpHeightFor(target) : 1.2);
  pot.ecc = 0.3 + (rng ? rng.range(0, 0.1) : 0.05);
  pot.eccPh = rng ? rng.range(0, 6.28) : 0.7;
  return {
    mode, target, pot, station: 0, gs: null, hist: [], t: 0, stationT: 0,
    glaze: { trad, base: 0, acc: 0, motif: 0, bands: [] },
    centreOk: 0, centreErr: 0, fireT: 0, fireDone: false, tel: { contact: false, pressure: 0, effort: 0, warn: '' }, warnT: 0, warn: '',
    finger: { X: 0, Y: 0, down: false }, strokes: 0, scores: null, banner: null,
  };
}

export const stationId = (s) => STATIONS[s.station].id;

export function ready(s) {
  const id = stationId(s);
  if (id === 'centre') return s.pot.ecc < 0.05;
  if (id === 'open') return isOpen(s.pot) && floorTop(s.pot) >= 0.1;
  if (id === 'pull') return isOpen(s.pot) && s.pot.H > 1.6;
  if (id === 'glaze') return true;
  return true;
}
export function canAdvance(s) {
  const id = stationId(s);
  if (id === 'open') return isOpen(s.pot);
  if (id === 'fire') return false;
  return true;
}

export function advance(s) {
  if (!canAdvance(s)) return false;
  const id = stationId(s);
  if (id === 'centre') s.centreErr = s.pot.ecc;
  s.station = Math.min(STATIONS.length - 1, s.station + 1);
  s.hist = []; s.gs = null; s.stationT = 0;
  const nid = stationId(s);
  if (nid === 'trim') { for (let i = 0; i < N; i++) s.pot.wob[i] *= 0.4; }
  if (nid === 'fire') { s.fireT = 0; s.fireDone = false; s.scores = scorePot(s.pot, s); }
  s.banner = { text: STATIONS[s.station].short, t: 0 };
  return true;
}

export function undo(s) {
  const h = s.hist.pop();
  if (!h) return false;
  restore(s.pot, h.pot);
  s.glaze.bands = h.bands.map((b) => ({ ...b }));
  s.gs = null;
  return true;
}

const pushHist = (s) => { s.hist.push({ pot: snapshot(s.pot), bands: s.glaze.bands.map((b) => ({ ...b })) }); if (s.hist.length > 12) s.hist.shift(); };

// fp = { X, Y, down } in world units. Call once per tick (even when the finger is up).
export function applyFinger(s, fp, dt) {
  const id = stationId(s), pot = s.pot, rX = Math.abs(fp.X);
  s.finger = { X: fp.X, Y: fp.Y, down: !!fp.down };
  let t = { contact: false, pressure: 0, effort: 0, warn: '' };
  if (!fp.down) {
    if (s.gs) {
      if (id === 'glaze' && s.gs.band && s.gs.band.half > 0.075 && s.glaze.bands.length < MAX_BANDS) { s.glaze.bands.push({ y: s.gs.band.y, half: s.gs.band.half, motif: TRADITIONS[s.glaze.trad].motifs[s.glaze.motif], acc: s.glaze.acc }); }
      s.gs = null;
    }
    s.tel = t; pot.touch += (0 - pot.touch) * Math.min(1, 10 * dt);
    return t;
  }
  if (!s.gs) {
    // a new stroke
    let engaged = true;
    if (id === 'pull' || id === 'shape' || id === 'trim') engaged = fp.Y >= -0.05 && fp.Y <= pot.H + 0.45 && Math.abs(rX - roAt(pot, Math.min(fp.Y, pot.H))) < 0.42;
    if (id === 'open') engaged = rX < 0.9;
    if (id === 'glaze') engaged = fp.Y >= 0 && fp.Y <= pot.H + 0.1 && s.glaze.bands.length < MAX_BANDS;
    if (engaged && (id === 'open' || id === 'pull' || id === 'shape' || id === 'trim' || id === 'glaze')) pushHist(s);
    s.gs = { engaged, lastX: fp.X, lastY: fp.Y, vy: 0, vx: 0, speed: 0, t: 0 };
    s.strokes += 1;
    if (id === 'glaze' && engaged) s.gs.band = { y: Math.min(fp.Y, pot.H), half: 0.02 };
  }
  const g = s.gs;
  const vy = (fp.Y - g.lastY) / dt, vx = (fp.X - g.lastX) / dt, k = Math.min(1, 14 * dt);
  g.vy += (vy - g.vy) * k; g.vx += (vx - g.vx) * k; g.speed = Math.hypot(g.vx, g.vy); g.lastX = fp.X; g.lastY = fp.Y; g.t += dt;
  if (g.engaged) {
    if (id === 'centre') t = centreTool(pot, rX, fp.Y, dt, g.vy);
    else if (id === 'open') t = openTool(pot, g, rX, fp.Y, dt);
    else if (id === 'pull') t = pullTool(pot, rX, fp.Y, dt, g.vy, g.speed);
    else if (id === 'shape') {
      if (g.vy > 0.95 && Math.abs(g.vx) < 0.5 && roAt(pot, fp.Y) - rX > 0.02) t = pullTool(pot, rX, fp.Y, dt, g.vy, g.speed);
      else t = shapeTool(pot, g, rX, fp.Y, dt);
    } else if (id === 'trim') t = trimTool(pot, rX, fp.Y, dt, g.vy);
    else if (id === 'glaze' && g.band) {
      g.band.y += (clampY(fp.Y, pot.H) - g.band.y) * Math.min(1, 6 * dt);
      g.band.half = Math.min(BAND_MAX_HALF, g.band.half + 0.2 * dt);
      t = { contact: true, pressure: 0.4, effort: 0.3, warn: '' };
    }
  }
  s.tel = t; pot.touch += ((t.contact ? 1 : 0) - pot.touch) * Math.min(1, 10 * dt);
  if (t.warn) { s.warn = t.warn; s.warnT = 1.1; }
  return t;
}
const clampY = (y, H) => Math.max(0, Math.min(H, y));

export function stepSession(s, dt) {
  s.t += dt; s.stationT += dt;
  stepPot(s.pot, dt);
  if (s.warnT > 0) { s.warnT -= dt; if (s.warnT <= 0) s.warn = ''; }
  if (s.banner) { s.banner.t += dt; if (s.banner.t > 1.8) s.banner = null; }
  const id = stationId(s);
  if (id === 'centre') {
    if (s.pot.ecc < 0.02) { s.centreOk += dt; if (s.centreOk >= 1) advance(s); } else s.centreOk = 0;
  } else if (id === 'fire') {
    s.fireT += dt;
    if (s.fireT >= FIRE_TIME) s.fireDone = true;
  }
}
export const FIRE_TIME = 8;

// What the pot looks like to a lookup: world top of the pot, for layouts.
export const potTop = (s) => Math.min(s.pot.H, Y_MAX);
export { relayout, conserve };
export const palette = (g) => { const T = TRADITIONS[g.trad]; return { base: T.base[g.base], acc: T.accent[g.acc], T }; };
