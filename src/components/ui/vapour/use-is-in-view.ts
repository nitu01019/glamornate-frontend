import React, { useEffect, useState } from 'react';

export function useIsInView(ref: React.RefObject<HTMLElement>) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '50px' },
    );

    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [ref]);

  return isInView;
}
