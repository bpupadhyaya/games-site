// Models for the andron: kylix, kottabos stand with its disc and dish, the basin with floating saucers, the klinē, a krater, a lamp stand and a
// column. Everything is generated (lathe / extrude / rounded boxes, canvas textures). Metres; y up.
import { THREE, board3d as B } from '../vendor3d/index.js';

const TAU = Math.PI * 2;
const hasDom = typeof document !== 'undefined';
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const ctex = (c, { repeat, srgb = true, aniso = 8 } = {}) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; };
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, ...o });
const phys = (o) => { try { return new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0, ...o }); } catch { return std(o); } };

// ---- patterns (canvas) --------------------------------------------------------------------------------------------------------------
export function meanderPath(g, x0, y0, w, h, step) {
  // Greek key: a square spiral repeated along x, drawn as one stroked path
  const u = h / 6;
  g.beginPath();
  for (let x = x0; x < x0 + w; x += step) {
    g.moveTo(x, y0 + h); g.lineTo(x, y0); g.lineTo(x + 5 * u, y0); g.lineTo(x + 5 * u, y0 + 4 * u); g.lineTo(x + 2 * u, y0 + 4 * u); g.lineTo(x + 2 * u, y0 + 2 * u); g.lineTo(x + 3.5 * u, y0 + 2 * u);
    g.moveTo(x + 5 * u, y0 + h); g.lineTo(x + step, y0 + h);
  }
}
function palmette(g, cx, cy, r, up = true) {
  const s = up ? -1 : 1;
  for (let k = -3; k <= 3; k++) {
    const a = -Math.PI / 2 + k * 0.34;
    g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.55, cy + s * -Math.sin(a) * r * 0.55 * -1, r * 0.16, r * 0.5, (a + Math.PI / 2) * s * -1, 0, TAU); g.fill();
  }
  g.beginPath(); g.arc(cx, cy, r * 0.2, 0, TAU); g.fill();
}
export function rosette(g, cx, cy, r, fg, bg) {
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.fillStyle = fg;
  for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.3, r * 0.13, a, 0, TAU); g.fill(); }
  g.beginPath(); g.arc(cx, cy, r * 0.2, 0, TAU); g.fill();
}

// ---- materials ------------------------------------------------------------------------------------------------------------------------
const MAT = {};
export function mats() {
  if (MAT.ready) return MAT;
  MAT.ready = true;
  MAT.bronze = B.material('brass', { color: '#b98a3c', color2: '#e9c46a', roughness: 0.34, envIntensity: 2.6 });
  MAT.bronzeDark = B.material('brass', { color: '#6f4b1c', color2: '#a87a30', roughness: 0.42, envIntensity: 2.0 });
  MAT.glaze = phys({ color: 0x15100d, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.0 });
  MAT.terracotta = B.material('clay', { color: '#b8582c', color2: '#d98450', roughness: 0.82 });
  MAT.wood = B.material('darkWood', { color: '#5b3319', color2: '#7a4a28' });
  MAT.woodLight = B.material('wood', { color: '#a87642', color2: '#c99a62' });
  MAT.stone = B.material('stone', { color: '#a89c88', color2: '#d9cdb6', repeat: [2, 2] });
  MAT.cream = std({ color: 0xf0e2c0, roughness: 0.6 });
  MAT.water = phys({ color: 0x59c6dd, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2.4 });
  MAT.drop = phys({ color: 0xcdf3ff, roughness: 0.02, metalness: 0, clearcoat: 1, emissive: 0x3aa6c8, emissiveIntensity: 0.55, envMapIntensity: 2.2 });
  return MAT;
}

