import { getTheme, setTheme } from './storage.js';

let mode;
let colorScheme;

function updateAppearance() {
  document.documentElement.dataset.theme = mode === 'system'
    ? (colorScheme.matches ? 'dark' : 'light') : mode;
}

export function applyTheme() {
  mode = getTheme();
  if (!colorScheme) {
    colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    // Register once; manual choices ignore OS changes.
    colorScheme.addEventListener('change', () => {
      if (mode === 'system') updateAppearance();
    });
  }
  document.getElementById('themeSelect').value = mode;
  updateAppearance();
}

export function selectTheme(value) {
  mode = ['light', 'dark', 'system'].includes(value) ? value : 'system';
  setTheme(mode);
  updateAppearance();
}
