// Every non-race screen, plus the dispatcher. Immediate mode: each control is drawn and registered in one call (see ui.js).
import { COL, FONT_D, R, icon } from './ui.js';
import { backdrop, veil, sideVeil, header, avatar, initials, toast } from './chrome.js';
import { drawCredit, drawMoreLine } from './brand.js';
import { REGATTAS, ROUNDS, THEMES, THEME_LIST, QUICK_LENGTHS, QUICK_LEVELS, DRUM_CHARTS, PLAN_TEXT, CREWS, crewById } from './crews.js';
import { clamp, fmtTime, placeName, TIER_LABEL } from './common.js';
import { drawRaceHud, drawFallback, leaveDialog, drawPad } from './hud.js';
import { drawAbout, drawHow, drawRules } from './pages.js';

const hsl = (h, s = 70, l = 52) => `hsl(${h},${s}%,${l}%)`;

function zoomChips(ctx, G) {
  const { L, ui, state } = G, U = L.U, z0 = ui.zoom; ui.zoom = 1;
  const w = 58, h = 46, x = U.x + U.w - 2 * w - 18, y = U.y + 8;
  ui.button(ctx, 'zoom-', R(x, y, w, h), 'A−', { kind: 'chip', size: 22, disabled: state.prefs.zoomIdx <= 0 });
  ui.button(ctx, 'zoom+', R(x + w + 8, y, w, h), 'A+', { kind: 'chip', size: 22, disabled: state.prefs.zoomIdx >= G.TEXT_SCALES.length - 1 });
  ui.zoom = z0;
}

// the game emblem: a dragon-head bow over a drum
export function emblem(ctx, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 100, s / 100);
  // drum
  const dg = ctx.createLinearGradient(-50, 0, 50, 0); dg.addColorStop(0, '#9a1a1a'); dg.addColorStop(0.5, '#e8442c'); dg.addColorStop(1, '#8a1414');
  ctx.fillStyle = dg; ctx.beginPath(); ctx.ellipse(0, 34, 44, 16, 0, 0, 6.3); ctx.fill(); ctx.fillRect(-44, -10, 88, 44); ctx.beginPath(); ctx.ellipse(0, 34, 44, 16, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = '#f6e7c2'; ctx.beginPath(); ctx.ellipse(0, -10, 44, 16, 0, 0, 6.3); ctx.fill();
  ctx.strokeStyle = '#e8b64a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -10, 44, 16, 0, 0, 6.3); ctx.stroke();
  // sticks
  ctx.strokeStyle = '#f3dba0'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-52, -62); ctx.lineTo(-8, -14); ctx.moveTo(52, -62); ctx.lineTo(8, -14); ctx.stroke();
  ctx.restore();
}

// ---- title layout (also used by the camera) -----------------------------------------------------------------------------
export function titleLayout(L) {
  if (L._title) return L._title;
  const U = L.U, T = {};
  const side = L.land && L.aspect >= 1.3;
  T.side = side;
  if (side) {
    const lw = clamp(Math.round(U.w * 0.4), 360, 580);
    const s = clamp(L.h / 720, 0.8, 1.25);
    T.col = R(U.x + 16, U.y, lw, U.h);
    T.wm = { x: U.x + 24, y: U.y + 22, s, align: 'left' };
    const wmH = (84 + 120) * s * 0.78 + 60 * s;
    T.menu = R(T.col.x, U.y + 26 + wmH, lw, U.h - (26 + wmH) - 74);
    T.credit = { x: T.col.x + lw / 2, y: U.y + U.h - 22 - L.ins.b * 0.3 };
  } else {
    const s = clamp((L.h - 640) / 900, 0.5, 1);
    const wmH = (84 + 118) * s * 0.9 + 70 * s;
    T.wm = { x: U.x + U.w / 2, y: U.y + 26, s, align: 'center' };
    const regH = clamp(L.h * 0.3, 190, 560);
    T.region = R(U.x + 8, U.y + 26 + wmH, U.w - 16, regH);
    const my = T.region.y + T.region.h + 4;
    T.menu = R(U.x + 20, my, U.w - 40, U.y + U.h - my - 78);
    T.credit = { x: U.x + U.w / 2, y: U.y + U.h - 24 - L.ins.b * 0.3 };
  }
  L._title = T;
  return T;
}

