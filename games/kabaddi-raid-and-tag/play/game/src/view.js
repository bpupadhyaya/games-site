// The play screen: scoreboard, gauges, the little court, the coach line and the button panel. All text follows the text-size setting.
// The 3D scene (web/view3d) is drawn behind this canvas; when WebGL is not available the same court is drawn here in 2D.
import { W, H, PLAY, TEXT_SCALES, setPlayLayout, inRect, estLines } from './layout.js';
import { COURT, ACTION_NAME, RESPONSE_NAME, defenderOf, raiderOf, defenderPositions, FORMATION_NAME, BONUS_MIN_DEFENDERS, SUPER_TACKLE_MAX } from './rules.js';
import { toLocal } from './sim.js';
import { FONT, NUM, C, roundPath, panel, wrapLines, flowLayout, drawFlow, flowHit, drawButton, paintButton, textShadow } from './ui.js';
import { courtMap, drawMat, drawActors, drawDot, drawFormationPreview, pill, TEAM_COL, TAU } from './art.js';
import { panelKind, panelWidgets, coachText, teamName, humanRaids, humanDefends } from './panel.js';
import { LEVELS } from './ai.js';

const estCtx = { font: '', measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
let LAST = { lay: null, mini: null };

// The panel layout for the current widgets, computed from estimates only (so update and render agree exactly).
export function playLayoutNow(state, widgets) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const coachLines = coachLineCount(state);
  const tmp = flowLayout(estCtx, widgets.map((w) => ({ ...w })), sc, { x: 14, w: 692, btn: 24 });
  setPlayLayout(state.settings.textIdx, { contentH: Math.max(0, tmp.contentH - 14), coachLines, watch: state.mode === 'watch' });
  const lay = flowLayout(estCtx, widgets, sc, { x: 14, w: 692, btn: 24 });
  LAST.lay = lay;
  return lay;
}
function coachLineCount(state) {
  const text = coachText(state);
  const px = PLAY.fonts.coach || 22;
  return Math.max(1, Math.min(6, estLines(text, px, 692 - 28).length));
}
export function panelHit(state, lay, x, y) {
  if (!lay || !inRect(PLAY.scroll, x, y)) return null;
  return flowHit(lay, PLAY.scroll.y, state.ui.pscroll, x, y);
}

// ---- the little court ----------------------------------------------------------------------------------------------------------
function miniMap(state) {
  const sc = state.sc;
  if (!sc || !sc.raid) return null;
  return courtMap(PLAY.mini, -0.9, COURT.HALF + 0.1);
}
export function miniHit(state, x, y) {
  if (!PLAY.miniOn || !state.v3 || !inRect(PLAY.mini, x, y)) return null;
  const sc = state.sc, raid = sc.raid;
  if (!raid) return null;
  const mp = miniMap(state), pos = defenderPositions(raid);
  let best = null, bd = 1e9;
  for (const id of raid.defIds) {
    if (raid.banked.includes(id)) continue;
    const p = pos[id], d = Math.hypot(mp.sx(p.x) - x, mp.sy(p.u) - y);
    if (d < bd) { bd = d; best = id; }
  }
  return bd <= Math.max(26, mp.k * 1.1) ? best : null;
}

function drawCourtView(ctx, state, rect, o = {}) {
  const sc = state.sc, raid = sc.raid;
  const mp = courtMap(rect, o.u0 ?? -1.0, o.u1 ?? COURT.HALF + 0.15);
  drawMat(ctx, mp, { labels: o.labels, r: o.r });
  if (sc.phase === 'pre' && sc.pre) {
    const pre = sc.pre, n = sc.match.teams[pre.def].onMat.length;
    drawFormationPreview(ctx, mp, pre.formation, n, pre.def, { r: o.r2 });
    const q = sc.match.teams[pre.team].players[pre.raider];
    drawDot(ctx, mp.sx(COURT.W / 2), mp.sy(-0.4), (o.r2 ?? mp.k * 0.42) * 1.12, pre.team, { yaw: 0, num: q.num, ring: '#fff' });
    return mp;
  }
  if (!raid) return mp;
  // the dashed route and the telegraph
  const R = raid.P;
  ctx.save();
  ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
  const rl = toLocal(raid.team, sc.actors[raid.team * 7 + raid.raider].wx, sc.actors[raid.team * 7 + raid.raider].wz);
  if (sc.beat && sc.phase !== 'result') { ctx.beginPath(); ctx.moveTo(mp.sx(sc.beat.from.x), mp.sy(sc.beat.from.u)); ctx.lineTo(mp.sx(sc.beat.dest.x), mp.sy(sc.beat.dest.u)); ctx.stroke(); }
  ctx.restore();
  const target = state.ui.target;
  drawActors(ctx, mp, sc, { target: sc.phase === 'decide' && humanRaids(state) ? target : (sc.beat && sc.beat.seen && sc.beat.seen.target != null && sc.phase !== 'result' ? sc.beat.seen.target : null), r: o.r2 });
  return mp;
}

