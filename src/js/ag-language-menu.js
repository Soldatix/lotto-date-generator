const LANGUAGES = [
  { value: 'en', code: 'EN', name: 'English' },
  { value: 'hr', code: 'HR', name: 'Hrvatski' },
  { value: 'de', code: 'DE', name: 'Deutsch' },
  { value: 'it', code: 'IT', name: 'Italiano' },
  { value: 'es', code: 'ES', name: 'Español' },
];

const FLAGS = {
  en: '<svg viewBox="0 0 30 20" aria-hidden="true" focusable="false"><rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.4"/></svg>',
  hr: '<svg viewBox="0 0 30 20" aria-hidden="true" focusable="false"><rect width="30" height="6.667" fill="#ff0000"/><rect y="6.667" width="30" height="6.666" fill="#fff"/><rect y="13.333" width="30" height="6.667" fill="#171796"/><path d="M12 5.4h6v6.4c0 2.25-1.25 3.65-3 4.45-1.75-.8-3-2.2-3-4.45z" fill="#fff" stroke="#d1182b" stroke-width=".55"/><path d="M12.35 6h1.1v1.1h-1.1zm2.2 0h1.1v1.1h-1.1zm2.2 0h.9v1.1h-.9zm-3.3 1.1h1.1v1.1h-1.1zm2.2 0h1.1v1.1h-1.1zm-3.3 2.2h1.1v1.1h-1.1zm2.2 0h1.1v1.1h-1.1zm2.2 0h.9v1.1h-.9zm-3.3 1.1h1.1v1.1h-1.1zm2.2 0h1.1v1.1h-1.1z" fill="#d1182b"/></svg>',
  de: '<svg viewBox="0 0 30 20" aria-hidden="true" focusable="false"><rect width="30" height="6.667" fill="#000"/><rect y="6.667" width="30" height="6.666" fill="#dd0000"/><rect y="13.333" width="30" height="6.667" fill="#ffce00"/></svg>',
  it: '<svg viewBox="0 0 30 20" aria-hidden="true" focusable="false"><rect width="10" height="20" fill="#009246"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce2b37"/></svg>',
  es: '<svg viewBox="0 0 30 20" aria-hidden="true" focusable="false"><rect width="30" height="5" fill="#aa151b"/><rect y="5" width="30" height="10" fill="#f1bf00"/><rect y="15" width="30" height="5" fill="#aa151b"/><rect x="8" y="7" width="2.1" height="4.5" rx=".25" fill="#aa151b"/><circle cx="9.05" cy="6.7" r="1" fill="#aa151b"/></svg>',
};

let globalsBound = false;

function installStyles() {
  if (document.getElementById('ag-language-menu-styles')) return;
  const style = document.createElement('style');
  style.id = 'ag-language-menu-styles';
  style.textContent = [
    '.ag-language-native{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;padding:0!important;margin:0!important;border:0!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important}',
    '.ag-language-menu{position:relative;display:inline-block;min-width:0;font:inherit}',
    '.ag-language-button{min-width:166px;min-height:42px;display:flex;align-items:center;gap:8px;border:1px solid var(--ag-lang-border,var(--border,var(--line,#dbe3ef)));border-radius:12px;padding:7px 34px 7px 10px;background:var(--ag-lang-bg,var(--surface,var(--panel,#fff)));color:var(--ag-lang-text,var(--text,#18233b));font:inherit;font-weight:650;cursor:pointer;text-align:left;position:relative;white-space:nowrap;box-shadow:0 4px 14px rgba(25,43,74,.06)}',
    '.ag-language-button:hover{border-color:var(--ag-lang-accent,var(--primary,var(--cyan,var(--blue,#2667ff))));background:var(--ag-lang-hover,var(--surface-2,var(--input,#f7f9fd)))}',
    '.ag-language-button:focus-visible{outline:3px solid color-mix(in srgb,var(--ag-lang-accent,var(--primary,var(--cyan,var(--blue,#2667ff)))) 28%,transparent);outline-offset:2px}',
    '.ag-language-flag{width:24px;height:16px;flex:0 0 24px;display:inline-flex;border-radius:2px;overflow:hidden;box-shadow:0 0 0 1px rgba(0,0,0,.16)}',
    '.ag-language-flag svg{width:100%;height:100%;display:block}',
    '.ag-language-code{font-size:.76em;font-weight:850;letter-spacing:.04em;opacity:.82}',
    '.ag-language-name{overflow:hidden;text-overflow:ellipsis}',
    '.ag-language-chevron{position:absolute;right:11px;top:50%;transform:translateY(-50%);font-size:.68rem;color:var(--ag-lang-muted,var(--muted,#65718a))}',
    '.ag-language-options{position:absolute;z-index:10000;top:calc(100% + 6px);min-width:190px;width:max-content;max-width:min(240px,calc(100vw - 20px));padding:5px;border:1px solid var(--ag-lang-border,var(--border,var(--line,#dbe3ef)));border-radius:11px;background:var(--ag-lang-bg,var(--surface,var(--panel,#fff)));box-shadow:0 14px 34px rgba(12,24,56,.22);display:none}',
    '.ag-language-menu.open .ag-language-options{display:grid}',
    '.ag-language-menu.align-right .ag-language-options{right:0;left:auto}',
    '.ag-language-menu.align-left .ag-language-options{left:0;right:auto}',
    '.ag-language-option{min-width:180px;min-height:40px;display:grid;grid-template-columns:24px 30px minmax(0,1fr);align-items:center;gap:8px;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:var(--ag-lang-text,var(--text,#18233b));font:inherit;text-align:left;cursor:pointer}',
    '.ag-language-option:hover,.ag-language-option:focus-visible{outline:none;background:var(--ag-lang-hover,var(--surface-2,var(--input,#f7f9fd)))}',
    '.ag-language-option:focus-visible{box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--ag-lang-accent,var(--primary,var(--cyan,var(--blue,#2667ff)))) 38%,transparent)}',
    '.ag-language-option.selected{background:var(--ag-lang-selected,color-mix(in srgb,var(--ag-lang-accent,var(--primary,var(--cyan,var(--blue,#2667ff)))) 12%,var(--ag-lang-bg,var(--surface,var(--panel,#fff)))));color:var(--ag-lang-accent,var(--primary,var(--cyan,var(--blue,#2667ff))));font-weight:750}',
    '@media(max-width:590px){.ag-language-button{min-width:148px;min-height:38px;padding:6px 30px 6px 8px;gap:7px;font-size:.82rem}.ag-language-option{min-width:170px;grid-template-columns:22px 28px minmax(0,1fr)}.ag-language-flag{width:22px;height:15px;flex-basis:22px}}',
  ].join('');
  document.head.appendChild(style);
}

