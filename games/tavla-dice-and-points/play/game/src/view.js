// Everything drawn per frame. Reads `state` (see game.js) and changes nothing. The heavy art (table, board, checkers,
// dice faces) lives in cached sprites (art.js, sprites.js), so a frame is only a few dozen drawImage calls.
import { W, H, D, R, IN, CH, MID, PLEN, SLOT, TRAY, DICE, CUBE, BTN, pointGeom, stackPos, barPos, offPos, landing, titleRows, PANEL, PBACK, SET_ROWS, CUBE_ASK, DONE, OVER } from './layout.js';
import { BAR, OFF, pips, own } from './rules.js';
import { drawStatic } from './art.js';
import { drawChecker, drawChip, drawDie, SET_NAMES } from './sprites.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO } from './text.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const REST = [250, 340];                       // where the two dice come to rest
const ease = (f) => f * f * (3 - 2 * f);
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const hash = (n) => { let x = Math.imul(n + 1, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; return (x >>> 0) / 4294967296; };

export function render(ctx, st) {
  const c = ctx, sc = st.scene, t = st.t, big = st.big, calm = st.calm;
  drawStatic(c);
  // the lamp flickers a little (steady when motion is reduced)
  if (!calm) { c.fillStyle = `rgba(255,190,110,${0.03 + 0.015 * Math.sin(t * 1.7) + 0.01 * Math.sin(t * 5.3)})`; c.fillRect(0, 0, W, 520); }
  steam(c, st);

  const text = (s, x, y, size, color = '#f6e3b4', font = UI, weight = 700, align = 'center', shadow = false) => {
    c.textAlign = align; c.font = `${weight} ${size}px ${font}`;
    if (shadow) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(s, x + 1.5, y + 2.5); }
    c.fillStyle = color; c.fillText(s, x, y);
  };
  const wrapLines = (s, size, maxW, weight = 600) => {
    c.font = `${weight} ${size}px ${UI}`; const words = s.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); return lines;
  };
  const wrap = (s, x, y, size, maxW, color, lh = size * 1.32, align = 'center', weight = 600) => { const ls = wrapLines(s, size, maxW, weight); ls.forEach((l, i) => text(l, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  const button = (r, label, o = {}) => {
    c.save(); if (o.dim) c.globalAlpha = 0.45;
    const dn = o.down ? 2 : 0;
    c.fillStyle = 'rgba(0,0,0,0.45)'; rrect(c, r.x + 2, r.y + 7, r.w, r.h, 18); c.fill();
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { g.addColorStop(0, '#f7d98a'); g.addColorStop(0.5, '#d9a441'); g.addColorStop(1, '#a8741f'); } else { g.addColorStop(0, '#8b5630'); g.addColorStop(0.5, '#62371b'); g.addColorStop(1, '#3f2210'); }
    c.fillStyle = g; rrect(c, r.x, r.y + dn, r.w, r.h, 18); c.fill();
    c.strokeStyle = o.primary ? 'rgba(255,240,190,0.9)' : 'rgba(255,225,160,0.55)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(r.x + 16, r.y + dn + 4); c.lineTo(r.x + r.w - 16, r.y + dn + 4); c.stroke();
    if (o.sub) { text(label, r.x + r.w / 2, r.y + r.h / 2 - 2, o.size ?? 28, o.primary ? '#2a1606' : '#f8e6b8', UI, 700); text(o.sub, r.x + r.w / 2, r.y + r.h / 2 + 24, 19, o.primary ? '#4a2c0c' : 'rgba(248,230,184,0.75)', UI, 600); }
    else text(label, r.x + r.w / 2, r.y + dn + r.h / 2 + (o.size ?? 28) * 0.34, o.size ?? 28, o.primary ? '#2a1606' : '#f8e6b8', UI, 700);
    c.restore();
  };
  const panel = (x, y, w, h, alpha = 0.9) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rrect(c, x + 3, y + 8, w, h, 22); c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(48,26,14,${alpha})`); g.addColorStop(1, `rgba(24,12,6,${alpha})`);
    c.fillStyle = g; rrect(c, x, y, w, h, 22); c.fill(); c.strokeStyle = 'rgba(232,196,106,0.75)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(232,196,106,0.3)'; c.lineWidth = 1; rrect(c, x + 8, y + 8, w - 16, h - 16, 16); c.stroke();
  };
  const ctxU = { text, wrap, wrapLines, button, panel };

  if (sc === 'title') return drawTitle(c, st, ctxU);
  if (sc === 'howto') return drawDoc(c, st, ctxU, 'How to play', HOWTO, 0);
  if (sc === 'about') return drawDoc(c, st, ctxU, 'About Tavla', ABOUT, st.page || 0);
  if (sc === 'settings') return drawSettings(c, st, ctxU);
  if (sc === 'demo-limit') return drawDemoLimit(c, st, ctxU);
  drawBoardScene(c, st, ctxU);
}

// ---- steam over the coffee pot and cup --------------------------------------------------------------------------------
function steam(c, st) {
  if (st.calm) return;
  const t = st.t;
  for (const [bx, by, n] of [[48, 34, 3], [128, 82, 2]]) for (let i = 0; i < n; i++) {
    const p = ((t * 0.28 + i / n + bx * 0.01) % 1), x = bx + Math.sin(p * 7 + i * 2 + bx) * (5 + p * 6), y = by - p * 34;
    c.fillStyle = `rgba(255,240,220,${0.16 * Math.sin(p * Math.PI)})`; c.beginPath(); c.arc(x, y, 5 + p * 8, 0, TAU); c.fill();
  }
}

// ---- title ------------------------------------------------------------------------------------------------------------
function drawTitle(c, st, U) {
  for (let i = 0; i < 24; i++) { const v = st.g.board[i], n = Math.abs(v); for (let k = 0; k < n; k++) { const p = stackPos(i, k, n); drawChecker(c, st.set, v > 0 ? 0 : 1, p.x, p.y, 1); } }
  c.fillStyle = 'rgba(14,7,3,0.74)'; c.fillRect(0, 0, W, H);
  const g = c.createRadialGradient(360, 240, 20, 360, 300, 520); g.addColorStop(0, 'rgba(255,190,110,0.22)'); g.addColorStop(1, 'rgba(255,190,110,0)'); c.fillStyle = g; c.fillRect(0, 0, W, 700);
  U.text('Tavla', 362, 198, 150, 'rgba(0,0,0,0.55)', FONT, 700);
  U.text('Tavla', 360, 194, 150, '#f6dfae', FONT, 700);
  const gl = c.createLinearGradient(0, 100, 0, 210); gl.addColorStop(0, 'rgba(255,255,255,0.35)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.globalCompositeOperation = 'source-atop';
  c.globalCompositeOperation = 'source-over';
  U.text('The dice game of the coffeehouse', 360, 262, 32, '#e8c88a', FONT, 700);
  // hero: two dice that tumble now and then
  const cyc = (st.t % 6) / 6, tum = cyc < 0.16 ? cyc / 0.16 : 1;
  for (let i = 0; i < 2; i++) {
    const rest = 300 + i * 120, xs = 70 + i * 50;
    const u = tum, x = xs + (rest - xs) * (1 - (1 - u) * (1 - u)), lift = Math.abs(Math.sin(u * Math.PI * 3)) * (1 - u) * 60;
    const face = u < 0.85 ? 1 + Math.floor(hash(Math.floor(st.t * 14) + i * 7) * 6) : [5, 3][i];
    drawDie(c, face, x, 340 - 0, { rot: (1 - u) * (5 + i * 2) + (i ? -0.12 : 0.1), sq: 1, lift, ivory: i === 0 });
  }
  const R_ = titleRows(!!st.saved), lv = LEVELS[st.level];
  if (R_.resume) U.button(R_.resume, 'Resume game', { primary: true, size: 30 });
  U.button(R_.play, 'Play the computer', { primary: !R_.resume, size: 30, sub: `${lv.name}${st.cube.on ? ' · cube' : ''}` });
  U.button(R_.learn, 'Learn to play', { size: 30, sub: st.learned ? 'Nine hands-on lessons · done' : 'Nine hands-on lessons' });
  U.button(R_.two, 'Two players', { size: 30, sub: 'Pass the phone' });
  U.button(R_.daily, 'Daily puzzle', { size: 30, sub: st.daily.streak ? `Streak ${st.daily.streak} day${st.daily.streak === 1 ? '' : 's'}` : 'Find the best move' });
  U.button(R_.level, `Level: ${lv.name}`, { size: 24 });
  U.button(R_.cube, `Cube: ${st.cube.on ? 'On' : 'Off'}`, { size: 24 });
  U.button(R_.gammon, `Gammons: ${st.gammon ? 'On' : 'Off'}`, { size: 24 });
  U.button(R_.settings, 'Settings', { size: 24 });
  U.button(R_.howto, 'How to play', { size: 24 });
  U.button(R_.about, 'About Tavla', { size: 24 });
  const y = R_.about.y + 100;
  U.wrap(lv.blurb, 360, y, st.big ? 27 : 23, 560, 'rgba(246,227,180,0.85)', 30);
  if (st.stats.games) U.text(`Games played ${st.stats.games}  ·  won ${st.stats.wins}`, 360, y + 92, 22, 'rgba(232,200,140,0.75)', UI, 600);
  if (st.msg) U.wrap(st.msg.text, 360, y + 130, 24, 560, '#ffe9b0', 30);
}

function drawDoc(c, st, U, title, doc, page) {
  c.fillStyle = 'rgba(14,7,3,0.55)'; c.fillRect(0, 262, W, H - 262);
  U.panel(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0.94);
  U.text(title, 360, PANEL.y + 84, 60, '#f6dfae', FONT, 700, 'center', true);
  const pg = doc[Math.min(page, doc.length - 1)], size = st.big ? 27 : 24;
  let y = PANEL.y + 140;
  for (const blk of pg.blocks) {
    if (blk.h) { U.text(blk.h, PANEL.x + 40, y + 6, size + 6, '#e8c46a', UI, 800, 'left'); y += size * 1.6; }
    const n = U.wrap(blk.p, PANEL.x + 40, y, size, PANEL.w - 80, '#f6ead0', size * 1.36, 'left', 500); y += n * size * 1.36 + size * 0.7;
  }
  if (doc.length > 1) U.button({ x: 140, y: 1330, w: 440, h: 70 }, page + 1 < doc.length ? 'More' : 'Back to first page', { size: 26 });
  U.button(PBACK, 'Back', { primary: true, size: 30 });
}

function drawSettings(c, st, U) {
  c.fillStyle = 'rgba(14,7,3,0.55)'; c.fillRect(0, 262, W, H - 262);
  U.panel(PANEL.x, 250, PANEL.w, 1150, 0.94);
  U.text('Settings', 360, 328 - 60, 60, '#f6dfae', FONT, 700, 'center', true);
  const on = (b) => (b ? 'On' : 'Off');
  U.button(SET_ROWS.sound, `Sound: ${on(st.sound)}`, { size: 30, sub: 'Dice and checker clacks' });
  U.button(SET_ROWS.calm, `Reduced motion: ${on(st.calm)}`, { size: 30, sub: 'Quicker moves, no bobbing or steam' });
  U.button(SET_ROWS.big, `Large text: ${on(st.big)}`, { size: 30, sub: 'Bigger messages and panels' });
  U.button(SET_ROWS.set, `Checkers: ${SET_NAMES[st.set]}`, { size: 28, sub: 'Tap to change' });
  U.button(SET_ROWS.auto, `Auto-play forced moves: ${on(st.auto)}`, { size: 28, sub: 'When only one move exists, it is played for you' });
  U.button(SET_ROWS.moves, `Rules: Standard`, { size: 30, sub: 'Regional rule sets can be added later' });
  // a sample of both checker sets
  for (let i = 0; i < 2; i++) drawChecker(c, st.set, i, 300 + i * 120, 1090, 1.2);
  U.button(PBACK, 'Back', { primary: true, size: 30 });
}

function drawDemoLimit(c, st, U) {
  c.fillStyle = 'rgba(14,7,3,0.75)'; c.fillRect(0, 0, W, H);
  U.panel(60, 480, 600, 460, 0.96);
  U.text('That is the free preview', 360, 570, 46, '#f6dfae', FONT, 700);
  U.wrap('The full Tavla is on iPhone and Android: every lesson, all four computer levels, the daily puzzle, the doubling cube and no ads.', 360, 640, 26, 500, '#f6ead0', 34);
  U.button({ x: 140, y: 820, w: 440, h: 76 }, 'Back to the menu', { primary: true, size: 28 });
}

// ---- the board scenes ---------------------------------------------------------------------------------------------------
function drawBoardScene(c, st, U) {
  const g = st.g, set = st.set, sc = st.scene, t = st.t, calm = st.calm, a = st.anim;
  const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5);
  const mySide = 0;

  // ---- header ----------------------------------------------------------------------------------------------------------
  U.text('Tavla', 360, 96, 72, '#f6dfae', FONT, 700, 'center', true);
  if (sc !== 'lesson') {
    U.text(`${st.two && sc === 'play' ? 'Player 1' : 'You'}  ${pips(g, 0)}`, 700, 62, 22, '#f6e3b4', UI, 700, 'right');
    U.text(`${st.two && sc === 'play' ? 'Player 2' : 'Rival'}  ${pips(g, 1)}`, 700, 90, 22, '#e8b98a', UI, 700, 'right');
    U.text('pips to go', 700, 114, 16, 'rgba(246,227,180,0.6)', UI, 600, 'right');
  }
  // message banner
  let msg = st.msg?.text ?? st.status ?? '';
  if (sc === 'lesson') { const l = LESSONS[st.lesson.i]; msg = st.msg?.text ?? (st.lesson.done ? l.done : l.text); }
  const bx = 24, by = 128, bw = 672, bh = 84;
  U.panel(bx, by, bw, bh, 0.86);
  if (sc === 'lesson') U.text(`Lesson ${st.lesson.i + 1} of ${LESSONS.length}: ${LESSONS[st.lesson.i].title}`, 360, by - 6, 22, '#e8c46a', UI, 800);
  if (sc === 'puzzle' && st.pz?.puzzle) U.text(`Daily puzzle · streak ${st.daily.streak}`, 360, by - 6, 22, '#e8c46a', UI, 800);
  let size = st.big ? 26 : 23, ls = U.wrapLines(msg, size, bw - 40);
  while (ls.length > 3 && size > 15) { size -= 1; ls = U.wrapLines(msg, size, bw - 40); }
  while (ls.length > 2 && size > 15 && bh < 96) { if (ls.length * size * 1.28 <= bh - 16) break; size -= 1; ls = U.wrapLines(msg, size, bw - 40); }
  const lh = size * 1.26, y0 = by + bh / 2 - ((ls.length - 1) * lh) / 2 + size * 0.34;
  const mc = st.lesson && st.lesson.done && sc === 'lesson' && !st.msg ? '#c9f7c0' : '#fff3d6';
  ls.forEach((l, i) => U.text(l, 360, y0 + i * lh, size, mc, UI, 600));

  // ---- trays --------------------------------------------------------------------------------------------------------------
  for (let s = 0; s < 2; s++) {
    let n = g.off[s]; if (a && a.hide && a.hide.kind === 'off' && a.hide.side === s && !a.done) n -= 1;
    for (let k = 0; k < n; k++) { const p = offPos(s, k); drawChip(c, set, s, p.x, p.y); }
    if (!g.off[s] && !(s === 0 && st.dests.some((d) => d.to === OFF))) { const T = s === 0 ? TRAY.me : TRAY.opp; U.text(s === 0 ? 'Your bear-off tray' : 'Rival’s bear-off tray', 360, T.y + T.h / 2 + 6, 17, 'rgba(255,225,170,0.32)', UI, 700); }
    if (g.off[s] && g.off[s] < 10) { const T = s === 0 ? TRAY.me : TRAY.opp; U.text(`${g.off[s]} off`, T.x + T.w - 14, T.y + T.h / 2 + 8, 22, 'rgba(255,235,190,0.9)', UI, 700, 'right', true); }
  }
  if (st.dests.some((d) => d.to === OFF)) {
    const T = TRAY.me; c.fillStyle = `rgba(255,220,110,${0.16 + pulse * 0.2})`; rrect(c, T.x - 4, T.y - 4, T.w + 8, T.h + 8, 12); c.fill();
    c.strokeStyle = `rgba(255,230,140,${0.6 + pulse * 0.4})`; c.lineWidth = 2.5; c.stroke();
    if (g.off[0] < 12) U.text('BEAR OFF HERE', 360, T.y + T.h / 2 + 8, 22, 'rgba(255,240,200,0.95)', UI, 800, 'center', true);
  }

  // ---- highlights on the points ----------------------------------------------------------------------------------------------
  const tri = (idx, inset = 0) => {
    const gm = pointGeom(idx), y0 = gm.y - SLOT / 2 + 3, y1 = gm.y + SLOT / 2 - 3, tx = gm.edge + gm.dir * PLEN;
    c.beginPath(); c.moveTo(gm.edge, y0); c.lineTo(tx, gm.y - 1.5); c.lineTo(tx, gm.y + 1.5); c.lineTo(gm.edge, y1); c.closePath();
  };
  for (const d of st.dests) if (d.to < 24) { tri(d.to); c.fillStyle = `rgba(255,222,120,${0.2 + pulse * 0.22})`; c.fill(); c.strokeStyle = `rgba(255,236,150,${0.55 + pulse * 0.4})`; c.lineWidth = 2; c.stroke(); }

  // ---- checkers --------------------------------------------------------------------------------------------------------------
  const hidden = (kind, idx, side, k, n) => a && !a.done && a.hide && a.hide.kind === kind && a.hide.idx === idx && a.hide.side === side && k === n - 1;
  const dragFrom = st.drag && st.drag.on ? st.drag.from : -9;
  const sources = new Set(st.sources || []);
  const drawStack = (idx) => {
    const v = g.board[idx]; if (!v) return;
    const side = v > 0 ? 0 : 1, n = Math.abs(v);
    for (let k = 0; k < n; k++) {
      if (hidden('pt', idx, side, k, n)) continue;
      if (dragFrom === idx && k === n - 1) continue;
      const p = stackPos(idx, k, n), top = k === n - 1;
      const lift = top && st.sel === idx ? 12 : 0;
      drawChecker(c, set, side, p.x, p.y, 1, lift);
      if (top && n > 5) badge(c, p.x, p.y, n);
      if (top && sources.has(idx) && st.sel !== idx && !calm && !st.drag?.on) { c.strokeStyle = `rgba(255,232,140,${0.25 + pulse * 0.5})`; c.lineWidth = 2.5; c.beginPath(); c.arc(p.x, p.y, R + 3, 0, TAU); c.stroke(); }
      if (top && st.sel === idx) { c.strokeStyle = 'rgba(255,240,160,0.95)'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y - lift, R + 3, 0, TAU); c.stroke(); }
    }
  };
  for (let i = 0; i < 24; i++) drawStack(i);
  // ghost of a checker being hit: it is still on the point while the hitter lands
  if (a && !a.done && a.ghost && a.t < a.dur) drawChecker(c, set, a.ghost.side, a.ghost.pos.x, a.ghost.pos.y, 1);
  for (let s = 0; s < 2; s++) {
    let n = g.bar[s]; const hideOne = a && !a.done && a.hit && a.hit.side === s ? 1 : 0;
    for (let k = 0; k < n - hideOne; k++) {
      if (st.drag?.on && dragFrom === BAR && s === 0 && k === n - 1) continue;
      const p = barPos(s, k, n), top = k === n - 1;
      drawChecker(c, set, s, p.x, p.y, 1, top && st.sel === BAR && s === 0 ? 12 : 0);
      if (top && n > 5) badge(c, p.x, p.y, n);
      if (top && s === 0 && sources.has(BAR)) { c.strokeStyle = `rgba(255,232,140,${0.4 + pulse * 0.5})`; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y - (st.sel === BAR ? 12 : 0), R + 3, 0, TAU); c.stroke(); }
    }
  }
  if (g.bar[0] + g.bar[1] > 0) U.text('BAR', CH.cx, MID + 4, 15, 'rgba(232,196,106,0.7)', UI, 800);
  // landing markers
  for (const d of st.dests) if (d.to < 24) {
    const n = Math.abs(g.board[d.to]), same = own(g, 0, d.to) > 0 || true; const p = stackPos(d.to, n === 0 || own(g, 0, d.to) < 0 ? 0 : n, n + 1);
    c.strokeStyle = `rgba(255,240,170,${0.6 + pulse * 0.4})`; c.lineWidth = 3; c.setLineDash([7, 6]); c.beginPath(); c.arc(p.x, p.y, R - 2, 0, TAU); c.stroke(); c.setLineDash([]);
    if (own(g, 0, d.to) < 0) { c.fillStyle = 'rgba(255,90,60,0.9)'; c.font = `800 15px ${UI}`; c.textAlign = 'center'; c.fillText('HIT', p.x, p.y + 5); }
  }
  // hint
  if (st.hint) {
    const h = st.hint, f = h.from === BAR ? barPos(0, Math.max(0, g.bar[0] - 1), Math.max(1, g.bar[0])) : stackPos(h.from, Math.max(0, Math.abs(g.board[h.from]) - 1), Math.abs(g.board[h.from]) || 1);
    const to = landing(h.to, h.to === OFF ? g.off[0] : h.to === BAR ? 0 : Math.abs(g.board[h.to]) && own(g, 0, h.to) > 0 ? Math.abs(g.board[h.to]) : 0, 0);
    c.strokeStyle = '#7dffb0'; c.lineWidth = 4; c.beginPath(); c.arc(f.x, f.y, R + 5, 0, TAU); c.stroke();
    c.setLineDash([10, 8]); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(to.x, to.y); c.stroke(); c.setLineDash([]);
    c.fillStyle = `rgba(125,255,176,${0.25 + pulse * 0.3})`; c.beginPath(); c.arc(to.x, to.y, R + 4, 0, TAU); c.fill(); c.strokeStyle = '#7dffb0'; c.beginPath(); c.arc(to.x, to.y, R + 4, 0, TAU); c.stroke();
  }
  // a piece being dragged
  if (st.drag && st.drag.on) drawChecker(c, set, 0, st.drag.x, st.drag.y, 1.14, 16);
  // the moving checker
  if (a && !a.done) drawMover(c, st, a, set);
  if (st.cursorOn && st.cursor != null) { const p = cursorPos(st.cursor, g); c.strokeStyle = '#7de0ff'; c.lineWidth = 3.5; c.setLineDash([6, 5]); c.beginPath(); c.arc(p.x, p.y, R + 8, 0, TAU); c.stroke(); c.setLineDash([]); }

  // ---- dice, cube, buttons -----------------------------------------------------------------------------------------------------
  drawDice(c, st, U, pulse);
  drawCube(c, st, U, pulse);
  const lock = st.phase !== 'move' && st.phase !== 'roll' && st.phase !== 'end';
  if (sc !== 'over') U.button(BTN.menu, 'Menu', { size: 26 });
  const fin = (st.lesson && sc === 'lesson' && st.lesson.done) || (sc === 'puzzle' && st.pz?.status === 'solved');
  if (!fin && (sc === 'play' || sc === 'lesson' || sc === 'puzzle')) {
    U.button(BTN.undo, 'Undo', { size: 26, dim: !st.canUndo });
    U.button(BTN.hint, sc === 'puzzle' ? 'Reset' : `Hint (${st.hintsLeft})`, { size: 26, dim: sc !== 'puzzle' && st.hintsLeft <= 0 });
  }
  if (st.thinking && !calm) { const n = 1 + (Math.floor(t * 3) % 3); U.text('Thinking' + '.'.repeat(n), 360, 1466, 18, 'rgba(255,230,170,0.8)', UI, 700); }

  // ---- overlays ------------------------------------------------------------------------------------------------------------
  if (st.phase === 'cubeask') drawCubeAsk(c, st, U);
  if (st.lesson && sc === 'lesson' && st.lesson.done && !st.anim) U.button(DONE, st.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 });
  if (sc === 'puzzle' && st.pz?.status === 'solved') U.button(DONE, 'Back to menu', { primary: true, size: 28 });
  if (sc === 'over') drawOver(c, st, U);
}

function badge(c, x, y, n) {
  c.fillStyle = 'rgba(20,8,2,0.85)'; c.beginPath(); c.arc(x, y, 15, 0, TAU); c.fill(); c.strokeStyle = '#e6c56a'; c.lineWidth = 1.5; c.stroke();
  c.font = `800 18px ${UI}`; c.textAlign = 'center'; c.fillStyle = '#fff1c8'; c.fillText(String(n), x, y + 6.5);
}
function cursorPos(cu, g) {
  if (cu === BAR) return barPos(0, 0, 1);
  if (cu === OFF) return { x: 360, y: TRAY.me.y + TRAY.me.h / 2 };
  const n = Math.abs(g.board[cu]); return stackPos(cu, Math.max(0, n - 1), Math.max(1, n));
}

function drawMover(c, st, a, set) {
  const total = a.dur + (a.hit ? a.hitDur : 0);
  if (a.t < a.dur) {
    const f = Math.min(1, a.t / a.dur), e = a.kind === 'refuse' ? refuseCurve(f, a) : ease(f);
    const shake = a.kind === 'refuse' && !st.calm && f > 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 : 0;
    const x = a.from.x + (a.to.x - a.from.x) * e + shake, y = a.from.y + (a.to.y - a.from.y) * e;
    const lift = Math.sin(Math.PI * Math.min(1, f)) * (a.kind === 'refuse' ? 14 : 30) + 8;
    drawChecker(c, set, a.side, x, y, 1.06, lift);
    if (a.kind === 'move' && a.hit && f > 0.86) { c.strokeStyle = `rgba(255,220,120,${(f - 0.86) * 7})`; c.lineWidth = 3; c.beginPath(); c.arc(a.to.x, a.to.y, R * (1 + (f - 0.86) * 5), 0, TAU); c.stroke(); }
  } else if (a.hit) {
    const f = Math.min(1, (a.t - a.dur) / a.hitDur), e = ease(f), h = a.hit;
    const x = h.from.x + (h.to.x - h.from.x) * e, y = h.from.y + (h.to.y - h.from.y) * e;
    drawChecker(c, set, h.side, x, y, 1.02, Math.sin(Math.PI * f) * 44 + 4);
    c.strokeStyle = `rgba(255,220,120,${0.7 * (1 - f)})`; c.lineWidth = 3; c.beginPath(); c.arc(a.to.x, a.to.y, R * (1.4 + f * 1.2), 0, TAU); c.stroke();
  }
  void total;
}
const refuseCurve = (f) => { const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4; return ease(out) * 0.7; };

// ---- dice ---------------------------------------------------------------------------------------------------------------
function drawDice(c, st, U, pulse) {
  const d = st.dice, ivory = st.g.turn === 0 || st.two === true && st.g.turn === 0;
  const dieIvory = !(st.dice && st.dice.side === 1);
  if (!d.vals) {
    // waiting to be rolled: two resting dice and a call to action
    for (let i = 0; i < 2; i++) drawDie(c, [4, 2][i], REST[i], DICE.cy, { rot: i ? 0.12 : -0.1, ivory: st.g.turn === 0 || st.two });
    if (st.phase === 'roll' && (st.scene !== 'over')) {
      const lift = st.calm ? 0 : Math.abs(Math.sin(st.t * 3)) * 6;
      c.fillStyle = `rgba(255,225,130,${0.14 + pulse * 0.16})`; rrect(c, DICE.x + 12, DICE.y + 12, DICE.w - 24, DICE.h - 24, 10); c.fill();
      U.text(st.g.turn === 0 || st.two ? 'TAP THE DICE TO ROLL' : '', 470, DICE.cy - 4 - lift * 0, 22, '#ffe9a8', UI, 800, 'left');
      U.text(st.two ? (st.g.turn === 0 ? 'Player 1' : 'Player 2') : 'or press Space', 470, DICE.cy + 22, 17, 'rgba(255,233,168,0.8)', UI, 600, 'left');
    }
    return;
  }
  const roll = d.roll, vals = d.vals, ivoryDice = d.side === 0 || (st.two === true && false) ? true : d.side === 0;
  for (let i = 0; i < 2; i++) {
    const rest = REST[i];
    let x = rest, y = DICE.cy, rot = i ? 0.1 : -0.08, sq = 1, lift = 0, face = vals[i];
    if (roll && roll.t < roll.dur) {
      const u = roll.t / roll.dur, k = 1 - u;
      const xs = 560 + i * 24, ys = DICE.cy + (i ? 18 : -18);
      x = xs + (rest - xs) * (1 - k * k * k); y = ys + (DICE.cy - ys) * u;
      lift = Math.abs(Math.sin(u * Math.PI * 3.2 + i)) * k * 54; rot = k * k * (9 + i * 5) * (i ? -1 : 1) + (i ? 0.1 : -0.08); sq = 1 - 0.16 * Math.abs(Math.sin(u * 24 + i * 2)) * k;
      if (u < 0.82) face = 1 + Math.floor(hash(Math.floor(u * 22) * 3 + i) * 6);
    }
    const used = st.left && st.phase !== 'rolling' && !st.left.includes(vals[i]) && vals[0] !== vals[1];
    drawDie(c, face, x, y, { rot, sq, lift, dim: !!used, ivory: d.side === 0 });
  }
  if (vals[0] === vals[1] && st.left && !(roll && roll.t < roll.dur)) U.text(`× ${st.left.length}`, 420, DICE.cy + 8, 30, '#ffe9a8', UI, 800, 'left', true);
  void ivory; void dieIvory; void ivoryDice;
}
function drawCube(c, st, U, pulse) {
  const cb = st.cube; if (!cb.on) return;
  const x = CUBE.x, y = CUBE.y, s = CUBE.s, can = st.phase === 'roll' && st.canDouble;
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,0.4)'; rrect(c, -s / 2 + 4, -s / 2 + 8, s, s, 10); c.fill();
  const g = c.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); g.addColorStop(0, '#fffaea'); g.addColorStop(1, '#d6bd86'); c.fillStyle = g; rrect(c, -s / 2, -s / 2, s, s, 10); c.fill();
  c.strokeStyle = can ? `rgba(255,214,90,${0.6 + pulse * 0.4})` : 'rgba(110,74,20,0.8)'; c.lineWidth = can ? 4 : 1.5; c.stroke();
  const v = cb.owner === -1 ? 64 : cb.v;
  c.font = `800 ${v >= 10 ? 26 : 32}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = '#5a1219'; c.fillText(String(v), 0, 11);
  c.restore();
  U.text(cb.owner === -1 ? 'Cube' : cb.owner === 0 ? 'Yours' : 'Rival’s', x, y + 52, 15, 'rgba(255,233,168,0.85)', UI, 700);
  if (can) U.text('TAP to double', x + 12, y - 42, 15, '#ffe9a8', UI, 800);
}
function drawCubeAsk(c, st, U) {
  c.fillStyle = 'rgba(8,4,2,0.55)'; c.fillRect(0, 262, W, 1040);
  U.panel(60, 540, 600, 350, 0.97);
  U.text(st.cubeAsk.title, 360, 606, 40, '#f6dfae', FONT, 700, 'center', true);
  U.wrap(st.cubeAsk.body, 360, 656, st.big ? 27 : 24, 500, '#f6ead0', 33);
  U.button(CUBE_ASK.take, 'Take', { primary: true, size: 30, sub: 'play on' });
  U.button(CUBE_ASK.drop, 'Drop', { size: 30, sub: 'give up this game' });
}
function drawOver(c, st, U) {
  c.fillStyle = 'rgba(8,4,2,0.6)'; c.fillRect(0, 262, W, 1040);
  U.panel(50, 470, 620, 520, 0.97);
  U.text(st.result.title, 360, 560, 60, '#f6dfae', FONT, 700, 'center', true);
  U.wrap(st.result.body, 360, 620, st.big ? 28 : 25, 520, '#f6ead0', 34);
  U.button(OVER.again, 'Play again', { primary: true, size: 30 });
  U.button(OVER.menu, 'Menu', { size: 26 });
  U.button(OVER.share, 'Share', { size: 26 });
}
