// The hall: a painted badminton court with the real line markings, the net on its posts, advertising boards, spectator stands and the
// shuttle model. Everything is cheap (a few dozen draw calls, textures drawn once on a canvas).
import { THREE } from '../vendor3d/index.js';
import { HL, HW, HWD, SHORT, NET_POST } from '../src/consts.js';

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}
const rngf = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
const lam = (o) => new THREE.MeshLambertMaterial(o);

// ---- crowd texture: rows of seated spectators ---------------------------------------------------------------------------------------
function crowdTexture(seed, w = 1024, h = 160) {
  return canvasTex(w, h, (c, W, Hh) => {
    const r = rngf(seed);
    c.fillStyle = '#1b2434'; c.fillRect(0, 0, W, Hh);
    const skins = ['#f1c9a5', '#d9a679', '#b97c52', '#8c5a38', '#f4d3b5', '#6f4429'];
    const cols = ['#d84a3a', '#2f7be0', '#f2c230', '#2fb6a6', '#ffffff', '#8a55d4', '#ee7d2f', '#33415c', '#e8e8f0', '#c9356e'];
    for (let row = 0; row < 2; row++) {
      const y0 = Hh * (0.1 + row * 0.5), sz = Hh * 0.22;
      for (let x = (row * 13) % 24; x < W; x += 20 + r() * 12) {
        const col = cols[Math.floor(r() * cols.length)], sk = skins[Math.floor(r() * skins.length)];
        c.fillStyle = col; c.beginPath(); c.roundRect(x - sz * 0.62, y0 + sz * 0.95, sz * 1.24, sz * 1.5, 6); c.fill();
        c.fillStyle = sk; c.beginPath(); c.arc(x, y0 + sz * 0.55, sz * 0.42, 0, Math.PI * 2); c.fill();
        c.fillStyle = ['#1a1410', '#2a1a10', '#4a3020', '#c9a05a', '#222'][Math.floor(r() * 5)]; c.beginPath(); c.arc(x, y0 + sz * 0.4, sz * 0.43, Math.PI, 0); c.fill();
        if (r() < 0.12) { c.strokeStyle = sk; c.lineWidth = 5; c.beginPath(); c.moveTo(x + sz * 0.5, y0 + sz * 1.1); c.lineTo(x + sz * 0.9, y0 + sz * 0.2); c.stroke(); }
      }
    }
    const g = c.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, 'rgba(0,0,0,0.0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); c.fillStyle = g; c.fillRect(0, 0, W, Hh);
  }, { repeat: [1, 1] });
}

function boardTexture(text, seed, bg = '#10202f', accent = '#2fb6a6', w = 1024, h = 128) {
  return canvasTex(w, h, (c, W, Hh) => {
    c.fillStyle = bg; c.fillRect(0, 0, W, Hh);
    const g = c.createLinearGradient(0, 0, W, 0); g.addColorStop(0, accent); g.addColorStop(0.5, '#6a7cff'); g.addColorStop(1, '#e8892f');
    c.fillStyle = g; c.fillRect(0, Hh - 14, W, 14);
    const words = text.split('  ');
    let fs = Hh * 0.56; c.font = `800 ${fs}px "Avenir Next", system-ui, sans-serif`;
    const gap = 46, total = () => words.reduce((a, t) => a + c.measureText(t).width, 0) + gap * words.length;
    while (total() > W - 20 && fs > 20) { fs -= 2; c.font = `800 ${fs}px "Avenir Next", system-ui, sans-serif`; }
    c.textBaseline = 'middle';
    let x = (W - total() + gap) / 2;
    words.forEach((t, i) => { c.fillStyle = i % 2 ? accent : '#fff6e4'; c.fillText(t, x, Hh * 0.46); x += c.measureText(t).width + gap; c.fillStyle = '#e8892f'; c.beginPath(); c.moveTo(x - gap / 2, Hh * 0.46 - 8); c.lineTo(x - gap / 2 + 8, Hh * 0.46); c.lineTo(x - gap / 2, Hh * 0.46 + 8); c.lineTo(x - gap / 2 - 8, Hh * 0.46); c.fill(); });
  });
}

