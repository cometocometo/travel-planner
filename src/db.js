// All data lives on this device in IndexedDB.
//   places : shared facts (from the data bundle)          key: id
//   texts  : private long text per place {book, note}     key: id
//   user   : your status / note per place                 key: id (place id)
//   trips  : your trips                                    key: id
//   meta   : key/value (import info, map notes)
import { openDB } from 'idb';

const dbp = openDB('travel-planner', 1, {
  upgrade(db) {
    const places = db.createObjectStore('places', { keyPath: 'id' });
    places.createIndex('country', 'country');
    db.createObjectStore('texts', { keyPath: 'id' });
    db.createObjectStore('user', { keyPath: 'id' });
    db.createObjectStore('trips', { keyPath: 'id' });
    db.createObjectStore('meta');
  },
});

let placeCache = null;

export async function allPlaces() {
  if (!placeCache) placeCache = await (await dbp).getAll('places');
  return placeCache;
}
export async function placeMap() {
  return new Map((await allPlaces()).map(p => [p.id, p]));
}
export async function getPlace(id) { return (await dbp).get('places', id); }
export async function getText(id) { return (await dbp).get('texts', id); }

export async function getMeta(key) { return (await dbp).get('meta', key); }
export async function setMeta(key, value) { return (await dbp).put('meta', value, key); }

export async function getUser(id) { return (await dbp).get('user', id); }
export async function allUser() {
  return new Map((await (await dbp).getAll('user')).map(u => [u.id, u]));
}
export async function setUser(id, patch) {
  const db = await dbp;
  const cur = (await db.get('user', id)) || { id };
  const next = { ...cur, ...patch, updated: new Date().toISOString() };
  await db.put('user', next);
  return next;
}

export async function allTrips() {
  const t = await (await dbp).getAll('trips');
  return t.sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999') || a.name.localeCompare(b.name));
}
export async function getTrip(id) { return (await dbp).get('trips', id); }
export async function saveTrip(trip) {
  trip.updated = new Date().toISOString();
  await (await dbp).put('trips', trip);
  return trip;
}
export async function deleteTrip(id) { return (await dbp).delete('trips', id); }

// Replace all places and texts with a data bundle. Your status, notes and trips are kept.
export async function importBundle(bundle, onProgress = () => {}) {
  if (!bundle || !Array.isArray(bundle.places)) throw new Error('Not a travel data bundle (no "places" list).');
  const db = await dbp;
  await db.clear('places');
  await db.clear('texts');
  const chunk = 1000;
  for (let i = 0; i < bundle.places.length; i += chunk) {
    const tx = db.transaction(['places', 'texts'], 'readwrite');
    for (const p of bundle.places.slice(i, i + chunk)) {
      tx.objectStore('places').put(p);
      const t = bundle.texts && bundle.texts[p.id];
      if (t) tx.objectStore('texts').put({ id: p.id, ...t });
    }
    await tx.done;
    onProgress(Math.min(i + chunk, bundle.places.length), bundle.places.length);
  }
  await setMeta('mapNotes', bundle.mapNotes || {});
  await setMeta('import', { built: bundle.built, imported: new Date().toISOString(), count: bundle.places.length });
  placeCache = null;
}

// Backup = everything you made (status, notes, trips). Not the book or map data.
export async function exportBackup() {
  const db = await dbp;
  return { kind: 'travel-planner-backup', version: 1, exported: new Date().toISOString(),
    user: await db.getAll('user'), trips: await db.getAll('trips') };
}
export async function importBackup(b) {
  if (!b || b.kind !== 'travel-planner-backup') throw new Error('Not a travel planner backup file.');
  const db = await dbp;
  const tx = db.transaction(['user', 'trips'], 'readwrite');
  for (const u of b.user || []) tx.objectStore('user').put(u);
  for (const t of b.trips || []) tx.objectStore('trips').put(t);
  await tx.done;
  return { user: (b.user || []).length, trips: (b.trips || []).length };
}
