// The reference desk. Every guide cites at least two of these by short name, and the app only ever renders
// them as text and links: nothing here is fetched at runtime.
export const SOURCES = {
  ps: {
    name: 'PlayStation official game page',
    short: 'PlayStation',
    url: 'https://www.playstation.com/en-us/games/grand-theft-auto-vi/',
    role: 'Official trophy names, descriptions and grades: the fixed text every entry quotes.',
    official: true,
  },
  ex: {
    name: 'Exophase trophy list',
    short: 'Exophase',
    url: 'https://exophase.com/game/grand-theft-auto-vi-ps5/trophies/',
    role: 'Counts, grades and rarity at a glance; useful for sanity-checking the counted trophies.',
  },
  psnp: {
    name: 'PSNProfiles trophy guides',
    short: 'PSNProfiles',
    url: 'https://psnprofiles.com/',
    role: 'Community roadmaps and cleanup order, especially the pre-finale manual save habit.',
  },
  pp: {
    name: 'PowerPyx trophy guide',
    short: 'PowerPyx',
    url: 'https://www.powerpyx.com/',
    role: 'Mission-by-mission walkthroughs and reliable routes for the skill-based bronzes.',
  },
  ign: {
    name: 'IGN GTA VI wiki',
    short: 'IGN',
    url: 'https://www.ign.com/wikis/gta-6',
    role: 'Map-based collectible and activity locations, area lists and district notes.',
  },
  gr: {
    name: 'Game Rant guides',
    short: 'Game Rant',
    url: 'https://gamerant.com/',
    role: 'Plain-language explainers for the cryptic and one-off trophies.',
  },
  reddit: {
    name: 'r/GTA6 community',
    short: 'r/GTA6',
    url: 'https://www.reddit.com/r/GTA6/',
    role: 'Player-verified trigger details and post-launch corrections to the route.',
  },
  yt: {
    name: 'YouTube route videos',
    short: 'YouTube',
    url: 'https://www.youtube.com/',
    role: 'Timed routes and visual walkthroughs for stunt chains, races and robberies.',
  },
};

// Display order: official first, then the guide desks, then community.
export const SOURCE_ORDER = ['ps', 'ex', 'psnp', 'pp', 'ign', 'gr', 'reddit', 'yt'];

export function resolveSources(ids = []) {
  const seen = new Set();
  const out = [];
  for (const id of [...SOURCE_ORDER, ...ids]) {
    if (!ids.includes(id) || seen.has(id)) continue;
    seen.add(id);
    if (SOURCES[id]) out.push(SOURCES[id]);
  }
  return out;
}
