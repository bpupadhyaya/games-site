// Secret Puzzle Box 3D models: the yosegi marquetry box face (frame, plate with real cut grooves, sliding panels with brass pulls,
// brass marks), the open box with its drawer and keepsakes, and the craftsman's desk. Everything is procedural (canvas textures and
// analytic geometry); the world unit is one cell of the 2D layout, so the layout rects map straight onto the scene.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { inlay } from '../src/inlay.js';
import { LANE_H, LANE_GAP, FACE_PAD, PANEL_W } from '../src/layout.js';

const TAU = Math.PI * 2;
export const TOP_Y = 0;            // plate surface
export const PANEL_TOP = 0.075;    // panels stand a little proud of the plate
export const FRAME_TOP = 0.11;
export const BODY_BOTTOM = -1.35;
const PANEL_H = 0.36, GROOVE_FLOOR = -0.27;

const hasDom = typeof document !== 'undefined';
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const mixHex = (a, b, t) => { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return `#${c.getHexString()}`; };

// ---------------------------------------------------------------- per look palette
export const ENV = {
  cherry: { desk: '#24120a', deskHi: '#46261a', mat: '#16301f', matHi: '#244d33', stitch: '#d9b56a', lacq: '#2a1410', paper: '#f2e6c8', bg: 0x120807, lamp: 0xffcf8f },
  maple: { desk: '#8a6a43', deskHi: '#b99567', mat: '#d6dcb8', matHi: '#eef0d6', stitch: '#8a6a43', lacq: '#c9ac7a', paper: '#fff8e6', bg: 0xd8c8a2, lamp: 0xfff0d0 },
  ebony: { desk: '#10161d', deskHi: '#27323f', mat: '#1b2a3c', matHi: '#2b4560', stitch: '#aeb8c4', lacq: '#161c24', paper: '#e9edf2', bg: 0x0a0d12, lamp: 0xcfe0ff },
};

// ---------------------------------------------------------------- textures
const texCache = new Map();
function canvasTex(c, { repeat, flipY = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.flipY = flipY;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function grainLines(x, w, h, seed, n, vertical, light = 0.1, dark = 0.16) {
  const r = rnd(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * (vertical ? w : h), len = (vertical ? h : w), wob = 1 + r() * 3, ph = r() * TAU, fr = 0.01 + r() * 0.02, lw = 0.5 + r() * 1.4;
    x.strokeStyle = r() < 0.6 ? `rgba(40,18,4,${dark * r()})` : `rgba(255,244,214,${light * r()})`; x.lineWidth = lw; x.beginPath();
    for (let s = 0; s <= len; s += 6) { const o = a + Math.sin(s * fr + ph) * wob; if (vertical) { s ? x.lineTo(o, s) : x.moveTo(o, s); } else { s ? x.lineTo(s, o) : x.moveTo(s, o); } }
    x.stroke();
  }
}
// One panel's marquetry top: pattern from the same painter as the 2D art, then wood grain along the strips and a gloss streak.
export function panelTextures(pid, vertical, look, T) {
  const key = `p|${look}|${pid}|${vertical ? 1 : 0}`;
  let e = texCache.get(key);
  if (e) return e;
  const w = vertical ? 240 : 512, h = vertical ? 512 : 240, c = cv(w, h), x = c.getContext('2d');
  inlay(x, { x: 0, y: 0, w, h }, pid % 6, Math.floor(pid / 6) + pid, vertical);
  grainLines(x, w, h, pid * 7 + 3, 70, vertical);
  const bump = cv(w, h), bx = bump.getContext('2d');
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, w, h);
  bx.globalAlpha = 0.55; bx.filter = 'grayscale(1) contrast(1.4)'; bx.drawImage(c, 0, 0); bx.filter = 'none'; bx.globalAlpha = 1;
  grainLines(bx, w, h, pid * 11 + 5, 90, vertical, 0.2, 0.28);
  e = { map: canvasTex(c, { flipY: false }), bump: canvasTex(bump, { flipY: false, srgb: false }) };
  texCache.set(key, e);
  return e;
}
function tileTextures(look, T, pat, pid, size = 256) {
  const key = `t|${look}|${pat}|${pid}`;
  let e = texCache.get(key);
  if (e) return e;
  const c = cv(size), x = c.getContext('2d');
  inlay(x, { x: 0, y: 0, w: size, h: size }, pat, pid, false);
  grainLines(x, size, size, pat * 13 + pid, 40, false, 0.08, 0.12);
  const bump = cv(size), bx = bump.getContext('2d');
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size); bx.globalAlpha = 0.5; bx.filter = 'grayscale(1) contrast(1.3)'; bx.drawImage(c, 0, 0); bx.filter = 'none'; bx.globalAlpha = 1;
  e = { map: canvasTex(c, { repeat: [1, 1] }), bump: canvasTex(bump, { repeat: [1, 1], srgb: false }) };
  texCache.set(key, e);
  return e;
}
export function disposeLookCache() { for (const e of texCache.values()) { e.map.dispose(); e.bump.dispose(); } texCache.clear(); B.disposeMaterialCache(); }

