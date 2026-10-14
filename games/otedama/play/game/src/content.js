// Text for About, How to Play and the Rules book. Numbers come from pattern.js so the Rules always match the engine.
import {
  PATTERNS, FABRICS, FREE_FABRICS, JUDGE, TIMING, LEARN_WINDOW, LEARN_SPEED, SCORE, WEIGHT, FLOW, COMBO_STEP, COMBO_MAX, STAR_AT, COUNT_IN, DWELL, CLAP_AT,
  PHRASE, THINK_CHOICES, REVEAL_SECONDS, DEMO_RUNS, ZONES, SONG,
} from './pattern.js';

const ms = (s, k = 1) => `${Math.round(s * k * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;

// main.js hands over the 3D library credits (vendor3d/LICENSES.md) so About shows them in the same zoomable reader.
export function setLicenses(text) {
  if (!text || ABOUT.blocks.some((b) => b.h === 'Licences')) return;
  const paras = String(text).split(/\n{2,}/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 12);
  ABOUT.blocks.push({ h: 'Licences' }, ...paras.map((x) => ({ p: x })));
}

export const ABOUT = {
  title: 'About',
  blocks: [
    { h: 'Otedama' },
    { p: 'Otedama is a traditional Japanese game of tossing and catching small cloth bags, which are called otedama, ohajiki or ochi in different places. The bags are sewn from scraps of patterned cloth and filled with azuki beans, rice or millet, so they land softly and stay put in the hand. It has been played for generations, mostly by girls and young children, at home and at school, and is often taught by older family members.' },
    { p: 'Players toss one or more bags and catch them in set sequences while a counting song keeps the time. A song may count the tosses, name each trick, or simply make the game more fun to share. As players grow better they add bags, throw higher and put in extra moves such as a clap in the air. Rules and songs differ from region to region and from family to family.' },
    { h: 'About this game' },
    { p: 'This game turns the toss-and-catch side of otedama into a rhythm and timing game. Bags travel from hand to hand in patterns from one bag up to five; you catch each one by tapping the hand it falls into, on the beat. The counting words (ichi, ni, san...) count your clean catches. The cloth patterns of the bags are original drawings in the spirit of traditional Japanese woven and printed cloth.' },
    { p: 'The many regional pick-up and counting-song variants of the traditional game are not included; this is a modern, simplified way to enjoy the same skill of tossing and catching in rhythm.' },
    { h: 'Credits' },
    { p: 'Made by Arcforge, a collection of heritage games from around the world. All sound is synthesised on your device. Text is set in Fredoka (SIL Open Font License 1.1). The performer is a 3D figure rendered on your device, with plain canvas graphics for the room and bags; no ads, works offline.' },
  ],
};

export const HOWTO = {
  title: 'How to Play',
  blocks: [
    { h: 'The goal' },
    { p: 'Keep the bags in the air. Each bag is tossed from one hand and comes down in a hand a few beats later. Tap that hand just as the bag lands in it and it is caught and thrown again.' },
    { fig: 'zones', hh: 210 },
    { h: 'Where to tap' },
    { li: 'The left part of the screen is your left hand, the right part is your right hand. You can tap with one finger or two thumbs.' },
    { li: 'A ring closes around the hand where the next bag will land. Tap when the ring meets the hand and the bag touches it.' },
    { li: 'In the middle of the screen is the clap. In patterns with claps, a clap ring appears between two catches: tap the middle on it.' },
    { h: 'Timing' },
    { p: 'Closer to the moment the bag lands scores more: Perfect, Great or Good. Too early or too late and the bag drops. A drop costs flow. A tap with no bag near is a stray tap and costs a little flow.' },
    { h: 'Counting song' },
    { p: `Each clean catch adds a word of the counting song: ${SONG.slice(0, 5).join(', ')}... After ten the count starts again. A drop starts the count over.` },
    { h: 'Flow' },
    { p: 'Clean catches fill the flow bar and build a chain that raises your multiplier. In Perform, if the flow runs out the pattern ends. In Learn there is no flow loss, so you can practise freely.' },
    { h: 'Three ways to play' },
    { li: 'Learn: slower, with wider timing windows and a hint button that shows the next catches.' },
    { li: 'Perform: the full pattern at tempo, scored and ranked with stars. Earn a star to win a new fabric for your bags.' },
    { li: 'Watch and Learn: the game juggles for you, thinking before each phrase. Pause it any time.' },
    { h: 'On a keyboard' },
    { p: 'A or Left arrow is the left hand, D or Right arrow is the right hand, Space or Down arrow is the clap. P or Escape pauses, H shows a hint in Learn.' },
  ],
};

const seqText = (p) => p.toss.join(' ');
export function rulesPages() {
  const k = TIMING.map((t) => t.k);
  const win = (g) => `${ms(JUDGE[g], k[0])} / ${ms(JUDGE[g], k[1])} / ${ms(JUDGE[g], k[2])}`;
  const patRows = PATTERNS.map((p) => ({ li: `${p.name} (${p.en}): ${p.bags} ${p.bags === 1 ? 'bag' : 'bags'}, tosses ${seqText(p)}, ${p.bpm} beats per minute, ${p.beats} beats${p.claps.length ? ', with claps' : ''}.` }));
  return [
    {
      title: 'The pattern',
      blocks: [
        { h: 'Beats and hands' },
        { p: 'A pattern is played on a steady beat. On every beat one hand is due to toss: the left hand on beat 0, 2, 4... and the right hand on beat 1, 3, 5... If that hand holds a bag, it tosses it; a 0 in the pattern means the hand has nothing to toss that beat.' },
        { h: 'How high' },
        { fig: 'arcs', hh: 250 },
        { p: `Each toss has a number: the number of beats until the bag comes down. A 3 crosses to the other hand (the figure-of-eight cascade), a 4 goes up and returns to the same hand, a 5 crosses again, higher. A 1 is a quick pass to the other hand. A caught bag rests in the hand for ${pct(DWELL)} of a beat, then it is tossed again.` },
        { p: `So a pattern like 3 3 3 with three bags always has a bag coming down on every beat, alternating hands; a pattern like 4 4 1 has a quick pass in every third beat. A pattern is a fixed list, so you can learn it and improve.` },
        { h: 'Starting and ending' },
        { p: `${COUNT_IN} beats of count-in play first, with the bags resting in the hands. Then the tosses begin. When the last toss has been made the remaining bags come down and are caught, and the pattern is over.` },
      ],
    },
    {
      title: 'Catching',
      blocks: [
        { h: 'Tap the hand' },
        { fig: 'zones', hh: 210 },
        { p: `The stage is split in three. A tap in the left ${pct(ZONES.left)} is the left hand, a tap in the right ${pct(1 - ZONES.right)} is the right hand, and a tap in the middle is a clap. It does not matter whether your finger is on a hand, only which part of the screen it is in.` },
        { p: 'The catch moment is the instant the bag reaches the hand. A ring closes around the hand beforehand to show it coming; the bag and the ring arrive together.' },
        { h: 'Beat windows' },
        { p: `A catch is timed by how far from that moment you tap. At the Standard setting: Perfect within ${ms(JUDGE.perfect)}, Great within ${ms(JUDGE.great)}, Good within ${ms(JUDGE.good)} either side. Beyond that the bag is dropped.` },
        { p: `The Timing setting scales every window: Relaxed ${TIMING[0].k}x, Standard ${TIMING[1].k}x, Tight ${TIMING[2].k}x. Perfect / Great / Good at Relaxed, Standard, Tight: ${win('perfect')} · ${win('great')} · ${win('good')}. Learn multiplies the windows by ${LEARN_WINDOW} on top of that.` },
        { h: 'Drops and stray taps' },
        { p: 'A bag that is not caught falls to the floor, breaks your chain and costs flow. It stays on the mat until its next toss and then jumps back into the hand, so the pattern carries on without it: keep the beat and catch the next one.' },
        { p: 'A tap in the wrong hand, or when no bag is near, is a stray tap. It costs a little flow and does not break your chain.' },
      ],
    },
    {
      title: 'Claps',
      blocks: [
        { h: 'A clap in the air' },
        { p: `In the patterns marked with claps, a high toss (3 or more) is followed by a clap while the bag is up there. The clap ring appears in the middle of the stage ${CLAP_AT} beats after that toss, exactly between two catches.` },
        { p: 'Tap the middle of the screen as the ring closes. A clap is graded like a catch: Perfect, Great, Good or a miss. A missed clap breaks your chain and costs flow, but no bag is dropped.' },
        { p: 'Because the clap sits halfway between two beats, it makes a gentle off-beat: left, clap, right.' },
      ],
    },
    {
      title: 'Flow and score',
      blocks: [
        { h: 'The flow bar' },
        { p: `Flow starts at ${pct(FLOW.start)}. Perfect adds ${(FLOW.perfect * 100).toFixed(1)}, Great ${(FLOW.great * 100).toFixed(1)}, Good ${(FLOW.good * 100).toFixed(1)} points of flow; a drop takes ${Math.round(-FLOW.miss * 100)} away and a stray tap ${Math.round(-FLOW.stray * 100)}. Flow never goes above 100%.` },
        { p: 'In Perform, a flow bar that reaches empty ends the pattern early and you see the result so far. In Learn and Watch and Learn flow never ends the pattern.' },
        { h: 'Chain and multiplier' },
        { p: `Every clean catch or clap adds one to your chain; a drop resets it. Every ${COMBO_STEP} in a row raises the multiplier by one, up to ${COMBO_MAX}x.` },
        { h: 'Points' },
        { p: `A catch or clap scores ${SCORE.perfect} for Perfect, ${SCORE.great} for Great and ${SCORE.good} for Good, times your current multiplier.` },
        { h: 'Stars and rank' },
        { p: `Accuracy counts every catch and clap: Perfect ${pct(WEIGHT.perfect)}, Great ${pct(WEIGHT.great)}, Good ${pct(WEIGHT.good)}, drop 0%. ${pct(STAR_AT[0])} earns one star, ${pct(STAR_AT[1])} two, ${pct(STAR_AT[2])} three. The rank names (Beginner to Master) follow the same percentage. Your best score and stars for each pattern are saved on this device.` },
      ],
    },
    {
      title: 'The patterns',
      blocks: [
        { h: 'All eight' },
        { p: `There are ${PATTERNS.length} patterns, from one bag to five. Learn plays them at ${pct(LEARN_SPEED)} of the tempo.` },
        ...patRows,
        { p: 'The tempo is the number of beats per minute at Perform. The toss list repeats until the beats are used up.' },
      ],
    },
    {
      title: 'Fabrics',
      blocks: [
        { h: 'Cloth for your bags' },
        { fig: 'fabrics', hh: 300 },
        { p: `There are ${FABRICS.length} cloth designs. The first ${FREE_FABRICS} (${FABRICS.slice(0, FREE_FABRICS).map((f) => f.name).join(', ')}) are yours from the start. Earn at least one star in a pattern to win its fabric; your bags then use the cloths you own, in turn.` },
        ...FABRICS.map((f) => ({ li: `${f.name}: ${f.note}` })),
        { p: 'The designs are original drawings inspired by the shapes of traditional Japanese cloth.' },
      ],
    },
    {
      title: 'Watch and Learn',
      blocks: [
        { h: 'The game juggles, you study' },
        { p: `Watch and Learn plays a whole pattern with the same timing and scoring as the real game, in phrases of ${PHRASE} catches. Before each phrase the clock stops and the game goes through three steps.` },
        { li: `Think: the game looks at the next phrase. You choose how long this lasts in Settings (${THINK_CHOICES.join(', ')} seconds; 5 is the default and 10 is the longest).` },
        { li: `Reveal: for ${REVEAL_SECONDS} seconds the next catches are lit up in the order they come, with the hand to use for each.` },
        { li: 'Act: the clock runs again and the phrase is played on the beat.' },
        { p: 'Pause stops everything, including the Think and Reveal timers and every bag in the air, and resumes exactly where it stopped. In Learn mode the hint button does a Reveal for you: it stops the clock for a moment and lights the next catches.' },
        { h: 'Settings' },
        { p: 'Sound, Timing, Think time, count words, text size (to 300%) and reduced motion are in Settings, reachable from the main menu.' },
      ],
    },
    {
      title: 'Free preview and demo',
      blocks: [
        { h: 'Trying it first' },
        { p: 'The full game has a free preview of real play; menus, Rules, Watch and Learn and results are always free. When the preview ends you can unlock the whole game once, or restore an earlier purchase.' },
        { p: `The public web demo is limited to ${DEMO_RUNS} plays and the first pattern, so it is a taste of the game; the apps for iPhone and Android hold everything.` },
      ],
    },
  ];
}
