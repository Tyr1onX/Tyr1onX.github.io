(() => {
  const library = Array.isArray(window.TYR1ONX_MUSIC_LIBRARY)
    ? window.TYR1ONX_MUSIC_LIBRARY
    : [];

  window.TYR1ONX_MUSIC = library
    .filter((track) => track.featured)
    .sort((a, b) => (a.featuredOrder || 0) - (b.featuredOrder || 0));
})();