// ---- scoreboard ----------------------------------------------------------------------------------------------------------------------
function drawScore(ctx, state, i) {
  const sc = state.sc, m = sc.match, r = PLAY.score[i], f = PLAY.fonts, col = TEAM_COL[i];
  const raiding = (sc.raid ? sc.raid.team : sc.pre ? sc.pre.team : m.raiding) === i;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(10,22,28,0.90)', stroke: raiding ? col.light : 'rgba(255,255,255,0.18)', lw: raiding ? 3 : 2, shadow: false });
  ctx.fillStyle = col.main; roundPath(ctx, r.x, r.y, 12, r.h, 6); ctx.fill();
  ctx.textBaseline = 'alphabetic';
  const name = PLAY.compact ? col.name : teamName(state, i);
  ctx.font = `700 ${f.name}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#e8f1f4';
  let nm = name; while (ctx.measureText(nm).width > r.w * (PLAY.compact ? 0.5 : 0.74) && nm.length > 4) nm = nm.slice(0, -2);
  ctx.fillText(nm === name ? nm : nm + '…', r.x + 26, r.y + 10 + f.name * 0.95);
  ctx.textAlign = 'right'; ctx.font = `800 ${f.score}px ${NUM}`; ctx.fillStyle = '#ffffff';
  ctx.fillText(String(m.score[i]), r.x + r.w - 20, PLAY.compact ? r.y + 6 + f.score * 0.86 : r.y + 12 + f.name * 1.1 + f.score * 0.86);
  const on = m.teams[i].onMat.length, pr = PLAY.compact ? 7 : 7.5;
  for (let k = 0; k < 7; k++) {
    const cx = r.x + 30 + k * (pr * 2 + 6), cy = r.y + r.h - 14;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU);
    if (k < on) { ctx.fillStyle = col.main; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = col.light; ctx.stroke(); } else { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke(); }
  }
  if (raiding && !PLAY.compact) { ctx.font = `800 ${Math.round(f.small * 0.8)}px ${FONT}`; ctx.fillStyle = col.light; ctx.textAlign = 'left'; ctx.fillText('RAIDING', r.x + r.w - 110, r.y + r.h - 9); }
}
function drawInfo(ctx, state) {
  const sc = state.sc, m = sc.match, f = PLAY.fonts, r = PLAY.info;
  const total = 4 * m.per;
  const mode = state.mode === 'watch' ? 'Watch & Learn' : '';
  const text = PLAY.compact ? `H${m.half} · Raid ${Math.min(total, m.raids + 1)}/${total}${state.mode === 'watch' ? ' · Watch' : ''}` : state.mode === 'lesson' ? `Lesson ${state.lesson ? state.lesson.idx + 1 : ''}: ${state.lesson ? state.lesson.def.title : ''}` : `Half ${m.half} of 2  ·  Raid ${Math.min(total, m.raids + 1)} of ${total}${mode ? `  ·  ${mode}` : ''}`;
  ctx.font = `700 ${f.info}px ${FONT}`; ctx.fillStyle = 'rgba(232,241,244,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, r.w);
  lines.forEach((l, k) => textShadow(ctx, l, r.x + r.w / 2, r.y + f.info * (1 + k * 1.25), 'rgba(232,241,244,0.95)', 4));
}

function drawGauges(ctx, state) {
  const sc = state.sc, raid = sc.raid, f = PLAY.fonts, g = PLAY.gauges;
  if (!raid || sc.phase === 'pre' || sc.phase === 'result' || sc.phase === 'half' || sc.phase === 'over') return;
  const live = sc.phase !== 'enter';
  const barH = Math.max(14, f.chip * 0.8), y = g.y;
  const clock = Math.max(0, raid.clock), pc = clamp01(clock / COURT.RAID_SECS), cant = clamp01(raid.cant);
  ctx.save();
  ctx.font = `800 ${f.chip}px ${FONT}`; ctx.textBaseline = 'middle';
  // chips (what is special about this raid)
  let x = g.x;
  const chips = [];
  if (raid.dod) chips.push(['DO-OR-DIE', C.red]);
  if (raid.defIds.length >= BONUS_MIN_DEFENDERS && raid.banked.length === 0 && !raid.bonus && !raid.bonusTried) chips.push(['BONUS LIVE', '#b5801f']);
  if (raid.defIds.length <= SUPER_TACKLE_MAX) chips.push(['SUPER TACKLE', '#6a3fb5']);
  if (raid.crossed) chips.push(['BAULK CROSSED', '#1f7a4d']);
  const hasMini = PLAY.miniOn && state.v3;
  const maxX = hasMini ? PLAY.mini.x - 8 : W - 14;
  for (const [t, col] of chips) { ctx.font = `800 ${f.chip}px ${FONT}`; const w = ctx.measureText(t).width + f.chip * 1.1; if (x + w > maxX) break; x += pill(ctx, x, y, t, { size: f.chip, fill: col }) + 8; }
  const gy = y + f.chip * 1.6 + 8, gw = Math.min(hasMini ? PLAY.mini.x - 22 - g.x : W - 28, 420);
  // raid clock
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  const lab = (t, yy) => { ctx.font = `800 ${Math.max(15, f.chip * 0.9)}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillText(t, g.x, yy); };
  const bar = (yy, p, col, label, val) => {
    lab(label, yy + barH / 2);
    const lx = g.x + Math.max(ctx.measureText(label).width + 14, 66 * Math.min(PLAY.hs, 2));
    const bw = gw - (lx - g.x) - (val ? 54 * Math.min(PLAY.hs, 2) : 0);
    roundPath(ctx, lx, yy, bw, barH, barH / 2); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
    if (p > 0.01) { roundPath(ctx, lx, yy, Math.max(barH, bw * p), barH, barH / 2); ctx.fillStyle = col; ctx.fill(); }
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; roundPath(ctx, lx, yy, bw, barH, barH / 2); ctx.stroke();
    if (val) { ctx.font = `800 ${Math.max(15, f.chip * 0.95)}px ${NUM}`; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(val, lx + bw + 8, yy + barH / 2); }
  };
  ctx.textAlign = 'left';
  bar(gy, pc, pc > 0.3 ? '#3fb27f' : '#e5a63a', 'CLOCK', `${Math.ceil(clock)} s`);
  bar(gy + barH + 6, cant, cant > 0.35 ? '#5aa7ff' : '#e5584a', 'CANT', '');
  ctx.restore();
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---- the closing ring (timing tap) -------------------------------------------------------------------------------------------------------
function drawRing(ctx, state) {
  const sc = state.sc, b = sc.beat;
  if (sc.phase !== 'contact' || !b || sc.ctl.twoHumans || sc.ctl.watch) return;
  const humanActs = sc.ctl.human[sc.raid.team] || sc.ctl.human[sc.raid.def];
  if (!humanActs) return;
  const left = b.tc - sc.t, total = Math.max(0.2, b.tc - (sc.ring ? sc.ring.t0 : b.tc - 0.55));
  const p = clamp01(left / Math.max(0.55, total));
  const cx = W / 2, cy = PLAY.view.y + PLAY.view.h * 0.55, r1 = 62 + 110 * p;
  ctx.save();
  ctx.lineWidth = 8; ctx.strokeStyle = b.tap !== null ? 'rgba(160,255,190,0.95)' : 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.arc(cx, cy, r1, 0, TAU); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,214,110,0.95)'; ctx.beginPath(); ctx.arc(cx, cy, 62, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(10,22,28,0.45)'; ctx.beginPath(); ctx.arc(cx, cy, 56, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(30 * Math.min(1.6, PLAY.hs))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(b.tap !== null ? 'OK' : 'TAP', cx, cy + 2);
  ctx.restore();
}

