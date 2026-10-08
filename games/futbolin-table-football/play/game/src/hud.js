// The play screen: tavern floor, table, score card, buttons, banners, the hint panel and the Watch & Learn panel.
import { W, H, host, minFont, isWide, playLayout, watchLayout, toScreen, R, inRect, TEXT_SCALES } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, fitPx, textShadow, ease } from './ui.js';
import { drawFloor, drawTable, drawLight } from './draw.js';
import { HL, GOAL_HW, KINDS, THINK_STEPS, LEVELS, dirOf } from './consts.js';
import { manX } from './physics.js';

const TAU = Math.PI * 2;

export const hudRects = (G) => playLayout(G.settings.textIdx);

// The hint / coach plan drawn on the table: the rod's lane, the player to use, where to stand, and the shot line.
function planOverlay(plan, col) {
  return (ctx, lay, S) => {
    const r = S.rods[plan.rod];
    ctx.save();
    ctx.fillStyle = 'rgba(255,215,122,0.20)'; ctx.fillRect(-34, r.y - 4.4, 68, 8.8);
    ctx.strokeStyle = col; ctx.lineWidth = 0.5; ctx.setLineDash([1.6, 1.2]);
    ctx.strokeRect(-34, r.y - 4.4, 68, 8.8);
    ctx.setLineDash([]);
    // where the player should stand
    const K = KINDS[r.kind];
    const x = plan.tgt + (plan.k - (K.n - 1) / 2) * K.spacing;
    ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x, r.y, 3.6, 0, TAU); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, r.y, 0.9, 0, TAU); ctx.fill();
    // the shot
    const b = S.ball, d = dirOf(r.team), gy = d * HL;
    ctx.strokeStyle = col; ctx.lineWidth = 0.7; ctx.setLineDash([2.2, 1.6]);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(plan.aimX, gy); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(plan.aimX, gy, 2.2, 0, TAU); ctx.stroke();
    ctx.restore();
  };
}

export function overlayPlan(G) {
  if (G.think && G.think.plan) return G.think.plan;
  if (G.mode === 'watch' && G.sim && G.sim.s.hold) return G.sim.s.hold;
  return null;
}

export function renderPlay(ctx, G, sim) {
  const S = sim.s, lay = playLayout(G.settings.textIdx), t = G.t;
  ctx.clearRect(0, 0, W, H);
  drawFloor(ctx, W, H, lay);
  const plan = overlayPlan(G);
  const shake = S.shake > 0 ? { x: Math.sin(t * 90) * S.shake * 3, y: Math.cos(t * 77) * S.shake * 3 } : null;
  if (shake) { ctx.save(); ctx.translate(shake.x, shake.y); }
  drawTable(ctx, lay, S, {
    kits: G.kits, active: G.mode === 'watch' ? -1 : G.active, trail: true, fx: G.fx,
    netWob: S.phase === 'goal' ? Math.sin(S.phaseT * 30) * Math.max(0, 1 - S.phaseT) * 0.6 : 0,
    overlay: plan ? planOverlay(plan, G.think ? '#ffe28a' : (G.watch.phase === 'reveal' ? '#8ff0c0' : '#ffe28a')) : null,
  });
  if (shake) ctx.restore();
  drawLight(ctx, W, H, lay);
  drawScore(ctx, G, S, lay);
  drawBanner(ctx, G, S, lay);
  if (G.mode === 'watch') drawWatch(ctx, G, S); else drawButtons(ctx, G, lay);
  if (G.mode !== 'watch' && S.phase === 'ready' && S.phaseT < 1 && S.score[0] + S.score[1] === 0 && G.mode !== 'shot') drawHintLine(ctx, G, lay);
}

function drawHintLine(ctx, G, lay) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const fs = minFont(26);
  ctx.font = `700 ${fs}px ${FONT}`;
  const msg = G.two ? (lay.wide ? 'Red: lower half. Blue: upper half. Flick to kick.' : 'Red: right half. Blue: left half. Flick to kick.') : lay.wide ? 'Drag a rod up and down. Flick right to kick.' : 'Drag a rod sideways. Flick up to kick.';
  const tw = ctx.measureText(msg).width + 40;
  const p = toScreen(lay, 0, 0);
  roundPath(ctx, p.x - tw / 2, p.y - fs * 0.9 + (lay.wide ? 80 : 110), tw, fs * 1.8, fs * 0.9); ctx.fillStyle = 'rgba(20,8,2,0.72)'; ctx.fill();
  ctx.fillStyle = '#fff3d6'; ctx.fillText(msg, p.x, p.y + (lay.wide ? 80 : 110));
  ctx.restore();
}

