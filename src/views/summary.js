// Day-by-day trip summary: readable offline, printable, local-script names to show drivers.
import { getTrip, placeMap, allUser, getText } from '../db.js';
import { esc, linkify, fmtDate, addDays, DAY_COLORS } from '../util.js';

export async function tripSummary(view, [id], params) {
  const trip = await getTrip(id);
  if (!trip) { view.innerHTML = '<div class="page"><h1>Trip not found</h1></div>'; return; }
  const [byId, user] = await Promise.all([placeMap(), allUser()]);
  const withBook = params.get('book') === '1';
  const texts = {};
  if (withBook) for (const d of trip.days) for (const s of d.stops) texts[s] = await getText(s);
  const stops = trip.days.reduce((n, d) => n + d.stops.length, 0);
  const end = trip.start ? addDays(trip.start, trip.days.length - 1) : '';

  const stopHtml = (sid, j, color) => {
    const p = byId.get(sid);
    if (!p) return `<div class="sum-stop warn">Missing place ${esc(sid)}</div>`;
    const u = user.get(sid) || {};
    const t = texts[sid];
    return `<div class="sum-stop" style="border-color:${color}">
      <b>${j + 1}. ${esc(p.name)}</b> ${p.name_zh ? `<span class="zh">${esc(p.name_zh)}</span>` : ''}
      ${p.address ? `<div>${esc(p.address)}</div>` : ''}
      <div class="small muted">${[p.hours && 'Hours: ' + esc(p.hours), p.price && 'Price: ' + esc(p.price),
        p.phone && 'Tel: ' + esc(p.phone), p.metro && 'Metro: ' + esc(p.metro)].filter(Boolean).join(' · ')}</div>
      ${u.note ? `<div class="text"><b>My note:</b> ${linkify(u.note)}</div>` : ''}
      ${withBook && t?.book ? `<div class="text small">${esc(t.book)}</div>` : ''}
      ${withBook && t?.note ? `<div class="text small"><b>My Maps:</b> ${linkify(t.note)}</div>` : ''}
    </div>`;
  };

  view.innerHTML = `<div class="page">
    <div class="row noprint"><a href="#/trip/${trip.id}">‹ Back to plan</a><span class="spacer"></span>
      <label class="small"><input type="checkbox" data-book ${withBook ? 'checked' : ''}> Include book text &amp; My Maps notes</label>
      <button data-print>Print / PDF</button></div>
    <h1>${esc(trip.name)}</h1>
    <p class="muted">${trip.start ? `${fmtDate(trip.start)} – ${fmtDate(end)} · ` : ''}${trip.days.length} days · ${stops} stops</p>
    ${trip.note ? `<div class="card text">${linkify(trip.note)}</div>` : ''}
    <h2>Overview</h2>
    <ul class="list">${trip.days.map((d, i) => `<li><span class="dot" style="background:${DAY_COLORS[i % DAY_COLORS.length]}"></span>
      <span class="grow"><b>Day ${i + 1}</b> ${trip.start ? fmtDate(addDays(trip.start, i)) : ''} ${d.title ? '· ' + esc(d.title) : ''}
      <div class="small muted">${d.stops.map(s => esc(byId.get(s)?.name || '?')).join(' → ') || 'free day'}</div></span></li>`).join('')}</ul>
    ${trip.days.map((d, i) => {
      const color = DAY_COLORS[i % DAY_COLORS.length];
      return `<section class="sum-day"><h2 style="color:${color}">Day ${i + 1}${trip.start ? ' · ' + fmtDate(addDays(trip.start, i)) : ''}${d.title ? ' · ' + esc(d.title) : ''}</h2>
        ${d.note ? `<div class="text">${linkify(d.note)}</div>` : ''}
        ${d.stops.map((s, j) => stopHtml(s, j, color)).join('') || '<p class="empty">No stops.</p>'}</section>`;
    }).join('')}
  </div>`;
  view.querySelector('[data-print]').addEventListener('click', () => print());
  view.querySelector('[data-book]').addEventListener('change', e => {
    location.hash = `#/trip/${trip.id}/summary${e.target.checked ? '?book=1' : ''}`;
  });
}
