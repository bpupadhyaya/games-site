// Text pages: How to Play, About and Rules. Every number comes from sim.js so the pages cannot drift from the engine.
import { SHIELD_WARN, REPAIR_MIN_ACC, TWO_STAR_ACC, PAR_SLACK, SCORE, LEVELS, MAX_W, MAX_H, KIND_INFO } from './sim.js';

const pct = (x) => `${Math.round(x * 100)} percent`;
const RAIN_FROM = LEVELS.findIndex((l) => l.rain) + 1;

export const HOWTO = [
  { title: 'Read the wall', art: 'mirrorV', text: [
    'The elder has already painted one part of the wall. Your job is to paint the rest so that the whole panel is symmetric. The brief at the top tells you which kind of symmetry the wall follows, and dashed marks on the wall show the line or the centre it works around.',
    'On the first walls, small coloured dots show the colour each empty cell needs. They go away as the walls get harder.',
  ] },
  { title: 'Paint with the brush', art: 'pots', text: [
    'Tap a pigment pot, then press on the wall and drag across cells to paint them. Every cell you touch takes the colour and uses one measure of pigment. Lift your finger to end the stroke.',
    'The pots hold only a little more than the wall needs, so paint cell by cell with care. The cloth wipes cells back to bare mud (the pigment is not returned). Undo takes back your last stroke and returns its pigment.',
    'Fewer, longer strokes score better: straight runs of one colour are the way.',
  ] },
  { title: 'The rain and the repair', art: 'rot2', text: [
    `From wall ${RAIN_FROM} the rain comes once you tap Done. A ring appears on a painted cell and a drop lands there a moment later. Tap the ring first and the cell is glazed and safe for this storm; if you are late, the drop washes the paint away.`,
    'When the sky clears, repaint what was washed (and any mistake you notice) from what is left in the pots, then tap Done again. The elder checks the wall cell by cell.',
  ] },
  { title: 'Think and learn', art: 'quad', text: [
    'Tap Think for the next stroke the pattern needs, with the reason: which cell of the elder\'s half it copies and how. Use this stroke paints it for you.',
    'Watch & Learn paints a whole wall for you and explains every stroke, with a real Pause so you can take your time.',
  ] },
];

export const ABOUT = [
  { title: 'The painted houses of Tiebele', art: 'quad', text: [
    'Tiebele (Tiebele, also written Tiébélé) is a village in southern Burkina Faso, home of the Kassena people. Its family compounds are known for walls painted in bold black, white and earth-coloured geometric patterns on a mud base.',
    'The paintings are traditionally made by the women of the household, using natural pigments from local earths, and are renewed after the rainy season. Each painted wall belongs to the family that made it.',
    'This game takes the craft as its inspiration: the bands, the symmetry and the care. The patterns in the game are original and abstract; they are not copies of any family\'s wall, and the game makes no claim to teach the meaning of any real design.',
  ] },
  { title: 'This version', text: [
    'Tiebele House Painting is part of the Arcforge collection of world heritage games. It has no betting and no stakes, works offline and saves your records on your device.',
    'The walls are generated from the pattern rules in the Rules pages, so every wall can be checked cell by cell. Text size can be set up to 300% in Settings and on every reading page.',
    'With respect to the Kassena people and to the families of Tiebele, whose living craft this game honours.',
  ] },
];

