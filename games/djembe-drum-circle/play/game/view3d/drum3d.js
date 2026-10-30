// The lit 3D djembe (three.js from ../vendor3d). Presentation only: it never reads or changes the game state, it only draws the
// drum that src/art.js asks for through the hook main.js installs (src/art.js `drum3d`), into a WebGL canvas that is then copied into the game's 2D canvas at the exact skin ellipse.
// The camera is orthographic and tilted so the skin's rim projects to the layout ellipse (ry = rx * DRUM_RY) exactly:
// every place the player can hit is where it was in 2D. Until the 3D drum is ready (and whenever WebGL is missing or the
// context is lost) art.js paints the 2D drum instead; a lost context is rebuilt from scratch when the browser restores it.
import { DRUM_RY, DRUM_BODY } from '../src/layout.js';

const TILT = Math.asin(DRUM_RY);                 // drum's up axis tipped toward the viewer: a unit circle becomes an ellipse of height DRUM_RY
const H = DRUM_BODY / Math.cos(TILT);            // shell height (head radius = 1) so the body hangs exactly DRUM_BODY * rx on screen
const MAXR = 8;                                   // ripples tracked on the skin
const M = 0.165;                                  // head radius in metres: the scene is in metres (the drum is built in head radii and scaled)
const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

export const d3 = { state: 'idle', fade: 0, err: null, lost: false };
let T = null, V = null, R = null;                 // THREE, vendor api, built rig

// Shell radius at s (0 = top under the head, 1 = foot): a round goblet bowl, a narrow waist, a flared foot.
export function shellR(s) {
  if (s < 0.55) { const k = Math.min(1, s / 0.55); return 0.34 + 0.64 * Math.pow(Math.max(0, 1 - Math.pow(k, 1.8)), 0.6); }
  return 0.34 + 0.29 * Math.pow((s - 0.55) / 0.45, 1.8);
}