function wordmark(ctx, ui, wm) {
  const s = wm.s, ax = wm.x;
  ctx.save(); ctx.textBaseline = 'alphabetic';
  const draw = (str, y, size, fill, strokeW) => {
    ctx.font = `800 ${size}px ${FONT_D}`; ctx.textAlign = wm.align;
    ctx.lineJoin = 'round'; ctx.lineWidth = strokeW; ctx.strokeStyle = '#2a0a0a'; ctx.strokeText(str, ax, y);
    ctx.fillStyle = fill; ctx.fillText(str, ax, y);
  };
  const l1 = 84 * s, l2 = 128 * s;
  const g1 = ctx.createLinearGradient(0, wm.y, 0, wm.y + l1); g1.addColorStop(0, '#fff6dc'); g1.addColorStop(1, '#ffd27a');
  draw('DRAGON BOAT', wm.y + l1 * 0.82, l1, g1, 10 * s);
  const g2 = ctx.createLinearGradient(0, wm.y + l1, 0, wm.y + l1 + l2); g2.addColorStop(0, '#ff7a5a'); g2.addColorStop(1, '#d6281a');
  draw('RACE', wm.y + l1 * 0.82 + l2 * 0.86, l2, g2, 12 * s);
  ctx.font = `800 ${l2}px ${FONT_D}`; const wR = ctx.measureText('RACE').width;
  emblem(ctx, (wm.align === 'center' ? ax + wR / 2 : ax + wR) + l2 * 0.5, wm.y + l1 * 0.82 + l2 * 0.5, l2 * 0.78);
  ctx.font = `700 ${22 * s}px ${FONT_D}`; ctx.textAlign = wm.align; ctx.fillStyle = 'rgba(255,236,200,0.85)';
  ctx.fillText('REAL 3D  ·  DRUM RHYTHM  ·  REGATTA', ax, wm.y + l1 * 0.82 + l2 * 0.86 + 34 * s);
  ctx.restore();
}

function title(ctx, G) {
  const { L, ui, state } = G;
  const T = titleLayout(L);
  if (state.v3.on) { if (T.side) sideVeil(ctx, L, 0, T.col.x + T.col.w + 90, 0.86); else veil(ctx, L, { top: 0.62, mid: 0.0, bottom: 0.82 }); }
  wordmark(ctx, ui, T.wm);
  zoomChips(ctx, G);
  const m = T.menu;
  const gap = 12, bh = Math.max(T.side ? 70 : 84, ui.fs(34) * 1.75, Math.min(T.side ? 96 : 128, (m.h - 70) / 4.4));
  ui.beginScroll(ctx, m);
  let y = m.y + 4;
  const st = state.progress.stats;
  ui.button(ctx, 'play', R(m.x, y, m.w - 12, bh * 1.18), 'PLAY', { kind: 'primary', icon: 'play', size: 44, sub: st.races ? `${st.wins} wins in ${st.races} races` : 'Regatta, quick race and more' });
  ui.primary = 'play';
  y += bh * 1.18 + gap;
  const cw = (m.w - 12 - gap) / 2;
  const items = [['regatta', 'REGATTA', 'flag'], ['drummer', 'DRUMMER', 'drum'], ['watch', 'WATCH & LEARN', 'eye'], ['how', 'HOW TO PLAY', 'boat']];
  items.forEach((it, i) => { const bx = m.x + (i % 2) * (cw + gap), by = y + Math.floor(i / 2) * (bh + gap); ui.button(ctx, it[0], R(bx, by, cw, bh), it[1], { kind: 'secondary', icon: it[2], size: 28 }); });
  y += 2 * (bh + gap);
  const cw3 = (m.w - 12 - 2 * gap) / 3, sh = Math.max(60, ui.fs(26) * 1.8, bh * 0.7);
  [['rules', 'RULES', 'book'], ['about', 'ABOUT', 'info'], ['settings', 'SETTINGS', 'gear']].forEach((it, i) => ui.button(ctx, it[0], R(m.x + i * (cw3 + gap), y, cw3, sh), it[1], { kind: 'chip', icon: it[2], size: 24 }));
  y += sh + 8;
  ui.endScroll(ctx, y - m.y + 4);
  // the Arcforge lockup, bottom centre under the menu; tapping it goes to the Arcforge home
  const cs = clamp(Math.min(L.U.w, T.side ? T.col.w : L.U.w) / 40, 13, 19);
  drawCredit(ctx, T.credit.x, T.credit.y, cs);
  ui.hit('logo', R(T.credit.x - Math.min(300, (T.side ? T.col.w : L.U.w) / 2), T.credit.y - cs * 2.2, Math.min(600, T.side ? T.col.w : L.U.w), cs * 3.4));
}

