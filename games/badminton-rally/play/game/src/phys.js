// Shuttlecock flight and the shot solver. Pure maths, deterministic.
// The shuttle has strong quadratic drag (a = g - k |v| v with k = 0.215 per metre): it leaves the racket very fast, slows sharply and
// drops steeply. The same stepping function drives the live simulation AND every prediction (landing spot, interception, the AI's
// look-ahead, the coach's hint), so a prediction is exactly what then happens.
import { DRAG, GRAV, DT, NET_H, HL, HW } from './consts.js';

const SUB = 2, H = DT / SUB;

// One simulation tick of a free shuttle. b = { x, y, z, vx, vy, vz }. Returns null, or an event: 'net' (stopped by the net) / 'cord' (skimmed the tape).
export function stepShuttle(b) {
  const z0 = b.z, x0 = b.x, y0 = b.y;
  for (let i = 0; i < SUB; i++) {
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
    const f = 1 / (1 + DRAG * sp * H);
    b.vx *= f; b.vz *= f; b.vy = (b.vy - GRAV * H) * f;
    b.x += b.vx * H; b.y += b.vy * H; b.z += b.vz * H;
  }
  if ((z0 > 0 && b.z <= 0) || (z0 < 0 && b.z >= 0)) {
    const k = z0 / (z0 - b.z);
    const yc = y0 + (b.y - y0) * k, xc = x0 + (b.x - x0) * k;
    if (Math.abs(xc) <= 3.2) {
      const c = yc - NET_H;
      if (c < 0 && yc > -1) {
        // the net stops it: it drops straight down on the side it came from
        b.x = xc; b.y = Math.max(0.05, Math.min(yc, NET_H)); b.z = z0 > 0 ? 0.05 : -0.05; b.vx = 0; b.vz = 0; b.vy = Math.min(b.vy, 0);
        return 'net';
      }
      if (c < 0.035) {
        // the tape: the shuttle loses its pace and tumbles over
        b.vz *= 0.18; b.vx *= 0.3; b.vy = Math.min(b.vy, 0.2);
        return 'cord';
      }
    }
  }
  return null;
}

