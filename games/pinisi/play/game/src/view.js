// Drawing for every screen. render() is the single entry point; text screens are in docview.js.
import { PAL, UI, DISPLAY, rgba, clamp, clamp01, drawSea, windStreaks, drawIsland, drawIslets, drawCompass, drawWindArrow, drawShipTop, drawShipSide, drawGood, drawPortMarker, dottedRoute, drawParticles, portSeed } from './art.js';
import { inlay, txt, button, panel, rrect, chip, wrap, icon, fitText, minUnits, bar, lettering } from './ui.js';
import { renderDoc } from './docview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { GOODS, PORTS, SIZES, TIMBERS, RIGS, MODES, RANKS, SET_NAME, SETTINGS, TUNE, MONTHS, SEASON_NAME, CLASS_NAME,
  edges, routesFrom, windAt, windClass, dayRun, estDays, bearing, buyPrice, sellPrice, priceRatio, holdCount, holdFree, monthOf, seasonOf,
  repairCost, shipSpec, buildCost, taskState, taskQuality, pointName, angDiff, pointOfSail, routeDist, finalSale, rankIndex, bestSetting, sellValue } from './engine.js';
import { portPanel, seaPanel, mapXform, menuRects, inRect } from './layout.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
export const SHIP_FRAC = 0.36;

function titleText(ctx, cx, y, size, label, maxW) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let s = size; ctx.font = `700 ${s}px ${DISPLAY}`;
  const m = ctx.measureText(label).width; if (maxW && m > maxW) { s = size * maxW / m; ctx.font = `700 ${s}px ${DISPLAY}`; }
  const g = ctx.createLinearGradient(0, y - s * 0.5, 0, y + s * 0.5);
  g.addColorStop(0, '#fff6d6'); g.addColorStop(0.5, '#f2c65a'); g.addColorStop(1, '#b8822a');
  ctx.lineJoin = 'round'; ctx.lineWidth = s * 0.12; ctx.strokeStyle = '#05212c'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,200,90,0.45)'; ctx.shadowBlur = s * 0.18; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
}
const money = (n) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

export function render(ctx, st, L, view, meta, pauseItems) {
  const { w, h } = L, sc = st.scene;
  meta.previewBadge = sc === 'voyage' ? { x: L.voy.map.x + L.voy.map.w - 12, y: L.voy.map.y + 16, align: 'right' } : null;
  const wind = st.pl?.v ? windAt(st.pl.v) : { dir: 0.3, str: 0.7 };
  if (sc === 'voyage') { renderVoyage(ctx, st, L, view, meta, pauseItems); }
  else {
    if (!v3.on || sc === 'about' || sc === 'howto' || sc === 'rules' || sc === 'settings') drawSea(ctx, { x: 0, y: 0, w: w + 20, h: h + 20 }, st.t, sc === 'title' ? { dir: 0.3, str: 0.7 } : wind, st.prefs.calm);
    if (sc === 'title') renderTitle(ctx, st, L);
    else if (sc === 'setup') renderSetup(ctx, st, L);
    else if (sc === 'yard') renderYard(ctx, st, L);
    else if (sc === 'result') renderResult(ctx, st, L);
    else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
    else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
    else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
    else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
    else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  }
  if (st.toast) {
    const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 36, st.toast.text, 26, { align: 'center', fill: 'rgba(4,22,32,0.94)', stroke: 'rgba(242,198,90,0.6)' });
    ctx.restore();
  }
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Still sea, no spray or sway'),
    row('think', 'Think time (s)', 'stepper', () => p.thinkSec, 'Watch and Learn pace'),
    ...(st.restore ? [row('restore', st.restore.owned ? 'Full game unlocked' : 'Restore purchase', 'button', () => '',
      st.restore.owned ? 'Thank you for sailing' : (st.restore.msg || 'Already bought it?'),
      { btn: st.restore.owned ? 'Owned' : (st.restore.busy ? 'Wait...' : 'Restore'), disabled: st.restore.owned || st.restore.busy })] : []),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title -----------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L) {
  const T = L.title, S = L.S, wide = L.mode === 'wide';
  const tcx = wide ? T.hero.x + T.hero.w / 2 : S.x + S.w / 2, size = T.size, maxW = (wide ? T.hero.w : S.w) - 40;
  // hero: the pinisi on a swell, rig full
  const H = T.hero, topLimit = T.titleY + size * 0.78 + 34;
  const shipW = Math.max(120, Math.min(H.w * 0.8, H.h * 1.2, 700, (H.y + H.h - topLimit - 16) / 0.66));
  const deckY = Math.min(Math.max(topLimit + shipW * 0.52, H.y + H.h * 0.7), H.y + H.h - shipW * 0.14 - 8) + Math.sin(st.t * 1.2) * 4 * (st.prefs.calm ? 0 : 1);
  if (!v3.on) {
    ctx.fillStyle = 'rgba(255,225,150,0.10)'; ctx.beginPath(); ctx.arc(H.x + H.w * 0.8, topLimit + shipW * 0.2, Math.min(H.w, H.h) * 0.24, 0, TAU); ctx.fill();
    drawShipSide(ctx, H.x + H.w / 2 - shipW * 0.03, deckY, shipW, shipSpec({ size: 'pinisi', timber: 'teak', rig: 'balanced' }, 0.9), 1, 1, st.prefs.calm ? 0 : st.t, true);
  }
  lettering(ctx, 'PINISI', tcx, T.titleY, size, maxW);
  { const ty = T.titleY + size * 0.74, fs = Math.max(18, size * 0.17);
    ctx.font = `800 ${fs}px ${UI}`; const tw = Math.min(maxW, ctx.measureText('BUGIS TRADING SCHOONER').width + fs * 3.2) / 2;
    ctx.fillStyle = 'rgba(248,214,128,0.85)'; ctx.fillRect(tcx - tw, ty - 1, tw - ctx.measureText('BUGIS TRADING SCHOONER').width / 2 - fs * 0.7, 2); ctx.fillRect(tcx + ctx.measureText('BUGIS TRADING SCHOONER').width / 2 + fs * 0.7, ty - 1, tw - ctx.measureText('BUGIS TRADING SCHOONER').width / 2 - fs * 0.7, 2);
    txt(ctx, 'BUGIS TRADING SCHOONER', tcx, ty, fs, '#ffe9b0', { align: 'center', weight: 800, stroke: 6, strokeColor: 'rgba(30,10,0,0.75)', maxW: maxW - 30 }); }
  button(ctx, T.play, 'Set Sail', { kind: 'primary', size: 44, icon: 'play' });
  button(ctx, T.cont, 'Continue voyage', { kind: st.saved ? 'gold' : 'disabled', size: 30, sub: st.saved ? st.saved.line : undefined });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26, icon: 'help' });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26, icon: 'book' });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26, icon: 'info' });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26, icon: 'gear' });
  const lw = T.lock.w, lh = T.lock.h;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- voyage setup --------------------------------------------------------------------------------------------------------------------
