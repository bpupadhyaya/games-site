// The full docs/WORLD-WEAVE-TAXONOMY.md region list, as plain data — used by the World Atlas to
// know how many more civilizations exist beyond the ones already built (view.js's footer line),
// and by any future region-picking work. `builtId` links the 3 regions that already exist in
// `web/src/regions/` to their real module id; every other entry is `builtId: null`.
//
// 2026-09-24: an earlier pass tried to also plot every region on a literal stylized world-map
// layout (continent silhouettes + a dot per region). The owner reviewed it on-device and it did
// not read as a map at all, and — more importantly — it hid the actual pattern art behind tiny
// empty circles instead of showing it. That whole geometry (continent outlines/boxes, per-region
// `pos` fractions) has been removed; the Atlas is back to a card gallery (see view.js) with a real,
// always-visible woven-sample swatch per built region instead. This file keeps only the taxonomy
// metadata, which is still useful (the "+N more civilizations" footer, and for whoever builds the
// next region), without the abandoned map-geometry attempt.
//
// 2026-09-25: this data now also drives a tile grid below the built-region cards (`layout.js`'s
// `atlasTaxonomyLayout`, drawn in `view.js`) — every one of the 41 regions gets its own small
// shape, not just the 3 built ones. Each tile is a generic, seeded loom/arc motif, explicitly NOT a
// claim of real cultural specificity (no research has been done yet for these 38) — see view.js's
// `drawTaxonomySwatch` for the reasoning and the neutrality guardrail this keeps to.
// A same-day first cut of that grid GROUPED and TINTED these tiles by continent, with a printed
// continent-name header per section. Reverted on direct owner review: the taxonomy's own founding
// principle (this file's REGIONS list, and docs/WORLD-WEAVE-TAXONOMY.md) is that these are
// civilizational lineages defined by settlement geography, "never by modern political borders" —
// labelling sections by continent on screen put exactly that modern-geopolitical frame back over
// content whose whole point is to not be organized that way. The Atlas grid is now one continuous,
// unlabelled list in this array's plain order (below); `continent` still exists on each entry as
// taxonomy metadata (matching docs/WORLD-WEAVE-TAXONOMY.md's own table headings) but drives nothing
// in the UI any more — don't reintroduce a continent-keyed grouping/header/tint without re-reading
// this note and getting a real answer to "is this organized by civilization or by modern map" first.
export const CONTINENTS = [
  { id: 'middleEast', label: 'Middle East / West Asia' },
  { id: 'africa', label: 'Africa' },
  { id: 'southAsia', label: 'South Asia' },
  { id: 'eastAsia', label: 'East & Central Asia' },
  { id: 'seAsia', label: 'Southeast Asia' },
  { id: 'europe', label: 'Europe' },
  { id: 'americas', label: 'The Americas' },
  { id: 'oceania', label: 'Oceania & the Pacific' },
  { id: 'circumpolar', label: 'Circumpolar' },
];

