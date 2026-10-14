// The canals. W is the width of the water from the board to the sand bed; L the pole length; xb where the pole stands (m from the board).
export const VENUES = [
  { id: 'ditch', name: 'Village Ditch', W: 14.5, L: 11, xb: 2.6, depth: 1.4, lean0: 0.26, thetaEnd: 1.25, sandH: 0.6, sandLen: 10, blurb: 'A narrow farm ditch. Short pole, short run.' },
  { id: 'canal', name: 'Reed Canal', W: 16.5, L: 12, xb: 3.0, depth: 1.6, lean0: 0.28, thetaEnd: 1.25, sandH: 0.6, sandLen: 11, blurb: 'The standard club canal between two polders.' },
  { id: 'mill', name: 'Windmill Cut', W: 18.5, L: 13, xb: 3.8, depth: 1.8, lean0: 0.28, thetaEnd: 1.25, sandH: 0.6, sandLen: 12, blurb: 'A wide cut with a mill on the far bank. The classic pole length.' },
  { id: 'big', name: 'Big Water', W: 20.5, L: 13.5, xb: 4.3, depth: 2.0, lean0: 0.28, thetaEnd: 1.25, sandH: 0.6, sandLen: 12, blurb: 'The widest canal on the circuit. Only a perfect jump carries.' },
];
export const venueById = (id) => VENUES.find((v) => v.id === id) || VENUES[1];

// where the pole is stood before the jump: nearer is safer, farther reaches more but needs a faster, cleaner run
export const STANDS = [
  { id: 0, name: 'Near mark', dx: -0.7, lean0: 0.18, note: 'Safest: the pole passes the upright easily, 0.7 m less reach' },
  { id: 1, name: 'Middle mark', dx: 0, lean0: 0.28, note: 'The usual place' },
  { id: 2, name: 'Far mark', dx: 0.7, lean0: 0.33, note: 'Longest reach, but the pole needs a fast run to get over' },
];