// ---- the kylix --------------------------------------------------------------------------------------------------------------------------
// A real wine cup: ~19 cm across the bowl, low foot and stem, two horizontal loop handles. Origin at the centre of the bowl; handles along x.
export const KYLIX = { R: 0.095, drop: 0.058 };
export function makeKylix({ band = '#b8582c', tondo = '#d98450' } = {}) {
  const M = mats(), g = new THREE.Group(); g.name = 'kylix';
  // exterior profile (r, y), y measured from the bowl's centre plane (lip at y = +0.012)
  const ext = [[0, -0.100], [0.034, -0.100], [0.038, -0.094], [0.032, -0.088], [0.0105, -0.080], [0.0085, -0.062], [0.0115, -0.052], [0.030, -0.046], [0.056, -0.034], [0.080, -0.014], [0.092, 0.0], [0.0965, 0.010], [0.0955, 0.0125]];
  const outer = new THREE.Mesh(B.lathe(ext, 64), (() => {
    const c = cv(512, 256), x = c.getContext('2d');
    x.fillStyle = '#15100d'; x.fillRect(0, 0, 512, 256);
    // reserved terracotta band near the lip with a black-figure-style frieze of palmettes and a meander
    const y0 = 70, h = 86;
    x.fillStyle = band; x.fillRect(0, y0, 512, h);
    x.fillStyle = '#15100d';
    for (let i = 0; i < 8; i++) palmette(x, 32 + i * 64, y0 + h * 0.78, 24, i % 2 === 0);
    x.strokeStyle = '#15100d'; x.lineWidth = 3; x.lineCap = 'butt'; meanderPath(x, 0, y0 + 4, 512, 14, 22); x.stroke();
    x.fillStyle = '#e9c46a'; for (let i = 0; i < 24; i++) { x.beginPath(); x.arc(10 + i * 21.3, y0 - 8, 2.2, 0, TAU); x.fill(); }
    return phys({ map: ctex(c), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, metalness: 0, envMapIntensity: 1.6 });
  })());
  outer.castShadow = true; outer.receiveShadow = true; g.add(outer);
  // interior: terracotta with a black tondo; water sits at y = -0.004
  const inn = [[0.0955, 0.0125], [0.0905, 0.0125], [0.0865, 0.004], [0.072, -0.016], [0.045, -0.032], [0.0, -0.040]];
  const innerMat = (() => {
    const c = cv(512, 512), x = c.getContext('2d');
    x.fillStyle = tondo; x.fillRect(0, 0, 512, 512);
    // v runs from the lip (0) to the centre (1) along the profile; draw as concentric rings in a polar sense: use horizontal bands
    x.fillStyle = '#15100d'; x.fillRect(0, 0, 512, 40); x.fillRect(0, 380, 512, 132);
    x.strokeStyle = '#e9c46a'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 360); x.lineTo(512, 360); x.stroke();
    return phys({ map: ctex(c), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide });
  })();
  const inside = new THREE.Mesh(B.lathe(inn.slice().reverse(), 64), innerMat); inside.receiveShadow = true; g.add(inside);
  // handles: two horizontal loops just under the lip
  for (const sg of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0072, 12, 28, Math.PI * 1.02), M.glaze);
    h.rotation.x = Math.PI / 2; h.rotation.z = sg > 0 ? -Math.PI / 2 - 0.12 : Math.PI / 2 - 0.12;
    h.position.set(sg * (KYLIX.R + 0.0165), -0.006, 0); h.scale.set(1, 1, 1); h.castShadow = true; g.add(h);
  }
  // water in the cup
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.0825, 48), M.water.clone());
  water.rotation.x = -Math.PI / 2; water.position.y = -0.006; water.name = 'water'; g.add(water);
  g.userData.water = water;
  g.userData.setFill = (f) => { water.visible = f > 0.01; water.scale.setScalar(0.5 + 0.5 * f); water.position.y = -0.030 + 0.024 * f; };
  return g;
}

