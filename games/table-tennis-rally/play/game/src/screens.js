// Every non-match screen, plus the dispatcher. Immediate mode: each control is drawn and registered in one call (see ui.js).
import { COL, FONT_D, R, icon, inRect } from './ui.js';
import { backdrop, veil, sideVeil, header, avatar, initials, flagChip, levelPips, pips, toast, ballIcon } from './common.js';
import { drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { STYLES, ROUND_NAMES } from './profiles.js';
import { SCOUT } from './content.js';
import { drawMatch } from './hud.js';
import { drawAbout, drawHow, drawRules } from './pages.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// small A-/A+ chips for screens without a header (title, result): text zoom is available on every text screen
function zoomChips(ctx, G) {
  const { L, ui, state } = G, U = L.U, z0 = ui.zoom; ui.zoom = 1;
  const w = 58, h = 46, x = U.x + U.w - 2 * w - 18, y = U.y + 8;
  ui.button(ctx, 'zoom-', R(x, y, w, h), 'A\u2212', { kind: 'chip', size: 22, disabled: state.prefs.zoomIdx <= 0 });
  ui.button(ctx, 'zoom+', R(x + w + 8, y, w, h), 'A+', { kind: 'chip', size: 22, disabled: state.prefs.zoomIdx >= G.TEXT_SCALES.length - 1 });
  ui.zoom = z0;
}

// the game emblem: a paddle and a ball, used in the title lockup and the store art
export function emblem(ctx, cx, cy, s) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.rotate(-0.45);
  ctx.fillStyle = '#c8955a'; ctx.beginPath(); ctx.roundRect(-s * 0.07, s * 0.28, s * 0.14, s * 0.42, s * 0.05); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, 6.3); ctx.fill();
  const g = ctx.createLinearGradient(-s * 0.4, -s * 0.4, s * 0.4, s * 0.4); g.addColorStop(0, '#ff4a4a'); g.addColorStop(1, '#a50f1c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 0.37, 0, 6.3); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.arc(cx + s * 0.5, cy - s * 0.32, s * 0.15, 0, 6.3); ctx.fill();
  ctx.strokeStyle = '#ff7a1a'; ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.arc(cx + s * 0.5, cy - s * 0.32, s * 0.095, 0.4, 2.6); ctx.stroke(); ctx.restore();
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
    T.wm = { x: U.x + 24 + L.back.w * 0.0, y: U.y + 22, s, align: 'left', indent: L.back.w ? L.back.w * 0.0 : 0 };
    const wmH = (84 + 120) * s * 0.78 + 60 * s;
    T.menu = R(T.col.x, U.y + 26 + wmH, lw, U.h - (26 + wmH) - 74);
    T.credit = { x: T.col.x + lw / 2, y: U.y + U.h - 22 - L.ins.b * 0.3 };
    T.region = R(U.x + lw + 28, U.y + 24, U.w - lw - 44, U.h - 48);
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
export const titleRegion = (L) => titleLayout(L).region;

function wordmark(ctx, ui, wm) {
  const s = wm.s, ax = wm.x;
  ctx.save(); ctx.textBaseline = 'alphabetic';
  const draw = (str, y, size, fill, strokeW) => {
    ctx.font = `800 ${size}px ${FONT_D}`; ctx.textAlign = wm.align;
    ctx.lineJoin = 'round'; ctx.lineWidth = strokeW; ctx.strokeStyle = '#06101f'; ctx.strokeText(str, ax, y);
    ctx.fillStyle = fill; ctx.fillText(str, ax, y);
  };
  const l1 = 84 * s, l2 = 128 * s;
  const w1 = (() => { ctx.font = `800 ${l1}px ${FONT_D}`; return ctx.measureText('TABLE TENNIS').width; })();
  const x0 = wm.align === 'center' ? ax - w1 / 2 : ax;
  const g1 = ctx.createLinearGradient(0, wm.y, 0, wm.y + l1); g1.addColorStop(0, '#ffffff'); g1.addColorStop(1, '#b6d0ff');
  draw('TABLE TENNIS', wm.y + l1 * 0.82, l1, g1, 10 * s);
  const g2 = ctx.createLinearGradient(0, wm.y + l1, 0, wm.y + l1 + l2); g2.addColorStop(0, '#ffc15a'); g2.addColorStop(1, '#ff7a1c');
  draw('RALLY', wm.y + l1 * 0.82 + l2 * 0.86, l2, g2, 12 * s);
  ctx.font = `800 ${l2}px ${FONT_D}`; const wR = ctx.measureText('RALLY').width;
  emblem(ctx, (wm.align === 'center' ? ax + wR / 2 : ax + wR) + l2 * 0.62, wm.y + l1 * 0.82 + l2 * 0.45, l2 * 0.72);
  ctx.font = `700 ${22 * s}px ${FONT_D}`; ctx.textAlign = wm.align; ctx.fillStyle = 'rgba(210,228,255,0.78)';
  const tag = 'REAL 3D  ·  REAL SPIN  ·  ONE FINGER';
  ctx.fillText(tag, ax, wm.y + l1 * 0.82 + l2 * 0.86 + 34 * s);
  ctx.restore();
}

function title(ctx, G) {
  const { L, ui, state } = G;
  const T = titleLayout(L);
  if (state.v3.on) { if (T.side) sideVeil(ctx, L, 0, T.col.x + T.col.w + 90, 0.86); else veil(ctx, L, { top: 0.62, mid: 0.0, bottom: 0.8 }); }
  wordmark(ctx, ui, T.wm);
  zoomChips(ctx, G);
  const m = T.menu, z = G.zoom;
  const gap = 12, bh = Math.max(T.side ? 70 : 84, ui.fs(34) * 1.75, Math.min(T.side ? 96 : 128, (m.h - 70) / 4.4));
  ui.beginScroll(ctx, m);
  let y = m.y + 4;
  ui.button(ctx, 'play', R(m.x, y, m.w - 12, bh * 1.18), 'PLAY', { kind: 'primary', icon: 'play', size: 44 * Math.min(1, 1 + 0 * z), sub: state.progress.stats.matches ? `${state.progress.stats.wins} wins in ${state.progress.stats.matches} matches` : 'Quick match, tournaments and more' });
  ui.primary = 'play';
  y += bh * 1.18 + gap;
  const cw = (m.w - 12 - gap) / 2;
  const items = [['tournament', 'TOURNAMENT', 'trophy'], ['practice', 'RALLY CHALLENGE', 'target'], ['watch', 'WATCH & LEARN', 'eye'], ['how', 'HOW TO PLAY', 'paddle']];
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
    ['m:quick', 'QUICK MATCH', 'Pick any of 18 opponents and play best of 1, 3 or 5.', 'ball'],
    ['m:tour', 'TOURNAMENT', 'Six cups from a club hall to the world stage.', 'trophy'],
    ['m:practice', 'RALLY CHALLENGE', 'Return the ball machine as long as you can. Best run: ' + state.progress.stats.bestStreak + '.', 'target'],
    ['m:lesson', 'LEARN THE BASICS', 'A short guided lesson: slide, flick, aim, read spin.', 'paddle'],
    ['m:watch', 'WATCH & LEARN', 'The coach plays and explains every shot.', 'eye'],
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
    const r = R(x, y, pw, wide && i === cards.length - 1 && cols === 2 ? h : h);
    ui.panel(ctx, r, { fill: ui.pressedId === cd[0] ? 'rgba(30,60,110,0.9)' : COL.panel2, radius: 22 });
    ctx.save(); ctx.fillStyle = i === 0 ? COL.orange : 'rgba(80,130,220,0.35)'; ctx.beginPath(); ctx.arc(r.x + 62, r.y + r.h / 2, 38, 0, 6.3); ctx.fill(); ctx.restore();
    icon(ctx, cd[3], r.x + 62, r.y + r.h / 2, 44, i === 0 ? '#1a1206' : '#fff');
    ui.text(ctx, cd[1], r.x + 124, r.y + 20 + ui.fs(32), 32, { disp: true, weight: 800, fit: pw - 140 });
    ui.para(ctx, cd[2], r.x + 124, r.y + 26 + ui.fs(32), pw - 150, 22, { color: COL.dim, weight: 500 });
    ui.hit(cd[0], r);
  });
  y += rowH;
  ui.endScroll(ctx, y - view.y + 8);
  ui.primary = 'm:quick';
}

