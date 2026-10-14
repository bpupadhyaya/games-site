// The road picture and the stage profile strip. Reads state, never writes it (camera easing lives in game.js).
//
// The road is drawn in "race view": the camera follows one rider, near riders are spaced at true distance and far ones are
// squeezed so a whole race fits in one frame. The road tilts with the real gradient under the camera rider.
import { TEAMS, fmtGapInt, fmtTime } from './sim.js';
import { drawCyclist, drawBackdrop, drawHillside, drawTree, drawBuilding, hash, SKINS, TONES } from './art.js';
import { FONT, DISPLAY, roundPath } from './ui.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
let ASPH = null;
// the speckle tile is made by main.js (DOM wiring lives there): globalThis.__asphaltTile
function asphaltPattern(ctx) {
  if (ASPH) return ASPH;
  const tile = globalThis.__asphaltTile;
  if (!tile) return null;
  try { ASPH = ctx.createPattern(tile, 'repeat'); } catch { ASPH = null; }
  return ASPH;
}
export const SCENE_PX_PER_M = 2.6;

export const unitFor = (rc) => clamp(Math.min(rc.w / 540, rc.h / 500), 0.62, 1.7);

// distance relative to the camera rider -> pixels. Linear near the camera (so a pack looks like a pack), squeezed beyond.
export function warp(d, unit) {
  const a = Math.abs(d), k = 11 * unit, near = 20;
  return Math.sign(d) * (a <= near ? a * k : near * k + 80 * unit * Math.log(1 + (a - near) / 30));
}

export function riderSpriteScale(unit) { return 88 * unit; }

// display position of a rider between two simulation steps
export const shownS = (r, alpha) => r.sPrev + (r.s - r.sPrev) * alpha;

export function drawRoadView(ctx, st, L) {
  const f3w = globalThis.__riders3d;
  if (f3w && f3w.drawWorld && !f3w.lost && !f3w.stage.contextLost && drawRoadViewWorld(ctx, st, L)) return;
  drawRoadViewFlat(ctx, st, L);
}

