// The buzkashi field as a real lit 3D scene (view3d stage): steppe sky and ridges (scenery kit), a limed field with the circle and the post, rope fence,
// felt-rugged banks with a 3D crowd (crowd3d), yurts, floodlights, eight horse3d horses with costumed riders, the leather sack and dust.
// Presentation only: sync() reads the sim state each frame and never writes to it. The scene is rendered into its own canvas and blitted behind the
// 2D HUD by scene.js; with no WebGL2 (or after a lost context) the game falls back to the flat 2D scene.
import { createStage, buildScenery, createCrowd3d, THREE } from '../vendor3d/index.js';
import { createRider3, spring, sm, lerp, clamp } from './rider3.js';
import { makeSack } from './costume.js';
import { FIELD, FLAG, CIRCLE, CENTRE, FLAG_RING, FLAG_WIND, SCOOP_REACH } from '../src/consts.js';

const { Vector3, Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, CylinderGeometry, BoxGeometry, SphereGeometry, TorusGeometry, PlaneGeometry,
  CanvasTexture, SRGBColorSpace, RepeatWrapping, InstancedMesh, Object3D, Color, Sprite, SpriteMaterial, AdditiveBlending, RingGeometry, DoubleSide, Matrix4, Quaternion } = THREE;
const TAU = Math.PI * 2;
const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// team colours: blue chapans with gold stripes against crimson chapans with cream stripes (the HUD dots use the same blue and red)
export const TEAMS = [
  { kit: '#2f67c4', accent: '#f0c352', dark: '#173a78', trim: '#f0c352', trim2: '#f6dc8e', blanket: '#2a64bd', turban: '#efe6d2' },
  { kit: '#c43c32', accent: '#f4e8c8', dark: '#72201b', trim: '#f4e8c8', trim2: '#f2d08c', blanket: '#d4463c', turban: '#f1e6cc' },
];
const COATS = ['bay', 'chestnut', 'grey', 'darkbay', 'palomino', 'black', 'buckskin', 'liver'];

// look index (consts.ROUNDS look) -> sky/ground/time of day, lighting, fog
const LOOKS = [
  { name: 'Dawn', tod: 'dawn', sky: 'sky-peach', bd: 'bd-steppe', ground: 'gr-steppe', band: 'band-hills-green', season: 'summer', light: 'evening', fog: 0xe9c9a4, key: 0xffcf9a, keyI: 2.4, hemi: 0.8, exp: 0.95, snow: 0, night: 0 },
  { name: 'Day', tod: 'day', sky: 'sky-day', bd: 'bd-steppe', ground: 'gr-steppe', band: 'band-hills-green', season: 'summer', light: 'day', fog: 0xc6d7e4, key: 0xfff1da, keyI: 3.0, hemi: 0.95, exp: 1.0, snow: 0, night: 0 },
  { name: 'Afternoon', tod: 'day', sky: 'sky-golden', bd: 'bd-steppe', ground: 'gr-steppe', band: 'band-hills-green', season: 'autumn', light: 'evening', fog: 0xe8c690, key: 0xffc27a, keyI: 3.1, hemi: 0.75, exp: 1.0, snow: 0, night: 0 },
  { name: 'Winter', tod: 'day', sky: 'sky-overcast', bd: 'bd-alpine-snow', ground: 'gr-snow', band: 'band-snow-pines', season: 'winter', light: 'day', fog: 0xd2dde8, key: 0xe8f0ff, keyI: 2.2, hemi: 1.1, exp: 0.98, snow: 1, night: 0 },
  { name: 'Floodlit', tod: 'night', sky: 'sky-dusk', bd: 'bd-steppe', ground: 'gr-steppe', band: 'band-hills-green', season: 'summer', light: 'night', fog: 0x141c36, key: 0xfff0d2, keyI: 2.6, hemi: 0.7, exp: 1.05, snow: 0, night: 1 },
];
export const LOOK_COUNT = LOOKS.length;

function rrPath(hw, hh, r, n = 16) {
  const pts = [], arc = (cx, cz, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push(new Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r)); } };
  arc(hw - r, hh - r, 0); arc(-hw + r, hh - r, Math.PI / 2); arc(-hw + r, -hh + r, Math.PI); arc(hw - r, -hh + r, Math.PI * 1.5);
  return pts;
}
function canvas2d(w, h) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; }

