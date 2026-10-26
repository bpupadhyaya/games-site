// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
//   sim.js   60 s round (+15 s extra time when stance is within 0.03), weight target = 0.72 x steer + 0.30 x sway + 0.58 x the rival's
//            steer (an opposing steer cancels up to 60 % of that drag), the weight follows as a damped spring, hook swing 0.28 s,
//            lands when the rival's leg is at least 0.14 light and your own foot at least 0.05 light, stance cost 0.09 + 0.115 x
//            lightness (+0.04 with your foot well unloaded), stun 0.6 s (steer at 15 %), hooker reaches 0.45 s after a land and 0.55 s
//            after a miss (stance -0.09; a step-over gives the rival +0.02), two hooks landing together clash (0.4 s, -0.04),
//            stance regenerates 0.06/s while |weight| < 0.45 and not stunned or hooking
//   ai.js    five rivals, Think coach, Watch & Learn
//   game.js  best of three rounds, first to two, hook buffer 0.18 s, tap = under 26 units of travel and 0.32 s, the 90 s preview
// A section is { title, art?, p: [paragraphs] }; the reader lays the text out so nothing overflows at any text size.

export const ABOUT = [
  { title: 'Glima', art: 'stage', p: [
    'Glima is the traditional wrestling of Iceland, where it has been practised for many centuries. Two athletes stand upright, each wearing a belt and thigh straps, and hold each other by them. They circle in a slow, deliberate dance and try to unbalance one another with hooks, lifts and sweeps of the leg, without ever dropping into a low crouch.',
    'It is valued for good manners as much as for strength: athletes shake hands before and after, and it is taught to children and adults in clubs across the country. Iceland has a national federation and holds championships every year.',
  ] },
  { title: 'This version', p: [
    'Glima turns the heart of the sport into a duel of balance and timing. You see the ring from behind and a little above, and you are always the athlete in front, with the rival facing you. One thumb steers your weight and drags the belt; a tap hooks a leg. The gold glow on a leg tells you where a hook can land, and the weight rails under the picture show who stands on which foot.',
    'Play against five rivals, or play Watch & Learn: two computer athletes play a whole match while they explain every choice, with a real Pause.',
  ] },
  { title: 'Rings', p: [
    'Green Turf is a mown meadow in daylight, Sports Hall is a timber floor with lamps and a hushed crowd, and Winter Field is a snowy ring at dusk. The rings only change the look; the rules are the same.',
  ] },
  { title: 'About the rules', p: [
    'The game keeps the heart of the sport: upright, holding the belt, circling, winning by a clean unbalancing of the leg. It simplifies how a real bout is judged, and the Rules pages say exactly how everything in the game works. The athletes are generic, and nobody is hurt: a fall is a soft sit-down on the mat.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'stage', p: [
    'You are the athlete in front, nearest the screen. Both of you stand on two feet, and your weight is always more on one of them. Hook the other athlete\'s LIGHT leg while they cannot step over it, and wear down their stance until they fall. Win two rounds to win the match.',
  ] },
  { title: 'Steering', art: 'meters', p: [
    'Put a thumb anywhere on the screen and drag left or right. You step your weight that way and you drag the belt that way, which pulls the other athlete\'s weight the same way unless they steer against you. The ring where your thumb landed follows your thumb, so you never run out of room.',
    'Under the picture, each weight rail shows where an athlete\'s weight sits: gold on a side means that leg is light.',
  ] },
  { title: 'Hooking', art: 'hook', p: [
    'Tap HOOK LEFT or HOOK RIGHT (or tap the left or right half of the picture) to swing the foot on that side at the other athlete\'s leg on that side. It takes a little over a quarter of a second to swing. It lands when that leg is light and your own foot is light too: a dashed gold link in the picture joins two light legs.',
    'If they put their weight onto that leg before the swing arrives, you are stepped over and left reaching. Hooks you only half mean cost you stance, so wait for the sway to bring a light leg.',
  ] },
  { title: 'Stance', p: [
    'STANCE is how steady an athlete is. A landed hook costs more the lighter the leg was. A missed hook costs you a little. Standing near the middle brings stance back. When stance runs out the athlete falls and the round is over; at the end of the clock the higher stance wins.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think pauses the round and the coach suggests the best move for this moment, with a ring or an arrow showing what to do. Watch & Learn plays a whole short match between two computer athletes: it thinks, shows its choice with a card that explains it, then plays. Use Pause, Speed and the Think time buttons as you like.',
  ] },
];

