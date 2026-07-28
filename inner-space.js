(() => {
  if (document.body?.dataset.page !== "note") return;

  const main = document.querySelector(".article-main");
  const article = document.querySelector("#note-article");
  if (!(main instanceof HTMLElement) || !(article instanceof HTMLElement)) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const maxMilestones = 6;

  let readingFrame = 0;
  let springFrame = 0;
  let path = null;
  let body = null;
  let headings = [];
  let resizeObserver = null;
  let listenersBound = false;
  let targetProgress = 0;
  let renderedProgress = 0;
  let springVelocity = 0;
  let lastSpringTime = 0;
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

  const selectMilestones = (container) => {
    const majorHeadings = [...container.querySelectorAll("h2")];
    const candidates = majorHeadings.length ? majorHeadings : [...container.querySelectorAll("h3")];
    if (candidates.length <= maxMilestones) return candidates;

    const sampled = [];
    for (let index = 0; index < maxMilestones; index += 1) {
      const candidateIndex = Math.round((index * (candidates.length - 1)) / (maxMilestones - 1));
      const heading = candidates[candidateIndex];
      if (heading && sampled.at(-1) !== heading) sampled.push(heading);
    }
    return sampled;
  };

  const applyReadingProgress = (progress) => {
    if (!(path instanceof HTMLElement)) return;

    const visibleProgress = clamp(progress, 0, 1);
    path.style.setProperty("--reading-progress", visibleProgress.toFixed(4));

    const nodes = [...path.querySelectorAll(".reading-path-node")];
    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const position = Number.parseFloat(node.dataset.progress || "0");
      node.classList.toggle("is-read", position <= visibleProgress + 0.01);
    });
  };

  const advanceReadingSpring = (timestamp) => {
    springFrame = 0;
    if (!(path instanceof HTMLElement)) return;

    if (reducedMotion.matches) {
      renderedProgress = targetProgress;
      springVelocity = 0;
      lastSpringTime = timestamp;
      applyReadingProgress(renderedProgress);
      return;
    }

    const deltaSeconds = Math.min(0.032, Math.max(0.001, (timestamp - lastSpringTime) / 1000 || 1 / 60));
    lastSpringTime = timestamp;

    const stiffness = 72;
    const damping = 13;
    const acceleration = stiffness * (targetProgress - renderedProgress) - damping * springVelocity;

    springVelocity += acceleration * deltaSeconds;
    renderedProgress += springVelocity * deltaSeconds;
    renderedProgress = clamp(renderedProgress, -0.025, 1.025);
    applyReadingProgress(renderedProgress);

    const settled = Math.abs(targetProgress - renderedProgress) < 0.00035 && Math.abs(springVelocity) < 0.00035;
    if (settled) {
      renderedProgress = targetProgress;
      springVelocity = 0;
      applyReadingProgress(renderedProgress);
      return;
    }

    springFrame = requestAnimationFrame(advanceReadingSpring);
  };

  const startReadingSpring = () => {
    if (springFrame) return;
    lastSpringTime = performance.now();
    springFrame = requestAnimationFrame(advanceReadingSpring);
  };

  const paintReadingPath = () => {
    readingFrame = 0;
    if (!(path instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

    const articleRect = article.getBoundingClientRect();
    const startLine = window.innerHeight * 0.26;
    const endLine = window.innerHeight * 0.74;
    const travel = Math.max(1, articleRect.height - (endLine - startLine));
    targetProgress = clamp((startLine - articleRect.top) / travel, 0, 1);

    const bodyHeight = Math.max(1, body.offsetHeight);
    const nodes = [...path.querySelectorAll(".reading-path-node")];
    nodes.forEach((node, index) => {
      const heading = headings[index];
      if (!(node instanceof HTMLElement) || !(heading instanceof HTMLElement)) return;

      const position = clamp(heading.offsetTop / bodyHeight, 0, 1);
      node.dataset.progress = position.toFixed(4);
      node.style.top = `${(position * 100).toFixed(2)}%`;
    });

    if (!progressInitialized || reducedMotion.matches) {
      renderedProgress = targetProgress;
      springVelocity = 0;
      progressInitialized = true;
      applyReadingProgress(renderedProgress);
      return;
    }

    startReadingSpring();
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
    headings = isTechnical ? selectMilestones(body) : [];

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