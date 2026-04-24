"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface PropertyLightboxProps {
  images: string[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  captions?: Record<string, string>;
}

export default function PropertyLightbox({
  images,
  initialIndex,
  isOpen,
  onClose,
  captions,
}: PropertyLightboxProps) {
  const allImages = useMemo(() => images.filter(Boolean), [images]);
  const boundedInitialIndex = Math.min(Math.max(initialIndex, 0), Math.max(allImages.length - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(boundedInitialIndex);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      if (allImages.length <= 1) {
        return;
      }

      if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
      }

      if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [allImages.length, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || allImages.length === 0) {
    return null;
  }

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  };

  const goToIndex = (index: number) => {
    resetView();
    setCurrentIndex(index);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    goToIndex(currentIndex === 0 ? allImages.length - 1 : currentIndex - 1);
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    goToIndex(currentIndex === allImages.length - 1 ? 0 : currentIndex + 1);
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => {
      const nextScale = Math.max(prev - 0.5, 1);
      if (nextScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return nextScale;
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      resetView();
    } else {
      setScale(2);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale === 1) {
      return;
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) {
      return;
    }

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const currentImage = allImages[currentIndex];
  const caption = captions?.[currentImage]?.trim();

  return (
    <div
      className="fixed inset-0 z-120 flex items-center justify-center bg-black/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <div className="absolute top-0 inset-x-0 z-50 flex items-center justify-between bg-linear-to-b from-black/80 to-transparent p-6">
        <span className="text-white/70 font-medium tracking-widest text-sm">
          {currentIndex + 1} / {allImages.length}
        </span>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full p-1 mr-4">
            <button
              onClick={handleZoomOut}
              className="text-white/70 hover:text-white hover:bg-white/20 p-2 rounded-full transition-colors"
              title="Diminuir Zoom"
              type="button"
            >
              <ZoomOut size={20} />
            </button>
            <span className="text-white/70 text-xs font-medium min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="text-white/70 hover:text-white hover:bg-white/20 p-2 rounded-full transition-colors"
              title="Aumentar Zoom"
              type="button"
            >
              <ZoomIn size={20} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition-colors"
            type="button"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {allImages.length > 1 ? (
        <button
          onClick={prevImage}
          className="absolute left-6 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 p-3 rounded-full backdrop-blur-md transition-all z-10 hidden md:block"
          type="button"
        >
          <ChevronLeft size={32} />
        </button>
      ) : null}

      <div
        className={`w-full h-full flex items-center justify-center overflow-hidden relative ${scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        onClick={(e) => {
          if (scale === 1) {
            e.stopPropagation();
          }
        }}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="transition-transform duration-200 ease-out origin-center"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
        >
          <img
            ref={imgRef}
            src={currentImage}
            alt={`Imagem ${currentIndex + 1}`}
            className="max-w-[95vw] max-h-[88vh] object-contain rounded-lg shadow-2xl pointer-events-none select-none"
            draggable={false}
          />
        </div>

        {caption ? (
          <div className="absolute bottom-6 left-1/2 w-[min(680px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/55 px-5 py-4 backdrop-blur-md">
            <p className="text-sm leading-relaxed text-white/85">{caption}</p>
          </div>
        ) : null}
      </div>

      {allImages.length > 1 ? (
        <button
          onClick={nextImage}
          className="absolute right-6 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 p-3 rounded-full backdrop-blur-md transition-all z-10 hidden md:block"
          type="button"
        >
          <ChevronRight size={32} />
        </button>
      ) : null}

      {allImages.length > 1 ? (
        <>
          <div className="absolute inset-y-0 left-0 w-1/3 md:hidden z-0" onClick={() => prevImage()} />
          <div className="absolute inset-y-0 right-0 w-1/3 md:hidden z-0" onClick={() => nextImage()} />

          <div className="absolute bottom-4 inset-x-0 z-20 px-4">
            <div className="mx-auto flex max-w-3xl items-center gap-3 overflow-x-auto rounded-full bg-black/45 px-3 py-2 backdrop-blur-md">
              {allImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToIndex(index);
                  }}
                  className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border transition ${
                    currentIndex === index ? "border-white/80 opacity-100" : "border-white/10 opacity-60 hover:opacity-90"
                  }`}
                >
                  <img src={image} alt={`Miniatura ${index + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
