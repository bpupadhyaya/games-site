// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, inRect, R, clamp } from './layout.js';
import { drawTable, drawBoard, drawStone, drawDiagram, diagramSize, PAPERS } from './art.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { VARIANTS, NAMES, startCount, pieceCount, pointName } from './rules.js';
import { LEVELS } from './ai.js';
import { drawCredit, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';
import { v3 } from './v3.js';

const FONT = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#ffd98a', CREAM = '#fff6e4', DIM = 'rgba(196,236,222,0.78)', RED = '#e23c24';
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
  const paper = state.paper;

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
  const panel = (r, rad = 18, fill = 'rgba(5,24,28,0.66)', stroke = 'rgba(160,240,214,0.24)', brand = true, kind = 'slate') => {
    if (v3.on) { v3.panels.push({ r, rad, kind }); return; }                       // the 3D presenter draws a carved plaque here
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.38);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3);
    if (v3.on) { v3.buttons.push({ r, rad, label, primary: !!o.primary, on: !!o.on, dim: !!o.dim }); if (o.dim) ctx.globalAlpha = 0.7; }
    else {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#38c79a'); gr.addColorStop(1, '#136b50'); } else if (o.on) { gr.addColorStop(0, '#7a6428'); gr.addColorStop(1, '#473a14'); } else { gr.addColorStop(0, '#255660'); gr.addColorStop(1, '#122c33'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(200,255,232,0.85)' : 'rgba(160,240,214,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    }
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary ? '#fffdf2' : '#e6fff6', cy = r.y + r.h / 2;
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${UI}`; return ctx.measureText(str).width; };
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
    if (o.sub && best.ls.length === 1) { text(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s, col, UI, 700); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    ctx.restore();
  };

  // ---------------------------------------------------------------- scenes
  if (v3.on) { v3.heroRect = null; ctx.clearRect(0, 0, L.w, L.h); if (scene === 'title' || scene === 'demo-limit') { const tg = ctx.createLinearGradient(0, 0, 0, L.h * 0.3); tg.addColorStop(0, 'rgba(10,4,2,0.62)'); tg.addColorStop(1, 'rgba(10,4,2,0)'); ctx.fillStyle = tg; ctx.fillRect(0, 0, L.w, L.h * 0.3); } } else {
    drawTable(ctx, L);
    if (!state.calm) motes(ctx, L, state.t);
  }

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the table's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(6,20,26,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(5,24,28,0.55)', undefined, true, 'plate');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(5,24,28,0.74)', undefined, true, 'doc');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Four-Field Kono on iPhone and Android for unlimited games, all three boards and every level.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${VARIANTS[state.variant].name} · ${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
      button(Rr.two, 'Two players', { size: 26 }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26 });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
      button(Rr.rules, 'Rules', { size: 26 }); button(Rr.how, 'How to Play', { size: 26 });
      button(Rr.about, 'About', { size: 26 }); button(Rr.settings, 'Settings', { size: 26 });
      if (state.msg) fitText(state.msg.text, L.w / 2, T.rows.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 8.6, r.h / 4.4), 36, 96);
    const y0 = r.y + ts * 0.95;
    if (v3.on) goldTitle('Four-Field Kono', cx, y0, ts, r.w - 10);
    else {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    const grad = ctx.createLinearGradient(0, y0 - ts * 0.8, 0, y0 + ts * 0.1); grad.addColorStop(0, '#fffbe8'); grad.addColorStop(1, '#ffc766');
    fitText('Four-Field Kono', cx, y0, ts, r.w - 10, grad, FONT, 700);
    ctx.restore();
    }
    const sub = Math.max(minU, ts * 0.3);
    ctx.save();
    const pw = Math.min(r.w * 0.62, ts * 6.2), py = y0 + ts * 0.3, pg = ctx.createLinearGradient(cx - pw / 2, 0, cx + pw / 2, 0);
    pg.addColorStop(0, '#3fc9a0'); pg.addColorStop(1, '#e8663a');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, sub * 1.75, sub * 0.875); ctx.fill();
    ctx.restore();
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = '#fffdf2'; ctx.textAlign = 'center';
    ctx.fillText('K O R E A N   S T O N E   G A M E', cx, py + sub * 1.25);
    if (v3.on) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; fitText('Step forward. Jump to capture.', cx, py + sub * 1.75 + ts * 0.42, ts * 0.32, r.w - 20, '#fff0c8', FONT, 600); ctx.restore(); }
    else fitText('Step forward. Jump to capture.', cx, py + sub * 1.75 + ts * 0.42, ts * 0.32, r.w - 20, 'rgba(255,236,190,0.9)', FONT, 600);
    const top = py + sub * 1.75 + ts * 0.66, room = r.y + r.h - top;
    if (v3.on) {
      const rr = R(r.x, top + 4, r.w, room - 14), c = clamp(Math.min((rr.w - 8) / 6.2, (rr.h - 6) / 5.4), 24, 130), S = c * 5.9;
      v3.heroRect = room > 90 ? { x: rr.x + (rr.w - S) / 2, y: rr.y + (rr.h - S) / 2, w: S, h: S } : { x: L.w / 2 - 1, y: L.h + 40, w: 2, h: 2 };
    } else if (room > 90) heroBoard(R(r.x, top + 6, r.w, room - 22));
  }

  // embossed lacquer-gold lettering on a deep red-brown extrusion, with a soft lantern glow
  function goldTitle(str, cx, y, size, maxW) {
    ctx.save();
    ctx.font = `700 ${size}px ${FONT}`; let q = size; while (q > 24 && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `700 ${q}px ${FONT}`; }
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(255,170,90,0.65)'; ctx.shadowBlur = q * 0.35; ctx.fillStyle = '#2a0e06'; ctx.fillText(str, cx, y); ctx.shadowBlur = 0;
    const depth = Math.max(3, q * 0.065);
    for (let i = depth; i >= 1; i--) { ctx.fillStyle = i > depth * 0.6 ? '#3a0f08' : '#6e2412'; ctx.fillText(str, cx + i * 0.4, y + i); }
    const g2 = ctx.createLinearGradient(0, y - q * 0.72, 0, y + q * 0.08);
    g2.addColorStop(0, '#fffbe6'); g2.addColorStop(0.3, '#ffe38a'); g2.addColorStop(0.55, '#f1ae2c'); g2.addColorStop(0.6, '#b86d12'); g2.addColorStop(0.82, '#e8a52a'); g2.addColorStop(1, '#ffd96a');
    ctx.fillStyle = g2; ctx.fillText(str, cx, y);
    ctx.lineWidth = Math.max(1.5, q * 0.014); ctx.strokeStyle = 'rgba(255,248,214,0.9)'; ctx.strokeText(str, cx, y - 0.5);
    ctx.restore();
  }

  // The animated demonstration on the title: a stone jumps two Ember stones in one chain, forever.
  function heroBoard(r) {
    const N = 4, cell = clamp(Math.min((r.w - 30) / (N + 1.6), (r.h - 16) / (N + 1.4), 120), 28, 120);
    const bw = N * cell, x0 = r.x + (r.w - bw) / 2, y0 = r.y + (r.h - bw) / 2 + 4;
    const T = state.calm ? 1.2 : state.t % 9, pal = PAPERS[paper] || PAPERS.hanji;
    const at = (rr, cc) => ({ x: x0 + cc * cell, y: y0 + rr * cell });
    ctx.save();
    const m = cell * 0.72, px0 = x0 - m, py0 = y0 - m, pw = bw + 2 * m;
    ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.roundRect(px0 + 4, py0 + 12, pw, pw + 4, 16); ctx.fill();
    const fg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + pw); fg.addColorStop(0, pal.frame[0]); fg.addColorStop(1, pal.frame[2]);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(px0 - cell * 0.1, py0 - cell * 0.1, pw + cell * 0.2, pw + cell * 0.2, 16); ctx.fill();
    const gg = ctx.createLinearGradient(px0, py0, px0 + pw, py0 + pw); gg.addColorStop(0, pal.paper[0]); gg.addColorStop(0.55, pal.paper[1]); gg.addColorStop(1, pal.paper[2]);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.roundRect(px0, py0, pw, pw, 8); ctx.fill();
    ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(1.6, cell * 0.045); ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i <= N; i++) { ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + bw, y0 + i * cell); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + bw); }
    ctx.stroke();
    ctx.fillStyle = pal.ink;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const p = at(i, j); ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.06, 0, TAU); ctx.fill(); }
    // script: Jade at (4,2) jumps Ember (3,2) to land on (2,2), then Ember (1,2) to land on (0,2)
    const h1 = [1.4, 2.0], h2 = [2.4, 3.0], fx = 0.7, resetT = 6.6;
    const op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.7) : 1;
    ctx.globalAlpha = op;
    const still = [[4, 0, 1], [4, 4, 1], [4, 1, 1], [4, 3, 1], [0, 0, 2], [0, 4, 2], [0, 1, 2], [0, 3, 2]];
    for (const [rr, cc, s] of still) { const p = at(rr, cc); drawStone(ctx, s, p.x, p.y, cell); }
    const e1 = at(3, 2), e2 = at(1, 2);
    const stoneOrFx = (p, hitT) => { if (T < hitT) drawStone(ctx, 2, p.x, p.y, cell); else if (T < hitT + fx) capFx(ctx, 2, p.x, p.y, cell, (T - hitT) / fx, false, state.calm, 1); };
    stoneOrFx(e1, h1[1]); stoneOrFx(e2, h2[1]);
    const p0 = at(4, 2), p1 = at(2, 2), p2 = at(0, 2);
    let x = p0.x, y = p0.y, lift = 0;
    if (T >= h1[0] && T < h1[1]) { const f = (T - h1[0]) / (h1[1] - h1[0]); x = p0.x; y = p0.y + (p1.y - p0.y) * ease(f); lift = Math.sin(Math.PI * f) * 0.9; }
    else if (T >= h1[1] && T < h2[0]) { x = p1.x; y = p1.y; }
    else if (T >= h2[0] && T < h2[1]) { const f = (T - h2[0]) / (h2[1] - h2[0]); x = p1.x; y = p1.y + (p2.y - p1.y) * ease(f); lift = Math.sin(Math.PI * f) * 0.9; }
    else if (T >= h2[1]) { x = p2.x; y = p2.y; }
    else if (T > 0.9) lift = clamp((T - 0.9) / 0.5, 0, 1) * 0.3;
    drawStone(ctx, 1, x, y, cell, { lift, glow: T > 0.9 && T < h1[0] ? 0.6 : 0 });
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const cell = B.cell, W = g.W;
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }
    if (v3.on) { play3d(); return; }

    // ---- the board scene (shaken a little on a capture)
    ctx.save();
    const lastHop = a ? Math.max(0, a.caps.length) : 0;
    if (a && lastHop && !state.calm) { const t0 = a.hop * Math.max(1, lastHop); if (a.t > t0 && a.t < t0 + 0.3) { const f = (a.t - t0) / 0.3; ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.03, Math.cos(f * 38) * (1 - f) * cell * 0.02); } }
    drawBoard(ctx, B, paper);
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const ring = (i, col, lw, rad) => { const p = L.sq(i); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(p.x, p.y, cell * rad, 0, TAU); ctx.stroke(); };
    // last move: a soft ring on both ends
    const last = a ? null : g.last;
    if (last && !isLesson && !over) for (const q of [last.from, last.to]) { const p = L.sq(q); ctx.fillStyle = 'rgba(255,214,110,0.30)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.42, 0, TAU); ctx.fill(); }
    // lesson target
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) ring(LESSONS[state.lesson.i].target, `rgba(226,60,36,${0.6 + 0.4 * pulse})`, cell * 0.07, 0.4);
    // selected stone: reachable points
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel); ctx.fillStyle = `rgba(255,224,120,${0.28 + pulse * 0.14})`; ctx.beginPath(); ctx.arc(sp.x, sp.y, cell * 0.46, 0, TAU); ctx.fill();
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (m.caps) {
          ring(m.to, `rgba(226,60,36,${0.75 + pulse * 0.25})`, cell * 0.07, 0.38);
          ctx.fillStyle = 'rgba(226,60,36,0.22)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.fill();
          const s = Math.round(cell * 0.3); ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(p.x + cell * 0.32, p.y - cell * 0.32, s * 0.56, 0, TAU); ctx.fill();
          text(String(m.caps), p.x + cell * 0.32, p.y - cell * 0.32 + s * 0.2, s * 0.72, '#fff', UI, 800);
        } else { ctx.fillStyle = `rgba(255,252,226,${0.62 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.16, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(40,24,8,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    }
    if (state.hint && !a) {
      const p0 = L.sq(state.hint.from), p1 = L.sq(state.hint.to);
      ctx.strokeStyle = 'rgba(60,220,140,0.9)'; ctx.lineWidth = cell * 0.07; ctx.setLineDash([cell * 0.16, cell * 0.12]); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.setLineDash([]);
      for (const q of [state.hint.from, state.hint.to]) { const p = L.sq(q); ctx.fillStyle = `rgba(90,230,150,${0.28 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.45, 0, TAU); ctx.fill(); ring(q, 'rgba(60,220,140,0.95)', 3.5, 0.45); }
    }
    // stones, far rows first (a lower stone overlaps the one above it)
    const order = []; for (let rr = 0; rr < W; rr++) for (let cc = 0; cc < W; cc++) order.push((L.flip ? W - 1 - rr : rr) * W + (L.flip ? W - 1 - cc : cc));
    const movingTo = a ? a.to : -1, dragging = state.drag && state.sel >= 0;
    const capAlive = (q) => a && a.caps.includes(q);
    for (const i of order) {
      const k = g.board[i]; if (!k || i === movingTo) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i, lift = sel ? 0.5 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      drawStone(ctx, k, p.x, p.y, cell, { lift, glow: sel ? 0.8 : 0 });
      if (state.marks && !over && !a && state.danger && state.danger.has(i)) dangerMark(p.x + cell * 0.3, p.y - cell * 0.32, cell);
    }
    // stones being captured: they stay put until the jumper passes over, then flick away
    if (a) for (const [n, q] of a.caps.entries()) {
      const p = L.sq(q), t0 = a.hop * (n + 1) - a.hop * 0.5;
      if (a.t < t0) drawStone(ctx, 3 - a.side, p.x, p.y, cell);
      else { const f = (a.t - t0) / 0.6; if (f < 1) capFx(ctx, 3 - a.side, p.x, p.y, cell, f, L.flip, state.calm, n + q); }
    }
    void capAlive;
    // the moving stone, hop by hop
    if (a) {
      const hops = a.path.length - 1, k = Math.min(hops - 1, Math.floor(a.t / a.hop)), f = clamp((a.t - k * a.hop) / a.hop, 0, 1), e = ease(f);
      const p0 = L.sq(a.path[k]), p1 = L.sq(a.path[k + 1]), done = a.t >= a.glide;
      const x = done ? p1.x : p0.x + (p1.x - p0.x) * e, y = done ? p1.y : p0.y + (p1.y - p0.y) * e;
      const jump = a.caps.length > 0, lift = done ? Math.max(0, 0.15 * (1 - (a.t - a.glide) / 0.12)) : Math.sin(Math.PI * f) * (jump ? 0.95 : 0.3);
      drawStone(ctx, a.side, x, y, cell, { lift, glow: 0.5 });
      if (done && a.t < a.glide + 0.4 && !state.calm) { const ff = (a.t - a.glide) / 0.4; ctx.strokeStyle = `rgba(255,244,210,${0.75 * (1 - ff)})`; ctx.lineWidth = cell * 0.06 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(p1.x, p1.y + cell * 0.1, cell * (0.3 + 0.7 * ff), cell * (0.2 + 0.3 * ff), 0, 0, TAU); ctx.stroke(); }
      if (a.caps.length && !state.calm && a.t > a.glide && a.t < a.glide + 0.8) {          // a floating count where the chain ended
        const ff = (a.t - a.glide) / 0.8, fs = Math.round(cell * 0.58);
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - ff) * 2.2); ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(8,24,22,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
        const tx = p1.x, ty = p1.y - cell * (0.65 + 0.8 * ease(Math.min(1, ff * 1.4)));
        ctx.strokeText(`+${a.caps.length}`, tx, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(`+${a.caps.length}`, tx, ty); ctx.restore();
      }
    }
    // a dragged stone follows the finger
    if (dragging) drawStone(ctx, g.board[state.sel] || g.turn, state.drag.x, state.drag.y - cell * 0.15, cell, { lift: 0.9, glow: 0.9 });
    if (state.kb && !over) { const p = L.sq(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6); }
    ctx.restore();

    if (isLesson) lessonBox(); else plates();
    buttonsFor();
    if (over) overlay();
  }

  // 3D board: the presenter draws the board, stones and highlights; the 2D layer adds the capture counts, danger marks and the +n float
  function play3d() {
    const isLesson = scene === 'lesson', over = scene === 'over', W = g.W, sq = (i) => v3.sq(i);
    const p0 = sq(0), p1 = sq(1), cellPx = Math.max(24, Math.abs(p1.x - p0.x) || B.cell);
    if (state.selMoves && state.sel >= 0 && !a && !over) {
      for (const m of state.selMoves) {
        if (!m.caps) continue;
        const p = sq(m.to), s = Math.round(cellPx * 0.3), bx = p.x + cellPx * 0.34, by = p.y - cellPx * 0.4;
        ctx.fillStyle = RED; ctx.strokeStyle = '#fff4e0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, s * 0.62, 0, TAU); ctx.fill(); ctx.stroke();
        text(String(m.caps), bx, by + s * 0.22, s * 0.78, '#fff', UI, 800);
      }
    }
    if (state.marks && !over && !a && !isLesson && state.danger) for (const i of state.danger) { if (g.board[i]) { const p = sq(i); dangerMark(p.x + cellPx * 0.32, p.y - cellPx * 0.52, cellPx); } }
    if (a && a.caps.length && !state.calm && a.t > a.glide && a.t < a.glide + 0.8) {
      const p1b = sq(a.path[a.path.length - 1]), ff = (a.t - a.glide) / 0.8, fs = Math.round(cellPx * 0.58);
      ctx.save(); ctx.globalAlpha = Math.min(1, (1 - ff) * 2.2); ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(8,24,22,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
      const tx = p1b.x, ty = p1b.y - cellPx * (0.8 + 0.8 * ease(Math.min(1, ff * 1.4)));
      ctx.strokeText(`+${a.caps.length}`, tx, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(`+${a.caps.length}`, tx, ty); ctx.restore();
    }
    void W;
    if (isLesson) lessonBox(); else plates();
    buttonsFor();
    if (over) overlay();
  }

  function dangerMark(x, y, cell) {
    const r = cell * 0.16;
    ctx.fillStyle = RED; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 0.7); ctx.fillRect(x - r * 0.12, y + r * 0.28, r * 0.24, r * 0.24);
  }

  function plateInfo(side) {
    const opp = 3 - side, flying = a && a.t < a.hop * a.caps.length + 0.3 ? a.caps.length : 0;     // while a capture plays, the trays still show the old numbers
    return { got: g.lost[opp] - (a && a.side === side ? flying : 0), left: pieceCount(g, side) + (a && a.side !== side ? flying : 0) };
  }
  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(30,50,40,0.82)' : 'rgba(5,24,28,0.66)', turn ? 'rgba(255,217,138,0.85)' : 'rgba(160,240,214,0.2)', true, turn ? 'plateOn' : 'slate');
    const info = plateInfo(side), total = startCount(g.variant);
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : 'Moving') : sub;
    const goal = `Took ${info.got} of ${total} · ${info.left} left`;
    if (r.h < 112) {                                                  // compact: one line of text, the taken stones on the right
      const ic2 = clamp(r.h * 0.8, 36, 84), ix2 = r.x + 12 + ic2 * 0.5, iy2 = r.y + r.h * 0.5;
      drawStone(ctx, side, ix2, iy2, ic2, { glow: turn ? 0.7 : 0 });
      const tx2 = r.x + 12 + ic2 + 12, ns2 = clamp(r.h * 0.27, 18, 30), tcw = clamp(r.w * 0.22, 84, 150);
      fitText(`${name} · ${status}`, tx2, r.y + r.h * 0.42, ns2, r.x + r.w - 12 - tx2 - tcw, turn ? CREAM : DIM, UI, 800, 'left');
      fitText(goal, tx2, r.y + r.h * 0.75, Math.round(ns2 * 0.78), r.x + r.w - 12 - tx2 - tcw, DIM, UI, 600, 'left');
      const tc2 = clamp(r.h * 0.34, 20, 30), per2 = Math.max(1, Math.floor(tcw / (tc2 * 0.62)));
      for (let k = 0; k < Math.min(info.got, 18); k++) drawStone(ctx, 3 - side, r.x + r.w - 14 - tcw + tc2 * 0.4 + (k % per2) * tc2 * 0.62, r.y + r.h * 0.5 + Math.floor(k / per2) * tc2 * 0.42 - (info.got > per2 ? tc2 * 0.2 : 0), tc2, {});
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.62, r.w * 0.22), 40, 130);
    const ix = r.x + 14 + ic * 0.5, iy = r.y + 14 + ic * 0.5;
    drawStone(ctx, side, ix, iy, ic, { glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 14 + ic + 14, tw = r.x + r.w - 14 - tx;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, UI, 800, 'left');
    fitText(status, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    fitText(goal, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    const cols = Math.min(total, 12), availH = r.y + r.h - (y3 + 8) - 4;
    const tc = Math.min(clamp(availH, 0, 46), tw / (0.64 * cols + 0.3));
    if (tc >= 16) {
      const at = (k) => ({ x: tx + tc * 0.4 + (k % cols) * tc * 0.64, y: y3 + 8 + tc * 0.45 + Math.floor(k / cols) * tc * 0.5 });
      ctx.strokeStyle = 'rgba(160,240,214,0.28)'; ctx.lineWidth = 1.5;
      for (let k = info.got; k < total; k++) { const p = at(k); ctx.beginPath(); ctx.arc(p.x, p.y, tc * 0.26, 0, TAU); ctx.stroke(); }   // empty slots show what is still to win
      for (let k = 0; k < info.got; k++) { const p = at(k); drawStone(ctx, 3 - side, p.x, p.y, tc * 0.9, {}); }
    }
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : state.two || g.turn === state.humanSide ? 'Tap a stone, then a glowing point.' : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      if (v3.on) panel(R(M.x, M.y + 4, M.w, M.h - 8), 14, '', '', false, 'plateOn');
      else { ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w, M.h - 8, 14); ctx.fillStyle = 'rgba(8,24,22,0.94)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,217,138,0.75)'; ctx.lineWidth = 2; ctx.stroke(); }
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM); }
    if (L.land && L.rightHead) fitText(VARIANTS[g.variant].long, L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 26, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(5,24,28,0.78)', 'rgba(255,217,138,0.45)', true, 'plateOn');
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
    if (v3.on) v3.scrim = 0.7; else { ctx.fillStyle = 'rgba(3,12,16,0.72)'; ctx.fillRect(0, 0, L.w, L.h); }
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(8,30,34,0.94)', 'rgba(255,217,138,0.55)', true, 'doc');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    drawStone(ctx, w, 0, 100, 130, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · took ${g.lost[2]} Ember, ${g.lost[1]} Jade`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten at ${VARIANTS[state.variant].name}`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti() {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(120,230,190,${0.8 * (1 - ph)})` : `rgba(255,140,100,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    if (v3.on) { v3.scrim = 0.4; panel(panelR, 26, '', '', false, 'doc'); }
    else {
    ctx.fillStyle = 'rgba(3,12,16,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(22,52,56,0.88)'); pg.addColorStop(1, 'rgba(6,20,26,0.93)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(160,240,214,0.32)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    }
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, Math.max(80, D.header.textDec.x - 84 - hx), GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(160,240,214,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
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
        const ty2 = y + t0 * 0.9; if (vis(y, t0)) fitText(sec.title, cxp, ty2, t0, bodyW, '#ffd24a', UI, 800, 'center', 18);
        y += t0 * 1.35 + 6;
      }
      for (const it of sec.items) {
        if (it.k === 'p') {
          const ls = lines(it.t, size, bodyW); if (vis(y, ls.length * lh)) ls.forEach((ln, i) => text(ln, cxp, y + size * 0.9 + i * lh, size, CREAM, UI, 600, 'center'));
          y += ls.length * lh + gap;
        } else if (it.k === 'h') {
          const hs = Math.round(30 * Math.min(scale, 2)); y += 8; if (vis(y, hs)) text(it.t, cxp, y + hs * 0.9, hs, '#ffd24a', UI, 800, 'center'); y += hs * 1.3 + 4;
        } else if (it.k === 'd') {
          const spec = it.spec, C = spec.rows[0].length, cp = Math.min((spec.cell || 44) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (C + 0.5)), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, paper);
          y += ds.h + gap + 6;
        } else if (it.k === 'act') {
          const bh = Math.round(66 * Math.min(scale, 2.2)), rr = R(left, y, bodyW, bh);
          if (vis(y, bh)) button(rr, it.label, { size: Math.round(25 * Math.min(scale, 2.2)), dim: it.disabled });
          ui.hits.push({ r: rr, id: it.id, v: 1, clip: vp });
          y += bh + gap;
        } else if (it.k === 'seg') {
          const fs = Math.round(25 * Math.min(scale, 2.2)), ls = lines(it.label, fs, bodyW, 600);
          if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const n = it.opts.length, os = fs, bh = Math.round(66 * Math.min(scale, 2.2));
          let per = n; ctx.font = `700 ${os}px ${UI}`;
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
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(10,30,36,${a0})`); gr.addColorStop(1, `rgba(10,30,36,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(160,240,214,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(160,240,214,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(160,240,214,0.7)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); if (v3.on) panel(r, 14, '', '', false, 'plateOn'); else { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(8,24,22,0.96)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,217,138,0.8)'; ctx.lineWidth = 2; ctx.stroke(); } wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
  void pointName;
}

// ---------------------------------------------------------------- effects
// A captured stone: a flash, then it is flicked away: it spins up and off, shrinking and fading, with a few sparks. f runs 0..1.
export function capFx(ctx, side, x, y, cell, f, flip, calm, k) {
  const dirn = k % 2 ? 1 : -1;
  if (f < 0.2) { const e = f / 0.2; drawStone(ctx, side, x, y, cell, { scale: 1 + 0.12 * e, flash: 0.7 * e, lift: 0.15 * e }); return; }
  const g = (f - 0.2) / 0.8, e = ease(g);
  drawStone(ctx, side, x + dirn * e * cell * 0.9, y - Math.sin(Math.PI * Math.min(1, g * 1.3)) * cell * 0.9 + g * g * cell * 0.5, cell, { alpha: 1 - g, scale: 1.1 - 0.4 * e, tilt: calm ? 0 : dirn * e * 2.2, lift: 0.1 });
  if (calm) return;
  ctx.save();
  const col = side === 1 ? ['#bfffe6', '#6fd8b0'] : ['#ffc08a', '#ff7a40'];
  for (let j = 0; j < 7; j++) {
    const ang = k * 1.7 + j * 0.9, sp = cell * (0.45 + 0.5 * ((j * 5 + k) % 3) / 2);
    const px = x + Math.cos(ang) * sp * g, py = y - cell * 0.1 + Math.sin(ang) * sp * g * 0.8 - g * cell * 0.25;
    ctx.globalAlpha = Math.max(0, 1 - g * 1.2); ctx.fillStyle = col[j % 2];
    ctx.beginPath(); ctx.arc(px, py, cell * (0.035 + 0.02 * (j % 3)) * (1 - g * 0.5), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function motes(ctx, L, t) {
  for (let k = 0; k < 12; k++) {
    const sp = 5 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.035 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(190,255,226,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
