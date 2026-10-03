// The cast: mannequin players (stylised, one draw call each) dressed in team kits, with mixed skin tones, hair and builds.
import { loadHuman, addSportClips, addThrowClips, addFieldClips } from '../vendor3d/index.js';
import { Rig } from './rig.js';
import { buildBat } from './props.js';

export const KITS = [
  { top: '#16a39a', bottoms: '#f4f1e8', socks: '#f4f1e8', trim: '#ffd34d', shoes: '#2a2f38' },   // home side: teal shirts, white shorts
  { top: '#ec6b2d', bottoms: '#25345a', socks: '#25345a', trim: '#fff1d6', shoes: '#2a2f38' },   // visitors: orange shirts, navy shorts
];
const SKINS = ['wood', 'brown', 'tan', 'deep', 'clay', 'peach', 'brown', 'wood', 'tan', 'deep', 'clay'];
const HAIRS = ['black', 'black', 'brown', 'black', 'black', 'brown', 'black', 'grey', 'black', 'brown', 'black'];

export async function makeActor(stage, k, team = 0) {
  const character = k % 3 === 2 ? 'mannequin_f' : 'mannequin_m';
  const h = await loadHuman({ character, kit: { ...KITS[team] }, skin: SKINS[k % SKINS.length], hair: HAIRS[k % HAIRS.length], legs: 'shorts' });
  h.updated = true;
  addSportClips(h); addThrowClips(h); addFieldClips(h);
  const rig = new Rig(h);
  stage.add(h);
  h.root.visible = false;
  // the per-player seed gives every player their own idle phase, weight shift and arm placement
  const seed = (k * 2654435761 >>> 0) / 4294967296;
  return { h, rig, k, team, bat: null, seed, dist: 0, lastX: null, lastZ: null, skinK: k, character };
}

export function dress(actor, team) {
  if (actor.team === team) return;
  actor.team = team;
  actor.h.setKit({ ...KITS[team] });
}

export function equipBat(actor) {
  if (actor.bat) return actor.bat;
  actor.bat = buildBat();
  actor.h.attach(actor.bat, 'R', 'bat', { slide: 0.2 });
  actor.h.holdTwoHanded(actor.bat, 'L', { gap: -0.1 });
  actor.bat.visible = false;
  return actor.bat;
}
export const setSkinOf = (actor, k) => { if (actor.skinK !== k) { actor.skinK = k; actor.h.setSkin(SKINS[k % SKINS.length]); actor.h.setHair(HAIRS[k % HAIRS.length]); } };
