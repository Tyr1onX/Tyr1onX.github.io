(() => {
  const root = document.querySelector("[data-games-list]");
  const games = Array.isArray(window.TYR1ONX_GAMES) ? window.TYR1ONX_GAMES : [];
  if (!root) return;

  if (!games.length) {
    root.innerHTML = '<p class="games-empty">还没有记录游戏。</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  games.forEach((game) => {
    const article = document.createElement("article");
    article.className = "game-entry";
    article.dataset.game = game.slug;

    const header = document.createElement("header");
    header.className = "game-entry-header";

    const title = document.createElement("h2");
    title.textContent = game.name;
    const meta = document.createElement("div");
    meta.className = "game-entry-meta";
    const platform = document.createElement("span");
    platform.textContent = game.platform;
    meta.appendChild(platform);
    if (game.status) {
      const status = document.createElement("span");
      status.textContent = game.status;
      meta.appendChild(status);
    }
    header.append(title, meta);

    const figure = document.createElement("figure");
    figure.className = "game-figure";
    const image = document.createElement("img");
    image.src = game.image;
    image.alt = game.alt;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 1600;
    image.height = 900;
    figure.appendChild(image);

    article.append(header, figure);
    if (game.note) {
      const note = document.createElement("p");
      note.className = "game-note";
      note.textContent = game.note;
      article.appendChild(note);
    }
    fragment.appendChild(article);
  });
  root.appendChild(fragment);
})();
