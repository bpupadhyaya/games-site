// The play screen on the 2D layer: scoreboard, wind compass, the sight lens bezel and reticle, the DRAW button, banners and the end-of-end card.
// The 3D valley itself is drawn behind this canvas by the presenter (or by the flat fallback below when WebGL is missing).
import { W, H, LY, PLAY, TEXT_SCALES, host, inRect, setPlayLayout } from './layout.js';
import { FONT, NUM, C, roundPath, paintButton, panel, wrapLines, textShadow } from './ui.js';
import { lensCam, project, worldOfAim, mainCam } from './camera.js';
import { ZOOMS, RANGE, MATCH_NAMES, POINTS } from './consts.js';
import { breath, reticle, windRel, windWords, drawFrac, targetPts, shooter, isHuman, T } from './engine.js';
import { drawBrandHair } from './brand.js';
import { drawFlatScene } from './flat.js';

const rgba = (c, a) => { const h = c.replace('#', ''); const n = parseInt(h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
const fit = (ctx, text, maxW, px, weight = 700, font = FONT) => { let s = px; ctx.font = `${weight} ${s}px ${font}`; while (ctx.measureText(text).width > maxW && s > 11) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; } return s; };
const eio = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export function drawBadge(ctx, cx, cy, text, o = {}) {
  ctx.save(); const px = o.size ?? 26; ctx.font = `800 ${px}px ${FONT}`; const w = ctx.measureText(text).width + (o.pad ?? 34), h = px * 1.7;
  roundPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = o.fill ?? 'rgba(10,24,18,0.78)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.edge ?? 'rgba(242,193,78,0.7)'; ctx.stroke();
  ctx.fillStyle = o.color ?? '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy + 1); ctx.restore(); return w;
}

// ---- scoreboard ------------------------------------------------------------------------------------------------------------------------------------------------
function scoreboard(ctx, state, E) {
  const r = PLAY.sb, F = PLAY.fonts, a = E.teams[0], b = E.teams[1];
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, fill: 'rgba(8,22,16,0.78)', stroke: 'rgba(242,193,78,0.55)', lw: 2 });
  ctx.save(); ctx.beginPath(); roundPath(ctx, r.x, r.y, r.w, r.h, 22); ctx.clip(); drawBrandHair(ctx, r.x, r.y + r.h - 4, r.w, 4); ctx.restore();
  ctx.textBaseline = 'alphabetic';
  const solo = !b, midW = Math.min(170, r.w * 0.26), half = (r.w - midW) / 2, py = r.y + r.h * 0.42;
  const side = (tm, x0, align, cur) => {
    if (!tm) return;
    ctx.textAlign = align; const x = align === 'left' ? x0 + 18 + 22 : x0 + half - 18 - 22;
    ctx.fillStyle = tm.top; roundPath(ctx, align === 'left' ? x0 + 16 : x0 + half - 16 - 14, r.y + 18, 14, r.h - 44, 7); ctx.fill();
    ctx.fillStyle = cur ? '#ffe9a8' : '#fff3d6'; ctx.font = `800 ${F.score}px ${NUM}`; ctx.fillText(String(tm.pts), x + (align === 'left' ? 0 : 0), py + F.score * 0.32);
    const sw = ctx.measureText(String(tm.pts)).width;
    ctx.font = `700 ${F.name}px ${FONT}`; ctx.fillStyle = cur ? '#ffe9a8' : 'rgba(255,243,214,0.9)';
    const nx = align === 'left' ? x + sw + 14 : x - sw - 14, nw = half - 42 - sw - 20;
    ctx.textAlign = align; fit(ctx, tm.name, nw, F.name, 700); ctx.fillText(tm.name, nx, py - F.name * 0.05);
    ctx.font = `500 ${Math.round(F.info * 0.9)}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.65)'; ctx.fillText(`this end ${tm.endPts}`, nx, py + F.name * 0.95);
  };
  side(a, r.x, 'left', E.cur && E.cur.team === 0);
  side(b, r.x + half + midW, 'right', E.cur && E.cur.team === 1);
  const mx = r.x + r.w / 2; ctx.textAlign = 'center';
  ctx.font = `800 ${Math.round(F.info * 1.1)}px ${FONT}`; ctx.fillStyle = '#f2c14e'; ctx.fillText(solo ? 'PRACTICE' : `END ${E.end + 1}`, mx, r.y + r.h * 0.38);
  ctx.font = `600 ${Math.round(F.info * 0.9)}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.75)';
  const sub = E.cfg.mode === 'lesson' ? `Lesson: ${E.lesson.pts}/${E.lesson.def.goal_pts} pts` : solo ? `${E.shots} arrows` : `first to ${targetPts(E)}`;
  ctx.fillText(sub, mx, r.y + r.h * 0.38 + F.info * 1.15);
  const sh = shooter(E);
  if (sh) { ctx.font = `700 ${Math.round(F.info * 0.95)}px ${FONT}`; ctx.fillStyle = E.teams[E.cur.team].top === '#1b1b1b' ? '#fff' : '#fff3d6'; ctx.textAlign = 'center'; const t = `${sh.name} · ${E.teams[E.cur.team].name} · arrow ${Math.min(2, E.arrowNo + 1)} of 2`; fit(ctx, t, r.w - 40, Math.round(F.info * 0.95), 700); ctx.fillText(t, mx, r.y + r.h - 12); }
}

