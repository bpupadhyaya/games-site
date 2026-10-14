// Everything on the play screen that is not the road picture: rider cards, effort buttons, utility row, Watch & Learn
// panel, banners and the standings sheet.
import { TEAMS, TYPES, SLOTS, fmtGapInt, fmtTime, classification } from './sim.js';
import { drawRoadView, drawProfile } from './view.js';
import { jerseyIcon } from './art.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow } from './ui.js';
import { THINK_STEPS } from './layout.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const EFFORTS = [
  { name: 'EASE', tt: 'EASE', sub: 'recover', col: '#2fb5a8' },
  { name: 'SIT IN', tt: 'STEADY', sub: 'on the wheel', col: '#4a8fe0' },
  { name: 'PUSH', tt: 'PUSH', sub: 'press on', col: '#f2a93a' },
  { name: 'ATTACK', tt: 'ATTACK', sub: 'all out', col: '#ef4a3a' },
];
export const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

export const myRiders = (R) => R.riders.filter((r) => (R.mode === 'tt' ? r.ctl === 'human' : R.mode === 'watch' ? r.team === 0 : r.team === 0));

function frontS(R) { let m = -1e9; for (const r of R.riders) m = Math.max(m, r.s); return m; }

function drawCard(ctx, rc, st, r, selected) {
  const R = st.race, tm = TEAMS[r.team], T = TYPES[r.role];
  const small = rc.w < 190, fs = clamp(rc.w / 12.5, 13, 22);
  panel(ctx, rc.x, rc.y, rc.w, rc.h, { r: 16, fill: selected ? 'rgba(255,244,214,0.97)' : 'rgba(14,26,46,0.92)', stroke: selected ? '#ffb53a' : 'rgba(255,200,110,0.35)', shadow: false });
  const ink = selected ? '#16213a' : '#fff2d2', dim = selected ? 'rgba(22,33,58,0.7)' : 'rgba(255,242,210,0.72)';
  const js = Math.min(rc.h * 0.42, 44);
  jerseyIcon(ctx, rc.x + 10 + js * 0.55, rc.y + 8 + js * 0.6, js, tm.jersey, tm.trim, String(r.slot + 1));
  const tx = rc.x + 14 + js * 1.15;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = ink; ctx.fillText(T.label, tx, rc.y + 10 + fs * 0.85);
  const place = r.place || r.rank + 1;
  ctx.textAlign = 'right'; ctx.font = `900 ${Math.round(fs * 1.05)}px ${FONT}`; ctx.fillStyle = place <= 3 ? (selected ? '#c26a00' : '#ffc94a') : ink;
  ctx.fillText(ordinal(place), rc.x + rc.w - 10, rc.y + 10 + fs * 0.85);
  // status
  let status, scol = dim;
  const lead = frontS(R), vref = Math.max(3, r.v);
  if (r.fin !== null) { status = `Finished ${fmtTime(r.fin)}`; scol = selected ? '#1c7a3c' : '#8fe6a8'; }
  else if (r.cracked) { status = 'CRACKED: recover'; scol = '#e03a3a'; }
  else if (r.draft > 0.2) { status = `Slipstream ${Math.round(r.draft * 100)}%`; scol = selected ? '#1c6fb0' : '#8fd0ff'; }
  else if (lead - r.s < 1.5) { status = 'Leading the race'; }
  else status = `${fmtGapInt((lead - r.s) / vref)} to front`;
  ctx.textAlign = 'left'; ctx.font = `600 ${Math.round(fs * 0.82)}px ${FONT}`; ctx.fillStyle = scol; ctx.fillText(status, tx, rc.y + 12 + fs * 1.85);
  // reserve bar
  const statusBase = rc.y + 12 + fs * 1.85, lfs = Math.round(fs * 0.74);
  let bh = clamp(rc.h * 0.12, 9, 14), pad = 12;
  if (rc.y + rc.h - bh - pad - 5 - lfs * 0.75 < statusBase + 3) { bh = 8; pad = 6; }   // short cards: slim bar tucked to the bottom
  const bx = rc.x + 12, bw = rc.w - 24, by = rc.y + rc.h - bh - pad;
  const wf = r.w / r.wpMax;
  roundPath(ctx, bx, by, bw, bh, bh / 2); ctx.fillStyle = selected ? 'rgba(22,33,58,0.2)' : 'rgba(255,255,255,0.16)'; ctx.fill();
  roundPath(ctx, bx, by, Math.max(bh, bw * wf), bh, bh / 2);
  ctx.fillStyle = r.cracked ? '#ff4d4d' : wf > 0.5 ? '#46c46a' : wf > 0.2 ? '#f5b82e' : '#ef6a2a'; ctx.fill();
  ctx.textAlign = 'left'; ctx.font = `700 ${lfs}px ${FONT}`; ctx.fillStyle = dim;
  const lab = small ? `${Math.round(wf * 100)}%` : `Reserve ${Math.round(wf * 100)}%`;
  ctx.fillText(lab, bx, by - 4);
  const mn = r.fin !== null ? 'DONE' : EFFORTS[r.mode][R.mode === 'tt' ? 'tt' : 'name'];
  ctx.textAlign = 'right'; ctx.fillStyle = r.fin !== null ? dim : EFFORTS[r.mode].col; ctx.fillText(mn, bx + bw, by - 4);
}

