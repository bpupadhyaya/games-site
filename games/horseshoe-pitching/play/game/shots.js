// Scripted store-screenshot driver: plays the real game through its own input (taps, holds, releases) to a named moment.
// `tools/arc shots` loads the page with ?shot=1&seed=<n>&ticks=1; main.js maps the seed to a scene here and runs it once, on the
// first update (after the canvas has its real size). The same function runs headless in the test and in the seed search.
import { STEP } from './kit/loop.js';

// seed -> scene (the seeds were picked so that each scene lands on a good-looking moment; see STATUS.md)
export const SHOT_SCENES = {
  11: { scene: 'title' },
  12: { scene: 'setup' },
  13: { scene: 'aim' },
  14: { scene: 'swing' },
  15: { scene: 'flight' },
  5: { scene: 'ringer' },
  3: { scene: 'inning' },
  16: { scene: 'watch' },
};

// run one scene; returns { ok, note }. `opts.hold` lets the seed search vary the release.
export function driveShot(scene, game, input, opts = {}) {
  const st = game.getState();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.update(STEP, input.snapshot()); };
  const down = (x, y) => { input.inject({ type: 'down', x, y }); step(2); };
  const up = () => { input.inject({ type: 'up' }); step(2); };
  const tap = (x, y) => { down(x, y); up(); };
  const mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const lay = () => game.debug().layout;
  const flow = (id) => game.debug().flow.find((f) => f.id === id);
  const tapFlow = (id) => { const f = flow(id); if (f) tap(...mid(f)); return !!f; };

  step(30);
  if (scene === 'title') { step(420); return { ok: true }; }
  if (scene === 'watch') {
    tapFlow('watch');
    for (let i = 0; i < 1500 && !(st.think && st.think.phase === 'reveal' && st.think.t > 0.8); i++) step();
    return { ok: true };
  }
  tapFlow('play');
  if (scene === 'setup') { step(10); const f = flow('opp2'); if (f) tap(...mid(f)); step(10); return { ok: true }; }
  const opp = opts.opp ?? 1;
  const o = flow('opp' + opp); if (o) tap(...mid(o));
  tap(...mid(lay().pins.start));
  const waitHuman = () => { for (let i = 0; i < 4000 && !(st.scene === 'play' && st.humanTurn && st.m.phase === 'aim'); i++) { if (st.m.phase === 'score') { step(60); tap(5, 5); } step(); if (st.scene !== 'play') return false; } return true; };
  const aimAt = (fx, fv, flip) => {
    const P = lay().play, b = P.board;
    tap(b.x + b.w * (0.5 + fx), b.y + b.h * (0.5 + fv));
    tap(...mid(P.flips[flip]));
  };
  const pitch = (hold, release = true) => { const P = lay().play; down(...mid(P.pitch)); step(hold); if (release) up(); };
  if (!waitHuman()) return { ok: false, note: 'no human turn' };
  if (scene === 'aim') { aimAt(0.05, -0.05, 1); step(40); return { ok: true }; }
  if (scene === 'swing') { aimAt(0.03, -0.04, 1); pitch(66, false); return { ok: true }; }
  if (scene === 'flight') { aimAt(0.0, -0.04, 1); pitch(opts.hold ?? 72); step(26); return { ok: st.anim && st.anim.t < 0.95 }; }
  if (scene === 'ringer') {
    aimAt(0, -0.02, 1); pitch(opts.hold ?? 72);
    for (let i = 0; i < 400 && st.m.phase === 'fly'; i++) step();
    step(12);
    const me = st.shoes.find((s) => s.id === st.m.nextId - 1);
    return { ok: !!(me && me.ringer && st.toastT > 0), note: me ? `${me.x.toFixed(2)},${me.v.toFixed(2)}` : '' };
  }
  if (scene === 'inning') {
    const holds = opts.holds ?? [72, 70, 74, 71];
    for (let n = 0; n < 12 && st.m.phase !== 'score'; n++) {
      if (!waitHuman()) { if (st.m.phase === 'score') break; return { ok: false }; }
      aimAt(0.0, -0.03 + (n % 2) * 0.03, 1); pitch(holds[n % holds.length]);
      for (let i = 0; i < 600 && st.m.phase === 'fly'; i++) step();
      if (st.m.phase === 'score') break;
    }
    step(70);
    const sc = st.m.endInfo ? st.m.endInfo.rec : null;
    return { ok: !!sc && st.m.phase === 'score' && sc.pts >= 3, note: sc ? `pts ${sc.pts}` : '' };
  }
  return { ok: false, note: 'unknown scene' };
}
