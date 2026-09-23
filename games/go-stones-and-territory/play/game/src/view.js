// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js).
import { W, H, R, px, py, stoneR, boardLayout, titleButtons, PAGE_NAV, TEXT_SCALES, TEXT_BTN, THINK_STEPS, REVEAL_TIME, AUTOPLAY, PLAYBOARD } from './layout.js';
import { drawTable, drawBoardLayer, drawLamp, drawStone, drawShadow, drawBowl, THEMES } from './art.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { coord, KOMI, opp } from './rules.js';
import { puzzleText } from './puzzles.js';
import { RULES } from './content.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const TITLE_L = { ...boardLayout(9, 136, 404, 448), plain: true };
// Each entry is one short, single-concept page - split fine enough (one clause or short sentence
// each) to still fit the reader panel at the top text-size step (see layout.js's TEXT_SCALES, now
// reaching 3.0 / 300%). Wording is unchanged from the original longer paragraphs; only regrouped.
export const ABOUT_TEXT = [
  ['Go, the game of stones and territory', 'Go is one of the oldest board games still played today.'],
  ['Where Go began', 'It began in China more than 2,500 years ago, where it is called Weiqi.'],
  ['Go travels to Korea', 'It travelled to Korea, where it is called Baduk,'],
  ['Go travels to Japan', 'and to Japan, where it is called Igo.'],
  ['In the culture', 'In China, Go (qi) was counted among the four arts of the scholar,'],
  ['The four arts', 'beside the zither, calligraphy and painting.'],
  ['Played everywhere', 'Across East Asia it has long been played at home, in tea houses and in clubs,'],
  ['Played by everyone', 'by children and by grandparents.'],
  ['Why it lasts', 'The rules fit on one page: place stones, surround space, capture what has no liberties.'],
  ['Bigger than the universe', 'Yet on a 19 x 19 board the number of possible'],
  ['Bigger than the universe, continued', 'positions is larger than the number of atoms'],
  ['Bigger than the universe, still', 'in the observable universe.'],
  ['Stones and boards', 'Traditional sets use slate for black stones and shell for white,'],
  ['Stones and boards, continued', 'kept in round wooden bowls.'],
  ['Fine boards', 'Fine boards are carved from a single block of wood, often kaya,'],
  ['Fine boards, continued', 'and are prized for their grain.'],
  ['Counting the score', 'China uses area scoring (stones plus territory), which is what this game uses.'],
  ['Territory and prisoners', 'Japan and Korea count territory and prisoners instead.'],
  ['Usually the same winner', 'The winner is usually the same either way.'],
];
export const HOW_TEXT = [
  ['Placing a stone', 'TAP a crossing: a ghost stone appears.'],
  ['Confirming a placement', 'TAP the same crossing again, or press PLACE, to play it.'],
  ['Dragging to aim', 'DRAG to slide the ghost, then let go: it stays until you confirm.'],
  ['Cancelling a placement', 'Drag off the board to cancel.'],
  ['Quick place', '(Settings: turn on Quick place to play as soon as you let go.)'],
  ['Buttons: Pass', 'PASS: skip your turn.'],
  ['Buttons: Pass ends the game', 'Two passes in a row end the game.'],
  ['Buttons: Undo', 'UNDO: takes back your last move (and the reply).'],
  ['Buttons: Hint', 'HINT: shows a good move with a reason.'],
  ['Buttons: Menu', 'MENU: leave the game (it is saved).'],
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
    ctx.strokeStyle = o.primary ? 'rgba(120,70,10,0.5)' : 'rgba(240,200,120,0.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 6, r.y + 6 + press, r.w - 12, r.h - 12, 15); ctx.stroke();
    const sz = (o.size ?? 32) * (big ? 1.12 : 1);
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
  if (scene === 'title') return drawTitle(ctx, S, { text, wrap, button, panel, isPress });
  if (scene === 'setup') return drawSetup(ctx, S, { text, wrap, button, panel, isPress });
  if (scene === 'lessons') return drawLessonList(ctx, S, { text, wrap, button, panel, isPress });
  if (scene === 'about') return drawReader(ctx, S, { text, wrap, button, panel, isPress }, 'About Go', ABOUT_TEXT, S.aboutPage);
  if (scene === 'how') return drawReader(ctx, S, { text, wrap, button, panel, isPress }, 'How to play', HOW_TEXT, S.howPage);
  if (scene === 'rules') return drawRules(ctx, S, { text, wrap, button, panel, isPress });
  if (scene === 'settings') return drawSettings(ctx, S, { text, wrap, button, panel });
  if (scene === 'demo-limit') return drawDemoLimit(ctx, S, { text, wrap, button, panel });
  drawBoardScene(ctx, S, { text, wrap, button, panel, isPress });
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
  const { text, button, isPress } = u, t = S.t, calm = S.prefs.calm;
  if (banner.cv === undefined || banner.cv === null) {
    banner.cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, 400) : false;
    if (banner.cv) paintBanner(banner.cv.getContext('2d'));
  }
  // the banner unrolls (ink is laid down left to right), then stays
  const rev = calm ? 1 : ease(clamp(t / 1.4, 0, 1));
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 40 + (W - 40) * rev, 400); ctx.clip();
  ctx.globalAlpha = calm ? 1 : clamp(t / 0.5, 0, 1);
  if (banner.cv) ctx.drawImage(banner.cv, 0, 0); else paintBanner(ctx);
  ctx.globalAlpha = 1; ctx.restore();
  // a demonstration game on the board, stones appearing one by one
  const L = TITLE_L;
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
  const R2 = titleButtons(!!S.saved);
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
export const SETUP = {
  size: [{ n: 9, x: 60 }, { n: 13, x: 262 }, { n: 19, x: 464 }].map((o) => ({ ...o, r: { x: o.x, y: 0, w: 196, h: 96 } })),
};
export function setupRects() {
  return {
    sizes: [9, 13, 19].map((n, i) => ({ n, r: { x: 36 + i * 220, y: 358, w: 208, h: 92 } })),
    levels: LEVELS.map((l, i) => ({ i, r: { x: 36 + (i % 2) * 330, y: 578 + Math.floor(i / 2) * 90, w: 318, h: 78 } })),
    sides: [{ v: 1, label: 'Black (first)' }, { v: 2, label: 'White' }, { v: 0, label: 'Two players' }].map((o, i) => ({ ...o, r: { x: 36 + i * 220, y: 952, w: 208, h: 88 } })),
    start: { x: 110, y: 1160, w: 500, h: 100 }, back: { x: 110, y: 1284, w: 500, h: 80 },
  };
}
function drawSetup(ctx, S, u) {
  const { text, wrap, button, panel } = u, Rs = setupRects(), st = S.setup;
  text('New game', 360, 190, 76, '#f6e3b4');
  text('Board size', 60, 340, 30, '#f0d9a0', UI, 700, 'left');
  for (const o of Rs.sizes) button(o.r, `${o.n} x ${o.n}`, { primary: st.n === o.n, size: 34 });
  const note = st.n === 9 ? 'Small and quick: the best place to start.' : st.n === 13 ? 'A medium board. The computer sees less of it, so it plays weaker.' : 'The full board. The computer is weakest here: a friendly place to practise.';
  wrap(note, 360, 490, 24, 620, 'rgba(246,227,180,0.85)');
  text('Computer level', 60, 558, 30, '#f0d9a0', UI, 700, 'left');
  for (const o of Rs.levels) button(o.r, LEVELS[o.i].name, { primary: st.level === o.i, size: 32 });
  panel({ x: 36, y: 772, w: 648, h: 112 });
  wrap(LEVELS[st.level].blurb, 360, 814, 25, 600, '#f6e3b4');
  text('You play', 60, 932, 30, '#f0d9a0', UI, 700, 'left');
  for (const o of Rs.sides) button(o.r, o.label, { primary: st.human === o.v, size: 26 });
  text('Chinese area scoring, komi ' + (KOMI[st.n] ?? 7.5), 360, 1096, 26, 'rgba(246,227,180,0.8)', UI, 500);
  button(Rs.start, 'Start game', { primary: true, size: 40, press: u.isPress(Rs.start) });
  button(Rs.back, 'Back', { press: u.isPress(Rs.back) });
}

