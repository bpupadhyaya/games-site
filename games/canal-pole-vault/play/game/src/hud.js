// The in-play screen on the 2D canvas: top strip, the beat lane, the pole dial, the grip bar, the let-go bar, the setup / result / standings cards, the
// Watch & Learn panel and the flat fallback picture used when WebGL is missing. Pure drawing from game state; game.js owns state.
import { SW, H, host, minU, hudLayout, PLAY_M } from './layout.js';
import { FONT, roundPath, drawButton, panel, wrapLines, fitPx } from './ui.js';
import { venueById, STANDS } from './venues.js';
import { LEANS, BEAT, X_IDEAL, levelById } from './jump.js';

const TAU = Math.PI * 2;
export const CARD = { rect: null, max: 0, view: 0 };
let RECTS = [];                         // clickable overlay buttons of this frame: { id, x, y, w, h }
export const hit = (x, y) => { for (let i = RECTS.length - 1; i >= 0; i--) { const r = RECTS[i]; if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.id; } return null; };
const addRect = (id, r) => { RECTS.push({ id, x: r.x, y: r.y, w: r.w, h: r.h }); return r; };

const ink = '#f4f7fa';
const gold = '#ffc857', water = '#7fd0e8', coral = '#ff8f7a', moss = '#6fcf8e';
const font = (px, w = 700) => `${w} ${Math.max(Math.round(px), minU())}px ${FONT}`;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function chip(ctx, x, y, w, h, fill = 'rgba(10,22,38,0.76)', edge = 'rgba(244,247,250,0.22)') {
  roundPath(ctx, x, y, w, h, Math.min(18, h / 2)); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = edge; ctx.stroke();
}
export const windText = (w) => `${Math.abs(w.head).toFixed(1)} m/s ${w.head >= 0 ? 'head' : 'tail'}  ·  ${Math.abs(w.cross).toFixed(1)} cross`;

// ---------------------------------------------------------------------------------------------------------------------------------
export function renderHud(ctx, G, v) {
  RECTS = [];
  const s = G.sim; if (!s) return;
  const M = PLAY_M[G.settings.textIdx];
  const L = hudLayout(G.settings.textIdx);
  G.lay = L;
  const watch = G.mode === 'watch';
  drawTop(ctx, G, s, L, M);
  if (!watch) drawPauseThink(ctx, G, L, s.ph === 'setup' || s.ph === 'run');
  if (s.ph === 'setup') drawSetup(ctx, G, s, L, M, watch);
  else if (s.ph === 'run') { drawInfo(ctx, G, s, L, M); drawControls(ctx, G, s, L, M, watch); }
  else if (s.ph === 'judge') { if (s.replay) drawReplayBadge(ctx, G, s, L); else drawResult(ctx, G, s, L, M, watch); }
  else if (s.ph === 'board') drawBoard(ctx, G, s, L, M, watch);
  if (watch) drawWatch(ctx, G, s, L, M);
  else if (G.think) drawThink(ctx, G, s, L, M);
  drawFeedback(ctx, G, s, L, M);
}

function drawTop(ctx, G, s, L, M) {
  const t = L.top, V = venueById(s.venue);
  chip(ctx, t.x, t.y, t.w, t.h);
  ctx.textBaseline = 'middle';
  const pad = 16, mid = t.y + t.h / 2, two = t.h > 70;
  const fsA = fitPx(ctx, V.name, 700, 30 * Math.min(M, 1.4), t.w * (L.land ? 0.4 : 0.52) - pad, 13);
  ctx.font = font(fsA); ctx.fillStyle = gold; ctx.textAlign = 'left';
  ctx.fillText(V.name, t.x + pad, mid - (two ? 14 : 8));
  ctx.font = font(Math.max(15, fsA * 0.72), 500); ctx.fillStyle = 'rgba(244,247,250,0.82)';
  const rnd = s.mode === 'practice' ? `Practice  ·  ${V.W} m of water` : `Jump ${Math.min(s.round + 1, s.rounds)} of ${s.rounds}  ·  ${V.W} m`;
  ctx.fillText(rnd, t.x + pad, mid + (two ? 16 : 14));
  ctx.textAlign = 'right';
  ctx.font = font(Math.max(15, fsA * 0.72), 500); ctx.fillStyle = 'rgba(244,247,250,0.82)';
  ctx.fillText('Best mark', t.x + t.w - pad, mid + (two ? 16 : 14));
  ctx.font = font(fsA * 1.15); ctx.fillStyle = ink;
  ctx.fillText(s.you.jumps.length ? `${s.you.best.toFixed(1)} m` : '-', t.x + t.w - pad, mid - (two ? 14 : 8));
  ctx.textBaseline = 'alphabetic';
}

