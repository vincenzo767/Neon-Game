// GROUND archetype — phase-arena configurations (5 per boss).
//
// Config fields (see docs/ARENA_REWORK.md):
//   id, name, boss, phase      stable id; display name; owner boss id; authored phase 1..5
//   env, params                environment module + its parameters (world/env/*)
//   light                      lighting preset + overrides (world/lighting.js)
//   scroll                     forward speed multiplier
//   wind                       [x, y] drift for smoke, ash, embers
//   weather                    screen-space streaks: none | light_rain | heavy_rain | embers | sparks | dust | ...
//   ambient                    near-field layers: ash | snow | dust | sandstorm | heat | lightning | bubbles | marine_snow
//   transition                 transition into this arena (bosses/transitions.js)
//   visibility                 { darkness, radius } gameplay light pool (Abyssal), else omitted
//   music                      music layer id

export default [
  {
    id: 'cc_burning_overpass', name: 'Burning Overpass', boss: 'colossus_crawler', phase: 1,
    env: 'highway',
    params: { fires: 0.75, damage: 0.65, collapse: 0.5, cityBurn: 0.35, traffic: 0.75, military: 0.3, lamps: 0.35 },
    light: { preset: 'smoke' },
    scroll: 0.8, wind: [0.9, 0.3],
    weather: 'embers', ambient: ['ash'],
    transition: 'flash', music: 'ground_p1',
  },
  {
    id: 'cc_tunnel_collapse', name: 'Tunnel Collapse', boss: 'colossus_crawler', phase: 2,
    env: 'tunnel',
    params: { collapse: 0.75, damage: 0.6, traffic: 0.6, fires: 0.35, lights: 0.6, flood: 0.2, military: 0.3 },
    light: { preset: 'interior' },
    scroll: 1.15, wind: [0.2, -0.4],
    weather: 'dust', ambient: ['dust'],
    transition: 'rockfall', music: 'ground_p2',
  },
  {
    id: 'cc_scrapyard_sunset', name: 'Scrapyard Sunset', boss: 'colossus_crawler', phase: 3,
    env: 'scrapyard',
    params: { density: 0.85, fires: 0.3, desert: 0.5, gantry: true, wet: 0.15, damage: 0.35 },
    light: { preset: 'dusk', elev: 11, az: 284, sunI: 1.4 },
    scroll: 0.8, wind: [1.2, 0.2],
    weather: 'dust', ambient: ['sandstorm'],
    transition: 'sandstorm', music: 'ground_p3',
  },
  {
    id: 'cc_molten_floor', name: 'Molten Floor', boss: 'colossus_crawler', phase: 4,
    env: 'foundry',
    params: { heat: 0.95, damage: 0.55, channels: 0.8, hall: true },
    light: { preset: 'interior', ambient: [0.24, 0.16, 0.12], sun: [1, 0.62, 0.38], sunI: 0.5, fog: [0.16, 0.07, 0.04], fogStart: 380, fogEnd: 1500, fogMax: 0.75 },
    scroll: 1.0, wind: [0.3, 0.6],
    weather: 'embers', ambient: ['heat'],
    transition: 'lava_flood', music: 'ground_p4',
  },
  {
    id: 'cc_ash_siege_field', name: 'Ash Siege Field', boss: 'colossus_crawler', phase: 5,
    env: 'battlefield',
    params: { ground: 'ash', craters: 0.85, ruins: 0.75, fort: 0.85, fires: 0.6, armour: 0.7, road: true, trees: 0.5 },
    light: { preset: 'smoke', sun: [0.95, 0.5, 0.32], elev: 20, fog: [0.3, 0.24, 0.22] },
    scroll: 0.9, wind: [1.0, 0.5],
    weather: 'embers', ambient: ['ash'],
    transition: 'flash', music: 'ground_p5',
    desperation: { name: 'Scorched Earth', params: { fires: 1, craters: 1 }, light: { sun: [1, 0.35, 0.2], fog: [0.36, 0.14, 0.1] } },
  },
  // ---------------------------------------------------------------- White Fang
  {
    id: 'wf_frozen_frontline', name: 'Frozen Frontline', boss: 'white_fang', phase: 1,
    env: 'frontline',
    params: { craters: 0.8, walls: 0.8, wrecks: 0.75, fires: 0.6, poles: true },
    light: { preset: 'arctic', elev: 40, az: 305, ambient: [0.4, 0.45, 0.56], fogStart: 700, fogEnd: 2600, fogMax: 0.45 },
    scroll: 0.8, wind: [1.2, -0.3],
    weather: 'none', ambient: ['snow'],
    transition: 'flash', music: 'ground_p1',
  },
  {
    id: 'wf_ice_canyon', name: 'Ice Canyon', boss: 'white_fang', phase: 2,
    env: 'terrain',
    params: { surface: 'snow', relief: 'canyon', canyonW: 90, road: true, convoy: 0.5, wrecks: 0.4, boulders: 0.6, forest: 0.15 },
    light: { preset: 'arctic', elev: 24, az: 300 },
    scroll: 1.1, wind: [0.8, -0.6],
    weather: 'none', ambient: ['snow'],
    transition: 'ice_crack', music: 'ground_p2',
  },
  {
    id: 'wf_research_facility', name: 'Research Facility', boss: 'white_fang', phase: 3,
    env: 'terrain',
    params: { surface: 'snow', relief: 'flat', road: true, convoy: 0.3, facility: 1, wrecks: 0.3, military: 0.6, forest: 0.3 },
    light: { preset: 'arctic', elev: 30 },
    scroll: 0.85, wind: [1, -0.2],
    weather: 'none', ambient: ['snow'],
    transition: 'screen_tear', music: 'ground_p3',
  },
  {
    id: 'wf_glacial_chasm', name: 'Glacial Chasm', boss: 'white_fang', phase: 4,
    env: 'terrain',
    params: { surface: 'ice', relief: 'glacier', road: false, convoy: 0, crevasses: 1, boulders: 0.5, wrecks: 0.2 },
    light: { preset: 'arctic', elev: 16, sun: [1, 0.95, 0.9] },
    scroll: 0.9, wind: [1.4, -0.4],
    weather: 'none', ambient: ['snow'],
    transition: 'ice_crack', music: 'ground_p4',
  },
  {
    id: 'wf_avalanche_field', name: 'Avalanche Field', boss: 'white_fang', phase: 5,
    env: 'terrain',
    params: { surface: 'snow', relief: 'hills', road: true, convoy: 0, wrecks: 0.6, avalanche: 1, forest: 0.4, boulders: 0.5 },
    light: { preset: 'overcast', fog: [0.78, 0.82, 0.88], fogStart: 300, fogEnd: 1500, fogMax: 0.75 },
    scroll: 1.0, wind: [2.2, -0.6],
    weather: 'none', ambient: ['snow', 'spray'],
    transition: 'cloud_burst', music: 'ground_p5',
    desperation: { name: 'Whiteout', light: { fogMax: 0.85, fogStart: 200 } },
  },
  // ---------------------------------------------------------------- Sandbreaker
  // All five run on the Dune Sea main line (env 'dunesea'): the SANDBREAKER
  // train rig needs the shared rails under it in every phase. Steeper camera
  // pitch so the locomotive AND the cars behind it fit the portrait screen.
  {
    id: 'sb_dune_convoy', name: 'Dune Sea Convoy', boss: 'sandbreaker', phase: 1,
    env: 'dunesea',
    params: { dunes: 1, wrecks: 0.8, depots: 0.75, fires: 0.7, craters: 0.75, branch: true },
    light: { preset: 'desert', elev: 44, az: 305, fogStart: 900, fogEnd: 2800, fogMax: 0.4 },
    camera: { pitch: 0.45 }, keepBehind: 2,
    scroll: 1.25, wind: [1.4, 0.2],
    weather: 'dust', ambient: ['heat', 'dust'],
    transition: 'flash', music: 'ground_p1',
  },
  {
    id: 'sb_oil_field', name: 'Oil Field Blaze', boss: 'sandbreaker', phase: 2,
    env: 'dunesea',
    params: { dunes: 0.45, wrecks: 0.55, depots: 0.5, fires: 0.95, craters: 0.6, oil: 1, branch: false },
    light: { preset: 'smoke', sun: [1, 0.68, 0.42], elev: 34, fog: [0.42, 0.32, 0.24] },
    camera: { pitch: 0.45 }, keepBehind: 2,
    scroll: 0.95, wind: [1.1, 0.4],
    weather: 'embers', ambient: ['ash', 'heat'],
    transition: 'sandstorm', music: 'ground_p2',
  },
  {
    id: 'sb_canyon_pass', name: 'Canyon Pass', boss: 'sandbreaker', phase: 3,
    env: 'dunesea',
    params: { dunes: 0.6, wrecks: 0.5, depots: 0.3, fires: 0.4, craters: 0.5, canyon: 1, branch: false },
    light: { preset: 'desert', elev: 36, az: 250 },
    camera: { pitch: 0.45 }, keepBehind: 2,
    scroll: 1.15, wind: [0.6, 0.8],
    weather: 'dust', ambient: ['dust'],
    transition: 'rockfall', music: 'ground_p3',
  },
  {
    id: 'sb_oasis_ruins', name: 'Oasis Ruins', boss: 'sandbreaker', phase: 4,
    env: 'dunesea',
    params: { dunes: 0.9, wrecks: 0.6, depots: 0.4, fires: 0.45, craters: 0.6, ruins: 1, branch: true },
    light: { preset: 'dusk', elev: 20, az: 280, sunI: 1.3 },
    camera: { pitch: 0.45 }, keepBehind: 2,
    scroll: 0.9, wind: [1.2, 0.1],
    weather: 'dust', ambient: ['heat'],
    transition: 'sandstorm', music: 'ground_p4',
  },
  {
    id: 'sb_salt_flats', name: 'Salt Flat Storm', boss: 'sandbreaker', phase: 5,
    env: 'dunesea',
    params: { dunes: 0.5, wrecks: 0.7, depots: 0.5, fires: 0.6, craters: 0.7, salt: 1, branch: true },
    light: { preset: 'desert', elev: 40, fog: [0.8, 0.68, 0.52], fogStart: 320, fogEnd: 1500, fogMax: 0.62 },
    camera: { pitch: 0.45 }, keepBehind: 2,
    scroll: 1.3, wind: [2.4, 0.3],
    weather: 'dust', ambient: ['sandstorm'],
    transition: 'sandstorm', music: 'ground_p5',
    desperation: { name: 'Scorched Sands', params: { fires: 1 }, light: { sun: [1, 0.55, 0.3], fogMax: 0.75 } },
  },
  // ---------------------------------------------------------------- Urban Devastator
  // All five phases are the same Downtown Siege boulevard (env downtown, one
  // city seed): the URBAN DEVASTATOR car rig drives the shared road model
  // (world/env/downtownRoad.js) in every phase, so only mood and damage vary.
  // Steeper camera pitch: the car's rear (turbine, taillights, rear guns)
  // faces the pursuing player and the road runs off toward the horizon.
  {
    id: 'ud_downtown_siege', name: 'Downtown Siege', boss: 'urban_devastator', phase: 1,
    env: 'downtown',
    params: { fires: 0.7, damage: 0.7, collapse: 0.35, traffic: 0.8, military: 0.55, lamps: 0.8, construction: 0.5, smoke: 0.7 },
    light: { preset: 'smoke', elev: 28, az: 296, sun: [1, 0.62, 0.38], sunI: 0.95, ambient: [0.22, 0.2, 0.23], fog: [0.24, 0.17, 0.15], fogStart: 800, fogEnd: 2800, fogMax: 0.55 },
    camera: { pitch: 0.62 }, keepBehind: 1,
    scroll: 1.0, wind: [0.8, 0.4],
    weather: 'embers', ambient: ['ash'],
    transition: 'flash', music: 'ground_p1',
    desperation: { name: 'Urban Collapse', params: { fires: 1, collapse: 0.7, smoke: 1, damage: 0.95 }, light: { sun: [1, 0.45, 0.25], fog: [0.3, 0.13, 0.1] } },
  },
  {
    id: 'ud_collapsed_metro', name: 'Financial District', boss: 'urban_devastator', phase: 2,
    env: 'downtown',
    params: { fires: 0.45, damage: 0.55, collapse: 0.25, traffic: 0.65, military: 0.4, lamps: 1, construction: 0.35, smoke: 0.45, night: true },
    light: { preset: 'night', elev: 36, sun: [0.75, 0.62, 0.62], sunI: 0.5, ambient: [0.14, 0.15, 0.22], fog: [0.07, 0.07, 0.1], fogStart: 900, fogEnd: 2800, fogMax: 0.6 },
    camera: { pitch: 0.62 }, keepBehind: 1,
    scroll: 1.0, wind: [0.5, 0.5],
    weather: 'embers', ambient: ['ash'],
    transition: 'screen_tear', music: 'ground_p2',
  },
  {
    id: 'ud_rail_yard', name: 'Expressway Collapse', boss: 'urban_devastator', phase: 3,
    env: 'downtown',
    params: { fires: 0.6, damage: 0.95, collapse: 0.6, traffic: 0.85, military: 0.7, lamps: 0.5, construction: 0.85, smoke: 0.8 },
    light: { preset: 'dusk', elev: 16, az: 284, sunI: 1.15, fog: [0.42, 0.28, 0.22], fogStart: 700, fogEnd: 2400, fogMax: 0.6 },
    camera: { pitch: 0.62 }, keepBehind: 1,
    scroll: 1.0, wind: [1.0, 0.3],
    weather: 'dust', ambient: ['dust', 'ash'],
    transition: 'rockfall', music: 'ground_p3',
  },
  {
    id: 'ud_tower_inferno', name: 'Burning Boulevard', boss: 'urban_devastator', phase: 4,
    env: 'downtown',
    params: { fires: 1, damage: 0.85, collapse: 0.55, traffic: 0.75, military: 0.6, lamps: 0.6, construction: 0.4, smoke: 1, night: true },
    light: { preset: 'night', sun: [1, 0.55, 0.3], sunI: 0.55, ambient: [0.2, 0.13, 0.11], fog: [0.2, 0.1, 0.07], fogStart: 700, fogEnd: 2400, fogMax: 0.65 },
    camera: { pitch: 0.62 }, keepBehind: 1,
    scroll: 1.0, wind: [0.6, 0.8],
    weather: 'embers', ambient: ['ash', 'heat'],
    transition: 'flash', music: 'ground_p4',
  },
  {
    id: 'ud_flooded_core', name: 'Flooded Financial Core', boss: 'urban_devastator', phase: 5,
    env: 'downtown',
    params: { fires: 0.45, damage: 0.75, collapse: 0.45, traffic: 0.7, military: 0.5, lamps: 0.9, construction: 0.3, smoke: 0.6, wet: 1, night: true },
    light: { preset: 'storm', elev: 40, ambient: [0.18, 0.2, 0.26], fog: [0.12, 0.13, 0.17], fogStart: 700, fogEnd: 2500, fogMax: 0.65 },
    camera: { pitch: 0.62 }, keepBehind: 1,
    scroll: 1.0, wind: [1.6, 1.0],
    weather: 'heavy_rain', ambient: ['lightning'],
    transition: 'water_flood', music: 'ground_p5',
    desperation: { name: 'Urban Collapse', params: { fires: 1, collapse: 0.8, smoke: 1 }, light: { fog: [0.24, 0.12, 0.1] } },
  },
  // ---------------------------------------------------------------- Iron Vein
  // All five phases are the same open-pit mine (env openpit), parameterised:
  // the working pit, the spoil terraces, the haul junction, the fractured
  // benches and the deep pit where the drive breaches into molten rock.
  {
    id: 'iv_open_pit', name: 'Open-Pit Mine', boss: 'iron_vein', phase: 1,
    env: 'openpit',
    params: { trucks: 0.85, machines: 0.8, conveyors: 0.9, fires: 0.45, craters: 0.6, spoil: 0.35, veins: 0.5 },
    light: { preset: 'afternoon', elev: 38, az: 300, sun: [1, 0.86, 0.68], ambient: [0.36, 0.33, 0.32], fog: [0.62, 0.55, 0.47], fogStart: 600, fogEnd: 2300, fogMax: 0.5 },
    scroll: 0.85, wind: [0.8, 0.2],
    weather: 'dust', ambient: ['dust'],
    transition: 'flash', music: 'ground_p1',
  },
  {
    id: 'iv_mine_shaft', name: 'Spoil Terraces', boss: 'iron_vein', phase: 2,
    env: 'openpit',
    params: { trucks: 1, machines: 0.6, conveyors: 1, fires: 0.3, craters: 0.4, spoil: 1, veins: 0.4 },
    light: { preset: 'afternoon', elev: 30, az: 290, sun: [1, 0.82, 0.62], ambient: [0.36, 0.32, 0.3], fog: [0.66, 0.56, 0.45], fogStart: 550, fogEnd: 2100, fogMax: 0.55 },
    scroll: 0.9, wind: [1.1, 0.3],
    weather: 'dust', ambient: ['dust'],
    transition: 'rockfall', music: 'ground_p2',
  },
  {
    id: 'iv_magma_breach', name: 'Haul Road Junction', boss: 'iron_vein', phase: 3,
    env: 'openpit',
    params: { trucks: 1, machines: 0.9, conveyors: 0.7, fires: 0.65, craters: 0.85, spoil: 0.3, veins: 0.5 },
    light: { preset: 'smoke', elev: 30, sun: [1, 0.66, 0.4], ambient: [0.3, 0.27, 0.27], fog: [0.44, 0.34, 0.28] },
    scroll: 0.9, wind: [0.9, 0.4],
    weather: 'dust', ambient: ['dust', 'ash'],
    transition: 'rockfall', music: 'ground_p3',
  },
  {
    id: 'iv_supply_tunnel', name: 'Fractured Benches', boss: 'iron_vein', phase: 4,
    env: 'openpit',
    params: { trucks: 0.6, machines: 0.6, conveyors: 0.6, fires: 0.55, craters: 1, spoil: 0.4, cracks: 1, veins: 0.8 },
    light: { preset: 'dusk', elev: 22, az: 285, ambient: [0.3, 0.26, 0.28], fog: [0.48, 0.34, 0.27] },
    scroll: 0.95, wind: [0.6, 0.5],
    weather: 'dust', ambient: ['dust'],
    transition: 'rockfall', music: 'ground_p4',
  },
  {
    id: 'iv_geothermal_plant', name: 'Deep-Core Pit', boss: 'iron_vein', phase: 5,
    env: 'openpit',
    params: { benches: 1.25, trucks: 0.5, machines: 0.7, conveyors: 0.5, fires: 0.85, craters: 0.9, spoil: 0.3, cracks: 0.7, veins: 1, core: 1, dusk: true },
    light: { preset: 'smoke', elev: 22, sun: [1, 0.5, 0.26], sunI: 0.9, ambient: [0.24, 0.17, 0.16], fog: [0.3, 0.14, 0.09], fogStart: 450, fogEnd: 1700, fogMax: 0.7 },
    scroll: 1.0, wind: [0.3, 1.0],
    weather: 'embers', ambient: ['heat'],
    transition: 'lava_flood', music: 'ground_p5',
    desperation: { name: 'Core Meltdown', params: { core: 1, fires: 1 }, light: { sun: [1, 0.35, 0.15], fog: [0.36, 0.1, 0.05] } },
  },
];
