import { openUrl } from '@tauri-apps/plugin-opener';

const allowedUrls = new Set([
  'https://appsandgames.org/',
  'https://www.paypal.com/ncp/payment/RU2CWCNVQ7XD6',
  'https://buy.stripe.com/7sYeVd7Blfe89cm0k02kw00'
]);

export function initializeExternalLinks({
  container,
  isNative,
  onError,
  opener = openUrl
}) {
  container.addEventListener('click', event => {
    if (event.defaultPrevented || !isNative()) return;

    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || !allowedUrls.has(anchor.href)) return;

    event.preventDefault();

    void Promise.resolve()
      .then(() => opener(anchor.href))
      .catch(() => onError());
  });
}