function drawScore(ctx, G, S, lay) {
  const r = lay.score;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 24, fill: 'rgba(36,16,6,0.86)', stroke: 'rgba(255,214,150,0.45)' });
  const mid = r.x + r.w / 2;
  const sub = G.two ? 'Two players' : G.mode === 'watch' ? 'Watch & Learn' : G.mode === 'cup' ? `${G.cupRound.round}` : G.mode === 'shot' ? 'Friendly' : `Level ${LEVELS[G.setup.opp - 1].name}`;
  ctx.save(); ctx.textBaseline = 'middle';
  const subFs = minFont(Math.round(Math.min(24, r.w * 0.07) * Math.min(1.3, lay.m)));
  if (lay.wide) {
    // compact: two rows (dot, name, big score), then the line under them
    const rowH = (r.h - subFs * 3.2) / 2, big = Math.round(rowH * 0.98);
    [0, 1].forEach((t) => {
      const cy = r.y + 14 + rowH * (t + 0.5), kit = G.kits[t];
      ctx.fillStyle = kit.col; ctx.beginPath(); ctx.arc(r.x + 22, cy, Math.max(7, big * 0.17), 0, TAU); ctx.fill(); ctx.strokeStyle = kit.trim; ctx.lineWidth = 2; ctx.stroke();
      const px = fitPx(ctx, G.names[t], 700, Math.round(big * 0.5), r.w - 90 - big * 0.7, minFont(12));
      ctx.font = `700 ${px}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff3d6'; ctx.fillText(G.names[t], r.x + 40, cy);
      ctx.font = `800 ${big}px ${DISPLAY}`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff6e4'; ctx.fillText(String(S.score[t]), r.x + r.w - 18, cy + 2);
    });
    ctx.font = `600 ${subFs}px ${FONT}`; ctx.fillStyle = 'rgba(255,230,190,0.8)'; ctx.textAlign = 'center';
    ctx.fillText(sub, mid, r.y + r.h - subFs * 1.9); ctx.fillText(`first to ${S.goals}`, mid, r.y + r.h - subFs * 0.7);
    ctx.restore(); return;
  }
  const cy = r.y + r.h * 0.40;
  const nameFs = Math.round(Math.min(28, r.h * 0.26) * Math.min(1.3, lay.m)), big = Math.round(r.h * 0.5);
  ctx.font = `800 ${big}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e4';
  ctx.fillText(String(S.score[0]), mid - big * 0.8, cy + 2);
  ctx.fillText(String(S.score[1]), mid + big * 0.8, cy + 2);
  ctx.fillStyle = '#e8a33a'; ctx.font = `800 ${Math.round(big * 0.5)}px ${FONT}`; ctx.fillText(':', mid, cy - 2);
  const sideW = r.w / 2 - big * 1.4 - 20;
  const nm = (txt, x, align, kit) => {
    const px = fitPx(ctx, txt, 700, nameFs, sideW - 24, minFont(12));
    ctx.font = `700 ${px}px ${FONT}`; ctx.textAlign = align; ctx.fillStyle = '#fff3d6';
    ctx.fillText(txt, x + (align === 'left' ? 26 : -26), cy);
    ctx.fillStyle = kit.col; ctx.beginPath(); ctx.arc(align === 'left' ? x + 10 : x - 10, cy, Math.max(6, px * 0.3), 0, TAU); ctx.fill();
    ctx.strokeStyle = kit.trim; ctx.lineWidth = 2; ctx.stroke();
  };
  nm(G.names[0], r.x + 14, 'left', G.kits[0]);
  nm(G.names[1], r.x + r.w - 14, 'right', G.kits[1]);
  ctx.font = `600 ${subFs}px ${FONT}`; ctx.fillStyle = 'rgba(255,230,190,0.8)'; ctx.textAlign = 'center';
  ctx.fillText(`${sub} · first to ${S.goals}`, mid, r.y + r.h - subFs * 0.95);
  ctx.restore();
}

function drawBanner(ctx, G, S, lay) {
  const p = toScreen(lay, 0, 0);
  let text = null, sub = null, col = '#fff6e4', k = 1;
  if (S.phase === 'goal') {
    const u = Math.min(1, S.phaseT / 0.35); k = ease.outBack(u) ;
    text = S.goalBy === 0 || G.two ? 'GOAL!' : 'GOAL';
    sub = S.goalBy === 0 ? G.names[0] : G.names[1];
    col = S.goalBy === 0 ? '#ffd77a' : '#ff9a86';
  } else if (S.phase === 'over') {
    text = G.two ? `${G.names[S.winner].toUpperCase()} WINS` : S.winner === 0 ? (G.mode === 'watch' ? `${G.names[0]} win` : 'YOU WIN') : (G.mode === 'watch' ? `${G.names[1]} win` : 'YOU LOSE');
    col = S.winner === 0 ? '#ffd77a' : '#ff9a86'; k = 1;
  } else if (S.phase === 'ready' && S.phaseT > 0.05 && S.phaseT < 0.95 && S.score[0] + S.score[1] + 0 >= 0) {
    const u = S.phaseT; text = u < 0.55 ? 'READY' : 'PLAY'; k = 0.5 + 0.5 * ease.outCubic(Math.min(1, (u % 0.55) / 0.2)); col = '#fff6e4';
  }
  if (!text) return;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(k, k);
  const fs = Math.round(Math.min(W, H) * (text.length > 7 ? 0.1 : 0.16));
  ctx.font = `800 ${fs}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = fs * 0.12; ctx.strokeStyle = 'rgba(30,10,2,0.85)'; ctx.lineJoin = 'round'; ctx.strokeText(text, 0, 0);
  ctx.fillStyle = col; ctx.fillText(text, 0, 0);
  if (sub) { ctx.font = `700 ${Math.round(fs * 0.3)}px ${FONT}`; ctx.fillStyle = '#fff3d6'; ctx.strokeText(sub, 0, fs * 0.62); ctx.fillText(sub, 0, fs * 0.62); }
  ctx.restore();
}

function drawButtons(ctx, G, lay) {
  const b = lay.btn, fs = Math.round(26 * Math.min(lay.m, 1.5));
  drawButton(ctx, b.pause, 'Pause', { dark: true, size: fs });
  if (G.two) return;      // no hint or rod pick when two people play
  drawButton(ctx, b.hint, 'Hint', { dark: true, size: fs });
  drawButton(ctx, b.rods, G.settings.pick === 'auto' ? 'Rods: Auto' : 'Rods: Touch', { dark: true, size: Math.round(fs * 0.85) });
}

// Watch & Learn: controls and the THINK / REVEAL / ACT panel
function drawWatch(ctx, G, S) {
  const wl = watchLayout(G.settings.textIdx), w = G.watch;
  const labels = [w.paused ? 'Resume' : 'Pause', 'Think −', 'Think +', 'Exit'];
  labels.forEach((l, i) => drawButton(ctx, wl.rects[i], l, { dark: i !== 0 || w.paused, primary: i === 0 && !w.paused, size: Math.round(24 * Math.min(wl.lay.m, 1.4)) }));
  const secs = THINK_STEPS[G.settings.thinkIdx];
  const sc = TEXT_SCALES[G.settings.textIdx], fs = Math.round(24 * Math.min(sc, 2));
  let head, body;
  if (w.paused) { head = 'PAUSED'; body = 'Everything is frozen. Press Resume to carry on exactly where it stopped.'; }
  else if (S.hold) {
    const hold = S.hold, K = KINDS[S.rods[hold.rod].kind];
    if (w.phase === 'think') { head = `THINK  ${Math.max(0, Math.ceil(w.timer))}s`; body = `${G.names[0]}'s ${K.label.toLowerCase()} rod is about to strike. What would you do? ${hold.why}`; }
    else { head = 'REVEAL'; body = `The plan: stand a player at the circle and strike toward the dashed line. ${hold.why}`; }
  } else { head = 'WATCH'; body = `Think time is ${secs} s before each red kick. Use Think − / + to change it.`; }
  const pw = wl.panel.w;
  ctx.save(); ctx.font = `400 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, body, pw - 40);
  const maxLines = Math.max(2, Math.floor((H * 0.3) / (fs * 1.3)));
  const shown = lines.slice(0, maxLines);
  const ph = 52 + fs + shown.length * fs * 1.3 + 12;
  const y0 = wl.panel.bottom - ph;
  panel(ctx, wl.panel.x, y0, pw, ph, { r: 22, fill: 'rgba(36,16,6,0.9)', stroke: 'rgba(255,214,150,0.45)' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = w.phase === 'reveal' && S.hold ? '#8ff0c0' : '#ffd77a'; ctx.font = `800 ${Math.round(fs * 1.05)}px ${FONT}`;
  ctx.fillText(head, wl.panel.x + 22, y0 + 20 + fs);
  ctx.fillStyle = '#fff3d6'; ctx.font = `400 ${fs}px ${FONT}`;
  shown.forEach((l, i) => ctx.fillText(l, wl.panel.x + 22, y0 + 36 + fs * 2 + i * fs * 1.3 - fs * 0.4));
  ctx.restore();
}

export function watchHit(G, x, y) {
  const wl = watchLayout(G.settings.textIdx);
  for (let i = 0; i < 4; i++) if (inRect(wl.rects[i], x, y)) return i;
  return -1;
}

// The player's Hint panel
export function renderThink(ctx, G) {
  const th = G.think; if (!th) return;
  const sc = TEXT_SCALES[G.settings.textIdx], fs = Math.round(26 * Math.min(sc, 2.2));
  ctx.fillStyle = 'rgba(8,3,0,0.35)'; ctx.fillRect(0, 0, W, H);
  const wide = isWide();
  const lay = playLayout(G.settings.textIdx), rs = wide ? lay.res : null;
  const pw = rs ? rs.w : Math.min(wide ? 560 : W - 48, W - 2 * (Math.max(host.l, host.r) + 20)), px = rs ? rs.x : wide ? W - host.r - 20 - pw : Math.round((W - pw) / 2);
  ctx.save(); ctx.font = `700 ${Math.round(fs * 1.1)}px ${FONT}`;
  const head = wrapLines(ctx, th.summary, pw - 48);
  ctx.font = `400 ${fs}px ${FONT}`;
  const body = wrapLines(ctx, th.reason, pw - 48);
  const bh = Math.round(70 * Math.min(1.4, sc * 0.8 + 0.2));
  const textH = head.length * fs * 1.35 + body.length * fs * 1.3 + 40;
  const maxH = rs && !rs.side ? rs.bottom - rs.top - 4 : H - host.t - host.b - 40;
  const ph = Math.min(maxH, textH + bh + 60);
  const rp = toScreen(lay, 0, G.sim.s.rods[th.plan.rod].y);
  const lowRod = (lay.wide ? rp.x < W * 0.5 : rp.y > H * 0.5);
  const py = rs ? (rs.side ? Math.round((rs.top + rs.bottom - ph) / 2) : rs.bottom - ph) : wide ? Math.round((H - ph) / 2) : (lowRod ? host.t + 16 : H - host.b - 16 - ph);
  panel(ctx, px, py, pw, ph, { r: 26, fill: 'rgba(36,16,6,0.95)', stroke: 'rgba(255,214,150,0.55)' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#ffd77a'; ctx.font = `800 ${Math.round(fs * 0.8)}px ${FONT}`;
  ctx.fillText('HINT', px + 24, py + 20 + fs * 0.6);
  let y = py + 30 + fs;
  ctx.font = `700 ${Math.round(fs * 1.1)}px ${FONT}`; ctx.fillStyle = '#fff6e4';
  const clipBottom = py + ph - bh - 22;
  head.forEach((l) => { if (y < clipBottom) ctx.fillText(l, px + 24, y + fs * 0.5); y += fs * 1.35; });
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#ffe9c8';
  body.forEach((l) => { if (y < clipBottom) ctx.fillText(l, px + 24, y + fs * 0.4); y += fs * 1.3; });
  const gap = 12, bw = (pw - 48 - gap) / 2, by = py + ph - bh - 18;
  G.thinkRects = { use: R(px + 24, by, bw, bh), close: R(px + 24 + bw + gap, by, bw, bh) };
  drawButton(ctx, G.thinkRects.use, 'Use this rod', { primary: true, size: Math.round(26 * Math.min(1.4, sc)) });
  drawButton(ctx, G.thinkRects.close, 'Close', { size: Math.round(26 * Math.min(1.4, sc)) });
  ctx.restore();
}