function lacquered(map, bump, o = {}) {
  return new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: o.bump ?? 0.5, roughness: o.rough ?? 0.4, metalness: 0, clearcoat: o.coat ?? 0.8, clearcoatRoughness: o.coatRough ?? 0.1, envMapIntensity: o.env ?? 1, color: o.color ?? 0xffffff });
}
function brassMat(T, emissive = 0) {
  const m = B.material('brass', { color: T.brassLo, color2: T.brassHi, seed: 3 });
  m.envMapIntensity = 3.2; m.roughness = 0.24;
  if (emissive) { m.emissive = new THREE.Color(T.brass); m.emissiveIntensity = emissive; }
  return m;
}

// ---------------------------------------------------------------- shapes
function rrPath(path, x, z, w, d, r) {          // rounded rect on (x, y = -z) shape coordinates
  const y = -z, x0 = x - w / 2, x1 = x + w / 2, y0 = y - d / 2, y1 = y + d / 2;
  r = Math.min(r, w / 2 - 1e-3, d / 2 - 1e-3);
  path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r); path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
  path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r); path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
  return path;
}
function extrudeTop(shape, depth, bevel = 0.04) {   // shape in (x, -z); result spans y -depth..0 with the top at 0
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -depth + bevel, 0);
  g.computeVertexNormals();
  return g;
}
const ringShape = (x, z, w, d, r, t) => { const s = rrPath(new THREE.Shape(), x, z, w, d, r), h = rrPath(new THREE.Path(), x, z, w - 2 * t, d - 2 * t, Math.max(0.02, r - t)); s.holes.push(h); return s; };

// ---------------------------------------------------------------- the box face
export function faceDims(lanes, steps, vertical) {
  const T = steps + PANEL_W, along = T + 2 * FACE_PAD, across = lanes * LANE_H + (lanes - 1) * LANE_GAP + 2 * FACE_PAD;
  return { along, across, cw: vertical ? across : along, ch: vertical ? along : across };
}
/**
 * spec: { lanes, steps (longest groove, in places), laneSteps: [per lane], vertical, ids: [panel id per lane], goals: [per lane] }.
 * Returns { group, update(items, t, fx), dims, dispose() }. Local frame: x right, z toward the viewer, y up; plate top at y 0.
 */
