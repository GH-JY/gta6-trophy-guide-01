// Entry module. Boots the static app, applies the URL screenshot mode, wires the controls, and keeps the
// four views in sync with progress. No dependencies, no network beyond the two local JSON files.
import {
  EMPTY_FILTERS,
  exportProgress,
  isHiddenBySpoiler,
  loadState,
  matchesFilters,
  progressSummary,
  readProgressFile,
  saveState,
  withEarned,
  withEarnedAll,
  withSpoiler,
} from './state.js';
import {
  KIND_LABELS,
  el,
  renderDetail,
  renderList,
  renderMethod,
  renderMissables,
  renderProgressChip,
  renderRoadmap,
} from './render.js';

const KIND_FILTERS = ['all', ...Object.keys(KIND_LABELS)];
const GRADES = ['all', 'platinum', 'gold', 'silver', 'bronze'];
const VIEWS = ['checklist', 'roadmap', 'missables', 'method'];

const app = {
  trophies: [],
  roadmap: null,
  progress: loadState(),
  filters: { ...EMPTY_FILTERS },
  view: 'checklist',
  selectedId: null,
  scrollHints: { window: null, list: null },
};

const refs = {
  tabs: [...document.querySelectorAll('.tab')],
  views: {
    checklist: byId('view-checklist'),
    roadmap: byId('view-roadmap'),
    missables: byId('view-missables'),
    method: byId('view-method'),
  },
  progressChip: byId('progress-chip'),
  shieldChip: byId('shield-chip'),
  search: byId('search'),
  grade: byId('grade-filter'),
  hideEarned: byId('hide-earned'),
  spoiler: byId('spoiler-toggle'),
  exportBtn: byId('export-btn'),
  importInput: byId('import-input'),
  chips: byId('kind-chips'),
  missableToggle: byId('missable-toggle'),
  missableCount: byId('missable-count'),
  clearFilters: byId('clear-filters'),
  listTitle: byId('list-title'),
  listSub: byId('list-sub'),
  listCount: byId('list-count'),
  listProgress: byId('list-progress-fill'),
  list: byId('trophy-list'),
  detail: byId('detail'),
  toast: byId('toast'),
  live: byId('live'),
};

let toastTimer = 0;
let announceTimer = 0;

boot();

