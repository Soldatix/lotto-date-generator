const begin = '<!-- STORE_CRYPTO_BEGIN -->';
const end = '<!-- STORE_CRYPTO_END -->';

export function storeEditionHtmlPlugin(isStoreEdition) {
  return {
    name: 'apps-games-store-edition-html',
    transformIndexHtml(html) {
      if (!isStoreEdition) return html;
      const start = html.indexOf(begin);
      const finish = html.indexOf(end);
      if (start < 0 || finish < start ||
          html.indexOf(begin, start + begin.length) !== -1 ||
          html.indexOf(end, finish + end.length) !== -1) {
        throw new Error('Store crypto section markers are missing or duplicated');
      }
      return html.slice(0, start) + html.slice(finish + end.length);
    }
  };
}