export async function createField3d({ base, quality = 'medium', groundCanvas, sceneryBase, riderMax = 8 } = {}) {
  const doc = globalThis.document;
  const host = doc.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:8px;height:8px;overflow:hidden;pointer-events:none;visibility:hidden';
  doc.body.appendChild(host);
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:8px;height:8px;display:block';
  host.appendChild(canvas);
  const stage = createStage({ canvas, container: host, quality, dprCap: 2, shadows: true, lighting: 'day', fov: 40, shadowSize: 17, preserveDrawingBuffer: false });
  if (!stage.supported) { host.remove(); return null; }
  const { scene, renderer, camera } = stage;
  const tier = { name: quality };
  stage.lights.key.shadow.camera.far = 120; stage.lights.key.shadow.camera.near = 1;
  stage._shadowOffset.set(-14, 26, 16);
  const F = { ok: true, lost: false, canvas, stage, quality, riders: [], ready: false, look: -1, sack: null, host, time: 0, dpr: 1, cost: { ema: 0, n: 0 } };
  stage.onContextLost(() => { F.lost = true; });
  stage.onContextRestored(() => { F.lost = false; F.sized = ''; });

  // ---------------------------------------------------------------------------------------------------- field surface
  const fieldGroup = new Group(); scene.add(fieldGroup);
  const surfaceMat = new MeshStandardMaterial({ roughness: 0.96, metalness: 0 });
  const surface = new Mesh(new PlaneGeometry(FIELD.x1 - FIELD.x0 + 0.01, FIELD.y1 - FIELD.y0 + 0.01), surfaceMat);
  surface.rotation.x = -Math.PI / 2; surface.position.set(0, 0.012, 0); surface.receiveShadow = true; fieldGroup.add(surface);
  // soft verge: a slightly larger darker plane under the field blends into the scenery ground
  const verge = new Mesh(new PlaneGeometry(FIELD.x1 - FIELD.x0 + 9, FIELD.y1 - FIELD.y0 + 9), new MeshBasicMaterial({ map: radialAlpha(), transparent: true, depthWrite: false, color: 0x2a2012, opacity: 0.45 }));
  verge.rotation.x = -Math.PI / 2; verge.position.y = 0.006; fieldGroup.add(verge);
  function radialAlpha() {
    const c = canvas2d(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 22, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
  }
  function fieldTexture(lookIdx) {
    if (!groundCanvas) return null;
    const src = groundCanvas(lookIdx);
    if (!src) return null;
    const c = canvas2d(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const ppm = src.width / (FIELD.x1 - FIELD.x0);
    const X = (x) => (x - FIELD.x0) * ppm, Y = (y) => (FIELD.y1 - y) * ppm;
    // lime: scoring circle (solid, with dusty edges), an inner dashed ring, the centre ring and the half way line
    const chalk = (cx, cy, R, w, a, dash) => {
      g.save(); g.lineCap = 'butt'; g.strokeStyle = `rgba(255,252,240,${a})`; g.lineWidth = w;
      if (dash) g.setLineDash([w * 3, w * 2.4]);
      g.beginPath(); g.arc(X(cx), Y(cy), R * ppm, 0, TAU); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < R * 24; i++) {
        const a2 = hash(i + R * 7) * TAU, d = (hash(i * 3 + 1) - 0.5) * w * 1.6, rr = R * ppm + d;
        g.fillStyle = `rgba(255,250,236,${0.12 + hash(i + 9) * 0.2})`; g.beginPath(); g.arc(X(cx) + Math.cos(a2) * rr, Y(cy) - Math.sin(a2) * rr, 0.6 + hash(i + 5) * 1.4, 0, TAU); g.fill();
      }
      g.restore();
    };
    const fill = g.createRadialGradient(X(CIRCLE.x), Y(CIRCLE.y), 0, X(CIRCLE.x), Y(CIRCLE.y), CIRCLE.r * ppm);
    fill.addColorStop(0, 'rgba(255,252,240,0.05)'); fill.addColorStop(0.85, 'rgba(255,252,240,0.16)'); fill.addColorStop(1, 'rgba(255,252,240,0.0)');
    g.fillStyle = fill; g.beginPath(); g.arc(X(CIRCLE.x), Y(CIRCLE.y), CIRCLE.r * ppm * 1.1, 0, TAU); g.fill();
    chalk(CIRCLE.x, CIRCLE.y, CIRCLE.r, ppm * 0.3, 0.95, false);
    chalk(CIRCLE.x, CIRCLE.y, CIRCLE.r * 0.7, ppm * 0.12, 0.5, true);
    chalk(CENTRE.x, CENTRE.y, CENTRE.r, ppm * 0.12, 0.6, true);
    chalk(FLAG.x, FLAG.y, 1.3, ppm * 0.2, 0.7, false);
    g.fillStyle = 'rgba(255,252,240,0.12)'; g.fillRect(X(FIELD.x0 + 1), Y(0) - 1, (FIELD.x1 - FIELD.x0 - 2) * ppm, 2);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  // a tileable micro relief (clods, grass blades) so the light rakes across the ground instead of a flat print
  function detailTexture() {
    const c = canvas2d(256, 256), g = c.getContext('2d');
    let a = 12345; const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * 256, y = rnd() * 256, r = 1 + rnd() * 5, v = rnd() > 0.5 ? 255 : 0;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, `rgba(${v},${v},${v},0.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(16, 27); t.anisotropy = 4;
    return t;
  }
  surfaceMat.bumpMap = detailTexture(); surfaceMat.bumpScale = 0.6;

  // ---------------------------------------------------------------------------------------------------- rope fence, posts
  const fenceGroup = new Group(); scene.add(fenceGroup);
  {
    const hw = FIELD.x1 + 0.35, hh = FIELD.y1 + 0.35;
    const path = rrPath(hw, hh, 2.4);
    const curve = new THREE.CatmullRomCurve3(path, true, 'catmullrom', 0.2);
    const ropeM = new MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
    for (const y of [0.62, 1.0]) {
      const pts = curve.getPoints(260).map((p, i, a) => new Vector3(p.x, y - 0.1 * Math.abs(Math.sin(i / a.length * 60)) * 0.5, p.z));
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 520, 0.028, 6, true);
      const m = new Mesh(tube, ropeM); m.castShadow = true; fenceGroup.add(m);
    }
    const posts = [];
    const L = curve.getLength(), n = Math.round(L / 3.6);
    for (let i = 0; i < n; i++) posts.push(curve.getPointAt(i / n));
    const postGeo = new CylinderGeometry(0.06, 0.08, 1.15, 8); postGeo.translate(0, 0.575, 0);
    const im = new InstancedMesh(postGeo, new MeshStandardMaterial({ color: 0x4a3018, roughness: 0.8 }), n);
    const flagGeo = new PlaneGeometry(0.5, 0.26); flagGeo.translate(0.25, 0, 0);
    const fl = new InstancedMesh(flagGeo, new MeshStandardMaterial({ color: 0xffffff, side: DoubleSide, roughness: 0.8 }), n);
    const o = new Object3D(), col = new Color();
    posts.forEach((p, i) => {
      o.position.set(p.x, 0, p.z); o.rotation.set(0, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      o.position.set(p.x, 1.02, p.z); o.rotation.set(0, hash(i) * 6.28, 0); o.updateMatrix(); fl.setMatrixAt(i, o.matrix);
      fl.setColorAt(i, col.set(i % 2 ? TEAMS[0].blanket : TEAMS[1].blanket));
    });
    im.castShadow = true; fenceGroup.add(im, fl);
    F.pennants = fl;
  }

  // ---------------------------------------------------------------------------------------------------- the post and its rings
  const flag = new Group(); flag.position.set(FLAG.x, 0, -FLAG.y); scene.add(flag);
  const pennantGeo = new PlaneGeometry(1.5, 0.8, 14, 4); pennantGeo.translate(0.75, 0, 0);
  const pennantBase = Float32Array.from(pennantGeo.attributes.position.array);
  const pennantMat = new MeshStandardMaterial({ color: 0xe8452c, side: DoubleSide, roughness: 0.7 });
  {
    const mound = new Mesh(new CylinderGeometry(0.7, 1.1, 0.22, 20), new MeshStandardMaterial({ color: 0x7a6040, roughness: 1 })); mound.position.y = 0.11; mound.receiveShadow = true; flag.add(mound);
    const pole = new Mesh(new CylinderGeometry(0.045, 0.06, 5.6, 10), new MeshStandardMaterial({ color: 0xece0c4, roughness: 0.6 })); pole.position.y = 2.8; pole.castShadow = true; flag.add(pole);
    const ball = new Mesh(new SphereGeometry(0.1, 12, 10), new MeshStandardMaterial({ color: 0xd9a638, metalness: 0.6, roughness: 0.35 })); ball.position.y = 5.65; flag.add(ball);
    const pen = new Mesh(pennantGeo, pennantMat); pen.position.set(0.05, 5.1, 0); pen.castShadow = true; flag.add(pen);
    flag.userData.pen = pen;
  }
  // winding ring (fills as a rider sweeps round it) and the dashed guide ring
  const windMat = new MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.95, side: DoubleSide, depthWrite: false });
  let windMesh = null, windQ = -1;
  const guideRing = new Mesh(new RingGeometry(FLAG_RING * 0.55 - 0.07, FLAG_RING * 0.55 + 0.07, 96, 1), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide }));
  guideRing.rotation.x = -Math.PI / 2; guideRing.position.set(FLAG.x, 0.03, -FLAG.y); scene.add(guideRing);
  const roundedRing = new Mesh(new RingGeometry(0.78, 0.9, 40), new MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide }));
  roundedRing.rotation.x = -Math.PI / 2; roundedRing.visible = false; scene.add(roundedRing);

  // ---------------------------------------------------------------------------------------------------- banks, rugs, yurts, floodlights
  const props = new Group(); scene.add(props);
  function rugTexture() {
    const c = canvas2d(256, 128), g = c.getContext('2d');
    const pal = ['#8e1f1f', '#1d3f6e', '#d9b25a', '#2f5a3a', '#e8dcc0', '#5a2d46'];
    g.fillStyle = '#7a2a22'; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 8; i++) {
      const x = i * 32 + 16;
      g.fillStyle = pal[i % pal.length]; g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 14, 64); g.lineTo(x, 116); g.lineTo(x - 14, 64); g.closePath(); g.fill();
      g.strokeStyle = '#f0e4c0'; g.lineWidth = 2; g.stroke();
      g.fillStyle = pal[(i + 2) % pal.length]; g.beginPath(); g.arc(x, 64, 6, 0, TAU); g.fill();
    }
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 122, 256, 6);
    const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(5, 1); t.anisotropy = 4; return t;
  }
  const rugM = new MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 });
  const earthM = new MeshStandardMaterial({ color: 0x8a7352, roughness: 1 });
  // bank: stepped earth with rugs. side: +1 east (x>0, faces -x), -1 west, +2 north end (flag), -2 south end (circle)
  function bank(side, rows, len, rise, rowDepth, gap) {
    const g = new Group();
    for (let r = 0; r < rows; r++) {
      const h = rise * (r + 1);
      const box = new Mesh(new BoxGeometry(len, h, rowDepth), r === rows - 1 ? earthM : rugM);
      box.position.set(0, h / 2, gap + r * rowDepth + rowDepth / 2); box.receiveShadow = true; box.castShadow = true; g.add(box);
      const top = new Mesh(new BoxGeometry(len, 0.04, rowDepth - 0.02), earthM); top.position.set(0, h + 0.02, gap + r * rowDepth + rowDepth / 2); g.add(top);
    }
    return g;
  }
  const BANKS = [
    // x, z, yaw (three yaw: forward = (sin, cos) -> faces the field), rows, perRow, width
    { x: FIELD.x1 + 1.5, z: 0, yaw: -Math.PI / 2, len: 52, rows: 4, perRow: 30 },
    { x: FIELD.x0 - 1.5, z: 0, yaw: Math.PI / 2, len: 52, rows: 4, perRow: 30 },
    { x: 0, z: -(FIELD.y1 + 1.5), yaw: 0, len: 30, rows: 3, perRow: 15 },
    { x: 0, z: FIELD.y1 + 1.5, yaw: Math.PI, len: 30, rows: 3, perRow: 15 },
  ];
  for (const b of BANKS) {
    const g = bank(0, b.rows, b.len, 0.42, 0.95, 0.1);
    // the bank group faces +Z at yaw 0 meaning rows go +Z; the stand faces the field, rows go AWAY from the field
    g.rotation.y = b.yaw + Math.PI;
    g.position.set(b.x, 0, b.z);
    props.add(g);
  }
  // yurts and cloth bunting beyond the banks
  const yurtWall = new MeshStandardMaterial({ color: 0xe9e1cf, roughness: 1 });
  const yurtRoof = new MeshStandardMaterial({ color: 0xf3ecdc, roughness: 1 });
  const yurtDoor = new MeshStandardMaterial({ color: 0x7a2a22, roughness: 0.9 });
  const yurtBand = new MeshStandardMaterial({ color: 0x1d4f8a, roughness: 0.9 });
  function yurt(x, z, s = 1, rot = 0) {
    const g = new Group();
    const w = new Mesh(new CylinderGeometry(3 * s, 3 * s, 1.9 * s, 28), yurtWall); w.position.y = 0.95 * s; w.castShadow = true; w.receiveShadow = true; g.add(w);
    const band = new Mesh(new CylinderGeometry(3.02 * s, 3.02 * s, 0.22 * s, 28), yurtBand); band.position.y = 1.7 * s; g.add(band);
    const roof = new Mesh(new CylinderGeometry(0.0, 3.3 * s, 1.5 * s, 28), yurtRoof); roof.position.y = (1.9 + 0.75) * s; roof.castShadow = true; g.add(roof);
    const crown = new Mesh(new CylinderGeometry(0.5 * s, 0.7 * s, 0.25 * s, 12), new MeshStandardMaterial({ color: 0x4a3018, roughness: 1 })); crown.position.y = (1.9 + 1.55) * s; g.add(crown);
    const door = new Mesh(new BoxGeometry(1.0 * s, 1.5 * s, 0.1), yurtDoor); door.position.set(0, 0.75 * s, 3.0 * s); g.add(door);
    g.position.set(x, 0, z); g.rotation.y = rot; props.add(g);
  }
  F.yurtSpots = [[-30, -28, 1], [-27, 8, 1.1], [31, -18, 1], [29, 22, 1.05], [-10, 46, 1.1], [12, -46, 1], [-34, 34, 1], [36, 4, 0.9]];
  for (const [x, z, s] of F.yurtSpots) yurt(x, z, s, Math.atan2(-x, -z));

  // floodlight pylons (lit lamps and glow sprites show in the Floodlit look)
  const lampGroup = new Group(); lampGroup.visible = false; scene.add(lampGroup);
  {
    const poleM = new MeshStandardMaterial({ color: 0x555a63, metalness: 0.5, roughness: 0.5 });
    const lampM = new MeshBasicMaterial({ color: 0xfff6dc });
    const glowTex = (() => { const c = canvas2d(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.3, 'rgba(255,240,200,0.5)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; })();
    for (const [x, z] of [[-22, -20], [22, -20], [-22, 20], [22, 20], [-22, 0], [22, 0]]) {
      const pole = new Mesh(new CylinderGeometry(0.12, 0.2, 12, 8), poleM); pole.position.set(x, 6, z); pole.castShadow = true; lampGroup.add(pole);
      const head = new Mesh(new BoxGeometry(2.4, 0.9, 0.3), lampM); head.position.set(x, 12.2, z); head.lookAt(0, 4, 0); lampGroup.add(head);
      const gl = new Sprite(new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.95, fog: false })); gl.scale.set(9, 9, 1); gl.position.set(x, 12.2, z); lampGroup.add(gl);
    }
  }

  // ---------------------------------------------------------------------------------------------------- scenery (per look)
  F.scenery = null;
  let sceneryToken = 0;
  function applyLook(i) {
    const L = LOOKS[clamp(i | 0, 0, LOOKS.length - 1)];
    F.look = i;
    stage.setLighting(L.light, { key: L.key, keyI: L.keyI, hemi: L.hemi, exposure: L.exp, sky: L.fog, fog: L.fog });
    stage.setSky(L.fog, L.fog, { near: 70, far: 190 });
    surfaceMat.map = fieldTexture(i); surfaceMat.bumpScale = LOOKS[i] && LOOKS[i].snow ? 0.25 : 0.7; surfaceMat.color.set(0xffffff); surfaceMat.needsUpdate = true;
    lampGroup.visible = !!L.night;
    stage.lights.rim.intensity = L.night ? 1.0 : 1.4;
    const tok = ++sceneryToken;
    const layers = [
      { t: 'sky', id: L.sky },
      { t: 'backdrop', id: L.bd },
      { t: 'ground', id: L.ground, size: 170, repeat: 22, grade: L.season === 'winter' ? undefined : 'steppe' },
      { t: 'band', id: L.band, r: 98, h: 17, grade: L.season === 'winter' ? undefined : 'steppe' },
      { t: 'cutouts', id: 'tr-broad-tree', count: 5, r: [58, 80], scale: [8, 12], seed: 8, sway: 0.5, arc: [0, 360] },
    ];
    if (L.snow) layers.push({ t: 'snow', count: 320 });
    const sc = buildScenery({ layers, culture: 'central-asian-steppe', timeOfDay: L.tod, season: L.season, quality: tier.name, base: sceneryBase, radius: 140 });
    sc.ready.then(() => {
      if (tok !== sceneryToken) { sc.dispose(); return; }
      if (F.scenery) { scene.remove(F.scenery.group); F.scenery.dispose(); }
      F.scenery = sc; scene.add(sc.group); stage.invalidate();
    }).catch((e) => { console.warn('scenery', e && e.message); });
  }
  F.applyLook = applyLook;

  // ---------------------------------------------------------------------------------------------------- crowd
  const crowdStands = BANKS.map((b) => {
    const away = [-Math.sin(b.yaw), -Math.cos(b.yaw)];             // direction away from the field
    return { center: [b.x + away[0] * 0.55, 0.42, b.z + away[1] * 0.55], yaw: b.yaw, rows: b.rows, perRow: b.perRow, width: b.len - 4, rise: 0.42, rowDepth: 0.95, fill: 0.88, standing: 0.5 };
  });
  F.crowd = null;
  try {
    F.crowd = createCrowd3d(stage, { stands: crowdStands, seed: 41, culture: 'central_asian', quality, cold: false, props: { flag: 0.06, phone: 0.12, child: 0.06 }, excitement: 0.3, viewportHeight: 800 });
  } catch (e) { console.warn('crowd3d unavailable', e && e.message); }

  // ---------------------------------------------------------------------------------------------------- riders and sack
  const looks = [];
  for (let i = 0; i < riderMax; i++) {
    const t = TEAMS[i < 4 ? 0 : 1];
    looks.push({ ...t, horse: COATS[i % COATS.length] });
  }
  F.looks = looks;
  const list = await Promise.all(looks.map((l, i) => createRider3({ base, variant: i, quality: quality === 'high' ? 'high' : 'medium', look: l }).catch((e) => { console.warn('rider', e && e.message); return null; })));
  F.riders = list.filter(Boolean);
  if (!F.riders.length) { host.remove(); return null; }
  for (const R of F.riders) { scene.add(R.group); R.group.visible = false; R.horse.on('hoof', (e) => { if (e.speed > 4.5) dustAt(R, e); }); }
  const sack = makeSack(); sack.scale.setScalar(0.88); scene.add(sack); F.sack = sack;
  const sackShadow = new Mesh(new PlaneGeometry(1.5, 1.5), new MeshBasicMaterial({ map: radialAlpha(), transparent: true, opacity: 0.5, depthWrite: false, color: 0x000000 }));
  sackShadow.rotation.x = -Math.PI / 2; sackShadow.position.y = 0.02; scene.add(sackShadow);

  // ---------------------------------------------------------------------------------------------------- dust
  const dustTex = (() => { const c = canvas2d(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(226,208,170,0.85)'); gr.addColorStop(0.6, 'rgba(226,208,170,0.35)'); gr.addColorStop(1, 'rgba(226,208,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; })();
  const DUST_MAX = 120;
  const dust = [];
  for (let i = 0; i < DUST_MAX; i++) {
    const sp = new Sprite(new SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    sp.visible = false; scene.add(sp); dust.push({ sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, s0: 0.5, s1: 1.4 });
  }
  let dustI = 0;
  const hv = new Vector3();
  function puff(x, y, z, vx, vy, vz, s0, s1, life, op = 0.55) {
    const d = dust[dustI]; dustI = (dustI + 1) % DUST_MAX;
    d.sp.visible = true; d.sp.position.set(x, y, z); d.life = d.max = life; d.vx = vx; d.vy = vy; d.vz = vz; d.s0 = s0; d.s1 = s1; d.op = op;
  }
  function dustAt(R, e) {
    if (F.paused) return;
    const leg = R.horse.legs.find((l) => l.side === e.leg[0] && l.front === (e.leg[1] === 'F'));
    if (!leg) return;
    const b = leg.bones[leg.bones.length - 1];
    b.getWorldPosition(hv);
    const k = clamp(e.speed / 10, 0.3, 1);
    puff(hv.x, 0.08, hv.z, (Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6, 0.18, 0.7 * k + 0.25, 0.7 + 0.4 * k, 0.4 * k + 0.1);
  }
  function stepDust(dt) {
    for (const d of dust) {
      if (d.life <= 0) { if (d.sp.visible) { d.sp.visible = false; } continue; }
      d.life -= dt;
      const u = 1 - clamp(d.life / d.max, 0, 1);
      d.sp.position.x += d.vx * dt; d.sp.position.y += d.vy * dt; d.sp.position.z += d.vz * dt; d.vy *= 0.97;
      const s = lerp(d.s0, d.s1, u); d.sp.scale.set(s, s, 1);
      d.sp.material.opacity = (d.op ?? 0.5) * (1 - u) * (u < 0.12 ? u / 0.12 : 1);
    }
  }

  // ---------------------------------------------------------------------------------------------------- per frame
  const P = new Map();               // rider id -> presentation state
  let lastRun = null, lastT = null;
  const sackSt = { x: 0, y: 0.2, z: 0, from: null, t: 1, heldBy: -1, air: 0, airMax: 0.45, rest: 0, hand: new Vector3(), fx: 0, fy: 0, fz: 0 };
  const tmpV = new Vector3(), tmpV2 = new Vector3();

  const worldOf = (st, lx, ly, lz) => {
    const c = Math.cos(st.yaw), s = Math.sin(st.yaw);
    return tmpV2.set(st.x + lx * c + lz * s, ly, st.z - lx * s + lz * c);
  };

  /**
   * Update the whole scene to the sim state s at presenter time `t`. info: { look, guide, camera shake } ; c = cam3d frame.
   */
  F.sync = (c, s, info) => {
    if (F.lost) return;
    const t = info.time;
    let dt = lastT == null ? 0 : t - lastT;
    if (!(dt >= 0) || dt > 0.25) dt = dt > 0.25 ? 1 / 30 : 0;
    const fresh = lastRun !== s;
    lastT = t; F.time += dt;
    // auto quality: a sustained frame interval above 1/38 s drops one tier (high -> medium -> low); never goes back up
    if (dt > 0 && dt < 0.2) {
      F.frameEma = F.frameEma ? F.frameEma * 0.95 + dt * 0.05 : dt; F.frameN = (F.frameN || 0) + 1;
      if (F.frameN > 120 && F.frameEma > 1 / 38 && tier.name !== 'low') { F.setQuality(tier.name === 'high' ? 'medium' : 'low'); F.frameN = 0; F.frameEma = 0; F.drops = (F.drops || 0) + 1; }
    }
    if (info.look !== F.look) applyLook(info.look);
    F.paused = !!info.frozen;
    const simDt = F.paused ? 0 : dt;
    // camera
    camera.fov = c.vfov; camera.aspect = c.area.w / c.area.h;
    const shake = s && s.shake > 0 ? s.shake * 0.35 : 0;
    camera.position.set(c.px[0] + Math.sin(F.time * 61) * shake, c.px[1] + Math.cos(F.time * 73) * shake * 0.6, c.px[2]);
    camera.lookAt(c.target[0], c.target[1], c.target[2]);
    camera.setViewOffset(c.area.w, c.area.h, -c.area.x, -c.area.y, c.W, c.H);
    camera.near = 1; camera.far = 400; camera.updateProjectionMatrix();
    stage.setShadowTarget(c.target[0], 0, c.target[2]);

    const car = s && s.sack.h >= 0 ? s.riders[s.sack.h] : null;
    // ---- riders
    const n = F.riders.length;
    const live = [];
    for (let i = 0; i < n; i++) {
      const R = F.riders[i], r = s ? s.riders[i] : null;
      if (!r) { R.group.visible = false; continue; }
      let st = P.get(i);
      if (!st || fresh) {
        st = { x: r.x, z: -r.y, yaw: r.th + Math.PI / 2, yawV: 0, speed: 0, px: r.x, pz: -r.y, roll: 0, slide: 0, e: 0, side: 1, hold: 0, tugAt: null, carryT: 0, reachW: 0, name: i };
        P.set(i, st);
        R.horse.v = 0; R.horse.target.v = 0; R.horse.sm.vv = 0; R.horse._first = true; R.horse._prevVel.set(0, 0, 0); st.ux = null;
        R.setLook({ ...F.looks[i], ...TEAMS[r.team], horse: COATS[(i * 2 + r.team * 3) % COATS.length] });
      }
      R.group.visible = true;
      st.x = r.x; st.z = -r.y;
      if (simDt > 0) {
        const mv = Math.hypot(st.x - st.px, st.z - st.pz) / simDt;
        st.speed += (mv - st.speed) * Math.min(1, simDt * 14);
        // facing follows the sim heading through a critically damped spring (never a snap)
        const err = wrapA(r.th + Math.PI / 2 - st.yaw), w = 16;
        st.yawV += (w * w * err - 2 * w * st.yawV) * simDt; st.yaw += st.yawV * simDt;
      } else st.speed *= 0.9;
      st.px = st.x; st.pz = st.z;
      live.push({ i, R, r, st });
    }
    // ---- who reaches for what (horse-local frame of each rider)
    const sk = s ? s.sack : null;
    // presented sack position: carried in a hand, or on the ground
    if (sk) {
      // where would the carried sack hang for each carrier (computed from the carrier's pose target)
      sackTarget(live, car, sk, simDt);
    }
    for (const L of live) poseRider(L, s, car, sk, simDt, t);
    // contact between neighbours: shoulders against shoulders
    for (const A of live) for (const B of live) {
      if (A.i >= B.i) continue;
      const dx = B.st.x - A.st.x, dz = B.st.z - A.st.z, d = Math.hypot(dx, dz);
      if (d < 2.35 && d > 0.01) {
        const k = (1 - d / 2.35);
        for (const [X, Y, sgn] of [[A, B, 1], [B, A, -1]]) {
          // which side is the other on, in X's horse frame (+ left)
          const lx = (sgn * dx) * Math.cos(X.st.yaw) - (sgn * dz) * Math.sin(X.st.yaw);
          X.st.touch = (X.st.touch || 0) + Math.sign(lx) * k;
        }
      }
    }
    // update riders (horse, seat, hands)
    for (const L of live) {
      const { R, st } = L;
      const m = R.mods;
      m.roll = spring(st, 'rollS', st.rollT || 0, 16, simDt || 1e-4);
      m.slide = spring(st, 'slideS', st.slideT || 0, 16, simDt || 1e-4);
      m.reachW = spring(st, 'rwS', st.reachWT || 0, 18, simDt || 1e-4);
      R.horse.setPosition(st.x, 0, st.z);
      R.horse.setFacing(st.yaw);
      const yawRate = simDt > 0 ? st.yawV : 0;
      R.horse.drive(simDt > 0 ? st.speed : 0, clamp(yawRate, -3.5, 3.5));
      // paused: nothing moves, so nothing is advanced; if the figure was put somewhere new (a restart, a jump) the pose is brought along once
      const moved = st.ux == null || Math.abs(st.x - st.ux) + Math.abs(st.z - st.uz) + Math.abs(st.yaw - st.uyaw) > 1e-4;
      st.ux = st.x; st.uz = st.z; st.uyaw = st.yaw;
      if (simDt > 0) R.horse.update(simDt);
      else if (moved) { R.horse.v = 0; R.horse.update(1 / 120); }
      R.cloth(simDt, st.speed, yawRate, F.time);
      st.touch = 0;
    }
    positionSack(live, car, sk, simDt);
    // ---- sack
    // ---- post: pennant, winding ring
    flagUpdate(s, car, F.time);
    stepDust(dt);
    // dust the sim raised (hooves and scuffs)
    if (s && !F.paused) for (const p of s.parts) { if (!p.seen) { p.seen = true; if (p.size > 0.5) puff(p.x, 0.2, -p.y, p.vx, 0.5, -p.vy, 0.3, 1.1, 0.8, 0.35); } }
    if (F.crowd && s) {
      if (fresh) F._ev = s.evId;
      for (const e of s.events) {
        if (e.n < (F._ev ?? 0)) continue;
        F._ev = e.n + 1;
        if (e.type === 'score') F.crowd.react('cheer', { intensity: 1 });
        else if (e.type === 'steal' || e.type === 'loose') F.crowd.react('gasp', { intensity: 0.7 });
        else if (e.type === 'flag') F.crowd.react('flag', { intensity: 0.8 });
        else if (e.type === 'end') F.crowd.react('ovation', { intensity: 1 });
      }
      F.crowd.setExcitement(clamp(0.25 + (s.sack.h >= 0 ? 0.35 : 0) + (s.sack.rounded ? 0.2 : 0), 0, 1));
    }
    if (F.crowd) F.crowd.update(simDt, camera);
    if (F.scenery) F.scenery.update(dt, camera);
    lastRun = s;
    F._live = live;
  };

  // --- reach / lean state for each rider ------------------------------------------------------------------------
  function sackTarget(live, car, sk, dt) {
    const S = sackSt;
    if (S.heldBy !== sk.h) {
      // pick-up or release: tween from where the sack is now
      S.from = { x: S.x, y: S.y, z: S.z };
      S.t = 0;
      if (sk.h < 0 && S.heldBy >= 0) { S.air = sk.air > 0 ? sk.air : 0.45; S.airMax = Math.max(0.3, S.air); S.rest = 0; }
      S.heldBy = sk.h;
    }
  }
  function carryLocal(st, shield) {
    const side = st.sackSide || 1;              // +1 the sack hangs on the rider's left
    return shield ? [side * 0.4, 1.22, 0.36] : [side * 0.62, 1.16, 0.34];
  }
  function poseRider(L, s, car, sk, dt, t) {
    const { i, R, r, st } = L;
    const m = R.mods;
    const k = dt > 0 ? dt : 1e-4;
    let rollT = 0, slideT = 0, reachWT = 0, finger = 'relaxed', reach = null;
    st.touchSm = spring(st, 'tchS', st.touch || 0, 14, k);
    rollT += clamp(st.touchSm, -1, 1) * -0.12;
    const carrying = car === r;
    const lean = globalThis.__leanOverride != null && r.scoopT > 0 ? globalThis.__leanOverride : clamp(Math.max(r.lean, r.scoopT > 0 ? 1 - r.scoopT / 0.35 : 0), 0, 1);
    if (r.scoopT > 0 && !car && sk) {
      // lean down the flank to the sack on the ground
      const sx = sk.x, sz = -sk.y;
      const c = Math.cos(st.yaw), sn = Math.sin(st.yaw);
      const dx = sx - st.x, dz = sz - st.z;
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c;            // x left, z forward (horse frame)
      st.sackSide = lx >= 0 ? 1 : -1;
      const reachX = Math.abs(lx), side = st.sackSide;
      rollT += -side * (0.35 + 0.95 * lean) * (0.55 + 0.45 * clamp(reachX / 1.4, 0, 1));
      slideT = side * 0.18 * lean;
      reach = { x: sx, y: 0.28, z: sz };
      reachWT = 1; finger = 'open';
      R.mods.reachSide = side > 0 ? 'L' : 'R';
      st.hold = 0;
    } else if (r.tug > 0 && car && car !== r) {
      // two hands on the rival's sack: lean in towards it
      const c = Math.cos(st.yaw), sn = Math.sin(st.yaw);
      const cx = sackSt.x, cz = sackSt.z;
      const dx = cx - st.x, dz = cz - st.z;
      const lx = dx * c - dz * sn;
      const side = lx >= 0 ? 1 : -1;
      rollT += -side * (0.55 + 0.2 * Math.sin(t * 22));
      slideT = side * 0.12;
      reach = { x: cx, y: Math.max(0.6, sackSt.y + 0.15), z: cz };
      reachWT = 1; finger = 'fist';
      R.mods.reachSide = side > 0 ? 'L' : 'R';
    } else if (carrying) {
      const lc = carryLocal(st, r.shield);
      const w = worldOf(st, lc[0], lc[1], lc[2]);
      reach = { x: w.x, y: w.y, z: w.z };
      reachWT = 1; finger = 'fist';
      R.mods.reachSide = (st.sackSide || 1) > 0 ? 'L' : 'R';
      rollT += (st.sackSide || 1) * (r.shield ? 0.12 : 0.05);
      // pulled by a rival: lean away
      if (r.tug > 0) {
        const rival = s.riders.find((q) => q !== r && q.team !== r.team && q.tug > 0 && Math.hypot(q.x - r.x, q.y - r.y) < 4);
        if (rival) {
          const c = Math.cos(st.yaw), sn = Math.sin(st.yaw);
          const lx = (rival.x - r.x) * c - (-rival.y - st.z) * sn;
          rollT += Math.sign(lx || 1) * 0.3;
        }
      }
    }
    if (r.recover > 0 && !carrying) rollT += Math.sin(t * 25) * 0.05 * Math.min(1, r.recover * 3);
    if (r.shield) rollT += 0;
    st.rollT = rollT; st.slideT = slideT; st.reachWT = reachWT;
    if (reach) { m.reach = tmpV.set(reach.x, reach.y, reach.z).clone(); m.fingers = finger; }
    m.offs = null;
    // torso offsets follow the roll: an additional spine flex so the shoulders drop towards the target
    const dive = clamp(Math.abs(st.rollS || 0) / 1.2, 0, 1);
    if (reachWT > 0) m.offs = { Spine: { flex: 8 * dive, side: -Math.sign(st.rollT || 1) * 6 * dive }, Spine1: { flex: 10 * dive, side: -Math.sign(st.rollT || 1) * 8 * dive }, Spine2: { flex: 8 * dive, side: -Math.sign(st.rollT || 1) * 6 * dive }, Neck: { flex: -10 * dive }, Head: { flex: -6 * dive } };
    if (st.carryT == null) st.carryT = 0;
  }
  function positionSack(live, car, sk, dt) {
    const S = sackSt;
    if (!sk) { sack.visible = false; sackShadow.visible = false; return; }
    sack.visible = true;
    let tx, ty, tz, ry = S.ry || 0, rx = 0, rz = 0;
    if (car) {
      const L = live.find((q) => q.r === car);
      if (L) {
        const lc = carryLocal(L.st, car.shield);
        const w = worldOf(L.st, lc[0], lc[1] - 0.3, lc[2]);
        tx = w.x; ty = w.y; tz = w.z;
        ry = L.st.yaw + Math.PI * 0.5 * (L.st.sackSide || 1) * 0.6;
        rz = (L.st.sackSide || 1) * 0.5;
      } else { tx = sk.x; ty = 0.25; tz = -sk.y; }
    } else {
      // on the ground, or thrown (sk.air counts down from the toss)
      tx = sk.x; tz = -sk.y; ty = 0.2;
      if (S.air > 0) { S.air = Math.max(0, S.air - dt); const u = 1 - S.air / S.airMax; ty = lerp(1.1, 0.2, sm(u)) + 1.1 * Math.sin(Math.PI * u); }
      ry = (sk.spin || 0) + (S.ry0 || 0);
    }
    // ease from where it was (pick-up / drop), instead of jumping
    if (S.t < 1) {
      S.t = Math.min(1, S.t + dt / 0.22);
      const k = sm(S.t);
      tx = lerp(S.from.x, tx, k); ty = lerp(S.from.y, ty, k); tz = lerp(S.from.z, tz, k);
    }
    S.x = tx; S.y = ty; S.z = tz;
    sack.position.set(tx, ty, tz);
    sack.rotation.set(rx, ry, rz);
    sackShadow.visible = true; sackShadow.position.set(tx, 0.03, tz); const sc = clamp(1.6 - ty * 0.4, 0.6, 1.6); sackShadow.scale.set(sc, sc, 1);
    sackShadow.material.opacity = 0.5 * clamp(1 - ty * 0.25, 0.2, 1);
    roundedRing.visible = !!sk.rounded && !car;
    roundedRing.position.set(tx, 0.04, tz);
  }
  function flagUpdate(s, car, t) {
    const pen = flag.userData.pen;
    const p = pen.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = pennantBase[i * 3]; p.setZ(i, Math.sin(t * 5 + x * 3.2) * 0.14 * x * (0.5 + Math.sin(t * 0.7) * 0.2)); p.setY(i, pennantBase[i * 3 + 1] - x * 0.04 * Math.sin(t * 4 + x)); }
    p.needsUpdate = true; pen.geometry.computeVertexNormals();
    pennantMat.color.set(s && s.sack.rounded ? 0x3fb36e : 0xe8452c);
    const frac = car ? clamp(Math.abs(car.wind) / FLAG_WIND, 0, 1) : 0;
    const q = s && !s.sack.rounded ? Math.round(frac * 48) : 0;
    if (q !== windQ) {
      windQ = q;
      if (windMesh) { scene.remove(windMesh); windMesh.geometry.dispose(); windMesh = null; }
      if (q > 0) {
        const g = new RingGeometry(FLAG_RING * 0.55 - 0.16, FLAG_RING * 0.55 + 0.16, 96, 1, Math.PI / 2, -TAU * (q / 48));
        windMesh = new Mesh(g, windMat); windMesh.rotation.x = -Math.PI / 2; windMesh.position.set(FLAG.x, 0.05, -FLAG.y); scene.add(windMesh);
      }
    }
    if (s) guideRing.visible = !s.sack.rounded && windQ === 0;
  }

  // ---------------------------------------------------------------------------------------------------- render + blit
  F.setGuide = (v) => { guideRing.material.opacity = v === 0 ? 0.3 : v === 1 ? 0.2 : 0.0; };
  F.size = (wPx, hPx) => {
    wPx = Math.max(2, Math.round(wPx)); hPx = Math.max(2, Math.round(hPx));
    const key = `${wPx}x${hPx}`;
    if (F.sized === key && renderer.domElement.width === wPx && renderer.domElement.height === hPx) return;
    F.sized = key;
    renderer.setPixelRatio(1);
    renderer.setSize(wPx, hPx, false);
    if (F.crowd) F.crowd.invalidate();
  };
  F.render = () => {
    if (F.lost) return false;
    const t0 = globalThis.performance ? performance.now() : 0;
    renderer.render(scene, camera);
    if (t0) {
      const ms = performance.now() - t0;
      F.cost.ema = F.cost.n ? F.cost.ema * 0.93 + ms * 0.07 : ms; F.cost.n++;
    }
    return true;
  };
  F.setQuality = (q) => {
    if (tier.name === q) return;
    tier.name = q; F.quality = q;
    stage.setQuality(q);
    for (const R of F.riders) R.setQuality(q === 'high' ? 'high' : q);
    if (F.crowd) F.crowd.setQuality(q);
  };
  F.ready = true;
  return F;
}