// ---- quick match -------------------------------------------------------------------------------------------------------------
const cardH = (ui) => Math.max(96, ui.fs(26) * 1.2 + ui.fs(20) * 1.3 + 56);
function oppCard(ctx, ui, r, o, sel, id) {
  ui.panel(ctx, r, { fill: sel ? 'rgba(33,90,190,0.82)' : COL.panel2, radius: 20, edgeAlpha: sel ? 0.9 : 0.35 });
  const ar = Math.min(34, r.h * 0.26);
  avatar(ctx, r.x + 16 + ar, r.y + 16 + ar, ar, initials(o.name), o.hue);
  const tx = r.x + 28 + ar * 2, tw = r.w - (tx - r.x) - 80;
  ui.text(ctx, o.name, tx, r.y + 14 + ui.fs(26), 26, { disp: true, weight: 800, fit: tw });
  flagChip(ctx, r.x + r.w - 64, r.y + 12, 52, 28, o.cc, o.hue);
  ui.text(ctx, STYLES[o.style].label, tx, r.y + 18 + ui.fs(26) + ui.fs(20), 20, { color: COL.dim, weight: 600, fit: r.w - (tx - r.x) - 14 });
  levelPips(ctx, r.x + 18, r.y + r.h - 22, r.w - 36, o.level);
  if (id) ui.hit(id, r);
}
function detailPanel(ctx, ui, r, sel) {
  const ar = 38;
  ui.panel(ctx, r, { fill: COL.panel2, radius: 22 });
  avatar(ctx, r.x + 20 + ar, r.y + 20 + ar, ar, initials(sel.name), sel.hue);
  const tx = r.x + 40 + ar * 2, tw = r.w - (tx - r.x) - 16;
  ui.text(ctx, sel.name, tx, r.y + 16 + ui.fs(30), 30, { disp: true, weight: 800, fit: tw });
  ui.text(ctx, `${STYLES[sel.style].label} \u00b7 Level ${sel.level}`, tx, r.y + 20 + ui.fs(30) + ui.fs(21), 21, { color: COL.orange2, weight: 700, fit: tw });
  let y = r.y + 40 + Math.max(ar * 2, ui.fs(30) + ui.fs(21) + 12);
  y += ui.para(ctx, sel.line, r.x + 18, y, r.w - 36, 21, { color: COL.dim, weight: 500 }) + 6;
  if (sel.weak) y += ui.para(ctx, `Scouting: ${SCOUT[sel.weak]}.`, r.x + 18, y, r.w - 36, 21, { color: COL.cyan, weight: 600 });
  return y + 16 - r.y;
}
function detailHeight(ctx, ui, w, sel) {
  const ar = 38, top = 40 + Math.max(ar * 2, ui.fs(30) + ui.fs(21) + 12);
  return top + ui.paraHeight(ctx, sel.line, w - 36, 21) + 6 + (sel.weak ? ui.paraHeight(ctx, `Scouting: ${SCOUT[sel.weak]}.`, w - 36, 21) : 0) + 16;
}
function quick(ctx, G) {
  const { L, ui, state, OPPONENTS } = G;
  if (state.v3.on) veil(ctx, L, { top: 0.85, mid: 0.85, bottom: 0.9 });
  const c = header(ctx, G, 'QUICK MATCH');
  ui.zoom = G.zoom;
  const wide = c.w >= 880, q = state.quick, sel = OPPONENTS.find((o) => o.id === q.opp) ?? OPPONENTS[1];
  const startH = Math.max(84, ui.fs(34) * 1.8), segH = Math.max(62, ui.fs(22) * 1.8);
  const labelH = ui.fs(20) + 14;
  const optsW = wide ? clamp(c.w * 0.36, 320, 520) : c.w - 32;
  const startR = R(c.x + 16, c.y + c.h - startH - 12, optsW, startH);
  const seg = (x, y, w) => ui.segment(ctx, 'bo', R(x, y, w, segH), [{ id: 1, label: 'BEST OF 1' }, { id: 3, label: 'BEST OF 3' }, { id: 5, label: 'BEST OF 5' }], q.bestOf);
  const oc = (list, cols) => {
    const ow = (list.w - 14 - 12 * (cols - 1)) / cols, oh = cardH(ui);
    OPPONENTS.forEach((o, i) => oppCard(ctx, ui, R(list.x + (i % cols) * (ow + 12), list.y + Math.floor(i / cols) * (oh + 12), ow, oh), o, o.id === q.opp, `opp:${o.id}`));
    return Math.ceil(OPPONENTS.length / cols) * (cardH(ui) + 12);
  };
  if (!wide) {
    ui.text(ctx, 'MATCH LENGTH', c.x + 20, c.y + ui.fs(20), 20, { color: COL.dim, weight: 700 });
    seg(c.x + 16, c.y + labelH, c.w - 32);
    const view = R(c.x + 16, c.y + labelH + segH + 12, c.w - 32, startR.y - (c.y + labelH + segH + 12) - 10);
    ui.beginScroll(ctx, view, 'quick');
    const dh = detailHeight(ctx, ui, view.w - 14, sel);
    detailPanel(ctx, ui, R(view.x, view.y, view.w - 14, dh), sel);
    const cols = G.zoom >= 1.5 ? 1 : 2;
    const lh = oc(R(view.x, view.y + dh + 14, view.w - 14, 0), cols);
    ui.endScroll(ctx, dh + 14 + lh);
  } else {
    const left = R(c.x + 16, c.y, optsW, startR.y - c.y - 10);
    ui.beginScroll(ctx, left, 'quickL');
    ui.text(ctx, 'MATCH LENGTH', left.x + 4, left.y + ui.fs(20), 20, { color: COL.dim, weight: 700 });
    seg(left.x, left.y + labelH, left.w - 14);
    const dh = detailHeight(ctx, ui, left.w - 14, sel);
    detailPanel(ctx, ui, R(left.x, left.y + labelH + segH + 12, left.w - 14, dh), sel);
    ui.endScroll(ctx, labelH + segH + 12 + dh + 8);
    const list = R(left.x + optsW + 18, c.y, c.w - optsW - 50, c.h - 12);
    ui.beginScroll(ctx, list, 'quickR');
    const cols = Math.max(1, Math.min(3, Math.floor(list.w / (250 * Math.min(G.zoom, 2.2)))));
    ui.endScroll(ctx, oc(R(list.x, list.y + 4, list.w - 14, 0), cols) + 8);
  }
  ui.button(ctx, 'start', startR, 'START MATCH', { kind: 'primary', icon: 'play', size: 40 });
  ui.primary = 'start';
}

