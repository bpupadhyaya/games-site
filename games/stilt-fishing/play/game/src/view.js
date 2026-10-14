// The play screen: the sea, the HUD (score, clock, swell timeline), the line gauge, the pad and the banners.
// Pure drawing; game.js owns state and calls these every frame.
import { W, H, TEXT_SCALES, playLayout, host, clamp } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, textShadow } from './ui.js';
import { drawWorld, sceneGeom, lightAt, drawMiniFish, fishLen, fightPos } from './art.js';
import { SPOTS, SPECIES, DAY_SECS, advise, nextKick, STRIKE_WINDOW } from './sim.js';

const TAU = Math.PI * 2;

export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], state.run && state.run.mode === 'watch');
export const geomOf = (state) => sceneGeom(layoutOf(state).stage);

const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
function fit(ctx, text, maxW, size, weight = 700) {
  let px = Math.max(size, minF());
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (px > Math.max(10, minF()) && ctx.measureText(text).width > maxW) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return px;
}
export function pill(ctx, text, cx, cy, size, fill = 'rgba(10,26,48,0.8)', col = '#f4fbff') {
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
const fmtClock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// ---- the world from a world-state object ------------------------------------------------------------------------------------------
export function drawWorldState(ctx, rect, ws) { return drawWorld(ctx, sceneGeom(rect), ws); }

// ---- the pad: lean + reel with one finger -----------------------------------------------------------------------------------
export function padTrack(r) {
  const padX = Math.round(r.w * 0.07), h = Math.max(18, Math.round(r.h * 0.2));
  return { x: r.x + padX, w: r.w - 2 * padX, y: r.y + r.h * 0.5 - h / 2 + r.h * 0.06, h };
}
function drawPad(ctx, L, state) {
  const r = L.pad, rig = state.run.rig, ctl = state.ctl, watch = state.run.mode === 'watch';
  const down = state.padDown || (watch && ctl.reel);
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, fill: down ? 'rgba(34,70,96,0.92)' : 'rgba(14,32,58,0.86)', stroke: down ? '#7fe8d0' : 'rgba(255,255,255,0.3)' });
  const t = padTrack(r), cy = t.y + t.h / 2, tr = Math.max(8, t.h * 0.42);
  const fs = Math.max(L.fs.lab, minF());
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#f4fbff'; ctx.fillText('Balance', r.x + 20, r.y + fs + 8);
  ctx.textAlign = 'right'; ctx.fillStyle = down ? '#9be8c8' : '#bfe1f5';
  const label = rig.fell ? 'Climbing back…' : rig.fight ? (down ? 'REELING' : 'Hold to reel') : rig.bait && rig.bait.state === 'bite' ? 'PRESS NOW' : down ? 'Pad down' : 'Hold and slide';
  const px = fit(ctx, label, r.w * 0.5, fs, 700);
  ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(label, r.x + r.w - 20, r.y + fs + 8);
  // shore / sea captions
  ctx.font = `600 ${Math.max(Math.round(fs * 0.8), minF())}px ${FONT}`; ctx.fillStyle = 'rgba(191,225,245,0.8)';
  ctx.textAlign = 'left'; ctx.fillText('◀ shore', t.x, t.y + t.h + Math.round(fs * 1.2));
  ctx.textAlign = 'right'; ctx.fillText('sea ▶', t.x + t.w, t.y + t.h + Math.round(fs * 1.2));
  // track with safe zone and danger edges
  roundPath(ctx, t.x, cy - tr / 2, t.w, tr, tr / 2); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
  const zone = (a, b, col) => { ctx.fillStyle = col; ctx.fillRect(t.x + t.w * (0.5 + a / 2), cy - tr / 2, t.w * (b - a) / 2, tr); };
  ctx.save(); roundPath(ctx, t.x, cy - tr / 2, t.w, tr, tr / 2); ctx.clip();
  zone(-0.45, 0.45, 'rgba(80,200,160,0.35)'); zone(-1, -0.75, 'rgba(240,90,70,0.5)'); zone(0.75, 1, 'rgba(240,90,70,0.5)');
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(t.x + t.w / 2 - 1, cy - tr / 2 - 6, 2, tr + 12);
  // the sway marker: where the seat actually is
  const sx = t.x + t.w * (0.5 + clamp(rig.s, -1, 1) / 2), sc = Math.abs(rig.s) < 0.45 ? '#7fe8b0' : Math.abs(rig.s) < 0.75 ? '#ffc84a' : '#ff6a4a';
  ctx.fillStyle = sc; ctx.beginPath(); ctx.moveTo(sx, cy - tr / 2 - 3); ctx.lineTo(sx - 9, cy - tr / 2 - 17); ctx.lineTo(sx + 9, cy - tr / 2 - 17); ctx.closePath(); ctx.fill();
  // the lean thumb: where your finger is
  const lx = t.x + t.w * (0.5 + clamp(rig.l, -1, 1) / 2), kr = Math.max(15, t.h * 0.58);
  ctx.beginPath(); ctx.arc(lx, cy, kr, 0, TAU);
  const kg = ctx.createRadialGradient(lx - kr * 0.3, cy - kr * 0.3, 2, lx, cy, kr);
  kg.addColorStop(0, down ? '#e0fff4' : '#ffffff'); kg.addColorStop(1, down ? '#58d6b0' : '#bcd9ee'); ctx.fillStyle = kg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(8,24,48,0.6)'; ctx.stroke();
  if (down) { ctx.strokeStyle = 'rgba(155,232,200,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(lx, cy, kr + 7 + 3 * Math.sin(state.t * 12), 0, TAU); ctx.stroke(); }
}