// ---- textures (canvas, generated once) --------------------------------------------------------------------------------------
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function skinCanvas() {
  const N = 1024, c = cv(N), x = c.getContext('2d'), r = rng(7), b = cv(N), bx = b.getContext('2d');
  const g = x.createRadialGradient(N * 0.5, N * 0.5, 0, N * 0.5, N * 0.5, N * 0.5);
  g.addColorStop(0, '#cfae78'); g.addColorStop(0.35, '#dcc08c'); g.addColorStop(0.8, '#d8b780'); g.addColorStop(0.93, '#c9a46c'); g.addColorStop(1, '#8a6236');
  x.fillStyle = g; x.fillRect(0, 0, N, N); bx.fillStyle = '#808080'; bx.fillRect(0, 0, N, N);
  // mottled hide: soft blotches of darker and paler skin
  for (let i = 0; i < 70; i++) {
    const px = r() * N, py = r() * N, rr = 30 + r() * 140, dark = r() < 0.55, gg = x.createRadialGradient(px, py, 0, px, py, rr);
    gg.addColorStop(0, dark ? `rgba(120,78,38,${0.05 + r() * 0.08})` : `rgba(255,240,210,${0.05 + r() * 0.08})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  // the worn, hand-darkened middle where bass strokes land, and the slap edge darkened by fingers
  const w = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N * 0.26); w.addColorStop(0, 'rgba(110,70,32,0.22)'); w.addColorStop(1, 'rgba(110,70,32,0)');
  x.fillStyle = w; x.fillRect(0, 0, N, N);
  x.save(); x.globalCompositeOperation = 'multiply';
  const e = x.createRadialGradient(N / 2, N / 2, N * 0.36, N / 2, N / 2, N * 0.47); e.addColorStop(0, 'rgba(255,255,255,0)'); e.addColorStop(0.7, 'rgba(205,170,120,0.5)'); e.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = e; x.fillRect(0, 0, N, N); x.restore();
  // fibres and faint veins (bump too), stubble specks near the rim
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2, d = r() * N * 0.47, px = N / 2 + Math.cos(a) * d, py = N / 2 + Math.sin(a) * d, l = 6 + r() * 26, an = a + (r() - 0.5) * 1.2;
    x.strokeStyle = r() < 0.5 ? 'rgba(255,248,230,0.10)' : 'rgba(110,72,36,0.10)'; x.lineWidth = 0.6 + r() * 1.2;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); x.stroke();
    bx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'; bx.lineWidth = 1; bx.beginPath(); bx.moveTo(px, py); bx.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l); bx.stroke();
  }
  for (let v = 0; v < 9; v++) {
    let px = N / 2 + (r() - 0.5) * N * 0.7, py = N / 2 + (r() - 0.5) * N * 0.7;
    x.strokeStyle = 'rgba(140,92,52,0.09)'; x.lineWidth = 1.5 + r() * 2; x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 7; s++) { px += (r() - 0.5) * 90; py += (r() - 0.5) * 90; x.lineTo(px, py); } x.stroke();
  }
  for (let i = 0; i < 2600; i++) { const a = r() * Math.PI * 2, d = N * (0.43 + r() * 0.07); x.fillStyle = `rgba(60,36,16,${0.15 + r() * 0.3})`; x.fillRect(N / 2 + Math.cos(a) * d, N / 2 + Math.sin(a) * d, 1.4, 1.4); }
  for (let i = 0; i < 16000; i++) { bx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; bx.fillRect(r() * N, r() * N, 2, 2); }
  return { map: c, bump: b };
}
// Shell: vertical grain, oiled hardwood, a carved band of triangles round the foot and two cut grooves at the waist.
// The lathe's v runs from the foot (0) to the top (1).
function shellCanvas() {
  const W = 1024, Hh = 1024, c = cv(W, Hh), x = c.getContext('2d'), r = rng(11), b = cv(W, Hh), bx = b.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, 0);
  for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? '#7a4520' : '#6a3a1a');
  x.fillStyle = g; x.fillRect(0, 0, W, Hh); bx.fillStyle = '#808080'; bx.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 260; i++) {
    const x0 = r() * W, amp = 2 + r() * 9, ph = r() * 6.28, fr = 0.004 + r() * 0.01, lw = 0.6 + r() * 2.4, a = 0.06 + r() * 0.2, dark = r() < 0.65;
    for (const [ctx, col] of [[x, dark ? `rgba(40,18,6,${a})` : `rgba(230,170,110,${a * 0.6})`], [bx, dark ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.6})`]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
      for (let y = 0; y <= Hh; y += 8) { const xx = x0 + Math.sin(y * fr + ph) * amp; y ? ctx.lineTo(xx, y) : ctx.moveTo(xx, y); }
      ctx.stroke();
    }
  }
  const band = (v0, v1, n) => {                    // canvas y = (1 - v) * Hh
    const y0 = (1 - v1) * Hh, y1 = (1 - v0) * Hh, step = W / n;
    for (const yy of [y0, y1]) { x.fillStyle = 'rgba(25,10,3,0.75)'; x.fillRect(0, yy - 3, W, 6); bx.fillStyle = '#202020'; bx.fillRect(0, yy - 4, W, 8); bx.fillStyle = '#b0b0b0'; bx.fillRect(0, yy + 4, W, 2); }
    for (let i = 0; i < n; i++) {
      const xa = i * step, up = i % 2 === 0;
      x.beginPath(); x.moveTo(xa, up ? y1 : y0); x.lineTo(xa + step, up ? y1 : y0); x.lineTo(xa + step / 2, up ? y0 + 6 : y1 - 6); x.closePath();
      x.fillStyle = 'rgba(28,11,4,0.62)'; x.fill();
      bx.beginPath(); bx.moveTo(xa, up ? y1 : y0); bx.lineTo(xa + step, up ? y1 : y0); bx.lineTo(xa + step / 2, up ? y0 + 6 : y1 - 6); bx.closePath(); bx.fillStyle = '#383838'; bx.fill();
    }
  };
  band(0.08, 0.2, 28);
  for (const v of [0.4, 0.43]) { const yy = (1 - v) * Hh; x.fillStyle = 'rgba(25,10,3,0.7)'; x.fillRect(0, yy - 3, W, 6); bx.fillStyle = '#202020'; bx.fillRect(0, yy - 4, W, 8); }
  return { map: c, bump: b };
}
function ropeCanvas() {                            // twisted three-strand rope, along u
  const W = 256, Hh = 64, c = cv(W, Hh), x = c.getContext('2d'), b = cv(W, Hh), bx = b.getContext('2d');
  x.fillStyle = '#e9dcc0'; x.fillRect(0, 0, W, Hh); bx.fillStyle = '#909090'; bx.fillRect(0, 0, W, Hh);
  for (let i = -8; i < 24; i++) {
    const x0 = i * 16;
    x.strokeStyle = 'rgba(120,96,60,0.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0 + 26, Hh); x.stroke();
    x.strokeStyle = 'rgba(255,252,240,0.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(x0 + 7, 0); x.lineTo(x0 + 33, Hh); x.stroke();
    bx.strokeStyle = '#202020'; bx.lineWidth = 4; bx.beginPath(); bx.moveTo(x0, 0); bx.lineTo(x0 + 26, Hh); bx.stroke();
  }
  return { map: c, bump: b };
}
function fringeCanvas() {                          // the goat hair left on the skin where it wraps under the crown ring
  const W = 512, Hh = 64, c = cv(W, Hh), x = c.getContext('2d'), r = rng(5);
  x.clearRect(0, 0, W, Hh);
  for (let i = 0; i < 1400; i++) {
    const px = r() * W, l = Hh * (0.35 + r() * 0.65), tone = r();
    x.strokeStyle = tone < 0.5 ? `rgba(70,46,26,${0.6 + r() * 0.4})` : tone < 0.85 ? `rgba(150,110,70,${0.6 + r() * 0.4})` : `rgba(230,210,180,${0.6 + r() * 0.3})`;
    x.lineWidth = 1 + r() * 1.4; x.beginPath(); x.moveTo(px, 0); x.quadraticCurveTo(px + (r() - 0.5) * 8, l * 0.5, px + (r() - 0.5) * 14, l); x.stroke();
  }
  return c;
}
function groundCanvas() {                          // packed red earth under the drum, fading out so the painted dusk shows around it
  const N = 512, c = cv(N), x = c.getContext('2d'), r = rng(3);
  const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(58,28,16,1)'); g.addColorStop(0.5, 'rgba(44,20,12,0.8)'); g.addColorStop(1, 'rgba(30,12,8,0)');
  x.fillStyle = g; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 5000; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * N * 0.45; x.fillStyle = r() < 0.5 ? 'rgba(255,190,130,0.09)' : 'rgba(0,0,0,0.12)'; x.fillRect(N / 2 + Math.cos(a) * d, N / 2 + Math.sin(a) * d, 1 + r() * 2, 1 + r() * 2); }
  return c;
}

