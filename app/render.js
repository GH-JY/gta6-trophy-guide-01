// DOM builders for the four screens: checklist, roadmap, missables and method.
// Every string goes through textContent, never innerHTML, so a trophy name can never become markup.
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

function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function sourcePill(source) {
  return el(
    'a',
    {
      class: `source-pill${source.official ? ' is-official' : ''}`,
      href: source.url,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: `${source.name} — opens in a new tab`,
    },
    el('span', { class: 'source-dot', 'aria-hidden': 'true' }),
    source.short,
  );
}

export function renderProgressChip(node, trophies, state) {
  const summary = progressSummary(trophies, state.earned);
  node.setAttribute('aria-label', `${summary.done} of ${summary.total} trophies earned, ${summary.percent} percent`);
  node.replaceChildren(
    el('span', { class: 'chip-count', text: `${summary.done} / ${summary.total}` }),
    el('span', { class: 'chip-label', text: `${summary.percent}% earned` }),
    el('span', { class: 'chip-bar', 'aria-hidden': 'true' }, el('span', { class: 'chip-fill', style: `width:${summary.percent}%` })),
  );
  document.documentElement.style.setProperty('--progress', `${summary.percent}%`);
}

export function renderList(container, ctx) {
  const { trophies, state, selectedId, onSelect, onToggle, onClear } = ctx;
  const rows = trophies.map((t) => {
    const hidden = isHiddenBySpoiler(t, state);
    const earned = state.earned.has(t.id);
    const label = hidden ? 'this hidden story trophy' : t.name;
    const checkbox = el('input', {
      type: 'checkbox',
      class: 'tick',
      checked: earned,
      'aria-label': `Mark ${label} earned`,
      onchange: (event) => onToggle(t.id, event.currentTarget.checked),
    });
    const main = el(
      'button',
      {
        class: 'row-main',
        type: 'button',
        'aria-pressed': String(t.id === selectedId),
        title: hidden ? 'Hidden story trophy' : t.name,
        onclick: () => onSelect(t.id),
      },
      el(
        'span',
        { class: 'row-name' },
        el('span', { class: 'row-name-text', text: hidden ? 'Hidden story trophy' : t.name }),
        t.hidden && !hidden ? el('span', { class: 'psn-hidden', title: 'Hidden on PlayStation until earned', text: 'hidden' }) : null,
        t.missable ? el('span', { class: 'miss-pill', title: 'Missable — read the window before the finale', text: 'missable' }) : null,
      ),
      el('span', {
        class: 'row-desc',
        text: hidden ? 'Earn it in-game to reveal the name and description.' : t.description,
      }),
    );
    return el(
      'li',
      {
        class: `trophy-row${t.id === selectedId ? ' is-selected' : ''}${earned ? ' is-earned' : ''}${t.missable ? ' is-missable' : ''}${hidden ? ' is-shielded' : ''}`,
        dataset: { id: String(t.id) },
      },
      el('label', { class: 'tick-wrap' }, checkbox, el('span', { class: 'tick-box', 'aria-hidden': 'true' })),
      main,
      el('div', { class: 'row-meta' }, gradeBadge(t.grade), kindTag(t.kind)),
    );
  });
  if (rows.length === 0) {
    container.replaceChildren(
      el(
        'li',
        { class: 'empty' },
        el('strong', { text: 'No trophy matches these filters.' }),
        el('span', { text: ' Loosen a filter or clear the search to bring the list back.' }),
        onClear ? el('button', { class: 'btn btn-small empty-action', type: 'button', onclick: onClear, text: 'Clear filters' }) : null,
      ),
    );
  } else {
    container.replaceChildren(...rows);
  }
}

