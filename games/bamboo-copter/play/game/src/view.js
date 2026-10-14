// The play screen: the sky world with the rotor, the cradle (palms, shaft, spin meter), the HUD, the wind strip and the
// control panel. Pure drawing; game.js owns state and calls these every frame.
import { W, H, TEXT_SCALES, playLayout, cradleOf, trackOf, host, clamp } from './layout.js';
import { v3 } from './v3.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel } from './ui.js';
import { drawWorld, drawCopter, PALS, makeCam } from './art.js';
import { ROTORS, SCENES, SESSION_FLIGHTS, CHARGE_MAX, OVERHEAT, START_H, groundAt } from './sim.js';

const TAU = Math.PI * 2;
export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], state.run && state.run.mode === 'watch');
const lerp = (a, b, k) => a + (b - a) * k;

const minF = () => (host.px > 0 ? Math.ceil(11 / host.px) : 0);
function fit(ctx, text, maxW, size, weight = 700) {
  let px = Math.max(size, minF());
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (px > Math.max(10, minF()) && ctx.measureText(text).width > maxW) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return px;
}
function pill(ctx, text, cx, cy, size, fill = 'rgba(10,32,20,0.8)', col = '#f6fbf0') {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`;
  const w = ctx.measureText(text).width + size * 1.4, h = size * 1.95, x = cx - w / 2, y = cy - h / 2, r = h / 2;
  const hot = /255,\s*20\d/.test(fill);
  roundPath(ctx, x, y + 3, w, h, r); ctx.fillStyle = 'rgba(2,14,6,0.35)'; ctx.fill();
  roundPath(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (hot) { g.addColorStop(0, '#ffe58f'); g.addColorStop(1, '#e3a73a'); } else { g.addColorStop(0, '#2a6044'); g.addColorStop(1, '#0d2619'); }
  ctx.fillStyle = g; ctx.fill();
  roundPath(ctx, x + 1.2, y + 1.2, w - 2.4, h - 2.4, r - 1); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
  roundPath(ctx, x, y, w, h, r); ctx.lineWidth = 1.5; ctx.strokeStyle = hot ? 'rgba(255,250,210,0.9)' : 'rgba(224,184,96,0.6)'; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy + 1); ctx.restore();
}
function wrap(ctx, text, maxW) {
  const words = String(text).split(' '), lines = [];
  let line = '';
  for (const wd of words) { const n = line ? `${line} ${wd}` : wd; if (line && ctx.measureText(n).width > maxW) { lines.push(line); line = wd; } else line = n; }
  if (line) lines.push(line);
  return lines;
}

// ---- where the rotor is on screen ---------------------------------------------------------------------------------------------
export const rotorSize = (stage) => clamp(stage.w * 0.23, 76, 190);
function cradleSize(cr) { return v3.on ? Math.min(cr.w * 0.62, cr.h * 0.66) : Math.min(cr.w * 0.7, cr.h * 0.92); }
export function cradleCenter(stage) { const cr = cradleOf(stage); return { x: cr.x + cr.w / 2, y: cr.y + cr.h * (v3.on ? 0.2 : 0.36) }; }

// ---- the world from a world-state object (play screen, title background, shots) --------------------------------------------
export function drawWorldState(ctx, rect, ws, opt = {}) {
  if (v3.on) return publishWorld(rect, ws, opt);
  const cam = drawWorld(ctx, rect, ws);
  const f = ws.f;
  if (f) {
    const gx = cam.X(f.x), gy = cam.Y(f.y), size = rotorSize(rect);
    const gnd = groundAt(ws.cond, f.x), sy = cam.Y(gnd), hgt = Math.max(0, f.y - gnd), k = clamp(1 - hgt / 60, 0.25, 1);
    ctx.save(); ctx.globalAlpha = 0.28 * k; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(gx, sy + 2, size * 0.46 * (0.6 + 0.4 * k), size * 0.09, 0, 0, TAU); ctx.fill(); ctx.restore();
    const b = ws.blend || 0;
    if (f.landed) {
      // resting on its side on the ground
      ctx.save(); ctx.translate(gx, sy - size * 0.05); ctx.rotate(f.x >= 0 ? 1.3 : -1.3); ctx.translate(0, -size * 0.5);
      drawCopter(ctx, 0, 0, size, f.rotor, f.rev, 0, 0, { live: true });
      ctx.restore();
    } else if (opt.cradle && b > 0) {
      const c = opt.cradle, px = lerp(gx, c.x, b), py = lerp(gy, c.y, b), sz = lerp(size, c.size, b);
      drawCopter(ctx, px, py, sz, f.rotor, f.rev, f.s, f.tilt, { live: true });
    } else drawCopter(ctx, gx, gy, size, f.rotor, f.rev, f.s, f.tilt, { live: true });
  }
  return cam;
}

// With the 3D layer on, the world and the toy are drawn by the presenter: publish what to show and return the same camera mapping.
function publishWorld(rect, ws, opt) {
  const cam = makeCam(rect, ws.cam), f = ws.f;
  v3.view = { rect: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, ws };
  if (f) {
    const gx = cam.X(f.x), gy = cam.Y(f.y), size = rotorSize(rect), gnd = groundAt(ws.cond, f.x), sy = cam.Y(gnd), b = ws.blend || 0;
    if (f.landed) {
      // resting on its side: the hub sits where the 2D art rotates the toy about the ground contact point
      const rot = f.x >= 0 ? 1.3 : -1.3;
      v3.toy = { x: gx + Math.sin(rot) * size * 0.5, y: sy - size * 0.05 - Math.cos(rot) * size * 0.5, size, rotor: f.rotor, rev: f.rev, s: 0, tilt: 0, roll: rot, blend: 0, hands: 0, rub: 0, press: 0, charge: 0, hot: 0, landed: true, sx: gx, sy };
    } else if (opt.cradle && b > 0) {
      const c = opt.cradle;
      v3.toy = { x: lerp(gx, c.x, b), y: lerp(gy, c.y, b), size: lerp(size, c.size, b), rotor: f.rotor, rev: f.rev, s: f.s, tilt: f.tilt, roll: 0, blend: b, hands: b, rub: 0, press: 0, charge: 0, hot: 0, landed: false, sx: gx, sy };
    } else v3.toy = { x: gx, y: gy, size, rotor: f.rotor, rev: f.rev, s: f.s, tilt: f.tilt, roll: 0, blend: 0, hands: 0, rub: 0, press: 0, charge: 0, hot: 0, landed: false, sx: gx, sy };
  } else v3.toy = null;
  return cam;
}

// ---- the cradle: two palms, the shaft, the spin meter ---------------------------------------------------------------------------
function drawHands(ctx, c, size, rub, alpha) {
  // two real-looking palms pressed either side of the shaft: shaded skin, four jointed fingers, a thumb, a sleeve cuff.
  const off = clamp(rub, -1, 1) * size * 0.11, u = size;
  ctx.save(); ctx.globalAlpha *= alpha;
  const skinG = (side) => { const g = ctx.createLinearGradient(-0.11 * u, 0, 0.11 * u, 0); const l = '#f6cfaa', m = '#e0a57c', d = '#b97c58'; g.addColorStop(0, side < 0 ? l : d); g.addColorStop(0.5, m); g.addColorStop(1, side < 0 ? d : l); return g; };
  const capsule = (x, y, w, h, ang) => { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); roundPath(ctx, -w / 2, -h, w, h, w / 2); ctx.fill(); ctx.stroke(); ctx.restore(); };
  const hand = (side, dy) => {
    const x = c.x + side * u * 0.155, y = c.y + u * 0.62 + dy;
    ctx.save(); ctx.translate(x, y); ctx.scale(side, 1); // draw the right-hand version, mirrored for the left
    // contact shadow on the shaft side
    ctx.fillStyle = 'rgba(40,20,5,0.18)'; ctx.beginPath(); ctx.ellipse(-0.085 * u, -0.02 * u, 0.03 * u, 0.3 * u, 0, 0, TAU); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.2, u * 0.012); ctx.strokeStyle = 'rgba(88,44,22,0.6)';
    // sleeve
    const sg = ctx.createLinearGradient(-0.12 * u, 0, 0.14 * u, 0); sg.addColorStop(0, '#3b5f93'); sg.addColorStop(0.5, '#27446f'); sg.addColorStop(1, '#16294a');
    ctx.fillStyle = sg; roundPath(ctx, -0.115 * u, 0.2 * u, 0.25 * u, 0.2 * u, 0.04 * u); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,190,235,0.45)'; ctx.beginPath(); ctx.moveTo(-0.08 * u, 0.22 * u); ctx.lineTo(-0.08 * u, 0.38 * u); ctx.stroke();
    ctx.strokeStyle = 'rgba(88,44,22,0.6)';
    // wrist + palm
    ctx.fillStyle = skinG(side);
    roundPath(ctx, -0.095 * u, -0.1 * u, 0.2 * u, 0.34 * u, 0.07 * u); ctx.fill(); ctx.stroke();
    // thumb along the outer edge, pointing up and in
    ctx.fillStyle = skinG(side);
    capsule(0.1 * u, 0.0 * u, 0.062 * u, 0.2 * u, -0.28);
    // four fingers, pressed on the shaft: index nearest the top
    const fl = [0.27, 0.31, 0.28, 0.21];
    for (let i = 0; i < 4; i++) {
      const fx = -0.07 * u + i * 0.048 * u, ang = (i - 1.5) * 0.045;
      ctx.fillStyle = skinG(side);
      capsule(fx, -0.07 * u, 0.047 * u, fl[i] * u, ang);
      // knuckle creases
      ctx.save(); ctx.translate(fx, -0.07 * u); ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(110,56,30,0.45)'; ctx.lineWidth = Math.max(1, u * 0.008);
      for (const k of [0.4, 0.68]) { ctx.beginPath(); ctx.moveTo(-0.017 * u, -fl[i] * u * k); ctx.lineTo(0.017 * u, -fl[i] * u * k); ctx.stroke(); }
      ctx.restore();
    }
    // palm sheen
    ctx.fillStyle = 'rgba(255,240,220,0.22)'; ctx.beginPath(); ctx.ellipse(-0.01 * u, 0.06 * u, 0.04 * u, 0.09 * u, -0.1, 0, TAU); ctx.fill();
    ctx.restore();
  };
  hand(-1, off); hand(1, -off);
  ctx.restore();
}

function drawMeter(ctx, L, state, f) {
  const stage = L.stage, A = state.aim, run = state.run;
  const fs = Math.max(L.fs.small + 2, minF());
  const cr = cradleOf(stage);
  const gw = Math.max(26, Math.round(fs * 1.5)), gx = stage.x + stage.w - gw - 26, gy = stage.y + stage.h * 0.16, gh = Math.min(stage.h * 0.62, cr.y + cr.h - 10 - gy);
  if (gh < 90) return;
  const ro = ROTORS[A.tray[A.sel] ?? (f ? f.rotor : 0)];
  const flying = run.phase !== 'aim' && f;
  const v = flying ? clamp(f.s, 0, 1.2) / CHARGE_MAX : clamp(A.charge, 0, CHARGE_MAX) / CHARGE_MAX;
  const yOf = (c) => gy + gh - gh * (c / CHARGE_MAX);
  // a bamboo tube: round shading across the width, brass rim, node rings
  roundPath(ctx, gx - 3, gy + 5, gw + 6, gh, (gw + 6) / 2); ctx.fillStyle = 'rgba(2,14,6,0.38)'; ctx.fill();
  roundPath(ctx, gx - 3, gy - 3, gw + 6, gh + 6, (gw + 6) / 2);
  { const g = ctx.createLinearGradient(gx - 3, 0, gx + gw + 3, 0); g.addColorStop(0, '#8a6a2a'); g.addColorStop(0.3, '#e9cf7e'); g.addColorStop(0.6, '#c49a42'); g.addColorStop(1, '#6e4e18'); ctx.fillStyle = g; ctx.fill(); }
  roundPath(ctx, gx, gy, gw, gh, gw / 2);
  { const g = ctx.createLinearGradient(gx, 0, gx + gw, 0); g.addColorStop(0, '#04141c'); g.addColorStop(0.35, '#0f3340'); g.addColorStop(1, '#061a24'); ctx.fillStyle = g; ctx.fill(); }
  if (!flying) {
    const [a, b] = ro.sweet;
    ctx.fillStyle = 'rgba(255,205,70,0.55)'; ctx.fillRect(gx + 3, yOf(b), gw - 6, yOf(a) - yOf(b));
    ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2; ctx.strokeRect(gx + 3, yOf(b), gw - 6, yOf(a) - yOf(b));
    ctx.fillStyle = 'rgba(230,70,50,0.38)'; ctx.fillRect(gx + 3, gy + 3, gw - 6, yOf(OVERHEAT) - gy - 3);
  }
  const fh = Math.max(0, gh * v);
  if (fh > 2) {
    roundPath(ctx, gx + 3, gy + gh - fh, gw - 6, fh, (gw - 6) / 2);
    const pg = ctx.createLinearGradient(0, gy + gh, 0, gy); pg.addColorStop(0, '#39c1a8'); pg.addColorStop(0.7, '#f0c040'); pg.addColorStop(1, '#ec6a3c');
    ctx.fillStyle = pg; ctx.fill();
    ctx.save(); roundPath(ctx, gx + 3, gy + gh - fh, gw - 6, fh, (gw - 6) / 2); ctx.clip();
    const hl = ctx.createLinearGradient(gx + 3, 0, gx + gw - 3, 0); hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.25, 'rgba(255,255,255,0.55)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,20,10,0.25)');
    ctx.fillStyle = hl; ctx.fillRect(gx + 3, gy, gw - 6, gh); ctx.restore();
  }
  // node rings of the culm
  ctx.save(); ctx.strokeStyle = 'rgba(233,207,126,0.55)'; ctx.lineWidth = 2;
  for (let n = 1; n < 6; n++) { const yy = gy + (gh * n) / 6; ctx.beginPath(); ctx.moveTo(gx - 3, yy); ctx.lineTo(gx + gw + 3, yy); ctx.stroke(); }
  ctx.restore();
  if (state.hint && run.phase === 'aim') {
    const hy = yOf(state.hint.adv.charge);
    ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.moveTo(gx - 12, hy); ctx.lineTo(gx - 1, hy - 9); ctx.lineTo(gx - 1, hy + 9); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#f6fbf0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.max(fs - 2, minF())}px ${FONT}`;
  ctx.fillText('Spin', gx + gw / 2, gy - 8);
  if (!flying && A.perfectNow) pill(ctx, 'Perfect!', gx + gw / 2 - gw * 0.4, gy + gh + 24, Math.max(fs - 1, minF()), 'rgba(255,205,70,0.95)', '#4a2c00');
}

