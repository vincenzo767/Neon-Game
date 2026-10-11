// Per-pilot settings for tools/process-art.mjs (see ART_PIPELINE.md).
//
// folder     source folder under src/pilot concept art/ (read-only)
// back       in-game sprite source (flies up the screen)
// front      select-card preview + cut-in
// portrait   pilot portrait
// glowRule   background removal also strips dark red baked glow (off when the
//            art has dark warm shading it would eat, e.g. Mira's gold)
// anchors    estimates in `back` source pixels; written to <id>.anchors.json
//            only on first run or with --reset-anchors (F9 edits survive)

export const PILOT_ART = {
  kairo: {
    folder: 'Kairo Vance',
    back: 'top_down_main.png',
    front: 'Top-Down_Front.png',
    portrait: 'pilot_portrait.jpg',
    glowRule: true,
    anchors: {
      hitbox: [511, 800],      // chest centre: lands on player.x/y
      head: [511, 1090],
      gunL: [445, 540],        // chest gun: muzzles either side of the central spike,
      gunR: [577, 540],        // 8 units apart like the old twin lances
      rifleL: [92, 200],       // tips of the long black rifles (tier-4 extra lances)
      rifleR: [932, 200],
      beam: [511, 518],        // chest gun tip (focus rail beam origin)
      packL: [452, 1300],      // wide back thrusters under the skirt
      packR: [570, 1300],
      footL: [390, 1290],      // red-tipped foot thrusters
      footR: [632, 1290],
      calfL: [258, 1272],      // red binder vents (small flames)
      calfR: [764, 1272],
    },
  },
  mira: {
    folder: 'Mira Solenne',
    back: 'top_down_main.jpg',
    front: 'top-down_front.png',
    portrait: 'pilot_portrait.jpg',
    glowRule: false,
    anchors: {
      hitbox: [507, 760],      // chest centre: lands on player.x/y
      head: [507, 1120],
      gun: [507, 480],         // chest gun (central spike tip): needle-fan origin
      armL: [215, 625],        // arm-gun barrel tips: outermost needles at tier 3+
      armR: [800, 625],
      ventL: [180, 1495],      // ladder-vent fins: wide back plumes
      ventR: [840, 1495],
      packL: [480, 1315],      // centre exhaust under the head
      packR: [535, 1315],
      footL: [400, 1255],      // gold skirt plates: foot flames
      footR: [615, 1255],
    },
  },
};
