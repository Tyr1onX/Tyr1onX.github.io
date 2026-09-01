const root = document.documentElement;
root.classList.add("js");

let storedTheme = null;
try {
  storedTheme = localStorage.getItem("tyr1onx-theme");
} catch {
  storedTheme = null;
}

const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = storedTheme || (prefersDark ? "dark" : "light");

function applyTheme(theme) {
  root.dataset.theme = theme;
  document.querySelector(".theme-toggle")?.setAttribute(
    "aria-label",
    theme === "dark" ? "切换到浅色模式" : "切换到深色模式"
  );
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0d0d10" : "#f7f7fa"
  );
}

applyTheme(initialTheme);

document.querySelector(".theme-toggle")?.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("tyr1onx-theme", next);
  } catch {
    // Theme switching still works for the current page when storage is unavailable.
  }
  applyTheme(next);
});

const siteHeader = document.querySelector(".site-header");
let headerFrame = 0;

function updateHeader() {
  headerFrame = 0;
  siteHeader?.setAttribute("data-scrolled", String(scrollY > 8));
}

function scheduleHeaderUpdate() {
  if (!headerFrame) headerFrame = requestAnimationFrame(updateHeader);
}

updateHeader();
addEventListener("scroll", scheduleHeaderUpdate, { passive: true });

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());

const revealElements = document.querySelectorAll(".reveal");
if (revealElements.length && "IntersectionObserver" in window) {
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderMarkdown(markdown) {
  const lines = String(markdown || "").replaceAll("\r\n", "\n").split("\n");
  const output = [];
  let paragraph = [];
  let list = [];
  let quote = [];
  let codeBlock = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    output.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  const flushQuote = () => {
    if (!quote.length) return;
    output.push(`<blockquote>${quote.map(inlineMarkdown).join("<br />")}</blockquote>`);
    quote = [];
  };

  const flushCodeBlock = () => {
    if (!codeBlock.length) return;
    output.push(`<pre><code>${escapeHtml(codeBlock.join("\n"))}</code></pre>`);
    codeBlock = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushAll();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeBlock.push(rawLine);
      return;
    }
    if (index === 0 && line.startsWith("# ")) return;

    if (!line) {
      flushAll();
      return;
    }
    if (line === "---") {
      flushAll();
      output.push("<hr />");
      return;
    }
    if (line.startsWith("### ")) {
      flushAll();
      output.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      return;
    }
    if (line.startsWith("## ")) {
      flushAll();
      output.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      return;
    }
    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      quote.push(line.slice(2));
      return;
    }
    if (line.startsWith("* ") || line.startsWith("- ")) {
      flushParagraph();
      flushQuote();
      list.push(line.slice(2));
      return;
    }

    flushList();
    flushQuote();
    paragraph.push(line);
  });

  flushAll();
  return output.join("");
}

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
window.TYR1ONX_SORTED_NOTES = notes;

function noteUrl(note) {
  return `./note.html?id=${encodeURIComponent(note.id)}`;
}

function noteKind(note) {
  return note?.kind === "work" ? "work" : "essay";
}

function noteKindLabel(note) {
  return noteKind(note) === "work" ? "工作与技术" : "随笔";
}

function renderKindMarker(note) {
  return `<span class="note-kind-marker" role="img" aria-label="${noteKindLabel(note)}"></span>`;
}

function renderArchive() {
  const container = document.querySelector("#notes-grid");
  if (!container) return;

  container.innerHTML = notes.map((note) => `
    <a class="archive-row archive-row-v2 note-kind-${noteKind(note)}" href="${noteUrl(note)}">
      <div class="archive-row-main">
        <div class="archive-row-meta">
          ${renderKindMarker(note)}
          <time datetime="${escapeHtml(note.datetime || "")}">${escapeHtml(note.date)}</time>
        </div>
        <h2>${escapeHtml(note.title)}</h2>
        ${note.excerpt ? `<p>${escapeHtml(note.excerpt)}</p>` : ""}
      </div>
      <span class="archive-row-arrow" aria-hidden="true">→</span>
    </a>
  `).join("");
}

async function readNoteBody(note) {
  if (typeof note?.markdown === "string") return renderMarkdown(note.markdown);

  if (note?.contentUrl) {
    const response = await fetch(note.contentUrl, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Unable to load note body: ${response.status}`);
    return renderMarkdown(await response.text());
  }

  const paragraphs = Array.isArray(note?.content) ? note.content : [note?.content].filter(Boolean);
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

async function renderNote() {
  const article = document.querySelector("#note-article");
  if (!article) return;

  const id = new URLSearchParams(location.search).get("id");
  const index = notes.findIndex((note) => note.id === id);
  const resolvedIndex = index >= 0 ? index : 0;
  const note = notes[resolvedIndex];

  if (!note) {
    article.innerHTML = "<p>这里暂时没有可读取的文字。</p>";
    return;
  }

  document.title = `${note.title} — Tyr1onX`;
  article.innerHTML = `
    <header class="note-kind-${noteKind(note)}">
      <div class="article-meta-line">
        ${renderKindMarker(note)}
        <time datetime="${escapeHtml(note.datetime || "")}">${escapeHtml(note.date)}</time>
      </div>
      <h1>${escapeHtml(note.title)}</h1>
      ${note.source ? `<p class="article-source">${escapeHtml(note.source)}</p>` : ""}
    </header>
    <div class="article-body"><p class="loading-copy">正在读取这段文字……</p></div>
  `;

  const articleBody = article.querySelector(".article-body");
  try {
    if (articleBody) articleBody.innerHTML = await readNoteBody(note);
  } catch (error) {
    console.error(error);
    if (articleBody) articleBody.innerHTML = "<p>这段文字暂时没有加载成功，请稍后刷新。</p>";
  }

  const navigation = document.querySelector("#note-navigation");
  if (!navigation) return;

  const newer = notes[resolvedIndex - 1];
  const older = notes[resolvedIndex + 1];
  navigation.innerHTML = `
    ${newer
      ? `<a href="${noteUrl(newer)}"><span>更新一篇</span><strong>${escapeHtml(newer.title)}</strong></a>`
      : "<span></span>"}
    ${older
      ? `<a href="${noteUrl(older)}"><span>更早一篇</span><strong>${escapeHtml(older.title)}</strong></a>`
      : "<span></span>"}
  `;
}

renderArchive();
void renderNote();