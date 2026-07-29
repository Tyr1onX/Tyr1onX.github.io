(() => {
  const body = document.body;
  if (body?.dataset.page !== "home") return;

  const rawMotion = window.TYR1ONX_COSMOS_MOTION;
  if (!rawMotion) return;

  const safeRetract = (options = {}) => {
    const duration = Number.isFinite(options.duration) ? options.duration : 440;
    const baseDelay = Number.isFinite(options.baseDelay) ? options.baseDelay : 0;
    const stagger = Number.isFinite(options.stagger) ? options.stagger : 0;
    const count = Array.isArray(options.indices) ? options.indices.length : 8;
    const deadline = Math.max(320, duration + baseDelay + Math.max(0, count - 1) * stagger + 260);

    return new Promise((resolve) => {
      let settled = false;
      let timer = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };

      timer = setTimeout(finish, deadline);
      try {
        Promise.resolve(rawMotion.retract?.(options)).then(finish, finish);
      } catch {
        finish();
      }
    });
  };

  const motion = Object.freeze({
    retract: safeRetract,
    resetRetraction: (...args) => rawMotion.resetRetraction?.(...args),
    releaseFromTop: (...args) => rawMotion.releaseFromTop?.(...args),
    isReleaseActive: () => Boolean(rawMotion.isReleaseActive?.()),
  });
  window.TYR1ONX_COSMOS_MOTION = motion;

  const style = document.createElement("style");
  style.dataset.cosmosStarMotion = "true";
  style.textContent = `
    body[data-page="home"].is-cosmos-retracting .note-star,
    body[data-page="home"].is-cosmos-retracting .star-thread,
    body[data-page="home"].is-cosmos-retracting.is-preparing-keke .note-star,
    body[data-page="home"].is-cosmos-retracting.is-preparing-keke .star-thread,
    body[data-page="home"].is-cosmos-retracting .writing-retract-source,
    body[data-page="home"].is-cosmos-retracting .writing-retract-thread {
      animation: none !important;
      transition: none !important;
    }

    body[data-page="home"].is-cosmos-retracting .note-star-core {
      scale: 1 !important;
      animation-play-state: paused !important;
    }

    body[data-page="home"].is-cosmos-return-drop .note-star,
    body[data-page="home"].is-cosmos-return-drop.is-returning-keke-home .note-star,
    body[data-page="home"].is-cosmos-return-drop.is-returning-writing-home .note-star {
      opacity: 1 !important;
      translate: 0 0 !important;
      scale: 1 !important;
      animation: none !important;
      transition: none !important;
    }

    body[data-page="home"].is-cosmos-return-drop .star-thread,
    body[data-page="home"].is-cosmos-return-drop.is-returning-keke-home .star-thread,
    body[data-page="home"].is-cosmos-return-drop.is-returning-writing-home .star-thread {
      opacity: 1 !important;
      transform: none !important;
      animation: none !important;
      transition: none !important;
    }
  `;
  document.head.append(style);

  const returnStateActive = () => body.classList.contains("is-returning-keke-home")
    || body.classList.contains("is-returning-writing-home");

  const synchronizeReturnState = () => {
    if (returnStateActive()) {
      if (!body.classList.contains("is-cosmos-return-drop")) {
        body.classList.add("is-cosmos-return-drop");
        if (!motion.isReleaseActive()) motion.releaseFromTop();
      }
      return;
    }
    if (body.classList.contains("is-cosmos-return-drop")) {
      body.classList.remove("is-cosmos-return-drop");
    }
  };

  const bodyObserver = new MutationObserver(synchronizeReturnState);
  bodyObserver.observe(body, { attributes: true, attributeFilter: ["class"] });

  addEventListener("pageshow", () => {
    requestAnimationFrame(synchronizeReturnState);
  });

  synchronizeReturnState();
})();