function renderSetup(ctx, st, L) {
  const U = L.setup, S = L.S, sel = st.setupSel;
  button(ctx, U.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose your voyage', S.x + S.w / 2, U.back.y + U.back.h / 2 + 2, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (U.back.w + 36) });
  panel(ctx, U.panel); edgeStroke(ctx, U.panel, 24, 0.3);
  const card = (r, key, on) => {
    const M = MODES[key];
    const cg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); cg.addColorStop(0, on ? '#7a5530' : '#3f2c1c'); cg.addColorStop(1, on ? '#4a3018' : '#2a1c12');
    ctx.fillStyle = cg; rrect(ctx, r, 18); ctx.fill();
    ctx.lineWidth = on ? 3.5 : 1.6; ctx.strokeStyle = on ? '#f6d777' : 'rgba(220,190,130,0.4)'; rrect(ctx, r, 18); ctx.stroke();
    txt(ctx, M.name, r.x + 22, r.y + 40, 38, on ? PAL.gold : PAL.text, { font: DISPLAY, weight: 700, maxW: r.w - 44 });
    txt(ctx, M.blurb, r.x + 22, r.y + 88, 24, PAL.text, { weight: 500, maxW: r.w - 44 });
    txt(ctx, `${M.coins} coins to start`, r.x + 22, r.y + 124, 24, PAL.dim, { weight: 600, maxW: r.w - 44 });
    const b = st.best[key]; txt(ctx, b ? `Best score ${money(b)}` : 'No voyage yet', r.x + 22, r.y + 160, 22, b ? PAL.gold : PAL.dim, { weight: 700, maxW: r.w - 44 });
  };
  card(U.quick, 'quick', sel.mode === 'quick'); card(U.monsoon, 'monsoon', sel.mode === 'monsoon');
  if (sel.mode === 'monsoon') {
    txt(ctx, 'Start in the', U.togLabel.x, U.togLabel.y + 14, 24, PAL.dim, { weight: 600 });
    button(ctx, U.west, 'West monsoon', { kind: sel.month === 11 ? 'on' : 'quiet', size: 26 });
    button(ctx, U.east, 'East monsoon', { kind: sel.month === 5 ? 'on' : 'quiet', size: 26 });
  } else {
    txt(ctx, 'Starts in December, in the west monsoon.', U.togLabel.x, U.togLabel.y + 24, 24, PAL.dim, { weight: 600, maxW: U.panel.w - 40 });
  }
  button(ctx, U.next, 'To the shipyard', { kind: 'primary', size: 36, icon: 'play' });
  // a tall screen: the free space under the button holds the vessel being sailed, so no band is left empty
  if (!v3.on) { const fy = U.next.y + U.next.h + 20, fh = S.y + S.h - fy - 16, shipW = Math.min(S.w * 0.78, fh / 0.8, 640);
    if (fh > 220 && shipW > 220) drawShipSide(ctx, S.x + S.w / 2 - shipW * 0.03, fy + shipW * 0.56 + Math.max(0, (fh - shipW * 0.8) * 0.4), shipW, shipSpec({ size: 'pinisi', timber: 'teak', rig: 'balanced' }, 0.9), 1, 1, st.prefs.calm ? 0 : st.t, true); }
}

// ---- shipyard --------------------------------------------------------------------------------------------------------------------------
function statBars(ctx, r, spec, extra = {}) {
  const items = [
    ['Hold', `${spec.cap}`, spec.cap / 40], ['Speed', `${Math.round(spec.speed)} nm/day`, (spec.speed - 80) / 80],
    ['Hull', `${spec.maxHp}`, spec.maxHp / 190], ['Strain', `${spec.strain.toFixed(2)}`, (spec.strain - 0.8) / 0.7],
  ];
  const wide = r.h > 130, cols = wide ? 1 : 2, rows = Math.ceil(items.length / cols);
  const cw = r.w / cols, rh = r.h / rows;
  items.forEach((it, i) => {
    const c = i % cols, ro = Math.floor(i / cols), x = r.x + c * cw + 8, y = r.y + ro * rh, bw = cw - 16;
    txt(ctx, it[0], x, y + rh * 0.3, Math.min(24, rh * 0.42), PAL.dim, { weight: 700 });
    txt(ctx, it[1], x + bw, y + rh * 0.3, Math.min(24, rh * 0.42), PAL.text, { weight: 800, align: 'right', maxW: bw * 0.6 });
    bar(ctx, { x, y: y + rh * 0.58, w: bw, h: Math.max(10, rh * 0.2) }, clamp01(it[2]), extra.col ?? PAL.gold);
  });
}