// ---- lesson list, reader pages, settings, demo limit ------------------------------------------------------------------------
export const lessonRects = () => LESSONS.map((_, i) => ({ x: 36, y: 250 + i * 88, w: 648, h: 78 }));
function drawLessonList(ctx, S, u) {
  const { text, button } = u;
  text('Learn to play', 360, 190, 70, '#f6e3b4');
  lessonRects().forEach((r, i) => {
    const done = S.learned.includes(LESSONS[i].id), locked = S.demo && i >= 3;
    button(r, `${i + 1}.  ${LESSONS[i].title}${done ? '   ✓' : locked ? '   (full game)' : ''}`, { primary: !done && i === S.learned.length, size: 30, dim: locked, press: u.isPress(r) });
  });
  button({ x: 110, y: 1230, w: 500, h: 84 }, 'Back', { press: u.isPress({ x: 110, y: 1230, w: 500, h: 84 }) });
}
// About, How to play and Rules all share this one reference-page shape: a big title, a framed
// reader-card panel, a text-size stepper ("A-"/"A+") flanking the title so it is right where a
// player is reading, and a Back/Next footer that pages one topic at a time (same convention for
// all three, and the same one chess-royal-sixty-four uses for its own reference pages).
function readerScale(S) { return TEXT_SCALES[S.prefs.textScaleIdx ?? 0] ?? 1; }
function drawPageHeader(ctx, u, S, title) {
  const { button, isPress } = u, idx = S.prefs.textScaleIdx ?? 0;
  // The banner title shrinks to fit the gap between the two stepper buttons - "How to play" is
  // wide enough at the usual 70px to otherwise run under "A+"/"A-".
  const maxW = TEXT_BTN.inc.x - (TEXT_BTN.dec.x + TEXT_BTN.dec.w) - 40;
  let size = 70;
  ctx.font = `700 ${size}px ${FONT}`;
  while (ctx.measureText(title).width > maxW && size > 38) { size -= 2; ctx.font = `700 ${size}px ${FONT}`; }
  ctx.textAlign = 'center'; ctx.fillStyle = '#f6e3b4'; ctx.fillText(title, 360, 176);
  button(TEXT_BTN.dec, 'A−', { dim: idx === 0, press: isPress ? isPress(TEXT_BTN.dec) : false, size: 30 });
  button(TEXT_BTN.inc, 'A+', { dim: idx === TEXT_SCALES.length - 1, press: isPress ? isPress(TEXT_BTN.inc) : false, size: 30 });
}
function drawPageFooter(ctx, u, idx, total) {
  const { text, button, isPress } = u;
  text(`Page ${idx + 1} of ${total}`, 360, 1320, 21, 'rgba(246,227,180,0.65)', UI, 500);
  button(PAGE_NAV.back, 'Back', { press: isPress ? isPress(PAGE_NAV.back) : false });
  button(PAGE_NAV.next, 'Next', { primary: true, press: isPress ? isPress(PAGE_NAV.next) : false });
}
// The in-panel page/section title: WRAPPED (never a single fixed-width line), because a few of
// these headings ("Go, the game of stones and territory") are too long to fit on one line once
// the top text-size step makes the font big - wrapping instead of overflowing keeps every title on
// screen and inside the panel. Returns the y where the body content below it can safely start.
function drawPageTitle(ctx, u, titleStr, scale) {
  const { wrap } = u, size = Math.round(32 * scale), lh = Math.round(size * 1.22);
  // The first title line's baseline has to move down as `size` grows, or its own cap-height pokes
  // up above the reader panel's top edge (y=214) at a big scale - this keeps the same ~28px margin
  // above the panel top that the old hardcoded "268" baseline (scale 1) happened to give it.
  const startY = 214 + 28 + Math.round(size * 0.8);
  const lines = wrap(titleStr, 360, startY, size, 604, '#f3cf7a', lh, 'center', 700, FONT);
  return startY + lines * lh + Math.round(16 * scale);
}
// About / How to play: one topic per page (each [heading, body] entry in ABOUT_TEXT/HOW_TEXT is
// already a single self-contained concept), paginated with wraparound like Rules below.
function drawReader(ctx, S, u, title, items, page) {
  const { wrap, panel } = u, scale = readerScale(S);
  const idx = ((page % items.length) + items.length) % items.length, [heading, body] = items[idx];
  drawPageHeader(ctx, u, S, title);
  panel({ x: 36, y: 214, w: 648, h: 1132 });
  const bodyY = drawPageTitle(ctx, u, heading, scale);
  const sz = Math.round(29 * scale), lh = Math.round(sz * 1.4);
  wrap(body, 64, bodyY, sz, 592, '#f2e6cc', lh, 'left', 500);
  drawPageFooter(ctx, u, idx, items.length);
}
// One topic per screen, paginated: Back exits to the title, Next cycles forward through the pages
// with wraparound (the same convention chess-royal-sixty-four uses for its own Rules page).
export function rulesPageCount() { return RULES.length; }
function drawRules(ctx, S, u) {
  const { text, wrap, panel } = u, scale = readerScale(S);
  const idx = ((S.rulesPage % RULES.length) + RULES.length) % RULES.length, page = RULES[idx];
  drawPageHeader(ctx, u, S, 'Rules');
  panel({ x: 36, y: 214, w: 648, h: 1132 });
  let y = drawPageTitle(ctx, u, page.title, scale);
  if (page.stone) {
    // The stone art, its fixed 300/420 x-positions and its "Black"/"White" caption all stay a
    // fixed size at every text-size step (this is a small picture with a label, not primary
    // reading text - and at a big scale a caption that grew with `scale` would itself be too wide
    // for the 120px gap between the two stones' fixed centres). Only the gap between the caption
    // and the body text below it has to grow, to clear the bigger body text's own taller ascent.
    const r = 46, cy = y + 58, labelSz = 20, gap1 = 30;
    const gap2 = 62 + Math.round(23 * (scale - 1));
    if (page.stone === 'both') {
      drawStone(ctx, 1, 300, cy, r, { seed: 1 });
      drawStone(ctx, 2, 420, cy, r, { seed: 2 });
      text('Black', 300, cy + r + gap1, labelSz, 'rgba(246,227,180,0.75)', UI, 600);
      text('White', 420, cy + r + gap1, labelSz, 'rgba(246,227,180,0.75)', UI, 600);
    } else {
      drawStone(ctx, page.stone, 360, cy, r, { seed: page.stone });
    }
    y = cy + r + gap2;
  }
  const sz = Math.round(29 * scale), lh = Math.round(sz * 1.4);
  for (const para of page.lines) {
    const lines = wrap(para, 64, y, sz, 592, '#f2e6cc', lh, 'left', 500);
    y += lines * lh + Math.round(22 * scale);
  }
  drawPageFooter(ctx, u, idx, RULES.length);
}
export function settingsRects() {
  const names = ['sound', 'calm', 'big', 'quick', 'theme'];
  const out = {}; names.forEach((k, i) => { out[k] = { x: 60, y: 260 + i * 118, w: 600, h: 96 }; });
  out.back = { x: 110, y: 1000, w: 500, h: 84 }; return out;
}
function drawSettings(ctx, S, u) {
  const { text, wrap, button } = u, Rs = settingsRects(), p = S.prefs;
  text('Settings', 360, 176, 70, '#f6e3b4');
  button(Rs.sound, `Sound: ${p.sound ? 'On' : 'Muted'}`);
  button(Rs.calm, `Reduced motion: ${p.calm ? 'On' : 'Off'}`);
  button(Rs.big, `Large text: ${p.big ? 'On' : 'Off'}`);
  button(Rs.quick, `Placing stones: ${p.quick ? 'Quick (lift to play)' : 'Confirm (tap twice)'}`, { size: 27 });
  button(Rs.theme, `Board: ${THEMES[p.theme].name}`);
  button(Rs.back, 'Back', { primary: true });
  wrap('Quick place plays the stone as soon as you lift your finger. Confirm mode lets you aim first, which is easier on big boards.', 360, 866, 24, 600, 'rgba(246,227,180,0.8)');
}
function drawDemoLimit(ctx, S, u) {
  const { text, wrap, button, panel } = u;
  panel({ x: 60, y: 420, w: 600, h: 520 });
  text('That is the free preview', 360, 520, 50, '#f6e3b4');
  wrap('You have used the free games in this web preview. Get the full game on iPhone and Android for every lesson, every level, all board sizes and a new puzzle each day.', 360, 590, 28, 520, '#f2e6cc');
}

