// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, levelsLayout, overLayout, pauseLayout, centerCard, TEXT_SCALES, host, R, clamp, grid, fieldGeo } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, wrap, F, mix, rgba, icons } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { topo, trace, walk, isDot, strutOf, findSingle, seeded, loopCount } from './mirror.js';
import { DOCS } from './content.js';
import { LEVELS, TIER_NAMES, tierOf } from './levels.js';
import { v3 } from './v3.js';

export const metrics = { max: 0, view: 0, rect: null };
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'struts', label: 'Show struts', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
export const rowsOf = (s) => (s.demo ? SETTINGS.filter((r) => r.id !== 'restore') : SETTINGS);
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'struts': return p.struts ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return 0;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
const PI = Math.PI, TAU = Math.PI * 2;

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  v3.dark = T.dark; v3.scene = s.scene; v3.fieldRect = null; v3.heroRect = null; v3.clip = null; v3.offY = 0;
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
  if (s.sceneT < 0.25 && sc !== 'play' && !v3.on) { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ line geometry ===========================================================
// Side-middle id -> position in cell units.
function nodeXY(W, H, id) {
  const hN = (H + 1) * W;
  if (id < hN) return [(id % W) + 0.5, Math.floor(id / W)];
  const k = id - hN, c = k % (W + 1), r = Math.floor(k / (W + 1));
  return [c, r + 0.5];
}
// Build every arc of a configuration. Each arc: node ids a/b, centre (cell units), start/end angle, sweep direction.
const arcCache = new Map();
export function buildArcs(W, H, cfg) {
  const key = `${W}x${H}:${cfg.join('')}`;
  let out = arcCache.get(key);
  if (out) return out;
  const T = topo(W, H), arcs = [], quarter = (cell, a, b, cx, cy, p, q) => {
    let d = ((q - p + 3 * PI) % TAU) - PI;   // shortest signed sweep
    arcs.push({ cell, a, b, cx, cy, p, d });
  };
  for (let i = 0; i < W * H; i++) {
    const r = Math.floor(i / W), c = i % W, [N, S, Wt, E] = T.sides[i];
    if (cfg[i] === 0) { quarter(i, N, Wt, c, r, 0, PI / 2); quarter(i, S, E, c + 1, r + 1, PI, PI * 1.5); }
    else { quarter(i, N, E, c + 1, r, PI, PI / 2); quarter(i, S, Wt, c, r + 1, 0, -PI / 2); }
  }
  for (const [a, b] of T.pairs) {
    const [ax, ay] = nodeXY(W, H, a), [bx, by] = nodeXY(W, H, b);
    let vx = 0, vy = 0;
    for (const [cx, cy] of [[Math.round(ax - 0.5), Math.round(ay)], [Math.round(ax + 0.5), Math.round(ay)], [Math.round(ax), Math.round(ay - 0.5)], [Math.round(ax), Math.round(ay + 0.5)]]) {
      if (Math.abs(Math.hypot(ax - cx, ay - cy) - 0.5) < 1e-6 && Math.abs(Math.hypot(bx - cx, by - cy) - 0.5) < 1e-6) { vx = cx; vy = cy; break; }
    }
    const pa = Math.atan2(ay - vy, ax - vx), pb = Math.atan2(by - vy, bx - vx);
    let cw = (pb - pa) % TAU; if (cw < 0) cw += TAU;
    // choose the sweep whose middle lies outside the field
    const midOut = (d) => { const m = pa + d / 2, x = vx + Math.cos(m) * 0.5, y = vy + Math.sin(m) * 0.5; return x < -1e-6 || y < -1e-6 || x > W + 1e-6 || y > H + 1e-6; };
    const d = midOut(cw) ? cw : cw - TAU;
    arcs.push({ cell: -1, a, b, cx: vx, cy: vy, p: pa, d });
  }
  const byPair = new Map();
  arcs.forEach((a) => byPair.set(a.a < a.b ? a.a * 100000 + a.b : a.b * 100000 + a.a, a));
  out = { arcs, byPair };
  if (arcCache.size > 40) arcCache.clear();
  arcCache.set(key, out);
  return out;
}
// The closed line(s) as a polyline in cell units, with cumulative length, for the travelling light.
const pathCache = new Map();
export function loopPaths(W, H, cfg) {
  const key = `${W}x${H}:${cfg.join('')}`;
  let out = pathCache.get(key);
  if (out) return out;
  const { byPair } = buildArcs(W, H, cfg);
  out = walk(W, H, cfg).map((nodes) => {
    const pts = [];
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i], b = nodes[(i + 1) % nodes.length], arc = byPair.get(a < b ? a * 100000 + b : b * 100000 + a);
      if (!arc) continue;
      const fwd = arc.a === a;
      for (let k = 0; k < 8; k++) { const t = k / 8, ang = fwd ? arc.p + arc.d * t : arc.p + arc.d * (1 - t); pts.push([arc.cx + Math.cos(ang) * 0.5, arc.cy + Math.sin(ang) * 0.5]); }
    }
    const cum = [0];
    for (let i = 1; i <= pts.length; i++) { const p = pts[i - 1], q = pts[i % pts.length]; cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
    return { pts, cum, len: cum[cum.length - 1] };
  });
  if (pathCache.size > 40) pathCache.clear();
  pathCache.set(key, out);
  return out;
}

