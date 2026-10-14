// The six courts of Kolf and the three venues they belong to. Each court is played both ways (out, then back), so a venue of
// two courts gives four legs. Authored with the tee end at y = 0 and the post at the far end; sim.compileCourt turns it round
// for the return leg. Distances are metres. `par` is the stroke count a good player needs (checked with the Champion rival).
export const VENUES = [
  { id: 'canal', name: 'The Frozen Canal', blurb: 'Long open ice between snowy banks. A fine place to learn.', courts: ['canal-run', 'lock-gate'] },
  { id: 'mill', name: 'Mill Pond', blurb: 'Bollards, a sledge crossing and a wind that never quite drops.', courts: ['bollard-field', 'windmill-reach'] },
  { id: 'harbour', name: 'Harbour Basin', blurb: 'Frozen boats, thin ice and the longest court of all.', courts: ['boat-yard', 'long-reach'] },
];

export const COURTS = [
  {
    id: 'canal-run', name: 'Canal Run', venue: 'canal', style: 'canal', W: 14, L: 84, a: { x: 7, y: 4 }, b: { x: 7, y: 80 },
    circles: [{ x: 4.2, y: 44, r: 0.7, kind: 'bollard' }, { x: 10.5, y: 62, r: 0.6, kind: 'bollard' }],
    snow: [{ x0: 8, x1: 14, y0: 28, y1: 38 }], wind: { ax: 0.08, ay: 0, gust: 0.4, per: 11 },
    tip: 'A long glide. Aim at the post and let the ice carry it; the snow patch slows anything that crosses it.',
  },
  {
    id: 'lock-gate', name: 'Lock Gate', venue: 'canal', style: 'canal', W: 18, L: 100, a: { x: 9, y: 4 }, b: { x: 13.5, y: 95 },
    boxes: [{ x0: 6, x1: 12.5, y0: 40, y1: 58, kind: 'barge' }],
    thin: [{ x0: 0, x1: 11, y0: 70, y1: 77 }], bridges: [{ x0: 3.5, x1: 6.5, y0: 69, y1: 78 }],
    snow: [{ x0: 12.5, x1: 18, y0: 20, y1: 30 }], circles: [{ x: 15.5, y: 84, r: 0.7, kind: 'bollard' }],
    wind: { ax: -0.1, ay: 0, gust: 0.4, per: 10 },
    tip: 'A frozen barge blocks the middle. Go round it, or bank off a board. Thin ice holds a fast ball: skim it or use the bridge.',
  },
  {
    id: 'bollard-field', name: 'Bollard Field', venue: 'mill', style: 'mill', W: 22, L: 96, a: { x: 4, y: 4 }, b: { x: 18, y: 91 },
    circles: [
      { x: 8, y: 22, r: 0.8, kind: 'bollard' }, { x: 15, y: 30, r: 0.8, kind: 'bollard' }, { x: 6, y: 44, r: 0.8, kind: 'bollard' },
      { x: 16, y: 60, r: 0.8, kind: 'bollard' }, { x: 9, y: 74, r: 0.8, kind: 'bollard' }, { x: 14.5, y: 85, r: 0.7, kind: 'bollard' },
    ],
    movers: [{ x: 11, y: 52, dx: 1, dy: 0, amp: 8, per: 8, ph: 0, r: 1, kind: 'sledge' }],
    wind: { ax: 0.14, ay: 0, gust: 0.5, per: 9 },
    tip: 'A field of mooring bollards and an ice sledge that sweeps across the middle. Time the stroke so the sledge is out of the way.',
  },
  {
    id: 'windmill-reach', name: 'Windmill Reach', venue: 'mill', style: 'mill', W: 18, L: 118, a: { x: 9, y: 4 }, b: { x: 9, y: 114 },
    thin: [{ x0: 3, x1: 15, y0: 52, y1: 80 }], bridges: [{ x0: 8, x1: 10.4, y0: 51, y1: 81 }],
    snow: [{ x0: 0, x1: 3, y0: 40, y1: 90 }, { x0: 15, x1: 18, y0: 40, y1: 90 }],
    movers: [{ x: 9, y: 30, dx: 1, dy: 0, amp: 6.5, per: 9, ph: 1, r: 1, kind: 'sledge' }],
    circles: [{ x: 6.8, y: 103, r: 0.7, kind: 'bollard' }, { x: 11.5, y: 98, r: 0.7, kind: 'bollard' }],
    wind: { ax: 0.26, ay: 0, gust: 0.5, per: 8 },
    tip: 'A crosswind and a pond of thin ice in the middle. A hard ball skims across; a soft one needs the narrow bridge.',
  },
  {
    id: 'boat-yard', name: 'Boat Yard', venue: 'harbour', style: 'harbour', W: 26, L: 100, a: { x: 13, y: 4 }, b: { x: 13, y: 95 },
    boxes: [{ x0: 3, x1: 9.5, y0: 30, y1: 38, kind: 'boat' }, { x0: 15.5, x1: 23, y0: 48, y1: 57, kind: 'boat' }, { x0: 4, x1: 10.5, y0: 66, y1: 74, kind: 'boat' }],
    circles: [{ x: 10.7, y: 90, r: 0.6, kind: 'bollard' }, { x: 15.3, y: 90, r: 0.6, kind: 'bollard' }],
    thin: [{ x0: 17, x1: 26, y0: 70, y1: 82 }], snow: [{ x0: 10, x1: 16, y0: 18, y1: 24 }],
    wind: { ax: -0.18, ay: 0, gust: 0.4, per: 10 },
    tip: 'Frozen boats make a chicane and two bollards guard the post. Bank off the boards to find the gap.',
  },
  {
    id: 'long-reach', name: 'The Long Reach', venue: 'harbour', style: 'harbour', W: 16, L: 140, a: { x: 8, y: 4 }, b: { x: 8, y: 136 },
    snow: [{ x0: 0, x1: 11, y0: 40, y1: 46 }, { x0: 5, x1: 16, y0: 92, y1: 98 }],
    thin: [{ x0: 5, x1: 16, y0: 66, y1: 80 }],
    movers: [{ x: 8, y: 108, dx: 1, dy: 0, amp: 5.5, per: 7, ph: 0.5, r: 1, kind: 'sledge' }],
    circles: [{ x: 11.5, y: 120, r: 0.7, kind: 'bollard' }, { x: 4.5, y: 127, r: 0.7, kind: 'bollard' }],
    wind: { ax: 0.2, ay: 0, gust: 0.5, per: 9 },
    tip: 'A very long court. Power only gets you so far on the ice: plan two or three strokes and keep clear of the snow strips.',
  },
];
export const COURT_BY_ID = Object.fromEntries(COURTS.map((c) => [c.id, c]));
export const VENUE_BY_ID = Object.fromEntries(VENUES.map((v) => [v.id, v]));