function drawRoadViewFlat(ctx, st, L) {
  const P = L.play, rc = P.road, R = st.race, C = R.course, unit = unitFor(rc), cam = st.cam;
  const tone = TONES[C.tone] ? C.tone : 'morning', T = TONES[tone];
  ctx.save();
  ctx.beginPath(); ctx.rect(rc.x, rc.y, rc.w, rc.h); ctx.clip();
  const vu = clamp(rc.h / 520, 0.75, 1.7), su = Math.max(unit, vu * 0.85);
  const fx = rc.x + rc.w * 0.4, y0 = rc.y + rc.h * 0.66, tilt = cam.tilt, tt = Math.tan(tilt);
  const horizon = rc.y + rc.h * 0.45 - tilt * 50 * unit;
  const camS = cam.s;
  drawBackdrop(ctx, rc, tone, camS, horizon, su);
  drawHillside(ctx, rc, tone, camS, horizon + 36 * su, su, tilt, clamp(C.gradeAt(camS) * 12, 0, 1));
  const yR = (x) => y0 - (x - fx) * tt;
  const px = SCENE_PX_PER_M * unit;
  const sAt = (x) => camS + (x - fx) / px;                  // scenery uses its own steady scale
  const roadH = 46 * unit;

  // distant trees and buildings behind the road (slower parallax)
  const slot = 22, sFrom = Math.floor((camS - (fx - rc.x) / px * 1.7) / slot), sTo = Math.ceil((camS + (rc.x + rc.w - fx) / px * 1.7) / slot);
  for (let i = sFrom; i <= sTo; i++) {
    const wS = i * slot, land = C.landAt(clamp(wS, 0, C.L - 1)), h1 = hash(i * 3 + C.index * 101), h2 = hash(i * 7 + 5 + C.index * 31);
    const x = fx + (wS - camS) * px * 0.72 + (h1 - 0.5) * 20 * unit;
    if (x < rc.x - 80 || x > rc.x + rc.w + 80) continue;
    const yb = yR(x) - 30 * unit - (h2 * 26) * unit;
    if (land === 'town' && h1 > 0.3) drawBuilding(ctx, x, yb + 20 * unit, (60 + h2 * 80) * unit, (50 + h1 * 30) * unit, i + C.index * 13, tone);
    else if (land === 'farm' || land === 'valley') { if (h1 > 0.4) drawTree(ctx, x, yb + 12 * unit, (70 + h2 * 50) * unit, h2 > 0.6 ? 2 : 0, true); }
    else if (land === 'forest') { if (h1 > 0.2) drawTree(ctx, x, yb + 14 * unit, (90 + h2 * 60) * unit, 0, true); }
    else if (land === 'terrace') { if (h1 > 0.4) drawTree(ctx, x, yb + 10 * unit, (56 + h2 * 36) * unit, h2 > 0.5 ? 1 : 0, true); }
    else if (land === 'coast') { if (h1 > 0.45) drawTree(ctx, x, yb + 10 * unit, (64 + h2 * 24) * unit, 2, true); }
  }
  // ground under the road
  const gg = ctx.createLinearGradient(0, y0, 0, rc.y + rc.h);
  gg.addColorStop(0, T.ground[0]); gg.addColorStop(1, T.ground[1]);
  ctx.beginPath(); ctx.moveTo(rc.x, rc.y + rc.h + 4); ctx.lineTo(rc.x, yR(rc.x) + roadH * 0.5);
  ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + roadH * 0.5); ctx.lineTo(rc.x + rc.w, rc.y + rc.h + 4); ctx.closePath(); ctx.fillStyle = gg; ctx.fill();
  // terraces: parallel bands below the road, drifting with the world
  for (let b = 0; b < 5; b++) {
    const off = roadH * 0.5 + (16 + b * 46) * unit * (1 + b * 0.18);
    ctx.beginPath(); ctx.moveTo(rc.x, yR(rc.x) + off); ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + off);
    ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + off + 22 * unit * (1 + b * 0.2)); ctx.lineTo(rc.x, yR(rc.x) + off + 22 * unit * (1 + b * 0.2)); ctx.closePath();
    ctx.fillStyle = b % 2 ? 'rgba(90,110,40,0.28)' : 'rgba(255,230,170,0.16)'; ctx.fill();
  }
  // verge: a lighter band along the road
  ctx.beginPath(); ctx.moveTo(rc.x, yR(rc.x) + roadH * 0.5); ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + roadH * 0.5);
  ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + roadH * 0.5 + 10 * unit); ctx.lineTo(rc.x, yR(rc.x) + roadH * 0.5 + 10 * unit); ctx.closePath();
  ctx.fillStyle = 'rgba(255,240,200,0.22)'; ctx.fill();
  // the road
  ctx.beginPath(); ctx.moveTo(rc.x, yR(rc.x) - 2 * unit); ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) - 2 * unit);
  ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + roadH); ctx.lineTo(rc.x, yR(rc.x) + roadH); ctx.closePath();
  ctx.fillStyle = T.road; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2 * unit;
  ctx.beginPath(); ctx.moveTo(rc.x, yR(rc.x) + 1); ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + 1); ctx.moveTo(rc.x, yR(rc.x) + roadH - 2); ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + roadH - 2); ctx.stroke();
  // dashed centre line, scrolling with the world
  ctx.strokeStyle = 'rgba(255,230,140,0.8)'; ctx.lineWidth = 2.5 * unit; ctx.setLineDash([22 * unit, 26 * unit]); ctx.lineDashOffset = (camS * px) % (48 * unit);
  ctx.beginPath(); ctx.moveTo(rc.x, yR(rc.x) + roadH * 0.5); ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + roadH * 0.5); ctx.stroke(); ctx.setLineDash([]);
  // asphalt: aggregate speckle (scrolls with the road), a soft lighting gradient across it, and worn lane edges
  {
    const pat = asphaltPattern(ctx);
    const by0 = Math.min(yR(rc.x), yR(rc.x + rc.w)) - 3 * unit, by1 = Math.max(yR(rc.x), yR(rc.x + rc.w)) + roadH + 1;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(rc.x, yR(rc.x) - 2 * unit); ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) - 2 * unit);
    ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + roadH); ctx.lineTo(rc.x, yR(rc.x) + roadH); ctx.closePath(); ctx.clip();
    if (pat) {
      const sc = Math.max(0.6, unit), off = (camS * px) % (128 * sc);
      try { pat.setTransform(new DOMMatrix().translate(rc.x - off, by0).scale(sc, sc)); } catch { /* old WebView: static speckle */ }
      ctx.globalAlpha = 0.55; ctx.fillStyle = pat; ctx.fillRect(rc.x, by0, rc.w, by1 - by0); ctx.globalAlpha = 1;
    }
    const lg = ctx.createLinearGradient(0, y0 - 40 * unit, 0, y0 + roadH + 40 * unit);
    lg.addColorStop(0, 'rgba(255,240,220,0.10)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = lg; ctx.fillRect(rc.x, by0, rc.w, by1 - by0);
    // tyre-polished darker bands where the wheels run
    ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 5 * unit;
    for (const f of [0.27, 0.75]) { ctx.beginPath(); ctx.moveTo(rc.x, yR(rc.x) + roadH * f); ctx.lineTo(rc.x + rc.w, yR(rc.x + rc.w) + roadH * f); ctx.stroke(); }
    ctx.restore();
    // low dry-stone wall along the near verge in the farmland and terraces, with a few cacti
    const wallH = 15 * unit, wslot = 11 * unit;
    for (let wx = rc.x - ((camS * px) % (wslot * 4)) - wslot * 4; wx < rc.x + rc.w + wslot; wx += wslot) {
      const sIdx = Math.floor((wx - rc.x + camS * px) / wslot), land = C.landAt(clamp((wx - fx) / px + camS, 0, C.L - 1));
      if (land !== 'terrace' && land !== 'farm' && land !== 'valley') continue;
      if (hash(Math.floor(sIdx / 24) * 7 + C.index) < 0.5) continue;
      const hh = hash(sIdx * 3 + 1), top = yR(wx) + roadH + 7 * unit;
      ctx.fillStyle = hh > 0.5 ? '#b9a07a' : '#a68c68'; ctx.fillRect(wx, top - wallH * (0.7 + hh * 0.3), wslot + 0.6, wallH * (0.7 + hh * 0.3) + 5 * unit);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(wx, top + 3 * unit, wslot + 0.6, 2 * unit);
      ctx.fillStyle = 'rgba(255,245,220,0.22)'; ctx.fillRect(wx, top - wallH * (0.7 + hh * 0.3), wslot + 0.6, 2 * unit);
    }
  }
  // km boards, hairpin chevrons, start and finish arches
  const sMin = sAt(rc.x - 60), sMax = sAt(rc.x + rc.w + 60);
  ctx.font = `800 ${Math.round(13 * unit)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let km = Math.max(0, Math.ceil(sMin / 500)); km * 500 <= sMax && km * 500 <= C.L; km++) {
    const s = km * 500, x = fx + (s - camS) * px, y = yR(x) + roadH + 6 * unit;
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 1.5 * unit, y, 3 * unit, 22 * unit);
    const togo = (C.L - s) / 1000;
    roundPath(ctx, x - 30 * unit, y + 14 * unit, 60 * unit, 22 * unit, 5 * unit); ctx.fillStyle = '#f6f0dc'; ctx.fill(); ctx.strokeStyle = '#2c2418'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#2c2418'; ctx.fillText(s >= C.L ? '0 km' : `${togo.toFixed(togo % 1 ? 1 : 0)} km`, x, y + 25.5 * unit);
  }
  for (const hp of C.hairpins) {
    if (hp < sMin || hp > sMax) continue;
    const x = fx + (hp - camS) * px, y = yR(x) - 4 * unit;
    ctx.fillStyle = '#f2b81c'; ctx.fillRect(x - 13 * unit, y - 26 * unit, 26 * unit, 20 * unit);
    ctx.strokeStyle = '#2a2008'; ctx.lineWidth = 2.5 * unit; ctx.beginPath(); ctx.moveTo(x - 7 * unit, y - 21 * unit); ctx.lineTo(x + 5 * unit, y - 16 * unit); ctx.lineTo(x - 7 * unit, y - 11 * unit); ctx.stroke();
    ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x - 1.5 * unit, y - 6 * unit, 3 * unit, 8 * unit);
  }
  const arch = (s, label, col) => {
    const x = fx + (s - camS) * px;
    if (x < rc.x - 140 * unit || x > rc.x + rc.w + 140 * unit) return;
    const y = yR(x), h = 118 * unit, wd = 96 * unit;
    ctx.fillStyle = '#d8d2c0'; ctx.fillRect(x - wd / 2 - 5 * unit, y - h + 8 * unit, 8 * unit, h + roadH * 0.6); ctx.fillRect(x + wd / 2 - 3 * unit, y - h + 8 * unit, 8 * unit, h + roadH * 0.6);
    roundPath(ctx, x - wd / 2 - 10 * unit, y - h - 12 * unit, wd + 20 * unit, 32 * unit, 8 * unit); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.round(18 * unit)}px ${FONT}`; ctx.fillText(label, x, y - h + 5 * unit);
    if (label === 'FINISH') {                   // chequer line across the road
      const n = 8, cw = (roadH + 2) / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; ctx.fillRect(x - 5 * unit + j * 5 * unit, y - 2 * unit + i * cw, 5 * unit, cw); }
    }
  };
  arch(0, 'START', '#1f8a66'); arch(C.L, 'FINISH', '#c92a2f');
  // roadside foreground: pebbles, grass tufts and a few near trees (fast parallax)
  const fslot = 14, f0 = Math.floor(sMin / fslot), f1 = Math.ceil(sMax / fslot);
  for (let i = f0; i <= f1; i++) {
    const x = fx + (i * fslot - camS) * px * 1.15 + (hash(i * 11) - 0.5) * 18 * unit;
    const y = yR(x) + roadH + (14 + hash(i * 5 + 1) * 34) * unit;
    const hh = hash(i * 13 + 2 + C.index);
    if (y > rc.y + rc.h + 20) continue;
    if (hh > 0.8) drawTree(ctx, x, y + 20 * unit, (90 + hash(i) * 60) * unit, hh > 0.92 ? 1 : 0, false);
    else if (hh > 0.45) { ctx.fillStyle = 'rgba(70,92,40,0.7)'; for (let q = 0; q < 3; q++) { ctx.beginPath(); ctx.moveTo(x + q * 4 * unit, y); ctx.lineTo(x + q * 4 * unit - 3 * unit, y - 9 * unit); ctx.lineTo(x + q * 4 * unit + 3 * unit, y); ctx.fill(); } }
    else { ctx.fillStyle = 'rgba(60,40,24,0.35)'; ctx.beginPath(); ctx.ellipse(x, y, 5 * unit, 3 * unit, 0, 0, TAU); ctx.fill(); }
  }

  // ---- riders -----------------------------------------------------------------------------------------------------
  const k = riderSpriteScale(unit), sel = R.riders[st.sel];
  const focusS = cam.s;
  const list = R.riders.map((r, i) => {
    const s = shownS(r, st.alpha), x = fx + warp(s - focusS, unit);
    return { r, i, s, x };
  });
  list.sort((a, b) => ((a.r.id * 5) % 3) - ((b.r.id * 5) % 3) || (a.r.id === sel.id) - (b.r.id === sel.id) || a.x - b.x);
  const off = { ahead: [], behind: [] };
  const f3 = globalThis.__riders3d, items3d = [];
  for (const o of list) {
    if (o.x > rc.x + rc.w + 40 * unit) { off.ahead.push(o); continue; }
    if (o.x < rc.x - 80 * unit) { off.behind.push(o); continue; }
    const r = o.r, row = (r.id * 5) % 3, y = yR(o.x) + roadH * (0.3 + row * 0.27);
    const tm = TEAMS[r.team], mine = r.team === 0 && R.mode !== 'tt' || (R.mode === 'tt' && r.ctl === 'human');
    const phase = st.anim * (4 + r.v * 0.55) + r.id * 1.3;
    const pose = r.mode === 3 && r.fin === null ? 2 : r.mode === 2 || r.draft > 0.25 ? 1 : 0;
    const ghost = r.ctl === 'ghost';
    if (ghost) ctx.globalAlpha = 0.55;
    if (r.mode === 3 && r.fin === null) {          // attack: speed lines
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2 * unit;
      for (let q = 0; q < 3; q++) { const yy = y - (20 + q * 14) * unit; ctx.beginPath(); ctx.moveTo(o.x - (30 + q * 8) * unit, yy); ctx.lineTo(o.x - (70 + q * 14) * unit, yy); ctx.stroke(); }
    }
    const spec = {
      k, phase, spin: st.anim * (3 + r.v * 1.1) + r.id, pose, jersey: tm.jersey, trim: tm.trim, helmet: tm.helmet,
      skin: SKINS[r.id % 4], skinFar: '#3b2417', frame: ghost ? '#8fa' : r.team === 0 ? '#2b2118' : '#242831',
    };
    if (f3 && f3.draw && r.id < f3.max) {
      // contact shadow on the road (2D); the person and the bike are drawn together in one 3D pass below
      ctx.save(); ctx.globalAlpha = 0.3 * (ghost ? 0.55 : 1); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(o.x + 0.02 * k, y + 2, 0.95 * k, k * 0.075, -tilt * 0.9, 0, TAU); ctx.fill(); ctx.restore();
      items3d.push({ id: r.id, x: o.x, y, z: row, tilt: tilt * 0.9, phase: spec.phase, spin: spec.spin, pose, jersey: ghost ? '#8fe8c4' : spec.jersey, trim: spec.trim, helmet: spec.helmet, skin: spec.skin,
        frame: ghost ? '#6fe0b0' : mixHex(spec.jersey, '#0c0d10', 0.2), shorts: ghost ? '#6fe0b0' : undefined, lookKey: `${spec.jersey}|${spec.skin}|${ghost}`, ghost });
    } else drawCyclist(ctx, o.x - 0.5 * k, y, tilt * 0.9, spec);
    ctx.globalAlpha = 1;
    o.y = y;
    o.mine = mine;
  }
  // roadside crowd (real 3D people drawn in the same pass as the riders): dense at the start and finish and in towns, a few elsewhere
  if (f3 && f3.specs && f3.specs.length && items3d.length) {
    const cap = f3.specs.length, slot = 24, SHIRT = ['#f4f1ea', '#d94f3d', '#2f7fe3', '#e8b923', '#1f9d6e', '#7a4fb3', '#f08a3c', '#e8e2d0'];
    const PANTS = ['#2a2f3a', '#4a4036', '#1b2a4a', '#35302a'], HAIR = ['#14100d', '#2a1a10', '#3a2a1e', '#0c0a08'];
    const SKIN2 = ['#8a5a3c', '#6f4328', '#a36a45', '#5a3620', '#c08a60'];
    let n = 0;
    const i0 = Math.floor(sMin / slot), i1 = Math.ceil(sMax / slot);
    for (let i = i0; i <= i1 && n < cap; i++) {
      const wS = i * slot;
      if (wS < -60 || wS > C.L + 80) continue;
      const land = C.landAt(clamp(wS, 0, C.L - 1)), h1 = hash(i * 17 + C.index * 7), h2 = hash(i * 29 + 3);
      const edge = wS < 140 || wS > C.L - 200;
      const cnt = edge ? 2 + (h1 > 0.5 ? 1 : 0) : land === 'town' ? (h1 > 0.35 ? 2 : 0) : h1 > 0.88 ? 1 : 0;
      for (let q = 0; q < cnt && n < cap; q++) {
        const hq = hash(i * 131 + q * 17 + C.index * 5);
        const x = fx + (wS - camS) * px + (q * 13 + h2 * 10) * unit;
        if (x < rc.x - 30 * unit || x > rc.x + rc.w + 30 * unit) continue;
        const far = true;
        const y = yR(x) - (3 + hq * 9) * unit;
        const mood = edge ? (hq > 0.7 ? 3 : hq > 0.35 ? 2 : 1) : hq > 0.8 ? 1 : hq > 0.6 ? 2 : 0;
        items3d.push({ spec: true, id: n++, x, y, z: -1.2 - hq * 1.4, face: 0.35 + hq * 0.7, mood, phase: hq * 9, scale: 0.92 + hash(i + q) * 0.14 - (hq > 0.93 ? 0.3 : 0),
          top: SHIRT[Math.floor(hq * 97) % SHIRT.length], bottoms: PANTS[Math.floor(hq * 53) % PANTS.length], skin: SKIN2[Math.floor(hq * 71) % SKIN2.length], hair: HAIR[Math.floor(hq * 31) % HAIR.length],
          lookKey: `c${Math.floor(hq * 97) % 8}${Math.floor(hq * 53) % 4}${Math.floor(hq * 71) % 5}${Math.floor(hq * 31) % 4}` });
      }
    }
  }
  if (items3d.length) {
    const drawn = f3.draw(ctx, rc, items3d, k, st.anim, tone);
    if (!drawn) for (const it of items3d) if (!it.spec) drawCyclist(ctx, it.x - 0.5 * k, it.y, it.tilt, { k, phase: it.phase, spin: it.spin, pose: it.pose, jersey: it.jersey, trim: it.trim, helmet: it.helmet, skin: it.skin, skinFar: '#3b2417', frame: '#242831' });
  }
  // tags above my riders
  for (const o of list) {
    if (o.y === undefined || !(o.mine || o.r.ctl === 'ghost')) continue;
    const r = o.r, isSel = r.id === sel.id, tx = o.x + 0.2 * k, ty = o.y - 2.3 * k;
    const wf = r.w / r.wpMax;
    ctx.save();
    if (r.ctl === 'ghost') {
      roundPath(ctx, tx - 26 * unit, ty - 14 * unit, 52 * unit, 22 * unit, 11 * unit); ctx.fillStyle = 'rgba(30,60,50,0.85)'; ctx.fill();
      ctx.fillStyle = '#9ff0cf'; ctx.font = `800 ${Math.round(14 * unit)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GHOST', tx, ty - 3 * unit);
    } else {
      const bw = 46 * unit, bh = 7 * unit;
      roundPath(ctx, tx - bw / 2, ty + 14 * unit, bw, bh, 3 * unit); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      roundPath(ctx, tx - bw / 2, ty + 14 * unit, Math.max(2, bw * wf), bh, 3 * unit);
      ctx.fillStyle = r.cracked ? '#ff4d4d' : wf > 0.5 ? '#6fe08a' : wf > 0.2 ? '#ffc94a' : '#ff7a3a'; ctx.fill();
      ctx.beginPath(); ctx.arc(tx, ty - 3 * unit, (isSel ? 15 : 12) * unit, 0, TAU); ctx.fillStyle = isSel ? '#fff' : 'rgba(10,18,32,0.82)'; ctx.fill();
      ctx.lineWidth = 2 * unit; ctx.strokeStyle = TEAMS[0].jersey; ctx.stroke();
      ctx.fillStyle = isSel ? '#10182a' : '#fff'; ctx.font = `900 ${Math.round((isSel ? 17 : 14) * unit)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(r.slot + 1), tx, ty - 2.5 * unit);
      if (isSel) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(tx - 7 * unit, ty - 26 * unit); ctx.lineTo(tx + 7 * unit, ty - 26 * unit); ctx.lineTo(tx, ty - 17 * unit); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
  }
  // groups: a time gap label over the front rider of every cluster that is not the camera rider's
  const sorted = R.riders.map((r) => ({ r, s: shownS(r, st.alpha) })).sort((a, b) => b.s - a.s);
  const groups = [];
  for (const o of sorted) { const g = groups[groups.length - 1]; if (g && g.back - o.s < 18) { g.back = o.s; g.n++; g.riders.push(o.r); } else groups.push({ front: o.s, back: o.s, n: 1, riders: [o.r] }); }
  const vRef = Math.max(3, sel.v);
  const mineGroup = groups.find((g) => g.riders.includes(sel));
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  for (const g of groups) {
    if (g === mineGroup) continue;
    const x = fx + warp(g.front - focusS, unit);
    if (x < rc.x + 30 || x > rc.x + rc.w - 30) continue;
    const gapS = (g.front - (g.front > mineGroup.front ? mineGroup.front : mineGroup.back)) / vRef;
    const label = `${g.front > mineGroup.front ? '+' : '-'}${fmtGapInt(Math.abs(gapS)).slice(1)}`;
    const wLab = (label.length * 9 + 24) * unit;
    const yy = yR(x) - 3.2 * k;
    roundPath(ctx, x - wLab / 2, yy - 12 * unit, wLab, 24 * unit, 12 * unit); ctx.fillStyle = 'rgba(8,14,28,0.78)'; ctx.fill();
    ctx.fillStyle = g.front > mineGroup.front ? '#ffd27a' : '#9fe0ff'; ctx.font = `800 ${Math.round(14 * unit)}px ${FONT}`; ctx.fillText(label, x, yy + 0.5);
    ctx.font = `600 ${Math.round(11 * unit)}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(`${g.n} rider${g.n > 1 ? 's' : ''}`, x, yy + 20 * unit);
  }
  // off-screen chips
  const chip = (xx, align, lines, col) => {
    const wd = 118 * unit, hh = 44 * unit, x = align === 'right' ? xx - wd : xx, y = rc.y + rc.h * 0.3;
    roundPath(ctx, x, y, wd, hh, 12 * unit); ctx.fillStyle = 'rgba(8,14,28,0.78)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = col; ctx.font = `800 ${Math.round(14 * unit)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(lines[0], x + wd / 2, y + 15 * unit);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.round(12 * unit)}px ${FONT}`; ctx.fillText(lines[1], x + wd / 2, y + 32 * unit);
  };
  if (off.ahead.length) { const f = off.ahead.reduce((a, b) => (a.s > b.s ? a : b)); chip(rc.x + rc.w - 6, 'right', [`${fmtGapInt((f.s - sel.s) / vRef).slice(1)} ahead ▶`, `${off.ahead.length} rider${off.ahead.length > 1 ? 's' : ''}`], '#ffd27a'); }
  if (off.behind.length) { const f = off.behind.reduce((a, b) => (a.s > b.s ? a : b)); chip(rc.x + 6, 'left', [`◀ ${fmtGapInt((sel.s - f.s) / vRef).slice(1)} back`, `${off.behind.length} rider${off.behind.length > 1 ? 's' : ''}`], '#9fe0ff'); }
  ctx.restore();
}


// ---- the 3D road picture (view3d/world.js): true scale, perspective camera, lanes, pace lines -----------------------------------------
const LANES = [-1.7, -0.85, 0, 0.85, 1.7];
const laneMemo = new Map();          // rider id -> lane index (hysteresis: a rider keeps its lane while it is still free)
const BIKE_LEN = 2.05;               // a bike plus a 0.3 m wheel gap (true scale)
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

const ZR = 0.35;                     // visual metres per sim metre between riders (the pack is squeezed; a 3 s gap is still off screen)
const SW = 0.1;                      // visual metres per sim metre for the scenery: at 10 sim seconds per real second the ground runs at a believable speed
function assignLanes(list, camS) {
  // list sorted by s descending. Each rider gets a lane and a visual x: riders in a slipstream follow the rider ahead in the SAME lane at a
  // wheel gap (a pace line); others keep their lane when it is free; nobody overlaps a bike.
  const out = new Map(), lastInLane = LANES.map(() => 1e9);
  const lane0 = (r) => (laneMemo.has(r.id) ? laneMemo.get(r.id) : [1, 2, 3, 0, 4][(r.id * 5) % 5]);
  for (const o of list) {
    const r = o.r;
    let xv = (o.s - camS) * ZR, want = lane0(r);
    if (r.draft > 0.25) {
      let best = null;
      for (const p of list) { if (p === o) break; if (o.s <= p.s && p.s - o.s < 25) best = p; }
      if (best && out.has(best.r.id)) want = out.get(best.r.id).lane;
    }
    const order = [want, ...[2, 1, 3, 0, 4].sort((a, b) => Math.abs(a - want) - Math.abs(b - want)).filter((q) => q !== want)];
    let pick = -1;
    for (const q of order) if (lastInLane[q] - xv >= BIKE_LEN) { pick = q; break; }
    if (pick < 0) { let bg = -1e9; for (const q of order) { const g = lastInLane[q] - xv; if (g > bg) { bg = g; pick = q; } } xv = Math.min(xv, lastInLane[pick] - BIKE_LEN); }
    lastInLane[pick] = xv; out.set(r.id, { lane: pick, xr: xv }); laneMemo.set(r.id, pick);
  }
  return out;
}

function drawRoadViewWorld(ctx, st, L) {
  const f3 = globalThis.__riders3d;
  const P = L.play, rc = P.road, R = st.race, C = R.course, unit = unitFor(rc), cam = st.cam;
  const tone = TONES[C.tone] ? C.tone : 'morning', sel = R.riders[st.sel];
  const k = clamp(Math.min(rc.w / 4.9, rc.h * 0.8 / 6.2), 36, 340);
  const camS = cam.s, fx = rc.x + rc.w * 0.4, yG = rc.y + rc.h * 0.8;
  ctx.save();
  ctx.beginPath(); ctx.rect(rc.x, rc.y, rc.w, rc.h); ctx.clip();
  drawBackdrop(ctx, rc, tone, camS, 0, unit, true);
  // who is in view, which lane, which pose
  const all = R.riders.map((r) => ({ r, s: shownS(r, st.alpha) })).sort((a, b) => b.s - a.s);
  const lanes = assignLanes(all, camS);
  const halfView = (rc.w / k) * 0.62 + 6;
  const riders = [], off = { ahead: [], behind: [] };
  for (const o of all) {
    const r = o.r, ln = lanes.get(r.id), d = ln.xr;
    if (d > halfView + 2) { off.ahead.push(o); continue; }
    if (d < -halfView - 2) { off.behind.push(o); continue; }
    const tm = TEAMS[r.team], ghost = r.ctl === 'ghost';
    const pose = r.mode === 3 && r.fin === null ? 2 : r.mode === 2 || r.draft > 0.25 ? 1 : 0;
    const wf = r.wpMax ? r.w / r.wpMax : 1;
    const effort = r.mode === 3 ? 1 : r.mode === 2 ? 0.7 : r.mode === 1 ? 0.4 : 0.2;
    const mine = r.team === 0 && R.mode !== 'tt' || (R.mode === 'tt' && r.ctl === 'human');
    riders.push({ id: r.id, s: o.s, xr: ln.xr, v: r.v, lane: LANES[ln.lane], pose, effort: Math.max(effort, 1 - wf * 0.9) , sweat: Math.max(r.mode >= 2 ? 0.6 : 0, r.cracked ? 1 : 0, 1 - wf * 1.1),
      jersey: ghost ? '#8fe8c4' : tm.jersey, trim: tm.trim, helmet: tm.helmet, skin: SKINS[r.id % 4], num: (r.team * 20 + r.slot + 1) % 99 + 1,
      frame: ghost ? '#6fe0b0' : mixHex(tm.jersey, '#0c0d10', 0.2), shorts: ghost ? '#6fe0b0' : undefined, lookKey: `${tm.jersey}|${SKINS[r.id % 4]}|${ghost}`, ghost, mine });
  }
  // roadside crowd: dense at the start and finish and in towns, a few elsewhere (real 3D people on the far verge, facing the road)
  const specs = [];
  if (f3.specs && f3.specs.length) {
    const cap = f3.specs.length, slot = 24, used = new Set(), cV = camS * SW;
    const SHIRT = ['#f4f1ea', '#d94f3d', '#2f7fe3', '#e8b923', '#1f9d6e', '#7a4fb3', '#f08a3c', '#e8e2d0'];
    const PANTS = ['#2a2f3a', '#4a4036', '#1b2a4a', '#35302a'], HAIR = ['#14100d', '#2a1a10', '#3a2a1e', '#0c0a08'];
    const SKIN2 = ['#8a5a3c', '#6f4328', '#a36a45', '#5a3620', '#c08a60'];
    const sMin = cV - halfView * 1.6 - 10, sMax = cV + halfView * 1.6 + 10;
    for (let i = Math.floor(sMin / slot); i <= Math.ceil(sMax / slot); i++) {
      const wS = i * slot;
      if (wS < -40 || wS > C.L * SW + 60) continue;
      const land = C.landAt(clamp(wS / SW, 0, C.L - 1)), h1 = hash(i * 17 + C.index * 7), h2 = hash(i * 29 + 3);
      const edge = wS < 40 || wS > C.L * SW - 60;
      const cnt = edge ? 3 + (h1 > 0.5 ? 1 : 0) : land === 'town' ? (h1 > 0.3 ? 2 : 0) : h1 > 0.84 ? 1 : 0;
      for (let q = 0; q < cnt; q++) {
        const hq = hash(i * 131 + q * 17 + C.index * 5);
        const id = (i * 5 + q) % cap; if (used.has(id)) continue; used.add(id);
        const mood = edge ? (hq > 0.7 ? 3 : hq > 0.35 ? 2 : 1) : hq > 0.8 ? 1 : hq > 0.6 ? 2 : 0;
        specs.push({ id, s: wS + q * 2.6 + h2 * 4, z: -3.7 - hq * 1.2, face: -0.25 - hq * 0.4, mood, phase: hq * 9, scale: 0.94 + hash(i + q) * 0.12,
          top: SHIRT[Math.floor(hq * 97) % SHIRT.length], bottoms: PANTS[Math.floor(hq * 53) % PANTS.length], skin: SKIN2[Math.floor(hq * 71) % SKIN2.length], hair: HAIR[Math.floor(hq * 31) % HAIR.length],
          lookKey: `c${id}${Math.floor(hq * 97) % 8}${Math.floor(hq * 53) % 4}${Math.floor(hq * 71) % 5}${Math.floor(hq * 31) % 4}` });
      }
    }
  }
  const simRate = st.paused || R.over ? 0 : st.rate * [1, 2, 4][st.speedIdx || 0];
  const res = f3.drawWorld(ctx, rc, { k, fx, yG, camS, sw: SW, simRate, tilt: cam.tilt * 0.6, tone, t: st.anim, course: C, riders, specs });
  if (!res) { ctx.restore(); return false; }
  const proj = res.project, vRef = Math.max(3, sel.v);
  const spot = new Map();
  for (const it of riders) spot.set(it.id, { ...proj(it.xr, 0, it.lane), mine: it.mine, ghost: it.ghost, lane: it.lane });
  // tags above my riders
  for (const it of riders) {
    if (!(it.mine || it.ghost)) continue;
    const r = R.riders[it.id], o = spot.get(it.id), isSel = r.id === sel.id;
    const top = proj(it.xr, 2.05, it.lane), tx = top.x, ty = top.y - 12 * unit;
    const wf = r.w / r.wpMax;
    ctx.save();
    if (it.ghost) {
      roundPath(ctx, tx - 26 * unit, ty - 14 * unit, 52 * unit, 22 * unit, 11 * unit); ctx.fillStyle = 'rgba(30,60,50,0.85)'; ctx.fill();
      ctx.fillStyle = '#9ff0cf'; ctx.font = `800 ${Math.round(14 * unit)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('GHOST', tx, ty - 3 * unit);
    } else {
      const bw = 46 * unit, bh = 7 * unit;
      roundPath(ctx, tx - bw / 2, ty + 14 * unit, bw, bh, 3 * unit); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      roundPath(ctx, tx - bw / 2, ty + 14 * unit, Math.max(2, bw * wf), bh, 3 * unit);
      ctx.fillStyle = r.cracked ? '#ff4d4d' : wf > 0.5 ? '#6fe08a' : wf > 0.2 ? '#ffc94a' : '#ff7a3a'; ctx.fill();
      ctx.beginPath(); ctx.arc(tx, ty - 3 * unit, (isSel ? 15 : 12) * unit, 0, TAU); ctx.fillStyle = isSel ? '#fff' : 'rgba(10,18,32,0.82)'; ctx.fill();
      ctx.lineWidth = 2 * unit; ctx.strokeStyle = TEAMS[0].jersey; ctx.stroke();
      ctx.fillStyle = isSel ? '#10182a' : '#fff'; ctx.font = `900 ${Math.round((isSel ? 17 : 14) * unit)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(r.slot + 1), tx, ty - 2.5 * unit);
      if (isSel) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(tx - 7 * unit, ty - 26 * unit); ctx.lineTo(tx + 7 * unit, ty - 26 * unit); ctx.lineTo(tx, ty - 17 * unit); ctx.closePath(); ctx.fill(); }
    }
    ctx.restore();
    void o;
  }
  // groups: a time gap label over the front rider of every cluster that is not the camera rider's
  const groups = [];
  for (const o of all) { const g = groups[groups.length - 1]; if (g && g.back - o.s < 18) { g.back = o.s; g.n++; g.riders.push(o.r); } else groups.push({ front: o.s, back: o.s, n: 1, riders: [o.r] }); }
  const mineGroup = groups.find((g) => g.riders.includes(sel));
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  for (const g of groups) {
    if (g === mineGroup) continue;
    const p = proj(Math.min(halfView, Math.max(-halfView, (g.front - camS) * ZR)), 2.6, 0);
    if (p.x < rc.x + 30 || p.x > rc.x + rc.w - 30) continue;
    const gapS = (g.front - (g.front > mineGroup.front ? mineGroup.front : mineGroup.back)) / vRef;
    const label = `${g.front > mineGroup.front ? '+' : '-'}${fmtGapInt(Math.abs(gapS)).slice(1)}`;
    const wLab = (label.length * 9 + 24) * unit, yy = p.y - 8 * unit;
    roundPath(ctx, p.x - wLab / 2, yy - 12 * unit, wLab, 24 * unit, 12 * unit); ctx.fillStyle = 'rgba(8,14,28,0.78)'; ctx.fill();
    ctx.fillStyle = g.front > mineGroup.front ? '#ffd27a' : '#9fe0ff'; ctx.font = `800 ${Math.round(14 * unit)}px ${FONT}`; ctx.fillText(label, p.x, yy + 0.5);
    ctx.font = `600 ${Math.round(11 * unit)}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(`${g.n} rider${g.n > 1 ? 's' : ''}`, p.x, yy + 20 * unit);
  }
  // off-screen chips
  const chip = (xx, align, lines, col) => {
    const wd = 118 * unit, hh = 44 * unit, x = align === 'right' ? xx - wd : xx, y = rc.y + rc.h * 0.3;
    roundPath(ctx, x, y, wd, hh, 12 * unit); ctx.fillStyle = 'rgba(8,14,28,0.78)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = col; ctx.font = `800 ${Math.round(14 * unit)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(lines[0], x + wd / 2, y + 15 * unit);
    ctx.fillStyle = '#fff'; ctx.font = `600 ${Math.round(12 * unit)}px ${FONT}`; ctx.fillText(lines[1], x + wd / 2, y + 32 * unit);
  };
  if (off.ahead.length) { const f = off.ahead.reduce((a, b) => (a.s < b.s ? a : b)); chip(rc.x + rc.w - 6, 'right', [`${fmtGapInt((f.s - sel.s) / vRef).slice(1)} ahead ▶`, `${off.ahead.length} rider${off.ahead.length > 1 ? 's' : ''}`], '#ffd27a'); }
  if (off.behind.length) { const f = off.behind.reduce((a, b) => (a.s > b.s ? a : b)); chip(rc.x + 6, 'left', [`◀ ${fmtGapInt((sel.s - f.s) / vRef).slice(1)} back`, `${off.behind.length} rider${off.behind.length > 1 ? 's' : ''}`], '#9fe0ff'); }
  // remember where each rider is drawn (tap targets, see riderX)
  worldSpots = { camS, k, fx, spot, rc };
  ctx.restore();
  return true;
}
let worldSpots = null;

// ---- the stage profile strip ---------------------------------------------------------------------------------------------
export function drawProfile(ctx, st, L) {
  const P = L.play, rc = P.top, R = st.race, C = R.course;
  roundPath(ctx, rc.x, rc.y, rc.w, rc.h, 18); ctx.fillStyle = 'rgba(8,16,30,0.9)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,110,0.4)'; ctx.lineWidth = 2; ctx.stroke();
  const pad = 14, gx = rc.x + pad, gw = rc.w - 2 * pad, hd = L.wide ? 30 : 38, gy = rc.y + hd + 4, gh = rc.h - hd - 14;
  ctx.fillStyle = '#fff2d2'; ctx.font = `800 ${L.wide ? 20 : 24}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(C.name, gx, rc.y + hd / 2 + 4);
  const lead = Math.max(...R.riders.map((r) => r.s)), togo = Math.max(0, C.L - lead);
  ctx.textAlign = 'right'; ctx.font = `700 ${L.wide ? 18 : 22}px ${FONT}`; ctx.fillStyle = '#ffd27a';
  ctx.fillText(`${fmtTime(R.t)}   ${(togo / 1000).toFixed(1)} km to go`, gx + gw, rc.y + hd / 2 + 4);
  // gradient-coloured profile
  const alts = [];
  const n = Math.min(140, Math.floor(gw / 4));
  let lo = 1e9, hi = -1e9;
  for (let i = 0; i <= n; i++) { const a = C.altAt((i / n) * C.L); alts.push(a); lo = Math.min(lo, a); hi = Math.max(hi, a); }
  const span = Math.max(120, hi - lo), yOf = (a) => gy + gh - 6 - ((a - lo) / span) * (gh - 14);
  for (let i = 0; i < n; i++) {
    const g = C.gradeAt(((i + 0.5) / n) * C.L), col = g > 0.065 ? '#e8503a' : g > 0.04 ? '#f0903a' : g > 0.015 ? '#e8c444' : g < -0.02 ? '#4d8fd8' : '#7fbf6a';
    const x0 = gx + (i / n) * gw, x1 = gx + ((i + 1) / n) * gw + 0.6;
    ctx.beginPath(); ctx.moveTo(x0, gy + gh); ctx.lineTo(x0, yOf(alts[i])); ctx.lineTo(x1, yOf(alts[i + 1])); ctx.lineTo(x1, gy + gh); ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath();
  alts.forEach((a, i) => { const x = gx + (i / n) * gw; if (i === 0) ctx.moveTo(x, yOf(a)); else ctx.lineTo(x, yOf(a)); }); ctx.stroke();
  // finish flag
  ctx.fillStyle = '#fff'; ctx.fillRect(gx + gw - 2, gy - 4, 2, gh + 4); ctx.fillStyle = '#c92a2f'; ctx.fillRect(gx + gw - 14, gy - 4, 12, 8);
  // riders
  const mark = (r, big) => {
    const f = clamp(shownS(r, st.alpha) / C.L, 0, 1), x = gx + f * gw, y = yOf(C.altAt(f * C.L)) - 5;
    if (big) {
      const isSel = r.id === st.sel;
      ctx.beginPath(); ctx.arc(x, y, isSel ? 11 : 9, 0, TAU); ctx.fillStyle = TEAMS[0].jersey; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = isSel ? '#fff' : '#10182a'; ctx.stroke();
      ctx.fillStyle = '#10182a'; ctx.font = `900 ${isSel ? 13 : 11}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(r.slot + 1), x, y + 0.5);
    } else { ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fillStyle = TEAMS[r.team].jersey; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke(); }
  };
  const mineOf = (r) => (R.mode === 'tt' ? r.ctl === 'human' : r.team === 0);
  R.riders.forEach((r) => { if (!mineOf(r)) mark(r, false); });
  R.riders.forEach((r) => { if (mineOf(r)) mark(r, true); });
  // camera window
  const cx = gx + clamp(st.cam.s / C.L, 0, 1) * gw;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx, gy + gh); ctx.stroke();
}

// screen x of a rider in the road view (for tapping a rider in the picture)
export function riderX(st, L, r) {
  const rc = L.play.road, unit = unitFor(rc);
  if (worldSpots && worldSpots.rc.x === rc.x && worldSpots.rc.w === rc.w && worldSpots.spot.has(r.id)) return worldSpots.spot.get(r.id).x;
  return rc.x + rc.w * 0.4 + warp(shownS(r, st.alpha) - st.cam.s, unit);
}
