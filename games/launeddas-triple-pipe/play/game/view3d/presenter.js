// Launeddas Triple Pipe 3D presenter. It READS what the 2D layer reports in src/v3.js (and game.getState()), never writes the sim.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The scene lives in the 2D layer's virtual units (short side 720), so
// the plane z = 0 of the perspective camera is exactly the 2D screen: plaques, pads and notes line up with the digits and text that
// the 2D layer paints on top. Behind them: a dusk sky, hills, the stone tower, drifting fireflies, and the three cane pipes with the
// cheek reservoir, lit by a warm key, a low-sun rim and a cool fill.
// Load: the game boots with its flat 2D art at once; this scene is built in slices (await tick()), compiled with compileAsync,
// then the canvas fades in. No WebGL / context lost -> v3.on = false and every screen draws the flat 2D art again.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3, resetFrame } from '../src/v3.js';
import { buildPipes, buildBackdrop, plaqueGeo, surfaceMats, glowTexture, LANE_HEX, tex, cv } from './models.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2 }, { name: 'medium', dpr: 1.5 }, { name: 'low', dpr: 1 }];
const SHOT = /[?&]shot=/.test(location.search);
const tick = () => (SHOT ? Promise.resolve() : new Promise((r) => setTimeout(r, 0)));
const FOV = 34;
const PAD_HEX = ['#d8481f', '#14988a', '#14988a', '#d9930f', '#d9930f', '#d9930f'];

