// SHOM files carry Release_date as "2026/06/10" (or "20260610"); the page shows dd/mm/yyyy.
export function formatReleaseDate(value) {
  const match = /^(\d{4})\D?(\d{2})\D?(\d{2})$/.exec(String(value ?? '').trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}
