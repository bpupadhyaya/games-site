// The play screen: the track scene with its mini-map, the HUD, the gauges, the gear box and the throttle lever.
// Pure drawing; game.js owns state and calls these every frame.
import { W, H, TEXT_SCALES, playLayout, leverTrack, host, clamp } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, textShadow } from './ui.js';
import { drawScene, PALS } from './art.js';
import {
  RIGS, GROUNDS, TRACK_FT, STRIPS, SESSION_PULLS, SLIP_GOOD, LIFT_WARN, CLOCK, PEAK, ft, mph, weightOf,
} from './sim.js';

const TAU = Math.PI * 2;

export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], state.run && state.run.mode === 'watch');

// ---- the world from a world-state object ----------------------------------------------------------------------------------------------
// ws = { rigIdx, ground, track, p, parts, t, cheer }
export function drawWorldState(ctx, rect, ws) {
  // The 3D track (view3d/track3d.js) when it is ready; the flat 2D art meanwhile, during a crossfade, and whenever the GL context is gone.
  const T = globalThis.__track3d;
  if (T && T.draw) {
    const a = T.fade ? T.fade() : 1;
    if (a < 1) {
      drawScene(ctx, rect, ws);
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); T.draw(ctx, rect, ws); ctx.restore();
      return null;
    }
    if (T.draw(ctx, rect, ws)) return null;
  }
  return drawScene(ctx, rect, ws);
}

// ---- small helpers --------------------------------------------------------------------------------------------------------------------
const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
function fit(ctx, text, maxW, size, weight = 700) {
  let px = Math.max(size, minF());
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (px > Math.max(10, minF()) && ctx.measureText(text).width > maxW) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return px;
}
function pill(ctx, text, cx, cy, size, fill = 'rgba(30,16,8,0.82)', col = '#fff6e2') {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.2, h = size * 1.9;
  roundPath(ctx, cx - w / 2, cy - h / 2, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy + 1); ctx.restore();
}
function wrap(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const wd of words) { const n = line ? `${line} ${wd}` : wd; if (line && ctx.measureText(n).width > maxW) { lines.push(line); line = wd; } else line = n; }
  if (line) lines.push(line);
  return lines;
}
const HUDBG = 'rgba(34,20,12,0.82)', HUDEDGE = 'rgba(255,226,170,0.3)';

// ---- gauges -----------------------------------------------------------------------------------------------------------------------------
// An arc dial: 0 at the lower left, 1 at the lower right (240 degrees). bands: [{a, b, col}] on the 0..1 scale.
export function drawDial(ctx, r, o) {
  const { label, v, bands, valueText, sub = null, hint = null, danger = false, fs } = o;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: HUDBG, stroke: danger ? '#ff6a4a' : HUDEDGE });
  const lab = Math.max(fs, minF());
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  const px = fit(ctx, label, r.w - 12, lab);
  ctx.font = `700 ${px}px ${FONT}`; ctx.fillStyle = '#ffe3b0'; ctx.fillText(label, r.x + r.w / 2, r.y + px + 4);
  const top = r.y + px + 10, availH = r.h - (top - r.y) - 6;
  const rad = Math.max(14, Math.min(r.w * 0.42, (availH - 6) / 1.5)), cx = r.x + r.w / 2, cy = top + rad + 2;
  const a0 = Math.PI * 0.83, a1 = Math.PI * 2.17;
  const ang = (t) => a0 + (a1 - a0) * clamp(t, 0, 1);
  const lw = Math.max(6, rad * 0.2);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, rad, a0, a1); ctx.stroke();
  for (const b of bands) { ctx.strokeStyle = b.col; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, rad, ang(b.a), ang(b.b)); ctx.stroke(); }
  if (hint !== null) {
    const a = ang(hint);
    ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = Math.max(3, lw * 0.5);
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (rad + lw * 0.8), cy + Math.sin(a) * (rad + lw * 0.8)); ctx.lineTo(cx + Math.cos(a) * (rad - lw * 0.8), cy + Math.sin(a) * (rad - lw * 0.8)); ctx.stroke();
  }
  // instrument details: brass bezel, tick marks, glass glare
  {
    const bz = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad); bz.addColorStop(0, '#f1cf84'); bz.addColorStop(0.5, '#8a5f22'); bz.addColorStop(1, '#d8ae55');
    ctx.strokeStyle = bz; ctx.lineWidth = Math.max(2, rad * 0.05);
    ctx.beginPath(); ctx.arc(cx, cy, rad + lw * 0.5 + 2, a0 - 0.05, a1 + 0.05); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { const a = ang(i / 10), r1 = rad - lw * 0.55, r2 = rad - lw * (i % 5 === 0 ? 1.15 : 0.85); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); ctx.stroke(); }
  }
  // needle with a soft shadow and a counterweight
  const na = ang(v);
  ctx.save(); ctx.translate(1.5, 2.5); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = Math.max(3, rad * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(na) * (rad - lw * 0.7), cy + Math.sin(na) * (rad - lw * 0.7)); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(3, rad * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - Math.cos(na) * rad * 0.16, cy - Math.sin(na) * rad * 0.16); ctx.lineTo(cx + Math.cos(na) * (rad - lw * 0.7), cy + Math.sin(na) * (rad - lw * 0.7)); ctx.stroke();
  { const hr = Math.max(5, rad * 0.12), hg = ctx.createRadialGradient(cx - hr * 0.3, cy - hr * 0.3, 1, cx, cy, hr); hg.addColorStop(0, '#fff3c4'); hg.addColorStop(0.5, '#e0b04a'); hg.addColorStop(1, '#7a521c');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, hr, 0, TAU); ctx.fill(); }
  // value
  const vs = Math.max(Math.round(fs * 1.0), minF());
  ctx.font = `800 ${vs}px ${DISPLAY}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(valueText, cx, cy + rad * 0.62);
  if (sub) { ctx.font = `600 ${Math.max(Math.round(fs * 0.8), minF())}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(sub, cx, cy - rad * 0.3); }
  ctx.textBaseline = 'alphabetic';
}