function flagMarkup(language) {
  return '<span class="ag-language-flag">' + (FLAGS[language] || FLAGS.en) + '</span>';
}

function markup(item) {
  return flagMarkup(item.value) +
    '<span class="ag-language-code">' + item.code + '</span>' +
    '<span class="ag-language-name">' + item.name + '</span>';
}

function closeMenu(menu, restoreFocus = false) {
  menu.classList.remove('open');
  const button = menu.querySelector('.ag-language-button');
  if (button) {
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }
}

function closeAll(except = null) {
  document.querySelectorAll('.ag-language-menu.open').forEach((menu) => {
    if (menu !== except) closeMenu(menu, false);
  });
}

function positionMenu(menu) {
  const button = menu.querySelector('.ag-language-button');
  if (!button) return;
  const roomRight = (document.documentElement.clientWidth || window.innerWidth) - button.getBoundingClientRect().left;
  menu.classList.toggle('align-left', roomRight >= 210);
  menu.classList.toggle('align-right', roomRight < 210);
}

function bindGlobals() {
  if (globalsBound) return;
  globalsBound = true;
  document.addEventListener('pointerdown', (event) => {
    document.querySelectorAll('.ag-language-menu.open').forEach((menu) => {
      if (!menu.contains(event.target)) closeMenu(menu, false);
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const menu = document.querySelector('.ag-language-menu.open');
    if (!menu) return;
    event.preventDefault();
    closeMenu(menu, true);
  });
  window.addEventListener('resize', () => {
    document.querySelectorAll('.ag-language-menu.open').forEach(positionMenu);
  });
}

function enhanceSelect(select) {
  if (!select || select.dataset.agLanguageEnhanced === 'true') return;
  select.dataset.agLanguageEnhanced = 'true';
  select.classList.add('ag-language-native');
  select.tabIndex = -1;

  const available = new Set(Array.from(select.options).map((option) => option.value));
  const languages = LANGUAGES.filter((item) => available.has(item.value));
  if (!languages.length) return;

  const menu = document.createElement('div');
  menu.className = 'ag-language-menu align-right';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ag-language-button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', select.getAttribute('aria-label') || 'Language');

  const options = document.createElement('div');
  options.className = 'ag-language-options';
  options.setAttribute('role', 'listbox');
  options.setAttribute('aria-label', select.getAttribute('aria-label') || 'Language');

  languages.forEach((item) => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'ag-language-option';
    optionButton.dataset.language = item.value;
    optionButton.setAttribute('role', 'option');
    optionButton.tabIndex = -1;
    optionButton.innerHTML = markup(item);
    options.appendChild(optionButton);
  });

  const items = () => Array.from(options.querySelectorAll('.ag-language-option'));

  function updateDisplay() {
    const current = languages.find((item) => item.value === select.value) || languages[0];
    button.innerHTML = markup(current) + '<span class="ag-language-chevron" aria-hidden="true">▼</span>';
    items().forEach((item) => {
      const selected = item.dataset.language === current.value;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  function focusItem(index) {
    const optionItems = items();
    if (!optionItems.length) return;
    optionItems[(index + optionItems.length) % optionItems.length]?.focus({ preventScroll: true });
  }

  function openMenu() {
    closeAll(menu);
    positionMenu(menu);
    menu.classList.add('open');
    button.setAttribute('aria-expanded', 'true');
    const optionItems = items();
    focusItem(Math.max(0, optionItems.findIndex((item) => item.dataset.language === select.value)));
  }

  options.addEventListener('click', (event) => {
    const optionButton = event.target.closest('.ag-language-option');
    if (!optionButton) return;
    event.preventDefault();
    event.stopPropagation();
    select.value = optionButton.dataset.language;
    updateDisplay();
    closeMenu(menu, false);
    button.focus();
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (menu.classList.contains('open')) closeMenu(menu, false);
    else openMenu();
  });

  button.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  });

  options.addEventListener('keydown', (event) => {
    const optionItems = items();
    const current = optionItems.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); focusItem(current + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusItem(current - 1); }
    else if (event.key === 'Home') { event.preventDefault(); focusItem(0); }
    else if (event.key === 'End') { event.preventDefault(); focusItem(optionItems.length - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); document.activeElement?.click(); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(menu, true); }
    else if (event.key === 'Tab') closeMenu(menu, false);
  });

  select.addEventListener('change', updateDisplay);
  const languageObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.attributeName === 'lang')) updateDisplay();
  });
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  select.insertAdjacentElement('afterend', menu);
  menu.append(button, options);
  updateDisplay();
}

export function enhanceLanguageMenus(root = document) {
  installStyles();
  bindGlobals();
  root.querySelectorAll('select[data-ag-language-menu]').forEach(enhanceSelect);
}
