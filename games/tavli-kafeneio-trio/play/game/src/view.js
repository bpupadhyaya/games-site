// Everything drawn per frame. Reads `state` (see game.js) and changes nothing. The heavy art (table, board, checkers, dice faces)
// lives in cached sprites (art.js, sprites.js), so a frame is only a few dozen drawImage calls.
import { W, H, D, R, IN, CH, MID, PLEN, SLOT, TRAY, DICE, BTN, pointGeom, stackPos, barPos, offPos, titleRows, SETUP, PANEL, PBACK, DOC_BACK, DOC_NEXT, SET_ROWS, SET_TEXT, PAUSE, OVER, TEXT_SCALES, TEXT_BTN, THINK_STEPS, DONE } from './layout.js';
import { BAR, OFF, PORTES, PLAKOTO, FEVGA, VARIANTS, pips, top, height, idxAt, distAt } from './rules.js';
import { drawStatic, rr, lin, meander } from './art.js';
import { drawChecker, drawChip, drawDie, drawLock, SET_NAMES } from './sprites.js';
import { LEVELS } from './ai.js';
import { ABOUT, HOWTO, RULES } from './text.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const GREEK = '"Tavli Greek", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const REST = [250, 340];                       // where the two dice come to rest
export const GREEK_NAMES = ['Πόρτες', 'Πλακωτό', 'Φεύγα'];
const ease = (f) => f * f * (3 - 2 * f);
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const hash = (n) => { let x = Math.imul(n + 1, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; return (x >>> 0) / 4294967296; };
const clampI = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function render(ctx, st) {
  const c = ctx, sc = st.scene, t = st.t, calm = st.calm;
  drawStatic(c);
  if (!calm) { c.fillStyle = `rgba(255,200,120,${0.025 + 0.012 * Math.sin(t * 1.7) + 0.008 * Math.sin(t * 5.3)})`; c.fillRect(0, 0, W, 520); }

  const text = (s, x, y, size, color = '#f6ecd0', font = UI, weight = 700, align = 'center', shadow = false) => {
    c.textAlign = align; c.font = `${weight} ${size}px ${font}`;
    if (shadow) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(s, x + 1.5, y + 2.5); }
    c.fillStyle = color; c.fillText(s, x, y);
  };
  // shrink a single line until it fits maxW
  const fit = (s, maxW, size, weight = 700, font = UI) => { let z = size; c.font = `${weight} ${z}px ${font}`; while (c.measureText(s).width > maxW && z > 11) { z -= 1; c.font = `${weight} ${z}px ${font}`; } return z; };
  const fitText = (s, x, y, maxW, size, color, font = UI, weight = 700, align = 'center', shadow = false) => text(s, x, y, fit(s, maxW, size, weight, font), color, font, weight, align, shadow);
  const wrapLines = (s, size, maxW, weight = 600, font = UI) => {
    c.font = `${weight} ${size}px ${font}`; const words = String(s).split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); return lines;
  };
  const wrap = (s, x, y, size, maxW, color, lh = size * 1.32, align = 'center', weight = 600) => { const ls = wrapLines(s, size, maxW, weight); ls.forEach((l, i) => text(l, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  const button = (r, label, o = {}) => {
    c.save(); if (o.dim) c.globalAlpha = 0.45;
    const pp = st.ptr, pressed = !o.dim && pp && pp.x >= r.x && pp.x <= r.x + r.w && pp.y >= r.y && pp.y <= r.y + r.h;
    const dn = pressed || o.down ? 3 : 0;
    // one fill (a very gentle top-to-bottom gradient), one crisp border, one soft shadow; pressed = sinks 3px and darkens
    c.fillStyle = 'rgba(0,0,0,0.34)'; rrect(c, r.x + 1, r.y + (dn ? 3 : 6), r.w, r.h, 16); c.fill();
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { g.addColorStop(0, pressed ? '#d8a63f' : '#efc659'); g.addColorStop(1, pressed ? '#b8821f' : '#d9a640'); }
    else if (o.on) { g.addColorStop(0, pressed ? '#245f9c' : '#3a7cc0'); g.addColorStop(1, pressed ? '#164575' : '#2a64a6'); }
    else { g.addColorStop(0, pressed ? '#12426f' : '#1d5a92'); g.addColorStop(1, pressed ? '#0c335a' : '#154a7c'); }
    c.fillStyle = g; rrect(c, r.x, r.y + dn, r.w, r.h, 16); c.fill();
    c.strokeStyle = o.primary ? '#fff0b8' : o.on ? '#ffe9a0' : 'rgba(232,200,120,0.7)'; c.lineWidth = o.on ? 2.5 : 1.5; c.stroke();
    const size = fit(label, r.w - 24, o.size ?? 28, 700);
    const col = o.primary ? '#2a1606' : '#fbeecb';
    if (o.sub) { text(label, r.x + r.w / 2, r.y + r.h / 2 - 2, size, col, UI, 700); text(o.sub, r.x + r.w / 2, r.y + r.h / 2 + 24, fit(o.sub, r.w - 24, 19, 600), o.primary ? '#4a2c0c' : 'rgba(251,238,203,0.78)', UI, 600); }
    else text(label, r.x + r.w / 2, r.y + dn + r.h / 2 + size * 0.34, size, col, UI, 700);
    c.restore();
  };
  const panel = (x, y, w, h, alpha = 0.92) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rrect(c, x + 3, y + 8, w, h, 22); c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(12,40,76,${alpha})`); g.addColorStop(1, `rgba(6,22,46,${alpha})`);
    c.fillStyle = g; rrect(c, x, y, w, h, 22); c.fill(); c.strokeStyle = 'rgba(240,214,140,0.8)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(240,214,140,0.3)'; c.lineWidth = 1; rrect(c, x + 8, y + 8, w - 16, h - 16, 16); c.stroke();
  };
  const U = { text, fit, fitText, wrap, wrapLines, button, panel };

  if (sc === 'setup' || sc === 'howto' || sc === 'about' || sc === 'rules' || sc === 'settings') {
    U.text('Tavli', 360, 150, 96, '#f8efd2', FONT, 700, 'center', true); U.text('Τάβλι', 360, 198, 32, '#e8c56a', GREEK, 700);
  }
  if (sc === 'title') drawTitle(c, st, U);
  else if (sc === 'setup') drawSetup(c, st, U);
  else if (sc === 'howto') drawDoc(c, st, U, 'How to play', HOWTO, st.page || 0);
  else if (sc === 'about') drawDoc(c, st, U, 'About Tavli', ABOUT, st.page || 0);
  else if (sc === 'rules') drawDoc(c, st, U, 'Rules', RULES, st.page || 0);
  else if (sc === 'settings') drawSettings(c, st, U);
  else if (sc === 'demo-limit') drawDemoLimit(c, st, U);
  else drawBoardScene(c, st, U);
  if (st.paused) drawPause(c, st, U);
}

const scaleOf = (st) => TEXT_SCALES[clampI(st.textScaleIdx ?? 0, 0, TEXT_SCALES.length - 1)];

// ---- title ------------------------------------------------------------------------------------------------------------------
// Three small tiles that say what the three games are, drawn with the game's own checkers.
function miniGame(c, st, kind, x, y, w, h) {
  const set = st.set;
  c.save(); rrect(c, x, y, w, h, 16); c.clip();
  c.fillStyle = lin(c, x, y, x, y + h, [[0, 'rgba(16,50,92,0.95)'], [1, 'rgba(8,28,56,0.95)']]); c.fillRect(x, y, w, h);
  c.restore();
  c.strokeStyle = 'rgba(240,214,140,0.6)'; c.lineWidth = 1.5; rrect(c, x, y, w, h, 16); c.stroke();
  const cx = x + w / 2, cy = y + 52, s = 0.62;
  if (kind === PORTES) { drawChecker(c, set, 0, cx - 20, cy, s); drawChecker(c, set, 1, cx + 26, cy + 4, s, 6); c.strokeStyle = '#ff9f7a'; c.lineWidth = 3; c.beginPath(); c.arc(cx + 26, cy - 2, 30, 0.1, TAU - 0.1); c.stroke(); }
  else if (kind === PLAKOTO) { drawChecker(c, set, 1, cx - 10, cy + 2, s); drawChecker(c, set, 0, cx + 14, cy, s); drawLock(c, cx - 22, cy + 6, 0.8); }
  else { for (let i = 0; i < 3; i++) drawChecker(c, set, 0, cx - 36 + i * 36, cy, s * 0.82); c.strokeStyle = '#e8c56a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 54, cy + 36); c.lineTo(cx + 54, cy + 36); c.stroke(); }
}
function drawTitle(c, st, U) {
  const S = scaleOf(st), calm = st.calm;
  c.fillStyle = 'rgba(8,22,42,0.84)'; c.fillRect(0, 262, W, H - 262);
  const g = c.createRadialGradient(360, 230, 20, 360, 300, 520); g.addColorStop(0, 'rgba(255,214,140,0.22)'); g.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = g; c.fillRect(0, 0, W, 700);
  U.text('Tavli', 362, 156, 118, 'rgba(0,0,0,0.55)', FONT, 700);
  U.text('Tavli', 360, 152, 118, '#f8efd2', FONT, 700);
  U.text('Τάβλι', 360, 200, 38, '#e8c56a', GREEK, 700);
  meander(c, 190, 212, 340, 12, { color: '#e8c56a', width: 1.5, shadow: false });
  // a gentle breathing glow behind the three tiles
  const tw = 212, gap = 14, x0 = (W - (tw * 3 + gap * 2)) / 2, ty = 300, th = 176;
  for (let i = 0; i < 3; i++) {
    const x = x0 + i * (tw + gap), bob = calm ? 0 : Math.sin(st.t * 1.4 + i * 1.7) * 3;
    miniGame(c, st, i, x, ty + bob, tw, th);
    U.text(GREEK_NAMES[i], x + tw / 2, ty + bob + 120, 30, '#f8efd2', GREEK, 700);
    U.text(VARIANTS[i].name, x + tw / 2, ty + bob + 150, 21, 'rgba(240,214,140,0.9)', UI, 700);
  }
  U.fitText('Hit. Pin. Block. Three games, one board.', 360, 540, 620, Math.round(26 * Math.min(S, 1.25)), '#f1e2b6', FONT, 700);
  const R_ = titleRows(!!st.saved);
  if (R_.resume) U.button(R_.resume, 'Resume game', { primary: true, size: 30, sub: st.matchLabel || undefined });
  U.button(R_.play, 'Play', { primary: !R_.resume, size: 34 });
  U.button(R_.auto, 'Watch & Learn', { size: 28 });
  U.button(R_.howto, 'How to play', { size: 21 });
  U.button(R_.rules, 'Rules', { size: 21 });
  U.button(R_.about, 'About', { size: 21 });
  U.button(R_.settings, 'Settings', { size: 26 });
  const y = R_.settings.y + R_.settings.h + 50;
  if (st.stats.games) U.fitText(`Games played ${st.stats.games}  ·  won ${st.stats.wins}`, 360, y, 560, Math.round(22 * Math.min(S, 1.6)), 'rgba(240,214,140,0.8)', UI, 600);
  if (st.msg) U.wrap(st.msg.text, 360, y + 44, Math.round(22 * Math.min(S, 1.4)), 560, '#ffe9b0', 30);
}

// ---- setup ------------------------------------------------------------------------------------------------------------------
function drawSetup(c, st, U) {
  const S = Math.min(scaleOf(st), 1.35), su = st.setup;
  c.fillStyle = 'rgba(8,22,42,0.84)'; c.fillRect(0, 262, W, H - 262);
  U.panel(PANEL.x, 250, PANEL.w, 1140, 0.94);
  U.text('New game', 360, 312, 58, '#f8efd2', FONT, 700, 'center', true);
  const names = ['Portes', 'Plakoto', 'Fevga', 'The Greek match'];
  const blurb = [VARIANTS[0].blurb, VARIANTS[1].blurb, VARIANTS[2].blurb, 'All three in turn'];
  SETUP.modes.forEach((r, i) => {
    const sel = su.mode === i;
    U.button(r, '', { on: sel });
    if (i < 3) U.text(GREEK_NAMES[i], r.x + r.w / 2, r.y + 46, Math.round(34 * Math.min(S, 1.1)), '#fff3cf', GREEK, 700);
    else U.text('Πόρτες · Πλακωτό · Φεύγα', r.x + r.w / 2, r.y + 44, fit3(c, 'Πόρτες · Πλακωτό · Φεύγα', r.w - 24, 24, GREEK), '#fff3cf', GREEK, 700);
    U.fitText(names[i], r.x + r.w / 2, r.y + 78, r.w - 24, Math.round(22 * S), '#f1d98f', UI, 800);
    const ls = U.wrapLines(blurb[i], Math.round(17 * S), r.w - 28, 600);
    ls.slice(0, 2).forEach((l, k) => U.text(l, r.x + r.w / 2, r.y + 104 + k * Math.round(19 * S), Math.round(17 * S), 'rgba(251,238,203,0.85)', UI, 600));
  });
  U.text('Match to', 52, 702, 22, '#e8c46a', UI, 800, 'left');
  [5, 7].forEach((n, i) => U.button(SETUP.match[i], `${n} points`, { size: 26, on: su.target === n, dim: su.mode !== 3 }));
  U.text('Opponent', 52, 832, 22, '#e8c46a', UI, 800, 'left');
  ['The computer', 'Two players'].forEach((n, i) => U.button(SETUP.opp[i], n, { size: 26, on: su.two === (i === 1) }));
  U.text('Computer level', 52, 962, 22, '#e8c46a', UI, 800, 'left');
  LEVELS.forEach((L, i) => U.button(SETUP.levels[i], L.name, { size: 21, on: su.level === i, dim: su.two }));
  U.wrap(su.two ? 'Two players share this phone.' : LEVELS[su.level].blurb, 360, 1090, Math.round(22 * S), 560, 'rgba(246,236,208,0.88)', Math.round(28 * S));
  U.button(SETUP.start, 'Start', { primary: true, size: 34 });
  U.button(SETUP.back, 'Back', { size: 28 });
}
function fit3(c, s, maxW, size, font) { let z = size; c.font = `700 ${z}px ${font}`; while (c.measureText(s).width > maxW && z > 11) { z -= 1; c.font = `700 ${z}px ${font}`; } return z; }

// ---- reference pages ----------------------------------------------------------------------------------------------------------
// Picks the largest body size whose wrapped header+body actually fits the room, so the text never runs into the footer.
function fitDocBody(U, blocks, room, scale) {
  const hSize = Math.round(33 * Math.min(scale, 1.3));
  const bodyLadder = [28, 26, 24, 22, 20, 18, 16, 14].map((s) => Math.round(s * scale));
  let best = null;
  for (const size of bodyLadder) {
    let h = 0;
    for (const blk of blocks) {
      if (blk.h) { const lines = U.wrapLines(blk.h, hSize, PANEL.w - 80, 800).length; h += lines * hSize * 1.15 + size * 0.35; }
      const n = U.wrapLines(blk.p, size, PANEL.w - 80, 500).length; h += n * size * 1.4 + size * 0.7;
    }
    best = { size, hSize, height: h };
    if (h <= room) break;
  }
  return best;
}
function ruleArt(c, st, art, y, scale) {
  const set = st.set, cx = 360, k = 1.15 * Math.min(1, 1.4 / scale + 0.2);
  if (art === 'checkers') { drawChecker(c, set, 0, cx - 140, y + 46, 1.3); drawChecker(c, set, 1, cx + 140, y + 46, 1.3); return 130; }
  if (art === 'dice') { drawDie(c, 5, cx - 60, y + 50, { rot: -0.1, ivory: true }); drawDie(c, 3, cx + 60, y + 50, { rot: 0.12, ivory: false }); return 130; }
  if (art === 'pin') { drawChecker(c, set, 1, cx - 34, y + 50, 1.2); drawChecker(c, set, 0, cx + 16, y + 50, 1.2); drawLock(c, cx - 62, y + 56, 1.25); return 130; }
  if (art === 'wall') { for (let i = 0; i < 6; i++) drawChecker(c, set, i % 2, cx - 215 + i * 86, y + 48, 0.95); c.strokeStyle = '#e8c56a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 255, y + 98); c.lineTo(cx + 255, y + 98); c.stroke(); return 124; }
  void k; return 0;
}
function drawDoc(c, st, U, title, doc, page, opts = {}) {
  c.fillStyle = 'rgba(8,22,42,0.6)'; c.fillRect(0, 262, W, H - 262);
  U.panel(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 0.95);
  const scale = scaleOf(st);
  const titleSize = Math.round(60 * Math.min(scale, 1.15));
  U.fitText(title, 360, PANEL.y + 140, 440, titleSize, '#f8efd2', FONT, 700, 'center', true);
  U.button(TEXT_BTN.dec, 'A−', { size: 28, dim: st.textScaleIdx === 0 });
  U.button(TEXT_BTN.inc, 'A+', { size: 28, dim: st.textScaleIdx === TEXT_SCALES.length - 1 });
  c.save(); c.strokeStyle = 'rgba(240,214,140,0.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(PANEL.x + 60, PANEL.y + 164); c.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 164); c.stroke(); c.restore();
  U.text(`Text size ${Math.round(scale * 100)}%`, 360, PANEL.y + 196, 17, 'rgba(240,214,140,0.7)', UI, 700);
  const pg = doc[Math.min(page, doc.length - 1)];
  let y = PANEL.y + 214;
  const FOOTER_Y = 1290;
  if (pg.art) y += ruleArt(c, st, pg.art, y, scale);
  const lead0 = Math.round(0.8 * 28 * scale);
  const { size, hSize } = fitDocBody(U, pg.blocks, FOOTER_Y - y - lead0, scale);
  y += Math.round(0.8 * (pg.blocks[0].h ? hSize : size));
  for (const blk of pg.blocks) {
    if (blk.h) { const hLines = U.wrap(blk.h, PANEL.x + 40, y + 6, hSize, PANEL.w - 80, '#e8c46a', hSize * 1.15, 'left', 800); y += hLines * hSize * 1.15 + size * 0.35; }
    const n = U.wrap(blk.p, PANEL.x + 40, y, size, PANEL.w - 80, '#f6ecd4', size * 1.4, 'left', 500); y += n * size * 1.4 + size * 0.7;
  }
  if (doc.length > 1) U.text(`Page ${Math.min(page, doc.length - 1) + 1} of ${doc.length}`, 360, 1310, 18, 'rgba(240,214,140,0.6)', UI, 600);
  const isLast = Math.min(page, doc.length - 1) >= doc.length - 1;
  U.button(DOC_BACK, 'Back', { size: 30 });
  U.button(DOC_NEXT, isLast ? 'Done' : 'Next', { primary: true, size: 30 });
  void opts;
}

function drawSettings(c, st, U) {
  const S = scaleOf(st);
  c.fillStyle = 'rgba(8,22,42,0.84)'; c.fillRect(0, 262, W, H - 262);
  U.panel(PANEL.x, 250, PANEL.w, 1150, 0.94);
  U.text('Settings', 360, 300, 60, '#f8efd2', FONT, 700, 'center', true);
  const on = (b) => (b ? 'On' : 'Off');
  const sub = (s) => (S > 1.6 ? undefined : s);
  U.button(SET_ROWS.sound, `Sound: ${on(st.sound)}`, { size: 30, sub: sub('Dice and checker clacks') });
  U.button(SET_ROWS.calm, `Reduced motion: ${on(st.calm)}`, { size: 30, sub: sub('Quicker moves, no bobbing') });
  U.button(SET_ROWS.set, `Checkers: ${SET_NAMES[st.set]}`, { size: 28, sub: sub('Tap to change') });
  U.button(SET_ROWS.auto, `Play forced moves for me: ${on(st.auto)}`, { size: 28, sub: sub('When only one move exists') });
  U.button(SET_TEXT.dec, 'A−', { size: 30, dim: st.textScaleIdx === 0 });
  U.button(SET_TEXT.inc, 'A+', { size: 30, dim: st.textScaleIdx === TEXT_SCALES.length - 1 });
  U.text(`Text size ${Math.round(S * 100)}%`, SET_TEXT.mid.x + SET_TEXT.mid.w / 2, SET_TEXT.mid.y + SET_TEXT.mid.h / 2 + 10, Math.round(26 * Math.min(S, 1.25)), '#f6ecd4', UI, 800);
  for (let i = 0; i < 2; i++) drawChecker(c, st.set, i, 300 + i * 120, 1000, 1.2);
  const sz = Math.round(24 * Math.min(S, 1.6));
  U.fitText('The sample text below grows with the setting.', 360, 1110, 560, sz, 'rgba(246,236,208,0.85)', UI, 600);
  U.button(PBACK, 'Back', { primary: true, size: 30 });
}

function drawDemoLimit(c, st, U) {
  c.fillStyle = 'rgba(8,22,42,0.86)'; c.fillRect(0, 0, W, H);
  U.panel(60, 480, 600, 460, 0.96);
  U.text('That is the free preview', 360, 570, 46, '#f8efd2', FONT, 700);
  U.wrap('The full Tavli is on iPhone and Android: all three games, the Greek match, four computer levels, Watch and Learn and no ads.', 360, 640, 26, 500, '#f6ecd4', 34);
  U.button({ x: 140, y: 820, w: 440, h: 76 }, 'Back to the menu', { primary: true, size: 28 });
}

// ---- pause overlay ------------------------------------------------------------------------------------------------------------
function drawPause(c, st, U) {
  c.fillStyle = 'rgba(4,12,26,0.72)'; c.fillRect(0, 0, W, H);
  U.panel(60, 470, 600, 520, 0.97);
  U.text('Paused', 360, 570, 76, '#f8efd2', FONT, 700, 'center', true);
  U.text(st.autoMode ? 'Watch & Learn is frozen exactly where it stopped.' : 'The game is frozen exactly where it stopped.', 360, 610, 21, 'rgba(240,214,140,0.85)', UI, 600);
  U.button(PAUSE.resume, 'Resume', { primary: true, size: 32 });
  U.button(PAUSE.restart, st.autoMode ? 'Watch again' : 'Abandon game', { size: 26 });
  U.button(PAUSE.menu, 'Menu', { size: 26 });
}

// ---- the board scenes ---------------------------------------------------------------------------------------------------------
function homeBars(c, st) {
  const v = st.g.v;
  const bar = (x, y0, y1, col) => { c.fillStyle = col; rrect(c, x, y0, 5, y1 - y0, 2.5); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke(); };
  bar(CH.x0 - 9, IN.y0 + 6 * SLOT + 6, IN.y1 - 6, '#f4ecd2');                       // your home: points 1-6 (left column, bottom)
  if (v === FEVGA) bar(CH.x1 + 4, IN.y0 + 6, IN.y0 + 6 * SLOT - 6, '#3a2d22');        // the rival's home: points 13-18
  else bar(CH.x1 + 4, IN.y0 + 6 * SLOT + 6, IN.y1 - 6, '#3a2d22');                  // points 19-24
  if (v === FEVGA) {
    c.font = `800 11px ${UI}`; c.textAlign = 'center';
    for (const [i, own] of [[23, 0], [11, 1]]) { const gm = pointGeom(i), x = gm.edge + gm.dir * (PLEN + 15); c.fillStyle = 'rgba(255,240,200,0.8)'; c.fillText('HEAD', x, gm.y + 17); void own; }
  }
}

function drawBoardScene(c, st, U) {
  const g = st.g, set = st.set, sc = st.scene, t = st.t, calm = st.calm, a = st.anim, v = g.v;
  const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5);
  const S = Math.min(scaleOf(st), 1.5);

  // ---- header --------------------------------------------------------------------------------------------------------------
  U.text(VARIANTS[v].name, 360, 70, 62, '#f8efd2', FONT, 700, 'center', true);
  U.text(GREEK_NAMES[v], 360, 104, 24, '#e8c56a', GREEK, 700);
  if (!st.shot || true) {
    const bt = BTN.pause, over = sc === 'over';
    if (!over) {
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(bt.x + 42, bt.y + 48, 38, 0, TAU); c.fill();
      c.fillStyle = lin(c, 0, bt.y, 0, bt.y + 84, [[0, '#1d5a92'], [1, '#154a7c']]); c.beginPath(); c.arc(bt.x + 42, bt.y + 42, 38, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(232,200,120,0.7)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#fbeecb'; rrect(c, bt.x + 28, bt.y + 26, 10, 32, 3); c.fill(); rrect(c, bt.x + 46, bt.y + 26, 10, 32, 3); c.fill();
    }
  }
  const twoUp = st.two || st.autoMode;
  U.text(`${twoUp ? 'Light' : 'You'}  ${pips(g, 0)}`, 700, 50, 22, '#f6ecd0', UI, 700, 'right');
  U.text(`${twoUp ? 'Dark' : 'Rival'}  ${pips(g, 1)}`, 700, 78, 22, '#e8b98a', UI, 700, 'right');
  U.text('pips to go', 700, 102, 16, 'rgba(246,236,208,0.6)', UI, 600, 'right');
  const M = st.match;
  if (M) {
    const lab = M.mode === 3 ? `Match to ${M.target}  ·  ${twoUp ? 'Light' : 'You'} ${M.score[0]} – ${M.score[1]} ${twoUp ? 'Dark' : 'Rival'}  ·  game ${M.n + 1}` : 'Single game';
    U.fitText(st.autoMode ? `Watch & Learn  ·  think time ${THINK_STEPS[st.autoThinkIdx]}s  ·  ${lab}` : lab, 360, 136, 680, 20, '#e8c46a', UI, 800);
  }
  // message banner
  let msg = st.msg?.text ?? st.status ?? '';
  const bx = 24, by = 146, bw = 672, bh = 64;
  U.panel(bx, by, bw, bh, 0.88);
  let size = Math.round(22 * S), ls = U.wrapLines(msg, size, bw - 36);
  while (ls.length > 2 && size > 14) { size -= 1; ls = U.wrapLines(msg, size, bw - 36); }
  while (ls.length * size * 1.24 > bh - 10 && size > 13) { size -= 1; ls = U.wrapLines(msg, size, bw - 36); }
  const lh = size * 1.22, y0 = by + bh / 2 - ((ls.length - 1) * lh) / 2 + size * 0.34;
  ls.forEach((l, i) => U.text(l, 360, y0 + i * lh, size, '#fff3d6', UI, 600));

  // ---- trays ----------------------------------------------------------------------------------------------------------------
  for (let s = 0; s < 2; s++) {
    let n = g.off[s]; if (a && a.hide && a.hide.kind === 'off' && a.hide.side === s && !a.done) n -= 1;
    for (let k = 0; k < n; k++) { const p = offPos(s, k); drawChip(c, set, s, p.x, p.y); }
    const T = s === 0 ? TRAY.me : TRAY.opp;
    if (!g.off[s] && !(s === 0 && st.dests.some((d) => d.to === OFF))) U.text(twoUp ? `${s ? 'Dark' : 'Light'} bear-off tray` : s === 0 ? 'Your bear-off tray' : 'Rival’s bear-off tray', 360, T.y + T.h / 2 + 6, 17, 'rgba(255,235,190,0.34)', UI, 700);
    if (g.off[s] && g.off[s] < 10) U.text(`${g.off[s]} off`, T.x + T.w - 14, T.y + T.h / 2 + 8, 22, 'rgba(255,240,200,0.92)', UI, 700, 'right', true);
  }
  if (st.dests.some((d) => d.to === OFF)) {
    const T = TRAY.me; c.fillStyle = `rgba(255,222,120,${0.16 + pulse * 0.2})`; rrect(c, T.x - 4, T.y - 4, T.w + 8, T.h + 8, 12); c.fill();
    c.strokeStyle = `rgba(255,232,140,${0.6 + pulse * 0.4})`; c.lineWidth = 2.5; c.stroke();
    if (g.off[0] < 12) U.text('BEAR OFF HERE', 360, T.y + T.h / 2 + 8, 22, 'rgba(255,244,210,0.95)', UI, 800, 'center', true);
  }
  homeBars(c, st);

  // ---- highlights on the points -----------------------------------------------------------------------------------------------
  const tri = (idx) => {
    const gm = pointGeom(idx), y0 = gm.y - SLOT / 2 + 3, y1 = gm.y + SLOT / 2 - 3, tx = gm.edge + gm.dir * PLEN;
    c.beginPath(); c.moveTo(gm.edge, y0); c.lineTo(tx, gm.y - 1.5); c.lineTo(tx, gm.y + 1.5); c.lineTo(gm.edge, y1); c.closePath();
  };
  for (const d of st.dests) if (d.to < 24) { tri(d.to); c.fillStyle = `rgba(255,222,120,${0.2 + pulse * 0.22})`; c.fill(); c.strokeStyle = `rgba(255,236,150,${0.55 + pulse * 0.4})`; c.lineWidth = 2; c.stroke(); }

  // ---- checkers ---------------------------------------------------------------------------------------------------------------
  const dragFrom = st.drag && st.drag.on ? st.drag.from : -9;
  const sources = new Set(st.sources || []);
  const drawStack = (idx) => {
    const val = g.board[idx]; if (!val) return;
    const side = val > 0 ? 0 : 1, nTop = Math.abs(val), pinS = g.pin[idx], H_ = nTop + (pinS ? 1 : 0), base = pinS ? 1 : 0;
    if (pinS) { const p0 = stackPos(idx, 0, H_, true); drawChecker(c, set, pinS - 1, p0.x, p0.y, 1); }
    for (let k = 0; k < nTop; k++) {
      const kk = k + base;
      if (k === nTop - 1 && a && !a.done && a.hide && a.hide.kind === 'pt' && a.hide.idx === idx && a.hide.side === side) continue;
      if (dragFrom === idx && k === nTop - 1) continue;
      const p = stackPos(idx, kk, H_, !!pinS), topC = k === nTop - 1;
      const lift = topC && st.sel === idx ? 12 : 0;
      drawChecker(c, set, side, p.x, p.y, 1, lift);
      if (topC && H_ > 5) badge(c, p.x, p.y, H_);
      if (topC && sources.has(idx) && st.sel !== idx && !calm && !st.drag?.on) { c.strokeStyle = `rgba(255,232,140,${0.25 + pulse * 0.5})`; c.lineWidth = 2.5; c.beginPath(); c.arc(p.x, p.y, R + 3, 0, TAU); c.stroke(); }
      if (topC && st.sel === idx) { c.strokeStyle = 'rgba(255,240,160,0.95)'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y - lift, R + 3, 0, TAU); c.stroke(); }
    }
    if (pinS) { const p0 = stackPos(idx, 0, H_, true), g0 = pointGeom(idx); drawLock(c, p0.x - g0.dir * 18, p0.y + 22, 0.9); }
  };
  for (let i = 0; i < 24; i++) drawStack(i);
  if (a && !a.done && a.ghost && a.t < a.dur) drawChecker(c, set, a.ghost.side, a.ghost.pos.x, a.ghost.pos.y, 1);
  for (let s = 0; s < 2; s++) {
    const n = g.bar[s], hideOne = a && !a.done && a.hit && a.hit.side === s ? 1 : 0;
    for (let k = 0; k < n - hideOne; k++) {
      if (st.drag?.on && dragFrom === BAR && s === 0 && k === n - 1) continue;
      const p = barPos(s, k, n), topC = k === n - 1;
      drawChecker(c, set, s, p.x, p.y, 1, topC && st.sel === BAR && s === 0 ? 12 : 0);
      if (topC && n > 5) badge(c, p.x, p.y, n);
      if (topC && s === 0 && sources.has(BAR)) { c.strokeStyle = `rgba(255,232,140,${0.4 + pulse * 0.5})`; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y - (st.sel === BAR ? 12 : 0), R + 3, 0, TAU); c.stroke(); }
    }
  }
  if (v === PORTES && g.bar[0] + g.bar[1] > 0) U.text('BAR', CH.cx, MID + 4, 15, 'rgba(240,214,140,0.75)', UI, 800);
  // landing markers: where the checker would sit, and HIT / PIN tags
  for (const d of st.dests) if (d.to < 24) {
    const p = landSlot(g, 0, d.to);
    c.strokeStyle = `rgba(255,240,170,${0.6 + pulse * 0.4})`; c.lineWidth = 3; c.setLineDash([7, 6]); c.beginPath(); c.arc(p.x, p.y, R - 2, 0, TAU); c.stroke(); c.setLineDash([]);
    const dd = (st.legal || []).find((x) => x.from === d.from && x.to === d.to);
    if (dd && dd.hit) { c.fillStyle = 'rgba(255,100,70,0.95)'; c.font = `800 15px ${UI}`; c.textAlign = 'center'; c.fillText('HIT', p.x, p.y + 5); }
    if (dd && dd.pin) { c.fillStyle = 'rgba(255,214,110,0.98)'; c.font = `800 15px ${UI}`; c.textAlign = 'center'; c.fillText('PIN', p.x, p.y + 5); }
  }
  const ring = (f, to, col = '#7dffb0') => {
    c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(f.x, f.y, R + 5, 0, TAU); c.stroke();
    c.setLineDash([10, 8]); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(to.x, to.y); c.stroke(); c.setLineDash([]);
    c.fillStyle = `rgba(125,255,176,${0.25 + pulse * 0.3})`; c.beginPath(); c.arc(to.x, to.y, R + 4, 0, TAU); c.fill(); c.strokeStyle = col; c.beginPath(); c.arc(to.x, to.y, R + 4, 0, TAU); c.stroke();
  };
  // Auto Play's REVEAL: every step of the move about to be played
  if (st.autoReveal) { const { side, steps } = st.autoReveal; for (const h of steps) ring(topSlot(g, side, h.from), landSlot(g, side, h.to)); }
  if (st.hint) { const h = st.hint; ring(topSlot(g, 0, h.from), landSlot(g, 0, h.to)); }
  if (st.drag && st.drag.on) drawChecker(c, set, 0, st.drag.x, st.drag.y, 1.14, 16);
  if (a && !a.done) drawMover(c, st, a, set);
  if (st.cursorOn && st.cursor != null) { const p = cursorPos(st.cursor, g); c.strokeStyle = '#7de0ff'; c.lineWidth = 3.5; c.setLineDash([6, 5]); c.beginPath(); c.arc(p.x, p.y, R + 8, 0, TAU); c.stroke(); c.setLineDash([]); }
  drawFx(c, st);

  // ---- dice and buttons ---------------------------------------------------------------------------------------------------------
  drawDice(c, st, U, pulse);
  if (st.autoMode) {
    U.button(BTN.aMenu, 'Menu', { size: 24 });
    U.button(BTN.aPause, 'Pause', { size: 24 });
    U.button(BTN.aLess, '− Think', { size: 22, dim: st.autoThinkIdx <= 0 });
    U.button(BTN.aMore, 'Think +', { size: 22, dim: st.autoThinkIdx >= THINK_STEPS.length - 1 });
    if (st.autoPhase === 'think') U.text(`Thinking… ${Math.ceil(st.autoTimer)}s`, 360, 1466, 18, 'rgba(255,230,170,0.9)', UI, 700);
    if (st.autoPhase === 'reveal') U.text('Here is the move it chose', 360, 1466, 18, '#9dffc4', UI, 700);
  } else if (sc !== 'over') {
    U.button(BTN.menu, 'Menu', { size: 26 });
    U.button(BTN.undo, 'Undo', { size: 26, dim: !st.canUndo });
    U.button(BTN.hint, `Hint (${st.hintsLeft})`, { size: 26, dim: st.hintsLeft <= 0 });
  }
  if (st.thinking && !calm && !st.autoMode) { const n = 1 + (Math.floor(t * 3) % 3); U.text('Thinking' + '.'.repeat(n), 360, 1466, 18, 'rgba(255,230,170,0.85)', UI, 700); }
  if (sc === 'over') drawOver(c, st, U);
}

// where the top checker of a stack / bar currently sits, and where a checker of `side` would land on `to`
function topSlot(g, side, from) {
  if (from === BAR) return barPos(side, Math.max(0, g.bar[side] - 1), Math.max(1, g.bar[side]));
  const H_ = Math.max(1, height(g, from));
  return stackPos(from, H_ - 1, H_, !!g.pin[from]);
}
function landSlot(g, side, to) {
  if (to === OFF) return offPos(side, g.off[side]);
  const own = top(g, side, to), opp = top(g, 1 - side, to);
  if (opp === 1 && g.v === PLAKOTO && !g.pin[to]) return stackPos(to, 1, 2, true);       // pins the lone checker: sits on top of it
  if (opp === 1 && g.v === PORTES) return stackPos(to, 0, 1);                           // a hit replaces it
  const n = own + (g.pin[to] ? 1 : 0);
  return stackPos(to, n, n + 1, !!g.pin[to]);
}
export { topSlot, landSlot };

function badge(c, x, y, n) {
  c.fillStyle = 'rgba(8,22,44,0.88)'; c.beginPath(); c.arc(x, y, 15, 0, TAU); c.fill(); c.strokeStyle = '#e6c56a'; c.lineWidth = 1.5; c.stroke();
  c.font = `800 18px ${UI}`; c.textAlign = 'center'; c.fillStyle = '#fff1c8'; c.fillText(String(n), x, y + 6.5);
}
function cursorPos(cu, g) {
  if (cu === BAR) return barPos(0, 0, 1);
  if (cu === OFF) return { x: 360, y: TRAY.me.y + TRAY.me.h / 2 };
  return topSlot(g, 0, cu);
}

function drawMover(c, st, a, set) {
  if (a.t < a.dur) {
    const f = Math.min(1, a.t / a.dur), e = a.kind === 'refuse' ? refuseCurve(f, a) : ease(f);
    const shake = a.kind === 'refuse' && !st.calm && f > 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 : 0;
    const x = a.from.x + (a.to.x - a.from.x) * e + shake, y = a.from.y + (a.to.y - a.from.y) * e;
    const lift = Math.sin(Math.PI * Math.min(1, f)) * (a.kind === 'refuse' ? 14 : 30) + 8;
    drawChecker(c, set, a.side, x, y, 1.06, lift);
    if (a.kind === 'move' && (a.hit || a.pin) && f > 0.86) { c.strokeStyle = `rgba(255,220,120,${(f - 0.86) * 7})`; c.lineWidth = 3; c.beginPath(); c.arc(a.to.x, a.to.y, R * (1 + (f - 0.86) * 5), 0, TAU); c.stroke(); }
  } else if (a.hit) {
    const f = Math.min(1, (a.t - a.dur) / a.hitDur), e = ease(f), h = a.hit;
    const x = h.from.x + (h.to.x - h.from.x) * e, y = h.from.y + (h.to.y - h.from.y) * e;
    drawChecker(c, set, h.side, x, y, 1.02, Math.sin(Math.PI * f) * 44 + 4);
    c.strokeStyle = `rgba(255,220,120,${0.7 * (1 - f)})`; c.lineWidth = 3; c.beginPath(); c.arc(a.to.x, a.to.y, R * (1.4 + f * 1.2), 0, TAU); c.stroke();
  }
}
const refuseCurve = (f) => { const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4; return ease(out) * 0.7; };

// little bursts for hits, pins, bearing off and wins (positions and angles are hashed from a counter: deterministic)
function drawFx(c, st) {
  for (const f of st.fx || []) {
    const u = f.t / f.dur; if (u >= 1) continue;
    if (f.kind === 'ring') { c.strokeStyle = `rgba(${f.col},${0.8 * (1 - u)})`; c.lineWidth = 4 * (1 - u) + 1; c.beginPath(); c.arc(f.x, f.y, 14 + u * 70, 0, TAU); c.stroke(); continue; }
    for (let i = 0; i < 12; i++) {
      const ang = hash(f.seed + i) * TAU, sp = 40 + hash(f.seed + 50 + i) * 90, d = sp * ease(u);
      c.fillStyle = `rgba(${f.col},${0.9 * (1 - u)})`; c.beginPath(); c.arc(f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d - 20 * u, 4 * (1 - u) + 1, 0, TAU); c.fill();
    }
  }
}

// ---- dice -------------------------------------------------------------------------------------------------------------------------
function drawDice(c, st, U, pulse) {
  const d = st.dice;
  if (!d.vals) {
    for (let i = 0; i < 2; i++) drawDie(c, [4, 2][i], REST[i], DICE.cy, { rot: i ? 0.12 : -0.1, ivory: st.g.turn === 0 || st.two });
    if (st.phase === 'roll') {
      c.fillStyle = `rgba(255,225,130,${0.14 + pulse * 0.16})`; rrect(c, DICE.x + 12, DICE.y + 12, DICE.w - 24, DICE.h - 24, 10); c.fill();
      U.text(st.g.turn === 0 || st.two ? 'TAP THE DICE TO ROLL' : '', 470, DICE.cy - 4, 22, '#ffe9a8', UI, 800, 'left');
      U.text(st.two ? (st.g.turn === 0 ? 'Light to roll' : 'Dark to roll') : 'or press Space', 470, DICE.cy + 22, 17, 'rgba(255,233,168,0.8)', UI, 600, 'left');
    }
    return;
  }
  const roll = d.roll, vals = d.vals;
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
}

function drawOver(c, st, U) {
  const S = Math.min(scaleOf(st), 2), res = st.result;
  c.fillStyle = 'rgba(4,12,26,0.66)'; c.fillRect(0, 262, W, 1040);
  U.panel(40, 400, 640, 780, 0.97);
  U.fitText(res.title, 360, 490, 580, Math.round(64 * Math.min(S, 1.2)), '#f8efd2', FONT, 700, 'center', true);
  const bs = Math.round(25 * S);
  const n = U.wrap(res.body, 360, 560, bs, 540, '#f6ecd4', bs * 1.32);
  let y = 560 + n * bs * 1.32 + 24;
  if (res.matchLine) { U.wrap(res.matchLine, 360, y, Math.round(26 * Math.min(S, 1.5)), 540, '#e8c46a', 34, 'center', 800); }
  if (res.w >= 0 && Math.max(y + 90, 790) + 100 < OVER.again.y) { const gy = Math.max(y + 90, 790); drawChecker(c, st.set, res.w, 360, gy, 1.7); if (!st.calm) { c.strokeStyle = `rgba(255,224,140,${0.35 + 0.25 * Math.sin(st.t * 3)})`; c.lineWidth = 4; c.beginPath(); c.arc(360, gy, 76, 0, TAU); c.stroke(); } }
  const again = res.next ? `Next: ${res.next}` : res.matchOver ? 'New match' : 'Play again';
  U.button(OVER.again, again, { primary: true, size: 30 });
  U.button(OVER.menu, 'Menu', { size: 26 });
  U.button(OVER.share, 'Share', { size: 26 });
  void y;
}
