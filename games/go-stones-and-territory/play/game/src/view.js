// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js).
import { W, H, R, px, py, stoneR, boardLayout, PAGE_NAV, TEXT_SCALES, TEXT_BTN, THINK_STEPS, REVEAL_TIME, AUTOPLAY, layout, titleLay, quizRectAt } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { drawTable, drawBoardLayer, drawLamp, drawStone, drawShadow, drawBowl, THEMES } from './art.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { coord, KOMI, opp } from './rules.js';
import { puzzleText } from './puzzles.js';
import { RULES } from './content.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
// Short entries; toSections() below joins consecutive entries with the same heading into one section of the continuous reader.
export const ABOUT_TEXT = [
  ['Go, the game of stones and territory', 'Go is one of the oldest board games still played today.'],
  ['Where Go began', 'It began in China more than 2,500 years ago, where it is called Weiqi.'],
  ['Where Go began', 'It travelled to Korea, where it is called Baduk,'],
  ['Where Go began', 'and to Japan, where it is called Igo.'],
  ['In the culture', 'In China, Go (qi) was counted among the four arts of the scholar,'],
  ['In the culture', 'beside the zither, calligraphy and painting.'],
  ['Played everywhere', 'Across East Asia it has long been played at home, in tea houses and in clubs,'],
  ['Played everywhere', 'by children and by grandparents.'],
  ['Why it lasts', 'The rules fit on one page: place stones, surround space, capture what has no liberties.'],
  ['Bigger than the universe', 'Yet on a 19 x 19 board the number of possible'],
  ['Bigger than the universe, continued', 'positions is larger than the number of atoms'],
  ['Bigger than the universe, still', 'in the observable universe.'],
  ['Stones and boards', 'Traditional sets use slate for black stones and shell for white,'],
  ['Stones and boards, continued', 'kept in round wooden bowls.'],
  ['Fine boards', 'Fine boards are carved from a single block of wood, often kaya,'],
  ['Fine boards, continued', 'and are prized for their grain.'],
  ['Counting the score', 'China uses area scoring (stones plus territory), which is what this game uses.'],
  ['Counting the score', 'Japan and Korea count territory and prisoners instead.'],
  ['Counting the score', 'The winner is usually the same either way.'],
];
export const HOW_TEXT = [
  ['Placing a stone', 'TAP a crossing: a ghost stone appears.'],
  ['Placing a stone', 'TAP the same crossing again, or press PLACE, to play it.'],
  ['Placing a stone', 'DRAG to slide the ghost, then let go: it stays until you confirm.'],
  ['Placing a stone', 'Drag off the board to cancel.'],
  ['Placing a stone', '(Settings: turn on Quick place to play as soon as you let go.)'],
  ['The buttons', 'PASS: skip your turn.'],
  ['The buttons', 'Two passes in a row end the game.'],
  ['The buttons', 'UNDO: takes back your last move (and the reply).'],
  ['The buttons', 'HINT: shows a good move with a reason.'],
  ['The buttons', 'MENU: leave the game (it is saved).'],
  ['Keyboard', 'Arrow keys move the aim, Enter or Space plays it,'],
  ['Keyboard, continued', 'P passes, U undoes, H gives a hint.'],
  ['The rules', 'Surround stones to capture them.'],
  ['No suicide', 'A stone or group with no liberties (empty neighbours) is removed.'],
  ['No suicide, continued', 'You may not play a stone with no liberties unless it captures.'],
  ['Ko', 'Ko and repeated positions are forbidden.'],
  ['Winning', 'Area scoring: your stones plus the empty points only you surround.'],
  ['Komi', 'White also gets a bonus (komi): 5.5 on 9 x 9, 7.5 on larger boards.'],
  ['Dead stones', 'Dead stones are found for you and you can tap a group to change it before you accept.'],
];

const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function render(ctx, S) {
  const calm = S.prefs.calm;
  drawTable(ctx);
  drawLamp(ctx, S.t, calm);
  const big = S.prefs.big;
  const text = (str, x, y, size, color = '#f6e3b4', font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  // a heading that shrinks to fit maxW (never wraps, never runs under the host's back button)
  const title = (str, x, y, size, maxW, color = '#f6e3b4', font = FONT, weight = 700) => {
    let sz = size; ctx.font = `${weight} ${sz}px ${font}`;
    while (sz > 26 && ctx.measureText(str).width > maxW) { sz -= 2; ctx.font = `${weight} ${sz}px ${font}`; }
    text(str, x, y, sz, color, font, weight, 'center');
  };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center', weight = 500, font = UI) => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align)); return lines.length;
  };
  const button = (r, label, o = {}) => {
    const press = o.press ? 2 : 0;
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 7, r.w, r.h, 20); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f8dd90'); gr.addColorStop(0.55, '#e0ae4a'); gr.addColorStop(1, '#b17a22'); }
    else { gr.addColorStop(0, '#523229'); gr.addColorStop(0.5, '#33201a'); gr.addColorStop(1, '#1f120e'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h - press, 20); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,245,210,0.9)' : 'rgba(240,200,120,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    let sz = Math.min((o.size ?? 32) * (big ? 1.12 : 1), r.h * 0.5);
    ctx.font = `700 ${sz}px ${o.font ?? UI}`;
    while (sz > 17 && ctx.measureText(label).width > r.w - 26) { sz -= 1; ctx.font = `700 ${sz}px ${o.font ?? UI}`; }
    text(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.34 + press, sz, o.primary ? '#2d1808' : '#f6e3b4', o.font ?? UI, 700);
    ctx.restore();
  };
  const panel = (r, o = {}) => {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 8, r.w, r.h, 22); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.paper) { g.addColorStop(0, '#f8edd2'); g.addColorStop(1, '#eadbb6'); } else { g.addColorStop(0, 'rgba(50,32,24,0.96)'); g.addColorStop(1, 'rgba(26,16,12,0.96)'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 22); ctx.fill();
    ctx.strokeStyle = o.paper ? 'rgba(120,80,30,0.5)' : 'rgba(240,200,120,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  };
  const tap = S.tap;
  const isPress = (r) => tap && S.down && tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h;

  const scene = S.scene;
  if (scene === 'title') return drawTitle(ctx, S, { text, wrap, button, panel, isPress, title });
  if (scene === 'setup') return drawSetup(ctx, S, { text, wrap, button, panel, isPress, title });
  if (scene === 'lessons') return drawLessonList(ctx, S, { text, wrap, button, panel, isPress, title });
  if (scene === 'about') return drawSections(ctx, S, { text, wrap, button, panel, isPress, title }, 'About Go', ABOUT_SECTIONS);
  if (scene === 'how') return drawSections(ctx, S, { text, wrap, button, panel, isPress, title }, 'How to play', HOW_SECTIONS);
  if (scene === 'rules') return drawRules(ctx, S, { text, wrap, button, panel, isPress, title });
  if (scene === 'settings') return drawSettings(ctx, S, { text, wrap, button, panel, title });
  if (scene === 'demo-limit') return drawDemoLimit(ctx, S, { text, wrap, button, panel, title });
  drawBoardScene(ctx, S, { text, wrap, button, panel, isPress, title });
}

