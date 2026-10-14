// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawStars, clamp } from './art.js';
import { txt, button, panel, rrect, chip, wrap, minUnits } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderStage, ordinal, fmtTime } from './playview.js';
import { ABOUT, HOWTO, rulesPages, THINK_CHOICES } from './content.js';
import { COURSES, LOOKS } from './courses.js';
import { DEMO_RUNS } from './sim.js';
import { drawCredit, drawLockup, drawMoreLine, edgeStroke } from './brand.js';
import { menuRects } from './layout.js';
import { gl } from './glhook.js';

const TAU = Math.PI * 2;

function titleText(ctx, cx, y, size, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const lines = [['HOOP ROLLING', size], ['TRUNDLE', size * 1.22]];
  let yy = y;
  lines.forEach(([label, sz], i) => {
    let s = sz;
    ctx.font = `700 ${s}px ${DISPLAY}`;
    const w0 = ctx.measureText(label).width;
    if (w0 > maxW) { s *= maxW / w0; ctx.font = `700 ${s}px ${DISPLAY}`; }
    // soft ground shadow, then the extrusion (stacked dark copies going down and slightly right), then the gold face with a bevel highlight
    const depth = Math.max(5, s * 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(label, cx + 3, yy + depth + 7);
    for (let d = depth; d >= 1; d -= 1) {
      const k = d / depth;
      ctx.fillStyle = `rgb(${Math.round(120 - 60 * k)},${Math.round(62 - 34 * k)},${Math.round(14 - 8 * k)})`;
      ctx.fillText(label, cx + d * 0.18, yy + d);
    }
    ctx.lineWidth = s * 0.15; ctx.strokeStyle = '#2a1306'; ctx.strokeText(label, cx, yy);
    const g = ctx.createLinearGradient(0, yy - s * 0.5, 0, yy + s * 0.5);
    g.addColorStop(0, '#fff7c8'); g.addColorStop(0.28, '#ffd35a'); g.addColorStop(0.55, '#f0a32a'); g.addColorStop(0.78, i ? '#e8472f' : '#c97a18'); g.addColorStop(1, i ? '#a8281a' : '#8a5410');
    ctx.fillStyle = g; ctx.fillText(label, cx, yy);
    ctx.save(); ctx.beginPath(); ctx.rect(cx - maxW, yy - s * 0.52, maxW * 2, s * 0.3); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillText(label, cx, yy - 1.5);
    ctx.restore();
    yy += s * 1.02;
  });
  // the ribbon under the title
  const label = 'The classic hoop-and-stick race', fs = size * 0.3;
  ctx.font = `700 ${fs}px ${UI}`;
  const tw = Math.min(maxW * 0.92, ctx.measureText(label).width + fs * 2.6), th = fs * 1.9, ry = yy + size * 0.12;
  const rg = ctx.createLinearGradient(0, ry - th / 2, 0, ry + th / 2); rg.addColorStop(0, '#7a2a1c'); rg.addColorStop(1, '#4a140c');
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(cx - tw / 2 + 2, ry - th / 2 + 5, tw, th, th * 0.18); ctx.fill();
  ctx.fillStyle = rg; ctx.beginPath(); ctx.roundRect(cx - tw / 2, ry - th / 2, tw, th, th * 0.18); ctx.fill();
  ctx.lineWidth = 2.5; const bg = ctx.createLinearGradient(0, ry - th / 2, 0, ry + th / 2); bg.addColorStop(0, '#ffe39a'); bg.addColorStop(1, '#8a5e18'); ctx.strokeStyle = bg; ctx.stroke();
  txt(ctx, label, cx, ry + 1, fs, '#fff1cc', { align: 'center', weight: 700, maxW: tw - fs });
  ctx.restore();
}

// A live menu backdrop: the performer rolling a hoop down a course behind the menu. On the title the scene is limited to the hero area
// (above the buttons / left of them) so it is never hidden; other menus use the whole screen, dimmed.
// menu screens that show the live 3D lane behind them (the text screens keep the quiet 2D backdrop)
const MENU_3D = new Set(['title', 'courses', 'detail', 'result', 'demo-limit']);
function backdrop(ctx, st, L, w, h) {
  const m = st.menu;
  let stage = { x: 0, y: 0, w, h }, plate = null;
  if (st.scene === 'title') {
    const T = L.title;
    if (L.mode === 'wide') { stage = { x: 0, y: 0, w: T.play.x - 24, h }; plate = { x: stage.w, y: 0, w: w - stage.w, h }; }
    else { const bot = T.hero.y + T.hero.h + 14; stage = { x: 0, y: 0, w, h: bot }; plate = { x: 0, y: bot, w, h: h - bot }; }
  }
  if (plate) {
    const pg = ctx.createLinearGradient(0, plate.y, 0, plate.y + plate.h);
    if (gl.active) { pg.addColorStop(0, 'rgba(14,30,44,0.0)'); pg.addColorStop(0.18, 'rgba(12,26,38,0.74)'); pg.addColorStop(1, 'rgba(8,16,24,0.92)'); }
    else { pg.addColorStop(0, '#16384a'); pg.addColorStop(0.3, '#10283a'); pg.addColorStop(1, '#0b1824'); }
    ctx.fillStyle = pg; ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
  } else if (!gl.active) { ctx.fillStyle = '#0d1b26'; ctx.fillRect(0, 0, w, h); }
  renderStage(ctx, m, stage, st.t, { frac: st.scene === 'title' ? 0.7 : undefined, gl: MENU_3D.has(st.scene) });
  const g = ctx.createLinearGradient(0, 0, 0, stage.h);
  if (st.scene === 'title') { g.addColorStop(0, 'rgba(10,22,32,0.5)'); g.addColorStop(0.32, 'rgba(10,22,32,0.0)'); g.addColorStop(1, 'rgba(10,22,32,0.0)'); }
  else { g.addColorStop(0, 'rgba(10,22,32,0.64)'); g.addColorStop(1, 'rgba(10,22,32,0.84)'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, stage.w, stage.h);
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  gl.frame = null; gl.size = { w, h };
  if (gl.active) ctx.clearRect(0, 0, w, h);
  if (sc === 'play') {
    meta.previewBadge = { x: L.play.stage.x + L.play.stage.w / 2, y: L.play.track.y + L.play.track.h + 40, align: 'center' };
    renderPlay(ctx, st.pl, L, view, meta, pauseItems, drawPauseMenu); drawToast(ctx, st, L); return;
  }
  backdrop(ctx, st, L, w, h);
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else if (sc === 'courses') renderCourses(ctx, st, L);
  else if (sc === 'detail') renderDetail(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L, w, h);
  else if (sc === 'rules') renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: 'Rules  ' + (st.rulesPage + 1) + '/' + rulesPages().length, blocks: rulesPages()[st.rulesPage].blocks, nav: true, page: st.rulesPage, pages: rulesPages().length, sub: rulesPages()[st.rulesPage].title });
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: ABOUT.title, blocks: ABOUT.blocks });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: HOWTO.title, blocks: HOWTO.blocks });
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(10,22,32,0.9)', stroke: 'rgba(255,255,255,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Watch and Learn pauses before each section'),
    row('ring', 'Control hints', 'toggle', () => p.ring, 'Always show the push and brake line'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No screen shake'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', 'Restore purchase', 'button', () => '', () => st.restoreMsg || (st.owned ? 'Full game unlocked' : 'Check for an earlier purchase'), { btn: () => (st.restoreBusy ? 'Checking' : st.owned ? 'Unlocked' : 'Restore') })]),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S;
  const cx = L.mode === 'wide' ? S.x + (T.play.x - S.x) / 2 : S.x + S.w / 2;
  titleText(ctx, cx, T.titleY, T.size, (L.mode === 'wide' ? T.play.x - S.x - 40 : S.w - 40));
  button(ctx, T.play, 'Play', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = L.mode === 'wide' ? 190 : 250;
  if (!drawLockup(ctx, T.credit.x, T.credit.y - lw * 0.1, lw)) drawCredit(ctx, T.credit.x, T.credit.y, 15, { dim: 0.9 });
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_RUNS - st.demoRuns)} left`, 20, { align: 'right', fill: 'rgba(10,22,32,0.8)' });
  void w; void h;
}

// ---- courses + detail ------------------------------------------------------------------------------------------------------------
function stars(ctx, cx, cy, size, n) { drawStars(ctx, cx, cy, size, n, 3, 1.25); }

// The course as a small map: the road's path (integrated from its curvature), zones coloured, gates ticked.
const mapCache = new Map();
function mapPts(C) {
  let m = mapCache.get(C.id);
  if (m) return m;
  const pts = []; let x = 0, y = 0, h = -Math.PI / 2;
  for (let s = 0; s <= C.length; s += 2) {
    pts.push([x, y, s]);
    h += C.kap[Math.round(s / 0.5)] * 2; x += Math.cos(h) * 2; y += Math.sin(h) * 2;
  }
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  m = { pts, x0, x1, y0, y1 }; mapCache.set(C.id, m); return m;
}
function courseMap(ctx, r, C) {
  const m = mapPts(C), pad = 14;
  const sw = Math.max(1, m.x1 - m.x0), sh = Math.max(1, m.y1 - m.y0);
  const k = Math.min((r.w - pad * 2) / sw, (r.h - pad * 2) / sh);
  const ox = r.x + (r.w - sw * k) / 2 - m.x0 * k, oy = r.y + (r.h - sh * k) / 2 - m.y0 * k;
  const P = (p) => [ox + p[0] * k, oy + p[1] * k];
  ctx.save();
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const lw = clamp(Math.min(r.w, r.h) * 0.07, 4, 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = lw + 4; ctx.beginPath();
  m.pts.forEach((p, i) => { const q = P(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
  ctx.strokeStyle = C.theme.road; ctx.lineWidth = lw; ctx.beginPath();
  m.pts.forEach((p, i) => { const q = P(p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }); ctx.stroke();
  const zc = { plank: '#6a4220', mud: '#4a3018', cobble: '#9a9486', slope: '#e8c24a' };
  for (const z of C.zones) {
    if (z.kind === 'slope') continue;
    ctx.strokeStyle = zc[z.kind]; ctx.lineWidth = lw; ctx.beginPath();
    let first = true;
    for (const p of m.pts) { if (p[2] < z.s0 || p[2] > z.s1) continue; const q = P(p); if (first) { ctx.moveTo(q[0], q[1]); first = false; } else ctx.lineTo(q[0], q[1]); }
    ctx.stroke();
  }
  for (const g of C.gates) {
    const p = m.pts[Math.min(m.pts.length - 1, Math.round(g.s / 2))], q = P(p);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(2, lw * 0.28), 0, TAU); ctx.fill();
  }
  const a = P(m.pts[0]), b = P(m.pts[m.pts.length - 1]);
  ctx.fillStyle = '#27b59a'; ctx.beginPath(); ctx.arc(a[0], a[1], lw * 0.8, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8472f'; ctx.beginPath(); ctx.arc(b[0], b[1], lw * 0.8, 0, TAU); ctx.fill();
  ctx.restore();
}

function renderCourses(ctx, st, L) {
  const G = L.courses, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a course', S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), G.titleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 380 });
  G.cards.forEach((r, i) => {
    const c = COURSES[i], best = st.best[c.id] ?? {};
    const locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(10,22,32,0.82)', rad: 24, stroke: locked ? 'rgba(255,255,255,0.1)' : 'rgba(255,214,150,0.35)' });
    const pad = 16;
    txt(ctx, `${i + 1}`, r.x + pad + 14, r.y + pad + 20, 34, PAL.gold, { font: DISPLAY, weight: 700 });
    txt(ctx, c.name, r.x + pad + 48, r.y + pad + 20, 26, locked ? PAL.dim : PAL.text, { weight: 700, maxW: r.w - pad * 2 - 48 });
    const bs = Math.max(19, minUnits()), blh = bs * 1.28;
    ctx.font = `500 ${bs}px ${UI}`;
    const maxL = r.h > 230 ? 3 : 2;
    const all = wrap(ctx, c.blurb, r.w - pad * 2), lines = all.slice(0, maxL);
    if (all.length > maxL) lines[maxL - 1] = lines[maxL - 1].replace(/[ ,.;]*\S*$/, '') + '...';
    lines.forEach((ln, li) => txt(ctx, ln, r.x + pad, r.y + 76 + li * blh, bs, PAL.dim, { weight: 500 }));
    const my = r.y + 76 + lines.length * blh + 6, mh = r.y + r.h - 62 - my;
    if (mh > 40) courseMap(ctx, { x: r.x + pad, y: my, w: r.w - pad * 2, h: mh }, c);
    txt(ctx, `${c.length} m`, r.x + pad, r.y + r.h - 28, 21, PAL.text, { weight: 700, maxW: r.w * 0.3 });
    stars(ctx, r.x + r.w / 2 + 6, r.y + r.h - 28, 13, best.stars ?? 0);
    if (best.place !== undefined) txt(ctx, ordinal(best.place), r.x + r.w - pad, r.y + r.h - 28, 24, PAL.cream, { align: 'right', weight: 700, maxW: r.w * 0.25 });
    if (locked) txt(ctx, 'Full game', r.x + r.w - pad, r.y + pad + 20, 17, PAL.dim, { align: 'right', weight: 600 });
  });
}

const SKILL_NAMES = ['Beginner', 'Steady', 'Quick', 'Expert'];
function skillName(s) { return SKILL_NAMES[s < 0.45 ? 0 : s < 0.65 ? 1 : s < 0.82 ? 2 : 3]; }
function roadList(C) {
  const n = (k) => C.zones.filter((z) => z.kind === k).length;
  const rows = [
    ['#ffffff', 'Gates', C.gates.length], ['#d6a05a', 'Plank bridges', n('plank')], ['#9a9486', 'Cobbled stretches', n('cobble')],
    ['#6c4a2c', 'Mud patches', n('mud')], ['#bfe6f5', 'Puddles', C.puddles.length], ['#e8c24a', 'Hills', n('slope')],
    ['#27b59a', 'Sharp bends', C.bends.filter((b) => Math.abs(b.k) >= 0.055).length],
  ];
  return rows.filter((r) => r[2] > 0);
}

function renderDetail(ctx, st, L) {
  const D = L.detail, S = L.S, c = COURSES[st.sel], best = st.best[c.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, c.name, S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), L.courses.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 380 });
  const I = D.info;
  panel(ctx, I, { rad: 26 });
  const pad = 22, wide = I.w > 640;
  const bs = Math.max(24, minUnits()), blh = bs * 1.33;
  ctx.font = `500 ${bs}px ${UI}`;
  const lines = wrap(ctx, c.blurb, I.w - pad * 2).slice(0, 3);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + pad, I.y + 38 + i * blh, bs, PAL.text, { weight: 500 }));
  let y = I.y + 38 + lines.length * blh + 8;
  txt(ctx, `${c.length} m  ·  par ${c.par} s  ·  ${c.theme.label}`, I.x + pad, y, 21, PAL.dim, { weight: 600, maxW: I.w - pad * 2 }); y += 20;
  const colW = wide ? (I.w - pad * 2 - 20) / 2 : I.w - pad * 2;
  const road = roadList(c);
  const listH = wide ? Math.max(road.length * 28, 3 * 40 + 20) + 40 : road.length * 28 + 3 * 40 + 70;
  const mapH = clamp(I.y + I.h - 60 - (y + 8) - listH, 70, 520);
  courseMap(ctx, { x: I.x + pad, y: y + 8, w: I.w - pad * 2, h: mapH }, c); y += mapH + 40;
  txt(ctx, 'On the road', I.x + pad, y, 20, PAL.gold, { weight: 700 });
  road.forEach((r, i) => {
    const yy = y + 30 + i * 28;
    if (!wide && yy > I.y + I.h - 120) return;
    ctx.fillStyle = r[0]; ctx.beginPath(); ctx.arc(I.x + pad + 10, yy, 8, 0, TAU); ctx.fill();
    txt(ctx, `${r[1]}`, I.x + pad + 28, yy, 20, PAL.text, { weight: 600, maxW: colW - 80 });
    txt(ctx, `${r[2]}`, I.x + pad + colW - 10, yy, 21, PAL.cream, { align: 'right', weight: 700 });
  });
  const rx = wide ? I.x + pad + colW + 20 : I.x + pad, ry = wide ? y : Math.min(y + 30 + road.length * 28 + 14, I.y + I.h - 150);
  if (wide || ry < I.y + I.h - 100) {
    txt(ctx, 'Rivals', rx, ry, 20, PAL.gold, { weight: 700 });
    c.rivals.forEach((rv, i) => {
      const yy = ry + 34 + i * 40, look = LOOKS[rv.look];
      if (yy > I.y + I.h - 60) return;
      ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.arc(rx + 14, yy, 14, 0, TAU); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
      txt(ctx, rv.name, rx + 38, yy, 22, PAL.text, { weight: 600, maxW: colW * 0.4 });
      txt(ctx, skillName(rv.skill), rx + colW - 8, yy, 19, PAL.dim, { align: 'right', weight: 600, maxW: colW * 0.4 });
    });
  }
  const by = I.y + I.h - 36;
  stars(ctx, I.x + pad + 50, by, 18, best.stars ?? 0);
  txt(ctx, best.score ? `Best ${best.score}  ·  ${ordinal(best.place)}  ·  ${fmtTime(best.time)}` : 'Not raced yet', I.x + I.w - pad, by, 22, PAL.cream, { align: 'right', weight: 600, maxW: I.w * 0.58 });
  button(ctx, D.learn, 'Practice', { kind: 'quiet', size: 32, sub: 'Steadier hoop, with a hint button', icon: 'bulb' });
  button(ctx, D.race, 'Race', { kind: 'primary', size: 36, sub: 'Three rivals, scored', icon: 'play' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The game rolls it for you', icon: 'eye' });
}

// ---- result --------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L, w, h) {
  const Rr = L.result, r = st.result, p = Rr.panel, c = COURSES[r.ci];
  panel(ctx, p, { fill: 'rgba(8,18,28,0.93)', rad: 30 });
  edgeStroke(ctx, p, 30, 0.5);
  const cx = p.x + p.w / 2, wide = L.mode === 'wide';
  const head = r.mode === 'auto' ? 'WATCH COMPLETE' : !r.finished ? 'TIME RAN OUT' : r.place === 0 ? 'YOU WON!' : `YOU FINISHED ${ordinal(r.place).toUpperCase()}`;
  if (wide) {
    // two columns: the headline on the left, the numbers on the right (the panel is short in landscape)
    const lx = p.x + p.w * 0.27, rx = p.x + p.w * 0.54, rw = p.x + p.w - 40 - rx;
    const gold = r.place === 0 && r.mode !== 'auto' ? PAL.gold : PAL.text;
    txt(ctx, head, lx, p.y + 52, 32, gold, { align: 'center', font: DISPLAY, weight: 700, maxW: p.w * 0.46 });
    txt(ctx, c.name, lx, p.y + 92, 24, PAL.dim, { align: 'center', weight: 600, maxW: p.w * 0.46 });
    stars(ctx, lx, p.y + 150, 34, r.mode === 'race' ? r.stars : 0);
    txt(ctx, String(r.score), lx, p.y + 232, 80, PAL.cream, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: p.w * 0.4 });
    txt(ctx, `Time ${fmtTime(r.time)}  ·  par ${c.par} s`, lx, p.y + 298, 24, PAL.gold, { align: 'center', weight: 700, maxW: p.w * 0.46 });
    if (r.newBest) txt(ctx, 'NEW BEST', lx, p.y + 336, 22, PAL.tealHi, { align: 'center', weight: 700 });
    const rows2 = [['Gates (perfect / good / missed)', `${r.perfect} / ${r.good} / ${r.missed}`, PAL.text], ['Longest chain', r.maxChain, '#ffe07a'], ['Posts hit', r.posts, PAL.tealHi], ['Falls', r.falls, PAL.rose], ['Average speed', `${(c.length / Math.max(1, r.time)).toFixed(1)} m/s`, PAL.text]];
    rows2.forEach(([n, v, col], i) => {
      txt(ctx, n, rx, p.y + 70 + i * 44, 22, col, { weight: 600, maxW: rw * 0.7 });
      txt(ctx, String(v), rx + rw, p.y + 70 + i * 44, 25, PAL.text, { align: 'right', weight: 700 });
    });
    if (r.names) txt(ctx, r.names.map((n, i) => `${i + 1} ${n}`).join('   '), rx + rw / 2, p.y + 70 + 5 * 44 + 20, 20, PAL.dim, { align: 'center', weight: 600, maxW: rw });
    button(ctx, Rr.again, 'Again', { kind: 'primary', size: 30, icon: 'restart' });
    button(ctx, Rr.courses, 'Courses', { kind: 'quiet', size: 30 });
    button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
    drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
    return;
  }
  txt(ctx, head, cx, p.y + 52, 32, r.place === 0 && r.mode !== 'auto' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 700, maxW: p.w - 40 });
  txt(ctx, c.name, cx, p.y + 96, 24, PAL.dim, { align: 'center', weight: 600, maxW: p.w - 40 });
  stars(ctx, cx, p.y + 164, 36, r.mode === 'race' ? r.stars : 0);
  txt(ctx, String(r.score), cx, p.y + 252, 84, PAL.cream, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: p.w - 60 });
  txt(ctx, `Time ${fmtTime(r.time)}  ·  par ${c.par} s`, cx, p.y + 318, 24, PAL.gold, { align: 'center', weight: 700, maxW: p.w - 60 });
  if (r.newBest) txt(ctx, 'NEW BEST', cx, p.y + 356, 22, PAL.tealHi, { align: 'center', weight: 700 });
  const top = p.y + (r.newBest ? 396 : 372), ch = wide ? 32 : 38;
  const rows = [['Gates (perfect / good / missed)', `${r.perfect} / ${r.good} / ${r.missed}`, PAL.text], ['Longest chain', r.maxChain, '#ffe07a'], ['Posts hit', r.posts, PAL.tealHi], ['Falls', r.falls, PAL.rose], ['Average speed', `${(c.length / Math.max(1, r.time)).toFixed(1)} m/s`, PAL.text]];
  const gx = p.x + 50, gw = p.w - 100;
  rows.forEach(([n, v, col], i) => {
    txt(ctx, n, gx, top + i * ch, 22, col, { weight: 600, maxW: gw * 0.7 });
    txt(ctx, String(v), gx + gw, top + i * ch, 25, PAL.text, { align: 'right', weight: 700 });
  });
  if (r.names && !wide && top + rows.length * ch + 30 < Rr.again.y) txt(ctx, r.names.map((n, i) => `${i + 1} ${n}`).join('   '), cx, top + rows.length * ch + 14, 20, PAL.dim, { align: 'center', weight: 600, maxW: p.w - 50 });
  button(ctx, Rr.again, 'Again', { kind: 'primary', size: 30, icon: 'restart' });
  button(ctx, Rr.courses, 'Courses', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
  void w; void h;
}

// ---- pause / end menu + demo limit ------------------------------------------------------------------------------------------------
const PAUSE_LABELS = { resume: 'Resume', restart: 'Restart', quit: 'Courses' };
function drawPauseMenu(ctx, st, L, items) {
  ctx.fillStyle = 'rgba(4,10,18,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(10,22,36,0.95)', rad: 28 });
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 52, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700 });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' ? 'primary' : 'quiet', size: 30 }));
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  panel(ctx, p, { fill: 'rgba(8,18,28,0.93)', rad: 30 });
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 70, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: p.w - 40 });
  txt(ctx, 'The full game has eight courses,', p.x + p.w / 2, p.y + 160, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'bridges, mud, cobbles and hills.', p.x + p.w / 2, p.y + 200, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'Get Hoop Rolling Trundle for iPhone and Android.', p.x + p.w / 2, p.y + 270, 24, PAL.tealHi, { align: 'center', weight: 700, maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 350, 22, PAL.dim, { align: 'center', weight: 600 });
  void st;
}