// ---- building ----------------------------------------------------------------------------------------------------------------
function texOf(c, srgb = true, rep) { const t = new T.CanvasTexture(c); if (srgb) t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }

// Skin: a polar grid (rings x segments) whose last rings roll down over the bearing edge. Displaced each frame by the ripples.
function skinGeometry(NR = 30, NS = 112) {
  const pos = [], uv = [], idx = [], base = [];
  for (let i = 0; i <= NR; i++) {
    const k = i / NR, rad = k <= 0.9 ? (k / 0.9) * 0.985 : 0.985 + (k - 0.9) / 0.1 * 0.05;
    const y = k <= 0.9 ? 0 : -Math.pow((k - 0.9) / 0.1, 1.6) * 0.07;
    for (let j = 0; j <= NS; j++) {
      const a = (j / NS) * Math.PI * 2, px = Math.cos(a) * rad, pz = Math.sin(a) * rad;
      pos.push(px, y, pz); base.push(px, y, pz); uv.push(0.5 + px * 0.49, 0.5 - pz * 0.49);
    }
  }
  for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) { const a = i * (NS + 1) + j, b = a + NS + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  g.userData.base = Float32Array.from(base); g.userData.NR = NR;
  return g;
}

function build() {
  const scene = new T.Scene();
  const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 100); camera.position.set(0, 0, 20); camera.lookAt(0, 0, 0);

  // Lights live in camera space (they do not tilt with the drum): firelight from the lower left front, a cool moon rim from the
  // upper right behind, a warm bounce from the ground, dusk sky fill.
  const hemi = new T.HemisphereLight(0xffc8a0, 0x3a1c14, 0.55);
  const fire = new T.DirectionalLight(0xffa25a, 2.9); fire.position.set(-6, -2.5, 7);
  const key = new T.DirectionalLight(0xffe2bc, 1.6); key.position.set(-3, 7, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -0.55, right: 0.55, top: 0.55, bottom: -0.55, near: 0.5, far: 30 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.004; key.shadow.radius = 4;
  const rim = new T.DirectionalLight(0x7fe0e6, 1.9); rim.position.set(6, 3, -5);
  const bounce = new T.DirectionalLight(0xff7a3a, 0.6); bounce.position.set(0, -6, 3);
  scene.add(hemi, fire, key, key.target, rim, bounce);
  const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.32; pm.dispose();

  const tilt = new T.Group(); tilt.rotation.x = TILT; scene.add(tilt);
  const drum = new T.Group(); drum.scale.setScalar(M); tilt.add(drum);
  const rock = new T.Group(); drum.add(rock);              // rocks a little on its foot when struck hard (pivot at the foot)
  rock.position.y = -H; const body = new T.Group(); body.position.y = H; rock.add(body);

  // shell (lathe, foot to top)
  const prof = []; const n = 64;
  prof.push(new T.Vector2(0.0, -H)); prof.push(new T.Vector2(shellR(1) - 0.02, -H)); prof.push(new T.Vector2(shellR(1), -H + 0.03));
  for (let i = n; i >= 0; i--) { const s = i / n; prof.push(new T.Vector2(shellR(s), -s * H)); }
  prof.push(new T.Vector2(0.9, -0.02)); prof.push(new T.Vector2(0.0, -0.02));
  const shellT = shellCanvas();
  const shellMat = new T.MeshPhysicalMaterial({ map: texOf(shellT.map, true), bumpMap: texOf(shellT.bump, false), bumpScale: 1.4, roughness: 0.5, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const shell = new T.Mesh(new T.LatheGeometry(prof, 96), shellMat); shell.castShadow = true; shell.receiveShadow = true;
  // re-map the lathe's v to s so the carving lands where shellCanvas puts it (v: 0 foot .. 1 top)
  { const p = shell.geometry.attributes.position, u = shell.geometry.attributes.uv; for (let i = 0; i < p.count; i++) u.setY(i, Math.min(1, Math.max(0, 1 + p.getY(i) / H))); u.needsUpdate = true; }
  body.add(shell);

  // skin + crown ring + the hair fringe
  const skinT = skinCanvas();
  const skinMat = new T.MeshPhysicalMaterial({ map: texOf(skinT.map), bumpMap: texOf(skinT.bump, false), bumpScale: 0.6, roughness: 0.62, metalness: 0, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new T.Color(0xffe8c8), clearcoat: 0.12, clearcoatRoughness: 0.5 });
  const skinGeo = skinGeometry(); const skin = new T.Mesh(skinGeo, skinMat); skin.receiveShadow = true; skin.castShadow = true; body.add(skin);
  const fringe = new T.Mesh(new T.CylinderGeometry(1.045, 1.07, 0.16, 112, 1, true), new T.MeshStandardMaterial({ map: texOf(fringeCanvas(), true, [6, 1]), transparent: true, alphaTest: 0.25, side: T.DoubleSide, roughness: 0.95 }));
  fringe.position.y = -0.135; body.add(fringe);
  const ropeT = ropeCanvas(), ropeMat = new T.MeshStandardMaterial({ map: texOf(ropeT.map, true, [1, 1]), bumpMap: texOf(ropeT.bump, false, [1, 1]), bumpScale: 1.2, roughness: 0.85, color: 0xffffff });
  const crown = new T.Mesh(new T.TorusGeometry(1.03, 0.036, 10, 120), ropeMat); crown.rotation.x = Math.PI / 2; crown.position.y = -0.085; crown.castShadow = true; body.add(crown);
  const crown2 = new T.Mesh(new T.TorusGeometry(1.03, 0.04, 10, 120), ropeMat); crown2.rotation.x = Math.PI / 2; crown2.position.y = -0.2; body.add(crown2);
  // the Mali weave: vertical ropes from the crown to the bottom ring, pulled together in pairs so they make rows of diamonds
  const sB = 0.4, yB = -sB * H, NV = 36, rows = 4, ropes = [];
  for (let i = 0; i < NV; i++) {
    const a0 = (i / NV) * Math.PI * 2, pts = [];
    for (let k = 0; k <= rows * 6; k++) {
      const f = k / (rows * 6), y = -0.2 + (yB + 0.02 - -0.2) * f, s = -y / H, row = f * rows, ph = row - Math.floor(row);
      const tri = 1 - Math.abs(ph * 2 - 1), pull = Math.pow(tri, 0.8) * (Math.PI / NV) * 0.92 * (i % 2 ? -1 : 1) * (Math.floor(row) % 2 ? -1 : 1);
      const rr = shellR(s) + 0.028, a = a0 + pull;
      pts.push(new T.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr));
    }
    const geo = new T.TubeGeometry(new T.CatmullRomCurve3(pts, false, 'centripetal'), 96, 0.015, 6, false);
    ropes.push(geo);
  }
  const rp = new T.Mesh(mergeGeometries(ropes), ropeMat); rp.castShadow = true; rp.receiveShadow = true; body.add(rp);
  const ringB = new T.Mesh(new T.TorusGeometry(shellR(sB) + 0.03, 0.04, 10, 100), ropeMat); ringB.rotation.x = Math.PI / 2; ringB.position.y = yB; ringB.castShadow = true; body.add(ringB);

  // ground + contact shadow (fixed under the foot; does not rock)
  const ground = new T.Mesh(new T.CircleGeometry(2.6, 64), new T.MeshStandardMaterial({ map: texOf(groundCanvas()), transparent: true, roughness: 1, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -H - 0.002; ground.receiveShadow = true; drum.add(ground);
  const blob = (() => { const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.6, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.Mesh(new T.PlaneGeometry(1.7, 1.7), new T.MeshBasicMaterial({ map: texOf(c), transparent: true, depthWrite: false })); })();
  blob.rotation.x = -Math.PI / 2; blob.position.y = -H + 0.003; drum.add(blob);

  return { tilt, scene, renderer, canvas, camera, drum, rock, body, skin, skinGeo, lights: { fire, key, rim, hemi, bounce }, ripples: [], rockV: 0, rockA: 0, lastT: 0 };
}
function mergeGeometries(list) {
  let total = 0, itotal = 0; for (const g of list) { total += g.attributes.position.count; itotal += g.index.count; }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), idx = new Uint32Array(itotal);
  let o = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2);
    const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx[io + i] = ix[i] + o;
    o += g.attributes.position.count; io += ix.length; g.dispose();
  }
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2)); m.setIndex(new T.BufferAttribute(idx, 1));
  return m;
}

