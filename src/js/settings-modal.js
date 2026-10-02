import { SETTINGS_T, INFO_T } from '../data/translations.js';

export function createSettingsModalHandlers({ $ }) {
  let previousFocus = null;
  function settingsTr(key) {
    const lang = $('language')?.value || 'en';
    return (SETTINGS_T[lang] || SETTINGS_T.en)[key] ||
      (INFO_T[lang] || INFO_T.en)[key] || key;
  }
  function applySettingsLanguage() {
    const close = settingsTr('close');
    $('settingsX').setAttribute('aria-label', close);
    $('settingsX').title = close;
    document.querySelectorAll('[data-settings-i18n]').forEach(el => {
      el.textContent = settingsTr(el.dataset.settingsI18n);
    });
    const status = $('backupStatus');
    if (status.dataset.infoI18n) status.textContent = settingsTr(status.dataset.infoI18n) + (status.dataset.infoI18n === 'backupSaved' && status.dataset.backupPath ? ' ' + status.dataset.backupPath : '');
  }
  function openSettings() {
    const overlay = $('settingsOverlay');
    if (!overlay.classList.contains('open')) previousFocus = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    applySettingsLanguage();
    $('settingsX').focus();
  }
  function closeSettings() {
    const overlay = $('settingsOverlay');
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    const target = previousFocus;
    previousFocus = null;
    if (target?.isConnected && typeof target.focus === 'function') target.focus();
  }
  function handleSettingsOverlayClick(event) {
    if (event.target === $('settingsOverlay')) closeSettings();
  }
  function handleSettingsKeydown(event) {
    const overlay = $('settingsOverlay');
    if (!overlay.classList.contains('open')) return;
    if (event.key === 'Escape') { closeSettings(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...overlay.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter(el => el.tabIndex >= 0 && !el.matches(':disabled') &&
        el.getClientRects().length > 0 && getComputedStyle(el).visibility === 'visible');
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (!controls.includes(document.activeElement) ||
        (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
  return { settingsTr, applySettingsLanguage, openSettings, closeSettings,
    handleSettingsOverlayClick, handleSettingsKeydown };
}
