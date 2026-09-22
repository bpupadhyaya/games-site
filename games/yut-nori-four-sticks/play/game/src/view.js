// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art and sprites are cached.
import { W, H, POINTS, TOKEN_R, TRAY, CHIP, PAD, BTN, titleRows, PAGE_BACK, isBig } from './layout.js';
import { drawTable } from './art.js';
import { drawToken, drawStick, drawLantern, blob, TEAMS } from './pieces.js';
import { NAMES, ANIMALS, STEPS_TEXT, HOME, movesFor } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO } from './text.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const sm = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const TEAM_NAME = ['Blue', 'Red'];

// Where stick i is at normalised time u of a throw (0..1). h = height above the mat.
export function stickPose(st, u, strength) {
  const k1 = Math.min(1, u / 0.6), e = sm(k1);
  let h = 0;
  if (u < 0.6) h = (90 + 90 * strength) * 4 * k1 * (1 - k1);
  else if (u < 0.8) { const k = (u - 0.6) / 0.2; h = 30 * (0.6 + 0.4 * strength) * 4 * k * (1 - k); }
  else if (u < 0.92) { const k = (u - 0.8) / 0.12; h = 14 * 4 * k * (1 - k); }
  const turnE = 1 - Math.pow(1 - Math.min(1, u / 0.88), 2.2);
  const theta = Math.PI * (2 * st.turns + (st.flat ? 0 : 1)) * turnE;
  const rot = st.rot0 + (st.rotf - st.rot0) * sm(Math.min(1, u / 0.72));
  return { x: st.x0 + (st.xf - st.x0) * e, y: st.y0 + (st.yf - st.y0) * e, h, face: Math.cos(theta), rot };
}