// ---- wind compass -----------------------------------------------------------------------------------------------------------------------------------------------
function windCompass(ctx, state, E) {
  const r = PLAY.wind, cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 8, rad = r.w * 0.34;
  ctx.save();
  ctx.fillStyle = 'rgba(8,22,16,0.7)'; roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(242,193,78,0.5)'; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 7); ctx.strokeStyle = 'rgba(255,243,214,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,243,214,0.6)'; ctx.font = `700 ${Math.round(LY.minText * 0.8)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FAR', cx, cy - rad - 7);
  const rel = windRel(E, E.dir), ang = Math.atan2(rel.cross, rel.along), len = Math.min(rad * 1.05, 6 + rad * 0.2 * rel.s);
  if (rel.s > 0.25) {
    ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.strokeStyle = '#7fd4ff'; ctx.fillStyle = '#7fd4ff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, len * 0.9); ctx.lineTo(0, -len * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(-10, -len * 0.55); ctx.lineTo(10, -len * 0.55); ctx.closePath(); ctx.fill();
    ctx.setTransform(ctx.getTransform());
  } else { ctx.fillStyle = '#9fd8b4'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const txt = E.cfg.help === 2 ? 'watch the flags' : `${rel.s.toFixed(1)} m/s`;
  fit(ctx, txt, r.w - 12, Math.round(LY.minText * 1.05), 700); ctx.fillText(txt, cx, r.y + r.h - 10); ctx.restore();
}