function renderYard(ctx, st, L) {
  const Y = L.yard, S = L.S, y = st.yard;
  const d3 = v3.on;
  if (!d3) {
    // dusk sky and beach behind the ship
    const sky = ctx.createLinearGradient(0, 0, 0, L.h);
    sky.addColorStop(0, '#16324a'); sky.addColorStop(0.32, '#7a4f6a'); sky.addColorStop(0.5, '#e0845a'); sky.addColorStop(0.52, '#0f5f72'); sky.addColorStop(1, '#073a4c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, L.w, L.h);
    drawSea(ctx, { x: 0, y: L.h * 0.52, w: L.w, h: L.h * 0.5 }, st.t, { dir: 0.3, str: 0.5 }, st.prefs.calm);
  }
  button(ctx, Y.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'The shipyard at Bira', S.x + S.w / 2 + 40, Y.back.y + Y.back.h / 2 + 2, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (Y.back.w + 30) });
  // stage
  const pv = Y.preview;
  const task = y.task, fitting = y.phase === 'fit' || y.phase === 'done';
  const q = y.phase === 'done' ? taskQuality(task) : 0.7;
  const spec = shipSpec({ size: y.size, timber: y.timber, rig: y.rig }, q);
  if (!d3) {
    ctx.save(); rrect(ctx, pv, 24); ctx.clip();
    const bg = ctx.createLinearGradient(0, pv.y, 0, pv.y + pv.h);
    bg.addColorStop(0, '#f6cf8c'); bg.addColorStop(0.6, '#e8956a'); bg.addColorStop(0.6001, '#d8b878'); bg.addColorStop(1, '#a8803f');
    ctx.fillStyle = bg; ctx.fillRect(pv.x, pv.y, pv.w, pv.h);
    ctx.fillStyle = 'rgba(40,90,60,0.55)'; ctx.beginPath(); ctx.moveTo(pv.x, pv.y + pv.h * 0.6); for (let i = 0; i <= 8; i++) ctx.lineTo(pv.x + pv.w * i / 8, pv.y + pv.h * (0.5 + 0.06 * Math.sin(i * 1.7))); ctx.lineTo(pv.x + pv.w, pv.y + pv.h * 0.6); ctx.closePath(); ctx.fill();
    const sw = Math.min(pv.w * 0.78, pv.h / 0.74);
    const build = fitting ? y.bShown / TUNE.planks : 1;
    const rig = fitting ? clamp01(y.rigT) : 1;
    const deckY = pv.y + (pv.h - 0.7 * sw) / 2 + 0.52 * sw;
    const hullBottom = deckY + sw * 0.62 * 0.22 * ({ prahu: 0.82, pinisi: 1, grand: 1.12 }[y.size] ?? 1) + 4;
    ctx.fillStyle = '#4a3220'; ctx.fillRect(pv.x + pv.w / 2 - sw * 0.4, hullBottom + 6, sw * 0.8, 9);
    for (const k of [-0.3, 0, 0.3]) { ctx.save(); ctx.translate(pv.x + pv.w / 2 + sw * k, hullBottom + 6); ctx.rotate(k * 0.5); ctx.fillRect(-4, -sw * 0.08, 8, sw * 0.09); ctx.restore(); }
    drawShipSide(ctx, pv.x + pv.w / 2 - sw * 0.03, deckY, sw, spec, clamp01(build), rig, y.phase === 'done' && !st.prefs.calm ? st.t : 0);
    ctx.restore();
  }
  edgeStroke(ctx, pv, 24, 0.35);
  // stats (with a slate backing under the controls so they read over the beach)
  if (d3) { const b = { x: Math.min(Y.stats.x, Y.right.x) - 6, y: Y.stats.y - 6, w: Math.max(Y.stats.x + Y.stats.w, Y.right.x + Y.right.w) - Math.min(Y.stats.x, Y.right.x) + 12, h: Y.right.y + Y.right.h - Y.stats.y + 12 };
    if (L.mode === 'wide') { panel(ctx, { x: Y.stats.x - 6, y: Y.stats.y - 6, w: Y.stats.w + 12, h: Y.stats.h + 12 }, { wood: true, fill: '#33200f', rad: 20 }); panel(ctx, { x: Y.right.x - 8, y: Y.right.y - 4, w: Y.right.w + 16, h: Y.right.h + 8 }, { wood: true, fill: '#33200f', rad: 22 }); }
    else panel(ctx, b, { wood: true, fill: '#33200f', rad: 22 }); }
  else panel(ctx, Y.stats, { wood: true, fill: '#33200f', rad: 18 });
  statBars(ctx, { x: Y.stats.x + 8, y: Y.stats.y + 6, w: Y.stats.w - 16, h: Y.stats.h - 12 }, spec);
  const cr = Y.right;
  if (y.phase === 'choose') {
    const groups = [['Size', SIZES, 'size'], ['Timber', TIMBERS, 'timber'], ['Rig', RIGS, 'rig']];
    groups.forEach(([label, data, key], gi) => {
      const G = Y.groups[gi];
      txt(ctx, label.toUpperCase(), G.label.x, G.label.y, 22, PAL.gold, { weight: 800 });
      Object.keys(data).forEach((id, j) => {
        const r = G.cards[j], d = data[id], on = y[key] === id;
        const cg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); cg.addColorStop(0, on ? '#7f5a33' : '#4a3320'); cg.addColorStop(1, on ? '#4e341a' : '#2c1d12');
        ctx.fillStyle = cg; rrect(ctx, r, 14); ctx.fill();
        ctx.lineWidth = on ? 3.5 : 1.6; ctx.strokeStyle = on ? '#f6d777' : 'rgba(220,190,130,0.4)'; rrect(ctx, r, 14); ctx.stroke();
        txt(ctx, d.name, r.x + r.w / 2, r.y + r.h * 0.3, Math.min(28, r.h * 0.3), on ? PAL.gold : PAL.text, { align: 'center', weight: 800, maxW: r.w - 12 });
        const sub = key === 'size' ? `${d.cap} bales` : key === 'timber' ? `hull x${d.hp}` : `speed x${d.spd}`;
        txt(ctx, sub, r.x + r.w / 2, r.y + r.h * 0.58, Math.min(22, r.h * 0.23), PAL.dim, { align: 'center', weight: 600, maxW: r.w - 12 });
        txt(ctx, `${d.cost} coins`, r.x + r.w / 2, r.y + r.h * 0.82, Math.min(22, r.h * 0.23), PAL.text, { align: 'center', weight: 700, maxW: r.w - 12 });
      });
    });
    const cost = buildCost(y), M = MODES[st.setupSel.mode], left = M.coins - cost;
    button(ctx, Y.go, `Build the hull  ·  ${cost} coins`, { kind: left >= 150 ? 'primary' : 'disabled', size: 30, sub: `${left} coins left for cargo` });
  } else {
    const T = Y.task, ts = taskState(task);
    // dots
    const n = TUNE.planks, dw = Math.min(70, (T.dots.w - 10 * (n - 1)) / n);
    for (let i = 0; i < n; i++) {
      const r = task.res[i], cx = T.dots.x + (T.dots.w - (dw * n + 10 * (n - 1))) / 2 + i * (dw + 10) + dw / 2;
      ctx.fillStyle = r ? (r.grade === 'perfect' ? PAL.gold : r.grade === 'good' ? '#7fd0c6' : PAL.coral) : 'rgba(255,255,255,0.14)';
      rrect(ctx, { x: cx - dw / 2, y: T.dots.y, w: dw, h: 26 }, 8); ctx.fill();
      if (i === task.i && !task.done) { ctx.lineWidth = 3; ctx.strokeStyle = PAL.text; rrect(ctx, { x: cx - dw / 2 - 3, y: T.dots.y - 3, w: dw + 6, h: 32 }, 10); ctx.stroke(); }
    }
    if (y.phase === 'fit') {
      txt(ctx, `Plank ${Math.min(task.i + 1, n)} of ${n}`, cr.x + cr.w / 2, T.bar.y - 26, 28, PAL.text, { align: 'center', weight: 700 });
      const b = T.bar;
      ctx.fillStyle = 'rgba(5,26,38,0.9)'; rrect(ctx, b, 16); ctx.fill();
      const zx = b.x + 14 + (b.w - 28) * (ts.c - ts.hw), zw = (b.w - 28) * ts.hw * 2;
      ctx.fillStyle = 'rgba(242,198,90,0.35)'; ctx.fillRect(zx, b.y + 10, zw, b.h - 20);
      ctx.fillStyle = 'rgba(255,240,170,0.6)'; ctx.fillRect(zx + zw * 0.325, b.y + 10, zw * 0.35, b.h - 20);
      const mx = b.x + 14 + (b.w - 28) * ts.m;
      ctx.fillStyle = PAL.text; ctx.fillRect(mx - 5, b.y + 4, 10, b.h - 8);
      ctx.fillStyle = PAL.coral; ctx.beginPath(); ctx.arc(mx, b.y + 4, 9, 0, TAU); ctx.fill();
      button(ctx, T.tap, 'Fit the plank', { kind: 'primary', size: 40, icon: 'plus' });
      if (y.flash) txt(ctx, y.flash.text, cr.x + cr.w / 2, T.bar.y + T.bar.h + 44, 34, y.flash.col, { align: 'center', font: DISPLAY, weight: 700, stroke: 6 });
    } else {
      const qv = taskQuality(task);
      txt(ctx, 'The hull is planked', cr.x + cr.w / 2, cr.y + 90, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: cr.w });
      txt(ctx, `Craft quality ${Math.round(qv * 100)}%`, cr.x + cr.w / 2, cr.y + 150, 32, PAL.text, { align: 'center', weight: 800 });
      const mod = `Speed x${(0.95 + 0.1 * qv).toFixed(2)}   Hull x${(0.9 + 0.2 * qv).toFixed(2)}`;
      txt(ctx, mod, cr.x + cr.w / 2, cr.y + 196, 26, PAL.dim, { align: 'center', weight: 600, maxW: cr.w });
      {
        const cost = buildCost(y), M = MODES[st.setupSel.mode], gap2 = 14, cwid = (cr.w - gap2 * 2) / 3, ch = 130, cy0 = cr.y + 250;
        if (cy0 + ch + 64 < Y.go.y) {
          [['HULL', SIZES[y.size].name, `${SIZES[y.size].cap} bales`], ['TIMBER', TIMBERS[y.timber].name, `hull x${TIMBERS[y.timber].hp}`], ['RIG', RIGS[y.rig].name, `speed x${RIGS[y.rig].spd}`]].forEach(([lab, nm, sub], i) => {
            const r = { x: cr.x + i * (cwid + gap2), y: cy0, w: cwid, h: ch };
            ctx.fillStyle = 'rgba(4,22,32,0.7)'; rrect(ctx, r, 14); ctx.fill();
            txt(ctx, lab, r.x + r.w / 2, r.y + 26, 20, PAL.gold, { align: 'center', weight: 800 });
            txt(ctx, nm, r.x + r.w / 2, r.y + 68, 28, PAL.text, { align: 'center', weight: 800, maxW: r.w - 14 });
            txt(ctx, sub, r.x + r.w / 2, r.y + 104, 22, PAL.dim, { align: 'center', weight: 600, maxW: r.w - 14 });
          });
          txt(ctx, `${M.coins - cost} coins left for cargo`, cr.x + cr.w / 2, cy0 + ch + 44, 28, PAL.gold, { align: 'center', weight: 800, maxW: cr.w });
        }
      }
      button(ctx, Y.go, 'Launch the pinisi', { kind: 'primary', size: 34, icon: 'play' });
    }
  }
}

