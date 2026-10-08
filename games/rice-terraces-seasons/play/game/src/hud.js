// The play screen's 2D layer: gate markers, water gauges over the fields, the top bar, status pills, the plot sheet, the Think bar and the story / think cards.
// It is drawn over the 3D hillside (or over a flat fallback picture) and registers every tappable rectangle for game.js.
import { SW, H, W, OX, host, minU, hudLayout, PLAY_M, TEXT_SCALES } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, paintButton, wrapLines, panel, fitPx } from './ui.js';
import { levelById, gateList, plotName, SEASONS, CHAPTERS } from './levels.js';
import { fitCamera } from './camera.js';
import { plotPos, gatePos, HW, HD, PD } from './geom.js';
import { bandFor, gateState, jobsFor, canJob, jobCost, JOB_NAME, CROP, yearLength, yearTime } from './farm.js';
import { gateIcon, gaugeBar, SEASON_COL } from './menus.js';

export const RECTS = [];
const add = (id, r) => RECTS.push({ id, x: r.x, y: r.y, w: r.w, h: r.h });
export const hit = (x, y) => { for (let i = RECTS.length - 1; i >= 0; i--) { const r = RECTS[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id; } return null; };
export const rectOf = (id) => RECTS.find((r) => r.id === id) || null;
export const CARD = { rect: null, max: 0, view: 0 };

const WEATHER = { clear: 'Clear', rain: 'Rain', storm: 'Storm', dry: 'Dry spell' };
const TAU = Math.PI * 2;

// ---- the camera, cached per screen shape --------------------------------------------------------------------------------------
const camCache = new Map();
export function camFor(lvId, textIdx) {
  const L = hudLayout(textIdx);
  const key = `${lvId}|${SW}x${H}|${L.key}`;
  let c = camCache.get(key);
  if (!c) { c = fitCamera(levelById(lvId), SW, H, L.mapRect); c.key = key; camCache.set(key, c); if (camCache.size > 30) camCache.delete(camCache.keys().next().value); }
  return c;
}

// plot corners projected to the screen (a quad) and the centre
function plotQuad(cam, lv, i) {
  const p = plotPos(lv, i);
  const q = [[-HW, -HD], [HW, -HD], [HW, HD], [-HW, HD]].map(([dx, dz]) => cam.project({ x: p.x + dx, y: p.y, z: p.z + dz }));
  const c = cam.project({ x: p.x, y: p.y, z: p.z });
  return { q, c };
}
const inQuad = (q, x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; const cr = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x); s += cr >= 0 ? 1 : -1; } return Math.abs(s) === 4; };

// what a tap at (x, y) on the hillside means: a gate id ('g:f0'), a plot ('p:3') or nothing
export function pickMap(G, x, y) {
  const lv = G.lv, cam = camFor(lv.id, G.settings.textIdx);
  const mpx = Math.abs(cam.project({ x: 1, y: 0, z: 0 }).x - cam.project({ x: 0, y: 0, z: 0 }).x);
  const rr = Math.max(Math.min(40, mpx * 0.62), 26 / Math.max(0.2, host.px));
  // gate markers win inside their drawn disc; then a tap inside a field selects the field; the wider forgiving ring around a marker only applies outside every field
  const vr = Math.max(22, 12 / Math.max(0.2, host.px), Math.min(36, mpx * 0.55));
  const gateNear = (lim) => {
    let best = null;
    for (const g of gateList(lv)) {
      const p = cam.project(gatePos(lv, g));
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= lim && (!best || d < best.d)) best = { id: `g:${g.id}`, d };
    }
    return best;
  };
  const core = gateNear(vr * 1.05);
  if (core) return core.id;
  let pb = null;
  for (let i = 0; i < lv.R * lv.C; i++) { const { q, c } = plotQuad(cam, lv, i); if (inQuad(q, x, y)) { const d = Math.hypot(c.x - x, c.y - y); if (!pb || d < pb.d) pb = { id: `p:${i}`, d }; } }
  if (pb) return pb.id;
  const wide = gateNear(rr * 1.25);
  if (wide) return wide.id;
  return null;
}