// ---- kottabos stand ----------------------------------------------------------------------------------------------------------------------
// Centre of the base at the origin on the floor; pole to height h; the disc (plastinx) balanced on a small cup on top (pivot = underside centre),
// the dish (manes) fixed to the pole 22 cm lower. Returns a group with .disc (rocks about z) and .dish.
export function makeStand(s, { DISC_T = 0.032, MANES_DROP = 0.22, MANES_T = 0.016, POLE_R = 0.014 } = {}) {
  const M = mats(), g = new THREE.Group(); g.name = 'stand';
  const h = s.h / 100, r = s.r / 100, rm = s.rm / 100;
  // base: a turned bronze foot with a rolled moulding
  const base = [[0, 0], [0.135, 0], [0.145, 0.006], [0.14, 0.016], [0.105, 0.024], [0.07, 0.036], [0.034, 0.06], [0.024, 0.09], [0.0175, 0.14], [POLE_R * 1.1, 0.18]];
  const foot = new THREE.Mesh(B.lathe(base, 48), M.bronzeDark); foot.castShadow = true; foot.receiveShadow = true; g.add(foot);
  // pole with turned rings
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(POLE_R, POLE_R * 1.08, h - 0.17, 20), M.bronze); pole.position.y = 0.17 + (h - 0.17) / 2; pole.castShadow = true; g.add(pole);
  for (let y = 0.3; y < h - 0.1; y += 0.28) {
    const ring = new THREE.Mesh(B.lathe([[POLE_R, 0], [POLE_R * 1.9, 0.004], [POLE_R * 2.1, 0.01], [POLE_R * 1.9, 0.016], [POLE_R, 0.02]], 24), M.bronzeDark); ring.position.y = y; ring.castShadow = true; g.add(ring);
  }
  // the support: a small cup the disc rests on
  const sup = new THREE.Mesh(B.lathe([[POLE_R, h - 0.07], [0.016, h - 0.052], [0.026, h - 0.026], [0.034, h - 0.004], [0.036, h], [0.026, h + 0.0006], [0, h + 0.0006]], 32), M.bronze); sup.castShadow = true; g.add(sup);
  // the dish: a shallow bronze plate with a raised rim and a little boss where the pole passes
  const my = h - MANES_DROP;
  const dishP = [[0.0, my - 0.02], [rm * 0.35, my - 0.021], [rm * 0.8, my - 0.014], [rm, my - 0.004], [rm * 1.0, my + 0.0], [rm * 0.97, my + 0.004], [rm * 0.78, my - 0.003], [rm * 0.4, my - 0.007], [0.022, my - 0.004], [0.02, my + 0.012], [POLE_R * 1.3, my + 0.016]];
  const dish = new THREE.Mesh(B.lathe(dishP, 64), M.bronze); dish.castShadow = true; dish.receiveShadow = true; g.add(dish); g.dish = dish;
  // disc (plastinx): a thin bronze disc with a bevelled rim and a raised centre, pivot at its underside
  const discG = new THREE.Group(); discG.name = 'disc';
  const dp = [[0, 0], [r * 0.5, 0.0], [r * 0.93, 0.002], [r, 0.010], [r, 0.022], [r * 0.9, DISC_T - 0.004], [r * 0.5, DISC_T - 0.001], [r * 0.18, DISC_T + 0.003], [0, DISC_T + 0.004]];
  const disc = new THREE.Mesh(B.lathe(dp, 64), M.bronze); disc.castShadow = true; disc.receiveShadow = true; discG.add(disc);
  // engraved rings (thin dark tori on the top face)
  for (const k of [0.62, 0.8]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r * k, 0.0012, 6, 48), M.bronzeDark); t.rotation.x = Math.PI / 2; t.position.y = DISC_T - 0.001; discG.add(t); }
  discG.position.set(0, h, 0);
  g.add(discG); g.disc = discG; g.userData = { h, r, rm, my };
  const sh = B.contactShadow(0.3, 0.5); g.add(sh);
  return g;
}

