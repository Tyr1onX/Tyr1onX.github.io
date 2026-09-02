(() => {
  const root = document.querySelector("[data-music-player]");
  const tracks = Array.isArray(window.TYR1ONX_MUSIC) ? window.TYR1ONX_MUSIC : [];
  let previews = {};
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
  const previewRow = document.createElement("div");
  previewRow.className = "music-controls";
  previewRow.style.marginTop = "18px";
  previewRow.hidden = true;

  const previewToggle = document.createElement("button");
  previewToggle.type = "button";
  previewToggle.className = "music-control";
  previewToggle.setAttribute("aria-pressed", "false");
  previewToggle.hidden = true;
  const previewLabel = document.createElement("span");
  previewLabel.className = "music-control-label";
  previewLabel.textContent = "试听片段";
  previewToggle.appendChild(previewLabel);

  const listenLink = document.createElement("a");
  listenLink.className = "music-control";
  listenLink.target = "_blank";
  listenLink.rel = "noreferrer noopener";
  listenLink.hidden = true;
  const listenLabel = document.createElement("span");
  listenLabel.className = "music-control-label";
  listenLabel.textContent = "Apple Music ↗";
  listenLink.appendChild(listenLabel);

  const previewStatus = document.createElement("span");
  previewStatus.className = "visually-hidden";
  previewStatus.setAttribute("aria-live", "polite");

  previewRow.append(previewToggle, listenLink, previewStatus);
  note.insertAdjacentElement("afterend", previewRow);

  const audio = new Audio();
  audio.preload = "none";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;
  let timer = 0;

  const pad = (value) => String(value).padStart(2, "0");
  const valueOrDash = (value) => value || "—";

  const setPreviewPlaying = (playing) => {
    previewToggle.setAttribute("aria-pressed", playing ? "true" : "false");
    previewLabel.textContent = playing ? "暂停试听" : "试听片段";
    root.classList.toggle("is-preview-playing", playing);
  };

  const stopPreview = (clearSource = false) => {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {}
    if (clearSource) {
      audio.removeAttribute("src");
      audio.load();
    }
    setPreviewPlaying(false);
  };

  const configurePreview = (track) => {
    const generated = previews[track.id] || {};
    const previewUrl = generated.previewUrl || "";
    const listenUrl = generated.listenUrl || track.listenUrl || "";

    stopPreview(true);
    previewStatus.textContent = "";

    if (previewUrl) {
      audio.src = previewUrl;
      audio.load();
      previewToggle.hidden = false;
    } else {
      previewToggle.hidden = true;
    }

    if (listenUrl) {
      listenLink.href = listenUrl;
      listenLink.hidden = false;
    } else {
      listenLink.removeAttribute("href");
      listenLink.hidden = true;
    }

    previewRow.hidden = !previewUrl && !listenUrl;
  };

  const preloadCover = (track) => {
    if (!track || !track.cover) return;
    const image = new Image();
    image.src = track.cover;
  };

  const renderCover = (track, index) => {
    coverIndex.textContent = pad(index + 1);
    if (!track.cover) {
      coverImage.removeAttribute("src");
      coverImage.alt = "";
      coverImage.hidden = true;
      placeholder.hidden = false;
      vinylLabelImage.removeAttribute("src");
      return;
    }

    const fallback = track.fallbackCover || "";
    let usingFallback = false;
    const useFallback = () => {
      if (usingFallback || !fallback) return;
      usingFallback = true;
      coverImage.src = fallback;
      vinylLabelImage.src = fallback;
    };

    coverImage.onerror = useFallback;
    vinylLabelImage.onerror = useFallback;
    coverImage.src = track.cover;
    coverImage.alt = `${track.title || `收藏位 ${pad(index + 1)}`} 的专辑封面`;
    coverImage.hidden = false;
    placeholder.hidden = true;
    vinylLabelImage.src = track.cover;
  };

  tracks.forEach((track, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "music-index-button";
    button.textContent = pad(index + 1);
    button.setAttribute("aria-label", `切换到 ${track.title || `收藏位 ${pad(index + 1)}`}`);
    button.addEventListener("click", () => switchTo(index));
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
    note.hidden = !track.note;

    renderCover(track, index);
    configurePreview(track);
    preloadCover(tracks[(index + 1) % tracks.length]);

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
    stopPreview(true);
    stage.classList.add("is-switching");
    const delay = reduceMotion.matches ? 40 : 180;
    timer = window.setTimeout(() => completeSwitch(normalized), delay);
  }

  prev.addEventListener("click", () => switchTo(current - 1));
  next.addEventListener("click", () => switchTo(current + 1));

  previewToggle.addEventListener("click", async () => {
    if (!audio.src) return;
    previewStatus.textContent = "";
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      previewStatus.textContent = "当前试听暂不可用。";
      setPreviewPlaying(false);
    }
  });

  audio.addEventListener("play", () => setPreviewPlaying(true));
  audio.addEventListener("pause", () => setPreviewPlaying(false));
  audio.addEventListener("ended", () => setPreviewPlaying(false));
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    previewStatus.textContent = "当前试听暂不可用。";
    setPreviewPlaying(false);
  });

  fetch("./assets/music/generated-previews.json", { cache: "no-store" })
    .then((response) => response.ok ? response.json() : {})
    .then((catalog) => {
      previews = catalog && typeof catalog === "object" ? catalog : {};
      configurePreview(tracks[current]);
    })
    .catch(() => {});

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
