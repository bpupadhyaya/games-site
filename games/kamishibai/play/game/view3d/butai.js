// The kamishibai-gaki: the storyteller's wooden stage box on the carrier of a bicycle. Three doors stand open (two side doors and the lid),
// the picture card sits in a channel behind a lacquered bezel with a thin gold lip, more cards stand behind it. Real size: card 36 x 27 cm,
// box about 48 x 38 x 22 cm. Origin = the middle of the front card (z = 0 is the card face, +z towards the audience).
import { THREE, board3d as B } from '../vendor3d/index.js';
import { canvasTex, GY } from './world.js';

export const CARD_W = 0.36, CARD_H = 0.27;
const TAU = Math.PI * 2;
const mk = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; };

function woodMat(c0, c1, seed, repeat = [1, 1]) { return B.material('darkWood', { color: c0, color2: c1, seed, repeat, size: 512, roughness: 0.5 }); }
const lacquer = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.12 });
const brass = () => new THREE.MeshStandardMaterial({ color: '#d7a94a', roughness: 0.32, metalness: 0.9, envMapIntensity: 1.8 });

// a rounded flat plate (x by y, thickness z)
function plate(w, h, d, r = 0.006) { return B.roundedBox(w, h, d, Math.min(r, d / 2 - 1e-4, w / 2 - 1e-4, h / 2 - 1e-4), 2); }

