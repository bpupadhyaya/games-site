// Everything drawn each frame. Reads `state` (game.js) and changes nothing except the reader's scroll limit. All screen geometry comes from the
// layout `L` (layout.js, a function of the live screen size); the board is drawn in its own canonical coordinates through one transform.
// The ground, board and shell sprites are cached (art.js).
import { W, PIT_R, STORE_BOX, HULL, TEXT_SCALES, posXY, AUTO_THINK_STEPS } from './layout.js';
import { drawGround, drawBoard, drawSeed, slot, drawHousePit, drawStorePit, WOODS, SEEDSETS } from './art.js';
import { legalMoves, STORE, SEQ, nextRound, clone } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO, ABOUT_DOC, HOWTO_DOC, RULES_DOC } from './about.js';
import { drawMoreLine, drawLockup, drawCredit } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, CREAM = '#fbe8bf', GOLD = '#f3cf7a';
// Reader layout cache (wrapped lines + total height). readerStats.layouts counts rebuilds (tests read it).
const readerCache = { key: '', items: [], endY: 0 };
export const readerStats = { layouts: 0 };
export const MATCHES = { single: 'One round', short: 'Three rounds', full: 'Full match' };

export function render(ctx, state, L) {
  const scene = state.scene, big = state.big, g = state.game, A = state.anim, calm = state.calm, t = state.t;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'puzzle' || scene === 'round' || scene === 'auto';
  const sw = L.w, sh = L.h, U = L.U, cx0 = (U.x0 + U.x1) / 2, Bs = L.board.s;
  // text drawn on the (possibly shrunk) board is enlarged a little so it stays readable
  const bz = (v) => Math.round(v * Math.min(1.35, Math.max(1, 0.82 / Bs)));

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(10,6,20,0.6)'; ctx.fillText(str, x + 1.5, y + 2.5); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.3, align = 'center') => { const Ls = lines(str, maxW, size); Ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return Ls.length; };
  // Shrinks a one-line heading only if it would otherwise run past maxW (a no-op for every heading that already fits at the base size).
  const fitTitle = (str, base, maxW, font = FONT, weight = 700, min = 22) => {
    let size = base; ctx.font = `${weight} ${size}px ${font}`;
    while (ctx.measureText(str).width > maxW && size > min) { size -= 2; ctx.font = `${weight} ${size}px ${font}`; }
    return size;
  };
  const button = (r, label, o = {}) => {
    ctx.save();
    // The pill's own background/border is always drawn at full strength, even when `dim` (disabled): only the label dims.
    ctx.fillStyle = 'rgba(8,4,16,0.5)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 7, r.w, r.h, 24); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffe4a0'); gr.addColorStop(0.55, '#e2a842'); gr.addColorStop(1, '#a86a1c'); } else { gr.addColorStop(0, '#6a3f22'); gr.addColorStop(0.5, '#47260f'); gr.addColorStop(1, '#2c1408'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(24, r.h / 2)); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.9)' : 'rgba(243,207,122,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    if (o.dim) ctx.globalAlpha = 0.55;
    let sz = o.size ?? 30; ctx.font = `700 ${sz}px ${UI}`;
    while (sz > 14 && ctx.measureText(label).width > r.w - 28) { sz -= 1; ctx.font = `700 ${sz}px ${UI}`; }
    ctx.textAlign = 'center';
    ctx.fillStyle = o.primary ? 'rgba(255,240,200,0.5)' : 'rgba(0,0,0,0.5)'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36 + 1.5);
    ctx.fillStyle = o.primary ? '#2a1606' : CREAM; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36);
    ctx.restore();
  };
  const panel = (x, y, w, h, alpha = 0.88) => {
    ctx.save(); ctx.fillStyle = `rgba(20,12,34,${alpha})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(243,207,122,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(243,207,122,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 20); ctx.stroke(); ctx.restore();
  };
  const star = (x, y, r, a) => { ctx.save(); ctx.translate(x, y); ctx.fillStyle = `rgba(255,250,225,${a})`; ctx.beginPath(); for (let k = 0; k < 8; k++) { const rad = k % 2 ? r * 0.22 : r; const ang = k * Math.PI / 4; ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad); } ctx.closePath(); ctx.fill(); ctx.restore(); };

  // ---- the board's contents: shells in houses, stores, plugs of burnt houses, glows, hands (board coordinates) -----------------
  function contents(sb, opts = {}) {
    const set = state.seeds, pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 5), burnt = opts.burnt || g.burnt;
    const glow = (pos, rgb, a) => { const p = posXY(pos), gr = ctx.createRadialGradient(p.x, p.y, PIT_R * 0.5, p.x, p.y, PIT_R + 22); gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.7, `rgba(${rgb},${0.6 * a})`); gr.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 22, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},${0.95 * a})`; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 3, 0, TAU); ctx.stroke(); };
    for (const i of opts.legal || []) glow(i, '255,222,120', 0.5 + pulse * 0.5);
    if (state.hint && !A) glow(state.hint.pit, '130,255,170', 0.6 + pulse * 0.4);
    if (opts.picks) for (const pl of [0, 1]) if (opts.picks[pl] != null && (state.two || pl === 0)) glow(opts.picks[pl], '140,220,255', 0.9);
    if (A && A.cap) for (const pos of [A.cap.e.pos, A.cap.e.from]) glow(pos, '255,190,80', 0.5 + Math.abs(Math.sin(A.cap.t * 14)) * 0.5);
    for (let i = 0; i < 15; i++) {
      if (i === 7) continue;
      const p = posXY(i);
      if (burnt[i]) { plug(p.x, p.y); continue; }
      const n = sb[i]; if (n <= 0) continue;
      const flyN = A && A.cap && (A.cap.e.pos === i || A.cap.e.from === i);
      if (flyN) continue;
      let dx = 0; if (state.ref && state.ref.pit === i && !calm) dx = Math.sin(state.ref.t * 60) * 5 * (1 - state.ref.t / 0.6);
      const ld = A ? A.lastDrop[i] : undefined;
      for (let k = 0; k < n; k++) {
        const s = slot(i, k); let oy = 0;
        if (ld !== undefined && k === n - 1 && A.tt - ld < 0.14 && !calm) oy = -10 * (1 - (A.tt - ld) / 0.14);
        drawSeed(ctx, set, s.v, p.x + s.x + dx, p.y + s.y + oy, s.rot, 1.42);
      }
    }
    if (state.ref && !A) { const p = posXY(state.ref.pit); ctx.strokeStyle = `rgba(255,120,90,${0.9 * (1 - state.ref.t / 0.6)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 4, 0, TAU); ctx.stroke(); }
    if (opts.counts !== false) for (let i = 0; i < 15; i++) {
      if (i === 7 || burnt[i]) continue; const n = sb[i]; if (n <= 0) continue; const p = posXY(i), left = i > 7;
      const sz = bz(big ? 34 : 28); ctx.textAlign = 'center'; ctx.font = `800 ${sz}px ${UI}`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(40,14,2,0.85)';
      const x = p.x + (left ? -(PIT_R + 26) : PIT_R + 26), y = p.y + sz * 0.36; ctx.strokeText(String(n), x, y); ctx.fillStyle = '#ffecc0'; ctx.fillText(String(n), x, y);
    }
    // storehouses
    for (const pl of [0, 1]) {
      const S = STORE_BOX[pl], n = sb[STORE[pl]], flyInto = A && A.cap && A.cap.e.p === pl;
      for (let k = 0; k < n; k++) { const col = k % 7, row = Math.floor(k / 7) % 3, ext = Math.floor(k / 21); drawSeed(ctx, set, (k * 3 + pl) % 4, S.x + 26 + col * 14 + (row % 2) * 6 + ext * 3, S.y + 46 + row * 12 + ext * 2, ((k * 97) % 360) * Math.PI / 180, 0.8); }
      void flyInto;
      if (opts.counts !== false) {
        const label = opts.labels ? opts.labels[pl] : pl === 0 ? 'You' : 'Computer';
        text(label, S.x + 20, S.y + 26, bz(big ? 22 : 20), CREAM, UI, 700, 'left');
        text(String(n), S.x + S.w - 20, S.y + S.h / 2 + 16, big ? 52 : 46, GOLD, FONT, 700, 'right');
      }
    }
  }
  function plug(x, y) {                                     // a burnt house: a charred plug pressed into the hole
    const r = PIT_R - 2, gr = ctx.createRadialGradient(x - 8, y - 10, 3, x, y, r); gr.addColorStop(0, '#4a3226'); gr.addColorStop(0.6, '#1e1310'); gr.addColorStop(1, '#0a0605');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,50,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 3, 0.2, 2.2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x - 20, y - 16); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x + 20, y + 22); ctx.moveTo(x + 18, y - 20); ctx.lineTo(x - 4, y + 2); ctx.lineTo(x - 18, y + 20); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,150,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 1, 0.6, 2.4); ctx.stroke();
  }

  // ---- the ground, and the boat ------------------------------------------------------------------------------------------
  drawGround(ctx, sw, sh);
  if (!calm) { // a slow band of tropical light drifting over the ground
    const f = ((t * 0.045) % 1) * (sw + 900) - 450; const gr = ctx.createLinearGradient(f - 260, 0, f + 260, sh * 0.5); gr.addColorStop(0, 'rgba(255,214,140,0)'); gr.addColorStop(0.5, 'rgba(255,214,140,0.085)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 100, sw, sh - 200);
  }
  const chev = () => {
    if (calm) return; const y0 = posXY(6).y, y1 = posXY(0).y, f = (t * 0.45) % 1;
    for (const [x, d] of [[400, -1], [320, 1]]) {           // up the right-hand side of the middle, down the left
      for (let k = 0; k < 3; k++) { const ff = (f + k / 3) % 1, y = d < 0 ? y1 - (y1 - y0) * ff : y0 + (y1 - y0) * ff; ctx.strokeStyle = `rgba(255,222,150,${0.75 * Math.sin(Math.PI * ff)})`; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - 10, y - d * 9); ctx.lineTo(x, y + d * 9); ctx.lineTo(x + 10, y - d * 9); ctx.stroke(); }
    }
  };

  if (boardScene) {
    // landscape: two cards flank the board
    if (L.wide) { panel(L.leftCard.x, L.leftCard.y, L.leftCard.w, L.leftCard.h, 0.5); panel(L.rightCard.x, L.rightCard.y, L.rightCard.w, L.rightCard.h, 0.5); }
    // ---- the board, through one transform (translate + uniform scale) ----
    ctx.save(); ctx.translate(L.board.cx, L.board.cy); ctx.scale(Bs, Bs); ctx.translate(-360, -798);
    drawBoard(ctx, state.wood);
    // glows for whichever houses can be played now
    let legal = [];
    const human = !A && g.phase === 'play' && (scene === 'play' ? (state.two || g.turn === 0 || g.opening) : scene === 'lesson' ? !state.lesson.done : scene === 'puzzle' ? (state.pz.status !== 'solved' && state.pz.wrong <= 0) : false);
    if (human) {
      if (g.opening) legal = [...legalMoves(g, 0).filter((h) => !state.pick || state.pick[0] == null), ...(state.two ? legalMoves(g, 1).filter((h) => !state.pick || state.pick[1] == null) : [])];
      else legal = scene === 'lesson' ? LESSONS[state.lesson.i].steps[state.lesson.step].want.filter((p) => legalMoves(g).includes(p)) : legalMoves(g);
    }
    chev();
    contents(state.shown, { legal, picks: g.opening ? state.pick : null, labels: scene === 'lesson' || scene === 'puzzle' ? ['You', 'Opponent'] : state.two ? ['Player 1', 'Player 2'] : ['You', 'Computer'] });
    if (state.kb && human) { const pos = g.opening || g.turn === 0 ? state.cursor : 14 - state.cursor; const p = posXY(pos); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R + 8, 0, TAU); ctx.stroke(); }
    // hands carrying shells, and the capture flourish
    if (A) {
      for (const pl of [0, 1]) {
        const h = A.hands[pl]; if (!h || h.n <= 0) continue;
        const hop = calm ? 0 : Math.sin(Math.PI * Math.min(1, A.timer / A.sd)) * 22, y = h.y - 30 - hop;
        ctx.fillStyle = 'rgba(8,4,16,0.32)'; ctx.beginPath(); ctx.ellipse(h.x + 6, h.y + 10, 26, 11, 0, 0, TAU); ctx.fill();
        const n = Math.min(h.n, 9); for (let k = 0; k < n; k++) { const s = slot(99, k, 30); drawSeed(ctx, state.seeds, s.v, h.x + s.x * 0.75, y + s.y * 0.65, s.rot, 1.05); }
        ctx.fillStyle = 'rgba(20,10,30,0.92)'; ctx.beginPath(); ctx.arc(h.x + 27, y - 20, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = pl === 0 ? GOLD : '#9fd4ff'; ctx.lineWidth = 2.2; ctx.stroke();
        text(String(h.n), h.x + 27, y - 13, 20, '#ffe9b0', UI, 800, 'center', false);
      }
      if (A.cap) {
        const e = A.cap.e, T = posXY(STORE[e.p]), f = Math.min(1, A.cap.t / Math.max(0.01, A.cap.dur)), ez = f * f * (3 - 2 * f);
        for (const pos of [e.from, e.pos]) {
          const p = posXY(pos), cnt = state.shown[pos];
          for (let k = 0; k < cnt; k++) { const s = slot(pos, k), x = p.x + s.x + (T.x - p.x - s.x) * ez, y = p.y + s.y + (T.y - p.y - s.y) * ez - Math.sin(Math.PI * ez) * 60; drawSeed(ctx, state.seeds, s.v, x, y, s.rot + ez * 6, 1.18 + 0.15 * Math.sin(Math.PI * ez)); }
        }
        const p = posXY(e.from);
        if (!calm) { ctx.strokeStyle = `rgba(255,214,120,${0.85 * (1 - f)})`; ctx.lineWidth = 7 * (1 - f) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, PIT_R * (0.8 + 0.9 * f), 0, TAU); ctx.stroke(); }
        text(`+${e.n}`, p.x, p.y - 50 - f * 30, bz(38), `rgba(255,224,130,${1 - f * 0.6})`, FONT, 700);
      }
    }
    ctx.restore();

    // ---- header (status lines) ----
    const H0 = L.hdr, hx = H0.x + H0.w / 2, hy = H0.y;
    if (scene === 'lesson') {
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, hx, hy + 32, 26, 'rgba(251,232,191,0.9)', UI, 600);
      text(LESSONS[state.lesson.i].title, hx, hy + 104, fitTitle(LESSONS[state.lesson.i].title, 64, H0.w, FONT, 700, 30), CREAM, FONT);
    } else if (scene === 'puzzle') {
      text('Daily puzzle' + (state.pz.puzzle.hard ? ' (weekend)' : ''), hx, hy + 32, 26, 'rgba(251,232,191,0.9)', UI, 600);
      text('Collect the most', hx, hy + 100, fitTitle('Collect the most', 64, H0.w, FONT, 700, 30), CREAM, FONT);
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, hx, hy + 134, 24, GOLD, UI, 600);
    } else {
      const th = state.thinking && !A ? 'The computer is thinking' + '.'.repeat(1 + (Math.floor(t * 3) % 3)) : null;
      let line;
      if (g.phase === 'matchOver') line = 'Game over';
      else if (g.opening) line = state.two ? 'Both players: choose a house' : 'Choose your first house';
      else line = state.two ? (g.turn === 0 ? 'Player one: right column' : 'Player two: left column') : g.turn === 0 ? (g.extra ? 'Play again!' : 'Your move') : (th || 'The computer moves');
      text(line, hx, hy + 58, fitTitle(line, big ? 56 : 62, H0.w, FONT, 700, 30), CREAM, FONT);
      const l2 = state.two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name}`;
      text(l2, hx, hy + 96, fitTitle(l2, 22, H0.w, UI, 600, 15), 'rgba(251,232,191,0.9)', UI, 600);
      const wins = [g.rounds.filter((r) => r.a > r.b).length, g.rounds.filter((r) => r.b > r.a).length];
      const l3 = g.mode === 'single' ? 'One round: most shells wins' : `Round ${g.round}${g.mode === 'short' ? ' of 3' : ''} · rounds won ${wins[0]} : ${wins[1]}`;
      text(l3, hx, hy + 128, fitTitle(l3, 22, H0.w, UI, 600, 15), GOLD, UI, 600);
    }
    // quiet hints under the header
    const subOK = !(scene === 'auto' && !L.wide);
    if (subOK && A && !A.fast && A.ev.length > 40 && scene !== 'over') text('TAP to fast-forward', L.sub.x + L.sub.w / 2, L.sub.y + 28, 22, 'rgba(251,232,191,0.85)', UI, 600);
    else if (subOK && g.opening && !A && scene === 'play' && state.pick && state.pick[0] != null && !state.two) text('Waiting…', L.sub.x + L.sub.w / 2, L.sub.y + 30, 26, '#bfe6ff', UI, 700);
    // message panel
    const showMsg = state.msg && scene !== 'over' && scene !== 'round';
    const lessonText = scene === 'lesson' && !state.lesson.done && !A ? LESSONS[state.lesson.i].steps[state.lesson.step].text : null;
    const body = showMsg ? state.msg.text : lessonText;
    if (body) {
      const al = showMsg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 1, M = L.msg;
      let ms = big ? 30 : 26, Lm = lines(body, M.w - 36, ms);
      while (Lm.length * ms * 1.26 > M.h - 14 && ms > 15) { ms -= 1; Lm = lines(body, M.w - 36, ms); }
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(M.x, M.y, M.w, M.h, 0.92);
      const top = M.y + M.h / 2 - (Lm.length * ms * 1.26) / 2 + ms * 0.9; Lm.forEach((ln, i) => text(ln, M.x + M.w / 2, top + i * ms * 1.26, ms, '#fff3d6', UI, 600, 'center', false));
      ctx.restore();
    }
    const B = L.BTN;
    if (scene === 'play') { button(B.menu, 'Menu', { size: 28 }); button(B.undo, 'Undo', { size: 28 }); button(B.hint, `Hint (${state.hintsLeft})`, { size: 28, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(B.menu, 'Menu', { size: 28 }); if (state.lesson.done && !A) button(B.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 }); }
    else if (scene === 'puzzle') { button(B.menu, 'Menu', { size: 28 }); if (state.pz.status === 'solved' && !A) button(B.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'auto' && state.auto && state.auto.sub !== 'over' && state.auto.sub !== 'roundover') {
      // Menu/Undo/Hint have no meaning in a spectator run: the same three slots become Exit / Pause / Skip.
      button(B.menu, 'Exit', { size: 28 }); button(B.undo, state.auto.paused ? 'Resume' : 'Pause', { size: 28 }); button(B.hint, 'Skip', { size: 28 });
    }
    // developer marker (debug builds only): top-right, clear of the back button and of every real button
    if (scene === 'play' && state.dev) text('DEV', U.x1 - 14, U.y0 + 30, 20, '#7dff9a', UI, 700, 'right');
    if (scene === 'auto' && state.auto && state.auto.sub !== 'roundover' && state.auto.sub !== 'over') {
      const r = L.AUTO.bar, A2 = state.auto;
      panel(r.x, r.y, r.w, r.h, 0.68);
      const label = A2.paused ? 'Paused' : A2.sub === 'think' ? 'Thinking...' : A2.sub === 'reveal' ? 'Revealing...' : '';
      text(label, r.x + 18, r.y + r.h / 2 + 8, 24, A2.paused ? '#ffd08a' : GOLD, UI, 700, 'left', false);
      text(`Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, L.AUTO.dec.x - 12, r.y + r.h / 2 + 7, 20, CREAM, UI, 600, 'right', false);
      button(L.AUTO.dec, '-', { size: 26 }); button(L.AUTO.inc, '+', { size: 26 });
    }
  }

  // ---- the title: a hero (boat on the water) and the buttons --------------------------------------------------------------
  function hero(Rh, withTitle) {
    const kh = Math.min(1, Rh.w / 700, Rh.h / 628), hx = Rh.x + Rh.w / 2, hy = Rh.y + (Rh.h - 628 * kh) / 2;
    const sway = calm ? 0 : Math.sin(t * 0.9) * 0.03, bob = calm ? 0 : Math.sin(t * 1.3) * 7;
    const lx = 360 - hx / kh - 20, rx = 360 + (sw - hx) / kh + 20;           // the water runs the full width of the screen
    const wave = (base, amp, k, col, crest, ph) => {
      ctx.beginPath(); ctx.moveTo(lx, base + 200); for (let x = lx; x <= rx; x += 12) ctx.lineTo(x, base + Math.sin(x / 70 + t * (calm ? 0 : k) + ph) * amp + Math.sin(x / 31 + t * (calm ? 0 : k * 1.7)) * amp * 0.3); ctx.lineTo(rx, base + 200); ctx.closePath();
      const gr = ctx.createLinearGradient(0, base - amp, 0, base + 150); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]); ctx.fillStyle = gr; ctx.fill();
      ctx.beginPath(); for (let x = lx; x <= rx; x += 12) { const y = base + Math.sin(x / 70 + t * (calm ? 0 : k) + ph) * amp + Math.sin(x / 31 + t * (calm ? 0 : k * 1.7)) * amp * 0.3; x > lx ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = crest; ctx.lineWidth = 3; ctx.stroke();
    };
    ctx.save(); ctx.translate(hx, hy); ctx.scale(kh, kh); ctx.translate(-360, -96);
    wave(690, 9, 0.9, ['rgba(20,90,110,0.85)', 'rgba(10,40,70,0)'], 'rgba(200,240,235,0.5)', 0);
    ctx.save(); ctx.translate(360, 520 + bob); ctx.rotate(-Math.PI / 2 + sway); ctx.scale(0.6, 0.6); ctx.translate(-360, -HULL.cy);
    drawBoard(ctx, state.wood);
    const full = new Array(16).fill(7); full[7] = 0; full[15] = 0;
    contents(full, { counts: false, burnt: new Array(16).fill(false) });
    ctx.restore();
    if (!calm) for (let k = 0; k < 4; k++) { const ph = (t * 0.35 + k * 0.27) % 1; star(190 + k * 110 + Math.sin(k * 5) * 30, 430 + ((k * 53) % 200), 9 * Math.sin(Math.PI * ph) + 1, Math.sin(Math.PI * ph)); }
    wave(668, 12, 1.2, ['rgba(30,120,140,0.55)', 'rgba(14,60,90,0)'], 'rgba(220,250,245,0.7)', 2);
    wave(716, 10, 1.6, ['rgba(20,100,125,0.9)', 'rgba(8,36,66,0)'], 'rgba(200,240,235,0.55)', 4);
    if (withTitle) {
      let fs = 130;
      const I = L.ins || {}, u = (I.back || 0) / 56;
      if (I.back && (hy + (196 - 96 - 100) * kh) < (I.t || 0) + 8 * u + I.back + 6) {   // the title would sit under the host back button: keep it clear
        ctx.save(); ctx.font = `400 130px ${FONT}`; const w130 = ctx.measureText('Congklak').width; ctx.restore();
        const room = 2 * (hx - ((I.l || 0) + 8 * u + I.back + 10)) / kh; if (room > 0 && w130 > room) fs = Math.max(60, Math.floor(130 * room / w130));
      }
      text('Congklak', 360, 196, fs, CREAM, FONT);
      text('The shell game of Southeast Asia', 360, 250, 28, 'rgba(251,232,191,0.95)', FONT, 700);
    }
    ctx.restore();
  }
  if (scene === 'title' || scene === 'demo-limit') {
    const T = L.titleRows(!!state.saved);
    hero(T.hero, true);
  }
  if (scene === 'title') {
    const T = L.titleRows(!!state.saved), solved = state.daily.solvedDay === state.daily.day;
    if (T.resume) button(T.resume, 'Continue your game', { primary: true, size: 32 });
    button(T.learn, 'Learn to play', { primary: !state.learned && !T.resume, size: 32 });
    button(T.play, 'Play the computer', { primary: state.learned && !T.resume, size: 32 });
    button(T.two, 'Two players, one phone', { size: 30 });
    button(T.daily, solved ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 30 });
    button(T.about, 'About', { size: 21 }); button(T.how, 'Controls', { size: 21 }); button(T.rules, 'Rules', { size: 21 }); button(T.settings, 'Settings', { size: 21 }); button(T.auto, 'Auto', { size: 21 });
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, T.stats.x, T.stats.y, 22, 'rgba(251,232,191,0.9)', UI, 500);
    let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
    text(stars.trim(), T.stats.x, T.stats.y + 40, 30, GOLD, UI, 700);
    // the Arcforge credit: small and quiet (the themed lockup; a text credit until it has loaded)
    if (!drawLockup(ctx, T.lock, 0.9, (state.afFlash || 0) > 0)) drawCredit(ctx, T.lock.x + T.lock.w / 2, T.lock.y + T.lock.h * 0.7, 15, { dim: 0.8 });
    if (state.msg) { panel(T.msg.x, T.msg.y, T.msg.w, T.msg.h, 0.8); const ml = lines(state.msg.text, T.msg.w - 30, 22); const ms = ml.length > 2 ? 17 : 22; const ml2 = ml.length > 2 ? lines(state.msg.text, T.msg.w - 30, ms) : ml; ml2.slice(0, 3).forEach((ln, i) => text(ln, T.msg.x + T.msg.w / 2, T.msg.y + T.msg.h / 2 + ms * 0.35 - ((ml2.length - 1) * ms * 1.2) / 2 + i * ms * 1.2, ms, '#ffe9b0', UI, 600, 'center', false)); }
  } else if (scene === 'demo-limit') {
    const D = L.demo; panel(D.x, D.y, D.w, D.h, 0.9);
    text('That was the free taste.', D.x + D.w / 2, D.y + 120, 56, CREAM, FONT);
    text('Get Congklak on iPhone and Android', D.x + D.w / 2, D.y + 210, 28, '#fff3d6', UI, 600); text('for unlimited games.', D.x + D.w / 2, D.y + 252, 28, '#fff3d6', UI, 600);
  } else if (scene === 'settings') {
    const V = L.setView, S = L.SET;
    panel(V.panel.x, V.panel.y, V.panel.w, V.panel.h, 0.55);
    text('Settings', V.title.x, V.title.y, V.compact ? 60 : 70, CREAM, FONT);
    const lv = LEVELS[state.level];
    button(S.level, `Computer level: ${lv.name}`, { size: 30 });
    button(S.match, `Match: ${MATCHES[state.match]}`, { size: 30 });
    button(S.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 30 });
    button(S.calm, calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 30 });
    button(S.big, big ? 'Large text: on' : 'Large text: off', { size: 30 });
    button(S.seeds, `Pieces: ${SEEDSETS[state.seeds]}`, { size: 30 });
    button(S.wood, `Board: ${WOODS[state.wood].name}`, { size: 30 });
    wrap(lv.blurb, V.blurb.x, V.blurb.y + 18, V.compact ? 22 : 26, V.blurb.w, '#ffe9b0');
    wrap(state.match === 'single' ? 'One round: whoever holds more shells at the end wins.' : state.match === 'short' ? 'Three rounds, with burnt houses after each. Win more rounds, or leave your opponent with no houses.' : 'Play on until one player has no houses left (nine rounds at most).', V.blurb2.x, V.blurb2.y + 28, V.compact ? 20 : 24, V.blurb2.w, 'rgba(251,232,191,0.9)');
    for (let k = 0; k < 9; k++) drawSeed(ctx, state.seeds, k % 4, V.seeds.cx - 152 + k * 38, V.seeds.y, k * 0.7, 1.5);
    button(S.back, 'Back', { primary: true, size: 32 });
  } else if (scene === 'about' || scene === 'how' || scene === 'rules') {
    // Reference pages: ONE panel with a scrolling body (drag, wheel, keys). The text-size stepper never overlaps the back button.
    const RD = L.READ, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, isRules = scene === 'rules';
    const P = scene === 'about' ? ABOUT : HOWTO, secs = isRules ? RULES_DOC : (scene === 'about' ? ABOUT_DOC : HOWTO_DOC);
    panel(RD.panel.x, RD.panel.y, RD.panel.w, RD.panel.h, 0.92);
    const head = isRules ? 'Rules' : P.title;
    text(head, RD.title.x, RD.title.y, fitTitle(head, Math.round(RD.title.size * Math.min(scale, 1.15)), RD.title.w, FONT, 700, 30), CREAM, FONT);
    const bd = RD.body, cw = bd.w, mid = bd.x + cw / 2, scroll = Math.min(Math.max(0, state.scroll || 0), state.readerMax || 0);
    const bodySize = Math.round(28 * scale), lh = Math.round(bodySize * 1.4);
    const gz = Math.max(0, scale - 1);
    // The wrapped document is laid out once per (scene, text size, geometry, font) and reused; a frame draws only the visible slice.
    ctx.font = `800 40px ${UI}`; const fontsKey = ctx.measureText('Hamburgefonstiv').width;   // changes when a web font finishes loading
    ctx.font = `800 40px ${FONT}`; const fontsKey2 = ctx.measureText('Hamburgefonstiv').width;
    const key = [scene, bodySize, bd.x, bd.y, cw, state.seeds, fontsKey, fontsKey2].join('|');
    if (readerCache.key !== key) {
      readerStats.layouts++;
      const items = []; let y = bd.y;
      const T = (str, x, yy, size, color, font, weight, align) => items.push({ k: 't', str, x, y: yy, size, color, font, weight, align });
      const cap = (str, x, yy) => T(str, x, yy, 20, 'rgba(251,232,191,0.75)', UI, 600, 'center');
      for (const sec of secs) {
        const titleSize = fitTitle(sec.title, Math.round((isRules ? 32 : 34) * scale), cw);
        const titleY = y + Math.round(titleSize * 0.9);
        if (isRules) T(sec.title, mid, titleY, titleSize, GOLD, FONT, 700, 'center'); else T(sec.title, bd.x, titleY, titleSize, GOLD, FONT, 700, 'left');
        y = titleY + Math.round(titleSize * 0.5) + Math.round(bodySize * 0.65) + 10;
        if (sec.art === 'house') {
          items.push({ k: 'house', y, top: y, h: 200 });
          y += 200 + Math.round(30 * gz);
        } else if (sec.art === 'store') {
          items.push({ k: 'store', y, top: y, h: 120 });
          y += 86 + 62 + Math.round(30 * gz);
        } else if (sec.art === 'capture') {
          items.push({ k: 'capture', y, top: y, h: 190 });
          y += 190 + Math.round(30 * gz);
        }
        for (const para of sec.lines) { const ls = lines(para, cw, bodySize); items.push({ k: 'l', ls, x: bd.x, y, size: bodySize, lh }); y += ls.length * lh + 18; }
        y += Math.round(22 * scale);
      }
      readerCache.key = key; readerCache.items = items; readerCache.endY = y;
    }
    ctx.save(); ctx.beginPath(); ctx.rect(bd.x - 10, bd.y, cw + 20, bd.h); ctx.clip(); ctx.translate(0, -scroll);
    const top = bd.y + scroll - 300, bot = bd.y + scroll + bd.h + 300;   // slack for illustration heights and glyph ascent
    for (const it of readerCache.items) {
      if (it.k === 't') { if (it.y > top && it.y - it.size < bot) text(it.str, it.x, it.y, it.size, it.color, it.font, it.weight, it.align); }
      else if (it.k === 'l') {
        if (it.y + it.ls.length * it.lh < top || it.y - it.size > bot) continue;
        it.ls.forEach((ln, i) => { const ly = it.y + i * it.lh; if (ly > top && ly - it.size < bot) text(ln, it.x, ly, it.size, '#fff3d6', UI, 600, 'left'); });
      } else if (it.top + it.h >= top && it.top <= bot) {
        const y = it.y, cap = (str, x, yy) => text(str, x, yy, 20, 'rgba(251,232,191,0.75)', UI, 600);
        if (it.k === 'house') {
          const cy = y + 84;
          drawHousePit(ctx, mid, cy, Math.max(4, PIT_R));
          for (let k = 0; k < 4; k++) { const s = slot(0, k); drawSeed(ctx, state.seeds, s.v, mid + s.x, cy + s.y, s.rot, 1.42); }
          cap('A house with shells in it', mid, y + 168);
        } else if (it.k === 'store') {
          const S = { x: mid - 105, y: y, w: 210, h: 86 };
          drawStorePit(ctx, S.x, S.y, S.w, S.h);
          for (let k = 0; k < 10; k++) { const col = k % 7, row = Math.floor(k / 7); drawSeed(ctx, state.seeds, (k * 3) % 4, S.x + 26 + col * 14 + (row % 2) * 6, S.y + 46 + row * 12, ((k * 97) % 360) * Math.PI / 180, 0.8); }
          cap('Your storehouse, banking shells', mid, y + S.h + 30);
        } else {
          const cy = y + 84, d = Math.min(160, Math.max(70, cw / 2 - 80)), xa = mid - d, xb = mid + d;
          drawHousePit(ctx, xa, cy, Math.max(4, PIT_R));
          drawHousePit(ctx, xb, cy, Math.max(4, PIT_R));
          for (let k = 0; k < 4; k++) { const s = slot(1, k); drawSeed(ctx, state.seeds, s.v, xb + s.x, cy + s.y, s.rot, 1.42); }
          text('Yours: empty', xa, cy + 68, 18, 'rgba(251,232,191,0.75)', UI, 600);
          text('Opposite: captured', xb, cy + 68, 18, 'rgba(251,232,191,0.75)', UI, 600);
        }
      }
    }
    const endY = readerCache.endY;
    ctx.restore();
    state.readerMax = Math.max(0, Math.ceil(endY + 24 - bd.y - bd.h));
    if (state.readerMax > 0) {                                                   // scroll bar
      const b = RD.bar, th = Math.max(36, b.h * bd.h / (bd.h + state.readerMax)), ty = b.y + (b.h - th) * (scroll / state.readerMax);
      ctx.fillStyle = 'rgba(243,207,122,0.18)'; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(243,207,122,0.8)'; ctx.beginPath(); ctx.roundRect(b.x, ty, b.w, th, 4); ctx.fill();
    }
    text(state.readerMax > 0 ? `${Math.round(100 * scroll / state.readerMax)}% read` : 'All on one screen', RD.page.x, RD.page.y, 20, 'rgba(251,232,191,0.7)', UI, 600);
    const atMin = state.textScaleIdx === 0, atMax = state.textScaleIdx === TEXT_SCALES.length - 1;
    button(RD.dec, 'A−', { dim: atMin, size: 30 }); button(RD.inc, 'A+', { dim: atMax, size: 30 });
    button(RD.back, 'Back', { size: 30 });
    button(RD.next, scroll >= state.readerMax - 1 ? 'Done' : 'Next', { primary: true, size: 30 });
  } else if (scene === 'round' || (scene === 'auto' && state.auto && state.auto.sub === 'roundover')) {
    ctx.fillStyle = L.wide || L.res.k < 1 ? 'rgba(12,6,24,0.96)' : 'rgba(12,6,24,0.72)'; ctx.fillRect(0, 0, sw, sh);
    const Rs = L.res, ry = Rs.y, cx = Rs.cx, tw = Math.min(590, (L.wide ? U.w * 0.5 : U.w) - 70);
    const rr = g.roundResult, mine = rr.a, theirs = rr.b, won = mine > theirs ? 0 : mine < theirs ? 1 : -1;
    const who = (pl) => (state.two ? (pl === 0 ? 'Player one' : 'Player two') : pl === 0 ? 'You' : 'The computer');
    const rt = ['', 'Round one', 'Round two', 'Round three', 'Round four', 'Round five', 'Round six', 'Round seven', 'Round eight', 'Round nine'][rr.round] + ' over';
    text(rt, cx, ry(470), fitTitle(rt, 84, tw + 60, FONT, 700, 40), CREAM, FONT);
    text(won < 0 ? 'A tied round' : `${who(won)} won the round`, cx, ry(530), 34, GOLD, FONT);
    text(`${mine} : ${theirs}`, cx, ry(700), 130, GOLD, FONT);
    text(state.two ? 'Player one : Player two' : 'You : Computer', cx, ry(770), 24, 'rgba(251,232,191,0.9)', UI, 600);
    const c = clone(g), before = g.burnt.slice(); nextRound(c);
    const lost = [0, 1].map((pl) => SEQ[pl].filter((h) => c.burnt[h] && !before[h]).length);
    const open = [0, 1].map((pl) => SEQ[pl].filter((h) => !c.burnt[h]).length);
    wrap(`Refilled houses: ${open[0]} for ${who(0).toLowerCase()}, ${open[1]} for ${who(1).toLowerCase()}.`, cx, ry(830), 28, tw, '#fff3d6');
    wrap(lost[0] + lost[1] === 0 ? 'Nobody loses a house this time.' : `${lost[0] ? `${who(0)}: ${lost[0]} house${lost[0] === 1 ? '' : 's'} burnt shut. ` : ''}${lost[1] ? `${who(1)}: ${lost[1]} house${lost[1] === 1 ? '' : 's'} burnt shut.` : ''}`, cx, ry(900) + (L.wide ? 14 : 0), 26, tw, '#ffd7a0');
    button(L.BTN.cont, 'Next round', { primary: true, size: 36 });
  } else if (scene === 'over' || (scene === 'auto' && state.auto && state.auto.sub === 'over')) {
    ctx.fillStyle = L.wide || L.res.k < 1 ? 'rgba(12,6,24,0.96)' : 'rgba(12,6,24,0.74)'; ctx.fillRect(0, 0, sw, sh);
    const Rs = L.res, ry = Rs.y, cx = Rs.cx;
    const won = g.winner === 'draw' ? 'A draw' : state.two ? (g.winner === 0 ? 'Player one wins' : 'Player two wins') : g.winner === 0 ? 'You win!' : 'The computer wins';
    text(won, cx, ry(470), fitTitle(won, 96, (L.wide ? U.w * 0.5 : U.w) - 40, FONT, 700, 44), CREAM, FONT);
    const last = g.rounds[g.rounds.length - 1] || { a: 0, b: 0 };
    text(`${last.a} : ${last.b}`, cx, ry(690), 120, GOLD, FONT);
    text(g.mode === 'single' ? 'Final shell count' : `Last round · ${g.rounds.length} round${g.rounds.length === 1 ? '' : 's'} played`, cx, ry(735), 24, 'rgba(251,232,191,0.9)', UI, 600);
    text(state.two ? 'Player one : Player two' : 'You : Computer', cx, ry(775), 24, 'rgba(251,232,191,0.75)', UI, 500);
    if (!state.two && g.winner === 0) {
      text(`★ ${LEVELS[state.level].name} beaten`, cx, ry(850), 32, GOLD, UI, 700);
      if (!calm) for (let k = 0; k < 16; k++) { const ph = (t * 0.35 + k * 0.137) % 1, x = cx + Math.sin(k * 2.4) * (170 + 90 * ph), y = ry(640) - ph * 420 * Rs.k; drawSeed(ctx, state.seeds, k % 4, x, y, ph * 6, 1 - ph * 0.5); }
    }
    button(L.BTN.again, 'Play again', { primary: true, size: 36 }); button(L.BTN.back, 'Menu', { size: 32 });
    drawMoreLine(ctx, Rs.more.x, Rs.more.y, 20);                                 // quiet: the Arcforge collection
  }
  void W;
}