function drawDash(ctx, L, state, hintAdv) {
  const p = state.ws.p, rig = RIGS[p.rigIdx], fs = L.fs.lab;
  drawDial(ctx, L.dash[0], {
    label: 'ENGINE', v: p.rpm / 1.05, fs,
    bands: [{ a: 0, b: 0.5 / 1.05, col: '#c75a3a' }, { a: 0.5 / 1.05, b: 1 / 1.05, col: '#58b24a' }, { a: 1 / 1.05, b: 1, col: '#e03a2a' }],
    valueText: `${Math.round(p.rpm * 100)}%`, sub: `Gear ${p.gear + 1}`,
  });
  const sMax = 0.6;
  drawDial(ctx, L.dash[1], {
    label: 'WHEEL SLIP', v: p.slip / sMax, fs, danger: p.slip > 0.4,
    bands: [{ a: 0, b: SLIP_GOOD[0] / sMax, col: '#c4a23a' }, { a: SLIP_GOOD[0] / sMax, b: SLIP_GOOD[1] / sMax, col: '#58b24a' }, { a: SLIP_GOOD[1] / sMax, b: 0.4 / sMax, col: '#d98a2a' }, { a: 0.4 / sMax, b: 1, col: '#e03a2a' }],
    valueText: `${Math.round(p.slip * 100)}%`,
  });
  drawDial(ctx, L.dash[2], {
    label: 'NOSE LIFT', v: clamp(p.lift, 0, 1), fs, danger: p.lift > 0.9,
    bands: [{ a: 0, b: LIFT_WARN, col: '#58b24a' }, { a: LIFT_WARN, b: 0.92, col: '#e0a52a' }, { a: 0.92, b: 1, col: '#e03a2a' }],
    valueText: p.cutT > 0 ? 'CUT' : `${Math.round(clamp(p.lift, 0, 1) * 100)}%`,
  });
  void rig; void hintAdv; void PEAK;
}

