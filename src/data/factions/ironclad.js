// The Ironclad Brotherhood — ground tank faction (UPDATE_02 §2.1).
export default {
  id: 'ironclad',
  name: 'The Ironclad Brotherhood',
  short: 'IRONCLAD',
  archetype: 'ground',
  leader: 'Warlord Gideon Raske',
  who: 'Ex-military salvage gangs who rule the highways and foundries with armored war-rigs.',
  palette: { primary: '#8b2a1a', secondary: '#5a3a24', accent: '#ffcc00', glow: '#ff7a1a' },
  // Greeble generator palette (fx/greeble.js): plates, seams, rivets, hazard, lights.
  greeble: {
    plate: ['#1a0d08', '#6a3422', '#b77a52'], seam: 'rgba(12,5,2,0.85)', hi: 'rgba(255,214,170,0.35)',
    rivet: '#c49a74', hazard: ['#ffc21a', '#1c130a'], pipe: ['#140c08', '#6a4a34', '#d0a070'],
    cable: ['#120c08', '#ffb020'], light: '#ffb030', core: '#ff7a1a', vent: '#ff6a10',
  },
  biomes: ['skyway', 'foundry'],
  territory: 'The Grid and the Furnace',
  bosses: ['colossus_crawler', 'rail_leviathan'], // existing id + planned
  // M3 enemies wearing Ironclad colours get these names (behaviour unchanged).
  enemyVariants: { truck: 'RAM TRUCK', car: 'FLAME BUGGY', tank: 'MORTAR CRAWLER', flak: 'SCRAP FLAK NEST', turret: 'WRECKER TURRET', bike: 'TORCH BIKE' },
  bulletStyle: 'heavy_slug',
  animationTraits: ['tread_roll', 'exhaust_puff', 'armor_shed', 'turret_track'],
  hitFx: 'sparks',
  emblem: 'cog',
  warning: 'IRONCLAD WAR-RIG APPROACHING',
  introLine: 'DISPATCH: Ironclad war-rigs are blocking the Skyway.',
  dispatch: [
    'DISPATCH: Ironclad war-rigs are blocking {territory}. Raske wants a toll in blood.',
    'DISPATCH: Brotherhood salvage crews are stripping {territory}. Expect heavy armor.',
    'DISPATCH: Smokestacks sighted over {territory}. The Warlord rides tonight.',
  ],
};