async function boot() {
  try {
    const [trophyDoc, roadmap] = await Promise.all([fetchJson('data/trophies.json'), fetchJson('data/roadmap.json')]);
    validateData(trophyDoc, roadmap);
    app.trophies = trophyDoc.trophies;
    app.roadmap = roadmap;
  } catch (error) {
    fatal(error);
    return;
  }

  applyQuery();
  wire();
  syncControls();
  setView(app.view, { keepScroll: true });
  keepSelectionVisible();
  renderAll();
  settleInitialView();
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

function byId(id) {
  return document.getElementById(id);
}

function validateData(doc, roadmap) {
  if (!doc || !Array.isArray(doc.trophies) || doc.trophies.length === 0) {
    throw new Error('data/trophies.json has no trophy array');
  }
  if (!roadmap || !Array.isArray(roadmap.stages) || roadmap.stages.length === 0) {
    throw new Error('data/roadmap.json has no stage list');
  }
  const stageIds = new Set(roadmap.stages.map((stage) => stage.id));
  const ids = new Set();
  for (const [index, trophy] of doc.trophies.entries()) {
    const where = `trophy ${index + 1}`;
    if (!Number.isInteger(trophy.id) || ids.has(trophy.id)) throw new Error(`${where} has a missing or duplicate id`);
    ids.add(trophy.id);
    if (!trophy.name || !trophy.description || !trophy.guide) throw new Error(`${where} is missing official or guide text`);
    if (!GRADES.includes(trophy.grade) || trophy.grade === 'all') throw new Error(`${where} has an unknown grade`);
    if (!KIND_LABELS[trophy.kind]) throw new Error(`${where} has an unknown kind`);
    if (!Array.isArray(trophy.sources) || trophy.sources.length < 2) throw new Error(`${where} cites fewer than two sources`);
    if (!stageIds.has(trophy.stage)) throw new Error(`${where} points at a stage that does not exist`);
    if (trophy.missable !== null) {
      const m = trophy.missable;
      if (!m || !m.when || !m.why || !m.order) throw new Error(`${where} has an incomplete missable window`);
    }
  }
}

function fatal(error) {
  const message = error instanceof Error ? error.message : String(error);
  document.body.dataset.view = 'checklist';
  refs.views.checklist.hidden = false;
  refs.views.roadmap.hidden = true;
  refs.views.missables.hidden = true;
  refs.views.method.hidden = true;
  refs.views.checklist.replaceChildren(
    el(
      'div',
      { class: 'fatal' },
      el('p', { class: 'eyebrow', text: 'The ledger could not open' }),
      el('h2', { text: 'The trophy data did not load.' }),
      el('p', { text: message }),
      el('p', { class: 'fatal-note', text: 'Serve the folder with app/ at its root and reload. This page needs no network, but it does need its two local JSON files.' }),
    ),
  );
  console.error(error);
}

function applyQuery() {
  const params = new URLSearchParams(location.search);
  const validIds = new Set(app.trophies.map((t) => t.id));

  if (params.has('earned')) {
    const ids = params
      .get('earned')
      .split(',')
      .map((value) => Number.parseInt(value, 10))
      .filter((id) => validIds.has(id));
    app.progress = withEarnedAll(app.progress, ids);
    saveState(app.progress);
  }

  const spoiler = params.get('spoiler');
  if (spoiler === '1' || spoiler === 'true') app.progress = withSpoiler(app.progress, true);
  else if (spoiler === '0' || spoiler === 'false') app.progress = withSpoiler(app.progress, false);

  const kind = params.get('kind') ?? params.get('filter');
  if (kind === 'missable') {
    app.filters.kind = 'all';
    app.filters.missableOnly = true;
  } else if (KIND_FILTERS.includes(kind)) {
    app.filters.kind = kind;
  }

  if (params.get('missable') === '1') app.filters.missableOnly = true;
  if (GRADES.includes(params.get('grade'))) app.filters.grade = params.get('grade');
  if (params.get('q')) app.filters.query = params.get('q');
  if (params.get('hideearned') === '1') app.filters.hideEarned = true;

  const trophyId = Number.parseInt(params.get('trophy') ?? '', 10);
  if (validIds.has(trophyId)) app.selectedId = trophyId;

  const view = params.get('view');
  if (VIEWS.includes(view)) app.view = view;

  app.scrollHints.window = intParam(params.get('scroll'));
  app.scrollHints.list = intParam(params.get('listscroll'));
}

function intParam(value) {
  if (value === null || value === '') return null;
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function settleInitialView() {
  requestAnimationFrame(() => {
    if (app.scrollHints.list !== null) refs.list.scrollTop = app.scrollHints.list;
    else revealSelection();
    if (app.scrollHints.window !== null) window.scrollTo(0, app.scrollHints.window);
  });
}

function syncControls() {
  refs.search.value = app.filters.query;
  refs.grade.value = app.filters.grade;
  refs.hideEarned.checked = app.filters.hideEarned;
  refs.spoiler.checked = app.progress.spoiler;
  refs.missableToggle.classList.toggle('is-on', app.filters.missableOnly);
  refs.missableToggle.setAttribute('aria-pressed', String(app.filters.missableOnly));
}

function wire() {
  for (const tab of refs.tabs) {
    tab.addEventListener('click', () => setView(tab.dataset.view));
  }
  refs.search.addEventListener('input', () => {
    app.filters.query = refs.search.value.trim();
    onFilterChange();
  });
  refs.grade.addEventListener('change', () => {
    app.filters.grade = refs.grade.value;
    onFilterChange();
  });
  refs.hideEarned.addEventListener('change', () => {
    app.filters.hideEarned = refs.hideEarned.checked;
    onFilterChange();
  });
  refs.spoiler.addEventListener('change', () => setSpoiler(refs.spoiler.checked));
  refs.missableToggle.addEventListener('click', () => {
    app.filters.missableOnly = !app.filters.missableOnly;
    syncControls();
    onFilterChange();
  });
  refs.clearFilters.addEventListener('click', clearFilters);
  refs.exportBtn.addEventListener('click', () => {
    const count = exportProgress(app.trophies, app.progress.earned);
    showToast(`Exported ${count} earned ${count === 1 ? 'trophy' : 'trophies'} to leonida-ledger-progress.json.`);
  });
  refs.importInput.addEventListener('change', handleImport);
  document.addEventListener('keydown', onKeydown);
}

function setView(view, options = {}) {
  if (!VIEWS.includes(view)) return;
  app.view = view;
  document.body.dataset.view = view;
  for (const name of VIEWS) refs.views[name].hidden = name !== view;
  for (const tab of refs.tabs) {
    const active = tab.dataset.view === view;
    tab.classList.toggle('is-active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
  if (view === 'roadmap') {
    renderRoadmap(refs.views.roadmap, {
      roadmap: app.roadmap,
      stages: app.roadmap.stages,
      trophies: app.trophies,
      state: app.progress,
      selectedId: app.selectedId,
      onSelect: (id) => openTrophy(id, { ensureVisible: true }),
    });
  } else if (view === 'missables') {
    renderMissables(refs.views.missables, {
      trophies: app.trophies,
      stages: app.roadmap.stages,
      state: app.progress,
      selectedId: app.selectedId,
      onSelect: (id) => openTrophy(id, { ensureVisible: true }),
    });
  } else if (view === 'method') {
    renderMethod(refs.views.method);
  }
  if (!options.keepScroll) window.scrollTo(0, 0);
}

function visibleTrophies() {
  return app.trophies.filter((trophy) => matchesFilters(trophy, app.filters, app.progress));
}

function keepSelectionVisible() {
  const visible = visibleTrophies();
  if (visible.length === 0) {
    app.selectedId = null;
    return;
  }
  if (!visible.some((trophy) => trophy.id === app.selectedId)) app.selectedId = visible[0].id;
}

function onFilterChange() {
  keepSelectionVisible();
  renderAll({ resetList: true });
  revealSelection();
}

function clearFilters() {
  app.filters = { ...EMPTY_FILTERS };
  syncControls();
  onFilterChange();
}

function renderAll(options = {}) {
  const active = document.activeElement instanceof Element ? document.activeElement : null;
  const listFocus =
    active && refs.list.contains(active)
      ? {
          id: active.closest('.trophy-row')?.dataset.id,
          kind: active.classList.contains('tick') ? 'tick' : 'main',
        }
      : null;
  const chipFocus = active?.classList.contains('chip') ? active.dataset.kind : null;
  const detailHadFocus = Boolean(active && refs.detail.contains(active));
  const listScroll = refs.list.scrollTop;
  const detailScroll = refs.detail.scrollTop;

  const summary = progressSummary(app.trophies, app.progress.earned);
  const visible = visibleTrophies();

  renderProgressChip(refs.progressChip, app.trophies, app.progress);
  refs.shieldChip.hidden = !app.progress.spoiler;
  renderChips();
  refs.missableCount.textContent = String(app.trophies.filter((trophy) => trophy.missable).length);
  refs.listTitle.textContent = listTitle();
  refs.listSub.textContent = gradeBreakdown(summary);
  refs.listCount.textContent = `${visible.length} / ${summary.total}`;
  refs.listProgress.style.width = `${summary.percent}%`;

  renderList(refs.list, {
    trophies: visible,
    state: app.progress,
    selectedId: app.selectedId,
    onSelect: (id) => openTrophy(id),
    onToggle: toggleTrophy,
    onClear: clearFilters,
  });

  const selected = app.trophies.find((trophy) => trophy.id === app.selectedId) ?? null;
  renderDetail(refs.detail, {
    trophy: selected,
    state: app.progress,
    stages: app.roadmap.stages,
    onToggle: toggleTrophy,
    onSpoilerOff: () => setSpoiler(false),
    onOpenStage: openStage,
  });

  if (app.view === 'roadmap') {
    renderRoadmap(refs.views.roadmap, {
      roadmap: app.roadmap,
      stages: app.roadmap.stages,
      trophies: app.trophies,
      state: app.progress,
      selectedId: app.selectedId,
      onSelect: (id) => openTrophy(id, { ensureVisible: true }),
    });
  } else if (app.view === 'missables') {
    renderMissables(refs.views.missables, {
      trophies: app.trophies,
      stages: app.roadmap.stages,
      state: app.progress,
      selectedId: app.selectedId,
      onSelect: (id) => openTrophy(id, { ensureVisible: true }),
    });
  }

  refs.list.scrollTop = options.resetList ? 0 : listScroll;
  refs.detail.scrollTop = detailScroll;

  if (listFocus?.id) focusRow(listFocus.id, listFocus.kind);
  else if (chipFocus) refs.chips.querySelector(`[data-kind="${chipFocus}"]`)?.focus({ preventScroll: true });
  else if (detailHadFocus) refs.detail.querySelector('.detail-actions .btn')?.focus({ preventScroll: true });
}

function renderChips() {
  const buttons = KIND_FILTERS.map((kind) => {
    const count = kind === 'all' ? app.trophies.length : app.trophies.filter((trophy) => trophy.kind === kind).length;
    return el(
      'button',
      {
        class: `chip${app.filters.kind === kind ? ' is-active' : ''}`,
        type: 'button',
        dataset: { kind },
        'aria-pressed': String(app.filters.kind === kind),
        onclick: () => {
          app.filters.kind = kind;
          onFilterChange();
        },
      },
      el('span', { text: kind === 'all' ? 'All' : KIND_LABELS[kind] }),
      el('span', { class: 'chip-n', text: String(count) }),
    );
  });
  refs.chips.replaceChildren(...buttons);
}

function listTitle() {
  const f = app.filters;
  if (f.query && f.kind === 'all' && f.grade === 'all' && !f.missableOnly && !f.hideEarned) return `Results for “${f.query}”`;
  if (f.query || f.grade !== 'all' || f.hideEarned) return 'Filtered trophies';
  if (f.missableOnly) return 'Missable trophies';
  if (f.kind !== 'all') return `${KIND_LABELS[f.kind]} trophies`;
  return `All ${app.trophies.length} trophies`;
}

function gradeBreakdown(summary) {
  const g = summary.byGrade;
  return `${summary.done}/${summary.total} earned · ${summary.percent}% · P ${g.platinum[0]}/${g.platinum[1]} · G ${g.gold[0]}/${g.gold[1]} · S ${g.silver[0]}/${g.silver[1]} · B ${g.bronze[0]}/${g.bronze[1]}`;
}

function toggleTrophy(id, earned) {
  const trophy = app.trophies.find((t) => t.id === id);
  if (!trophy) return;
  app.progress = withEarned(app.progress, id, earned);
  saveState(app.progress);
  keepSelectionVisible();
  renderAll();
  revealSelection();
  const label = isHiddenBySpoiler(trophy, app.progress) ? 'Hidden story trophy' : trophy.name;
  announce(`${label} ${earned ? 'marked earned' : 'no longer marked earned'}.`);
}

function openTrophy(id, options = {}) {
  const trophy = app.trophies.find((t) => t.id === id);
  if (!trophy) return;
  if (options.ensureVisible && !matchesFilters(trophy, app.filters, app.progress)) {
    app.filters = { ...EMPTY_FILTERS };
    syncControls();
  }
  app.selectedId = id;
  if (app.view !== 'checklist') setView('checklist');
  keepSelectionVisible();
  renderAll();
  refs.detail.scrollTop = 0;
  revealSelection();
  if (options.focusList) focusRow(id, 'main');
}

function openStage(stageId) {
  setView('roadmap');
  requestAnimationFrame(() => {
    const card = refs.views.roadmap.querySelector(`.stage[data-stage="${stageId}"]`);
    card?.scrollIntoView({ block: 'start' });
    announce(`Roadmap stage ${stageId}.`);
  });
}

function revealSelection() {
  if (app.view !== 'checklist' || app.selectedId === null) return;
  const row = refs.list.querySelector(`.trophy-row[data-id="${app.selectedId}"]`);
  row?.scrollIntoView({ block: 'nearest' });
}

function focusRow(id, part) {
  const row = refs.list.querySelector(`.trophy-row[data-id="${id}"]`);
  const target = part === 'tick' ? row?.querySelector('.tick') : row?.querySelector('.row-main');
  target?.focus({ preventScroll: true });
}

function setSpoiler(value) {
  app.progress = withSpoiler(app.progress, value);
  saveState(app.progress);
  refs.spoiler.checked = app.progress.spoiler;
  keepSelectionVisible();
  renderAll();
  announce(app.progress.spoiler ? 'Spoiler shield on. Unearned story trophies are hidden.' : 'Spoiler shield off.');
}

function moveSelection(delta) {
  const visible = visibleTrophies();
  if (visible.length === 0) return;
  let index = visible.findIndex((trophy) => trophy.id === app.selectedId);
  if (index < 0) index = delta > 0 ? -1 : 0;
  const nextIndex = (index + delta + visible.length) % visible.length;
  const next = visible[nextIndex];
  openTrophy(next.id, { focusList: true });
  const hidden = isHiddenBySpoiler(next, app.progress);
  const earned = app.progress.earned.has(next.id);
  announce(`${nextIndex + 1} of ${visible.length}: ${hidden ? 'Hidden story trophy' : next.name}${earned ? ', earned' : ''}.`);
}

function onKeydown(event) {
  const target = event.target;
  const typing =
    target instanceof Element &&
    (target.matches('input[type="search"], input[type="text"], textarea, select') || target.isContentEditable);
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key === '/' && !typing) {
    event.preventDefault();
    focusSearch();
    return;
  }
  if (event.key === 'Escape') {
    if (target === refs.search) {
      if (refs.search.value) {
        refs.search.value = '';
        app.filters.query = '';
        onFilterChange();
      } else {
        refs.search.blur();
      }
      event.preventDefault();
      return;
    }
    if (refs.toast.classList.contains('is-on')) {
      hideToast();
      event.preventDefault();
    }
    return;
  }
  if (typing) return;

  if (event.key === 's' || event.key === 'S') {
    event.preventDefault();
    setSpoiler(!app.progress.spoiler);
    return;
  }
  if (event.key === '?') {
    event.preventDefault();
    setView('method');
    return;
  }
  if (app.view !== 'checklist') return;

  if (event.key === 'ArrowDown' || event.key === 'j' || event.key === 'J') {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key === 'ArrowUp' || event.key === 'k' || event.key === 'K') {
    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === 'e' || event.key === 'E') {
    if (app.selectedId === null) return;
    event.preventDefault();
    toggleTrophy(app.selectedId, !app.progress.earned.has(app.selectedId));
  }
}

function focusSearch() {
  if (app.view !== 'checklist') setView('checklist');
  requestAnimationFrame(() => {
    refs.search.focus();
    refs.search.select();
  });
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const { ids, skipped } = await readProgressFile(file, app.trophies);
    app.progress = withEarnedAll(app.progress, ids);
    saveState(app.progress);
    keepSelectionVisible();
    renderAll();
    const skippedNote = skipped ? `, ${skipped} skipped` : '';
    showToast(`Imported ${ids.size} earned ${ids.size === 1 ? 'trophy' : 'trophies'}${skippedNote}. Current progress replaced.`);
  } catch (error) {
    showToast(`Import failed: ${error instanceof Error ? error.message : String(error)}.`);
  } finally {
    event.target.value = '';
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  refs.toast.textContent = message;
  refs.toast.classList.add('is-on');
  toastTimer = window.setTimeout(hideToast, 3600);
}

function hideToast() {
  window.clearTimeout(toastTimer);
  refs.toast.classList.remove('is-on');
}

function announce(message) {
  window.clearTimeout(announceTimer);
  refs.live.textContent = '';
  announceTimer = window.setTimeout(() => {
    refs.live.textContent = message;
  }, 60);
}
