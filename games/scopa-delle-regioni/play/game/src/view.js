// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The table and card faces are cached (art.js).
import { W, H, HAND, BTN, SET, CLOTH, DECK, PILE, MSG, HDR, INSTR, SEAT, OPP, LV, READER, ROUND, POSTER, deckPos, pilePos, handPos, seatPos, tableGrid, slotPos, titleRows, inRect, TEXT_SCALES, AP_THINK_STEPS } from './layout.js';
import { drawCredit, drawMoreLine, drawLockupImage } from './brand.js';
import { drawTable, drawCard, drawSuitIcon, CW, CH, TAU } from './art.js';
import { captures, rankOf, teamOf, RANK_NAMES } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT } from './about.js';
import { RULES } from './rulesContent.js';
import { CONTROLS } from './controlsContent.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const CREAM = '#fbe8bf', GOLD = '#f3cf7a', NUM = UI;

export const gridOf = (state) => tableGrid(Math.max(state.slots.filter((x) => x !== null).length + 1, state.g.table.length));
export function tableCardAt(state, x, y) {
  const gr = gridOf(state);
  for (let i = state.slots.length - 1; i >= 0; i--) {
    const c = state.slots[i]; if (c === null) continue;
    const p = slotPos(i, gr), lift = state.sel && state.sel.take.includes(c) ? 14 : 0;
    if (Math.abs(x - p.x) <= gr.w / 2 + 6 && Math.abs(y - (p.y - lift)) <= gr.h / 2 + 6) return c;
  }
  return null;
}
const ease = (p) => p * p * (3 - 2 * p);

export const readerMetrics = { max: 0, view: 0 };
// Wrapped-line cache: a paragraph is measured once per (font, size, width, text) and reused every frame (the reader used to re-wrap its whole
// document each frame). Dropped when a web font finishes loading. readerStats.wraps counts cache misses (tests read it).
const wrapMemo = new Map(); let wrapFontsKey = '';
export const readerStats = { wraps: 0 };   // set by the reader page each frame: how far its body can scroll

