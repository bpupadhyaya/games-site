// All the words: About, How to Play, Rules chapters. Numbers in the Rules come from the same constants the engine uses.
import { RHYTHMS, DIFFICULTY, ZONE_BASS, ZONE_TONE, ZONE_EDGE, STAR_AT, CIRCLE_ADD_AT, CIRCLE_MAX_STAGES, ECHO_ROUNDS, LAYERS, VOICES, GRADE_POINTS } from './rhythm.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const ms = (s) => `${Math.round(s * 1000)} ms`;

export const ABOUT = [
  { h: 'The djembe' },
  { p: 'The djembe is a goblet-shaped hand drum from West Africa. It is carved from a single piece of hardwood, covered with a goatskin head and tightened with a web of rope. It is played with bare hands and makes three main sounds: bass, tone and slap.' },
  { p: 'It is most closely linked with the Malinke people of Mali and Guinea, and is played across the region, including Senegal. Many Malinke speakers say the name comes from a phrase meaning roughly "everyone gather together in peace".' },
  { h: 'The circle' },
  { p: 'Djembe players rarely play alone. They are joined by three bass drums called dunduns (the small kenkeni, the middle sangban and the large dundunba), a hand bell and shakers. Each part is simple on its own. Together they make one interlocking sound, and learning to hold your part while others play theirs is the heart of this music.' },
  { h: 'This game' },
  { p: 'Echo your way into the beat, build a full circle one drummer at a time, learn six rhythms in the style of real Guinean and Malian dance music, or play freely and record loops. Every stroke you hear is made by the game itself from oscillators and filtered noise, so it works offline.' },
  { p: 'The rhythms here are simplified teaching versions. Real drummers and villages play them differently. If you can learn from a teacher, do.' },
  { h: 'Credits' },
  { p: 'Art, sound and code by Arcforge. Display font: Cormorant Garamond (SIL Open Font License). Arcforge makes world heritage games.' },
];

export const HOWTO = [
  { h: 'Play the drum' },
  { p: 'The skin of the drum is split into three places. Touch the middle for a deep Bass. Touch the ring near the rim for a clear Tone. Touch the very edge for a sharp Slap. You can use several fingers at once, and the drum answers each one.' },
  { draw: 'zones' },
  { h: 'Read the notes' },
  { p: 'Notes slide from the right toward the glowing line. The top row is Slap, the middle row is Tone and the bottom row is Bass. Touch the matching place on the drum just as a note reaches the line. Small notes are soft ghost notes.' },
  { draw: 'notes' },
  { h: 'Four ways to play' },
  { li: [
    'Echo: the lead drummer plays one bar, then you play it back. It starts with a few notes and grows over eight rounds.',
    'Circle: you hold the djembe part. Play well for two bars and another drummer joins in, until the whole circle is playing.',
    'Learn: six rhythms. Listen, practise slowly with the drum lit up for you, then play with the full circle.',
    'Free Drum: no notes, no score. Record a two-bar loop and layer more on top of it.',
  ] },
  { h: 'Tips' },
  { li: [
    'Listen first. Your ears are more exact than your eyes.',
    'If you always seem a little early or late, open Settings and run Calibrate.',
    'Headphones make the timing easier to feel. Keep your wrist loose.',
    'On a keyboard: Space, F or J is Bass. D or K is Tone. S or L is Slap.',
  ] },
];

const rhList = () => RHYTHMS.map((r) => `${r.name} (${r.region}): ${r.steps} steps a bar, about ${r.bpm} beats a minute.`);

