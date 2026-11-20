// DOM builders for the four screens: checklist, roadmap, missables and method. Data is always set with
// textContent, never innerHTML, so a trophy string can never become markup.
import { resolveSources } from './sources.js';
import { progressSummary, isHiddenBySpoiler } from './state.js';

export const KIND_LABELS = {
  story: 'Story',
  side: 'Side strand',
  collectible: 'Collectible',
  activity: 'Activity',
  challenge: 'Challenge',
  freeplay: 'Free play',
  completion: 'Completion',
};

const GRADE_LABELS = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function gradeBadge(grade) {
  return el('span', { class: `grade grade-${grade}`, text: GRADE_LABELS[grade] ?? grade });
}

export function kindTag(kind) {
  return el('span', { class: 'kind-tag', text: KIND_LABELS[kind] ?? kind });
}

function trophyLabel(trophy, state) {
  return isHiddenBySpoiler(trophy, state) ? 'Hidden story trophy' : trophy.name;
}

export function renderProgressChip(node, trophies, state) {
  const summary = progressSummary(trophies, state.earned);
  node.setAttribute('aria-label', `${summary.done} of ${summary.total} trophies earned, ${summary.percent} percent`);
  node.replaceChildren(
    el('span', { class: 'chip-count', text: `${summary.done} / ${summary.total}` }),
    el('span', { class: 'chip-label', text: `${summary.percent}% earned` }),
    el('span', { class: 'chip-bar' }, el('span', { class: 'chip-fill', style: `width:${summary.percent}%` })),
  );
  document.documentElement.style.setProperty('--progress', `${summary.percent}%`);
}

export function renderList(container, ctx) {
  const { trophies, state, selectedId, onSelect, onToggle } = ctx;
  const rows = trophies.map((t) => {
    const hidden = isHiddenBySpoiler(t, state);
    const earned = state.earned.has(t.id);
    const checkbox = el('input', {
      type: 'checkbox',
      class: 'tick',
      checked: earned,
      'aria-label': `Mark ${hidden ? 'this hidden story trophy' : t.name} earned`,
      onchange: (event) => onToggle(t.id, event.currentTarget.checked),
    });
    const main = el(
      'button',
      {
        class: 'row-main',
        type: 'button',
        'aria-pressed': String(t.id === selectedId),
        onclick: () => onSelect(t.id),
      },
      el(
        'span',
        { class: 'row-name' },
        hidden ? 'Hidden story trophy' : t.name,
        t.hidden && !hidden ? el('span', { class: 'psn-hidden', title: 'Hidden on PlayStation until earned', text: 'hidden' }) : null,
      ),
      el('span', {
        class: 'row-desc',
        text: hidden ? 'Earn it in-game to reveal the name and description.' : t.description,
      }),
    );
    return el(
      'li',
      {
        class: `trophy-row${t.id === selectedId ? ' is-selected' : ''}${earned ? ' is-earned' : ''}`,
        dataset: { id: String(t.id) },
      },
      el('label', { class: 'tick-wrap' }, checkbox, el('span', { class: 'tick-box', 'aria-hidden': 'true' })),
      main,
      el(
        'div',
        { class: 'row-meta' },
        gradeBadge(t.grade),
        kindTag(t.kind),
        t.missable ? el('span', { class: 'miss-dot', title: 'Missable — see the window', text: '!' }) : null,
      ),
    );
  });
  container.replaceChildren(...rows);
  if (rows.length === 0) {
    container.replaceChildren(
      el('li', { class: 'empty' }, el('strong', { text: 'No trophies match.' }), ' Loosen a filter or clear the search.'),
    );
  }
}

