(() => {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('[data-panel-target]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const toggle = document.querySelector('#theme-toggle');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const year = document.querySelector('#current-year');

  const panelIds = new Set(panels.map((panel) => panel.dataset.panel));

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    if (toggle) {
      toggle.textContent = theme === 'dark' ? '浅色' : '深色';
      toggle.setAttribute('aria-label', theme === 'dark' ? '切换到浅色模式' : '切换到深色模式');
    }
    metaTheme?.setAttribute('content', theme === 'dark' ? '#111214' : '#f6f6f3');
  };

  const activate = (id, push = false) => {
    if (!panelIds.has(id)) id = 'about';

    buttons.forEach((button) => {
      const active = button.dataset.panelTarget === id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      if (active) button.setAttribute('tabindex', '0');
      else button.setAttribute('tabindex', '-1');
    });

    panels.forEach((panel) => {
      const active = panel.dataset.panel === id;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });

    if (push) history.pushState(null, '', `#${id}`);
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => activate(button.dataset.panelTarget || 'about', true));
  });

  document.querySelectorAll('[data-open-panel]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('data-open-panel');
      if (!id || !panelIds.has(id)) return;
      event.preventDefault();
      activate(id, true);
    });
  });

  toggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('tyr1onx-theme', next); } catch {}
    applyTheme(next);
  });

  addEventListener('popstate', () => activate(location.hash.slice(1) || 'about'));

  if (year) year.textContent = String(new Date().getFullYear());
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  activate(location.hash.slice(1) || 'about');
})();
