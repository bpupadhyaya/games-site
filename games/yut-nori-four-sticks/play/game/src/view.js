// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Static art and sprites are cached.
import { POINTS, TRAY, CHIP, PAD, isBig, host, ZOOMS, AP_SPEEDS } from './layout.js';
import { drawTable, drawBoardArt, drawPadArt } from './art.js';
import { drawCredit, drawMoreLine, drawLockup } from './brand.js';
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

const wrapLines = (ctx, str, maxW) => {
  const words = str.split(' '), lines = []; let cur = '';
  for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
  lines.push(cur); return lines;
};

// About / How to play: laid out once per (page, width, zoom, large text), cached. Sections flow into 1 or 2 columns.
const docCache = new Map();
function docFlow(ctx, P, key, colW, cols, z, big) {
  let d = docCache.get(key);
  if (d) return d;
  const bs = (big ? 24 : 22) * z, hs = 30 * z, blh = bs * 1.34, hlh = hs * 1.2, secGap = 22 * z;
  const secs = P.sections.map((sec) => {
    const items = []; let hgt = 0;
    if (sec.h) { ctx.font = `700 ${hs}px ${FONT}`; for (const ln of wrapLines(ctx, sec.h, colW)) { items.push({ k: 'h', t: ln, y: hgt + hs }); hgt += hlh; } hgt += 4 * z; }
    ctx.font = `500 ${bs}px ${UI}`; for (const ln of wrapLines(ctx, sec.p, colW)) { items.push({ k: 'p', t: ln, y: hgt + bs }); hgt += blh; }
    return { items, h: hgt + secGap };
  });
  const total = secs.reduce((a, s) => a + s.h, 0), columns = [[]]; let acc = 0, cur = 0;
  const colH = [0];
  for (const s of secs) {
    if (cols > 1 && cur < cols - 1 && acc >= total / cols * 0.98) { cur++; columns.push([]); colH.push(0); acc = 0; }
    columns[cur].push({ s, y: colH[cur] }); colH[cur] += s.h; acc += s.h;
  }
  d = { bs, hs, columns, height: Math.max(...colH) };
  docCache.set(key, d); if (docCache.size > 30) docCache.delete(docCache.keys().next().value);
  return d;
}

