# Painted characters (web/src/paint)

Every character is drawn in code ONCE into cached offscreen sprites, then posed per frame with `drawImage` only.
The painterly look comes from `sculpt.js`: a part is painted flat (colour + silhouette), its alpha is inflated into a
rounded height field, sculpting blobs add muscle / brow / folds, and each pixel is lit (warm key, cool ambient,
bounce, rim, soft skin warmth, specular; gold uses reflected "sky" bands). Fur and hair are thousands of short
tapered strokes (`furCoat`) that also act as a bump map.

| file | what it holds |
| --- | --- |
| `sculpt.js` | `relief(g, {paint, inflate, depth, blobs, heightFn, bump, mat, over, alphaFn})`, `furCoat`, `fillShapes`, `insideOf`, materials `MAT` |
| `kit.js` | colour helpers, `sprite()` cache, `blit`, `tinted`, pearls / gems / rosettes / bead strings, `ink()` tapered ink strokes (+ `bez`/`quad`/`chain` curves, `peak`/`head`/`fade` width profiles) - the DRAWN layer every face uses on top of the relief |
| `specs.js` | one spec per character kind (build, skin or fur, head dress, clothes, jewels) - START HERE for variants |
| `heads.js` | human head (3/4 view), hair, beards, head dresses, expressions |
| `noble.js` | the four leads' face (`noble: true` in the spec): oval mask (male / female silhouettes), a few large relief forms for volume, then a drawn ink layer for structure (lid line + wing, lashes, crease, shaped brow, nose/lip/jaw accents). Spec knobs: `eyeH`, `eyeW`, `gaze` (downcast), `smile`, `browTilt`, `browW`, `brow`, `jaw`, `blush`, `kohl`, `lip`, `iris`, `noseStud` |
| `vanarahead.js` | vanara head (ruff, muzzle, brow), the shared painted `eye()` |
| `crown.js` | `goldCrown()` - band, gem plates, dome tiers, spikes, tassel |
| `parts.js` | torso, arms + hands, legs, feet, wrap (dhoti / sari), sash, garland, necklaces, collar, belt, veil, quiver |
| `rig.js` | `figure(ctx, o)` poses the cached parts; `headShot()`; tail; optional streaming `cape` |
| `poses.js` | key poses (stand, walk, run, leap, fly, drawBow, release, holdBow, strike, kneel, offer, sit, grief, embrace, cheer, carry, sneak) |
| `props.js` | bow, relief mace, sword, spear, lamps, boulders, herb mountain |
| `ravan.js` | ten-crowned king (central head + nine-head fan, arms, seated lap) and the throne set piece |
| `creatures.js` | Jatayu (relief feathers, folding wing), deer, chariots |

## Place a character
```js
import { figure, poses } from '../puppets.js';
figure(ctx, { x, y, s: 1.8, dir: 1, kind: 'leaper', prop: 'mace', cape: '#2b8a62', pose: poses.fly(t) });
```
`x, y` = point under the feet; `s` = scale (1 unit is about 1 canvas px at s = 1; a hero is ~230 units tall, so
`s = 1.6` is roughly a third of the 720-wide screen); `dir` = 1 faces right, -1 left. `hi: true` builds 2.4x
sharper sprites (review sheets only), `hi: 'p'` is the portrait tier. Pass `pose.expr` for the face.

## Add a character variant
Add one line to `specs.js` by spreading an existing spec and overriding fields, e.g.
`SPECS.sugriv = { ...SPECS.vking, fur: '#b9773a', sash: '#2a7a6a', tiers: 2 };` then use `kind: 'sugriv'`.
Fields are documented at the top of `specs.js`. Vanara soldiers vary by `v` (fur colour, crown on/off, cloth) in
`rig.specFor`; the nine side heads of the ten-crowned king vary the same way (`kind: 'ravan'`, `v` 1..9).
Sprites are cached per (kind, v, accent, hi); new kinds cost memory only when drawn.

Hanuman has two dress sets on one body: `kind: 'leaper'` = FIELD (low crown-cap, one necklace, short red-orange dhoti; pass `cape`)
for the leap, Lanka, the fire, the war and the herb mountain; `kind: 'leaper_c'` = CEREMONIAL (fan-crested crown, pearl fringe, long
earrings, layered necklaces, garland, golden silk, green waist sash, magenta shoulder cloth) for court scenes, meeting Ram, the return,
portraits and key art. `silky: true` on a fur spec gives the short, fine, dense coat.

## Walking and running (no foot slide)
`poses.js` builds gaits from the feet up: each ankle follows a ground-true path (heel strike, foot flat, heel off, toe off, swing) and
the hip / knee angles come from two-bone IK, so the planted foot cannot slide and the knee only bends the right way. Drive the phase
from DISTANCE, not time: `stridePose(kind, distancePx, scale, { run, t, offset })` (exported from `puppets.js`) picks the gait for the
kind (`GAITS.walk`, `long` = short graceful steps for long dhoti / sari, `vanara` = springy, `run` / `vrun` = with a flight phase);
`cycleLength(kind, scale, run)` is the ground covered by one full cycle. Worked example: `chapters/02-exile.js`. `poses.walk(t, rate)` /
`poses.run(t, rate)` still work for figures that walk on the spot or where speed is unknown. The rig reads `footF` / `footB` (foot roll)
and `hipH` (pelvis height; any excess over the legs' reach becomes the hop of a run). Tune a gait in the `GAITS` table.

## Add a pose
Add a function to `poses.js` returning joint angles (radians from hanging straight down, positive toward the facing
direction). Always pass the clock `t` through so breathing, cloth sway and tails keep moving. For a held shaft set
`propA` (its angle) and `propBack: true` to hold it in the back hand.

## Add or restyle a part
Write `relief(ctx, { mat, inflate, depth, blobs, paint(c) {...}, over(g) {...} })` inside the part function:
`paint` draws flat colour (its alpha is the silhouette), `blobs` are ellipses `{x,y,rx,ry,rot,z}` or capsules
`{cap:[x0,y0,r0,x1,y1,r1], z}` (negative z carves), `over` draws crisp details (eyes, gems) after lighting.
Light comes from the upper front; parts that rotate far from upright (a raised arm, the flying body) keep their
baked light - if one looks wrong, bake a second sprite for that pose rather than lighting per frame.

## Review sheets (tools/arc shots)
`z-hanuman` 9107, `z-pair` 9108 (Ram, Sita, forest dress), `z-men` 9109 (Jatayu, vanaras, Lakshman, king, raider,
Bharat), `z-throne` 9110, `z-faces` 9111 (the four leads: calm, joyful, other moods, in-game size), `z-walk` 9112 (gait strips), `z-hands` 9113 (hand shapes: relaxed/grip/open/point, isolated large and attached to a mace/bow figure), `z-cast` 9101 (portraits). `cacheInfo()` in `kit.js` reports the sprite-cache
size (MB) and cumulative sprite draws.

## Content rules (binding)
No halos or glow discs behind heads, natural warm skin tones only, no forehead marks, no raised-palm or folded-hand
gestures, no shrines or altars. Heroes are never shown hurt. Names and story text live only in `text.js`.