export const RULES = [
  { title: '1. What you are playing', art: 'stage', p: [
    'A match is the best of three rounds: the first athlete to win two rounds wins. In each round two athletes stand chest to chest holding each other\'s belt on a ring. You are the athlete in front, at the bottom of the picture and seen from behind, and the rival faces you from the far side. Both athletes use the same left and right of the screen, so "left" always means the left of the picture.',
    'There are three ways to win a round: bring the rival\'s stance to empty with hooks (a fall), wear them down when their own missed hooks empty their stance, or have the higher stance when time runs out.',
  ] },
  { title: '2. Weight', art: 'meters', p: [
    'Every athlete has a weight, from fully on the left foot to fully on the right foot. The athlete\'s weight follows a target like a spring: it settles within about a quarter of a second.',
    'The target is 0.72 times your steer, plus a sway of up to 0.30 that rocks the weight from foot to foot at 0.55 to 0.85 steps a second (the dance), plus the pull of the rival\'s belt (section 3). A leg is "light" when the weight is on the other side: a weight of 0.5 to the right makes the left leg 0.5 light. A light leg is gold on the weight rails and glows in the picture.',
  ] },
  { title: '3. Steering and the belt', p: [
    'Dragging your thumb steers from -1 (full left) to +1 (full right) and the steer follows your thumb in about a tenth of a second. A steer moves your own target and also drags the rival\'s: they are pulled by 0.58 times your steer.',
    'If the rival steers the opposite way they cancel up to 60 % of that drag. So an athlete who steers against a pull stays put, but is then moving their own weight the other way.',
  ] },
  { title: '4. Hooks', art: 'hook', p: [
    'A hook swings the foot on one side at the rival\'s leg on the same side of the picture. It takes 0.28 seconds. When it arrives, it lands if the rival\'s leg is at least 0.14 light AND your own foot on that side is at least 0.05 light. Otherwise it misses.',
    'Only one hook can swing at a time, and a hook cannot start while you are reaching after a miss or wobbling. A tap just before you are ready is kept for 0.18 seconds.',
  ] },
  { title: '5. What a hook does', p: [
    'A landed hook costs the rival stance of 0.09 plus 0.115 times how light the leg was (and a little more when your own foot was well unloaded), makes them wobble for 0.6 seconds (their steer is only 15 % as strong then), and cancels any hook they were swinging. You then reach for 0.45 seconds.',
    'A missed hook that was stepped over costs you 0.09 stance and 0.55 seconds of reaching, and gives the rival 0.02 stance. A hook with your own foot loaded (an off-balance hook) costs the same. If both athletes\' hooks arrive on the same tick they clash: both wobble and lose 0.04 stance.',
  ] },
  { title: '6. Stance', p: [
    'Stance starts full. It runs down with hooks taken and hooks missed. While an athlete is not wobbling, not hooking, and the weight is within 0.45 of the middle, stance comes back at 0.06 per second.',
    'When a hook takes the rival\'s stance to empty that is a fall and you win the round. When your own missed hooks empty your stance, the rival wins the round.',
  ] },
  { title: '7. Time and points', p: [
    'A round lasts 60 seconds (30 seconds in Watch & Learn). If nobody has fallen by then the athlete with the higher stance wins. If the stances are within 0.03 of each other, fifteen seconds of extra time are played once. After that the higher stance wins, and in a dead heat the athlete standing nearer the middle wins.',
  ] },
  { title: '8. The five rivals', p: [
    'Aino reads the round late and swings at nothing now and then. Birna is steady and patient. Eirik hooks early and often. Sigrun reads you quickly and loads the leg in time. Magnus, the champion, waits for a clean opening and rarely wastes a hook.',
    'All five follow the same rules as you. They see the same rails, and a stronger rival simply reads them sooner. A rival\'s view of you is delayed by a fraction of a second, longer for the weaker rivals.',
  ] },
  { title: '9. Think and Watch & Learn', p: [
    'Think pauses the round and the coach names the best action for this moment (hook, pull them over, load a leg, or stand tall), shows a ring or an arrow and says why. It is a suggestion, and the clock does not run while the card is up.',
    'Watch & Learn plays a match between two computer athletes. At key moments it stops to think (you choose 2 to 10 seconds), shows its choice with a card and then carries on. Pause freezes everything exactly where it is.',
  ] },
  { title: '10. Simplifications', p: [
    'In a real bout the athletes also use lifts and throws, a fall means touching the ground above the knee, and judges give warnings and points. Here a fall is stance running out, a hook is one leg sweep, and the athletes are generic. The rings are invented for the game and there are no flags or symbols.',
  ] },
  { title: '11. Free to play', p: [
    'Free to play with short ads. Watch & Learn, the menus and the rules are always free to use. In the web demo the first three rounds against the first two rivals on Green Turf are free, and the full game is on iPhone and Android.',
  ] },
];

// The About screen shows the licence text of the 3D layer (web/vendor3d/LICENSES.md, fetched by main.js) as extra sections.
export function creditSections(md) {
  if (!md) return [];
  const out = [];
  for (const chunk of String(md).split(/\n(?=## )/)) {
    const m = /^## (.+)\n([\s\S]*)$/.exec(chunk.trim());
    if (!m) continue;
    const paras = m[2].split(/\n\s*\n/).map((t) => t.replace(/\n\s*/g, ' ').replace(/^\*\s+/, '').replace(/`/g, '').trim()).filter(Boolean);
    const split = [];
    for (const para of paras) { if (/^\* /.test(para)) para.split(/ \* /).forEach((x) => split.push(x.replace(/^\* /, ''))); else split.push(para); }
    out.push({ title: m[1].replace(/:.*$/, '').trim(), p: split });
  }
  return out.length ? [{ title: 'Credits', p: ['The athletes and the way they move come from the open libraries below.'] }, ...out] : [];
}