// ---- play menu ---------------------------------------------------------------------------------------------------------------
function modes(ctx, G) {
  const { L, ui, state } = G;
  if (state.v3.on) veil(ctx, L, { top: 0.78, mid: 0.55, bottom: 0.85 });
  const c = header(ctx, G, 'PLAY');
  const wide = c.w >= 900;
  const cards = [
    ['m:regatta', 'REGATTA', 'Three rivers, each with a heat, a semifinal and a final. Win a medal to open the next river.', 'flag'],
    ['m:quick', 'QUICK RACE', 'Pick a river, a distance and how tough the rival crews are.', 'boat'],
    ['m:drummer', 'DRUMMER CHALLENGE', `Take the drum and set the tempo: the crew follows your taps. Best score: ${state.progress.drum.best || '-'}.`, 'drum'],
    ['m:lesson', 'LEARN THE BEAT', 'A short guided race: tap, stay in sync, steer, dodge and Surge.', 'bulb'],
    ['m:watch', 'WATCH & LEARN', 'The coach crew races and explains every decision.', 'eye'],
  ];
  const cols = wide ? 2 : 1, gap = 14, pw = (c.w - 32 - gap * (cols - 1)) / cols;
  const view = R(c.x + 16, c.y, c.w - 32, c.h - 12);
  ui.beginScroll(ctx, view);
  let y = view.y + 4, rowH = 0;
  cards.forEach((cd, i) => {
    const bodyH = ui.paraHeight(ctx, cd[2], pw - 150, 22);
    const fillH = (view.h - 8 - gap * (cards.length / cols)) / Math.ceil(cards.length / cols);
    const h = Math.max(118, ui.fs(32) * 1.5 + bodyH + 36, Math.min(fillH, 190));
    const col = i % cols, x = view.x + col * (pw + gap);
    if (col === 0 && i > 0) y += rowH + gap;
    rowH = col === 0 ? h : Math.max(rowH, h);
    const r = R(x, y, pw, h);
    ui.panel(ctx, r, { fill: ui.pressedId === cd[0] ? 'rgba(80,30,24,0.9)' : COL.panel2, radius: 22 });
    ctx.save(); ctx.fillStyle = i === 0 ? COL.orange : 'rgba(80,130,220,0.35)'; ctx.beginPath(); ctx.arc(r.x + 62, r.y + r.h / 2, 38, 0, 6.3); ctx.fill(); ctx.restore();
    icon(ctx, cd[3], r.x + 62, r.y + r.h / 2, 44, '#fff');
    ui.text(ctx, cd[1], r.x + 124, r.y + 20 + ui.fs(32), 32, { disp: true, weight: 800, fit: pw - 140 });
    ui.para(ctx, cd[2], r.x + 124, r.y + 26 + ui.fs(32), pw - 150, 22, { color: COL.dim, weight: 500 });
    ui.hit(cd[0], r);
  });
  y += rowH;
  ui.endScroll(ctx, y - view.y + 8);
  ui.primary = 'm:regatta';
}

