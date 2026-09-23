// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The chamber, board and pieces are cached bitmaps (art.js).
import { W, H, BTN, TRAY, EXIT, cell, titleRows, PAGE, TEXT_STEPPER, TEXT_SCALES, AP_THINK_STEPS } from './layout.js';
import { drawScene, drawPiece, stickSprite, STICK } from './art.js';
import { legalMoves } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOW, RULES } from './about.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, IVORY = '#f6e7c4';
const FOOT = 20;                                     // a piece's foot sits this far below the middle of its square
const NAMES = (s) => (s.scene === 'autoplay' || s.scene === 'autoplay-over' ? ['Player A', 'Player B'] : s.two ? ['Player one', 'Player two'] : ['You', 'Computer']);

export function render(ctx, s) {
  drawScene(ctx, s.t, s.calm);
  const sc = s.scene;
  const text = (str, x, y, size, color = IVORY, font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const gold = (str, x, y, size) => {                // gilded display lettering
    ctx.textAlign = 'center'; ctx.font = `700 ${size}px ${FONT}`;
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.09; ctx.strokeStyle = 'rgba(30,12,2,0.9)'; ctx.strokeText(str, x, y + 3);
    const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.1); g.addColorStop(0, '#fff4c2'); g.addColorStop(0.5, '#efc45c'); g.addColorStop(1, '#a8761c');
    ctx.fillStyle = g; ctx.fillText(str, x, y);
  };
  const lines = (str, maxW, size, weight = 600) => { ctx.font = `${weight} ${size}px ${UI}`; const out = []; let cur = ''; for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; } out.push(cur); return out; };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center') => { const ls = lines(str, maxW, size); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, 600, align)); return ls.length; };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, 16); ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { g.addColorStop(0, '#f7e4a0'); g.addColorStop(1, '#c89a3a'); } else { g.addColorStop(0, '#4a3226'); g.addColorStop(1, '#1e130d'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(90,50,10,0.8)' : 'rgba(230,184,74,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = o.primary ? 'rgba(255,255,230,0.55)' : 'rgba(230,184,74,0.3)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, 12); ctx.stroke();
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 28) * 0.35, o.size ?? 28, o.primary ? '#2a1606' : IVORY, UI, 700);
    ctx.restore();
  };
  const panel = (x, y, w, h) => { ctx.fillStyle = 'rgba(14,6,2,0.78)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.55)'; ctx.lineWidth = 2; ctx.stroke(); };
  const footOf = (i) => { const k = cell(i); return { x: k.cx, y: k.cy + FOOT }; };

  // where the moving piece is: { x, y, lift, alpha, scale }
  const a = s.anim, g = s.g;
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

  const boardScene = sc === 'play' || sc === 'over' || sc === 'lesson' || sc === 'autoplay' || sc === 'autoplay-over' || (sc === 'puzzle' && s.pz.status !== 'making');
  if (boardScene) drawBoardScene();
  if (sc === 'title' || sc === 'demo-limit') drawTitle();
  if (sc === 'about' || sc === 'how') drawPage(sc === 'about' ? ABOUT : HOW);
  if (sc === 'rules') drawRulesPage();
  if (sc === 'puzzle' && s.pz.status === 'making') { drawDim(0.5); text("Preparing today's puzzle…", 360, 800, 34, '#fff3d6', UI, 600); button(BTN.menu, 'Menu', { size: 26 }); }
  return;

  function drawDim(al) { ctx.fillStyle = `rgba(10,4,0,${al})`; ctx.fillRect(0, 0, W, H); }

  // -------------------------------------------------------------------------------------------------------------
  function drawSticks(ocx, ocy, opts = {}) {
    const sc0 = opts.sc ?? 1, cx0 = ocx ?? TRAY.x + 255, cy0 = ocy ?? TRAY.y + 71;
    // sticks resting or tumbling in the tray. roll = { faces, n, t, dur, seeds }
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
    const roll = s.roll, pulse = s.calm ? 0.6 : 0.5 + 0.5 * Math.sin(s.t * 4);
    drawSticks(undefined, undefined, { roll });
    const canThrow = sc !== 'autoplay' && sc !== 'autoplay-over' && s.phase === 'need' && (s.two || g.turn === 1) && !g.winner;
    if (canThrow) {                                          // invitation: a glow around the tray and a caption
      ctx.strokeStyle = `rgba(255,224,120,${0.4 + pulse * 0.5})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.roundRect(TRAY.x - 2, TRAY.y - 2, TRAY.w + 4, TRAY.h + 4, 24); ctx.stroke();
      text('TAP the sticks to throw', TRAY.x + TRAY.w / 2, TRAY.y - 12, 26, '#ffe9b0', UI, 700);
    }
    // result bubble
    const bx = TRAY.x + TRAY.w - 76, by = TRAY.y + 71;
    const shown = roll && !roll.tumbling && (s.phase !== 'need' || g.n) ? roll.n : 0;
    ctx.fillStyle = 'rgba(10,4,0,0.55)'; ctx.beginPath(); ctx.arc(bx, by, 50, 0, TAU); ctx.fill();
    ctx.strokeStyle = shown ? '#e6b84a' : 'rgba(230,184,74,0.35)'; ctx.lineWidth = 3; ctx.stroke();
    if (shown) { gold(String(shown), bx, by + 22, 70); text(shown === 5 ? 'none light' : `${shown} light`, bx, by + 66, 20, '#ffe9b0', UI, 600); }
    else text('?', bx, by + 22, 62, 'rgba(255,233,176,0.45)');
    if (g.extra && s.phase === 'need' && !g.winner) text('Throw again!', TRAY.x + TRAY.w / 2, TRAY.y + TRAY.h + 30, 26, '#ffd24a', UI, 700);
  }

  function drawBoardScene() {
    const kb = s.kb && sc !== 'over';
    // header
    if (sc === 'lesson' || sc === 'puzzle') { ctx.fillStyle = 'rgba(14,6,2,0.86)'; ctx.beginPath(); ctx.roundRect(24, 100, 672, 214, 18); ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.6)'; ctx.lineWidth = 2; ctx.stroke(); }
    if (sc === 'lesson') {
      const l = LESSONS[s.lesson.i];
      text(`Lesson ${s.lesson.i + 1} of ${LESSONS.length}`, 360, 128, 22, 'rgba(246,231,196,0.85)', UI, 600);
      gold(l.title, 360, 176, 46);
      const body = s.lesson.done ? l.done : l.text;
      wrap(body, 360, 212, s.big ? 24 : 21, 620, s.lesson.done ? '#c9f7c0' : '#ffffff', s.big ? 29 : 26);
    } else if (sc === 'puzzle') {
      text('Daily puzzle', 360, 128, 22, 'rgba(246,231,196,0.85)', UI, 600);
      gold('Find the best move', 360, 176, 44);
      const P = s.pz;
      wrap(P.status === 'solved' ? `Solved${P.tries ? ' after ' + P.tries + ' wrong tr' + (P.tries === 1 ? 'y' : 'ies') : ' at the first try'}. ${P.puzzle.why} Streak ${s.daily.streak}.` : `It is ${g.turn === 1 ? 'the cones' : 'the reels'}' move and the throw is ${g.n}. TAP the piece you would move, then its square.`, 360, 212, s.big ? 24 : 21, 620, P.status === 'solved' ? '#c9f7c0' : '#fff3d6', 27);
    } else {
      gold('Senet', 410, 128, 52);
      const nm = NAMES(s);
      for (let p = 1; p <= 2; p++) {
        const x = p === 1 ? 36 : 372, act = !g.winner && g.turn === p;
        panel(x, 150, 312, 82);
        if (act) { ctx.strokeStyle = `rgba(255,224,120,${s.calm ? 0.9 : 0.6 + 0.35 * Math.sin(s.t * 5)})`; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.roundRect(x, 150, 312, 82, 16); ctx.stroke(); }
        drawPiece(ctx, p, x + 40, 214, { scale: 0.72 });
        text(nm[p - 1], x + 78, 186, 23, '#fff3d6', UI, 700, 'left');
        text(act ? (s.thinking || s.phase === 'think' ? 'thinking…' : 'to play') : 'waiting', x + 80, 212, 19, 'rgba(246,231,196,0.7)', UI, 500, 'left');
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + 206 + k * 21, 176, 8, 0, TAU); ctx.fillStyle = k < g.off[p - 1] ? '#e6b84a' : 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.7)'; ctx.lineWidth = 1.5; ctx.stroke(); }
        text(`home ${g.off[p - 1]} of 5`, x + 256, 212, 17, 'rgba(246,231,196,0.75)', UI, 500);
      }
      if (!s.two && sc !== 'autoplay' && sc !== 'autoplay-over') text(`Computer: ${LEVELS[s.level].name}`, 360, 246, 18, 'rgba(246,231,196,0.6)', UI, 500);
      else if (sc === 'autoplay') {
        const ap = s.ap, cap = ap && ap.phase === 'reveal' ? 'Here is the move' : `Auto Play · pause ${AP_THINK_STEPS[s.apThinkIdx]}s`;
        text(cap, 360, 246, 18, 'rgba(246,231,196,0.75)', UI, 500);
      }
    }

    // squares that glow: destinations of the selected piece, or the hint
    const pulse = s.calm ? 0.6 : 0.5 + 0.5 * Math.sin(s.t * 6);
    // Auto Play only reveals legal-move glow during its own REVEAL sub-phase (state.ap.phase), never
    // throughout the whole 'choose' phase the way a human turn does - THINK must show nothing.
    const human = sc === 'autoplay' ? !!(s.ap && s.ap.phase === 'reveal') : s.phase === 'choose' && !a && !g.winner && (s.two || g.turn === 1 || sc !== 'play');
    const moves = human ? legalMoves(g) : [];
    const labels = [];
    const shade = (i, rgb, label) => { const k = cell(i); ctx.fillStyle = `rgba(${rgb},${0.3 + pulse * 0.25})`; ctx.beginPath(); ctx.roundRect(k.x + 6, k.y + 6, k.w - 12, k.h - 12, 7); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},0.95)`; ctx.lineWidth = 3; ctx.stroke(); if (label) labels.push([label, k]); };
    const exitGlow = (rgb) => { ctx.fillStyle = `rgba(${rgb},${0.35 + pulse * 0.3})`; ctx.beginPath(); ctx.roundRect(EXIT.x + 2, EXIT.y - 6, EXIT.w - 4, EXIT.h + 2, [0, 0, 12, 12]); ctx.fill(); ctx.strokeStyle = `rgba(${rgb},0.95)`; ctx.lineWidth = 3; ctx.stroke(); text('HOME', EXIT.cx, EXIT.cy + 34, 16, '#fff', UI, 800); };
    if (s.sel >= 0) for (const m of moves) if (m.from === s.sel) { if (m.off) exitGlow('120,255,170'); else shade(m.dest, m.water ? '255,96,72' : m.swap >= 0 ? '255,215,90' : '120,255,170', m.water ? 'WATER' : m.swap >= 0 ? 'SWAP' : ''); }
    // "NEXT" (not "HINT") during Auto Play's REVEAL: this is the move about to be played, not a
    // hint the player asked for.
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
    for (const [label, k] of labels) { ctx.fillStyle = 'rgba(20,8,2,0.75)'; ctx.beginPath(); ctx.roundRect(k.x + k.w - 66, k.y + 10, 56, 22, 8); ctx.fill(); text(label, k.x + k.w - 38, k.y + 27, 15, '#fff', UI, 800); }
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

    drawTray();

    // message
    if (s.msg && sc !== 'over') {
      const al = Math.min(1, s.msg.t / 0.15) * Math.min(1, (s.msg.hold - s.msg.t) / 0.5), ms = s.big ? 29 : 23, lh = s.big ? 37 : 30;
      ctx.save(); ctx.globalAlpha = Math.max(0, al);
      const ls = lines(s.msg.text, 590, ms), h = 24 + ls.length * lh, y0 = sc === 'play' ? 262 : 700 - h + 60;
      const yy = sc === 'play' ? y0 : Math.min(y0, 330);
      ctx.fillStyle = 'rgba(18,8,3,0.93)'; ctx.beginPath(); ctx.roundRect(40, yy, 640, h, 16); ctx.fill(); ctx.strokeStyle = 'rgba(230,184,74,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      ls.forEach((ln, i) => text(ln, 360, yy + 34 + i * lh, ms, '#fff3d6', UI, 600));
      ctx.restore();
    }
    if (sc === 'play') { button(BTN.menu, 'Menu', { size: 26 }); button(BTN.undo, 'Take back', { size: 26, dim: !s.undo.length }); button(BTN.hint, `Hint (${s.hintsLeft})`, { size: 26, dim: s.hintsLeft <= 0 }); }
    else if (sc === 'lesson') { button(BTN.menu, 'Menu', { size: 26 }); if (s.lesson.done) button(BTN.next, s.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (sc === 'puzzle') { button(BTN.menu, 'Menu', { size: 26 }); if (s.pz.status === 'solved') button(BTN.share, 'Share result', { primary: true, size: 30 }); }
    else if (sc === 'autoplay' && s.ap && s.ap.paused) {
      // The viewer's own unlimited-thinking-time pause - dims the frozen board exactly like the
      // result screens dim the final one, then Resume (primary, same spot/size as `again`) / Exit
      // (same spot/size as `back`) sit on top of it.
      drawDim(0.72);
      gold('Paused', 360, 700, 60);
      button(BTN.again, 'Resume', { primary: true, size: 34 });
      button(BTN.back, 'Exit', { size: 30 });
    } else if (sc === 'autoplay') {
      button(BTN.apExit, 'Exit', { size: 22 });
      button(BTN.apPause, 'Pause', { size: 22 });
      button(BTN.apDec, 'Think −', { size: 20, dim: s.apThinkIdx === 0 });
      button(BTN.apInc, 'Think +', { size: 20, dim: s.apThinkIdx === AP_THINK_STEPS.length - 1 });
    }
    if (sc === 'over') {
      drawDim(0.72);
      const won = g.winner === 1 ? (s.two ? 'Player one wins' : 'You win!') : s.two ? 'Player two wins' : 'The computer wins';
      const px = drawPiece; px(ctx, g.winner, 360, 560, { scale: 3 });
      gold(won, 360, 720, 66); text(g.reason, 360, 780, 26, '#fff3d6', UI, 500);
      text(`${g.throws} throws · ${g.moves} moves`, 360, 826, 24, 'rgba(246,231,196,0.75)', UI, 500);
      if (!s.two && g.winner === 1) {
        text(`★ ${LEVELS[s.level].name} beaten`, 360, 868, 26, '#ffd24a', UI, 700);
        if (!s.calm) for (let k = 0; k < 14; k++) { const ph = (s.t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (140 + 90 * ph), y = 640 - ph * 380; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill(); }
      }
      button(BTN.again, 'Play again', { primary: true, size: 34 }); button(BTN.back, 'Menu', { size: 30 });
    } else if (sc === 'autoplay-over') {
      drawDim(0.72);
      const won = g.winner === 1 ? 'Player A wins' : 'Player B wins';
      const px = drawPiece; px(ctx, g.winner, 360, 560, { scale: 3 });
      gold('Auto Play complete', 360, 660, 46); gold(won, 360, 730, 60); text(g.reason, 360, 786, 26, '#fff3d6', UI, 500);
      text(`${g.throws} throws · ${g.moves} moves`, 360, 832, 24, 'rgba(246,231,196,0.75)', UI, 500);
      button(BTN.again, 'Watch again', { primary: true, size: 34 }); button(BTN.back, 'Exit to menu', { size: 30 });
    }
  }

  function drawTitle() {
    // darken toward the buttons; hero above
    const gr = ctx.createLinearGradient(0, 260, 0, 780); gr.addColorStop(0, 'rgba(10,4,0,0.05)'); gr.addColorStop(1, 'rgba(10,4,0,0.94)');
    ctx.fillStyle = gr; ctx.fillRect(0, 260, W, H - 260); ctx.fillStyle = 'rgba(10,4,0,0.94)'; ctx.fillRect(0, 780, W, H - 780);
    ctx.fillStyle = 'rgba(10,4,0,0.35)'; ctx.fillRect(0, 118, W, 130);
    ctx.fillStyle = 'rgba(10,4,0,0.45)'; ctx.fillRect(0, 300, W, 480);
    gold('SENET', 410, 216, 112); text('The board game of ancient Egypt', 360, 262, 27, 'rgba(246,231,196,0.92)', FONT, 600);
    // hero: a cone and a reel stand on a lit pool with the sticks tumbling between them, on a loop
    const bob = s.calm ? 0 : Math.sin(s.t * 1.6) * 3;
    const pool = ctx.createRadialGradient(360, 640, 20, 360, 640, 330); pool.addColorStop(0, 'rgba(255,200,110,0.30)'); pool.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = pool; ctx.fillRect(0, 380, W, 400);
    drawPiece(ctx, 1, 160, 690 + bob * 0.4, { scale: 2.5 }); drawPiece(ctx, 2, 560, 690 - bob * 0.4, { scale: 2.5 });
    const loop = s.calm ? 1.2 : (s.t % 3.4);
    const roll = { faces: [true, false, true, true], n: 3, t: loop, dur: 1.2, tumbling: loop < 1.2, seeds: [0, 1, 2, 3].map((k) => ({ delay: k * 0.05, flips: 3 + k, b: k * 0.2, dx: (k - 1.5) * 24, spin: (k % 2 ? 1 : -1) * 0.5 })) };
    drawSticks(360, 610, { roll, sc: 0.6 });
    if (sc === 'title') {
      const R = titleRows(!!s.saved);
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
      const by = R.big.y + 96;
      text('Stars', 96, by, 22, 'rgba(246,231,196,0.8)', UI, 600, 'left');
      for (let l = 0; l < LEVELS.length; l++) text('★', 176 + l * 40, by + 2, 32, s.stats.badges['L' + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
      text(`Games played: ${s.stats.games} · won: ${s.stats.wins}`, 360, by + 46, 22, 'rgba(246,231,196,0.65)', UI, 500);
      if (s.msg) wrap(s.msg.text, 360, 770, 24, 620, '#ffe9b0');
    } else {
      gold('That was the free taste.', 360, 900, 50);
      text('Get Senet on iPhone and Android', 360, 970, 28, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1010, 28, '#fff3d6', UI, 600);
      button(BTN.back, 'Menu', { size: 30 });
    }
  }

  function drawPage(P) {
    drawDim(0.95);
    // Text scale for these reference pages only (independent of the gameplay "Large text" setting,
    // which affects lesson/puzzle banners elsewhere, not this reading screen). Always guarded: an
    // out-of-range saved index (e.g. from a shorter TEXT_SCALES array) falls back to 1, never NaN.
    const scale = TEXT_SCALES[s.textScaleIdx] ?? 1;
    // Paginated one part per page (like Rules) so a bigger text-size step never has to cram every
    // part onto one screen.
    const n = P.parts.length, idx = Math.max(0, Math.min(n - 1, s.page)), [h, body] = P.parts[idx];
    gold(P.title, 360, 200, Math.round(64 * Math.min(scale, 1.15)));
    panel(40, 240, 640, 1180);
    // The part heading (h) is capped and wrapped separately from the body's own scale, and optional
    // (a continuation part carries none) - at the top text-size steps an uncapped, unwrapped heading
    // like "The rules are reconstructed" ran off the right edge of the panel instead of reliably
    // fitting one line, and most parts are now split down to roughly one sentence to fit at 300%.
    const hSize = Math.round(34 * Math.min(scale, 1.3)), hLH = Math.round(hSize * 1.15);
    const hLines = h ? wrap(h, 76, 300, hSize, 560, '#efc45c', hLH, 'left') : 0;
    const ruleY = h ? 316 + (hLines - 1) * hLH + 8 : 292;
    if (h) { ctx.strokeStyle = 'rgba(230,184,74,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(76, ruleY); ctx.lineTo(644, ruleY); ctx.stroke(); }
    const size = Math.round(29 * scale);
    wrap(body, 76, ruleY + Math.round(size * 1.1), size, 600, '#f6e7c4', Math.round(size * 1.4), 'left');
    text(`Page ${idx + 1} of ${n}`, 360, 1392, 22, 'rgba(246,231,196,0.7)', UI, 600);
    const hasPrev = idx > 0, hasNext = idx < n - 1;
    if (hasPrev) button(PAGE.prev, 'Previous', { size: 24 });
    button(PAGE.back, 'Back', { size: 26 });
    if (hasNext) button(PAGE.next, 'Next', { size: 24, primary: true });
    const atMin = s.textScaleIdx === 0, atMax = s.textScaleIdx === TEXT_SCALES.length - 1;
    button(TEXT_STEPPER.dec, 'A−', { size: 28, dim: atMin });
    button(TEXT_STEPPER.inc, 'A+', { size: 28, dim: atMax });
  }

  // Exhaustive rules reference, one topic per page: RULES (about.js) is the content, cross-checked against
  // rules.js. Piece and stick art reuse the exact same drawPiece()/stickSprite() the board itself uses.
  function drawRulesPage() {
    drawDim(0.95);
    // Text scale for this reference page only (independent of the gameplay "Large text" setting).
    // Always guarded: an out-of-range saved index (e.g. from a shorter TEXT_SCALES array) falls
    // back to 1, never NaN.
    const scale = TEXT_SCALES[s.textScaleIdx] ?? 1;
    const idx = ((s.rulesPage % RULES.length) + RULES.length) % RULES.length, P = RULES[idx];
    text('Rules', 360, 152, Math.round(22 * Math.min(scale, 1.15)), 'rgba(246,231,196,0.8)', UI, 600);
    // The section title is optional - a continuation page (most pages, now split down to roughly
    // one sentence each to fit at 300%) carries none.
    if (P.title) gold(P.title, 360, 210, Math.round(44 * Math.min(scale, 1.15)));
    // Panel height and footer now match the About/How reader pages exactly (was a shorter 1000px
    // panel with its own Menu/Back/Next row sitting lower down) - see the nav row fix below.
    panel(30, 240, 660, 1180);
    let y = 300;
    // Illustrations reuse the board's own real piece/stick drawing functions - never scaled with
    // the text, so they always match what is on the board. The gap below the art must still grow
    // with the BODY's own font size, though - at the top text-size steps a fixed gap let the much
    // larger body text's own ascent climb back up into the art and its "Player one/two" labels.
    const artGap = Math.round(Math.max(0, Math.round(28 * scale) - 28) * 0.8);
    if (P.piece) {
      const py = 350;
      drawPiece(ctx, 1, 288, py, { scale: 1.4 }); drawPiece(ctx, 2, 432, py, { scale: 1.4 });
      text('Player one', 288, py + 46, 18, 'rgba(246,231,196,0.75)', UI, 600);
      text('Player two', 432, py + 46, 18, 'rgba(246,231,196,0.75)', UI, 600);
      y = py + 90 + artGap;
    } else if (P.sticks) {
      const cy = 350;
      [true, false, true, false].forEach((light, i) => {
        const sp = stickSprite(light);
        ctx.save(); ctx.translate(360 + (i - 1.5) * 90, cy); ctx.scale(0.6, 0.6);
        if (sp) ctx.drawImage(sp, -STICK.w / 2, -STICK.h / 2, STICK.w, STICK.h);
        ctx.restore();
      });
      y = cy + 60 + artGap;
    }
    const size = Math.round(28 * scale);
    for (const line of P.lines) { const n = wrap(line, 360, y, size, 600, '#f6e7c4', Math.round(size * 1.4), 'center'); y += n * Math.round(size * 1.4) + 18; }
    text(`Page ${idx + 1} of ${RULES.length}`, 360, 1392, 22, 'rgba(246,231,196,0.7)', UI, 600);
    // Same three-slot Previous/Back/Next row as the About/How pages (PAGE.prev/back/next): Back is
    // always shown, centred, and always exits to the title; Previous/Next page within Rules and
    // only appear once there is somewhere to go, so they never collide with Back. This used to be a
    // second, different nav convention just for this one screen (BTN.menu/undo/hint, labelled
    // Menu/Back/Next, where "Back" actually meant "previous page" - the opposite of what "Back"
    // means on the About/How pages one tap away) - now all three reference pages agree.
    const hasPrev = idx > 0, hasNext = idx < RULES.length - 1;
    if (hasPrev) button(PAGE.prev, 'Previous', { size: 24 });
    button(PAGE.back, 'Back', { size: 26 });
    if (hasNext) button(PAGE.next, 'Next', { size: 24, primary: true });
    const atMin = s.textScaleIdx === 0, atMax = s.textScaleIdx === TEXT_SCALES.length - 1;
    button(TEXT_STEPPER.dec, 'A−', { size: 28, dim: atMin });
    button(TEXT_STEPPER.inc, 'A+', { size: 28, dim: atMax });
  }
}