export function buildFace(spec, T, look, { shadows = true } = {}) {
  const { lanes, vertical } = spec, laneSteps = spec.laneSteps, maxSteps = Math.max(...laneSteps);
  const D = faceDims(lanes, maxSteps, vertical), { along, across, cw, ch } = D;
  const group = new THREE.Group();
  const toW = (u, v) => (vertical ? { x: v, z: u } : { x: u, z: v });                 // (along, across) -> world x,z
  const u0 = -along / 2 + FACE_PAD, v0 = -across / 2 + FACE_PAD;
  const laneV = (l) => v0 + l * (LANE_H + LANE_GAP) + LANE_H / 2;
  const geos = [], mats = [];
  const keep = (o) => { if (o.geometry) geos.push(o.geometry); return o; };

  // body block: sides carry a marquetry band
  const bodyTop = -0.37, bodyH = bodyTop - BODY_BOTTOM;
  const sideTex = tileTextures(look, T, 2, 1);
  const sideMap = sideTex.map.clone(); sideMap.needsUpdate = true; sideMap.repeat.set(Math.max(2, Math.round(cw / 1.4)), 1);
  const sideBump = sideTex.bump.clone(); sideBump.needsUpdate = true; sideBump.repeat.copy(sideMap.repeat);
  const sideMat = lacquered(sideMap, sideBump, { coat: 0.5, rough: 0.5, color: 0xd8c0a8 }); mats.push(sideMat);
  const body = new THREE.Mesh(B.roundedBox(cw, bodyH, ch, 0.34, 4), sideMat);
  body.position.y = BODY_BOTTOM + bodyH / 2; body.castShadow = shadows; body.receiveShadow = true; group.add(keep(body));

  // frame ring (marquetry tiles on top)
  const ft = tileTextures(look, T, 1, 2, 256);
  const fm = ft.map.clone(); fm.needsUpdate = true; fm.repeat.set(1 / 1.15, 1 / 1.15); const fb = ft.bump.clone(); fb.needsUpdate = true; fb.repeat.copy(fm.repeat);
  const frameMat = lacquered(fm, fb, { coat: 0.9, coatRough: 0.06, rough: 0.35 }); mats.push(frameMat);
  const band = 0.33, plateW = cw - 2 * band, plateD = ch - 2 * band;
  const frame = new THREE.Mesh(extrudeTop(ringShape(0, 0, cw, ch, 0.42, band), 0.5, 0.035), frameMat);
  frame.position.y = FRAME_TOP; frame.castShadow = shadows; frame.receiveShadow = true; group.add(keep(frame));

  // plate with real cut grooves
  const pm = B.material('wood', { color: mixHex(T.plate0, T.plate1, 0.15), color2: mixHex(T.plate0, T.plate1, 0.7), seed: 11, repeat: [1 / 3.2, 1 / 3.2], physical: true });
  pm.clearcoat = 0.55; pm.clearcoatRoughness = 0.22; pm.envMapIntensity = 0.8; mats.push(pm);
  const plate = rrPath(new THREE.Shape(), 0, 0, plateW, plateD, 0.3);
  const holes = [];
  for (let l = 0; l < lanes; l++) {
    const len = laneSteps[l] + PANEL_W, c = toW(u0 + len / 2, laneV(l)), w = vertical ? LANE_H : len, d = vertical ? len : LANE_H;
    plate.holes.push(rrPath(new THREE.Path(), c.x, c.z, w, d, 0.2));
    holes.push({ c, w, d, l });
  }
  const plateMesh = new THREE.Mesh(extrudeTop(plate, 0.34, 0.03), pm);
  plateMesh.castShadow = false; plateMesh.receiveShadow = true; group.add(keep(plateMesh));

  // groove floor + brass marks + place dots
  const floorMat = new THREE.MeshStandardMaterial({ color: T.groove, roughness: 1 }); mats.push(floorMat);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(plateW, plateD), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = GROOVE_FLOOR; floor.receiveShadow = true; group.add(keep(floor));
  const marks = [], markMat = new THREE.MeshStandardMaterial({ color: T.brassHi, roughness: 0.4, metalness: 0.3, emissive: T.brass, emissiveIntensity: 0.55 }); mats.push(markMat);
  for (let l = 0; l < lanes; l++) {
    const gp = spec.goals[l], c = toW(u0 + gp + PANEL_W / 2, laneV(l)), w = vertical ? LANE_H - 0.1 : PANEL_W - 0.02, d = vertical ? PANEL_W - 0.02 : LANE_H - 0.1;
    const m = new THREE.Mesh(new THREE.ShapeGeometry(ringShape(c.x, c.z, w, d, 0.16, 0.055), 6), markMat.clone());
    m.rotation.x = -Math.PI / 2; m.position.y = GROOVE_FLOOR + 0.004; m.userData.lane = l; marks.push(keep(m)); group.add(m);
    const dotG = new THREE.CircleGeometry(0.05, 10); geos.push(dotG);
    for (let k = 0; k <= laneSteps[l]; k++) {
      const dc = toW(u0 + k + PANEL_W / 2, laneV(l)), dm = new THREE.Mesh(dotG, new THREE.MeshBasicMaterial({ color: T.brassLo }));
      dm.rotation.x = -Math.PI / 2; dm.position.set(dc.x, GROOVE_FLOOR + 0.006, dc.z); group.add(dm);
    }
  }

  // panels
  const panels = [], pull = B.lathe([[0, 0], [0.19, 0], [0.2, 0.025], [0.15, 0.045], [0.13, 0.1], [0.07, 0.14], [0, 0.15]], 28); geos.push(pull);
  const pw = vertical ? LANE_H - 0.14 : PANEL_W, pd = vertical ? PANEL_W : LANE_H - 0.14;
  const slabG = B.slab(pw, pd, PANEL_H, 0.17, 0.055, { seg: 3, per: 5 }); geos.push(slabG);
  const glowG = B.slab(pw + 0.34, pd + 0.34, 0.02, 0.26, 0.008, { seg: 1, per: 5 }); geos.push(glowG);
  const brass = brassMat(T, 0.0); mats.push(brass);
  for (let l = 0; l < lanes; l++) {
    const tx = panelTextures(spec.ids[l], vertical, look, T), pmat = lacquered(tx.map, tx.bump, { coat: 0.85, coatRough: 0.07, rough: 0.38 }); mats.push(pmat);
    const g = new THREE.Group(), top = new THREE.Mesh(slabG, pmat); top.castShadow = shadows; top.receiveShadow = true; top.position.y = -PANEL_H;
    const knob = new THREE.Mesh(pull, brass); knob.castShadow = shadows; knob.position.y = 0;
    const glow = new THREE.Mesh(glowG, new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.y = -0.02; glow.renderOrder = 4;
    g.add(top, knob); group.add(g); group.add(glow);
    panels.push({ g, top, knob, glow, l, u: 0, vel: 0 });
  }
  // hint arrow (a cone that bobs beside the panel)
  const coneG = new THREE.CylinderGeometry(0, 0.28, 0.5, 4, 1); geos.push(coneG);
  const arrow = new THREE.Mesh(coneG, new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.95, fog: false })); arrow.visible = false; group.add(arrow);
  // a sweep of light across the face when the box opens
  const sweepC = cv(128, 8), sx = sweepC.getContext('2d'), sg = sx.createLinearGradient(0, 0, 128, 0);
  sg.addColorStop(0, 'rgba(255,240,190,0)'); sg.addColorStop(0.5, 'rgba(255,246,214,1)'); sg.addColorStop(1, 'rgba(255,240,190,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 128, 8);
  const sweepT = canvasTex(sweepC);
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(1.4, vertical ? cw : ch), new THREE.MeshBasicMaterial({ map: sweepT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sweep.rotation.x = -Math.PI / 2; sweep.position.y = FRAME_TOP + 0.02; sweep.renderOrder = 5; group.add(sweep);
  if (!vertical) { /* band is along z already (plane width 1.4 along x) */ }
  const sweepSize = { w: 1.4, along: vertical ? ch : cw };

  const place = (it, p, l) => {
    const c = toW(u0 + p + PANEL_W / 2, laneV(l)), lift = it.lift || 0;
    return { x: c.x, z: c.z, y: PANEL_TOP + lift * 0.14 };
  };
  const api = {
    group, dims: D, panels, spec,
    centre(l, p) { const c = toW(u0 + p + PANEL_W / 2, laneV(l)); return { x: c.x, z: c.z }; },
    // items: [{ lane, vis, lift, shake, hint, holder, focus, arrow, glow }]; t clock; win 0..1
    update(items, t, o = {}) {
      for (const it of items) {
        const P = panels[it.lane]; if (!P) continue;
        const target = it.vis;
        // a tiny damped spring on top of the sim's glide: panels settle with a soft click instead of stopping dead
        const dt = Math.min(0.05, o.dt ?? 0.016), k = 260, c = 24;
        if (P.init !== true) { P.u = target; P.vel = 0; P.init = true; }
        const acc = (target - P.u) * k - P.vel * c; P.vel += acc * dt; P.u += P.vel * dt;
        const over = P.u - target;
        const pos = place(it, P.u, P.l);
        const sh = it.shake ? Math.sin(t * 70) * it.shake * 0.05 : 0;
        P.g.position.set(pos.x + (vertical ? sh : 0), pos.y, pos.z + (vertical ? 0 : sh));
        // lifted by the finger: tilts a touch toward the way it is being pulled; settles with a hair of squash
        const tilt = it.lift ? Math.max(-1, Math.min(1, P.vel * 0.4)) * 0.05 : 0;
        P.g.rotation.set(vertical ? tilt : 0, 0, vertical ? 0 : -tilt);
        P.top.scale.y = 1 - Math.min(0.06, Math.abs(over) * 0.2) * (it.lift ? 0 : 1);
        const hl = it.hint ? 0.5 + 0.5 * Math.sin(t * 7) : 0, hold = it.holder ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
        P.glow.position.set(pos.x, PANEL_TOP - 0.03, pos.z); P.glow.visible = !!(it.hint || it.holder || it.focus);
        if (P.glow.visible) {
          P.glow.material.color.set(it.focus && !it.hint && !it.holder ? 0xffffff : it.holder ? 0xff8a4a : 0xffd25a);
          P.glow.material.opacity = it.focus && !it.hint && !it.holder ? 0.35 : 0.18 + 0.3 * (it.holder ? hold : hl);
        }
        const mk = marks[P.l]; if (mk) { const on = Math.abs(it.vis - spec.goals[P.l]) < 0.02; mk.material.emissiveIntensity = on ? 1.6 : 0.55; }
        if (it.arrow) {
          const bob = Math.sin(t * 6) * 0.1, d = it.arrow, off = PANEL_W / 2 + 0.55 + bob;
          arrow.visible = true; arrow.position.set(pos.x + (vertical ? 0 : d * off), PANEL_TOP + 0.35, pos.z + (vertical ? d * off : 0));
          arrow.rotation.set(vertical ? d * Math.PI / 2 : 0, 0, vertical ? 0 : -d * Math.PI / 2);   // cone points along the slide
        }
      }
      if (!items.some((i) => i.arrow)) arrow.visible = false;
      const w = o.win || 0;
      sweep.visible = w > 0;
      if (w > 0) {
        const f = ((t * 0.5) % 1.5) - 0.25, a = (f - 0.5) * (sweepSize.along + 2);
        sweep.position.x = vertical ? 0 : a; sweep.position.z = vertical ? a : 0;
        sweep.rotation.z = vertical ? Math.PI / 2 : 0; sweep.material.opacity = 0.55 * w;
      }
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) { m.dispose(); } },
  };
  return api;
}

// ---------------------------------------------------------------- keepsakes (about 1 unit across)
export function buildKeepsake(kind, T) {
  const g = new THREE.Group();
  const brass = brassMat(T, 0.05);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.45, metalness: o.metal ?? 0, flatShading: !!o.flat, side: o.double ? THREE.DoubleSide : THREE.FrontSide, emissive: o.em ?? 0x000000, emissiveIntensity: o.emi ?? 0 });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (kind === 'coin') {
    const s = std('#dfe3ee', { metal: 0.95, rough: 0.22 });
    const c = add(new THREE.CylinderGeometry(0.46, 0.46, 0.07, 40), s); c.rotation.x = Math.PI / 2 - 0.35;
    const r = add(new THREE.TorusGeometry(0.34, 0.025, 8, 40), s); r.rotation.x = -0.35; r.position.z = 0.04;
    const h = add(new THREE.BoxGeometry(0.16, 0.16, 0.06), std('#8c97aa', { metal: 0.9, rough: 0.3 })); h.rotation.x = -0.35; h.position.z = 0.045;
  } else if (kind === 'key') {
    const s = brass;
    add(new THREE.TorusGeometry(0.17, 0.065, 12, 24), s, -0.3, 0, 0);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 10), s, 0.1, 0, 0).rotation.z = Math.PI / 2;
    add(new THREE.BoxGeometry(0.08, 0.2, 0.06), s, 0.34, -0.1, 0); add(new THREE.BoxGeometry(0.08, 0.14, 0.06), s, 0.22, -0.07, 0);
  } else if (kind === 'gem') {
    const prof = [[0, -0.5], [0.22, -0.2], [0.4, 0.05], [0.3, 0.2], [0, 0.2]].map((p) => new THREE.Vector2(p[0], p[1]));
    const m = add(new THREE.LatheGeometry(prof, 8), new THREE.MeshStandardMaterial({ color: '#58d6ff', roughness: 0.08, metalness: 0.25, flatShading: true, emissive: '#0a5a88', emissiveIntensity: 0.7 }));
    const top = add(new THREE.CylinderGeometry(0.22, 0.3, 0.12, 8), new THREE.MeshStandardMaterial({ color: '#b9f0ff', roughness: 0.05, metalness: 0.3, flatShading: true, emissive: '#1d7aa8', emissiveIntensity: 0.6 }), 0, 0.26, 0);
    m.rotation.y = top.rotation.y = 0.2;
  } else if (kind === 'crane') {
    const paper = std('#f6f0e0', { double: true, flat: true, rough: 0.8 }), shade = std('#e1d6bd', { double: true, flat: true, rough: 0.8 }), red = std('#d9423a', { double: true, flat: true, rough: 0.7 });
    const tri = (a, b, c, mat) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3)); geo.computeVertexNormals(); return add(geo, mat); };
    tri([-0.18, 0, 0], [0.18, 0, 0], [0, -0.1, 0.5], paper); tri([-0.18, 0, 0], [0.18, 0, 0], [0, -0.1, -0.5], shade);
    tri([-0.1, 0.0, 0.05], [-0.62, 0.34, 0.12], [-0.12, 0.02, -0.28], paper); tri([0.1, 0.0, 0.05], [0.62, 0.34, 0.12], [0.12, 0.02, -0.28], shade);
    tri([-0.04, 0, 0.45], [0.04, 0, 0.45], [0, 0.55, 0.62], paper); tri([0, 0.55, 0.62], [0.03, 0.62, 0.66], [-0.03, 0.62, 0.66], red);
    tri([-0.05, 0, -0.45], [0.05, 0, -0.45], [0, 0.3, -0.7], shade);
    g.rotation.y = 0.5;
  } else if (kind === 'blossom') {
    const pet = std('#ffc6d8', { rough: 0.7 }), geo = new THREE.SphereGeometry(0.2, 12, 8);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, m = add(geo, pet, Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22); m.scale.set(1, 0.22, 1.3); m.rotation.y = -a; m.rotation.z = 0.12; }
    add(new THREE.SphereGeometry(0.07, 10, 8), std('#e8a53c', { rough: 0.5 }), 0, 0.03, 0);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; add(new THREE.SphereGeometry(0.018, 6, 5), std('#c8782a'), Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12); }
    g.rotation.x = -0.6;
  } else if (kind === 'fan') {
    const cols = ['#f2d6a0', '#c9573d'];
    for (let i = 0; i < 8; i++) {
      const sh = new THREE.Shape(); const a0 = -0.9 + i * 0.225, a1 = a0 + 0.225;
      sh.moveTo(0, 0); sh.lineTo(Math.sin(a0) * 0.8, Math.cos(a0) * 0.8); sh.lineTo(Math.sin(a1) * 0.8, Math.cos(a1) * 0.8); sh.closePath();
      const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: false }); gg.rotateX(-Math.PI / 2);
      const m = add(gg, std(cols[i % 2], { rough: 0.75 }), 0, 0.01 * i, -0.3); m.rotation.x = 0;
    }
    add(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), brass, 0, 0.04, -0.3);
    g.rotation.x = -0.5;
  } else if (kind === 'bell') {
    const prof = [[0.02, 0.38], [0.14, 0.36], [0.26, 0.24], [0.34, 0], [0.4, -0.2], [0.42, -0.26], [0.32, -0.26], [0.3, -0.2], [0.02, -0.2]].map((p) => new THREE.Vector2(p[0], p[1]));
    add(new THREE.LatheGeometry(prof, 28), brass); add(new THREE.SphereGeometry(0.08, 10, 8), brass, 0, -0.28, 0);
    add(new THREE.TorusGeometry(0.07, 0.025, 8, 14), brass, 0, 0.42, 0);
  } else {
    const sh = new THREE.Shape(), P = [[0, 0.42], [0.1, 0.26], [0.27, 0.32], [0.23, 0.1], [0.4, 0.02], [0.21, -0.07], [0.26, -0.26], [0.05, -0.17], [0, -0.32], [-0.05, -0.17], [-0.26, -0.26], [-0.21, -0.07], [-0.4, 0.02], [-0.23, 0.1], [-0.27, 0.32], [-0.1, 0.26]];
    P.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
    const gg = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 1 });
    add(gg, std('#d9532b', { rough: 0.6, emi: 0.15, em: '#7a2a0a' }));
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6), std('#6a3d20'), 0, -0.42, 0.015);
  }
  return g;
}

