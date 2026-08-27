(() => {
  const root = document.documentElement;
  const THEME_KEY = "tyr1onx-theme";
  const KEKE_KEY = "tyr1onx:keke-planet-transition";
  const WRITING_KEY = "tyr1onx:writing-transition";
  const RETURN_KEY = "tyr1onx:return-home-transition";
  const KNOWLEDGE_KEY = "tyr1onx:knowledge-transition";
  const KNOWLEDGE_FORWARD = "home-to-knowledge";
  const KNOWLEDGE_RETURN = "knowledge-to-home";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("js", "theme-initializing");

  const transitionGuard = document.createElement("style");
  transitionGuard.dataset.themeFirstFrame = "true";
  transitionGuard.textContent = "html.theme-initializing body{transition:none!important}";
  document.head.append(transitionGuard);

  const readStorage = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const readSession = (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const removeSession = (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // A blocked storage area must not prevent a stable first frame.
    }
  };

  const storedTheme = readStorage(THEME_KEY);
  const theme = storedTheme === "dark" || storedTheme === "light"
    ? storedTheme
    : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0d0d10" : "#f7f7fa"
  );

  const pageName = (value) => {
    try {
      const path = new URL(value, location.href).pathname;
      const name = path.split("/").filter(Boolean).pop() || "index.html";
      return name === "index.html" ? "home" : name.replace(/\.html$/i, "");
    } catch {
      return "";
    }
  };

  const readJsonMode = (key) => {
    try {
      return JSON.parse(readSession(key) || "null")?.mode || "";
    } catch {
      return "";
    }
  };

  const routeFromCommittedIntent = (targetPage) => {
    if (currentPage === "home") {
      if (targetPage === "knowledge" && readJsonMode(KNOWLEDGE_KEY) === KNOWLEDGE_FORWARD) return "home-to-knowledge";
      if (targetPage === "keke" && readSession(KEKE_KEY) === "1") return "home-to-keke";
      const mode = readJsonMode(WRITING_KEY);
      if (targetPage === "notes" && mode === "archive") return "home-to-writing-archive";
      if (targetPage === "note" && mode === "note") return "home-to-writing-note";
      return "";
    }

    if (targetPage !== "home") return "";
    if (currentPage === "knowledge" && readJsonMode(KNOWLEDGE_KEY) === KNOWLEDGE_RETURN) return "knowledge-to-home";
    const mode = readJsonMode(RETURN_KEY);
    if (currentPage === "keke" && mode === "keke-return") return "keke-to-home";
    if ((currentPage === "notes" || currentPage === "note")
      && (mode === "writing-archive-return" || mode === "writing-note-return")) {
      return "writing-to-home";
    }
    return "";
  };

  const currentPage = pageName(location.href);
  const url = new URL(location.href);
  let route = "";

  if (currentPage === "home") {
    const knowledgeMode = readJsonMode(KNOWLEDGE_KEY);
    const queryMode = url.searchParams.get("__return");
    if (!reducedMotion && (knowledgeMode === KNOWLEDGE_RETURN || queryMode === "knowledge")) {
      root.dataset.knowledgeReturnPending = "knowledge-return";
      route = "knowledge-to-home";
    } else {
      const storedMode = readJsonMode(RETURN_KEY);
      const mode = storedMode
        || (queryMode === "keke" ? "keke-return" : queryMode === "writing" ? "writing-archive-return" : "");
      if (mode === "keke-return" || mode === "writing-archive-return" || mode === "writing-note-return") {
        root.dataset.returnHomePending = mode;
        route = mode === "keke-return" ? "keke-to-home" : "writing-to-home";
      }
    }
  } else if (currentPage === "keke") {
    if (readSession(KEKE_KEY) === "1") {
      root.dataset.kekeArrivalPending = "home";
      route = "home-to-keke";
    }
  } else if (currentPage === "notes" || currentPage === "note") {
    const storedMode = readJsonMode(WRITING_KEY);
    const queryMode = url.searchParams.get("__writing");
    const mode = queryMode || storedMode;
    const expectedMode = currentPage === "notes" ? "archive" : "note";
    if (mode === expectedMode) {
      root.dataset.writingArrivalPending = mode;
      route = mode === "archive" ? "home-to-writing-archive" : "home-to-writing-note";
    }
  } else if (currentPage === "knowledge") {
    const mode = readJsonMode(KNOWLEDGE_KEY);
    const queryMode = url.searchParams.get("__knowledge");
    if (!reducedMotion && (mode === KNOWLEDGE_FORWARD || queryMode === "home")) {
      root.dataset.knowledgeArrivalPending = "home";
      route = "home-to-knowledge";
    }
  }

  if (route) root.dataset.transitionRoute = route;

  const transientKeys = ["__return", "__writing", "__keke", "__knowledge", "__t"];
  if (transientKeys.some((key) => url.searchParams.has(key))) {
    transientKeys.forEach((key) => url.searchParams.delete(key));
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const domReady = document.readyState === "loading"
    ? new Promise((resolve) => addEventListener("DOMContentLoaded", resolve, { once: true }))
    : Promise.resolve();

  const revealReady = route && "onpagereveal" in window
    ? new Promise((resolve) => {
      addEventListener("pagereveal", (event) => {
        Promise.resolve(event.viewTransition?.finished).then(resolve, resolve);
      }, { once: true });
    })
    : Promise.resolve();

  const afterTwoFrames = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const handoff = Promise.all([domReady, revealReady]).then(afterTwoFrames);
  window.TYR1ONX_NAVIGATION_HANDOFF = handoff;
  window.TYR1ONX_RETURN_HANDOFF = handoff;

  domReady.then(() => {
    if (route === "home-to-keke" || route === "home-to-writing-archive" || route === "home-to-writing-note") {
      document.querySelectorAll("main .reveal").forEach((element) => element.classList.add("is-visible"));
    }
    requestAnimationFrame(() => {
      root.classList.remove("theme-initializing");
      root.dataset.themeReady = "true";
    });
  });

  handoff.then(() => {
    if (route === "home-to-keke") {
      delete root.dataset.kekeArrivalPending;
      delete root.dataset.transitionRoute;
      if (reducedMotion) removeSession(KEKE_KEY);
    } else if (route === "home-to-writing-archive" || route === "home-to-writing-note") {
      delete root.dataset.writingArrivalPending;
      delete root.dataset.transitionRoute;
      if (reducedMotion) removeSession(WRITING_KEY);
    }
  });

  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(link instanceof HTMLAnchorElement)) return;

    queueMicrotask(() => {
      const nextRoute = routeFromCommittedIntent(pageName(link.href));
      if (nextRoute) root.dataset.transitionRoute = nextRoute;
    });
  }, true);

  addEventListener("pageswap", (event) => {
    const destination = event.activation?.entry?.url;
    const nextRoute = destination ? routeFromCommittedIntent(pageName(destination)) : "";
    if (nextRoute) root.dataset.transitionRoute = nextRoute;
    else delete root.dataset.transitionRoute;
  });

  addEventListener("pageshow", (event) => {
    if (!event.persisted) return;

    delete root.dataset.transitionRoute;
    delete root.dataset.kekeArrivalPending;
    delete root.dataset.writingArrivalPending;
    delete root.dataset.returnHomePending;
    delete root.dataset.knowledgeArrivalPending;
    delete root.dataset.knowledgeReturnPending;
    delete root.dataset.knowledgeMotionState;
    root.classList.remove("theme-initializing");
    root.dataset.themeReady = "true";

    document.body?.classList.remove(
      "is-arriving-keke",
      "is-arriving-writing-archive",
      "is-arriving-writing-note",
      "is-returning-keke-home",
      "is-returning-writing-home",
      "is-returning-writing-archive-home",
      "is-returning-writing-note-home",
      "is-leaving-keke-home",
      "is-leaving-writing-home",
      "is-leaving-writing-archive-home",
      "is-leaving-writing-note-home",
      "is-preparing-keke",
      "is-entering-keke",
      "is-preparing-writing-archive",
      "is-entering-writing-archive",
      "is-preparing-writing-note",
      "is-entering-writing-note",
      "is-cosmos-retracting",
      "is-cosmos-return-drop"
    );
    if (document.body) delete document.body.dataset.knowledgeMotionState;

    document.querySelectorAll("[style*='view-transition-name']").forEach((element) => {
      element.style.removeProperty("view-transition-name");
    });
    document.querySelectorAll(
      ".keke-transition-source, .keke-site-avatar-source, .keke-site-name-source,"
      + " .writing-site-avatar-source, .writing-site-name-source, .writing-site-avatar-target, .writing-site-name-target,"
      + " .return-site-avatar-source, .return-site-name-source, .return-keke-planet-source,"
      + " .return-site-avatar-target, .return-site-name-target, .return-keke-planet-target"
    ).forEach((element) => {
      element.classList.remove(
        "keke-transition-source",
        "keke-site-avatar-source",
        "keke-site-name-source",
        "writing-site-avatar-source",
        "writing-site-name-source",
        "writing-site-avatar-target",
        "writing-site-name-target",
        "return-site-avatar-source",
        "return-site-name-source",
        "return-keke-planet-source",
        "return-site-avatar-target",
        "return-site-name-target",
        "return-keke-planet-target"
      );
    });

    removeSession(KEKE_KEY);
    removeSession(WRITING_KEY);
    removeSession(RETURN_KEY);
    // Knowledge route storage is owned by knowledge-transition.js so a BFCache
    // restore can distinguish a real knowledge return from a normal Back action.
  });
})();
