// The named sources every guide cites. Links open only when a reader follows one; the app itself never fetches them.
export const SOURCES = {
  ps: {
    name: 'PlayStation official list',
    short: 'PlayStation',
    url: 'https://www.playstation.com/en-us/games/grand-theft-auto-vi/',
    role: 'Official name, description and grade for all 55 trophies.',
  },
  ex: {
    name: 'Exophase trophy list',
    short: 'Exophase',
    url: 'https://exophase.com/',
    role: 'Trophy counts and rarity for the counted trophies.',
  },
  psnp: {
    name: 'PSNProfiles roadmap guide',
    short: 'PSNProfiles',
    url: 'https://psnprofiles.com/',
    role: 'Roadmap order, difficulty framing and missable-window conventions.',
  },
  pp: {
    name: 'PowerPyx trophy guide',
    short: 'PowerPyx',
    url: 'https://www.powerpyx.com/',
    role: 'Mission order and step-by-step routes for the story and activities.',
  },
  ign: {
    name: 'IGN GTA VI wiki',
    short: 'IGN wiki',
    url: 'https://www.ign.com/wikis/gta-6',
    role: 'Map, collectible and activity locations.',
  },
  gr: {
    name: 'Game Rant guides',
    short: 'Game Rant',
    url: 'https://gamerant.com/',
    role: 'Feature tips and the flavour trophies.',
  },
  reddit: {
    name: 'r/GTA6 community threads',
    short: 'r/GTA6',
    url: 'https://www.reddit.com/r/GTA6/',
    role: 'Community verification of trigger conditions.',
  },
  yt: {
    name: 'YouTube walkthroughs',
    short: 'YouTube',
    url: 'https://www.youtube.com/',
    role: 'Video routes for the timed activity challenges.',
  },
};

export const SOURCE_ORDER = ['ps', 'ex', 'psnp', 'pp', 'ign', 'gr', 'reddit', 'yt'];

export function resolveSources(ids) {
  return (ids ?? []).map((id) => SOURCES[id]).filter(Boolean);
}
