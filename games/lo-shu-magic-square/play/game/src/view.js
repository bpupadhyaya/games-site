// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { playLayout, titleLayout, docLayout, settingsLayout, listLayout, journeyRects, freeRects, overLayout, pauseLayout, centerCard, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, paraHeight, wrap, F, mix, rgba, icons, UI, NUM, CJK, lettering } from './ui.js';
import { v3 } from './v3.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke, drawBadgeStack } from './brand.js';
import { VARIANTS, linesFor, lineStats, lineName } from './engine.js';
import { fmtTime, wrongNow, isGiven } from './play.js';
import { DOCS, CHAPTERS, TIERS, TIER_TEXT, VARIANT_TEXT, FACTS } from './content.js';
import { LIBRARY } from './library.js';
import { drawFigure, gauge } from './figures.js';
import { drawStone } from './stones.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'numerals', label: 'Numbers', opts: ['Digits', 'Dots', 'Chinese'] },
  { id: 'check', label: 'Check my work', opts: ['Gauges', 'Marks', 'Off'] },
  { id: 'hilite', label: 'Highlight lines', opts: ['On', 'Off'] },
  { id: 'timer', label: 'Show timer', opts: ['On', 'Off'] },
  { id: 'lefty', label: 'Tray side', opts: ['Right', 'Left'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore purchase'] },
];
// Rows shown in Settings: the web demo has nothing to restore, so that row is hidden there.
export const settingRows = (s) => (s.demo ? SETTINGS.filter((r) => r.id !== 'restore') : SETTINGS);
// The Restore button text follows the purchase state.
export const restoreLabel = (s) => (s.owned ? 'Full game unlocked' : s.restore.busy ? 'Checking with the store...' : s.restore.msg || 'Restore purchase');
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'numerals': return ['digits', 'dots', 'chinese'].indexOf(p.numerals);
    case 'check': return ['sums', 'marks', 'off'].indexOf(p.check);
    case 'hilite': return p.hilite ? 0 : 1;
    case 'timer': return p.timer ? 0 : 1;
    case 'lefty': return p.lefty ? 1 : 0;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  v3.reset(); v3.scene = s.scene;
  background(ctx, w, h, s.prefs.calm ? 0 : s.t);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'journey') drawJourney(ctx, s, w, h);
  else if (sc === 'free') drawFree(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = rgba(T.bg1, 1 - smooth(s.sceneT / 0.25)); ctx.fillRect(0, 0, w, h); }
}

// ================================================================ the board ===============================================================
export function gaugePos(board, pan, ln) {
  const g = board.gauges;
  if (ln.kind === 'row') return g.rows[ln.idx];
  if (ln.kind === 'col') return g.cols[ln.idx];
  if (!pan) return ln.kind === 'diag' ? g.diagStd : g.antiStd;
  return ln.kind === 'diag' || ln.kind === 'bdiag' ? g.tops[ln.idx] : g.lefts[ln.idx];
}

// The board each screen shows in 3D (the presenter fits its camera to this rect). Same memoized layout objects the draw code uses.
export function heroGeo(L) {
  const hero = L.hero, H = hero.h, tb = Math.min(170, Math.max(80, H * 0.32));
  const gs = Math.max(90, Math.min(hero.w * 0.62, (H - tb - 16) / 1.02, 500)), x0 = hero.x + (hero.w - gs) / 2, y0 = hero.y + Math.max(0, (H - gs - tb) / 2);
  return { gs, x0, y0, tb };
}
export function sceneBoard(s, w, h) {
  const sc = s.scene;
  if (sc === 'play' && s.P) { const pz = s.P.puz, L = playLayout(w, h, { n: pz.n, pan: pz.pan, coach: !!(s.hint || s.auto.on), lefty: s.prefs.lefty }); return { b: L.board, n: pz.n, pan: pz.pan, M: pz.M, scene: 'play', win: s.winT > 0 }; }
  if (sc === 'over' && s.result) { const R0 = s.result, pan = VARIANTS[R0.variant].pan, O = overLayout(w, h, scaleOf(s), R0.n, pan); return { b: O.board, n: R0.n, pan, M: s.P ? s.P.puz.M : R0.n * (R0.n * R0.n + 1) / 2, scene: 'over' }; }
  if (sc === 'title' || sc === 'demo-limit') {
    const L = titleLayout(w, h, !!s.saved), g = heroGeo(L), pad = g.gs * 0.07, cs = (g.gs - 2 * pad) / 3;
    const cells = Array.from({ length: 9 }, (_, i) => R(g.x0 + pad + (i % 3) * cs, g.y0 + pad + Math.floor(i / 3) * cs, cs, cs));
    const b = { x: g.x0, y: g.y0, w: g.gs, h: g.gs, gx: g.x0 + pad, gy: g.y0 + pad, G: 3 * cs, s: cs, n: 3, bd: 0, banner: null, cells, gauges: { r: 0 } };
    return { b, n: 3, pan: false, M: 15, scene: 'title', hero: true };
  }
  return null;
}

function drawBoardFrame(ctx, b) {
  const T = theme(), W = b.w, H = b.h, m = Math.min(W, H);
  rr(ctx, b.x - 2, b.y + 3, W + 4, H + 5, m * 0.05); ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.fill();
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + H);
  g.addColorStop(0, mix(T.frame, '#ffffff', 0.08)); g.addColorStop(1, mix(T.frame, '#000000', 0.25));
  rr(ctx, b.x, b.y, W, H, m * 0.05); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(2, m * 0.005); ctx.strokeStyle = rgba(T.rim, 0.85); ctx.stroke();
  const e = Math.max(4, b.s * 0.04), pl = R(b.gx - e, b.gy - e, b.G + 2 * e, b.G + 2 * e);
  rr(ctx, pl.x, pl.y, pl.w, pl.h, m * 0.02); ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.38)' : 'rgba(255,240,200,0.25)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(T.rim, 0.5); ctx.stroke();
}

