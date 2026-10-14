// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, SETTINGS, drawStars, drawScene, clamp, ease } from './art.js';
import { txt, button, panel, rrect, chip, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay } from './playview.js';
import { ABOUT, HOWTO, rulesPages } from './content.js';
import { LEVELS, THINK_CHOICES, DEMO_RUNS, rankOf } from './sim.js';
import { drawMini, TILT } from './mini.js';
import { drawCredit, drawLockup, drawMoreLine, edgeStroke } from './brand.js';
import { menuRects } from './layout.js';

function titleText(ctx, cx, y, size, label, sub, maxW = 1e9) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const w0 = ctx.measureText(label).width;
  if (w0 > maxW) { size *= maxW / w0; ctx.font = `700 ${size}px ${DISPLAY}`; }
  const wmax = ctx.measureText(label).width;
  // embossed gold lettering: dark ink outline, a lit bevel (light from the top left), a soft drop shadow, no blurry glow
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fffbe6'); g.addColorStop(0.35, '#ffd96b'); g.addColorStop(0.62, '#e8a42e'); g.addColorStop(1, '#b86a1c');
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(8,10,30,0.45)'; ctx.fillText(label, cx + size * 0.03, y + size * 0.085);
  ctx.lineWidth = size * 0.16; ctx.strokeStyle = '#1a1030'; ctx.strokeText(label, cx, y);
  ctx.lineWidth = size * 0.07; ctx.strokeStyle = '#8a4a14'; ctx.strokeText(label, cx, y + size * 0.012);
  ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - wmax / 2 - 4, y - size * 0.6, wmax + 8, size * 0.62); ctx.clip();
  ctx.lineWidth = size * 0.03; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.strokeText(label, cx - size * 0.012, y - size * 0.012); ctx.restore();
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.74, size * 0.28, PAL.text, { align: 'center', weight: 700, stroke: 6, maxW: wmax * 1.1 });
}

// The two girls seesawing, as a looping demonstration on the title and course screens. A pure function of the clock.
function heroCfg(t) {
  const per = 1.7, i = Math.floor(t / per), u = (t / per) % 1;
  const flyer = i % 2;                                          // 0 = the left girl is in the air
  const H = 1.05 + 0.25 * Math.sin(t * 0.37);
  const lift = 4 * H * u * (1 - u);
  const standing = flyer === 0 ? 'right' : 'left';
  // the standing girl's end is down; the board flips at the landing, which is at u = 0
  const prev = flyer === 0 ? -1 : 1, next = flyer === 0 ? 1 : -1;
  const tilt = TILT * (prev + (next - prev) * ease(u * 6));
  const cfg = { t, tilt, maxLift: 1.3, left: { pose: 'crouch' }, right: { pose: 'crouch' } };
  cfg[flyer === 0 ? 'left' : 'right'] = { pose: u < 0.5 ? 'rise' : 'fall', lift };
  cfg[standing].pose = u < 0.16 ? 'land' : 'crouch';
  return cfg;
}

