// Everything drawn each frame. Reads `state` (game.js) and the layout for the live size (layout.js); changes nothing.
// The table, board and seed sprites are cached (art.js). The board is drawn in canonical units under one transform (L.board).
import { TALL, TEXT_SCALES, AP_THINK_STEPS, pitAtCol } from './layout.js';
const PIT_R = TALL.pitR, FRAME = TALL.frame, pitPos = TALL.pit, TRAY = { bottom: TALL.tray[0], top: TALL.tray[1] };
import { drawTable, drawBoard, drawSeed, slot, WOODS, SEEDSETS } from './art.js';
import { legalMoves } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT, ABOUT_DOC } from './about.js';
import { RULES_DOC } from './content.js';
import { drawLockupImage, drawMoreLine } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const CREAM = '#fbe8bf', GOLD = '#f3cf7a';
// Filled in every frame the reader (About / Rules) is on screen; game.js uses it to clamp scrolling.
// Reader layout cache (wrapped lines + total height). readerStats.layouts counts rebuilds (tests read it).
const readerCache = { key: '', items: [], endY: 0 };
export const readerStats = { layouts: 0 };
export const readerMetrics = { content: 0, view: 0 };

// ---- Rules page art: a real board snapshot, drawn with the game's own drawBoard/drawSeed/slot ------------------------------------
function ruleSnapshot(role) {
  const idle = () => ({ pits: new Array(14).fill(5), store: [0, 0] });
  if (role === 'setup') return { snap: idle(), hi: null, caption: null };
  if (role === 'mine') return { snap: idle(), hi: { pits: [0, 1, 2, 3, 4, 5, 6] }, caption: 'Your houses: the bottom row' };
  if (role === 'theirs') return { snap: idle(), hi: { pits: [7, 8, 9, 10, 11, 12, 13] }, caption: 'The opponent’s houses: the top row' };
  if (role === 'leftmost') return { snap: idle(), hi: { pits: [6, 13] }, caption: 'The leftmost house of each side' };
  if (role === 'first') return { snap: idle(), hi: { pits: [0, 7] }, caption: 'The first house of each side' };
  if (role === 'capture') return { snap: { pits: [5, 5, 5, 5, 5, 5, 5, 4, 2, 3, 5, 5, 5, 5], store: [0, 0] }, hi: { pits: [7, 8, 9] }, caption: 'Houses at 4, 2 and 3: a chain that takes the first house too' };
  return null;
}
// the snapshot: its frame is `sc` times canonical, centred on cx with its top edge at `top`
function drawRuleBoard(ctx, state, snap, hi, cx, top, sc) {
  ctx.save(); ctx.translate(cx, top - FRAME.y * sc); ctx.scale(sc, sc); ctx.translate(-360, 0);
  drawBoard(ctx, state.wood);
  for (let i = 0; i < 14; i++) {
    const p = pitPos(i), n = snap.pits[i];
    for (let k = 0; k < n; k++) { const s = slot(i, k); drawSeed(ctx, state.seeds, s.v, p.x + s.x, p.y + s.y, s.rot, 1.3); }
  }
  for (const pl of [0, 1]) {
    const T = pl === 0 ? TRAY.bottom : TRAY.top, n = snap.store[pl];
    for (let k = 0; k < n; k++) { const col = k % 18, row = Math.floor(k / 18); drawSeed(ctx, state.seeds, (k * 3 + pl) % 4, T.x + 172 + col * 22 + (row % 2) * 8, T.y + 22 + row * 23, ((k * 97) % 360) * Math.PI / 180, 1.05); }
  }
  if (hi && hi.pits) for (const i of hi.pits) {
    const p = pitPos(i), gr = ctx.createRadialGradient(p.x, p.y, PIT_R * 0.5, p.x, p.y, PIT_R + 22);
    gr.addColorStop(0, 'rgba(255,220,120,0)'); gr.addColorStop(0.7, 'rgba(255,220,120,0.55)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 22, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,120,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 4, 0, TAU); ctx.stroke();
  }
  if (hi && hi.trays) for (const T of [TRAY.top, TRAY.bottom]) {
    ctx.strokeStyle = 'rgba(255,220,120,0.95)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(T.x - 6, T.y - 6, T.w + 12, T.h + 12, 40); ctx.stroke();
  }
  ctx.restore();
}

export function render(ctx, state, L) {
  const scene = state.scene, big = state.big, g = state.game, A = state.anim, B = L.board, BTN = L.BTN;
  let G = TALL;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'puzzle' || scene === 'autoplay' || scene === 'autoplay-over';
  if (boardScene) G = L.geo;

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(30,8,0,0.55)'; ctx.fillText(str, x + 1.5, y + 2.5); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.3, align = 'center') => { const Ls = lines(str, maxW, size); Ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return Ls.length; };
  // A one-line heading never wraps; it shrinks to fit instead, so a long string can never clip past its panel.
  const fitSz = (str, size, weight, font, maxW, min) => { let s = size; ctx.font = `${weight} ${s}px ${font}`; while (ctx.measureText(str).width > maxW && s > min) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; } return s; };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(22, r.h * 0.27);
    ctx.fillStyle = 'rgba(30,8,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 7, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#fbdc8c'); gr.addColorStop(0.55, '#e0a83e'); gr.addColorStop(1, '#b9791f'); } else { gr.addColorStop(0, '#6d4022'); gr.addColorStop(0.5, '#4a2812'); gr.addColorStop(1, '#2f1608'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.85)' : 'rgba(243,207,122,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    let sz = Math.min(o.size ?? 30, Math.max(20, r.h * 0.4));
    sz = fitSz(label, sz, 700, UI, r.w - 16, 16);
    ctx.textAlign = 'center'; ctx.font = `700 ${sz}px ${UI}`;
    ctx.fillStyle = o.primary ? 'rgba(255,240,200,0.5)' : 'rgba(0,0,0,0.5)'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36 + 1.5);
    ctx.fillStyle = o.primary ? '#2a1606' : CREAM; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36);
    ctx.restore();
  };
  const panel = (x, y, w, h, alpha = 0.86) => {
    ctx.save(); ctx.fillStyle = `rgba(26,10,3,${alpha})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 24); ctx.fill();
    ctx.strokeStyle = 'rgba(243,207,122,0.75)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
  };
  const rpanel = (r, alpha) => panel(r.x, r.y, r.w, r.h, alpha);
  // text fitted into a rect: wraps, and shrinks the font until every line fits the height
  const fitText = (str, r, size, color = '#fff3d6', min = 16, align = 'center') => {
    let ms = size, Ls = lines(str, r.w - 28, ms);
    while (Ls.length * ms * 1.26 > r.h - 12 && ms > min) { ms -= 1; Ls = lines(str, r.w - 28, ms); }
    const top = r.y + r.h / 2 - (Ls.length * ms * 1.26) / 2 + ms * 0.95, x = align === 'left' ? r.x + 16 : r.x + r.w / 2;
    Ls.forEach((ln, i) => text(ln, x, top + i * ms * 1.26, ms, color, UI, 600, align, false));
  };

  // ---- the board and what is in it (canonical units; the caller sets the transform) ------------------------------------------------
  function contents(shownPits, shownStore, opts = {}) {
    const set = state.seeds, pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const legal = opts.legal || [];
    const glow = (i, rgb, a) => { const p = G.pit(i), R = G.pitR, gr = ctx.createRadialGradient(p.x, p.y, R * 0.5, p.x, p.y, R + 20); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.7, `rgba(${rgb},${0.55 * a})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, R + 20, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},${0.9 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, R + 3, 0, TAU); ctx.stroke(); };
    for (const i of legal) glow(i, '255,220,120', 0.5 + pulse * 0.5);
    if (state.hint && !A) glow(state.hint.pit, '130,255,170', 0.6 + pulse * 0.4);
    if (A && A.phase === 'capwait') for (const c of A.r.captured) glow(c, '255,190,80', 0.5 + Math.abs(Math.sin(A.timer * 14)) * 0.5);
    for (let i = 0; i < 14; i++) {
      const p = G.pit(i); const n = shownPits[i]; if (n <= 0) continue;
      const flying = A && A.phase === 'cap' && !A.r.lone && A.r.captured[A.cap] === i;
      if (flying) continue;
      let dx = 0;
      if (state.ref && state.ref.pit === i && !state.calm) dx = Math.sin(state.ref.t * 60) * 5 * (1 - state.ref.t / 0.6);
      for (let k = 0; k < n; k++) {
        const s = slot(i, k, G.pitR); let oy = 0, ox = 0, rot = s.rot;
        if (A && A.lastDrop === i && k === n - 1 && A.dropT < 0.24 && !state.calm) {
          // the seed that just landed bounces once and rolls in from the house it came from
          const f = A.dropT / 0.24, e = 1 - (1 - f) * (1 - f), prev = G.pit(A.idx >= 2 ? A.r.path[A.idx - 2] : A.r.pit), d = Math.hypot(p.x - prev.x, p.y - prev.y) || 1;
          oy = -11 * Math.sin(Math.PI * Math.min(1, f * 1.6)) * (1 - f); ox = ((prev.x - p.x) / d) * 22 * (1 - e); oy += ((prev.y - p.y) / d) * 12 * (1 - e); rot += (1 - e) * 4;
        }
        drawSeed(ctx, set, s.v, p.x + s.x + dx + ox, p.y + s.y + oy, rot, 1.3 * G.pitR / 40);
      }
    }
    if (state.ref && !A) { const p = G.pit(state.ref.pit); ctx.strokeStyle = `rgba(255,120,90,${0.9 * (1 - state.ref.t / 0.6)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, G.pitR + 4, 0, TAU); ctx.stroke(); }
    if (opts.counts !== false) for (let i = 0; i < 14; i++) {
      const n = shownPits[i]; if (n <= 0) continue; const p = G.pit(i), y = G.countY(i, big);
      const sz = big ? 34 : 27; ctx.textAlign = 'center'; ctx.font = `800 ${sz}px ${UI}`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(40,14,2,0.85)'; ctx.strokeText(String(n), p.x, y); ctx.fillStyle = '#ffecc0'; ctx.fillText(String(n), p.x, y);
    }
    for (const pl of [0, 1]) {
      const n = shownStore[pl];
      for (let k = 0; k < n; k++) { const q = G.seedAt(pl, k); drawSeed(ctx, set, (k * 3 + pl) % 4, q.x, q.y, ((k * 97) % 360) * Math.PI / 180, 1.05); }
      const label = opts.labels ? opts.labels[pl] : pl === 0 ? 'You' : 'Computer';
      if (opts.counts !== false) { const lb = G.label(pl), ct = G.count(pl); const lsz = fitSz(label, big ? 28 : 24, 700, UI, G.long ? 86 : 400, 12); text(label, lb.x, lb.y, lsz, CREAM, UI, 700, lb.align); text(String(n), ct.x, ct.y, big ? 50 : 44, GOLD, FONT, 700, ct.align); }
    }
  }
  const boardXform = () => { ctx.translate(B.cx, B.cy); ctx.scale(B.s, B.s); ctx.translate(-G.mid.x, -G.mid.y); };
  // a group of canonical-unit content (title art, result text) placed at {cx, top, sc}: canonical y `y0` maps to `top`
  const group = (G, y0) => { ctx.translate(G.cx, G.top); ctx.scale(G.sc, G.sc); ctx.translate(-360, -y0); };

  // ---- table -----------------------------------------------------------------------------------------------------------------------
  drawTable(ctx, state.wood, L, boardScene && L.tall);

  if (boardScene) {
    ctx.save(); boardXform(); drawBoard(ctx, state.wood, G); ctx.restore();
    if (L.wide && !L.long) { rpanel(L.leftCard, 0.42); rpanel(L.rightCard, 0.42); }
    // header lines: [text, role, colour] in reading order
    let head;
    const apPaused = scene === 'autoplay' && state.apPaused;
    if (scene === 'lesson') head = [[`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 'sub'], [LESSONS[state.lesson.i].title, 'title']];
    else if (scene === 'puzzle') head = [['Daily puzzle' + (state.pz.puzzle.hard ? ' (weekend)' : ''), 'sub'], ['Capture the most', 'title'], [`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 'gold']];
    else if (scene === 'autoplay' || scene === 'autoplay-over') {
      const AP = state.ap, dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
      const phaseLine = apPaused ? 'Paused' : g.winner !== null ? 'Game over' : !AP ? '' : AP.phase === 'think' ? 'Think' + dots : AP.phase === 'reveal' ? 'Here is the move' : 'Playing it out' + dots;
      head = [['Auto Play', 'title'], ['Watch & learn: both seats play themselves', 'sub'], [phaseLine, 'gold', apPaused ? '#ff9a6a' : GOLD]];
    } else {
      const th = state.thinking && !A ? 'The computer is thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : null;
      const line = g.winner !== null ? 'Game over' : state.two ? (g.turn === 0 ? 'Player one: bottom row' : 'Player two: top row') : g.turn === 0 ? 'Your move' : (th || 'The computer moves');
      head = [[line, 'title'], [state.two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name} · ${LEVELS[state.level].blurb}`, 'sub'], ['First to capture 40 seeds wins', 'gold']];
    }
    const drawHeader = (items) => {
      const H = L.hdr, k = H.k, lp = scene === 'lesson' || scene === 'puzzle';
      if (H.mode === 'stack') {
        const first = { title: 48, sub: 28, gold: 40 }, gap = { title: { sub: 46, gold: 52, title: 60 }, sub: { title: 75, gold: 42, sub: 40 }, gold: { sub: 40, title: 60, gold: 40 } };
        let y = H.y, prev = null;
        for (const [t, role, col] of items) {
          y += prev ? gap[prev][role] * k : first[role] * k;
          if (role === 'title') { const sz = fitSz(t, Math.max(40, Math.round((lp ? 62 : 58) * k)), 700, FONT, H.maxW, 26); text(t, H.cx, y, sz, CREAM, FONT); }
          else if (role === 'sub') { const sz = fitSz(t, Math.max(20, Math.round((lp ? 26 : 21) * k)), 500, UI, H.maxW, 17); text(t, H.cx, y, sz, 'rgba(251,232,191,0.85)', UI, 500); }
          else { const sz = fitSz(t, Math.max(20, Math.round(23 * k)), 700, UI, H.maxW, 17); text(t, H.cx, y, sz, col ?? GOLD, UI, 600); }
          prev = role;
        }
        return;
      }
      // card (landscape): centred, wrapped, flowing down the left card above the message panel
      let y = H.y;
      for (const [t, role, col] of items) {
        if (role === 'title') { const sz = fitSz(t, Math.round(60 * k), 700, FONT, H.maxW, 16); y += sz * 0.85; text(t, H.cx, y, sz, CREAM, FONT); y += sz * 0.28; }
        else { const sz = role === 'sub' ? 21 : 23, n = wrap(t, H.cx, y + sz + 4, sz, H.maxW, role === 'sub' ? 'rgba(251,232,191,0.85)' : (col ?? GOLD), sz * 1.25); y += n * sz * 1.25 + 8; }
      }
      return y;
    };
    let headEnd = null;
    if (scene !== 'over' && scene !== 'autoplay-over') headEnd = drawHeader(head);
    // the player's row of legal houses glows on the human turn (or, in Auto Play, during REVEAL)
    let legal = [];
    if (!A && g.winner === null) {
      if (scene === 'play') { if (state.two || g.turn === 0) legal = legalMoves(g); }
      else if (scene === 'lesson') { if (!state.lesson.done) legal = LESSONS[state.lesson.i].want.filter((p) => legalMoves(g).includes(p)); }
      else if (scene === 'puzzle') { if (state.pz.status !== 'solved' && state.pz.wrong <= 0) legal = legalMoves(g); }
      else if (scene === 'autoplay') { if (state.ap && state.ap.phase === 'reveal') legal = state.ap.legal; }
    }
    ctx.save(); boardXform();
    // a moving chevron along the carved arrows: the direction of sowing
    if (!state.calm) { const f = (state.t * 0.5) % 1; for (const { y, dir: d, x0, x1 } of G.arrows) { const x = d > 0 ? x0 + (x1 - x0) * f : x1 - (x1 - x0) * f; ctx.strokeStyle = `rgba(255,214,120,${0.9 * Math.sin(Math.PI * f)})`; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - d * 9, y - 9); ctx.lineTo(x + d * 9, y); ctx.lineTo(x - d * 9, y + 9); ctx.stroke(); } }
    contents(state.shown.pits, state.shown.store, { legal, labels: scene === 'autoplay' || scene === 'autoplay-over' ? ['Bottom seat', 'Top seat'] : scene === 'lesson' || scene === 'puzzle' ? ['You', 'Opponent'] : state.two ? ['Player one', 'Player two'] : ['You', 'Computer'] });
    if (state.kb && scene !== 'over') { const p = G.pit(pitAtCol(g.turn, state.cursor)); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, G.pitR + 7, 0, TAU); ctx.stroke(); }
    // the carried seeds, and capture flourish
    if (A) {
      const r = A.r, o = G.pit(r.pit);
      if (A.phase === 'lift' || A.phase === 'sow') {
        let x, y, gy, hop = 0;
        if (A.phase === 'lift') { const f = Math.min(1, A.timer / Math.max(0.01, state.calm ? 0.11 : 0.22)); x = o.x; gy = o.y; hop = 0; y = o.y - 30 * f; }
        else {
          const from = A.idx === 0 ? o : G.pit(r.path[A.idx - 1]), to = G.pit(r.path[Math.min(A.idx, r.path.length - 1)]), f = Math.min(1, A.timer / A.sd), e = f * f * (3 - 2 * f);
          x = from.x + (to.x - from.x) * e; gy = from.y + (to.y - from.y) * e; hop = state.calm ? 0 : Math.sin(Math.PI * f) * 26; y = gy - 30 - hop;
        }
        ctx.fillStyle = 'rgba(20,6,0,0.32)'; ctx.beginPath(); ctx.ellipse(x + 6, gy + 10, 26 - hop * 0.15, 11, 0, 0, TAU); ctx.fill();
        const n = Math.min(A.n, 9);
        for (let k = 0; k < n; k++) { const s = slot(99, k, 30); drawSeed(ctx, state.seeds, s.v, x + s.x * 0.75, y + s.y * 0.65, s.rot, 1.05); }
        if (A.n > 0) { ctx.fillStyle = 'rgba(30,10,2,0.9)'; ctx.beginPath(); ctx.arc(x + 26, y - 20, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke(); text(String(A.n), x + 26, y - 13, 20, '#ffe9b0', UI, 800, 'center', false); }
      }
      if (A.phase === 'cap') {
        const c = r.captured[A.cap], p = G.pit(c), T = G.trayPos(r.player), f = Math.min(1, A.timer / Math.max(0.01, state.calm ? 0.17 : 0.34)), e = f * f * (3 - 2 * f);
        const cnt = r.lone ? 1 : state.shown.pits[c];
        for (let k = 0; k < cnt; k++) { const s = slot(c, k, G.pitR), x = p.x + s.x + (T.x - p.x - s.x) * e, y = p.y + s.y + (T.y - p.y - s.y) * e - Math.sin(Math.PI * e) * 70; drawSeed(ctx, state.seeds, s.v, x, y, s.rot + e * 6, 1 + 0.15 * Math.sin(Math.PI * e)); }
        if (!state.calm) { ctx.strokeStyle = `rgba(255,214,120,${0.85 * (1 - f)})`; ctx.lineWidth = 7 * (1 - f) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, G.pitR * (0.8 + 0.9 * f), 0, TAU); ctx.stroke(); }
        text(`+${cnt}`, p.x, p.y - 40 - f * 30, 34, `rgba(255,224,130,${1 - f * 0.6})`, FONT, 700);
      }
      if (A.phase === 'end' && r.slam) text('Grand slam: nothing is taken', G.mid.x, G.mid.y + 6, 34, '#ffd7a0', FONT, 700);
    }
    ctx.restore();
    // message panel (a lesson's instruction stays up until the player has done it)
    const mr = scene === 'autoplay' ? L.msgA : L.msg, msz = big ? 34 : 28;
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(mr.x, mr.y, mr.w, mr.h, 0.9); fitText(state.msg.text, mr, msz); ctx.restore();
    } else if (scene === 'lesson' && !state.lesson.done && !state.anim) { panel(mr.x, mr.y, mr.w, mr.h, 0.9); fitText(LESSONS[state.lesson.i].text, mr, msz); }
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 28 }); button(BTN.undo, 'Undo', { size: 28 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 28, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 28 }); if (state.lesson.done && !A) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 28 }); if (state.pz.status === 'solved' && !A) button(BTN.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'autoplay') {
      button(BTN.apExit, 'Exit', { size: 28 });
      button(BTN.apPause, state.apPaused ? 'Resume' : 'Pause', { size: 26, primary: state.apPaused });
      button(BTN.apDec, '−', { size: 30, dim: state.apThinkIdx === 0 });
      button(BTN.apInc, '+', { size: 30, dim: state.apThinkIdx === AP_THINK_STEPS.length - 1 });
      text(`Think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, L.apCap.x, L.apCap.y, L.apCap.size, GOLD, UI, 600);
    }
    if (scene === 'play' && state.dev) text('DEV', L.dev.x, L.dev.y, 20, '#7dff9a', UI, 700, 'right');
  }

  if (scene === 'title' || scene === 'demo-limit') {
    const T = L.title(!!state.saved);
    if (scene === 'title' && T.card) rpanel(T.card, 0.4);
    ctx.save(); group(T.hero, 100);
    // the title: a smaller, real board under the name
    ctx.save(); ctx.translate(360, 300 - 400 * 0.6); ctx.scale(0.6, 0.6); ctx.translate(-360, 0);
    drawBoard(ctx, state.wood);
    const idle = { pits: new Array(14).fill(5), store: [0, 0] };
    contents(idle, idle.store, { counts: false });
    ctx.restore();
    text('Songo', 360, 196, 122, CREAM, FONT);
    text('The sowing game of Central Africa', 360, 250, 26, 'rgba(251,232,191,0.9)', FONT, 500);
    ctx.restore();
    if (scene === 'demo-limit' && L.demo.dim) { ctx.fillStyle = 'rgba(20,6,0,0.55)'; ctx.fillRect(0, 0, L.w, L.h); }
  }
  if (scene === 'title') {
    const T = L.title(!!state.saved), R = T.rows, solved = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 32 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 32 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 32 });
    button(R.two, 'Two players, one phone', { size: 30 });
    button(R.daily, solved ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 30 });
    button(R.autoplay, 'Auto Play · Watch & Learn', { size: 28 });
    button(R.about, 'About Songo', { size: 21 }); button(R.settings, 'Settings', { size: 21 }); button(R.rules, 'Rules', { size: 21 });
    if (T.stats) {
      text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, T.stats.x, T.stats.y, 22, 'rgba(251,232,191,0.85)', UI, 500);
      let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
      text(stars.trim(), T.stats.x, T.stats.y2, 30, GOLD, UI, 700);
    }
    if (state.msg) wrap(state.msg.text, T.msgX ?? L.w / 2, T.msgY, 24, Math.min(620, (T.card ? T.card.x - 30 : L.U.w - 40)), '#ffe9b0');
    if (T.lockup) drawLockupImage(ctx, T.lockup.cx, T.lockup.top, T.lockup.h, 0.9, (state.afFlash || 0) > 0);
  } else if (scene === 'demo-limit') {
    const D = L.demo;
    ctx.save(); ctx.translate(D.cx, D.cy); ctx.scale(D.sc, D.sc); ctx.translate(-360, -990);
    panel(60, 800, 600, 380, 0.88);
    text('That was the free taste.', 360, 920, 56, CREAM, FONT);
    text('Get Songo on iPhone and Android', 360, 1010, 30, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1052, 30, '#fff3d6', UI, 600);
    ctx.restore();
  } else if (scene === 'settings') {
    const S = L.settings, lv = LEVELS[state.level];
    rpanel(S.panel, 0.5);
    text('Settings', S.title.x, S.title.y, S.title.size, CREAM, FONT);
    button(S.rows.level, `Computer level: ${lv.name}`, { size: S.size });
    button(S.rows.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: S.size });
    button(S.rows.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: S.size });
    button(S.rows.big, state.big ? 'Large text: on' : 'Large text: off', { size: S.size });
    button(S.rows.seeds, `Seeds: ${SEEDSETS[state.seeds]}`, { size: S.size });
    button(S.rows.wood, `Board: ${WOODS[state.wood].name}`, { size: S.size });
    wrap(lv.blurb, S.blurb.x, S.blurb.y + S.blurb.size, S.blurb.size, S.blurb.w, '#ffe9b0');
    for (let k = 0; k < 9; k++) drawSeed(ctx, state.seeds, k % 4, S.seeds.x0 + k * S.seeds.step, S.seeds.y, k * 0.7, S.seeds.sc);
    button(S.back, 'Back', { primary: true, size: 32 });
  } else if (scene === 'about' || scene === 'rules') {
    const isAbout = scene === 'about', RD = L.reader, vp = RD.viewport, scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const secs = isAbout ? ABOUT_DOC : RULES_DOC;
    rpanel(RD.panel, 0.9);
    const ts = fitSz(isAbout ? ABOUT.title : 'Rules', RD.titleSize, 700, FONT, RD.panel.w - 2 * 130, 30);
    text(isAbout ? ABOUT.title : 'Rules', RD.cx, RD.titleY, ts, CREAM, FONT);
    button(RD.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 });
    button(RD.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    const bodySz = Math.round(29 * scale), lh = Math.round(bodySz * 1.4);
    const tx = vp.x, tw = vp.w;
    // The wrapped document is laid out once per (scene, text size, geometry, font) and reused; a frame draws only the visible slice.
    ctx.font = `800 40px ${UI}`; const fk1 = ctx.measureText('Hamburgefonstiv').width;   // changes when a web font finishes loading
    ctx.font = `800 40px ${FONT}`; const fk2 = ctx.measureText('Hamburgefonstiv').width;
    const key = [scene, bodySz, vp.x, vp.y, vp.w, vp.h, state.wood, state.seeds, fk1, fk2].join('|');
    const y0 = vp.y;
    if (readerCache.key !== key) {
      readerStats.layouts++;
      const items = []; let y = y0;
      const T = (str, x, yy, size, color, font, weight, align) => items.push({ k: 't', str, x, y: yy, size, color, font, weight, align });
      for (const page of secs) {
        const info = !isAbout ? ruleSnapshot(page.role) : null;
        const titleSz = fitSz(page.title, Math.round(30 * scale), 700, FONT, tw, 20);
        y += Math.round(titleSz * 0.9) + 4;
        T(page.title, isAbout ? tx : vp.x + vp.w / 2, y, titleSz, GOLD, FONT, 700, isAbout ? 'left' : 'center');
        y += Math.round(titleSz * 0.3 + bodySz * 0.9) + 8;
        if (info) {
          const sc = Math.max(0.2, Math.min(0.6, vp.w / 680, (vp.h * 0.8) / FRAME.h)), top = y - Math.round(bodySz * 0.6);
          items.push({ k: 'b', info, top, sc, h: FRAME.h * sc });
          y = top + FRAME.h * sc + 16;
          if (info.caption) { const cs = fitSz(info.caption, Math.round(23 * scale), 600, UI, vp.w, 16); y += cs * 0.8; T(info.caption, vp.x + vp.w / 2, y, cs, 'rgba(251,232,191,0.85)', UI, 600, 'center'); y += Math.round(cs * 0.3 + bodySz * 0.9) + 8; }
          else y += Math.round(bodySz * 0.9);
        }
        for (const line of page.lines) { const ls = lines(line, tw, bodySz); items.push({ k: 'l', ls, x: tx, y, size: bodySz, lh }); y += ls.length * lh + Math.round(16 * scale); }
        y += Math.round(18 * scale);
      }
      readerCache.key = key; readerCache.items = items; readerCache.endY = y;
    }
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip(); ctx.translate(0, -state.scroll);
    const vtop = vp.y + state.scroll - 100, vbot = vp.y + state.scroll + vp.h + 100;
    for (const it of readerCache.items) {
      if (it.k === 't') { if (it.y > vtop - it.size && it.y - it.size < vbot) text(it.str, it.x, it.y, it.size, it.color, it.font, it.weight, it.align); }
      else if (it.k === 'l') {
        if (it.y + it.ls.length * it.lh < vtop || it.y - it.size > vbot) continue;
        it.ls.forEach((ln, i) => { const ly = it.y + i * it.lh; if (ly > vtop - it.size && ly - it.size < vbot) text(ln, it.x, ly, it.size, '#fff3d6', UI, 600, 'left'); });
      } else if (it.top + it.h >= vtop && it.top <= vbot) drawRuleBoard(ctx, state, it.info.snap, it.info.hi, vp.x + vp.w / 2, it.top, it.sc);
    }
    const y = readerCache.endY;
    ctx.restore();
    readerMetrics.content = y - y0 - Math.round(bodySz * 0.3); readerMetrics.view = vp.h;
    if (readerMetrics.content > vp.h + 2) {
      const sb = RD.scrollbar, th = Math.max(36, sb.h * vp.h / readerMetrics.content), mx = readerMetrics.content - vp.h, ty = sb.y + (sb.h - th) * Math.min(1, state.scroll / mx);
      ctx.fillStyle = 'rgba(243,207,122,0.18)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 8); ctx.fill();
      ctx.fillStyle = 'rgba(243,207,122,0.85)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 8); ctx.fill();
    }
    const mxs = Math.max(0, readerMetrics.content - vp.h), last = state.scroll >= mxs - 1;
    text(mxs > 0 ? `${Math.round(100 * Math.min(1, state.scroll / mxs))}% read` : 'All on one screen', RD.cx, RD.counterY, 20, 'rgba(251,232,191,0.65)', UI, 500);
    button(RD.back, 'Back', { size: 28 });
    button(RD.next, last ? 'Done' : 'Next', { primary: true, size: 28 });
  } else if (scene === 'over' || scene === 'autoplay-over') {
    ctx.fillStyle = 'rgba(20,6,0,0.7)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over;
    ctx.save(); group(O.group, 440);
    if (scene === 'over') {
      const won = g.winner === 'draw' ? 'A draw' : state.two ? (g.winner === 0 ? 'Player one wins' : 'Player two wins') : g.winner === 0 ? 'You win!' : 'The computer wins';
      text(won, 360, 500, fitSz(won, 96, 700, FONT, 660, 40), CREAM, FONT);
      wrap(g.reason, 360, 570, 26, 560, '#fff3d6');
      text(`${state.shown.store[0]} : ${state.shown.store[1]}`, 360, 740, 120, GOLD, FONT);
      text(state.two ? 'Player one : Player two' : 'You : Computer', 360, 785, 24, 'rgba(251,232,191,0.85)', UI, 600);
      text(`${g.moves} moves`, 360, 830, 24, 'rgba(251,232,191,0.7)', UI, 500);
      if (!state.two && g.winner === 0) {
        text(`★ ${LEVELS[state.level].name} beaten`, 360, 900, 32, GOLD, UI, 700);
        if (!state.calm) for (let k = 0; k < 16; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (170 + 90 * ph), y = 640 - ph * 420; drawSeed(ctx, state.seeds, k % 4, x, y, ph * 6, 0.9 - ph * 0.4); }
      }
    } else {
      const won = g.winner === 'draw' ? 'A draw' : g.winner === 0 ? 'Bottom seat wins' : 'Top seat wins';
      text('Auto Play complete', 360, 470, 52, CREAM, FONT);
      text(won, 360, 560, 78, GOLD, FONT);
      wrap(g.reason, 360, 630, 26, 560, '#fff3d6');
      text(`${state.shown.store[0]} : ${state.shown.store[1]}`, 360, 780, 110, GOLD, FONT);
      text('Bottom seat : Top seat', 360, 825, 24, 'rgba(251,232,191,0.85)', UI, 600);
      text(`${g.moves} moves`, 360, 865, 24, 'rgba(251,232,191,0.7)', UI, 500);
    }
    ctx.restore();
    button(O.again, 'Play again', { primary: true, size: 36 }); button(O.back, scene === 'over' ? 'Menu' : 'Exit to menu', { size: 32 });
    drawMoreLine(ctx, O.back.x + O.back.w / 2, O.back.y + O.back.h + 56, 24);
  }
}