function drawCradle(ctx, L, state) {
  const A = state.aim, run = state.run, stage = L.stage, cr = cradleOf(stage);
  const size = cradleSize(cr), c = cradleCenter(stage);
  const idx = A.tray[A.sel] ?? 0;
  if (v3.on) {
    // the presenter draws the rotor and the two hands in 3D: publish where, how big and what the hands do
    if (run.phase === 'aim') v3.toy = { x: c.x, y: c.y, size, rotor: idx, rev: A.rev, s: clamp(A.charge, 0, 1.1), tilt: A.lean * 0.15, roll: 0, blend: 1, hands: 1, rub: A.rubDir, press: A.drag || A.keyRub ? 1 : 0.25, charge: A.charge, hot: A.hotT, landed: false, speed: A.speed, sx: c.x, sy: c.y };
  } else {
    if (run.phase === 'aim') drawCopter(ctx, c.x, c.y, size, idx, A.rev, clamp(A.charge, 0, 1.1), A.lean * 0.15, { live: true });
    drawHands(ctx, c, size, A.rubDir, 1);
  }
  if (run.phase === 'aim' && A.charge < 0.04 && !state.dec) {
    const fs = Math.max(L.fs.small + 2, minF()), a = 0.5 + 0.5 * Math.sin(state.t * 3);
    ctx.save(); ctx.globalAlpha = 0.55 + 0.4 * a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const ay = c.y + size * 0.5, ax = c.x;
    ctx.beginPath(); ctx.moveTo(ax - 52 - a * 6, ay); ctx.lineTo(ax + 52 + a * 6, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax - 40 - a * 6, ay - 10); ctx.lineTo(ax - 52 - a * 6, ay); ctx.lineTo(ax - 40 - a * 6, ay + 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax + 40 + a * 6, ay - 10); ctx.lineTo(ax + 52 + a * 6, ay); ctx.lineTo(ax + 40 + a * 6, ay + 10); ctx.stroke();
    ctx.restore();
    pill(ctx, 'Rub the shaft side to side, then let go', c.x, ay - fs * 1.9, fs, 'rgba(10,32,20,0.72)');
  }
}