// `about` (2026-09-25 addition): a short, general-knowledge historical/geographic summary shown
// when a player taps a "not yet woven" tile in the Atlas (view.js's `drawTaxonomyInfo`) — the
// owner asked for real historical context per civilization, not just a shape. Deliberately kept to
// well-established, safe, neutral facts (settlement geography, well-documented achievements) in the
// same voice as the built regions' own `aboutText` — no religion words/symbols (house style, see
// CLAUDE.md), no ranking/comparison language, nothing that reads as a specific claimed cultural
// practice. This is NOT the deep, individually-cited research (`design/RESEARCH-NOTES.md`) this
// game normally requires before a region ships as playable — it is a lighter, honest overview tier,
// clearly labelled "Not yet woven" wherever it's shown, and should be reviewed (especially
// `australian-traditions`, kept deliberately to only demographic/temporal facts per the
// cultural-sensitivity caution in `docs/HERITAGE-MAP.md` §17) before being treated as final copy.
// Built regions (`niger-river`, `mesopotamia`, `deccan`) have no `about` here on purpose — their
// real, cited text lives in their own `web/src/regions/*.js` module instead.
export const REGIONS = [
  // Africa
  { id: 'nile-valley', name: 'Nile Valley', continent: 'africa', tier: 1, builtId: null,
    about: "The Nile's yearly floods renewed fertile farmland along its banks for thousands of "
      + 'years, supporting one of the longest continuous urban records anywhere — walled cities, '
      + 'monumental stone building, and a written script that lasted millennia.' },
  { id: 'maghreb', name: 'Maghreb & Atlas highlands', continent: 'africa', tier: 1, builtId: null,
    about: 'Facing the Mediterranean across the Atlas mountains, Amazigh (Berber) communities built '
      + 'farming and trading towns distinct from the Nile valley to their east, developing their own '
      + 'scripts, textile weaving, and metalwork over thousands of years.' },
  { id: 'niger-river', name: 'Niger River & West Africa', continent: 'africa', tier: 1, builtId: 'west-africa' },
  { id: 'great-lakes', name: 'African Great Lakes & Ethiopian highlands', continent: 'africa', tier: 1, builtId: null,
    about: "Highland farming and the fertile shores of Africa's Great Lakes supported dense, "
      + 'long-settled communities across the Ethiopian highlands and the lake-basin interior, with '
      + 'their own farming terraces, iron-working, and trade networks.' },
  { id: 'swahili-coast', name: 'Swahili coast', continent: 'africa', tier: 1, builtId: null,
    about: "Coastal trading towns along East Africa's Indian Ocean shore grew wealthy on maritime "
      + 'trade linking Africa, Arabia, and Asia, developing coral-stone architecture and their own '
      + 'language from centuries of exchange.' },
  { id: 'congo-basin', name: 'Congo River basin', continent: 'africa', tier: 2, builtId: null,
    about: 'Communities along the Congo River and its rainforest basin built farming and fishing '
      + 'villages connected by the river itself, developing distinctive woodcarving, textile, and '
      + 'metalworking traditions across a vast region.' },
  { id: 'zambezi-basin', name: 'Zambezi basin & Southern Africa', continent: 'africa', tier: 1, builtId: null,
    about: 'Cattle-herding and farming communities across the Zambezi basin and southern African '
      + 'highlands built substantial stone-walled settlements, most famously the dry-stone enclosures '
      + 'of Great Zimbabwe, a major trading center centuries ago.' },
  { id: 'madagascar', name: 'Madagascar & SW Indian Ocean', continent: 'africa', tier: 2, builtId: null,
    about: 'Madagascar was settled by seafarers from across the Indian Ocean, giving it a distinct '
      + 'blend of African and Southeast Asian roots found nowhere else — its own language family, '
      + 'terraced rice farming, and textile traditions unlike its mainland African neighbors.' },

  // Middle East / West Asia
  { id: 'mesopotamia', name: 'Mesopotamia', continent: 'middleEast', tier: 1, builtId: 'mesopotamia' },
  { id: 'levant-coast', name: 'Levant coast', continent: 'middleEast', tier: 1, builtId: null,
    about: 'Port cities along the eastern Mediterranean coast built a trading and seafaring culture '
      + 'that spread an alphabet-based writing system, glasswork, and dye-making across the '
      + 'Mediterranean world, connecting far-flung shores by sea.' },
  { id: 'arabian-peninsula', name: 'Arabian Peninsula', continent: 'middleEast', tier: 2, builtId: null,
    about: 'Desert-oasis towns and incense-trade routes across the Arabian Peninsula linked farming '
      + 'settlements to long-distance camel caravans, supporting centuries of trade in frankincense, '
      + 'myrrh, and other goods between Africa, Asia, and the Mediterranean.' },
  { id: 'caucasus', name: 'Caucasus & Anatolian highlands', continent: 'middleEast', tier: 1, builtId: null,
    about: 'Mountain valleys and trade passes across the Caucasus and Anatolian highlands supported '
      + "some of the world's earliest metalworking, viticulture, and textile traditions, shaped by "
      + 'their position astride major overland trade routes.' },

  // South Asia
  { id: 'indus-ganges', name: 'Indus & Ganges basins', continent: 'southAsia', tier: 1, builtId: null,
    about: "The Indus Valley's planned brick cities, with early drainage systems and standardized "
      + 'weights, gave way over centuries to farming civilizations along the Ganges plain, a heartland '
      + 'of dense settlement ever since.' },
  { id: 'deccan', name: 'Deccan & South India', continent: 'southAsia', tier: 1, builtId: 'kolam' },
  { id: 'himalayan-plateau', name: 'Himalayan & Tibetan plateau', continent: 'southAsia', tier: 1, builtId: null,
    about: 'High-altitude communities across the Himalayan and Tibetan plateau built a distinct way '
      + 'of life around yak herding, terraced farming, and trade routes threading through some of the '
      + "world's highest inhabited terrain." },

  // East & Central Asia
  { id: 'yellow-yangtze', name: 'Yellow River & Yangtze basins', continent: 'eastAsia', tier: 1, builtId: null,
    about: 'Farming villages along the Yellow and Yangtze rivers grew into some of the largest and '
      + 'longest-documented urban civilizations anywhere, with early writing, bronze casting, and silk '
      + 'production that shaped craft traditions across East Asia.' },
  { id: 'korean-peninsula', name: 'Korean peninsula', continent: 'eastAsia', tier: 1, builtId: null,
    about: "Rice farming along Korea's rivers and coasts supported its own kingdoms and craft "
      + 'traditions distinct from neighboring China and Japan, including celadon ceramics and a '
      + 'writing system later developed specifically for the Korean language.' },
  { id: 'japanese-archipelago', name: 'Japanese archipelago', continent: 'eastAsia', tier: 1, builtId: null,
    about: "Japan's monsoon rice-paddy farming and island geography shaped centuries of craft "
      + 'traditions in textiles, lacquerware, and woodblock printing, developing in close contact with '
      + 'mainland Asia while remaining culturally distinct.' },
  { id: 'eurasian-steppe', name: 'Eurasian Steppe', continent: 'eastAsia', tier: 1, builtId: null,
    about: 'Mobile herding communities across the Eurasian steppe built a horse-based way of life '
      + 'rather than a river-farming one, developing felt-making, metalwork, and trade networks that '
      + 'linked East Asia to Europe over vast distances.' },
  { id: 'silk-road-oases', name: 'Silk Road oases', continent: 'eastAsia', tier: 2, builtId: null,
    about: 'Irrigated oasis towns along the historic Silk Road linked farming communities to '
      + 'long-distance overland trade, becoming meeting points for merchants, textiles, and craft '
      + 'traditions moving between China, India, Persia, and Europe.' },
  { id: 'siberian-taiga', name: 'Siberian taiga & river basins', continent: 'eastAsia', tier: 2, builtId: null,
    about: "Across Siberia's vast boreal forest and river basins, communities built a way of life "
      + 'around reindeer herding, fishing, and fur trapping, adapted to some of the coldest inhabited '
      + 'regions on Earth.' },

  // Southeast Asia
  { id: 'mainland-sea', name: 'Mainland Southeast Asian deltas', continent: 'seAsia', tier: 1, builtId: null,
    about: 'Rice farming across the fertile deltas of the Mekong, Irrawaddy, and Chao Phraya rivers '
      + 'supported dense agrarian populations and long-distance river trade, shaping mainland '
      + "Southeast Asia's farming towns for millennia." },
  { id: 'maritime-sea', name: 'Maritime / Island Southeast Asia', continent: 'seAsia', tier: 1, builtId: null,
    about: 'Seafaring Austronesian communities settled the islands of maritime Southeast Asia, '
      + 'building trading ports and boat-building traditions that linked thousands of islands across '
      + 'open water long before modern navigation.' },

  // Europe
  { id: 'mediterranean', name: 'Mediterranean & Aegean coast', continent: 'europe', tier: 1, builtId: null,
    about: 'Seafaring trade across the Mediterranean and Aegean coasts linked farming towns into a '
      + 'shared maritime culture, spreading pottery, olive and grape cultivation, and early city-states '
      + 'around a shared sea.' },
  { id: 'eastern-european', name: 'Eastern European river-forest', continent: 'europe', tier: 1, builtId: null,
    about: 'Forest-steppe river basins across Eastern Europe supported farming and trading '
      + 'settlements along the Dnieper, Volga, and Don, at the boundary between forest and open '
      + 'grassland, shaping a distinct Slavic-heartland way of life.' },
  { id: 'north-sea-baltic', name: 'North Sea, Baltic & Scandinavia', continent: 'europe', tier: 1, builtId: null,
    about: 'Fjords and cold northern coastlines shaped a fishing and seafaring culture across '
      + 'Scandinavia and the Baltic, with shipbuilding and long-distance sea trade connecting these '
      + 'coastal communities centuries before modern navigation.' },
  { id: 'atlantic-europe', name: 'Atlantic Europe & British Isles', continent: 'europe', tier: 1, builtId: null,
    about: 'Atlantic-facing farming communities across Britain, Ireland, Brittany, and coastal Iberia '
      + 'shared a Celtic-influenced culture and monumental stone-building tradition, connected more by '
      + 'the sea along their shared coastline than by inland travel.' },
  { id: 'alpine-highlands', name: 'Alpine highlands', continent: 'europe', tier: 2, builtId: null,
    about: 'Mountain-pass communities across the Alps built a way of life around pastoral herding and '
      + 'trade routes threading through high valleys, connecting farming lowlands on either side of '
      + 'the mountain range.' },

  // The Americas
  { id: 'mesoamerica', name: 'Mesoamerican highlands & lake basins', continent: 'americas', tier: 1, builtId: null,
    about: 'Farming communities across the Valley of Mexico and Maya lowlands built some of the '
      + "Americas' largest cities, with monumental stone architecture, a written calendar system, and "
      + 'long-distance trade in cacao, obsidian, and textiles.' },
  { id: 'caribbean', name: 'Caribbean / circum-Caribbean islands', continent: 'americas', tier: 2, builtId: null,
    about: "Seafaring Taino, Arawak, and Carib communities settled the Caribbean's islands, building "
      + 'fishing and farming villages connected by canoe travel across open water between islands.' },
  { id: 'andean-highlands', name: 'Andean highlands & coastal rivers', continent: 'americas', tier: 1, builtId: null,
    about: 'Terraced farming across the Andean highlands and coast supported dense mountain '
      + 'populations, known for finely woven textiles, stonework, and a road network that linked '
      + 'settlements across extreme changes in altitude.' },
  { id: 'amazon-basin', name: 'Amazon basin', continent: 'americas', tier: 2, builtId: null,
    about: "Communities along the Amazon's rivers and rainforest built farming and fishing "
      + "settlements adapted to the world's largest rainforest, with river travel connecting villages "
      + 'across vast, still-being-documented distances.' },
  { id: 'southern-cone', name: 'Southern Cone', continent: 'americas', tier: 2, builtId: null,
    about: 'Across Patagonia and the Pampas grasslands, communities built a way of life around '
      + "hunting, gathering, and later herding across some of the Americas' most sparsely populated "
      + 'open plains.' },
  { id: 'great-plains', name: 'Great Plains', continent: 'americas', tier: 2, builtId: null,
    about: 'After horses reached the Great Plains, nomadic communities built a bison-hunting way of '
      + 'life across the grasslands, developing portable dwellings and trade networks distinct from '
      + 'farming peoples further east.' },
  { id: 'eastern-woodlands', name: 'Eastern Woodlands & Mississippi basin', continent: 'americas', tier: 1, builtId: null,
    about: 'Farming and trading communities across the Eastern Woodlands and Mississippi River basin '
      + 'built large earthen mounds and settlements, with trade networks reaching from the Great Lakes '
      + 'to the Gulf coast.' },
  { id: 'sw-desert-mesa', name: 'North American Southwest desert & mesa', continent: 'americas', tier: 1, builtId: null,
    about: 'Communities across the arid Southwest built multi-story dwellings from adobe and stone, '
      + 'into cliff faces and mesa tops, adapting farming to a dry, high-desert landscape over many '
      + 'centuries.' },
  { id: 'pacific-nw-coast', name: 'Pacific Northwest coast', continent: 'americas', tier: 1, builtId: null,
    about: 'Rich salmon runs along the Pacific Northwest coast supported settled fishing communities '
      + 'without farming, known for monumental cedar woodcarving, plank houses, and totem art passed '
      + 'down through generations.' },

  // Oceania & the Pacific
  { id: 'pacific-islands', name: 'Pacific Islands / Oceania', continent: 'oceania', tier: 1, builtId: null,
    about: 'Seafaring Pacific Islander communities navigated thousands of miles of open ocean using '
      + 'the stars, currents, and wave patterns, settling islands across Polynesia, Micronesia, and '
      + 'Melanesia and developing distinct wood-carving, weaving, and tattoo traditions on each.' },
  { id: 'new-guinea-highlands', name: 'New Guinea highlands', continent: 'oceania', tier: 2, builtId: null,
    about: 'Isolated highland valleys in New Guinea developed farming independently from the coastal '
      + "communities around them, supporting some of the world's most linguistically diverse societies "
      + 'within a relatively small area.' },
  { id: 'australian-traditions', name: 'Australian desert & coastal traditions', continent: 'oceania', tier: 1, builtId: null,
    about: 'Aboriginal Australian communities have lived continuously across the continent\'s deserts '
      + 'and coasts for over 50,000 years — one of the longest continuous cultural presences anywhere '
      + 'in the world, sustained across hundreds of distinct language and nation groups.' },

  // Circumpolar
  { id: 'arctic-circumpolar', name: 'Arctic & circumpolar coast', continent: 'circumpolar', tier: 2, builtId: null,
    about: "Across the Arctic's sea ice and tundra, Inuit, Sámi, Chukchi, and other circumpolar "
      + 'peoples built a way of life around marine-mammal hunting and reindeer herding, adapted to '
      + 'some of the coldest inhabited places on Earth.' },
];

export function continentFor(id) {
  return CONTINENTS.find((c) => c.id === id);
}
