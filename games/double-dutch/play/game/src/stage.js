// The street scene with its people: the two turners, the two ropes and the jumper, drawn from a small visual state.
// Used by the play screen, the title screen (a looping demo), the Rules figures and, dimmed, behind the menus.
import { stageGeo, drawScene, drawBoombox, drawPerson, drawRope, handleOf, zMid, PEOPLE, clamp, lerp, smooth, TAU, ELEV } from './art.js';

const DEMO_TRICKS = [null, null, 'tuck', null, 'spin', null, 'kick', null, null, 'touch', null, 'tuck'];

// A visual state for the looping demo: one hop per pass, a trick now and then.
export function demoVisual(t) {
  const step = 0.64, dur = 0.34;
  let k = Math.floor((t + dur / 2) / step) - 1;
  let t0 = (k + 1) * step - dur / 2;
  if (t0 > t) { k -= 1; t0 = (k + 1) * step - dur / 2; }
  const tr = DEMO_TRICKS[((k % DEMO_TRICKS.length) + DEMO_TRICKS.length) % DEMO_TRICKS.length];
  return { Theta: t / step, tRun: t, J: { t0, dur, trick: tr, x: 0, stumble: 0, run: 0 }, beat: (t / step) % 1, pulse: Math.pow(Math.max(0, 1 - ((t / step) % 1) * 3), 2) };
}

// The pose of the jumper at run time tRun. J: { t0, dur, trick, x (k units from the middle), stumble 0..1, run (running phase) }
export function jumperPose(J, tRun, t) {
  const s = J.dur > 0 ? (tRun - J.t0) / J.dur : 2, inAir = s >= 0 && s <= 1, since = tRun - (J.t0 + J.dur);
  const trick = inAir || since < 0.18 ? J.trick : null;
  const P = { depth: J.depth ?? 0, x: J.x ?? 0, lift: 0, crouch: 0, bow: 0, lean: 0, turn: 0, feet: [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }], arms: [{ a: 0.22 }, { a: 0.22 }], mouth: 0, look: 0, sway: 0, feetTilt: 0 };
  const sp = Math.sin(Math.PI * clamp(s, 0, 1));
  // idle bounce on the beat (very small), landing squash
  const idle = 0.012 * Math.sin(t * 7);
  if (inAir) {
    const apex = trick === 'tuck' ? 0.22 : trick === 'spin' ? 0.2 : trick === 'kick' ? 0.18 : trick === 'touch' ? 0.15 : 0.15;
    P.lift = apex * 4 * s * (1 - s);
    P.crouch = 0.28 + 0.12 * sp;
    P.feet = [{ dx: 0, dy: P.lift * 0.98 + 0.045 * sp }, { dx: 0, dy: P.lift * 0.98 + 0.045 * sp }];
    P.arms = [{ a: 0.3 + 0.5 * sp }, { a: 0.3 + 0.5 * sp }];
    P.mouth = 0.2; P.sway = 0.03 * sp;
    if (trick === 'tuck') {
      const e = Math.pow(sp, 0.7);
      P.crouch = 0.35 + 0.7 * e; P.feet = [{ dx: -0.01, dy: P.lift + 0.2 * e }, { dx: 0.01, dy: P.lift + 0.2 * e }];
      P.arms = [{ a: 0.55 + 0.1 * e }, { a: 0.55 + 0.1 * e }]; P.mouth = 0.8;
    } else if (trick === 'spin') {
      P.turn = TAU * smooth(s * 1.02);
      P.arms = [{ a: 0.75 + 0.2 * sp }, { a: 0.75 + 0.2 * sp }]; P.mouth = 0.9;
    } else if (trick === 'kick') {
      const e = Math.pow(sp, 0.8);
      P.feet = [{ dx: 0.02, dy: P.lift }, { dx: 0.02 + 0.2 * e, dy: P.lift + 0.14 * e }];
      P.arms = [{ a: 0.95 }, { a: 0.95 }]; P.lean = -0.015 * e; P.mouth = 0.8;
    } else if (trick === 'touch') {
      const e = smooth(sp * 1.4);
      P.bow = e; P.crouch = 0.4 + 0.3 * e; P.lean = 0.02 * e;
      P.arms = [{ a: 0.5 }, { tx: P.x * 0 + 0.12, ty: 0, ground: e }];
    }
  } else {
    const sinceL = Math.max(0, since);
    P.crouch = 0.45 * Math.exp(-sinceL * 16) + (J.run ? 0.1 : 0);
    P.arms = [{ a: 0.2 + 0.1 * Math.exp(-sinceL * 8) }, { a: 0.2 + 0.1 * Math.exp(-sinceL * 8) }];
    P.lift = idle > 0 ? idle * 0.4 : 0;
    P.feet = [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }];
  }
  if (J.run) {
    const ph = J.run * TAU * 2;
    P.feet = [{ dx: 0, dy: Math.max(0, Math.sin(ph)) * 0.1 }, { dx: 0, dy: Math.max(0, -Math.sin(ph)) * 0.1 }];
    P.lift = Math.abs(Math.sin(ph)) * 0.02; P.lean = 0.03 * (J.run < 0.5 ? 1 : 0.5);
    P.arms = [{ a: 0.4 + 0.3 * Math.sin(ph) }, { a: 0.4 - 0.3 * Math.sin(ph) }]; P.mouth = 0.3;
  }
  if (J.stumble > 0) {
    const st = J.stumble;
    P.lean += 0.05 * st; P.bow = Math.max(P.bow, 0.5 * st); P.crouch = Math.max(P.crouch, 0.5 * st);
    P.arms = [{ a: 0.9 + 0.3 * Math.sin(t * 30) * st }, { a: 0.9 - 0.3 * Math.sin(t * 30) * st }]; P.mouth = 1; P.feetTilt = 0.3 * st; P.look = 0;
  }
  return P;
}