// ---- voyage (chart + panels) -------------------------------------------------------------------------------------------------------------
function monthLabel(v) { return `${MONTHS[monthOf(v)]}`; }

function renderHud(ctx, st, L, v) {
  const H = L.voy.hud, pl = st.pl;
  panel(ctx, H, { wood: true, fill: '#33200f', rad: 18, noRivets: true });
  const x = H.x, y = H.y, hh = H.h, pad = 14, pauseW = hh - 12;
  const seg = (H.w - pauseW - 8) / 3;
  const left = Math.min(seg * 1.05, 250);
  const day = Math.min(v.day + 1, v.endDay);
  txt(ctx, `Day ${day} of ${v.endDay}`, x + pad, y + hh * 0.34, Math.min(26, hh * 0.36), PAL.text, { weight: 800, maxW: left - pad });
  {
    const msz = Math.min(20, hh * 0.28), full = `${monthLabel(v)} · ${SEASON_NAME[seasonOf(monthOf(v))]}`;
    ctx.font = `600 ${Math.max(msz, minUnits())}px ${UI}`;
    const lbl = ctx.measureText(full).width <= left - pad - 20 ? full : `${monthLabel(v)} · ${SEASON_NAME[seasonOf(monthOf(v))].split(' ')[0]}`;
    txt(ctx, lbl, x + pad, y + hh * 0.72, msz, PAL.dim, { weight: 600, maxW: left - pad - 20 });
  }
  // coins
  const cx = x + left + 6;
  { const cg = ctx.createRadialGradient(cx + 11, y + hh * 0.36 - 4, 1, cx + 14, y + hh * 0.36, 13); cg.addColorStop(0, '#fff3b0'); cg.addColorStop(0.6, '#f0be42'); cg.addColorStop(1, '#a8761c');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx + 14, y + hh * 0.36, 12, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7a5214'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx + 14, y + hh * 0.36, 7, 0, TAU); ctx.stroke(); }
  txt(ctx, money(v.coins), cx + 34, y + hh * 0.36, Math.min(30, hh * 0.42), PAL.gold, { weight: 800, maxW: seg - 40 });
  txt(ctx, `Hold ${holdCount(v)}/${v.ship.cap}`, cx + 4, y + hh * 0.74, Math.min(20, hh * 0.28), PAL.text, { weight: 700, maxW: seg - 10 });
  // hull bar
  const hx = x + left + seg - 4, hw = Math.min(280, H.w - left - seg - pauseW - 14);
  const frac = v.ship.hp / v.ship.maxHp;
  txt(ctx, `Hull ${v.ship.hp}/${v.ship.maxHp}`, hx + 8, y + hh * 0.34, Math.min(22, hh * 0.3), frac < 0.35 ? PAL.coralHi : PAL.text, { weight: 800, maxW: hw - 10 });
  bar(ctx, { x: hx + 8, y: y + hh * 0.56, w: hw - 16, h: Math.max(12, hh * 0.22) }, frac, frac < 0.35 ? PAL.coral : frac < 0.65 ? PAL.gold : '#5fd0a0');
  // pause
  const pr = { x: H.x + H.w - pauseW - 6, y: y + 6, w: pauseW, h: hh - 12 };
  button(ctx, pr, '', { kind: 'quiet', icon: 'pause', size: 28, noShadow: true });
  void pl;
}

function renderMap(ctx, st, L, v, wind) {
  const M = L.voy.map, pl = st.pl, X = mapXform(M, 0.07), t = st.t, calm = st.prefs.calm;
  const d3 = v3.on;
  ctx.save(); rrect(ctx, M, 24); ctx.clip();
  if (!d3) { drawSea(ctx, M, t, wind, calm); drawIslets(ctx, X.to, X.s, t); windStreaks(ctx, M, t, wind, calm); }
  // routes
  const sel = pl.sel, here = v.at === 'port' ? v.loc : null;
  for (const e of edges) {
    const a = X.to(PORTS[e.a].x, PORTS[e.a].y), b = X.to(PORTS[e.b].x, PORTS[e.b].y);
    const active = v.at === 'port' && (e.a === here || e.b === here), onLeg = pl.leg && ((e.a === pl.leg.from && e.b === pl.leg.to) || (e.b === pl.leg.from && e.a === pl.leg.to));
    const isSel = active && sel !== null && (e.a === sel || e.b === sel);
    dottedRoute(ctx, a.x, a.y, b.x, b.y, { col: isSel ? PAL.gold : onLeg ? 'rgba(255,240,190,0.9)' : active ? 'rgba(248,239,214,0.8)' : 'rgba(248,239,214,0.28)', w: isSel || onLeg ? 5 : 3.5, dash: isSel || onLeg ? [3, 10] : [2, 11], t, flow: isSel ? 30 : 0 });
  }
  // ports
  PORTS.forEach((p, i) => {
    const q = X.to(p.x, p.y), r = p.r * X.s;
    const isHere = here === i, near = here !== null && routeDist(here, i) > 0;
    if (!d3) {
      drawIsland(ctx, q.x, q.y, r, portSeed(i), t, p.id === 'ternate');
      drawPortMarker(ctx, q.x, q.y, Math.max(7, X.s * 0.016), { here: isHere, sel: near && (sel === i || (!st.prefs.calm && sel === null && false)), yard: p.yard, t });
      if (near && sel !== i) { ctx.strokeStyle = 'rgba(255,240,170,0.5)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(7, X.s * 0.016) * (1.7 + 0.15 * Math.sin(t * 3 + i)), 0, TAU); ctx.stroke(); }
    }
    const fs = Math.max(15, X.s * 0.036);
    txt(ctx, p.name, q.x, q.y + r * 1.4 + fs * 0.7, fs, PAL.text, { align: 'center', weight: 800, stroke: 5, maxW: X.s * 0.24 });
  });
  if (here !== null) {
    for (const rt of routesFrom(here)) {
      const B = PORTS[rt.to], q = X.to(B.x, B.y), fs = Math.max(14, X.s * 0.031), isSel = rt.to === sel;
      const lab = isSel ? `${rt.dist} nm · ${estDays(v, rt.to)}d` : `${estDays(v, rt.to)}d`;
      ctx.font = `800 ${fs}px ${UI}`; const tw = ctx.measureText(lab).width + 16, py = q.y - B.r * X.s * 1.5 - fs * 1.1;
      ctx.fillStyle = isSel ? 'rgba(242,198,90,0.95)' : 'rgba(4,22,32,0.82)'; rrect(ctx, { x: q.x - tw / 2, y: py - fs * 0.85, w: tw, h: fs * 1.7 }, fs * 0.85); ctx.fill();
      txt(ctx, lab, q.x, py + 1, fs, isSel ? '#06222e' : PAL.gold, { align: 'center', weight: 800 });
    }
  }
  // the ship
  let sx, sy, head;
  if (pl.leg) {
    const a = PORTS[pl.leg.from], b = PORTS[pl.leg.to], u = clamp01(pl.dispProg / pl.leg.dist);
    const p = X.to(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u); sx = p.x; sy = p.y; head = bearing(pl.leg.from, pl.leg.to);
  } else {
    const p0 = PORTS[v.loc], p = X.to(p0.x, p0.y); sx = p.x + X.s * 0.02; sy = p.y - X.s * 0.035;
    head = sel !== null ? bearing(v.loc, sel) : 0.3;
  }
  const setting = pl.leg ? (pl.lastSetting ?? 'full') : 'anchor';
  if (!d3) drawShipTop(ctx, sx, sy, Math.max(40, X.s * 0.14), head, wind.dir, v.ship, setting, calm ? 0 : t, !pl.leg);
  drawParticles(ctx, pl.parts);
  // compass and wind chip
  drawCompass(ctx, M.x + M.w - 40 - 6, M.y + M.h - 46, 26, 0.8);
  ctx.restore();
  // the wind chip (top-left of the chart)
  const cls = windClass(wind.str);
  const chipX = M.x + 12, chipY = M.y + 12, cw = Math.min(250, M.w * 0.46);
  panel(ctx, { x: chipX, y: chipY, w: cw, h: 62 }, { wood: true, fill: '#33200f', rad: 14, noRivets: true });
  drawWindArrow(ctx, chipX + 34, chipY + 31, 20, wind.dir, wind.str, wind.squall ? PAL.coralHi : PAL.foam);
  txt(ctx, wind.squall ? 'Squall' : CLASS_NAME[cls], chipX + 68, chipY + 22, 24, wind.squall ? PAL.coralHi : PAL.text, { weight: 800, maxW: cw - 76 });
  txt(ctx, 'Wind today', chipX + 68, chipY + 45, 18, PAL.dim, { weight: 600, maxW: cw - 76 });
  edgeStroke(ctx, M, 24, 0.3);
}

function renderCoach(ctx, st, R, ai) {
  panel(ctx, R, { fill: 'rgba(8,40,52,0.95)', rad: 18, stroke: 'rgba(242,198,90,0.55)' });
  const ph = ai.phase === 'think' ? 'THINK' : ai.phase === 'reveal' ? 'REVEAL' : ai.phase === 'act' ? 'ACT' : 'WATCH';
  const col = ai.phase === 'think' ? '#7fd0c6' : ai.phase === 'reveal' ? PAL.gold : ai.phase === 'act' ? PAL.coralHi : PAL.dim;
  chip(ctx, R.x + 16, R.y + 30, ph, 22, { fill: col, color: '#06222e' });
  const lim = ai.phase === 'think' ? st.prefs.thinkSec : 2;
  if (ai.phase === 'think' || ai.phase === 'reveal') {
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, { x: R.x + 130, y: R.y + 24, w: R.w - 130 - 150, h: 12 }, 6); ctx.fill();
    ctx.fillStyle = col; rrect(ctx, { x: R.x + 130, y: R.y + 24, w: Math.max(8, (R.w - 280) * clamp01(ai.t / lim)), h: 12 }, 6); ctx.fill();
  }
  const sk = { x: R.x + R.w - 130, y: R.y + 6, w: 118, h: 48 };
  if (ai.phase === 'think' || ai.phase === 'reveal') button(ctx, sk, 'Skip', { kind: 'quiet', size: 22, icon: 'skip', noShadow: true });
  ctx.font = `600 ${Math.min(26, R.h * 0.14)}px ${UI}`;
  const lines = wrap(ctx, ai.text || '', R.w - 36);
  const fs = Math.min(26, R.h * 0.14);
  lines.slice(0, Math.floor((R.h - 76) / (fs * 1.35))).forEach((ln, i) => txt(ctx, ln, R.x + 18, R.y + 76 + i * fs * 1.35, fs, PAL.text, { weight: 600 }));
}

function renderPortPanel(ctx, st, L, v) {
  const pl = st.pl, auto = pl.mode === 'auto';
  const R = portPanel(L.voy.panel, auto);
  panel(ctx, L.voy.panel);
  if (auto && pl.ai) renderCoach(ctx, st, R.coach, pl.ai);
  const port = PORTS[v.loc];
  txt(ctx, port.name, R.head.x + 4, R.head.y + 22, 40, PAL.gold, { font: DISPLAY, weight: 700, maxW: R.head.w - 4 });
  txt(ctx, fitText(ctx, port.note, R.head.w - 4, 17, 600), R.head.x + 4, R.head.y + 54, 17, PAL.dim, { weight: 600 });
  if (!auto) button(ctx, R.think, 'Think', { kind: 'quiet', size: 26, icon: 'think', noShadow: true });
  // lots + yard + wait
  const lots = ['1', '5', 'Max'];
  R.lots.forEach((r, i) => button(ctx, r, lots[i], { kind: pl.lot === i ? 'on' : 'quiet', size: 26, noShadow: true }));
  button(ctx, R.yard, v.loc === 2 ? 'Shipyard' : 'Repair', { kind: v.ship.hp < v.ship.maxHp || v.loc === 2 ? 'quiet' : 'disabled', size: 24, noShadow: true });
  button(ctx, R.wait, 'Wait a day', { kind: 'quiet', size: 24, noShadow: true });
  // market list (clipped, scrolls)
  const Lr = R.list, rows = GOODS.length, rh = R.rowH, total = rows * rh;
  pl.listMax = Math.max(0, total - Lr.h); pl.scroll = clamp(pl.scroll, 0, pl.listMax);
  ctx.save(); rrect(ctx, Lr, 14); ctx.clip();
  for (let g = 0; g < rows; g++) {
    const y = Lr.y + g * rh - pl.scroll;
    if (y + rh < Lr.y || y > Lr.y + Lr.h) continue;
    const r = { x: Lr.x, y: y + 3, w: Lr.w - (pl.listMax > 0 ? 12 : 0), h: rh - 6 };
    { const rg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); rg.addColorStop(0, 'rgba(255,236,200,0.13)'); rg.addColorStop(1, 'rgba(255,236,200,0.05)'); ctx.fillStyle = rg; rrect(ctx, r, 14); ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(236,196,100,0.28)'; rrect(ctx, r, 14); ctx.stroke(); }
    drawGood(ctx, GOODS[g].id, r.x + r.h * 0.6, r.y + r.h / 2, r.h * 0.72);
    const nx = r.x + r.h * 1.15, bw = clamp(r.w * 0.24, 118, 170);
    const ratio = priceRatio(v, v.loc, g), tag = ratio <= 0.75 ? 'CHEAP' : ratio >= 1.3 ? 'DEAR' : '';
    txt(ctx, GOODS[g].name, nx, r.y + r.h * 0.34, Math.min(26, r.h * 0.38), PAL.text, { weight: 800, maxW: r.w - r.h * 1.15 - bw * 2 - 70 });
    const sub = v.hold[g] ? `In hold ${v.hold[g]}` : tag ? '' : ' ';
    if (tag) { chip(ctx, nx, r.y + r.h * 0.74, tag, 16, { fill: tag === 'CHEAP' ? '#2e9d78' : PAL.goldDk, color: '#fff' }); if (v.hold[g]) txt(ctx, sub, nx + 86, r.y + r.h * 0.74, 19, PAL.dim, { weight: 700 }); }
    else if (sub.trim()) txt(ctx, sub, nx, r.y + r.h * 0.74, 20, PAL.dim, { weight: 700 });
    const sellR = { x: r.x + r.w - bw - 8, y: r.y + 6, w: bw, h: r.h - 12 }, buyR = { x: sellR.x - bw - 8, y: r.y + 6, w: bw, h: r.h - 12 };
    const bp = buyPrice(v, v.loc, g), sp = sellPrice(v, v.loc, g);
    const canBuy = holdFree(v) > 0 && v.coins >= bp, canSell = v.hold[g] > 0;
    button(ctx, buyR, `Buy ${bp}`, { kind: canBuy ? 'ghost' : 'disabled', size: 24, noShadow: true, sub: canBuy ? `${pl.lot === 0 ? 1 : pl.lot === 1 ? 5 : 'max'} at a time` : undefined });
    const gain = v.hold[g] ? sp - Math.round(v.lastBuy[g]) : 0;
    button(ctx, sellR, `Sell ${sp}`, { kind: canSell ? (gain > 0 ? 'on' : 'ghost') : 'disabled', size: 24, noShadow: true, sub: canSell ? (gain >= 0 ? `+${gain} each` : `${gain} each`) : undefined });
  }
  ctx.restore();
  if (pl.listMax > 0) {
    const th = Math.max(36, Lr.h * Lr.h / total);
    ctx.fillStyle = 'rgba(235,250,245,0.12)'; rrect(ctx, { x: Lr.x + Lr.w - 8, y: Lr.y + 4, w: 6, h: Lr.h - 8 }, 3); ctx.fill();
    ctx.fillStyle = 'rgba(242,198,90,0.8)'; rrect(ctx, { x: Lr.x + Lr.w - 8, y: Lr.y + 4 + (Lr.h - 8 - th) * (pl.scroll / pl.listMax), w: 6, h: th }, 3); ctx.fill();
  }
  // route strip
  const S2 = R.strip, tw = R.go.x - S2.x - 24;
  ctx.fillStyle = 'rgba(235,250,245,0.08)'; rrect(ctx, S2, 16); ctx.fill();
  if (pl.hint && !auto) {
    ctx.font = `700 21px ${UI}`;
    const lines = wrap(ctx, pl.hint.text, tw - 16).slice(0, 3), fs = lines.length > 2 ? 19 : 21;
    lines.forEach((ln, i) => txt(ctx, ln, S2.x + 16, S2.y + S2.h / 2 + (i - (lines.length - 1) / 2) * (fs + 6), fs, PAL.gold, { weight: 700 }));
  } else if (pl.sel !== null) {
    const d = routeDist(v.loc, pl.sel), days = estDays(v, pl.sel);
    txt(ctx, `To ${PORTS[pl.sel].name}`, S2.x + 16, S2.y + S2.h * 0.34, 32, PAL.gold, { font: DISPLAY, weight: 700, maxW: tw });
    txt(ctx, `${d} nm, about ${days} ${days === 1 ? 'day' : 'days'} in today's wind`, S2.x + 16, S2.y + S2.h * 0.72, 20, PAL.text, { weight: 600, maxW: tw });
  } else {
    txt(ctx, fitText(ctx, auto ? 'The captain is choosing a route.' : 'Tap a glowing island to pick a route.', tw, 21, 600), S2.x + 16, S2.y + S2.h / 2, 21, PAL.text, { weight: 600 });
  }
  button(ctx, R.go, 'Set Sail', { kind: pl.sel !== null ? 'primary' : 'disabled', size: 30, icon: pl.sel !== null ? 'play' : undefined });
  if (pl.yardOpen) renderYardSheet(ctx, st, L, v);
}

function renderYardSheet(ctx, st, L, v) {
  const P = L.voy.panel, pl = st.pl, w = Math.min(P.w - 28, 560), h = Math.min(P.h - 20, 520);
  const r = { x: P.x + (P.w - w) / 2, y: P.y + (P.h - h) / 2, w, h };
  ctx.fillStyle = 'rgba(0,10,16,0.6)'; ctx.fillRect(P.x, P.y, P.w, P.h);
  panel(ctx, r, { fill: 'rgba(6,34,46,0.98)', stroke: 'rgba(242,198,90,0.6)' });
  txt(ctx, v.loc === 2 ? 'The shipyard' : 'Repairs', r.x + r.w / 2, r.y + 44, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, maxW: r.w - 30 });
  const rects = pl.yardRects = [];
  const bh = Math.max(76, 66), gap = 12;
  let y = r.y + 84;
  const row = (id, label, sub, kind) => { const b = { x: r.x + 20, y, w: r.w - 40, h: bh }; button(ctx, b, label, { kind, size: 28, sub }); rects.push({ id, r: b }); y += bh + gap; };
  const rc = repairCost(v), need = v.ship.maxHp - v.ship.hp;
  row('repair', need > 0 ? `Repair all (${need} points)` : 'Hull is sound', need > 0 ? `${rc} coins` : '', need > 0 && v.coins > 0 ? 'primary' : 'disabled');
  if (v.loc === 2) {
    row('hold', `Bigger hold  +${TUNE.holdUpgrade.bales} bales`, `${TUNE.holdUpgrade.cost} coins  ·  done ${v.ship.holdUp}/${TUNE.holdUpgrade.max}`, v.ship.holdUp < TUNE.holdUpgrade.max && v.coins >= TUNE.holdUpgrade.cost ? 'quiet' : 'disabled');
    row('sail', `Stronger sailcloth  +${TUNE.sailUpgrade.strain}`, `${TUNE.sailUpgrade.cost} coins  ·  done ${v.ship.sailUp}/${TUNE.sailUpgrade.max}`, v.ship.sailUp < TUNE.sailUpgrade.max && v.coins >= TUNE.sailUpgrade.cost ? 'quiet' : 'disabled');
  } else txt(ctx, 'Only Bira has a yard for upgrades. Repairs cost double here.', r.x + r.w / 2, y + 30, 21, PAL.dim, { align: 'center', weight: 600, maxW: r.w - 40 });
  const cb = { x: r.x + 20, y: r.y + r.h - bh - 16, w: r.w - 40, h: bh };
  button(ctx, cb, 'Close', { kind: 'ghost', size: 28 }); rects.push({ id: 'close', r: cb });
}

