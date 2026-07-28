(() => {
  if (document.body?.dataset.page !== "note") return;

  const main = document.querySelector(".article-main");
  const article = document.querySelector("#note-article");
  if (!(main instanceof HTMLElement) || !(article instanceof HTMLElement)) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const tickCount = 10;

  let readingFrame = 0;
  let motionFrame = 0;
  let path = null;
  let body = null;
  let resizeObserver = null;
  let listenersBound = false;
  let targetProgress = 0;
  let renderedProgress = 0;
  let lastMotionTime = 0;
  let progressInitialized = false;

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const isHan = (character) => /[\u3400-\u9fff]/.test(character);

  const normalizeChineseText = (value) => {
    let text = String(value || "")
      .replace(/—-/g, "——")
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

  const applyReadingProgress = (progress) => {
    if (!(path instanceof HTMLElement)) return;
    path.style.setProperty("--reading-progress", clamp(progress, 0, 1).toFixed(4));
  };

  const advanceReadingMotion = (timestamp) => {
    motionFrame = 0;
    if (!(path instanceof HTMLElement)) return;

    if (reducedMotion.matches) {
      renderedProgress = targetProgress;
      lastMotionTime = timestamp;
      applyReadingProgress(renderedProgress);
      return;
    }

    const deltaSeconds = Math.min(0.05, Math.max(0.001, (timestamp - lastMotionTime) / 1000 || 1 / 60));
    lastMotionTime = timestamp;

    // A critically calm follow: slightly behind the page, but never overshooting or bouncing.
    const followRate = 8.2;
    const blend = 1 - Math.exp(-followRate * deltaSeconds);
    renderedProgress += (targetProgress - renderedProgress) * blend;
    applyReadingProgress(renderedProgress);

    if (Math.abs(targetProgress - renderedProgress) < 0.00035) {
      renderedProgress = targetProgress;
      applyReadingProgress(renderedProgress);
      return;
    }

    motionFrame = requestAnimationFrame(advanceReadingMotion);
  };

  const startReadingMotion = () => {
    if (motionFrame) return;
    lastMotionTime = performance.now();
    motionFrame = requestAnimationFrame(advanceReadingMotion);
  };

  const paintReadingPath = () => {
    readingFrame = 0;
    if (!(path instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

    const articleRect = article.getBoundingClientRect();
    const startLine = window.innerHeight * 0.26;
    const endLine = window.innerHeight * 0.74;
    const travel = Math.max(1, articleRect.height - (endLine - startLine));
    targetProgress = clamp((startLine - articleRect.top) / travel, 0, 1);

    if (!progressInitialized || reducedMotion.matches) {
      renderedProgress = targetProgress;
      progressInitialized = true;
      applyReadingProgress(renderedProgress);
      return;
    }

    startReadingMotion();
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

    article.classList.remove("note-kind-work", "note-kind-essay", "note-format-technical", "note-format-essay");
    article.classList.add(kindClass, isTechnical ? "note-format-technical" : "note-format-essay");
    body.classList.remove("article-body-technical", "article-body-essay");
    body.classList.add(isTechnical ? "article-body-technical" : "article-body-essay");

    if (!isTechnical) normalizeEssayBody();

    if (!(path instanceof HTMLElement)) {
      path = document.createElement("aside");
      path.className = "reading-path";
      path.id = "reading-path";
      path.setAttribute("aria-hidden", "true");
      path.innerHTML = [
        `<span class="reading-scale-ticks">${Array.from(
          { length: tickCount },
          () => '<span class="reading-scale-tick"></span>'
        ).join("")}</span>`,
        '<span class="reading-scale-marker">',
        '  <span class="reading-growth-dash"></span>',
        '  <span class="reading-seed"></span>',
        '</span>',
      ].join("");
      main.append(path);
    }

    path.classList.remove("note-kind-work", "note-kind-essay");
    path.classList.add(kindClass);

    if (!listenersBound) {
      addEventListener("scroll", scheduleReadingPathPaint, { passive: true });
      addEventListener("resize", scheduleReadingPathPaint, { passive: true });
      addEventListener("pageshow", scheduleReadingPathPaint);
      reducedMotion.addEventListener?.("change", scheduleReadingPathPaint);
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