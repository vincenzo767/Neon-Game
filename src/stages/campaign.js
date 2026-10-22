// Campaign structure (level rework).
//
// The run is a fixed campaign of six archetypes, played in order. Each
// archetype is five LEVELS; each level belongs to one boss and has
//   - its own arena (one authored world, shown from the first wave to the
//     boss's death — boss phases never change the arena),
//   - its own mini-boss,
//   - 5 waves → mini-boss → 5 waves → boss.
// Bosses 1–4 of an archetype lead up to its MAIN BOSS (level 5, the hardest).
// After the sixth archetype the campaign loops at a higher Mk. (Mk. II, III).
//
// `terrain` decides what can move on the level (real-world logic):
//   land   ground vehicles + aircraft      sea    surface ships + aircraft
//   sky    aircraft only (high altitude)   space  spacecraft only
//   deep   underwater craft only (no wheels, no wings)

export const CAMPAIGN_ORDER = ['ground', 'sea', 'aerial', 'mecha', 'extraterrestrial', 'abyssal'];
export const LEVELS_PER_ARCHETYPE = 5;
export const ARCHETYPE_NAME = { ground: 'GROUND', sea: 'NAVAL', aerial: 'AERIAL', mecha: 'MECHA', extraterrestrial: 'EXTRATERRESTRIAL', abyssal: 'ABYSSAL' };
export const CAMPAIGN_LENGTH = CAMPAIGN_ORDER.length * LEVELS_PER_ARCHETYPE; // 30

/** Levels per archetype, in play order. The last entry is the archetype's main boss. */
export const LEVELS = {
  ground: [
    { boss: 'white_fang', arena: 'wf_frozen_frontline', mini: 'mb_snowcat', terrain: 'land' },
    { boss: 'sandbreaker', arena: 'sb_dune_convoy', mini: 'mb_dune_raider', terrain: 'land' },
    { boss: 'iron_vein', arena: 'iv_open_pit', mini: 'mb_rock_crusher', terrain: 'land' },
    { boss: 'urban_devastator', arena: 'ud_downtown_siege', mini: 'mb_pursuit_interceptor', terrain: 'land' },
    { boss: 'colossus_crawler', arena: 'cc_burning_overpass', mini: 'mb_armoured_train', terrain: 'land' },
  ],
  sea: [
    { boss: 'coral_siege', arena: 'cs_lagoon_anchorage', mini: 'mb_patrol_cutter', terrain: 'sea' },
    { boss: 'whiteout_breaker', arena: 'wb_pack_ice', mini: 'mb_ice_corvette', terrain: 'sea' },
    { boss: 'abyssal_hunter', arena: 'ah_trench_storm', mini: 'mb_sub_tender', terrain: 'sea' },
    { boss: 'black_tide_rig', arena: 'bt_oil_field', mini: 'mb_fire_tug', terrain: 'sea' },
    { boss: 'leviathan_dreadnought', arena: 'ld_storm_surge', mini: 'mb_destroyer', terrain: 'sea' },
  ],
  aerial: [
    { boss: 'frostline_interceptor', arena: 'fl_fjord_run', mini: 'mb_recon_jet', terrain: 'sky' },
    { boss: 'scorchwind_bomber', arena: 'sc_canyon_run', mini: 'mb_attack_heli', terrain: 'sky' },
    { boss: 'tempest_crown', arena: 'tc_supercell', mini: 'mb_weather_drone', terrain: 'sky' },
    { boss: 'ironwing_fortress', arena: 'iw_airbase_assault', mini: 'mb_gunship', terrain: 'land' },
    { boss: 'skywarden_carrier', arena: 'sw_dawn_patrol', mini: 'mb_tanker_escort', terrain: 'sky' },
  ],
  mecha: [
    { boss: 'sandstorm_juggernaut', arena: 'sj_test_range', mini: 'mb_scout_walker', terrain: 'land' },
    { boss: 'frostframe_colossus', arena: 'ff_weapons_facility', mini: 'mb_cryo_walker', terrain: 'land' },
    { boss: 'helios_executioner', arena: 'he_ruined_district', mini: 'mb_lancer_frame', terrain: 'land' },
    { boss: 'omega_foundry', arena: 'of_reactor_complex', mini: 'mb_assembly_drone', terrain: 'land' },
    { boss: 'titan_enforcer', arena: 'te_corporate_plaza', mini: 'mb_riot_frame', terrain: 'land' },
  ],
  extraterrestrial: [
    { boss: 'shatterbelt_devourer', arena: 'sd_shatterbelt', mini: 'mb_rock_eater', terrain: 'space' },
    { boss: 'crimson_expanse', arena: 'ce_nebula_frontier', mini: 'mb_ember_lancer', terrain: 'space' },
    { boss: 'null_citadel', arena: 'nc_approach', mini: 'mb_null_sentry', terrain: 'space' },
    { boss: 'singularity_regent', arena: 'sr_event_horizon', mini: 'mb_lens_warden', terrain: 'space' },
    { boss: 'hive_sovereign', arena: 'hs_invasion_day', mini: 'mb_brood_carrier', terrain: 'land' },
  ],
  abyssal: [
    { boss: 'hadal_warden', arena: 'hw_hadal_trench', mini: 'mb_trench_angler', terrain: 'deep' },
    { boss: 'drowned_monarch', arena: 'dm_drowned_capital', mini: 'mb_drowned_knight', terrain: 'deep' },
    { boss: 'black_furnace', arena: 'bf_vent_field', mini: 'mb_vent_crab', terrain: 'deep' },
    { boss: 'nameless_leviathan', arena: 'nl_abyssal_plain', mini: 'mb_bone_eel', terrain: 'deep' },
    { boss: 'maw_of_the_deep', arena: 'md_drowned_city', mini: 'mb_lamprey_swarm', terrain: 'deep' },
  ],
};

