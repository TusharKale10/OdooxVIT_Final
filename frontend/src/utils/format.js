// Centralised time / currency / link helpers.

const HM_RE = /^(\d{1,2}):(\d{1,2})/;

// Accepts "HH:MM", "HH:MM:SS", "YYYY-MM-DD HH:MM:SS" or Date — returns "9:00 AM".
export function formatTime(input) {
  if (!input) return '';
  if (input instanceof Date) {
    const h = input.getHours();
    const m = input.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  const s = String(input).trim();
  // MySQL "YYYY-MM-DD HH:MM:SS"
  const dt = s.length >= 16 ? s.slice(11) : s;
  const m = dt.match(HM_RE);
  if (!m) return s;
  const h = Number(m[1]);
  const mn = Number(m[2]);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mn).padStart(2, '0')} ${ampm}`;
}

// "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS" → "Mon, May 4"
export function formatShortDate(input) {
  if (!input) return '';
  const s = String(input).trim();
  const isoLike = s.length === 10 ? `${s}T00:00:00` : s.replace(' ', 'T');
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// "YYYY-MM-DD HH:MM:SS" → "Mon, May 4 · 9:00 AM"
export function formatDateTime(input) {
  if (!input) return '';
  const s = String(input).trim().replace(' ', 'T');
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(input);
  const date = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${date} · ${formatTime(d)}`;
}

export function formatINR(n, opts = {}) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString('en-IN', {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 2,
  })}`;
}

export const isHttpUrl = (s) => /^https?:\/\/[^\s]+$/i.test(String(s || '').trim());

// Resolve relative /uploads URLs returned by the API to the full backend URL.
export function resolveAsset(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads/')) return url;     // proxied by Vite, served by Express in prod
  return url;
}