function drawEffortRow(ctx, st, L) {
  const P = L.play, R = st.race, r = R.riders[st.sel], tt = R.mode === 'tt';
  EFFORTS.forEach((e, i) => {
    const rc = P.eff[i], active = r.mode === i && r.fin === null, dis = r.fin !== null;
    drawButton(ctx, rc, tt ? e.tt : e.name, { active, disabled: dis, sub: rc.h > 70 ? e.sub : null, size: clamp(rc.w / 7.2, 15, 26) });
    ctx.fillStyle = e.col; roundPath(ctx, rc.x + 14, rc.y + rc.h - 9, rc.w - 28, 5, 2.5); ctx.globalAlpha = dis ? 0.3 : 1; ctx.fill(); ctx.globalAlpha = 1;
  });
}

const SPEEDS = ['1×', '2×', '4×'];
function drawUtility(ctx, st, L) {
  const P = L.play, u = P.utilBtn, sz = clamp(u.pause.w / 5.2, 16, 26);
  drawButton(ctx, u.pause, st.paused ? 'Resume' : 'Pause', { size: sz });
  drawButton(ctx, u.speed, `Speed ${SPEEDS[st.speedIdx]}`, { size: sz });
  drawButton(ctx, u.hint, st.hint && st.hint.busy ? 'Thinking…' : 'Think', { size: sz, active: !!(st.hint && st.hint.busy), disabled: st.race.mode === 'tt' ? false : false });
  drawButton(ctx, u.menu, 'Menu', { size: sz, dark: true });
}