export function render(ctx, state) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== wrapFontsKey || wrapMemo.size > 3000) { wrapMemo.clear(); wrapFontsKey = k; } }
  const w = LV.w, h = LV.h, wide = LV.wide;
  const scene = state.scene, big = state.big, g = state.g, french = state.french;
  const boardScene = scene === 'play' || scene === 'lesson' || scene === 'puzzle' || scene === 'autoplay' || scene === 'autoplay-over';
  const pulse = state.calm ? 0.7 : 0.5 + 0.5 * Math.sin(state.t * 5);
  const rrect = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(30,8,0,0.6)'; ctx.fillText(str, x + 1.5, y + 2.5); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600, font = UI) => {
    const mk = `${weight}|${size}|${maxW}|${font}|${str}`, hit = wrapMemo.get(mk); if (hit) return hit;
    readerStats.wraps++;
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); wrapMemo.set(mk, out); return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.3, align = 'center') => { const L = lines(str, maxW, size); L.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return L.length; };
  const fitBox = (str, x, y, w, h, size0, color = '#fff3d6') => {
    let ms = size0, L = lines(str, w - 30, ms); while (L.length * ms * 1.24 > h - 14 && ms > 15) { ms -= 1; L = lines(str, w - 30, ms); }
    const top = y + h / 2 - (L.length * ms * 1.24) / 2 + ms * 0.92; L.forEach((ln, i) => text(ln, x + w / 2, top + i * ms * 1.24, ms, color, UI, 600, 'center', false));
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(20,6,0,0.5)'; rrect(r.x + 2, r.y + 7, r.w, r.h, 22); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffe08e'); gr.addColorStop(0.55, '#e3a63a'); gr.addColorStop(1, '#b3701a'); } else { gr.addColorStop(0, '#7a3a22'); gr.addColorStop(0.5, '#56241a'); gr.addColorStop(1, '#361410'); }
    ctx.fillStyle = gr; rrect(r.x, r.y, r.w, r.h, 22); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,244,196,0.9)' : 'rgba(243,207,122,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    const sz = o.size ?? 30;
    ctx.textAlign = 'center'; ctx.font = `700 ${sz}px ${UI}`;
    ctx.fillStyle = o.primary ? 'rgba(255,240,200,0.5)' : 'rgba(0,0,0,0.5)'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36 + 1.5);
    ctx.fillStyle = o.primary ? '#2a1606' : CREAM; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36);
    ctx.restore();
  };
  const panel = (x, y, w, h, alpha = 0.86) => { ctx.save(); ctx.fillStyle = `rgba(30,10,6,${alpha})`; rrect(x, y, w, h, 22); ctx.fill(); ctx.strokeStyle = 'rgba(243,207,122,0.8)'; ctx.lineWidth = 2.5; ctx.stroke(); ctx.strokeStyle = 'rgba(243,207,122,0.25)'; ctx.lineWidth = 1.2; rrect(x + 6, y + 6, w - 12, h - 12, 17); ctx.stroke(); ctx.restore(); };
  const ring = (x, y, w, h, rgb, a, lw = 5) => { ctx.save(); ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = lw; ctx.shadowColor = `rgba(${rgb},${a})`; ctx.shadowBlur = 16; rrect(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8, 16); ctx.stroke(); ctx.restore(); };
  const card = (id, x, y, w, rot, o = {}) => drawCard(ctx, id, x, y, w, rot, { french, ...o });
  const backStack = (x, y, w, n) => { for (let k = Math.min(n, 3) - 1; k >= 0; k--) card(-1, x + k * 3, y - k * 3, w, 0, { shadow: k === 0 }); };

  // ---- table --------------------------------------------------------------------------------------------------------
  const decor = !boardScene && wide ? { x: 20, y: LV.sky + 14, w: w - 40, h: h - LV.sky - 28 } : CLOTH;
  drawTable(ctx, state.t, state.calm, { w, h, cloth: decor, sky: LV.sky });

  if (boardScene) {
    const gr = gridOf(state), S = state.sel;
    // eligible table cards for the selected card
    let eligible = new Set(), caps = [];
    if (S) { caps = captures(g.table, S.card); for (const c of caps) if (S.take.every((x) => c.includes(x))) for (const t of c) eligible.add(t); }
    const humanTurn = scene === 'play' ? g.turn === 0 && g.phase === 'play' : true;
    const busy = state.fly.length > 0;

    // ---- header plaque (tall: a strip across the top; wide: a score card in the left panel)
    panel(HDR.x, HDR.y, HDR.w, HDR.h, 0.8);
    const hx = (x) => HDR.x + (x - 30) * HDR.w / 660, hyy = (y) => HDR.y + (y - 100);
    const fitText = (str, x, y, maxW, size, color, font, weight, align) => { let sz = size; ctx.font = `${weight} ${sz}px ${font}`; while (sz > 12 && ctx.measureText(str).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${font}`; } text(str, x, y, sz, color, font, weight, align); };
    if (scene === 'play' || scene === 'over' || scene === 'autoplay' || scene === 'autoplay-over') {
      const ap = scene === 'autoplay' ? state.ap : null, apOver = scene === 'autoplay-over';
      const A = apOver || scene === 'autoplay' ? 'Player A' : scene === 'play' ? (state.n === 2 ? 'You' : 'Us') : 'You';
      const B = apOver || scene === 'autoplay' ? 'Player B' : state.n === 2 ? 'Computer' : 'Them';
      const apTime = `pause ${AP_THINK_STEPS[state.apThinkIdx]}s`;
      const sub = ap ? (state.apPaused ? 'Paused' : ap.phase === 'think' ? `Thinking… · ${apTime}` : ap.phase === 'reveal' ? 'Here is the move' : `Watching… · ${apTime}`) : apOver ? 'Auto Play · Watch & Learn' : `first to ${g.target}`;
      if (!wide) {
        text(A, hx(62), hyy(145), 24, CREAM, UI, 700, 'left'); text(String(g.score[0]), hx(222), hyy(152), 44, GOLD, NUM, 800, 'center');
        text(B, hx(658), hyy(145), 24, CREAM, UI, 700, 'right'); text(String(g.score[1]), hx(498), hyy(152), 44, GOLD, NUM, 800, 'center');
        text(`Round ${g.round}`, HDR.x + HDR.w / 2, hyy(133), 24, CREAM, UI, 700);
        fitText(sub, HDR.x + HDR.w / 2, hyy(158), HDR.w * 0.3, 19, 'rgba(251,232,191,0.85)', UI, 600, 'center');
      } else {
        const cx = HDR.x + HDR.w / 2;
        text(`Round ${g.round}`, cx, HDR.y + 36, 26, CREAM, UI, 700);
        fitText(sub, cx, HDR.y + 62, HDR.w - 16, 18, 'rgba(251,232,191,0.85)', UI, 600, 'center');
        fitText(A, HDR.x + 16, HDR.y + 112, HDR.w * 0.5 - 20, 22, CREAM, UI, 700, 'left'); text(String(g.score[0]), HDR.x + HDR.w - 16, HDR.y + 118, 46, GOLD, NUM, 800, 'right');
        fitText(B, HDR.x + 16, HDR.y + 160, HDR.w * 0.5 - 20, 22, CREAM, UI, 700, 'left'); text(String(g.score[1]), HDR.x + HDR.w - 16, HDR.y + 166, 46, GOLD, NUM, 800, 'right');
      }
    } else if (scene === 'lesson') {
      const t1 = `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, t2 = LESSONS[state.lesson.i].title;
      if (!wide) { text(t1, HDR.x + HDR.w / 2, hyy(128), 22, 'rgba(251,232,191,0.85)', UI, 600); fitText(t2, HDR.x + HDR.w / 2, hyy(158), HDR.w - 24, 38, CREAM, FONT, 700, 'center'); }
      else { text(t1, HDR.x + HDR.w / 2, HDR.y + 34, 22, 'rgba(251,232,191,0.85)', UI, 600); wrap(t2, HDR.x + HDR.w / 2, HDR.y + 82, 30, HDR.w - 20, CREAM, 36); }
    } else {
      const t1 = 'Daily deal' + (state.pz.p.hard ? ' (weekend)' : ''), t2 = `Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`;
      if (!wide) { text(t1, HDR.x + HDR.w / 2, hyy(128), 22, 'rgba(251,232,191,0.85)', UI, 600); text(t2, HDR.x + HDR.w / 2, hyy(158), 28, GOLD, UI, 700); }
      else { text(t1, HDR.x + HDR.w / 2, HDR.y + 40, 22, 'rgba(251,232,191,0.85)', UI, 600); wrap(t2, HDR.x + HDR.w / 2, HDR.y + 96, 28, HDR.w - 20, GOLD, 34); }
    }

    // ---- the other seats
    if (scene === 'play' || scene === 'autoplay') {
      for (let s = 1; s < g.n; s++) {
        const p = seatPos(g.n, s), n = state.seatShown[s], active = g.turn === s && g.phase === 'play';
        if (active) { const gl = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 90); gl.addColorStop(0, `rgba(255,214,120,${0.4 + 0.25 * pulse})`); gl.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = gl; ctx.fillRect(p.x - 90, p.y - 90, 180, 180); }
        for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * 0.22; card(-1, p.x + (k - (n - 1) / 2) * SEAT.w * 0.63, p.y + Math.abs(a) * SEAT.w * 0.44 - 4, SEAT.w, a); }
        const label = scene === 'autoplay' ? 'Player B' : g.n === 2 ? `Computer · ${LEVELS[state.level].name}` : s === 2 ? 'Partner' : s === 1 ? 'Left' : 'Right';
        fitText(label, p.x, p.y + SEAT.dl + (g.n === 2 && !wide ? -2 : 0), g.n === 2 ? 340 : (wide ? SEAT.span - 10 : 150), g.n === 2 ? 24 : 21, active ? GOLD : CREAM, UI, 700, 'center');
        if (active && state.thinking && !busy) { const dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3)); text('thinking' + dots, p.x, p.y + SEAT.dt, 18, 'rgba(251,232,191,0.85)', UI, 500); }
      }
      // opponent team's pile
      const on = state.pileShown[1]; backStack(OPP.x, OPP.y, OPP.w, on > 0 ? 3 : 0); text(String(on), OPP.x, OPP.count, 24, GOLD, NUM, 800); text(g.n === 2 ? 'theirs' : 'their pile', OPP.x, OPP.label, 15, 'rgba(251,232,191,0.8)', UI, 700);
    }
    if (scene === 'lesson' || scene === 'puzzle') {
      panel(INSTR.x, INSTR.y, INSTR.w, INSTR.h, 0.86);
      const tx = scene === 'lesson' ? LESSONS[state.lesson.i].text : `Which play is worth the most? Value: each card 1, each coin +1, each 7 +1, the 7 of coins +4, a scopa +3.`;
      fitBox(tx, INSTR.x, INSTR.y, INSTR.w, INSTR.h, big ? 28 : 25, '#fff3d6');
    }

    // ---- table cards
    const sel = (c) => S && S.take.includes(c);
    for (let i = 0; i < state.slots.length; i++) {
      const c = state.slots[i]; if (c === null || state.hide.includes(c)) continue;
      const p = slotPos(i, gr), lift = sel(c) ? 14 : 0;
      let dx = 0; if (state.ref && state.ref.card === c && !state.calm) dx = Math.sin(state.ref.t * 60) * 6 * (1 - state.ref.t / 0.6);
      const hinted = state.hint && state.hint.take.includes(c), glow = state.glow.find((q) => q.card === c);
      card(c, p.x + dx, p.y - lift, gr.w, 0, { lift: !!lift });
      if (S && !eligible.has(c) && !sel(c)) { ctx.fillStyle = 'rgba(20,8,4,0.42)'; rrect(p.x - gr.w / 2 + dx, p.y - gr.h / 2, gr.w, gr.h, 16 * (gr.w / CW)); ctx.fill(); }
      if (sel(c)) ring(p.x + dx, p.y - lift, gr.w, gr.h, '110,255,150', 0.95);
      else if (S && eligible.has(c)) ring(p.x + dx, p.y, gr.w, gr.h, '255,214,110', 0.55 + 0.45 * pulse);
      if (hinted) ring(p.x, p.y, gr.w, gr.h, '110,255,170', 0.6 + 0.4 * pulse, 6);
      if (glow) ring(p.x, p.y, gr.w, gr.h, '255,236,150', 1 - glow.t / glow.d, 7);
      if (state.kb && state.curZone === 'table' && humanTurn) { const idxs = state.slots.map((q, k) => (q === null ? null : k)).filter((k) => k !== null); if (idxs.length && idxs[state.cur % idxs.length] === i) ring(p.x, p.y - lift, gr.w, gr.h, '125,255,154', 1, 4); }
    }
    for (const h of state.held) card(h.card, h.x + 16, h.y + 14, h.w, 0.08);
    // no capture possible: show where the card will land
    if (S && !caps.length && humanTurn && !busy) { const free = state.slots.indexOf(null), p = slotPos(free < 0 ? 0 : free, gr); ctx.save(); ctx.setLineDash([12, 9]); ctx.strokeStyle = `rgba(255,236,170,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 4; rrect(p.x - gr.w / 2, p.y - gr.h / 2, gr.w, gr.h, 14); ctx.stroke(); ctx.restore(); text('lay it here', p.x, p.y + 6, 20, 'rgba(255,240,200,0.9)', UI, 600); }

    // ---- deck and my captured pile chips
    if (scene === 'play' || scene === 'autoplay') {
    panel(DECK.x, DECK.y, DECK.w, DECK.h, 0.7); backStack(deckPos.x - 4, deckPos.y - 6, 40, state.deckShown > 0 ? 3 : 0); if (state.deckShown === 0) text('empty', deckPos.x, deckPos.y + 6, 18, 'rgba(251,232,191,0.5)', UI, 600);
    text(String(state.deckShown), deckPos.x + 22, DECK.y + DECK.h - 10, 22, GOLD, NUM, 800); text('deck', DECK.x + DECK.w / 2, DECK.y + 20, 15, 'rgba(251,232,191,0.75)', UI, 700);
    panel(PILE.x, PILE.y, PILE.w, PILE.h, 0.7); backStack(pilePos.x - 4, pilePos.y - 6, 40, state.pileShown[0] > 0 ? 3 : 0); text(String(state.pileShown[0]), pilePos.x + 22, PILE.y + PILE.h - 10, 22, GOLD, NUM, 800); text('yours', PILE.x + PILE.w / 2, PILE.y + 20, 15, 'rgba(251,232,191,0.75)', UI, 700);
    if (g.scope[0] > 0) text(`Scopa x${g.scope[0]}`, PILE.x + PILE.w / 2, PILE.y - 8, 18, GOLD, UI, 700);
    }

    // ---- message panel
    panel(MSG.x, MSG.y, MSG.w, MSG.h, 0.9);
    let line = null;
    if (state.msg) line = state.msg.text;
    else if (scene === 'play') line = g.phase !== 'play' ? '' : g.turn === 0 ? (S ? (S.take.length ? `Taking ${S.take.reduce((a, t) => a + rankOf(t), 0)} of ${rankOf(S.card)}. TAP more table cards.` : 'Now TAP the table cards to take.') : 'Your turn. TAP a card in your hand.') : state.n === 2 ? 'The computer is playing.' : 'Waiting for the other players.';
    else if (scene === 'lesson') line = state.lesson.done ? 'Well done. TAP Next lesson.' : 'Follow the instruction above.';
    else if (scene === 'puzzle') line = state.pz.status === 'solved' ? 'Solved.' : 'TAP a card, then the table cards to take.';
    if (line) { const al = state.msg ? Math.min(1, state.msg.t / 0.12) * Math.min(1, (state.msg.hold - state.msg.t) / 0.4) : 1; ctx.save(); ctx.globalAlpha = Math.max(0.05, al); fitBox(line, MSG.x, MSG.y, MSG.w, MSG.h, big ? 27 : 24); ctx.restore(); }

    // ---- my hand
    for (let i = 0; i < 3; i++) {
      const c = state.hslots[i]; if (c === null || state.hide.includes(c)) continue;
      const p = handPos(i), isSel = S && S.card === c, lift = isSel ? HAND.lift : 0;
      let dx = 0; if (state.ref && state.ref.card === c && !state.calm) dx = Math.sin(state.ref.t * 60) * 6 * (1 - state.ref.t / 0.6);
      card(c, p.x + dx, p.y - lift, HAND.w, 0, { lift: !!lift });
      if (!humanTurn || (scene === 'play' && busy)) { ctx.fillStyle = 'rgba(20,8,4,0.3)'; rrect(p.x - HAND.w / 2, p.y - HAND.h / 2 - lift, HAND.w, HAND.h, 20); ctx.fill(); }
      if (isSel) ring(p.x, p.y - lift, HAND.w, HAND.h, '255,222,120', 0.9);
      if (state.hint && state.hint.card === c) ring(p.x, p.y - lift, HAND.w, HAND.h, '110,255,170', 0.6 + 0.4 * pulse, 6);
      if (state.kb && state.curZone === 'hand') { /* keys 1-3 select; nothing to draw */ }
    }
    if (state.kb && (scene === 'play' || scene === 'lesson' || scene === 'puzzle') && !S) text('Keys 1 2 3: pick a card', MSG.x + MSG.w / 2, MSG.y - 8, 20, 'rgba(255,240,200,0.75)', UI, 600);

    // ---- buttons
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 28 }); button(BTN.undo, 'Undo', { size: 28, dim: !state.undo }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 28, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 28 }); if (state.lesson.done && !busy && !state.panel) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 28 }); if (state.pz.status === 'solved' && !busy) button(BTN.share, 'Share result', { primary: true, size: 30 }); }
    else if (scene === 'autoplay') {
      // The current think-time value is shown in the header caption above (not here): the hand
      // cards' own art reaches down almost to this button row, leaving no clear room for a second
      // text line between them without overlapping the cards.
      button(BTN.apExit, 'Exit', { size: 26 });
      button(BTN.apPause, state.apPaused ? 'Resume' : 'Pause', { size: 26, primary: !!state.apPaused });
      button(BTN.apDec, 'Think −', { size: 24, dim: state.apThinkIdx === 0 });
      button(BTN.apInc, 'Think +', { size: 24, dim: state.apThinkIdx === AP_THINK_STEPS.length - 1 });
    }

    // ---- cards in flight
    for (const f of state.fly) {
      if (f.t < 0) continue;
      const p = Math.min(1, f.t / f.d), e = ease(p), x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * p) * f.arc * (state.calm ? 0.3 : 1);
      const w = f.w0 + (f.w1 - f.w0) * e, rot = f.r0 + (f.r1 - f.r0) * e;
      let id = f.card; if (id >= 0 && f.flip && p < 0.45) id = -1;
      card(id, x, y, w * (1 + 0.08 * Math.sin(Math.PI * p)), rot + (f.card >= 0 ? 0.05 * Math.sin(Math.PI * p) : 0), { lift: true });
    }
    // ---- scopa flourish
    for (const f of state.fx) {
      if (f.kind !== 'scopa') continue;
      const p = f.t / f.d, sc = state.calm ? 1 : 0.6 + 0.5 * Math.min(1, p * 4) + 0.06 * Math.sin(p * 20), a = Math.min(1, (1 - p) * 3);
      const fcx = CLOTH.x + CLOTH.w / 2, fcy = CLOTH.y + CLOTH.h / 2, fk = Math.min(1, (CLOTH.w - 20) / 520, (CLOTH.h - 10) / 200);
      ctx.save(); ctx.globalAlpha = a; ctx.translate(fcx, fcy); ctx.scale(sc * fk, sc * fk);
      ctx.fillStyle = 'rgba(30,8,0,0.6)'; rrect(-260, -100, 520, 200, 30); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();
      text('SCOPA!', 0, 22, 108, '#ffe6a0', FONT, 700); text(f.team === 0 ? 'the table is swept: +1 point' : 'swept by the other side: +1 point', 0, 70, 24, CREAM, UI, 600);
      ctx.restore();
      if (!state.calm) for (let k = 0; k < 22; k++) { const ang = k * 2.4 + 0.3, r = 60 + p * (200 + (k % 5) * 40), x = fcx + Math.cos(ang) * r * fk, y = fcy + Math.sin(ang) * r * 0.7 * fk, s = (1 - p) * 9; ctx.fillStyle = `rgba(255,${200 + (k % 3) * 20},110,${a})`; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.4, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.4, y); ctx.fill(); }
    }
    if (scene === 'play' && state.dev) text('DEV', LV.U.x1 - 12, LV.U.y0 + 20, 18, '#7dff9a', UI, 700, 'right');
  }

  // ---- round scoring panel -------------------------------------------------------------------------------------------
  if (boardScene && state.panel === 'round' && g.summary) {
    ctx.fillStyle = 'rgba(14,4,0,0.72)'; ctx.fillRect(0, 0, w, h);
    const P = ROUND.P, k = ROUND.k, K = (v) => v * k, S = (v, mn) => Math.max(mn, Math.round(v * k));
    panel(P.x, P.y, P.w, P.h, 0.94);
    const s = g.summary, per = s.per, T = per.length, names = scene === 'lesson' ? ['You', 'Opponent'] : scene === 'autoplay' ? ['Player A', 'Player B'] : state.n === 4 ? ['Your team', 'Opponents'] : ['You', 'Computer'];
    const c0 = P.x + P.w * 0.61, c1 = P.x + P.w * 0.86, lx = P.x + P.w * 0.066, colX = (t) => (t === 0 ? c0 : c1);
    const ttl = scene === 'lesson' ? 'How a round is scored' : `Round ${g.round}`;
    let y;
    if (!wide) { text(ttl, P.x + P.w / 2, P.y + K(85), S(62, 40), CREAM, FONT); text(names[0], c0, P.y + K(150), S(26, 18), GOLD, UI, 700); text(names[1], c1, P.y + K(150), S(26, 18), GOLD, UI, 700); y = P.y + K(200); }
    else { text(ttl, lx, P.y + K(62), S(50, 34), CREAM, FONT, 700, 'left'); text(names[0], c0, P.y + K(62), S(26, 18), GOLD, UI, 700); text(names[1], c1, P.y + K(62), S(26, 18), GOLD, UI, 700); y = P.y + K(108); }
    const pitch = wide ? K(70) : K(92);
    const rows = [
      ['Cards (carte)', 'most cards', per.map((x) => String(x.cards)), s.winners.carte],
      ['Coins (denari)', 'most coins', per.map((x) => String(x.coins)), s.winners.denari],
      ['Sette bello', '7 of coins', per.map((x) => (x.sette ? 'yes' : '-')), s.winners.sette],
      ['Primiera', 'best card per suit', per.map((x) => (x.prim ? String(x.prim) : '-')), s.winners.primiera],
      ['Scopa (broom)', 'tables swept', per.map((x) => String(x.scope)), -2],
    ];
    rows.forEach(([a, b, vals, win], kk) => {
      if (kk % 2 === 0) { ctx.fillStyle = 'rgba(255,220,150,0.06)'; rrect(P.x + 20, y - pitch * 0.48, P.w - 40, pitch * 0.92, 10); ctx.fill(); }
      text(a, lx, y - K(4), S(28, 19), CREAM, UI, 700, 'left'); text(b, lx, y + K(24), S(19, 13), 'rgba(251,232,191,0.7)', UI, 500, 'left');
      for (let t = 0; t < T; t++) {
        const x = colX(t), won = win === t || (win === -2 && per[t].scope > 0);
        if (won) { ctx.fillStyle = 'rgba(243,207,122,0.25)'; rrect(x - K(56), y - K(38), K(112), K(70), 14); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke(); }
        text(vals[t], x, y + K(12), S(36, 24), won ? '#ffe9a8' : CREAM, NUM, 800);
      }
      y += pitch;
    });
    ctx.strokeStyle = 'rgba(243,207,122,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + P.w * 0.1, y - K(24)); ctx.lineTo(P.x + P.w * 0.9, y - K(24)); ctx.stroke();
    text('Points this round', lx, y + K(34), S(28, 19), CREAM, UI, 700, 'left'); per.forEach((x, t) => text(String(x.pts), colX(t), y + K(40), S(50, 32), '#ffe9a8', NUM, 800));
    y += wide ? K(78) : K(96);
    if (scene !== 'lesson') {
      text('Match score', lx, y + K(12), S(26, 18), CREAM, UI, 700, 'left'); g.score.forEach((sc, t) => text(String(sc), colX(t), y + K(16), S(44, 28), GOLD, NUM, 800));
      if (!wide) text(`first to ${g.target}`, P.x + P.w / 2, y + K(62), S(20, 14), 'rgba(251,232,191,0.75)', UI, 600);
      y += wide ? K(52) : K(90);
    }
    if (!wide) {
      const notes = []; if (s.winners.carte < 0) notes.push('Equal cards: no point for cards.'); if (s.winners.denari < 0) notes.push('Equal coins: no point for coins.'); if (s.winners.primiera < 0) notes.push('Primiera needs a card in every suit, and the higher total wins.');
      if (notes.length) wrap(notes[0], P.x + P.w / 2, y + K(30), S(21, 14), P.w - 100, 'rgba(251,232,191,0.8)');
    }
    // Auto Play's round panel auto-advances on its own timer (updateAutoPlay), so it shows a plain
    // status label here rather than a button implying a tap.
    if (scene === 'autoplay') text(g.phase === 'over' ? 'Finishing…' : 'Next round starting…', w / 2, BTN.cont.y + BTN.cont.h / 2 + 12, 30, 'rgba(251,232,191,0.85)', UI, 700);
    else button(BTN.cont, scene === 'lesson' ? 'Continue' : g.phase === 'over' ? 'See the result' : 'Next round', { primary: true, size: 34 });
  }

  // ---- other screens -------------------------------------------------------------------------------------------------
  // The title art (hanging fan of cards + the name), drawn in its own 720-wide design space (y 200..780) and scaled/placed by the caller.
  const titleArt = () => {
    const ids = [29, 6, 19, 39, 8]; // Re/7/etc drawn from the deck (suit*10+rank-1)
    ids.forEach((id, i) => { const a = (i - 2) * 0.24 + (state.calm ? 0 : Math.sin(state.t * 1.1 + i) * 0.025), x = 360 + (i - 2) * 112, y = 590 + Math.abs(i - 2) * 24 + (state.calm ? 0 : Math.sin(state.t * 1.4 + i * 1.3) * 5); card(id, x, y, 158, a, { lift: true }); });
    text('Scopa', 360, 330, 150, CREAM, FONT); ctx.fillStyle = 'rgba(24,8,4,0.7)'; rrect(120, 350, 480, 46, 23); ctx.fill(); text('The Italian card game of the broom', 360, 383, 26, 'rgba(251,232,191,0.97)', FONT, 700);
  };
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solved = state.daily.solvedDay === state.daily.day, M = R.meta;
    // art: tall = above the buttons, aligned to the bottom of its box; wide = left of the button column
    let artCx, artTop, s, statsY, lockY;
    if (!wide) {
      const bottom = M.top - 20; s = Math.min(1, (bottom - Math.max(LV.U.y0, 20)) / 580); artCx = w / 2; artTop = bottom - 580 * s;
      statsY = M.bottom + 40; lockY = M.bottom + 78;
    } else {
      const areaW = M.x - 16 - LV.U.x0 - 16; artCx = LV.U.x0 + 16 + areaW / 2; s = Math.min(1, areaW / 700, (LV.U.h - 24 - 210) / 580);
      const total = 580 * s + 84 + 80 + 40, top0 = LV.U.y0 + (LV.U.h - total) / 2; artTop = top0; statsY = top0 + 580 * s + 84; lockY = top0 + 580 * s + 84 + 80 - 8;
    }
    ctx.save(); ctx.translate(artCx - 360 * s, artTop - 200 * s); ctx.scale(s, s); titleArt(); ctx.restore();
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 32 });
    const bs = (v) => Math.round(v * Math.min(1, R.learn.h / 84 + 0.12));
    button(R.learn, 'Learn to play (imparare)', { primary: !state.learned && !R.resume, size: bs(30) });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: bs(32) });
    button(R.four, 'Four players, in partnership', { size: bs(30) });
    button(R.daily, solved ? `Daily deal: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily deal · streak ${state.daily.streak}` : 'Daily deal', { size: bs(30) });
    button(R.autoplay, 'Auto Play · Watch & Learn', { size: bs(28) });
    button(R.about, 'About', { size: 22 }); button(R.controls, 'Controls', { size: 22 });
    button(R.rules, 'Rules', { size: 22 }); button(R.settings, 'Settings', { size: 22 });
    const sx = wide ? artCx : w / 2;
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, sx, statsY, 22, 'rgba(251,232,191,0.9)', UI, 500);
    let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
    text(stars.trim(), sx, statsY + 38, 30, GOLD, UI, 700);
    if (state.msg) wrap(state.msg.text, sx, lockY + 22, 20, Math.min(620, wide ? M.x - 40 : 620), '#ffe9b0');
    { const q = R.lock, dn = state.lkDown;      // the themed Arcforge lockup under the menu; a tap opens the Arcforge home
      ctx.save(); ctx.fillStyle = 'rgba(24,8,4,0.62)'; rrect(q.x - 10, q.y - 5, q.w + 20, q.h + 10, (q.h + 10) / 2); ctx.fill(); ctx.restore();
      if (dn) { ctx.save(); drawLockupImage(ctx, q.x + q.w / 2, q.y + 1, q.h * 0.96, 0.7); ctx.restore(); } else drawLockupImage(ctx, q.x + q.w / 2, q.y, q.h, 1); }
  } else if (scene === 'demo-limit') {
    const s = Math.min(1, (LV.U.h - 24) / 900, (LV.U.w - 24) / 720);
    ctx.save(); ctx.translate((w - 720 * s) / 2, LV.U.y0 + LV.U.h / 2 - 650 * s); ctx.scale(s, s);
    titleArt();
    panel(60, 700, 600, 380, 0.9);
    text('That was the free taste.', 360, 820, 54, CREAM, FONT);
    text('Get Scopa on iPhone and Android', 360, 910, 30, '#fff3d6', UI, 600); text('for unlimited games.', 360, 952, 30, '#fff3d6', UI, 600);
    ctx.restore();
  } else if (scene === 'settings') {
    panel(SET.panel.x, SET.panel.y, SET.panel.w, SET.panel.h, 0.6);
    if (wide && !SET.titleCenter) text('Settings', SET.panel.x + 36, SET.titleY, 52, CREAM, FONT, 700, 'left'); else if (wide) text('Settings', w / 2, SET.titleY, 52, CREAM, FONT); else text('Settings', w / 2, SET.titleY, 70, CREAM, FONT);
    const lv = LEVELS[state.level], sz = wide ? 26 : 30;
    button(SET.level, `Computer level: ${lv.name}`, { size: sz });
    button(SET.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: sz });
    button(SET.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: sz });
    button(SET.big, state.big ? 'Large text: on' : 'Large text: off', { size: sz });
    button(SET.deck, state.french ? 'Cards: French suits' : 'Cards: Italian suits', { size: sz });
    button(SET.target, `Play to ${state.target} points`, { size: sz });
    wrap(lv.blurb, SET.blurbX, SET.blurbY, wide ? 23 : 25, SET.blurbW, '#ffe9b0');
    if (SET.cardsY) {
      [4, 34, 10, 20].forEach((id, i) => card(id, w / 2 + (i - 1.5) * (SET.cardsW + 20), SET.cardsY, SET.cardsW, (i - 1.5) * 0.06));
      text(state.french ? 'French suits: diamonds, hearts, spades, clubs' : 'Coins, cups, swords, batons', w / 2, SET.capY, 22, 'rgba(251,232,191,0.85)', UI, 600);
    }
    button(SET.back, 'Back', { primary: true, size: 32 });
  } else if (scene === 'about' || scene === 'rules' || scene === 'controls') {
    // About, Controls and Rules share one reader page: a framed panel, one concept per page, a text-size stepper, and a body that
    // scrolls (drag, wheel, arrow keys) whenever the text is bigger than the window - at any size, in either orientation.
    const list = scene === 'about' ? ABOUT : scene === 'rules' ? RULES : CONTROLS;
    const headerTitle = scene === 'about' ? 'About Scopa' : scene === 'rules' ? 'Rules' : 'Controls';
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1; // guarded: an out-of-range saved index must never yield NaN sizes.
    const P = READER.P, VP = READER.VP;
    panel(P.x, P.y, P.w, P.h, 0.92);
    text(headerTitle, READER.titleX, READER.titleY, wide ? 44 : Math.round(64 * Math.min(scale, 1.15)), CREAM, FONT, 700, READER.titleAlign);
    const titleSize = Math.round(31 * scale), bodySize = Math.round(29 * scale), lh = Math.round(bodySize * 1.4), lineGap = Math.round(16 * scale);
    const scroll = Math.max(0, Math.min(state.scrollY || 0, readerMetrics.max));
    ctx.save(); ctx.beginPath(); ctx.rect(VP.x - 8, VP.y, VP.w + 16, VP.h); ctx.clip(); ctx.translate(0, -scroll);
    const bw = VP.w - 18, bx = VP.x + 4, mid = VP.x + (VP.w - 14) / 2;
    let y = VP.y; const visTop = VP.y + scroll - 120, visBot = VP.y + scroll + VP.h + 120;   // only the visible slice is drawn
    // One continuous reader: every section in order, separated by a thin rule.
    list.forEach((pg, idx) => {
      if (idx > 0) {
        y += Math.round(bodySize * 0.3);
        ctx.save(); ctx.strokeStyle = 'rgba(243,207,122,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(VP.x + 12, y); ctx.lineTo(VP.x + VP.w - 26, y); ctx.stroke(); ctx.restore();
        y += Math.round(bodySize * 0.5);
      }
      // the section title, wrapped (it can be long at 300%)
      const tl = lines(pg.title, bw, titleSize, 700, FONT);
      y += titleSize + 4;
      if (y + tl.length * titleSize * 1.2 > visTop && y - titleSize < visBot) tl.forEach((ln, i) => text(ln, mid, y + i * titleSize * 1.12, titleSize, GOLD, FONT, 700)); y += (tl.length - 1) * titleSize * 1.12 + Math.round(52 * scale);
      if (pg.cards && pg.cards.length) {
        const n = pg.cards.length, gap = 22; let cw = n >= 4 ? 118 : 132; cw = Math.min(cw, (bw - (n - 1) * gap) / n);
        const totalW = n * cw + (n - 1) * gap, x0 = mid - totalW / 2 + cw / 2, cy = y + cw * 0.8, capW = cw + gap - 6;
        const capLines = Math.max(0, ...pg.cards.map((cd) => (cd.label ? lines(cd.label, capW, 15).length : 0)));
        if (cy + cw * 1.4 > visTop && cy - cw * 1.4 < visBot) pg.cards.forEach((cd, i) => {
          const cx = x0 + i * (cw + gap);
          card(cd.id, cx, cy, cw, 0);
          if (cd.label) wrap(cd.label, cx, cy + cw * 1.0, 15, capW, 'rgba(251,232,191,0.85)', 18);
        });
        // the row's height counts every caption line (measured whether or not the row is on screen), and the text below starts a full
        // text line (which grows with the text size) under the lowest caption baseline, so nothing can overlap at any text size
        const capBase = cy + cw * 1.0 + (Math.max(1, capLines) - 1) * 18;
        y = Math.max(cy + cw * 1.0 + 26 + Math.round(bodySize * 0.6), capBase + 12 + Math.round(bodySize * 0.85));
        if (pg.cardsCaption) { text(pg.cardsCaption, mid, y, 19, 'rgba(251,232,191,0.75)', UI, 600); y += 14 + Math.round(bodySize * 0.85); }
      }
      for (const line of pg.lines) {
        const Ls = lines(line, bw, bodySize);
        if (y + Ls.length * lh > visTop && y - bodySize < visBot) Ls.forEach((ln, i) => text(ln, bx, y + i * lh, bodySize, '#fff3d6', UI, 600, 'left'));
        y += Ls.length * lh + lineGap;
      }
    });
    ctx.restore();
    readerMetrics.view = VP.h; readerMetrics.max = Math.max(0, Math.round(y - VP.y - VP.h + 8));
    if (readerMetrics.max > 0) {
      const bar = READER.bar, th = Math.max(36, bar.h * VP.h / (VP.h + readerMetrics.max)), ty = bar.y + (bar.h - th) * (scroll / readerMetrics.max);
      ctx.fillStyle = 'rgba(243,207,122,0.18)'; rrect(bar.x, bar.y, bar.w, bar.h, 4); ctx.fill(); ctx.fillStyle = 'rgba(243,207,122,0.85)'; rrect(bar.x, ty, bar.w, th, 4); ctx.fill();
    }
    // Back is the neutral action (steps back, or exits to the title from page 1); Next is the primary forward action and reads "Done" on the last page.
    button(BTN.pageBack, 'Back', { size: 30 });
    button(BTN.pageNext, 'Done', { primary: true, size: 30 });
    button(BTN.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 });
    button(BTN.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
  } else if (scene === 'over' || scene === 'autoplay-over') {
    ctx.fillStyle = 'rgba(20,6,0,0.78)'; ctx.fillRect(0, 0, w, h);
    const ap = scene === 'autoplay-over', won = g.winner === 0, T = state.n === 4, P = POSTER;
    // the text block: tall = design coordinates under the poster transform; wide = explicit rows around the vertical centre
    const Y = wide
      ? { t1: P.cy - 175, t2: P.cy - 115, score: P.cy - 5, who: P.cy + 35, rounds: P.cy + 68, star: P.cy + 108, more: P.cy + 250, ts: ap ? 44 : 70, ts2: 62, ss: 112 }
      : { t1: 420, t2: 500, score: 680, who: 735, rounds: 785, star: 870, more: 1355, ts: ap ? 50 : 84, ts2: 74, ss: 130 };
    ctx.save(); if (!wide) { ctx.translate(P.ox, P.oy); ctx.scale(P.s, P.s); } const cx = wide ? w / 2 : 360;
    if (!ap) {
      text(won ? (T ? 'Your team wins!' : 'You win!') : T ? 'They win this time' : 'The computer wins', cx, wide ? Y.t2 : 470, Y.ts, CREAM, FONT);
      text(`${g.score[0]} : ${g.score[1]}`, cx, Y.score, Y.ss, GOLD, NUM, 800);
      text(T ? 'Your team : Opponents' : 'You : Computer', cx, Y.who, 24, 'rgba(251,232,191,0.9)', UI, 600);
      text(`${g.round} round${g.round === 1 ? '' : 's'}`, cx, Y.rounds, 24, 'rgba(251,232,191,0.75)', UI, 500);
      if (won && !T) text(`★ ${LEVELS[state.level].name} beaten`, cx, Y.star, 32, GOLD, UI, 700);
      if (won && !state.calm) for (let k = 0; k < 18; k++) { const ph = (state.t * 0.3 + k * 0.11) % 1, x = cx + Math.sin(k * 2.4) * (200 + 90 * ph), y = (wide ? P.cy - 60 : 640) - ph * (wide ? 300 : 460); card(k % 3 === 0 ? 6 : 29, x, y, 60 * (1 - ph * 0.4), ph * 5, { shadow: false }); }
    } else {
      text('Auto Play complete', cx, Y.t1, wide ? 40 : 50, CREAM, FONT);
      text(won ? 'Player A wins!' : 'Player B wins!', cx, Y.t2, Y.ts2, CREAM, FONT);
      text(`${g.score[0]} : ${g.score[1]}`, cx, Y.score, Y.ss, GOLD, NUM, 800);
      text('Player A : Player B', cx, Y.who, 24, 'rgba(251,232,191,0.9)', UI, 600);
      text(`${g.round} round${g.round === 1 ? '' : 's'}`, cx, Y.rounds, 24, 'rgba(251,232,191,0.75)', UI, 500);
    }
    drawMoreLine(ctx, cx, Y.more, 18);
    ctx.restore();
    const bz = wide ? 1 : P.s;
    button(BTN.again, ap ? 'Watch again' : 'Play again', { primary: true, size: Math.round(36 * bz) });
    button(BTN.back, ap ? 'Exit to menu' : 'Menu', { size: Math.round(32 * bz) });
  }
  void H; void W; void TAU; void CH; void RANK_NAMES; void teamOf; void inRect;
}
