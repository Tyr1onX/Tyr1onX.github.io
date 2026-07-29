(() => {
  const body = document.body;
  const root = document.documentElement;
  if (body?.dataset.page !== "home") return;

  const motion = window.TYR1ONX_COSMOS_MOTION;
  if (!motion) return;

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

  let activeMode = "";

  const allIndices = () => [...document.querySelectorAll("#note-stars .note-star")]
    .map((_, index) => index);

  const focusedIndex = () => [...document.querySelectorAll("#note-stars .note-star")]
    .findIndex((star) => star.classList.contains("writing-retract-source"));

  const startForwardRetraction = (mode) => {
    if (activeMode) return;

    let options;
    if (mode === "keke") {
      options = { indices: allIndices(), duration: 520, baseDelay: 70, stagger: 42 };
    } else if (mode === "writing-archive") {
      options = { indices: allIndices(), duration: 440, baseDelay: 0, stagger: 28 };
    } else {
      const index = focusedIndex();
      if (index < 0) return;
      options = { indices: [index], duration: 440, baseDelay: 0, stagger: 0 };
    }

    activeMode = mode;
    body.classList.add("is-cosmos-retracting");
    void motion.retract(options);
  };

  const synchronizeForwardState = () => {
    if (body.classList.contains("is-preparing-keke")) {
      startForwardRetraction("keke");
      return;
    }
    if (body.classList.contains("is-preparing-writing-archive")) {
      startForwardRetraction("writing-archive");
      return;
    }
    if (body.classList.contains("is-preparing-writing-note")) {
      startForwardRetraction("writing-note");
    }
  };

  const returnStateActive = () => Boolean(root.dataset.returnHomePending)
    || body.classList.contains("is-returning-keke-home")
    || body.classList.contains("is-returning-writing-home");

  const synchronizeReturnState = () => {
    if (returnStateActive()) {
      if (!body.classList.contains("is-cosmos-return-drop")) {
        body.classList.add("is-cosmos-return-drop");
        motion.releaseFromTop();
      }
      return;
    }
    body.classList.remove("is-cosmos-return-drop");
  };

  const bodyObserver = new MutationObserver(() => {
    synchronizeForwardState();
    synchronizeReturnState();
  });
  bodyObserver.observe(body, { attributes: true, attributeFilter: ["class"] });

  const rootObserver = new MutationObserver(synchronizeReturnState);
  rootObserver.observe(root, { attributes: true, attributeFilter: ["data-return-home-pending"] });

  addEventListener("pageshow", () => {
    motion.resetRetraction();
    activeMode = "";
    requestAnimationFrame(() => {
      if (!body.classList.contains("is-preparing-keke")
        && !body.classList.contains("is-preparing-writing-archive")
        && !body.classList.contains("is-preparing-writing-note")) {
        body.classList.remove("is-cosmos-retracting");
      }
      synchronizeReturnState();
    });
  });

  synchronizeReturnState();
})();