// ---- lifecycle ---------------------------------------------------------------------------------------------------------------
export function start3d() {
  if (d3.state !== 'idle' || !hasDom()) return;
  if (typeof location !== 'undefined' && /(?:\?|&)no3d=1/.test(location.search)) { d3.state = 'off'; return; }
  d3.state = 'loading';
  import('../vendor3d/index.js').then(async (api) => {
    V = api; T = api.THREE;
    if (!api.webglSupported()) { d3.state = 'off'; return; }
    try { R = build(); } catch (e) { d3.state = 'off'; d3.err = String(e); return; }
    R.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); d3.lost = true; d3.state = 'lost'; d3.fade = 0; });
    R.canvas.addEventListener('webglcontextrestored', () => { try { R.renderer.dispose(); } catch { /* gone */ } R = null; d3.lost = false; d3.state = 'idle'; start3d(); });
    d3.state = 'ready'; d3.api = { T, R: () => R };
  }).catch((e) => { d3.state = 'off'; d3.err = String(e); });
}
export const ready3d = () => d3.state === 'ready' && R;
export const rig3d = () => R;
export const three = () => T;

// A stroke on the skin: (u, v) in skin units (centre 0, rim 1), v toward the viewer. Strength 0..1.
export function dent(u, v, stroke, vel) {
  if (!R) return;
  R.ripples.push({ u, v, age: 0, stroke, k: vel }); if (R.ripples.length > MAXR) R.ripples.shift();
  if (stroke === 'B') R.rockV += 0.05 * vel; else if (stroke === 'S') R.rockV -= 0.02 * vel; else R.rockV += 0.012 * vel;
}

