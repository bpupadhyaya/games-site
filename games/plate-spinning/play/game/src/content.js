// All the words of the game: About, How to Play, the Rules pages. Numbers are read from engine.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { TUNE, TYPES, TYPE_ORDER, rateFor, multFor, polesForAct } from './engine.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const secs = (v) => `${(Math.round(v * 10) / 10).toString()} s`;
const fallSecs = (act, type = 'porcelain') => secs(1 / rateFor(act, type));
const bandSecs = (act, a, b) => secs((b - a) / rateFor(act, 'porcelain'));

export const ABOUT = [
  { h: 'Plate Spinning' },
  { p: 'A game of timing and attention on a theatre stage. Plates spin on thin bamboo poles; each one tires, starts to wobble and will fall unless you whip its pole at the right moment. More poles join the show with every act.' },
  { h: 'Where it comes from' },
  { p: 'Chinese acrobatics (zaji) is one of the world\'s best known performing traditions, and spinning plates on flexible sticks is one of its signature acts: a performer sets many plates turning at once and runs from pole to pole, giving each a quick shake before it slows. The exact origins of the plate act are uncertain, and today it is performed by troupes all over the world.' },
  { p: 'This game is an original, simplified take on the idea. The performer is an invented character in a period-style silk costume; no real troupe or person is portrayed.' },
  { h: 'How it sounds and looks' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The courtyard, audience, performer, plates and poles are a lit 3D scene drawn in real time on your device.' },
  { h: 'Made for playing' },
  { li: 'Works with two thumbs, and with the keyboard on a computer.' },
  { li: 'Think slows time for a moment and points at the plate that needs you most.' },
  { li: 'Watch and Learn plays a whole show for you and explains each choice. Pause it at any time.' },
  { li: 'Large text and reduced-motion options. Works offline.' },
  { sp: 1 },
  { p: 'Plate Spinning is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Every plate on a pole slowly loses spin. A tired plate tilts and wobbles more and more.' },
  { li: 'Tap a plate (or its pole) to whip it back to full speed. The small gauge under each pole shows when: whip while the needle is in the gold zone for a Perfect.' },
  { li: 'Do not whip a fast plate: shaking a plate that is still spinning well makes it jolt and breaks your combo.' },
  { li: `Let a plate fall and it breaks. ${TUNE.maxBreaks} broken plates end the show.` },
  { h: 'Modes' },
  { li: 'Perform: the scored show, act after act, with more poles each time.' },
  { li: 'Practice: no breakage. Choose how many poles and how fast, and learn the rhythm.' },
  { li: 'Watch and Learn: the computer plays a show and explains each choice before it acts.' },
  { h: 'Tips' },
  { li: 'Jade plates need two quick taps. Tap once, then again straight away.' },
  { li: 'Work in a sweep: look across the whole stage, near and far, rather than staring at one plate.' },
  { li: 'Stuck? Tap Think. Time slows for a moment and the plate that needs you most is ringed.' },
  { li: 'Keyboard: 1 to 8 whip the poles from left to right, H is Think, Space pauses.' },
];

// The Rules pages. Each page: { title, blocks }.
export const RULES = [
  {
    title: 'The stage',
    blocks: [
      { p: `A show is played on a stage with up to ${TUNE.maxPoles} bamboo poles. Each pole holds one plate. In portrait the poles stand in two staggered rows, in landscape in one row; the nearer row is drawn larger.` },
      { fig: 'plates', hh: 220 },
      { p: 'A plate has spin energy from 0 to 100%. At 100% it spins at full speed and sits level. As it loses energy it tilts and wobbles, and at 0% it falls off the pole.' },
      { p: 'Your only action is a whip: a tap on a plate or on its pole. The nearest plate to your finger takes the whip, so there is no need to be exact.' },
    ],
  },
  {
    title: 'Energy and the sweet band',
    blocks: [
      { p: 'Every plate loses energy all the time. The gauge under each pole shows where its plate is. What a whip does depends on where the needle is:' },
      { fig: 'band', hh: 190 },
      { li: `Too soon (above ${pct(TUNE.early)}): the plate is over-shaken. It jolts, loses ${pct(TUNE.jolt.loss)} energy, wobbles for a moment and your combo is lost. No points.` },
      { li: `Early (${pct(TUNE.hi)} to ${pct(TUNE.early)}): the whip is wasted. The plate goes up to ${pct(TUNE.refresh.early)}. No points, no penalty, combo kept.` },
      { li: `Good (${pct(TUNE.lo)} to ${pct(TUNE.hi)}, outside the Perfect band): the plate returns to full speed and scores ${TUNE.points.good} points.` },
      { li: `Perfect (${pct(TUNE.perfLo)} to ${pct(TUNE.perfHi)}): the plate returns to full speed and scores ${TUNE.points.perfect} points.` },
      { li: `Save (below ${pct(TUNE.lo)}): a late rescue. The plate goes up to ${pct(TUNE.refresh.save)}, scores only ${TUNE.points.save} points and your combo is lost.` },
      { p: 'Watch the plates as well as the gauges: a plate wobbles harder the lower its energy, and it glows gold when it is in the Perfect band.' },
      { fig: 'wobble', hh: 190 },
    ],
  },
  {
    title: 'Whips and scoring',
    blocks: [
      { p: `Good and Perfect whips build a combo. Every ${TUNE.comboStep} whips in a row raise the multiplier by one, up to x${TUNE.maxMult}:` },
      { li: `Combo 0 to ${TUNE.comboStep - 1}: x${multFor(0)}. Combo ${TUNE.comboStep}: x${multFor(TUNE.comboStep)}. Combo ${TUNE.comboStep * 2}: x${multFor(TUNE.comboStep * 2)}. Combo ${TUNE.comboStep * (TUNE.maxMult - 1)} and above: x${TUNE.maxMult}.` },
      { p: 'Points for a whip = base points x plate value x multiplier. Early whips score nothing and leave the combo alone. A jolt, a Save, a failed double whip or a broken plate resets the combo to 0.' },
      { p: `A clean act (no plate broken during the act) is worth a bonus of ${TUNE.cleanAct} points x the act number.` },
    ],
  },
  {
    title: 'The four plates',
    blocks: [
      { p: 'There are four kinds of plate. A new plate is chosen at random; the rarer kinds only join the show in later acts.' },
      ...TYPE_ORDER.map((t) => ({ li: `${TYPES[t].name}: ${TYPES[t].blurb}` + (TYPES[t].from > 1 ? ` From act ${TYPES[t].from}.` : '') })),
      { p: `Speeds: against porcelain (x1), lacquer drains x${TYPES.lacquer.k}, jade x${TYPES.jade.k}, gold x${TYPES.gold.k}. Gold plates score x${TYPES.gold.pts} points.` },
      { p: `Double whip (jade): the first tap in the sweet band lifts the plate by ${pct(TUNE.jadeLift)} and starts a ${TUNE.jadeTime}-second grace period. A second tap inside that time brings the plate to full speed and scores the grade of the first tap. If the time runs out the plate stays lifted but you lose the combo.` },
    ],
  },
  {
    title: 'Acts and difficulty',
    blocks: [
      { p: `A show is a series of acts of ${TUNE.actSeconds} seconds. Act 1 starts with ${polesForAct(1)} plates. Each new act adds a pole, up to ${TUNE.maxPoles}, and makes every plate tire faster.` },
      { li: `Base drain at act 1: ${pct(rateFor(1))} of full speed per second, so a fresh porcelain plate lasts ${fallSecs(1)}. The Perfect band lasts about ${bandSecs(1, TUNE.perfLo, TUNE.perfHi)}.` },
      { li: `At act 6 a porcelain plate lasts ${fallSecs(6)} and the Perfect band about ${bandSecs(6, TUNE.perfLo, TUNE.perfHi)}.` },
      { li: `From act 12 the drain stops rising: a porcelain plate lasts ${fallSecs(12)}.` },
      { p: `Poles in act n: ${polesForAct(1)} at act 1, ${polesForAct(2)} at act 2, ${polesForAct(3)} at act 3, up to ${TUNE.maxPoles} at act ${TUNE.maxPoles - TUNE.startPoles + 1}.` },
    ],
  },
  {
    title: 'Breaking and the end',
    blocks: [
      { p: 'When a plate reaches 0% it falls from its pole and breaks on the stage. That pole is empty for a moment, then the stagehand places a fresh plate on it at 60% energy.' },
      { li: `A broken plate costs you one of your ${TUNE.maxBreaks} spare plates (shown at the top) and resets your combo.` },
      { li: `When the last spare plate has gone, the show ends once the falling plate has landed.` },
      { li: 'Your best score, best act and best combo are stored on this device.' },
    ],
  },
  {
    title: 'Modes, Think and Watch and Learn',
    blocks: [
      { h: 'Perform' },
      { p: 'The scored show described on these pages, from act 1 until the last spare plate breaks.' },
      { h: 'Practice' },
      { p: `Choose between 1 and ${TUNE.maxPoles} poles and a speed. Plates never break: a plate that gets very low simply keeps wobbling. Practice does not set best scores.` },
      { h: 'Think' },
      { p: `The Think button slows time to ${pct(TUNE.thinkScale)} for ${TUNE.thinkSeconds} seconds and rings the plate that will fall first. It can be used again after ${TUNE.thinkCooldown} seconds.` },
      { h: 'Watch and Learn' },
      { p: 'The computer plays a show. At each lesson step it stops the clock and goes through three beats: Think (it lists which plates are closest to falling), Reveal (it rings the plate it picked and says why), then Act (it whips). You can set how long Think lasts in Settings, skip a step, or pause the lesson at any time.' },
    ],
  },
  {
    title: 'Controls and settings',
    blocks: [
      { li: 'Touch: tap a plate or a pole. Two thumbs work well.' },
      { li: 'Keyboard: keys 1 to 8 whip the poles from left to right; H uses Think; Space or Escape pauses.' },
      { li: 'Pause: the pause button freezes the whole show, including the Watch and Learn lesson.' },
      { li: 'Settings: sound, timing gauges, reduced motion, Think time for Watch and Learn.' },
      { li: 'Text size: every text screen has A- and A+ buttons, up to 300%.' },
      { sp: 1 },
      { p: 'Free to play with short ads; go ad-free once.' },
    ],
  },
];
