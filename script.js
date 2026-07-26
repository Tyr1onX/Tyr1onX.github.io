const root = document.documentElement;
root.classList.add("js");

const storedTheme = localStorage.getItem("tyr1onx-theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = storedTheme || (prefersDark ? "dark" : "light");

function applyTheme(theme) {
  root.dataset.theme = theme;
  const toggle = document.querySelector(".theme-toggle");
  toggle?.setAttribute("aria-label", theme === "dark" ? "切换到浅色模式" : "切换到深色模式");
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0d0d10" : "#f7f7fa");
}

applyTheme(initialTheme);

document.querySelector(".theme-toggle")?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("tyr1onx-theme", next);
  applyTheme(next);
});

const siteHeader = document.querySelector(".site-header");
function updateHeader() {
  siteHeader?.setAttribute("data-scrolled", String(window.scrollY > 8));
}
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const revealElements = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.1 }
  );
  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

function updateClock() {
  const time = document.querySelector("#current-time");
  if (!(time instanceof HTMLTimeElement)) return;

  const now = new Date();
  time.dateTime = now.toISOString();
  time.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function setOrbitPhase() {
  const project = document.querySelector(".orbit-project");
  if (!(project instanceof HTMLElement)) return;

  const now = new Date();
  const elapsedSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const dayProgress = elapsedSeconds / 86400;
  const orbitDuration = 34;
  project.style.setProperty("--orbit-delay", `${-(dayProgress * orbitDuration)}s`);
}

updateClock();
setOrbitPhase();
window.setInterval(updateClock, 1000);

function noteTimestamp(note) {
  if (note?.datetime) {
    const direct = Date.parse(note.datetime);
    if (Number.isFinite(direct)) return direct;
  }

  const date = String(note?.date || "").replaceAll(".", "-");
  const clock = note?.time || "00:00";
  const fallback = Date.parse(`${date}T${clock}:00+08:00`);
  return Number.isFinite(fallback) ? fallback : 0;
}

const rawNotes = Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [];
const notes = [...rawNotes].sort((left, right) => noteTimestamp(right) - noteTimestamp(left));

function noteUrl(note) {
  return `./note.html?id=${encodeURIComponent(note.id)}`;
}

function renderHomeNotes() {
  const container = document.querySelector("#home-notes");
  if (!container) return;

  container.innerHTML = notes
    .slice(0, 6)
    .map(
      (note) => `
        <a class="writing-row" href="${noteUrl(note)}">
          <time datetime="${note.datetime || ""}">${note.date}${note.time ? ` · ${note.time}` : ""}</time>
          <h3>${note.title}</h3>
          <span aria-hidden="true">→</span>
        </a>
      `
    )
    .join("");
}

function renderArchive() {
  const container = document.querySelector("#notes-grid");
  if (!container) return;

  container.innerHTML = notes
    .map(
      (note) => `
        <a class="archive-row" href="${noteUrl(note)}">
          <time datetime="${note.datetime || ""}">${note.date}${note.time ? ` · ${note.time}` : ""}</time>
          <div class="archive-row-copy">
            <h2>${note.title}</h2>
            ${note.excerpt ? `<p>${note.excerpt}</p>` : ""}
          </div>
          <span aria-hidden="true">→</span>
        </a>
      `
    )
    .join("");
}

function renderNote() {
  const article = document.querySelector("#note-article");
  if (!article) return;

  const id = new URLSearchParams(window.location.search).get("id");
  const index = notes.findIndex((note) => note.id === id);
  const note = index >= 0 ? notes[index] : notes[0];

  if (!note) {
    article.innerHTML = "<p>这里暂时没有可读取的文字。</p>";
    return;
  }

  document.title = `${note.title} — Tyr1onX`;

  const paragraphs = Array.isArray(note.content) ? note.content : [note.content].filter(Boolean);
  article.innerHTML = `
    <header>
      <p class="article-category">${note.category || "文字"}</p>
      <h1>${note.title}</h1>
      <p class="article-meta">${note.date}${note.time ? ` · ${note.time}` : ""}</p>
      ${note.source ? `<p class="article-source">${note.source}</p>` : ""}
    </header>
    <div class="article-body">
      ${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
    </div>
  `;

  const navigation = document.querySelector("#note-navigation");
  if (!navigation) return;

  const newer = notes[index - 1];
  const older = notes[index + 1];
  navigation.innerHTML = `
    ${
      newer
        ? `<a href="${noteUrl(newer)}"><span>更新一篇</span><strong>${newer.title}</strong></a>`
        : "<span></span>"
    }
    ${
      older
        ? `<a href="${noteUrl(older)}"><span>更早一篇</span><strong>${older.title}</strong></a>`
        : "<span></span>"
    }
  `;
}

renderHomeNotes();
renderArchive();
renderNote();
