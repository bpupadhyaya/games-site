// The play screen furniture drawn over the field: scoreboard, throw pips, grip bar, plan strip, style buttons, hint and Watch & Learn
// panels, result banner. Pure drawing from the game state G; hit-testing uses the same rectangles (playLayout / watchRects / stripGeom).
import { live, MIN_FONT, playLayout, THINK_STEPS } from './layout.js';
import { FONT, DISPLAY, roundPath, drawButton, paintButton, wrapLines, panel, plaque, textShadow, fitPx } from './ui.js';
import { drawScene, makeCam } from './scene.js';
import { STYLES, ROUNDS, THROWS_PER_ROUND, CHALLENGE_LIVES, PIVOT_Y, ARM_R, LINE_X, SLIP_BAND, SECTOR_MAX } from './consts.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const PIP = { fair: '#ffd45a', foul: '#e5513f' };

export function watchRects(L) {
  const w = Math.min(700, L.xr - L.xl - 24), x0 = Math.round(L.cx - w / 2), bh = 84, y = L.yb - 14 - bh, g = 10;
  const bw = Math.floor((w - 3 * g) / 4);
  return [0, 1, 2, 3].map((k) => ({ x: x0 + k * (bw + g), y, w: bw, h: bh }));
}

// The plan strip: the mat on the left, the lane as a wedge, distances left to right. x scale = KX px per metre, z scale = KZ px per metre.
export const STRIP_MAX = 64;
export function stripGeom(L) {
  const R = L.strip, pad = 34, kx = (R.w - pad - 46) / STRIP_MAX, kz = (R.h / 2 - 10) / (STRIP_MAX * Math.tan(SECTOR_MAX * DEG));
  return { R, kx, kz, ox: R.x + pad, oy: R.y + R.h / 2 };
}
export const stripToAim = (L, x, y, sector) => {
  const g = stripGeom(L), dx = Math.max(6, x - g.ox) / g.kx, dz = (y - g.oy) / g.kz;
  const a = Math.atan2(dz, dx) / DEG;
  return Math.max(-sector - 2, Math.min(sector + 2, Math.round(a * 2) / 2));
};