export function buildHall(stage, { quality = 'high' } = {}) {
  const g = new THREE.Group(); g.name = 'hall';
  // ---- the floor: surround + court painted into one texture (x in [-8, 8], z in [-10, 10])
  const X0 = -8, X1 = 8, Z0 = -10.5, Z1 = 10.5, CWm = X1 - X0, CLm = Z1 - Z0;
  const TW = quality === 'low' ? 1024 : 1600, TH = Math.round((TW * CLm) / CWm);
  const floorTex = canvasTex(TW, TH, (c, w, h) => {
    const S = w / CWm, X = (x) => (x - X0) * S, Z = (z) => (z - Z0) * S;
    const r = rngf(7);
    c.fillStyle = '#183a52'; c.fillRect(0, 0, w, h);                                          // run-off: deep blue
    for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(255,255,255,${r() * 0.035})`; c.fillRect(r() * w, r() * h, 3 + r() * 14, 2); }
    // playing area: the doubles court plus a green apron
    c.fillStyle = '#1c8a76'; c.fillRect(X(-HWD - 0.5), Z(-HL - 0.5), (2 * HWD + 1) * S, (2 * HL + 1) * S);
    for (let i = 0; i < 4200; i++) { const a = r() * 0.05; c.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,30,20,${a})`; c.fillRect(X(-HWD - 0.5) + r() * (2 * HWD + 1) * S, Z(-HL - 0.5) + r() * (2 * HL + 1) * S, 2 + r() * 6, 2 + r() * 6); }
    // lines (40 mm)
    c.strokeStyle = '#f6f3ea'; c.lineWidth = 0.05 * S; c.lineJoin = 'miter';
    const L = (x0, z0, x1, z1) => { c.beginPath(); c.moveTo(X(x0), Z(z0)); c.lineTo(X(x1), Z(z1)); c.stroke(); };
    c.strokeRect(X(-HWD), Z(-HL), 2 * HWD * S, 2 * HL * S);                                     // doubles boundary
    L(-HW, -HL, -HW, HL); L(HW, -HL, HW, HL);                                                   // singles side lines
    L(-HWD, -SHORT, HWD, -SHORT); L(-HWD, SHORT, HWD, SHORT);                                   // short service lines
    L(-HWD, -HL + 0.76, HWD, -HL + 0.76); L(-HWD, HL - 0.76, HWD, HL - 0.76);                   // doubles long service lines
    L(0, -HL, 0, -SHORT); L(0, SHORT, 0, HL);                                                   // centre lines
    // a subtle logo disc at each end, and the light sweep
    c.fillStyle = 'rgba(255,255,255,0.07)'; for (const z of [-HL - 1.4, HL + 1.4]) { c.beginPath(); c.arc(X(0), Z(z), 0.9 * S, 0, Math.PI * 2); c.fill(); }
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CWm, CLm), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.42, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (Z0 + Z1) / 2); floor.receiveShadow = true; g.add(floor);
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), lam({ color: 0x0e1c2a })); hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.y = -0.01; g.add(hallFloor);

  // ---- net: two posts, the mesh, the white tape
  const postM = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.5, metalness: 0.5 });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, NET_POST + 0.02, 14), postM); p.position.set(sx * (HWD + 0.03), (NET_POST + 0.02) / 2, 0); g.add(p);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.05, 20), postM); b.position.set(sx * (HWD + 0.03), 0.025, 0); g.add(b);
  }
  const netW = 2 * HWD, netH = 0.76;
  const netTex = canvasTex(1024, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(20,24,32,0.85)'; c.lineWidth = 2;
    for (let x = 0; x <= w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y <= h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  });
  netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(netW, netH, 24, 4), netMat); net.position.set(0, NET_POST - 0.075 - netH / 2, 0); net.renderOrder = 3; g.add(net);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(netW, 0.075, 0.012), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 })); tape.position.set(0, NET_POST - 0.0375, 0); g.add(tape);
  const cord = new THREE.Mesh(new THREE.BoxGeometry(netW, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0x20262e })); cord.position.set(0, NET_POST - 0.075 - netH, 0); g.add(cord);
  // the net ripples when the shuttle touches it: displace the plane's vertices for a moment
  const npos = net.geometry.attributes.position, base0 = Float32Array.from(npos.array);
  let ripple = 0, ripX = 0, ripPhase = 0;
  const netApi = {
    poke(x, str = 1) { ripple = str; ripX = x; ripPhase = 0; },
    update(dt) {
      if (ripple <= 0.002) return;
      ripple *= Math.pow(0.04, dt); ripPhase += dt * 26;
      for (let i = 0; i < npos.count; i++) {
        const x = base0[i * 3], y = base0[i * 3 + 1];
        const d = Math.abs(x - ripX), a = ripple * 0.06 * Math.exp(-d * 0.9) * Math.sin(ripPhase - d * 5) * (0.35 + 0.65 * ((y + netH / 2) / netH));
        npos.setZ(i, base0[i * 3 + 2] + a);
      }
      npos.needsUpdate = true;
    },
  };

  // ---- advertising boards round the court (unlit, bright), and the stands
  const boards = [['ARCFORGE  RALLY  SMASH', 11, '#10202f', '#2fb6a6'], ['BADMINTON  WORLD HERITAGE  GAMES', 23, '#17263a', '#e8892f'], ['SWIPE  DROP  CLEAR  SMASH', 37, '#10202f', '#8a55d4']];
  const sides = {};
  const mkBoard = (len, tex0, x, z, ry, key) => { const tex = tex0.clone(); tex.needsUpdate = true; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round(len / 7.2)), 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.9), new THREE.MeshBasicMaterial({ map: tex })); m.position.set(x, 0.45, z); m.rotation.y = ry; g.add(m); (sides[key] ||= []).push(m); return m; };
  const bt = boards.map(([t, s, bg, ac]) => boardTexture(t, s, bg, ac));
  for (const t of bt) { t.wrapS = THREE.RepeatWrapping; }
  const endLen = 12.6, sideLen = 22;
  for (let k = 0; k < 2; k++) {
    mkBoard(endLen, bt[k % 3], 0, k ? HL + 2.3 : -HL - 2.3, k ? Math.PI : 0, k ? 'near' : 'far');
    mkBoard(sideLen, bt[(k + 1) % 3], k ? 4.3 : -4.3, 0, k ? -Math.PI / 2 : Math.PI / 2, k ? 'right' : 'left');
  }
  const standGroup = new THREE.Group(); g.add(standGroup);
  const seatM = lam({ color: 0x2b3a52 }), stepM = lam({ color: 0x1a2536 });
  const crowd = [crowdTexture(3), crowdTexture(9), crowdTexture(21)];
  function stand(cx, cz, len, ry, tiers = 6) {
    const grp = new THREE.Group(); grp.position.set(cx, 0, cz); grp.rotation.y = ry;
    for (let i = 0; i < tiers; i++) {
      const y = 0.55 + i * 0.5, d = 0.9, z = i * d;
      const step = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5 * (i + 1) + 0.55, d), stepM); step.position.set(0, (0.5 * (i + 1) + 0.55) / 2, z); grp.add(step);
      const tex = crowd[i % 3].clone(); tex.needsUpdate = true; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 12, 1); tex.offset.x = (i * 0.173) % 1;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.15), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); face.position.set(0, y + 0.55, z - d / 2 + 0.01); grp.add(face);
    }
    standGroup.add(grp); return grp;
  }
  (sides.far ||= []).push(stand(0, -HL - 3.4, 24, Math.PI, 7));      // far end: tiers rise away from the court
  (sides.near ||= []).push(stand(0, HL + 3.4, 24, 0, 7));            // near end
  (sides.left ||= []).push(stand(-HWD - 2.3, 0, 26, -Math.PI / 2, 7));   // left side
  (sides.right ||= []).push(stand(HWD + 2.3, 0, 26, Math.PI / 2, 7));    // right side
  // hall walls and a ceiling truss with light panels (seen only at the edge of the picture, but they light the mood)
  const wallM = lam({ color: 0x0f1a28 });
  for (const [x, z, ry] of [[0, -22, 0], [0, 22, Math.PI], [-22, 0, Math.PI / 2], [22, 0, -Math.PI / 2]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(46, 16), wallM); w.position.set(x, 8, z); w.rotation.y = ry; g.add(w); }
  const lampM = new THREE.MeshBasicMaterial({ color: 0xfff6e0 });
  stage.add(g);
  // the stands and boards between the camera and the court are hidden so they never block the picture
  const setView = (mode) => { for (const k of Object.keys(sides)) for (const o of sides[k]) o.visible = !((mode === 'B' && k === 'near') || (mode === 'S' && k === 'right')); };
  setView('B');
  return { group: g, net: netApi, floor, setView };
}