let PM = 1;
function pill(ctx, r, text, sub, accent = '#f0c455', fs0 = 22) {
  const fs = Math.max(Math.round(fs0 * PM), Math.ceil(13 / Math.max(0.2, host.px)));
  roundPath(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = 'rgba(8,22,14,0.78)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(243,246,234,0.35)'; ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let px = fs; ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText(text).width > r.w - 14 && px > Math.max(12, minU())) { px--; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillStyle = accent; ctx.fillText(text, r.x + r.w / 2, r.y + r.h * (sub ? 0.36 : 0.5));
  if (sub) {
    let sp = Math.max(minU(), Math.round(fs * 0.72)); ctx.font = `400 ${sp}px ${FONT}`;
    while (ctx.measureText(sub).width > r.w - 12 && sp > minU()) { sp--; ctx.font = `400 ${sp}px ${FONT}`; }
    ctx.fillStyle = 'rgba(243,246,234,0.85)'; ctx.fillText(sub, r.x + r.w / 2, r.y + r.h * 0.74);
  }
  ctx.textBaseline = 'alphabetic';
}

function drawBadge(ctx, cx, cy, r, col, txt) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(r * 1.15)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, cx, cy + 1); ctx.textBaseline = 'alphabetic';
}

// ---- the hillside overlay: gauges, badges and gate markers --------------------------------------------------------------------------
function drawMap(ctx, G, cam) {
  const lv = G.lv, f = G.farm.f, L = hudLayout(G.settings.textIdx);
  const mpx = Math.abs(cam.project({ x: 1, y: 0, z: 0 }).x - cam.project({ x: 0, y: 0, z: 0 }).x);
  const t = G.t;
  const running = f.ph === 'run';
  // plots
  for (let i = 0; i < lv.R * lv.C; i++) {
    const p = f.plots[i], { q, c } = plotQuad(cam, lv, i);
    const sel = G.sel === i, focus = G.focus && G.focus.includes(i);
    if (sel || focus) {
      ctx.save(); ctx.beginPath(); q.forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y))); ctx.closePath();
      const pul = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.lineWidth = sel ? 4 : 3 + pul * 2; ctx.strokeStyle = sel ? '#ffe28a' : `rgba(255,150,120,${0.6 + 0.4 * pul})`; ctx.setLineDash(sel ? [] : [10, 7]); ctx.stroke();
      if (focus) { ctx.fillStyle = `rgba(255,150,120,${0.1 + 0.1 * pul})`; ctx.fill(); }
      ctx.restore();
    }
    // gauge under the centre
    const gw = Math.max(56, Math.min(150, mpx * HW * 1.15)), gh = Math.max(12, Math.min(20, gw * 0.15));
    const gx = c.x - gw / 2, gy = c.y - mpx * 0.55 - gh / 2;
    const b = bandFor(f, i);
    gaugeBar(ctx, gx, gy, gw, gh, p.w, b);
    ctx.font = `700 ${Math.max(Math.round(gh * 0.95), minU())}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = p.owner ? '#ffc78a' : '#f3f6ea'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 4;
    ctx.fillText(`${plotName(lv, i)}${p.owner ? ' \u00b7 N' : ''}`, c.x, gy - 4); ctx.restore();
    // action badges
    const badges = [];
    if (!p.owner && running) {
      const jobs = jobsFor(f, i);
      if (jobs.includes('harvest')) badges.push(['#e0a82a', 'H']);
      else if (jobs.includes('plant')) badges.push(['#3d9a54', 'P']);
      if (jobs.includes('repair')) badges.push(['#c1583a', 'R']);
      if (jobs.includes('pests')) badges.push(['#7a4aa8', 'S']);
      if (jobs.includes('tend')) badges.push(['#7f9a2e', 'W']);
    } else if (p.owner && p.wall < 0.5 && running) badges.push(['#c1583a', 'R']);
    const br = Math.max(10, Math.min(16, gh * 0.8));
    badges.forEach((bd, k) => drawBadge(ctx, c.x - (badges.length - 1) * br * 1.1 + k * br * 2.2, c.y - mpx * 0.55 + gh + br + 8, br, bd[0], bd[1]));
    if (p.job) { // job progress ring
      const u = 1 - p.job.left / p.job.total;
      ctx.beginPath(); ctx.arc(c.x, gy - gh - 14, 11, -Math.PI / 2, -Math.PI / 2 + u * TAU); ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 5; ctx.stroke();
    }
    if (G.floaters) for (const fl of G.floaters) if (fl.plot === i && t - fl.t0 < 1.6) {
      const u = (t - fl.t0) / 1.6; ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = fl.col; ctx.font = `800 ${Math.max(22, minU())}px ${FONT}`; ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 5; ctx.fillText(fl.text, c.x, gy - 28 - u * 46); ctx.restore();
    }
  }
  // gates
  const r = Math.max(22, 12 / Math.max(0.2, host.px), Math.min(36, mpx * 0.55));
  for (const g of gateList(lv)) {
    const st = gateState(f, g), p = cam.project(gatePos(lv, g));
    const flow = (g.kind === 'f' ? f.flows.f[g.id] : g.kind === 'd' ? f.flows.d[g.id] : Math.abs(f.flows.s[g.id] || 0)) || 0;
    if (st === 1 && flow > 0.05) { ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8); ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.35, 0, TAU); ctx.strokeStyle = '#8be9ff'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
    gateIcon(ctx, p.x, p.y, st === -1 ? r * 0.7 : r, st === 1, st === -1);
    if (G.hl === `g:${g.id}`) { ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.5, 0, TAU); ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 4; ctx.stroke(); }
    if (G.focusGate === g.id) { const pul = 0.5 + 0.5 * Math.sin(t * 7); ctx.beginPath(); ctx.arc(p.x, p.y, r * (1.5 + pul * 0.35), 0, TAU); ctx.strokeStyle = `rgba(255,170,120,${0.7 + 0.3 * pul})`; ctx.lineWidth = 5; ctx.stroke(); }
  }
}

// ---- the flat fallback picture (no WebGL) ------------------------------------------------------------------------------------------
export function renderFallback(ctx, G) {
  const lv = G.lv;
  if (!lv || !G.farm.f) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9cc9dc'); g.addColorStop(1, '#3f6f3f'); ctx.fillStyle = g; ctx.fillRect(0, 0, SW, H); return; }
  const f = G.farm.f, cam = camFor(lv.id, G.settings.textIdx);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a5cfe2'); g.addColorStop(0.5, '#b9d8a8'); g.addColorStop(1, '#4d7b3b'); ctx.fillStyle = g; ctx.fillRect(0, 0, SW, H);
  for (let r = lv.R - 1; r >= 0; r--) for (let c = 0; c < lv.C; c++) {
    const i = r * lv.C + c, p = f.plots[i], { q } = plotQuad(cam, lv, i);
    ctx.beginPath(); q.forEach((pt, k) => (k ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y))); ctx.closePath();
    const gold = p.crop === CROP.GOLD, grow = p.crop === CROP.GROWING || p.crop === CROP.SEEDLING;
    ctx.fillStyle = p.w > 0.6 ? `rgba(${60 - p.w * 6},${130 + p.w * 10},${160 + p.w * 10},1)` : '#7a5b3a'; ctx.fill();
    if (grow || gold) { ctx.fillStyle = gold ? 'rgba(230,185,62,0.85)' : `rgba(70,160,70,${0.35 + 0.5 * p.prog})`; ctx.fill(); }
    ctx.lineWidth = 3; ctx.strokeStyle = '#6d6a5e'; ctx.stroke();
  }
}

// ---- the play HUD ---------------------------------------------------------------------------------------------------------------------
function paintBar(ctx, r, f, lv, L) {
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = 'rgba(8,22,14,0.8)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(243,246,234,0.35)'; ctx.stroke();
  const sn = SEASONS[Math.min(3, f.season)];
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const fs = Math.round(r.h * 0.3), cx = r.x + 16;
  ctx.font = `800 ${fs}px ${DISPLAY}`; ctx.fillStyle = SEASON_COL[Math.min(3, f.season)];
  ctx.fillText(sn.name.toUpperCase(), cx, r.y + r.h * 0.3);
  let sp = Math.max(minU(), Math.ceil(12.5 / Math.max(0.2, host.px)), Math.round(fs * 0.62)); ctx.font = `400 ${sp}px ${FONT}`; ctx.fillStyle = 'rgba(243,246,234,0.88)';
  const sub = `Year ${lv.year} · ${lv.name}`;
  while (ctx.measureText(sub).width > r.w - 28 && sp > minU()) { sp--; ctx.font = `400 ${sp}px ${FONT}`; }
  if (ctx.measureText(sub).width > r.w - 28) { ctx.fillText(`Year ${lv.year}`, cx, r.y + r.h * 0.57); } else
  ctx.fillText(sub, cx, r.y + r.h * 0.57);
  // four season segments
  const bx = r.x + 14, bw = r.w - 28, by = r.y + r.h - Math.max(10, r.h * 0.17), bh = Math.max(6, r.h * 0.1);
  let xx = bx; const total = yearLength();
  SEASONS.forEach((s, k) => {
    const sw = (s.len / total) * bw, done = k < f.season ? 1 : k === f.season ? Math.min(1, f.st / s.len) : 0;
    roundPath(ctx, xx + 1, by, sw - 2, bh, bh / 2); ctx.fillStyle = 'rgba(243,246,234,0.2)'; ctx.fill();
    if (done > 0) { roundPath(ctx, xx + 1, by, Math.max(bh, (sw - 2) * done), bh, bh / 2); ctx.fillStyle = SEASON_COL[k]; ctx.fill(); }
    xx += sw;
  });
  ctx.textBaseline = 'alphabetic';
}
function pauseIcon(ctx, r) {
  const w = r.w * 0.12, hh = r.h * 0.36;
  ctx.fillStyle = '#fbfff6'; roundPath(ctx, r.x + r.w / 2 - w * 1.5, r.y + r.h / 2 - hh / 2, w, hh, 3); ctx.fill(); roundPath(ctx, r.x + r.w / 2 + w * 0.5, r.y + r.h / 2 - hh / 2, w, hh, 3); ctx.fill();
}

function statBar(ctx, x, y, w, h, v, col, label, fs) {
  ctx.font = `600 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(243,246,234,0.92)'; ctx.fillText(label, x, y + h * 0.9);
}

