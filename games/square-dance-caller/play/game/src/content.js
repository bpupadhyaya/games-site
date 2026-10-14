// All reader text (About, How to Play, Rules) and the explanations the Think hint and Watch & Learn speak. Numbers and the list of moves come from
// consts.js, so the Rules page can never disagree with the engine.
import { CALLS, SWING, TIPS, LEVELS, SQUARES_PER_TIP, BEATS, SLACK_TIP, SLACK_ONE, HINT_COST, MARATHON_LIVES, PACES, THINK_STEPS, DEMO_LEVELS, COUPLES } from './consts.js';

export const RULE_TEXT = {
  cl4: 'All eight dancers circle left, counter-clockwise, a quarter of the way round. Every dancer moves two places on: a gent to the next gent\'s place, a lady to the next lady\'s place.',
  cl2: 'Circle left halfway. Every dancer moves four places, to the place straight across the ring.',
  cr4: 'Circle right, clockwise, a quarter of the way round. Every dancer moves two places back.',
  hlc: 'The two ladies of the head couples (bottom and top of the floor) chain across the ring and trade places. All the gents and the side ladies stay where they are.',
  slc: 'The two ladies of the side couples (left and right of the floor) chain across the ring and trade places. Everyone else stays.',
  hrl: 'The two head couples cross the ring and trade places. Each pair stays together and ends facing the middle again.',
  srl: 'The two side couples cross the ring and trade places. Each pair stays together and ends facing the middle again.',
  hpt: 'Each head dancer walks straight across the ring to the place directly opposite on the same side of the floor. The gent on the left reaches the lady place of the far couple and the lady on the right reaches the far gent place, so the roles swap sides.',
  spt: 'The same for the side couples, walking straight across from the left and right of the floor.',
  c1s: 'Couple 1 (bottom of the floor, left place and right place) half sashay: the gent and lady swap places with each other. Nobody else moves.',
  c2s: 'Couple 2 (right of the floor) half sashay: the gent and lady swap places with each other. Nobody else moves.',
  c3s: 'Couple 3 (top of the floor) half sashay: the gent and lady swap places with each other. Nobody else moves.',
  c4s: 'Couple 4 (left of the floor) half sashay: the gent and lady swap places with each other. Nobody else moves.',
  hsa: 'Both head couples half sashay: in each of the two couples the gent and the lady swap places.',
  ssa: 'Both side couples half sashay: in each of the two couples the gent and the lady swap places.',
  gr2: 'Allemande left with the corner, then grand right and left round the ring, counting hands (your partner is hand 1), and promenade home with the dancer you reach at hand 2. The gents finish at home. Each lady moves one couple clockwise, to the next gent\'s home place.',
  gr3: 'The same, counting three hands. Each lady moves two couples round, to the home place of the opposite gent.',
  gr4: 'The same, counting four hands. Each lady moves three couples clockwise, which is one couple counter-clockwise. It is also what "swing your corner and promenade home" does.',
  gs4: 'The gents form a star in the middle, walk it a quarter of the way round counter-clockwise and step back out to the next gent\'s place. The ladies hold their places.',
  gs2: 'The gents star left halfway round and step back out opposite where they began. The ladies hold their places.',
};

const place = (s) => `${(s >> 1) + 1}${(s & 1) ? 'L' : 'G'}`;
const movesText = (c) => {
  const out = [];
  for (let s = 0; s < 8; s++) if (c.to[s] !== s) out.push(`${place(s)} to ${place(c.to[s])}`);
  return out.length ? out.join(', ') : 'nobody changes place';
};

