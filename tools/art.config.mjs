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
  oduya: {
    folder: 'Oduya Rex',
    back: 'top-down-main.jpg',
    front: 'top-down-front.png',
    portrait: 'pilot-portrait.jpg',
    portraitCrop: { left: 150, top: 60, width: 480, height: 600 }, // face, crown and beard (4:5)
    glowRule: false,
    anchors: {
      hitbox: [668, 480],      // chest centre: lands on player.x/y
      head: [668, 640],        // gold lion head
      crown: [668, 170],       // central gold spike at the waist front
      fistL: [305, 430],       // gold fists: lightning origins
      fistR: [1031, 430],
      ventL: [380, 900],       // wing roots: wide back plumes
      ventR: [956, 900],
      maneL: [640, 1060],      // gold flame mane: smaller plumes
      maneR: [696, 1060],
    },
  },
  lin: {
    folder: 'Lin Hayase',
    back: 'top-down-main.jpg',
    front: 'top-down-front.jpg',
    portrait: 'pilot-portrait.jpg',
    portraitCrop: { left: 20, top: 0, width: 200, height: 250 }, // head and shoulders (4:5)
    bg: 'checker',             // painted checkerboard, not real transparency
    glowRule: false,
    // Butterfly wings flap under the body. The spear (right) and whip (left)
    // cross the wings: they stay in the body (`keep`), and the wing pixels
    // under them come from the mirrored wing. Source pixels; mirror axis x 660.
    wings: {
      axis: 660,
      pivotL: [490, 700],
      wingL: [[-120, 370], [120, 370], [260, 470], [400, 560], [470, 640], [500, 700], [470, 760], [420, 880], [370, 1000], [340, 1100], [290, 1320], [-120, 1320]],
      keep: [
        // spear: shaft, guard and blade
        [[935, 0], [995, 0], [995, 330], [1003, 420], [1018, 500], [1022, 560], [1014, 700], [992, 800], [966, 905], [944, 905], [918, 800], [896, 700], [890, 560], [902, 500], [922, 420], [928, 330]],
        // whip: from its tip down to his hand
        [[20, 300], [170, 300], [300, 380], [430, 430], [500, 500], [505, 620], [497, 632], [393, 670], [341, 650], [272, 603], [202, 540], [150, 476], [104, 416], [40, 395]],
      ],
    },
    // Owner's FX picks (tools/art-ref/lin/, over a checkerboard) → lin_fx_<name>.png.
    fx: {
      cosmic: { file: 'tools/art-ref/lin/cosmic-spear.png', height: 480 },  // Cosmic Spear head
      arrow: { file: 'tools/art-ref/lin/shot-arrow.png', height: 128 },     // main-shot arrows
      spear: { file: 'tools/art-ref/lin/focus-spear.png', height: 192 },    // focus spears (and split shards, bomb spears)
      star: { file: 'tools/art-ref/lin/bomb-star.png', height: 192 },       // every Spear Rain hit
    },
    turret: { file: 'swarm-turrets.png', box: { left: 8, top: 8, width: 300, height: 226 }, rotate: 180, height: 120 },
    anchors: {
      hitbox: [660, 640],      // chest centre: lands on player.x/y
      head: [660, 760],
      core: [660, 400],        // forward waist spike: main-shot shards
      blade: [957, 260],       // spear blade, ~30 units ahead: focus-spear origin
      spear: [965, 30],        // spear tip (reference, ultimate launch)
      whip: [125, 40],         // whip tip (reference)
      wingL: [540, 700],       // wing roots: glitter, no thrusters
      wingR: [780, 700],
    },
  },
};