export function renderDetail(container, ctx) {
  const { trophy, state, stages, onToggle, onSpoilerOff, onOpenStage } = ctx;
  if (!trophy) {
    container.replaceChildren(el('p', { class: 'empty', text: 'Pick a trophy to read its guide.' }));
    return;
  }
  const hidden = isHiddenBySpoiler(trophy, state);
  const earned = state.earned.has(trophy.id);
  const stage = stages.find((s) => s.id === trophy.stage);

  const head = el(
    'div',
    { class: 'detail-head' },
    gradeBadge(trophy.grade),
    kindTag(trophy.kind),
    stage ? el('button', { class: 'stage-link', type: 'button', onclick: () => onOpenStage(stage.id), text: `Stage ${stage.id} · ${stage.title}` }) : null,
    trophy.hidden ? el('span', { class: 'psn-hidden', text: 'PSN-hidden' }) : null,
  );

  if (hidden) {
    container.replaceChildren(
      head,
      el('h2', { class: 'detail-name', text: 'Spoiler shield is on' }),
      el(
        'div',
        { class: 'shield-panel' },
        el('p', { text: 'This is an unearned story trophy, so its name and description stay hidden. Earn it in-game and the entry unlocks here.' }),
        el('button', { class: 'btn btn-ghost', type: 'button', onclick: onSpoilerOff, text: 'Turn the spoiler shield off' }),
      ),
    );
    return;
  }

  const sources = resolveSources(trophy.sources);
  const children = [
    head,
    el('h2', { class: 'detail-name', text: trophy.name }),
    el(
      'p',
      { class: 'official' },
      el('span', { class: 'official-label', text: 'Official description' }),
      el('span', { class: 'official-text', text: `“${trophy.description}”` }),
    ),
    el(
      'div',
      { class: 'detail-actions' },
      el('button', {
        class: `btn ${earned ? 'btn-earned' : 'btn-primary'}`,
        type: 'button',
        'aria-pressed': String(earned),
        onclick: () => onToggle(trophy.id, !earned),
        text: earned ? '✓ Earned — tap to undo' : 'Mark as earned',
      }),
      el('span', { class: 'detail-count', text: trophy.count ? `Count: ${formatCount(trophy)}` : `${KIND_LABELS[trophy.kind]} · no online` }),
    ),
    el(
      'section',
      { class: 'detail-section' },
      el('h3', { text: 'How to earn it' }),
      ...trophy.guide.split('\n\n').map((p) => el('p', { text: p })),
    ),
    trophy.missable ? missableBox(trophy.missable) : null,
    el(
      'section',
      { class: 'detail-section sources' },
      el('h3', { text: 'Sources' }),
      el('p', { class: 'sources-note', text: 'Each fact is cited by name; links open only when you follow them.' }),
      el(
        'ol',
        { class: 'source-list' },
        ...sources.map((s) =>
          el(
            'li',
            {},
            el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.name }),
            el('span', { class: 'source-role', text: s.role }),
          ),
        ),
      ),
    ),
  ];
  container.replaceChildren(...children.filter(Boolean));
}

function missableBox(missable) {
  return el(
    'section',
    { class: 'missable-box' },
    el('h3', {}, el('span', { class: 'miss-flag', text: '!' }), ' Missable window'),
    el('dl', {}, el('dt', { text: 'When' }), el('dd', { text: missable.when }), el('dt', { text: 'Why' }), el('dd', { text: missable.why }), el('dt', { text: 'Do this' }), el('dd', { text: missable.order })),
  );
}

function formatCount(trophy) {
  if (trophy.count === 250000) return '$250,000';
  if (trophy.count === 100000) return '$100,000';
  return new Intl.NumberFormat('en-US').format(trophy.count);
}

