"use client";

import { useState, useEffect } from "react";
import PropertyLightbox from "@/components/PropertyLightbox";

interface PropertyGalleryViewerProps {
  coverImage: string;
  images: string[];
}

export default function PropertyGalleryViewer({ coverImage, images }: PropertyGalleryViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const allImages = [coverImage, ...(images || [])].filter(Boolean);

  const openGallery = (index: number) => {
    setCurrentIndex(index);
    setIsOpen(true);
  };

  const closeGallery = () => {
    setIsOpen(false);
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

      <PropertyLightbox
        key={isOpen ? `${allImages[currentIndex]}-${currentIndex}` : "property-lightbox-closed"}
        images={allImages}
        initialIndex={currentIndex}
        isOpen={isOpen}
        onClose={closeGallery}
      />
    </>
  );
}
