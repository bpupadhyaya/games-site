// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art is cached (art.js).
import { W, H, BX, BY, PR, STONE_R, pointPos, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawTitleLockup, drawLockup, drawMoreLine } from './brand.js';
import { drawBackground, drawBoard, drawStone, koru, band, FONT, UI } from './art.js';
import { SIDE_NAME, legalMoves, other } from './rules.js';
import { LADDER, sayVerdict } from './ai.js';
import { rate } from './solver.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { movesToWin } from './puzzles.js';

const TAU = Math.PI * 2;
const CREAM = '#f3e6c8', GOLD = '#e8c777', MINT = '#8fe0b8';

// Wrapped-line cache: a paragraph is measured once per (font, size, width, text) and reused every frame (the Rules reader used to re-measure
// its whole document twice per frame). It is dropped when a web font finishes loading. readerStats.wraps counts cache misses (tests read it).
const wrapMemo = new Map(); let wrapFontsKey = '';
export const readerStats = { wraps: 0 };

export function render(ctx, st, L) {
  { ctx.font = `700 40px ${FONT}`; const fk = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const fk2 = fk + '/' + ctx.measureText('Hamburgefonstiv').width; if (fk2 !== wrapFontsKey || wrapMemo.size > 3000) { wrapMemo.clear(); wrapFontsKey = fk2; } }
  const t = st.t, big = st.big ? 1.16 : 1;
  const text = (s, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(s, x, y); };
  // Measures only (never draws) - shared by wrap() and by page()'s dry-run height pass. Splits on
  // spaces as usual, but also breaks each individual word after any internal hyphen (with no space
  // introduced) - a long compound like "counter-clockwise" fits fine as one unbreakable token at
  // small sizes, but at the 300% text step it can be wider than the whole panel, so it needs the
  // same fallback break point a human reader would use.
  const countLines = (s, maxW, size, font = UI, weight = 600) => {
    const mk = `${weight}|${size}|${maxW}|${font}|${s}`, hit = wrapMemo.get(mk); if (hit) return hit;
    readerStats.wraps++;
    ctx.font = `${weight} ${size}px ${font}`;
    const toks = [];
    String(s).split(' ').forEach((w, wi) => {
      w.split(/(?<=-)/).forEach((p, pi) => toks.push({ t: p, glue: pi === 0 ? (wi === 0 ? '' : ' ') : '' }));
    });
    const out = []; let cur = '';
    for (const tok of toks) { const n = cur ? cur + tok.glue + tok.t : tok.t; if (ctx.measureText(n).width > maxW && cur) { out.push(cur); cur = tok.t; } else cur = n; }
    out.push(cur); wrapMemo.set(mk, out); return out;
  };
  const wrap = (s, x, y, size, maxW, color = CREAM, lh = size * 1.32, align = 'center', font = UI, weight = 600) => {
    const lns = countLines(s, maxW, size, font, weight);
    lns.forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align)); return lns.length;
  };
  const plaque = (r, o = {}) => {
    ctx.save(); ctx.fillStyle = 'rgba(0,10,12,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 7, r.w, r.h, 20); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, o.top || 'rgba(20,52,58,0.94)'); g.addColorStop(1, o.bot || 'rgba(9,28,33,0.94)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 20); ctx.fill();
    ctx.strokeStyle = 'rgba(143,224,184,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(232,199,119,0.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14, 14); ctx.stroke();
    ctx.restore();
  };
  // `r` is a SCREEN rect; r.s (its section's scale) scales the button's own drawing, so a button looks the same at every size.
  const button = (R0, label, o = {}) => {
    const sc0 = R0.s || 1, r = { x: 0, y: 0, w: R0.w / sc0, h: R0.h / sc0 };
    ctx.save(); ctx.translate(R0.x, R0.y); ctx.scale(sc0, sc0); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,8,10,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 18); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { g.addColorStop(0, '#79cfa6'); g.addColorStop(1, '#2f7d5f'); } else { g.addColorStop(0, '#875530'); g.addColorStop(1, '#4a2812'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill();
    // grain
    ctx.save(); ctx.clip(); ctx.strokeStyle = o.primary ? 'rgba(255,255,255,0.09)' : 'rgba(20,8,2,0.16)'; ctx.lineWidth = 1;
    for (let k = 5; k < r.h; k += 7) { ctx.beginPath(); ctx.moveTo(r.x, r.y + k); ctx.bezierCurveTo(r.x + r.w * 0.3, r.y + k - 3, r.x + r.w * 0.6, r.y + k + 3, r.x + r.w, r.y + k); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = o.primary ? 'rgba(220,255,236,0.7)' : 'rgba(143,224,184,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.stroke();
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.34, o.size ?? 30, o.primary ? '#0b2a1f' : CREAM, UI, 700);
    ctx.restore();
  };
  // Draw with a section's transform: inside, coordinates are the original 720-wide design coordinates.
  const within = (S, fn) => { ctx.save(); ctx.translate(S.ox, S.oy); ctx.scale(S.s, S.s); fn(); ctx.restore(); };
  // The largest font size <= size (down to min) at which `str` fits in maxW.
  const fitSize = (str, maxW, size, font = UI, weight = 700, min = 12) => { ctx.font = `${weight} ${size}px ${font}`; const w = ctx.measureText(str).width; return w <= maxW ? size : Math.max(min, Math.floor(size * maxW / w)); };
  const ring = (p, r, color, w = 4, a = 1) => { ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.restore(); };
  const glowDot = (p, r, rgb, a) => { const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, r); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); };
  const pulse = (k = 3) => (st.calm ? 0.7 : 0.5 + 0.5 * Math.sin(st.t * k));

  drawBackground(ctx, t, st.calm, L.w, L.h);
  const sc = st.scene;
  if (sc === 'title') return title();
  if (sc === 'about') return page('About Mū Tōrere', ABOUT);
  if (sc === 'howto') return page('How to play', HOWTO);
  if (sc === 'rules') return page('Rules', RULES);
  if (sc === 'ladder') return ladder();
  if (sc === 'demo-limit') return demoLimit();
  return boardScene();

  // Auto Play's REVEAL phase: every legal move this turn (dim gold ring on its destination), then
  // the ONE move actually about to be played highlighted far more strongly (bright green + glow,
  // plus the source point), so a watcher can compare their own guess against it before it happens.
  function autoReveal(D) {
    const isChosen = (m) => D.chosen && m.from === D.chosen.from && m.to === D.chosen.to;
    for (const m of D.moves || []) {
      const p = pointPos(m.to), chosen = isChosen(m);
      if (chosen) { glowDot(p, 92, '120,255,190', 0.55 + 0.25 * pulse(3.2)); ring(p, 58 + 3 * pulse(3.2), '#c6ffe0', 5, 1); }
      else ring(p, 50, 'rgba(232,199,119,0.65)', 3, 0.7 + 0.2 * pulse(3));
    }
    if (D.chosen) { const p = pointPos(D.chosen.from); glowDot(p, 80, '120,255,190', 0.4 + 0.2 * pulse(3)); ring(p, 54, '#c6ffe0', 4, 0.9); }
  }

  // ---------------------------------------------------------------- title
  function title() {
    const T = L.title(!!st.saved), bob = st.calm ? 0 : Math.sin(t * 0.9) * 4;
    within(T.art, () => {
      // faint sun glow behind the star
      glowDot({ x: 360, y: 470 }, 330, '255,220,160', 0.16 + 0.04 * Math.sin(t * 0.7));
      drawBoard(ctx, 360, 470 + bob, 0.66);
      const s = 0.66;
      const board = [1, 1, 1, 1, 2, 2, 2, 2, 0];
      for (let i = 0; i < 9; i++) if (board[i]) { const p = pointPos(i, 360, 470 + bob, s); const br = st.calm ? 0 : Math.sin(t * 1.3 + i * 0.8) * 1.2; drawStone(ctx, board[i], p.x, p.y + br, STONE_R * s * 0.98); }
      // a slow sweep of light over the carving
      if (!st.calm) { const x = ((t * 60) % 1000) - 200; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(x, 200, x + 120, 700); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,240,200,0.06)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(0, 200, W, 520); ctx.restore(); }
      text('Mū Tōrere', 360, 150, 104, '#f7e8c4', FONT, 700);
      { // the tagline stays clear of the host back button
        const A = T.art, bb = L.backBox, tag = 'The eight-pointed star game of Aotearoa'; let sz = 34;
        if (bb && bb.h && A.oy + 230 * A.s > bb.y && A.oy + 170 * A.s < bb.y + bb.h) sz = fitSize(tag, 2 * (360 - ((bb.x + bb.w - A.ox) / A.s + 14)), 34, FONT, 700, 18);
        text(tag, 360, 206, sz, GOLD, FONT, 700);
      }
      band(ctx, 130, 590, 240, 15, 'rgba(143,224,184,0.6)', 2.6);
    });
    const R = T.rows;
    if (R.resume) button(R.resume, 'Resume your game', { primary: true });
    button(R.learn, 'Learn to play', { primary: !R.resume });
    button(R.ladder, `The Ladder  ·  rung ${st.ladder.top} of 12`);
    button(R.two, 'Two players, one phone');
    button(R.daily, st.daily.solvedDay === st.daily.day ? 'Daily puzzle  ·  solved' : 'Daily puzzle');
    button(R.about, 'About', { size: 22 });
    button(R.howto, 'How to play', { size: 20 });
    button(R.rules, 'Rules', { size: 22 });
    button(R.auto, 'Auto Play', { size: 20 });
    button(R.sound, st.sound ? 'Sound on' : 'Sound off', { size: 24 }); button(R.calm, st.calm ? 'Calm: on' : 'Calm: off', { size: 24 }); button(R.big, st.big ? 'Large text' : 'Normal text', { size: 24 });
    button(R.marks, st.marks ? 'Warnings on: losing moves are marked' : 'Warnings off', { size: 24 });
    within(T.menu, () => {
      if (st.msg) { plaque(T.msgD); text(st.msg.text, 360, T.msgD.y + 40, 24, CREAM); }
      else text(`Played ${st.progress.played}  ·  won ${st.progress.wins}${st.daily.streak ? '  ·  streak ' + st.daily.streak : ''}`, 360, T.statsY, 26, 'rgba(243,230,200,0.75)', UI, 600);
    });
    if (T.lock) drawTitleLockup(ctx, T.lock, st.lockPress > 0);
  }

  // ---------------------------------------------------------------- text pages (About, How to play, Rules)
  function page(name, items) {
    const PG = L.page();
    // Text scale for these reference pages only (independent of the gameplay "Large text" setting).
    // Always guarded: an out-of-range saved index (e.g. from a shorter TEXT_SCALES array) falls back to 1.
    const scale = TEXT_SCALES[st.textScaleIdx] ?? 1;
    const hs = fitSize(name, PG.head.maxW, Math.round(PG.head.size * Math.min(scale, 1.15)), FONT, 700, 26);
    text(name, PG.head.x, PG.head.y, hs, '#f7e8c4', FONT, 700); band(ctx, PG.band.x0, PG.band.x1, PG.band.y, PG.band.size, 'rgba(143,224,184,0.6)', 2.6);
    // The clip window is the layout's: view and game.js (drag-scroll clamp) read the same rect, so they can never drift apart.
    const C = PG.clip, top = C.y, bottom = C.y + C.h, tx = PG.textX, tw = PG.textW;
    ctx.save(); ctx.beginPath(); ctx.rect(C.x, top, C.w, bottom - top); ctx.clip();
    // The gap before the first heading has to grow with the font, or a bigger font's own taller ascenders poke up past the clip's top edge.
    const topGap = Math.round(30 * scale);
    let y = top + topGap - st.scroll; const size = Math.round(28 * scale);
    // Side-by-side icon+paragraph layout only holds up while the paragraph column is wide enough that no single word in it can be wider than
    // the column - true up to about 1.3x on a phone. Past that (or in a narrow column) the paragraph stacks below the icons instead.
    const colW = tw - 228, stackedStones = scale > 1.3 || colW < 330;
    // A heading is normally one line, but at bigger scales the longest ones get wide enough to run off the edge, so headings wrap like body text.
    const headSize = Math.round(32 * scale), headLH = Math.round(headSize * 1.15);
    const headLines = (h) => countLines(h, tw, headSize, FONT, 700);
    // Measure the real content height first (a dry run that only measures) so the plaque behind the text always covers every item.
    let measured = topGap;
    for (const [h, body, art] of items) {
      measured += Math.round(52 * scale) + (headLines(h).length - 1) * headLH;
      if (art === 'stones' && !stackedStones) {
        const n = countLines(body, colW, size).length;
        measured += Math.max(n * size * 1.4, 128) + 26;
      } else if (art === 'stones') {
        const n = countLines(body, tw, size).length;
        measured += 110 + size + n * size * 1.4 + 26;
      } else {
        const n = countLines(body, tw, size).length;
        measured += n * size * 1.4 + 26;
      }
    }
    plaque({ x: PG.panel.x, y: y - 30, w: PG.panel.w, h: measured + 40 }, { top: 'rgba(14,42,48,0.86)', bot: 'rgba(9,28,33,0.86)' });
    for (const [h, body, art] of items) {
      const hLines = headLines(h);
      hLines.forEach((ln, i) => text(ln, tx, y + 26 + i * headLH, headSize, GOLD, FONT, 700, 'left'));
      y += Math.round(52 * scale) + (hLines.length - 1) * headLH;
      // The one Rules item that shows the real in-game stone art (both sides), using the same drawStone() the board itself uses.
      if (art === 'stones') {
        drawStone(ctx, 1, tx + 48, y + 44, 40); drawStone(ctx, 2, tx + 148, y + 44, 40);
        text('Shell', tx + 48, y + 98, 18, 'rgba(243,230,200,0.7)', UI, 600);
        text('Greenstone', tx + 148, y + 98, 18, 'rgba(243,230,200,0.7)', UI, 600);
      }
      if (art === 'stones' && !stackedStones) {
        const n = wrap(body, tx + 228, y + 12, size, colW, CREAM, size * 1.4, 'left'); y += Math.max(n * size * 1.4, 128) + 26;
      } else if (art === 'stones') {
        const bodyY = y + 110 + size;
        const n = wrap(body, tx, bodyY, size, tw, CREAM, size * 1.4, 'left');
        y = bodyY + n * size * 1.4 + 26;
      } else {
        const n = wrap(body, tx, y + 12, size, tw, CREAM, size * 1.4, 'left'); y += n * size * 1.4 + 26;
      }
    }
    st.pageH = y + st.scroll - top;
    ctx.restore();
    button(PG.back, 'Back');
    if (st.pageH > bottom - top) {          // scroll bar
      const tr = { x: PG.panel.x + PG.panel.w - 14, y: top, w: 6, h: bottom - top }, th = Math.max(40, tr.h * tr.h / st.pageH), mx = st.pageH - tr.h, tp = tr.y + (tr.h - th) * Math.min(1, st.scroll / Math.max(1, mx));
      ctx.fillStyle = 'rgba(243,230,200,0.14)'; ctx.beginPath(); ctx.roundRect(tr.x, tr.y, tr.w, tr.h, 3); ctx.fill();
      ctx.fillStyle = 'rgba(243,230,200,0.6)'; ctx.beginPath(); ctx.roundRect(tr.x, tp, tr.w, th, 3); ctx.fill();
    }
    if (st.pageH > bottom - top) text('drag to scroll', PG.hint.x, PG.hint.y, 22, 'rgba(243,230,200,0.6)', UI, 600);
    const atMin = st.textScaleIdx === 0, atMax = st.textScaleIdx === TEXT_SCALES.length - 1;
    button(PG.dec, 'A−', { dim: atMin, size: 30 });
    button(PG.inc, 'A+', { dim: atMax, size: 30 });
  }

  // ---------------------------------------------------------------- the Ladder
  function ladder() {
    const LL = L.ladder();
    text('The Ladder', LL.title.x, LL.title.y, fitSize('The Ladder', LL.title.maxW, LL.title.size, FONT, 700, 30), '#f7e8c4', FONT, 700);
    const subTxt = 'Win to climb. Twelve opponents, each a little stronger.';
    let noteY = LL.note.y;
    if (LL.sub.wrap) { const n = wrap(subTxt, LL.sub.x, LL.sub.y, LL.sub.size, LL.sub.maxW, GOLD, LL.sub.size * 1.3, 'center', FONT, 700); noteY = LL.sub.y + n * LL.sub.size * 1.3 + 8; }
    else text(subTxt, LL.sub.x, LL.sub.y, fitSize(subTxt, LL.sub.maxW, LL.sub.size, FONT, 700, 16), GOLD, FONT, 700);
    wrap('On the last two, holding a draw is enough.', LL.note.x, noteY, LL.note.size, LL.note.maxW, 'rgba(243,230,200,0.75)');
    LADDER.forEach((Lr, i) => {
      const r = LL.rows[i], rung = i + 1, open = rung <= st.ladder.top, done = !!st.ladder.beaten[rung], now = rung === st.ladder.top;
      const ts = Math.max(0.72, Math.min(1, r.h / 72));
      plaque(r, now ? { top: 'rgba(38,92,80,0.96)', bot: 'rgba(16,52,46,0.96)' } : open ? {} : { top: 'rgba(12,30,34,0.85)', bot: 'rgba(8,20,24,0.85)' });
      const c = { x: r.x + 46 * ts, y: r.y + r.h / 2 };
      drawStone(ctx, i % 2 ? 2 : 1, c.x, c.y, 26 * ts, { alpha: open ? 1 : 0.35 });
      text(String(rung), c.x, c.y + 8 * ts, 24 * ts, i % 2 ? CREAM : '#4a3a20', UI, 800);
      const tx = r.x + 92 * ts, room = r.w - 92 * ts - 56 * ts;
      const nm = 30 * ts * Math.min(big, 1.06), note = open ? Lr.note : 'Locked: beat the one before.', ns = 20 * ts * Math.min(big, 1.05);
      text(Lr.name, tx, r.y + r.h * 0.43, fitSize(Lr.name, room, nm, FONT, 700, 14), open ? '#f7e8c4' : 'rgba(243,230,200,0.4)', FONT, 700, 'left');
      text(note, tx, r.y + r.h * 0.79, fitSize(note, room, ns, UI, 600, 12), open ? 'rgba(243,230,200,0.8)' : 'rgba(243,230,200,0.35)', UI, 600, 'left');
      if (done) { ring({ x: r.x + r.w - 38 * ts, y: c.y }, 17 * ts, MINT, 3); text('✓', r.x + r.w - 38 * ts, c.y + 8 * ts, 22 * ts, MINT, UI, 800); }
      else if (now) text('play', r.x + r.w - 38 * ts, c.y + 8 * ts, 22 * ts, GOLD, UI, 800);
    });
    const sd = st.side === 0 ? 'Side: alternate' : st.side === 1 ? 'You move first (Shell)' : 'You move second (Greenstone)';
    button(LL.side, sd, { size: 24 });
    button(LL.back, 'Back');
    if (st.msg) { plaque(LL.msg); wrap(st.msg.text, LL.msg.x + LL.msg.w / 2, LL.msg.y + LL.msg.h / 2 + 8 - (LL.msg.h > 70 ? 12 : 0), 24, LL.msg.w - 30); }
  }

  function demoLimit() {
    const D = L.demo();
    within(D.S, () => {
      plaque({ x: 0, y: 0, w: 600, h: 520 });
      text('That is the free preview', 300, 90, 46, '#f7e8c4', FONT, 700);
      wrap('Get the full Mū Tōrere on iPhone or Android for the whole Ladder, every lesson and a new puzzle each day.', 300, 160, 30, 500);
    });
    button(D.back, 'Back');
  }

  // ---------------------------------------------------------------- board scenes: play, lesson, puzzle, over
  function boardScene() {
    const auto = sc === 'auto', D = st.auto;
    const g = auto ? D.game : st.game, a = auto ? D.anim : st.anim;
    // Auto Play's own end state (D.phase === 'over') reuses the exact same "show the winner" glow/
    // dim logic below as the real 'over' scene - both just read g.winner off whichever game `g`
    // already resolved to above.
    const over = sc === 'over' || (auto && D.phase === 'over');
    const PL = L.play(auto ? (D.phase === 'over' ? 'autoover' : 'auto') : sc === 'over' ? 'over' : sc === 'lesson' ? 'lesson' : sc === 'puzzle' ? 'puzzle' : 'play'), B = PL.board;
    // The star and everything on it is drawn in its own design space (centre BX, BY), moved and scaled onto the screen placement B.
    ctx.save(); ctx.translate(B.cx - BX * B.k, B.cy - BY * B.k); ctx.scale(B.k, B.k);
    glowDot({ x: BX, y: BY }, 420, '255,226,176', 0.1 + 0.03 * Math.sin(t * 0.8));
    drawBoard(ctx, BX, BY, 1);
    const me = st.two || sc === 'lesson' || sc === 'puzzle' ? g.turn : st.human;
    const humanTurn = !auto && !g.winner && (st.two || g.turn === st.human || sc === 'lesson' || sc === 'puzzle');
    // highlights under the stones
    const hl = [];
    if (!over && humanTurn && !a && st.sel >= 0) {
      const moves = legalMoves(g.board, g.turn).filter((m) => m.from === st.sel);
      const rated = st.marks ? rate(g.board, g.turn) : null;
      for (const m of moves) { const bad = rated && rated.find((x) => x.m.from === m.from && x.m.to === m.to && x.v === -1); hl.push({ p: m.to, bad: !!bad }); }
    }
    for (const h of hl) { const p = pointPos(h.p); glowDot(p, 92, h.bad ? '255,120,100' : '120,255,190', 0.5 + 0.25 * pulse(3.2)); ring(p, 58 + 3 * pulse(3.2), h.bad ? '#ff9a86' : '#c6ffe0', 5, 1); if (h.bad) text('!', p.x, p.y + 12, 34, '#ffb4a4', UI, 800); }
    if (st.hint) for (const q of [st.hint.from, st.hint.to]) { const p = pointPos(q); glowDot(p, 80, '255,215,120', 0.35 + 0.25 * pulse(4)); ring(p, 58 + 4 * pulse(4), GOLD, 5, 0.95); }
    const LS = sc === 'lesson' ? LESSONS[st.lesson.i].steps[st.lesson.step] : null;
    if (LS && LS.show && !st.lesson.done) for (const q of LS.show) { const p = pointPos(q); ring(p, 62 + 4 * pulse(3), '#fff2c8', 3.5, 0.5 + 0.4 * pulse(3)); }
    if (auto && D.phase === 'reveal') autoReveal(D);
    if (st.kb && !over) ring(pointPos(st.cursor), 64, '#ffffff', 3, 0.9);
    if (g.last && !over && !a) ring(pointPos(g.last.from), 47, 'rgba(255,240,200,0.5)', 2.5, 0.8);
    // winner's glow
    if (over && g.winner && g.winner < 3) for (let i = 0; i < 9; i++) if (g.board[i] === g.winner) glowDot(pointPos(i), 76, '255,230,160', 0.22 + 0.16 * pulse(2.5));
    // stones
    const skip = a ? (a.refuse ? a.from : a.to) : -1, dragging = st.drag && st.drag.moved ? st.drag.from : -1;
    for (let i = 0; i < 9; i++) {
      const k = g.board[i]; if (!k || i === skip || i === dragging) continue;
      const p = pointPos(i), lifted = i === st.sel;
      const dim = over && g.winner && g.winner < 3 && k !== g.winner;
      drawStone(ctx, k, p.x, p.y, STONE_R, { lift: lifted ? 9 + 2 * pulse(4) : 0, alpha: dim ? 0.78 : 1 });
      if (lifted) ring({ x: p.x, y: p.y - 9 }, 54, GOLD, 4, 0.95);
    }
    if (a) {
      const f = pointPos(a.from), tp = pointPos(a.to), e = Math.min(1, a.t / a.dur);
      const s = e * e * (3 - 2 * e);
      let x, y, lift;
      if (a.refuse) { const k = Math.sin(Math.min(1, e) * Math.PI) * 0.42; x = f.x + (tp.x - f.x) * k; y = f.y + (tp.y - f.y) * k; lift = 8; if (e > 0.5 && !st.calm) x += Math.sin(e * 60) * 4 * (1 - e); }
      else { x = f.x + (tp.x - f.x) * s; y = f.y + (tp.y - f.y) * s; lift = Math.sin(s * Math.PI) * 26; }
      drawStone(ctx, a.side, x, y, STONE_R, { lift });
    }
    if (st.drag && st.drag.moved) drawStone(ctx, g.board[st.drag.from], (st.drag.x - (B.cx - BX * B.k)) / B.k, (st.drag.y - (B.cy - BY * B.k)) / B.k - 24, STONE_R * 1.08, { lift: 14 });
    ctx.restore();

    // ---- top area
    if (PL.titleAt) text('Mū Tōrere', PL.titleAt.x, PL.titleAt.y, PL.titleAt.size, '#f7e8c4', FONT, 700);
    within(PL.top, () => {
      if (over) { /* the result panel covers the top */ } else if (auto) autoTop(D); else if (sc === 'lesson') lessonTop(); else if (sc === 'puzzle') puzzleTop(); else playTop();
      if (sc === 'over') overPanel(); else if (auto && D.phase === 'over') autoOverPanel(D);
    });
    // the repeat-position note lives in the button block; it needs the room that only play and puzzle reserve (the phone layout has it for all)
    if (!over && g.seen && (L.mode === 'tall' || sc === 'play' || sc === 'puzzle')) { const n = g.seen[g.board.join('') + g.turn] || 0; if (n >= 2) within(PL.bot, () => { plaque({ x: 150, y: 1246, w: 420, h: 46 }); text(`This position has come up ${n} times. Three is a draw.`, 360, 1277, 21, GOLD, UI, 700); }); }
    if (sc === 'over') overButtons(PL);
    else if (auto && D.phase === 'over') { button(PL.btn.over1, 'Play again (auto)', { primary: true }); button(PL.btn.over2, 'Exit to menu'); }
    else { bottomButtons(PL); if (sc === 'play' || sc === 'puzzle') within(PL.bot, ruleNote); }
  }
  function autoTop(D) {
    const thinkS = AUTO_THINK_STEPS[st.autoThinkIdx];
    const phaseWord = D.phase === 'think' ? 'thinking' : D.phase === 'reveal' ? 'about to act' : 'playing';
    plaque({ x: 40, y: 184, w: 640, h: 210 });
    text('Auto Play · Watch & Learn', 360, 216, 22, GOLD, UI, 700);
    drawStone(ctx, D.game.turn, 96, 260, 27);
    text(D.paused ? 'Paused' : `${SIDE_NAME[D.game.turn]} is ${phaseWord}`, 142, 258, 30 * Math.min(big, 1.06), '#f7e8c4', FONT, 700, 'left');
    const sub = D.phase === 'think' ? 'THINK: work out your own answer before it is revealed.' : D.phase === 'reveal' ? 'REVEAL: the highlighted move is the one about to be played.' : 'ACT: watch it play out.';
    text(sub, 142, 286, 18, 'rgba(243,230,200,0.8)', UI, 600, 'left');
    text(`Think time: ${thinkS}s (max 10s)`, 360, 360, 22, GOLD, UI, 600);
  }
  function autoOverPanel(D) {
    const g = D.game, w = g.winner, draw = w === 3;
    plaque({ x: 40, y: 176, w: 640, h: 300 }, { top: 'rgba(24,62,56,0.99)', bot: 'rgba(10,32,32,0.99)' });
    band(ctx, 170, 550, 214, 10, 'rgba(232,199,119,0.6)', 2.4);
    const title = draw ? 'A draw' : `${SIDE_NAME[w]} wins`, why = draw ? 'The same position came up three times.' : `${SIDE_NAME[other(w)]} has no legal move.`;
    text(title, 360, 296, 66, '#f7e8c4', FONT, 700);
    wrap(why, 360, 350, 26 * big, 580, CREAM, 26 * big * 1.3);
    wrap('A full Auto Play demonstration just finished. Nothing here was saved.', 360, 440, 24, 580, MINT, 30);
  }
  function ruleNote() {
    plaque({ x: 60, y: 1330, w: 600, h: 96 });
    drawStone(ctx, 1, 108, 1378, 24); ctx.save(); ctx.strokeStyle = MINT; ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(160, 1378, 22, 0, TAU); ctx.stroke(); ctx.restore();
    wrap('The putahi (centre) can be entered only from a point beside an enemy stone.', 410, 1372, 22, 400, CREAM, 28, 'center');
  }
  function turnBar(label, sub, side) {
    plaque({ x: 40, y: 184, w: 640, h: 84 });
    if (side) drawStone(ctx, side, 96, 226, 27);
    text(label, side ? 142 : 70, 224, 32 * Math.min(big, 1.06), '#f7e8c4', FONT, 700, 'left');
    if (sub) text(sub, side ? 142 : 70, 252, 21, 'rgba(243,230,200,0.75)', UI, 600, 'left');
  }
  function msgBox(defaultText) {
    const s = st.msg ? st.msg.text : defaultText; if (!s) return;
    plaque({ x: 40, y: 286, w: 640, h: 118 }, st.msg ? { top: 'rgba(38,26,12,0.95)', bot: 'rgba(24,14,6,0.95)' } : {});
    const size = 26 * big, n = Math.ceil(String(s).length * size * 0.5 / 590); wrap(s, 360, 286 + 59 - (Math.max(1, Math.min(3, n)) - 1) * size * 0.66 + size * 0.34, size, 590);
  }
  function playTop() {
    const g = st.game, mine = st.two ? null : st.human;
    if (g.winner) turnBar('Game over', st.two ? '' : `You are ${SIDE_NAME[st.human]}`, mine);
    else if (st.two) turnBar(`${SIDE_NAME[g.turn]} to move`, 'Pass the phone after each move', g.turn);
    else if (g.turn === st.human) turnBar('Your move', `You are ${SIDE_NAME[st.human]}  ·  vs ${LADDER[st.rung - 1].name}`, g.turn);
    else turnBar(st.think > 0 || !st.anim ? `${LADDER[st.rung - 1].name} is thinking${'.'.repeat(1 + (Math.floor(t * 2.5) % 3))}` : 'Moving…', `vs ${LADDER[st.rung - 1].name}, rung ${st.rung}`, g.turn);
    msgBox(st.two || g.turn === st.human ? 'TAP a stone, then TAP a glowing point. Or DRAG it.' : '');
  }
  function lessonTop() {
    const l = LESSONS[st.lesson.i], step = l.steps[st.lesson.step];
    const size = 27 * big, shown = st.lesson.done ? (st.lesson.doneText || 'Well done.') : step.text;
    ctx.font = `600 ${size}px ${UI}`; let n = 1, cur = '';
    for (const w of shown.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 600 && cur) { n++; cur = w; } else cur = t2; }
    const h = 84 + n * size * 1.32;
    plaque({ x: 30, y: 176, w: 660, h });
    text(`Lesson ${st.lesson.i + 1} of ${LESSONS.length}: ${l.title}`, 360, 222, 32, GOLD, FONT, 700);
    wrap(shown, 360, 268, size, 600, CREAM, size * 1.32);
    if (st.msg) { const y = 176 + h + 10; plaque({ x: 40, y, w: 640, h: 112 }, { top: 'rgba(38,26,12,0.95)', bot: 'rgba(24,14,6,0.95)' }); const s2 = 23 * big; wrap(st.msg.text, 360, y + 42, s2, 600, CREAM, s2 * 1.25); }
  }
  function puzzleTop() {
    const P = st.pz;
    if (!P || !P.p) { plaque({ x: 40, y: 184, w: 640, h: 84 }); text('Setting up today\'s puzzle…', 360, 236, 30, CREAM); return; }
    const g = st.game;
    turnBar(`Daily puzzle: win in ${movesToWin(P.p)}`, `You are ${SIDE_NAME[P.p.turn]}  ·  ${P.status === 'solved' ? 'solved' : 'find the move that traps them'}`, P.p.turn);
    msgBox(P.status === 'solved' ? 'Solved! Come back tomorrow for a new one.' : g.winner ? '' : 'TAP a stone, then TAP a glowing point.');
  }
  function bottomButtons(PL) {
    const BTN = PL.btn;
    if (sc === 'auto') {
      const atMin = st.autoThinkIdx === 0, atMax = st.autoThinkIdx === AUTO_THINK_STEPS.length - 1;
      button(BTN.dec, '−', { dim: atMin, size: 30 }); button(BTN.inc, '+', { dim: atMax, size: 30 });
    }
    button(BTN.menu, sc === 'auto' ? 'Exit' : 'Menu', { size: 27 });
    if (sc === 'auto') { button(BTN.undo, 'Skip wait', { size: 27, dim: st.auto.phase === 'act' || st.auto.paused }); button(BTN.hint, st.auto.paused ? 'Resume' : 'Pause', { size: 27, primary: st.auto.paused }); return; }
    if (sc === 'lesson') { if (st.lesson.done) button(BTN.cont, st.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true }); else button(BTN.undo, 'Restart', { size: 27 }); }
    else if (sc === 'puzzle') button(BTN.hint, st.hintsLeft > 0 ? `Hint (${st.hintsLeft})` : 'Hint', { size: 27, dim: st.hintsLeft <= 0 });
    else { button(BTN.undo, 'Take back', { size: 27, dim: !st.undo.length }); if (!st.two) button(BTN.hint, `Hint (${st.hintsLeft})`, { size: 27, dim: st.hintsLeft <= 0 }); }
    if (sc === 'puzzle' && st.pz && st.pz.status === 'solved') button(BTN.cont, 'Share result', { primary: true });
  }
  function overPanel() {
    const R = st.result; plaque({ x: 40, y: 176, w: 640, h: 330 }, { top: 'rgba(24,62,56,0.99)', bot: 'rgba(10,32,32,0.99)' });
    band(ctx, 170, 550, 214, 10, 'rgba(232,199,119,0.6)', 2.4);
    text(R.title, 360, 296, 66, '#f7e8c4', FONT, 700);
    wrap(R.why, 360, 350, 26 * big, 580, CREAM, 26 * big * 1.3);
    if (R.extra) wrap(R.extra, 360, 440, 24, 580, MINT, 30);
    drawMoreLine(ctx, 360, 490, 18);          // a quiet pointer to the other heritage games, text only
  }
  function overButtons(PL) { st.result.btns.forEach((b, i) => button([PL.btn.over1, PL.btn.over2, PL.btn.over3][i], b.label, { primary: i === 0 })); }
}