function stepSkin(dt) {
  const g = R.skinGeo, p = g.attributes.position, b = g.userData.base, rs = R.ripples;
  for (const r of rs) r.age += dt;
  R.ripples = rs.filter((r) => r.age < 0.9);
  const live = R.ripples.length > 0 || R.wasLive;
  R.wasLive = R.ripples.length > 0;
  if (!live) return;
  const arr = p.array;
  for (let i = 0; i < p.count; i++) {
    const x = b[i * 3], z = b[i * 3 + 2], rr = Math.hypot(x, z);
    let d = 0;
    if (rr < 0.985) {
      const edge = Math.min(1, (0.985 - rr) / 0.18);           // the skin is held at the bearing edge
      for (const r of R.ripples) {
        const dx = x - r.u, dz = z - r.v, dist = Math.hypot(dx, dz), sharp = r.stroke === 'S' ? 0.11 : r.stroke === 'T' ? 0.16 : 0.3;
        const press = Math.exp(-r.age * (r.stroke === 'B' ? 16 : 26)) * Math.exp(-(dist * dist) / (sharp * sharp));
        const front = r.age * 2.2, wave = Math.exp(-r.age * 5) * Math.exp(-Math.pow((dist - front) / 0.08, 2)) * Math.sin((dist - front) * 30);
        d += -(r.stroke === 'B' ? 0.075 : r.stroke === 'T' ? 0.045 : 0.03) * r.k * press + 0.006 * r.k * wave;
      }
      d *= edge;
    }
    arr[i * 3 + 1] = b[i * 3 + 1] + d;
  }
  p.needsUpdate = true; g.computeVertexNormals();
}

