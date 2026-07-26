const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const year = document.querySelector('#current-year');
const header = document.querySelector('.site-header');
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

const storedTheme = localStorage.getItem('tyr1onx-theme');
const initialTheme = storedTheme || (mediaQuery.matches ? 'dark' : 'light');

function applyTheme(theme) {
  const isDark = theme === 'dark';
  root.dataset.theme = theme;
  themeToggle?.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark ? '#0a0a0b' : '#f5f5f7');
}

applyTheme(initialTheme);

themeToggle?.addEventListener('click', () => {
  const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('tyr1onx-theme', nextTheme);
  applyTheme(nextTheme);
});

mediaQuery.addEventListener?.('change', (event) => {
  if (localStorage.getItem('tyr1onx-theme')) return;
  applyTheme(event.matches ? 'dark' : 'light');
});

if (year) {
  year.textContent = String(new Date().getFullYear());
}

function updateHeader() {
  header?.setAttribute('data-scrolled', String(window.scrollY > 8));
}

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

const revealElements = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -32px' }
  );

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}