// ---- tournament --------------------------------------------------------------------------------------------------------------
function tour(ctx, G) {
  const { L, ui, state, CUPS, OPPONENTS } = G;
  if (state.v3.on) veil(ctx, L, { top: 0.85, mid: 0.85, bottom: 0.9 });
  const c = header(ctx, G, 'TOURNAMENT');
  ui.zoom = G.zoom;
  const cols = Math.max(1, Math.min(3, Math.floor((c.w - 32) / (330 * Math.min(G.zoom, 2.2) ** 0.8))));
  const gap = 14, cw = (c.w - 32 - 14 - gap * (cols - 1)) / cols;
  const view = R(c.x + 16, c.y, c.w - 32, c.h - 12);
  ui.beginScroll(ctx, view, 'tour');
  const stacked = G.zoom >= 1.5;
  const h = Math.max(150, 20 + ui.fs(30) * 1.1 + ui.fs(20) * 1.4 + 70 + (stacked ? ui.fs(22) + 14 : 0) + 24);
  let y = view.y + 4;
  CUPS.forEach((cup, i) => {
    const locked = !G.cupUnlocked(i), pr = state.progress.cups[cup.id];
    const col = i % cols, x = view.x + col * (cw + gap);
    if (col === 0 && i > 0) y += h + gap;
    const r = R(x, y, cw, h);
    ui.panel(ctx, r, { fill: locked ? 'rgba(10,18,36,0.8)' : COL.panel2, radius: 22, edgeAlpha: locked ? 0.2 : 0.6 });
    ctx.save(); ctx.fillStyle = `hsl(${cup.hue},65%,${locked ? 22 : 46}%)`; ctx.beginPath(); ctx.roundRect(r.x + 14, r.y + 14, 72, 72, 20); ctx.fill(); ctx.restore();
    icon(ctx, locked ? 'lock' : 'trophy', r.x + 50, r.y + 50, 42, locked ? 'rgba(255,255,255,0.5)' : '#fff');
    const tx = r.x + 102, tw = r.w - 116;
    ui.text(ctx, cup.name.toUpperCase(), tx, r.y + 12 + ui.fs(30), 30, { disp: true, weight: 800, color: locked ? COL.faint : COL.ink, fit: tw });
    ui.text(ctx, `${cup.place} \u00b7 ${cup.bestOf.join('/')} games`, tx, r.y + 18 + ui.fs(30) + ui.fs(20), 20, { color: COL.dim, weight: 500, fit: tw });
    const names = cup.rounds.map((id) => OPPONENTS.find((o) => o.id === id));
    const ay = r.y + 14 + Math.max(72, ui.fs(30) + ui.fs(20) + 28) + 28;
    names.forEach((o, k) => { avatar(ctx, r.x + 38 + k * 56, ay, 22, initials(o.name), locked ? 220 : o.hue, { ring: k < pr.stage ? COL.gold : 'rgba(255,255,255,0.4)' }); if (k < pr.stage) icon(ctx, 'check', r.x + 38 + k * 56 + 16, ay - 18, 20, COL.gold); });
    const st = pr.done ? `Trophy won \u00d7${pr.trophies}` : locked ? 'Locked' : pr.stage ? `Round ${pr.stage + 1} of 3` : 'Not started';
    const sx = stacked ? r.x + 18 : r.x + 38 + 3 * 56, sy = stacked ? ay + 22 + ui.fs(22) + 6 : ay + ui.fs(22) * 0.35;
    ui.text(ctx, st, sx, sy, 22, { color: pr.done ? COL.gold : locked ? COL.faint : COL.cyan, weight: 700, fit: r.x + r.w - sx - 14 });
    ui.hit(`cup:${cup.id}`, r);
  });
  y += h;
  ui.endScroll(ctx, y - view.y + 10);
  if (state.msg) toast(ctx, G, state.msg.text);
}