export function renderDetail(container, ctx) {
  const { trophy, state, stages, onToggle, onSpoilerOff, onOpenStage } = ctx;
  if (!trophy) {
    container.replaceChildren(el('p', { class: 'empty', text: 'Pick a trophy from the list to read its guide.' }));
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
        el('span', { class: 'shield-lock', 'aria-hidden': 'true' }),
        el(
          'div',
          { class: 'shield-copy' },
          el('p', { text: 'This is an unearned story trophy, so its name, description and guide stay behind the shield. It will unlock here the moment you mark it earned.' }),
          el('p', { class: 'shield-note', text: 'The rest of the list is untouched: only unearned story entries are hidden.' }),
        ),
        el(
          'div',
          { class: 'shield-actions' },
          el('button', { class: 'btn btn-primary', type: 'button', onclick: onSpoilerOff, text: 'Turn the shield off' }),
          el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => onToggle(trophy.id, true), text: 'I have earned it' }),
        ),
      ),
    );
    return;
  }

  const sources = resolveSources(trophy.sources);
  container.replaceChildren(
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
      'div',
      { class: 'source-strip' },
      el('span', { class: 'source-strip-label', text: 'Sources' }),
      ...sources.map(sourcePill),
    ),
    el(
      'section',
      { class: 'detail-section' },
      el('h3', { text: 'How to earn it' }),
      ...trophy.guide.split('\n\n').map((p) => el('p', { text: p })),
    ),
    ...(trophy.missable ? [missableBox(trophy.missable)] : []),
    el(
      'section',
      { class: 'detail-section sources' },
      el('h3', { text: 'Sources & further reading' }),
      el('p', { class: 'sources-note', text: 'Every route below is written for this guide; the desks are named so you can check the reasoning. Links open only when you follow them.' }),
      el(
        'ol',
        { class: 'source-list' },
        ...sources.map((s, index) =>
          el(
            'li',
            {},
            el('span', { class: 'source-index', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0') }),
            el(
              'div',
              { class: 'source-body' },
              el(
                'div',
                { class: 'source-titleline' },
                el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.name }),
                el('span', { class: 'source-host', text: hostOf(s.url) }),
              ),
              el('p', { class: 'source-role', text: s.role }),
            ),
          ),
        ),
      ),
    ),
  );
}

function missableBox(missable) {
  return el(
    'section',
    { class: 'missable-box' },
    el('header', { class: 'missable-head' }, el('span', { class: 'miss-flag', 'aria-hidden': 'true', text: '!' }), el('h3', { text: 'Missable window' })),
    el(
      'dl',
      { class: 'miss-facts' },
      el('div', {}, el('dt', { text: 'When' }), el('dd', { text: missable.when })),
      el('div', {}, el('dt', { text: 'Why' }), el('dd', { text: missable.why })),
      el('div', {}, el('dt', { text: 'Do this' }), el('dd', { text: missable.order })),
    ),
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
    const percent = list.length ? Math.round((done / list.length) * 100) : 0;
    const shown = list.slice(0, 8);
    return el(
      'article',
      { class: `stage${done === list.length && list.length ? ' is-complete' : ''}`, dataset: { stage: String(stage.id) } },
      el('div', { class: 'stage-num' }, el('span', { class: 'stage-num-label', text: 'Stage' }), el('span', { class: 'stage-num-value', text: String(stage.id) })),
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
        el(
          'div',
          { class: 'stage-meter', role: 'progressbar', 'aria-label': `${stage.title}: ${done} of ${list.length} earned`, 'aria-valuemin': '0', 'aria-valuemax': String(list.length), 'aria-valuenow': String(done) },
          el('span', { class: 'stage-meter-fill', style: `width:${percent}%` }),
        ),
        el('p', { class: 'stage-note', text: stage.note }),
        stage.why ? el('p', { class: 'stage-why', text: stage.why }) : null,
        el(
          'div',
          { class: 'stage-chips' },
          ...shown.map((t) =>
            el(
              'button',
              {
                class: `mini-chip mini-${t.grade}${state.earned.has(t.id) ? ' is-earned' : ''}`,
                type: 'button',
                title: isHiddenBySpoiler(t, state) ? 'Hidden story trophy' : t.name,
                onclick: () => onSelect(t.id),
              },
              state.earned.has(t.id) ? el('span', { class: 'chip-tick', 'aria-hidden': 'true', text: '✓' }) : null,
              isHiddenBySpoiler(t, state) ? 'Hidden story trophy' : t.name,
            ),
          ),
          list.length > shown.length ? el('span', { class: 'mini-chip mini-more', text: `+${list.length - shown.length} more` }) : null,
        ),
      ),
    );
  });
  container.replaceChildren(...cards);
}