// V: { Theta, tRun, J, beat, pulse, hit (0..1 white flash on the ropes) }
export function drawStreet(ctx, W, H, rect, V, t, o = {}) {
  const g = stageGeo(rect), k = g.k;
  drawScene(ctx, W, H, g, t, { vignette: o.vignette, pulse: V.pulse });
  const thA = Math.PI * V.Theta, thB = Math.PI * (1 - V.Theta);
  const ropes = [['A', thA], ['B', thB]].map(([w, th]) => ({ w, th, z: zMid(g, w, th) }));
  const behind = ropes.filter((r) => r.z <= 0), front = ropes.filter((r) => r.z > 0);
  const glow = (r) => (V.hit && V.hit.rope === r.w ? V.hit.v : 0);
  behind.forEach((r) => drawRope(ctx, g, r.w, r.th, { glow: glow(r) }));
  // the turners: both hands hold a handle of each rope; they lean into the beat
  const turner = (side, style) => {
    const x = side < 0 ? g.ax : g.bx;
    const hA = handleOf(g, 'A', thA, side), hB = handleOf(g, 'B', thB, side);
    const lean = (side < 0 ? 1 : -1) * 0.012 + 0.008 * Math.sin(t * 6 + side) + 0.012 * V.pulse;
    const arms = side < 0 ? [{ tx: hB.x, ty: hB.y, bend: 0.8 }, { tx: hA.x, ty: hA.y, bend: -0.8 }] : [{ tx: hA.x, ty: hA.y, bend: 0.8 }, { tx: hB.x, ty: hB.y, bend: -0.8 }];
    return drawPerson(ctx, style, { x, gy: g.gy - 0.012 * k, k: k * 0.99, turn: side < 0 ? 0.95 : -0.95, crouch: 0.08 + 0.06 * V.pulse, lean, arms, look: -side * 0.9, mouth: V.pulse > 0.45 ? 0.7 : 0 });
  };
  turner(-1, PEOPLE.turnerA); turner(1, PEOPLE.turnerB);
  // the jumper
  const P = jumperPose(V.J, V.tRun, t);
  let arms = P.arms;
  const jx = g.jx + P.x * k;
  if (arms[1] && arms[1].ground !== undefined) arms = [arms[0], { tx: jx + 0.13 * k, ty: g.gy - (1 - arms[1].ground) * 0.38 * k - 0.01 * k, bend: 0.8 }];
  const dp = P.depth, head = drawPerson(ctx, PEOPLE.jumper, { x: jx, gy: g.gy + dp * 0.15 * k, k: k * (1 + 0.06 * dp), lift: P.lift, crouch: P.crouch, bow: P.bow, lean: P.lean, turn: P.turn, feet: P.feet, arms, mouth: P.mouth, look: P.look, sway: P.sway, feetTilt: P.feetTilt });
  front.forEach((r) => drawRope(ctx, g, r.w, r.th, { glow: glow(r) }));
  // boombox on the curb at the front, pulsing with the beat
  if (g.gy + k * 0.42 < rect.y + rect.h) drawBoombox(ctx, rect.x + Math.min(rect.w * 0.11, k * 0.5), g.gy + k * 0.3, k * 0.28, V.pulse);
  return { g, head, ropes };
}
void lerp; void ELEV;
