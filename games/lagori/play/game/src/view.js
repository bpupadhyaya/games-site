// Everything drawn each frame. Reads `state` (game.js) and changes nothing. Court, stones and ball are cached sprites (art.js).
// Every position comes from the layout `L` for the live screen size (layout.js); the court itself is drawn in canonical space
// through one transform (L.play(scene): scale f, centre cx, cy).
import { CX, CY, CW, CH, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawBackdrop, drawCourt, drawStone, drawBall, drawKid, STONE_COLORS, STONE_THICK } from './art.js';
import { TOWER, THROWER, LINE_Y, STONES, THROWS, RUNNERS, INNINGS, LEVELS, REBUILD_TIME, BALL_R, RUNNER_R, stoneR, landingError, holderPos, activeRunner, DODGE_COOL } from './engine.js';
import { flowOf } from './pages.js';
import { drawLockup, drawMoreLine } from './brand.js';

const DISPLAY = '"Dela Gothic One", "Arial Black", system-ui, sans-serif', BODY = '"Barlow", "Trebuchet MS", system-ui, sans-serif', NUM = '"Barlow Condensed", "Barlow", system-ui, sans-serif';
const TAU = Math.PI * 2, GOLD = '#ffd45e', CREAM = '#fff6e2', INK = '#2a0f06', PLATE = '32,13,5';
const R4 = (x, y, w, h) => ({ x, y, w, h });

// How far the current reader page overflows its viewport (set while drawing; game.js clamps scrolling with it).
export const reader = { max: 0 };
const flowCache = new Map();

export function render(ctx, state, L, gl = null) { ctx.save(); draw(ctx, state, L, gl); ctx.restore(); }

