// Pond Hockey Slide: the lit 3D pond (game-owned art, all procedural: canvas textures and analytic geometry, no asset bytes).
// Sim axes: x across, y along the pond (you attack -y). three (X, Y, Z) = sim (x, height, y), so the top-down camera sees the pond
// exactly as the 2D layer lays it out. Contents: snow ground with pines, the snowbank ring (a lit, rounded, shadow-casting wall
// cut open at both goals), the ice (the 2D ice painting as its colour map, clearcoat sheen, goal-line paint), two real goals
// (posts, bar, slanted net), loose-snow drifts, the skate-trail layer.
import * as THREE from '../vendor3d/three.js';
import { HW, HH, CORNER, GOAL_HW, NET_D } from '../src/sim.js';
import { drawIce, hash } from '../src/art.js';

export const TAU = Math.PI * 2;
export const BANK_W = 46, BANK_H = 40, GAP = 96;
export function cvs(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; }
export function tex(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// rounded-rectangle outline in sim coords, starting at the top middle and running left (counter-clockwise on screen)
export function rrPts(hw, hh, r, cuts = [], n = 10) {
  const P = [], edge = (x0, y0, x1, y1, ex = []) => {
    const len = Math.hypot(x1 - x0, y1 - y0), k = Math.max(1, Math.ceil(len / 36)), ts = [];
    for (let i = 0; i < k; i++) ts.push(i / k);
    for (const e of ex) { const t = ((e - x0) / (x1 - x0)); if (t > 0 && t < 1) ts.push(t); }
    ts.sort((a, b) => a - b); for (const t of ts) P.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
  };
  const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); P.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  edge(0, -hh, -(hw - r), -hh, cuts); arc(-(hw - r), -(hh - r), -Math.PI / 2, -Math.PI);
  edge(-hw, -(hh - r), -hw, hh - r); arc(-(hw - r), hh - r, Math.PI, Math.PI / 2);
  edge(-(hw - r), hh, hw - r, hh, cuts); arc(hw - r, hh - r, Math.PI / 2, 0);
  edge(hw, hh - r, hw, -(hh - r)); arc(hw - r, -(hh - r), 0, -Math.PI / 2);
  edge(hw - r, -hh, 0, -hh, cuts);
  return P;
}

function noiseSnow(size = 256, base = [233, 241, 248]) {
  return cvs(size, size, (g, w) => {
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, w, w);
    const im = g.getImageData(0, 0, w, w), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (hash(i * 0.37) - 0.5) * 22, s = hash(i * 1.91) > 0.985 ? 30 : 0; d[i] += n + s; d[i + 1] += n + s; d[i + 2] += n * 0.9 + s; }
    g.putImageData(im, 0, 0);
  });
}
const gridTex = () => tex(cvs(64, 64, (g, w) => { g.clearRect(0, 0, w, w); g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 5; g.strokeRect(0, 0, w, w); }), { repeat: [1, 1] });
function quad(p0, p1, p2, p3, ru, rv) {
  const g = new THREE.BufferGeometry(), v = [...p0, ...p1, ...p2, ...p3];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, rv, ru, rv, ru, 0], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); return g;
}

// the sky that feeds the ice's reflections: cool zenith, warm low sun
export function envScene() {
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(50, 32, 16), col = [], pos = g.attributes.position, c = new THREE.Color(), a = new THREE.Color('#7fa8dc'), b = new THREE.Color('#f6ddb8');
  for (let i = 0; i < pos.count; i++) { const h = pos.getY(i) / 50; c.copy(b).lerp(a, Math.pow(Math.max(0, h), 0.6)); if (h < 0) c.set('#cfdbe6'); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 2) })); sun.position.set(-26, 28, -22); s.add(sun);
  return s;
}

