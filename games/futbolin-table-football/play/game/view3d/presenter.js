// Futbolín 3D presenter: a lit café room with a real wooden futbolín table, chrome rods, painted men and a rolling ball, rendered
// in a WebGL canvas BEHIND the (transparent) kit canvas. It only READS the game state; the simulation never sees it.
// Play: the camera is fitted to the table area of the play layout and publishes project/unproject (src/v3.js), so touches,
// hints and sparks line up with the 3D table. Menus: a slow drifting hero shot of the attract match.
// No WebGL / context lost: v3.on is false and the game draws its 2D table exactly as before.
import { THREE, createStage } from '../vendor3d/index.js';
import * as M from './models.js';
import { playLayout, W, H } from '../src/layout.js';
import { v3 } from '../src/v3.js';
import { ROD_LAYOUT, ROD_Y, HL, BALL_R, dirOf } from '../src/consts.js';

const { U, FY, ROD_H, FOOT_L } = M;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const yieldNow = () => new Promise((r) => setTimeout(r, 0));

function pickQuality() {
  const mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  return mem <= 2 || cores <= 2 ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', shadowSize: 1 });
  if (!stage.supported) { canvas.remove(); return null; }
  const { scene, camera, renderer } = stage;
  camera.near = 0.05; camera.far = 30;

  // ---- lights: warm overhead key (soft shadows of rods and men on the field), lamp pool, low café ambience, a cool rim for the chrome
  stage.setSky(0x160b05, 0x160b05, { near: 3.5, far: 10 });
  const L = stage.lights;
  L.hemi.color.set(0xffdcb8); L.hemi.groundColor.set(0x3a2214); L.hemi.intensity = 0.42;
  L.key.color.set(0xffe2b8); L.key.intensity = 2.0;
  stage._shadowOffset = new THREE.Vector3(-1.1, 2.9, 1.25);
  if (L.key.castShadow) {
    Object.assign(L.key.shadow.camera, { left: -0.9, right: 0.9, top: 0.9, bottom: -0.9, near: 0.5, far: 8 });
    L.key.shadow.camera.updateProjectionMatrix(); L.key.shadow.bias = -0.0002; L.key.shadow.normalBias = 0.004; L.key.shadow.radius = 4;
  }
  stage.setShadowTarget(0, FY, 0);
  L.rim.color.set(0xa8c0ff); L.rim.intensity = 0.7;
  renderer.toneMappingExposure = 1.05;
  scene.environmentIntensity = 0.5;
  const spot = new THREE.SpotLight(0xffcf8e, 3.5, 6, 1.0, 0.9, 1.4);
  spot.position.set(0, FY + 0.95, 0); spot.target.position.set(0, FY, 0); scene.add(spot, spot.target);
  const glowBar = new THREE.PointLight(0xffa860, 1.2, 4, 1.6); glowBar.position.set(0, 1.9, -2.2); scene.add(glowBar);

  // ---- build in slices so the title keeps painting
  const mats = M.makeMaterials();
  scene.add(M.buildRoom(mats)); await yieldNow();
  scene.add(M.buildTable(mats)); await yieldNow();
  const lamp = M.buildLamp(); lamp.position.set(0, FY + 0.95, 0); lamp.visible = false; scene.add(lamp);   // its light is the spot; the shade itself is only used for the icon
  const motes = M.buildMotes(); scene.add(motes);
  scene.add(M.buildBushings(mats, ROD_Y.map((y) => y * U)));
  let kitKey = '';
  const kits = [{ col: '#d8452e', trim: '#ffe6bf' }, { col: '#2f6fd6', trim: '#d8e6ff' }];
  const rods = ROD_LAYOUT.map((d, i) => { const r = M.buildRod(mats, d.kind, d.team, kits[d.team]); r.slide.position.z = ROD_Y[i] * U; scene.add(r.slide); r.th = 0; r.w = 0; return r; });
  await yieldNow();
  const counters = [M.buildCounter(mats, kits[0].col, 1), M.buildCounter(mats, kits[1].col, -1)];
  counters.forEach((c) => scene.add(c.group));
  const { ball, shadow } = M.buildBall(); scene.add(ball, shadow);
  const glow = M.buildRodGlow(); glow.visible = false; scene.add(glow);

  // ---- camera fitting: put the table (with its walls and resting handles) exactly in a screen rectangle
  const fitCam = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  const XH = 0.47, ZH = 0.70;
  const corners = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [FY - 0.03, FY + 0.12]) corners.push(new THREE.Vector3(sx * XH, y, sz * ZH));
  const tmp = new THREE.Vector3();
  function cssBox(cam, w, h) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of corners) { tmp.copy(c).project(cam); const px = (tmp.x + 1) / 2 * w, py = (1 - tmp.y) / 2 * h; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    return { x0, y0, x1, y1 };
  }
  // dir: unit vector from the look point to the camera. rect: CSS px. Returns { pos, look, offX, offY, fov }
  function fit(dir, rect, w, h, fov, fill = 1) {
    const look = new THREE.Vector3(0, FY + 0.02, 0);
    fitCam.fov = fov; fitCam.aspect = w / h; fitCam.clearViewOffset(); fitCam.updateProjectionMatrix();
    let d = 2.4;
    for (let i = 0; i < 7; i++) {
      fitCam.position.copy(look).addScaledVector(dir, d); fitCam.lookAt(look); fitCam.updateMatrixWorld(true);
      const b = cssBox(fitCam, w, h), k = Math.max((b.x1 - b.x0) / (rect.w * fill), (b.y1 - b.y0) / (rect.h * fill));
      d *= Math.pow(k, 0.92);
    }
    fitCam.position.copy(look).addScaledVector(dir, d); fitCam.lookAt(look); fitCam.updateMatrixWorld(true);
    const b = cssBox(fitCam, w, h);
    return { pos: fitCam.position.clone(), look, offX: (b.x0 + b.x1) / 2 - (rect.x + rect.w / 2), offY: (b.y0 + b.y1) / 2 - (rect.y + rect.h / 2), fov };
  }
  const sph = (tilt, yaw) => new THREE.Vector3(Math.sin(tilt) * Math.sin(yaw), Math.cos(tilt), Math.sin(tilt) * Math.cos(yaw));
  const DEG = Math.PI / 180;

  // virtual (game) units <-> CSS px of the full-screen canvases
  let vw = 1, vh = 1, cpu = 1, ox = 0, oy = 0;
  function syncView() {
    const r = kitCanvas.getBoundingClientRect(); vw = Math.max(1, r.width); vh = Math.max(1, r.height);
    cpu = Math.min(vw / W, vh / H); ox = (vw - W * cpu) / 2; oy = (vh - H * cpu) / 2;
  }
  const toCss = (rx, ry, rw, rh) => ({ x: ox + rx * cpu, y: oy + ry * cpu, w: rw * cpu, h: rh * cpu });

  const cur = { pos: new THREE.Vector3(), look: new THREE.Vector3(), offX: 0, offY: 0, fov: 30, init: false };
  let lastScene = '', lastT = null, blending = false, fitKey = '', fitDes = null;
  const snapTo = (d) => { cur.pos.copy(d.pos); cur.look.copy(d.look); cur.offX = d.offX; cur.offY = d.offY; cur.fov = d.fov; cur.init = true; };
  function applyCam(c, shake = 0, t = 0) {
    camera.fov = c.fov; camera.aspect = vw / vh;
    camera.position.copy(c.pos);
    if (shake) camera.position.add(tmp.set(Math.sin(t * 83) * shake, Math.cos(t * 71) * shake * 0.5, Math.cos(t * 97) * shake));
    camera.lookAt(c.look);
    camera.setViewOffset(vw, vh, c.offX, c.offY, vw, vh);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }

  // projections for the 2D layer (valid for the fitted play camera)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pv = new THREE.Vector3();
  const projectW = (x, y, z) => { pv.set(x, y, z).project(camera); const cx = (pv.x + 1) / 2 * vw, cy = (1 - pv.y) / 2 * vh; return { x: (cx - ox) / cpu, y: (cy - oy) / cpu }; };
  const project = (tx, ty, lift = 0) => projectW(tx * U, FY + lift * U, ty * U);
  const unproject = (vx, vy) => {
    const cx = ox + vx * cpu, cy = oy + vy * cpu; ndc.set(cx / vw * 2 - 1, -(cy / vh * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, py = FY + ROD_H;
    if (Math.abs(d.y) < 1e-6) return null;
    const t = (py - o.y) / d.y; if (t <= 0) return null;
    return { x: (o.x + d.x * t) / U, y: (o.z + d.z * t) / U };
  };
  const scaleAt = (tx, ty) => { const a = project(tx, ty - 0.5, 7), b = project(tx, ty + 0.5, 7); return Math.hypot(a.x - b.x, a.y - b.y); };

  // ---- per-frame state
  const ballQ = new THREE.Quaternion(), dq = new THREE.Quaternion(), axis = new THREE.Vector3();
  let lastBall = null, seen = -1, simRef = null, frames = 0, slowAcc = 0, lastNow = 0, tier = quality;

  function setKits(G) {
    const k = G.kits; if (!k) return;
    const key = `${k[0].col}|${k[0].trim}|${k[1].col}|${k[1].trim}`;
    if (key === kitKey) return; kitKey = key;
    rods.forEach((r, i) => { const kit = k[ROD_LAYOUT[i].team]; r.kitMat.color.set(kit.col); r.trimMat.color.set(kit.trim); r.capMat.color.set(kit.col); });
    counters[0].mat.color.set(k[0].col); counters[1].mat.color.set(k[1].col);
  }

  function frame(game) {
    const G = game.getState(), simObj = G.sim; if (!simObj) return;
    const S = simObj.s;
    if (stage.contextLost) { v3.on = false; v3.fit = null; return; }
    syncView();
    let dt = lastT === null ? 0 : G.t - lastT; lastT = G.t; dt = clamp(dt, 0, 0.1);
    // slow device: drop the quality tier (pixel ratio, shadow map size)
    const now = performance.now(); if (lastNow) { const fd = now - lastNow; if (fd < 200) slowAcc = slowAcc * 0.97 + (fd > 30 ? 0.03 : 0); } lastNow = now;
    if (++frames > 120 && slowAcc > 0.5 && tier !== 'low') { tier = tier === 'high' ? 'medium' : 'low'; stage.setQuality(tier); slowAcc = 0; frames = 0; }
    setKits(G);
    if (simObj !== simRef) { simRef = simObj; seen = -1; lastBall = null; rods.forEach((r) => { r.th = 0; r.w = 0; }); }

    // ---- camera
    const play = G.scene === 'play';
    let des;
    if (play) {
      const lay = playLayout(G.settings.textIdx);
      const key = `${vw}x${vh}|${lay.cx}|${lay.cy}|${lay.s}|${lay.wide}`;
      if (key !== fitKey) {
        fitKey = key;
        const hx = (lay.wide ? 73 : 52) * lay.s, hy = (lay.wide ? 52 : 73) * lay.s, rc = toCss(lay.cx - hx, lay.cy - hy, 2 * hx, 2 * hy);
        fitDes = fit(lay.wide ? sph(28 * DEG, Math.PI / 2) : sph(31 * DEG, 0), rc, vw, vh, lay.wide ? 30 : 32, 1);
        fitDes.lay = { cx: lay.cx, cy: lay.cy, s: lay.s, wide: lay.wide };
      }
      des = fitDes;
    } else {
      const hr = v3.hero || { x: 0, y: 0, w: W, h: H }, rc = toCss(hr.x, hr.y, hr.w, hr.h), wide = W > H * 1.25;
      const yaw = (wide ? 0.55 : 0.32) + Math.sin(G.t * 0.07) * 0.2, tilt = (wide ? 50 : 47) * DEG + Math.sin(G.t * 0.05) * 0.04;
      des = fit(sph(tilt, yaw), rc, vw, vh, 34, 0.98);
    }
    if (lastScene && play !== (lastScene === 'play')) blending = true;
    if (!cur.init || dt === 0 || (play && !blending)) snapTo(des);   // a play layout change (resize, rotation, text size) snaps: touches always match
    else {
      const k = 1 - Math.exp(-dt * (blending ? 5.5 : 4));
      cur.pos.lerp(des.pos, k); cur.look.lerp(des.look, k); cur.offX += (des.offX - cur.offX) * k; cur.offY += (des.offY - cur.offY) * k; cur.fov += (des.fov - cur.fov) * k;
      if (blending && cur.pos.distanceTo(des.pos) < 0.003 && Math.abs(cur.offX - des.offX) < 1 && Math.abs(cur.offY - des.offY) < 1) { snapTo(des); blending = false; }
    }
    lastScene = G.scene;
    applyCam(cur, play && S.shake > 0 ? S.shake * 0.0025 : 0, G.t);
    v3.fit = play && !blending ? des.lay : null;

    // ---- events: a ball that smacks into a man knocks him back on his rod (a damped wobble)
    for (const e of S.events || []) {
      if (e.id <= seen) continue; seen = e.id;
      if (e.type === 'man' && rods[e.rod]) {
        const r = rods[e.rod], rd = S.rods[e.rod], d = dirOf(rd.team), front = (e.y - rd.y) * d > 0 ? 1 : -1;
        r.w += front * d * clamp(e.v / 260, 0.05, 0.9) * 9;
      }
    }

    // ---- rods: slide with the offset, spin with the swing (foot offset f -> angle about the rod)
    const active = play && G.mode !== 'watch' && !G.two ? G.active : -1;
    rods.forEach((r, i) => {
      const rd = S.rods[i]; if (!rd) return;
      // computer-driven rods start and stop as hard as the sim allows; a critically damped follower (about 20 ms) takes the jerk out of
      // the picture. Rods under a finger stay exactly 1:1 so the rod never lags the thumb.
      const tx = rd.off * U, human = G.two || (rd.team === 0 && G.mode !== 'watch' && G.mode !== 'shot' && play);
      if (human || r.vx === undefined || dt === 0 || Math.abs(tx - r.sx) > 0.12) { r.sx = tx; r.vx = 0; }
      else { const wn = 55, a = wn * wn * (tx - r.sx) - 2 * wn * r.vx; r.vx += a * dt; r.sx += r.vx * dt; }
      r.slide.position.x = r.sx;
      r.w += (-120 * r.th - 13 * r.w) * dt; r.th += r.w * dt; r.th = clamp(r.th, -0.5, 0.5);
      r.spin.rotation.x = -dirOf(rd.team) * Math.asin(clamp(rd.f / (FOOT_L / U), -1, 1)) + r.th;
      r.capMat.emissive.set(i === active ? 0x6a4a10 : 0x000000);
    });
    if (active >= 0 && S.rods[active]) { glow.visible = true; glow.position.z = S.rods[active].y * U; glow.material.opacity = 0.32 + 0.12 * Math.sin(G.t * 4); } else glow.visible = false;

    // ---- ball: rolls (rotation follows the distance it travels), drops into the goal pocket, contact shadow
    const b = S.ball, inGoal = S.phase === 'goal', hide = inGoal && S.phaseT > 1.2;
    const depth = Math.max(0, Math.abs(b.y) - HL) * U;
    let drop = Math.min(0.05, depth * 0.6);
    if (inGoal) drop = Math.max(drop, Math.min(1, S.phaseT / 0.4) ** 2 * 0.075);
    const bx = b.x * U, bz = b.y * U, by = FY + BALL_R * U - drop;
    if (lastBall) {
      const dx = bx - lastBall.x, dz = bz - lastBall.z, dist = Math.hypot(dx, dz);
      if (dist > 1e-6 && dist < 0.2) { axis.set(dz, 0, -dx).normalize(); dq.setFromAxisAngle(axis, dist / (BALL_R * U)); ballQ.premultiply(dq); }
    }
    lastBall = { x: bx, z: bz };
    ball.position.set(bx, by, bz); ball.quaternion.copy(ballQ); ball.visible = !hide;
    shadow.position.set(bx, FY + 0.0015, bz); shadow.visible = !hide && drop < 0.02; shadow.material.opacity = 0.55 * (1 - drop / 0.02);

    // ---- bead counters slide one bead across per goal (with a little clack bounce)
    counters.forEach((c, team) => {
      const sc = S.score[team] || 0, goals = S.goals || 5;
      c.beads.forEach((bd, i) => {
        const vis = i >= 7 - goals, scored = i >= 7 - sc;
        const tx = scored ? 0.19 - (6 - i) * 0.027 : -0.19 + (i - (7 - goals)) * 0.027;
        if (!bd.init || dt === 0) { bd.x = tx; bd.v = 0; bd.init = true; }
        bd.v += ((tx - bd.x) * 160 - bd.v * 11) * dt; bd.x += bd.v * dt;
        bd.m.visible = vis; bd.m.position.x = bd.x;
      });
    });
    motes.userData.step(G.t);
    stage.update(dt);
    v3.on = true;
  }

  stage.onContextLost(() => { v3.on = false; v3.fit = null; });
  stage.onContextRestored(() => { cur.init = false; fitKey = ''; });
  v3.project = project; v3.unproject = unproject; v3.scale = scaleAt;

  return {
    stage, ok: true,
    attach(game) {
      if (game.__p3d) return; game.__p3d = true;
      const r0 = game.render;
      game.render = function (ctx, view) { r0.call(this, ctx, view); try { frame(game); } catch (e) { console.warn('3D frame failed; back to 2D', e); v3.on = false; v3.fit = null; } };
    },
    loseContext: () => stage.loseContextForTest(), restoreContext: () => stage.restoreContextForTest(),
    scene, camera, rods, ball,
  };
}
