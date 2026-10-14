// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, levelsLayout, overLayout, pauseLayout, centerCard, TEXT_SCALES, host, R, clamp, grid, faceGeo, PANEL_W } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, wrap, F, mix, rgba, icons, UI, SERIF } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { DOCS } from './content.js';
import { inlay } from './inlay.js';
import { v3 } from './v3.js';
import { LEVELS, TIER_NAMES, FACE_NAMES, KEEPSAKES, KEEPSAKE_NAMES } from './levels.js';

export const metrics = { max: 0, view: 0, rect: null };
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'holders', label: 'Show what holds', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
export const settingsList = (s) => (s.demo ? SETTINGS.filter((r) => r.id !== 'restore') : SETTINGS);
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'holders': return p.holders ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return 0;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
export const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
const TAU = Math.PI * 2;

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  background(ctx, w, h, s.t);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'levels') drawLevels(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ wood ===================================================================
// A raised wooden slab with marquetry and a brass pull. r = rect, lift 0..1 = held up by the finger.
function slab(ctx, r, pid, vertical, lift = 0, glow = 0) {
  const T = theme(), m = Math.min(r.w, r.h), rad = m * 0.2, d = m * 0.07 + lift * m * 0.04;
  rr(ctx, r.x + m * 0.02, r.y + d * 0.9 + m * 0.05, r.w - m * 0.04, r.h, rad); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill();
  rr(ctx, r.x, r.y + d, r.w, r.h - d, rad); ctx.fillStyle = mix(T.woods[2], '#000000', 0.45); ctx.fill();   // thickness
  const f = { x: r.x, y: r.y - lift * m * 0.05, w: r.w, h: r.h - d };
  ctx.save();
  rr(ctx, f.x, f.y, f.w, f.h, rad); ctx.clip();
  inlay(ctx, f, pid % 6, Math.floor(pid / 6) + pid, vertical);
  const g = ctx.createLinearGradient(0, f.y, 0, f.y + f.h);
  g.addColorStop(0, 'rgba(255,255,255,0.34)'); g.addColorStop(0.35, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = g; ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.restore();
  rr(ctx, f.x, f.y, f.w, f.h, rad); ctx.lineWidth = Math.max(1.5, m * 0.045); ctx.strokeStyle = 'rgba(30,14,6,0.65)'; ctx.stroke();
  rr(ctx, f.x + m * 0.03, f.y + m * 0.03, f.w - m * 0.06, f.h - m * 0.06, rad * 0.8); ctx.lineWidth = Math.max(1, m * 0.02); ctx.strokeStyle = 'rgba(255,248,225,0.45)'; ctx.stroke();
  // brass pull
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2, pr = m * 0.15;
  ctx.beginPath(); ctx.arc(cx + pr * 0.06, cy + pr * 0.14, pr * 1.12, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  const bg = ctx.createRadialGradient(cx - pr * 0.35, cy - pr * 0.4, pr * 0.1, cx, cy, pr);
  bg.addColorStop(0, T.brassHi); bg.addColorStop(0.55, T.brass); bg.addColorStop(1, T.brassLo);
  ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.fillStyle = bg; ctx.fill();
  if (glow > 0) { rr(ctx, f.x - 2, f.y - 2, f.w + 4, f.h + 4, rad + 2); ctx.lineWidth = Math.max(3, m * 0.08); ctx.strokeStyle = rgba(T.accent, 0.5 + 0.5 * glow); ctx.stroke(); }
  return f;
}

// ================================================================ the face ================================================================
// panels: [{ lane, steps, vis, goal, id, vertical?, glow, shake, locked }]; o: { t, win, arrow: {lane, dir} }
export function drawFace(ctx, G, panels, o = {}) {
  const T = theme(), S = G.S, { box } = G, t = o.t ?? 0, v = G.vertical;
  // lacquer frame
  ctx.save();
  rr(ctx, box.x + 2, box.y + 7, box.w, box.h, S * 0.42); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill();
  const fg = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  fg.addColorStop(0, T.frame0); fg.addColorStop(1, T.frame1);
  rr(ctx, box.x, box.y, box.w, box.h, S * 0.42); ctx.fillStyle = fg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,190,0.28)'; ctx.stroke();
  // marquetry band
  const bi = S * 0.1, band = S * 0.2;
  rr(ctx, box.x + bi, box.y + bi, box.w - 2 * bi, box.h - 2 * bi, S * 0.34); ctx.save(); ctx.clip();
  ctx.fillStyle = T.woods[2]; ctx.fillRect(box.x, box.y, box.w, box.h);
  const q = band;
  const stripe = (x, y, w, h, vert) => {
    const n = Math.ceil((vert ? h : w) / q);
    for (let i = 0; i < n; i++) { ctx.fillStyle = T.woods[(i * 2 + (vert ? 1 : 0)) % 4]; ctx.fillRect(vert ? x : x + i * q, vert ? y + i * q : y, vert ? w : q + 0.5, vert ? q + 0.5 : h); }
  };
  stripe(box.x, box.y + bi, box.w, band, false); stripe(box.x, box.y + box.h - bi - band, box.w, band, false);
  stripe(box.x + bi, box.y, band, box.h, true); stripe(box.x + box.w - bi - band, box.y, band, box.h, true);
  ctx.restore();
  // plate
  const pi = bi + band + S * 0.03, plate = { x: box.x + pi, y: box.y + pi, w: box.w - 2 * pi, h: box.h - 2 * pi };
  const pg = ctx.createLinearGradient(0, plate.y, 0, plate.y + plate.h);
  pg.addColorStop(0, T.plate0); pg.addColorStop(1, T.plate1);
  rr(ctx, plate.x, plate.y, plate.w, plate.h, S * 0.22); ctx.fillStyle = pg; ctx.fill();
  ctx.lineWidth = Math.max(2, S * 0.05); ctx.strokeStyle = T.plateEdge; ctx.stroke();
  // grain: deterministic fine lines
  ctx.save(); rr(ctx, plate.x, plate.y, plate.w, plate.h, S * 0.22); ctx.clip();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(90,50,15,0.1)'; ctx.beginPath();
  const gn = Math.ceil((v ? plate.w : plate.h) / (S * 0.16));
  for (let i = 0; i < gn; i++) { const o2 = i * S * 0.16 + ((i * 37) % 7) * S * 0.01; if (v) { ctx.moveTo(plate.x + o2, plate.y); ctx.lineTo(plate.x + o2 + ((i % 3) - 1) * S * 0.04, plate.y + plate.h); } else { ctx.moveTo(plate.x, plate.y + o2); ctx.lineTo(plate.x + plate.w, plate.y + o2 + ((i % 3) - 1) * S * 0.04); } }
  ctx.stroke(); ctx.restore();

  // grooves, marks, panels (grooves + marks first so every panel sits above them)
  for (const p of panels) {
    const g = G.groove(p.lane, p.steps);
    rr(ctx, g.x, g.y, g.w, g.h, S * 0.2); ctx.fillStyle = T.groove; ctx.fill();
    rr(ctx, g.x + 1, g.y + 1, g.w - 2, g.h - 2, S * 0.2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
    // little place dots along the centre line
    for (let k = 0; k <= p.steps; k++) {
      const c = v ? { x: g.x + g.w / 2, y: g.y + (k + PANEL_W / 2) * S } : { x: g.x + (k + PANEL_W / 2) * S, y: g.y + g.h / 2 };
      ctx.beginPath(); ctx.arc(c.x, c.y, S * 0.045, 0, TAU); ctx.fillStyle = T.grooveHi; ctx.fill();
    }
    // brass mark where the panel has to end
    const mk = G.panel(p.lane, p.goal, 0.02), on = Math.abs(p.vis - p.goal) < 0.02;
    rr(ctx, mk.x, mk.y, mk.w, mk.h, S * 0.2);
    ctx.lineWidth = Math.max(2.5, S * 0.07);
    if (on) { ctx.fillStyle = rgba(T.brass, 0.22); ctx.fill(); ctx.strokeStyle = T.brassHi; } else { ctx.setLineDash([S * 0.14, S * 0.11]); ctx.strokeStyle = T.brass; }
    ctx.stroke(); ctx.setLineDash([]);
  }
  for (const p of panels) {
    let r = G.panel(p.lane, p.vis);
    if (p.shake) { const a = p.shake * S * 0.05 * Math.sin(t * 70); r = v ? { ...r, y: r.y + a } : { ...r, x: r.x + a }; }
    slab(ctx, r, p.id, v, p.lift ?? 0, p.glow ?? 0);
    if (p.holder) {   // the panel that holds a catch pulses
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      rr(ctx, r.x - S * 0.05, r.y - S * 0.05, r.w + S * 0.1, r.h + S * 0.1, S * 0.24); ctx.lineWidth = Math.max(3, S * 0.09); ctx.strokeStyle = rgba(T.accent, 0.45 + 0.55 * pulse); ctx.stroke();
      rr(ctx, r.x, r.y, r.w, r.h, S * 0.2); ctx.fillStyle = rgba(T.accent, 0.08 + 0.14 * pulse); ctx.fill();
    }
    if (p.arrow) {   // where the Think panel should slide to
      const bob = Math.sin(t * 6) * S * 0.05, dir = p.arrow;
      const cx = v ? r.x + r.w / 2 : (dir > 0 ? r.x + r.w + S * 0.28 + bob : r.x - S * 0.28 - bob), cy = v ? (dir > 0 ? r.y + r.h + S * 0.28 + bob : r.y - S * 0.28 - bob) : r.y + r.h / 2, a = S * 0.2;
      ctx.beginPath();
      if (v) { ctx.moveTo(cx - a, cy - dir * a * 0.7); ctx.lineTo(cx + a, cy - dir * a * 0.7); ctx.lineTo(cx, cy + dir * a * 0.9); } else { ctx.moveTo(cx - dir * a * 0.7, cy - a); ctx.lineTo(cx - dir * a * 0.7, cy + a); ctx.lineTo(cx + dir * a * 0.9, cy); }
      ctx.closePath(); ctx.fillStyle = T.accent; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke();
    }
    if (p.focus) { rr(ctx, r.x - S * 0.04, r.y - S * 0.04, r.w + S * 0.08, r.h + S * 0.08, S * 0.23); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke(); }
    if (p.hint) { rr(ctx, r.x - S * 0.04, r.y - S * 0.04, r.w + S * 0.08, r.h + S * 0.08, S * 0.23); ctx.lineWidth = Math.max(3, S * 0.08); ctx.strokeStyle = T.accent; ctx.stroke(); }
    if (p.locked) {   // a held panel shows a little catch
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, a = S * 0.26;
      ctx.save(); ctx.lineWidth = Math.max(2.5, S * 0.07); ctx.strokeStyle = T.accent; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy - a * 0.6, a * 0.55, Math.PI, 0, false); ctx.stroke();
      rr(ctx, cx - a * 0.8, cy - a * 0.35, a * 1.6, a * 1.2, a * 0.25); ctx.fillStyle = T.accent; ctx.fill();
      ctx.restore();
    }
  }
  if (o.win > 0) {   // the box opens: a warm light sweeps across the lid
    const k = clamp(o.win, 0, 1), sx = box.x + (((t * 0.35) % 1.3) - 0.15) * box.w;
    const lg = ctx.createLinearGradient(sx - S, 0, sx + S, 0);
    lg.addColorStop(0, 'rgba(255,240,190,0)'); lg.addColorStop(0.5, `rgba(255,244,205,${0.5 * k})`); lg.addColorStop(1, 'rgba(255,240,190,0)');
    rr(ctx, box.x, box.y, box.w, box.h, S * 0.42); ctx.clip(); ctx.fillStyle = lg; ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.restore();
}

// ================================================================ keepsakes + the open drawer ==========================================================
export function drawKeepsake(ctx, kind, cx, cy, s) {
  const T = theme();
  ctx.save(); ctx.translate(cx, cy); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1.5, s * 0.04);
  const grad = (c0, c1, y0 = -s * 0.4, y1 = s * 0.4) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; };
  const poly = (pts, fill, stroke = 'rgba(30,14,6,0.55)') => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); };
  if (kind === 'coin') {
    ctx.beginPath(); ctx.arc(0, 0, s * 0.38, 0, TAU); ctx.fillStyle = grad('#fbfbff', '#9aa3b4'); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(30,14,6,0.5)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.27, 0, TAU); ctx.strokeStyle = 'rgba(70,80,100,0.6)'; ctx.stroke();
    ctx.fillStyle = 'rgba(70,80,100,0.75)'; ctx.fillRect(-s * 0.07, -s * 0.07, s * 0.14, s * 0.14);
  } else if (kind === 'key') {
    ctx.beginPath(); ctx.arc(-s * 0.2, 0, s * 0.18, 0, TAU); ctx.lineWidth = s * 0.1; ctx.strokeStyle = T.brass; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * 0.02, 0); ctx.lineTo(s * 0.4, 0); ctx.moveTo(s * 0.26, 0); ctx.lineTo(s * 0.26, s * 0.16); ctx.moveTo(s * 0.4, 0); ctx.lineTo(s * 0.4, s * 0.2); ctx.stroke();
    ctx.lineWidth = s * 0.03; ctx.strokeStyle = T.brassHi; ctx.beginPath(); ctx.moveTo(0, -s * 0.03); ctx.lineTo(s * 0.38, -s * 0.03); ctx.stroke();
  } else if (kind === 'gem') {
    poly([[-0.3, -0.12], [-0.16, -0.32], [0.16, -0.32], [0.3, -0.12], [0, 0.36]], grad('#9ff2ff', '#2a8fcf'));
    ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(-0.3 * s, -0.12 * s); ctx.lineTo(0.3 * s, -0.12 * s); ctx.moveTo(-0.16 * s, -0.32 * s); ctx.lineTo(-0.06 * s, -0.12 * s); ctx.lineTo(0, 0.36 * s); ctx.moveTo(0.16 * s, -0.32 * s); ctx.lineTo(0.06 * s, -0.12 * s); ctx.lineTo(0, 0.36 * s); ctx.stroke();
  } else if (kind === 'crane') {
    poly([[-0.4, -0.18], [0.0, 0.1], [-0.12, -0.02]], '#f7f0e0');
    poly([[0.0, 0.1], [0.34, -0.3], [0.2, 0.0]], '#f7f0e0');
    poly([[-0.4, -0.18], [-0.12, -0.02], [0.0, 0.1], [0.14, 0.3], [-0.04, 0.16]], '#eadfc8');
    poly([[0.34, -0.3], [0.44, -0.22], [0.2, 0.0]], '#d9534f');
    poly([[-0.06, -0.3], [0.1, -0.02], [-0.02, 0.1]], '#e8dcc3');
  } else if (kind === 'blossom') {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5; ctx.save(); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.ellipse(0, -s * 0.22, s * 0.14, s * 0.22, 0, 0, TAU); ctx.fillStyle = '#ffc9d9'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(170,70,100,0.6)'; ctx.stroke(); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, s * 0.07, 0, TAU); ctx.fillStyle = '#e8a53c'; ctx.fill();
  } else if (kind === 'fan') {
    for (let i = 0; i < 6; i++) {
      const a0 = Math.PI * (1.18 + i * 0.1), a1 = a0 + Math.PI * 0.1; ctx.beginPath(); ctx.moveTo(0, s * 0.3); ctx.arc(0, s * 0.3, s * 0.62, a0, a1); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#f2d6a0' : '#c9573d'; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(30,14,6,0.5)'; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.05, 0, TAU); ctx.fillStyle = T.brass; ctx.fill();
  } else if (kind === 'bell') {
    ctx.beginPath(); ctx.moveTo(-s * 0.3, s * 0.2); ctx.bezierCurveTo(-s * 0.3, -s * 0.3, -s * 0.18, -s * 0.38, 0, -s * 0.38); ctx.bezierCurveTo(s * 0.18, -s * 0.38, s * 0.3, -s * 0.3, s * 0.3, s * 0.2); ctx.closePath();
    ctx.fillStyle = grad(T.brassHi, T.brassLo); ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(30,14,6,0.5)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.07, 0, TAU); ctx.fillStyle = T.brassLo; ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(0, s * 0.4); ctx.lineTo(0, -s * 0.05); ctx.lineWidth = lw * 1.4; ctx.strokeStyle = '#6a3d20'; ctx.stroke();
    poly([[0, -0.38], [0.1, -0.22], [0.26, -0.28], [0.22, -0.08], [0.38, 0.0], [0.2, 0.08], [0.24, 0.26], [0.04, 0.16], [0, 0.3], [-0.04, 0.16], [-0.24, 0.26], [-0.2, 0.08], [-0.38, 0.0], [-0.22, -0.08], [-0.26, -0.28], [-0.1, -0.22]], '#d9532b');
  }
  ctx.restore();
}

