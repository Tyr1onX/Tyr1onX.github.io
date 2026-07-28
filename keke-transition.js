(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "tyr1onx:keke-planet-transition";
  const body = document.body;

  function setArrivalState() {
    if (body.dataset.page !== "keke") return;

    let arrivedFromHome = false;
    try {
      arrivedFromHome = sessionStorage.getItem(storageKey) === "1";
      sessionStorage.removeItem(storageKey);
    } catch {
      arrivedFromHome = false;
    }

    if (!arrivedFromHome || reducedMotion.matches) return;
    body.classList.add("is-arriving-keke");
    setTimeout(() => body.classList.remove("is-arriving-keke"), 1200);
  }

  function installHomeTransition() {
    if (body.dataset.page !== "home") return;

    const link = document.querySelector(".orbit-project[href$='keke.html']");
    const image = link?.querySelector("img");
    if (!(link instanceof HTMLAnchorElement) || !(image instanceof HTMLImageElement)) return;

    let navigating = false;

    link.addEventListener("click", (event) => {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      if (event.defaultPrevented || event.button !== 0 || modified || reducedMotion.matches) return;

      event.preventDefault();
      if (navigating) return;
      navigating = true;

      link.focus({ preventScroll: true });
      image.classList.add("keke-transition-source");
      body.classList.add("is-entering-keke");
      link.setAttribute("aria-disabled", "true");

      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        // The transition remains usable without storage; only the destination reveal is skipped.
      }

      const destination = new URL(link.href, location.href).href;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => location.assign(destination), 300);
        });
      });
    });

    addEventListener("pageshow", () => {
      navigating = false;
      body.classList.remove("is-entering-keke");
      image.classList.remove("keke-transition-source");
      link.removeAttribute("aria-disabled");
    });
  }

  setArrivalState();
  installHomeTransition();
})();
