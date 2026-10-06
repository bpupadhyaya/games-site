// Everything drawn each frame. Reads `state` (game.js) and the live layout `L` (layout.js); changes nothing. Static art is cached (art.js).
import { TEXT_SCALES, AP_THINK_STEPS, host } from './layout.js';
import { drawScene, drawPiece, braid } from './art.js';
import { SIZES, NAME, ATT, DEF, KING, isCorner } from './rules.js';
import { destinations } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { PAGES, RULES } from './pages.js';
import { drawCredit, drawTitleLockup, drawLockup, drawMoreLine, drawBadgeStack } from './brand.js';

const FONT = '"Cinzel", "Cormorant Garamond", Georgia, serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2, GOLD = '#f0cf86', CREAM = '#fff1d2';
const letter = (v) => (v === ATT ? 'A' : v === KING ? 'K' : 'D');
// About / Rules scroll limits, measured while drawing and read by game.js to clamp scrolling.
export const pageMetrics = { max: 0, view: 0 };
// Reader layout cache (wrapped lines + total height). readerStats.layouts counts rebuilds (tests read it).
const readerCache = { pages: null, key: '', items: [], endY: 0 };
export const readerStats = { layouts: 0 };

export function render(ctx, state, L) {
  const g = state.game, a = state.anim, scene = state.scene, n = g.n, cs = L.cell(n), K = L.k, big = state.big, calm = state.calm;
  const W = L.w, H = L.h, cx = W / 2;
  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz.status !== 'making') || scene === 'autoplay';
  drawScene(ctx, boardScene ? n : 0, state.t, calm, L);

  // Text never below ~11 css px (a virtual unit is host.px css pixels).
  const floor = Math.min(24, 11 / Math.max(0.25, host.px));
  const fs = (s) => Math.max(s, floor);
  const setFont = (size, font, weight) => { ctx.font = `${weight} ${size}px ${font}`; };
  const measure = (str, size, font = UI, weight = 600) => { setFont(size, font, weight); return ctx.measureText(str).width; };
  // single line, shrunk (never below the floor) to fit maxW, then squeezed as a last resort
  const text = (str, x, y, size, color = GOLD, font = UI, weight = 700, align = 'center', maxW = 0) => {
    let s = fs(size);
    if (maxW) { const wd = measure(str, s, font, weight); if (wd > maxW) s = Math.max(floor, Math.floor(s * maxW / wd)); }
    ctx.textAlign = align; setFont(s, font, weight); ctx.fillStyle = color;
    if (maxW) ctx.fillText(str, x, y, maxW); else ctx.fillText(str, x, y);
  };
  const shadowText = (str, x, y, size, color = GOLD, font = FONT, weight = 800, maxW = 0) => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; text(str, x, y, size, color, font, weight, 'center', maxW); ctx.restore(); };
  const wrapLines = (str, size, maxW, weight = 600) => {
    setFont(size, UI, weight); const lines = []; let cur = '';
    for (const w of str.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); return lines;
  };
  // wrapped block, first baseline at y; align 'center' draws about x, 'left' from x
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center', weight = 600) => { const ls = wrapLines(str, fs(size), maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  // text that must fit a rectangle: shrinks (to the floor) until it fits; first baseline is inside the rect
  const fitBlock = (str, r, size, lh0, color, align = 'center', weight = 600) => {
    let s = fs(size), lh = lh0, ls = wrapLines(str, s, r.w, weight);
    while (ls.length * lh > r.h && s > floor) { s -= 1; lh = lh0 * s / size; ls = wrapLines(str, s, r.w, weight); }
    const maxLines = Math.max(1, Math.floor(r.h / lh));
    if (ls.length > maxLines) ls = ls.slice(0, maxLines);
    const x = align === 'center' ? r.x + r.w / 2 : r.x;
    ls.forEach((ln, i) => text(ln, x, r.y + s * 0.95 + i * lh, s, color, UI, weight, align));
    return ls.length;
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(16, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f2d189'); gr.addColorStop(0.5, '#cf9d45'); gr.addColorStop(1, '#8f6320'); } else { gr.addColorStop(0, '#5d3d22'); gr.addColorStop(0.55, '#3b2412'); gr.addColorStop(1, '#251409'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,240,190,0.9)' : 'rgba(224,180,100,0.75)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = o.primary ? '#3a2208' : GOLD; ctx.textAlign = 'center';
    const fam = o.ui ? UI : FONT, maxW = r.w - 24;
    let sz = fs(o.size ?? 28); const lines = [label];
    if (measure(label, sz, fam, 700) > maxW) {
      let s2 = sz; while (s2 > floor && measure(label, s2, fam, 700) > maxW) s2 -= 1;
      if (measure(label, s2, fam, 700) <= maxW) sz = s2;
      else if (r.h >= 2 * floor * 1.15 + 10 && label.includes(' ')) {          // two lines
        const words = label.split(' '); let best = 1, bd = 1e9;
        for (let i = 1; i < words.length; i++) { const d = Math.abs(measure(words.slice(0, i).join(' '), sz, fam, 700) - measure(words.slice(i).join(' '), sz, fam, 700)); if (d < bd) { bd = d; best = i; } }
        lines.length = 0; lines.push(words.slice(0, best).join(' '), words.slice(best).join(' '));
        while (sz > floor && lines.some((t2) => measure(t2, sz, fam, 700) > maxW) ) sz -= 1;
      } else sz = s2;
    }
    setFont(sz, fam, 700);
    ctx.shadowColor = o.primary ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    const lh = sz * 1.15;
    lines.forEach((t2, i) => ctx.fillText(t2, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.34 + (i - (lines.length - 1) / 2) * lh, maxW));
    ctx.restore();
  };
  const panel = (x, y, w, h, rad = 20) => { ctx.fillStyle = 'rgba(14,7,3,0.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.fill(); ctx.strokeStyle = 'rgba(224,180,100,0.7)'; ctx.lineWidth = 2; ctx.stroke(); };
  const card = (r) => { ctx.fillStyle = 'rgba(14,7,3,0.80)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill(); ctx.strokeStyle = 'rgba(224,180,100,0.55)'; ctx.lineWidth = 2; ctx.stroke(); };
  const pulse = calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 6);
  const BTN = L.BTN, AP = L.AP, HUD = L.hud;

  // ---- the board and what stands on it --------------------------------------------------------------------------------
  const ctr = (i) => L.centerOf(n, i);
  const glowSq = (i, rgb, al) => { const c = ctr(i); ctx.fillStyle = `rgba(${rgb},${al})`; ctx.fillRect(c.x - cs / 2 + 2, c.y - cs / 2 + 2, cs - 4, cs - 4); };
  const animPos = () => {
    const f = Math.min(1, a.t / a.dur), from = ctr(a.from), to = ctr(a.to);
    if (a.type === 'refuse') {
      const reach = a.to === a.from ? 0 : g.b[a.to] ? 0.5 : 0.9;
      const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4, e = out * out * (3 - 2 * out) * reach;
      const shake = calm ? 0 : f >= 0.36 && f < 0.64 ? Math.sin(f * 90) * 4 * K : 0;
      return { x: from.x + (to.x - from.x) * e + shake, y: from.y + (to.y - from.y) * e, lift: 0.5 * Math.sin(Math.PI * Math.min(1, f * 1.1)) };
    }
    const e = f * f * (3 - 2 * f);
    return { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, lift: Math.sin(Math.PI * f) * 0.6 };
  };
  const piece = (kind, x, y, o = {}) => drawPiece(ctx, n, kind, x, y, { ...o, scale: K * (o.scale ?? 1) });
  const drawBoard = () => {
    if (g.last && scene !== 'lesson' && scene !== 'puzzle') { glowSq(g.last.from, '255,200,110', 0.16); glowSq(g.last.to, '255,200,110', 0.22); }
    if (scene === 'lesson' && !state.lesson.done) for (const [x, y] of LESSONS[state.lesson.i].at ?? []) {
      const c = ctr(x + n * y); ctx.strokeStyle = `rgba(255,220,120,${0.55 + pulse * 0.4})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, cs * (0.34 + pulse * 0.05), 0, TAU); ctx.stroke();
    }
    if (state.marks && g.king >= 0 && scene !== 'over') {
      const k = g.king;
      for (const d of [1, -1, n, -n]) {
        let i = k, path = [];
        for (;;) {
          const x = i % n, y = (i / n) | 0;
          if ((d === 1 && x === n - 1) || (d === -1 && x === 0) || (d === n && y === n - 1) || (d === -n && y === 0)) break;
          i += d; if (g.b[i] !== 0) { path = []; break; } path.push(i);
        }
        if (path.length && isCorner(n, path[path.length - 1])) for (const s of path) glowSq(s, '255,150,50', 0.16 + pulse * 0.16);
      }
    }
    if (state.sel >= 0 && !a) {
      glowSq(state.sel, '255,236,150', 0.25 + pulse * 0.15);
      for (const to of destinations(g, state.sel)) { const c = ctr(to); ctx.fillStyle = `rgba(255,232,150,${0.5 + pulse * 0.3})`; ctx.beginPath(); ctx.arc(c.x, c.y, cs * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(60,35,10,0.6)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    if (state.hint && !a) { glowSq(state.hint.from, '120,255,170', 0.28 + pulse * 0.2); glowSq(state.hint.to, '120,255,170', 0.28 + pulse * 0.2); }
    const dragFrom = state.drag && state.drag.moved ? state.drag.from : -1;
    for (let i = 0; i < n * n; i++) {
      const v = g.b[i]; if (!v) continue;
      if (a && ((a.type !== 'refuse' && i === a.to) || (a.type === 'refuse' && i === a.from))) continue;
      if (i === dragFrom) continue;
      const c = ctr(i), sel = state.sel === i;
      piece(letter(v), c.x, c.y, { lift: sel ? 0.6 + (calm ? 0 : Math.sin(state.t * 3) * 0.08) : 0 });
    }
    if (a && a.type === 'move' && a.caps.length) for (const cp of a.caps) { const c = ctr(cp.at), f = Math.min(1, a.t / a.dur); piece(letter(cp.v), c.x, c.y, { alpha: Math.max(0, 1 - f * 1.5), scale: 1 - f * 0.25 }); }
    if (a) { const p = animPos(); piece(letter(a.v), p.x, p.y, { lift: p.lift }); }
    if (dragFrom >= 0) piece(letter(g.b[dragFrom]), state.drag.x, state.drag.y - 10 * K, { lift: 1 });
    if (a && a.type === 'move' && a.caps.length && !calm && a.t / a.dur > 0.4) for (const cp of a.caps) {
      const f = (a.t / a.dur - 0.4) / 0.6, c = ctr(cp.at);
      ctx.strokeStyle = `rgba(255,230,180,${0.8 * (1 - f)})`; ctx.lineWidth = 5 * (1 - f) + 1; ctx.beginPath(); ctx.arc(c.x, c.y, cs * (0.3 + 0.5 * f), 0, TAU); ctx.stroke();
    }
    if (state.kb && scene !== 'over') { const c = ctr(Math.min(state.cursor, n * n - 1)); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(c.x - cs / 2 + 3, c.y - cs / 2 + 3, cs - 6, cs - 6); }
  };
  const tray = (T, kind, label, count, taken) => {
    text(`${label}: ${count}`, T.x, T.y, T.size, CREAM, UI, 700, 'left');
    if (taken) text(`taken ${taken}`, T.taken.x, T.taken.y, T.taken.size, 'rgba(240,207,134,0.8)', UI, 500, T.taken.align);
    const sz = SIZES[n], tot = kind === 'A' ? sz.att : sz.def + 1, P = T.pieces;
    for (let k = 0; k < count && k < tot; k++) drawPiece(ctx, 7, kind === 'A' ? 'A' : 'D', P.x + (k % P.cols) * P.dx, P.y + Math.floor(k / P.cols) * P.dy, { scale: P.s });
  };
  // A heading: one line shrunk to fit, or (spec.lines > 1) wrapped.
  const heading = (str, T, color = GOLD) => {
    if (T.lines > 1) { const ls = wrapLines(str, fs(T.size), T.maxW, 800); ls.slice(0, T.lines).forEach((ln, i) => shadowText(ln, T.x, T.y + i * T.lh, T.size, color, FONT, 800, T.maxW)); }
    else shadowText(str, T.x, T.y, T.size, color, FONT, 800, T.maxW);
  };
  const banner = () => {
    if (!state.msg || scene === 'over') return;
    const M = HUD.msg, r = M.rect, al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5);
    const ms = big ? M.bigSize : M.size, lh = big ? M.bigLh : M.lh;
    ctx.save(); ctx.globalAlpha = Math.max(0, al);
    let box;
    if (M.grow) { const lines = wrapLines(state.msg.text, ms, r.w - 50); box = { x: r.x, y: r.y, w: r.w, h: 34 + lines.length * lh }; }
    else box = r;
    ctx.fillStyle = 'rgba(16,8,3,0.92)'; ctx.beginPath(); ctx.roundRect(box.x, box.y, box.w, box.h, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(240,207,134,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    if (M.grow) { const lines = wrapLines(state.msg.text, ms, r.w - 50); lines.forEach((ln, i) => text(ln, box.x + box.w / 2, box.y + 40 + i * lh, ms, CREAM, UI, 600)); }
    else {
      const inner = { x: box.x + 14, y: box.y + 8, w: box.w - 28, h: box.h - 16 };
      // centre the (fitted) text vertically inside the box
      let s = fs(ms), l2 = lh, ls = wrapLines(state.msg.text, s, inner.w);
      while (ls.length * l2 > inner.h && s > floor) { s -= 1; l2 = lh * s / ms; ls = wrapLines(state.msg.text, s, inner.w); }
      const maxLines = Math.max(1, Math.floor(inner.h / l2)); if (ls.length > maxLines) ls = ls.slice(0, maxLines);
      const y0 = inner.y + (inner.h - ls.length * l2) / 2 + s * 0.85;
      ls.forEach((ln, i) => text(ln, box.x + box.w / 2, y0 + i * l2, s, CREAM, UI, 600));
    }
    ctx.restore();
  };
  const whoText = () => (g.winner ? '' : state.two ? `${NAME[g.turn][0].toUpperCase() + NAME[g.turn].slice(1)} to move` : g.turn === state.human ? `Your move (${NAME[g.turn]})` : `The computer thinks${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`);

  if (boardScene) {
    if (L.land) { card(L.leftCard); if (L.rightCard) { card(L.rightCard); if (L.badgeFits) drawBadgeStack(ctx, L.rightCard.x + L.rightCard.w / 2, L.rightCard.y + L.rightCard.h - 16, L.rightCard.w - 28); } }
    if (scene === 'lesson') {
      const l = LESSONS[state.lesson.i], T = HUD.lesson;
      text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, T.label.x, T.label.y, T.label.size, 'rgba(240,207,134,0.85)', UI, 600, 'center');
      heading(l.title, T.title);
      fitBlock(state.lesson.done ? l.done : l.text, { x: T.body.x, y: T.body.y, w: T.body.w, h: T.body.h }, big ? T.body.bigSize : T.body.size, big ? T.body.bigLh : T.body.lh, state.lesson.done ? '#c9f7c0' : CREAM, T.body.align);
    } else if (scene === 'puzzle') {
      const T = HUD.puzzle;
      text('Daily puzzle', T.label.x, T.label.y, T.label.size, 'rgba(240,207,134,0.85)', UI, 600, 'center');
      heading('Defenders: win in two', T.title);
      fitBlock(state.pz.status === 'solved' ? `Solved${state.pz.tries ? ' after ' + state.pz.tries + ' wrong tr' + (state.pz.tries === 1 ? 'y' : 'ies') : ' at the first try'}. Come back tomorrow for a new one.` : 'Find the one move that lets the king reach a corner two moves from now, however the attackers answer.', { x: T.body.x, y: T.body.y, w: T.body.w, h: T.body.h }, big ? T.body.bigSize : T.body.size, big ? T.body.bigLh : T.body.lh, CREAM, T.body.align);
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, T.streak.x, T.streak.y, T.streak.size, GOLD, UI, 600, T.streak.align);
    } else if (scene === 'autoplay') {
      const A = state.ap, T = HUD.auto, sz = SIZES[n];
      heading('Auto Play — watch and learn', T.title);
      const left = A ? Math.max(0, AP_THINK_STEPS[state.apThinkIdx] - A.t) : 0;
      const phaseText = !A || A.phase === 'finished' ? 'That game is over - see below.'
        : A.paused ? 'Paused'
        : A.phase === 'think' ? `Think: what would the ${NAME[g.turn]} play? (${left.toFixed(1)}s)`
        : A.phase === 'reveal' ? 'Here is the move about to be played…'
        : 'Playing it out…';
      if (T.phase.lines > 1) fitBlock(phaseText, { x: T.phase.x, y: T.phase.y - 20, w: T.phase.maxW, h: T.phase.lines * T.phase.lh }, T.phase.size, T.phase.lh, CREAM, 'left');
      else text(phaseText, T.phase.x, T.phase.y, T.phase.size, CREAM, UI, 600, 'center', T.phase.maxW);
      const attN = g.b.filter((v) => v === ATT).length, defN = g.b.filter((v) => v === DEF || v === KING).length;
      tray(T.trayA, 'A', 'Attackers', attN, sz.att - attN);
      tray(T.trayD, 'D', 'Defenders', defN, sz.def + 1 - defN);
      if (A && A.phase !== 'finished') {
        text(`Think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, T.think.x, T.think.y, T.think.size, GOLD, UI, 700, 'center');
        button(AP.dec, '−', { size: 26, dim: state.apThinkIdx === 0 });
        button(AP.inc, '+', { size: 26, dim: state.apThinkIdx === AP_THINK_STEPS.length - 1 });
      }
    } else {
      const sz = SIZES[n], T = HUD.play;
      if (T.title) { shadowText('Tafl', T.title.x, T.title.y, T.title.size); }
      if (T.sub) text(`${L.land ? 'Tafl · ' : ''}${sz.name} ${n}x${n}`, T.sub.x, T.sub.y, T.sub.size, 'rgba(240,207,134,0.85)', UI, 600, T.sub.align, L.land ? L.leftCard.w - 32 : 0);
      drawPiece(ctx, 7, g.turn === ATT ? 'A' : 'K', T.icon.x, T.icon.y, { scale: T.icon.s });
      const who = whoText();
      if (T.turn.lines > 1) wrapLines(who, fs(T.turn.size), T.turn.maxW, 700).slice(0, T.turn.lines).forEach((ln, i) => text(ln, T.turn.x, T.turn.y + i * T.turn.lh, T.turn.size, CREAM, UI, 700, 'left'));
      else text(who, T.turn.x, T.turn.y, T.turn.size, CREAM, UI, 700, 'left', T.turn.maxW);
      text(state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`, T.mode.x, T.mode.y, T.mode.size, 'rgba(240,207,134,0.85)', UI, 500, 'left', T.mode.maxW);
      const attN = g.b.filter((v) => v === ATT).length, defN = g.b.filter((v) => v === DEF || v === KING).length;
      tray(T.trayA, 'A', 'Attackers', attN, sz.att - attN);
      tray(T.trayD, 'D', 'Defenders', defN, sz.def + 1 - defN);
    }
    drawBoard();
    banner();
    if (scene === 'play') { button(BTN.menu, 'Menu', { size: 24 }); button(BTN.undo, 'Take back', { size: 22 }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 22, dim: state.hintsLeft <= 0 }); }
    else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: 24 }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 26 }); else button(BTN.skip, 'Restart', { size: 22 }); }
    else if (scene === 'puzzle') { button(BTN.menu, 'Menu', { size: 24 }); if (state.pz.status === 'solved') button(BTN.share, 'Share result', { primary: true, size: 26 }); }
    else if (scene === 'autoplay') {
      const A = state.ap;
      if (A && A.phase === 'finished') {
        ctx.fillStyle = L.land ? 'rgba(8,4,2,0.88)' : 'rgba(8,4,2,0.76)'; ctx.fillRect(0, 0, W, H);
        const O = L.over, won = g.winner === 'draw' ? 'A draw' : `${NAME[g.winner][0].toUpperCase() + NAME[g.winner].slice(1)} win`;
        shadowText(won, O.won.x, O.won.y, O.won.size - 6, GOLD, FONT, 800, O.maxW); text(g.reason, O.reason.x, O.reason.y, O.reason.size, CREAM, UI, 500, 'center', O.maxW);
        text(`${g.ply} moves`, O.moves.x, O.moves.y, O.moves.size, 'rgba(240,207,134,0.8)', UI, 500);
        button(BTN.again, 'Watch again', { primary: true, size: 28 });
        button(BTN.back, 'Menu', { size: 24 });
      } else {
        button(AP.pause, A && A.paused ? 'Resume' : 'Pause', { primary: !!(A && A.paused), size: 22 });
        button(AP.skip, 'Skip', { size: 22 });
        button(AP.exit, 'Exit', { size: 22 });
      }
    }
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { const M = L.making; shadowText('Daily puzzle', M.title.x, M.title.y, M.title.size, GOLD, FONT, 800, W - 60); text("Setting up today's puzzle…", M.line.x, M.line.y, M.line.size, CREAM, UI, 600, 'center', W - 60); button(BTN.menu, 'Menu', { size: 24 }); }

  // ---- title and other menus ------------------------------------------------------------------------------------------
  if (scene === 'title' || scene === 'demo-limit') {
    const T = L.title(!!state.saved), hr = T.hero, bob = calm ? 0 : Math.sin(state.t * 1.4) * 4;
    if (T.wide) { ctx.fillStyle = 'rgba(0,0,0,0.34)'; ctx.fillRect(0, 0, W, H); const c0 = T.rows.learn.x - 16; ctx.fillStyle = 'rgba(8,4,2,0.55)'; ctx.fillRect(c0, 0, W - c0, H); }
    else { ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(0, hr.y + (L.tall ? 60 : 0), W, hr.h - (L.tall ? 60 : 0)); ctx.fillStyle = 'rgba(8,4,2,0.55)'; ctx.fillRect(0, hr.y + hr.h, W, H - hr.y - hr.h); }
    // hero: the king between his guard and the attackers, in the hearth light
    const hx = hr.x + hr.w / 2, hh = hr.h, full = hh >= 430;
    let yy = hr.y;
    if (full) {
      const bw0 = Math.min(290, hr.w / 2 - 20), by0 = hr.y + 35;
      let x0 = hx - bw0; if (L.ins.back && by0 < L.backBox.y + L.backBox.h + 6) x0 = Math.max(x0, L.backBox.x + L.backBox.w + 10);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, by0 - 15, 2 * (hx - x0), 30); ctx.clip(); braid(ctx, x0, by0, 2 * (hx - x0), 7, 7, ['#120903', '#a07a3c', '#e8c77e'], 34); ctx.restore();
    }
    const tsz = full ? 112 : Math.max(56, Math.min(100, hh * 0.3)), tY = full ? hr.y + 145 : hr.y + 16 + tsz * 0.82 + (L.ins.back && !T.wide ? 0 : 0);
    const ty0 = Math.max(tY, T.wide ? 0 : 0);
    const tagY = ty0 + (full ? 55 : tsz * 0.4 + 14), credY = tagY - 12, msgY = credY + 46;
    shadowText('TAFL', hx, ty0, tsz, GOLD, FONT, 800, hr.w - 40);
    text("The king's table of the North", hx, tagY, 28, CREAM, FONT, 600, 'center', hr.w - 40);
    if (T.lock) drawTitleLockup(ctx, T.lock, state.lockPress > 0);
    if (state.msg && scene === 'title') { ctx.save(); ctx.globalAlpha = Math.min(1, (state.msg.hold - state.msg.t) / 0.5); wrap(state.msg.text, hx, msgY, 22, Math.min(600, hr.w - 40), '#ffe9b0'); ctx.restore(); }
    // pieces fill what is left of the hero
    const top2 = (state.msg && scene === 'title' ? msgY + 60 : credY + 36), rem = hr.y + hh - top2;
    if (rem >= 110) {
      const ks = Math.max(0.4, Math.min(1, rem / 290)), xs = Math.min(1, (hr.w - 30) / 640), cy2 = top2 + rem / 2 + 2;
      const gl = ctx.createRadialGradient(hx, cy2, 20, hx, cy2, 300 * ks); gl.addColorStop(0, `rgba(255,170,70,${0.32 + (calm ? 0 : 0.05 * Math.sin(state.t * 5))})`); gl.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = gl; ctx.fillRect(hr.x, cy2 - 300 * ks, hr.w, 600 * ks);
      drawPiece(ctx, 7, 'A', hx - 230 * xs, cy2 + 10 + bob * 0.5, { scale: 1.5 * ks }); drawPiece(ctx, 7, 'A', hx + 230 * xs, cy2 + 10 - bob * 0.5, { scale: 1.5 * ks });
      drawPiece(ctx, 7, 'D', hx - 125 * xs, cy2 + 20 - bob, { scale: 1.6 * ks }); drawPiece(ctx, 7, 'D', hx + 125 * xs, cy2 + 20 + bob, { scale: 1.6 * ks });
      drawPiece(ctx, 7, 'K', hx, cy2 + bob, { scale: 2.5 * ks, lift: 0.3 });
    }
    void yy;
  }
  if (scene === 'title') {
    const T = L.title(!!state.saved), R = T.rows, solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 26 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 26 });
    button(R.big, 'Play Copenhagen 11x11', { primary: state.learned && !R.resume, size: 26 });
    button(R.small, 'Play Brandubh 7x7 (starter)', { size: 24 });
    button(R.daily, solvedToday ? `Daily puzzle: solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily puzzle · streak ${state.daily.streak}` : 'Daily puzzle', { size: 24 });
    button(R.two, 'Two players, one phone', { size: 24 });
    button(R.auto, '🎬 Auto Play — watch and learn', { size: 24 });
    button(R.side, `You play: ${state.human === DEF ? 'Defenders' : 'Attackers'}`, { size: 20, ui: true });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 20, ui: true });
    button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 20, ui: true });
    button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 20, ui: true });
    button(R.text, state.big ? 'Text: large' : 'Text: normal', { size: 20, ui: true });
    button(R.about, 'About Tafl', { size: 20, ui: true });
    button(R.help, 'Controls and rules', { size: 20, ui: true });
    button(R.rules, 'Rules', { size: 20, ui: true });
    const S = T.stats, half = S.w / 2;
    for (const [sd, x0, label] of [[DEF, S.x, 'Defenders'], [ATT, S.x + half, 'Attackers']]) {
      text(label, x0 + 4, S.y + 24, 21, 'rgba(240,207,134,0.9)', UI, 600, 'left');
      for (let l = 0; l < LEVELS.length; l++) text('★', x0 + 4 + 106 + l * 28, S.y + 26, 26, state.stats.badges[`${sd}_11_${l}`] || state.stats.badges[`${sd}_7_${l}`] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700, 'left');
    }
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, S.x + S.w / 2, S.y + 66, 21, 'rgba(240,207,134,0.7)', UI, 500, 'center', S.w);
  } else if (scene === 'demo-limit') {
    const D = L.demo;
    shadowText('That was the free taste.', D.title.x, D.title.y, D.title.size, GOLD, FONT, 800, D.maxW);
    text('Get Tafl on iPhone and Android', D.l1.x, D.l1.y, D.l1.size, CREAM, UI, 600, 'center', D.maxW); text('for unlimited games.', D.l2.x, D.l2.y, D.l2.size, CREAM, UI, 600, 'center', D.maxW);
    button(D.back, 'Menu', { size: 26 });
  } else if (scene === 'about' || scene === 'help' || scene === 'rules') {
    const P = L.pages, pages = scene === 'rules' ? RULES : PAGES[scene];
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, W, H);
    panel(P.panel.x, P.panel.y, P.panel.w, P.panel.h);
    const label = scene === 'about' ? 'About Tafl' : scene === 'help' ? 'Controls & Rules' : 'Rules';
    shadowText(label, P.labelX, P.labelY, Math.round(36 * Math.min(scale, 1.15)), 'rgba(240,222,180,0.92)', FONT, 800, P.labelMaxW);
    const bw0 = Math.min(290, P.panel.w / 2 - 30);
    ctx.save(); ctx.beginPath(); ctx.rect(P.cx - bw0, P.braidY - 15, 2 * bw0, 30); ctx.clip(); braid(ctx, P.cx - bw0, P.braidY, 2 * bw0, 7, 7, ['#120903', '#a07a3c', '#e8c77e'], 34); ctx.restore();
    // body: scrolls inside the viewport
    const vp = P.viewport, sz = Math.round(28 * scale), lh = Math.round(sz * 1.4), tw = Math.min(vp.w - 12, 900), tx = vp.x + (vp.w - tw) / 2;
    const scroll = Math.max(0, Math.min(state.pageScroll || 0, pageMetrics.max));
    const tsz = Math.round(32 * Math.min(scale, 1.2));
    // The wrapped document is laid out once per (scene, text size, width, floor, font) and reused; a frame only draws the visible slice.
    const fontsKey = (ctx.font = `800 40px ${FONT}`, ctx.measureText('Hamburgefonstiv').width)   // changes when the web font finishes loading;
    const key = [scene, sz, lh, tsz, tw, tx, vp.y, vp.w, P.cx, floor, fontsKey].join('|');
    if (readerCache.pages !== pages || readerCache.key !== key) {
      readerStats.layouts++;
      const items = []; let yy = vp.y + 4;
      for (const pg of pages) {
        yy += tsz;
        items.push({ title: pg.title, y: yy, h: tsz });
        yy += Math.round(sz * 0.9) + 6;
        if (pg.piece) { const iconY = yy + 60; items.push({ piece: pg.piece, y: iconY, h: 130 }); yy = iconY + 64 + Math.round(16 * scale) + Math.round(sz * 0.8); }
        for (const para of pg.body) { const ls = wrapLines(para, fs(sz), tw, 600); items.push({ ls, y: yy, h: ls.length * lh }); yy += ls.length * lh + Math.round(20 * scale); }
        yy += Math.round(18 * scale);
      }
      readerCache.pages = pages; readerCache.key = key; readerCache.items = items; readerCache.endY = yy;
    }
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip(); ctx.translate(0, -scroll);
    const top = vp.y + scroll - 200, bot = vp.y + scroll + vp.h + 200;   // slack for portrait height and glyph ascent
    for (const it of readerCache.items) {
      if (it.y + it.h < top || it.y - (it.piece ? 130 : sz * 1.5) > bot) continue;
      if (it.ls) it.ls.forEach((ln, i) => { const ly = it.y + i * lh; if (ly > top - sz && ly - sz < bot) text(ln, tx, ly, sz, CREAM, UI, 600, 'left'); });
      else if (it.piece) drawPiece(ctx, 7, it.piece, P.cx - 8, it.y, { scale: 1.9 });
      else shadowText(it.title, P.cx, it.y, tsz, '#ffd97a', FONT, 800, vp.w - 12);
    }
    const y = readerCache.endY - scroll;
    ctx.restore();
    const contentH = y - (vp.y - scroll) - Math.round(38 * scale) + Math.round(sz * 0.3);
    pageMetrics.max = contentH - vp.h <= 6 ? 0 : Math.ceil(contentH - vp.h); pageMetrics.view = vp.h;
    if (pageMetrics.max > 0) {
      const sb = P.scrollbar, th = Math.max(40, sb.h * vp.h / contentH), ty = sb.y + (scroll / pageMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 5); ctx.fill();
      ctx.fillStyle = 'rgba(240,207,134,0.65)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 5); ctx.fill();
    }
    if (pageMetrics.max > 0) text(`${Math.round(100 * scroll / pageMetrics.max)}% read`, P.cx, P.counterY, 21, 'rgba(240,207,134,0.8)', UI, 500);
    button(P.nav.back, 'Back', { size: 24 });
    button(P.nav.next, pageMetrics.max > 0 && scroll < pageMetrics.max - 2 ? 'Next' : 'Done', { primary: true, size: 22 });
    button(P.dec, 'A−', { size: 26, dim: state.textScaleIdx === 0 });
    button(P.inc, 'A+', { size: 26, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
  } else if (scene === 'over') {
    const O = L.over;
    ctx.fillStyle = L.land ? 'rgba(8,4,2,0.88)' : 'rgba(8,4,2,0.76)'; ctx.fillRect(0, 0, W, H);
    const won = g.winner === 'draw' ? 'A draw' : state.two ? `${NAME[g.winner][0].toUpperCase() + NAME[g.winner].slice(1)} win` : g.winner === state.human ? 'You win!' : 'The computer wins';
    const gy = O.piece.y - 30, gl = ctx.createRadialGradient(O.piece.x, gy, 20, O.piece.x, gy, 300); gl.addColorStop(0, 'rgba(255,170,70,0.35)'); gl.addColorStop(1, 'rgba(255,170,70,0)'); ctx.fillStyle = gl; ctx.fillRect(O.piece.x - 300, gy - 300, 600, 600);
    if (g.winner !== 'draw') drawPiece(ctx, 7, g.winner === DEF ? 'K' : 'A', O.piece.x, O.piece.y, { scale: O.piece.s });
    shadowText(won, O.won.x, O.won.y, O.won.size, GOLD, FONT, 800, O.maxW); text(g.reason, O.reason.x, O.reason.y, O.reason.size, CREAM, UI, 500, 'center', O.maxW);
    text(`${g.ply} moves`, O.moves.x, O.moves.y, O.moves.size, 'rgba(240,207,134,0.8)', UI, 500);
    if (!state.two && g.winner === state.human) {
      text(`★ ${LEVELS[state.level].name} beaten as the ${NAME[state.human]}`, O.star.x, O.star.y, O.star.size, '#ffd24a', UI, 600, 'center', O.maxW);
      if (!calm) for (let k = 0; k < 14; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = O.piece.x + Math.sin(k * 2.4) * (140 + 90 * ph), y = O.piece.y + 110 - ph * 400; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 3 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    button(BTN.again, 'Play again', { primary: true, size: 30 }); button(BTN.back, 'Menu', { size: 26 });
    drawMoreLine(ctx, O.more.x, O.more.y, Math.max(22, floor));
  }
}
