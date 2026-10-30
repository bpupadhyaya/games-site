// Authored sport clips (built at load time from the base library with buildClip + IK). All are for a RIGHT-handed
// player; pass { left: true } to mirror. Event names: `release` (ball leaves the hand), `contact` (bat meets ball),
// `catch`, `plant`. Every clip is meant to be started with human.playTimed(name, event, eta) so the event lands on the sim time.
import { buildClip } from './author.js';

const mirrorName = (n) => n.replace(/^(Bip01_)?([LR])_/, (m, p, s) => `${p || ''}${s === 'L' ? 'R' : 'L'}_`);
function mirrorSpec(spec) {
  const flipX = (p) => [-p[0], p[1], p[2]];
  const k = spec.keys.map((key) => {
    if (!key.pose) return key;
    const pose = {};
    for (const [bone, v] of Object.entries(key.pose)) {
      const o = { ...v };
      if (/^(Pelvis|Spine\d?|Neck|Head)$/.test(bone)) { if (o.twist) o.twist = -o.twist; if (o.side) o.side = -o.side; if (o.pos) o.pos = flipX(o.pos); }
      pose[mirrorName(bone)] = o;
    }
    return { ...key, pose };
  });
  const mk = (x) => ({ ...x, pos: x.pos ? flipX(x.pos) : x.pos, off: x.off ? flipX(x.off) : x.off });
  const ik = spec.ik && Object.fromEntries(Object.entries(spec.ik).map(([b, d]) => {
    const dd = Array.isArray(d) ? { keys: d } : d;
    return [mirrorName(b), { keys: dd.keys.map(mk), pole: dd.pole && dd.pole.map(mk), weight: dd.weight }];
  }));
  const prop = spec.prop && spec.prop.map((x) => ({ ...x, grip: x.grip && flipX(x.grip), sweet: Array.isArray(x.sweet) ? flipX(x.sweet) : x.sweet, dir: flipX(x.dir), roll: typeof x.roll === 'number' ? -x.roll : x.roll }));
  const fh = spec.fingerHands && { R: spec.fingerHands.L, L: spec.fingerHands.R };
  return { ...spec, keys: k, ik, prop, fingerHands: fh };
}