function drawBanner(ctx, b, M, pan) {
  if (pan) return;
  const T = theme(), r = b.banner, pj = v3.on && v3.proj ? v3.proj(r.x + r.w / 2, r.y + r.h / 2) : null, k = pj ? pj.k : 1;
  txt(ctx, `Every line adds to ${M}`, pj ? pj.x : r.x + r.w / 2, pj ? pj.y : r.y + r.h / 2, { size: F(Math.min(34, b.bd * 0.62) * k), weight: 700, color: mix(T.rim, '#ffffff', 0.3), align: 'center', maxW: r.w * k, min: 14, fam: NUM });
}

function drawBoard(ctx, s, L) {
  const T = theme(), b = L.board, P = s.P, n = P.puz.n, lines = linesFor(n, P.puz.pan), stats = lineStats(P.puz, P.grid), cell = b.s;
  const style = s.prefs.numerals, hm = s.hint, wrongSet = s.prefs.check === 'marks' ? new Set(wrongNow(P)) : null;
  const three = v3.on;
  if (!three) drawBoardFrame(ctx, b);
  drawBanner(ctx, b, P.puz.M, P.puz.pan);
  // which lines to light: those through the selected / hovered square, a focused gauge, or the hint
  const lit = new Map();   // cell -> strength
  const light = (ids, k) => { for (const id of ids) for (const c of lines[id].cells) lit.set(c, Math.max(lit.get(c) ?? 0, k)); };
  const hover = s.drag ? cellAt(b, s.drag.x, s.drag.y) : -1;
  const focusCell = hover >= 0 ? hover : s.sel;
  if (s.prefs.hilite && focusCell >= 0) light(lines.of[focusCell], 0.5);
  if (s.lineFocus >= 0) light([s.lineFocus], 1);
  const hotLines = new Set();
  if (hm) { light(hm.h.lines, hm.stage === 'look' ? 0.9 : 0.7); hm.h.lines.forEach((id) => hotLines.add(id)); }
  if (s.lineFocus >= 0) hotLines.add(s.lineFocus);
  if (focusCell >= 0 && s.prefs.hilite) for (const id of lines.of[focusCell]) hotLines.add(id);
  const win = s.winT > 0;
  if (three) {
    if (!v3.board) v3.board = { b, n, pan: P.puz.pan, M: P.puz.M };
    v3.board.win = win; v3.board.paused = s.paused;
    for (let i = 0; i < n * n; i++) {
      const v = P.grid[i], k = lit.get(i) ?? 0;
      v3.cells[i] = { k, sel: i === s.sel && !v, hover: hover === i && !isGiven(P, i), mistake: !!(hm && hm.h.tech === 'mistake' && hm.h.cell === i) };
      if (s.paused) continue;
      if (v && !(s.drag && s.drag.from === i)) {
        const pp = s.fx.pop[i], sk = s.fx.shake[i];
        v3.stones.push({ v, kind: isGiven(P, i) ? 'given' : 'stone', where: 'cell', cell: i, glow: (i === s.sel ? 0.8 : 0) + (win ? Math.max(0, Math.sin(s.t * 6 - i * 0.7)) : 0), tint: wrongSet && wrongSet.has(i) ? T.err : null, pop: pp !== undefined && pp < 0.26 ? pp / 0.26 : -1, shake: sk !== undefined && sk < 0.4 ? sk : -1 });
      } else if (hm && hm.stage !== 'look' && hm.h.cell === i && hm.h.tech !== 'mistake') v3.stones.push({ v: hm.h.value, kind: 'stone', where: 'ghost', cell: i, alpha: 0.55 + 0.25 * Math.sin(s.t * 5) });
    }
    if (!s.paused) for (const ln of lines) {
      const st = stats[ln.id], p = gaugePos(b, P.puz.pan, ln), pv = s.fx.pulse[ln.id], pulse = pv !== undefined && pv >= 0 ? Math.sin(Math.PI * clamp(pv / 0.8, 0, 1)) : 0;
      const filled = st.empty === 0, over = s.prefs.check === 'off' ? false : st.over, ok = filled && st.sum === P.puz.M;
      v3.gauges.push({ id: ln.id, x: p.x, y: p.y, r: b.gauges.r, sum: st.sum, M: P.puz.M, filled, state: ok ? 'ok' : (over || (filled && st.sum !== P.puz.M && s.prefs.check !== 'off')) ? 'over' : 'part', pulse, hot: hotLines.has(ln.id), cells: ln.cells });
    }
    return;
  }
  for (let i = 0; i < n * n; i++) {
    const r = b.cells[i], k = lit.get(i) ?? 0;
    rr(ctx, r.x, r.y, r.w, r.h, cell * 0.14);
    ctx.fillStyle = k ? mix(T.socket, T.socketLit, 0.9) : T.socket; ctx.fill();
    if (k) { ctx.fillStyle = rgba(T.sel, 0.06 + 0.14 * k); ctx.fill(); }
    ctx.lineWidth = 1.5; ctx.strokeStyle = k ? rgba(T.sel, 0.4 + 0.3 * k) : rgba(T.rim, 0.22); ctx.stroke();
    // inner shade at the top edge: the socket is recessed
    ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, cell * 0.14); ctx.clip();
    const sh = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.45); sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.fillRect(r.x, r.y, r.w, r.h * 0.45);
    ctx.restore();
  }
  for (let i = 0; i < n * n; i++) {
    const r = b.cells[i], v = P.grid[i];
    if (s.paused) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = cell * 0.42;
    if (i === s.sel && !v) { ctx.beginPath(); ctx.arc(cx, cy, rad * 1.06, 0, 7); ctx.lineWidth = Math.max(2.5, cell * 0.05); ctx.strokeStyle = T.sel; ctx.stroke(); }
    if (hover === i && !isGiven(P, i)) { ctx.beginPath(); ctx.arc(cx, cy, rad * 1.1, 0, 7); ctx.lineWidth = Math.max(3, cell * 0.06); ctx.strokeStyle = T.sel; ctx.stroke(); }
    const sk = s.fx.shake[i], dx = sk !== undefined && sk < 0.4 ? Math.sin(sk * 70) * cell * 0.06 * (1 - sk / 0.4) : 0;
    if (v && !(s.drag && s.drag.from === i)) {
      const pp = s.fx.pop[i], pop = pp !== undefined && pp < 0.26 ? 1 + 0.25 * Math.sin((Math.PI * pp) / 0.26) : 1;
      const given = isGiven(P, i), wl = win ? Math.max(0, Math.sin(s.t * 6 - i * 0.7)) : 0;
      drawStone(ctx, cx + dx, cy, rad * pop, v, { kind: given ? 'given' : 'stone', style, glow: (i === s.sel ? 0.8 : 0) + wl * 0.8, tint: wrongSet && wrongSet.has(i) ? T.err : null });
    } else if (hm && hm.stage !== 'look' && hm.h.cell === i && hm.h.tech !== 'mistake') {
      const a = 0.55 + 0.25 * Math.sin(s.t * 5);
      drawStone(ctx, cx, cy, rad, hm.h.value, { alpha: a, glow: 0.9, style });
    }
    if (hm && hm.h.tech === 'mistake' && hm.h.cell === i) { ctx.beginPath(); ctx.arc(cx, cy, rad * 1.12, 0, 7); ctx.lineWidth = Math.max(3, cell * 0.07); ctx.strokeStyle = T.err; ctx.stroke(); }
  }
  // gauges
  if (!s.paused) for (const ln of lines) {
    const st = stats[ln.id], p = gaugePos(b, P.puz.pan, ln), pv = s.fx.pulse[ln.id], pulse = pv !== undefined && pv >= 0 ? Math.sin(Math.PI * clamp(pv / 0.8, 0, 1)) : 0;
    gauge(ctx, p.x, p.y, b.gauges.r, st.sum, P.puz.M, st.empty === 0, { pulse, hot: hotLines.has(ln.id), over: s.prefs.check === 'off' ? false : st.over });
  }
  if (!s.paused) for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
