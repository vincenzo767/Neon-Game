// Per-boss visual data for the M4d retrofit (UPDATE_02 §4.4 / §5), keyed by
// boss id. Visual only: nothing here is read by boss logic.
//
//   faction  owning syndicate (palette, hit effect, death leftovers)
//   weak     glowing weak point {x, y, r, rgb}; brightens as the phase HP drops
//   shadow   drop shadow on the ground layer {dx, dy, a} (airborne bosses)
//   sites    hull points that dent / crack / smoke at 66% and 33% phase HP
//   organic  wounds and ichor instead of dents, smoke and exposed machinery
//   ichor    wound / drip colour for organic bosses
//   anim     idle animation set in bosses/look.js (treads, fans, wake, ...)
//
// Offsets are sprite-local (boss centre, facing down) like part offsets.

export const LOOKS = {
  skywarden_carrier: {
    faction: 'stratos', anim: 'carrier',
    weak: { x: 0, y: -30, r: 22, rgb: [0.25, 0.9, 1] },
    shadow: { dx: 30, dy: 46, a: 0.36 },
    sites: [[-128, -36], [98, -44], [-62, -52], [58, 6], [-24, 30], [142, -44]],
  },
  leviathan_dreadnought: {
    faction: 'blacktide', anim: 'leviathan',
    weak: { x: 0, y: 34, r: 18, rgb: [0.2, 1, 0.82] },
    sites: [[-36, -94], [34, -82], [-36, 92], [38, 22], [-98, 30], [100, -30]],
  },
  titan_enforcer: {
    faction: 'helix', anim: 'titan',
    weak: { x: 0, y: -16, r: 22, rgb: [1, 0.18, 0.62] },
    shadow: { dx: 24, dy: 38, a: 0.32 },
    sites: [[-98, -62], [100, -60], [-24, -42], [26, 4], [-64, -2], [120, -36]],
  },
  hive_sovereign: {
    faction: 'outerstar', anim: 'hive', organic: true, ichor: [0.4, 1, 0.6],
    weak: { x: 0, y: 2, r: 26, rgb: [0.45, 1, 0.4] },
    shadow: { dx: 22, dy: 36, a: 0.28 },
    sites: [[-40, -40], [44, -30], [-64, 6], [28, 42], [-20, 52], [68, -8]],
  },
  maw_of_the_deep: {
    faction: 'drowned', anim: 'maw', organic: true, ichor: [1, 0.12, 0.2],
    weak: { x: 0, y: 0, r: 30, rgb: [1, 0.1, 0.16] },
    sites: [[-40, 42], [44, -58], [-58, -8], [30, 58], [-110, 60], [118, -70]],
  },
};
