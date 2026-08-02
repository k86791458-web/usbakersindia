// Shared formatters used across the CRM

/**
 * Sentence Case: capitalises the first letter of every whitespace-separated word.
 * Non-first characters are lower-cased. Preserves leading/trailing whitespace so
 * users can still type spaces normally.
 * Example: "  jOhN dOE " -> "  John Doe "
 */
export const toSentenceCase = (value) => {
  if (!value) return value;
  const s = String(value);
  return s.replace(/(^|\s)(\S)(\S*)/g, (_m, ws, first, rest) =>
    ws + first.toUpperCase() + rest.toLowerCase()
  );
};

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Birthday formatter → "17 July 2007" (day + full month + year).
 * Accepts YYYY-MM-DD, DD/MM/YYYY, Date objects, or ISO strings.
 * Returns "-" for empty/invalid.
 */
export const formatBirthday = (value) => {
  if (!value) return '-';
  try {
    let y, m, d;
    if (value instanceof Date) {
      y = value.getFullYear();
      m = value.getMonth() + 1;
      d = value.getDate();
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      // YYYY-MM-DD
      const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
      // DD/MM/YYYY
      const dmy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(trimmed);
      if (iso) {
        y = Number(iso[1]); m = Number(iso[2]); d = Number(iso[3]);
      } else if (dmy) {
        d = Number(dmy[1]); m = Number(dmy[2]); y = Number(dmy[3]);
      } else {
        const dt = new Date(trimmed);
        if (Number.isNaN(dt.getTime())) return '-';
        y = dt.getFullYear();
        m = dt.getMonth() + 1;
        d = dt.getDate();
      }
    } else {
      return '-';
    }
    if (!y || !m || !d || m < 1 || m > 12) return '-';
    return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
  } catch (_e) {
    return '-';
  }
};

/**
 * Time in 12-hour format: "5:30 PM". Accepts "HH:MM", "HH:MM:SS", "H:MM" or Date.
 */
export const formatTime12 = (value) => {
  if (!value) return '';
  try {
    let hh, mm;
    if (value instanceof Date) {
      hh = value.getHours();
      mm = value.getMinutes();
    } else if (typeof value === 'string') {
      const parts = value.split(':');
      hh = Number(parts[0]);
      mm = Number(parts[1] || 0);
    } else {
      return String(value);
    }
    if (Number.isNaN(hh) || Number.isNaN(mm)) return String(value);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
  } catch (_e) {
    return String(value);
  }
};

/**
 * Age from a birthday-like value (year-only or full date).
 */
export const ageFromBirthday = (value) => {
  if (!value) return null;
  const bd = new Date(typeof value === 'string' ? value : value);
  if (Number.isNaN(bd.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : null;
};