export function addSportClips(human, { left = false } = {}) {
  const make = (spec) => { const c = buildClip(human, left ? mirrorSpec(spec) : spec); human.addClip(c); return c; };
  const S = human.info && human.info.height ? human.info.height / 1.74 : 1;   // scale IK targets to the body (1.74 m = athlete_f)
  const sc = (arr) => arr.map((k) => ({ ...k, pos: k.pos.map((v) => v * S) }));

  // ---- run-ups: the base jog / sprint loops with the ball held at the chest in both hands, pumping with each stride (keeps the base's speed + foot events)
  const runBall = (name, base, o) => {
    const bob = o.bob, y0 = o.y;
    const R = [], L = [];
    for (let i = 0; i <= 4; i++) { const t = (i / 4); const ph = Math.sin(t * Math.PI * 4) * bob; R.push({ t, pos: [-0.1 * S, (y0 + ph) * S, o.z * S] }); L.push({ t, pos: [0.1 * S, (y0 - 0.03 - ph) * S, (o.z + 0.02) * S] }); }
    const dur = human.getClip(base).dur;
    const sc2 = (arr) => arr.map((k) => ({ ...k, t: k.t * dur }));
    make({
      name, base, inherit: true, duration: dur, loop: true, group: 'locomotion', grounded: true, fingers: 'ballGrip', fingerHands: { R: 'ballGrip', L: 'relaxed' }, keys: [{ t: 0 }],
      ik: { R_Hand: { keys: sc2(R), pole: [{ t: 0, pos: [-0.6, 1.0, 0.0] }, { t: dur, pos: [-0.6, 1.0, 0.0] }] }, L_Hand: { keys: sc2(L), pole: [{ t: 0, pos: [0.6, 1.0, 0.0] }, { t: dur, pos: [0.6, 1.0, 0.0] }] } },
    });
  };
  runBall('run_ball_jog', 'jog', { y: 1.24, z: 0.3, bob: 0.025 });
  runBall('run_ball_sprint', 'sprint', { y: 1.28, z: 0.26, bob: 0.035 });

  // ---- overarm bowling deliveries, following the four classic actions (coil, delivery stride, delivery, follow-through):
  // gather with the ball cupped at the chin and the knee driven high, leap, back-foot landing into a wide delivery stride with the arms
  // spread, bowling arm a full vertical arc past the ear with the release at the top, front arm pulled down and in, forward-bent follow-through.
  // Side-on: pelvis and chest coiled sideways. Front-on: chest faces the batter all the way, front arm stays up. Spinner: short, upright, wrist emphasised.
  const bowl = (name, o) => {
    const k = o.k || 1;
    const T = (t) => +(t * k).toFixed(4);
    const tw = o.twist, ch = o.chest, lean = o.lean;
    const keys = [
      { t: T(0.00), pose: { Pelvis: { twist: tw * 0.6, flex: -4, pos: [0, -0.01, 0] }, Spine1: { twist: ch * 0.5, flex: -4 }, Spine2: { flex: -3 }, Head: { flex: -4 }, R_Thigh: { flex: 4 }, L_Thigh: { flex: o.knee }, L_Calf: { flex: o.knee * 1.15 } } },
      { t: T(0.11), pose: { Pelvis: { twist: tw * 0.9, flex: -6, pos: [0, o.air, 0.05] }, Spine1: { twist: ch * 0.8, flex: -6 }, Spine2: { flex: -4 }, R_Thigh: { flex: -10 }, R_Calf: { flex: 45 }, L_Thigh: { flex: o.knee + 12 }, L_Calf: { flex: o.knee * 1.2 } }, ease: 'out' },
      { t: T(0.23), pose: { Pelvis: { twist: tw, flex: 0, pos: [0, -o.dip * 1.2, 0.08] }, Spine1: { twist: ch, flex: 3 }, Spine2: { twist: ch * 0.5, flex: -2 }, R_Thigh: { flex: -22 }, R_Calf: { flex: 12 }, L_Thigh: { flex: o.stride }, L_Calf: { flex: 8 } }, ease: 'inOut' },
      { t: T(0.40), pose: { Pelvis: { twist: tw * 0.7, pos: [0, -o.dip * 1.1, 0.08] }, Spine1: { twist: ch * 0.6, flex: 10 }, Spine2: { twist: ch * 0.3, flex: 4 }, R_Thigh: { flex: -16 }, R_Calf: { flex: 8 }, L_Thigh: { flex: o.stride }, L_Calf: { flex: 8 } }, ease: 'inOut' },
      { t: T(0.52), pose: { Pelvis: { twist: 10, pos: [0, -o.dip * 0.9, 0.1] }, Spine1: { twist: 16, flex: lean }, Spine2: { twist: 14, flex: lean * 0.5 }, Head: { flex: -10 }, R_Thigh: { flex: -30 }, R_Calf: { flex: 40 }, L_Thigh: { flex: o.stride - 6 }, L_Calf: { flex: 6 } }, ease: 'in' },
      { t: T(0.80), pose: { Pelvis: { twist: 34, pos: [0, -0.04, 0.12] }, Spine1: { twist: 32, flex: lean + 24 }, Spine2: { twist: 22, flex: lean * 0.8 }, Head: { flex: -20 }, R_Thigh: { flex: 42 }, R_Calf: { flex: 70 }, L_Thigh: { flex: 18 }, L_Calf: { flex: 8 } }, ease: 'out' },
      { t: T(1.20), pose: { Pelvis: { twist: 5, pos: [0, -0.01, 0.05] }, Spine1: { twist: 5, flex: 12 }, Spine2: { flex: 6 }, R_Thigh: { flex: 12 }, R_Calf: { flex: 22 }, L_Thigh: { flex: 8 }, L_Calf: { flex: 4 } }, ease: 'inOut' },
    ];
    const rk = sc([
      { t: 0.00, pos: [-0.07, 1.47, 0.2] }, { t: 0.11, pos: [-0.09, 1.5, 0.2], ease: 'out' }, { t: 0.23, pos: [-0.46, 1.04, -0.34], ease: 'inOut' }, { t: 0.33, pos: [-0.26, 1.58, -0.47], ease: 'inOut' },
      { t: 0.45, pos: [-0.20, 1.90, -0.18], ease: 'in' }, { t: 0.52, pos: [-0.17, 1.94, 0.06], ease: 'in' }, { t: 0.62, pos: [-0.12, 1.74, 0.40], ease: 'out' },
      { t: 0.80, pos: [0.08, 1.14, 0.46], ease: 'out' }, { t: 1.20, pos: [-0.22, 0.92, 0.12], ease: 'inOut' },
    ]).map((x) => ({ ...x, t: T(x.t) }));
    const rp = sc([{ t: 0, pos: [-0.5, 1.2, 0.2] }, { t: 0.23, pos: [-0.7, 1.0, -0.2] }, { t: 0.33, pos: [-0.7, 1.5, -0.3] }, { t: 0.52, pos: [-0.7, 1.9, -0.2] }, { t: 0.8, pos: [-0.5, 0.9, 0.2] }, { t: 1.2, pos: [-0.5, 1.0, 0] }]).map((x) => ({ ...x, t: T(x.t) }));
    const lk = sc(o.front).map((x) => ({ ...x, t: T(x.t) }));
    const lp = sc([{ t: 0, pos: [0.6, 1.3, 0.3] }, { t: 0.23, pos: [0.7, 1.6, 0.3] }, { t: 0.52, pos: [0.6, 1.1, -0.1] }, { t: 1.2, pos: [0.5, 1.0, 0] }]).map((x) => ({ ...x, t: T(x.t) }));
    make({
      name, duration: T(1.2), base: 'idle', grounded: false, group: 'sport', fingers: 'ballGrip', fingerHands: { R: o.grip, L: 'relaxed' }, keys,
      ik: { R_Hand: { keys: rk, pole: rp }, L_Hand: { keys: lk, pole: lp } },
      events: { plant: T(0.4), release: T(0.52) }, userData: { variant: o.variant },
    });
  };
  // front arm: side-on = extended forward at the gather, spread at the stride, pulled into the ribs at release; front-on = stays up and straight until release
  const frontSide = [{ t: 0.00, pos: [0.16, 1.62, 0.5] }, { t: 0.11, pos: [0.3, 1.7, 0.5], ease: 'out' }, { t: 0.23, pos: [0.26, 1.74, 0.45], ease: 'inOut' }, { t: 0.40, pos: [0.22, 1.7, 0.4], ease: 'inOut' }, { t: 0.52, pos: [0.1, 1.1, 0.22], ease: 'in' }, { t: 0.80, pos: [0.28, 0.98, 0.1], ease: 'out' }, { t: 1.20, pos: [0.25, 0.92, 0.08], ease: 'inOut' }];
  const frontFront = [{ t: 0.00, pos: [0.1, 1.38, 0.3] }, { t: 0.11, pos: [0.2, 1.7, 0.35], ease: 'out' }, { t: 0.23, pos: [0.2, 1.85, 0.25], ease: 'inOut' }, { t: 0.40, pos: [0.18, 1.9, 0.2], ease: 'inOut' }, { t: 0.52, pos: [0.16, 1.5, 0.2], ease: 'in' }, { t: 0.80, pos: [0.3, 1.0, 0.12], ease: 'out' }, { t: 1.20, pos: [0.25, 0.92, 0.08], ease: 'inOut' }];
  bowl('bowl_overarm', { variant: 'side-on fast', twist: -62, chest: -50, lean: 30, knee: 92, stride: 40, air: 0.13, dip: 0.07, grip: 'seamGrip', front: frontSide });
  bowl('bowl_front_on', { variant: 'front-on fast', twist: 0, chest: 4, lean: 36, knee: 96, stride: 32, air: 0.15, dip: 0.08, grip: 'seamGrip', front: frontFront });
  bowl('bowl_spin', { variant: 'spinner (short run-up, upright)', twist: -22, chest: -16, lean: 12, knee: 36, stride: 24, air: 0.04, dip: 0.04, grip: 'offBreak', k: 0.86, front: frontSide.map((x) => ({ ...x, pos: [x.pos[0], x.pos[1] - 0.08, x.pos[2]] })) });

  return human;
}

