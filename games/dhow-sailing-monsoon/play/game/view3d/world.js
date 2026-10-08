// The 3D world: sky, sea, the dhow and its crew, coasts, reefs, the other dhow, dolphins, rain and the squall wall. `frame(dt, RS)` draws one
// view from a render snapshot RS built by the director from the sim state. Nothing here writes back to the sim.
import { createSky } from './sky.js';
import { createWater } from './water.js';
import { createShip } from './ship.js';
import { buildCoast, createReef, createDolphins, createRain, COAST_STYLES } from './land.js';
import { clamp, lerp, smooth, DEG, canvasTex } from './util3.js';

const CREW = [
  { x: 0.45, z: 5.7, top: '#ece0c4', bottoms: '#2d3f63', skin: 'brown', hair: 'black', clip: 'idle_relaxed' },
  { x: 0.0, z: -6.1, top: '#d9c79a', bottoms: '#7a3e2c', skin: 'deep', hair: 'black', clip: 'idle' },
  { x: 0.95, z: 0.9, top: '#f2ead6', bottoms: '#365d52', skin: 'tan', hair: 'black', clip: 'idle' },
];

export async function createWorld(V3, stage, quality) {
  const { THREE } = V3;
  const scene = stage.scene, camera = stage.camera;
  camera.near = 0.4; camera.far = 4200; camera.fov = 52; camera.updateProjectionMatrix();
  scene.background = null;
  const sky = createSky(THREE, scene, quality);
  const water = createWater(THREE, scene, quality, sky.uniforms);
  const ship = createShip(THREE, { quality });
  scene.add(ship.root);
  try { await ship.addCrew(V3, stage, CREW); } catch (e) { console.warn('crew failed to load', e); }
  const other = createShip(THREE, { quality, small: true }); other.root.visible = false; scene.add(other.root);
  const coasts = { dest: null, orig: null, key: '' };
  const coastGroup = new THREE.Group(); scene.add(coastGroup);
  const reefGroup = new THREE.Group(); scene.add(reefGroup); const reefs = new Map();
  const dolphins = createDolphins(THREE); scene.add(dolphins.group);
  const rain = createRain(THREE); scene.add(rain.mesh);
  scene.fog = new THREE.Fog('#9fd0f0', 200, 1900);
  const wall = new THREE.Group();
  const wallTex = canvasTex(THREE, 256, 128, (g, w, h) => { for (let i = 0; i < 20; i++) { const x = w * (0.1 + 0.8 * ((i * 37) % 100) / 100), y = h * (0.35 + 0.35 * ((i * 53) % 100) / 100), r = h * (0.25 + 0.25 * ((i * 17) % 100) / 100); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(40,46,60,0.8)'); gr.addColorStop(1, 'rgba(40,46,60,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } });
  const wallS = [];
  for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: wallTex, transparent: true, depthWrite: false, fog: false, opacity: 0 })); s.scale.set(1500, 620, 1); s.renderOrder = -6; wall.add(s); wallS.push(s); }
  scene.add(wall);

  const key = stage.lights.key, hemi = stage.lights.hemi, rim = stage.lights.rim;
  if (key.castShadow) { Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 140 }); key.shadow.camera.updateProjectionMatrix(); key.shadow.bias = -0.0006; }
  rim.intensity = 0.35;

  const camPos = new THREE.Vector3(0, 6, 20), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  let camInit = false, simT = 0, orbit = 0;
  let lastKey = '';
  const W = {
    sky, water, ship, other, camera, THREE, ready: true,
    // (re)build the scene content for a voyage
    setVoyage(vv) {
      const k = vv ? `${vv.legId}|${vv.seed}|${vv.fromStyle}|${vv.toStyle}` : 'menu';
      if (k === lastKey) return; lastKey = k;
      for (const r of reefs.values()) reefGroup.remove(r); reefs.clear();
      for (const c of [coasts.dest, coasts.orig]) if (c) coastGroup.remove(c);
      coasts.dest = coasts.orig = null;
      if (!vv) return;
      for (const h of vv.hazards) if (h.k === 'reef') { const r = createReef(THREE, h.r, h.id + vv.seed); r.position.set(h.x, 0, -h.y); reefGroup.add(r); reefs.set(h.id, r); }
      const sdx = -Math.sin(vv.bearing * DEG), sdz = Math.cos(vv.bearing * DEG);          // sea side of the destination coast = back toward the start
      coasts.dest = buildCoast(THREE, COAST_STYLES[vv.toStyle] || COAST_STYLES.mombasa, quality, vv.seed % 97);
      coasts.dest.position.set(vv.D.x, 0, -vv.D.y); coasts.dest.rotation.y = Math.atan2(sdx, sdz); coastGroup.add(coasts.dest);
      if (!vv.noOrig) {
      coasts.orig = buildCoast(THREE, COAST_STYLES[vv.fromStyle] || COAST_STYLES.mombasa, quality, (vv.seed + 5) % 97);
      const ox = Math.sin(vv.bearing * DEG) * -150, oz = -Math.cos(vv.bearing * DEG) * -150;   // 150 m behind the start
      coasts.orig.position.set(ox, 0, oz); coasts.orig.rotation.y = Math.atan2(-sdx, -sdz); coastGroup.add(coasts.orig);
      }
    },
    clearVoyage() { W.setVoyage(null); coastGroup.visible = false; },
    // RS: see director.js
    frame(dt, RS) {
      simT += dt;
      const t = RS.t ?? simT;
      coastGroup.visible = !!RS.coasts;
      const sh = RS.ship, X = sh.x, Z = -sh.y;
      const skyState = sky.update({ tod: RS.tod, camPos: camPos, lat: RS.lat ?? 8, storm: RS.storm, windFrom: RS.wind.from, t });
      const k = skyState.k, sd = skyState.sd, md = skyState.md, night = skyState.night;
      const light = clamp(k.amb * 1.25, 0.1, 1.15) * (1 - RS.storm * 0.35);
      // sea
      water.setSea({ windFrom: RS.wind.from, wind: RS.wind.speed, storm: RS.storm, light, fog: tmpFog(THREE, k, RS.storm), fogFar: 1900 - RS.storm * 900 });
      scene.fog.color.copy(water.uniforms.uFogCol.value); scene.fog.near = 200; scene.fog.far = 1900 - RS.storm * 900;
      // sun and moon light
      const useSun = sd.y > -0.05;
      const L = useSun ? sd : md;
      key.color.copy(useSun ? k.sun : new THREE.Color('#aab8ff')); key.intensity = (useSun ? k.keyI : 0.55 * clamp(md.y + 0.2, 0, 1)) * (1 - RS.storm * 0.7);
      hemi.color.copy(k.horizon).lerp(k.zenith, 0.5); hemi.groundColor.set('#1a3a44'); hemi.intensity = clamp(k.amb * 1.3, 0.25, 1.2);
      rim.color.copy(k.horizon); rim.intensity = 0.3 + 0.2 * (1 - night);
      // ship attitude on the waves
      const hr = sh.h * DEG, fx = Math.sin(hr), fz = -Math.cos(hr), rx = fz * -1, rz = fx;
      const h0 = water.height(X, Z, t), hb = water.height(X + fx * 6, Z + fz * 6, t), hs = water.height(X - fx * 6, Z - fz * 6, t), hp = water.height(X - rx * 1.8, Z - rz * 1.8, t), hq = water.height(X + rx * 1.8, Z + rz * 1.8, t);
      const pitch = Math.atan2(hb - hs, 12) / DEG, roll = Math.atan2(hq - hp, 3.6) / DEG;
      ship.root.position.set(X, h0 * 0.8 + 0.25, Z); ship.root.rotation.y = -hr;
      const dipP = sh.dipTot > 0 && sh.dip > 0 ? 1 - sh.dip / sh.dipTot : -1;
      ship.update(dt, { t, side: sh.side, ang: sh.ang, flap: sh.flap, stall: sh.stall, eff: sh.eff, dipP, reef: sh.reef, heel: sh.heel, roll: roll * 0.55, pitch: -pitch * 0.8, wind: RS.wind.speed, cargo: RS.cargo.frac, tint: RS.cargo.tint, poles: RS.cargo.poles, water: RS.water, helm: sh.helm, lamp: night * (1 - RS.storm * 0.3), sunBack: 0.1 + 0.2 * (1 - Math.abs(sd.y)) });
      // crew
      if (ship.humans.length) {
        const dip = dipP >= 0, hail = RS.landNear;
        ship.crewClip(0, 'idle_relaxed'); ship.crewClip(1, hail ? 'wave' : 'idle'); ship.crewClip(2, dip ? 'crouch_idle' : 'idle');
      }
      water.update(dt, t, camera.position, { x: X, z: Z, heading: sh.h, speed: sh.v });
      // hazards
      for (const h of RS.hazards) {
        if (h.k === 'reef') {
          const r = reefs.get(h.id); if (!r) continue;
          const d = Math.hypot(h.x - sh.x, h.y - sh.y), vis = clamp((500 - d) / 120, 0, 1);
          r.visible = vis > 0.01; const u = r.userData;
          u.shoal.material.opacity = 0.42 * vis * (0.4 + 0.6 * light); u.shoal2.material.opacity = 0.4 * vis * (0.4 + 0.6 * light);
          u.foam.forEach((f, i) => { const p = ((t * 0.35 + i / 3) % 1); f.scale.setScalar(0.8 + p * 0.6); f.material.opacity = (1 - p) * 0.5 * vis * (0.5 + 0.5 * light); });
        } else if (h.k === 'help') {
          other.root.visible = true; const hx = h.x, hz = -h.y, ho = water.height(hx, hz, t);
          other.root.position.set(hx, ho * 0.8 + 0.2, hz); other.root.rotation.y = -(h.ang ?? 0) * DEG;
          other.update(dt, { t, side: 1, ang: 80, flap: 1, stall: 0, eff: 0, dipP: -1, reef: 0.9, heel: 3, roll: 0, pitch: 0, wind: 2, cargo: 0.5, tint: '#b79a6a', poles: false, water: 0.2, helm: 0, lamp: night, sunBack: 0.1 });
          other.root.visible = Math.hypot(hx - X, hz - Z) < 700 && h.state !== 'helped' ? true : (h.state === 'helped' && Math.hypot(hx - X, hz - Z) < 700);
        }
      }
      if (!RS.hazards.some((h) => h.k === 'help')) other.root.visible = false;
      // dolphins when the sim says so
      if (RS.life) {
        const age = t - RS.life.t0, ds = dolphins.ds;
        ds.forEach((d, i) => {
          const a = age - i * 0.45, vis = a > 0 && a < 9; d.visible = vis; if (!vis) return;
          const side = i % 2 ? 1 : -1, ahead = -8 + a * (sh.v + 1.5) - 14 + i * 3, s = a % 2.4 / 2.4;
          const base = [X + fx * ahead + rx * (6 + i * 1.3) * side, Z + fz * ahead + rz * (6 + i * 1.3) * side];
          const y = Math.max(-0.4, Math.sin(s * Math.PI) * 2.0 - 0.6) + water.height(base[0], base[1], t);
          d.position.set(base[0] + fx * s * 3, y, base[1] + fz * s * 3); d.rotation.set(-Math.cos(s * Math.PI) * 0.9, -hr + Math.PI, 0, 'YXZ');
        });
      } else dolphins.ds.forEach((d) => { d.visible = false; });
      // squall wall and rain
      const w0 = (RS.wind.from) * DEG;
      wall.position.copy(camera.position);
      wallS.forEach((s, i) => { const az = w0 + (i - 3) * 0.17, el = 0.13 + 0.04 * Math.sin(i * 2.3); s.position.set(Math.sin(az), el, -Math.cos(az)).multiplyScalar(2100); s.material.opacity = clamp(RS.squallWall, 0, 1) * 0.85; s.material.color.setRGB(0.5 + 0.5 * light, 0.5 + 0.5 * light, 0.55 + 0.45 * light); });
      rain.update(t, camera.position, RS.storm, Math.sin((RS.wind.from + 180) * DEG) * 3, -Math.cos((RS.wind.from + 180) * DEG) * 3);
      // coast lamps at night
      for (const c of [coasts.dest, coasts.orig]) if (c && c.userData.lamps) { c.userData.lamps.material.opacity = clamp(night * 1.2, 0, 1); c.userData.lampT.material.opacity = clamp(night * 1.3, 0, 1); }
      // shadow light follows the ship
      key.position.set(X + L.x * 70, L.y * 70 + 4, Z + L.z * 70); key.target.position.set(X, 1, Z); key.target.updateMatrixWorld();

      // ---- camera -----------------------------------------------------------------------------------------------------------------------------
      let mode = RS.cam ?? 0;
      let tp, tl, fov = 52;
      const sb = Math.sin(hr), cb = -Math.cos(hr);
      const pz = camera.aspect < 1 ? 1 + (1 - camera.aspect) * 0.9 : 1;     // pull back on tall screens so the whole sail stays in frame
      if (RS.sight) {
        // look up at the guiding star from the stern
        const m = sky.starTarget(RS.lat ?? 8); m.getWorldPosition(tmpV); tmpV.sub(sky.group.position).normalize();
        tp = [X - fx * 5.5 + rx * 1.0, h0 + 3.1, Z - fz * 5.5 + rz * 1.0]; tl = [tp[0] + tmpV.x * 60, tp[1] + tmpV.y * 60 - 2.5, tp[2] + tmpV.z * 60]; fov = 58;
      } else if (mode === 0) { tp = [X - sb * 21 * pz + rx * 6, h0 * 0.6 + 7.4 + 2 * (pz - 1) * 5, Z - cb * 21 * pz + rz * 6]; tl = [X + sb * 9, 3.4, Z + cb * 9]; }
      else if (mode === 1) { tp = [X + rx * 21 * pz, h0 * 0.6 + 5.0 + 3 * (pz - 1), Z + rz * 21 * pz - fz * 2]; tl = [X + sb * 1.0, 3.8, Z + cb * 1.0]; fov = 50; }
      else if (mode === 2) { tp = [X + sb * 15 * pz + rx * 4, h0 * 0.6 + 2.6, Z + cb * 15 * pz + rz * 4]; tl = [X - sb * 1, 4.6, Z - cb * 1]; fov = 58; }
      else { orbit += dt * 0.12; const a = orbit; tp = [X + Math.sin(a) * 28 * pz, h0 * 0.6 + 6.5, Z + Math.cos(a) * 28 * pz]; tl = [X, 3.8, Z]; }
      if (RS.cam === 'port') { const a = Math.sin(t * 0.07) * 0.18; tp = [X - 20 * Math.cos(a), h0 * 0.6 + 6.5, Z + 11 + 20 * Math.sin(a)]; tl = [X + 22, 7.5, Z - 2]; fov = 62; }
      else if (RS.cam === 'menu') { const a = 0.9 + t * 0.045; tp = [X + Math.sin(a) * 24, h0 * 0.6 + 4.2, Z + Math.cos(a) * 24]; tl = [X, 4.6, Z]; fov = 50; }
      if (RS.lift) tl[1] -= RS.lift;
      const sm = camInit ? 1 - Math.exp(-dt * (RS.sight ? 2.5 : 3.2)) : 1; camInit = true;
      tmpV.set(tp[0], tp[1], tp[2]); camPos.lerp(tmpV, sm); tmpV2.set(tl[0], tl[1], tl[2]); camLook.lerp(tmpV2, sm);
      camera.position.copy(camPos);
      camera.position.y = Math.max(camera.position.y, water.height(camPos.x, camPos.z, t) + 1.0);
      camera.lookAt(camLook);
      // portrait phones get a wider view so the whole sail stays in frame
      const aspect = camera.aspect;
      const fv = aspect < 1 ? Math.min(78, fov * (1 + (1 - aspect) * 0.75)) : fov;
      if (Math.abs(camera.fov - fv) > 0.05) { camera.fov += (fv - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld();
      sky.group.position.copy(camera.position);
    },
    snapCamera() { camInit = false; },
    camPos,
  };
  return W;
}

function tmpFog(THREE, k, storm) {
  const c = k.horizon.clone(); c.lerp(new THREE.Color(0.35, 0.38, 0.42), storm * 0.7); return c;
}
export { COAST_STYLES };
