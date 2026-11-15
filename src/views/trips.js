import { allTrips, getTrip, saveTrip, deleteTrip, placeMap, allPlaces } from '../db.js';
import { esc, fold, fmtDate, addDays, uid, DAY_COLORS, km, placeLine } from '../util.js';

const newDay = () => ({ id: uid(), title: '', note: '', stops: [] });

export async function tripsList(view, _a, params) {
  const trips = await allTrips();
  view.innerHTML = `<div class="page">
    <h1>Trips</h1>
    <form class="card" data-new ${params.get('new') ? '' : 'hidden'}>
      <h3 style="margin-top:0">New trip</h3>
      <div class="row"><input name="name" placeholder="Trip name, e.g. China 2027" required class="wide"></div>
      <div class="row" style="margin-top:8px">
        <label>Start date <input type="date" name="start"></label>
        <label>Days <input type="number" name="days" value="7" min="1" max="120" style="width:70px"></label>
        <button class="primary">Create</button>
      </div>
    </form>
    <button class="primary" data-show ${params.get('new') ? 'hidden' : ''}>+ New trip</button>
    <ul class="list" style="margin-top:12px">${trips.map(t => {
      const stops = t.days.reduce((n, d) => n + d.stops.length, 0);
      return `<li><a class="grow" href="#/trip/${t.id}"><b>${esc(t.name)}</b>
        <div class="small muted">${t.start ? fmtDate(t.start) + ' · ' : ''}${t.days.length} days · ${stops} stops</div></a>
        <a href="#/trip/${t.id}/map" class="small">Map</a> <a href="#/trip/${t.id}/summary" class="small">Summary</a></li>`;
    }).join('') || '<li class="empty">No trips yet.</li>'}</ul></div>`;
  const form = view.querySelector('[data-new]');
  view.querySelector('[data-show]').addEventListener('click', e => { form.hidden = false; e.target.hidden = true; form.name.focus(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const n = Math.max(1, Math.min(120, +form.days.value || 1));
    const t = { id: uid(), name: form.name.value.trim(), start: form.start.value || '', note: '',
      days: Array.from({ length: n }, newDay), created: new Date().toISOString() };
    await saveTrip(t);
    location.hash = `#/trip/${t.id}`;
  });
}

export async function tripEdit(view, [id]) {
  const trip = await getTrip(id);
  if (!trip) { view.innerHTML = '<div class="page"><h1>Trip not found</h1></div>'; return; }
  const byId = await placeMap();
  const places = await allPlaces();
  let openSearch = null; // index of the day whose search box is open

  const save = () => saveTrip(trip);
  const render = () => {
    const countries = new Set();
    trip.days.forEach(d => d.stops.forEach(s => byId.get(s)?.country && countries.add(byId.get(s).country)));
    view.innerHTML = `<div class="page">
      <div class="crumbs"><a href="#/trips">Trips</a></div>
      <input class="wide" data-name value="${esc(trip.name)}" style="font-size:20px;font-weight:600">
      <div class="row" style="margin-top:8px">
        <label class="small">Start <input type="date" data-start value="${esc(trip.start)}"></label>
        <span class="spacer"></span>
        <a class="btn" href="#/trip/${trip.id}/map">Trip map</a>
        <a class="btn" href="#/trip/${trip.id}/summary">Summary</a>
      </div>
      <textarea data-tnote placeholder="Trip notes (flights, visas, bookings…)" style="margin-top:8px">${esc(trip.note || '')}</textarea>
      ${trip.days.map((d, i) => dayHtml(d, i)).join('')}
      <div class="row"><button data-addday>+ Add day</button><span class="spacer"></span>
        <button data-del class="small">Delete trip</button></div>
    </div>`;
    wire();
    if (openSearch != null) view.querySelector(`[data-sq="${openSearch}"]`)?.focus();
  };

  const dayHtml = (d, i) => {
    const color = DAY_COLORS[i % DAY_COLORS.length];
    let prev = null;
    const stops = d.stops.map((sid, j) => {
      const p = byId.get(sid);
      const dist = p && prev && p.lat != null && prev.lat != null ? km([prev.lon, prev.lat], [p.lon, p.lat]) : null;
      prev = p || prev;
      return `<div class="stop">
        <span class="num" style="background:${color}">${j + 1}</span>
        ${p ? `<a href="#/place/${encodeURIComponent(sid)}">${esc(p.name)} ${p.name_zh ? `<span class="zh">${esc(p.name_zh)}</span>` : ''}
          <div class="small muted">${esc(placeLine(p))}${dist != null ? ` · ${dist < 1 ? Math.round(dist * 1000) + ' m' : dist.toFixed(1) + ' km'} from previous` : ''}${p.needs_location ? ' · <span class="warn">location approximate</span>' : ''}</div></a>`
          : `<span class="warn" style="flex:1">Missing place (${esc(sid)})</span>`}
        <button class="small" data-up="${i}:${j}" ${j === 0 ? 'disabled' : ''} title="Move up">↑</button>
        <button class="small" data-down="${i}:${j}" ${j === d.stops.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
        <select class="small" data-move="${i}:${j}" title="Move to day"><option value="">Day…</option>${trip.days.map((_, k) => k === i ? '' : `<option value="${k}">Day ${k + 1}</option>`).join('')}</select>
        <button class="small" data-rm="${i}:${j}" title="Remove">✕</button>
      </div>`;
    }).join('');
    return `<section class="day">
      <header><span class="dot" style="background:${color}"></span>
        <b>Day ${i + 1}</b><span class="muted small">${trip.start ? fmtDate(addDays(trip.start, i)) : ''}</span>
        <input data-dtitle="${i}" value="${esc(d.title || '')}" placeholder="Title, e.g. Beijing" style="flex:1;min-width:120px">
        <button class="small" data-dup="${i}" ${i === 0 ? 'disabled' : ''} title="Move day earlier">↑</button>
        <button class="small" data-ddown="${i}" ${i === trip.days.length - 1 ? 'disabled' : ''} title="Move day later">↓</button>
        <button class="small" data-drm="${i}" title="Delete day">✕</button>
      </header>
      <div class="body">
        ${stops || '<div class="empty small">No stops yet.</div>'}
        <textarea data-dnote="${i}" placeholder="Day note (transport, tickets, where to sleep…)" style="margin-top:8px;min-height:50px">${esc(d.note || '')}</textarea>
        <input type="search" data-sq="${i}" placeholder="+ Add a place: search name / 中文 / pinyin" class="wide" style="margin-top:6px">
        <div class="results" data-res="${i}" hidden></div>
      </div></section>`;
  };

  const pair = s => s.split(':').map(Number);
  const wire = () => {
    const q = sel => view.querySelectorAll(sel);
    view.querySelector('[data-name]').addEventListener('change', e => { trip.name = e.target.value.trim() || trip.name; save(); });
    view.querySelector('[data-start]').addEventListener('change', e => { trip.start = e.target.value; save().then(render); });
    view.querySelector('[data-tnote]').addEventListener('change', e => { trip.note = e.target.value; save(); });
    q('[data-dtitle]').forEach(x => x.addEventListener('change', () => { trip.days[+x.dataset.dtitle].title = x.value; save(); }));
    q('[data-dnote]').forEach(x => x.addEventListener('change', () => { trip.days[+x.dataset.dnote].note = x.value; save(); }));
    const swap = (arr, a, b) => { [arr[a], arr[b]] = [arr[b], arr[a]]; };
    q('[data-up]').forEach(b => b.addEventListener('click', () => { const [i, j] = pair(b.dataset.up); swap(trip.days[i].stops, j, j - 1); save().then(render); }));
    q('[data-down]').forEach(b => b.addEventListener('click', () => { const [i, j] = pair(b.dataset.down); swap(trip.days[i].stops, j, j + 1); save().then(render); }));
    q('[data-rm]').forEach(b => b.addEventListener('click', () => { const [i, j] = pair(b.dataset.rm); trip.days[i].stops.splice(j, 1); save().then(render); }));
    q('[data-move]').forEach(s => s.addEventListener('change', () => {
      if (s.value === '') return;
      const [i, j] = pair(s.dataset.move);
      const [sid] = trip.days[i].stops.splice(j, 1);
      trip.days[+s.value].stops.push(sid);
      save().then(render);
    }));
    q('[data-dup]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.dup; swap(trip.days, i, i - 1); save().then(render); }));
    q('[data-ddown]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.ddown; swap(trip.days, i, i + 1); save().then(render); }));
    q('[data-drm]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.drm;
      if (trip.days[i].stops.length && !confirm(`Delete day ${i + 1} and its ${trip.days[i].stops.length} stops?`)) return;
      trip.days.splice(i, 1);
      if (!trip.days.length) trip.days.push(newDay());
      save().then(render);
    }));
    view.querySelector('[data-addday]').addEventListener('click', () => { trip.days.push(newDay()); save().then(render); });
    view.querySelector('[data-del]').addEventListener('click', async () => {
      if (!confirm(`Delete the trip "${trip.name}"? This cannot be undone (unless you have a backup).`)) return;
      await deleteTrip(trip.id);
      location.hash = '#/trips';
    });
    // Place search per day
    q('[data-sq]').forEach(inp => {
      let t;
      inp.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => showResults(+inp.dataset.sq, inp.value), 200);
      });
    });
  };

  const showResults = (i, text) => {
    const box = view.querySelector(`[data-res="${i}"]`);
    const v = fold(text.trim());
    if (v.length < 2) { box.hidden = true; return; }
    // Places in the countries already in this trip come first.
    const inTrip = new Set();
    trip.days.forEach(d => d.stops.forEach(s => byId.get(s) && inTrip.add(byId.get(s).country)));
    // Score: name starts with the text > a word starts with it > anywhere; town names match too.
    const score = p => {
      const n = fold(`${p.name} ${p.name_zh || ''} ${p.pinyin || ''}`);
      if (n.startsWith(v)) return 3;
      if ((' ' + n).includes(' ' + v)) return 2;
      if (n.includes(v)) return 1;
      return fold(p.city || '').includes(v) ? 0.5 : 0;
    };
    const hits = places.filter(p => p.type !== 'info').map(p => [p, score(p)]).filter(x => x[1] > 0)
      .sort((a, b) => (inTrip.has(b[0].country) - inTrip.has(a[0].country)) || (b[1] - a[1]) ||
        (!!b[0].top_choice - !!a[0].top_choice))
      .slice(0, 40).map(x => x[0]);
    box.hidden = false;
    box.innerHTML = hits.length ? hits.map(p => `<div data-pick="${esc(p.id)}"><b>${esc(p.name)}</b> ${p.name_zh ? `<span class="zh">${esc(p.name_zh)}</span>` : ''}
      <div class="small muted">${esc(placeLine(p))}</div></div>`).join('') : '<div class="empty">No match.</div>';
    box.querySelectorAll('[data-pick]').forEach(div => div.addEventListener('click', () => {
      if (!trip.days[i].stops.includes(div.dataset.pick)) trip.days[i].stops.push(div.dataset.pick);
      openSearch = i;
      save().then(render);
    }));
  };

  render();
}