// Fly a copy of b until it lands (y <= 0) or hits the net. Returns { samples, end } where each sample = { t, x, y, z, vx, vy, vz } for tick i (t = i * DT).
// end = { kind: 'land' | 'net', x, z, t, cord }.
export function flyOut(b0, maxTicks = 600, keep = true) {
  const b = { x: b0.x, y: b0.y, z: b0.z, vx: b0.vx, vy: b0.vy, vz: b0.vz };
  const samples = keep ? [{ t: 0, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz }] : null;
  let cord = false, netHit = false;
  for (let i = 1; i <= maxTicks; i++) {
    const py = b.y, px = b.x, pz = b.z;
    const ev = stepShuttle(b);
    if (ev === 'cord') cord = true;
    if (ev === 'net') netHit = true;
    if (b.y <= 0) {
      const k = py / (py - b.y);
      const lx = px + (b.x - px) * k, lz = pz + (b.z - pz) * k;
      const lt = (i - 1 + k) * DT;
      if (keep) samples.push({ t: lt, x: lx, y: 0, z: lz, vx: b.vx, vy: b.vy, vz: b.vz });
      return { samples, end: { kind: netHit ? 'net' : 'land', x: lx, z: lz, t: lt, cord, n: samples ? samples.length - 1 : i } };
    }
    if (keep) samples.push({ t: i * DT, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
  }
  return { samples, end: { kind: 'land', x: b.x, z: b.z, t: maxTicks * DT, cord, n: maxTicks } };
}

// ---- planar flight (the azimuth is constant, so a shot is a 2D problem in (distance, height)) ------------------------------------------------
const PH = 1 / 120;
function planar(y0, v, th, dNet) {
  let d = 0, y = y0, vd = v * Math.cos(th), vy = v * Math.sin(th), t = 0, apex = y0, yNet = null;
  for (let i = 0; i < 700; i++) {
    const pd = d, py = y;
    const sp = Math.sqrt(vd * vd + vy * vy), f = 1 / (1 + DRAG * sp * PH);
    vd *= f; vy = (vy - GRAV * PH) * f;
    d += vd * PH; y += vy * PH; t += PH;
    if (y > apex) apex = y;
    if (yNet === null && pd < dNet && d >= dNet) yNet = py + (y - py) * ((dNet - pd) / (d - pd));
    if (y <= 0) { const k = py / (py - y); return { d: pd + (d - pd) * k, t: t - PH + PH * k, apex, yNet: yNet === null ? y0 : yNet, vEnd: sp }; }
  }
  return { d, t, apex, yNet: yNet === null ? y0 : yNet, vEnd: 0 };
}

// Launch velocity vector from speed, elevation (rad) and azimuth direction (ux, uz).
export const launch = (v, th, ux, uz) => ({ vx: v * Math.cos(th) * ux, vy: v * Math.sin(th), vz: v * Math.cos(th) * uz });

// Solve a stroke. contact = {x,y,z}; target = {x,z} (landing point); spec:
//   thMin/thMax (deg), vMin/vMax (m/s), order 'asc' (flattest first) or 'desc' (steepest first), clear (min clearance over the net, m),
//   apexMax (m), fixedV (m/s): hit at exactly this speed and solve the elevation instead.
// Returns { v, th, ux, uz, vx, vy, vz, landX, landZ, t, apex, clearance, short, ok, vEnd }.
export function solveShot(contact, target, spec) {
  const dx = target.x - contact.x, dz = target.z - contact.z, D = Math.hypot(dx, dz) || 0.01;
  const ux = dx / D, uz = dz / D;
  const dNet = Math.abs(uz) > 1e-4 ? Math.abs(contact.z) / Math.abs(uz) : 1e9;
  const clr = spec.clear ?? 0.07, apexMax = spec.apexMax ?? 9.2;
  const pack = (v, thDeg, r, short) => {
    const th = (thDeg * Math.PI) / 180, L = launch(v, th, ux, uz);
    return { v, th: thDeg, ux, uz, ...L, landX: contact.x + ux * r.d, landZ: contact.z + uz * r.d, t: r.t, apex: r.apex, clearance: r.yNet - NET_H, short: !!short, vEnd: r.vEnd, ok: !short && r.yNet - NET_H >= clr && r.apex <= apexMax };
  };
  if (spec.fixedV) {
    // elevation by bisection at a fixed speed; a target that is too close to clear the net is pushed away until it clears
    let Dt = D, best = null;
    for (let k = 0; k < 24; k++, Dt += 0.15) {
      let lo = (spec.thMin ?? -70) * Math.PI / 180, hi = (spec.thMax ?? 20) * Math.PI / 180;
      let rLo = planar(contact.y, spec.fixedV, lo, dNet), rHi = planar(contact.y, spec.fixedV, hi, dNet);
      if (rHi.d < Dt) { best = best || pack(spec.fixedV, spec.thMax ?? 20, rHi, true); continue; }
      if (rLo.d > Dt) { best = pack(spec.fixedV, spec.thMin ?? -70, rLo, false); break; }
      for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2, r = planar(contact.y, spec.fixedV, mid, dNet); if (r.d < Dt) lo = mid; else hi = mid; }
      const th = (lo + hi) / 2, r = planar(contact.y, spec.fixedV, th, dNet);
      const out = pack(spec.fixedV, (th * 180) / Math.PI, r, false);
      best = out;
      if (out.clearance >= clr) break;
    }
    return best;
  }
  const thMin = spec.thMin ?? 0, thMax = spec.thMax ?? 70, step = spec.thStep ?? 3;
  const ths = [];
  for (let a = thMin; a <= thMax + 1e-6; a += step) ths.push(a);
  if (spec.order === 'desc') ths.reverse();
  let fallback = null;
  for (const thDeg of ths) {
    const th = (thDeg * Math.PI) / 180;
    const rMax = planar(contact.y, spec.vMax, th, dNet);
    if (rMax.d < D - 0.04) { if (!fallback || rMax.d > fallback.r.d) fallback = { thDeg, r: rMax, v: spec.vMax, short: true }; continue; }
    const rMin = planar(contact.y, spec.vMin, th, dNet);
    if (rMin.d > D + 0.04) continue;           // too slow is impossible: this angle always overshoots
    let lo = spec.vMin, hi = spec.vMax;
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2, r = planar(contact.y, mid, th, dNet); if (r.d < D) lo = mid; else hi = mid; }
    const v = (lo + hi) / 2, r = planar(contact.y, v, th, dNet);
    const out = pack(v, thDeg, r, false);
    if (out.ok) return out;
    if (!fallback || (out.clearance > (fallback.out ? fallback.out.clearance : -9) && out.apex <= apexMax)) fallback = { thDeg, r, v, short: false, out };
  }
  if (fallback) return pack(fallback.v, fallback.thDeg, fallback.r, fallback.short || (fallback.out && fallback.out.clearance < clr));
  // nothing flies there: lob as far as the speed allows
  const r = planar(contact.y, spec.vMax, (spec.thMax ?? 60) * Math.PI / 180, dNet);
  return pack(spec.vMax, spec.thMax ?? 60, r, true);
}

// Where and when a free shuttle will land, from its current state.
export function predictLanding(b) {
  const f = flyOut(b, 600, false);
  return f.end;
}

export const inCourt = (x, z, margin = 0) => Math.abs(x) <= HW + margin && Math.abs(z) <= HL + margin;
