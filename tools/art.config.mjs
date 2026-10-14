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
    // v2 (owner's brief, ASSET_NOTES.md "Rebuild v2"): the component mecha. Flies
    // feet-first (the red-tipped feet at the top never fire); hand cannons point up.
    back: 'top-down-enhance.png',
    bg: 'checker',             // painted checkerboard, no alpha
    front: 'Top-Down-front-new.png',
    portrait: 'pilot_portrait.jpg',
    glowRule: true,
    // Rigged components (left side, source px; mirrored at `axis`). Draw order and
    // motion live in src/pilots/kairoRig.js.
    parts: {
      axis: 655,
      hole: 3,                 // @2x px: the body hole grows past each outline (no slivers)
      list: [
        { // hand cannon + fist + forearm (drawn over the inner blade, under the shoulder armour)
          name: 'gun', pivot: [425, 615],
          poly: [[382, 333], [414, 331], [420, 372], [440, 365], [463, 370], [496, 393], [510, 430], [510, 470], [500, 520], [482, 546], [465, 560], [463, 600], [447, 630], [400, 632], [388, 602], [384, 540], [379, 470], [377, 400], [379, 368]],
        },
        { // inner wing blade (behind the cannon); 2 sections: the tip telescopes into the root
          name: 'inner', pivot: [362, 605], exclude: ['gun'],
          split: [[369, 349], [185, 425]],
          poly: [[178, 158], [198, 163], [250, 248], [300, 330], [347, 395], [360, 430], [370, 480], [380, 540], [388, 600], [382, 628], [356, 628], [338, 596], [316, 546], [290, 482], [248, 372], [213, 270]],
        },
        { // outer wing blade (outermost, under the binder panel)
          name: 'outer', pivot: [285, 830], exclude: ['inner', 'gun'],
          split: [[250, 508], [38, 620]],
          poly: [[-2, 294], [14, 298], [62, 343], [112, 398], [186, 508], [222, 558], [242, 590], [262, 640], [278, 700], [286, 760], [294, 820], [302, 860], [300, 892], [268, 897], [243, 860], [208, 790], [168, 700], [118, 590], [68, 470], [28, 380]],
        },
      ],
    },
    anchors: {
      hitbox: [655, 590],      // blue chest plate: lands on player.x/y
      chest: [655, 590],       // focus beam emitter (blue chest core); never the feet
      head: [655, 720],
      muzzleL: [397, 340],     // hand-cannon bores: normal lances + tier-4 extras
      muzzleR: [913, 340],
      chanL: [415, 500],       // blue energy channel on each cannon
      chanR: [895, 500],
      gripL: [470, 450],       // fists
      gripR: [840, 450],
      elbowL: [425, 615],
      elbowR: [885, 615],
      innerPivotL: [362, 605], // inner blade root / joint / tip (tip = tier-3 emitter)
      innerPivotR: [948, 605],
      innerJointL: [277, 387],
      innerJointR: [1033, 387],
      innerTipL: [183, 166],
      innerTipR: [1127, 166],
      outerPivotL: [285, 830], // outer blade root / joint / tip (tip = tier-4 emitter)
      outerPivotR: [1025, 830],
      outerJointL: [144, 564],
      outerJointR: [1166, 564],
      outerTipL: [4, 299],
      outerTipR: [1306, 299],
      thrL: [612, 1000],       // thrusters at the backpack's base
      thrR: [698, 1000],
      finL: [330, 985],        // small vents on the lower fins
      finR: [980, 985],
      footL: [632, 64],        // feet (reference only: never fire)
      footR: [687, 106],
    },
  },
  mira: {
    folder: 'Mira Solenne',
    // v2 (owner's brief, ASSET_NOTES.md "Rebuild v2"): the component mecha. Flies
    // feet-first (the twin legs at the top never fire); the hand cannons point up.
    back: 'top-down-enhance.png', // flat white background: the edge flood fill stops at the black outline
    front: 'top-down_front.png',
    portrait: 'pilot_portrait.jpg',
    glowRule: false,
    // Rigged components (left side, source px; mirrored at `axis`). Draw order and
    // motion live in src/pilots/miraRig.js (shared rig: src/pilots/art/mechaRig.js).
    parts: {
      axis: 681,
      hole: 3,                 // @2x px: the body hole grows past each outline (no slivers)
      list: [
        { // hand cannon: dark barrel, gold housing, side tube and fist (under the shoulder armour)
          name: 'gun', pivot: [415, 625],
          poly: [[355, 322], [368, 312], [396, 313], [413, 328], [416, 352], [426, 440], [446, 446], [450, 520], [470, 560], [482, 600], [470, 630], [420, 640], [372, 636], [348, 616], [336, 592], [332, 560], [334, 470], [346, 452], [348, 340]],
        },
        { // inner array: the long and short gold blades and the pale blade between them (behind the cannon);
          // 2 sections: the long blade's upper half telescopes into the root
          name: 'inner', pivot: [330, 625], exclude: ['gun'],
          split: [[334, 300], [190, 370]],
          poly: [[216, 136], [232, 146], [264, 205], [296, 262], [318, 318], [342, 328], [356, 350], [352, 450], [338, 470], [334, 560], [338, 600], [342, 626], [318, 630], [292, 618], [262, 555], [232, 488], [204, 432], [186, 394], [188, 380], [200, 382], [210, 330], [206, 160]],
        },
        { // outer array: the white side blade with its gold edges and lavender underside
          name: 'outer', pivot: [300, 640], exclude: ['inner', 'gun'],
          split: [[190, 480], [120, 610]],
          poly: [[16, 462], [30, 457], [150, 518], [240, 560], [300, 598], [318, 628], [298, 668], [284, 700], [278, 732], [250, 728], [205, 672], [170, 635], [100, 566], [40, 500]],
        },
      ],
    },
    anchors: {
      hitbox: [681, 600],      // chest centre: lands on player.x/y
      chest: [681, 565],       // chest emitter: tier-1 needle fan + focus needle stream; never the feet
      head: [681, 730],
      muzzleL: [378, 318],     // hand-cannon bores: the needle fan from tier 2
      muzzleR: [984, 318],
      chanL: [380, 410],       // dark barrel: energy channel
      chanR: [982, 410],
      gripL: [420, 520],       // fists on the cannons
      gripR: [942, 520],
      elbowL: [415, 625],
      elbowR: [947, 625],
      innerPivotL: [330, 625], // inner array root / joint / tip
      innerPivotR: [1032, 625],
      innerJointL: [265, 330],
      innerJointR: [1097, 330],
      innerTipL: [217, 140],
      innerTipR: [1145, 140],
      outerPivotL: [300, 640], // outer blade root / joint / tip
      outerPivotR: [1062, 640],
      outerJointL: [155, 545],
      outerJointR: [1207, 545],
      outerTipL: [20, 462],
      outerTipR: [1342, 462],
      ventL: [432, 1138],      // ladder-vent fins: wide back plumes
      ventR: [930, 1138],
      packL: [668, 1040],      // backpack spike: centre exhaust
      packR: [694, 1040],
      footL: [580, 870],       // gold skirt plates: foot flames
      footR: [782, 870],
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
  dax: {
    folder: 'Dax Morrow',
    back: 'top-down-main.jpg',
    front: 'top-down-front.jpg',
    portrait: 'pilot-portrait.jpg',
    portraitCrop: { left: 110, top: 0, width: 520, height: 650 }, // head and shoulders (4:5)
    bg: 'checker',             // painted checkerboard, not real transparency
    glowRule: false,           // the red glow is paint
    // The lower blade wings (and the fins under them) move; nothing held crosses them.
    wings: {
      axis: 572,
      pivotL: [480, 880],
      wingL: [[-80, 1150], [150, 1000], [300, 900], [440, 820], [490, 860], [490, 930], [440, 1000], [420, 1140], [400, 1420], [-80, 1420]],
      keep: [],
    },
    // No FX picks: Dax's effects are drawn live after the owner's references (tools/art-ref/dax/).
    anchors: {
      hitbox: [572, 805],      // red chest core: lands on player.x/y
      head: [572, 900],
      core: [572, 805],        // the chest core: every void beam leaves here (owner's choice B)
      spike: [572, 160],       // forward waist spike (reference)
      lensL: [175, 515],       // red lenses on the forearm shield pods (reference)
      lensR: [968, 515],
      ventL: [430, 1180],      // rear fin roots: wide void plumes
      ventR: [715, 1180],
      packL: [530, 1100],      // either side of the rear spine: smaller plumes
      packR: [615, 1100],
    },
  },
};
