(() => {
  const scene = document.querySelector('.hero-space');
  const video = scene?.querySelector('.hero-video');
  const source = video?.querySelector('source[data-src]');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const saveData = window.navigator?.connection?.saveData === true;

  if (!scene || !video || !source || reducedMotion || saveData || typeof window.IntersectionObserver !== 'function') return;

  let loaded = false;
  const observer = new window.IntersectionObserver(([entry]) => {
    if (entry?.target !== scene) return;

    if (entry.isIntersecting) {
      scene.classList.add('hero-motion-active');
      if (!loaded) {
        const url = source.dataset.src;
        if (url) {
          source.setAttribute('src', url);
          video.load();
          loaded = true;
        }
      }
      if (loaded) video.play()?.catch(() => {});
      return;
    }

    scene.classList.remove('hero-motion-active');
    video.pause();
  }, { threshold: 0, rootMargin: '80px 0px' });

  observer.observe(scene);
  window.addEventListener('pagehide', () => {
    observer.disconnect();
    scene.classList.remove('hero-motion-active');
    video.pause();
  }, { once: true });
})();