// ---- regatta -----------------------------------------------------------------------------------------------------------------
const MEDAL_COL = { gold: '#ffd25a', silver: '#d6dde8', bronze: '#d99a5a' };
function regatta(ctx, G) {
  const { L, ui, state } = G;
  if (state.v3.on) veil(ctx, L, { top: 0.85, mid: 0.85, bottom: 0.9 });
  const c = header(ctx, G, 'REGATTA');
  ui.zoom = G.zoom;
  const view = R(c.x + 16, c.y, c.w - 32, c.h - 12);
  const cols = Math.max(1, Math.min(3, Math.floor((c.w - 32) / (360 * Math.min(G.zoom, 2.2) ** 0.8))));
  const gap = 14, cw = (view.w - 14 - gap * (cols - 1)) / cols;
  ui.beginScroll(ctx, view, 'regatta');
  const h = Math.max(330, 60 + ui.fs(30) * 1.1 + ui.fs(20) * 1.4 + 3 * 54 + ui.fs(22) * 3 + 120);
  let y = view.y + 4;
  REGATTAS.forEach((rg, i) => {
    const locked = !G.regattaUnlocked(i), pr = state.progress.regattas[rg.id], th = THEMES[rg.theme];
    const col = i % cols, x = view.x + col * (cw + gap);
    if (col === 0 && i > 0) y += h + gap;
    const r = R(x, y, cw, h);
    ui.panel(ctx, r, { fill: locked ? 'rgba(10,18,36,0.8)' : COL.panel2, radius: 22, edgeAlpha: locked ? 0.2 : 0.6 });
    const sky = ctx.createLinearGradient(0, r.y, 0, r.y + 84); sky.addColorStop(0, '#' + th.sky.toString(16).padStart(6, '0')); sky.addColorStop(1, '#' + th.fog.toString(16).padStart(6, '0'));
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x + 14, r.y + 14, 72, 72, 20); ctx.clip(); ctx.fillStyle = sky; ctx.fillRect(r.x, r.y, 120, 120);
    ctx.fillStyle = `rgb(${th.water.map((v) => Math.round(v * 255)).join(',')})`; ctx.fillRect(r.x + 14, r.y + 56, 72, 40); ctx.restore();
    icon(ctx, locked ? 'lock' : 'boat', r.x + 50, r.y + 44, 38, locked ? 'rgba(255,255,255,0.6)' : '#fff');
    const tx = r.x + 102, tw = r.w - 116;
    ui.text(ctx, rg.name.toUpperCase(), tx, r.y + 12 + ui.fs(30), 30, { disp: true, weight: 800, color: locked ? COL.faint : COL.ink, fit: tw });
    ui.text(ctx, th.sub, tx, r.y + 18 + ui.fs(30) + ui.fs(20), 20, { color: COL.dim, weight: 500, fit: tw });
    // the three rounds
    let ry = r.y + 100 + ui.fs(20);
    ROUNDS.forEach((rd, k) => {
      const done = pr.stage > k, cur = pr.stage === k && !locked;
      ui.panel(ctx, R(r.x + 14, ry, r.w - 28, 46), { fill: cur ? 'rgba(232,68,44,0.35)' : 'rgba(255,255,255,0.06)', radius: 14, shadow: false, edgeAlpha: cur ? 0.9 : 0.15 });
      ui.text(ctx, `${rd.name.toUpperCase()}  ·  ${rd.len} m`, r.x + 28, ry + 31, 22, { disp: true, weight: 800, fixed: true, color: done ? COL.gold : locked ? COL.faint : COL.ink, fit: r.w - 100 });
      if (done) icon(ctx, 'check', r.x + r.w - 38, ry + 23, 26, '#7dffb0');
      ry += 54;
    });
    const st = locked ? 'Win a medal on the previous river to open it.' : pr.medal ? `Best medal: ${pr.medal.toUpperCase()}${pr.bestTime ? `  ·  best final ${fmtTime(pr.bestTime)}` : ''}` : pr.stage ? `Next: ${ROUNDS[Math.min(2, pr.stage)].name}` : 'Not started';
    ry += ui.para(ctx, st, r.x + 18, ry + 4, r.w - 36, 22, { color: pr.medal ? MEDAL_COL[pr.medal] : locked ? COL.faint : COL.cyan, weight: 700 }) + 10;
    if (pr.medal) { ctx.save(); ctx.fillStyle = MEDAL_COL[pr.medal]; ctx.beginPath(); ctx.arc(r.x + r.w - 40, r.y + 44, 20, 0, 6.3); ctx.fill(); ctx.restore(); icon(ctx, 'star', r.x + r.w - 40, r.y + 44, 22, '#3a2400'); }
    const bh = 64;
    if (!locked) ui.button(ctx, `reg:${rg.id}`, R(r.x + 18, r.y + r.h - bh - 16, r.w - 36, bh), pr.stage >= 3 ? 'RACE THE FINAL AGAIN' : `RACE: ${ROUNDS[pr.stage].name.toUpperCase()}`, { kind: 'primary', icon: 'play', size: 28 });
    else ui.hit(`reg:${rg.id}`, r);
  });
  y += h;
  ui.endScroll(ctx, y - view.y + 10);
  if (state.msg) toast(ctx, G, state.msg.text);
}

// ---- quick race ---------------------------------------------------------------------------------------------------------------
function quick(ctx, G) {
  const { L, ui, state } = G;
  if (state.v3.on) veil(ctx, L, { top: 0.85, mid: 0.85, bottom: 0.9 });
  const c = header(ctx, G, 'QUICK RACE');
  ui.zoom = G.zoom;
  const q = state.quick;
  const startH = Math.max(84, ui.fs(34) * 1.8), segH = Math.max(62, ui.fs(22) * 1.8), labelH = ui.fs(20) + 14;
  const startR = R(c.x + 16, c.y + c.h - startH - 12, c.w - 32, startH);
  const view = R(c.x + 16, c.y, c.w - 32, startR.y - c.y - 10);
  ui.beginScroll(ctx, view, 'quick');
  let y = view.y + 4;
  const sec = (title, idp, opts, cur) => {
    ui.text(ctx, title, view.x + 4, y + ui.fs(20), 20, { color: COL.dim, weight: 700 }); y += labelH;
    ui.segment(ctx, idp, R(view.x, y, view.w - 14, segH), opts, cur); y += segH + 14;
  };
  sec('RIVER', 'qt', THEME_LIST.map((t) => ({ id: t.id, label: t.name.toUpperCase().replace('GRAND ', '').replace(' LANTERNS', '') })), q.theme);
  sec('DISTANCE', 'ql', QUICK_LENGTHS.map((t) => ({ id: t.id, label: `${t.name.toUpperCase()} ${t.len}` })), q.length);
  sec('RIVAL CREWS', 'qv', QUICK_LEVELS.map((t) => ({ id: t.id, label: t.name.toUpperCase() })), q.level);
  const th = THEMES[q.theme], ln = QUICK_LENGTHS.find((x) => x.id === q.length);
  y += ui.para(ctx, `${th.name} (${th.sub.toLowerCase()}), ${ln.len} metres, three rival crews. A random lane.`, view.x + 4, y, view.w - 24, 22, { color: COL.dim, weight: 500 }) + 12;
  ui.endScroll(ctx, y - view.y + 8);
  ui.button(ctx, 'start', startR, 'START RACE', { kind: 'primary', icon: 'play', size: 40 });
  ui.primary = 'start';
}