function sheetBody(ctx, G, f, lv, L, r) {
  const m = L.m0, fs = Math.max(Math.round(22 * Math.min(m, 1.9)), Math.ceil(12.5 / Math.max(0.2, host.px)));
  const pad = 16;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, fill: 'rgba(8,22,14,0.86)', stroke: 'rgba(243,246,234,0.35)', shadow: false });
  ctx.save(); ctx.beginPath(); ctx.rect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  if (G.sel === null || G.sel === undefined || !f.plots[G.sel]) {
    ctx.fillStyle = '#f0c455'; ctx.font = `800 ${Math.round(fs * 1.1)}px ${FONT}`; ctx.fillText(SEASONS[Math.min(3, f.season)].name, r.x + pad, r.y + pad + fs);
    ctx.fillStyle = 'rgba(243,246,234,0.92)'; ctx.font = `400 ${fs}px ${FONT}`;
    const lines = wrapLines(ctx, G.coach || `${SEASONS[Math.min(3, f.season)].blurb} Tap a round gate to open or close it. Tap a field to see what it needs.`, r.w - pad * 2);
    lines.forEach((l, k) => ctx.fillText(l, r.x + pad, r.y + pad + fs * 2.4 + k * fs * 1.25));
    // the legend: what the marks on the hillside mean
    let ly = r.y + pad + fs * 2.4 + lines.length * fs * 1.25 + fs * 0.5;
    const lfs = Math.max(minU(), Math.round(fs * 0.82)), ir = Math.round(lfs * 0.75);
    const items = [['gate', true, 'open gate: water passes'], ['gate', false, 'closed gate: water held'], ['b', '#3d9a54', 'P', 'ready to plant'], ['b', '#e0a82a', 'H', 'ready to harvest'], ['b', '#c1583a', 'R', 'wall needs repair'], ['b', '#7a4aa8', 'S', 'snails'], ['b', '#7f9a2e', 'W', 'weeds']];
    ctx.font = `400 ${lfs}px ${FONT}`;
    const colsN = r.w > 470 ? 2 : 1, cw = (r.w - pad * 2) / colsN;
    items.forEach((it, k) => {
      const cx = r.x + pad + (k % colsN) * cw, cy = ly + Math.floor(k / colsN) * (ir * 2.3);
      if (cy + ir > r.y + r.h - 8) return;
      if (it[0] === 'gate') gateIcon(ctx, cx + ir, cy + ir * 0.4, ir, it[1], false); else drawBadge(ctx, cx + ir, cy + ir * 0.4, ir * 0.8, it[1], it[2]);
      ctx.fillStyle = 'rgba(243,246,234,0.9)'; ctx.textAlign = 'left'; ctx.fillText(it[it.length - 1], cx + ir * 2.4, cy + ir * 0.4 + lfs * 0.35);
    });
    ctx.restore(); return;
  }
  const i = G.sel, p = f.plots[i], b = bandFor(f, i);
  ctx.fillStyle = '#f0c455'; ctx.font = `800 ${Math.round(fs * 1.15)}px ${FONT}`;
  ctx.fillText(`Field ${plotName(lv, i)}${p.owner ? '  (neighbour)' : ''}`, r.x + pad, r.y + pad + fs);
  const crop = ['Fallow', 'Seedlings', 'Growing', 'Golden', 'Harvested', 'Lost'][p.crop];
  ctx.fillStyle = 'rgba(243,246,234,0.9)'; ctx.font = `600 ${fs}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(crop, r.x + r.w - pad, r.y + pad + fs); ctx.textAlign = 'left';
  // water gauge with the band
  const gy = r.y + pad + fs * 1.6, gh = Math.round(fs * 0.95);
  ctx.font = `600 ${Math.round(fs * 0.9)}px ${FONT}`; ctx.fillStyle = 'rgba(243,246,234,0.95)';
  const bandTxt = b ? `wants ${b[0]} to ${b[1]}` : 'no water needed';
  ctx.fillText(`Water ${p.w.toFixed(1)}  ·  ${bandTxt}`, r.x + pad, gy + fs * 0.35);
  gaugeBar(ctx, r.x + pad, gy + fs * 0.6, r.w - pad * 2, gh, p.w, b);
  // small stats
  const sy = gy + fs * 0.6 + gh + fs * 1.0;
  const stats = [['Soil', p.soil, '#a67c52'], ['Health', p.h, '#6ac26a'], ['Wall', p.wall, p.wall < 0.35 ? '#e0603f' : '#b9b09a'], ['Weeds', p.weed, '#9bb33a'], ['Snails', p.pest, '#9a62c8']];
  const sfs = Math.max(minU(), Math.round(fs * 0.78));
  ctx.font = `600 ${sfs}px ${FONT}`;
  const labW = Math.max(...stats.map((q) => ctx.measureText(q[0]).width)) + 18;
  const cols = Math.max(2, Math.min(5, Math.floor((r.w - pad * 2) / labW))), cw = (r.w - pad * 2) / cols;
  stats.forEach(([nm, v, col], k) => {
    const cx = r.x + pad + (k % cols) * cw, cy = sy + Math.floor(k / cols) * (sfs * 1.9);
    ctx.font = `600 ${sfs}px ${FONT}`; ctx.fillStyle = 'rgba(243,246,234,0.9)'; ctx.fillText(nm, cx, cy);
    roundPath(ctx, cx, cy + 4, cw - 14, sfs * 0.5, sfs * 0.25); ctx.fillStyle = 'rgba(243,246,234,0.2)'; ctx.fill();
    roundPath(ctx, cx, cy + 4, Math.max(sfs * 0.5, (cw - 14) * Math.max(0, Math.min(1, v))), sfs * 0.5, sfs * 0.25); ctx.fillStyle = col; ctx.fill();
  });
  ctx.restore();
  // job buttons along the bottom of the sheet
  const jobs = ['plant', 'tend', 'pests', 'harvest', 'repair'].filter((j) => jobsFor(f, i).includes(j));
  const by = r.y + r.h - Math.max(L.minTap, Math.round(54 * Math.min(m, 1.4))) - 10, bh = Math.max(L.minTap, Math.round(54 * Math.min(m, 1.4)));
  if (!jobs.length) {
    ctx.save(); ctx.fillStyle = 'rgba(243,246,234,0.7)'; ctx.font = `400 ${Math.round(fs * 0.9)}px ${FONT}`; ctx.textAlign = 'left';
    const msg = p.owner ? 'A neighbour tends this field.' : f.ph === 'run' ? 'No job to do here right now.' : '';
    let jf = Math.round(fs * 0.9); while (jf > 11 && ctx.measureText(msg).width > r.w - pad * 2) { jf--; ctx.font = `400 ${jf}px ${FONT}`; }
    ctx.fillText(msg, r.x + pad, r.y + r.h - 18); ctx.restore();
    return;
  }
  const n = jobs.length, bw = (r.w - pad * 2 - (n - 1) * 8) / n;
  jobs.forEach((j, k) => {
    const rect = { x: r.x + pad + k * (bw + 8), y: by, w: bw, h: bh };
    const ok = canJob(f, i, j);
    drawButton(ctx, rect, JOB_NAME[j], { primary: ok.ok, disabled: !ok.ok, sub: `${jobCost(f, i, j)} labour`, size: Math.round(fs * 0.95) });
    add(`job:${j}`, rect);
  });
}

export function renderHud(ctx, G, v) {
  RECTS.length = 0;
  if (!G.lv || !G.farm.f) return;
  const f = G.farm.f, lv = G.lv, L = hudLayout(G.settings.textIdx), cam = camFor(lv.id, G.settings.textIdx);
  PM = Math.min(L.m0, 2);
  const watch = G.mode === 'watch';
  if (!G.card) drawMap(ctx, G, cam);
  // top bar
  paintBar(ctx, L.banner, f, lv, L);
  const pr = paintButton(ctx, L.pauseB, { dark: true }); pauseIcon(ctx, { ...L.pauseB, y: L.pauseB.y + pr.dy });
  add(watch ? 'w-pause' : 'pause', L.pauseB);
  if (watch) {
    drawButton(ctx, L.speedB, G.watch.paused ? 'Resume' : 'Pause', { dark: true, size: Math.round(24 * Math.min(L.m0, 1.9)) });
    ctx.save(); ctx.fillStyle = '#ffd98a'; ctx.font = `700 ${Math.max(minU(), 18)}px ${FONT}`; ctx.textAlign = 'center'; ctx.restore();
    add('w-pause', L.speedB);
  } else { drawButton(ctx, L.speedB, `${G.speed}x`, { dark: true, size: Math.round(30 * Math.min(L.m0, 1.9)) }); add('speed', L.speedB); }
  // pills
  const wk = f.weather.kind;
  const mine = f.plots.filter((p) => !p.owner), done = mine.filter((p) => p.crop === CROP.DONE).length;
  pill(ctx, L.pills[0], WEATHER[wk], wk === 'clear' ? 'sunny' : `${Math.ceil(f.weather.left)} s`, wk === 'storm' ? '#ff9a7a' : wk === 'dry' ? '#ffd27a' : wk === 'rain' ? '#8be9ff' : '#f3f6ea');
  pill(ctx, L.pills[1], `Labour ${Math.floor(f.lab)}`, PM > 1.25 ? `${f.jobs.length}/${f.farmers} busy` : `of ${f.labCap}  ·  ${f.jobs.length}/${f.farmers} busy`, f.lab < 1 ? '#ff9a7a' : '#a9dc7a');
  pill(ctx, L.pills[2], `Spring ${f.springNow.toFixed(1)}`, f.feed.some((x) => x === 1) ? (PM > 1.25 ? 'flowing' : 'water flowing') : (PM > 1.25 ? 'gates shut' : 'feed gates shut'), f.feed.some((x) => x === 1) ? '#8be9ff' : '#ff9a7a');
  pill(ctx, L.pills[3], `Harvest ${done}/${mine.length}`, lv.valleyNeed ? `valley ${Math.min(100, Math.round(f.released / lv.valleyNeed * 100))}%` : 'your fields', '#f0c455');
  // the plot sheet and the Think bar
  const hideSheet = G.card || G.thinkCard || (watch && G.watch.card);
  if (G.card) { /* the story: the picture shows the storyteller, nothing else competes */ }
  if (!hideSheet) { add('sheet', L.sheet); sheetBody(ctx, G, f, lv, L, L.sheet); }
  if (!watch && !G.card) {
    const ok = f.ph === 'run';
    drawButton(ctx, L.thinkB, 'Think', { primary: ok, disabled: !ok, sub: 'What would a farmer do now?', size: Math.round(30 * Math.min(L.m0, 1.9)) });
    add('think', L.thinkB);
  }
  if (watch) {
    drawButton(ctx, { x: L.thinkB.x, y: L.thinkB.y, w: L.thinkB.w * 0.3, h: L.thinkB.h }, 'Slower', { dark: true, size: 24 }); add('w-slower', { x: L.thinkB.x, y: L.thinkB.y, w: L.thinkB.w * 0.3, h: L.thinkB.h });
    const fast = { x: L.thinkB.x + L.thinkB.w * 0.34, y: L.thinkB.y, w: L.thinkB.w * 0.3, h: L.thinkB.h };
    drawButton(ctx, fast, 'Faster', { dark: true, size: 24 }); add('w-faster', fast);
    const quit = { x: L.thinkB.x + L.thinkB.w * 0.68, y: L.thinkB.y, w: L.thinkB.w * 0.32, h: L.thinkB.h };
    drawButton(ctx, quit, 'Quit', { dark: true, size: 24 }); add('w-quit', quit);
  }
  // cards
  if (G.card) drawStoryCard(ctx, G, L);
  else if (G.thinkCard) drawThinkCard(ctx, G, L, G.thinkCard, false);
  else if (watch && G.watch.card) drawThinkCard(ctx, G, L, G.watch.card, true);
  // year-start prompt over the hillside is the story card; nothing else needed
}

function cardRect(L, want, watch) {
  if (L.land) return { x: L.sheet.x, y: L.pills[3].y + L.pills[3].h + 10, w: L.sheet.w, h: L.thinkB.y - 10 - (L.pills[3].y + L.pills[3].h + 10) };
  const maxH = Math.round(H * 0.5), minH = Math.round(H * 0.22);
  const h = Math.round(Math.max(minH, Math.min(maxH, want || maxH)));
  return { x: L.thinkB.x, y: (watch ? L.thinkB.y - 8 : H - host.b - 8) - h, w: L.thinkB.w, h };
}

const paraLines = (ctx, text, w) => { const out = []; String(text).split('\n').forEach((para) => { if (!para.trim()) out.push(''); else wrapLines(ctx, para, w).forEach((l) => out.push(l)); }); return out; };
function textBlock(ctx, r, text, fs, scroll, color = 'rgba(243,246,234,0.95)') {
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = color; ctx.font = `400 ${fs}px ${FONT}`; ctx.textAlign = 'left';
  const lines = paraLines(ctx, text, r.w - 14), lh = fs * 1.28;
  lines.forEach((l, k) => { const y = r.y + fs + k * lh - scroll; if (l && y > r.y - lh && y < r.y + r.h + lh) ctx.fillText(l, r.x, y); });
  ctx.restore();
  return lines.length * lh + fs * 0.4;
}
// height a card needs for its text (measured with the same font), so short cards stay short and the picture stays visible
function needH(ctx, L, text, fs, extra) {
  ctx.font = `400 ${fs}px ${FONT}`;
  const w = (L.land ? L.sheet.w : L.thinkB.w) - 36 - 14;
  return paraLines(ctx, text, w).length * fs * 1.28 + fs * 0.4 + extra;
}

function drawStoryCard(ctx, G, L) {
  const c = G.card, m = L.m0, fs = Math.round(24 * Math.min(m, 2.2));
  const bh0 = Math.max(L.minTap + 8, Math.round(66 * Math.min(m, 1.4)));
  const r = cardRect(L, needH(ctx, L, c.text, fs, 18 * 2 + fs * 2.9 + bh0 + 16));
  panel(ctx, r.x, r.y, r.w, r.h, { r: 26, fill: 'rgba(10,28,18,0.93)', stroke: 'rgba(240,196,85,0.7)', shadow: true });
  const pad = 18;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f0c455'; ctx.font = `800 ${Math.round(fs * 1.25)}px ${DISPLAY}`; ctx.fillText(c.title, r.x + pad, r.y + pad + fs * 1.1);
  ctx.fillStyle = '#a9dc7a'; ctx.font = `600 ${Math.round(fs * 0.85)}px ${FONT}`; { let wf = Math.round(fs * 0.85), wt = c.who ? `${c.who}, ${c.role}` : ''; const fl = Math.ceil(12.5 / Math.max(0.2, host.px)); ctx.font = `600 ${wf}px ${FONT}`;
    while (wf > fl && ctx.measureText(wt).width > r.w - pad * 2) { wf--; ctx.font = `600 ${wf}px ${FONT}`; }
    if (ctx.measureText(wt).width > r.w - pad * 2) wt = c.who || '';
    ctx.fillText(wt, r.x + pad, r.y + pad + fs * 2.3); }
  const bh = Math.max(L.minTap + 8, Math.round(66 * Math.min(m, 1.4))), tb = { x: r.x + pad, y: r.y + pad + fs * 2.9, w: r.w - pad * 2, h: r.h - pad * 2 - fs * 2.9 - bh - 8 };
  const total = textBlock(ctx, tb, c.text, fs, G.ui.cardScroll || 0);
  CARD.rect = tb; CARD.max = Math.max(0, total - tb.h); CARD.view = tb.h;
  if (CARD.max > 0) { ctx.save(); ctx.fillStyle = 'rgba(240,196,85,0.9)'; ctx.font = `700 ${Math.max(minU(), 18)}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText('▼ drag for more', tb.x + tb.w, tb.y + tb.h + 2); ctx.restore(); }
  const btn = { x: r.x + pad, y: r.y + r.h - pad - bh, w: r.w - pad * 2, h: bh };
  drawButton(ctx, btn, c.button || 'Continue', { primary: true, size: Math.round(30 * Math.min(m, 1.3)) });
  add('card-go', btn);
}

