// All the words of the game: About, How to Play, the Rules pages. Numbers are read from engine.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { TUNE, FIGS, FIG_ORDER, ENS, bpmFor, SPEEDS, multFor } from './engine.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const beats = (v) => `${v} beat${v === 1 ? '' : 's'}`;
const secs = (b, bpm) => `${(Math.round((b * 60 / bpm) * 100) / 100).toString()} s`;

export const ABOUT = [
  { h: 'Flag Tossing' },
  { p: 'A game of throwing, catching and waving a flag in time with a drum. You are a flag bearer in a piazza display: swipe up to throw, tap to catch, sweep the flag side to side, and trade flags with your partners in pair and team figures.' },
  { h: 'Where it comes from' },
  { p: 'Flag throwing and flag waving, known in Italy as sbandierata, is a living tradition of historical festivals and parades, mostly in the towns of central Italy. Troupes of bearers in period costume throw, spin and exchange flags in choreographed solo, pair and team displays, accompanied by drums and trumpets. It is also practised as a sport, with competitions.' },
  { p: 'This game is an original, simplified take on the idea. The flags are invented heraldic designs, the piazza and the bearers are imaginary, and no real town, team or flag appears. Real displays are more varied than the figures here.' },
  { h: 'How it sounds and looks' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The piazza, the bearers and the flags are drawn in real time.' },
  { h: 'Made for playing' },
  { li: 'Works with a thumb or a finger, and with the keyboard on a computer.' },
  { li: 'Think slows the drum for a moment and shows what comes next.' },
  { li: 'Watch and Learn performs a whole show for you and explains each figure. Pause it at any time.' },
  { li: 'Large text and reduced-motion options. Works offline.' },
  { sp: 1 },
  { p: 'Flag Tossing is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Read the figure card at the top. It shows when to throw, how many beats each flag stays in the air, and when each catch falls.' },
  { li: 'Press anywhere and drag UP, then let go on the beat to throw. The longer the drag, the higher the flag. The number beside your finger is the beats in the air; the ring turns gold on a whole number.' },
  { li: 'Tap as the flag reaches your hands to catch it. A ring closes in on the hands; tap when it is gold.' },
  { li: `Drop three flags and the show ends. Every act brings partners and a faster drum.` },
  { h: 'Waves and passes' },
  { li: 'Wave: hold and sweep the flag to the side marked on each beat. Turn at the extreme on the beat.' },
  { li: 'Pass: drag up and slightly towards your partner. The flag lands in their hands if your aim is close; catch their flag in return.' },
  { h: 'Modes' },
  { li: 'Perform: the scored show, act after act, solo then pair then team.' },
  { li: 'Practice: no drops. Choose the figure, the partners and the tempo.' },
  { li: 'Watch and Learn: the computer performs and explains each figure before it acts.' },
  { h: 'Tips' },
  { li: 'Use the height ruler on the left: the gold mark is the height the next throw needs.' },
  { li: 'Release on the beat of the drum, not before. A late release still counts as Good.' },
  { li: 'Stuck? Tap Think. The drum slows and a ghost shows where to aim.' },
  { li: 'Keyboard: A, S and D throw 2, 3 and 4 beats high; Enter or Z catches; H is Think; Space pauses.' },
];

const figLine = (id) => {
  const s = FIGS[id], parts = [];
  if (s.throws) parts.push(`throw ${s.throws.map((t) => beats(t.air)).join(', ')}`);
  if (s.incoming) parts.push('a flag comes to you');
  if (s.wave) parts.push(`${s.wave} swings`);
  return `${s.name} (${ENS[s.ens].name} and up): ${s.tip} Needs: ${parts.join('; ')}.`;
};

export const RULES = [
  {
    title: 'The stage and the drum',
    blocks: [
      { p: 'You are the bearer with the gold ring under your feet. In a pair figure a partner stands beside you; in a team figure two partners stand left and right.' },
      { fig: 'stage', hh: 300 },
      { p: `The drum keeps the count in beats. Before every figure the drum counts ${TUNE.countIn} beats in (shown as 1, 2) and then the figure begins. Everything in the game, from release to catch, is measured in beats of the drum, so a faster drum means a shorter time for the same beats.` },
      { p: 'The figure card at the top is a plan of the figure: a dot where each throw must be released, an arc to a ring where that flag lands, partner flags in blue, wave beats as chevrons, and a moving line for the present beat.' },
    ],
  },
  {
    title: 'Throwing',
    blocks: [
      { p: 'A throw is one press, drag and release. Press anywhere, drag upward, and release.' },
      { li: `Height: the length of the drag sets how long the flag stays in the air, from ${beats(TUNE.airMin)} to ${beats(TUNE.airMax)}. The number beside your finger shows it while you drag.` },
      { fig: 'heights', hh: 260 },
      { li: `Release: let go on the beat the card shows. Within ${TUNE.relPerfect} beat is Perfect, within ${TUNE.relGood} beat is Good, anything else (up to ${TUNE.relWindow} beat away) is Off. If you do not throw within ${TUNE.relWindow} beat after the mark, the throw is lost and counts as a drop.` },
      { li: `Aim: a sideways drag moves where the flag lands, by the drag length x ${TUNE.aimGain}. Straight up lands in your own hands; towards a partner lands in theirs. Within ${pct(TUNE.aimPerfect)} of the stage width is Perfect, ${pct(TUNE.aimGood)} Good, and up to ${pct(TUNE.aimReach)} the flag can still be reached. Beyond that nobody can catch it.` },
      { p: `A throw is graded on release, height and aim, and its grade is the lowest of the three. The height is compared with the figure: Perfect within ${TUNE.airPerfect} beat, Good within ${TUNE.airGood} beat.` },
    ],
  },
  {
    title: 'Catching',
    blocks: [
      { p: 'Tap, without dragging, as a flag reaches your hands. The nearest flag that is coming down to you is caught. A press that moves is a throw, not a catch.' },
      { fig: 'timing', hh: 190 },
      { li: `Perfect: within ${TUNE.catchPerfect} beat of the landing.` },
      { li: `Good: within ${TUNE.catchGood} beat.` },
      { li: `Later than ${TUNE.catchGood} beat after the landing the flag falls and counts as a drop. A tap earlier than ${TUNE.catchGood} beat before the landing does nothing.` },
      { p: 'A flag that you throw to a partner is caught by the partner: if the aim was within reach the partner always catches it and you score a small bonus; if not, it falls and counts as a drop.' },
    ],
  },
  {
    title: 'Waving',
    blocks: [
      { p: `A wave figure has ${FIGS.wave.wave} swings, one per beat, alternating left and right. Hold your finger down and sweep the flag to the side the card shows.` },
      { li: `Each swing is judged at the furthest point you reach on its side inside ${TUNE.waveGood} beat of the beat. You must reach at least ${pct(TUNE.waveAmp)} of the way from the centre to the edge.` },
      { li: `Perfect within ${TUNE.wavePerfect} beat, Good within ${TUNE.waveGood} beat. A swing that does not reach the side in time is missed and breaks your flow.` },
      { li: 'Missing two or more swings in one wave counts as a drop.' },
    ],
  },
  {
    title: 'The figures',
    blocks: [
      { p: 'A show is a series of figures. Each one has its own plan of throws, catches and waves:' },
      ...FIG_ORDER.map((id) => ({ li: figLine(id) })),
      { fig: 'flags', hh: 230 },
      { p: 'The flags are invented heraldic designs. They are only for looks; every flag behaves the same.' },
    ],
  },
  {
    title: 'Scoring and flow',
    blocks: [
      { p: 'Every graded action scores points times your multiplier.' },
      { li: `Throw: Perfect ${TUNE.pts.perfect}, Good ${TUNE.pts.good}, Off ${TUNE.pts.off}.` },
      { li: `Catch: Perfect ${TUNE.catchPts.perfect}, Good ${TUNE.catchPts.good}.` },
      { li: `Swing: Perfect ${TUNE.wavePts.perfect}, Good ${TUNE.wavePts.good}.` },
      { li: `A partner's catch: ${TUNE.partnerCatch}.` },
      { p: `Flow: every Perfect adds one to your flow. Good keeps it. An Off, a missed swing or a drop sets it back to zero. Every ${TUNE.flowStep} flow raises the multiplier by one, up to x${TUNE.maxMult}: x${multFor(0)} from 0, x${multFor(TUNE.flowStep)} from ${TUNE.flowStep}, x${multFor(TUNE.flowStep * 2)} from ${TUNE.flowStep * 2}, up to x${TUNE.maxMult} from ${TUNE.flowStep * (TUNE.maxMult - 1)}.` },
      { li: `A clean figure (nothing Off, nothing missed) scores a bonus of ${TUNE.cleanFig} x the multiplier.` },
      { li: `A clean act (no drops during the act) scores ${TUNE.cleanAct} x the act number.` },
    ],
  },
  {
    title: 'Acts, partners and tempo',
    blocks: [
      { p: `A show is a series of acts of ${TUNE.figsPerAct} figures.` },
      { li: `Act 1 is a solo act: you alone, at ${bpmFor(1)} beats per minute.` },
      { li: `Act 2 is a pair act with one partner, at ${bpmFor(2)} beats per minute.` },
      { li: `Act 3 is a team act with a partner on each side, at ${bpmFor(3)} beats per minute.` },
      { li: `Later acts mix every figure in a random order, and the drum speeds up by ${TUNE.bpmStep} beats per minute each act, up to ${TUNE.bpmMax}.` },
      { p: `For scale: at ${bpmFor(1)} beats per minute one beat lasts ${secs(1, bpmFor(1))}; at ${TUNE.bpmMax} it lasts ${secs(1, TUNE.bpmMax)}. In team figures your partners throw their own flags in time with yours; those throws are for show and are not judged.` },
    ],
  },
  {
    title: 'Drops and the end',
    blocks: [
      { p: 'A drop is any of the following:' },
      { li: 'a flag that you did not catch in time;' },
      { li: 'a throw that you did not make in time;' },
      { li: 'a flag aimed so wide that nobody can reach it, or thrown to a partner and missed;' },
      { li: 'a wave with two or more missed swings.' },
      { p: `A drop breaks your flow. After ${TUNE.maxDrops} drops the show ends and the result screen shows your score, act, figures, best flow and grades. Practice has no drops. Your best score, best act and best flow are stored on this device.` },
    ],
  },
  {
    title: 'Modes, Think and Watch and Learn',
    blocks: [
      { h: 'Perform' },
      { p: 'The scored show described on these pages.' },
      { h: 'Practice' },
      { p: `Choose the figure (or Mixed), the ensemble (solo, pair or team) and the tempo (${SPEEDS.map((s) => `${s.name} ${s.bpm}`).join(', ')} beats per minute). Nothing ends the show and practice does not set best scores.` },
      { h: 'Think' },
      { p: `The Think button slows the drum to ${pct(TUNE.thinkScale)} for ${TUNE.thinkSeconds} seconds and draws a ghost of the next throw: its height, and where it should land. It can be used again after ${TUNE.thinkCooldown} seconds (always in Practice).` },
      { h: 'Watch and Learn' },
      { p: 'The computer performs a show. Before each figure it stops the drum and goes through three beats: Think (what the figure asks for), Reveal (the ghost of its first throw), then Act (it performs). You can set how long Think lasts in Settings, skip a step, or pause everything at any time.' },
    ],
  },
  {
    title: 'Controls and settings',
    blocks: [
      { li: 'Touch: drag up to throw, tap to catch, hold and sweep to wave.' },
      { li: 'Keyboard: A, S, D throw 2, 3 or 4 beats high (aimed automatically); Enter or Z catches; arrow keys sweep a wave; H is Think; Space or Escape pauses.' },
      { li: 'Pause: the pause button freezes the whole show, including the Watch and Learn lesson.' },
      { li: 'Settings: sound, ghost guides, reduced motion and Think time for Watch and Learn.' },
      { li: 'Text size: every text screen has A- and A+ buttons, up to 300%.' },
      { sp: 1 },
      { p: 'Free to play with short ads; go ad-free once.' },
    ],
  },
];