export function buildButai({ pad = 0.05 } = {}) {
  const g = new THREE.Group(); g.name = 'butai';
  const outerW = CARD_W + 2 * pad, outerH = CARD_H + 2 * pad, depth = 0.2;
  const wood = woodMat('#5b3a22', '#7a5230', 5, [1, 1]);
  const wood2 = woodMat('#3d2616', '#5a3a22', 9, [1, 1]);
  const red = lacquer('#7d1f1a');
  const gold = brass();

  // cabinet body behind the channel
  const body = mk(plate(outerW, outerH, depth, 0.012), wood, 0, 0, -depth / 2 - 0.012);
  g.add(body);
  // dark channel the cards ride in (a recessed black-brown back)
  const back = mk(new THREE.PlaneGeometry(CARD_W + 0.004, CARD_H + 0.004), new THREE.MeshStandardMaterial({ color: '#150d09', roughness: 1 }), 0, 0, -0.03);
  back.castShadow = false; g.add(back);
  // channel side walls so the recess has depth
  const wallMat = new THREE.MeshStandardMaterial({ color: '#2a1810', roughness: 0.9 });
  for (const s of [-1, 1]) { const w = mk(new THREE.BoxGeometry(0.01, CARD_H + 0.01, 0.07), wallMat, s * (CARD_W / 2 + 0.005), 0, 0.0); g.add(w); }
  for (const s of [-1, 1]) { const w = mk(new THREE.BoxGeometry(CARD_W + 0.02, 0.01, 0.07), wallMat, 0, s * (CARD_H / 2 + 0.005), 0.0); g.add(w); }

  // lacquered bezel (4 strips) standing 3 cm proud of the card, with a gold inner lip
  const bz = 0.03;
  const strips = [
    [outerW, pad, 0, CARD_H / 2 + pad / 2], [outerW, pad, 0, -CARD_H / 2 - pad / 2],
    [pad, CARD_H, -CARD_W / 2 - pad / 2, 0], [pad, CARD_H, CARD_W / 2 + pad / 2, 0],
  ];
  for (const [w, h, x, y] of strips) g.add(mk(plate(w, h, bz, 0.008), red, x, y, bz / 2 + 0.002));
  // gold lip around the opening
  const lipM = gold, lt = 0.0045;
  g.add(mk(new THREE.BoxGeometry(CARD_W + 2 * lt, lt, 0.012), lipM, 0, CARD_H / 2 + lt / 2, bz + 0.004));
  g.add(mk(new THREE.BoxGeometry(CARD_W + 2 * lt, lt, 0.012), lipM, 0, -CARD_H / 2 - lt / 2, bz + 0.004));
  g.add(mk(new THREE.BoxGeometry(lt, CARD_H, 0.012), lipM, -CARD_W / 2 - lt / 2, 0, bz + 0.004));
  g.add(mk(new THREE.BoxGeometry(lt, CARD_H, 0.012), lipM, CARD_W / 2 + lt / 2, 0, bz + 0.004));
  // corner studs
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const s = mk(new THREE.SphereGeometry(0.0085, 12, 8), gold, sx * (CARD_W / 2 + pad / 2), sy * (CARD_H / 2 + pad / 2), bz + 0.006);
    s.scale.z = 0.6; g.add(s);
  }

  // doors: left and right panels hinged on the outer edges, swung out about 105 degrees; lid hinged on the top edge, raised about 70 degrees
  const doors = [];
  const doorArt = (flip) => canvasTex(256, 384, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#6e1a16'); gr.addColorStop(1, '#8e2a20'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e1b85a'; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
    c.strokeStyle = 'rgba(225,184,90,0.55)'; c.lineWidth = 2; c.strokeRect(22, 22, w - 44, h - 44);
    // paper-cut style pattern: seigaiha waves (a plain geometric ornament)
    c.strokeStyle = 'rgba(240,200,110,0.5)'; c.lineWidth = 2;
    for (let row = 0; row < 7; row++) for (let col = 0; col < 4; col++) { const cx = 28 + col * 52 + (row % 2) * 26, cy = 60 + row * 44; for (let r = 8; r <= 24; r += 8) { c.beginPath(); c.arc(cx, cy, r, Math.PI, 0); c.stroke(); } }
    if (flip) { /* nothing */ }
  }, { aniso: 4 });
  const makeDoor = (side) => {
    const w = outerW / 2, h = outerH;
    const pivot = new THREE.Group(); pivot.position.set(side * outerW / 2, 0, bz * 0.5);
    const face = new THREE.MeshStandardMaterial({ map: doorArt(side < 0), roughness: 0.35, metalness: 0.0 });
    const edge = wood2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.016), [edge, edge, edge, edge, face, edge]);
    slab.position.x = -side * w / 2; slab.castShadow = true; slab.receiveShadow = true;
    pivot.add(slab);
    // hinge barrels
    for (const y of [-h * 0.32, h * 0.32]) pivot.add(mk(new THREE.CylinderGeometry(0.0075, 0.0075, 0.05, 10), gold, 0, y, 0));
    // knob
    pivot.add(mk(new THREE.SphereGeometry(0.011, 12, 8), gold, -side * w * 0.85, 0, 0.014));
    // opened: the free edge swings out towards the audience
    pivot.rotation.y = side * (Math.PI * 0.58);
    g.add(pivot);
    doors.push({ pivot, side });
    return pivot;
  };
  makeDoor(-1); makeDoor(1);
  // lid (third door) over the top, raised
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, outerH / 2, -0.01);
  const lidFace = new THREE.MeshStandardMaterial({ map: doorArt(false), roughness: 0.4 });
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(outerW * 1.04, 0.016, depth + 0.07), [wood2, wood2, wood2, wood2, wood2, wood2]);
  lidMesh.position.set(0, 0.008, (depth + 0.07) / 2 - 0.01); lidMesh.castShadow = true; lidMesh.receiveShadow = true;
  const lidUnder = new THREE.Mesh(new THREE.PlaneGeometry(outerW * 1.0, depth + 0.05), lidFace);
  lidUnder.rotation.x = Math.PI / 2; lidUnder.position.set(0, -0.001, (depth + 0.05) / 2 - 0.01);
  lidPivot.add(lidMesh, lidUnder);
  lidPivot.rotation.x = -0.22;      // propped open, leaning back a little
  g.add(lidPivot);
  // the lid is a shade for the picture: raise it to rest against the back, and a brass stay
  lidPivot.rotation.x = -0.12;

  // card stack behind the front card (paper edges you can see through the opening and when the front card slides away)
  const stack = new THREE.Group(); g.add(stack);
  const paper = new THREE.MeshStandardMaterial({ color: '#efe3c0', roughness: 0.9 });
  for (let i = 0; i < 4; i++) { const s = mk(plate(CARD_W - 0.004, CARD_H - 0.004, 0.003, 0.004), paper, 0, 0, -0.008 - i * 0.006); s.castShadow = false; stack.add(s); }

  // front drawer and a small brass handle below (the candy drawer in the real thing)
  const drawer = mk(plate(outerW * 0.7, 0.07, 0.03, 0.006), wood2, 0, -outerH / 2 - 0.035, -0.02); g.add(drawer);
  g.add(mk(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 10), gold, 0, -outerH / 2 - 0.035, 0.002));
  g.children[g.children.length - 1].rotation.z = Math.PI / 2;

  return { group: g, outerW, outerH, bz, doors, lid: lidPivot, stack };
}

