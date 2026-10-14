// The text of the About, How to Play and Rules pages. Each section: { title, art?, p: [paragraphs] }.
// Numbers are read from the engine (sim.js) so the rules page cannot drift from the game.
import { SPECIES, SPOTS, DAY_SECS, FALL_LOSS, STRIKE_WINDOW, BONUS_STEADY, RANKS } from './sim.js';

export const ABOUT = [
  { title: 'Stilt Fishing', art: 'scene', p: [
    'Along the south-west coast of Sri Lanka, fishermen sit on a single crossbar fixed to a pole planted in the shallow surf. From this perch, a few metres off the beach, they cast a line into the water and wait for small fish to bite. The practice is called Ritipanna and the image of the lone fisher against a low sun is one of the island\'s best known.',
    'The stilts are set in rocky shallows where fish gather and the sea is just calm enough to hold the seat. Today the fishery is small, and many of the people who sit on the poles do so for the visitors who come to watch. This game shows the working fishery: a long day of patience, balance and quiet skill.',
  ] },
  { title: 'About this version', p: [
    'This is a video game version made for phones and tablets. You keep your seat against the swells, choose when to cast, and play each fish in. Every fish you land is measured, written into the logbook and put back in the sea.',
    'Simplifications: one rod and one kind of bait, a short day of two and a half minutes, a cut-away view of the water so the fish can be seen, and invented spots. The fish, sizes and swells are not taken from any real stretch of coast.',
  ] },
  { title: 'Pictures and credits', p: [
    'All art and sound are drawn and synthesised in the game. The tradition belongs to the fishing communities of Sri Lanka\'s southern coast. Stilt Fishing is part of the Arcforge collection of heritage games.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'scene', p: [
    'Land as many fish as you can before dusk while staying on your stilt. Swells roll in from the horizon and shove you; fish swim under the water. Each fish is measured and released.',
  ] },
  { title: 'Keep your seat', art: 'balance', p: [
    'Touch the pad at the bottom and slide left or right: the fisherman leans that way. A swell pushes you back toward the shore, so lean into it. The marker on the pad shows how far you have tipped. If it reaches the red you fall in.',
  ] },
  { title: 'Cast', art: 'cast', p: [
    'Tap the water where a fish is swimming. The bait flies there and sinks to that depth. Casting tips your seat a little, so cast in the calm between two swells.',
  ] },
  { title: 'Set the hook', art: 'strike', p: [
    `Watch the float. It bobs when a fish nibbles and dives when it bites. Press the pad within ${STRIKE_WINDOW} second of the dive to set the hook.`,
  ] },
  { title: 'Play the fish', art: 'fight', p: [
    'Hold the pad to reel. Let go when the fish runs: the needle goes red and the line would snap. Reel again when the fish rests. Keep the needle in the green and the fish tires. Lean against its pull to stay on the stilt.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think suggests which fish to cast at and says what to do while you play it. A day where you used Think is practice and is not saved as a best.',
    'Watch & Learn plays a whole day for you: it thinks, shows which fish it will cast at, then acts. You can pause at any time.',
  ] },
];

const fishLines = SPECIES.map((s) => `${s.name}: ${s.kg[0]} to ${s.kg[1]} kg, ${s.cm[0]} to ${s.cm[1]} cm. ${s.note}`);
const spotLines = SPOTS.map((p) => `${p.name} (${p.time}): ${p.blurb}${p.need ? ` Opens when you have landed ${p.need} kg in total.` : ' Always open.'}`);
export const RULES = [
  { title: 'Goal', p: [
    `A day lasts ${DAY_SECS} seconds from the light shown for the spot to dusk. Land as much weight of fish as you can. Your score is 10 points for every kilogram, plus ${BONUS_STEADY} points if you land at least one fish and never fall in.`,
    'Every fish is released after it is measured. The weight is what counts, not the number.',
  ] },
  { title: 'Your seat', art: 'balance', p: [
    'The fisherman sits on a crossbar and is always trying to tip off. Sway runs from the left edge (toward the shore) to the right edge (toward the sea). If it reaches either edge you fall.',
    'Leaning moves your sway the opposite way to the tip: when you start to tip toward the shore, lean toward the sea. Lean moves smoothly, so start early. A rod bent by a heavy fish also tugs you toward the sea.',
    `A fall costs ${FALL_LOSS} seconds of climbing back, the line is lost, and nearby fish are frightened for a few seconds.`,
  ] },
  { title: 'Swells', art: 'balance', p: [
    'Each swell is drawn rolling in from the horizon about five seconds before it reaches the stilt, and the status bar counts the seconds down. When a swell passes it shoves you toward the shore, and the backwash tugs you gently back out.',
    'Big swells also frighten fish that are close to the stilt for a moment. Bigger sets come with the rougher spots.',
  ] },
  { title: 'Casting', art: 'cast', p: [
    'Tap the water to cast the bait at that spot. How far across you tap sets the distance and how far down sets the depth. The bait flies, lands with a splash and sinks. A fish within reach will drift toward the bait and nibble.',
    'A cast tips your seat forward a little, more for a long cast. A cast can be repeated at any time while no fish is on the line. A splash right on top of a fish frightens it.',
  ] },
  { title: 'Bite and strike', art: 'strike', p: [
    `A fish that is interested nibbles: the float bobs. Then it takes the bait and the float dives. You have ${STRIKE_WINDOW} second to press the pad and set the hook; if you are too slow the fish lets go and stays wary for a while. Each species has a chance of taking the bait, so some nibbles come to nothing.`,
  ] },
  { title: 'Reel and tension', art: 'fight', p: [
    'Once hooked, the fish alternates rests and runs. A run is announced just before it starts. While the pad is down the reel winds the fish in; the harder the fish pulls, the more the line is stretched.',
    'The needle on the line gauge shows tension. Green is safe and tires the fish. In the red the reel is strained and winds slowly, and if the needle stays in the deep red for a moment the line snaps and the fish swims free.',
    'Let go of the pad during a run and reel again in the rest. A tired fish pulls less. When the fish reaches the stilt it is landed.',
  ] },
  { title: 'Fish', art: 'fish', p: fishLines },
  { title: 'Spots', p: spotLines },
  { title: 'Modes', p: [
    'Day on the Stilt: a scored day at the spot you chose in the Logbook. Daily Tide: the same sea and swells for everybody today; your best of the day is kept. Free Fishing: no clock and no score, for practice and calm.',
    'Watch & Learn plays a whole day for you. Before each cast the game stops to think for the time you chose in Settings (2, 5, 8 or 10 seconds), shows the fish it has chosen, then casts when the sea is calm. The day clock waits while it thinks. Pause freezes everything exactly where it is.',
  ] },
  { title: 'Think hint', p: [
    'Think picks the fish that is worth the most and easiest to reach, tells you whether the sea is calm enough to cast, and while a fish is on the line says whether to reel or to ease off. A day where you used Think is practice and is not saved as a best.',
  ] },
  { title: 'Ranks', p: [
    `Day scores earn a title: ${RANKS.map((r) => `${r.name} (${r.min})`).join(', ')}.`,
  ] },
  { title: 'Free preview', p: [
    'The first 90 seconds of real play are free. Menus, Watch & Learn, the Logbook and paused play do not count. The full game is a one-time unlock; Restore Purchases is in Settings.',
  ] },
];
