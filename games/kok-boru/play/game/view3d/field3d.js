// Kok-boru: the real 3D pitch. One WebGL canvas UNDER the transparent kit canvas holds the lit field (mown stripes, worn earth, sand pits,
// painted lines), the eight real 3D horses and riders (the same Rider3D models the atlas used, moved into this scene), the ball, the dust
// and the controlled ring, with a sun and real shadow maps. The 2D scene keeps drawing the sky, ridges, crowd, rails, bunting, aim overlays
// and the HUD on the kit canvas above it. The camera is the same shift-lens pinhole the 2D `proj()` uses (scene.js makeCam), so every 2D
// mark (rings, throw arc, tags) lands exactly on the 3D thing it belongs to. It only READS the per-frame state the 2D scene hands over.
// Fallbacks: no WebGL2 / module failure / context lost -> `active` is false, the riders go back to the atlas and the painted pitch returns.
import { THREE, board3d as B } from '../vendor3d/index.js';

const TAU = Math.PI * 2;
const HL = 32, HW = 17, GOAL_X = 28.5, GOAL_R = 1.8, DROP_R = 3.0;      // consts.js (copied: the view layer does not import the sim)

function noise(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function pitchCanvas() {
  // 64 m x 34 m at 32 px per metre
  const PX = 32, W = HL * 2 * PX, H = HW * 2 * PX;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = noise(11);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9a9b52'); g.addColorStop(1, '#a8984f'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // mown stripes along x, soft
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(255,240,170,0.10)' : 'rgba(40,50,10,0.07)'; x.fillRect(i * 4 * PX, 0, 4 * PX, H); }
  // grass tufts and dry patches
  for (let i = 0; i < 9000; i++) { const px = r() * W, py = r() * H, l = 3 + r() * 7; x.strokeStyle = r() < 0.5 ? 'rgba(70,86,30,0.22)' : 'rgba(214,196,110,0.2)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 3, py - l); x.stroke(); }
  for (let i = 0; i < 70; i++) { const px = r() * W, py = r() * H, rr = 16 + r() * 60; const gr = x.createRadialGradient(px, py, 2, px, py, rr); gr.addColorStop(0, 'rgba(150,112,64,0.24)'); gr.addColorStop(1, 'rgba(150,112,64,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  const X = (m) => (m + HL) * PX, Z = (m) => (m + HW) * PX;
  // worn earth: centre and both pits
  for (const [wx, rad] of [[0, 5.5], [-GOAL_X, 6], [GOAL_X, 6]]) { const gr = x.createRadialGradient(X(wx), Z(0), 4, X(wx), Z(0), rad * PX); gr.addColorStop(0, 'rgba(140,100,60,0.45)'); gr.addColorStop(1, 'rgba(140,100,60,0)'); x.fillStyle = gr; x.fillRect(X(wx) - rad * PX, Z(0) - rad * PX, rad * 2 * PX, rad * 2 * PX); }
  // lines
  x.strokeStyle = 'rgba(255,250,235,0.85)'; x.lineWidth = 0.12 * PX;
  x.strokeRect(X(-HL + 0.5), Z(-HW + 0.5), (2 * HL - 1) * PX, (2 * HW - 1) * PX);
  x.beginPath(); x.moveTo(X(0), Z(-HW + 0.5)); x.lineTo(X(0), Z(HW - 0.5)); x.stroke();
  x.beginPath(); x.arc(X(0), Z(0), 3.2 * PX, 0, TAU); x.stroke();
  // the two goal pits: raked sand ring, darker hollow, white rim, dotted drop-in ring
  for (const gx of [-GOAL_X, GOAL_X]) {
    x.fillStyle = 'rgba(224,196,140,0.75)'; x.beginPath(); x.arc(X(gx), Z(0), (GOAL_R + 0.7) * PX, 0, TAU); x.fill();
    const gr = x.createRadialGradient(X(gx), Z(0), 3, X(gx), Z(0), GOAL_R * PX * 1.1); gr.addColorStop(0, '#6f4a2a'); gr.addColorStop(0.7, '#a07a46'); gr.addColorStop(1, '#d8b878');
    x.fillStyle = gr; x.beginPath(); x.arc(X(gx), Z(0), GOAL_R * PX, 0, TAU); x.fill();
    x.strokeStyle = '#fff6e0'; x.lineWidth = 0.15 * PX; x.stroke();
    x.save(); x.setLineDash([0.4 * PX, 0.55 * PX]); x.strokeStyle = 'rgba(255,250,235,0.5)'; x.lineWidth = 0.08 * PX; x.beginPath(); x.arc(X(gx), Z(0), DROP_R * PX, 0, TAU); x.stroke(); x.restore();
  }
  return c;
}
function apronCanvas() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const x = c.getContext('2d'), r = noise(5);
  x.fillStyle = '#8e8a4a'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { x.fillStyle = r() < 0.5 ? 'rgba(60,70,25,0.18)' : 'rgba(206,190,110,0.16)'; x.fillRect(r() * 512, r() * 512, 2 + r() * 6, 1 + r() * 3); }
  return c;
}
const soft = (() => { let t = null; return () => {
  if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  t = new THREE.CanvasTexture(c); return t;
}; })();
function ballTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#b87a44'); g.addColorStop(1, '#8a5430'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = 'rgba(40,22,10,0.8)'; x.lineWidth = 3;
  for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 64 + 6, 0); x.bezierCurveTo(i * 64 + 40, 40, i * 64 + 40, 88, i * 64 + 6, 128); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createField3d({ kitCanvas, riders, quality = 'medium' }) {
  // three layers: far (2D: sky, crowd, far rail) < field (WebGL: pitch, riders, ball, dust) < kit canvas (near rail, overlays, HUD)
  const farCanvas = document.createElement('canvas');
  farCanvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(farCanvas, kitCanvas);
  const farCtx = farCanvas.getContext('2d');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:1;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '2';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const shadowsOn = quality !== 'low';
  renderer.shadowMap.enabled = shadowsOn; renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1, 1, 400);
  cam.updateProjectionMatrix = () => {};
  const env = B.createEnvironment ? B.createEnvironment(renderer, scene, { intensity: 0.45 }) : null;
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6a6a3a, 0.85));
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.0);
  sun.castShadow = shadowsOn;
  sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1536, quality === 'high' ? 2048 : 1536);
  const SC = sun.shadow.camera; SC.left = -13; SC.right = 13; SC.top = 20; SC.bottom = -20; SC.near = 1; SC.far = 90;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);

  // ---- ground: the pitch (own texture) on a wide apron
  const apronTex = new THREE.CanvasTexture(apronCanvas()); apronTex.wrapS = apronTex.wrapT = THREE.RepeatWrapping; apronTex.repeat.set(40, 40); apronTex.colorSpace = THREE.SRGBColorSpace;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(260, 167.3), new THREE.MeshStandardMaterial({ map: apronTex, roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.004, 66.35); apron.receiveShadow = shadowsOn; scene.add(apron);   // starts at the far rail's base (z = -HW - 0.3): everything above it is the far canvas
  const pt = new THREE.CanvasTexture(pitchCanvas()); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = 8;
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(HL * 2, HW * 2), new THREE.MeshStandardMaterial({ map: pt, roughness: 1 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0, 0); pitch.receiveShadow = shadowsOn; scene.add(pitch);

  // ---- ball, dust, ring
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.65 }));
  ball.castShadow = shadowsOn; ball.visible = false; scene.add(ball);
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({ color: 0x1c1608, transparent: true, opacity: 0.35, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2; ballShadow.visible = false; scene.add(ballShadow);
  const DUST_N = 90, dust = [];
  for (let i = 0; i < DUST_N; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xd6ba8c, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); dust.push(s); }
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.58, 56), new THREE.MeshBasicMaterial({ color: 0xffe36a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);

  // ---- the riders: the same models the atlas drew, adopted into this scene
  const holders = riders.riders.map((r) => { const h = new THREE.Group(); h.rotation.y = Math.PI / 2; h.add(r.group); r.group.traverse((o) => { if (o.isMesh) { o.castShadow = shadowsOn; o.frustumCulled = false; } }); scene.add(h); h.visible = false; return h; });

  const api = { ok: true, active: false, lost: false, canvas, farCanvas, renderer, scene, ready: false };
  /** The 2D context for everything behind the riders: same size and transform as the kit canvas, cleared. */
  api.farContext = (ctx) => {
    const rc = kitCanvas.getBoundingClientRect();
    if (farCanvas.width !== kitCanvas.width || farCanvas.height !== kitCanvas.height) { farCanvas.width = kitCanvas.width; farCanvas.height = kitCanvas.height; }
    const st = farCanvas.style, L = Math.round(rc.left) + 'px', T = Math.round(rc.top) + 'px', Wc = Math.round(rc.width) + 'px', Hc = Math.round(rc.height) + 'px';
    if (st.left !== L || st.top !== T || st.width !== Wc || st.height !== Hc) { st.left = L; st.top = T; st.width = Wc; st.height = Hc; }
    farCtx.setTransform(1, 0, 0, 1, 0, 0); farCtx.clearRect(0, 0, farCanvas.width, farCanvas.height);
    farCtx.setTransform(ctx.getTransform());
    st.visibility = 'visible';
    return farCtx;
  };
  let cw = 0, ch = 0, adopted = true;
  const release = () => {   // give the riders back to the atlas stage (context lost / error)
    if (!adopted) return; adopted = false;
    holders.forEach((h, i) => { try { h.remove(riders.riders[i].group); riders.stage.scene.add(riders.riders[i].group); } catch { /* ignore */ } });
    api.active = false; canvas.style.visibility = 'hidden'; farCanvas.style.visibility = 'hidden';
  };
  const adopt = () => {
    if (adopted) return; adopted = true;
    holders.forEach((h, i) => { try { riders.stage.scene.remove(riders.riders[i].group); h.add(riders.riders[i].group); } catch { /* ignore */ } });
  };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); api.lost = true; release(); });
  canvas.addEventListener('webglcontextrestored', () => { api.lost = false; adopt(); cw = 0; });

  const tv = new THREE.Vector3();
  /**
   * c: the 2D camera (scene.js makeCam: ppm, x, pcy, HE, Dn, zCam, ax, aw); W,H: virtual size; list: [{ r (sim rider), st (presentation state) }]
   * ball: sim ball or null (carried); parts: dust particles; ctlId: controlled rider id or -1; t: presentation clock.
   */
  api.render = ({ c, W, H, list, ball: b, parts, ctlId, t, hidden = false }) => {
    if (api.lost || !adopted) { api.active = false; return false; }
    if (hidden) { canvas.style.visibility = 'hidden'; api.active = false; return false; }
    const rc = kitCanvas.getBoundingClientRect(), w = Math.round(rc.width), hh = Math.round(rc.height);
    if (w <= 0 || hh <= 0) return false;
    const st = canvas.style;
    if (cw !== w || ch !== hh || st.left !== Math.round(rc.left) + 'px' || st.top !== Math.round(rc.top) + 'px') {
      cw = w; ch = hh; st.left = Math.round(rc.left) + 'px'; st.top = Math.round(rc.top) + 'px'; st.width = w + 'px'; st.height = hh + 'px';
      renderer.setPixelRatio(Math.min(quality === 'low' ? 1 : 1.75, globalThis.devicePixelRatio || 1)); renderer.setSize(w, hh, false);
    }
    // the shift-lens pinhole: world (x, y, z) -> virtual pixel exactly as scene.js proj()
    const f = c.ppm * c.Dn, pcx = c.ax + c.aw / 2, n = 1, fa = 400;
    const a = -(fa + n) / (fa - n), bz = -2 * fa * n / (fa - n);
    cam.projectionMatrix.set(
      2 * f / W, 0, -(2 * pcx / W - 1), 0,
      0, 2 * f / H, -(1 - 2 * c.pcy / H), 0,
      0, 0, a, bz,
      0, 0, -1, 0,
    );
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.position.set(c.x, c.HE, c.zCam); cam.quaternion.identity(); cam.updateMatrixWorld(true);
    // the sun follows the camera so the shadow map covers what is on screen
    sun.position.set(c.x - 14, 34, 8); sun.target.position.set(c.x, 0, 0); sun.target.updateMatrixWorld(true);

    for (const h of holders) h.visible = false;
    for (const it of list) {
      const r = it.r, s = it.st, idx = r.id % holders.length, h = holders[idx], rd = riders.riders[idx];
      h.position.set(r.x, 0, r.z); h.visible = true; h.updateMatrixWorld(true);
      rd.group.visible = true;
      if (s.look) rd.setLook(s.look);
      rd.pose(s);
    }
    if (b && b.owner < 0) { ball.visible = true; ball.position.set(b.x, b.y + 0.3, b.z); ball.rotation.y = t * 4 + b.x * 0.8; ball.rotation.z = t * 2.4; ballShadow.visible = true; ballShadow.position.set(b.x, 0.01, b.z); const k = 1.1 - Math.min(0.35, b.y * 0.1); ballShadow.scale.set(k, k, k); ballShadow.material.opacity = 0.36 - Math.min(0.2, b.y * 0.08); } else { ball.visible = false; ballShadow.visible = false; }
    let di = 0;
    for (const p of parts) {
      if (p.kind !== 'dust' || di >= DUST_N) continue;
      const s = dust[di++], al = Math.max(0, Math.min(1, p.life / p.max));
      s.visible = true; s.position.set(p.x, p.y, p.z); const rr = (0.3 + (1 - al) * 0.7) * p.size * 2.2 * 1.6; s.scale.set(rr, rr, 1); s.material.opacity = al * 0.5;
    }
    for (; di < DUST_N; di++) dust[di].visible = false;
    if (ctlId >= 0) { const r = list.find((it) => it.r.id === ctlId); if (r) { const p = 1 + Math.sin(t * 6) * 0.06; ring.visible = true; ring.position.set(r.r.x, 0.02, r.r.z); ring.scale.set(p, p, p); } else ring.visible = false; } else ring.visible = false;
    void tv;
    renderer.render(scene, cam);
    canvas.style.visibility = 'visible';
    api.active = true; api.ready = true;
    return true;
  };
  api.hide = () => { canvas.style.visibility = 'hidden'; farCanvas.style.visibility = 'hidden'; api.active = false; };
  api.release = release;
  return api;
}
