// Character specs: one entry per body plan ("kind" = a role; names live in text.js). See README.md in this folder.
// BUILD   T torso height (hip to shoulder line), hw half hip width, sw half shoulder width, leg (thigh = shin length),
//         arm [upper, lower], legW / armW limb thickness, muscle 0..1, fem, headS head scale (heroes ~0.84 = 7.5 heads tall)
// SURFACE skin '#hex' (humans) OR fur '#hex' + ruff (cream mane colour) + face (face/hand skin) for vanaras
// HEAD    head: 'crown' | 'tiara' | 'knot' | 'bun' | 'turban' | 'helm'; tiers (dome tiers on the crown), crownW, spikes,
//         gems [..], hair, hairLong, beard '#hex', longBeard 0..1, stache, brow 0..1.5 (heaviness), jaw -1..1, expr default
// DRESS   chest 'bare' | 'choli' | 'cloth', top, dhoti, dborder, motif (butti colour), len / flare of the wrap, long (sari),
//         sash (shoulder cloth colour), kamar (waist sash colour), veil, veilCol, jewels 0..3, garland, collar, armour,
//         bandGem, beadBracelet, quiver, anklets, boots, tail
const B = { T: 74, hw: 16.5, sw: 27.5, leg: 50, arm: [38, 36], legW: 25, armW: 15, muscle: 0.65, headS: 0.86 };
const FURS = ['#b98a48', '#8e5c38', '#c9b48a', '#6e4c38', '#a8743a', '#d0a860'];

