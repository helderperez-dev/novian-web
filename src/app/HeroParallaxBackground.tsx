"use client";

import { useEffect, useState } from "react";

type HeroParallaxBackgroundProps = {
  imageUrl: string;
  className?: string;
};

export default function HeroParallaxBackground({ imageUrl, className = "" }: HeroParallaxBackgroundProps) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      return undefined;
    }

    let frame = 0;

    const updateOffset = () => {
      frame = 0;
      const nextOffset = Math.min(window.scrollY * 0.18, 96);
      setOffset(nextOffset);
    };

    const onScroll = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(updateOffset);
    };

    updateOffset();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div
      className={`absolute inset-x-0 -inset-y-10 bg-cover bg-center bg-no-repeat will-change-transform ${className}`}
      style={{
        backgroundImage: `url(${imageUrl})`,
        transform: `translate3d(0, ${offset}px, 0) scale(1.08)`,
      }}
    />
  );
}
