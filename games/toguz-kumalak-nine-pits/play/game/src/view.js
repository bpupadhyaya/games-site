// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The table, board and pebble sprites are cached (art.js).
import { W, H, RX, RY, TRAY, MID_Y, TEXT_SCALES, THINK_STEPS, host, pitPos, trayPos } from './layout.js';
import { drawCredit, drawMoreLine, drawLockupImage, drawBadgeStack, edgeStroke } from './brand.js';
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
// Reader layout cache (wrapped lines + total height); readerStats.layouts counts re-wraps (tests read it).
const readerCache = { list: null, key: '', items: [], endY: 0 };
export const readerStats = { layouts: 0 };

export function render(ctx, state, L) {
  const scene = state.scene, big = state.big, g = state.game, A = state.anim;
  // Text never drops below ~11.5 css px: `zs` is the scale of the transform currently in force (board group, art), `host.px` the css px per unit.
  let zs = 1;
  const MIN = () => 11.5 / Math.max(0.2, host.px) / zs, fz = (n) => Math.max(n, MIN());
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'puzzle';

  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center', shadow = true) => {
    size = fz(size); ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`;
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
    const size = Math.max(w > maxW ? Math.floor(maxSize * (maxW / w) * 0.98) : maxSize, 12);
    text(str, x, y, size, color, font, weight);
  };
  // Word-wraps to maxW. At the highest text-size steps a single long hyphenated word (e.g.
  // "counter-clockwise") can be wider than maxW all on its own - with no space to break on, it
  // used to run straight off the canvas edge. Falls back to a character-level break for just that
  // one word so it wraps like any other overflowing line, instead of clipping.
  const lines = (str, maxW, size, weight = 600) => {
    size = fz(size);
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
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = fz(size) * 1.3, align = 'center') => { const LN = lines(str, maxW, size); LN.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return LN.length; };
  // a transform scope: draw in a scaled, shifted space (the board group, the title art, the result block); text keeps its minimum size
  const withT = (ox, oy, s, fn) => { ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s); const z = zs; zs = z * s; try { fn(); } finally { zs = z; ctx.restore(); } };
  const inBoard = (fn) => withT(L.bt.ox, L.bt.oy, L.bt.s, fn);

  // a crafted button: dark walnut with a felt inlay and a stitched ochre edge; the main action is gold leaf
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(20, r.h * 0.28), ins = Math.min(7, r.h * 0.1);
    ctx.fillStyle = 'rgba(4,6,20,0.5)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 7, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#fbdc8c'); gr.addColorStop(0.55, '#dea23a'); gr.addColorStop(1, '#a86a1c'); } else { gr.addColorStop(0, '#6a4127'); gr.addColorStop(0.5, '#47281a'); gr.addColorStop(1, '#2d180d'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.9)' : 'rgba(242,197,107,0.6)'; ctx.lineWidth = 2.5; ctx.stroke();
    let sz = fz(o.size ?? 30); const maxW = r.w - 18, floor = fz(15);
    ctx.font = `700 ${sz}px ${UI}`;
    while (ctx.measureText(label).width > maxW && sz > floor) { sz -= 1; ctx.font = `700 ${sz}px ${UI}`; }
    ctx.textAlign = 'center';
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

  // ---- the board and what is in it (drawn in canonical board space: full size, and small on the title) ------------
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
      const ny = top ? p.y + RY + 20 : p.y - RY - 8, nsz = fz(big ? 17 : 15);
      ctx.textAlign = 'center'; ctx.font = `700 ${nsz}px ${FONT}`; ctx.fillStyle = 'rgba(20,8,2,0.55)'; ctx.fillText(String(numberOf(i)), p.x + 0.8, ny + 1.2); ctx.fillStyle = 'rgba(255,226,170,0.8)'; ctx.fillText(String(numberOf(i)), p.x, ny);
      if (n <= 0) continue;
      const sz = fz(big ? 32 : 26), y = top ? p.y - RY - (big ? 12 : 10) : p.y + RY + Math.max(big ? 32 : 28, sz * 0.95);
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
    scale *= Math.min(1, box.w / 500);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 26); ctx.clip();
    ctx.fillStyle = '#100d1c'; ctx.fillRect(box.x, box.y, box.w, box.h);
    withT(box.x + box.w / 2 - focus.x * scale, box.y + box.h / 2 - focus.y * scale, scale, () => { drawBoard(ctx, state.wood); contents(sh, opts); });
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(242,197,107,0.7)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 26); ctx.stroke(); ctx.restore();
  };

  // a message / lesson card: the text shrinks (down to a readable floor) until it fits the rect
  const textCard = (r, str, alpha = 1) => {
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha); panel(r.x, r.y, r.w, r.h, 0.9);
    const pad = Math.min(24, r.w * 0.05), maxW = r.w - 2 * pad;
    let ms = fz(big ? 34 : 28), LN = lines(str, maxW, ms);
    while (LN.length * ms * 1.28 > r.h - 18 && ms > fz(18)) { ms -= 2; LN = lines(str, maxW, ms); }
    const top = r.y + r.h / 2 - (LN.length * ms * 1.28) / 2 + ms * 0.95;
    LN.forEach((ln, i) => text(ln, r.x + r.w / 2, top + i * ms * 1.28, ms, '#fff3d6', UI, 600, 'center', false));
    ctx.restore();
  };
  // the status header: an optional small kicker, the big line (shrinks to fit), then wrapped sub lines
  const header = (r, { kicker, title, subs = [] }) => {
    const cx = r.x + r.w / 2, maxT = r.w >= 560 ? (L.mode === 'tall' ? 58 : 50) : 44;
    let y = r.y;
    if (kicker) { y += 24; text(kicker, cx, y, 24, 'rgba(248,233,196,0.85)', UI, 600); y += 6; }
    const tsz = Math.min(maxT, fz(maxT)); y += tsz * 0.85;
    fitText(title, cx, y, tsz, r.w); y += 14;
    for (const sub of subs) {
      const sz = fz(sub.size ?? 21), lh = sz * 1.25, LN = lines(sub.text, r.w, sz, sub.weight ?? 500);
      for (const ln of LN) { y += lh; if (y > r.y + r.h + 6) return; text(ln, cx, y, sz, sub.color, UI, sub.weight ?? 500); }
      y += 4;
    }
  };

  // ---- table -----------------------------------------------------------------------------------------------------
  drawTable(ctx, L.w, L.h, L.bandTop, L.bandBot);

  if (boardScene) {
    const SC = scene === 'play' ? (state.autoMode ? 'auto' : 'play') : scene === 'over' ? 'play' : scene, P = L.play[SC];
    let legal = [];
    if (!A && g.winner === null && (scene === 'play' ? (state.two || g.turn === 0) : scene === 'lesson' ? !state.lesson.done && !state.lesson.wait : scene === 'puzzle' ? (state.pz.status !== 'solved' && state.pz.wrong <= 0) : false)) {
      legal = scene === 'lesson' ? LESSONS[state.lesson.i].want.concat(LESSONS[state.lesson.i].trap ? [LESSONS[state.lesson.i].trap.pit] : []).filter((p) => legalMoves(g).includes(p)) : legalMoves(g);
    }
    inBoard(() => {
      drawBoard(ctx, state.wood);
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
      }
    });
    const GOAL = { text: 'First to collect 82 of the 162 pebbles wins', size: 22, color: GOLD, weight: 600 };
    // While a move is animating, `g.turn` has already flipped to the NEXT mover (rules.js applyMove flips it at once), so read whose
    // move is on screen from the animation itself (A.r.player): the header never announces the next mover a full animation early.
    const mover = A ? A.r.player : g.turn;
    if (scene === 'over') { /* the result block below takes the stage */ }
    else if (scene === 'lesson') header(L.header, { kicker: `Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, title: LESSONS[state.lesson.i].title, subs: [] });
    else if (scene === 'puzzle') header(L.header, { kicker: 'Daily puzzle' + (state.pz.puzzle.hard ? ' (weekend)' : ''), title: 'Take the most', subs: [{ text: `Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, size: 24, color: GOLD, weight: 600 }] });
    else if (state.autoMode) {
      // Paused freezes literally everything about this game, including the dots-cycling "thinking..." animation, so say so plainly.
      const phase = state.autoPaused ? '- paused' : A ? 'is sowing' : state.autoPhase === 'reveal' ? '- this is the move' : 'thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3));
      const line = g.winner !== null ? 'Game over' : `${mover === 0 ? 'Bottom row' : 'Top row'} ${phase}`;
      header(L.header, { title: line, subs: [{ text: `Auto Play · think time ${THINK_STEPS[state.autoThinkIdx]}s`, color: 'rgba(248,233,196,0.85)' }, GOAL] });
    } else {
      const th = state.thinking && !A ? 'The computer is thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : null;
      const line = g.winner !== null ? 'Game over' : state.two ? (mover === 0 ? 'Player one: bottom row' : 'Player two: top row') : mover === 0 ? 'Your move' : (th || 'The computer moves');
      header(L.header, { title: line, subs: [{ text: state.two ? 'Two players, one phone' : `Computer: ${LEVELS[state.level].name} · ${LEVELS[state.level].blurb}`, color: 'rgba(248,233,196,0.85)' }, GOAL] });
    }
    if (state.msg && scene !== 'over') textCard(P.msg, state.msg.text, Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5));
    else if (scene === 'lesson' && !state.lesson.done && !state.anim && !state.lesson.wait) textCard(P.msg, LESSONS[state.lesson.i].text);
    const B = P.btn;
    if (scene === 'play') {
      if (state.autoMode) {
        // Auto Play's own rail: Exit, Pause/Resume (its own dedicated button, always reachable), then the think-time stepper.
        button(B.exit, 'Exit', { size: 24 });
        button(B.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 24, primary: state.autoPaused });
        button(B.dec, '− Think', { size: 22, dim: state.autoThinkIdx <= 0 });
        button(B.inc, 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
      } else {
        button(B.menu, 'Menu', { size: 28 });
        button(B.undo, 'Undo', { size: 28 }); button(B.hint, `Hint (${state.hintsLeft})`, { size: 28, dim: state.hintsLeft <= 0 });
      }
    }
    else if (scene === 'lesson') { button(B.menu, 'Menu', { size: 28 }); if (state.lesson.done && !A) button(B.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 }); }
    else if (scene === 'puzzle') { button(B.menu, 'Menu', { size: 28 }); if (state.pz.status === 'solved' && !A) button(B.share, 'Share result', { primary: true, size: 30 }); }
    if (scene === 'play' && state.dev) text('DEV', L.dev.x + L.dev.w, L.dev.y + 20, 20, '#7dff9a', UI, 700, 'right');
  }

  if (scene === 'title' || scene === 'demo-limit') {
    const T = L.title(!!state.saved);
    // the crown of a yurt turns slowly behind the name; a real board sits below with a light running along the sowing path
    withT(T.art.ox, T.art.oy, T.art.s, () => {
      drawShanyrak(ctx, 360, 205, 190, state.calm ? 0 : state.t * 0.05, 0.3);
      ctx.save(); ctx.translate(360, 82); ctx.scale(0.68, 0.68); ctx.translate(-360, 0);
      zs *= 0.68;
      drawBoard(ctx, state.wood);
      const idle = { pits: new Array(18).fill(9), kazan: [0, 0], tuz: [-1, -1] };
      contents(idle, { counts: false });
      if (!state.calm) { const f = (state.t * 3.2) % 18; for (let d = 0; d < 4; d++) { const i = Math.floor(f + 18 - d) % 18, a = 0.7 - d * 0.18; ellipseGlow(i, '255,214,120', Math.max(0.05, a)); } }
      zs /= 0.68;
      ctx.restore();
      text('Toguz Kumalak', 360, 205, 104, CREAM, FONT);
      horn(ctx, 360, 250, 14, GOLD, 2.4);
      text('The nine-pebble game of the steppe', 360, 296, 27, 'rgba(248,233,196,0.92)', FONT, 500);
    });
  }
  if (scene === 'title') {
    const T = L.title(!!state.saved), R = T.rows, solved = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 32 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 32 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 32 });
    button(R.two, 'Two players, one phone', { size: 30 });
    button(R.daily, solved ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 30 });
    button(R.about, 'About', { size: 26 }); button(R.rules, 'Rules', { size: 26 }); button(R.settings, 'Settings', { size: 26 });
    button(R.auto, 'Auto Play · Watch & Learn', { size: 28 });
    // A transient message takes priority over the games/badges flourish when both would land in the same spot.
    const st = T.stats;
    if (state.msg) wrap(state.msg.text, st.x, st.y, 24, st.wMax, '#ffe9b0');
    else {
      text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, st.x, st.y, 22, 'rgba(248,233,196,0.85)', UI, 500);
      let stars = ''; for (let l = 0; l < LEVELS.length; l++) stars += state.stats.badges['L' + l] ? '★ ' : '☆ ';
      text(stars.trim(), st.x, st.y + 34, 28, GOLD, UI, 700);
    }
    drawLockupImage(ctx, T.lockup, 0.92, (state.afFlash || 0) > 0);                       // the quiet Arcforge credit (themed lockup)
  } else if (scene === 'demo-limit') {
    const D = L.demo; panel(D.x, D.y, D.w, D.h, 0.9);
    fitText('That was the free taste.', D.x + D.w / 2, D.y + 120, 56, D.w - 40);
    wrap('Get Toguz Kumalak on iPhone and Android for unlimited games.', D.x + D.w / 2, D.y + 200, 28, D.w - 70, '#fff3d6');
  } else if (scene === 'settings') {
    const S = L.settings;
    panel(S.panel.x, S.panel.y, S.panel.w, S.panel.h, 0.55);
    text('Settings', w2(), S.titleY, L.land ? 54 : 70, CREAM, FONT);
    const lv = LEVELS[state.level], sz = S.sz;
    button(S.rows.level, `Computer level: ${lv.name}`, { size: sz });
    button(S.rows.sound, state.sound ? 'Sound: on' : 'Sound: off', { size: sz });
    button(S.rows.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: sz });
    button(S.rows.big, state.big ? 'Large text: on' : 'Large text: off', { size: sz });
    button(S.rows.seeds, `Pieces: ${SEEDSETS[state.seeds]}`, { size: sz });
    button(S.rows.wood, `Board: ${WOODS[state.wood].name}`, { size: sz });
    wrap(lv.blurb, w2(), S.blurbY, 26, S.blurbW, '#ffe9b0');
    for (let k = 0; k < 9; k++) drawSeed(ctx, state.seeds, k % 4, w2() - 152 + k * 38, S.seedsY, k * 0.7, 1.3);
    button(S.back, 'Back', { primary: true, size: 32 });
  } else if (scene === 'about' || scene === 'rules') {
    // The text-size stepper (an index into TEXT_SCALES, never a raw float) lives right on the page, top-right: this is the page players read.
    // It is independent of the `big` gameplay toggle. A page whose text is taller than its area scrolls (drag / wheel); it never clips.
    const kind = scene, RF = L.ref, M = RF[kind], scale = TEXT_SCALES[state.textScaleIdx] ?? 1, hs = M.hs;
    const list = kind === 'about' ? ABOUT.pages : RULES, P = RF.panel, cx = P.x + P.w / 2;
    panel(P.x, P.y, P.w, P.h, 0.92);
    // header (fixed): the page title; the whole reference below it is ONE continuous scroll
    const head = kind === 'about' ? ABOUT.title : 'Rules';
    text(head, cx, M.titleY, Math.round((kind === 'about' ? 60 : 52) * hs * Math.min(scale, 1.15)), CREAM, FONT);
    horn(ctx, cx, M.hornY, 12 * hs, GOLD, 2.2);
    const topOff = 160 * hs, vp = { x: M.body.x, y: P.y + topOff, w: M.body.w, h: Math.max(60, P.h - topOff - 44) };
    const bodySize = fz(Math.round(29 * scale)), lh = Math.round(bodySize * 1.4), gap = kind === 'about' ? 22 : 18;
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const total0 = vp.y - Math.min(Math.max(state.scroll || 0, 0), state.scrollMax || 0);
    // The wrapped document is laid out once per (scene, text size, width, art height, font) and reused; a frame only draws the visible slice.
    ctx.font = `700 40px ${FONT}`; const fontProbe = ctx.measureText('Hamburgefonstiv').width;   // changes when the web font finishes loading
    const key = [kind, bodySize, vp.w, vp.h, hs, scale, RF.artH, fontProbe].join('|');
    if (readerCache.list !== list || readerCache.key !== key) {
      readerStats.layouts++;
      const items = []; let yy = 0;
      for (const page of list) {
        const tsz = Math.round(32 * hs * Math.min(scale, 1.7)), tlines = lines(page.title, vp.w, tsz, 700);
        yy += tsz * 0.95; for (const tl of tlines) { items.push({ t: 'title', str: tl, y: yy, size: tsz }); yy += tsz * 1.1; } yy += 4;
        if (page.art) {
          const bh = Math.max(40, Math.min(RF.artH, vp.h - 20));
          items.push({ t: 'art', art: page.art, y: yy, h: bh }); yy += bh + 22;
        }
        yy += bodySize * 0.5;
        for (const para of page.lines) { for (const ln of lines(para, vp.w, bodySize)) { items.push({ t: 'line', str: ln, y: yy }); yy += lh; } yy += gap; }
        yy += Math.round(10 * scale);
      }
      readerCache.list = list; readerCache.key = key; readerCache.items = items; readerCache.endY = yy;
    }
    const vTop = vp.y - 40, vBot = vp.y + vp.h + 40;
    for (const it of readerCache.items) {
      const ay = total0 + it.y;
      if (it.t === 'art') {
        if (ay + it.h < vTop - 20 || ay > vBot) continue;
        const bw = Math.max(40, Math.min(500, vp.w)), box = { x: vp.x + (vp.w - bw) / 2, y: ay, w: bw, h: it.h }, art = it.art;
        if (art === 'pit') artBox(pitPos(4), 2.4, box, { pits: Array.from({ length: 18 }, (_, i) => (i === 4 ? 5 : 9)), kazan: [0, 0], tuz: [-1, -1] }, { legal: [4], counts: false });
        else if (art === 'kazan') artBox(trayPos(0), 1.15, box, { pits: new Array(18).fill(0), kazan: [23, 0], tuz: [-1, -1] }, { counts: true, labels: ['You', 'Computer'] });
        else if (art === 'tuz') artBox({ x: pitPos(12).x, y: pitPos(12).y - 30 }, 2, box, { pits: Array.from({ length: 18 }, (_, i) => (i === 12 ? 0 : 9)), kazan: [0, 0], tuz: [12, -1] }, { counts: false });
      } else if (ay > vTop - (it.size || bodySize) * 2 - lh && ay < vBot + lh) {
        if (it.t === 'title') text(it.str, cx, ay, it.size, GOLD, FONT, 700); else text(it.str, vp.x, ay, bodySize, '#fff3d6', UI, 600, 'left');
      }
    }
    const y = total0 + readerCache.endY;
    ctx.restore();
    const total = y - total0, maxScroll = Math.max(0, Math.ceil(total - vp.h)); state.scrollMax = maxScroll;
    const sc = Math.min(Math.max(state.scroll || 0, 0), maxScroll);
    state.readerView = vp.h;
    if (maxScroll > 0) {                                  // a slim scroll bar at the panel's right edge
      const th = Math.max(36, vp.h * vp.h / total), ty = vp.y + (vp.h - th) * (sc / maxScroll);
      ctx.fillStyle = 'rgba(242,197,107,0.18)'; ctx.beginPath(); ctx.roundRect(P.x + P.w - 16, vp.y, 6, vp.h, 3); ctx.fill();
      ctx.fillStyle = 'rgba(242,197,107,0.85)'; ctx.beginPath(); ctx.roundRect(P.x + P.w - 16, ty, 6, th, 3); ctx.fill();
    }
    text(maxScroll > 0 ? `${Math.round(100 * sc / maxScroll)}% read` : 'All on one screen', cx, M.counterY, 21, 'rgba(248,233,196,0.6)', UI, 600);
    button(RF.nav.back, 'Back', { size: 30 });
    button(RF.nav.next, sc >= maxScroll - 1 ? 'Done' : 'Next', { primary: true, size: 30 });
    button(RF.text.dec, 'A−', { size: 34, dim: state.textScaleIdx === 0 });
    button(RF.text.inc, 'A+', { size: 34, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(8,10,30,0.86)'; ctx.fillRect(0, L.bandTop, L.w, L.h - L.bandTop - L.bandBot);
    const O = L.over;
    withT(O.ox, O.oy, O.k, () => {
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
      drawMoreLine(ctx, 360, 1246, Math.max(22, fz(22)));    // quiet brand line under the buttons (text only: it must never pull the player away)
    });
    button(O.again, 'Play again', { primary: true, size: 36 }); button(O.back, 'Menu', { size: 32 });
  }
  // lamplight breathing: a faint warm flicker over everything but the buttons' text
  if (!state.calm && scene !== 'over') { const fl = 0.035 + 0.02 * Math.sin(state.t * 2.3) + 0.012 * Math.sin(state.t * 7.1); ctx.fillStyle = `rgba(255,190,100,${fl})`; ctx.fillRect(0, L.bandTop, L.w, L.h - L.bandTop - L.bandBot); }
  function w2() { return L.settings.panel.x + L.settings.panel.w / 2; }
}
