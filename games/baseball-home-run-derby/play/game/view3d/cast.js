// The cast: a real 3D person (the platform's athlete) per role, dressed in a baseball uniform built as skinned cloth (gear.js).
import { loadHuman } from '../vendor3d/index.js';
import { Rig } from './rig.js';
import { buildPerson, buildBat } from './gear.js';
import { PITCHER_LOOK } from '../src/core.js';

const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = (c) => Math.max(0, Math.min(255, Math.round(c * k))); return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`; };

export function lookOfBatter(b) {
  return { shirt: b.trim, sleeve: b.trim, trousers: '#eeeae0', helmet: shade(b.trim, 0.32), belt: '#1c1f26', cap: null, skin: b.skin, hair: b.hair, flap: b.hand > 0 ? 'L' : 'R', kit: { top: b.trim, bottoms: '#eeeae0', socks: '#f4f4f0', trim: shade(b.trim, 0.7), shoes: '#f4f4f0' } };
}
export function lookOfPitcher() {
  const p = PITCHER_LOOK;
  return { shirt: p.top, sleeve: p.top, trousers: '#c9ccd2', cap: p.cap, belt: '#1c1f26', skin: p.skin, hair: p.hair, kit: { top: p.top, bottoms: '#c9ccd2', socks: '#1d2f55', trim: p.trim, shoes: '#f4f4f0' } };
}

export async function makeActor(stage, role, look, quality = 'high') {
  const h = await loadHuman({ character: 'athlete_m', kit: look.kit, skin: look.skin, hair: look.hair, lod: 'auto', quality });
  h.updated = true;
  const rig = new Rig(h);
  stage.add(h);
  h.root.visible = false;
  const a = { h, rig, role, gear: null, bat: null, look: null, batSide: null, glv: -1 };
  dress(a, look);
  for (const set of Object.values(h.lodSets || {})) if (Array.isArray(set)) for (const m of set) m.castShadow = role === 'batter' && quality !== 'low';
  return a;
}

/** (Re)dress: rebuild the cloth + hard gear for a new look (skinned to the same skeleton). */
export function dress(a, look) {
  const key = JSON.stringify(look);
  if (a.look === key) return;
  a.look = key;
  if (a.gear) { a.gear.removeFromParent(); a.gear.geometry.dispose(); a.gear.material.dispose(); a.gear = null; }
  a.h.setKit(look.kit); a.h.setSkin(look.skin); a.h.setHair(look.hair);
  const spec = { shirt: look.shirt, sleeve: look.sleeve, trousers: look.trousers, sleeves: 'short', cap: look.cap, helmet: look.helmet, belt: look.belt, flap: look.flap, gloveTrim: look.kit.trim };
  const g = buildPerson(a.h, a.rig, spec);
  a.gear = g.cloth; if (a.gear) a.gear.castShadow = a.role === 'batter';
}

export function equipBat(a, bottomSide) {
  if (a.bat) a.h.detach(a.bat);
  a.bat = buildBat(); a.bat.traverse((o) => { o.castShadow = false; });
  a.h.attach(a.bat, bottomSide, 'bat', { slide: 0.2 });
  a.h.holdTwoHanded(a.bat, bottomSide === 'R' ? 'L' : 'R', { gap: -0.12 });
  a.batSide = bottomSide;
  return a.bat;
}
export const show = (a, on) => { if (a.h.root.visible !== on) a.h.root.visible = on; };