function renderSeaPanel(ctx, st, L, v) {
  const pl = st.pl, auto = pl.mode === 'auto', s = pl.leg;
  const R = seaPanel(L.voy.panel, auto);
  panel(ctx, L.voy.panel);
  if (auto && pl.ai) renderCoach(ctx, st, R.coach, pl.ai);
  // leg
  const lg = R.leg, frac = clamp01(pl.dispProg / s.dist);
  txt(ctx, `${PORTS[s.from].name}  to  ${PORTS[s.to].name}`, lg.x + 4, lg.y + 22, 28, PAL.gold, { font: DISPLAY, weight: 700, maxW: lg.w - 8 });
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; rrect(ctx, { x: lg.x + 4, y: lg.y + 40, w: lg.w - 8, h: 16 }, 8); ctx.fill();
  ctx.fillStyle = PAL.gold; rrect(ctx, { x: lg.x + 4, y: lg.y + 40, w: Math.max(14, (lg.w - 8) * frac), h: 16 }, 8); ctx.fill();
  txt(ctx, `${Math.round(Math.min(s.dist, pl.dispProg))} / ${s.dist} nm`, lg.x + lg.w - 6, lg.y + 22, 20, PAL.text, { align: 'right', weight: 700 });
  // wind card
  const wcard = R.wind, w = windAt(v), course = bearing(s.from, s.to), ang = angDiff(course, w.dir), cls = windClass(w.str);
  inlay(ctx, wcard, 16);
  const dcx = wcard.x + wcard.h / 2 + 6, dcy = wcard.y + wcard.h / 2, dr = wcard.h * 0.36;
  ctx.fillStyle = 'rgba(4,22,32,0.7)'; ctx.beginPath(); ctx.arc(dcx, dcy, dr * 1.35, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(220,245,240,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  drawShipTop(ctx, dcx, dcy, dr * 1.1, -Math.PI / 2, w.dir - course - Math.PI / 2, v.ship, 'full', 0, true);
  drawWindArrow(ctx, dcx, dcy - dr * 0.0, dr * 0.9, w.dir - course - Math.PI / 2, w.str, w.squall ? PAL.coralHi : '#bfeee6');
  const tx = wcard.x + wcard.h + 18, tw = wcard.w - wcard.h - 26;
  txt(ctx, w.squall ? 'Squall today' : CLASS_NAME[cls], tx, wcard.y + wcard.h * 0.24, Math.min(30, wcard.h * 0.2), w.squall ? PAL.coralHi : PAL.text, { weight: 800, maxW: tw });
  txt(ctx, `${pointName(ang)}  (x${pointOfSail(ang).toFixed(2)})`, tx, wcard.y + wcard.h * 0.5, Math.min(22, wcard.h * 0.15), PAL.gold, { weight: 700, maxW: tw });
  const w2 = windAt(v, v.day + 1), c2 = windClass(w2.str);
  txt(ctx, `Tomorrow: ${w2.squall ? 'a squall' : CLASS_NAME[c2]}`, tx, wcard.y + wcard.h * 0.76, Math.min(21, wcard.h * 0.14), PAL.dim, { weight: 600, maxW: tw });
  // setting buttons
  const best = pl.hint && pl.hint.kind === 'setting' ? pl.hint.setting : null;
  SETTINGS.forEach((sname, i) => {
    const r = R.set[i], dr2 = dayRun(v, sname), on = pl.lastSetting === sname && pl.hold;
    const col = sname === 'full' ? PAL.gold : sname === 'reef' ? '#7fd0c6' : '#9fb4c0';
    inlay(ctx, r, 18, { lit: on ? (sname === 'full' ? '#f2c65a' : '#7fd0c6') : null, w: best === sname ? 4 : on ? 3 : 1.8, stroke: best === sname ? PAL.coralHi : on ? col : 'rgba(217,173,78,0.5)' });
    // little sail glyph
    const gx = r.x + r.w / 2, gy = r.y + r.h * 0.26, gs = Math.min(r.h * 0.2, 28);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 3;
    if (sname === 'anchor') { ctx.beginPath(); ctx.arc(gx, gy - gs * 0.7, gs * 0.22, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(gx, gy - gs * 0.5); ctx.lineTo(gx, gy + gs * 0.7); ctx.moveTo(gx - gs * 0.55, gy - gs * 0.1); ctx.lineTo(gx + gs * 0.55, gy - gs * 0.1); ctx.moveTo(gx - gs * 0.7, gy + gs * 0.3); ctx.quadraticCurveTo(gx, gy + gs * 1.1, gx + gs * 0.7, gy + gs * 0.3); ctx.stroke(); }
    else { const k = sname === 'full' ? 1 : 0.6; ctx.beginPath(); ctx.moveTo(gx - 2, gy - gs * k); ctx.lineTo(gx - 2, gy + gs * 0.7); ctx.lineTo(gx + gs * 0.8 * k, gy + gs * 0.7); ctx.closePath(); ctx.fill(); ctx.fillRect(gx - 6, gy - gs, 4, gs * 1.8); }
    txt(ctx, `${SET_NAME[sname]}`, r.x + r.w / 2, r.y + r.h * 0.55, Math.min(26, r.h * 0.2), PAL.text, { align: 'center', weight: 800, maxW: r.w - 12 });
    txt(ctx, sname === 'anchor' ? 'wait here' : `+${Math.round(dr2.dist)} nm`, r.x + r.w / 2, r.y + r.h * 0.74, Math.min(22, r.h * 0.17), PAL.gold, { align: 'center', weight: 700, maxW: r.w - 12 });
    txt(ctx, dr2.dmg >= 0.5 ? `-${Math.round(dr2.dmg)} hull` : 'no strain', r.x + r.w / 2, r.y + r.h * 0.9, Math.min(20, r.h * 0.15), dr2.dmg >= 0.5 ? PAL.coralHi : PAL.dim, { align: 'center', weight: 700, maxW: r.w - 12 });
  });
  button(ctx, R.hold, pl.hold ? 'Hold: until weather changes' : 'Hold: off (one day)', { kind: pl.hold ? 'on' : 'quiet', size: 22, noShadow: true });
  if (!auto) button(ctx, R.think, 'Think', { kind: 'quiet', size: 26, icon: 'think', noShadow: true });
  if (pl.hint && !auto) {
    ctx.fillStyle = 'rgba(4,22,32,0.92)'; const hr = { x: R.wind.x, y: R.wind.y, w: R.wind.w, h: R.wind.h }; rrect(ctx, hr, 16); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = PAL.gold; rrect(ctx, hr, 16); ctx.stroke();
    ctx.font = `700 ${Math.min(26, hr.h * 0.2)}px ${UI}`;
    wrap(ctx, pl.hint.text, hr.w - 32).slice(0, 4).forEach((ln, i) => txt(ctx, ln, hr.x + 16, hr.y + 34 + i * Math.min(32, hr.h * 0.24), Math.min(26, hr.h * 0.2), PAL.gold, { weight: 700 }));
  }
}

function renderVoyage(ctx, st, L, view, meta, pauseItems) {
  const pl = st.pl, v = pl.v, w = windAt(v);
  // base sea behind everything
  if (!v3.on) { drawSea(ctx, { x: 0, y: 0, w: L.w + 20, h: L.h + 20 }, st.t, w, true); ctx.fillStyle = 'rgba(2,18,26,0.35)'; ctx.fillRect(0, 0, L.w, L.h); }
  renderMap(ctx, st, L, v, w);
  renderHud(ctx, st, L, v);
  if (!pl.leg) renderPortPanel(ctx, st, L, v); else renderSeaPanel(ctx, st, L, v);
  // banner (arrival, start)
  if (pl.banner) {
    const a = clamp(Math.min(pl.banner.t / 0.25, (2.2 - pl.banner.t) / 0.4), 0, 1), M = L.voy.map;
    ctx.save(); ctx.globalAlpha = a;
    chip(ctx, M.x + M.w / 2, M.y + M.h * 0.5, pl.banner.text, 34, { align: 'center', fill: 'rgba(4,22,32,0.9)', stroke: PAL.gold, color: PAL.gold });
    if (pl.banner.sub) txt(ctx, pl.banner.sub, M.x + M.w / 2, M.y + M.h * 0.5 + 56, 24, PAL.text, { align: 'center', weight: 700, stroke: 5 });
    ctx.restore();
  }
  for (const p of pl.pops) {
    ctx.save(); ctx.globalAlpha = clamp01(1 - p.age / 1.1);
    txt(ctx, p.text, p.x, p.y - p.age * 46, p.size, p.col, { align: 'center', weight: 800, stroke: 6 });
    ctx.restore();
  }
  if (pl.paused) {
    ctx.fillStyle = 'rgba(0,10,16,0.88)'; ctx.fillRect(0, 0, L.w, L.h);
    const items = pauseItems(), M = menuRects(L, items.length);
    txt(ctx, 'Paused', M.title.x, M.title.y, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 8 });
    const names = { resume: 'Resume', restart: 'New voyage', rules: 'Rules', quit: 'Menu' };
    items.forEach((it, i) => { ctx.fillStyle = '#0b2f40'; rrect(ctx, M.btns[i], 22); ctx.fill(); button(ctx, M.btns[i], names[it], { kind: it === 'resume' ? 'primary' : 'ghost', size: 32, icon: it === 'resume' ? 'play' : undefined }); });
  }
}

// ---- result ----------------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L) {
  const r = st.result, Rr = L.result, p = Rr.panel, wide = L.mode === 'wide' || p.w > p.h * 1.15;
  panel(ctx, p, { wood: true, fill: '#33200f' }); edgeStroke(ctx, p, 28, 0.55);
  const head = r.mode === 'auto' ? 'LESSON COMPLETE' : r.sunk ? 'THE SHIP IS LOST' : 'THE VOYAGE IS OVER';
  txt(ctx, head, p.x + p.w / 2, p.y + 44, 22, PAL.dim, { align: 'center', weight: 800 });
  const lx = wide ? p.x + p.w * 0.27 : p.x + p.w / 2, rx0 = wide ? p.x + p.w * 0.5 : p.x + 32, rw = wide ? p.w * 0.48 - 24 : p.w - 64;
  let y = p.y + (wide ? 100 : 118);
  if (r.mode !== 'auto') {
    lettering(ctx, RANKS[r.rank].name, lx, y, wide ? 44 : 56, wide ? p.w * 0.44 : p.w - 60);
    y += wide ? 56 : 70;
  }
  txt(ctx, 'SCORE', lx, y, 22, PAL.gold, { align: 'center', weight: 800 });
  txt(ctx, money(r.score), lx, y + 62, wide ? 70 : 92, PAL.text, { align: 'center', font: DISPLAY, weight: 700, stroke: 8, maxW: wide ? p.w * 0.42 : p.w - 60 });
  y += wide ? 126 : 150;
  if (r.mode !== 'auto') {
    for (let i = 0; i < 3; i++) {
      const on = i < r.rank, cx = lx + (i - 1) * (wide ? 54 : 66);
      ctx.fillStyle = on ? PAL.gold : 'rgba(255,255,255,0.14)';
      ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = (k % 2 ? 0.45 : 1) * (wide ? 22 : 28); ctx.lineTo(cx + Math.cos(a) * rr, y + 10 + Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    }
    if (r.newBest) chip(ctx, lx, y + (wide ? 62 : 78), 'NEW BEST', 24, { align: 'center', fill: PAL.coral, color: '#fff' });
    else txt(ctx, `Best ${money(st.best[r.voyageMode] || 0)}`, lx, y + (wide ? 62 : 78), 26, PAL.dim, { align: 'center', weight: 700 });
  }
  let ry = wide ? p.y + 100 : y + (wide ? 100 : 130);
  const tile = (x, yy, ww, label, val) => { ctx.fillStyle = 'rgba(235,250,245,0.07)'; rrect(ctx, { x, y: yy, w: ww, h: 92 }, 16); ctx.fill(); txt(ctx, label, x + ww / 2, yy + 26, 17, PAL.gold, { align: 'center', weight: 800 }); txt(ctx, val, x + ww / 2, yy + 62, 30, PAL.text, { align: 'center', weight: 800, maxW: ww - 10 }); };
  const g = 10, tw = (rw - g * 2) / 3;
  tile(rx0, ry, tw, 'COINS', money(r.coins)); tile(rx0 + tw + g, ry, tw, 'CARGO', money(r.cargo)); tile(rx0 + (tw + g) * 2, ry, tw, 'SHIP', money(r.hull));
  ry += 108;
  tile(rx0, ry, tw, 'DAYS', String(r.days)); tile(rx0 + tw + g, ry, tw, 'LEGS', String(r.legs)); tile(rx0 + (tw + g) * 2, ry, tw, 'HULL LOST', String(r.damage));
  ry += 112;
  const line = r.net >= 0 ? `Net gain ${money(r.net)} coins` : `Net loss ${money(-r.net)} coins`;
  txt(ctx, line, rx0 + rw / 2, ry + 8, 26, r.net >= 0 ? PAL.gold : PAL.coralHi, { align: 'center', weight: 800, maxW: rw });
  txt(ctx, `${r.build}  ·  craft ${Math.round(r.q * 100)}%`, rx0 + rw / 2, ry + 44, 22, PAL.dim, { align: 'center', weight: 600, maxW: rw });
  button(ctx, Rr.again, r.mode === 'auto' ? 'Watch again' : 'Sail again', { kind: 'primary', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, r = { x: S.x + S.w / 2 - Math.min(S.w - 40, 560) / 2, y: S.y + S.h / 2 - 220, w: Math.min(S.w - 40, 560), h: 440 };
  panel(ctx, r, { fill: 'rgba(4,22,32,0.94)' }); edgeStroke(ctx, r, 24, 0.6);
  txt(ctx, 'That is the preview', r.x + r.w / 2, r.y + 80, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: r.w - 40 });
  ctx.font = `500 28px ${UI}`;
  wrap(ctx, 'Get the full Pinisi on iPhone and Android: the whole archipelago, the monsoon voyage, three hulls, three timbers and Watch and Learn.', r.w - 70).forEach((ln, i) => txt(ctx, ln, r.x + r.w / 2, r.y + 170 + i * 40, 28, PAL.text, { align: 'center', weight: 500 }));
  txt(ctx, 'Tap to go back', r.x + r.w / 2, r.y + r.h - 40, 24, PAL.dim, { align: 'center', weight: 600 });
}

export { sellValue, finalSale, rankIndex, bestSetting };
