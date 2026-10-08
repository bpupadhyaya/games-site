// Physics of the two string toys. Pure and deterministic (no clock, no Math.random); every number is in metres and seconds,
// y is up, x is right, the hand rests at (0, 0). The world is one plain JSON object so planners can clone it.
//
//   YO-YO    a particle on a string of length L. Flying: ballistic. The payout speed (how fast it leaves the hand) becomes spin.
//            At the end of the string it hangs and sleeps; spin decays. A yank binds the string (needs spin) and it climbs home.
//            On the floor it rolls (walk the dog). A pendulum of the same string gives breakaway and around the world.
//   DIABOLO  a bead on a string between two sticks: it can only be on or inside the ellipse whose foci are the stick tips and whose
//            string length is fixed. Lifting/spreading the hands moves that boundary, which throws the diabolo. Spin keeps its
//            axle steady (a slow diabolo wobbles and cannot be caught).
export const G = 9.8;
const SUB = 4;                       // physics substeps per 1/60 s tick
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

export const YO = { L: 1.1, floorY: -1.3, R: 0.034, homeDrop: 0.17, wmax: 420, perMps: 62, gT: 0.6, whip: 1.25, wBind: 70, wDead: 28, throwV: 2.3, yankV: 2.1 };
export const DB = { Ls: 1.8, a: 0.9, sp0: 0.45, spMax: 0.8, floorY: -1.3, wmax: 360, wRef: 150, tiltOk: 0.4 };
export const HAND = {
  yoyo: { x0: -1.05, x1: 1.05, y0: -0.5, y1: 0.85 },
  diabolo: { x0: -0.95, x1: 0.95, y0: -0.6, y1: 0.9 },
};
export const WN = 55;                // hand follower natural frequency (rad/s): critically damped

