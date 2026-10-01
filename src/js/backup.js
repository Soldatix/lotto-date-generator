import { getHistory, getLanguage, getTheme, validHistoryEntry, HISTORY_LIMIT, restoreData, resetStoredData } from './storage.js';

export function createResetHandler({ $, tr, onReset, announce, confirmReset = message => window.confirm(message) }) {
  return () => {
    if (!confirmReset(tr('resetConfirm'))) return;
    const result = resetStoredData();
    if (result === 'resetSucceeded') onReset();
    // Use the repeatable live-status mechanism for consecutive identical errors.
    $('backupStatus').dataset.infoI18n = result;
    announce(tr(result), 'backupStatus');
  };
}

const fields = ['date', 'm', 'mm', 'e', 'em', 'salt', 'main', 'extra', 'created'];
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const cleanEntry = entry => Object.fromEntries(fields.map(key => [key, entry[key]]));

export function createBackup(now = new Date()) {
  return { app: 'date-lotto-generator', version: 1, exportedAt: now.toISOString(),
    data: { history: getHistory().map(cleanEntry), language: getLanguage(), theme: getTheme() } };
}

export function parseBackup(text) {
  let backup;
  try { backup = JSON.parse(text); } catch { throw new Error('backupInvalid'); }
  if (!exactKeys(backup, ['app', 'version', 'exportedAt', 'data']) ||
      backup.app !== 'date-lotto-generator' || backup.version !== 1 ||
      typeof backup.exportedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(backup.exportedAt) ||
      !Number.isFinite(Date.parse(backup.exportedAt)) || new Date(backup.exportedAt).toISOString() !== backup.exportedAt ||
      !exactKeys(backup.data, ['history', 'language', 'theme'])) throw new Error('backupInvalid');
  const { history, language, theme } = backup.data;
  if (!Array.isArray(history) || history.length > HISTORY_LIMIT ||
      !history.every(entry => exactKeys(entry, fields) && validHistoryEntry(entry)) ||
      !['en', 'hr', 'de', 'it', 'es'].includes(language) ||
      !['light', 'dark', 'system'].includes(theme)) throw new Error('backupInvalid');
  return { history: history.map(cleanEntry), language, theme };
}

export function createBackupHandlers({
  $, tr, onRestore,
  confirmRestore = message => window.confirm(message),
  loadNativeApi = () => import('./native-backup.js')
}) {
  let busy = false;
  let lastBackupPath = null;
  const isNative = () => window.location?.hostname === 'tauri.localhost' ||
    typeof window.__TAURI_INTERNALS__ !== 'undefined';
  const report = key => {
    const status = $('backupStatus');
    status.dataset.infoI18n = key;
    delete status.dataset.backupPath;
    status.textContent = tr(key);
  };
  const reportSaved = path => {
    const status = $('backupStatus');
    status.dataset.infoI18n = 'backupSaved';
    status.dataset.backupPath = path;
    status.textContent = tr('backupSaved') + ' ' + path;
  };

  async function exportNativeBackup() {
    if (busy) return;
    busy = true;
    try {
      const backup = createBackup();
      const api = await loadNativeApi();
      const filename = `date-lotto-generator-backup-${backup.exportedAt.slice(0, 10)}.json`;
      const path = await api.saveNativeBackup(JSON.stringify(backup, null, 2), filename, tr('backupExport'));
      if (path === null) { report('backupExportCancelled'); return; }
      lastBackupPath = path;
      reportSaved(path);
    } catch {
      report('backupExportFailed');
    } finally {
      busy = false;
    }
  }

  function exportBackup() {
    if (isNative()) return exportNativeBackup();
    let url;
    let link;
    try {
      const backup = createBackup();
      url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      link = document.createElement('a');
      link.href = url;
      link.download = `date-lotto-generator-backup-${backup.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      report('backupExported');
    } catch { report('backupExportFailed'); }
    finally {
      link?.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  async function importBackup() {
    if (busy) return;
    let file = $('backupFile').files?.[0];
    busy = true;
    try {
      if (!file && isNative()) {
        const api = await loadNativeApi();
        const selected = await api.openNativeBackup(lastBackupPath, tr('backupImport'));
        if (selected === null) { report('backupCancelled'); return; }
        lastBackupPath = selected.path;
        file = { name: selected.path, text: async () => selected.text };
      }
      if (!file) return;
      if (!/\.json$/i.test(file.name)) { report('backupInvalid'); return; }
      let data;
      try { data = parseBackup(await file.text()); }
      catch { report('backupInvalid'); return; }
      if (!confirmRestore(tr('backupConfirm'))) { report('backupCancelled'); return; }
      const result = restoreData(data);
      if (result !== 'restored') { report(result); return; }
      onRestore(data);
      report('backupRestored');
    } catch {
      report('backupInvalid');
    } finally {
      $('backupFile').value = '';
      busy = false;
    }
  }
  return { exportBackup, importBackup };
}