// ---- panel: tray and the lean slider ------------------------------------------------------------------------------------------------
function statBar(ctx, x, y, w, v, col) {
  roundPath(ctx, x, y, w, 6, 3); ctx.fillStyle = 'rgba(20,40,28,0.2)'; ctx.fill();
  roundPath(ctx, x, y, Math.max(6, w * clamp(v, 0, 1)), 6, 3); ctx.fillStyle = col; ctx.fill();
}
function drawTray(ctx, L, state) {
  const A = state.aim, hint = state.hint, dec = state.dec;
  L.tray.forEach((r, i) => {
    const idx = A.tray[i];
    if (idx === undefined) return;
    const ro = ROTORS[idx], sel = A.sel === i;
    const rec = hint && hint.adv.rotor.id === idx || (dec && dec.adv && dec.phase !== 'think' && dec.adv.rotor.id === idx);
    panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: sel ? 'rgba(40,90,60,0.98)' : 'rgba(20,60,40,0.92)', stroke: sel ? '#ffe08a' : 'rgba(255,255,255,0.3)' });
    if (sel) { ctx.save(); roundPath(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 16); ctx.lineWidth = 4; ctx.strokeStyle = '#2c8a4c'; ctx.stroke(); ctx.restore(); }
    if (rec) { ctx.save(); roundPath(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 20); ctx.lineWidth = 3; ctx.strokeStyle = '#ffc94a'; ctx.stroke(); ctx.restore(); }
    const sz = Math.min(r.w * 0.66, r.h * 0.9);
    ctx.save(); roundPath(ctx, r.x + 3, r.y + 3, r.w - 6, r.h - 6, 16); ctx.clip();
    drawCopter(ctx, r.x + r.w / 2, r.y + r.h * 0.3, sz, idx, 0.5 + idx * 0.7, 0, 0, { view: 0.04 });
    ctx.restore();
    const fs = Math.round(Math.max(L.fs.small - 1, minF(), 12));
    ctx.fillStyle = '#fff6d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const px = fit(ctx, ro.name, r.w - 14, fs + 2);
    ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(ro.name, r.x + r.w / 2, r.y + r.h * 0.74);
    const bx = r.x + r.w * 0.14, bw = r.w * 0.72;
    if (r.h > 112) {
      statBar(ctx, bx, r.y + r.h * 0.8, bw, ro.lift / 48, '#2c8a4c');
      statBar(ctx, bx, r.y + r.h * 0.89, bw, 1 - ro.vt / 6.4, '#5a7fa8');
    }
  });
}
function drawLean(ctx, L, state) {
  const r = L.lean, A = state.aim, run = state.run, fs = Math.max(L.fs.lab, minF());
  const disabled = run.phase !== 'aim';
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(14,52,32,0.84)', stroke: 'rgba(255,255,255,0.28)' });
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillStyle = '#f6fbf0'; ctx.fillText('Lean at release', r.x + 20, r.y + fs + 8);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd36a';
  const lv = A.lean; ctx.fillText(Math.abs(lv) < 0.05 ? 'upright' : `${lv < 0 ? 'left' : 'right'} ${Math.round(Math.abs(lv) * 100)}%`, r.x + r.w - 20, r.y + fs + 8);
  const t = trackOf(r), cy = t.y + t.h / 2, tr = Math.max(7, t.h * 0.26);
  roundPath(ctx, t.x - 2, cy - tr / 2 - 2, t.w + 4, tr + 4, (tr + 4) / 2); ctx.fillStyle = '#c9a24c'; ctx.fill();
  roundPath(ctx, t.x, cy - tr / 2, t.w, tr, tr / 2);
  { const gg = ctx.createLinearGradient(0, cy - tr / 2, 0, cy + tr / 2); gg.addColorStop(0, '#031109'); gg.addColorStop(1, '#14392a'); ctx.fillStyle = gg; ctx.fill(); }
  ctx.fillStyle = 'rgba(233,207,126,0.8)'; ctx.fillRect(t.x + t.w / 2 - 1.5, cy - tr / 2 - 6, 3, tr + 12);
  const v01 = (A.lean + 1) / 2, fx = t.x + t.w * v01, mid = t.x + t.w / 2;
  const g = ctx.createLinearGradient(t.x, 0, t.x + t.w, 0); g.addColorStop(0, '#3a9be0'); g.addColorStop(0.5, '#39c1a8'); g.addColorStop(1, '#f0b44c');
  roundPath(ctx, Math.min(mid, fx), cy - tr / 2, Math.max(3, Math.abs(fx - mid)), tr, tr / 2); ctx.fillStyle = g; ctx.fill();
  const hintLean = state.hint ? state.hint.adv.lean : (state.dec && state.dec.phase !== 'think' && state.dec.adv ? state.dec.adv.lean : null);
  if (hintLean !== null) {
    const hx = t.x + t.w * clamp((hintLean + 1) / 2, 0, 1);
    ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.moveTo(hx, cy - tr / 2 - 4); ctx.lineTo(hx - 9, cy - tr / 2 - 16); ctx.lineTo(hx + 9, cy - tr / 2 - 16); ctx.closePath(); ctx.fill();
  }
  const kr = Math.max(14, t.h * 0.46);
  ctx.beginPath(); ctx.arc(fx, cy, kr, 0, TAU);
  ctx.save(); ctx.shadowColor = 'rgba(0,10,4,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  const kg = ctx.createRadialGradient(fx - kr * 0.35, cy - kr * 0.4, 1, fx, cy, kr);
  kg.addColorStop(0, disabled ? '#eef1f3' : '#fff6d0'); kg.addColorStop(0.35, disabled ? '#c8d0d6' : '#e8c460'); kg.addColorStop(1, disabled ? '#8e9aa4' : '#8a5a12'); ctx.fillStyle = kg; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(fx, cy, kr, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,190,0.85)'; ctx.stroke();
}

