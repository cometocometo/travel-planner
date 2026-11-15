import { importBundle, exportBackup, importBackup, getMeta, allTrips } from '../db.js';
import { saveOfflineMap, offlineMapFile, deleteOfflineMap, prefetchOfflineAssets } from '../map.js';
import { esc, download, pickFile } from '../util.js';

const mb = n => (n / 1048576).toFixed(n > 1e9 ? 0 : 1) + ' MB';

export async function settings(view) {
  const [imp, offline, est, persisted, trips] = await Promise.all([
    getMeta('import'), offlineMapFile(), navigator.storage?.estimate?.(), navigator.storage?.persisted?.(), allTrips()]);
  view.innerHTML = `<div class="page">
    <h1>Settings</h1>

    <h2>1. Your data (places, book text, My Maps notes)</h2>
    <p class="small muted">${imp ? `${imp.count.toLocaleString()} places on this device · built ${esc((imp.built || '').slice(0, 10))} · imported ${esc(imp.imported.slice(0, 10))}` : 'No data yet.'}</p>
    <button class="primary" data-import>Import data file…</button>
    <div class="small" data-impmsg></div>
    <p class="small muted">Pick <code>travel-bundle.private.json</code>. Importing again replaces the places,
      but keeps your trips, statuses and notes.</p>

    <h2>2. Backup of your trips and notes</h2>
    <p class="small muted">${trips.length} trips. Export a backup before big changes, and to move your plans to another device.</p>
    <div class="row"><button data-backup>Export backup</button><button data-restore>Restore backup…</button></div>
    <div class="small" data-bmsg></div>

    <h2>3. Offline map</h2>
    <p class="small muted">${offline ? `Offline map on this device: ${mb(offline.size)}.` : 'No offline map yet. Without it, the map shows only areas you viewed while online.'}</p>
    <div class="row"><button data-offline>${offline ? 'Replace' : 'Add'} offline map file (.pmtiles)…</button>
      ${offline ? '<button data-deloffline>Remove</button>' : ''}</div>
    <div class="small" data-omsg></div>
    <p class="small muted">Do this at home on Wi-Fi, before you travel. China blocks Google, so set everything up before you go.</p>

    <h2>Storage</h2>
    <p class="small muted">${est ? `Used ${mb(est.usage)} of about ${mb(est.quota)}.` : ''}
      ${persisted ? 'Protected from automatic clearing.' : 'Not yet protected from automatic clearing (install the app to the home screen).'}</p>
  </div>`;

  const $ = s => view.querySelector(s);
  $('[data-import]').addEventListener('click', async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    const msg = $('[data-impmsg]');
    try {
      msg.textContent = 'Reading…';
      const bundle = JSON.parse(await f.text());
      await importBundle(bundle, (n, total) => { msg.textContent = `Importing ${n} / ${total}…`; });
      msg.innerHTML = `Done: ${bundle.places.length.toLocaleString()} places. <a href="#/">Go to Home</a>`;
    } catch (e) { msg.innerHTML = `<span class="warn">${esc(e.message)}</span>`; }
  });
  $('[data-backup]').addEventListener('click', async () => {
    const b = await exportBackup();
    download(`travel-backup-${b.exported.slice(0, 10)}.json`, JSON.stringify(b, null, 1));
    $('[data-bmsg]').textContent = `Exported ${b.trips.length} trips and ${b.user.length} place statuses/notes.`;
  });
  $('[data-restore]').addEventListener('click', async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try {
      const r = await importBackup(JSON.parse(await f.text()));
      $('[data-bmsg]').textContent = `Restored ${r.trips} trips and ${r.user} place statuses/notes.`;
    } catch (e) { $('[data-bmsg]').innerHTML = `<span class="warn">${esc(e.message)}</span>`; }
  });
  $('[data-offline]').addEventListener('click', async () => {
    const f = await pickFile('.pmtiles');
    if (!f) return;
    const msg = $('[data-omsg]');
    try {
      await saveOfflineMap(f, (n, t) => { msg.textContent = `Saving ${mb(n)} / ${mb(t)}…`; });
      msg.textContent = 'Saved. Fetching label fonts…';
      const r = navigator.onLine ? await prefetchOfflineAssets() : { ok: 0, total: 0 };
      msg.textContent = `Offline map ready (${mb(f.size)}). Label files: ${r.ok}/${r.total}.`;
    } catch (e) { msg.innerHTML = `<span class="warn">${esc(e.message)}</span>`; }
  });
  $('[data-deloffline]')?.addEventListener('click', async () => {
    if (!confirm('Remove the offline map from this device?')) return;
    await deleteOfflineMap();
    settings(view.replaceChildren() || view);
  });
}
