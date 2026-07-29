(() => {
  const body = document.body;
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const returnKey = "tyr1onx:return-home-transition";
  const planetMemoryKey = "tyr1onx:writing-planet-memory";
  const page = body.dataset.page || "";
  const PULL_ANIMATION_NAMES = new Set([
    "return-source-star-reel",
    "return-pull-thread-reel",
  ]);

  let navigating = false;

  const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
  const afterStyleCommit = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const waitForNamedAnimations = async (elements, fallbackMs) => {
    await afterStyleCommit();
    const animations = [...new Set(elements.flatMap((element) => (
      element instanceof Element ? element.getAnimations() : []
    )))].filter((animation) => PULL_ANIMATION_NAMES.has(animation.animationName));

    if (!animations.length) {
      await sleep(fallbackMs);
      return;
    }
    await Promise.allSettled(animations.map((animation) => animation.finished));
  };

  if (page === "home") {
    const url = new URL(location.href);
    if (url.searchParams.has("__return") || url.searchParams.has("__t")) {
      url.searchParams.delete("__return");
      url.searchParams.delete("__t");
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    return;
  }

  if (page !== "keke" && page !== "notes" && page !== "note") return;

  const snapshotStyle = document.createElement("style");
  snapshotStyle.dataset.cleanReturnSnapshot = "true";
  snapshotStyle.textContent = `
    body.is-leaving-keke-home .project-page::before,
    body.is-leaving-keke-home .project-page::after,
    body.is-leaving-writing-home .writing-page-direct::before,
    body.is-leaving-writing-home .article-main::before,
    body.is-leaving-writing-home .article-main::after,
    body.is-leaving-writing-home .archive-list::before,
    body.is-leaving-writing-home .archive-row-v2::before,
    body.is-leaving-writing-home .reading-path,
    body.is-leaving-writing-home .reading-path::before,
    body.is-leaving-writing-home .reading-path-fill {
      opacity: 0 !important;
      animation: none !important;
      transition: opacity 80ms linear !important;
    }
  `;
  document.head.append(snapshotStyle);

  const capturePlanetMemory = () => {
    if (page !== "notes" && page !== "note") return;
    const x = root.style.getPropertyValue("--writing-planet-drift-x").trim();
    const y = root.style.getPropertyValue("--writing-planet-drift-y").trim();
    if (!x && !y) return;

    try {
      sessionStorage.setItem(planetMemoryKey, JSON.stringify({
        x: x || "68px",
        y: y || "-22px",
      }));
    } catch {
      // The default return direction remains available without storage.
    }
  };

  capturePlanetMemory();

  const mode = page === "keke" ? "keke" : "writing";
  const destination = new URL("./", location.href);
  destination.searchParams.set("__return", mode);
  destination.searchParams.set("__t", Date.now().toString(36));

  const prefetch = () => {
    if (!document.querySelector("link[data-unique-home-return]")) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = destination.href;
      link.dataset.uniqueHomeReturn = "true";
      document.head.append(link);
    }

    const warm = () => {
      fetch(destination.href, {
        cache: "force-cache",
        credentials: "same-origin",
        priority: "low",
      }).catch(() => {});
    };
    if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 700 });
    else setTimeout(warm, 100);
  };

  const writePayload = (payload) => {
    try {
      sessionStorage.setItem(returnKey, JSON.stringify(payload));
    } catch {
      // Navigation remains usable when session storage is unavailable.
    }
  };

  const setNamed = (element, className, name) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.add(className);
    element.style.setProperty("view-transition-name", name);
  };

  const setIdentity = () => {
    setNamed(document.querySelector(".site-header .brand-avatar"), "return-site-avatar-source", "return-site-avatar");
    setNamed(document.querySelector(".site-header .brand > span"), "return-site-name-source", "return-site-name");
  };

  const planetMemory = () => {
    try {
      const raw = sessionStorage.getItem(planetMemoryKey);
      return raw ? JSON.parse(raw) : { x: "68px", y: "-22px" };
    } catch {
      return { x: "68px", y: "-22px" };
    }
  };

  const cleanupWritingArrivalArtifacts = () => {
    document.querySelectorAll(".writing-drop-thread").forEach((thread) => thread.remove());
    document.querySelectorAll(".writing-drop-target").forEach((marker) => {
      marker.classList.remove("writing-drop-target");
      marker.style.removeProperty("--writing-drop-y");
      marker.style.removeProperty("--writing-drop-delay");
    });
    document.querySelectorAll(".writing-site-avatar-target, .writing-site-name-target").forEach((element) => {
      element.classList.remove("writing-site-avatar-target", "writing-site-name-target");
      element.style.removeProperty("view-transition-name");
    });
    body.classList.remove("is-arriving-writing-archive", "is-arriving-writing-note");
    delete root.dataset.writingArrivalPending;
  };

  const cleanupPullArtifacts = () => {
    document.querySelectorAll(".return-pull-thread").forEach((thread) => thread.remove());
    document.querySelectorAll(".return-writing-source, .is-return-pulled").forEach((marker) => {
      marker.classList.remove("return-writing-source", "is-return-pulled");
      marker.style.removeProperty("--return-pull-y");
      marker.style.removeProperty("--return-pull-delay");
      marker.style.removeProperty("view-transition-name");
    });
  };

  const cleanupNamedSources = () => {
    document.querySelectorAll(".return-site-avatar-source, .return-site-name-source, .return-keke-planet-source").forEach((element) => {
      element.classList.remove("return-site-avatar-source", "return-site-name-source", "return-keke-planet-source");
      element.style.removeProperty("view-transition-name");
    });
  };

  const createPullThread = (marker, index) => {
    const rect = marker.getBoundingClientRect();
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom || 28;
    const anchorY = Math.max(18, Math.min(56, headerBottom));
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.max(38, centerY - anchorY);
    const delay = index * 22;

    marker.style.setProperty("--return-pull-y", `${-distance.toFixed(2)}px`);
    marker.style.setProperty("--return-pull-delay", `${delay}ms`);
    marker.classList.add("return-writing-source", "is-return-pulled");

    const thread = document.createElement("span");
    thread.className = "return-pull-thread";
    thread.style.setProperty("--return-thread-x", `${centerX.toFixed(2)}px`);
    thread.style.setProperty("--return-thread-top", `${anchorY.toFixed(2)}px`);
    thread.style.setProperty("--return-thread-height", `${distance.toFixed(2)}px`);
    thread.style.setProperty("--return-pull-delay", `${delay}ms`);
    document.body.append(thread);
    return [marker, thread];
  };

  const prepareCleanNavigationSnapshot = async () => {
    cleanupPullArtifacts();
    await afterStyleCommit();
  };

  const start = async (link) => {
    if (navigating) return;
    navigating = true;
    cleanupWritingArrivalArtifacts();
    cleanupPullArtifacts();
    setIdentity();
    link.setAttribute("aria-disabled", "true");
    link.dataset.returnHomeLink = "true";

    if (page === "keke") {
      setNamed(document.querySelector(".keke-transition-target"), "return-keke-planet-source", "return-keke-planet");
      writePayload({ mode: "keke-return" });
      body.classList.add("is-leaving-keke-home");
      await sleep(90);
      await afterStyleCommit();
      location.assign(destination.href);
      return;
    }

    const planet = planetMemory();
    const pullElements = [];
    if (page === "notes") {
      const viewportHeight = innerHeight || document.documentElement.clientHeight;
      const rows = [...document.querySelectorAll(".archive-row-v2")].filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom > 54 && rect.top < viewportHeight - 24;
      }).slice(0, 5);
      rows.forEach((row, index) => {
        if (!(row instanceof HTMLAnchorElement)) return;
        const marker = row.querySelector(".note-kind-marker");
        if (!(marker instanceof HTMLElement)) return;
        pullElements.push(...createPullThread(marker, index));
      });
      writePayload({ mode: "writing-archive-return", planet });
      body.classList.add("is-leaving-writing-home", "is-leaving-writing-archive-home");
      await waitForNamedAnimations(pullElements, 540);
    } else {
      const marker = document.querySelector(".article-meta-line .note-kind-marker");
      if (marker instanceof HTMLElement) pullElements.push(...createPullThread(marker, 0));
      writePayload({ mode: "writing-note-return", planet });
      body.classList.add("is-leaving-writing-home", "is-leaving-writing-note-home");
      await waitForNamedAnimations(pullElements, 460);
    }

    await prepareCleanNavigationSnapshot();
    location.assign(destination.href);
  };

  const resetSourcePage = () => {
    navigating = false;
    cleanupPullArtifacts();
    cleanupNamedSources();
    body.classList.remove(
      "is-leaving-keke-home",
      "is-leaving-writing-home",
      "is-leaving-writing-archive-home",
      "is-leaving-writing-note-home"
    );
    document.querySelectorAll("[data-return-home-link]").forEach((link) => {
      link.removeAttribute("aria-disabled");
      delete link.dataset.returnHomeLink;
    });
  };

  prefetch();
  document.addEventListener("click", (event) => {
    if (reducedMotion.matches || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element
      ? event.target.closest('.site-header .brand[href="./"], .site-footer a[href="./"]')
      : null;
    if (!(target instanceof HTMLAnchorElement)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    void start(target);
  }, true);

  addEventListener("pageshow", resetSourcePage);
})();
