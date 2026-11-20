// Progress state: what is earned, the spoiler preference, filtering, and the export/import file format.
export const STORAGE_KEY = '{{SECRET_8p7gd6hc}}';
export const EXPORT_APP = 'leonida-ledger';
export const EXPORT_VERSION = 1;

export const EMPTY_STATE = Object.freeze({ earned: new Set(), spoiler: false });

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ earned: [...state.earned], spoiler: state.spoiler }));
  } catch {
    // A browser with storage disabled still tracks the session; only persistence is lost.
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
  for (const t of trophies) {
    const bucket = byGrade[t.grade];
    if (!bucket) continue;
    bucket[1] += 1;
    if (earned.has(t.id)) bucket[0] += 1;
  }
  return { total, done, percent: total ? Math.round((done / total) * 100) : 0, byGrade };
}

export function isHiddenBySpoiler(trophy, state) {
  return state.spoiler && trophy.kind === 'story' && !state.earned.has(trophy.id);
}

export function matchesFilters(trophy, filters, state) {
  if (filters.kind !== 'all' && trophy.kind !== filters.kind) return false;
  if (filters.grade !== 'all' && trophy.grade !== filters.grade) return false;
  if (filters.missableOnly && !trophy.missable) return false;
  if (filters.query) {
    const haystack = `${trophy.name} ${trophy.description} ${trophy.guide} ${trophy.kind}`.toLowerCase();
    if (!haystack.includes(filters.query.toLowerCase())) return false;
  }
  if (filters.hideEarned && state.earned.has(trophy.id)) return false;
  return true;
}

export function exportProgress(trophies, earned) {
  const payload = {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    game: 'Grand Theft Auto VI',
    exportedAt: new Date().toISOString(),
    earned: trophies.filter((t) => earned.has(t.id)).map((t) => t.id),
    trophies: trophies.filter((t) => earned.has(t.id)).map((t) => t.name),
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

export async function readProgressFile(file, trophies) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const raw = Array.isArray(parsed) ? parsed : Array.isArray(parsed.earned) ? parsed.earned : null;
  if (!raw) throw new Error('No "earned" list in this file.');
  const byId = new Map(trophies.map((t) => [t.id, t.id]));
  const byName = new Map(trophies.map((t) => [normalizeName(t.name), t.id]));
  const ids = new Set();
  for (const item of raw) {
    if (typeof item === 'number' && byId.has(item)) ids.add(item);
    else if (typeof item === 'string' && byName.has(normalizeName(item))) ids.add(byName.get(normalizeName(item)));
  }
  if (ids.size === 0 && raw.length > 0) throw new Error('No trophy in this file matches the official list.');
  return ids;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}
