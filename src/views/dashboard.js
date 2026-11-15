import { allPlaces, allUser, allTrips, getMeta } from '../db.js';
import { esc, fmtDate, addDays, placeLine } from '../util.js';

export async function dashboard(view) {
  const [places, user, trips, imp] = await Promise.all([allPlaces(), allUser(), allTrips(), getMeta('import')]);
  if (!places.length) {
    view.innerHTML = `<div class="page"><h1>World Travel Planner</h1>
      <div class="card"><b>No places on this device yet.</b><br>
      Go to <a href="#/settings">Settings</a> and import your data file (<code>travel-bundle.private.json</code>).</div>
      <p class="muted small">Your data stays on this device. Nothing is uploaded.</p></div>`;
    return;
  }
  const byId = new Map(places.map(p => [p.id, p]));
  const counts = { want: 0, visited: 0, skip: 0, notes: 0 };
  for (const u of user.values()) { if (u.status) counts[u.status]++; if (u.note) counts.notes++; }
  const countries = {};
  for (const p of places) countries[p.country || '—'] = (countries[p.country || '—'] || 0) + 1;
  const today = new Date().toISOString().slice(0, 10);
  const shortlist = [...user.values()].filter(u => u.status === 'want' && byId.has(u.id))
    .sort((a, b) => (b.updated || '').localeCompare(a.updated || '')).slice(0, 15);

  const tripCard = t => {
    const stops = t.days.reduce((n, d) => n + d.stops.length, 0);
    const end = t.start ? addDays(t.start, t.days.length - 1) : '';
    const soon = t.start && t.start >= today ? Math.round((new Date(t.start) - new Date(today)) / 864e5) : null;
    return `<div class="card"><div class="row"><a href="#/trip/${t.id}"><b>${esc(t.name)}</b></a><span class="spacer"></span>
      ${soon != null ? `<span class="pill">in ${soon} days</span>` : ''}</div>
      <div class="small muted">${t.start ? `${fmtDate(t.start)} – ${fmtDate(end)} · ` : ''}${t.days.length} days · ${stops} stops</div>
      <div class="row small" style="margin-top:6px"><a href="#/trip/${t.id}">Plan</a> · <a href="#/trip/${t.id}/map">Map</a> · <a href="#/trip/${t.id}/summary">Summary</a></div></div>`;
  };

  view.innerHTML = `<div class="page">
    <h1>World Travel Planner</h1>
    <h2>Trips</h2>
    ${trips.length ? trips.map(tripCard).join('') : '<p class="empty">No trips yet.</p>'}
    <a class="btn primary" href="#/trips?new=1">+ New trip</a>
    <h2>Your places</h2>
    <div class="grid">
      <div class="stat"><b>${places.length.toLocaleString()}</b>places</div>
      <div class="stat"><b>${Object.keys(countries).length}</b>countries</div>
      <div class="stat"><b>${counts.want}</b>want to go</div>
      <div class="stat"><b>${counts.visited}</b>visited</div>
      <div class="stat"><b>${counts.notes}</b>my notes</div>
    </div>
    <h2>Shortlist (want to go)</h2>
    ${shortlist.length ? `<ul class="list">${shortlist.map(u => { const p = byId.get(u.id); return `
      <li><a class="grow" href="#/place/${encodeURIComponent(p.id)}">${esc(p.name)} ${p.name_zh ? `<span class="zh">${esc(p.name_zh)}</span>` : ''}
      <div class="small muted">${esc(placeLine(p))}</div></a></li>`; }).join('')}</ul>`
      : '<p class="empty">Mark places "Want to go" and they show here.</p>'}
    <h2>Countries</h2>
    <ul class="list">${Object.entries(countries).sort((a, b) => b[1] - a[1]).map(([c, n]) =>
      `<li><a class="grow" href="#/browse/${encodeURIComponent(c)}">${esc(c)}</a><span class="muted">${n}</span></li>`).join('')}</ul>
    <p class="small muted">Data from ${imp?.built ? esc(imp.built.slice(0, 10)) : '?'} · imported ${imp?.imported ? esc(imp.imported.slice(0, 10)) : '?'}</p>
  </div>`;
}
