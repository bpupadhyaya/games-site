// In-play HUD: scoreboard, banners, rider ring, reach ring, aim arrow, stamina, stick, SWING and HOOK, Think/Pause, Watch & Learn and drill overlays.
// Everything follows the text size through PLAY_M; layout.playLayout gives one set of rectangles for drawing and hit-testing.
import { W, H, PLAY_M, playLayout, inRect } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { projectV, scaleAt } from './camera.js';
import { HW, HL, GOAL_HW, FIG, REACH, LEVELS, WIND_MAX, HOOK_TICKS } from './consts.js';
import { ROLE_INFO } from './content.js';

const TAU = Math.PI * 2;
export const STICK_R = 95;
const RED = '#e0443a', BLUE = '#2a79d4';

const P = (G, x, y, z) => projectV(G.viewW || 720, G.viewH || 1280, x, y, z);

function ring(ctx, G, x, z, rm, col, lw = 4, fill = null) {
  const c = P(G, x, 0.02, z), a = P(G, x + rm, 0.02, z), b = P(G, x, 0.02, z + rm);
  if (!c || !a || !b) return null;
  const rx = Math.abs(a.x - c.x), ry = Math.abs(b.y - c.y);
  ctx.save(); ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.stroke(); ctx.restore();
  return c;
}
function tag(ctx, x, y, text, col = '#ffd54a', size = 22) {
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + 20;
  roundPath(ctx, x - w / 2, y - size, w, size * 1.45, 11); ctx.fillStyle = 'rgba(8,24,18,0.84)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - size * 0.25 + 2); ctx.restore();
}
function wrapped(ctx, text, x, y, maxW, size, color = '#fff6e4', lh = 1.25, align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, maxW); lines.forEach((l, i) => ctx.fillText(l, x, y + size * (0.9 + i * lh)));
  return lines.length * size * lh;
}
export const fmtClock = (c) => { const t = Math.max(0, Math.ceil(c)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

function scoreboard(ctx, G, s, L) {
  const m = L.m, th = L.topH;
  const g = ctx.createLinearGradient(0, 0, 0, th + 24); g.addColorStop(0, 'rgba(6,22,16,0.88)'); g.addColorStop(1, 'rgba(6,22,16,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, th + 24);
  const colw = 250;
  for (const i of [0, 1]) {
    const left = i === 0, x0 = left ? 16 : W - 16 - colw;
    ctx.fillStyle = i === 0 ? RED : BLUE; roundPath(ctx, x0, 12, 10, th - 34, 5); ctx.fill();
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    const ax = left ? x0 + 22 : x0 + colw - 22;
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.round(22 * m)}px ${FONT}`;
    ctx.fillText(i === 0 ? 'RED' : 'BLUE', ax, 12 + 22 * m);
    ctx.font = `800 ${Math.round(54 * m)}px ${FONT}`; ctx.fillText(String(s.score[i]), ax, 12 + 22 * m + 50 * m);
  }
  const mc = Math.min(m, 1.3);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4';
  ctx.font = `800 ${Math.round(40 * mc)}px ${FONT}`; ctx.fillText(fmtClock(s.clock), W / 2, 50 + 36 * mc);
  ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${Math.round(20 * mc)}px ${FONT}`;
  ctx.fillText(G.mode === 'drill' ? 'Practice' : `Period ${s.period} of ${s.periods}`, W / 2, 50 + 36 * mc + 24 * mc);
}

function banner(ctx, G, s, L) {
  const m = L.m;
  let text = '', sub = '', col = '#ffd54a';
  if (s.phase === 'throw') { const n = Math.ceil(s.countdown); text = n > 0 ? String(n) : 'Go'; sub = 'Throw-in'; }
  else if (s.msg) { text = s.msg.text; sub = s.msg.sub; col = s.msg.team === 0 ? RED : s.msg.team === 1 ? BLUE : '#ffd54a'; }
  else if (s.phase === 'reset') { text = 'Get ready'; sub = 'Riders return to their places'; }
  else if (s.restart && s.restart.team === 0 && !s.restart.hit && s.phase === 'live') { text = 'Free hit'; sub = 'Red may strike first'; }
  else if (s.restart && s.restart.team === 1 && !s.restart.hit && s.phase === 'live') { text = 'Free hit'; sub = 'Blue strike first: stay clear'; }
  if (!text) return;
  const big = Math.round(46 * Math.min(m, 1.5)), small = Math.round(24 * Math.min(m, 1.6));
  ctx.font = `800 ${big}px ${FONT}`; const lines = wrapLines(ctx, text, W - 190);
  ctx.font = `600 ${small}px ${FONT}`; const sl = sub ? wrapLines(ctx, sub, W - 190) : [];
  const ph = lines.length * big * 1.15 + sl.length * small * 1.25 + 28, py = Math.round(L.topH + L.pause.h + 40);
  roundPath(ctx, 30, py, W - 160, ph, 20); ctx.fillStyle = 'rgba(8,24,18,0.78)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${big}px ${FONT}`; lines.forEach((l, i) => ctx.fillText(l, (W - 130) / 2 + 15, py + 12 + big * (0.95 + i * 1.15)));
  ctx.font = `600 ${small}px ${FONT}`; ctx.fillStyle = '#ffe9a0'; sl.forEach((l, i) => ctx.fillText(l, (W - 130) / 2 + 15, py + 18 + lines.length * big * 1.15 + small * (0.95 + i * 1.25)));
}

// buttons ------------------------------------------------------------------------------------------------------------------------------
function circleButton(ctx, c, label, o = {}) {
  const { held = false, primary = false, disabled = false, size = 30, sub = '' } = o;
  ctx.save(); ctx.globalAlpha = held ? 0.95 : 0.8;
  ctx.beginPath(); ctx.arc(c.x, c.y + (held ? 3 : 6), c.r, 0, TAU); ctx.fillStyle = 'rgba(8,10,40,0.34)'; ctx.fill();
  ctx.beginPath(); ctx.arc(c.x, c.y + (held ? 3 : 0), c.r, 0, TAU);
  ctx.fillStyle = disabled ? 'rgba(200,205,225,0.35)' : primary ? (held ? '#a8301f' : '#e2503c') : (held ? '#146f65' : '#1f9d8f'); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,246,228,0.55)'; ctx.stroke();
  ctx.fillStyle = '#fffaf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText(label, c.x, c.y + (held ? 3 : 0) - (sub ? size * 0.2 : 0));
  if (sub) { ctx.font = `600 ${Math.round(size * 0.5)}px ${FONT}`; ctx.fillText(sub, c.x, c.y + size * 0.55); }
  ctx.restore();
}

function stick(ctx, G, L) {
  const c = G.c;
  const st = c.stick;
  const base = st ? { x: st.x0, y: st.y0 } : L.stickHint;
  ctx.save();
  ctx.globalAlpha = st ? 0.95 : 0.4;
  ctx.beginPath(); ctx.arc(base.x, base.y, STICK_R, 0, TAU); ctx.fillStyle = 'rgba(8,24,18,0.35)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.6)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(base.x, base.y, STICK_R * 0.93, 0, TAU); ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.strokeStyle = c.sprintOn ? '#ffd54a' : 'rgba(255,246,228,0.35)'; ctx.stroke(); ctx.setLineDash([]);
  const kx = st ? base.x + st.dx * STICK_R : base.x, ky = st ? base.y - st.dz * STICK_R : base.y;
  ctx.beginPath(); ctx.arc(kx, ky, 38, 0, TAU); ctx.fillStyle = c.sprintOn ? '#ffd54a' : 'rgba(255,246,228,0.88)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(8,24,18,0.5)'; ctx.stroke();
  ctx.restore();
  if (!st) { ctx.save(); ctx.globalAlpha = 0.65; ctx.fillStyle = '#fff6e4'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('drag to ride', base.x, base.y + STICK_R + 30); ctx.restore(); }
}

function staminaBar(ctx, G, L, rider) {
  const w = 200, x = 14, y = L.topH + L.think.h + 24;
  ctx.save();
  roundPath(ctx, x, y, w, 18, 9); ctx.fillStyle = 'rgba(8,24,18,0.7)'; ctx.fill();
  roundPath(ctx, x + 2, y + 2, Math.max(4, (w - 4) * rider.stamina), 14, 7); ctx.fillStyle = rider.stamina > 0.2 ? '#ffd54a' : '#ff8a6a'; ctx.fill();
  ctx.font = `700 ${Math.round(16 * Math.min(L.m, 1.5))}px ${FONT}`; ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'left'; ctx.fillText('Stamina (sprint)', x + 2, y + 18 + 18 * Math.min(L.m, 1.5));
  ctx.restore();
}

function swingArc(ctx, G, L, rider) {
  const sw = rider.sw, c = L.sw;
  if (sw.ph !== 'wind') return;
  ctx.save(); ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.strokeStyle = sw.charge >= 1 ? '#7fe8d6' : '#ffd54a';
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 18, -Math.PI / 2, -Math.PI / 2 + TAU * sw.charge); ctx.stroke(); ctx.restore();
}

// field overlays ---------------------------------------------------------------------------------------------------------------------------
function fieldOverlays(ctx, G, S, s, L, rider) {
  // the ridden horse: a ring and a tag
  const c = ring(ctx, G, rider.x, rider.z, 1.35 * FIG, '#ffd54a', 5, 'rgba(255,213,74,0.18)');
  if (c) { const tp = P(G, rider.x, 2.9 * FIG, rider.z); if (tp) tag(ctx, tp.x, tp.y - 6, `YOU  ${ROLE_INFO[rider.role].num}`, '#ffd54a', Math.round(20 * Math.min(L.m, 1.4))); }
  // reach ring around the ball when a stroke could reach it right now
  const b = s.ball;
  let best = 0, kind = '';
  for (const k of ['R', 'B', 'L']) {
    const loc = S.local(rider, b.x, b.z), lat = (k === 'L' ? -1 : 1) * loc.r;
    const q = S.envQ(k, loc.f, lat, b.y);
    if (q > best) { best = q; kind = k; }
  }
  const col = best > 0 ? '#7fe8d6' : 'rgba(255,246,228,0.55)';
  const bp = P(G, b.x, 0.02, b.z);
  if (bp) { const rr = Math.max(14, scaleAt(G.viewW || 720, G.viewH || 1280, b.x, b.z) * 0.62); ctx.save(); ctx.beginPath(); ctx.ellipse(bp.x, bp.y, rr * 1.15, rr * 0.7, 0, 0, TAU); ctx.lineWidth = best > 0 ? 5 : 3; ctx.strokeStyle = col; ctx.stroke(); ctx.restore(); }
  // aim arrow while winding or when steering during a stroke
  if (rider.sw.ph === 'wind' || rider.sw.ph === 'strike') {
    const dir = rider.sw.ph === 'wind' ? G.aimDir : rider.sw.dir;
    if (dir !== undefined) { const a = P(G, rider.x, 0.05, rider.z), e = P(G, rider.x + Math.sin(dir) * 6, 0.05, rider.z + Math.cos(dir) * 6); if (a && e) { ctx.save(); ctx.setLineDash([10, 8]); ctx.lineWidth = 5; ctx.strokeStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore(); } }
  }
}

function markerAt(ctx, G, x, z, text, col = '#7fe8d6', r = 1.2) {
  const c = ring(ctx, G, x, z, r, col, 5, 'rgba(127,232,214,0.2)');
  if (c && text) tag(ctx, c.x, c.y - 26, text, col, 20);
}

// A fixed top-down mini field (never moves): every rider, the ball and the ridden horse's heading, so positions are readable at a glance.
function miniField(ctx, G, S, s, L) {
  const w = 84, h = Math.round(w * (2 * HL) / (2 * HW)), x0 = W - 14 - w, y0 = L.pause.y + L.pause.h + 14;
  const px = (x) => x0 + (x / HW * 0.5 + 0.5) * w, pz = (z) => y0 + (0.5 - z / HL * 0.5) * h;
  ctx.save();
  roundPath(ctx, x0 - 4, y0 - 4, w + 8, h + 8, 10); ctx.fillStyle = 'rgba(8,24,18,0.62)'; ctx.fill();
  ctx.fillStyle = 'rgba(70,148,74,0.85)'; ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, w, h);
  ctx.beginPath(); ctx.moveTo(x0, pz(0)); ctx.lineTo(x0 + w, pz(0)); ctx.stroke();
  ctx.fillStyle = '#f4efe4'; for (const sg of [-1, 1]) ctx.fillRect(px(-GOAL_HW), pz(sg * HL) - 1.5, px(GOAL_HW) - px(-GOAL_HW), 3);
  for (const r of s.riders) {
    ctx.fillStyle = r.team === 0 ? RED : BLUE; ctx.strokeStyle = r.human ? '#ffd54a' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = r.human ? 2.5 : 1;
    ctx.beginPath(); ctx.arc(px(r.x), pz(r.z), r.human ? 5.5 : 4.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px(r.x), pz(r.z)); ctx.lineTo(px(r.x + Math.sin(r.h) * 1.6), pz(r.z + Math.cos(r.h) * 1.6)); ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px(s.ball.x), pz(s.ball.z), 3.2, 0, TAU); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

export function renderHud(ctx, G, S, view) {
  const s = S.s, L = playLayout(G.settings.textIdx), m = L.m;
  G.viewW = view.cssW; G.viewH = view.cssH;
  G.L = L;
  const rider = G.mode === 'watch' ? null : s.riders.find((r) => r.human);
  scoreboard(ctx, G, s, L);
  if (rider && G.scene === 'play') fieldOverlays(ctx, G, S, s, L, rider);
  miniField(ctx, G, S, s, L);
  if (G.mode === 'watch') watchOverlay(ctx, G, S, s, L);
  if (G.drill) drillOverlay(ctx, G, S, s, L);
  banner(ctx, G, s, L);
  const sz = Math.round(26 * Math.min(m, 1.6));
  if (G.mode !== 'watch') {
    if (rider) staminaBar(ctx, G, L, rider);
    stick(ctx, G, L);
    const sw = rider ? rider.sw : { ph: 'idle' };
    circleButton(ctx, L.sw, 'SWING', { primary: true, held: G.c.swing, size: 30 });
    if (rider) swingArc(ctx, G, L, rider);
    const hk = rider ? rider.hook : { ph: 'idle', cool: 0 };
    circleButton(ctx, L.hook, 'HOOK', { held: hk.ph !== 'idle', disabled: hk.cool > 0 && hk.ph === 'idle', size: 24, sub: '' });
    void sw;
    drawButton(ctx, L.think, 'Think', { dark: true, size: sz });
    drawButton(ctx, L.pause, 'Pause', { dark: true, size: sz });
  }
  if (G.think) thinkOverlay(ctx, G, S, s, L);
}

// Think hint: what a good player in your role would do now ------------------------------------------------------------------------------
function thinkOverlay(ctx, G, S, s, L) {
  const t = G.think, m = L.m;
  if (t.marker) markerAt(ctx, G, t.marker.x, t.marker.z, t.marker.label, '#7fe8d6', 1.3);
  if (t.aim) { const rider = s.riders.find((r) => r.human); const a = P(G, t.aim.fx, 0.05, t.aim.fz), e = P(G, t.aim.x, 0.05, t.aim.z); if (a && e) { ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = '#ffd54a'; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore(); markerAt(ctx, G, t.aim.x, t.aim.z, 'aim', '#ffd54a', 0.9); } void rider; }
  const size = Math.round(24 * Math.min(m, 1.9)), w = W - 40;
  ctx.font = `600 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.text, w - 40);
  const bh = Math.round(80 * Math.min(m, 1.4));
  const ph = Math.min(H - 300, lines.length * size * 1.28 + 70 + size * 1.4 + bh);
  const y = H - ph - 20;
  panel(ctx, 20, y, w, ph, { r: 24, fill: 'rgba(10,36,28,0.95)', stroke: 'rgba(255,246,228,0.5)' });
  ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${Math.round(28 * Math.min(m, 1.5))}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(t.title, 44, y + 14 + 28 * Math.min(m, 1.5));
  wrapped(ctx, t.text, 44, y + 20 + 34 * Math.min(m, 1.5), w - 48, size, '#fff6e4', 1.28);
  G.thinkRects = { close: { x: 44, y: y + ph - bh - 14, w: w - 48, h: bh } };
  drawButton(ctx, G.thinkRects.close, 'Got it', { primary: true, size: Math.round(30 * Math.min(m, 1.5)) });
}

// Watch & Learn overlay -----------------------------------------------------------------------------------------------------------------------
export const W_RECTS = [];
export function watchHit(x, y) { return W_RECTS.findIndex((r) => inRect(r, x, y)); }
function watchOverlay(ctx, G, S, s, L) {
  const w = G.watch, m = L.m;
  const hold = s.hold;
  if (hold) {
    const r = s.riders[hold.rider];
    const rp = P(G, r.x, 0, r.z);
    if (rp) markerAt(ctx, G, r.x, r.z, `${r.team === 0 ? 'Red' : 'Blue'} ${ROLE_INFO[r.role].num}`, '#ffd54a', 1.4);
    if (w.phase !== 'think') {
      const a = P(G, s.ball.x, 0.05, s.ball.z), e = P(G, hold.ax, 0.05, hold.az);
      if (a && e) { ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = '#7fe8d6'; ctx.setLineDash([12, 8]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(e.x, e.y); ctx.stroke(); ctx.restore(); markerAt(ctx, G, hold.ax, hold.az, 'aim', '#7fe8d6', 0.9); }
    }
  }
  let msg;
  if (hold) {
    const who = `${s.riders[hold.rider].team === 0 ? 'Red' : 'Blue'} ${ROLE_INFO[s.riders[hold.rider].role].name}`;
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)} s: the ${who} is about to strike. Where should the ball go?`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${hold.why}`;
    else msg = 'ACT: the stroke is played.';
  } else msg = 'ACT: the play continues. The game stops for a Think moment before the next stroke.';
  const ps = Math.round(22 * Math.min(m, 1.5)), pw = W - 40;
  const bh = Math.round(66 * Math.min(m, 1.4)), y1 = H - 14 - bh;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pw - 30);
  const ph = Math.min(lines.length, 9) * ps * 1.25 + 20, py = y1 - ph - (m > 1.4 ? bh + 10 : 0) - 14;
  roundPath(ctx, 20, py, pw, ph, 16); ctx.fillStyle = 'rgba(8,24,18,0.86)'; ctx.fill();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left';
  lines.slice(0, 9).forEach((l, i) => ctx.fillText(l, 36, py + 10 + ps * (0.95 + i * 1.25)));
  const big = m >= 1.5;
  const rects = big ? [[14, y1 - bh - 10, 345, bh], [361, y1 - bh - 10, 345, bh], [14, y1, 345, bh], [361, y1, 345, bh]] : [[14, y1, 170, bh], [194, y1, 170, bh], [374, y1, 170, bh], [554, y1, 152, bh]];
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  W_RECTS.length = 0;
  rects.forEach((r, i) => { const rc = { x: r[0], y: r[1], w: r[2], h: r[3] }; W_RECTS.push(rc); drawButton(ctx, rc, labels[i], { primary: i === 0, dark: i > 0, size: Math.round(24 * Math.min(m, 1.7)) }); });
}

// Practice drill overlay ---------------------------------------------------------------------------------------------------------------------
function drillOverlay(ctx, G, S, s, L) {
  const d = G.drill, m = L.m;
  for (const mk of d.markers || []) markerAt(ctx, G, mk.x, mk.z, mk.label, mk.done ? 'rgba(255,255,255,0.4)' : mk.active ? '#7fe8d6' : 'rgba(127,232,214,0.5)', mk.r || 1.4);
  const size = Math.round(24 * Math.min(m, 1.6));
  ctx.font = `700 ${size}px ${FONT}`; const lines = wrapLines(ctx, d.text, W - 80);
  const ph = lines.length * size * 1.25 + 20, py = H - 240 - ph - (m > 1.3 ? 40 : 0) - 330;
  const y = Math.max(L.topH + L.pause.h + 30, py);
  roundPath(ctx, 40, y, W - 80, ph, 16); ctx.fillStyle = 'rgba(8,24,18,0.78)'; ctx.fill();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 10 + size * (0.95 + i * 1.25)));
}

// 2D fallback when WebGL is missing: the same field through the same camera, with tokens for the riders ----------------------------------------------
export function renderFallback(ctx, G, view) {
  const s = G.sim; if (!s) return;
  const Wd = view.cssW || 720, Hd = view.cssH || 1280;
  const Pj = (x, y, z) => projectV(Wd, Hd, x, y, z);
  ctx.save();
  ctx.fillStyle = '#20562f'; ctx.fillRect(0, 0, W, H);
  const corners = [[-HW, -HL], [HW, -HL], [HW, HL], [-HW, HL]].map(([x, z]) => Pj(x, 0, z));
  if (corners.every(Boolean)) { ctx.beginPath(); corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); ctx.fillStyle = '#46944a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f6f7fb'; ctx.stroke(); }
  for (const sg of [-1, 1]) for (const sx of [-1, 1]) { const a = Pj(sx * GOAL_HW, 0, sg * HL), b = Pj(sx * GOAL_HW, 3, sg * HL); if (a && b) { ctx.strokeStyle = '#f4efe4'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  const list = s.riders.map((r) => ({ r, a: Pj(r.x, 0, r.z) })).filter((o) => o.a).sort((u, v) => v.a.depth - u.a.depth);
  for (const { r, a } of list) {
    const sc = scaleAt(Wd, Hd, r.x, r.z), tipx = Pj(r.x + Math.sin(r.h) * 1.2, 0, r.z + Math.cos(r.h) * 1.2);
    ctx.fillStyle = r.team === 0 ? RED : BLUE; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(a.x, a.y - sc * 0.6, sc * 0.55, sc * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
    if (tipx) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y - sc * 0.6); ctx.lineTo(tipx.x, tipx.y - sc * 0.6); ctx.stroke(); }
  }
  const bp = Pj(s.ball.x, s.ball.y, s.ball.z);
  if (bp) { ctx.fillStyle = '#fbf7ee'; ctx.beginPath(); ctx.arc(bp.x, bp.y, Math.max(7, scaleAt(Wd, Hd, s.ball.x, s.ball.z) * 0.5), 0, TAU); ctx.fill(); ctx.strokeStyle = '#555'; ctx.stroke(); }
  ctx.restore();
}
export { LEVELS, REACH, WIND_MAX, HOOK_TICKS, C, HL };
