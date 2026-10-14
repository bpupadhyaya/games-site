// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { JUDGE, SCORE, WEIGHT, CADENCE_K, PARTS_K, RESONANCE, BREATH, LEARN, THINK, STARS, ASSIST, PIECES, SCALE_LIST, PARTS, GRADES, pieceSeconds, scaleOf } from './music.js';

const pct = (v) => `${Math.round(v * 100)}%`;

export const ABOUT = [
  { h: 'Three Voices' },
  { p: 'A singing game about three-part harmony. You hold a voice at the right height on a pitch ladder and sing it in time with two other voices. When all of them are in tune together, the chord locks, the harmony rings pure and the lanterns of the hall brighten.' },
  { h: 'The tradition' },
  { p: 'Georgia, in the Caucasus, has one of the oldest traditions of polyphonic singing in the world: songs for three voices, usually sung without instruments, in which a low bass line (often like a drone) supports two upper voices that weave around each other. Its singing was recognised by UNESCO as a masterpiece of the intangible heritage of humanity in 2001. Table songs, work songs and travelling songs are part of everyday life there, and families, villages and ensembles keep them alive.' },
  { h: 'What this game borrows' },
  { li: 'Three roles: a low bass, a middle melody voice and a high ornamenting voice.' },
  { li: 'The pure, beatless sound of voices that are in tune with each other, and the bright rubbing of a second between two voices that resolves.' },
  { li: 'Songs that end on a wide, open chord.' },
  { h: 'Simplifications' },
  { p: 'Every melody here is original and written for the game in the style of three-part songs; they are not transcriptions of any real song. The voices are synthesised vowel sounds, not recordings, and they sing simple syllables rather than words. Real Georgian singing has far richer ornaments, vocal techniques and regional styles than a game can show. The songs here are secular: toasts, road songs and work songs.' },
  { h: 'Made for playing' },
  { li: 'Up to three fingers at once, each finger a voice. You choose which voices you sing; friends sing the rest.' },
  { li: 'Watch and Learn lets you hear a song with time to think, and tells you why each phrase sounds the way it does.' },
  { li: 'A pitch assist from strong to off. Text size goes up to 300%.' },
  { li: 'Portrait and landscape on phones and tablets. No ads. Works offline.' },
  { h: 'Free preview' },
  { p: 'The first 90 seconds of real singing (Sing, Learn and the Harmony Lab) are free. Menus, these pages, Watch and Learn and the results never use the preview. One purchase unlocks the whole game on this device.' },
  { sp: 1 },
  { p: 'Three Voices is part of Arcforge, a collection of world heritage games.' },
  { h: 'Credits for the 3D scene' },
  { p: 'The three singers use avatars from the Microsoft Rocketbox Avatar Library (MIT licence, copyright 2020 Microsoft), re-dressed and re-lit for this game, drawn with three.js (MIT licence). The full licence text is bundled with the app (vendor3d/LICENSES.md).' },
];

export const HOWTO = [
  { h: 'Sing in four steps' },
  { li: 'Choose a song, then which voices you sing: Bass, Middle, Top, or any mix. Start with one.' },
  { li: 'Note bars slide from the right towards the dashed now line. The height of a bar is its pitch; the word inside is the syllable.' },
  { li: 'Touch near the bar of the voice you want and hold. Your finger height is your pitch: keep the glowing bead on the bar while the note lasts.' },
  { li: 'Lift your finger in a breath (a pale gap) so your voice is silent there.' },
  { h: 'When it clicks' },
  { li: 'When every voice that is sounding is in tune together, the three beads join and glow. Hold that lock to climb the resonance levels: your score multiplier and the brightness of the hall.' },
  { li: 'If a voice drifts flat or sharp you will hear it beat against the others. Move until the beating melts away.' },
  { li: 'A phrase ends on a cadence chord. It is worth double: hold it steady to the end.' },
  { h: 'Modes' },
  { li: 'Sing: the whole song in one take.' },
  { li: 'Learn: hear a phrase with all three voices, then echo it. Listen again replays it. Then sing the whole song.' },
  { li: 'Watch and Learn: the ensemble sings each phrase. You get time to think, then the voices are revealed, then the phrase plays with a caption of what is happening and why. Pause freezes everything.' },
  { li: 'Harmony Lab: free singing over a drone, with the interval names and the beating shown live.' },
  { h: 'Tips' },
  { li: 'More fingers mean more points: one voice x1, two x1.4, three x1.8. Singing three voices needs a touchscreen and two hands.' },
  { li: 'Too hard? Set the pitch assist to Strong in Settings: the ladder lines pull your voice in.' },
  { li: 'Keep the Guide voice on to hear your own line quietly: a pitch off the guide beats against it.' },
  { li: 'Keyboard and mouse: click and hold to sing the nearest voice; keys 1, 2 and 3 pin the mouse to Bass, Middle or Top; Space pauses.' },
];

const songRow = (p) => `${p.name}: level ${p.level}, ${p.bpm} beats per minute, ${p.bpb} beats to the bar, ${scaleOf(p.scale).name} scale, about ${pieceSeconds(p)} seconds. ${p.blurb}`;