// ---- the banner for a finished raid --------------------------------------------------------------------------------------------------------
function drawBanner(ctx, state) {
  const sc = state.sc, bn = sc.banner;
  if (sc.phase !== 'result' || !bn) return;
  const f = PLAY.fonts, cx = W / 2, cy = PLAY.view.y + PLAY.view.h * 0.42;
  const k = Math.min(1, bn.t / 0.25), alpha = Math.min(1, (2.6 - bn.t) / 0.4, k * 1.4);
  const col = TEAM_COL[bn.team ?? 0];
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  const size = Math.round(54 * Math.min(PLAY.hs, 1.7) * (0.9 + 0.1 * k));
  ctx.font = `800 ${size}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = wrapLines(ctx, bn.text.toUpperCase(), W - 70);
  const sub = bn.sub ? wrapLines(ctx, bn.sub, W - 80) : [];
  const h = lines.length * size * 1.1 + sub.length * f.coach * 1.2 + 34;
  roundPath(ctx, 24, cy - h / 2, W - 48, h, 22); ctx.fillStyle = 'rgba(9,20,26,0.86)'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = col.main; ctx.stroke();
  ctx.fillStyle = '#fff';
  let y = cy - h / 2 + 17 + size * 0.55;
  ctx.font = `800 ${size}px ${NUM}`;
  lines.forEach((l) => { ctx.fillText(l, cx, y); y += size * 1.1; });
  ctx.font = `600 ${Math.round(f.coach)}px ${FONT}`; ctx.fillStyle = col.light;
  sub.forEach((l) => { ctx.fillText(l, cx, y - size * 0.05); y += f.coach * 1.2; });
  ctx.restore();
}
function drawHalfCard(ctx, state) {
  const sc = state.sc;
  if (sc.phase !== 'half') return;
  const f = PLAY.fonts, m = sc.match;
  panel(ctx, 30, PLAY.view.y + 40, W - 60, Math.max(220, PLAY.view.h - 80), { r: 26, fill: 'rgba(9,20,26,0.9)', stroke: '#f2b441' });
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(46 * Math.min(PLAY.hs, 1.6))}px ${NUM}`; ctx.fillText('HALF TIME', W / 2, PLAY.view.y + 40 + (PLAY.view.h - 80) * 0.38);
  ctx.font = `700 ${Math.round(40 * Math.min(PLAY.hs, 1.6))}px ${NUM}`; ctx.fillText(`Blue ${m.score[0]}  –  ${m.score[1]} Red`, W / 2, PLAY.view.y + 40 + (PLAY.view.h - 80) * 0.62);
}

