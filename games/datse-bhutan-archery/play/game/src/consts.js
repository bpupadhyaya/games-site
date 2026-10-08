// Constants of the range, the board, the bow and the match. Everything the Rules page quotes comes from here.
export const RANGE = 145;                       // metres between the two boards
export const BOARD = { w: 0.28, h: 0.91, karayY: 0.62, karayR: 0.07 };   // 28 x 91 cm; the painted bullseye (karay): 7 cm radius, centred 62 cm above the ground
export const NEAR = 1.0;                         // an arrow that lands on the ground within one arrow length (1 m) of the board scores one point
export const POINTS = { karay: 3, hit: 2, near: 1 };
export const ARROWS_PER_TURN = 2;
export const TEAM_SIZE = 3;
export const MATCH_TARGETS = [7, 13, 21];
export const MATCH_NAMES = ['Quick', 'Standard', 'Long'];
export const V0 = 56;                            // arrow speed at full draw, m/s
export const DRAG = 0.0016;                      // air drag per metre of flight
export const G = 9.81;
export const BOW_Y = 1.45;                       // height of the arrow when it leaves the bow
export const DRAW_T = 1.25;                      // seconds to reach full draw
export const STATION_U = 3.0;                    // the shooting stand is 3 m to the shooter's right of his own board
export const SWAY_A = 0.62;                      // sway amplitude in metres at the far board when the arm is least steady
export const BREATH_T = 3.2;                     // seconds per breath
export const BREATH_CALM = 2.1;                  // first calm moment after the draw starts
export const SPEED_JITTER = 0.0025;
export const NOCK_NOISE = 0.04;                  // metres at the board
export const HELP_NAMES = ['Guided', 'Standard', 'Expert'];
export const HELP_SUB = ['The reticle shows where the arrow lands in the current wind', 'The reticle ignores wind: read the flags and move it upwind', 'As Standard, with no wind numbers: flags only'];
export const LEVELS = [
  { id: 'village', name: 'Village', tag: 'Friendly shots, loose wind reading', stars: 1, su: 0.78, sh: 0.42, wind: 1.8, hold: [1.3, 2.2] },
  { id: 'valley', name: 'Valley', tag: 'Steady and sensible', stars: 3, su: 0.40, sh: 0.23, wind: 0.8, hold: [1.3, 2.0] },
  { id: 'national', name: 'National', tag: 'Reads every gust', stars: 5, su: 0.24, sh: 0.15, wind: 0.45, hold: [1.4, 1.9] },
];
export const COACH = { su: 0.14, sh: 0.1, wind: 0.2, hold: [2.0, 2.2] };   // Watch & Learn: good, steady play
export const ZOOMS = [30, 14, 7, 3.5];           // metres across the short side of the sight lens at the board
export const ZOOM_DEFAULT = 2;
export const VALLEYS = [
  { id: 'paro', name: 'Paro', top: '#b3271f', trim: '#f2c14e' },
  { id: 'punakha', name: 'Punakha', top: '#1f6fb3', trim: '#f4f1e6' },
  { id: 'bumthang', name: 'Bumthang', top: '#e0922b', trim: '#3a2a18' },
  { id: 'haa', name: 'Haa', top: '#2c8a5b', trim: '#f4f1e6' },
  { id: 'trashigang', name: 'Trashigang', top: '#7a3f9e', trim: '#f2c14e' },
  { id: 'wangdue', name: 'Wangdue', top: '#26727a', trim: '#f2c14e' },
];
export const NAMES_M = ['Tshering', 'Sonam', 'Ugyen', 'Kinley', 'Jigme', 'Namgay', 'Phuntsho', 'Tashi', 'Rinchen', 'Lhendup', 'Gyeltshen', 'Nima'];
export const NAMES_F = ['Dechen', 'Yangchen', 'Wangmo', 'Choden', 'Lhamo', 'Zangmo', 'Sangay', 'Tandin', 'Ugyen', 'Pema', 'Kezang', 'Deki'];
export const LESSONS = [
  { id: 'wind0', title: 'Aim and draw', goal: 'Score 4 points in 6 arrows with no wind.', arrows: 6, goal_pts: 4, wind: [0, 0], help: 0, text: ['Drag on the sight lens to put the reticle on the board.', 'Hold DRAW until the ring is full, then let go when the reticle is steadiest.'] },
  { id: 'cross', title: 'Read the wind', goal: 'Score 4 points in 6 arrows in a steady crosswind.', arrows: 6, goal_pts: 4, wind: [4, 90], help: 1, text: ['The flags show the wind. It pushes the arrow sideways all the way down the range.', 'With Standard help the reticle ignores wind: put it upwind of the board.'] },
  { id: 'karay', title: 'Find the karay', goal: 'Score 8 points in 6 arrows, or land one karay.', arrows: 6, goal_pts: 8, wind: [2.5, 250], help: 1, text: ['The karay is the painted bullseye: 3 points.', 'Zoom in, wait for the calm moment of the breath, and release.'] },
];