// The box seen from the front: a lid band and a body with a drawer that slides out. k = 0..1 progress of the reveal.
export function drawOpenBox(ctx, r, k, kind, t) {
  const T = theme(), bw = Math.min(r.w * 0.86, r.h * 0.95), bh = Math.min(bw * 0.58, r.h / 1.95), bx = r.x + (r.w - bw) / 2;
  const lift = smooth(clamp((k - 0.2) * 1.5, 0, 1)), drop = smooth(clamp(k * 1.8, 0, 1)), rise = smooth(clamp((k - 0.4) * 1.7, 0, 1));
  const lidH = bh * 0.3, bodyH = bh * 0.7, topSpace = bh * 0.62, by = r.y + Math.max(2, (r.h - (topSpace + bh * 1.12)) / 2) + topSpace;
  const bodyY = by + lidH;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(bx + bw / 2, by + bh + bh * 0.18, bw * 0.54, bh * 0.1, 0, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  // body
  rr(ctx, bx, bodyY, bw, bodyH, bw * 0.03); ctx.fillStyle = mix(T.woods[2], '#000000', 0.2); ctx.fill();
  ctx.save(); rr(ctx, bx, bodyY, bw, bodyH, bw * 0.03); ctx.clip(); inlay(ctx, { x: bx, y: bodyY, w: bw, h: bodyH }, 2, 1, false);
  const bg = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH); bg.addColorStop(0, 'rgba(255,255,255,0.14)'); bg.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = bg; ctx.fillRect(bx, bodyY, bw, bodyH); ctx.restore();
  rr(ctx, bx, bodyY, bw, bodyH, bw * 0.03); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(30,14,6,0.7)'; ctx.stroke();
  // the light inside once the lid is up
  if (lift > 0) { const gl = ctx.createLinearGradient(0, bodyY - bh * 0.5, 0, bodyY + 2); gl.addColorStop(0, rgba(T.brassHi, 0)); gl.addColorStop(1, rgba(T.brassHi, 0.45 * lift)); ctx.fillStyle = gl; ctx.fillRect(bx + bw * 0.04, bodyY - bh * 0.5, bw * 0.92, bh * 0.5); }
  // drawer opening (dark) with the drawer sliding out toward the viewer
  const dw = bw * 0.68, dh = bodyH * 0.5, dx = bx + (bw - dw) / 2, dy = bodyY + bodyH * 0.24;
  rr(ctx, dx, dy, dw, dh, bw * 0.02); ctx.fillStyle = '#120806'; ctx.fill();
  const out = drop * dh * 0.42, sc = 1 + drop * 0.06, fw = dw * sc, fh = dh * sc, fx = dx + (dw - fw) / 2, fy = dy + out;
  if (drop > 0.02) { rr(ctx, fx + fw * 0.05, dy + dh * 0.04, fw * 0.9, Math.max(2, out + fh * 0.05), 6); ctx.fillStyle = T.dark ? '#5a1e2a' : '#7a2a38'; ctx.fill(); }
  slab(ctx, { x: fx, y: fy, w: fw, h: fh }, 3, false, 0, 0);
  // the keepsake rises out of the box under the lifted lid
  if (rise > 0) {
    const ks = bh * 0.5, kx = bx + bw / 2, ky = bodyY - rise * bh * 0.2 - ks * 0.18;
    const gl = ctx.createRadialGradient(kx, ky, 0, kx, ky, ks * 1.4);
    gl.addColorStop(0, rgba(T.brassHi, 0.55 * rise)); gl.addColorStop(1, rgba(T.brassHi, 0));
    ctx.fillStyle = gl; ctx.fillRect(kx - ks * 1.5, ky - ks * 1.5, ks * 3, ks * 3);
    ctx.save(); ctx.globalAlpha = rise; drawKeepsake(ctx, kind, kx, ky + Math.sin(t * 2) * bh * 0.012, ks); ctx.restore();
  }
  // lid, tilting up
  const ly = by - lift * bh * 0.55, lx = bx - bw * 0.02, lw = bw * 1.04;
  ctx.save(); ctx.translate(lx + lw / 2, ly + lidH); ctx.rotate(-lift * 0.045); ctx.translate(-(lx + lw / 2), -(ly + lidH));
  rr(ctx, lx, ly + 3, lw, lidH, bw * 0.03); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
  ctx.save(); rr(ctx, lx, ly, lw, lidH, bw * 0.03); ctx.clip();
  inlay(ctx, { x: lx, y: ly, w: lw, h: lidH }, 0, 2, false);
  const lg = ctx.createLinearGradient(0, ly, 0, ly + lidH); lg.addColorStop(0, 'rgba(255,255,255,0.3)'); lg.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = lg; ctx.fillRect(lx, ly, lw, lidH); ctx.restore();
  rr(ctx, lx, ly, lw, lidH, bw * 0.03); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(30,14,6,0.7)'; ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ================================================================ play ===================================================================
// The panel list of one face, in the shape drawFace wants.
export function facePanels(s, face) {
  const P = s.P, B = P.B, out = [];
  let lane = 0;
  for (let i = 0; i < B.n; i++) {
    if (B.face[i] !== face) continue;
    const d = s.drag && s.drag.i === i ? s.drag.off : 0;
    const held = s.held && s.held.i === i && s.held.t < 0.7 ? 1 - s.held.t / 0.7 : 0;
    out.push({
      lane, steps: B.k[i] - 1, vis: P.vis[i] + d, goal: B.goal[i], id: i,
      lift: s.drag && s.drag.i === i ? 1 : 0,
      shake: s.prefs.calm ? 0 : held,
      locked: !!(s.held && s.held.i === i && s.held.t < 1.1),
      holder: !!(s.prefs.holders && s.held && s.held.by === i && s.held.t < 1.6),
      hint: !!(s.hint && s.hint.i === i),
      focus: s.focus === i,
      arrow: s.hint && s.hint.i === i ? s.hint.dir : 0,
      index: i,
    });
    lane += 1;
  }
  return out;
}
export function faceMeta(B, face) {
  let lanes = 0, steps = 0;
  for (let i = 0; i < B.n; i++) if (B.face[i] === face) { lanes += 1; steps = Math.max(steps, B.k[i] - 1); }
  return { lanes, T: steps + PANEL_W, vertical: face === 1 };
}

function drawPlay(ctx, s, w, h) {
  const T = theme(), P = s.P;
  if (!P) return;
  const B = P.B, nF = B.faces, coach = !!(s.hint || s.auto.on), fm = faceMeta(B, P.face), L = playLayout(w, h, fm.lanes, fm.T, fm.vertical, nF, coach);
  if (L.panel) { if (v3.on) panel(ctx, L.panel, { radius: 26, kind: 'side' }); else { rr(ctx, L.panel.x, L.panel.y, L.panel.w, L.panel.h, 26); ctx.fillStyle = T.panel; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke(); } }
  else if (v3.on) panel(ctx, { x: L.hud.x - 10, y: L.hud.y - 4, w: L.hud.w + 20, h: L.hud.h + 4 }, { radius: 20, kind: 'hud' });
  // header block
  const hud = L.hud, narrow = hud.w < 470, cx = hud.x + hud.w;
  const onMarks = B.goal.filter((g, i) => P.pos[i] === g).length;
  txt(ctx, P.title, hud.x + 4, hud.y + 26, { size: F(32), weight: 700, color: T.text, maxW: hud.w * 0.48, min: 14, serif: true });
  txt(ctx, P.sub, hud.x + 4, hud.y + 62, { size: F(22), weight: 500, color: T.dim, maxW: narrow ? hud.w - 8 : hud.w * 0.5, min: 12 });
  const open = onMarks === B.n;
  txt(ctx, open ? 'Open' : `${onMarks} of ${B.n} on marks`, cx - 4, hud.y + 26, { size: F(30), weight: 700, color: open ? T.good : T.accent, align: 'right', maxW: hud.w * 0.42, min: 15 });
  const mv = `Moves ${P.moves}  ·  Par ${B.par}`;
  if (narrow) txt(ctx, mv, hud.x + 4, hud.y + 96, { size: F(24), weight: 600, color: T.text, maxW: hud.w - 8, min: 12 });
  else txt(ctx, mv, cx - 4, hud.y + 62, { size: F(22), weight: 500, color: T.dim, align: 'right', maxW: hud.w * 0.45, min: 12 });
  // the face (a turn squeezes it like a box being rotated)
  const t = s.turn;
  if (v3.on) {
    const G = L.face, ps = facePanels(s, P.face);
    ctx.save();
    for (const p of ps) {
      if (!p.locked) continue;
      const r = G.panel(p.lane, p.vis), c = v3.proj ? v3.proj(r.x + r.w / 2, r.y + r.h / 2, 0.45) : { x: r.x + r.w / 2, y: r.y + r.h / 2 }, a = G.S * 0.26;
      ctx.lineWidth = Math.max(2.5, G.S * 0.07); ctx.strokeStyle = T.accent; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(c.x, c.y - a * 0.6, a * 0.55, Math.PI, 0, false); ctx.stroke();
      rr(ctx, c.x - a * 0.8, c.y - a * 0.35, a * 1.6, a * 1.2, a * 0.25); ctx.fillStyle = T.accent; ctx.fill();
    }
    ctx.restore();
  } else if (t) {
    const k = clamp(t.t / t.dur, 0, 1), first = k < 0.5, face = first ? t.from : t.to, m2 = faceMeta(B, face);
    const G = faceGeo(L.area, m2.lanes, m2.T, m2.vertical), sx = Math.max(0.04, first ? 1 - k * 2 : (k - 0.5) * 2), cxm = L.area.x + L.area.w / 2;
    ctx.save(); ctx.translate(cxm, 0); ctx.scale(sx, 1); ctx.translate(-cxm, 0);
    drawFace(ctx, G, facePanels(s, face), { t: s.t });
    ctx.fillStyle = `rgba(0,0,0,${0.5 * (1 - sx)})`; rr(ctx, G.box.x, G.box.y, G.box.w, G.box.h, G.S * 0.42); ctx.fill();
    ctx.restore();
  } else {
    drawFace(ctx, L.face, facePanels(s, P.face), { t: s.t, win: P.done ? 1 : 0 });
  }
  if (!v3.on) for (const sp of s.sparks) {
    const k = 1 - sp.t / sp.life;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 2 + 5 * k, 0, TAU); ctx.fillStyle = `rgba(255,236,170,${clamp(k, 0, 1)})`; ctx.fill();
  }
  // face tabs
  if (L.tabs) {
    for (let f = 0; f < nF; f++) {
      const r = L.tabRects[f], cnt = B.goal.reduce((a, g, i) => a + (B.face[i] === f && P.pos[i] === g ? 1 : 0), 0), tot = B.face.filter((x) => x === f).length;
      const active = f === P.face, note = (s.held && B.face[s.held.by] === f && s.held.t < 1.6 && s.prefs.holders) || (s.hint && s.hint.face === f && f !== P.face);
      const pulse = note ? 0.5 + 0.5 * Math.sin(s.t * 9) : 0;
      button(ctx, r, FACE_NAMES[f], { size: 26, active, sub: `${cnt} of ${tot} on marks`, flash: Math.max(flashOf(s, 'tab' + f), pulse * 0.6), radius: 16 });
      if (note) { ctx.beginPath(); ctx.arc(r.x + r.w - 16, r.y + 16, 6, 0, TAU); ctx.fillStyle = T.accent; ctx.fill(); }
    }
  }
  // buttons
  const b = L.btns;
  if (s.auto.on) {
    button(ctx, b.a, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
    button(ctx, b.b, s.auto.paused ? 'Resume' : 'Pause', { icon: s.auto.paused ? 'play' : 'pause', size: 26, kind: s.auto.paused ? 'accent' : 'solid', flash: flashOf(s, 'apause') });
    button(ctx, b.c, 'Faster', { icon: 'minus', size: 24, flash: flashOf(s, 'adec') });
    button(ctx, b.d, 'Slower', { icon: 'plus', size: 24, flash: flashOf(s, 'ainc') });
  } else {
    button(ctx, b.a, 'Undo', { icon: 'undo', size: 26, disabled: !P.undo.length, flash: flashOf(s, 'undo') });
    button(ctx, b.b, 'Reset', { icon: 'erase', size: 26, flash: flashOf(s, 'reset') });
    button(ctx, b.c, 'Think', { icon: 'bulb', size: 26, kind: 'accent', flash: flashOf(s, 'hint') });
    button(ctx, b.d, 'Menu', { icon: 'pause', size: 26, flash: flashOf(s, 'pause') });
  }
  if (coach) drawCoach(ctx, s, L);
  if (s.paused) drawPaused(ctx, s, w, h);
  drawMsg(ctx, s, L);
}
function drawCoach(ctx, s, L) {
  const T = theme(), c = L.coachR;
  if (!c) return;
  panel(ctx, c, { radius: 20, fill: T.dark ? 'rgba(20,10,8,0.9)' : 'rgba(255,252,243,0.96)', kind: 'coach' });
  const pad = 14, text = s.auto.on ? s.autoText : s.hint ? s.hint.text : '';
  let btnH = 0;
  if (!s.auto.on && s.hint) {
    btnH = L.coachBtns.close.h;
    button(ctx, L.coachBtns.close, 'Close', { size: 26, flash: flashOf(s, 'close') });
    button(ctx, L.coachBtns.go, 'Do it', { size: 26, kind: 'accent', flash: flashOf(s, 'go') });
  }
  if (s.auto.on) {
    const tag = s.auto.phase === 'think' ? 'Thinking...' : s.auto.phase === 'reveal' ? 'Slide this panel' : s.auto.paused ? 'Paused' : s.auto.done ? 'Finished' : 'Watching';
    txt(ctx, tag, c.x + pad, c.y + 22, { size: F(22), weight: 700, color: T.accent, maxW: c.w * 0.5, min: 12 });
    txt(ctx, `Think time ${s.thinkSecs}s`, c.x + c.w - pad, c.y + 22, { size: F(20), weight: 500, color: T.dim, align: 'right', maxW: c.w * 0.45, min: 11 });
  }
  const top = c.y + (s.auto.on ? 40 : pad), avail = c.h - (top - c.y) - pad - btnH - (btnH ? 8 : 0);
  let size = F(24), lines = wrap(ctx, text, c.w - pad * 2, size, 500);
  while (lines.length * size * 1.25 > avail && size > F(15)) { size -= 1; lines = wrap(ctx, text, c.w - pad * 2, size, 500); }
  para(ctx, text, c.x + pad, top, c.w - pad * 2, { size, weight: 500, color: T.text, lh: 1.25 });
}
function drawPaused(ctx, s, w, h) {
  const T = theme(), pl = pauseLayout(w, h);
  if (v3.on) {   // the dim has a hole where the (3D) card sits so the card stays lit
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.roundRect(pl.card.x, pl.card.y, pl.card.w, pl.card.h, 26); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill('evenodd'); ctx.restore();
  } else { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, h); }
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(34,16,12,0.97)' : 'rgba(255,252,243,0.98)', kind: 'card' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 46, { size: F(40), weight: 700, color: T.text, align: 'center', serif: true });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart box', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), fb = L.face.box;
  const w = Math.min(Math.max(fb.w, 300), 520), cx = fb.x + fb.w / 2, size = F(24), lines = wrap(ctx, m.text, w - 36, size, 600), hh = lines.length * size * 1.22 + 22;
  const y = fb.y + fb.h - hh - 10;
  ctx.save(); ctx.globalAlpha = a;
  if (v3.on) { if (a > 0.5) panel(ctx, { x: cx - w / 2, y, w, h: hh }, { radius: 18, kind: 'toast' }); }
  else { rr(ctx, cx - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(20,10,8,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke(); }
  para(ctx, m.text, cx - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ figures (about / how to / rules) ==========================================
export function figureData(kind, t) {
  if (kind === 'slide') {
    const ph = (Math.sin(t * 1.4) + 1) / 2;
    return { lanes: 3, steps: 2, vertical: false, panels: [{ lane: 0, steps: 2, vis: 1, goal: 1, id: 2 }, { lane: 1, steps: 2, vis: 0.15 + ph * 1.7, goal: 2, id: 7, arrow: 1 }, { lane: 2, steps: 2, vis: 0, goal: 1, id: 10 }] };
  }
  if (kind === 'held') {
    return { lanes: 3, steps: 2, vertical: false, panels: [{ lane: 0, steps: 2, vis: 0, goal: 1, id: 4, holder: true }, { lane: 1, steps: 2, vis: 1, goal: 2, id: 9, locked: true, shake: 0.6 }, { lane: 2, steps: 2, vis: 2, goal: 0, id: 13 }] };
  }
  return { lanes: 3, steps: 2, vertical: false, panels: [{ lane: 0, steps: 2, vis: 2, goal: 2, id: 3 }, { lane: 1, steps: 2, vis: 1, goal: 1, id: 8 }, { lane: 2, steps: 2, vis: 0, goal: 1, id: 12 }] };
}
export function drawFigure(ctx, r, kind, t) {
  if (v3.on) { panel(ctx, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 }, { radius: 24, kind: 'fig' }); v3.figure = { r: { x: r.x, y: r.y - v3.sy, w: r.w, h: r.h }, kind, t, clip: v3.clip, spec: figureData(kind, t) }; return; }
  const f = figureData(kind, t), G = faceGeo(r, f.lanes, f.steps + PANEL_W, f.vertical, 120);
  drawFace(ctx, G, f.panels, { t });
}

// ================================================================ title ==================================================================
// Title lettering on the carved sign: gold-leaf gradient, dark incised shadow, a thin highlight edge.
function lettering(ctx, s, x, y, size, maxW, accent) {
  const T = theme();
  let sz = size; setF(ctx, sz);
  while (ctx.measureText(s).width > maxW && sz > 12) { sz -= 1; setF(ctx, sz); }
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(s, x + sz * 0.035, y + sz * 0.06);
  const g = ctx.createLinearGradient(0, y - sz * 0.5, 0, y + sz * 0.5);
  if (accent) { g.addColorStop(0, '#ffe9a8'); g.addColorStop(0.5, T.brassHi); g.addColorStop(1, T.brassLo); } else { g.addColorStop(0, T.dark ? '#fffaf0' : '#3a2a18'); g.addColorStop(0.55, T.dark ? '#f1dcb0' : '#2c2015'); g.addColorStop(1, T.dark ? '#c9a566' : '#4a3520'); }
  ctx.fillStyle = g; ctx.fillText(s, x, y);
  ctx.lineWidth = Math.max(1, sz * 0.02); ctx.strokeStyle = T.dark ? 'rgba(255,248,220,0.5)' : 'rgba(255,255,255,0.55)'; ctx.strokeText(s, x, y - sz * 0.012);
  ctx.restore();
}
const setF = (ctx, sz) => { ctx.font = `700 ${sz}px ${SERIF}`; };
const HERO_STEPS = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0], [2, 1, 1], [2, 2, 1], [2, 2, 2], [1, 2, 2], [1, 1, 2], [0, 1, 2], [0, 0, 2]];
// The hero face of the title: where it sits and the sliding panels at time t (also used behind the Boxes / Rules / Settings pages).
export function titleHero(w, h) {
  const L = titleLayout(w, h), hero = L.hero;
  const H = hero.h, tb = Math.min(160, Math.max(66, H * 0.3)), side = Math.max(90, Math.min(hero.w * 0.82, H - tb - 16, 520));
  return { L, hero, tb, fr: R(hero.x + (hero.w - side) / 2, hero.y + Math.max(0, (H - side - tb) / 2), side, side) };
}
export function heroItems(t) {
  const ph = (t / 0.9) % (HERO_STEPS.length - 1), i0 = Math.floor(ph), f = smooth(ph - i0);
  const a = HERO_STEPS[i0], b = HERO_STEPS[Math.min(i0 + 1, HERO_STEPS.length - 1)];
  return [0, 1, 2].map((l) => ({ lane: l, steps: 2, vis: a[l] + (b[l] - a[l]) * f, goal: [2, 2, 2][l], id: [3, 8, 12][l] }));
}
function drawTitle(ctx, s, w, h) {
  const T = theme(), { L, hero, tb, fr } = titleHero(w, h); setBrandTone(T.dark);
  // the hero: a face whose panels slide in turn and then slide back
  const heroPanels = heroItems(s.t);
  const ty = fr.y + fr.h + tb * 0.45;
  if (v3.on) {
    v3.hero = { r: fr, panels: heroPanels };
    panel(ctx, { x: hero.x + hero.w * 0.04, y: ty - tb * 0.4, w: hero.w * 0.92, h: tb * 0.98 }, { radius: 22, kind: 'sign' });
    lettering(ctx, 'SECRET', hero.x + hero.w / 2, ty, tb * 0.46, hero.w * 0.86, false);
    lettering(ctx, 'PUZZLE BOX', hero.x + hero.w / 2, ty + tb * 0.42, tb * 0.28, hero.w * 0.8, true);
  } else {
    drawFace(ctx, faceGeo(fr, 3, 2 + PANEL_W, false, 200), heroPanels, { t: s.t });
    txt(ctx, 'SECRET', hero.x + hero.w / 2, ty, { size: tb * 0.46, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.94, min: 24, serif: true });
    txt(ctx, 'PUZZLE BOX', hero.x + hero.w / 2, ty + tb * 0.42, { size: tb * 0.28, weight: 700, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 14, serif: true });
  }
  const B = L.buttons, lab = {
    play: [s.hasSave ? 'Continue' : 'Play', s.playInfo], levels: ['Boxes', `${s.doneCount} of ${LEVELS.length} opened`], daily: ['Daily Box', s.dailyInfo],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear' };
  for (const id of Object.keys(B)) {
    const prim = id === 'play' || id === 'levels' || id === 'daily' || id === 'learn', r = B[id];
    button(ctx, r, lab[id][0], { kind: id === 'play' ? 'accent' : 'solid', size: prim ? 32 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: id === 'learn' ? 'eye' : iconOf[id] ?? '' });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ pages =================================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(44), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20, serif: true });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  v3.clip = { x: rect.x - 6, y: rect.y, w: rect.w + 12, h: rect.h }; v3.sy = s.scrollY;
  const ch = draw();
  v3.clip = null; v3.sy = 0;
  ctx.restore();
  metrics.max = Math.max(0, ch - rect.h); metrics.view = rect.h; metrics.rect = rect;
  if (metrics.max > 0) {
    const T = theme(), bx = rect.x + rect.w + 4, th = Math.max(40, rect.h * rect.h / ch), ty = rect.y + (rect.h - th) * clamp(s.scrollY / metrics.max, 0, 1);
    rr(ctx, bx, rect.y, 6, rect.h, 3); ctx.fillStyle = 'rgba(128,128,128,0.2)'; ctx.fill();
    rr(ctx, bx, ty, 6, th, 3); ctx.fillStyle = T.accent; ctx.fill();
  }
}

