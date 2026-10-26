// All drawing for the game. Pure: reads `state`, never mutates it (game.js owns every mutation). Geometry comes from layout.js
// (live bindings, re-laid out for the current screen shape), so every screen works in portrait and in landscape.
import {
  W, H, SQ, FRAME, BOARD, GX, GY, HDR, PLATE_TOP, PLATE_BOT, INFO, MSG, BTN, TITLE_SOUND, titleRows,
  TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, REF_PANEL, RESULT, LIMIT, SETTINGS_ROW, SETTINGS_BACK, SETTINGS_TITLE, SETTINGS_ROWS, settingsTall, AUTO, LEARN_BAR, THINK_STEPS,
  SIBLINGS, HIST, setHistText, chipRect, squareXY, squareCentre, histSquareCentre, LAY,
} from './layout.js';
import { host } from './layout.js';
import { drawMoreLine, drawLockupImage } from './brand.js';
import { PADATI, ASHVA, GAJA, RATHA, MANTRI, RAJA, WHITE, BLACK, ANCIENT, MODERN, SIDE_NAME, typeName, TYPE_NAME, MODERN_NAME, moveRule, genInto, mFrom, mTo, sqName } from './rules.js';
import { LEVELS } from './engine.js';
import {
  FONT, DISPLAY, themeOf, TAU, clamp, easeOut, easeInOut, rr, drawBackdrop, drawBoard, drawPiece, boardBox, localSq, baked, paintBoard,
  wrapLines, fitFont, textBlock, setPress, drawButton, drawPanel, drawIcon, lcg, petal, cuspedArch,
} from './art.js';
import { page as pageContent } from './content.js';
import { v3, sprites } from './v3.js';
import { LESSONS } from './lessons.js';

const GOLD = '#ffe08a', RED = '#d6342a', SAFFRON = '#f1a638';
const PK = (S) => S / 91;           // sprite units -> pixels for a token that fills a square
const LIGHT = '#fbeccb';            // text drawn straight on the dark backdrop

function drawArrow(ctx, a, b, color, wd, head = 16, gap = 22) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < gap * 2 + 6) return;
  const ux = dx / len, uy = dy / len, sx = a.x + ux * gap, sy = a.y + uy * gap, ex = b.x - ux * gap, ey = b.y - uy * gap;
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex - ux * head * 0.6, ey - uy * head * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - ux * head - uy * head * 0.55, ey - uy * head + ux * head * 0.55); ctx.lineTo(ex - ux * head + uy * head * 0.55, ey - uy * head - ux * head * 0.55); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function ring(ctx, p, r, color, wd, alpha = 1, dash = null) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = wd; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.restore();
}
function sqFill(ctx, s, flip, color) { const q = squareXY(s, flip); ctx.fillStyle = color; ctx.fillRect(q.x, q.y, SQ, SQ); }
function dot(ctx, c, r, pulse) {
  ctx.beginPath(); ctx.arc(c.x, c.y, r + pulse * 1.5, 0, TAU); ctx.fillStyle = 'rgba(255,248,224,0.92)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(60,20,5,0.7)'; ctx.stroke();
}