// 3D: text on the gauges sits at the projected point of each gauge face; 2D: the whole gauge is drawn here.
function drawGaugeText3D(ctx, s, L) {
  const T = theme();
  for (const g of v3.gauges) {
    const p = v3.proj ? v3.proj(g.x, g.y) : { x: g.x, y: g.y, k: 1 }, r = g.r * p.k, str = String(g.sum);
    const col = g.state === 'ok' ? T.sel : g.state === 'over' ? T.err : T.text;
    txt(ctx, str, p.x, p.y + r * 0.04, { size: r * (str.length > 2 ? 0.68 : 0.86), weight: 700, color: col, align: 'center', fam: UI });
  }
}
const cellAt = (b, x, y) => (v3.on && v3.pick && v3.board ? v3.pick(x, y) : b.at(x, y));
export { cellAt };

// ================================================================ play screen ============================================================
function drawPlay(ctx, s, w, h) {
  const L = playLayout(w, h, { n: s.P.puz.n, pan: s.P.puz.pan, coach: !!(s.hint || s.auto.on), lefty: s.prefs.lefty });
  drawBoard(ctx, s, L);
  if (v3.on) drawGaugeText3D(ctx, s, L);
  drawInfo(ctx, s, L);
  if (s.paused) { drawPaused(ctx, s, L); }
  else if (s.auto.on) drawAutoControls(ctx, s, L);
  else if (s.hint) drawCoach(ctx, s, L);
  else drawControls(ctx, s, L);
  if (s.drag && !s.paused) {
    if (v3.on) v3.stones.push({ v: s.drag.v, kind: 'stone', where: 'drag', x: s.drag.x, y: s.drag.y, r: L.board.s * 0.46, glow: 0.7 });
    else drawStone(ctx, s.drag.x, s.drag.y, L.board.s * 0.46, s.drag.v, { lift: 1, glow: 0.7, style: s.prefs.numerals });
  }
  drawMsg(ctx, s, L);
}

