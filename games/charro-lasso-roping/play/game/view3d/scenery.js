// The lienzo charro as 3D scenery (presentation only): sand with rake marks and hoof prints, a painted board fence, stepped stands with a roof,
// an instanced crowd of simple 3D people, papel picado bunting with folds, the catch post, soft contact shadows and dust.
import { THREE } from '../vendor3d/index.js';
import { canvasTex, noiseFill, rng, clamp, lerp, TAU } from './geo.js';

const { Group, Mesh, MeshStandardMaterial, MeshBasicMaterial, BoxGeometry, PlaneGeometry, CylinderGeometry, SphereGeometry, CapsuleGeometry, InstancedMesh, Matrix4, Vector3, Quaternion, Euler, Color, DoubleSide } = THREE;

export const EXT = 34;                                  // the scenery spans x in [-EXT, EXT]
export const FENCE_Z = -6.4;

// ---- painted sky + sierra (screen space, painted per size) -----------------------------------------------------------------------
export function paintSky(g, W, H, hz, wallTop = hz) {
  const r = rng(12);
  const sky = g.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, '#2c5ca8'); sky.addColorStop(0.4, '#6fa6dc'); sky.addColorStop(0.78, '#f3d6a6'); sky.addColorStop(1, '#ffc886');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const sx = W * 0.76, sy = hz * 0.72;
  const glow = g.createRadialGradient(sx, sy, 0, sx, sy, hz * 1.1);
  glow.addColorStop(0, 'rgba(255,250,220,1)'); glow.addColorStop(0.05, 'rgba(255,236,170,0.9)'); glow.addColorStop(0.25, 'rgba(255,205,130,0.4)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, hz + 4);
  // clouds: soft puffs lit warm from the low sun
  for (let i = 0; i < 6; i++) {
    const cx = r() * W, cy = hz * (0.12 + r() * 0.4), cw = W * (0.1 + r() * 0.12);
    for (let j = 0; j < 7; j++) {
      const px = cx + (j - 3) * cw * 0.22 + (r() - 0.5) * 12, py = cy + (r() - 0.5) * cw * 0.05, rr = cw * (0.16 + r() * 0.12);
      const gr = g.createRadialGradient(px, py - rr * 0.2, 0, px, py, rr);
      gr.addColorStop(0, 'rgba(255,248,235,0.55)'); gr.addColorStop(0.6, 'rgba(255,214,176,0.28)'); gr.addColorStop(1, 'rgba(255,200,160,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, rr * 1.6, rr * 0.55, 0, 0, TAU); g.fill();
    }
  }
  // the sierra: hazy ranges
  const range = (base, amp, col, seed, hazeTo, n) => {
    const rr = rng(seed), hills = [];
    for (let i = 0; i < n; i++) hills.push({ c: (i + rr() * 0.8) / n * W * 1.05 - W * 0.03, w: W * (0.1 + rr() * 0.16), h: amp * (0.45 + rr() * 0.75) });
    g.beginPath(); g.moveTo(0, hz + 6);
    for (let x = 0; x <= W + 4; x += 3) {
      let v = 0;
      for (const q of hills) { const u = Math.abs(x - q.c) / q.w; if (u < 1) { const b = 1 - u * u; v = Math.max(v, q.h * b * b * (0.85 + 0.15 * Math.sin(x * 0.07 + q.c))); } }
      g.lineTo(x, base - v - amp * 0.06 * (0.5 + 0.5 * Math.sin(x * 0.011 + seed)));
    }
    g.lineTo(W, hz + 6); g.closePath();
    const gr = g.createLinearGradient(0, base - amp * 1.6, 0, hz); gr.addColorStop(0, col); gr.addColorStop(1, hazeTo);
    g.fillStyle = gr; g.fill();
  };
  const mh = Math.max(40, wallTop * 0.34);
  range(wallTop + mh * 0.2, mh * 1.0, '#9c86b8', 3, '#f1c79e', 6);
  range(wallTop + mh * 0.1, mh * 0.62, '#7c5f98', 8, '#e6b690', 8);
}

// ---- textures ---------------------------------------------------------------------------------------------------------------------
function sandTexture() {
  const W = 2048, H = 1024;
  return canvasTex(W, H, (g) => {
    const r = rng(31);
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#b88c5c'); base.addColorStop(0.45, '#cba46f'); base.addColorStop(1, '#d6b27c');
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    // large soft damp / dry patches
    for (let i = 0; i < 90; i++) { g.fillStyle = r() > 0.5 ? 'rgba(160,110,60,0.10)' : 'rgba(255,230,180,0.12)'; g.beginPath(); g.ellipse(r() * W, r() * H, 40 + r() * 160, 12 + r() * 50, (r() - 0.5) * 0.3, 0, TAU); g.fill(); }
    // raked lines running along the arena
    for (let i = 0; i < 260; i++) {
      const y = r() * H, a = r() * 0.4 + 0.05; g.strokeStyle = r() > 0.5 ? `rgba(120,78,36,${a * 0.35})` : `rgba(255,236,190,${a * 0.4})`; g.lineWidth = 0.8 + r() * 1.2;
      g.beginPath(); g.moveTo(0, y); const x1 = W * (0.3 + r() * 0.6); g.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 8, W * 0.65, y + (r() - 0.5) * 10, x1, y + (r() - 0.5) * 6); g.stroke();
    }
    // the lane: trampled, scuffed, with real hoof prints
    const laneY = H * 0.574;
    for (let i = 0; i < 420; i++) { const x = r() * W, y = laneY + (r() - 0.5) * H * 0.2, s = 3 + r() * 12; g.fillStyle = r() > 0.5 ? 'rgba(110,70,30,0.13)' : 'rgba(255,230,170,0.14)'; g.beginPath(); g.ellipse(x, y, s * 1.4, s * 0.6, (r() - 0.5) * 0.6, 0, TAU); g.fill(); }
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = laneY + (r() - 0.5) * H * 0.12, a = (r() - 0.5) * 0.4;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = 'rgba(70,42,16,0.34)'; g.beginPath(); g.ellipse(0, 0, 6, 7.5, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(70,42,16,0.2)'; g.beginPath(); g.ellipse(-1.5, -1.5, 4.5, 5.5, 0, 0, TAU); g.fill();
      g.restore();
    }
    // damp, darker sand along the foot of the fence
    const rim = g.createLinearGradient(0, H * 0.4, 0, H * 0.465); rim.addColorStop(0, 'rgba(120,80,40,0)'); rim.addColorStop(1, 'rgba(110,70,35,0.32)');
    g.fillStyle = rim; g.fillRect(0, H * 0.4, W, H * 0.065);
    noiseFill(g, W, H, 16, 9, 1);
  }, { aniso: 8 });
}
function boardTexture() {
  return canvasTex(512, 256, (g, w, h) => {
    const r = rng(41);
    const rows = [['#f1e8d2', '#e4d6b8'], ['#c8402a', '#a93220'], ['#f1e8d2', '#e0d0ae']];
    rows.forEach((c, i) => {
      const y = (i * h) / 3;
      const gr = g.createLinearGradient(0, y, 0, y + h / 3); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
      g.fillStyle = gr; g.fillRect(0, y, w, h / 3);
      for (let k = 0; k < 70; k++) { g.strokeStyle = r() > 0.5 ? 'rgba(60,30,10,0.15)' : 'rgba(255,255,255,0.12)'; g.lineWidth = 1; const yy = y + r() * h / 3; g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy + (r() - 0.5) * 3); g.stroke(); }
      g.fillStyle = 'rgba(30,15,5,0.65)'; g.fillRect(0, y, w, 2); g.fillRect(0, y + h / 3 - 2, w, 2);
      for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(40,40,40,0.7)'; g.beginPath(); g.arc(30 + k * 64, y + h / 6, 2.2, 0, TAU); g.fill(); }
    });
    g.fillStyle = 'rgba(70,40,15,0.22)'; for (let i = 0; i < 40; i++) g.fillRect(r() * w, r() * h, 20 + r() * 40, 2 + r() * 8);
    const dirt = g.createLinearGradient(0, h * 0.6, 0, h); dirt.addColorStop(0, 'rgba(110,70,30,0)'); dirt.addColorStop(1, 'rgba(110,70,30,0.35)');
    g.fillStyle = dirt; g.fillRect(0, h * 0.6, w, h * 0.4);
  }, { aniso: 8 });
}
function adobeTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    const r = rng(55);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f3d3a4'); gr.addColorStop(1, '#d99870');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = r() > 0.5 ? 'rgba(120,60,30,0.12)' : 'rgba(255,240,210,0.14)'; g.beginPath(); g.ellipse(r() * w, r() * h, 20 + r() * 70, 6 + r() * 22, 0, 0, TAU); g.fill(); }
    // arches
    const n = 8, aw = w / n;
    for (let i = 0; i < n; i++) {
      const x = i * aw + aw * 0.14, ww = aw * 0.72, top = h * 0.28, base = h * 0.92;
      g.fillStyle = '#3d1f26'; g.beginPath(); g.moveTo(x, base); g.lineTo(x, top + ww / 2); g.arc(x + ww / 2, top + ww / 2, ww / 2, Math.PI, 0); g.lineTo(x + ww, base); g.closePath(); g.fill();
      g.strokeStyle = '#a8442a'; g.lineWidth = 7; g.stroke();
    }
    g.fillStyle = '#b53a22'; g.fillRect(0, h * 0.08, w, h * 0.04);
    noiseFill(g, w, h, 10, 5, 1);
  }, { aniso: 4 });
}
function tileTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#b84a2a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#d9683a'); gr.addColorStop(0.5, '#a63c20'); gr.addColorStop(1, '#7c2a16'); g.fillStyle = gr; g.fillRect(x, 0, 15, h); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < h; y += 22) g.fillRect(0, y, w, 3);
  }, { repeat: [10, 3] });
}
function stoneTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#c9b69a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#eadfca'; g.fillRect(0, 0, w, 10);
    g.fillStyle = 'rgba(60,40,20,0.2)'; g.fillRect(0, h - 6, w, 6);
    noiseFill(g, w, h, 20, 6, 2);
  }, { repeat: [14, 1] });
}
function blobTexture(inner = 0.55) {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, `rgba(30,15,5,${inner})`); gr.addColorStop(0.5, `rgba(30,15,5,${inner * 0.5})`); gr.addColorStop(1, 'rgba(30,15,5,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { srgb: false });
}
function dustTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(236,205,150,0.75)'); gr.addColorStop(0.6, 'rgba(226,190,135,0.3)'); gr.addColorStop(1, 'rgba(226,190,135,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
function papelTexture() {
  return canvasTex(128, 96, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    hole(w / 2, h * 0.38, 9); for (const s of [-1, 1]) { hole(w / 2 + s * 24, h * 0.5, 4.5); hole(w / 2 + s * 40, h * 0.34, 3); }
    g.beginPath(); g.moveTo(w / 2, h * 0.58); g.lineTo(w / 2 + 12, h * 0.74); g.lineTo(w / 2, h * 0.88); g.lineTo(w / 2 - 12, h * 0.74); g.fill();
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(10 + i * 21, 0); g.lineTo(20 + i * 21, 0); g.lineTo(15 + i * 21, 10); g.fill(); }
    // zigzag bottom edge
    g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) { g.lineTo(x, h - 12); g.lineTo(x + 8, h); } g.lineTo(w, h); g.fill();
    g.globalCompositeOperation = 'source-over';
  }, {});
}