function drawWindStrip(ctx, L, state) {
  const r = L.wind, ws = state.ws, cond = ws.cond;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: 'rgba(12,50,30,0.8)', stroke: 'rgba(255,255,255,0.28)' });
  const wind = cond ? cond.wind : 0, right = wind >= 0, cy = r.y + r.h / 2, ax = r.x + 38;
  ctx.save(); ctx.strokeStyle = '#bfe8ff'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const dir = right ? 1 : -1, sz = Math.min(20, r.h * 0.32);
  ctx.beginPath(); ctx.moveTo(ax - dir * sz, cy); ctx.lineTo(ax + dir * sz, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ax + dir * (sz - sz * 0.7), cy - sz * 0.6); ctx.lineTo(ax + dir * sz, cy); ctx.lineTo(ax + dir * (sz - sz * 0.7), cy + sz * 0.6); ctx.stroke();
  ctx.restore();
  const fs = Math.max(L.fs.wind, minF()), sc = SCENES[ws.scene];
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#f6fbf0';
  const label = `Wind ${right ? 'to the right' : 'to the left'} ${Math.abs(wind).toFixed(1)} m/s${sc.gust >= 1 ? ' · gusty' : ''}`;
  const px = fit(ctx, label, r.w * 0.62 - 50, fs);
  ctx.font = `700 ${px}px ${FONT}`; ctx.fillText(label, ax + 30, cy);
  const n = cond ? cond.thermals.length : 0, l2 = n ? `${n} warm column${n > 1 ? 's' : ''}` : 'no thermals';
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffe9a8';
  const p2 = fit(ctx, l2, r.w * 0.34, Math.round(fs * 0.9));
  ctx.font = `600 ${p2}px ${FONT}`; ctx.fillText(l2, r.x + r.w - 16, cy);
}

