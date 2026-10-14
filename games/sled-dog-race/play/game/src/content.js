// All reader text (About, How to Play, Rules). Numbers come from consts.js so the Rules page always matches the engine.
import {
  RACES, DOGS, CARE, LAYOVER, LAYOVER_E, DETOUR_S, HINT_COST, STAR_CARE, TIRED_E, REJOIN_E, TRAIL_LIVES, PRAISE_CD, V_MAX, STEEP, BRAKE_V, VIS, RIVALS, LEG_STRIKE,
} from './consts.js';
import { GAITS } from './sim.js';

const pct = (v) => `${Math.round(v * 100)}%`;

export const ABOUT = [
  { title: 'Sled dog racing', p: [
    'Dog sled racing, called mushing, comes from the cold north of Canada and the United States, where teams of dogs have pulled sleds across snow and ice for generations. Today it is a sport as well: a driver, called the musher, and a team of dogs race a trail that can be a few kilometres or hundreds, with checkpoints along the way where the dogs are fed, watered, checked and rested.',
    'The dogs are partners. A good musher knows each dog by name, watches paws and appetite, and slows down when the team needs it. The best teams are the ones that arrive fresh.',
  ] },
  { title: 'About this version', p: [
    'This is a friendly, simplified one-player version. You see the trail from the side, set the team\'s pace, call Gee and Haw at the junctions and look after the dogs at the checkpoints. No dog is ever hurt: a tired dog simply rides in the sled bag and rests.',
    'Real races are much longer and have many more rules. The courses here are short, and the Rules page lists every simplification.',
  ] },
  { title: 'Made with', p: [
    'Sled Dog Race is part of Arcforge, a collection of games from heritage traditions around the world. Everything on screen is drawn by the game itself, and all sounds are made by the game.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', p: [
    'Drive your team of six dogs along the trail and reach the finish before the other teams, with dogs that are still happy and well. Pace is everything: faster is quicker, but tires the dogs.',
  ] },
  { title: 'Set the pace', p: [
    `Slide your thumb along the pace lever to choose how hard the dogs run: ${GAITS.map(([n]) => n).join(', ')}. The lever stays where you leave it. Watch the six dog chips: each shows a dog's energy, water, paws and mood.`,
  ] },
  { title: 'Hills and the brake', p: [
    'Climbs slow the team and tire it. On a long steep downhill, tap Brake to drag the claw so the sled does not run up behind the wheel dogs. Tap Brake again to let go. A yellow sign warns you.',
  ] },
  { title: 'Gee and Haw', p: [
    'Junction signs say which way the marked trail goes. When the call marker lights up, tap Gee for right or Haw for left, in time. The lead dogs answer. The wrong way or a late call is a detour.',
  ] },
  { title: 'The checkpoint', p: [
    'The clock keeps running while you care for the dogs. Choose water, snacks, paw checks and booties, praise and rest, for the whole team or for one dog you tap. When you are ready, tap Leave. The vet looks at every dog as you arrive.',
  ] },
  { title: 'Praise and Think', p: [
    'Tap the trail to praise the dogs on the run: they like it and the leaders answer calls better. Tap ? for a hint: the game tells you what it would do now. A hint adds a second to the leg.',
  ] },
  { title: 'Winning', p: [
    `Beat the rival teams to the finish. Arrive with a care score of ${pct(STAR_CARE)} or more and you also win the Care Award.`,
  ] },
];

const GAIT_ROWS = GAITS.map(([n, v], i) => `${n}: pace ${pct(v)} and up${i === GAITS.length - 1 ? '' : ` (to ${pct(GAITS[i + 1][1])})`}`);
export const RULES = [
  { title: 'Goal', p: [
    'Drive the team along every leg of the trail to the finish as fast as you can without wearing the dogs out. The race is won by the clock. The Care Award is won by how well the team arrived.',
    'This is a score-only game: nothing is wagered and nothing is bought during play.',
  ] },
  { title: 'The team', art: 'team', p: [
    `Six dogs run in three pairs: the leaders in front, the swing dogs, and the wheel dogs next to the sled. ${DOGS.map((d) => `${d.name} (${d.role.toLowerCase()}, ${d.blurb.toLowerCase()})`).join('; ')}.`,
    'Each dog has four values from empty to full: energy, water, paws and mood. The team pulls with the sum of the dogs, and a tired, thirsty, sore-pawed or unhappy dog gives less.',
  ] },
  { title: 'Pace', p: [
    `The pace lever goes from 0 to 100%. ${GAIT_ROWS.join('. ')}.`,
    `A fresh team at a full gallop on the flat runs about ${V_MAX} metres a second. At a walk it runs a little over a quarter of that.`,
    'Energy drains slowly at a walk and quickly at a gallop (it costs more than twice as much to gallop a metre as to trot it), and a team that has run low pulls less. Climbing costs extra energy and slows the team; descending lets it run faster.',
  ] },
  { title: 'Water, paws and mood', p: [
    'Water drains a little faster the harder the dogs run. Paws wear faster on the rough ice, and a dog wearing booties wears them much more slowly; booties last for the leg after the one where they were fitted.',
    'Mood follows how the dog is doing: it falls when energy, water or paws run low, and when the team is driven at a flat-out gallop. Praise lifts it. A dog in a good mood pulls better and the leaders answer calls reliably.',
  ] },
  { title: 'Hills and the brake', art: 'trail', p: [
    `A downhill steeper than ${Math.round(-STEEP * 100)}% is marked by a yellow sign. If the team is going faster than 9 metres a second on it with the brake up, the sled overruns the wheel dogs: the team is slowed and the two wheel dogs lose mood. Tap Brake to drag the claw: with the brake down the team is held to ${BRAKE_V} metres a second and slows quickly. Tap Brake again to lift it (a long press holds it down until you let go).`,
  ] },
  { title: 'Junctions: Gee and Haw', p: [
    `A sign board stands at every junction. Gee means turn right and Haw means turn left. The sign can be read from ${VIS.clear} metres in clear weather, ${VIS.snow} in snowfall and only ${VIS.whiteout} in a whiteout. The call marker lights up shortly after the sign comes into view. Tap the matching button while the marker is lit.`,
    `If the lead dogs are in a poor mood they need the call twice. If you miss the junction or call the wrong way, the team takes the wrong trail: ${DETOUR_S} seconds are added, the team slows and its mood dips.`,
  ] },
  { title: 'Rough ice and weather', p: [
    'Patches of rough ice (shown in pale blue) wear paws three times as fast. Snowfall and whiteout make the going a little heavier and cut how far you can read a sign.',
  ] },
  { title: 'Tired dogs', p: [
    `A dog whose energy falls to ${pct(TIRED_E)} is lifted into the sled bag and rides while it recovers a little (the team pulls without it). It is put back in harness by itself when its energy is back to ${pct(REJOIN_E)}, or you can tap its card at a checkpoint to put it in or out of the bag. Carrying dogs costs care score.`,
  ] },
  { title: 'Checkpoints and care', p: [
    `Every leg but the last ends at a checkpoint. A layover of ${LAYOVER} seconds is added to the clock and every dog regains ${pct(LAYOVER_E)} energy. Then you may care for the dogs; every action costs seconds on the race clock.`,
    `${['water', 'snack', 'paws'].map((k) => `${CARE[k].name}: ${CARE[k].one} s for one dog, ${CARE[k].all} s for the whole team (${CARE[k].text})`).join('. ')}. Rest: ${CARE.rest.all} s, the whole team recovers ${pct(CARE.rest.gain)} energy. Praise: ${CARE.praise.one} s for one dog or ${CARE.praise.all} s for the team. Bag: ${CARE.bag.one} s to put a dog in or out of the sled bag.`,
    'Tap a dog card to choose one dog; tap it again to choose the whole team. Tap Leave when you are ready; the next leg starts when you tap Go.',
  ] },
  { title: 'The vet check and care score', p: [
    'As the team arrives at each checkpoint and the finish, the vet looks at every dog and gives it a wellbeing mark from its energy, water, paws and mood (energy counts most). The care score is the average of those marks, less a little for every dog carried in the bag, every overrun and every detour.',
    `A care score of ${pct(STAR_CARE)} or more wins the Care Award. The check happens as the team arrives, before you can care for the dogs, so easing off before the checkpoint is what counts.`,
  ] },
  { title: 'Rivals and stars', p: [
    `Three rival teams (${RIVALS.map((r) => r.name).join(', ')}) race the same trail. Their pace is set from a well-driven run of the same trail. A star is awarded for a podium place (first or second), a second star for winning and a third for winning with the Care Award. The next race in the Trail Cup opens when you finish in the top two.`,
  ] },
  { title: 'Trail Run', p: [
    `An endless trail of legs with a checkpoint after each. Each leg has a target time. A leg more than ${Math.round((LEG_STRIKE - 1) * 100)}% over its target, or one that ends with a dog in the bag, is a strike; ${TRAIL_LIVES} strikes end the run. Dogs are not replaced between legs, so care for them.`,
  ] },
  { title: 'Practice, Learn and Watch & Learn', p: [
    'Practice lets you drive any race without the stars. Learn has three short drills. Watch & Learn lets the computer drive a whole race: it stops to think, shows what it has decided and why, and then does it. You can pause it at any moment, and lengthen or shorten its thinking time.',
    `The ? hint button tells you what the computer would do now. A hint adds ${HINT_COST} second to the leg. Praise on the trail can be given once every ${PRAISE_CD} seconds.`,
  ] },
  { title: 'Controls', p: [
    'Touch: the pace lever, Haw, Brake and Gee buttons; tap the trail to praise; tap dog cards at a checkpoint. Keyboard: Up and Down set the pace, Left is Haw, Right is Gee, Space or S is Brake, Enter sets off or leaves a checkpoint, T hint, P pause, Plus and Minus change the text size.',
  ] },
  { title: 'What is simplified', p: [
    'The courses are a few hundred metres, not hundreds of kilometres; a real team may have twelve or more dogs, with dogs dropped at checkpoints and a mandatory long rest. There are no real race names. The dogs in this game are never hurt; a tired dog rides and rests.',
  ] },
];