const small = (ctx, px, wt = 400) => { ctx.font = `${wt} ${Math.max(MIN_FONT, Math.round(px))}px ${FONT}`; };
function pill(ctx, x, y, w, h, fill = null, stroke = null) {
  // a carved plaque; a tinted fill (green/red verdicts) becomes a coloured slate with the same brass rim
  if (fill && /rgba\((20,60,34|80,24,18)/.test(fill)) {
    plaque(ctx, x, y, w, h, { r: Math.min(24, h / 2), tone: 'slate' });
    roundPath(ctx, x + 3, y + 3, w - 6, h - 6, Math.min(20, h / 2 - 3)); ctx.fillStyle = fill; ctx.fill();
  } else plaque(ctx, x, y, w, h, { r: Math.min(24, h / 2) });
}
export const fmt = (d) => `${(Math.round(d * 10) / 10).toFixed(1)} m`;
export const windWords = (w) => {
  const sp = Math.hypot(w.x, w.z);
  if (sp < 0.4) return 'Calm';
  const along = Math.abs(w.x) >= Math.abs(w.z) * 1.2 ? (w.x > 0 ? 'tailwind' : 'headwind') : Math.abs(w.z) >= Math.abs(w.x) * 1.2 ? `from the ${w.z > 0 ? 'left' : 'right'}` : `${w.x > 0 ? 'tail' : 'head'} and from the ${w.z > 0 ? 'left' : 'right'}`;
  return `${(Math.round(sp * 10) / 10).toFixed(1)} m/s ${along}`;
};

function pips(ctx, x, y, w, n, results, rivals, cur) {
  const gap = Math.min(54, w / n), r = Math.min(15, gap * 0.34);
  const x0 = x + w / 2 - gap * (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * gap, a = results[i];
    ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU);
    if (a) { ctx.fillStyle = PIP[a.outcome]; ctx.fill(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(); ctx.lineWidth = i === cur ? 3 : 1.5; ctx.strokeStyle = i === cur ? '#fff' : 'rgba(255,255,255,0.35)'; ctx.stroke(); }
    if (rivals && rivals[i] && a) { ctx.beginPath(); ctx.arc(cx, y + r + 9, 4.5, 0, TAU); ctx.fillStyle = PIP[rivals[i].outcome]; ctx.fill(); }
  }
}

export function drawStrip(ctx, G, L) {
  const g = stripGeom(L), R = g.R, run = G.run, s = run ? run.s : null, sec = (s ? s.sector : G.cfg.sector) * DEG;
  plaque(ctx, R.x, R.y, R.w, R.h, { r: 22, tone: 'slate', shadow: false });
  ctx.save(); ctx.beginPath(); ctx.rect(R.x + 3, R.y + 3, R.w - 6, R.h - 6); ctx.clip();
  // the lane wedge
  const xe = g.ox + STRIP_MAX * g.kx;
  ctx.beginPath(); ctx.moveTo(g.ox, g.oy); ctx.lineTo(xe, g.oy - Math.tan(sec) * STRIP_MAX * g.kz); ctx.lineTo(xe, g.oy + Math.tan(sec) * STRIP_MAX * g.kz); ctx.closePath();
  const wg = ctx.createLinearGradient(g.ox, 0, xe, 0); wg.addColorStop(0, 'rgba(110,200,110,0.55)'); wg.addColorStop(1, 'rgba(90,170,90,0.22)');
  ctx.fillStyle = wg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
  // distance ticks
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; small(ctx, 20, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (let d = 10; d <= STRIP_MAX; d += 10) {
    const x = g.ox + (LINE_X + d) * g.kx * 0 + d * g.kx; ctx.beginPath(); ctx.moveTo(x, R.y + 6); ctx.lineTo(x, R.y + R.h - 6); ctx.stroke();
    if (d % 20 === 0 || R.w > 600) ctx.fillText(String(d), x, R.y + R.h - 8);
  }
  // marks of earlier throws this round
  const R2 = G.round;
  if (R2 && R2.marks) R2.marks.forEach((m) => {
    ctx.beginPath(); ctx.arc(g.ox + m.x * g.kx, g.oy + Math.max(-1, Math.min(1, m.z / (m.x * Math.tan(sec) + 1e-6 || 1))) * 0 + m.z * g.kz, 5, 0, TAU);
    ctx.fillStyle = m.fair ? 'rgba(255,212,90,0.8)' : 'rgba(229,81,63,0.85)'; ctx.fill();
  });
  // aim line
  const aim = s ? s.aim : 0, ax = STRIP_MAX * g.kx, ay = Math.tan(aim * DEG) * STRIP_MAX * g.kz;
  ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(g.ox, g.oy); ctx.lineTo(g.ox + ax, g.oy + ay); ctx.stroke(); ctx.setLineDash([]);
  // the mat
  ctx.fillStyle = '#d9dde3'; roundPath(ctx, g.ox - 22, g.oy - 10, 26, 20, 5); ctx.fill();
  // predicted landing while swinging
  if (s && s.phase === 'swing' && G.guide && G.guide.pred && G.settings.guide === 0) {
    const p = G.guide.pred, x = g.ox + Math.max(0, p.x) * g.kx, y = g.oy + p.z * g.kz;
    ctx.beginPath(); ctx.arc(Math.min(xe, x), Math.max(R.y + 8, Math.min(R.y + R.h - 8, y)), 9, 0, TAU); ctx.fillStyle = p.fair ? 'rgba(130,255,150,0.9)' : 'rgba(255,110,90,0.9)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  if (s && s.phase === 'flight' && s.b) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(g.ox + Math.max(0, s.b.x) * g.kx, g.oy + s.b.z * g.kz, 6, 0, TAU); ctx.fill();
  }
  if (s && s.phase === 'landed') {
    const x = g.ox + Math.max(0, s.landX) * g.kx, y = g.oy + s.landZ * g.kz;
    ctx.beginPath(); ctx.arc(Math.min(xe, x), Math.max(R.y + 8, Math.min(R.y + R.h - 8, y)), 11, 0, TAU); ctx.fillStyle = s.outcome === 'fair' ? '#ffd45a' : '#e5513f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
  }
  ctx.restore();
  // wind badge, top right of the strip
  if (s) {
    const bx = R.x + R.w - 50, by = R.y + 40, sp = Math.hypot(s.wind.x, s.wind.z), len = Math.min(30, 6 + sp * 3.4);
    ctx.fillStyle = 'rgba(8,18,16,0.7)'; ctx.beginPath(); ctx.arc(bx, by, 36, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#bfe3ff'; ctx.fillStyle = '#bfe3ff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    if (sp > 0.3) {
      const a = Math.atan2(s.wind.z, s.wind.x), x0 = bx - Math.cos(a) * len / 2, y0 = by - Math.sin(a) * len / 2, x1 = bx + Math.cos(a) * len / 2, y1 = by + Math.sin(a) * len / 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 10 * Math.cos(a - 0.5), y1 - 10 * Math.sin(a - 0.5)); ctx.lineTo(x1 - 10 * Math.cos(a + 0.5), y1 - 10 * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill();
    }
    small(ctx, 22, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
    ctx.fillText(sp < 0.4 ? 'calm' : `${sp.toFixed(1)}`, bx, by + 56);
  }
  ctx.textBaseline = 'alphabetic';
}

function drawGrip(ctx, G, L) {
  const s = G.run.s, R = L.grip, st = STYLES[s.style], max = st.grip * 1.25;
  pill(ctx, R.x - 8, R.y - 8, R.w + 16, R.h + 16, 'rgba(8,18,16,0.72)');
  const u = (v) => R.x + Math.min(1, v / max) * R.w;
  ctx.save(); roundPath(ctx, R.x, R.y, R.w, R.h, R.h / 2); ctx.clip();
  ctx.fillStyle = '#3f9f4f'; ctx.fillRect(R.x, R.y, u(st.grip * SLIP_BAND[0] * 0.78) - R.x, R.h);
  ctx.fillStyle = '#e8b830'; ctx.fillRect(u(st.grip * SLIP_BAND[0] * 0.78), R.y, u(st.grip * SLIP_BAND[0]) - u(st.grip * SLIP_BAND[0] * 0.78), R.h);
  ctx.fillStyle = '#d6453d'; ctx.fillRect(u(st.grip * SLIP_BAND[0]), R.y, R.x + R.w - u(st.grip * SLIP_BAND[0]), R.h);
  ctx.fillStyle = 'rgba(0,0,0,0.58)'; ctx.fillRect(u(s.t), R.y, R.x + R.w - u(s.t), R.h);
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.fillRect(u(s.t) - 2, R.y - 5, 4, R.h + 10);
  small(ctx, 22, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('GRIP', R.x + 10, R.y + R.h / 2 + 1);
  const warn = s.t >= st.grip * SLIP_BAND[0];
  if (warn) { ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText('LET GO!', R.x + R.w - 10, R.y + R.h / 2 + 1); }
  ctx.textBaseline = 'alphabetic';
}

// The swing circle with the green sweet arc and the boot position marker, drawn around the shoulder on the field.
function drawArc(ctx, G, out) {
  const s = G.run.s, S = out.S, cx = out.X(0), cy = out.gy - PIVOT_Y * S, r = ARM_R * S;
  if (!(s.phase === 'ready' || s.phase === 'swing')) return;
  ctx.save();
  ctx.lineWidth = Math.max(3, S * 0.04); ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([S * 0.12, S * 0.1]); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const g = G.guide;
  if (g && g.arc && g.arc.lo >= 0 && G.settings.guide <= 1) {
    const a0 = Math.PI / 2 - g.arc.hi * DEG, a1 = Math.PI / 2 - g.arc.lo * DEG;
    const deg = ((s.phi / DEG) % 360 + 360) % 360, inside = s.phase === 'swing' && deg >= g.arc.lo && deg <= g.arc.hi;
    // a wedge from the shoulder, so the arc reads from across the field
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r + S * 0.16, a0, a1); ctx.closePath();
    ctx.fillStyle = inside ? 'rgba(140,255,150,0.62)' : 'rgba(110,235,130,0.3)'; ctx.fill();
    ctx.strokeStyle = inside ? '#e8ffe8' : 'rgba(150,255,170,0.95)'; ctx.lineWidth = Math.max(5, S * 0.07); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r + S * 0.16, a0, a1); ctx.stroke();
    if (inside) { ctx.font = `900 ${Math.round(Math.max(28, S * 0.3))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#eaffea'; ctx.shadowColor = 'rgba(0,40,0,0.8)'; ctx.shadowBlur = 8; ctx.fillText('NOW', cx + Math.cos((a0 + a1) / 2) * (r + S * 0.62), cy + Math.sin((a0 + a1) / 2) * (r + S * 0.62)); }
  }
  ctx.restore();
}

export function renderHud(ctx, G) {
  const W = live.w, H = live.h;
  const L = playLayout(G.settings.textIdx);
  const c = makeCam(W, H, L); G.cam = c;
  const run = G.run, s = run ? run.s : null;
  ctx.clearRect(0, 0, W, H);
  const info = G.sceneState(run, c); info.topPad = L.top + (G.run && G.run.s.phase === 'swing' ? 30 : 6);
  const out = drawScene(ctx, c, info);
  const mode = G.mode, R = G.round;

  if (s) drawArc(ctx, G, out);
  // live distance beside the boot in flight
  if (s && s.phase === 'flight' && s.b) {
    const x = out.X(s.b.x), y = out.gy - s.b.y * out.S, label = fmt(Math.max(0, s.b.x - LINE_X));
    small(ctx, 26, 800); const tw = ctx.measureText(label).width + 24;
    pill(ctx, Math.max(8, Math.min(W - tw - 8, x - tw / 2)), Math.max(L.top + 30, y - 66), tw, 40, 'rgba(14,26,24,0.74)');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, Math.max(8, Math.min(W - tw - 8, x - tw / 2)) + tw / 2, Math.max(L.top + 30, y - 66) + 21);
  }
  // live predicted distance at the hand while swinging (Guided)
  if (s && s.phase === 'swing' && G.guide && G.guide.pred && G.settings.guide === 0) {
    const p = G.guide.pred, label = p.fair ? fmt(p.d) : 'no-throw';
    const x = out.X(1.9), y = out.gy - (PIVOT_Y + 0.7) * out.S;
    small(ctx, 28, 800); const tw = ctx.measureText(label).width + 26, yy = Math.max(L.top + 70, y);
    pill(ctx, x - tw / 2, yy - 24, tw, 46, p.fair ? 'rgba(20,60,34,0.82)' : 'rgba(80,24,18,0.85)', p.fair ? 'rgba(130,255,150,0.8)' : 'rgba(255,140,120,0.8)');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, yy + 1);
  }

  // scoreboard
  const B = L.board;
  pill(ctx, B.x, B.y, B.w, B.h);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  let t1 = '', t2 = '';
  const bestNow = R.best > 0 ? fmt(R.best) : '-';
  if (mode === 'cup' || mode === 'shot') { t1 = `${ROUNDS[R.idx].name} · throw ${Math.min(THROWS_PER_ROUND, R.runIdx + 1)} of ${THROWS_PER_ROUND}`; t2 = `Best ${bestNow}  ·  Rival ${R.rivalBest > 0 ? fmt(R.rivalBest) : '-'}`; }
  else if (mode === 'watch') { t1 = `Watch & Learn · ${ROUNDS[R.idx].name}`; t2 = `Thrower ${bestNow}  ·  Rival ${R.rivalBest > 0 ? fmt(R.rivalBest) : '-'}`; }
  else if (mode === 'challenge') { t1 = `Distance Challenge · throw ${R.runIdx + 1}`; t2 = `${fmt(R.total)}  ·  ${'♥'.repeat(Math.max(0, CHALLENGE_LIVES - R.fouls))}${'♡'.repeat(Math.min(CHALLENGE_LIVES, R.fouls))}`; }
  else if (mode === 'drill') { t1 = G.drill ? G.drill.title : 'Drill'; t2 = G.drill ? `Goal: ${G.drill.goal}` : ''; }
  else { t1 = 'Practice'; t2 = `${R.runIdx} throws · best ${bestNow}`; }
  const bw = B.w - 24;
  const f1 = fitPx(ctx, t1, 700, 28, bw, MIN_FONT), f2 = fitPx(ctx, t2, 700, 34, bw, MIN_FONT);
  ctx.fillStyle = 'rgba(255,255,255,0.78)'; ctx.font = `700 ${f1}px ${FONT}`; ctx.fillText(t1, B.x + B.w / 2, B.y + 12 + f1 * 0.85);
  ctx.fillStyle = '#fff'; ctx.font = `800 ${f2}px ${FONT}`; ctx.fillText(t2, B.x + B.w / 2, B.y + 16 + f1 + f2 * 0.82);
  if (mode === 'cup' || mode === 'watch' || mode === 'shot') pips(ctx, B.x, B.y + B.h - 24, B.w, THROWS_PER_ROUND, R.mine, R.rivalRuns, R.runIdx);

  // pause and think buttons
  const btnIcon = (r, glyph) => {
    paintButton(ctx, r, { dark: true });
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.fillStyle = '#fff6e4'; ctx.strokeStyle = '#fff6e4'; ctx.lineCap = 'round';
    const k = r.w / 76;
    if (glyph === 'pause') { ctx.fillRect(-14 * k, -16 * k, 10 * k, 32 * k); ctx.fillRect(4 * k, -16 * k, 10 * k, 32 * k); }
    else { ctx.font = `800 ${Math.round(40 * k)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 2); }
    ctx.restore();
  };
  btnIcon(L.pause, 'pause');
  if (mode !== 'watch' && s && s.phase === 'ready' && !G.think) btnIcon(L.think, 'think');

  if (s && s.phase === 'swing') drawGrip(ctx, G, L);
  drawStrip(ctx, G, L);

  // style buttons while the thrower waits
  if (s && s.phase === 'ready' && mode !== 'watch') {
    L.chips.forEach((r, k) => {
      const st = STYLES[k];
      drawButton(ctx, r, st.short, { primary: k === G.style, dark: k !== G.style, size: 28, sub: st.note });
    });
    small(ctx, 26, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    textShadow(ctx, 'Press and hold to swing, let go to throw', L.cx, L.top + 90, '#fff', 6);
  }

  // result banner after landing
  if (s && s.phase === 'landed' && s.outcome && mode !== 'watch') {
    const f = Math.min(1, Math.max(0, s.since / 0.35)), e = 1 - Math.pow(1 - f, 3);
    const cy = L.top + (out.gy - L.top) * 0.4;
    ctx.save(); ctx.translate(L.cx, cy); ctx.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); ctx.globalAlpha = Math.min(1, e * 1.4);
    const fair = s.outcome === 'fair';
    const word = fair ? fmt(s.dist) : 'NO THROW';
    const col = fair ? '#ffd45a' : '#ff8a7a';
    const fs = Math.min(112, Math.floor((L.xr - L.xl - 70) / (word.length * 0.8)));
    ctx.font = `900 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(14,20,10,0.85)'; ctx.strokeText(word, 0, 0);
    ctx.fillStyle = col; ctx.fillText(word, 0, 0);
    small(ctx, 28, 700); ctx.fillStyle = '#fff';
    const tag = missNote(s, fair, R, G);
    if (tag) { ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(14,20,10,0.85)'; ctx.strokeText(tag, 0, fs * 0.55); ctx.fillText(tag, 0, fs * 0.55); }
    ctx.restore();
    const rvNow = R.rivalAll && R.rivalAll[R.runIdx];
    if (rvNow && (mode === 'cup' || mode === 'watch')) {
      small(ctx, 24, 700); ctx.textAlign = 'center';
      textShadow(ctx, `Rival this turn: ${rvNow.outcome === 'fair' ? fmt(rvNow.dist) : 'no throw'}`, L.cx, cy + fs * 0.55 + 52, 'rgba(255,255,255,0.92)', 6);
    }
  }
  if (G.think) renderThink(ctx, G, L);
  if (mode === 'watch') renderWatch(ctx, G, L);
  if (s && s.phase === 'ready' && !G.think && mode !== 'watch' && mode !== 'shot' && G.progress.rounds === 0 && G.progress.best === 0 && R.runIdx < 1 && !G.hintMsg) {
    const txt = 'Drag on the plan strip to aim into the wind.';
    small(ctx, 24, 800); const tw = Math.min(live.w - 40, ctx.measureText(txt).width + 40);
    pill(ctx, L.cx - tw / 2, L.strip.y - 62, tw, 48, 'rgba(14,26,24,0.8)', 'rgba(255,212,90,0.8)');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9a0'; ctx.fillText(txt, L.cx, L.strip.y - 38);
  }
  if (G.hintMsg && s && s.phase === 'ready') { small(ctx, 24, 700); ctx.textAlign = 'center'; textShadow(ctx, G.hintMsg, L.cx, L.noteY + 40, '#fff', 6); }
}

export function missNote(s, fair, R, G) {
  if (fair) {
    const pb = G && G.round && G.round.best === s.dist && G.round.mine.length > 0;
    if (s.slipped) return 'It slipped, but it flew';
    return pb && R.runIdx >= 0 ? 'Best throw so far' : 'Fair throw';
  }
  if (s.why === 'lane') return 'Outside the lane lines';
  if (s.why === 'back') return s.slipped ? 'It slipped out behind you' : 'Thrown backwards';
  return s.slipped ? 'It slipped out of your hand' : 'Too short to count';
}

function noteBox(ctx, L, lines, y, title) {
  const w = Math.min(660, L.xr - L.xl - 28), x = Math.round(L.cx - w / 2);
  const fs = Math.max(MIN_FONT, 26);
  ctx.font = `400 ${fs}px ${FONT}`;
  const wrapped = lines.flatMap((l) => wrapLines(ctx, l, w - 40));
  const h = 28 + (title ? fs * 1.4 : 0) + wrapped.length * fs * 1.3 + 16;
  plaque(ctx, x, y, w, h, { r: 22 });
  let yy = y + 20;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (title) { ctx.font = `800 ${Math.round(fs * 1.1)}px ${FONT}`; ctx.fillStyle = '#ffd45a'; yy += fs * 0.9; ctx.fillText(title, x + 20, yy); yy += fs * 0.5; }
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#fff';
  for (const l of wrapped) { yy += fs * 1.3; ctx.fillText(l, x + 20, yy - fs * 0.2); }
  return { x, y, w, h };
}

function renderThink(ctx, G, L) {
  const box = noteBox(ctx, L, G.think.lines, L.noteY + 8, 'Think');
  const r = { x: box.x + box.w - 190, y: box.y + box.h + 12, w: 190, h: 76 };
  drawButton(ctx, r, 'Carry on', { primary: true, size: 28 });
  G.thinkRects = { close: r };
}

function renderWatch(ctx, G, L) {
  const wt = G.watch, rects = watchRects(L), st = G.settings;
  const s = G.run ? G.run.s : null;
  if (wt.lines && wt.lines.length && (wt.phase === 'think' || wt.phase === 'reveal') && s && !s.outcome) {
    const n = wt.phase === 'reveal' ? wt.lines.length : Math.max(1, Math.min(wt.lines.length, Math.ceil(wt.lines.length * (1 - wt.timer / Math.max(0.1, THINK_STEPS[st.thinkIdx])) + 0.001)));
    const title = wt.phase === 'think' ? `Thinking...  ${Math.ceil(wt.timer)}` : 'Reveal';
    noteBox(ctx, L, wt.lines.slice(0, n), L.noteY + 8, title);
  } else if (s && s.outcome && s.phase === 'landed') {
    const lines = s.outcome === 'fair'
      ? [`The boot first touched the ground ${fmt(s.dist)} past the line, inside the lane.`, s.slipped ? 'The grip let go a little before the plan, so the throw was not at the best moment.' : 'It left at the planned moment.']
      : [s.why === 'lane' ? 'The boot first touched the ground outside the lane lines: a no-throw.' : s.why === 'back' ? 'The boot went backwards: a no-throw.' : 'The boot did not carry far enough to count: a no-throw.'];
    const box = noteBox(ctx, L, lines, L.noteY + 8, 'Result');
    // Watch & Learn: the note carries the throw; the rival's number sits just under it
    const rvNow = G.round && G.round.rivalAll && G.round.rivalAll[G.round.runIdx];
    if (rvNow) { small(ctx, 24, 700); ctx.textAlign = 'center'; textShadow(ctx, `Rival this turn: ${rvNow.outcome === 'fair' ? fmt(rvNow.dist) : 'no throw'}`, L.cx, box.y + box.h + 34, 'rgba(255,255,255,0.92)', 6); }
  } else if (wt.phase === 'act' && s && s.phase === 'swing') {
    noteBox(ctx, L, ['The thrower keeps swinging and lets go at the planned moment.'], L.noteY + 8, 'Act');
  }
  const labels = [wt.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Stop'];
  const subs = [wt.paused ? 'Paused' : '', `${THINK_STEPS[st.thinkIdx]} s`, `${THINK_STEPS[st.thinkIdx]} s`, ''];
  rects.forEach((r, i) => drawButton(ctx, r, labels[i], { primary: i === 0 && wt.paused, dark: !(i === 0 && wt.paused), size: 26, disabled: (i === 1 && st.thinkIdx === 0) || (i === 2 && st.thinkIdx === THINK_STEPS.length - 1), sub: i === 1 || i === 2 ? subs[i] : null }));
  if (wt.paused) { small(ctx, 30, 800); ctx.textAlign = 'center'; textShadow(ctx, 'PAUSED', L.cx, L.bannerY + 40, '#ffd45a', 8); }
}