// ---- drummer challenge select ---------------------------------------------------------------------------------------------------
function drumsel(ctx, G) {
  const { L, ui, state } = G;
  if (state.v3.on) veil(ctx, L, { top: 0.85, mid: 0.85, bottom: 0.9 });
  const c = header(ctx, G, 'DRUMMER CHALLENGE');
  ui.zoom = G.zoom;
  const view = R(c.x + 16, c.y, c.w - 32, c.h - 12);
  ui.beginScroll(ctx, view, 'drum');
  let y = view.y + 4;
  y += ui.para(ctx, 'You are at the drum. Keep the tempo inside each called band; the crew paddles to your taps. Tap twice on a LIFT call.', view.x + 4, y, view.w - 24, 22, { color: COL.dim, weight: 500 }) + 14;
  DRUM_CHARTS.forEach((ch) => {
    const best = state.progress.drum.charts[ch.id];
    const labels = ch.segs.map((s) => s[3]).join(' › ');
    const txtH = ui.paraHeight(ctx, labels, view.w - 180, 20);
    const h = Math.max(150, ui.fs(32) * 1.3 + txtH + 90);
    const r = R(view.x, y, view.w - 14, h);
    ui.panel(ctx, r, { fill: COL.panel2, radius: 22 });
    ui.text(ctx, ch.name.toUpperCase(), r.x + 20, r.y + 12 + ui.fs(32), 32, { disp: true, weight: 800, fit: r.w - 40 });
    ui.para(ctx, labels, r.x + 20, r.y + 18 + ui.fs(32), r.w - 180, 20, { color: COL.dim, weight: 600 });
    ui.text(ctx, best ? `BEST ${best.score}  ·  ${placeName(best.place).toUpperCase()}` : 'NOT PLAYED YET', r.x + 20, r.y + r.h - 24, 22, { disp: true, weight: 800, color: best ? COL.gold : COL.faint, fit: r.w - 190 });
    ui.button(ctx, `drum:${ch.id}`, R(r.x + r.w - 160, r.y + r.h - 70, 140, 56), 'PLAY', { kind: 'primary', icon: 'play', size: 28 });
    y += h + 14;
  });
  ui.endScroll(ctx, y - view.y + 8);
}

