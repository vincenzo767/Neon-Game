// World lore for New Meridian (UPDATE_02 §1). Pure data: the stage scene
// reads the loop story lines; everything else is reference text for intro
// cards, attract mode and the M7 UI.

export const CITY = {
  name: 'New Meridian',
  year: 2189,
  summary: 'A vertical megacity built on a reclaimed ocean shelf, stacked in layers from orbit to the drowned streets below sea level.',
  layers: [
    { id: 'spindle', name: 'THE SPINDLE', text: "An orbital elevator rising from the city's center to a ring station in orbit." },
    { id: 'crown', name: 'THE CROWN', text: 'Corporate skyscrapers above the cloud line, connected by sky-bridges.' },
    { id: 'grid', name: 'THE GRID', text: 'Elevated highways, mag-rail lines and neon commercial districts.' },
    { id: 'docks', name: 'THE DOCKS', text: "Acid-polluted harbor and floating shipyards on the city's edge." },
    { id: 'furnace', name: 'THE FURNACE', text: 'Underground foundries and reactor halls beneath the city.' },
    { id: 'undercity', name: 'THE UNDERCITY', text: 'Old flooded districts sunk below sea level, sealed off and forgotten.' },
  ],
};

export const BREACH = {
  project: 'PROJECT HALCYON',
  culprit: 'helix',
  summary: 'Helix Dynamics tried to pull energy from other dimensions. The experiment failed and tore two wounds in reality.',
  upper: { name: 'THE UPPER BREACH', where: 'In orbit above the Spindle', from: 'an alien hive intelligence' },
  lower: { name: 'THE LOWER BREACH', where: 'In the deep trench beneath the Undercity', from: 'ancient abyssal entities' },
  coverUp: 'Helix covered it up. In the chaos the syndicates united under a secret council: THE UNDERCROWN.',
};

export const PRECINCT = {
  name: 'OVERDRIVE PRECINCT',
  summary: "The city's last honest police division: sixteen pilots in experimental pursuit vehicles, recruited because they are the only ones willing to go where the Undercrown rules.",
  dispatchCallsign: 'DISPATCH',
};

export const VINCENZO = {
  name: 'VINCENZO THE CONQUEROR',
  aliases: ['THE CONQUEROR', 'THE HERALD'],
  text: 'No police record exists for him. Witnesses say he stepped out of the Upper Breach in the first hour, walked through the alien vanguard untouched, and offered his service to the Precinct without a word about where he came from.',
  herald: 'The syndicates call him the Herald: his true form, the four-winged divine owl, appears in the oldest abyssal carvings in the Undercity as the one being the deep entities fear.',
};

/**
 * Loop story lines (UPDATE_02 §1.5). Each loop is a new night of the war and
 * the Breach widens. LOOP_LINES[0] belongs to loop 2; after the last entry
 * the lines cycle (the loop card always shows the real loop number).
 */
export const LOOP_LINES = [
  'The Breach widens. The Undercrown grows bold.',
  'Helix shredders burn the evidence. The fires spread to the Grid.',
  'Black Tide flags fly over every pier in the Docks.',
  'The sky over New Meridian no longer shows stars.',
  'The Choir sings from the Spindle. Half the city sings back.',
  'The Furnace breathes ash. The Brotherhood forges new war-rigs.',
  'Dispatch goes silent for an hour. When it returns, the voice is not ours.',
  'The tide comes in and does not go out.',
  'The deep is waking.',
  'Something in the Undercity calls the Conqueror by another name.',
  'Both Breaches pulse in time, like a heartbeat.',
  'The Undercrown no longer hides. Neither do we.',
];

/** Opening line for the first night (loop 1). */
export const FIRST_NIGHT = 'Night one. The Undercrown owns the city. Overdrive Precinct takes it back.';

/** Story line for a loop number (1-based). */
export function loopLine(loop) {
  if (loop <= 1) return FIRST_NIGHT;
  return LOOP_LINES[(loop - 2) % LOOP_LINES.length];
}
