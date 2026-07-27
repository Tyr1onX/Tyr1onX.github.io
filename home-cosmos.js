(() => {
  const field = document.querySelector("#cosmos-field");
  const starsLayer = document.querySelector("#note-stars");
  const threads = document.querySelector("#star-threads");
  const decoration = document.querySelector("#decorative-stars");
  const currentYear = document.querySelector("#current-year");
  const timeEl = document.querySelector("#current-time");
  if (!(field instanceof HTMLElement) || !(starsLayer instanceof HTMLElement) || !(threads instanceof SVGSVGElement)) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = matchMedia("(hover: none), (pointer: coarse)").matches;
  let pageVisible = !document.hidden;

  if (currentYear) currentYear.textContent = String(new Date().getFullYear());
  const updateClock = () => {
    if (!(timeEl instanceof HTMLTimeElement)) return;
    const now = new Date();
    timeEl.dateTime = now.toISOString();
    timeEl.textContent = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  };
  updateClock();
  const clockTimer = setInterval(updateClock, 30000);

  const rawNotes = Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [];
  const timestamp = (note) => {
    const direct = Date.parse(note?.datetime || "");
    if (Number.isFinite(direct)) return direct;
    const date = String(note?.date || "").replaceAll(".", "-");
    const fallback = Date.parse(`${date}T${note?.time || "00:00"}:00+08:00`);
    return Number.isFinite(fallback) ? fallback : 0;
  };
  const notes = [...rawNotes].sort((a, b) => timestamp(b) - timestamp(a)).slice(0, 8);
  const noteUrl = (note) => `./note.html?id=${encodeURIComponent(note.id)}`;
  const BASE_AGE = 20;
  const BASE_YEAR = 2026;
  const DECORATIVE_COUNT = BASE_AGE + Math.max(0, new Date().getFullYear() - BASE_YEAR);

  const windLayer = document.createElement("div");
  windLayer.className = "wind-streams";
  windLayer.setAttribute("aria-hidden", "true");
  windLayer.innerHTML = '<span class="wind-stream"></span><span class="wind-stream"></span><span class="wind-stream"></span>';
  field.prepend(windLayer);

  const layouts = [
    [0.10, 0.24, -0.19], [0.22, 0.39, 0.12], [0.35, 0.22, -0.13], [0.50, 0.31, 0.16],
    [0.66, 0.20, -0.12], [0.82, 0.35, 0.11], [0.18, 0.57, 0.08], [0.76, 0.56, -0.08],
  ];

  function randomGenerator(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => ((value = (value * 16807) % 2147483647) - 1) / 2147483646;
  }

  if (decoration instanceof HTMLElement) {
    const rand = randomGenerator(2025);
    decoration.innerHTML = Array.from({ length: DECORATIVE_COUNT }, (_, index) => {
      const x = (rand() * 100).toFixed(2);
      const y = (rand() * 100).toFixed(2);
      const size = (2.2 + rand() * 3.2).toFixed(2);
      const opacity = (0.40 + rand() * 0.34).toFixed(2);
      const duration = (2.8 + rand() * 5.4).toFixed(2);
      const delay = (-rand() * 7).toFixed(2);
      return `<span class="decorative-star" data-star="${index}" style="left:${x}%;top:${y}%;--star-size:${size}px;--star-opacity:${opacity};--twinkle-duration:${duration}s;--twinkle-delay:${delay}s"></span>`;
    }).join("");
  }

  starsLayer.innerHTML = notes.map((note, index) => {
    const size = 11.5 + (notes.length - index) * 0.9;
    const date = `${note.date}${note.time ? ` · ${note.time}` : ""}`;
    return `
      <a class="note-star" href="${noteUrl(note)}" aria-label="${note.title}，${date}" aria-expanded="false" style="--note-star-size:${size.toFixed(1)}px;--twinkle-duration:${(3.1 + (index % 4) * 0.8).toFixed(1)}s;--twinkle-delay:${(-index * 0.38).toFixed(2)}s">
        <span class="note-star-label"><time datetime="${note.datetime || ""}">${date}</time><span>${note.title}</span></span>
        <span class="note-star-core" aria-hidden="true"></span>
      </a>`;
  }).join("");
  threads.innerHTML = notes.map((_, index) => `<line class="star-thread" data-thread="${index}" />`).join("");

  const elements = [...starsLayer.querySelectorAll(".note-star")];
  const lines = [...threads.querySelectorAll(".star-thread")];
  const decorativeStars = [...document.querySelectorAll(".decorative-star")];
  const starTipOffsets = elements.map((element) => {
    const size = Number.parseFloat(getComputedStyle(element).getPropertyValue("--note-star-size"));
    return Number.isFinite(size) ? size / 2 : 6;
  });

  let bodies = [];
  let frame = 0;
  let last = 0;
  let started = performance.now();
  let gustTimer = 0;
  let windScheduleTimer = 0;
  let lastWindSign = 0;
  let activeTouchStar = null;

  function draw(index, body) {
    const el = elements[index];
    const line = lines[index];
    if (!(el instanceof HTMLElement) || !(line instanceof SVGLineElement)) return;
    el.style.transform = `translate(${body.x - 22}px, ${body.y - 22}px)`;
    line.setAttribute("x1", String(body.ax));
    line.setAttribute("y1", String(body.ay));
    line.setAttribute("x2", String(body.x));
    line.setAttribute("y2", String(body.y - starTipOffsets[index]));
  }

  function rebuild() {
    const width = field.clientWidth;
    const height = field.clientHeight;
    threads.setAttribute("viewBox", `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
    bodies = notes.map((_, index) => {
      const [anchorRatio, ropeRatio, angle] = layouts[index];
      const ax = width * anchorRatio;
      const ay = -10;
      const length = Math.max(140, height * ropeRatio);
      const restX = ax + Math.sin(angle) * length;
      const restY = ay + Math.cos(angle) * length;
      return {
        ax, ay, length, restX, restY,
        x: reduced ? restX : ax + (index % 2 ? 28 : -28),
        y: reduced ? restY : -80 - index * 34,
        vx: reduced ? 0 : (index % 2 ? 18 : -18),
        vy: 0,
        born: reduced,
        delay: index * 130,
      };
    });
    bodies.forEach((body, index) => {
      if (reduced) elements[index]?.classList.add("is-born");
      draw(index, body);
    });
  }

  function closeTouchStar() {
    if (!(activeTouchStar instanceof HTMLElement)) return;
    const index = elements.indexOf(activeTouchStar);
    activeTouchStar.classList.remove("is-touch-active");
    activeTouchStar.setAttribute("aria-expanded", "false");
    lines[index]?.classList.remove("is-active");
    activeTouchStar = null;
  }

  function openTouchStar(element, index) {
    closeTouchStar();
    activeTouchStar = element;
    element.classList.add("is-touch-active");
    element.setAttribute("aria-expanded", "true");
    lines[index]?.classList.add("is-active");
  }

  function ensurePhysicsFrame() {
    if (reduced || !pageVisible || frame) return;
    last = 0;
    frame = requestAnimationFrame(animate);
  }

  function triggerWind(force) {
    if (!pageVisible) return;
    document.body.classList.add("windy");
    let sign = Math.random() < 0.5 ? -1 : 1;
    if (sign === lastWindSign && Math.random() < 0.55) sign *= -1;
    lastWindSign = sign;

    field.dataset.windDirection = sign > 0 ? "right" : "left";
    field.style.setProperty("--wind-duration", `${(1.9 + Math.random() * 0.7).toFixed(2)}s`);

    bodies.forEach((body, index) => {
      const depth = 1 - index / Math.max(1, bodies.length - 1);
      body.vx += sign * force * (0.5 + depth * 0.8) * (0.7 + Math.random() * 0.6);
      body.vy -= force * 0.08 * Math.random();
    });
    decorativeStars.forEach((star, index) => {
      const drift = sign * (6 + Math.random() * 9);
      star.style.transform = `translateX(${drift}px) scale(${0.96 + (index % 3) * 0.04})`;
      star.style.transition = `transform ${1.6 + Math.random() * 1.6}s cubic-bezier(.22,1,.36,1)`;
      setTimeout(() => { star.style.transform = ""; }, 1800);
    });
    clearTimeout(gustTimer);
    gustTimer = setTimeout(() => {
      document.body.classList.remove("windy");
      delete field.dataset.windDirection;
    }, 2400);
    ensurePhysicsFrame();
  }

  function scheduleWind() {
    clearTimeout(windScheduleTimer);
    if (reduced || !pageVisible) return;
    const delay = 18000 + Math.random() * 24000;
    windScheduleTimer = setTimeout(() => {
      triggerWind(30 + Math.random() * 16);
      scheduleWind();
    }, delay);
  }

  function animate(now) {
    if (reduced || !pageVisible) {
      frame = 0;
      return;
    }
    const dt = Math.min(0.032, Math.max(0.001, (now - (last || now)) / 1000));
    last = now;
    const elapsed = now - started;
    let moving = false;

    bodies.forEach((body, index) => {
      if (elapsed < body.delay) return;
      if (!body.born) {
        body.born = true;
        elements[index]?.classList.add("is-born");
      }

      body.vy += 1040 * dt;
      const drag = Math.exp(-0.34 * dt);
      body.vx *= drag;
      body.vy *= drag;
      body.x += body.vx * dt;
      body.y += body.vy * dt;

      const dx = body.x - body.ax;
      const dy = body.y - body.ay;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > body.length) {
        const nx = dx / distance;
        const ny = dy / distance;
        body.x = body.ax + nx * body.length;
        body.y = body.ay + ny * body.length;
        const outward = body.vx * nx + body.vy * ny;
        if (outward > 0) {
          body.vx -= outward * nx;
          body.vy -= outward * ny;
        }
      }

      const settle = Math.min(1, Math.max(0, (elapsed - body.delay - 1400) / 3800));
      body.vx += (body.restX - body.x) * 0.18 * settle * dt;
      body.vy += (body.restY - body.y) * 0.18 * settle * dt;
      draw(index, body);
      if (elapsed < body.delay + 7600 || Math.abs(body.vx) + Math.abs(body.vy) > 0.45) moving = true;
    });

    if (moving) frame = requestAnimationFrame(animate);
    else frame = 0;
  }

  elements.forEach((element, index) => {
    const line = lines[index];
    const on = () => line?.classList.add("is-active");
    const off = () => {
      if (element !== activeTouchStar) line?.classList.remove("is-active");
    };

    element.addEventListener("mouseenter", on);
    element.addEventListener("mouseleave", off);
    element.addEventListener("focus", on);
    element.addEventListener("blur", off);

    if (coarsePointer) {
      element.addEventListener("click", (event) => {
        if (activeTouchStar === element) {
          closeTouchStar();
          return;
        }
        event.preventDefault();
        openTouchStar(element, index);
      });
    }
  });

  if (coarsePointer) {
    document.addEventListener("pointerdown", (event) => {
      if (!(activeTouchStar instanceof HTMLElement)) return;
      if (event.target instanceof Node && activeTouchStar.contains(event.target)) return;
      closeTouchStar();
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeTouchStar();
    });
  }

  document.addEventListener("visibilitychange", () => {
    pageVisible = !document.hidden;
    document.body.classList.toggle("is-page-hidden", !pageVisible);
    if (!pageVisible) {
      cancelAnimationFrame(frame);
      frame = 0;
      clearTimeout(windScheduleTimer);
      clearTimeout(gustTimer);
      document.body.classList.remove("windy");
      delete field.dataset.windDirection;
      return;
    }
    updateClock();
    last = 0;
    started = performance.now();
    ensurePhysicsFrame();
    scheduleWind();
  });

  rebuild();
  ensurePhysicsFrame();
  scheduleWind();

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      started = performance.now();
      closeTouchStar();
      rebuild();
      ensurePhysicsFrame();
    }, 120);
  }, { passive: true });

  addEventListener("pagehide", () => {
    clearInterval(clockTimer);
    clearTimeout(windScheduleTimer);
    clearTimeout(gustTimer);
    cancelAnimationFrame(frame);
  }, { once: true });
})();