function drawDemoControls(ctx, st, L) {
  const P = L.play, d = P.demo, sz = clamp(d.pause.h * 0.3, 17, 26);
  drawButton(ctx, d.dec, 'Think −', { size: sz, disabled: st.settings.thinkIdx === 0 });
  drawButton(ctx, d.pause, st.paused ? 'Resume' : 'Pause', { size: sz + 2, primary: st.paused });
  drawButton(ctx, d.inc, 'Think +', { size: sz, disabled: st.settings.thinkIdx === THINK_STEPS.length - 1 });
  // explanation panel where the effort buttons usually are
  const ex = P.explain;
  panel(ctx, ex.x, ex.y, ex.w, ex.h, { r: 16, fill: 'rgba(10,20,38,0.94)', stroke: 'rgba(255,200,110,0.5)', shadow: false });
  const e = st.explain;
  if (e) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let fs = clamp(ex.h / 5.6, 14, 21);
    ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#ffd27a';
    let y = ex.y + 10 + fs;
    for (const l of wrapLines(ctx, e.head, ex.w - 28).slice(0, 2)) { ctx.fillText(l, ex.x + 14, y); y += fs * 1.2; }
    ctx.font = `500 ${Math.round(fs * 0.9)}px ${FONT}`; ctx.fillStyle = 'rgba(255,244,220,0.92)';
    for (const l of e.lines) for (const w of wrapLines(ctx, l, ex.w - 28).slice(0, 1)) { if (y > ex.y + ex.h - 6) break; ctx.fillText(w, ex.x + 14, y); y += fs * 1.12; }
    if (st.think) {
      const th = st.think, f = clamp(th.t / th.dur, 0, 1), bw = ex.w - 28;
      roundPath(ctx, ex.x + 14, ex.y + ex.h - 12, bw, 5, 2.5); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill();
      roundPath(ctx, ex.x + 14, ex.y + ex.h - 12, Math.max(5, bw * f), 5, 2.5); ctx.fillStyle = th.phase === 'think' ? '#4a8fe0' : '#ffb53a'; ctx.fill();
    }
  }
  drawButton(ctx, P.demoExit, 'Leave', { dark: true, size: 20 });
}

function drawPill(ctx, st, L) {
  const R = st.race, P = L.play;
  if (R.mode === 'watch' || R.mode === 'tt') return;
  const mine = myRiders(R), best = Math.min(...mine.map((r) => r.place || r.rank + 1));
  const txt = `Best rider: ${ordinal(best)} of ${R.riders.length}`;
  ctx.font = `800 17px ${FONT}`;
  const w = ctx.measureText(txt).width + 30;
  roundPath(ctx, P.pill.x - w / 2, P.pill.y - 16, w, 32, 16); ctx.fillStyle = 'rgba(8,14,28,0.8)'; ctx.fill();
  ctx.fillStyle = best <= 3 ? '#ffd27a' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, P.pill.x, P.pill.y + 1);
}

function drawToast(ctx, st, L) {
  if (st.toastT <= 0 || !st.toast) return;
  const P = L.play.toast, a = clamp(st.toastT / 0.4, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  ctx.font = `700 20px ${FONT}`;
  const lines = wrapLines(ctx, st.toast, P.maxW - 36), lh = 26, h = lines.length * lh + 20, w = Math.min(P.maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36);
  roundPath(ctx, P.x - w / 2, P.y, w, h, 14); ctx.fillStyle = 'rgba(8,14,28,0.88)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,200,110,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff6e2'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, P.x, P.y + 14 + 20 + i * lh - 6));
  ctx.restore();
}