// ---- builders --------------------------------------------------------------------------------------------------------------------
export function buildGround() {
  const mat = new MeshStandardMaterial({ map: sandTexture(), roughness: 1, metalness: 0 });
  const g = new PlaneGeometry(EXT * 2, 34);
  const m = new Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.set(0, 0, -2.5); m.receiveShadow = true;
  return m;
}
/** the foreground ground patch drawn each frame (shadow receiver); its far edge fades (vertex alpha) into the baked layer */
export function buildGroundFg(sandMap) {
  const z0 = -3.6, z1 = 9.0, rows = 10;
  const geo = new PlaneGeometry(EXT * 2, z1 - z0, 1, rows);
  const uv = geo.attributes.uv, col = new Float32Array(uv.count * 4);
  for (let i = 0; i < uv.count; i++) {
    const vl = uv.getY(i), z = z1 - vl * (z1 - z0);              // local v=1 is the far edge (z0)
    uv.setY(i, (14.5 - z) / 34);
    const a = clamp((z - z0) / 1.6, 0, 1);
    col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1; col[i * 4 + 3] = a * a * (3 - 2 * a);
  }
  uv.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const mat = new MeshStandardMaterial({ map: sandMap, roughness: 1, metalness: 0, transparent: true, vertexColors: true, depthWrite: true });
  const m = new Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.002, (z0 + z1) / 2); m.receiveShadow = true;
  return m;
}

