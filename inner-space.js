(() => {
  if (document.body?.dataset.page !== "note") return;

  const main = document.querySelector(".article-main");
  const article = document.querySelector("#note-article");
  if (!(main instanceof HTMLElement) || !(article instanceof HTMLElement)) return;

  let readingFrame = 0;
  let path = null;
  let body = null;
  let headings = [];
  let resizeObserver = null;
  let listenersBound = false;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const isHan = (character) => /[\u3400-\u9fff]/.test(character);

  const normalizeChineseText = (value) => {
    let text = String(value || "")
      .replace(/—[-一]/g, "——")
      .replace(/\s+([，。！？；：、”’》）】])/g, "$1")
      .replace(/([“‘《（【])\s+/g, "$1");

    let previous = "";
    while (text !== previous) {
      previous = text;
      text = text.replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2");
    }

    return text;
  };

  const normalizeEssayBody = () => {
    if (!(body instanceof HTMLElement) || body.dataset.normalized === "true") return;

    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((node) => {
      const value = node.nodeValue || "";
      if (![...value].some(isHan)) return;
      node.nodeValue = normalizeChineseText(value);
    });

    body.dataset.normalized = "true";
  };

  const paintReadingPath = () => {
    readingFrame = 0;
    if (!(path instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

    const articleRect = article.getBoundingClientRect();
    const startLine = window.innerHeight * 0.26;
    const endLine = window.innerHeight * 0.74;
    const travel = Math.max(1, articleRect.height - (endLine - startLine));
    const progress = clamp((startLine - articleRect.top) / travel, 0, 1);
    path.style.setProperty("--reading-progress", progress.toFixed(4));

    const bodyHeight = Math.max(1, body.offsetHeight);
    const nodes = [...path.querySelectorAll(".reading-path-node")];
    nodes.forEach((node, index) => {
      const heading = headings[index];
      if (!(node instanceof HTMLElement) || !(heading instanceof HTMLElement)) return;

      const position = clamp((heading.offsetTop / bodyHeight) * 100, 0, 100);
      node.style.top = `${position.toFixed(2)}%`;
      node.classList.toggle("is-read", position / 100 <= progress + 0.01);
    });
  };

  const scheduleReadingPathPaint = () => {
    if (!readingFrame) readingFrame = requestAnimationFrame(paintReadingPath);
  };

  const buildReadingPath = () => {
    const resolvedBody = article.querySelector(".article-body");
    if (!(resolvedBody instanceof HTMLElement) || resolvedBody.querySelector(".loading-copy")) return;

    body = resolvedBody;

    const header = article.querySelector("header");
    const kindClass = header?.classList.contains("note-kind-work") ? "note-kind-work" : "note-kind-essay";
    const isTechnical = kindClass === "note-kind-work";

    article.classList.remove("note-kind-work", "note-kind-essay");
    article.classList.add(kindClass, isTechnical ? "note-format-technical" : "note-format-essay");
    body.classList.add(isTechnical ? "article-body-technical" : "article-body-essay");

    if (!isTechnical) normalizeEssayBody();
    headings = isTechnical ? [...body.querySelectorAll("h2, h3")] : [];

    if (!(path instanceof HTMLElement)) {
      path = document.createElement("aside");
      path.className = "reading-path";
      path.id = "reading-path";
      path.setAttribute("aria-hidden", "true");
      path.innerHTML = [
        '<span class="reading-path-label">阅读进度</span>',
        '<span class="reading-path-track"></span>',
        '<span class="reading-path-fill"></span>',
        '<span class="reading-path-current"></span>',
        '<span class="reading-path-nodes"></span>',
      ].join("");
      main.append(path);
    }

    path.classList.remove("note-kind-work", "note-kind-essay");
    path.classList.add(kindClass);

    const nodeLayer = path.querySelector(".reading-path-nodes");
    if (nodeLayer instanceof HTMLElement) {
      nodeLayer.innerHTML = headings.map(() => '<span class="reading-path-node"></span>').join("");
    }

    if (!listenersBound) {
      addEventListener("scroll", scheduleReadingPathPaint, { passive: true });
      addEventListener("resize", scheduleReadingPathPaint, { passive: true });
      addEventListener("pageshow", scheduleReadingPathPaint);
      listenersBound = true;
    }

    resizeObserver?.disconnect();
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(scheduleReadingPathPaint);
      resizeObserver.observe(body);
      resizeObserver.observe(article);
    }

    scheduleReadingPathPaint();
  };

  const articleObserver = new MutationObserver(buildReadingPath);
  articleObserver.observe(article, { childList: true, subtree: true });
  buildReadingPath();
})();