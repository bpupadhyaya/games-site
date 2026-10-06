// In-play HUD: scoreboard, pitch markers (you, your target, the landing spot), the stick and buttons, the set-shot meter, banners,
// Think and Pause. Everything follows the text size (through PLAY_M) and is laid out by layout.hudLayout so hit-testing and drawing agree.
import { W, H, PLAY_M, hudLayout, watchLayout, inRect, isWide, minFont, host } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { projectV, camFor } from './camera.js';
import { predictBall, dirOf, inside } from './model.js';
import { ROLE_NAME, QUARTER } from './consts.js';
import * as KC from './consts.js';

const TAU = Math.PI * 2;
export const TEAM_COL = ['#e0443a', '#2f7be0'];
export const W_RECTS = [];
export const watchHit = (x, y) => W_RECTS.findIndex((r) => inRect(r, x, y));

const fmtClock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pts = (sc) => sc.g * 6 + sc.b;

function P(G, x, y, z) { return projectV(camFor(W, H), W, H, x, y, z); }
function groundEllipse(ctx, G, x, z, r, fill, stroke, lw = 3) {
  const c = P(G, x, 0.02, z), a = P(G, x + r, 0.02, z), b = P(G, x, 0.02, z + r);
  if (!c || !a || !b) return null;
  const rx = Math.max(7, Math.abs(a.x - c.x)), ry = Math.max(4, Math.abs(b.y - c.y));
  ctx.save(); ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
  return { c, rx, ry };
}
function tag(ctx, x, y, text, col = '#ffd54a', size = 20) {
  size = minFont(size);
  ctx.save(); ctx.font = `800 ${size}px ${FONT}`; const w = ctx.measureText(text).width + 18;
  roundPath(ctx, x - w / 2, y - size * 0.95, w, size * 1.4, 10); ctx.fillStyle = 'rgba(6,24,16,0.86)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y - size * 0.25 + 1); ctx.restore();
}

