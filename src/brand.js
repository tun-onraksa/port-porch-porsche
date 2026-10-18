// At the Gate brand layer: wordmark, co-brand line and page title for the PortTable shell.
// Colours and type live in src/brand.css. Change BRAND_NAME to rename the product everywhere it is shown.
(function () {
  const BRAND_NAME = 'At the Gate';
  const OLD_NAME = 'PortTable';
  const MARK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5 21 7v10l-9 4.5L3 17V7z"/><path d="M3 7l9 4.5L21 7M12 11.5v10"/></svg>';

  const brand = document.querySelector('.brand');
  if (brand) {
    brand.innerHTML = '<span class="brand-mark">' + MARK + '</span>' + BRAND_NAME;
    brand.setAttribute('aria-label', BRAND_NAME + ', home');
    const co = document.createElement('div');
    co.className = 'brand-cobrand';
    co.innerHTML = '<i aria-hidden="true"></i>Built on Terminal49';
    brand.after(co);
  }

  const fixTitle = () => {
    if (document.title.includes(OLD_NAME)) document.title = document.title.split(OLD_NAME).join(BRAND_NAME);
  };
  fixTitle();
  const t = document.querySelector('title');
  if (t) new MutationObserver(fixTitle).observe(t, { childList: true, characterData: true, subtree: true });
})();