export function buildFence() {
  const grp = new Group();
  const map = boardTexture(); map.repeat.set(EXT * 2 / 3.2, 1); map.wrapS = THREE.RepeatWrapping;
  const mat = new MeshStandardMaterial({ map, roughness: 0.85 });
  const wall = new Mesh(new BoxGeometry(EXT * 2, 1.36, 0.1), mat); wall.position.set(0, 0.8, FENCE_Z); grp.add(wall);
  const capMat = new MeshStandardMaterial({ color: '#d9c9a4', roughness: 0.8 });
  const cap = new Mesh(new BoxGeometry(EXT * 2, 0.07, 0.2), capMat); cap.position.set(0, 1.5, FENCE_Z); grp.add(cap);
  const foot = new Mesh(new BoxGeometry(EXT * 2, 0.14, 0.16), new MeshStandardMaterial({ color: '#8a8070', roughness: 1 })); foot.position.set(0, 0.07, FENCE_Z); grp.add(foot);
  const postMat = new MeshStandardMaterial({ color: '#e9dcc0', roughness: 0.85 });
  for (let x = -EXT; x <= EXT; x += 3.2) { const p = new Mesh(new BoxGeometry(0.2, 1.62, 0.22), postMat); p.position.set(x, 0.81, FENCE_Z + 0.08); grp.add(p); }
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return grp;
}

