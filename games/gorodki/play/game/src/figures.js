// The 15 figures of the town (the order is the ladder, easiest first). `bats` is how many bats a player gets for the figure. Each figure is a picture made of pins, written as rows from the far side
// to the near side; '#' is a pin, '.' is empty. `step` is the gap between neighbouring cells in metres (the pin is 0.11 m wide, so
// 0.22 m leaves a pin's width between neighbours). The picture is centred in the 2 m square of the town.
// Names are plain descriptions of the shape; the real game has many regional names for the same figures.
export const FIGURES = [
  { id: 'gate', bats: 3, name: 'Gate', step: 0.26, rows: ['#...#', '#...#', '#...#'], tip: 'Two posts of three. Sweep along one post, or drive between them.' },
  { id: 'cannon', bats: 4, name: 'Cannon', step: 0.24, rows: ['..#..', '..#..', '#.#.#'], tip: 'Three pins in a row and a wheel on each side. Take the barrel first.' },
  { id: 'tongs', bats: 3, name: 'Tongs', step: 0.23, rows: ['#...#', '.#.#.', '..#..', '..#..'], tip: 'The two arms meet at the handle: one strong hit at the joint sends both out.' },
  { id: 'fork', bats: 4, name: 'Fork', step: 0.23, rows: ['#.#.#', '#.#.#', '..#..'], tip: 'Three tines on one handle: a sweep from the side clears a tine at a time.' },
  { id: 'sickle', bats: 5, name: 'Sickle', step: 0.23, rows: ['.###.', '#...#', '#....', '#....', '.#...'], tip: 'A curve of pins, long and thin: a sweep along the curve takes the most.' },
  { id: 'well', bats: 4, name: 'Well', step: 0.3, rows: ['###', '#.#', '###'], tip: 'A ring of eight. There is no centre pin: hit the ring from the middle outwards.' },
  { id: 'arrow', bats: 3, name: 'Arrow', step: 0.23, rows: ['..#..', '.###.', '#.#.#', '..#..', '..#..', '..#..'], tip: 'The head is easy, the long shaft is not: save a bat for it.' },
  { id: 'chain', bats: 5, name: 'Chain', step: 0.22, rows: ['#.#.#.#.#', '.#.#.#.#.'], tip: 'A zigzag of nine across the whole square. Sweep it end to end.' },
  { id: 'star', bats: 5, name: 'Star', step: 0.25, rows: ['#.#.#', '.###.', '#.#.#'], tip: 'Nine pins close together: a hard drive into the centre scatters them all.' },
  { id: 'plane', bats: 5, name: 'Aeroplane', step: 0.23, rows: ['..#..', '#.#.#', '.###.', '..#..', '.#.#.'], tip: 'Wings across, body along: a drive down the body takes the wings with it.' },
  { id: 'crayfish', bats: 4, name: 'Crayfish', step: 0.23, rows: ['#.#.#', '.###.', '#.#.#', '..#..', '.#.#.'], tip: 'Two claws, a body and a tail. The claws fly far if the body goes first.' },
  { id: 'sentries', bats: 5, name: 'Sentries', step: 0.24, rows: ['#.#.#.#', '#.#.#.#', '#.#.#.#'], tip: 'Four tall columns: clear them from the side, one column per bat.' },
  { id: 'letter', bats: 6, name: 'Letter', step: 0.23, rows: ['#####', '#.#.#', '#####'], tip: 'An envelope of thirteen pins. Open it from the front edge.' },
  { id: 'window', bats: 5, name: 'Window', step: 0.23, rows: ['#####', '#...#', '#...#', '#...#', '#####'], tip: 'A frame of sixteen pins with an empty middle: use the corners.' },
  { id: 'rocket', bats: 5, name: 'Rocket', step: 0.22, rows: ['..#..', '.###.', '.#.#.', '.#.#.', '#####', '#.#.#'], tip: 'Sixteen pins in a tall shape. Plan two bats: the nose, then the base.' },
];

export const SPACE = 0.75;
export const figureById = (id) => FIGURES.find((f) => f.id === id);

// Pin positions of a figure in town coordinates: the square spans x -1..1 and z 0..2 (z grows away from the thrower).
export function figurePins(idx) {
  const f = FIGURES[idx];
  const rows = f.rows.length, cols = Math.max(...f.rows.map((r) => r.length));
  const pins = [];
  let id = 0;
  f.rows.forEach((row, ri) => {
    for (let ci = 0; ci < row.length; ci++) {
      if (row[ci] !== '#') continue;
      const x = (ci - (cols - 1) / 2) * f.step * SPACE;
      const z = 1.0 + ((rows - 1) / 2 - ri) * f.step * 1.05 * SPACE;   // first row is the far side
      pins.push({ id: id++, x: Math.round(x * 1000) / 1000, z: Math.round(z * 1000) / 1000 });
    }
  });
  return pins;
}