// ---------------------------------------------------------------- the open box (result scene)
export function buildOpenBox(T, look) {
  const group = new THREE.Group(), mats = [];
  const W = 5.8, H = 1.25, Dp = 3.9;
  const sideT = tileTextures(look, T, 2, 1), sm = sideT.map.clone(); sm.needsUpdate = true; sm.repeat.set(5, 1); const sb = sideT.bump.clone(); sb.needsUpdate = true; sb.repeat.copy(sm.repeat);
  const side = lacquered(sm, sb, { coat: 0.7, rough: 0.45 }); mats.push(side);
  const body = new THREE.Mesh(B.roundedBox(W, H, Dp, 0.22, 4), side); body.position.y = H / 2; body.castShadow = true; body.receiveShadow = true; group.add(body);
  // open top: dark velvet-lined well with a warm glow rising from it
  const well = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.9, Dp - 0.9), new THREE.MeshStandardMaterial({ color: '#5a1a26', roughness: 1, emissive: '#7a3a1a', emissiveIntensity: 0.0 }));
  well.rotation.x = -Math.PI / 2; well.position.y = H + 0.004; group.add(well);
  const topT = panelTextures(2, false, look, T), topM = lacquered(topT.map, topT.bump, { coat: 0.8 }); mats.push(topM);
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(0, 0, W - 0.04, Dp - 0.04, 0.24, 0.45), { depth: 0.05, bevelEnabled: false }), topM);
  rim.rotation.x = -Math.PI / 2; rim.position.y = H; group.add(rim);
  // drawer: a dark opening on the front, the drawer slides toward the viewer
  const dw = W * 0.66, dh = H * 0.62;
  const dt = panelTextures(3, false, look, T), dm = lacquered(dt.map, dt.bump, { coat: 0.85 }); mats.push(dm);
  const slot = new THREE.Mesh(new THREE.PlaneGeometry(dw + 0.14, dh + 0.14), new THREE.MeshBasicMaterial({ color: '#080204' })); slot.position.set(0, H * 0.5, Dp / 2 + 0.012); group.add(slot);
  const drawer = new THREE.Group();
  const front = new THREE.Mesh(B.slab(dw, dh, 0.22, 0.12, 0.05, { seg: 3 }), dm); front.rotation.x = Math.PI / 2; front.position.set(0, 0, 0.11); front.castShadow = true;
  const tray = new THREE.Mesh(new THREE.BoxGeometry(dw - 0.12, 0.12, Dp * 0.55), new THREE.MeshStandardMaterial({ color: '#7a2a38', roughness: 1 })); tray.position.set(0, -dh / 2 + 0.08, -Dp * 0.275);
  const dknob = new THREE.Mesh(B.lathe([[0, 0], [0.17, 0], [0.17, 0.03], [0.13, 0.1], [0, 0.12]], 24), brassMat(T, 0.05)); dknob.rotation.x = Math.PI / 2; dknob.position.set(0, 0, 0.22);
  drawer.add(front, tray, dknob); drawer.position.set(0, H * 0.5, Dp / 2); group.add(drawer);
  // lid hinged at the back edge
  const lt = panelTextures(0, false, look, T), lm = lacquered(lt.map, lt.bump, { coat: 0.9, coatRough: 0.06 }); mats.push(lm);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, H + 0.08, -Dp / 2);
  const lid = new THREE.Mesh(B.slab(W + 0.1, Dp + 0.08, 0.3, 0.2, 0.06, { seg: 3 }), lm); lid.position.set(0, 0, Dp / 2); lid.castShadow = true; lid.receiveShadow = true;
  lidPivot.add(lid); group.add(lidPivot);
  const glow = new THREE.PointLight(0xffd9a0, 0, 12, 1.4); glow.position.set(0, H + 1.2, 0.2); group.add(glow);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.renderOrder = 6; group.add(halo);
  const keeps = new Map();
  let curKind = null, cur = null;
  return {
    group, dims: { W, H, D: Dp },
    update(k, kind, t, camera) {
      const sm2 = (x) => x * x * (3 - 2 * x), c01 = (x) => Math.min(1, Math.max(0, x));
      const lift = sm2(c01((k - 0.1) * 1.5)), drop = sm2(c01(k * 1.6)), rise = sm2(c01((k - 0.35) * 1.6));
      lidPivot.rotation.x = -lift * 1.45;
      drawer.position.z = Dp / 2 + drop * 1.0;
      if (kind !== curKind) { if (cur) group.remove(cur); curKind = kind; if (!keeps.has(kind)) keeps.set(kind, buildKeepsake(kind, T)); cur = keeps.get(kind); group.add(cur); }
      cur.visible = rise > 0.01;
      cur.position.set(0, H + 0.3 + rise * 1.5 + Math.sin(t * 2) * 0.06, 0.1);
      cur.rotation.y = t * 0.8; cur.scale.setScalar(1.9 * (0.6 + 0.4 * rise));
      glow.intensity = 22 * rise; halo.material.opacity = 0.7 * rise; halo.position.set(0, cur.position.y, 0.5); if (camera) halo.quaternion.copy(camera.quaternion);
      well.material.emissiveIntensity = 0.9 * rise;
    },
    dispose() { for (const m of mats) m.dispose(); },
  };
}
let _radial = null;
export function radialTex() {
  if (_radial) return _radial;
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,236,190,1)'); g.addColorStop(0.35, 'rgba(255,214,150,0.45)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  _radial = canvasTex(c);
  return _radial;
}