function backdrop(ctx, w, h, t, set, veil = 0.5) {
  const s = Math.min(w / 4.2, h / 6);
  drawScene(ctx, w, h, t, { pivotX: w / 2, groundY: h * 0.74, s }, set, 0.3);
  if (veil) { ctx.fillStyle = `rgba(12,18,42,${veil})`; ctx.fillRect(0, 0, w, h); }
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  if (sc === 'play') { meta.previewBadge = { x: L.play.stage.x + L.play.stage.w / 2, y: L.play.stage.y + L.play.stage.h - 8, align: 'center' }; renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu); drawToast(ctx, st, L); return; }
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else {
    backdrop(ctx, w, h, st.t, sc === 'detail' || sc === 'result' ? LEVELS[st.sel].setting : 'morning', 0.62);
    if (sc === 'levels') renderLevels(ctx, st, L);
    else if (sc === 'detail') renderDetail(ctx, st, L);
    else if (sc === 'result') renderResult(ctx, st, L, w, h);
    else if (sc === 'rules') renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: 'Rules  ' + (st.rulesPage + 1) + '/' + rulesPages().length, blocks: rulesPages()[st.rulesPage].blocks, nav: true, page: st.rulesPage, pages: rulesPages().length, sub: rulesPages()[st.rulesPage].title });
    else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: ABOUT.title, blocks: ABOUT.blocks });
    else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: HOWTO.title, blocks: HOWTO.blocks });
    else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
    else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  }
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(14,20,44,0.92)', stroke: 'rgba(255,240,220,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Watch and Learn pause before each phrase'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No screen shake'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    ...(st.demo ? [] : [row('restore', 'Restore purchase', 'button', () => '', 'Get the full game back on a new device', { btn: 'Restore' })]),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

// ---- title ----------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S, hero = T.hero;
  const cfg = heroCfg(st.t);
  cfg.backdrop = { w, h, setting: 'morning', excite: 0.35 };
  drawMini(ctx, { x: hero.x + hero.w * 0.04, y: hero.y, w: hero.w * 0.92, h: hero.h }, cfg);
  const cx = L.mode === 'wide' ? S.x + (T.play.x - S.x) / 2 : S.x + S.w / 2;
  titleText(ctx, cx, T.titleY, T.size, 'Neolttwigi', 'Korean seesaw jumping', (L.mode === 'wide' ? T.play.x - S.x - 40 : S.w - 40));
  button(ctx, T.play, 'Play', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 24 });
  button(ctx, T.two, 'Two Players', { kind: 'quiet', size: 26 });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  const lw = L.mode === 'wide' ? 190 : 250;
  if (!drawLockup(ctx, T.credit.x, T.credit.y - lw * 0.1, lw)) drawCredit(ctx, T.credit.x, T.credit.y, 15, { dim: 0.95 });
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_RUNS - st.demoRuns)} left`, 20, { align: 'right', fill: 'rgba(14,20,44,0.85)' });
}

// ---- courses + detail ---------------------------------------------------------------------------------------------------------
function stars(ctx, cx, cy, size, n) { drawStars(ctx, cx, cy, size, n, 3, 1.25); }

function thumb(ctx, r, setName) {
  const set = SETTINGS[setName];
  ctx.save(); rrect(ctx, r, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, set.sky[0]); g.addColorStop(0.65, set.sky[1]); g.addColorStop(1, set.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = set.far; ctx.beginPath(); ctx.moveTo(r.x, r.y + r.h * 0.62); ctx.quadraticCurveTo(r.x + r.w * 0.3, r.y + r.h * 0.4, r.x + r.w * 0.6, r.y + r.h * 0.6); ctx.quadraticCurveTo(r.x + r.w * 0.85, r.y + r.h * 0.45, r.x + r.w, r.y + r.h * 0.58); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.lineTo(r.x, r.y + r.h); ctx.fill();
  ctx.fillStyle = set.roof; ctx.beginPath(); ctx.moveTo(r.x + r.w * 0.05, r.y + r.h * 0.58); ctx.lineTo(r.x + r.w * 0.18, r.y + r.h * 0.4); ctx.lineTo(r.x + r.w * 0.62, r.y + r.h * 0.4); ctx.lineTo(r.x + r.w * 0.76, r.y + r.h * 0.58); ctx.fill();
  ctx.fillStyle = set.wall; ctx.fillRect(r.x + r.w * 0.14, r.y + r.h * 0.58, r.w * 0.5, r.h * 0.12);
  ctx.fillStyle = set.ground[0]; ctx.fillRect(r.x, r.y + r.h * 0.72, r.w, r.h * 0.28);
  ctx.save(); ctx.translate(r.x + r.w * 0.5, r.y + r.h * 0.82); ctx.rotate(-0.16); ctx.fillStyle = '#c68a50'; ctx.fillRect(-r.w * 0.34, -r.h * 0.035, r.w * 0.68, r.h * 0.07); ctx.restore();
  ctx.fillStyle = '#e6c25c'; ctx.fillRect(r.x + r.w * 0.44, r.y + r.h * 0.82, r.w * 0.12, r.h * 0.12);
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,220,0.4)'; rrect(ctx, r, 16); ctx.stroke();
}

function renderLevels(ctx, st, L) {
  const G = L.levels, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a course', S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), G.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: S.w - 380 });
  G.cards.forEach((r, i) => {
    const cfg = LEVELS[i], best = st.best[cfg.id] ?? {};
    const locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(16,22,48,0.8)', rad: 24, stroke: locked ? 'rgba(255,255,255,0.1)' : 'rgba(255,214,150,0.38)' });
    const pad = 14, th = Math.min(r.h - pad * 2, 130, r.w * 0.28);
    thumb(ctx, { x: r.x + pad, y: r.y + pad, w: th * 1.2, h: th }, cfg.setting);
    const tx = r.x + pad + th * 1.2 + 16, tw = r.x + r.w - pad - tx;
    txt(ctx, `${i + 1}  ${cfg.name}`, tx, r.y + pad + 20, 28, locked ? PAL.dim : PAL.text, { weight: 800, maxW: tw });
    ctx.font = `500 20px ${UI}`;
    const lines = wrap(ctx, cfg.blurb, tw).slice(0, Math.max(1, Math.floor((r.h - 96) / 26)));
    lines.forEach((ln, li) => txt(ctx, ln, tx, r.y + pad + 54 + li * 26, 20, PAL.dim, { weight: 500, maxW: tw }));
    const by = r.y + r.h - pad - 14;
    stars(ctx, tx + 44, by, 14, best.stars ?? 0);
    txt(ctx, best.apex ? `${best.apex.toFixed(2)} m` : cfg.pace, r.x + r.w - pad, by, 22, PAL.cream, { align: 'right', weight: 800, maxW: tw * 0.45 });
    if (locked) txt(ctx, 'Full game', r.x + r.w - pad, r.y + pad + 20, 18, PAL.dim, { align: 'right', weight: 700 });
  });
}

function renderDetail(ctx, st, L) {
  const D = L.detail, S = L.S, cfg = LEVELS[st.sel], best = st.best[cfg.id] ?? {};
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, cfg.name, S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), L.levels.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 7, maxW: S.w - 380 });
  const I = D.info;
  panel(ctx, I, { rad: 26 });
  const pad = 22;
  txt(ctx, cfg.blurb, I.x + pad, I.y + 36, 22, PAL.text, { weight: 600, maxW: I.w - pad * 2 });
  txt(ctx, `${cfg.events} jumps  ·  partner ${cfg.partner}  ·  stars at ${cfg.stars.join(', ')} m`, I.x + pad, I.y + 72, 20, PAL.dim, { weight: 600, maxW: I.w - pad * 2 });
  const mh = I.w > I.h * 1.25 ? I.h - 96 : I.h - 170;   // landscape card: the stars/best row sits in the corners, so the scene may use the full height
  if (mh > 90) {
    const mr = { x: I.x + 8, y: I.y + 86, w: I.w - 16, h: mh + 6 };   // nearly edge to edge: the seesaw is width-bound, so every pixel counts
    ctx.save(); rrect(ctx, mr, 18); ctx.clip();
    drawMini(ctx, mr, heroCfg(st.t));
    ctx.restore();
  }
  const by = I.y + I.h - 40;
  stars(ctx, I.x + pad + 50, by, 18, best.stars ?? 0);
  txt(ctx, best.apex ? `Best ${best.apex.toFixed(2)} m  ·  ${rankOf(best.stars ?? 0)}` : 'Not played yet', I.x + I.w - pad, by, 23, PAL.cream, { align: 'right', weight: 700, maxW: I.w * 0.6 });
  button(ctx, D.perform, 'Play', { kind: 'primary', size: 34, sub: `with ${cfg.partner}, scored by height`, icon: 'play' });
  button(ctx, D.learn, 'Learn it', { kind: 'quiet', size: 30, sub: 'Slower, forgiving, with hints', icon: 'bulb' });
  button(ctx, D.two, 'Two Players', { kind: 'quiet', size: 30, sub: 'One screen, a thumb each', icon: 'tap' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 28, sub: 'The game plays both girls', icon: 'eye' });
}

// ---- result ----------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L, w, h) {
  const Rr = L.result, r = st.result, p = Rr.panel, cfg = LEVELS[r.ri];
  panel(ctx, p, { fill: 'rgba(14,20,44,0.92)', rad: 30 });
  edgeStroke(ctx, p, 30, 0.5);
  const cx = p.x + p.w / 2, wide = L.mode === 'wide';
  const nm = r.mode === 'duel' ? ['Player 1', 'Player 2'] : r.mode === 'auto' ? ['Mina', cfg.partner] : ['You', cfg.partner];
  txt(ctx, r.reason === 'slip' ? 'THE BOARD SLIPPED' : r.mode === 'auto' ? 'WATCH COMPLETE' : 'ROUND COMPLETE', cx, p.y + 52, 34, r.reason === 'slip' ? PAL.rose : PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: p.w - 40 });
  txt(ctx, cfg.name, cx, p.y + 94, 23, PAL.text, { align: 'center', weight: 700, maxW: p.w - 40 });
  stars(ctx, cx, p.y + 160, 36, r.stars);
  txt(ctx, `${r.maxApex.toFixed(2)} m`, cx, p.y + 252, 86, PAL.cream, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: p.w - 60 });
  txt(ctx, `highest jump  ·  ${rankOf(r.stars)}`, cx, p.y + 316, 25, PAL.gold, { align: 'center', weight: 800, maxW: p.w - 60 });
  let ty = p.y + 358;
  if (r.newBest) { txt(ctx, 'NEW BEST', cx, ty, 24, PAL.tealHi, { align: 'center', weight: 800 }); ty += 34; }
  if (r.mode === 'duel') {
    const win = r.score[0] === r.score[1] ? 'A draw' : r.score[0] > r.score[1] ? 'Player 1 launched higher' : 'Player 2 launched higher';
    txt(ctx, win, cx, ty, 26, PAL.rose, { align: 'center', weight: 800, maxW: p.w - 60 }); ty += 38;
  }
  const gx = p.x + 40, gw = p.w - 80, ch = p.h < 520 ? 28 : wide ? 30 : 36;
  [0, 1].forEach((q) => {
    const c = r.counts[q], col = q ? '#8ec1ff' : '#ffd36b', yy = ty + q * ch * 1.9;
    txt(ctx, nm[q], gx, yy, 24, col, { weight: 800, maxW: gw * 0.4 });
    txt(ctx, `${r.score[q]}  ·  best launch ${r.maxLaunch[q].toFixed(2)} m`, gx + gw, yy, 21, PAL.text, { align: 'right', weight: 700, maxW: gw * 0.62 });
    txt(ctx, `${c.perfect} perfect   ${c.great} great   ${c.good} good   ${c.miss} miss`, gx, yy + ch * 0.8, 18, PAL.dim, { weight: 600, maxW: gw });
  });
  ty += ch * 3.8;
  const room = Rr.again.y - 24 - (ty + 30);
  if (room > 150) {
    const mr = { x: p.x + 24, y: ty + 30, w: p.w - 48, h: Math.min(room, 340) };
    drawMini(ctx, mr, { t: st.t, maxLift: 0.9, tilt: TILT * Math.sin(st.t * 1.4) * 0.5, left: { pose: r.stars ? 'apex' : 'stand', lift: 0.5 + 0.4 * Math.sin(st.t * 1.4) }, right: { pose: 'crouch' } });
  }
  const tight = p.h < 520;
  if (!tight) txt(ctx, `Longest clean run ${r.maxChain}  ·  accuracy ${Math.round(r.acc * 100)}%`, cx, ty, 21, PAL.dim, { align: 'center', weight: 600, maxW: p.w - 60 });
  button(ctx, Rr.again, 'Again', { kind: 'primary', size: 30, icon: 'restart' });
  button(ctx, Rr.routines, 'Courses', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  if (!tight) drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

// ---- pause / end menu + demo limit ---------------------------------------------------------------------------------------------
const PAUSE_LABELS = { resume: 'Resume', restart: 'Restart', quit: 'Courses', again: 'Again', next: 'Next course', exit: 'Exit' };
function drawPauseMenu(ctx, st, L, items, pl) {
  ctx.fillStyle = 'rgba(8,12,30,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(16,22,50,0.96)', rad: 28 });
  txt(ctx, pl.over ? 'Round ended' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 52, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 700 });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' || it === 'again' ? 'primary' : 'quiet', size: 30 }));
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  panel(ctx, p, { fill: 'rgba(14,20,44,0.94)', rad: 30 });
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 70, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: p.w - 40 });
  txt(ctx, 'The full game has every course,', p.x + p.w / 2, p.y + 160, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'with faster beats and higher jumps.', p.x + p.w / 2, p.y + 200, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'Get Neolttwigi for iPhone and Android.', p.x + p.w / 2, p.y + 270, 26, PAL.tealHi, { align: 'center', weight: 800, maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 350, 22, PAL.dim, { align: 'center', weight: 600 });
}
