// The models: authored step lists. A step is a fold (valley or mountain, which layers move), an unfold of the last fold (the crease
// stays in the paper) or a turn of the paper. Lines are in table coordinates (the whole sheet is 1 x 1, y down). Nothing is hand-timed:
// the engine in paper.js does the folding, so a model is just the lines, the words, the little decorations drawn on the finished model
// and (optionally) how the finished model stands up.
import { toward, along, newSheet, planFold, commitFold, turnSheet, revert, lastFold, bounds } from './paper.js';

const S2 = Math.SQRT1_2;
const rotator = (a) => { const c = Math.cos(a), s = Math.sin(a); return (x, y) => [c * x - s * y, s * x + c * y]; };

export const CHAPTERS = [
  { name: 'First folds', blurb: 'Straight, friendly folds. Learn the grab, the crease and the unfold.' },
  { name: 'Classics', blurb: 'Layers, turning the paper over and folding just the top sheets.' },
  { name: 'Challenge', blurb: 'More folds, more layers, and a model that stands up when you finish.' },
];

const fold = (spec, text, extra = {}) => ({ type: 'fold', spec, text, ...extra });
const unfold = (text) => ({ type: 'unfold', text });
const turn = (text) => ({ type: 'turn', text });

// ---- 1. kite --------------------------------------------------------------------------------------------------------------------
const kiteRot = Math.PI / 4, K = rotator(kiteRot);
const kiteP = K(-0.5 + S2, -0.5 + S2);
const KITE = {
  id: 'kite', name: 'Kite', chapter: 0, paper: 'waves', rot: kiteRot,
  blurb: 'Two edges to one crease: the first fold you ever learn.',
  steps: [
    fold(toward(K(-0.5, 0.5), K(0.5, -0.5)), 'Fold the paper in half corner to corner. Grab the left corner and drag it over to the right corner.'),
    unfold('Open it again. The fold leaves a crease down the middle.'),
    fold(toward(K(0.5, -0.5), kiteP), 'Fold the upper right edge onto the crease.'),
    fold(toward(K(-0.5, 0.5), kiteP), 'Fold the upper left edge onto the crease too. That is the kite.'),
  ],
  decals: [
    { t: 'line', pts: [K(-0.5, -0.5), K(0.5, 0.5)], c: 'rgba(255,248,230,0.85)', w: 0.006 },
    { t: 'line', pts: [[-0.4, 0.03], [0.4, 0.03]], c: 'rgba(255,248,230,0.85)', w: 0.006 },
    { t: 'tail', x: 0, y: 0.72, n: 4, c: '#d9482b', c2: '#f3b23a' },
  ],
  reveal: { cx: 0, cy: 0.35, w: 1.5, h: 2.1 },
  finish: 'A kite, ready to fly.',
};

// ---- 2. envelope ------------------------------------------------------------------------------------------------------------------
const E = rotator(Math.PI / 4);
const ENVELOPE = {
  id: 'envelope', name: 'Envelope', chapter: 0, paper: 'blossom', rot: Math.PI / 4,
  blurb: 'Four corners to the centre. A letter fold you can seal.',
  steps: [
    fold(toward(E(-0.5, 0.5), [0, 0]), 'Fold the left corner to the centre of the paper.'),
    fold(toward(E(0.5, 0.5), [0, 0]), 'Fold the bottom corner to the centre.'),
    fold(toward(E(0.5, -0.5), [0, 0]), 'Fold the right corner to the centre.'),
    fold(toward(E(-0.5, -0.5), [0, 0]), 'Fold the top corner to the centre. The four flaps meet.'),
  ],
  decals: [
    { t: 'dot', x: 0, y: 0, r: 0.07, c: '#c8362a', c2: 'rgba(0,0,0,0.25)' },
    { t: 'dot', x: 0, y: 0, r: 0.038, c: 'rgba(255,230,210,0.55)', ring: true },
    { t: 'line', pts: [[-0.26, 0.2], [-0.05, 0.2]], c: 'rgba(90,60,50,0.55)', w: 0.008 },
    { t: 'line', pts: [[-0.26, 0.26], [0.06, 0.26]], c: 'rgba(90,60,50,0.55)', w: 0.008 },
  ],
  finish: 'Sealed and ready to send.',
};

