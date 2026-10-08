// The levels: each one is a sheet, the folds the player may use, and a REFERENCE list of punches run through the same engine as the player's
// cuts (so every target is reachable). Positions are written in the warped wedge (t = 0 at the centre .. 1 at the paper edge,
// f = 0 at the far mirror line .. 1 at the vertical mirror line) or in flat coordinates, and are turned into real punches here.
import { wedgePoint, punch, SHEETS } from './shapes.js';

// w(shape, t, f, size, turn?)  a punch placed in the warped wedge, turned to point outwards (turn = 0..7 overrides, +4 flips it inward)
// xy(shape, x, y, size, turn)  a punch at flat wedge coordinates
const w = (shape, t, f, z, turn) => ({ w: true, shape, t, f, z, turn });
const xy = (shape, x, y, z, turn = 0) => ({ w: false, shape, x, y, z, turn });

function realise(sheet, n, specs) {
  return specs.map((c) => {
    if (!c.w) return punch(c.shape, c.x, c.y, c.z, c.turn);
    const [x, y] = wedgePoint(sheet, n, c.t, c.f);
    let a = Math.atan2(x, -y), turn = Math.round(a / (Math.PI / 4));
    if (!x && !y) turn = 0;
    if (c.turn) turn += c.turn;
    return punch(c.shape, x, y, c.z, ((turn % 8) + 8) % 8);
  });
}

export const TRADITIONS = [
  { id: 'china', name: 'Jianzhi', place: 'China', icon: 'china', blurb: 'Jianzhi is the Chinese craft of cutting patterns from folded red paper with small scissors or a knife. Window flowers (chuanghua) are pasted on windows and lanterns for festivals: the paper is folded two, four or eight times so one careful snip repeats all around.' },
  { id: 'poland', name: 'Wycinanki', place: 'Poland', icon: 'poland', blurb: 'Wycinanki (vi-chee-NAHN-kee) are Polish folk paper cut-outs. Farm families cut trees of life, roosters, flowers and facing birds from paper folded in half, often in bright layered colours, using sheep shears.' },
  { id: 'mexico', name: 'Papel picado', place: 'Mexico', icon: 'mexico', blurb: 'Papel picado, "pierced paper", is Mexican cut tissue paper. Many sheets are stacked and tapped with chisels, then strung as colourful banners for fiestas, with scalloped borders, flowers, birds and suns.' },
  { id: 'snow', name: 'Paper snowflakes', place: 'Europe and the Americas', icon: 'snow', blurb: 'Paper snowflakes are cut from paper folded into six or twelve layers. Every real snowflake has six arms, so the paper is folded in thirds and then in half, and each snip on the wedge is repeated all around the star.' },
  { id: 'scherenschnitte', name: 'Scherenschnitte', place: 'Germany and Switzerland', icon: 'germany', blurb: 'Scherenschnitte, "scissor cuts", is the German and Swiss craft of cutting delicate silhouettes from one sheet of black paper, then mounting it on white. Hearts, leaves, trees and borders are folded in half so both sides match.' },
  { id: 'kirigami', name: 'Kirigami', place: 'Japan', icon: 'japan', blurb: 'Kirigami (from kiru, to cut, and kami, paper) is the Japanese art of cutting folded paper. White paper is folded into quarters or eighths and cut with sharp, clean lines into geometric lattices and blossoms.' },
];
export const traditionOf = (id) => TRADITIONS.find((t) => t.id === id);

export const CHAPTERS = [
  { id: 'first', name: 'First Snips', blurb: 'Learn how one cut repeats around the folds.', tradition: 'china' },
  { id: 'window', name: 'Window Flowers', blurb: 'Chinese jianzhi: red paper, lanterns and blossoms.', tradition: 'china' },
  { id: 'wycinanki', name: 'Wycinanki', blurb: 'Polish folk cut-outs folded in half.', tradition: 'poland' },
  { id: 'picado', name: 'Papel Picado', blurb: 'Mexican banners in tissue colours.', tradition: 'mexico' },
  { id: 'snow', name: 'Snowflakes and Stars', blurb: 'Six, ten and twelve layers.', tradition: 'snow' },
  { id: 'silhouette', name: 'Silhouettes and Kirigami', blurb: 'Black and white, German and Japanese.', tradition: 'scherenschnitte' },
];