// ---- the whole screen -----------------------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const sc = state.sc;
  const lay = playLayoutNow(state, panelWidgets(state));
  const f = PLAY.fonts;
  // backdrop: 3D shows through. Without WebGL the 2D court takes its place.
  if (!state.v3) {
    ctx.fillStyle = '#0b161c'; ctx.fillRect(0, 0, W, H);
    const v = PLAY.view, gy = PLAY.gauges.y + PLAY.gauges.h + PLAY.fonts.chip * 1.6 + 30, avail = v.y + v.h - 6 - gy;
    const h = Math.min(avail, (W - 28) * 0.84), w = Math.min(W - 28, h * 1.2);
    drawCourtView(ctx, state, { x: (W - w) / 2, y: gy + (avail - h) / 2, w, h }, { labels: PLAY.hs <= 1.5, r: 14, r2: Math.max(8, h * 0.034) });
  } else {
    // a soft scrim behind the HUD so text stays readable on top of the 3D picture
    let g = ctx.createLinearGradient(0, 0, 0, PLAY.top + 20); g.addColorStop(0, 'rgba(6,14,18,0.78)'); g.addColorStop(1, 'rgba(6,14,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, PLAY.top + 20);
    g = ctx.createLinearGradient(0, PLAY.coach.y - 30, 0, PLAY.coach.y + 8); g.addColorStop(0, 'rgba(6,14,18,0)'); g.addColorStop(1, 'rgba(6,14,18,0.92)');
    ctx.fillStyle = g; ctx.fillRect(0, PLAY.coach.y - 30, W, 40);
    ctx.fillStyle = 'rgba(6,14,18,0.92)'; ctx.fillRect(0, PLAY.coach.y + 8, W, H - PLAY.coach.y - 8);
    if (PLAY.miniOn && sc.raid) {
      const r = PLAY.mini;
      ctx.save(); ctx.globalAlpha = 0.96;
      drawCourtView(ctx, state, r, { u0: -0.9, u1: COURT.HALF + 0.1, r: 10, r2: Math.max(5, courtMap(r, -0.9, COURT.HALF + 0.1).k * 0.4) });
      ctx.restore();
    }
  }
  if (!state.v3) { ctx.fillStyle = 'rgba(6,14,18,0.92)'; ctx.fillRect(0, PLAY.coach.y - 6, W, H - PLAY.coach.y + 6); }
  drawScore(ctx, state, 0); drawScore(ctx, state, 1); drawInfo(ctx, state);
  drawGauges(ctx, state);
  drawRing(ctx, state); drawBanner(ctx, state); drawHalfCard(ctx, state);
  // coach line
  const C0 = PLAY.coach;
  panel(ctx, C0.x, C0.y, C0.w, C0.h, { r: 16, fill: 'rgba(23,53,63,0.95)', stroke: 'rgba(242,180,65,0.55)', shadow: false });
  const text = coachText(state);
  ctx.font = `600 ${f.coach}px ${FONT}`; ctx.fillStyle = '#fff6e2'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, C0.w - 28);
  const th = lines.length * f.coach * 1.28, y0 = C0.y + (C0.h - th) / 2 + f.coach * 0.95;
  lines.forEach((l, k) => ctx.fillText(l, C0.x + C0.w / 2, y0 + k * f.coach * 1.28));
  if (state.toastT > 0 && state.toast) { ctx.globalAlpha = Math.min(1, state.toastT * 2); ctx.font = `700 ${Math.round(f.coach * 0.9)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.toast, W / 2, C0.y - 12); ctx.globalAlpha = 1; }
  // the button panel (scrolls when it does not fit)
  const S = PLAY.scroll, maxScroll = Math.max(0, S.contentH - S.h);
  state.ui.pscroll = Math.min(state.ui.pscroll, maxScroll);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, S.y - 2, W, S.h + 4); ctx.clip();
  drawFlow(ctx, lay, S.y, S.y + S.h, state.ui.pscroll);
  ctx.restore();
  if (maxScroll > 0) { const th2 = Math.max(40, S.h * (S.h / S.contentH)), ty = S.y + (state.ui.pscroll / maxScroll) * (S.h - th2); roundPath(ctx, W - 8, ty, 5, th2, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill(); }
  // bottom row
  const watch = state.mode === 'watch';
  drawButton(ctx, PLAY.think, watch ? (state.paused ? 'Resume' : 'Pause') : 'Think', { primary: watch && state.paused, dark: !watch || !state.paused, size: Math.round(f.btn * 1.0) });
  drawButton(ctx, PLAY.menu, watch ? 'Exit' : 'Menu', { dark: true, size: Math.round(f.btn * 1.0) });
  if (watch) drawWatchBar(ctx, state);
}

function drawWatchBar(ctx, state) {
  const w = state.watch;
  if (!w) return;
  const f = PLAY.fonts, r = { x: PLAY.coach.x + 6, y: PLAY.coach.y - 14, w: PLAY.coach.w - 12, h: 8 };
  const dur = w.phase === 'think' ? w.dur : 2;
  const p = clamp01(w.t / Math.max(0.01, dur));
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, 4); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
  roundPath(ctx, r.x, r.y, Math.max(8, r.w * p), r.h, 4); ctx.fillStyle = w.phase === 'think' ? '#f2b441' : '#6fd196'; ctx.fill();
  ctx.font = `800 ${Math.round(f.chip)}px ${FONT}`; ctx.fillStyle = w.phase === 'think' ? '#ffd88a' : '#9fe8b4'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText(w.phase === 'think' ? `THINK ${Math.max(0, Math.ceil(w.dur - w.t))} s` : 'REVEAL', r.x + r.w, r.y - 4);
  ctx.restore();
}
