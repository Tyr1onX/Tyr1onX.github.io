(() => {
  const body = document.body;
  const root = document.documentElement;
  if (body?.dataset.page !== "home") return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  if (reducedMotion.matches) return;

  const style = document.createElement("style");
  style.dataset.cosmosStarMotion = "true";
  style.textContent = `
    body.is-cosmos-retracting .note-star,
    body.is-cosmos-retracting .star-thread,
    body.is-preparing-keke .note-star,
    body.is-entering-keke .note-star,
    body.is-preparing-keke .star-thread,
    body.is-entering-keke .star-thread,
    body.is-preparing-writing-archive .writing-retract-source,
    body.is-entering-writing-archive .writing-retract-source,
    body.is-preparing-writing-note .writing-retract-source,
    body.is-entering-writing-note .writing-retract-source,
    body.is-preparing-writing-archive .writing-retract-thread,
    body.is-entering-writing-archive .writing-retract-thread,
    body.is-preparing-writing-note .writing-retract-thread,
    body.is-entering-writing-note .writing-retract-thread {
      animation: none !important;
      transition: none !important;
    }

    body.is-cosmos-retracting .note-star-core {
      scale: 1 !important;
    }

    body.is-cosmos-return-drop .note-star,
    body.is-cosmos-return-drop.is-returning-keke-home .note-star,
    body.is-cosmos-return-drop.is-returning-writing-home .note-star {
      opacity: 1 !important;
      translate: 0 0 !important;
      scale: 1 !important;
      animation: none !important;
      transition: none !important;
    }

    body.is-cosmos-return-drop .star-thread,
    body.is-cosmos-return-drop.is-returning-keke-home .star-thread,
    body.is-cosmos-return-drop.is-returning-writing-home .star-thread {
      opacity: 1 !important;
      transform: none !important;
      animation: none !important;
      transition: none !important;
    }
  `;
  document.head.append(style);

  const stars = () => [...document.querySelectorAll("#note-stars .note-star")];
  const lines = () => [...document.querySelectorAll("#star-threads .star-thread")];
  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const smoothstep = (value) => value * value * (3 - 2 * value);
  const easeOut = (value) => 1 - Math.pow(1 - value, 3);

  let retractFrame = 0;
  let retractSnapshot = null;
  let retractMode = "";

  const pauseCosmos = () => {
    try {
      dispatchEvent(new Event("pagehide"));
    } catch {
      // The transition can still proceed if a browser rejects a synthetic lifecycle event.
    }
  };

  const restoreRetraction = () => {
    cancelAnimationFrame(retractFrame);
    retractFrame = 0;

    retractSnapshot?.forEach((item) => {
      item.star.style.translate = item.starTranslate;
      item.star.style.opacity = item.starOpacity;
      item.line.style.opacity = item.lineOpacity;
      item.line.setAttribute("x2", item.tipX.toFixed(2));
      item.line.setAttribute("y2", item.tipY.toFixed(2));
    });

    retractSnapshot = null;
    retractMode = "";
    body.classList.remove("is-cosmos-retracting");
  };

  const selectedIndices = (mode) => {
    const starElements = stars();
    if (mode !== "writing-note") return starElements.map((_, index) => index);

    const index = starElements.findIndex((star) => star.classList.contains("writing-retract-source"));
    return index >= 0 ? [index] : [];
  };

  const retractionPlan = (mode) => {
    if (mode === "keke") return { duration: 520, baseDelay: 70, stagger: 42 };
    if (mode === "writing-archive") return { duration: 440, baseDelay: 0, stagger: 28 };
    return { duration: 440, baseDelay: 0, stagger: 0 };
  };

  const startRetraction = (mode) => {
    if (retractMode || body.classList.contains("is-cosmos-return-drop")) return;

    const starElements = stars();
    const lineElements = lines();
    const indices = selectedIndices(mode);
    if (!indices.length) return;

    const plan = retractionPlan(mode);
    const items = indices.map((index, order) => {
      const star = starElements[index];
      const line = lineElements[index];
      if (!(star instanceof HTMLElement) || !(line instanceof SVGLineElement)) return null;

      const anchorX = Number.parseFloat(line.getAttribute("x1") || "");
      const anchorY = Number.parseFloat(line.getAttribute("y1") || "");
      const tipX = Number.parseFloat(line.getAttribute("x2") || "");
      const tipY = Number.parseFloat(line.getAttribute("y2") || "");
      if (![anchorX, anchorY, tipX, tipY].every(Number.isFinite)) return null;

      return {
        star,
        line,
        anchorX,
        anchorY,
        tipX,
        tipY,
        delay: plan.baseDelay + order * plan.stagger,
        starTranslate: star.style.translate,
        starOpacity: star.style.opacity,
        lineOpacity: line.style.opacity,
      };
    }).filter(Boolean);

    if (!items.length) return;

    retractMode = mode;
    retractSnapshot = items;
    pauseCosmos();
    body.classList.add("is-cosmos-retracting");
    items.forEach(({ star }) => star.blur());

    const startedAt = performance.now();
    const step = (now) => {
      let complete = true;

      items.forEach((item) => {
        const local = clamp01((now - startedAt - item.delay) / plan.duration);
        if (local < 1) complete = false;
        const progress = smoothstep(local);
        const deltaX = (item.anchorX - item.tipX) * progress;
        const deltaY = (item.anchorY - item.tipY) * progress;
        const fade = local < 0.86 ? 1 : 1 - (local - 0.86) / 0.14;

        item.star.style.translate = `${deltaX.toFixed(2)}px ${deltaY.toFixed(2)}px`;
        item.star.style.opacity = clamp01(fade).toFixed(3);
        item.line.style.opacity = clamp01(fade).toFixed(3);
        item.line.setAttribute("x2", (item.tipX + deltaX).toFixed(2));
        item.line.setAttribute("y2", (item.tipY + deltaY).toFixed(2));
      });

      retractFrame = complete ? 0 : requestAnimationFrame(step);
    };

    retractFrame = requestAnimationFrame(step);
  };

  const synchronizeForwardState = () => {
    if (body.classList.contains("is-preparing-keke")) {
      startRetraction("keke");
      return;
    }
    if (body.classList.contains("is-preparing-writing-archive")) {
      startRetraction("writing-archive");
      return;
    }
    if (body.classList.contains("is-preparing-writing-note")) {
      startRetraction("writing-note");
    }
  };

  const forwardObserver = new MutationObserver(synchronizeForwardState);
  forwardObserver.observe(body, { attributes: true, attributeFilter: ["class"] });

  let returnFrame = 0;
  let returnDropActive = false;
  let pendingCompleteEvent = null;
  const originalDispatchEvent = window.dispatchEvent;

  const tipOffsetFor = (star) => {
    const size = Number.parseFloat(getComputedStyle(star).getPropertyValue("--note-star-size"));
    return Number.isFinite(size) ? size / 2 : 6;
  };

  const finishReturnDrop = (items) => {
    cancelAnimationFrame(returnFrame);
    returnFrame = 0;

    items.forEach((item) => {
      item.x = item.restX;
      item.y = item.restY;
      item.star.style.transform = `translate3d(${(item.x - 22).toFixed(2)}px, ${(item.y - 22).toFixed(2)}px, 0)`;
      item.star.style.opacity = "";
      item.star.style.translate = "";
      item.line.style.opacity = "";
      item.line.setAttribute("x1", item.ax.toFixed(2));
      item.line.setAttribute("y1", item.ay.toFixed(2));
      item.line.setAttribute("x2", item.x.toFixed(2));
      item.line.setAttribute("y2", (item.y - item.tipOffset).toFixed(2));
    });

    body.classList.remove("is-cosmos-return-drop");
    returnDropActive = false;
    window.dispatchEvent = originalDispatchEvent;

    const completion = pendingCompleteEvent || new CustomEvent("tyr1onx:return-home-complete");
    pendingCompleteEvent = null;
    originalDispatchEvent.call(window, completion);
  };

  const startReturnDrop = () => {
    if (!root.dataset.returnHomePending || returnDropActive) return;

    const starElements = stars();
    const lineElements = lines();
    const items = starElements.map((star, index) => {
      const line = lineElements[index];
      if (!(star instanceof HTMLElement) || !(line instanceof SVGLineElement)) return null;

      const ax = Number.parseFloat(line.getAttribute("x1") || "");
      const ay = Number.parseFloat(line.getAttribute("y1") || "");
      const tipX = Number.parseFloat(line.getAttribute("x2") || "");
      const tipY = Number.parseFloat(line.getAttribute("y2") || "");
      if (![ax, ay, tipX, tipY].every(Number.isFinite)) return null;

      const tipOffset = tipOffsetFor(star);
      const restX = tipX;
      const restY = tipY + tipOffset;
      return {
        star,
        line,
        ax,
        ay,
        tipOffset,
        length: Math.max(1, Math.hypot(restX - ax, restY - ay)),
        restX,
        restY,
        x: ax + (index % 2 ? 28 : -28),
        y: -80 - index * 34,
        vx: index % 2 ? 18 : -18,
        vy: 0,
        delay: index * 130,
      };
    }).filter(Boolean);

    if (!items.length) return;

    returnDropActive = true;
    window.dispatchEvent = function dispatchReturnCompletion(event) {
      if (event instanceof Event && event.type === "tyr1onx:return-home-complete" && returnDropActive) {
        pendingCompleteEvent = event;
        return true;
      }
      return originalDispatchEvent.call(this, event);
    };

    items.forEach((item) => {
      item.star.style.translate = "";
      item.star.style.opacity = "";
      item.line.style.opacity = "";
      item.star.style.transform = `translate3d(${(item.x - 22).toFixed(2)}px, ${(item.y - 22).toFixed(2)}px, 0)`;
      item.line.setAttribute("x1", item.ax.toFixed(2));
      item.line.setAttribute("y1", item.ay.toFixed(2));
      item.line.setAttribute("x2", item.x.toFixed(2));
      item.line.setAttribute("y2", (item.y - item.tipOffset).toFixed(2));
    });
    body.classList.add("is-cosmos-return-drop");

    const physicsStartedAt = performance.now();
    let last = physicsStartedAt;
    let settleStartedAt = 0;
    let settleOrigins = null;
    const physicsDuration = 5200;
    const settleDuration = 680;

    const draw = (item) => {
      item.star.style.transform = `translate3d(${(item.x - 22).toFixed(2)}px, ${(item.y - 22).toFixed(2)}px, 0)`;
      item.line.setAttribute("x2", item.x.toFixed(2));
      item.line.setAttribute("y2", (item.y - item.tipOffset).toFixed(2));
    };

    const step = (now) => {
      const elapsed = now - physicsStartedAt;

      if (elapsed < physicsDuration) {
        const dt = Math.min(0.04, Math.max(0.001, (now - last) / 1000));
        last = now;

        items.forEach((item) => {
          if (elapsed < item.delay) return;

          item.vy += 1040 * dt;
          const drag = Math.exp(-0.34 * dt);
          item.vx *= drag;
          item.vy *= drag;
          item.x += item.vx * dt;
          item.y += item.vy * dt;

          const dx = item.x - item.ax;
          const dy = item.y - item.ay;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance > item.length) {
            const nx = dx / distance;
            const ny = dy / distance;
            item.x = item.ax + nx * item.length;
            item.y = item.ay + ny * item.length;
            const outward = item.vx * nx + item.vy * ny;
            if (outward > 0) {
              item.vx -= outward * nx;
              item.vy -= outward * ny;
            }
          }

          const settle = clamp01((elapsed - item.delay - 1400) / 3800);
          item.vx += (item.restX - item.x) * 0.18 * settle * dt;
          item.vy += (item.restY - item.y) * 0.18 * settle * dt;
          draw(item);
        });

        returnFrame = requestAnimationFrame(step);
        return;
      }

      if (!settleStartedAt) {
        settleStartedAt = now;
        settleOrigins = items.map((item) => ({ x: item.x, y: item.y }));
      }

      const settleProgress = clamp01((now - settleStartedAt) / settleDuration);
      const eased = easeOut(settleProgress);
      items.forEach((item, index) => {
        const origin = settleOrigins[index];
        item.x = origin.x + (item.restX - origin.x) * eased;
        item.y = origin.y + (item.restY - origin.y) * eased;
        draw(item);
      });

      if (settleProgress >= 1) {
        finishReturnDrop(items);
      } else {
        returnFrame = requestAnimationFrame(step);
      }
    };

    returnFrame = requestAnimationFrame(step);
  };

  addEventListener("pageshow", () => {
    if (retractSnapshot) restoreRetraction();
  });

  addEventListener("pagehide", () => {
    if (!returnDropActive) return;
    cancelAnimationFrame(returnFrame);
    returnFrame = 0;
    window.dispatchEvent = originalDispatchEvent;
  });

  startReturnDrop();
})();
