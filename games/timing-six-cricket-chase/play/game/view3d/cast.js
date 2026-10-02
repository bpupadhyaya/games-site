// The cast: one athlete per role, dressed with the gear from gear.js. All humans share the same two glb files (clones).
import { loadHuman, addSportClips, addThrowClips, addFieldClips } from '../vendor3d/index.js';
import { Rig } from './rig.js';
import { buildPerson, buildBat, buildBall } from './gear.js';

// Team looks. `bat` = the batting side (cream whites with teal trim), `field` = the fielding side (blue), per the 2D art.
const LOOKS = {
  stadium: {
    bat: { shirt: '#f4ead2', trousers: '#f2eee3', sleeves: 'short', sleeve: '#f4ead2', pad: '#fbf8f0', strap: '#d8b987', helmet: '#1f6f78', grille: '#9aa1a8', glove: '#f6f2e8', gloveTrim: '#1f6f78', pads: true, gloves: 'bat', kit: { top: '#f4ead2', bottoms: '#f2eee3', socks: '#f2eee3' } },
    field: { shirt: '#3d6fd1', trousers: '#2c3f78', sleeves: 'short', sleeve: '#3d6fd1', cap: '#2c3f78', kit: { top: '#3d6fd1', bottoms: '#2c3f78', socks: '#e9e9e9' } },
    keeper: { shirt: '#3d6fd1', trousers: '#2c3f78', sleeves: 'short', sleeve: '#3d6fd1', cap: '#2c3f78', pad: '#f6f2e8', strap: '#c9a46a', pads: true, glove: '#e8d9b0', gloveTrim: '#2c3f78', gloves: 'keeper', kit: { top: '#3d6fd1', bottoms: '#2c3f78', socks: '#e9e9e9' } },
    umpire: { shirt: '#f2f0ea', trousers: '#3a3f4a', sleeves: 'short', sleeve: '#f2f0ea', hat: true, cap: '#f4f1e6', kit: { top: '#f2f0ea', bottoms: '#3a3f4a', socks: '#2b2f38' } },
  },
  backyard: {
    bat: { shirt: '#f4a53a', sleeves: 'short', sleeve: '#f4a53a', cap: '#2d6a8a', kit: { top: '#f4a53a', bottoms: '#2d6a8a', socks: '#f4f4f0' } },
    field: { shirt: '#3d6fd1', sleeves: 'short', sleeve: '#3d6fd1', kit: { top: '#3d6fd1', bottoms: '#2c3f78', socks: '#e9e9e9' } },
    keeper: { shirt: '#3d6fd1', sleeves: 'short', sleeve: '#3d6fd1', kit: { top: '#3d6fd1', bottoms: '#2c3f78', socks: '#e9e9e9' } },
    umpire: { shirt: '#f2f0ea', sleeves: 'short', sleeve: '#f2f0ea', cap: '#f4f1e6', kit: { top: '#f2f0ea', bottoms: '#6a6f7a', socks: '#2b2f38' } },
  },
  beach: {
    bat: { shirt: '#ff7a59', sleeves: null, cap: '#ff7a59', kit: { top: '#ff7a59', bottoms: '#2ec4b6', socks: '#f4f4f0' } },
    field: { shirt: '#3d6fd1', sleeves: null, kit: { top: '#3d6fd1', bottoms: '#e8d9a8', socks: '#e9e9e9' } },
    keeper: { shirt: '#3d6fd1', sleeves: null, kit: { top: '#3d6fd1', bottoms: '#e8d9a8', socks: '#e9e9e9' } },
    umpire: { shirt: '#f2f0ea', sleeves: null, cap: '#f4f1e6', kit: { top: '#f2f0ea', bottoms: '#e8d9a8', socks: '#f4f4f0' } },
  },
};
const SKINS = ['tan', 'light', 'brown', 'deep', 'tan', 'light', 'brown', 'tan', 'deep', 'light', 'brown', 'tan'];
const HAIRS = ['black', 'brown', 'black', 'black', 'blond', 'brown', 'black', 'ginger', 'black', 'brown', 'grey', 'black'];

