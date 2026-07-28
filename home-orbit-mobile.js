(() => {
  const field = document.querySelector("#cosmos-field");
  const orbitLine = document.querySelector(".project-orbit-line");
  const orbitProject = document.querySelector(".orbit-project");
  const orbitImage = orbitProject?.querySelector("img");

  if (!(field instanceof HTMLElement)
    || !(orbitLine instanceof HTMLElement)
    || !(orbitProject instanceof HTMLElement)) return;

  const mobileQuery = matchMedia("(max-width: 560px)");
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 60000;
  const initialPhase = 0.38;

  let frame = 0;
  let retryTimer = 0;
  let startedAt = performance.now() - duration * initialPhase;
  let pausedAt = 0;
  let geometry = null;

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
    cancelAnimationFrame(frame);
    frame = 0;
    geometry = null;
    orbitProject.classList.remove("is-mobile-snap-orbit");
    clearInlinePosition();
  }

  function measure() {
    if (!mobileQuery.matches) {
      geometry = null;
      return false;
    }

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
    if (!mobileQuery.matches || reducedQuery.matches || document.hidden) {
      frame = 0;
      return;
    }

    if (!placeAtPhase(currentPhase(now))) {
      useCssFallback();
      return;
    }
    frame = requestAnimationFrame(animate);
  }

  function start() {
    clearTimeout(retryTimer);

    if (!mobileQuery.matches) {
      stop();
      return;
    }

    if (!measure()) {
      useCssFallback();
      retryTimer = setTimeout(start, 120);
      return;
    }

    orbitProject.classList.add("is-mobile-snap-orbit");
    placeAtPhase(currentPhase());

    if (!reducedQuery.matches && !document.hidden && !frame) {
      frame = requestAnimationFrame(animate);
    }
  }

  function stop() {
    clearTimeout(retryTimer);
    cancelAnimationFrame(frame);
    frame = 0;
    geometry = null;
    orbitProject.classList.remove("is-mobile-snap-orbit");
    clearInlinePosition();
  }

  function handleVisibility() {
    if (document.hidden) {
      pausedAt = performance.now();
      cancelAnimationFrame(frame);
      frame = 0;
      return;
    }

    if (pausedAt) startedAt += performance.now() - pausedAt;
    pausedAt = 0;
    start();
  }

  function handleResize() {
    geometry = null;
    start();
  }

  mobileQuery.addEventListener?.("change", handleResize);
  reducedQuery.addEventListener?.("change", handleResize);
  document.addEventListener("visibilitychange", handleVisibility);
  addEventListener("resize", handleResize, { passive: true });
  addEventListener("pageshow", start);
  addEventListener("pagehide", () => {
    cancelAnimationFrame(frame);
    frame = 0;
  });

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
