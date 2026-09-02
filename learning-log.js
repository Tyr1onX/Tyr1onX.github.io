(() => {
  const log = Array.isArray(window.TYR1ONX_LEARNING_LOG) ? window.TYR1ONX_LEARNING_LOG : [];
  const root = document.querySelector('[data-learning-log]');

  if (!root) return;

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const MONTH_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const normalized = log
    .filter(item => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Array.isArray(item.entries) && item.entries.length)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!normalized.length) {
    const empty = document.createElement('p');
    empty.className = 'learning-empty';
    empty.textContent = '还没有记录。';
    root.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  let currentYear = null;
  let currentMonth = null;
  let yearSection = null;
  let monthSection = null;
  let dayList = null;

  normalized.forEach(item => {
    const [year, monthText, dayText] = item.date.split('-');
    const monthIndex = Number(monthText) - 1;
    const monthName = MONTH_NAMES[monthIndex];
    const monthShort = MONTH_SHORT[monthIndex];

    if (year !== currentYear) {
      currentYear = year;
      currentMonth = null;

      yearSection = document.createElement('section');
      yearSection.className = 'learning-year';
      yearSection.setAttribute('aria-labelledby', `learning-year-${year}`);

      const yearHeading = document.createElement('h3');
      yearHeading.id = `learning-year-${year}`;
      yearHeading.textContent = year;
      yearSection.append(yearHeading);
      fragment.append(yearSection);
    }

    if (monthText !== currentMonth) {
      currentMonth = monthText;

      monthSection = document.createElement('section');
      monthSection.className = 'learning-month';
      monthSection.setAttribute('aria-labelledby', `learning-month-${year}-${monthText}`);

      const monthHeading = document.createElement('h4');
      monthHeading.id = `learning-month-${year}-${monthText}`;
      monthHeading.textContent = monthName;

      dayList = document.createElement('div');
      dayList.className = 'learning-days';

      monthSection.append(monthHeading, dayList);
      yearSection.append(monthSection);
    }

    const day = document.createElement('article');
    day.className = 'learning-day';

    const time = document.createElement('time');
    time.className = 'learning-date';
    time.dateTime = item.date;
    time.innerHTML = `<span class="learning-date-day">${dayText}</span><span class="learning-date-mobile">${monthShort} ${dayText}</span>`;

    const entries = document.createElement('div');
    entries.className = 'learning-day-entries';

    item.entries.forEach(entry => {
      const entrySection = document.createElement('section');
      entrySection.className = 'learning-entry';
      if (entry.type) entrySection.dataset.type = entry.type;

      const area = document.createElement('p');
      area.className = 'learning-area';
      area.textContent = entry.area;

      const title = document.createElement('h5');
      title.textContent = entry.title;

      const summary = document.createElement('p');
      summary.className = 'learning-summary';
      summary.textContent = entry.summary;

      entrySection.append(area, title, summary);
      entries.append(entrySection);
    });

    day.append(time, entries);
    dayList.append(day);
  });

  root.replaceChildren(fragment);
})();
