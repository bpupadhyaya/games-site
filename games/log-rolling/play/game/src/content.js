// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Every number here is read from the engine (sim.js) so the rules page cannot drift from the game.
import { TUNE, VENUES, RIVALS, BOUTS, DEMO_MATCHES } from './sim.js';

const pct = (v) => `${Math.round(v * 100)} percent`;

export const ABOUT = [
  { title: 'Log rolling (birling)', art: 'log', p: [
    'Log rolling, also called birling, is a balance sport from the logging traditions of Canada and the United States. Two people stand on one floating log and spin it with their feet, each trying to stay up while the other loses footing and drops into the water.',
    'Today it is played at fairs, pond contests and lumberjack-sport shows in both countries, and it is part of the living heritage of Canada and the United States. It is presented here as a game of balance, rhythm and timing, with respect for the people who keep it going.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You steer your lean by dragging, and tap to give the log a kick that tips your rival. The rivals, the ponds and the log paint are invented for the game.',
    'Simplifications: the log is seen from the side, the feet pedal in place, and the whole sport is reduced to one number for the speed of the log, one for each lean and one for your momentum.',
  ] },
  { title: 'Pictures and credits', p: [
    'All art and sound are drawn and synthesised in the game. The people shown are made-up characters. Log Rolling is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'log', p: [
    `Stay on the log and put your rival in the water. A match is the best of ${BOUTS} bouts: win two and the match is yours.`,
  ] },
  { title: 'Lean', art: 'lean', p: [
    'The bar over each person shows how far they lean. Keep the marker near the middle. When you start to tip, press anywhere on the pad and drag the other way to catch your balance. Small pushes are enough; big ones throw you the other way.',
  ] },
  { title: 'Kick', art: 'kick', p: [
    'Tap the left or right half of the pad to kick the log. Your feet go with the log, but your rival slips and is tipped toward the side you tapped. Each kick uses momentum.',
  ] },
  { title: 'Momentum', art: 'momentum', p: [
    'The momentum bar fills only while you stand steady. A kick costs about a third of the bar, so spend it when your rival is already leaning that way, and keep your own lean small.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think shows the push to make and the kick to try, with a sentence of why. A match where you used Think is practice and does not count toward unlocking.',
    'Watch & Learn plays a bout for you. It stops to think, shows its plan, then does it for a few seconds. You can pause at any time.',
  ] },
];

const venueLines = VENUES.map((v) => `${v.name}: ${v.blurb} Water jolts of about ${Math.round(v.bump * 100)} percent of top log speed every ${v.bumpEvery.toFixed(1)} seconds or so; feet follow the log with a lag of ${v.tau.toFixed(2)} s.${v.need ? ` Opened by ${v.need} match win${v.need === 1 ? '' : 's'}.` : ' Always open.'}`);
const rivalLines = RIVALS.map((r) => `${r.name}: ${r.blurb} Notices a slip after ${r.react.toFixed(2)} s.`);

export const RULES = [
  { title: 'Goal', art: 'log', p: [
    `A match is the best of ${BOUTS} bouts. In a bout the first person whose lean reaches the limit falls in the water and the other wins the bout. If neither has fallen after ${TUNE.tEnd} seconds, the person with the smaller lean wins. Win two bouts to win the match.`,
  ] },
  { title: 'The log and the slip', art: 'log', p: [
    'The log has a speed (how fast its top is moving, to the left or to the right). Feet follow the log with a short lag. A sudden change in the log speed makes the feet slip, and a slip tips the body the other way: when the top of the log jumps to the right, the body leans left.',
    `A slip tips the body by about ${TUNE.kd} units for each unit of slip per second; a faster log tips harder (up to ${pct(TUNE.speedGain)} more at top speed). The body also rights itself slowly.`,
  ] },
  { title: 'Lean and falling', art: 'lean', p: [
    `Lean is shown on a bar from -1 (all the way left) to +1 (all the way right). A person falls when their lean reaches ${TUNE.limit}.`,
    `From ${TUNE.tSoft} seconds into a bout the limit closes in, down to ${TUNE.limitEnd} at ${TUNE.tEnd} seconds, so a long stand-off always ends. The dark ends of the bar show the part that is already out of bounds.`,
  ] },
  { title: 'Leaning back', art: 'lean', p: [
    `Press anywhere on the pad and drag left or right. The distance of the drag from where you pressed is your push, from -1 to +1; it pushes your lean by up to ${TUNE.kc} units per second. Letting go stops pushing. On a keyboard use the left and right arrow keys.`,
    'Push against the lean you want to remove. A push that is too big or too long carries you over the other way.',
  ] },
  { title: 'Kicks and momentum', art: 'kick', p: [
    `Tap the left half of the pad to tip your rival to the left, or the right half to tip them to the right. The log top moves the other way by ${TUNE.kick} (never beyond ${TUNE.vmax}); your own feet go with it, so you do not slip, but your rival does. On a keyboard use Z for left and X for right.`,
    `A kick costs ${TUNE.cost} of your momentum bar and then rests for ${TUNE.cooldown} seconds. Momentum starts at ${TUNE.start} and fills at ${TUNE.gain} per second, but only while your lean is smaller than ${TUNE.steady}, and more slowly the more you lean. A kick that could not change the log speed (it is already at its limit that way) is not used.`,
  ] },
  { title: 'Water', art: 'venues', p: [
    `The water knocks the log now and then and the log slows by ${pct(TUNE.drag)} per second. Everyone slips in a jolt, so steady feet and a quick push matter.`,
    ...venueLines,
  ] },
  { title: 'Rivals', art: 'rivals', p: [
    ...rivalLines,
    'A rival uses the same rules as you: it sees your lean after its reaction time, pushes to catch its own balance with a little error, and kicks toward the side you are already leaning when it is steady and has momentum.',
  ] },
  { title: 'Modes', p: [
    `Match: best of ${BOUTS} bouts against the rival of the pond. Quick Bout: one bout. Practice: no score, a rival who only stands; the time you stay up is shown. Watch & Learn: the game plays one bout for you.`,
    'Watch & Learn thinks for the set time (2, 5, 8 or 10 seconds), shows its plan for 2 seconds, then plays 2 seconds of the bout. Pause stops everything exactly where it is and Resume carries on.',
  ] },
  { title: 'Think', p: [
    'Think shows the push the plan would make and, when a kick is worth it, which side to tap, with the reason. A match where you used Think is practice: it does not count toward unlocking the next pond.',
  ] },
  { title: 'Unlocking', p: [
    'New ponds open with match wins (shown on the title screen). Each pond has its own rival and its own water.',
  ] },
  { title: 'Simplifications', p: [
    'Real birling is played with spiked boots on a long log in deep water, with rules about foot placement and stopping the log. Here the log is seen from the side and the movement is reduced to the numbers above. The rival names, the venues and the paint on the log are invented for the game.',
    `The web demo offers ${DEMO_MATCHES} matches; the apps have no limit.`,
  ] },
];

// The 3D person layer's credits text (web/vendor3d/LICENSES.md, fetched by the presenter) as About paragraphs.
export function creditsSection(md) {
  if (!md) return null;
  const p = [];
  for (const block of md.split(/\n\s*\n/)) {
    const t = block.replace(/^#+\s*/gm, '').replace(/`/g, '').replace(/^\* /gm, '- ').replace(/\s*\n\s*/g, ' ').trim();
    if (!t || /^Credits and licences/.test(t) || /^Games that ship/.test(t)) continue;
    p.push(t);
  }
  return p.length ? { title: 'Credits and licences', p } : null;
}