// ---- 3. house ---------------------------------------------------------------------------------------------------------------------------
const HOUSE = {
  id: 'house', name: 'House', chapter: 0, paper: 'stripes', rot: 0, back: '#b94a30',
  blurb: 'A crease down the middle, then two roof folds.',
  steps: [
    fold(toward([-0.5, 0], [0.5, 0]), 'Fold the paper in half, left to right.'),
    unfold('Open it. The middle crease will guide the roof.'),
    fold(toward([-0.5, -0.5], [0, 0]), 'Fold the top left corner to the middle of the paper to make half a roof.'),
    fold(toward([0.5, -0.5], [0, 0]), 'Now the top right corner. The roof is done.'),
  ],
  decals: [
    { t: 'rect', x: -0.07, y: 0.26, w: 0.14, h: 0.24, c: '#6b3a22', r: 0.02 },
    { t: 'dot', x: 0.045, y: 0.39, r: 0.009, c: '#f1c75b' },
    { t: 'rect', x: -0.38, y: 0.16, w: 0.15, h: 0.15, c: '#fbe8a8', r: 0.015, frame: '#6b3a22' },
    { t: 'rect', x: 0.23, y: 0.16, w: 0.15, h: 0.15, c: '#fbe8a8', r: 0.015, frame: '#6b3a22' },
    { t: 'rect', x: 0.2, y: -0.46, w: 0.09, h: 0.18, c: '#7c4a30', r: 0.01 },
  ],
  finish: 'Home sweet home.',
};

// ---- 4. puppy -------------------------------------------------------------------------------------------------------------------------
const R7 = S2;
const PUPPY = {
  id: 'puppy', name: 'Puppy', chapter: 1, paper: 'kraft', rot: Math.PI / 4, back: '#fbf1dc',
  blurb: 'A triangle, two floppy ears and a face.',
  steps: [
    fold(toward([0, -R7], [0, R7]), 'Fold the diamond in half: bring the top corner down to the bottom corner.'),
    fold(along([-0.3, 0], [-0.52, 0.22], [-R7, 0], { pick: { top: 1 } }), 'Fold the top layer of the left corner down to make a floppy ear.'),
    fold(along([0.3, 0], [0.52, 0.22], [R7, 0], { pick: { top: 1 } }), 'Fold the right corner down for the other ear.'),
  ],
  decals: [
    { t: 'dot', x: -0.13, y: 0.17, r: 0.032, c: '#2a2020' },
    { t: 'dot', x: 0.13, y: 0.17, r: 0.032, c: '#2a2020' },
    { t: 'dot', x: -0.12, y: 0.16, r: 0.01, c: '#ffffff' },
    { t: 'dot', x: 0.14, y: 0.16, r: 0.01, c: '#ffffff' },
    { t: 'dot', x: 0, y: 0.58, r: 0.04, c: '#2a2020' },
    { t: 'arc', x: 0, y: 0.5, r: 0.07, a0: 0.3, a1: 2.84, c: '#2a2020', w: 0.012 },
  ],
  finish: 'Say hello to your puppy.',
};

// ---- 5. samurai helmet ----------------------------------------------------------------------------------------------------------------
const HAT = {
  id: 'helmet', name: 'Samurai Helmet', chapter: 1, paper: 'hemp', rot: 0,
  blurb: 'Fold in half, tuck two corners, lift the brim.',
  steps: [
    fold(toward([0, -0.5], [0, 0.5], { tag: 'f' }), 'Fold the paper in half: top edge down to the bottom edge.'),
    fold(toward([-0.5, 0], [0, 0.5]), 'Fold the left corner down to the middle of the bottom edge. Both layers fold together.'),
    fold(toward([0.5, 0], [0, 0.5]), 'Fold the right corner down as well.'),
    fold(along([-0.5, 0.36], [0.5, 0.36], [0, 0.5], { pick: { top: 5 } }), 'Fold the bottom edge of the front layers up to make the brim.'),
  ],
  decals: [
    { t: 'arc', x: 0, y: 0.06, r: 0.17, a0: 3.7, a1: 5.72, c: '#e0b23c', w: 0.022 },
    { t: 'dot', x: 0, y: 0.1, r: 0.03, c: '#e0b23c' },
  ],
  finish: 'A helmet fit for a samurai.',
};

