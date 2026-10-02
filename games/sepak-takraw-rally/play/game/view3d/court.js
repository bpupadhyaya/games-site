// The court, the net, the hall: simple, cheap meshes (few draw calls), styled for an indoor hall or a beach court.
import { THREE } from '../vendor3d/index.js';

const HW = 3.05, HL = 6.7;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
const plane = (w, h, mat, x, y, z, rx = -Math.PI / 2) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rx; m.position.set(x, y, z); return m; };

export function buildCourt(stage, { venue = 'hall', netHeight = 1.52 } = {}) {
  const g = new THREE.Group(); g.name = 'court';
  const beach = venue === 'beach';
  // --- surround floor
  const surround = beach ? '#e3cd9a' : '#1d3b53';
  // The floor texture carries the lines too (one mesh instead of a dozen). Court texture covers (2*(HW+1.6)) x (2*(HL+1.6)) metres.
  const CW = 2 * (HW + 1.6), CL = 2 * (HL + 1.6), TW = 512, TH = Math.round(512 * CL / CW);
  const floorTex = canvasTex(TW, TH, (c, w, h) => {
    c.fillStyle = beach ? '#e8d3a2' : '#2d6e91'; c.fillRect(0, 0, w, h);
    const id = c.getImageData(0, 0, w, h);
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * (beach ? 14 : 8); id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    c.putImageData(id, 0, 0);
    // metres -> texture pixels (x across, z along; texture v runs with -z at the top because the plane is rotated -90 deg about x)
    const X = (x) => (x + CW / 2) / CW * w, Z = (z) => (1 - (z + CL / 2) / CL) * h, S = w / CW;
    c.strokeStyle = '#f6f7fb'; c.lineWidth = 0.04 * S * 1.4; c.lineCap = 'butt';
    c.strokeRect(X(-HW), Z(HL), 2 * HW * S, 2 * HL * S);
    c.lineWidth = 0.025 * S * 1.4; c.beginPath(); c.moveTo(X(-HW), Z(0)); c.lineTo(X(HW), Z(0)); c.stroke();
    c.lineWidth = 0.04 * S * 1.4;
    for (const sg of [-1, 1]) { c.beginPath(); c.arc(X(0), Z(sg * (HL - 2.45)), 0.3 * S, 0, 6.2832); c.stroke(); for (const sx of [-1, 1]) { c.beginPath(); c.arc(X(sx * HW), Z(0), 0.9 * S, sx < 0 ? -Math.PI / 2 : Math.PI / 2, sx < 0 ? Math.PI / 2 : Math.PI * 1.5, sx > 0 ? false : false); c.stroke(); } }
  });
  const outer = plane(60, 70, new THREE.MeshStandardMaterial({ color: surround, roughness: 1 }), 0, -0.002, 0);
  outer.receiveShadow = true; g.add(outer);
  const court = plane(CW, CL, new THREE.MeshStandardMaterial({ map: floorTex, roughness: beach ? 1 : 0.55, metalness: 0 }), 0, 0, 0);
  court.receiveShadow = true; g.add(court);
  // --- net: ONE textured plane (mesh, white tape on top, posts at both ends) so the whole net is a single draw call
  const NW = 6.7, NH = netHeight + 0.03;
  const netTex = canvasTex(512, Math.round(512 * NH / NW * 2), (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const px = (m) => m / NW * w, py = (m) => m / NH * h;      // metres -> pixels
    // mesh: 0.7 m wide strip under the tape
    c.strokeStyle = 'rgba(245,245,245,0.9)'; c.lineWidth = 1.6;
    const top = py(0.03), bot = py(0.03 + 0.7);
    for (let x = px(0.05); x <= w - px(0.05); x += px(0.07)) { c.beginPath(); c.moveTo(x, top); c.lineTo(x, bot); c.stroke(); }
    for (let y = top; y <= bot; y += py(0.07)) { c.beginPath(); c.moveTo(px(0.05), y); c.lineTo(w - px(0.05), y); c.stroke(); }
    c.fillStyle = '#f7f7f7'; c.fillRect(px(0.04), 0, w - px(0.08), py(0.05));                    // tape
    c.fillStyle = '#f2f2f2'; c.fillRect(px(NW / 2 - 3.05) - 3, top, 6, bot - top); c.fillRect(px(NW / 2 + 3.05) - 3, top, 6, bot - top);   // side bands
    c.fillStyle = '#c9ced8'; c.fillRect(0, 0, px(0.08), h); c.fillRect(w - px(0.08), 0, px(0.08), h);                  // posts
  });
  const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.05, roughness: 1, side: 2 });
  const net = plane(NW, NH, netMat, 0, NH / 2, 0, 0); g.add(net);
  // --- the hall: low stands with a crowd texture on both long sides and behind the far end; the beach gets a sea strip and sky
  if (!beach) {
    const crowd = canvasTex(512, 128, (c, w, h) => {
      c.fillStyle = '#10202f'; c.fillRect(0, 0, w, h);
      let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      const cols = ['#c45a4a', '#e0b84c', '#3f86c9', '#e8e8ea', '#52a37a', '#8f5ec2', '#d98b3a'];
      for (let row = 0; row < 6; row++) for (let i = 0; i < 90; i++) { c.fillStyle = cols[Math.floor(rnd() * cols.length)]; c.globalAlpha = 0.55; c.beginPath(); c.arc(i * 5.8 + rnd() * 3, 14 + row * 17 + rnd() * 4, 3.2 + rnd() * 1.4, 0, 6.3); c.fill(); }
      c.globalAlpha = 1;
    }, [3, 1]);
    const standMat = new THREE.MeshStandardMaterial({ map: crowd, roughness: 1 });
    const mk = (w, h, x, y, z, ry) => { const m = plane(w, h, standMat, x, y, z, 0); m.rotation.y = ry; g.add(m); return m; };
    mk(40, 5, 0, 2.5, HL + 9.5, Math.PI);
  } else {
    const sea = plane(80, 20, new THREE.MeshStandardMaterial({ color: '#3fa7c4', roughness: 0.4 }), 0, 0.0, HL + 30);
    g.add(sea);
  }
  stage.add(g);
  return g;
}

// A woven rattan-style ball: 12-hole pattern drawn as interlaced bands on an equirectangular texture.
export function buildBall() {
  const tex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#d8a45a'; c.fillRect(0, 0, w, h);
    c.lineWidth = 7;
    for (let i = -h; i < w + h; i += 36) {
      c.strokeStyle = '#a56a2c'; c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke();
      c.strokeStyle = '#efc178'; c.beginPath(); c.moveTo(i + 18, 0); c.lineTo(i + 18 + h, h); c.stroke();
      c.strokeStyle = '#a56a2c'; c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke();
      c.strokeStyle = '#efc178'; c.beginPath(); c.moveTo(i + h + 18, 0); c.lineTo(i + 18, h); c.stroke();
    }
    c.fillStyle = 'rgba(40,20,5,0.55)';
    for (let k = 0; k < 12; k++) { const x = ((k * 0.618) % 1) * w, y = (0.15 + ((k * 0.37) % 0.7)) * h; c.beginPath(); c.ellipse(x, y, 11, 9, 0, 0, 6.3); c.fill(); }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.067, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0 }));
  m.castShadow = true; m.name = 'ball';
  return m;
}
