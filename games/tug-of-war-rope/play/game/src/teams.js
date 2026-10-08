// The festival grounds and the village teams. Pure data. Teams are named after places and animals only: no flags, no emblems of any faith or state.
export const SETTINGS = [
  { id: 'harvest', name: 'Harvest Green', blurb: 'Hay bales and bunting on a golden afternoon', ground: 'grass' },
  { id: 'river', name: 'Riverside Fair', blurb: 'Stalls and awnings by a slow river', ground: 'sand' },
  { id: 'meadow', name: 'Mountain Meadow', blurb: 'Cool air, pines and snowy peaks', ground: 'grass' },
  { id: 'seaside', name: 'Seaside Games', blurb: 'Warm sand, sea and striped parasols', ground: 'sand' },
  { id: 'lantern', name: 'Lantern Night', blurb: 'Strings of lanterns after dark', ground: 'grass' },
  { id: 'grand', name: 'Grand Festival', blurb: 'The big arena, banners and full stands', ground: 'grass' },
];
export const settingById = (id) => SETTINGS.find((x) => x.id === id) || SETTINGS[0];

// kit colours: top / accent. skins: the mix of the four tones on the rope (men and women both).
export const TEAMS = [
  { id: 'oxen', name: 'Harvest Oxen', home: 'harvest', top: '#b5651d', accent: '#f2d28b', skins: ['tan', 'light', 'brown', 'tan'] },
  { id: 'herons', name: 'River Herons', home: 'river', top: '#1e8b8a', accent: '#bfeee6', skins: ['brown', 'deep', 'tan', 'brown'] },
  { id: 'rams', name: 'Highland Rams', home: 'meadow', top: '#2f7a46', accent: '#cde8c6', skins: ['light', 'light', 'tan', 'light'] },
  { id: 'gulls', name: 'Seaside Gulls', home: 'seaside', top: '#2a79c4', accent: '#d9ecfb', skins: ['tan', 'brown', 'light', 'tan'] },
  { id: 'foxes', name: 'Lantern Foxes', home: 'lantern', top: '#d2481e', accent: '#ffd9a0', skins: ['deep', 'brown', 'deep', 'tan'] },
  { id: 'lions', name: 'Festival Lions', home: 'grand', top: '#d9a21b', accent: '#fff0b8', skins: ['brown', 'tan', 'deep', 'light'] },
  { id: 'bears', name: 'Stonebridge Bears', home: 'meadow', top: '#5a5f73', accent: '#dfe3ee', skins: ['light', 'tan', 'light', 'brown'] },
  { id: 'hares', name: 'Orchard Hares', home: 'harvest', top: '#8a4aa8', accent: '#ecd4f6', skins: ['tan', 'light', 'brown', 'deep'] },
];
export const teamById = (id) => TEAMS.find((x) => x.id === id) || TEAMS[0];

export const KITS = [
  { id: 'crimson', name: 'Crimson', top: '#c8352b', accent: '#ffd5cf' },
  { id: 'blue', name: 'Blue', top: '#2557b8', accent: '#cfe0ff' },
  { id: 'green', name: 'Green', top: '#2e9e5c', accent: '#d2f4de' },
  { id: 'amber', name: 'Amber', top: '#e19a1d', accent: '#fff0c6' },
  { id: 'violet', name: 'Violet', top: '#7a4bb5', accent: '#e8dcf8' },
  { id: 'white', name: 'White', top: '#e9e9ee', accent: '#8a95a8' },
];
export const kitById = (id) => KITS.find((x) => x.id === id) || KITS[0];
export const YOU = { name: 'Your Village', skins: ['tan', 'light', 'brown', 'tan'] };
