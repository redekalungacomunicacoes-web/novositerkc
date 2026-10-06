const enhancedImages = new WeakSet<HTMLImageElement>();

function connectionIsConstrained() {
  const connection = (navigator as any).connection;
  return Boolean(connection?.saveData || /(^|-)2g$/.test(String(connection?.effectiveType || '')));
}

function markLoaded(image: HTMLImageElement) {
  image.classList.remove('rkc-native-image--loading');
  image.classList.add('rkc-native-image--loaded');
}

function markFailed(image: HTMLImageElement) {
  image.classList.remove('rkc-native-image--loading');
  image.classList.add('rkc-native-image--failed');
}

export function installImageLoadingEnhancements() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;

  const preloadMargin = connectionIsConstrained() ? '320px 0px' : '1400px 0px';
  const preloadObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const image = entry.target as HTMLImageElement;
            if (image.loading === 'lazy') image.loading = 'eager';
            if (image.fetchPriority !== 'high') image.fetchPriority = 'low';
            preloadObserver.unobserve(image);
          }
        },
        { rootMargin: preloadMargin, threshold: 0.01 },
      )
    : null;

  const enhance = (image: HTMLImageElement) => {
    if (image.dataset.rkcProgressive === 'true' || enhancedImages.has(image)) return;
    enhancedImages.add(image);
    image.classList.add('rkc-native-image');

    if (image.complete && image.naturalWidth > 0) {
      markLoaded(image);
    } else {
      image.classList.add('rkc-native-image--loading');
      image.addEventListener('load', () => markLoaded(image), { once: true });
      image.addEventListener('error', () => markFailed(image), { once: true });
    }

    if (image.loading === 'lazy') preloadObserver?.observe(image);
  };

  document.querySelectorAll<HTMLImageElement>('img').forEach(enhance);

  const mutationObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node instanceof HTMLImageElement) enhance(node);
        node.querySelectorAll?.('img').forEach((image) => enhance(image as HTMLImageElement));
      }
    }
  });

  mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

  return () => {
    mutationObserver.disconnect();
    preloadObserver?.disconnect();
  };
}