// Draw the 3D drum for skin ellipse g into the 2D context (already in virtual units). box = the region to draw (virtual units).
// Returns false when the 3D drum is not available (the caller paints the 2D drum).
export function drawDrum3d(ctx, g, box, t, o = {}) {
  if (!ready3d()) return false;
  const m = ctx.getTransform?.(), scale = Math.max(0.5, (m && m.a) || 1);
  const pw = Math.max(16, Math.min(2048, Math.round(box.w * scale))), ph = Math.max(16, Math.min(2048, Math.round(box.h * scale)));
  try {
    if (R.canvas.width !== pw || R.canvas.height !== ph) R.renderer.setSize(pw, ph, false);
    const dt = Math.min(0.05, Math.max(0, t - R.lastT)); R.lastT = t;
    if (!o.frozen) {
      stepSkin(dt);
      // the drum rocks back on its foot after a hard bass stroke and settles (damped spring)
      R.rockA += R.rockV * 60 * dt; R.rockV += (-R.rockA * 140 - R.rockV * 14) * dt; R.rockA = Math.max(-0.06, Math.min(0.06, R.rockA));
      R.rock.rotation.x = R.rockA * 0.5;
    }
    const fl = o.calm ? 1 : 1 + 0.1 * Math.sin(t * 6.3) + 0.06 * Math.sin(t * 11.7 + 1.3) + 0.04 * Math.sin(t * 2.1);
    R.lights.fire.intensity = 2.9 * fl; R.lights.bounce.intensity = 0.6 * fl;
    // ortho frustum in head-radius units, with the skin centre at the origin
    const k = M / g.rx, c = R.camera;
    c.left = (box.x - g.cx) * k; c.right = (box.x + box.w - g.cx) * k; c.top = (g.cy - box.y) * k; c.bottom = (g.cy - box.y - box.h) * k; c.updateProjectionMatrix();
    const r = R.renderer; r.autoClear = true; r.render(R.scene, c);
    ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.drawImage(R.canvas, box.x, box.y, box.w, box.h); ctx.restore();
    return true;
  } catch (e) { d3.state = 'off'; d3.err = String(e); return false; }
}


// Installed by main.js into src/art.js: the pure game code calls these only when they are present.
export function install(hook) {
  hook.start = start3d; hook.ready = () => !!ready3d(); hook.draw = drawDrum3d; hook.dent = dent; hook.state = d3;
}
