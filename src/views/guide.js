// The book's own chapters: Top 30, itineraries, need to know, regions, history, transport...
// The chapter HTML was cleaned when the data file was built (tools/extract_lp_guide.py).
import { guideList, getGuide, allGuides } from '../db.js';
import { esc, fold } from '../util.js';

const GROUPS = [
  ['plan', 'Plan your trip'],
  ['region', 'Regions'],
  ['understand', 'Understand China'],
  ['survival', 'Survival guide'],
];
export const FEATURED = ['02-top-30', '07-itineraries', '03-need-to-know', '06-month-by-month', '04-first-time', '05-if-you-like'];

export async function guideIndex(view, _args, params) {
  const list = await guideList();
  if (!list.length) {
    view.innerHTML = `<div class="page"><h1>Book</h1><div class="card">No book chapters on this device yet.<br>
      Import the newest data file in <a href="#/settings">Settings</a>. Your trips and notes are kept.</div></div>`;
    return;
  }
  const q = params.get('q') || '';
  view.innerHTML = `<div class="page">
    <h1>Book</h1>
    <p class="muted small">Lonely Planet China, 16th edition. Stored on this device, works offline.</p>
    <form class="row" data-search style="margin-bottom:12px">
      <input type="search" name="q" placeholder="Search the whole book" value="${esc(q)}" style="flex:1">
      <button class="primary">Search</button>
    </form>
    <div data-results></div>
    ${GROUPS.map(([g, title]) => `<h2>${title}</h2><ul class="list">${list.filter(c => c.group === g).map(c =>
      `<li><a class="grow" href="#/guide/${c.id}">${esc(c.title)}</a></li>`).join('')}</ul>`).join('')}
  </div>`;
  view.querySelector('[data-search]').addEventListener('submit', e => {
    e.preventDefault();
    const v = new FormData(e.target).get('q').trim();
    location.hash = '#/guide' + (v ? '?q=' + encodeURIComponent(v) : '');
  });
  if (q) await search(view.querySelector('[data-results]'), q);
}

// Full-text search over all chapters. Matches whole paragraphs and shows the nearest heading.
async function search(el, q) {
  el.innerHTML = '<p class="muted">Searching…</p>';
  const needle = fold(q);
  const hits = [];
  const tmp = document.createElement('div');
  for (const c of await allGuides()) {
    tmp.innerHTML = c.html;
    let heading = null;
    for (const n of tmp.querySelectorAll('h1,h2,h3,h4,p,li,.poi-link')) {
      if (/^H\d$/.test(n.tagName)) { if (n.id) heading = { id: n.id, title: n.textContent }; }
      const t = n.textContent;
      const i = fold(t).indexOf(needle);
      if (i < 0) continue;
      const a = n.id || n.closest('[id]')?.id || heading?.id;
      const s = Math.max(0, i - 80);
      hits.push({ c, a, where: heading?.title || '',
        snip: (s ? '…' : '') + t.slice(s, i) + '\u0001' + t.slice(i, i + q.length) + '\u0002' + t.slice(i + q.length, i + 160) + '…' });
      if (hits.length >= 200) break;
    }
    if (hits.length >= 200) break;
  }
  el.innerHTML = `<h2>${hits.length >= 200 ? '200+' : hits.length} results for “${esc(q)}”</h2>` + (hits.length
    ? `<ul class="list">${hits.map(h => `<li><a class="grow" href="#/guide/${h.c.id}${h.a ? '?a=' + encodeURIComponent(h.a) : ''}">
        <b>${esc(h.c.title)}</b>${h.where && h.where !== h.c.title ? ` › ${esc(h.where)}` : ''}
        <div class="small muted">${esc(h.snip).replace('\u0001', '<mark>').replace('\u0002', '</mark>')}</div></a></li>`).join('')}</ul>`
    : '<p class="empty">Nothing found.</p>');
}

export async function guideChapter(view, [id], params) {
  const [c, list] = await Promise.all([getGuide(id), guideList()]);
  if (!c) {
    view.innerHTML = `<div class="page"><h1>Chapter not found</h1><p><a href="#/guide">All chapters</a></p></div>`;
    return;
  }
  const i = list.findIndex(x => x.id === id);
  const prev = list[i - 1], next = list[i + 1];
  const toc = c.toc.filter(t => t.title !== c.title);
  view.innerHTML = `<div class="page guide">
    <div class="crumbs"><a href="#/guide">Book</a> › ${esc(GROUPS.find(g => g[0] === c.group)?.[1] || '')}</div>
    ${toc.length ? `<details class="toc card"><summary><b>Contents</b> <span class="muted small">(${toc.length})</span></summary>
      <ul>${toc.map(t => `<li class="l${t.level}"><a href="#/guide/${c.id}?a=${encodeURIComponent(t.id)}">${esc(t.title)}</a></li>`).join('')}</ul></details>` : ''}
    <div class="gtext">${c.html}</div>
    <div class="row noprint" style="margin-top:24px">
      ${prev ? `<a class="btn" href="#/guide/${prev.id}">‹ ${esc(prev.title)}</a>` : ''}<span class="spacer"></span>
      ${next ? `<a class="btn" href="#/guide/${next.id}">${esc(next.title)} ›</a>` : ''}</div>
  </div>`;
  const a = params.get('a');
  const target = a && view.querySelector(`[id="${CSS.escape(a)}"]`);
  if (target) {
    target.scrollIntoView({ block: 'start' });
    target.classList.add('flash');
    // Long chapters can still change height while fonts load: jump again once the page settles.
    requestAnimationFrame(() => setTimeout(() => target.scrollIntoView({ block: 'start' }), 300));
  }
}
