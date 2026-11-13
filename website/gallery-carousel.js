(() => {
  const carousel = document.querySelector('[data-feature-carousel]');
  if (!carousel) return;

  const image = carousel.querySelector('[data-carousel-image]');
  const title = carousel.querySelector('[data-carousel-title]');
  const description = carousel.querySelector('[data-carousel-description]');
  const counter = carousel.querySelector('[data-carousel-count]');
  const announcement = carousel.querySelector('[data-carousel-announcement]');
  const selectors = [...carousel.querySelectorAll('[data-carousel-slide]')];
  const slides = [
    {
      title: 'Spectrum Community',
      source: 'spectrum-community.png',
      alt: 'Spectrum community with forums, chat lobbies, saved threads and the RSI Enhanced sidebar',
      description: 'Browse forums, chat lobbies and saved threads from a themed Spectrum workspace.',
    },
    {
      title: 'Funding Stats',
      source: 'funding-stats.png',
      alt: 'Funding Stats page with live totals, a timeline graph and expandable advanced funding history',
      description: 'Track live totals and open detailed history charts when you want more.',
    },
    {
      title: 'Roadmap Release View',
      source: 'roadmap-release-view.png',
      alt: 'Roadmap Release View with release columns, status labels, categories and a watched card',
      description: 'Scan release columns, milestone status and watched cards in one view.',
    },
    {
      title: 'Dev Tracker',
      source: 'dev-tracker.png',
      alt: 'Dev Tracker showing developer posts, reply context and responses',
      description: 'Read developer posts and replies in a clearer, grouped layout.',
    },
    {
      title: 'Pledge Store: Ships',
      source: 'pledge-store-ships.png',
      alt: 'Ship pledge page with gallery, pledge information, price, Add to Cart and included pledge items',
      description: 'Review ship artwork, key specs, pledge contents and cart controls together.',
    },
    {
      title: 'Pledge Store: Gear',
      source: 'pledge-store-gear.png',
      alt: 'Gear pledge page with gallery, item details, price, Add to Cart and included contents',
      description: 'Browse gear bundles, included items and pledge details in a themed layout.',
    },
    {
      title: 'Organizations',
      source: 'organizations.png',
      alt: 'Organization profile with banner, membership, description and mission details',
      description: 'Explore organization membership, activity and profile details at a glance.',
    },
    {
      title: 'Comm-Link',
      source: 'comm-link.png',
      alt: 'Comm-Link page with article cards and channel, series, type and sorting filters',
      description: 'Browse official communications with channel, series and type filters.',
    },
    {
      title: 'My Hangar',
      source: 'my-hangar.png',
      alt: 'My Hangar with the RSI Enhanced sidebar, pledge cards and Hangar search and filter controls',
      description: 'Search, filter and organize pledge items across your Hangar pages.',
    },
    {
      title: 'Personal Dashboard',
      source: 'personal-dashboard.png',
      alt: 'Personal dashboard with Hangar, Spectrum saves, Roadmap, Funding Stats and Concierge cards',
      description: 'See Hangar, saved discussions and tracked updates together in one view.',
    },
  ];
  if (!image || !title || !description || !counter || selectors.length !== slides.length) return;
  const assetBase = carousel.dataset.carouselAssetBase || 'assets/';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let activeIndex = 0;
  let timer = null;
  let imageLoadHandler = null;
  let hovered = false;
  let focused = false;

  const stopAutoplay = () => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const autoplayAllowed = () => !hovered && !focused && !document.hidden && !reducedMotion.matches;

  const scheduleAutoplay = () => {
    stopAutoplay();
    if (!autoplayAllowed()) return;
    timer = window.setTimeout(() => {
      timer = null;
      selectSlide(activeIndex + 1, false);
      scheduleAutoplay();
    }, 7000);
  };

  const selectSlide = (requestedIndex, announce) => {
    activeIndex = (requestedIndex + slides.length) % slides.length;
    const slide = slides[activeIndex];
    const imageSource = `${assetBase}${slide.source}`;
    if (image.getAttribute('src') !== imageSource) {
      if (imageLoadHandler) {
        image.removeEventListener('load', imageLoadHandler);
        image.removeEventListener('error', imageLoadHandler);
        imageLoadHandler = null;
      }
      if (!reducedMotion.matches) {
        image.classList.add('is-changing');
        imageLoadHandler = () => {
          image.classList.remove('is-changing');
          image.removeEventListener('load', imageLoadHandler);
          image.removeEventListener('error', imageLoadHandler);
          imageLoadHandler = null;
        };
        image.addEventListener('load', imageLoadHandler);
        image.addEventListener('error', imageLoadHandler);
      } else {
        image.classList.remove('is-changing');
      }
      image.setAttribute('src', imageSource);
    }
    image.setAttribute('alt', slide.alt);
    title.textContent = slide.title;
    description.textContent = slide.description;
    counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    selectors.forEach((selector, index) => {
      selector.setAttribute('aria-label', `Show ${slides[index].title}`);
      if (index === activeIndex) selector.setAttribute('aria-current', 'true');
      else selector.removeAttribute('aria-current');
    });
    if (announce && announcement) announcement.textContent = `Slide ${activeIndex + 1} of ${slides.length}: ${slide.title}`;
  };

  carousel.addEventListener('click', (event) => {
    const control = event.target.closest?.('[data-carousel-action], [data-carousel-slide]');
    if (!control || !carousel.contains(control)) return;

    if (control.dataset.carouselAction === 'next') selectSlide(activeIndex + 1, true);
    else if (control.dataset.carouselAction === 'previous') selectSlide(activeIndex - 1, true);
    else if (control.dataset.carouselSlide !== undefined) selectSlide(Number(control.dataset.carouselSlide), true);
    else return;

    scheduleAutoplay();
  });

  carousel.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    hovered = true;
    scheduleAutoplay();
  });
  carousel.addEventListener('pointerleave', () => {
    hovered = false;
    scheduleAutoplay();
  });
  carousel.addEventListener('focusin', () => {
    focused = true;
    scheduleAutoplay();
  });
  carousel.addEventListener('focusout', (event) => {
    if (carousel.contains(event.relatedTarget)) return;
    focused = false;
    scheduleAutoplay();
  });
  document.addEventListener('visibilitychange', scheduleAutoplay);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches && imageLoadHandler) {
      image.removeEventListener('load', imageLoadHandler);
      image.removeEventListener('error', imageLoadHandler);
      imageLoadHandler = null;
      image.classList.remove('is-changing');
    }
    scheduleAutoplay();
  });

  selectSlide(activeIndex, false);
  scheduleAutoplay();
})();