// ---- lens bezel and reticle -----------------------------------------------------------------------------------------------------------------------------------------
export function drawLensOverlay(ctx, state, E, L) {
  const lr = PLAY.lens, cx = lr.cx, cy = lr.cy, r = lr.r;
  const calm = E.phase === 'draw' && E.draw && !E.draw.auto ? breath(E.draw.t) : 0.5;
  // the plate: the lens is a scissored square of the 3D canvas, so the four corners outside the round window are covered by a wooden plate with brass rivets
  ctx.save();
  ctx.beginPath(); ctx.rect(lr.x, lr.y, lr.w, lr.h); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2, true);
  const pg = ctx.createLinearGradient(lr.x, lr.y, lr.x + lr.w, lr.y + lr.h); pg.addColorStop(0, '#3a2514'); pg.addColorStop(0.5, '#27170b'); pg.addColorStop(1, '#3a2514');
  ctx.fillStyle = pg; ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(242,193,78,0.55)'; ctx.lineWidth = 3; ctx.strokeRect(lr.x + 4, lr.y + 4, lr.w - 8, lr.h - 8);
  for (const [px, py] of [[lr.x + 0.075 * lr.w, lr.y + 0.075 * lr.h], [lr.x + 0.925 * lr.w, lr.y + 0.075 * lr.h], [lr.x + 0.075 * lr.w, lr.y + 0.925 * lr.h], [lr.x + 0.925 * lr.w, lr.y + 0.925 * lr.h]]) { const rg = ctx.createRadialGradient(px - 2, py - 2, 1, px, py, 9); rg.addColorStop(0, '#fff0b8'); rg.addColorStop(1, '#a8761a'); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.fill(); }
  ctx.restore();
  // bezel
  ctx.save();
  ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(40,26,12,0.92)'; ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, 7); ctx.stroke();
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); g.addColorStop(0, '#f6d98a'); g.addColorStop(0.5, '#b5801f'); g.addColorStop(1, '#f0c868');
  ctx.lineWidth = 6; ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, 7); ctx.stroke();
  if (E.phase === 'draw' && E.draw && !E.draw.auto && E.draw.t > 0.8) {
    const k = Math.min(1, Math.max(0, (calm - 0.3) / 0.7)); ctx.lineWidth = 5; ctx.strokeStyle = k < 0.35 ? '#78e08f' : k < 0.7 ? '#f2c14e' : '#ef6a4c'; ctx.beginPath(); ctx.arc(cx, cy, r - 11, 0, 7); ctx.stroke();
  }
  ctx.restore();
  // inner vignette so the picture reads as a lens
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 7, 0, 7); ctx.clip();
  const vg = ctx.createRadialGradient(cx, cy, r * 0.62, cx, cy, r); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)'); ctx.fillStyle = vg; ctx.fillRect(lr.x, lr.y, lr.w, lr.h);
  // reticle
  const ret = reticle(E), cam = L || lensCam(E);
  const p = project(cam, 1, worldOfAim(E.dir, ret.u, ret.h));
  const showRet = E.phase === 'aim' || E.phase === 'draw' || E.phase === 'nock' || (E.phase === 'flight');
  if (p && showRet && !(E.phase === 'flight' && false)) {
    const x = cx + p.x * r, y = cy - p.y * r, big = Math.max(16, r * 0.06);
    ctx.lineCap = 'round';
    const col = E.phase === 'draw' ? '#fff3b0' : '#ffe27a';
    for (const [lw, c] of [[5, 'rgba(10,10,10,0.7)'], [2.4, col]]) {
      ctx.lineWidth = lw; ctx.strokeStyle = c;
      ctx.beginPath(); ctx.arc(x, y, big, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - big * 2.1, y); ctx.lineTo(x - big * 0.5, y); ctx.moveTo(x + big * 0.5, y); ctx.lineTo(x + big * 2.1, y); ctx.moveTo(x, y - big * 2.1); ctx.lineTo(x, y - big * 0.5); ctx.moveTo(x, y + big * 0.5); ctx.lineTo(x, y + big * 2.1); ctx.stroke();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
    if (E.phase === 'draw' && E.draw && !E.draw.auto) { const k = 0.5 + 1.1 * calm; ctx.lineWidth = 2; ctx.strokeStyle = rgba(calm < 0.5 ? '#78e08f' : '#f2c14e', 0.9); ctx.beginPath(); ctx.arc(x, y, big * (1.4 + 1.6 * k), 0, 7); ctx.stroke(); }
  }
  ctx.restore();
  // labels
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  drawBadge(ctx, cx, lr.y + 20 + Math.max(0, r * 0.04), `${RANGE} m`, { size: Math.max(14, Math.round(LY.minText * 0.95)), pad: 22 });
  drawBadge(ctx, cx, lr.y + lr.h - 18 - r * 0.04, `view ${ZOOMS[E.zoom]} m wide`, { size: Math.max(13, Math.round(LY.minText * 0.85)), pad: 22 });
  ctx.restore();
}