export function renderStageCards(container, ctx) {
  const { trophies, state, stages, onSelect } = ctx;
  const cards = stages.map((stage) => {
    const list = trophies.filter((t) => t.stage === stage.id);
    const done = list.filter((t) => state.earned.has(t.id)).length;
    const shown = list.slice(0, 7);
    return el(
      'article',
      { class: 'stage', dataset: { stage: String(stage.id) } },
      el('div', { class: 'stage-num', text: String(stage.id) }),
      el(
        'div',
        { class: 'stage-body' },
        el(
          'div',
          { class: 'stage-titleline' },
          el('h3', { text: stage.title }),
          el('span', { class: `stage-kicker kicker-${stage.kicker.replace(/\s+/g, '-').toLowerCase()}`, text: stage.kicker }),
          el('span', { class: 'stage-count', text: `${done}/${list.length}` }),
        ),
        el('p', { class: 'stage-note', text: stage.note }),
        el(
          'div',
          { class: 'stage-chips' },
          ...shown.map((t) =>
            el('button', {
              class: `mini-chip mini-${t.grade}`,
              type: 'button',
              title: isHiddenBySpoiler(t, state) ? 'Hidden story trophy' : t.name,
              onclick: () => onSelect(t.id),
              text: isHiddenBySpoiler(t, state) ? 'Hidden story trophy' : t.name,
            }),
          ),
          list.length > shown.length ? el('span', { class: 'mini-chip mini-more', text: `+${list.length - shown.length} more` }) : null,
        ),
      ),
    );
  });
  container.replaceChildren(...cards);
}

export function renderRoadmap(container, ctx) {
  const { roadmap, stages, trophies, state } = ctx;
  const head = el(
    'header',
    { class: 'page-head' },
    el('p', { class: 'eyebrow', text: 'Order of work · built from the official descriptions' }),
    el('h2', { text: roadmap.title }),
    el('p', { class: 'page-intro', text: roadmap.intro }),
  );
  const stageHost = el('div', { class: 'stage-list' });
  const left = el('div', { class: 'roadmap-main' }, head, stageHost);
  const rail = el(
    'aside',
    { class: 'roadmap-rail' },
    el(
      'div',
      { class: 'rail-card ponr-card' },
      el('p', { class: 'eyebrow', text: roadmap.pointOfNoReturn.before }),
      el('h3', { text: roadmap.pointOfNoReturn.title }),
      el('p', { text: roadmap.pointOfNoReturn.body }),
    ),
    missableRail(trophies, ctx),
  );
  container.replaceChildren(el('div', { class: 'roadmap-grid' }, left, rail));
  renderStageCards(stageHost, ctx);
}

function missableRail(trophies, ctx) {
  const list = trophies.filter((t) => t.missable);
  return el(
    'div',
    { class: 'rail-card' },
    el('div', { class: 'rail-head' }, el('h3', { text: 'Missable windows' }), el('span', { class: 'rail-count', text: String(list.length) })),
    el(
      'ol',
      { class: 'miss-list' },
      ...list.map((t) =>
        el(
          'li',
          {},
          el('button', {
            class: 'miss-link',
            type: 'button',
            onclick: () => ctx.onSelect(t.id),
          },
          el('span', { class: 'miss-name', text: isHiddenBySpoiler(t, ctx.state) ? 'Hidden story trophy' : t.name }),
          el('span', { class: 'miss-when', text: t.missable.when }),
          ),
        ),
      ),
    ),
  );
}

export function renderMissables(container, ctx) {
  const { trophies, state, onSelect } = ctx;
  const list = trophies.filter((t) => t.missable).sort((a, b) => a.stage - b.stage || a.id - b.id);
  container.replaceChildren(
    el(
      'header',
      { class: 'page-head' },
      el('p', { class: 'eyebrow', text: 'Story windows · 12 flags' }),
      el('h2', { text: 'Missable trophies' }),
      el('p', { class: 'page-intro', text: 'These entries are chapter-bound: their descriptions tie them to a mission, a character strand or a one-time story beat. Do each one inside its window, in the order below; the roadmap puts them before the final mission.' }),
    ),
    el(
      'div',
      { class: 'miss-table', role: 'table', 'aria-label': 'Missable trophies and their windows' },
      el(
        'div',
        { class: 'miss-row miss-row-head', role: 'row' },
        el('span', { role: 'columnheader', text: '#' }),
        el('span', { role: 'columnheader', text: 'Trophy' }),
        el('span', { role: 'columnheader', text: 'Window' }),
        el('span', { role: 'columnheader', text: 'Why it is flagged' }),
        el('span', { role: 'columnheader', text: 'Guide' }),
      ),
      ...list.map((t, index) =>
        el(
          'div',
          { class: `miss-row${state.earned.has(t.id) ? ' is-earned' : ''}`, role: 'row' },
          el('span', { class: 'miss-order', role: 'cell', text: String(index + 1).padStart(2, '0') }),
          el(
            'span',
            { class: 'miss-trophy', role: 'cell' },
            gradeBadge(t.grade),
            el('strong', { text: isHiddenBySpoiler(t, state) ? 'Hidden story trophy' : t.name }),
          ),
          el('span', { class: 'miss-window', role: 'cell', text: t.missable.when }),
          el('span', { class: 'miss-why', role: 'cell', text: t.missable.why }),
          el('span', { role: 'cell' }, el('button', { class: 'btn btn-small', type: 'button', onclick: () => onSelect(t.id), text: 'Open guide' })),
        ),
      ),
    ),
  );
}

