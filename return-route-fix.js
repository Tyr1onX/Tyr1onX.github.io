(() => {
  const body = document.body;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const returnKey = "tyr1onx:return-home-transition";
  const planetMemoryKey = "tyr1onx:writing-planet-memory";
  const page = body.dataset.page || "";

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

  const noteId = (href) => {
    try {
      return new URL(href, location.href).searchParams.get("id") || "";
    } catch {
      return "";
    }
  };

  const planetMemory = () => {
    try {
      const raw = sessionStorage.getItem(planetMemoryKey);
      return raw ? JSON.parse(raw) : { x: "68px", y: "-22px" };
    } catch {
      return { x: "68px", y: "-22px" };
    }
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
  };

  const start = (link) => {
    setIdentity();
    link.setAttribute("aria-disabled", "true");
    link.dataset.returnHomeLink = "true";

    if (page === "keke") {
      setNamed(document.querySelector(".keke-transition-target"), "return-keke-planet-source", "return-keke-planet");
      writePayload({ mode: "keke-return" });
      body.classList.add("is-leaving-keke-home");
      setTimeout(() => location.assign(destination.href), 90);
      return;
    }

    const planet = planetMemory();
    if (page === "notes") {
      const viewportHeight = innerHeight || document.documentElement.clientHeight;
      const rows = [...document.querySelectorAll(".archive-row-v2")].filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom > 54 && rect.top < viewportHeight - 24;
      }).slice(0, 5);
      const ids = [];
      rows.forEach((row, index) => {
        if (!(row instanceof HTMLAnchorElement)) return;
        const marker = row.querySelector(".note-kind-marker");
        const id = noteId(row.href);
        if (!id || !(marker instanceof HTMLElement)) return;
        ids[index] = id;
        marker.style.setProperty("view-transition-name", `return-writing-star-${index}`);
        createPullThread(marker, index);
      });
      writePayload({ mode: "writing-archive-return", ids, planet });
      body.classList.add("is-leaving-writing-home", "is-leaving-writing-archive-home");
    } else {
      const id = new URLSearchParams(location.search).get("id") || "";
      const marker = document.querySelector(".article-meta-line .note-kind-marker");
      if (marker instanceof HTMLElement && id) {
        marker.style.setProperty("view-transition-name", "return-writing-focus-star");
        createPullThread(marker, 0);
      }
      writePayload({ mode: "writing-note-return", id, planet });
      body.classList.add("is-leaving-writing-home", "is-leaving-writing-note-home");
    }
    setTimeout(() => location.assign(destination.href), 250);
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
    start(target);
  }, true);
})();