// ---- settings ------------------------------------------------------------------------------------------------------------------
function settings(ctx, G) {
  const { L, ui, state } = G;
  const c = header(ctx, G, 'SETTINGS', { zoom: true });
  ui.zoom = G.zoom;
  const pr = state.prefs;
  const view = R(c.x + 16, c.y, c.w - 32, c.h - 12);
  ui.beginScroll(ctx, view, 'settings');
  const w = view.w - 18;
  let y = view.y + 4;
  const row = (id, label, on, sub) => { const h = ui.toggleHeight(ctx, w, label, sub); ui.toggle(ctx, id, R(view.x, y, w, h), label, on, sub); y += h + 4; };
  const title2 = (t) => { y += 10; ui.text(ctx, t, view.x + 2, y + ui.fs(22), 22, { disp: true, weight: 800, color: COL.orange2 }); y += ui.fs(22) * 1.5; };
  title2('SOUND AND FEEL');
  row('s:sound', 'Sound', pr.sound);
  row('s:click', 'Beat click', pr.click, 'A short tick on every drum beat, to help your ear.');
  row('s:haptics', 'Vibration', pr.haptics, 'A tiny buzz on Perfect hits where the device allows it.');
  title2('TIMING');
  ui.text(ctx, 'Timing windows', view.x + 2, y + ui.fs(24), 24, { weight: 700 }); y += ui.fs(24) * 1.4;
  ui.segment(ctx, 's:win', R(view.x, y, w, Math.max(60, ui.fs(22) * 1.8)), [{ id: 'easy', label: 'EASY' }, { id: 'normal', label: 'NORMAL' }, { id: 'tight', label: 'TIGHT' }], pr.window); y += Math.max(60, ui.fs(22) * 1.8) + 14;
  ui.text(ctx, `Timing offset: ${pr.offsetMs > 0 ? '+' : ''}${pr.offsetMs} ms`, view.x + 2, y + ui.fs(24), 24, { weight: 700 }); y += ui.fs(24) * 1.4;
  const bh = Math.max(60, ui.fs(22) * 1.8), bw = Math.min(110, w * 0.22);
  ui.button(ctx, 's:off-', R(view.x, y, bw, bh), '−', { kind: 'chip', size: 34 });
  ui.button(ctx, 's:off+', R(view.x + bw + 10, y, bw, bh), '+', { kind: 'chip', size: 34 });
  ui.button(ctx, 's:calib', R(view.x + 2 * bw + 24, y, w - 2 * bw - 24, bh), 'CALIBRATE', { kind: 'secondary', icon: 'drum', size: 26 }); y += bh + 6;
  y += ui.para(ctx, 'If your taps feel early or late on this device, nudge the offset or run Calibrate.', view.x + 2, y, w - 6, 20, { color: COL.dim, weight: 500 }) + 8;
  title2('WATCH & LEARN');
  ui.text(ctx, 'Coach thinking time', view.x + 2, y + ui.fs(24), 24, { weight: 700 }); y += ui.fs(24) * 1.4;
  ui.segment(ctx, 's:think', R(view.x, y, w, Math.max(60, ui.fs(22) * 1.8)), G.THINK_STEPS.map((t, i) => ({ id: i, label: `${t}s` })), pr.thinkIdx); y += Math.max(60, ui.fs(22) * 1.8) + 14;
  title2('PURCHASES AND DATA');
  const rb = Math.max(70, ui.fs(26) * 1.8);
  ui.button(ctx, 's:restore', R(view.x, y, w, rb), 'RESTORE PURCHASES', { kind: 'secondary', size: 26 }); y += rb + 12;
  ui.button(ctx, 's:reset', R(view.x, y, w, rb), 'RESET PROGRESS', { kind: 'secondary', size: 26 }); y += rb + 12;
  if (state.dev) { ui.button(ctx, 's:unlock', R(view.x, y, w, rb), 'DEV: UNLOCK EVERYTHING', { kind: 'chip', size: 24 }); y += rb + 12; }
  ui.endScroll(ctx, y - view.y + 8);
  if (state.confirm === 'reset') {
    ctx.fillStyle = 'rgba(2,8,16,0.7)'; ctx.fillRect(0, 0, L.w, L.h);
    const dw = Math.min(L.U.w - 40, 520), dh = 270, x = L.U.x + (L.U.w - dw) / 2, yy = L.U.y + (L.U.h - dh) / 2;
    ui.panel(ctx, R(x, yy, dw, dh), { fill: 'rgba(8,18,34,0.97)', radius: 26 });
    const z0 = ui.zoom; ui.zoom = 1;
    ui.text(ctx, 'RESET ALL PROGRESS?', x + dw / 2, yy + 70, 40, { disp: true, weight: 800, fixed: true, align: 'center', fit: dw - 40 });
    ui.button(ctx, 's:reset:no', R(x + 30, yy + 110, dw - 60, 64), 'KEEP IT', { kind: 'primary', size: 30 });
    ui.button(ctx, 's:reset:yes', R(x + 30, yy + 186, dw - 60, 56), 'RESET', { kind: 'danger', size: 26 });
    ui.zoom = z0;
  }
}

// ---- calibration ---------------------------------------------------------------------------------------------------------------------
function calib(ctx, G) {
  const { L, ui, state } = G;
  backdrop(ctx, L, state.t);
  const c = header(ctx, G, 'CALIBRATE');
  const k = state.calib, U = L.U;
  const pad = { cx: U.x + U.w / 2, cy: c.y + c.h * 0.5, r: Math.min(U.w * 0.24, c.h * 0.22, 190) };
  const rings = [];
  for (const b of k.beats) { const d = b - k.t; if (d > -0.1 && d < 1.25) { const kk = 1 - clamp(d / 1.25, 0, 1); rings.push({ k: kk, a: 0.3 + 0.7 * kk }); } }
  drawPad(ctx, pad.cx, pad.cy, pad.r, { rings, flash: clamp(1 - (state.t - k.flashAt) / 0.2, 0, 1) });
  ui.hit('calib:tap', R(U.x, c.y + 80, U.w, c.h - 200));
  const msg = k.done ? (k.result === null ? 'Not enough taps. Try again.' : `Your taps are ${Math.abs(k.result)} ms ${k.result >= 0 ? 'late' : 'early'}. Apply ${k.result >= 0 ? '+' : '-'}${Math.abs(k.result)} ms?`) : `Tap on the drum as each ring closes (${Math.min(k.taps.length, k.need)} / ${k.need})`;
  { const lines = ui.lines(ctx, msg, U.w - 60, 28, { fixed: true, weight: 700 }); lines.forEach((ln, i) => ui.text(ctx, ln, U.x + U.w / 2, c.y + 40 + i * 36, 28, { align: 'center', weight: 700, fixed: true, color: COL.ink })); }
  const bw = Math.min(260, (U.w - 60) / 2);
  if (k.done) {
    if (k.result !== null) ui.button(ctx, 'calib:apply', R(U.x + U.w / 2 - bw - 6, c.y + c.h - 90, bw, 70), 'APPLY', { kind: 'primary', size: 30 });
    ui.button(ctx, 'calib:again', R(U.x + U.w / 2 + (k.result !== null ? 6 : -bw / 2), c.y + c.h - 90, bw, 70), 'AGAIN', { kind: 'secondary', size: 30 });
  } else ui.button(ctx, 'calib:start', R(U.x + U.w / 2 - bw / 2, c.y + c.h - 90, bw, 70), k.started ? 'RESTART' : 'START', { kind: 'primary', size: 30 });
}