// ================================================================ the field ==================================================================
function arcPath(ctx, G, a, shift = 0) {
  ctx.beginPath();
  ctx.arc(G.ox + a.cx * G.S + shift, G.oy + a.cy * G.S + shift, G.S * 0.5, a.p, a.p + a.d, a.d < 0);
}
const hash = (i) => { let x = (i * 2654435761) >>> 0; x = (x ^ (x >>> 15)) >>> 0; return (x % 10000) / 10000; };

// The raked sand tray the field lies in: fills the free room on tall or wide screens so no band is left empty.
export function drawTray(ctx, area, box) {
  if (v3.on) return;
  if (area.h - box.h < 36 && area.w - box.w < 36) return;
  const T = theme(), x = area.x, y = area.y, w = area.w, h = area.h, r = Math.min(34, w * 0.05);
  ctx.save();
  rr(ctx, x, y, w, h, r); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, mix(T.sand0, '#2a1708', 0.42)); g.addColorStop(1, mix(T.sand1, '#1c0f05', 0.5));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // raked grooves, gently bending round the field
  const step = Math.max(10, Math.min(18, h / 40));
  for (let yy = y + step * 0.5; yy < y + h; yy += step) {
    ctx.beginPath();
    for (let xx = x; xx <= x + w + 8; xx += 8) {
      const d = (xx - (box.x + box.w / 2)) / (box.w * 0.9), near = Math.max(0, 1 - Math.abs(yy - (box.y + box.h / 2)) / (box.h * 0.8));
      const bend = Math.exp(-d * d) * near * step * 0.6 * Math.sign(yy - (box.y + box.h / 2));
      const py = yy + bend + Math.sin(xx * 0.03 + yy * 0.05) * 0.9;
      if (xx === x) ctx.moveTo(xx, py); else ctx.lineTo(xx, py);
    }
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.stroke();
    ctx.translate(0, 2); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,230,180,0.12)'; ctx.stroke(); ctx.translate(0, -2);
  }
  const n = Math.min(500, Math.round(w * h / 2200));
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,240,200,0.14)' : 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(x + hash(i * 3 + 5) * w, y + hash(i * 3 + 6) * h, 0.8 + hash(i + 301) * 1.3, 0, TAU); ctx.fill(); }
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.lineWidth = 3; ctx.strokeStyle = T.sandEdge; ctx.stroke();
}

