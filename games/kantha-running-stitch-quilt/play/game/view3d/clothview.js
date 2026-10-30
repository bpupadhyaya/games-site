// ClothView: turns a scene description (src/v3.js frame, built by view.js) into meshes: the quilt, twisted thread tubes, knots, chalk glow,
// the needle with its trailing thread. Two instances exist: the live scene and a small one that bakes sprites for the flat screens.
import * as THREE from '../vendor3d/three.js';
import { UNIT } from '../src/v3.js';
import { createCloth } from './cloth.js';
import { tubesGeometry, dashChain, THREAD_R } from './thread.js';
import { buildNeedle, threadTexture, knotGeometry, eyeletGeometry, NEEDLE_LEN } from './props.js';
import { texOf, ribbonCanvas, glowCanvas, clamp, hexRgb } from './tex.js';

const RK = 0.0066;   // knot radius (m): drawn about 1.4x a real French knot so it reads and taps well on a phone
const UP = new THREE.Vector3(0, 1, 0);
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export function createClothView({ tier = 2, size = 10, withNeedle = true } = {}) {
  const group = new THREE.Group();
  const cloth = createCloth({ tier, size });
  group.add(cloth.group);
  const half = size * UNIT / 2;
  const W = (x) => (x - size / 2) * UNIT;
  const tw = threadTexture();

  // ---- materials by thread slot (colours come from the look)
  const threadMats = new Map();
  let slotColors = [];
  function threadMat(slot, variant = 0) {
    const k = slot + ':' + variant;
    let m = threadMats.get(k);
    if (!m) {
      const col = new THREE.Color(slotColors[slot % slotColors.length] || '#b52a2c');
      const t2 = tw.clone(); t2.needsUpdate = true;
      m = new THREE.MeshPhysicalMaterial({ color: col, map: t2, emissive: col.clone().multiplyScalar(0.08), roughness: 0.6, sheen: 0.6, sheenRoughness: 0.45, sheenColor: col.clone().lerp(new THREE.Color(1, 1, 1), 0.3), envMapIntensity: 0.5 });
      if (variant === 1) { m.transparent = true; m.opacity = 0.42; m.depthWrite = false; }
      threadMats.set(k, m);
    }
    return m;
  }
  const knotMats = new Map();
  function knotMat(slot, dim) {
    const k = slot + ':' + (dim ? 1 : 0);
    let m = knotMats.get(k);
    if (!m) {
      const base = threadMat(slot, 0);
      m = base.clone(); m.map = base.map; m.emissive = new THREE.Color(slotColors[slot % slotColors.length] || '#b52a2c').multiplyScalar(0.18);
      if (dim) { m.transparent = true; m.opacity = 0.62; m.depthWrite = false; }
      knotMats.set(k, m);
    }
    return m;
  }
  const kGeo = knotGeometry(RK), eGeo = eyeletGeometry(RK * 1.25), dGeo = knotGeometry(RK * 0.55), gGeo = knotGeometry(RK * 0.8);
  const glowMapTex = texOf(glowCanvas(64, [255, 226, 150]), { wrap: false });
  const ribMapTex = texOf(ribbonCanvas(64), { wrap: false, srgb: false });
  const ringGeo = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);

  // ---- thread meshes: finished rows are cached; the row in progress is rebuilt every frame
  const threadGroup = new THREE.Group(); group.add(threadGroup);
  const rows = new Map();   // id -> { mesh, ver }
  const live = new THREE.Mesh(new THREE.BufferGeometry(), threadMat(0)); live.frustumCulled = false; live.castShadow = true; live.visible = false; threadGroup.add(live);
  let lastPatch = '';
  const U_PER_M = 1 / (THREAD_R * 1.7);
  function buildRow(entry, mat, into = null) {
    const chains = [];
    for (const d of entry.dashes) {
      if (d.u0 >= entry.upTo) break;
      chains.push(dashChain(d, entry.upTo, cloth.heightAt, size));
    }
    const g = tubesGeometry(chains, 6, U_PER_M, into);
    return g;
  }
  const heightFn = (x, y) => cloth.heightAt(x, y);
  cloth.heightAt = cloth.heightAt.bind(cloth);

  // ---- glow ribbons for highlighted rows (hint, selected row)
  const ribs = new Map();   // dashes -> mesh
  function ribbonFor(dashes, run) {
    let r = ribs.get(dashes);
    if (r && r.ver === cloth.version) return r.mesh;
    const pts = [];
    for (const d of dashes) for (let i = 0; i < d.pts.length; i += 3) pts.push([d.pts[i], d.pts[i + 1]]);
    // ordered along the row: dashes are already in order of arc length
    const n = pts.length, P = new Float32Array(n * 2 * 3), UVa = new Float32Array(n * 2 * 2), I = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nx = -ty, ny = tx, w = 0.34, x = pts[i][0], y = pts[i][1], hh = cloth.heightAt(x, y) + 0.0022;
      P[i * 6] = W(x + nx * w); P[i * 6 + 1] = hh; P[i * 6 + 2] = W(y + ny * w);
      P[i * 6 + 3] = W(x - nx * w); P[i * 6 + 4] = hh; P[i * 6 + 5] = W(y - ny * w);
      UVa[i * 4] = 0; UVa[i * 4 + 1] = 0; UVa[i * 4 + 2] = 0; UVa[i * 4 + 3] = 1;
      if (i < n - 1) { const q = i * 2; I.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
    }
    // skip gaps between dashes: only connect consecutive points inside the same dash
    const g = r ? r.mesh.geometry : new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UVa, 2)); g.setIndex(I);
    if (!r) {
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ribMapTex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
      m.renderOrder = 3; m.frustumCulled = false; group.add(m); r = { mesh: m, ver: cloth.version };
      ribs.set(dashes, r);
    }
    r.ver = cloth.version;
    void run;
    return r.mesh;
  }

  // ---- markers (pool)
  const markGroup = new THREE.Group(); group.add(markGroup);
  const marks = [];
  let markN = 0;
  function markAt(i) {
    let m = marks[i];
    if (!m) {
      const body = new THREE.Mesh(kGeo, knotMat(0, false)); body.castShadow = true; body.receiveShadow = true;
      const halo = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: glowMapTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
      halo.renderOrder = 4;
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe3a1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
      ring.renderOrder = 4;
      const g = new THREE.Group(); g.add(body, halo, ring); markGroup.add(g);
      m = { g, body, halo, ring }; marks.push(m);
    }
    return m;
  }

  // ---- floats (dotted thread seen through the cloth)
  const floatMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  floatMesh.frustumCulled = false; floatMesh.renderOrder = 2; group.add(floatMesh);
  const _c = new THREE.Color();
  function buildFloats(list) {
    let n = 0; for (const f of list) n += Math.max(1, Math.ceil(Math.hypot(f.bx - f.ax, f.by - f.ay) / 0.25));
    const P = new Float32Array(n * 4 * 3), C = new Float32Array(n * 4 * 4), I = [];
    let q = 0;
    for (const f of list) {
      const dx = f.bx - f.ax, dy = f.by - f.ay, len = Math.hypot(dx, dy), k = Math.max(1, Math.ceil(len / 0.25));
      if (len < 0.05) continue;
      const ux = dx / len, uy = dy / len, nx = -uy * 0.045, ny = ux * 0.045;
      _c.set(slotColors[f.slot % slotColors.length] || '#b52a2c');
      for (let i = 0; i < k; i++) {
        const t0 = (i + 0.1) / k, t1 = (i + 0.55) / k;
        const xa = f.ax + dx * t0, ya = f.ay + dy * t0, xb = f.ax + dx * t1, yb = f.ay + dy * t1;
        const h0 = cloth.heightAt(xa, ya) + 0.0009, h1 = cloth.heightAt(xb, yb) + 0.0009, o = q * 12, c = q * 16;
        P[o] = W(xa + nx); P[o + 1] = h0; P[o + 2] = W(ya + ny); P[o + 3] = W(xa - nx); P[o + 4] = h0; P[o + 5] = W(ya - ny);
        P[o + 6] = W(xb + nx); P[o + 7] = h1; P[o + 8] = W(yb + ny); P[o + 9] = W(xb - nx); P[o + 10] = h1; P[o + 11] = W(yb - ny);
        for (let v = 0; v < 4; v++) { C[c + v * 4] = _c.r; C[c + v * 4 + 1] = _c.g; C[c + v * 4 + 2] = _c.b; C[c + v * 4 + 3] = f.alpha; }
        const b = q * 4; I.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); q++;
      }
    }
    const g = floatMesh.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(P.subarray(0, q * 12), 3)); g.setAttribute('color', new THREE.BufferAttribute(C.subarray(0, q * 16), 4)); g.setIndex(I);
    floatMesh.visible = q > 0;
  }

  // ---- warm glow where a motif completes
  const glowPool = [];
  function glowAt(i) {
    let m = glowPool[i];
    if (!m) { m = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: glowMapTex, color: 0xffd48a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 5; group.add(m); glowPool.push(m); }
    return m;
  }

  // ---- needle + trailing thread
  let needle = null, tail = null;
  const nstate = { tip: new THREE.Vector3(), dir: new THREE.Vector3(1, 0.5, 0), q: new THREE.Quaternion(), init: false, mid: new THREE.Vector3(), midV: new THREE.Vector3(), slot: 0, visible: false };
  if (withNeedle) {
    needle = buildNeedle(); needle.visible = false; group.add(needle);
    tail = new THREE.Mesh(new THREE.BufferGeometry(), threadMat(0)); tail.frustumCulled = false; tail.castShadow = true; tail.visible = false; group.add(tail);
  }
  const ANCHOR = new THREE.Vector3(0.15, 0.002, -0.19);
  const tmpC = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

  function groundAt(x, z) {
    const cx = x / UNIT + size / 2, cy = z / UNIT + size / 2;
    if (cx >= 0 && cy >= 0 && cx <= size && cy <= size) return cloth.heightAt(cx, cy);
    const ax = Math.abs(x), az = Math.abs(z);
    if (ax < half * 1.2 && az < half * 1.2) return -0.0046;
    if (ax < half * 1.45 && az < half * 1.45) return -0.0075;
    return -0.0105;
  }

  // tail chain
  const TN = 22, SEG = 0.0066;
  const tailN = Array.from({ length: TN }, () => ({ x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 }));
  let tailInit = false;
  function stepTail(eye, dt) {
    const n0 = tailN[0];
    if (!tailInit || Math.hypot(eye.x - n0.x, eye.y - n0.y, eye.z - n0.z) > 0.08) {
      tailN.forEach((p, i) => { p.x = p.px = eye.x - nstate.dir.x * 0.004 * i; p.y = p.py = eye.y + 0.002 * i; p.z = p.pz = eye.z - nstate.dir.z * 0.004 * i; });
      tailInit = true;
    }
    const subs = 2, h = Math.min(dt, 0.05) / subs;
    for (let s = 0; s < subs; s++) {
      n0.px = n0.x; n0.py = n0.y; n0.pz = n0.z; n0.x = eye.x; n0.y = eye.y; n0.z = eye.z;
      for (let i = 1; i < TN; i++) {
        const p = tailN[i];
        const vx = (p.x - p.px) * 0.93, vy = (p.y - p.py) * 0.93, vz = (p.z - p.pz) * 0.93;
        p.px = p.x; p.py = p.y; p.pz = p.z;
        p.x += vx; p.y += vy - 3.2 * h * h; p.z += vz;
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < TN; i++) {
          const a = tailN[i - 1], b = tailN[i];
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, k = (d - SEG) / d;
          if (i === 1) { b.x -= dx * k; b.y -= dy * k; b.z -= dz * k; } else { a.x += dx * k * 0.5; a.y += dy * k * 0.5; a.z += dz * k * 0.5; b.x -= dx * k * 0.5; b.y -= dy * k * 0.5; b.z -= dz * k * 0.5; }
        }
        // a little bending stiffness: nodes two apart keep some distance, so the thread bends in soft arcs instead of folding
        for (let i = 2; i < TN; i++) {
          const a = tailN[i - 2], b = tailN[i], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = Math.hypot(dx, dy, dz) || 1e-6, mn = SEG * 1.86;
          if (d < mn) { const k = ((d - mn) / d) * 0.5; a.x += dx * k; a.y += dy * k; a.z += dz * k; b.x -= dx * k; b.y -= dy * k; b.z -= dz * k; }
        }
        for (let i = 1; i < TN; i++) { const p = tailN[i], g = groundAt(p.x, p.z) + THREAD_R * 1.05; if (p.y < g) { p.y = g; p.px = p.x - (p.x - p.px) * 0.6; p.pz = p.z - (p.z - p.pz) * 0.6; } }
      }
    }
  }

  function poseNeedle(nd, dt, moving) {
    const el = nd.mode === 'rest' ? 0.95 : nd.mode === 'hop' ? 0.5 + 0.35 * Math.sin(Math.PI * nd.hop) : 0.62;
    // the tip: in the cloth when sewing/resting, lifted along the hop arc
    const x = W(nd.x), z = W(nd.y);
    const lift = nd.mode === 'hop' ? 0.04 * Math.sin(Math.PI * nd.hop) : 0;
    const gy = cloth.heightAt(nd.x, nd.y) - (nd.mode === 'hop' ? -0.0006 : 0.0009) + lift;
    const tx = Math.cos(nd.ang), tz = Math.sin(nd.ang);
    // back vector: the eye end points back against the travel direction; a hop keeps a steady yaw
    const bx = -tx, bz = -tz, ce = Math.cos(el), se = Math.sin(el);
    tmpA.set(x, gy, z); tmpB.set(bx * ce, se, bz * ce).normalize();
    // travelling to a far point (a new row): the needle is lifted off the cloth in an arc instead of sliding over it
    if (nstate.init) { const far = Math.hypot(x - nstate.tip.x, z - nstate.tip.z); tmpA.y += Math.min(0.035, Math.max(0, far - 0.004) * 0.6); }
    if (!nstate.init) { nstate.tip.copy(tmpA); nstate.dir.copy(tmpB); nstate.init = true; }
    const k = 1 - Math.exp(-dt * (nd.mode === 'sew' ? 60 : 24));
    // critically-damped follower with a speed cap: a jump to another row becomes a smooth glide, normal sewing (~0.4 m/s) tracks closely
    if (!nstate.vel) nstate.vel = new THREE.Vector3();
    const want = tmpC.copy(tmpA).sub(nstate.tip).multiplyScalar(45); if (want.length() > 0.9) want.setLength(0.9);
    nstate.vel.lerp(want, 1 - Math.exp(-dt * 22));
    nstate.tip.addScaledVector(nstate.vel, dt);
    if (tmpA.distanceTo(nstate.tip) < 0.0004) nstate.tip.copy(tmpA);
    void k;
    nstate.dir.lerp(tmpB, 1 - Math.exp(-dt * 14)).normalize();
    needle.position.copy(nstate.tip);
    // local +X -> dir
    tmpQ.setFromUnitVectors(new THREE.Vector3(1, 0, 0), nstate.dir);
    needle.quaternion.copy(tmpQ);
    needle.visible = true;
    nstate.slot = nd.slot;
    // the loose end of the thread: a verlet chain pinned at the eye (gravity, damping, rests on the cloth), so it trails and swings
    const eye = needle.userData.eye.clone().applyMatrix4(needle.matrixWorld.identity().compose(needle.position, needle.quaternion, needle.scale));
    stepTail(eye, dt);
    const pts = tailN.map((p) => [p.x, p.y, p.z]);
    tail.geometry.dispose(); tail.geometry = tubesGeometry([{ pts, r: THREAD_R * 0.95 }], 5, U_PER_M);
    tail.material = threadMat(nd.slot); tail.visible = true;
    void moving;
  }

  // ---- apply a frame ----------------------------------------------------------------------------------------------------------------------
  let rebuildBudget = 0;
  const out = { needle: null, tip: nstate.tip, dir: nstate.dir };
  function apply(fr, dt, clock) {
    slotColors = fr.T.thread;
    if (lastPatch !== fr.look + '|' + fr.key) {
      // new patch or look: drop cached rows
      for (const r of rows.values()) { threadGroup.remove(r.mesh); r.mesh.geometry.dispose(); }
      rows.clear(); for (const r of ribs.values()) { group.remove(r.mesh); r.mesh.geometry.dispose(); } ribs.clear();
      if (lastPatch.split('|')[0] !== fr.look) { for (const m of threadMats.values()) m.dispose(); threadMats.clear(); for (const m of knotMats.values()) m.dispose(); knotMats.clear(); }
      lastPatch = fr.look + '|' + fr.key;
      cloth.setLook(fr.look, fr.T); cloth.setPatch(fr.key, fr.runs);
      nstate.init = false; nstate.midInit = false; tailInit = false;
    }
    const targets = new Map(fr.targets);
    cloth.sync(targets, dt);
    // bake (finished rows only; the row in progress stays chalk until it is done)
    const doneRows = fr.sewn.filter((e) => e.upTo >= 1e8);
    const key = fr.look + '|' + fr.key + '|' + doneRows.map((e) => e.id).join(',') + '|' + fr.chalk.map((c) => c.ri).join(',');
    cloth.bake(key, {
      T: fr.T,
      sewn: doneRows.map((e) => ({ run: e.run, dashes: e.dashes, upTo: 1e9 })),
      chalk: fr.chalk.map((c) => ({ dashes: c.dashes, tint: c.tint, thin: c.thin, run: c.run })),
    });

    // finished rows
    const seen = new Set();
    rebuildBudget = 2;
    for (const e of fr.sewn) {
      if (e.upTo < 1e8) continue;
      seen.add(e.id);
      let r = rows.get(e.id);
      const stale = r && r.ver !== cloth.version && cloth.settled && rebuildBudget > 0;
      if (!r || stale) {
        const g = buildRow(e, null, r ? r.mesh.geometry : null);
        if (!r) { const m = new THREE.Mesh(g, threadMat(e.slot)); m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; threadGroup.add(m); r = { mesh: m, ver: cloth.version }; rows.set(e.id, r); }
        r.ver = cloth.version; if (stale) rebuildBudget -= 1;
      }
      r.mesh.material = threadMat(e.slot); r.mesh.visible = true;
    }
    for (const [id, r] of rows) if (!seen.has(id)) { r.mesh.visible = false; }
    // the row in progress
    const prog = fr.sewn.find((e) => e.upTo < 1e8);
    if (prog) {
      const g = buildRow(prog, null, null);
      live.geometry.dispose(); live.geometry = g; live.material = threadMat(prog.slot); live.visible = true;
    } else live.visible = false;

    // chalk glow
    let rb = 0;
    const used = new Set();
    for (const c of fr.chalk) {
      if (!c.glow) continue;
      const m = ribbonFor(c.dashes, c.run); used.add(m);
      m.visible = true; m.material.color.set(c.tint).multiplyScalar(0.34 + 0.18 * Math.sin(clock * 5)); rb++;
    }
    for (const r of ribs.values()) if (!used.has(r.mesh)) r.mesh.visible = false;

    buildFloats(fr.floats);

    // markers
    markN = 0;
    for (const mk of fr.markers) {
      const m = markAt(markN++);
      m.g.visible = true;
      const x = W(mk.x), z = W(mk.y), h = cloth.heightAt(mk.x, mk.y);
      const kind = mk.kind || 'knot', sc = (mk.active ? 1.28 : 1) * (kind === 'dot' ? 1 : 1);
      m.body.geometry = kind === 'eyelet' ? eGeo : kind === 'dot' ? dGeo : kind === 'gold' || kind === 'miss' ? gGeo : kGeo;
      if (kind === 'gold') { m.body.material = goldMat(); } else if (kind === 'miss') { m.body.material = missMat(); } else m.body.material = knotMat(mk.slot, !!mk.dim);
      m.body.position.set(0, kind === 'eyelet' ? 0.0004 : -0.0004, 0);
      m.body.scale.setScalar(sc);
      m.g.position.set(x, h + 0.0006 + (mk.active ? 0.0012 * (0.5 + 0.5 * Math.sin(clock * 6 + mk.x)) : 0), z);
      m.g.rotation.y = (mk.x * 7.3 + mk.y * 3.1);
      const a = mk.active ? 0.55 + 0.25 * Math.sin(clock * 5) : mk.pulse ? 0.4 + 0.4 * mk.pulse : 0;
      m.halo.visible = a > 0.01; m.halo.material.opacity = a; m.halo.scale.setScalar(RK * 4.2); m.halo.position.y = 0.0006;
      m.halo.material.color.set(slotColors[mk.slot % slotColors.length]).lerp(new THREE.Color(1, 0.92, 0.7), 0.55);
      const rg = mk.ring !== undefined && mk.ring >= 0;
      m.ring.visible = rg; if (rg) { m.ring.scale.setScalar(RK * (2.2 + 6 * mk.ring)); m.ring.material.opacity = 0.2 + 0.6 * (1 - mk.ring); m.ring.position.y = 0.0007; }
    }
    for (let i = markN; i < marks.length; i++) marks[i].g.visible = false;

    // glow pulses of completed motifs
    cloth.glows.forEach((gl, i) => {
      const m = glowAt(i), t = gl.t / 1.6, a = Math.sin(Math.PI * Math.min(1, t * 1.15));
      m.visible = true; m.position.set(W(gl.c[0]), cloth.heightAt(gl.c[0], gl.c[1]) + 0.004, W(gl.c[1]));
      m.scale.setScalar(Math.max(0.01, gl.r * UNIT * (1.1 + t * 0.9))); m.material.opacity = 0.32 * a;
    });
    for (let i = cloth.glows.length; i < glowPool.length; i++) glowPool[i].visible = false;

    // needle
    if (withNeedle) {
      if (fr.needle && !fr.done) poseNeedle(fr.needle, dt, fr.needle.mode !== 'rest');
      else { needle.visible = false; tail.visible = false; nstate.init = false; nstate.midInit = false; tailInit = false; }
    }
    out.needle = fr.needle && !fr.done ? fr.needle : null;
    out.slot = nstate.slot;
    return out;
  }
  let _gold = null, _miss = null;
  const goldMat = () => _gold || (_gold = new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0x6a4300, metalness: 0.7, roughness: 0.3 }));
  const missMat = () => _miss || (_miss = new THREE.MeshStandardMaterial({ color: 0xd8442c, emissive: 0x4a0d04, roughness: 0.5, transparent: true, opacity: 0.8 }));

  return {
    group, cloth, apply, heightFn, out, nstate, needle,
    get eyeWorld() { return needle ? needle.userData.eye.clone().applyMatrix4(needle.matrixWorld) : null; },
    setShadows(on) { group.traverse((o) => { if (o.isMesh && o.userData.noShadow !== true) o.receiveShadow = on && o.receiveShadow; }); },
    dispose() { cloth.dispose(); },
  };
}
export { NEEDLE_LEN, ease, hexRgb };