export function createPresenter({ kitCanvas, quality = 'high' }) {
  const P = { ok: false, on: false, wrap: null, ready: null, probe: () => null };
  const q = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (q.has('tier')) tier = clamp(Number(q.get('tier')) | 0, 0, 2);
  let renderer = null, scene = null, camera = null, canvas = null;
  let mainG = null, clipG = null, bd = null, pipes = null, mats = null, env = null, fieldG = null;
  const FS = { targets: [], lanes: [], grooves: [], hit: null, hitGlow: null, notes: [], pads: [], fill: null, fillGlow: null, sheen: null };
  const plaquePool = [];
  let W = 720, H = 1280, lastT = performance.now(), ema = 16, frames = 0, clock = 0, hy = 700, hyInit = false, sizeKey = '';
  const lit = [0, 0, 0, 0, 0], padGlow = [0, 0, 0, 0, 0, 0];
  let bagR = 56;
  const planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
  const dist = () => (H / 2) / Math.tan((FOV / 2) * Math.PI / 180);
  const sAt = (z) => (dist() + Math.abs(z)) / dist();
  // place an object so that it appears at virtual screen point (xv, yv) when it sits at depth z (z <= 0 = behind the screen plane)
  const place = (o, xv, yv, z) => { const s = sAt(z); o.position.set(W / 2 + (xv - W / 2) * s, -H / 2 + (H / 2 - yv) * s, z); };

  // ------------------------------------------------------------------ plaques
  function plaqueAt(i) {
    let p = plaquePool[i];
    if (p) return p;
    const group = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.BufferGeometry(), mats.brass);
    const face = new THREE.Mesh(new THREE.BufferGeometry(), mats.wood);
    group.add(rim, face);
    p = { group, rim, face, kind: '' };
    plaquePool[i] = p;
    return p;
  }
  const lum = (css) => { const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(css || ''); return m ? 0.3 * +m[1] + 0.59 * +m[2] + 0.11 * +m[3] : 40; };
  function style(kind) {
    switch (kind) {
      case 'primary': return { rim: mats.brass, face: mats.red };
      case 'active': return { rim: mats.brass, face: mats.teal };
      case 'plain': return { rim: mats.rimWood, face: mats.ivory };
      case 'disabled': return { rim: mats.slate, face: mats.slate };
      case 'parch': return { rim: mats.rimWood, face: mats.ivory };
      case 'field': return { rim: mats.brass, face: mats.field };
      case 'glass': return { rim: mats.copper, face: mats.slate };
      default: return { rim: mats.copper, face: mats.wood };   // dark
    }
  }
  function setPlaque(p, r, rad, kind, pressed, z, clipped) {
    const bw = Math.max(2, Math.min(5, Math.min(r.w, r.h) * 0.07)), depth = kind === 'field' ? 12 : 9;
    if (p.kind !== kind) { const st = style(kind); p.rim.material = st.rim; p.face.material = st.face; p.kind = kind; }
    p.rim.geometry = plaqueGeo(r.w, r.h, rad, depth, 2.5);
    p.face.geometry = plaqueGeo(r.w - bw * 2, r.h - bw * 2, Math.max(1, rad - bw), depth + 2.5, 2);
    p.group.position.set(r.x + r.w / 2, -(r.y + r.h / 2), z - (pressed ? 4 : 0));
    p.group.visible = true;
    const target = clipped ? clipG : mainG;
    if (p.group.parent !== target) target.add(p.group);
  }

  // ------------------------------------------------------------------ build (in slices)
  async function build() {
    mats = surfaceMats();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, 1, 20, 6000);
    mainG = new THREE.Group(); clipG = new THREE.Group(); scene.add(mainG, clipG);
    // lights: the sun is low and behind-right (rim), the key is a warm lamp from upper left in front, a cool fill from the left
    const hemi = new THREE.HemisphereLight(0xffd2a8, 0x2a1426, 0.5);
    const key = new THREE.DirectionalLight(0xffc890, 1.7); key.position.set(-500, 700, 900);
    const rim = new THREE.DirectionalLight(0xff9a50, 2.0); rim.position.set(900, 150, -500);
    const fill = new THREE.DirectionalLight(0x7aa6ff, 0.55); fill.position.set(-900, -200, 600);
    scene.add(hemi, key, rim, fill);
    env = B.createEnvironment(renderer, scene, { intensity: 0.3 });
    await tick();
    bd = buildBackdrop(); mainG.add(bd);
    await tick();
    pipes = buildPipes(); mainG.add(pipes);
    await tick();
    buildField();
    await tick();
  }
  function buildField() {
    fieldG = new THREE.Group(); mainG.add(fieldG);
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    const laneTex = (top, bot) => {
      const c = cv(4, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, top); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 4, 128);
      return tex(c, { aniso: 1 });
    };
    const teal = laneTex('#16231f', '#2d5b53'), gold = laneTex('#241d12', '#5d4824');
    const ringGeo = new THREE.RingGeometry(0.82, 1, 44);
    for (let i = 0; i < 5; i++) {
      const gr = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: '#7a5a34' })); fieldG.add(gr); FS.grooves.push(gr);
      const ln = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: i < 2 ? teal : gold })); fieldG.add(ln); FS.lanes.push(ln);
      const tg = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: LANE_HEX[i], transparent: true, opacity: 0.8, depthWrite: false })); fieldG.add(tg); FS.targets.push(tg);
    }
    const hc = cv(256, 4), hx = hc.getContext('2d'), hg = hx.createLinearGradient(0, 0, 256, 0);
    hg.addColorStop(0, '#6fe0d0'); hg.addColorStop(0.5, '#fff2d0'); hg.addColorStop(1, '#ffd36a'); hx.fillStyle = hg; hx.fillRect(0, 0, 256, 4);
    FS.hit = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: tex(hc, { aniso: 1 }) })); fieldG.add(FS.hit);
    FS.hitGlow = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffe8b0', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); fieldG.add(FS.hitGlow);
    const beadGeo = B.lathe([[0, -0.4], [0.62, -0.38], [0.9, -0.28], [1, -0.1], [1, 0.14], [0.9, 0.36], [0.62, 0.48], [0, 0.5]], 28);
    beadGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 30; i++) {
      const m = new THREE.MeshPhysicalMaterial({ color: '#2fd0bd', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.35, emissive: '#2fd0bd', emissiveIntensity: 0.25 });
      const bead = new THREE.Mesh(beadGeo, m);
      const sh = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false }));
      const gl = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffd36a', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      const grp = new THREE.Group(); grp.add(sh, gl, bead); grp.visible = false; fieldG.add(grp);
      FS.notes.push({ grp, bead, sh, gl, m, col: '' });
    }
    // air gauge (a glass tube with an amber column)
    const fc = cv(8, 128), fx = fc.getContext('2d'), fg = fx.createLinearGradient(0, 128, 0, 0);
    fg.addColorStop(0, '#d8400f'); fg.addColorStop(1, '#ffb23a'); fx.fillStyle = fg; fx.fillRect(0, 0, 8, 128);
    FS.fill = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: tex(fc, { aniso: 1 }) })); fieldG.add(FS.fill);
    FS.fillGlow = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ff4a28', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); fieldG.add(FS.fillGlow);
    FS.sheen = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false })); fieldG.add(FS.sheen);
    for (let i = 0; i < 6; i++) {
      const col = PAD_HEX[i];
      const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(col).multiplyScalar(0.55), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.35, emissive: col, emissiveIntensity: 0.05 });
      const well = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ color: '#060302' }));
      const body = new THREE.Mesh(new THREE.BufferGeometry(), m);
      const capM = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(col).multiplyScalar(1.15), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.4, emissive: col, emissiveIntensity: 0.05 });
      const cap = new THREE.Mesh(new THREE.BufferGeometry(), capM);
      const grp = new THREE.Group(); grp.add(well, body, cap); fieldG.add(grp);
      FS.pads.push({ grp, body, well, m, cap, capM });
    }
  }

  // ------------------------------------------------------------------ one frame
  function present(state, view, dt) {
    W = view?.width || 720; H = view?.height || 1280;
    camera.aspect = W / H; camera.fov = FOV; camera.position.set(W / 2, -H / 2, dist()); camera.lookAt(W / 2, -H / 2, 0);
    camera.far = dist() + 3000; camera.updateProjectionMatrix();
    const t = clock;
    // ---- horizon follows the instrument picture, damped
    const pp = v3.pipes[0];
    const hyT = pp ? pp.r.y + pp.r.h * 0.9 : H * 0.62;
    if (!hyInit) { hy = hyT; hyInit = true; }
    hy += (hyT - hy) * (1 - Math.exp(-dt * 5));
    hy = clamp(hy, H * 0.3, H * 0.85);
    // ---- sky, stars, sun, hills, tower, ground (each layer sits at its own depth, so it drifts with parallax)
    const bo = bd.userData, sk = sAt(-1400);
    const yTop = -H / 2 + (H / 2 + 0.12 * H) * sk, yHor = -H / 2 + (H / 2 - hy) * sk;
    bo.sky.scale.set(W * sk * 1.15, yTop - yHor, 1); bo.sky.position.set(W / 2, (yTop + yHor) / 2, -1400);
    bo.stars.scale.set(W * sk / 2 * 1.1, -(yTop - yHor) * 0.9 / 0.6, 1); bo.stars.position.set(W / 2, yTop - (yTop - yHor) * 0.12, -1390);
    bo.stars.material.opacity = 0.55 + 0.3 * Math.sin(t * 1.3);
    const sunSize = Math.max(W, H) * 1.1 * sAt(-1300);
    bo.sun.scale.set(sunSize, sunSize, 1); place(bo.sun, W * 0.78 + Math.sin(t * 0.05) * 6, hy - H * 0.01, -1300);
    bo.disc.scale.setScalar(Math.min(W, H) * 0.075 * sAt(-1290)); place(bo.disc, W * 0.78 + Math.sin(t * 0.05) * 6, hy + Math.min(W, H) * 0.02, -1290);
    bo.hills[0].scale.set(W * sAt(-1100) / 2 * 1.1, H * 0.34 * sAt(-1100), 1); place(bo.hills[0], W / 2 + Math.sin(t * 0.04) * 8, hy - 6, -1100);
    bo.hills[1].scale.set(W * sAt(-700) / 2 * 1.1, H * 0.3 * sAt(-700), 1); place(bo.hills[1], W / 2 - Math.sin(t * 0.04) * 12, hy - 2, -700);
    const tw = Math.min(W * 0.2, hy * 0.5, H * 0.28), th = tw * 1.45;
    bo.tower.scale.set(tw * sAt(-240), th * sAt(-240), tw * sAt(-240));
    place(bo.tower, W * 0.14 + Math.sin(t * 0.07) * 4, hy + 2, -240);
    bo.tower2.scale.set(tw * 0.58 * sAt(-270), th * 0.6 * sAt(-270), tw * 0.58 * sAt(-270));
    place(bo.tower2, W * 0.14 + tw * 0.82, hy + 2, -270);
    const gh = H * 1.2 - hy, gs = sAt(-20);
    bo.ground.scale.set(W * gs * 1.15, gh * gs, 1); place(bo.ground, W / 2, hy + gh / 2, -20);
    const mp = bo.mote.geometry.attributes.position, sd = bo.mote.userData.seed;
    for (let i = 0; i < bo.mote.userData.n; i++) {
      const a = sd[i * 3], b = sd[i * 3 + 1], c = sd[i * 3 + 2];
      const x = ((a + t * (0.004 + c * 0.006)) % 1) * W, y = H * 0.1 + (b * 0.75 + 0.03 * Math.sin(t * 0.6 + a * 20)) * (hy - H * 0.05);
      mp.setXYZ(i, x, -y, 0);
    }
    mp.needsUpdate = true;
    // ---- the pipes
    if (pp) {
      const r = pp.r, o = pp.o, k = Math.min(r.w / 620, r.h / 380);
      pipes.visible = true;
      pipes.scale.set(k, k, k);
      pipes.position.set(r.x + r.w / 2, -(r.y + r.h / 2), 0);
      pipes.rotation.y = Math.sin(t * 0.5) * 0.06; pipes.rotation.x = -0.05 + 0.012 * Math.sin(t * 0.9);
      const m = pipes.userData, kk = 1 - Math.exp(-dt * 22);
      for (let l = 0; l < 5; l++) {
        lit[l] += ((o.lit[l] ? 1 : 0) - lit[l]) * kk;
        const h = m.holes[l];
        h.lit.material.opacity = lit[l] * 0.9; h.glow.material.opacity = lit[l] * 0.75; h.glow.scale.setScalar(0.85 + 0.25 * lit[l]);
      }
      const drone = clamp(o.drone, 0, 1), flick = o.air < 0.2 ? 0.4 + 0.6 * Math.abs(Math.sin(o.t * 18)) : 1;
      m.glow[0].material.opacity = clamp(drone * 0.55 * flick, 0, 0.9);
      m.glow[1].material.opacity = Math.min(1, lit[0] + lit[1]) * 0.8;
      m.glow[2].material.opacity = Math.min(1, lit[2] + lit[3] + lit[4]) * 0.8;
      m.rings.forEach((rg, i) => {
        const ph = (o.t * 0.9 + i / 3) % 1;
        rg.scale.setScalar(24 + ph * 80); rg.material.opacity = (1 - ph) * 0.55 * drone * flick;
      });
      const air = clamp(o.air, 0, 1), low = air < 0.25;
      const rrT = 30 + air * 26 + (o.squeeze ? 4 * Math.sin(o.t * 26) : 0);
      bagR += (rrT - bagR) * (1 - Math.exp(-dt * 16));
      const breath = 1 + 0.012 * Math.sin(t * 1.7), by = -(326 - bagR * 0.35 - 190);
      m.bag.scale.set(bagR * breath, bagR * 0.95 * breath, bagR * 0.85); m.bag.position.set(0, by, 14);
      m.bagMat.emissiveIntensity = low ? 0.35 + 0.3 * Math.sin(o.t * 14) : 0;
      m.bagGlow.material.opacity = low ? 0.5 + 0.35 * Math.sin(o.t * 14) : 0;
      m.bagGlow.scale.setScalar(bagR * 3.2); m.bagGlow.position.set(0, by, 30);
    } else pipes.visible = false;

    // ---- field, pads, notes, gauge, then the plaques the 2D layer reported
    let n = 0;
    const f = v3.field;
    fieldG.visible = !!f;
    if (f) {
      const laneTop = f.laneTop, lh = Math.max(10, f.hitY + 8 - laneTop);
      setPlaque(plaqueAt(n++), f.f, 18, 'field', false, 2, false);
      for (let i = 0; i < 5; i++) {
        const c = f.cols[i + 1], hot = !!f.pressed?.[i + 1], ln = FS.lanes[i], tg = FS.targets[i];
        FS.grooves[i].scale.set(c.w + 3, lh + 3, 1); FS.grooves[i].position.set(c.x + c.w / 2, -(laneTop + lh / 2), 19.6);
        ln.scale.set(c.w, lh, 1); ln.position.set(c.x + c.w / 2, -(laneTop + lh / 2), 20);
        const b = ln.userData.b ?? 1, bt = hot ? 1.9 : 1, nb = b + (bt - b) * (1 - Math.exp(-dt * 18));
        ln.userData.b = nb; ln.material.color.setScalar(nb);
        const rr = clamp(Math.min(c.w * 0.4, 44), 14, 44) * (hot ? 1.12 : 1);
        tg.scale.set(rr, rr, 1); tg.position.set(c.x + c.w / 2, -f.hitY, 24); tg.material.opacity = hot ? 1 : 0.55;
      }
      const x0 = f.cols[1].x, x1 = f.cols[5].x + f.cols[5].w;
      FS.hit.scale.set(x1 - x0, 5, 1); FS.hit.position.set((x0 + x1) / 2, -f.hitY, 21);
      FS.hitGlow.scale.set(x1 - x0 + 30, 40, 1); FS.hitGlow.position.set((x0 + x1) / 2, -f.hitY, 20.8);
      FS.hitGlow.material.opacity = 0.4 + 0.12 * Math.sin(t * 3);
      let ni = 0;
      for (const nt of v3.notes) {
        if (ni >= FS.notes.length) break;
        if (nt.y < laneTop - nt.r * 0.2 || nt.y > f.hitY + 80) continue;
        const N = FS.notes[ni++], R = nt.r, hexC = nt.lane < 2 ? '#2fd0bd' : '#ffc23a', ck = nt.dead ? 'x' : hexC;
        if (N.col !== ck) {
          N.col = ck;
          N.m.color.set(nt.dead ? '#6a5e5a' : hexC); N.m.emissive.set(nt.dead ? '#000000' : hexC); N.m.emissiveIntensity = nt.dead ? 0 : 0.28;
          N.gl.material.color.set(nt.dead ? '#000000' : hexC);
        }
        N.grp.visible = true;
        N.grp.position.set(nt.x, -nt.y, 0);
        N.bead.scale.set(R, R, R * 0.75); N.bead.position.z = 23 + R * 0.36;
        N.bead.rotation.y = Math.sin(t * 2 + nt.lane) * 0.22; N.bead.rotation.x = Math.cos(t * 1.7 + nt.lane) * 0.18;
        N.sh.scale.set(R * 2.5, R * 2.0, 1); N.sh.position.set(R * 0.18, -R * 0.22, 22);
        N.gl.scale.set(R * 3.2, R * 3.2, 1); N.gl.position.z = 23; N.gl.visible = !nt.dead;
        N.gl.material.opacity = nt.hint ? 0.75 : 0.35;
      }
      for (let i = ni; i < FS.notes.length; i++) FS.notes[i].grp.visible = false;
      for (let i = 0; i < 6; i++) {
        const pd = v3.pads.find((x) => x.i === i), PA = FS.pads[i];
        if (!pd) { PA.grp.visible = false; continue; }
        PA.grp.visible = true;
        const r = pd.r;
        PA.well.scale.set(r.w + 4, r.h + 4, 1); PA.well.position.set(r.x + r.w / 2, -(r.y + r.h / 2), 1);
        PA.body.geometry = plaqueGeo(r.w, r.h, 16, 14, 3);
        PA.body.position.set(r.x + r.w / 2, -(r.y + r.h / 2), pd.down ? 3 : 9);
        const target = pd.down || pd.sq ? 0.75 : pd.hint ? 0.35 : 0.05;
        padGlow[i] += (target - padGlow[i]) * (1 - Math.exp(-dt * 20));
        PA.m.emissiveIntensity = padGlow[i] * 0.6; PA.capM.emissiveIntensity = padGlow[i];
        PA.cap.geometry = plaqueGeo(r.w - 16, r.h - 16, 12, 6, 3); PA.cap.position.set(r.x + r.w / 2, -(r.y + r.h / 2), (pd.down ? 3 : 9) + 12);
      }
      const gg = v3.gauge;
      FS.fill.visible = FS.fillGlow.visible = FS.sheen.visible = !!gg;
      if (gg) {
        const r = gg.r;
        setPlaque(plaqueAt(n++), r, Math.min(r.w / 2, 22), 'glass', false, 14, false);
        const ih = r.h - 12, fh = Math.max(0.01, ih * gg.air), iw = r.w - 14;
        FS.fill.scale.set(iw, fh, 1); FS.fill.position.set(r.x + r.w / 2, -(r.y + r.h - 6 - fh / 2), 29);
        FS.fillGlow.scale.set(r.w * 2.6, r.h * 0.9, 1); FS.fillGlow.position.set(r.x + r.w / 2, -(r.y + r.h / 2), 28.5);
        FS.fillGlow.material.opacity = gg.low ? 0.35 + 0.3 * Math.sin(gg.t * 14) : 0;
        FS.sheen.scale.set(iw * 0.22, r.h - 22, 1); FS.sheen.position.set(r.x + r.w * 0.3, -(r.y + r.h / 2), 30);
      }
    }
    let clipped = false, cTop = 0, cBot = 0;
    const note = (c) => { if (c) { if (!clipped) { clipped = true; cTop = c.top; cBot = c.bottom; } else { cTop = Math.min(cTop, c.top); cBot = Math.max(cBot, c.bottom); } } };
    for (const p of v3.panels) { if (n >= 60) break; setPlaque(plaqueAt(n), p.r, p.rad || 20, lum(p.fill) > 150 ? 'parch' : 'dark', false, 3 + n * 0.6, !!p.clip); note(p.clip); n++; }
    for (const b of v3.buttons) {
      if (n >= 60) break;
      setPlaque(plaqueAt(n), b.r, 18, b.disabled ? 'disabled' : b.kind, b.pressed, 4 + n * 0.6, !!b.clip); note(b.clip); n++;
    }
    for (let i = n; i < plaquePool.length; i++) plaquePool[i].group.visible = false;
    // the scrolling list clips its plaques to the list box (world y = -virtual y)
    planes[0].constant = cBot; planes[1].constant = -cTop;

    // ---- draw: everything unclipped, then the clipped plaques
    renderer.setViewport(0, 0, Math.max(1, window.innerWidth), Math.max(1, window.innerHeight));
    renderer.clippingPlanes = [];
    clipG.visible = false; mainG.visible = true;
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    if (clipped) {
      mainG.visible = false; clipG.visible = true;
      renderer.clippingPlanes = planes;
      renderer.render(scene, camera);
      renderer.clippingPlanes = [];
      mainG.visible = true;
    }
  }

  function resize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr)); renderer.setSize(w, h, false);
  }

  // ------------------------------------------------------------------ init (async, in slices)
  async function init() {
    try {
      canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0;transition:opacity .45s ease';
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: q.has('shot') });
    } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return; }
    kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.autoClear = false; renderer.setClearColor(0x150d09, 1);
    renderer.shadowMap.enabled = false;
    resize();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); P.on = false; v3.on = false; });
    canvas.addEventListener('webglcontextrestored', () => { try { env.rebuild(); } catch { /* no reflections */ } sizeKey = ''; P.on = true; v3.on = true; });
    try {
      await build();
      if (renderer.compileAsync && !SHOT) { try { await renderer.compileAsync(scene, camera); } catch { /* the first render compiles */ } }
    } catch (e) {
      console.warn('3D init failed; 2D fallback', e);
      canvas.remove(); v3.on = false; return;
    }
    P.ok = true; P.on = true; v3.on = true; lastT = performance.now();
    if (q.has('shot')) { canvas.style.transition = 'none'; canvas.style.opacity = '1'; } else requestAnimationFrame(() => { canvas.style.opacity = '1'; });
  }
  P.ready = init();
  const flat = (ctx) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#150d09'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); };

  P.wrap = (game) => Object.assign({}, game, {
    render(ctx, view) {
      if (!P.on) { v3.on = false; flat(ctx); game.render(ctx, view); return; }
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      const now = performance.now(), dt = clamp((now - lastT) / 1000, 0, 0.1); lastT = now;
      const st = game.getState();
      if (!(st.paused && st.scene === 'play')) clock += dt;
      ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
      if (frames > 120 && ema > 26 && tier < TIERS.length - 1) { tier++; frames = 0; ema = 16; sizeKey = ''; }
      const key = `${window.innerWidth}x${window.innerHeight}|${tier}`;
      if (key !== sizeKey) { sizeKey = key; resize(); }
      v3.base = ctx.getTransform(); resetFrame();
      game.render(ctx, view);
      try { present(st, view, dt); } catch (e) { console.warn('3D present failed; flat 2D art', e); P.on = false; v3.on = false; }
    },
  });
  P.probe = () => ({ ok: P.ok, on: P.on, tier: TIERS[tier].name, ema: Math.round(ema * 10) / 10, plaques: plaquePool.filter((p) => p.group.visible).length, notes: FS.notes.filter((x) => x.grp.visible).length });
  return P;
}
