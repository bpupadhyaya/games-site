// Candlepin Bowling 3D presenter (game-owned). It ONLY READS the simulation (game.getState()); it never changes it.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The 2D layer keeps all text, input and hit testing; every panel and
// button it draws is recorded in v3 and drawn here as a lit 3D plaque behind the text.
//
// Cameras: the sim already defines two pinhole poses (cam.js) for the pin-deck panel and the lane panel. The 3D cameras are built to
// MATCH them exactly (same eye, target, focal length and principal point), so touch aiming and the 2D hit-testing keep working.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D.
import { THREE } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { LANE } from '../src/sim.js';
import { alley, ALLEYS } from '../src/art.js';
import { buildAlley, makePin, makeBall, PIN_CENTRE, glowTexture, tex, cvs, TAU } from './models.js';
import { createHud } from './hud3d.js';
import { createPeople } from './people.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, spots: 4, crowd: 'medium' },
  { name: 'medium', dpr: 1.5, shadow: 1024, spots: 3, crowd: 'low' },
  { name: 'low', dpr: 1, shadow: 0, spots: 2, crowd: 'low' },
];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function poseFrame(eye, tgt) { const f = nrm(sub(tgt, eye)), r = nrm(crs(f, [0, 0, 1])), u = crs(r, f); return { f, r, u }; }
// a perspective pose (sim coordinates) that puts the sim point `anchor` at the screen point (ax, ay) in virtual units
export function heroPose(eye, tgt, fovDeg, L, anchor, ax, ay) {
  const fr = poseFrame(eye, tgt), k = (L.h / 2) / Math.tan((fovDeg * Math.PI) / 360);
  const d = sub(anchor, eye), zc = dot(d, fr.f);
  const sx = dot(d, fr.r) / zc, sy = -dot(d, fr.u) / zc;
  return { eye, tgt, k, ox: ax - sx * k, oy: ay - sy * k };
}

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const qs = new URLSearchParams(location.search);
  if (qs.has('flat')) return noop;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('keep') }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;
  renderer.setClearColor(0x05070f, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ------------------------------------------------------------ scene, lights
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a1020, 18, 52);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.15, 90);
  const hemi = new THREE.HemisphereLight(0xaec6ff, 0x2a2438, 0.85);
  const key = new THREE.DirectionalLight(0xfff0d8, 1.7); key.position.set(-3, 7, 4);
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0x7fd0ff, 0.7); rim.position.set(4, 3, -6);
  scene.add(hemi, key, key.target, rim);
  const spots = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.SpotLight(0xffe2b0, 60, 16, 0.62, 0.85, 1.6);
    s.position.set(0, 4.3, -(2.5 + i * 5)); s.target.position.set(0, 0, -(2.5 + i * 5) - 0.01);
    scene.add(s, s.target); spots.push(s);
  }
  const neonL = new THREE.PointLight(0x37e0d4, 7, 14, 1.6), neonR = new THREE.PointLight(0xff4fa3, 7, 14, 1.6);
  scene.add(neonL, neonR);

  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost */ } }
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture;
    scene.environmentIntensity = 0.38;
    pm.dispose();
    hud.setEnv(scene.environment);
  }

  // ------------------------------------------------------------ the alley (rebuilt when the player picks another one)
  let alleyId = null, built = null, scoreKey = '';
  function ensureAlley() {
    const cur = alley();
    const id = Object.keys(ALLEYS).find((k) => ALLEYS[k] === cur) || 'harbor';
    if (id === alleyId && built) return;
    if (built) scene.remove(built.root);
    built = buildAlley(id, TIERS[tier].name); alleyId = id;
    scene.add(built.root);
    const A = built.A;
    scene.fog.color.set(A.wall[1]); renderer.setClearColor(new THREE.Color(A.wall[1]).multiplyScalar(0.45), 1);
    neonL.color.set(A.glow); neonR.color.set(A.sign);
    neonL.position.set(-3.6, 2.1, -6); neonR.position.set(3.6, 2.1, -13);
    hemi.color.set(new THREE.Color(A.glow).lerp(new THREE.Color(0x9db8ff), 0.6)); hemi.groundColor.set(A.carpet[1]);
    scoreKey = '';
  }

  // ------------------------------------------------------------ pieces
  const pinGroup = new THREE.Group(); scene.add(pinGroup);
  const pins = [];
  for (let i = 0; i < 10; i++) { const p = makePin(); pinGroup.add(p.root, p.shadow); pins.push({ ...p, s: 0, fallT: 0, head: 1, drop: 1, wob: 0, wobPh: 0 }); }
  const ball = makeBall(); scene.add(ball.root, ball.shadow);
  const ghost = makeBall(); ghost.mesh.material = ball.mesh.material; scene.add(ghost.root, ghost.shadow); ghost.root.visible = false;
  const dotGeo = new THREE.CircleGeometry(0.016, 14); dotGeo.rotateX(-Math.PI / 2);
  const dotsA = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 72);
  const dotsH = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffd65a, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 72);
  dotsA.frustumCulled = dotsH.frustumCulled = false; dotsA.renderOrder = dotsH.renderOrder = 3;
  scene.add(dotsA, dotsH);
  const targetTex = tex(cvs(256, 256, (g, w) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 9; g.shadowColor = '#ffffff'; g.shadowBlur = 16;
    g.beginPath(); g.ellipse(w / 2, w / 2, w * 0.28, w * 0.28, 0, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(w * 0.1, w / 2); g.lineTo(w * 0.9, w / 2); g.moveTo(w / 2, w * 0.18); g.lineTo(w / 2, w * 0.82); g.stroke();
  }), {});
  const target = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: targetTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  target.rotation.x = -Math.PI / 2; target.renderOrder = 4; target.visible = false; scene.add(target);
  const MAXP = 90;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
  const pMat = new THREE.PointsMaterial({ size: 0.05, map: glowTexture('rgba(255,255,255,1)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false });
  const points = new THREE.Points(pGeo, pMat); points.frustumCulled = false; scene.add(points);

  // ------------------------------------------------------------ people (bowlers, spectators): loaded lazily, never block play
  const people = createPeople({ THREE, scene, camera, quality: () => TIERS[tier].crowd, ballMaterial: ball.mesh.material });
  people.load().catch((e) => console.warn('people unavailable', e));

  // ------------------------------------------------------------ HUD (plaques, buttons, shades)
  const hud = createHud({ THREE, renderer });

  // ------------------------------------------------------------ frame helpers
  let W = 1, H = 1, dprNow = 1;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  // the projection of a sim pose over the WHOLE canvas (virtual units L.w x L.h); a scissor then selects the panel
  function setPose(pose, L) {
    camera.position.set(pose.eye[0], pose.eye[2], -pose.eye[1]);
    camera.lookAt(pose.tgt[0], pose.tgt[2], -pose.tgt[1]);
    camera.updateMatrixWorld(true);
    const n = 0.15, f = 90, Wv = L.w, Hv = L.h, k = pose.k;
    camera.projectionMatrix.set(
      (2 * k) / Wv, 0, -(2 * pose.ox / Wv - 1), 0,
      0, (2 * k) / Hv, -(1 - 2 * pose.oy / Hv), 0,
      0, 0, -(f + n) / (f - n), -(2 * f * n) / (f - n),
      0, 0, -1, 0,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  const scissor = (r, L) => {
    const s = W / L.w;
    renderer.setScissorTest(true);
    renderer.setScissor(Math.floor(r.x * s), Math.floor(H - (r.y + r.h) * s), Math.ceil(r.w * s), Math.ceil(r.h * s));
  };

  // ------------------------------------------------------------ the lane: pins, ball, aim marks
  let lastWorld = null, clock = 0, fresh = false;
  const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const seenParts = new WeakSet();
  function poseLane(world, parts, dt, sweepAlpha) {
    if (world !== lastWorld) { lastWorld = world; fresh = true; }
    if (parts) for (const q of parts) {
      if (seenParts.has(q)) continue;
      seenParts.add(q);
      for (let i = 0; i < world.pins.length; i++) {
        const p = world.pins[i];
        if (p.s !== 0) continue;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < 0.22) { pins[i].wob = Math.min(1, pins[i].wob + (0.22 - d) * 3.2); pins[i].wobPh = Math.atan2(p.y - q.y, p.x - q.x); }
      }
    }
    for (let i = 0; i < 10; i++) {
      const p = world.pins[i], v = pins[i], g = v.root;
      if (!p || p.s === 2) { g.visible = false; v.shadow.visible = false; v.s = 2; continue; }
      const alpha = sweepAlpha ? sweepAlpha(p) : 1;
      if (alpha <= 0.02) { g.visible = false; v.shadow.visible = false; continue; }
      g.visible = true; v.shadow.visible = true;
      const yy = p.y + (1 - alpha) * 1.5, sink = (1 - alpha) * -0.3;
      if (p.s === 0) {
        if (v.s !== 0 || fresh) { v.drop = fresh ? 0 : 1; }
        v.s = 0;
        if (v.drop < 1) v.drop = Math.min(1, v.drop + dt / 0.4);
        const dd = 1 - smooth(v.drop), bounce = v.drop >= 1 ? 0 : Math.sin(v.drop * Math.PI * 2.4) * 0.012 * (1 - v.drop);
        v.wob = Math.max(0, v.wob - dt * 1.6);
        const w = Math.sin(clock * 38 + v.wobPh) * v.wob * v.wob * 0.13;
        g.position.set(p.x, PIN_CENTRE + dd * 0.5 + bounce + sink, -yy);
        g.quaternion.setFromAxisAngle(tmpV.set(Math.sin(v.wobPh), 0, Math.cos(v.wobPh)).normalize(), w);
        v.shadow.position.set(p.x, 0.003, -yy); v.shadow.material.opacity = 0.6 * (1 - dd * 0.7); v.shadow.scale.setScalar(1);
      } else {
        // a pin that has been hit: it tips over the way it travels, then lies as dead wood
        if (v.s !== 1) { v.s = 1; v.fallT = 0; const sp = Math.hypot(p.vx, p.vy); v.head = sp > 0.05 ? (Math.sign(Math.cos(p.a) * p.vx + Math.sin(p.a) * p.vy) || 1) : (i % 2 ? 1 : -1); }
        v.fallT += dt;
        const ease = smooth(v.fallT / 0.26);
        tmpV.set(Math.cos(p.a) * v.head, 0, -Math.sin(p.a) * v.head).normalize();
        tmpQ.setFromUnitVectors(UP, tmpV);
        let lean = 0, lift = 0;
        if (Math.abs(p.x) > LANE.deckHalf - 0.085 && p.y > LANE.deckStart) { lean = 0.22 * Math.sign(p.x); lift = 0.026; }
        else for (const o of world.pins) if (o !== p && o.s === 1 && Math.hypot(o.x - p.x, o.y - p.y) < 0.075) { lean = 0.16; lift = 0.022; break; }
        tmpQ2.identity().slerp(tmpQ, ease);
        g.quaternion.copy(tmpQ2);
        if (lean && ease >= 1) g.quaternion.premultiply(tmpQ.setFromAxisAngle(tmpV2.set(tmpV.x, 0, tmpV.z), lean));
        const rest = LANE.woodR + 0.005 + lift;
        g.position.set(p.x, PIN_CENTRE + (rest - PIN_CENTRE) * ease + sink, -yy);
        v.shadow.position.set(p.x, 0.003, -yy); v.shadow.material.opacity = 0.55 * (0.4 + 0.6 * ease); v.shadow.scale.setScalar(1 + 0.8 * ease);
      }
      g.scale.setScalar(alpha < 0.25 ? alpha / 0.25 : 1);
    }
    fresh = false;
  }
  function poseBall(world, held) {
    const b = world.ball;
    ghost.root.visible = false; ghost.shadow.visible = false;
    if (b && !b.gone) {
      ball.root.visible = true; ball.shadow.visible = true;
      ball.root.position.set(b.x, b.r, -b.y);
      const sp = Math.hypot(b.vx, b.vy) || 1;
      tmpV.set(-b.vy / sp, 0, -b.vx / sp);
      ball.mesh.quaternion.setFromAxisAngle(tmpV, b.rot);
      ball.shadow.position.set(b.x, 0.003, -b.y);
    } else { ball.root.visible = false; ball.shadow.visible = false; }
    if (held) {
      ghost.root.visible = true; ghost.root.position.copy(held.pos); ghost.mesh.quaternion.copy(held.quat || tmpQ.identity());
      ghost.shadow.visible = !!held.shadow; ghost.shadow.position.set(held.pos.x, 0.003, held.pos.z);
    }
  }
  const m4 = new THREE.Matrix4();
  function poseAim(state, show) {
    const set = (inst, pts) => {
      let n = 0;
      if (pts) for (const q of pts) { if (n >= 72) break; m4.makeTranslation(q[0], 0.006, -q[1]); inst.setMatrixAt(n++, m4); }
      inst.count = n; inst.instanceMatrix.needsUpdate = true; inst.visible = n > 0;
    };
    if (!show) { dotsA.visible = dotsH.visible = target.visible = false; return; }
    set(dotsA, state.guide ? state.guide.pts : null);
    dotsA.material.color.set(state.guide?.gutter ? 0xff6e5a : 0xffffff);
    set(dotsH, state.hintGuide ? state.hintGuide.pts : null);
    target.visible = !!(state.guide || state.hintGuide);
    target.position.set(state.aimX ?? 0, 0.007, -LANE.headY);
    target.material.color.set(state.hintGuide ? 0xffd65a : 0xffffff);
  }
  function poseParts(parts) {
    const pos = pGeo.attributes.position.array, col = pGeo.attributes.color.array;
    let n = 0;
    if (parts) for (const q of parts) {
      if (n >= MAXP) break;
      const a = Math.max(0, 1 - q.t / q.max), c = q.kind === 1 ? [1.0, 0.82, 0.45] : [0.75, 0.66, 0.52];
      pos[n * 3] = q.x; pos[n * 3 + 1] = q.z + 0.02; pos[n * 3 + 2] = -q.y;
      col[n * 3] = c[0] * a * 0.9; col[n * 3 + 1] = c[1] * a * 0.9; col[n * 3 + 2] = c[2] * a * 0.9;
      n++;
    }
    for (let i = n; i < MAXP; i++) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; pos[i * 3 + 1] = -5; }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  }

  // ------------------------------------------------------------ overhead scoreboard (canvas)
  function drawScoreboard(state) {
    if (!built) return;
    const m = state.scene === 'play' ? state.m : null;
    const names = [state.labels?.[0]?.name ?? 'You', state.labels?.[1]?.name ?? ''];
    const k2 = m ? `${names.join('|')}|${JSON.stringify(m.rolls)}|${m.frame}|${m.turn}` : 'idle';
    if (k2 === scoreKey) return;
    scoreKey = k2;
    const c = built.scoreCanvas, g = c.getContext('2d'), w = c.width, h = c.height;
    g.fillStyle = '#05070c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = built.A.glow; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.textBaseline = 'middle';
    if (m) {
      for (let i = 0; i < Math.min(2, m.n); i++) {
        const y = 72 + i * 100, act = m.turn === i && !m.over, tot = (m.rolls[i] || []).reduce((a, b) => a + b, 0);
        g.font = '800 70px "Avenir Next","Trebuchet MS",system-ui,sans-serif';
        g.fillStyle = act ? '#ffd35a' : '#8fd8d0'; g.textAlign = 'left'; g.fillText(String(names[i] || '').slice(0, 11).toUpperCase(), 40, y);
        g.textAlign = 'right'; g.fillText(String(tot), w - 40, y);
      }
    } else {
      g.fillStyle = '#ffd35a'; g.textAlign = 'center'; g.font = '900 100px "Didot","Bodoni 72",Georgia,serif'; g.fillText('CANDLEPIN', w / 2, h / 2 + 4);
    }
    built.scoreTex.needsUpdate = true;
  }

  // ------------------------------------------------------------ one frame
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    spots.forEach((s, i) => { s.visible = i < t.spots; });
    people.setQuality?.(t.crowd);
    W = 0;
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
  }
  const sweepFn = (state) => (state.sweep ? (p) => ((state.sweep.then === 'rack' ? p.s !== 2 : p.s === 1) ? Math.max(0, 1 - state.sweep.t / 0.7) : 1) : null);
  let frames = 0, slowFrames = 0, ema = 16, lastNow = performance.now(), force = null;

  // camera for the title, menus and reading screens: low behind the pin deck, drifting a little
  function heroFor(state, L) {
    const drift = Math.sin(clock * 0.18) * 0.16;
    const title = state.scene === 'title';
    const ax = L.wide ? (title ? L.w * 0.27 : L.w * 0.5) : L.w * 0.5;
    const ay = title ? (L.wide ? L.h * 0.64 : L.h * 0.37) : (L.wide ? L.h * 0.55 : L.h * 0.3);
    const eye = [0.62 + drift, LANE.headY - (L.wide ? 5.4 : 3.7), L.wide ? 0.62 : 0.5], tgt = [-0.02, LANE.headY + 0.2, 0.2];
    return heroPose(eye, tgt, L.wide ? 40 : 40, L, [0, LANE.headY + 0.25, 0.1], ax, ay);
  }

  function frame(state, L, dt) {
    resize();
    ensureAlley();
    const play = state.scene === 'play';
    const world = play ? state.w : state.att.w, parts = play ? state.parts : state.att.parts;
    const sdt = play && state.paused ? 0 : dt;
    clock += sdt;
    poseLane(world, parts, sdt, play ? sweepFn(state) : null);
    const who = people.update(state, L, sdt, world, play);
    poseBall(world, who && who.held);
    poseAim(state, play && state.phase === 'aim' && (state.humanTurn || !!state.hint));
    poseParts(parts);
    drawScoreboard(state);
    built.sign.visible = built.glow.visible = play;      // the marquee would fight the title lettering on the menus
    renderer.setViewport(0, 0, W, H);
    renderer.setScissorTest(false);
    renderer.clear(true, true, true);
    const views = [];
    if (force) {
      const f = force;
      views.push({ rect: { x: 0, y: 0, w: L.w, h: L.h }, pose: heroPose(f.eye, f.tgt, f.fov ?? 40, L, f.tgt, L.w / 2, L.h / 2), sh: f.sh || { cx: f.tgt[0], cy: f.tgt[1], ext: 3 } });
    } else if (play) {
      const P = L.play;
      views.push({ rect: P.deckPanel, pose: L.poses.deck, sh: { cx: 0, cy: LANE.headY + 0.35, ext: 1.9 } });
      views.push({ rect: P.lanePanel, pose: L.poses.lane, sh: { cx: 0, cy: 1.2, ext: 4.2 } });
    } else {
      views.push({ rect: { x: 0, y: 0, w: L.w, h: L.h }, pose: heroFor(state, L), sh: { cx: 0, cy: LANE.headY, ext: 2.4 } });
    }
    for (const v of views) {
      setPose(v.pose, L);
      scissor(v.rect, L);
      key.position.set(v.sh.cx - 2.2, 4.5, -v.sh.cy + 2.0);
      key.target.position.set(v.sh.cx, 0, -v.sh.cy); key.target.updateMatrixWorld();
      const e = v.sh.ext;
      Object.assign(key.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 0.5, far: 18 }); key.shadow.camera.updateProjectionMatrix();
      renderer.clearDepth();
      renderer.render(scene, camera);
    }
    renderer.setScissorTest(false);
    renderer.clearDepth();
    if (!force) hud.render(L, W, H, v3, dt);
  }

  // ------------------------------------------------------------ context loss
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch { /* still playable without reflections */ }
    W = 0; resize(); scoreKey = ''; v3.on = true;
  });

  fetch(new URL('../vendor3d/LICENSES.md', import.meta.url)).then((r) => (r.ok ? r.text() : '')).then((t) => {
    const paras = t.split(/\n\s*\n/).map((x) => x.replace(/[#*`>|_]/g, '').replace(/\s+/g, ' ').trim()).filter((x) => x.length > 12).slice(0, 14);
    if (paras.length) v3.credits = { title: '3D credits and licences', p: paras };
  }).catch(() => {});
  try { buildEnvMap(); applyTier(); ensureAlley(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  const api = {
    ok: true, renderer, scene, camera, people, pins, ball, hud, THREE,
    get tier() { return tier; },
    force(f) { force = f; kitCanvas.style.visibility = f && !f.ui ? 'hidden' : 'visible'; },
    setTier(t) { tier = clamp(t, 0, TIERS.length - 1); applyTier(); },
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer;
          hud.setPressed(p && p.down ? { x: p.x, y: p.y } : null);
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1280);
          const now = performance.now(), raw = Math.max(0, (now - lastNow) / 1000), dt = Math.min(0.1, raw); lastNow = now;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          // Software-GL / very slow devices: a frame of 0.3 s or more starves the main thread (rotations get missed). Two of them -> lowest tier now.
          if (raw > 0.3 && frames > 1 && tier < TIERS.length - 1 && ++slowFrames >= 2) { tier = TIERS.length - 1; applyTier(); frames = 0; ema = 16; slowFrames = 0; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.shades.length = 0; v3.seq = 0; v3.hero = null; v3.clip = null; v3.scene = state.scene;
          try { game.render(ctx, view); } catch (e) { console.warn('2D render failed', e); }
          try { frame(state, L, dt); } catch (e) { console.warn('3D frame failed', e); v3.on = false; }
        },
      });
    },
  };
  if (qs.has('dev')) { window.__p3 = api; window.__v3 = v3; }
  return api;
}
