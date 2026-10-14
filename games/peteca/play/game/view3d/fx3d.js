// The peteca itself (leather base + a fan of real-looking feathers that flutter, flare and droop), its flight trail, its shadow, and the
// particle system (sand spray, puffs, sparks, rings, feathers, confetti, footprints) in ONE draw call.
// Real size: base 6.5 cm, feathers 14 cm; drawn at 1.25x so it reads on a phone (never more, a ring and a trail do the finding).
import { THREE } from '../vendor3d/index.js';

export const PETECA_SCALE = 1.25;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function featherTex(base, tip, vane) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  // vane: a long pointed oval with a lighter shaft and barbs
  const gr = g.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, base); gr.addColorStop(0.7, vane); gr.addColorStop(1, tip);
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 126); g.bezierCurveTo(6, 100, 4, 40, 32, 2); g.bezierCurveTo(60, 40, 58, 100, 32, 126); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 124); g.lineTo(32, 6); g.stroke();
  g.strokeStyle = 'rgba(20,20,30,0.18)'; g.lineWidth = 1;
  for (let y = 12; y < 120; y += 5) { const w = 24 * Math.sin((y / 128) * Math.PI) * 0.9; g.beginPath(); g.moveTo(32, y); g.lineTo(32 - w, y - 9); g.moveTo(32, y); g.lineTo(32 + w, y - 9); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createPeteca(design) {
  const g = new THREE.Group(); g.name = 'peteca';
  const body = new THREE.Group(); g.add(body);            // local +X = direction of flight (base leads), feathers trail along -X
  const S = PETECA_SCALE;
  const mix = design.mix || null;
  // base: a leather puck with a rubber collar, a lathe around the X axis
  const prof = [[0, 0.014], [0.024, 0.014], [0.031, 0.010], [0.032, 0.000], [0.030, -0.011], [0.024, -0.015], [0.015, -0.017], [0, -0.017]];
  const lg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 20); lg.rotateZ(-Math.PI / 2);
  const baseMat = new THREE.MeshStandardMaterial({ color: design.base[0], roughness: 0.55, metalness: 0.05 });
  const base = new THREE.Mesh(lg, baseMat); base.scale.setScalar(S); base.castShadow = true; body.add(base);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.02 * S, 0.026 * S, 0.02 * S, 20), new THREE.MeshStandardMaterial({ color: design.base[1], roughness: 0.7 }));
  collar.rotation.z = Math.PI / 2; collar.position.x = -0.024 * S; body.add(collar);
  // feathers: 5 curved blades fanned around the axis
  const feathers = [];
  const n = 7, FL = 0.15 * S, FW = 0.022 * S, SEG = 7;
  for (let k = 0; k < n; k++) {
    const col = mix ? mix[k % mix.length] : null;
    const tex = featherTex(col || design.f[1], design.tip, col || design.f[0]);
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: '#ffffff' });
    const geo = new THREE.PlaneGeometry(FW * 2, FL, 1, SEG); geo.translate(0, -FL / 2, 0);     // from the base (y=0) to the tip (y=-FL)
    const m = new THREE.Mesh(geo, mat);
    const holder = new THREE.Group(); holder.add(m);
    holder.rotation.x = (k / n) * Math.PI * 2 + 0.2;
    // the blade lies along -X after this rotation
    m.rotation.z = Math.PI / 2; m.rotation.y = 0;
    const base0 = geo.attributes.position.array.slice();
    feathers.push({ holder, mesh: m, geo, base0, ph: k * 1.7, tilt: 0.22 });
    body.add(holder);
  }
  // pivot so feathers start at the collar
  feathers.forEach((f) => { f.holder.position.x = -0.03 * S; });
  g.userData.feathers = feathers;
  g.userData.setDesign = (d) => {
    baseMat.color.set(d.base[0]); collar.material.color.set(d.base[1]);
    feathers.forEach((f, k) => {
      const col = d.mix ? d.mix[k % d.mix.length] : null;
      const t = featherTex(col || d.f[1], d.tip, col || d.f[0]); f.mesh.material.map.dispose(); f.mesh.material.map = t; f.mesh.material.needsUpdate = true;
    });
  };
  // animate: speed (m/s), t (s), spin, droop (0 flying, 1 resting), flare (extra spread from deceleration)
  g.userData.animate = (t, speed, spin, droop, flare) => {
    const sp = clamp(speed / 22, 0, 1);
    feathers.forEach((f, k) => {
      const fan = 0.42 - sp * 0.22 + flare * 0.16 + droop * 0.18;         // the faster it flies, the more the feathers are swept into line
      f.mesh.rotation.y = fan * (k % 2 ? 1 : 1);
      f.holder.rotation.z = 0;
      // bend the blade along its length: flutter grows with speed, a soft droop when it lies on the sand
      const p = f.geo.attributes.position, b = f.base0;
      for (let i = 0; i < p.count; i++) {
        const y = b[i * 3 + 1], u = clamp(-y / FL, 0, 1);                  // 0 at the base, 1 at the tip
        const flutter = Math.sin(t * (30 + spin * 6) + f.ph + u * 5) * (0.003 + 0.014 * sp) * u * u;
        const lag = -u * u * (0.02 + 0.07 * sp);                           // tips trail behind the line of travel
        p.setZ(i, b[i * 3 + 2] + flutter + droop * u * u * 0.03 * Math.sin(f.ph));
        p.setX(i, b[i * 3] + lag * 0.0 + flutter * 0.5);
      }
      p.needsUpdate = true;
      f.holder.rotation.x = (k / 7) * Math.PI * 2 + 0.2;
    });
  };
  return g;
}

