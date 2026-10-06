// Everything drawn each frame. Reads `state` (game.js) and the live layout `L` (layout.js) and changes nothing.
// The chamber, board and pieces are cached bitmaps (art.js). The board and tray are drawn in canonical units under a uniform transform.
import { TRAYS, EXIT, cell, TEXT_SCALES, AP_THINK_STEPS, host } from './layout.js';
import { drawBackdrop, drawBoardLayer, drawTrayLayer, drawPiece, stickSprite, STICK } from './art.js';
import { legalMoves } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOW, RULES } from './about.js';
import { drawLockup, drawMoreLine, drawBadgeStack } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, IVORY = '#f6e7c4';
const FOOT = 20;                                     // a piece's foot sits this far below the middle of its square
const NAMES = (s) => (s.scene === 'autoplay' || s.scene === 'autoplay-over' ? ['Player A', 'Player B'] : s.two ? ['Player one', 'Player two'] : ['You', 'Computer']);

// Every button / text-bearing rectangle drawn in the last frame, for the layout checks (dev tools read it; the game never does).
export const ui = { buttons: [], texts: [], on: false };
// Reference-page scroll limits, measured while drawing and read by game.js to clamp scrolling.
export const docMetrics = { max: 0, view: 0 };
const docCache = { key: '', h: [] };
// The smallest text we allow, in virtual units (about 11 css px on this screen).
const minText = () => Math.max(14, Math.round(11 / Math.max(0.3, host.px)));

