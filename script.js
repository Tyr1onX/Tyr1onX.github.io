const root = document.documentElement;
root.classList.add("js");
const storedTheme = localStorage.getItem("tyr1onx-theme");
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = storedTheme || (systemPrefersDark ? "dark" : "light");
function applyTheme(theme) {
  root.dataset.theme = theme;
  const toggle = document.querySelector(".theme-toggle");
  toggle?.setAttribute(
    "aria-label",
    theme === "dark" ? "切换到浅色模式" : "切换到深色模式"
  );
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#000000" : "#f5f5f7");
}
applyTheme(initialTheme);
document.querySelector(".theme-toggle")?.addEventListener("click", () => {
  const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("tyr1onx-theme", nextTheme);
  applyTheme(nextTheme);
});
const header = document.querySelector(".site-header");
function updateHeaderState() {
  header?.setAttribute("data-scrolled", String(window.scrollY > 8));
}
updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });
const year = document.querySelector("#current-year");
if (year) year.textContent = String(new Date().getFullYear());
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
    { threshold: 0.08, rootMargin: "0px 0px -32px" }
  );
  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}
const notes = Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [];
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function noteHref(note) {
  return `./note.html?id=${encodeURIComponent(note.id)}`;
}
function createNoteTop(note) {
  const top = createElement("div", "note-card-top");
  top.append(createElement("span", "", note.category));
  if (note.source) {
    top.append(createElement("span", "note-source-badge", "摘录"));
  }
  return top;
}
function renderHomeNotes() {
  const container = document.querySelector("#home-notes");
  if (!container) return;
  notes.slice(0, 3).forEach((note) => {
    const card = createElement("a", "home-note-card reveal");
    card.href = noteHref(note);
    card.append(createNoteTop(note));
    card.append(createElement("h3", "", note.title));
    card.append(createElement("p", "", note.excerpt));
    card.append(
      createElement("time", "note-card-time", `${note.date} · ${note.time}`)
    );
    card.querySelector("time").dateTime = note.datetime;
    container.append(card);
  });
  requestAnimationFrame(() => {
    container.querySelectorAll(".reveal").forEach((element) => {
      element.classList.add("is-visible");
    });
  });
}
function renderNotesArchive() {
  const container = document.querySelector("#notes-grid");
  if (!container) return;
  const count = document.querySelector("#note-count");
  if (count) count.textContent = `${notes.length} 条`;
  if (!notes.length) {
    container.append(createElement("p", "empty-copy", "还没有可显示的文字。"));
    return;
  }
  notes.forEach((note) => {
    const card = createElement("a", "archive-card reveal");
    card.href = noteHref(note);
    card.append(createNoteTop(note));
    card.append(createElement("h2", "", note.title));
    card.append(createElement("p", "", note.excerpt));
    const footer = document.createElement("footer");
    const time = createElement("time", "", `${note.date} · ${note.time}`);
    time.dateTime = note.datetime;
    footer.append(time, createElement("span", "", "阅读全文 →"));
    card.append(footer);
    container.append(card);
  });
  requestAnimationFrame(() => {
    container.querySelectorAll(".reveal").forEach((element) => {
      element.classList.add("is-visible");
    });
  });
}
function createNavigationLink(note, label) {
  const link = createElement("a", "note-nav-link");
  link.href = noteHref(note);
  link.append(createElement("span", "", label));
  link.append(createElement("strong", "", note.title));
  return link;
}
function renderNoteArticle() {
  const article = document.querySelector("#note-article");
  if (!article) return;
  const id = new URLSearchParams(window.location.search).get("id");
  const index = notes.findIndex((note) => note.id === id);
  const note = notes[index];
  article.replaceChildren();
  if (!note) {
    document.title = "没有找到这段文字 — Tyr1onX";
    article.append(createElement("p", "section-label", "文字"));
    article.append(createElement("h1", "", "没有找到这段文字。"));
    article.append(
      createElement(
        "p",
        "empty-copy",
        "链接可能已经失效，或者这段文字还没有被发布。"
      )
    );
    return;
  }
  document.title = `${note.title} — Tyr1onX`;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", note.excerpt);
  const meta = createElement("div", "article-meta");
  meta.append(createElement("span", "article-category", note.category));
  const time = createElement("time", "", `${note.date} · ${note.time}`);
  time.dateTime = note.datetime;
  meta.append(time);
  article.append(meta);
  article.append(createElement("h1", "", note.title));
  if (note.source) {
    article.append(
      createElement("p", "article-source", `来源说明：${note.source}`)
    );
  }
  const body = createElement("div", "article-body");
  note.content.forEach((paragraph) => {
    body.append(createElement("p", "", paragraph));
  });
  article.append(body);
  const signature = createElement("div", "article-signature");
  const avatar = document.createElement("img");
  avatar.src = "./avatar.svg";
  avatar.alt = "";
  const signatureCopy = document.createElement("div");
  signatureCopy.append(createElement("strong", "", "Tyr1onX"));
  signatureCopy.append(
    createElement(
      "span",
      "",
      note.source ? "收藏并保留于个人文字归档" : `写于 ${note.date} ${note.time}`
    )
  );
  signature.append(avatar, signatureCopy);
  article.append(signature);
  const navigation = document.querySelector("#note-navigation");
  if (!navigation) return;
  navigation.replaceChildren();
  const newer = notes[index - 1];
  const older = notes[index + 1];
  if (newer) navigation.append(createNavigationLink(newer, "更新一篇"));
  if (older) navigation.append(createNavigationLink(older, "更早一篇"));
}
renderHomeNotes();
renderNotesArchive();
renderNoteArticle();
