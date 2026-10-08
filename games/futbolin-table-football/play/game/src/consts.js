// Table geometry, rods, rival levels and cup data. All numbers are table units (the ball is 3.5 across).
export const FW = 68;            // table width (x from -34 to +34)
export const FL = 120;           // table length (y from -60 to +60); team 0 (the player) defends y = +60
export const HW = FW / 2, HL = FL / 2;
export const BALL_R = 2.2;
export const GOAL_HW = 12;       // half width of a goal mouth
export const CHAMFER = 9;        // corner fillets so the ball never sticks
export const MAN_HX = 2.4, MAN_HY = 1.8;
export const POST_R = 0.7;

// kind: gk / def / mid / att. n men on a rod, `spacing` between them, `maxOff` how far the rod slides either way.
export const KINDS = {
  gk: { n: 1, spacing: 0, maxOff: 22, label: 'Goalkeeper' },
  def: { n: 2, spacing: 24, maxOff: 19, label: 'Defence' },
  mid: { n: 5, spacing: 12, maxOff: 7, label: 'Midfield' },
  att: { n: 3, spacing: 20, maxOff: 11.5, label: 'Attack' },
};
// Rods from the rival end (top of the table, y = -52.5) to the player end, interleaved as on a real table.
export const ROD_LAYOUT = [
  { team: 1, kind: 'gk' }, { team: 1, kind: 'def' }, { team: 0, kind: 'att' }, { team: 1, kind: 'mid' },
  { team: 0, kind: 'mid' }, { team: 1, kind: 'att' }, { team: 0, kind: 'def' }, { team: 0, kind: 'gk' },
];
export const ROD_Y = ROD_LAYOUT.map((_, i) => -52.5 + i * 15);
export const dirOf = (team) => (team === 0 ? -1 : 1);   // forward in table y

// Rival levels. lag: seconds of delay in seeing the ball; speed: rod slide speed; antic: how well it predicts bounces (0-1);
// err: aim error in table units; power: kick strength; eager: chance per tick to strike when the ball is in the zone.
export const LEVELS = [
  { id: 1, name: 'Novice', lag: 0.30, speed: 100, antic: 0.0, err: 5.0, power: 0.50, eager: 0.10, cover: 0.55 },
  { id: 2, name: 'Regular', lag: 0.20, speed: 165, antic: 0.2, err: 3.2, power: 0.65, eager: 0.22, cover: 0.7 },
  { id: 3, name: 'Sharp', lag: 0.13, speed: 235, antic: 0.5, err: 2.0, power: 0.80, eager: 0.40, cover: 0.85 },
  { id: 4, name: 'Expert', lag: 0.075, speed: 320, antic: 0.8, err: 1.0, power: 0.92, eager: 0.65, cover: 0.95 },
  { id: 5, name: 'Master', lag: 0.035, speed: 420, antic: 1.0, err: 0.4, power: 1.0, eager: 0.9, cover: 1.0 },
];
export const MATCH_GOALS = [3, 5, 7];
export const THINK_STEPS = [2, 5, 8, 10];
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];

// The cup: three rounds against invented generic teams. Colours are the kit of each side.
export const CUP = [
  { round: 'Quarter-final', team: 'Plaza Owls', level: 1, col: '#2f6fd6', trim: '#d8e6ff', goals: 3 },
  { round: 'Semi-final', team: 'Rio Rapids', level: 3, col: '#2aa876', trim: '#d6f5e8', goals: 5 },
  { round: 'Final', team: 'Cobalt Crew', level: 4, col: '#7a4fd0', trim: '#e6dcff', goals: 5 },
];
export const RIVAL_KITS = [
  { col: '#2f6fd6', trim: '#d8e6ff' }, { col: '#f0b82a', trim: '#fff3c9' }, { col: '#2aa876', trim: '#d6f5e8' },
  { col: '#7a4fd0', trim: '#e6dcff' }, { col: '#1d1d24', trim: '#f2f2f2' },
];
export const HOME_KIT = { col: '#d8452e', trim: '#ffe6bf' };