// ---- board, stones, marks ------------------------------------------------------------------------------------------------
function drawBoardPieces(ctx, S, L, o = {}) {
  const g = o.g ?? S.g, n = L.n, r = stoneR(L), calm = S.prefs.calm;
  drawBoardLayer(ctx, L, S.prefs.theme);
  const dropAt = new Map();
  for (const a of S.anim) if (a.type === 'drop') dropAt.set(a.i, a);
  const dead = new Set(o.dead || []);
  // shadows first, then stones
  for (let i = 0; i < n * n; i++) if (g.b[i]) { const a = dropAt.get(i); drawShadow(ctx, px(L, i), py(L, i), r, a ? clamp(1 - a.t / a.dur, 0, 1) * 1.4 : 0); }
  for (let i = 0; i < n * n; i++) {
    const c = g.b[i]; if (!c) continue;
    const a = dropAt.get(i), x = px(L, i), y = py(L, i);
    if (a) { const f = clamp(a.t / a.dur, 0, 1), e = ease(f); drawStone(ctx, c, x, y - (1 - e) * r * 0.9, r, { scale: 1 + (1 - e) * 0.22, alpha: 0.35 + 0.65 * e, seed: i }); }
    else drawStone(ctx, c, x, y, r, { seed: i, alpha: dead.has(i) ? 0.42 : 1 });
    if (dead.has(i)) { ctx.strokeStyle = '#d63a2a'; ctx.lineWidth = Math.max(2, r * 0.13); ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.4); ctx.lineTo(x + r * 0.4, y + r * 0.4); ctx.moveTo(x + r * 0.4, y - r * 0.4); ctx.lineTo(x - r * 0.4, y + r * 0.4); ctx.stroke(); }
  }
  // stones being captured fade away
  for (const a of S.anim) if (a.type === 'cap') {
    const f = clamp(a.t / a.dur, 0, 1), x = px(L, a.i), y = py(L, a.i);
    drawStone(ctx, a.c, x, y - f * r * 0.7, r, { scale: 1 - f * 0.25, alpha: 1 - ease(f), seed: a.i });
  }
  // marks: last move, ko point
  if (g.last >= 0 && g.b[g.last] && !o.noMarks) {
    const x = px(L, g.last), y = py(L, g.last);
    ctx.strokeStyle = g.b[g.last] === 1 ? 'rgba(255,240,210,0.95)' : 'rgba(40,20,10,0.9)'; ctx.lineWidth = Math.max(2, r * 0.11);
    ctx.beginPath(); ctx.arc(x, y, r * 0.36, 0, TAU); ctx.stroke();
  }
  if (g.ko >= 0 && !o.noMarks) {
    const x = px(L, g.ko), y = py(L, g.ko), s = r * 0.5;
    ctx.strokeStyle = 'rgba(190,40,30,0.95)'; ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  }
  // territory squares in scoring
  if (o.owner) {
    const s = r * 0.62;
    for (let i = 0; i < n * n; i++) {
      const w = o.owner[i]; if (w !== 1 && w !== 2) continue;
      const x = px(L, i), y = py(L, i);
      ctx.fillStyle = w === 1 ? 'rgba(18,14,12,0.88)' : 'rgba(255,252,240,0.95)'; ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.strokeStyle = w === 1 ? 'rgba(255,230,180,0.6)' : 'rgba(80,50,20,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    }
  }
  // puzzle target marker
  if (o.target != null && o.target >= 0 && g.b[o.target]) {
    const stones = groupOf(g, o.target), pulse = calm ? 0.8 : 0.65 + 0.35 * Math.sin(S.t * 4);
    for (const i of stones) { const x = px(L, i), y = py(L, i); ctx.strokeStyle = `rgba(222,64,44,${pulse})`; ctx.lineWidth = Math.max(2.5, r * 0.14); ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.stroke(); }
  }
  // required point glow (lessons / hint)
  const glowPts = o.glow || [];
  for (const i of glowPts) {
    const x = px(L, i), y = py(L, i), p = calm ? 0.75 : 0.55 + 0.45 * Math.sin(S.t * 5);
    ctx.strokeStyle = `rgba(255,215,110,${0.5 + 0.5 * p})`; ctx.lineWidth = Math.max(3, r * 0.14); ctx.beginPath(); ctx.arc(x, y, r * (0.72 + 0.08 * p), 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,215,110,${0.12 + 0.12 * p})`; ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, TAU); ctx.fill();
  }
  // tapped liberties (lesson)
  for (const i of o.tapped || []) { const x = px(L, i), y = py(L, i); ctx.fillStyle = 'rgba(80,190,120,0.55)'; ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(30,110,60,0.9)'; ctx.lineWidth = 2.5; ctx.stroke(); }
  // the aimed point: crosshair lines and a ghost stone
  if (S.pend >= 0 && S.pendOn) {
    const i = S.pend, x = px(L, i), y = py(L, i), col = S.pendColor;
    ctx.strokeStyle = 'rgba(255,230,150,0.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(px(L, 0), y); ctx.lineTo(px(L, n - 1), y); ctx.moveTo(x, py(L, 0)); ctx.lineTo(x, py(L, n * n - 1)); ctx.stroke(); ctx.setLineDash([]);
    if (!g.b[i]) {
      const bob = calm ? 0 : Math.sin(S.t * 6) * 1.5;
      drawStone(ctx, col, x, y + bob, r, { alpha: 0.62, seed: i });
      ctx.strokeStyle = 'rgba(255,230,150,0.95)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r * 1.02, 0, TAU); ctx.stroke();
    } else { ctx.strokeStyle = 'rgba(220,70,50,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, TAU); ctx.stroke(); }
    // coordinate tag
    const lab = coord(n, i), tw = 88, tx = clamp(x, L.x + tw / 2, L.x + L.size - tw / 2), ty = y - r * 2 - 14 < L.y + 4 ? y + r * 2 + 44 : y - r * 2 - 14;
    ctx.fillStyle = 'rgba(30,18,10,0.88)'; ctx.beginPath(); ctx.roundRect(tx - tw / 2, ty - 34, tw, 44, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,150,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = `700 26px ${UI}`; ctx.fillStyle = '#ffe6a0'; ctx.fillText(lab, tx, ty - 3);
  }
  // a refused move: red flash at the point
  if (S.refuse) {
    const a = S.refuse, f = clamp(a.t / 0.7, 0, 1), x = px(L, a.i) + (calm ? 0 : Math.sin(a.t * 60) * 5 * (1 - f)), y = py(L, a.i);
    drawStone(ctx, a.c, x, y, r, { alpha: 0.5 * (1 - f), seed: a.i });
    ctx.strokeStyle = `rgba(230,60,40,${1 - f})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r * 0.95, 0, TAU); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.stroke();
  }
  // hint
  if (S.hint && S.hint.mv >= 0) {
    const x = px(L, S.hint.mv), y = py(L, S.hint.mv), p = calm ? 0.8 : 0.6 + 0.4 * Math.sin(S.t * 5);
    ctx.strokeStyle = `rgba(255,215,90,${0.6 + 0.4 * p})`; ctx.lineWidth = Math.max(3, r * 0.15); ctx.beginPath(); ctx.arc(x, y, r * (0.8 + 0.1 * p), 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,215,90,${0.18 + 0.14 * p})`; ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.fill();
  }
}
function groupOf(g, i) {
  const n = g.n, c = g.b[i], out = [i], seen = new Set([i]);
  for (let k = 0; k < out.length; k++) { const s = out[k], x = s % n, y = (s / n) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= n || Y >= n) continue; const j = Y * n + X; if (g.b[j] === c && !seen.has(j)) { seen.add(j); out.push(j); } } }
  return out;
}

// ---- title -----------------------------------------------------------------------------------------------------------------
const banner = { cv: null };
function paintBanner(c) {
  // rice paper with a soft edge and fibres, an ink-brush "Go", a swash, and a red seal with a go-board mark
  const x = 50, y = 84, w = 620, h = 296;
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.roundRect(x + 4, y + 10, w, h, 10); c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f7ecd0'); g.addColorStop(1, '#e8d6ac');
  c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, 10); c.fill();
  c.clip();
  let s = 41; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 260; i++) { c.strokeStyle = `rgba(150,110,50,${0.05 + rnd() * 0.08})`; c.lineWidth = 0.7; const fx = x + rnd() * w, fy = y + rnd() * h; c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + 8, fy + (rnd() - 0.5) * 10, fx + 16 + rnd() * 14, fy + (rnd() - 0.5) * 8); c.stroke(); }
  const v = c.createRadialGradient(x + w / 2, y + h / 2, h * 0.3, x + w / 2, y + h / 2, w * 0.62); v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(1, 'rgba(120,80,30,0.28)');
  c.fillStyle = v; c.fillRect(x, y, w, h);
  c.restore();
  // ink "Go": three passes with tiny offsets for an uneven brush edge
  c.textAlign = 'center'; c.font = `700 240px ${FONT}`;
  for (const [dx, dy, a] of [[-2, 1, 0.5], [2, -1, 0.5], [0, 0, 1]]) { c.fillStyle = `rgba(20,14,10,${a})`; c.fillText('Go', 350 + dx - 20, 262 + dy); }
  // dry-brush streaks: paper-coloured hairlines across the letters
  c.save(); c.beginPath(); c.rect(140, 110, 380, 190); c.clip();
  for (let i = 0; i < 26; i++) { c.strokeStyle = `rgba(240,225,190,${0.2 + rnd() * 0.35})`; c.lineWidth = 0.5 + rnd() * 1.0; const yy = 110 + rnd() * 160; c.beginPath(); c.moveTo(140 + rnd() * 60, yy); c.lineTo(300 + rnd() * 240, yy + (rnd() - 0.5) * 6); c.stroke(); }
  c.restore();
  // swash under the letters
  c.fillStyle = 'rgba(20,14,10,0.9)'; c.beginPath(); c.moveTo(120, 286); c.bezierCurveTo(250, 274, 420, 298, 560, 282); c.bezierCurveTo(430, 308, 250, 292, 120, 286); c.fill();
  c.textAlign = 'center'; c.font = `700 34px ${FONT}`; c.fillStyle = 'rgba(60,36,14,0.92)'; c.fillText('The game of stones and territory', 350, 344);
  // seal
  c.save(); c.translate(580, 216); c.rotate(0.06);
  c.fillStyle = '#b3261e'; c.beginPath(); c.roundRect(-38, -38, 76, 76, 6); c.fill();
  c.strokeStyle = '#f7ecd0'; c.lineWidth = 3; c.strokeRect(-30, -30, 60, 60);
  c.lineWidth = 2; c.beginPath(); c.moveTo(-10, -30); c.lineTo(-10, 30); c.moveTo(10, -30); c.lineTo(10, 30); c.moveTo(-30, -10); c.lineTo(30, -10); c.moveTo(-30, 10); c.lineTo(30, 10); c.stroke();
  c.fillStyle = '#f7ecd0'; c.beginPath(); c.arc(-10, -10, 7, 0, TAU); c.fill(); c.beginPath(); c.arc(10, 10, 7, 0, TAU); c.fill();
  c.restore();
}
function drawTitle(ctx, S, u) {
  const { button, isPress } = u, t = S.t, calm = S.prefs.calm, T = titleLay(!!S.saved);
  if (banner.cv === undefined || banner.cv === null) {
    banner.cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(720, 400) : false;
    if (banner.cv) paintBanner(banner.cv.getContext('2d'));
  }
  // the banner unrolls (ink is laid down left to right), then stays
  const rev = calm ? 1 : ease(clamp(t / 1.4, 0, 1)), bn = T.banner;
  ctx.save(); ctx.translate(bn.x, bn.y); ctx.scale(bn.s, bn.s);
  ctx.beginPath(); ctx.rect(0, 0, 40 + (720 - 40) * rev, 400); ctx.clip();
  ctx.globalAlpha = calm ? 1 : clamp(t / 0.5, 0, 1);
  if (banner.cv) ctx.drawImage(banner.cv, 0, 0); else paintBanner(ctx);
  ctx.globalAlpha = 1; ctx.restore();
  // a demonstration game on the board, stones appearing one by one
  if (T.board) {
    const L = { ...boardLayout(9, T.board.x, T.board.y, T.board.size), plain: true };
    const g = { n: 9, b: new Array(81).fill(0), last: -1, ko: -1 };
    const seq = DEMO_SEQ, count = Math.min(seq.length, Math.floor(t * 1.5) % (seq.length + 6));
    const inAnim = [];
    for (let k = 0; k < Math.min(count, seq.length); k++) g.b[seq[k][0]] = seq[k][1];
    const fresh = count > 0 && count <= seq.length ? seq[count - 1][0] : -1;
    const f = (t * 1.5) % 1;
    if (fresh >= 0) { g.last = -1; inAnim.push({ type: 'drop', i: fresh, t: f * 0.66, dur: 0.22 }); }
    const saved = S.anim; S.anim = calm ? [] : inAnim;
    drawBoardPieces(ctx, S, L, { g, noMarks: true });
    S.anim = saved;
  }
  // the discreet Arcforge credit (themed lockup), never over the game
  { const c = T.credit, lh = c.w * 327 / 1200, pad = lh * 0.12; ctx.save(); ctx.globalAlpha = S.lockPress > 0 ? 0.7 : 1; ctx.fillStyle = 'rgba(10,8,24,0.55)'; ctx.beginPath(); ctx.roundRect(c.x - c.w / 2 - pad, c.y - pad, c.w + 2 * pad, lh + 2 * pad, (lh + 2 * pad) * 0.3); ctx.fill(); ctx.restore(); }
  drawLockup(ctx, T.credit.x, T.credit.y, T.credit.w, S.lockPress > 0 ? 0.7 : 1);
  const R2 = T.buttons;
  if (R2.resume) button(R2.resume, 'Resume game', { primary: true, size: 34, press: isPress(R2.resume) });
  button(R2.play, 'Play', { primary: !R2.resume, size: 36, press: isPress(R2.play) });
  button(R2.learn, `Learn to play  ${S.learned.length}/${LESSONS.length}`, { press: isPress(R2.learn) });
  button(R2.daily, S.daily.solvedDay === S.daily.day ? `Daily puzzle: solved (streak ${S.daily.streak})` : 'Daily puzzle', { press: isPress(R2.daily), size: S.daily.solvedDay === S.daily.day ? 26 : 32 });
  button(R2.about, 'About Go', { press: isPress(R2.about) });
  button(R2.how, 'How to play', { press: isPress(R2.how) });
  button(R2.settings, 'Settings', { size: 27, press: isPress(R2.settings) });
  button(R2.rules, 'Rules', { size: 27, press: isPress(R2.rules) });
  button(R2.auto, 'Auto Play — watch and learn', { size: 27, press: isPress(R2.auto) });
}
const DEMO_SEQ = [[40, 1], [22, 2], [58, 1], [50, 2], [23, 1], [31, 2], [41, 1], [32, 2], [33, 1], [24, 2], [42, 1], [49, 2], [59, 1], [60, 2], [68, 1], [51, 2], [67, 1], [14, 2], [34, 1], [13, 2], [43, 1], [15, 2], [52, 1], [53, 2], [61, 1], [69, 2], [30, 1], [21, 2]];
export const demoSequence = () => DEMO_SEQ;

// ---- setup -----------------------------------------------------------------------------------------------------------------
export function setupRects() {
  const o = layout().setup;
  return { sizes: o.sizes, levels: o.levels, sides: o.sides, start: o.start, back: o.back };
}
function drawSetup(ctx, S, u) {
  const { text, wrap, button, panel, title } = u, o = layout().setup, C = o.C, st = S.setup, k = Math.max(0.8, o.k);
  title('New game', C.cx, C.titleY, C.titleSize + (C.titleSize === 70 ? 6 : 0), C.maxW);
  text('Board size', o.l.size.x, o.l.size.y, 30 * k, '#f0d9a0', UI, 700, 'left');
  for (const s of o.sizes) button(s.r, `${s.n} x ${s.n}`, { primary: st.n === s.n, size: 34 });
  const note = st.n === 9 ? 'Small and quick: the best place to start.' : st.n === 13 ? 'A medium board. The computer sees less of it, so it plays weaker.' : 'The full board. The computer is weakest here: a friendly place to practise.';
  wrap(note, o.note.x, o.note.y, 24 * k, o.note.maxW, 'rgba(246,227,180,0.85)');
  text('Computer level', o.l.level.x, o.l.level.y, 30 * k, '#f0d9a0', UI, 700, 'left');
  for (const l of o.levels) button(l.r, LEVELS[l.i].name, { primary: st.level === l.i, size: 32 });
  panel(o.blurb);
  wrap(LEVELS[st.level].blurb, o.blurbText.x, o.blurbText.y, 25 * k, o.blurbText.maxW, '#f6e3b4');
  text('You play', o.l.you.x, o.l.you.y, 30 * k, '#f0d9a0', UI, 700, 'left');
  for (const sd of o.sides) button(sd.r, sd.label, { primary: st.human === sd.v, size: 26 });
  text('Chinese area scoring, komi ' + (KOMI[st.n] ?? 7.5), o.score.x, o.score.y, 26 * k, 'rgba(246,227,180,0.8)', UI, 500);
  button(o.start, 'Start game', { primary: true, size: 40, press: u.isPress(o.start) });
  button(o.back, 'Back', { press: u.isPress(o.back) });
}

// ---- lesson list, reader pages, settings, demo limit ------------------------------------------------------------------------
export const lessonRects = () => layout().lessonsFor(LESSONS.length).rects;
function drawLessonList(ctx, S, u) {
  const { button, title } = u, Ls = layout().lessonsFor(LESSONS.length), C = Ls.C;
  title('Learn to play', C.cx, C.titleY, C.titleSize, C.maxW);
  Ls.rects.forEach((r, i) => {
    const done = S.learned.includes(LESSONS[i].id), locked = S.demo && i >= 3;
    button(r, `${i + 1}.  ${LESSONS[i].title}${done ? '   ✓' : locked ? '   (full game)' : ''}`, { primary: !done && i === S.learned.length, size: 30, dim: locked, press: u.isPress(r) });
  });
  button(Ls.back, 'Back', { press: u.isPress(Ls.back) });
}
// About, How to play and Rules all share this one reference shape: a title, a framed reader panel with the text-size stepper
// ("A-"/"A+", up to 300%) in its top row, ONE continuous scrolling document (drag, wheel, keys, scroll bar), and a Back/Next footer.
// Next moves one screenful and becomes Done at the end; Back always leaves.
function readerScale(S) { return TEXT_SCALES[S.prefs.textScaleIdx ?? 0] ?? 1; }
export const readerInfo = { max: 0 };      // how far the document can scroll (set while drawing, read by game.js)
// The source lists are cut into very short pages; consecutive entries with the same heading (a trailing ", continued" / ", still"
// ignored) are one section, and fragments that do not end a sentence run on into one paragraph.
export function toSections(items) {
  const out = [];
  for (const it of items) {
    const heading = Array.isArray(it) ? it[0] : it.title, lines = Array.isArray(it) ? [it[1]] : it.lines, stone = Array.isArray(it) ? null : it.stone;
    const base = heading.replace(/,\s*(continued|still)$/i, ''), last = out[out.length - 1];
    if (last && last.title === base) {
      for (const ln of lines) {
        if (last.lines.length && !/[.!?:]["')]?$/.test(last.lines[last.lines.length - 1])) last.lines[last.lines.length - 1] += ' ' + ln; else last.lines.push(ln);
      }
      if (stone && !last.stone) last.stone = stone;
    } else out.push({ title: base, lines: lines.slice(), stone });
  }
  return out;
}
export const ABOUT_SECTIONS = toSections(ABOUT_TEXT), HOW_SECTIONS = toSections(HOW_TEXT), RULES_SECTIONS = toSections(RULES);
function drawReaderFrame(ctx, S, u, titleStr, content) {
  const { button, panel, isPress, title } = u, Q = layout().reader, sidx = S.prefs.textScaleIdx ?? 0;
  title(titleStr, Q.title.x, Q.title.y, Q.title.size, Q.title.maxW);
  panel(Q.panel);
  button(Q.dec, 'A−', { dim: sidx === 0, press: isPress(Q.dec), size: 28 });
  button(Q.inc, 'A+', { dim: sidx === TEXT_SCALES.length - 1, press: isPress(Q.inc), size: 28 });
  // scrolling content, clipped to the body
  const body = Q.body, scroll = clamp(S.readScroll || 0, 0, readerInfo.max);
  ctx.save(); ctx.beginPath(); ctx.rect(body.x + 6, body.y, body.w - 12, body.h); ctx.clip();
  ctx.translate(0, -scroll);
  const endY = content(Q, readerScale(S));
  ctx.restore();
  readerInfo.max = Math.max(0, Math.ceil(endY + 14 - (body.y + body.h)));
  if (readerInfo.max > 0) {
    const th = Math.max(36, body.h * body.h / (body.h + readerInfo.max)), ty = body.y + (body.h - th) * (scroll / readerInfo.max);
    ctx.fillStyle = 'rgba(246,227,180,0.12)'; ctx.beginPath(); ctx.roundRect(Q.panel.x + Q.panel.w - 16, body.y, 6, body.h, 3); ctx.fill();
    ctx.fillStyle = 'rgba(246,227,180,0.55)'; ctx.beginPath(); ctx.roundRect(Q.panel.x + Q.panel.w - 16, ty, 6, th, 3); ctx.fill();
  }
  button(PAGE_NAV.back, 'Back', { press: isPress(PAGE_NAV.back) });
  button(PAGE_NAV.next, scroll >= readerInfo.max - 2 ? 'Done' : 'Next', { primary: true, press: isPress(PAGE_NAV.next) });
}
// Reader layout cache: the wrapped document (lines + total height) is laid out once per (screen, text size, geometry, font) and reused;
// a frame draws only the visible slice. readerStats.layouts counts rebuilds (tests read it).
const readerCache = { key: '', items: [], endY: 0 };
export const readerStats = { layouts: 0 };
function wrapLines(ctx, str, maxW, size, weight, font) {
  ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), out = []; let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
  out.push(cur); return out;
}
function layoutSections(ctx, Q, sc, sections) {
  const items = []; let y = Q.body.y + 8;
  sections.forEach((sec, si) => {
    if (si) y += Math.round(30 * sc);
    // A section heading, WRAPPED (a few are too long for one line at the top text size).
    const size = Math.round(32 * sc), tlh = Math.round(size * 1.22), startY = y + Math.round(size * 0.8);
    const tl = wrapLines(ctx, sec.title, Q.textW - 6, size, 700, FONT);
    items.push({ k: 'l', ls: tl, x: Q.panel.x + Q.panel.w / 2, y: startY, size, lh: tlh, color: '#f3cf7a', align: 'center', weight: 700, font: FONT });
    y = startY + tl.length * tlh + Math.round(16 * sc);
    if (sec.stone) {
      // The stone art and its captions stay a fixed size at every text-size step; only the gap below grows with the text size.
      const cx = Q.panel.x + Q.panel.w / 2, r = 46, cy = y + 58, labelSz = 20, gap1 = 30, gap2 = 62 + Math.round(23 * (sc - 1));
      items.push({ k: 'stone', stone: sec.stone, cx, cy, r, labelSz, gap1, top: y, h: gap2 + 104 });
      y = cy + r + gap2;
    }
    const sz = Math.round(29 * sc), lh = Math.round(sz * 1.4);
    for (const para of sec.lines) {
      const ls = wrapLines(ctx, para, Q.textW, sz, 500, UI);
      items.push({ k: 'l', ls, x: Q.textX, y, size: sz, lh, color: '#f2e6cc', align: 'left', weight: 500, font: UI });
      y += ls.length * lh + Math.round(22 * sc);
    }
  });
  readerCache.items = items; readerCache.endY = y;
}
function drawSections(ctx, S, u, titleStr, sections) {
  const { text } = u;
  drawReaderFrame(ctx, S, u, titleStr, (Q, sc) => {
    ctx.font = `800 40px ${UI}`; const fk1 = ctx.measureText('Hamburgefonstiv').width;   // changes when a web font finishes loading
    ctx.font = `800 40px ${FONT}`; const fk2 = ctx.measureText('Hamburgefonstiv').width;
    const key = [titleStr, sc, Q.body.x, Q.body.y, Q.body.w, Q.textX, Q.textW, Q.panel.x, Q.panel.w, fk1, fk2].join('|');
    if (readerCache.key !== key) { readerStats.layouts++; layoutSections(ctx, Q, sc, sections); readerCache.key = key; }
    const scroll = clamp(S.readScroll || 0, 0, readerInfo.max), top = Q.body.y + scroll - 120, bot = Q.body.y + Q.body.h + scroll + 120;
    for (const it of readerCache.items) {
      if (it.k === 'l') {
        if (it.y + it.ls.length * it.lh < top || it.y - it.size > bot) continue;
        it.ls.forEach((ln, i) => { const ly = it.y + i * it.lh; if (ly > top - it.size && ly - it.size < bot) text(ln, it.x, ly, it.size, it.color, it.font, it.weight, it.align); });
      } else if (it.top + it.h >= top && it.top <= bot) {
        const { cx, cy, r, labelSz, gap1 } = it;
        if (it.stone === 'both') {
          drawStone(ctx, 1, cx - 60, cy, r, { seed: 1 }); drawStone(ctx, 2, cx + 60, cy, r, { seed: 2 });
          text('Black', cx - 60, cy + r + gap1, labelSz, 'rgba(246,227,180,0.75)', UI, 600);
          text('White', cx + 60, cy + r + gap1, labelSz, 'rgba(246,227,180,0.75)', UI, 600);
        } else drawStone(ctx, it.stone, cx, cy, r, { seed: it.stone });
      }
    }
    return readerCache.endY;
  });
}
const drawRules = (ctx, S, u) => drawSections(ctx, S, u, 'Rules', RULES_SECTIONS);

export function settingsRects() { return layout().settings.rects; }
function drawSettings(ctx, S, u) {
  const { wrap, button, title } = u, st = layout().settings, Rs = st.rects, p = S.prefs, C = st.C;
  title('Settings', C.cx, C.titleY, C.titleSize, C.maxW);
  button(Rs.sound, `Sound: ${p.sound ? 'On' : 'Muted'}`);
  button(Rs.calm, `Reduced motion: ${p.calm ? 'On' : 'Off'}`);
  button(Rs.big, `Large text: ${p.big ? 'On' : 'Off'}`);
  button(Rs.quick, `Placing stones: ${p.quick ? 'Quick (lift to play)' : 'Confirm (tap twice)'}`, { size: 27 });
  button(Rs.theme, `Board: ${THEMES[p.theme].name}`);
  button(Rs.back, 'Back', { primary: true });
  wrap('Quick place plays the stone as soon as you lift your finger. Confirm mode lets you aim first, which is easier on big boards.', st.note.x, st.note.y, 24 * Math.max(0.85, C.k), st.note.maxW, 'rgba(246,227,180,0.8)');
}
function drawDemoLimit(ctx, S, u) {
  const { wrap, panel, title } = u, d = layout().demo;
  panel(d.panel);
  title('That is the free preview', d.cx, d.panel.y + 100 * d.k, 50, d.panel.w - 40);
  wrap('You have used the free games in this web preview. Get the full game on iPhone and Android for every lesson, every level, all board sizes and a new puzzle each day.', d.cx, d.panel.y + 170 * d.k, 28, d.panel.w - 80, '#f2e6cc');
}

// ---- board scenes: play / lesson / puzzle / auto play ---------------------------------------------------------------------------
export const boardLayoutFor = (n) => boardLayout(n);
function drawBoardScene(ctx, S, u) {
  const { text, wrap, button, panel, isPress, title } = u, g = S.g, n = g.n, L = boardLayoutFor(n), scene = S.scene, calm = S.prefs.calm, big = S.prefs.big;
  const P = layout().play, tall = P.mode === 'tall';
  const lesson = scene === 'lesson' ? LESSONS[S.lesson.i] : null;
  const step = lesson ? lesson.steps[S.lesson.step] : null;
  const scoring = S.phase === 'scoring' || S.phase === 'over';
  let statusBottom = 0;     // baseline-ish bottom of the status block in the side card, so the footer caption is placed under it, never over it
  const dim = 'rgba(246,227,180,0.85)';
  for (const c of P.cards) panel(c);
  // ---- header
  if (scene === 'play' || scene === 'autoplay') {
    const names = S.two ? ['Black', 'White'] : S.human === 1 ? ['You', LEVELS[S.level].name] : [LEVELS[S.level].name, 'You'];
    [1, 2].forEach((c) => {
      const pr = P.players[c - 1], active = !scoring && g.turn === c, sr = Math.min(34, pr.h * 0.3), cx = pr.x + 18 + sr, ty = pr.y + pr.h * 0.5;
      panel(pr);
      if (active) { ctx.strokeStyle = `rgba(255,214,110,${calm ? 0.95 : 0.7 + 0.3 * Math.sin(S.t * 4)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 22); ctx.stroke(); }
      drawShadow(ctx, cx, ty, sr); drawStone(ctx, c, cx, ty, sr, { seed: c });
      const tx = cx + sr + 20, big2 = pr.h >= 100, komi = c === 2 ? `+${g.komi}` : '';
      ctx.font = `500 22px ${UI}`;
      const komiW = komi ? ctx.measureText(komi).width + 10 : 0, avail = pr.x + pr.w - 16 - tx - komiW;
      let nsz = big2 ? 34 : 30; ctx.font = `700 ${nsz}px ${FONT}`;
      while (nsz > 20 && ctx.measureText(names[c - 1]).width > avail) { nsz -= 2; ctx.font = `700 ${nsz}px ${FONT}`; }
      text(names[c - 1], tx, ty - (big2 ? 14 : 7), nsz, '#f6e3b4', FONT, 700, 'left');
      text(`Captured ${g.caps[c]}`, tx, ty + 24, big2 ? 24 : 22, dim, UI, 500, 'left');
      if (komi) text(komi, pr.x + pr.w - 14, ty - (big2 ? 14 : 7), 22, 'rgba(246,227,180,0.6)', UI, 500, 'right');
    });
    const apLeft = scene === 'autoplay' ? Math.max(0, THINK_STEPS[S.prefs.apThinkIdx] - S.ap.t) : 0;
    const dead = !tall && S.phase === 'scoring' && !S.scorer ? 'Tap a group to mark it dead or alive' : '';
    const status = scene === 'autoplay'
      ? (scoring ? (S.phase === 'over' ? 'Game over' : S.scorer ? 'Counting' : dead || 'Counting the board') : S.ap.paused ? 'Paused' : S.ap.phase === 'think' ? `Think: what would ${g.turn === 1 ? 'Black' : 'White'} play? (${apLeft.toFixed(0)}s)` : S.ap.phase === 'reveal' ? 'Here is the move about to be played' : 'Playing')
      : scoring ? (S.phase === 'over' ? 'Game over' : S.scorer ? 'Counting' : dead || 'Check the count') : S.thinking ? 'Thinking...' : `${g.turn === 1 ? 'Black' : 'White'} to play`;
    const st = P.status, line = scene === 'autoplay' ? status : `${status}   ·   Move ${g.moves + 1}`, ssz = scene === 'autoplay' ? Math.min(st.size, 24) : st.size;
    if (st.card) {
      const cw = P.players[0].w, nl = wrap(line, st.x, st.y - 8, ssz, cw, dim, ssz * 1.25, 'center', 600);
      statusBottom = st.y - 8 + (nl - 1) * ssz * 1.25 + 8;
      if (scene === 'autoplay') { text('Auto Play — watch and learn', st.x, st.y - 8 + nl * ssz * 1.25 + 8, 20, 'rgba(246,227,180,0.65)', UI, 600); statusBottom += 28; }
    } else {
      title(line, st.x, st.y, ssz, w0() - 2 * Math.max(40, layout().F.bk + 16), dim, UI, 600);
      if (scene === 'autoplay' && tall) text('Auto Play — watch and learn', st.x, st.sub, 20, 'rgba(246,227,180,0.65)', UI, 600);
    }
  } else if (lesson) {
    const hd = P.head;
    if (hd.compact) {
      title(`Lesson ${S.lesson.i + 1} of ${LESSONS.length}${lesson.steps.length > 1 ? `  ·  Step ${S.lesson.step + 1} of ${lesson.steps.length}` : ''}`, hd.cx, hd.cap, hd.capSize, hd.maxW, 'rgba(246,227,180,0.8)', UI, 600);
      title(lesson.title, hd.cx, hd.title, hd.titleSize, hd.maxW);
    } else {
      title(`Lesson ${S.lesson.i + 1} of ${LESSONS.length}`, hd.cx, hd.cap, hd.capSize, hd.maxW, 'rgba(246,227,180,0.8)', UI, 600);
      title(lesson.title, hd.cx, hd.title, hd.titleSize, hd.maxW);
      if (lesson.steps.length > 1) title(`Step ${S.lesson.step + 1} of ${lesson.steps.length}`, hd.cx, hd.step, hd.capSize, hd.maxW, 'rgba(246,227,180,0.8)', UI, 600);
    }
  } else {
    const hd = P.head;
    title('Daily puzzle', hd.cx, hd.puz, hd.puzSize, hd.maxW);
    title(S.daily.streak > 0 ? `Streak ${S.daily.streak}` : 'A new one every day', hd.cx, hd.streak, hd.compact ? 22 : 27, hd.maxW, dim, UI, 600);
  }
  // ---- board
  let glow = [];
  if (lesson && !S.lesson.done && S.lesson.showAt && step.want.at) glow = (Array.isArray(step.want.at[0]) ? step.want.at : [step.want.at]).map(([x, y]) => y * n + x);
  // Auto Play REVEAL: Go's own branching factor makes "every legal point" too dense to usefully compare against, so only the ONE point
  // about to be played is shown, reusing this same glow ring (a pass has nothing to glow: the status line says so instead).
  if (scene === 'autoplay' && S.ap.phase === 'reveal' && S.ap.chosen != null && S.ap.chosen >= 0) glow = [S.ap.chosen];
  const opts = { g, glow };
  if (scoring && S.score) { opts.dead = S.deadList; opts.owner = S.score.owner; }
  if (lesson && step.want.kind === 'libs') opts.tapped = S.lesson.tapped;
  if (scene === 'puzzle' && S.pz) opts.target = S.pz.p.target;
  drawBoardPieces(ctx, S, L, opts);
  // ---- message panel
  const apMsg = S.ap && S.ap.phase === 'reveal' ? (S.ap.chosen != null && S.ap.chosen < 0 ? `${g.turn === 1 ? 'Black' : 'White'} is about to pass.` : 'The glowing point is the move about to be played.') : 'Auto Play: the computer plays both Black and White so you can learn by watching a whole game.';
  const showMsg = !(scoring && (scene === 'play' || scene === 'autoplay'));
  let M = P.msg;
  // single-card landscape shape: the status block (a wrapped status + the Auto Play line) can run past the card's reserved band, so the
  // message panel starts below it instead of being drawn over it
  if (scene === 'autoplay' && !scoring && P.status.card && !P.caption && statusBottom + 10 > M.y) { const d = statusBottom + 10 - M.y; M = { x: M.x, y: M.y + d, w: M.w, h: Math.max(60, M.h - d) }; }
  const msg = S.msg ? S.msg.text : lesson ? step.text : scene === 'puzzle' ? puzzleText(S.pz.p) : scene === 'autoplay' ? (M.h < 150 && S.ap.phase !== 'reveal' ? 'Auto Play: the computer plays both sides. Watch and learn.' : apMsg) : S.thinking ? 'The computer is thinking...' : S.g.turn === S.human || S.two ? 'Your move. TAP a crossing to aim, then TAP it again (or press Place).' : '';
  if (showMsg) panel(M, { paper: true });
  const fs = big ? 29 : 25;
  if (showMsg) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(M.x + 10, M.y + 6, M.w - 20, M.h - 12, 14); ctx.clip();
    ctx.font = `600 ${fs}px ${UI}`;
    let lines = wrapCount(ctx, msg, M.w - 56);
    let size = fs; while (lines * size * 1.28 > M.h - 24 && size > P.msgMin) { size -= 1.5; ctx.font = `600 ${size}px ${UI}`; lines = wrapCount(ctx, msg, M.w - 56); }
    wrap(msg, M.x + M.w / 2, M.y + (M.h - lines * size * 1.28) / 2 + size * 0.98, size, M.w - 56, '#2a1a0a', size * 1.28, 'center', 600);
    ctx.restore();
  }
  // ---- bowls (the tall layout's Auto Play uses this band for the think-time stepper, so no bowls there)
  const cap1 = g.caps[1], cap2 = g.caps[2];
  if (P.bowls && (scene !== 'autoplay' || !tall)) {
    drawBowl(ctx, 1, P.bowls.a.x, P.bowls.a.y, P.bowls.a.s); drawBowl(ctx, 2, P.bowls.b.x, P.bowls.b.y, P.bowls.b.s);
    if (scene === 'play' && (cap1 || cap2)) {
      // prisoners: white stones Black has captured sit by Black's bowl, black stones White has captured by White's bowl
      const sr = tall ? 12 : 9;
      for (let k = 0; k < Math.min(cap1, 10); k++) drawStone(ctx, 2, P.bowls.a.pr.x + k * P.bowls.a.pr.dx, P.bowls.a.pr.y, sr, { seed: k });
      for (let k = 0; k < Math.min(cap2, 10); k++) drawStone(ctx, 1, P.bowls.b.pr.x + k * P.bowls.b.pr.dx, P.bowls.b.pr.y, sr, { seed: k });
    }
  }
  // ---- centre button / bottom row (Auto Play is its own thing: nothing here is ever tapped on the board)
  const cx = R.place, bsz = P.slots[0].h < 80 ? 26 : 32;
  const sizeB = (v) => Math.min(v, bsz + 4);
  if (scene === 'autoplay' && S.phase === 'over') {
    button(R.done, 'Play again', { primary: true, size: 34, press: isPress(R.done) });
    button(R.menu, 'Exit to menu', { size: 26, press: isPress(R.menu) });
  } else if (scene === 'autoplay') {
    button(AUTOPLAY.dec, '−', { size: 40, dim: S.prefs.apThinkIdx === 0, press: isPress(AUTOPLAY.dec) });
    button(AUTOPLAY.inc, '+', { size: 40, dim: S.prefs.apThinkIdx === THINK_STEPS.length - 1, press: isPress(AUTOPLAY.inc) });
    {
      // the label lives between the - and + buttons: shrink it to fit that gap, and stack it on two lines when even that is too wide
      const gap = AUTOPLAY.inc.x - (AUTOPLAY.dec.x + AUTOPLAY.dec.w) - 16, lab = `Think time: ${THINK_STEPS[S.prefs.apThinkIdx]}s`;
      let tz = P.apText.size; ctx.font = `700 ${tz}px ${FONT}`;
      while (tz > 16 && ctx.measureText(lab).width > gap) { tz -= 1; ctx.font = `700 ${tz}px ${FONT}`; }
      if (ctx.measureText(lab).width > gap) { tz = Math.min(P.apText.size, 20); ctx.font = `700 ${tz}px ${FONT}`; while (tz > 12 && ctx.measureText('Think time').width > gap) { tz -= 1; ctx.font = `700 ${tz}px ${FONT}`; } text('Think time', P.apText.x, P.apText.y - tz * 0.5, tz, '#f6e3b4'); text(`${THINK_STEPS[S.prefs.apThinkIdx]}s`, P.apText.x, P.apText.y + tz * 0.75, tz, '#f6e3b4'); }
      else text(lab, P.apText.x, P.apText.y, tz, '#f6e3b4');
    }
    button(AUTOPLAY.exit, 'Exit', { press: isPress(AUTOPLAY.exit) });
    button(AUTOPLAY.pause, S.ap.paused ? 'Resume' : 'Pause', { primary: S.ap.paused, press: isPress(AUTOPLAY.pause) });
    button(AUTOPLAY.skip, 'Skip', { dim: S.phase === 'scoring' && !!S.scorer, press: isPress(AUTOPLAY.skip) });
  } else {
    if (scoring) {
      if (S.phase === 'scoring') button(R.done, S.scorer ? 'Counting...' : 'Accept result', { primary: true, dim: !!S.scorer, size: 34, press: isPress(R.done) });
      else button(R.done, 'New game', { primary: true, size: 34, press: isPress(R.done) });
    } else if (lesson && S.lesson.done) button(R.next, S.lesson.step + 1 >= lesson.steps.length ? 'Finish lesson' : 'Next step', { primary: true, size: 36, press: isPress(R.next) });
    else if (lesson && step.want.kind === 'quiz') {
      const opts2 = step.want.options;
      opts2.forEach((o, i) => button(quizRectAt(opts2.length, i), o, { size: 38, press: isPress(quizRect(step, i)) }));
    } else if (lesson && (step.want.kind === 'libs' || step.want.kind === 'pass' || step.want.kind === 'undo' || step.want.kind === 'hint')) { /* no centre button */ }
    else {
      const has = S.pend >= 0 && !g.b[S.pend];
      button(cx, has ? 'Place' : 'Tap a point', { primary: has, dim: !has, size: has ? 40 : 27, press: isPress(cx) });
    }
    // ---- bottom row
    if (!scoring) {
      const nobody = S.thinking && scene === 'play';
      button(R.pass, 'Pass', { dim: scene === 'puzzle', press: isPress(R.pass) });
      button(R.undo, 'Undo', { dim: !S.undo.length, press: isPress(R.undo) });
      button(R.hint, S.thinkKind === 'hint' ? '...' : 'Hint', { dim: nobody, press: isPress(R.hint) });
      button(R.menu, scene === 'play' ? 'Menu' : 'Back', { press: isPress(R.menu) });
    } else if (S.phase === 'scoring') {
      if (!S.scorer) {
        button(P.halves[0], 'Keep playing', { size: 28, press: isPress(P.halves[0]) });
        button(P.halves[1], 'Menu', { press: isPress(P.halves[1]) });
      }
    } else button(R.menu, 'Menu', { press: isPress(R.menu) });
  }
  // ---- score plaque (takes the message panel's place)
  if (scoring && S.score && (scene === 'play' || scene === 'autoplay')) {
    const sc = S.score, b = sc.black, w = sc.white, k = sc.komi, win = sc.winner, by = Math.abs(sc.diff), f = Math.min(1, M.h / 122);
    const line = S.phase === 'over' ? `${win === 1 ? 'Black' : 'White'} wins by ${by}` : `${win === 1 ? 'Black' : 'White'} is ahead by ${by}`;
    ctx.fillStyle = 'rgba(20,12,8,0.8)'; ctx.beginPath(); ctx.roundRect(M.x, M.y, M.w, M.h, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(240,200,120,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    const three = tall;       // the third line (what to tap) moves to the status line in the shorter shapes
    title(line, M.x + M.w / 2, M.y + (three ? 52 : M.h * 0.42), Math.round(40 * Math.max(0.85, f)), M.w - 40, '#f3cf7a');
    title(`Black ${b}    White ${w} + ${k} komi = ${sc.whiteTotal}`, M.x + M.w / 2, M.y + (three ? 90 : M.h * 0.76), 25, M.w - 30, '#f2e6cc', UI, 600);
    if (three && S.phase === 'scoring') text(S.scorer ? 'Finding dead stones...' : 'Tap a group to mark it dead or alive', M.x + M.w / 2, M.y + 114, 20, 'rgba(246,227,180,0.75)', UI, 500);
  }
  // ---- footer caption
  const cp = P.caption;
  if (cp) {
    let line = '', col = 'rgba(246,227,180,0.6)', wt = 500, sz = cp.size;
    if (scene === 'play') line = `${n} x ${n}  ·  Chinese area scoring  ·  komi ${g.komi}`;
    else if (scene === 'puzzle') { line = S.pz.status === 'solved' ? 'Solved. Come back tomorrow for a new one.' : 'Tap a point, then Place.'; col = 'rgba(246,227,180,0.7)'; wt = 600; }
    else if (scene === 'autoplay' && S.phase !== 'over') { line = `${n} x ${n}  ·  Free, silent, never counted against your progress`; sz = Math.min(sz, 21); }
    if (line) wrap(line, cp.x, Math.max(cp.y, statusBottom + 14 + sz), sz, cp.maxW, col, sz * 1.25, 'center', wt);
  }
  if (S.thinking && scene === 'play' && !scoring) {
    const p = S.thinkProg, tb = P.think;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(tb.x, tb.y, tb.w, tb.h, tb.h / 2); ctx.fill();
    ctx.fillStyle = '#e8b85c'; ctx.beginPath(); ctx.roundRect(tb.x, tb.y, Math.max(tb.h, tb.w * p), tb.h, tb.h / 2); ctx.fill();
  }
  // the quiet "More heritage games in Arcforge" line on the finished-game screen (in the button row's free slots)
  if (scene === 'play' && S.phase === 'over') drawMore(ctx, P);
  if (S.confetti && !calm) {
    for (const c of S.confetti) { ctx.fillStyle = c.col; ctx.globalAlpha = clamp(1 - c.t / 2.4, 0, 1); ctx.fillRect(c.x, c.y, 8, 12); }
    ctx.globalAlpha = 1;
  }
}
const w0 = () => layout().w;
function drawMore(ctx, P) {
  const a = P.slots[0], z = P.slots[P.mode === 'wide' ? 1 : 2];
  drawMoreLine(ctx, (a.x + z.x + z.w) / 2, a.y + a.h / 2, 20, z.x + z.w - a.x - 8);
}
export function quizRect(step, i) { return quizRectAt(step.want.options.length, i); }
function wrapCount(ctx, str, maxW) {
  const words = str.split(' '); let cur = '', n = 1;
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { n++; cur = w; } else cur = t2; }
  return n;
}
