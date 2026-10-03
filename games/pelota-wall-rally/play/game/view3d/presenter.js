// 3D presenter: READS the simulation (game.getState().sim) and draws the fronton, the ball and two or four mannequin players.
// It never writes back. Contact discipline: the sim owns where and when the ball is struck; the pose layer (skills.js + actor.js) makes the
// palm (or paddle face) meet the ball at exactly that moment, and the ball only ever follows the sim.
import { Actor } from './actor.js';
import { strokeDef, evalSwing, stanceFeet, SWING_SPAN } from './skills.js';
import { buildCourt, buildBall, buildPaddle } from './court.js';

const LIB = '../vendor3d/index.js';
const SKINS = ['peach', 'brown', 'tan', 'clay'];
const HAIRS = ['brown', 'black', 'black', 'blond'];
const KITS = [
  [{ top: '#d8352c', bottoms: '#f6f3ec', socks: '#f6f3ec' }, { top: '#e0572f', bottoms: '#f6f3ec', socks: '#f6f3ec' }],
  [{ top: '#1f66bd', bottoms: '#f6f3ec', socks: '#f6f3ec' }, { top: '#2d86c7', bottoms: '#f6f3ec', socks: '#f6f3ec' }],
];

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', mode: 'continuous' });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.fov = 48; stage.camera.near = 0.3; stage.camera.far = 90; stage.camera.updateProjectionMatrix();

  const P = { stage, THREE, humans: [], actors: [], ball: null, court: null, ready: false, lost: false, simRef: null, pillar: 0, fx: [], seenEv: 0, lastT: null };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });

  // ---------------------------------------------------------------- scene
  stage.setLighting('indoor', { exposure: 0.8, hemi: 0.75, keyI: 2.4 });
  stage.setSky('#1b242c', '#1b242c', { near: 28, far: 80 });
  P.court = buildCourt(stage);
  const blobs = stage.enableBlobShadows(8, { radius: 0.42, opacity: 0.8 });       // every soft shadow (players and ball) in one draw call
  const cueRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  cueRing.rotation.x = -Math.PI / 2; cueRing.position.y = 0.02; cueRing.visible = false; stage.add(cueRing);

  // effect pool: puffs (soft discs) and chalk marks, positioned on the surface that was struck (no wall or camera shake)
  const fxTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  // every puff and chalk mark is a quad of ONE merged mesh (one draw call however many are alive); per-vertex colour carries the tint and the fade
  const FXN = 12;
  const fxGeo = new THREE.BufferGeometry();
  const fxPos = new Float32Array(FXN * 12), fxCol = new Float32Array(FXN * 16), fxUv = new Float32Array(FXN * 8), fxIdx = [];
  for (let i = 0; i < FXN; i++) { fxUv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); fxIdx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3); }
  fxGeo.setAttribute('position', new THREE.BufferAttribute(fxPos, 3)); fxGeo.setAttribute('color', new THREE.BufferAttribute(fxCol, 4)); fxGeo.setAttribute('uv', new THREE.BufferAttribute(fxUv, 2)); fxGeo.setIndex(fxIdx);
  const fxMesh = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: fxTex, transparent: true, depthWrite: false, vertexColors: true }));
  fxMesh.frustumCulled = false; fxMesh.renderOrder = 2; fxMesh.visible = false; stage.add(fxMesh);
  for (let i = 0; i < FXN; i++) P.fx.push({ i, on: false, t0: -9, dur: 0.4, kind: 'puff', size: 0.4, pos: new THREE.Vector3(), q: new THREE.Quaternion(), rgb: [1, 1, 1] });
  let fxNext = 0;
  const _e = new THREE.Euler(), _v = new THREE.Vector3(), CORNERS = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  function fxWrite(f, scale, alpha) {
    for (let c = 0; c < 4; c++) {
      _v.set(CORNERS[c][0] * scale, CORNERS[c][1] * scale, 0).applyQuaternion(f.q).add(f.pos);
      fxPos.set([_v.x, _v.y, _v.z], (f.i * 4 + c) * 3); fxCol.set([f.rgb[0], f.rgb[1], f.rgb[2], alpha], (f.i * 4 + c) * 4);
    }
  }
  function spawnFx(kind, e, tNow) {
    const f = P.fx[fxNext++ % FXN];
    const sp = Math.min(1.6, 0.5 + (e.speed || 0) * 0.05);
    f.t0 = tNow; f.kind = kind; f.on = true;
    f.rgb = kind === 'tin' ? [0.75, 0.91, 1] : kind === 'mark' ? [0.91, 0.88, 0.77] : [1, 1, 1];
    if (e.kind === 'floor') { f.pos.set(e.x, 0.025, e.z); _e.set(-Math.PI / 2, 0, 0); }
    else if (e.kind === 'front' || e.kind === 'tin' || e.kind === 'high') { f.pos.set(e.x, e.y, 10.485); _e.set(0, Math.PI, 0); }
    else if (e.kind === 'left') { f.pos.set(2.585, e.y, e.z); _e.set(0, -Math.PI / 2, 0); }
    else if (e.kind === 'back') { f.pos.set(e.x, e.y, 0.02); _e.set(0, 0, 0); }
    else { f.pos.set(e.x, e.y, e.z); _e.set(0, 0, 0); }
    f.q.setFromEuler(_e);
    f.size = kind === 'mark' ? 0.34 : 0.5 * sp; f.dur = kind === 'mark' ? 2.2 : kind === 'tin' ? 0.3 : 0.45;
    fxWrite(f, f.size * 0.3, 0);
    fxGeo.attributes.position.needsUpdate = fxGeo.attributes.color.needsUpdate = true;
  }
  function updateFx(tNow) {
    let any = false;
    for (const f of P.fx) {
      if (!f.on) continue;
      const u = (tNow - f.t0) / f.dur;
      if (u >= 1) { f.on = false; fxWrite(f, 0, 0); continue; }
      any = true;
      if (u < 0) continue;
      if (f.kind === 'mark') fxWrite(f, f.size, 0.35 * (1 - u) * Math.min(1, u * 12));
      else { const k = 0.3 + 0.9 * Math.sqrt(u); fxWrite(f, f.size * k, 0.7 * (1 - u)); }
    }
    fxMesh.visible = any;
    if (any || fxGeo.attributes.position.version >= 0) { fxGeo.attributes.position.needsUpdate = true; fxGeo.attributes.color.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- humans
  async function build() {
    P.ready = false;
    for (const h of P.humans) stage.remove(h);
    P.humans = []; P.actors = [];
    for (let i = 0; i < 4; i++) {
      const team = i < 2 ? 0 : 1;
      const h = await loadHuman({ character: 'mannequin_m', kit: KITS[team][i & 1], skin: SKINS[i], hair: HAIRS[i], legs: 'shorts' });
      h.groundClamp = 'auto'; h.footPlanting = true;
      h.play('ready_stance', { fade: 0 });
      h.setPosition(0, 0, 0);
      stage.add(h); stage.track(h);
      const act = new Actor(h);
      const palm = {};
      for (const s of ['L', 'R']) { const fr = h.fingers[s]; palm[s] = { c: fr.knuckle.clone().multiplyScalar(0.55).addScaledVector(fr.palmDir, 0.012), n: fr.palmDir.clone(), f: fr.fingerDir.clone() }; }
      P.humans.push(h);
      P.actors.push({ a: act, h, palm, yaw: 0, px: 0, pz: 0, state: 'idle', phase: i * 1.7 + 0.4, seedA: ((i * 37 + 11) % 17) / 17, seedB: ((i * 53 + 5) % 13) / 13, swingId: -1, def: null, feet: null, paddle: null, vis: false, lefty: false });
    }
    P.ready = true;
    stage.invalidate();
  }
  P.ready_p = build();

  // equipment / handedness / visibility for a new match (the sim object changed)
  function configure(sim) {
    const s = sim.s;
    P.simRef = sim;
    P.ballKind = s.equip === 'paddle' ? 'yellow' : 'cream';
    if (P.ball) stage.remove(P.ball);
    P.ball = buildBall(P.ballKind); stage.add(P.ball);
    P.actors.forEach((pa, i) => {
      const sp = s.players[i];
      pa.vis = !!sp;
      pa.h.root.visible = !!sp;
      pa.h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = !!sp && !!(sp.human || sp.isUser) && quality !== 'low'; });
      if (pa.paddle) { pa.h.detach(pa.paddle); pa.paddle = null; }
      pa.swingId = -1; pa.def = null; pa.state = 'x';
      if (sp) {
        pa.lefty = !!sp.lefty;
        const kit = KITS[sp.team][i & 1];
        pa.h.setKit({ top: kit.top, bottoms: kit.bottoms, socks: kit.socks });
        if (s.equip === 'paddle') {
          pa.paddle = buildPaddle();
          const side = pa.lefty ? 'L' : 'R';
          const fr = pa.h.fingers[side];
          const palmC = fr.knuckle.clone().multiplyScalar(0.55).addScaledVector(fr.palmDir, 0.012);
          // handle along the fingers, blade face on the palm side
          const f = fr.fingerDir.clone().normalize(), n = fr.palmDir.clone().normalize();
          const z = n.clone(), y = f.clone().sub(z.clone().multiplyScalar(f.dot(z))).normalize(), x = y.clone().cross(z);
          const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
          const pos = palmC.clone().addScaledVector(f, -0.07);
          pa.h.attach(pa.paddle, side, { pos: [pos.x, pos.y, pos.z], quat: [q.x, q.y, q.z, q.w], pose: 'batGrip' });
        }
      }
    });
    P.seenEv = s.eid;
    P.lastT = null;
    stage.invalidate();
  }
  P.configure = configure;

  // adaptive quality: if frames run long, first drop shadows, then lower the pixel ratio
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 2) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false; else stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        stage.invalidate();
      }
    }
  }

  // ---------------------------------------------------------------- the frame
  const lerp = (a, b, t) => a + (b - a) * t;
  // the ball's position at display time tr, along the sub-step samples of the last tick (corners at impacts stay exact)
  function ballAt(s, tr) {
    const tt = s.trail;
    if (!tt || tt.length === 0) return { x: s.ball.x, y: s.ball.y, z: s.ball.z };
    if (tr >= tt[tt.length - 1].t) return tt[tt.length - 1];
    if (tr <= tt[0].t) return tt[0];
    for (let i = 1; i < tt.length; i++) if (tr <= tt[i].t) { const a = tt[i - 1], b = tt[i], u = (tr - a.t) / Math.max(1e-9, b.t - a.t); return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) }; }
    return tt[tt.length - 1];
  }

  function swingPoseAt(pa, sp, sw, tr, dt, ballPos) {
    const m = sp.lefty ? -1 : 1;
    const ck = `${sw.cp.x.toFixed(4)},${sw.cp.y.toFixed(4)},${sw.cp.z.toFixed(4)}`;   // the stroke follows the sim's contact point even if it is re-planned
    if (pa.swingId !== sw.id || pa.swingKey !== ck) {
      pa.swingId = sw.id; pa.swingKey = ck;
      pa.def = strokeDef(sw, m, P.simRef.s.equip);
      pa.feet = stanceFeet(sw.S, sw.faceYaw ?? 0, m, sw.back);
    }
    const t = tr - sw.tc;
    if (t < SWING_SPAN[0] || t > SWING_SPAN[1]) return false;
    const pelvisBase = pa.a.b.pelvis.getWorldPosition(V());
    const ctx = { x: pa.px, z: pa.pz, pelvisBase, H0: pa.a.pelvisRest.y, yaw: pa.yaw, feet: pa.feet, look: ballPos, palm: pa.palm };
    const pose = evalSwing(pa.def, ctx, t, pa.a);
    if (!pose) return false;
    pa.a.apply(pose, dt);
    return true;
  }
  P.swingPoseAt = swingPoseAt;
  // palm contact point of a player's hitting hand (world), for the dev verification scripts
  P.palmPoint = (i, side) => { const pa = P.actors[i], h = pa.h; h.root.updateMatrixWorld(true); const bone = h.bones[`Bip01_${side}_Hand`]; return pa.palm[side].c.clone().applyMatrix4(bone.matrixWorld); };

  function idleLayer(pa, t) {
    const b = pa.a.b, ph = pa.phase;
    const br = Math.sin(t * 2 * Math.PI * 0.27 + ph) * 0.012;
    const sway = Math.sin(t * 2 * Math.PI * 0.09 + ph * 1.7);
    const tw = (bone, x, y, z) => { bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z))); };
    tw(b.spine1, br, 0, sway * 0.014);
    tw(b.spine2, br * 0.7, sway * 0.02, 0);
    b.pelvis.position.x += sway * 0.008;
    tw(b.R.up, 0, 0, (pa.seedA - 0.5) * 0.12);
    tw(b.L.up, 0, 0, -(pa.seedB - 0.5) * 0.1);
    pa.h.root.updateMatrixWorld(true);
  }

  function frame(game) {
    if (!P.ready || P.lost) return;
    const G0 = game.getState();
    const sim = G0.sim;
    if (!sim || !sim.s) { stage.setVisible(false); return; }
    const s = sim.s;
    if (P.simRef !== sim || P.ballKind !== (s.equip === 'paddle' ? 'yellow' : 'cream')) configure(sim);
    stage.setVisible(true);
    const alpha = G0.alpha === undefined ? 1 : G0.alpha;
    const pv = s.prev || { t: s.t, players: s.players };
    const tr = pv.t + (s.t - pv.t) * alpha;
    let dt = P.lastT === null ? 0 : tr - P.lastT;
    if (dt < 0) dt = 0;
    P.lastT = tr;
    dt = Math.min(dt, 0.1);
    const bp = ballAt(s, tr);
    const bv = V(bp.x, bp.y, bp.z);
    // ---- players
    for (let i = 0; i < s.players.length; i++) {
      const sp = s.players[i], pa = P.actors[i], H = pa.h;
      const q0 = pv.players[i] || sp;
      pa.px = lerp(q0.x, sp.x, alpha); pa.pz = lerp(q0.z, sp.z, alpha);
      let df = sp.face - (q0.face ?? sp.face); df = Math.atan2(Math.sin(df), Math.cos(df));
      pa.yaw = (q0.face ?? sp.face) + df * alpha;
      H.root.position.set(pa.px, 0, pa.pz);
      H.setFacing(pa.yaw);
      const speed = Math.hypot(sp.vx, sp.vz);
      const after = s.phase === 'dead' && s.last && s.t - s.last.t > 0.4;
      const winner = after && s.last.winner === sp.team;
      const want = speed >= 0.4 ? 'run' : after ? (winner ? 'cheer' : 'calm') : 'idle';
      if (want === 'run') { pa.state = 'run'; H.locomote(speed); }
      else if (pa.state !== want) { H.crossfade(want === 'cheer' ? 'celebrate_2' : want === 'calm' ? 'idle_relaxed' : 'ready_stance', 0.3); pa.state = want; }
      H.lookAt(s.ball.vis ? bv : null, { weight: 0.75, maxYaw: 1.2, maxPitch: 0.6 });
      H.update(dt);
      if (want !== 'run') idleLayer(pa, tr);
      const sw = sp.swing;
      let swinging = false;
      if (sw) swinging = swingPoseAt(pa, sp, sw, tr, dt, bv);
      if (!pa.paddle) H.setFingers(pa.lefty ? 'L' : 'R', swinging ? 'flat' : 'relaxed');
    }
    // ---- ball
    const bm = P.ball;
    const held = s.ball.held;
    if (held && s.ball.vis && s.serve) {
      const sv = s.players[s.serve.server];
      const hand = P.actors[sv.id].h.bonePosition(sv.lefty ? 'L_Hand' : 'R_Hand');
      bm.position.set(hand.x, hand.y - 0.02, hand.z + 0.05); bm.visible = true;
    } else { bm.position.set(bp.x, bp.y, bp.z); bm.visible = !!s.ball.vis; }
    bm.quaternion.set(s.ball.rot[0], s.ball.rot[1], s.ball.rot[2], s.ball.rot[3]);
    let nb = 0;
    for (let i = 0; i < s.players.length; i++) blobs.set(nb++, P.actors[i].px, P.actors[i].pz, 0.42, 0.012);
    if (bm.visible) { const r = 0.2 + 0.016 * Math.min(Math.max(0, bm.position.y), 5); blobs.set(nb++, bm.position.x, bm.position.z, r, 0.013); }
    blobs.mesh.count = nb;
    // ---- events: puffs and marks at their time
    for (const e of s.events) {
      if (e.id < P.seenEv) continue;
      if (e.t > tr + 1e-6) break;
      P.seenEv = e.id + 1;
      if (e.type === 'wall') {
        if (e.speed > 2.5 && e.kind !== 'out') spawnFx(e.kind === 'tin' ? 'tin' : 'puff', e, tr);
        if ((e.kind === 'front' || e.kind === 'left' || e.kind === 'back') && e.speed > 5) spawnFx('mark', e, tr);
      }
    }
    updateFx(tr);
    // ---- the cue ring on the floor (where the ideal contact will be), for the human
    const cue = s.cue;
    if (cue && cue.cp && cue.claim && G0.scene === 'play' && G0.mode !== 'watch') {
      cueRing.visible = true; cueRing.position.set(cue.cp.x, 0.025, cue.cp.z);
      const pulse = 1 + 0.08 * Math.sin(tr * 9);
      cueRing.scale.set(pulse, pulse, pulse);
    } else cueRing.visible = false;
    // ---- camera. On screens wider than 9:16 the 3D picture is pillarboxed to the same rectangle as the HUD so both agree.
    const winW = kitCanvas.clientWidth || 720, winH = kitCanvas.clientHeight || 1280;
    const wantW = winW / winH > 0.5625 ? Math.round(winH * 0.5625) : 0;
    if (wantW !== P.pillar) {
      P.pillar = wantW;
      canvas.style.cssText = wantW ? `position:fixed;top:0;left:50%;transform:translateX(-50%);width:${wantW}px;height:100dvh;display:block;pointer-events:none;z-index:0` : 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
      stage.resize();
    }
    const cam = stage.camera, c = s.cam;
    const W = canvas.clientWidth || 720, H_ = canvas.clientHeight || 1280;
    const aspect = W / H_;
    const th = Math.tan((48 * Math.PI) / 360) * Math.max(1, 0.5625 / Math.max(0.2, aspect));
    const fov = (2 * Math.atan(th) * 180) / Math.PI;
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const co = P.camOverride;
    if (co) { cam.position.set(co.x, co.y, co.z); cam.lookAt(co.lx, co.ly, co.lz); if (co.fov && cam.fov !== co.fov) { cam.fov = co.fov; cam.updateProjectionMatrix(); } }
    else { cam.position.set(c.x, c.y, c.z); cam.lookAt(c.lx, c.ly, c.lz); }
    stage.setShadowTarget(0, 0, 6.5);
    if (!P.noRender) { stage.render(); perfTick(); }
  }
  P.frame = frame;

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      frame(game);
    };
    return game;
  };
  return P;
}