const kindName = (s) => (s.auto.on ? 'Watch and Learn' : s.P.kind === 'daily' ? 'Daily Square' : VARIANTS[s.P.variant].name);
function drawInfo(ctx, s, L) {
  const T = theme(), P = s.P, pr = s.prefs, hud = L.hud, pz = P.puz;
  const title = kindName(s);
  let sub = `${pz.n} x ${pz.n}  ·  every line adds to ${pz.M}`;
  if (P.kind === 'journey' && !s.auto.on) { const [ci, i] = P.ref.split(':').map(Number); sub = `Square ${i + 1} of ${CHAPTERS[ci].count}  ·  adds to ${pz.M}`; }
  const filled = P.grid.filter(Boolean).length;
  if (L.mode === 'portrait') {
    if (v3.on) { panel(ctx, R(hud.title.x - 14, hud.title.y - 4, Math.min(L.U.w * 0.6, 470), 82), { radius: 20 }); panel(ctx, R(hud.timer.x - 168, hud.title.y - 4, 168 + 8, 92), { radius: 18 }); }
    txt(ctx, title, hud.title.x, hud.title.y + 26, { size: F(38), weight: 700, color: T.text, maxW: L.U.w * 0.5, min: 18, fam: NUM });
    txt(ctx, sub, hud.title.x, hud.title.y + 60, { size: F(22), weight: 500, color: T.accent, maxW: L.U.w * 0.55, min: 12 });
    if (pr.timer) txt(ctx, fmtTime(P.t), hud.timer.x, hud.title.y + 26, { size: F(40), weight: 600, color: T.text, align: 'right' });
    button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
    return;
  }
  const r = L.info;
  panel(ctx, r, { radius: 26 });
  edgeStroke(ctx, r, 26, 0.35);
  txt(ctx, title, hud.title.x, hud.title.y + 28, { size: F(38), weight: 700, color: T.text, maxW: r.w - 120, min: 18, fam: NUM });
  txt(ctx, sub, hud.title.x, hud.title.y + 64, { size: F(22), weight: 500, color: T.accent, maxW: r.w - 120, min: 12 });
  button(ctx, L.pause, '', { icon: 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
  if (pr.timer) txt(ctx, fmtTime(P.t), hud.timer.x, hud.timer.y, { size: F(60), weight: 600, color: T.text, align: 'center', maxW: r.w - 40 });
  txt(ctx, `${filled} of ${pz.n * pz.n} stones placed`, hud.timer.x, hud.timer.y + 48, { size: F(24), weight: 400, color: T.dim, align: 'center', maxW: r.w - 30, min: 12 });
  if (r.h > 700 && !s.hint && !s.auto.on) drawBadgeStack(ctx, r.x + r.w - 70, r.y + r.h - 6, 100);
}

function drawControls(ctx, s, L) {
  const T = theme(), P = s.P, style = s.prefs.numerals, tr = L.tray;
  if (tr) {
    const pad = tr.s * 0.18, bgR = R(tr.rect.x - pad, tr.rect.y - pad * 0.7, tr.rect.w + pad * 2, tr.rect.h + pad * 1.4);
    if (v3.on) panel(ctx, bgR, { radius: 22, fill: mix(T.frame, '#ffffff', 0.04), z: 0 });
    else { rr(ctx, bgR.x, bgR.y, bgR.w, bgR.h, 22); ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.3)' : 'rgba(80,50,10,0.1)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = T.line; ctx.stroke(); }
    P.puz.nums.forEach((v, i) => {
      const r = tr.slots[i], cx = r.x + r.w / 2, cy = r.y + r.h / 2, used = P.grid.indexOf(v) >= 0, dragged = s.drag && s.drag.v === v && s.drag.from < 0;
      if (v3.on) panel(ctx, { x: cx - r.w * 0.4, y: cy - r.w * 0.4, w: r.w * 0.8, h: r.w * 0.8 }, { radius: r.w * 0.4, fill: T.socket, z: 0.5 });
      if (used || dragged) { if (!v3.on) { ctx.beginPath(); ctx.arc(cx, cy, r.w * 0.38, 0, 7); ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.strokeStyle = rgba(T.rim, 0.4); ctx.stroke(); ctx.setLineDash([]); } return; }
      const held = s.held === v, bob = held ? Math.sin(s.t * 6) * 0.05 : 0;
      if (v3.on) v3.stones.push({ v, kind: 'stone', where: 'tray', x: cx, y: cy, r: r.w * 0.44, held, glow: held ? 1 : 0, lift: held ? 1 + bob : 0 });
      else drawStone(ctx, cx, cy, r.w * 0.44, v, { lift: held ? 1 + bob : 0, glow: held ? 1 : 0, style });
    });
  }
  const tl = L.tools, hasUndo = P.undo.length > 0, hasRedo = P.redo.length > 0;
  const defs = [['undo', 'Undo', 'undo', !hasUndo], ['redo', 'Redo', 'redo', !hasRedo], ['hint', 'Hint', 'bulb', false], ['reset', 'Reset', 'erase', !P.grid.some((v, i) => v && !isGiven(P, i))]];
  for (const [id, label, icon, dis] of defs) {
    const r = tl[id], wide = r.h >= 56 && r.w > 80;
    button(ctx, r, wide ? label : '', { icon, kind: id === 'hint' ? 'accent' : 'solid', disabled: dis, size: 24, radius: 18, flash: flashOf(s, id) });
  }
}

function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40;
  const title = hnt.h.name, chip = hnt.stage === 'look' ? 'Where to look' : hnt.stage === 'explain' ? 'Why it works' : 'Check this stone';
  const ts = F(C.h > 420 ? 36 : 30);
  txt(ctx, title, x, C.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18 });
  txt(ctx, chip, x, C.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim });
  const bodyTop = C.y + 14 + ts * 2.1, bodyH = B.close.y - 10 - bodyTop;
  const text = hnt.stage === 'mistake' ? hnt.h.why : hnt.text;
  let size = F(C.w > 500 ? 32 : 28);
  while (size > 15 && paraHeight(ctx, text, w, size, 500, 1.3) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.3 });
  button(ctx, B.close, 'Close', { size: 28, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : hnt.stage === 'mistake' ? 'Fix it' : 'Place it', { kind: 'accent', size: 28, flash: flashOf(s, 'go') });
}
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
function drawAutoControls(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, hnt = s.hint;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.25 : 0.5) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, T0 = L.coachText;
  const ts = F(C.h > 420 ? 36 : 30), name = hnt?.h?.name ?? (a.done ? 'Solved' : 'Thinking');
  txt(ctx, name, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 18 });
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Where to look' : a.phase === 'reveal' ? 'Why it works' : a.done ? 'The square is complete' : 'Finding the next step';
  txt(ctx, `Step ${a.n}  ·  ${phase}`, x, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, maxW: w * 0.6, min: 12 });
  const bodyTop = T0.y + 14 + ts * 2.1, bodyH = T0.y + T0.h - bodyTop;
  const text = hnt?.text ?? (a.done ? 'Every stone is placed. Tap Exit to go back to the menu.' : 'Looking for the next logical step.');
  let size = F(C.w > 500 ? 30 : 26);
  while (size > 15 && paraHeight(ctx, text, w, size, 500, 1.3) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 500, color: T.text, lh: 1.3 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 26, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Play' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 26, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 26, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 26, flash: flashOf(s, 'ainc') });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + C.w - 20, T0.y + 14 + ts * 1.5, { size: F(20), weight: 500, color: T.dim, align: 'right' });
}

