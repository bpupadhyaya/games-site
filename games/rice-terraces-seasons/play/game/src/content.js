// All reader text: About, How to Play, the exhaustive Rules, the story vignettes, the festival lines and the journal. Every number in the Rules is the number farm.js uses.
export const ABOUT = [
  { title: 'Rice Terraces', p: [
    'Tend a mountainside of rice terraces through a whole year. Carry the spring water down the steps with gates and channels, soak the fields, plant, weed, repair the walls after the rain, and bring in the golden harvest.',
    'Two chapters, two places: the stone-walled terraces of the Cordillera in the Philippines, and the shared-water fields of Bali in Indonesia. Each year is a new hillside with new weather.'] },
  { title: 'About the terraces', art: 'seasons', p: [
    'In the mountains of the Cordillera, farmers have cut terraces into the slopes for many centuries. The walls are built of stacked stone and packed earth, and the water comes from springs high above, led from field to field by small channels. Keeping the walls strong is work for the whole village, and neighbours help one another with it.',
    'In Bali, rice fields are watered by canals and tunnels that share a river between many farms. Farmers belong to a water-sharing group called a subak. They meet to agree who receives water and when, so that the fields at the bottom get as fair a share as the fields at the top.'] },
  { title: 'How it is made', p: [
    'The water, the rice, the weather and the walls are simulated in small steps, so the same choices always give the same result. The hillside is drawn in real 3D with water that mirrors the sky.',
    'The people you meet are fictional villagers with plain first names. No brand names are used.'] },
];

export const HOWTO = [
  { title: 'Your year', art: 'seasons', p: [
    'Each year has four seasons: Soak, Plant, Grow and Golden. A bar at the top shows where you are. Every season asks for a different amount of water in each field.',
    'Under every field is a small gauge with a green band. Keep the water level inside the band. The band changes with the season.'] },
  { title: 'Moving the water', art: 'gates', p: [
    'Tap a round gate marker to open or close it. Feed gates sit at the top and let the spring in. Spill gates sit in the walls and let a field empty into the field below. Side channels join two fields on the same tier. A gate with a cross is plugged for this year.',
    'Water runs downhill only through open spill gates, and levels out through open side channels. Closing a gate holds the water in.'] },
  { title: 'Work in the fields', art: 'band', p: [
    'Tap a field to select it. The sheet shows its water, soil, rice health, weeds, snails and wall, and the jobs you can do: Plant, Weed, Clear snails, Harvest and Repair wall. Each job costs labour and is done by a farmer in a few seconds.',
    'Labour comes back slowly. Spend it where it matters most: plant early, repair weak walls before a storm, harvest as soon as the rice is gold.'] },
  { title: 'Time and the weather', p: [
    'Press the speed button for 1x, 2x or 3x. Pause is always free and you can still open and close gates while paused. Rain helps, a storm cracks walls, and a dry spell shrinks the spring.',
    'Between the seasons a villager tells a short story and the year goes on when you tap Continue.'] },
  { title: 'Think, and Watch & Learn', art: 'think', p: [
    'Think pauses the year and shows what the computer farmer would do next and why. You can follow the advice with one tap or ignore it.',
    'Watch & Learn plays a whole year by itself. It thinks, shows what it chose, then does it. You can pause it at any moment, and make it slower or faster.'] },
  { title: 'Keyboard (web)', p: [
    'Arrow keys move the pointer between gates and fields. Space or Enter opens a gate or selects a field. J plants, W weeds, S clears snails, H harvests, R repairs. P pauses, 1 2 3 set the speed, T is Think. Plus and Minus change the text size.'] },
];

