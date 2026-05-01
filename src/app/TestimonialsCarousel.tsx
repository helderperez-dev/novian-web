"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatar?: string;
};

type TestimonialsCarouselProps = {
  testimonials: Testimonial[];
};

function getSlidesPerView(width: number) {
  if (width >= 1280) {
    return 3;
  }

  if (width >= 768) {
    return 2;
  }

  return 1;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

function chunkTestimonials(testimonials: Testimonial[], chunkSize: number) {
  const slides: Testimonial[][] = [];

  for (let index = 0; index < testimonials.length; index += chunkSize) {
    slides.push(testimonials.slice(index, index + chunkSize));
  }

  return slides;
}

export default function TestimonialsCarousel({ testimonials }: TestimonialsCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [slidesPerView, setSlidesPerView] = useState(3);
  const [currentPage, setCurrentPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncViewport = () => {
      setSlidesPerView(getSlidesPerView(window.innerWidth));
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const nextPage = Math.round(container.scrollLeft / Math.max(container.clientWidth, 1));
      setCurrentPage(nextPage);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  const slides = useMemo(
    () => chunkTestimonials(testimonials, slidesPerView),
    [slidesPerView, testimonials],
  );
  const totalPages = Math.max(1, slides.length);
  const activePage = Math.min(currentPage, totalPages - 1);
  const getWrappedPage = (page: number) => {
    if (totalPages <= 0) {
      return 0;
    }

    return (page + totalPages) % totalPages;
  };

  useEffect(() => {
    if (totalPages <= 1 || isPaused) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      const nextPage = activePage >= totalPages - 1 ? 0 : activePage + 1;
      const container = containerRef.current;

      if (!container) {
        return;
      }

      container.scrollTo({
        left: nextPage * container.clientWidth,
        behavior: "smooth",
      });
      setCurrentPage(nextPage);
    }, 4800);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activePage, isPaused, totalPages]);

  const scrollToPage = (page: number) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const nextPage = getWrappedPage(page);
    container.scrollTo({
      left: nextPage * container.clientWidth,
      behavior: "smooth",
    });
    setCurrentPage(nextPage);
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const nextPage = Math.round(container.scrollLeft / Math.max(container.clientWidth, 1));
    setCurrentPage(Math.max(0, Math.min(nextPage, totalPages - 1)));
  };

  return (
    <div className="mt-12 grid grid-cols-[auto_1fr_auto] items-center gap-4 lg:gap-6">
      <div className="hidden lg:flex">
        <button
          type="button"
          onClick={() => scrollToPage(activePage - 1)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-novian-muted/70 bg-white/80 text-novian-text/48 transition hover:text-novian-accent"
          aria-label="Depoimentos anteriores"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      <div className="min-w-0">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((slide, slideIndex) => (
            <div key={slideIndex} className="min-w-0 snap-start basis-full shrink-0">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {slide.map((item) => (
                  <article
                    key={item.name}
                    className="flex h-full min-w-0 flex-col rounded-[24px] border border-novian-muted/65 bg-white/82 p-6"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(95,120,80,0.12)] text-[#5E7F49]">
                      <Quote size={18} strokeWidth={2.2} />
                    </div>

                    <p className="mt-5 flex-1 text-[1.02rem] leading-8 text-novian-text/72">
                      {item.quote}
                    </p>

                    <div className="mt-7 flex items-center gap-3">
                      {item.avatar ? (
                        <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/80">
                          <Image
                            src={item.avatar}
                            alt={item.name}
                            fill
                            className="object-cover"
                            sizes="48px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#d9ccba,#f3ede3)] text-sm font-semibold text-novian-accent">
                          {getInitials(item.name)}
                        </div>
                      )}
                      <div>
                        <p className="text-[15px] font-semibold text-novian-text">{item.name}</p>
                        <p className="text-sm text-novian-text/52">{item.role}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => scrollToPage(index)}
              aria-label={`Ir para página ${index + 1} dos depoimentos`}
              className={index === activePage ? "h-1.5 w-5 rounded-full bg-novian-accent/75" : "h-1.5 w-1.5 rounded-full bg-novian-accent/24 transition"}
            />
          ))}
        </div>
      </div>

      <div className="hidden lg:flex">
        <button
          type="button"
          onClick={() => scrollToPage(activePage + 1)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-novian-muted/70 bg-white/80 text-novian-text/48 transition hover:text-novian-accent"
          aria-label="Próximos depoimentos"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