// opts: { locked, t, win (0..1 celebration), hintCell, focus, pop: Map cell->age, struts, calm }
export function drawField(ctx, G, W, H, cfg, opts = {}) {
  if (v3.on && !opts.flat) return;
  const T = theme(), S = G.S, { box } = G, tr = trace(W, H, cfg), single = tr.count === 1, t = opts.t ?? 0;
  // sand plate
  ctx.save();
  rr(ctx, box.x + 3, box.y + 6, box.w, box.h, S * 0.34); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  g.addColorStop(0, T.sand0); g.addColorStop(1, T.sand1);
  rr(ctx, box.x, box.y, box.w, box.h, S * 0.34); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(2, S * 0.05); ctx.strokeStyle = T.sandEdge; ctx.stroke();
  ctx.clip();
  // grain: a few hundred deterministic specks, so the sand reads as sand
  const n = Math.min(520, Math.round(box.w * box.h / 900));
  for (let i = 0; i < n; i++) {
    const x = box.x + hash(i * 2 + 1) * box.w, y = box.y + hash(i * 2 + 2) * box.h, r = 0.7 + hash(i + 77) * 1.5;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.28)' : 'rgba(90,55,20,0.16)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // faint tile lines
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(90,55,20,0.13)';
  ctx.beginPath();
  for (let c = 0; c <= W; c++) { ctx.moveTo(G.ox + c * S, G.oy); ctx.lineTo(G.ox + c * S, G.oy + H * S); }
  for (let r = 0; r <= H; r++) { ctx.moveTo(G.ox, G.oy + r * S); ctx.lineTo(G.ox + W * S, G.oy + r * S); }
  ctx.stroke();
  // stone slabs on the fixed tiles
  if (opts.locked) for (let i = 0; i < W * H; i++) if (opts.locked[i]) {
    const x = G.ox + (i % W) * S, y = G.oy + Math.floor(i / W) * S, p = S * 0.1;
    rr(ctx, x + p, y + p + S * 0.04, S - 2 * p, S - 2 * p, S * 0.18); ctx.fillStyle = 'rgba(40,24,10,0.35)'; ctx.fill();
    const sg = ctx.createLinearGradient(0, y + p, 0, y + S - p);
    sg.addColorStop(0, mix(T.sand1, '#8a7a6a', 0.55)); sg.addColorStop(1, mix(T.sand1, '#4a3d33', 0.6));
    rr(ctx, x + p, y + p, S - 2 * p, S - 2 * p, S * 0.18); ctx.fillStyle = sg; ctx.fill();
    ctx.lineWidth = Math.max(1.5, S * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
  }
  // struts
  if (opts.struts) {
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, S * 0.07); ctx.strokeStyle = T.strut;
    ctx.beginPath();
    for (let i = 0; i < W * H; i++) {
      if (!strutOf(W, i, cfg[i])) continue;
      const r = Math.floor(i / W), c = i % W, x = G.ox + c * S, y = G.oy + r * S;
      if (cfg[i] === 0) { ctx.moveTo(x + S, y); ctx.lineTo(x, y + S); } else { ctx.moveTo(x, y); ctx.lineTo(x + S, y + S); }
    }
    ctx.stroke();
  }
  // the line
  const { arcs } = buildArcs(W, H, cfg), pal = T.loops, lw = S * 0.13 * (opts.lineK || 1);
  ctx.lineCap = 'round';
  const pass = (fn) => { for (const a of arcs) { arcPath(ctx, G, a, fn.shift ?? 0); fn(a); } };
  pass(Object.assign((a) => { ctx.lineWidth = lw * 1.35; ctx.strokeStyle = 'rgba(40,22,8,0.26)'; ctx.stroke(); }, { shift: S * 0.03 }));
  pass((a) => {
    const pop = a.cell >= 0 && opts.pop ? opts.pop.get(a.cell) : undefined, k = pop !== undefined ? 1 + 0.7 * Math.max(0, 1 - pop / 0.3) : 1;
    ctx.lineWidth = lw * k;
    ctx.strokeStyle = single ? T.groove : pal[tr.comp[a.a] % pal.length];
    ctx.stroke();
  });
  pass(Object.assign((a) => { ctx.lineWidth = Math.max(1.5, lw * 0.28); ctx.strokeStyle = T.ridge; ctx.stroke(); }, { shift: -S * 0.025 }));
  // dots
  for (let r = 0; r <= H; r++) for (let c = 0; c <= W; c++) {
    if (!isDot(r, c)) continue;
    const x = G.ox + c * S, y = G.oy + r * S, rad = S * 0.15;
    ctx.beginPath(); ctx.arc(x + S * 0.015, y + S * 0.03, rad * 1.05, 0, TAU); ctx.fillStyle = 'rgba(40,22,8,0.35)'; ctx.fill();
    const rg = ctx.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.1, x, y, rad);
    rg.addColorStop(0, T.dot); rg.addColorStop(1, single ? mix(T.dotCore, T.gold, 0.55) : T.dotCore);
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fillStyle = rg; ctx.fill();
  }
  // celebration: the closed line turns gold and a light runs round it
  if (single && opts.win !== undefined) {
    const k = clamp(opts.win, 0, 1), loops = loopPaths(W, H, cfg), L = loops[0];
    if (L && L.pts.length) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); L.pts.forEach(([x, y], i) => { const px = G.ox + x * S, py = G.oy + y * S; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.closePath();
      ctx.lineWidth = lw * 2.4; ctx.strokeStyle = rgba(T.gold, 0.18 * k); ctx.stroke();
      ctx.lineWidth = lw * 0.9; ctx.strokeStyle = rgba(T.gold, 0.95 * k); ctx.stroke();
      const head = ((t * 0.16) % 1) * L.len;
      for (let tail = 0; tail < 6; tail++) {
        const d = (head - tail * L.len * 0.012 + L.len) % L.len;
        let lo = 0, hi = L.cum.length - 1;
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.cum[m] <= d) lo = m; else hi = m; }
        const p = L.pts[lo % L.pts.length], q = L.pts[(lo + 1) % L.pts.length], f = (d - L.cum[lo]) / Math.max(1e-6, L.cum[lo + 1] - L.cum[lo]);
        const x = G.ox + (p[0] + (q[0] - p[0]) * f) * S, y = G.oy + (p[1] + (q[1] - p[1]) * f) * S;
        ctx.beginPath(); ctx.arc(x, y, S * (0.16 - tail * 0.02), 0, TAU); ctx.fillStyle = `rgba(255,252,230,${k * (1 - tail * 0.16)})`; ctx.fill();
      }
    }
  }
  // hint / cursor
  const ring = (i, col, wd, pulse) => {
    const x = G.ox + (i % W) * S, y = G.oy + Math.floor(i / W) * S, p = S * 0.05 - pulse * S * 0.02;
    rr(ctx, x + p, y + p, S - 2 * p, S - 2 * p, S * 0.18); ctx.lineWidth = wd; ctx.strokeStyle = col; ctx.stroke();
  };
  if (opts.hintCell >= 0 && opts.hintCell !== undefined) { const pulse = 0.5 + 0.5 * Math.sin(t * 5); ring(opts.hintCell, T.accent, Math.max(3, S * 0.07), pulse); rr(ctx, G.ox + (opts.hintCell % W) * S, G.oy + Math.floor(opts.hintCell / W) * S, S, S, S * 0.18); ctx.fillStyle = rgba(T.accent, 0.12 + 0.1 * pulse); ctx.fill(); }
  if (opts.focus >= 0 && opts.focus !== undefined) ring(opts.focus, 'rgba(255,255,255,0.8)', 2, 0);
  ctx.restore();
}