// The bracket: 8 entrants. The other results are a seeded draw so the bracket looks alive.
function bracketNames(cup, G) {
  const o = (id) => G.OPPONENTS.find((x) => x.id === id).name;
  let seed = [...cup.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const nx = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pool = [...G.FILLER];
  const pick = () => pool.splice(Math.floor(nx() * pool.length), 1)[0];
  const r0 = o(cup.rounds[0]), r1 = o(cup.rounds[1]), r2 = o(cup.rounds[2]);
  const A = ['YOU', r0, pick(), r1, pick(), r2, pick(), pick()];
  const fw = nx() < 0.5 ? A[4] : A[6];
  return { A, B: ['YOU', r1, fw, r2], C: ['YOU', r2] };
}
function cupScreen(ctx, G) {
  const { L, ui, state, CUPS, OPPONENTS } = G;
  if (state.v3.on) veil(ctx, L, { top: 0.85, mid: 0.85, bottom: 0.9 });
  const cup = CUPS.find((c) => c.id === state.cupSel), pr = state.progress.cups[cup.id];
  const c = header(ctx, G, cup.name.toUpperCase());
  const wide = c.w >= 900;
  const stage = pr.done ? 3 : pr.stage;
  const opp = OPPONENTS.find((o) => o.id === cup.rounds[Math.min(stage, 2)]);
  const infoH = Math.max(300, ui.fs(30) * 2 + ui.fs(22) * 8 + 140);
  const bw = wide ? c.w - clamp(c.w * 0.36, 360, 520) - 48 : c.w - 32;
  const bh = wide ? c.h - 12 : Math.max(280, Math.min(c.h - 360, bw * 0.9));
  const br = R(c.x + 16, c.y, bw, bh);
  ui.panel(ctx, br, { fill: COL.panel2, radius: 22 });
  const N = bracketNames(cup, G);
  const colW = br.w / 3, rowH = (br.h - 84) / 8, top = br.y + 70;
  const xs = [br.x + colW * 0.5, br.x + colW * 1.5, br.x + colW * 2.5];
  ['QUARTER-FINALS', 'SEMI-FINALS', 'FINAL'].forEach((t, i) => ui.text(ctx, t, xs[i], br.y + 38, 17, { align: 'center', color: COL.dim, weight: 700, fixed: true }));
  const ysA = Array.from({ length: 8 }, (_, i) => top + rowH * (i + 0.5));
  const ysB = [0, 1, 2, 3].map((i) => (ysA[i * 2] + ysA[i * 2 + 1]) / 2);
  const ysC = [0, 1].map((i) => (ysB[i * 2] + ysB[i * 2 + 1]) / 2);
  const sw = colW - 26, sh = Math.min(rowH * 0.82, 52);
  ctx.save(); ctx.strokeStyle = 'rgba(160,190,240,0.4)'; ctx.lineWidth = 2;
  const link = (xa, ya, yb, xb, ym) => { ctx.beginPath(); ctx.moveTo(xa + sw / 2, ya); ctx.lineTo(xa + sw / 2 + 11, ya); ctx.lineTo(xa + sw / 2 + 11, yb); ctx.lineTo(xa + sw / 2, yb); ctx.moveTo(xa + sw / 2 + 11, ym); ctx.lineTo(xb - sw / 2, ym); ctx.stroke(); };
  for (let i = 0; i < 4; i++) link(xs[0], ysA[i * 2], ysA[i * 2 + 1], xs[1], ysB[i]);
  for (let i = 0; i < 2; i++) link(xs[1], ysB[i * 2], ysB[i * 2 + 1], xs[2], ysC[i]);
  ctx.restore();
  const slot = (cx, cy, label, hot, mine) => {
    ctx.save(); ctx.fillStyle = hot ? 'rgba(255,138,42,0.95)' : mine ? 'rgba(47,212,230,0.25)' : 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.roundRect(cx - sw / 2, cy - sh / 2, sw, sh, 10); ctx.fill();
    ctx.strokeStyle = hot ? '#ffb347' : mine ? COL.cyan : 'rgba(160,190,240,0.25)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    const fz = Math.min(20, sh * 0.46), t = label ?? '\u2014';
    ui.text(ctx, t.length > 15 ? t.slice(0, 14) + '\u2026' : t, cx, cy + fz * 0.34, fz, { align: 'center', fixed: true, color: hot ? '#1a1206' : COL.ink, weight: 700 });
  };
  N.A.forEach((n, i) => slot(xs[0], ysA[i], n, stage === 0 && i < 2, i === 0));
  N.B.forEach((n, i) => slot(xs[1], ysB[i], i === 0 && stage < 1 ? null : n, stage === 1 && i < 2, i === 0 && stage >= 1));
  N.C.forEach((n, i) => slot(xs[2], ysC[i], i === 0 && stage < 2 ? null : (i === 1 && stage < 2 ? null : n), stage === 2, i === 0 && stage >= 2));
  // right-hand card: the next match (text scrolls at big zoom, the button stays put)
  const cr = wide ? R(br.x + br.w + 16, c.y, c.w - br.w - 48, c.h - 12) : R(c.x + 16, br.y + br.h + 14, c.w - 32, c.h - br.h - 26);
  ui.panel(ctx, cr, { fill: COL.panel2, radius: 22 });
  const pbh = Math.max(84, ui.fs(34) * 1.8);
  const info = R(cr.x + 8, cr.y + 8, cr.w - 16, cr.h - pbh - 34);
  ui.beginScroll(ctx, info, 'cupInfo');
  let yy = info.y + 4;
  const nextLbl = pr.done ? 'CUP COMPLETE' : ROUND_NAMES[stage].toUpperCase();
  ui.text(ctx, nextLbl, info.x + 14, yy + ui.fs(30), 30, { disp: true, weight: 800, color: COL.orange2, fit: info.w - 40 });
  yy += ui.fs(30) * 1.3 + 8;
  if (!pr.done) {
    const ar = 38;
    avatar(ctx, info.x + 14 + ar, yy + ar, ar, initials(opp.name), opp.hue);
    ui.text(ctx, opp.name, info.x + 30 + ar * 2, yy + 8 + ui.fs(28), 28, { disp: true, weight: 800, fit: info.w - 60 - ar * 2 });
    ui.text(ctx, `${STYLES[opp.style].label} \u00b7 Level ${opp.level}`, info.x + 30 + ar * 2, yy + 14 + ui.fs(28) + ui.fs(21), 21, { color: COL.dim, weight: 600, fit: info.w - 60 - ar * 2 });
    yy += Math.max(ar * 2, ui.fs(28) + ui.fs(21) + 20) + 12;
    yy += ui.para(ctx, `Best of ${cup.bestOf[stage]} games, first to ${state.prefs.short ? 7 : 11}.`, info.x + 14, yy, info.w - 40, 22, { color: COL.ink, weight: 600 }) + 6;
    yy += ui.para(ctx, opp.line, info.x + 14, yy, info.w - 40, 21, { color: COL.dim, weight: 500 }) + 6;
    if (opp.weak) yy += ui.para(ctx, `Scouting: ${SCOUT[opp.weak]}.`, info.x + 14, yy, info.w - 40, 21, { color: COL.cyan, weight: 600 });
  } else yy += ui.para(ctx, `You have won the ${cup.name}. Play it again any time.`, info.x + 14, yy, info.w - 40, 24, { color: COL.dim });
  ui.endScroll(ctx, yy - info.y + 12);
  ui.button(ctx, 'cup:play', R(cr.x + 18, cr.y + cr.h - pbh - 16, cr.w - 36, pbh), pr.done ? 'PLAY AGAIN' : stage ? 'PLAY ROUND' : 'START CUP', { kind: 'primary', icon: 'play', size: 38 });
  ui.primary = 'cup:play';
}

// ---- result ----------------------------------------------------------------------------------------------------------------------
function result(ctx, G) {
  const { L, ui, state } = G;
  const r = state.result, m = state.match;
  backdrop(ctx, L, state.t);
  const U = L.U, wide = L.mode === 'wide' || U.w >= 940;
  const practice = r.kind === 'practice', auto = r.kind === 'auto';
  const head = practice ? (r.newBest ? 'NEW BEST!' : 'RALLY OVER') : auto ? 'LESSON OVER' : r.win ? (r.cupDone ? 'CUP WON!' : 'VICTORY!') : 'DEFEAT';
  const col = practice ? (r.newBest ? COL.gold : COL.cyan) : r.win ? COL.gold : '#9fb2d6';
  const foot = 34 + L.ins.b * 0.3;
  const leftV = wide ? R(U.x + 16, U.y + 12, U.w * 0.5 - 24, U.h - 24 - foot) : R(U.x + 12, U.y + 8, U.w - 24, U.h - 16 - foot);
  const pad = 6, W = leftV.w - 16;
  // ---- headline, score, stats
  ui.beginScroll(ctx, leftV, 'resL');
  let y = leftV.y + pad;
  const cx = leftV.x + W / 2;
  const hs = clamp(Math.min(W / 5.6, 130), 64, 140);
  ctx.save(); ctx.textAlign = 'center'; ctx.font = `800 ${hs}px ${FONT_D}`; ctx.lineJoin = 'round'; ctx.lineWidth = hs * 0.1; ctx.strokeStyle = '#06101f';
  let hsz = hs; while (ctx.measureText(head).width > W - 10 && hsz > 30) { hsz -= 2; ctx.font = `800 ${hsz}px ${FONT_D}`; }
  const hy = y + hsz * 0.85;
  ctx.strokeText(head, cx, hy); const gg = ctx.createLinearGradient(0, hy - hsz, 0, hy); gg.addColorStop(0, '#fff'); gg.addColorStop(1, col); ctx.fillStyle = gg; ctx.fillText(head, cx, hy); ctx.restore();
  y = hy + 16;
  if (practice) {
    ui.text(ctx, `${r.streak}`, cx, y + hs * 0.85, hs, { disp: true, weight: 800, align: 'center', fixed: true, fit: W });
    y += hs * 0.95;
    ui.text(ctx, 'returns in a row', cx, y + ui.fs(28), 28, { align: 'center', color: COL.dim, fit: W });
    y += ui.fs(28) * 1.4;
  } else if (!auto) {
    ui.text(ctx, `${r.games.p} \u2013 ${r.games.o}`, cx, y + hs * 0.8, hs * 0.85, { disp: true, weight: 800, align: 'center', fixed: true, fit: W });
    y += hs * 0.85 + 8;
    if (r.opp) { ui.text(ctx, `vs ${r.opp.name}`, cx, y + ui.fs(28), 28, { align: 'center', color: COL.dim, fit: W }); y += ui.fs(28) * 1.4; }
    const hist = state.w ? state.w.history : [];
    if (hist.length) { ui.text(ctx, hist.map((g) => `${g.p}-${g.o}`).join('   '), cx, y + ui.fs(24), 24, { align: 'center', color: COL.faint, weight: 600, fit: W }); y += ui.fs(24) * 1.5; }
  }
  y += 10;
  const s = r.stats;
  const cells = practice ? [['Best streak', r.streak], ['Fastest ball', `${Math.round(s.fastest * 3.6)} km/h`], ['Longest rally', s.longest]] : [['Points won', `${s.won}/${s.points}`], ['Winners', s.winners], ['Longest rally', s.longest], ['Fastest ball', `${Math.round(s.fastest * 3.6)} km/h`], ['Perfect strokes', r.perfects], ['Aces', s.aces]];
  if (!auto) {
    const ccol = G.zoom >= 1.6 ? 1 : G.zoom >= 1.2 ? 2 : 3, cw = (W - 12 * (ccol - 1)) / ccol, chh = Math.max(76, ui.fs(30) * 1.3 + ui.fs(18) * 1.4 + 20);
    cells.forEach((cl, i) => {
      const rr = R(leftV.x + (i % ccol) * (cw + 12), y + Math.floor(i / ccol) * (chh + 10), cw, chh);
      ui.panel(ctx, rr, { fill: COL.panel2, radius: 16, shadow: false, edge: false });
      ui.text(ctx, String(cl[1]), rr.x + rr.w / 2, rr.y + 10 + ui.fs(30), 30, { disp: true, weight: 800, align: 'center', fit: rr.w - 16 });
      ui.text(ctx, cl[0], rr.x + rr.w / 2, rr.y + 14 + ui.fs(30) + ui.fs(18), 18, { align: 'center', color: COL.dim, weight: 600, fit: rr.w - 16 });
    });
    y += Math.ceil(cells.length / ccol) * (chh + 10);
  }
  // ---- buttons: below in portrait (same scroll), own column in landscape
  const bh = Math.max(80, ui.fs(32) * 1.8);
  const buttons = (x, by, bw) => {
    if (m.kind === 'cup') {
      const note = r.win ? (r.cupDone ? `You won the ${G.CUPS.find((c) => c.id === r.cupId).name}!${r.unlocked ? ' Unlocked: ' + r.unlocked : ''}` : `${['Quarter-final', 'Semi-final', 'Final'][r.round]} won. On to the next round.`) : 'Knocked out. The cup starts again from the quarter-final.';
      const nh = ui.paraHeight(ctx, note, bw - 36, 24) + 28;
      ui.panel(ctx, R(x, by, bw, nh), { fill: COL.panel2, radius: 18 });
      ui.para(ctx, note, x + 18, by + 14, bw - 36, 24, { color: r.win ? COL.gold : COL.dim, weight: 600 });
      by += nh + 14;
    }
    const label = m.kind === 'cup' ? (r.win && !r.cupDone ? 'NEXT ROUND' : r.win ? 'PLAY AGAIN' : 'TRY AGAIN') : auto ? 'WATCH AGAIN' : practice ? 'AGAIN' : 'REMATCH';
    ui.button(ctx, 'again', R(x, by, bw, bh), label, { kind: 'primary', icon: 'play', size: 38 }); ui.primary = 'again'; by += bh + 12;
    if (m.kind === 'cup') { ui.button(ctx, 'cupmenu', R(x, by, bw, bh * 0.82), 'CUP BRACKET', { kind: 'secondary', icon: 'trophy', size: 28 }); by += bh * 0.82 + 12; }
    ui.button(ctx, 'menu', R(x, by, bw, bh * 0.82), 'MAIN MENU', { kind: 'secondary', size: 28 }); by += bh * 0.82 + 12;
    if (!auto) { ui.button(ctx, 'share', R(x, by, bw, bh * 0.7), 'SHARE', { kind: 'chip', size: 24 }); by += bh * 0.7 + 12; }
    return by;
  };
  if (!wide) { y += 14; y = buttons(leftV.x, y, W); }
  ui.endScroll(ctx, y - leftV.y + 8, 'resL');
  if (wide) {
    const rv = R(U.x + U.w * 0.5 + 6, U.y + 12, U.w * 0.5 - 22, U.h - 24 - foot);
    ui.beginScroll(ctx, rv, 'resR');
    const end = buttons(rv.x, rv.y + 14, rv.w - 14);
    ui.endScroll(ctx, end - rv.y + 8, 'resR');
  }
  zoomChips(ctx, G);
  drawMoreLine(ctx, U.x + U.w / 2, U.y + U.h - 12 - L.ins.b * 0.3, 15);
}

// ---- settings -----------------------------------------------------------------------------------------------------------------------
function settings(ctx, G) {
  const { L, ui, state } = G;
  backdrop(ctx, L, state.t);
  const c = header(ctx, G, 'SETTINGS', { zoom: true });
  ui.zoom = G.zoom;
  const pr = state.prefs;
  const wide = c.w >= 1000, cols = wide ? 2 : 1, gap = 18, cw = (c.w - 32 - 14 - gap * (cols - 1)) / cols;
  const view = R(c.x + 16, c.y, c.w - 32, c.h - 8);
  ui.beginScroll(ctx, view, 'settings');
  const colY = Array(cols).fill(view.y + 4);
  const bhS = Math.max(64, ui.fs(24) * 1.9);
  const group = (ci, title, rows) => {
    const x = view.x + ci * (cw + gap); let y = colY[ci];
    ui.text(ctx, title, x + 6, y + ui.fs(21), 21, { color: COL.orange2, weight: 800, disp: true, fit: cw - 12 });
    y += ui.fs(21) + 12;
    const iw = cw - 36;
    const hs = rows.map((r) => r.h(iw));
    const h = hs.reduce((a, v) => a + v, 0) + 12;
    ui.panel(ctx, R(x, y, cw, h), { fill: COL.panel2, radius: 20 });
    let yy = y + 6;
    rows.forEach((r, i) => { r.draw(R(x + 18, yy, iw, hs[i])); yy += hs[i]; });
    colY[ci] = y + h + 18;
  };
  const tg = (id, label, on, sub) => ({ h: (w) => ui.toggleHeight(ctx, w, label, sub), draw: (r) => ui.toggle(ctx, id, r, label, on, sub) });
  const btn = (id, label, kind) => ({ h: () => bhS + 14, draw: (r) => ui.button(ctx, id, R(r.x, r.y + 7, r.w, bhS), label, { kind, size: 26 }) });
  group(0, 'SOUND AND FEEL', [tg('s:sound', 'Sound', pr.sound, 'Hits, bounces and the crowd'), tg('s:haptics', 'Vibration', pr.haptics, 'A tap on every hit (where supported)'), tg('s:trail', 'Ball trail', pr.trail, 'Shows the path and the spin colour')]);
  group(wide ? 1 : 0, 'HELPERS', [
    tg('s:guide', 'Timing guide', pr.guide, 'The ring that shows when to flick'), tg('s:spin', 'Spin tag', pr.spin, 'Names the spin on the incoming ball'),
    { h: () => ui.fs(26) * 1.4 + 12 + Math.max(58, ui.fs(20) * 1.9) + 16, draw: (r) => { ui.text(ctx, 'Assist level', r.x, r.y + 8 + ui.fs(26), 26, { weight: 700, fit: r.w }); ui.segment(ctx, 's:assist', R(r.x, r.y + ui.fs(26) * 1.4 + 12, r.w, Math.max(58, ui.fs(20) * 1.9)), [{ id: 'easy', label: 'EASY' }, { id: 'normal', label: 'NORMAL' }, { id: 'pro', label: 'PRO' }], pr.assist); } },
  ]);
  group(0, 'MATCH', [tg('s:short', 'Short games', pr.short, 'Play to 7 instead of 11 (win by 2)'),
    { h: (w) => ui.fs(24) * 1.3 + ui.paraHeight(ctx, `${G.THINK_STEPS[pr.thinkIdx]} seconds. Change it in a Watch & Learn lesson.`, w, 20) + 26, draw: (r) => { ui.text(ctx, 'Watch & Learn thinking time', r.x, r.y + 10 + ui.fs(24), 24, { weight: 700, fit: r.w }); ui.para(ctx, `${G.THINK_STEPS[pr.thinkIdx]} seconds. Change it in a Watch & Learn lesson.`, r.x, r.y + 14 + ui.fs(24) * 1.3, r.w, 20, { color: COL.dim, weight: 500 }); } }]);
  group(wide ? 1 : 0, 'GAME', [btn('s:restore', 'RESTORE PURCHASES', 'chip'), btn('s:reset', 'RESET PROGRESS', 'danger'), ...(state.dev ? [btn('s:unlock', 'DEV: UNLOCK ALL CUPS', 'chip')] : [])]);
  ui.endScroll(ctx, Math.max(...colY) - view.y, 'settings');
  if (state.confirm === 'reset') confirmDialog(ctx, G, 'Reset all progress?', 'Your cups, trophies and best scores will be erased. This cannot be undone.', 's:reset:yes', 's:reset:no', 'RESET');
}

export function confirmDialog(ctx, G, title, body, yes, no, yesLabel) {
  const { L, ui } = G;
  ctx.fillStyle = 'rgba(2,6,14,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
  const w = Math.min(L.U.w - 40, 620), bh = Math.max(76, ui.fs(30) * 1.9);
  const bodyH = ui.paraHeight(ctx, body, w - 48, 24);
  const h = 40 + ui.fs(36) + bodyH + 30 + bh + 28;
  const x = L.U.x + (L.U.w - w) / 2, y = Math.max(L.U.y + 10, L.U.y + (L.U.h - h) / 2);
  ui.panel(ctx, R(x, y, w, h), { fill: '#0d1a36', radius: 26 });
  ui.text(ctx, title, x + w / 2, y + 30 + ui.fs(36) * 0.8, 36, { disp: true, weight: 800, align: 'center' });
  ui.para(ctx, body, x + 24, y + 44 + ui.fs(36), w - 48, 24, { color: COL.dim, weight: 500 });
  const by = y + h - bh - 22, bw = (w - 48 - 14) / 2;
  ui.button(ctx, no, R(x + 24, by, bw, bh), 'CANCEL', { kind: 'secondary', size: 28 });
  ui.button(ctx, yes, R(x + 24 + bw + 14, by, bw, bh), yesLabel, { kind: 'danger', size: 28 });
}

function demoLimit(ctx, G) {
  const { L, ui, state } = G;
  backdrop(ctx, L, state.t);
  const w = Math.min(L.U.w - 40, 680), x = L.U.x + (L.U.w - w) / 2, y = L.U.y + L.U.h * 0.18;
  ui.panel(ctx, R(x, y, w, 420), { fill: COL.panel2, radius: 26 });
  ui.text(ctx, 'GET THE FULL GAME', x + w / 2, y + 90, 52, { disp: true, weight: 800, align: 'center' });
  ui.para(ctx, 'You have played the free web matches. Table Tennis Rally has 18 opponents, six tournament cups, the Rally Challenge and Watch & Learn. Get it on iPhone and Android to keep playing.', x + 30, y + 120, w - 60, 26, { color: COL.dim });
  ui.button(ctx, 'demo:menu', R(x + 30, y + 330, w - 60, 70), 'BACK TO MENU', { kind: 'secondary', size: 30 });
}

// ---- dispatcher -------------------------------------------------------------------------------------------------------------------
export function draw(ctx, G) {
  const { state, L, ui } = G;
  const sc = state.scene;
  if (state.v3 && state.v3.on) ctx.clearRect(0, 0, L.w, L.h); else if (sc !== 'result' && sc !== 'settings' && sc !== 'demo-limit' && sc !== 'about' && sc !== 'how' && sc !== 'rules') backdrop(ctx, L, state.t);
  ui.zoom = sc === 'play' ? Math.min(G.zoom, 1.3) : G.zoom;
  if (sc === 'title') title(ctx, G);
  else if (sc === 'modes') modes(ctx, G);
  else if (sc === 'quick') quick(ctx, G);
  else if (sc === 'tour') tour(ctx, G);
  else if (sc === 'cup') cupScreen(ctx, G);
  else if (sc === 'play') drawMatch(ctx, G);
  else if (sc === 'result') result(ctx, G);
  else if (sc === 'settings') settings(ctx, G);
  else if (sc === 'about') drawAbout(ctx, G);
  else if (sc === 'how') drawHow(ctx, G);
  else if (sc === 'rules') drawRules(ctx, G);
  else if (sc === 'demo-limit') demoLimit(ctx, G);
  ui.zoom = 1;
}
