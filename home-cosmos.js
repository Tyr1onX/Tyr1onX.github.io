(() => {
  const field = document.querySelector("#cosmos-field");
  const starsLayer = document.querySelector("#note-stars");
  const threads = document.querySelector("#star-threads");
  const decoration = document.querySelector("#decorative-stars");
  if (!(field instanceof HTMLElement) || !(starsLayer instanceof HTMLElement) || !(threads instanceof SVGSVGElement)) return;

  const rawNotes = Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [];
  const timestamp = (note) => {
    const direct = Date.parse(note?.datetime || "");
    if (Number.isFinite(direct)) return direct;
    const date = String(note?.date || "").replaceAll(".", "-");
    const fallback = Date.parse(`${date}T${note?.time || "00:00"}:00+08:00`);
    return Number.isFinite(fallback) ? fallback : 0;
  };
  const notes = [...rawNotes].sort((a, b) => timestamp(b) - timestamp(a)).slice(0, 8);
  const urlFor = (note) => `./note.html?id=${encodeURIComponent(note.id)}`;
  const layouts = [
    [.11,.28,-.20], [.27,.42,.16], [.42,.22,-.12], [.58,.34,.18],
    [.73,.25,-.16], [.88,.44,.12], [.19,.56,.11], [.81,.58,-.10],
  ];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function randomGenerator(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => ((value = value * 16807 % 2147483647) - 1) / 2147483646;
  }

  if (decoration instanceof HTMLElement) {
    const random = randomGenerator(7319);
    decoration.innerHTML = Array.from({ length: 42 }, () => {
      const x = (random() * 100).toFixed(2);
      const y = (random() * 100).toFixed(2);
      const size = (1 + random() * 2.1).toFixed(2);
      const opacity = (.16 + random() * .34).toFixed(2);
      const duration = (2.8 + random() * 4.8).toFixed(2);
      const delay = (-random() * 6).toFixed(2);
      return `<span class="decorative-star" style="left:${x}%;top:${y}%;--star-size:${size}px;--star-opacity:${opacity};--twinkle-duration:${duration}s;--twinkle-delay:${delay}s"></span>`;
    }).join("");
  }

  starsLayer.innerHTML = notes.map((note, index) => {
    const size = 7 + (notes.length - index) * .55;
    const duration = 3.1 + index % 4 * .7;
    const delay = -index * .42;
    const date = `${note.date}${note.time ? ` · ${note.time}` : ""}`;
    return `<a class="note-star" href="${urlFor(note)}" aria-label="${note.title}，${date}" style="--note-star-size:${size.toFixed(1)}px;--twinkle-duration:${duration.toFixed(1)}s;--twinkle-delay:${delay.toFixed(2)}s"><span class="note-star-label"><time datetime="${note.datetime || ""}">${date}</time>${note.title}</span><span class="note-star-core" aria-hidden="true"></span></a>`;
  }).join("");
  threads.innerHTML = notes.map((_, index) => `<line class="star-thread" data-thread="${index}" />`).join("");

  const elements = [...starsLayer.querySelectorAll(".note-star")];
  const lines = [...threads.querySelectorAll(".star-thread")];
  let bodies = [];
  let frame = 0;
  let last = 0;
  let started = performance.now();

  function draw(index, body) {
    const element = elements[index];
    const line = lines[index];
    if (!(element instanceof HTMLElement) || !(line instanceof SVGLineElement)) return;
    element.style.transform = `translate(${body.x - 22}px,${body.y - 22}px)`;
    line.setAttribute("x1", body.ax);
    line.setAttribute("y1", body.ay);
    line.setAttribute("x2", body.x);
    line.setAttribute("y2", body.y);
  }

  function rebuild() {
    const width = field.clientWidth;
    const height = field.clientHeight;
    threads.setAttribute("viewBox", `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
    bodies = notes.map((_, index) => {
      const [anchorRatio, ropeRatio, angle] = layouts[index];
      const ax = width * anchorRatio;
      const ay = -8;
      const length = Math.max(120, height * ropeRatio);
      const restX = ax + Math.sin(angle) * length;
      const restY = ay + Math.cos(angle) * length;
      return {
        ax, ay, length, restX, restY,
        x: reduced ? restX : ax + (index % 2 ? 38 : -38),
        y: reduced ? restY : -70 - index * 34,
        vx: reduced ? 0 : (index % 2 ? 16 : -16),
        vy: 0,
        delay: index * 115,
        born: reduced,
      };
    });
    bodies.forEach((body, index) => {
      if (reduced) elements[index]?.classList.add("is-born");
      draw(index, body);
    });
  }

  function animate(now) {
    if (reduced) return;
    const dt = Math.min(.032, Math.max(.001, (now - (last || now)) / 1000));
    last = now;
    const elapsed = now - started;
    let moving = false;

    bodies.forEach((body, index) => {
      if (elapsed < body.delay) return;
      if (!body.born) {
        body.born = true;
        elements[index]?.classList.add("is-born");
      }

      body.vy += 1050 * dt;
      const drag = Math.exp(-.34 * dt);
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
        const outwardSpeed = body.vx * nx + body.vy * ny;
        if (outwardSpeed > 0) {
          body.vx -= outwardSpeed * nx;
          body.vy -= outwardSpeed * ny;
        }
        body.vx *= .986;
        body.vy *= .986;
      }

      const settle = Math.min(1, Math.max(0, (elapsed - body.delay - 1600) / 4200));
      body.vx += (body.restX - body.x) * .16 * settle * dt;
      body.vy += (body.restY - body.y) * .16 * settle * dt;
      draw(index, body);
      if (elapsed < body.delay + 7600 || Math.abs(body.vx) + Math.abs(body.vy) > .45) moving = true;
    });

    if (moving) frame = requestAnimationFrame(animate);
  }

  elements.forEach((element, index) => {
    const line = lines[index];
    const on = () => line?.classList.add("is-active");
    const off = () => line?.classList.remove("is-active");
    element.addEventListener("mouseenter", on);
    element.addEventListener("mouseleave", off);
    element.addEventListener("focus", on);
    element.addEventListener("blur", off);
  });

  rebuild();
  if (!reduced) frame = requestAnimationFrame(animate);

  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cancelAnimationFrame(frame);
      last = 0;
      started = performance.now();
      rebuild();
      if (!reduced) frame = requestAnimationFrame(animate);
    }, 120);
  }, { passive: true });
})();