// ---- basin and floating saucers -----------------------------------------------------------------------------------------------------------
export function makeBasin(halfW = 0.52, water = 0.12) {
  const M = mats(), g = new THREE.Group(); g.name = 'basin';
  const R = halfW + 0.02;
  const prof = [[0, 0], [R * 0.52, 0.0], [R * 0.56, 0.012], [R * 0.52, 0.03], [R * 0.7, 0.052], [R * 0.9, 0.085], [R * 0.99, 0.12], [R * 1.02, 0.138], [R * 1.0, 0.152], [R * 0.965, 0.148], [R * 0.955, 0.124]];
  const tex = (() => {
    const c = cv(1024, 256), x = c.getContext('2d');
    x.fillStyle = '#b8582c'; x.fillRect(0, 0, 1024, 256);
    const rn = rng(5); for (let i = 0; i < 4000; i++) { x.fillStyle = rn() < 0.5 ? 'rgba(255,230,190,0.07)' : 'rgba(60,20,5,0.1)'; x.fillRect(rn() * 1024, rn() * 256, 2 + rn() * 3, 2 + rn() * 3); }
    // black glaze band with a cream dot frieze and a meander near the rim (v runs foot -> rim)
    x.fillStyle = '#15100d'; x.fillRect(0, 70, 1024, 70);
    x.fillStyle = '#f0e2c0'; for (let i = 0; i < 64; i++) { x.beginPath(); x.arc(8 + i * 16, 105, 3.2, 0, TAU); x.fill(); }
    x.strokeStyle = '#15100d'; x.lineWidth = 5; meanderPath(x, 0, 160, 1024, 40, 60); x.stroke();
    x.fillStyle = '#15100d'; x.fillRect(0, 214, 1024, 42);
    return ctex(c, { repeat: [1, 1] });
  })();
  const body = new THREE.Mesh(B.lathe(prof, 96), phys({ map: tex, roughness: 0.55, clearcoat: 0.45, clearcoatRoughness: 0.35, side: THREE.DoubleSide }));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  // rim: a rolled bronze lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.995, 0.0085, 10, 96), M.bronze); lip.rotation.x = Math.PI / 2; lip.position.y = 0.146; lip.castShadow = true; g.add(lip);
  // two lug handles
  for (const sg of [-1, 1]) {
    const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.0085, 10, 22, Math.PI * 1.2), M.glaze);
    hnd.position.set(sg * R * 1.0, 0.13, 0); hnd.rotation.set(0, 0, sg > 0 ? -Math.PI * 0.6 : Math.PI * 0.4); g.add(hnd);
  }
  // water surface (ripples drawn into a canvas bump map by the presenter)
  const rc = cv(256), rx = rc.getContext('2d'); rx.fillStyle = '#808080'; rx.fillRect(0, 0, 256, 256);
  const rippleTex = ctex(rc, { srgb: false }); rippleTex.wrapS = rippleTex.wrapT = THREE.ClampToEdgeWrapping;
  const wmat = M.water.clone(); wmat.bumpMap = rippleTex; wmat.bumpScale = 1.6; wmat.color = new THREE.Color(0x3a9bb4);
  const surf = new THREE.Mesh(new THREE.CircleGeometry(R * 0.956, 80), wmat);
  surf.rotation.x = -Math.PI / 2; surf.position.y = water; surf.receiveShadow = true; surf.name = 'water'; g.add(surf);
  g.userData = { surf, ripple: { canvas: rc, ctx: rx, tex: rippleTex }, R };
  const sh = B.contactShadow(R * 1.25, 0.55); g.add(sh);
  return g;
}