// ---- gear box and lever -------------------------------------------------------------------------------------------------------------
function drawGears(ctx, L, state, advGear) {
  const p = state.ws.p, rig = RIGS[p.rigIdx], G = L.gears, big = L.fs.btn;
  const lock = state.run.phase === 'settle' || p.phase === 'done';
  const upOk = !lock && p.gear < rig.vmax.length - 1, dnOk = !lock && p.gear > 0;
  const upRec = advGear !== null && advGear > p.gear, dnRec = advGear !== null && advGear < p.gear;
  const btn = (r, label, ok, rec) => {
    drawButton(ctx, r, label, { disabled: !ok, primary: ok && !rec, active: ok && rec, size: big });
    if (ok && rec) { ctx.save(); roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 20); ctx.lineWidth = 3; ctx.strokeStyle = '#ffd36a'; ctx.stroke(); ctx.restore(); }
  };
  const narrow = G.up.w < 150;
  btn(G.up, narrow ? '▲ Up' : '▲ Shift up', upOk, upRec);
  btn(G.down, narrow ? '▼ Down' : '▼ Shift down', dnOk, dnRec);
  // gear display: big number and four pips
  const r = G.show;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: HUDBG, stroke: HUDEDGE });
  const shifting = p.shiftT > 0;
  const lab = Math.max(L.fs.small - 3, minF()), showLab = r.w > 120 && r.h > lab * 3.4;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const gs = Math.min(showLab ? r.h * 0.6 : r.h * 0.74, L.fs.big * 1.0);
  ctx.font = `800 ${Math.round(gs)}px ${DISPLAY}`; ctx.fillStyle = shifting ? '#ffb347' : '#fff';
  ctx.fillText(String(p.gear + 1), r.x + r.w * 0.34, r.y + (showLab ? r.h * 0.6 : r.h * 0.5) + 2);
  const n = rig.vmax.length, ph = r.h * 0.62, px = r.x + r.w * 0.62, pw = Math.min(14, r.w * 0.08);
  for (let i = 0; i < n; i++) {
    const idx = n - 1 - i, yy = r.y + (r.h - ph) / 2 + (ph * (i + 0.5)) / n;
    roundPath(ctx, px - pw, yy - ph / n * 0.32, pw * 2, ph / n * 0.64, pw * 0.5);
    ctx.fillStyle = idx === p.gear ? '#ffd36a' : idx === advGear && advGear !== null ? 'rgba(255,211,106,0.45)' : 'rgba(255,255,255,0.18)'; ctx.fill();
  }
  ctx.font = `700 ${lab}px ${FONT}`; ctx.fillStyle = '#ffe3b0'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if (showLab) ctx.fillText('GEAR', r.x + 10, r.y + lab + 4);
}
function drawLever(ctx, L, state, hintThr) {
  const r = L.lever, p = state.ws.p, A = state.aim;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: HUDBG, stroke: HUDEDGE });
  const t = leverTrack(r), val = A.lever;
  const fs = Math.max(L.fs.lab, minF());
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const lpx = fit(ctx, 'THROTTLE', (r.w - 32) * 0.62, fs);
  ctx.font = `700 ${lpx}px ${FONT}`; ctx.fillStyle = '#ffe3b0'; ctx.fillText('THROTTLE', r.x + 16, r.y + fs + 8);
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText(`${Math.round(val * 100)}%`, r.x + r.w - 16, r.y + fs + 8);
  // slot
  const cx = t.x + t.w / 2;
  roundPath(ctx, cx - 11, t.y - 4, 22, t.h + 8, 11); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2; ctx.stroke();
  // the lit part of the slot, red towards the top
  const ky = t.y + t.h * (1 - val);
  const lg = ctx.createLinearGradient(0, t.y + t.h, 0, t.y); lg.addColorStop(0, '#58b24a'); lg.addColorStop(0.65, '#e0b02a'); lg.addColorStop(1, '#e0452a');
  roundPath(ctx, cx - 7, ky, 14, t.y + t.h - ky + 3, 7); ctx.fillStyle = lg; ctx.fill();
  // ticks
  ctx.font = `600 ${Math.max(fs - 3, minF())}px ${FONT}`; ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const yy = t.y + t.h * (1 - i / 4);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(cx - 34, yy - 1, 12, 2); ctx.fillRect(cx + 22, yy - 1, 12, 2);
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,238,204,0.8)'; if (r.w > 150) ctx.fillText(`${i * 25}`, cx + 40, yy);
  }
  // the hint mark
  if (hintThr !== null) {
    const hy = t.y + t.h * (1 - hintThr);
    ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.moveTo(cx - 40, hy); ctx.lineTo(cx - 62, hy - 12); ctx.lineTo(cx - 62, hy + 12); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - 40, hy - 2, 80, 4);
  }
  // knob
  const kr = Math.max(24, Math.min(36, r.w * 0.09));
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx + 2, ky + kr * 0.95, kr * 0.95, kr * 0.35, 0, 0, TAU); ctx.fill();
  const kg = ctx.createRadialGradient(cx - kr * 0.35, ky - kr * 0.4, 2, cx, ky, kr);
  kg.addColorStop(0, '#ff9a7a'); kg.addColorStop(0.5, '#d83a1e'); kg.addColorStop(1, '#6e1408');
  ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(cx, ky, kr, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(30,6,2,0.8)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx - kr * 0.25, ky - kr * 0.45, kr * 0.4, kr * 0.2, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
  void p;
}