function drawScoreBlock(ctx, L, state) {
  const r = L.score, run = state.run;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(12,50,30,0.8)', stroke: 'rgba(255,255,255,0.28)' });
  const cx = r.x + r.w / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const sm = Math.max(L.fs.small, minF());
  const nm = SCENES[state.ws.scene].name;
  const head = run.mode === 'free' ? `${nm} · free flight` : `${nm} · flight ${Math.min(run.idx + 1, SESSION_FLIGHTS)} of ${SESSION_FLIGHTS}`;
  const px = fit(ctx, head, r.w - 20, sm, 600);
  ctx.font = `600 ${px}px ${FONT}`; ctx.fillStyle = '#cfeacb'; ctx.fillText(head, cx, r.y + px + 6);
  const big = Math.min(L.fs.big, r.h - px - 16);
  ctx.font = `800 ${big}px ${DISPLAY}`; ctx.fillStyle = '#fff'; ctx.fillText(String(Math.round(state.scoreShown ?? 0)), cx, r.y + r.h - 10);
  ctx.font = `600 ${Math.max(sm - 1, minF())}px ${FONT}`; ctx.fillStyle = '#cfeacb'; ctx.textAlign = 'right';
  ctx.fillText('points', r.x + r.w - 12, r.y + r.h - 12);
}