// ---- the bicycle carrying the box ----------------------------------------------------------------------------------------------------------
// The bicycle points away from the audience: the box rides on the REAR carrier and faces backwards, towards the children behind the bike.
export function buildBicycle() {
  const g = new THREE.Group(); g.name = 'bicycle';
  const steel = new THREE.MeshStandardMaterial({ color: '#202830', roughness: 0.4, metalness: 0.7, envMapIntensity: 1.4 });
  const tyre = new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.85 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#b8bcc4', roughness: 0.25, metalness: 1, envMapIntensity: 2 });
  const leather = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.6 });
  const R = 0.34;                                  // 26 inch wheel
  const wy = GY + R;
  const tube = (a, b, r = 0.0125, m = steel) => { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), len = d.length(); const o = mk(new THREE.CylinderGeometry(r, r, len, 8), m); o.position.copy(A).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o; };
  const wheelAt = (z) => {
    const w = new THREE.Group(); w.position.set(0, wy, z);
    const t = mk(new THREE.TorusGeometry(R, 0.021, 10, 56), tyre); t.rotation.y = Math.PI / 2; w.add(t);
    const rim = mk(new THREE.TorusGeometry(R - 0.026, 0.0045, 6, 48), chrome); rim.rotation.y = Math.PI / 2; w.add(rim);
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; const sp = mk(new THREE.CylinderGeometry(0.0013, 0.0013, R - 0.03, 4), chrome, 0, Math.cos(a) * (R - 0.03) / 2, Math.sin(a) * (R - 0.03) / 2); sp.rotation.x = a; sp.castShadow = false; w.add(sp); }
    const hub = mk(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 10), chrome); hub.rotation.z = Math.PI / 2; w.add(hub);
    return w;
  };
  const zr = -0.42, zf = -1.52;                    // rear and front axle
  g.add(wheelAt(zr), wheelAt(zf));
  const fender = mk(new THREE.TorusGeometry(R + 0.04, 0.012, 6, 28, Math.PI * 0.95), steel, 0, wy, zr); fender.rotation.y = Math.PI / 2; fender.rotation.z = Math.PI * 0.025; g.add(fender);
  const bb = [0, GY + 0.3, -0.92], seat = [0, GY + 0.93, -0.84], head = [0, GY + 0.92, -1.36];
  for (const sx of [-0.045, 0.045]) { g.add(tube([sx, wy, zr], bb)); g.add(tube([sx, wy, zr], [sx * 0.2, seat[1] - 0.05, seat[2] + 0.05])); }
  g.add(tube(bb, seat, 0.016)); g.add(tube(seat, head, 0.016)); g.add(tube(bb, head, 0.016));
  g.add(tube([0, GY + 0.92, -1.36], [0, wy, zf], 0.012));                    // fork
  g.add(tube([0, GY + 1.05, -1.38], [0, GY + 0.9, -1.36], 0.012));            // steerer
  g.add(tube([-0.28, GY + 1.07, -1.38], [0.28, GY + 1.07, -1.38], 0.011));      // handlebar
  for (const sx of [-0.3, 0.3]) g.add(mk(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 8), leather, sx, GY + 1.07, -1.38)).rotation.z = Math.PI / 2;
  const sad = mk(B.roundedBox(0.14, 0.05, 0.26, 0.02, 2), leather, 0, GY + 0.97, -0.86); g.add(sad);
  // rear carrier rack: a flat platform the box rides on, just under the box
  const ry = -0.215;
  g.add(mk(new THREE.BoxGeometry(0.34, 0.012, 0.42), steel, 0, ry, -0.2));
  for (const sx of [-0.1, 0.1]) { g.add(tube([sx, ry, -0.38], [sx * 0.5, wy, zr])); g.add(tube([sx, ry, -0.05], [sx * 0.7, wy + 0.1, zr + 0.15])); }
  // kickstand, a rear light and the pedal crank
  g.add(tube([0.03, GY + 0.28, -0.8], [0.12, GY + 0.0, -0.62], 0.008));
  const lamp = mk(new THREE.BoxGeometry(0.05, 0.03, 0.02), new THREE.MeshStandardMaterial({ color: '#b0201a', emissive: '#ff2a1a', emissiveIntensity: 0.6 }), 0, GY + 0.62, zr + 0.22); g.add(lamp);
  return { group: g, rackY: ry, zr };
}

