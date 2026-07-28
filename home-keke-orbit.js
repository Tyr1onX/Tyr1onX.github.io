(() => {
  const field = document.querySelector("#cosmos-field");
  const orbitLine = document.querySelector(".project-orbit-line");
  const orbitProject = document.querySelector(".orbit-project");
  const orbitImage = orbitProject?.querySelector("img");

  if (!(field instanceof HTMLElement)
    || !(orbitLine instanceof HTMLElement)
    || !(orbitProject instanceof HTMLElement)) return;

  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 56000;
  const initialPhase = 0.38;

  let frame = 0;
  let retryTimer = 0;
  let startedAt = performance.now() - duration * initialPhase;
  let pausedAt = 0;
  let geometry = null;
  let interactionPaused = false;

  const snap = (value) => {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    return Math.round(value * ratio) / ratio;
  };

  function clearInlinePosition() {
    orbitProject.style.removeProperty("left");
    orbitProject.style.removeProperty("top");
    orbitProject.style.removeProperty("z-index");
    orbitProject.style.removeProperty("visibility");
    orbitProject.style.removeProperty("opacity");
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

  function placeAtPhase(phase) {
    if (!geometry && !measure()) return false;

    const angle = phase * Math.PI * 2;
    const x = geometry.centerX + Math.cos(angle) * geometry.radiusX - geometry.iconSize / 2;
    const y = geometry.centerY + Math.sin(angle) * geometry.radiusY - geometry.iconSize / 2;

    orbitProject.style.left = `${snap(x)}px`;
    orbitProject.style.top = `${snap(y)}px`;
    orbitProject.style.zIndex = Math.sin(angle) >= 0 ? "5" : "2";
    orbitProject.style.visibility = "visible";
    orbitProject.style.opacity = "1";
    return true;
  }

  function animate(now) {
    if (reducedQuery.matches || document.hidden || interactionPaused) {
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

    orbitProject.classList.add("is-pixel-orbit");
    placeAtPhase(currentPhase());

    if (!reducedQuery.matches && !document.hidden && !interactionPaused && !frame) {
      frame = requestAnimationFrame(animate);
    }
  }

  function pauseTimeline() {
    if (!pausedAt) pausedAt = performance.now();
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function resumeTimeline() {
    if (document.hidden || interactionPaused) return;
    if (pausedAt) startedAt += performance.now() - pausedAt;
    pausedAt = 0;
    start();
  }

  function handleVisibility() {
    if (document.hidden) pauseTimeline();
    else resumeTimeline();
  }

  function handleResize() {
    geometry = null;
    start();
  }

  orbitProject.addEventListener("pointerenter", () => {
    if (matchMedia("(hover: hover)").matches) {
      interactionPaused = true;
      pauseTimeline();
    }
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

  reducedQuery.addEventListener?.("change", handleResize);
  document.addEventListener("visibilitychange", handleVisibility);
  addEventListener("resize", handleResize, { passive: true });
  addEventListener("pageshow", start);
  addEventListener("pagehide", pauseTimeline);

  if (orbitImage instanceof HTMLImageElement && !orbitImage.complete) {
    orbitImage.addEventListener("load", start, { once: true });
    orbitImage.addEventListener("error", useCssFallback, { once: true });
  }

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(handleResize);
    observer.observe(field);
    observer.observe(orbitLine);
  }

  requestAnimationFrame(start);
})();