// ---- batting (right-hander, side-on: character +Z = facing, character +X = the avatar's left = towards the bowler when the root yaw is -90 deg).
// Phases (see docs/AUTHORING.md "Batting"): stance -> bat_backlift (bat rises behind, weight back) -> hold -> bat_<shot> starts
// LEAD seconds before contact (downswing, bat head through the ball at peak speed, finish) -> bat_stance.
// The contact key uses `sweet: 'contact'`: the presenter calls human.setTarget('contact', ballWorldPos) so the bat's sweet spot meets the ball.
export const BAT_LEAD = 10 / 60;   // seconds from the start of a bat_<shot> clip to its contact event
export function addBatClips(human, { left = false } = {}) {
  const S = human.info && human.info.height ? human.info.height / 1.74 : 1;
  const g = (x, y, z) => [x * S, y * S, z * S];
  const STANCE = { grip: g(-0.06, 0.94, 0.12), dir: [-0.03, -0.96, 0.27] };   // hands at the front hip, blade resting by the back toes
  const BACK = { grip: g(-0.24, 1.09, 0.42), dir: [-0.62, 0.78, 0.05] };   // ~52 deg above horizontal = ~130 deg from vertical, pointing back over the rear shoulder
  const torsoBack = { Pelvis: { twist: -6, pos: [-0.05, -0.07, 0] }, Spine1: { twist: -10, flex: 4 }, Spine2: { twist: -6, flex: 2 }, Head: { flex: -4 }, R_Thigh: { flex: 26, abduct: 4 }, R_Calf: { flex: 38 }, L_Thigh: { flex: 10 }, L_Calf: { flex: 14 } };
  const torsoStance = { Pelvis: { twist: 0, pos: [0, -0.09, 0] }, Spine1: { twist: 0, flex: 3 }, Spine2: { flex: 2 }, Head: { flex: -4 }, R_Thigh: { flex: 22, abduct: 4 }, R_Calf: { flex: 36 }, L_Thigh: { flex: 18 }, L_Calf: { flex: 28 } };
  const hands = { fingerHands: { R: 'batGrip', L: 'batGrip' } };
  const B = (o) => { const spec = { base: 'ready_stance', group: 'sport', grounded: true, smoothTrunk: false, ...hands, ...o }; const c = buildClip(human, left ? mirrorSpec(spec) : spec); human.addClip(c); return c; };

  B({ name: 'bat_stance', duration: 1.0, loop: true, keys: [{ t: 0, pose: torsoStance }], prop: [{ t: 0, ...STANCE }] });
  B({
    name: 'bat_backlift', duration: 0.5, events: { peak: 0.45 },
    keys: [{ t: 0, pose: torsoStance }, { t: 0.45, pose: torsoBack, ease: 'inOut' }, { t: 0.5, ease: 'out' }],
    prop: [{ t: 0, ...STANCE }, { t: 0.2, grip: g(-0.02, 1.02, 0.32), dir: [-0.1, 0.99, 0.05], ease: 'inOut' }, { t: 0.45, ...BACK, ease: 'inOut' }, { t: 0.5, ...BACK }],
  });

  // shot variants: contact direction/height of the bat, and the finish
  const shot = (name, o) => B({
    name, duration: 0.8, events: { contact: BAT_LEAD, backlift: 0 },
    keys: [
      { t: 0, pose: torsoBack },
      { t: BAT_LEAD, pose: { Pelvis: { twist: 18, pos: [0.06, -0.13, 0.02] }, Spine1: { twist: 16, flex: 24 }, Spine2: { twist: 10, flex: 10 }, Head: { flex: -14 }, R_Thigh: { flex: -4 }, R_Calf: { flex: 12 }, L_Thigh: { flex: 50 }, L_Calf: { flex: 56 }, ...(o.bodyContact || {}) }, ease: 'in' },
      { t: 0.45, pose: { Pelvis: { twist: 34, pos: [0.07, -0.05, 0.02] }, Spine1: { twist: 30, flex: 8 }, Spine2: { twist: 16, flex: 4 }, R_Thigh: { flex: 8 }, R_Calf: { flex: 22 }, L_Thigh: { flex: 24 }, L_Calf: { flex: 8 }, ...(o.bodyFinish || {}) }, ease: 'out' },
      { t: 0.8, pose: torsoStance, ease: 'inOut' },
    ],
    prop: [
      { t: 0, ...BACK },
      ...o.path,
      { t: BAT_LEAD, sweet: 'contact', dir: o.contactDir, roll: o.roll || 0, ease: 'in' },
      { t: 0.3, ...o.after, ease: 'out' },
      { t: 0.45, ...o.finish, ease: 'out' },
      { t: 0.62, grip: g(0.08, 1.1, 0.36), dir: [0.74, -0.52, -0.04], ease: 'inOut' },   // settle: pass through horizontal, never through a 180 degree flip
      { t: 0.8, ...STANCE, ease: 'inOut' },
    ],
  });
  shot('bat_drive', { path: [{ t: 0.06, grip: g(0.06, 1.16, 0.18), dir: [0.03, 0.99, 0.05], ease: 'in' }, { t: 0.115, grip: g(0.12, 0.86, 0.38), dir: [0.89, 0.15, 0.1], ease: 'in' }], contactDir: [0.25, -0.95, 0.05], after: { grip: g(0.37, 0.94, 0.24), dir: [0.55, 0.45, 0.2] }, finish: { grip: g(0.12, 1.37, 0.08), dir: [-0.3, 0.88, 0.32] } });
  shot('bat_cover', { path: [{ t: 0.06, grip: g(0.06, 1.16, 0.18), dir: [0.03, 0.99, 0.05], ease: 'in' }, { t: 0.115, grip: g(0.28, 0.94, 0.22), dir: [0.69, 0.33, -0.53], ease: 'in' }], contactDir: [0.21, -0.96, 0.05], after: { grip: g(0.37, 0.94, 0.2), dir: [0.53, 0.46, -0.23] }, finish: { grip: g(0.16, 1.17, -0.02), dir: [-0.06, 0.87, 0.34] } });
  shot('bat_pull', { path: [{ t: 0.06, grip: g(-0.1, 1.22, 0.3), dir: [-0.2, 0.97, 0.1], ease: 'in' }, { t: 0.115, grip: g(0.12, 1.15, 0.32), dir: [0.1, 0.35, 0.93], ease: 'in' }], contactDir: [0.1, 0.1, 1.0], roll: 90, after: { grip: g(0.05, 1.2, 0.4), dir: [-0.2, 0.25, 0.9] }, finish: { grip: g(-0.15, 1.45, 0.25), dir: [-0.8, 0.5, 0.2] }, bodyContact: { Pelvis: { twist: 40 }, Spine1: { twist: 35 } }, bodyFinish: { Pelvis: { twist: 60 }, Spine1: { twist: 50 } } });
  shot('bat_cut', { path: [{ t: 0.06, grip: g(-0.1, 1.3, 0.22), dir: [-0.3, 0.9, 0.1], ease: 'in' }, { t: 0.115, grip: g(0.05, 1.2, 0.1), dir: [0.05, 0.4, -0.9], ease: 'in' }], contactDir: [0.1, 0.1, -1.0], roll: -90, after: { grip: g(0.1, 1.15, -0.1), dir: [0.2, 0.2, -0.95] }, finish: { grip: g(0.15, 1.3, -0.3), dir: [0.5, 0.4, -0.7] } });
  shot('bat_block', { path: [{ t: 0.08, grip: g(0.03, 1.18, 0.26), dir: [0.05, 0.58, -0.1], ease: 'in' }], contactDir: [0.12, -0.99, 0.04], after: { grip: g(0.22, 0.95, 0.27), dir: [0.2, -0.97, 0.05] }, finish: { grip: g(0.2, 0.9, 0.25), dir: [0.15, -0.98, 0.05] } });
  return human;
}

