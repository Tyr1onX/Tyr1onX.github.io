(() => {
  const body = document.body;
  const root = document.documentElement;
  const page = body.dataset.page || "";
  if (page !== "home" && page !== "knowledge") return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "tyr1onx:knowledge-transition";
  const forwardMode = "home-to-knowledge";
  const returnMode = "knowledge-to-home";

  let navigating = false;
  let pressedAt = 0;
  let pressedPointerId = null;
  let arrivalRunning = false;

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const afterStyleCommit = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const motionMs = (name, fallback) => {
    const raw = getComputedStyle(root).getPropertyValue(name).trim();
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return fallback;
    return raw.endsWith("s") && !raw.endsWith("ms") ? value * 1000 : value;
  };

  const setState = (state) => {
    root.dataset.knowledgeMotionState = state;
    body.dataset.knowledgeMotionState = state;
  };

  const clearState = () => {
    delete root.dataset.knowledgeMotionState;
    delete body.dataset.knowledgeMotionState;
  };

  const readPayload = () => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch {
      return null;
    }
  };

  const writePayload = (payload) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // The route still works; only destination choreography may be skipped.
    }
  };

  const clearPayload = () => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // A blocked storage area must not leave the page visually locked.
    }
  };

  const waitForNamedAnimations = async (elements, names) => {
    await afterStyleCommit();
    const animations = [...new Set(elements.flatMap((element) => (
      element instanceof Element ? element.getAnimations({ subtree: true }) : []
    )))].filter((animation) => names.has(animation.animationName));
    if (!animations.length) return;
    await Promise.allSettled(animations.map((animation) => animation.finished));
  };

  const waitForRendererFrame = async () => {
    const canvas = document.querySelector("#universe");
    if (!(canvas instanceof HTMLCanvasElement)) return;

    for (let frame = 0; frame < 120; frame += 1) {
      if (canvas.width > 1 && canvas.height > 1) {
        await nextFrame();
        await nextFrame();
        return;
      }
      await nextFrame();
    }
  };

  const navigationHandoff = async () => {
    const handoff = window.TYR1ONX_NAVIGATION_HANDOFF;
    if (handoff && typeof handoff.then === "function") {
      await Promise.resolve(handoff).catch(() => {});
    } else {
      await afterStyleCommit();
    }
  };

  const isPlainPrimaryActivation = (event) => (
    event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && !event.defaultPrevented
  );

  const beginPress = (event) => {
    if (reducedMotion.matches || navigating || !isPlainPrimaryActivation(event)) return;
    pressedPointerId = event.pointerId ?? null;
    pressedAt = performance.now();
    setState("pressed");
  };

  const cancelPress = (event) => {
    if (navigating) return;
    if (pressedPointerId !== null && event?.pointerId !== undefined && event.pointerId !== pressedPointerId) return;
    pressedPointerId = null;
    pressedAt = 0;
    clearState();
  };

  const finishPressWindow = async () => {
    if (!pressedAt) {
      pressedAt = performance.now();
      setState("pressed");
    }
    const duration = motionMs("--motion-press", 90);
    const remaining = Math.max(0, duration - (performance.now() - pressedAt));
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  };

  const prefetch = (link, marker) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    const href = new URL(link.href, location.href).href;
    if (document.querySelector(`link[data-${marker}-prefetch]`)) return;
    const preload = document.createElement("link");
    preload.rel = "prefetch";
    preload.href = href;
    preload.dataset[`${marker}Prefetch`] = "true";
    document.head.append(preload);
  };

  const makeForwardDestination = (href) => {
    const destination = new URL(href, location.href);
    destination.searchParams.set("__knowledge", "home");
    destination.searchParams.set("__t", Date.now().toString(36));
    return destination.href;
  };

  const makeReturnDestination = () => {
    const destination = new URL("./", location.href);
    destination.searchParams.set("__return", "knowledge");
    destination.searchParams.set("__t", Date.now().toString(36));
    return destination.href;
  };

  const resetHomeSource = () => {
    window.TYR1ONX_COSMOS_MOTION?.resetRetraction();
    document.querySelectorAll('.site-header .nav-links a[href$="knowledge.html"]').forEach((link) => {
      link.removeAttribute("aria-disabled");
    });
    clearState();
    pressedAt = 0;
    pressedPointerId = null;
    navigating = false;
  };

  const beginHomeForward = async (link) => {
    if (navigating) return;
    navigating = true;
    link.setAttribute("aria-disabled", "true");
    writePayload({ mode: forwardMode, direction: "forward" });

    await finishPressWindow();
    setState("retracting");

    const layer = document.querySelector(".knowledge-home-transition-layer");
    const stars = [...document.querySelectorAll("#note-stars .note-star")];
    const indices = stars.map((_, index) => index);
    const motion = window.TYR1ONX_COSMOS_MOTION;
    const retractPromise = motion
      ? motion.retract({
        indices,
        duration: motionMs("--motion-project-retract", 520),
        baseDelay: 0,
        stagger: 0,
      })
      : Promise.resolve();

    const visualPromise = waitForNamedAnimations(
      [layer],
      new Set(["knowledge-home-cover"])
    );

    await Promise.all([retractPromise, visualPromise]);
    if (!navigating) return;

    setState("navigating");
    location.assign(makeForwardDestination(link.href));
  };

  const installHomeForward = () => {
    if (page !== "home") return;
    const link = document.querySelector('.site-header .nav-links a[href$="knowledge.html"]');
    if (!(link instanceof HTMLAnchorElement)) return;

    link.addEventListener("pointerenter", () => prefetch(link, "knowledge"), { passive: true });
    link.addEventListener("focus", () => prefetch(link, "knowledge"), { passive: true });
    link.addEventListener("pointerdown", beginPress, { passive: true });
    link.addEventListener("pointercancel", cancelPress, { passive: true });
    link.addEventListener("lostpointercapture", cancelPress, { passive: true });
    link.addEventListener("click", (event) => {
      if (navigating) {
        event.preventDefault();
        return;
      }
      if (!isPlainPrimaryActivation(event) || reducedMotion.matches) {
        cancelPress(event);
        return;
      }
      event.preventDefault();
      void beginHomeForward(link);
    });
  };

  const completeKnowledgeArrival = async () => {
    if (page !== "knowledge" || arrivalRunning) return;
    const payload = readPayload();
    const pending = root.dataset.knowledgeArrivalPending === "home"
      || payload?.mode === forwardMode;
    if (!pending) return;

    if (reducedMotion.matches) {
      delete root.dataset.knowledgeArrivalPending;
      delete root.dataset.transitionRoute;
      clearPayload();
      clearState();
      return;
    }

    arrivalRunning = true;
    await Promise.all([navigationHandoff(), waitForRendererFrame()]);

    const scrim = document.querySelector(".knowledge-transition-scrim");
    setState("deploying");
    await waitForNamedAnimations(
      [scrim],
      new Set(["knowledge-core-attention"])
    );

    setState("revealing");
    await waitForNamedAnimations(
      [scrim],
      new Set(["knowledge-universe-reveal"])
    );

    setState("settling");
    await waitForNamedAnimations(
      [
        document.querySelector(".site-header"),
        document.querySelector(".knowledge-overlay"),
        document.querySelector(".knowledge-hint"),
        document.querySelector(".knowledge-source-overlay"),
      ],
      new Set(["knowledge-aux-reveal"])
    );

    delete root.dataset.knowledgeArrivalPending;
    delete root.dataset.transitionRoute;
    clearPayload();
    clearState();
    arrivalRunning = false;
  };

  const beginKnowledgeReturn = async (link) => {
    if (navigating) return;
    navigating = true;
    link.setAttribute("aria-disabled", "true");
    writePayload({ mode: returnMode, direction: "return" });

    await finishPressWindow();
    setState("retracting");

    const scrim = document.querySelector(".knowledge-transition-scrim");
    await waitForNamedAnimations(
      [scrim],
      new Set(["knowledge-universe-veil-close"])
    );

    if (!navigating) return;
    setState("navigating");
    location.assign(makeReturnDestination());
  };

  const installKnowledgeReturn = () => {
    if (page !== "knowledge") return;
    const link = document.querySelector('.site-header .brand[href="./"]');
    if (!(link instanceof HTMLAnchorElement)) return;

    link.addEventListener("pointerenter", () => prefetch(link, "knowledgeReturn"), { passive: true });
    link.addEventListener("focus", () => prefetch(link, "knowledgeReturn"), { passive: true });
    link.addEventListener("pointerdown", beginPress, { passive: true });
    link.addEventListener("pointercancel", cancelPress, { passive: true });
    link.addEventListener("lostpointercapture", cancelPress, { passive: true });
    link.addEventListener("click", (event) => {
      if (navigating) {
        event.preventDefault();
        return;
      }
      if (!isPlainPrimaryActivation(event) || reducedMotion.matches) {
        cancelPress(event);
        return;
      }
      event.preventDefault();
      void beginKnowledgeReturn(link);
    });
  };

  const completeHomeReturn = async () => {
    if (page !== "home" || arrivalRunning) return;
    const payload = readPayload();
    const pending = root.dataset.knowledgeReturnPending === "knowledge-return"
      || payload?.mode === returnMode;
    if (!pending) return;

    if (reducedMotion.matches) {
      window.TYR1ONX_COSMOS_MOTION?.releaseFromTop({ animate: false });
      delete root.dataset.knowledgeReturnPending;
      delete root.dataset.transitionRoute;
      clearPayload();
      clearState();
      return;
    }

    arrivalRunning = true;
    root.dataset.knowledgeReturnPending = "knowledge-return";
    await navigationHandoff();

    const layer = document.querySelector(".knowledge-home-transition-layer");
    setState("deploying");
    await waitForNamedAnimations(
      [layer, document.querySelector(".cosmos-center")],
      new Set([
        "knowledge-home-core-deploy",
        "knowledge-home-core-deploy-mobile",
        "knowledge-home-center-deploy",
        "knowledge-home-avatar-deploy",
      ])
    );

    setState("revealing");
    window.TYR1ONX_COSMOS_MOTION?.releaseFromTop({ animate: true });
    await waitForNamedAnimations(
      [layer],
      new Set(["knowledge-home-world-reveal", "knowledge-home-world-reveal-mobile"])
    );

    setState("settling");
    await waitForNamedAnimations(
      [document.querySelector(".site-header"), document.querySelector(".site-footer")],
      new Set(["knowledge-home-ui-settle"])
    );

    delete root.dataset.knowledgeReturnPending;
    delete root.dataset.transitionRoute;
    clearPayload();
    clearState();
    arrivalRunning = false;
    navigating = false;
  };

  installHomeForward();
  installKnowledgeReturn();
  void completeKnowledgeArrival();
  void completeHomeReturn();

  addEventListener("pageshow", (event) => {
    if (!event.persisted) return;

    navigating = false;
    arrivalRunning = false;
    pressedAt = 0;
    pressedPointerId = null;
    clearState();
    document.querySelectorAll("[aria-disabled='true']").forEach((element) => {
      if (element.matches('.site-header .brand, .site-header .nav-links a[href$="knowledge.html"]')) {
        element.removeAttribute("aria-disabled");
      }
    });

    if (page === "home") {
      const payload = readPayload();
      if (payload?.mode === returnMode) {
        root.dataset.knowledgeReturnPending = "knowledge-return";
        void completeHomeReturn();
        return;
      }
      window.TYR1ONX_COSMOS_MOTION?.resetRetraction();
      delete root.dataset.knowledgeReturnPending;
      if (payload?.mode === forwardMode) clearPayload();
    } else {
      delete root.dataset.knowledgeArrivalPending;
      const payload = readPayload();
      if (payload?.mode === forwardMode || payload?.mode === returnMode) clearPayload();
    }
  });
})();