// ---- the board scene -----------------------------------------------------------------------------------------------------
// 3D mode: the board, pieces and highlights are the WebGL scene behind this canvas; the 2D layer adds rank/file labels and floating text.
function drawOverlay3d(ctx, state) {
  const flip = state.flip, a = v3.pt(0, 0.52, 0), b = v3.pt(1, 0.52, 0), u = Math.abs(b.x - a.x) || 40, px = Math.round(clamp(u * 0.36, 13, 34));
  ctx.save(); ctx.font = `700 ${px}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px * 0.2); ctx.strokeStyle = 'rgba(30,10,0,0.85)'; ctx.fillStyle = '#ffe3a0';
  const put = (t, p) => { ctx.strokeText(t, p.x, p.y); ctx.fillText(t, p.x, p.y); };
  for (let f = 0; f < 8; f++) { const x = (flip ? 7 - f : f) - 3.5; put(String.fromCharCode(97 + f), v3.pt(x, 0.52, flip ? -4.24 : 4.24)); }
  for (let r = 0; r < 8; r++) { const z = flip ? r - 3.5 : 3.5 - r; put(String(r + 1), v3.pt(flip ? 4.24 : -4.24, 0.52, z)); }
  ctx.restore();
  if (state.kb && state.cursor >= 0) void 0;
  for (const f of state.floats) {
    const kk = f.t / 1.1; ctx.save(); ctx.globalAlpha = 1 - kk * kk; ctx.font = `700 ${40 + (1 - kk) * 8}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(30,8,0,0.8)';
    ctx.strokeText(f.text, f.x, f.y - kk * 70); ctx.fillStyle = f.c || GOLD; ctx.fillText(f.text, f.x, f.y - kk * 70); ctx.restore();
  }
}
function drawBoardScene(ctx, state, T) {
  if (v3.on && v3.pt) { drawOverlay3d(ctx, state); return; }
  const flip = state.flip, t = state.t, pulse = 0.5 + 0.5 * Math.sin(t * 5), an = state.anim, k = PK(SQ);
  drawBoard(ctx, state.theme, BOARD.x, BOARD.y, { S: SQ, F: FRAME, labels: true, flip });
  // last move
  if (state.trail) { sqFill(ctx, state.trail.from, flip, 'rgba(255,225,130,0.2)'); sqFill(ctx, state.trail.to, flip, 'rgba(255,225,130,0.34)'); }
  // check
  if (state.checkSq >= 0) { const c = squareCentre(state.checkSq, flip), rg = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, SQ * 0.85); rg.addColorStop(0, `rgba(255,50,40,${0.6 + 0.25 * pulse})`); rg.addColorStop(1, 'rgba(255,50,40,0)'); ctx.fillStyle = rg; ctx.fillRect(c.x - SQ, c.y - SQ, SQ * 2, SQ * 2); }
  // threats
  if (state.danger && state.threatSet) for (const s of state.threatSet) ring(ctx, squareCentre(s, flip), SQ * 0.45 + pulse * 3, RED, 4, 0.7 + 0.3 * pulse, [9, 7]);
  // selection and legal targets
  if (state.sel >= 0) { sqFill(ctx, state.sel, flip, 'rgba(255,225,130,0.34)'); const q = squareXY(state.sel, flip); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.strokeRect(q.x + 3, q.y + 3, SQ - 6, SQ - 6); }
  for (const tg of state.targets || []) {
    const c = squareCentre(tg.to, flip);
    if (tg.cap) { ring(ctx, c, SQ * 0.44, RED, 5, 0.95); ctx.fillStyle = 'rgba(214,52,42,0.22)'; ctx.beginPath(); ctx.arc(c.x, c.y, SQ * 0.44, 0, TAU); ctx.fill(); }
    else dot(ctx, c, SQ * 0.15, pulse);
    if (tg.promo) { ctx.save(); ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(c.x + SQ * 0.3, c.y - SQ * 0.3, SQ * 0.17, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a1604'; ctx.font = `700 ${Math.round(SQ * 0.26)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', c.x + SQ * 0.3, c.y - SQ * 0.3 + 1); ctx.restore(); }
  }
  // reveal (Watch & Learn): every piece that could move, then the chosen move
  if (state.reveal) {
    const rv = state.reveal;
    for (const s of rv.movable) ring(ctx, squareCentre(s, flip), SQ * 0.46, 'rgba(255,230,160,0.7)', 3.5, 1, [9, 8]);
    ring(ctx, squareCentre(rv.from, flip), SQ * 0.48, GOLD, 6, 0.95);
    for (const tg of rv.targets) { if (tg.to === rv.to) continue; ring(ctx, squareCentre(tg.to, flip), tg.cap ? SQ * 0.4 : 10, 'rgba(255,245,210,0.85)', 3.5); }
    const a = squareCentre(rv.from, flip), b = squareCentre(rv.to, flip);
    drawArrow(ctx, a, b, GOLD, 9, 22, 26);
    ring(ctx, b, SQ * 0.45 + pulse * 3, GOLD, 5, 0.95);
  }
  // hint
  if (state.hint) {
    const a = squareCentre(state.hint.from, flip), b = squareCentre(state.hint.to, flip);
    ring(ctx, a, SQ * 0.48, GOLD, 5, 0.95); drawArrow(ctx, a, b, GOLD, 9, 22, 26); ring(ctx, b, SQ * 0.45 + pulse * 3, GOLD, 4, 0.9, [8, 6]);
  }
  // pieces, drawn from the top of the screen to the bottom so lower tokens overlap higher ones
  const vb = state.vb, hideFrom = an ? an.from : -1, dragSq = state.drag && state.drag.moved ? state.drag.sq : -1;
  const victimGone = an && an.t > an.slide;
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const f = flip ? 7 - col : col, r = flip ? row : 7 - row, s = r * 8 + f, p = vb[s];
    if (!p || s === hideFrom || s === dragSq) continue;
    const c = squareCentre(s, flip), type = p > 0 ? p : -p, side = p > 0 ? WHITE : BLACK, o = {};
    if (state.sel === s) { o.lift = 1; o.glow = 'rgba(255,224,150,0.9)'; }
    if (an && an.to === s && victimGone) { const kk = easeOut((an.t - an.slide) / an.pop); o.scale = Math.max(0, 1 - kk); o.alpha = 1 - kk * 0.8; }
    if (an && an.to === s && an.t > an.slide && !an.cap) continue;
    drawPiece(ctx, type, side, c.x, c.y + SQ * 0.04, k, o);
  }
  // the moving piece
  if (an) {
    const a = squareCentre(an.from, flip), b = squareCentre(an.to, flip), kk = clamp(an.t / an.slide, 0, 1), e = easeInOut(kk), lift = Math.sin(Math.PI * kk);
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    if (an.t < an.slide) { ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,224,150,0.3)'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); }
    const type = an.promo && kk > 0.98 ? MANTRI : an.type;
    const pop = an.t >= an.slide && an.promo ? 1 + 0.18 * Math.sin(clamp((an.t - an.slide) / 0.3, 0, 1) * Math.PI) : 1;
    drawPiece(ctx, type, an.side, x, y + SQ * 0.04, k, { lift: lift * 1.3, scale: pop * (1 + lift * 0.06) });
  }
  if (state.drag && state.drag.moved) { const p = state.vb[state.drag.sq]; drawPiece(ctx, Math.abs(p), p > 0 ? WHITE : BLACK, state.drag.x, state.drag.y, k * 1.1, { lift: 1.3, glow: 'rgba(255,224,150,0.8)' }); }
  if (state.kb && state.cursor >= 0) { const q = squareXY(state.cursor, flip); ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.85; ctx.strokeRect(q.x + 4, q.y + 4, SQ - 8, SQ - 8); ctx.restore(); }
  for (const r of state.rings) { const kk = r.t / 0.55; ring(ctx, { x: r.x, y: r.y }, 20 + kk * 80, r.c || GOLD, 6 * (1 - kk) + 1, 1 - kk); }
  for (const q of state.parts) { const kk = q.t / q.max; ctx.fillStyle = `rgba(${q.c},${1 - kk})`; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - kk * 0.5), 0, TAU); ctx.fill(); }
  for (const f of state.floats) {
    const kk = f.t / 1.1; ctx.save(); ctx.globalAlpha = 1 - kk * kk; ctx.font = `700 ${40 + (1 - kk) * 8}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(30,8,0,0.8)';
    ctx.strokeText(f.text, f.x, f.y - kk * 70); ctx.fillStyle = f.c || GOLD; ctx.fillText(f.text, f.x, f.y - kk * 70); ctx.restore();
  }
  void T;
}

// ---- header, plates, strips, buttons ------------------------------------------------------------------------------------
function header(ctx, state, T, titleText) {
  drawButton(ctx, HDR.menu, 'Menu', T, { px: 30 });
  const S = HDR.sound;
  if (S.w < 120) { drawButton(ctx, S, '', T); drawIcon(ctx, state.sound ? 'sound' : 'mute', S.x + S.w / 2 - 2, S.y + S.h / 2, Math.min(42, S.h * 0.5), T.btnText); }
  else drawButton(ctx, S, state.sound ? 'Sound On' : 'Sound Off', T, { px: 26 });
  if (HDR.title.w <= 20) return;
  const txt = titleText || 'Chaturanga', r = HDR.title;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const px = fitFont(ctx, txt, 700, Math.min(54, Math.round(r.h * 0.7)), r.w - 52, 20, DISPLAY), tw = ctx.measureText(txt).width;
  const pw = Math.min(r.w, tw + 52), ph = Math.min(r.h, px * 1.3), px0 = r.x + r.w / 2 - pw / 2, py0 = r.y + r.h / 2 - ph / 2;
  rr(ctx, px0, py0, pw, ph, ph / 2); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  const g = ctx.createLinearGradient(0, py0, 0, py0 + ph); g.addColorStop(0, 'rgba(70,28,14,0.94)'); g.addColorStop(1, 'rgba(26,9,5,0.96)'); ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#d9a640'; ctx.stroke();
  rr(ctx, px0 + 5, py0 + 5, pw - 10, ph - 10, (ph - 10) / 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(240,205,130,0.4)'; ctx.stroke();
  ctx.fillStyle = '#ffe9a8'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 1; ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}
function capturedBy(state, side) {
  const out = [];
  for (const e of state.g.log) if (e.side === side && e.cap) out.push(Math.abs(e.cap));
  return out.sort((a, b) => b - a);
}
const MAT_VAL = [0, 1, 3, 3, 5, 2, 0];
// draw a sculpted piece sprite so that it fills a square of size S centred on (cx, cy) (2D fallback: the flat token)
function pieceFit(ctx, type, side, cx, cy, S, o = {}) {
  const img = sprites.ready ? sprites.img[`${type}:${side}`] : null;
  if (img) { ctx.drawImage(img, cx - S / 2, cy - 0.5 * S, S, S); return; }   // sprite frame centred on the figure's upper body
  drawPiece(ctx, type, side, cx, cy + S * 0.1, S / 190, o);
}
function medallion(ctx, cx, cy, d, side, type, glow) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, TAU);
  const g = ctx.createRadialGradient(cx - d * 0.15, cy - d * 0.2, d * 0.05, cx, cy, d * 0.55);
  if (side > 0) { g.addColorStop(0, '#7a5230'); g.addColorStop(1, '#2b160b'); } else { g.addColorStop(0, '#fff1cf'); g.addColorStop(1, '#c9a35f'); }
  ctx.fillStyle = g; ctx.shadowColor = glow ? 'rgba(255,190,80,0.9)' : 'rgba(0,0,0,0.5)'; ctx.shadowBlur = glow ? 16 : 7; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.save(); ctx.clip(); pieceFit(ctx, type, side, cx, cy + d * (type === RAJA ? 0.3 : type === PADATI ? 0.15 : 0.08), d * (type === RAJA ? 1.9 : 1.55)); ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, TAU); ctx.lineWidth = Math.max(2.5, d * 0.06); ctx.strokeStyle = glow ? '#ffd36a' : '#c9962f'; ctx.stroke();
  ctx.restore();
}
function plate(ctx, r, side, label, sub, active, T, state, thinking, noCaps) {
  drawPanel(ctx, r, T, { round: Math.min(24, r.h / 2) });
  if (active) { ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, Math.min(24, r.h / 2)); ctx.lineWidth = 4; ctx.strokeStyle = SAFFRON; ctx.shadowColor = 'rgba(255,170,60,0.8)'; ctx.shadowBlur = 16; ctx.stroke(); ctx.restore(); }
  const cy = r.y + r.h / 2, d = r.h * 0.84, mx = r.x + r.h * 0.5 + 6;
  const pulse = 0.5 + 0.5 * Math.sin(state.t * 5);
  medallion(ctx, mx, cy, d, side, RAJA, active);
  if (active) { ctx.save(); ctx.beginPath(); ctx.arc(mx + d * 0.36, cy - d * 0.36, Math.max(6, d * 0.14), 0, TAU); ctx.fillStyle = `rgba(255,${170 + 60 * pulse | 0},60,1)`; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#3a1604'; ctx.stroke(); ctx.restore(); }
  const x0 = mx + d / 2 + 16, caps = noCaps ? [] : capturedBy(state, side), foe = noCaps ? [] : capturedBy(state, -side);
  const mine = caps.reduce((a, t) => a + MAT_VAL[t], 0), theirs = foe.reduce((a, t) => a + MAT_VAL[t], 0), diff = mine - theirs;
  const csz = r.h * 0.62, n = caps.length, maxCapW = r.w * (r.w > 520 ? 0.36 : 0.3), diffW = diff > 0 ? csz * 0.95 : 0;
  const step = n > 1 ? Math.min(csz * 0.62, (maxCapW - csz) / (n - 1)) : 0, capW = n ? csz + step * (n - 1) : 0;
  const rightEdge = r.x + r.w - 18, capX0 = rightEdge - diffW - capW;
  const tw = (n ? capX0 : rightEdge) - x0 - 8;
  ctx.save(); ctx.fillStyle = T.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const subTxt = sub ? `${sub}${active && !state.g.result ? (thinking ? '  ·  thinking' : '  ·  to move') : ''}` : '';
  const lh = r.h * 0.3;
  fitFont(ctx, label, 700, Math.round(r.h * 0.4), tw, 14, DISPLAY); ctx.fillText(label, x0, cy - (subTxt ? lh * 0.62 : 0));
  if (subTxt) { ctx.fillStyle = active ? (T.dark ? '#ffd9a0' : '#8f1f17') : T.sub; fitFont(ctx, subTxt, active ? 700 : 400, Math.round(r.h * 0.27), tw, 11); ctx.fillText(subTxt, x0, cy + lh * 0.78); }
  ctx.restore();
  for (let i = 0; i < n; i++) pieceFit(ctx, caps[i], -side, capX0 + csz / 2 + i * step, cy - csz * 0.05, csz * 1.5);
  if (diff > 0) { ctx.save(); ctx.fillStyle = T.dark ? GOLD : '#8f1f17'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.round(r.h * 0.36)}px ${FONT}`; ctx.fillText(`+${diff}`, rightEdge, cy + 1); ctx.restore(); }
}
function names(state) {
  const top = state.flip ? WHITE : BLACK, bot = -top;
  const nm = (side) => {
    if (state.scene === 'auto') return [SIDE_NAME[side], `${LEVELS[state.apLevels[side === WHITE ? 0 : 1]].name} computer`];
    if (state.scene === 'learn') return [side === WHITE ? 'You' : 'Practice side', SIDE_NAME[side]];
    if (state.mode === 'ai') return side === state.human ? ['You', SIDE_NAME[side]] : [`${LEVELS[state.level].name} computer`, SIDE_NAME[side]];
    return [SIDE_NAME[side], 'Player'];
  };
  return { top, bot, topN: nm(top), botN: nm(bot) };
}
function plates(ctx, state, T) {
  const n = names(state), g = state.g;
  plate(ctx, PLATE_TOP, n.top, n.topN[0], n.topN[1], g.turn === n.top && !g.result, T, state, state.thinking && g.turn === n.top);
  plate(ctx, PLATE_BOT, n.bot, n.botN[0], n.botN[1], g.turn === n.bot && !g.result, T, state, state.thinking && g.turn === n.bot);
}
// The rule strip: the movement set in force, and the rule of the piece you tapped (or a tip).
const TIPS_A = ['The Gaja leaps two squares diagonally, over anything, and never changes colour.', 'A Padati that reaches the last rank can only become a Mantri.', 'In this ancient game a side with no legal move loses, so stalemate is a weapon.', 'A bare Raja loses: capture every enemy piece but the Raja to win.', 'The Mantri steps one square diagonally: weak, but safe near the Raja.', 'Tap Think to see a strong move and the reason for it.'];
const TIPS_M = ['The Queen slides in every direction: guard her well.', 'A Pawn may step two squares on its first move.', 'Modern set: stalemate is a draw, so do not stalemate a lone King by accident.', 'The Bishop slides diagonally and stays on one colour.', 'Tap Think to see a strong move and the reason for it.'];
function infoStrip(ctx, state, T) {
  if (INFO.h <= 8) return;
  drawPanel(ctx, INFO, T, { round: 20, alpha: 0.9 });
  const era = state.g.era, sel = state.sel >= 0 ? Math.abs(state.g.board[state.sel]) : 0;
  const head = era === ANCIENT ? 'ANCIENT CHATURANGA' : 'MODERN CHESS MOVES';
  let text;
  if (sel) text = `${typeName(sel, era)}: ${moveRule(sel, era).replace(/^An? [A-Za-z]+ /, '')}`;
  else { const tips = era === ANCIENT ? TIPS_A : TIPS_M; text = tips[Math.floor(state.t / 10) % tips.length]; }
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const x = INFO.x + 26, w = INFO.w - 52, h = INFO.h, padT = Math.max(14, h * 0.13);
  const hp = Math.max(12, Math.min(20, Math.round(h * 0.17)));
  ctx.fillStyle = T.hi; ctx.font = `700 ${hp}px ${FONT}`;
  const spaced = head.split('').join(' '); const hf = fitFont(ctx, spaced, 700, hp, w, 9); ctx.font = `700 ${hf}px ${FONT}`; ctx.fillText(spaced, x, INFO.y + padT + hp * 0.8);
  const bodyTop = INFO.y + padT + hp * 1.15 + 6, bodyH = INFO.y + h - 14 - bodyTop;
  ctx.fillStyle = T.ink; let px = Math.round(h * 0.26), lines;
  for (;;) { ctx.font = `400 ${px}px ${FONT}`; lines = wrapLines(ctx, text, w); if (lines.length * px * 1.2 <= bodyH || px <= 11) break; px--; }
  const maxL = Math.max(1, Math.floor(bodyH / (px * 1.2)));
  lines.slice(0, maxL).forEach((l, i) => ctx.fillText(l, x, bodyTop + px * 0.92 + i * px * 1.2));
  ctx.restore();
}
// the "move card": who moves what, from where to where, and why (Watch & Learn reveal and Think)
function phaseLabel(state) {
  const ap = state.ap, ph = ap && ap.phase;
  return state.apPaused ? 'PAUSED' : ph === 'think' ? `THINKING  ${Math.max(0, Math.ceil(ap.timer))}s` : ph === 'reveal' ? 'REVEAL' : ph === 'act' ? 'MOVING' : '';
}
function message(ctx, state, T) {
  drawPanel(ctx, MSG, T, { round: 22 });
  const m = state.msg, auto = state.scene === 'auto', sc = Math.min(TEXT_SCALES[state.textIdx], 1.6);
  const info = auto && state.reveal && !state.apPaused ? state.reveal : !auto && state.hint && state.hint.why && m && m.kind === 'good' ? state.hint : null;
  const x = MSG.x + 26, w = MSG.w - 52;
  ctx.save();
  let top = MSG.y + 14;
  if (auto) {
    const lab = phaseLabel(state);
    if (lab) {
      const px = Math.round(clamp(MSG.h * 0.15, 15, 22) * Math.min(sc, 1.3));
      ctx.font = `700 ${px}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = T.dark ? GOLD : '#8f1f17';
      const spaced = lab.split('').join(' '); ctx.fillText(spaced, x, top + px * 0.85);
      const live = state.ap && state.ap.phase === 'think' && !state.apPaused;
      if (live) { const bw = Math.min(w * 0.35, 200), bx = MSG.x + MSG.w - 26 - bw, by = top + px * 0.2, bh = Math.max(6, px * 0.4), kk = clamp(state.ap.timer / THINK_STEPS[state.thinkIdx], 0, 1);
        rr(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = 'rgba(80,30,10,0.25)'; ctx.fill(); rr(ctx, bx, by, Math.max(bh, bw * kk), bh, bh / 2); ctx.fillStyle = SAFFRON; ctx.fill(); }
      top += px * 1.25 + 4;
    }
  }
  const bottom = MSG.y + MSG.h - 12, avail = bottom - top;
  if (info && sc <= 1.5 && avail >= 56) {
    const mn = Math.ceil(14 / Math.max(0.3, host.px)), d = clamp(avail * 0.46, 34, 60), cy = top + d / 2 + 2, era = state.g.era;
    medallion(ctx, x + d / 2, cy, d, info.side, info.type, false);
    const ax = x + d + 14;
    const algebra = `${sqName(info.from)}  \u2192  ${sqName(info.to)}`;
    ctx.font = `700 ${Math.round(d * 0.5)}px ${FONT}`; const cw = ctx.measureText(algebra).width + 30, ch = d * 0.8;
    const cx0 = MSG.x + MSG.w - 26 - cw;
    rr(ctx, cx0, cy - ch / 2, cw, ch, ch / 2); ctx.fillStyle = '#2a0e08'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#d9a640'; ctx.stroke();
    ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(algebra, cx0 + cw / 2, cy + 1);
    ctx.textAlign = 'left'; ctx.fillStyle = T.ink;
    let nm = `${SIDE_NAME[info.side]}  \u00b7  ${typeName(info.type, era)}${info.cap ? `  takes ${typeName(info.cap, era)}` : ''}`;
    ctx.font = `700 ${mn}px ${DISPLAY}`; if (ctx.measureText(nm).width > cx0 - ax - 12) nm = typeName(info.type, era);
    fitFont(ctx, nm, 700, Math.max(mn, Math.round(d * 0.62)), cx0 - ax - 12, mn, DISPLAY); ctx.fillText(nm, ax, cy + 1);
    const wy = top + d + 12, wh = bottom - wy; let px = Math.max(mn, Math.round(clamp(wh * 0.5, 15, 28) * Math.min(sc, 1.2))), lines;
    ctx.fillStyle = T.ink; ctx.textBaseline = 'alphabetic';
    for (;;) { ctx.font = `400 ${px}px ${FONT}`; lines = wrapLines(ctx, info.why, w); if (lines.length * px * 1.18 <= wh || px <= mn) break; px--; }
    lines.slice(0, Math.max(1, Math.floor(wh / (px * 1.18)))).forEach((l, i) => ctx.fillText(l, x, wy + px * 0.95 + i * px * 1.18));
  } else if (m) {
    const col = m.kind === 'warn' ? (T.dark ? '#ffb4a0' : '#a3241a') : T.ink;
    ctx.fillStyle = col; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    let px = Math.round(28 * sc), lines;
    for (;;) { ctx.font = `400 ${px}px ${FONT}`; lines = wrapLines(ctx, m.text, w); if (lines.length * px * 1.2 <= avail || px <= 13) break; px -= 1; }
    const lh = px * 1.2, n = Math.min(lines.length, Math.max(1, Math.floor(avail / lh))), y0 = top + (avail - n * lh) / 2 + px * 0.88;
    lines.slice(0, n).forEach((l, i) => ctx.fillText(l, x, y0 + i * lh));
  }
  ctx.restore();
}
function iconButton(ctx, r, icon, label, T, o = {}) {
  drawButton(ctx, r, '', T, o);
  const col = o.primary ? T.accentText : T.btnText, isz = Math.min(34, r.h * 0.4);
  ctx.save(); if (o.disabled) ctx.globalAlpha = 0.45;
  drawIcon(ctx, icon, r.x + r.w / 2, r.y + r.h * 0.38, isz, col);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, label, 700, 24, r.w - 14, 11); ctx.fillText(label, r.x + r.w / 2, r.y + r.h * 0.78); ctx.restore();
}
function banner(ctx, state, T) {
  const b = state.banner; if (!b) return;
  const k = b.t / 1.5, a = k < 0.15 ? k / 0.15 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  const w = Math.min(540, BOARD.w - 24), h = Math.min(112, w * 0.21), cx = BOARD.x + BOARD.w / 2, x = cx - w / 2, y = BOARD.y + BOARD.h / 2 - h / 2 + (1 - easeOut(Math.min(k * 4, 1))) * 24;
  rr(ctx, x, y, w, h, 28); ctx.fillStyle = 'rgba(45,10,18,0.94)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = GOLD; ctx.stroke();
  ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fitFont(ctx, b.text, 700, Math.round(h * 0.5), w - 50, 20, DISPLAY); ctx.fillText(b.text, cx, y + h / 2 + 2);
  ctx.restore(); void T;
}

function renderPlay(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const g = state.g, ai = state.mode === 'ai', myTurn = state.canAct;
  header(ctx, state, T);
  plates(ctx, state, T);
  drawBoardScene(ctx, state, T);
  infoStrip(ctx, state, T);
  message(ctx, state, T);
  iconButton(ctx, BTN.undo, 'undo', 'Undo', T, { disabled: !state.canUndo });
  iconButton(ctx, BTN.hint, 'think', 'Think', T, { disabled: !ai || !myTurn || !!g.result || state.hintBusy });
  iconButton(ctx, BTN.threat, 'danger', 'Threats', T, { active: state.danger });
  iconButton(ctx, BTN.end, 'flag', ai ? 'Resign' : 'Draw', T, { disabled: !!g.result || (ai && !myTurn) });
  banner(ctx, state, T);
  if (g.result && state.overOpen) renderResult(ctx, state, T);
}

// ---- result overlay ---------------------------------------------------------------------------------------------------------
function resultText(state) {
  const r = state.g.result, ai = state.mode === 'ai' && state.scene !== 'auto', era = state.g.era;
  let title, sub;
  const draws = {
    stalemate: 'Stalemate: the side to move has no legal move and is not in check. In the modern set that is a draw.',
    bare: 'Both sides are down to a bare Raja. Neither can mate: a draw.', repetition: 'The same position came up three times: a draw.',
    fifty: 'Fifty moves each passed without a capture or a Padati move: a draw.', material: 'Neither side has enough pieces to mate: a draw.',
  };
  if (r.winner === 0) { title = r.why === 'stalemate' ? 'Stalemate' : 'A draw'; sub = r.why === 'agreed' ? 'Both players agreed to a draw.' : r.why === 'bare' && era === MODERN ? draws.material : draws[r.why] || 'A draw.'; }
  else {
    const won = ai ? r.winner === state.human : true, nm = SIDE_NAME[r.winner];
    title = state.scene === 'auto' ? `${nm} wins` : ai ? (won ? 'You win!' : 'You lose') : `${nm} wins`;
    if (r.why === 'resign') sub = 'You resigned this game.';
    else if (r.why === 'stalemate') sub = `Stalemate: ${SIDE_NAME[-r.winner]} has no legal move and is not in check. In the ancient game that side loses, so ${nm} wins.`;
    else if (r.why === 'bare') sub = `Bare Raja: ${SIDE_NAME[-r.winner]} has only its Raja left. In the ancient game that loses, so ${nm} wins.`;
    else sub = `Checkmate: the ${SIDE_NAME[-r.winner]} Raja has no way out. ${nm} wins.`;
  }
  return { title, sub };
}
function renderResult(ctx, state, T) {
  const { title, sub } = resultText(state), sc = TEXT_SCALES[state.textIdx], auto = state.scene === 'auto', P = RESULT.panel;
  ctx.save(); ctx.fillStyle = 'rgba(20,4,8,0.72)'; ctx.fillRect(0, 0, W, H);
  drawPanel(ctx, P, T, { round: 34 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const Z = RESULT.title, zx = Z.x + Z.w / 2;
  let tpx = Math.round(70 * Math.min(sc, 1.6)), tl;
  for (;;) { ctx.font = `700 ${tpx}px ${DISPLAY}`; tl = wrapLines(ctx, title, Z.w); if (tl.length * tpx * 1.1 <= Z.h || tpx <= 24) break; tpx -= 2; }
  ctx.fillStyle = T.dark ? GOLD : '#8f1f17'; tl.forEach((l, i) => ctx.fillText(l, zx, Z.y + tpx * 0.95 + i * tpx * 1.1));
  const A = RESULT.art, ax = A.x + A.w / 2, ks = clamp(A.h / 200, 0.7, 1.5), cy = A.y + A.h / 2, r = state.g.result;
  const rg = ctx.createRadialGradient(ax, cy, 10, ax, cy, 150 * ks); rg.addColorStop(0, 'rgba(255,200,90,0.55)'); rg.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = rg; ctx.fillRect(ax - 160 * ks, cy - 160 * ks, 320 * ks, 320 * ks);
  const sp = Math.sin(state.t * 2) * 3, tk = 1.5 * ks;
  if (r.winner === 0) { drawPiece(ctx, RAJA, WHITE, ax - 62 * ks, cy + sp, tk * 0.8); drawPiece(ctx, RAJA, BLACK, ax + 62 * ks, cy - sp, tk * 0.8); }
  else drawPiece(ctx, RAJA, r.winner, ax, cy + sp, tk, { glow: 'rgba(255,224,150,0.9)' });
  const S = RESULT.sub, sx = S.x + S.w / 2;
  let spx = Math.round(30 * sc), sl;
  for (;;) { ctx.font = `400 ${spx}px ${FONT}`; sl = wrapLines(ctx, sub, S.w); if (sl.length * spx * 1.25 <= S.h || spx <= 14) break; spx -= 1; }
  ctx.fillStyle = T.ink; sl.forEach((l, i) => ctx.fillText(l, sx, S.y + spx * 0.95 + i * spx * 1.25));
  drawButton(ctx, RESULT.again, auto ? 'Watch again' : 'Play again', T, { primary: true, px: 40 });
  drawButton(ctx, RESULT.menu, 'Menu', T, { px: 38 });
  if (!auto) {
    const L = RESULT.chipsLabel;
    ctx.fillStyle = T.sub; drawMoreLine(ctx, L.x + L.w / 2, L.y + 22, 21);
    SIBLINGS.forEach((sb, i) => drawButton(ctx, chipRect(i), sb.title, T, { px: 26 }));
  }
  drawButton(ctx, RESULT.dec, 'A-', T, { px: 26, disabled: state.textIdx === 0 }); drawButton(ctx, RESULT.inc, 'A+', T, { px: 26, disabled: state.textIdx === TEXT_SCALES.length - 1 });
  ctx.restore();
}

// ---- title ------------------------------------------------------------------------------------------------------------------------
const ROW_A = [RATHA, ASHVA, GAJA, MANTRI, RAJA, PADATI];
function renderHero(ctx, state, T, Rr) {
  const t = state.t, s = Rr.heroScale, land = Rr.land, LW = 720;
  ctx.save(); ctx.translate(Rr.heroCx - 360 * s, Rr.heroTop); ctx.scale(s, s);
  if (v3.on) {   // the 3D courtyard is the hero; only a shade behind the lettering is drawn here
    const sh = ctx.createLinearGradient(0, 410, 0, 650); sh.addColorStop(0, 'rgba(14,4,2,0)'); sh.addColorStop(0.35, 'rgba(14,4,2,0.62)'); sh.addColorStop(1, 'rgba(14,4,2,0.8)');
    ctx.fillStyle = sh; ctx.fillRect(-200, 410, 1120, 260);
  }
  // the cusped arch window, a sunset in it, and two rows of tokens facing each other
  const ax = 100, aw = 520, ay = 18, ah = 400;
  if (!v3.on) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10; cuspedArch(ctx, ax - 10, ay - 10, aw + 20, ah + 20, 5); ctx.fillStyle = '#e9bd5a'; ctx.fill(); ctx.restore();
  cuspedArch(ctx, ax, ay, aw, ah, 5);
  const sky = ctx.createLinearGradient(0, ay, 0, ay + ah); sky.addColorStop(0, '#2a2a6e'); sky.addColorStop(0.42, '#8f2f5a'); sky.addColorStop(0.72, '#e2673b'); sky.addColorStop(1, '#f6bf62');
  ctx.fillStyle = sky; ctx.fill();
  ctx.save(); cuspedArch(ctx, ax, ay, aw, ah, 5); ctx.clip();
  const sun = ctx.createRadialGradient(LW / 2, ay + 250, 6, LW / 2, ay + 250, 150); sun.addColorStop(0, 'rgba(255,248,210,0.95)'); sun.addColorStop(0.3, 'rgba(255,214,120,0.6)'); sun.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = sun; ctx.fillRect(ax, ay + 80, aw, 330);
  const rnd = lcg(7); ctx.fillStyle = 'rgba(255,245,220,0.9)';
  for (let i = 0; i < 26; i++) { const x = ax + 20 + rnd() * (aw - 40), y = ay + 30 + rnd() * 120; ctx.globalAlpha = 0.25 + 0.6 * Math.abs(Math.sin(t * 0.9 + i)); ctx.beginPath(); ctx.arc(x, y, 1 + rnd() * 1.4, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // distant palace skyline
  ctx.fillStyle = 'rgba(58,16,40,0.85)';
  ctx.beginPath(); ctx.moveTo(ax, ay + ah);
  const sky2 = [[0, 46], [36, 46], [36, 78], [56, 96], [76, 78], [76, 46], [120, 46], [130, 70], [140, 92], [150, 70], [160, 46], [214, 46], [214, 64], [232, 64], [232, 46], [300, 46], [310, 70], [330, 104], [350, 70], [360, 46], [420, 46], [436, 72], [450, 98], [464, 72], [480, 46], [520, 46]];
  for (const [x, h] of sky2) ctx.lineTo(ax + x, ay + ah - h);
  ctx.lineTo(ax + aw, ay + ah); ctx.closePath(); ctx.fill();
  ctx.restore();
  // inner gold lines of the arch
  cuspedArch(ctx, ax, ay, aw, ah, 5); ctx.lineWidth = 5; ctx.strokeStyle = '#a87418'; ctx.stroke();
  // the armies: ivory below, vermilion above, bobbing in turn
  const lane = (y, side) => ROW_A.forEach((tp, i) => { const x = ax + 56 + i * 82, bob = Math.max(0, Math.sin(t * 2.2 - i * 0.8 + (side > 0 ? 0 : 1.6))) * 8; drawPiece(ctx, tp, side, x, y - bob, 0.82, { lift: bob / 12 }); });
  lane(ay + 218, BLACK); lane(ay + 320, WHITE);
  }
  // title block
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(20,0,5,0.85)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 5;
  const tg = ctx.createLinearGradient(0, 458, 0, 538); tg.addColorStop(0, T.title[0]); tg.addColorStop(0.55, T.title[1]); tg.addColorStop(1, T.title[2]);
  ctx.fillStyle = tg; ctx.font = `700 ${fitFont(ctx, 'Chaturanga', 700, 130, 640, 56, DISPLAY)}px ${DISPLAY}`; ctx.fillText('Chaturanga', LW / 2, 520);
  ctx.shadowColor = 'transparent'; ctx.fillStyle = '#ffeec4'; ctx.font = `700 25px ${FONT}`;
  const sub = 'T H E   A N C I E N T   A N C E S T O R   O F   C H E S S'; fitFont(ctx, sub, 700, 24, 640, 12); ctx.fillText(sub, LW / 2, 566);
  ctx.fillStyle = 'rgba(255,238,196,0.85)'; ctx.font = `400 30px ${FONT}`; ctx.fillText('चतुरङ्ग', LW / 2, 612);
  ctx.restore();
  ctx.restore();
  void land;
}
function renderTitle(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const tall = state.textIdx >= 3, R = titleRows(!!state.saved, tall), sc = tall ? TEXT_SCALES[state.textIdx] : Math.min(TEXT_SCALES[state.textIdx], 1.4);
  renderHero(ctx, state, T, R);
  const cap = (base, max) => Math.round(Math.min(base * sc, tall ? max : 1e9));
  const eraName = state.era === ANCIENT ? 'Ancient' : 'Modern';
  if (R.resume) drawButton(ctx, R.resume, 'Continue game', T, { px: cap(30, 42), active: true });
  drawButton(ctx, R.play, 'Play', T, { primary: true, px: cap(44, 58), sub: `vs the computer · ${LEVELS[state.level].name} · ${eraName}`, subPx: cap(22, 30) });
  drawButton(ctx, R.two, 'Two Players', T, { px: cap(30, 44) });
  drawButton(ctx, R.learn, 'Learn', T, { px: cap(30, 44), sub: `${state.learned.length}/${LESSONS.length} lessons`, subPx: cap(20, 26) });
  drawButton(ctx, R.watch, 'Watch & Learn', T, { px: cap(28, 44) });
  drawButton(ctx, R.history, 'History', T, { px: cap(30, 44), sub: 'ancient vs modern', subPx: cap(19, 26) });
  drawButton(ctx, R.level, `Level: ${LEVELS[state.level].name}`, T, { px: cap(25, 40) });
  drawButton(ctx, R.era, `Moves: ${eraName}`, T, { px: cap(25, 40), active: state.era === MODERN });
  drawButton(ctx, R.settings, 'Settings', T, { px: cap(22, 38) });
  drawButton(ctx, R.howto, tall ? 'How to Play' : 'How to', T, { px: cap(22, 38) });
  drawButton(ctx, R.rules, 'Rules', T, { px: cap(22, 38) });
  drawButton(ctx, R.about, 'About', T, { px: cap(22, 38) });
  { const c = R.lock, lh = c.w * 327 / 1200, pad = lh * 0.12; ctx.save(); ctx.globalAlpha = state.lockPress > 0 ? 0.7 : 1; ctx.fillStyle = 'rgba(10,8,24,0.6)'; ctx.beginPath(); ctx.roundRect(c.x - c.w / 2 - pad, c.y - pad, c.w + 2 * pad, lh + 2 * pad, (lh + 2 * pad) * 0.3); ctx.fill(); ctx.restore();
    drawLockupImage(ctx, c.x, c.y, lh, state.lockPress > 0 ? 0.7 : 1); }
  void TITLE_SOUND;
}

// ---- reference pages (How to Play / About / Rules) -----------------------------------------------------------------------------
function drawDiagram(ctx, state, d, cx, top, Sd) {
  const o = { S: Sd, F: Math.max(8, Math.round(Sd * 0.26)), f0: d.f0, f1: d.f1, r0: d.r0, r1: d.r1, labels: false, seed: 3 };
  const { w, h } = boardBox(o), x = cx - w / 2, Tm = themeOf(state.theme);
  baked(ctx, `diag:${state.theme}:${Sd}:${d.f0}${d.f1}${d.r0}${d.r1}`, x, top, w, h, (c) => paintBoard(c, Tm, o), 1);
  const at = (s) => { const q = localSq(o, s & 7, s >> 3); return { x: x + q.x + Sd / 2, y: top + q.y + Sd / 2 }; };
  for (const [s, p] of d.marks || []) { const q = at(s); if (p === 'x') { ring(ctx, q, Sd * 0.52, RED, 4, 0.95); continue; } dot(ctx, q, Sd * 0.14, 0); }
  const order = [...d.pieces].sort((a, b) => (b[0] >> 3) - (a[0] >> 3));
  for (const [s, p] of order) { const q = at(s); drawPiece(ctx, Math.abs(p), p > 0 ? WHITE : BLACK, q.x, q.y + Sd * 0.03, PK(Sd)); }
  for (const [a, b] of d.arrows || []) drawArrow(ctx, at(a), at(b), GOLD, Math.max(4, Sd * 0.09), Math.max(10, Sd * 0.2), Sd * 0.3);
  for (const s of d.rings || []) ring(ctx, at(s), Sd * 0.42, RED, 4, 0.95);
  return h;
}
const diagS = (d, scale, panel) => {
  const natural = Math.round(d.S * (scale <= 1 ? 1.3 : scale <= 1.5 ? 1.15 : scale <= 2 ? 1 : scale <= 2.5 ? 0.8 : 0.65));
  const nf = d.f1 - d.f0 + 1, nr = d.r1 - d.r0 + 1;
  const byW = Math.floor(Math.min(600, panel.w - 90) / (nf + 0.52)), byH = Math.floor(Math.max(120, (panel.h - 72) * 0.72) / (nr + 0.52));
  return Math.max(18, Math.min(natural, byW, byH));
};
const diagHeight = (d, scale, panel) => { const S = diagS(d, scale, panel); return boardBox({ S, F: Math.max(8, Math.round(S * 0.26)), f0: d.f0, f1: d.f1, r0: d.r0, r1: d.r1 }).h; };
// One continuous document: every entry is a section (title, optional diagram, text). Measured once per (list, zoom, panel).
const docCache = new Map();
function docLayout(ctx, list, scale, panel) {
  const key = `${scale}:${panel.w}:${panel.h}`, hit = docCache.get(list);
  if (hit && hit.key === key) return hit;
  const maxW = panel.w - 80, titlePx = Math.round(38 * Math.min(scale, 1.3)), px = Math.round(29 * scale * (scale <= 1.5 ? 1.2 : 1));
  const items = []; let y = 0;
  list.forEach((entry, i) => {
    if (i) y += Math.round(34 * Math.min(scale, 1.5));
    ctx.font = `700 ${titlePx}px ${DISPLAY}`;
    const titleLines = wrapLines(ctx, entry.title, panel.w - 80);
    ctx.font = `400 ${px}px ${FONT}`;
    const lines = [];
    for (const para of entry.lines) { const w = wrapLines(ctx, para, maxW); w.forEach((t, k) => lines.push({ text: t, end: k === w.length - 1 })); }
    const tH = titleLines.length * titlePx * 1.15, dS = entry.diagram ? diagS(entry.diagram, scale, panel) : 0, dH = entry.diagram ? diagHeight(entry.diagram, scale, panel) + 24 : 0;
    const textH = lines.reduce((a, l) => a + px * 1.28 + (l.end ? px * 0.32 : 0), 0);
    const h = titlePx * 0.9 + tH + dH + px + textH;
    items.push({ entry, y, h, titleLines, tH, dS, dH, lines }); y += h;
  });
  const doc = { key, items, total: y + 20, px, titlePx, offsets: items.map((it) => it.y) };
  docCache.set(list, doc); return doc;
}
export const pageScroll = { max: 0, view: 0, offsets: [] };
function renderPage(ctx, state, list, heading, T) {
  drawBackdrop(ctx, state.theme);
  const scale = TEXT_SCALES[state.textIdx], panel = REF_PANEL;
  const doc = docLayout(ctx, list, scale, panel), { px, titlePx } = doc;
  drawPanel(ctx, panel, T, { round: 28 });
  const pcx = panel.x + panel.w / 2;
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = T.sub; ctx.font = `700 ${Math.round(26 * Math.min(scale, 1.2))}px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(heading.toUpperCase().split('').join(' '), pcx, panel.y + 50);
  ctx.strokeStyle = T.dark ? 'rgba(255,225,180,0.3)' : 'rgba(140,60,30,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panel.x + 60, panel.y + 68); ctx.lineTo(panel.x + panel.w - 60, panel.y + 68); ctx.stroke();
  ctx.restore();
  const top = panel.y + 74, view = panel.h - 84, total = doc.total + 10;
  const maxScroll = Math.max(0, Math.ceil(total - view)); pageScroll.max = maxScroll; pageScroll.view = view; pageScroll.offsets = doc.offsets;
  if (state.jump != null) { state.scroll = doc.offsets[Math.min(state.jump, doc.offsets.length - 1)] || 0; state.jump = null; }
  const scroll = clamp(state.scroll || 0, 0, maxScroll);
  ctx.save();
  ctx.beginPath(); ctx.rect(panel.x + 8, top, panel.w - 16, view); ctx.clip();
  for (const it of doc.items) {
    const y0 = top + 4 + it.y - scroll;
    if (y0 + it.h < top - 20 || y0 > top + view + 20) continue;
    let y = y0;
    ctx.fillStyle = T.dark ? GOLD : '#8f1f17'; ctx.font = `700 ${titlePx}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    y += titlePx * 1.05; it.titleLines.forEach((l) => { ctx.fillText(l, pcx, y); y += titlePx * 1.15; }); y -= titlePx * 0.15;
    if (it.entry.diagram) { y += 12; drawDiagram(ctx, state, it.entry.diagram, pcx, y, it.dS); y += it.dH - 12; }
    ctx.fillStyle = T.ink; ctx.font = `400 ${px}px ${FONT}`; ctx.textAlign = 'center';
    y += px * 1.0;
    for (const l of it.lines) { ctx.fillText(l.text, pcx, y); y += px * 1.28 + (l.end ? px * 0.32 : 0); }
  }
  ctx.restore();
  if (maxScroll > 0) {   // scroll bar
    const bx = panel.x + panel.w - 16, by = panel.y + 80, bh = panel.h - 96, th = Math.max(40, bh * (view / total));
    rr(ctx, bx, by, 6, bh, 3); ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fill();
    rr(ctx, bx, by + (bh - th) * (scroll / maxScroll), 6, th, 3); ctx.fillStyle = T.dark ? 'rgba(255,224,150,0.7)' : 'rgba(143,31,23,0.7)'; ctx.fill();
  }
  drawButton(ctx, TEXT_DEC, 'A-', T, { px: 34, disabled: state.textIdx === 0 }); drawButton(ctx, TEXT_INC, 'A+', T, { px: 34, disabled: state.textIdx === TEXT_SCALES.length - 1 });
  ctx.save(); ctx.fillStyle = LIGHT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 26px ${FONT}`; ctx.fillText(`${Math.round(scale * 100)}%`, (TEXT_DEC.x + TEXT_DEC.w + TEXT_INC.x) / 2, TEXT_DEC.y + TEXT_DEC.h / 2); ctx.restore();
  drawButton(ctx, REF_BACK, 'Back', T, { px: 38 });
  drawButton(ctx, REF_NEXT, scroll >= maxScroll - 2 ? 'Done' : 'Next', T, { primary: true, px: 38 });
}

// ---- settings ------------------------------------------------------------------------------------------------------------------
function renderSettings(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const tall = settingsTall(state.textIdx);
  ctx.save(); ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 56px ${DISPLAY}`; ctx.fillText('Settings', W / 2, SETTINGS_TITLE.y + 40 - (LAY.land ? 14 : 0)); ctx.restore();
  const sc = tall ? TEXT_SCALES[state.textIdx] : Math.min(TEXT_SCALES[state.textIdx], 1.5);
  const rows = [
    ['Sound', state.sound ? 'On' : 'Off'],
    ['Difficulty', LEVELS[state.level].name, LEVELS[state.level].blurb],
    ['You play', SIDE_NAME[state.humanPref], 'Ivory moves first'],
    ['Movement', state.era === ANCIENT ? 'Ancient' : 'Modern', state.era === ANCIENT ? 'Chaturanga as reconstructed' : 'Today\'s chess movements'],
    ['Board look', themeOf(state.theme).name],
    ['Threat marks', state.danger ? 'On' : 'Off', 'Rings your pieces that could be taken next'],
    ['Think time', `${THINK_STEPS[state.thinkIdx]} s`, 'Watch & Learn. Tap to cycle: 2, 5, 8, 10'],
    ['Text size', `${Math.round(TEXT_SCALES[state.textIdx] * 100)}%`, 'Tap to cycle: 100% to 300%'],
    ['Restore purchase', state.restoreMsg || 'Tap', 'Bought the full game before? Tap to restore it'],
  ];
  rows.forEach((r, i) => {
    const rect = SETTINGS_ROW(i, tall);
    drawButton(ctx, rect, '', T);
    ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = T.btnText; ctx.textAlign = 'left';
    const two = tall || LAY.land, sub = r[2], titleY = sub ? rect.h * (two ? 0.27 : 0.32) : rect.h * 0.5, capT = tall ? 56 : 1e9;
    ctx.textAlign = 'right'; ctx.fillStyle = GOLD; fitFont(ctx, r[1], 700, Math.min(Math.round(30 * sc), capT), rect.w * 0.42, 13); const vw = ctx.measureText(r[1]).width; ctx.fillText(r[1], rect.x + rect.w - 26, rect.y + titleY);
    ctx.textAlign = 'left'; ctx.fillStyle = T.btnText; fitFont(ctx, r[0], 700, Math.min(Math.round(29 * sc), capT), rect.w - 52 - vw - 16, 12); ctx.fillText(r[0], rect.x + 26, rect.y + titleY);
    if (sub) {
      ctx.fillStyle = 'rgba(255,243,208,0.78)'; const lines = tall || LAY.land ? 2 : 1; let px = Math.min(Math.round(20 * sc), tall ? 38 : 1e9);
      for (;;) { ctx.font = `400 ${px}px ${FONT}`; if (wrapLines(ctx, sub, rect.w - 52).length <= lines || px <= 11) break; px--; }
      const ls = wrapLines(ctx, sub, rect.w - 52), lh = px * 1.08, y0 = rect.y + (two ? rect.h * 0.58 : rect.h * 0.74);
      ls.forEach((l, k) => ctx.fillText(l, rect.x + 26, y0 + k * lh));
    }
    ctx.restore();
  });
  drawButton(ctx, SETTINGS_BACK, 'Back', T, { primary: true, px: 40 });
  void SETTINGS_ROWS;
}

// ---- history: the same piece on the ancient and the modern board -----------------------------------------------------------------------------
const CMP_TYPES = [RAJA, MANTRI, GAJA, ASHVA, RATHA, PADATI];
function reachSquares(type, era, at) {
  const b = new Int8Array(64); b[at] = type;
  const list = new Int32Array(256), n = genInto(b, WHITE, list, 0, false, era), out = [];
  for (let i = 0; i < n; i++) if (mFrom(list[i]) === at) out.push(mTo(list[i]));
  return out;
}
const CHANGED = {
  [RAJA]: 'The King is the same piece in both: one square any way. Only modern chess adds castling (not shown here).',
  [MANTRI]: 'The ancient Mantri steps one diagonal square. It grew into the Queen, the strongest piece, sliding any distance.',
  [GAJA]: 'The elephant leaps exactly two squares diagonally. Later it became the Bishop, sliding any distance diagonally.',
  [ASHVA]: 'The horse has jumped in an L from the very beginning; it did not change.',
  [RATHA]: 'The chariot became the Rook: it has always slid along ranks and files.',
  [PADATI]: 'The Padati steps one square. The modern Pawn may step two from its start, and promotes to a Queen.',
};
function histBoard(ctx, state, T, b, era, at, type) {
  const o = { S: b.S, F: b.F, f0: 0, f1: 7, r0: 0, r1: 7, labels: false, seed: 5 }, { w, h } = boardBox(o);
  drawBoard(ctx, state.theme, b.x, b.y, { ...o });
  const k = PK(b.S), pulse = 0.5 + 0.5 * Math.sin(state.t * 5);
  for (const s of reachSquares(type, era, at)) dot(ctx, histSquareCentre(b, s), b.S * 0.15, pulse);
  const c = histSquareCentre(b, at); drawPiece(ctx, type, WHITE, c.x, c.y + b.S * 0.04, k, { lift: 0.4 });
  void T; void w; void h;
}
function renderHistory(ctx, state, T) {
  setHistText(TEXT_SCALES[state.textIdx]);
  drawBackdrop(ctx, state.theme);
  drawButton(ctx, HIST.menu, 'Menu', T, { px: 26 });
  if (!HIST.cols) { ctx.save(); ctx.fillStyle = LIGHT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8;
  const tx0 = HIST.menu.x + HIST.menu.w + 10, tx1 = W - LAY.ins.r - 16;
  ctx.font = `700 ${fitFont(ctx, 'History of chess', 700, 42, tx1 - tx0, 18, DISPLAY)}px ${DISPLAY}`; ctx.fillText('History of chess', (tx0 + tx1) / 2, HIST.menu.y + HIST.menu.h / 2); ctx.restore(); }
  const type = CMP_TYPES[state.cmp.tab], at = state.cmp.at;
  HIST.tabs.forEach((r, i) => {
    const t = CMP_TYPES[i], active = i === state.cmp.tab;
    drawButton(ctx, r, '', T, { active });
    drawPiece(ctx, t, WHITE, r.x + r.w / 2, r.y + r.h * (sprites.ready ? 0.7 : 0.46), (Math.min(r.h * 0.84, r.w * 0.9) / 80) * (sprites.ready ? 0.5 : 1));
    void active;
  });
  histBoard(ctx, state, T, HIST.A, ANCIENT, at, type);
  histBoard(ctx, state, T, HIST.B, MODERN, at, type);
  // labels over each board
  const lab = (r, head, name) => {
    ctx.save(); drawPanel(ctx, r, T, { round: 12, alpha: 0.92 });
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = T.dark ? GOLD : '#8f1f17';
    const txt = `${head}: ${name}`; fitFont(ctx, txt, 700, Math.round(r.h * 0.5), r.w - 16, 10); ctx.fillText(txt, r.x + r.w / 2, r.y + r.h / 2 + 1); ctx.restore();
  };
  lab(HIST.labA, 'Ancient', TYPE_NAME[type]); lab(HIST.labB, 'Modern', MODERN_NAME[type]);
  // one caption: the rule in each era and what changed
  const P = HIST.capA, sc = TEXT_SCALES[state.textIdx];
  drawPanel(ctx, P, T, { round: 18 });
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const paras = [[`Ancient ${TYPE_NAME[type]}`, moveRule(type, ANCIENT)], [`Modern ${MODERN_NAME[type]}`, moveRule(type, MODERN)], ['What changed', CHANGED[type]]];
  let px = Math.round(22 * sc), rows;
  const build = (p) => { ctx.font = `400 ${p}px ${FONT}`; const out = []; for (const [h, t] of paras) { out.push({ h: true, text: h }); for (const l of wrapLines(ctx, t, P.w - 40)) out.push({ text: l }); } return out; };
  for (;;) { rows = build(px); const hh = rows.reduce((a, r) => a + (r.h ? px * 1.5 : px * 1.2), 0); if (hh <= P.h - 20 || px <= 10) break; px--; }
  let y = P.y + 14 + px * 0.9;
  for (const r of rows) {
    if (r.h) { ctx.font = `700 ${px}px ${FONT}`; ctx.fillStyle = T.dark ? GOLD : '#8f1f17'; y += px * 0.3; ctx.fillText(r.text, P.x + 20, y); y += px * 1.2; }
    else { ctx.font = `400 ${px}px ${FONT}`; ctx.fillStyle = T.ink; ctx.fillText(r.text, P.x + 20, y); y += px * 1.2; }
  }
  ctx.restore();
  drawButton(ctx, HIST.back, 'Back', T, { primary: true, px: 38 });
  void sqName;
}

// ---- Watch & Learn ---------------------------------------------------------------------------------------------------------------------
function renderAuto(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  header(ctx, state, T, 'Watch & Learn');
  plates(ctx, state, T);
  drawBoardScene(ctx, state, T);
  infoStrip(ctx, state, T);
  message(ctx, state, T);
  const P = AUTO.pause;
  drawButton(ctx, AUTO.exit, 'Exit', T, { px: 30 });
  drawButton(ctx, P, '', T, { primary: state.apPaused });
  const pc = state.apPaused ? T.accentText : T.btnText, pl = state.apPaused ? 'Resume' : 'Pause', pfs = Math.min(30, P.h * 0.34), isz = Math.min(38, P.h * 0.4);
  ctx.save(); ctx.fillStyle = pc; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 ${fitFont(ctx, pl, 700, pfs, P.w - isz - 40, 14)}px ${FONT}`;
  const tw = ctx.measureText(pl).width, total = isz + 10 + tw, x0 = P.x + (P.w - total) / 2;
  drawIcon(ctx, state.apPaused ? 'play' : 'pause', x0 + isz / 2, P.y + P.h / 2, isz, pc); ctx.fillText(pl, x0 + isz + 10, P.y + P.h / 2 + 1); ctx.restore();
  // the think-time stepper: one recessed brass-edged well holding  (-)  value  (+)
  const WL = AUTO.well, V = AUTO.val;
  ctx.save(); rr(ctx, WL.x, WL.y, WL.w, WL.h, Math.min(20, WL.h * 0.3)); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = '#2a0e08'; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3; ctx.strokeStyle = '#c9962f'; ctx.stroke(); ctx.restore();
  const step = (r, plus, off) => {
    drawButton(ctx, r, '', T, { disabled: off }); const c = r.x + r.w / 2, m = r.y + r.h / 2, a = Math.min(r.w, r.h) * 0.24;
    ctx.save(); if (off) ctx.globalAlpha = 0.5; ctx.strokeStyle = T.btnText; ctx.lineWidth = Math.max(4, a * 0.34); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(c - a, m); ctx.lineTo(c + a, m); if (plus) { ctx.moveTo(c, m - a); ctx.lineTo(c, m + a); } ctx.stroke(); ctx.restore();
  };
  step(AUTO.dec, false, state.thinkIdx === 0); step(AUTO.inc, true, state.thinkIdx === THINK_STEPS.length - 1);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = GOLD;
  const vpx = Math.min(36, V.h * 0.4); ctx.font = `700 ${vpx}px ${FONT}`; ctx.fillText(`${THINK_STEPS[state.thinkIdx]}s`, V.x + V.w / 2, V.y + V.h * 0.4);
  ctx.font = `400 ${Math.min(20, V.h * 0.22)}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,208,0.85)'; fitFont(ctx, 'think time', 400, Math.min(20, V.h * 0.22), V.w - 6, 10); ctx.fillText('think time', V.x + V.w / 2, V.y + V.h * 0.76); ctx.restore();
  banner(ctx, state, T);
  if (state.g.result && state.overOpen) renderResult(ctx, state, T);
}

// ---- Learn --------------------------------------------------------------------------------------------------------------------------
function renderLearn(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const L = LESSONS[state.lesson.i];
  header(ctx, state, T, 'Learn');
  const r = PLATE_TOP; drawPanel(ctx, r, T, { round: 20 });
  ctx.save(); ctx.fillStyle = T.dark ? GOLD : '#8f1f17'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const label = `${state.lesson.i + 1}/${LESSONS.length}  ${L.title}`; fitFont(ctx, label, 700, 34, r.w - 40, 13); ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1); ctx.restore();
  drawBoardScene(ctx, state, T);
  const q = PLATE_BOT; drawPanel(ctx, q, T, { round: 20 });
  ctx.save(); ctx.fillStyle = T.sub; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const goal = `${state.lesson.done ? 'Done: ' : 'Goal: '}${L.goalText}`; ctx.fillStyle = state.lesson.done ? (T.dark ? '#bdf0b0' : '#1f6a22') : T.ink; fitFont(ctx, goal, 700, 32, q.w - 40, 13); ctx.fillText(goal, q.x + q.w / 2, q.y + q.h / 2 + 1); ctx.restore();
  infoStrip(ctx, state, T);
  message(ctx, state, T);
  const done = state.lesson.done;
  drawButton(ctx, LEARN_BAR.menu, 'Menu', T, { px: 26 });
  drawButton(ctx, LEARN_BAR.hint, 'Show me', T, { px: 25, disabled: done });
  drawButton(ctx, LEARN_BAR.reset, 'Reset', T, { px: 26 });
  drawButton(ctx, LEARN_BAR.next, state.lesson.i === LESSONS.length - 1 && done ? 'Finish' : 'Next', T, { primary: done, px: 30, disabled: !done && !state.learned.includes(state.lesson.i) });
  banner(ctx, state, T);
  void MANTRI; void PADATI; void ASHVA; void GAJA; void petal;
}

function renderLimit(ctx, state, T) {
  drawBackdrop(ctx, state.theme);
  const r = LIMIT.panel, sc = TEXT_SCALES[state.textIdx], cx = r.x + r.w / 2;
  drawPanel(ctx, r, T, { round: 32 });
  ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = T.dark ? GOLD : '#8f1f17';
  fitFont(ctx, 'That was the free taste', 700, 56, r.w - 60, 26, DISPLAY); ctx.fillText('That was the free taste', cx, r.y + 100);
  const text = 'Get the free app on iPhone and Android: every level, two-player games, and all the lessons.';
  let px = Math.round(32 * Math.min(sc, 2.4)), lines;
  for (;;) { ctx.font = `400 ${px}px ${FONT}`; lines = wrapLines(ctx, text, r.w - 80); if (lines.length * px * 1.3 <= LIMIT.btn.y - (r.y + 140) - 20 || px <= 18) break; px -= 1; }
  ctx.fillStyle = T.ink; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, cx, r.y + 150 + px + i * px * 1.3));
  ctx.restore();
  drawButton(ctx, LIMIT.btn, 'Menu', T, { primary: true, px: 38 });
  void textBlock;
}

export function render(ctx, state) {
  const T = themeOf(state.theme);
  setPress(state.press);
  switch (state.scene) {
    case 'title': renderTitle(ctx, state, T); break;
    case 'play': renderPlay(ctx, state, T); break;
    case 'auto': renderAuto(ctx, state, T); break;
    case 'learn': renderLearn(ctx, state, T); break;
    case 'history': renderHistory(ctx, state, T); break;
    case 'settings': renderSettings(ctx, state, T); break;
    case 'howto': case 'about': case 'rules': renderPage(ctx, state, pageContent(state.scene), state.scene === 'howto' ? 'How to play' : state.scene === 'about' ? 'About Chaturanga' : 'Rules', T); break;
    case 'demo-limit': renderLimit(ctx, state, T); break;
    default: renderTitle(ctx, state, T);
  }
}
