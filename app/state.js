// Progress state: what is earned, the spoiler preference, the filter rules, and the export/import file format.
// Everything here is pure data in and data out, so the browser storage and the UI stay easy to reason about.

export const STORAGE_KEY = '{{SECRET_8p7gd6hc}}';
export const EXPORT_APP = 'leonida-ledger';
export const EXPORT_VERSION = 1;

export const EMPTY_FILTERS = Object.freeze({
  kind: 'all',
  grade: 'all',
  missableOnly: false,
  query: '',
  hideEarned: false,
});

export const EMPTY_STATE = Object.freeze({ earned: new Set(), spoiler: false });

// Reads the saved tracker. A damaged or missing record is treated as a fresh start rather than an error:
// a guide that refuses to open because of one bad localStorage value would be worse than one that forgets a tick.
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const saved = JSON.parse(raw);
    const earned = new Set(Array.isArray(saved.earned) ? saved.earned.filter(Number.isInteger) : []);
    return { earned, spoiler: Boolean(saved.spoiler) };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ earned: [...state.earned].sort((a, b) => a - b), spoiler: state.spoiler }),
    );
  } catch {
    // A browser with storage blocked still tracks this session; only persistence is lost.
  }
}

export function withEarned(state, id, earned) {
  const next = new Set(state.earned);
  if (earned) next.add(id);
  else next.delete(id);
  return { ...state, earned: next };
}

export function withEarnedAll(state, ids) {
  return { ...state, earned: new Set(ids) };
}

export function withSpoiler(state, spoiler) {
  return { ...state, spoiler: Boolean(spoiler) };
}

export function progressSummary(trophies, earned) {
  const total = trophies.length;
  const done = trophies.filter((t) => earned.has(t.id)).length;
  const byGrade = { platinum: [0, 0], gold: [0, 0], silver: [0, 0], bronze: [0, 0] };
  for (const trophy of trophies) {
    const bucket = byGrade[trophy.grade];
    if (!bucket) continue;
    bucket[1] += 1;
    if (earned.has(trophy.id)) bucket[0] += 1;
  }
  return { total, done, remaining: total - done, percent: total ? Math.round((done / total) * 100) : 0, byGrade };
}

// The spoiler shield hides only story trophies that are still unearned. Earned story trophies and every
// other kind stay readable, so the shield protects the plot without getting in the way of cleanup.
export function isHiddenBySpoiler(trophy, state) {
  return state.spoiler && trophy.kind === 'story' && !state.earned.has(trophy.id);
}

export function matchesFilters(trophy, filters, state) {
  if (filters.kind !== 'all' && trophy.kind !== filters.kind) return false;
  if (filters.grade !== 'all' && trophy.grade !== filters.grade) return false;
  if (filters.missableOnly && !trophy.missable) return false;
  if (filters.hideEarned && state.earned.has(trophy.id)) return false;
  if (filters.query) {
    const haystack = `${trophy.name} ${trophy.description} ${trophy.guide} ${trophy.kind}`.toLowerCase();
    if (!haystack.includes(filters.query.toLowerCase())) return false;
  }
  return true;
}

export function exportProgress(trophies, earned) {
  const owned = trophies.filter((t) => earned.has(t.id));
  const payload = {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    game: 'Grand Theft Auto VI',
    exportedAt: new Date().toISOString(),
    earned: owned.map((t) => t.id),
    trophies: owned.map((t) => t.name),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leonida-ledger-progress.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return payload.earned.length;
}

// Reads a progress file written by exportProgress. It also accepts a plain array of ids or names and the
// legacy shape whose names live under "trophies", so an older export is never stranded.
export async function readProgressFile(file, trophies) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('this file is not JSON');
  }
  const raw = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.earned)
      ? parsed.earned
      : Array.isArray(parsed?.trophies)
        ? parsed.trophies
        : null;
  if (raw === null) throw new Error('no "earned" list in this file');

  const byId = new Set(trophies.map((t) => t.id));
  const byName = new Map(trophies.map((t) => [normalizeName(t.name), t.id]));
  const ids = new Set();
  let skipped = 0;
  for (const item of raw) {
    if (typeof item === 'number' && byId.has(item)) ids.add(item);
    else if (typeof item === 'string' && byName.has(normalizeName(item))) ids.add(byName.get(normalizeName(item)));
    else skipped += 1;
  }
  if (raw.length > 0 && ids.size === 0) throw new Error('no entry in this file matches the official list');
  return { ids, skipped };
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
