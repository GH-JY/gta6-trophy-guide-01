// Entry point: load the trophy list and roadmap, wire the toolbar and tabs, and keep every screen in sync with
// the saved progress. A query string can pre-set a screen, filter, trophy, spoiler state and earned set, which is
// how the screenshots are taken; the tracker itself always uses localStorage.
import {
  loadState,
  saveState,
  withEarned,
  withEarnedAll,
  withSpoiler,
  progressSummary,
  matchesFilters,
  exportProgress,
  readProgressFile,
} from './state.js';
import {
  el,
  renderProgressChip,
  renderList,
  renderDetail,
  renderRoadmap,
  renderMissables,
  renderMethod,
} from './render.js';

const KIND_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'story', label: 'Story' },
  { id: 'side', label: 'Side' },
  { id: 'collectible', label: 'Collectibles' },
  { id: 'activity', label: 'Activities' },
  { id: 'challenge', label: 'Challenges' },
  { id: 'freeplay', label: 'Free play' },
];

const app = {
  trophies: [],
  roadmap: null,
  progress: loadState(),
  filters: { kind: 'all', grade: 'all', missableOnly: false, query: '', hideEarned: false },
  view: 'checklist',
  selectedId: null,
};

const refs = {
  progressChip: document.getElementById('progress-chip'),
  search: document.getElementById('search'),
  grade: document.getElementById('grade-filter'),
  spoiler: document.getElementById('spoiler-toggle'),
  kindChips: document.getElementById('kind-chips'),
  missableToggle: document.getElementById('missable-toggle'),
  missableCount: document.getElementById('missable-count'),
  clear: document.getElementById('clear-filters'),
  exportBtn: document.getElementById('export-btn'),
  importInput: document.getElementById('import-input'),
  list: document.getElementById('trophy-list'),
  listTitle: document.getElementById('list-title'),
  listSub: document.getElementById('list-sub'),
  listCount: document.getElementById('list-count'),
  detail: document.getElementById('detail'),
  views: {
    checklist: document.getElementById('view-checklist'),
    roadmap: document.getElementById('view-roadmap'),
    missables: document.getElementById('view-missables'),
    method: document.getElementById('view-method'),
  },
  tabs: [...document.querySelectorAll('.tab')],
  toast: document.getElementById('toast'),
};

boot();

async function boot() {
  try {
    const [doc, roadmap] = await Promise.all([getJson('data/trophies.json'), getJson('data/roadmap.json')]);
    app.trophies = doc.trophies;
    app.roadmap = roadmap;
    applyQuery();
    wire();
    if (app.selectedId === null) app.selectedId = visibleTrophies()[0]?.id ?? app.trophies[0]?.id ?? null;
    setView(app.view, { keepScroll: true });
    renderAll();
    applyScrollHints();
    revealSelection();
  } catch (error) {
    refs.list.replaceChildren(el('li', { class: 'empty', text: `The guide data could not be loaded: ${error.message}` }));
  }
}

