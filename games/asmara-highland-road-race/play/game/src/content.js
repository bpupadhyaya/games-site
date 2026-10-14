// About, How to Play and Rules text. Sections: { title, p: [paragraphs], art?: illustration key (menus.js drawArt) }.
// Every number here is the number the engine in sim.js uses.
export const ABOUT = [
  { title: 'Asmara Highland Road Race', p: [
    'A stage race for the roads of the Eritrean highlands, where cycling is one of the best-loved sports in the country and the roadside fills with spectators when a race comes through.',
    'You manage three riders against five rival teams. Nobody wins by pedalling hardest all the time: you choose when to hide in the group, when to pull, when to save your legs and when to attack.' ] },
  { title: 'Where it comes from', p: [
    'Cycling came to Eritrea early in the twentieth century and grew into a national passion. Races such as the Tour of Eritrea send riders over the escarpment road between the coast and the high plateau, with hairpin after hairpin and a climb of more than two thousand metres.',
    'The capital, Asmara, sits at about 2,300 metres. At that height the air is thin, which this game models: it changes how much the wind costs you.' ] },
  { title: 'What is simplified', p: [
    'Stages are shortened so a race takes a few minutes, and the race clock runs faster than real time. Riders, teams and jerseys are invented and generic: they are not real people or real teams.',
    'The physics are a simple model of a rider\'s power, the road gradient, wind, slipstream and a limited reserve of hard effort. It is built to reward good pacing, not to be a training tool.' ] },
  { title: 'A note', p: [
    'Part of the Arcforge collection of heritage games. No ads, no stakes and no betting: it is a pacing game from start to finish.' ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'profile', p: [
    'Get one of your three riders across the line first. The strip at the top is the stage: green is flat, yellow and orange climb, red is steep and blue is downhill.',
    'Your riders have a limited reserve of hard effort (the green bar). Burn it too early and your rider cracks and crawls. Keep it too long and someone else wins.' ] },
  { title: 'Choose a rider, choose an effort', art: 'effort', p: [
    'Tap one of your three cards, or the rider in the picture, to take control of that rider. Then choose an effort:',
    'EASE: soft pedalling that refills your reserve.',
    'SIT IN: stay on the wheel in front. With nobody close ahead you ride just below your limit.',
    'PUSH: press on harder than your limit, slowly spending the reserve.',
    'ATTACK: all out. Fast, and the reserve drains quickly.' ] },
  { title: 'Use the slipstream', art: 'draft', p: [
    'A rider tucked just behind another needs about a third less effort on the flat. On steep climbs the effect is small, so that is where groups break apart.',
    'A rider pulling at the front is working for everybody. Use a teammate to pull, then come past.' ] },
  { title: 'The last 300 metres', p: [
    'In the final 300 metres everyone sprints with whatever reserve is left, so arrive with something in the tank.' ] },
  { title: 'Help from the game', p: [
    'Think asks the game to try the next minute several ways on a copy of the race and tells you which looks best.',
    'Speed 1x, 2x or 4x changes how fast the race plays; Pause stops everything.',
    'Watch & Learn plays a whole stage for you, thinking out loud before each decision.' ] },
];

export const RULES = [
  { title: '1. The race', p: [
    'Six teams of three riders race one stage. The first rider over the line wins the stage. The race ends when all three of your riders have finished (or seven minutes of race time after the winner).',
    'Stars: the best of your riders wins the stage for three stars, finishes on the podium for two, or in the top six for one.' ] },
  { title: '2. The stages', art: 'profile', p: [
    'Six stages, each with its own gradients, wind and hairpins: Dekemhare Plateau, Nefasit Switchbacks, Massawa Road Descent, Keren Crosswind, Highland Circuit and Asmara Grand Finale.',
    'Each sample of the road (every 10 metres) has a gradient, a headwind and a speed limit. Downhill stretches and hairpins limit speed; air density falls with altitude.' ] },
  { title: '3. Riders', p: [
    'Captain: balanced, with the largest reserve for attacks. Climber: light and strong uphill, a smaller reserve and less sprint. Rouleur: heavier and powerful on the flat and in the wind, with a good sprint.',
    'Every rider has a critical power (the effort they can hold), a reserve (how much hard effort is stored above it), a body weight and a drag area. Rider strengths vary slightly from race to race.' ] },
  { title: '4. Efforts', art: 'effort', p: [
    'EASE: 72% of critical power.',
    'SIT IN: follow the rider directly ahead if they are within 55 m, matching their speed and closing the gap gently, never above 103% of critical power (97% when the reserve is nearly gone); with nobody ahead, 97% of critical power.',
    'PUSH: 115% of critical power. ATTACK: 140% of critical power.',
    'The effort you set stays set until you change it. Riders set automatically (rivals, and your riders in Watch & Learn) follow the same rules.' ] },
  { title: '5. The reserve', art: 'reserve', p: [
    'Power above critical power spends the reserve one for one. Power below it refills the reserve at half the difference, a little slower when it is nearly full.',
    'At zero the rider cracks: power is limited to 80% of critical power until the reserve climbs back to 20%.',
    'Long, hard efforts also tire a rider: critical power falls slowly, by up to a fifth over a very hard day.' ] },
  { title: '6. Slipstream', art: 'draft', p: [
    'A rider less than 9 m behind another loses up to 36% of air drag; a second rider ahead within 12 m adds up to 9% more. The closer, the better. The slipstream is not used in the time trial.' ] },
  { title: '7. Speed', p: [
    'Each second the game finds the speed at which the power a rider spends equals the forces on them: climbing, rolling resistance and air drag (with the wind). Speed then eases towards that value over about two seconds.',
    'Downhill, speed is capped by the road; effort that is not needed is not spent, so descents refill the reserve.' ] },
  { title: '8. The finish', p: [
    'Everyone sprints in the last 300 m: power rises by whatever the remaining reserve can supply over the time left, up to 62% of critical power, multiplied by the rider\'s sprint rating (Climber 0.97, Captain 1.0, Rouleur 1.03). A cracked rider cannot sprint.',
    'Finishing times are measured to a fraction of a second.' ] },
  { title: '9. Rival teams', p: [
    'Rivals sit in the group, send helpers to pull in the second half of the stage, cover a rider who rides away, and launch their own attack when the stage is nearly done; bold leaders go earlier on steep ground. Four field strengths set how strong the rivals are: Club, Regional, National and Elite.' ] },
  { title: '10. Time trial', p: [
    'Just you against a ghost. The ghost spends its reserve evenly over the stage. Beat its time for gold, finish within 2% for silver or within 5% for bronze. There is no slipstream.' ] },
  { title: '11. Think and Watch & Learn', p: [
    'Think tries a set of orders for your team over the next 50 seconds on copies of the race, lets everyone else follow their normal tactics, and ranks the results by the finishing position of your best rider, then by time. Its advice assumes the rivals keep to their usual tactics.',
    'Watch & Learn is the same planner playing for your team while the clock stands still: it thinks, shows what it chose and the alternatives, then rides. Pause freezes everything.' ] },
  { title: '12. Differences from the real thing', p: [
    'Stages are about 12 to 23 km, a fraction of real stage lengths, and the clock is sped up. Wind does not change direction, there are no punctures, crashes, feed zones or team cars, and the road is a single line without corners that slow the group.' ] },
];
