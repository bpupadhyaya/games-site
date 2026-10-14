// A real 3D pinisi: lofted planked hull (keel, stem, sternpost, ribs, deck, poop cabin, bulwark), two masts with booms and gaffs,
// seven tan sails (3 jibs, 2 gaff sails, 2 topsails) that billow to leeward with the wind, standing rigging, bowsprit, quarter rudders.
// Model frame: +X forward (bow), +Y up, +Z starboard, water line at y = 0, hull length 12 units (about 12 m at hero scale).
// Presentation only: it is driven by plain numbers handed in by the presenter (setting, wind side, strength), never reads the sim.
import { THREE } from '../vendor3d/index.js';
import { TAU, clamp, lerp, smooth, hash1, canvas, texOf, rngOf, mergeParts, mat4 } from './util.js';

const { Mesh, Group, BufferGeometry, Float32BufferAttribute, MeshStandardMaterial, DoubleSide, CylinderGeometry, BoxGeometry, TubeGeometry,
  CatmullRomCurve3, Vector3, LineSegments, LineBasicMaterial, ShapeGeometry, Shape, Color, SphereGeometry } = THREE;

export const HULL_LEN = 12;
const NU = 56, NV = 18;                       // lofting grid: stations along the hull, strakes up the side
const TIMBER_TINT = { teak: '#b9803f', ironwood: '#7a5230', meranti: '#cf8c52' };
export const SIZE_SCALE = { prahu: { l: 0.84, b: 0.9, h: 0.86 }, pinisi: { l: 1, b: 1, h: 1 }, grand: { l: 1.2, b: 1.12, h: 1.12 } };

// ---- hull sections -----------------------------------------------------------------------------------------------------------------
const BEAM = 1.82;
function beamAt(u) { return BEAM * (u < 0.38 ? 0.7 + 0.3 * Math.sin((u / 0.38) * Math.PI / 2) : Math.pow(Math.cos(((u - 0.38) / 0.62) * Math.PI / 2), 0.82)); }
function keelAt(u) { return -1.5 + 0.42 * Math.pow(Math.max(0, 0.28 - u) / 0.28, 2) + 0.95 * Math.pow(Math.max(0, u - 0.52) / 0.48, 2.1); }
function sheerAt(u) { return 1.3 + 0.62 * Math.pow(Math.max(0, u - 0.45) / 0.55, 2.2) + 0.5 * Math.pow(Math.max(0, 0.3 - u) / 0.3, 2); }
const widthAt = (v, u) => (0.05 + 0.95 * Math.pow(v, 0.52)) * (1 + (0.05 + 0.15 * smooth(0.5, 1, u)) * v * v);
function rakeAt(u, v) { return 1.15 * Math.pow(smooth(0.5, 1, u), 1.4) * Math.pow(v, 2.0) - 0.22 * (1 - smooth(0, 0.22, u)) * v; }
export function hullPoint(u, v, side, L = HULL_LEN) {
  const K = keelAt(u), S = sheerAt(u), B = beamAt(u);
  return new Vector3((u - 0.5) * L + rakeAt(u, v), K + (S - K) * v, side * B * widthAt(v, u));
}
const DECK_Y = 1.0, POOP_Y = 1.6;
function vAtY(u, y) { const K = keelAt(u), S = sheerAt(u); return clamp((y - K) / (S - K), 0, 1); }