export const RULES = [
  { title: 'The goal', p: [
    'Finish the year with as much healthy rice harvested as you can, a fair share for the neighbours and the valley, and strong walls. The year ends when the Golden season ends; rice not harvested by then is lost.',
    'Your score is the weighted average of four things: your harvest (50 percent), your neighbours\' harvest (20 percent, only when neighbours farm part of the hill), the valley\'s share of water (12 percent, only when the year has one) and the average strength of the walls (18 percent). The weights are rescaled when a part is missing. 45 percent earns one star, 68 percent two stars, 85 percent three stars.'] },
  { title: 'Water', art: 'water', p: [
    'Water is measured in hands. A field holds 0 (dry mud) to 4 (full to the brim). Each field shows its level and the band it wants right now.',
    'The spring gives a fixed number of hands per second for the year (1.5 in the first year up to 3.1 in the last), shared equally between the open feed gates. In a dry spell the spring gives half, in rain 1.35 times and in a storm 1.5 times. If every feed gate is shut the spring water runs away to the stream and is wasted.',
    'Rain also falls on every field: 0.12 hands per second in rain, 0.28 in a storm. Evaporation takes 0.016 hands per second (0.05 in a dry spell, 0.004 in rain).'] },
  { title: 'Gates and channels', art: 'gates', p: [
    'An open spill gate lets a field empty into the field below at 0.55 of the water above 0.12 hands each second, as long as the field below has room (up to 4.5 hands). The spill gate of the last tier is the valley outlet: its water flows to the village below and counts for the valley\'s share.',
    'An open side channel levels two neighbouring fields of a tier: each second it moves half of the difference, at most 1.8 hands per second. A feed gate lets the spring into the top field of its column.',
    'A plugged gate (shown with a cross) cannot be opened this year. Opening and closing gates costs nothing and can be done while paused.'] },
  { title: 'Full fields and walls', p: [
    'A field never holds more than 4 hands. If a field is full and its spill gate is shut, the extra water goes over the wall: 60 percent of it falls into the field below, the rest is lost, and the wall is worn by 0.048 for every hand that spills. If the spill gate is open, the extra goes down it.',
    'Every field has a wall. A weak wall leaks: each second it passes down (1 minus the wall strength) times 7 percent of the water. A wall at zero has collapsed and the field empties down the slope at 1.3 hands per second until the wall is repaired. During a storm all walls also wear slowly.'] },
  { title: 'Soak (40 seconds)', art: 'band', p: [
    'Fields want 2.5 to 3.5 hands. While a field holds between 2.4 and 3.7 hands its soil softens by 1 every 20 seconds. A field is ready to plant when its soil is at 0.7 (about 14 seconds in the band). Soil dries slowly (1 per 90 seconds) when the field holds under 1 hand.'] },
  { title: 'Plant (40 seconds)', p: [
    'Fields want 2 to 3.5 hands until planted and 1.5 to 3 afterwards. A field can be planted when the soil is at least 0.7 and it holds at least 1 hand. Planting costs 1 labour and takes about 5 seconds. A field not planted by the end of this season stays empty all year.',
    'A new seedling starts at health 0.9 or more. Growth takes about 55 seconds (a little longer if health is low). The seedling becomes growing rice at 30 percent.'] },
  { title: 'Grow (60 seconds)', p: [
    'Planted fields want 1.5 to 3 hands. Inside the band, health recovers 0.01 per second. Outside it, health falls 0.04 per second for each hand of distance, and below 0.25 hands it falls a further 0.06 per second.',
    'Weeds grow 0.011 per second and take 0.009 health per second at full strength. Snails grow 0.006 per second (1.6 times faster in a dry spell, and only 0.3 times as fast in water over 2.4 or under 0.4 hands) and take 0.014 health per second at full strength. A field kept above 3.2 hands drowns the snails at 0.05 per second. Weeding and clearing snails each cost 1 labour and are offered once the level reaches 0.35.'] },
  { title: 'Golden (50 seconds)', p: [
    'When the rice has finished growing the Golden season turns it gold. Drain the field to 1 hand or less (gold ripens only at 1.2 or below, 1 gold unit per 16 seconds). Above 1.2 hands the rice loses health, and rain on gold rice costs 0.004 health per second.',
    'Harvest costs 1 labour and takes about 5 seconds. The harvest counts the rice\'s health at that moment. Anything standing when the year ends is lost.'] },
  { title: 'Labour and farmers', p: [
    'Labour is a pool of 6 that refills slowly (0.22 per second in the first year, up to 0.28; a larger village adds 4 percent per house). Jobs cost: plant 1, weed 1, clear snails 1, harvest 1, repair wall 2 (3 when the wall has collapsed). Times: plant 4.6 s, weed 4.0 s, snails 4.2 s, harvest 5.0 s, repair 6.4 s.',
    'Only as many jobs run at once as you have farmers (2 to 4, one more in a village of six houses).',
    'In the Cordillera each season begins with a community work day: everyone helps, adding 3 labour and 12 percent to every wall.'] },
  { title: 'Weather and pests', p: [
    'Each year has its own weather: rain, dry spells and storms at fixed times, and waves of snails in chosen fields. The calendar bar shows the season; the weather chip names what is happening now.',
    'A storm cracks about half of the walls, each losing between 0.14 and 0.46 of its strength. Repairing adds 0.6.'] },
  { title: 'Neighbours and the valley', p: [
    'In some years part of the hill belongs to neighbour groups. They plant, weed, clear snails and harvest their own fields (a few seconds after each is possible), but they depend on the water you route. You can help them only by repairing their walls when weaker than half.',
    'Water that leaves through the valley outlets and over the last wall counts for the village in the valley. Its fair share is about 28 percent of the spring\'s water for the year. Meet it and you earn the full valley share of the score.'] },
  { title: 'Stars, the village and the journal', p: [
    'Every star you earn adds to the village: houses appear on the ridge, and a bigger village gives more labour. A journal page is added for each year you finish, and extra pages for special moments (a first full harvest, a repaired collapsed wall, a fair share for the valley).',
    'In the free web demo the first year of each chapter is playable. The full game has all eight years.'] },
  { title: 'Watch & Learn', p: [
    'The computer farmer tries every gate change on a copy of the hillside, simulates the next 14 seconds and picks the change that keeps the most fields inside their band. Jobs follow an order of urgency: harvest, strong repairs, planting, snails, weeds. Each choice is shown with its reason before it is done.'] },
];

