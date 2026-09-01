(() => {
  const root = document.querySelector('[data-profile-stats]');
  if (!root) return;

  const metricNodes = new Map(
    [...root.querySelectorAll('[data-stat]')].map((node) => [node.dataset.stat, node])
  );
  const summary = root.querySelector('[data-contribution-summary]');
  const updated = root.querySelector('[data-profile-updated]');
  const heatmapHost = root.querySelector('[data-contribution-heatmap]');
  const numberFormat = new Intl.NumberFormat('zh-CN');
  const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' });

  function parseDate(value) {
    return new Date(`${value}T00:00:00Z`);
  }

  function addDays(date, days) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  function dateKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function contributionLevel(count, thresholds) {
    if (!count) return 0;
    if (count <= thresholds[0]) return 1;
    if (count <= thresholds[1]) return 2;
    if (count <= thresholds[2]) return 3;
    return 4;
  }

  function quantiles(days) {
    const values = days.map((day) => Number(day.count) || 0).filter(Boolean).sort((a, b) => a - b);
    if (!values.length) return [1, 2, 3];
    const at = (ratio) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * ratio))];
    return [at(0.25), at(0.5), at(0.75)];
  }

  function renderMetrics(data) {
    Object.entries(data.metrics || {}).forEach(([key, value]) => {
      const node = metricNodes.get(key);
      if (node && Number.isFinite(Number(value))) node.textContent = numberFormat.format(Number(value));
    });
  }

  function renderHeatmap(data) {
    if (!heatmapHost || !Array.isArray(data.contributions) || !data.contributions.length) return;

    const from = parseDate(data.period.from);
    const to = parseDate(data.period.to);
    const gridStart = addDays(from, -from.getUTCDay());
    const totalGridDays = Math.floor((to - gridStart) / 86400000) + 1;
    const weeks = Math.ceil(totalGridDays / 7);
    const dayMap = new Map(data.contributions.map((day) => [day.date, day]));
    const thresholds = quantiles(data.contributions);
    const cells = [];
    const monthLabels = [];
    let lastMonth = -1;

    for (let index = 0; index < totalGridDays; index += 1) {
      const date = addDays(gridStart, index);
      const key = dateKey(date);
      if (date < from) {
        cells.push('<span class="about-v3-day-empty" aria-hidden="true"></span>');
        continue;
      }

      const day = dayMap.get(key) || { date: key, count: 0, weekday: date.getUTCDay() };
      const count = Number(day.count) || 0;
      const level = contributionLevel(count, thresholds);
      const humanDate = dateFormat.format(date);
      const label = `${humanDate}，${count} 次贡献`;
      cells.push(`<button class="about-v3-day" type="button" data-date="${key}" data-count="${count}" data-level="${level}" aria-label="${label}" title="${label}"></button>`);

      const month = date.getUTCMonth();
      if (month !== lastMonth && date.getUTCDate() <= 7) {
        const weekIndex = Math.floor(index / 7) + 1;
        monthLabels.push(`<span style="grid-column:${weekIndex}">${date.toLocaleDateString('zh-CN', { month: 'short', timeZone: 'UTC' })}</span>`);
        lastMonth = month;
      }
    }

    heatmapHost.innerHTML = `
      <div class="about-v3-heatmap-shell">
        <div class="about-v3-heatmap-scroll" tabindex="0" aria-label="GitHub contribution heatmap，可横向滚动">
          <div class="about-v3-heatmap" style="--heatmap-weeks:${weeks}">
            <div class="about-v3-weekdays" aria-hidden="true"><span>一</span><span>三</span><span>五</span></div>
            <div class="about-v3-heatmap-main">
              <div class="about-v3-months" aria-hidden="true">${monthLabels.join('')}</div>
              <div class="about-v3-grid">${cells.join('')}</div>
            </div>
          </div>
        </div>
        <p class="about-v3-heatmap-detail" data-heatmap-detail>聚焦或悬停格子查看当天贡献。</p>
      </div>
    `;

    const detail = heatmapHost.querySelector('[data-heatmap-detail]');
    const buttons = [...heatmapHost.querySelectorAll('.about-v3-day')];
    const restore = () => {
      if (detail) detail.textContent = '聚焦或悬停格子查看当天贡献。';
    };
    const describe = (button) => {
      if (!detail) return;
      const date = parseDate(button.dataset.date);
      detail.textContent = `${dateFormat.format(date)} · ${numberFormat.format(Number(button.dataset.count) || 0)} 次贡献`;
    };

    buttons.forEach((button, index) => {
      button.addEventListener('mouseenter', () => describe(button));
      button.addEventListener('mouseleave', restore);
      button.addEventListener('focus', () => describe(button));
      button.addEventListener('blur', restore);
      button.addEventListener('keydown', (event) => {
        const offsets = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
        const offset = offsets[event.key];
        if (!offset) return;
        const target = buttons[index + offset];
        if (!target) return;
        event.preventDefault();
        target.focus();
      });
    });
  }

  function render(data) {
    renderMetrics(data);
    if (summary) summary.textContent = `${data.period.year} 年 GitHub 贡献 ${numberFormat.format(data.metrics.yearContributions)} 次`;
    if (updated) updated.textContent = `更新于 ${data.period.to}`;
    renderHeatmap(data);
  }

  function renderError() {
    if (summary) summary.textContent = 'GitHub 数据暂不可用';
    if (updated) updated.textContent = '';
    if (heatmapHost) heatmapHost.innerHTML = '<p class="about-v3-error">统计数据没有加载成功，页面其他内容不受影响。</p>';
  }

  fetch('./assets/data/profile-stats.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`profile stats request failed: ${response.status}`);
      return response.json();
    })
    .then(render)
    .catch((error) => {
      console.error(error);
      renderError();
    });
})();