export const ABOUT = [
  { title: 'Square dancing', p: [
    'Square dancing is a folk dance of the United States. Four couples stand in a square and move through figures that a caller names in rhythm, one phrase at a time, to fiddle and string-band music.',
    'It grew from the country dances and quadrilles that settlers brought to North America, and for generations it has been danced in barns, grange halls, town halls and at fairs. Many states have named it their state dance, and clubs around the world still dance it.',
  ] },
  { title: 'The caller', p: [
    'The caller does not dance. The caller watches the square and sings the next figure, keeping a step ahead of the dancers. A good caller can also bring a scrambled square back to its home places, which is called resolving the square. In this game you are the caller.',
  ] },
  { title: 'About this version', p: [
    'This is a friendly, simplified puzzle version. Each call is shown for what it does to who stands where, and some calls are shortened. The Rules page lists every simplification. Dancers in square dancing may take either role; the game keeps the traditional words gent and lady for the two places in a couple.',
  ] },
  { title: 'Made with', p: [
    'Square Dance Caller is part of Arcforge, a collection of games from heritage traditions around the world. The hall, the clothes and the figures are drawn by the game; on devices that support it the dancers are 3D people whose models and motion are credited at the end of this page. The fiddle tunes are short original reels made by the game.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', p: [
    'The square is scrambled: dancers are standing on the wrong places. Every dancer has a colour and a number, and every place on the floor has a ring in the colour of the dancer who belongs there. Call figures until every dancer stands on their own ring.',
  ] },
  { title: 'Gents and ladies', p: [
    'Square badges are gents, round badges are ladies. The number is the couple. In the home set couple 1 is at the bottom, couple 2 on the right, couple 3 at the top and couple 4 on the left; the gent stands on the left of the lady as the couple faces the middle.',
  ] },
  { title: 'Make a call', p: [
    'Tap a call on the card to see what it will do: arrows show where every dancer would go and the card says how many would be home. Tap it again, or tap Call it, to sing it. The dancers perform it during the next phrase of music.',
  ] },
  { title: 'Stay a phrase ahead', p: [
    `Each call takes one phrase of ${BEATS} beats. While one call is being danced you can already choose the next one; the ghost circles show where the dancers will be. If no call is ready when the phrase ends, the floor just swings partners and a phrase is lost. Set Pace to Relaxed in Settings to let the music wait for you.`,
  ] },
  { title: 'Phrases and stars', p: [
    `Every square has a shortest way home. Get home in that many phrases for three stars, one more for two stars. The tip ends if the square is not home within ${SLACK_TIP} phrases more than the shortest way.`,
  ] },
  { title: 'Think', p: [
    `Tap the ? button for a hint: the game names a good next call and says why. A square that used a hint costs ${HINT_COST} extra phrase.`,
  ] },
  { title: 'Other ways to play', p: [
    `Tips: ${TIPS.length} tips of ${SQUARES_PER_TIP} squares, each with its own hall and its own card of calls. Endless: squares keep coming and ${MARATHON_LIVES} lost squares end the evening. Practice: choose your card and difficulty. Learn: three short lessons. Watch & Learn: the computer calls a whole square and explains each choice.`,
  ] },
  { title: 'Keyboard', p: [
    'Number keys select a call, Enter or Space sings it, T is Think, P pauses, and the plus and minus keys change the text size.',
  ] },
];

const callRules = () => CALLS.map((c) => `${c.label}. ${RULE_TEXT[c.id]} Places: ${movesText(c)}.`);

export const RULES = [
  { title: 'The floor', art: 'floor', p: [
    'Eight dancers stand on eight places, four couples in a square. Couple 1 is at the bottom of the floor, couple 2 on the right, couple 3 at the top and couple 4 on the left. In each couple the gent stands on the left of the lady as the couple faces the middle. The places are named by couple and role: 1G is the gent place of couple 1, 1L the lady place of couple 1, and so on counter-clockwise from the bottom left.',
    'The bottom and top couples are the heads. The left and right couples are the sides. Heads and sides are named by where they stand on the floor, not by who is standing there.',
  ] },
  { title: 'Home', p: [
    'Every dancer has a home place: the place on the floor with a ring in that dancer\'s colour. A square is resolved when all eight dancers stand on their own rings at the same time. Rings glow when their dancer is home, and the counter shows how many are.',
  ] },
  { title: 'Calls', p: [
    'A call moves dancers from place to place. Every call is exact: the dancer on a place always goes to the same new place, whoever it is. That is why a puzzle can be solved by thinking ahead. The card for each tip lists the calls available in that hall.',
    `A call fills one phrase of ${BEATS} beats of music. The dancers move for most of the phrase and settle on the last beats.`,
  ] },
  ...CALLS.map((c) => ({ title: c.label, art: `call:${c.id}`, p: [RULE_TEXT[c.id], `Places: ${movesText(c)}.`] })),
  { title: 'Swing your partner', p: [
    'When no call has been made in time, the floor swings partners for one phrase. Nobody changes place, but the phrase counts. In Relaxed pace the music waits instead and nothing is lost.',
  ] },
  { title: 'Simplifications', p: [
    'Real square dance has many hundreds of calls and dancers turn and face in ways this game does not track. Here only places matter. Calls such as grand right and left, which on a real floor end with a promenade, are shown as one call that ends with the dancers back in the square. Courtesy turns, facing directions and hand holds are drawn for the eye but do not change the puzzle.',
    'Gents and ladies are the traditional names for the two places in a couple. Any dancer may dance either role in a real square.',
  ] },
  { title: 'Phrases, the tip and stars', p: [
    `The shortest way home for each square is worked out by the game from the calls on the card. Resolving the square in that many phrases earns three stars, one phrase more earns two stars, and any other resolve inside the tip earns one star. The tip is ${SLACK_TIP} phrases longer than the shortest way; if the square is not home by then the tip is over and you can try again.`,
    `Phrases lost to swinging partners, and ${HINT_COST} phrase for a hint, count like calls. Pace changes only how long you have to choose: ${PACES.join(', ')}.`,
  ] },
  { title: 'Tips', p: [
    `There are ${TIPS.length} tips of ${SQUARES_PER_TIP} squares: ${TIPS.map((t) => t.name).join(', ')}. A square opens when the one before it has at least one star. Each tip brings a new card and a longer shortest way home.`,
  ] },
  { title: 'Endless, Practice and Learn', p: [
    `Endless: squares keep coming with a longer way home and a faster tune. Resolve a square for 10 points and 5 more for each star; ${MARATHON_LIVES} squares not resolved in time end the evening, and your best score is kept.`,
    'Practice: choose how many calls are on the card and how many calls long the way home is, then call squares for as long as you like. Learn: three short lessons with one call each, not timed.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    `Think names a good next call and explains it. It freezes the music while you read and adds ${HINT_COST} phrase. Watch & Learn lets the computer call a whole square: it thinks for ${THINK_STEPS.join(', ')} seconds (your choice in Settings), reveals the call it has picked with the arrows, and then calls it. Pause freezes everything exactly where it is.`,
  ] },
  { title: 'Preview and unlock', p: [
    `The free preview counts the time the music is running in Tips and Endless. Menus, Rules, Practice, Learn, Watch & Learn and the time you spend thinking before a first call are free. The web demo plays the first ${DEMO_LEVELS} squares.`,
  ] },
];

// ---- hint / watch explanation ---------------------------------------------------------------------------------------------------------------
export function explainCall(call, homeBefore, homeAfter, left) {
  const lines = [];
  lines.push(`${homeBefore} of 8 dancers are home. The shortest way home is ${left} ${left === 1 ? 'call' : 'calls'}.`);
  lines.push(`${call.label}: ${RULE_TEXT[call.id] || call.say}`);
  if (homeAfter > homeBefore) lines.push(`After it ${homeAfter} of 8 are home.`);
  else if (homeAfter === homeBefore) lines.push(homeAfter === 8 ? 'After it the square is home.' : 'It does not bring anyone home yet, but it sets up the call after it.');
  else lines.push('A step back, but it puts the dancers where the next call can fix them.');
  return lines;
}
export { COUPLES };