// ---- strip: sled load and clock ----------------------------------------------------------------------------------------------------------
function drawStrip(ctx, L, state) {
  const r = L.strip, p = state.ws.p;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: HUDBG, stroke: HUDEDGE });
  const fs = Math.max(L.fs.wind, minF());
  const cy = r.y + r.h / 2;
  const half = r.w * 0.62;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffe3b0';
  const px = fit(ctx, 'Sled load', half * 0.34, Math.round(fs * 0.95));
  ctx.font = `700 ${px}px ${FONT}`; ctx.fillText('Sled load', r.x + 14, cy);
  const bx = r.x + 14 + Math.min(half * 0.36, ctx.measureText('Sled load').width + 10), bw = r.x + half - bx - 8, bh = Math.max(12, r.h * 0.32);
  roundPath(ctx, bx, cy - bh / 2, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
  const lv = clamp(p.load / 1.1, 0, 1);
  const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#58b24a'); g.addColorStop(0.6, '#e0b02a'); g.addColorStop(1, '#e0452a');
  roundPath(ctx, bx, cy - bh / 2, Math.max(bh, bw * lv), bh, bh / 2); ctx.fillStyle = g; ctx.fill();
  // clock and speed
  ctx.textAlign = 'right'; ctx.fillStyle = '#fff6e2';
  const left = Math.max(0, CLOCK - p.t), mm = Math.floor(left), cs = Math.floor((left - mm) * 10);
  const txt = `${mph(p.v).toFixed(0)} mph · ${mm}.${cs} s`;
  const p2 = fit(ctx, txt, r.w - half - 20, fs);
  ctx.font = `700 ${p2}px ${FONT}`; ctx.fillText(txt, r.x + r.w - 14, cy);
}

function drawScoreBlock(ctx, L, state) {
  const r = L.score, run = state.run, p = state.ws.p;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: HUDBG, stroke: HUDEDGE });
  const cx = r.x + r.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const sm = Math.max(L.fs.small, minF());
  const head = run.mode === 'free' ? `${RIGS[p.rigIdx].name} · free pull` : `${RIGS[p.rigIdx].name} · pull ${Math.min(run.idx + 1, SESSION_PULLS)} of ${SESSION_PULLS}`;
  const px = fit(ctx, head, r.w - 20, sm, 600);
  ctx.font = `600 ${px}px ${FONT}`; ctx.fillStyle = '#ffe3b0'; ctx.fillText(head, cx, r.y + px + 6);
  const big = Math.min(L.fs.big, r.h - px - 16);
  ctx.font = `800 ${big}px ${DISPLAY}`; ctx.fillStyle = '#fff'; ctx.fillText(String(Math.floor(ft(p.x))), cx - big * 0.0, r.y + r.h - 10);
  ctx.font = `600 ${Math.max(sm - 1, minF())}px ${FONT}`; ctx.fillStyle = '#ffe3b0'; ctx.textAlign = 'right';
  ctx.fillText(`of ${TRACK_FT} ft`, r.x + r.w - 12, r.y + r.h - 12);
  if (run.mode === 'session' || run.mode === 'daily' || run.mode === 'watch') { ctx.textAlign = 'left'; ctx.fillText(`Total ${run.total}`, r.x + 12, r.y + r.h - 12); }
}

