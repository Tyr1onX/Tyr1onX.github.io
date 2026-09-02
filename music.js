(() => {
  const root = document.querySelector("[data-music-player]");
  const featuredTracks = Array.isArray(window.TYR1ONX_MUSIC) ? window.TYR1ONX_MUSIC : [];
  const libraryTracks = Array.isArray(window.TYR1ONX_MUSIC_LIBRARY) ? window.TYR1ONX_MUSIC_LIBRARY : featuredTracks;
  const archiveRoot = document.querySelector("[data-music-archive]");
  const archiveGrid = archiveRoot?.querySelector("[data-music-grid]") || null;
  const archiveCount = archiveRoot?.querySelector("[data-archive-count]") || null;
  let previews = {};
  let previewCatalogReady = false;
  if (!root || !featuredTracks.length) return;

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
  const turntablePlay = root.querySelector("[data-turntable-play]");
  const turntablePlayLabel = root.querySelector("[data-turntable-play-label]");

  const previewRow = document.createElement("div");
  previewRow.className = "music-controls music-preview-links";
  previewRow.hidden = true;

  const listenLink = document.createElement("a");
  listenLink.className = "music-control";
  listenLink.target = "_blank";
  listenLink.rel = "noreferrer noopener";
  listenLink.hidden = true;
  const listenLabel = document.createElement("span");
  listenLabel.className = "music-control-label";
  listenLabel.textContent = "Listen ↗";
  listenLink.appendChild(listenLabel);

  const previewStatus = document.createElement("span");
  previewStatus.className = "visually-hidden";
  previewStatus.setAttribute("aria-live", "polite");

  previewRow.append(listenLink, previewStatus);
  note.insertAdjacentElement("afterend", previewRow);

  const audio = new Audio();
  audio.preload = "none";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const mediaSession = "mediaSession" in navigator ? navigator.mediaSession : null;
  const trackById = new Map(libraryTracks.map((track) => [track.id, track]));
  const libraryIndexById = new Map(libraryTracks.map((track, index) => [track.id, index]));
  const featuredIndexById = new Map(featuredTracks.map((track, index) => [track.id, index]));
  let activeTrack = featuredTracks[0];
  let activeCollection = featuredTracks;
  let activeCollectionIndex = 0;
  let timer = 0;
  let archiveActiveButton = null;
  const archiveButtonById = new Map();
  const coverPreloads = new Set();

  const pad = (value, width = 2) => String(value).padStart(width, "0");
  const valueOrDash = (value) => value || "—";

  const setMediaPlaybackState = (state) => {
    if (!mediaSession) return;
    try {
      mediaSession.playbackState = state;
    } catch {}
  };

  const setPlaybackState = (state) => {
    root.dataset.playbackState = state;
    const playable = state === "paused" || state === "playing";
    const playing = state === "playing";

    turntablePlay.disabled = !playable;
    const label = state === "loading"
      ? "试听载入中"
      : state === "unavailable"
        ? "当前歌曲暂无试听"
        : state === "switching"
          ? "正在切换歌曲"
          : playing
            ? "暂停试听"
            : "开始试听";
    turntablePlay.setAttribute("aria-label", label);
    turntablePlay.setAttribute("aria-pressed", playing ? "true" : "false");
    turntablePlay.title = label;
    turntablePlayLabel.textContent = label;

    setMediaPlaybackState(playing ? "playing" : state === "paused" ? "paused" : "none");
  };

  const updateMediaSession = (track) => {
    if (!mediaSession || !("MediaMetadata" in window)) return;
    const artwork = [];
    if (track.cover) {
      artwork.push({ src: new URL(track.cover, document.baseURI).href });
    }
    if (track.fallbackCover) {
      artwork.push({ src: new URL(track.fallbackCover, document.baseURI).href, type: "image/webp" });
    }
    try {
      mediaSession.metadata = new MediaMetadata({
        title: track.title || "未命名",
        artist: track.artist || "Tyr1onX Music Archive",
        album: track.album || "",
        artwork
      });
    } catch {}
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
  };

  const playCurrentPreview = async () => {
    if (!audio.getAttribute("src")) {
      previewStatus.textContent = "当前歌曲暂无试听。";
      setPlaybackState("unavailable");
      return;
    }
    previewStatus.textContent = "";
    try {
      await audio.play();
    } catch {
      previewStatus.textContent = "当前试听暂不可用。";
      setPlaybackState("paused");
    }
  };

  const configurePreview = (track) => {
    const generated = previews[track.id] || {};
    const previewUrl = track.previewUrl || generated.previewUrl || "";
    const listenUrl = track.listenUrl || generated.listenUrl || "";

    stopPreview(true);
    previewStatus.textContent = "";

    if (listenUrl) {
      listenLink.href = listenUrl;
      listenLink.hidden = false;
    } else {
      listenLink.removeAttribute("href");
      listenLink.hidden = true;
    }
    previewRow.hidden = !listenUrl;

    if (!previewCatalogReady && !track.previewUrl) {
      setPlaybackState("loading");
      return;
    }

    if (!previewUrl) {
      setPlaybackState("unavailable");
      return;
    }

    audio.src = previewUrl;
    audio.load();
    setPlaybackState("paused");
  };

  const preloadCover = (track) => {
    if (!track || !track.cover || coverPreloads.has(track.cover)) return;
    coverPreloads.add(track.cover);
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = "low";
    image.src = track.cover;
  };

  coverImage.fetchPriority = "high";
  vinylLabelImage.fetchPriority = "low";

  const renderCover = (track, index, width = 3) => {
    coverIndex.textContent = pad(index + 1, width);
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
    coverImage.alt = `${track.title || `收藏位 ${index + 1}`} 的专辑封面`;
    coverImage.hidden = false;
    placeholder.hidden = true;
    vinylLabelImage.src = track.cover;
  };

  const updateArchiveSelection = (track) => {
    if (!archiveGrid) return;
    if (archiveActiveButton) {
      archiveActiveButton.removeAttribute("aria-current");
      archiveActiveButton = null;
    }
    const button = archiveButtonById.get(track.id);
    if (button) {
      button.setAttribute("aria-current", "true");
      archiveActiveButton = button;
    }
  };

  const render = (track, announce = false) => {
    activeTrack = track;
    const libraryIndex = libraryIndexById.get(track.id) ?? 0;
    root.style.setProperty("--music-accent", track.accent || "#8a6f5b");

    const featuredIndex = featuredIndexById.get(track.id);
    position.textContent = featuredIndex === undefined
      ? `ARCHIVE ${pad(libraryIndex + 1, 3)} / ${pad(libraryTracks.length, 3)}`
      : `${pad(featuredIndex + 1)} / ${pad(featuredTracks.length)}`;
    title.textContent = track.title || "未命名";
    artist.textContent = valueOrDash(track.artist);
    album.textContent = valueOrDash(track.album);
    year.textContent = valueOrDash(track.year);
    note.textContent = track.note || "";
    note.hidden = !track.note;

    renderCover(
      track,
      featuredIndex === undefined ? libraryIndex : featuredIndex,
      featuredIndex === undefined ? 3 : 2
    );
    configurePreview(track);
    updateMediaSession(track);
    updateArchiveSelection(track);

    const previousTrack = activeCollection[(activeCollectionIndex - 1 + activeCollection.length) % activeCollection.length];
    const nextTrack = activeCollection[(activeCollectionIndex + 1) % activeCollection.length];
    preloadCover(previousTrack);
    preloadCover(nextTrack);

    nav.querySelectorAll(".music-index-button").forEach((button) => {
      button.setAttribute("aria-current", button.dataset.trackId === track.id ? "true" : "false");
    });

    if (announce) live.textContent = `已切换到 ${track.title || `收藏位 ${libraryIndex + 1}`}`;
  };

  const completeSwitch = (track, collection, index) => {
    activeCollection = collection;
    activeCollectionIndex = index;
    render(track, true);
    stage.classList.remove("is-switching");
  };

  const switchTo = (track, collection = activeCollection, index = collection.indexOf(track)) => {
    if (!track || stage.classList.contains("is-switching")) return;
    if (track.id === activeTrack.id) {
      activeCollection = collection;
      activeCollectionIndex = Math.max(0, index);
      updateArchiveSelection(track);
      return;
    }
    clearTimeout(timer);
    stopPreview(true);
    setPlaybackState("switching");
    stage.classList.add("is-switching");
    const delay = reduceMotion.matches ? 40 : 180;
    timer = window.setTimeout(() => completeSwitch(track, collection, Math.max(0, index)), delay);
  };

  featuredTracks.forEach((track, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "music-index-button";
    button.dataset.trackId = track.id;
    button.textContent = pad(index + 1);
    button.setAttribute("aria-label", `切换到 ${track.title}`);
    button.addEventListener("click", () => switchTo(track, featuredTracks, index));
    nav.appendChild(button);
  });

  const createArchiveItem = (track, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "music-archive-item";
    button.dataset.trackId = track.id;
    button.setAttribute("aria-label", track.artist ? `${track.title} — ${track.artist}` : track.title);

    const artwork = document.createElement("span");
    artwork.className = "music-archive-artwork";

    if (track.cover) {
      const image = document.createElement("img");
      image.src = track.cover;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.width = 600;
      image.height = 600;
      artwork.appendChild(image);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "music-archive-placeholder";
      fallback.setAttribute("aria-hidden", "true");
      const brand = document.createElement("span");
      brand.textContent = "Tyr1onX";
      const slot = document.createElement("strong");
      slot.textContent = `ARCHIVE ${pad(index + 1, 3)}`;
      fallback.append(brand, slot);
      artwork.appendChild(fallback);
    }

    const overlay = document.createElement("span");
    overlay.className = "music-archive-overlay";
    overlay.setAttribute("aria-hidden", "true");
    const itemTitle = document.createElement("strong");
    itemTitle.textContent = track.title;
    const itemArtist = document.createElement("span");
    itemArtist.textContent = track.artist || "Tyr1onX Music Archive";
    overlay.append(itemTitle, itemArtist);

    button.append(artwork, overlay);
    archiveButtonById.set(track.id, button);
    return button;
  };

  if (archiveGrid) {
    const fragment = document.createDocumentFragment();
    libraryTracks.forEach((track, index) => fragment.appendChild(createArchiveItem(track, index)));
    archiveGrid.appendChild(fragment);
    archiveGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-track-id]");
      if (!(button instanceof HTMLButtonElement) || !archiveGrid.contains(button)) return;
      const track = trackById.get(button.dataset.trackId);
      if (!track) return;
      const index = libraryIndexById.get(track.id) ?? 0;
      switchTo(track, libraryTracks, index);
    });
    if (archiveCount) archiveCount.textContent = String(libraryTracks.length);
  }

  turntablePlay.addEventListener("click", () => {
    if (root.dataset.playbackState === "playing") {
      audio.pause();
      return;
    }
    if (root.dataset.playbackState === "paused") {
      playCurrentPreview();
    }
  });

  prev.addEventListener("click", () => {
    const index = (activeCollectionIndex - 1 + activeCollection.length) % activeCollection.length;
    switchTo(activeCollection[index], activeCollection, index);
  });
  next.addEventListener("click", () => {
    const index = (activeCollectionIndex + 1) % activeCollection.length;
    switchTo(activeCollection[index], activeCollection, index);
  });

  audio.addEventListener("play", () => {
    previewStatus.textContent = "";
    setPlaybackState("playing");
  });
  audio.addEventListener("pause", () => {
    if (root.dataset.playbackState !== "switching") setPlaybackState("paused");
  });
  audio.addEventListener("ended", () => {
    try {
      audio.currentTime = 0;
    } catch {}
    setPlaybackState("paused");
  });
  audio.addEventListener("error", () => {
    if (!audio.getAttribute("src")) return;
    previewStatus.textContent = "当前试听暂不可用。";
    setPlaybackState("unavailable");
  });

  if (mediaSession) {
    const registerAction = (action, handler) => {
      try {
        mediaSession.setActionHandler(action, handler);
      } catch {}
    };
    registerAction("play", playCurrentPreview);
    registerAction("pause", () => audio.pause());
    registerAction("stop", () => stopPreview(false));
    registerAction("previoustrack", () => prev.click());
    registerAction("nexttrack", () => next.click());
  }

  fetch("./assets/music/generated-previews.json?v=2")
    .then((response) => response.ok ? response.json() : {})
    .then((catalog) => {
      previews = catalog && typeof catalog === "object" ? catalog : {};
      previewCatalogReady = true;
      configurePreview(activeTrack);
    })
    .catch(() => {
      previewCatalogReady = true;
      configurePreview(activeTrack);
    });

  const syncVisualVisibility = () => {
    root.dataset.visualPaused = document.hidden ? "true" : "false";
  };
  document.addEventListener("visibilitychange", syncVisualVisibility);
  syncVisualVisibility();

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      || target.closest(".music-archive-grid")
    )) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev.click();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next.click();
    }
  });

  setPlaybackState("loading");
  render(activeTrack);
})();
