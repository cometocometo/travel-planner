// All days of a trip on one map: each day in its own colour, numbered stops, route lines.
import { getTrip, placeMap, getPlace } from '../db.js';
import { createMap, fitTo, maplibregl } from '../map.js';
import { esc, DAY_COLORS, fmtDate, addDays } from '../util.js';
import { renderPlaceCard } from './placecard.js';

export async function tripMap(view, [id], params) {
  const trip = await getTrip(id);
  if (!trip) { view.innerHTML = '<div class="page"><h1>Trip not found</h1></div>'; return; }
  const byId = await placeMap();
  const only = params.get('day');
  view.innerHTML = `<div class="mapwrap"><div class="map"></div>
    <div class="mapbar"><a class="btn" href="#/trip/${trip.id}">‹ ${esc(trip.name)}</a>
      <select data-day><option value="">All days</option>${trip.days.map((d, i) =>
        `<option value="${i}" ${only === String(i) ? 'selected' : ''}>Day ${i + 1}${d.title ? ' · ' + esc(d.title) : ''}</option>`).join('')}</select></div>
    <div class="legend" data-legend></div>
    <div class="sheet" hidden><button class="close">×</button><div class="body"></div></div></div>`;
  const map = await createMap(view.querySelector('.map'));

  const points = { type: 'FeatureCollection', features: [] };
  const lines = { type: 'FeatureCollection', features: [] };
  const shown = [];
  trip.days.forEach((d, i) => {
    if (only !== null && only !== '' && String(i) !== only) return;
    const color = DAY_COLORS[i % DAY_COLORS.length];
    const coords = [];
    d.stops.forEach((sid, j) => {
      const p = byId.get(sid);
      if (!p || p.lat == null) return;
      shown.push(p);
      coords.push([p.lon, p.lat]);
      points.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: { id: p.id, label: `${i + 1}.${j + 1}`, color, name: p.name } });
    });
    if (coords.length > 1) lines.features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: { color } });
  });
  map.addSource('route', { type: 'geojson', data: lines });
  map.addLayer({ id: 'route', type: 'line', source: 'route',
    paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.8, 'line-dasharray': [2, 1] } });
  map.addSource('stops', { type: 'geojson', data: points });
  map.addLayer({ id: 'stops', type: 'circle', source: 'stops',
    paint: { 'circle-color': ['get', 'color'], 'circle-radius': 11, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
  // Stop numbers as HTML markers: no font download needed (works offline).
  for (const f of points.features) {
    const el = document.createElement('div');
    el.textContent = f.properties.label.split('.')[1];
    el.style.cssText = 'color:#fff;font:600 11px system-ui;pointer-events:none';
    new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates).addTo(map);
  }
  fitTo(map, shown, 14);

  const sheet = view.querySelector('.sheet');
  sheet.querySelector('.close').addEventListener('click', () => { sheet.hidden = true; });
  map.on('click', 'stops', async e => {
    const p = await getPlace(e.features[0].properties.id);
    sheet.hidden = false;
    await renderPlaceCard(sheet.querySelector('.body'), p, { compact: true });
  });
  map.on('mouseenter', 'stops', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'stops', () => { map.getCanvas().style.cursor = ''; });

  view.querySelector('[data-legend]').innerHTML = trip.days.map((d, i) =>
    `<div><span class="dot" style="background:${DAY_COLORS[i % DAY_COLORS.length]}"></span>
      Day ${i + 1}${trip.start ? ' ' + fmtDate(addDays(trip.start, i)) : ''}${d.title ? ' · ' + esc(d.title) : ''} (${d.stops.length})</div>`).join('');
  view.querySelector('[data-day]').addEventListener('change', e => {
    location.hash = `#/trip/${trip.id}/map${e.target.value !== '' ? '?day=' + e.target.value : ''}`;
  });
  return () => map.remove();
}
