// The festival stall: a wooden table under an indigo cloth, a glazed blue tub of water with caustics on the floor, paper lanterns,
// a tray of spare poi, a lacquer bowl and a fan, a night street behind. All procedural. Units: metres, y up, water surface y = 0.
import * as THREE from '../vendor3d/three.js';
import { TAU, hash, clamp, woodCanvas, tubFloorCanvas, enamelCanvas, indigoCanvas, clothCanvas, stripeCanvas, lanternCanvas, glowCanvas, texOf, mk } from './tex.js';
import { TUB } from '../src/v3.js';

// one look per tank time of day: [morning, afternoon, evening, night]
export const LOOKS = [
  { sky: 0xbfd8f2, ground: 0x6b5238, hemi: 0.6, key: 0xfff0d6, keyI: 2.1, rim: 0xcfe0ff, rimI: 0.5, lan: 0.0, glow: 0.35, exp: 0.95, bg: 0x9fc4e6, fog: 0xb8cfe4, water: [0.10, 0.52, 0.70], wa: 0.24, floor: 0.62, lampI: 0.0, env: 0.5 },
  { sky: 0xf0cf9c, ground: 0x5a4028, hemi: 0.55, key: 0xffd9a0, keyI: 2.1, rim: 0xffb67a, rimI: 0.6, lan: 0.25, glow: 0.4, exp: 0.95, bg: 0xe7b88a, fog: 0xd9a77e, water: [0.07, 0.44, 0.66], wa: 0.26, floor: 0.58, lampI: 0.4, env: 0.5 },
  { sky: 0x4a4a92, ground: 0x2a1a22, hemi: 0.5, key: 0xffcf9a, keyI: 1.8, rim: 0x7aa0ff, rimI: 0.9, lan: 0.8, glow: 0.7, exp: 1.0, bg: 0x2c2a5e, fog: 0x2a2858, water: [0.05, 0.34, 0.56], wa: 0.3, floor: 0.55, lampI: 1.4, env: 0.4 },
  { sky: 0x1c1c52, ground: 0x15101a, hemi: 0.45, key: 0xffc690, keyI: 1.6, rim: 0x6a8cff, rimI: 1.1, lan: 1.0, glow: 1.0, exp: 1.05, bg: 0x10103a, fog: 0x131240, water: [0.04, 0.28, 0.50], wa: 0.32, floor: 0.5, lampI: 2.0, env: 0.35 },
];

const rrShape = (hx, hz, r) => {
  const s = new THREE.Shape(), x = hx, z = hz;
  s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
  s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
  return s;
};

