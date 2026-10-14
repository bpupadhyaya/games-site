// Amidakuji 3D presenter. It READS what the 2D layer recorded in `v3` (ladder, hanger bar, lanterns, bowls, trails; virtual units) and the
// current look; it never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas: a hanging washi scroll with
// inked rails and lacquered brush-stroke rungs, paper lanterns that travel down with a glowing trail, lacquer prize bowls with sweets on
// a shelf, in a shoji-lit tatami room. The 2D layer only draws labels, plaques and text.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { theme, LAMP } from '../src/ui.js';
import { idx } from '../src/engine.js';
import { buildRoom, buildScroll, makeLantern, makeBowl, makeBrush, glowTexture, ringTexture, lampCol, mix } from './models.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1 + 3.7) * 43758.5453; return s - Math.floor(s); };
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, fx: true },
  { name: 'medium', dpr: 1.5, shadow: 1024, fx: true },
  { name: 'low', dpr: 1, shadow: 0, fx: false },
];
export const LIGHTS = {
  indigo: { bg: 0x0a0d24, key: 0xffd9a0, keyI: 2.6, hemiSky: 0x93a2ff, hemiGround: 0x2a1a30, hemi: 0.95, rim: 0x6f8cff, rimI: 1.2, exposure: 1.0 },
  washi: { bg: 0xdccfae, key: 0xfff0d0, keyI: 2.9, hemiSky: 0xffffff, hemiGround: 0xcdbb9a, hemi: 1.2, rim: 0xffe2b0, rimI: 0.8, exposure: 1.02 },
  ember: { bg: 0x170605, key: 0xffb070, keyI: 2.8, hemiSky: 0xffa070, hemiGround: 0x3a1410, hemi: 0.9, rim: 0xff7a3a, rimI: 1.2, exposure: 1.0 },
};

