// Country → Region → City → places.
import { allPlaces, allUser } from '../db.js';
import { esc, fold, placeLine, TYPE_COLORS, TYPE_LABELS } from '../util.js';

const regionOf = p => p.province || p.layer || p.source?.map || '—';
const cityOf = p => p.city || p.region || '—';
const link = (...parts) => '#/browse/' + parts.map(encodeURIComponent).join('/');

export async function browse(view, [country, region, city]) {
  const [places, user] = await Promise.all([allPlaces(), allUser()]);
  let list = places;
  if (country) list = list.filter(p => (p.country || '—') === country);
  if (region) list = list.filter(p => regionOf(p) === region);
  if (city) list = list.filter(p => cityOf(p) === city);

  const crumbs = [`<a href="#/browse">All</a>`];
  if (country) crumbs.push(`<a href="${link(country)}">${esc(country)}</a>`);
  if (region) crumbs.push(`<a href="${link(country, region)}">${esc(region)}</a>`);
  if (city) crumbs.push(esc(city));
  const title = city || region || country || 'Browse';
  const groups = (key) => {
    const g = {};
    for (const p of list) g[key(p)] = (g[key(p)] || 0) + 1;
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  };

  let body;
  if (!country) {
    body = `<ul class="list">${groups(p => p.country || '—').map(([c, n]) =>
      `<li><a class="grow" href="${link(c)}">${esc(c)}</a><span class="muted">${n}</span></li>`).join('')}</ul>`;
  } else if (!region) {
    body = `<ul class="list">${groups(regionOf).map(([r, n]) =>
      `<li><a class="grow" href="${link(country, r)}">${esc(r)}</a><span class="muted">${n}</span></li>`).join('')}</ul>`;
  } else if (!city && groups(cityOf).length > 1) {
    body = `<ul class="list">${groups(cityOf).map(([c, n]) =>
      `<li><a class="grow" href="${link(country, region, c)}">${esc(c)}</a><span class="muted">${n}</span></li>`).join('')}</ul>`;
  } else {
    body = placeList(list, user);
  }
  view.innerHTML = `<div class="page">
    <div class="crumbs">${crumbs.join(' › ')}</div>
    <div class="row"><h1>${esc(title)}</h1><span class="spacer"></span>
      ${country ? `<a class="btn" href="#/map?country=${encodeURIComponent(country)}">Map</a>` : ''}</div>
    ${body}</div>`;
  wireFilter(view, list, user);
}

function placeList(list, user, typeFilter = '', q = '') {
  const types = [...new Set(list.map(p => p.type))].sort();
  return `<div class="row" style="margin-bottom:8px">
      <input type="search" data-q placeholder="Filter by name" style="flex:1">
      <select data-type><option value="">All types</option>${types.map(t => `<option value="${t}">${esc(TYPE_LABELS[t] || t)}</option>`).join('')}</select>
    </div><ul class="list" data-places>${rows(list, user)}</ul>`;
}

function rows(list, user) {
  const order = { sight: 0, saved: 1, activity: 2, food: 3, nightlife: 4, shop: 5, stay: 6, event: 7, info: 8 };
  return list.slice().sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.name.localeCompare(b.name))
    .map(p => {
      const s = user.get(p.id)?.status;
      return `<li data-type="${p.type}" data-q="${esc(fold(p.name + ' ' + (p.name_zh || '') + ' ' + (p.pinyin || '')))}">
        <span class="dot" style="background:${TYPE_COLORS[p.type] || '#555'}"></span>
        <a class="grow" href="#/place/${encodeURIComponent(p.id)}">${esc(p.name)} ${p.name_zh ? `<span class="zh">${esc(p.name_zh)}</span>` : ''}
          <div class="small muted">${esc(placeLine(p))}${p.top_choice ? ' · ★' : ''}</div></a>
        ${s ? `<span class="pill ${s}">${s}</span>` : ''}</li>`;
    }).join('');
}

function wireFilter(view) {
  const q = view.querySelector('[data-q]');
  const ty = view.querySelector('[data-type]');
  if (!q) return;
  const apply = () => {
    const v = fold(q.value.trim());
    view.querySelectorAll('[data-places] li').forEach(li => {
      li.hidden = (v && !li.dataset.q.includes(v)) || (ty.value && li.dataset.type !== ty.value);
    });
  };
  q.addEventListener('input', apply);
  ty.addEventListener('change', apply);
}
