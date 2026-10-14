// Maamoul Cookie Moulding: 3D presenter. READS what the 2D screens recorded in `v3.items` (and the one-shot `v3.ev` effects);
// never writes the simulation. One WebGL canvas sits behind the kit's transparent 2D canvas. The camera looks straight down on
// a virtual plane whose x/z are the game's virtual units, so every lit, shadowed object lands exactly where the 2D layout put
// it (hit areas stay true) while the 2D layer keeps drawing text, icons and effects on top.
// Boot order: the flat 2D art is on screen at once; this module builds the scene after the first frame, in slices (a frame
// between them), compiles shaders, then flips `v3.on` and fades the 3D canvas in.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws its flat 2D art; context restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { drawWall, drawBench, drawCookie, drawMould, drawDough, drawGhost, carve, PATTERNS, bakeColor, GAUGE_STOPS, dims } from '../src/art.js';
import { K } from '../src/engine.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const mkTex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.flipY = false; return t; };
function paint(c, fn) { const x = c.getContext('2d'); v3.raw = true; try { fn(x); } finally { v3.raw = false; } }
const hashf = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// heights (world y) of the surfaces things stand on
const H = { bench: 18, tray: 15.5, oven: 26, panel: 10, tile: 14 };

export function createPresenter({ kitCanvas, quality = 'high' }) {
  const out = { ok: false, wrap: null, tier: 0 };
  let renderer = null, ready = false, pendingOn = false, failed = false;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0;transition:opacity 0.45s ease';
  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  let scene, camera, key, rim, hemi, ovenLight, lamp, vig, envHandle, motes;
  let wallMesh, wallTex, wallBump, wallKey = '';
  let Wpx = 0, Hpx = 0, dprNow = 0;
  const M = {}, G = {};
  const texCookie = new Map(), texMould = new Map(), texGhost = new Map(), texBench = new Map(), slabGeo = new Map();
  let clock = 0, lastNow = 0, frames = 0, ema = 16, pulse = 0, steamT = 0, ovenAt = null;
  const pools = {}, surf = [], fxPool = [];
  const BASE0 = new THREE.Color(), tint = new THREE.Color();

  // ------------------------------------------------------------------------------------------------ geometry helpers
  function slabG(w, d, h, rad, bev) {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`;
    let g = slabGeo.get(k);
    if (!g) {
      if (slabGeo.size > 220) { for (const v of slabGeo.values()) v.dispose(); slabGeo.clear(); }
      g = B.slab(Math.max(2, w), Math.max(2, d), h, Math.max(1, Math.min(rad, w / 2 - 0.5, d / 2 - 0.5)), bev, { seg: 3, per: 5 });
      slabGeo.set(k, g);
    }
    return g;
  }
  function planarUV(g, sx, sz) { const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) * sx, 0.5 + p.getZ(i) * sz); return g; }
  function domeGeo() {
    const prof = [[0.0001, -0.05], [1, -0.05], [1, 0]];
    for (let i = 23; i >= 0; i--) { const r = i / 24; prof.push([Math.max(0.0001, r * 0.998), Math.pow(Math.max(0, 1 - Math.pow(r, 2.6)), 0.52) + 0.0001]); }
    return planarUV(B.lathe(prof, 56), 0.5, 0.5);
  }

  // ------------------------------------------------------------------------------------------------ textures
  function cookieTex(type, pat, dust) {
    const k = `${type}|${pat}|${dust ? 1 : 0}`;
    let e = texCookie.get(k);
    if (e) return e;
    const S = qs.has('icon') ? 768 : 256, c = cv(S), b = cv(S);
    paint(c, (x) => { x.fillStyle = '#9c8052'; x.fillRect(0, 0, S, S); drawCookie(x, S / 2, S / 2, S * 0.485, { type, pat, b: 0, clarity: 1, dust, unit: true }); });
    const bx = b.getContext('2d');
    bx.fillStyle = '#000'; bx.fillRect(0, 0, S, S);
    const g = bx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.49); g.addColorStop(0, '#b8b8b8'); g.addColorStop(0.8, '#c8c8c8'); g.addColorStop(1, '#707070');
    bx.fillStyle = g; bx.beginPath(); bx.arc(S / 2, S / 2, S * 0.485, 0, TAU); bx.fill();
    const id = (PATTERNS[type][pat] ?? PATTERNS[type][0]).id, lw = Math.max(2, S * 0.026), rr = S * 0.485 * 0.9;
    bx.lineCap = 'round'; bx.lineJoin = 'round';
    bx.strokeStyle = '#000'; bx.lineWidth = lw * 1.5; bx.beginPath(); carve(bx, id, S / 2, S / 2, rr, rr); bx.stroke();
    bx.strokeStyle = '#e8e8e8'; bx.lineWidth = lw * 0.55; bx.beginPath(); carve(bx, id, S / 2 - lw * 0.9, S / 2 - lw * 0.9, rr, rr); bx.stroke();
    e = { map: mkTex(c), bump: mkTex(b, false) };
    texCookie.set(k, e);
    return e;
  }
  function mouldTex(type, pat) {
    const k = `${type}|${pat}`;
    let e = texMould.get(k);
    if (e) return e;
    const S = qs.has('icon') ? 768 : 256, c = cv(S);
    paint(c, (x) => drawMould(x, S / 2, S / 2, (S / 2 / 1.08) * 0.99, type, pat, { handle: false, flat: true }));
    e = { map: mkTex(c), bump: mkTex(c, false) };
    texMould.set(k, e);
    return e;
  }
  function ghostTex(type, glow) {
    const k = `${type}|${glow ? 1 : 0}`;
    let e = texGhost.get(k);
    if (e) return e;
    const S = 160, c = cv(S), r = dims(type, 1);
    paint(c, (x) => drawGhost(x, S / 2, S / 2, (S * 0.5 * 0.9) / Math.max(r.rx, r.ry) / 1.0, type, { glow: glow ? 1 : 0, t: 0 }));
    e = mkTex(c); e.flipY = true;
    texGhost.set(k, e);
    return e;
  }
  function benchTex(w, h) {
    const sc = Math.min(1, 900 / Math.max(w, h)), k = `${Math.round(w / 8)}|${Math.round(h / 8)}`;
    let e = texBench.get(k);
    if (e) return e;
    if (texBench.size > 8) { for (const v of texBench.values()) { v.map.dispose(); v.bump.dispose(); } texBench.clear(); }
    const c = cv(Math.max(8, Math.round(w * sc)), Math.max(8, Math.round(h * sc)));
    paint(c, (x) => { x.scale(sc, sc); drawBench(x, { x: 0, y: 0, w, h }); });
    const bc = cv(c.width, c.height), bx = bc.getContext('2d');
    bx.drawImage(c, 0, 0); bx.fillStyle = 'rgba(128,128,128,0.4)'; bx.fillRect(0, 0, bc.width, bc.height);
    e = { map: mkTex(c), bump: mkTex(bc, false) };
    texBench.set(k, e);
    return e;
  }
  function paintWall(w, h) {
    const k = `${Math.round(w)}x${Math.round(h)}`;
    if (k === wallKey) return;
    wallKey = k;
    const sc = Math.min(1, 1100 / Math.max(w, h)), c = cv(Math.round(w * sc), Math.round(h * sc));
    paint(c, (x) => { x.scale(sc, sc); drawWall(x, 0, 0, w, h, 0); });
    const bc = cv(c.width, c.height), bx = bc.getContext('2d');
    bx.drawImage(c, 0, 0); bx.fillStyle = 'rgba(120,120,120,0.55)'; bx.fillRect(0, 0, bc.width, bc.height);
    if (wallTex) wallTex.dispose();
    if (wallBump) wallBump.dispose();
    wallTex = mkTex(c); wallTex.flipY = true; wallBump = mkTex(bc, false); wallBump.flipY = true;
    wallMesh.material.map = wallTex; wallMesh.material.bumpMap = wallBump; wallMesh.material.needsUpdate = true;
    wallMesh.geometry.dispose(); wallMesh.geometry = new THREE.PlaneGeometry(w, h); wallMesh.geometry.rotateX(-Math.PI / 2);
    wallMesh.position.set(w / 2, -0.2, h / 2);
  }

  // ------------------------------------------------------------------------------------------------ pools + clipping
  function slot(kind, make) {
    const P = pools[kind] ?? (pools[kind] = { used: 0, list: [] });
    let o = P.list[P.used];
    if (!o) {
      o = make();
      o.planes = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
      const seen = new Set();
      o.g.traverse((m) => { if (m.material) for (const mm of [].concat(m.material)) if (!seen.has(mm)) { seen.add(mm); mm.clippingPlanes = o.planes; mm.clipShadows = true; } });
      scene.add(o.g); P.list.push(o);
    }
    P.used++; o.g.visible = true;
    return o;
  }
  function setClip(o, c) {
    const P = o.planes;
    if (c) {
      P[0].set(new THREE.Vector3(1, 0, 0), -c.x); P[1].set(new THREE.Vector3(-1, 0, 0), c.x + c.w);
      P[2].set(new THREE.Vector3(0, 0, 1), -c.y); P[3].set(new THREE.Vector3(0, 0, -1), c.y + c.h);
    } else {
      P[0].set(new THREE.Vector3(1, 0, 0), 1e5); P[1].set(new THREE.Vector3(-1, 0, 0), 1e5);
      P[2].set(new THREE.Vector3(0, 0, 1), 1e5); P[3].set(new THREE.Vector3(0, 0, -1), 1e5);
    }
  }
  const groundAt = (x, z, layer) => {
    let g = layer * 220;
    for (let i = 0; i < surf.length; i++) { const s = surf[i]; if (s.layer === layer && x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.top > g) g = s.top; }
    return g;
  };
  const addSurf = (x, z, w, h, top, layer) => surf.push({ x0: x, x1: x + w, z0: z, z1: z + h, top, layer });

  // ------------------------------------------------------------------------------------------------ plaques and buttons
  const PLAQUE = {
    panel: { body: '#175458', rim: '#2e8f8a' }, gold: { body: '#6b4c1c', rim: '#e0b04a' }, dark: { body: '#05191c', rim: '#1d6467' }, deep: { body: '#0d363a', rim: '#2b8b88' },
    accent: { body: '#f0a41a', rim: '#ffe8a0' }, solid: { body: '#1d6a6e', rim: '#47b3ab' }, ghost: { body: '#124a4e', rim: '#2a7476' }, on: { body: '#2c7d68', rim: '#f2b640' },
    tile: { body: '#1b5f63', rim: '#3da29c' }, off: { body: '#123a3d', rim: '#1f5557' },
  };
  function makePlaque() {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#2e8f8a', metalness: 0.7, roughness: 0.34, envMapIntensity: 0.9 }));
    const body = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial({ color: '#1d6a6e', roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.22, envMapIntensity: 0.55 }));
    rim.castShadow = body.castShadow = true; rim.receiveShadow = body.receiveShadow = true;
    g.add(rim, body);
    return { g, rim, body };
  }
  function putPlaque(it, style, { depth = 16, collar = 10, pressed = false, flash = 0, glow = 0, y0 = 0, rad = it.radius } = {}) {
    const o = slot('plaque', makePlaque);
    const r = it.r, x = r.x + it.dx, z = r.y + it.dy, L = it.layer * 220;
    const st = PLAQUE[style] ?? PLAQUE.panel, ins = Math.min(5, r.h * 0.12, r.w * 0.12);
    o.rim.geometry = slabG(r.w, r.h, collar, rad, 3.5);
    o.body.geometry = slabG(r.w - ins * 2, r.h - ins * 2, depth, Math.max(2, rad - ins * 0.9), 5);
    o.body.position.set(0, collar * 0.45 - (pressed ? 5 : 0), 0);
    o.rim.material.color.set(st.rim); o.body.material.color.set(st.body);
    const em = o.body.material;
    if (flash > 0 || glow > 0) { em.emissive.set(glow ? '#f2b640' : '#ffffff'); em.emissiveIntensity = glow || flash * 0.6; } else { em.emissive.set('#000000'); em.emissiveIntensity = 0; }
    o.g.position.set(x + r.w / 2, L + y0, z + r.h / 2);
    setClip(o, it.clip);
    addSurf(x, z, r.w, r.h, L + y0 + collar * 0.45 + depth, it.layer);
  }
  const hit = (it) => { const p = v3.pressed; if (!p) return false; const r = it.r; return p.x >= r.x + it.dx && p.x <= r.x + it.dx + r.w && p.y >= r.y + it.dy && p.y <= r.y + it.dy + r.h; };
  const fillStyle = (f) => (typeof f === 'string' && f.includes('242,182,64') ? 'gold' : typeof f === 'string' && f.startsWith('rgba(0,0,0') ? 'dark' : f === '#0f3235' || (typeof f === 'string' && f.startsWith('rgba(8,24,26')) ? 'deep' : 'panel');
  const itemPanel = (it) => putPlaque(it, fillStyle(it.fill), { depth: 8, collar: 8 });
  function itemBtn(it) {
    let style = it.kind === 'accent' ? 'accent' : it.kind === 'ghost' ? 'ghost' : 'solid';
    if (it.on) style = 'on';
    if (it.disabled) style = 'off';
    putPlaque(it, style, { depth: 15, collar: 9, pressed: hit(it) && !it.disabled, flash: it.flash, glow: it.on ? 0.22 : 0, y0: H.panel - 4 });
  }
  function itemSlab(it) {
    let style = it.kind === 'dark' ? 'dark' : it.kind === 'gold' ? 'accent' : 'tile';
    if (it.on) style = 'on';
    if (it.dim && it.kind !== 'dark') style = 'off';
    putPlaque(it, style, { depth: it.kind === 'gold' ? 8 : 12, collar: 8, pressed: hit(it), flash: it.flash, glow: it.on ? 0.2 : 0, y0: it.kind === 'gold' ? H.tile + 6 : H.panel - 4 });
  }

  // ------------------------------------------------------------------------------------------------ cookies
  function makeCookie() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, metalness: 0, bumpScale: 3 });
    const m = new THREE.Mesh(G.dome, mat); m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return { g, m, mat };
  }
  function setCookie(o, { type, pat, b, clarity = 1, dust = false, x, y, z, r, lift = 0, alpha = 1, pop = 1, hs = 1 }) {
    const { rx, ry } = dims(type, r), t = cookieTex(type, pat, dust);
    o.mat.map = t.map; o.mat.bumpMap = t.bump; o.mat.bumpScale = 1 + 3.5 * clarity;
    tint.set(bakeColor(b)); tint.r /= BASE0.r; tint.g /= BASE0.g; tint.b /= BASE0.b;
    o.mat.color.copy(tint);
    o.mat.roughness = b > 1.15 ? 0.92 : 0.72;
    const tr = alpha < 1; if (o.mat.transparent !== tr) { o.mat.transparent = tr; o.mat.needsUpdate = true; }
    o.mat.opacity = alpha;
    o.m.scale.set(rx * pop, Math.min(rx, ry) * (type === 'date' ? 0.62 : 0.5) * pop * hs, ry * pop);
    o.g.position.set(x, y + lift, z);
  }
  function itemCookie(it) {
    const q = it.o, r = it.r, o = slot('cookie', makeCookie);
    const x = it.cx + it.dx, z = it.cy + it.dy, y = groundAt(x, z, it.layer);
    const bob = v3.scene === 'title' ? (0.5 + 0.5 * Math.sin(clock * 1.5 + pools.cookie.used * 1.7)) * 7 : 0;
    setCookie(o, { type: q.type ?? 'date', pat: q.pat ?? 0, b: q.b ?? 0.4, clarity: q.clarity ?? 1, dust: !!q.dust, x, y, z, r: r * (q.scale ?? 1), lift: (q.lift ?? 0) * r * 0.2 + bob, alpha: (q.alpha ?? 1) * it.alpha, hs: q.hs ?? 1 });
    setClip(o, it.clip);
  }

  // ------------------------------------------------------------------------------------------------ moulds, dough, peel, bench
  function makeMould() {
    const g = new THREE.Group();
    const top = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, bumpScale: 5 });
    const disc = new THREE.Mesh(G.mould, top); disc.castShadow = disc.receiveShadow = true;
    const handle = new THREE.Mesh(G.handle, M.wood); handle.castShadow = handle.receiveShadow = true;
    g.add(disc, handle);
    return { g, disc, top, handle };
  }
  function itemMould(it) {
    const o = slot('mould', makeMould), r = it.r, q = it.o ?? {}, th = Math.max(r * 0.34, 9);
    const x = it.cx + it.dx + (q.shake ?? 0), z = it.cy + it.dy, gy = groundAt(it.cx + it.dx, z, it.layer);
    const t = mouldTex(it.type, it.pat);
    o.top.map = t.map; o.top.bumpMap = t.bump;
    const tr = it.alpha < 1 || !!q.dim; if (o.top.transparent !== tr) { o.top.transparent = tr; o.top.needsUpdate = true; }
    o.top.opacity = (q.dim ? 0.55 : 1) * it.alpha;
    o.disc.scale.set(r * 1.08, th, r * 1.08);
    o.handle.visible = q.handle !== false;
    o.handle.scale.set(r * 0.68, th * 0.8, r * 0.95); o.handle.position.set(0, 0, r * 1.07);
    o.g.position.set(x, gy + (q.lift ?? 0) * 1.6, z);
    setClip(o, it.clip);
    addSurf(it.cx + it.dx - r, z - r, r * 2, r * 2, gy + th, it.layer);
  }
  function makeDough() {
    const g = new THREE.Group();
    const c = cv(256), tex = mkTex(c), bump = mkTex(c, false);
    const mat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: bump, bumpScale: 4, roughness: 0.8 });
    const m = new THREE.Mesh(G.dome, mat); m.castShadow = m.receiveShadow = true;
    g.add(m);
    return { g, m, c, tex, bump, mat, h: 0.2 };
  }
  function itemDough(it) {
    const o = slot('dough', makeDough), R = it.R, q = it.o, x = it.cx + it.dx, z = it.cy + it.dy, gy = groundAt(x, z, it.layer), S = 256;
    paint(o.c, (cx) => { cx.fillStyle = '#c9a468'; cx.fillRect(0, 0, S, S); drawDough(cx, S / 2, S / 2, S * 0.46, { ...q, flat: true }); });
    o.tex.needsUpdate = true; o.bump.needsUpdate = true;
    const closed = q.st !== 'fill';
    o.h += ((closed ? 0.62 : 0.26) - o.h) * 0.25;
    const sc = R * 1.065 * (1 + (q.st === 'seal' ? Math.sin(clock * 9) * 0.008 : 0));
    o.m.scale.set(sc, sc * o.h, sc);
    o.g.position.set(x, gy, z);
    o.mat.bumpScale = closed ? 2.2 : 5.5; o.mat.color.set('#e6d9bd');
    setClip(o, it.clip);
    addSurf(x - R, z - R, R * 2, R * 2, gy + R * o.h, it.layer);
  }
  function makePeel() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BufferGeometry(), M.paleWood); m.castShadow = m.receiveShadow = true; g.add(m);
    return { g, m };
  }
  function itemPeel(it) {
    const o = slot('peel', makePeel), r = it.r, x = it.cx + it.dx, z = it.cy + it.dy, gy = groundAt(x, z, it.layer);
    o.m.geometry = slabG(r * 2.6, r * 2.2, 9, r * 0.5, 3);
    o.g.position.set(x, gy, z);
    setClip(o, it.clip);
    addSurf(x - r * 1.3, z - r * 1.1, r * 2.6, r * 2.2, gy + 9, it.layer);
  }
  function makeBench() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.66, bumpScale: 2.4 });
    const m = new THREE.Mesh(new THREE.BufferGeometry(), mat); m.castShadow = m.receiveShadow = true;
    const fr = new THREE.Mesh(new THREE.BufferGeometry(), M.frame); fr.castShadow = fr.receiveShadow = true;
    g.add(fr, m);
    return { g, m, mat, fr };
  }
  function itemBench(it) {
    const o = slot('bench', makeBench), r = it.r, x = r.x + it.dx, z = r.y + it.dy, L = it.layer * 220, t = benchTex(r.w, r.h);
    o.mat.map = t.map; o.mat.bumpMap = t.bump;
    o.m.geometry = slabG(r.w, r.h, H.bench, 26, 7); o.m.position.y = 3;
    o.fr.geometry = slabG(r.w + 14, r.h + 14, 12, 30, 5);
    o.g.position.set(x + r.w / 2, L, z + r.h / 2);
    setClip(o, it.clip);
    addSurf(x, z, r.w, r.h, L + H.bench + 3, it.layer);
  }

  // ------------------------------------------------------------------------------------------------ tray (also reused inside the oven)
  function makeTray() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BufferGeometry(), M.steel), paper = new THREE.Mesh(new THREE.BufferGeometry(), M.paper);
    body.castShadow = body.receiveShadow = true; paper.receiveShadow = true;
    g.add(body, paper);
    const cookies = [], ghosts = [];
    for (let i = 0; i < 20; i++) {
      const c = makeCookie(); c.g.visible = false; g.add(c.g); cookies.push(c);
      const gm = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.95 }));
      gm.visible = false; g.add(gm); ghosts.push(gm);
    }
    return { g, body, paper, cookies, ghosts, born: new WeakMap() };
  }
  function geoOf(rect, cols, rows) {
    const pad = Math.max(12, Math.min(rect.w, rect.h) * 0.06), cw = (rect.w - 2 * pad) / cols, ch = (rect.h - 2 * pad) / rows;
    return { cell: (i) => ({ cx: rect.x + pad + (i % cols + 0.5) * cw, cy: rect.y + pad + (Math.floor(i / cols) + 0.5) * ch, r: Math.min(cw, ch) * 0.42 }) };
  }
  // rect = tray outer rect in screen units. Cookies sit relative to the tray centre. Returns the world y of the tray top.
  function fillTray(o, rect, tray, opt, y0) {
    o.body.geometry = slabG(rect.w, rect.h, 14, 20, 5);
    o.paper.geometry = slabG(rect.w - 20, rect.h - 20, 1.8, 12, 0.6);
    o.paper.position.set(0, 13.6, 0);
    const inner = { x: rect.x + 10, y: rect.y + 10, w: rect.w - 20, h: rect.h - 20 };
    const geo = geoOf(inner, tray.cols, tray.rows), n = tray.slots.length;
    const b = opt.b ?? null, glow = opt.glow ?? null, pats = opt.pats ?? {};
    let born = o.born.get(tray); if (!born) { born = new Array(n).fill(-1); o.born.set(tray, born); }
    for (let i = 0; i < 20; i++) {
      const c = o.cookies[i], gh = o.ghosts[i];
      if (i >= n) { c.g.visible = gh.visible = false; continue; }
      const s = tray.slots[i], cell = geo.cell(i), lx = cell.cx - (rect.x + rect.w / 2), lz = cell.cy - (rect.y + rect.h / 2);
      if (s.st === 'empty') {
        born[i] = -1; c.g.visible = false;
        const { rx, ry } = dims(s.type, cell.r), want = !!(glow && glow.has(i));
        gh.visible = true; gh.material.map = ghostTex(s.type, want); gh.material.needsUpdate = false;
        gh.scale.set(rx * 2.15, 1, ry * 2.15); gh.position.set(lx, 15.6, lz);
        gh.material.opacity = want ? 0.78 + 0.22 * Math.sin(clock * 8) : 0.95;
      } else {
        gh.visible = false;
        if (born[i] < 0) born[i] = clock;
        const age = clock - born[i], pop = age < 0.35 ? 1 + 0.12 * Math.sin((age / 0.35) * Math.PI) : 1, drop = age < 0.18 ? (1 - age / 0.18) * 14 : 0;
        c.g.visible = true;
        setCookie(c, { type: s.type, pat: pats[s.type] | 0, b: b === null ? 0.12 : b, clarity: 0.35 + 0.65 * s.q, dust: !!(opt.dust && b !== null && b > 0.7 && b < 1.15), x: lx, y: 15.2, z: lz, r: cell.r, lift: drop, pop });
      }
    }
    return y0 + H.tray;
  }
  function itemTray(it) {
    const o = slot('tray', makeTray), r = { x: it.rect.x + it.dx, y: it.rect.y + it.dy, w: it.rect.w, h: it.rect.h };
    const y0 = groundAt(r.x + r.w / 2, r.y + r.h / 2, it.layer);
    const top = fillTray(o, r, it.tray, it.o, y0);
    o.g.position.set(r.x + r.w / 2, y0, r.y + r.h / 2);
    setClip(o, it.clip);
    addSurf(r.x, r.y, r.w, r.h, top, it.layer);
  }

  // ------------------------------------------------------------------------------------------------ oven + gauge
  function makeOven() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BufferGeometry(), M.terracotta), frameM = new THREE.Mesh(new THREE.BufferGeometry(), M.brick), glow = new THREE.Mesh(new THREE.BufferGeometry(), M.glow);
    body.castShadow = body.receiveShadow = true; frameM.castShadow = frameM.receiveShadow = true; glow.receiveShadow = true;
    g.add(body, frameM, glow);
    const tray = makeTray(); g.add(tray.g);
    return { g, body, frame: frameM, glow, tray };
  }
  function itemOven(it) {
    const o = slot('oven', makeOven), r = it.r, x = r.x + it.dx, z = r.y + it.dy, L = it.layer * 220;
    const m = { x: r.w * 0.07, y: r.h * 0.14, w: r.w * 0.86, h: r.h * 0.72 };
    o.body.geometry = slabG(r.w, r.h, H.oven, 22, 6);
    o.frame.geometry = slabG(m.w + 14, m.h + 14, H.oven + 5, m.h * 0.45 + 7, 4);
    o.glow.geometry = slabG(m.w, m.h, H.oven + 6, m.h * 0.45, 2);
    const cy = m.y + m.h / 2 - r.h / 2;
    o.frame.position.set(0, 0, cy); o.glow.position.set(0, 0, cy);
    o.g.position.set(x + r.w / 2, L, z + r.h / 2);
    const fl = 0.85 + 0.15 * Math.sin(clock * 11) + 0.08 * Math.sin(clock * 23.7 + 1.3);
    o.glow.material = it.tray ? M.glowHot : M.glow;
    M.glowHot.emissiveIntensity = (0.8 + 0.5 * fl) * (it.o.hot ? 1.3 : 1);
    M.glow.emissiveIntensity = 0.35 + 0.1 * Math.sin(clock * 3);
    if (it.tray) {
      const tw = m.w * 0.84, th = Math.min(m.h * 0.8, tw / (it.tray.cols / it.tray.rows));
      const rect = { x: (m.x + (m.w - tw) / 2) + r.x + it.dx, y: (m.y + (m.h - th) / 2) + r.y + it.dy, w: tw, h: th };
      o.tray.g.visible = true;
      fillTray(o.tray, rect, it.tray, { b: it.b, pats: it.o.pats, t: it.t }, 0);
      o.tray.g.position.set(rect.x + rect.w / 2 - (x + r.w / 2), H.oven + 6, rect.y + rect.h / 2 - (z + r.h / 2));
    } else o.tray.g.visible = false;
    ovenAt = { x: x + r.w / 2, z: z + r.h / 2 + cy };
    setClip(o, it.clip);
    addSurf(x, z, r.w, r.h, L + H.oven, it.layer);
  }
  function makeGauge() {
    const g = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.BufferGeometry(), M.brass), bed = new THREE.Mesh(new THREE.BufferGeometry(), M.gauge), glass = new THREE.Mesh(new THREE.BufferGeometry(), M.glass);
    const needle = new THREE.Mesh(G.needle, M.needle);
    rim.castShadow = bed.castShadow = needle.castShadow = true; rim.receiveShadow = bed.receiveShadow = true;
    g.add(rim, bed, glass, needle);
    return { g, rim, bed, glass, needle };
  }
  function itemGauge(it) {
    const o = slot('gauge', makeGauge), r = it.r, x = r.x + it.dx, z = r.y + it.dy, L = it.layer * 220, span = K.B_AUTO;
    o.rim.geometry = slabG(r.w + 6, r.h + 6, 9, r.h / 2 + 3, 3); o.rim.position.set(0, 0, 0);
    o.bed.geometry = slabG(r.w, r.h, 11, r.h / 2, 3); o.bed.position.y = 1.5;
    o.glass.geometry = slabG(r.w - 2, r.h - 2, 13, r.h / 2 - 1, 3); o.glass.position.y = 1.5;
    o.bed.material = it.o.active === false ? M.gaugeOff : M.gauge;
    o.g.position.set(x + r.w / 2, L + H.panel, z + r.h / 2);
    o.needle.visible = it.o.active !== false;
    o.needle.position.set(x + clamp(it.b / span, 0, 1) * r.w - (x + r.w / 2), 13, 0);
    o.needle.scale.set(Math.max(5, r.h * 0.22), 1, r.h * 1.5);
    setClip(o, it.clip);
  }

  // ------------------------------------------------------------------------------------------------ effects (flour puffs, steam)
  function makeFx() {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.puffTex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff }));
    s.visible = false; s.renderOrder = 5; scene.add(s);
    return { s, t: 0, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r0: 0, r1: 0, a: 0, on: false };
  }
  function puff(x, z, { n = 8, y = 30, color = 0xffffff, size = 40, grow = 2.4, rise = 90, spread = 70, life = 0.8, a = 0.55 } = {}) {
    for (let i = 0; i < n; i++) {
      const f = fxPool.find((e) => !e.on);
      if (!f) break;
      const ang = Math.random() * TAU, sp = spread * (0.35 + Math.random() * 0.65);
      Object.assign(f, { on: true, t: 0, life: life * (0.7 + Math.random() * 0.6), x, y, z, vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp, vy: rise * (0.5 + Math.random()), r0: size * (0.6 + Math.random() * 0.5), r1: size * grow, a });
      f.s.material.color.set(color); f.s.visible = true;
    }
  }
  function consumeEvents() {
    for (const e of v3.ev) {
      if (e.type === 'knock') puff(e.x, e.y, { n: 9, y: 46, size: 18, grow: 3, rise: 60, spread: 160, life: 0.7, a: 0.7 });
      else if (e.type === 'fill') puff(e.x, e.y, { n: 4, y: 50, color: 0xffe3a0, size: 14, grow: 2, rise: 70, spread: 90, life: 0.5, a: 0.6 });
      else if (e.type === 'seal') puff(e.x, e.y, { n: 3, y: 50, size: 12, grow: 2.4, rise: 50, spread: 70, life: 0.5, a: 0.5 });
      else if (e.type === 'place') puff(e.x, e.y, { n: 5, y: 34, size: 10, grow: 2.6, rise: 40, spread: 90, life: 0.55, a: 0.55 });
      else if (e.type === 'pull') { puff(e.x, e.y, { n: 12, y: 80, color: 0xf2efe6, size: 34, grow: 3.2, rise: 140, spread: 70, life: 1.3, a: 0.5 }); pulse = 1; }
      else if (e.type === 'load') { puff(e.x, e.y, { n: 6, y: 80, color: 0xffd9a0, size: 26, grow: 2.4, rise: 90, spread: 50, life: 0.9, a: 0.4 }); pulse = 0.6; }
      else if (e.type === 'released') puff(e.x, e.y, { n: 6, y: 56, size: 16, grow: 2.8, rise: 70, spread: 120, life: 0.7, a: 0.6 });
    }
    v3.ev.length = 0;
  }
  function stepFx(dt) {
    for (const f of fxPool) {
      if (!f.on) continue;
      f.t += dt;
      const u = f.t / f.life;
      if (u >= 1) { f.on = false; f.s.visible = false; continue; }
      f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; f.vx *= 0.96; f.vz *= 0.96; f.vy *= 0.97;
      const r = f.r0 + (f.r1 - f.r0) * Math.sqrt(u);
      f.s.position.set(f.x, f.y, f.z); f.s.scale.set(r, r, 1);
      f.s.material.opacity = f.a * (1 - u) * Math.min(1, u * 8);
    }
  }

  // ------------------------------------------------------------------------------------------------ materials, geometry, scene
  function buildMaterials() {
    M.steel = new THREE.MeshStandardMaterial({ color: '#aab2b6', metalness: 0.85, roughness: 0.38, envMapIntensity: 1.0 });
    M.paper = new THREE.MeshStandardMaterial({ color: '#cfc4a6', roughness: 0.96 });
    M.wood = B.material('wood', { color: '#8a5a2e', color2: '#b98550', repeat: [1, 2], seed: 12, size: 256 });
    M.paleWood = B.material('wood', { color: '#c9a06a', color2: '#e3c493', repeat: [2, 1], seed: 5, size: 256 });
    M.terracotta = new THREE.MeshStandardMaterial({ color: '#8a4326', roughness: 0.78, metalness: 0.02 });
    M.brick = new THREE.MeshStandardMaterial({ color: '#6e3a22', roughness: 0.85 });
    M.frame = new THREE.MeshStandardMaterial({ color: '#3c2312', roughness: 0.55, metalness: 0.1, envMapIntensity: 0.6 });
    M.glow = new THREE.MeshStandardMaterial({ color: '#2a0f06', emissive: '#ff8a2a', emissiveIntensity: 0.4, roughness: 0.9 });
    M.glowHot = new THREE.MeshStandardMaterial({ color: '#4a1a08', emissive: '#ffa23a', emissiveIntensity: 1, roughness: 0.9 });
    M.brass = new THREE.MeshStandardMaterial({ color: '#d4a64a', metalness: 0.85, roughness: 0.3, envMapIntensity: 1.4 });
    const gc = cv(640, 48), gx = gc.getContext('2d'), span = K.B_AUTO;
    for (const [a, c, col] of GAUGE_STOPS) { gx.fillStyle = col; gx.fillRect((a / span) * 640, 0, ((c - a) / span) * 640 + 1, 48); }
    const gt = mkTex(gc);
    M.gauge = new THREE.MeshStandardMaterial({ map: gt, roughness: 0.5, emissiveMap: gt, emissive: '#ffffff', emissiveIntensity: 0.25 });
    M.gaugeOff = new THREE.MeshStandardMaterial({ map: gt, roughness: 0.6, color: '#667788' });
    M.glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.05, clearcoat: 1, depthWrite: false });
    M.needle = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.3 });
    const pc = cv(64), px = pc.getContext('2d'), pg = px.createRadialGradient(32, 32, 0, 32, 32, 32);
    pg.addColorStop(0, 'rgba(255,255,255,1)'); pg.addColorStop(0.5, 'rgba(255,255,255,0.45)'); pg.addColorStop(1, 'rgba(255,255,255,0)');
    px.fillStyle = pg; px.fillRect(0, 0, 64, 64);
    M.puffTex = mkTex(pc);
  }
  function buildGeometry() {
    G.dome = domeGeo();
    G.mould = planarUV(B.slab(2, 2, 1, 1, 0.1, { seg: 3, per: 24 }), 0.5, 0.5);
    G.handle = B.slab(1, 1, 1, 0.35, 0.12, { seg: 2, per: 4 });
    G.plane = new THREE.PlaneGeometry(1, 1); G.plane.rotateX(-Math.PI / 2);
    G.needle = B.slab(1, 1, 3, 0.4, 0.8, { seg: 1, per: 3 });
  }
  function buildScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(24, 1, 100, 20000);
    scene.background = new THREE.Color('#071f22');
    hemi = new THREE.HemisphereLight('#ffe9c8', '#14464a', 0.42); scene.add(hemi);
    key = new THREE.DirectionalLight('#ffe2b4', 3.1); scene.add(key, key.target);
    rim = new THREE.DirectionalLight('#9fd8d0', 0.45); rim.position.set(600, 800, -600); scene.add(rim);
    lamp = new THREE.PointLight('#ffd9a0', 380, 0, 1); lamp.position.set(360, 520, 640); scene.add(lamp);
    ovenLight = new THREE.PointLight('#ff8a2a', 0, 900, 1); ovenLight.position.set(0, 140, 0); scene.add(ovenLight);
    wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, bumpScale: 1.1 }));
    wallMesh.geometry.rotateX(-Math.PI / 2); wallMesh.receiveShadow = true; scene.add(wallMesh);
    const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
    M.scrim = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x04100f, transparent: true, opacity: 0, depthWrite: false }));
    M.scrim.visible = false; M.scrim.renderOrder = 4; scene.add(M.scrim);
    const n = 46, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = hashf(i) * 900; pos[i * 3 + 1] = 60 + hashf(i + 50) * 260; pos[i * 3 + 2] = hashf(i + 99) * 1700; }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: M.puffTex, size: 11, transparent: true, opacity: 0.4, depthWrite: false, color: 0xfff1d0, sizeAttenuation: true }));
    motes.frustumCulled = false; scene.add(motes);
    const vc = cv(256), vx = vc.getContext('2d'), vg = vx.createRadialGradient(128, 128, 70, 128, 128, 182);
    vg.addColorStop(0, 'rgba(2,10,10,0)'); vg.addColorStop(1, 'rgba(2,10,10,0.55)'); vx.fillStyle = vg; vx.fillRect(0, 0, 256, 256);
    const vgG = new THREE.PlaneGeometry(1, 1); vgG.rotateX(-Math.PI / 2);
    vig = new THREE.Mesh(vgG, new THREE.MeshBasicMaterial({ map: mkTex(vc), transparent: true, depthWrite: false, depthTest: false }));
    vig.renderOrder = 20; vig.frustumCulled = false; scene.add(vig);
    BASE0.set(bakeColor(0));
  }

  // ------------------------------------------------------------------------------------------------ per frame
  function resize(view) {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== Wpx || h !== Hpx || dpr !== dprNow) { Wpx = w; Hpx = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
    const vw = view.width, vh = view.height;
    camera.aspect = vw / vh;
    const d = (vh / 2) / Math.tan((camera.fov * Math.PI) / 360);
    camera.near = d * 0.3; camera.far = d * 2.2;
    camera.position.set(vw / 2, d, vh / 2); camera.up.set(0, 0, -1); camera.lookAt(vw / 2, 0, vh / 2); camera.updateProjectionMatrix();
    paintWall(vw, vh);
    const sh = TIERS[tier].shadow;
    key.castShadow = sh > 0; renderer.shadowMap.enabled = sh > 0;
    const ext = Math.max(vw, vh) * 0.62;
    Object.assign(key.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 100, far: 4000 });
    key.shadow.camera.updateProjectionMatrix();
    if (sh && key.shadow.mapSize.x !== sh) { key.shadow.mapSize.set(sh, sh); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    key.shadow.bias = -0.0006; key.shadow.normalBias = 1.2; key.shadow.radius = 4;
    return { vw, vh };
  }
  function present(view, dt) {
    const { vw, vh } = resize(view);
    for (const k of Object.keys(pools)) pools[k].used = 0;
    surf.length = 0; ovenAt = null;
    const sway = Math.sin(clock * 0.25) * (v3.scene === 'title' ? 420 : 90);
    lamp.position.set(vw * 0.5, 520, vh * 0.42); vig.scale.set(vw * 1.45, 1, vh * 1.45); vig.position.set(vw / 2, 400, vh / 2);
    key.position.set(vw * 0.5 - 1250 + sway, 1250, vh * 0.5 - 950); key.target.position.set(vw / 2, 0, vh / 2);
    for (const it of v3.items) {
      switch (it.k) {
        case 'bench': itemBench(it); break;
        case 'panel': itemPanel(it); break;
        case 'btn': itemBtn(it); break;
        case 'slab': itemSlab(it); break;
        case 'tray': itemTray(it); break;
        case 'oven': itemOven(it); break;
        case 'gauge': itemGauge(it); break;
        case 'cookie': itemCookie(it); break;
        case 'mould': itemMould(it); break;
        case 'dough': itemDough(it); break;
        case 'peel': itemPeel(it); break;
        default: break;
      }
    }
    for (const k of Object.keys(pools)) { const P = pools[k]; for (let i = P.used; i < P.list.length; i++) P.list[i].g.visible = false; }
    pulse = Math.max(0, pulse - dt * 1.4);
    if (ovenAt) {
      const fl = 0.85 + 0.15 * Math.sin(clock * 11) + 0.08 * Math.sin(clock * 23.7 + 1.3);
      ovenLight.position.set(ovenAt.x, 150, ovenAt.z);
      ovenLight.intensity = (v3.heat ? 520 : 150) * fl * (1 + pulse * 0.6);
      if (v3.heat) { steamT += dt; if (steamT > 0.55) { steamT = 0; puff(ovenAt.x + (Math.random() - 0.5) * 50, ovenAt.z - 10, { n: 1, y: 70, color: 0xe8e4da, size: 18, grow: 3, rise: 55, spread: 14, life: 1.5, a: 0.2 }); } }
    } else ovenLight.intensity = 0;
    consumeEvents(); stepFx(dt);
    { const p = motes.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * (6 + (i % 5) * 2); if (y > 340) y = 40; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(clock * 0.4 + i) * dt * 6); } p.needsUpdate = true; motes.visible = v3.scene === 'title' || v3.scene === 'play'; }
    M.scrim.visible = v3.scrim > 0;
    if (v3.scrim > 0) { M.scrim.material.opacity = v3.scrim; M.scrim.scale.set(vw * 1.5, 1, vh * 1.5); M.scrim.position.set(vw / 2, 190, vh / 2); }
    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------------------------------------------ boot slices
  async function build() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    } catch (e) { console.warn('WebGL unavailable; flat 2D art stays', e); failed = true; return; }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
    renderer.localClippingEnabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    await frame();
    buildMaterials(); await frame();
    buildGeometry(); buildScene(); await frame();
    try { envHandle = B.createEnvironment(renderer, scene, { intensity: 0.5 }); } catch (e) { /* no reflections, still fine */ }
    scene.environmentIntensity = 0.28;
    await frame();
    for (const t of ['date', 'walnut', 'pistachio']) { cookieTex(t, 0, true); mouldTex(t, 0); await frame(); }
    for (const t of ['date', 'walnut', 'pistachio']) { ghostTex(t, false); ghostTex(t, true); }
    for (let i = 0; i < 90; i++) fxPool.push(makeFx());
    resize({ width: 720, height: 1560 });
    try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (e) { /* compiled on first use */ }
    renderer.render(scene, camera);
    await frame();
    ready = true; pendingOn = true;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; canvas.style.opacity = '0'; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { if (envHandle) envHandle.rebuild(); scene.environmentIntensity = 0.28; } catch (err) { /* keep going without reflections */ }
    wallKey = ''; Wpx = 0;
    canvas.style.opacity = '1'; v3.on = true;
  });

  const start = () => { build().catch((e) => { console.warn('3D init failed; flat 2D art stays', e); failed = true; v3.on = false; canvas.remove(); }); };
  if (document.readyState === 'complete') setTimeout(start, 30); else window.addEventListener('load', () => setTimeout(start, 30), { once: true });

  // Icon render (?icon=1 at 1024x1024): one clear subject, built from the same scene objects the game uses.
  const iconItems = (w, h) => {
    const base = { dx: 0, dy: 0, layer: 0, clip: null, alpha: 1 };
    const s = w / 720;
    return [
      { ...base, k: 'bench', r: { x: -60 * s, y: 300 * s, w: w + 120 * s, h: h - 200 * s } },
      { ...base, k: 'mould', cx: 175 * s, cy: 250 * s, r: 112 * s, type: 'walnut', pat: 1, o: { handle: false } },
      { ...base, k: 'cookie', cx: 120 * s, cy: 600 * s, r: 92 * s, o: { type: 'date', pat: 1, b: 0.82, dust: true, hs: 1.15 } },
      { ...base, k: 'cookie', cx: 400 * s, cy: 420 * s, r: 205 * s, o: { type: 'walnut', pat: 0, b: 0.93, dust: true, hs: 1.5 } },
    ];
  };
  out.wrap = (game) => Object.assign({}, game, {
    update(dt, input) {
      const p = input && input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
      return game.update(dt, input);
    },
    render(ctx, view) {
      if (pendingOn && !failed) { pendingOn = false; v3.on = true; out.ok = true; requestAnimationFrame(() => { canvas.style.opacity = '1'; }); }
      const st = game.getState();
      v3.scene = st.scene;
      game.render(ctx, view);
      if (v3.on && qs.has('icon')) { ctx.clearRect(0, 0, view.width, view.height); v3.items = iconItems(view.width, view.height); v3.scrim = 0; }
      if (!v3.on) return;
      try {
        const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
        if (!st.paused) clock += dt;
        ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
        if (frames > 120 && ema > 28 && tier < TIERS.length - 1) { tier++; out.tier = tier; frames = 0; ema = 16; wallKey = ''; }
        present(view ?? { width: 720, height: 1560 }, dt);
      } catch (e) { console.warn('3D present failed; flat 2D art', e); v3.on = false; }
    },
  });
  out.probe = () => ({ ready, on: v3.on, tier, items: v3.items.length, pools: Object.fromEntries(Object.entries(pools).map(([k, p]) => [k, p.used])) });
  return out;
}
