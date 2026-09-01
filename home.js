(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('#theme-toggle');
  const metaTheme = document.querySelector('meta[name="theme-color"]');

  const themeColor = {
    light: '#f3f1eb',
    dark: '#141512',
  };

  const applyTheme = (theme) => {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    metaTheme?.setAttribute('content', themeColor[next]);

    if (toggle) {
      const label = next === 'dark' ? '切换到浅色模式' : '切换到深色模式';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
    }
  };

  toggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('tyr1onx-theme', next); } catch {}
    applyTheme(next);
  });

  applyTheme(root.dataset.theme);
})();