// ---- throwing and catching (right-handed). Events: throw clips `release`; catch clip `catch`.
// Use human.setReach('R', releasePoint) around the release event so the ball leaves the hand exactly at the sim's point.
// ---- fielding and wicket-keeping basics. Targets (world points, set with human.setTarget): 'stop' ball to dive/slide to, 'ball' ball on the ground to pick up,
// 'take' ball the keeper takes, 'stumps' the bails. Events: stop, pickup, release, catch, break. Right-handed; { left: true } mirrors.
export function addFieldClips(human, { left = false } = {}) {
  const S = human.info && human.info.height ? human.info.height / 1.74 : 1;
  const P = (x, y, z) => [x * S, y * S, z * S];
  const F = (o) => { const spec = { base: 'idle', group: 'sport', grounded: true, fingerHands: { R: 'open', L: 'open' }, ...o }; const c = buildClip(human, left ? mirrorSpec(spec) : spec); human.addClip(c); return c; };
  const crouch = { Pelvis: { flex: 8, pos: [0, -0.2, 0.05] }, Spine1: { flex: 22 }, Spine2: { flex: 10 }, Head: { flex: -18 }, R_Thigh: { flex: 62 }, R_Calf: { flex: 78, }, L_Thigh: { flex: 62 }, L_Calf: { flex: 78 } };
  const readyHands = { R_Hand: { keys: [{ t: 0, pos: P(-0.18, 0.78, 0.46) }, { t: 1, pos: P(-0.18, 0.78, 0.46) }], pole: [{ t: 0, pos: [-0.6, 0.7, 0.1] }, { t: 1, pos: [-0.6, 0.7, 0.1] }] }, L_Hand: { keys: [{ t: 0, pos: P(0.18, 0.78, 0.46) }, { t: 1, pos: P(0.18, 0.78, 0.46) }], pole: [{ t: 0, pos: [0.6, 0.7, 0.1] }, { t: 1, pos: [0.6, 0.7, 0.1] }] } };
  // ready crouch: athletic, weight on the balls of the feet, hands low and open
  F({ name: 'field_ready', duration: 1.0, loop: true, keys: [{ t: 0, pose: crouch }, { t: 0.5, pose: { ...crouch, Pelvis: { flex: 8, pos: [0, -0.22, 0.05] } }, ease: 'inOut' }, { t: 1, pose: crouch, ease: 'inOut' }], ik: readyHands });
  // chase: the base sprint, leaning into it with the arms driving
  F({ name: 'field_chase', base: 'sprint', inherit: true, duration: 0.6, loop: true, keys: [{ t: 0, pose: { Spine1: { flex: 14 }, Spine2: { flex: 6 }, Head: { flex: -12 } } }] });
  // dive-stop to the right: step out, launch, hand to the ball, land and slide
  F({
    name: 'field_dive_stop', duration: 1.2, grounded: false, events: { stop: 0.36 },
    keys: [
      { t: 0.00, pose: crouch },
      { t: 0.16, pose: { Pelvis: { side: -18, flex: 8, pos: [-0.25, -0.12, 0.05] }, Spine1: { side: -22, flex: 16 }, R_Thigh: { abduct: 30, flex: 26 }, R_Calf: { flex: 20 }, L_Thigh: { flex: 40 }, L_Calf: { flex: 60 } }, ease: 'in' },
      { t: 0.36, pose: { Pelvis: { side: -62, flex: 18, pos: [-0.62, -0.32, 0.1] }, Spine1: { side: -26, flex: 14 }, Spine2: { side: -10 }, Head: { flex: -10 }, R_Thigh: { abduct: 30, flex: 10 }, R_Calf: { flex: 25 }, L_Thigh: { flex: -10, abduct: -6 }, L_Calf: { flex: 25 } }, ease: 'out' },
      { t: 0.7, pose: { Pelvis: { side: -78, flex: 10, pos: [-0.9, -0.55, 0.2] }, Spine1: { side: -12 }, R_Thigh: { abduct: 10, flex: 0 }, R_Calf: { flex: 8 }, L_Thigh: { flex: -8 }, L_Calf: { flex: 14 } }, ease: 'out' },
      { t: 1.2, pose: { Pelvis: { side: -80, flex: 6, pos: [-1.0, -0.6, 0.25] }, Spine1: { side: -8 } }, ease: 'inOut' },
    ],
    ik: { R_Hand: { keys: [{ t: 0, pos: P(-0.18, 0.78, 0.46) }, { t: 0.16, pos: P(-0.55, 0.9, 0.5), ease: 'out' }, { t: 0.36, target: 'stop', pos: P(-0.95, 0.35, 0.55), ease: 'out' }, { t: 1.2, target: 'stop', pos: P(-1.0, 0.12, 0.55) }], pole: [{ t: 0, pos: [-0.6, 0.7, 0.1] }, { t: 1.2, pos: [-0.8, 0.5, -0.2] }] }, L_Hand: { keys: [{ t: 0, pos: P(0.18, 0.78, 0.46) }, { t: 0.36, pos: P(0.2, 0.9, 0.4), ease: 'out' }, { t: 1.2, pos: P(0.1, 0.5, 0.3), ease: 'inOut' }], pole: [{ t: 0, pos: [0.6, 0.7, 0.1] }, { t: 1.2, pos: [0.5, 0.6, 0] }] } },
  });
  // long barrier (slide-stop): kneel on the back leg, the front leg out to the side, both hands behind the ball
  F({
    name: 'field_slide_stop', duration: 1.0, grounded: false, events: { stop: 0.3 },
    keys: [
      { t: 0.00, pose: crouch },
      { t: 0.3, pose: { Pelvis: { flex: 10, twist: -10, pos: [0, -0.44, 0.1] }, Spine1: { flex: 20 }, Spine2: { flex: 8 }, Head: { flex: -22 }, R_Thigh: { flex: 88, abduct: 10 }, R_Calf: { flex: 128 }, L_Thigh: { flex: 8, abduct: 60 }, L_Calf: { flex: 2 } }, ease: 'out' },
      { t: 1.0, pose: { Pelvis: { flex: 10, twist: -6, pos: [0, -0.46, 0.16] }, Spine1: { flex: 16 }, Head: { flex: -22 }, R_Thigh: { flex: 88, abduct: 10 }, R_Calf: { flex: 128 }, L_Thigh: { flex: 8, abduct: 60 }, L_Calf: { flex: 2 } }, ease: 'inOut' },
    ],
    ik: { R_Hand: { keys: [{ t: 0, pos: P(-0.18, 0.78, 0.46) }, { t: 0.3, target: 'stop', off: [-0.04, 0, 0], pos: P(-0.14, 0.1, 0.45), ease: 'out' }, { t: 1, target: 'stop', off: [-0.04, 0, 0], pos: P(-0.14, 0.1, 0.45) }], pole: [{ t: 0, pos: [-0.6, 0.7, 0.1] }, { t: 1, pos: [-0.6, 0.4, 0.1] }] }, L_Hand: { keys: [{ t: 0, pos: P(0.18, 0.78, 0.46) }, { t: 0.3, target: 'stop', off: [0.04, 0, 0], pos: P(0.14, 0.1, 0.45), ease: 'out' }, { t: 1, target: 'stop', off: [0.04, 0, 0], pos: P(0.14, 0.1, 0.45) }], pole: [{ t: 0, pos: [0.6, 0.7, 0.1] }, { t: 1, pos: [0.6, 0.4, 0.1] }] } },
  });
  // pick-up and throw: run-through, scoop the ball with the right hand, rise and release overarm
  F({
    name: 'field_pickup_throw', duration: 1.15, events: { pickup: 0.22, release: 0.7 }, fingerHands: { R: 'throwGrip', L: 'open' },
    keys: [
      { t: 0.00, pose: { Pelvis: { flex: 10, pos: [0, -0.18, 0] }, Spine1: { flex: 28 }, R_Thigh: { flex: 40 }, R_Calf: { flex: 55 }, L_Thigh: { flex: 20 }, L_Calf: { flex: 30 } } },
      { t: 0.22, pose: { Pelvis: { flex: 12, twist: -8, pos: [0, -0.34, 0.08] }, Spine1: { flex: 36 }, Spine2: { flex: 12 }, Head: { flex: -22 }, R_Thigh: { flex: 70 }, R_Calf: { flex: 95 }, L_Thigh: { flex: 24 }, L_Calf: { flex: 20 } }, ease: 'out' },
      { t: 0.46, pose: { Pelvis: { twist: -38, pos: [0, -0.05, 0] }, Spine1: { twist: -28, flex: 6 }, R_Thigh: { flex: 8 }, R_Calf: { flex: 14 }, L_Thigh: { flex: 24 }, L_Calf: { flex: 12 } }, ease: 'inOut' },
      { t: 0.7, pose: { Pelvis: { twist: 8, pos: [0, -0.07, 0.1] }, Spine1: { twist: 12, flex: 20 }, R_Thigh: { flex: -8 }, R_Calf: { flex: 10 }, L_Thigh: { flex: 32 }, L_Calf: { flex: 8 } }, ease: 'in' },
      { t: 1.15, pose: { Pelvis: { twist: 28, pos: [0, -0.04, 0.1] }, Spine1: { twist: 26, flex: 24 }, R_Thigh: { flex: 24 }, R_Calf: { flex: 44 }, L_Thigh: { flex: 20 }, L_Calf: { flex: 6 } }, ease: 'out' },
    ],
    ik: { R_Hand: { keys: [{ t: 0, pos: P(-0.2, 0.7, 0.25) }, { t: 0.22, target: 'ball', pos: P(-0.1, 0.08, 0.45), ease: 'out' }, { t: 0.4, pos: P(-0.14, 1.2, 0.3), ease: 'inOut' }, { t: 0.52, pos: P(-0.27, 1.42, -0.3), ease: 'inOut' }, { t: 0.6, pos: P(-0.24, 1.62, -0.2), ease: 'in' }, { t: 0.7, pos: P(-0.16, 1.78, 0.18), ease: 'in' }, { t: 0.85, pos: P(-0.05, 1.5, 0.5), ease: 'out' }, { t: 1.15, pos: P(0.1, 1.1, 0.5), ease: 'out' }], pole: [{ t: 0, pos: [-0.6, 0.6, 0] }, { t: 0.5, pos: [-0.7, 1.5, -0.4] }, { t: 1.15, pos: [-0.4, 0.9, 0.2] }] }, L_Hand: { keys: [{ t: 0, pos: P(0.2, 0.7, 0.2) }, { t: 0.22, pos: P(0.3, 0.35, 0.3), ease: 'out' }, { t: 0.55, pos: P(0.14, 1.42, 0.6), ease: 'inOut' }, { t: 0.75, pos: P(0.12, 1.2, 0.3), ease: 'in' }, { t: 1.15, pos: P(0.25, 0.95, 0.1), ease: 'out' }], pole: [{ t: 0, pos: [0.6, 0.6, 0] }, { t: 1.15, pos: [0.5, 1.0, 0] }] } },
  });
  // wicket-keeper: deep crouch behind the stumps, the take (give with the ball), and the stumping sweep to the bails
  const keep = { Pelvis: { flex: 4, pos: [0, -0.42, 0.04] }, Spine1: { flex: 8 }, Spine2: { flex: 4 }, Head: { flex: -10 }, R_Thigh: { flex: 82, abduct: 10 }, R_Calf: { flex: 118 }, L_Thigh: { flex: 82, abduct: 10 }, L_Calf: { flex: 118 } };
  const kh = (x, y, z) => [{ t: 0, pos: P(x, y, z) }, { t: 1, pos: P(x, y, z) }];
  F({ name: 'keeper_crouch', duration: 1.2, loop: true, keys: [{ t: 0, pose: keep }, { t: 0.6, pose: { ...keep, Pelvis: { flex: 4, pos: [0, -0.43, 0.04] } }, ease: 'inOut' }, { t: 1.2, pose: keep, ease: 'inOut' }], ik: { R_Hand: { keys: kh(-0.14, 0.34, 0.5).map((k, i) => ({ ...k, t: i * 1.2 })), pole: [{ t: 0, pos: [-0.6, 0.4, 0] }] }, L_Hand: { keys: kh(0.14, 0.34, 0.5).map((k, i) => ({ ...k, t: i * 1.2 })), pole: [{ t: 0, pos: [0.6, 0.4, 0] }] } } });
  F({
    name: 'keeper_take', duration: 0.9, events: { catch: 0.2 }, fingerHands: { R: 'ballGrip', L: 'ballGrip' },
    keys: [{ t: 0, pose: keep }, { t: 0.2, pose: { ...keep, Pelvis: { flex: 4, pos: [0, -0.38, 0.06] }, Spine1: { flex: 14 } }, ease: 'out' }, { t: 0.5, pose: { ...keep, Pelvis: { flex: 4, pos: [0, -0.3, 0.02] }, Spine1: { flex: 4 } }, ease: 'inOut' }, { t: 0.9, pose: keep, ease: 'inOut' }],
    ik: { R_Hand: { keys: [{ t: 0, pos: P(-0.14, 0.34, 0.5) }, { t: 0.2, target: 'take', off: [-0.04, 0, 0], pos: P(-0.1, 0.7, 0.55), ease: 'out' }, { t: 0.5, pos: P(-0.08, 0.7, 0.28), ease: 'inOut' }, { t: 0.9, pos: P(-0.14, 0.34, 0.5), ease: 'inOut' }], pole: [{ t: 0, pos: [-0.6, 0.4, 0] }] }, L_Hand: { keys: [{ t: 0, pos: P(0.14, 0.34, 0.5) }, { t: 0.2, target: 'take', off: [0.04, 0, 0], pos: P(0.1, 0.7, 0.55), ease: 'out' }, { t: 0.5, pos: P(0.08, 0.7, 0.28), ease: 'inOut' }, { t: 0.9, pos: P(0.14, 0.34, 0.5), ease: 'inOut' }], pole: [{ t: 0, pos: [0.6, 0.4, 0] }] } },
  });
  F({
    name: 'keeper_stump', duration: 1.1, events: { catch: 0.2, break: 0.5 }, fingerHands: { R: 'ballGrip', L: 'ballGrip' },
    keys: [{ t: 0, pose: keep }, { t: 0.2, pose: { ...keep, Pelvis: { flex: 4, pos: [0, -0.38, 0.06] }, Spine1: { flex: 14 } }, ease: 'out' }, { t: 0.5, pose: { ...keep, Pelvis: { flex: 6, twist: 14, pos: [0.06, -0.34, 0.05] }, Spine1: { flex: 16, twist: 8 } }, ease: 'in' }, { t: 1.1, pose: keep, ease: 'inOut' }],
    ik: { R_Hand: { keys: [{ t: 0, pos: P(-0.14, 0.34, 0.5) }, { t: 0.2, target: 'take', off: [-0.04, 0, 0], pos: P(-0.1, 0.7, 0.55), ease: 'out' }, { t: 0.5, target: 'stumps', pos: P(0.1, 0.5, 0.6), ease: 'in' }, { t: 1.1, pos: P(-0.14, 0.34, 0.5), ease: 'inOut' }], pole: [{ t: 0, pos: [-0.6, 0.4, 0] }] }, L_Hand: { keys: [{ t: 0, pos: P(0.14, 0.34, 0.5) }, { t: 0.2, target: 'take', off: [0.04, 0, 0], pos: P(0.1, 0.7, 0.55), ease: 'out' }, { t: 0.5, target: 'stumps', off: [0.05, 0, 0], pos: P(0.2, 0.5, 0.6), ease: 'in' }, { t: 1.1, pos: P(0.14, 0.34, 0.5), ease: 'inOut' }], pole: [{ t: 0, pos: [0.6, 0.4, 0] }] } },
  });
  return human;
}

