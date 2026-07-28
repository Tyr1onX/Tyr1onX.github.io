(() => {
  if (document.body?.dataset.page !== 'keke') return;

  const viewer = document.querySelector('[data-product-viewer]');
  if (!(viewer instanceof HTMLElement)) return;

  const tabs = [...viewer.querySelectorAll('[role="tab"]')];
  const panels = [...viewer.querySelectorAll('[role="tabpanel"]')];

  const activate = (tab, moveFocus = false) => {
    if (!(tab instanceof HTMLButtonElement)) return;
    const panelId = tab.getAttribute('aria-controls');

    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      panel.hidden = panel.id !== panelId;
    });

    if (moveFocus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();

      let nextIndex = index;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      activate(tabs[nextIndex], true);
    });
  });
})();