function drawThinkCard(ctx, G, L, tc, watch) {
  const m = L.m0, fs = Math.round(22 * Math.min(m, 2.2)), pad = 16;
  const bh0 = watch ? 0 : Math.max(L.minTap + 4, Math.round(60 * Math.min(m, 1.4)));
  const r = cardRect(L, needH(ctx, L, tc.text, fs, pad * 2 + fs * (watch ? 1.5 : 0) + fs * 2.6 + (bh0 ? bh0 + 8 : 0)), watch);
  panel(ctx, r.x, r.y, r.w, r.h, { r: 26, fill: 'rgba(10,28,18,0.94)', stroke: watch ? 'rgba(127,214,194,0.8)' : 'rgba(240,196,85,0.7)', shadow: true });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let ty = r.y + pad;
  if (watch) {
    const w = G.watch, nm = { think: 'THINK', reveal: 'REVEAL', act: 'ACT' }[w.phase] || '';
    ctx.fillStyle = { think: '#ffd98a', reveal: '#7fd6c2', act: '#ff9a86' }[w.phase] || '#fff'; ctx.font = `800 ${Math.round(fs * 0.95)}px ${FONT}`; ctx.fillText(w.paused ? `PAUSED · ${nm}` : nm, r.x + pad, ty + fs);
    const lw = ctx.measureText(w.paused ? `PAUSED \u00b7 ${nm}` : nm).width, bx = r.x + pad + lw + 16, bw = r.x + r.w - pad - bx, by = ty + fs * 0.45, tot = w.phase === 'think' ? G.thinkTotal : 2;
    roundPath(ctx, bx, by, bw, 12, 6); ctx.fillStyle = 'rgba(243,246,234,0.2)'; ctx.fill();
    roundPath(ctx, bx, by, Math.max(12, bw * Math.max(0, Math.min(1, 1 - w.timer / tot))), 12, 6); ctx.fillStyle = '#7fd6c2'; ctx.fill();
    ty += fs * 1.5;
  }
  ctx.fillStyle = '#f0c455'; ctx.font = `800 ${Math.round(fs * 1.1)}px ${FONT}`;
  const tl = wrapLines(ctx, tc.title, r.w - pad * 2);
  tl.forEach((l, k) => ctx.fillText(l, r.x + pad, ty + fs * (1.1 + k * 1.2)));
  ty += fs * 1.2 * tl.length + fs * 0.5;
  const bh = watch ? 0 : Math.max(L.minTap + 4, Math.round(60 * Math.min(m, 1.4)));
  const tb = { x: r.x + pad, y: ty, w: r.w - pad * 2, h: r.y + r.h - pad - ty - (bh ? bh + 8 : 0) };
  const total = textBlock(ctx, tb, tc.text, fs, G.ui.cardScroll || 0);
  CARD.rect = tb; CARD.max = Math.max(0, total - tb.h); CARD.view = tb.h;
  if (!watch) {
    const b1 = { x: r.x + pad, y: r.y + r.h - pad - bh, w: (r.w - pad * 2) * 0.58 - 4, h: bh };
    const b2 = { x: b1.x + b1.w + 8, y: b1.y, w: r.w - pad * 2 - b1.w - 8, h: bh };
    const can = tc.kind !== 'wait';
    drawButton(ctx, b1, can ? 'Do it' : 'OK', { primary: true, size: Math.round(28 * Math.min(m, 1.3)) }); add(can ? 'think-do' : 'think-close', b1);
    drawButton(ctx, b2, 'Close', { dark: true, size: Math.round(26 * Math.min(m, 1.3)) }); add('think-close', b2);
  }
}
