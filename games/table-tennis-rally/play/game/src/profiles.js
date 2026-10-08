// The opponents and the tournament ladder. Names are invented. Each opponent is a numeric profile the AI plays from.
//   level 1..10  : speed, reaction, consistency (see ai.js levelStats)
//   style        : which strokes it prefers (looper, chopper, blocker, hitter, pusher, lobber, allround)
//   aggression   : 0..1 how often it goes for a winner
//   place        : where it likes to put the ball: 'corners' | 'body' | 'cross' | 'mixed'
//   serve        : weights of [short, long, spin] serves
//   weak         : what it struggles with: 'backspin' | 'topspin' | 'wide' | 'short' | 'speed' | null
export const STYLES = {
  looper: { label: 'Looper', blurb: 'Heavy topspin, loves corners.' },
  chopper: { label: 'Chopper', blurb: 'Defends with heavy backspin.' },
  blocker: { label: 'Blocker', blurb: 'Quick blocks, redirects your pace.' },
  hitter: { label: 'Hitter', blurb: 'Flat and fast, goes for it.' },
  pusher: { label: 'Control', blurb: 'Short spinny balls, waits for errors.' },
  lobber: { label: 'Lobber', blurb: 'Sends high lobs back from far away.' },
  allround: { label: 'All-rounder', blurb: 'Mixes everything.' },
};

const P = (id, name, cc, hue, level, style, aggression, place, serve, weak, line) => ({ id, name, cc, hue, level, style, aggression, place, serve, weak, line });

export const OPPONENTS = [
  P('bennett', 'Oliver Bennett', 'GB', 210, 1, 'allround', 0.2, 'mixed', [3, 2, 1], 'speed', 'Friendly club coach. Rallies politely.'),
  P('tanaka', 'Aiko Tanaka', 'JP', 340, 2, 'pusher', 0.25, 'mixed', [5, 1, 2], 'backspin', 'Patient, tidy, and very short at the net.'),
  P('silva', 'Mateo Silva', 'BR', 140, 2, 'hitter', 0.5, 'corners', [1, 4, 1], 'wide', 'Swings hard, misses often.'),
  P('nair', 'Priya Nair', 'IN', 30, 3, 'blocker', 0.3, 'cross', [2, 2, 2], 'backspin', 'Solid wall. Waits for your mistake.'),
  P('eriksen', 'Lars Eriksen', 'SE', 205, 3, 'allround', 0.4, 'mixed', [2, 3, 2], 'topspin', 'Textbook strokes, no big weakness.'),
  P('haddad', 'Nadia Haddad', 'EG', 45, 4, 'looper', 0.55, 'corners', [2, 2, 3], 'short', 'Spins every ball hard.'),
  P('kim', 'Kim Joon-ho', 'KR', 355, 4, 'chopper', 0.25, 'body', [4, 1, 3], 'speed', 'Backspin wall from deep in the court.'),
  P('moretti', 'Sofia Moretti', 'IT', 120, 5, 'hitter', 0.65, 'cross', [1, 4, 2], 'backspin', 'Fast and flat. High risk, high reward.'),
  P('chen', 'Chen Ruo', 'CN', 5, 5, 'looper', 0.6, 'corners', [2, 2, 4], 'short', 'Spin merchant with a sharp serve.'),
  P('novak', 'Tomas Novak', 'CZ', 225, 6, 'blocker', 0.4, 'cross', [2, 3, 3], 'wide', 'Turns your power against you.'),
  P('okafor', 'Amara Okafor', 'NG', 95, 6, 'looper', 0.7, 'mixed', [2, 3, 3], 'backspin', 'Explosive. Attacks the very first ball.'),
  P('matsuda', 'Hiro Matsuda', 'JP', 320, 7, 'lobber', 0.3, 'mixed', [3, 2, 3], 'speed', 'Sends everything back, sky high.'),
  P('weber', 'Daniel Weber', 'DE', 190, 7, 'chopper', 0.35, 'corners', [4, 1, 3], 'speed', 'A wall of backspin. Patience wins.'),
  P('torres', 'Isabela Torres', 'MX', 60, 8, 'hitter', 0.75, 'corners', [1, 4, 3], 'wide', 'Blistering counter-attack.'),
  P('park', 'Park Seo-yeon', 'KR', 270, 8, 'blocker', 0.5, 'cross', [3, 2, 4], 'short', 'Quick hands, angles everywhere.'),
  P('dupont', 'Marcus Dupont', 'FR', 230, 9, 'allround', 0.6, 'mixed', [3, 3, 4], null, 'No weakness you can count on.'),
  P('kowalski', 'Anna Kowalski', 'PL', 150, 9, 'chopper', 0.45, 'corners', [4, 2, 4], 'wide', 'Defends everything, then strikes.'),
  P('lin', 'Lin Xiaoyu', 'CN', 350, 10, 'allround', 0.8, 'mixed', [3, 3, 5], null, 'The grand master. Reads every spin.'),
];
export const opponentById = (id) => OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[0];

// Six cups of three rounds. Each round: opponent, best-of.
export const CUPS = [
  { id: 'club', name: 'Club Cup', place: 'Neighbourhood hall', rounds: ['bennett', 'tanaka', 'silva'], bestOf: [1, 3, 3], hue: 145 },
  { id: 'city', name: 'City Open', place: 'Sports centre', rounds: ['nair', 'eriksen', 'haddad'], bestOf: [1, 3, 3], hue: 200 },
  { id: 'regional', name: 'Regional Masters', place: 'Indoor arena', rounds: ['kim', 'moretti', 'chen'], bestOf: [3, 3, 5], hue: 35 },
  { id: 'national', name: 'National Championship', place: 'Grand hall', rounds: ['novak', 'okafor', 'matsuda'], bestOf: [3, 5, 5], hue: 340 },
  { id: 'continental', name: 'Continental Series', place: 'Arena of nations', rounds: ['weber', 'torres', 'park'], bestOf: [3, 5, 5], hue: 270 },
  { id: 'world', name: 'World Tour Finals', place: 'The big stage', rounds: ['dupont', 'kowalski', 'lin'], bestOf: [5, 5, 5], hue: 50 },
];
export const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];

// Names for the other bracket places (shown in the bracket only; those matches are decided by a seeded draw).
export const FILLER = ['A. Rossi', 'K. Mbeki', 'H. Yamada', 'J. Alvarez', 'S. Petrov', 'M. Chowdhury', 'L. Fischer', 'T. Nguyen', 'D. Costa', 'R. Haddad', 'E. Larsen', 'Z. Ahmed', 'F. Moreau', 'P. Okoye', 'N. Ivanova', 'C. Duarte'];

// Level statistics the AI reads. Speeds are in sim metres per second (the game plays in slow motion on screen).
export function levelStats(level) {
  const L = Math.max(1, Math.min(10, level));
  return {
    speed: 2.1 + 0.46 * L,            // lateral paddle speed
    reaction: 0.36 - 0.027 * L,       // delay before it starts to move after your shot
    base: 0.42 + 0.052 * L,           // base stroke quality
    sigma: 0.22 - 0.016 * L,          // position-prediction error (m)
    reach: 0.115 + 0.006 * L,         // paddle reach (m)
    margin: 0.2 - 0.014 * L,          // how far from the line it aims
  };
}
