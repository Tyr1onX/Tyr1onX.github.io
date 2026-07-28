(() => {
  if (document.body.dataset.page !== "notes") return;

  const DRAFT_KEY = "tyr1onx-note-owner-draft-v1";
  const notes = Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [];
  let layer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function localDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function defaultDraft() {
    const date = localDate();
    return {
      id: `${date}-note`,
      date,
      title: "",
      tags: "",
      excerpt: "",
      markdown: "",
    };
  }

  function readDraft() {
    try {
      const stored = JSON.parse(localStorage.getItem(DRAFT_KEY));
      return { ...defaultDraft(), ...(stored && typeof stored === "object" ? stored : {}) };
    } catch {
      return defaultDraft();
    }
  }

  function formValues(form) {
    return {
      id: form.elements.id.value.trim(),
      date: form.elements.date.value,
      title: form.elements.title.value.trim(),
      tags: form.elements.tags.value.trim(),
      excerpt: form.elements.excerpt.value.trim(),
      markdown: form.elements.markdown.value,
    };
  }

  function setStatus(message) {
    const status = layer?.querySelector(".note-owner-status");
    if (status) status.textContent = message;
  }

  function saveDraft(form) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formValues(form)));
    setStatus("草稿已保存在当前浏览器");
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  function publishPackage(values) {
    const tags = values.tags
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const id = values.id || `${values.date}-note`;

    return {
      metadata: {
        id,
        date: values.date.replaceAll("-", "."),
        datetime: `${values.date}T12:00:00+08:00`,
        title: values.title,
        tags,
        category: tags[0] || "文字",
        excerpt: values.excerpt,
        contentUrl: `./notes/${id}.md`,
      },
      markdown: values.markdown,
    };
  }

  function downloadMarkdown(values) {
    const blob = new Blob([values.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${values.id || "note"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function bodyFor(note) {
    if (typeof note?.markdown === "string") return note.markdown;
    if (note?.contentUrl) {
      const response = await fetch(note.contentUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load note: ${response.status}`);
      return response.text();
    }
    return Array.isArray(note?.content) ? note.content.join("\n\n") : String(note?.content || "");
  }

  function fillForm(form, values) {
    form.elements.id.value = values.id || "";
    form.elements.date.value = values.date || localDate();
    form.elements.title.value = values.title || "";
    form.elements.tags.value = values.tags || "";
    form.elements.excerpt.value = values.excerpt || "";
    form.elements.markdown.value = values.markdown || "";
  }

  async function loadExisting(form, id) {
    if (!id) {
      fillForm(form, defaultDraft());
      saveDraft(form);
      setStatus("已开始一篇新文字");
      return;
    }

    const note = notes.find((item) => item.id === id);
    if (!note) return;

    setStatus("正在载入已有文字……");
    try {
      fillForm(form, {
        id: note.id,
        date: String(note.date || "").replaceAll(".", "-"),
        title: note.title,
        tags: (Array.isArray(note.tags) ? note.tags : [note.category].filter(Boolean)).join("，"),
        excerpt: note.excerpt,
        markdown: await bodyFor(note),
      });
      saveDraft(form);
      setStatus("已载入，可在本地修改后导出");
    } catch (error) {
      console.error(error);
      setStatus("载入失败，请稍后重试");
    }
  }

  function closeEditor() {
    if (!layer) return;
    layer.remove();
    layer = null;
    document.body.style.removeProperty("overflow");
  }

  function openEditor() {
    if (layer) return;

    const draft = readDraft();
    layer = document.createElement("div");
    layer.className = "note-owner-layer";
    layer.innerHTML = `
      <section class="note-owner-panel" role="dialog" aria-modal="true" aria-labelledby="note-owner-title">
        <header class="note-owner-head">
          <div>
            <h2 id="note-owner-title">文字编辑</h2>
            <p>内容只保存在当前浏览器，不会自动上传或向访客展示。</p>
          </div>
          <button class="note-owner-close" type="button" aria-label="关闭编辑器">×</button>
        </header>

        <label class="note-owner-field">
          载入已有文字
          <select name="existing">
            <option value="">新文字</option>
            ${notes
              .map((note) => `<option value="${escapeHtml(note.id)}">${escapeHtml(note.date)} · ${escapeHtml(note.title)}</option>`)
              .join("")}
          </select>
        </label>

        <form class="note-owner-grid">
          <label class="note-owner-field">
            日期
            <input name="date" type="date" required />
          </label>
          <label class="note-owner-field">
            文件标识
            <input name="id" autocomplete="off" required />
          </label>
          <label class="note-owner-field note-owner-field-wide">
            标题
            <input name="title" autocomplete="off" required />
          </label>
          <label class="note-owner-field note-owner-field-wide">
            标签（用逗号分隔）
            <input name="tags" autocomplete="off" />
          </label>
          <label class="note-owner-field note-owner-field-wide">
            摘要
            <input name="excerpt" autocomplete="off" />
          </label>
          <label class="note-owner-field note-owner-field-wide">
            正文（Markdown）
            <textarea name="markdown" spellcheck="true"></textarea>
          </label>
        </form>

        <div class="note-owner-actions">
          <p class="note-owner-status">草稿只存在此设备</p>
          <div>
            <button class="note-owner-button" data-action="clear" type="button">清空草稿</button>
            <button class="note-owner-button" data-action="download" type="button">下载 Markdown</button>
            <button class="note-owner-button note-owner-button-primary" data-action="copy" type="button">复制发布包</button>
          </div>
        </div>
      </section>
    `;

    document.body.append(layer);
    document.body.style.overflow = "hidden";

    const form = layer.querySelector("form");
    const existing = layer.querySelector('select[name="existing"]');
    if (!(form instanceof HTMLFormElement) || !(existing instanceof HTMLSelectElement)) return;

    fillForm(form, draft);
    form.addEventListener("input", () => saveDraft(form));
    existing.addEventListener("change", () => loadExisting(form, existing.value));

    layer.querySelector(".note-owner-close")?.addEventListener("click", closeEditor);
    layer.addEventListener("click", (event) => {
      if (event.target === layer) closeEditor();
    });

    layer.querySelector('[data-action="clear"]')?.addEventListener("click", () => {
      localStorage.removeItem(DRAFT_KEY);
      existing.value = "";
      fillForm(form, defaultDraft());
      setStatus("草稿已清空");
    });

    layer.querySelector('[data-action="download"]')?.addEventListener("click", () => {
      const values = formValues(form);
      saveDraft(form);
      downloadMarkdown(values);
      setStatus("Markdown 已下载");
    });

    layer.querySelector('[data-action="copy"]')?.addEventListener("click", async () => {
      const values = formValues(form);
      saveDraft(form);
      try {
        await copyText(JSON.stringify(publishPackage(values), null, 2));
        setStatus("发布包已复制，可直接交给 GitHub 或 AI 提交");
      } catch (error) {
        console.error(error);
        setStatus("复制失败，请使用下载功能");
      }
    });

    form.elements.title.focus();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && layer) {
      closeEditor();
      return;
    }

    if (event.altKey && event.shiftKey && event.key.toLowerCase() === "e") {
      event.preventDefault();
      if (layer) closeEditor();
      else openEditor();
    }
  });

  if (window.location.hash === "#owner-editor") {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    openEditor();
  }
})();
