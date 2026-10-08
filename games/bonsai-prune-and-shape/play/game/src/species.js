// Data: species, styles, pots and the eight commissions. Pure data, no drawing.
export const YEAR = 32, SEASON = 8;
export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
export const GROW = [1, 0.65, 0.16, 0];   // growth multiplier per season

export const SPECIES = {
  juniper: { name: 'Juniper', jp: 'Shimpaku', rate: 6.5, int: 13, lat: 0.62, budP: 0.55, up: 0.2, pad: 27, maxTrunk: 360, maxBr: 150, evergreen: true, leaf: 'scale',
    col: { spring: [120, 168, 96], summer: [58, 110, 82], autumn: [54, 104, 80], winter: [48, 92, 74] }, bark: [96, 70, 52], twig: [120, 92, 64] },
  maple: { name: 'Japanese maple', jp: 'Momiji', rate: 8, int: 15, lat: 0.6, budP: 0.6, up: 0.16, pad: 28, maxTrunk: 340, maxBr: 150, evergreen: false, leaf: 'maple',
    col: { spring: [150, 196, 96], summer: [70, 138, 70], autumn: [206, 62, 40], winter: [90, 70, 56] }, bark: [104, 84, 78], twig: [132, 104, 92] },
  pine: { name: 'Black pine', jp: 'Kuromatsu', rate: 7, int: 19, lat: 0.4, budP: 0.45, up: 0.14, pad: 29, maxTrunk: 380, maxBr: 170, evergreen: true, leaf: 'needle',
    col: { spring: [128, 176, 92], summer: [46, 104, 70], autumn: [42, 98, 68], winter: [40, 90, 66] }, bark: [74, 62, 56], twig: [104, 84, 66] },
  elm: { name: 'Zelkova', jp: 'Keyaki', rate: 7.5, int: 14, lat: 0.62, budP: 0.65, up: 0.22, pad: 25, maxTrunk: 340, maxBr: 140, evergreen: false, leaf: 'small',
    col: { spring: [166, 200, 100], summer: [84, 144, 62], autumn: [226, 168, 54], winter: [110, 96, 82] }, bark: [128, 112, 98], twig: [150, 130, 110] },
};

export const STYLES = {
  formal: { id: 'formal', name: 'Formal upright', jp: 'Chokkan', blurb: 'An upright, straight, tapering trunk with branches placed in a triangle, longest at the bottom and one apex on top.',
    pot: 'rect', goals: ['Keep the trunk straight and upright.', 'Make the crown a triangle: long low branches, shorter ones above.', 'Finish with one clear apex.'] },
  informal: { id: 'informal', name: 'Informal upright', jp: 'Moyogi', blurb: 'A trunk that curves in gentle S bends, with the apex coming back over the base.',
    pot: 'oval', goals: ['Bend the trunk two or three times.', 'Bring the apex back over the base of the trunk.', 'Leave gaps between the foliage clouds.'] },
  slanting: { id: 'slanting', name: 'Slanting', jp: 'Shakan', blurb: 'The whole trunk leans, as if bent by a steady wind, balanced by a low branch on the other side.',
    pot: 'round', goals: ['Lean the trunk between 22 and 48 degrees.', 'Keep one low branch reaching the opposite way.', 'Balance the weight of the foliage.'] },
  windswept: { id: 'windswept', name: 'Windswept', jp: 'Fukinagashi', blurb: 'Trunk and branches all swept to one side, as on an exposed coast.',
    pot: 'round', goals: ['Lean the trunk to one side.', 'Sweep most branches the same way.', 'Keep a few thin branches on the sheltered side.'] },
  cascade: { id: 'cascade', name: 'Cascade', jp: 'Kengai', blurb: 'The tree climbs, then spills over the pot rim and hangs below the base of the pot.',
    pot: 'tall', goals: ['Let the trunk rise first.', 'Wire the upper trunk over the rim and downward.', 'End the apex below the base of the pot.'] },
};

// Pots: w and d are world widths/depth in units; potRim = soil surface at y 0.
export const POTS = [
  { id: 'rect', name: 'Rectangle', w: 190, d: 62, kind: 'rect', glaze: [120, 88, 70], rim: [150, 114, 90] },
  { id: 'oval', name: 'Oval', w: 200, d: 66, kind: 'oval', glaze: [78, 104, 112], rim: [104, 136, 144] },
  { id: 'round', name: 'Round', w: 170, d: 78, kind: 'round', glaze: [126, 60, 46], rim: [160, 84, 62] },
  { id: 'tall', name: 'Cascade pot', w: 120, d: 150, kind: 'tall', glaze: [64, 80, 108], rim: [90, 110, 144] },
  { id: 'drum', name: 'Drum', w: 160, d: 72, kind: 'drum', glaze: [150, 138, 112], rim: [180, 168, 138] },
  { id: 'slab', name: 'Flat slab', w: 250, d: 34, kind: 'slab', glaze: [92, 92, 96], rim: [122, 122, 126] },
];
export const potById = (id) => POTS.find((p) => p.id === id) ?? POTS[0];

// sap: sapling shape (lean degrees, wobble, number of starter branches). years: how long you have.
export const COMMISSIONS = [
  { id: 'c1', name: 'First Juniper', species: 'juniper', style: 'formal', years: 3, seed: 1103, sap: { lean: 13, wob: 0.07, nb: 4 }, line: 'A straight young juniper. Learn to snip and pinch.' },
  { id: 'c2', name: 'Maple by the Window', species: 'maple', style: 'informal', years: 3, seed: 2207, sap: { lean: 8, wob: 0.1, nb: 4 }, line: 'Bend the trunk with wire, then let the leaves tell you the rest.' },
  { id: 'c3', name: 'Coast Pine', species: 'pine', style: 'slanting', years: 3, seed: 3311, sap: { lean: 9, wob: 0.07, nb: 4 }, line: 'A pine leaning from the sea wind.' },
  { id: 'c4', name: 'Storm Juniper', species: 'juniper', style: 'windswept', years: 3, seed: 4409, sap: { lean: 14, wob: 0.08, nb: 5 }, line: 'Sweep every branch the same way.' },
  { id: 'c5', name: 'Temple Maple', species: 'maple', style: 'formal', years: 3, seed: 5501, sap: { lean: 9, wob: 0.09, nb: 5 }, line: 'Straight and calm, a broadleaf this time.' },
  { id: 'c6', name: 'Cliff Pine', species: 'pine', style: 'cascade', years: 4, seed: 6607, sap: { lean: 38, wob: 0.06, nb: 4 }, line: 'It climbs, then falls over the rim.' },
  { id: 'c7', name: 'Garden Zelkova', species: 'elm', style: 'informal', years: 4, seed: 7703, sap: { lean: 12, wob: 0.12, nb: 5 }, line: 'Fine twigs, many choices.' },
  { id: 'c8', name: 'Mountain Cascade', species: 'juniper', style: 'cascade', years: 4, seed: 8819, sap: { lean: 42, wob: 0.08, nb: 5 }, line: 'The hardest curve of all.' },
];
export const commissionById = (id) => COMMISSIONS.find((c) => c.id === id) ?? COMMISSIONS[0];