export const RULES = [
  { title: '1. The goal', art: 'mirrorV', text: [
    'A wall is a grid of cells, each either bare mud or painted white, black or red. The elder\'s half of the wall is painted. You paint the other cells so that every cell is the symmetric copy of the elder\'s cell it belongs to.',
    `Walls run from ${KIND_INFO.mirrorV.short.toLowerCase()} patterns on a small 6 by 4 panel up to panels as large as ${MAX_W} by ${MAX_H} cells with three pigments and rain.`,
  ] },
  { title: '2. The wall and the pigments', art: 'pots', text: [
    'There are three pigments: kaolin white, charcoal black and red earth; each wall uses one, two or three. The bare wall is mud, and bare is a colour too: a cell that must be bare has to be left bare or wiped.',
    'Each pot holds the pigment the wall needs, a small margin, and a reserve for the rain on walls with a storm. Each cell you paint uses one measure. Painting over a wrong cell uses a fresh measure. A pot with nothing left cannot paint.',
  ] },
  { title: '3. Painting', art: 'pots', text: [
    'Press on the wall and drag; every cell the brush passes over takes the current pigment (or is wiped with the cloth). A stroke runs from touch to lift. Painting a cell that already has that colour costs nothing.',
    `The cloth turns a cell back to bare mud. Undo takes back your last stroke and returns its pigment; the stroke still counts. Par is the number of strokes an expert needs: the fewest straight runs of one colour (${PAR_SLACK} times par earns three stars).`,
  ] },
  { title: '4. Mirrors', art: 'quad', text: [
    `${KIND_INFO.mirrorV.name}: the left half is the elder's; each cell on the right copies the cell the same distance from the middle line on the same row.`,
    `${KIND_INFO.mirrorH.name}: the same, using the horizontal middle line and the top half. ${KIND_INFO.quad.name}: the top-left quarter is the elder's and is mirrored across both middle lines.`,
    `${KIND_INFO.diag.name}: a square wall; the triangle on and below the diagonal is the elder's, and each cell above copies its mirror cell across the diagonal.`,
  ] },
  { title: '5. Turns', art: 'rot4', text: [
    `${KIND_INFO.rot2.name}: the left half is the elder's; the right half is that half turned round by half a turn about the centre. A cell in row 1 on the left lands in the last row on the right, so a half-turn is not a mirror.`,
    `${KIND_INFO.rot4.name}: a square wall; the top-left quarter is the elder's and is turned a quarter turn, a half turn and three quarters about the centre to fill the other three quarters.`,
  ] },
  { title: '6. Repeats', art: 'glide', text: [
    `${KIND_INFO.repeat.name}: the first band of columns, as wide as the first dashed line, is the elder's; each following band is a copy of it, unchanged.`,
    `${KIND_INFO.glide.name}: like a repeat, but every second band is flipped upside down, so the pattern appears to slide and turn over as it goes along the wall.`,
  ] },
  { title: '7. The rain and the repair', art: 'rot2', text: [
    `Walls with a storm start it when you tap Done twice (the first tap asks if you are sure). A ring shows where the next drop will land; it lands ${LEVELS.find((l) => l.rain).rain.warn} seconds later on the first storm wall, ${SHIELD_WARN} on the Daily Wall, and ${LEVELS[LEVELS.length - 1].rain.warn} on the hardest wall.`,
    'Tap near the ring before the drop lands and the cell is glazed: this storm cannot wash it. A missed drop wipes that cell back to mud; on later walls the run-off takes the cell below too. A glazed cell is only safe for this storm.',
    'When the rain ends the repair begins: paint what was washed from the pigment you have left, and tap Done to finish. There is no clock on the repair.',
  ] },
  { title: '8. Scoring and stars', art: 'mirrorH', text: [
    `The elder counts every cell of the wall that matches the pattern. Three stars: every cell right and no more than ${PAR_SLACK} times par plus one painting strokes. Two stars: at least ${pct(TWO_STAR_ACC)} of the cells right. One star: at least ${pct(REPAIR_MIN_ACC)}.`,
    `Score: ${SCORE.cell} per matching cell, ${SCORE.shield} per shielded drop, ${SCORE.strokeBonus} for each stroke under twice par, ${SCORE.pigment} per measure of pigment left, minus ${SCORE.repairStroke} for each repair stroke. Your best score for each wall is saved. A wall opens when you earn a star on the one before.`,
  ] },
  { title: '9. Daily Wall, Watch & Learn and simplifications', text: [
    'The Daily Wall is a new mid-to-hard wall every day, the same for everyone. Watch & Learn paints a wall for you with the same engine: it thinks, shows the stroke and paints it, shields drops with a human delay and repairs, and you can Pause at any moment.',
    'Real Tiebele walls are painted freehand, with raised relief borders, a glaze made from local plants and designs that belong to families. This game uses a grid, three pigments, original patterns and a simple storm so that the symmetry can be played and checked.',
  ] },
];

// 3D licence credits (view3d): appended to the last About page once the text is fetched (the page still shows without it).
export function loadCredits() {
  if (typeof fetch !== 'function' || typeof window === 'undefined') return;
  fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
    if (!t) return;
    const blocks = t.split(/\n{2,}/).map((x) => x.trim()).filter((x) => x && !x.startsWith('#') && !x.startsWith('MIT License')).slice(0, 14);
    const last = ABOUT[ABOUT.length - 1];
    if (!last.text.some((b) => b.startsWith('3D credits'))) { last.text.push('3D credits.'); for (const b of blocks) last.text.push(b.replace(/\s+/g, ' ')); }
  }).catch(() => {});
}
