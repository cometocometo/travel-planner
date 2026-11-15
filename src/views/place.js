import { getPlace } from '../db.js';
import { esc } from '../util.js';
import { renderPlaceCard } from './placecard.js';

export async function placePage(view, [id]) {
  const p = await getPlace(id);
  if (!p) {
    view.innerHTML = `<div class="page"><h1>Place not found</h1><p class="muted">It may have been removed in a newer data import.</p></div>`;
    return;
  }
  const back = `#/browse/${encodeURIComponent(p.country || '—')}`;
  view.innerHTML = `<div class="page">
    <div class="crumbs"><a href="javascript:history.back()">‹ Back</a> · <a href="${back}">${esc(p.country || '')}</a> ·
      <a href="#/map?country=${encodeURIComponent(p.country || '')}">Map</a></div>
    <div data-card></div></div>`;
  await renderPlaceCard(view.querySelector('[data-card]'), p);
}