// ---- textures ----------------------------------------------------------------------------------------------------------------------
const texCache = new Map();
function plankTexture(tint) {
  const key = 'p' + tint; if (texCache.has(key)) return texCache.get(key);
  const W = 512, H = 128, c = canvas(W, H), x = c.getContext('2d'), r = rngOf(7);
  const base = new Color(tint); const css = (k) => `rgb(${Math.round(clamp(base.r * 255 * k, 0, 255))},${Math.round(clamp(base.g * 255 * k, 0, 255))},${Math.round(clamp(base.b * 255 * k, 0, 255))})`;
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, css(1.1)); g.addColorStop(0.5, css(0.96)); g.addColorStop(1, css(0.86));
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const y = r() * H, a = 0.05 + r() * 0.13, amp = 1 + r() * 3.5, fr = 0.01 + r() * 0.02, ph = r() * TAU;
    x.strokeStyle = r() < 0.7 ? `rgba(55,26,8,${a})` : `rgba(255,236,190,${a * 0.8})`; x.lineWidth = 0.6 + r() * 1.6; x.beginPath();
    for (let s = 0; s <= W; s += 10) { const yy = y + Math.sin(s * fr + ph) * amp; s ? x.lineTo(s, yy) : x.moveTo(s, yy); }
    x.stroke();
  }
  x.fillStyle = 'rgba(25,10,2,0.65)'; x.fillRect(0, 0, W, 5); x.fillRect(0, H - 4, W, 4);      // seams between strakes
  x.fillStyle = 'rgba(255,230,170,0.16)'; x.fillRect(0, 5, W, 3);
  const bx = W * (0.35 + r() * 0.3); x.fillStyle = 'rgba(25,10,2,0.6)'; x.fillRect(bx, 0, 3, H);      // butt joint + nails
  x.fillStyle = 'rgba(20,12,6,0.8)'; for (const nx of [bx - 14, bx + 14]) for (const ny of [22, 64, 104]) { x.beginPath(); x.arc(nx, ny, 2.2, 0, TAU); x.fill(); }
  const t = texOf(c, { repeat: [1, 1] }); t.wrapS = t.wrapT = THREE.RepeatWrapping; texCache.set(key, t); return t;
}
function deckTexture() {
  if (texCache.has('deck')) return texCache.get('deck');
  const S = 256, c = canvas(S), x = c.getContext('2d'), r = rngOf(11);
  x.fillStyle = '#c9a56a'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) {
    const y0 = i * S / 4; x.fillStyle = `rgba(${90 + r() * 40},${55 + r() * 30},20,${0.1 + r() * 0.15})`; x.fillRect(0, y0, S, S / 4);
    x.fillStyle = 'rgba(40,22,8,0.7)'; x.fillRect(0, y0, S, 3);
    for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(70,40,14,${0.06 + r() * 0.1})`; x.beginPath(); const y = y0 + 6 + r() * (S / 4 - 10); x.moveTo(0, y); x.lineTo(S, y + (r() - 0.5) * 3); x.stroke(); }
    const bx = r() * S; x.fillStyle = 'rgba(40,22,8,0.6)'; x.fillRect(bx, y0, 2, S / 4);
  }
  const t = texOf(c, { repeat: [1, 1] }); texCache.set('deck', t); return t;
}
function sailTexture() {
  if (texCache.has('sail')) return texCache.get('sail');
  const W = 256, H = 512, c = canvas(W, H), x = c.getContext('2d'), r = rngOf(23);
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#ecdcb4'); g.addColorStop(0.5, '#e2cc9c'); g.addColorStop(1, '#d6bd88');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,250,235,0.05)' : 'rgba(120,90,40,0.06)'; x.fillRect(r() * W, r() * H, 1 + r() * 2, 1); }
  const panels = 9;
  for (let i = 1; i < panels; i++) {
    const y = i * H / panels; x.fillStyle = 'rgba(90,64,28,0.5)'; x.fillRect(0, y - 1, W, 2.5); x.fillStyle = 'rgba(255,248,226,0.4)'; x.fillRect(0, y + 2, W, 1.5);
    x.strokeStyle = 'rgba(80,56,24,0.28)'; x.setLineDash([5, 5]); x.beginPath(); x.moveTo(0, y - 4); x.lineTo(W, y - 4); x.moveTo(0, y + 5); x.lineTo(W, y + 5); x.stroke(); x.setLineDash([]);
  }
  const grad = x.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, 'rgba(120,90,50,0)'); grad.addColorStop(1, 'rgba(90,60,30,0.2)'); x.fillStyle = grad; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(70,46,22,0.55)'; x.lineWidth = 6; x.strokeRect(2, 2, W - 4, H - 4);      // bolt rope border
  const t = texOf(c, {}); texCache.set('sail', t); return t;
}

// ---- helpers -----------------------------------------------------------------------------------------------------------------------
function tubeAlong(points, radius, mat, seg = 40, rs = 6) {
  const m = new Mesh(new TubeGeometry(new CatmullRomCurve3(points), seg, radius, rs, false), mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(r0, r1, len, mat, seg = 10) { const m = new Mesh(new CylinderGeometry(r1, r0, len, seg), mat); m.castShadow = true; return m; }
function between(a, b, r, mat) {
  const d = new Vector3().subVectors(b, a), m = cyl(r, r, d.length(), mat, 6);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), d.normalize()); return m;
}

// A sail: bilinear grid between four corners (x,y in the pivot frame), billows in z. corners: [tack, clew, peak, head2] = [foot-luff, foot-leech, head-luff, head-leech].
function makeSail(corners, mat, nx = 10, ny = 8) {
  const g = new BufferGeometry(), pos = new Float32Array((nx + 1) * (ny + 1) * 3), uv = new Float32Array((nx + 1) * (ny + 1) * 2), idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const k = j * (nx + 1) + i; uv[k * 2] = i / nx; uv[k * 2 + 1] = j / ny; }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mesh = new Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const S = { mesh, corners, nx, ny, amp: 0, side: 1, slack: 0, size: 1, seed: Math.random() };
  S.update = (t, amp, side, slack, size, drive = 1) => {
    const [T, C, P, H] = corners, p = g.attributes.position.array;
    for (let j = 0; j <= ny; j++) {
      const tt = j / ny;
      for (let i = 0; i <= nx; i++) {
        const s = i / nx, k = (j * (nx + 1) + i) * 3;
        const fx = lerp(lerp(T[0], C[0], s), lerp(P[0], H[0], s), tt);
        let fy = lerp(lerp(T[1], C[1], s), lerp(P[1], H[1], s), tt);
        fy = T[1] + (fy - T[1]) * size;
        const bell = Math.pow(Math.sin(Math.PI * s), 0.8) * Math.pow(Math.sin(Math.PI * clamp(tt, 0, 1) * 0.96 + 0.06), 0.7);
        const flut = Math.sin(t * (3.1 + 1.1 * drive) - s * 6.5 - tt * 2.2 + S.seed * 9) * (0.05 + 0.5 * slack) * s * (0.4 + tt * 0.8);
        p[k] = fx; p[k + 1] = fy; p[k + 2] = side * amp * bell * (0.35 + 0.65 * (1 - slack)) + flut * (side || 1) * 0.55;
      }
    }
    g.attributes.position.needsUpdate = true; g.computeVertexNormals();
  };
  return S;
}

// ---- the ship ------------------------------------------------------------------------------------------------------------------------
export function buildPinisi(opts = {}) {
  const sz = SIZE_SCALE[opts.size] || SIZE_SCALE.pinisi, tint = TIMBER_TINT[opts.timber] || TIMBER_TINT.teak, L = HULL_LEN;
  const root = new Group(), ship = new Group(); root.add(ship); ship.scale.set(sz.l, sz.h, sz.b);
  const timberCol = new Color(tint);
  const hullMat = new MeshStandardMaterial({ map: plankTexture(tint), vertexColors: true, roughness: 0.7, metalness: 0.0, side: DoubleSide });
  const darkWood = new MeshStandardMaterial({ color: timberCol.clone().multiplyScalar(0.55), roughness: 0.75 });
  const midWood = new MeshStandardMaterial({ color: timberCol.clone().multiplyScalar(0.85), roughness: 0.65 });
  const ropeMat = new LineBasicMaterial({ color: 0x2a1a0e, transparent: true, opacity: 0.85 });

  // hull grid: rows j (strake line) x stations i; two sides; index order by row so the draw range grows strake by strake
  const pos = [], nor = [], uvs = [], col = [], idx = [];
  const vtx = (i, j, side) => (side > 0 ? 0 : (NU + 1) * (NV + 1)) + j * (NU + 1) + i;
  for (const side of [1, -1]) for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const u = i / NU, v = j / NV, p = hullPoint(u, v, side, L);
    pos.push(p.x, p.y, p.z); nor.push(0, 1, 0);
    uvs.push(u * 4.4 + hash1(j * 3.1) * 2.0, j);
    // colour: dark antifouling below the water line, red wale, cream top strake
    let c = new Color(1, 1, 1);
    if (p.y < -0.05) c.setRGB(0.5, 0.26, 0.2);
    else if (p.y < 0.1) c.setRGB(0.5, 0.26, 0.2).lerp(new Color(1, 1, 1), smooth(-0.05, 0.1, p.y));
    if (v > 0.92) c.setRGB(0.93, 0.87, 0.72);
    else if (v > 0.84) c.setRGB(0.62, 0.2, 0.14);
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < NV; j++) for (const side of [1, -1]) for (let i = 0; i < NU; i++) {
    const a = vtx(i, j, side), b = vtx(i + 1, j, side), c = vtx(i, j + 1, side), d = vtx(i + 1, j + 1, side);
    if (side > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const hg = new BufferGeometry();
  hg.setAttribute('position', new Float32BufferAttribute(pos, 3)); hg.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  hg.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); hg.setAttribute('color', new Float32BufferAttribute(col, 3)); hg.setIndex(idx);
  hg.computeVertexNormals();
  const hull = new Mesh(hg, hullMat); hull.castShadow = true; hull.receiveShadow = true; ship.add(hull);
  const rowIdx = NU * 6 * 2;               // indices per strake row (both sides)

  // transom (stern plate), closes the aft end once planked
  const transom = (() => {
    const p = [], ix = [];
    for (let j = 0; j <= NV; j++) for (const side of [1, -1]) { const q = hullPoint(0, j / NV, side, L); p.push(q.x - 0.02, q.y, q.z); }
    for (let j = 0; j < NV; j++) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; ix.push(a, c, b, b, c, d); }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3));
    const u = []; for (let j = 0; j <= NV; j++) u.push(0, j, 2, j); g.setAttribute('uv', new Float32BufferAttribute(u, 2)); g.setIndex(ix); g.computeVertexNormals();
    const c = []; for (let j = 0; j <= NV; j++) for (let s = 0; s < 2; s++) { const v = j / NV; const k = v > 0.92 ? [0.93, 0.87, 0.72] : v > 0.84 ? [0.62, 0.2, 0.14] : [1, 1, 1]; c.push(...k); }
    g.setAttribute('color', new Float32BufferAttribute(c, 3));
    const m = new Mesh(g, hullMat); m.castShadow = true; return m;
  })();
  ship.add(transom);

  // keel, stem, sternpost, ribs: the visible skeleton (always there; planks hide them from outside)
  const skeleton = new Group(); ship.add(skeleton);
  const keelPts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, p = hullPoint(u, 0, 1, L); keelPts.push(new Vector3(p.x, p.y - 0.04, 0)); }
  const keel = tubeAlong(keelPts, 0.13, darkWood, 48, 6); keel.scale.set(1, 1, 1.0); skeleton.add(keel);
  const stemPts = []; for (let k = 0; k <= 12; k++) { const v = k / 12, p = hullPoint(1, v, 1, L); stemPts.push(new Vector3(p.x + 0.03, p.y, 0)); }
  skeleton.add(tubeAlong(stemPts, 0.12, darkWood, 30, 6));
  const sternPts = []; for (let k = 0; k <= 10; k++) { const v = k / 10, p = hullPoint(0, v, 1, L); sternPts.push(new Vector3(p.x - 0.04, p.y, 0)); }
  skeleton.add(tubeAlong(sternPts, 0.11, darkWood, 24, 6));
  const ribs = [];
  for (let k = 0; k < 15; k++) {
    const u = 0.07 + (k / 14) * 0.86, pts = [];
    for (let j = NV; j >= 0; j -= 1) { const p = hullPoint(u, j / NV, -1, L); pts.push(new Vector3(p.x, p.y, p.z * 0.9)); }
    for (let j = 1; j <= NV; j += 1) { const p = hullPoint(u, j / NV, 1, L); pts.push(new Vector3(p.x, p.y, p.z * 0.9)); }
    const rib = tubeAlong(pts, 0.05, midWood, 40, 5); ribs.push(rib); skeleton.add(rib);
  }

  // deck + poop deck
  const deckMat = new MeshStandardMaterial({ map: deckTexture(), roughness: 0.8, side: DoubleSide });
  function deckShape(y0, u0, u1) {
    const sh = new Shape(), n = 22, top = [], bot = [];
    for (let i = 0; i <= n; i++) { const u = lerp(u0, u1, i / n), v = vAtY(u, y0), p = hullPoint(u, v, 1, L); top.push([p.x, p.z * 0.97]); bot.push([p.x, -p.z * 0.97]); }
    sh.moveTo(top[0][0], top[0][1]); for (const q of top) sh.lineTo(q[0], q[1]); for (let i = bot.length - 1; i >= 0; i--) sh.lineTo(bot[i][0], bot[i][1]); sh.closePath();
    const g = new ShapeGeometry(sh); g.rotateX(Math.PI / 2);
    const m = new Mesh(g, deckMat); m.position.y = y0; m.receiveShadow = true; m.castShadow = true; return m;
  }
  const deckMain = deckShape(DECK_Y, 0.2, 0.975), deckPoop = deckShape(POOP_Y, 0.0, 0.215);
  const topside = new Group(); topside.add(deckMain, deckPoop); ship.add(topside);
  // poop front wall + side fascia (so the raised deck has thickness)
  { const u = 0.215, vTop = vAtY(u, POOP_Y), pw = hullPoint(u, vTop, 1, L).z * 0.97, wall = new Mesh(new BoxGeometry(0.1, POOP_Y - DECK_Y, pw * 2), darkWood); wall.position.set(hullPoint(u, vTop, 1, L).x, (POOP_Y + DECK_Y) / 2, 0); wall.castShadow = true; topside.add(wall); }
  // cabin on the poop
  const cabin = new Group(); topside.add(cabin);
  { const cx = -L / 2 + 2.15, cw = 2.5, ch = 1.15, cl = 3.1;
    const body = new Mesh(new BoxGeometry(cl, ch, cw), new MeshStandardMaterial({ map: plankTexture('#d8bd8a'), roughness: 0.7 })); body.position.set(cx, POOP_Y + ch / 2, 0); body.castShadow = true; body.receiveShadow = true; cabin.add(body);
    const roof = new Mesh(new BoxGeometry(cl + 0.45, 0.14, cw + 0.4), new MeshStandardMaterial({ color: 0x7a2a1a, roughness: 0.6 })); roof.position.set(cx, POOP_Y + ch + 0.07, 0); roof.castShadow = true; cabin.add(roof);
    const glass = new MeshStandardMaterial({ color: 0x14202a, roughness: 0.15, metalness: 0.5 });
    for (const s of [1, -1]) for (let k = 0; k < 3; k++) { const w = new Mesh(new BoxGeometry(0.5, 0.45, 0.04), glass); w.position.set(cx - 0.9 + k * 0.9, POOP_Y + ch * 0.58, s * (cw / 2 + 0.02)); cabin.add(w); }
    const door = new Mesh(new BoxGeometry(0.04, 0.8, 0.6), darkWood); door.position.set(cx + cl / 2 + 0.02, POOP_Y + 0.42, 0); cabin.add(door);
    // wheel house roof lantern
    const lamp = new Mesh(new SphereGeometry(0.12, 10, 8), new MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb04a, emissiveIntensity: 1.2 })); lamp.position.set(cx - cl / 2 + 0.2, POOP_Y + ch + 0.34, 0); cabin.add(lamp);
  }
  // caprail + stanchions + bowsprit + hatch coaming + windlass + anchor
  const trim = new Group(); topside.add(trim);
  for (const side of [1, -1]) {
    const pts = []; for (let i = 0; i <= 28; i++) { const u = i / 28, p = hullPoint(u, 1.0, side, L); pts.push(new Vector3(p.x, p.y + 0.05, p.z * 1.02)); }
    trim.add(tubeAlong(pts, 0.075, new MeshStandardMaterial({ color: 0xe8d6a8, roughness: 0.55 }), 56, 5));
    for (let i = 2; i < 27; i += 2) { const u = i / 28; if (u > 0.2 && u < 0.24) continue; const p = hullPoint(u, 1.0, side, L), p0 = hullPoint(u, vAtY(u, u < 0.215 ? POOP_Y : DECK_Y), side, L); trim.add(between(new Vector3(p0.x, p0.y, p0.z * 0.98), new Vector3(p.x, p.y, p.z * 1.0), 0.04, midWood)); }
  }
  const bsp = hullPoint(0.985, 1, 1, L);
  const bowsprit = between(new Vector3(bsp.x - 1.6, DECK_Y + 0.25, 0), new Vector3(bsp.x + 3.1, bsp.y + 0.95, 0), 0.09, darkWood); trim.add(bowsprit);
  const bsTip = new Vector3(bsp.x + 3.1, bsp.y + 0.95, 0);
  const hatch = new Mesh(new BoxGeometry(2.0, 0.34, 1.35), midWood); hatch.position.set(0.3, DECK_Y + 0.17, 0); hatch.castShadow = true; trim.add(hatch);
  const lid = new Mesh(new BoxGeometry(2.2, 0.08, 1.5), darkWood); lid.position.set(0.3, DECK_Y + 0.38, 0); trim.add(lid);
  const windlass = cyl(0.17, 0.17, 1.1, darkWood, 10); windlass.rotation.x = Math.PI / 2; windlass.position.set(4.1, DECK_Y + 0.35, 0); trim.add(windlass);
  const anchor = new Group(); { const sh = cyl(0.04, 0.04, 0.8, new MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 })); anchor.add(sh); const arm = cyl(0.04, 0.04, 0.6, sh.material); arm.rotation.z = Math.PI / 2; arm.position.y = -0.3; anchor.add(arm); anchor.position.set(bsp.x - 0.9, 1.0, hullPoint(0.9, 0.8, 1, L).z + 0.12); anchor.rotation.z = 0.2; trim.add(anchor); }

  // waterline foam collar: a soft white strip hugging the hull at y = 0 (the hull meets the sea instead of floating on it)
  const collar = (() => {
    const pos = [], al = [], idx = []; const N = 40;
    for (let i = 0; i <= N; i++) for (const side of [1, -1]) {
      const u = i / N, v = vAtY(u, 0.0), p0 = hullPoint(u, v, side, L), pn = hullPoint(Math.min(1, u + 0.01), v, side, L), pp = hullPoint(Math.max(0, u - 0.01), v, side, L);
      let tx = pn.x - pp.x, tz = pn.z - pp.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const nx = side * tz * 0 + (side > 0 ? -tz : tz) * -1, nz = (side > 0 ? tx : -tx) * 1;
      void nx; void nz;
      pos.push(p0.x, 0.03, p0.z, p0.x, 0.03, p0.z + side * 0.5 * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 1.0))));
      al.push(0.9, 0);
    }
    for (let i = 0; i < N; i++) for (let s2 = 0; s2 < 2; s2++) { const a0 = i * 4 + s2 * 2, a1 = a0 + 1, b0 = a0 + 4, b1 = b0 + 1; idx.push(a0, b0, a1, a1, b0, b1); }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('aAlpha', new Float32BufferAttribute(al, 1)); g.setIndex(idx);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide,
      vertexShader: 'attribute float aAlpha; varying float vA; void main(){ vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(1.0, 0.99, 0.95, vA * 0.85);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
    const me = new Mesh(g, m); me.renderOrder = -1; me.frustumCulled = false; return me;
  })();
  ship.add(collar);

  // quarter rudders
  const rudders = [];
  for (const side of [1, -1]) {
    const r = new Group(), blade = new Mesh(new BoxGeometry(0.16, 2.4, 0.7), darkWood); blade.position.set(-0.5, -0.9, 0); blade.castShadow = true; r.add(blade);
    const tiller = cyl(0.04, 0.05, 2.2, midWood, 6); tiller.rotation.z = Math.PI / 2 - 0.25; tiller.position.set(0.5, 0.25, 0); r.add(tiller);
    r.position.set(-L / 2 - 0.5, 0.35, side * 1.25); ship.add(r); rudders.push(r);
  }

  // ---- masts, booms, gaffs, sails --------------------------------------------------------------------------------------------------
  const sailMat = new MeshStandardMaterial({ map: sailTexture(), roughness: 0.92, side: DoubleSide, emissive: 0x6a4e22, emissiveIntensity: 0.34 });
  const masts = [];
  const rig = new Group(); ship.add(rig);
  const rk = { lean: 1.14, balanced: 1, storm: 0.84 }[opts.rig] ?? 1, rb = { lean: 1.0, balanced: 1, storm: 0.9 }[opts.rig] ?? 1;
  const MAST = [{ x: -1.9, h: 10.2 * rk, boom: 4.5 * rb, gaff: 3.3 * rb, k: 'main' }, { x: 2.2, h: 9.0 * rk, boom: 3.7 * rb, gaff: 2.7 * rb, k: 'fore' }];
  const sails = [], pivots = [];
  const rigLines = [];
  for (const M of MAST) {
    const g = new Group(); g.position.set(M.x, DECK_Y, 0); rig.add(g);
    const mast = cyl(0.075, 0.16, M.h, new MeshStandardMaterial({ color: timberCol.clone().multiplyScalar(0.8), roughness: 0.6 }), 12); mast.position.y = M.h / 2; g.add(mast);
    const cap = new Mesh(new SphereGeometry(0.1, 8, 6), darkWood); cap.position.y = M.h + 0.02; g.add(cap);
    const hb = 1.35, hg = M.h * 0.58;
    // boom + gaff pivot about the mast; sails live in the same pivot frame
    const bp = new Group(); bp.position.y = 0; g.add(bp);
    const boom = cyl(0.05, 0.065, M.boom, darkWood, 8); boom.rotation.z = Math.PI / 2; boom.position.set(-M.boom / 2, hb, 0); bp.add(boom);
    const gaffAng = 0.62, gx = -M.gaff * Math.cos(gaffAng), gy = hg + M.gaff * Math.sin(gaffAng) * 0.55;
    const gaff = between(new Vector3(0.05, hg, 0), new Vector3(-M.gaff, M.h * 0.78 + 0.1, 0), 0.045, darkWood); bp.add(gaff);
    // main (gaff) sail: tack, clew, peak (luff head), head2 (gaff end)
    const tack = [0.06, hb + 0.05], clew = [-M.boom * 0.97, hb + 0.05], peak = [0.06, hg + 0.1], head2 = [-M.gaff * 0.98, M.h * 0.78 + 0.05];
    const main = makeSail([tack, clew, peak, head2], sailMat, 10, 9); bp.add(main.mesh);
    // topsail above the gaff
    const top = makeSail([[0.06, hg + 0.18], [-M.gaff * 0.98, M.h * 0.78 + 0.18], [0.06, M.h - 0.1], [0.03, M.h - 0.12]], sailMat, 6, 6); bp.add(top.mesh);
    sails.push({ s: main, kind: 'gaff', bp, M, size: 1 }, { s: top, kind: 'top', bp, M, size: 1 });
    pivots.push({ bp, M });
    masts.push({ g, mast, M });
  }
  // jibs from the bowsprit to the foremast
  const fm = MAST[1], fx = fm.x, fTop = DECK_Y + fm.h;
  const jibs = [];
  const jibDefs = [
    { tack: [bsTip.x, bsTip.y - 0.05], head: [fx + 0.1, fTop - 0.6], foot: [fx + 3.3, DECK_Y + 1.55] },
    { tack: [bsTip.x - 1.3, bsTip.y - 0.3], head: [fx + 0.1, fTop - 1.6], foot: [fx + 3.0, DECK_Y + 1.35] },
    { tack: [bsTip.x - 2.6, bsTip.y - 0.55], head: [fx + 0.1, fTop - 2.7], foot: [fx + 2.5, DECK_Y + 1.25] },
  ];
  for (const J of jibDefs) {
    // tack at the bowsprit, head up the foremast, clew near the deck: a triangle = quad with two shared corners
    const s = makeSail([J.tack, J.foot, J.head, J.head], sailMat, 8, 8); rig.add(s.mesh); jibs.push(s);
  }
  // staysail between the masts
  const mainM = MAST[0];
  const stay = makeSail([[fx - 0.1, DECK_Y + fm.h * 0.62], [mainM.x + 1.8, DECK_Y + 1.7], [fx - 0.1, fTop - 1.0], [fx - 0.1, fTop - 1.0]], sailMat, 8, 8); rig.add(stay.mesh);
  jibs.push(stay);

  // standing rigging (static lines; one LineSegments)
  { const P = []; const add = (a, b) => P.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const topM = new Vector3(mainM.x, DECK_Y + mainM.h, 0), topF = new Vector3(fx, fTop, 0);
    add(topF, bsTip); add(topM, new Vector3(fx, DECK_Y + fm.h * 0.9, 0)); add(topM, new Vector3(-L / 2 - 0.1, POOP_Y + 0.4, 0)); add(topF, new Vector3(bsp.x - 0.5, DECK_Y + 0.6, 0));
    for (const M of MAST) for (const side of [1, -1]) for (const k of [-0.9, 0, 0.9]) {
      const top = new Vector3(M.x, DECK_Y + M.h * 0.88, 0), u = clamp((M.x + L / 2 + k) / L, 0.05, 0.95), p = hullPoint(u, 1, side, L);
      add(top, new Vector3(p.x, p.y, p.z * 1.0));
    }
    for (const M of MAST) for (const side of [1, -1]) for (let r = 0; r < 7; r++) {
      const t = 0.12 + r * 0.1, u = (M.x + L / 2) / L, pa = hullPoint(clamp(u - 0.07, 0.05, 0.95), 1, side, L), pb = hullPoint(clamp(u + 0.07, 0.05, 0.95), 1, side, L), top = new Vector3(M.x, DECK_Y + M.h * 0.88, 0);
      const a = new Vector3().lerpVectors(new Vector3(pa.x, pa.y, pa.z), top, t), b = new Vector3().lerpVectors(new Vector3(pb.x, pb.y, pb.z), top, t); add(a, b);
    }
    const lg = new BufferGeometry(); lg.setAttribute('position', new Float32BufferAttribute(P, 3));
    const lines = new LineSegments(lg, ropeMat); rig.add(lines); rigLines.push(lines);
  }
  // pennant on the main mast
  const pennant = makeSail([[0, 0], [1.5, 0], [0, 0.45], [0, 0.45]], new MeshStandardMaterial({ color: 0xf2c65a, side: DoubleSide, emissive: 0x5a3a00, emissiveIntensity: 0.4, roughness: 0.8 }), 6, 2);
  pennant.mesh.position.set(mainM.x, DECK_Y + mainM.h - 0.3, 0); rig.add(pennant.mesh);

  // deck cargo: bales shown according to the hold (set by setCargo)
  const cargo = new Group(); topside.add(cargo);
  const baleMat = [0xc9a15a, 0xb07a40, 0xd8c08a, 0x8a5a3a].map((c) => new MeshStandardMaterial({ color: c, roughness: 0.95 }));
  const baleGeo = new BoxGeometry(0.62, 0.42, 0.45);
  const bales = [];
  for (let i = 0; i < 28; i++) {
    const b = new Mesh(baleGeo, baleMat[i % 4]); const col = i % 7, row = Math.floor(i / 7) % 2, lay = Math.floor(i / 14);
    b.position.set(-0.6 + col * 0.0 + (col % 2) * 0.1 + 1.9 + (col - 3) * 0.0 + col * 0.7 - 0.0, DECK_Y + 0.22 + lay * 0.42, (row ? 1 : -1) * 0.62);
    b.position.x = -2.0 + col * 0.66 + 3.4; b.position.x = 1.3 + col * 0.66 - 3.0 + 3.0 * 0.0; b.position.x = -0.6 + col * 0.66 + 2.0;
    b.rotation.y = (hash1(i) - 0.5) * 0.12; b.castShadow = true; b.visible = false; cargo.add(b); bales.push(b);
  }
  // re-lay bales on deck between the masts (fore of the hatch, aft of the foremast)
  bales.forEach((b, i) => { const col = i % 7, row = Math.floor(i / 7) % 2, lay = Math.floor(i / 14); b.position.set(-3.3 + col * 0.68 + (lay ? 0.3 : 0), DECK_Y + 0.22 + lay * 0.44, (row ? 1 : -1) * 0.7); });
  const bowLoadX = 1.2; void bowLoadX;

  const api = {
    root, ship, hull, length: L * sz.l, beam: BEAM * 2 * sz.b, sails: sails.map((q) => q.s).concat(jibs), bsTip, baleCount: 0,
    topHeight: (DECK_Y + MAST[0].h) * sz.h,
    // fraction of the hull planked 0..1 (skeleton always visible)
    setPlanks(p) {
      p = clamp(p, 0, 1);
      const rows = Math.round(NV * p);
      hull.geometry.setDrawRange(0, rows * rowIdx);
      hull.visible = rows > 0;
      transom.visible = p >= 0.95;
      topside.visible = p >= 0.999;
      skeleton.visible = true;
      api.planks = p;
    },
    // rig 0..1: masts rise first, then sails fill in one by one
    setRig(r) {
      r = clamp(r, 0, 1);
      rig.visible = r > 0.001;
      for (const m of masts) { const k = smooth(0, 0.35, r); m.mast.scale.y = Math.max(0.001, k); m.mast.position.y = (m.M.h * k) / 2; }
      api.rigReveal = r;
    },
    setCargo(n) { api.baleCount = n; bales.forEach((b, i) => { b.visible = i < n; }); },
    // state: { setting: 'full'|'reef'|'anchor', side: +-1 (wind blows toward starboard = +1), rel: 0..PI (angle between course and wind-toward; 0 = running),
    //          str: 0..1.6, heel (rad, computed here when undefined), bob (m) }
    update(t, st = {}) {
      const setting = st.setting || 'full', str = clamp(st.str ?? 0.8, 0, 1.7), side = st.side || 1, rel = st.rel ?? 1.2;
      const full = setting === 'full', reef = setting === 'reef', anchor = setting === 'anchor';
      const size = full ? 1 : reef ? 0.62 : 0.14;
      // smoothed values live on the api so frames blend (presenter feeds dt-less t; we ease here)
      const k = st.dt ? 1 - Math.exp(-st.dt * 4) : 1;
      api._size = lerp(api._size ?? size, size, k);
      api._side = lerp(api._side ?? side, side, 1 - Math.exp(-(st.dt || 1) * 2.5));
      const power = anchor ? 0.1 : clamp(str, 0.2, 1.4) * (reef ? 0.8 : 1);
      const amp = 0.25 + 1.05 * power * (api._size > 0.5 ? 1 : 0.5);
      const slack = anchor ? 0.9 : clamp(0.6 - power * 0.45, 0, 0.8);
      const swing = (8 + 66 * (1 + Math.cos(rel)) / 2) * Math.PI / 180;
      const sgn = Math.sign(api._side) * Math.pow(Math.abs(api._side), 0.5);
      const sailsVis = (api.rigReveal ?? 1);
      let i = 0;
      for (const q of sails) {
        const ph = anchor ? 0 : swing * sgn;
        q.bp.rotation.y = lerp(q.bp.rotation.y, ph, st.dt ? 1 - Math.exp(-st.dt * 3) : 1);
        const vis = sailsVis > (0.4 + i * 0.07);
        q.s.mesh.visible = vis && (q.kind === 'gaff' || api._size > 0.3);
        const sz2 = q.kind === 'top' ? api._size : api._size;
        q.s.update(t + i * 0.7, amp * (q.kind === 'top' ? 0.7 : 1), Math.sign(api._side || 1), slack, Math.max(0.12, sz2), 0.5 + power);
        i++;
      }
      jibs.forEach((s, j) => {
        s.mesh.visible = sailsVis > 0.8 + j * 0.04 && api._size > 0.3;
        s.update(t + 3 + j, amp * 0.8, Math.sign(api._side || 1), slack, Math.max(0.2, api._size), 0.8 + power);
      });
      pennant.update(t * 1.3, 0.12, 1, 0.9, 1, 1.5);
      pennant.mesh.rotation.y = -sgn * 0.6 + (full ? 0 : 0);
      // heel away from the wind, a little pitch is applied by the presenter from the sea height
      const heelTarget = anchor ? 0 : -0.0 + sgn * clamp(power, 0, 1.3) * 0.11 * Math.sin(clamp(rel, 0.15, 2.9));
      api._heel = lerp(api._heel ?? heelTarget, heelTarget, st.dt ? 1 - Math.exp(-st.dt * 1.5) : 1);
      ship.rotation.x = api._heel;
      for (const r of rudders) r.rotation.y = anchor ? 0 : Math.sin(t * 0.6) * 0.06;
    },
    dispose() { root.traverse((o) => { o.geometry?.dispose?.(); }); },
  };
  api.setPlanks(1); api.setRig(1); api.setCargo(0);
  return api;
}
void mat4;