// Light level of detail with trousers: the library's light mesh is ONE draw call but its legs are bare skin below the shorts. For looks
// with long trousers every skin vertex on the thigh / calf is re-painted as "bottoms" (the kit's trouser colour) in a copy of the shared
// light geometry (made once per character), so a far-away fielder wears whites / trousers at no extra draw call.
const legVariants = new Map();
function trousersForLight(h) {
  const mesh = h.lodSets && h.lodSets.light[0];
  if (!mesh) return;
  const geo = mesh.geometry;
  let v = legVariants.get(geo);
  if (!v) {
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, mk = geo.attributes.aMask, col = geo.attributes.color;
    const bones = mesh.skeleton.bones;
    const leg = new Set(['L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf'].map((n) => bones.indexOf(h.bones[`Bip01_${n}`])));
    const mask = mk.array.slice(), color = col.array.slice();
    for (let i = 0; i < mk.count; i++) {
      let w = 0; for (let k = 0; k < 4; k++) if (leg.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
      if (w > 0.5 && mask[i * 4 + 3] > 0.5) { mask[i * 4] = 0; mask[i * 4 + 1] = 1; mask[i * 4 + 2] = 0; mask[i * 4 + 3] = 0; color[i * 3] = color[i * 3 + 1] = color[i * 3 + 2] = 0.8; }
    }
    v = geo.clone();
    v.setAttribute('aMask', new mk.constructor(mask, 4)); v.setAttribute('color', new col.constructor(color, 3));
    legVariants.set(geo, v);
  }
  mesh.geometry = v;
}

// Every person is the library's shared-LOD human (full / medium / light chosen from the size on screen by the director, see lodPass).
// Gear (gear.js) is drawn at full and medium; at light the trousers are baked into the single light mesh and the gear is hidden (1 draw call per person).
export async function makeActor(stage, theme, side, role, k = 0, character = 'athlete_m', quality = 'high') {
  const look = (LOOKS[theme] || LOOKS.stadium)[role === 'batter' ? 'bat' : role === 'keeper' ? 'keeper' : role === 'umpire' ? 'umpire' : 'field'];
  const h = await loadHuman({ character, kit: look.kit, skin: SKINS[k % SKINS.length], hair: HAIRS[k % HAIRS.length], lod: 'auto', quality });
  h.updated = true;
  h.mats.forEach((m) => { m.side = 2; });   // the vest is a half shell: render both sides
  addSportClips(h); addThrowClips(h); addFieldClips(h);
  const rig = new Rig(h);
  if (look.trousers) trousersForLight(h);
  const gear = buildPerson(h, rig, { ...look, helmet: role === 'batter' ? look.helmet : undefined });
  // shadow maps: only the batter casts one (his light / medium / full meshes), everybody else gets the blob shadow
  for (const set of Object.values(h.lodSets)) if (Array.isArray(set)) for (const m of set) m.castShadow = role === 'batter' && k === 0 && quality !== 'low';
  stage.add(h);
  h.root.visible = true;
  const actor = { h, rig, gear, role, look, k, side, bat: null, ball: null, glv: -1, hero: role === 'batter' && k === 0 };
  return actor;
}

/** Set the level of detail from the person's size on screen; the gear follows (hidden at light, except the striker's). Returns the level. */
export function setActorLod(actor, camera, viewportHeight, heroMax = 0) {
  // the library tiers use the medium mesh (fine hands) down to 60-90 px; cricket's far people are tiny and their hands are a few pixels, so non-strikers keep the light mesh
  // (1 draw call, trousers baked in) below 90 px on every tier. The striker follows the library policy untouched.
  const pol = actor.h.lodPolicy;
  let lv = actor.hero || !pol ? actor.h.autoLOD(camera, viewportHeight) : actor.h.autoLOD(camera, viewportHeight, { full: pol.full, medium: Math.max(pol.medium, 90) });
  if (actor.hero && lv < heroMax) { lv = heroMax; actor.h.setLOD(lv); }   // the striker is huge on screen: below the high tier he is drawn at medium (3k triangles, looks the same at that size)
  if (lv !== actor.glv) {
    actor.glv = lv;
    if (actor.gear && !actor.hero) for (const m of [actor.gear.cloth, actor.gear.hard]) if (m) m.visible = lv < 2;
  }
  return lv;
}

export function equipBat(actor, bottomSide) {
  if (actor.bat) { actor.h.detach(actor.bat); }
  actor.bat = buildBat(); actor.bat.traverse((o) => { o.castShadow = false; });
  actor.h.attach(actor.bat, bottomSide, 'bat', { slide: 0.2 });
  actor.h.holdTwoHanded(actor.bat, bottomSide === 'R' ? 'L' : 'R', { gap: -0.1 });
  actor.batSide = bottomSide;
  return actor.bat;
}

export function hideActor(a) { if (a.h.root.visible) a.h.root.visible = false; }
export function showActor(a) { if (!a.h.root.visible) a.h.root.visible = true; }