function draw(ctx, state, L, gl) {
  const ts = TEXT_SCALES[state.textScaleIdx] ?? 1, bs = Math.min(ts, 1.16), sc = state.scene, t = state.t;
  const W = L.w, H = L.h, FL = L.minText;
  const font = (w, size, fam = BODY) => `${w} ${size}px ${fam}`;
  const text = (str, x, y, size, color = CREAM, align = 'center', weight = 600, fam = BODY) => { ctx.textAlign = align; ctx.font = font(weight, Math.max(size, FL), fam); ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fit = (str, maxW, size, weight = 600, fam = BODY) => { let s = size; const lo = FL * 0.85; ctx.font = font(weight, s, fam); while (s > lo && ctx.measureText(str).width > maxW) { s = Math.max(lo, s * 0.93); ctx.font = font(weight, s, fam); } return s; };
  const fitText = (str, x, y, size, maxW, color = CREAM, align = 'center', weight = 600, fam = BODY) => { const s = fit(str, maxW, Math.max(size, FL), weight, fam); ctx.textAlign = align; ctx.font = font(weight, s, fam); ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const lines = (str, size, maxW, weight = 500) => {
    ctx.font = font(weight, size); const out = [];
    for (const para of String(str).split('\n')) { let cur = ''; for (const w of para.split(' ')) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; } out.push(cur); }
    return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.28, align = 'center', weight = 500) => { size = Math.max(size, FL); const out = lines(str, size, maxW, weight); out.forEach((ln, i) => text(ln, x, y + i * lh, size, color, align, weight)); return out.length; };
  const wrapIn = (str, r, size, color = CREAM, o = {}) => {
    const align = o.align ?? 'center', weight = o.weight ?? 500, pad = o.pad ?? 12, tw = r.w - 2 * pad; let s = Math.max(size, FL), out;
    for (;;) { out = lines(str, s, tw, weight); if (out.length * s * 1.26 <= r.h - 2 * (o.vpad ?? 6) || s <= FL) break; s = Math.max(FL, s * 0.94); }
    const lh = s * 1.26, total = out.length * lh, y0 = o.vc ? r.y + (r.h - total) / 2 : r.y + (o.vpad ?? 6);
    const x = align === 'center' ? r.x + r.w / 2 : align === 'left' ? r.x + pad : r.x + r.w - pad;
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    out.forEach((ln, i) => text(ln, x, y0 + s * 0.92 + i * lh, s, color, align, weight)); ctx.restore(); return s;
  };
  const shadowText = (str, x, y, size, color, align = 'center', weight = 400, maxW = 0, fam = DISPLAY) => { const s = maxW ? fit(str, maxW, Math.max(size, FL), weight, fam) : size; text(str, x + 2, y + 4, s, 'rgba(10,2,0,0.6)', align, weight, fam); text(str, x, y, s, color, align, weight, fam); };
  // Chrome in the village's own materials: carved walnut plaques with a brass edge, lacquered buttons with a real depth slab and a pressed state.
  const brassEdge = (r, rad, w = 2.5, a = 1) => {
    const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h); g.addColorStop(0, '#ffe9a6'); g.addColorStop(0.45, '#d9a43c'); g.addColorStop(1, '#8a5a18');
    ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.roundRect(r.x + w / 2, r.y + w / 2, r.w - w, r.h - w, Math.max(2, rad - w / 2)); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,12,2,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + w + 1, r.y + w + 1, r.w - 2 * w - 2, r.h - 2 * w - 2, Math.max(2, rad - w - 1)); ctx.stroke(); ctx.restore();
  };
  const woodFill = (r, rad, a, lit) => {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (lit) { g.addColorStop(0, `rgba(104,62,34,${a})`); g.addColorStop(1, `rgba(58,30,16,${a})`); } else { g.addColorStop(0, `rgba(78,46,26,${a})`); g.addColorStop(1, `rgba(40,20,10,${a})`); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.clip(); ctx.globalAlpha = 0.14 * a;
    for (let i = 0; i < r.h / 7; i++) { const y = r.y + 3 + i * 7 + Math.sin(i * 2.3) * 2; ctx.strokeStyle = i % 3 ? '#1a0a02' : '#ffcf8a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x, y); ctx.bezierCurveTo(r.x + r.w * 0.3, y + 3, r.x + r.w * 0.6, y - 3, r.x + r.w, y + 1); ctx.stroke(); }
    ctx.restore();
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const press = o.press ? 4 : 0, rad = Math.min(r.h * 0.3, 24), dep = Math.max(4, Math.min(8, r.h * 0.1));
    // contact shadow, the slab (the button's thickness), then the face
    ctx.fillStyle = 'rgba(20,6,0,0.38)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + dep + 5, r.w, r.h, rad); ctx.fill();
    const slab = o.primary ? '#8a3c00' : o.hot ? '#6e0f08' : '#1c0d05';
    ctx.fillStyle = slab; ctx.beginPath(); ctx.roundRect(r.x, r.y + dep, r.w, r.h, rad); ctx.fill();
    const fy = r.y + press * (dep / 4), face = { x: r.x, y: fy, w: r.w, h: r.h };
    const gr = ctx.createLinearGradient(0, fy, 0, fy + r.h);
    if (o.primary) { gr.addColorStop(0, '#ffe58a'); gr.addColorStop(0.5, '#ffb52a'); gr.addColorStop(1, '#f08a0a'); }
    else if (o.hot) { gr.addColorStop(0, '#ff8a6a'); gr.addColorStop(1, '#c4261a'); }
    else { gr.addColorStop(0, o.tone ?? '#7a4a2a'); gr.addColorStop(1, '#3f2012'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(face.x, face.y, face.w, face.h, rad); ctx.fill();
    if (o.primary || o.hot) { ctx.strokeStyle = 'rgba(255,248,214,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(face.x + 1, face.y + 1, face.w - 2, face.h - 2, rad); ctx.stroke(); } else brassEdge(face, rad, 2.5);
    const want = (o.size ?? (r.h > 80 ? 32 : 26)) * (o.noscale ? 1 : Math.min(bs, 1.08)), sub = o.sub && r.h >= 74 ? o.sub : '';
    const s = label ? fit(label, r.w - 26, want, 400, DISPLAY) : want, cy = fy + (sub ? r.h * 0.42 : r.h / 2);
    if (label) { if (!o.primary && !o.hot) text(label, r.x + r.w / 2 + 1, cy + s * 0.34 + 2, s, 'rgba(10,2,0,0.55)', 'center', 400, DISPLAY); text(label, r.x + r.w / 2, cy + s * 0.34, s, o.primary ? INK : CREAM, 'center', 400, DISPLAY); }
    if (sub) { ctx.font = font(600, FL); if (ctx.measureText(sub).width <= r.w - 20) text(sub, r.x + r.w / 2, fy + r.h - 14, FL, o.primary ? 'rgba(42,15,6,0.78)' : 'rgba(255,246,226,0.72)', 'center', 600); }
    ctx.restore();
  };
  const panel = (r, a = 0.8, rad = 26) => { ctx.save(); ctx.fillStyle = 'rgba(18,6,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 5, r.w, r.h, rad); ctx.fill(); ctx.restore(); woodFill(r, rad, Math.min(1, a + 0.1), false); brassEdge(r, rad, 2.5, 0.9); };
  const inCourt = (cx, cy, f, shake, fn) => { ctx.save(); ctx.translate(cx + (shake?.x ?? 0), cy + (shake?.y ?? 0)); ctx.scale(f, f); ctx.translate(-CX, -CY); fn(); ctx.restore(); };
  const dotted = (pts, color, w, dash, gap) => { ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([dash, gap]); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.restore(); };

  // ---------------------------------------------------------------- the court scene (title attract, play, auto)
  // Two renderers share every overlay. With the 3D layer (GL) the people, stones, ball and ground are real 3D objects drawn behind this
  // canvas and every marker is projected through the camera (gl.project); without it (no WebGL2, ?nogl, load failure) the court, kids and
  // stones are the cached 2D art drawn inside the court transform.
  const GL = gl && gl.on ? gl : null;
  const ZPX = 46;                                              // 2D art: pixels per metre of height
  const K = GL ? GL.k : 1;                                     // screen units per court unit (line widths, dashes)
  const Z = (v) => v * (GL ? Math.max(0.85, Math.min(1.3, K)) : 1);    // sizes of badges and labels
  const pt = (x, y, zm = 0) => (GL ? GL.project(x, y, zm) : { x, y: y - zm * ZPX });
  // a circle of radius r (court units) lying on the ground, as the ellipse it appears as
  const circ = (x, y, r) => {
    if (!GL) return { x, y, rx: r, ry: r * 0.55 };
    const c = GL.project(x, y, 0), a = GL.project(x + r, y, 0), b = GL.project(x, y + r, 0), d = GL.project(x, y - r, 0);
    return { x: c.x, y: c.y, rx: Math.abs(a.x - c.x), ry: Math.max(2, Math.abs(b.y - d.y) / 2) };
  };
  const ringAt = (x, y, r, stroke, lwd, fill) => { const e = circ(x, y, r); ctx.beginPath(); ctx.ellipse(e.x, e.y, Math.max(2, e.rx), Math.max(2, e.ry), 0, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lwd; ctx.stroke(); } };
  const badge = (x, y, str, fillC = '#ffd45e', ink = INK, r = 13) => { const rr = Z(r); ctx.fillStyle = fillC; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(40,16,0,0.55)'; ctx.lineWidth = Math.max(1.5, rr * 0.12); ctx.stroke(); text(str, x, y + rr * 0.38, rr * 1.35, ink, 'center', 800, NUM); };
  // a downward pointer above a head
  const pointer = (x, y, color, s) => { ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = 'rgba(30,10,0,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s, y - s * 1.3); ctx.lineTo(x + s, y - s * 1.3); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); };
  const fieldVis = (k) => (GL && GL.fielders && GL.fielders[k]) || inn0().fielders[k];
  let inn0 = () => null;

  const courtScene = (inn, o) => {
    inn0 = () => inn;
    const calm = state.calm, R = inn.runners, stones = inn.stones, b = inn.ball, h = holderPos(inn), teamF = o.fieldTeam, teamS = o.strikeTeam;
    if (!GL) {
      drawCourt(ctx);
      const items = [];
      const stackIdx = stones.filter((s) => s.state === 'tower' || s.state === 'placed').map((s) => s.i);
      if (stackIdx.length) items.push({ y: TOWER.y + 1, d: () => { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#4a1d0a'; ctx.beginPath(); ctx.ellipse(TOWER.x + 8, TOWER.y + 7, 34, 15, 0, 0, TAU); ctx.fill(); ctx.restore(); stackIdx.sort((a, c) => a - c).forEach((i, k) => drawStone(ctx, i, TOWER.x, TOWER.y - k * STONE_THICK)); } });
      for (const s of stones) if (s.state === 'ground') {
        const mv = Math.hypot(s.vx, s.vy), lift = Math.min(36, mv * 0.14);
        items.push({ y: s.y, d: () => drawStone(ctx, s.i, s.x, s.y, lift, s.rot) });
      }
      inn.fielders.forEach((f, k) => items.push({ y: f.y, d: () => drawKid(ctx, f.x, f.y, { team: teamF, face: f.face, phase: f.anim * 0.5, moving: false, pose: k === inn.holder && b.mode === 'held' ? (inn.wind ? 'wind' : 'ready') : 'ready', throwAnim: f.throwAnim, scale: 1, look: k }) }));
      R.forEach((r, k) => {
        if (r.state === 'out') { items.push({ y: 868, d: () => { const bx = 520 + k * 52; ctx.save(); ctx.globalAlpha = 0.6; drawKid(ctx, bx, 884, { team: teamS, face: 1, phase: 0, moving: false, pose: 'sit', scale: 0.8, look: k + 5 }); ctx.restore(); } }); return; }
        if (r.state === 'wait') { items.push({ y: r.y, d: () => drawKid(ctx, 110 + k * 56, 850, { team: teamS, face: 1, phase: t * 0.3 + k, moving: false, scale: 0.92, look: k + 5 }) }); return; }
        items.push({ y: r.y, d: () => {
          drawKid(ctx, r.x, r.y, { team: teamS, face: r.face, phase: r.phase, moving: Math.hypot(r.vx, r.vy) > 6, speed: Math.hypot(r.vx, r.vy), carry: r.carry, dodge: r.dodge > 0 ? 1 : 0, dodgeDir: Math.sign(r.dvx) || r.face, alpha: r.dodge > 0 ? 0.8 : 1, look: k + 5 });
          if (r.carry >= 0) drawStone(ctx, r.carry, r.x + r.face * 4, r.y, 46, 0, 1, 0.8);
        } });
      });
      if (inn.phase === 'throw') items.push({ y: THROWER.y, d: () => drawKid(ctx, THROWER.x, THROWER.y + 18, { team: teamS, face: 1, phase: 0, moving: false, pose: o.aim ? 'wind' : 'ready', scale: 1.08, throwAnim: b.mode === 'flight' ? 1 : 0, look: 9 }) });
      items.sort((a, c) => a.y - c.y).forEach((it) => it.d());
      // the ball and its tail
      const tr = state.trail;
      for (let i = 0; i < tr.length; i += 2) { const q = tr[i], age = 1 - (t - q.t) / 0.5; if (age <= 0) continue; ctx.fillStyle = q.hit ? `rgba(255,150,110,${0.45 * age})` : `rgba(255,248,215,${0.5 * age})`; ctx.beginPath(); ctx.arc(q.x, q.y - q.z, 3 + 5 * age, 0, TAU); ctx.fill(); }
      if (b.mode !== 'held' || inn.phase === 'throw') { const bx = b.mode === 'held' && inn.phase === 'throw' ? THROWER.x + 20 : b.x, by = b.mode === 'held' && inn.phase === 'throw' ? THROWER.y - 6 : b.y; drawBall(ctx, bx, by, b.mode === 'held' ? 14 : b.z); }
      else drawBall(ctx, h.x + inn.fielders[inn.holder].face * 12, h.y - 4, 28);
    }
    // ---- markers over the court (both renderers)
    // stones: the glowing hint, the numbers of the fetch queue, and (Show guide) the 1..7 order
    for (const s of stones) if (s.state === 'ground') {
      const hint = o.hintStone === s.i, q = o.queue ? o.queue.indexOf(s.i) : -1, p = pt(s.x, s.y, 0.16);
      if (hint || q >= 0) { const a = 0.55 + 0.35 * Math.sin(t * 6); ringAt(s.x, s.y, stoneR(s.i) + 12, q >= 0 ? `rgba(255,236,140,${a})` : `rgba(130,255,200,${a})`, 4 * K); }
      if (q >= 0) badge(p.x, p.y - Z(30), String(q + 1)); else if (o.tapNum) text(String(s.i + 1), p.x, p.y - Z(2), Z(17), 'rgba(255,255,255,0.88)', 'center', 800, NUM);
    }
    // runners: the one on the court is ringed and tagged with a pointer, the waiting ones numbered, the out ones marked
    R.forEach((r, k) => {
      if (r.state === 'out') { const bx = 520 + k * 52, p = pt(bx, 884, 1.15); text('OUT', p.x, p.y, Z(17), '#ff8a70', 'center', 800, NUM); return; }
      if (r.state === 'wait') { const p = pt(110 + k * 56, 850, 2.0); badge(p.x, p.y, String(k + 1), 'rgba(255,246,226,0.92)', INK, 11); return; }
      const a = 0.55 + 0.4 * Math.sin(t * 5), col = teamS === 'H' ? '#ffd45e' : '#7ff0e2';
      ringAt(r.x, r.y + 2, RUNNER_R + 12, `rgba(${teamS === 'H' ? '255,226,120' : '120,245,230'},${a})`, 4 * K, 'rgba(255,255,255,0.10)');
      const head = pt(GL && GL.vis && GL.vis.runners[k] ? GL.vis.runners[k].x : r.x, GL && GL.vis && GL.vis.runners[k] ? GL.vis.runners[k].y : r.y, 2.15);
      pointer(head.x, head.y - Z(6) + Math.sin(t * 6) * 2, col, Z(11));
      if (r.dodge > 0) { const e = circ(r.x, r.y, 30 + r.dodge * 40); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3 * K; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, TAU); ctx.stroke(); }
    });
    // the tower throw: where the ball will land, while it is in the air
    if (inn.phase === 'throw' && b.mode === 'flight' && !b.hit && inn.last) { const a = 0.45 + 0.4 * Math.sin(t * 16); ringAt(inn.last.x, inn.last.y, Math.max(10, inn.last.er), `rgba(255,252,236,${a})`, 3 * K, 'rgba(255,250,225,0.14)'); }
    // the fielders' throw in the air: the point it is heading for and the line it flies
    if (b.mode === 'flight' && b.hit) {
      ringAt(b.tx, b.ty, 30, 'rgba(255,70,50,0.95)', 5 * K, 'rgba(255,40,20,0.16)');
      const a0 = pt(b.x, b.y, 0.9), a1 = pt(b.tx, b.ty, 0.9); ctx.save(); ctx.strokeStyle = 'rgba(255,90,60,0.6)'; ctx.lineWidth = 3 * K; ctx.setLineDash([6 * K, 8 * K]); ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y); ctx.stroke(); ctx.restore();
    }
    // aim overlays
    if (o.aim) {
      const a = o.aim;
      if (a.kind === 'tower') {
        const er = landingError(a.x, a.y, 1), pts = [];
        for (let i = 0; i <= 18; i++) { const u = i / 18, x = THROWER.x + (a.x - THROWER.x) * u, y = THROWER.y - 18 + (a.y - THROWER.y + 18) * u; pts.push(GL ? (() => { const p = GL.project(x, y, 0.5 + Math.sin(u * Math.PI) * 2.1); return [p.x, p.y]; })() : [x, y - Math.sin(u * Math.PI) * 120]); }
        dotted(pts, 'rgba(20,6,0,0.35)', 7 * K, 2 * K, 11 * K); dotted(pts, 'rgba(255,252,236,0.95)', 4 * K, 2 * K, 11 * K);
        ctx.save(); ctx.setLineDash([6 * K, 6 * K]); ringAt(a.x, a.y, er * 1.1, 'rgba(255,250,225,0.96)', 3 * K, 'rgba(255,250,225,0.22)'); ctx.restore();
        const c = circ(a.x, a.y, 4); ctx.fillStyle = '#ffd45e'; ctx.beginPath(); ctx.arc(c.x, c.y, Math.max(4, 5 * K), 0, TAU); ctx.fill();
      } else {
        const hp = fieldVis(inn.holder), p0 = pt(hp.x, hp.y, 1.2), p1 = pt(a.x, a.y, 0.6);
        dotted([[p0.x, p0.y], [p1.x, p1.y]], 'rgba(20,6,0,0.35)', 7 * K, 2 * K, 10 * K); dotted([[p0.x, p0.y], [p1.x, p1.y]], 'rgba(255,252,236,0.95)', 4 * K, 2 * K, 10 * K);
        ringAt(a.x, a.y, 28, '#ffe27a', 4 * K);
        ctx.save(); ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 4 * K; const c = circ(a.x, a.y, 28), l = 14 * K, m = 12 * K;
        ctx.beginPath(); ctx.moveTo(c.x - c.rx - m, c.y); ctx.lineTo(c.x - c.rx + l, c.y); ctx.moveTo(c.x + c.rx - l, c.y); ctx.lineTo(c.x + c.rx + m, c.y); ctx.moveTo(c.x, c.y - c.ry - m); ctx.lineTo(c.x, c.y - c.ry + l * 0.6); ctx.moveTo(c.x, c.y + c.ry - l * 0.6); ctx.lineTo(c.x, c.y + c.ry + m); ctx.stroke(); ctx.restore();
      }
    }
    // the computer's wind-up: a ring that tightens on the runner, then locks
    const w = inn.wind, r0 = activeRunner(inn);
    if (w && r0) {
      const u = Math.min(1, w.t / w.dur), rad = 62 - u * 34 + (w.locked ? 0 : Math.sin(t * 14) * 1.5), hp = fieldVis(inn.holder), p0 = pt(hp.x, hp.y, 1.2), p1 = pt(w.x, w.y, 0.6);
      ctx.save(); ctx.globalAlpha = 0.5; dotted([[p0.x, p0.y], [p1.x, p1.y]], 'rgba(255,60,40,0.9)', 3 * K, 3 * K, 9 * K); ctx.globalAlpha = 1;
      ringAt(w.x, w.y, rad, w.locked ? '#ff2a1a' : `rgba(255,${130 - u * 80},60,0.95)`, (w.locked ? 6 : 4) * K, w.locked ? 'rgba(255,40,20,0.22)' : null);
      ctx.restore();
    }
    // effects
    for (const f of state.fx) {
      const a = f.t / f.dur;
      if (f.type === 'ring') { const e = circ(f.x, f.y, (10 + a * 56 * f.s) * (calm ? 0.6 : 1)); ctx.strokeStyle = `rgba(255,246,220,${0.8 * (1 - a)})`; ctx.lineWidth = (4 * (1 - a) + 1) * K; ctx.beginPath(); ctx.ellipse(e.x, e.y, e.rx, e.ry, 0, 0, TAU); ctx.stroke(); }
      else if (f.type === 'dust') { const p = pt(f.x + f.vx * f.t, f.y + f.vy * f.t, 0.1 + a * 0.35); ctx.fillStyle = `rgba(250,225,180,${0.5 * (1 - a)})`; ctx.beginPath(); ctx.arc(p.x, p.y, (6 + a * 14) * K, 0, TAU); ctx.fill(); }
      else if (f.type === 'burst') { const p = pt(f.x, f.y, f.z ?? 0.8), n = 12, r1 = (14 + a * 70) * Z(1) * (calm ? 0.6 : 1), r2 = r1 + (26 - a * 14) * Z(1); ctx.save(); ctx.strokeStyle = f.color ?? 'rgba(255,225,120,1)'; ctx.globalAlpha = Math.max(0, 1 - a * 1.1); ctx.lineWidth = Math.max(2, 6 * (1 - a)) * Math.max(0.8, K); ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < n; i++) { const an = i / n * TAU + (f.s ?? 0); ctx.moveTo(p.x + Math.cos(an) * r1, p.y + Math.sin(an) * r1 * 0.8); ctx.lineTo(p.x + Math.cos(an) * r2, p.y + Math.sin(an) * r2 * 0.8); } ctx.stroke(); ctx.restore(); }
      else if (f.type === 'pop') {
        const p = pt(f.x, f.y, 1.4 + a * 0.9), lo = GL ? GL.band.x + 100 : 110, hi = GL ? GL.band.x + GL.band.w - 100 : CW - 110;
        ctx.globalAlpha = Math.min(1, 2 - a * 2); shadowText(f.text, Math.max(lo, Math.min(hi, p.x)), p.y, 40 * (GL ? Math.max(0.9, Math.min(1.3, K)) : 1), f.color ?? GOLD, 'center', 400, 0); ctx.globalAlpha = 1;
      } else if (f.type === 'flash') { ctx.fillStyle = `rgba(255,70,50,${0.2 * (1 - a)})`; if (GL) ctx.fillRect(0, 0, W, H); else ctx.fillRect(0, 100, CW, CH - 100); }
    }
  };

  // ---------------------------------------------------------------- TITLE
  if (sc === 'title') {
    const T = L.title(false);
    if (GL) ctx.clearRect(0, 0, W, H); else drawBackdrop(ctx, W, H);
    if (state.demo.inn) {
      const dinn = state.demo.inn, o = { fieldTeam: 'C', strikeTeam: 'H', mine: false, aim: null, queue: null };
      if (GL) courtScene(dinn, o); else inCourt(T.hero.cx, T.hero.cy, T.hero.sc, null, () => courtScene(dinn, o));
    }
    if (!L.land) {
      const gr = ctx.createLinearGradient(0, 0, 0, T.brand.y + 90); gr.addColorStop(0, `rgba(${PLATE},0.88)`); gr.addColorStop(1, `rgba(${PLATE},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, T.brand.y + 90);
      const d = T.dim, gr2 = ctx.createLinearGradient(0, d.y - 70, 0, d.y); gr2.addColorStop(0, `rgba(${PLATE},0)`); gr2.addColorStop(1, `rgba(${PLATE},0.9)`); ctx.fillStyle = gr2; ctx.fillRect(0, d.y - 70, W, 70); ctx.fillStyle = `rgba(${PLATE},0.9)`; ctx.fillRect(0, d.y, W, d.h + 2);
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, `rgba(${PLATE},0.75)`); gr.addColorStop(1, `rgba(${PLATE},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, T.card.x, 200);
      panel(T.card, 0.86);
    }
    const tt = T.titleText;
    ctx.save(); const tg = ctx.createLinearGradient(0, tt.y - tt.size * 0.8, 0, tt.y); tg.addColorStop(0, '#fff3b0'); tg.addColorStop(0.5, '#ffbf2e'); tg.addColorStop(1, '#e0700a');
    const tMax = (L.land ? (T.card.x - 16 - L.U.x0) : W) - 40; let tsz = tt.size; ctx.font = font(400, tsz, DISPLAY); { const mw = ctx.measureText('LAGORI').width; if (mw > tMax) { tsz = Math.max(24, tsz * tMax / mw); ctx.font = font(400, tsz, DISPLAY); } }
    ctx.textAlign = 'center';
    // embossed lettering: a stack of dark-brown extrusion layers, the gold face, a light edge on top
    for (let i = 9; i >= 1; i--) { ctx.fillStyle = i > 6 ? 'rgba(8,2,0,0.55)' : `rgb(${120 - i * 8},${50 - i * 3},${14})`; ctx.fillText('LAGORI', tt.x + i * 0.5, tt.y + i * 0.9); }
    ctx.fillStyle = tg; ctx.fillText('LAGORI', tt.x, tt.y);
    ctx.lineWidth = Math.max(1.5, tsz * 0.018); ctx.strokeStyle = 'rgba(255,250,215,0.85)'; ctx.strokeText('LAGORI', tt.x, tt.y - 0.5);
    ctx.restore();
    fitText('Seven Stones: smash it, rebuild it, dodge the ball', T.tag.x, T.tag.y, T.tag.size, L.land ? (T.card.x - 16 - L.U.x0) - 40 : W - 40, 'rgba(255,236,190,0.95)', 'center', 600);
    { const bh = T.brand.w * 0.2725; ctx.save(); ctx.fillStyle = 'rgba(20,8,2,0.66)'; ctx.beginPath(); ctx.roundRect(T.brand.x - T.brand.w / 2 - 10, T.brand.y - bh / 2 - 6, T.brand.w + 20, bh + 12, (bh + 12) / 2); ctx.fill(); ctx.restore(); }
    drawLockup(ctx, T.brand.x, T.brand.y + (state.lkDown ? 1 : 0), T.brand.w * (state.lkDown ? 0.96 : 1), state.lkDown ? 0.7 : 1);
    const B = T.rows;
    button(B.play, 'Play the computer', { primary: true, size: 34, sub: state.stats.played ? `Matches won ${state.stats.wins} of ${state.stats.played}` : 'Four innings' });
    { ctx.font = font(700, Math.max(26, FL) * 0.85, BODY); const full = 'Level: ' + LEVELS[state.level].name; button(B.level, ctx.measureText(full).width > B.level.w - 40 ? LEVELS[state.level].name : full, { size: 26 }); }
    button(B.auto, 'Auto Play', { size: 26 });
    button(B.howto, 'How to play', { size: 22 }); button(B.about, 'About', { size: 22 }); button(B.rules, 'Game Rules', { size: 22 });
    button(B.settings, 'Settings', { size: 26 });
    if (state.dev) text('dev', T.dev.x, T.dev.y, 20, '#9f9', 'right');
    return;
  }

  // ---------------------------------------------------------------- PAGES
  const backdrop = () => { drawBackdrop(ctx, W, H, 0.1); ctx.fillStyle = `rgba(${PLATE},0.62)`; ctx.fillRect(0, 0, W, H); };
  if (sc === 'howto' || sc === 'about' || sc === 'rules') {
    backdrop();
    const RD = L.reader;
    panel(RD.panel, 0.9);
    const heading = sc === 'about' ? 'About' : sc === 'rules' ? 'Game Rules' : 'How to play';
    shadowText(heading, RD.title.x, RD.title.y + 14, 38, GOLD, 'left', 400, RD.dec.x - RD.title.x - 12);
    button(RD.dec, 'A−', { dim: state.textScaleIdx === 0, size: 30, noscale: true });
    button(RD.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 30, noscale: true });
    const vp = RD.viewport, tw = RD.textW, x0 = vp.x + 4, cxv = vp.x + vp.w / 2;
    const credits = sc === 'about' && gl && gl.licenses ? gl.licenses : '', fkey = `${sc}|${ts}|${Math.round(tw)}|${credits.length}`;
    let F = flowCache.get(fkey);
    if (!F) {
      const items = []; let y = 4;
      for (const sec of flowOf(sc, credits)) {
        const tsz = 36 * Math.min(ts, 1.2), tlh = tsz * 1.15, tl = lines(sec.name, tsz, tw, 700);
        items.push({ k: 'rtitle', y, lines: tl, size: tsz, lh: tlh }); y += tl.length * tlh + 18;
        if (sec.pieces === 'stones') { items.push({ k: 'stones', y: y + 40 }); y += 100; }
        if (sec.illus) { items.push({ k: 'illus', y, which: sec.illus }); y += 250 * Math.min(1, tw / 568) + 14; }
        for (const item of sec.items) {
          if (item.h) { const sz = 31 * ts, lh = sz * 1.18, ls = lines(item.h, sz, tw, 700); items.push({ k: 'text', y, lines: ls, size: sz, lh, color: GOLD, weight: 700 }); y += ls.length * lh + 10; }
          else { const sz = 28 * ts, ls = lines(item.t, sz, tw, 500); items.push({ k: 'text', y, lines: ls, size: sz, lh: 39 * ts, color: CREAM }); y += ls.length * 39 * ts + 16; }
        }
        y += 30;
      }
      F = { items, total: y }; flowCache.set(fkey, F); if (flowCache.size > 30) flowCache.delete(flowCache.keys().next().value);
    }
    const items = F.items, y = F.total, max = Math.max(0, y + 6 - vp.h); reader.max = max;
    const off = Math.min(Math.max(0, state.scroll || 0), max);
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 4, vp.y, vp.w + 8, vp.h); ctx.clip(); ctx.translate(0, vp.y - off);
    for (const it of items) {
      if (it.y - off > vp.h + 400 || it.y - off < -1400) continue;
      if (it.k === 'text') it.lines.forEach((ln, i) => text(ln, x0, it.y + it.size * 0.95 + i * it.lh, it.size, it.color, 'left', it.weight ?? 500));
      else if (it.k === 'rtitle') it.lines.forEach((ln, i) => text(ln, x0, it.y + it.size * 0.95 + i * it.lh, it.size, GOLD, 'left', 700));
      else if (it.k === 'stones') { for (let i = 0; i < STONES; i++) drawStone(ctx, i, cxv - 190 + i * 63, it.y, 0, 0, 1, 1.0); }
      else if (it.k === 'illus') illus(it.which, cxv, it.y, Math.min(1, tw / 568));
    }
    ctx.restore();
    if (max > 0) { const sb = RD.scrollbar, th = Math.max(36, sb.h * vp.h / (vp.h + max)), ty = sb.y + (sb.h - th) * (off / max); ctx.fillStyle = 'rgba(255,240,205,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,212,94,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 5); ctx.fill(); }
    text(max > 0 ? (off >= max - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', RD.counter.x, RD.counter.y, 22, 'rgba(255,246,226,0.7)');
    button(RD.nav.prev, 'Top', { dim: off < 4, size: 24 });
    button(RD.nav.next, 'More', { dim: off >= max - 2, size: 24 });
    button(RD.nav.back, 'Done', { primary: true, size: 26 });
    return;
  }
  if (sc === 'settings') {
    backdrop(); const S0 = L.settings, rows = S0.rows;
    shadowText('Settings', S0.title.x, S0.title.y, S0.title.size * 0.8, GOLD);
    const items = [
      ['Sound', state.sound ? 'On' : 'Off', state.sound],
      ['Reduced motion', state.calm ? 'On' : 'Off', state.calm],
      ['Text size', Math.round((TEXT_SCALES[state.textScaleIdx] ?? 1) * 100) + '%', state.textScaleIdx > 0],
      ['Left-handed layout', state.left ? 'On' : 'Off', state.left],
      ['Aim guide', state.guide ? 'On' : 'Off', state.guide],
    ];
    if (!state.demoMode) {
      const owned = state.owned === true;
      items.push([owned ? 'Full game unlocked' : 'Restore purchase', owned ? '' : (state.restoreMsg || ''), false]);
    }
    items.forEach((it, i) => {
      const r = rows[i]; button(r, '', { size: 28 }); const vw = it[1] ? (i === 5 ? Math.min(250, r.w * 0.42) : 130) : 0;
      fitText(it[0], r.x + 28, r.y + r.h / 2 + 10, 28, r.w - 56 - vw, CREAM, 'left', 700);
      if (it[1]) fitText(it[1], r.x + r.w - 28, r.y + r.h / 2 + 10, 28, vw, it[2] ? '#9cf29a' : GOLD, 'right', 700);
    });
    if (S0.noteFits) text('Tap a row to change it.', S0.note.x, S0.note.y, 24, 'rgba(255,246,226,0.7)');
    button(S0.done, 'Done', { primary: true, size: 28 }); return;
  }
  if (sc === 'demo-limit') {
    backdrop(); const D = L.demo; shadowText('Enjoying the preview?', D.title.x, D.title.y, D.title.size * 0.7, GOLD, 'center', 400, L.U.w - 40);
    wrap('The free web preview ends here. Get the free app on iPhone and Android for unlimited matches at all three levels.', D.body.x, D.body.y, 30, D.body.w, CREAM, 42); button(D.back, 'Back', { primary: true, size: 28 }); return;
  }

  // ---------------------------------------------------------------- PLAY / AUTO
  const P = L.play(sc), inn = state.inn, m = state.match;
  if (GL) ctx.clearRect(0, 0, W, H); else drawBackdrop(ctx, W, H);
  const mine = sc === 'play' && inn.strikerIsHuman, humanFields = sc === 'play' && !inn.strikerIsHuman;
  const strikeTeam = inn.strikerIsHuman ? 'H' : 'C', fieldTeam = inn.strikerIsHuman ? 'C' : 'H';
  let aim = null;
  if (state.aim && inn.phase === 'throw' && inn.ball.mode === 'held' && state.stage === 'live') aim = { kind: 'tower', x: state.aim.x, y: state.aim.y };
  else if (state.aim && !inn.strikerIsHuman && inn.phase === 'rebuild' && state.stage === 'live' && inn.ball.mode === 'held') aim = { kind: 'field', x: state.aim.x, y: state.aim.y };
  { const o = { fieldTeam, strikeTeam, mine, aim, queue: state.autoQueue ?? (mine || sc === 'auto' ? (activeRunner(inn)?.queue ?? null) : null), hintStone: state.hintStone, tapNum: mine && state.guide, shake: state.shake };
    if (GL) courtScene(inn, o); else inCourt(P.cx, P.cy, P.f, state.shake, () => courtScene(inn, o)); }
  // dim the gutters outside the court a little so the court reads as the table
  // ---- HUD cards
  const nameH = sc === 'auto' ? 'Saffron team' : 'You', nameC = sc === 'auto' ? 'Teal team' : 'Computer';
  const card = (r, key, name, sub, active, pips) => {
    const rad = Math.min(24, r.h * 0.2), pad = Math.min(16, r.w * 0.06);
    ctx.save(); if (active) { ctx.shadowColor = 'rgba(255,200,70,0.8)'; ctx.shadowBlur = state.calm ? 14 : 16 + Math.sin(t * 4) * 6; }
    ctx.fillStyle = 'rgba(18,6,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 5, r.w, r.h, rad); ctx.fill(); ctx.restore();
    woodFill(r, rad, 0.95, active); brassEdge(r, rad, active ? 4 : 2.5, active ? 1 : 0.75);
    const row1 = r.y + r.h * 0.3, row2 = r.y + r.h * 0.58, row3 = r.y + r.h * 0.84, kcol = key === 'H' ? '#ffb02e' : '#2fd0c2';
    ctx.fillStyle = kcol; ctx.beginPath(); ctx.arc(r.x + pad + 14, row1 - 4, 14, 0, TAU); ctx.fill();
    const nx = r.x + pad + 38, sw = Math.min(88, r.w * 0.26);
    fitText(name, nx, row1 + 8, 28 * Math.min(bs, 1.1), r.w - (nx - r.x) - sw - pad - 6, CREAM, 'left', 700);
    text(String(m.score[key]), r.x + r.w - pad, row1 + 14, 56 * Math.min(bs, 1.05), GOLD, 'right', 800, NUM);
    fitText(sub, r.x + pad, row2 + 8, 21 * Math.min(bs, 1.1), r.w - 2 * pad, 'rgba(255,246,226,0.8)', 'left', 600);
    pips(r.x + pad + 8, row3, r.w - 2 * pad - 16);
  };
  const strikerKey = strikeTeam, fieldKey = fieldTeam;
  const rolePip = (key) => (x, y) => { void key; void x; void y; };
  void rolePip;
  const runnerPips = (x, y, wd) => { const sp = Math.min(46, (wd - 80) / RUNNERS); inn.runners.forEach((r, k) => { const cx = x + k * sp + 14; ctx.fillStyle = r.state === 'out' ? 'rgba(255,255,255,0.18)' : r.state === 'run' ? '#fff3b8' : 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(cx, y, 10, 0, TAU); ctx.fill(); if (r.state === 'out') { ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 7, y - 7); ctx.lineTo(cx + 7, y + 7); ctx.moveTo(cx + 7, y - 7); ctx.lineTo(cx - 7, y + 7); ctx.stroke(); } }); text('runners', x + RUNNERS * sp + 8, y + 6, 18, 'rgba(255,246,226,0.62)', 'left', 600); };
  const throwPips = (x, y, wd) => { const sp = Math.min(46, (wd - 72) / THROWS); for (let k = 0; k < THROWS; k++) { const used = k >= inn.throwsLeft; ctx.fillStyle = used ? 'rgba(255,255,255,0.16)' : '#ffe14a'; ctx.beginPath(); ctx.arc(x + k * sp + 14, y, 10, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(90,50,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); } text('throws', x + THROWS * sp + 8, y + 6, 18, 'rgba(255,246,226,0.62)', 'left', 600); };
  const noPips = () => {};
  const inningNo = Math.max(1, Math.min(INNINGS, state.stage === 'result' || state.stage === 'over' ? m.n : m.n + 1));
  const subFor = (key) => (key === strikerKey ? (inn.phase === 'throw' ? 'Striking: smash the tower' : 'Striking: rebuild') : 'Fielding' + (key === 'C' && sc === 'play' ? ' · ' + LEVELS[state.level].name : ''));
  const live = state.stage === 'live' && !inn.result;
  card(P.cards.H, 'H', nameH, subFor('H'), live && strikerKey === 'H', strikerKey === 'H' ? (inn.phase === 'throw' ? throwPips : runnerPips) : noPips);
  card(P.cards.C, 'C', nameC, subFor('C'), live && strikerKey === 'C', strikerKey === 'C' ? (inn.phase === 'throw' ? throwPips : runnerPips) : noPips);
  // ---- progress strip: inning, seven stone pips, time
  {
    const r = P.strip; panel(r, 0.78, 20);
    const pad = 14, ip = Math.min(r.h - 16, 30), sp = Math.min(44, (r.w - 2 * pad - 150) / STONES);
    text(`Inning ${inningNo}/${INNINGS}`, r.x + pad, r.y + r.h / 2 + 8, 21 * Math.min(bs, 1.1), CREAM, 'left', 700);
    const x0 = r.x + r.w - pad - STONES * sp;
    for (let i = 0; i < STONES; i++) {
      const placed = inn.stones[i].state === 'placed', cx = x0 + i * sp + sp / 2, [hi, , lo] = STONE_COLORS[i];
      ctx.save(); ctx.globalAlpha = placed ? 1 : inn.stones[i].state === 'tower' ? 0.9 : 0.35;
      const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, hi); gr.addColorStop(1, lo); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(cx, r.y + r.h / 2, Math.max(7, sp * 0.4), ip * 0.4, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (inn.phase === 'rebuild') {
      const left = Math.max(0, 1 - inn.clock / REBUILD_TIME), bx = r.x + pad + 118 * Math.min(bs, 1.1) + 8, bw = x0 - bx - 12;
      if (bw > 30) { ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, r.y + r.h / 2 - 5, bw, 10, 5); ctx.fill(); ctx.fillStyle = left < 0.25 ? '#ff6a50' : '#ffd45e'; ctx.beginPath(); ctx.roundRect(bx, r.y + r.h / 2 - 5, Math.max(8, bw * left), 10, 5); ctx.fill(); }
    }
  }
  // ---- toast
  const mg = state.msg;
  if (mg) { const a = Math.min(1, (mg.hold - mg.t) * 2, mg.t * 6 + 0.2); ctx.globalAlpha = Math.max(0, a); panel(P.msg, 0.82, 18); wrapIn(mg.text, P.msg, 24 * bs, CREAM, { vc: true }); ctx.globalAlpha = 1; }
  // ---- buttons
  if (sc === 'play') {
    const pb = P.btn, r0 = activeRunner(inn);
    button(pb.menu, 'Menu', { size: 26 });
    button(pb.hint, state.hintsLeft > 0 ? `Hint ${state.hintsLeft}` : 'Hint', { size: 26, dim: state.hintsLeft <= 0 || state.stage !== 'live' });
    if (inn.strikerIsHuman && inn.phase === 'rebuild') {
      const ready = !!r0 && r0.state === 'run' && r0.cool <= 0 && r0.dodge <= 0, danger = inn.wind && inn.wind.locked || (inn.ball.mode === 'flight' && inn.ball.hit);
      button(pb.act, ready ? 'DODGE' : r0 && r0.cool > 0 ? `${r0.cool.toFixed(1)}s` : 'DODGE', { hot: ready && !!danger, primary: ready && !danger, size: 30, dim: !ready });
    } else button(pb.act, 'Throw', { primary: !!state.aim && state.stage === 'live', size: 28, dim: !state.aim || state.stage !== 'live' });
  } else if (sc === 'auto' && state.auto) {
    const pb = P.btn, A = state.auto, AU = P.auto, ended = state.stage === 'result' || state.stage === 'over';
    button(pb.menu, 'Exit', { size: 26 });
    if (!ended) button(pb.hint, A.paused ? 'Resume' : 'Pause', { size: 26 });
    if (!ended) button(pb.act, 'Skip', { size: 26, dim: A.sub !== 'think' && A.sub !== 'reveal' });
    panel(AU.bar, 0.78, 22);
    const label = A.paused ? 'Paused' : A.sub === 'think' ? A.what + ' · thinking' : A.sub === 'reveal' ? A.what + ' · here it is' : ended ? 'Inning complete' : 'Watch the play';
    const lw = L.land ? AU.bar.w - 24 : AU.think.x - AU.label.x - 130;
    fitText(label, AU.label.x, AU.label.y + 9, 24, L.land ? lw : Math.max(120, lw), A.paused ? '#ffd08a' : GOLD, AU.label.align, 700);
    fitText(`Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, AU.think.x, AU.think.y + 8, 22, L.land ? AU.inc.x - AU.dec.x - AU.dec.w - 16 : 150, CREAM, AU.think.align, 600);
    button(AU.dec, '-', { size: 30, noscale: true, dim: state.autoThinkIdx === 0 }); button(AU.inc, '+', { size: 30, noscale: true, dim: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
  }
  // ---- intro banner
  if (state.stage === 'intro') {
    ctx.fillStyle = `rgba(${PLATE},0.62)`; ctx.fillRect(0, 0, W, H);
    const cy = H / 2 - 40, bw = Math.min(W - 40, 640);
    panel(R4(W / 2 - bw / 2, cy - 110, bw, 250), 0.92);
    text(`Inning ${inningNo} of ${INNINGS}`, W / 2, cy - 50, 28, 'rgba(255,246,226,0.8)', 'center', 700);
    shadowText(inn.strikerIsHuman ? (sc === 'auto' ? 'Saffron strikes' : 'You strike!') : (sc === 'auto' ? 'Teal strikes' : 'You field!'), W / 2, cy + 26, 52, GOLD, 'center', 400, bw - 40);
    wrap(inn.strikerIsHuman ? (sc === 'auto' ? 'Smash the tower, then rebuild it.' : 'Drag, release to throw at the tower.') : (sc === 'auto' ? 'Fielders throw at the runner.' : 'Rebuilders are coming. Aim at the runner.'), W / 2, cy + 82, 25, bw - 60, CREAM, 32);
  }
  // ---- overlays
  const dim = (a) => { ctx.fillStyle = `rgba(${PLATE},${a})`; ctx.fillRect(0, 0, W, H); };
  if (state.menu) {
    const M = L.menu; dim(0.76); shadowText('Paused', M.title.x, M.title.y, M.title.size * 0.8, GOLD);
    button(M.resume, 'Resume', { primary: true, size: 30 }); button(M.restart, 'New match', { size: 30 }); button(M.settings, 'Settings', { size: 30 }); button(M.quit, 'Leave', { size: 30 });
  }
  if (state.stage === 'result' && inn.result) {
    dim(0.62); const D = L.dialog('inning'), r = inn.result, last = m.over || state.stage === 'over';
    const byMe = sc === 'play' ? inn.strikerIsHuman : true;
    const rebuilt = r.kind === 'lagori';
    const title = rebuilt ? 'Lagori!' : r.kind === 'standing' ? 'Tower stands' : r.kind === 'allout' ? 'All out' : 'Time up';
    panel(D.panel, 0.94);
    shadowText(title, D.title.x, D.title.y, 56, rebuilt ? GOLD : '#ff9f80', 'center', 400, D.panel.w * (D.land ? 0.5 : 0.86));
    const who = (k) => (sc === 'auto' ? (k === 'H' ? 'Saffron' : 'Teal') : (k === 'H' ? 'You' : 'The computer'));
    const sk = strikeTeam, fk = fieldTeam;
    const why = rebuilt ? `${who(sk)} rebuilt all seven stones${r.clean ? ' with no runner hit: 2 points.' : ': 1 point.'}` : r.kind === 'standing' ? `${who(sk)} missed all ${THROWS} throws. ${who(fk)} score 1 point.` : r.kind === 'allout' ? `All ${RUNNERS} runners were hit. ${who(fk)} score 1 point.` : `${who(sk)} ran out of time with ${r.placed} of ${STONES} stones stacked. ${who(fk)} score 1 point.`;
    wrapIn(why, R4(D.body.x - D.body.w / 2, D.body.y, D.body.w, 90), 27, CREAM, { vc: true });
    fitText(`${nameH} ${m.score.H}  –  ${m.score.C} ${nameC}`, D.body.x, D.body.y + 128, 36, D.body.w, GOLD, 'center', 800, NUM);
    void byMe;
    button(D.btns[0], last ? 'See result' : (sc === 'auto' ? 'Close' : 'Next inning'), { primary: true, size: 30 }); button(D.btns[1], sc === 'auto' ? 'Exit' : 'Menu', { size: 26 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }
  if (state.stage === 'over' && m.over) {
    dim(0.7); const D = L.dialog('over'), o = m.over, win = o.winner === 'H';
    if (win && !state.calm && sc === 'play') for (let i = 0; i < 28; i++) { const a = i * 2.4 + t * 0.6, y = (t * 90 + i * 53) % H, x = W / 2 + Math.cos(a + i) * (W * 0.46); drawStone(ctx, i % 7, x, y, 0, 0, 0.9, 0.6); }
    panel(D.panel, 0.95);
    const title = o.winner === 'draw' ? 'A draw' : sc === 'auto' ? (win ? 'Saffron wins' : 'Teal wins') : win ? 'You win!' : 'The computer wins';
    shadowText(title, D.title.x, D.title.y, 56, GOLD, 'center', 400, D.panel.w * (D.land ? 0.5 : 0.86));
    fitText(`${nameH} ${m.score.H}  –  ${m.score.C} ${nameC}`, D.body.x, D.body.y + 36, 42, D.body.w, CREAM, 'center', 800, NUM);
    const kinds = { lagori: 'tower rebuilt', standing: 'tower stood', allout: 'all out', time: 'time up' };
    const logLines = m.log.map((e, i) => `Inning ${i + 1}: ${e.striker === 'H' ? (sc === 'auto' ? 'Saffron' : 'You') : (sc === 'auto' ? 'Teal' : 'Computer')} struck, ${kinds[e.kind]}`).join('\n');
    wrapIn(logLines, R4(D.body.x - D.body.w / 2, D.body.y + 58, D.body.w, D.body.h - 40), 22, 'rgba(255,246,226,0.8)', { vc: true });
    button(D.btns[0], sc === 'auto' ? 'Watch again' : 'Play again', { primary: true, size: 30 }); button(D.btns[1], sc === 'auto' ? 'Exit' : 'Menu', { size: 26 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }

  // ---- small illustrations for the How to play page
  function illus(which, cx, y, k) {
    ctx.save(); ctx.translate(cx - 284 * k, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(232,166,120,0.28)'; ctx.beginPath(); ctx.roundRect(0, 0, 568, 240, 18); ctx.fill();
    const chalk = 'rgba(255,252,240,0.7)';
    if (which === 'throw') {
      drawStone(ctx, 0, 440, 130, 0, 0, 1, 0.9); for (let i = 1; i < 4; i++) drawStone(ctx, i, 440, 130 - i * 11, 0, 0, 1, 0.9);
      drawKid(ctx, 110, 200, { team: 'H', face: 1, phase: 0, moving: false, pose: 'ready', scale: 1.1 });
      const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push([130 + 300 * u, 150 - 40 * u - Math.sin(u * Math.PI) * 90]); }
      dotted(pts, '#fff6e2', 4, 2, 10);
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3.5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.ellipse(430, 112, 36, 22, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      text('1  drag', 150, 36, 24, GOLD, 'center', 700); text('2  release', 420, 36, 24, GOLD, 'center', 700);
    } else if (which === 'stones') {
      const sp = [[130, 90, 0], [250, 140, 1], [180, 190, 2], [330, 70, 3], [400, 150, 4], [470, 200, 5], [310, 200, 6]]; sp.forEach(([x, yy, i]) => drawStone(ctx, i, x, yy, 0, 0, 1, 0.85));
      ctx.strokeStyle = chalk; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(480, 80, 54, 34, 0, 0, TAU); ctx.stroke();
      drawStone(ctx, 0, 480, 82, 0, 0, 1, 0.85); drawKid(ctx, 250, 220, { team: 'H', face: 1, phase: 1, moving: true, scale: 0.9 });
      dotted([[250, 170], [180, 150]], '#ffd45e', 4, 2, 8); text('tap a stone', 130, 30, 24, GOLD, 'center', 700);
    } else if (which === 'dodge') {
      drawKid(ctx, 330, 170, { team: 'H', face: 1, phase: 0, moving: true, scale: 1.1, dodge: 1 }); drawKid(ctx, 120, 90, { team: 'C', face: 1, phase: 0, moving: false, pose: 'ready', scale: 1 });
      ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(330, 140, 40, 0, TAU); ctx.stroke(); dotted([[150, 80], [330, 140]], 'rgba(255,60,40,0.9)', 3, 3, 9);
      ctx.strokeStyle = '#fff6e2'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(375, 170); ctx.lineTo(470, 170); ctx.lineTo(452, 154); ctx.moveTo(470, 170); ctx.lineTo(452, 186); ctx.stroke();
      text('DODGE', 470, 220, 26, GOLD, 'center', 700);
    } else if (which === 'field') {
      drawKid(ctx, 120, 190, { team: 'H', face: 1, phase: 0, moving: false, pose: 'ready', scale: 1.1 }); drawKid(ctx, 400, 110, { team: 'C', face: -1, phase: 1, moving: true, scale: 1 });
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(360, 102, 26, 0, TAU); ctx.stroke(); dotted([[140, 160], [360, 102]], '#fff6e2', 4, 2, 10);
      dotted([[400, 118], [350, 96]], 'rgba(255,255,255,0.0)', 1, 1, 1); text('aim ahead of the runner', 300, 36, 24, GOLD, 'center', 700);
    }
    ctx.restore();
  }
  void BALL_R; void RUNNER_R; void LINE_Y; void DODGE_COOL; void CW;
}