// A thin map of the track at the top of the scene: the grip strips (dark = damp and grippy, pale = dusty), the rig and the finish.
function drawMiniMap(ctx, L, state) {
  const st = L.stage, p = state.ws.p, track = state.ws.track;
  const w = Math.min(st.w - 36, 520), h = Math.max(16, Math.round(L.fs.small * 1.1)), x = st.x + (st.w - w) / 2, y = st.y + 10;
  roundPath(ctx, x - 6, y - 6, w + 12, h + 12, (h + 12) / 2); ctx.fillStyle = 'rgba(30,16,8,0.72)'; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, h / 2); ctx.clip();
  const pal = PALS[state.ws.ground];
  for (let i = 0; i < STRIPS; i++) {
    const d = track.strips[i] - 1, a = Math.min(0.95, 0.35 + Math.abs(d) * 2.2);
    ctx.fillStyle = d >= 0 ? `rgba(${pal.moist.split(',').map((v) => Math.round(+v * 0.5)).join(',')},${a})` : `rgba(${pal.dry},${a})`;
    ctx.fillRect(x + (w * i) / STRIPS, y, w / STRIPS + 1, h);
  }
  ctx.restore();
  const u = clamp(p.x / (TRACK_FT / 3.28084), 0, 1), mx = x + w * u;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2b1d14'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(mx, y + h + 4); ctx.lineTo(mx - 7, y + h + 14); ctx.lineTo(mx + 7, y + h + 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(x + w - 2, y - 4, 3, h + 8);
  const fs = Math.max(L.fs.small - 3, minF());
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffe3b0';
  ctx.fillText('dark = grip', x, y + h + fs + 14); ctx.textAlign = 'right'; ctx.fillText('pale = slick', x + w, y + h + fs + 14);
}