function edgeMarkers(ctx, cam, state, L) {
  const ws = state.ws, cond = ws.cond, st = L.stage, fs = Math.max(L.fs.small - 1, minF());
  if (!cond) return;
  const ref = ws.f ? ws.f.x : 0;
  cond.targets.forEach((t, i) => {
    const sx = cam.X(t.x);
    if (sx >= st.x + 36 && sx <= st.x + st.w - 36) return;
    const left = sx < st.x + 36, ex = left ? st.x + 70 : st.x + st.w - 120;
    pill(ctx, `${left ? '◀' : '▶'} ${Math.round(Math.abs(t.x - ref))} m ring`, ex, st.y + st.h * (0.42 + i * 0.07), fs, 'rgba(10,32,20,0.72)', i === 0 ? '#ffd870' : '#ffffff');
  });
}

// ---- the whole play screen -------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const L = layoutOf(state), run = state.run, watch = run.mode === 'watch', stage = L.stage, ws = state.ws, f = ws.f;
  if (!v3.on) { ctx.fillStyle = PALS[ws.scene].ground[2]; ctx.fillRect(0, 0, W, H); }
  let sx = 0, sy = 0;
  if (state.shake > 0) { const k = state.shake * 6; sx = Math.sin(state.t * 90) * k; sy = Math.cos(state.t * 77) * k; }
  ctx.save(); ctx.translate(sx, sy);
  const cr = cradleOf(stage), cc = cradleCenter(stage);
  const cam = drawWorldState(ctx, stage, ws, { cradle: { x: cc.x, y: cc.y, size: cradleSize(cr) } });
  ctx.restore();
  const pathSrc = state.hint ? state.hint.path : (state.dec && state.dec.phase !== 'think' ? state.dec.path : null);
  if (pathSrc && run.phase === 'aim') {
    ctx.save(); ctx.beginPath(); ctx.rect(stage.x, stage.y, stage.w, stage.h); ctx.clip();
    ctx.setLineDash([2, 10]); ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,214,90,0.9)';
    ctx.beginPath(); pathSrc.forEach((p, i) => { const x = cam.X(p.x), y = cam.Y(p.y); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); ctx.restore();
  }
  if (run.phase === 'fly' && f && Math.abs(f.steer) > 0.08) {
    const gx = cam.X(f.x), gy = cam.Y(f.y), d = Math.sign(f.steer);
    ctx.save(); ctx.globalAlpha = clamp(Math.abs(f.steer), 0, 1) * 0.8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const x = gx + d * (rotorSize(stage) * 0.7 + i * 14); ctx.beginPath(); ctx.moveTo(x - d * 6, gy - 10); ctx.lineTo(x + d * 4, gy); ctx.lineTo(x - d * 6, gy + 10); ctx.stroke(); }
    ctx.restore();
  }
  for (const p of state.pops) {
    const k = p.t / p.max, x = cam.X(p.x), y = cam.Y(p.y) - 18 - k * 46;
    const size = Math.round(clamp(L.fs.mid * 1.4 * p.size, 22, 56));
    ctx.save(); ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    ctx.font = `800 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = Math.max(3, size * 0.14); ctx.strokeStyle = 'rgba(8,36,20,0.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(p.text, x, y); ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
    ctx.restore();
  }
  if (run.phase === 'aim' || ws.blend > 0.02) {
    ctx.save(); ctx.globalAlpha = clamp(ws.blend, 0, 1);
    drawCradle(ctx, L, state);
    ctx.restore();
  }
  drawMeter(ctx, L, state, f);
  edgeMarkers(ctx, cam, state, L);
  if (f && run.phase !== 'aim') {
    const fs = Math.max(L.fs.small, minF()), hgt = Math.max(0, f.y - f.g0 - START_H);
    const py = stage.y + 22 + (stage.y < 40 ? 34 : 0); // clear of the kit's preview pill when the stage reaches the top of the screen
    pill(ctx, `${Math.round(hgt)} m up · peak ${Math.round(f.peak - f.g0 - START_H)} m`, stage.x + 14 + 100, py, fs, 'rgba(10,32,20,0.72)');
    if (ws.cond) pill(ctx, `lanterns ${f.got}/${ws.cond.lanterns.length}`, stage.x + stage.w - 14 - 70, py, fs, 'rgba(10,32,20,0.72)', '#ffd870');
  }
  const big = L.fs.btn;
  if (!watch) {
    drawButton(ctx, L.pause, '❚❚', { dark: true, size: big });
    drawButton(ctx, L.think, state.hint ? 'Hint on' : 'Think', { primary: !state.hint, active: !!state.hint, size: Math.round(big * 0.9) });
  } else {
    // a plain label, not a dead button: the real controls (Pause, thinking time, Exit) are in the bottom row
    ctx.save(); ctx.fillStyle = 'rgba(246,251,240,0.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const wp = Math.max(Math.round(big * 0.8), minF());
    ctx.font = `800 ${wp}px ${FONT}`;
    ctx.fillText('Watch &', L.pause.x + L.pause.w / 2, L.pause.y + L.pause.h / 2 - wp * 0.6);
    ctx.fillText('Learn', L.pause.x + L.pause.w / 2, L.pause.y + L.pause.h / 2 + wp * 0.6);
    ctx.restore();
  }
  drawScoreBlock(ctx, L, state);
  drawWindStrip(ctx, L, state);
  drawTray(ctx, L, state);
  drawLean(ctx, L, state);
  if (watch) {
    const D = L.demo, st = state.settings;
    drawButton(ctx, D.dec, '−', { size: big, disabled: st.thinkIdx === 0, dark: true });
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { size: Math.round(big * 0.9), primary: true });
    drawButton(ctx, D.inc, '+', { size: big, disabled: false, dark: true });
    drawButton(ctx, D.exit, 'Exit', { size: Math.round(big * 0.9), dark: true });
    const dec = state.dec;
    if (dec) {
      const label = dec.phase === 'think' ? `Thinking… ${Math.max(0, Math.ceil(dec.dur - dec.t))} s` : dec.phase === 'reveal' ? 'My choice' : 'Rubbing';
      pill(ctx, label, stage.x + stage.w / 2, stage.y + stage.h * 0.1, Math.max(L.fs.mid, minF()), 'rgba(10,32,20,0.78)', dec.phase === 'think' ? '#ffd36a' : '#9ff0b0');
    } else if (run.phase === 'fly') pill(ctx, 'Steering by itself', stage.x + stage.w / 2, stage.y + stage.h * 0.1, Math.max(L.fs.mid, minF()), 'rgba(10,32,20,0.78)', '#9ff0b0');
  } else {
    const hr = L.hint;
    ctx.fillStyle = 'rgba(246,251,240,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const msg = run.phase === 'aim' ? (state.hint ? 'Gold marks show the suggested rotor, lean and spin' : 'Pick a rotor, set the lean, then rub the shaft and let go') : run.phase === 'fly' ? 'Hold left or right of the rotor to lean it (it costs spin)' : '';
    const px = fit(ctx, msg, hr.w - 20, Math.max(L.fs.small + 1, minF()), 600);
    ctx.font = `600 ${px}px ${FONT}`; ctx.fillText(msg, hr.x + hr.w / 2, hr.y + hr.h / 2);
  }
  if (state.hint && run.phase === 'aim') {
    const why = state.hint.why, px = Math.max(L.fs.small, minF());
    ctx.font = `600 ${px}px ${FONT}`;
    const maxW = Math.min(stage.w - 40, 620);
    const lines = wrap(ctx, `Think: ${why}.`, maxW - 28);
    const hh = lines.length * px * 1.3 + 22, hx = stage.x + (stage.w - maxW) / 2, hy = stage.y + 54;
    roundPath(ctx, hx, hy, maxW, hh, 16); ctx.fillStyle = 'rgba(10,32,20,0.86)'; ctx.fill(); ctx.strokeStyle = '#ffc94a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff6d8'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, hx + 14, hy + 12 + px * (1 + i * 1.3)));
  }
  if (state.banner) {
    const b = state.banner, k = clamp(b.t / 0.25, 0, 1), a = b.t > b.max - 0.4 ? clamp((b.max - b.t) / 0.4, 0, 1) : 1;
    const cx = stage.x + stage.w / 2, cy = stage.y + stage.h * 0.36;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const bs = Math.round(Math.min(stage.w * 0.2, 130));
    ctx.font = `800 ${bs}px ${DISPLAY}`; ctx.lineWidth = bs * 0.14; ctx.strokeStyle = 'rgba(6,36,20,0.85)'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.col || '#fff'; ctx.fillText(b.text, 0, 0);
    ctx.font = `700 ${Math.round(bs * 0.24)}px ${FONT}`; ctx.lineWidth = bs * 0.06;
    let yy = bs * 0.34;
    for (const line of b.sub) { ctx.strokeText(line, 0, yy); ctx.fillStyle = '#f0fbe6'; ctx.fillText(line, 0, yy); yy += bs * 0.3; }
    ctx.restore();
  }
  if (state.toastT > 0 && state.toast) {
    const a = Math.min(1, state.toastT / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    const px = Math.max(L.fs.toast, minF());
    ctx.font = `700 ${px}px ${FONT}`;
    const lines = wrap(ctx, state.toast, Math.min(stage.w - 50, 600));
    const w = Math.min(stage.w - 30, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 40), h = lines.length * px * 1.3 + 22;
    const x = stage.x + (stage.w - w) / 2, y = stage.y + stage.h * 0.2;
    roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = 'rgba(10,32,20,0.88)'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 12 + px * (1 + i * 1.3)));
    ctx.restore();
  }
}
