// All the words of the game: About, How to Play, Rules. Numbers are read from brush.js / judge.js / lessons.js (the constants the engine uses).
// Blocks: { h } heading, { p } paragraph, { li } bullet, { fig, hh } figure, { sp } space.
import { BRUSH } from './brush.js';
import { JUDGE } from './judge.js';
import { LESSONS, TYPES, SEALS } from './lessons.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const nChar = LESSONS.filter((l) => l.group === 'char').length, nBasic = LESSONS.filter((l) => l.group === 'basic').length, nComp = LESSONS.filter((l) => l.group === 'comp').length;

export const ABOUT = [
  { h: 'Ink Brush' },
  { p: 'A calm game of Chinese brush-and-ink writing and painting. Grind the ink, load the brush and make strokes whose width, wetness and tone follow how you move: slow and heavy, quick and light, a pause to press.' },
  { h: 'The craft' },
  { p: 'Brush writing is taught stroke by stroke. Every character is built from a few basic strokes written in a fixed order, and each stroke has its own rhythm of pressing and lifting. This game teaches that rhythm with a simulated brush: ink bleeds softly into xuan paper, a brush that runs low splits into dry bristles and flying white, and the ink tone runs from dark to pale as you add water.' },
  { p: 'The compositions of bamboo, orchid and plum blossom follow the traditional "four gentlemen" subjects of ink painting. Here they are taught only as brushwork: which stroke goes first, how dark the ink should be and how fast the hand should move.' },
  { h: 'What is inside' },
  { li: `${nBasic} basic strokes, ${nChar} simple characters with the stroke order shown, and ${nComp} compositions.` },
  { li: 'Feedback on stroke order, shape and rhythm after every stroke.' },
  { li: 'Watch and Learn: the brush paints a lesson for you and says why each stroke is made that way.' },
  { li: `A long free-draw scroll, ${SEALS.length} seals to press, and a gallery for your sealed work.` },
  { li: 'Works with a finger, a stylus or a mouse. Text size up to 300%. No ads. Works offline.' },
  { sp: 1 },
  { p: 'Everything is drawn and synthesised on your device. Ink Brush is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Paint in four steps' },
  { li: 'Choose a lesson. Start with the basic strokes. Numbers on the paper show the order of the strokes.' },
  { li: 'Tap Dip to load the brush. Tap Grind for darker ink or Water for paler ink.' },
  { li: 'Press and drag one stroke, then lift. Slow movement lands heavy, dark ink. Fast movement thins the line. Pause for a moment at the start or end to press a small pool of ink.' },
  { li: 'The game reads your stroke at once: right stroke, right shape, right rhythm. Follow the one-line tip under the paper.' },
  { h: 'The tools' },
  { li: 'Dip: refill the brush from the ink stone. One dip lasts about four or five strokes.' },
  { li: 'Water: dilute the ink in the brush for a paler tone.' },
  { li: 'Grind: rub the ink stone in circles to make the ink darker.' },
  { li: 'Size: small, medium or large brush. Guide: full model, light dots, or none.' },
  { li: 'Undo takes back the last stroke. Hint shows the next stroke and why it is written that way.' },
  { h: 'Other modes' },
  { li: 'Free scroll: a wide sheet to paint on. Slide it with the arrows. Press a seal when you are done and keep the work in the gallery.' },
  { li: 'Watch and Learn: the brush paints for you, thinking before each stroke. Pause it at any time.' },
  { h: 'Keyboard' },
  { li: 'D dip, W water, G grind, U undo, H hint, Space pauses, [ and ] change the brush size.' },
];

