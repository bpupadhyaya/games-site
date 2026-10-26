// All the reading text: About, How to Play and the paged Rules. Every number here is the number the engine uses (music.js).
import { JUDGE, TIMING, SCORE, GROOVE, LEARN, TENSION, SWIPE_MIN, PIECES, tensionMult } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;

export const ABOUT = [
  { h: 'Sega Ravanne Drum' },
  { p: 'A rhythm game inspired by sega, the music and dance of Mauritius and the islands of the Indian Ocean: a shuffling 6/8 groove played on the ravanne, a wide goat-skin frame drum that is warmed over a fire to tighten its skin, with the maravanne seed rattle and a bright metal triangle. A dancer sways to your timing.' },
  { fig: 'drum', hh: 330 },
  { h: 'Where it comes from' },
  { p: 'Sega is the everyday music of Mauritian celebrations, beaches and family gatherings, played and danced across Mauritius, Rodrigues, Reunion and the Seychelles. It grew among the island\'s Creole communities and is recognised on UNESCO\'s lists of intangible cultural heritage, including the Mauritian sega tipik and the sega tambour of Rodrigues. Its roots are part of the islands\' history, and it is today a joyful, living tradition.' },
  { p: 'This game shows only the instruments and the shuffle rhythm, in original patterns made for the game. It includes no songs or lyrics and no recordings, out of respect for the musicians and communities who keep the tradition.' },
  { h: 'What you do' },
  { p: 'A beam sweeps round the drum like the hand of a clock, one turn for every bar. Each stroke arrives as a dot on the rim. When the beam meets a dot, play it on the right instrument: tap or slide on the drum, tap the triangle, shake the maravanne. Warm the skin at the fire when the drum slackens. The more cleanly you play, the more the band joins in and the livelier the dancer sways.' },
  { h: 'Credits' },
  { p: 'Game by Arcforge. All sound is synthesised on your device and all art is drawn in the game. Display font Fredoka by the Fredoka Project Authors (SIL Open Font License 1.1).' },
  { p: 'Works offline. Free to play with short ads; go ad-free once.' },
];

export const HOWTO = [
  { h: 'How to play' },
  { p: 'Pick a piece, then choose Learn, Perform or Watch and Learn.' },
  { fig: 'strokes', hh: 250 },
  { li: 'A beam sweeps round the drum, one turn per bar. Dots drop onto the rim at their place on the clock. Play each dot when the beam reaches it.' },
  { li: 'BOOM (gold disc): tap the middle of the drum.' },
  { li: 'SLAP (teal disc): press on the drum and slide your finger across it.' },
  { li: 'TING (violet triangle): tap the triangle.' },
  { li: 'SHAKE (coral rattle): press on the maravanne pad and swipe across it.' },
  { li: 'WARM (orange flame arc): press and hold the fire while the beam runs along the arc, then let go at its end.' },
  { h: 'The groove' },
  { p: 'The Groove bar fills as you play cleanly. The fuller it is, the more the band joins in (bass, wood knocks, claps, bell), the more lanterns light up and the harder the dancer sways. Misses drain it.' },
  { h: 'The skin' },
  { p: 'The skin slackens a little with every bar. A slack skin scores less and sounds dull; warm it at the fire and the drum rings out and scores more.' },
  { h: 'Learn, Perform, Watch' },
  { li: 'Learn: the lead drummer plays two bars, then you echo them. Each phrase gets up to three tries, then you play the whole piece.' },
  { li: 'Perform: play the piece straight through. Some bars are CALL bars (the band plays, you listen) and the next bar is the RESPONSE (you answer).' },
  { li: 'Watch and Learn: the band plays the whole piece for you. It thinks out loud before each phrase, shows what is coming, then plays it. Pause at any time.' },
  { h: 'Need a hint?' },
  { p: 'The question-mark button names the next strokes and lights their instruments. In Learn it plays the lead drummer\'s phrase again.' },
  { h: 'Keyboard' },
  { p: 'Space: boom. S: slap. T: triangle. M: maravanne. W (hold): warm the skin. P or Escape: pause. H: hint.' },
];

const win = (k) => `perfect within ${ms(JUDGE.perfect * k)}, great within ${ms(JUDGE.great * k)}, good within ${ms(JUDGE.good * k)}`;

