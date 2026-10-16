// Real 3D players for Peteca (presentation only: reads the pose description the 2D scene already builds, never writes game state).
//
// The court, the net and the peteca stay in the 2D scene. Each player is rendered by view3d into a small off-screen WebGL canvas (a
// side-on camera that maps 1 m to the scene's pixel scale) and composited with drawImage at the right depth order, so the peteca
// and effects layer correctly over the hand. Without WebGL (or after a context loss, or on a device that cannot keep the frame
// budget) hooks.person3d returns false and figure.js draws its 2D jointed figure instead.
//
// Palm strikes: the sim says where and when (anim.cx / anim.cz, seconds since contact `anim.t`); this layer puts the striking
// palm on exactly that point (solvePalmBall + setReach) so the hand meets the peteca on the sim's contact frame.
const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k); };
const lerp = (a, b, t) => a + (b - a) * t;

const BOX = { w: 3.4, h: 3.5, cx: 0, cy: 1.62 };          // metres of world drawn around a player: x in +-1.7, y in -0.13..3.37
const FAR = 60;                                              // camera distance (near-orthographic)

export async function createPeople(hooks, looks) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; 2D players', e); return null; }
  const { createStage, loadHuman, THREE, solvePalmBall } = V3;
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const host = document.createElement('div');            // off-screen holder: the canvas is only a render target, composited into the 2D scene
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:64px;height:64px;overflow:hidden;pointer-events:none;visibility:hidden';
  host.setAttribute('aria-hidden', 'true'); host.appendChild(canvas); document.body.appendChild(host);
  const stage = createStage({ canvas, quality: 'high', dprCap: 1, lighting: 'day', transparent: true, shadows: false, mode: 'ondemand' });
  if (!stage.supported || !stage.renderer) return null;
  stage.resize = () => stage;                              // sizing is ours (frameFit)
  const R = stage.renderer;
  R.setPixelRatio(1); R.setClearColor(0x000000, 0);
  stage.setLighting('day', { hemiSky: 0xfff4de, hemiGround: 0xd8bd88, hemi: 1.0, key: 0xfff2dc, keyI: 3.2, rim: 0xcfe6ff, rimI: 1.4, exposure: 1.02 });
  stage.scene.background = null; stage.scene.fog = null;
  const cam = stage.camera;
  cam.near = 20; cam.far = 120;
  let lost = false;
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; });

  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const pool = new Map();         // key -> entry
  const loadingKeys = new Set();
  let frameNo = 0, ord = new Map();
  const shot = /[?&]shot=1/.test(globalThis.location ? globalThis.location.search : '');
  let tier = 1;                   // 1 full, 0.7 reduced resolution, 0 -> 2D fallback
  let sizeKey = '';
  let cost = 0, costN = 0;

  async function make(key, look) {
    if (loadingKeys.has(key)) return;
    loadingKeys.add(key);
    try {
      const L = looks[look] || looks[0];
      const h = await loadHuman({ character: L.fem ? 'mannequin_f' : 'mannequin_m', kit: { top: L.shirt, bottoms: L.shorts, socks: '#dfe5ee', shoes: L.shoes }, skin: '#aeb8c6', hair: '#2c323d' });
      h.root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) { if (m && 'metalness' in m) { m.metalness = 0.45; m.roughness = 0.38; m.envMapIntensity = 1.3; } } });
      h.groundClamp = 'auto'; h.footPlanting = true; h.turnRate = 7;
      h.play('idle', { fade: 0 });
      h.setFingers('L', 'relaxed'); h.setFingers('R', 'relaxed');
      stage.scene.add(h.root);
      h.root.visible = false;
      pool.set(key, { h, look, last: null, face: null, reach: 0, sideLast: 'R' });
    } catch (e) { console.warn('player load failed', e); } finally { loadingKeys.delete(key); }
  }
  // preload one of each look so the first play frame already has real people
  const preload = Promise.all(Object.keys(looks).map((k) => make(`${k}#0`, Number(k))));

  function acquire(look) {
    const n = ord.get(look) || 0; ord.set(look, n + 1);
    const key = `${look}#${n}`;
    const e = pool.get(key);
    if (!e) { make(key, look); return null; }
    return e;
  }

  const tmpS = V(), tmpN = V(), tmpF = V(), tmpC = V();
  function pose(e, o, dt) {
    const h = e.h, f = o.f >= 0 ? 1 : -1, an = o.anim;
    const k = an ? an.t : 9;
    const striking = !!(an && k < 0.55 && an.cx !== undefined);
    const sp = Math.abs(o.v || 0), rdy = o.ready || 0;
    const side = f > 0 ? 'R' : 'L';
    if (e.side !== side) { if (e.side) h.setReach(e.side, null); e.side = side; }
    // facing: towards the net; a hard retreat turns the body to run (smooth), a strike always faces the net
    const backing = (o.v || 0) * f < -1.4 && !striking && rdy < 0.6;
    h.setFacing((backing ? -f : f) * Math.PI / 2, { snap: false });
    // visual lunge when the contact is further than the arm reaches
    let lunge = 0;
    if (striking) {
      const dxw = (an.cx - o.wx) * f, over = Math.max(0, dxw - 0.62);
      lunge = clamp(over, 0, 0.5) * (1 - ease(k / 0.45));
    }
    const jump = o.jump || 0;
    h.root.position.set(lunge * f, jump, 0);
    h.groundClamp = jump > 0.02 ? 'off' : 'auto'; h.footPlanting = jump <= 0.02;
    // body clip
    if (jump > 0.02) h.ensure('jump_air', { fade: 0.1 });
    else if (sp > 0.25) h.locomote(sp);
    else if (rdy > 0.2 || striking) h.ensure('ready_stance', { fade: 0.2 });
    else h.locomote(0);
    // eyes follow the peteca
    if (o.ball) h.lookAt({ x: o.ball.x - o.wx + lunge * f * 0, y: o.ball.z, z: 1.5 }, { weight: 0.75, maxYaw: 0.9, maxPitch: 0.6 });
    else h.lookAt(null);

    // hand: the palm goes to the sim's contact point; before it the palm is cocked ready, after it follows through
    h.root.updateMatrixWorld(true);
    const sh = h.bonePosition(`${side}_UpperArm`, tmpS);
    let target = null, w = 0, n = null;
    const up = (a) => (a === 'smash' ? [0.55 * f, -0.8] : a === 'drive' ? [0.85 * f, 0.5] : [0.2 * f, 1]);
    if (striking) {
      const sx = sh.x, sy = sh.y;
      const cx = an.cx - o.wx, cz = an.cz;                  // contact point relative to the person's court position (world axes)
      const c = [cx + 0, cz];
      const wind = [sx - 0.25 * f, sy + 0.12];
      const follow = [sx + 0.5 * f, sy - 0.3];
      let px, py;
      if (k < 0.07) { const t = ease(k / 0.07); px = lerp(wind[0], c[0], t); py = lerp(wind[1], c[1], t); }
      else { const t = ease((k - 0.07) / 0.34); px = lerp(c[0], follow[0], t); py = lerp(c[1], follow[1], t); }
      target = V(px, py, sh.z); n = up(an.shot);
      w = k < 0.41 ? 1 : 1 - ease((k - 0.41) / 0.14);
    } else if (rdy > 0.05) {
      const cock = [sh.x - 0.14 * f, sh.y + 0.06], low = [sh.x + 0.1 * f, sh.y - 0.5];
      const t = ease(rdy);
      target = V(lerp(low[0], cock[0], t), lerp(low[1], cock[1], t), sh.z); n = [0.1 * f, 1];
      w = ease(rdy * 1.4);
    }
    if (target && w > 0.01) {
      tmpN.set(n[0], n[1], 0).normalize(); tmpF.set(f, 0, 0);
      const r = solvePalmBall(h, side, target, tmpN, tmpF, 0.045);
      h.setReach(side, r.wrist, { weight: w, quat: r.quat });
      h.setFingers(side, 'open');
    } else { h.setReach(side, null); h.setFingers(side, 'relaxed'); }
    h.update(dt);
  }

  function frameFit(pxPerM) {
    const w = Math.round(BOX.w * pxPerM), hh = Math.round(BOX.h * pxPerM);
    const key = `${w}x${hh}`;
    if (key !== sizeKey) {
      sizeKey = key;
      R.setSize(w, hh, false);
      cam.aspect = w / hh;
      cam.fov = (2 * Math.atan(BOX.h / 2 / FAR) * 180) / Math.PI;
      cam.position.set(BOX.cx, BOX.cy, FAR); cam.lookAt(BOX.cx, BOX.cy, 0);
      cam.updateProjectionMatrix();
    }
    return [w, hh];
  }

  hooks.beginFrame = () => { frameNo++; ord = new Map(); };
  hooks.person3d = (ctx, o) => {
    if (lost || tier <= 0) return false;
    const e = acquire(o.look);
    if (!e) return false;
    const T = o.t || 0;
    let dt = e.last === null ? 0 : T - e.last; e.last = T;
    if (!(dt > 0)) dt = 0; dt = Math.min(dt, 0.1);
    const t0 = performance.now();
    const m = ctx.getTransform ? ctx.getTransform().a : 1;
    const pxPerM = clamp(o.s * m * tier, 18, 210);
    const [w, hh] = frameFit(pxPerM);
    for (const q of pool.values()) q.h.root.visible = false;
    e.h.root.visible = true;
    pose(e, o, dt);
    R.render(stage.scene, cam);
    // ground shadow (2D, under the feet) then the person
    const s = o.s, f = o.f;
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    const sx = o.x, shw = (0.36 + Math.min(1, Math.abs(o.v || 0) / 4.5) * 0.06) * s * (1 - clamp((o.jump || 0) * 0.8, 0, 0.35));
    const sg = ctx.createRadialGradient(sx, o.gy + 2, 2, sx, o.gy + 2, shw);
    sg.addColorStop(0, 'rgba(30,20,10,0.4)'); sg.addColorStop(1, 'rgba(30,20,10,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(sx, o.gy + 2, shw, shw * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, w, hh, o.x - (BOX.w / 2 - BOX.cx) * s, o.gy - (BOX.cy + BOX.h / 2) * s, BOX.w * s, BOX.h * s);
    ctx.restore();
    void f;
    // frame budget: if a player takes too long, drop resolution once, then fall back to the 2D figures
    cost += performance.now() - t0; costN++;
    if (costN >= 240) {
      const avg = cost / costN; cost = 0; costN = 0;
      if (avg > 4.5) { tier = tier > 0.8 ? 0.7 : 0; }
    }
    return true;
  };
  hooks.ready = preload;
  hooks.frame = () => frameNo;
  hooks.stage = stage;
  hooks.pool = pool;
  return hooks;
}