function revealSelection() {
  if (app.selectedId === null) return;
  requestAnimationFrame(() => {
    const row = refs.list.querySelector(`[data-id="${app.selectedId}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  });
}

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}

function applyQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('earned')) {
    const ids = params.get('earned').split(',').map((n) => Number(n.trim())).filter(Number.isInteger);
    app.progress = withEarnedAll(app.progress, ids);
    saveState(app.progress);
  }
  if (params.get('spoiler') === '1') app.progress = withSpoiler(app.progress, true);
  if (params.get('spoiler') === '0') app.progress = withSpoiler(app.progress, false);
  const kind = params.get('kind') ?? params.get('filter');
  if (kind && KIND_FILTERS.some((k) => k.id === kind)) app.filters.kind = kind;
  if (kind === 'missable') {
    app.filters.kind = 'all';
    app.filters.missableOnly = true;
  }
  if (params.get('missable') === '1') app.filters.missableOnly = true;
  const grade = params.get('grade');
  if (grade && ['platinum', 'gold', 'silver', 'bronze'].includes(grade)) app.filters.grade = grade;
  app.filters.query = params.get('q') ?? '';
  const trophy = Number(params.get('trophy'));
  if (Number.isInteger(trophy) && app.trophies.some((t) => t.id === trophy)) app.selectedId = trophy;
  const view = params.get('view');
  if (view && Object.hasOwn(refs.views, view)) app.view = view;
  syncControls();
}

function syncControls() {
  refs.search.value = app.filters.query;
  refs.grade.value = app.filters.grade;
  refs.spoiler.checked = app.progress.spoiler;
  refs.missableToggle.setAttribute('aria-pressed', String(app.filters.missableOnly));
}

function wire() {
  for (const tab of refs.tabs) tab.addEventListener('click', () => setView(tab.dataset.view));
  refs.search.addEventListener('input', () => {
    app.filters.query = refs.search.value.trim();
    keepSelectionVisible();
    renderAll();
  });
  refs.grade.addEventListener('change', () => {
    app.filters.grade = refs.grade.value;
    keepSelectionVisible();
    renderAll();
  });
  refs.spoiler.addEventListener('change', () => {
    app.progress = withSpoiler(app.progress, refs.spoiler.checked);
    saveState(app.progress);
    renderAll();
  });
  refs.missableToggle.addEventListener('click', () => {
    app.filters.missableOnly = !app.filters.missableOnly;
    refs.missableToggle.setAttribute('aria-pressed', String(app.filters.missableOnly));
    keepSelectionVisible();
    renderAll();
  });
  refs.clear.addEventListener('click', () => {
    app.filters = { kind: 'all', grade: 'all', missableOnly: false, query: '', hideEarned: false };
    syncControls();
    keepSelectionVisible();
    renderAll();
  });
  refs.exportBtn.addEventListener('click', () => {
    const count = exportProgress(app.trophies, app.progress.earned);
    showToast(`Exported ${count} earned ${count === 1 ? 'trophy' : 'trophies'} to leonida-ledger-progress.json`);
  });
  refs.importInput.addEventListener('change', async () => {
    const file = refs.importInput.files?.[0];
    if (!file) return;
    try {
      const ids = await readProgressFile(file, app.trophies);
      app.progress = withEarnedAll(app.progress, ids);
      saveState(app.progress);
      renderAll();
      showToast(`Imported ${ids.size} earned ${ids.size === 1 ? 'trophy' : 'trophies'}.`);
    } catch (error) {
      showToast(`Import failed: ${error.message}`);
    } finally {
      refs.importInput.value = '';
    }
  });
}

function setView(view, options = {}) {
  if (!Object.hasOwn(refs.views, view)) return;
  app.view = view;
  document.body.dataset.view = view;
  for (const [name, section] of Object.entries(refs.views)) {
    if (name === 'method') continue;
    section.hidden = name !== view;
  }
  refs.views.method.hidden = view !== 'method';
  for (const tab of refs.tabs) {
    const active = tab.dataset.view === view;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-current', active ? 'page' : 'false');
  }
  if (view === 'roadmap') renderRoadmap(refs.views.roadmap, roadmapContext());
  if (view === 'missables') renderMissables(refs.views.missables, missablesContext());
  if (view === 'method') renderMethod(refs.views.method);
  if (!options.keepScroll && view !== 'checklist') refs.views[view].scrollTop = 0;
}

function visibleTrophies() {
  return app.trophies.filter((t) => matchesFilters(t, app.filters, app.progress));
}

function keepSelectionVisible() {
  const visible = visibleTrophies();
  if (!visible.some((t) => t.id === app.selectedId)) app.selectedId = visible[0]?.id ?? null;
}

function renderAll() {
  const summary = progressSummary(app.trophies, app.progress.earned);
  renderProgressChip(refs.progressChip, app.trophies, app.progress);
  renderChips();
  refs.missableCount.textContent = String(app.trophies.filter((t) => t.missable).length);
  renderList(refs.list, listContext());
  refs.listTitle.textContent = listTitle();
  refs.listSub.textContent = `${summary.done} of ${summary.total} earned · ${summary.percent}% · ${gradeBreakdown(summary)}`;
  refs.listCount.textContent = `${visibleTrophies().length} shown`;
  const selected = app.trophies.find((t) => t.id === app.selectedId) ?? null;
  renderDetail(refs.detail, {
    trophy: selected,
    state: app.progress,
    stages: app.roadmap.stages,
    onToggle: toggleTrophy,
    onSpoilerOff: () => {
      app.progress = withSpoiler(app.progress, false);
      refs.spoiler.checked = false;
      saveState(app.progress);
      renderAll();
    },
    onOpenStage: openStage,
  });
  if (app.view === 'roadmap') renderRoadmap(refs.views.roadmap, roadmapContext());
  if (app.view === 'missables') renderMissables(refs.views.missables, missablesContext());
}

function renderChips() {
  const counts = new Map(KIND_FILTERS.map((k) => [k.id, k.id === 'all' ? app.trophies.length : app.trophies.filter((t) => t.kind === k.id).length]));
  refs.kindChips.replaceChildren(
    ...KIND_FILTERS.map((kind) => {
      const active = app.filters.kind === kind.id;
      return el(
        'button',
        {
          class: `chip${active ? ' is-active' : ''}`,
          type: 'button',
          'aria-pressed': String(active),
          onclick: () => {
            app.filters.kind = kind.id;
            keepSelectionVisible();
            renderAll();
          },
        },
        kind.label,
        el('span', { class: 'chip-n', text: String(counts.get(kind.id)) }),
      );
    }),
  );
}

function listTitle() {
  if (app.filters.query) return `Results for “${app.filters.query}”`;
  if (app.filters.missableOnly) return 'Missable trophies';
  if (app.filters.kind === 'all') return app.filters.grade === 'all' ? 'All 55 trophies' : `${capitalize(app.filters.grade)} trophies`;
  const label = KIND_FILTERS.find((k) => k.id === app.filters.kind)?.label ?? 'Trophies';
  return app.filters.grade === 'all' ? `${label} trophies` : `${capitalize(app.filters.grade)} ${label.toLowerCase()}`;
}

function gradeBreakdown(summary) {
  return ['platinum', 'gold', 'silver', 'bronze']
    .map((g) => `${summary.byGrade[g][0]}/${summary.byGrade[g][1]} ${g}`)
    .join(' · ');
}

function listContext() {
  return {
    trophies: visibleTrophies(),
    state: app.progress,
    selectedId: app.selectedId,
    onSelect: openTrophy,
    onToggle: toggleTrophy,
  };
}

function roadmapContext() {
  return {
    roadmap: app.roadmap,
    stages: app.roadmap.stages,
    trophies: app.trophies,
    state: app.progress,
    onSelect: openTrophy,
  };
}

function missablesContext() {
  return { trophies: app.trophies, state: app.progress, onSelect: openTrophy };
}

function toggleTrophy(id, earned) {
  app.progress = withEarned(app.progress, id, earned);
  saveState(app.progress);
  renderAll();
}

function openTrophy(id) {
  app.selectedId = id;
  if (app.view !== 'checklist') setView('checklist');
  renderAll();
  requestAnimationFrame(() => {
    const row = refs.list.querySelector(`[data-id="${id}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  });
}

function openStage(stageId) {
  setView('roadmap');
  requestAnimationFrame(() => {
    const stage = refs.views.roadmap.querySelector(`[data-stage="${stageId}"]`);
    stage?.scrollIntoView({ block: 'center' });
  });
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add('is-on');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => refs.toast.classList.remove('is-on'), 3200);
}

function applyScrollHints() {
  const params = new URLSearchParams(window.location.search);
  const scroll = Number(params.get('scroll'));
  if (Number.isFinite(scroll) && scroll > 0) {
    const view = refs.views[app.view];
    if (view) view.scrollTop = scroll;
  }
  const listScroll = Number(params.get('listscroll'));
  if (Number.isFinite(listScroll) && listScroll > 0) refs.list.scrollTop = listScroll;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