// Story vignettes: one per year (the villager who greets you, in levels.js), one per season per chapter, and the festival lines.
export const SEASON_STORY = [
  [  // Cordillera
    { who: 'Lola Dalisay', role: 'keeper of the old terrace', look: 'f', text: 'Soaking is patient work. The mud must drink until it is soft as butter. Water first, then hands.' },
    { who: 'Mang Kalinga', role: 'wall builder', look: 'm', text: 'Plant while the mud is warm. Stand tall at the end of the row and the seedlings seem to march on their own.' },
    { who: 'Ate Maymay', role: 'weaver and farmer', look: 'f', text: 'Now we watch. Weeds, snails, clouds. Walk the walls every evening and listen: a wall that is about to fail whispers.' },
    { who: 'Apo Lakay', role: 'village elder', look: 'm', text: 'Gold on the hill! Let the water go and bring your sickles. The whole village will help carry the harvest down.' },
  ],
  [  // Bali
    { who: 'Bu Made', role: 'canal keeper', look: 'f', text: 'First we flood the fields and wait. The canal sings when it is full, and the frogs answer from every step.' },
    { who: 'Pak Wayan', role: 'farmer', look: 'm', text: 'Seedlings go in bare-footed, row by row. Leave a little water for the neighbour and they will do the same for you.' },
    { who: 'Ni Luh', role: 'water measurer', look: 'f', text: 'Slow season. Check the gates at dusk and at dawn. Water that is shared well is never short for long.' },
    { who: 'Pak Ketut', role: 'council farmer', look: 'm', text: 'The rice is gold and the canals are quiet. Drain the fields, bring the baskets, and then we feast.' },
  ],
];
export const FESTIVAL = [
  'The village gathers on the threshing floor. Drums, a pot of hot rice, and stories of the old walls.',
  'Gamelan music drifts up the terraces. The harvest is shared at long tables under the palms.',
];

// Journal pages: id, title, text. 'year' pages open when that year is finished; the others when their event happens.
export const JOURNAL = [
  { id: 'c1', title: 'Water walks downhill', text: 'A spring high on the mountain feeds the top terrace; the water then steps from field to field through small gates. Farmers in the Cordillera have kept this chain working for many centuries.' },
  { id: 'c2', title: 'Stone and mud', text: 'Terrace walls are built of stacked stones or packed earth and are mended again and again. A single weak wall can lose a field, so repairs are done before the rainy season, not after.' },
  { id: 'c3', title: 'Bayanihan', text: 'Bayanihan is the Filipino spirit of neighbours lifting a task together. In the mountains it is seen when a whole village turns out to repair a wall or carry the harvest down the steps.' },
  { id: 'c4', title: 'A hillside of many hands', text: 'On the great terraces every field depends on the field above it. The water you pass on is the water your neighbour below will plant with.' },
  { id: 'b1', title: 'One river, many farms', text: 'In Bali a single river can serve hundreds of fields. Canals and short tunnels through rock carry the water from farm to farm, and no farm has to stand at the head of the line.' },
  { id: 'b2', title: 'The subak', text: 'A subak is the water-sharing group of the farmers who use the same canal. They meet to agree on turns and repairs, and the water is divided at small splitting weirs so each field gets its measure.' },
  { id: 'b3', title: 'Dry months', text: 'When the river thins, farmers plant at different times so that not every field needs the most water on the same day. Sharing the shortage is part of the craft.' },
  { id: 'b4', title: 'The council', text: 'Fair water gives a fair harvest. The council keeps the count of the water each farm receives, so a quiet farmer at the bottom is heard as clearly as a loud one at the top.' },
  { id: 'e_soak', title: 'Mirrors of the sky', text: 'When the flooded fields are still they mirror the clouds. Farmers say the best mud is the mud that has rested under water until nothing floats on top.' },
  { id: 'e_plant', title: 'Rows by hand', text: 'Seedlings are raised in a nursery bed and moved by hand to the flooded field. Planting in straight lines helps the water move evenly and makes weeding easier.' },
  { id: 'e_repair', title: 'After the rain', text: 'A collapsed wall is rebuilt stone by stone from the bottom up. The wall is wider at its base than at its top, so it leans gently into the hill.' },
  { id: 'e_snail', title: 'Snails and ducks', text: 'Golden snails can eat young rice in a night. Some farmers raise ducks that patrol the flooded rows, or simply let the water run deep for a few days to drown the snails.' },
  { id: 'e_valley', title: 'The village below', text: 'The water that leaves the last terrace does not vanish. It reaches the village in the valley, and a farmer who lets some go is repaid by a good neighbour.' },
  { id: 'e_gold', title: 'Gold on the hill', text: 'Rice turns gold when the fields are drained and the sun is on the grain. A good harvest is cut by hand and carried down in bundles on the shoulders.' },
  { id: 'e_fair', title: 'A fair share', text: 'The score is not only the rice you carry home. The neighbour who is fed, the valley that drinks, and the walls that stand for the next generation count as well.' },
  { id: 'e_perfect', title: 'A perfect year', text: 'Three stars is a year in which every gate was opened for a reason. The old terraces teach that patient planning beats hurry.' },
];