function drawBanner(ctx, st, L) {
  const b = st.banner;
  if (!b) return;
  const rc = L.play.road, t = b.t, a = t < 0.2 ? t / 0.2 : t > b.dur - 0.5 ? clamp((b.dur - t) / 0.5, 0, 1) : 1;
  const sc = 1 + (t < 0.25 ? (0.25 - t) * 1.6 : 0);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(rc.x + rc.w / 2, rc.y + rc.h * 0.38); ctx.scale(sc, sc);
  const u = clamp(rc.w / 720, 0.7, 1.3);
  ctx.font = `900 ${Math.round(58 * u)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 12 * u; ctx.strokeStyle = 'rgba(8,12,34,0.92)'; ctx.strokeText(b.text, 0, 0);
  ctx.fillStyle = b.color || '#ffd27a'; ctx.fillText(b.text, 0, 0);
  if (b.sub) { ctx.font = `700 ${Math.round(24 * u)}px ${FONT}`; textShadow(ctx, b.sub, 0, 46 * u, '#fff6e2', 6); }
  ctx.restore();
}

export function drawStandings(ctx, st, L) {
  const R = st.race, P = L.play;
  const w = Math.min(600, L.w - 40), h = Math.min(L.h - 150, 640), x = (L.w - w) / 2, y = Math.max(L.ins.t + 20, (L.h - h) / 2);
  ctx.fillStyle = 'rgba(4,8,22,0.6)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, x, y, w, h, { r: 26, fill: 'rgba(250,244,226,0.97)', stroke: 'rgba(40,50,90,0.7)' });
  ctx.fillStyle = C.terraDark; ctx.font = `800 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('Race order', x + w / 2, y + 52);
  const cls = classification(R), rowH = clamp((h - 150) / Math.min(cls.length, 18), 22, 36), lead = R.riders[cls[0]];
  const best = lead.fin !== null ? lead.fin : null;
  cls.slice(0, Math.floor((h - 130) / rowH)).forEach((i, k) => {
    const r = R.riders[i], yy = y + 76 + k * rowH, mine = r.team === 0 && R.mode !== 'watch';
    if (mine) { ctx.fillStyle = 'rgba(255,170,60,0.28)'; ctx.fillRect(x + 14, yy, w - 28, rowH - 2); }
    ctx.fillStyle = TEAMS[r.team].jersey; ctx.beginPath(); ctx.arc(x + 44, yy + rowH / 2, rowH * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16213a'; ctx.font = `${mine ? 800 : 600} ${Math.round(rowH * 0.58)}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${k + 1}`, x + 72, yy + rowH / 2); ctx.fillText(`${TEAMS[r.team].name} ${r.slot + 1} · ${TYPES[r.role].label}`, x + 112, yy + rowH / 2);
    ctx.textAlign = 'right';
    const g = r.fin !== null ? `${fmtTime(r.fin)}` : `${((R.L - r.s) / 1000).toFixed(1)} km`;
    ctx.fillText(g, x + w - 24, yy + rowH / 2);
  });
  ctx.fillStyle = 'rgba(40,50,90,0.75)'; ctx.font = `500 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('Tap anywhere to close', x + w / 2, y + h - 24);
}

export function renderPlay(ctx, st, L) {
  const P = L.play, R = st.race;
  ctx.fillStyle = '#0b1424'; ctx.fillRect(0, 0, L.w, L.h);
  let sx = 0, sy = 0;
  if (st.shake) { const k = (1 - st.shake.t / st.shake.dur) * st.shake.a; sx = Math.sin(st.shake.t * 90) * k; sy = Math.cos(st.shake.t * 70) * k * 0.6; }
  ctx.save(); ctx.translate(sx, sy);
  drawRoadView(ctx, st, L);
  ctx.restore();
  drawProfile(ctx, st, L);
  drawPill(ctx, st, L);
  const mine = myRiders(R);
  mine.forEach((r, i) => { if (P.cards[i]) drawCard(ctx, P.cards[i], st, r, r.id === st.sel); });
  if (R.mode === 'watch') drawDemoControls(ctx, st, L);
  else { drawEffortRow(ctx, st, L); drawUtility(ctx, st, L); }
  drawBanner(ctx, st, L);
  drawToast(ctx, st, L);
  if (st.hint && st.hint.show) drawHint(ctx, st, L);
  if (st.showStand) drawStandings(ctx, st, L);
}

function drawHint(ctx, st, L) {
  const h = st.hint, rc = L.play.road;
  const w = Math.min(rc.w - 24, 560), x = rc.x + (rc.w - w) / 2, y = rc.y + rc.h - 150;
  panel(ctx, x, y, w, 134, { r: 16, fill: 'rgba(10,20,38,0.93)', stroke: '#ffb53a', shadow: false });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 20px ${FONT}`; ctx.fillStyle = '#ffd27a'; ctx.fillText(h.head, x + 16, y + 30);
  ctx.font = `500 17px ${FONT}`; ctx.fillStyle = 'rgba(255,244,220,0.92)';
  h.lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, x + 16, y + 58 + i * 23));
}
