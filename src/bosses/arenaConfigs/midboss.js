// MID-BOSS arena profiles (optional; arena rework §22). A mid-boss uses one
// only when its enemy definition (entities/enemies: `arena`) or its stage
// section (`arenaId`) names it. These are not part of the 150 main-boss
// phase arenas and are excluded from the rotation / coverage checks.

export default [
  {
    id: 'gk_checkpoint', name: 'Highway Checkpoint', midboss: 'gatekeeper',
    env: 'highway',
    params: { fires: 0.4, damage: 0.45, collapse: 0.2, cityBurn: 0.2, traffic: 0.5, military: 0.9, lamps: 0.6, night: true },
    light: { preset: 'night', sunI: 0.5, ambient: [0.12, 0.12, 0.16] },
    scroll: 0.9, wind: [0.5, 0.2],
    weather: 'light_rain', ambient: [],
    transition: 'flash', music: 'midboss',
  },
];