// a floating saucer (a shallow cup, manes-like) of diameter w (m), height h
export function makeSaucer(w, h = 0.042, i = 0) {
  const M = mats(), g = new THREE.Group(), r = w / 2;
  const prof = [[0, 0], [r * 0.5, 0.002], [r * 0.85, h * 0.45], [r, h * 0.9], [r * 1.01, h], [r * 0.93, h], [r * 0.82, h * 0.55], [r * 0.45, h * 0.18], [0, h * 0.12]];
  const tex = (() => {
    const c = cv(256, 128), x = c.getContext('2d');
    x.fillStyle = '#15100d'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#b8582c'; x.fillRect(0, 36, 256, 30);
    x.fillStyle = '#15100d'; for (let k = 0; k < 8; k++) palmette(x, 16 + k * 32, 62, 11, k % 2 === 0);
    return ctex(c);
  })();
  const m = new THREE.Mesh(B.lathe(prof, 40), phys({ map: tex, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.1, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true; g.add(m);
  const wat = new THREE.Mesh(new THREE.CircleGeometry(r * 0.84, 28), M.water.clone());
  wat.rotation.x = -Math.PI / 2; wat.position.y = h * 0.2; g.add(wat);
  g.userData = { water: wat, h, r, i };
  // two tiny ring handles
  for (const sg of [-1, 1]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r * 0.17, 0.0035, 8, 14), M.glaze); t.position.set(sg * r * 1.06, h * 0.78, 0); t.rotation.y = Math.PI / 2; g.add(t); }
  return g;
}

// ---- room furniture --------------------------------------------------------------------------------------------------------------------
// A klinē (banquet couch): turned legs, a carved head board, a thick mattress with a woven blanket, and a bolster. Length along x, origin on the
// floor at the middle of the long side. The seat top is at y = 0.24 (a low daybed: the sim's cup is held 34 cm above the floor).
export function makeKline({ blanket = '#8a2f22', stripe = '#e9c46a', length = 2.0, width = 0.78 } = {}) {
  const M = mats(), g = new THREE.Group(); g.name = 'kline';
  const top = 0.17;
  const legP = [[0.0, 0], [0.032, 0], [0.034, 0.012], [0.026, 0.028], [0.04, 0.05], [0.046, 0.07], [0.034, 0.092], [0.03, 0.12], [0.042, top - 0.004]];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(B.lathe(legP, 24), M.wood); leg.position.set(sx * (length / 2 - 0.07), 0, sz * (width / 2 - 0.07)); leg.castShadow = true; g.add(leg);
  }
  const frame = new THREE.Mesh(B.roundedBox(length, 0.06, width, 0.02, 4), M.wood); frame.position.y = top + 0.02; frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
  // carved front rail with a row of rosettes
  const rail = new THREE.Mesh(B.roundedBox(length * 0.98, 0.05, 0.02, 0.008, 3), M.bronzeDark); rail.position.set(0, top + 0.02, width / 2 + 0.002); g.add(rail);
  for (let i = 0; i < 9; i++) { const ro = new THREE.Mesh(B.lathe([[0, 0], [0.016, 0.0], [0.018, 0.006], [0.01, 0.012], [0, 0.014]], 14), M.bronze); ro.rotation.x = Math.PI / 2; ro.position.set(-length * 0.4 + i * (length * 0.8 / 8), top + 0.02, width / 2 + 0.012); g.add(ro); }
  // head board: a curved bolster end rail
  const hb = new THREE.Mesh(B.roundedBox(0.06, 0.2, width, 0.025, 4), M.wood); hb.position.set(length / 2 - 0.03, top + 0.1, 0); hb.castShadow = true; g.add(hb);
  // mattress with a woven blanket: stripes and a key band
  const bt = (() => {
    const c = cv(512, 256), x = c.getContext('2d');
    x.fillStyle = blanket; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 256; i += 3) { x.fillStyle = i % 6 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'; x.fillRect(0, i, 512, 1); }
    x.fillStyle = '#15100d'; x.fillRect(0, 18, 512, 12); x.fillRect(0, 226, 512, 12);
    x.fillStyle = stripe; x.fillRect(0, 34, 512, 4); x.fillRect(0, 218, 512, 4);
    x.strokeStyle = stripe; x.lineWidth = 3; meanderPath(x, 0, 52, 512, 22, 36); x.stroke();
    x.save(); x.translate(0, 182); meanderPath(x, 0, 0, 512, 22, 36); x.stroke(); x.restore();
    const rn = rng(11); for (let i = 0; i < 2500; i++) { x.fillStyle = rn() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; x.fillRect(rn() * 512, rn() * 256, 2, 2); }
    return ctex(c, { repeat: [1, 1] });
  })();
  const mat = phys({ map: bt, roughness: 0.95, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffd7b0), bumpMap: bt, bumpScale: 0.35 });
  const mattress = new THREE.Mesh(B.roundedBox(length * 0.96, 0.085, width * 0.94, 0.04, 6), mat); mattress.position.y = top + 0.092; mattress.castShadow = true; mattress.receiveShadow = true; g.add(mattress);
  g.userData.top = top + 0.135; g.userData.headboard = hb;
  g.userData.blanketMat = mat;
  return g;
}
export function makeBolster(len = 0.55, r = 0.085, color = '#e9d8b0') {
  const g = new THREE.CapsuleGeometry(r, len, 10, 20); g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, phys({ color, roughness: 0.9, sheen: 0.7, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.5 })); m.castShadow = true; m.receiveShadow = true; return m;
}