export function render(ctx, s, L) {
  ui.buttons.length = 0; ui.texts.length = 0;
  const m0 = ui.on ? ctx.getTransform() : null;
  const sc = s.scene;
  const C = sc === 'lesson' || sc === 'puzzle' ? L.card : L.play;
  const B = C.board, a = s.anim, g = s.g, W = L.w, H = L.h;
  drawBackdrop(ctx, s.t, s.calm, L, C.lamps);

  let inBtn = false;
  const text = (str, x, y, size, color = IVORY, font = FONT, weight = 700, align = 'center') => {
    ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y);
    if (ui.on) { const m = ctx.getTransform(), w = ctx.measureText(str).width, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x; ui.texts.push({ str, x: (m.a * x0 + m.e - m0.e) / m0.a, y: (m.d * y + m.f - m0.f) / m0.d, w: w * m.a / m0.a, size: size * m.a / m0.a, btn: inBtn, a: ctx.globalAlpha, clip: !!clipOn }); }
  };
  let clipOn = false;
  const fitSize = (str, maxW, size, weight = 700, font = FONT, min = 14) => { ctx.font = `${weight} ${size}px ${font}`; while (size > min && ctx.measureText(str).width > maxW) { size -= 1; ctx.font = `${weight} ${size}px ${font}`; } return size; };
  const gold = (str, x, y, size, maxW) => {                // gilded display lettering
    if (maxW) size = fitSize(str, maxW, size);
    ctx.textAlign = 'center'; ctx.font = `700 ${size}px ${FONT}`;
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.09; ctx.strokeStyle = 'rgba(30,12,2,0.9)'; ctx.strokeText(str, x, y + 3);
    const gr = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1); gr.addColorStop(0, '#fff4c2'); gr.addColorStop(0.5, '#efc45c'); gr.addColorStop(1, '#a8761c');
    ctx.fillStyle = gr; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => { ctx.font = `${weight} ${size}px ${UI}`; const out = []; let cur = ''; for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; } out.push(cur); return out; };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center') => { const ls = lines(str, maxW, size); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return ls.length; };
  // wrap into a box: the largest size (down to the readable floor) whose lines fit `maxH`
  const fitWrap = (str, maxW, maxH, size0, min, lhK = 1.28) => {
    let size = size0, ls;
    for (; ; size -= 1) { ls = lines(str, maxW, size); if (ls.length * size * lhK <= maxH || size <= min) break; }
    return { ls, size, lh: size * lhK };
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ r: { ...r }, label, scene: sc });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(16, r.h * 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f7e4a0'); gr.addColorStop(1, '#c89a3a'); } else { gr.addColorStop(0, '#4a3226'); gr.addColorStop(1, '#1e130d'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(90,50,10,0.8)' : 'rgba(230,184,74,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    // the label shrinks to fit, to the readable floor; past that it takes two lines
    inBtn = true;
    const col = o.primary ? '#2a1606' : IVORY, maxW = r.w - 22, floor = Math.min(minText(), o.size ?? 28);
    let size = fitSize(label, maxW, o.size ?? 28, 700, UI, floor);
    ctx.font = `700 ${size}px ${UI}`;
    if (ctx.measureText(label).width > maxW && label.includes(' ')) {
      const words = label.split(' '); let best = null;
      for (let k = 1; k < words.length; k++) { const l1 = words.slice(0, k).join(' '), l2 = words.slice(k).join(' '), w2 = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width); if (!best || w2 < best.w) best = { l1, l2, w: w2 }; }
      text(best.l1, r.x + r.w / 2, r.y + r.h / 2 - size * 0.12, size, col, UI, 700); text(best.l2, r.x + r.w / 2, r.y + r.h / 2 + size * 0.95, size, col, UI, 700);
    } else text(label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.35, size, col, UI, 700);
    inBtn = false;
    ctx.restore();
  };
  const panel = (x, y, w, h) => { ctx.fillStyle = 'rgba(14,6,2,0.78)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.55)'; ctx.lineWidth = 2; ctx.stroke(); };
  const card = (r, al = 0.82) => { ctx.fillStyle = `rgba(14,6,2,${al})`; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.5)'; ctx.lineWidth = 2; ctx.stroke(); };
  const footOf = (i) => { const k = cell(i); return { x: k.cx, y: k.cy + FOOT }; };

  // where the moving piece is: { x, y, lift, alpha, scale }   (canonical board units)
  const animPos = () => {
    const f = Math.min(1, a.t / a.dur), ease = f * f * (3 - 2 * f);
    const P = (p) => (p === 30 || p === -1 ? { x: EXIT.cx, y: EXIT.cy - 6 } : footOf(p));
    if (a.type === 'refuse') {
      const from = footOf(a.from), to = P(a.to), reach = a.to === a.from ? 0 : 0.55;
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = s.calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 : 0;
      return { x: from.x + (to.x - from.x) * e + shake, y: from.y + (to.y - from.y) * e, lift: 18 * Math.sin(Math.PI * Math.min(1, f * 1.1)), alpha: 1, scale: 1 };
    }
    if (a.type === 'water') {                        // glide to the water, sink with rings, then rise at the new square
      const dest = footOf(a.dest), to = footOf(a.to);
      if (f < 0.4) { const e2 = ease4(f / 0.4), fr = footOf(a.from); return { x: fr.x + (dest.x - fr.x) * e2, y: fr.y + (dest.y - fr.y) * e2, lift: 22 * Math.sin(Math.PI * f / 0.4), alpha: 1, scale: 1 }; }
      if (f < 0.65) { const k = (f - 0.4) / 0.25; return { x: dest.x, y: dest.y + k * 22, lift: 0, alpha: 1 - k, scale: 1 - 0.25 * k, ring: k, at: dest }; }
      const k = (f - 0.65) / 0.35; return { x: to.x, y: to.y, lift: (1 - k) * 26, alpha: k, scale: 1 };
    }
    const fr = footOf(a.from), to = P(a.type === 'off' ? 30 : a.to), e2 = ease;
    return { x: fr.x + (to.x - fr.x) * e2, y: fr.y + (to.y - fr.y) * e2, lift: Math.sin(Math.PI * f) * 30, alpha: a.type === 'off' ? Math.min(1, 2.2 * (1 - f) + 0.05) : 1, scale: a.type === 'off' ? 1 - 0.3 * f : 1 };
  };
  const ease4 = (f) => f * f * (3 - 2 * f);
  const bp = (x, y) => ({ x: B.ox + x * B.s, y: B.oy + y * B.s });          // canonical board point -> screen
  const withBoard = (fn) => { ctx.save(); ctx.translate(B.ox, B.oy); ctx.scale(B.s, B.s); fn(); ctx.restore(); };
  const drawDim = (al) => { if (ui.on && al > 0.5) ui.texts.length = 0; ctx.fillStyle = `rgba(10,4,0,${al})`; ctx.fillRect(0, 0, W, H); };

  const boardScene = sc === 'play' || sc === 'over' || sc === 'lesson' || sc === 'autoplay' || sc === 'autoplay-over' || (sc === 'puzzle' && s.pz.status !== 'making');
  if (boardScene) drawBoardScene();
  if (sc === 'title' || sc === 'demo-limit') drawTitle();
  if (sc === 'about' || sc === 'how') drawDoc(sc === 'about' ? ABOUT : HOW, true);
  if (sc === 'rules') drawDoc({ title: 'Rules' }, false);
  if (sc === 'puzzle' && s.pz.status === 'making') { drawDim(0.5); text("Preparing today's puzzle…", W / 2, H / 2, 34, '#fff3d6', UI, 600); button(C.BTN.menu, 'Menu', { size: 26 }); }
  return;

  // -------------------------------------------------------------------------------------------------------------
  // The sticks and the tray
  // -------------------------------------------------------------------------------------------------------------
  function drawSticks(ocx, ocy, opts = {}) {
    const sc0 = opts.sc ?? 1, cx0 = ocx, cy0 = ocy;
    const roll = opts.roll, faces = roll ? roll.faces : [true, false, true, false];
    for (let k = 0; k < 4; k++) {
      const rest = { x: cx0 + ((k % 2) * 190 - 95) * sc0, y: cy0 + (Math.floor(k / 2) * 58 - 29) * sc0, rot: [-0.09, 0.07, 0.06, -0.05][k] };
      let x = rest.x, y = rest.y, rot = rest.rot, sy = 1, light = faces[k], lift = 0;
      if (roll && roll.tumbling) {
        const sd = roll.seeds[k], f = Math.max(0, Math.min(1, (roll.t - sd.delay) / (roll.dur - sd.delay)));
        const air = 200 * (1 - f) * (1 - f) * Math.abs(Math.cos(f * Math.PI * (2.2 + sd.b)));
        lift = f <= 0 ? 260 : air;
        const phi = (faces[k] ? 0 : Math.PI) + Math.PI * sd.flips * Math.pow(1 - f, 1.4);
        const cphi = Math.cos(phi); light = cphi > 0; sy = Math.max(0.16, Math.abs(cphi));
        x += sd.dx * sc0 * (1 - f); rot += sd.spin * (1 - f) * (1 - f);
        if (f <= 0) sy = 0.001;
      }
      const spr = stickSprite(light);
      ctx.save(); ctx.translate(x, y - lift * 0.65 * sc0); ctx.rotate(rot);
      ctx.fillStyle = `rgba(0,0,0,${0.4 * (1 - Math.min(1, lift / 240))})`; ctx.beginPath(); ctx.ellipse(6 * sc0, lift * 0.65 * sc0 + 14 * sc0, 66 * sc0 * (1 - lift / 600), 9 * sc0, 0, 0, TAU); ctx.fill();
      ctx.scale(0.94 * sc0, 0.94 * sc0 * sy);
      if (spr) ctx.drawImage(spr, -STICK.w / 2, -STICK.h / 2, STICK.w, STICK.h);
      ctx.restore();
    }
  }
  function drawTray() {
    const T = C.tray, G = TRAYS[T.v], roll = s.roll, pulse = s.calm ? 0.6 : 0.5 + 0.5 * Math.sin(s.t * 4);
    drawTrayLayer(ctx, T);
    ctx.save(); ctx.translate(T.x, T.y); ctx.scale(T.s, T.s);
    drawSticks(G.sx, G.sy, { roll });
    const canThrow = sc !== 'autoplay' && sc !== 'autoplay-over' && s.phase === 'need' && (s.two || g.turn === 1) && !g.winner;
    const cap = (str) => text(str, G.w / 2, -12, fitSize(str, G.w - 8, 26, 700, UI, 18), '#ffe9b0', UI, 700);
    if (canThrow) {                                          // invitation: a glow around the tray and a caption
      ctx.strokeStyle = `rgba(255,224,120,${0.4 + pulse * 0.5})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(-2, -2, G.w + 4, G.h + 4, 24); ctx.stroke();
      cap('TAP the sticks to throw');
    }
    // result bubble
    const shown = roll && !roll.tumbling && (s.phase !== 'need' || g.n) ? roll.n : 0;
    ctx.fillStyle = 'rgba(10,4,0,0.55)'; ctx.beginPath(); ctx.arc(G.bx, G.by, 50, 0, TAU); ctx.fill();
    ctx.strokeStyle = shown ? '#e6b84a' : 'rgba(230,184,74,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    if (shown) { gold(String(shown), G.bx, G.by + 22, 70); text(shown === 5 ? 'none light' : `${shown} light`, G.bx, G.by + 66, Math.max(20, Math.min(30, minText() / T.s)), '#ffe9b0', UI, 600); }
    else text('?', G.bx, G.by + 22, 62, 'rgba(255,233,176,0.45)');
    if (g.extra && s.phase === 'need' && !g.winner) { if (T.v === 'row') text('Throw again!', G.w / 2, G.h + 30, 26, '#ffd24a', UI, 700); else text('Throw again!', G.bx + 118, G.by + 8, 22, '#ffd24a', UI, 700); }
    ctx.restore();
  }

  // -------------------------------------------------------------------------------------------------------------
  // The board scene: play, lesson, puzzle, auto play and the result cards on top of them
  // -------------------------------------------------------------------------------------------------------------
  function drawBoardScene() {
    const kb = s.kb && sc !== 'over', hud = C.hud, minT = minText();
    if (C.leftCard) { card(C.leftCard); card(C.rightCard); }
    if (C.rightCard && C.mode === 'side') card(C.rightCard, 0.6);
    drawBoardLayer(ctx, B);
    // header
    if (sc === 'lesson' || sc === 'puzzle') {
      const cd = hud.card; card(cd, 0.88);
      const wide = C.mode === 'wide', cx = cd.x + cd.w / 2, tsz = wide ? 36 : 46;
      const label = sc === 'lesson' ? `Lesson ${s.lesson.i + 1} of ${LESSONS.length}` : 'Daily puzzle';
      const title = sc === 'lesson' ? LESSONS[s.lesson.i].title : 'Find the best move';
      text(label, cx, cd.y + 28, Math.max(wide ? 20 : 22, wide ? minT : 22), 'rgba(246,231,196,0.85)', UI, 600);
      gold(title, cx, cd.y + (wide ? 72 : 76), tsz, cd.w - 30);
      let body, col;
      if (sc === 'lesson') { const l = LESSONS[s.lesson.i]; body = s.lesson.done ? l.done : l.text; col = s.lesson.done ? '#c9f7c0' : '#ffffff'; }
      else { const P = s.pz; body = P.status === 'solved' ? `Solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' at the first try'}. ${P.puzzle.why} Streak ${s.daily.streak}.` : `It is ${g.turn === 1 ? 'the cones' : 'the reels'}' move and the throw is ${g.n}. TAP the piece you would move, then its square.`; col = P.status === 'solved' ? '#c9f7c0' : '#fff3d6'; }
      const top = cd.y + (wide ? 100 : 112), room = cd.y + cd.h - top - 10;
      const fw = fitWrap(body, cd.w - 30, room + 4, s.big ? 24 : 21, wide ? Math.min(minT, 21) : 16, s.big ? 1.2 : 1.24);
      fw.ls.forEach((ln, i) => text(ln, cx, top + 16 + i * fw.lh, fw.size, col, UI, 600));
    } else {
      gold('Senet', hud.title.x, hud.title.y, hud.title.size, hud.title.maxW);
      const nm = NAMES(s);
      for (let p = 1; p <= 2; p++) {
        const r = hud.panels[p - 1], act = !g.winner && g.turn === p, narrow = r.w < 290;
        ctx.save(); ctx.translate(r.x, r.y);
        panel(0, 0, r.w, r.h);
        if (act) { ctx.strokeStyle = `rgba(255,224,120,${s.calm ? 0.9 : 0.6 + 0.35 * Math.sin(s.t * 5)})`; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.roundRect(0, 0, r.w, r.h, 16); ctx.stroke(); }
        const st = act ? (s.thinking || s.phase === 'think' ? 'thinking…' : 'to play') : 'waiting', fs = Math.max(20, Math.min(23, minT)), home = narrow ? `home ${g.off[p - 1]}/5` : `home ${g.off[p - 1]} of 5`;
        drawPiece(ctx, p, 38, r.h - 18, { scale: 0.72 });
        text(nm[p - 1], 76, 34, 24, '#fff3d6', UI, 700, 'left');
        const dx0 = r.w - 14 - 4 * 21;
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(dx0 + k * 21, 26, 8, 0, TAU); ctx.fillStyle = k < g.off[p - 1] ? '#e6b84a' : 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
        text(st, 78, r.h - 20, fs, 'rgba(246,231,196,0.75)', UI, 500, 'left');
        text(home, r.w - 12, r.h - 20, fs, 'rgba(246,231,196,0.8)', UI, 500, 'right');
        ctx.restore();
      }
      const capSize = Math.max(hud.cap.size, Math.min(minT, 21));
      if (!s.two && sc !== 'autoplay' && sc !== 'autoplay-over') text(`Computer: ${LEVELS[s.level].name}`, hud.cap.x, hud.cap.y, capSize, 'rgba(246,231,196,0.7)', UI, 500);
      else if (sc === 'autoplay') {
        const ap = s.ap, cap = ap && ap.phase === 'reveal' ? 'Here is the move' : `Auto Play · pause ${AP_THINK_STEPS[s.apThinkIdx]}s`;
        text(cap, hud.cap.x, hud.cap.y, capSize, 'rgba(246,231,196,0.8)', UI, 500);
      }
    }

    // squares that glow: destinations of the selected piece, or the hint
    const pulse = s.calm ? 0.6 : 0.5 + 0.5 * Math.sin(s.t * 6);
    // Auto Play only reveals legal-move glow during its own REVEAL sub-phase (state.ap.phase), never
    // throughout the whole 'choose' phase the way a human turn does - THINK must show nothing.
    const human = sc === 'autoplay' ? !!(s.ap && s.ap.phase === 'reveal') : s.phase === 'choose' && !a && !g.winner && (s.two || g.turn === 1 || sc !== 'play');
    const moves = human ? legalMoves(g) : [];
    const labels = [];                                               // drawn after the board transform, at a readable size
    let exitLabel = null;
    withBoard(() => {
      const shade = (i, rgb, label) => { const k = cell(i); ctx.fillStyle = `rgba(${rgb},${0.3 + pulse * 0.25})`; ctx.beginPath(); ctx.roundRect(k.x + 6, k.y + 6, k.w - 12, k.h - 12, 7); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},0.95)`; ctx.lineWidth = 3; ctx.stroke(); if (label) labels.push([label, k]); };
      const exitGlow = (rgb) => { ctx.fillStyle = `rgba(${rgb},${0.35 + pulse * 0.3})`; ctx.beginPath(); ctx.roundRect(EXIT.x + 2, EXIT.y - 6, EXIT.w - 4, EXIT.h + 2, [0, 0, 12, 12]); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},0.95)`; ctx.lineWidth = 3; ctx.stroke(); exitLabel = true; };
      if (s.sel >= 0) for (const m of moves) if (m.from === s.sel) { if (m.off) exitGlow('120,255,170'); else shade(m.dest, m.water ? '255,96,72' : m.swap >= 0 ? '255,215,90' : '120,255,170', m.water ? 'WATER' : m.swap >= 0 ? 'SWAP' : ''); }
      // "NEXT" (not "HINT") during Auto Play's REVEAL: this is the move about to be played, not a hint the player asked for.
      const hintLabel = sc === 'autoplay' ? 'NEXT' : 'HINT';
      if (s.hint && !a) { shade(s.hint.from, '100,220,255'); if (s.hint.dest === 30 || s.hint.off) exitGlow('100,220,255'); else shade(s.hint.dest, '100,220,255', hintLabel); }
      // pieces, top to bottom so lower ones overlap the ones behind
      const hidden = new Set();
      if (a) { if (a.type === 'refuse') hidden.add(a.from); else { if (a.to >= 0) hidden.add(a.to); if (a.swapKind) hidden.add(a.from); } }
      const movable = new Set(moves.map((m) => m.from));
      const order = [...Array(30).keys()].sort((p, q) => cell(p).cy - cell(q).cy);
      for (const i of order) {
        const p = g.board[i]; if (!p || hidden.has(i)) continue;
        const f = footOf(i), sel = s.sel === i;
        drawPiece(ctx, p, f.x, f.y, { scale: 0.92, lift: sel ? 14 + (s.calm ? 0 : Math.sin(s.t * 4) * 2) : 0, glow: !a && movable.has(i) && s.sel < 0 ? `rgba(255,${210 + (pulse * 30) | 0},110,` : sel ? 'rgba(120,255,170,' : null });
      }
      if (a) {
        if (a.swapKind) {                                     // the swapped enemy piece slides back
          const f = Math.min(1, a.t / a.dur), e = f * f * (3 - 2 * f), d = footOf(a.dest), fr = footOf(a.from);
          drawPiece(ctx, a.swapKind, d.x + (fr.x - d.x) * e, d.y + (fr.y - d.y) * e, { scale: 0.92, lift: Math.sin(Math.PI * f) * 14 });
        }
        const pos = animPos();
        ctx.save(); ctx.globalAlpha = Math.max(0, pos.alpha);
        drawPiece(ctx, a.kind, pos.x, pos.y, { lift: pos.lift, scale: pos.scale * 0.92 });
        ctx.restore();
        if (pos.ring !== undefined) for (let r = 0; r < 3; r++) { const kk = Math.min(1, pos.ring + r * 0.0); ctx.strokeStyle = `rgba(160,210,255,${0.7 * (1 - kk) * (1 - r * 0.3)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(pos.at.x, pos.at.y + 4, (18 + r * 14) * (0.5 + kk), (6 + r * 5) * (0.5 + kk), 0, 0, TAU); ctx.stroke(); }
        if (a.type === 'off' && !s.calm && a.t / a.dur > 0.5) for (let k = 0; k < 8; k++) { const f = (a.t / a.dur - 0.5) * 2, ang = k * TAU / 8, r = 10 + 44 * f; ctx.fillStyle = `rgba(255,220,120,${0.9 * (1 - f)})`; ctx.beginPath(); ctx.arc(EXIT.cx + Math.cos(ang) * r, EXIT.cy + Math.sin(ang) * r * 0.7, 3.5 * (1 - f) + 1, 0, TAU); ctx.fill(); }
        if (a.swapKind && !s.calm && a.t / a.dur > 0.55) { const f = (a.t / a.dur - 0.55) / 0.45, d = footOf(a.dest); ctx.strokeStyle = `rgba(255,236,170,${0.8 * (1 - f)})`; ctx.lineWidth = 5 * (1 - f) + 1; ctx.beginPath(); ctx.ellipse(d.x, d.y, 20 + 46 * f, 8 + 18 * f, 0, 0, TAU); ctx.stroke(); }
      }
      if (kb) { if (s.cursor === 30) { ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h); } else { const c = cell(s.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6, 8); ctx.stroke(); } }
    });
    // square numbers, move labels and HOME: drawn at a readable size however small the board is shown
    const numSize = Math.max(15 * B.s, Math.min(minT, 0.34 * 88 * B.s)), lblSize = Math.max(14 * B.s, Math.min(minT * 0.85, 0.3 * 88 * B.s));
    const overlayOn = sc === 'over' || sc === 'autoplay-over' || (sc === 'autoplay' && s.ap && s.ap.paused);
    if (!overlayOn) for (let i = 0; i < 30; i++) { const k = cell(i), p = bp(k.x + 13, k.y + 24); text(String(i + 1), p.x, p.y, numSize, 'rgba(90,58,26,0.7)', UI, 700, 'left'); }
    for (const [label, k] of labels) {
      ctx.font = `800 ${lblSize}px ${UI}`; const tw = ctx.measureText(label).width + lblSize * 0.8, h2 = lblSize * 1.5, p = bp(k.x + k.w - 10, k.y + 10);
      ctx.fillStyle = 'rgba(20,8,2,0.78)'; ctx.beginPath(); ctx.roundRect(p.x - tw, p.y, tw, h2, 7); ctx.fill();
      text(label, p.x - tw / 2, p.y + h2 * 0.72, lblSize, '#fff', UI, 800);
    }
    if (exitLabel) { const p = bp(EXIT.cx, EXIT.cy + 34); text('HOME', p.x, p.y, Math.max(16 * B.s, Math.min(minT * 0.85, 22)), '#fff', UI, 800); }

    drawTray();

    // message
    if (s.msg && sc !== 'over') {
      const al = Math.min(1, s.msg.t / 0.15) * Math.min(1, (s.msg.hold - s.msg.t) / 0.5), ms = s.big ? 29 : 23, lh = s.big ? 37 : 30;
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      if (C.msg.fixed) {
        const r = C.msg.rect, fw = fitWrap(s.msg.text, r.w - 28, r.h - 20, ms, Math.min(minT, 21), 1.26), hh = Math.min(r.h, 20 + fw.ls.length * fw.lh);
        ctx.fillStyle = 'rgba(18,8,3,0.93)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, hh, 14); ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.9)'; ctx.lineWidth = 2; ctx.stroke();
        fw.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, r.y + 10 + fw.size * 0.95 + i * fw.lh, fw.size, '#fff3d6', UI, 600));
      } else {
        const ls = lines(s.msg.text, 590, ms), hh = 24 + ls.length * lh, yy = C.msg.y;
        ctx.fillStyle = 'rgba(18,8,3,0.93)'; ctx.beginPath(); ctx.roundRect(C.msg.x, yy, C.msg.w, hh, 16); ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.9)'; ctx.lineWidth = 2; ctx.stroke();
        ls.forEach((ln, i) => text(ln, C.msg.x + C.msg.w / 2, yy + 34 + i * lh, ms, '#fff3d6', UI, 600));
      }
      ctx.restore();
    }
    const BT = C.BTN;
    if (sc === 'play') { button(BT.menu, 'Menu', { size: 26 }); button(BT.undo, 'Take back', { size: 26, dim: !s.undo.length }); button(BT.hint, `Hint (${s.hintsLeft})`, { size: 26, dim: s.hintsLeft <= 0 }); }
    else if (sc === 'lesson') { button(BT.menu, 'Menu', { size: 26 }); if (s.lesson.done) button(BT.next, s.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (sc === 'puzzle') { button(BT.menu, 'Menu', { size: 26 }); if (s.pz.status === 'solved') button(BT.share, 'Share result', { primary: true, size: 30 }); }
    else if (sc === 'autoplay' && !(s.ap && s.ap.paused)) {
      button(BT.apExit, 'Exit', { size: 22 });
      button(BT.apPause, 'Pause', { size: 22 });
      button(BT.apDec, 'Think −', { size: 20, dim: s.apThinkIdx === 0 });
      button(BT.apInc, 'Think +', { size: 20, dim: s.apThinkIdx === AP_THINK_STEPS.length - 1 });
    }
    if (C.brand && C.brand.room && sc !== 'over' && sc !== 'autoplay-over') drawBadgeStack(ctx, C.brand.cx, C.brand.bottom, C.brand.w);
    const RS = L.res, k = RS.k, Y = RS.Y, ks = (z) => Math.max(z * k, Math.min(minT, z));
    if (sc === 'autoplay' && s.ap && s.ap.paused) {
      // The viewer's own unlimited-thinking-time pause: dims the frozen board exactly like the result screens dim the final one,
      // then Resume (primary) / Exit sit on top of it.
      drawDim(0.72);
      gold('Paused', RS.cx, Y(700), 60 * k, W - 40);
      button(RS.again, 'Resume', { primary: true, size: 34 });
      button(RS.back, 'Exit', { size: 30 });
    }
    if (sc === 'over') {
      drawDim(0.72);
      const won = g.winner === 1 ? (s.two ? 'Player one wins' : 'You win!') : s.two ? 'Player two wins' : 'The computer wins';
      drawPiece(ctx, g.winner, RS.cx, Y(560), { scale: 3 * k });
      gold(won, RS.cx, Y(720), 66 * k, W - 40);
      text(g.reason, RS.cx, Y(780), fitSize(g.reason, W - 48, ks(26), 500, UI, 17), '#fff3d6', UI, 500);
      text(`${g.throws} throws · ${g.moves} moves`, RS.cx, Y(826), ks(24), 'rgba(246,231,196,0.75)', UI, 500);
      if (!s.two && g.winner === 1) {
        text(`★ ${LEVELS[s.level].name} beaten`, RS.cx, Y(868), ks(26), '#ffd24a', UI, 700);
        if (!s.calm) for (let j = 0; j < 14; j++) { const ph = (s.t * 0.35 + j * 0.137) % 1, x = RS.cx + Math.sin(j * 2.4) * (140 + 90 * ph) * k, y = Y(640 - ph * 380); ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (j % 3) * 2, 0, TAU); ctx.fill(); }
      }
      button(RS.again, 'Play again', { primary: true, size: 34 }); button(RS.back, 'Menu', { size: 30 });
      drawMoreLine(ctx, RS.more.x, RS.more.y, Math.max(20, minT));
    } else if (sc === 'autoplay-over') {
      drawDim(0.72);
      const won = g.winner === 1 ? 'Player A wins' : 'Player B wins';
      drawPiece(ctx, g.winner, RS.cx, Y(560), { scale: 3 * k });
      gold('Auto Play complete', RS.cx, Y(660), 46 * k, W - 40); gold(won, RS.cx, Y(730), 60 * k, W - 40);
      text(g.reason, RS.cx, Y(786), fitSize(g.reason, W - 48, ks(26), 500, UI, 17), '#fff3d6', UI, 500);
      text(`${g.throws} throws · ${g.moves} moves`, RS.cx, Y(832), ks(24), 'rgba(246,231,196,0.75)', UI, 500);
      button(RS.again, 'Watch again', { primary: true, size: 34 }); button(RS.back, 'Exit to menu', { size: 30 });
      drawMoreLine(ctx, RS.more.x, RS.more.y, Math.max(20, minT));
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // Title
  // -------------------------------------------------------------------------------------------------------------
  function drawTitle() {
    const T = L.title(!!s.saved), HR = T.hero, minT = minText();
    if (T.drawBoard) { drawBoardLayer(ctx, { s: 1, ox: L.fx, oy: C.board.oy }); drawTrayLayer(ctx, C.tray); }
    // darken toward the buttons; hero above (all in hero units: the phone look when the hero scale is 1)
    ctx.save(); ctx.translate(HR.hx, HR.hy); ctx.scale(HR.hs, HR.hs);
    const x0 = -HR.hx / HR.hs, wd = W / HR.hs;
    if (T.dimMode === 'tall') {
      const gr = ctx.createLinearGradient(0, 260, 0, 780); gr.addColorStop(0, 'rgba(10,4,0,0.05)'); gr.addColorStop(1, 'rgba(10,4,0,0.94)');
      ctx.fillStyle = gr; ctx.fillRect(0, 260, 720, 1560); ctx.fillStyle = 'rgba(10,4,0,0.94)'; ctx.fillRect(0, 780, 720, 1560 + 600);
      ctx.fillStyle = 'rgba(10,4,0,0.35)'; ctx.fillRect(0, 118, 720, 130);
      ctx.fillStyle = 'rgba(10,4,0,0.45)'; ctx.fillRect(0, 300, 720, 480);
    } else {
      ctx.fillStyle = 'rgba(10,4,0,0.35)'; ctx.fillRect(x0, 118, wd, 150);
      ctx.fillStyle = 'rgba(10,4,0,0.45)'; ctx.fillRect(x0, 300, wd, 480);
    }
    gold('SENET', 360 + HR.dx, 216, 112); text('The board game of ancient Egypt', 360, 262, 27, 'rgba(246,231,196,0.92)', FONT, 600);
    if (HR.hs < 0.62) { /* small hero: keep the tagline, it is the least readable part */ }
    // hero: a cone and a reel stand on a lit pool with the sticks tumbling between them, on a loop
    const bob = s.calm ? 0 : Math.sin(s.t * 1.6) * 3;
    const pool = ctx.createRadialGradient(360, 640, 20, 360, 640, 330); pool.addColorStop(0, 'rgba(255,200,110,0.30)'); pool.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = pool; ctx.fillRect(0, 380, 720, 400);
    drawPiece(ctx, 1, 160, 690 + bob * 0.4, { scale: 2.5 }); drawPiece(ctx, 2, 560, 690 - bob * 0.4, { scale: 2.5 });
    const loop = s.calm ? 1.2 : (s.t % 3.4);
    const roll = { faces: [true, false, true, true], n: 3, t: loop, dur: 1.2, tumbling: loop < 1.2, seeds: [0, 1, 2, 3].map((k) => ({ delay: k * 0.05, flips: 3 + k, b: k * 0.2, dx: (k - 1.5) * 24, spin: (k % 2 ? 1 : -1) * 0.5 })) };
    drawSticks(360, 610, { roll, sc: 0.6 });
    ctx.restore();
    if (T.card) card(T.card, 0.9);
    else if (T.dim) { ctx.fillStyle = 'rgba(10,4,0,0.94)'; ctx.fillRect(T.dim.x, T.dim.y, T.dim.w, T.dim.h); const gr = ctx.createLinearGradient(0, T.dim.y - 40, 0, T.dim.y); gr.addColorStop(0, 'rgba(10,4,0,0)'); gr.addColorStop(1, 'rgba(10,4,0,0.94)'); ctx.fillStyle = gr; ctx.fillRect(0, T.dim.y - 40, W, 40); }
    if (T.lockup) drawLockup(ctx, T.lockup.cx, T.lockup.y, T.lockup.w, 0.92, (s.afFlash || 0) > 0);   // bottom-centre under the menu
    if (sc === 'title') {
      const R = T.rows;
      if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
      button(R.learn, 'Learn to play', { primary: !s.learned && !R.resume, size: 30 });
      button(R.play, 'Play the computer', { primary: s.learned && !R.resume, size: 30 });
      button(R.two, 'Two players, one phone', { size: 28 });
      button(R.daily, s.daily.solvedDay === s.daily.day ? `Daily puzzle: solved · streak ${s.daily.streak}` : s.daily.streak ? `Daily puzzle · streak ${s.daily.streak}` : 'Daily puzzle', { size: 28 });
      button(R.how, 'How to play', { size: 28 });
      button(R.autoplay, 'Auto Play · Watch & Learn', { size: 27 });
      button(R.about, 'About', { size: 26 }); button(R.rules, 'Rules', { size: 26 });
      button(R.level, `Computer: ${LEVELS[s.level].name}`, { size: 22 }); button(R.sound, s.sound ? 'Sound on' : 'Sound off', { size: 22 });
      button(R.calm, s.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 20 }); button(R.big, s.big ? 'Large text: on' : 'Large text: off', { size: 22 });
      const st = T.stars;
      text('Stars', st.x, st.y, 22, 'rgba(246,231,196,0.8)', UI, 600, 'left');
      for (let l = 0; l < LEVELS.length; l++) text('★', st.x + 80 + l * 40, st.y + 2, 32, s.stats.badges['L' + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
      text(`Games played: ${s.stats.games} · won: ${s.stats.wins}`, st.cx, st.played, 22, 'rgba(246,231,196,0.65)', UI, 500);
      if (s.msg) { const fw = fitWrap(s.msg.text, T.msg.w, 110, 24, Math.min(minT, 22), 1.3); fw.ls.forEach((ln, i) => text(ln, T.msg.x, T.msg.y - (fw.ls.length - 1 - i) * fw.lh, fw.size, '#ffe9b0', UI, 600)); }
    } else {
      const RS = L.res, Y = RS.Y;
      drawDim(0.86);
      gold('That was the free taste.', RS.cx, Y(840), 50 * RS.k, W - 40);
      text('Get Senet on iPhone and Android', RS.cx, Y(910), fitSize('Get Senet on iPhone and Android', W - 40, 28, 600, UI, 18), '#fff3d6', UI, 600); text('for unlimited games.', RS.cx, Y(950), 28, '#fff3d6', UI, 600);
      button(RS.back, 'Menu', { size: 30 });
    }
  }

  // -------------------------------------------------------------------------------------------------------------
  // Reference pages: About, How to play (parts of P.parts) and Rules (RULES), one topic per page, scrolling body
  // -------------------------------------------------------------------------------------------------------------
  function drawDoc(P, partsMode) {
    drawDim(0.95);
    const D = L.doc, scale = TEXT_SCALES[s.textScaleIdx] ?? 1, view = D.view;
    const n = partsMode ? P.parts.length : RULES.length;
    // title row (clear of the host's floating back button on the left and of the text-size stepper on the right)
    const tb = D.titleBox, tcx = (tb.x0 + tb.x1) / 2;
    gold(partsMode ? P.title : 'Rules', tcx, tb.y, Math.round(58 * Math.min(scale, 1.15)), tb.x1 - tb.x0);
    const atMin = s.textScaleIdx === 0, atMax = s.textScaleIdx === TEXT_SCALES.length - 1;
    button(D.step.dec, 'A−', { size: 28, dim: atMin }); button(D.step.inc, 'A+', { size: 28, dim: atMax });
    panel(D.panel.x, D.panel.y, D.panel.w, D.panel.h);
    const sc0 = Math.max(0, Math.min(s.docScroll || 0, docMetrics.max));
    const textW = Math.min(view.w - 12, 820), tx = view.x + (view.w - textW) / 2, cx = view.x + view.w / 2;
    const ckey = `${partsMode ? 'p' + P.title : 'r'}|${scale}|${Math.round(textW)}`;
    if (docCache.key !== ckey) { docCache.key = ckey; docCache.h = []; }
    const known = docCache.h.length === n;
    // ONE scrolling document: every authored entry in order. Entries whose height is known and that are off-screen are skipped.
    const drawEntry = (idx, y0) => {
      let y = y0, endY;
      if (partsMode) {
        // The part heading is capped and wrapped separately from the body's own scale, and optional (a continuation part carries none).
        const [h, body] = P.parts[idx], hSize = Math.round(34 * Math.min(scale, 1.3)), hLH = Math.round(hSize * 1.15);
        let hLines = 0;
        if (h) { hLines = wrap(h, tx, y + hSize, hSize, textW, '#efc45c', hLH, 'left'); }
        const ruleY = h ? y + hSize + (hLines - 1) * hLH + 14 : y;
        if (h) { ctx.strokeStyle = 'rgba(230,184,74,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ruleY); ctx.lineTo(tx + textW, ruleY); ctx.stroke(); }
        const size = Math.round(29 * scale), lh = Math.round(size * 1.4), top = (h ? ruleY : y) + Math.round(size * 1.15);
        const nl = wrap(body, tx, top, size, textW, '#f6e7c4', lh, 'left');
        endY = top + (nl - 1) * lh + size * 0.5;
      } else {
        const rp = RULES[idx];
        // The illustrations reuse the board's own real piece/stick drawing - never scaled with the text.
        const artGap = Math.round(Math.max(0, Math.round(28 * scale) - 28) * 0.8);
        if (rp.title && !(idx > 0 && RULES[idx - 1].title === rp.title)) { const hSize = Math.round(40 * Math.min(scale, 1.15)); gold(rp.title, cx, y + hSize, hSize, textW); y += hSize + 28; }
        if (rp.piece) {
          const py = y + 100;
          drawPiece(ctx, 1, cx - 72, py, { scale: 1.4 }); drawPiece(ctx, 2, cx + 72, py, { scale: 1.4 });
          text('Player one', cx - 72, py + 46, 20, 'rgba(246,231,196,0.8)', UI, 600);
          text('Player two', cx + 72, py + 46, 20, 'rgba(246,231,196,0.8)', UI, 600);
          y = py + 90 + artGap;
        } else if (rp.sticks) {
          const cy = y + 36;
          [true, false, true, false].forEach((light, i) => {
            const sp = stickSprite(light);
            ctx.save(); ctx.translate(cx + (i - 1.5) * 90, cy); ctx.scale(0.6, 0.6);
            if (sp) ctx.drawImage(sp, -STICK.w / 2, -STICK.h / 2, STICK.w, STICK.h);
            ctx.restore();
          });
          y = cy + 60 + artGap;
        }
        const size = Math.round(28 * scale), lh = Math.round(size * 1.4);
        y += size * 0.6;
        for (const line of rp.lines) { const nl = wrap(line, cx, y, size, textW, '#f6e7c4', lh, 'center'); y += nl * lh + 18; }
        endY = y - size * 0.4;
      }
      return endY;
    };
    ctx.save(); ctx.beginPath(); ctx.rect(view.x - 6, view.y, view.w + 12, view.h); ctx.clip(); ctx.translate(0, -sc0); clipOn = true;
    let y = view.y + 8, topIdx = -1;
    const GAPY = partsMode ? 26 : 10;
    for (let i = 0; i < n; i++) {
      const hKnown = docCache.h[i];
      if (known && (y + hKnown < view.y + sc0 - 40 || y > view.y + sc0 + view.h + 40)) { y += hKnown + GAPY; if (y - GAPY <= view.y + sc0 + 20) topIdx = i; continue; }
      const end = drawEntry(i, y); docCache.h[i] = end - y; y = end + GAPY;
      if (y - GAPY <= view.y + sc0 + 20) topIdx = i;
    }
    const endY = y - GAPY;
    ctx.restore(); clipOn = false;
    s.docIdx = Math.min(n - 1, topIdx + 1);
    const contentH = endY - view.y + 12;
    docMetrics.view = view.h; docMetrics.max = contentH - view.h <= 6 ? 0 : Math.ceil(contentH - view.h);
    if (docMetrics.max > 0) {                                        // scroll bar
      const sb = D.scrollbar, th = Math.max(48, sb.h * view.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(246,231,196,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 8); ctx.fill();
      ctx.fillStyle = 'rgba(230,184,74,0.75)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 8); ctx.fill();
      text(`${Math.round(100 * sc0 / docMetrics.max)}%`, D.panel.x + D.panel.w / 2, D.counterY, 22, 'rgba(246,231,196,0.7)', UI, 600);
    }
    const hasPrev = sc0 > 1, hasNext = docMetrics.max > 0 && sc0 < docMetrics.max - 1;
    if (hasPrev) button(D.nav.prev, 'Previous', { size: 24 });
    button(D.nav.back, hasNext ? 'Back' : 'Done', { size: 26 });
    if (hasNext) button(D.nav.next, 'Next', { size: 24, primary: true });
  }
}
