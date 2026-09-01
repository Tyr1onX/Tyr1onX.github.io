(() => {
  const root = document.documentElement;
  const themeColors = { light: '#fafafa', dark: '#121212' };

  function applyTheme(theme, persist = false) {
    const next = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[next]);
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const label = next === 'dark' ? '切换到浅色模式' : '切换到深色模式';
      button.setAttribute('aria-label', label);
      button.setAttribute('title', label);
    });
    if (persist) {
      try { localStorage.setItem('tyr1onx-theme', next); } catch {}
    }
  }

  function readSidebarState() {
    try {
      const saved = localStorage.getItem('tyr1onx-sidebar');
      if (saved === 'expanded' || saved === 'collapsed') return saved;
    } catch {}
    return 'collapsed';
  }

  function applySidebar(state, persist = false) {
    const next = state === 'expanded' ? 'expanded' : 'collapsed';
    root.dataset.sidebar = next;
    const expanded = next === 'expanded';
    document.querySelectorAll('[data-sidebar-toggle]').forEach((button) => {
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', expanded ? '收起侧边栏' : '展开侧边栏');
      button.setAttribute('title', expanded ? '收起侧边栏' : '展开侧边栏');
    });
    document.querySelectorAll('[data-sidebar-toggle-icon]').forEach((icon) => {
      icon.textContent = expanded ? '‹' : '›';
    });
    if (persist) {
      try { localStorage.setItem('tyr1onx-sidebar', next); } catch {}
    }
  }

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
  });
  document.querySelectorAll('[data-sidebar-toggle]').forEach((button) => {
    button.addEventListener('click', () => applySidebar(root.dataset.sidebar === 'expanded' ? 'collapsed' : 'expanded', true));
  });

  applyTheme(root.dataset.theme);
  applySidebar(readSidebarState());

  document.querySelectorAll('[data-current-year]').forEach((node) => {
    node.textContent = String(new Date().getFullYear());
  });

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown || '').replaceAll('\r\n', '\n').split('\n');
    const output = [];
    let paragraph = [];
    let list = [];
    let quote = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (!list.length) return;
      output.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
      list = [];
    };
    const flushQuote = () => {
      if (!quote.length) return;
      output.push(`<blockquote>${quote.map(inlineMarkdown).join('<br />')}</blockquote>`);
      quote = [];
    };
    const flushAll = () => { flushParagraph(); flushList(); flushQuote(); };

    lines.forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (index === 0 && line.startsWith('# ')) return;
      if (!line) { flushAll(); return; }
      if (line === '---') { flushAll(); output.push('<hr />'); return; }
      if (line.startsWith('### ')) { flushAll(); output.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`); return; }
      if (line.startsWith('## ')) { flushAll(); output.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`); return; }
      if (line.startsWith('> ')) { flushParagraph(); flushList(); quote.push(line.slice(2)); return; }
      if (line.startsWith('* ') || line.startsWith('- ')) { flushParagraph(); flushQuote(); list.push(line.slice(2)); return; }
      flushList();
      flushQuote();
      paragraph.push(line);
    });

    flushAll();
    return output.join('');
  }

  function noteTimestamp(note) {
    if (note?.datetime) {
      const direct = Date.parse(note.datetime);
      if (Number.isFinite(direct)) return direct;
    }
    const date = String(note?.date || '').replaceAll('.', '-');
    const clock = note?.time || '00:00';
    const fallback = Date.parse(`${date}T${clock}:00+08:00`);
    return Number.isFinite(fallback) ? fallback : 0;
  }

  const notes = [...(Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [])]
    .sort((a, b) => noteTimestamp(b) - noteTimestamp(a));

  function noteUrl(note) {
    return `./note.html?id=${encodeURIComponent(note.id)}`;
  }

  function renderNoteLists() {
    document.querySelectorAll('[data-note-list]').forEach((container) => {
      if (!notes.length) {
        container.innerHTML = '<p class="note-list-empty">这里暂时还没有文字。</p>';
        return;
      }
      container.innerHTML = notes.map((note) => `
        <a class="note-list-item" href="${noteUrl(note)}">
          <time datetime="${escapeHtml(note.datetime || '')}">${escapeHtml(note.date || '')}</time>
          <div class="note-list-copy">
            <h2>${escapeHtml(note.title)}</h2>
            ${note.excerpt ? `<p>${escapeHtml(note.excerpt)}</p>` : ''}
          </div>
        </a>
      `).join('');
    });
  }

  async function readNoteBody(note) {
    if (typeof note?.markdown === 'string') return renderMarkdown(note.markdown);
    if (note?.contentUrl) {
      const response = await fetch(note.contentUrl, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Unable to load note body: ${response.status}`);
      return renderMarkdown(await response.text());
    }
    const paragraphs = Array.isArray(note?.content) ? note.content : [note?.content].filter(Boolean);
    return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
  }

  async function renderArticle() {
    const article = document.querySelector('[data-note-article]');
    if (!article) return;

    const id = new URLSearchParams(location.search).get('id');
    const index = Math.max(0, notes.findIndex((note) => note.id === id));
    const note = notes[index];
    if (!note) {
      article.innerHTML = '<p class="loading-copy">这里暂时没有可读取的文字。</p>';
      return;
    }

    document.title = `${note.title} — Tyr1onX`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', note.excerpt || 'Tyr1onX 留下来的一段文字。');
    article.innerHTML = `
      <header class="article-header">
        <time datetime="${escapeHtml(note.datetime || '')}">${escapeHtml(note.date || '')}</time>
        <h1>${escapeHtml(note.title)}</h1>
        ${note.source ? `<p class="article-source">${escapeHtml(note.source)}</p>` : ''}
      </header>
      <div class="article-body"><p class="loading-copy">正在读取这段文字……</p></div>
    `;

    const body = article.querySelector('.article-body');
    try {
      if (body) body.innerHTML = await readNoteBody(note);
    } catch (error) {
      console.error(error);
      if (body) body.innerHTML = '<p>这段文字暂时没有加载成功，请稍后刷新。</p>';
    }

    const navigation = document.querySelector('[data-note-navigation]');
    if (!navigation) return;
    const newer = notes[index - 1];
    const older = notes[index + 1];
    navigation.innerHTML = `
      ${newer ? `<a href="${noteUrl(newer)}"><span>更新一篇</span><strong>${escapeHtml(newer.title)}</strong></a>` : '<span></span>'}
      ${older ? `<a href="${noteUrl(older)}"><span>更早一篇</span><strong>${escapeHtml(older.title)}</strong></a>` : '<span></span>'}
    `;
  }

  renderNoteLists();
  void renderArticle();
})();
