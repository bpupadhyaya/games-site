// The five rivals and the cooperative partner. Every number is a human limit, not a cheat: how fast they run, how
// long they take to react, how well they judge the ball, how steady their swing timing and aim are, and what they like to do.
//   speed   running speed (m/s)          react   seconds before they start moving
//   sigP    ball-reading error (m)       sigT    swing timing wobble (s)       sigX  aim wobble (m)
//   aggr    liking for fast, high contact (0..1)      risk  willingness to aim near the lines (0..1)
//   habit   favourite side, -1 left .. 1 right      slip  chance of a poor decision per ball     nerves  extra wobble in long rallies
export const PROFILES = [
  { id: 'noa', name: 'Noa', tag: 'Easygoing', stars: 1, speed: 3.3, react: 0.40, sigP: 0.50, sigT: 0.075, sigX: 0.85, aggr: 0.05, risk: 0.05, habit: 0.25, slip: 0.08, nerves: 0.5 },
  { id: 'eli', name: 'Eli', tag: 'Steady', stars: 2, speed: 3.7, react: 0.32, sigP: 0.38, sigT: 0.060, sigX: 0.65, aggr: 0.2, risk: 0.2, habit: -0.3, slip: 0.06, nerves: 0.4 },
  { id: 'maya', name: 'Maya', tag: 'Fast feet', stars: 3, speed: 4.5, react: 0.27, sigP: 0.30, sigT: 0.050, sigX: 0.55, aggr: 0.35, risk: 0.3, habit: 0.15, slip: 0.045, nerves: 0.3 },
  { id: 'gal', name: 'Gal', tag: 'Tricky placement', stars: 4, speed: 4.0, react: 0.24, sigP: 0.22, sigT: 0.040, sigX: 0.40, aggr: 0.45, risk: 0.6, habit: -0.1, slip: 0.035, nerves: 0.25 },
  { id: 'shira', name: 'Shira', tag: 'Relentless', stars: 5, speed: 4.7, react: 0.20, sigP: 0.16, sigT: 0.032, sigX: 0.32, aggr: 0.6, risk: 0.5, habit: 0.0, slip: 0.025, nerves: 0.15 },
];
// The cooperative partner: friendly, quick, and she adapts to how the player is doing.
export const PARTNER = { id: 'dana', name: 'Dana', tag: 'Rally partner', stars: 3, speed: 4.4, react: 0.20, sigP: 0.16, sigT: 0.035, sigX: 0.30, aggr: 0.0, risk: 0.0, habit: 0, slip: 0.012, nerves: 0.1 };
// Used for hints and for Watch & Learn: almost no wobble, so the plan it shows is the best one it can find.
export const COACH = { id: 'coach', name: 'Coach', tag: 'Plans', stars: 5, speed: 4.7, react: 0.12, sigP: 0.04, sigT: 0.012, sigX: 0.10, aggr: 0.35, risk: 0.35, habit: 0, slip: 0, nerves: 0 };