// ---- trail: a tapering ribbon behind the peteca -------------------------------------------------------------------------------------
export function createTrail(n = 20) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4));
  const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec4 aCol; varying vec4 vC; void main(){ vC=aCol; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec4 vC; void main(){ gl_FragColor = vec4(vC.rgb*vC.a, vC.a); }',
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5;
  const hist = [];
  return {
    mesh,
    clear() { hist.length = 0; geo.setDrawRange(0, 0); },
    push(x, y, z) { hist.push({ x, y, z }); if (hist.length > n) hist.shift(); },
    update(color, a0 = 0.5, w0 = 0.07) {
      const m = hist.length; if (m < 2) { geo.setDrawRange(0, 0); return; }
      const c = new THREE.Color(color);
      for (let i = 0; i < m; i++) {
        const p = hist[i], q = hist[Math.min(m - 1, i + 1)], r = hist[Math.max(0, i - 1)];
        let dx = q.x - r.x, dy = q.y - r.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const k = i / (m - 1), w = w0 * k;
        pos.set([p.x - dy * w, p.y + dx * w, p.z, p.x + dy * w, p.y - dx * w, p.z], i * 6);
        const a = a0 * k * k;
        col.set([c.r, c.g, c.b, a, c.r, c.g, c.b, a], i * 8);
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.aCol.needsUpdate = true;
      geo.setDrawRange(0, (m - 1) * 6);
    },
  };
}

// ---- particles ----------------------------------------------------------------------------------------------------------------------
// kinds: 0 sand puff, 1 spark, 2 ring, 3 feather, 4 confetti, 5 footprint
export function createParticles(max = 400) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), size = new Float32Array(max), kind = new Float32Array(max), rot = new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aCol', new THREE.BufferAttribute(col, 4));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 800 } },
    vertexShader: `attribute vec4 aCol; attribute float aSize; attribute float aKind; attribute float aRot; uniform float uScale;
      varying vec4 vC; varying float vK; varying float vR;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = max(1.0, aSize*uScale/(-mv.z)); vC=aCol; vK=aKind; vR=aRot; }`,
    fragmentShader: `varying vec4 vC; varying float vK; varying float vR;
      void main(){
        vec2 p = gl_PointCoord*2.0-1.0; float a = 0.0;
        float cs = cos(vR), sn = sin(vR); vec2 q = vec2(cs*p.x - sn*p.y, sn*p.x + cs*p.y);
        if (vK < 0.5) { float d = length(p); a = smoothstep(1.0, 0.1, d); a *= a; }
        else if (vK < 1.5) { float d = length(p); a = smoothstep(1.0, 0.0, d); a = a*a*a + 0.5*smoothstep(0.35,0.0,d); }
        else if (vK < 2.5) { float d = length(p); a = smoothstep(0.16, 0.0, abs(d-0.78)); }
        else if (vK < 3.5) { float d = length(vec2(q.x*0.8, q.y*2.6)); a = smoothstep(1.0, 0.8, d); }
        else if (vK < 4.5) { a = (abs(q.x) < 0.9 && abs(q.y) < 0.45) ? 1.0 : 0.0; }
        else { float d = length(vec2(p.x, p.y*3.2)); a = smoothstep(1.0, 0.2, d); }
        if (a <= 0.003) discard;
        gl_FragColor = vec4(vC.rgb, vC.a*a);
      }`,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 6;
  const list = [];
  let fp = 0;
  const api = {
    points: pts, list,
    spawn(o) { list.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, t: 0, max: 1, size: 0.1, grow: 0, kind: 0, col: [1, 1, 1], a: 1, rot: 0, spin: 0, floor: true, ...o }); if (list.length > max) list.shift(); },
    update(dt, extra = null) {
      let n = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i]; q.t += dt;
        if (q.t >= q.max) { list.splice(i, 1); continue; }
        q.vy -= q.g * dt; const dk = Math.exp(-q.drag * dt); q.vx *= dk; q.vy *= dk; q.vz *= dk;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rot += q.spin * dt;
        if (q.floor && q.y < q.kind * 0 + 0.0) { q.y = 0; q.vy *= -0.2; q.vx *= 0.6; q.vz *= 0.6; if (q.g > 0) q.spin *= 0.3; }
      }
      const all = extra && extra.length ? list.concat(extra) : list;
      for (const q of all) {
        if (n >= max) break;
        const k = q.t / q.max;
        pos[n * 3] = q.x; pos[n * 3 + 1] = q.y; pos[n * 3 + 2] = q.z;
        const fade = q.raw ? 1 : q.kind === 5 ? (1 - k) : (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88);
        col[n * 4] = q.col[0]; col[n * 4 + 1] = q.col[1]; col[n * 4 + 2] = q.col[2]; col[n * 4 + 3] = q.a * clamp(fade, 0, 1);
        size[n] = q.size * (1 + q.grow * k); kind[n] = q.kind; rot[n] = q.rot;
        n++;
      }
      geo.setDrawRange(0, n);
      for (const a of ['position', 'aCol', 'aSize', 'aKind', 'aRot']) geo.attributes[a].needsUpdate = true;
      return n;
    },
    setScale(px) { mat.uniforms.uScale.value = px; },
    clear() { list.length = 0; },
  };
  void fp;
  return api;
}

const hex = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
export { hex };