const WATER_VS = `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `
precision highp float;
varying vec3 vW;
uniform float uTime; uniform vec4 uRip[14]; uniform vec3 uLP[3]; uniform vec3 uLC[3]; uniform vec3 uTint; uniform float uAlpha; uniform vec3 uSky; uniform float uKeyI; uniform vec3 uKeyDir;
void main(){
  vec2 p = vW.xz;
  // gentle swell + ripples (gradient of the height field)
  vec2 g = vec2(0.0);
  g += vec2(cos(p.x*9.0+uTime*0.9)*0.0035, sin(p.y*8.0-uTime*0.7)*0.0030);
  g += vec2(sin(p.y*17.0+p.x*5.0+uTime*1.3)*0.0016, cos(p.x*19.0-p.y*7.0-uTime*1.1)*0.0016);
  float rim = 0.0;
  for(int i=0;i<14;i++){
    vec4 r = uRip[i];
    if(r.w > 0.0){
      vec2 d = p - r.xy; float L = length(d) + 1e-4;
      float rad = r.z * 0.34;
      float x = L - rad;
      float env = exp(-x*x/0.0009) * (1.0 - r.z) * r.w;
      float s = cos(x*150.0) * env;
      g += d / L * s * 0.11;
      rim += env * 0.55;
    }
  }
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vW);
  float nv = max(dot(N, V), 0.0);
  float fr = pow(1.0 - nv, 3.0);
  vec3 R = reflect(-V, N);
  vec3 spec = vec3(0.0);
  for(int i=0;i<3;i++){
    vec3 Lv = uLP[i] - vW; float d = length(Lv); vec3 Ld = Lv / d;
    float s = pow(max(dot(R, Ld), 0.0), 140.0) * 0.55 + pow(max(dot(R, Ld), 0.0), 18.0) * 0.05;
    spec += uLC[i] * s / (0.4 + d * d * 0.35);
  }
  float sk = pow(max(dot(R, normalize(uKeyDir)), 0.0), 220.0) * uKeyI * 0.7;
  vec3 col = uTint + uSky * (0.05 + fr * 0.55) + spec + vec3(sk) + vec3(rim * 0.10);
  float a = clamp(uAlpha + fr * 0.5 + length(spec) * 0.35 + rim * 0.12, 0.0, 0.9);
  gl_FragColor = vec4(col, a);
}`;
const CAUSTIC_FS = `
precision highp float;
varying vec3 vW;
uniform float uTime; uniform float uAmt; uniform vec3 uCol;
float caus(vec2 p, float t){
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for(int n=0;n<4;n++){
    float tt = t * (1.0 - (3.5 / float(n+1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 7.0);
}
void main(){
  vec2 p = vW.xz * 7.5;
  float c = caus(p, uTime * 0.5 + 23.0) * 0.7 + caus(p * 0.7 + 3.0, uTime * 0.37 + 5.0) * 0.5;
  gl_FragColor = vec4(uCol * clamp(c, 0.0, 1.4) * uAmt, 1.0);
}`;

export function buildStall({ tier = 2 } = {}) {
  const root = new THREE.Group();
  const ud = { root, lanterns: [], lights: {}, mats: {} };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const wood = (o = {}) => { const t = texOf(woodCanvas({ seed: o.seed ?? 1, planks: o.planks ?? 5, base: o.base ?? [112, 70, 36], vertical: !!o.vertical }), { repeat: o.repeat ?? [1, 1] }); return std({ map: t, roughness: 0.7, metalness: 0, color: o.tint ?? 0xffffff }); };

  // ---- table with an indigo cloth, and the ground under it -----------------------------------------------------------------------
  const TY = TUB.rimY - 0.034;   // cloth surface a little under the rim top
  const clothTex = texOf(clothCanvas(512), { repeat: [5.4, 3.6] });
  const clothMat = std({ map: clothTex, roughness: 0.92, metalness: 0 });
  // the table top has a hole for the tub (shape y maps to -z, extrusion depth to +y)
  const tt = rrShape(1.35, 0.9, 0.04); tt.holes.push(new THREE.Path(rrShape(TUB.hx + TUB.rim - 0.003, TUB.hz + TUB.rim - 0.003, 0.072).getPoints(14).reverse()));
  const ttGeo = new THREE.ExtrudeGeometry(tt, { depth: 0.05, bevelEnabled: false, curveSegments: 10 });
  { const uv = ttGeo.attributes.uv, pos = ttGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 1.35) / 2.7, (pos.getY(i) + 0.9) / 1.8); }
  ttGeo.rotateX(-Math.PI / 2);
  const tableTop = new THREE.Mesh(ttGeo, clothMat);
  tableTop.position.set(0, TY - 0.05, 0); tableTop.receiveShadow = true; tableTop.castShadow = true; root.add(tableTop);
  // drooping cloth skirt on three sides + wooden legs
  const skirtMat = std({ map: texOf(clothCanvas(512), { repeat: [5, 1] }), roughness: 0.95, side: THREE.DoubleSide });
  for (const [x, z, w, r] of [[0, 0.9, 2.7, 0], [0, -0.9, 2.7, 0], [1.35, 0, 1.8, Math.PI / 2], [-1.35, 0, 1.8, Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.6, 12, 1), skirtMat);
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 7) * 0.012);
    m.position.set(x, TY - 0.33, z); m.rotation.y = r; root.add(m);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), std({ map: texOf(woodCanvas({ seed: 9, planks: 9, base: [64, 52, 44] }), { repeat: [5, 5] }), roughness: 0.9, color: 0x8a8a96 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.98; ground.receiveShadow = true; root.add(ground);

  // ---- the tub ---------------------------------------------------------------------------------------------------------------
  const { hx, hz, rim, rimY, floorY } = TUB;
  const tub = new THREE.Group(); root.add(tub);
  // floor
  const floorMat = std({ map: texOf(tubFloorCanvas(1024), { repeat: [1, 0.8] }), roughness: 0.35, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * hx, 2 * hz), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = floorY; floor.receiveShadow = true; tub.add(floor);
  // walls (enamel, glossy)
  const wallMat = std({ map: texOf(enamelCanvas(), { repeat: [4, 1] }), roughness: 0.22, metalness: 0.0, side: THREE.DoubleSide, envMapIntensity: 1.2 });
  const wh = rimY - floorY;
  for (const [x, z, w, r] of [[0, hz, 2 * hx, Math.PI], [0, -hz, 2 * hx, 0], [hx, 0, 2 * hz, -Math.PI / 2], [-hx, 0, 2 * hz, Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, wh), wallMat);
    m.position.set(x, floorY + wh / 2, z); m.rotation.y = r; m.receiveShadow = true; tub.add(m);
  }
  // wooden frame (top rim with a bevel)
  const frameShape = rrShape(hx + rim, hz + rim, 0.075); frameShape.holes.push(new THREE.Path(rrShape(hx, hz, 0.03).getPoints(14).reverse()));
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.055, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 10 });
  frameGeo.rotateX(-Math.PI / 2);
  const frameMat = wood({ seed: 3, planks: 3, base: [136, 84, 44], repeat: [1, 1] });
  frameMat.roughness = 0.5;
  const frame = new THREE.Mesh(frameGeo, frameMat); frame.position.y = rimY - 0.055 - 0.004; frame.castShadow = true; frame.receiveShadow = true; tub.add(frame);
  // brass corner studs
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a845, roughness: 0.3, metalness: 0.9 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 12, 8), brass);
    s.scale.y = 0.55; s.position.set(sx * (hx + rim * 0.55), rimY + 0.0025, sz * (hz + rim * 0.55)); tub.add(s);
  }

  // caustics on the floor
  const causMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0.5 }, uCol: { value: new THREE.Color(0.55, 0.85, 1.0) } },
    vertexShader: WATER_VS, fragmentShader: CAUSTIC_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const caus = new THREE.Mesh(new THREE.PlaneGeometry(2 * hx, 2 * hz), causMat);
  caus.rotation.x = -Math.PI / 2; caus.position.y = floorY + 0.0015; caus.renderOrder = 0; tub.add(caus);
  // soft blob shadows (low tier only; the shadow map does it otherwise)
  const blobTex = texOf((() => { const c = mk(64, 64), g = c.getContext('2d'); const rg = g.createRadialGradient(32, 32, 2, 32, 32, 30); rg.addColorStop(0, 'rgba(0,10,30,0.55)'); rg.addColorStop(1, 'rgba(0,10,30,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64); return c; })(), { wrap: false });
  const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: false }), 32);
  blobs.frustumCulled = false; blobs.renderOrder = 0; blobs.visible = false; tub.add(blobs);

  // water surface
  const lp = [new THREE.Vector3(-0.7, 0.6, -0.5), new THREE.Vector3(0.7, 0.6, -0.5), new THREE.Vector3(0, 0.7, 0.6)];
  const lc = [new THREE.Color(1, 0.62, 0.3), new THREE.Color(1, 0.55, 0.25), new THREE.Color(1, 0.7, 0.4)];
  const rip = Array.from({ length: 14 }, () => new THREE.Vector4(0, 0, 1, 0));
  const waterMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uRip: { value: rip }, uLP: { value: lp }, uLC: { value: lc }, uTint: { value: new THREE.Color(0.1, 0.45, 0.62) },
      uAlpha: { value: 0.28 }, uSky: { value: new THREE.Color(0.4, 0.5, 0.9) }, uKeyI: { value: 2 }, uKeyDir: { value: new THREE.Vector3(-0.4, 1, 0.5) },
    },
    vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2 * hx + 0.004, 2 * hz + 0.004, 1, 1), waterMat);
  water.rotation.x = -Math.PI / 2; water.renderOrder = 2; tub.add(water);

  // ---- table props -----------------------------------------------------------------------------------------------------------------
  const props = new THREE.Group(); root.add(props);
  // a wooden tray with spare poi
  { const tray = new THREE.Group();
    const tm = wood({ seed: 8, planks: 2, base: [150, 100, 58], repeat: [1, 1] });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.22), tm); tray.add(base);
    for (const [w, d, x, z] of [[0.34, 0.012, 0, 0.11], [0.34, 0.012, 0, -0.11], [0.012, 0.22, 0.17, 0], [0.012, 0.22, -0.17, 0]]) { const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), tm); e.position.set(x, 0.014, z); tray.add(e); }
    const ringM = new THREE.MeshStandardMaterial({ color: 0xd8362a, roughness: 0.35 });
    const paperM = new THREE.MeshStandardMaterial({ color: 0xf6efdc, roughness: 0.85, transparent: true, opacity: 0.93 });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.003, 8, 36), ringM); t.rotation.x = Math.PI / 2; g.add(t);
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.06, 28), paperM); p.rotation.x = -Math.PI / 2; p.position.y = 0.0005; g.add(p);
      g.position.set(-0.06 + (i % 2) * 0.1, 0.012 + i * 0.006, -0.03 + (i % 3) * 0.04); g.rotation.y = i * 0.7;
      tray.add(g);
    }
    tray.position.set(-0.88, TY + 0.007, -0.52); tray.rotation.y = 0.25; props.add(tray); tray.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
  // red lacquer bowl with water (the player's okaiko)
  { const pts = [[0.001, 0], [0.05, 0], [0.058, 0.008], [0.1, 0.045], [0.112, 0.075], [0.118, 0.082]].map(([r, y]) => new THREE.Vector2(r, y));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), new THREE.MeshPhysicalMaterial({ color: 0xc02a1a, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide }));
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.108, 32), new THREE.MeshStandardMaterial({ color: 0x4ab0cc, roughness: 0.05, transparent: true, opacity: 0.8 }));
    w.rotation.x = -Math.PI / 2; w.position.y = 0.062; bowl.add(w);
    bowl.position.set(0.93, TY, -0.5); bowl.castShadow = true; props.add(bowl); }
  // paper fan (uchiwa)
  { const fan = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshStandardMaterial({ map: texOf(stripeCanvas({ a: '#f2e8d0', b: '#cf3a2a', n: 10 }), { wrap: false }), roughness: 0.9, side: THREE.DoubleSide }));
    face.rotation.x = -Math.PI / 2; fan.add(face);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, 0.16), new THREE.MeshStandardMaterial({ color: 0xc8a064, roughness: 0.6 })); h.position.set(0, 0, 0.16); fan.add(h);
    fan.position.set(0.88, TY + 0.004, 0.5); fan.rotation.y = -0.6; fan.traverse((o) => { if (o.isMesh) { o.castShadow = true; } }); props.add(fan); }
  // a ramune-style glass bottle
  { const pts = [[0.001, 0], [0.026, 0], [0.028, 0.1], [0.02, 0.14], [0.011, 0.17], [0.012, 0.19], [0.014, 0.195]].map(([r, y]) => new THREE.Vector2(r, y));
    const b = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), new THREE.MeshPhysicalMaterial({ color: 0x8fe0c0, roughness: 0.04, transparent: true, opacity: 0.55, clearcoat: 1 }));
    b.position.set(-0.93, TY, 0.45); b.castShadow = true; props.add(b); }

  // ---- lanterns on a rail overhead, lit from inside -----------------------------------------------------------------------------
  const lanTex = texOf(lanternCanvas(), { wrap: false });
  const lanGeo = (() => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; const y = (t - 0.5) * 0.3, r = 0.075 * Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * t)), 0.6) + 0.012; pts.push(new THREE.Vector2(r, y)); } return new THREE.LatheGeometry(pts, 20); })();
  const glowTex = texOf(glowCanvas(128), { wrap: false });
  const lanPos = [[-0.62, 0.62, -0.62], [0.0, 0.7, -0.78], [0.62, 0.62, -0.62], [-1.12, 0.52, 0.1], [1.12, 0.52, 0.1], [-0.4, 0.66, 0.78], [0.5, 0.66, 0.8]];
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.7 }));
  rail.rotation.z = Math.PI / 2; rail.position.set(0, 0.84, -0.8); root.add(rail);
  lanPos.forEach((p, i) => {
    const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]);
    const m = new THREE.MeshStandardMaterial({ map: lanTex, emissive: new THREE.Color(1.0, 0.55, 0.2), emissiveMap: lanTex, emissiveIntensity: 1.0, roughness: 0.8, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(lanGeo, m); g.add(mesh);
    const cap = new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.6 });
    for (const y of [0.155, -0.155]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.022, 20), cap); c.position.y = y; g.add(c); }
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.4, 4), cap); cord.position.y = 0.36; g.add(cord);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa860, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    spr.scale.setScalar(0.62); g.add(spr);
    g.userData = { mat: m, spr, i, base: p.slice() };
    root.add(g); ud.lanterns.push(g);
  });

  // lights
  const hemi = new THREE.HemisphereLight(0x6070c0, 0x181018, 0.6);
  const key = new THREE.DirectionalLight(0xffd8a8, 2.2); key.position.set(-0.8, 2.2, 1.0);
  Object.assign(key.shadow.camera, { left: -0.75, right: 0.75, top: 0.62, bottom: -0.62, near: 0.5, far: 5 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.004; key.shadow.radius = 3; key.shadow.mapSize.set(2048, 2048);
  const rimL = new THREE.DirectionalLight(0x6a90ff, 0.9); rimL.position.set(1.5, 1.2, -2);
  const warmA = new THREE.PointLight(0xff9a4a, 1.6, 4, 2); warmA.position.set(-0.55, 0.5, -0.45);
  const warmB = new THREE.PointLight(0xff8a3a, 1.4, 4, 2); warmB.position.set(0.55, 0.5, -0.4);
  root.add(hemi, key, key.target, rimL, warmA, warmB);
  Object.assign(ud, { tub, floor, floorMat, water, waterMat, causMat, blobs, rip, lp, lc, hemi, key, rimL, warmA, warmB, clothMat, tableTop, props, TY });
  return ud;
}

export function applyLook(ud, look, t = 0) {
  const L = LOOKS[look] ?? LOOKS[3];
  ud.hemi.color.setHex(L.sky); ud.hemi.groundColor.setHex(L.ground); ud.hemi.intensity = L.hemi;
  ud.key.color.setHex(L.key); ud.key.intensity = L.keyI;
  ud.rimL.color.setHex(L.rim); ud.rimL.intensity = L.rimI;
  ud.warmA.intensity = L.lampI; ud.warmB.intensity = L.lampI * 0.9;
  ud.waterMat.uniforms.uTint.value.setRGB(L.water[0], L.water[1], L.water[2]);
  ud.waterMat.uniforms.uAlpha.value = L.wa;
  ud.waterMat.uniforms.uSky.value.setHex(L.sky);
  ud.waterMat.uniforms.uKeyI.value = L.keyI;
  ud.floorMat.color.setScalar(L.floor);
  ud.causMat.uniforms.uAmt.value = look === 0 ? 0.62 : look === 1 ? 0.55 : look === 2 ? 0.42 : 0.34;
  for (const g of ud.lanterns) {
    const lit = L.lan;
    g.userData.mat.emissiveIntensity = 0.12 + 1.15 * lit;
    g.userData.spr.material.opacity = 0.07 + 0.78 * L.glow * (0.35 + 0.65 * lit);
  }
  void t;
  return L;
}
export const clampN = clamp;