export function render(ctx, state, L) {
  const t = state.t, scene = state.scene, big = state.big, g = state.game, W = L.w, H = L.h;
  let curS = 1;                                                       // current group scale (text keeps a readable size on screen)
  const minLocal = () => 11 / (Math.max(0.3, host.px) * curS);
  const fitSize = (str, size, maxW, font, weight) => {
    let sz = size;
    if (maxW) { ctx.font = `${weight} ${size}px ${font}`; const w = ctx.measureText(str).width; if (w > maxW) sz = size * maxW / w; }
    return Math.max(sz, minLocal());
  };
  const text = (str, x, y, size, color = '#f7e6bd', font = FONT, weight = 700, align = 'center', maxW = 0) => {
    const sz = fitSize(str, size, maxW, font, weight);
    ctx.textAlign = align; ctx.font = `${weight} ${sz}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center', weight = 500) => {
    const sz = Math.max(size, minLocal()), k = sz / size;
    ctx.font = `${weight} ${sz}px ${UI}`; const lines = wrapLines(ctx, str, maxW);
    lines.forEach((ln, i) => text(ln, x, y + i * lh * k, sz, color, UI, weight, align)); return lines.length;
  };
  const button = (r, label, o = {}) => {
    const rad = Math.min(20, r.h * 0.3);
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#e9694b'); gr.addColorStop(1, '#a2301c'); } else { gr.addColorStop(0, '#5a3b21'); gr.addColorStop(1, '#2f1b0d'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = o.primary ? 'rgba(255,225,160,0.85)' : 'rgba(236,200,130,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();
    const want = Math.min(o.size ?? 30, r.h * 0.46), sz = fitSize(label, want, r.w - 18, UI, 700);
    text(label, r.x + r.w / 2, r.y + r.h / 2 + sz * 0.35, want, '#fff1cf', UI, 700, 'center', r.w - 18);
    ctx.restore();
  };
  const inG = (T, fn) => { ctx.save(); ctx.translate(T.ox, T.oy); ctx.scale(T.s, T.s); curS = T.s; fn(); curS = 1; ctx.restore(); };
  const glowRing = (p, rgb, pulse, r = 26) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, p.x, p.y, r * 2.4, r * 2.4, rgb, 0.55 + 0.3 * pulse); ctx.restore();
    ctx.strokeStyle = `rgba(${rgb},${0.9})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4 + pulse * 3, 0, TAU); ctx.stroke();
  };
  const trayText = (label, x, y) => text(label, x, y, 17, 'rgba(247,230,189,0.7)', UI, 600);
  const sparks = (grp) => {
    for (const f of state.fx) {
      if ((f.g === 'pad') !== (grp === 'pad')) continue;
      const k = f.t / f.dur; if (k >= 1) continue;
      ctx.fillStyle = `rgba(${f.rgb},${0.9 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t + 240 * f.t * f.t * 0.5, f.r * (1 - k * 0.5), 0, TAU); ctx.fill();
    }
  };

  drawTable(ctx, W, H);
  // paper-lantern light: a warm, slightly flickering wash from the upper right
  const fl = 0.5 + 0.06 * Math.sin(t * 3.1) + 0.04 * Math.sin(t * 7.3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; blob(ctx, W - 120, 90, 520, 420, '255,170,70', 0.16 * fl); blob(ctx, 130, H * 0.76, 420, 300, '255,160,80', 0.06); ctx.restore();

  const boardScene = scene === 'play' || scene === 'over' || scene === 'lesson' || scene === 'autoplay' || (scene === 'puzzle' && state.pz?.status !== 'making');
  const showTitleArt = scene === 'title' || scene === 'demo-limit';

  for (const ln of L.lanterns) drawLantern(ctx, ln.x, ln.y, ln.s, t + ln.ph);

  if (boardScene && scene !== 'over') {
    const a = state.anim, hdr = L.hdr;
    // ---- header ------------------------------------------------------------------------------------
    let head = '', sub = '', lessonTag = '';
    if (scene === 'lesson') { const Ls = state.lesson, l = LESSONS[Ls.i]; head = l.title; sub = ''; lessonTag = `Lesson ${Ls.i + 1} of ${LESSONS.length}`; }
    else if (scene === 'puzzle') { head = state.pz.status === 'done' ? 'Challenge complete' : 'Daily challenge'; sub = state.pz.puzzle.weekend ? 'Three throws today' : 'Play the whole turn'; }
    else if (scene === 'autoplay') { lessonTag = 'Auto Play · Watch & Learn'; head = g.winner >= 0 ? `${TEAM_NAME[g.winner]} wins` : state.ap.paused ? 'Paused' : g.phase === 'throw' ? `${TEAM_NAME[g.turn]} throws` : `${TEAM_NAME[g.turn]} thinks`; sub = state.ap.paused ? 'Tap Resume to continue' : `Speed: ${AP_SPEEDS[state.ap.speed].name}`; }
    else if (g.winner >= 0) head = `${TEAM_NAME[g.winner]} wins`;
    else {
      const who = state.two ? `${TEAM_NAME[g.turn]}'s` : g.turn === 0 ? 'Your' : "Red's";
      head = g.phase === 'throw' ? (!state.two && g.turn === 1 ? 'Red throws' : `${who} throw`) : g.turn === 0 || state.two ? 'Choose a token' : 'Red is moving';
      sub = state.two ? 'Two players' : `Computer: ${LEVELS[state.level].name}`;
    }
    text(lessonTag || 'Yut Nori', hdr.cx, hdr.y + hdr.t1, 30, 'rgba(247,230,189,0.75)', FONT, 700, 'center', hdr.w);
    text(head, hdr.cx, hdr.y + hdr.t2, hdr.headSize + (big ? 6 : 0), '#fff3d0', FONT, 700, 'center', hdr.w - 20);
    if (!state.msg) text(sub, hdr.cx, hdr.y + hdr.t3, 24, 'rgba(247,230,189,0.8)', UI, 500, 'center', hdr.w - 20);
    if (state.msg) {
      const al = Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5), bw = Math.min(640, hdr.w), ms = Math.max(big ? 27 : 23, minLocal()), lh = ms * 1.25;
      ctx.save(); ctx.globalAlpha = Math.max(0, al); ctx.font = `600 ${ms}px ${UI}`;
      const lines = wrapLines(ctx, state.msg.text, bw - 50);
      const h = 24 + lines.length * lh, y0 = hdr.y + hdr.msg, x0 = hdr.cx - bw / 2;
      ctx.fillStyle = 'rgba(20,10,4,0.9)'; ctx.beginPath(); ctx.roundRect(x0, y0, bw, h, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(236,200,130,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      lines.forEach((ln, i) => text(ln, hdr.cx, y0 + 16 + ms * 0.85 + i * lh, ms, '#fff3d6', UI, 600));
      ctx.restore();
    }

    inG(L.board, () => {
      drawBoardArt(ctx);
      // ---- trays -----------------------------------------------------------------------------------
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
        const nm = state.two || scene === 'autoplay' ? `${TEAM_NAME[team]}` : team === 0 ? 'You (Blue)' : 'Red';
        text(nm, T.label.x, T.label.y, 24, team === 0 ? '#9fbcff' : '#ff9a82', FONT, 700, 'center', 130);
      }

      const pulse = state.calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 6);
      const humanMove = scene !== 'autoplay' && g.phase === 'move' && !a && (state.two || g.turn === 0) && g.winner < 0;
      // ---- tokens on the board (far rows first so stacks overlap correctly) ----------------------------
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
      // ---- glows: legal landing points, hints, warnings --------------------------------------------------
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
      sparks('board');
      // keyboard cursor
      if (state.kb && humanMove && state.kbTarget != null) { const p = POINTS[state.kbTarget]; ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.arc(p.x, p.y, 42, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    });

    const humanMove = scene !== 'autoplay' && g.phase === 'move' && !a && (state.two || g.turn === 0) && g.winner < 0;
    // ---- throw chips ---------------------------------------------------------------------------------
    inG(L.chips, () => {
      const n = g.pending.length;
      for (let k = 0; k < n; k++) {
        const r = CHIP(k, n), v = g.pending[k], selc = state.selV === v && humanMove && state.selK === k;
        const pop = state.chipPop > 0 ? 1 + 0.12 * Math.sin(Math.min(1, state.chipPop) * Math.PI) : 1;
        ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(pop, pop); ctx.translate(-r.w / 2, -r.h / 2);
        const gr = ctx.createLinearGradient(0, 0, 0, r.h); gr.addColorStop(0, selc ? '#ffe9a6' : '#e9d5a4'); gr.addColorStop(1, selc ? '#e0a83c' : '#b99657');
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(2, 5, r.w, r.h, 14); ctx.fill();
        ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(0, 0, r.w, r.h, 14); ctx.fill();
        ctx.strokeStyle = selc ? '#fff6d0' : 'rgba(90,50,20,0.9)'; ctx.lineWidth = selc ? 4 : 2.5; ctx.stroke();
        text(NAMES[v].toUpperCase(), r.w / 2, 34, 26, v === -1 ? '#8e1b12' : '#2a1608', FONT, 700, 'center', r.w - 8);
        text(v === -1 ? 'back 1' : `${v} step${v > 1 ? 's' : ''}`, r.w / 2, 62, 20, '#4a2a12', UI, 700, 'center', r.w - 8);
        ctx.restore();
      }
    });

    // ---- the throwing pad --------------------------------------------------------------------------
    inG(L.pad, () => {
      drawPadArt(ctx);
      const ta = state.throwAnim, rest = state.rest;
      const drawStickAt = (i, x, y, rot, face, h) => drawStick(ctx, x, y, rot, face, i === 0, h);
      if (ta) {
        ta.sticks.forEach((st, i) => { const uu = Math.min(1, Math.max(0, (ta.t - st.d) / (ta.dur - 0.14))); const p = stickPose(st, uu, ta.strength); drawStickAt(i, p.x, p.y, p.rot, p.face, p.h); });
      } else if (state.grip) {
        for (let i = 0; i < 4; i++) drawStickAt(i, state.grip.x + (i - 1.5) * 16, state.grip.y - 20 + Math.sin(t * 20 + i) * 1.5, (i - 1.5) * 0.12, Math.cos(i * 0.6 + 0.4), 40);
      } else {
        rest.forEach((st, i) => drawStickAt(i, st.x, st.y, st.rot, st.flat ? 1 : -1, 0));
      }
      const canThrow = g.phase === 'throw' && !ta && !a && (state.two || g.turn === 0) && g.winner < 0 && scene !== 'over' && scene !== 'autoplay';
      if (canThrow && !state.grip) {
        const pl = state.calm ? 0.7 : 0.6 + 0.4 * Math.sin(t * 4), msg = 'TAP or SWIPE up to throw', sz = Math.max(30, minLocal());
        ctx.font = `700 ${sz}px ${UI}`; const pw = Math.min(PAD.w - 20, Math.max(500, ctx.measureText(msg).width + 60));
        ctx.save(); ctx.globalAlpha = 0.55 + 0.4 * pl;
        ctx.fillStyle = 'rgba(20,10,4,0.72)'; ctx.beginPath(); ctx.roundRect(360 - pw / 2, PAD.y + 92, pw, 82, 41); ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,150,0.8)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        text(msg, 360, PAD.y + 143, 30, '#fff3d0', UI, 700, 'center', pw - 30);
      } else if (!ta && !canThrow && g.phase === 'throw' && g.winner < 0) {
        text(`${!state.two && scene !== 'autoplay' ? 'Red' : TEAM_NAME[g.turn]} is about to throw`, 360, PAD.y + PAD.h - 22, 24, 'rgba(247,230,189,0.7)', UI, 600, 'center', PAD.w - 40);
      }
      // the result of the last throw
      if (state.result && state.result.t < 2.6) {
        const r = state.result, k = Math.min(1, r.t / 0.28), sc = 0.55 + 0.45 * (1 - Math.pow(1 - k, 3)) + (state.calm ? 0 : 0.05 * Math.sin(k * Math.PI));
        const al = Math.min(1, (2.6 - r.t) / 0.5);
        ctx.save(); ctx.globalAlpha = al; ctx.translate(360, PAD.y + PAD.h * 0.5 - 24); ctx.scale(sc, sc);
        ctx.fillStyle = 'rgba(16,8,4,0.86)'; ctx.beginPath(); ctx.roundRect(-190, -66, 380, 152, 26); ctx.fill();
        ctx.strokeStyle = r.v >= 4 ? '#ffd76a' : 'rgba(236,200,130,0.85)'; ctx.lineWidth = r.v >= 4 ? 5 : 3; ctx.stroke();
        text(NAMES[r.v].toUpperCase(), 0, 22, 84, r.v >= 4 ? '#ffd76a' : r.v === -1 ? '#ff8a72' : '#fff3d0', FONT, 700, 'center', 350);
        text(r.v === -1 ? 'one step BACK' : `${STEPS_TEXT[r.v]} · ${ANIMALS[r.v]}`, 0, 62, 26, '#e8d3a4', UI, 600, 'center', 350);
        ctx.restore();
      }
      sparks('pad');
    });

    // ---- bottom buttons ----------------------------------------------------------------------------
    if (scene === 'play' || scene === 'puzzle') {
      button(L.btn.menu, 'Menu', { size: 26 });
      const canU = state.undo.length > 0 && !a && g.phase === 'move';
      button(L.btn.undo, 'Take back', { size: 26, dim: !canU });
      if (scene === 'play') button(L.btn.hint, `Hint (${state.hintsLeft})`, { size: 26, dim: state.hintsLeft <= 0 });
      else if (state.pz.status === 'done') button(L.btn.hint, 'Share', { size: 26, primary: true });
      else button(L.btn.hint, 'Reset', { size: 26 });
    } else if (scene === 'autoplay') {
      button(L.btn.menu, 'Exit', { size: 26 });
      button(L.btn.undo, state.ap.paused ? 'Resume' : 'Pause', { size: 26, primary: state.ap.paused });
      button(L.btn.hint, `Speed: ${AP_SPEEDS[state.ap.speed].name}`, { size: 22 });
    } else if (scene === 'lesson') {
      button(L.btn.menu, 'Menu', { size: 26 });
      if (state.lesson.done) button(L.btn.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 30 });
    }
    // lesson text panel, sits over the header area
    if (scene === 'lesson') {
      const Ls = state.lesson, l = LESSONS[Ls.i], txt = Ls.done ? l.done : l.texts[Math.min(l.texts.length - 1, Ls.throws)];
      const pw = Math.min(648, hdr.w + 8), sz = Math.max(big ? 27 : 24, minLocal()), lh = sz * 1.25;
      ctx.save(); ctx.font = `600 ${sz}px ${UI}`; const lines = wrapLines(ctx, txt, pw - 48); ctx.restore();
      const h = 28 + lines.length * lh, y0 = hdr.y + hdr.msg;
      ctx.fillStyle = Ls.done ? 'rgba(18,44,24,0.98)' : 'rgba(20,10,4,0.98)'; ctx.beginPath(); ctx.roundRect(hdr.cx - pw / 2, y0, pw, h, 18); ctx.fill();
      ctx.strokeStyle = Ls.done ? 'rgba(160,240,160,0.8)' : 'rgba(236,200,130,0.8)'; ctx.lineWidth = 2; ctx.stroke();
      lines.forEach((ln, i) => text(ln, hdr.cx, y0 + 14 + sz * 0.9 + i * lh, sz, Ls.done ? '#d6ffd0' : '#fff3d6', UI, 600));
    }
    if (scene === 'puzzle' && state.pz.status === 'done') {
      const P = state.pz, stars = '★'.repeat(P.stars) + '☆'.repeat(3 - P.stars), pw = Math.min(648, hdr.w + 8), y0 = hdr.y + hdr.msg + 14;
      const msg = P.stars === 3 ? 'You found the best turn.' : `A better turn: ${P.puzzle.bestText.parts.join(', then ')}.`;
      const sz = Math.max(22, minLocal());
      ctx.save(); ctx.font = `600 ${sz}px ${UI}`; const lines = wrapLines(ctx, msg, pw - 50); ctx.restore();
      const h = 100 + lines.length * sz * 1.25 + 30;
      ctx.fillStyle = 'rgba(16,8,4,0.9)'; ctx.beginPath(); ctx.roundRect(hdr.cx - pw / 2, y0, pw, h, 18); ctx.fill(); ctx.strokeStyle = 'rgba(255,215,106,0.85)'; ctx.lineWidth = 2; ctx.stroke();
      text(stars, hdr.cx, y0 + 52, 44, '#ffd76a', UI, 700);
      lines.forEach((ln, i) => text(ln, hdr.cx, y0 + 88 + i * sz * 1.25, sz, '#fff3d6', UI, 600));
      text(`Streak: ${state.daily.streak} day${state.daily.streak === 1 ? '' : 's'}`, hdr.cx, y0 + h - 14, 22, 'rgba(247,230,189,0.8)', UI, 600);
    }
  }

  // ---- title -----------------------------------------------------------------------------------------
  if (showTitleArt) {
    const T = L.title(!!state.saved), art = T.art, R = T.rows;
    if (art.board) {                                                    // the dimmed board behind the tumbling sticks (tall screens with room)
      inG(art.board, () => drawBoardArt(ctx));
      const bt = art.board.oy + 290 * art.board.s;
      { const vg = ctx.createLinearGradient(0, bt, 0, bt + 82); vg.addColorStop(0, 'rgba(12,8,22,0)'); vg.addColorStop(1, 'rgba(12,8,22,0.88)'); ctx.fillStyle = vg; ctx.fillRect(0, bt, W, 82); }
      ctx.fillStyle = 'rgba(12,8,22,0.55)'; ctx.fillRect(0, bt + 82, W, T.rowsTop - bt - 82);
    }
    if (art.panel) { ctx.fillStyle = 'rgba(12,8,22,0.55)'; ctx.beginPath(); ctx.roundRect(art.panel.x, art.panel.y, art.panel.w, art.panel.h, 26); ctx.fill(); }
    if (scene === 'title') {
      if (art.showSticks) {
        for (let i = 0; i < 4; i++) {
          const ph = t * 1.25 + i * 1.3;
          drawStick(ctx, art.cx + (i - 1.5) * art.spread, art.sticksY + Math.sin(ph) * 10, (i - 1.5) * 0.28 + Math.sin(t * 0.6 + i) * 0.25, Math.cos(t * 1.7 + i * 1.9), i === 0, 26 + 20 * Math.sin(ph * 1.1 + 1));
        }
        drawToken(ctx, art.cx - art.tokDx, art.tokensY, 0, { scale: 1.5, lift: 8 + 6 * Math.sin(t * 2) }); drawToken(ctx, art.cx + art.tokDx, art.tokensY, 1, { scale: 1.5, lift: 8 + 6 * Math.sin(t * 2 + 1.5) });
      }
      ctx.save(); ctx.shadowColor = 'rgba(255,170,60,0.7)'; ctx.shadowBlur = 24;
      text('Yut Nori', art.cx, art.titleY, 132, '#fff0c8', FONT, 700, 'center', art.titleMaxW ?? art.maxW); ctx.restore();
      text("Korea's four-stick race", art.cx, art.tagY, 34, '#f0d9a2', FONT, 700, 'center', art.maxW);
    }
    // the dark backing behind the buttons
    if (!L.wide) {
      const y = T.rowsTop - 14;
      { const vg = ctx.createLinearGradient(0, y - 80, 0, y); vg.addColorStop(0, 'rgba(12,8,22,0)'); vg.addColorStop(1, 'rgba(12,8,22,0.93)'); ctx.fillStyle = vg; ctx.fillRect(0, y - 80, W, 80); ctx.fillStyle = 'rgba(12,8,22,0.93)'; ctx.fillRect(0, y, W, H - y); }
    } else { const p = T.rowsPanel; ctx.fillStyle = 'rgba(12,8,22,0.93)'; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 26); ctx.fill(); }
    if (scene === 'title') {
      const solvedToday = state.daily.solvedDay === state.daily.day, kr = T.kr;
      const sz = (n) => (T.compact ? Math.max(n, 28) : n);
      if (R.resume) button(R.resume, 'Continue your game', { primary: true, size: sz(30) });
      button(R.learn, 'Learn to play', { primary: !state.learned && !R.resume, size: sz(30) });
      button(R.play, 'Play the computer', { primary: state.learned && !R.resume, size: sz(30) });
      button(R.two, 'Two teams, one phone', { size: sz(28) });
      button(R.auto, 'Auto Play · Watch & Learn', { size: sz(26) });
      button(R.daily, solvedToday ? `Daily challenge · solved · streak ${state.daily.streak}` : state.daily.streak ? `Daily challenge · streak ${state.daily.streak}` : 'Daily challenge', { size: sz(26) });
      button(R.level, `Computer: ${LEVELS[state.level].name}`, { size: sz(22) }); button(R.sound, state.sound ? 'Sound on' : 'Sound off', { size: sz(22) });
      button(R.calm, state.calm ? 'Reduced motion: on' : 'Reduced motion: off', { size: sz(20) }); button(R.big, state.big ? 'Large text: on' : 'Large text: off', { size: sz(20) });
      button(R.about, 'About Yut Nori', { size: sz(22) }); button(R.how, 'How to play', { size: sz(22) });
      if (!drawLockup(ctx, T.lock.cx, T.lock.y, T.lock.w, 0.9, (state.afFlash || 0) > 0)) { const cs = Math.max(15, 11 / Math.max(0.3, host.px)), pw = Math.min(T.rowsW, cs * 27); ctx.fillStyle = 'rgba(12,8,22,0.72)'; ctx.beginPath(); ctx.roundRect(T.lock.cx - pw / 2, T.lock.y, pw, cs * 2.8, cs * 1.4); ctx.fill(); drawCredit(ctx, T.lock.cx, T.lock.y + cs * 1.8, cs, { dim: 0.95 }); }
      text(LEVELS[state.level].blurb, T.cx, T.blurbY, 20, 'rgba(247,230,189,0.85)', UI, 500, 'center', T.blurbW ?? T.rowsW + 20);
      for (let l = 0; l < LEVELS.length; l++) text('★', T.cx + (l - 2) * 46 * kr, T.starsY, 34 * kr, state.stats.badges['L' + l] ? '#ffd24a' : 'rgba(255,255,255,0.22)', UI, 700);
      text(`Games played: ${state.stats.games} · won: ${state.stats.wins}`, T.cx, T.statsY, 20, 'rgba(247,230,189,0.65)', UI, 500, 'center', T.blurbW ?? T.rowsW + 20);
      if (state.msg) wrap(state.msg.text, T.cx, T.msgY, 22, Math.min(W - 40, 620), '#ffe9b0');
    } else {
      const cx = L.wide ? T.cx : W / 2, cy = L.wide ? H / 2 : H * 0.58;
      text('That was the free taste.', cx, cy, 46, '#f7e6bd', FONT, 700, 'center', (L.wide ? T.rowsW : W) - 40);
      text('Get Yut Nori on iPhone and Android', cx, cy + 60, 28, '#fff3d6', UI, 600, 'center', (L.wide ? T.rowsW : W) - 40); text('for unlimited games.', cx, cy + 100, 28, '#fff3d6', UI, 600, 'center', (L.wide ? T.rowsW : W) - 40);
      button(L.page.back, 'Menu', { size: 30, primary: true });
    }
  }
  if (scene === 'puzzle' && state.pz?.status === 'making') {
    ctx.fillStyle = 'rgba(12,8,22,0.6)'; ctx.fillRect(0, 0, W, H);
    text("Preparing today's challenge…", W / 2, H * 0.45, 34, '#fff3d6', UI, 600, 'center', W - 60); button(L.btn.menu, 'Menu', { size: 26 });
  }
  // ---- About and How to play: scrolling, zoomable text -------------------------------------------------
  if (scene === 'about' || scene === 'how') {
    const P = scene === 'about' ? ABOUT : HOWTO, pg = L.page, z = ZOOMS[state.zoom] ?? 1, b = pg.body;
    ctx.fillStyle = 'rgba(12,8,22,0.8)'; ctx.fillRect(0, 0, W, H);
    text(P.title, pg.cx, pg.titleY, 62, '#f7e6bd', FONT, 700, 'center', W - 2 * (host.l + 20) - 220);
    ctx.font = `500 ${(big ? 24 : 22) * z}px ${UI}`;
    const d = docFlow(ctx, P, `${scene}|${Math.round(pg.colW)}|${pg.cols}|${z}|${big}`, pg.colW, pg.cols, z, big);
    state.doc.max = Math.max(0, Math.round(d.height - b.h + 12)); state.doc.scroll = Math.max(0, Math.min(state.doc.max, state.doc.scroll));
    ctx.save(); ctx.beginPath(); ctx.rect(b.x - 6, b.y, b.w + 12, b.h); ctx.clip(); ctx.translate(0, b.y - state.doc.scroll);
    d.columns.forEach((col, ci) => {
      const x = b.x + ci * (pg.colW + pg.gap);
      for (const { s, y } of col) for (const it of s.items) {
        if (it.k === 'h') { ctx.font = `700 ${d.hs}px ${FONT}`; ctx.fillStyle = '#ffd76a'; } else { ctx.font = `500 ${d.bs}px ${UI}`; ctx.fillStyle = '#fff3d6'; }
        ctx.textAlign = 'left'; ctx.fillText(it.t, x, y + it.y);
      }
    });
    ctx.restore();
    if (state.doc.max > 0) {
      const th = Math.max(36, b.h * b.h / (d.height + 12)), ty = b.y + (b.h - th) * (state.doc.scroll / state.doc.max);
      ctx.fillStyle = 'rgba(255,230,170,0.35)'; ctx.beginPath(); ctx.roundRect(Math.min(W - 8, b.x + b.w + 2), ty, 5, th, 3); ctx.fill();
    }
    button(pg.back, 'Back', { size: 30, primary: true });
    button(pg.dec, 'A−', { size: 30, dim: state.zoom <= 0 }); button(pg.inc, 'A+', { size: 30, dim: state.zoom >= ZOOMS.length - 1 });
    text(`${Math.round(z * 100)}%`, pg.dec.x + pg.dec.w / 2, pg.dec.y - 8, 16, 'rgba(247,230,189,0.7)', UI, 600);
  }
  // ---- result ----------------------------------------------------------------------------------------
  if (scene === 'over') {
    const O = L.over;
    ctx.fillStyle = 'rgba(8,6,16,0.74)'; ctx.fillRect(0, 0, W, H);
    const winner = g.winner;
    const won = state.two ? `${TEAM_NAME[winner]} wins!` : winner === 0 ? 'You win!' : 'Red wins';
    drawToken(ctx, O.token.x, O.token.y, winner, { scale: O.token.s, lift: 10 + (state.calm ? 0 : Math.sin(t * 3) * 6) });
    text(won, O.cx, O.winY, O.winSize, '#f7e6bd', FONT, 700, 'center', (L.wide ? 520 : W) - 40);
    text(`${g.throws} throws · ${g.moves} moves`, O.cx, O.stat1, 26, '#fff3d6', UI, 500, 'center', 500);
    if (!state.two && winner === 0) {
      text(`★ ${LEVELS[state.level].name} beaten`, O.cx, O.stat2, 26, '#ffd24a', UI, 600, 'center', 500);
      if (!state.calm) for (let k = 0; k < 16; k++) { const ph = (t * 0.35 + k * 0.137) % 1, x = O.token.x + Math.sin(k * 2.4) * (150 + 90 * ph), y = O.token.y + 80 - ph * 420; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 4 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    }
    button(O.again, 'Play again', { primary: true, size: 34 }); button(O.back, 'Menu', { size: 30 });
    drawMoreLine(ctx, O.cx, O.moreY, Math.max(16, 11 / Math.max(0.3, host.px)));
  }
}
