// Per-pilot settings for tools/process-art.mjs (see ART_PIPELINE.md).
//
// folder     source folder under src/pilot concept art/ (read-only)
// back       in-game sprite source (flies up the screen)
// front      select-card preview + cut-in
// portrait   pilot portrait
// glowRule   background removal also strips dark red baked glow (off when the
//            art has dark warm shading it would eat, e.g. Mira's gold)
// portraitCrop optional { left, top, width, height } 4:5 box in portrait pixels (default: full width from the top)
// bg         'checker' for a painted checkerboard (default: flat colour flood fill);
//            frontBg overrides it for the front view (e.g. Bruno: checker back, black front);
//            bgPale also clears pale tinted checker squares (glow halos painted over it, e.g. Tess's blades)
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
    // v2 (owner's brief, ASSET_NOTES.md "Rebuild v2"): the heavy-artillery component
    // mecha. Flies feet-first (the twin legs at the top never fire); every barrel points up.
    back: 'top-down-enhance.png',
    bg: 'checker',             // painted checkerboard, no alpha
    front: 'top_down_front.png',
    frontBg: 'flat',           // the front view keeps its black background (flat flood fill)
    portrait: 'pilot_portrait.jpg',
    glowRule: false,           // dark red armour panels
    // Rigged components (left side, source px; mirrored at `axis`). Draw order and
    // motion live in src/pilots/brunoRig.js (shared rig: src/pilots/art/mechaRig.js).
    parts: {
      axis: 681,
      hole: 3,                 // @2x px: the body hole grows past each outline (no slivers)
      list: [
        { // hand gun: inner long barrel + forearm, fist and crystal (pivot at the elbow)
          name: 'gun', pivot: [320, 690],
          poly: [[226, 70], [240, 48], [285, 40], [333, 48], [348, 70], [350, 200], [355, 230], [350, 330], [352, 395], [372, 410], [392, 500], [400, 520], [402, 610], [392, 665], [372, 692], [330, 705], [285, 700], [248, 690], [238, 640], [240, 560], [242, 500], [244, 410], [236, 380], [232, 230], [228, 200]],
        },
        { // shoulder cannon: black housing + wide-bore cannon (root), outer long barrel (tip: telescopes into the housing)
          name: 'shoulder', pivot: [180, 780], exclude: ['gun'],
          split: [[40, 345], [240, 320]],
          poly: [[66, 62], [90, 46], [140, 42], [165, 55], [178, 120], [200, 190], [205, 320], [218, 385], [232, 420], [246, 470], [248, 560], [246, 700], [238, 770], [205, 798], [150, 800], [118, 790], [106, 720], [96, 690], [62, 640], [58, 520], [66, 480], [88, 465], [88, 410], [80, 330], [75, 190], [70, 120]],
        },
        { // side cannon beside the torso: base (root), barrel and magenta mouth (tip: slides back into the base)
          name: 'side', pivot: [530, 1120],
          split: [[430, 955], [570, 925]],
          poly: [[443, 812], [455, 800], [492, 800], [505, 815], [520, 860], [540, 940], [555, 1000], [560, 1060], [556, 1130], [540, 1145], [515, 1135], [495, 1080], [470, 1000], [452, 930], [440, 860]],
        },
      ],
    },
    anchors: {
      hitbox: [681, 720],      // torso centre: lands on player.x/y
      head: [681, 880],
      muzzleL: [286, 60],     // hand-gun bores (inner long barrels): the flak fan
      muzzleR: [1076, 60],
      chanL: [292, 300],      // violet energy channel along the hand-gun barrel
      chanR: [1070, 300],
      gripL: [320, 580],      // fists (purple crystal) on the hand guns
      gripR: [1042, 580],
      elbowL: [320, 690],
      elbowR: [1042, 690],
      shoulderPivotL: [180, 780], // shoulder cannon: housing pivot / barrel split / long-barrel bore (focus at T3-T4)
      shoulderPivotR: [1182, 780],
      shoulderJointL: [150, 335],
      shoulderJointR: [1212, 335],
      shoulderTipL: [114, 58],
      shoulderTipR: [1248, 58],
      wideL: [150, 410],      // wide-bore magenta cannon mouths: focus barrage
      wideR: [1212, 410],
      housingL: [150, 560],   // black housing core (charge glow)
      housingR: [1212, 560],
      sidePivotL: [530, 1120], // side cannon: base / barrel split / magenta mouth (shells from T3)
      sidePivotR: [832, 1120],
      sideJointL: [500, 940],
      sideJointR: [862, 940],
      sideTipL: [472, 820],
      sideTipR: [890, 820],
      podL: [318, 1092],      // shoulder-pod ports: wide back plumes
      podR: [1044, 1092],
      packL: [602, 1092],     // backpack struts: smaller flames
      packR: [760, 1092],
    },
  },
  tess: {
    folder: 'Tess Kuro',
    // v2 (owner's brief, ASSET_NOTES.md "Rebuild v2"): the blade component mecha.
    // Flies feet-first (the two centre leg blades never fire); the arm blades
    // point up and out and throw every crescent.
    back: 'new-top-down-main.png',
    bg: 'checker',             // painted checkerboard, no alpha
    bgPale: true,              // the blades' pink halo tints the checker squares: clear those too
    front: 'new-top-down-front.png',
    frontBg: 'flat',           // the front view keeps its black background
    portrait: 'pilot-portrait-main.jpg',
    portraitCrop: { left: 125, top: 70, width: 400, height: 500 }, // head and shoulders (4:5)
    glowRule: false,           // thin red light lines
    // Rigged components (left side, source px; mirrored at `axis`). Draw order and
    // motion live in src/pilots/tessRig.js.
    parts: {
      axis: 681,
      hole: 3,                 // @2x px: the body hole grows past each outline (no slivers)
      list: [
        { // arm: upper arm and elbow armour (root, pivot at the shoulder), forearm, clawed hand and blade (tip, whips about the elbow)
          name: 'arm', pivot: [470, 800],
          split: [[315, 738], [478, 698]],
          poly: [[0, 0], [50, 15], [120, 105], [175, 180], [230, 255], [262, 285], [300, 340], [372, 432], [350, 455], [378, 495], [412, 560], [440, 585], [488, 700], [472, 745], [462, 790], [432, 835], [410, 905], [378, 908], [350, 862], [334, 782], [300, 725], [255, 632], [224, 560], [214, 505], [188, 470], [168, 420], [148, 380], [122, 330], [92, 268], [40, 150], [4, 40]],
        },
      ],
    },
    anchors: {
      hitbox: [681, 760],       // chest centre: lands on player.x/y
      head: [681, 860],         // head (rear spike points back)
      waist: [681, 570],        // red-tipped waist between the leg blades (feet: never fire)
      bladeTipL: [35, 55],      // blade point
      bladeTipR: [1327, 55],
      bladeMidL: [180, 280],    // middle of the glowing blade
      bladeMidR: [1182, 280],
      bladeBaseL: [330, 545],   // blade root at the hand: crescents leave the blade between base and tip
      bladeBaseR: [1032, 545],
      wristL: [390, 640],       // clawed hand
      wristR: [972, 640],
      elbowL: [395, 760],       // elbow joint (forearm + blade swing about it)
      elbowR: [967, 760],
      shoulderL: [470, 800],    // shoulder pivot of the whole arm
      shoulderR: [892, 800],
      ventL: [590, 985],        // shoulder-spike roots: wide back plumes
      ventR: [772, 985],
      packL: [652, 1005],       // either side of the head spike: small plumes
      packR: [710, 1005],
    },
  },
  oduya: {
    folder: 'Oduya Rex',
    // v2 (owner's brief, ASSET_NOTES.md "Rebuild v2"): the thunder-god component
    // mecha on the same sprite. Flies feet-first (the gold drill legs never fire);
    // every bolt leaves a gold fist.
    back: 'top-down-main.jpg',
    front: 'top-down-front.png',
    portrait: 'pilot-portrait.jpg',
    portraitCrop: { left: 150, top: 60, width: 480, height: 600 }, // face, crown and beard (4:5)
    glowRule: false,
    // Rigged components (left side, source px; mirrored at `axis`). Draw order and
    // motion live in src/pilots/oduyaRig.js.
    parts: {
      axis: 668,
      hole: 3,                 // @2x px: the body hole grows past each outline (no slivers)
      list: [
        { // arm: elbow joint and upper arm (root, pivot at the shoulder), gauntlet and gold fist (tip: punches along its axis)
          name: 'arm', pivot: [470, 760],
          split: [[352, 662], [478, 598]],
          poly: [[276, 412], [298, 396], [332, 404], [348, 440], [364, 470], [404, 504], [442, 546], [458, 592], [472, 640], [482, 690], [480, 742], [458, 774], [420, 778], [394, 748], [384, 704], [360, 664], [320, 644], [288, 604], [260, 542], [256, 482], [266, 440]],
        },
        { // lightning wing: the black-and-blue blade panels behind the arm
          name: 'wing', pivot: [440, 830], exclude: ['arm'],
          poly: [[4, 390], [60, 420], [130, 470], [200, 520], [250, 470], [300, 500], [300, 560], [330, 620], [380, 690], [440, 720], [500, 760], [520, 840], [510, 940], [470, 1040], [400, 1120], [330, 1172], [200, 1172], [90, 1160], [10, 1150], [40, 1060], [90, 960], [120, 880], [130, 800], [100, 720], [60, 620], [30, 520]],
        },
      ],
    },
    anchors: {
      hitbox: [668, 480],       // chest centre: lands on player.x/y
      head: [668, 640],         // gold lion head
      crown: [668, 170],        // central gold spike at the waist front (never fires)
      fistL: [305, 430],        // gold knuckles: every bolt leaves here
      fistR: [1031, 430],
      wristL: [395, 620],       // blue wrist ring
      wristR: [941, 620],
      elbowL: [430, 675],       // white elbow joint (the gauntlet punches from here)
      elbowR: [906, 675],
      shoulderL: [470, 760],    // shoulder pivot of the whole arm
      shoulderR: [866, 760],
      wingRootL: [440, 830],    // lightning wing pivot
      wingRootR: [896, 830],
      wingTipL: [20, 400],      // upper wing tip
      wingTipR: [1316, 400],
      wingLowL: [60, 1100],     // lower wing blade tip
      wingLowR: [1276, 1100],
      ventL: [380, 900],        // wing roots: wide back plumes
      ventR: [956, 900],
      maneL: [640, 1060],       // gold flame mane: smaller plumes
      maneR: [696, 1060],
    },
  },
  lin: {
    folder: 'Lin Hayase',
    // v2 (owner's brief, ASSET_NOTES.md "Rebuild v2"): a component mecha on the same
    // sprite. The whip swings out in front and throws the shards; the spear thrusts;
    // the butterfly wings beat. Flies feet-first (the crystal legs never fire).
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
      fillAll: true,           // v2: fill every pixel under the whip / spear (body too) → lin_wings@2x.png, the rig's `under` image
      fillGrow: 6,             // and the weapons' outline / glow round them
      pivotL: [490, 700],
      wingL: [[-120, 370], [120, 370], [260, 470], [400, 560], [470, 640], [500, 700], [470, 760], [420, 880], [370, 1000], [340, 1100], [290, 1320], [-120, 1320]],
      keep: [
        // spear: shaft, guard and blade
        [[935, 0], [995, 0], [995, 330], [1003, 420], [1018, 500], [1022, 560], [1014, 700], [992, 800], [966, 905], [944, 905], [918, 800], [896, 700], [890, 560], [902, 500], [922, 420], [928, 330]],
        // whip: from its tip down to his hand (v2: the whole whip, as its rig part)
        [[138, 2], [162, 40], [152, 110], [170, 180], [205, 212], [236, 262], [276, 298], [306, 330], [344, 368], [386, 406], [424, 436], [458, 466], [496, 500], [510, 560], [504, 632], [470, 664], [420, 674], [376, 646], [326, 606], [276, 596], [236, 568], [196, 538], [146, 486], [98, 426], [56, 376], [34, 330], [24, 280], [22, 230], [32, 180], [42, 140], [62, 98], [98, 48]],
      ],
    },
    // v2 rigged components (source px; the whip and spear are one-sided). The body and
    // the wings draw from the weapon-free `under` image, so moving weapons leave no hole.
    // Draw order and motion live in src/pilots/linRig.js.
    parts: {
      axis: 660,
      hole: 3,
      bodySrc: 'under',
      list: [
        { // butterfly wing (beats; under everything)
          name: 'wing', pivot: [490, 700], src: 'under',
          poly: [[-120, 370], [120, 370], [260, 470], [400, 560], [470, 640], [500, 700], [470, 760], [420, 880], [370, 1000], [340, 1100], [290, 1320], [-120, 1320]],
        },
        { // whip (left hand): handle half (root, pivot at the hand) and tip half (tip, lags behind as it lashes)
          name: 'whip', side: 'L', pivot: [470, 600],
          split: [[70, 372], [252, 250]],
          poly: [[138, 2], [162, 40], [152, 110], [170, 180], [205, 212], [236, 262], [276, 298], [306, 330], [344, 368], [386, 406], [424, 436], [458, 466], [496, 500], [510, 560], [504, 632], [470, 664], [420, 674], [376, 646], [326, 606], [276, 596], [236, 568], [196, 538], [146, 486], [98, 426], [56, 376], [34, 330], [24, 280], [22, 230], [32, 180], [42, 140], [62, 98], [98, 48]],
        },
        { // spear (right hand): shaft, guard and blade; thrusts along its axis
          name: 'spear', side: 'R', pivot: [955, 600],
          poly: [[935, 0], [995, 0], [995, 330], [1003, 420], [1018, 500], [1022, 560], [1014, 700], [992, 800], [966, 905], [944, 905], [918, 800], [896, 700], [890, 560], [902, 500], [922, 420], [928, 330]],
        },
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
      whipHand: [470, 600],    // v2: whip handle (left hand, the whip's pivot)
      whipJoint: [160, 312],   // whip split: handle half / tip half
      whipMid: [300, 470],     // crystals along the handle half
      whipTip: [140, 12],      // whip tip
      spearHand: [955, 600],   // spear grip (its pivot)
      spearTip: [965, 30],     // spear tip
      wingL: [540, 700],       // wing roots: glitter, no thrusters
      wingR: [780, 700],
      wingPivotL: [490, 700],  // v2: wing-beat pivots
      wingPivotR: [830, 700],
    },
  },
  miguerre: {
    folder: "Miguerre Zo'Rajah",
    // v2 (owner's brief, ASSET_NOTES.md "Rebuild v2"): the new horned, winged sword
    // knight as a component mecha. Flies feet-first (the legs at the top never fire);
    // every void beam leaves the horns on his head; the bat wings beat (no thrusters).
    back: 'new-top-down-sprite.png',
    front: 'new-mecha.png',
    portrait: 'pilot-portrait.jpg',
    portraitCrop: { left: 110, top: 0, width: 520, height: 650 }, // head and shoulders (4:5)
    bg: 'checker',             // painted checkerboard, not real transparency
    glowRule: false,           // the copper light is paint
    // The weapon-free `under` image (miguerre_wings@2x.png): every pixel under the
    // sword arm (right) and the claw arm (left) is filled from the mirrored side
    // (from neighbours where both sides are covered). The rig draws the body and
    // wings from it, so the swinging sword leaves no hole. Mirror axis x 511.
    wings: {
      axis: 511,
      fillAll: true,
      fillGrow: 5,
      fillSmooth: 30,          // soften the neighbour fill where the claw and the sword cover each other's mirror (round the shoulders)
      fillClear: [[[130, 500], [330, 500], [330, 742], [130, 742]]], // above the shoulders that overlap is the gap between spikes: transparent
      pivotL: [400, 940],
      wingL: [[-20, 530], [40, 590], [110, 660], [170, 730], [230, 800], [280, 860], [330, 900], [390, 905], [440, 930], [470, 980], [440, 1040], [380, 1100], [320, 1170], [260, 1260], [190, 1360], [130, 1460], [90, 1540], [-20, 1540]],
      keep: [
        // sword arm: blade, long ribbed haft, hand and arm to the shoulder
        [[854, 2], [874, 58], [866, 200], [858, 330], [846, 436], [850, 520], [862, 600], [866, 700], [862, 765], [830, 785], [812, 818], [800, 860], [796, 940], [794, 1040], [748, 1044], [752, 950], [756, 862], [735, 848], [690, 852], [650, 864], [618, 852], [610, 810], [640, 770], [690, 752], [735, 742], [750, 700], [752, 600], [762, 540], [776, 380], [797, 300], [822, 70]],
        // claw arm: claw, forearm and upper arm to the shoulder
        [[232, 590], [252, 598], [264, 640], [264, 690], [284, 738], [302, 768], [342, 788], [396, 812], [422, 850], [402, 882], [350, 878], [300, 842], [258, 802], [228, 762], [210, 700], [203, 650], [210, 604]],
      ],
    },
    // Rigged components (source px; the arms are one-sided, the wings mirrored).
    // Draw order and motion live in src/pilots/miguerreRig.js.
    parts: {
      axis: 511,
      hole: 3,
      bodySrc: 'under',
      list: [
        { // bat wing (beats; under everything)
          name: 'wing', pivot: [400, 940], src: 'under',
          poly: [[-20, 530], [40, 590], [110, 660], [170, 730], [230, 800], [280, 860], [330, 900], [390, 905], [440, 930], [470, 980], [440, 1040], [380, 1100], [320, 1170], [260, 1260], [190, 1360], [130, 1460], [90, 1540], [-20, 1540]],
        },
        { // sword arm (right): arm, hand and the pole-sword, turning about the shoulder
          name: 'sword', side: 'R', pivot: [630, 840],
          poly: [[854, 2], [874, 58], [866, 200], [858, 330], [846, 436], [850, 520], [862, 600], [866, 700], [862, 765], [830, 785], [812, 818], [800, 860], [796, 940], [794, 1040], [748, 1044], [752, 950], [756, 862], [735, 848], [690, 852], [650, 864], [618, 852], [610, 810], [640, 770], [690, 752], [735, 742], [750, 700], [752, 600], [762, 540], [776, 380], [797, 300], [822, 70]],
        },
        { // claw arm (left): turning about the shoulder
          name: 'claw', side: 'L', pivot: [392, 840],
          poly: [[232, 590], [252, 598], [264, 640], [264, 690], [284, 738], [302, 768], [342, 788], [396, 812], [422, 850], [402, 882], [350, 878], [300, 842], [258, 802], [228, 762], [210, 700], [203, 650], [210, 604]],
        },
      ],
    },
    // No FX picks: his effects are drawn live after the owner's references (tools/art-ref/miguerre/).
    anchors: {
      hitbox: [511, 760],      // chest: lands on player.x/y
      head: [511, 900],        // the horned head (bottom of the body)
      core: [511, 905],        // between the horns: the ultimate pours from here
      hornL: [452, 930],       // the two horns (white-edged blades swept back): every void beam leaves here
      hornR: [570, 930],
      hornRootL: [486, 878],   // horn roots (the charge runs root → edge)
      hornRootR: [536, 878],
      hornTipL: [408, 1004],   // horn tips
      hornTipR: [614, 1004],
      spike: [511, 275],       // forward spike between the legs (never fires)
      footL: [400, 290],       // the legs (feet) never fire
      footR: [622, 290],
      shoulderR: [630, 840],   // sword arm pivot
      grip: [775, 800],        // his hand on the haft
      guard: [800, 600],       // where the blade widens (the charge runs guard → tip)
      swordMid: [826, 300],
      swordTip: [854, 8],
      pommel: [772, 1036],     // haft end
      shoulderL: [392, 840],   // claw arm pivot
      claw: [234, 615],        // the open claw
      wingPivotL: [400, 940],  // wing-beat pivots
      wingPivotR: [622, 940],
      wingTipL: [6, 552],      // upper wing tips
      wingTipR: [1016, 552],
      wingLowL: [66, 1522],    // lower wing tips
      wingLowR: [956, 1522],
      wingMidL: [120, 1100],   // trailing edges (void feathers shed from here)
      wingMidR: [902, 1100],
    },
  },
};
