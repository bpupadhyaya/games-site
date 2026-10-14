// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawStars, clamp, ease } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay, renderStage, ordinal, fmtTime } from './playview.js';
import { ABOUT, HOWTO, rulesPages, THINK_CHOICES } from './content.js';
import { COURSES, LOOKS } from './courses.js';
import { DEMO_RUNS, STAR_PLACE } from './sim.js';
import { walkerJoints, drawWalker, demoRacer } from './figure.js';
import { drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { menuRects } from './layout.js';
import { GL } from './gl.js';

const TAU = Math.PI * 2;

function titleText(ctx, cx, y, size, label, sub, maxW = 1e9) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${size}px ${DISPLAY}`;
  const w0 = ctx.measureText(label).width;
  if (w0 > maxW) { size *= maxW / w0; ctx.font = `${size}px ${DISPLAY}`; }
  const wmax = ctx.measureText(label).width;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(0.55, '#ffcf4a'); g.addColorStop(1, '#f08a24');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#2a1408'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,170,50,0.6)'; ctx.shadowBlur = size * 0.25; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.78, size * 0.3, PAL.text, { align: 'center', weight: 700, stroke: 6, maxW: wmax * 1.1 });
}

// A live menu backdrop: the Watch and Learn performer and rivals walking a course behind the menu. On the title the scene is limited to
// the hero area (above the buttons / left of them) so the people are never hidden; other menus use the whole screen, dimmed.
function backdrop(ctx, st, L, w, h) {
  const m = st.menu, S = L.S;
  let stage = { x: 0, y: 0, w, h }, plate = null;
  if (st.scene === 'title') {
    const T = L.title;
    if (L.mode === 'wide') { stage = { x: 0, y: 0, w: T.play.x - 24, h }; plate = { x: stage.w, y: 0, w: w - stage.w, h }; }
    else { const bot = T.hero.y + T.hero.h + 14; stage = { x: 0, y: 0, w, h: bot }; plate = { x: 0, y: bot, w, h: h - bot }; }
  }
  if (plate) {
    const pg = ctx.createLinearGradient(0, plate.y, 0, plate.y + plate.h);
    pg.addColorStop(0, '#3a2414'); pg.addColorStop(0.25, '#241636'); pg.addColorStop(1, '#14102a');
    ctx.fillStyle = pg; ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
  } else ctx.fillStyle = '#1a1030', ctx.fillRect(0, 0, w, h);
  renderStage(ctx, m, stage, st.t, { guide: false });
  const g = ctx.createLinearGradient(0, 0, 0, stage.h);
  if (st.scene === 'title') { g.addColorStop(0, 'rgba(20,10,40,0.45)'); g.addColorStop(0.3, 'rgba(20,10,40,0.0)'); g.addColorStop(1, 'rgba(20,10,40,0.0)'); }
  else { g.addColorStop(0, 'rgba(20,10,40,0.6)'); g.addColorStop(1, 'rgba(20,10,40,0.82)'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, stage.w, stage.h);
  void S;
}

// The credits for the 3D people layer (public text shipped as vendor3d/LICENSES.md), turned into About blocks. Empty until fetched / without 3D.
let licCache = { src: '', blocks: [] };
function aboutLicenses() {
  const src = (GL.p && GL.p.ready && GL.p.licenses) || '';
  if (src === licCache.src) return licCache.blocks;
  const blocks = []; let para = [];
  const flush = () => { if (para.length) { blocks.push({ p: para.join(' ') }); para = []; } };
  for (const line of src.split('\n')) {
    if (/^# /.test(line) || /^Games that ship/.test(line) || /^\(`fetch/.test(line)) { flush(); continue; }
    if (/^## /.test(line)) { flush(); blocks.push({ h: line.replace(/^## /, '') }); continue; }
    if (!line.trim()) { flush(); continue; }
    para.push(line.replace(/^\* /, '').trim());
  }
  flush();
  licCache = { src, blocks };
  return blocks;
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  if (sc === 'play') {
    meta.previewBadge = { x: L.play.stage.x + L.play.stage.w / 2, y: L.play.stage.y + 6, align: 'center' };
    renderPlay(ctx, st.pl, L, view, meta, pauseItems, drawPauseMenu); drawToast(ctx, st, L); return;
  }
  backdrop(ctx, st, L, w, h);
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else if (sc === 'courses') renderCourses(ctx, st, L);
  else if (sc === 'detail') renderDetail(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L, w, h);
  else if (sc === 'rules') renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: 'Rules  ' + (st.rulesPage + 1) + '/' + rulesPages().length, blocks: rulesPages()[st.rulesPage].blocks, nav: true, page: st.rulesPage, pages: rulesPages().length, sub: rulesPages()[st.rulesPage].title });
  else if (sc === 'about') { const lic = aboutLicenses(); renderDoc(ctx, st, L, { key: 'about' + lic.length, title: ABOUT.title, blocks: ABOUT.blocks.concat(lic) }); }
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: HOWTO.title, blocks: HOWTO.blocks });
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(14,10,36,0.9)', stroke: 'rgba(255,230,200,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Watch and Learn pauses before each section'),
    row('ring', 'Landing ring', 'toggle', () => p.ring, 'Show where the next stilt will land'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No screen shake'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.canRestore ? [row('restore', 'Restore purchase', 'button', () => '', 'Bought it before? Get it back', { btn: 'Restore' })] : []),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S;
  const cx = L.mode === 'wide' ? S.x + (T.play.x - S.x) / 2 : S.x + S.w / 2;
  titleText(ctx, cx, T.titleY, T.size, 'EGRANG', 'Bamboo stilt race', (L.mode === 'wide' ? T.play.x - S.x - 40 : S.w - 40));
  button(ctx, T.play, 'Play', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  drawCredit(ctx, T.credit.x, T.credit.y, 15, { dim: 0.9 });
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_RUNS - st.demoRuns)} left`, 20, { align: 'right', fill: 'rgba(14,10,36,0.8)' });
}

// ---- courses + detail ------------------------------------------------------------------------------------------------------------
function stars(ctx, cx, cy, size, n) { drawStars(ctx, cx, cy, size, n, 3, 1.25); }

function strip(ctx, r, C) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,240,210,0.1)'; rrect(ctx, r, r.h / 2); ctx.fill();
  const x0 = r.x + r.h / 2, x1 = r.x + r.w - r.h / 2, y = r.y + r.h / 2;
  ctx.strokeStyle = 'rgba(255,240,210,0.5)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  const col = { stream: '#5cc8e8', plank: '#d6a05a', mud: '#8a5a34', bund: '#9cc060' };
  for (const g of C.segs) { ctx.strokeStyle = col[g.kind]; ctx.lineWidth = r.h * 0.5; ctx.beginPath(); ctx.moveTo(x0 + (x1 - x0) * g.x0 / C.length, y); ctx.lineTo(x0 + (x1 - x0) * g.x1 / C.length, y); ctx.stroke(); }
  for (const s of C.spots) { ctx.fillStyle = s.kind === 'puddle' ? '#bfe6f5' : s.kind === 'hole' ? '#1c0e06' : '#a9a69a'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * s.x / C.length, y, r.h * 0.2, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function renderCourses(ctx, st, L) {
  const G = L.courses, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a course', S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), G.titleY, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w - 380 });
  G.cards.forEach((r, i) => {
    const c = COURSES[i], best = st.best[c.id] ?? {};
    const locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(16,10,36,0.8)', rad: 24, stroke: locked ? 'rgba(255,255,255,0.1)' : 'rgba(255,214,150,0.35)' });
    const pad = 16;
    txt(ctx, `${i + 1}`, r.x + pad + 14, r.y + pad + 20, 34, PAL.gold, { font: DISPLAY, weight: 400 });
    txt(ctx, c.name, r.x + pad + 48, r.y + pad + 20, 26, locked ? PAL.dim : PAL.text, { weight: 800, maxW: r.w - pad * 2 - 48 });
    ctx.font = `500 19px ${UI}`;
    // as many blurb lines as fit above the road strip; an ellipsis when the text is longer
    const stripY = r.y + r.h - 86, maxLines = Math.max(1, Math.floor((stripY - 10 - (r.y + 64)) / 25));
    const all = wrap(ctx, c.blurb, r.w - pad * 2), lines = all.slice(0, maxLines);
    if (all.length > maxLines) { let l = lines[maxLines - 1]; while (l.length > 3 && ctx.measureText(l + '…').width > r.w - pad * 2) l = l.slice(0, -1); lines[maxLines - 1] = l.replace(/[ ,.;:]+$/, '') + '…'; }
    lines.forEach((ln, li) => txt(ctx, ln, r.x + pad, r.y + 76 + li * 25, 19, PAL.dim, { weight: 500 }));
    strip(ctx, { x: r.x + pad, y: stripY, w: r.w - pad * 2, h: 24 }, c);
    const lenTxt = `${c.length} m`; ctx.font = `700 21px ${UI}`; const lw = Math.min(ctx.measureText(lenTxt).width, r.w * 0.3);
    txt(ctx, lenTxt, r.x + pad, r.y + r.h - 28, 21, PAL.text, { weight: 700, maxW: r.w * 0.3 });
    stars(ctx, Math.max(r.x + r.w / 2 + 6, r.x + pad + lw + 22 + 41), r.y + r.h - 28, 13, best.stars ?? 0);
    if (best.place !== undefined) txt(ctx, ordinal(best.place), r.x + r.w - pad, r.y + pad + 20, 22, PAL.cream, { align: 'right', weight: 800, maxW: r.w * 0.22 });
    if (locked) txt(ctx, 'Full game', r.x + r.w - pad, r.y + pad + 20, 17, PAL.dim, { align: 'right', weight: 700 });
  });
}

const SKILL_NAMES = ['Beginner', 'Steady', 'Quick', 'Expert'];
function skillName(s) { return SKILL_NAMES[s < 0.45 ? 0 : s < 0.65 ? 1 : s < 0.82 ? 2 : 3]; }
function roadList(C) {
  const n = (f) => C.features.filter(f).length;
  const rows = [
    ['#5cc8e8', 'Stepping-stone crossings', n((f) => f.kind === 'stream')], ['#d6a05a', 'Plank bridges', n((f) => f.kind === 'plank')],
    ['#9cc060', 'Narrow bunds', n((f) => f.kind === 'bund')], ['#8a5a34', 'Mud patches', n((f) => f.kind === 'mud')],
    ['#bfe6f5', 'Puddles', n((f) => f.kind === 'puddle')], ['#c8a07a', 'Potholes', n((f) => f.kind === 'hole')],
    ['#a9a69a', 'Rocks', n((f) => f.kind === 'rock')], ['#e8c24a', 'Slopes', n((f) => f.kind === 'up' || f.kind === 'down')],
  ];
  return rows.filter((r) => r[2] > 0);
}

function renderDetail(ctx, st, L) {
  const D = L.detail, S = L.S, c = COURSES[st.sel], best = st.best[c.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, c.name, S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), L.courses.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, stroke: 6, maxW: S.w - 380 });
  const I = D.info;
  panel(ctx, I, { rad: 26 });
  const pad = 22, wide = I.w > 640;
  ctx.font = `600 24px ${UI}`;
  const lines = wrap(ctx, c.blurb, I.w - pad * 2).slice(0, 3);
  lines.forEach((ln, i) => txt(ctx, ln, I.x + pad, I.y + 38 + i * 32, 24, PAL.text, { weight: 600 }));
  let y = I.y + 38 + lines.length * 32 + 8;
  txt(ctx, `${c.length} m  ·  par ${c.par} s  ·  ${c.theme.label}`, I.x + pad, y, 21, PAL.dim, { weight: 600, maxW: I.w - pad * 2 }); y += 34;
  strip(ctx, { x: I.x + pad, y, w: I.w - pad * 2, h: 34 }, c); y += 62;
  // two columns when there is room: what is on the road, and the rivals
  const colW = wide ? (I.w - pad * 2 - 20) / 2 : I.w - pad * 2;
  const road = roadList(c);
  txt(ctx, 'On the road', I.x + pad, y, 20, PAL.gold, { weight: 800 });
  road.forEach((r, i) => {
    const yy = y + 30 + i * 28;
    if (!wide && yy > I.y + I.h - 150) return;
    ctx.fillStyle = r[0]; ctx.beginPath(); ctx.arc(I.x + pad + 10, yy, 8, 0, TAU); ctx.fill();
    txt(ctx, `${r[1]}`, I.x + pad + 28, yy, 20, PAL.text, { weight: 600, maxW: colW - 80 });
    txt(ctx, `${r[2]}`, I.x + pad + colW - 10, yy, 21, PAL.cream, { align: 'right', weight: 800 });
  });
  const rx = wide ? I.x + pad + colW + 20 : I.x + pad, ry = wide ? y : Math.min(y + 30 + road.length * 28 + 14, I.y + I.h - 150);
  txt(ctx, 'Rivals', rx, ry, 20, PAL.gold, { weight: 800 });
  c.rivals.forEach((rv, i) => {
    const yy = ry + 34 + i * 40, look = LOOKS[rv.look];
    ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.arc(rx + 14, yy, 14, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
    txt(ctx, rv.name, rx + 38, yy, 22, PAL.text, { weight: 700, maxW: colW * 0.4 });
    txt(ctx, skillName(rv.skill), rx + colW - 8, yy, 19, PAL.dim, { align: 'right', weight: 700, maxW: colW * 0.4 });
  });
  const by = I.y + I.h - 40;
  stars(ctx, I.x + pad + 50, by, 18, best.stars ?? 0);
  txt(ctx, best.score ? `Best ${best.score}  ·  ${ordinal(best.place)}  ·  ${fmtTime(best.time)}` : 'Not raced yet', I.x + I.w - pad, by, 22, PAL.cream, { align: 'right', weight: 700, maxW: I.w * 0.58 });
  button(ctx, D.learn, 'Practice', { kind: 'quiet', size: 32, sub: 'Gentler, with a hint button', icon: 'bulb' });
  button(ctx, D.race, 'Race', { kind: 'primary', size: 36, sub: 'Three rivals, scored', icon: 'play' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The game races it for you', icon: 'eye' });
}

// ---- result --------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L, w, h) {
  const Rr = L.result, r = st.result, p = Rr.panel, c = COURSES[r.ci];
  panel(ctx, p, { fill: 'rgba(14,8,34,0.92)', rad: 30 });
  edgeStroke(ctx, p, 30, 0.5);
  const cx = p.x + p.w / 2, wide = L.mode === 'wide';
  const head = r.mode === 'auto' ? 'WATCH COMPLETE' : r.place === 0 ? 'YOU WON!' : `YOU FINISHED ${ordinal(r.place).toUpperCase()}`;
  txt(ctx, head, cx, p.y + 52, 32, r.place === 0 && r.mode !== 'auto' ? PAL.gold : PAL.text, { align: 'center', font: DISPLAY, weight: 400, maxW: p.w - 40 });
  txt(ctx, c.name, cx, p.y + 96, 24, PAL.dim, { align: 'center', weight: 700, maxW: p.w - 40 });
  stars(ctx, cx, p.y + 164, 36, r.mode === 'race' ? r.stars : r.mode === 'auto' ? 0 : 0);
  txt(ctx, String(r.score), cx, p.y + 252, 84, PAL.cream, { align: 'center', font: DISPLAY, weight: 400, stroke: 8, maxW: p.w - 60 });
  txt(ctx, `Time ${fmtTime(r.time)}  ·  par ${c.par} s`, cx, p.y + 318, 24, PAL.gold, { align: 'center', weight: 800, maxW: p.w - 60 });
  if (r.newBest) txt(ctx, 'NEW BEST', cx, p.y + 356, 22, PAL.tealHi, { align: 'center', weight: 800 });
  const top = p.y + (r.newBest ? 396 : 372), ch = wide ? 32 : 38;
  const rows = [['Steps', r.steps, PAL.text], ['Perfect steps', r.perfect, '#ffe07a'], ['Longest chain', r.maxChain, PAL.tealHi], ['Falls', r.falls, PAL.rose]];
  const gx = p.x + 60, gw = p.w - 120;
  // landscape: the four stats sit in two columns so they never reach the buttons and the Arcforge line
  const colW = (gw - 40) / 2;
  rows.forEach(([n, v, col], i) => {
    const cx0 = wide ? gx + (i % 2) * (colW + 40) : gx, cw = wide ? colW : gw, yy = top + (wide ? Math.floor(i / 2) : i) * ch;
    txt(ctx, n, cx0, yy, 23, col, { weight: 700 });
    txt(ctx, String(v), cx0 + cw, yy, 25, PAL.text, { align: 'right', weight: 800 });
  });
  if (r.names && !wide) txt(ctx, r.names.map((n, i) => `${i + 1} ${n}`).join('   '), cx, top + rows.length * ch + 14, 20, PAL.dim, { align: 'center', weight: 700, maxW: p.w - 50 });
  button(ctx, Rr.again, 'Again', { kind: 'primary', size: 30, icon: 'restart' });
  button(ctx, Rr.courses, 'Courses', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

// ---- pause / end menu + demo limit ------------------------------------------------------------------------------------------------
const PAUSE_LABELS = { resume: 'Resume', restart: 'Restart', quit: 'Courses' };
function drawPauseMenu(ctx, st, L, items, pl) {
  ctx.fillStyle = 'rgba(8,4,20,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(16,10,38,0.95)', rad: 28 });
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 52, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 400 });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' ? 'primary' : 'quiet', size: 30 }));
  void pl;
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  panel(ctx, p, { fill: 'rgba(14,8,34,0.92)', rad: 30 });
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 70, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 400, maxW: p.w - 40 });
  txt(ctx, 'The full game has eight courses,', p.x + p.w / 2, p.y + 160, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'streams, bridges, mud and hills.', p.x + p.w / 2, p.y + 200, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'Get Egrang for iPhone and Android.', p.x + p.w / 2, p.y + 270, 26, PAL.tealHi, { align: 'center', weight: 800, maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 350, 22, PAL.dim, { align: 'center', weight: 600 });
  void STAR_PLACE; void ease; void walkerJoints; void drawWalker; void demoRacer;
}
