// The cast net as a real object: a mesh of rings and radial threads, a rope round the rim, a ring of lead weights, flexing like cloth.
// One instance is shared by the scene and its mirrored (reflected) clone: vertex data is shared, the copies only differ in their transform.
const NR = 8, NJ = 30;
export function createNet(THREE) {
  const nv = (NR + 1) * NJ;
  const pos = new Float32Array(nv * 3);
  const attr = new THREE.BufferAttribute(pos, 3);
  const surfIdx = [], lineIdx = [], rimIdx = [];
  const vi = (k, j) => k * NJ + (j % NJ);
  for (let k = 0; k < NR; k++) for (let j = 0; j < NJ; j++) {
    const a = vi(k, j), b = vi(k, j + 1), c = vi(k + 1, j), d = vi(k + 1, j + 1);
    surfIdx.push(a, c, b, b, c, d);
    lineIdx.push(a, c); if (k > 0) lineIdx.push(a, b);
  }
  for (let j = 0; j < NJ; j++) { lineIdx.push(vi(NR, j), vi(NR, j + 1)); rimIdx.push(vi(NR, j)); }
  const mk = (o) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', attr); if (o) g.setIndex(o); return g; };
  const surfMat = new THREE.MeshBasicMaterial({ color: '#c9a864', transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const lineMat = new THREE.LineBasicMaterial({ color: '#e8cf9a', transparent: true, opacity: 0.95 });
  const wTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(12, 11, 1, 16, 16, 14); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, '#9aa0a8'); gr.addColorStop(1, '#25282e');
    g.fillStyle = gr; g.beginPath(); g.arc(16, 16, 14, 0, 6.3); g.fill(); return new THREE.CanvasTexture(c);
  })();
  const wMat = new THREE.PointsMaterial({ size: 0.075, map: wTex, alphaTest: 0.4, sizeAttenuation: true, transparent: true });
  const ropeMat = new THREE.MeshStandardMaterial({ color: '#e8cf9a', roughness: 0.85 });
  const ropeGeo = new THREE.TorusGeometry(1, 0.016, 5, 48); ropeGeo.rotateX(Math.PI / 2);

  const make = (mirrorCopy) => {
    const g = new THREE.Group();
    // the reflected copy has its own, fainter materials so it reads as a reflection and not as a second net
    const sm = mirrorCopy ? surfMat.clone() : surfMat, lm = mirrorCopy ? lineMat.clone() : lineMat, wm = mirrorCopy ? wMat.clone() : wMat, rm = mirrorCopy ? ropeMat.clone() : ropeMat;
    const surf = new THREE.Mesh(mk(surfIdx), sm); surf.frustumCulled = false; surf.renderOrder = 8;
    const lines = new THREE.LineSegments(mk(lineIdx), lm); lines.frustumCulled = false; lines.renderOrder = 9;
    const wts = new THREE.Points(mk(rimIdx), wm); wts.frustumCulled = false; wts.renderOrder = 9;
    const rope = new THREE.Mesh(ropeGeo, rm); rope.castShadow = false;
    g.add(surf, lines, wts, rope); g.userData = { rope, mats: [sm, lm, wm, rm], mirror: !!mirrorCopy }; g.visible = false;
    return g;
  };
  const group = make(false), mirror = make(true);
  const net = { group, mirror, copies: [group, mirror], attr, visible: false };
  net.setStyle = (col) => {
    for (const c of net.copies) { const [sm, lm, wm, rm] = c.userData.mats; sm.color.set(col[1]); lm.color.set(col[0]); rm.color.set(col[0]); wm.color.set('#ffffff'); }
  };
  net.setVisible = (v) => { net.visible = v; group.visible = v; mirror.visible = v; };
  // p: { x,y,z (three coords of the centre), r, bell (rim drop, m), pitch, roll, spin, flutter, alpha, t, lead (0..1 darkness) }
  net.set = (p) => {
    const t = p.t || 0, fl = p.flutter || 0;
    for (let k = 0; k <= NR; k++) {
      const s = k / NR, rho = p.r * s;
      for (let j = 0; j < NJ; j++) {
        const a = (j / NJ) * Math.PI * 2 + (p.spin || 0);
        const wav = fl * p.r * 0.06 * Math.sin(3 * a + t * 11) * s * (1 - 0.3 * s);
        const y = -p.bell * Math.pow(s, 2.2) + wav + 0.03 * p.r * Math.sin(5 * a + t * 3) * s * s * 0.5;
        const i = (k * NJ + j) * 3;
        pos[i] = Math.cos(a) * rho; pos[i + 1] = y; pos[i + 2] = Math.sin(a) * rho;
      }
    }
    attr.needsUpdate = true;
    for (const c of net.copies) {
      const k = (p.alpha ?? 1) * (c.userData.mirror ? 0.3 : 1), [sm, lm, wm, rm] = c.userData.mats;
      sm.opacity = 0.22 * k; lm.opacity = 0.95 * k; wm.opacity = k; rm.transparent = true; rm.opacity = k;
      c.position.set(p.x, p.y, p.z); c.rotation.set(p.pitch || 0, 0, p.roll || 0);
      const rope = c.userData.rope; rope.position.y = -p.bell; rope.scale.setScalar(Math.max(0.05, p.r)); rope.visible = (p.alpha ?? 1) > 0.05;
    }
  };
  net.dispose = () => { for (const m of [surfMat, lineMat, wMat, ropeMat]) m.dispose(); ropeGeo.dispose(); wTex.dispose(); };
  return net;
}