// seeded stream stored in the world so a cloned world replays exactly
function rnd(w) {
  w.rs = (w.rs + 0x6D2B79F5) >>> 0;
  let t = w.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function createWorld(toy = 'yoyo', seed = 1) {
  const w = {
    toy, t: 0, rs: (seed * 2654435761) >>> 0, assist: 1, eid: 0, ev: [],
    hand: { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, sp: DB.sp0, spv: 0 },
    cmd: { yank: false, toss: 0 },
    att: null,
  };
  if (toy === 'yoyo') {
    w.yy = { mode: 'home', tm: 0, x: 0, y: -YO.homeDrop, vx: 0, vy: 0, w: 0, ph: 0, u: YO.homeDrop, nx: 0, ny: -1, tight: false, cool: 0.05, deadT: 0, prevTh: 0, loopAcc: 0, slackT: 0, sleepGrace: 0, impact: 0 };
  } else {
    const b = Math.sqrt(DB.a * DB.a - DB.sp0 * DB.sp0);
    w.db = { mode: 'string', tm: 0, x: 0, y: -b, vx: 0, vy: 0, w: 0, ph: 0, air: false, tossed: false, tA: 0, tPh: 0, tilt: 0, cool: 0.2, impact: 0, dropT: 0, vs: 0, side: 0, peak: 0, y0: 0, x0: 0, airT: 0, swing: 0, lastSign: 0, swingT: 0, swingN: 0, spinT: 0, longT: 0, catches: 0, rest: 0 };
  }
  newAttempt(w);
  return w;
}
export const cloneWorld = (w) => JSON.parse(JSON.stringify(w));

function newAttempt(w) {
  w.att = { t: 0, maxW: 0, sleep: 0, sleepBest: 0, walk: 0, loops: 0, reach: 0, floor: false, active: false };
}
function emit(w, type, extra) {
  w.ev.push({ id: ++w.eid, type, t: w.t, ...extra });
  if (w.ev.length > 24) w.ev.shift();
}

// ---- the hand --------------------------------------------------------------------------------
export function setHand(w, x, y) {
  const b = HAND[w.toy];
  w.hand.tx = clamp(x, b.x0, b.x1); w.hand.ty = clamp(y, b.y0, b.y1);
}
function stepHand(w, h) {
  const H = w.hand, b = HAND[w.toy];
  const ax = WN * WN * (H.tx - H.x) - 2 * WN * H.vx, ay = WN * WN * (H.ty - H.y) - 2 * WN * H.vy;
  H.vx += ax * h; H.vy += ay * h; H.x += H.vx * h; H.y += H.vy * h;
  if (H.x < b.x0) { H.x = b.x0; if (H.vx < 0) H.vx = 0; } else if (H.x > b.x1) { H.x = b.x1; if (H.vx > 0) H.vx = 0; }
  if (H.y < b.y0) { H.y = b.y0; if (H.vy < 0) H.vy = 0; } else if (H.y > b.y1) { H.y = b.y1; if (H.vy > 0) H.vy = 0; }
}

// ---- YO-YO -----------------------------------------------------------------------------------
function yoDone(w, why) {
  const y = w.yy, a = w.att;
  emit(w, 'done', { att: { sleep: a.sleepBest, walk: a.walk, loops: a.loops, reach: a.reach, floor: a.floor, maxW: a.maxW, endW: y.w, dur: a.t } });
  y.mode = 'home'; y.w = 0; y.cool = 0.45; y.tm = 0; y.u = YO.homeDrop;
  newAttempt(w);
}
function yoDrop(w, why) {
  const y = w.yy;
  emit(w, 'drop', { why, x: y.x, y: y.y });
  y.mode = 'home'; y.w = 0; y.cool = 0.6; y.tm = 0; y.u = YO.homeDrop;
  newAttempt(w);
}
function yoyoStep(w, h) {
  const y = w.yy, H = w.hand, a = w.att, L = YO.L, as = w.assist;
  y.tm += h; y.cool -= h;
  if (y.mode === 'home') {
    y.x = H.x; y.y = H.y - YO.homeDrop; y.vx = H.vx; y.vy = H.vy; y.w = 0; y.nx = 0; y.ny = -1;
    const sp = Math.hypot(H.vx, H.vy);
    if (y.cool <= 0 && sp > YO.throwV && H.vy < 0.75 * sp) {
      y.mode = 'fly'; y.tm = 0; y.vx = H.vx * 1.04; y.vy = H.vy * 1.04; y.tight = false; y.loopAcc = 0; y.slackT = 0; y.sleepGrace = 0; y.prevTh = Math.atan2(y.y - H.y, y.x - H.x);
      a.active = true; a.t = 0; emit(w, 'throw', { speed: sp });
    }
    w.cmd.yank = false;
    return;
  }
  a.t += h;
  y.ph += y.w * h;
  const dx = y.x - H.x, dy = y.y - H.y, r = Math.hypot(dx, dy) || 1e-6;
  // yank: a quick pull up (or the Return button) while the string is out
  const yank = w.cmd.yank || H.vy > YO.yankV;
  if (yank && (y.mode === 'fly' || y.mode === 'floor') && r > 0.5 * L && y.tm > 0.12) {
    w.cmd.yank = false;
    if (y.w >= YO.wBind) {
      y.mode = 'climb'; y.tm = 0; y.u = r; y.nx = dx / r; y.ny = dy / r; emit(w, 'bind', { w: y.w });
    } else if (y.tight || y.mode === 'floor') { y.mode = 'dead'; y.deadT = 0; emit(w, 'drop', { why: 'dead', x: y.x, y: y.y }); }
  }
  w.cmd.yank = false;
  if (y.mode === 'climb') {
    const e = 1 - Math.exp(-1.6 * h);
    y.nx += (0 - y.nx) * e; y.ny += (-1 - y.ny) * e;
    const nn = Math.hypot(y.nx, y.ny) || 1; y.nx /= nn; y.ny /= nn;
    const vc = clamp(y.w * 0.014, 1.5, 5.2);
    y.u -= vc * h;
    y.x = H.x + y.nx * y.u; y.y = H.y + y.ny * y.u; y.vx = H.vx - y.nx * vc; y.vy = H.vy - y.ny * vc;
    y.w -= (0.2 * y.w + 12) * h;
    if (y.u <= YO.homeDrop + 0.03) { emit(w, 'catch', { w: y.w }); yoDone(w); return; }
    if (y.w < 18) yoDrop(w, 'stall');
    return;
  }
  if (y.mode === 'dead') {
    y.deadT += h; y.vy -= G * h; y.x += y.vx * h; y.y += y.vy * h; y.w = Math.max(0, y.w - 60 * h);
    const d2 = Math.hypot(y.x - H.x, y.y - H.y);
    if (d2 > L) { const n = (y.x - H.x) / d2, m = (y.y - H.y) / d2; y.x = H.x + n * L; y.y = H.y + m * L; const vr = (y.vx - H.vx) * n + (y.vy - H.vy) * m; if (vr > 0) { y.vx -= n * vr; y.vy -= m * vr; } }
    if (y.y < YO.floorY + YO.R) { y.y = YO.floorY + YO.R; y.vy = 0; y.vx *= 0.9; }
    if (y.deadT > 1.0) yoDrop(w, 'dead');
    return;
  }
  if (y.mode === 'floor') {
    y.y = YO.floorY + YO.R; y.vy = 0;
    const dyy = y.y - H.y;
    if (Math.abs(dyy) >= L - 0.01) { y.mode = 'fly'; y.tm = 0.2; return; }     // hand too high: the string lifts it off the floor
    const roll = y.w * 0.05;
    y.vx += clamp(30 * (roll - y.vx), -7, 7) * h;
    y.x += y.vx * h;
    const dxm = Math.sqrt(L * L - dyy * dyy);
    let drag = 1.0;
    if (y.x - H.x > dxm) { y.x = H.x + dxm; y.vx = H.vx; y.tight = true; } else if (y.x - H.x < -dxm) { y.x = H.x - dxm; y.vx = H.vx; y.tight = true; if (H.vx > 0.2) drag = 2.4; } else y.tight = Math.abs(y.x - H.x) > dxm - 0.02;
    if (H.vx < -0.3 && y.tight) drag = 3.2;
    y.w -= (0.1 * y.w + 8 + 40 * drag) * h;
    if (y.vx > 0.25) { a.walk += y.vx * h; a.reach = Math.max(a.reach, 0); }
    a.maxW = Math.max(a.maxW, y.w);
    if (y.w < YO.wDead) { y.mode = 'dead'; y.deadT = 0; emit(w, 'drop', { why: 'spin', x: y.x, y: y.y }); }
    return;
  }
  // ---- fly: ballistic, then tethered at the end of the string (a hanging yo-yo swings a little floatier than free fall) ----
  y.vy -= G * (y.tight ? YO.gT : 1) * h;
  y.x += y.vx * h; y.y += y.vy * h;
  const dx2 = y.x - H.x, dy2 = y.y - H.y, r2 = Math.hypot(dx2, dy2) || 1e-6;
  const nx = dx2 / r2, ny = dy2 / r2;
  const vr = (y.vx - H.vx) * nx + (y.vy - H.vy) * ny;
  if (vr > 0 && r2 > 0.06) y.w = Math.min(YO.wmax, Math.max(y.w, vr * YO.perMps));
  if (r2 >= L) {
    y.x = H.x + nx * L; y.y = H.y + ny * L;
    if (vr > 0) { y.vx -= nx * vr * 1.05; y.vy -= ny * vr * 1.05; if (vr > 1.5) {
        y.impact = Math.min(1, vr / 6); emit(w, 'snap', { v: vr });
        // a forward throw whips round: part of the outward speed turns into swing along the string (always over the top)
        const kk = YO.whip * clamp((Math.abs(nx) - 0.4) / 0.35, 0, 1);
        if (kk > 0) { const sg = nx > 0 ? 1 : -1; y.vx += -ny * sg * vr * kk; y.vy += nx * sg * vr * kk; }
      } }
    y.tight = true;
    // the swinging string loses a little energy to the air
    y.vx -= (y.vx - H.vx) * 0.22 * h; y.vy -= (y.vy - H.vy) * 0.22 * h;
  } else y.tight = r2 > L - 0.02;
  if (y.y < YO.floorY + YO.R) {
    if (!a.floor) { a.floor = true; emit(w, 'floor', {}); }
    y.y = YO.floorY + YO.R;
    if (y.vy < -0.8) { y.vy = -y.vy * 0.12; y.vx *= 0.85; y.impact = Math.min(1, -y.vy / 3); } else { y.vy = 0; y.mode = 'floor'; y.tm = 0; }
  }
  y.w -= (0.1 * y.w + 10) * h;
  if (y.w < YO.wDead && y.tight) { y.mode = 'dead'; y.deadT = 0; emit(w, 'drop', { why: 'spin', x: y.x, y: y.y }); return; }
  a.maxW = Math.max(a.maxW, y.w);
  // trick bookkeeping: sleeping (hanging still), loops around the hand, how far to the side it swung
  const relV = Math.hypot(y.vx - H.vx, y.vy - H.vy);
  const hanging = y.tight && relV < (as ? 1.5 : 1.25) && dy2 < -0.8 * L;
  if (hanging) { y.sleepGrace = 0; a.sleep += h; if (a.sleep > a.sleepBest) a.sleepBest = a.sleep; } else { y.sleepGrace += h; if (y.sleepGrace > 0.4) a.sleep = 0; }
  if (y.tight && relV > 1.2) {
    const th = Math.atan2(dy2, dx2);
    let d = th - y.prevTh; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    y.loopAcc += d; y.slackT = 0;
    const lp = Math.floor(Math.abs(y.loopAcc) / (TAU * 0.96));
    if (lp > a.loops) { a.loops = lp; emit(w, 'loop', { n: lp }); }
  } else if (!y.tight) { y.slackT += h; if (y.slackT > 0.3) y.loopAcc = 0; }
  y.prevTh = Math.atan2(dy2, dx2);
  if (y.tight && dy2 > -0.55 * L && dy2 < 0.35 * L) a.reach = Math.max(a.reach, Math.abs(dx2) / L);
}

// ---- DIABOLO ---------------------------------------------------------------------------------
function dbDrop(w, why) {
  const d = w.db;
  emit(w, 'drop', { why, x: d.x, y: d.y });
  d.mode = 'fall'; d.dropT = 0;
}
function dbReset(w) {
  const d = w.db, H = w.hand, b = Math.sqrt(DB.a * DB.a - H.sp * H.sp);
  d.mode = 'string'; d.x = H.x; d.y = H.y - b; d.vx = H.vx; d.vy = H.vy; d.air = false; d.cool = 0.5; d.tilt = 0; d.tA = 0; d.catches = 0; d.rest = 0;
}
function diaboloStep(w, h) {
  const d = w.db, H = w.hand;
  d.tm += h; d.cool -= h;
  // spread: an upward flick pulls the sticks apart and the string snaps tight
  const tgt = DB.sp0 + (DB.spMax - DB.sp0) * clamp((H.vy - 1.3) / 3.4, 0, 1);
  const prev = H.sp;
  if (tgt > H.sp) H.sp = Math.min(tgt, H.sp + 5 * h); else H.sp += (tgt - H.sp) * Math.min(1, 9 * h);
  H.spv = (H.sp - prev) / h;
  const c = H.sp, a = DB.a, b = Math.sqrt(Math.max(a * a - c * c, 0.0025));
  if (d.mode === 'fall') {
    d.dropT += h; d.vy -= G * h; d.x += d.vx * h; d.y += d.vy * h; d.ph += d.w * h;
    if (d.y < DB.floorY + 0.09) { d.y = DB.floorY + 0.09; if (d.vy < -1) { d.vy = -d.vy * 0.25; d.vx *= 0.8; } else d.vy = 0; }
    if (d.dropT > 1.1) { dbReset(w); newAttempt(w); }
    return;
  }
  d.ph += d.w * h;
  const f1x = H.x - c, f2x = H.x + c, fy = H.y;
  const as = w.assist;
  d.vy -= G * h;
  d.x += d.vx * h; d.y += d.vy * h;
  let s1 = Math.hypot(d.x - f1x, d.y - fy) || 1e-6, s2 = Math.hypot(d.x - f2x, d.y - fy) || 1e-6;
  let sum = s1 + s2;
  if (sum > DB.Ls && d.y < H.y + 0.02) {
    let ux = 0, uy = 0;
    for (let it = 0; it < 4; it++) {
      const u1x = (d.x - f1x) / s1, u1y = (d.y - fy) / s1, u2x = (d.x - f2x) / s2, u2y = (d.y - fy) / s2;
      ux = u1x + u2x; uy = u1y + u2y;
      const gg = ux * ux + uy * uy || 1e-6;
      const k = (sum - DB.Ls) / gg;
      d.x -= ux * k; d.y -= uy * k;
      s1 = Math.hypot(d.x - f1x, d.y - fy) || 1e-6; s2 = Math.hypot(d.x - f2x, d.y - fy) || 1e-6; sum = s1 + s2;
    }
    const gl = Math.hypot(ux, uy) || 1e-6, nx = ux / gl, ny = uy / gl;
    const relx = d.x - H.x, rely = d.y - H.y;
    const sinphi = clamp(-rely / b, -1, 1);
    const bdot = clamp(-(c * H.spv) / b, -2.5, 2.5);                             // d b / d t
    const vbx = H.vx, vby = H.vy - bdot * sinphi;              // the string boundary moves with the hands and the spread
    // contact validity: a bead only sits on the V between the sticks
    if (Math.abs(relx) > c - 0.015) {
      if (d.mode !== 'fall') { dbDrop(w, d.air ? 'missed' : 'slipped'); return; }
    }
    const vn = (d.vx - vbx) * nx + (d.vy - vby) * ny;
    if (d.air && !d.tossed) d.air = false;                      // a hop on the string, not a toss
    if (d.air) {
      // landing after a toss: judge the tilt of the axle, then the catch
      const ok = DB.tiltOk + (as ? 0.12 : 0);
      if (Math.abs(d.tilt) > ok) { dbDrop(w, 'tilt'); return; }
      d.air = false; d.catches++; d.impact = Math.min(1, Math.abs(vn) / 7);
      const att = w.att; att.t = d.airT;
      emit(w, 'catch', { peak: d.peak, dx: d.x - d.x0, v: Math.abs(vn), w: d.w, air: d.airT, y: d.y });
      emit(w, 'done', { att: { peak: d.peak, dx: Math.abs(d.x - d.x0), w: d.w, air: d.airT } });
    }
    if (vn > 0) { const e = d.air ? 0 : 0.06; d.vx -= nx * vn * (1 + e); d.vy -= ny * vn * (1 + e); }
    // string friction along the bead and the spin it drives
    const tx = -ny, ty = nx;
    const vt = (d.vx - vbx) * tx + (d.vy - vby) * ty;
    d.vx -= tx * vt * 0.5 * h; d.vy -= ty * vt * 0.5 * h;
    const v1x = d.vx - (H.vx - H.spv), v1y = d.vy - H.vy, v2x = d.vx - (H.vx + H.spv), v2y = d.vy - H.vy;
    const vs = 0.5 * (((d.x - f1x) / s1) * v1x + ((d.y - fy) / s1) * v1y - (((d.x - f2x) / s2) * v2x + ((d.y - fy) / s2) * v2y));
    d.vs = vs;
    d.w += 110 * Math.min(Math.abs(vs), 3.5) * (1 - d.w / DB.wmax) * h;
    d.tilt *= Math.exp(-6 * h);
    d.side = relx;
  } else if (!d.air && d.vy > 0.5 && sum < DB.Ls - 0.025 && d.cool <= 0) {
    // leaves the string: a toss
    d.air = true; d.tossed = false; d.airT = 0; d.peak = 0; d.y0 = d.y; d.x0 = d.x;
    d.tA = 0.1 + 0.2 * rnd(w) + 0.04 * Math.abs(d.vx); d.tPh = rnd(w) * TAU;
  }
  d.w -= (0.05 * d.w + 1.2) * h;
  if (d.w < 0) d.w = 0;
  if (d.air) {
    d.airT += h;
    if (!d.tossed && d.airT > 0.2) { d.tossed = true; emit(w, 'toss', { v: d.vy, w: d.w }); }
    d.tPh += d.w * 0.03 * h;
    d.tilt = d.tA * Math.min(1.8, DB.wRef / Math.max(d.w, 40)) * Math.cos(d.tPh);
    d.peak = Math.max(d.peak, d.y - H.y);
    if (d.y < DB.floorY + 0.1) { dbDrop(w, 'floor'); return; }
  }
  if (d.y < DB.floorY + 0.1) { dbDrop(w, 'floor'); return; }
  // bookkeeping for the on-string tricks
  if (!d.air) {
    if (d.w >= 150) d.spinT += h; else d.spinT = 0;
    if (d.w >= 230) d.longT += h; else d.longT = 0;
    const rx = d.x - H.x;
    const sg = rx > 0.12 ? 1 : rx < -0.12 ? -1 : 0;
    if (sg !== 0 && sg !== d.lastSign) { if (d.lastSign !== 0) { d.swingN++; d.swingT = 0; } d.lastSign = sg; }
    d.swingT += h; if (d.swingT > 2.2) { d.swingN = 0; d.swingT = 0; }
  }
  w.att.maxW = Math.max(w.att.maxW, d.w);
}

// ---- the tick --------------------------------------------------------------------------------
export function stepWorld(w, dt = 1 / 60) {
  const h = dt / SUB;
  for (let i = 0; i < SUB; i++) {
    stepHand(w, h);
    if (w.toy === 'yoyo') yoyoStep(w, h); else diaboloStep(w, h);
  }
  w.t += dt;
}

// ---- helpers used by the UI and the planners -------------------------------------------------
export const isAirborne = (w) => w.toy === 'diabolo' && w.db.air;
export const yoSpinFrac = (w) => clamp(w.yy.w / YO.wmax, 0, 1);
export const dbSpinFrac = (w) => clamp(w.db.w / DB.wmax, 0, 1);
export const spinFrac = (w) => (w.toy === 'yoyo' ? yoSpinFrac(w) : dbSpinFrac(w));
export const toyPos = (w) => (w.toy === 'yoyo' ? w.yy : w.db);
