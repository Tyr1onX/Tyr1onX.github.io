(() => {
  const root = document.querySelector("[data-music-player]");
  const tracks = Array.isArray(window.TYR1ONX_MUSIC) ? window.TYR1ONX_MUSIC : [];
  if (!root || !tracks.length) return;

  const stage = root.querySelector("[data-music-stage]");
  const coverImage = root.querySelector("[data-music-cover]");
  const placeholder = root.querySelector("[data-cover-placeholder]");
  const coverIndex = root.querySelector("[data-cover-index]");
  const vinylLabelImage = root.querySelector("[data-vinyl-label]");
  const position = root.querySelector("[data-music-position]");
  const title = root.querySelector("[data-music-title]");
  const artist = root.querySelector("[data-music-artist]");
  const album = root.querySelector("[data-music-album]");
  const year = root.querySelector("[data-music-year]");
  const note = root.querySelector("[data-music-note]");
  const nav = root.querySelector("[data-music-index]");
  const live = root.querySelector("[data-music-live]");
  const prev = root.querySelector("[data-music-prev]");
  const next = root.querySelector("[data-music-next]");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;
  let timer = 0;

  const pad = (value) => String(value).padStart(2, "0");
  const valueOrDash = (value) => value || "—";

  tracks.forEach((track) => {
    if (!track.cover) return;
    const image = new Image();
    image.src = track.cover;
  });

  tracks.forEach((track, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "music-index-button";
    button.textContent = pad(index + 1);
    button.setAttribute("aria-label", `切换到收藏位 ${pad(index + 1)}`);
    button.addEventListener("click", () => switchTo(index, 1));
    nav.appendChild(button);
  });

  const render = (index, announce = false) => {
    const track = tracks[index];
    current = index;
    root.style.setProperty("--music-accent", track.accent || "#8a6f5b");
    position.textContent = `${pad(index + 1)} / ${pad(tracks.length)}`;
    title.textContent = track.title || "未命名";
    artist.textContent = valueOrDash(track.artist);
    album.textContent = valueOrDash(track.album);
    year.textContent = valueOrDash(track.year);
    note.textContent = track.note || "";
    coverIndex.textContent = pad(index + 1);

    if (track.cover) {
      const coverAlt = `${track.title || `Collection Slot ${pad(index + 1)}`} 的本地 demo 专辑封面`;
      coverImage.src = track.cover;
      coverImage.alt = coverAlt;
      coverImage.hidden = false;
      placeholder.hidden = true;
      vinylLabelImage.src = track.cover;
    } else {
      coverImage.removeAttribute("src");
      coverImage.alt = "";
      coverImage.hidden = true;
      placeholder.hidden = false;
      vinylLabelImage.removeAttribute("src");
    }

    nav.querySelectorAll(".music-index-button").forEach((button, buttonIndex) => {
      button.setAttribute("aria-current", buttonIndex === index ? "true" : "false");
    });

    if (announce) live.textContent = `已切换到 ${track.title || `收藏位 ${pad(index + 1)}`}`;
  };

  const completeSwitch = (index) => {
    render(index, true);
    stage.classList.remove("is-switching");
  };

  function switchTo(index) {
    const normalized = (index + tracks.length) % tracks.length;
    if (normalized === current || stage.classList.contains("is-switching")) return;
    clearTimeout(timer);
    stage.classList.add("is-switching");
    const delay = reduceMotion.matches ? 40 : 180;
    timer = window.setTimeout(() => completeSwitch(normalized), delay);
  }

  prev.addEventListener("click", () => switchTo(current - 1));
  next.addEventListener("click", () => switchTo(current + 1));

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      switchTo(current - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      switchTo(current + 1);
    }
  });

  render(0);
})();