export function renderRoadmap(container, ctx) {
  const { roadmap } = ctx;
  const head = el(
    'header',
    { class: 'page-head' },
    el('p', { class: 'eyebrow', text: 'Order of work · built from the official descriptions' }),
    el('h2', { text: roadmap.title }),
    el('p', { class: 'page-intro', text: roadmap.intro }),
    el(
      'div',
      { class: 'legend', 'aria-hidden': 'true' },
      el('span', { class: 'legend-item legend-amber', text: 'Missable window' }),
      el('span', { class: 'legend-item legend-cyan', text: 'Counted sweep' }),
      el('span', { class: 'legend-item legend-pink', text: 'Skill or grind' }),
    ),
  );
  const stageHost = el('div', { class: 'stage-list' });
  const rail = el('aside', { class: 'roadmap-rail', 'aria-label': 'Point of no return and missable windows' }, pointOfNoReturnCard(roadmap), missableRail(ctx.trophies, ctx));
  container.replaceChildren(el('div', { class: 'roadmap-grid' }, el('div', { class: 'roadmap-main' }, head, stageHost), rail));
  renderStageCards(stageHost, ctx);
}

function pointOfNoReturnCard(roadmap) {
  const ponr = roadmap.pointOfNoReturn;
  return el(
    'div',
    { class: 'rail-card ponr-card' },
    el('p', { class: 'eyebrow', text: ponr.before }),
    el('h3', { text: ponr.title }),
    el('p', { text: ponr.body }),
    el('div', { class: 'ponr-stripe', 'aria-hidden': 'true' }),
  );
}

function missableRail(trophies, ctx) {
  const list = trophies.filter((t) => t.missable);
  const done = list.filter((t) => ctx.state.earned.has(t.id)).length;
  return el(
    'div',
    { class: 'rail-card miss-rail-card' },
    el(
      'div',
      { class: 'rail-head' },
      el('h3', { text: 'Missable windows' }),
      el('span', { class: 'rail-count', text: `${done}/${list.length}` }),
    ),
    el(
      'ol',
      { class: 'miss-list' },
      ...list.map((t) =>
        el(
          'li',
          { class: ctx.state.earned.has(t.id) ? 'is-earned' : '' },
          el(
            'button',
            { class: 'miss-link', type: 'button', onclick: () => ctx.onSelect(t.id) },
            el('span', { class: 'miss-link-name', text: isHiddenBySpoiler(t, ctx.state) ? 'Hidden story trophy' : t.name }),
            el('span', { class: 'miss-link-when', text: t.missable.when }),
          ),
        ),
      ),
    ),
    el('p', { class: 'rail-note', text: 'Every window closes when the final mission goes live. Save in a new slot before it.' }),
  );
}