// ---------------------------------------------------------------- the craftsman's desk
export function buildDesk(look, T, { lanternLight = true } = {}) {
  const E = ENV[look] ?? ENV.cherry, group = new THREE.Group(), mats = [], geos = [];
  const deskY = BODY_BOTTOM - 0.12;
  // wooden desk top
  const dm = B.material('darkWood', { color: E.desk, color2: E.deskHi, seed: 21, repeat: [6, 6], size: 512 }); mats.push(dm);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), dm); desk.rotation.x = -Math.PI / 2; desk.position.y = deskY - 0.07; desk.receiveShadow = true; group.add(desk);
  // green cutting mat with a stitched border
  const mc = cv(512), mx = mc.getContext('2d'), r = rnd(5);
  const mg = mx.createRadialGradient(256, 200, 20, 256, 256, 380); mg.addColorStop(0, E.matHi); mg.addColorStop(1, E.mat); mx.fillStyle = mg; mx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) { mx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; mx.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
  mx.strokeStyle = 'rgba(255,255,255,0.08)'; mx.lineWidth = 1; for (let i = 0; i <= 512; i += 32) { mx.beginPath(); mx.moveTo(i, 0); mx.lineTo(i, 512); mx.moveTo(0, i); mx.lineTo(512, i); mx.stroke(); }
  const matTex = canvasTex(mc, { repeat: [1, 1] });
  const matMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.96, metalness: 0 }); mats.push(matMat);
  const matM = new THREE.Mesh(B.slab(30, 30, 0.1, 0.5, 0.03, { seg: 2 }), matMat); matM.position.y = deskY - 0.1; matM.receiveShadow = true; group.add(matM);
  geos.push(matM.geometry);

  const props = new THREE.Group(); group.add(props);
  const std = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0, emissive: o.em ?? 0x000000, emissiveIntensity: o.emi ?? 0 }); mats.push(m); return m; };
  const mk = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = o.cast !== false; m.receiveShadow = true; if (o.rot) m.rotation.set(...o.rot); props.add(m); geos.push(geo); return m; };
  const y0 = deskY;

  // paper lantern (andon): wooden frame, glowing washi
  const lan = new THREE.Group(); lan.position.set(-6.6, y0, -9.4); props.add(lan);
  const wood = B.material('darkWood', { color: '#3a200f', color2: '#5a3416', seed: 4 }); mats.push(wood);
  const paperM = new THREE.MeshStandardMaterial({ color: E.paper, roughness: 0.9, emissive: E.lamp, emissiveIntensity: 1.35 }); mats.push(paperM);
  const lb = new THREE.Mesh(B.roundedBox(1.6, 0.22, 1.6, 0.06), wood); lb.position.y = 0.11; lb.castShadow = true; lan.add(lb);
  const lp = new THREE.Mesh(B.roundedBox(1.3, 2.2, 1.3, 0.08), paperM); lp.position.y = 1.32; lan.add(lp);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.3, 0.12), wood); p.position.set(sx * 0.66, 1.3, sz * 0.66); p.castShadow = true; lan.add(p); }
  const lt = new THREE.Mesh(B.roundedBox(1.7, 0.2, 1.7, 0.06), wood); lt.position.y = 2.5; lt.castShadow = true; lan.add(lt);
  geos.push(lb.geometry, lp.geometry, lt.geometry);
  let lamp = null;
  if (lanternLight) { lamp = new THREE.PointLight(E.lamp, 60, 40, 1.7); lamp.position.set(-6.6, y0 + 1.4, -9.0); group.add(lamp); }

  // tea cup + saucer
  const cup = new THREE.Group(); cup.position.set(4.1, y0, 8.6); props.add(cup);
  const clay = new THREE.MeshStandardMaterial({ color: look === 'maple' ? '#6a8aa0' : '#e8e2d4', roughness: 0.3 }); mats.push(clay);
  const sauc = new THREE.Mesh(B.lathe([[0, 0], [0.9, 0], [1.05, 0.08], [0.95, 0.1], [0.7, 0.04], [0, 0.04]], 28), clay); sauc.castShadow = true; sauc.receiveShadow = true;
  const cupm = new THREE.Mesh(B.lathe([[0, 0.04], [0.34, 0.04], [0.42, 0.1], [0.5, 0.55], [0.46, 0.56], [0.38, 0.12], [0, 0.1]], 28), clay); cupm.castShadow = true;
  const tea = new THREE.Mesh(new THREE.CircleGeometry(0.44, 24), new THREE.MeshStandardMaterial({ color: '#7a4a14', roughness: 0.15 })); tea.rotation.x = -Math.PI / 2; tea.position.y = 0.46;
  cup.add(sauc, cupm, tea); geos.push(sauc.geometry, cupm.geometry);

  // ink stone + brush + washi
  const stone = mk(B.roundedBox(1.5, 0.28, 1.0, 0.08), std('#15161a', { rough: 0.35 }), -3.2, y0 + 0.14, 8.9);
  const ink = mk(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 20), std('#000000', { rough: 0.05 }), -3.0, y0 + 0.285, 8.9, { cast: false });
  const brush = mk(new THREE.CylinderGeometry(0.035, 0.05, 2.2, 8), std('#4a2a14'), -1.3, y0 + 0.22, 9.4, { rot: [0, 0.35, Math.PI / 2] });
  const tip = mk(new THREE.CylinderGeometry(0.05, 0.015, 0.45, 8), std('#1a1410', { rough: 0.9 }), -2.45, y0 + 0.22, 9.6, { rot: [0, 0.35, Math.PI / 2] });
  void stone; void ink; void brush; void tip;
  const paper = mk(new THREE.BoxGeometry(2.4, 0.02, 3.2), new THREE.MeshStandardMaterial({ map: washiTex(), roughness: 0.95 }), 1.2, y0 + 0.011, 9.2, { cast: false, rot: [0, -0.18, 0] });
  void paper;

  // bundle of marquetry sticks tied with a red cord
  const sticks = new THREE.Group(); sticks.position.set(-5.6, y0, 6.5); sticks.rotation.y = 0.6; props.add(sticks);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 3.4), std(T.woods[i % 4], { rough: 0.55 })); s.position.set((i % 4) * 0.3 - 0.45, 0.1 + Math.floor(i / 4) * 0.2, 0); s.castShadow = true; sticks.add(s); geos.push(s.geometry);
  }
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 20), std('#b3262b', { rough: 0.7 })); cord.rotation.y = Math.PI / 2; cord.position.set(0, 0.22, 0.2); cord.scale.set(1, 0.55, 1); sticks.add(cord);

  // loose brass key
  const kg = buildKeepsake('key', T); kg.position.set(5.7, y0 + 0.08, 5.6); kg.rotation.set(-Math.PI / 2, 0, 0.7); kg.scale.setScalar(1.2); props.add(kg);

  // steam from the cup (soft sprites that rise and fade)
  const steam = []; const stTex = radialTex();
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: stTex, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff, fog: false }));
    m.renderOrder = 7; group.add(m); steam.push(m);
  }
  // dust motes drifting in the lamp light
  const moteG = new THREE.SphereGeometry(0.025, 5, 4), moteM = new THREE.MeshBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const motes = new THREE.InstancedMesh(moteG, moteM, 44); motes.frustumCulled = false; group.add(motes);
  const seeds = Array.from({ length: 44 }, (_, i) => ({ x: (rnd(i + 1)() - 0.5) * 16, y: rnd(i + 90)() * 5, z: (rnd(i + 200)() - 0.5) * 16, p: rnd(i + 7)() * TAU, s: 0.08 + rnd(i + 31)() * 0.15 }));
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

  return {
    group, lamp, paperMat: paperM,
    update(t, camera, calm) {
      const flick = calm ? 1 : 1 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 3.1) * 0.04;
      if (lamp) lamp.intensity = 60 * flick;
      paperM.emissiveIntensity = 1.35 * flick;
      for (let i = 0; i < steam.length; i++) {
        const k = ((t * 0.28 + i / steam.length) % 1), m = steam[i];
        m.position.set(4.1 + Math.sin(t * 0.8 + i) * 0.12 + k * 0.1, y0 + 0.6 + k * 1.6, 8.6 + Math.cos(t * 0.6 + i) * 0.1);
        m.scale.setScalar(0.5 + k * 1.4); m.material.opacity = calm ? 0 : Math.sin(k * Math.PI) * 0.2;
        if (camera) m.quaternion.copy(camera.quaternion);
      }
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i];
        _p.set(s.x + Math.sin(t * s.s + s.p) * 0.6, y0 + 0.4 + ((s.y + t * s.s * 0.6) % 5), s.z + Math.cos(t * s.s * 0.8 + s.p) * 0.6);
        _s.setScalar(0.7 + 0.5 * Math.sin(t * 1.3 + s.p)); _m.compose(_p, _q, _s); motes.setMatrixAt(i, _m);
      }
      motes.instanceMatrix.needsUpdate = true; motes.visible = !calm;
    },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
function washiTex() {
  const c = cv(256, 340), x = c.getContext('2d'), r = rnd(9);
  x.fillStyle = '#f4ead2'; x.fillRect(0, 0, 256, 340);
  for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(150,120,70,${r() * 0.08})`; x.fillRect(r() * 256, r() * 340, 1 + r() * 3, 1); }
  x.strokeStyle = 'rgba(15,12,10,0.88)'; x.lineCap = 'round';   // a few ink brush strokes, no text
  x.lineWidth = 9; x.beginPath(); x.moveTo(60, 70); x.quadraticCurveTo(120, 40, 190, 80); x.stroke();
  x.lineWidth = 7; x.beginPath(); x.moveTo(120, 50); x.quadraticCurveTo(110, 130, 130, 200); x.stroke();
  x.lineWidth = 6; x.beginPath(); x.moveTo(70, 170); x.quadraticCurveTo(110, 150, 170, 190); x.stroke();
  x.lineWidth = 8; x.beginPath(); x.moveTo(90, 260); x.quadraticCurveTo(140, 230, 200, 270); x.stroke();
  x.fillStyle = '#c0392b'; x.fillRect(200, 280, 26, 26);
  return canvasTex(c);
}