export function buildStands(quality) {
  const grp = new Group();
  const stone = new MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95 });
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const top = 0.5 + i * 0.6, z = -9.0 - i * 1.25;
    const b = new Mesh(new BoxGeometry(EXT * 2, top, 1.25), stone); b.position.set(0, top / 2, z); b.castShadow = true; b.receiveShadow = true; grp.add(b);
  }
  const wallZ = -9.0 - steps * 1.25 - 0.3;
  const wmap = adobeTexture(); wmap.repeat.set(EXT * 2 / 12, 1); wmap.wrapS = THREE.RepeatWrapping;
  const wall = new Mesh(new BoxGeometry(EXT * 2, 6.6, 0.5), new MeshStandardMaterial({ map: wmap, roughness: 0.95 })); wall.position.set(0, 3.3, wallZ); wall.castShadow = true; wall.receiveShadow = true; grp.add(wall);
  // roof over the upper rows, with columns
  const tmap = tileTexture(); tmap.repeat.set(EXT * 2 / 2.5, 3);
  const roofLen = 4.2, roof = new Mesh(new BoxGeometry(EXT * 2, 0.18, roofLen), new MeshStandardMaterial({ map: tmap, roughness: 0.7 }));
  roof.position.set(0, 5.9, wallZ + 2.0); roof.rotation.x = 0.22; roof.castShadow = true; roof.receiveShadow = true; grp.add(roof);
  const colMat = new MeshStandardMaterial({ color: '#f1dfbd', roughness: 0.8 });
  for (let x = -EXT; x <= EXT; x += 5) { const c = new Mesh(new CylinderGeometry(0.14, 0.17, 5.4, 10), colMat); c.position.set(x, 2.9, wallZ + 0.9); c.castShadow = true; c.receiveShadow = true; grp.add(c); }
  const beam = new Mesh(new BoxGeometry(EXT * 2, 0.22, 0.3), colMat); beam.position.set(0, 5.6, wallZ + 0.9); beam.castShadow = true; grp.add(beam);
  const rail = new Mesh(new BoxGeometry(EXT * 2, 0.06, 0.06), new MeshStandardMaterial({ color: '#3a2a22', roughness: 0.6 }));
  grp.userData = { steps, wallZ };

  void quality; void rail;
  return grp;
}

/** papel picado: two strings of cut-paper flags; one instanced mesh, swayed per frame */
export function buildBunting(count = 90) {
  const grp = new Group();
  const geo = new PlaneGeometry(0.7, 0.52, 4, 3);
  // baked folds
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.sin(x * 15) * 0.03 + Math.cos(y * 10) * 0.01); p.setY(i, y - 0.26); }
  geo.computeVertexNormals();
  const mat = new MeshStandardMaterial({ map: papelTexture(), roughness: 0.85, side: DoubleSide, transparent: true, alphaTest: 0.5, emissive: new Color('#331a1a'), emissiveIntensity: 0.4 });
  const mesh = new InstancedMesh(geo, mat, count);
  const cols = ['#d63a79', '#f4b324', '#139e8e', '#d6402b', '#7a4fd6', '#ff8a3c', '#2c7fd1'];
  const C = new Color();
  for (let i = 0; i < count; i++) mesh.setColorAt(i, C.set(cols[i % cols.length]));
  mesh.instanceColor.needsUpdate = true; mesh.frustumCulled = false;
  const twineMat = new MeshStandardMaterial({ color: '#3a2a20', roughness: 0.9 });
  const lines = [];
  for (let i = 0; i < 2; i++) { const l = new Mesh(new BoxGeometry(1, 0.012, 0.012), twineMat); lines.push(l); grp.add(l); }
  grp.add(mesh);
  return { group: grp, mesh, lines, count };
}

