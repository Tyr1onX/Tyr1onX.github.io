(() => {
  const sourceStyleId = 'projects-source-showcase-style';
  if (!document.getElementById(sourceStyleId)) {
    const link = document.createElement('link');
    link.id = sourceStyleId;
    link.rel = 'stylesheet';
    link.href = './projects-source-showcase.css?v=1';
    document.head.append(link);
  }

  const sourceViews = [
    ['widget', '桌面 Widget'],
    ['week', '完整周课表'],
    ['course', '编辑课程'],
    ['times', '作息设置'],
    ['import', '截图导入复核'],
  ];

  const galleries = document.querySelectorAll('[data-work-gallery]');

  for (const gallery of galleries) {
    const stage = gallery.querySelector('.work-gallery-stage');
    const nav = gallery.querySelector('.work-gallery-nav');
    if (!stage || !nav) continue;

    // Every gallery frame is rendered from the desktop-course-widget source markup and
    // source CSS. No captured desktop/browser image is used here.
    stage.replaceChildren(...sourceViews.map(([view, label], index) => {
      const slide = document.createElement('div');
      slide.className = `work-gallery-slide work-gallery-slide--source${index === 0 ? ' is-active' : ''}`;
      slide.dataset.gallerySlide = '';
      slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');

      const frame = document.createElement('iframe');
      frame.className = 'work-gallery-frame';
      frame.src = `./keke-source-showcase.html?view=${encodeURIComponent(view)}`;
      frame.title = `课刻${label}源码演示`;
      frame.loading = index === 0 ? 'eager' : 'lazy';
      frame.tabIndex = -1;
      frame.setAttribute('aria-hidden', 'true');
      slide.append(frame);
      return slide;
    }));

    nav.replaceChildren(...sourceViews.map(([, label], index) => {
      const dot = document.createElement('button');
      dot.className = `work-gallery-dot${index === 0 ? ' is-active' : ''}`;
      dot.type = 'button';
      dot.dataset.galleryDot = '';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      dot.setAttribute('aria-label', label);
      dot.tabIndex = index === 0 ? 0 : -1;
      return dot;
    }));

    const slides = Array.from(gallery.querySelectorAll('[data-gallery-slide]'));
    const dots = Array.from(gallery.querySelectorAll('[data-gallery-dot]'));
    let activeIndex = 0;
    let pointerStartX = null;
    let pointerStartY = null;

    const show = (index, { focusDot = false } = {}) => {
      activeIndex = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        const active = slideIndex === activeIndex;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        if ('inert' in slide) slide.inert = !active;
      });
      dots.forEach((dot, dotIndex) => {
        const active = dotIndex === activeIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
        dot.tabIndex = active ? 0 : -1;
      });
      if (focusDot) dots[activeIndex]?.focus({ preventScroll: true });
    };

    dots.forEach((dot, index) => {
      dot.addEventListener('click', () => show(index));
      dot.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault(); show(activeIndex + 1, { focusDot: true });
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault(); show(activeIndex - 1, { focusDot: true });
        } else if (event.key === 'Home') {
          event.preventDefault(); show(0, { focusDot: true });
        } else if (event.key === 'End') {
          event.preventDefault(); show(slides.length - 1, { focusDot: true });
        }
      });
    });

    gallery.addEventListener('keydown', (event) => {
      if (event.target.closest('[data-gallery-dot]')) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); show(activeIndex + 1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); show(activeIndex - 1); }
    });
    gallery.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointerStartX = event.clientX; pointerStartY = event.clientY;
    });
    gallery.addEventListener('pointerup', (event) => {
      if (pointerStartX === null || pointerStartY === null) return;
      const deltaX = event.clientX - pointerStartX;
      const deltaY = event.clientY - pointerStartY;
      pointerStartX = null; pointerStartY = null;
      if (Math.abs(deltaX) < 44 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      show(activeIndex + (deltaX < 0 ? 1 : -1));
    });
    gallery.addEventListener('pointercancel', () => { pointerStartX = null; pointerStartY = null; });
    show(0);
  }
})();
