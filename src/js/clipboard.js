export async function copyText(text, focusTarget) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Missing or rejected Clipboard API: try the legacy browser fallback.
  }

  let textarea;
  try {
    textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    textarea?.remove();
    try { focusTarget?.focus?.(); } catch { /* Focus restoration must not change the copy result. */ }
  }
}

export function createClipboardHandlers({ $, getLastResult, resultString, tr, infoTr, announce = () => {} }) {
  const attempts = new WeakMap();

  async function copyWithFeedback(text, button, translate, delay, wallet = false) {
    const previous = attempts.get(button);
    clearTimeout(previous?.timer);
    const attempt = {};
    attempts.set(button, attempt);
    button.textContent = translate('copy');
    if (wallet) delete button.dataset.copied;

    const success = await copyText(text, button);
    // A slower earlier request must not overwrite the latest button feedback.
    if (attempts.get(button) !== attempt) return success;
    button.textContent = translate(success ? 'copied' : 'copyFailed');
    announce(button.textContent, wallet ? 'infoLiveStatus' : 'liveStatus');
    if (wallet && success) button.dataset.copied = '1';
    attempt.timer = setTimeout(() => {
      if (wallet) delete button.dataset.copied;
      button.textContent = translate('copy');
      attempts.delete(button);
    }, delay);
    return success;
  }

  async function copyResult() {
    const result = getLastResult();
    if (!result) return false;
    return copyWithFeedback(resultString(result), $('copyBtn'), tr, 1200);
  }

  async function copyHistory(result, button) {
    return copyWithFeedback(resultString(result), button, tr, 900);
  }

  async function copyWallet(button) {
    return copyWithFeedback(button.dataset.wallet, button, infoTr, 1200, true);
  }

  return { copyResult, copyHistory, copyWallet };
}