// ---- the whole play screen -----------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const L = layoutOf(state), run = state.run, watch = run.mode === 'watch', stage = L.stage, p = state.ws.p;
  ctx.fillStyle = '#1c120b'; ctx.fillRect(0, 0, W, H);
  let sx = 0, sy = 0;
  if (state.shake > 0) { const k = state.shake * 5; sx = Math.sin(state.t * 90) * k; sy = Math.cos(state.t * 77) * k; }
  ctx.save(); ctx.translate(sx, sy);
  drawWorldState(ctx, stage, state.ws);
  ctx.restore();
  drawMiniMap(ctx, L, state);
  const big = L.fs.btn;
  if (!watch) {
    drawButton(ctx, L.pause, '❚❚', { dark: true, size: big });
    drawButton(ctx, L.think, state.hint ? 'Hint on' : 'Think', { primary: !state.hint, active: !!state.hint, size: Math.round(big * 0.9) });
  } else if (!L.land) {
    drawButton(ctx, L.pause, 'Watch', { dark: true, size: Math.round(big * 0.8), disabled: true });
    drawButton(ctx, L.think, '', { dark: true, size: big, disabled: true });
  }
  drawScoreBlock(ctx, L, state);
  drawStrip(ctx, L, state);
  const adv = state.hint ? state.hint.adv : watch && state.dec && state.dec.phase !== 'think' ? state.dec.adv : null;
  drawDash(ctx, L, state, adv);
  drawGears(ctx, L, state, adv ? adv.gear : null);
  drawLever(ctx, L, state, adv ? adv.thr : null);
  if (watch) {
    const D = L.demo, st = state.settings;
    drawButton(ctx, D.dec, '−', { size: big, disabled: st.thinkIdx === 0, dark: true });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { size: Math.round(big * 0.9), primary: true });
    drawButton(ctx, D.inc, '+', { size: big, disabled: false, dark: true });
    drawButton(ctx, D.exit, 'Exit', { size: Math.round(big * 0.9), dark: true });
    const dec = state.dec;
    if (dec) {
      const label = dec.phase === 'think' ? `Thinking… ${Math.max(0, Math.ceil(dec.dur - dec.t))} s` : dec.phase === 'reveal' ? 'My plan' : 'Pulling';
      pill(ctx, label, stage.x + stage.w / 2, stage.y + stage.h * 0.2, Math.max(L.fs.mid, minF()), 'rgba(30,16,8,0.82)', dec.phase === 'think' ? '#ffd36a' : '#a8e88a');
    }
  } else if (!L.land || true) {
    const hr = L.hint;
    if (!L.land) {
      ctx.fillStyle = 'rgba(255,240,214,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const msg = p.phase === 'ready' ? 'Roll the lever on to start the pull' : p.phase === 'run' ? (p.shiftT > 0 ? 'Shifting…' : 'Keep slip in the green · watch the nose') : '';
      const px = fit(ctx, msg, hr.w - 20, Math.max(L.fs.small + 1, minF()), 600);
      ctx.font = `600 ${px}px ${FONT}`; ctx.fillText(msg, hr.x + hr.w / 2, hr.y + hr.h / 2);
    }
  }
  // ready: a prompt over the scene
  if (p.phase === 'ready' && !watch && run.phase === 'ready' && !state.banner) {
    const a = 0.6 + 0.4 * Math.sin(state.t * 4);
    ctx.save(); ctx.globalAlpha = a;
    pill(ctx, 'Move the throttle lever to launch', stage.x + stage.w / 2, stage.y + stage.h * 0.46, Math.max(L.fs.mid, minF()), 'rgba(30,16,8,0.82)', '#ffe3b0');
    ctx.restore();
  }
  // the hint card
  if (state.hint && !state.banner) {
    const why = state.hint.adv.why, px = Math.max(L.fs.small, minF());
    ctx.font = `600 ${px}px ${FONT}`;
    const maxW = Math.min(stage.w - 40, 620);
    const lines = wrap(ctx, `Think: ${why}`, maxW - 28);
    const hh = lines.length * px * 1.3 + 22, hx = stage.x + (stage.w - maxW) / 2, hy = stage.y + Math.max(52, L.fs.small * 4.4);
    roundPath(ctx, hx, hy, maxW, hh, 16); ctx.fillStyle = 'rgba(30,16,8,0.86)'; ctx.fill(); ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff3d4'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, hx + 14, hy + 12 + px * (1 + i * 1.3)));
  }
  // continue prompt after a pull
  if (run.phase === 'settle' && !watch && state.settleT > 0.6) {
    const al = 0.55 + 0.45 * Math.sin(state.t * 4);
    ctx.save(); ctx.globalAlpha = al;
    pill(ctx, 'Tap to continue', stage.x + stage.w / 2, stage.y + stage.h - Math.max(34, L.fs.mid * 1.8), Math.max(L.fs.mid, minF()), 'rgba(30,16,8,0.82)', '#ffe3b0');
    ctx.restore();
  }
  // pops (nose up, shift, etc.)
  for (const q of state.pops) {
    const k = q.t / q.max, x = stage.x + stage.w * q.fx, y = stage.y + stage.h * q.fy - k * 40;
    const size = Math.round(clamp(L.fs.mid * 1.1 * q.size, 18, 44));
    ctx.save(); ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = `800 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = 'rgba(30,12,4,0.8)'; ctx.lineJoin = 'round';
    ctx.strokeText(q.text, x, y); ctx.fillStyle = q.col; ctx.fillText(q.text, x, y);
    ctx.restore();
  }
  // banner for a finished pull
  if (state.banner) {
    const b = state.banner, k = clamp(b.t / 0.25, 0, 1), a = b.t > b.max - 0.4 ? clamp((b.max - b.t) / 0.4, 0, 1) : 1;
    const cx = stage.x + stage.w / 2, cy = stage.y + stage.h * 0.4;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const bs = Math.round(Math.min(stage.w * 0.2, stage.h * 0.3, 120));
    ctx.font = `800 ${bs}px ${DISPLAY}`; ctx.lineWidth = bs * 0.14; ctx.strokeStyle = 'rgba(30,12,4,0.88)'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.col || '#fff'; ctx.fillText(b.text, 0, 0);
    const ss = Math.max(Math.round(bs * 0.26), minF());
    ctx.font = `700 ${ss}px ${FONT}`; ctx.lineWidth = bs * 0.06; ctx.strokeText(b.sub, 0, bs * 0.34); ctx.fillStyle = '#fff3d4'; ctx.fillText(b.sub, 0, bs * 0.34);
    ctx.restore();
  }
  // toast
  if (state.toastT > 0 && state.toast) {
    const a = Math.min(1, state.toastT / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    const px = Math.max(L.fs.toast, minF());
    ctx.font = `700 ${px}px ${FONT}`;
    const lines = wrap(ctx, state.toast, Math.min(stage.w - 50, 600));
    const w = Math.min(stage.w - 30, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40), h = lines.length * px * 1.3 + 22;
    const x = stage.x + (stage.w - w) / 2;
    let y = stage.y + Math.max(70, stage.h * 0.17);
    if (state.banner) { // never over the big feet number: sit just below the banner's sub line
      const bs = Math.round(Math.min(stage.w * 0.2, stage.h * 0.3, 120)), cy = stage.y + stage.h * 0.4;
      y = Math.min(cy + bs * 0.34 + Math.max(Math.round(bs * 0.26), minF()) + 16, stage.y + stage.h - h - 8);
    }
    roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(30,16,8,0.86)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 12 + px * (1 + i * 1.3)));
    ctx.restore();
  }
  void GROUNDS; void C; void textShadow; void weightOf;
}
