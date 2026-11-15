import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { dashboard } from './views/dashboard.js';
import { mapView } from './views/mapview.js';
import { browse } from './views/browse.js';
import { placePage } from './views/place.js';
import { tripsList, tripEdit } from './views/trips.js';
import { tripMap } from './views/tripmap.js';
import { tripSummary } from './views/summary.js';
import { settings } from './views/settings.js';
import { guideIndex, guideChapter } from './views/guide.js';

registerSW({ immediate: true });
// Ask the browser not to clear our data when space is low.
navigator.storage?.persist?.();

const routes = [
  [/^$/, 'home', dashboard],
  [/^map$/, 'map', mapView],
  [/^browse(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?$/, 'browse', browse],
  [/^place\/(.+)$/, 'browse', placePage],
  [/^trips$/, 'trips', tripsList],
  [/^trip\/([^/]+)\/map$/, 'trips', tripMap],
  [/^trip\/([^/]+)\/summary$/, 'trips', tripSummary],
  [/^trip\/([^/]+)$/, 'trips', tripEdit],
  [/^guide$/, 'guide', guideIndex],
  [/^guide\/([^/]+)$/, 'guide', guideChapter],
  [/^settings$/, 'settings', settings],
];

const view = document.getElementById('view');
let cleanup = null;

async function route() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(qs || '');
  for (const [re, tab, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
    if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
    view.innerHTML = '';
    view.scrollTop = 0;
    const args = m.slice(1).map(x => (x == null ? x : decodeURIComponent(x)));
    try {
      cleanup = (await fn(view, args, params)) || null;
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="page"><h1>Something went wrong</h1><p class="warn">${String(e.message || e)}</p></div>`;
    }
    return;
  }
  location.hash = '#/';
}

addEventListener('hashchange', route);
route();