function drawPauseThink(ctx, G, L, withThink = true) {
  drawButton(ctx, addRect('pause', L.pause), 'Pause', { dark: true, size: Math.round(L.uh * 0.4) });
  if (withThink) drawButton(ctx, addRect('think', L.think), 'Think', { dark: true, size: Math.round(L.uh * 0.4) });
}

// speed, distance, wind
function drawInfo(ctx, G, s, L, M) {
  const j = s.jump; if (!j) return;
  const f = L.info; const w = f.w * Math.min(1.25, M);
  let big, small;
  if (j.ph === 'ready' || j.ph === 'run' || j.ph === 'leap') { big = `${(j.v * 3.6).toFixed(0)} km/h`; small = j.ph === 'run' ? `${Math.max(0, X_IDEAL - j.x).toFixed(0)} m to the board` : 'Run-up'; }
  else if (j.ph === 'pole') { big = `${Math.max(0, j.r * Math.cos(j.theta) - venueById(s.venue).depth).toFixed(1)} m up`; small = `pole ${Math.round(j.theta * 57.3)}°`; }
  else { big = `${(j.px + (j.reach || 0)).toFixed(1)} m`; small = 'in the air'; }
  const px = Math.max(16, 21 * Math.min(M, 1.3));
  chip(ctx, f.x, f.y, w, px * 3.9);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = font(px * 1.5); ctx.fillStyle = ink; ctx.fillText(big, f.x + 14, f.y + px * 1.1);
  ctx.font = font(px, 500); ctx.fillStyle = gold; ctx.fillText(small, f.x + 14, f.y + px * 2.55);
  ctx.textBaseline = 'alphabetic';
  drawWindArrow(ctx, f.x + w - px * 1.6, f.y + px * 1.95, px * 1.3, s.wind);
}
function drawWindArrow(ctx, cx, cy, r, w) {
  // a head wind blows towards the runner: the arrow points left on screen; a cross wind is drawn up / down
  const ax = -w.head * 0.5, ay = w.cross * 0.5;
  const len = clamp(Math.hypot(ax, ay) / 1.6, 0.25, 1) * r;
  const a = Math.atan2(ay, ax);
  ctx.save(); ctx.translate(cx, cy);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = 'rgba(244,247,250,0.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(244,247,250,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.rotate(a); ctx.strokeStyle = water; ctx.fillStyle = water; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len * 0.7, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len * 0.55, -7); ctx.lineTo(len * 0.55, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
const lbl = (ctx, txt, x, y, col = ink, px = 24, al = 'center', maxW = 0) => { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 5; ctx.fillStyle = col; ctx.font = font(px, 700);
  if (maxW) { while (px > 12 && ctx.measureText(txt).width > maxW) { px -= 1; ctx.font = font(px, 700); } } ctx.textAlign = al; ctx.fillText(txt, x, y); ctx.restore(); };

// the beat lane: discs travel left along the lane to the ring; tap as a disc is on the ring
function drawLane(ctx, G, s, L, M, j, lvl) {
  const R = L.bar;
  chip(ctx, R.x, R.y, R.w, R.h, 'rgba(10,22,38,0.72)');
  const tx = R.x + R.w * 0.2, cy = R.y + R.h / 2, rr = R.h * 0.34;
  const pxs = (R.w * 0.76) / (BEAT * 3.2);               // pixels per second of lead time
  ctx.save();
  roundPath(ctx, R.x + 6, R.y + 6, R.w - 12, R.h - 12, R.h / 2 - 6); ctx.clip();
  if (j.inZone) {
    // plant zone: one big disc comes in with the runner; the gold band is the good window
    const t = j.boardIn, win = lvl.plant * 0.35 / Math.max(3, j.v);
    ctx.fillStyle = 'rgba(255,200,87,0.22)'; ctx.fillRect(tx - win * pxs * 1.4, R.y, win * pxs * 2.8, R.h);
    const x = tx + t * pxs * 1.4;
    ctx.beginPath(); ctx.arc(clamp(x, R.x + 10, R.x + R.w), cy, rr * 0.9, 0, TAU); ctx.fillStyle = j.zoneT > 0.14 ? gold : 'rgba(255,200,87,0.5)'; ctx.fill();
  } else {
    for (let k = 0; k < 4; k++) {
      const off = j.tb + k * BEAT;
      const x = tx + off * pxs;
      if (x < R.x + 8 || x > R.x + R.w - 8) continue;
      const near = Math.abs(off) <= lvl.beat;
      ctx.beginPath(); ctx.arc(x, cy, rr * (k === 0 ? 0.82 : 0.62), 0, TAU);
      ctx.fillStyle = near ? gold : k === 0 ? 'rgba(127,208,232,0.95)' : 'rgba(127,208,232,0.55)'; ctx.fill();
    }
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(tx, cy, rr * 1.05, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = j.inZone ? gold : 'rgba(244,247,250,0.85)'; ctx.stroke();
  ctx.fillStyle = ink; ctx.font = font(Math.max(13, R.h * 0.2), 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (j.inZone) ctx.fillText('PLANT', tx, cy + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawDial(ctx, G, s, L, M, j) {
  const D = L.dial;
  ctx.save();
  chip(ctx, D.cx - D.R - 12, D.cy - D.R - 30, D.R * 2 + 24, D.R * 2 + 60, 'rgba(10,22,38,0.55)', 'rgba(244,247,250,0.18)');
  // an arc from about -35 to +85 degrees, upright at the top
  const up = -Math.PI / 2, a0 = up - 0.62, a1 = up + 1.5;
  ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(5,11,20,0.82)';
  ctx.beginPath(); ctx.arc(D.cx, D.cy, D.R, a0, a1); ctx.stroke();
  ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(111,207,142,0.9)'; ctx.beginPath(); ctx.arc(D.cx, D.cy, D.R, up - 0.07, up + 0.07); ctx.stroke();
  const th = clamp(j.theta, -0.62, 1.5), na = up + th;
  ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(D.cx, D.cy); ctx.lineTo(D.cx + Math.cos(na) * (D.R - 8), D.cy + Math.sin(na) * (D.R - 8)); ctx.stroke();
  ctx.beginPath(); ctx.arc(D.cx, D.cy, 8, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
  // the light: green = climbing keeps the pole going over the upright, amber = wait
  const safe = j.safe && j.safe.ok;
  ctx.beginPath(); ctx.arc(D.cx, D.cy + D.R * 0.62, 11, 0, TAU); ctx.fillStyle = j.climbing ? '#58e0a4' : safe ? moss : gold; ctx.fill();
  ctx.fillStyle = 'rgba(244,247,250,0.88)'; ctx.font = font(Math.max(13, 15 * Math.min(M, 1.3)), 700); ctx.textAlign = 'center';
  ctx.fillText('POLE', D.cx, D.cy - D.R - 10);
  ctx.restore();
  // grip bar under the dial
  const g = L.stam;
  roundPath(ctx, g.x, g.y, g.w, g.h, g.h / 2); ctx.fillStyle = 'rgba(5,11,20,0.82)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,247,250,0.4)'; ctx.stroke();
  const f = clamp(j.stam, 0, 1);
  roundPath(ctx, g.x + 3, g.y + 3, Math.max(g.h - 6, (g.w - 6) * f), g.h - 6, (g.h - 6) / 2); ctx.fillStyle = f > 0.3 ? 'rgba(111,207,142,0.92)' : coral; ctx.fill();
  ctx.fillStyle = 'rgba(244,247,250,0.88)'; ctx.font = font(Math.max(13, 14 * Math.min(M, 1.3)), 700); ctx.textAlign = 'center';
  ctx.fillText('GRIP', g.x + g.w / 2, g.y + g.h + 18 * Math.min(M, 1.3));
}

function drawLetGoBar(ctx, G, s, L, M, j, guide) {
  const B = L.bar, n = LEANS.length, gap = 8, bw = (B.w - gap * (n - 1)) / n;
  const rec = guide && G.rec ? G.rec.lean : -1;
  for (let i = 0; i < n; i++) {
    const r = { x: B.x + i * (bw + gap), y: B.y, w: bw, h: B.h };
    addRect(`letgo:${i}`, r);
    drawButton(ctx, r, LEANS[i].name, { primary: i === 2 && rec < 0, active: i === rec, dark: i !== 2 && i !== rec, size: Math.max(15, Math.round(B.h * 0.24)) });
    // a small arrow showing the launch angle
    const ph = LEANS[i].phi * Math.PI / 180, cx = r.x + bw / 2, cy = r.y + B.h * 0.2, ll = Math.min(bw * 0.3, 22);
    ctx.save(); ctx.strokeStyle = i === 2 || i === rec ? '#fff' : water; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - ll * Math.cos(ph), cy + ll * Math.sin(ph)); ctx.lineTo(cx + ll * Math.cos(ph), cy - ll * Math.sin(ph)); ctx.stroke(); ctx.restore();
  }
  lbl(ctx, 'LET GO  ·  pick your lean', B.x + B.w / 2, B.y - 10, ink, Math.max(14, 18 * Math.min(M, 1.3)));
}

function drawControls(ctx, G, s, L, M, watch) {
  const j = s.jump; if (!j) return;
  const lvl = levelById(s.level);
  const mid = L.mid, mm = Math.min(M, 1.2);
  if (j.ph === 'ready') {
    lbl(ctx, 'TAP to start the run', mid.x, mid.y, ink, 36 * mm);
    lbl(ctx, 'then tap on every beat', mid.x, mid.y + 38 * mm, 'rgba(244,247,250,0.82)', 20 * mm);
  } else if (j.ph === 'run') {
    drawLane(ctx, G, s, L, M, j, lvl);
    if (j.inZone) lbl(ctx, 'TAP to plant at the board', mid.x, mid.y, gold, 34 * mm);
    else lbl(ctx, j.nb < 2 ? 'TAP on the beat' : 'keep the rhythm', mid.x, mid.y, 'rgba(244,247,250,0.92)', 28 * mm);
  } else if (j.ph === 'leap') {
    lbl(ctx, 'Grab!', mid.x, mid.y, gold, 36 * mm);
  } else if (j.ph === 'pole') {
    drawDial(ctx, G, s, L, M, j);
    const guide = lvl.guide;
    // the messages share the strip left of the dial: centre them there and shrink to fit (they used to run under the gauge on tablets)
    const rB = L.dial.cx - L.dial.R - 14, lB = host.l + 12, pcx = (lB + rB) / 2, pw = Math.max(120, rB - lB);
    drawLetGoBar(ctx, G, s, L, M, j, guide);
    const safe = j.safe && j.safe.ok;
    if (j.tPole < 8) {
      if (j.theta < -0.04 && !safe && guide) lbl(ctx, 'WAIT: let the pole swing over', pcx, mid.y, gold, 28 * mm, 'center', pw);
      else if (j.r < j.rmax - 0.2) lbl(ctx, j.climbing ? 'CLIMB' : 'HOLD the screen to climb', pcx, mid.y, j.climbing ? moss : ink, 30 * mm, 'center', pw);
      else lbl(ctx, 'At the top: LET GO when ready', pcx, mid.y, gold, 26 * mm, 'center', pw);
    }
    if (guide && j.pred) {
      const txt = j.pred.water ? `Flag: short of the sand (${j.pred.x.toFixed(1)} m)` : `Flag: ${j.pred.x.toFixed(1)} m`;
      lbl(ctx, txt, pcx, mid.y + 42 * mm, j.pred.water ? coral : water, 22 * mm, 'center', pw);
    }
  } else if (j.ph === 'air' || j.ph === 'land') {
    lbl(ctx, `${(j.px + (j.reach || 0)).toFixed(1)} m`, mid.x, mid.y, ink, 40 * mm);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
function centerPanel(ctx, w, h, y0) {
  const x = SW / 2 - w / 2;
  panel(ctx, x, y0, w, h, { r: 26, fill: 'rgba(10,22,38,0.92)', stroke: 'rgba(244,247,250,0.4)' });
  return { x, y: y0, w, h };
}

function drawSetup(ctx, G, s, L, M, watch) {
  const V = venueById(s.venue);
  const w = Math.min(SW - 40 - host.l - host.r, 600);
  const top = L.pause.y + L.pause.h + 14;
  const avail = H - host.b - top - 12;
  let mm = Math.min(M, 1.8);
  const dims = (m) => { const rh = Math.round(86 * m), hd = Math.round(150 * m); return { rowH: rh, head: hd, h: hd + 3 * (rh + 10) + Math.round(86 * m) + 30 }; };
  while (mm > 0.75 && dims(mm).h > avail) mm -= 0.05;
  const { rowH, head, h } = dims(mm);
  const y0 = L.land ? Math.max(top, (H - h) / 2) : Math.max(top, H * 0.34 - h / 2 + 0);
  const hh = Math.min(h, H - host.b - y0 - 12);
  const p = centerPanel(ctx, w, hh, y0);
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = font(30 * mm, 800);
  ctx.fillText('Where does the pole stand?', p.x + w / 2, p.y + 44 * mm);
  ctx.fillStyle = ink; ctx.font = font(19 * mm, 500);
  ctx.fillText(`${V.name}  ·  ${V.W} m of water  ·  ${V.L} m pole`, p.x + w / 2, p.y + 78 * mm);
  ctx.fillStyle = water; ctx.font = font(19 * mm, 700);
  ctx.fillText(`Wind ${windText(s.wind)}`, p.x + w / 2, p.y + 108 * mm);
  const notes = ['safest, 0.7 m less reach', 'the usual place', 'reaches 0.7 m more, needs a fast run'];
  const rec = 1;
  for (let i = 0; i < 3; i++) {
    const r = { x: p.x + 18, y: p.y + head + i * (rowH + 10), w: w - 36, h: rowH };
    addRect(`stand:${i}`, r);
    drawButton(ctx, r, STANDS[i].name, { active: s.stand === i, sub: notes[i] + (i === rec ? '  ·  suggested' : ''), size: Math.round(26 * mm) });
  }
  if (!watch) {
    const by = p.y + head + 3 * (rowH + 10) + 4;
    drawButton(ctx, addRect('go', { x: p.x + 18, y: by, w: w - 36, h: Math.round(80 * mm) }), 'To the start line', { primary: true, size: Math.round(32 * mm) });
  }
}

function drawResult(ctx, G, s, L, M, watch) {
  const res = s.res; if (!res) return;
  const V = venueById(s.venue);
  const w = Math.min(SW - 36 - host.l - host.r, L.land ? 560 : 640);
  const availH = H - host.b - (L.land ? L.top.y + L.top.h + 12 : L.pause.y + L.pause.h + 18) - 12;
  let mm = Math.min(M, 1.8), big, sm, h;
  const meas = (m) => { big = 64 * m; sm = 21 * m; h = 40 + big + sm * 1.4 + 6 * sm * 1.4 + sm * 2.4 + (watch ? 0 : 92); return h; };
  while (mm > 0.72 && meas(mm) > availH) mm -= 0.05;
  meas(mm);
  const x = L.land ? SW - host.r - 24 - w : SW / 2 - w / 2;
  const y0 = L.land ? Math.max(L.top.y + L.top.h + 12, (H - h) / 2 - 20) : Math.max(L.pause.y + L.pause.h + 18, H * 0.2);
  const p = { x, y: y0, w, h: Math.min(h, H - host.b - y0 - 8) };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 26, fill: 'rgba(10,22,38,0.92)', stroke: 'rgba(244,247,250,0.4)' });
  ctx.textAlign = 'center';
  const txt = res.fall ? 'No mark' : `${res.dist.toFixed(1)} m`;
  ctx.fillStyle = res.fall ? coral : gold; ctx.font = font(fitPx(ctx, txt, 800, big, w - 40, 20), 800);
  ctx.fillText(txt, p.x + w / 2, p.y + 30 + big * 0.85);
  let y = p.y + 40 + big;
  ctx.font = font(sm * 1.1, 700); ctx.fillStyle = res.kind === 'clean' ? moss : res.fall ? coral : ink;
  y += sm * 1.0; ctx.fillText(res.kindText, p.x + w / 2, y);
  y += sm * 1.7;
  ctx.font = font(sm, 500); ctx.fillStyle = ink;
  const ln = LEANS[res.lean] ? LEANS[res.lean].name : '-';
  const plant = Math.abs(res.eps) < 0.3 ? 'on the board' : res.eps < 0 ? `${Math.abs(res.eps).toFixed(1)} m early` : `${res.eps.toFixed(1)} m late`;
  const rows = res.kind === 'stall' || res.kind === 'short'
    ? [['Run speed', `${(res.topV * 3.6).toFixed(0)} km/h`], ['Plant', plant], ['Canal', `${V.W} m of water`]]
    : [['Run speed', `${(res.topV * 3.6).toFixed(0)} km/h`], ['Plant', plant], ['Let go at', `${Math.round(res.theta * 57.3)}° with the ${ln} lean`], ['Sand begins at', `${V.W} m`]];
  for (const [a, b] of rows) { ctx.textAlign = 'left'; ctx.fillText(a, p.x + 34, y); ctx.textAlign = 'right'; ctx.fillText(b, p.x + w - 34, y); y += sm * 1.4; }
  const me = s.standings.find((q) => q.you);
  if (me && s.mode !== 'practice') { ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = font(sm * 1.2, 800); ctx.fillText(`Rank ${me.rank} of ${s.standings.length}  ·  best ${me.best.toFixed(1)} m`, p.x + w / 2, y + sm * 0.7); }
  if (!watch) {
    const bw = (w - 54) / 2, by = p.y + p.h - 84;
    drawButton(ctx, addRect('replay', { x: p.x + 18, y: by, w: bw, h: 68 }), 'Slow-mo replay', { dark: true, size: 24 });
    drawButton(ctx, addRect('next', { x: p.x + 36 + bw, y: by, w: bw, h: 68 }), s.mode === 'practice' ? 'Finish' : 'Standings', { primary: true, size: 26 });
  }
}

function drawBoard(ctx, G, s, L, M, watch) {
  const rows = s.board || [];
  const w = Math.min(SW - 36 - host.l - host.r, 580);
  const availE = H - host.b - (L.pause.y + L.pause.h + 12) - 12;
  let mm = Math.min(M, 1.8);
  while (mm > 0.62 && 140 + rows.length * Math.round(44 * mm) + 100 > availE) mm -= 0.05;
  const rh = Math.round(44 * mm);
  const h = 140 + rows.length * rh + 100;
  const y0 = Math.max(L.pause.y + L.pause.h + 12, (H - h) / 2);
  const p = { x: SW / 2 - w / 2, y: y0, w, h: Math.min(h, H - host.b - y0 - 10) };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 26, fill: 'rgba(10,22,38,0.94)', stroke: 'rgba(244,247,250,0.4)' });
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = font(32 * mm, 800); ctx.fillText(`After jump ${s.round + 1} of ${s.rounds}`, p.x + w / 2, p.y + 50);
  ctx.fillStyle = 'rgba(244,247,250,0.75)'; ctx.font = font(17 * mm, 500); ctx.fillText('best mark so far, last jump in metres', p.x + w / 2, p.y + 84);
  rows.forEach((r, i) => {
    const y = p.y + 106 + i * rh;
    if (r.you) { roundPath(ctx, p.x + 16, y, w - 32, rh - 6, 12); ctx.fillStyle = 'rgba(255,200,87,0.22)'; ctx.fill(); }
    ctx.textAlign = 'left'; ctx.fillStyle = r.you ? gold : ink; ctx.font = font(21 * mm, r.you ? 800 : 500);
    ctx.fillText(`${r.rank}.  ${r.name}`, p.x + 34, y + rh * 0.62);
    const last = r.jumps[r.jumps.length - 1];
    ctx.textAlign = 'right'; ctx.fillText(last && last.dist > 0 ? `${last.dist.toFixed(1)} m` : '-', p.x + w - 150, y + rh * 0.62);
    ctx.fillText(r.best > 0 ? `${r.best.toFixed(1)} m` : '-', p.x + w - 34, y + rh * 0.62);
  });
  if (!watch) {
    const bt = addRect('next', { x: p.x + 24, y: p.y + p.h - 84, w: w - 48, h: 68 });
    drawButton(ctx, bt, s.round + 1 < s.rounds ? 'Next jump' : 'See the results', { primary: true, size: 28 });
  }
}

function drawReplayBadge(ctx, G, s, L) {
  const r = { x: SW / 2 - 120, y: L.pause.y + 4, w: 240, h: 44 };
  chip(ctx, r.x, r.y, r.w, r.h, 'rgba(10,22,38,0.8)');
  ctx.fillStyle = gold; ctx.font = font(20, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SLOW-MO REPLAY', r.x + r.w / 2, r.y + r.h / 2 + 1); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, addRect('skipreplay', { x: SW / 2 - 100, y: r.y + r.h + 8, w: 200, h: 54 }), 'Skip', { dark: true, size: 22 });
}

// ---------------------------------------------------------------------------------------------------------------------------------
function textBlock(ctx, text, x, y, w, px, lh) {
  ctx.font = font(px, 400);
  for (const l of wrapLines(ctx, text, w)) { ctx.fillText(l, x, y); y += lh; }
  return y;
}

function drawThink(ctx, G, s, L, M) {
  const t = G.think; if (!t) return;
  const w = Math.min(SW - 36 - host.l - host.r, 620), px = 21 * Math.min(M, 1.4);
  ctx.font = font(px, 400); const lines = wrapLines(ctx, t.reason, w - 40);
  const h = 140 + lines.length * px * 1.3;
  const y0 = Math.max(L.pause.y + L.pause.h + 12, 0), hh = Math.min(h, H * 0.62);
  const p = { x: SW / 2 - w / 2, y: y0, w, h: hh };
  panel(ctx, p.x, p.y, p.w, p.h, { r: 22, fill: 'rgba(10,22,38,0.95)', stroke: 'rgba(244,247,250,0.45)' });
  ctx.textAlign = 'left'; ctx.fillStyle = gold; ctx.font = font(26 * Math.min(M, 1.3), 800); ctx.fillText(t.summary, p.x + 20, p.y + 44);
  ctx.fillStyle = ink;
  ctx.save(); ctx.beginPath(); ctx.rect(p.x, p.y + 56, p.w, p.h - 130); ctx.clip();
  const sc = G.ui.cardScroll || 0;
  textBlock(ctx, t.reason, p.x + 20, p.y + 84 - sc, w - 40, px, px * 1.3);
  ctx.restore();
  CARD.rect = { x: p.x, y: p.y + 56, w: p.w, h: p.h - 130 }; CARD.view = p.h - 130; CARD.max = Math.max(0, lines.length * px * 1.3 + 40 - CARD.view);
  drawButton(ctx, addRect('think-close', { x: p.x + 20, y: p.y + p.h - 68, w: w - 40, h: 54 }), 'Got it', { primary: true, size: 24 });
}

function drawWatch(ctx, G, s, L, M) {
  const W2 = G.watch;
  const hold = s.hold;
  const w = Math.min(SW - 24 - host.l - host.r, L.land ? 640 : 660);
  const px = Math.max(20 * Math.min(M, 1.4), Math.min(28, Math.ceil(14 / Math.max(0.2, host.px))));
  const x = L.land ? host.l + 14 : SW / 2 - w / 2;
  let y = L.top.y + L.top.h + 10;
  const ph = W2.phase;
  const tapH = Math.max(40, Math.min(92, Math.ceil(46 / Math.max(0.2, host.px)))), btnF = Math.max(18, Math.min(30, Math.ceil(13 / Math.max(0.2, host.px))));
  const hdrH = tapH + 16;
  chip(ctx, x, y, w, hdrH, 'rgba(10,22,38,0.82)');
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = gold; ctx.font = font(Math.max(20, btnF) * Math.min(M, 1.2), 800);
  ctx.fillText(W2.paused ? 'PAUSED' : hold ? (ph === 'think' ? 'THINK' : 'REVEAL') : 'ACT', x + 16, y + hdrH / 2);
  const bw = Math.round(btnF * 4.6), bh = tapH, bx = x + w - 16 - bw * 3 - 16 - 8, by = y + (hdrH - bh) / 2;
  const btn = (id, label, i, o = {}) => { const r = addRect(id, { x: bx + i * (bw + 8), y: by, w: bw, h: bh }); drawButton(ctx, r, label, { dark: true, size: btnF, ...o }); };
  btn('w-pause', W2.paused ? 'Resume' : 'Pause', 0);
  btn('w-faster', 'Shorter', 1); btn('w-slower', 'Longer', 2);
  drawButton(ctx, addRect('w-quit', { x: bx - 8 - Math.round(btnF * 3.4) - 8, y: by, w: Math.round(btnF * 3.4), h: bh }), 'Quit', { dark: true, size: btnF });
  ctx.textBaseline = 'alphabetic';
  y += hdrH + 8;
  if (hold) {
    ctx.font = font(px, 400); const lines = wrapLines(ctx, hold.reason, w - 36);
    const h = 70 + lines.length * px * 1.3 + 22;
    const hh = Math.min(h, H * (L.land ? 0.5 : 0.36));
    panel(ctx, x, y, w, hh, { r: 20, fill: 'rgba(10,22,38,0.9)', stroke: 'rgba(244,247,250,0.35)' });
    ctx.textAlign = 'left'; ctx.fillStyle = ink; ctx.font = font(24 * Math.min(M, 1.3), 800); ctx.fillText(hold.summary, x + 18, y + 38);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y + 48, w, hh - 74); ctx.clip();
    const sc = G.ui.cardScroll || 0;
    ctx.fillStyle = 'rgba(244,247,250,0.92)';
    textBlock(ctx, hold.reason, x + 18, y + 74 - sc, w - 36, px, px * 1.3);
    ctx.restore();
    CARD.rect = { x, y: y + 48, w, h: hh - 74 }; CARD.view = hh - 74; CARD.max = Math.max(0, lines.length * px * 1.3 + 30 - CARD.view);
    const tw = w - 36, total = W2.phase === 'think' ? G.thinkTotal : 2;
    roundPath(ctx, x + 18, y + hh - 18, tw, 8, 4); ctx.fillStyle = 'rgba(244,247,250,0.2)'; ctx.fill();
    roundPath(ctx, x + 18, y + hh - 18, Math.max(8, tw * (1 - W2.timer / Math.max(0.1, total))), 8, 4); ctx.fillStyle = W2.phase === 'think' ? gold : water; ctx.fill();
  }
}

function drawFeedback(ctx, G, s, L, M) {
  const f = G.feedback;
  if (!f || s.t - f.t > 1.3) return;
  const a = 1 - Math.max(0, (s.t - f.t - 0.7) / 0.6);
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
  ctx.font = font(46 * Math.min(M, 1.2), 800); ctx.fillStyle = f.col;
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
  ctx.fillText(f.text, SW / 2, L.mid.y + 90 - (s.t - f.t) * 36); ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Flat picture used when WebGL is not available: sky, polder, the canal in profile, the pole and the jumper.
export function renderFallback(ctx, G) {
  const s = G.sim;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#79b4e6'); g.addColorStop(0.55, '#cfe6f2'); g.addColorStop(1, '#eaf3f0');
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, H);
  const V = venueById(s ? s.venue : 'canal'), j = s && s.jump;
  const sc = (SW * 0.9) / (V.W + 12);                              // pixels per metre
  const ox = SW * 0.05 + 2 * sc, oy = H * 0.58;
  ctx.fillStyle = '#7fb46a'; ctx.fillRect(0, oy, SW, H - oy);
  ctx.fillStyle = '#3f87b5'; ctx.fillRect(ox, oy, V.W * sc, 28 + 0.05 * H);
  ctx.fillStyle = '#e8d6a0'; ctx.fillRect(ox + V.W * sc, oy - 4, SW - ox - V.W * sc, 12);
  ctx.fillStyle = '#e9e4d0'; ctx.fillRect(0, oy - 4, ox, 8);
  if (j) {
    let px = ox + j.x * sc, py = oy - 1.7 * sc * 0.6;
    if (j.ph === 'pole') {
      const bx = ox + V.xb * sc, by = oy + V.depth * sc * 0.5;
      const tx = bx + Math.sin(j.theta) * V.L * sc, ty = by - Math.cos(j.theta) * V.L * sc;
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
      px = bx + Math.sin(j.theta) * j.r * sc; py = by - Math.cos(j.theta) * j.r * sc;
    } else if (j.ph === 'air' || j.ph === 'land') { px = ox + j.px * sc; py = oy - j.py * sc; }
    ctx.fillStyle = '#e8532a'; ctx.beginPath(); ctx.arc(px, py - 8, 9, 0, TAU); ctx.fill();
  }
}