export const RULES = [
  { title: 'The goal', blocks: [
    { p: 'Play a piece of sega music with the three voices of the band: the ravanne drum, the triangle and the maravanne rattle, while warming the drum skin at the fire. Every stroke of the piece appears as a dot; you play it with a gesture when the beam reaches it.' },
    { p: 'Your timing builds the Groove. A fuller Groove brings more of the band in and makes the dancer sway harder. At the end you get a score, an accuracy and up to three stars.' },
  ] },
  { title: 'The wheel', blocks: [
    { p: 'The drum face is a clock. One bar of music is one turn of the beam, and the bar has twelve slots, like twelve hours: four beats of three slots each, the rolling 12/8 feel of the sega shuffle. The beats are marked 1, 2, 3, 4 and the strongest tick is at twelve o\'clock.' },
    { p: 'A stroke sits at its slot on the rim. A dot first appears outside the drum about three quarters of a bar before it is due and drops onto the rim as the beam approaches. It is due at the moment the beam crosses it.' },
    { fig: 'drum', hh: 300 },
    { p: 'After the beam passes, a played dot flashes and fades. A missed dot turns grey and fades.' },
  ] },
  { title: 'The instruments', blocks: [
    { fig: 'strokes', hh: 250 },
    { li: `BOOM: tap the drum. A low stroke from the middle of the skin.` },
    { li: `SLAP: press on the drum and slide at least ${SWIPE_MIN} units in any direction. A bright, dry stroke, like the heel of the hand.` },
    { li: 'TING: tap the triangle pad. A ringing metal stroke.' },
    { li: `SHAKE: press on the maravanne pad and swipe at least ${SWIPE_MIN} units. A rush of seeds.` },
    { li: 'WARM: press the fire pad as the beam enters the flame arc, keep holding, and let go as it ends.' },
    { p: 'A stroke played on the wrong instrument is counted as OFF. Strokes the band plays in call bars are not yours to play.' },
  ] },
  { title: 'Timing and grades', blocks: [
    { p: 'Each stroke is judged by how far from the beam\'s arrival your gesture is recognised. A slide or shake counts at the moment the finger has travelled far enough.' },
    { li: `Standard timing: ${win(1)}.` },
    { li: `Relaxed timing (${TIMING[0].k}x wider): ${win(TIMING[0].k)}.` },
    { li: `Tight timing (${TIMING[2].k}x narrower): ${win(TIMING[2].k)}.` },
    { p: 'A stroke not played in time is a MISS. A stroke on the wrong instrument is OFF. A warm-up is graded on how well you pressed and how well you let go.' },
    { p: 'The Latency setting shifts the beat if your device has an audio delay.' },
  ] },
  { title: 'Score and combo', blocks: [
    { li: `Points per stroke: perfect ${SCORE.perfect}, great ${SCORE.great}, good ${SCORE.good}, off ${SCORE.off}, miss 0.` },
    { li: 'Every non-miss adds one to the combo; a miss resets it. The score multiplier is 1 plus half a point for every ten in a row, up to four times.' },
    { li: `Boom and slap are also multiplied by the skin (below): from ${tensionMult(0).toFixed(2)}x on a slack skin to ${tensionMult(1).toFixed(2)}x on a perfectly warm one.` },
    { li: 'Accuracy is the average strength of your strokes in the whole take (perfect 100%, great 78%, good 50%, off 20%). Stars: 90% or more three, 75% two, 55% one.' },
  ] },
  { title: 'The Groove and the band', blocks: [
    { p: 'The Groove bar rises with good timing and falls with bad:' },
    { li: `Perfect +${Math.round(GROOVE.perfect * 100)}, great +${Math.round(GROOVE.great * 100)}, good +${(GROOVE.good * 100).toFixed(1).replace(/\.0$/, '')}, off ${Math.round(GROOVE.off * 100)}, miss ${Math.round(GROOVE.miss * 100)} (percent of the bar).` },
    { p: 'The band always plays a quiet shuffle and a bass. As the Groove passes certain levels more layers join:' },
    { fig: 'groove', hh: 220 },
    { li: `Levels: ${GROOVE.layers.map((v) => Math.round(v * 100) + '%').join(', ')}.` },
    { p: 'The lanterns along the beach and the dancer\'s sway follow the Groove too. In Watch and Learn the Groove simply grows as the piece goes on.' },
  ] },
  { title: 'The skin and the fire', blocks: [
    { p: 'The ravanne\'s skin is warmed over a fire to tighten it. In the game this is the Skin meter, shown as the colour of the drum and as pitch.' },
    { li: `The skin starts at ${Math.round(TENSION.start * 100)}%, loses ${Math.round(TENSION.barLoss * 100)}% every bar and a little with each boom or slap.` },
    { li: `Below ${Math.round(TENSION.slack * 100)}% the skin is slack: it looks grey and wrinkled and sounds dull.` },
    { li: `A warm-up gives back up to ${Math.round(TENSION.warmGain * 100)}% depending on its grade. Warm-ups are marked by a flame arc and always sit where the drum rests.` },
    { p: 'A slack skin does not stop you playing; it only scores less.' },
  ] },
  { title: 'Call and response', blocks: [
    { p: 'Call and response is how sega is played and how this game teaches. Two places use it:' },
    { li: 'In Perform, every piece has CALL bars: the band plays the stroke pattern itself (the dots are shown dimly and you hear them), then the next bar, the RESPONSE, repeats exactly the same pattern for you to play. The middle of the drum names the bar: LISTEN, YOUR TURN or PLAY.' },
    { li: 'In Learn, the lead drummer plays a two-bar phrase (WATCH), then you echo it (ECHO).' },
    { p: 'Call bars are never judged.' },
  ] },
  { title: 'Learn', blocks: [
    { p: 'Learn walks through a piece two bars at a time, each after a one-bar count-in, at 85% of the piece\'s tempo. The final take is at full tempo:' },
    { li: 'WATCH: the lead drummer plays the two bars. You hear and see them.' },
    { li: 'ECHO: you play the same two bars. Only the drum shuffle and bass play, so you can hear yourself.' },
    { li: `If your echo is at least ${Math.round(LEARN.pass * 100)}% accurate the lesson moves on. Otherwise the same phrase repeats, up to ${LEARN.tries} tries.` },
    { li: 'After the last phrase you play the whole piece at full tempo for your result.' },
    { p: 'The question-mark button (or H) plays the lead drummer\'s phrase again.' },
  ] },
  { title: 'Watch and Learn', blocks: [
    { p: 'The band plays the piece for you while you watch and listen. Each two-bar phrase has three steps:' },
    { li: 'THINK: a card says what is coming. The music waits. The think time is a setting (2 to 10 seconds, default 5); tap the card to skip it.' },
    { li: 'REVEAL: for 2 seconds the dots of the phrase are lit, with the first stroke highlighted.' },
    { li: 'ACT: the band plays the phrase with the full groove.' },
    { p: 'Pause freezes everything: the beam, the music and the think timer.' },
  ] },
  { title: 'The pieces', blocks: PIECES.map((p, i) => ({ li: `${i + 1}. ${p.name}: ${p.bpm} bpm, ${p.bars.length} bars. ${p.sub}.` })).concat([{ p: 'Patterns are original and were made for this game; none is a transcription of an existing tune.' }]) },
  { title: 'Free to play and settings', blocks: [
    { li: 'Menus, Rules, Watch and Learn, pause and result screens are always free. Free to play with short ads; go ad-free once.' },
    { li: 'If you already bought it, Restore purchase is on the game page in Arcforge.' },
    { li: 'Settings: sound, timing (relaxed, standard, tight), think time, latency, move names, calm effects (fewer particles, no shake) and vibration. Text size goes up to 300% on every text page.' },
    { li: 'On the web demo only the first piece is playable, a few times.' },
  ] },
  { title: 'Simplifications', blocks: [
    { p: 'Real sega is played by ear, with many variations, call-and-response singing and dance that cannot fit in a game. This game keeps the instruments and the shuffle rhythm only.' },
    { p: 'The patterns are original, simplified to three voices and one note value, and the fire-warming is a game of the tradition\'s practice of tightening the skin over a fire. The sounds are synthesised and are not recordings of real instruments.' },
    { p: 'Credit: sega of Mauritius and the Indian Ocean islands, in the care of their musicians, dancers and communities.' },
  ] },
];