function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.board);
  v3.z = 2;
  if (v3.on) panel(ctx, L.board.rect, { radius: 30, fill: rgba(T.socket, 0.9), z: 1 });
  else { ctx.fillStyle = rgba(T.socket, 0.82); rr(ctx, L.board.x, L.board.y, L.board.w, L.board.h, 30); ctx.fill(); }
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(14,30,28,0.97)' : 'rgba(255,250,236,0.98)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(40), weight: 700, color: T.text, align: 'center', fam: NUM });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Restart square', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
  v3.z = 0;
}

function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), portrait = L.mode === 'portrait';
  const bx = L.board, w = portrait ? Math.min(bx.w - 30, 560) : L.info.w - 24, cx2 = portrait ? bx.x + bx.w / 2 : L.info.x + L.info.w / 2;
  let size = F(portrait ? 24 : 26), lines = wrap(ctx, m.text, w - 36, size, 600);
  while (portrait && lines.length > 2 && size > F(18)) { size -= 1; lines = wrap(ctx, m.text, w - 36, size, 600); }
  const hh = lines.length * size * 1.22 + 22;
  const y = portrait ? L.hud.title.y + Math.max(0, (84 - hh) / 2) : L.info.y + L.info.h - hh - 130;
  ctx.save(); ctx.globalAlpha = a;
  if (v3.on) { v3.z = 4; panel(ctx, { x: cx2 - w / 2, y, w, h: hh }, { radius: 18, fill: T.dark ? 'rgba(8,20,18,0.96)' : 'rgba(255,255,255,0.97)', z: 4 }); v3.z = 0; }
  else { rr(ctx, cx2 - w / 2, y, w, hh, 18); ctx.fillStyle = T.dark ? 'rgba(8,20,18,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke(); }
  para(ctx, m.text, cx2 - w / 2 + 18, y + 11, w - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ title ==================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const { gs, x0, y0, tb } = heroGeo(L);
  const vals = [4, 9, 2, 3, 5, 7, 8, 1, 6], pad = gs * 0.07, cs = (gs - 2 * pad) / 3;
  if (!v3.on) { rr(ctx, x0, y0, gs, gs, gs * 0.05); ctx.fillStyle = T.frame; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.rim; ctx.stroke(); }
  for (let i = 0; i < 9; i++) {
    const cx = x0 + pad + (i % 3 + 0.5) * cs, cy = y0 + pad + (Math.floor(i / 3) + 0.5) * cs;
    const ph = s.t * 1.2 - i * 0.3, wv = (ph % 6.28) > 0 && (ph % 6.28) < 1.57 ? Math.sin(((ph % 6.28) / 1.57) * Math.PI) : 0;
    const appear = clamp(s.sceneT * 3 - i * 0.1, 0, 1);
    if (v3.on) { v3.cells[i] = { k: wv * 0.6, sel: false, hover: false }; v3.stones.push({ v: vals[i], kind: i % 2 === 0 ? 'given' : 'stone', where: 'cell', cell: i, glow: wv, lift: wv * 0.6, appear: smooth(appear), style: i === 4 ? 'dots' : 'digits' }); continue; }
    rr(ctx, cx - cs * 0.46, cy - cs * 0.46, cs * 0.92, cs * 0.92, cs * 0.14); ctx.fillStyle = T.socket; ctx.fill();
    drawStone(ctx, cx, cy, cs * 0.42 * smooth(appear), vals[i], { kind: i % 2 === 0 ? 'given' : 'stone', lift: wv * 0.6, glow: wv, style: i === 4 ? 'dots' : 'digits' });
  }
  const ty = y0 + gs + tb * 0.42;
  lettering(ctx, 'LO SHU', hero.x + hero.w / 2, ty, tb * 0.62, { maxW: hero.w * 0.94 });
  lettering(ctx, 'MAGIC SQUARE  ·  洛书', hero.x + hero.w / 2, ty + tb * 0.48, tb * 0.2, { fam: UI, weight: 700, maxW: hero.w * 0.9, hue: ['#fff6d2', '#f4cf6a', '#c08a2a'] });
  const done = Object.keys(s.progress).length, Bt = L.buttons;
  const lab = {
    continue: ['Continue', s.saved ? `${VARIANTS[s.saved.variant]?.name ?? 'Square'}${s.saved.kind === 'daily' ? ' · Daily' : ''}  ·  ${fmtTime(s.saved.t)}` : ''],
    journey: ['The Journey', `${done} of ${CHAPTERS.reduce((a, c) => a + c.count, 0)} squares solved`], free: ['Free Play', 'Six kinds of square, three levels each'],
    daily: ['Daily Square', s.dailyDone ? `${VARIANTS[s.dailyVariant].name}  ·  done today` : `${VARIANTS[s.dailyVariant].name}  ·  ${s.streak ? s.streak + ' day streak' : 'new every day'}`],
    learn: ['Watch and Learn', ''], howto: ['How to Play', ''], rules: ['Rules', ''], stats: ['Stats', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star' };
  for (const id of Object.keys(Bt)) {
    const prim = id === 'continue' || id === 'journey' || id === 'free' || id === 'daily', r = Bt[id];
    button(ctx, r, lab[id][0], { kind: id === 'journey' || id === 'continue' ? 'accent' : 'solid', size: prim ? 32 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ pick screens ============================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(42), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20, fam: NUM });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  v3.clip = { x: rect.x - 6, y: rect.y, w: rect.w + 12, h: rect.h }; v3.dy = -s.scrollY;
  const ch = draw();
  v3.clip = null; v3.dy = 0;
  ctx.restore();
  metrics.max = Math.max(0, ch - rect.h); metrics.view = rect.h; metrics.rect = rect;
  if (metrics.max > 0) {
    const T = theme(), bx = rect.x + rect.w + 4, th = Math.max(40, rect.h * rect.h / ch), ty = rect.y + (rect.h - th) * clamp(s.scrollY / metrics.max, 0, 1);
    rr(ctx, bx, rect.y, 6, rect.h, 3); ctx.fillStyle = 'rgba(128,128,128,0.2)'; ctx.fill();
    rr(ctx, bx, ty, 6, th, 3); ctx.fillStyle = T.accent; ctx.fill();
  }
}

function drawJourney(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s);
  header(ctx, s, LL, 'The Journey');
  const J = journeyRects(LL.body, CHAPTERS.map((c) => c.count), sc, CHAPTERS.map((c) => c.blurb));
  // the next unsolved square, for the glow
  let nextKey = null;
  outer: for (let ci = 0; ci < CHAPTERS.length; ci++) for (let i = 0; i < CHAPTERS[ci].count; i++) if (!s.progress[`${ci}:${i}`]) { nextKey = `${ci}:${i}`; break outer; }
  scrollBody(ctx, s, LL.body, () => {
    J.items.forEach((it) => {
      const ch = CHAPTERS[it.ci], done = Array.from({ length: ch.count }, (_, i) => !!s.progress[`${it.ci}:${i}`]).filter(Boolean).length, hd = it.head;
      txt(ctx, ch.name, hd.x + 4, hd.y + 24 * Math.min(sc, 1.6), { size: F(34) * Math.min(sc, 1.6), weight: 700, color: T.text, maxW: hd.w * 0.7, min: 16, fam: NUM });
      txt(ctx, `${done} of ${ch.count}`, hd.x + hd.w - 4, hd.y + 24 * Math.min(sc, 1.6), { size: F(24) * Math.min(sc, 1.5), weight: 600, color: T.accent, align: 'right' });
      para(ctx, ch.blurb, hd.x + 4, hd.y + 46 * Math.min(sc, 1.6), hd.w - 8, { size: F(21) * Math.min(sc, 1.6), weight: 400, color: T.dim, lh: 1.15 });
      it.lv.forEach((r, i) => {
        const key = `${it.ci}:${i}`, pr = s.progress[key], idx = CHAPTERS.slice(0, it.ci).reduce((a, c) => a + c.count, 0) + i;
        const locked = !s.dev && !(idx === 0 || s.progress[prevKey(it.ci, i)] || pr);
        const cx = r.x + r.w / 2, cy = r.y + r.h * 0.42, rad = Math.min(r.w, r.h) * 0.36, isNext = key === nextKey;
        ctx.save(); if (locked) ctx.globalAlpha = 0.45;
        drawStone(ctx, cx, cy, rad, i + 1, { kind: pr ? 'stone' : 'given', glow: isNext ? 0.6 + 0.4 * Math.sin(s.t * 4) : 0, flat: false, alpha: 1 });
        ctx.restore();
        if (pr) for (let k = 0; k < 3; k++) icons.star(ctx, cx + (k - 1) * rad * 0.7, r.y + r.h - 6, rad * 0.5, k < pr.stars ? '#ffc93c' : 'rgba(128,128,128,0.4)');
        else if (locked) txt(ctx, 'locked', cx, r.y + r.h - 8, { size: F(15), weight: 500, color: T.dim, align: 'center' });
      });
    });
    return J.contentH + 10;
  });
  button(ctx, LL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function prevKey(ci, i) { return i > 0 ? `${ci}:${i - 1}` : `${ci - 1}:${CHAPTERS[Math.max(0, ci - 1)].count - 1}`; }

function drawFree(ctx, s, w, h) {
  const T = theme(), LL = listLayout(w, h), sc = scaleOf(s), ids = Object.keys(VARIANTS), Fr = freeRects(LL.body, ids.length, sc), z = Math.min(sc, 1.5);
  header(ctx, s, LL, 'Free Play');
  scrollBody(ctx, s, LL.body, () => {
    Fr.cards.forEach((c, vi) => {
      const id = ids[vi], V = VARIANTS[id], r = c.r, best = s.stats.best[id], solved = s.stats.solved[id] ?? 0;
      panel(ctx, r, { radius: 22 });
      txt(ctx, V.name, r.x + 20, r.y + 30 * z, { size: F(34) * z, weight: 700, color: T.text, maxW: r.w * 0.58, min: 16, fam: NUM });
      txt(ctx, `${V.n} x ${V.n}${V.pan ? ' · broken diagonals' : ''}`, r.x + 20, r.y + 62 * z, { size: F(21) * z, weight: 600, color: T.accent, maxW: r.w * 0.6, min: 12 });
      para(ctx, VARIANT_TEXT[id], r.x + 20, r.y + 80 * z, r.w * 0.6, { size: F(20) * z, weight: 400, color: T.dim, lh: 1.15 });
      txt(ctx, best ? fmtTime(best) : '–', r.x + r.w - 20, r.y + 30 * z, { size: F(30) * z, weight: 600, color: T.text, align: 'right' });
      txt(ctx, `best  ·  ${solved} solved`, r.x + r.w - 20, r.y + 62 * z, { size: F(19) * z, weight: 400, color: T.dim, align: 'right', maxW: r.w * 0.34, min: 11 });
      c.tiers.forEach((tr, t) => button(ctx, tr, TIERS[t], { size: 24, kind: t === 1 ? 'accent' : 'solid', radius: 14, sub: '', flash: flashOf(s, 'tier' + vi + t) }));
    });
    return Fr.contentH;
  });
  button(ctx, LL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ docs ===================================================================
function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s);
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const textR = DL.text, figR = DL.fig;
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(36) * sc, weight: 700, color: T.accent, maxW: width, min: 16, fam: NUM }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p && b.mono) { y += para(ctx, b.p, x, y, width, { size: F(34) * sc, weight: 700, color: T.text, align: 'center', lh: 1.4 }) + 14 * sc; }
      else if (b.p) { y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc; }
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
        const fh = Math.min(textR.w, Math.max(240, textR.h * (sc > 1.6 ? 0.4 : 0.52)), 560), fr = R(textR.x + (textR.w - Math.min(textR.w, fh + 20)) / 2, y, Math.min(textR.w, fh + 20), fh);
        drawFigure(ctx, fr, page.fig, s.t); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings ===============================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), rows = settingRows(s), SL = settingsLayout(w, h, sc, rows.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    rows.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], row.id === 'restore' ? restoreLabel(s) : o, { size: 24, active: k === cur, radius: 14, kind: row.id === 'restore' && !s.owned ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ stats ==================================================================
function drawStats(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = listLayout(w, h), st = s.stats, z = Math.min(sc, 1.6);
  header(ctx, s, SL, 'Stats');
  const ids = Object.keys(VARIANTS), total = ids.reduce((a, id) => a + (st.solved[id] ?? 0), 0), wide = SL.body.w >= 1000;
  scrollBody(ctx, s, SL.body, () => {
    const r = SL.body, gapC = 28, lw = wide ? (r.w - gapC) * 0.54 : r.w, x = r.x; let y = r.y;
    const cols = lw > 760 ? 4 : 2, tiles = [['Squares solved', total], ['Daily streak', s.streak], ['Best streak', st.bestStreak], ['Dailies solved', st.days.length]];
    const th = 110 * Math.min(sc, 1.8), g = 12, tw = (lw - g * (cols - 1)) / cols;
    tiles.forEach(([l, v], i) => {
      const tr = R(x + (i % cols) * (tw + g), y + Math.floor(i / cols) * (th + g), tw, th);
      panel(ctx, tr, { radius: 20 });
      txt(ctx, v, tr.x + 20, tr.y + th * 0.42, { size: F(46) * z, weight: 700, color: T.text });
      txt(ctx, l, tr.x + 20, tr.y + th * 0.8, { size: F(22) * z, weight: 400, color: T.dim, maxW: tw - 30, min: 11 });
    });
    y += Math.ceil(tiles.length / cols) * (th + g) + 10;
    txt(ctx, 'By kind of square', x, y + 20 * sc, { size: F(32) * sc, weight: 700, color: T.accent, fam: NUM }); y += 50 * sc;
    for (const id of ids) {
      const rh = 76 * Math.min(sc, 1.8), rr2 = R(x, y, lw, rh);
      panel(ctx, rr2, { radius: 16 });
      txt(ctx, VARIANTS[id].name, x + 20, y + rh / 2, { size: F(26) * z, weight: 600, color: T.text, maxW: lw * 0.36, min: 13 });
      txt(ctx, `${st.solved[id] ?? 0} solved`, x + lw * 0.45, y + rh / 2, { size: F(23) * z, weight: 400, color: T.dim, maxW: lw * 0.22, min: 12 });
      txt(ctx, st.best[id] ? `best ${fmtTime(st.best[id])}` : 'no time yet', x + lw - 20, y + rh / 2, { size: F(23) * z, weight: 500, color: T.text, align: 'right', maxW: lw * 0.33, min: 12 });
      y += rh + 8;
    }
    const leftEnd = y;
    let cx = x, cw = lw, cy;
    if (wide) { cx = x + lw + gapC; cw = r.w - lw - gapC; cy = r.y; } else { y += 14; cy = y; }
    txt(ctx, 'Last five weeks', cx, cy + 20 * sc, { size: F(32) * sc, weight: 700, color: T.accent, fam: NUM }); cy += 50 * sc;
    const cs = Math.min(wide ? 110 : 86, (cw - 6 * 8) / 7), done = new Set(st.days);
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => txt(ctx, d, cx + i * (cs + 8) + cs / 2, cy + 12, { size: F(20), weight: 500, color: T.dim, align: 'center' }));
    cy += 28;
    const today = s.daily.day, wd = (today + 4) % 7, start = today - wd - 28;
    for (let k = 0; k < 35; k++) {
      const day = start + k, ex = cx + (k % 7) * (cs + 8), ey = cy + Math.floor(k / 7) * (cs + 8), isDone = done.has(day), future = day > today;
      rr(ctx, ex, ey, cs, cs, cs * 0.2); ctx.fillStyle = isDone ? T.good : future ? 'rgba(128,128,128,0.08)' : T.btn; ctx.fill();
      if (day === today) { ctx.lineWidth = 3; ctx.strokeStyle = T.accent; ctx.stroke(); }
      if (isDone) icons.check(ctx, ex + cs / 2, ey + cs / 2, cs * 0.5, '#06241a');
    }
    cy += 5 * (cs + 8) + 10;
    return Math.max(wide ? leftEnd : 0, cy) - r.y;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ result =================================================================
function drawOver(ctx, s, w, h) {
  const T = theme(), R0 = s.result;
  if (!R0) return;
  setBrandTone(T.dark);
  const sc = scaleOf(s), pan = VARIANTS[R0.variant].pan, O = overLayout(w, h, sc, R0.n, pan), b = O.board, n = R0.n, lines = linesFor(n, pan);
  const cell = b.s, P = s.P, style = s.prefs.numerals;
  if (v3.on) {
    if (P) {
      drawBanner(ctx, b, P.puz.M, P.puz.pan);
      for (const ln of lines) { const p = gaugePos(b, P.puz.pan, ln); v3.gauges.push({ id: ln.id, x: p.x, y: p.y, r: b.gauges.r, sum: P.puz.M, M: P.puz.M, filled: true, state: 'ok', pulse: 0, hot: false, cells: ln.cells }); }
      for (let i = 0; i < n * n; i++) {
        const ph = s.t * 1.8 - ((i % n) + Math.floor(i / n)) * 0.25, wave = ph > 0 && (ph % 7) < 1.2 ? Math.sin(((ph % 7) / 1.2) * Math.PI) : 0;
        v3.cells[i] = { k: wave * 0.5, sel: false, hover: false };
        v3.stones.push({ v: P.grid[i], kind: isGiven(P, i) ? 'given' : 'stone', where: 'cell', cell: i, glow: wave, lift: wave * 0.5 });
      }
      drawGaugeText3D(ctx, s, null);
    }
  } else {
  drawBoardFrame(ctx, b);
  if (P) { drawBanner(ctx, b, P.puz.M, P.puz.pan); for (const ln of lines) { const p = gaugePos(b, P.puz.pan, ln); gauge(ctx, p.x, p.y, b.gauges.r, P.puz.M, P.puz.M, true, {}); } }
  for (let i = 0; i < n * n; i++) {
    const r = b.cells[i];
    rr(ctx, r.x, r.y, r.w, r.h, cell * 0.14); ctx.fillStyle = T.socket; ctx.fill();
    const ph = s.t * 1.8 - ((i % n) + Math.floor(i / n)) * 0.25, wave = ph > 0 && (ph % 7) < 1.2 ? Math.sin(((ph % 7) / 1.2) * Math.PI) : 0;
    if (P) drawStone(ctx, r.x + r.w / 2, r.y + r.h / 2, cell * 0.4, P.grid[i], { kind: isGiven(P, i) ? 'given' : 'stone', glow: wave, lift: wave * 0.5, style, flat: cell < 22 });
  }
  }
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    const compact = O.wide, tsz = compact ? 38 : 50, z = Math.min(sc, 1.5);
    txt(ctx, R0.daily ? 'Daily Square solved' : 'Every line adds up', body.x + body.w / 2, y + tsz * 0.55, { size: F(tsz) * z, weight: 700, color: T.text, align: 'center', maxW: body.w, min: 20, fam: NUM }); y += (tsz + 12) * z;
    const sz = compact ? 36 : 52;
    for (let k = 0; k < 3; k++) icons.star(ctx, body.x + body.w / 2 + (k - 1) * (sz + 10), y + sz / 2, sz, k < R0.stars ? '#ffc93c' : 'rgba(128,128,128,0.35)');
    y += sz + (compact ? 8 : 16);
    const facts = [['Time', fmtTime(R0.time)], ['Par', fmtTime(R0.par)], ['Wrong stones', R0.errs], ['Hints', R0.hints]];
    const cols = body.w > 330 ? 4 : 2, fw = (body.w - 8 * (cols - 1)) / cols, fh = (compact ? 66 : 82) * Math.min(sc, 1.7);
    facts.forEach(([l, v], i) => {
      const r = R(body.x + (i % cols) * (fw + 8), y + Math.floor(i / cols) * (fh + 8), fw, fh);
      panel(ctx, r, { radius: 14 });
      txt(ctx, v, r.x + r.w / 2, r.y + fh * 0.4, { size: F(compact ? 28 : 34) * z, weight: 700, color: T.text, align: 'center', maxW: fw - 8, min: 14 });
      txt(ctx, l, r.x + r.w / 2, r.y + fh * 0.78, { size: F(22) * z, weight: 400, color: T.dim, align: 'center', maxW: fw - 6, min: 11 });
    });
    y += Math.ceil(facts.length / cols) * (fh + 8) + 4;
    if (R0.newBest) { txt(ctx, 'New best time for this kind of square', body.x + body.w / 2, y + 16, { size: F(24) * sc, weight: 600, color: T.good, align: 'center', maxW: body.w, min: 12 }); y += 40 * sc; }
    if (R0.daily) { y += para(ctx, `Daily streak: ${R0.streak} day${R0.streak === 1 ? '' : 's'}`, body.x, y, body.w, { size: F(28) * sc, weight: 600, color: T.accent, align: 'center' }) + 8; }
    if (R0.techs.length) {
      txt(ctx, 'Hints used these ideas', body.x, y + 16 * sc, { size: F(26) * sc, weight: 700, color: T.accent }); y += 38 * sc;
      for (const t of R0.techs) y += para(ctx, `${t.name}  ×${t.n}`, body.x + 8, y, body.w - 16, { size: F(25) * sc, weight: 500, color: T.text }) + 4;
    }
    txt(ctx, 'Did you know', body.x, y + 16 * sc, { size: F(26) * sc, weight: 700, color: T.accent }); y += 38 * sc;
    y += para(ctx, FACTS[R0.variant], body.x + 8, y, body.w - 16, { size: F(28) * sc, weight: 400, color: T.dim, lh: 1.3 }) + 6;
    return y - body.y + 10;
  });
  const nextLabel = R0.kind === 'journey' ? (R0.next ? 'Next square' : 'Back to the Journey') : R0.daily ? 'Back to menu' : 'Another square';
  button(ctx, O.btns.next, nextLabel, { kind: 'accent', size: 32, flash: flashOf(s, 'next') });
  button(ctx, O.btns.share, 'Share', { size: 28, flash: flashOf(s, 'share') });
  button(ctx, O.btns.menu, R0.kind === 'journey' ? 'Journey' : R0.daily ? 'Free Play' : 'Menu', { size: 28, flash: flashOf(s, 'menu') });
  drawMoreLine(ctx, O.more.x, O.more.y, 15);
}

function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28 }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the demo end', c.x + c.w / 2, c.y + 70, { size: F(36), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18, fam: NUM });
  para(ctx, 'The full game has the whole Journey from 3 x 3 to 5 x 5, the broken-diagonal squares, the Daily Square, hints that teach and Watch and Learn. Get Lo Shu Magic Square on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(26), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