export function buildPost() {
  const grp = new Group();
  const wood = new MeshStandardMaterial({ color: '#8d6038', roughness: 0.85 });
  const red = new MeshStandardMaterial({ color: '#c9301f', roughness: 0.7 }), cream = new MeshStandardMaterial({ color: '#f0e6cc', roughness: 0.7 });
  const H = 2.1, bands = 7;
  for (let i = 0; i < bands; i++) { const c = new Mesh(new CylinderGeometry(0.07, 0.075, H / bands + 0.001, 14), i % 2 ? cream : red); c.position.y = (i + 0.5) * H / bands; c.castShadow = true; grp.add(c); }
  const cap = new Mesh(new SphereGeometry(0.095, 12, 10), new MeshStandardMaterial({ color: '#e6b83a', roughness: 0.3, metalness: 0.8 })); cap.position.y = H + 0.03; cap.castShadow = true; grp.add(cap);
  const mound = new Mesh(new SphereGeometry(0.4, 14, 8), new MeshStandardMaterial({ color: '#d2a56f', roughness: 1 })); mound.scale.set(1, 0.18, 1); mound.position.y = 0.0; mound.receiveShadow = true; grp.add(mound);
  // pennant: a folded cloth triangle
  const fg = new PlaneGeometry(0.5, 0.26, 6, 2);
  const p = fg.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const t = (x + 0.25) / 0.5; p.setY(i, y * (1 - t * 0.9)); p.setX(i, x + 0.25); }
  fg.computeVertexNormals();
  const flag = new Mesh(fg, new MeshStandardMaterial({ color: '#d63a79', roughness: 0.75, side: DoubleSide })); flag.position.set(0.0, H - 0.12, 0); flag.castShadow = true;
  const flagPivot = new Group(); flagPivot.position.set(0.075, 0, 0); flagPivot.add(flag); grp.add(flagPivot);
  grp.userData.flag = flag; grp.userData.flagGeo = fg; grp.userData.flagBase = Float32Array.from(fg.attributes.position.array);
  return grp;
}

/** soft contact shadow quad (flat on the ground) */
export function contactShadow(w, d, inner = 0.5) {
  const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: blobTexture(inner), transparent: true, depthWrite: false, opacity: 1 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.y = 0.004; m.renderOrder = 2;
  return m;
}

/** pools of hoof-print decals and dust puffs */
export function buildTrack() {
  const grp = new Group();
  const printMat = new MeshBasicMaterial({ map: blobTexture(0.6), transparent: true, depthWrite: false, opacity: 1 });
  const prints = [];
  for (let i = 0; i < 36; i++) { const m = new Mesh(new PlaneGeometry(0.16, 0.2), printMat.clone()); m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.visible = false; m.renderOrder = 1; grp.add(m); prints.push({ m, age: 99 }); }
  const dmap = dustTexture();
  const dust = [];
  for (let i = 0; i < 28; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dmap, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; grp.add(s); dust.push({ s, age: 99, vx: 0, vy: 0 });
  }
  let pi = 0, di = 0;
  return {
    group: grp, prints, dust,
    spawn(x, z, rot, fore, speedMul = 1) {
      const p = prints[pi++ % prints.length]; p.age = 0; p.m.visible = true; p.m.position.set(x, 0.006, z); p.m.rotation.z = rot; p.m.scale.set(fore ? 1 : 1.1, fore ? 1 : 1.2, 1);
      for (let k = 0; k < 2; k++) {
        const d = dust[di++ % dust.length]; d.age = 0; d.s.visible = true; d.s.position.set(x + (Math.random() - 0.5) * 0.15, 0.05, z + (Math.random() - 0.5) * 0.15);
        d.vx = -Math.sign(Math.cos(rot) || 1) * (0.2 + 0.6 * Math.random()) * speedMul * 0.4; d.vy = 0.25 + 0.3 * Math.random();
      }
    },
    update(dt, still) {
      for (const p of prints) { if (!p.m.visible) continue; p.age += dt; const a = 1 - clamp((p.age - 5) / 6, 0, 1); p.m.material.opacity = a; if (a <= 0) p.m.visible = false; }
      for (const d of dust) { if (!d.s.visible) continue; d.age += dt; const f = d.age / 0.9; if (f >= 1) { d.s.visible = false; continue; } d.s.position.x += d.vx * dt; d.s.position.y += d.vy * dt * (1 - f); const sc = 0.22 + 0.55 * f; d.s.scale.set(sc, sc, 1); d.s.material.opacity = 0.55 * (1 - f) * (still ? 1 : 1); }
    },
    clear() { prints.forEach((p) => { p.m.visible = false; }); dust.forEach((d) => { d.s.visible = false; }); },
  };
}
