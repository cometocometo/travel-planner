// Map factory. Uses an offline .pmtiles file stored on this device when present,
// otherwise the free OpenFreeMap online style (viewed tiles are cached by the service worker).
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol, PMTiles, FileSource } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import { TYPE_COLORS, esc } from './util.js';

const ONLINE_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ASSETS = 'https://protomaps.github.io/basemaps-assets';
const OFFLINE_NAME = 'offline.pmtiles';
const BLANK_STYLE = { version: 8, sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9e5dc' } }] };

const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);
let offlineKey = null;

// ---- Offline map file in the Origin Private File System -------------------------------
export async function saveOfflineMap(file, onProgress = () => {}) {
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(OFFLINE_NAME, { create: true });
  const w = await handle.createWritable();
  const reader = file.stream().getReader();
  let done = 0;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    await w.write(value);
    done += value.length;
    onProgress(done, file.size);
  }
  await w.close();
  offlineKey = null;
}
export async function offlineMapFile() {
  try {
    const root = await navigator.storage.getDirectory();
    const f = await (await root.getFileHandle(OFFLINE_NAME)).getFile();
    return f.size > 0 ? f : null;
  } catch { return null; }
}
export async function deleteOfflineMap() {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(OFFLINE_NAME).catch(() => {});
  offlineKey = null;
}
// Fetch label fonts and icons once while online, so offline labels work (cached by the service worker).
export async function prefetchOfflineAssets() {
  const ranges = ['0-255', '256-511', '512-767', '7680-7935', '8192-8447'];
  const fonts = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];
  const urls = [`${ASSETS}/sprites/v4/light.json`, `${ASSETS}/sprites/v4/light.png`,
    `${ASSETS}/sprites/v4/light@2x.json`, `${ASSETS}/sprites/v4/light@2x.png`];
  for (const f of fonts) for (const r of ranges) urls.push(`${ASSETS}/fonts/${encodeURIComponent(f)}/${r}.pbf`);
  let ok = 0;
  await Promise.all(urls.map(u => fetch(u).then(r => { if (r.ok) ok++; }).catch(() => {})));
  return { ok, total: urls.length };
}

async function styleFor() {
  const file = await offlineMapFile();
  if (file) {
    if (!offlineKey) {
      const src = new FileSource(file);
      protocol.add(new PMTiles(src));
      offlineKey = src.getKey();
    }
    const dark = matchMedia('(prefers-color-scheme: dark)').matches &&
      document.documentElement.dataset.theme !== 'light';
    const flavor = dark ? 'dark' : 'light';
    return {
      version: 8,
      glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
      sprite: `${ASSETS}/sprites/v4/${flavor}`,
      sources: { protomaps: { type: 'vector', url: `pmtiles://${offlineKey}`, attribution: '© OpenStreetMap' } },
      layers: layers('protomaps', namedFlavor(flavor), { lang: 'en' }),
    };
  }
  return ONLINE_STYLE;
}

export async function createMap(container, { center = [105, 33], zoom = 3.3 } = {}) {
  const map = new maplibregl.Map({
    container, style: await styleFor(), center, zoom,
    attributionControl: { compact: true },
    // Chinese / Japanese / Korean labels use the phone's own fonts: no download needed offline.
    localIdeographFontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'bottom-right');
  map.on('error', e => {
    if (!navigator.onLine && !map._noticeShown) {
      map._noticeShown = true;
      const n = document.createElement('div');
      n.className = 'notice';
      n.innerHTML = 'You are offline and this area has no saved map.<br>Your places still show. Add an offline map in Settings.';
      container.appendChild(n);
      setTimeout(() => n.remove(), 6000);
    }
    console.warn('map error', e.error?.message || e);
  });
  // Wait for the style only (not the tiles), so pins show even on a slow or missing connection.
  // If the style cannot load (offline, no saved map), fall back to a plain background.
  await new Promise(resolve => {
    if (map.isStyleLoaded()) return resolve();
    const timer = setTimeout(() => {
      map.setStyle(BLANK_STYLE);
      map.once('style.load', resolve);
    }, 8000);
    map.once('style.load', () => { clearTimeout(timer); resolve(); });
  });
  return map;
}

// GeoJSON point features for places.
export function toFeatures(places, extra = () => ({})) {
  return {
    type: 'FeatureCollection',
    features: places.filter(p => p.lat != null).map(p => ({
      type: 'Feature', id: undefined,
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { id: p.id, name: p.name, zh: p.name_zh || '', type: p.type,
        color: TYPE_COLORS[p.type] || '#555', approx: p.needs_location ? 1 : 0, ...extra(p) },
    })),
  };
}

// Clustered place layer. onClick(id) when a single place is tapped.
export function addPlaceLayer(map, data, onClick) {
  map.addSource('places', { type: 'geojson', data, cluster: true, clusterRadius: 45, clusterMaxZoom: 13 });
  map.addLayer({ id: 'clusters', type: 'circle', source: 'places', filter: ['has', 'point_count'],
    paint: { 'circle-color': '#c0392b', 'circle-opacity': 0.85,
      'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24, 500, 30],
      'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
  const glyphs = map.getStyle().glyphs;
  if (glyphs) {  // the plain fallback style has no fonts: show clusters without numbers
    map.addLayer({ id: 'cluster-count', type: 'symbol', source: 'places', filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12,
        'text-font': glyphs.includes('protomaps') ? ['Noto Sans Medium'] : ['Noto Sans Bold'] },
      paint: { 'text-color': '#fff' } });
  }
  map.addLayer({ id: 'place', type: 'circle', source: 'places', filter: ['!', ['has', 'point_count']],
    paint: { 'circle-color': ['get', 'color'], 'circle-radius': 7,
      'circle-stroke-width': ['case', ['==', ['get', 'approx'], 1], 2.5, 1.5],
      'circle-stroke-color': ['case', ['==', ['get', 'approx'], 1], '#000', '#fff'] } });
  map.on('click', 'clusters', async e => {
    const f = e.features[0];
    const z = await map.getSource('places').getClusterExpansionZoom(f.properties.cluster_id);
    map.easeTo({ center: f.geometry.coordinates, zoom: z });
  });
  map.on('click', 'place', e => onClick(e.features[0].properties.id));
  for (const l of ['clusters', 'place']) {
    map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
  }
  const popup = new maplibregl.Popup({ closeButton: false, offset: 10 });
  map.on('mouseenter', 'place', e => {
    const p = e.features[0].properties;
    popup.setLngLat(e.features[0].geometry.coordinates).setHTML(`${esc(p.name)} ${esc(p.zh)}`).addTo(map);
  });
  map.on('mouseleave', 'place', () => popup.remove());
}

export function fitTo(map, places, maxZoom = 13) {
  const pts = places.filter(p => p.lat != null);
  if (!pts.length) return;
  const b = new maplibregl.LngLatBounds();
  pts.forEach(p => b.extend([p.lon, p.lat]));
  map.fitBounds(b, { padding: 50, maxZoom, duration: 0 });
}

export { maplibregl };
