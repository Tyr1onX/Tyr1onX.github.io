(() => {
  const rawNotes = Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [];

  function noteTimestamp(note) {
    if (note?.datetime) {
      const direct = Date.parse(note.datetime);
      if (Number.isFinite(direct)) return direct;
    }

    const date = String(note?.date || "").replaceAll(".", "-");
    const fallback = Date.parse(`${date}T00:00:00+08:00`);
    return Number.isFinite(fallback) ? fallback : 0;
  }

  const notes = [...rawNotes].sort((left, right) => noteTimestamp(right) - noteTimestamp(left));

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

    const flushAll = () => {
      flushParagraph();
      flushList();
      flushQuote();
    };

    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();

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

  function noteUrl(note) {
    return `./note.html?id=${encodeURIComponent(note.id)}`;
  }

  function noteTags(note) {
    if (Array.isArray(note?.tags)) return note.tags.filter(Boolean);
    return note?.category ? [note.category] : [];
  }

  function renderTags(note, className = "note-tags") {
    const tags = noteTags(note);
    if (!tags.length) return "";

    return `<span class="${className}">${tags
      .map((tag) => `<span class="note-tag">${escapeHtml(tag)}</span>`)
      .join("")}</span>`;
  }

  function renderArchive() {
    const container = document.querySelector("#notes-grid");
    if (!container) return;

    container.innerHTML = notes
      .map(
        (note) => `
          <a class="archive-row archive-row-v2" href="${noteUrl(note)}">
            <div class="archive-row-main">
              <div class="archive-row-meta">
                <time datetime="${escapeHtml(note.datetime || "")}">${escapeHtml(note.date)}</time>
                ${renderTags(note)}
              </div>
              <h2>${escapeHtml(note.title)}</h2>
              ${note.excerpt ? `<p>${escapeHtml(note.excerpt)}</p>` : ""}
            </div>
            <span class="archive-row-arrow" aria-hidden="true">→</span>
          </a>
        `
      )
      .join("");
  }

  async function readNoteBody(note) {
    if (typeof note?.markdown === "string") return renderMarkdown(note.markdown);

    if (note?.contentUrl) {
      const response = await fetch(note.contentUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load note body: ${response.status}`);
      return renderMarkdown(await response.text());
    }

    const paragraphs = Array.isArray(note?.content) ? note.content : [note?.content].filter(Boolean);
    return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  }

  async function renderNote() {
    const article = document.querySelector("#note-article");
    if (!article) return;

    const id = new URLSearchParams(window.location.search).get("id");
    const index = notes.findIndex((note) => note.id === id);
    const resolvedIndex = index >= 0 ? index : 0;
    const note = notes[resolvedIndex];

    if (!note) {
      article.innerHTML = "<p>这里暂时没有可读取的文字。</p>";
      return;
    }

    document.title = `${note.title} — Tyr1onX`;
    article.innerHTML = `
      <header>
        <div class="article-meta-line">
          <time datetime="${escapeHtml(note.datetime || "")}">${escapeHtml(note.date)}</time>
          ${renderTags(note, "article-tags note-tags")}
        </div>
        <h1>${escapeHtml(note.title)}</h1>
        ${note.source ? `<p class="article-source">${escapeHtml(note.source)}</p>` : ""}
      </header>
      <div class="article-body"><p class="loading-copy">正在读取这段文字……</p></div>
    `;

    const body = article.querySelector(".article-body");

    try {
      if (body) body.innerHTML = await readNoteBody(note);
    } catch (error) {
      console.error(error);
      if (body) body.innerHTML = "<p>这段文字暂时没有加载成功，请稍后刷新。</p>";
    }

    const navigation = document.querySelector("#note-navigation");
    if (!navigation) return;

    const newer = notes[resolvedIndex - 1];
    const older = notes[resolvedIndex + 1];
    navigation.innerHTML = `
      ${
        newer
          ? `<a href="${noteUrl(newer)}"><span>更新一篇</span><strong>${escapeHtml(newer.title)}</strong></a>`
          : "<span></span>"
      }
      ${
        older
          ? `<a href="${noteUrl(older)}"><span>更早一篇</span><strong>${escapeHtml(older.title)}</strong></a>`
          : "<span></span>"
      }
    `;
  }

  renderArchive();
  renderNote();
})();