// a large mixing bowl (krater) on a stand
export function makeKrater(h = 0.5) {
  const M = mats(), g = new THREE.Group();
  const prof = [[0, 0], [0.09, 0], [0.1, 0.012], [0.07, 0.03], [0.05, 0.08], [0.058, 0.13], [0.115, 0.2], [0.17, 0.28], [0.19, 0.36], [0.185, 0.42], [0.2, 0.44], [0.2, 0.455], [0.175, 0.452], [0.165, 0.43]].map(([r, y]) => [r * (h / 0.5), y * (h / 0.5)]);
  const tex = (() => {
    const c = cv(1024, 512), x = c.getContext('2d');
    x.fillStyle = '#15100d'; x.fillRect(0, 0, 1024, 512);
    x.fillStyle = '#b8582c'; x.fillRect(0, 120, 1024, 240);
    x.fillStyle = '#15100d';
    // a procession band: abstract black-figure style silhouettes (generic, no gods, no symbols)
    for (let i = 0; i < 14; i++) {
      const cx = 36 + i * 72, yb = 340;
      x.beginPath(); x.ellipse(cx, yb - 120, 14, 18, 0, 0, TAU); x.fill();                      // head
      x.beginPath(); x.moveTo(cx - 20, yb); x.lineTo(cx + 20, yb); x.lineTo(cx + 12, yb - 100); x.lineTo(cx - 12, yb - 100); x.closePath(); x.fill();   // robe
      x.fillRect(cx + 8, yb - 90, 30 + (i % 3) * 8, 7);
    }
    x.strokeStyle = '#15100d'; x.lineWidth = 5; meanderPath(x, 0, 30, 1024, 60, 80); x.stroke();
    x.fillStyle = '#f0e2c0'; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(12 + i * 25.6, 420, 3.5, 0, TAU); x.fill(); }
    return ctex(c);
  })();
  const m = new THREE.Mesh(B.lathe(prof, 56), phys({ map: tex, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.18, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; g.add(m);
  for (const sg of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.08 * h / 0.5, 0.01, 10, 20, Math.PI), M.glaze); hd.position.set(sg * 0.2 * h / 0.5, 0.32 * h / 0.5, 0); hd.rotation.z = sg > 0 ? -Math.PI / 2 : Math.PI / 2; g.add(hd); }
  return g;
}

// a standing bronze lamp: turned stem, tripod foot, a cross-arm with hanging oil lamps (flames are added by the world)
export function makeLampStand(h = 1.5) {
  const M = mats(), g = new THREE.Group(), anchors = [];
  const base = [[0, 0], [0.14, 0], [0.15, 0.012], [0.12, 0.03], [0.05, 0.06], [0.026, 0.16]];
  g.add(Object.assign(new THREE.Mesh(B.lathe(base, 36), M.bronzeDark), { castShadow: true }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, h - 0.16, 16), M.bronze); stem.position.y = 0.16 + (h - 0.16) / 2; stem.castShadow = true; g.add(stem);
  for (const y of [0.5, 0.9, 1.25]) { const r = new THREE.Mesh(B.lathe([[0.014, 0], [0.034, 0.006], [0.038, 0.016], [0.034, 0.026], [0.014, 0.032]], 20), M.bronzeDark); r.position.y = y; g.add(r); }
  const top = new THREE.Mesh(B.lathe([[0.02, h - 0.03], [0.06, h - 0.012], [0.08, h + 0.01], [0.0, h + 0.012]], 24), M.bronze); g.add(top);
  for (const a of [0, 1, 2]) {
    const ang = (a / 3) * TAU + 0.3, L = 0.2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, L, 8), M.bronzeDark); arm.position.set(Math.cos(ang) * L / 2, h - 0.04, Math.sin(ang) * L / 2); arm.rotation.z = Math.PI / 2; arm.rotation.y = -ang; g.add(arm);
    const lamp = new THREE.Mesh(B.lathe([[0.0, 0], [0.026, 0.004], [0.04, 0.02], [0.034, 0.04], [0.016, 0.046], [0, 0.044]], 20), M.bronze);
    lamp.position.set(Math.cos(ang) * L, h - 0.1, Math.sin(ang) * L); lamp.scale.set(1.5, 1, 1); lamp.rotation.y = -ang; lamp.castShadow = true; g.add(lamp);
    anchors.push(new THREE.Vector3(Math.cos(ang) * (L + 0.05), h - 0.04, Math.sin(ang) * (L + 0.05)));
  }
  g.userData.flames = anchors;
  return g;
}

