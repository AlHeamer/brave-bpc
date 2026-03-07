import { useEffect, useRef, useState } from "react";

export interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  rootMargin?: string;
}

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

type ObserverBucket = {
  observer: IntersectionObserver;
  callbacks: WeakMap<Element, () => void>;
};

const observerBuckets = new Map<string, ObserverBucket>();

function getObserverBucket(rootMargin: string): ObserverBucket | null {
  if (typeof window === "undefined") return null;
  if (!("IntersectionObserver" in window)) return null;

  const existing = observerBuckets.get(rootMargin);
  if (existing) return existing;

  const callbacks = new WeakMap<Element, () => void>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        if (cb) cb();
        observer.unobserve(entry.target);
      }
    },
    { rootMargin, threshold: 0.01 },
  );

  const bucket = { observer, callbacks };
  observerBuckets.set(rootMargin, bucket);
  return bucket;
}

export default function LazyImage({
  src,
  alt,
  className,
  width,
  height,
  rootMargin = "300px",
}: LazyImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;

    const node = imgRef.current;
    if (!node) return;

    const bucket = getObserverBucket(rootMargin);
    if (!bucket) {
      setShouldLoad(true);
      return;
    }

    bucket.callbacks.set(node, () => setShouldLoad(true));
    bucket.observer.observe(node);

    return () => {
      bucket.callbacks.delete(node);
      bucket.observer.unobserve(node);
    };
  }, [rootMargin, shouldLoad]);

  return (
    <img
      ref={imgRef}
      alt={hasError ? "" : alt}
      className={className}
      decoding="async"
      loading="lazy"
      height={height}
      width={width}
      src={shouldLoad && !hasError ? src : TRANSPARENT_PIXEL}
      onError={() => setHasError(true)}
    />
  );
}