function makePoints(n, a) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({ size: 10, map: glowTexture(), vertexColors: true, transparent: true, opacity: a, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false });
  const obj = new THREE.Points(geo, mat); obj.frustumCulled = false; obj.renderOrder = 5;
  return { obj, geo, pos, colr, mat, n };
}

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 20, 6000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  const rim = new THREE.DirectionalLight(0x6f8cff, 1.2); rim.position.set(300, 200, -300);
  const lampL = new THREE.PointLight(0xffe0a8, 0, 0, 1.6);   // warm pool of lantern light on the scroll
  scene.add(hemi, key, key.target, rim, lampL);
  B.createEnvironment(renderer, scene, { intensity: 0.28 });

  const root = new THREE.Group(); scene.add(root);     // virtual coordinates: x = vx - W/2, y = H/2 - vy  => root.position = (-W/2, H/2)
  const dyn = new THREE.Group(); root.add(dyn);

  let W = 1, H = 1, look = '', dprNow = 1, sceneKey = '', roomObj = null, scroll = null, clock = 0, lastT = 0, frames = 0, ema = 16, lastLadderKey = '';
  const lanterns = new Map(), bowls = new Map(), usedL = new Map(), usedB = new Map();
  const rungs = [], rails = [];
  let slotMesh = null, ringHl = null, ringCur = null, rod = null, shelf = null, rodKnobs = [], brush = null, markBar = null;
  let railMat = null, rungMats = {}, rungGeo = null, knotGeo = null;
  const glowPts = makePoints(6000, 1), corePts = makePoints(6000, 0.55), dust = makePoints(60, 1);
  root.add(glowPts.obj, corePts.obj); scene.add(dust.obj);

  function applyLook(T) {
    const id = T.name.toLowerCase(), L = LIGHTS[id] ?? LIGHTS.indigo;
    look = id;
    hemi.color.set(L.hemiSky); hemi.groundColor.set(L.hemiGround); hemi.intensity = L.hemi;
    key.color.set(L.key); key.intensity = L.keyI; rim.color.set(L.rim); rim.intensity = L.rimI;
    renderer.toneMappingExposure = L.exposure; renderer.setClearColor(L.bg, 1);
    if (roomObj) scene.remove(roomObj);
    roomObj = buildRoom(T, v3.w, v3.h); scene.add(roomObj);
    railMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(T.ink), roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    rungMats = {
      1: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(T.fixed), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }),
      2: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(T.rung), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, emissive: new THREE.Color(T.rung), emissiveIntensity: 0.12 }),
    };
    clearLadder();
  }

  function clearLadder() {
    if (scroll) { dyn.remove(scroll); scroll = null; }
    for (const m of rails) dyn.remove(m); rails.length = 0;
    for (const m of rungs) dyn.remove(m.group); rungs.length = 0;
    for (const o of [slotMesh, ringHl, ringCur, rod, shelf, markBar, ...rodKnobs]) if (o) dyn.remove(o);
    slotMesh = ringHl = ringCur = rod = shelf = markBar = null; rodKnobs = []; lastLadderKey = '';
  }

  // z = 0 plane maps 1:1 onto the virtual canvas, so 2D hit-testing and labels stay exact.
  function setCamera(t) {
    const w = v3.w, h = v3.h, d = h * 1.7;
    camera.aspect = w / h; camera.fov = (2 * Math.atan(h / (2 * d)) * 180) / Math.PI;
    const dx = v3.calm ? 0 : Math.sin(t * 0.23) * w * 0.022, dy = v3.calm ? 0 : Math.sin(t * 0.17 + 1) * h * 0.008;
    camera.position.set(dx, dy, d); camera.rotation.set(0, 0, 0);
    camera.updateProjectionMatrix();
    // off-axis shear: the paper plane stays fixed on screen while things in front of / behind it slide (real parallax)
    const e = camera.projectionMatrix.elements; e[8] = (-2 * dx) / w; e[9] = (-2 * dy) / h;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
    return d;
  }

  function ensureLadder(rec, T) {
    const g = rec.geo, k = `${look}|${g.n}|${g.rows}|${Math.round(g.xs[0])}|${Math.round(g.sp)}|${Math.round(g.yTop)}|${Math.round(g.yBot)}|${Math.round(g.tr)}|${Math.round(v3.w)}|${Math.round(v3.h)}`;
    if (k === lastLadderKey) return;
    clearLadder(); lastLadderKey = k;
    scroll = buildScroll(T, g); dyn.add(scroll);
    const { xs, sp, tr, yTop, yBot, rowGap, n, rows } = g;
    const lw = clamp(sp * 0.045, 3, 7), rad = lw * 0.8, rw = clamp(rowGap * 0.2, 3.5, 8);
    const railGeo = new THREE.CylinderGeometry(rad, rad, 1, 14);
    for (let i = 0; i < n; i++) {
      const len = yBot - yTop + 6, m = new THREE.Mesh(railGeo, railMat); m.scale.y = len; m.position.set(xs[i], -(yTop + yBot) / 2, rad + 0.6); m.castShadow = m.receiveShadow = true;
      dyn.add(m); rails.push(m);
    }
    const barY = -(g.tokenY - tr * 1.55), bx0 = xs[0] - tr * 1.1, bx1 = xs[n - 1] + tr * 1.1;
    rod = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, bx1 - bx0, 16), B.material('darkWood', { repeat: [3, 1], size: 512 }));
    rod.rotation.z = Math.PI / 2; rod.position.set((bx0 + bx1) / 2, barY, 26); rod.castShadow = true; dyn.add(rod);
    for (const sx of [bx0, bx1]) { const kb = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), B.material('brass')); kb.position.set(sx, barY, 26); kb.castShadow = true; dyn.add(kb); rodKnobs.push(kb); }
    const sw = xs[n - 1] - xs[0] + sp * 1.25, sh = tr * 0.5;
    shelf = new THREE.Mesh(B.roundedBox(sw, sh, tr * 3.4, Math.min(8, sh * 0.3), 3), B.material('darkWood', { repeat: [4, 1], size: 512 }));
    shelf.position.set((xs[0] + xs[n - 1]) / 2, -(g.bowlY + tr * 0.78) - sh / 2, 10 + tr * 1.2); shelf.castShadow = shelf.receiveShadow = true; dyn.add(shelf);
    const len = sp - lw * 1.2;
    rungGeo = new THREE.CapsuleGeometry(rw * 0.55, Math.max(1, len - rw * 1.1), 6, 12); rungGeo.rotateZ(Math.PI / 2);
    knotGeo = new THREE.SphereGeometry(rw * 1.0, 14, 10);
    const sg = new THREE.CircleGeometry(clamp(rowGap * 0.07, 2.2, 4.5) * 1.15, 16);
    slotMesh = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: new THREE.Color(T.ink), roughness: 0.5, transparent: true, opacity: 0.55 }), n * rows);
    slotMesh.count = 0; slotMesh.position.z = 1.0; dyn.add(slotMesh);
    const rt = ringTexture(0.66);
    const ringMk = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 6; m.visible = false; dyn.add(m); return m; };
    ringHl = ringMk(); ringCur = ringMk();
    markBar = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(T.accent) })); markBar.visible = false; dyn.add(markBar);
    brush = brush ?? makeBrush(); brush.visible = false; dyn.add(brush);
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  function updateLadder(rec, T, t) {
    const { geo: g, cells, slots, hl, cursor, popped, dimLines, mark } = rec;
    const { n, rows, xs, ys, sp, rowGap, yTop } = g;
    const rw = clamp(rowGap * 0.2, 3.5, 8);
    railMat.color.set(dimLines ? mix(T.ink, T.bg1, 0.55) : T.ink);
    let used = 0, brushAt = null;
    for (let r = 0; r < rows; r++) for (let gi = 0; gi < n - 1; gi++) {
      const v = cells[idx(n, r, gi)];
      if (!v) continue;
      let o = rungs[used];
      if (!o) { o = { group: new THREE.Group(), mesh: new THREE.Mesh(rungGeo, rungMats[2]), k0: null, k1: null }; o.mesh.castShadow = o.mesh.receiveShadow = true; o.k0 = new THREE.Mesh(knotGeo, rungMats[1]); o.k1 = o.k0.clone(); o.k0.castShadow = o.k1.castShadow = true; o.group.add(o.mesh, o.k0, o.k1); dyn.add(o.group); rungs.push(o); }
      used++;
      const x0 = xs[gi], x1 = xs[gi + 1], y = ys[r], j = (hash(r * 31 + gi + n) - 0.5) * rw * 0.5;
      const key2 = idx(n, r, gi), el = popped && popped[key2] !== undefined ? popped[key2] : 1;
      const pop = clamp(el / 0.25, 0, 1), e = pop * pop * (3 - 2 * pop);
      o.mesh.material = v === 1 ? rungMats[1] : rungMats[2];
      o.k0.visible = o.k1.visible = v === 1;
      const L = x1 - x0, ang = Math.atan2(-j, L);
      o.group.position.set(x0, -y, rw * 0.5 + 1.2); o.group.rotation.z = ang;
      o.mesh.scale.set(Math.max(0.001, e), 1, 1 + (1 - e) * 0.2); o.mesh.position.set((L * e) / 2, 0, 0);
      o.k0.position.set(0, 0, 0); o.k1.position.set(L * e, 0, 0); o.k0.scale.setScalar(e > 0.05 ? 1 : 0.01); o.k1.scale.setScalar(e > 0.9 ? 1 : 0.01);
      o.group.visible = true;
      if (el < 0.32) brushAt = { x: x0 + L * e, y: -(y + j * e) };
    }
    for (let i = used; i < rungs.length; i++) rungs[i].group.visible = false;
    if (slots) {
      let c = 0;
      for (let r = 0; r < rows; r++) for (let gi = 0; gi < n - 1; gi++) {
        if (cells[idx(n, r, gi)]) continue;
        _p.set((xs[gi] + xs[gi + 1]) / 2, -ys[r], 0.4); _m.compose(_p, _q.identity(), _s); slotMesh.setMatrixAt(c++, _m);
      }
      slotMesh.count = c; slotMesh.instanceMatrix.needsUpdate = true; slotMesh.visible = true;
    } else slotMesh.visible = false;
    const pulse = 0.7 + 0.3 * Math.sin(t * 5);
    if (hl) {
      const x = (xs[hl.g] + xs[hl.g + 1]) / 2, y = ys[hl.r];
      ringHl.visible = true; ringHl.position.set(x, -y, 3); ringHl.scale.set(sp * 0.9, Math.max(rowGap * 0.95, 26), 1);
      ringHl.material.color.set(hl.kind === 'remove' ? T.err : T.accent); ringHl.material.opacity = pulse;
    } else ringHl.visible = false;
    if (cursor) {
      const x = (xs[cursor.g] + xs[cursor.g + 1]) / 2, y = ys[cursor.r];
      ringCur.visible = true; ringCur.position.set(x, -y, 3); ringCur.scale.set(sp * 0.82, Math.max(rowGap * 0.85, 22), 1); ringCur.material.color.set(T.text);
    } else ringCur.visible = false;
    if (mark !== null && mark !== undefined) { markBar.visible = true; markBar.scale.x = sp * 0.4; markBar.position.set(xs[mark], -yTop, 4); } else markBar.visible = false;
    if (brushAt) { brush.visible = true; brush.position.set(brushAt.x + rw * 2.2, brushAt.y - rw * 0.5, 30); brush.rotation.set(0, 0, 0.62); brush.scale.setScalar(Math.max(0.5, Math.min(1.2, sp / 90))); }
    else brush.visible = false;
  }

  function takeFrom(map, usedMap, color, make) {
    let arr = map.get(color); if (!arr) { arr = []; map.set(color, arr); }
    const u = usedMap.get(color) ?? 0; usedMap.set(color, u + 1);
    let o = arr[u];
    if (!o) { o = make(color); dyn.add(o); arr.push(o); }
    o.visible = true; return o;
  }
  function updateLanterns(rec, t) {
    usedL.clear();
    const g = rec ? rec.geo : null, rodY = g ? -(g.tokenY - g.tr * 1.55) : null;
    for (const l of v3.lanterns) {
      const o = takeFrom(lanterns, usedL, l.color, (c) => makeLantern(LAMP, c)), u = o.userData, r = l.r * (l.scale ?? 1);
      o.position.set(l.x, -l.y, 10 + r * 0.55); o.scale.setScalar(r); o.rotation.z = -l.sway;
      const dim = l.state === 'dim', lit = l.state === 'lit' || l.state === 'home';
      u.bodyMat.opacity = dim ? 0.5 : 1; u.bodyMat.transparent = dim;
      const flick = v3.calm ? 0 : Math.sin(t * 9 + l.color * 2.1) * 0.04 + Math.sin(t * 5.3 + l.color) * 0.03;
      u.bodyMat.emissiveIntensity = (dim ? 0.18 : 0.5) + (lit ? 0.35 : 0) + l.glow * 0.5 + flick;
      u.halo.material.opacity = dim ? 0.1 : 0.22 + (lit ? 0.28 : 0) + l.glow * 0.45 + flick * 0.5;
      u.halo.scale.setScalar(4.4 + l.glow * 1.2);
      const hanging = g && Math.abs(l.y - g.tokenY) < 1.5;
      const len = hanging && rodY !== null ? Math.max(0.1, (rodY + l.y) / r - 1.3) : 0.35;
      u.cord.scale.y = len; u.cord.position.y = 1.3 + len / 2;
    }
    for (const [c, arr] of lanterns) for (let i = usedL.get(c) ?? 0; i < arr.length; i++) arr[i].visible = false;
  }
  function updateBowls(t) {
    usedB.clear();
    for (const b of v3.bowls) {
      const o = takeFrom(bowls, usedB, b.color, (c) => makeBowl(LAMP, c)), u = o.userData;
      o.position.set(b.x, -b.y + b.r * 0.28, 10 + b.r * 1.15); o.scale.setScalar(b.r); o.rotation.x = 0.36;
      const home = b.state === 'home';
      u.glow.material.opacity = home ? 0.55 + (v3.calm ? 0 : 0.12 * Math.sin(t * 4)) : clamp(b.pulse * 0.7, 0, 0.8);
      u.sweet.position.y = -0.08 + (home ? 0.05 : 0);
    }
    for (const [c, arr] of bowls) for (let i = usedB.get(c) ?? 0; i < arr.length; i++) arr[i].visible = false;
  }
  function updateTrails(d) {
    const k = (2 * d) / v3.h;
    let n = 0; const gp = glowPts, cp = corePts;
    for (const tr of v3.trails) {
      const cg = new THREE.Color(tr.color), cc = cg.clone().lerp(new THREE.Color(0xffffff), 0.55);
      const pts = tr.pts, step = Math.max(3, tr.width);
      let acc = 0; const total = [];
      for (let i = 1; i < pts.length; i++) {
        const w = pts[i].w;
        let f = 1, stop = false;
        if (acc + w > tr.upTo) { f = w > 0 ? clamp((tr.upTo - acc) / w, 0, 1) : 1; stop = true; }
        const a = pts[i - 1], b = pts[i], bx = a.x + (b.x - a.x) * f, by = a.y + (b.y - a.y) * f, dist = Math.hypot(bx - a.x, by - a.y);
        const m = Math.max(1, Math.ceil(dist / step));
        for (let s = 0; s < m; s++) { const u = (s + 1) / m; total.push([a.x + (bx - a.x) * u, a.y + (by - a.y) * u]); }
        acc += w; if (stop) break;
      }
      const cnt = total.length;
      for (let i = 0; i < cnt && n < gp.n; i++, n++) {
        const al = tr.alpha * (0.25 + 0.75 * (i / Math.max(1, cnt - 1)));
        gp.pos[n * 3] = total[i][0]; gp.pos[n * 3 + 1] = -total[i][1]; gp.pos[n * 3 + 2] = 14;
        gp.colr[n * 3] = cg.r * al; gp.colr[n * 3 + 1] = cg.g * al; gp.colr[n * 3 + 2] = cg.b * al;
        cp.pos[n * 3] = gp.pos[n * 3]; cp.pos[n * 3 + 1] = gp.pos[n * 3 + 1]; cp.pos[n * 3 + 2] = 15;
        cp.colr[n * 3] = cc.r * al; cp.colr[n * 3 + 1] = cc.g * al; cp.colr[n * 3 + 2] = cc.b * al;
      }
    }
    gp.geo.setDrawRange(0, n); cp.geo.setDrawRange(0, n);
    gp.geo.attributes.position.needsUpdate = gp.geo.attributes.color.needsUpdate = true;
    cp.geo.attributes.position.needsUpdate = cp.geo.attributes.color.needsUpdate = true;
    const wd = v3.trails.length ? Math.max(...v3.trails.map((q) => q.width)) : 4;
    gp.mat.size = wd * 3.6 * k; cp.mat.size = wd * 1.5 * k;
  }
  function updateDust(t, d) {
    const on = TIERS[tier].fx && !v3.calm;
    dust.obj.visible = on; if (!on) return;
    const k = (2 * d) / v3.h, w = v3.w, h = v3.h, p = dust.pos, c = dust.colr;
    for (let i = 0; i < dust.n; i++) {
      const per = 18 + hash(i) * 14, u = ((t + hash(i + 9) * per) % per) / per;
      p[i * 3] = (hash(i + 3) - 0.5) * w * 1.1 + Math.sin(u * 9 + i) * 24; p[i * 3 + 1] = h * 0.55 - u * h * 1.1; p[i * 3 + 2] = 60 + hash(i + 5) * 120;
      const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + i), al = 0.25 * tw * Math.min(1, u * 8, (1 - u) * 8);
      c[i * 3] = al; c[i * 3 + 1] = 0.82 * al; c[i * 3 + 2] = 0.6 * al;
    }
    dust.geo.setDrawRange(0, dust.n); dust.geo.attributes.position.needsUpdate = dust.geo.attributes.color.needsUpdate = true;
    dust.mat.size = 9 * k;
  }

  function present() {
    const T = theme(), cw = Math.max(1, Math.floor(window.innerWidth)), ch = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (cw !== W || ch !== H || dpr !== dprNow) { W = cw; H = ch; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(cw, ch, false); }
    const sk = `${T.name}|${Math.round(v3.w)}x${Math.round(v3.h)}`;
    if (sk !== sceneKey) {
      sceneKey = sk;
      applyLook(T);
      key.position.set(-v3.w * 0.45, v3.h * 0.55, 900); key.target.position.set(0, 0, 0);
      const sc = key.shadow.camera, ex = Math.max(v3.w, v3.h) * 0.75;
      Object.assign(sc, { left: -ex, right: ex, top: ex, bottom: -ex, near: 100, far: 2400 }); sc.updateProjectionMatrix();
      key.shadow.bias = -0.0005; key.shadow.normalBias = 1.2; key.shadow.radius = 3;
      applyTier();
    }
    root.position.set(-v3.w / 2, v3.h / 2, 0);
    const rec = v3.ladders[0] ?? null;
    if (rec) { ensureLadder(rec, T); updateLadder(rec, T, clock); if (scroll) scroll.visible = true; }
    else if (lastLadderKey) clearLadder();
    updateLanterns(rec, clock); updateBowls(clock);
    const d = setCamera(clock);
    updateTrails(d); updateDust(clock, d);
    const flick = v3.calm ? 1 : 1 + 0.03 * Math.sin(clock * 6.1) + 0.02 * Math.sin(clock * 11.3);
    key.intensity = (LIGHTS[look] ?? LIGHTS.indigo).keyI * flick;
    if (rec) { const g = rec.geo; lampL.position.set((g.xs[0] + g.xs[g.n - 1]) / 2 - v3.w / 2, v3.h / 2 - (g.yTop + (g.yBot - g.yTop) * 0.25), 380); lampL.intensity = 1.6e5 * (look === 'washi' ? 0.5 : 1) * flick; lampL.distance = 0; } else lampL.intensity = 0;
    renderer.setViewport(0, 0, W, H);
    renderer.render(scene, camera);
  }

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; sceneKey = ''; applyTier(); v3.on = true; });   // B.createEnvironment rebuilds scene.environment itself
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, v3,
    wrap(game) {
      return Object.assign({}, game, {
        render(ctx, view) {
          if (!v3.on) { game.render(ctx, view); return; }
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          game.render(ctx, view);
          try { present(); } catch (e) { console.warn('3D present failed', e, e.stack); v3.on = false; }
        },
      });
    },
  };
}
