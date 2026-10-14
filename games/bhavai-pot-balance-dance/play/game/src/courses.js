// The eight acts. Each act is a small spec; the choreography (what happens on every beat) is generated from the act's seed with a
// private LCG, so an act is the same every time and stored bests stay comparable. Changing a seed or a spec changes the act.
export const SLOTS = [-1.2, -0.6, 0, 0.6, 1.2];     // footprint lanes, metres either side of the middle of the stage
export const PHRASE = 8;                            // beats per phrase (one Think / Reveal section in Watch and Learn)
export const COUNT_IN = 4;                          // beats of drum before the first dance beat

export const ACTS = [
  { id: 'courtyard', name: 'Courtyard at Dusk', seed: 4101, bpm: 80, phrases: 5, pots0: 3, potCues: 3, spread: 1, rest: 0.34, turns: 0, wind: 0.0, lean: 0.15, noise: 0.06, par: 66,
    look: 'haveli', sky: ['#f6a45a', '#d9607a', '#5a3a7a'], wall: ['#2b6fb0', '#1c4f8a'], blurb: 'A blue-washed courtyard at sunset. Gentle drums, wide steps, three pots to start.' },
  { id: 'market', name: 'Market Fair', seed: 5207, bpm: 86, phrases: 6, pots0: 3, potCues: 4, spread: 1, rest: 0.28, turns: 0, wind: 0.0, lean: 0.17, noise: 0.08, par: 70,
    look: 'haveli', sky: ['#ffd27a', '#f48a5a', '#9a4a7a'], wall: ['#3a86c8', '#2468a6'], blurb: 'Strings of bulbs and a busy crowd. A little quicker, and a pot every phrase.' },
  { id: 'dunes', name: 'Desert Dunes', seed: 6311, bpm: 90, phrases: 7, pots0: 4, potCues: 4, spread: 2, rest: 0.26, turns: 3, wind: 0.09, lean: 0.19, noise: 0.084, par: 76,
    look: 'dunes', sky: ['#ffcf7a', '#ff9a5a', '#c85a6a'], wall: ['#e8a85a', '#c8803a'], blurb: 'Golden dunes at the edge of the village. Spins arrive: the tower is flung, so brace.' },
  { id: 'lake', name: 'Lakeside Terrace', seed: 7419, bpm: 94, phrases: 7, pots0: 4, potCues: 5, spread: 2, rest: 0.24, turns: 3, wind: 0.15, lean: 0.2, noise: 0.092, par: 76,
    look: 'lake', sky: ['#7ac0e8', '#a8d8f0', '#f6e6c8'], wall: ['#4a9ad0', '#2c78b0'], blurb: 'A palace terrace over still water. A breeze comes and goes across the stage.' },
  { id: 'lamps', name: 'Night of Lamps', seed: 8527, bpm: 96, phrases: 8, pots0: 4, potCues: 5, spread: 2, rest: 0.22, turns: 4, wind: 0.15, lean: 0.22, noise: 0.104, par: 80,
    look: 'haveli', night: true, sky: ['#0c1636', '#1c2c5a', '#3a4a8a'], wall: ['#245aa0', '#143c78'], blurb: 'Lamps on every ledge. Steps jump two lanes at a time and spins come in pairs.' },
  { id: 'monsoon', name: 'Monsoon Courtyard', seed: 9631, bpm: 98, phrases: 8, pots0: 5, potCues: 5, spread: 2, rest: 0.20, turns: 5, wind: 0.23, lean: 0.23, noise: 0.116, par: 82,
    look: 'haveli', rain: true, sky: ['#566a86', '#7a8ea8', '#a8b8c8'], wall: ['#2e5c92', '#1e4070'], blurb: 'Rain on the tiles and gusting wind. Five pots to begin with: stay calm.' },
  { id: 'fort', name: 'Fort at Moonrise', seed: 10739, bpm: 100, phrases: 9, pots0: 5, potCues: 6, spread: 2, rest: 0.18, turns: 5, wind: 0.25, lean: 0.25, noise: 0.124, par: 86,
    look: 'fort', night: true, sky: ['#14183a', '#2a2a5a', '#5a4a7a'], wall: ['#d09a5a', '#a8723a'], blurb: 'Sandstone ramparts under a rising moon. Wide leaps between lanes.' },
  { id: 'finale', name: 'Grand Finale', seed: 11843, bpm: 104, phrases: 10, pots0: 5, potCues: 6, spread: 2, rest: 0.16, turns: 6, wind: 0.29, lean: 0.27, noise: 0.14, par: 90,
    look: 'haveli', night: true, festival: true, sky: ['#1a0c36', '#4a1a5a', '#a83a6a'], wall: ['#3a6ac0', '#24449a'], blurb: 'The whole village watching, fast drums, wind and spins. Eleven pots if you can.' },
];
export const POT_MAX = 11;

function lcg(seed) {
  let a = seed >>> 0;
  const next = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  return { next, int: (n) => Math.floor(next() * n), chance: (p) => next() < p };
}

// beats[i] = { type: 'step' | 'rest' | 'turn' | 'pot', slot, dir, phrase, k }  (k = beat within its phrase)
export function choreography(act) {
  const r = lcg(act.seed), beats = [];
  let slot = 2, lastStepAge = 3;
  const potPhrases = new Set(), turnPhrases = new Set();
  for (let i = 0; i < act.potCues; i++) potPhrases.add(1 + Math.floor((i * (act.phrases - 1)) / act.potCues));
  for (let i = 0; i < act.turns; i++) turnPhrases.add(1 + Math.floor(((act.phrases - 1) * (i + 0.5)) / act.turns));
  let lastDir = r.chance(0.5) ? 1 : -1;
  for (let p = 0; p < act.phrases; p++) {
    const potPhrase = potPhrases.has(p), turnPhrase = turnPhrases.has(p), potBeat = potPhrase ? 7 : -1;
    for (let k = 0; k < PHRASE; k++) {
      let b;
      if (k === potBeat) b = { type: 'pot', slot: 2 };
      else if (k === potBeat - 1 && potPhrase) b = { type: 'rest', slot };
      else if (turnPhrase && k === 3) { lastDir = -lastDir; b = { type: 'turn', slot, dir: lastDir }; }
      else if (turnPhrase && k === 4) b = { type: 'rest', slot };
      else if (p === 0 && k === 0) b = { type: 'step', slot: 2 };
      else if (k % 2 === 1 && r.chance(act.rest)) b = { type: 'rest', slot };
      else {
        // a big jump needs time: one lane per beat since the last footprint
        const reach = Math.max(1, Math.min(act.spread, lastStepAge + 1));
        let ns = slot;
        for (let tries = 0; tries < 6 && ns === slot; tries++) {
          const d = 1 + r.int(reach);
          ns = Math.max(0, Math.min(SLOTS.length - 1, slot + (r.chance(0.5) ? d : -d)));
        }
        if (ns === slot) b = { type: 'rest', slot };
        else { slot = ns; b = { type: 'step', slot }; }
      }
      if (b.type === 'step') lastStepAge = 0; else lastStepAge += 1;
      b.phrase = p; b.k = k;
      beats.push(b);
    }
  }
  return beats;
}
