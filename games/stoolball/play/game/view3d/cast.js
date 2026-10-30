// The cast: real 3D people (athlete_m / athlete_f) in team kits with their own skin and hair, plus the paddles the batters carry.
import { makePaddle } from './props.js';

// Summer whites, village-club style. Batting side: crimson club shirts, cream trousers. Fielding side: cream shirts and trousers, navy trim.
export const KITS = {
  bat: { top: '#b8322a', bottoms: '#efe7cc', socks: '#f2ecd8', shoes: '#efe9da', trim: '#f4e3a8' },
  field: { top: '#f1ead4', bottoms: '#e9e1c6', socks: '#efe8d2', shoes: '#e8e4d8', trim: '#26457a' },
};
const SPEC = [
  // bowler, eight fielders, striker, non-striker
  { ch: 'athlete_f', skin: 'light', hair: 'brown', team: 'field' },
  { ch: 'athlete_m', skin: 'tan', hair: 'black', team: 'field' },
  { ch: 'athlete_f', skin: 'peach', hair: 'blond', team: 'field' },
  { ch: 'athlete_m', skin: 'light', hair: 'ginger', team: 'field' },
  { ch: 'athlete_f', skin: 'brown', hair: 'black', team: 'field' },
  { ch: 'athlete_m', skin: 'peach', hair: 'brown', team: 'field' },
  { ch: 'athlete_f', skin: 'tan', hair: 'black', team: 'field' },
  { ch: 'athlete_m', skin: 'deep', hair: 'black', team: 'field' },
  { ch: 'athlete_f', skin: 'light', hair: 'grey', team: 'field' },
  { ch: 'athlete_f', skin: 'peach', hair: 'brown', team: 'bat' },
  { ch: 'athlete_m', skin: 'tan', hair: 'black', team: 'bat' },
];

export async function makeCast(V, stage) {
  const { loadHuman, addBatClips, addThrowClips, addFieldClips } = V;
  const actors = await Promise.all(SPEC.map(async (s, i) => {
    const h = await loadHuman({ character: s.ch, kit: { ...KITS[s.team] }, skin: s.skin, hair: s.hair, top: 'long', lod: 'auto', castShadow: true });
    h.updated = true;
    if (s.team === 'bat') addBatClips(h); else { addThrowClips(h); addFieldClips(h); }
    stage.add(h); stage.track(h);
    h.root.visible = false;
    h.play('idle', { fade: 0 });
    const a = { h, team: s.team, x: null, y: null, key: '', seed: ((i * 2654435761) >>> 0) / 4294967296, paddle: null, throwN: 0, lod: -1 };
    if (s.team === 'bat') {
      a.paddle = makePaddle(V.THREE);
      h.comfortTilt = 0;                // no per-frame search over wrist tilts: it dithers the hand by a centimetre
      h.attach(a.paddle, 'R', 'bat', { slide: 0.14 });
      a.paddle.visible = false;
    }
    return a;
  }));
  return { bowler: actors[0], fielders: actors.slice(1, 9), bats: actors.slice(9, 11) };
}

// Level of detail from the person's height on the screen in css px.
export function applyLOD(a, px) {
  const want = px > 240 ? 0 : px > 70 ? 1 : 2;
  if (want !== a.lod) { a.lod = want; try { a.h.setLOD(want); } catch { /* no LOD meshes: keep full */ } }
}
