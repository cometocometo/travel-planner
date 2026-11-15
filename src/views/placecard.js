// Full place details: facts, the book's text or your My Maps note, your status and note,
// and "add to trip". Used by the map sheet and the place page.
import { getText, getUser, setUser, getMeta, allTrips, saveTrip } from '../db.js';
import { esc, linkify, STATUS, TYPE_LABELS, fmtDate, addDays } from '../util.js';

export async function renderPlaceCard(el, p, { compact = false } = {}) {
  const [text, user, mapNotes, trips] = await Promise.all([
    getText(p.id), getUser(p.id), getMeta('mapNotes'), allTrips()]);
  const u = user || {};
  const loc = [p.area, p.city !== p.region ? p.city : null, p.region, p.province, p.country]
    .filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' · ');
  const src = p.source?.type === 'book'
    ? `Lonely Planet China${p.subtype ? ' · ' + esc(p.subtype.toLowerCase()) : ''}${p.price_level ? ' · ' + esc(p.price_level) : ''}${p.top_choice ? ' · ★ top choice' : ''}`
    : `My Maps: ${esc(p.source?.map || '')}${p.layer ? ' / ' + esc(p.layer) : ''}`;
  const fact = (k, v) => (v ? `<div><b>${k}:</b> ${linkify(v)}</div>` : '');

  let html = `
    <h2 style="margin:0 28px 2px 0">${esc(p.name)}</h2>
    ${p.name_zh ? `<div class="zh" style="font-size:22px">${esc(p.name_zh)}</div>` : ''}
    ${p.pinyin ? `<div class="muted small">${esc(p.pinyin)}</div>` : ''}
    <div class="muted small">${src}<br>${esc(loc)}</div>
    <div class="row" style="margin:10px 0">
      <span class="seg">${Object.entries(STATUS).map(([k, v]) =>
        `<button data-status="${k}" class="${u.status === k ? 'on' : ''}">${v}</button>`).join('')}</span>
    </div>
    <div style="margin:6px 0">${fact('Address', p.address)}${fact('Hours', p.hours)}${fact('Price', p.price)}
      ${fact('Phone', p.phone)}${fact('Website', p.website)}${fact('Email', p.email)}
      ${fact('Metro', p.metro)}${fact('Bus', p.bus)}${(p.other || []).map(o => `<div>${linkify(o)}</div>`).join('')}</div>
    ${p.needs_location ? `<div class="warn small">The pin is only the city centre. The exact place is not located yet.</div>` : ''}
    ${p.check ? `<div class="warn small">Check: ${esc(p.check)}</div>` : ''}
    <h3>My note</h3>
    <textarea data-mynote placeholder="Your own note (saved on this device)">${esc(u.note || '')}</textarea>
    <div class="small muted" data-saved></div>`;

  if (p.source?.type === 'book') {
    html += `<h3>What the book says</h3>` + (text?.book
      ? `<div class="text">${esc(text.book)}</div>` : `<div class="empty">No description in the book.</div>`);
    if (p.source.chapter) html += `<p class="small"><a href="#/guide/${esc(p.source.chapter)}${p.source.anchor
      ? '?a=' + encodeURIComponent(p.source.anchor) : ''}">Read it in the book chapter ›</a></p>`;
  } else {
    html += `<h3>My Maps note</h3>` + (text?.note
      ? `<div class="text">${linkify(text.note)}</div>` : `<div class="empty">No note on this place in My Maps.</div>`);
    const mn = mapNotes?.[p.source?.map];
    if (mn) html += `<h3>Note on the "${esc(p.source.map)}" map</h3><div class="text small">${linkify(mn)}</div>`;
  }

  html += `<h3>Add to a trip</h3>` + (trips.length ? `
    <div class="row">
      <select data-trip>${trips.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
      <select data-day></select>
      <button class="primary" data-add>Add</button>
    </div>
    <div class="small" data-addmsg></div>
    ${tripUses(trips, p.id)}`
    : `<div class="small muted">No trips yet. <a href="#/trips">Create a trip</a> first.</div>`);
  if (compact) html += `<p><a href="#/place/${encodeURIComponent(p.id)}">Open full page →</a></p>`;
  el.innerHTML = html;

  // Status
  el.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', async () => {
    const s = b.dataset.status === u.status ? null : b.dataset.status;
    u.status = s;
    await setUser(p.id, { status: s });
    el.querySelectorAll('[data-status]').forEach(x => x.classList.toggle('on', x.dataset.status === s));
  }));
  // Note autosave
  const ta = el.querySelector('[data-mynote]');
  let timer;
  ta.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await setUser(p.id, { note: ta.value });
      el.querySelector('[data-saved]').textContent = 'Saved.';
    }, 500);
  });
  // Add to trip
  const tripSel = el.querySelector('[data-trip]');
  if (tripSel) {
    const daySel = el.querySelector('[data-day]');
    const fillDays = () => {
      const t = trips.find(x => x.id === tripSel.value);
      daySel.innerHTML = t.days.map((d, i) =>
        `<option value="${i}">Day ${i + 1}${t.start ? ' · ' + fmtDate(addDays(t.start, i)) : ''}</option>`).join('')
        + `<option value="new">+ New day</option>`;
    };
    tripSel.addEventListener('change', fillDays);
    fillDays();
    el.querySelector('[data-add]').addEventListener('click', async () => {
      const t = trips.find(x => x.id === tripSel.value);
      let i = daySel.value === 'new' ? t.days.push({ id: crypto.randomUUID(), note: '', stops: [] }) - 1 : +daySel.value;
      if (!t.days[i].stops.includes(p.id)) t.days[i].stops.push(p.id);
      await saveTrip(t);
      el.querySelector('[data-addmsg]').innerHTML =
        `Added to <a href="#/trip/${t.id}">${esc(t.name)}</a>, day ${i + 1}.`;
      fillDays();
      daySel.value = String(i);
    });
  }
}

function tripUses(trips, id) {
  const uses = [];
  for (const t of trips) t.days.forEach((d, i) => { if (d.stops.includes(id)) uses.push(`<a href="#/trip/${t.id}">${esc(t.name)}</a> day ${i + 1}`); });
  return uses.length ? `<div class="small muted" style="margin-top:4px">In: ${uses.join(', ')}</div>` : '';
}

export { TYPE_LABELS };
