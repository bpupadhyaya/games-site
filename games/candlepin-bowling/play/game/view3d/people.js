// People: two bowlers (a view3d athlete each, in bowling shirts) and the spectators (crowd3d) in the lounge and beside the approach.
// Presentation only: everything is a function of the sim state (who is up, where the ball is aimed, the wind-up timer, results).
//
// Delivery: ROLL starts the wind-up (state.pending, 0.42 s). The authored clip is SCRUBBED to the wind-up timer so the release key lands
// exactly on the launch tick; the right hand is reached to the sim ball's start point around the release so ball and hand agree.
// Locomotion: the walk cycle is driven by the distance the bowler really travels (m/s measured per frame), facing follows the heading.
import { LANE } from '../src/sim.js';
import { loungePoints } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smoothstep = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const REL = 0.36;                      // release key time in the delivery clip (s)
const CLIP_DUR = 1.25;
const STAND_Y = -0.66;                 // where a bowler's root stands behind the foul line
const WAIT = [[-1.15, -1.9, 0.5], [1.15, -2.0, -0.5]];   // x, y, extra yaw while waiting
const FACE = Math.PI;                  // yaw that faces down the lane (-Z)

export function createPeople({ THREE, scene, camera, quality, ballMaterial }) {
  let V3 = null, ready = false, crowd = null, dbg = null, lastPop = null, excite = 0.25;
  const B = [];                        // bowlers

  async function load() {
    V3 = await import('../vendor3d/index.js');
    const { loadHuman, buildClip } = V3;
    const specs = [
      { character: 'athlete_m', kit: { top: '#c92a2f', trim: '#f7f0dc', bottoms: '#262b38', socks: '#f7f0dc', shoes: '#ece6d4' }, skin: 'tan', hair: 'brown' },
      { character: 'athlete_f', kit: { top: '#157a78', trim: '#f7f0dc', bottoms: '#262b38', socks: '#f7f0dc', shoes: '#ece6d4' }, skin: 'light', hair: 'black' },
    ];
    for (const sp of specs) {
      const h = await loadHuman({ character: sp.character, kit: sp.kit, skin: sp.skin, hair: sp.hair });
      h.footPlanting = false; h.groundClamp = 'off';
      scene.add(h.root);
      const b = { h, x: WAIT[B.length][0], y: WAIT[B.length][1], yaw: FACE, speed: 0, goal: null, afterT: -1, ball: null };
      author(h, buildClip, b);
      B.push(b);
    }
    for (const b of B) {   // the ball in hand (same material as the lane ball; the lane ball itself is the presenter's)
      const m = new THREE.Mesh(new THREE.SphereGeometry(LANE.ballR, 32, 22), ballMaterial);
      m.castShadow = true; m.visible = false; b.ball = m;
      b.h.attach(m, 'R', 'ball');
      const fr = b.h.fingers.R;
      if (fr && fr.ok) m.position.copy(fr.knuckle).multiplyScalar(0.45).addScaledVector(fr.palmDir, 0.062);
    }
    const pts = loungePoints().map((p) => ({ x: p.x, y: p.y, z: p.z, yaw: p.yaw, seated: true }));
    crowd = V3.createCrowd3d({ scene, camera }, {
      points: pts, seed: 11, culture: ['american_rural', 'european_village'], quality: quality(),
      free: { area: [-3.9, 1.0, 3.9, 3.6], y: 0, count: 10, walkers: 0, face: FACE, avoid: (x) => Math.abs(x) < 2.2 },
      props: { flag: 0, phone: 0.12, child: 0.05 }, excitement: 0.25,
    });
    ready = true;
  }

  // Authored delivery. Character space: +Z ahead, +X to the avatar's left; the right hand therefore has negative x.
  function author(h, buildClip, b) {
    const BASE = { clip: 'idle_relaxed', time: 0.6 };
    const trunk = (f, tw = 0) => ({ Spine: { flex: f, twist: tw }, Neck: { flex: -f * 0.5 }, Head: { flex: -f * 0.25 } });
    const legs = (lf, lc, rf, rc) => ({ L_Thigh: { flex: lf }, L_Calf: { flex: lc }, R_Thigh: { flex: rf }, R_Calf: { flex: rc } });
    const keys = [
      { t: 0.0, pose: { Pelvis: { pos: [0, -0.05, 0] }, ...trunk(14), ...legs(14, 24, 10, 22) } },
      { t: 0.14, pose: { Pelvis: { pos: [0, -0.09, -0.05] }, ...trunk(22, -8), ...legs(18, 30, 12, 26) }, ease: 'inOut' },
      { t: 0.27, pose: { Pelvis: { pos: [0, -0.26, 0.22] }, ...trunk(38, 6), ...legs(58, 66, 18, 40) }, ease: 'inOut' },
      { t: REL, pose: { Pelvis: { pos: [0, -0.4, 0.36] }, ...trunk(50, 10), ...legs(72, 92, 26, 62) }, ease: 'out' },
      { t: 0.6, pose: { Pelvis: { pos: [0, -0.3, 0.3] }, ...trunk(34, 14), ...legs(60, 78, 22, 52) }, ease: 'inOut' },
      { t: 0.92, pose: { Pelvis: { pos: [0, -0.14, 0.12] }, ...trunk(18, 4), ...legs(30, 48, 14, 30) }, ease: 'inOut' },
      { t: CLIP_DUR, pose: { Pelvis: { pos: [0, -0.05, 0] }, ...trunk(14), ...legs(14, 24, 10, 22) }, ease: 'inOut' },
    ];
    const ik = {
      R_Hand: {
        keys: [
          { t: 0.0, pos: [-0.2, 0.92, 0.32] },
          { t: 0.14, pos: [-0.24, 0.72, -0.18], ease: 'inOut' },        // back swing
          { t: 0.27, pos: [-0.2, 0.42, 0.28], ease: 'in' },
          { t: REL, pos: [-0.19, 0.16, 0.78], ease: 'out' },            // low release past the front foot
          { t: 0.55, pos: [-0.2, 0.62, 0.86], ease: 'out' },            // follow through up and forward
          { t: 0.85, pos: [-0.22, 0.9, 0.5], ease: 'inOut' },
          { t: CLIP_DUR, pos: [-0.2, 0.92, 0.32], ease: 'inOut' },
        ],
        pole: [{ t: 0, pos: [-0.6, 0.9, 0.1] }, { t: CLIP_DUR, pos: [-0.6, 0.9, 0.1] }],
      },
      L_Hand: {
        keys: [
          { t: 0.0, pos: [0.28, 0.98, 0.24] }, { t: 0.27, pos: [0.46, 0.9, 0.18], ease: 'inOut' }, { t: REL, pos: [0.5, 0.8, 0.1], ease: 'out' },
          { t: 0.7, pos: [0.42, 0.88, 0.1], ease: 'inOut' }, { t: CLIP_DUR, pos: [0.28, 0.98, 0.24], ease: 'inOut' },
        ],
        pole: [{ t: 0, pos: [0.7, 0.9, 0] }, { t: CLIP_DUR, pos: [0.7, 0.9, 0] }],
      },
      L_Foot: {
        keys: [
          { t: 0.0, pos: [0.1, 0.09, 0.04] }, { t: 0.14, pos: [0.1, 0.09, 0.04] },
          { t: 0.27, pos: [0.12, 0.2, 0.34], ease: 'inOut' }, { t: REL, pos: [0.12, 0.09, 0.62], ease: 'out' },
          { t: 0.72, pos: [0.12, 0.09, 0.62] }, { t: 0.95, pos: [0.11, 0.16, 0.3], ease: 'inOut' }, { t: CLIP_DUR, pos: [0.1, 0.09, 0.04], ease: 'inOut' },
        ],
      },
      R_Foot: {
        keys: [
          { t: 0.0, pos: [-0.1, 0.09, -0.06] }, { t: 0.27, pos: [-0.1, 0.09, -0.14], ease: 'inOut' },
          { t: REL, pos: [-0.12, 0.1, -0.34], ease: 'out' }, { t: 0.72, pos: [-0.12, 0.09, -0.3] },
          { t: 0.95, pos: [-0.11, 0.14, -0.14], ease: 'inOut' }, { t: CLIP_DUR, pos: [-0.1, 0.09, -0.06], ease: 'inOut' },
        ],
      },
    };
    b.clip = buildClip(h, { name: 'candle_roll', duration: CLIP_DUR, base: BASE, grounded: false, keys, ik, events: { release: REL }, fingers: 'ballGrip' });
    h.addClip(b.clip);
    const still = [{ t: 0, pose: { Pelvis: { pos: [0, -0.05, 0] }, ...trunk(14), ...legs(14, 24, 10, 22) } }, { t: 1, pose: { Pelvis: { pos: [0, -0.05, 0] }, ...trunk(14), ...legs(14, 24, 10, 22) } }];
    b.ready = buildClip(h, {
      name: 'bowler_ready', duration: 1, base: BASE, grounded: false, keys: still, fingers: 'ballGrip',
      ik: {
        R_Hand: { keys: [{ t: 0, pos: [-0.2, 0.92, 0.32] }, { t: 1, pos: [-0.2, 0.92, 0.32] }], pole: [{ t: 0, pos: [-0.6, 0.9, 0.1] }, { t: 1, pos: [-0.6, 0.9, 0.1] }] },
        L_Hand: { keys: [{ t: 0, pos: [0.28, 0.98, 0.24] }, { t: 1, pos: [0.28, 0.98, 0.24] }], pole: [{ t: 0, pos: [0.7, 0.9, 0] }, { t: 1, pos: [0.7, 0.9, 0] }] },
        L_Foot: [{ t: 0, pos: [0.1, 0.09, 0.04] }, { t: 1, pos: [0.1, 0.09, 0.04] }], R_Foot: [{ t: 0, pos: [-0.1, 0.09, -0.06] }, { t: 1, pos: [-0.1, 0.09, -0.06] }],
      },
    });
    h.addClip(b.ready);
  }

  const scrub = (b, clip, t, fade = 0.12) => {
    const h = b.h;
    let tr = h.layers.base.current;
    if (!tr || tr.clip !== clip) { h.play(clip, { fade, loop: false }); tr = h.layers.base.current; }
    tr.speed = 0; tr.time = clamp(t, 0, clip.dur); tr.warp = null; tr.loop = false;
  };

  function update(state, L, dt, world, play) {
    if (!ready) {
      // fallback until the people load: the ball waits on the line
      if (play && state.phase === 'aim') return { held: { pos: new THREE.Vector3(state.x0 ?? 0, LANE.ballR, -0.12), shadow: true } };
      return { held: null };
    }
    crowd.update(dt);
    // results for the crowd
    const pop = play ? state.pop : null;
    if (pop && pop !== lastPop) {
      lastPop = pop;
      if (/STRIKE|CLEAR/.test(pop.text)) { crowd.react('cheer', { origin: [0, 0, 2.5], radius: 14, intensity: 1 }); excite = 0.9; }
      else if (/SPARE/.test(pop.text)) { crowd.react('cheer', { origin: [0, 0, 2.5], radius: 14, intensity: 0.7 }); excite = 0.7; }
      else if (/No pins/.test(pop.text)) crowd.react('groan', { origin: [0, 0, 2.5], radius: 14, intensity: 0.6 });
    } else if (!pop) lastPop = null;
    excite = Math.max(0.25, excite - dt * 0.15);
    crowd.setExcitement(excite);

    const m = state.m;
    const active = play ? (m ? m.turn : 0) : 0;
    const two = play && !!m && m.n === 2;
    for (let i = 0; i < 2; i++) {
      const b = B[i], h = b.h;
      const present = play ? (i === 0 || two) : true;
      h.root.visible = present;
      if (!present) { b.ball.visible = false; continue; }
      const isActive = play && i === active;
      // ---- where this bowler wants to stand
      let tx, ty, tyaw = FACE;
      if (isActive) { tx = (state.x0 ?? 0) - 0.2; ty = STAND_Y; }
      else if (play) { tx = WAIT[i][0]; ty = WAIT[i][1]; tyaw = FACE + WAIT[i][2] * 0.6; }
      else { tx = i === 0 ? -0.2 : 0.7; ty = i === 0 ? STAND_Y - 0.1 : -1.7; }
      const pend = !!(isActive && state.pending);
      // hysteresis: small aim drags do not make the bowler take steps
      if (!b.goal || pend || Math.hypot(tx - b.goal.x, ty - b.goal.y) > (isActive ? 0.1 : 0.02)) b.goal = { x: tx, y: ty };
      const gx = b.goal.x - b.x, gy = b.goal.y - b.y, gd = Math.hypot(gx, gy);
      const throwingNow = pend || (isActive && b.afterT >= 0 && b.afterT < CLIP_DUR - REL);
      let v;
      if (!throwingNow && gd > 0.03) v = damp(b.speed, Math.min(1.55, 0.35 + gd * 1.6), 5, dt);
      else v = damp(b.speed, 0, 9, dt);
      b.speed = v;
      const stp = Math.min(gd, v * dt);
      if (gd > 1e-4 && stp > 0) { b.x += (gx / gd) * stp; b.y += (gy / gd) * stp; }
      if (pend) { b.x = damp(b.x, tx, 9, dt); b.y = damp(b.y, ty, 9, dt); }
      // facing: the heading while walking, down the lane otherwise
      let want = tyaw;
      if (v > 0.12 && gd > 0.05) want = Math.atan2(gx, -gy);        // three: x right, z = -y
      const rate = v > 0.12 ? 7 : 5;
      b.yaw += clamp(angDiff(b.yaw, want), -rate * dt, rate * dt);
      h.setFacing(b.yaw);
      h.setPosition(b.x, 0, -b.y);

      // ---- what the body does
      if (pend) b.afterT = 0;
      else if (isActive && state.phase === 'roll' && b.afterT >= 0) b.afterT += dt;
      else if (!isActive || state.phase === 'aim') b.afterT = -1;
      if (dbg && dbg.who === i) {
        scrub(b, b.clip, dbg.t); b.afterT = -1;
        if (dbg.reach) h.setReach('R', dbg.reach, { weight: 1 });
      } else if (throwingNow) {
        const t = pend ? state.pending.t * (REL / state.pending.dur) : REL + b.afterT;
        scrub(b, b.clip, Math.min(t, CLIP_DUR));
        // the hand meets the sim ball's start point around the release
        const w = pend ? smoothstep((t - 0.2) / 0.14) : 1 - smoothstep((t - REL - 0.03) / 0.12);
        const px = pend ? state.pending.x0 : (world.ball ? world.ball.x : state.x0);
        if (w > 0.01) h.setReach('R', { x: px, y: LANE.ballR + 0.02, z: 0.02 }, { weight: w, pole: { x: px + 0.45, y: 0.5, z: 0.25 } });
        else h.setReach('R', null);
      } else {
        h.setReach('R', null);
        if (v > 0.12) {
          h.locomote(v, { fade: 0.25 });
        } else if (isActive) scrub(b, b.ready, 0.5, 0.25);
        else {
          const tr = h.layers.base.current;
          if (!tr || tr.clip.name !== 'idle_relaxed' || tr.speed === 0) h.play('idle_relaxed', { fade: 0.3, loop: true });
        }
      }
      b.ball.visible = !!(play && isActive && (state.phase === 'aim' || state.pending));
      h.update(dt);
    }
    return { held: null };
  }

  return {
    load, update,
    get ready() { return ready; }, get bowlers() { return B; },
    setQuality(q) { crowd && crowd.setQuality(q); },
    set dbg(v) { dbg = v; }, get dbg() { return dbg; },
  };
}
