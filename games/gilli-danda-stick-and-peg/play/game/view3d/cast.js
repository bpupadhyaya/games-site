// The cast: real 3D people (the platform's athletes) dressed as village children in cotton shirts, loose trousers and caps, built as skinned cloth (gear.js).
import { loadHuman, THREE } from '../vendor3d/index.js';
import { Rig } from './rig.js';
import { buildPerson } from './gear.js';
import { buildDanda } from './props3.js';

export const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`; };

/** A person's look from a striker/fielder record. */
export function lookOf(p) {
  const top = p.top ?? '#f2b02e', trim = p.trim ?? shade(top, 0.6), pants = p.pants ?? '#e6dfcc';
  return {
    female: !!p.female, shirt: top, sleeve: top, trousers: pants, cap: p.female ? null : (p.cap ?? '#f4efe2'), belt: null, skin: p.skin ?? 'tan', hair: p.hair ?? 'black',
    kit: { top, bottoms: pants, socks: pants, trim, shoes: '#6b4a30' },
  };
}

export async function makeActor(stage, role, look, quality = 'high') {
  const h = await loadHuman({ character: look.female ? 'athlete_f' : 'athlete_m', kit: look.kit, skin: look.skin, hair: look.hair, lod: 'auto', quality });
  h.updated = true;
  const rig = new Rig(h);
  stage.add(h);
  // the striker hangs under a group so a left-hander can be drawn as the mirror image of the right-handed pose
  let mir = null;
  if (role === 'striker') { mir = new THREE.Group(); (h.root.parent || stage.scene).add(mir); mir.add(h.root); }
  h.root.visible = false;
  const a = { mir, h, rig, role, gear: null, danda: null, look: null, female: !!look.female };
  dress(a, look);
  for (const set of Object.values(h.lodSets || {})) if (Array.isArray(set)) for (const m of set) m.castShadow = role === 'striker' && quality !== 'low';
  return a;
}

/** (Re)dress: rebuild the cloth for a new look (skinned to the same skeleton). A change of sex needs a different actor (the caller keeps one of each). */
export function dress(a, look) {
  const key = JSON.stringify(look);
  if (a.look === key) return;
  a.look = key;
  if (a.gear) { a.gear.removeFromParent(); a.gear.geometry.dispose(); a.gear.material.dispose(); a.gear = null; }
  a.h.setKit(look.kit); a.h.setSkin(look.skin); a.h.setHair(look.hair);
  const spec = { shirt: look.shirt, sleeve: look.sleeve, trousers: look.trousers, sleeves: 'long', cap: look.cap, belt: look.belt, gloveTrim: look.kit.trim };
  const g = buildPerson(a.h, a.rig, spec);
  a.gear = g.cloth; if (a.gear) a.gear.castShadow = a.role === 'striker';
}

export function equipDanda(a) {
  if (a.danda) a.h.detach(a.danda);
  a.danda = buildDanda(); a.danda.traverse((o) => { o.castShadow = o.isMesh; });
  a.h.attach(a.danda, 'R', 'bat', { slide: 0.16 });
  return a.danda;
}
export const show = (a, on) => { if (a.h.root.visible !== on) a.h.root.visible = on; };