function drawGauge(ctx, L, state, g) {
  const f = state.run.rig.fight; if (!f) return;
  const st = L.stage, gw = Math.max(26, Math.round(L.fs.small * 1.6));
  const gx = st.x + st.w - gw - 14, gy = st.y + st.h * 0.1, gh = Math.min(st.h * 0.62, 360);
  if (gh < 90) return;
  roundPath(ctx, gx, gy, gw, gh, gw / 2); ctx.fillStyle = 'rgba(8,22,44,0.7)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
  ctx.save(); roundPath(ctx, gx + 3, gy + 3, gw - 6, gh - 6, (gw - 6) / 2); ctx.clip();
  const y = (v) => gy + gh - 3 - (gh - 6) * v;
  ctx.fillStyle = 'rgba(240,90,70,0.65)'; ctx.fillRect(gx, y(1), gw, y(0.72) - y(1));
  ctx.fillStyle = 'rgba(90,210,160,0.6)'; ctx.fillRect(gx, y(0.72), gw, y(0.35) - y(0.72));
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(gx, y(0.35), gw, y(0) - y(0.35));
  ctx.restore();
  const ny = y(clamp(f.T, 0, 1));
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(gx - 10, ny); ctx.lineTo(gx + 2, ny - 8); ctx.lineTo(gx + 2, ny + 8); ctx.closePath(); ctx.fill();
  ctx.fillRect(gx, ny - 2, gw, 4);
  ctx.fillStyle = '#f4fbff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 ${Math.max(L.fs.small - 2, minF())}px ${FONT}`;
  ctx.fillText('Line', gx + gw / 2, gy - 8);
  // fish tiredness and distance to land below the gauge
  const bw = gw + 16, bx = gx - 8, by = gy + gh + 10;
  roundPath(ctx, bx, by, bw, 8, 4); ctx.fillStyle = 'rgba(8,22,44,0.7)'; ctx.fill();
  roundPath(ctx, bx, by, Math.max(6, bw * (1 - clamp(f.r, 0, 1))), 8, 4); ctx.fillStyle = '#ffd36a'; ctx.fill();
  ctx.font = `600 ${Math.max(L.fs.small - 4, minF())}px ${FONT}`; ctx.fillStyle = '#e6f6ff'; ctx.fillText('in', gx + gw / 2, by + 24);
  // run warning
  if (f.tele || f.phase === 'run') {
    const a = 0.6 + 0.4 * Math.sin(state.t * 18);
    pill(ctx, f.phase === 'run' ? 'RUN! Let go' : 'Run coming…', gx - Math.max(L.fs.mid, minF()) * 4.4, gy + 22, Math.max(L.fs.mid, minF()), `rgba(220,70,50,${0.65 + 0.3 * a})`, '#fff');
  } else {
    pill(ctx, f.T > 0.6 ? 'Easy…' : 'Reel!', gx - Math.max(L.fs.mid, minF()) * 3.2, gy + 22, Math.max(L.fs.mid, minF()), 'rgba(40,150,110,0.85)', '#fff');
  }
}

