// Per-pilot settings for tools/process-art.mjs (see ART_PIPELINE.md).
//
// folder     source folder under src/pilot concept art/ (read-only)
// back       in-game sprite source (flies up the screen)
// front      select-card preview + cut-in
// portrait   pilot portrait
// glowRule   background removal also strips dark red baked glow (off when the
//            art has dark warm shading it would eat, e.g. Mira's gold)
// portraitCrop optional { left, top, width, height } 4:5 box in portrait pixels (default: full width from the top)
// holes      optional [x, y] seeds (back source pixels) for enclosed background
//            gaps the edge flood fill can't reach (frontHoles: same for `front`)
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
  bruno: {
    folder: 'Bruno Hagen',
    back: 'top_down_main.jpg',
    front: 'top_down_front.png',
    portrait: 'pilot_portrait.jpg',
    glowRule: false,           // dark red armour panels
    holes: [[511, 1315]],      // enclosed gap inside the backpack's H-frame
    anchors: {
      hitbox: [511, 930],      // chest centre: lands on player.x/y
      head: [511, 1080],
      cannonL: [80, 757],      // wide-bore cannon muzzles: flak fan
      cannonR: [942, 757],
      barrelL: [110, 497],     // long-barrel muzzles: siege shells
      barrelR: [912, 497],
      podL: [250, 1478],       // shoulder-pod vents: wide back plumes
      podR: [772, 1478],
      packL: [415, 1430],      // backpack struts: smaller flames
      packR: [607, 1430],
    },
  },
  tess: {
    folder: 'Tess Kuro',
    back: 'top-down_main.jpg',
    front: 'top-down_front.jpg',
    portrait: 'pilot-portrait-main.jpg',
    portraitCrop: { left: 125, top: 70, width: 400, height: 500 }, // head and shoulders (4:5)
    glowRule: false,           // thin red light lines
    anchors: {
      hitbox: [512, 960],      // chest centre: lands on player.x/y
      head: [512, 1080],
      bladeL: [140, 707],      // forearm blades, 16 units ahead like the old origin: crescent origins
      bladeR: [884, 707],
      ventL: [285, 1230],      // rear of the shoulder armour: wide back plumes
      ventR: [739, 1230],
      packL: [480, 1215],      // either side of the head's rear spike
      packR: [544, 1215],
    },
  },
};
