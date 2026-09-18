import { validHistoryDate, validIsoTimestamp } from './generator.js';

export const HISTORY_LIMIT = 30;

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

export function validHistoryEntry(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
  return validHistoryDate(r.date) &&
    [r.m, r.mm, r.e, r.em].every(Number.isInteger) &&
    r.m >= 1 && r.m <= 20 && r.mm >= r.m && r.mm <= 99 &&
    r.e >= 0 && r.e <= 10 && r.em >= 1 && r.em <= 99 &&
    r.em >= r.e && typeof r.salt === 'string' && validIsoTimestamp(r.created) &&
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

export function getTheme() {
  const theme = readItem('lottoTheme', 'system');
  return ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
}
export function setTheme(theme) { return writeItem('lottoTheme', theme); }
export function getLanguage() {
  const language = readItem('lottoLang', 'en');
  return ['en', 'hr', 'de', 'it', 'es'].includes(language) ? language : 'en';
}
export function setLanguage(language) { return writeItem('lottoLang', language); }

// Snapshot raw values so rollback preserves even empty or malformed stored data.
export function resetStoredData() {
  const keys = ['lottoHistory', 'lottoLang', 'lottoTheme'];
  const previous = [];
  let removed = 0;
  try {
    for (const key of keys) previous.push(localStorage.getItem(key));
    for (const key of keys) {
      localStorage.removeItem(key);
      removed++;
    }
    return 'resetSucceeded';
  } catch {
    let rollbackFailed = false;
    for (let i = removed - 1; i >= 0; i--) {
      try {
        if (previous[i] !== null) localStorage.setItem(keys[i], previous[i]);
      } catch { rollbackFailed = true; }
    }
    return rollbackFailed ? 'resetRollbackFailed' : 'resetFailed';
  }
}

// localStorage has no multi-key transaction. Snapshot before writing and roll
// back only completed writes if a later write fails (including absent keys).
export function restoreData({ history, language, theme }) {
  const entries = [['lottoHistory', JSON.stringify(history)], ['lottoLang', language], ['lottoTheme', theme]];
  const previous = [];
  let written = 0;
  try {
    for (const [key] of entries) previous.push(localStorage.getItem(key));
    for (const [key, value] of entries) {
      localStorage.setItem(key, value);
      written++;
    }
    return 'restored';
  } catch {
    let rollbackFailed = false;
    for (let i = written - 1; i >= 0; i--) {
      try {
        if (previous[i] === null) localStorage.removeItem(entries[i][0]);
        else localStorage.setItem(entries[i][0], previous[i]);
      } catch { rollbackFailed = true; }
    }
    return rollbackFailed ? 'rollbackFailed' : 'restoreFailed';
  }
}