export function rulesChapters() {
  const d = DIFFICULTY[1];
  return [
    { title: 'The drum', blocks: [
      { p: 'Every touch on the skin makes one stroke, chosen by WHERE the finger lands. The game measures the distance from the centre of the skin to your finger as a share of the skin\'s radius.' },
      { draw: 'zones' },
      { li: [
        `Bass: closer than ${pct(ZONE_BASS)} of the radius to the centre.`,
        `Tone: from ${pct(ZONE_BASS)} to ${pct(ZONE_TONE)} of the radius, the ring near the rim.`,
        `Slap: from ${pct(ZONE_TONE)} to ${pct(ZONE_EDGE)} of the radius, the very edge (a little beyond the rim still counts).`,
        'Anywhere else on the screen the drum is silent and nothing is judged.',
      ] },
      { p: 'Several fingers can strike at once and each finger makes its own stroke. A finger that stays down does not repeat: lift it and strike again. Every touch plays its sound at once, whether or not it matches a note.' },
      { p: 'Keyboard (web): Space, F or J = Bass. D or K = Tone. S or L = Slap.' },
    ] },
    { title: 'Reading notes', blocks: [
      { p: 'The timeline has three rows: Slap on top, Tone in the middle, Bass at the bottom. Notes travel from right to left and you strike when a note touches the glowing line. Each stroke has its own colour and shape so you never need colour alone: Bass is a large solid disc, Tone is a ring, Slap is a diamond.' },
      { draw: 'notes' },
      { p: 'Soft ghost notes are drawn smaller. They count like any other note; your stroke is simply played more quietly when you hit one. Faint outlined notes with no solid centre are the lead drummer\'s phrase in Echo and the teacher\'s demonstration in Learn: listen to them, you do not play them.' },
      { p: 'Vertical lines mark the beat; heavier lines mark the start of each bar.' },
    ] },
    { title: 'Scoring and timing', blocks: [
      { p: `Each note you must play is judged once, against the closest moment of your strike. The time windows depend on the difficulty you choose in Settings (all values either side of the note):` },
      { li: DIFFICULTY.map((x) => `${x.name}: Perfect within ${ms(x.perfect)}, Good within ${ms(x.good)}, OK within ${ms(x.ok)}.`) },
      { li: [
        `Perfect scores ${GRADE_POINTS.perfect * 100}%, Good ${GRADE_POINTS.good * 100}%, OK ${GRADE_POINTS.ok * 100}%.`,
        `Wrong stroke (right time, wrong place on the skin) scores ${GRADE_POINTS.wrong * 100}% and the note is used up.`,
        'Miss (no stroke near the note) scores nothing and breaks your combo.',
        'Extra strokes that match no note are free: they sound, but nothing is taken off.',
      ] },
      { p: `Accuracy is the average of those scores over every scored note. Stars: ${STAR_AT.map((v, i) => `${i + 1} star at ${pct(v)}`).join(', ')}.` },
      { p: `Example on Standard: a stroke ${ms(d.good - 0.01)} early is Good; ${ms(d.ok - 0.01)} late is OK.` },
      { p: 'Your device adds a little delay between touch and sound. Settings > Calibrate measures it and removes it from your timing. You can also nudge the offset by hand.' },
    ] },
    { title: 'Echo', blocks: [
      { p: `Eight rounds. In each round the lead drummer plays a one-bar phrase while you listen, then the same bar comes round again and you echo it. Rounds 1 and 2 use Bass and Tone only. From round 3 the phrase may include Slap. From round 4 notes may fall on off-beats. Phrases grow from ${3} to ${7} notes and the tempo rises from 83 to 104 beats a minute.` },
      { p: `A bell-like pulse keeps time in the background. Each round shows its own score; the final result averages every scored note. Echo never ends early: a poor round just lowers the score.` },
      { p: 'Guide: switch it on and the part of the drum for your next note glows, so you can learn the phrase by eye.' },
    ] },
    { title: 'Circle', blocks: [
      { p: `Pick any unlocked rhythm. You play the main djembe part, looped forever. The circle starts with just the bell.` },
      { p: `The circle works in stages of two bars. Near the end of each stage the game looks at how you played it. At ${pct(CIRCLE_ADD_AT)} accuracy or better, the next drummer joins for the following stage: ${LAYERS.map((v) => VOICES[v].name).join(', then ')}. Below that, the same drummers play again and you get another go.` },
      { p: `When all ${LAYERS.length} drummers are playing, the circle is full: you play three more stages and the session ends. If the circle is not full after ${CIRCLE_MAX_STAGES} stages, the session ends anyway. Your result is the accuracy over everything you played, plus how many drummers were in the circle.` },
    ] },
    { title: 'Learn', blocks: [
      { p: 'Each rhythm is taught in four steps: a count-in; two bars of Listen, where the teacher plays your part; four bars of Practice at about 72% of the tempo with the next place on the drum lit up (practice is not scored); then a second count-in and eight bars of Play with the whole circle at full tempo. Only Play is scored. Skip ahead jumps to the next step.' },
      { p: 'Reach one star to unlock the next rhythm. Every rhythm is also available in Circle once unlocked.' },
      { li: rhList() },
      { p: 'The patterns are simplified teaching versions in the style of each rhythm. Real parts vary from village to village and drummer to drummer.' },
    ] },
    { title: 'Free Drum and loops', blocks: [
      { p: 'Free Drum has no notes and no score. Set the tempo (60 to 140 beats a minute) and switch the click on or off.' },
      { p: 'Press Record. The click counts one bar in, then two bars of four beats are recorded. When the recording ends it plays back as a loop, and you can keep playing on top. Press Record again to record another layer over the loop: up to three layers. Undo removes the last layer; Clear removes them all.' },
      { p: 'Quantise snaps your strokes to the nearest sixteenth of a beat so a loop sounds tight. Switch it off to keep your own feel exactly.' },
    ] },
    { title: 'Auto Play', blocks: [
      { p: 'Auto Play is Watch & Learn. For each rhythm in turn it goes through three steps. THINK: the notation of the part is shown and nothing plays; you can set this pause to 2, 5, 8 or 10 seconds (default 5). REVEAL: the strokes are named one by one for 2 seconds. ACT: a pair of hands plays the part on the drum with the full circle behind it, so you can see and hear exactly where each stroke goes.' },
      { p: 'Pause stops everything where it is, including the music, and Resume carries on from the same point. Auto Play never changes your scores, stars or saved progress.' },
    ] },
    { title: 'Settings', blocks: [
      { li: [
        'Difficulty: Relaxed, Standard or Tight (the windows above).',
        'Calibrate: tap along with a steady beat eight times; the average gap is saved as your timing offset. Range ±250 ms.',
        'Offset: nudge the saved offset in 10 ms steps.',
        'Guide in Echo and Circle: light up the next place on the drum.',
        'Calm motion: fewer particles, no screen movement, steady light.',
        'Sound on or off, and text size up to 300% for every text page.',
      ] },
    ] },
  ];
}