function scoreboard(ctx, G, s, lay) {
  const m = lay.m, th = lay.topH, wide = lay.wide, kw = wide ? 0.85 : 1;
  const g = ctx.createLinearGradient(0, 0, 0, th + 30); g.addColorStop(0, 'rgba(4,16,10,0.9)'); g.addColorStop(1, 'rgba(4,16,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, th + 30);
  const m1 = Math.min(m, 1.6) * kw, ms = wide ? lay.sm : m, y0 = wide ? host.t + 8 : 14;
  for (const i of [0, 1]) {
    const left = i === 0, col = left ? lay.board.left : lay.board.right, x0 = col.x;
    ctx.fillStyle = TEAM_COL[i]; roundPath(ctx, x0, y0, 9, wide ? th - y0 - 16 : th - 40, 4); ctx.fill();
    const ax = left ? x0 + 20 : x0 + col.w - 6;
    ctx.textAlign = left ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${minFont(Math.round(21 * m1))}px ${FONT}`;
    ctx.fillText(`${s.teams[i].name} ${s.score[i].g}.${s.score[i].b}`, ax, y0 + 22 * m1);
    ctx.font = `800 ${Math.round(54 * ms)}px ${FONT}`; ctx.fillText(String(pts(s.score[i])), ax, y0 + 22 * m1 + 52 * ms);
  }
  const mc = Math.min(m, 1.5) * kw, cx = lay.board.clock.x + lay.board.clock.w / 2, yb = (wide ? host.t + 26 : 40) + 30 * mc;
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4'; ctx.font = `800 ${Math.round(42 * mc)}px ${FONT}`;
  ctx.fillText(fmtClock(s.clock), cx, yb);
  ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${minFont(Math.round(19 * mc))}px ${FONT}`;
  ctx.fillText(s.siren ? 'Last play' : `Q${s.q + 1} of ${s.quarters}`, cx, yb + 24 * mc);
}

function stickAndButtons(ctx, G, s, lay, cs, ctxInfo) {
  const dn = cs && cs.down ? cs.down : { stick: null };
  // stick
  const sc = dn.stick ? { x: dn.stick.ox, y: dn.stick.oy } : { x: lay.stick.cx, y: lay.stick.cy };
  ctx.save();
  ctx.globalAlpha = dn.stick ? 0.95 : 0.55;
  ctx.beginPath(); ctx.arc(sc.x, sc.y, 84, 0, TAU); ctx.fillStyle = 'rgba(255,246,228,0.12)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,246,228,0.7)'; ctx.stroke();
  let kx = sc.x, ky = sc.y;
  if (dn.stick) { const dx = dn.stick.x - dn.stick.ox, dy = dn.stick.y - dn.stick.oy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 80 / d); kx = sc.x + dx * k; ky = sc.y + dy * k; }
  ctx.beginPath(); ctx.arc(kx, ky, 38, 0, TAU); ctx.fillStyle = dn.stick ? '#fff6e4' : 'rgba(255,246,228,0.6)'; ctx.fill();
  ctx.restore();
  const btn = (c, label, sub, on, primary, down) => {
    ctx.save();
    const pressed = down ? 3 : 0;
    ctx.beginPath(); ctx.arc(c.cx, c.cy + 5, c.r, 0, TAU); ctx.fillStyle = 'rgba(4,16,10,0.4)'; ctx.fill();
    ctx.beginPath(); ctx.arc(c.cx, c.cy + pressed, c.r, 0, TAU);
    ctx.fillStyle = !on ? 'rgba(160,185,170,0.30)' : primary ? '#d8472c' : '#1f9d6a'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = !on ? 'rgba(255,255,255,0.3)' : primary ? '#8f2a15' : '#146f4a'; ctx.stroke();
    if (down) { ctx.fillStyle = 'rgba(4,16,10,0.18)'; ctx.fill(); }
    ctx.fillStyle = on ? '#fffaf0' : 'rgba(235,245,238,0.6)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let px = Math.round(c.r * 0.36); ctx.font = `800 ${px}px ${FONT}`;
    while (ctx.measureText(label).width > c.r * 1.7 && px > Math.max(11, minFont(11))) { px--; ctx.font = `800 ${px}px ${FONT}`; }
    ctx.fillText(label, c.cx, c.cy + pressed - (sub ? c.r * 0.08 : 0));
    if (sub) { ctx.font = `600 ${minFont(Math.round(c.r * 0.2))}px ${FONT}`; ctx.globalAlpha = 0.85; ctx.fillText(sub, c.cx, c.cy + pressed + c.r * 0.34); }
    ctx.restore();
  };
  btn(lay.a1, ctxInfo.a1 || 'ACT', '', !!ctxInfo.a1, true, dn.a1);
  btn(lay.a2, ctxInfo.a2 || '', '', !!ctxInfo.a2, false, dn.a2);
  btn(lay.spr, 'RUN', '', true, false, dn.spr);
  // stamina ring around the sprint button
  const pl = G.S && G.S.humanPlayer();
  if (pl) { ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = pl.stam > 0.25 ? '#ffd54a' : '#ff8a6a'; ctx.beginPath(); ctx.arc(lay.spr.cx, lay.spr.cy, lay.spr.r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * pl.stam); ctx.stroke(); ctx.restore(); }
}

function meter(ctx, G, s, lay) {
  const set = s.set; if (!set || !G.S.humanPlayer() || set.id !== G.S.humanPlayer().id || s.phase !== 'setshot') return;
  const r = lay.meter, ph = Math.sin(set.meter * TAU / 1.5);
  roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = 'rgba(6,24,16,0.85)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,246,228,0.6)'; ctx.stroke();
  const cx = r.x + r.w / 2, half = r.w / 2 - 16;
  ctx.fillStyle = 'rgba(255,246,228,0.18)'; roundPath(ctx, r.x + 16, r.y + 18, r.w - 32, r.h - 36, 10); ctx.fill();
  ctx.fillStyle = 'rgba(31,157,106,0.55)'; ctx.fillRect(cx - half * 0.28, r.y + 18, half * 0.56, r.h - 36);
  ctx.fillStyle = 'rgba(31,157,106,0.9)'; ctx.fillRect(cx - half * 0.1, r.y + 18, half * 0.2, r.h - 36);
  const mx = cx + ph * half; ctx.fillStyle = '#fff6e4'; ctx.fillRect(mx - 4, r.y + 8, 8, r.h - 16);
}

// short flat rings and sparks where something just happened (drawn on the HUD layer; the pitch itself never moves)
function effects(ctx, G, s) {
  for (const e of s.events) {
    const age = s.t - e.t;
    if (age < 0 || age > 0.7) continue;
    let pos = null, col = '#fff6e4', big = 1, kind = 'ring';
    if (e.type === 'kick') { pos = [e.x, e.y, e.z]; big = 1.1; }
    else if (e.type === 'handball') { pos = [e.x, e.y, e.z]; big = 0.7; }
    else if (e.type === 'mark') { pos = [e.bx, e.by, e.bz]; col = '#ffd54a'; big = 1.5; kind = 'burst'; }
    else if (e.type === 'tackle') { pos = [e.x, 1.1, e.z]; big = 1.2; col = '#ffffff'; }
    else if (e.type === 'spoil') { pos = [e.x, e.y, e.z]; col = '#7fe8d6'; big = 1.1; }
    else if (e.type === 'goal') { pos = [0, 2.5, e.z]; col = e.team === 0 ? '#ff7a6a' : '#7fb2ff'; big = 3; kind = 'confetti'; }
    if (!pos) continue;
    const q = P(G, pos[0], pos[1], pos[2]); if (!q) continue;
    const k = age / 0.7, a = 1 - k;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.strokeStyle = col; ctx.fillStyle = col;
    if (kind === 'ring') { ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(q.x, q.y, 6 + 26 * big * k, 0, TAU); ctx.stroke(); }
    else if (kind === 'burst') { ctx.lineWidth = 3; for (let i = 0; i < 10; i++) { const an = (i / 10) * TAU + (e.id % 7) * 0.3, r0 = 10 + 18 * k * big, r1 = 18 + 34 * k * big; ctx.beginPath(); ctx.moveTo(q.x + Math.cos(an) * r0, q.y + Math.sin(an) * r0); ctx.lineTo(q.x + Math.cos(an) * r1, q.y + Math.sin(an) * r1); ctx.stroke(); } }
    else { for (let i = 0; i < 26; i++) { const an = (i * 2.399 + e.id) % TAU, sp = 40 + ((i * 37) % 70), x = q.x + Math.cos(an) * sp * k * 1.6, y = q.y - 30 + Math.sin(an) * sp * k * 0.9 + 140 * k * k; ctx.fillStyle = i % 3 === 0 ? '#ffd54a' : i % 3 === 1 ? col : '#ffffff'; ctx.fillRect(x, y, 6, 4); } }
    ctx.restore();
  }
}

function pitchMarkers(ctx, G, s, lay, view) {
  effects(ctx, G, s);
  const S = G.S, B = s.ball, hp = S.humanPlayer();
  // ball: a ring so a small ball is always easy to follow
  const bp = P(G, B.x, B.y, B.z);
  if (bp && B.owner < 0 && s.phase !== 'ballup' || bp && s.phase === 'ballup') {
    ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,224,96,0.95)'; ctx.beginPath(); ctx.arc(bp.x, bp.y, 17, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // where a ball in the air will come down
  if (B.owner < 0 && B.y > 0.6 && (B.kind === 'kick' || B.kind === 'handball' || B.kind === 'tap' || B.kind === 'loose' || B.kind === 'ballup')) {
    const pr = predictBall(B, 150, 1 / 30); let q = null;
    for (const p of pr) if (p.y <= 2.1) { q = p; break; }
    if (!q && pr.length) q = pr[pr.length - 1];
    if (q) { const pulse = 0.5 + 0.5 * Math.sin(s.t * 9); groundEllipse(ctx, G, q.x, q.z, 1.1, `rgba(255,224,96,${0.15 + 0.1 * pulse})`, `rgba(255,224,96,${0.7 + 0.3 * pulse})`, 3); }
  }
  // who is who: a small letter above each of your teammates
  const LET = { ruck: 'R', mid: 'M', fwd: 'F', def: 'D' };
  for (const q of s.players) {
    if (q.team !== 0 || (hp && q.id === hp.id)) continue;
    const hd = P(G, q.x, 2.3 + q.jh, q.z); if (!hd) continue;
    const lf = minFont(10); ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(224,68,58,0.9)'; ctx.beginPath(); ctx.arc(hd.x, hd.y - 8, lf * 0.62, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `800 ${lf}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LET[q.role], hd.x, hd.y - 7); ctx.restore();
  }
  if (!hp) return;
  const you = groundEllipse(ctx, G, hp.x, hp.z, 1.2, 'rgba(255,213,74,0.22)', '#ffd54a', 4);
  const hd = P(G, hp.x, 2.45, hp.z);
  if (hd) { ctx.save(); ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.moveTo(hd.x, hd.y + 6); ctx.lineTo(hd.x - 9, hd.y - 8); ctx.lineTo(hd.x + 9, hd.y - 8); ctx.closePath(); ctx.fill(); ctx.restore(); }
  void you;
  // the target a kick or handball would go to
  const info = G.aim;
  if (info && info.t) {
    const t = info.t, a = P(G, hp.x, 0.1, hp.z), b = P(G, t.x, 0.1, t.z);
    if (a && b) { ctx.save(); ctx.setLineDash([8, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(127,232,214,0.85)'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); }
    groundEllipse(ctx, G, t.x, t.z, t.type === 'goal' ? 1.6 : 1.0, 'rgba(127,232,214,0.2)', '#7fe8d6', 4);
    if (b) tag(ctx, b.x, b.y - 22, t.type === 'goal' ? 'GOAL' : t.type === 'mate' ? 'PASS' : 'KICK', '#7fe8d6', 17);
  }
  // hint target
  if (G.think && G.think.tx !== undefined) { groundEllipse(ctx, G, G.think.tx, G.think.tz, 1.4, 'rgba(255,233,160,0.25)', '#ffe9a0', 4); const q = P(G, G.think.tx, 0.1, G.think.tz); if (q) tag(ctx, q.x, q.y - 24, 'HERE', '#ffe9a0', 18); }
}

function banner(ctx, G, s, lay, m, baseY) {
  const showLast = s.last && s.t - s.last.t < 2.3;
  if (showLast) {
    const big = minFont(Math.round(44 * Math.min(m, 1.5) * (lay.wide ? 0.8 : 1))); ctx.font = `800 ${big}px ${FONT}`;
    const bx = lay.banner.x, bw = lay.banner.w;
    const lines = wrapLines(ctx, s.last.text, bw - 10);
    const ph = lines.length * big * 1.2 + 24, py = baseY;
    roundPath(ctx, bx, py, bw, ph, 20); ctx.fillStyle = 'rgba(6,24,16,0.82)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = s.last.team >= 0 ? TEAM_COL[s.last.team] : '#ffd54a'; ctx.stroke();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, py + 12 + big * (0.95 + i * 1.2)));
    return py + ph;
  }
  return baseY;
}

function promptLine(G, s, ctxInfo) {
  const hp = G.S.humanPlayer();
  if (G.mode === 'watch') return 'Watch & Learn: all computer players';
  if (G.mode === 'drill' && G.drill) return G.drill.prompt || '';
  if (s.phase === 'ballup') return s.ballup && (s.ballup.why === 'quarter' || s.ballup.why === 'center') ? 'Bounce at the centre: the rucks jump for it' : 'Ball-up: the nearest two players jump for it';
  if (s.phase === 'dead') return '';
  if (s.phase === 'setshot' && s.set) {
    if (hp && s.set.id === hp.id) return s.set.kind === 'mark' ? 'You took a mark: KICK (stop the bar in the middle) or PLAY ON' : s.set.kind === 'kickin' ? 'Kick-in: KICK to a teammate or PLAY ON' : 'Free kick: KICK or PLAY ON';
    return `${s.teams[s.set.team].name} ${s.set.kind === 'mark' ? 'have a mark' : 'have a free kick'}: stand your ground`;
  }
  if (hp && G.mode === 'ai' && (G.settings.tips | 0) <= 2 && s.phase === 'play' && s.t < 16) return TIPS[hp.role];
  return '';
}
const TIPS = {
  fwd: 'You are the gold ring. Drag the left stick to run into open space near goal; hold RUN to sprint. Teammates will kick to you: press MARK as the ball arrives.',
  mid: 'You are the gold ring. Drag the left stick to run; hold RUN to sprint. Run over the loose ball to pick it up, then HANDBALL or KICK to the teal ring.',
  def: 'You are the gold ring. Drag the left stick to run; stay between the ball and their forwards. Press SPOIL or MARK when a kick comes, TACKLE when a carrier is close.',
  ruck: 'You are the gold ring. Stand under the ball-up and press TAP as it comes down; steer with the stick. Then drop back behind the play.',
};

// The goal replay: a framed picture of the play drawn through the SAME fixed camera maths, with figures (head, shirt, shorts, legs and shadows) and the ball's trail
// instead of dots. The main pitch never moves; only this panel is centred on the ball.
function replayPanel(ctx, G, s, lay, fr, label, fr2, k) {
  const { x: px, y: py, w: pw, h: ph } = lay.replay, zoom = 1.9 * pw / 460;
  const lerp = (a, b, t) => a + (b - a) * t;
  const at = (i) => { const q = fr.p[i], q2 = fr2 ? fr2.p[i] : q; return [lerp(q[0], q2[0], k), lerp(q[1], q2[1], k), q2[0] - q[0], q2[1] - q[1]]; };
  const bw = fr2 ? [lerp(fr.b[0], fr2.b[0], k), lerp(fr.b[1], fr2.b[1], k), lerp(fr.b[2], fr2.b[2], k)] : fr.b;
  const bp = P(G, bw[0], 0, bw[1]); if (!bp) return;
  const mapPt = (x, y, z) => { const q = P(G, x, y, z); return q ? [px + pw / 2 + (q.x - bp.x) * zoom, py + ph * 0.66 + (q.y - bp.y) * zoom] : null; };
  ctx.save(); roundPath(ctx, px, py, pw, ph, 16); ctx.clip();
  const g = ctx.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#6da7d6'); g.addColorStop(0.2, '#b9d6e8'); g.addColorStop(0.22, '#3e9a57'); g.addColorStop(1, '#2a7a40'); ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
  // mown stripes every 5 m, drawn through the camera so they converge like the real ones
  for (let z = -60; z < 60; z += 10) { const a = mapPt(-40, 0, z), b = mapPt(40, 0, z), c = mapPt(40, 0, z + 5), d = mapPt(-40, 0, z + 5); if (a && b && c && d) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.fill(); } }
  for (const gz of [-KC.ZG, KC.ZG]) for (const x of [-KC.BHW, -KC.GHW, KC.GHW, KC.BHW]) { const a = mapPt(x, 0, gz), b = mapPt(x, Math.abs(x) < 4 ? 6 : 3, gz); if (a && b) { ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = Math.abs(x) < 4 ? 4 : 3; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); } }
  const order = fr.p.map((q, i) => ({ i, q: at(i) })).map((o) => ({ ...o, m: mapPt(o.q[0], 0, o.q[1]) })).filter((o) => o.m).sort((a, b) => a.m[1] - b.m[1]);
  for (const o of order) {
    const [x, y] = o.m, top = P(G, o.q[0], 1.8, o.q[1]), base = P(G, o.q[0], 0, o.q[1]); if (!top || !base) continue;
    const hgt = Math.abs(base.y - top.y) * zoom, sp = Math.hypot(o.q[2], o.q[3]) * 20, ph2 = (G.t * 9 + o.i * 1.7) % TAU, sw = Math.min(1, sp / 5) * Math.sin(ph2) * hgt * 0.12;
    const col = TEAM_COL[o.i < 6 ? 0 : 1], lw = hgt * 0.075;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, hgt * 0.2, hgt * 0.06, 0, 0, TAU); ctx.fill();
    ctx.lineCap = 'round'; ctx.strokeStyle = '#d9a37a'; ctx.lineWidth = lw;                                  // legs swing with the run
    ctx.beginPath(); ctx.moveTo(x - hgt * 0.05, y - hgt * 0.5); ctx.lineTo(x - hgt * 0.05 + sw, y - hgt * 0.02); ctx.moveTo(x + hgt * 0.05, y - hgt * 0.5); ctx.lineTo(x + hgt * 0.05 - sw, y - hgt * 0.02); ctx.stroke();
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = lw * 1.1; ctx.beginPath(); ctx.moveTo(x - hgt * 0.05, y - hgt * 0.5); ctx.lineTo(x - hgt * 0.05 + sw * 0.4, y - hgt * 0.34); ctx.moveTo(x + hgt * 0.05, y - hgt * 0.5); ctx.lineTo(x + hgt * 0.05 - sw * 0.4, y - hgt * 0.34); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = lw * 0.9; ctx.beginPath(); ctx.moveTo(x - hgt * 0.16, y - hgt * 0.8); ctx.lineTo(x - hgt * 0.2 - sw * 0.6, y - hgt * 0.56); ctx.moveTo(x + hgt * 0.16, y - hgt * 0.8); ctx.lineTo(x + hgt * 0.2 + sw * 0.6, y - hgt * 0.56); ctx.stroke();   // arms
    ctx.fillStyle = col; roundPath(ctx, x - hgt * 0.15, y - hgt * 0.86, hgt * 0.3, hgt * 0.37, hgt * 0.07); ctx.fill();
    ctx.fillStyle = '#d9a37a'; ctx.beginPath(); ctx.arc(x, y - hgt * 0.94, hgt * 0.085, 0, TAU); ctx.fill();
  }
  const bm = mapPt(bw[0], bw[2], bw[1]); if (bm) { ctx.fillStyle = '#b8321f'; ctx.beginPath(); ctx.ellipse(bm[0], bm[1], 8, 5.5, -0.4, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.restore();
  roundPath(ctx, px, py, pw, ph, 16); ctx.lineWidth = 4; ctx.strokeStyle = '#ffd54a'; ctx.stroke();
  ctx.fillStyle = '#ffd54a'; ctx.font = `800 ${minFont(20)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(label, px + pw / 2, py - 6);
}
// the fixed top-down inset: live positions, and the replay of the last goal. It never moves.
function miniMap(ctx, G, s, lay) {
  const { x, y, w, h } = lay.minimap, side = camFor(W, H).side, cx = x + w / 2, cy = y + h / 2;
  const sx = side ? (w - 8) / (2 * KC.HL) : (w - 8) / (2 * KC.HW);
  let players = s.players.map((p) => [p.x, p.z]), ball = [s.ball.x, s.ball.z, s.ball.y], label = '';
  const R = G.replay; let rep = null, rep2 = null, repK = 0;
  if (R && G.replayFrames.length) {
    const fi = (s.t - R.t0) / 0.05, i = Math.floor(fi);
    if (i >= R.n) G.replay = null; else if (i >= 0) { const f = G.replayFrames[i]; players = f.p; ball = f.b; label = 'REPLAY'; rep = f; rep2 = G.replayFrames[Math.min(R.n - 1, i + 1)]; repK = fi - i; }
  }
  ctx.save(); roundPath(ctx, x, y, w, h, 12); ctx.fillStyle = label ? 'rgba(20,30,50,0.82)' : 'rgba(6,24,16,0.62)'; ctx.fill(); ctx.lineWidth = label ? 3 : 1.5; ctx.strokeStyle = label ? '#ffd54a' : 'rgba(255,246,228,0.5)'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, (side ? KC.HL : KC.HW) * sx, (side ? KC.HW : KC.HL) * sx, 0, 0, TAU); ctx.fillStyle = 'rgba(47,138,74,0.8)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
  // drawn the way the screen shows the pitch: portrait has the far end at the top and screen-right is world -x; landscape has the far end on the right and the far touchline on top
  const mp = side ? (px, pz) => [cx + pz * sx, cy - px * sx] : (px, pz) => [cx - px * sx, cy - pz * sx];
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); for (const gz of [-KC.ZG, KC.ZG]) { const a = mp(-KC.BHW, gz), b = mp(KC.BHW, gz); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); } ctx.stroke();
  const hp = G.S.humanPlayer();
  players.forEach((q, i) => { const m = mp(q[0], q[1]); ctx.fillStyle = TEAM_COL[i < 6 ? 0 : 1]; ctx.beginPath(); ctx.arc(m[0], m[1], 3.2, 0, TAU); ctx.fill(); if (!label && hp && i === hp.id) { ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m[0], m[1], 5.5, 0, TAU); ctx.stroke(); } });
  const bm = mp(ball[0], ball[1]); ctx.fillStyle = '#fff6e4'; ctx.beginPath(); ctx.arc(bm[0], bm[1], 2.6, 0, TAU); ctx.fill();
  if (label) { ctx.fillStyle = '#ffd54a'; ctx.font = `800 ${minFont(13)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(label, cx, y + h + minFont(13) + 2); }
  ctx.restore();
  if (rep) replayPanel(ctx, G, s, lay, rep, 'GOAL REPLAY', rep2, repK);
}

export function renderPlayHud(ctx, G, view, cs) {
  const S = G.S, s = S.s, lay = hudLayout(G.settings.textIdx, W, H), m = lay.m;
  const hp = S.humanPlayer();
  scoreboard(ctx, G, s, lay);
  pitchMarkers(ctx, G, s, lay, view);
  miniMap(ctx, G, s, lay);
  whistleMark(ctx, G, view);
  const prompt = promptLine(G, s);
  const showMeter = !!(s.set && hp && s.set.id === hp.id && s.phase === 'setshot') && G.mode !== 'watch';
  const drillExtra = lay.wide && G.mode === 'drill' && G.tally ? 34 : 0;
  const baseY = lay.wide ? (showMeter ? lay.meter.y + lay.meter.h + 10 : lay.bannerY) + drillExtra : lay.bannerY;
  const by = banner(ctx, G, s, lay, m, baseY);
  if (prompt) {
    const ps = minFont(Math.round(22 * Math.min(m, 1.6) * (lay.wide ? 0.85 : 1))); ctx.font = `700 ${ps}px ${FONT}`;
    const lines = wrapLines(ctx, prompt, lay.prompt.w - 20), ph = lines.length * ps * 1.25 + 16;
    const y2 = (s.last && s.t - s.last.t < 2.3) ? by + 10 : baseY;
    roundPath(ctx, lay.prompt.x, y2, lay.prompt.w, ph, 14); ctx.fillStyle = 'rgba(6,24,16,0.74)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; lines.forEach((l, i) => ctx.fillText(l, lay.prompt.x + lay.prompt.w / 2, y2 + 8 + ps * (0.95 + i * 1.25)));
  }
  if (G.mode === 'watch') { watchButtons(ctx, G, s, lay, m); return; }
  const ctxInfo = hp ? S.contextOf(hp) : { a1: null, a2: null };
  if (!lay.wide) {
    const bg = ctx.createLinearGradient(0, lay.stick.y - 30, 0, H); bg.addColorStop(0, 'rgba(4,16,10,0)'); bg.addColorStop(0.3, 'rgba(4,16,10,0.55)'); bg.addColorStop(1, 'rgba(4,16,10,0.82)');
    ctx.fillStyle = bg; ctx.fillRect(0, lay.stick.y - 30, W, H - lay.stick.y + 30);
  } else {
    const gl = ctx.createLinearGradient(0, 0, lay.stick.cx + 130, 0); gl.addColorStop(0, 'rgba(4,16,10,0.5)'); gl.addColorStop(1, 'rgba(4,16,10,0)'); ctx.fillStyle = gl; ctx.fillRect(0, lay.think.y - 6, lay.stick.cx + 130, H - lay.think.y + 6);
    const gr = ctx.createLinearGradient(W, 0, lay.a2.cx - lay.a2.r - 40, 0); gr.addColorStop(0, 'rgba(4,16,10,0.5)'); gr.addColorStop(1, 'rgba(4,16,10,0)'); const gx0 = lay.a2.cx - lay.a2.r - 40, gy0 = lay.spr.cy - lay.spr.r - 20; ctx.fillStyle = gr; ctx.fillRect(gx0, gy0, W - gx0, H - gy0);
  }
  if (showMeter) meter(ctx, G, s, lay);
  stickAndButtons(ctx, G, s, lay, cs, ctxInfo);
  const sz = minFont(Math.round(24 * Math.min(m, 1.6) * (lay.wide ? 0.9 : 1)));
  drawButton(ctx, lay.think, 'Think', { dark: true, size: sz });
  drawButton(ctx, lay.pause, 'Pause', { dark: true, size: sz });
  if (G.mode === 'drill') {
    const t = G.tally; if (t) { ctx.textAlign = 'center'; ctx.font = `700 ${minFont(Math.round(22 * Math.min(m, 1.6)))}px ${FONT}`; ctx.fillStyle = '#ffe9a0'; ctx.fillText(`${G.lessonTitle}: ${t.ok} good of ${t.n} tried`, lay.wide ? lay.prompt.x + lay.prompt.w / 2 : W / 2, lay.wide ? lay.bannerY + 24 : lay.topH + 4); }
  }
}

function watchButtons(ctx, G, s, lay, m) {
  const w = G.watch, wl = watchLayout(G.settings.textIdx, W, H), sz = minFont(Math.round(22 * Math.min(m, 1.7) * (lay.wide ? 0.9 : 1)));
  let msg;
  if (s.hold) {
    const tn = s.teams[s.hold.team].name;
    if (w.phase === 'think') msg = `THINK ${Math.ceil(w.timer)}s: ${tn} are weighing their options. What would you do?`;
    else if (w.phase === 'reveal') msg = `REVEAL: ${tn}: ${s.hold.reason}`;
    else msg = `ACT: ${s.hold.summary}`;
  } else msg = 'ACT: the play continues.';
  const ps = minFont(Math.round(21 * Math.min(m, 1.5) * (lay.wide ? 0.9 : 1))), pw = wl.panel.w;
  ctx.font = `600 ${ps}px ${FONT}`; const lines = wrapLines(ctx, msg, pw - 30).slice(0, 10);
  const ph = lines.length * ps * 1.25 + 20, py = wl.panel.bottom - ph;
  roundPath(ctx, wl.panel.x, py, pw, ph, 16); ctx.fillStyle = 'rgba(6,24,16,0.88)'; ctx.fill();
  ctx.fillStyle = w.phase === 'think' ? '#ffe9a0' : w.phase === 'reveal' ? '#7fe8d6' : '#ff9a86'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, wl.panel.x + 16, py + 10 + ps * (0.95 + i * 1.25)));
  if (s.hold) { const hp0 = s.players[s.hold.id]; groundEllipse(ctx, G, hp0.x, hp0.z, 1.3, 'rgba(255,213,74,0.22)', '#ffd54a', 4); }
  if (s.hold && w.phase !== 'think') {
    const opts = s.hold.options || [];
    opts.forEach((o) => { if (o.tx === undefined) return; const chosen = s.hold.choice && o.label === s.hold.choice.label; const q = P(G, o.tx, 0.1, o.tz); if (!q) return; groundEllipse(ctx, G, o.tx, o.tz, chosen ? 1.5 : 1.0, chosen ? 'rgba(127,232,214,0.25)' : 'rgba(255,255,255,0.1)', chosen ? '#7fe8d6' : 'rgba(255,255,255,0.7)', chosen ? 4 : 2); tag(ctx, q.x, q.y - 20, `${o.label.replace('Kick to ', '').replace('Handball to ', 'HB ')}${chosen ? ' *' : ''}`, chosen ? '#7fe8d6' : '#fff6e4', 15); });
  }
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  W_RECTS.length = 0;
  wl.rects.forEach((rc, i) => { W_RECTS.push(rc); drawButton(ctx, rc, labels[i], { primary: i === 0, dark: i > 0, size: sz }); });
}

// Think panel (modal): the coach's advice and its reason
export function renderThink(ctx, G) {
  const t = G.think, wide = isWide();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
  const m = PLAY_M[G.settings.textIdx], km = wide ? 0.9 : 1;
  const w = wide ? Math.min(820, W - 2 * (Math.max(host.l, host.r) + 40)) : W - 60, x = Math.round((W - w) / 2);
  const size = minFont(Math.round(26 * Math.min(m, 2) * km)), sl = 34 * Math.min(m, 1.6) * km;
  ctx.font = `400 ${size}px ${FONT}`;
  const lines = wrapLines(ctx, t.reason, w - 80);
  ctx.font = `700 ${minFont(Math.round(28 * Math.min(m, 1.6) * km))}px ${FONT}`;
  const sm = wrapLines(ctx, t.summary, w - 70);
  const bh = Math.round(84 * Math.min(m, 1.5) * (wide ? 0.8 : 1));
  const contentH = sm.length * sl + 12 + size * 1.3 * lines.length + 16;
  const head = wide ? 76 : 88, total = Math.min(H - (wide ? 40 : 120) - host.t - host.b, head + contentH + bh + 60);
  const y = Math.max(20 + host.t, (H - total) / 2);
  const vtop = y + head, vh = total - head - bh - 50, max = Math.max(0, contentH - vh);
  G.thinkScroll = Math.max(0, Math.min(G.thinkScroll || 0, max)); G.thinkView = { top: vtop, bottom: vtop + vh, max, vh };
  panel(ctx, x, y, w, total, { r: 26, fill: 'rgba(14,48,36,0.97)', stroke: 'rgba(255,246,228,0.5)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${minFont(Math.round(34 * Math.min(m, 1.6) * km))}px ${FONT}`; ctx.fillText('Coach says', W / 2, y + (wide ? 50 : 56));
  ctx.save(); ctx.beginPath(); ctx.rect(x + 6, vtop, w - 12, vh); ctx.clip();
  const o = vtop - G.thinkScroll;
  ctx.fillStyle = '#7fe8d6'; ctx.font = `700 ${minFont(Math.round(28 * Math.min(m, 1.6) * km))}px ${FONT}`; ctx.textAlign = 'center';
  sm.forEach((l, i) => ctx.fillText(l, W / 2, o + sl * (0.8 + i)));
  const off = o + sm.length * sl + 12;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff6e4'; ctx.font = `400 ${size}px ${FONT}`;
  lines.forEach((l, i) => ctx.fillText(l, x + 36, off + size * (1 + i * 1.3) - size * 0.2));
  ctx.restore();
  if (max > 0) {
    const th = Math.max(50, vh * vh / contentH), ty = vtop + (G.thinkScroll / max) * (vh - th);
    roundPath(ctx, x + w - 18, vtop, 8, vh, 4); ctx.fillStyle = 'rgba(255,246,228,0.15)'; ctx.fill(); roundPath(ctx, x + w - 18, ty, 8, th, 4); ctx.fillStyle = 'rgba(255,246,228,0.7)'; ctx.fill();
    if (G.thinkScroll < max - 4) { ctx.fillStyle = 'rgba(255,246,228,0.9)'; ctx.font = `700 ${minFont(20)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('▼ scroll for more', W / 2, vtop + vh + 24); }
  }
  const by = y + total - bh - 22;
  G.thinkRects = { close: { x: x + 24, y: by, w: w - 48, h: bh } };
  drawButton(ctx, G.thinkRects.close, 'Got it: back to the game', { primary: true, size: minFont(Math.round(28 * Math.min(m, 1.5) * (wide ? 0.85 : 1))) });
}

// 2D fallback when WebGL is missing: the oval and the players drawn through the same camera maths.
export function renderFallback(ctx, G, view) {
  const s = G.sim; if (!s) return;
  const cam = camFor(W, H), pj = (x, y, z) => projectV(cam, W, H, x, y, z);
  ctx.save();
  const bgc = ctx.createLinearGradient(0, 0, 0, H); bgc.addColorStop(0, '#16324a'); bgc.addColorStop(0.3, '#1d4a38'); bgc.addColorStop(1, '#10321f');
  ctx.fillStyle = bgc; ctx.fillRect(0, 0, W, H);
  const HW = KC.HW, HL = KC.HL;
  ctx.beginPath(); let first = true;
  for (let a = 0; a <= 360; a += 6) { const r = a * Math.PI / 180, q = pj(HW * Math.cos(r), 0, HL * Math.sin(r)); if (!q) continue; if (first) { ctx.moveTo(q.x, q.y); first = false; } else ctx.lineTo(q.x, q.y); }
  ctx.closePath(); ctx.fillStyle = '#2f8a4a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#f6f7fb'; ctx.stroke();
  for (const z of [-KC.ZG, KC.ZG]) for (const x of [-KC.BHW, -KC.GHW, KC.GHW, KC.BHW]) { const a = pj(x, 0, z), b = pj(x, Math.abs(x) < 4 ? 6 : 3, z); if (a && b) { ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  const list = s.players.map((p) => ({ p, a: pj(p.x, 0, p.z), b: pj(p.x, 1.8 + p.jh, p.z) })).filter((o) => o.a && o.b).sort((u, v) => v.a.depth - u.a.depth);
  for (const { p, a, b } of list) { ctx.strokeStyle = TEAM_COL[p.team]; ctx.lineWidth = Math.max(7, (a.y - b.y) * 0.3); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(b.x, b.y - 5, Math.max(5, (a.y - b.y) * 0.13), 0, TAU); ctx.fill(); }
  const B = s.ball, bp = pj(B.x, B.y, B.z);
  if (bp) { const sh = pj(B.x, 0, B.z); if (sh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 9, 4, 0, 0, TAU); ctx.fill(); } ctx.fillStyle = '#c8412e'; ctx.beginPath(); ctx.ellipse(bp.x, bp.y, 11, 7, 0.4, 0, TAU); ctx.fill(); }
  ctx.restore();
  void view;
}
export { ROLE_NAME, QUARTER, dirOf, inside };

// the umpire blows the whistle: a small whistle icon and sound rings above him for a moment (drawn through the fixed camera, so it sits on him)
function whistleMark(ctx, G, view) {
  const u = view && view.umpire, age = G.t - (G.whistleT ?? -9);
  if (!u || age < 0 || age > 1.1) return;
  const p = P(G, u.x, 2.7, u.z); if (!p) return;
  const k = age / 1.1, a = 1 - k;
  ctx.save(); ctx.globalAlpha = Math.min(1, a * 1.6);
  ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) { const r = 12 + (k * 26) + i * 10; ctx.globalAlpha = Math.max(0, a - i * 0.25); ctx.beginPath(); ctx.arc(p.x, p.y, r, -2.2, -0.9); ctx.stroke(); }
  ctx.globalAlpha = Math.min(1, a * 2);
  ctx.fillStyle = '#e8e8ea'; ctx.strokeStyle = '#13283a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillRect(p.x - 2, p.y - 13, 14, 7); ctx.strokeRect(p.x - 2, p.y - 13, 14, 7);
  ctx.restore();
}
