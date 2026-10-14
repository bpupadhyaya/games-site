// The five computer rivals. Same engine, same table, same paddle rules: they differ only in how fast their paddle may move,
// how late they see the puck, how accurately they aim, whether they use bank shots and how long they hesitate.
//   vmax    paddle speed limit (units/s)           lag     reaction delay in seconds
//   err     aim error (radians, roughly 1 sigma)   errPx   positioning error when blocking (units)
//   bank    chance to prefer a bank shot           dwell   [min,max] hesitation before a strike (seconds)
//   defY    how deep they stand when defending     punch   how hard they hit back (0..1)
//   feint   chance of a fake before a strike       think   [min,max] seconds before they serve
export const PROFILES = [
  { name: 'Staś', tag: 'Holiday-camp beginner', stars: 1, vmax: 300, lag: 0.30, err: 0.24, errPx: 70, bank: 0.0, dwell: [0.35, 0.8], defY: 250, punch: 0.45, feint: 0, think: [0.7, 1.4], attackSpeed: 180 },
  { name: 'Ola', tag: 'Tavern regular', stars: 2, vmax: 370, lag: 0.20, err: 0.13, errPx: 45, bank: 0.2, dwell: [0.25, 0.6], defY: 265, punch: 0.6, feint: 0.05, think: [0.5, 1.1], attackSpeed: 230 },
  { name: 'Kuba', tag: 'Summer champion', stars: 3, vmax: 440, lag: 0.15, err: 0.085, errPx: 34, bank: 0.35, dwell: [0.15, 0.45], defY: 280, punch: 0.75, feint: 0.15, think: [0.4, 0.9], attackSpeed: 280 },
  { name: 'Basia', tag: 'Club player', stars: 4, vmax: 510, lag: 0.11, err: 0.05, errPx: 22, bank: 0.5, dwell: [0.1, 0.3], defY: 290, punch: 0.88, feint: 0.25, think: [0.3, 0.7], attackSpeed: 330 },
  { name: 'Pan Marek', tag: 'Reigning table master', stars: 5, vmax: 580, lag: 0.075, err: 0.028, errPx: 14, bank: 0.62, dwell: [0.05, 0.2], defY: 300, punch: 1.0, feint: 0.35, think: [0.2, 0.5], attackSpeed: 380 },
];