export const SPECS = {
  // Ram in court dress: tall tiered crown, garland, green shoulder cloth, golden-yellow silk
  prince: { ...B, noble: true, smile: 0.15, gaze: 0.12, long: true, skin: '#b27e52', hair: '#0d0707', head: 'crown', tiers: 3, jewels: 3, chest: 'bare', dhoti: '#f0b22c', dborder: '#b3242a', motif: '#c8421c', sash: '#2b9470', kamar: '#d8382a', quiver: true, garland: true, bandGem: '#1fa872', gems: ['#d8283a', '#1fa872', '#d8283a'], hairLong: true, muscle: 0.75, len: 88, flare: 9, brow: 0.6, jaw: 0.65 },
  // Lakshman: keener and sterner; pale silk, teal border
  brother: { ...B, noble: true, eyeH: 0.86, browTilt: 0.9, browW: 1.15, smile: -0.35, skin: '#c08d62', hair: '#0d0707', head: 'crown', tiers: 2, jewels: 2, chest: 'bare', dhoti: '#e9efe2', dborder: '#2a7a6a', sash: '#e8b848', kamar: '#2a7a6a', quiver: true, bandGem: '#3aa0b8', gems: ['#2a9ab0', '#d8283a', '#2a9ab0'], expr: 'determined', hairLong: true, muscle: 0.8, len: 46, flare: 10, brow: 1.1, jaw: 1.0 },
  // Bharat: humble regent; plain cloth, a single low crown tier, long hair
  bharat: { ...B, noble: true, gaze: 0.5, browTilt: -0.6, browW: 0.9, smile: -0.05, blush: 0.1, skin: '#b8835a', hair: '#0d0707', head: 'crown', tiers: 1, crownW: 11, jewels: 1, chest: 'bare', dhoti: '#d8cdb0', dborder: '#8a6a3a', sash: '#c9b48a', kamar: '#8a6a3a', muscle: 0.5, len: 46, flare: 10, hairLong: true, brow: 0.5, jaw: 0.35 },
  // Sita in court dress: tiara, veil, blouse, long patterned sari
  princess: { ...B, headS: 0.84, leg: 50, T: 64, hw: 15, sw: 20.5, arm: [34, 32], legW: 18, armW: 10.5, noble: true, smile: 0.1, gaze: 0.25, noseStud: true, skin: '#dcaa7a', hair: '#0b0606', fem: true, head: 'tiara', hairLong: true, jewels: 3, chest: 'choli', top: '#a8283e', dhoti: '#e0563e', dborder: '#c8941e', motif: '#f6cf6a', veilCol: '#e5654a', long: true, veil: true, muscle: 0.15, sash: '#e0563e', sashW: 13, kamar: '#c8941e', len: 100, flare: 15, bandGem: '#d8283a' },
  king: { ...B, skin: '#a56c46', hair: '#2a1c18', head: 'crown', tiers: 3, jewels: 3, chest: 'bare', dhoti: '#b83a34', dborder: '#e0b030', sash: '#e8c860', beard: '#d8d0c4', stache: true, muscle: 0.35, len: 50, flare: 12, gems: ['#1fa872', '#d8283a', '#3a6fd0'] },
  citizen: { ...B, headS: 0.88, leg: 49, T: 66, sw: 24, skin: '#a8704a', hair: '#1a100c', head: 'turban', cloth: '#d9a03a', jewels: 1, chest: 'bare', dhoti: '#e9dcc0', dborder: '#8a5a2a', sash: '#a8493a', kamar: '#a8493a', muscle: 0.4, len: 44, flare: 10, stache: true },
  woman: { ...B, headS: 0.86, leg: 48, T: 62, hw: 15, sw: 20, arm: [33, 31], legW: 18, armW: 10.5, skin: '#b98056', hair: '#150b0b', fem: true, head: 'bun', jewels: 2, chest: 'choli', top: '#e0a030', dhoti: '#c8508a', dborder: '#d4a030', motif: '#f6cf6a', long: true, muscle: 0.15, len: 96, flare: 14 },
  // TEMPLATE vanara soldier: o.v picks the fur colour, crown on even variants (see rig.specFor)
  vanara: { ...B, headS: 1.0, leg: 40, T: 62, hw: 17, sw: 30, arm: [42, 40], legW: 26, armW: 17, fur: FURS[0], crownW: 13, tiers: 1, jewels: 1, chest: 'bare', dhoti: '#8a5a3a', dborder: '#c9a040', tail: true, muscle: 0.8, len: 34, flare: 9 },
  // Hanuman, FIELD dress (the leap, Lanka, the fire, the war, the herb mountain): light and athletic - a low crown-cap,
  // one short necklace, armbands and cuffs, a short red-orange dhoti tied for movement; pass `cape` for the streaming cloth.
  leaper: { ...B, headS: 1.0, leg: 45, T: 74, hw: 20, sw: 41, arm: [44, 42], legW: 33, armW: 23, silky: true, tiers: 1, crownW: 13.4, tassel: false, kamar: '#e8a02a', fur: '#e0c496', ruff: '#fdf6e8', jewels: 1, chest: 'bare', dhoti: '#d8401e', motif: '#f6c860', dborder: '#e0b030', tail: true, muscle: 1, len: 32, flare: 8, bandGem: '#1fa872', face: '#f0cfc0', gems: ['#1fa872', '#d8283a', '#1fa872'] },
  vking: { ...B, headS: 1.0, leg: 42, T: 68, hw: 19, sw: 34, arm: [42, 40], legW: 29, armW: 18, fur: '#c9a04c', ruff: '#e8d8b0', jewels: 3, chest: 'bare', dhoti: '#c8a030', motif: '#7a2a1a', dborder: '#8a1c2c', sash: '#7a2a8a', tail: true, muscle: 0.9, len: 38, flare: 9, bandGem: '#d8283a', gems: ['#d8283a', '#3a6fd0'], crownW: 14.5, tiers: 3, face: '#d8a684' },
  // TEMPLATE raider: grey-violet skin, horned helm, iron cuirass, boots
  raider: { ...B, headS: 0.92, T: 70, hw: 18, sw: 32, arm: [40, 38], legW: 25, armW: 17, skin: '#7a5a60', hair: '#0e0808', head: 'helm', jewels: 2, chest: 'bare', armour: true, boots: true, dhoti: '#4a2a6a', dborder: '#c23a30', motif: '#c9a040', muscle: 0.9, len: 38, flare: 11, anklets: false, plume: 4, hairBack: false, stache: true, brow: 1.4, jaw: 1, expr: 'wrathful', earrings: false },
  hermit: { ...B, headS: 0.88, leg: 49, T: 64, sw: 23, skin: '#a4694a', hair: '#e8e0d0', head: 'knot', flowerBand: false, beard: '#e8e0d0', longBeard: 1, band: '#8a6a3a', jewels: 0, chest: 'bare', dhoti: '#d98a30', dborder: '#8a4a1a', sash: '#f0e0c0', muscle: 0.2, len: 50, flare: 11, earrings: false },
};
// Ravan: massive build, dusky skin, spiked crown, beard, broad collar, green silk with gold
SPECS.ravan = { ...B, headS: 0.98, T: 76, hw: 20, sw: 36, arm: [42, 40], legW: 28, armW: 19, skin: '#8a5c4a', hair: '#0e0808', head: 'crown', spikes: true, tiers: 2, crownW: 13.6, plates: 7, jewels: 3, chest: 'bare', collar: true, dhoti: '#1f7a50', dborder: '#e0b030', motif: '#f6cf6a', sash: '#16603e', kamar: '#e0b030', stache: true, stacheUp: 1, beard: '#140a0a', longBeard: 0.25, muscle: 1, len: 52, flare: 13, expr: 'determined', gems: ['#d8283a', '#1fa872', '#3a6fd0'], bandGem: '#d8283a', hairLong: true, brow: 1.5, jaw: 1, velvet: '#5a1020' };
SPECS.vibhishan = { ...SPECS.king, skin: '#8a5a44', beard: null, stache: true, dhoti: '#e6dcc0', dborder: '#3a7a9a', sash: '#3a7a9a', gems: ['#3a6fd0', '#1fa872'], jewels: 2, expr: 'calm' };
// forest dress: hair-knot with a band of flowers, bark-brown cloth, no jewels
SPECS.prince_f = { ...SPECS.prince, long: false, head: 'knot', jewels: 0, garland: false, earrings: false, dhoti: '#c98a3a', dborder: '#8a5a2a', motif: null, sash: '#a8875a', kamar: '#8a5a2a', bandGem: '#8a6a3a', len: 44 };
SPECS.brother_f = { ...SPECS.brother, head: 'knot', flowerBand: false, jewels: 0, earrings: false, dhoti: '#b8a06a', dborder: '#7a5a2a', sash: '#9a8a5a', kamar: '#7a5a2a', len: 44 };
SPECS.princess_f = { ...SPECS.princess, head: 'bun', jewels: 1, earrings: false, top: '#b8842f', dhoti: '#d9a04a', dborder: '#8a5a2a', motif: null, veil: false, gems: null };
// Hanuman, CEREMONIAL dress (court scenes, meeting Ram, the return and coronation, portraits, key art): fan-crested crown with
// a green centre gem and pearl fringe, long pearl earrings, layered necklaces, garland, golden silk with gold butti, green waist
// sash, magenta shoulder cloth.
SPECS.leaper_c = { ...SPECS.leaper, tiers: 2, crownW: 14.5, fan: true, tassel: true, longEar: true, jewels: 3, garland: true, beadBracelet: true, dhoti: '#f0b428', motif: '#c8821c', dborder: '#c8941e', kamar: '#1f8a50', sash: '#a82a8a', len: 40, flare: 10, bandGem: '#d8283a', gems: ['#1fa872', '#d8283a', '#3a6fd0'] };
export const furVariant = (i) => FURS[((i % FURS.length) + FURS.length) % FURS.length];
