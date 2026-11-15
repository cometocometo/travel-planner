import { allPlaces, allUser, getPlace } from '../db.js';
import { createMap, toFeatures, addPlaceLayer, fitTo } from '../map.js';
import { esc, fold, TYPE_LABELS, STATUS } from '../util.js';
import { renderPlaceCard } from './placecard.js';

// Remember filters between visits (per device).
const KEY = 'mapFilters';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = f => { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch {} };

export async function mapView(view, _args, params) {
  const [places, user] = await Promise.all([allPlaces(), allUser()]);
  const countries = [...new Set(places.map(p => p.country).filter(Boolean))].sort();
  const types = [...new Set(places.map(p => p.type))].sort();
  const f = { country: '', type: '', status: '', hideInfo: true, q: '', ...load() };
  if (params.get('country')) f.country = params.get('country');

  view.innerHTML = `<div class="mapwrap"><div class="map"></div>
    <div class="mapbar">
      <input type="search" placeholder="Search name / 中文 / pinyin" value="${esc(f.q)}">
      <select data-f="country"><option value="">All countries</option>${countries.map(c => `<option ${c === f.country ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select data-f="type"><option value="">All types</option>${types.map(t => `<option value="${t}" ${t === f.type ? 'selected' : ''}>${esc(TYPE_LABELS[t] || t)}</option>`).join('')}</select>
      <select data-f="status"><option value="">Any status</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${k === f.status ? 'selected' : ''}>${v}</option>`).join('')}<option value="none" ${f.status === 'none' ? 'selected' : ''}>No status</option></select>
    </div>
    <div class="legend small" data-count></div>
    <div class="sheet" hidden><button class="close" title="Close">×</button><div class="body"></div></div>
  </div>`;
  if (!places.length) {
    view.querySelector('.map').innerHTML = '<div class="notice">No places yet. Import your data in <a href="#/settings">Settings</a>.</div>';
    return;
  }
  const map = await createMap(view.querySelector('.map'));
  const sheet = view.querySelector('.sheet');
  const open = async id => {
    const p = await getPlace(id);
    if (!p) return;
    sheet.hidden = false;
    sheet.scrollTop = 0;
    await renderPlaceCard(sheet.querySelector('.body'), p, { compact: true });
  };
  sheet.querySelector('.close').addEventListener('click', () => { sheet.hidden = true; });

  const filtered = () => {
    const q = fold(f.q.trim());
    return places.filter(p =>
      (!f.country || p.country === f.country) && (!f.type || p.type === f.type) &&
      (!f.hideInfo || f.type === 'info' || p.type !== 'info') &&
      (!f.status || (f.status === 'none' ? !user.get(p.id)?.status : user.get(p.id)?.status === f.status)) &&
      (!q || fold(`${p.name} ${p.name_zh || ''} ${p.pinyin || ''} ${p.city || ''}`).includes(q)));
  };
  let first = true;
  const draw = (fit) => {
    const list = filtered();
    const data = toFeatures(list);
    if (first) { addPlaceLayer(map, data, open); first = false; } else map.getSource('places').setData(data);
    const noPin = list.length - data.features.length;
    view.querySelector('[data-count]').textContent = `${data.features.length.toLocaleString()} places on map`
      + (noPin ? ` · ${noPin} without location` : '') + (f.type === '' && f.hideInfo ? ' · practical info hidden' : '');
    if (fit) fitTo(map, list, 12);
    save(f);
  };
  draw(!!(f.country || f.q));

  view.querySelectorAll('[data-f]').forEach(s => s.addEventListener('change', () => { f[s.dataset.f] = s.value; draw(true); }));
  let t;
  view.querySelector('input[type="search"]').addEventListener('input', e => {
    clearTimeout(t);
    t = setTimeout(() => { f.q = e.target.value; draw(!!f.q); }, 300);
  });
  return () => map.remove();
}