export const RULES = [
  {
    title: 'The ladder',
    blocks: [
      { fig: 'ladder', hh: 300 },
      { p: 'The screen is a ladder of pitch. Height is pitch: higher on the screen is a higher note. The faint horizontal lines are the steps of the song\'s scale, the bright line marks the home note (the tonic) and its octaves.' },
      { p: 'Time runs from right to left. The dashed vertical line is "now". A note bar is sung while it crosses that line. Its length is how long it lasts, its height is its pitch, and the thickness of the bar is about the width of the in-tune range.' },
      { p: 'The pitch span of a song covers its lowest to its highest note with a little room above and below. The ladder stays fixed during a song; only the notes move.' },
    ],
  },
  {
    title: 'The three voices',
    blocks: [
      { fig: 'voices', hh: 330 },
      ...PARTS.map((p) => ({ li: `${p.name}: ${p.who}. Its colour is ${p.id === 'bass' ? 'amber' : p.id === 'mid' ? 'rose' : 'turquoise'}.` })),
      { p: 'Before a song you choose which voices YOU sing. The others are sung by friends: they are always in tune and sing with a little vibrato and glide. Bars of your voices are solid; friends\' bars are pale. Your voices sound only while a finger is down.' },
      { p: 'You can sing one, two or all three voices. Three fingers can be down at once. Each finger takes the voice, among those you sing and that have no finger yet, whose line is nearest to the height where you touched. It keeps that voice until you lift it.' },
    ],
  },
  {
    title: 'Singing a note',
    blocks: [
      { fig: 'tune', hh: 280 },
      { p: 'Put a finger down and your voice starts to sound at the pitch of your finger\'s height. Slide up and down to change pitch smoothly. The bead shows what you are singing. The bar shows what you should sing.' },
      { p: `A note is "in tune" while your pitch is within the in-tune range of its bar, and "near" within the wider near range. The ranges depend on Pitch assist: ${ASSIST.map((a) => `${a.name} ${a.lock} and ${a.near} cents`).join('; ')}. A cent is one hundredth of a semitone. On a small or wide screen the ranges are widened so that they are never narrower than about a fingertip.` },
      { p: `The first ${JUDGE.grace} seconds of a note (less for a short note) are a grace period to get there. How quickly you first arrive within the near range is also measured.` },
      { p: 'A note you do not sing at all is a miss. Notes that run on from the previous one at a different pitch need a slide in time; there is no separate button.' },
    ],
  },
  {
    title: 'Scoring a note',
    blocks: [
      { p: `When a note ends it gets a coverage: the time you were in tune, plus ${pct(JUDGE.nearWeight)} of the time you were near, divided by the length of the note after its grace period (at most 100%). Then:` },
      { li: `PERFECT: coverage ${pct(JUDGE.perfectCov)} or more and you arrived within ${JUDGE.perfectLat} seconds (a little more for a long note). ${SCORE.perfect} points, accuracy weight ${WEIGHT.perfect}.` },
      { li: `GREAT: coverage ${pct(JUDGE.greatCov)} or more. ${SCORE.great} points, weight ${WEIGHT.great}.` },
      { li: `GOOD: coverage ${pct(JUDGE.goodCov)} or more. ${SCORE.good} points, weight ${WEIGHT.good}.` },
      { li: `NEAR: coverage ${pct(JUDGE.offCov)} or more. ${SCORE.off} points, weight ${WEIGHT.off}.` },
      { li: 'MISS: anything less. No points, weight 0.' },
      { p: `The points are multiplied by the resonance level, by the number of voices you sing (${PARTS_K.slice(1).map((k, i) => `${i + 1} voice${i ? 's' : ''} x${k}`).join(', ')}), by a little more for a longer note (up to 4 beats), and by ${CADENCE_K} for the last note of a phrase, the cadence.` },
      { p: 'A phrase\'s cadence is "held" when every cadence note of the voices you sing was PERFECT or GREAT. The result screen counts held cadences.' },
    ],
  },
  {
    title: 'Breaths',
    blocks: [
      { fig: 'breath', hh: 250 },
      { p: `A rest of one beat or more in a voice you sing is a breath: a pale band across the ladder. Keep your finger up, so your voice is silent. The first ${BREATH.lead} seconds and the last ${BREATH.tail} seconds of a breath are free so you can leave and enter smoothly.` },
      { p: `If you sing for more than ${BREATH.maxSung} seconds inside the breath it is broken; otherwise it is kept and counts as a full note of accuracy. Rests shorter than one beat are not judged: you can keep singing through them or lift.` },
    ],
  },
  {
    title: 'The chord lock and resonance',
    blocks: [
      { fig: 'lock', hh: 260 },
      { p: 'At every moment, the voices that have a note are "sounding". The chord is LOCKED when every one of those voices is in tune: friends always are, yours must be inside the in-tune range of their note. The three beads then join with a light and a soft shimmer joins the sound.' },
      { fig: 'resonance', hh: 240 },
      { p: `Hold the lock for ${RESONANCE.lockHold} seconds and it starts to build resonance: every ${RESONANCE.step} seconds of lock is one level, up to level ${RESONANCE.max}. The score multiplier is x${RESONANCE.mult(1)} at level 1 up to x${RESONANCE.mult(RESONANCE.max)} at level ${RESONANCE.max}, and the lanterns of the hall grow brighter.` },
      { p: `If the lock is broken for ${RESONANCE.breakAfter} seconds, you lose one level of progress (${RESONANCE.step} seconds). Re-locking builds it again. Resonance carries across phrases but not into a new song. The lock is shown but not counted while you only listen (Learn's listen part and Watch and Learn).` },
    ],
  },
  {
    title: 'Scales and pitch assist',
    blocks: [
      { fig: 'scales', hh: 300 },
      { p: 'The notes of a song lie on the steps of its scale. The scales use pure (just) intonation, the way unaccompanied singers tune: a third is 386 or 316 cents, a fourth 498, a fifth 702 and an octave 1200 above the home note. Chords built from these steps have no beating when you sing them in tune.' },
      ...SCALE_LIST.map((s) => ({ li: `${s.name}: ${s.blurb}.` })),
      { fig: 'assist', hh: 260 },
      { p: `Pitch assist pulls your voice gently towards the nearest scale line when you are within ${ASSIST.map((a) => `${a.pull} cents (${a.name})`).filter((_, i) => i < 2).join(' or ')} of it; with assist Off your pitch is exactly your finger. The assist only helps you reach the lines; it never changes which line is the right one.` },
    ],
  },
  {
    title: 'The songs',
    blocks: [
      { p: 'Each song has four phrases of four bars. The voices are friends\' voices where you do not sing. All melodies are original.' },
      ...PIECES.map((p) => ({ li: songRow(p) })),
      { p: 'In the free web demo only the first song is playable.' },
    ],
  },
  {
    title: 'Learn',
    blocks: [
      { p: 'In Learn you meet a song a phrase at a time. For each phrase: first LISTEN, where the whole ensemble sings it (including your voices) and nothing is scored; then ECHO, where you sing your voices and the friends sing theirs again, and the phrase is scored.' },
      { p: `If the accuracy of the echo is under ${pct(LEARN.pass)} you get one more try (${LEARN.tries} tries in all) before moving on. "Listen again" replays the phrase at any moment. After the four phrases you sing the whole song as a final take, and that take gives the result and stars.` },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { p: `Watch and Learn plays the song with all three voices sung for you. It goes phrase by phrase: THINK (default ${THINK.def} seconds, set ${THINK.min} to ${THINK.max} in Settings; tap the lamp button to continue early), REVEAL (${THINK.reveal} seconds, the voices and their notes are lit), then ACT, where the phrase sounds with its caption.` },
      { p: 'The caption is worked out from the notes of the phrase itself: where each voice starts and ends, whether the top voice answers in gaps, where two voices rub a second apart, and the interval of the closing chord. Pause freezes the whole thing and resumes exactly where it stopped. Watching never uses the preview.' },
    ],
  },
  {
    title: 'Harmony Lab',
    blocks: [
      { p: 'The Harmony Lab is free singing over a drone. The bass voice is a friend holding the low home note (the drone button hands it to you instead). Sing with the middle and top voices on the ladder.' },
      { p: 'The lab names the interval between each pair of voices that sound (unison, third, fourth, fifth, octave and so on), its pure ratio, how many cents you are away from it, and how fast the two tones beat against each other. When all the intervals are within 9 cents of pure for a third of a second, the lab locks: the beads join and the hall brightens.' },
      { p: 'The scale button cycles the four scales. Nothing is scored in the lab.' },
    ],
  },
  {
    title: 'Results and stars',
    blocks: [
      { p: `Accuracy is the average weight of every judged note and breath of the final take. Stars: ${STARS.map((s, i) => `${i + 1} at ${pct(s)}`).join(', ')}. Grades: ${GRADES.map(([lim, g]) => `${g} from ${pct(lim)}`).join(', ')}.` },
      { p: 'The result also shows your score, the highest resonance level, how many seconds the chord was locked, cadences held and breaths kept. The best score, stars and resonance of each song are saved on the device; Learn saves its own stars.' },
    ],
  },
  {
    title: 'Settings and keys',
    blocks: [
      { li: 'Sound: all voices on or off.' },
      { li: 'Pitch assist: Strong, Light or Off.' },
      { li: 'Guide voice: a quiet reference of the voices you sing, so you can hear your own line.' },
      { li: 'Vibration and Reduced motion (fewer sparks and drifting motes).' },
      { li: 'Think time for Watch and Learn.' },
      { li: 'Text size A- and A+ on every text screen, up to 300%.' },
      { li: 'Keyboard and mouse: click and hold to sing; keys 1, 2 and 3 pin the mouse to Bass, Middle or Top; Space or Escape pauses; Escape leaves a text page.' },
    ],
  },
];
