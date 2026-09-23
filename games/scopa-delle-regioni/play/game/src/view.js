// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The table and card faces are cached (art.js).
import { W, H, HAND, BTN, SET, CLOTH, DECK, PILE, MSG, deckPos, pilePos, handPos, seatPos, tableGrid, slotPos, titleRows, inRect, TEXT_SCALES } from './layout.js';
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

export function render(ctx, state) {
  const scene = state.scene, big = state.big, g = state.g, french = state.french;
  const boardScene = scene === 'play' || scene === 'lesson' || scene === 'puzzle';
  const pulse = state.calm ? 0.7 : 0.5 + 0.5 * Math.sin(state.t * 5);
  const rrect = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(30,8,0,0.6)'; ctx.fillText(str, x + 1.5, y + 2.5); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
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
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; rrect(r.x + 5, r.y + 4, r.w - 10, r.h * 0.44, 17); ctx.stroke();
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
  drawTable(ctx, state.t, state.calm);

  if (boardScene) {
    const gr = gridOf(state), S = state.sel;
    // eligible table cards for the selected card
    let eligible = new Set(), caps = [];
    if (S) { caps = captures(g.table, S.card); for (const c of caps) if (S.take.every((x) => c.includes(x))) for (const t of c) eligible.add(t); }
    const humanTurn = scene === 'play' ? g.turn === 0 && g.phase === 'play' : true;
    const busy = state.fly.length > 0;

    // ---- header plaque
    panel(30, 100, 660, 70, 0.8);
    if (scene === 'play' || scene === 'over') {
      const A = scene === 'play' ? state.n === 2 ? 'You' : 'Us' : 'You', B = state.n === 2 ? 'Computer' : 'Them';
      text(A, 62, 145, 24, CREAM, UI, 700, 'left'); text(String(g.score[0]), 222, 152, 44, GOLD, NUM, 800, 'center');
      text(B, 658, 145, 24, CREAM, UI, 700, 'right'); text(String(g.score[1]), 498, 152, 44, GOLD, NUM, 800, 'center');
      text(`Round ${g.round}`, 360, 133, 24, CREAM, UI, 700); text(`first to ${g.target}`, 360, 158, 19, 'rgba(251,232,191,0.85)', UI, 600);
    } else if (scene === 'lesson') { text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 360, 128, 22, 'rgba(251,232,191,0.85)', UI, 600); text(LESSONS[state.lesson.i].title, 360, 158, 38, CREAM, FONT); }
    else { text('Daily deal' + (state.pz.p.hard ? ' (weekend)' : ''), 360, 128, 22, 'rgba(251,232,191,0.85)', UI, 600); text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 360, 158, 28, GOLD, UI, 700); }

    // ---- the other seats
    if (scene === 'play') {
      for (let s = 1; s < g.n; s++) {
        const p = seatPos(g.n, s), n = state.seatShown[s], active = g.turn === s && g.phase === 'play';
        if (active) { const gl = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 90); gl.addColorStop(0, `rgba(255,214,120,${0.4 + 0.25 * pulse})`); gl.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = gl; ctx.fillRect(p.x - 90, p.y - 90, 180, 180); }
        for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * 0.22; card(-1, p.x + (k - (n - 1) / 2) * 34, p.y + Math.abs(a) * 24 - 4, 54, a); }
        const label = g.n === 2 ? `Computer · ${LEVELS[state.level].name}` : s === 2 ? 'Partner' : s === 1 ? 'Left' : 'Right';
        text(label, p.x, p.y + 68 + (g.n === 2 ? -2 : 0), g.n === 2 ? 24 : 21, active ? GOLD : CREAM, UI, 700);
        if (active && state.thinking && !busy) { const dots = '.'.repeat(1 + (Math.floor(state.t * 3) % 3)); text('thinking' + dots, p.x, p.y + 92, 18, 'rgba(251,232,191,0.85)', UI, 500); }
      }
      // opponent team's pile
      const on = state.pileShown[1]; backStack(70, 268, 44, on > 0 ? 3 : 0); text(String(on), 70, 330, 24, GOLD, NUM, 800); text(g.n === 2 ? 'theirs' : 'their pile', 70, 214, 15, 'rgba(251,232,191,0.8)', UI, 700);
    }
    if (scene === 'lesson' || scene === 'puzzle') {
      panel(30, 202, 660, 112, 0.86);
      const tx = scene === 'lesson' ? LESSONS[state.lesson.i].text : `Which play is worth the most? Value: each card 1, each coin +1, each 7 +1, the 7 of coins +4, a scopa +3.`;
      fitBox(tx, 30, 202, 660, 112, big ? 28 : 25, '#fff3d6');
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
    if (scene === 'play') {
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
    if (state.kb && (scene === 'play' || scene === 'lesson' || scene === 'puzzle') && !S) text('Keys 1 2 3: pick a card', 360, 1450, 20, 'rgba(255,240,200,0.75)', UI, 600);

    // ---- buttons
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 28 }); button(BTN.undo, 'Undo', { size: 28, dim: !state.undo }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 28, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 28 }); if (state.lesson.done && !busy && !state.panel) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 28 }); if (state.pz.status === 'solved' && !busy) button(BTN.share, 'Share result', { primary: true, size: 30 }); }

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
      ctx.save(); ctx.globalAlpha = a; ctx.translate(360, 640); ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(30,8,0,0.6)'; rrect(-260, -100, 520, 200, 30); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 4; ctx.stroke();
      text('SCOPA!', 0, 22, 108, '#ffe6a0', FONT, 700); text(f.team === 0 ? 'the table is swept: +1 point' : 'swept by the other side: +1 point', 0, 70, 24, CREAM, UI, 600);
      ctx.restore();
      if (!state.calm) for (let k = 0; k < 22; k++) { const ang = k * 2.4 + 0.3, r = 60 + p * (200 + (k % 5) * 40), x = 360 + Math.cos(ang) * r, y = 640 + Math.sin(ang) * r * 0.7, s = (1 - p) * 9; ctx.fillStyle = `rgba(255,${200 + (k % 3) * 20},110,${a})`; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.4, y); ctx.lineTo(x, y + s); ctx.lineTo(x - s * 0.4, y); ctx.fill(); }
    }
    if (scene === 'play' && state.dev) text('DEV', 40, 190, 20, '#7dff9a', UI, 700, 'left');
  }

  // ---- round scoring panel -------------------------------------------------------------------------------------------
  if (boardScene && state.panel === 'round' && g.summary) {
    ctx.fillStyle = 'rgba(14,4,0,0.72)'; ctx.fillRect(0, 0, W, H);
    panel(40, 200, 640, 1040, 0.94);
    const s = g.summary, per = s.per, T = per.length, names = scene === 'lesson' ? ['You', 'Opponent'] : state.n === 4 ? ['Your team', 'Opponents'] : ['You', 'Computer'];
    text(scene === 'lesson' ? 'How a round is scored' : `Round ${g.round}`, 360, 285, 62, CREAM, FONT);
    text(names[0], 430, 350, 26, GOLD, UI, 700); text(names[1], 590, 350, 26, GOLD, UI, 700);
    const rows = [
      ['Cards (carte)', 'most cards', per.map((x) => String(x.cards)), s.winners.carte],
      ['Coins (denari)', 'most coins', per.map((x) => String(x.coins)), s.winners.denari],
      ['Sette bello', '7 of coins', per.map((x) => (x.sette ? 'yes' : '-')), s.winners.sette],
      ['Primiera', 'best card per suit', per.map((x) => (x.prim ? String(x.prim) : '-')), s.winners.primiera],
      ['Scopa (broom)', 'tables swept', per.map((x) => String(x.scope)), -2],
    ];
    let y = 400;
    rows.forEach(([a, b, vals, win], k) => {
      if (k % 2 === 0) { ctx.fillStyle = 'rgba(255,220,150,0.06)'; rrect(60, y - 44, 600, 84, 10); ctx.fill(); }
      text(a, 82, y - 4, 28, CREAM, UI, 700, 'left'); text(b, 82, y + 24, 19, 'rgba(251,232,191,0.7)', UI, 500, 'left');
      for (let t = 0; t < T; t++) {
        const x = t === 0 ? 430 : 590, won = win === t || (win === -2 && per[t].scope > 0);
        if (won) { ctx.fillStyle = 'rgba(243,207,122,0.25)'; rrect(x - 56, y - 38, 112, 70, 14); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke(); }
        text(vals[t], x, y + 12, 36, won ? '#ffe9a8' : CREAM, NUM, 800);
      }
      y += 92;
    });
    ctx.strokeStyle = 'rgba(243,207,122,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(70, y - 24); ctx.lineTo(650, y - 24); ctx.stroke();
    text('Points this round', 82, y + 34, 28, CREAM, UI, 700, 'left'); per.forEach((x, t) => text(String(x.pts), t === 0 ? 430 : 590, y + 40, 50, '#ffe9a8', NUM, 800));
    y += 96;
    if (scene !== 'lesson') { text('Match score', 82, y + 12, 26, CREAM, UI, 700, 'left'); g.score.forEach((sc, t) => text(String(sc), t === 0 ? 430 : 590, y + 16, 44, GOLD, NUM, 800)); text(`first to ${g.target}`, 360, y + 62, 20, 'rgba(251,232,191,0.75)', UI, 600); y += 90; }
    const notes = []; if (s.winners.carte < 0) notes.push('Equal cards: no point for cards.'); if (s.winners.denari < 0) notes.push('Equal coins: no point for coins.'); if (s.winners.primiera < 0) notes.push('Primiera needs a card in every suit, and the higher total wins.');
    if (notes.length) wrap(notes[0], 360, y + 30, 21, 540, 'rgba(251,232,191,0.8)');
    button(BTN.cont, scene === 'lesson' ? 'Continue' : g.phase === 'over' ? 'See the result' : 'Next round', { primary: true, size: 34 });
  }

  // ---- other screens -------------------------------------------------------------------------------------------------
  if (scene === 'title' || scene === 'demo-limit') {
    // hanging fan of cards, gently swaying
    const fan = [[9, 10, 0], [16, 7, 1], [9, 1, 2], [7, 7, 3], [39, 10, 3]]; void fan;
    const ids = [29, 6, 19, 39, 8]; // Re/7/etc drawn from the deck (suit*10+rank-1)
    ids.forEach((id, i) => { const a = (i - 2) * 0.24 + (state.calm ? 0 : Math.sin(state.t * 1.1 + i) * 0.025), x = 360 + (i - 2) * 112, y = 590 + Math.abs(i - 2) * 24 + (state.calm ? 0 : Math.sin(state.t * 1.4 + i * 1.3) * 5); card(id, x, y, 158, a, { lift: true }); });
    text('Scopa', 360, 330, 150, CREAM, FONT); ctx.fillStyle = 'rgba(24,8,4,0.7)'; rrect(120, 350, 480, 46, 23); ctx.fill(); text('The Italian card game of the broom', 360, 383, 26, 'rgba(251,232,191,0.97)', FONT, 700);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solved = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 32 });
    button(R.learn, 'Learn to play (imparare)', { primary: !state.learned && !R.resume, size: 30 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 32 });
    button(R.four, 'Four players, in partnership', { size: 30 });
    button(R.daily, solved ? `Daily deal: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily deal · streak ${state.daily.streak}` : 'Daily deal', { size: 30 });
    button(R.about, 'About', { size: 22 }); button(R.controls, 'Controls', { size: 22 });
    button(R.rules, 'Rules', { size: 22 }); button(R.settings, 'Settings', { size: 22 });
    const y = R.about.y + 130;
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, y, 22, 'rgba(251,232,191,0.9)', UI, 500);
    let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
    text(stars.trim(), 360, y + 38, 30, GOLD, UI, 700);
    if (state.msg) wrap(state.msg.text, 360, 1490, 22, 620, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    panel(60, 700, 600, 380, 0.9);
    text('That was the free taste.', 360, 820, 54, CREAM, FONT);
    text('Get Scopa on iPhone and Android', 360, 910, 30, '#fff3d6', UI, 600); text('for unlimited games.', 360, 952, 30, '#fff3d6', UI, 600);
  } else if (scene === 'settings') {
    panel(40, 120, 640, 1290, 0.6);
    text('Settings', 360, 215, 70, CREAM, FONT);
    const lv = LEVELS[state.level];
    button(SET.level, `Computer level: ${lv.name}`, { size: 30 });
    button(SET.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 30 });
    button(SET.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 30 });
    button(SET.big, state.big ? 'Large text: on' : 'Large text: off', { size: 30 });
    button(SET.deck, state.french ? 'Cards: French suits' : 'Cards: Italian suits', { size: 30 });
    button(SET.target, `Play to ${state.target} points`, { size: 30 });
    wrap(lv.blurb, 360, 870, 25, 580, '#ffe9b0');
    [4, 34, 10, 20].forEach((id, i) => card(id, 150 + i * 140, 1120, 120, (i - 1.5) * 0.06));
    text(state.french ? 'French suits: diamonds, hearts, spades, clubs' : 'Coins, cups, swords, batons', 360, 1270, 22, 'rgba(251,232,191,0.85)', UI, 600);
    button(SET.back, 'Back', { primary: true, size: 32 });
  } else if (scene === 'about' || scene === 'rules' || scene === 'controls') {
    // About, Controls and Rules all share this one reader-page layout: a framed panel (already
    // this game's own dark translucent card, `panel()`), a page per single concept, and a text-size
    // stepper right here in the header row so anyone - glasses or not - can bump it up where they
    // are actually reading, rather than hunting for it in Settings.
    const list = scene === 'about' ? ABOUT : scene === 'rules' ? RULES : CONTROLS;
    const headerTitle = scene === 'about' ? 'About Scopa' : scene === 'rules' ? 'Rules' : 'Controls';
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1; // guarded: an out-of-range saved index must never yield NaN sizes.
    panel(36, 100, 648, 1310, 0.92);
    const headerSize = Math.round(64 * Math.min(scale, 1.15));
    text(headerTitle, 360, 190, headerSize, CREAM, FONT);
    const pg = list[state.page % list.length];
    const titleSize = Math.round(31 * scale), titleY = 190 + Math.round(58 * Math.min(scale, 1.15));
    text(pg.title, 360, titleY, titleSize, GOLD, FONT, 700);
    let y = titleY + Math.round(52 * scale);
    if (pg.cards && pg.cards.length) {
      const n = pg.cards.length, cw = n >= 4 ? 118 : 132, gap = 22, totalW = n * cw + (n - 1) * gap, x0 = 360 - totalW / 2 + cw / 2, cy = y + 108;
      pg.cards.forEach((cd, i) => {
        const cx = x0 + i * (cw + gap);
        card(cd.id, cx, cy, cw, 0);
        if (cd.label) wrap(cd.label, cx, cy + cw * 1.0, 15, cw + 28, 'rgba(251,232,191,0.85)', 18);
      });
      y = cy + cw * 1.0 + 40;
      if (pg.cardsCaption) { text(pg.cardsCaption, 360, y, 19, 'rgba(251,232,191,0.75)', UI, 600); y += 34; }
    }
    const bodySize = Math.round(29 * scale), lh = Math.round(bodySize * 1.4), lineGap = Math.round(16 * scale);
    for (const line of pg.lines) { const n = wrap(line, 70, y, bodySize, 580, '#fff3d6', lh, 'left'); y += n * lh + lineGap; }
    text(`Page ${(state.page % list.length) + 1} of ${list.length}`, 360, 1398, 20, 'rgba(251,232,191,0.7)', UI, 600);
    button(BTN.pageBack, 'Back', { primary: true, size: 30 });
    button(BTN.pageNext, 'Next', { primary: true, size: 30 });
    button(BTN.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 });
    button(BTN.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(20,6,0,0.55)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 0, T = state.n === 4;
    text(won ? (T ? 'Your team wins!' : 'You win!') : T ? 'They win this time' : 'The computer wins', 360, 470, 84, CREAM, FONT);
    text(`${g.score[0]} : ${g.score[1]}`, 360, 680, 130, GOLD, NUM, 800);
    text(T ? 'Your team : Opponents' : 'You : Computer', 360, 735, 24, 'rgba(251,232,191,0.9)', UI, 600);
    text(`${g.round} round${g.round === 1 ? '' : 's'}`, 360, 785, 24, 'rgba(251,232,191,0.75)', UI, 500);
    if (won && !T) text(`★ ${LEVELS[state.level].name} beaten`, 360, 870, 32, GOLD, UI, 700);
    if (won && !state.calm) for (let k = 0; k < 18; k++) { const ph = (state.t * 0.3 + k * 0.11) % 1, x = 360 + Math.sin(k * 2.4) * (200 + 90 * ph), y = 640 - ph * 460; card(k % 3 === 0 ? 6 : 29, x, y, 60 * (1 - ph * 0.4), ph * 5, { shadow: false }); }
    button(BTN.again, 'Play again', { primary: true, size: 36 }); button(BTN.back, 'Menu', { size: 32 });
  }
  void H; void TAU; void CH; void RANK_NAMES; void teamOf; void inRect;
}
