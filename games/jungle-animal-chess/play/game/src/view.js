// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, inRect, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawWater, drawPiece, drawDiagram, diagramSize, blob, THEMES, TEAM } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { NAMES, TERR, WATER, TRAP1, TRAP2, rankOf, sideOf, pieceCount } from './rules.js';
import { LEVELS } from './ai.js';
import { drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = 'Fredoka, "Trebuchet MS", system-ui, sans-serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#ffdf85', CREAM = '#fff8e6', DIM = 'rgba(255,238,185,0.78)';
const TAU = Math.PI * 2;
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, g = state.game, a = state.anim, B = L.board;
  const minU = Math.max(12, 11 / (host.px || 0.6));
  const theme = state.theme, style = state.style;

  // ---------------------------------------------------------------- helpers
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fitText = (str, x, y, size, maxW, color, font = UI, weight = 700, align = 'center', min = minU) => {
    const s = memo(`f|${str}|${size}|${maxW}|${font}|${weight}|${min}`, () => { let q = size; ctx.font = `${weight} ${q}px ${font}`; while (q > min && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `${weight} ${q}px ${font}`; } return q; });
    text(str, x, y, s, color, font, weight, align); return s;
  };
  const lines = (str, size, maxW, weight = 600, font = UI) => memo(`l|${weight}|${size}|${maxW}|${font}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  });
  const wrapBox = (str, r, size, lhRatio, color, align = 'center', min = minU, valign = 'middle') => {
    const s = memo(`b|${str}|${size}|${r.w}|${r.h}|${lhRatio}|${min}`, () => { let q = size, l2 = lines(str, q, r.w); while (q > min && (l2.length * q * lhRatio > r.h || l2.some((l) => ctx.measureText(l).width > r.w + 0.5))) { q -= 1; l2 = lines(str, q, r.w); } return q; });
    const ls = lines(str, s, r.w), lh = s * lhRatio, x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
    const y0 = valign === 'middle' ? r.y + (r.h - ls.length * lh) / 2 : r.y;
    ls.forEach((ln, i) => text(ln, x, y0 + s * 0.85 + i * lh, s, color, UI, 600, align));
    return ls.length;
  };
  const panel = (r, rad = 18, fill = 'rgba(5,28,16,0.66)', stroke = 'rgba(255,224,130,0.26)', brand = true) => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(20, r.h / 2.6);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f7b348'); gr.addColorStop(1, '#c5691a'); } else if (o.on) { gr.addColorStop(0, '#6d8f2a'); gr.addColorStop(1, '#3b5a14'); } else { gr.addColorStop(0, '#2f7a52'); gr.addColorStop(1, '#154a30'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,235,170,0.85)' : 'rgba(255,224,130,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary ? '#2b1604' : CREAM, cy = r.y + r.h / 2;
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${FONT}`; return ctx.measureText(str).width; };
    let s1 = size; while (s1 > minU && w1(label, s1) > maxW) s1 -= 1;
    let best = { s: s1, ls: [label] };
    if (s1 < size * 0.74) {
      const ws = label.split(' ');
      for (let cut = 1; cut < ws.length; cut++) {
        const ls = [ws.slice(0, cut).join(' '), ws.slice(cut).join(' ')]; let s2 = size;
        while (s2 > minU && (Math.max(w1(ls[0], s2), w1(ls[1], s2)) > maxW || s2 * 2.25 > r.h)) s2 -= 1;
        if (s2 > best.s) best = { s: s2, ls };
      }
    }
    if (o.sub && best.ls.length === 1) { text(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s, col, FONT, 700); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, o.primary ? 'rgba(43,22,4,0.85)' : DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, FONT, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, FONT, 700));
    ctx.restore();
  };

  // ---------------------------------------------------------------- scenes
  drawTable(ctx, L, state.t, theme);
  if (!state.calm) fireflies(ctx, L, state.t);

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(5,20,12,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(5,28,16,0.58)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(5,28,16,0.74)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Jungle on iPhone and Android for unlimited games, all five computer levels and every lesson.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
      button(Rr.two, 'Two players', { size: 26 }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26 });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
      button(Rr.rules, 'Rules', { size: 26 }); button(Rr.how, 'How to Play', { size: 26 });
      button(Rr.about, 'About', { size: 26 }); button(Rr.settings, 'Settings', { size: 26 });
      if (state.msg) fitText(state.msg.text, L.w / 2, T.rows.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    // the Arcforge lockup, bottom centre under the menu
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 4.6, r.h / 3.7), 44, 150);
    const y0 = r.y + ts * 0.86;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 5;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.15); grad.addColorStop(0, '#fff6c8'); grad.addColorStop(0.55, '#ffd25a'); grad.addColorStop(1, '#f08d28');
    ctx.lineWidth = ts * 0.1; ctx.strokeStyle = '#4a2406'; ctx.lineJoin = 'round'; ctx.font = `700 ${ts}px ${FONT}`; ctx.textAlign = 'center';
    let jw = ctx.measureText('Jungle').width; const jts = jw > r.w - 10 ? ts * (r.w - 10) / jw : ts; ctx.font = `700 ${jts}px ${FONT}`; ctx.lineWidth = jts * 0.1;
    ctx.strokeText('Jungle', cx, y0); ctx.fillStyle = grad; ctx.fillText('Jungle', cx, y0);
    ctx.restore();
    const sub = Math.max(minU, ts * 0.2);
    const py = y0 + ts * 0.16, pw = Math.min(r.w * 0.64, ts * 3.7);
    ctx.save();
    const pg = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0); pg.addColorStop(0, '#e2584a'); pg.addColorStop(1, '#c43b2c');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.8, sub * 0.9); ctx.fill(); ctx.strokeStyle = 'rgba(255,225,160,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.font = `700 ${sub}px ${FONT}`; ctx.fillStyle = '#fff6dc'; ctx.textAlign = 'center';
    const dsq = 'D O U   S H O U   Q I'; ctx.fillText(dsq, cx, py + sub * 1.26);
    fitText("China's animal-rank board game", cx, py + sub * 1.8 + ts * 0.3, ts * 0.2, r.w - 20, 'rgba(255,238,185,0.92)', FONT, 600);
    const top = py + sub * 1.8 + ts * 0.5, room = r.y + r.h - top;
    if (room > 90) heroBoard(R(r.x, top + 6, r.w, room - 22));
  }

  function heroBoard(r) {
    const cols = 7, rows = 3, cell = clamp(Math.min((r.w - 24) / (cols + 0.4), (r.h - 14) / (rows + 0.45), 118), 30, 118);
    const bw = cols * cell, bh = rows * cell, x0 = r.x + (r.w - bw) / 2, y0 = r.y + (r.h - bh) / 2 + 4;
    const T = state.calm ? 3.1 : state.t % 9, th = THEMES[theme] || THEMES.meadow;
    ctx.save();
    const m = cell * 0.2, pw = bw + 2 * m, ph = bh + 2 * m, px0 = x0 - m, py0 = y0 - m;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(px0 + 4, py0 + 12, pw, ph + 6, 16); ctx.fill();
    const fg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + ph); fg.addColorStop(0, th.frame[0]); fg.addColorStop(1, th.frame[2]);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(px0, py0, pw, ph, 16); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const gg = ctx.createLinearGradient(x0, y0, x0 + bw, y0 + bh); gg.addColorStop(0, th.grass[0]); gg.addColorStop(1, th.grass[2]);
    ctx.fillStyle = gg; ctx.fillRect(x0, y0, bw, bh);
    ctx.strokeStyle = th.line; ctx.lineWidth = Math.max(1.5, cell * 0.03); ctx.beginPath();
    for (let i = 0; i <= rows; i++) { ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + bw, y0 + i * cell); }
    for (let j = 0; j <= cols; j++) { ctx.moveTo(x0 + j * cell, y0); ctx.lineTo(x0 + j * cell, y0 + bh); }
    ctx.stroke();
    // a little lake in the middle of the top row
    ctx.save(); ctx.beginPath(); ctx.roundRect(x0 + 2 * cell + 4, y0 + 4, 3 * cell - 8, cell - 8, cell * 0.2); ctx.clip();
    const wg = ctx.createLinearGradient(0, y0, 0, y0 + cell); wg.addColorStop(0, th.water[0]); wg.addColorStop(1, th.water[2]); ctx.fillStyle = wg; ctx.fillRect(x0, y0, bw, cell);
    if (!state.calm) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let s = 0; s <= 16; s++) { const xx = x0 + 2 * cell + (s / 16) * 3 * cell, yy = y0 + cell * (0.3 + 0.2 * k) + Math.sin(s * 0.8 + T * 2 + k) * 3; if (s) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); } }
    ctx.restore();
    const at = (r2, c) => ({ x: x0 + (c + 0.5) * cell, y: y0 + (r2 + 0.5) * cell });
    // script: the red rat walks along the middle row and eats the blue elephant; the tiger and lion look on
    const hitT = 3.1, resetT = 6.6;
    const op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.6) : 1;
    ctx.globalAlpha = op;
    const bob = (k) => (state.calm ? 0 : Math.sin(state.t * 2.2 + k) * 0.05);
    const p1 = at(0, 0), p2 = at(0, 6);
    drawPiece(ctx, 2, 7, style, p1.x, p1.y + cell * 0.05, cell, { lift: 0.0 + bob(1) });
    drawPiece(ctx, 1, 6, style, p2.x, p2.y + cell * 0.05, cell, { lift: 0.0 + bob(2) });
    const pe = at(1, 5), pd = at(2, 1), pk = at(2, 5);
    drawPiece(ctx, 1, 3, style, pd.x, pd.y, cell, { lift: bob(3) }); drawPiece(ctx, 2, 5, style, pk.x, pk.y, cell, { lift: bob(4) });
    // the walking rat: steps at 1.1, 1.7, 2.3, 2.9 then eats at 3.1
    const stepsAt = [0.9, 1.5, 2.1, 2.7]; let col = 1, lift = 0;
    for (let k = 0; k < stepsAt.length; k++) { if (T >= stepsAt[k] + 0.4) col = 2 + k; else if (T >= stepsAt[k]) { const f = (T - stepsAt[k]) / 0.4; col = 1 + k + ease(f); lift = Math.sin(Math.PI * f) * 0.6; break; } }
    if (T >= hitT) { col = 5; }
    const rx = x0 + (col + 0.5) * cell, ry = y0 + (1 + 0.5) * cell;
    if (T < hitT) drawPiece(ctx, 2, 8, style, pe.x, pe.y, cell, { lift: bob(5) });
    else { const f = (T - hitT) / 0.75; if (f < 1) capFx(ctx, style, 2, 8, pe.x, pe.y, cell, f, state.calm, 3); }
    drawPiece(ctx, 1, 1, style, T >= hitT ? pe.x : rx, T >= hitT ? pe.y : ry, cell, { lift: lift + (T > hitT && T < hitT + 0.5 ? Math.sin(((T - hitT) / 0.5) * Math.PI) * 0.7 : 0) });
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const cell = B.cell;
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }

    // ---- the board scene (shaken a little on a capture)
    ctx.save();
    if (a && a.cap && !state.calm && a.t > a.glide && a.t < a.glide + 0.35) { const f = (a.t - a.glide) / 0.35; ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.04, Math.cos(f * 38) * (1 - f) * cell * 0.028); }
    drawBoard(ctx, B, theme);
    drawWater(ctx, B, state.t, state.calm);
    const last = a ? null : g.last;
    if (last && !isLesson) { for (const q of [last.from, last.to]) { const p = L.sq(q); ctx.fillStyle = 'rgba(255,230,110,0.26)'; ctx.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); } }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    // selected animal: legal squares
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel); ctx.fillStyle = `rgba(255,236,120,${0.3 + pulse * 0.14})`; ctx.fillRect(sp.x - cell / 2, sp.y - cell / 2, cell, cell);
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (!m.cap) { ctx.fillStyle = `rgba(255,252,220,${0.6 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(20,60,20,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) { const p = L.sq(q); ctx.fillStyle = `rgba(90,235,150,${0.3 + pulse * 0.2})`; ctx.fillRect(p.x - cell / 2, p.y - cell / 2, cell, cell); ctx.strokeStyle = 'rgba(90,235,150,0.95)'; ctx.lineWidth = 3; ctx.strokeRect(p.x - cell / 2 + 2, p.y - cell / 2 + 2, cell - 4, cell - 4); }
    // animals, far rows first (a lower token overlaps the one above it)
    const movingTo = a ? a.to : -1, dragging = state.drag && state.sel >= 0;
    for (let rr = 0; rr < 9; rr++) for (let cc = 0; cc < 7; cc++) {
      const i = (L.flip ? 8 - rr : rr) * 7 + (L.flip ? 6 - cc : cc), v = g.board[i];
      if (!v || i === movingTo || (a && i === a.from)) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i, rank = rankOf(v), sd = sideOf(v);
      const swim = rank === 1 && TERR[i] === WATER, trapped = (sd === 1 && TERR[i] === TRAP2) || (sd === 2 && TERR[i] === TRAP1);
      const lift = sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : swim && !state.calm ? Math.sin(state.t * 2 + i) * 0.04 : 0;
      drawPiece(ctx, sd, rank, style, p.x, p.y, cell, { lift, glow: sel ? 0.8 : 0, swim, trapped });
      if (swim) ripple(p.x, p.y + cell * 0.12, cell, state.t + i);
      if (state.marks && !over && !a && state.danger && state.danger.has(i)) dangerMark(p.x + cell * 0.3, p.y - cell * 0.4, cell);
    }
    // the eaten animal stays until the mover lands, then flashes and puffs away
    if (a && a.cap) {
      const p = L.sq(a.to);
      if (a.t < a.glide * 0.85) drawPiece(ctx, 3 - a.side, a.capRank, style, p.x, p.y, cell, { trapped: false });
      else { const f = (a.t - a.glide * 0.85) / 0.6; if (f < 1) capFx(ctx, style, 3 - a.side, a.capRank, p.x, p.y, cell, f, state.calm, a.to); }
    }
    // the moving animal
    if (a) {
      const p0 = L.sq(a.from), p1 = L.sq(a.to), f = clamp(a.t / a.glide, 0, 1), e = ease(f);
      const x = p0.x + (p1.x - p0.x) * e, y = p0.y + (p1.y - p0.y) * e;
      const lift = f < 1 ? Math.sin(Math.PI * f) * (a.jump ? 2.4 : a.swim ? 0.12 : 0.55) + 0.2 * (1 - f) : Math.max(0, 0.2 * (1 - (a.t - a.glide) / 0.12));
      if (a.jump && f < 1 && !state.calm) {                                                        // dotted trail of a leap
        ctx.save(); ctx.fillStyle = 'rgba(190,245,255,0.7)';
        for (let k = 1; k <= 7; k++) { const q = (k / 8) * f; if (q <= 0) continue; const qe = ease(q); ctx.beginPath(); ctx.arc(p0.x + (p1.x - p0.x) * qe, p0.y + (p1.y - p0.y) * qe - Math.sin(Math.PI * q) * 2.4 * cell * 0.3, cell * 0.045, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      const landsOnWater = TERR[a.to] === WATER && a.rank === 1;
      drawPiece(ctx, a.side, a.rank, style, x, y, cell, { lift, glow: 0.5, swim: a.swim && (landsOnWater && f > 0.5), trapped: f >= 1 && ((a.side === 1 && TERR[a.to] === TRAP2) || (a.side === 2 && TERR[a.to] === TRAP1)) });
      if (a.t > a.glide && a.t < a.glide + 0.45 && !state.calm) {
        const ff = (a.t - a.glide) / 0.45;
        if (a.swim) { ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - ff)})`; ctx.lineWidth = cell * 0.05 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(p1.x, p1.y + cell * 0.2, cell * (0.3 + 0.9 * ff), cell * (0.14 + 0.38 * ff), 0, 0, TAU); ctx.stroke(); }
        else { ctx.strokeStyle = `rgba(255,250,215,${0.75 * (1 - ff)})`; ctx.lineWidth = cell * 0.07 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(p1.x, p1.y + cell * 0.2, cell * (0.3 + 0.8 * ff), cell * (0.14 + 0.34 * ff), 0, 0, TAU); ctx.stroke(); }
      }
    }
    if (dragging) drawPiece(ctx, sideOf(g.board[state.sel]) || g.turn, rankOf(g.board[state.sel]), style, state.drag.x, state.drag.y - cell * 0.15, cell, { lift: 0.9, glow: 0.9 });
    // rings over the tokens: eating squares in red, leaps in cyan, the lesson target in gold
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel);
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (m.jump) {
          ctx.save(); ctx.strokeStyle = `rgba(150,235,255,${0.65 + pulse * 0.3})`; ctx.lineWidth = cell * 0.05; ctx.setLineDash([cell * 0.12, cell * 0.1]);
          const mx = (sp.x + p.x) / 2, my = (sp.y + p.y) / 2, dx = p.x - sp.x, dy = p.y - sp.y, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, bulge = cell * 0.5;
          ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.quadraticCurveTo(mx + nx * bulge, my + ny * bulge, p.x, p.y); ctx.stroke(); ctx.restore();
          ctx.strokeStyle = `rgba(150,235,255,0.9)`; ctx.lineWidth = cell * 0.05; ctx.beginPath(); ctx.arc(p.x, p.y, m.cap ? cell * 0.52 : cell * 0.3, 0, TAU); ctx.stroke();
        }
        if (m.cap) { ctx.strokeStyle = `rgba(235,60,40,${0.8 + pulse * 0.2})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.47, 0, TAU); ctx.stroke(); ctx.fillStyle = `rgba(235,60,40,${0.12 + pulse * 0.1})`; ctx.fill(); }
      }
    }
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done && !a) { const p = L.sq(LESSONS[state.lesson.i].target); ctx.strokeStyle = `rgba(255,214,90,${0.6 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.5, 0, TAU); ctx.stroke(); }
    if (state.kb && !over) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();

    // ---- furniture
    if (isLesson) lessonBox(); else plates();
    buttonsFor();
    if (over) overlay();
  }

  function ripple(x, y, cell, t) {
    if (state.calm) return;
    for (let k = 0; k < 2; k++) { const f = ((t * 0.5 + k * 0.5) % 1); ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - f)})`; ctx.lineWidth = Math.max(1, cell * 0.03); ctx.beginPath(); ctx.ellipse(x, y, cell * (0.28 + 0.26 * f), cell * (0.11 + 0.1 * f), 0, 0, TAU); ctx.stroke(); }
  }
  function dangerMark(x, y, cell) {
    const r = cell * 0.17;
    ctx.fillStyle = '#e23c24'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 0.7); ctx.fillRect(x - r * 0.12, y + r * 0.28, r * 0.24, r * 0.24);
  }
  // A paw print in a team-coloured lacquer disc: the player's avatar.
  function avatar(x, y, size, side, glow) {
    const tm = TEAM[side], r = size / 2;
    if (glow) blob(ctx, x, y + r * 0.1, r * 2.2, r * 1.9, glow);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + 1, y + r * 0.2, r, 0, TAU); ctx.fill();
    const gr = ctx.createLinearGradient(x - r, y - r, x + r, y + r); gr.addColorStop(0, tm.a); gr.addColorStop(0.6, tm.b); gr.addColorStop(1, tm.c);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f3cf72'; ctx.lineWidth = Math.max(1.5, r * 0.07); ctx.stroke();
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 0.3, r * 0.26, 0, 0, TAU); ctx.fill();
    for (const [dx, dy, s] of [[-0.46, -0.1, 0.13], [-0.17, -0.42, 0.14], [0.17, -0.42, 0.14], [0.46, -0.1, 0.13]]) { ctx.beginPath(); ctx.ellipse(x + dx * r, y + dy * r, r * s, r * s * 1.2, 0, 0, TAU); ctx.fill(); }
    const gl = ctx.createLinearGradient(x - r, y - r, x, y); gl.addColorStop(0, 'rgba(255,255,255,0.4)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.45, r * 0.7, r * 0.34, -0.6, 0, TAU); ctx.fill();
  }

  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(48,40,10,0.78)' : 'rgba(5,28,16,0.62)', turn ? 'rgba(255,224,130,0.9)' : 'rgba(255,224,130,0.2)', true);
    const left = pieceCount(g, side) + (a && a.cap && a.side !== side && a.t < a.glide + 0.3 ? 1 : 0);
    const eaten = (g.gone || []).filter((v) => sideOf(v) === 3 - side), shown = a && a.cap && a.side === side && a.t < a.glide + 0.3 ? eaten.slice(0, -1) : eaten;
    const think = 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : think) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? think : 'Moving') : sub;
    if (r.h < 112) {                                                  // compact: one line of text, the eaten animals on the right
      const ic2 = clamp(r.h * 0.7, 34, 70);
      avatar(r.x + 12 + ic2 / 2, r.y + r.h / 2, ic2, side, turn ? 0.5 : 0);
      const tx2 = r.x + 12 + ic2 + 12, ns2 = clamp(r.h * 0.27, 16, 30), tcw = r.w > 520 ? Math.min(r.w * 0.34, 260) : r.w * 0.2, tmax = r.x + r.w - 12 - tx2 - tcw;
      if (r.w > 520) { fitText(`${name} · ${status}`, tx2, r.y + r.h * 0.42, ns2, tmax, turn ? CREAM : DIM, UI, 800, 'left'); fitText(`${left} animals left`, tx2, r.y + r.h * 0.75, Math.round(ns2 * 0.78), tmax, DIM, UI, 600, 'left'); }
      else { fitText(name, tx2, r.y + r.h * 0.42, ns2, tmax, turn ? CREAM : DIM, UI, 800, 'left'); fitText(`${turn ? status : sub} · ${left} left`, tx2, r.y + r.h * 0.75, Math.round(ns2 * 0.7), tmax, DIM, UI, 600, 'left'); }
      const tc2 = clamp(r.h * 0.46, 22, 36), per2 = Math.max(1, Math.floor(tcw / (tc2 * 0.7)));
      shown.forEach((v, k) => drawPiece(ctx, sideOf(v), rankOf(v), style, r.x + r.w - 14 - tcw + tc2 * 0.4 + (k % per2) * tc2 * 0.7, r.y + r.h * 0.45 + Math.floor(k / per2) * tc2 * 0.62 - (shown.length > per2 ? tc2 * 0.2 : 0), tc2, { alpha: 0.95 }));
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.56, r.w * 0.2), 38, 120);
    avatar(r.x + 16 + ic / 2, r.y + 14 + ic / 2, ic, side, turn ? 0.6 : 0);
    const tx = r.x + 16 + ic + 14, tw = r.x + r.w - 14 - tx;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, FONT, 700, 'left');
    fitText(status, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    fitText(`${left} animals left · ate ${eaten.length}`, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    const availH = r.y + r.h - (y3 + 8) - 4, tc = Math.min(clamp(availH, 0, 54), tw / (0.68 * 8 + 0.3));
    if (tc >= 18) {
      const at = (k) => ({ x: tx + tc * 0.4 + k * tc * 0.68, y: y3 + 8 + tc * 0.5 });
      ctx.strokeStyle = 'rgba(255,224,130,0.2)'; ctx.lineWidth = 1.5;
      for (let k = shown.length; k < 8; k++) { const p = at(k); ctx.beginPath(); ctx.arc(p.x, p.y + tc * 0.1, tc * 0.26, 0, TAU); ctx.stroke(); }
      shown.forEach((v, k) => { const p = at(k); drawPiece(ctx, sideOf(v), rankOf(v), style, p.x, p.y, tc * 0.9, { alpha: 0.95 }); });
    }
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : state.two || g.turn === state.humanSide ? 'Tap an animal, then a glowing square.' : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = 'rgba(10,26,14,0.94)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,130,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM); }
    if (L.land && L.rightHead) fitText('Jungle', L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 36, 34, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(5,28,16,0.78)', 'rgba(255,224,130,0.45)');
    const pad = 16;
    text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, r.x + pad, r.y + 30, Math.max(minU, 20), DIM, UI, 600, 'left');
    fitText(l.title, r.x + pad, r.y + 30 + 40, 38, r.w - 2 * pad, GOLD, FONT, 700, 'left');
    const body = state.lesson.done ? l.done : state.msg ? state.msg.text : l.text;
    wrapBox(body, R(r.x + pad, r.y + 82, r.w - 2 * pad, r.h - 92), big ? 32 : 27, 1.25, state.lesson.done ? '#c9f7c0' : CREAM, 'left', minU, 'top');
  }
  function buttonsFor() {
    const BTN = L.BTN, sz = 26;
    if (scene === 'play') {
      if (state.autoMode) {
        button(BTN.auto.exit, 'Exit', { size: 24 }); button(BTN.auto.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 24, primary: state.autoPaused });
        button(BTN.auto.dec, '- Think', { size: 22, dim: state.autoThinkIdx <= 0 }); button(BTN.auto.inc, 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
        if (L.land && L.rightHead) fitText(`think time ${THINK_STEPS[state.autoThinkIdx]} s`, L.rightHead.x + L.rightHead.w / 2, BTN.auto.inc.y + BTN.auto.inc.h + 36, 22, L.rightHead.w, DIM, UI, 600);
      } else {
        button(BTN.menu, 'Menu', { size: sz }); button(BTN.undo, 'Take back', { size: sz, dim: !state.undo.length }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: sz, dim: state.hintsLeft <= 0, primary: !!state.hint });
      }
    } else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: sz }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
  }
  function overlay() {
    ctx.fillStyle = 'rgba(4,14,8,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(8,34,20,0.94)', 'rgba(255,224,130,0.6)');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 3) avatar(0, 108, 130, w, 0.9); else { avatar(-52, 108, 100, 1, 0); avatar(52, 108, 100, 2, 0); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · Red ate ${(g.gone || []).filter((v) => sideOf(v) === 2).length}, Blue ate ${(g.gone || []).filter((v) => sideOf(v) === 1).length}`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} computer beaten`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(140,230,140,${0.8 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    ctx.fillStyle = 'rgba(3,14,8,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(14,52,32,0.88)'); pg.addColorStop(1, 'rgba(5,24,14,0.92)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,130,0.34)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, panelR.x + panelR.w - 2 * (D.header.textDec.w * 2 + 90) - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(255,224,130,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
    const secs = kind === 'rules' ? RULES : kind === 'how' ? HOWTO : kind === 'about' ? ABOUT : [{ title: '', items: settingsItems(state) }];
    const sc0 = Math.max(0, Math.min(state.doc.scroll || 0, docMetrics.max));
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const bodyW = D.bodyW, cxp = vp.x + vp.w / 2, left = cxp - bodyW / 2;
    const size = Math.round(27 * scale), lh = Math.round(size * 1.38), gap = Math.round(12 * scale);
    let y = vp.y - sc0 + 4;
    const vis = (y0, h) => y0 + h > vp.y - 40 && y0 < vp.y + vp.h + 40;
    secs.forEach((sec, si) => {
      if (sec.title) {
        const t0 = Math.round(34 * Math.min(scale, 2));
        if (si > 0) y += Math.round(18 * Math.min(scale, 2));
        const ty2 = y + t0 * 0.9; if (vis(y, t0)) fitText(sec.title, cxp, ty2, t0, bodyW, '#ffd24a', FONT, 700, 'center', 18);
        y += t0 * 1.35 + 6;
      }
      for (const it of sec.items) {
        if (it.k === 'p') {
          const ls = lines(it.t, size, bodyW); if (vis(y, ls.length * lh)) ls.forEach((ln, i) => text(ln, cxp, y + size * 0.9 + i * lh, size, CREAM, UI, 600, 'center'));
          y += ls.length * lh + gap;
        } else if (it.k === 'h') {
          const hs = Math.round(30 * Math.min(scale, 2)); y += 8; if (vis(y, hs)) text(it.t, cxp, y + hs * 0.9, hs, '#ffd24a', FONT, 700, 'center'); y += hs * 1.3 + 4;
        } else if (it.k === 'd') {
          const spec = it.spec, C = spec.rows[0].length / 2, cp = Math.min((spec.cell || 44) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (C + 0.36)), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, theme, style);
          y += ds.h + gap + 6;
        } else if (it.k === 'seg') {
          const ls = lines(it.label, Math.round(25 * Math.min(scale, 2.2)), bodyW, 600);
          const fs = Math.round(25 * Math.min(scale, 2.2)); if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const n = it.opts.length, os = Math.round(25 * Math.min(scale, 2.2)), bh = Math.round(66 * Math.min(scale, 2.2));
          let per = n; ctx.font = `700 ${os}px ${FONT}`;
          const fitsRow = (p) => it.opts.every((o) => ctx.measureText(o.l + (o.locked ? ' (locked)' : '')).width + 28 <= (bodyW - (p - 1) * 10) / p);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need, clip: vp });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(8,32,20,${a0})`); gr.addColorStop(1, `rgba(8,32,20,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(255,224,130,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,224,130,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(255,224,130,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(10,26,14,0.96)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,130,0.85)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
// An eaten animal: a flash, then it puffs into a cloud of dust and stars while the token tilts, rises and fades. f runs 0..1.
export function capFx(ctx, style, side, rank, x, y, cell, f, calm, k) {
  const dirn = k % 2 ? 1 : -1;
  if (f < 0.22) { const e = f / 0.22; drawPiece(ctx, side, rank, style, x, y, cell, { scale: 1 + 0.1 * e, flash: 0.75 * e, lift: 0.1 * e }); return; }
  const g = (f - 0.22) / 0.78, e = ease(g);
  drawPiece(ctx, side, rank, style, x, y - e * cell * 0.7, cell, { alpha: 1 - g, scale: 1.1 - 0.35 * e, tilt: calm ? 0 : dirn * e * 0.8, lift: 0.2 });
  if (calm) return;
  ctx.save();
  for (let j = 0; j < 6; j++) {                                                  // dust puffs
    const ang = k * 0.7 + j * 1.05, d = cell * (0.25 + 0.4 * g), px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d * 0.55 - g * cell * 0.15;
    ctx.globalAlpha = Math.max(0, 0.55 * (1 - g)); ctx.fillStyle = '#fff7e0'; ctx.beginPath(); ctx.arc(px, py, cell * (0.1 + 0.16 * g), 0, TAU); ctx.fill();
  }
  for (let j = 0; j < 5; j++) {                                                  // little stars
    const ang = k * 1.7 + j * 1.26, sp = cell * (0.45 + 0.4 * ((j * 5 + k) % 3) / 2), px = x + Math.cos(ang) * sp * g, py = y - cell * 0.1 - Math.abs(Math.sin(ang)) * sp * 1.1 * g + g * g * cell * 0.9;
    ctx.globalAlpha = Math.max(0, 1 - g * 1.15); ctx.fillStyle = j % 2 ? '#ffe27a' : '#ffffff';
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang + g * 5); const s = cell * (0.06 + 0.025 * (j % 3)); ctx.beginPath(); for (let q = 0; q < 8; q++) { const rr = q % 2 ? s * 0.45 : s * 1.2, aa = (q / 8) * TAU; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function fireflies(ctx, L, t) {
  for (let k = 0; k < 16; k++) {
    const sp = 5 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 50 + L.h * 2) % L.h, r = 2 + (k % 4);
    const a = 0.07 + 0.1 * Math.max(0, Math.sin(t * 0.9 + k * 1.7));
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 4); gr.addColorStop(0, `rgba(230,255,150,${a * 1.3})`); gr.addColorStop(1, 'rgba(230,255,150,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, TAU); ctx.fill();
  }
}