// ---- the play screen --------------------------------------------------------------------------------------------------------------------------------------------------------
// Watch & Learn: the coach thinks aloud before every shot (lines come from the engine's own plan for that archer)
function watchPanel(ctx, state, E) {
  const w = state.watch; if (!w || !E.plan) return;
  const U = LY.U, F = PLAY.fonts, px = Math.round(F.info * 1.05), lh = px * 1.28;
  const x = PLAY.land ? U.x0 + 14 : U.x0 + 14, wdt = (PLAY.land ? PLAY.view.w - 20 : U.w - 28) - (PLAY.land ? 0 : 0);
  ctx.save(); ctx.font = `500 ${px}px ${FONT}`;
  const lines = []; E.plan.lines.forEach((l) => lines.push(...wrapLines(ctx, l, wdt - 40)));
  const head = w.phase === 'think' ? `Thinking…  ${Math.max(0, Math.ceil(w.dur - w.t))} s` : 'The aim is set';
  const h = Math.min((PLAY.land ? PLAY.view.h : PLAY.view.h) * 0.6, 36 + px * 1.6 + lines.length * lh + 22);
  const y = (PLAY.land ? U.y1 - 16 : PLAY.lens.y - 14) - h;
  panel(ctx, x, y, wdt, h, { r: 22, fill: 'rgba(8,22,16,0.86)', stroke: 'rgba(242,193,78,0.6)', lw: 2 });
  const sh = shooter(E); ctx.textAlign = 'left'; ctx.fillStyle = '#f2c14e'; ctx.font = `800 ${Math.round(px * 1.15)}px ${FONT}`; ctx.fillText(`${sh ? sh.name : ''}: ${head}`, x + 20, y + 14 + px * 1.1);
  ctx.fillStyle = 'rgba(255,243,214,0.95)'; ctx.font = `500 ${px}px ${FONT}`;
  lines.forEach((l, i) => { const yy = y + 22 + px * 1.6 + (i + 1) * lh; if (yy < y + h - 8) ctx.fillText(l, x + 20, yy); });
  ctx.restore();
}
export function playLayoutNow(state) { setPlayLayout(state.settings.textIdx); }
function btn(ctx, r, label, o = {}) {
  const { dy } = paintButton(ctx, r, o);
  ctx.save(); ctx.fillStyle = o.disabled ? 'rgba(255,255,255,0.35)' : o.light === false ? C.ink : '#fff7e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = String(label).split('\n'), px = PLAY.fonts.btn;
  const s = Math.min(...lines.map((l) => fit(ctx, l, r.w - 14, px, 700)));
  ctx.font = `700 ${s}px ${FONT}`; lines.forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, r.y + dy + r.h / 2 + (i - (lines.length - 1) / 2) * s * 1.1)); ctx.restore();
}
function drawButtonCircle(ctx, state, E) {
  const d = PLAY.draw, human = E.cur && isHuman(E, E.cur.team) && E.phase !== 'result';
  const active = E.phase === 'draw' && E.draw, p = active ? drawFrac(E.draw.t) : 0, can = E.phase === 'aim' && human;
  const pressed = !!state.ui.drawing;
  ctx.save();
  ctx.beginPath(); ctx.arc(d.cx, d.cy + (pressed ? 1 : 5), d.r, 0, 7); ctx.fillStyle = 'rgba(40,16,0,0.8)'; ctx.fill();
  ctx.beginPath(); ctx.arc(d.cx, d.cy + (pressed ? 3 : 0), d.r, 0, 7); ctx.fillStyle = can || active ? '#d9791c' : '#4a4a44'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = can || active ? '#ffc27a' : 'rgba(255,255,255,0.12)'; ctx.stroke();
  if (active) { ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r + 9, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.strokeStyle = p >= 1 ? '#78e08f' : '#ffe27a'; ctx.stroke(); }
  ctx.fillStyle = can || active ? '#fff7e6' : 'rgba(255,255,255,0.4)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lab = active ? (p >= 1 ? 'RELEASE' : 'HOLD') : 'DRAW'; const s = fit(ctx, lab, d.r * 1.6, Math.round(d.r * 0.42), 800); ctx.font = `800 ${s}px ${FONT}`; ctx.fillText(lab, d.cx, d.cy + (pressed ? 3 : 0));
  ctx.restore();
}
function banner(ctx, E, state) {
  const U = LY.U, cx = PLAY.land ? (U.x0 + PLAY.view.w) / 2 : (U.x0 + U.x1) / 2, top = PLAY.land ? U.y0 + PLAY.sb.h + 150 : PLAY.wind.y + PLAY.wind.h + 8;
  const L = E.last;
  const big = (txt, col, sub) => {
    const k = eio(E.pt / 0.25), px = Math.round(PLAY.fonts.score * 1.5 * (0.6 + 0.4 * k));
    ctx.save(); ctx.globalAlpha = Math.min(1, E.pt / 0.15); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${px}px ${NUM}`; fit(ctx, txt, (PLAY.land ? PLAY.view.w : LY.U.w) - 60, px, 800, NUM); ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(20,10,0,0.75)'; ctx.strokeText(txt, cx, top + px); ctx.fillStyle = col; ctx.fillText(txt, cx, top + px);
    if (sub) { ctx.font = `700 ${Math.round(PLAY.fonts.info * 1.15)}px ${FONT}`; textShadow(ctx, sub, cx, top + px + PLAY.fonts.info * 1.7, '#fff3d6', 6); }
    ctx.restore();
  };
  if (E.phase === 'endintro') {
    const first = E.teams[E.order[0].team];
    big(E.cfg.mode === 'practice' || E.cfg.mode === 'lesson' ? 'Practice range' : `End ${E.end + 1}`, '#ffe9a8', E.teams.length > 1 ? `${first.name} shoots first · ${RANGE} m ${E.dir > 0 ? 'down' : 'back up'} the valley` : '');
  } else if ((E.phase === 'result' || E.phase === 'dance') && L) {
    const who = E.teams[L.team].members[L.m].name, tn = E.teams[L.team].name;
    if (L.kind === 'karay') big('KARAY!', '#ffd24a', `${who} · ${tn} · +${L.pts}`);
    else if (L.kind === 'hit') big('HIT', '#9fe8b4', `${who} · ${tn} · +${L.pts}`);
    else if (L.kind === 'near') big('Near', '#ffe9a8', `${L.missBy.toFixed(1)} m from the board · +${L.pts}`);
    else big(L.full ? 'Miss' : 'Short draw', '#ffb4a0', L.full ? `${who}: ${L.missBy < 30 ? L.missBy.toFixed(1) : Math.round(L.missBy)} m off the board` : 'Hold DRAW until the ring is full');
    if (E.phase === 'dance') { ctx.save(); ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(PLAY.fonts.info * 1.3)}px ${FONT}`; textShadow(ctx, `${tn} dance and sing!`, cx, top + PLAY.fonts.score * 2.6 + PLAY.fonts.info * 1.6, '#ffe9a8', 8); ctx.restore(); }
  } else if (E.phase === 'walk') {
    const k = E.pt < 0.6 ? E.pt / 0.6 : E.pt > T.walk - 0.7 ? (T.walk - E.pt) / 0.7 : 1;
    ctx.save(); ctx.fillStyle = `rgba(4,12,8,${0.88 * Math.max(0, Math.min(1, k))})`; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = Math.max(0, Math.min(1, k)); ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(PLAY.fonts.score * 0.7)}px ${FONT}`; ctx.fillText('Walking to the other end…', W / 2, H / 2); ctx.restore();
  }
  void state;
}
function endCard(ctx, state, E) {
  const r = E.endRes; if (!r) return;
  const sc = TEXT_SCALES[state.settings.textIdx], w = Math.min(LY.U.w - 40, 640), x = (LY.U.x0 + LY.U.x1) / 2 - w / 2;
  const fs = Math.round(26 * Math.min(sc, 1.8)), lines = [];
  const a = E.teams[0], b = E.teams[1];
  lines.push([`${a.name}`, `${r.e[0]}`], [`${b.name}`, `${r.e[1]}`]);
  const h = fs * 1.5 * 2 + fs * 5.3 + 120, y = Math.max(LY.U.y0 + 20, (LY.U.y0 + LY.U.y1) / 2 - h / 2 - 20);
  ctx.save(); ctx.fillStyle = 'rgba(4,12,8,0.5)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  panel(ctx, x, y, w, h, { r: 28, fill: 'rgba(12,30,22,0.96)', stroke: 'rgba(242,193,78,0.7)' });
  ctx.textAlign = 'center'; ctx.fillStyle = '#f2c14e'; ctx.font = `800 ${Math.round(fs * 1.35)}px ${FONT}`; ctx.fillText(`End ${r.end + 1} scored`, x + w / 2, y + fs * 1.9);
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left';
  lines.forEach(([n, v], i) => { ctx.fillStyle = E.teams[i].top; ctx.fillRect(x + 36, y + fs * (3.0 + i * 1.5) - fs * 0.7, 12, fs * 0.9); ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'left'; ctx.fillText(n, x + 62, y + fs * (3.0 + i * 1.5)); ctx.textAlign = 'right'; ctx.fillText(`${v} ${String(v) === '1' ? 'pt' : 'pts'}`, x + w - 36, y + fs * (3.0 + i * 1.5)); });
  ctx.textAlign = 'center'; ctx.fillStyle = r.winner < 0 ? '#ffe9a8' : '#9fe8b4'; ctx.font = `800 ${Math.round(fs * 1.2)}px ${FONT}`;
  const msg = r.winner < 0 ? 'Level: hits cancel out, nobody scores' : `${E.teams[r.winner].name} win the end by ${r.net}`;
  fit(ctx, msg, w - 50, Math.round(fs * 1.2), 800); ctx.fillText(msg, x + w / 2, y + fs * 6.4);
  ctx.fillStyle = 'rgba(255,243,214,0.8)'; ctx.font = `600 ${Math.round(fs * 0.95)}px ${FONT}`; ctx.fillText(`Match: ${r.total[0]} – ${r.total[1]}   (first to ${targetPts(E)})`, x + w / 2, y + fs * 7.7);
  state.endBtn = { x: x + 40, y: y + h - 28 - Math.max(70, fs * 2.4), w: w - 80, h: Math.max(70, fs * 2.4) };
  paintButton(ctx, state.endBtn, { primary: true });
  ctx.fillStyle = '#fff7e6'; ctx.font = `800 ${Math.round(fs * 1.15)}px ${FONT}`; ctx.textBaseline = 'middle';
  const lab = E.over ? 'See the result' : state.mode === 'watch' ? `Next end (${Math.max(0, Math.ceil(T.endAuto - E.pt))})` : 'Next end'; ctx.fillText(lab, x + w / 2, state.endBtn.y + state.endBtn.h / 2 + 2); ctx.textBaseline = 'alphabetic';
}

export function renderPlay(ctx, state) {
  const E = state.E; playLayoutNow(state);
  if (!state.v3) { if (state.has3d) drawLoading(ctx); else drawFlat(ctx, state, E); }
  scoreboard(ctx, state, E);
  if (E.phase !== 'walk' || true) windCompass(ctx, state, E);
  // lens frame: a plain dark backing so the 2D fallback and the not-yet-drawn first frame look right
  state.lensOn = E.phase !== 'walk' && E.phase !== 'dance' && E.phase !== 'endscore' || E.phase === 'endscore' && false;
  if (!state.v3 && !state.has3d && state.lensOn) drawLensFlat(ctx, state, E);
  drawLensOverlayIfFlat(ctx, state, E);
  const human = E.cur && isHuman(E, E.cur.team);
  const nm = PLAY.fonts.btn;
  void nm;
  btn(ctx, PLAY.menu, 'Menu', { dark: true }); btn(ctx, PLAY.think, state.mode === 'watch' ? (state.paused ? 'Resume' : 'Pause') : 'Think', { dark: true, disabled: false }); btn(ctx, PLAY.zoom, `Zoom\n${ZOOMS[E.zoom]} m`, { dark: true });
  if (state.mode !== 'watch') drawButtonCircle(ctx, state, E);
  else { const d = PLAY.draw; ctx.save(); ctx.fillStyle = 'rgba(8,22,16,0.7)'; ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(242,193,78,0.6)'; ctx.stroke(); ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const s1 = fit(ctx, 'Watch &', d.r * 1.55, Math.round(d.r * 0.34), 800); ctx.font = `800 ${s1}px ${FONT}`; ctx.fillText('Watch &', d.cx, d.cy - s1 * 0.6); ctx.fillText('Learn', d.cx, d.cy + s1 * 0.6); ctx.restore(); }
  banner(ctx, E, state);
  if (state.mode === 'watch' && E.phase === 'aim') watchPanel(ctx, state, E);
  if (state.tip && E.phase === 'aim' && human) { const m = PLAY.msg; ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(PLAY.fonts.info * 1.1)}px ${FONT}`; const t = state.tip; const w = Math.min(m.w, ctx.measureText(t).width + 44); roundPath(ctx, m.x + m.w / 2 - w / 2, m.y, w, m.h, 20); ctx.fillStyle = 'rgba(8,22,16,0.8)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; fit(ctx, t, m.w - 40, Math.round(PLAY.fonts.info * 1.1), 700); ctx.textBaseline = 'middle'; ctx.fillText(t, m.x + m.w / 2, m.y + m.h / 2); ctx.restore(); }
  if (E.phase === 'flight') { const m = PLAY.msg; ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,243,214,0.75)'; ctx.font = `600 ${Math.round(PLAY.fonts.info)}px ${FONT}`; ctx.fillText('touch and hold to speed up', m.x + m.w / 2, m.y + m.h * 0.6); ctx.restore(); }
  if (E.phase === 'endscore') endCard(ctx, state, E);
  if (state.toast) { const t = LY.toast; ctx.save(); ctx.fillStyle = 'rgba(12,30,22,0.92)'; roundPath(ctx, t.x, t.y, t.w, t.h, 18); ctx.fill(); ctx.fillStyle = '#ffe9bf'; ctx.font = `600 ${Math.max(24, LY.minText)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.toast, t.x + t.w / 2, t.y + t.h / 2); ctx.restore(); }
}
function drawLensOverlayIfFlat(ctx, state, E) { if (!state.v3 && !state.has3d && state.lensOn) drawLensOverlay(ctx, state, E, null); }

// ---- the flat fallback (no WebGL): sky, ridges, meadow and a painted board, with the same camera maths ----------------------------------------------------------------------
function drawLoading(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d4a66'); g.addColorStop(0.55, '#2c6a47'); g.addColorStop(1, '#12301f'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.fillStyle = 'rgba(255,243,214,0.85)'; ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(PLAY.fonts.info * 1.3)}px ${FONT}`; ctx.fillText('Preparing the valley…', W / 2, PLAY.view.y + PLAY.view.h * 0.5); ctx.restore();
}
function drawFlat(ctx, state, E) {
  const dt = Math.min(0.1, Math.max(0, state.t - (state.flatT ?? state.t))); state.flatT = state.t;
  drawFlatScene(ctx, state, E, state.viewRect, { w: W, h: H }, dt, state.t);
  ctx.save(); ctx.fillStyle = 'rgba(8,22,16,0.6)'; ctx.font = `600 ${Math.max(14, Math.round(LY.minText * 0.9))}px ${FONT}`; ctx.textAlign = 'center'; const t = 'Simple view: 3D is not available on this device'; const w = ctx.measureText(t).width + 24; const cx0 = PLAY.land ? LY.U.x0 + 12 + w / 2 : W / 2, ty = PLAY.land ? PLAY.wind.y + PLAY.wind.h + 10 : PLAY.view.y + 6; roundPath(ctx, cx0 - w / 2, ty, w, 30, 15); ctx.fill(); ctx.fillStyle = 'rgba(255,243,214,0.9)'; ctx.textBaseline = 'middle'; ctx.fillText(t, cx0, ty + 15); ctx.restore();
}
export function drawFlatBackdrop(ctx, state, E) { const dt = Math.min(0.1, Math.max(0, state.t - (state.flatT ?? state.t))); state.flatT = state.t; drawFlatScene(ctx, state, E, state.viewRect, { w: W, h: H }, dt, state.t); }
function drawLensFlat(ctx, state, E) {
  const lr = PLAY.lens; ctx.save(); ctx.beginPath(); ctx.arc(lr.cx, lr.cy, lr.r - 6, 0, 7); ctx.clip();
  const L = lensCam(E), g = ctx.createLinearGradient(0, lr.y, 0, lr.y + lr.h); g.addColorStop(0, '#8fbce6'); g.addColorStop(0.5, '#dcebf2'); g.addColorStop(0.5, '#86b05a'); g.addColorStop(1, '#6a9a44'); ctx.fillStyle = g; ctx.fillRect(lr.x, lr.y, lr.w, lr.h);
  const pt = (x, y, z) => { const p = project(L, 1, { x, y, z }); return p ? { x: lr.cx + p.x * lr.r, y: lr.cy - p.y * lr.r } : null; };
  const bz = E.dir > 0 ? RANGE : 0, a = pt(-0.14, 0, bz), b = pt(0.14, 0.91, bz);
  if (a && b) { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#8a1e14'; ctx.lineWidth = Math.max(1, w * 0.06); ctx.strokeRect(x, y, w, h); const c = pt(0, 0.62, bz); if (c) { for (const [rr, col] of [[0.115, '#1f3d6e'], [0.07, '#c42a1d'], [0.035, '#f0b830']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(c.x, c.y, (rr / 0.28) * w, 0, 7); ctx.fill(); } } }
  if (E.arrow && E.arrow.alive) { const p = pt(E.arrow.x, E.arrow.y, E.arrow.z); if (p) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); } }
  ctx.restore();
}
