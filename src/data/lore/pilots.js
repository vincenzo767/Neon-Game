// Pilot lore (UPDATE_02 §3). Adds world context to the pilot data files in
// src/pilots/ without replacing their `bio`; keyed by pilot id. Pilots that
// arrive in M5 are filed here already so their data only adds mechanics.
//
//   file:   precinct personnel-file line (shown under the bio on pilot select)
//   origin: where in New Meridian they come from
//   rival:  the Undercrown faction they are sworn against (faction id)

export const PILOT_LORE = {
  kairo: { origin: 'The Grid', rival: 'stratos', file: 'Ran sky-lane courier jobs for the Stratos Cartel before turning state witness. Madame Hale has a price on his head.' },
  mira: { origin: 'The Crown', rival: 'helix', file: 'Former Helix drone engineer. She walked out of Project HALCYON the night it failed and never said what she saw.' },
  bruno: { origin: 'The Furnace', rival: 'ironclad', file: 'Served under Gideon Raske before the Brotherhood turned to salvage piracy. He knows every war-rig by the sound of its engine.' },
  tess: { origin: 'The Docks', rival: 'blacktide', file: "Grew up on Black Tide smuggling skiffs. Admiral Quell's flagship is the one thing in the harbor she has never boarded." },
  oduya: { origin: 'The Furnace', rival: 'ironclad', file: 'Immortal. When the Brotherhood stormed the foundries, he came down with the storm and held the Furnace gates for three days. The Precinct still cannot say where he came from.' },
  lin: { origin: 'The Crown', rival: 'outerstar', file: 'Bio-tech botanist. His emerald crystal is the only thing the Choir\'s crystal growths cannot overgrow.' },
  dax: { origin: 'The Grid', rival: 'ironclad', file: 'Street racer with more speeding tickets than flight hours. The Precinct recruited him instead of jailing him.' },
  sera: { origin: 'The Spindle', rival: 'outerstar', file: 'Cryo-systems officer from the ring station. She was in orbit when the Upper Breach opened.' },
  nova7: { origin: 'The Crown', rival: 'helix', file: 'A Helix security android that refused a kill order. Its own source code is classified evidence.' },
  rufus: { origin: 'The Docks', rival: 'blacktide', file: 'Scrapyard preacher who builds his ship from whatever the Black Tide sinks.' },
  aiko: { origin: 'The Crown', rival: 'stratos', file: 'Storm-chaser rotor pilot. She flies the Storm Ring weather that grounds the Cartel.' },
  pike: { origin: 'The Spindle', rival: 'helix', file: 'Thirty years of service and the last officer who still salutes. Commands the Precinct air wing.' },
  zuri: { origin: 'The Grid', rival: 'outerstar', file: 'Solar-skiff smuggler turned informant. She charts where the Choir lands its crystal pods.' },
  cass: { origin: 'The Grid', rival: 'drowned', file: 'Underground DJ whose sonic rigs drive the Covenant\'s whispers out of the Undercity vents.' },
  holt: { origin: 'The Docks', rival: 'blacktide', file: 'Twin salvage divers who mapped the drowned streets before the Covenant sealed them.' },
  warden: { origin: 'Unknown', rival: 'drowned', file: 'The masked Commissioner. Authorises every Precinct operation; no officer has seen the face behind the visor.' },
  vincenzo: { origin: 'The Upper Breach', rival: 'drowned', file: 'No record exists. The Undercrown calls him the Herald. The deep remembers what he is.' },
};

export const pilotLore = (id) => PILOT_LORE[id] || null;