export async function buildRink(tierName, nap = () => Promise.resolve()) {
  const root = new THREE.Group();
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex(noiseSnow(), { repeat: [3, 3] }), roughness: 0.92, metalness: 0 });
  // ---- ground: a wide snow field, bluer toward the horizon (the fog does the rest)
  const gMap = tex(noiseSnow(256, [214, 228, 240]), { repeat: [90, 90] });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0xffffff, map: gMap, color: 0x93abc2, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.6; ground.receiveShadow = false; root.add(ground);
  await nap();

  // ---- ice: the 2D painting (scratches, circle, centre line) as the colour map; clearcoat gives the sheen
  const ice2d = tex(cvs(1020, 1800, (g, w, h) => { g.translate(w / 2, h / 2); g.scale(2, 2); drawIce(g, 0);
    const v = g.createRadialGradient(0, 0, 0, 0, 0, 300); v.addColorStop(0, 'rgba(110,160,200,0.42)'); v.addColorStop(1, 'rgba(110,160,200,0)'); g.fillStyle = v; g.fillRect(-HW, -HH, HW * 2, HH * 2); }));
  const ip = rrPts(HW, HH, CORNER, [], 14), shape = new THREE.Shape(ip.map(([x, y]) => new THREE.Vector2(x, -y)));
  const ig = new THREE.ShapeGeometry(shape); ig.rotateX(-Math.PI / 2);
  { const p = ig.attributes.position, uv = ig.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + HW) / (2 * HW), (HH - p.getZ(i)) / (2 * HH)); uv.needsUpdate = true; }
  const iceMat = new THREE.MeshPhysicalMaterial({ map: ice2d, color: 0xb4d0e6, roughness: 0.2, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 0.7, emissive: new THREE.Color(1, 0.84, 0.5), emissiveIntensity: 0 });
  const ice = new THREE.Mesh(ig, iceMat); ice.position.y = 0.05; ice.receiveShadow = true; root.add(ice);
  // the painted goal lines
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd23c3c, transparent: true, opacity: 0.7 });
  for (const sy of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(GOAL_HW * 2, 3), lineMat); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.12, sy * (HH - 2)); root.add(m); }
  await nap();

  // ---- the snowbank ring: two halves (left, right) so the goals stay open; rounded top, bulging walls
  const bev = { depth: BANK_H - 22, bevelEnabled: true, bevelThickness: 11, bevelSize: 9, bevelSegments: 6, curveSegments: 1 };
  const cutX = -(GAP + 9), inner = rrPts(HW + 9, HH + 9, CORNER + 9, [cutX, -cutX]), outer = rrPts(HW + BANK_W - 9, HH + BANK_W - 9, CORNER + BANK_W * 0.8 - 9, [cutX, -cutX]);
  const half = (sgn) => {
    const sel = (P) => P.filter(([x]) => sgn * x >= -cutX - 0.01).map(([x, y]) => [x, y]);
    // ordered along the loop: for the left half keep the order; for the right half the filter keeps a contiguous arc too
    const o = sel(outer), i = sel(inner);
    const fix = (L) => { // rotate so the arc is contiguous (the right half wraps around index 0)
      let k = -1; for (let j = 0; j < L.length; j++) if (Math.hypot(L[j][0] - L[(j + 1) % L.length][0], L[j][1] - L[(j + 1) % L.length][1]) > 60) k = j;
      return k < 0 ? L : L.slice(k + 1).concat(L.slice(0, k + 1));
    };
    const oo = fix(o), ii = fix(i);
    return new THREE.Shape(oo.concat(ii.slice().reverse()).map(([x, y]) => new THREE.Vector2(x, -y)));
  };
  for (const sgn of [-1, 1]) {
    const g = new THREE.ExtrudeGeometry(half(sgn), bev); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, snowMat); m.position.y = 11 - 0.2; m.castShadow = true; m.receiveShadow = true; root.add(m);
  }
  // trampled floor behind each goal
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xb5c9da, roughness: 0.95 });
  for (const sy of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(GAP * 2 + 6, BANK_W + 22), floorMat); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.2, sy * (HH + (BANK_W + 22) / 2 - 8)); m.receiveShadow = true; root.add(m); }
  await nap();

  // ---- the goals
  const goals = [];
  const post = new THREE.MeshStandardMaterial({ color: 0xd8372f, roughness: 0.35, metalness: 0.2 }), rail = new THREE.MeshStandardMaterial({ color: 0xeef2f6, roughness: 0.4, metalness: 0.3 });
  const netMat = new THREE.MeshBasicMaterial({ map: gridTex(), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9, color: 0xffffff });
  const tube = (a, b, r, mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat); m.position.copy(A).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); m.castShadow = true; return m;
  };
  for (const sy of [-1, 1]) {
    const g = new THREE.Group(), GH = 36, RB = 9;
    for (const sx of [-1, 1]) {
      g.add(tube([sx * GOAL_HW, 0, 0], [sx * GOAL_HW, GH, 0], 5.5, post));
      const knob = new THREE.Mesh(new THREE.SphereGeometry(5.8, 12, 8), post); knob.position.set(sx * GOAL_HW, GH, 0); knob.castShadow = true; g.add(knob);
      g.add(tube([sx * GOAL_HW, GH, 0], [sx * GOAL_HW, RB, NET_D], 2.4, rail)); g.add(tube([sx * GOAL_HW, 1.5, 0], [sx * GOAL_HW, 1.5, NET_D], 2.4, rail));
      g.add(tube([sx * GOAL_HW, RB, NET_D], [sx * GOAL_HW, 1.5, NET_D], 2.4, rail));
    }
    g.add(tube([-GOAL_HW, GH, 0], [GOAL_HW, GH, 0], 3.6, post)); g.add(tube([-GOAL_HW, RB, NET_D], [GOAL_HW, RB, NET_D], 2.4, rail)); g.add(tube([-GOAL_HW, 1.5, NET_D], [GOAL_HW, 1.5, NET_D], 2.4, rail));
    const nets = new THREE.Group(), nm = netMat.clone();
    const nTop = quad([-GOAL_HW, GH, 0], [GOAL_HW, GH, 0], [GOAL_HW, RB, NET_D], [-GOAL_HW, RB, NET_D], GOAL_HW * 2 / 9, 6);
    const nBack = quad([-GOAL_HW, RB, NET_D], [GOAL_HW, RB, NET_D], [GOAL_HW, 1.5, NET_D], [-GOAL_HW, 1.5, NET_D], GOAL_HW * 2 / 9, 1);
    nets.add(new THREE.Mesh(nTop, nm), new THREE.Mesh(nBack, nm));
    for (const sx of [-1, 1]) nets.add(new THREE.Mesh(quad([sx * GOAL_HW, 1.5, 0], [sx * GOAL_HW, GH, 0], [sx * GOAL_HW, RB, NET_D], [sx * GOAL_HW, 1.5, NET_D], 6, 5), nm));
    nets.children.forEach((c) => { c.renderOrder = 3; }); g.add(nets);
    g.position.set(0, 0, sy * HH); if (sy < 0) g.rotation.y = Math.PI;
    root.add(g); goals.push({ sy, group: g, net: nm });
  }
  await nap();

  // ---- pines: three stacked cones with a snow cap, instanced; plus soft contact shadows
  const trees = [], TN = tierName === 'low' ? 60 : 140;
  for (let i = 0; trees.length < TN && i < 900; i++) {
    const a = hash(i * 1.7) * TAU, rr = 330 + Math.pow(hash(i * 3.1), 0.7) * 1900, x = Math.cos(a) * rr * 0.62, y = Math.sin(a) * rr;
    if (Math.abs(x) < HW + BANK_W + 70 && Math.abs(y) < HH + BANK_W + 90) continue;
    trees.push({ x, y, s: 0.8 + hash(i * 5.3) * 0.9, rot: hash(i * 7.7) * TAU, tint: hash(i * 2.3) });
  }
  const layers = [[36, 52, 26, '#1b4a3b'], [28, 46, 52, '#235a47'], [19, 38, 74, '#2c6c55']];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  for (const [r, h, y0, c] of layers) {
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.01, r, h, 14, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), trees.length);
    trees.forEach((t, i) => { m4.compose(ps.set(t.x, (y0 + h * 0.0) * t.s + h * 0.5 * t.s - 6, t.y), q.setFromEuler(e.set(0, t.rot, 0)), sc.set(t.s, t.s, t.s)); im.setMatrixAt(i, m4); im.setColorAt(i, col.set(c).offsetHSL((t.tint - 0.5) * 0.03, 0, (t.tint - 0.5) * 0.06)); });
    root.add(im);
  }
  const cap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.01, 12, 22, 12, 1), snowMat, trees.length);
  trees.forEach((t, i) => { m4.compose(ps.set(t.x, 74 * t.s + 11 * t.s + 14 * t.s, t.y), q.identity(), sc.set(t.s, t.s, t.s)); cap.setMatrixAt(i, m4); }); root.add(cap);
  const blobTex = tex(cvs(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(20,40,70,0.55)'); r.addColorStop(1, 'rgba(20,40,70,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
  const blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }), trees.length);
  trees.forEach((t, i) => { m4.compose(ps.set(t.x + 14 * t.s, 0.3, t.y + 18 * t.s), q.identity(), sc.set(110 * t.s, 1, 110 * t.s)); blobs.setMatrixAt(i, m4); }); root.add(blobs);
  await nap();

  // ---- loose-snow drifts on the ice (rebuilt when the scatter changes)
  const drifts = new THREE.Group(); root.add(drifts);
  let driftKey = '';
  const driftGeo = new THREE.SphereGeometry(1, 28, 12, 0, TAU, 0, Math.PI / 2);
  function setDrifts(list) {
    const key = list.map((s) => `${Math.round(s.x)},${Math.round(s.y)},${Math.round(s.r)},${s.seed}`).join('|');
    if (key === driftKey) return; driftKey = key;
    for (const c of [...drifts.children]) { drifts.remove(c); c.geometry.dispose(); }
    for (const s of list) {
      const g = driftGeo.clone(), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 0.9 + 0.2 * hash(s.seed * 7 + Math.round((Math.atan2(z, x) + 4) * 3) * 3.7) + 0.05 * hash(i + s.seed); p.setXYZ(i, x * n, y * (0.95 + 0.1 * hash(i * 0.3 + s.seed)), z * n); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, snowMat); m.scale.set(s.r, s.r * 0.34, s.r * 0.94); m.position.set(s.x, 0.1, s.y); m.castShadow = true; m.receiveShadow = true; drifts.add(m);
    }
  }

  // ---- skate trails (a thin line layer just above the ice)
  const MAXT = 1500, tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXT * 6), 3)); tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXT * 8), 4));
  const trails = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false })); trails.frustumCulled = false; trails.renderOrder = 1; root.add(trails);
  function setTrails(list) {
    const P = tg.attributes.position.array, C = tg.attributes.color.array; let n = 0;
    if (list) for (const t of list) { if (n >= MAXT) break; P.set([t.x0, 0.7, t.y0, t.x1, 0.7, t.y1], n * 6); const a = Math.min(1, t.a * 0.8); C.set([0.93, 0.98, 1, a, 0.62, 0.8, 0.95, a * 0.5], n * 8); n++; }
    tg.setDrawRange(0, n * 2); tg.attributes.position.needsUpdate = tg.attributes.color.needsUpdate = true;
  }
  return { root, ice, iceMat, goals, setDrifts, setTrails, snowMat };
}
