(() => {
  const field = document.querySelector("#cosmos-field");
  const orbitLine = document.querySelector(".project-orbit-line");
  const orbitProject = document.querySelector(".orbit-project");
  const orbitImage = orbitProject?.querySelector("img");

  if (!(field instanceof HTMLElement)
    || !(orbitLine instanceof HTMLElement)
    || !(orbitProject instanceof HTMLElement)) return;

  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointerQuery = matchMedia("(hover: hover) and (pointer: fine)");
  const duration = 56000;
  const initialPhase = 0.38;

  let frame = 0;
  let resizeFrame = 0;
  let retryTimer = 0;
  let startedAt = performance.now() - duration * initialPhase;
  let pausedAt = 0;
  let geometry = null;
  let interactionPaused = false;
  let sceneVisible = true;
  let frontHalf = null;

  function clearInlinePosition() {
    orbitProject.style.removeProperty("left");
    orbitProject.style.removeProperty("top");
    orbitProject.style.removeProperty("transform");
    orbitProject.style.removeProperty("z-index");
    orbitProject.style.removeProperty("visibility");
    orbitProject.style.removeProperty("opacity");
    frontHalf = null;
  }

  function useCssFallback() {
    clearTimeout(retryTimer);
    cancelAnimationFrame(frame);
    frame = 0;
    geometry = null;
    orbitProject.classList.remove("is-pixel-orbit");
    clearInlinePosition();
  }

  function measure() {
    const width = field.clientWidth;
    const height = field.clientHeight;
    const orbitWidth = orbitLine.offsetWidth;
    const orbitHeight = orbitLine.offsetHeight;
    const iconSize = orbitProject.offsetWidth;

    if (width < 120 || height < 240 || orbitWidth < 80 || orbitHeight < 60 || iconSize < 20) {
      geometry = null;
      return false;
    }

    geometry = {
      centerX: width / 2,
      centerY: height / 2,
      radiusX: orbitWidth / 2,
      radiusY: orbitHeight / 2,
      iconSize,
    };
    return true;
  }

  function currentPhase(now = performance.now()) {
    return reducedQuery.matches
      ? initialPhase
      : ((now - startedAt) % duration) / duration;
  }

  function prepareCarrier() {
    orbitProject.classList.add("is-pixel-orbit");
    orbitProject.style.left = "0px";
    orbitProject.style.top = "0px";
    orbitProject.style.visibility = "visible";
    orbitProject.style.opacity = "1";
  }

  function placeAtPhase(phase) {
    if (!geometry && !measure()) return false;

    const angle = phase * Math.PI * 2;
    const x = geometry.centerX + Math.cos(angle) * geometry.radiusX - geometry.iconSize / 2;
    const y = geometry.centerY + Math.sin(angle) * geometry.radiusY - geometry.iconSize / 2;
    orbitProject.style.transform = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0)`;

    const nextFrontHalf = Math.sin(angle) >= 0;
    if (nextFrontHalf !== frontHalf) {
      frontHalf = nextFrontHalf;
      orbitProject.style.zIndex = nextFrontHalf ? "5" : "2";
    }
    return true;
  }

  function canAnimate() {
    return !reducedQuery.matches
      && !document.hidden
      && !interactionPaused
      && sceneVisible;
  }

  function animate(now) {
    if (!canAnimate()) {
      frame = 0;
      return;
    }

    if (!placeAtPhase(currentPhase(now))) {
      useCssFallback();
      retryTimer = setTimeout(start, 120);
      return;
    }

    frame = requestAnimationFrame(animate);
  }

  function start() {
    clearTimeout(retryTimer);
    if (!measure()) {
      useCssFallback();
      retryTimer = setTimeout(start, 120);
      return;
    }

    prepareCarrier();
    placeAtPhase(currentPhase());
    if (canAnimate() && !frame) frame = requestAnimationFrame(animate);
  }

  function pauseTimeline() {
    if (!pausedAt) pausedAt = performance.now();
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function resumeTimeline() {
    if (!canAnimate()) return;
    if (pausedAt) startedAt += performance.now() - pausedAt;
    pausedAt = 0;
    start();
  }

  function handleVisibility() {
    if (document.hidden) pauseTimeline();
    else resumeTimeline();
  }

  function scheduleResize() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      geometry = null;
      start();
    });
  }

  orbitProject.addEventListener("pointerenter", () => {
    if (!finePointerQuery.matches) return;
    interactionPaused = true;
    pauseTimeline();
  });

  orbitProject.addEventListener("pointerleave", () => {
    interactionPaused = false;
    resumeTimeline();
  });

  orbitProject.addEventListener("focusin", () => {
    interactionPaused = true;
    pauseTimeline();
  });

  orbitProject.addEventListener("focusout", () => {
    interactionPaused = false;
    resumeTimeline();
  });

  reducedQuery.addEventListener?.("change", scheduleResize);
  document.addEventListener("visibilitychange", handleVisibility);
  addEventListener("resize", scheduleResize, { passive: true });
  addEventListener("pageshow", resumeTimeline);
  addEventListener("pagehide", pauseTimeline);

  if (orbitImage instanceof HTMLImageElement && !orbitImage.complete) {
    orbitImage.addEventListener("load", start, { once: true });
    orbitImage.addEventListener("error", useCssFallback, { once: true });
  }

  if ("IntersectionObserver" in window) {
    const visibilityObserver = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (visible === sceneVisible) return;
      sceneVisible = visible;
      if (visible) resumeTimeline();
      else pauseTimeline();
    }, { rootMargin: "120px" });
    visibilityObserver.observe(field);
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(field);
    observer.observe(orbitLine);
  }

  requestAnimationFrame(start);
})();