// ---- result ----------------------------------------------------------------------------------------------------------------------------
function result(ctx, G) {
  const { L, ui, state } = G;
  const r = state.result;
  if (state.v3.on) veil(ctx, L, { top: 0.78, mid: 0.7, bottom: 0.9 });
  const U = L.U, wide = U.w >= 900 && L.land;
  const z0 = ui.zoom;
  zoomChips(ctx, G);
  ui.zoom = G.zoom;
  const colW = wide ? Math.min(U.w * 0.5, 640) : Math.min(U.w - 32, 640);
  const x0 = wide ? U.x + (U.w * 0.5 - colW) / 2 + 10 : U.x + (U.w - colW) / 2;
  const btnH = Math.max(76, ui.fs(30) * 1.8);
  const nb = r.buttons.length;
  const view = R(x0, U.y + 64, colW, U.h - 64 - btnH * (wide ? 0 : 1) - 24 - (wide ? 0 : (nb > 2 ? btnH + 10 : 0)));
  ui.beginScroll(ctx, view, 'result');
  let y = view.y + 4;
  const medal = r.medal;
  ui.text(ctx, placeName(r.place).toUpperCase(), view.x + view.w / 2, y + ui.fs(120) * 0.85, 120, { disp: true, weight: 800, align: 'center', color: r.place === 0 ? '#ffe27a' : '#fff', stroke: 10, strokeColor: 'rgba(120,20,16,0.9)', fit: view.w - 20 }); y += ui.fs(120) * 0.95;
  ui.text(ctx, r.headline.toUpperCase(), view.x + view.w / 2, y + ui.fs(32), 32, { disp: true, weight: 800, align: 'center', color: medal ? MEDAL_COL[medal] : COL.orange2, fit: view.w - 20 }); y += ui.fs(32) * 1.4;
  if (r.sub) y += ui.para(ctx, r.sub, view.x + 6, y, view.w - 24, 22, { color: COL.dim, weight: 600 }) + 8;
  // finishing order
  r.order.forEach((o, i) => {
    const rh = Math.max(52, ui.fs(26) * 1.5), rr = R(view.x, y, view.w - 14, rh);
    ui.panel(ctx, rr, { fill: o.mine ? 'rgba(160,36,24,0.55)' : COL.panel2, radius: 16, shadow: false, edgeAlpha: o.mine ? 0.9 : 0.25 });
    ui.text(ctx, `${i + 1}`, rr.x + 24, rr.y + rh / 2 + ui.fs(26) * 0.34, 26, { disp: true, weight: 800, color: i === 0 ? COL.gold : COL.ink });
    ctx.fillStyle = hsl(o.hue); ctx.beginPath(); ctx.arc(rr.x + 62, rr.y + rh / 2, 11, 0, 6.3); ctx.fill();
    ui.text(ctx, o.name.toUpperCase(), rr.x + 84, rr.y + rh / 2 + ui.fs(26) * 0.34, 26, { disp: true, weight: 800, fit: rr.w - 84 - 130 });
    ui.text(ctx, o.finished ? fmtTime(o.time) : `+${Math.round(o.time - r.order[0].time)}s`, rr.x + rr.w - 16, rr.y + rh / 2 + ui.fs(24) * 0.34, 24, { disp: true, weight: 700, align: 'right', color: COL.dim });
    y += rh + 8;
  });
  y += 8;
  // stats
  const S = r.stats, stats = [['ACCURACY', `${r.accuracy}%`], ['PERFECT', S.perfect], ['BEST STREAK', S.maxStreak], ['SURGES', S.surges], ['BUMPS', S.bumps], ['CLASHES', S.clashes]];
  if (r.lifts) stats.splice(3, 0, ['LIFTS', `${r.lifts.hit}/${r.lifts.total}`]);
  const cols = view.w > 520 ? 3 : 2, cw = (view.w - 14 - 10 * (cols - 1)) / cols, ch = Math.max(74, ui.fs(30) * 1.1 + ui.fs(18) * 1.3 + 22);
  stats.slice(0, cols * 2).forEach((s, i) => {
    const sx = view.x + (i % cols) * (cw + 10), sy = y + Math.floor(i / cols) * (ch + 10);
    ui.panel(ctx, R(sx, sy, cw, ch), { fill: COL.panel2, radius: 16, shadow: false });
    ui.text(ctx, String(s[1]), sx + cw / 2, sy + 12 + ui.fs(30), 30, { disp: true, weight: 800, align: 'center', fit: cw - 16 });
    ui.text(ctx, s[0], sx + cw / 2, sy + ch - 12, 18, { weight: 700, align: 'center', color: COL.dim, fit: cw - 12 });
  });
  y += Math.ceil(Math.min(stats.length, cols * 2) / cols) * (ch + 10) + 6;
  if (r.newBest) y += ui.para(ctx, r.newBest, view.x + 6, y, view.w - 24, 22, { color: COL.gold, weight: 700 }) + 6;
  drawMoreLine(ctx, view.x + view.w / 2, y + 26, 15); y += 44;
  ui.endScroll(ctx, y - view.y);
  // buttons
  ui.zoom = 1;
  const bx = wide ? U.x + U.w * 0.5 + 20 : x0, bw = wide ? U.x + U.w - bx - 24 : colW;
  const by0 = wide ? U.y + U.h / 2 - ((btnH + 12) * nb) / 2 : U.y + U.h - (btnH + 10) * Math.ceil(nb / 2) - 10 - L.ins.b * 0.3;
  r.buttons.forEach((b, i) => {
    const cols2 = wide ? 1 : 2, bw2 = wide ? bw : (bw - 10) / 2;
    const rx = wide ? bx : bx + (i % 2) * (bw2 + 10), ry = wide ? by0 + i * (btnH + 12) : by0 + Math.floor(i / 2) * (btnH + 10);
    const wid = !wide && nb % 2 === 1 && i === nb - 1 ? bw : bw2;
    ui.button(ctx, b.id, R(rx, ry, wid, btnH), b.label, { kind: b.kind ?? 'secondary', icon: b.icon, size: 30 });
  });
  ui.primary = r.buttons[0].id;
  ui.zoom = z0;
}

