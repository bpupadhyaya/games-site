// The club green: a manicured crown of mown stripes, the ditch and bank, rink pegs and strings, the mat, a timber pavilion with a
// veranda, benches under hedges, flowerbeds, flags and trees, with a soft English afternoon behind it. Everything is generated from
// fixed seeds with small canvas textures (no image files). Coordinates are three.js: X = across the rink (the bowler's right is +X),
// Y up, Z = -y of the simulation (the rink runs toward -Z, the ditch is at z = -34).
//
// Real-world scale (metres): rink 4.6 wide x 34 long, mat 0.6 x 0.36, bank 0.25 high, hedge 1.1, bench seat 0.42, pavilion 5 high.
export const GREEN = { x0: -9.2, x1: 9.2, y0: -2.2, y1: 34.0, bank: 0.55 };   // sim metres: playing surface incl. the three neighbour rinks

const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

function canvas(w, h, draw) { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

export function buildWorld(V3, stage, o = {}) {
  const { THREE } = V3;
  const quality = o.quality || 'high';
  const root = new THREE.Group(); root.name = 'club-green';
  stage.add(root);
  const R = rnd(20261013);
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
  const tex = (c, repeatX = 1, repeatY = 1, srgb = true) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY); t.anisotropy = aniso;
    return t;
  };
  const std = (c, r = 0.85, m = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
  const out = { root, flags: [], hedgeMats: [], sways: [], update: null, grassMats: [] };

  // ---------------------------------------------------------------- grass: fine blades + mown stripes with a directional sheen
  const bladeTex = tex(canvas(512, 512, (g, w, h) => {
    g.fillStyle = '#5a9a3c'; g.fillRect(0, 0, w, h);
    const r = rnd(7);
    for (let i = 0; i < 9000; i++) {
      const x = r() * w, y = r() * h, l = 5 + r() * 12, a = (r() - 0.5) * 0.5;
      const hue = r(), col = hue < 0.33 ? `rgba(110,178,62,${0.2 + r() * 0.3})` : hue < 0.66 ? `rgba(40,104,36,${0.2 + r() * 0.35})` : `rgba(160,208,92,${0.15 + r() * 0.25})`;
      g.strokeStyle = col; g.lineWidth = 1 + r() * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l * 0.4, y - l); g.stroke();
    }
    // wrap-safe: soft patch variation
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rr = 30 + r() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, rr); const lt = r() < 0.5; gr.addColorStop(0, lt ? 'rgba(150,200,80,0.10)' : 'rgba(20,70,30,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  }), 1, 1);
  function grassMaterial(o2 = {}) {
    const m = new THREE.MeshStandardMaterial({ map: bladeTex.clone(), bumpMap: bladeTex.clone(), bumpScale: 0.8, roughness: 0.88, metalness: 0, color: o2.tint ?? 0xffffff });
    m.map.needsUpdate = true; m.bumpMap.needsUpdate = true;
    m.map.repeat.set(o2.repeatX ?? 8, o2.repeatY ?? 8); m.bumpMap.repeat.copy(m.map.repeat);
    const stripe = o2.stripe ?? 0.92, contrast = o2.contrast ?? 0.14, nap = o2.nap ?? 0.16;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uStripe = { value: stripe }; sh.uniforms.uContrast = { value: contrast }; sh.uniforms.uNap = { value: nap };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform float uStripe; uniform float uContrast; uniform float uNap;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float stI = floor(vWP.x / uStripe);
          float par = mod(stI, 2.0) * 2.0 - 1.0;
          vec3 vd = cameraPosition - vWP; vec2 vh = normalize(vd.xz + vec2(0.0001, 0.0001));
          float lean = par * vh.y;                        // blades leaning toward / away from the eye: light and dark bands
          float sh = uContrast * par * 0.5 + uNap * lean;
          float far = smoothstep(14.0, 70.0, length(vd));
          sh *= mix(1.0, 0.45, far);
          float cell = fract(sin(dot(floor(vWP.xz * 1.7), vec2(12.9898, 78.233))) * 43758.5453);
          diffuseColor.rgb *= 1.0 + sh + (cell - 0.5) * 0.02;`);
    };
    m.customProgramCacheKey = () => 'lawn-grass-v1';
    out.grassMats.push(m);
    return m;
  }

  const addMesh = (geo, mat, x, y, z, o2 = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = o2.cast ?? false; m.receiveShadow = o2.receive ?? true;
    if (o2.parent !== false) (o2.parent || root).add(m);
    return m;
  };
  // sim metres -> three
  const Z = (y) => -y;

  // ---------------------------------------------------------------- the lawn: the playing surface and the mown surround
  const G = GREEN;
  const gw = G.x1 - G.x0, gl = G.y1 - G.y0;
  const greenMat = grassMaterial({ repeatX: gw / 0.8, repeatY: gl / 0.8, stripe: 0.92, contrast: 0.15, nap: 0.17, tint: 0xe8f0d4 });
  const green = addMesh(new THREE.PlaneGeometry(gw, gl), greenMat, 0, 0, Z((G.y0 + G.y1) / 2));
  green.rotation.x = -Math.PI / 2;
  // surround lawn: bigger, slightly darker and coarser, striped across the other way for variety
  const surMat = grassMaterial({ repeatX: 60, repeatY: 60, stripe: 1.6, contrast: 0.12, nap: 0.1, tint: 0xcfe0c0 });
  const sur = addMesh(new THREE.PlaneGeometry(180, 180), surMat, 0, -0.012, Z(16));
  sur.rotation.x = -Math.PI / 2;

  // ---------------------------------------------------------------- ditch + bank (white-capped, dark rubber facing) all round
  const DITCH = 0.3, BANKH = 0.22, CAP = 0.14;
  const ditchMat = std(0x1a1d16, 1), rubberMat = std(0x203524, 0.9), capMat = std(0xf1efe6, 0.55, 0, { envMapIntensity: 0.6 });
  const x0 = G.x0, x1 = G.x1, y0 = G.y0, y1 = G.y1;
  function box(w, h, d, mat, x, y, z, cast = false) { return addMesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, { cast }); }
  // ditch floors (dark, sunken)
  box(gw + 2 * (DITCH + CAP + 0.05), 0.04, DITCH, ditchMat, 0, -0.16, Z(y0 - DITCH / 2));
  box(gw + 2 * (DITCH + CAP + 0.05), 0.04, DITCH, ditchMat, 0, -0.16, Z(y1 + DITCH / 2));
  box(DITCH, 0.04, gl, ditchMat, x0 - DITCH / 2, -0.16, Z((y0 + y1) / 2));
  box(DITCH, 0.04, gl, ditchMat, x1 + DITCH / 2, -0.16, Z((y0 + y1) / 2));
  // the green's own edge drops into the ditch: a thin shaded wall under the turf
  box(gw, 0.17, 0.02, std(0x2d5a28, 1), 0, -0.085, Z(y0 - 0.005));
  box(gw, 0.17, 0.02, std(0x2d5a28, 1), 0, -0.085, Z(y1 + 0.005));
  // bank walls: dark rubber facing with a white cap
  const wallZ = (yy, s) => { box(gw + 2 * (DITCH + CAP + 0.1), BANKH, 0.12, rubberMat, 0, BANKH / 2 - 0.12, Z(yy + s * (DITCH + 0.06)), true); box(gw + 2 * (DITCH + CAP + 0.1), 0.04, CAP, capMat, 0, BANKH - 0.1, Z(yy + s * (DITCH + 0.06 + 0.02)), false); };
  wallZ(y0, -1); wallZ(y1, 1);
  const wallX = (xx, s) => { box(0.12, BANKH, gl + 0.6, rubberMat, xx + s * (DITCH + 0.06), BANKH / 2 - 0.12, Z((y0 + y1) / 2), true); box(CAP, 0.04, gl + 0.6, capMat, xx + s * (DITCH + 0.08), BANKH - 0.1, Z((y0 + y1) / 2), false); };
  wallX(x0, -1); wallX(x1, 1);

  // ---------------------------------------------------------------- rink strings, pegs and the mat
  const pegMat = std(0xf6f2e4, 0.5), stringMat = std(0xf4f0e2, 0.6);
  const numTex = (n) => tex(canvas(64, 64, (g, w, h) => { g.fillStyle = '#f6f2e4'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a1c18'; g.font = '700 46px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, h / 2 + 3); g.strokeStyle = '#7a1c18'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); }));
  for (let rink = 0; rink < 4; rink++) {
    const cx = x0 + 2.3 + rink * 4.6;
    for (const yy of [y0 + 0.25, y1 - 0.35]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 18), [std(0xf6f2e4, 0.5), new THREE.MeshStandardMaterial({ map: numTex(rink + 1), roughness: 0.6 }), std(0xf6f2e4, 0.5)]);
      m.position.set(cx, BANKH - 0.03, Z(yy + (yy < 5 ? -0.6 : 0.62))); root.add(m);
    }
  }
  // rink strings: thin white lines on the grass at each rink edge
  for (let k = 0; k <= 4; k++) {
    const xx = x0 + k * 4.6;
    const st = addMesh(new THREE.BoxGeometry(0.012, 0.006, gl - 0.1), stringMat, xx, 0.006, Z((y0 + y1) / 2), { receive: false });
    st.material = new THREE.MeshBasicMaterial({ color: 0xf2eede, transparent: true, opacity: k === 0 || k === 4 ? 0.0 : 0.55 });
  }
  // the centre-line spots every 5 m are tiny white dots: the eye reads the length of the rink from them
  const dotGeo = new THREE.CircleGeometry(0.025, 14); dotGeo.rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xf2eede, transparent: true, opacity: 0.6 });
  for (let rink = 0; rink < 4; rink++) for (let yy = 5; yy <= 33; yy += 5) addMesh(dotGeo, dotMat, x0 + 2.3 + rink * 4.6, 0.008, Z(yy), { receive: false });
  // the mat: black rubber, white rim, 0.6 x 0.36 m, front edge at y = 0
  const matTex = tex(canvas(256, 160, (g, w, h) => {
    g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.04})`; g.fillRect(R() * w, R() * h, 2, 2); }
    g.strokeStyle = '#eeeadc'; g.lineWidth = 6; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#eeeadc'; g.font = '700 56px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', w / 2, h / 2 + 4);
  }));
  const matGeo = new THREE.BoxGeometry(0.36, 0.012, 0.6);
  addMesh(matGeo, new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.75 }), 0, 0.007, Z(-0.3), { cast: false });

  // ---------------------------------------------------------------- surround: gravel path, benches, hedges, flowerbeds
  const pathMat = std(0xc9b58c, 1);
  const hedgeLeaf = tex(canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#2f6a2a'; g.fillRect(0, 0, w, h);
    const r = rnd(33);
    for (let i = 0; i < 2600; i++) { const x = r() * w, y = r() * h, rr = 2 + r() * 4, l = r(); g.fillStyle = l < 0.3 ? 'rgba(18,64,26,0.75)' : l < 0.7 ? 'rgba(66,128,48,0.7)' : 'rgba(108,170,70,0.6)'; g.beginPath(); g.ellipse(x, y, rr, rr * 0.65, r() * 3, 0, TAU); g.fill(); }
  }), 6, 1);
  const hedgeMat = std(0xffffff, 0.95, 0, { map: hedgeLeaf, bumpMap: hedgeLeaf, bumpScale: 1.2 });
  function hedge(x, z, w, d, h = 1.15) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), hedgeMat); g.position.set(x, h / 2, z); g.castShadow = true; g.receiveShadow = true; root.add(g);
    // rounded shoulders: two thin cylinders along the long edge soften the box
    const horizontal = w >= d;
    const rad = Math.min(w, d) * 0.5;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, horizontal ? w : d, 14), hedgeMat); cyl.rotation.z = horizontal ? Math.PI / 2 : 0; cyl.rotation.x = horizontal ? 0 : Math.PI / 2;
    cyl.position.set(x, h - 0.02, z); cyl.scale.set(1, 1, 1); cyl.castShadow = true; root.add(cyl);
    return g;
  }
  const woodMat = std(0xb99a68, 0.78), ironMat = std(0x203a2a, 0.5, 0.4), whitePaint = std(0xeeeae0, 0.6);
  function bench(x, z, yaw, len = 3.0) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, 0.46), woodMat); seat.position.set(0, 0.42, 0); seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(len, 0.38, 0.04), woodMat); back.position.set(0, 0.72, -0.22); back.rotation.x = -0.14; back.castShadow = true; g.add(back);
    for (const sx of [-len / 2 + 0.2, len / 2 - 0.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.44), ironMat); leg.position.set(sx, 0.21, 0); leg.castShadow = true; g.add(leg);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.42), ironMat); arm.position.set(sx, 0.6, 0); g.add(arm);
    }
    g.position.set(x, 0, z); g.rotation.y = yaw; root.add(g); return g;
  }
  // flower beds: instanced blooms in front of the hedges
  const BLOOM = ['#e04a6a', '#f0b83a', '#f4f0e8', '#8a5ad0', '#e8743a', '#c8386a', '#f6d8e0', '#4a7ad8'];
  const bloomGeo = new THREE.SphereGeometry(0.075, 6, 4);
  function flowerBed(xa, za, xb, zb, width, count, seed) {
    const r = rnd(seed), inst = new THREE.InstancedMesh(bloomGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), count);
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    const dx = xb - xa, dz = zb - za, len = Math.hypot(dx, dz), nx = -dz / len, nz = dx / len;
    for (let i = 0; i < count; i++) {
      const u = r(), v = (r() - 0.5) * width, y = 0.08 + r() * 0.22;
      dummy.position.set(xa + dx * u + nx * v, y, za + dz * u + nz * v); dummy.scale.setScalar(0.7 + r() * 1.0); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, col.set(BLOOM[Math.floor(r() * BLOOM.length)]));
    }
    inst.instanceColor.needsUpdate = true; inst.castShadow = false; root.add(inst);
    // the bed itself: dark soil and green foliage under the blooms
    const soil = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.1, len + 0.1), std(0x3a5a2a, 1)); soil.position.set((xa + xb) / 2, 0.04, (za + zb) / 2); soil.rotation.y = -Math.atan2(dz, dx) + Math.PI / 2; root.add(soil);
  }

  const SIDE = 12.6, FAR = 38.2;      // bench rows: sim metres from the centre line / from the mat
  const PATH_W = 1.6;
  // side paths and the far path (flat gravel strips)
  for (const sx of [-1, 1]) addMesh(new THREE.PlaneGeometry(PATH_W, gl + 14), pathMat, sx * (SIDE - 0.55), -0.004, Z(16)).rotation.x = -Math.PI / 2;
  addMesh(new THREE.PlaneGeometry(2 * SIDE + 6, PATH_W), pathMat, 0, -0.004, Z(FAR - 0.55)).rotation.x = -Math.PI / 2;
  addMesh(new THREE.PlaneGeometry(2 * SIDE + 6, PATH_W), pathMat, 0, -0.004, Z(-5.4)).rotation.x = -Math.PI / 2;
  // hedges behind the benches
  hedge(-SIDE - 1.5, Z(16), 0.9, gl + 12, 1.2); hedge(SIDE + 1.5, Z(16), 0.9, gl + 12, 1.2);
  hedge(0, Z(-7.6), 2 * SIDE + 4, 0.9, 1.1);
  // far end: the hedge has a gap in front of the pavilion steps
  hedge(-SIDE / 2 - 3.0, Z(FAR + 1.8), SIDE - 1.5, 0.9, 1.2); hedge(SIDE / 2 + 3.0, Z(FAR + 1.8), SIDE - 1.5, 0.9, 1.2);
  // benches: sides + far end (people sit facing the green)
  const benchSpots = [];
  for (const sx of [-1, 1]) for (const yy of [6, 14, 22, 30]) { bench(sx * SIDE, Z(yy), sx > 0 ? -Math.PI / 2 : Math.PI / 2, 3.0); benchSpots.push({ x: sx * SIDE, z: Z(yy), side: sx }); }
  for (const xx of [-7, -3.5, 0, 3.5, 7]) bench(xx, Z(FAR), 0, 3.0);
  // beds along the hedges
  for (const sx of [-1, 1]) flowerBed(sx * (SIDE + 0.5), Z(0), sx * (SIDE + 0.5), Z(33), 0.7, 300, 11 + sx);
  flowerBed(-8, Z(FAR + 1.0), 8, Z(FAR + 1.0), 0.7, 280, 21);
  flowerBed(-SIDE, Z(-6.9), SIDE, Z(-6.9), 0.6, 240, 22);

  // ---------------------------------------------------------------- the pavilion (timber, white, green trim) with a veranda
  const board = tex(canvas(256, 256, (g, w, h) => {
    g.fillStyle = '#efeadb'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(70,60,40,0.20)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y + 2, w, 2); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(90,80,60,${R() * 0.05})`; g.fillRect(R() * w, R() * h, 24, 1); }
  }), 6, 2);
  const wallMat = std(0xffffff, 0.8, 0, { map: board });
  const trimMat = std(0x2c5a3c, 0.6);
  const roofTex = tex(canvas(128, 128, (g, w, h) => {
    g.fillStyle = '#4a4f58'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10) for (let x = (y / 10) % 2 ? 0 : 8; x < w; x += 16) { g.fillStyle = `rgba(${30 + R() * 30},${34 + R() * 30},${42 + R() * 30},0.8)`; g.fillRect(x, y, 15, 9); }
  }), 8, 3);
  const roofMat = std(0xffffff, 0.75, 0, { map: roofTex });
  const PZ = Z(FAR + 10), PW = 15.5, PD = 6.0, PH = 3.6;
  const pav = new THREE.Group(); pav.position.set(0, 0, PZ); root.add(pav);
  const p = (geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; pav.add(m); return m; };
  p(new THREE.BoxGeometry(PW, 0.5, PD), std(0x7a5a46, 0.9), 0, 0.25, 0);                       // brick plinth
  p(new THREE.BoxGeometry(PW - 0.2, PH, PD - 0.2), wallMat, 0, 0.5 + PH / 2, 0);                // walls
  p(new THREE.BoxGeometry(PW + 0.15, 0.2, 0.15), trimMat, 0, 0.5 + PH, PD / 2 - 0.1);
  const roof = p(new THREE.CylinderGeometry(0, 0.5, 1, 4, 1), roofMat, 0, 0.5 + PH + 1.1, 0);              // hipped roof (a scaled pyramid)
  roof.rotation.y = Math.PI / 4; roof.scale.set((PW + 2.6) * 1.414, 2.2, (PD + 3.4) * 1.414);
  // veranda: deck, posts, eave
  p(new THREE.BoxGeometry(PW - 0.4, 0.12, 2.0), std(0x8a6a48, 0.85), 0, 0.46, PD / 2 + 1.0);
  for (let i = 0; i <= 6; i++) p(new THREE.BoxGeometry(0.14, PH - 0.3, 0.14), whitePaint, -PW / 2 + 0.7 + (i * (PW - 1.4)) / 6, 0.5 + (PH - 0.3) / 2, PD / 2 + 1.9);
  p(new THREE.BoxGeometry(PW + 0.4, 0.18, 0.25), trimMat, 0, 0.5 + PH - 0.2, PD / 2 + 1.95);
  const eave = p(new THREE.BoxGeometry(PW + 0.4, 0.1, 2.6), roofMat, 0, 0.5 + PH - 0.05, PD / 2 + 0.85); eave.rotation.x = 0.14;
  // windows and a door on the wall behind the veranda
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9db6c4, roughness: 0.08, metalness: 0.1, emissive: 0x16222a, envMapIntensity: 1.2 });
  for (const wx of [-5.4, -2.7, 2.7, 5.4]) {
    p(new THREE.BoxGeometry(1.5, 1.4, 0.06), glassMat, wx, 2.0, PD / 2 - 0.12, false);
    p(new THREE.BoxGeometry(1.62, 0.1, 0.08), trimMat, wx, 2.75, PD / 2 - 0.1, false); p(new THREE.BoxGeometry(1.62, 0.1, 0.08), trimMat, wx, 1.25, PD / 2 - 0.1, false);
    p(new THREE.BoxGeometry(0.06, 1.4, 0.07), whitePaint, wx, 2.0, PD / 2 - 0.1, false);
  }
  p(new THREE.BoxGeometry(1.4, 2.4, 0.08), trimMat, 0, 1.7, PD / 2 - 0.11, false);
  // hanging baskets
  const basketGeo = new THREE.SphereGeometry(0.2, 12, 8, 0, TAU, 0, Math.PI * 0.6);
  for (let i = 0; i <= 6; i += 1) {
    const bx = -PW / 2 + 0.7 + (i * (PW - 1.4)) / 6;
    const b = p(basketGeo, std(0x3a6a30, 1), bx, 3.0, PD / 2 + 1.9, false); b.rotation.x = Math.PI;
    const fl = p(new THREE.SphereGeometry(0.16, 10, 6), std(BLOOM[i % BLOOM.length], 0.7), bx, 3.12, PD / 2 + 1.9, false); fl.scale.set(1.2, 0.7, 1.2);
  }
  // chimney, flag pole + club flag
  p(new THREE.BoxGeometry(0.6, 1.6, 0.6), std(0x8a5a46, 0.9), -4.6, 0.5 + PH + 1.9, -0.8);
  const poleMat = std(0xf2f0ea, 0.4, 0.3);
  const pole = p(new THREE.CylinderGeometry(0.035, 0.05, 6.5, 8), poleMat, 3.2, 0.5 + PH + 4.0, -0.4);
  const flagGeo = new THREE.PlaneGeometry(1.7, 1.05, 14, 8);
  const clubTex = tex(canvas(256, 160, (g, w, h) => {
    g.fillStyle = '#1f5a34'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2efe4'; g.fillRect(0, h * 0.4, w, h * 0.2);
    g.fillStyle = '#f2efe4'; g.beginPath(); g.arc(w * 0.28, h * 0.5, 38, 0, TAU); g.fill(); g.fillStyle = '#1b1c1f'; g.beginPath(); g.arc(w * 0.28, h * 0.5, 26, 0, TAU); g.fill(); g.fillStyle = '#c63a2c'; g.beginPath(); g.arc(w * 0.28 - 8, h * 0.5 - 8, 8, 0, TAU); g.fill();
  }));
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: clubTex, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(3.2 + 0.85, 0.5 + PH + 6.35 - 0.55, -0.4); flag.castShadow = true; pav.add(flag);
  out.flags.push({ mesh: flag, w: 1.7, seg: [14, 8] });
  // little pennant bunting across the veranda
  const buntCols = ['#e04a3a', '#f4f0e0', '#2f6ac0', '#f0b83a', '#3a9a5a'];
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.11, 0, 0, 0.11, 0, 0, 0, -0.26, 0]), 3)); bGeo.computeVertexNormals();
  const NB = 26, bunting = new THREE.InstancedMesh(bGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), NB);
  { const d = new THREE.Object3D(), c = new THREE.Color(); for (let i = 0; i < NB; i++) { const u = i / (NB - 1), x = -PW / 2 + 0.2 + u * (PW - 0.4), y = 3.55 - Math.sin(u * Math.PI) * 0.45; d.position.set(x, y, PD / 2 + 2.05); d.rotation.set(0, 0, (R() - 0.5) * 0.2); d.updateMatrix(); bunting.setMatrixAt(i, d.matrix); bunting.setColorAt(i, c.set(buntCols[i % buntCols.length])); } bunting.instanceColor.needsUpdate = true; }
  pav.add(bunting);
  // a tool shed to one side
  { const sh = new THREE.Group(); sh.position.set(-15.5, 0, Z(FAR + 4)); root.add(sh);
    const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.6), wallMat); b.position.y = 1.2; b.castShadow = true; sh.add(b);
    const r = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 3.0), std(0x3a3d45, 0.8)); r.position.y = 2.55; r.rotation.z = 0.08; r.castShadow = true; sh.add(r); }

  // ---------------------------------------------------------------- trees beyond the hedge (low-poly, wind-swayed crowns)
  const leafTex = tex(canvas(128, 128, (g, w, h) => { g.fillStyle = '#3a7a30'; g.fillRect(0, 0, w, h); const r = rnd(5); for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(20,70,26,0.6)' : 'rgba(120,180,70,0.5)'; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 5, 0, TAU); g.fill(); } }), 2, 2);
  const crownMat = std(0xffffff, 0.9, 0, { map: leafTex });
  const trunkMat = std(0x4a3a2c, 1);
  const trees = [];
  function tree(x, z, h, s) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, h * 0.45, 8), trunkMat); t.position.y = h * 0.22; t.castShadow = true; g.add(t);
    const crown = new THREE.Group(); crown.position.y = h * 0.5; g.add(crown);
    const rr = rnd(Math.floor(x * 13 + z * 7 + 99));
    for (let i = 0; i < 5; i++) {
      const bl = new THREE.Mesh(new THREE.SphereGeometry(h * (0.22 + rr() * 0.1), 10, 7), crownMat);
      bl.position.set((rr() - 0.5) * h * 0.4, (rr() - 0.2) * h * 0.35, (rr() - 0.5) * h * 0.4); bl.scale.y = 0.85; bl.castShadow = true; crown.add(bl);
    }
    root.add(g); trees.push({ crown, ph: R() * TAU, amp: 0.012 + R() * 0.012 }); return g;
  }
  const TREES = [[-19, -4, 9, 1.1], [-22, -22, 11, 1.2], [-20, -38, 9.5, 1.1], [19, -2, 10, 1.1], [22, -20, 11.5, 1.25], [21, -36, 9, 1.0], [-12, -53, 10, 1.1], [9, -55, 11, 1.2], [-26, -12, 12, 1.3], [27, -9, 11, 1.2], [-7, 13, 10, 1.1], [10, 14, 9.5, 1.0], [-18, 8, 8, 1.0], [18, 9, 8.5, 1.0]];
  for (const [x, z, h, s] of TREES.slice(0, quality === 'low' ? 8 : TREES.length)) tree(x, z, h, s);

  // ---------------------------------------------------------------- the distant world: sky, hills, tree lines (scenery kit)
  out.scenery = null;
  try {
    out.scenery = V3.buildScenery({
      layers: [
        { t: 'sky', id: 'sky-clear' }, { t: 'backdrop', id: 'bd-meadow-day' },
        { t: 'band', id: 'band-hills-green', r: 120, h: 34, arc: [-175, -5] },
        { t: 'band', id: 'band-birch', r: 96, h: 26, arc: [-172, -8] },
        { t: 'cutouts', id: 'tr-round-tree', count: 7, r: [60, 85], scale: [10, 15], seed: 5, sway: 0.25, arc: [-170, -10] },
      ],
      timeOfDay: 'day', quality: quality === 'low' ? 'low' : 'medium', wind: 0.4, clouds: 0.55, seed: 4, radius: 220,
    });
    out.scenery.group.position.set(0, -0.02, Z(16)); root.add(out.scenery.group);
    out.scenery.ready.catch((e) => console.warn('scenery failed', e));
  } catch (e) { console.warn('scenery unavailable', e); out.scenery = null; }

  // ---------------------------------------------------------------- per-frame ambience
  const flagVerts = flagGeo.attributes.position;
  const base = new Float32Array(flagVerts.array);
  out.update = (t, calm) => {
    const wind = calm ? 0.25 : 0.7 + 0.3 * Math.sin(t * 0.37);
    for (let i = 0; i < flagVerts.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], u = (bx + 0.85) / 1.7;       // 0 at the pole
      const w = Math.sin(u * 5.5 - t * 4.2 * (0.6 + wind * 0.6)) * 0.13 * u * wind + Math.sin(u * 9 - t * 6 + by * 2) * 0.03 * u;
      flagVerts.setZ(i, w); flagVerts.setX(i, bx - u * u * 0.12 * wind);
    }
    flagVerts.needsUpdate = true; flag.geometry.computeVertexNormals();
    for (const tr of trees) { tr.crown.rotation.z = Math.sin(t * 0.8 + tr.ph) * tr.amp * (calm ? 0.4 : 1) * (0.7 + wind); tr.crown.rotation.x = Math.cos(t * 0.6 + tr.ph) * tr.amp * 0.7; }
    bunting.rotation.x = 0;
  };
  out.benchSpots = benchSpots;
  out.FAR = FAR; out.SIDE = SIDE; out.PZ = PZ;
  return out;
}
