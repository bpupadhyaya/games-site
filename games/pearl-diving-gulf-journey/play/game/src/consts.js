// Numbers and names of the whole game in one place. Everything the Rules page says is read from here, so the page cannot drift from the engine.
export const TRIPS = 4;            // trips per season
export const DAYS = 5;             // days at sea per trip
export const START_DEBT = 300;     // the advance (rupees) taken before the season; it is repaid from your share
export const START_CASH = 30;
export const BOAT_SHARE = 0.3;     // the captain keeps this part of a sale for the boat, the food and the crew pot
export const FAMILY_NEED = 24;     // rupees your family needs for each trip
export const GIFT = 6;             // a community gift
export const HIDE = 15;            // necklace slots
export const MAX_STAM = 100;
export const PREVIEW_DAYS_DEMO = 2;

export const THINK_STEPS = [2, 5, 8, 10];
export const REVEAL_SECS = 2;

// ---- the sea ----------------------------------------------------------------------------------------------------------------------------------------------------------
export const WINDS = [
  { id: 'calm', name: 'Calm', sub: 'a flat, glittering sea', cap: 1.0, tire: 1.0, haul: 1.0 },
  { id: 'breeze', name: 'Light breeze', sub: 'the sail fills', cap: 0.98, tire: 1.0, haul: 1.0 },
  { id: 'fresh', name: 'Fresh wind', sub: 'chop on the water', cap: 0.93, tire: 1.15, haul: 0.9 },
  { id: 'shamal', name: 'Shamal', sub: 'the hard north-west wind', cap: 0.85, tire: 1.35, haul: 0.8 },
];

export const BANKS = [
  { id: 'shallow', name: 'Shallow Hayr', depth: 6, rich: 0.85, beds: 8, nMax: 3, big: 0.8, sub: 'about 6 m. Easy diving, modest shells.' },
  { id: 'middle', name: 'Middle Hayr', depth: 11, rich: 1.0, beds: 7, nMax: 3, big: 1.0, sub: 'about 11 m. The working bank.' },
  { id: 'deep', name: 'Deep Hayr', depth: 16, rich: 1.22, beds: 6, nMax: 3, big: 1.4, sub: 'about 16 m. The best shells, the hardest dive.' },
];

export const DIVE = {
  baseCap: 34,            // seconds of breath before stamina, spirit, wind and the breath-up
  inhale: 3.2,            // seconds to fill the breath gauge
  zone: [0.7, 0.9],       // the green band of the gauge
  descend: 2.4,           // m/s riding the stone
  ascend: 1.9,            // m/s hauled (before spirit and wind)
  swim: 2.0,              // m/s along the seabed
  ring: 1.2,              // seconds for the closing ring
  ringAt: 0.82,           // phase of the ring at which a tap is perfect
  perfect: 0.07, good: 0.16,
  pickTime: { perfect: 0.5, good: 0.8, rough: 1.3 },
  roughLoss: 0.35,        // chance a rough pick breaks the shell
  clean: 3.0,             // signal with at least ascent time + this many seconds of breath left: a clean surface
  auto: 0.6,              // below ascent time + this the puller hauls without a signal
  stamBase: 7, stamDepth: 0.9, stamTight: 6, stamAuto: 12,
  haulStam: 5,
};

export const PROVS = [
  { id: 'lean', name: 'Lean pot', sub: 'Rice and dates. Cheap, but you wake tired.', cost: 8, rest: 14, spirit: 0 },
  { id: 'usual', name: 'The usual pot', sub: 'Rice, dates and dried fish.', cost: 14, rest: 22, spirit: 1 },
  { id: 'good', name: 'A full pot', sub: 'Rice, fish and spice. The crew sings louder.', cost: 22, rest: 30, spirit: 3 },
];

// ---- pearls --------------------------------------------------------------------------------------------------------------------------------------------------------
export const SIZES = [
  { id: 'seed', name: 'Seed', mm: [2, 3], base: 3 },
  { id: 'small', name: 'Small', mm: [4, 5], base: 12 },
  { id: 'medium', name: 'Medium', mm: [6, 7], base: 40 },
  { id: 'large', name: 'Large', mm: [8, 10], base: 110 },
  { id: 'grand', name: 'Grand', mm: [11, 13], base: 300 },
];
export const SHAPES = [
  { id: 'baroque', name: 'Baroque', mul: 0.35 },
  { id: 'button', name: 'Button', mul: 0.6 },
  { id: 'near', name: 'Near-round', mul: 0.85 },
  { id: 'round', name: 'Round', mul: 1.0 },
];
export const LUSTERS = [
  { id: 'dull', name: 'Dull', mul: 0.7 },
  { id: 'soft', name: 'Soft', mul: 1.0 },
  { id: 'bright', name: 'Bright', mul: 1.35 },
  { id: 'brilliant', name: 'Brilliant', mul: 1.8 },
];
export const COLOURS = [
  { id: 'white', name: 'White', mul: 0.9, rgb: [248, 246, 240], tint: [200, 205, 215] },
  { id: 'cream', name: 'Cream', mul: 1.0, rgb: [250, 238, 208], tint: [222, 196, 150] },
  { id: 'rose', name: 'Rose', mul: 1.2, rgb: [250, 226, 226], tint: [226, 164, 176] },
  { id: 'silver', name: 'Silver', mul: 1.25, rgb: [232, 238, 244], tint: [150, 170, 196] },
  { id: 'golden', name: 'Golden', mul: 1.4, rgb: [250, 232, 168], tint: [214, 164, 70] },
];
// weights, in the order of the arrays above
export const W_SHAPE = [0.2, 0.25, 0.33, 0.22];
export const W_LUSTER = [0.2, 0.35, 0.3, 0.15];
export const W_COLOUR = [0.38, 0.27, 0.15, 0.12, 0.08];
export const W_SIZE = [0.55, 0.27, 0.12, 0.05, 0.01];
export const PEARL_CHANCE = 0.155;       // per shell, times the bank richness
export const OLD_MUL = 2.2;            // an old shell holds a pearl this much more often
export const OLD_CHANCE = 0.18;        // share of shells that are old ones

// ---- the harbour ---------------------------------------------------------------------------------------------------------------------------------------------------
export const MARKET = [1.0, 0.96, 1.04, 1.1];   // the merchant's price index base per trip; each season adds a seeded wobble of +-0.08
export const STANDING_BONUS = 0.015;            // per point of standing, added to the price index (to a maximum of 6 points)
export const NAMES = { you: 'Yusuf', partner: 'Salim', captain: 'Hamad', singer: 'Khalifa', cook: 'Rashid', merchant: 'Mr. Jassim', sister: 'Latifa' };

export const SETTING = { place: 'Muharraq, Bahrain', year: 1924 };
export const STAR_AT = [0, 25, 45, 65, 82];
