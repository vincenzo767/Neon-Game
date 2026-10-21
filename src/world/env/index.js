import highway from './highway.js';
import tunnel from './tunnel.js';
import scrapyard from './scrapyard.js';
import foundry from './foundry.js';
import battlefield from './battlefield.js';
import sky from './sky.js';
import ocean from './ocean.js';
import reactor from './reactor.js';
import orbit from './orbit.js';
import seabed from './seabed.js';
import city from './city.js';
import harbor from './harbor.js';
import arctic from './arctic.js';
import datacenter from './datacenter.js';
import planet from './planet.js';
import space from './space.js';
import ruins from './ruins.js';
import flesh from './flesh.js';
import terrain from './terrain.js';
import coast from './coast.js';
import frontline from './frontline.js';

// Environment module registry (reusable environment kits). Arena configs
// reference these by id (`env`). Each module:
//   id, label, defaults (params)
//   setup(cfg) → { layers: [...], atmosphere?, ... shared state }
//     layer: { id, z, x0, x1, length, ppu, cut?, blend?, glow?, grid?, height?,
//              layout(c) → data, paint(p, lay, [prev, next], c), mesh(mb, lay, c) }
// See docs/ARENA_REWORK.md.

export const ENVS = Object.fromEntries([highway, tunnel, scrapyard, foundry, battlefield, sky, ocean, reactor, orbit, seabed, city, harbor, arctic, datacenter, planet, space, ruins, flesh, terrain, coast, frontline].map((e) => [e.id, e]));

export const envIds = () => Object.keys(ENVS);