function drawLevels(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), LL = levelsLayout(w, h, LEVELS.length);
  header(ctx, s, LL, 'Boxes');
  if (v3.on) panel(ctx, { x: LL.body.x - 10, y: LL.body.y - 6, w: LL.body.w + 20, h: LL.body.h + 12 }, { radius: 26, kind: 'doc' });
  scrollBody(ctx, s, LL.body, () => {
    LEVELS.forEach((lv, i) => {
      const r = LL.tiles[i], stars = s.stars[i] ?? 0, open = i <= s.unlocked || s.dev;
      if (v3.on) panel(ctx, r, { radius: 18, kind: open ? (stars > 0 ? 'tileDone' : 'tile') : 'tileOff' });
      else {
        rr(ctx, r.x, r.y, r.w, r.h, 18);
        ctx.fillStyle = open ? mix(T.plate0, T.plate1, 0.4) : 'rgba(128,128,128,0.18)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = open ? T.plateEdge : T.line; ctx.stroke();
      }
      txt(ctx, String(i + 1), r.x + r.w / 2, r.y + r.h * 0.3, { size: F(Math.min(48, r.w * 0.36)), weight: 700, color: open ? T.groove : T.dim, align: 'center', maxW: r.w - 10, min: 14, serif: true });
      txt(ctx, `${lv.n} panels`, r.x + r.w / 2, r.y + r.h * 0.55, { size: F(Math.min(24, r.w * 0.18)) * Math.min(sc, 1.4), weight: 600, color: open ? T.groove : T.dim, align: 'center', maxW: r.w - 10, min: 11 });
      for (let k = 0; k < 3; k++) icons.star(ctx, r.x + r.w / 2 + (k - 1) * Math.min(26, r.w * 0.22), r.y + r.h * 0.82, Math.min(26, r.w * 0.22), k < stars ? '#e8a21a' : 'rgba(80,50,20,0.25)');
      if (stars > 0) drawKeepsake(ctx, KEEPSAKES[i % KEEPSAKES.length], r.x + r.w - r.w * 0.2, r.y + r.w * 0.2, r.w * 0.28);
      if (!open && !v3.on) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill(); }
    });
    return LL.contentH;
  });
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s);
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const textR = DL.text, figR = DL.fig;
  if (v3.on) panel(ctx, { x: textR.x - 12, y: textR.y - 6, w: textR.w + 24, h: textR.h + 12 }, { radius: 26, kind: 'doc' });
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(38) * sc, weight: 700, color: T.accent, maxW: width, min: 16, serif: true }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p) y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc;
      else if (b.h) y += para(ctx, b.h, x, y, width, { size: F(32) * sc, weight: 700, color: T.text }) + 8 * sc;
      else if (b.li) for (const it of b.li) {
        const sz = F(27) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 400, color: T.text, lh: 1.3 }) + 10 * sc;
      }
    }
    return y - top + 20;
  };
  if (DL.split) {
    if (page.fig) drawFigure(ctx, figR, page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w - 20, Math.max(240, textR.h * (sc > 1.6 ? 0.35 : 0.5)), 460), fr = R(textR.x + (textR.w - fh) / 2, y, fh, fh);
        drawFigure(ctx, fr, page.fig, s.t); y += fh + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = settingsLayout(w, h, sc, settingsList(s).length);
  header(ctx, s, SL, 'Settings');
  if (v3.on) panel(ctx, { x: SL.body.x - 10, y: SL.body.y - 6, w: SL.body.w + 20, h: SL.body.h + 12 }, { radius: 26, kind: 'doc' });
  scrollBody(ctx, s, SL.body, () => {
    settingsList(s).forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20, kind: 'row' });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], row.id === 'restore' ? (s.restoreMsg || (s.owned ? 'Full game unlocked' : 'Restore purchase')) : o, { size: 24 * Math.min(sc, 1.7), active: k === cur && row.id !== 'restore', radius: 14, kind: row.id === 'restore' ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

function drawOver(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), sc = Math.min(scaleOf(s), 1.5), O = overLayout(w, h), R0 = s.result;
  if (!R0) return;
  const c = O.card;
  if (v3.on) v3.open = { field: O.field, k: clamp(s.sceneT / 1.6, 0, 1), kind: R0.keep };
  else drawOpenBox(ctx, O.field, clamp(s.sceneT / 1.6, 0, 1), R0.keep, s.t);
  panel(ctx, c, { radius: 28, fill: T.dark ? 'rgba(34,16,12,0.96)' : 'rgba(255,252,243,0.97)', kind: 'card' }); edgeStroke(ctx, c, 28, 0.5);
  const small = c.h < 420, tsz = small ? 34 : 44, sz = small ? 36 : 56;
  let y = c.y + (small ? 14 : 26);
  txt(ctx, R0.daily ? 'Daily Box open' : 'The drawer is open', c.x + c.w / 2, y + tsz * 0.6, { size: F(tsz) * sc, weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 20, serif: true }); y += (tsz + 14) * Math.min(sc, 1.3);
  for (let k = 0; k < 3; k++) icons.star(ctx, c.x + c.w / 2 + (k - 1) * (sz + 12), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
  y += sz + (small ? 8 : 16);
  const lines = [`Inside: ${KEEPSAKE_NAMES[R0.keep]}`, `${R0.moves} move${R0.moves === 1 ? '' : 's'}  ·  par ${R0.par}`, R0.hints ? `Think used ${R0.hints} time${R0.hints === 1 ? '' : 's'}` : 'No Think used'];
  if (R0.daily) lines.push(`Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`);
  else if (R0.first) lines.push('Next box unlocked');
  const avail = O.next.y - 8 - y, step = Math.min(40 * sc, avail / lines.length), fs = Math.min(F(26) * sc, step * 0.78);
  for (const ln of lines) { txt(ctx, ln, c.x + c.w / 2, y + step / 2, { size: fs, weight: 500, color: T.dim, align: 'center', maxW: c.w - 40, min: 11 }); y += step; }
  button(ctx, O.next, R0.daily ? 'Back to menu' : R0.last ? 'Boxes' : 'Next box', { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.again, 'Share', { size: 26, flash: flashOf(s, 'share') });
  button(ctx, O.menu, R0.daily ? 'Boxes' : 'Menu', { size: 26, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, c.x + c.w / 2, Math.min(c.y + c.h + 26, h - 8), 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28, kind: 'card' }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18, serif: true });
  para(ctx, 'The full game has all thirty boxes, the Daily Box, Think help and Watch and Learn. Get Secret Puzzle Box on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