/**
 * Level for global stage `index` (0-based).
 * @returns {{ index, cycle, archetype, archetypeIndex, pos, number, mk, rank, boss, arena, mini, terrain, main }}
 *   pos     0..4 within the archetype (4 = main boss)
 *   rank    0..1 progress through the 30-level campaign (difficulty ramp)
 *   mk      campaign loop: Mk. I on the first pass, II, then III
 */
export function levelFor(index) {
  const cycle = Math.floor(index / CAMPAIGN_LENGTH);
  const k = index % CAMPAIGN_LENGTH;
  const archetypeIndex = Math.floor(k / LEVELS_PER_ARCHETYPE);
  const pos = k % LEVELS_PER_ARCHETYPE;
  const archetype = CAMPAIGN_ORDER[archetypeIndex];
  const L = LEVELS[archetype][pos];
  return {
    index, cycle, archetype, archetypeIndex, pos, number: index + 1,
    mk: Math.min(3, cycle + 1), rank: k / (CAMPAIGN_LENGTH - 1),
    main: pos === LEVELS_PER_ARCHETYPE - 1,
    // 'A-L': archetype number - level number (e.g. 2-5 = the naval main boss).
    label: `${cycle ? `L${cycle + 1} ` : ''}${archetypeIndex + 1}-${pos + 1}`,
    title: `${ARCHETYPE_NAME[archetype]} · LEVEL ${pos + 1}/${LEVELS_PER_ARCHETYPE}${pos === LEVELS_PER_ARCHETYPE - 1 ? ' · MAIN BOSS' : ''}`,
    ...L,
  };
}

/** The level a boss owns (practice uses its arena and mini-boss). */
export function levelOfBoss(id) {
  for (const a of CAMPAIGN_ORDER) {
    const pos = LEVELS[a].findIndex((L) => L.boss === id);
    if (pos >= 0) return levelFor(CAMPAIGN_ORDER.indexOf(a) * LEVELS_PER_ARCHETYPE + pos);
  }
  return null;
}