function demoLimit(ctx, G) {
  const { L, ui, state } = G;
  backdrop(ctx, L, state.t);
  const U = L.U, cx = U.x + U.w / 2;
  const w = Math.min(U.w - 40, 560), x = cx - w / 2;
  ui.zoom = G.zoom;
  const body = 'You have raced the free web races. Get Dragon Boat Race for iPhone and Android to race all three rivers, take the drum and play offline with no ads.';
  const h = ui.fs(48) * 1.4 + ui.paraHeight(ctx, body, w - 40, 24) + 150, y = U.y + Math.max(30, (U.h - h) / 2);
  ui.panel(ctx, R(x, y, w, h), { fill: COL.panel2, radius: 26 });
  ui.text(ctx, 'GET THE FULL GAME', cx, y + 24 + ui.fs(48) * 0.85, 48, { disp: true, weight: 800, align: 'center', fit: w - 40 });
  ui.para(ctx, body, x + 20, y + 36 + ui.fs(48), w - 40, 24, { color: COL.dim, weight: 500 });
  ui.button(ctx, 'demo:menu', R(x + 20, y + h - 84, w - 40, 64), 'BACK TO MENU', { kind: 'primary', size: 30 });
  drawCredit(ctx, cx, U.y + U.h - 24, 14);
}

export function confirmDialog(ctx, G) { leaveDialog(ctx, G.ui, G.L, G); }

// ---- dispatcher ------------------------------------------------------------------------------------------------------------------------
export function draw(ctx, G) {
  const { state, L, ui } = G;
  const sc = state.scene;
  ui.key = 'main';
  if (sc === 'play') {
    if (!state.gl) drawFallback(ctx, G); else ctx.clearRect(0, 0, L.w, L.h);
    drawRaceHud(ctx, G);
    return;
  }
  const solid = sc === 'rules' || sc === 'about' || sc === 'how' || sc === 'settings' || sc === 'calib' || sc === 'demo-limit' || !state.v3.on;
  if (solid || !state.gl) backdrop(ctx, L, state.t); else ctx.clearRect(0, 0, L.w, L.h);
  if (!state.gl && state.v3.on && !solid) drawFallbackMenu(ctx, G);
  ui.zoom = 1;
  switch (sc) {
    case 'title': title(ctx, G); break;
    case 'modes': modes(ctx, G); break;
    case 'regatta': regatta(ctx, G); break;
    case 'quick': quick(ctx, G); break;
    case 'drumsel': drumsel(ctx, G); break;
    case 'settings': settings(ctx, G); break;
    case 'calib': calib(ctx, G); break;
    case 'result': result(ctx, G); break;
    case 'about': drawAbout(ctx, G); break;
    case 'how': drawHow(ctx, G); break;
    case 'rules': drawRules(ctx, G); break;
    case 'demo-limit': demoLimit(ctx, G); break;
    default: break;
  }
  ui.zoom = 1;
}
function drawFallbackMenu(ctx, G) { /* the menus sit on the plain backdrop when WebGL is missing */ }