// ================================================================ play ===================================================================
function drawPlay(ctx, s, w, h) {
  const T = theme(), P = s.P;
  if (!P) return;
  const coach = !!(s.hint || s.auto.on), L = playLayout(w, h, P.L.W, P.L.H, coach), W = P.L.W, H = P.L.H;
  if (L.panel) { rr(ctx, L.panel.x, L.panel.y, L.panel.w, L.panel.h, 26); ctx.fillStyle = T.panel; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke(); }
  const tr = trace(W, H, P.cfg), single = tr.count === 1;
  // header block
  const hud = L.hud;
  const narrow = hud.w < 470, cx = hud.x + hud.w;
  txt(ctx, P.title, hud.x + 4, hud.y + 26, { size: F(32), weight: 700, color: T.text, maxW: hud.w * 0.58, min: 16 });
  txt(ctx, P.sub, hud.x + 4, hud.y + 62, { size: F(22), weight: 500, color: T.dim, maxW: narrow ? hud.w - 8 : hud.w * 0.5, min: 12 });
  txt(ctx, single ? 'One line' : `${tr.count} loops`, cx - 4, hud.y + 26, { size: F(34), weight: 700, color: single ? T.good : T.accent, align: 'right', maxW: hud.w * 0.4, min: 16 });
  const mv = `Moves ${P.moves}  ·  Par ${P.L.par}`;
  if (narrow) txt(ctx, mv, hud.x + 4, hud.y + 96, { size: F(24), weight: 600, color: T.text, maxW: hud.w - 8, min: 12 });
  else txt(ctx, mv, cx - 4, hud.y + 62, { size: F(22), weight: 500, color: T.dim, align: 'right', maxW: hud.w * 0.45, min: 12 });
  // the field
  const pops = new Map(); for (const [c, age] of s.pop) pops.set(c, age);
  const winK = s.winT > 0 || P.done ? smooth(clamp(1 - s.winT / 1.2, 0, 1)) : undefined;
  v3.fieldRect = L.area;
  drawTray(ctx, L.area, L.field.box);
  drawField(ctx, L.field, W, H, P.cfg, { locked: P.L.locked, t: s.t, win: P.done ? 1 : undefined, hintCell: s.hint ? s.hint.cell : -1, focus: s.focus, pop: pops, struts: s.prefs.struts });
  // buttons
  const B = L.btns;
  if (s.auto.on) {
    button(ctx, B.a, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
    button(ctx, B.b, s.auto.paused ? 'Resume' : 'Pause', { icon: s.auto.paused ? 'play' : 'pause', size: 26, kind: s.auto.paused ? 'accent' : 'solid', flash: flashOf(s, 'apause') });
    button(ctx, B.c, 'Faster', { icon: 'minus', size: 24, flash: flashOf(s, 'adec'), sub: '' });
    button(ctx, B.d, 'Slower', { icon: 'plus', size: 24, flash: flashOf(s, 'ainc') });
  } else {
    button(ctx, B.a, 'Undo', { icon: 'undo', size: 26, disabled: !P.undo.length, flash: flashOf(s, 'undo') });
    button(ctx, B.b, 'Reset', { icon: 'erase', size: 26, flash: flashOf(s, 'reset') });
    button(ctx, B.c, 'Think', { icon: 'bulb', size: 26, kind: 'accent', flash: flashOf(s, 'hint') });
    button(ctx, B.d, 'Menu', { icon: 'pause', size: 26, flash: flashOf(s, 'pause') });
  }
  if (coach) drawCoach(ctx, s, L);
  if (s.paused) drawPaused(ctx, s, w, h);
  drawMsg(ctx, s, L);
}
function drawCoach(ctx, s, L) {
  const T = theme(), c = L.coachR;
  if (!c) return;
  panel(ctx, c, { radius: 20, fill: T.dark ? 'rgba(20,12,6,0.9)' : 'rgba(255,252,243,0.96)' });
  const pad = 14, text = s.auto.on ? s.autoText : s.hint ? s.hint.text : '';
  let btnH = 0;
  if (!s.auto.on && s.hint) {
    btnH = 56;
    const bw = (c.w - pad * 2 - 10) / 2, y = c.y + c.h - pad - btnH;
    button(ctx, R(c.x + pad, y, bw, btnH), 'Close', { size: 24, flash: flashOf(s, 'close') });
    button(ctx, R(c.x + pad + bw + 10, y, bw, btnH), 'Do it', { size: 24, kind: 'accent', flash: flashOf(s, 'go') });
  }
  if (s.auto.on) {
    const tag = s.auto.phase === 'think' ? 'Thinking...' : s.auto.phase === 'reveal' ? 'Turn this tile' : s.auto.paused ? 'Paused' : s.auto.done ? 'Finished' : 'Watching';
    txt(ctx, tag, c.x + pad, c.y + 22, { size: F(22), weight: 700, color: T.accent, maxW: c.w * 0.5, min: 12 });
    txt(ctx, `Think time ${s.thinkSecs}s`, c.x + c.w - pad, c.y + 22, { size: F(20), weight: 500, color: T.dim, align: 'right', maxW: c.w * 0.45, min: 11 });
  }
  const top = c.y + (s.auto.on ? 40 : pad), avail = c.h - (top - c.y) - pad - btnH - (btnH ? 8 : 0);
  let size = F(30), lines = wrap(ctx, text, c.w - pad * 2, size, 500);
  while (lines.length * size * 1.25 > avail && size > F(15)) { size -= 1; lines = wrap(ctx, text, c.w - pad * 2, size, 500); }
  para(ctx, text, c.x + pad, top, c.w - pad * 2, { size, weight: 500, color: T.text, lh: 1.25 });
}
function drawPaused(ctx, s, w, h) {
  const T = theme(), pl = pauseLayout(w, h);
  if (v3.on) v3.scrim = 0.6; else { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, h); }
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(30,18,9,0.97)' : 'rgba(255,252,243,0.98)' });
  if (!v3.on) edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 46, { size: F(40), weight: 700, color: T.text, align: 'center' });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart level', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), fb = L.field.box;
  const w = Math.min(fb.w, 520), cx = fb.x + fb.w / 2, size = F(24), lines = wrap(ctx, m.text, w - 36, size, 600), hh = lines.length * size * 1.22 + 22;
  const y = fb.y + fb.h - hh - 10;
  ctx.save(); ctx.globalAlpha = a;
  if (v3.on) v3.panels.push({ r: { x: cx - w / 2, y, w, h: hh }, rad: 18, kind: 'panel', dark: T.dark, clip: null });
  else { rr(ctx, cx - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(20,12,6,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke(); }
  para(ctx, m.text, cx - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ figures (about / how to / rules) ==========================================
export function figureCfg(kind) {
  if (kind === 'solved') return { W: 4, H: 4, cfg: [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0], solved: true };
  if (kind === 'loops') return { W: 3, H: 3, cfg: [0, 0, 1, 1, 0, 0, 0, 1, 1] };
  return { W: 3, H: 3, cfg: [1, 0, 1, 0, 1, 0, 1, 0, 1] };
}
export function drawFigure(ctx, r, kind, t) {
  const f = figureCfg(kind), G = fieldGeo(r, f.W, f.H, 120);
  drawField(ctx, G, f.W, f.H, f.cfg, { t, struts: true, flat: true, win: f.solved && trace(f.W, f.H, f.cfg).count === 1 ? 1 : undefined });
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(160, Math.max(66, H * 0.3)), side = Math.max(90, Math.min(hero.w * 0.7, H - tb - 16, 460));
  const fr = R(hero.x + (hero.w - side) / 2, hero.y + Math.max(0, (H - side - tb) / 2), side, side);
  // the hero is a slowly self-solving little field: it flips tiles on a timer so the line keeps re-forming
  const cfg = heroCfg(s.t);
  const G = fieldGeo(fr, 5, 5, 200);
  v3.heroRect = R(hero.x, hero.y, hero.w, Math.max(120, H - tb * 0.7)); v3.heroCfg = cfg;
  drawField(ctx, G, 5, 5, cfg, { t: s.t, win: trace(5, 5, cfg).count === 1 ? 1 : undefined });
  const ty = fr.y + fr.h + tb * 0.45;
  if (v3.on) { const ty2 = hero.y + hero.h - tb * 0.52; embossTitle(ctx, hero.x + hero.w / 2, ty2, tb, hero.w, T); }
  else {
    txt(ctx, 'LUSONA', hero.x + hero.w / 2, ty, { size: tb * 0.5, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.94, min: 24 });
    txt(ctx, 'SAND DRAWINGS', hero.x + hero.w / 2, ty + tb * 0.38, { size: tb * 0.2, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.9, min: 13 });
  }
  const B = L.buttons, lab = {
    play: [s.hasSave ? 'Continue' : 'Play', s.playInfo], levels: ['Levels', `${s.doneCount} of ${LEVELS.length} drawn`], daily: ['Daily Drawing', s.dailyInfo],
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

// Embossed gold lettering for the 3D title: dark under-edge, brass gradient face, bright top lip.
function embossTitle(ctx, cx, y, tb, maxW, T) {
  const size = tb * 0.52;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = size; ctx.font = `700 ${fs}px Fredoka, system-ui, sans-serif`;
  const wmax = maxW * 0.9; const tw = ctx.measureText('LUSONA').width; if (tw > wmax) { fs *= wmax / tw; ctx.font = `700 ${fs}px Fredoka, system-ui, sans-serif`; }
  const grad = ctx.createLinearGradient(0, y - fs * 0.5, 0, y + fs * 0.5);
  if (T.dark) { grad.addColorStop(0, '#fff3c4'); grad.addColorStop(0.45, '#f2b648'); grad.addColorStop(0.55, '#c47a1c'); grad.addColorStop(1, '#ffd777'); }
  else { grad.addColorStop(0, '#7a4a1a'); grad.addColorStop(0.5, '#4a2a0c'); grad.addColorStop(1, '#6a3c14'); }
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText('LUSONA', cx + fs * 0.03, y + fs * 0.07);
  ctx.lineWidth = fs * 0.07; ctx.strokeStyle = T.dark ? '#3a1d06' : '#f6ecd4'; ctx.strokeText('LUSONA', cx, y);
  ctx.fillStyle = grad; ctx.fillText('LUSONA', cx, y);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.restore();
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sub = 'SAND DRAWINGS', ss = Math.max(13, fs * 0.38); ctx.font = `600 ${ss}px Fredoka, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(sub, cx + 1.5, y + fs * 0.62 + 2);
  ctx.fillStyle = T.dark ? '#ffd9a0' : '#5a3410'; ctx.fillText(sub, cx, y + fs * 0.62);
  ctx.restore();
}
// A 5x5 hero picture: a single closed line that is broken up and mended again, on a loop.
let heroSeq = null;
export function heroCfg(t) {
  if (!heroSeq) {
    const base = findSingle(5, 5, seeded(11), 'turn') ?? new Array(25).fill(0), cuts = [];
    for (let i = 0; i < 25 && cuts.length < 4; i += 1) {
      const c = base.slice(); c[i] = 1 - c[i];
      if (loopCount(5, 5, c) > 1 && (cuts.length === 0 || i - cuts[cuts.length - 1] > 4)) cuts.push(i);
    }
    heroSeq = { base, cuts };
  }
  const { base, cuts } = heroSeq, cfg = base.slice(), step = Math.floor(t / 1.8) % (cuts.length * 2 + 2);
  if (step % 2 === 1 && step < cuts.length * 2 + 1) { const i = cuts[(step - 1) / 2]; cfg[i] = 1 - cfg[i]; }
  return cfg;
}

// ================================================================ pages =================================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(44), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20 });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  v3.offY = -s.scrollY; v3.clip = { x: rect.x - 6, y: rect.y, w: rect.w + 12, h: rect.h };
  const ch = draw();
  v3.offY = 0; v3.clip = null;
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
  header(ctx, s, LL, 'Levels');
  scrollBody(ctx, s, LL.body, () => {
    LEVELS.forEach((lv, i) => {
      const r = LL.tiles[i], stars = s.stars[i] ?? 0, open = i <= s.unlocked || s.dev;
      if (i % 6 === 0) { /* tier label drawn inside the first tile of each stage as a small caption */ }
      if (v3.on) v3.panels.push({ r: { x: r.x, y: r.y + v3.offY, w: r.w, h: r.h }, rad: 18, kind: open ? 'sand' : 'stone', dark: T.dark, clip: v3.clip, sand: [T.sand0, T.sand1] });
      else {
        rr(ctx, r.x, r.y, r.w, r.h, 18);
        ctx.fillStyle = open ? mix(T.sand0, T.sand1, 0.4) : 'rgba(128,128,128,0.18)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = open ? T.sandEdge : T.line; ctx.stroke();
      }
      txt(ctx, String(i + 1), r.x + r.w / 2, r.y + r.h * 0.34, { size: F(Math.min(48, r.w * 0.36)), weight: 700, color: open ? T.groove : T.dim, align: 'center', maxW: r.w - 10, min: 14 });
      txt(ctx, `${lv.W}×${lv.H}`, r.x + r.w / 2, r.y + r.h * 0.6, { size: F(Math.min(26, r.w * 0.2)) * Math.min(sc, 1.4), weight: 600, color: open ? T.groove : T.dim, align: 'center', maxW: r.w - 10, min: 11 });
      for (let k = 0; k < 3; k++) icons.star(ctx, r.x + r.w / 2 + (k - 1) * Math.min(26, r.w * 0.22), r.y + r.h * 0.84, Math.min(26, r.w * 0.22), k < stars ? '#e8a21a' : 'rgba(80,50,20,0.25)');
      if (!open && !v3.on) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill(); }
    });
    return LL.contentH;
  });
  button(ctx, LL.back, 'Menu', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// text pages on tall single-column screens: larger type so the page is not left half empty (zoom still scrolls)
const DL_fit = (D) => (D.split ? 1 : clamp(D.body.h / 1100, 1, 1.4));
function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s) * (scaleOf(s) > 1 ? 1 : DL_fit(docLayout(w, h)));
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const textR = DL.split && !page.fig ? DL.body : DL.text, figR = DL.fig;
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(38) * sc, weight: 700, color: T.accent, maxW: width, min: 16 }); y += 26 * sc + 30 * sc;
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
  if (DL.split && page.fig) {
    drawFigure(ctx, figR, page.fig, s.t);
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
  const T = theme(), sc = scaleOf(s), rows = rowsOf(s), SL = settingsLayout(w, h, sc, rows.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    rows.forEach((row, i) => {
      const g = SL.rows[i], isR = row.id === 'restore';
      panel(ctx, g.rect, { radius: 20 });
      const msg = isR ? (s.owned ? 'Thank you for playing' : s.restoreMsg || 'Bought it before?') : '';
      const ly = g.rect.y + g.rect.h / 2 - (msg ? 14 * Math.min(sc, 1.5) : 0);
      txt(ctx, row.label, g.rect.x + 22, ly, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      if (msg) txt(ctx, msg, g.rect.x + 22, ly + 30 * Math.min(sc, 1.5), { size: F(19) * Math.min(sc, 1.5), weight: 400, color: T.dim, maxW: g.rect.w - g.ctrl.w - 40, min: 11 });
      if (isR) {
        button(ctx, g.ctrl, s.owned ? 'Full game unlocked' : s.restoreBusy ? 'Checking...' : 'Restore purchase', { size: 24, kind: s.owned ? 'solid' : 'accent', disabled: s.owned || s.restoreBusy, radius: 14, flash: flashOf(s, 'set' + i + '.0') });
        return;
      }
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, flash: flashOf(s, 'set' + i + '.' + k) }));
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
  if (s.P) {
    const f = fieldGeo(O.field, s.P.L.W, s.P.L.H, 150);
    v3.fieldRect = O.field;
    drawTray(ctx, O.field, f.box);
    drawField(ctx, f, s.P.L.W, s.P.L.H, s.P.cfg, { locked: s.P.L.locked, t: s.t, win: 1, struts: s.prefs.struts });
  }
  panel(ctx, c, { radius: 28, fill: T.dark ? 'rgba(30,18,9,0.96)' : 'rgba(255,252,243,0.97)' }); if (!v3.on) edgeStroke(ctx, c, 28, 0.5);
  const small = c.h < 420, tsz = small ? 34 : 44, sz = small ? 36 : 56;
  let y = c.y + (small ? 14 : 26);
  txt(ctx, R0.daily ? 'Daily Drawing closed' : 'Line closed', c.x + c.w / 2, y + tsz * 0.6, { size: F(tsz) * sc, weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 20 }); y += (tsz + 14) * Math.min(sc, 1.3);
  for (let k = 0; k < 3; k++) icons.star(ctx, c.x + c.w / 2 + (k - 1) * (sz + 12), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
  y += sz + (small ? 8 : 16);
  const lines = [`${R0.moves} move${R0.moves === 1 ? '' : 's'}  ·  par ${R0.par}`, R0.hints ? `Think used ${R0.hints} time${R0.hints === 1 ? '' : 's'}` : 'No Think used'];
  if (R0.daily) lines.push(`Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`);
  else if (R0.first) lines.push('Next level unlocked');
  const avail = O.next.y - 8 - y, step = Math.min(40 * sc, avail / lines.length), fs = Math.min(F(26) * sc, step * 0.78);
  for (const ln of lines) { txt(ctx, ln, c.x + c.w / 2, y + step / 2, { size: fs, weight: 500, color: T.dim, align: 'center', maxW: c.w - 40, min: 11 }); y += step; }
  button(ctx, O.next, R0.daily ? 'Back to menu' : R0.last ? 'Levels' : 'Next level', { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.again, 'Share', { size: 26, flash: flashOf(s, 'share') });
  button(ctx, O.menu, R0.daily ? 'Levels' : 'Menu', { size: 26, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, c.x + c.w / 2, Math.min(c.y + c.h + 26, h - 8), 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); if (!v3.on) edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the demo end', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18 });
  para(ctx, 'The full game has all thirty levels, the Daily Drawing, Think help and Watch and Learn. Get Lusona Sand Drawings on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  txt(ctx, 'Tap anywhere to go back to the menu', c.x + c.w / 2, c.y + c.h - 112, { size: F(22), weight: 500, color: T.dim, align: 'center', maxW: c.w - 40, min: 12 });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
