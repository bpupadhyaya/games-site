// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The table, board and pebble sprites are cached (art.js).
import { W, H, RX, RY, TRAY, MID_Y, BTN, AUTO_BTN, SET, RULES_BTN, ABOUT_BTN, HEADER, TEXT_SCALES, THINK_STEPS, pitPos, trayPos, titleRows } from './layout.js';
import { drawTable, drawBoard, drawSeed, drawShanyrak, horn, slot, WOODS, SEEDSETS } from './art.js';
import { legalMoves, numberOf } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT } from './about.js';
import { RULES } from './rulesText.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const CREAM = '#f8e9c4', GOLD = '#f2c56b', MADDER = '#b4432c', TEAL = '#23918c';
const OWNER = [MADDER, TEAL];

export function render(ctx, state) {
  const scene = state.scene, big = state.big, g = state.game, A = state.anim;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'puzzle';

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
    if (shadow) { ctx.fillStyle = 'rgba(8,10,30,0.6)'; ctx.fillText(str, x + 1.5, y + 2.5); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  // A one-line headline never wraps or clips - it shrinks to fit maxW instead. Needed because the
  // end-game headline ("The computer wins" / "Player two wins") is far wider at the same font size
  // than the short strings ("You win!", "A draw") it was originally sized around, and used to run
  // off both edges of the canvas.
  const fitText = (str, x, y, maxSize, maxW, color = CREAM, font = FONT, weight = 700) => {
    ctx.font = `${weight} ${maxSize}px ${font}`;
    const w = ctx.measureText(str).width;
    const size = w > maxW ? Math.floor(maxSize * (maxW / w) * 0.98) : maxSize;
    text(str, x, y, size, color, font, weight);
  };
  // Word-wraps to maxW. At the highest text-size steps a single long hyphenated word (e.g.
  // "counter-clockwise") can be wider than maxW all on its own - with no space to break on, it
  // used to run straight off the canvas edge. Falls back to a character-level break for just that
  // one word so it wraps like any other overflowing line, instead of clipping.
  const lines = (str, maxW, size, weight = 600) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) {
      if (ctx.measureText(w).width > maxW) {
        if (cur) { out.push(cur); cur = ''; }
        let piece = '';
        for (const ch of w) { const t2 = piece + ch; if (ctx.measureText(t2).width > maxW && piece) { out.push(piece); piece = ch; } else piece = t2; }
        cur = piece;
        continue;
      }
      const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2;
    }
    out.push(cur); return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.3, align = 'center') => { const L = lines(str, maxW, size); L.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return L.length; };
  // a crafted button: dark walnut with a felt inlay and a stitched ochre edge; the main action is gold leaf
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(4,6,20,0.5)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 7, r.w, r.h, 20); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#fbdc8c'); gr.addColorStop(0.55, '#dea23a'); gr.addColorStop(1, '#a86a1c'); } else { gr.addColorStop(0, '#6a4127'); gr.addColorStop(0.5, '#47281a'); gr.addColorStop(1, '#2d180d'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 20); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.9)' : 'rgba(242,197,107,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.save(); ctx.setLineDash([7, 5]); ctx.strokeStyle = o.primary ? 'rgba(90,50,10,0.55)' : 'rgba(242,197,107,0.4)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(r.x + 7, r.y + 7, r.w - 14, r.h - 14, 14); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 4, r.y + 3, r.w - 8, r.h * 0.4, 16); ctx.stroke();
    const sz = o.size ?? 30;
    ctx.textAlign = 'center'; ctx.font = `700 ${sz}px ${UI}`;
    ctx.fillStyle = o.primary ? 'rgba(255,240,200,0.5)' : 'rgba(0,0,0,0.55)'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36 + 1.5);
    ctx.fillStyle = o.primary ? '#2a1606' : CREAM; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.36);
    ctx.restore();
  };
  const panel = (x, y, w, h, alpha = 0.86) => {
    ctx.save(); ctx.fillStyle = `rgba(14,16,38,${alpha})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(242,197,107,0.8)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(242,197,107,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 16); ctx.stroke(); ctx.restore();
    ctx.restore();
  };
  const ellipseGlow = (i, rgb, a) => {
    const p = pitPos(i), gr = ctx.createRadialGradient(p.x, p.y, RX * 0.5, p.x, p.y, RY + 22);
    gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.7, `rgba(${rgb},${0.5 * a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(p.x, p.y, RX + 20, RY + 20, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(${rgb},${0.9 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(p.x, p.y, RX + 3, RY + 3, 0, 0, TAU); ctx.stroke();
  };
  // the tuz marker: a felt inlay in its owner's colour with a small carved flag standing in the pit
  const tuzMarker = (pit, owner, raise = 1) => {
    const p = pitPos(pit), w = state.calm ? 0 : Math.sin(state.t * 3 + pit) * 2.5;
    ctx.fillStyle = owner === 0 ? 'rgba(180,67,44,0.62)' : 'rgba(35,145,140,0.62)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, RX - 4, RY - 4, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(248,233,196,0.85)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(p.x, p.y, RX - 8, RY - 8, 0, 0, TAU); ctx.stroke(); ctx.restore();
    const bx = p.x - 3, by = p.y + 20, top = by - 46 * raise;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(bx + 5, by + 2, 11, 4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a170b'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, top); ctx.stroke();
    ctx.strokeStyle = '#a97a4a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(bx - 0.8, by); ctx.lineTo(bx - 0.8, top); ctx.stroke();
    ctx.fillStyle = OWNER[owner]; ctx.strokeStyle = '#f8e9c4'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(bx + 1, top + 1); ctx.quadraticCurveTo(bx + 14, top + 3 + w, bx + 25, top + 8 + w); ctx.quadraticCurveTo(bx + 14, top + 13 + w, bx + 1, top + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2c56b'; ctx.beginPath(); ctx.arc(bx, top - 1, 3.2, 0, TAU); ctx.fill();
  };
  const kazanPile = (pl, n) => {
    const T = pl === 0 ? TRAY.bottom : TRAY.top, cx = T.x + 408, cy = T.y + T.h / 2 + 2;
    for (let k = 0; k < n; k++) {
      const r = Math.min(9.2 * Math.sqrt(k + 0.5), 91), a = k * 2.399963 + pl;
      drawSeed(ctx, state.seeds, (k * 3 + pl) % 4, cx + Math.cos(a) * r * 1.95, cy + Math.sin(a) * r * 0.5, ((k * 97) % 360) * Math.PI / 180, 0.8);
    }
  };

  // ---- the board and what is in it (used full size, and small on the title) --------------------------------------
  function contents(sh, opts = {}) {
    const set = state.seeds, pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    const legal = opts.legal || [];
    for (const i of legal) ellipseGlow(i, '255,222,120', 0.5 + pulse * 0.5);
    if (state.hint && !A) ellipseGlow(state.hint.pit, '130,255,170', 0.6 + pulse * 0.4);
    if (A && A.phase === 'capwait') { const c = A.r.tuzMade >= 0 ? A.r.tuzMade : A.r.last; ellipseGlow(c, '255,190,80', 0.5 + Math.abs(Math.sin(A.timer * 14)) * 0.5); }
    // tuz markers (shown state, so a new one appears when it is won)
    for (const pl of [0, 1]) if (sh.tuz[pl] >= 0) tuzMarker(sh.tuz[pl], pl, pl === A?.flagOwner ? Math.min(1, A.flagT) : 1);
    for (let i = 0; i < 18; i++) {
      const p = pitPos(i), n = sh.pits[i]; if (n <= 0) continue;
      if (A && A.phase === 'cap' && (A.r.capture > 0 ? A.r.last : A.r.tuzMade) === i) continue;
      let dx = 0;
      if (state.ref && state.ref.pit === i && !state.calm) dx = Math.sin(state.ref.t * 60) * 5 * (1 - state.ref.t / 0.6);
      for (let k = 0; k < n; k++) {
        const s = slot(i, k); let oy = 0;
        if (A && A.lastDrop === i && k === n - 1 && A.dropT < 0.14 && !state.calm) oy = -9 * (1 - A.dropT / 0.14);
        drawSeed(ctx, set, s.v, p.x + s.x + dx, p.y + s.y + oy, s.rot, 0.95);
      }
    }
    if (state.ref && !A) { const p = pitPos(state.ref.pit); ctx.strokeStyle = `rgba(255,120,90,${0.9 * (1 - state.ref.t / 0.6)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(p.x, p.y, RX + 4, RY + 4, 0, 0, TAU); ctx.stroke(); }
    if (opts.counts !== false) for (let i = 0; i < 18; i++) {
      const p = pitPos(i), n = sh.pits[i], top = i >= 9;
      // carved pit number on the middle side, the pebble count on the outer side
      const ny = top ? p.y + RY + 20 : p.y - RY - 8;
      ctx.textAlign = 'center'; ctx.font = `700 ${big ? 17 : 15}px ${FONT}`; ctx.fillStyle = 'rgba(20,8,2,0.55)'; ctx.fillText(String(numberOf(i)), p.x + 0.8, ny + 1.2); ctx.fillStyle = 'rgba(255,226,170,0.8)'; ctx.fillText(String(numberOf(i)), p.x, ny);
      if (n <= 0) continue;
      const y = top ? p.y - RY - (big ? 12 : 10) : p.y + RY + (big ? 32 : 28), sz = big ? 32 : 26;
      ctx.font = `800 ${sz}px ${UI}`; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,12,2,0.88)'; ctx.strokeText(String(n), p.x, y); ctx.fillStyle = '#ffedc4'; ctx.fillText(String(n), p.x, y);
    }
    // kazans
    for (const pl of [0, 1]) {
      const T = pl === 0 ? TRAY.bottom : TRAY.top, n = sh.kazan[pl];
      kazanPile(pl, n);
      const label = opts.labels ? opts.labels[pl] : pl === 0 ? 'You' : 'Computer';
      if (opts.counts !== false) {
        text(label, T.x + 30, T.y + 38, big ? 27 : 23, CREAM, UI, 700, 'left');
        text(String(n), T.x + 30, T.y + 96, big ? 58 : 52, GOLD, FONT, 700, 'left');
        const tz = sh.tuz[pl];
        text(tz >= 0 ? `Tuz: pit ${numberOf(tz)}` : 'No tuz yet', T.x + 200, T.y + 38, 20, tz >= 0 ? '#ffe9b0' : 'rgba(248,233,196,0.55)', UI, 600, 'left');
      }
    }
  }

  // a cropped, zoomed-in window onto the REAL board: draws the actual drawBoard()/contents() used during play,
  // scaled and clipped to a small box, focused on one point - never a separate simplified icon for the Rules page.
  const artBox = (focus, scale, box, sh, opts = {}) => {
    ctx.save();
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 26); ctx.clip();
    ctx.fillStyle = '#100d1c'; ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.translate(box.x + box.w / 2 - focus.x * scale, box.y + box.h / 2 - focus.y * scale);
    ctx.scale(scale, scale);
    drawBoard(ctx, state.wood);
    contents(sh, opts);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(242,197,107,0.7)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 26); ctx.stroke(); ctx.restore();
  };

  // ---- table -----------------------------------------------------------------------------------------------------
  drawTable(ctx);

  if (boardScene) {
    drawBoard(ctx, state.wood);
    if (scene === 'lesson') {
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, 360, 160, 26, 'rgba(248,233,196,0.85)', UI, 600);
      text(LESSONS[state.lesson.i].title, 360, 235, 62, CREAM, FONT);
    } else if (scene === 'puzzle') {
      text('Daily puzzle' + (state.pz.puzzle.hard ? ' (weekend)' : ''), 360, 160, 26, 'rgba(248,233,196,0.85)', UI, 600);
      text('Take the most', 360, 235, 62, CREAM, FONT);
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 360, 285, 24, GOLD, UI, 600);
    } else if (state.autoMode) {
      // While a move is animating, `g.turn` has already flipped to the NEXT mover (rules.js
      // applyMove flips it synchronously, before the animation plays) - so without this, the
      // side label would jump to the other row a full animation early, mid-sow. Read whose move
      // is actually on screen from the animation itself (A.r.player) instead.
      const mover = A ? A.r.player : g.turn;
      // Paused freezes literally everything about this game (game.js updatePlay/update), including
      // the dots-cycling "thinking..." animation - so the header must say so plainly instead of
      // still animating a phase that, underneath, is not actually progressing.
      const phase = state.autoPaused ? '- paused' : A ? 'is sowing' : state.autoPhase === 'reveal' ? '- this is the move' : 'thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
      const line = g.winner !== null ? 'Game over' : `${mover === 0 ? 'Bottom row' : 'Top row'} ${phase}`;
      text(line, 360, 180, 58, CREAM, FONT);
      text(`Auto Play · think time ${THINK_STEPS[state.autoThinkIdx]}s`, 360, 226, 21, 'rgba(248,233,196,0.85)', UI, 500);
      text('First to collect 82 of the 162 pebbles wins', 360, 268, 22, GOLD, UI, 600);
    } else {
      // Same fix as Auto Play above: use the animating move's real player, not the already-flipped
      // `g.turn`, so the header never announces the next mover before this move finishes animating.
      const mover = A ? A.r.player : g.turn;
      const th = state.thinking && !A ? 'The computer is thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : null;
      const line = g.winner !== null ? 'Game over' : state.two ? (mover === 0 ? 'Player one: bottom row' : 'Player two: top row') : mover === 0 ? 'Your move' : (th || 'The computer moves');
      text(line, 360, 180, 58, CREAM, FONT);
      text(state.two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name} · ${LEVELS[state.level].blurb}`, 360, 226, 21, 'rgba(248,233,196,0.85)', UI, 500);
      text('First to collect 82 of the 162 pebbles wins', 360, 268, 22, GOLD, UI, 600);
    }
    let legal = [];
    if (!A && g.winner === null && (scene === 'play' ? (state.two || g.turn === 0) : scene === 'lesson' ? !state.lesson.done && !state.lesson.wait : (state.pz.status !== 'solved' && state.pz.wrong <= 0))) {
      legal = scene === 'lesson' ? LESSONS[state.lesson.i].want.concat(LESSONS[state.lesson.i].trap ? [LESSONS[state.lesson.i].trap.pit] : []).filter((p) => legalMoves(g).includes(p)) : legalMoves(g);
    }
    // a moving chevron along the carved arrows: the direction of sowing
    if (!state.calm) { const f = (state.t * 0.5) % 1; for (const [y, d] of [[MID_Y - 40, -1], [MID_Y + 40, 1]]) { const x = d > 0 ? 190 + 340 * f : 530 - 340 * f; ctx.strokeStyle = `rgba(255,214,120,${0.9 * Math.sin(Math.PI * f)})`; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - d * 9, y - 9); ctx.lineTo(x + d * 9, y); ctx.lineTo(x - d * 9, y + 9); ctx.stroke(); } }
    contents(state.shown, { legal, labels: scene === 'lesson' || scene === 'puzzle' ? ['You', 'Opponent'] : state.two || state.autoMode ? ['Player one', 'Player two'] : ['You', 'Computer'] });
    if (state.kb && scene !== 'over') { const p = pitPos(g.turn === 0 ? state.cursor : 17 - state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(p.x, p.y, RX + 6, RY + 6, 0, 0, TAU); ctx.stroke(); }
    if (A) {
      const r = A.r, o = pitPos(r.pit);
      if (A.phase === 'lift' || A.phase === 'sow') {
        let x, y, gy, hop = 0;
        if (A.phase === 'lift') { const f = Math.min(1, A.timer / Math.max(0.01, state.calm ? 0.11 : 0.22)); x = o.x; gy = o.y; y = o.y - 34 * f; }
        else {
          const from = A.idx === 0 ? o : pitPos(r.path[A.idx - 1]), to = pitPos(r.path[Math.min(A.idx, r.path.length - 1)]), f = Math.min(1, A.timer / A.sd), e = f * f * (3 - 2 * f);
          x = from.x + (to.x - from.x) * e; gy = from.y + (to.y - from.y) * e; hop = state.calm ? 0 : Math.sin(Math.PI * f) * 26; y = gy - 34 - hop;
        }
        ctx.fillStyle = 'rgba(8,4,0,0.32)'; ctx.beginPath(); ctx.ellipse(x + 6, gy + 12, 26 - hop * 0.15, 11, 0, 0, TAU); ctx.fill();
        const n = Math.min(A.n, 9);
        for (let k = 0; k < n; k++) { const s = slot(99, k, 22, 14); drawSeed(ctx, state.seeds, s.v, x + s.x, y + s.y, s.rot, 0.9); }
        if (A.n > 0) { ctx.fillStyle = 'rgba(20,14,30,0.92)'; ctx.beginPath(); ctx.arc(x + 26, y - 22, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 2; ctx.stroke(); text(String(A.n), x + 26, y - 15, 20, '#ffe9b0', UI, 800, 'center', false); }
      }
      if (A.phase === 'cap') {
        const c = r.capture > 0 ? r.last : r.tuzMade, p = pitPos(c), T = trayPos(r.player), f = Math.min(1, A.timer / Math.max(0.01, state.calm ? 0.17 : 0.34)), e = f * f * (3 - 2 * f);
        const cnt = r.capture > 0 ? r.capture : 3;
        for (let k = 0; k < cnt; k++) { const s = slot(c, k), x = p.x + s.x + (T.x + 100 - p.x - s.x) * e, y = p.y + s.y + (T.y - p.y - s.y) * e - Math.sin(Math.PI * e) * 70; drawSeed(ctx, state.seeds, s.v, x, y, s.rot + e * 6, 0.86 + 0.15 * Math.sin(Math.PI * e)); }
        if (!state.calm) { ctx.strokeStyle = `rgba(255,214,120,${0.85 * (1 - f)})`; ctx.lineWidth = 7 * (1 - f) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y, RX * (0.8 + 0.9 * f), RY * (0.8 + 0.9 * f), 0, 0, TAU); ctx.stroke(); }
        text(`+${cnt}`, p.x, p.y - 50 - f * 30, 34, `rgba(255,224,130,${1 - f * 0.6})`, FONT, 700);
      }
      if (A.phase === 'sow' && A.tuzFlash) { const p = pitPos(A.tuzFlash.pit), f = Math.min(1, A.tuzFlash.t / 0.5); text('+1', p.x, p.y - 30 - f * 28, 30, `rgba(255,224,130,${1 - f})`, FONT, 700); }
      if (A.phase === 'end' && r.tuzBlocked && A.timer < 2) { /* explained in the message panel */ }
    }
    if (state.msg && scene !== 'over') {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
      let ms = big ? 34 : 28, L = lines(state.msg.text, 620, ms);
      while (L.length * ms * 1.28 > 104 && ms > 18) { ms -= 2; L = lines(state.msg.text, 620, ms); }
      ctx.save(); ctx.globalAlpha = Math.max(0, al); panel(40, 1180, 640, 128, 0.9);
      const top = 1180 + 64 - (L.length * ms * 1.28) / 2 + ms * 0.95; L.forEach((ln, i) => text(ln, 360, top + i * ms * 1.28, ms, '#fff3d6', UI, 600, 'center', false));
      ctx.restore();
    } else if (scene === 'lesson' && !state.lesson.done && !state.anim && !state.lesson.wait) {
      const tx = LESSONS[state.lesson.i].text; let ms = big ? 34 : 28, L = lines(tx, 620, ms);
      while (L.length * ms * 1.28 > 108 && ms > 18) { ms -= 2; L = lines(tx, 620, ms); }
      panel(40, 1180, 640, 128, 0.9); const top = 1180 + 64 - (L.length * ms * 1.28) / 2 + ms * 0.95; L.forEach((ln, i) => text(ln, 360, top + i * ms * 1.28, ms, '#fff3d6', UI, 600, 'center', false));
    }
    if (scene === 'play') {
      if (state.autoMode) {
        // Auto Play's own 4-slot rail (AUTO_BTN, layout.js): Exit, Pause/Resume, then the
        // think-time stepper. Pause is its own dedicated button, not folded into Exit, since it
        // must stay reachable and legible independent of it.
        button(AUTO_BTN.exit, 'Exit', { size: 24 });
        button(AUTO_BTN.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 24, primary: state.autoPaused });
        button(AUTO_BTN.dec, '− Think', { size: 22, dim: state.autoThinkIdx <= 0 });
        button(AUTO_BTN.inc, 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
      } else {
        button(BTN.menu, 'Menu', { size: 28 });
        button(BTN.undo, 'Undo', { size: 28 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 28, dim: state.hintsLeft <= 0 });
      }
    }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 28 }); if (state.lesson.done && !A) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 28 }); if (state.pz.status === 'solved' && !A) button(BTN.share, 'Share result', { primary: true, size: 30 }); }
    if (scene === 'play' && state.dev) text('DEV', 40, 130, 20, '#7dff9a', UI, 700, 'left');
  }

  if (scene === 'title' || scene === 'demo-limit') {
    // the crown of a yurt turns slowly behind the name; a real board sits below with a light running along the sowing path
    drawShanyrak(ctx, 360, 205, 190, state.calm ? 0 : state.t * 0.05, 0.3);
    ctx.save(); ctx.translate(360, 82); ctx.scale(0.68, 0.68); ctx.translate(-360, 0);
    drawBoard(ctx, state.wood);
    const idle = { pits: new Array(18).fill(9), kazan: [0, 0], tuz: [-1, -1] };
    contents(idle, { counts: false });
    if (!state.calm) { const f = (state.t * 3.2) % 18; for (let d = 0; d < 4; d++) { const i = Math.floor(f + 18 - d) % 18, a = 0.7 - d * 0.18; ellipseGlow(i, '255,214,120', Math.max(0.05, a)); } }
    ctx.restore();
    text('Toguz Kumalak', 360, 205, 104, CREAM, FONT);
    horn(ctx, 360, 250, 14, GOLD, 2.4);
    text('The nine-pebble game of the steppe', 360, 296, 27, 'rgba(248,233,196,0.92)', FONT, 500);
  }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solved = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 32 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 32 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 32 });
    button(R.two, 'Two players, one phone', { size: 30 });
    button(R.daily, solved ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 30 });
    button(R.about, 'About', { size: 26 }); button(R.rules, 'Rules', { size: 26 }); button(R.settings, 'Settings', { size: 26 });
    button(R.auto, 'Auto Play · Watch & Learn', { size: 28 });
    // Positioned off the new Auto Play row above (not a fixed number). A transient message takes
    // priority over the games/badges flourish when both would land in the same spot (the message is
    // never up for long); the flourish itself is skipped entirely if the tallest shape of this list
    // (a saved game, pushing everything down) leaves no safe room, rather than ever risking it
    // clipping off the canvas.
    const y = R.auto.y + R.auto.h + 30;
    if (state.msg) wrap(state.msg.text, 360, y, 24, 620, '#ffe9b0');
    else if (y + 38 <= H - 40) {
      text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, y, 22, 'rgba(248,233,196,0.85)', UI, 500);
      let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
      text(stars.trim(), 360, y + 38, 30, GOLD, UI, 700);
    }
  } else if (scene === 'demo-limit') {
    panel(60, 800, 600, 380, 0.9);
    text('That was the free taste.', 360, 920, 56, CREAM, FONT);
    text('Get Toguz Kumalak on iPhone and Android', 360, 1010, 26, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1052, 28, '#fff3d6', UI, 600);
  } else if (scene === 'settings') {
    panel(40, 130, 640, 1130, 0.55);
    text('Settings', 360, 230, 70, CREAM, FONT);
    const lv = LEVELS[state.level];
    button(SET.level, `Computer level: ${lv.name}`, { size: 30 });
    button(SET.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: 30 });
    button(SET.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 30 });
    button(SET.big, state.big ? 'Large text: on' : 'Large text: off', { size: 30 });
    button(SET.seeds, `Pieces: ${SEEDSETS[state.seeds]}`, { size: 30 });
    button(SET.wood, `Board: ${WOODS[state.wood].name}`, { size: 30 });
    wrap(lv.blurb, 360, 980, 26, 600, '#ffe9b0');
    for (let k = 0; k < 9; k++) drawSeed(ctx, state.seeds, k % 4, 210 + k * 38, 1090, k * 0.7, 1.3);
    button(SET.back, 'Back', { primary: true, size: 32 });
  } else if (scene === 'about') {
    // A dedicated text-size stepper (index into TEXT_SCALES, never a raw float, guarded + clamped on
    // load in game.js) lives right on this reference page, in the header row above the panel - not
    // buried in Settings - since this is the page players actually read. It is independent of the
    // `big` gameplay toggle (pit/tray/message text during play), which is untouched.
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const page = ABOUT.pages[state.page % ABOUT.pages.length];
    panel(36, 120, 648, 1240, 0.92);
    text(ABOUT.title, 360, 210, Math.round(60 * Math.min(scale, 1.15)), CREAM, FONT);
    horn(ctx, 360, 246, 12, GOLD, 2.2);
    text(page.title, 360, 304, Math.round(32 * Math.min(scale, 1.15)), GOLD, FONT, 700);
    let y = 356;
    const bodySize = Math.round(29 * scale), lh = Math.round(bodySize * 1.4);
    // Same fix as the Rules page below (see its own comment): the fixed 356 gap only clears the
    // title above it at the body font's 1x ascent, so push it down by however much taller this
    // step's ascent has grown.
    ctx.font = `600 ${bodySize}px ${UI}`;
    const bodyAscent = ctx.measureText('Ag').actualBoundingBoxAscent || bodySize * 0.78;
    ctx.font = `600 29px ${UI}`;
    const baseAscent = ctx.measureText('Ag').actualBoundingBoxAscent || 29 * 0.78;
    y += Math.max(0, bodyAscent - baseAscent);
    // Center a short page's text block in the remaining panel space instead of always pinning it
    // to the top - most About facts are one short sentence, and top-anchoring left the panel
    // mostly empty below them. Measured against the real wrap, so a page that already fills the
    // panel at this scale (every page was verified not to overflow up to 300%, see STATUS.md)
    // gets zero offset and renders exactly as before - never risks pushing text past the footer.
    let aboutBlockH = 0;
    for (const para of page.lines) aboutBlockH += lines(para, 580, bodySize).length * lh + 22;
    aboutBlockH = Math.max(0, aboutBlockH - 22);
    y += Math.max(0, (1300 - y - aboutBlockH) / 2);
    for (const para of page.lines) { const n = wrap(para, 70, y, bodySize, 580, '#fff3d6', lh, 'left'); y += n * lh + 22; }
    text(`Page ${(state.page % ABOUT.pages.length) + 1} of ${ABOUT.pages.length}`, 360, 1345, 19, 'rgba(248,233,196,0.6)', UI, 600);
    button(ABOUT_BTN.back, 'Back', { size: 30 });
    button(ABOUT_BTN.next, 'Next', { primary: true, size: 30 });
    button(HEADER.textDec, 'A−', { size: 34, dim: state.textScaleIdx === 0 });
    button(HEADER.textInc, 'A+', { size: 34, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
  } else if (scene === 'rules') {
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    const page = RULES[state.page % RULES.length];
    panel(36, 120, 648, 1240, 0.92);
    text('Rules', 360, 176, 26, 'rgba(248,233,196,0.85)', UI, 600);
    text(page.title, 360, 232, Math.round(40 * Math.min(scale, 1.15)), CREAM, FONT);
    horn(ctx, 360, 264, 12, GOLD, 2.2);
    let y = 300;
    const box = { x: 110, y: 300, w: 500, h: 260 };
    // the real in-game pit/kazan/tuz art, cropped and zoomed from the actual board - never a separate icon
    if (page.art === 'pit') {
      artBox(pitPos(4), 2.4, box, { pits: Array.from({ length: 18 }, (_, i) => (i === 4 ? 5 : 9)), kazan: [0, 0], tuz: [-1, -1] }, { legal: [4], counts: false });
      y = box.y + box.h + 34;
    } else if (page.art === 'kazan') {
      artBox(trayPos(0), 1.15, box, { pits: new Array(18).fill(0), kazan: [23, 0], tuz: [-1, -1] }, { counts: true, labels: ['You', 'Computer'] });
      y = box.y + box.h + 34;
    } else if (page.art === 'tuz') {
      artBox({ x: pitPos(12).x, y: pitPos(12).y - 30 }, 2, box, { pits: Array.from({ length: 18 }, (_, i) => (i === 12 ? 0 : 9)), kazan: [0, 0], tuz: [12, -1] }, { counts: false });
      y = box.y + box.h + 34;
    }
    const bodySize = Math.round(29 * scale), lh = Math.round(bodySize * 1.4);
    // `y` above (300 for a plain page, or just under the art box) was measured against the body
    // font at the 1x step, where its ascent barely clears the title/horn or the art above it. That
    // ascent grows with the text-size stepper, and a fixed gap doesn't - confirmed on a real 300%
    // screenshot, where the first body line's own ascent climbed back up through the horn glyph
    // and grazed the page title above it. Push the start down by exactly how much taller this
    // step's ascent is than the 1x baseline, so the clearance that was tuned at 1x holds at every step.
    ctx.font = `600 ${bodySize}px ${UI}`;
    const bodyAscent = ctx.measureText('Ag').actualBoundingBoxAscent || bodySize * 0.78;
    ctx.font = `600 29px ${UI}`;
    const baseAscent = ctx.measureText('Ag').actualBoundingBoxAscent || 29 * 0.78;
    y += Math.max(0, bodyAscent - baseAscent);
    // Center a short page's text block in the remaining panel space (see About's identical fix,
    // same reasoning) - a no-op on any page whose content already fills the space up to 300%.
    let rulesBlockH = 0;
    for (const para of page.lines) rulesBlockH += lines(para, 580, bodySize).length * lh + 18;
    rulesBlockH = Math.max(0, rulesBlockH - 18);
    y += Math.max(0, (1300 - y - rulesBlockH) / 2);
    for (const para of page.lines) {
      const n = wrap(para, 70, y, bodySize, 580, '#fff3d6', lh, 'left');
      y += n * lh + 18;
    }
    text(`Page ${(state.page % RULES.length) + 1} of ${RULES.length}`, 360, 1345, 19, 'rgba(248,233,196,0.6)', UI, 600);
    button(RULES_BTN.back, 'Back', { size: 30 });
    button(RULES_BTN.next, 'Next', { primary: true, size: 30 });
    button(HEADER.textDec, 'A−', { size: 34, dim: state.textScaleIdx === 0 });
    button(HEADER.textInc, 'A+', { size: 34, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(8,10,30,0.72)'; ctx.fillRect(0, 102, W, 1356);
    const won = g.winner === 'draw' ? 'A draw' : state.two || state.autoMode ? (g.winner === 0 ? 'Player one wins' : 'Player two wins') : g.winner === 0 ? 'You win!' : 'The computer wins';
    fitText(won, 360, 500, 96, 620);
    wrap(g.reason, 360, 570, 26, 560, '#fff3d6');
    text(`${state.shown.kazan[0]} : ${state.shown.kazan[1]}`, 360, 740, 120, GOLD, FONT);
    text(state.two || state.autoMode ? 'Player one : Player two' : 'You : Computer', 360, 785, 24, 'rgba(248,233,196,0.85)', UI, 600);
    text(`${g.moves} moves`, 360, 830, 24, 'rgba(248,233,196,0.7)', UI, 500);
    if (!state.two && !state.autoMode && g.winner === 0) {
      text(`★ ${LEVELS[state.level].name} beaten`, 360, 900, 32, GOLD, UI, 700);
      if (!state.calm) for (let k = 0; k < 16; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (170 + 90 * ph), y = 640 - ph * 420; drawSeed(ctx, state.seeds, k % 4, x, y, ph * 6, 0.9 - ph * 0.4); }
    }
    button(BTN.again, 'Play again', { primary: true, size: 36 }); button(BTN.back, 'Menu', { size: 32 });
  }
  // lamplight breathing: a faint warm flicker over everything but the buttons' text
  if (!state.calm && scene !== 'over') { const fl = 0.035 + 0.02 * Math.sin(state.t * 2.3) + 0.012 * Math.sin(state.t * 7.1); ctx.fillStyle = `rgba(255,190,100,${fl})`; ctx.fillRect(0, 102, W, 1356); }
}
