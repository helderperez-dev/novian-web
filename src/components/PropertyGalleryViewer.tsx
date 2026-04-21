"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

interface PropertyGalleryViewerProps {
  coverImage: string;
  images: string[];
}

export default function PropertyGalleryViewer({ coverImage, images }: PropertyGalleryViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const imgRef = useRef<HTMLImageElement>(null);

  const allImages = [coverImage, ...(images || [])].filter(Boolean);

  const openGallery = (index: number) => {
    setCurrentIndex(index);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsOpen(true);
  };

  const closeGallery = () => {
    setIsOpen(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale === 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") closeGallery();
      if (e.key === "ArrowLeft") setCurrentIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
      if (e.key === "ArrowRight") setCurrentIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, allImages.length]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <>
      {/* Grid View */}
      <div className="grid grid-cols-2 gap-4">
        <div 
          className="col-span-2 h-64 rounded-2xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer group relative"
          onClick={() => openGallery(0)}
        >
          <img src={coverImage} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" alt="Capa" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 text-white font-semibold tracking-wider text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm transition-opacity">Ver Foto</span>
          </div>
        </div>
        
        {images && images.length > 0 ? (
          <>
            <div 
              className="h-40 rounded-2xl bg-white/5 border border-white/10 overflow-hidden cursor-pointer group relative"
              onClick={() => openGallery(1)}
            >
              <img src={images[0]} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" alt="Galeria 1" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-white font-semibold tracking-wider text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm transition-opacity">Ver Foto</span>
              </div>
            </div>
            
            {images.length > 1 ? (
              <div 
                className="h-40 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden flex items-center justify-center cursor-pointer group"
                onClick={() => openGallery(2)}
              >
                <img src={images[1]} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-30 group-hover:scale-105 transition-all duration-500" alt="Galeria 2" />
                <span className="relative z-20 font-semibold tracking-wider text-sm text-white bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                  + {images.length - 1} Fotos
                </span>
              </div>
            ) : (
              <div 
                className="h-40 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden flex items-center justify-center cursor-pointer group"
                onClick={() => openGallery(0)}
              >
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors z-10" />
                <span className="relative z-20 font-semibold tracking-wider text-sm text-white">Ver Galeria</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="h-40 rounded-2xl bg-white/5 border border-white/10"></div>
            <div className="h-40 rounded-2xl bg-white/5 border border-white/10 relative overflow-hidden flex items-center justify-center cursor-pointer group">
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors z-10" />
                <span className="relative z-20 font-semibold tracking-wider text-sm text-white">Ver Galeria</span>
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center"
          onClick={closeGallery}
        >
          {/* Top Bar */}
          <div className="absolute top-0 inset-x-0 p-6 flex items-center justify-between z-50 bg-gradient-to-b from-black/80 to-transparent">
            <span className="text-white/70 font-medium tracking-widest text-sm">
              {currentIndex + 1} / {allImages.length}
            </span>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full p-1 mr-4">
                <button 
                  onClick={handleZoomOut}
                  className="text-white/70 hover:text-white hover:bg-white/20 p-2 rounded-full transition-colors"
                  title="Diminuir Zoom"
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
                >
                  <ZoomIn size={20} />
                </button>
              </div>
              
              <button 
                onClick={closeGallery}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Prev Button */}
          <button 
            onClick={prevImage}
            className="absolute left-6 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 p-3 rounded-full backdrop-blur-md transition-all z-10 hidden md:block"
          >
            <ChevronLeft size={32} />
          </button>

          {/* Main Image Container */}
          <div 
            className={`w-full h-full flex items-center justify-center overflow-hidden relative ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`} 
            onClick={(e) => {
              if (scale === 1) e.stopPropagation();
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
                transition: isDragging ? 'none' : 'transform 0.2s ease-out'
              }}
            >
              <img 
                ref={imgRef}
                src={allImages[currentIndex]} 
                alt={`Imagem ${currentIndex + 1}`} 
                className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl pointer-events-none select-none"
                draggable={false}
              />
            </div>
          </div>

          {/* Next Button */}
          <button 
            onClick={nextImage}
            className="absolute right-6 text-white/50 hover:text-white bg-black/50 hover:bg-black/80 p-3 rounded-full backdrop-blur-md transition-all z-10 hidden md:block"
          >
            <ChevronRight size={32} />
          </button>

          {/* Mobile swipe hint / tap areas */}
          <div className="absolute inset-y-0 left-0 w-1/3 md:hidden z-0" onClick={prevImage} />
          <div className="absolute inset-y-0 right-0 w-1/3 md:hidden z-0" onClick={nextImage} />
        </div>
      )}
    </>
  );
}