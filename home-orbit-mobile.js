(() => {
  const field = document.querySelector("#cosmos-field");
  const orbitLine = document.querySelector(".project-orbit-line");
  const orbitProject = document.querySelector(".orbit-project");

  if (!(field instanceof HTMLElement)
    || !(orbitLine instanceof HTMLElement)
    || !(orbitProject instanceof HTMLElement)) return;

  const mobileQuery = matchMedia("(max-width: 560px)");
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 60000;

  let frame = 0;
  let startedAt = performance.now();
  let pausedAt = 0;
  let geometry = null;

  const snap = (value) => {
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    return Math.round(value * ratio) / ratio;
  };

  function measure() {
    if (!mobileQuery.matches) {
      geometry = null;
      return;
    }

    const width = field.clientWidth;
    const height = field.clientHeight;
    const orbitWidth = orbitLine.offsetWidth;
    const orbitHeight = orbitLine.offsetHeight;
    const iconSize = orbitProject.offsetWidth;

    if (width < 120 || height < 240 || orbitWidth < 40 || orbitHeight < 20 || iconSize < 20) {
      geometry = null;
      return;
    }

    geometry = {
      centerX: width / 2,
      centerY: height / 2,
      radiusX: orbitWidth / 2,
      radiusY: orbitHeight / 2,
      iconSize,
    };
  }

  function placeAtPhase(phase) {
    if (!geometry) measure();
    if (!geometry) return;

    const angle = phase * Math.PI * 2;
    const x = geometry.centerX + Math.cos(angle) * geometry.radiusX - geometry.iconSize / 2;
    const y = geometry.centerY + Math.sin(angle) * geometry.radiusY - geometry.iconSize / 2;

    orbitProject.style.left = `${snap(x)}px`;
    orbitProject.style.top = `${snap(y)}px`;
    orbitProject.style.zIndex = Math.sin(angle) >= 0 ? "5" : "2";
  }

  function animate(now) {
    if (!mobileQuery.matches || reducedQuery.matches || document.hidden) {
      frame = 0;
      return;
    }

    const phase = ((now - startedAt) % duration) / duration;
    placeAtPhase(phase);
    frame = requestAnimationFrame(animate);
  }

  function start() {
    if (!mobileQuery.matches) {
      stop();
      return;
    }

    orbitProject.classList.add("is-mobile-snap-orbit");
    measure();

    if (reducedQuery.matches) {
      placeAtPhase(0.18);
      return;
    }

    if (!document.hidden && !frame) frame = requestAnimationFrame(animate);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    geometry = null;
    orbitProject.classList.remove("is-mobile-snap-orbit");
    orbitProject.style.removeProperty("left");
    orbitProject.style.removeProperty("top");
    orbitProject.style.removeProperty("z-index");
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
    if (mobileQuery.matches) {
      measure();
      const now = performance.now();
      const phase = reducedQuery.matches ? 0.18 : ((now - startedAt) % duration) / duration;
      placeAtPhase(phase);
      start();
    } else {
      stop();
    }
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

  requestAnimationFrame(() => {
    startedAt = performance.now();
    start();
  });
})();
