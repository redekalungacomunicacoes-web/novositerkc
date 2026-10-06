import { ImgHTMLAttributes, useEffect, useRef, useState } from 'react';
import { cn } from '@/app/components/ui/utils';

type FetchPriority = 'high' | 'low' | 'auto';

interface RKCProgressiveImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'loading' | 'fetchPriority'> {
  src: string;
  alt: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: FetchPriority;
  wrapperClassName?: string;
  imageClassName?: string;
  preloadMargin?: string;
  showPlaceholder?: boolean;
}

export function RKCProgressiveImage({
  src,
  alt,
  loading = 'lazy',
  fetchPriority = 'low',
  wrapperClassName,
  imageClassName,
  preloadMargin = '1200px 0px',
  showPlaceholder = true,
  onLoad,
  onError,
  ...imgProps
}: RKCProgressiveImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(loading === 'eager');
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setShouldLoad(loading === 'eager');
  }, [src, loading]);

  useEffect(() => {
    if (loading === 'eager' || shouldLoad) return;
    const element = wrapperRef.current;
    if (!element) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: preloadMargin, threshold: 0.01 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [loading, preloadMargin, shouldLoad]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative overflow-hidden bg-[#F1EEE8]',
        !loaded && !failed && 'min-h-[4rem]',
        wrapperClassName,
      )}
    >
      {showPlaceholder && !loaded && !failed ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#E9E4DA] via-[#F6F2EB] to-[#E5DED1] animate-pulse"
        />
      ) : null}

      {shouldLoad && src ? (
        <img
          {...imgProps}
          src={src}
          alt={alt}
          loading={loading === 'eager' ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={fetchPriority}
          onLoad={(event) => {
            const image = event.currentTarget;
            const reveal = () => setLoaded(true);
            if (typeof image.decode === 'function') {
              image.decode().catch(() => undefined).finally(reveal);
            } else {
              reveal();
            }
            onLoad?.(event);
          }}
          onError={(event) => {
            setFailed(true);
            onError?.(event);
          }}
          className={cn(
            'relative z-[1] block transition-opacity duration-300 ease-out',
            loaded ? 'opacity-100' : 'opacity-0',
            imageClassName,
          )}
        />
      ) : null}
    </div>
  );
}