// the swell timeline: now at the left, the next six seconds to the right
function drawStatus(ctx, L, state) {
  const r = L.status, run = state.run, rig = run.rig;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: 'rgba(12,30,56,0.78)', stroke: 'rgba(255,255,255,0.28)' });
  const fs = Math.max(L.fs.wind, minF()), cy = r.y + r.h / 2;
  const w = nextKick(rig), eta = w ? w.t - rig.t : 99;
  const tx = r.x + r.w * 0.46, tw = r.w * 0.5, tt = r.y + r.h * 0.62;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const lab = rig.fell ? 'Back on the bar soon' : eta < 6 ? `Swell in ${Math.max(0, eta).toFixed(1)} s` : 'Sea is calm';
  const col = eta < 1.6 ? '#ffb070' : eta < 3 ? '#ffe08a' : '#f4fbff';
  const px = fit(ctx, lab, r.w * 0.42, fs);
  ctx.font = `700 ${px}px ${FONT}`; ctx.fillStyle = col; ctx.fillText(lab, r.x + 16, cy);
  // timeline
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(tx, tt); ctx.lineTo(tx + tw, tt); ctx.stroke();
  ctx.fillStyle = '#7fe8d0'; ctx.fillRect(tx - 1, tt - 8, 3, 16);
  for (const q of rig.waves) {
    if (q.back) continue;
    const e = q.t - rig.t; if (e < 0 || e > 6) continue;
    const x = tx + tw * (e / 6), hh = Math.min(8 + q.h * (r.h * 0.34), r.h * 0.3);
    ctx.fillStyle = q.big ? '#ffb070' : '#bfe6ff';
    ctx.beginPath(); ctx.moveTo(x - 7, tt); ctx.quadraticCurveTo(x, tt - hh * 1.5, x + 7, tt); ctx.closePath(); ctx.fill();
  }
  ctx.textAlign = 'left'; ctx.font = `600 ${Math.max(Math.round(fs * 0.7), minF())}px ${FONT}`; ctx.fillStyle = '#bfe1f5';
  ctx.fillText('next 6 s', tx, r.y + r.h * 0.22);
}

function drawScoreBlock(ctx, L, state) {
  const r = L.score, run = state.run, rig = run.rig;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(12,30,56,0.78)', stroke: 'rgba(255,255,255,0.28)' });
  const cx = r.x + r.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const sm = Math.max(L.fs.small, minF());
  const left = DAY_SECS - rig.day;
  const head = run.mode === 'free' ? `${SPOTS[rig.spot].name} · free fishing` : `${SPOTS[rig.spot].name} · ${fmtClock(left)} to dusk`;
  const px = fit(ctx, head, r.w - 20, sm, 600);
  ctx.font = `600 ${px}px ${FONT}`; ctx.fillStyle = '#bfe1f5'; ctx.fillText(head, cx, r.y + px + 6);
  const big = Math.min(L.fs.big, r.h - px - 16);
  ctx.font = `800 ${big}px ${DISPLAY}`; ctx.fillStyle = '#fff';
  const val = run.mode === 'free' ? rig.kg.toFixed(1) : String(state.scoreShown ?? 0);
  ctx.fillText(val, cx, r.y + r.h - 10);
  ctx.font = `600 ${Math.max(sm - 1, minF())}px ${FONT}`; ctx.fillStyle = '#bfe1f5'; ctx.textAlign = 'right';
  ctx.fillText(run.mode === 'free' ? 'kg landed' : `${rig.kg.toFixed(1)} kg`, r.x + r.w - 12, r.y + r.h - 12);
  ctx.textAlign = 'left'; ctx.fillText(`${rig.count} fish`, r.x + 12, r.y + r.h - 12);
}