// A level: ch chapter; sheet; ref = the fold order the reference was made with; folds = the orders the player may pick;
// paper; text = the caption shown while cutting (also the lesson); why = one line per reference cut for Watch & Learn.
const defs = [
  // ---------------------------------------------------------------------------------------------------------- chapter 1: first snips
  {
    id: 'half', ch: 0, name: 'Fold in Half', sheet: 'square', ref: 1, folds: [1], paper: 'red', tradition: 'china',
    text: 'Folded in half, every cut shows twice. A cut that touches the fold opens into one whole shape. Punch a circle on the fold and a petal away from it.',
    cuts: [xy('circle', -0.02, 0.0, 3, 0), xy('petal', -0.22, -0.26, 2, 7), xy('petal', -0.22, 0.26, 2, 5)],
    why: ['A circle on the fold line opens into one whole circle in the middle.', 'A petal away from the fold appears twice, mirrored.', 'The same snip, pointing the other way, makes the lower pair.'],
  },
  {
    id: 'quarter', ch: 0, name: 'Folded Twice', sheet: 'square', ref: 2, folds: [2], paper: 'red', tradition: 'china',
    text: 'Fold in quarters: one cut repeats four times. A cut on a fold edge opens into a whole shape; at the corner where the folds meet it becomes the centre.',
    cuts: [xy('circle', 0.0, 0.0, 2, 0), xy('petal', -0.3, 0.0, 2, 6), xy('petal', 0.0, -0.3, 2, 0), xy('diamond', -0.28, -0.28, 1, 7)],
    why: ['The corner where the folds meet becomes the centre of the sheet.', 'A petal on the lower fold edge opens into a petal on both sides.', 'A petal on the right fold edge opens into one above and one below.', 'A diamond away from both folds is repeated at all four corners.'],
  },
  {
    id: 'eighth', ch: 0, name: 'Eight Layers', sheet: 'square', ref: 4, folds: [4], paper: 'red', tradition: 'china',
    text: 'Fold in eighths: one wedge makes eight copies. Cut a petal along the middle of the wedge and the paper blooms into a flower.',
    cuts: [w('circle', 0.0, 0.5, 2), w('petal', 0.5, 0.5, 3), w('tri', 1.0, 0.5, 2, 4)],
    why: ['A circle at the point where all the folds meet makes the centre.', 'A petal down the middle of the wedge becomes eight petals around the centre.', 'A triangle snipped from the paper edge scallops all eight edges.'],
  },
  {
    id: 'edge', ch: 0, name: 'Edge Lace', sheet: 'square', ref: 4, folds: [2, 4], paper: 'red', tradition: 'china',
    text: 'Snips that start at the paper edge make lace. Cut notches into the outer edge of the wedge.',
    cuts: [w('tri', 0.96, 0.25, 2, 4), w('tri', 0.96, 0.75, 2, 4), w('diamond', 0.7, 0.5, 2), w('circle', 0.4, 0.5, 1)],
    why: ['A triangle notch on the edge makes a zigzag.', 'Another notch on the other side of the wedge fills the gaps.', 'A diamond inside the wedge becomes eight diamonds.', 'A small circle beside it adds a ring of eight dots.'],
  },
  {
    id: 'choose', ch: 0, name: 'Choose the Fold', sheet: 'square', ref: 4, folds: [1, 2, 4], paper: 'red', tradition: 'china',
    text: 'This time you choose the fold. A pattern with eight petals needs a wedge with eight layers: fewer folds mean more cuts.',
    cuts: [w('petal', 0.62, 0.5, 3), w('petal', 0.28, 0.5, 1, 4)],
    why: ['One big petal on an eight-layer wedge makes eight petals.', 'A small inverted petal near the centre makes the inner star.'],
  },
  // ---------------------------------------------------------------------------------------------------------- chapter 2: window flowers
  {
    id: 'lotus', ch: 1, name: 'Lotus Window', sheet: 'square', ref: 4, folds: [2, 4], paper: 'crimson', tradition: 'china',
    text: 'A lotus-style window flower: a ring of tall petals, a ring of small ones between them and a bright centre.',
    cuts: [w('circle', 0.0, 0.5, 1), w('petal', 0.42, 0.0, 1), w('petal', 0.42, 1.0, 2), w('petal', 0.75, 0.5, 3), w('drop', 0.97, 0.0, 1, 4)],
    why: ['A small circle makes the heart.', 'A petal on one fold edge opens into a whole petal.', 'A petal on the other fold edge adds the second ring.', 'A tall petal in the middle of the wedge makes the big outer petals.', 'A drop at the paper edge adds the scalloped rim.'],
  },
  {
    id: 'lantern', ch: 1, name: 'Lantern Lattice', sheet: 'square', ref: 4, folds: [2, 4], paper: 'red', tradition: 'china',
    text: 'Window lattices are made of diamonds and circles. Build a lantern grid with a few repeated cuts.',
    cuts: [w('diamond', 0.35, 0.5, 1), w('diamond', 0.72, 0.5, 1), w('circle', 0.55, 0.12, 1), w('circle', 0.55, 0.88, 1), w('tri', 1.0, 0.5, 2, 4)],
    why: ['The first diamond of the lattice.', 'A second diamond further out.', 'Small circles between them.', 'Matching circles on the other side.', 'A triangle notch finishes the edge.'],
  },
  {
    id: 'butterfly', ch: 1, name: 'Butterfly', sheet: 'square', ref: 1, folds: [1], paper: 'gold', tradition: 'china',
    text: 'Fold in half and cut one wing: the fold becomes the butterfly\'s body.',
    cuts: [xy('petal', -0.17, -0.17, 3, 7), xy('petal', -0.3, -0.08, 2, 6), xy('petal', -0.19, 0.13, 2, 5), xy('drop', -0.1, 0.27, 1, 4), xy('petal', -0.06, -0.37, 0, 7), xy('circle', -0.4, -0.3, 1, 0)],
    why: ['The big upper wing is a long petal swept up and away from the body.', 'A second petal spreads the upper wing outwards.', 'The lower wing is a shorter petal pointing down.', 'A small drop finishes the lower wing.', 'A thin petal makes the feeler.', 'A small circle decorates the wing tip.'],
  },
  {
    id: 'peony', ch: 1, name: 'Peony', sheet: 'square', ref: 4, folds: [4], paper: 'red', tradition: 'china',
    text: 'Layered round petals: moons, circles and petals build a full peony.',
    cuts: [w('moon', 0.3, 0.5, 1), w('circle', 0.58, 0.5, 2), w('moon', 0.82, 0.0, 1), w('petal', 0.9, 0.7, 2), w('circle', 0.12, 0.5, 1)],
    why: ['A crescent makes the first curl of petals.', 'A circle forms the round middle ring.', 'A crescent on the fold edge opens into a full moon shape.', 'A petal fills the gap at the outer edge.', 'A small circle ends the heart of the flower.'],
  },
  {
    id: 'fish', ch: 1, name: 'Scale Border', sheet: 'banner', ref: 2, folds: [1, 2], paper: 'crimson', tradition: 'china',
    text: 'Fish scales are a lucky Chinese pattern. Fold the banner in quarters and cut rows of crescents.',
    cuts: [xy('moon', -0.12, -0.12, 2, 6), xy('moon', -0.3, -0.12, 2, 6), xy('moon', -0.2, -0.28, 2, 6), xy('moon', -0.4, -0.27, 1, 6), xy('circle', -0.03, -0.3, 1, 0)],
    why: ['A crescent near the middle repeats in all four quarters.', 'A second crescent beside it starts the row.', 'A crescent in the next row fits between them like a scale.', 'A smaller one near the edge.', 'A circle on the fold edge opens into one whole round hole.'],
  },
  // ---------------------------------------------------------------------------------------------------------- chapter 3: wycinanki
  {
    id: 'tree', ch: 2, name: 'Tree of Life', sheet: 'square', ref: 1, folds: [1], paper: 'poppy', tradition: 'poland',
    text: 'The tree of life: leaves climb both sides of the fold, with berries above. Fold in half and cut half a tree.',
    cuts: [xy('petal', -0.17, 0.3, 2, 6), xy('petal', -0.18, 0.08, 2, 6), xy('petal', -0.17, -0.14, 2, 7), xy('drop', -0.06, -0.34, 2, 0), xy('circle', -0.3, -0.34, 1, 0)],
    why: ['The lowest leaf points out from the trunk.', 'The next leaf up.', 'The leaves climb and tilt upwards.', 'A drop at the top is the crown.', 'A berry beside the crown.'],
  },
  {
    id: 'leluja', ch: 2, name: 'Leluja Flower', sheet: 'square', ref: 2, folds: [2], paper: 'forest', tradition: 'poland',
    text: 'A four-way folk flower folded twice: petals on the fold edges, a ring of drops and a round centre.',
    cuts: [xy('circle', 0.0, 0.0, 1, 0), xy('drop', -0.2, 0.0, 2, 6), xy('drop', 0.0, -0.2, 2, 0), xy('circle', -0.3, -0.3, 2, 0), xy('petal', -0.42, 0.0, 1, 6), xy('petal', 0.0, -0.42, 1, 0)],
    why: ['The centre of the flower.', 'A drop on the lower fold edge opens into a petal on each side.', 'A drop on the right fold edge makes the other pair.', 'A large circle in the corner repeats at all four corners.', 'A small petal edges the left side.', 'A small petal edges the top.'],
  },
  {
    id: 'birds', ch: 2, name: 'Facing Birds', sheet: 'square', ref: 1, folds: [1], paper: 'cobalt', tradition: 'poland',
    text: 'Two birds face each other across the fold. Cut one bird: a body, a head and a tail.',
    cuts: [xy('drop', -0.24, 0.05, 2, 6), xy('tri', -0.1, 0.03, 0, 2), xy('petal', -0.25, -0.1, 1, 7), xy('circle', -0.4, -0.3, 1, 0), xy('tri', -0.17, -0.36, 1, 0)],
    why: ['A drop pointing away from the fold is the bird\'s body, its round chest facing the fold.', 'A tiny triangle is the beak, pointing at the fold.', 'A petal angled up is the wing.', 'A circle in the corner is a berry for the birds.', 'A triangle above is a sprig between them.'],
  },
  {
    id: 'rosette', ch: 2, name: 'Folk Rosette', sheet: 'square', ref: 4, folds: [4], paper: 'forest', tradition: 'poland',
    text: 'A round rosette cut from a wedge: drops pointing inwards and outwards, circles and a scalloped rim.',
    cuts: [w('drop', 0.32, 0.5, 1, 4), w('drop', 0.62, 0.5, 2), w('circle', 0.5, 0.0, 1), w('circle', 0.5, 1.0, 1), w('tri', 1.0, 0.5, 1, 4)],
    why: ['A drop pointing inwards near the centre.', 'A drop pointing outwards further along.', 'A circle on one fold edge opens into a whole circle.', 'A circle on the other fold edge makes the second ring.', 'A small notch on the edge finishes the rosette.'],
  },
  // ---------------------------------------------------------------------------------------------------------- chapter 4: papel picado
  {
    id: 'flecos', ch: 3, name: 'Scalloped Border', sheet: 'banner', ref: 2, folds: [1, 2], paper: 'pink', tradition: 'mexico',
    text: 'The scalloped border: a row of small shapes cut along the top edge. Fold the banner in quarters so each snip repeats.',
    cuts: [xy('circle', -0.4, -0.35, 1, 0), xy('circle', -0.2, -0.35, 1, 0), xy('circle', 0.0, -0.35, 1, 0), xy('petal', -0.3, -0.25, 1, 4), xy('petal', -0.1, -0.25, 1, 4)],
    why: ['A circle on the top edge becomes a scallop.', 'A second scallop further along.', 'A scallop on the right fold edge opens into one in the middle.', 'A petal points down between the scallops.', 'The second hanging petal.'],
  },
  {
    id: 'sol', ch: 3, name: 'Sol', sheet: 'banner', ref: 2, folds: [2], paper: 'orange', tradition: 'mexico',
    text: 'A sun in the middle of the banner: a round face and rays all around.',
    cuts: [xy('circle', 0.0, 0.0, 2, 0), xy('tri', -0.18, 0.0, 1, 6), xy('tri', 0.0, -0.18, 1, 0), xy('petal', -0.34, -0.1, 1, 6), xy('petal', -0.12, -0.28, 1, 0)],
    why: ['The round face of the sun at the corner where the folds meet.', 'A ray pointing left.', 'A ray pointing up.', 'Wavy rays between them.', 'More rays in the other gap.'],
  },
  {
    id: 'vine', ch: 3, name: 'Flower Vine', sheet: 'banner', ref: 1, folds: [1], paper: 'turquoise', tradition: 'mexico',
    text: 'A vine of leaves and flowers cut from a banner folded in half.',
    cuts: [xy('petal', -0.09, -0.26, 1, 7), xy('petal', -0.09, 0.26, 1, 5), xy('petal', -0.22, -0.13, 1, 7), xy('petal', -0.22, 0.13, 1, 5), xy('circle', -0.38, 0.0, 1, 0), xy('drop', -0.04, 0.0, 1, 6)],
    why: ['A leaf climbs the vine at the top.', 'A leaf at the bottom.', 'A second leaf up.', 'A second leaf down.', 'A bud at the end of the vine.', 'A drop on the fold opens into one whole flower.'],
  },
  {
    id: 'pajaros', ch: 3, name: 'Flying Birds', sheet: 'banner', ref: 2, folds: [1, 2], paper: 'yellow', tradition: 'mexico',
    text: 'Four birds in flight, one in each corner of the banner.',
    cuts: [xy('drop', -0.2, -0.17, 2, 6), xy('tri', -0.065, -0.185, 0, 2), xy('petal', -0.2, -0.28, 1, 7), xy('circle', -0.42, -0.3, 1, 0)],
    why: ['A drop pointing away from the fold is the body of the bird, its chest toward the middle of the banner.', 'A tiny triangle is the beak.', 'A petal angled up is the wing.', 'A circle in the corner: a sun behind the birds.'],
  },
  // ---------------------------------------------------------------------------------------------------------- chapter 5: snowflakes and stars
  {
    id: 'snow1', ch: 4, name: 'First Snowflake', sheet: 'hex', ref: 6, folds: [3, 6], paper: 'white', tradition: 'snow',
    text: 'A six-armed snowflake: fold the hexagon in half and in thirds (x12) and snip the wedge.',
    cuts: [w('petal', 0.55, 0.5, 1), w('tri', 0.95, 0.5, 2, 4), w('circle', 0.25, 0.5, 1)],
    why: ['A petal down the wedge becomes the six arms with two sides each.', 'A triangle notch on the tips makes forked ends.', 'A small circle opens into a little ring in the middle.'],
  },
  {
    id: 'fern', ch: 4, name: 'Frost Fern', sheet: 'hex', ref: 6, folds: [6], paper: 'cobalt', tradition: 'snow',
    text: 'Frost makes feathery ferns on cold glass. Snip small angled branches along the wedge.',
    cuts: [w('tri', 0.4, 0.2, 0, 5), w('tri', 0.4, 0.8, 1, 3), w('tri', 0.65, 0.2, 1, 5), w('tri', 0.65, 0.8, 0, 3), w('drop', 0.95, 0.5, 1, 4)],
    why: ['A branch snipped to one side.', 'A matching branch on the other side.', 'A longer branch further out.', 'Its partner.', 'A drop at the tip.'],
  },
  {
    id: 'star6', ch: 4, name: 'Six-Point Star', sheet: 'hex', ref: 3, folds: [3, 6], paper: 'gold', tradition: 'snow',
    text: 'Fold in sixths for a six-point star with a flower in the middle.',
    cuts: [w('petal', 0.4, 0.5, 1), w('moon', 0.78, 0.5, 1), w('circle', 0.12, 0.5, 1)],
    why: ['A petal on the middle of the wedge makes six petals.', 'A crescent further out makes the star points.', 'A circle makes the heart of the flower.'],
  },
  {
    id: 'plum', ch: 4, name: 'Plum Blossom', sheet: 'pent', ref: 5, folds: [5], paper: 'pink', tradition: 'china',
    text: 'The plum blossom has five petals. Fold the pentagon into ten layers and cut one petal.',
    cuts: [w('circle', 0.55, 0.5, 1), w('circle', 0.1, 0.5, 1), w('drop', 0.92, 0.5, 1, 4)],
    why: ['A round petal becomes five petals (ten halves).', 'A small circle makes the centre.', 'A drop at the edge pierces between the petals.'],
  },
  {
    id: 'star10', ch: 4, name: 'Ten-Point Star', sheet: 'pent', ref: 5, folds: [1, 5], paper: 'turquoise', tradition: 'snow',
    text: 'A ten-point star: petals and diamonds around a pentagon.',
    cuts: [w('diamond', 0.42, 0.5, 1), w('petal', 0.78, 0.5, 2), w('tri', 1.0, 0.0, 1, 4)],
    why: ['A diamond makes ten diamonds around the middle.', 'A petal makes the ten rays.', 'A triangle on the edge sharpens the points.'],
  },
  // ---------------------------------------------------------------------------------------------------------- chapter 6: silhouettes and kirigami
  {
    id: 'heart', ch: 5, name: 'Heart Silhouette', sheet: 'square', ref: 1, folds: [1], paper: 'black', tradition: 'scherenschnitte',
    text: 'The folded heart: two round lobes meet on the fold above a big triangle, with a leaf in each corner.',
    cuts: [xy('circle', -0.085, -0.1, 2, 0), xy('tri', 0.0, 0.0, 3, 4), xy('petal', -0.3, 0.32, 1, 5), xy('petal', -0.3, -0.32, 1, 7)],
    why: ['A circle beside the fold is one lobe of the heart; its mirror image is the other.', 'A big triangle pointing down, centred on the fold, makes the point of the heart.', 'A leaf in the lower corner.', 'A leaf in the upper corner.'],
  },
  {
    id: 'oak', ch: 5, name: 'Oak Border', sheet: 'banner', ref: 1, folds: [1, 2], paper: 'black', tradition: 'scherenschnitte',
    text: 'A border of oak leaves and acorns along a banner folded in half.',
    cuts: [xy('petal', -0.3, -0.24, 2, 2), xy('petal', -0.3, 0.24, 2, 2), xy('circle', -0.1, -0.1, 1, 0), xy('circle', -0.1, 0.1, 1, 0), xy('drop', -0.42, 0.0, 1, 6)],
    why: ['An oak leaf on top.', 'Another one below.', 'An acorn.', 'The second acorn.', 'A drop at the edge.'],
  },
  {
    id: 'lattice', ch: 5, name: 'Kirigami Lattice', sheet: 'square', ref: 4, folds: [2, 4], paper: 'snow', tradition: 'kirigami',
    text: 'Clean geometry: diamonds and triangles from a white square folded in eighths.',
    cuts: [w('diamond', 0.28, 0.5, 1), w('tri', 0.6, 0.5, 2, 4), w('diamond', 0.82, 0.5, 2), w('circle', 0.5, 0.0, 1)],
    why: ['A small diamond near the centre.', 'A triangle pointing inwards.', 'A diamond further out.', 'A circle on the fold edge opens into a whole round hole.'],
  },
];

export const LEVELS = defs.map((d) => ({ ...d, cuts: realise(d.sheet, d.ref, d.cuts), par: d.cuts.length, hint: d.why.length }));
export const levelIndex = (id) => LEVELS.findIndex((l) => l.id === id);
export const levelsIn = (ch) => LEVELS.map((l, i) => ({ l, i })).filter((x) => x.l.ch === ch);
export { SHEETS };