export function render(ctx, state) {
  const t = state.t, scene = state.scene, big = state.big, g = state.game;
  drawTable(ctx);
  // paper-lantern light: a warm, slightly flickering wash from the upper right
  const fl = 0.5 + 0.06 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 7.3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, 600, 90, 520, 420, '255,170,70', 0.16 * fl); blob(ctx, 130, 1180, 420, 300, '255,160,80', 0.06); ctx.restore();

  const text = (str, x, y, size, color = '#f7e6bd', font = FONT, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center', weight = 500) => {
    ctx.font = `${weight} ${size}px ${UI}`; const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); lines.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return lines.length;
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 6, r.w, r.h, 20); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#e9694b'); gr.addColorStop(1, '#a2301c'); } else { gr.addColorStop(0, '#5a3b21'); gr.addColorStop(1, '#2f1b0d'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 20); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,225,160,0.85)' : 'rgba(236,200,130,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8, 16); ctx.stroke();
    text(label, r.x + r.w / 2, r.y + r.h / 2 + (o.size ?? 30) * 0.35, o.size ?? 30, '#fff1cf', UI, 700);
    ctx.restore();
  };
  const glowRing = (p, rgb, pulse, r = 26) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, p.x, p.y, r * 2.4, r * 2.4, rgb, 0.55 + 0.3 * pulse); ctx.restore();
    ctx.strokeStyle = `rgba(${rgb},${0.9})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4 + pulse * 3, 0, TAU); ctx.stroke();
  };
  const trayText = (label, x, y) => text(label, x, y, 17, 'rgba(247,230,189,0.7)', UI, 600);

  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || (scene === 'puzzle' && state.pz?.status !== 'making');
  const showTitleArt = scene === 'title' || scene === 'demo-limit' || scene === 'about' || scene === 'how' || (scene === 'puzzle' && state.pz?.status === 'making');

  // hanging lanterns
  drawLantern(ctx, 640, 0, 1.0, t); drawLantern(ctx, 548, -40, 0.62, t + 1.7);

  if (boardScene) {
    const a = state.anim, me = state.two ? g.turn : 0;
    // ---- header ------------------------------------------------------------------------------------
    let head = '', sub = '', lessonTag = '';
    if (scene === 'lesson') { const L = state.lesson, l = LESSONS[L.i]; head = l.title; sub = ''; lessonTag = `Lesson ${L.i + 1} of ${LESSONS.length}`; }
    else if (scene === 'puzzle') { head = state.pz.status === 'done' ? 'Challenge complete' : 'Daily challenge'; sub = state.pz.puzzle.weekend ? 'Three throws today' : 'Play the whole turn'; }
    else if (g.winner >= 0) head = `${TEAM_NAME[g.winner]} wins`;
    else {
      const who = state.two ? `${TEAM_NAME[g.turn]}'s` : g.turn === 0 ? 'Your' : "Red's";
      head = g.phase === 'throw' ? (!state.two && g.turn === 1 ? 'Red throws' : `${who} throw`) : g.turn === 0 || state.two ? 'Choose a token' : 'Red is moving';
      sub = state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`;
    }
    text(lessonTag || 'Yut Nori', 360, 128, 30, 'rgba(247,230,189,0.75)', FONT, 700);
    text(head, 360, 196, big ? 56 : 50, '#fff3d0');
    if (!state.msg) text(sub, 360, 246, 24, 'rgba(247,230,189,0.8)', UI, 500);
    if (state.msg) {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5), ms = big ? 27 : 23, lh = big ? 33 : 29;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.font = `600 ${ms}px ${UI}`;
      const words = state.msg.text.split(' '), lines = []; let cur = '';
      for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 590 && cur) { lines.push(cur); cur = w; } else cur = t2; }
      lines.push(cur);
      const h = 24 + lines.length * lh, y0 = 222;
      ctx.fillStyle = 'rgba(20,10,4,0.9)'; ctx.beginPath(); ctx.roundRect(40, y0, 640, h, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(236,200,130,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      lines.forEach((ln, i) => text(ln, 360, y0 + 16 + ms * 0.85 + i * lh, ms, '#fff3d6', UI, 600));
      ctx.restore();
    }
    // ---- trays -------------------------------------------------------------------------------------
    for (const team of [0, 1]) {
      const T = TRAY[team];
      let waitN = g.wait[team], homeN = g.home[team];
      if (a) {
        if (a.team === team && a.from === -1) waitN += 1;
        if (a.cap && a.cap.team === team && a.t < a.capT) waitN -= a.cap.n;
        if (a.team === team && a.home && a.t < a.dur) homeN -= a.home;
      }
      for (let k = 0; k < Math.min(4, waitN); k++) { const p = T.wait(k); drawToken(ctx, p.x, p.y - 4, team, { scale: 0.56, lift: 0 }); }
      for (let k = 0; k < Math.min(4, homeN); k++) { const p = T.home(k); drawToken(ctx, p.x, p.y - 4, team, { scale: 0.56 }); }
      const capY = team === 1 ? 296 : 1080;
      trayText('waiting', T.wait(1).x + 29, capY); trayText('home', T.home(1).x + 29, capY);
      const nm = state.two ? `${TEAM_NAME[team]}` : team === 0 ? 'You (Blue)' : 'Red';
      text(nm, T.label.x, T.label.y, 24, team === 0 ? '#9fbcff' : '#ff9a82', FONT, 700);
    }

    const pulse = state.calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6);
    const humanMove = g.phase === 'move' && !a && (state.two || g.turn === 0) && g.winner < 0;
    // ---- tokens on the board (far rows first so stacks overlap correctly) ------------------------------
    const stacks = [];
    for (const team of [0, 1]) for (const grp of g.g[team]) stacks.push({ team, ...grp });
    stacks.sort((p, q) => POINTS[p.pos].y - POINTS[q.pos].y);
    for (const s of stacks) {
      let n = s.n;
      const p = POINTS[s.pos];
      if (a && a.team === s.team && a.to === s.pos) n -= a.n;
      if (a && a.cap && a.cap.pos === s.pos && a.team !== s.team) continue;
      if (n <= 0) continue;
      const sel = state.sel === s.pos && s.team === g.turn && humanMove;
      drawToken(ctx, p.x, p.y, s.team, { n, lift: sel ? 14 + (state.calm ? 0 : Math.sin(t * 4) * 3) : 0, glow: sel ? TEAMS[s.team].rgb : null });
    }
    // ---- glows: legal landing points, hints, warnings ------------------------------------------------
    if (humanMove && state.sel != null && state.selV != null) {
      for (const m of movesFor(g, g.turn, state.selV)) if (m.from === state.sel) {
        const p = POINTS[m.to === HOME || m.to === 'wait' ? 0 : m.to];
        const cap = m.to !== HOME && m.to !== 'wait' && g.g[1 - g.turn].some((x) => x.pos === m.to);
        glowRing(p, cap ? '255,90,70' : m.short ? '120,220,255' : '255,232,140', pulse, isBig(m.to) ? 32 : 24);
        if (cap) text('CAPTURE', p.x, p.y - 44, 17, '#ffb0a0', UI, 800);
        else if (m.short) text('SHORTCUT', p.x, p.y - 42, 16, '#bff0ff', UI, 800);
        else if (m.to === HOME) text('HOME', p.x - 6, p.y - 44, 17, '#fff0b0', UI, 800);
      }
    }
    if (state.hint && !a) { const p = POINTS[state.hint.to === HOME || state.hint.to === 'wait' ? 0 : state.hint.to]; glowRing(p, '120,255,170', pulse, isBig(state.hint.to) ? 32 : 24); }

    // captured tokens getting knocked back
    if (a && a.cap) {
      const cp = POINTS[a.cap.pos], k = a.t - a.capT;
      if (a.t < a.capT) drawToken(ctx, cp.x, cp.y, a.cap.team, { n: a.cap.n });
      else if (k < 0.5) {
        const f = sm(k / 0.5), to = TRAY[a.cap.team].wait(Math.max(0, g.wait[a.cap.team] - 1));
        drawToken(ctx, cp.x + (to.x - cp.x) * f, cp.y + (to.y - cp.y) * f - Math.sin(f * Math.PI) * 120, a.cap.team, { n: a.cap.n, scale: 1 - f * 0.44 });
      }
    }
    // the moving stack
    if (a) {
      const pts = [a.from === -1 ? TRAY[a.team].wait(g.wait[a.team]) : POINTS[a.from]].concat(a.path.map((p2) => (p2 === HOME || p2 === -1 ? POINTS[0] : POINTS[p2])));
      const per = a.dur / (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(a.t / per)), f = sm(Math.min(1, (a.t - i * per) / per));
      const p0 = pts[i], p1 = pts[i + 1], x = p0.x + (p1.x - p0.x) * f, y = p0.y + (p1.y - p0.y) * f;
      const lift = Math.sin(f * Math.PI) * 34 * (a.back ? 0.5 : 1);
      const sc = a.from === -1 && i === 0 ? 0.56 + 0.44 * f : 1;
      if (a.t < a.dur) drawToken(ctx, x, y, a.team, { n: a.n, lift, scale: sc });
      // landing ring
      if (a.t > a.dur - 0.25 && !state.calm) { const k = (a.t - (a.dur - 0.25)) / 0.25, p = pts[pts.length - 1]; ctx.strokeStyle = `rgba(255,236,190,${0.7 * (1 - k)})`; ctx.lineWidth = 5 * (1 - k) + 1; ctx.beginPath(); ctx.ellipse(p.x, p.y + 6, 20 + 46 * k, 14 + 32 * k, 0, 0, TAU); ctx.stroke(); }
    }
    // sparks
    for (const f of state.fx) {
      const k = f.t / f.dur; if (k >= 1) continue;
      ctx.fillStyle = `rgba(${f.rgb},${0.9 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t + 240 * f.t * f.t * 0.5, f.r * (1 - k * 0.5), 0, TAU); ctx.fill();
    }
    // keyboard cursor
    if (state.kb && humanMove && state.kbTarget != null) { const p = POINTS[state.kbTarget]; ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(p.x, p.y, 42, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }

    // ---- throw chips ---------------------------------------------------------------------------------
    const n = g.pending.length;
    for (let k = 0; k < n; k++) {
      const r = CHIP(k, n), v = g.pending[k], selc = state.selV === v && humanMove && state.selK === k;
      const pop = state.chipPop > 0 ? 1 + 0.12 * Math.sin(Math.min(1, state.chipPop) * Math.PI) : 1;
      ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(pop, pop); ctx.translate(-r.w / 2, -r.h / 2);
      const gr = ctx.createLinearGradient(0, 0, 0, r.h); gr.addColorStop(0, selc ? '#ffe9a6' : '#e9d5a4'); gr.addColorStop(1, selc ? '#e0a83c' : '#b99657');
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(2, 5, r.w, r.h, 14); ctx.fill();
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(0, 0, r.w, r.h, 14); ctx.fill();
      ctx.strokeStyle = selc ? '#fff6d0' : 'rgba(90,50,20,0.9)'; ctx.lineWidth = selc ? 4 : 2.5; ctx.stroke();
      text(NAMES[v].toUpperCase(), r.w / 2, 34, 26, v === -1 ? '#8e1b12' : '#2a1608', FONT, 700);
      text(v === -1 ? 'back 1' : `${v} step${v > 1 ? 's' : ''}`, r.w / 2, 62, 20, '#4a2a12', UI, 700);
      ctx.restore();
    }

    // ---- the throwing pad --------------------------------------------------------------------------
    const ta = state.throwAnim, rest = state.rest;
    const drawStickAt = (i, x, y, rot, face, h) => drawStick(ctx, x, y, rot, face, i === 0, h);
    if (ta) {
      const u = Math.min(1, Math.max(0, ta.t / ta.dur));
      ta.sticks.forEach((st, i) => { const uu = Math.min(1, Math.max(0, (ta.t - st.d) / (ta.dur - 0.14))); const p = stickPose(st, uu, ta.strength); drawStickAt(i, p.x, p.y, p.rot, p.face, p.h); });
    } else if (state.grip) {
      for (let i = 0; i < 4; i++) drawStickAt(i, state.grip.x + (i - 1.5) * 16, state.grip.y - 20 + Math.sin(t * 20 + i) * 1.5, (i - 1.5) * 0.12, Math.cos(i * 0.6 + 0.4), 40);
    } else {
      rest.forEach((st, i) => drawStickAt(i, st.x, st.y, st.rot, st.flat ? 1 : -1, 0));
    }
    const canThrow = g.phase === 'throw' && !ta && !a && (state.two || g.turn === 0) && g.winner < 0 && scene !== 'over';
    if (canThrow && !state.grip) {
      const pl = state.calm ? 0.7 : 0.6 + 0.4 * Math.sin(t * 4);
      ctx.save(); ctx.globalAlpha = 0.55 + 0.4 * pl;
      ctx.fillStyle = 'rgba(20,10,4,0.72)'; ctx.beginPath(); ctx.roundRect(110, PAD.y + 92, 500, 82, 41); ctx.fill();
      ctx.strokeStyle = 'rgba(255,220,150,0.8)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
      text('TAP or SWIPE up to throw', 360, PAD.y + 143, 30, '#fff3d0', UI, 700);
    } else if (!ta && !canThrow && g.phase === 'throw' && g.winner < 0) {
      text(`${!state.two ? 'Red' : TEAM_NAME[g.turn]} is about to throw`, 360, PAD.y + PAD.h - 22, 24, 'rgba(247,230,189,0.7)', UI, 600);
    }
    // the result of the last throw
    if (state.result && state.result.t < 2.6) {
      const r = state.result, k = Math.min(1, r.t / 0.28), sc = 0.55 + 0.45 * (1 - Math.pow(1 - k, 3)) + (state.calm ? 0 : 0.05 * Math.sin(k * Math.PI));
      const al = Math.min(1, (2.6 - r.t) / 0.5);
      ctx.save(); ctx.globalAlpha = al; ctx.translate(360, PAD.y + PAD.h * 0.5 - 24); ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(16,8,4,0.86)'; ctx.beginPath(); ctx.roundRect(-190, -66, 380, 152, 26); ctx.fill();
      ctx.strokeStyle = r.v >= 4 ? '#ffd76a' : 'rgba(236,200,130,0.85)'; ctx.lineWidth = r.v >= 4 ? 5 : 3; ctx.stroke();
      text(NAMES[r.v].toUpperCase(), 0, 22, 84, r.v >= 4 ? '#ffd76a' : r.v === -1 ? '#ff8a72' : '#fff3d0', FONT, 700);
      text(r.v === -1 ? 'one step BACK' : `${STEPS_TEXT[r.v]} · ${ANIMALS[r.v]}`, 0, 62, 26, '#e8d3a4', UI, 600);
      ctx.restore();
    }

    // ---- bottom buttons ----------------------------------------------------------------------------
    if (scene === 'play' || scene === 'puzzle') {
      button(BTN.menu, 'Menu', { size: 26 });
      const canU = state.undo.length > 0 && !a && g.phase === 'move';
      button(BTN.undo, 'Take back', { size: 26, dim: !canU });
      if (scene === 'play') button(BTN.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 });
      else if (state.pz.status === 'done') button(BTN.hint, 'Share', { size: 26, primary: true });
      else button(BTN.hint, 'Reset', { size: 26 });
    } else if (scene === 'lesson') {
      button(BTN.menu, 'Menu', { size: 26 });
      if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 });
    }
    // lesson text panel, sits over the header area of the lower half
    if (scene === 'lesson') {
      const L = state.lesson, l = LESSONS[L.i], txt = L.done ? l.done : l.texts[Math.min(l.texts.length - 1, L.throws)];
      ctx.save(); ctx.font = `600 ${big ? 27 : 24}px ${UI}`;
      const lines = []; let cur = ''; for (const w of txt.split(' ')) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > 600 && cur) { lines.push(cur); cur = w; } else cur = t2; } lines.push(cur);
      const lh = big ? 33 : 30, h = 28 + lines.length * lh, y0 = 262 - 40;
      ctx.restore();
      ctx.fillStyle = L.done ? 'rgba(18,44,24,0.98)' : 'rgba(20,10,4,0.98)'; ctx.beginPath(); ctx.roundRect(36, y0, 648, h, 18); ctx.fill();
      ctx.strokeStyle = L.done ? 'rgba(160,240,160,0.8)' : 'rgba(236,200,130,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      lines.forEach((ln, i) => text(ln, 360, y0 + 14 + (big ? 27 : 24) * 0.9 + i * lh, big ? 27 : 24, L.done ? '#d6ffd0' : '#fff3d6', UI, 600));
    }
    if (scene === 'puzzle' && state.pz.status === 'done') {
      const P = state.pz, stars = '★'.repeat(P.stars) + '☆'.repeat(3 - P.stars);
      ctx.fillStyle = 'rgba(16,8,4,0.9)'; ctx.beginPath(); ctx.roundRect(36, 236, 648, 132, 18); ctx.fill(); ctx.strokeStyle = 'rgba(255,215,106,0.85)'; ctx.lineWidth = 2; ctx.stroke();
      text(stars, 140, 300, 44, '#ffd76a', UI, 700);
      wrap(P.stars === 3 ? 'You found the best turn.' : `A better turn: ${P.puzzle.bestText.parts.join(', then ')}.`, 440, 286, 22, 400, '#fff3d6', 27, 'center', 600);
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, 360, 352, 22, 'rgba(247,230,189,0.8)', UI, 600);
    }
  }

  // ---- title and pages ------------------------------------------------------------------------------
  if (showTitleArt) {
    { const vg = ctx.createLinearGradient(0, 290, 0, 372); vg.addColorStop(0, 'rgba(12,8,22,0)'); vg.addColorStop(1, 'rgba(12,8,22,0.88)'); ctx.fillStyle = vg; ctx.fillRect(0, 290, W, 82); }
    ctx.fillStyle = 'rgba(12,8,22,0.55)'; ctx.fillRect(0, 372, W, 668);
    if (scene === 'title' || scene === 'demo-limit') {
      // idle tumbling sticks and tokens
      for (let i = 0; i < 4; i++) {
        const ph = t * 1.25 + i * 1.3;
        drawStick(ctx, 360 + (i - 1.5) * 118, 560 + Math.sin(ph) * 10, (i - 1.5) * 0.28 + Math.sin(t * 0.6 + i) * 0.25, Math.cos(t * 1.7 + i * 1.9), i === 0, 26 + 20 * Math.sin(ph * 1.1 + 1));
      }
      drawToken(ctx, 118, 700, 0, { scale: 1.5, lift: 8 + 6 * Math.sin(t * 2) }); drawToken(ctx, 602, 700, 1, { scale: 1.5, lift: 8 + 6 * Math.sin(t * 2 + 1.5) });
      ctx.save(); ctx.shadowColor = 'rgba(255,170,60,0.7)'; ctx.shadowBlur = 24;
      text('Yut Nori', 360, 262, 132, '#fff0c8'); ctx.restore();
      text("Korea's four-stick race", 360, 322, 34, '#f0d9a2', FONT, 700);
      { const vg = ctx.createLinearGradient(0, 700, 0, 780); vg.addColorStop(0, 'rgba(12,8,22,0)'); vg.addColorStop(1, 'rgba(12,8,22,0.93)'); ctx.fillStyle = vg; ctx.fillRect(0, 700, W, 80); ctx.fillStyle = 'rgba(12,8,22,0.93)'; ctx.fillRect(0, 780, W, 790); }
    } else ctx.fillStyle = 'rgba(12,8,22,0.5)', ctx.fillRect(0, 0, W, H);
  }
  if (scene === 'puzzle' && state.pz.status === 'making') { text("Preparing today's challenge…", 360, 700, 34, '#fff3d6', UI, 600); button(BTN.menu, 'Menu', { size: 26 }); }
  if (scene === 'title') {
    const R = titleRows(!!state.saved), solvedToday = state.daily.solvedDay === state.daily.day;
    if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: 30 });
    button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: 30 });
    button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: 30 });
    button(R.two, 'Two teams, one phone', { size: 28 });
    button(R.daily, solvedToday ? `Daily challenge · solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily challenge · streak ${state.daily.streak}` : 'Daily challenge', { size: 26 });
    button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: 22 }); button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: 22 });
    button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: 20 }); button(R.big, state.big ? 'Large text: on' : 'Large text: off', { size: 20 });
    button(R.about, 'About Yut Nori', { size: 22 }); button(R.how, 'How to play', { size: 22 });
    const by = R.about.y + 100;
    text(LEVELS[state.level].blurb, 360, by, 20, 'rgba(247,230,189,0.85)', UI, 500);
    for (let l = 0; l < LEVELS.length; l++) text('★', 360 + (l - 2) * 46, by + 46, 34, state.stats.badges['L' + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700);
    text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, 360, by + 88, 20, 'rgba(247,230,189,0.65)', UI, 500);
    if (state.msg) wrap(state.msg.text, 360, 756, 22, 620, '#ffe9b0');
  } else if (scene === 'demo-limit') {
    text('That was the free taste.', 360, 960, 46);
    text('Get Yut Nori on iPhone and Android', 360, 1030, 28, '#fff3d6', UI, 600); text('for unlimited games.', 360, 1070, 28, '#fff3d6', UI, 600);
  } else if (scene === 'about' || scene === 'how') {
    const P = scene === 'about' ? ABOUT : HOWTO;
    text(P.title, 360, 180, 62);
    let y = 250;
    for (const sec of P.sections) {
      if (sec.h) { text(sec.h, 70, y, 30, '#ffd76a', FONT, 700, 'left'); y += 40; }
      const n = wrap(sec.p, 70, y, big ? 24 : 21, 580, '#fff3d6', big ? 32 : 28, 'left', 500); y += n * (big ? 32 : 28) + 20;
    }
    button(PAGE_BACK, 'Back', { size: 30, primary: true });
  } else if (scene === 'over') {
    ctx.fillStyle = 'rgba(8,6,16,0.74)'; ctx.fillRect(0, 0, W, H);
    const winner = g.winner;
    const won = state.two ? `${TEAM_NAME[winner]} wins!` : winner === 0 ? 'You win!' : 'Red wins';
    drawToken(ctx, 360, 560, winner, { scale: 3.4, lift: 10 + (state.calm ? 0 : Math.sin(t * 3) * 6) });
    text(won, 360, 780, 84);
    text(`${g.throws} throws · ${g.moves} moves`, 360, 830, 26, '#fff3d6', UI, 500);
    if (!state.two && winner === 0) {
      text(`★ ${LEVELS[state.level].name} beaten`, 360, 878, 26, '#ffd24a', UI, 600);
      if (!state.calm) for (let k = 0; k < 16; k++) { const ph = (t * 0.35 + k * 0.137) % 1, x = 360 + Math.sin(k * 2.4) * (150 + 90 * ph), y = 640 - ph * 420; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    button(BTN.again, 'Play again', { primary: true, size: 34 }); button(BTN.back, 'Menu', { size: 30 });
  }
}
