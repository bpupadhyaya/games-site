// The computer piper (Watch & Learn, the menu backdrop) and the coach (Think). Both read the same plan(): what the piper does
// about its air right now, so the explanation always matches what the driver then does.
import { PACES, WIN } from './sim.js';
import { LANE_NAMES, TUNES } from './tunes.js';

export const PROFILES = [
  { name: 'Apprentice', sigma: 0.06, slip: 0.09, thr: 0.5, aim: 0.95 },
  { name: 'Piper', sigma: 0.035, slip: 0.03, thr: 0.4, aim: 0.92 },
  { name: 'Master piper', sigma: 0.02, slip: 0.008, thr: 0.34, aim: 0.88 },
];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The next note still to be played and how long until it is due (seconds, from now).
export function nextNote(S) {
  for (let i = S.cur; i < S.notes.length; i++) if (S.notes[i].st === 0) return { n: S.notes[i], in: S.notes[i].at - S.t };
  return null;
}
// How long a squeeze from the current air to `aim` takes.
const need = (S, aim) => Math.max(0, aim - S.air) / PACES[S.pace].refill;

// plan(S, prof) -> { kind: 'squeeze' | 'urgent' | 'play' | 'rest', gap, why }
export function plan(S, prof) {
  const nx = nextNote(S), gap = nx ? nx.in : 9;
  const nd = need(S, prof.aim);
  if (S.air <= 0.1 && S.t > 2) return { kind: 'urgent', gap, nd };
  if (S.squeeze && S.air < prof.aim && gap > 0.12 + 0.03) return { kind: 'squeeze', gap, nd };
  if (S.air < prof.thr && gap > Math.min(nd, 0.45) + 0.16) return { kind: 'squeeze', gap, nd };
  return { kind: gap > 0.9 ? 'rest' : 'play', gap, nd };
}

export function createDriver(prof, rng) {
  const off = new Map();                               // note index -> planned press offset (seconds), or null (the piper slips)
  const pressed = new Set();
  return {
    prof,
    cmd(S) {
      const out = { press: [], breath: false };
      const p = plan(S, prof);
      out.breath = p.kind === 'squeeze' || p.kind === 'urgent';
      if (p.kind === 'urgent') return out;
      // choose offsets lazily
      for (let i = S.cur; i < S.notes.length; i++) {
        const n = S.notes[i];
        if (n.at - S.t > 0.5) break;
        if (n.st !== 0) continue;
        if (!off.has(i)) off.set(i, rng.next() < prof.slip ? null : clamp((rng.next() + rng.next() + rng.next() - 1.5) * 1.6 * prof.sigma, -WIN.good * 0.8, WIN.good * 0.8));
        const o = off.get(i);
        if (o === null || pressed.has(i)) continue;
        if (S.t >= n.at + o) {
          if (S.squeeze) { out.breath = false; }       // let go of the breath pad to speak
          out.press.push(n.lane); pressed.add(i);
        }
      }
      if (out.press.length) out.breath = false;
      return out;
    },
  };
}

const pct = (v) => `${Math.round(v * 100)}%`;
// Returns { key, title, text, breath: boolean, lanes: [lane...] } for Think and Watch & Learn.
export function advice(S, prof) {
  const p = plan(S, prof), nx = nextNote(S);
  const lanes = nx ? S.notes.filter((n) => n.st === 0 && Math.abs(n.at - nx.n.at) < 0.02).map((n) => n.lane) : [];
  const nm = lanes.map((l) => LANE_NAMES[l]).join(' and ');
  const air = pct(S.air);
  if (p.kind === 'urgent') return { key: 'urgent', title: 'Breathe now', breath: true, lanes: [], text: `The air is almost gone (${air}). Squeeze right now and give up a note or two: a silent drone ends the whole tune.` };
  if (p.kind === 'squeeze') return { key: 'squeeze', title: 'Squeeze in the gap', breath: true, lanes: [], text: `Air is ${air} and the next note is ${p.gap.toFixed(1)} s away: long enough to squeeze back up before it. Hold the breath pad now; the reeds are silent while the cheeks work.` };
  if (p.kind === 'rest') return { key: 'rest', title: 'A rest is coming', breath: false, lanes, text: `Air is ${air}. Nothing is due for ${p.gap.toFixed(1)} s. ${S.air < 0.75 ? 'That is a good place to squeeze.' : 'The cheeks are nearly full, so just keep the drone steady.'}` };
  return { key: 'play', title: 'Keep the notes coming', breath: false, lanes, text: `Air is ${air}: enough for now. ${nm ? `Next: ${nm}.` : ''} Watch for the next rest and breathe there; every note costs a little air.` };
}
export const tuneBlurb = (i) => TUNES[i].blurb;
