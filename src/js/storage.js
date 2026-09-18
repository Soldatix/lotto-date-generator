const HISTORY_LIMIT = 30;

function readItem(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function validNumbers(numbers, count, max) {
  return Array.isArray(numbers) && numbers.length === count &&
    numbers.every(n => Number.isInteger(n) && n >= 1 && n <= max) &&
    new Set(numbers).size === count;
}

function validHistoryEntry(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  return typeof r.date === 'string' &&
    /^(?:\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/.test(r.date) &&
    [r.m, r.mm, r.e, r.em].every(Number.isInteger) &&
    r.m >= 1 && r.m <= 20 && r.mm >= r.m && r.mm <= 99 &&
    r.e >= 0 && r.e <= 10 && r.em >= 1 && r.em <= 99 &&
    r.em >= r.e && typeof r.salt === 'string' && typeof r.created === 'string' &&
    validNumbers(r.main, r.m, r.mm) && validNumbers(r.extra, r.e, r.em);
}

export function getHistory() {
  try {
    const history = JSON.parse(readItem('lottoHistory', '[]'));
    return Array.isArray(history) ? history.filter(validHistoryEntry).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function setHistory(history) {
  try {
    return writeItem('lottoHistory', JSON.stringify(history));
  } catch {
    return false;
  }
}

export function addHistory(result) {
  if (!validHistoryEntry(result)) return false;
  return setHistory([result, ...getHistory()].slice(0, HISTORY_LIMIT));
}

export function deleteHistory(history, index) {
  // Keep the caller's history intact if persistence fails.
  const next = history.slice();
  next.splice(index, 1);
  return setHistory(next);
}

export function getTheme() { return readItem('lottoTheme', 'dark'); }
export function setTheme(theme) { return writeItem('lottoTheme', theme); }
export function getLanguage() {
  const language = readItem('lottoLang', 'en');
  return ['en', 'hr', 'de', 'it', 'es'].includes(language) ? language : 'en';
}
export function setLanguage(language) { return writeItem('lottoLang', language); }
