// The cast: athletes near the camera, mannequins (stylised, one draw call each) far away dressed in team kits, with mixed skin tones, hair and builds.
import { loadHuman, addSportClips, addThrowClips, addFieldClips } from '../vendor3d/index.js';
import { Rig } from './rig.js';
import { buildBat } from './props.js';

export const KITS = [
  { top: '#16a39a', bottoms: '#f4f1e8', socks: '#f4f1e8', trim: '#ffd34d', shoes: '#2a2f38' },   // home side: teal shirts, white shorts
  { top: '#ec6b2d', bottoms: '#25345a', socks: '#25345a', trim: '#fff1d6', shoes: '#2a2f38' },   // visitors: orange shirts, navy shorts
];
const SKINS = ['wood', 'brown', 'tan', 'deep', 'clay', 'peach', 'brown', 'wood', 'tan', 'deep', 'clay'];
const HAIRS = ['black', 'black', 'brown', 'black', 'black', 'brown', 'black', 'brown', 'black', 'brown', 'black'];

export async function makeActor(stage, k, team = 0) {
  // every player starts as a one-draw-call mannequin so the title is interactive fast; the players that fill the frame are swapped for real athletes right after (upgradeActor)
  const near = false;
  const f = k % 3 === 2;
  const character = f ? 'mannequin_f' : 'mannequin_m';
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

// who fills the frame: both batters and the bowler / keepers
export const isNear = (k) => k < 2 || k === 11 || k === 2 || k === 3 || k === 4;

// Swap a mannequin for a real athlete (sleeved shirt) in place: the actor object keeps its identity, so everything that holds it keeps working.
export async function upgradeActor(stage, actor) {
  const k = actor.k, f = k % 3 === 2;
  const character = f ? 'athlete_f' : 'athlete_m';
  const h = await loadHuman({ character, kit: { ...KITS[actor.team] }, skin: SKINS[actor.skinK % SKINS.length], hair: HAIRS[actor.skinK % HAIRS.length], legs: 'shorts', top: 'long', lod: 'auto' });
  h.updated = true;
  addSportClips(h); addThrowClips(h); addFieldClips(h);
  const old = actor.h;
  h.root.position.copy(old.root.position); h.root.rotation.copy(old.root.rotation); h.root.visible = old.root.visible;
  if (actor.bat) old.detach(actor.bat);
  stage.add(h); stage.remove(old);
  actor.h = h; actor.rig = new Rig(h); actor.character = character;
  if (actor.bat) { h.attach(actor.bat, 'R', 'bat', { slide: 0.2 }); h.holdTwoHanded(actor.bat, 'L', { gap: -0.1 }); }
  return actor;
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
