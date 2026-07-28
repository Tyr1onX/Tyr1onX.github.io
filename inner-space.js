(() => {
  const page = document.body?.dataset.page;
  if (!page || !["notes", "note", "keke"].includes(page)) return;

  requestAnimationFrame(() => document.body.classList.add("inner-space-ready"));

  if (page !== "note") return;

  const main = document.querySelector(".article-main");
  const article = document.querySelector("#note-article");
  if (!(main instanceof HTMLElement) || !(article instanceof HTMLElement)) return;

  let readingFrame = 0;
  let path = null;
  let body = null;
  let headings = [];
  let resizeObserver = null;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const paintReadingPath = () => {
    readingFrame = 0;
    if (!(path instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

    const articleRect = article.getBoundingClientRect();
    const travel = Math.max(1, article.offsetHeight - window.innerHeight * 0.42);
    const progress = clamp((window.innerHeight * 0.3 - articleRect.top) / travel, 0, 1);
    path.style.setProperty("--reading-progress", progress.toFixed(4));

    const bodyHeight = Math.max(1, body.offsetHeight);
    const nodes = [...path.querySelectorAll(".reading-path-node")];
    nodes.forEach((node, index) => {
      const heading = headings[index];
      if (!(node instanceof HTMLElement) || !(heading instanceof HTMLElement)) return;
      node.style.top = `${clamp((heading.offsetTop / bodyHeight) * 100, 0, 100).toFixed(2)}%`;
    });
  };

  const scheduleReadingPathPaint = () => {
    if (!readingFrame) readingFrame = requestAnimationFrame(paintReadingPath);
  };

  const buildReadingPath = () => {
    const resolvedBody = article.querySelector(".article-body");
    if (!(resolvedBody instanceof HTMLElement) || resolvedBody.querySelector(".loading-copy")) return;

    body = resolvedBody;
    headings = [...body.querySelectorAll("h2, h3")];

    const header = article.querySelector("header");
    const kindClass = header?.classList.contains("note-kind-work") ? "note-kind-work" : "note-kind-essay";
    article.classList.remove("note-kind-work", "note-kind-essay");
    article.classList.add(kindClass);

    if (!(path instanceof HTMLElement)) {
      path = document.createElement("aside");
      path.className = "reading-path";
      path.id = "reading-path";
      path.setAttribute("aria-hidden", "true");
      path.innerHTML = '<span class="reading-path-fill"></span><span class="reading-path-nodes"></span>';
      main.append(path);

      addEventListener("scroll", scheduleReadingPathPaint, { passive: true });
      addEventListener("resize", scheduleReadingPathPaint, { passive: true });
    }

    path.classList.remove("note-kind-work", "note-kind-essay");
    path.classList.add(kindClass);

    const nodeLayer = path.querySelector(".reading-path-nodes");
    if (nodeLayer instanceof HTMLElement) {
      nodeLayer.innerHTML = headings.map(() => '<span class="reading-path-node"></span>').join("");
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