export function addThrowClips(human, { left = false } = {}) {
  const S = human.info && human.info.height ? human.info.height / 1.74 : 1;
  const sc = (arr) => arr.map((k) => ({ ...k, pos: k.pos ? k.pos.map((v) => v * S) : k.pos }));
  const T = (o) => { const spec = { base: 'idle', group: 'sport', grounded: true, fingerHands: { R: 'ballGrip', L: 'open' }, ...o }; const c = buildClip(human, left ? mirrorSpec(spec) : spec); human.addClip(c); return c; };

  // fielder's overarm throw: cock the arm behind the ear, step, whip forward, release at the top of the arc in front
  T({
    name: 'throw_overarm', duration: 0.95, fingerHands: { R: 'throwGrip', L: 'open' },
    keys: [
      { t: 0.00, pose: { Pelvis: { pos: [0, -0.02, 0] }, Spine1: { flex: 4 }, L_Thigh: { flex: 4 } } },
      { t: 0.18, pose: { Pelvis: { twist: -40 }, Spine1: { twist: -30, flex: -3 }, Spine2: { twist: -14 }, R_Thigh: { flex: 6, abduct: 3 }, R_Calf: { flex: 14 }, L_Thigh: { flex: 20 }, L_Calf: { flex: 14 } }, ease: 'inOut' },
      { t: 0.30, pose: { Pelvis: { twist: 6, pos: [0, -0.06, 0.08] }, Spine1: { twist: 10, flex: 18 }, Spine2: { twist: 8, flex: 8 }, R_Thigh: { flex: -8 }, R_Calf: { flex: 8 }, L_Thigh: { flex: 30 }, L_Calf: { flex: 8 } }, ease: 'in' },
      { t: 0.55, pose: { Pelvis: { twist: 30, pos: [0, -0.04, 0.1] }, Spine1: { twist: 26, flex: 26 }, Spine2: { twist: 16, flex: 10 }, R_Thigh: { flex: 22 }, R_Calf: { flex: 40 }, L_Thigh: { flex: 20 }, L_Calf: { flex: 6 } }, ease: 'out' },
      { t: 0.95, pose: { Pelvis: { twist: 4 }, Spine1: { twist: 4, flex: 8 }, R_Thigh: { flex: 6 }, R_Calf: { flex: 10 }, L_Thigh: { flex: 8 } }, ease: 'inOut' },
    ],
    ik: {
      R_Hand: {
        keys: sc([{ t: 0, pos: [-0.1, 1.2, 0.3] }, { t: 0.18, pos: [-0.27, 1.42, -0.3], ease: 'inOut' }, { t: 0.24, pos: [-0.24, 1.62, -0.2], ease: 'in' }, { t: 0.30, pos: [-0.16, 1.78, 0.18], ease: 'in' }, { t: 0.40, pos: [-0.05, 1.55, 0.5], ease: 'out' }, { t: 0.55, pos: [0.1, 1.15, 0.5], ease: 'out' }, { t: 0.95, pos: [-0.22, 0.92, 0.1], ease: 'inOut' }]),
        pole: sc([{ t: 0, pos: [-0.6, 1.2, 0.0] }, { t: 0.2, pos: [-0.7, 1.6, -0.4] }, { t: 0.3, pos: [-0.7, 1.7, -0.1] }, { t: 0.55, pos: [-0.4, 0.9, 0.2] }, { t: 0.95, pos: [-0.5, 1.0, 0] }]),
      },
      L_Hand: { keys: sc([{ t: 0, pos: [0.15, 1.25, 0.4] }, { t: 0.18, pos: [0.14, 1.42, 0.6], ease: 'out' }, { t: 0.30, pos: [0.14, 1.38, 0.6] }, { t: 0.4, pos: [0.12, 1.2, 0.3], ease: 'in' }, { t: 0.95, pos: [0.25, 0.92, 0.08], ease: 'inOut' }]), pole: sc([{ t: 0, pos: [0.6, 1.2, 0.2] }, { t: 0.95, pos: [0.5, 1.0, 0] }]) },
    },
    events: { release: 0.30 },
  });

  // the base-library `throw` (motion-capture vignette) is not a fielder's throw: for humans that load these clips, `throw` IS the overarm throw
  human.addClip(human.clips.throw_overarm, 'throw');

  // short underarm / side-arm toss: arm swings back low and forward, release low in front of the hip
  T({
    name: 'toss_underarm', duration: 0.8,
    keys: [
      { t: 0.00, pose: { Spine1: { flex: 8 }, R_Thigh: { flex: 4 }, L_Thigh: { flex: 10 }, L_Calf: { flex: 14 } } },
      { t: 0.14, pose: { Pelvis: { twist: -14 }, Spine1: { twist: -12, flex: 12 }, L_Thigh: { flex: 14 }, L_Calf: { flex: 14 } }, ease: 'inOut' },
      { t: 0.30, pose: { Pelvis: { twist: 8, pos: [0, -0.05, 0.05] }, Spine1: { twist: 8, flex: 20 }, L_Thigh: { flex: 24 }, L_Calf: { flex: 14 } }, ease: 'in' },
      { t: 0.8, pose: { Spine1: { flex: 8 }, L_Thigh: { flex: 8 } }, ease: 'inOut' },
    ],
    ik: {
      R_Hand: { keys: sc([{ t: 0, pos: [-0.2, 0.95, 0.28] }, { t: 0.14, pos: [-0.26, 0.78, -0.2], ease: 'inOut' }, { t: 0.30, pos: [-0.2, 0.7, 0.42], ease: 'in' }, { t: 0.45, pos: [-0.1, 0.95, 0.5], ease: 'out' }, { t: 0.8, pos: [-0.22, 0.92, 0.1], ease: 'inOut' }]), pole: sc([{ t: 0, pos: [-0.6, 0.9, -0.1] }, { t: 0.8, pos: [-0.5, 0.95, -0.1] }]) },
      L_Hand: { keys: sc([{ t: 0, pos: [0.2, 0.95, 0.25] }, { t: 0.3, pos: [0.3, 1.0, 0.3] }, { t: 0.8, pos: [0.25, 0.92, 0.08] }]) },
    },
    events: { release: 0.30 },
  });

  // two-handed catch at the named target 'catch' (set with human.setTarget('catch', ballWorldPos)); hands cup, give with the ball
  T({
    name: 'catch_two_hand', duration: 0.8, fingerHands: { R: 'open', L: 'open' },
    keys: [
      { t: 0.0, pose: { Spine1: { flex: 8 }, R_Thigh: { flex: 8 }, L_Thigh: { flex: 8 }, R_Calf: { flex: 14 }, L_Calf: { flex: 14 } } },
      { t: 0.3, pose: { Spine1: { flex: 12 }, R_Thigh: { flex: 14 }, L_Thigh: { flex: 14 }, R_Calf: { flex: 24 }, L_Calf: { flex: 24 } }, ease: 'out' },
      { t: 0.8, pose: { Spine1: { flex: 8 } }, ease: 'inOut' },
    ],
    ik: {
      R_Hand: { keys: [{ t: 0, pos: [-0.2 * S, 1.2 * S, 0.3 * S] }, { t: 0.22, target: 'catch', off: [-0.045, 0, 0], ease: 'out' }, { t: 0.3, target: 'catch', off: [-0.03, 0, 0] }, { t: 0.45, target: 'catch', off: [-0.03, -0.1, -0.12], ease: 'out' }, { t: 0.8, pos: [-0.22 * S, 0.95 * S, 0.1 * S], ease: 'inOut' }], pole: [{ t: 0, pos: [-0.6, 1.0, 0] }, { t: 0.8, pos: [-0.6, 1.0, 0] }] },
      L_Hand: { keys: [{ t: 0, pos: [0.2 * S, 1.2 * S, 0.3 * S] }, { t: 0.22, target: 'catch', off: [0.045, 0, 0], ease: 'out' }, { t: 0.3, target: 'catch', off: [0.03, 0, 0] }, { t: 0.45, target: 'catch', off: [0.03, -0.1, -0.12], ease: 'out' }, { t: 0.8, pos: [0.22 * S, 0.95 * S, 0.1 * S], ease: 'inOut' }], pole: [{ t: 0, pos: [0.6, 1.0, 0] }, { t: 0.8, pos: [0.6, 1.0, 0] }] },
    },
    events: { catch: 0.30 },
  });
  return human;
}