// ---- board scenes: play / lesson / puzzle ---------------------------------------------------------------------------------
export const boardLayoutFor = (n) => boardLayout(n);
function drawBoardScene(ctx, S, u) {
  const { text, wrap, button, panel, isPress } = u, g = S.g, n = g.n, L = boardLayoutFor(n), scene = S.scene, calm = S.prefs.calm, big = S.prefs.big;
  const lesson = scene === 'lesson' ? LESSONS[S.lesson.i] : null;
  const step = lesson ? lesson.steps[S.lesson.step] : null;
  const scoring = S.phase === 'scoring' || S.phase === 'over';
  // ---- header
  if (scene === 'play' || scene === 'autoplay') {
    const names = S.two ? ['Black', 'White'] : S.human === 1 ? ['You', LEVELS[S.level].name] : [LEVELS[S.level].name, 'You'];
    [1, 2].forEach((c) => {
      const x = c === 1 ? 24 : 372, active = !scoring && g.turn === c;
      panel({ x, y: 118, w: 324, h: 112 });
      if (active) { ctx.strokeStyle = `rgba(255,214,110,${calm ? 0.95 : 0.7 + 0.3 * Math.sin(S.t * 4)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(x, 118, 324, 112, 22); ctx.stroke(); }
      drawShadow(ctx, x + 62, 174, 34); drawStone(ctx, c, x + 62, 174, 34, { seed: c });
      text(names[c - 1], x + 116, 160, 34, '#f6e3b4', FONT, 700, 'left');
      text(`Captured ${g.caps[c]}`, x + 116, 198, 24, 'rgba(246,227,180,0.85)', UI, 500, 'left');
      if (c === 2) text(`+${g.komi}`, x + 296, 198, 22, 'rgba(246,227,180,0.6)', UI, 500, 'right');
    });
    const apLeft = scene === 'autoplay' ? Math.max(0, THINK_STEPS[S.prefs.apThinkIdx] - S.ap.t) : 0;
    const status = scene === 'autoplay'
      ? (scoring ? (S.phase === 'over' ? 'Game over' : S.scorer ? 'Counting' : 'Counting the board') : S.ap.paused ? 'Paused' : S.ap.phase === 'think' ? `Think: what would ${g.turn === 1 ? 'Black' : 'White'} play? (${apLeft.toFixed(0)}s)` : S.ap.phase === 'reveal' ? 'Here is the move about to be played…' : 'Playing…')
      : scoring ? (S.phase === 'over' ? 'Game over' : S.scorer ? 'Counting' : 'Check the count') : S.thinking ? 'Thinking...' : `${g.turn === 1 ? 'Black' : 'White'} to play`;
    text(scene === 'autoplay' ? status : `${status}   ·   Move ${g.moves + 1}`, 360, 278, scene === 'autoplay' ? 24 : 27, 'rgba(246,227,180,0.9)', UI, 600);
    if (scene === 'autoplay') text('Auto Play — watch and learn', 360, 306, 20, 'rgba(246,227,180,0.65)', UI, 600);
  } else if (lesson) {
    text(`Lesson ${S.lesson.i + 1} of ${LESSONS.length}`, 360, 152, 26, 'rgba(246,227,180,0.8)', UI, 600);
    text(lesson.title, 360, 226, 64, '#f6e3b4');
    if (lesson.steps.length > 1) text(`Step ${S.lesson.step + 1} of ${lesson.steps.length}`, 360, 282, 26, 'rgba(246,227,180,0.8)', UI, 600);
  } else {
    text('Daily puzzle', 360, 200, 68, '#f6e3b4');
    text(S.daily.streak > 0 ? `Streak ${S.daily.streak}` : 'A new one every day', 360, 262, 27, 'rgba(246,227,180,0.85)', UI, 600);
  }
  // ---- board
  let glow = [];
  if (lesson && !S.lesson.done && S.lesson.showAt && step.want.at) glow = step.want.at.map(([x, y]) => y * n + x);
  // Auto Play REVEAL: Go's own branching factor makes "every legal point" (often 50-70+ empty
  // crossings) too dense to usefully compare against - unlike a board game with a handful of legal
  // moves, that would just be most of the board. So only the ONE point about to be played is shown,
  // reusing this same glow ring (a pass has nothing to glow: the status line above says so instead).
  if (scene === 'autoplay' && S.ap.phase === 'reveal' && S.ap.chosen != null && S.ap.chosen >= 0) glow = [S.ap.chosen];
  const opts = { g, glow };
  if (scoring && S.score) { opts.dead = S.deadList; opts.owner = S.score.owner; }
  if (lesson && step.want.kind === 'libs') opts.tapped = S.lesson.tapped;
  if (scene === 'puzzle' && S.pz) opts.target = S.pz.p.target;
  drawBoardPieces(ctx, S, L, opts);
  // ---- message panel
  const apMsg = S.ap && S.ap.phase === 'reveal' ? (S.ap.chosen != null && S.ap.chosen < 0 ? `${g.turn === 1 ? 'Black' : 'White'} is about to pass.` : 'The glowing point is the move about to be played.') : 'Auto Play: the computer plays both Black and White so you can learn by watching a whole game.';
  const msg = S.msg ? S.msg.text : lesson ? step.text : scene === 'puzzle' ? puzzleText(S.pz.p) : scene === 'autoplay' ? apMsg : S.thinking ? 'The computer is thinking...' : S.g.turn === S.human || S.two ? 'Your move. TAP a crossing to aim, then TAP it again (or press Place).' : '';
  const showMsg = !(scoring && (scene === 'play' || scene === 'autoplay'));
  if (showMsg) panel(R.msg, { paper: true });
  const fs = big ? 29 : 25;
  if (showMsg) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(R.msg.x + 10, R.msg.y + 6, R.msg.w - 20, R.msg.h - 12, 14); ctx.clip();
  const lh = fs * 1.28;
  ctx.font = `600 ${fs}px ${UI}`;
  let lines = wrapCount(ctx, msg, R.msg.w - 56);
  let size = fs; while (lines * size * 1.28 > R.msg.h - 24 && size > 17) { size -= 1.5; ctx.font = `600 ${size}px ${UI}`; lines = wrapCount(ctx, msg, R.msg.w - 56); }
  wrap(msg, 360, R.msg.y + (R.msg.h - lines * size * 1.28) / 2 + size * 0.98, size, R.msg.w - 56, '#2a1a0a', size * 1.28, 'center', 600);
  ctx.restore();
  }
  // ---- bowls (Auto Play repurposes this band for the think-time stepper - see the centre-button
  // block below - so the bowls would otherwise sit right under the stepper buttons and clash)
  if (scene !== 'autoplay') { drawBowl(ctx, 1, 128, 1178, 0.62 + (g.caps[2] ? 0 : 0)); drawBowl(ctx, 2, 592, 1178, 0.62); }
  const cap1 = g.caps[1], cap2 = g.caps[2];
  if (scene === 'play' && (cap1 || cap2)) {
    // prisoners: white stones Black has captured sit by Black's bowl, black stones White has captured by White's bowl
    for (let k = 0; k < Math.min(cap1, 10); k++) drawStone(ctx, 2, 62 + k * 13, 1254, 12, { seed: k });
    for (let k = 0; k < Math.min(cap2, 10); k++) drawStone(ctx, 1, 658 - k * 13, 1254, 12, { seed: k });
  }
  // ---- centre button / bottom row (Auto Play is its own thing: nothing here is ever tapped on
  // the board, so it gets its own controls entirely rather than threading into the chains below)
  const cx = R.place;
  if (scene === 'autoplay' && S.phase === 'over') {
    button(R.done, 'Play again', { primary: true, size: 34, press: isPress(R.done) });
    button(R.menu, 'Exit to menu', { size: 26, press: isPress(R.menu) });
  } else if (scene === 'autoplay') {
    // The stepper takes over the centre "Place" band.
    button(AUTOPLAY.dec, '−', { size: 40, dim: S.prefs.apThinkIdx === 0, press: isPress(AUTOPLAY.dec) });
    button(AUTOPLAY.inc, '+', { size: 40, dim: S.prefs.apThinkIdx === THINK_STEPS.length - 1, press: isPress(AUTOPLAY.inc) });
    text(`Think time: ${THINK_STEPS[S.prefs.apThinkIdx]}s`, 360, 1174, 25, '#f6e3b4');
    button(AUTOPLAY.exit, 'Exit', { press: isPress(AUTOPLAY.exit) });
    button(AUTOPLAY.pause, S.ap.paused ? 'Resume' : 'Pause', { primary: S.ap.paused, press: isPress(AUTOPLAY.pause) });
    button(AUTOPLAY.skip, 'Skip', { dim: S.phase === 'scoring' && !!S.scorer, press: isPress(AUTOPLAY.skip) });
  } else {
    if (scoring) {
      if (S.phase === 'scoring') button(R.done, S.scorer ? 'Counting...' : 'Accept result', { primary: true, dim: !!S.scorer, size: 34, press: isPress(R.done) });
      else button(R.done, 'New game', { primary: true, size: 34, press: isPress(R.done) });
    } else if (lesson && S.lesson.done) button(R.next, S.lesson.step + 1 >= lesson.steps.length ? 'Finish lesson' : 'Next step', { primary: true, size: 36, press: isPress(R.next) });
    else if (lesson && step.want.kind === 'quiz') {
      const opts2 = step.want.options; const w = Math.min(210, (600 - (opts2.length - 1) * 12) / opts2.length), tot = opts2.length * w + (opts2.length - 1) * 12;
      opts2.forEach((o, i) => button({ x: 360 - tot / 2 + i * (w + 12), y: 1118, w, h: 104 }, o, { size: 38, press: isPress(quizRect(step, i)) }));
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
        button({ x: 36, y: 1290, w: 300, h: 84 }, 'Keep playing', { size: 28, press: isPress({ x: 36, y: 1290, w: 300, h: 84 }) });
        button({ x: 384, y: 1290, w: 300, h: 84 }, 'Menu', { press: isPress({ x: 384, y: 1290, w: 300, h: 84 }) });
      }
    } else button(R.menu, 'Menu', { press: isPress(R.menu) });
  }
  // ---- score plaque
  if (scoring && S.score && (scene === 'play' || scene === 'autoplay')) {
    const sc = S.score, b = sc.black, w = sc.white, k = sc.komi, win = sc.winner;
    const by = Math.abs(sc.diff);
    const line = S.phase === 'over' ? `${win === 1 ? 'Black' : 'White'} wins by ${by}` : `${win === 1 ? 'Black' : 'White'} is ahead by ${by}`;
    ctx.fillStyle = 'rgba(20,12,8,0.8)'; ctx.beginPath(); ctx.roundRect(36, 972, 648, 122, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(240,200,120,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    text(line, 360, 1024, 40, '#f3cf7a', FONT, 700);
    text(`Black ${b}    White ${w} + ${k} komi = ${sc.whiteTotal}`, 360, 1062, 25, '#f2e6cc', UI, 600);
    if (S.phase === 'scoring') text(S.scorer ? 'Finding dead stones...' : 'Tap a group to mark it dead or alive', 360, 1086, 20, 'rgba(246,227,180,0.75)', UI, 500);
  }
  // ---- footer caption
  if (scene === 'play') text(`${n} x ${n}  ·  Chinese area scoring  ·  komi ${g.komi}`, 360, 1440, 24, 'rgba(246,227,180,0.6)', UI, 500);
  else if (scene === 'puzzle') text(S.pz.status === 'solved' ? 'Solved. Come back tomorrow for a new one.' : 'Tap a point, then Place.', 360, 1440, 24, 'rgba(246,227,180,0.7)', UI, 600);
  else if (scene === 'autoplay' && S.phase !== 'over') text(`${n} x ${n}  ·  Free, silent, never counted against your progress`, 360, 1440, 21, 'rgba(246,227,180,0.6)', UI, 500);
  if (S.thinking && scene === 'play' && !scoring) {
    const p = S.thinkProg;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.roundRect(210, 1478, 300, 12, 6); ctx.fill();
    ctx.fillStyle = '#e8b85c'; ctx.beginPath(); ctx.roundRect(210, 1478, Math.max(12, 300 * p), 12, 6); ctx.fill();
  }
  if (S.confetti && !calm) {
    for (const c of S.confetti) { ctx.fillStyle = c.col; ctx.globalAlpha = clamp(1 - c.t / 2.4, 0, 1); ctx.fillRect(c.x, c.y, 8, 12); }
    ctx.globalAlpha = 1;
  }
}
export function quizRect(step, i) {
  const opts2 = step.want.options; const w = Math.min(210, (600 - (opts2.length - 1) * 12) / opts2.length), tot = opts2.length * w + (opts2.length - 1) * 12;
  return { x: 360 - tot / 2 + i * (w + 12), y: 1118, w, h: 104 };
}
function wrapCount(ctx, str, maxW) {
  const words = str.split(' '); let cur = '', n = 1;
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { n++; cur = w; } else cur = t2; }
  return n;
}