const kinds = Object.entries(TYPES).slice(0, 6).map(([, t]) => `${t.cn} ${t.name}`).join(', ');
export const RULES = [
  { title: 'The brush', blocks: [
    { p: 'You paint with one finger (or a mouse or stylus). Press on the paper to put the brush down, drag to make a stroke and lift to end it. Everything the stroke looks like comes from how your hand moved.' },
    { fig: 'types', hh: 190 },
    { li: `The six basic strokes: ${kinds}.` },
    { li: 'Each stroke type has its own rhythm. The pages that follow explain what the brush does and how a stroke is judged.' },
    { li: 'There is no clock and no way to fail. A stroke that is not good enough can be undone and tried again.' },
  ] },
  { title: 'Ink, load and tone', blocks: [
    { p: 'The brush carries ink. Tap Dip to load it fully. The load goes down as you paint: a full brush paints about four or five ordinary strokes.' },
    { fig: 'tones', hh: 150 },
    { li: `Ink density runs from 0 (clear water) to 1 (thickest ink). The tone is dark from ${BRUSH.darkAt}, mid from ${BRUSH.midAt} and pale below that.` },
    { li: 'The ink stone holds the thick ink. Grind raises its density by rubbing circles. Dip loads the brush with whatever the stone holds.' },
    { li: 'Water thins the ink in the brush by one step each time and also refills it a little. Compositions ask for different tones: dark leaves, mid stalks, pale petals.' },
  ] },
  { title: 'Pressure and speed', blocks: [
    { p: `The width of the line follows your speed. At rest, or moving slowly, the brush presses fully and paints wide, dark ink. At about ${BRUSH.vMax} page units per second or faster it is at its thinnest. Pausing lets the ink pool and swell.` },
    { fig: 'envelope', hh: 180 },
    { li: 'The tip lands small and widens over the first moments of the stroke.' },
    { li: 'At the end of the stroke the tip lifts away; a fast lift leaves a long fine tail, a slow lift leaves a blunt end.' },
    { li: 'Strokes pulled downward carry slightly more ink than strokes pulled upward.' },
    { li: 'Every stroke type has a width envelope (where it should be heavy and where light). That envelope is what Rhythm is scored against.' },
  ] },
  { title: 'Dry brush', blocks: [
    { p: `When the load falls below ${pct(BRUSH.dryBelow)} the bristles split and the line breaks into streaks of flying white. Moving very fast does the same even with a full brush.` },
    { fig: 'dry', hh: 170 },
    { li: 'Dry brush is a tool, not a mistake: it gives branches and rocks their rough texture.' },
    { li: 'In the plum blossom lesson the branches are marked for dry brush: the stroke is scored higher when the brush is not freshly loaded.' },
    { li: 'Tap Dip for crisp, wet strokes again.' },
  ] },
  { title: 'Stroke order', blocks: [
    { p: 'Characters are written in a set order. The usual rules: top before bottom, left before right, horizontals before the verticals that cross them, and the middle before the sides in a shape like the mountain.' },
    { fig: 'order', hh: 230 },
    { li: 'Numbers on the guide show which stroke comes next; the finished strokes drop their numbers.' },
    { li: 'If you write a different stroke from the one expected and it fits another stroke of the character better, it is counted as an order slip. The stroke is still kept and that stroke is marked done, but its order score is lower.' },
    { li: 'Order slips lower the star rating: with more than one slip the best result is two stars.' },
  ] },
  { title: 'How a stroke is judged', blocks: [
    { p: 'When you lift, the stroke is compared with the model in four ways. Each is a score from 0 to 100%.' },
    { li: `Shape: how close your line stays to the model path (full marks within ${pct(JUDGE.full)} of the lesson's tolerance, none beyond ${pct(JUDGE.zero)}). Running the wrong way or stopping under ${pct(JUDGE.minLen)} of the model length lowers it.` },
    { li: `Rhythm: how your width over the length of the stroke matches the type's envelope (zero at an average difference of ${pct(JUDGE.rhythmSpan)}).` },
    { li: `Order: full marks for the right stroke, ${pct(JUDGE.orderPenalty)} when out of order.` },
    { li: 'Tone (compositions only): the right ink tone for that stroke, and for dry-brush strokes a brush that is not freshly loaded.' },
    { li: `Weights: Shape ${pct(JUDGE.weights.shape)}, Rhythm ${pct(JUDGE.weights.rhythm)}, Order ${pct(JUDGE.weights.order)}. With Tone in play: Shape ${pct(JUDGE.weightsTone.shape)}, Rhythm ${pct(JUDGE.weightsTone.rhythm)}, Order ${pct(JUDGE.weightsTone.order)}, Tone ${pct(JUDGE.weightsTone.tone)}.` },
    { li: 'A one-line tip names the biggest gap, for instance to press longer at the start or lift sooner at the end.' },
  ] },
  { title: 'Stars and lessons', blocks: [
    { p: 'A lesson is finished when every stroke of the model has been written.' },
    { li: `The stars come from the average stroke score: one star from ${pct(JUDGE.stars[0])}, two from ${pct(JUDGE.stars[1])}, three from ${pct(JUDGE.stars[2])} (and at most one order slip for three).` },
    { li: `There are ${nBasic} basic strokes, ${nChar} characters and ${nComp} compositions. All are open from the start; the best stars are kept.` },
    { li: 'The guide can be Full (ghost strokes, numbers and arrows), Light (numbered start points only) or Off. A three-star lesson with the guide off earns a gold seal mark on its card.' },
    { li: 'Hint shows the next stroke for a few seconds and tells you how it is written. It never costs anything.' },
  ] },
  { title: 'Compositions', blocks: [
    { p: 'The three compositions are painted on the whole sheet. They use the same brush and the same judging, with a looser tolerance and with tone as a fourth score.' },
    { li: 'Bamboo: four stalk segments in mid ink, each pressed at both ends like a joint, then four dark leaves in a single sweeping stroke each.' },
    { li: 'Orchid: three long dark leaves from the root, a mid stem, three pale petal dabs and a dark stamen touch.' },
    { li: 'Plum blossom: two dry-brush branches, three pale ring blossoms and three dark stamen dots.' },
    { li: 'The stroke order of each composition is the order of the numbers on the guide.' },
  ] },
  { title: 'Free scroll, seals and gallery', blocks: [
    { p: 'The free scroll is a sheet three pages wide with no model and no judging. Use the arrows to slide along it.' },
    { li: `Seal: choose one of ${SEALS.length} carved seals (${SEALS.map((s) => s.name).join(', ')}) and tap the paper to press it. A seal belongs in a corner, after the last stroke.` },
    { li: 'Keep stores the scroll (or a finished lesson, with its seal) in the gallery. The gallery holds up to 12 works; the oldest is replaced when it is full.' },
    { li: 'The free scroll is saved when you leave it and reopens as you left it. Clear wipes the sheet.' },
    { li: 'Watch and Learn is never scored and never changes your stars.' },
  ] },
];