// ---- the whole play screen ---------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const L = layoutOf(state), run = state.run, rig = run.rig, watch = run.mode === 'watch', stage = L.stage, ws = state.ws;
  const Lt = lightAt(rig.tod, SPOTS[rig.spot].storm);
  ctx.fillStyle = Lt.deep; ctx.fillRect(0, 0, W, H);
  let sx = 0, sy = 0;
  if (state.shake > 0) { const k = state.shake * 6; sx = Math.sin(state.t * 90) * k; sy = Math.cos(state.t * 77) * k; }
  ctx.save(); ctx.translate(sx, sy);
  const g = sceneGeom(stage);
  ws.hintFish = state.hintOn && state.hintAdv && state.hintAdv.fish ? state.hintAdv.fish.id : (state.dec && state.dec.phase !== 'think' && state.dec.fishId ? state.dec.fishId : 0);
  drawWorld(ctx, g, ws);
  ctx.restore();

  // tap-here cue while nothing is cast
  if (!watch && !rig.bait && !rig.fight && !rig.fell && state.cueT > 0 && !state.hintOn) {
    const a = 0.5 + 0.5 * Math.sin(state.t * 4);
    const fs = Math.max(L.fs.small + 1, minF());
    pill(ctx, 'Tap the water at a fish to cast', stage.x + stage.w * (stage.w > stage.h ? 0.55 : 0.6), stage.y + stage.h * 0.74 + a * 4, fs, 'rgba(10,26,48,0.7)');
  }
  if (rig.bait && rig.bait.state === 'bite' && !rig.fight) {
    const px = g.fx(rig.bait.x), py = g.sy - 40;
    const sz = Math.max(L.fs.mid + 4, minF());
    ctx.save(); ctx.font = `800 ${Math.round(sz * 1.4)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(6,20,42,0.85)'; ctx.strokeText('BITE!', clamp(px, stage.x + 60, stage.x + stage.w - 60), py); ctx.fillStyle = '#ffd75a'; ctx.fillText('BITE!', clamp(px, stage.x + 60, stage.x + stage.w - 60), py);
    ctx.restore();
  }
  drawGauge(ctx, L, state, g);

  // HUD
  const big = L.fs.btn;
  if (!watch) {
    drawButton(ctx, L.pause, '❚❚', { dark: true, size: big });
    drawButton(ctx, L.think, state.hintOn ? 'Hint on' : 'Think', { primary: !state.hintOn, active: state.hintOn, size: Math.round(big * 0.9) });
  } else {
    drawButton(ctx, L.pause, 'Watch', { dark: true, size: Math.round(big * 0.8), disabled: true });
    drawButton(ctx, L.think, 'Auto', { dark: true, size: Math.round(big * 0.8), disabled: true });
  }
  drawScoreBlock(ctx, L, state);
  drawStatus(ctx, L, state);
  drawPad(ctx, L, state);

  if (watch) {
    const D = L.demo, st = state.settings;
    drawButton(ctx, D.dec, '−', { size: big, disabled: st.thinkIdx === 0, dark: true });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { size: Math.round(big * 0.9), primary: true });
    drawButton(ctx, D.inc, '+', { size: big, disabled: false, dark: true });
    drawButton(ctx, D.exit, 'Exit', { size: Math.round(big * 0.9), dark: true });
    const dec = state.dec;
    if (dec) {
      const label = dec.phase === 'think' ? `Thinking… ${Math.max(0, Math.ceil(dec.dur - dec.t))} s` : dec.phase === 'reveal' ? 'My choice' : 'Casting when calm';
      pill(ctx, label, stage.x + stage.w / 2, stage.y + stage.h * 0.1, Math.max(L.fs.mid, minF()), 'rgba(10,26,48,0.78)', dec.phase === 'think' ? '#ffd36a' : '#8be8b0');
    } else if (rig.fight) {
      pill(ctx, 'Playing the fish', stage.x + stage.w / 2, stage.y + stage.h * 0.1, Math.max(L.fs.mid, minF()), 'rgba(10,26,48,0.78)', '#8be8b0');
    }
  } else {
    const hr = L.hint;
    ctx.fillStyle = 'rgba(244,251,255,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const msg = rig.fell ? 'You slipped. Climbing back…' : rig.fight ? 'Hold to reel, let go when it runs' : rig.bait ? (rig.bait.state === 'bite' ? 'Press the pad now!' : 'Wait for the float to dive') : 'Tap the water where a fish swims';
    const px = fit(ctx, msg, hr.w - 20, Math.max(L.fs.small + 1, minF()), 600);
    ctx.font = `600 ${px}px ${FONT}`; ctx.fillText(msg, hr.x + hr.w / 2, hr.y + hr.h / 2);
  }
  // the hint card
  if (state.hintOn && !watch) {
    const adv = state.hintAdv || advise(rig), px = Math.max(L.fs.small, minF());
    ctx.font = `600 ${px}px ${FONT}`;
    const maxW = Math.min(stage.w - 40, 620);
    const lines = wrap(ctx, `Think: ${adv.text}`, maxW - 28);
    const hh = lines.length * px * 1.3 + 22, hx = stage.x + (stage.w - maxW) / 2, hy = stage.y + stage.h * (rig.fight ? 0.52 : 0.5);
    roundPath(ctx, hx, hy, maxW, hh, 16); ctx.fillStyle = 'rgba(10,26,48,0.86)'; ctx.fill(); ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, hx + 14, hy + 12 + px * (1 + i * 1.3)));
  }
  // the landed fish card
  if (state.land) {
    const c = state.land, S = SPECIES[c.catch.sp], k = clamp(c.t / 0.25, 0, 1), a = c.t > c.max - 0.4 ? clamp((c.max - c.t) / 0.4, 0, 1) : 1;
    const pxl = Math.max(L.fs.mid, minF());
    const cw = Math.min(stage.w - 40, 420), chh = pxl * 4.3 + 24, cx = stage.x + stage.w / 2, cy = stage.y + stage.h * 0.64;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    panel(ctx, -cw / 2, -chh / 2, cw, chh, { r: 22, fill: 'rgba(12,30,56,0.9)', stroke: c.first ? '#ffd36a' : 'rgba(255,255,255,0.35)' });
    drawMiniFish(ctx, -cw / 2 + 86, 0, Math.min(120, cw * 0.28), c.catch.sp, 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
    const tx = -cw / 2 + 168, tw = cw - 168 - 14;
    const p1 = fit(ctx, S.name, tw, pxl + 2); ctx.font = `800 ${p1}px ${FONT}`; ctx.fillText(S.name, tx, -chh / 2 + 14 + p1);
    ctx.font = `700 ${Math.round(pxl * 1.25)}px ${DISPLAY}`; ctx.fillStyle = '#ffd36a'; ctx.fillText(`${c.catch.kg.toFixed(2)} kg`, tx, -chh / 2 + 14 + p1 + pxl * 1.45);
    ctx.font = `600 ${Math.max(L.fs.small, minF())}px ${FONT}`; ctx.fillStyle = '#bfe1f5';
    ctx.fillText(`${c.catch.cm} cm · ${c.first ? 'new in your logbook · ' : ''}released`, tx, chh / 2 - 12);
    ctx.restore();
  }
  // banner
  if (state.banner) {
    const b = state.banner, k = clamp(b.t / 0.25, 0, 1), a = b.t > b.max - 0.4 ? clamp((b.max - b.t) / 0.4, 0, 1) : 1;
    const cx = stage.x + stage.w / 2, cy = stage.y + stage.h * 0.4;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const bs = Math.round(Math.min(stage.w * 0.14, 96));
    ctx.font = `800 ${bs}px ${DISPLAY}`; ctx.lineWidth = bs * 0.14; ctx.strokeStyle = 'rgba(6,20,42,0.85)'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.col || '#fff'; ctx.fillText(b.text, 0, 0);
    ctx.font = `700 ${Math.round(bs * 0.3)}px ${FONT}`; ctx.lineWidth = bs * 0.07; ctx.strokeText(b.sub, 0, bs * 0.42); ctx.fillStyle = '#e6f6ff'; ctx.fillText(b.sub, 0, bs * 0.42);
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
    const x = stage.x + (stage.w - w) / 2, y = stage.y + stage.h * 0.55;
    roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(10,26,48,0.86)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 12 + px * (1 + i * 1.3)));
    ctx.restore();
  }
  void C; void textShadow; void fishLen; void fightPos; void STRIKE_WINDOW;
}