export function renderMissables(container, ctx) {
  const { trophies, state, stages, onSelect } = ctx;
  const list = trophies.filter((t) => t.missable).sort((a, b) => a.stage - b.stage || a.id - b.id);
  const stage2 = list.filter((t) => t.stage === 2).length;
  const stage3 = list.filter((t) => t.stage === 3).length;
  const cleared = list.filter((t) => state.earned.has(t.id)).length;

  const rail = el(
    'aside',
    { class: 'missables-rail', 'aria-label': 'Missable summary' },
    el(
      'div',
      { class: 'rail-card' },
      el('p', { class: 'eyebrow', text: 'At a glance' }),
      el('h3', { text: `${list.length} windows, one save` }),
      el('p', { text: 'The flagged entries are the only trophies on the list with a hard deadline. Everything else can wait for cleanup.' }),
      el(
        'dl',
        { class: 'miss-stats' },
        el('div', {}, el('dt', { text: 'Flags' }), el('dd', { text: String(list.length) })),
        el('div', {}, el('dt', { text: 'Stage 2 strands' }), el('dd', { text: String(stage2) })),
        el('div', {}, el('dt', { text: 'Stage 3 beats' }), el('dd', { text: String(stage3) })),
        el('div', {}, el('dt', { text: 'Cleared' }), el('dd', { text: String(cleared) })),
      ),
    ),
    el(
      'div',
      { class: 'rail-card' },
      el('h3', { text: 'Order of work' }),
      el(
        'ol',
        { class: 'miss-steps' },
        el('li', { text: 'Clear every amber stranger marker in stage 2 as it appears.' }),
        el('li', { text: 'Finish partner runs and one-off story beats inside stage 3.' }),
        el('li', { text: 'Save in a fresh slot before the final mission, then clean up.' }),
      ),
      el('p', { class: 'rail-note', text: `Stage ${stages.find((s) => s.id === 2)?.id ?? 2} and stage ${stages.find((s) => s.id === 3)?.id ?? 3} carry all twelve flags.` }),
    ),
  );

  const table = el(
    'div',
    { class: 'miss-table-card' },
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
            el('span', { class: 'miss-stage', text: `Stage ${t.stage}` }),
          ),
          el('span', { class: 'miss-window', role: 'cell', text: t.missable.when }),
          el('span', { class: 'miss-why', role: 'cell', text: t.missable.why }),
          el('span', { role: 'cell' }, el('button', { class: 'btn btn-small', type: 'button', onclick: () => onSelect(t.id), text: 'Open guide' })),
        ),
      ),
    ),
  );

  container.replaceChildren(
    el(
      'header',
      { class: 'page-head' },
      el('p', { class: 'eyebrow', text: 'Story windows · 12 flags' }),
      el('h2', { text: 'Missable trophies' }),
      el('p', { class: 'page-intro', text: 'These entries are chapter-bound: their descriptions tie them to a mission, a character strand or a one-time story beat. Do each inside its window, in the order below; the roadmap puts them all before the final mission.' }),
    ),
    el('div', { class: 'missables-layout' }, rail, table),
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
      el('p', { class: 'page-intro', text: 'An offline guide and tracker for all 55 PlayStation 5 trophies of Grand Theft Auto VI. The official list is fixed; everything around it is original planning, with the reference named beside every guide.' }),
    ),
    el(
      'div',
      { class: 'method-grid' },
      el(
        'section',
        { class: 'method-card' },
        el('h3', { text: 'The official list' }),
        el('p', { text: 'All 55 trophies appear with the names, descriptions and grades PlayStation publishes: 1 platinum, 2 gold, 6 silver and 46 bronze. Names and descriptions are quoted exactly; the guides around them are written for this entry.' }),
        el('p', { text: 'There are no online trophies, so the tracker needs no connection and no PlayStation Network sign-in.' }),
      ),
      el(
        'section',
        { class: 'method-card' },
        el('h3', { text: 'Reading a guide' }),
        el('p', { text: 'Each entry opens with the official line, then our own two-paragraph route: what to do, where to do it and what usually goes wrong. The source strip names the desks the route leans on, and the list at the bottom says what each one contributed.' }),
      ),
      el(
        'section',
        { class: 'method-card' },
        el('h3', { text: 'Missable flags' }),
        el('p', { text: 'A trophy is flagged only when its official description ties it to a one-time story window: a named character’s final mission, a partner run, a story choice, or a cryptic beat that reads as a single scene. The flag carries the chapter window, the reason and the order to do it in.' }),
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
        el('p', { text: 'Ticks are saved in this browser with localStorage. Export writes a JSON file of your earned trophies; import reads it back and replaces current progress. A row can be ticked from the list or from the guide.' }),
      ),
      el(
        'section',
        { class: 'method-card' },
        el('h3', { text: 'Keyboard & focus' }),
        el('p', { text: 'Every control is reachable with Tab and activates with Enter or Space. On the checklist, use the arrow keys or j / k to move through trophies, e to toggle earned, and / to jump to search. s flips the spoiler shield and Escape clears or leaves the search box.' }),
      ),
      el(
        'section',
        { class: 'method-card wide' },
        el('h3', { text: 'Where the facts come from' }),
        el('p', { text: 'Every trophy names at least two sources. The official list fixes the requirement; the other desks supply counts, routes and community-verified triggers. Links open only when you follow them — this app loads nothing from them.' }),
        el(
          'ul',
          { class: 'source-cards' },
          ...sourceCards.map((s) =>
            el(
              'li',
              {},
              el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.name }),
              el('span', { class: 'source-card-host', text: hostOf(s.url) }),
              el('span', { class: 'source-card-role', text: s.role }),
            ),
          ),
        ),
      ),
      el(
        'section',
        { class: 'method-card wide' },
        el('h3', { text: 'Small print' }),
        el('p', { text: 'An unofficial fan guide, not affiliated with Rockstar Games or Sony. It ships no logo, artwork, box art or screenshot from the game: the look is CSS, type and colour. The prose is original; sources are cited, never copied.' }),
      ),
    ),
  );
}