// ---- the shuttlecock: cork head, feather skirt with a rim; local +Y points from the skirt to the cork ---------------------------------------
export function buildShuttle(scale = 2.1) {
  const g = new THREE.Group(); g.name = 'shuttle';
  const inner = new THREE.Group(); g.add(inner);
  const cork = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 16, 10), new THREE.MeshStandardMaterial({ color: 0xf3e4c2, roughness: 0.6 }));
  cork.scale.set(1, 0.9, 1); cork.position.y = 0.0;
  const white = new THREE.MeshStandardMaterial({ color: 0xfdfdfb, roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.96 });
  // the skirt: an open cone, 16 feathers suggested by a ridged texture
  const tex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#f7f8f5'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,130,140,0.55)'; c.lineWidth = 2; for (let x = 0; x <= w; x += w / 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } c.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = 0; x < w; x += w / 16) c.fillRect(x + 2, 0, 3, h); });
  tex.wrapS = THREE.RepeatWrapping;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.032, 0.066, 32, 1, true), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide }));
  skirt.position.y = -0.04;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0315, 0.0015, 6, 32), new THREE.MeshStandardMaterial({ color: 0x4a5968, roughness: 0.6 })); rim.rotation.x = Math.PI / 2; rim.position.y = -0.073;
  inner.add(cork, skirt, rim);
  inner.scale.setScalar(scale);
  g.userData.inner = inner;
  return g;
}

// ---- the racket (local +Y = from the butt along the shaft to the head; +Z = the face normal; origin at the butt) -----------------------------
export function buildRacket(color = 0x2fb6a6) {
  const g = new THREE.Group(); g.name = 'racket';
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0115, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.9 })); grip.position.y = 0.1;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x9aa4ae, roughness: 0.35, metalness: 0.6 })); shaft.position.y = 0.3;
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.032, 0.06, 4, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide })); throat.position.y = 0.39; throat.rotation.y = Math.PI / 4;
  const head = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0105, 8, 40), new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 })); head.scale.set(0.112, 0.146, 1); head.position.y = 0.54;
  const stringTex = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(245,245,240,0.8)'; c.lineWidth = 1.6; for (let i = 6; i < w; i += 9) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } });
  const strings = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ map: stringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  strings.scale.set(0.108, 0.142, 1); strings.position.y = 0.54;
  g.add(grip, shaft, throat, head, strings);
  g.userData.sweet = 0.54;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