// A leg is one court played one way: { id: 'canal-run:0', court, dir, par }.
export const PARS = {};   // filled below from COURT_PARS
const COURT_PARS = { 'canal-run': [3, 3], 'lock-gate': [3, 3], 'bollard-field': [3, 3], 'windmill-reach': [3, 3], 'boat-yard': [3, 3], 'long-reach': [4, 4] };
export function legId(courtId, dir) { return `${courtId}:${dir}`; }
export function legsForVenue(venueId) {
  const out = [];
  const ids = venueId === 'cup' ? COURTS.map((c) => c.id) : VENUE_BY_ID[venueId].courts;
  for (const id of ids) for (const dir of [0, 1]) out.push({ id: legId(id, dir), court: id, dir, par: COURT_PARS[id][dir] });
  return out;
}
export function legById(id) {
  const [cid, d] = String(id).split(':');
  if (!COURT_BY_ID[cid] || (d !== '0' && d !== '1')) return null;
  return { id, court: cid, dir: Number(d), par: COURT_PARS[cid][Number(d)] };
}
export const ALL_LEGS = COURTS.flatMap((c) => [0, 1].map((d) => ({ id: legId(c.id, d), court: c.id, dir: d, par: COURT_PARS[c.id][d] })));
export function setPars(map) { for (const k of Object.keys(map)) COURT_PARS[k] = map[k]; for (const l of ALL_LEGS) l.par = COURT_PARS[l.court][l.dir]; }