// fluted doric column
export function makeColumn(h = 4.2, r = 0.26) {
  const M = mats(), g = new THREE.Group();
  const shaft = new THREE.CylinderGeometry(r * 0.82, r, h, 40, 1, false); shaft.translate(0, h / 2, 0);
  const tex = (() => { const c = cv(512, 64), x = c.getContext('2d'); x.fillStyle = '#d6c9ad'; x.fillRect(0, 0, 512, 64); for (let i = 0; i < 20; i++) { const gr = x.createLinearGradient(i * 25.6, 0, i * 25.6 + 25.6, 0); gr.addColorStop(0, 'rgba(0,0,0,0.38)'); gr.addColorStop(0.18, 'rgba(0,0,0,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); x.fillStyle = gr; x.fillRect(i * 25.6, 0, 25.6, 64); } return ctex(c); })();
  const m = new THREE.Mesh(shaft, std({ map: tex, roughness: 0.85 })); m.castShadow = true; m.receiveShadow = true; g.add(m);
  const cap = new THREE.Mesh(B.lathe([[r * 0.82, h], [r * 1.05, h + 0.04], [r * 1.35, h + 0.1], [r * 1.35, h + 0.15], [r * 0.9, h + 0.15], [0, h + 0.15]], 40), std({ color: 0xcdbf9e, roughness: 0.85 }));
  g.add(cap);
  const abacus = new THREE.Mesh(B.roundedBox(r * 3, 0.12, r * 3, 0.01, 2), std({ color: 0xc3b592, roughness: 0.9 })); abacus.position.y = h + 0.21; g.add(abacus);
  const bs = new THREE.Mesh(B.lathe([[0, 0], [r * 1.25, 0], [r * 1.25, 0.06], [r * 1.05, 0.1], [r * 0.95, 0.18]], 40), std({ color: 0xcdbf9e, roughness: 0.85 })); bs.receiveShadow = true; g.add(bs);
  return g;
}

// food and small vessels for the low table
export function makeTable() {
  const M = mats(), g = new THREE.Group();
  const top = new THREE.Mesh(B.roundedBox(0.8, 0.05, 0.5, 0.015, 3), M.woodLight); top.position.y = 0.34; top.castShadow = true; top.receiveShadow = true; g.add(top);
  for (const [x, z] of [[-0.34, -0.2], [0.34, -0.2], [-0.34, 0.2], [0.34, 0.2]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.32, 10), M.wood); l.position.set(x, 0.16, z); l.castShadow = true; g.add(l); }
  // a bowl of figs, a flat loaf, a small oil jug
  const bowl = new THREE.Mesh(B.lathe([[0, 0.365], [0.07, 0.372], [0.1, 0.4], [0.105, 0.41], [0.095, 0.41], [0.065, 0.385], [0, 0.378]], 32), M.terracotta); bowl.position.set(-0.15, 0, 0.02); bowl.castShadow = true; g.add(bowl);
  for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), std({ color: i % 2 ? 0x5a2b4a : 0x6d3a5e, roughness: 0.55 })); f.scale.y = 1.2; f.position.set(-0.15 + Math.cos(i * 0.9) * 0.05, 0.405 + (i > 4 ? 0.03 : 0), 0.02 + Math.sin(i * 0.9) * 0.05); f.castShadow = true; g.add(f); }
  const loaf = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.105, 0.035, 24), std({ color: 0xc89a5c, roughness: 0.8 })); loaf.position.set(0.14, 0.382, -0.06); loaf.castShadow = true; g.add(loaf);
  const jug = new THREE.Mesh(B.lathe([[0, 0], [0.04, 0], [0.05, 0.04], [0.045, 0.09], [0.022, 0.12], [0.026, 0.14], [0.034, 0.155], [0.03, 0.16], [0.016, 0.145], [0.016, 0.12]], 24), M.glaze); jug.position.set(0.25, 0.365, 0.1); jug.castShadow = true; g.add(jug);
  return g;
}
