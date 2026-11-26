(() => {
  const sections = [...document.querySelectorAll('[data-guide-chapter]')];
  const links = [...document.querySelectorAll('[data-chapter-link]')];
  if (!sections.length || !links.length) return;

  const reveal = (section) => section.classList.add('is-visible');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  if (reducedMotion) sections.forEach(reveal);
  if (typeof window.IntersectionObserver !== 'function') {
    sections.forEach(reveal);
    return;
  }

  const container = document.querySelector('.guide-chapters');
  if (!reducedMotion) container?.classList.add('guide-reveal-ready');
  const visibleRatios = new Map(sections.map((section) => [section.id, 0]));
  const observer = new window.IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) reveal(entry.target);
      visibleRatios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
    }

    const activeId = [...visibleRatios.entries()]
      .filter(([, ratio]) => ratio > 0)
      .sort((left, right) => right[1] - left[1])[0]?.[0];

    for (const link of links) {
      if (link.hash === `#${activeId}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }, { rootMargin: '-16% 0px -38% 0px', threshold: [0, 0.12, 0.35, 0.6] });

  for (const section of sections) observer.observe(section);
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    sections.forEach(reveal);
  }, { once: true });
})();
