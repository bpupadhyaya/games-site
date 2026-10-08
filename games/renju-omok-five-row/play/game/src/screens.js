// Every screen except the board itself: title, setup, settings, readers (About / How to Play / Rules), Learn, result, demo limit.
import { MODES, MODE_IDS, OPENINGS } from './rules.js';
import { drawTable, drawBoard, drawStone, WOODS, WOOD_IDS, STONES, STONE_IDS, boardGeom, glow } from './art.js';
import { TEXT_SCALES, THINK_STEPS, clamp, R } from './layout.js';
import { LEVELS } from './engine.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { ui, text, para, wrap, panel, button, segmented, scrollZone, roundRect, COL, DISPLAY, SANS, TAU, minUnits, addHit, toggleIcon } from './ui.js';
import { drawDiagram, diagramSize } from './view.js';

const ts = (s) => TEXT_SCALES[s.set.ts] ?? 1;
const COACH_NAMES = ['Off', 'Alerts', 'Full'];

// ---- title ---------------------------------------------------------------------------------------------------------------------------
const SHOW = [[7, 7], [6, 6], [8, 8], [9, 9], [7, 8], [8, 7], [9, 8], [5, 9], [6, 8], [8, 6], [10, 8]];
function showcase(ctx, state, r) {
  const S = Math.min(r.w, r.h), x = r.x + (r.w - S) / 2, y = r.y + (r.h - S) / 2, n = 15, geo = boardGeom(n);
  drawBoard(ctx, x, y, S, n, state.set.wood, state.set.coords);
  const cell = S * geo.cell, x0 = x + S * geo.m, rad = cell * 0.465, period = SHOW.length * 0.85 + 4.8, t = state.t % period;
  const shown = Math.min(SHOW.length, Math.floor(t / 0.85) + 1), fade = t > period - 1 ? clamp(1 - (t - (period - 1)), 0, 1) : 1;
  ctx.save(); ctx.globalAlpha = fade;
  for (let k = 0; k < shown; k++) {
    const [gx, gy] = SHOW[k], age = t - k * 0.85, lift = state.set.calm ? 0 : Math.max(0, 1 - age / 0.28);
    drawStone(ctx, k % 2 === 0, x0 + gx * cell, y + S * geo.m + gy * cell, rad, state.set.stones, { lift, alpha: clamp(age / 0.1, 0.05, 1) });
  }
  if (shown === SHOW.length && t > SHOW.length * 0.85 + 0.3) {
    const k = clamp((t - SHOW.length * 0.85 - 0.3) / 0.5, 0, 1), a = [x0 + 6 * cell, y + S * geo.m + 8 * cell], b = [x0 + 10 * cell, y + S * geo.m + 8 * cell];
    ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,214,120,0.35)'; ctx.lineWidth = rad * 0.9; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + (b[0] - a[0]) * k, a[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,170,0.95)'; ctx.lineWidth = rad * 0.2; ctx.stroke();
  }
  ctx.restore();
}
export function renderTitle(ctx, state, L) {
  drawTable(ctx, L.w, L.h, state.set.wood);
  const M = L.menu, U = L.U;
  const card = { ...M.card }; card.h -= 54;
  // hero: title text + the attract board
  const hero = M.hero, titleH = clamp(hero.h * 0.26, 100, 200);
  const cx = hero.x + hero.w / 2;
  const tsz = clamp(Math.min(hero.w / 6.1, titleH * 0.5), 44, 110);
  text(ctx, 'Five in a Row', cx, hero.y + tsz * 0.95, tsz, '#f3e6c4', { font: DISPLAY, weight: 700, maxW: hero.w - 20 });
  const sub = 'RENJU  ·  OMOK  ·  GOMOKU';
  ctx.save(); ctx.font = `700 ${clamp(tsz * 0.27, 16, 30)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillStyle = COL.gold;
  const sz = clamp(tsz * 0.27, minUnits(), 30), sp = sz * 0.28; ctx.font = `700 ${sz}px ${SANS}`; let w = [...sub].reduce((s, ch) => s + ctx.measureText(ch).width + sp, -sp), sx = cx - w / 2; ctx.textAlign = 'left';
  if (w > hero.w - 24) { ctx.textAlign = 'center'; ctx.fillText(sub, cx, hero.y + tsz * 0.95 + sz * 1.9); } else for (const ch of sub) { ctx.fillText(ch, sx, hero.y + tsz * 0.95 + sz * 1.9); sx += ctx.measureText(ch).width + sp; }
  ctx.restore();
  const topArt = hero.y + tsz * 0.95 + sz * 2.8;
  showcase(ctx, state, R(hero.x, topArt, hero.w, hero.y + hero.h - topArt));
  // menu card
  panel(ctx, card, { radius: 26, brand: true });
  const rows = [];
  if (state.saved) rows.push(['continue']);
  rows.push(['play'], ['learn', 'auto'], ['howto', 'rules'], ['about', 'settings']);
  const names = { continue: 'Continue game', play: 'Play', learn: 'Learn', auto: 'Watch & Learn', howto: 'How to Play', rules: 'Rules', about: 'About', settings: 'Settings' };
  const pad = 18, gap = 12, nr = rows.length, bh = clamp((card.h - pad * 2 - gap * (nr - 1)) / nr, 52, 96), tz = Math.min(1, 1.0);
  const total = nr * bh + (nr - 1) * gap, y0 = card.y + (card.h - total) / 2;
  rows.forEach((row, i) => {
    const y = y0 + i * (bh + gap), w2 = (card.w - pad * 2 - gap * (row.length - 1)) / row.length;
    row.forEach((id, j) => button(ctx, R(card.x + pad + j * (w2 + gap), y, w2, bh), names[id], id, { kind: id === 'play' || id === 'continue' ? 'primary' : 'normal', size: Math.min(bh * 0.4, row.length > 1 ? 30 : 36) }));
  });
  // Arcforge credit, small, bottom centre under the menu; tapping it opens the Arcforge home
  const ly = card.y + card.h + 38;
  drawCredit(ctx, card.x + card.w / 2, ly, clamp(card.w / 32, 12, 17), { dim: 0.95 });
  addHit('home', R(card.x + card.w / 2 - 230, ly - 34, 460, 56));
}

// ---- setup -----------------------------------------------------------------------------------------------------------------------------
function pageArt(ctx, state, L) {
  drawTable(ctx, L.w, L.h, state.set.wood);
  const a = L.page.art; if (!a || a.w < 240) return;
  const tsz = clamp(Math.min(a.w / 6.4, 84), 36, 84);
  text(ctx, 'Five in a Row', a.x + a.w / 2, a.y + a.h * 0.5 - Math.min(a.w, a.h * 0.62) / 2 - 8, tsz, '#f3e6c4', { font: DISPLAY, weight: 700, maxW: a.w - 20 });
  const S = Math.min(a.w - 10, a.h * 0.62);
  showcase(ctx, state, R(a.x + (a.w - S) / 2, a.y + a.h * 0.5 - S / 2 + 30, S, S));
}
// A page of settings-like blocks. `blocks` are functions (x, W, S) => height that draw at the top-left (x, y) given by the caller through
// `ctx` translation-free coordinates; in a wide layout they flow in two columns and the panel has no side art.
function blockPage(ctx, state, L, key, title, left, right, nav) {
  const two = L.split && L.U.w >= 900;
  const P = L.page, pr = two ? R(L.U.x0 + L.pad + 4, P.panel.y, Math.min(L.U.w - 2 * L.pad - 8, 1240), P.panel.h) : P.panel;
  if (two) pr.x = L.U.x0 + (L.U.w - pr.w) / 2;
  if (!two) pageArt(ctx, state, L); else drawTable(ctx, L.w, L.h, state.set.wood);
  panel(ctx, pr, { radius: 26, brand: true });
  text(ctx, title, pr.x + pr.w / 2, pr.y + 56, 46, '#f3e6c4', { font: DISPLAY, weight: 700, maxW: pr.w - 40 });
  const body = R(pr.x + 24, pr.y + 80, pr.w - 48, pr.h - 96);
  const colW = two ? (body.w - 64) / 2 : body.w - 20;
  const run = (S, draw) => {
    const col = (blocks, x) => { let y = body.y + 6; for (const f of blocks) y += f(x, colW, S, draw ? y : -1e6) ; return y - body.y; };
    const hl = col(two ? left : [...left, ...right], body.x), hr = two ? col(right, body.x + colW + 48) : 0;
    return Math.max(hl, hr);
  };
  // measure at S = 1 with drawing pushed far off screen, then draw scaled to use the room
  ctx.save(); ctx.translate(0, -100000); const n0 = ui.hits.length, h0 = run(1, false); ui.hits.length = n0; ctx.restore();
  const Sf = clamp((body.h - 12) / h0, 1, two ? 1.25 : 1.4);
  scrollZone(ctx, key, body, h0 * Sf + 10, state.scroll[key], () => run(Sf, true));
  nav(pr);
}

export function renderSetup(ctx, state, L) {
  const k = ts(state);
  const label = (s) => (x, W, S, y) => { const f = Math.min(40, 22 * k); text(ctx, s, x + 4, y + f * 0.85, f, COL.gold, { align: 'left', weight: 800 }); return f * 1.45 * Math.min(S, 1.2); };
  const seg = (labels, sel, prefix, h, opt = {}) => (x, W, S, y) => { segmented(ctx, R(x, y, W, h * S), labels, sel, prefix, opt); return (h + 12) * S; };
  const para1 = (fn) => (x, W, S, y) => para(ctx, fn(), x + 4, y, W - 8, 23 * k, COL.dim, { weight: 500 }) - y + 14 * S;
  const desc = { gomoku: 'Free-style: five or more in a row wins. No restrictions, so Black has a big first-move edge.', renju: 'Black may not make an overline, a double four or a double three, and needs exactly five. White is free. The balanced professional game.', omok: 'Korean rules on a 19×19 board: five or more wins, and Black may not make a double three.' };
  const od = { none: 'No opening restrictions beyond the centre start.', restricted: 'Tournament-style: Black\u2019s second stone must be placed outside the central 5 by 5 square.', swap: 'After three stones the side playing White may swap colours, which keeps the opening fair.' };
  const left = [label('RULES'), seg(MODE_IDS.map((m) => MODES[m].name), MODE_IDS.indexOf(state.mode), 'mode', 86, { sub: MODE_IDS.map((m) => `${MODES[m].n}×${MODES[m].n}`) }), para1(() => desc[state.mode])];
  if (state.mode === 'renju') left.push(label('OPENING'), seg(['Standard', 'Restricted 3rd', 'Swap'], OPENINGS.indexOf(state.opening), 'opening', 70), para1(() => od[state.opening]));
  left.push(label('YOU PLAY'), seg(['Black (first)', 'White', 'Two players'], state.two ? 2 : state.human === 1 ? 0 : 1, 'side', 70));
  const right = [];
  if (!state.two) {
    right.push(label('COMPUTER LEVEL'), (x, W, S, y) => {
      const gap = 8, cw = (W - gap * 4) / 5;
      LEVELS.forEach((lv, i) => button(ctx, R(x + i * (cw + gap), y, cw, 78 * S), String(i + 1), `level:${i + 1}`, { active: state.level === i + 1, sub: state.stats.w?.[state.mode]?.[i + 1] ? 'won' : '', size: 34 }));
      return 90 * S;
    }, (x, W, S, y) => {
      const f = Math.min(60, 30 * k); text(ctx, LEVELS[state.level - 1].name, x + 4, y + f * 0.8, f, COL.text, { font: DISPLAY, weight: 700, align: 'left', maxW: W });
      let yy = para(ctx, LEVELS[state.level - 1].blurb, x + 4, y + f * 1.1, W - 8, 24 * k, COL.dim, { weight: 500 }) + 12;
      const st = state.stats.w?.[state.mode] ?? {}, won = Object.keys(st).length;
      yy = para(ctx, won ? `You have beaten ${won} of 5 levels in ${MODES[state.mode].name}.` : `No levels beaten yet in ${MODES[state.mode].name}.`, x + 4, yy + 6, W - 8, 22 * k, COL.teal, { weight: 600 }) + 10;
      return yy - y;
    });
  } else right.push((x, W, S, y) => para(ctx, 'Two players share this device. Black moves first; pass it after every move.', x + 4, y, W - 8, 24 * k, COL.dim, { weight: 500 }) - y + 12);
  blockPage(ctx, state, L, 'setup', 'New game', left, right, (pr) => {
    const nav = L.page.nav, w = Math.min(pr.w, 760), x = pr.x + (pr.w - w) / 2, nw = (w - 12) / 2;
    button(ctx, R(x, nav.y, nw, nav.h), 'Back', 'back'); button(ctx, R(x + nw + 12, nav.y, nw, nav.h), 'Start game', 'start', { kind: 'primary' });
  });
}

export function renderSettings(ctx, state, L) {
  const k = ts(state), s = state.set;
  const label = (t) => (x, W, S, y) => { const f = Math.min(40, 22 * k); text(ctx, t, x + 4, y + f * 0.85, f, COL.gold, { align: 'left', weight: 800, maxW: W }); return f * 1.45 * Math.min(S, 1.2); };
  const toggle = (t, on, id) => (x, W, S, y) => { button(ctx, R(x, y, W, 72 * S), `${t}: ${on ? 'On' : 'Off'}`, id, { icon: toggleIcon(on), size: Math.min(30, 26 * Math.min(k, 1.2)) }); return 82 * S; };
  const seg = (labels, sel, prefix) => (x, W, S, y) => { segmented(ctx, R(x, y, W, 72 * S), labels, sel, prefix); return 84 * S; };
  const left = [label('PLAY'), toggle('Sound', s.sound, 'sound'), (x, W, S, y) => { button(ctx, R(x, y, W, 72 * S), `Coach: ${COACH_NAMES[state.coachMode]}`, 'coach', { size: 28 }); return 82 * S; },
    toggle('Confirm each move', s.confirm, 'confirm'), toggle('Reduced motion', s.calm, 'calm'), toggle('Show coordinates', s.coords, 'coords')];
  const right = [label('BOARD'), seg(WOOD_IDS.map((w) => WOODS[w].name), WOOD_IDS.indexOf(s.wood), 'wood'), label('STONES'), seg(STONE_IDS.map((w) => STONES[w].name), STONE_IDS.indexOf(s.stones), 'stones'),
    label('WATCH & LEARN THINKING TIME'), seg(THINK_STEPS.map((t) => `${t} s`), s.thinkIdx, 'think'), label('TEXT SIZE'),
    (x, W, S, y) => { const w2 = (W - 12) / 2; button(ctx, R(x, y, w2, 72 * S), 'A−  smaller', 'tdec', { disabled: s.ts === 0 }); button(ctx, R(x + w2 + 12, y, w2, 72 * S), 'A+  larger', 'tinc', { disabled: s.ts === TEXT_SCALES.length - 1 }); return 80 * S; },
    (x, W, S, y) => { const f = Math.min(44, 24 * k); text(ctx, `Now ${Math.round(TEXT_SCALES[s.ts] * 100)}%`, x + W / 2, y + f * 0.95, f, COL.dim, { maxW: W }); return f * 1.5; }];
  blockPage(ctx, state, L, 'settings', 'Settings', left, right, (pr) => { button(ctx, R(pr.x + (pr.w - 300) / 2, L.page.nav.y, 300, L.page.nav.h), 'Back', 'back', { kind: 'primary' }); });
}

// ---- readers (About / How to Play / Rules) ----------------------------------------------------------------------------------------------
export function renderReader(ctx, state, L, blocks, title, key) {
  pageArt(ctx, state, L);
  const P = L.page, pr = P.panel, k = ts(state);
  panel(ctx, pr, { radius: 26, brand: true });
  text(ctx, title, pr.x + pr.w / 2, pr.y + 54, 46, '#f3e6c4', { font: DISPLAY, weight: 700, maxW: pr.w - 40 });
  const body = R(pr.x + 24, pr.y + 78, pr.w - 48, pr.h - 92), W = body.w - 26, fs = Math.round(27 * k), hs = Math.round(40 * Math.min(k, 1.5));
  const flow = (draw) => {
    let y = body.y + 4;
    for (const b of blocks) {
      if (b.h) { y += draw ? 0 : 0; if (y > body.y + 8) y += 12 * Math.min(k, 1.5); if (draw) text(ctx, b.h, body.x + 4, y + hs * 0.8, hs, COL.gold, { font: DISPLAY, weight: 700, align: 'left', maxW: W }); y += hs * 1.15 + 4; }
      else if (b.p) { y = para(ctx, b.p, body.x + 4, y, W - 8, fs, COL.text, { weight: 500, draw }) + 8; }
      else if (b.li) { for (const li of b.li) { const ey = y; y = para(ctx, li, body.x + 36, y, W - 44, fs, COL.text, { weight: 500, draw }) + 6; if (draw) { ctx.fillStyle = COL.gold; ctx.beginPath(); ctx.arc(body.x + 16, ey + fs * 0.55, 5, 0, TAU); ctx.fill(); } } y += 4; }
      else if (b.d) {
        const dw = Math.min(W - 8, 480), sz = diagramSize(b.d, dw);
        if (draw) drawDiagram(ctx, b.d, body.x + 4 + (W - 8 - dw) / 2, y + 6, dw, state.set);
        y += sz.h + 14;
        if (b.d.cap) y = para(ctx, b.d.cap, body.x + 4 + (W - 8) / 2, y, W - 8, Math.round(22 * Math.min(k, 1.6)), COL.dim, { weight: 500, align: 'center', draw });
        y += 12;
      }
    }
    return y - body.y;
  };
  // note: centred captions need an x at the centre; para() with align:'center' uses x as the centre of its width
  const h0 = flow(false);
  scrollZone(ctx, key, body, h0 + 12, state.scroll[key], () => flow(true));
  const nav = P.nav, bw = (nav.w - 36) / 4;
  button(ctx, R(nav.x, nav.y, bw, nav.h), 'Back', 'back');
  button(ctx, R(nav.x + (bw + 12), nav.y, bw, nav.h), 'A−', 'tdec', { disabled: state.set.ts === 0 });
  button(ctx, R(nav.x + 2 * (bw + 12), nav.y, bw, nav.h), 'A+', 'tinc', { disabled: state.set.ts === TEXT_SCALES.length - 1 });
  const atEnd = (state.scroll[key] || 0) >= (ui.scrolls[0]?.max ?? 0) - 2;
  button(ctx, R(nav.x + 3 * (bw + 12), nav.y, bw, nav.h), atEnd ? 'Done' : 'Next', 'next', { kind: 'primary' });
}

// ---- Learn list ----------------------------------------------------------------------------------------------------------------------
export function renderLearn(ctx, state, L) {
  pageArt(ctx, state, L);
  const P = L.page, pr = P.panel;
  panel(ctx, pr, { radius: 26, brand: true });
  text(ctx, 'Learn', pr.x + pr.w / 2, pr.y + 56, 46, '#f3e6c4', { font: DISPLAY, weight: 700 });
  const body = R(pr.x + 24, pr.y + 80, pr.w - 48, pr.h - 96), W = body.w - 20, cols = body.w > 700 ? 2 : 1, gap = 12, cw = (W - gap * (cols - 1)) / cols;
  const rowsN = Math.ceil(LESSONS.length / cols), bh = clamp((body.h - 12 - gap * (rowsN - 1)) / rowsN, 84, 124);
  scrollZone(ctx, 'learn', body, rowsN * (bh + gap) + 6, state.scroll.learn, () => {
    LESSONS.forEach((l, i) => {
      const x = body.x + (i % cols) * (cw + gap), y = body.y + 4 + Math.floor(i / cols) * (bh + gap), done = state.stats.lessons?.[i];
      button(ctx, R(x, y, cw, bh), `${i + 1}. ${l.t}`, `lesson:${i}`, { sub: done ? 'Done' : MODES[l.mode].name, size: Math.min(30, 26 * Math.min(ts(state), 1.2)), active: done });
    });
  });
  button(ctx, R(P.nav.x + (P.nav.w - 300) / 2, P.nav.y, 300, P.nav.h), 'Back', 'back', { kind: 'primary' });
}

// ---- result --------------------------------------------------------------------------------------------------------------------------
export function renderOver(ctx, state, L) {
  const U = L.U, g = state.game, k = ts(state);
  ctx.fillStyle = 'rgba(6,10,14,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const cw = Math.min(U.w - 32, 640 + (k - 1) * 60), ch = Math.min(U.h - 24, 560 + (k - 1) * 220), x = U.x0 + (U.w - cw) / 2, y = U.y0 + (U.h - ch) / 2;
  const card = R(x, y, cw, ch);
  panel(ctx, card, { radius: 28, fill: 'rgba(14,22,29,0.96)', brand: true });
  const cx = x + cw / 2, you = !state.two && !state.autoMode ? (g.winner === state.human ? 'win' : g.winner === 3 ? 'draw' : 'lose') : 'n';
  const head = g.winner === 3 ? 'A draw' : you === 'win' ? 'You win!' : you === 'lose' ? 'You lose' : `${g.winner === 1 ? 'Black' : 'White'} wins`;
  glow(ctx, cx, y + 70, 160, '232,197,107', you === 'win' || you === 'n' ? 0.25 : 0.1);
  text(ctx, head, cx, y + 82, Math.min(76, 64 * Math.min(k, 1.3)), '#f3e6c4', { font: DISPLAY, weight: 700, maxW: cw - 40 });
  const why = g.winner === 3 ? 'The board is full.' : state.overWhy;
  let yy = para(ctx, why || '', cx, y + 112 * Math.min(k, 1.6) + 20, cw - 60, Math.min(54, 26 * k), COL.dim, { align: 'center', weight: 500 });
  yy = para(ctx, `${MODES[g.mode].name} · ${g.moves.length} moves`, cx, yy + 4, cw - 60, Math.min(48, 24 * k), COL.dim, { align: 'center', weight: 500 });
  const bw = cw - 60, nb = 3, bh = clamp((ch - (yy - y) - 130) / nb - 10, 56, 84), by = y + ch - 50 - nb * (bh + 10);
  button(ctx, R(x + 30, by, bw, bh), 'Play again', 'again', { kind: 'primary' });
  button(ctx, R(x + 30, by + bh + 10, bw, bh), 'View the board', 'review');
  button(ctx, R(x + 30, by + 2 * (bh + 10), bw, bh), 'Menu', 'menu');
  drawMoreLine(ctx, cx, y + ch - 20, clamp(cw / 38, 12, 16));
  addHit('home', R(x + 30, y + ch - 44, bw, 40));
}

export function renderDemoLimit(ctx, state, L) {
  pageArt(ctx, state, L);
  const P = L.page, pr = R(P.panel.x, L.U.y0 + L.U.h * 0.2, P.panel.w, Math.min(520, L.U.h * 0.6));
  panel(ctx, pr, { radius: 26, brand: true });
  text(ctx, 'That was the free preview', pr.x + pr.w / 2, pr.y + 80, 44, '#f3e6c4', { font: DISPLAY, weight: 700, maxW: pr.w - 40 });
  para(ctx, 'The full game, with every rule set, all five computer levels, the coach and Watch & Learn, is in the Arcforge app for iPhone and Android.', pr.x + 32, pr.y + 120, pr.w - 64, 28, COL.text, { weight: 500 });
  button(ctx, R(pr.x + (pr.w - 300) / 2, pr.y + pr.h - 100, 300, 70), 'Back', 'back', { kind: 'primary' });
}