// ---- small props --------------------------------------------------------------------------------------------------------------------------
// hyoshigi: two wooden clappers joined by a cord, the storyteller strikes them to call the children. 4 x 4 x 20 cm each.
export function buildHyoshigi() {
  const g = new THREE.Group();
  const m = B.material('wood', { color: '#b98a52', color2: '#d6a86b', seed: 21, repeat: [1, 3], size: 256 });
  const a = new THREE.Mesh(B.roundedBox(0.04, 0.2, 0.025, 0.006, 2), m), b = new THREE.Mesh(B.roundedBox(0.04, 0.2, 0.025, 0.006, 2), m);
  a.castShadow = b.castShadow = true;
  const hinge = new THREE.Group(); hinge.add(a);
  const hingeB = new THREE.Group(); hingeB.add(b);
  a.position.y = 0.1; b.position.y = 0.1;     // origin at the top end where the cord is tied, blocks hang down
  g.add(hinge, hingeB);
  g.userData.setOpen = (k) => { hinge.rotation.z = -k * 0.35; hingeB.rotation.z = k * 0.35; };
  g.userData.setOpen(0.4);
  const cord = mk(new THREE.CylinderGeometry(0.0015, 0.0015, 0.06, 4), new THREE.MeshStandardMaterial({ color: '#8c1c18' }), 0, 0.2, 0);
  g.add(cord);
  return g;
}
// candy jar and tray with mizuame sweets (the storyteller sold them before the show; the children come for them)
export function buildCandy() {
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f2f6', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.35, clearcoat: 1, depthWrite: false });
  const jar = mk(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 18), glass, 0, 0.07, 0); jar.castShadow = false;
  const lid = mk(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 14), new THREE.MeshStandardMaterial({ color: '#8c1c18', roughness: 0.5 }), 0, 0.15, 0);
  g.add(jar, lid);
  const cols = ['#ffb347', '#ff6f91', '#ffe66d', '#8fd694', '#7ec8ff'];
  for (let i = 0; i < 18; i++) { const a = i * 2.4, r = 0.03 * Math.sqrt(((i * 7) % 10) / 10) + 0.005; const s = mk(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.35, emissive: cols[i % cols.length], emissiveIntensity: 0.12 }), Math.cos(a) * r * 1.4, 0.02 + (i % 6) * 0.018, Math.sin(a) * r * 1.4); s.castShadow = false; g.add(s); }
  return g;
}

// a plain wooden folding stool the storyteller sits on behind the box; seat at 0.58 m
export function buildStool() {
  const g = new THREE.Group();
  const wood = B.material('wood', { color: '#9a6a3a', color2: '#b98a52', seed: 31, repeat: [1, 1], size: 256, roughness: 0.6 });
  const seat = mk(B.roundedBox(0.32, 0.035, 0.26, 0.012, 2), wood, 0, 0.58 - 0.0175, 0);
  g.add(seat);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = mk(new THREE.CylinderGeometry(0.014, 0.018, 0.56, 8), wood, sx * 0.13, 0.28, sz * 0.1); l.rotation.z = -sx * 0.08; g.add(l); }
  g.position.y = GY;
  return g;
}