export function renderMethod(container) {
  const sourceCards = resolveSources(['ps', 'ex', 'psnp', 'pp', 'ign', 'gr', 'reddit', 'yt']);
  container.replaceChildren(
    el(
      'header',
      { class: 'page-head' },
      el('p', { class: 'eyebrow', text: 'About this guide' }),
      el('h2', { text: 'How the Ledger is built' }),
      el('p', { class: 'page-intro', text: 'An offline guide and tracker for all 55 PlayStation 5 trophies of Grand Theft Auto VI. The official list is fixed; everything around it is our own planning, with the source named beside every guide.' }),
    ),
    el(
      'div',
      { class: 'method-grid' },
      el(
        'section',
        { class: 'method-card' },
        el('h3', { text: 'The official list' }),
        el('p', { text: 'All 55 trophies are here with the names, descriptions and grades PlayStation publishes: 1 platinum, 2 gold, 6 silver and 46 bronze. Names and descriptions are quoted exactly as the official list has them; the guides around them are written for this entry.' }),
        el('p', { text: 'The list has no online trophies, so the tracker needs no connection and no PlayStation Network sign-in.' }),
      ),
      el(
        'section',
        { class: 'method-card' },
        el('h3', { text: 'Missable flags' }),
        el('p', { text: 'A trophy is flagged missable only when its official description ties it to a one-time story window: a named character’s final mission, a partner run, a story choice, or a cryptic beat that reads as a single scene. The flag carries the chapter window, the reason and the order to do it in.' }),
      ),
      el(
        'section',
        { class: 'method-card' },
        el('h3', { text: 'The roadmap' }),
        el('p', { text: 'Seven stages: story first, then the chapter-bound strands and partner beats, then collectibles, activities and free-roam challenges, and 100% last because the in-game audit checks everything. Counts come from the official descriptions and Exophase: 250 stunts, 42 shooting-range golds, 14 drone locations, 18 meditation spots, 52 areas and so on.' }),
      ),
      el(
        'section',
        { class: 'method-card' },
        el('h3', { text: 'The tracker' }),
        el('p', { text: 'Ticks are saved in this browser with localStorage. Export writes a JSON file of your earned trophies; import reads it back and replaces the current progress. Nothing leaves the page: there is no account, no sync and no request.' }),
      ),
      el(
        'section',
        { class: 'method-card wide' },
        el('h3', { text: 'Where the facts come from' }),
        el('p', { text: 'Every trophy names at least two sources. The official list fixes the requirement; the guides below supply counts, routes and community-verified triggers. Links open only when you follow them — this app loads nothing from them.' }),
        el(
          'ul',
          { class: 'source-cards' },
          ...sourceCards.map((s) =>
            el(
              'li',
              {},
              el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.name }),
              el('span', { text: s.role }),
            ),
          ),
        ),
      ),
      el(
        'section',
        { class: 'method-card wide' },
        el('h3', { text: 'Small print' }),
        el('p', { text: 'An unofficial fan guide, not affiliated with Rockstar Games or Sony. It ships no logo, artwork, box art or screenshot from the game: the look is CSS, type and colour. The guide is written in original prose; sources are cited, never copied.' }),
      ),
    ),
  );
}