// ---- 6. dart ----------------------------------------------------------------------------------------------------------------------------
const nose = [0, -0.5];
const DART = {
  id: 'dart', name: 'Paper Dart', chapter: 2, paper: 'gold', rot: 0,
  blurb: 'The classic: nose corners in, edges in, then the wings.',
  steps: [
    fold(toward([-0.5, 0], [0.5, 0]), 'Fold the paper in half, left to right.'),
    unfold('Open it. The middle crease is the spine.'),
    fold(toward([-0.5, -0.5], [0, 0]), 'Fold the top left corner onto the middle crease.'),
    fold(toward([0.5, -0.5], [0, 0]), 'Fold the top right corner onto the middle crease.'),
    fold(toward([-0.5, 0], [0, -0.5 + Math.hypot(0.5, 0.5)]), 'Fold the long left edge onto the middle crease.'),
    fold(toward([0.5, 0], [0, -0.5 + Math.hypot(0.5, 0.5)]), 'Fold the long right edge onto the middle crease.'),
    fold(toward([0.5, 0], [-0.5, 0], { kind: 'mountain', tag: 'back' }), 'Fold the whole dart in half backwards along the spine.'),
    fold(along([0, -0.5], [-0.197, 0.5], [-0.4, 0.5], { pick: { not: 'back' }, tag: 'wA' }), 'Fold the front wing down: the long slanted edge goes onto the spine.'),
    turn('Turn the dart over. Press Turn over or swipe sideways.'),
    fold(along([0, -0.5], [0.197, 0.5], [0.4, 0.5], { pick: { tag: 'back' }, tag: 'wB' }), 'Fold the second wing down the same way. Open the wings and fly.'),
  ],
  decals: [],
  pose: [
    { a: [0, -0.5], n: [0.981, -0.193], tag: 'wA', angle: 1.3 },
    { a: [0, -0.5], n: [0.981, -0.193], tag: 'wB', angle: 1.3 },
    { a: [0, 0], n: [-1, 0], tag: 'back', angle: 2.0 },
  ],
  reveal: { cx: 0.1, cy: 0, w: 1.2, h: 1.1 },
  finish: 'Ready for take-off.',
};

// ---- 7. fish ----------------------------------------------------------------------------------------------------------------------------
const FISH = {
  id: 'fish', name: 'Fish', chapter: 1, paper: 'dots', rot: kiteRot, back: '#f3d9a4',
  blurb: 'A pointed kite body, a folded tail fin and two bright eyes.',
  steps: [
    fold(toward(K(-0.5, 0.5), K(0.5, -0.5)), 'Fold the paper in half corner to corner.'),
    unfold('Open it again. The crease is the fish backbone.'),
    fold(toward(K(0.5, -0.5), kiteP), 'Fold the upper right edge onto the backbone.'),
    fold(toward(K(-0.5, 0.5), kiteP), 'Fold the upper left edge onto the backbone too. The body is done.'),
    fold(toward([0, S2], [0, 0.36]), 'Fold the wide bottom corner up to make the tail fin.'),
  ],
  decals: [
    { t: 'dot', x: -0.1, y: -0.3, r: 0.034, c: '#ffffff' },
    { t: 'dot', x: 0.1, y: -0.3, r: 0.034, c: '#ffffff' },
    { t: 'dot', x: -0.095, y: -0.292, r: 0.018, c: '#1f2a3d' },
    { t: 'dot', x: 0.105, y: -0.292, r: 0.018, c: '#1f2a3d' },
  ],
  finish: 'It swims right off the table.',
};

export const MODELS = [KITE, ENVELOPE, HOUSE, PUPPY, HAT, DART, FISH];
export const modelById = (id) => MODELS.find((m) => m.id === id);

// ---- helpers shared by the game and the check scripts --------------------------------------------------------------------------------
// Replay a model up to (not including) step `k` and return the paper state.
export function stateAt(model, k) {
  let st = newSheet(model.rot ?? 0);
  for (let i = 0; i < k && i < model.steps.length; i++) st = applyStep(st, model.steps[i]);
  return st;
}
export function applyStep(st, step) {
  if (step.type === 'fold') return commitFold(st, planFold(st, step.spec));
  if (step.type === 'unfold') return revert(st, { keepCreases: true });
  if (step.type === 'turn') return turnSheet(st);
  return st;
}
export const finalState = (model) => stateAt(model, model.steps.length);
export { bounds, lastFold };
