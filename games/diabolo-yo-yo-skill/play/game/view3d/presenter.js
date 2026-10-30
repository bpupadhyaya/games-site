// 3D presenter for Spin and String. It ONLY READS the simulation (game.view3d()) and draws it with three.js:
// a lit studio (wall, wood floor, soft pool of light), the yo-yo or the diabolo with lacquer and metal materials, the string as a
// tube that sags with its slack, mitten hands with forearms, a ghost toy for the Learn demo, sparks and a spin glow.
// Nothing here feeds back into the sim. The camera maths is shared with the 2D overlays (src/cam.js).
import { makeCam, FOV } from '../src/cam.js';
const LIB = '../vendor3d/index.js';
const TAU = Math.PI * 2;
const SY = 4.4, SD = 2.7;                       // visual scale of the toys (real ones would be a few pixels wide on a phone)

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g }; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', shadowSize: 3 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g }; }
  const scene = stage.scene, camera = stage.camera, renderer = stage.renderer;
  camera.fov = FOV * 180 / Math.PI; camera.near = 0.2; camera.far = 60; camera.updateProjectionMatrix();
  scene.environmentIntensity = 1.15;
  stage.setSky('#10303a', '#10303a', { near: 14, far: 40 });
  stage.lights.hemi.color.set('#a9d4de'); stage.lights.hemi.groundColor.set('#3a2a1e'); stage.lights.hemi.intensity = 0.5; renderer.toneMappingExposure = 0.9;
  stage.lights.key.color.set('#fff0d8'); stage.lights.key.intensity = 3.0;
  stage.lights.rim.color.set('#4fd0d6'); stage.lights.rim.intensity = 1.6;
  stage._shadowOffset.set(-1.6, 4.5, 3.2);
  let contextOk = true;
  stage.onContextLost(() => { contextOk = false; });
  stage.onContextRestored(() => { contextOk = true; });

  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ---------- textures ----------
  const tex = (w, h, draw, repeat) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = 4; return t;
  };
  const wallTex = tex(512, 512, (g, w, h) => {
    // plaster wall with a tall window (daylight from the right), wainscot panelling and skirting; no floating discs
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a3c44'); gr.addColorStop(0.55, '#2c5b62'); gr.addColorStop(1, '#3d6e6c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},${0.012 + (i % 5) * 0.004})`; g.fillRect((i * 73) % w, (i * 131) % h, 2 + i % 3, 2); }
    const wx = w * 0.42, wy = h * 0.4, ww = w * 0.24, wh = h * 0.195;
    const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#c9b98f'); sky.addColorStop(1, '#e6b878');
    g.fillStyle = '#25140a'; g.fillRect(wx - 10, wy - 10, ww + 20, wh + 20); g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
    g.fillStyle = '#25140a'; g.fillRect(wx + ww / 2 - 3, wy, 6, wh); g.fillRect(wx, wy + wh * 0.42, ww, 6);
    const sp = g.createRadialGradient(wx + ww / 2, wy + wh / 2, 10, wx + ww / 2, wy + wh / 2, w * 0.5); sp.addColorStop(0, 'rgba(255,214,150,0.35)'); sp.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = sp; g.fillRect(0, 0, w, h);
    const wy2 = h * 0.64; g.fillStyle = '#2a1a10'; g.fillRect(0, wy2, w, h - wy2);
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(255,214,150,0.10)'; g.fillRect(i * w / 9 + 8, wy2 + 14, w / 9 - 16, h - wy2 - 30); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.strokeRect(i * w / 9 + 8, wy2 + 14, w / 9 - 16, h - wy2 - 30); }
    g.fillStyle = '#6a4224'; g.fillRect(0, wy2 - 6, w, 6); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - 10, w, 10);
  });
  const floorTex = tex(512, 512, (g, w, h) => {
    const n = 8; for (let i = 0; i < n; i++) {
      const y0 = (i * h) / n, l = 34 + (i * 13) % 8; g.fillStyle = `hsl(${24 + (i % 3) * 2},${46 + (i % 2) * 6}%,${l}%)`; g.fillRect(0, y0, w, h / n);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(40,20,8,${0.05 + (k % 4) * 0.02})`; g.beginPath(); const yy = y0 + ((k * 7) % (h / n)); g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + 2, w * 0.6, yy - 2, w, yy + 1); g.stroke(); }
      g.fillStyle = 'rgba(20,10,4,0.55)'; g.fillRect(0, y0, w, 2);
      const jx = (i * 151) % w; g.fillRect(jx, y0, 2, h / n);
    }
  }, [5, 3]);
  const poolTex = tex(256, 256, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,236,190,0.55)'); r.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const glowTex = tex(128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.35, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const shadowTex = tex(128, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  // body paint: stripes along u spin as the texture offset moves; "blur" has none
  const paint = (stripes) => tex(256, 128, (g, w, h) => {
    const bands = [['#a8231a', 0.0], ['#d23a2a', 0.2], ['#f0bd4a', 0.46], ['#e8c46a', 0.52], ['#c52f22', 0.62], ['#7e1710', 1]];
    const gr = g.createLinearGradient(0, 0, 0, h); bands.forEach(([c, p]) => gr.addColorStop(p, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (stripes) for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? 'rgba(255,230,160,0.34)' : 'rgba(30,0,0,0.22)'; g.fillRect((i * w) / 12, 0, w / 12, h); }
    else { g.fillStyle = 'rgba(255,230,160,0.12)'; g.fillRect(0, 0, w, h); }
  });
  const texStripes = paint(true), texBlur = paint(false);
  texStripes.wrapS = texBlur.wrapS = THREE.RepeatWrapping;
  const dbPaint = (stripes) => tex(256, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b52a1f'); gr.addColorStop(0.5, '#e24a35'); gr.addColorStop(1, '#8c1d14'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (stripes) for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(255,214,140,0.30)' : 'rgba(30,0,0,0.20)'; g.fillRect((i * w) / 16, 0, w / 16, h); }
    else { g.fillStyle = 'rgba(255,214,140,0.10)'; g.fillRect(0, 0, w, h); }
  });
  const dbStripes = dbPaint(true), dbBlur = dbPaint(false);
  dbStripes.wrapS = dbBlur.wrapS = THREE.RepeatWrapping;

  // ---------- geometry helpers ----------
  // surface of revolution about the z axis: profile = [[r, z], ...]
  const lathe = (profile, seg = 48, uRep = 1) => {
    const pos = [], uv = [], idx = [];
    let total = 0; const acc = [0];
    for (let i = 1; i < profile.length; i++) { total += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]); acc.push(total); }
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU, c = Math.cos(a), s = Math.sin(a);
      for (let i = 0; i < profile.length; i++) { pos.push(profile[i][0] * c, profile[i][0] * s, profile[i][1]); uv.push((j / seg) * uRep, acc[i] / total); }
    }
    const n = profile.length;
    for (let j = 0; j < seg; j++) for (let i = 0; i < n - 1; i++) { const a = j * n + i, b = a + n, c = a + 1, d = b + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const mat = (o) => new THREE.MeshStandardMaterial({ envMapIntensity: 1.6, ...o });
  const M = {
    lacquer: mat({ map: texStripes, color: 0xffffff, metalness: 0.55, roughness: 0.22, side: THREE.DoubleSide }),
    gold: mat({ color: 0xf0bd4a, metalness: 0.95, roughness: 0.2 }),
    steel: mat({ color: 0xd8dee4, metalness: 1, roughness: 0.18 }),
    rubber: mat({ map: dbStripes, color: 0xffffff, metalness: 0.15, roughness: 0.3, side: THREE.DoubleSide }),
    wood: mat({ color: 0x5a2c16, metalness: 0.1, roughness: 0.35 }),
    grip: mat({ color: 0x1c1c22, metalness: 0, roughness: 0.8 }),
    skin: mat({ color: 0xcf9870, metalness: 0, roughness: 0.55, envMapIntensity: 0.6 }),
    nail: mat({ color: 0xe8c3a6, metalness: 0, roughness: 0.3 }),
    cuff: mat({ color: 0xe9dcc0, metalness: 0, roughness: 0.6 }),
    sleeve: mat({ color: 0x1f6f78, metalness: 0, roughness: 0.7 }),
    string: mat({ color: 0xf4ead2, metalness: 0, roughness: 0.7, emissive: 0x3a3426 }),
  };

  // ---------- backdrop ----------
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ map: wallTex, fog: false, toneMapped: false }));
  wall.position.set(0, 1.4, -3.2); scene.add(wall);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), new THREE.MeshStandardMaterial({ map: floorTex, color: 0x6e5c4e, roughness: 0.45, metalness: 0, envMapIntensity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pool.rotation.x = -Math.PI / 2; scene.add(pool);
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, fog: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob);

  // ---------- strings ----------
  const SEG = 28;
  function makeTube(radius = 0.005) {
    const rad = 4, n = SEG + 1;
    const pos = new Float32Array(n * rad * 3), idx = [];
    for (let i = 0; i < SEG; i++) for (let k = 0; k < rad; k++) { const a = i * rad + k, b = i * rad + (k + 1) % rad, c = a + rad, d = b + rad; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, M.string);
    m.frustumCulled = false; m.castShadow = true;
    const side = new THREE.Vector3(), up2 = new THREE.Vector3(), tan = new THREE.Vector3();
    m.setPath = (pts) => {                                  // pts: SEG+1 Vector3
      for (let i = 0; i <= SEG; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(SEG, i + 1)];
        tan.copy(b).sub(a).normalize();
        side.set(-tan.y, tan.x, 0); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
        up2.copy(tan).cross(side).normalize();
        for (let k = 0; k < rad; k++) {
          const ang = (k / rad) * TAU, cx = Math.cos(ang) * radius, cy = Math.sin(ang) * radius, o = (i * rad + k) * 3;
          pos[o] = pts[i].x + side.x * cx + up2.x * cy; pos[o + 1] = pts[i].y + side.y * cx + up2.y * cy; pos[o + 2] = pts[i].z + side.z * cx + up2.z * cy;
        }
      }
      g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
    };
    return m;
  }
  const pathBuf = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
  function fillPath(a, b, sag, via) {                      // a -> (via) -> b with a downward sag
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      if (via) { const k = u < 0.5 ? u * 2 : (u - 0.5) * 2, p0 = u < 0.5 ? a : via, p1 = u < 0.5 ? via : b; pathBuf[i].set(p0.x + (p1.x - p0.x) * k, p0.y + (p1.y - p0.y) * k - Math.sin(k * Math.PI) * sag, p0.z + (p1.z - p0.z) * k); }
      else pathBuf[i].set(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * sag, a.z + (b.z - a.z) * u);
    }
    return pathBuf;
  }

  // ---------- hands ----------
  // a closed fist around a vertical grip (the rod axis is the local y axis): palm behind, four fingers wrapping across the front, thumb over them, wrist and sleeve below
  const seg = (parent, p0, p1, r, m) => {
    const d = new THREE.Vector3().subVectors(p1, p0), len = d.length();
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, 8), m);
    c.position.copy(p0).add(p1).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); c.castShadow = true; parent.add(c); return c;
  };
  const fadeTex = tex(4, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  M.sleeveFade = mat({ color: 0x1f6f78, metalness: 0, roughness: 0.7, transparent: true, alphaMap: fadeTex, depthWrite: false });
  function makeHand(left) {
    const g = new THREE.Group(), mx = left ? -1 : 1;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), M.skin); palm.scale.set(0.8, 1.05, 0.72); palm.position.set(0, 0, -0.03); palm.castShadow = true; g.add(palm);
    const ys = [0.036, 0.012, -0.012, -0.036], rr = [0.0098, 0.0102, 0.0098, 0.0088];
    ys.forEach((y, i) => {
      const k = 1 - i * 0.04, P = [V(mx * 0.032, y, -0.034), V(mx * 0.036, y, 0.016 * k), V(mx * -0.004, y - 0.002, 0.036 * k), V(mx * -0.03, y - 0.004, 0.004)];
      for (let j = 0; j < 3; j++) seg(g, P[j], P[j + 1], rr[i], M.skin);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(rr[i] * 1.02, 10, 8), M.skin); joint.position.copy(P[1]); g.add(joint);
      const nail = new THREE.Mesh(new THREE.SphereGeometry(rr[i] * 0.7, 8, 6), M.nail); nail.scale.set(0.5, 0.5, 0.25); nail.position.copy(P[3]).add(V(mx * -0.002, 0.0, 0.006)); g.add(nail);
    });
    const T = [V(mx * -0.036, 0.034, -0.026), V(mx * -0.04, 0.04, 0.012), V(mx * -0.012, 0.042, 0.046)];
    seg(g, T[0], T[1], 0.0125, M.skin); seg(g, T[1], T[2], 0.0115, M.skin);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.12, 16), M.skin); wrist.position.set(0, -0.1, -0.03); g.add(wrist);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.047, 0.7, 6, 16), M.sleeveFade);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.048, 0.04, 18), M.cuff); cuff.position.set(0, -0.135, 0);
    const armG = new THREE.Group(); armG.add(arm, cuff); arm.position.set(0, -0.52, 0); armG.position.set(0, 0, -0.03); g.add(armG);
    g.armG = armG; g.scale.setScalar(1.4);
    return g;
  }
  const handR = makeHand(false), handL = makeHand(true);
  scene.add(handR, handL);
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 20), M.gold); ringMesh.castShadow = true; scene.add(ringMesh);

  // ---------- the yo-yo ----------
  function makeYoyo() {
    const g = new THREE.Group();
    const half = [[0.006, 0.006], [0.012, 0.0062], [0.024, 0.0075], [0.031, 0.011], [0.0338, 0.018], [0.0336, 0.024], [0.0315, 0.0285], [0.026, 0.0292], [0.016, 0.0284], [0.008, 0.0262], [0.0, 0.0258]];
    const a = new THREE.Mesh(lathe(half, 56, 1), M.lacquer), b = new THREE.Mesh(lathe(half.map(([r, z]) => [r, -z]).reverse(), 56, 1), M.lacquer);
    a.castShadow = b.castShadow = true;
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.014, 14), M.gold); axle.rotation.x = Math.PI / 2;
    const capA = new THREE.Mesh(new THREE.TorusGeometry(0.0135, 0.0022, 8, 28), M.gold); capA.position.z = 0.0262; const capB = capA.clone(); capB.position.z = -0.0262;
    const hubA = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 16), M.steel); hubA.rotation.x = Math.PI / 2; hubA.position.z = 0.0275; const hubB = hubA.clone(); hubB.position.z = -0.0275;
    g.add(a, b, axle, capA, capB, hubA, hubB); g.scale.setScalar(SY);
    return g;
  }
  // ---------- the diabolo ----------
  function makeDiabolo() {
    const g = new THREE.Group();
    const prof = [], N = 14;
    for (let i = 0; i <= N; i++) { const t = i / N; prof.push([0.0125 + 0.056 * Math.pow(t, 1.6) + 0.002 * t, 0.012 + 0.05 * t]); }
    prof.push([0.0705, 0.066], [0.0715, 0.07], [0.0675, 0.0735], [0.0555, 0.0728], [0.04, 0.066], [0.022, 0.0615], [0.0, 0.0605]);
    const gA = lathe(prof, 56, 1), gB = lathe(prof.map(([r, z]) => [r, -z]).reverse(), 56, 1);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.026, 18), M.steel); hub.rotation.x = Math.PI / 2;
    const a = new THREE.Mesh(gA, M.rubber), b = new THREE.Mesh(gB, M.rubber); a.castShadow = b.castShadow = true;
    const rimA = new THREE.Mesh(new THREE.TorusGeometry(0.069, 0.003, 8, 40), M.gold); rimA.position.z = 0.0705; const rimB = rimA.clone(); rimB.position.z = -0.0705;
    const capA = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 18), M.gold); capA.rotation.x = Math.PI / 2; capA.position.z = 0.0625; const capB = capA.clone(); capB.position.z = -0.0625;
    g.add(hub, a, b, rimA, rimB, capA, capB); g.scale.setScalar(SD);
    return g;
  }
  const yoyo = makeYoyo(), diabolo = makeDiabolo();
  scene.add(yoyo, diabolo);
  const stickMesh = () => { const s = new THREE.Group(); const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.017, 0.62, 12), M.wood); rod.castShadow = true; const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), M.gold); tip.position.y = 0.31; const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 12), M.grip); grip.position.y = -0.2; s.add(rod, tip, grip); return s; };
  const stickL = stickMesh(), stickR = stickMesh();
  scene.add(stickL, stickR);
  const strY = makeTube(0.007), strD = makeTube(0.007);
  scene.add(strY, strD);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  scene.add(glow);

  // ---------- ghost ----------
  const ghostY = makeYoyo(), ghostD = makeDiabolo();
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5fe6ee, transparent: true, opacity: 0.32, depthWrite: false });
  for (const gg of [ghostY, ghostD]) { gg.traverse((o) => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; } }); gg.visible = false; scene.add(gg); }
  const ghostHand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: 0x5fe6ee, transparent: true, opacity: 0.4, depthWrite: false }));
  ghostHand.visible = false; scene.add(ghostHand);
  let ghostTrail = null, ghostKey = null;
  const ghostTrailMat = new THREE.MeshBasicMaterial({ color: 0x5fe6ee, transparent: true, opacity: 0.45, depthWrite: false });

  // ---------- sparks ----------
  const sparks = [];
  for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); s.visible = false; scene.add(s); sparks.push({ s, vx: 0, vy: 0, vz: 0, t: 1, max: 1, size: 0.1 }); }
  let sparkI = 0, sparkSeed = 7;
  const rnd = () => { sparkSeed = (Math.imul(sparkSeed, 1664525) + 1013904223) >>> 0; return sparkSeed / 4294967296; };
  const burst = (x, y, n, color, speed = 2.2, size = 0.16) => {
    for (let i = 0; i < n; i++) {
      const p = sparks[sparkI++ % sparks.length], a = rnd() * TAU, sp = speed * (0.4 + rnd() * 0.8);
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp + 0.6; p.vz = (rnd() - 0.5) * sp * 0.6; p.t = 0; p.max = 0.5 + rnd() * 0.5; p.size = size * (0.6 + rnd() * 0.8);
      p.s.position.set(x, y, 0); p.s.material.color.set(color); p.s.visible = true;
    }
  };

  // ---------- per-frame ----------
  let lastEv = 0, lastClock = null, lastToy = null, pulse = 0, shake = 0;
  const tmpA = V(0, 0, 0), tmpB = V(0, 0, 0), tmpC = V(0, 0, 0);
  const placeHand = (h, x, y, z, side, rz = 0) => { h.position.set(x, y, z); h.rotation.set(0, 0, rz); h.armG.rotation.set(0.38, 0, rz ? -rz * 0.8 : side * 0.3); };
  function applyCamera(vw) {
    const cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight;
    const c = cw / vw.W;                                    // css px per layout unit
    const cam = makeCam(vw.W, vw.H, vw.rect, vw.toy, vw.camTop, !!vw.tight);
    camera.aspect = cw / ch;
    camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    camera.up.set(0, 1, 0); camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    camera.setViewOffset(cw, ch, -cam.shiftX * c, -cam.shiftY * c, cw, ch);
    camera.updateProjectionMatrix();
    return cam;
  }
  function frame(game) {
    if (!contextOk) return;
    const vw = game.view3d();
    if (!vw) { stage.setVisible(false); return; }
    stage.setVisible(true);
    const w = vw.w, toy = vw.toy;
    applyCamera(vw);
    const H = w.hand;
    const dt = lastClock === null ? 0 : Math.max(0, Math.min(0.1, vw.clock - lastClock)); lastClock = vw.clock;
    if (toy !== lastToy) { lastToy = toy; lastEv = w.eid; }
    const isY = toy === 'yoyo';
    yoyo.visible = isY; strY.visible = isY; diabolo.visible = !isY; strD.visible = !isY; stickL.visible = stickR.visible = !isY; handL.visible = !isY;
    const floorY = -1.3, lift = isY ? SY * 0.034 - 0.034 : 0;
    floor.position.set(0, floorY - lift, 2.0);
    pool.position.set(0, floorY - lift + 0.004, 0.2);
    for (const e of w.ev) {                                  // events -> effects
      if (e.id <= lastEv) continue; lastEv = e.id;
      const t = isY ? w.yy : w.db;
      if (e.type === 'snap') { pulse = Math.min(1, e.v / 6); burst(t.x, t.y, 6, '#ffe6a8', 1.6, 0.12); }
      else if (e.type === 'bind') burst(t.x, t.y, 8, '#8ff0f4', 1.8, 0.12);
      else if (e.type === 'catch') { burst(t.x, t.y, 16, '#ffd27a', 2.4, 0.15); pulse = 1; }
      else if (e.type === 'toss') burst(t.x, t.y, 8, '#8ff0f4', 2.4, 0.15);
      else if (e.type === 'drop') { burst(e.x ?? t.x, e.y ?? t.y, 10, '#ff8a70', 2, 0.14); shake = 0.5; }
      else if (e.type === 'loop') burst(t.x, t.y, 10, '#ffffff', 2.8, 0.15);
    }
    pulse *= Math.exp(-5 * dt); shake *= Math.exp(-6 * dt);
    const spinK = Math.max(0, Math.min(1, (isY ? w.yy.w : w.db.w) / (isY ? 420 : 360)));
    if (isY) {
      const y = w.yy, hx = H.x, hy = H.y;
      yoyo.position.set(y.x, y.y, 0);
      const vis = Math.min(y.w, 14), fast = y.w > 22;       // stripes turn while slow and blur out when fast
      M.lacquer.map = fast ? texBlur : texStripes;
      texStripes.offset.x = (vw.clock * vis) / TAU;
      const wob = (1 - spinK) * 0.07 * Math.sin(vw.clock * 7);
      yoyo.rotation.set(wob, wob * 0.6, y.mode === 'floor' ? -(y.x * 0.5) * 6 : 0);
      const L = 1.1, r = Math.hypot(y.x - hx, y.y - hy);
      const slack = Math.max(0, 1 - r / L) * (y.mode === 'home' ? 0 : 1);
      tmpA.set(hx, hy, 0.02); tmpB.set(y.x, y.y, 0);
      strY.setPath(fillPath(tmpA, tmpB, Math.min(0.28, slack * 0.5) * (y.tight ? 0.2 : 1) + pulse * 0.02 * Math.sin(vw.clock * 60), null));
      ringMesh.visible = true; ringMesh.position.set(hx, hy, 0.02); ringMesh.rotation.set(0.4, 0.9, 0);
      placeHand(handR, hx, hy - 0.02, 0.04, 1); handR.visible = true;
      glow.position.set(y.x, y.y, 0.05);
      const gs = 0.5 + spinK * 0.9; glow.scale.set(gs, gs, 1); glow.material.opacity = (y.mode === 'home' ? 0 : 0.1 + spinK * 0.5) * (1 + pulse * 0.5);
      glow.material.color.set(spinK > 0.7 ? '#9ff4f6' : '#ffd27a');
      blob.position.set(y.x, floorY - lift + 0.006, 0); blob.scale.setScalar(0.55 + (y.y - floorY) * 0.12); blob.material.opacity = 0.6 * Math.max(0.2, 1 - (y.y - floorY) * 0.5);
    } else {
      const d = w.db, c = H.sp;
      const f1 = tmpA.set(H.x - c, H.y, 0), f2 = tmpB.set(H.x + c, H.y, 0);
      diabolo.position.set(d.x, d.y, 0);
      const vis = Math.min(d.w, 12), fast = d.w > 20;
      M.rubber.map = fast ? dbBlur : dbStripes;
      dbStripes.offset.x = (vw.clock * vis) / TAU;
      const tl = d.tilt || 0;
      diabolo.rotation.set(tl * 0.45, tl, 0);
      const SA = 0.3, sl = (st, tip, sgn) => { const a = sgn * SA; st.position.set(tip.x + 0.31 * Math.sin(a), tip.y - 0.31 * Math.cos(a), 0.0); st.rotation.set(0, 0, a); return a; };
      const aL = sl(stickL, f1, -1), aR = sl(stickR, f2, 1);
      tmpC.set(d.x, d.y - 0.026, 0);
      if (d.air) { fillPath(f1, f2, 0.34, null); } else fillPath(f1, f2, 0, tmpC);
      strD.setPath(pathBuf);
      placeHand(handL, f1.x + 0.51 * Math.sin(aL), f1.y - 0.51 * Math.cos(aL), 0, -1, aL); placeHand(handR, f2.x + 0.51 * Math.sin(aR), f2.y - 0.51 * Math.cos(aR), 0, 1, aR);
      handR.visible = true; handL.visible = true; ringMesh.visible = false;
      glow.position.set(d.x, d.y, 0.06);
      const gs = 0.55 + spinK * 0.9; glow.scale.set(gs, gs, 1); glow.material.opacity = (0.08 + spinK * 0.5) * (1 + pulse * 0.5);
      glow.material.color.set(spinK > 0.7 ? '#9ff4f6' : '#ffd27a');
      blob.position.set(d.x, floorY + 0.006, 0); blob.scale.setScalar(0.7 + Math.max(0, d.y - floorY) * 0.15); blob.material.opacity = Math.max(0.1, 0.65 - (d.y - floorY) * 0.12);
    }
    const gh = vw.ghost;                                     // ghost demo
    if (gh && gh.frames && gh.frames.length) {
      if (gh.key !== ghostKey) {
        ghostKey = gh.key;
        if (ghostTrail) { scene.remove(ghostTrail); ghostTrail.geometry.dispose(); }
        ghostTrail = makeTube(0.012); ghostTrail.material = ghostTrailMat; ghostTrail.castShadow = false;
        const pts = []; for (let i = 0; i <= SEG; i++) { const fr = gh.frames[Math.min(gh.frames.length - 1, Math.floor((i / SEG) * (gh.frames.length - 1)))]; pts.push(V(fr.x, fr.y, 0.02)); }
        ghostTrail.setPath(pts); scene.add(ghostTrail);
      }
      const fr = gh.frames[Math.min(gh.frames.length - 1, gh.idx | 0)];
      const gt = isY ? ghostY : ghostD; gt.visible = true; (isY ? ghostD : ghostY).visible = false;
      gt.position.set(fr.x, fr.y, 0.01); if (!isY) gt.rotation.set(fr.tilt * 0.45, fr.tilt, 0);
      ghostHand.visible = true; ghostHand.position.set(fr.hx, fr.hy, 0.05);
      if (ghostTrail) ghostTrail.visible = true;
    } else { ghostY.visible = ghostD.visible = ghostHand.visible = false; if (ghostTrail) ghostTrail.visible = false; ghostKey = null; }
    for (const p of sparks) {
      if (!p.s.visible) continue;
      p.t += dt; if (p.t >= p.max) { p.s.visible = false; continue; }
      p.vy -= 4 * dt; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const k = 1 - p.t / p.max; p.s.material.opacity = k * 0.9; p.s.scale.setScalar(p.size * (0.6 + k));
    }
    if (shake > 0.01) camera.position.x += Math.sin(vw.clock * 90) * 0.012 * shake;
    stage.setShadowTarget(isY ? w.yy.x : w.db.x, 0, 0);
    stage.update(dt);
  }
  return {
    stage, scene, camera,
    wrap(game) { const r = game.render.bind(game); game.render = (ctx, view) => { r(ctx, view); frame(game); }; return game; },
  };
}
