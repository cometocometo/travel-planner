export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const linkify = s => esc(s).replace(/https?:\/\/[^\s<]+/g,
  u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);

// Search ignores case and tone marks: "tianjin" finds "Tiānjīn".
export const fold = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const TYPE_COLORS = {
  sight: '#d93025', stay: '#1a73e8', food: '#f29900', nightlife: '#9334e6', shop: '#188038',
  activity: '#12b5cb', event: '#e52592', info: '#80868b', saved: '#0b8043',
};
export const TYPE_LABELS = {
  sight: 'Sights', stay: 'Stay', food: 'Food', nightlife: 'Nightlife', shop: 'Shopping',
  activity: 'Activities', event: 'Events', info: 'Practical info', saved: 'My Maps places',
};
export const DAY_COLORS = ['#d93025', '#1a73e8', '#188038', '#f29900', '#9334e6', '#12b5cb', '#e52592',
  '#795548', '#3f51b5', '#009688', '#ff5722', '#607d8b'];
export const STATUS = { want: 'Want to go', visited: 'Visited', skip: 'Skip' };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function addDays(iso, n) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function placeLine(p) {
  // One short line under a place name: type and where.
  const where = [p.city, p.country].filter(Boolean);
  const uniq = where.filter((w, i) => where.indexOf(w) === i);
  return [p.subtype ? p.subtype.toLowerCase() : TYPE_LABELS[p.type], ...uniq].filter(Boolean).join(' · ');
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function pickFile(accept) {
  return new Promise(resolve => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.onchange = () => resolve(i.files[0] || null);
    i.click();
  });
}

export const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * r / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
