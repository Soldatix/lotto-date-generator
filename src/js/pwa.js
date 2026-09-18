export function initializePwaTitle() {
  const browserTitle = document.title;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const updateTitle = () => {
    document.title = standalone.matches || navigator.standalone === true
      ? 'Date Lotto Generator'
      : browserTitle;
  };
  updateTitle();
  if (typeof standalone.addEventListener === 'function') {
    standalone.addEventListener('change', updateTitle);
  } else if (typeof standalone.addListener === 'function') {
    standalone.addListener(updateTitle);
  }
}

// Native registration leaves updates waiting until all app tabs have closed.
// No controllerchange reload, skipWaiting message, or localStorage changes.
export function registerPwa() {
  if (!import.meta.env.PROD || !window.isSecureContext ||
      !['http:', 'https:'].includes(window.location.protocol) ||
      !('serviceWorker' in navigator)) return;

  const register = () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      updateViaCache: 'none',
    }).catch(error => console.warn('Offline registration failed:', error));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
