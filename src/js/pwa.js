function isStandalone(media) {
  return media.matches || navigator.standalone === true;
}

export function initializePwaTitle() {
  const browserTitle = document.title;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const updateTitle = () => {
    document.title = isStandalone(standalone)
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

export function initializeWebInstall({ $, getText }) {
  const banner = $('webInstallBanner');
  let active = new URLSearchParams(window.location.search).get('install') === 'web';
  const media = window.matchMedia('(display-mode: standalone)');
  let installed = isStandalone(media);
  let deferredPrompt = null;
  let state = installed ? 'installed' : 'waiting';
  let timer;
  const render = () => {
    const text = getText();
    banner.hidden = !active;
    $('webInstallTitle').textContent = text.title;
    $('webInstallDescription').textContent = text.description;
    $('webInstallStatus').textContent = text[state];
    $('installWebAppButton').textContent = text.install;
    $('continueWebButton').textContent = text.continue;
    $('installWebAppButton').disabled = state !== 'ready';
  };
  const setState = next => { state = next; render(); };
  const markInstalled = () => {
    installed = true;
    deferredPrompt = null;
    clearTimeout(timer);
    setState('installed');
  };
  window.addEventListener('beforeinstallprompt', event => {
    if (!active) return;
    event.preventDefault();
    if (installed || isStandalone(media)) { markInstalled(); return; }
    if (state === 'installing') return;
    deferredPrompt = event;
    clearTimeout(timer);
    setState(typeof event.prompt === 'function' ? 'ready' : 'unavailable');
  });
  window.addEventListener('appinstalled', markInstalled);
  const onModeChange = () => { if (isStandalone(media)) markInstalled(); };
  if (typeof media.addEventListener === 'function') media.addEventListener('change', onModeChange);
  else if (typeof media.addListener === 'function') media.addListener(onModeChange);
  $('installWebAppButton').onclick = async () => {
    if (!active || state === 'installing') return;
    if (installed || isStandalone(media)) { markInstalled(); return; }
    if (!deferredPrompt || typeof deferredPrompt.prompt !== 'function') {
      setState('unavailable'); return;
    }
    const prompt = deferredPrompt;
    setState('installing');
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (installed || isStandalone(media)) markInstalled();
      else setState(choice?.outcome === 'accepted' ? 'installing' : 'dismissed');
    } catch {
      setState(installed ? 'installed' : 'unavailable');
    } finally {
      deferredPrompt = null;
    }
  };
  $('continueWebButton').onclick = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('install');
    window.history.replaceState(window.history.state, '', url);
    active = false;
    deferredPrompt = null;
    clearTimeout(timer);
    render();
    $('language').focus();
  };
  // Availability can arrive late, even on browsers exposing the event API.
  // Keep listening after the fallback message is displayed.
  if (active && !installed) timer = setTimeout(() => {
    if (state === 'waiting') setState('unavailable');
  }, 3000);
  render();
  return { applyLanguage: render };
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
