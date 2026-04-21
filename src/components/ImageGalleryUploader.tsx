"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, UploadCloud, GripVertical, Star, Loader2 } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface ImageGalleryUploaderProps {
  initialImages: string[];
  initialCover?: string;
  onChange: (images: string[], coverImage: string) => void;
}

export default function ImageGalleryUploader({ initialImages, initialCover, onChange }: ImageGalleryUploaderProps) {
  const getInitialCombinedImages = () => {
    const allImages = new Set<string>();
    if (initialCover) {
      allImages.add(initialCover);
    }
    if (initialImages && initialImages.length > 0) {
      initialImages.forEach(img => allImages.add(img));
    }
    return Array.from(allImages);
  };

  const initialCombined = getInitialCombinedImages();
  
  const [images, setImages] = useState<string[]>(initialCombined);
  const [coverImage, setCoverImage] = useState<string>(initialCover || initialCombined[0] || "");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerChange = (updatedImages: string[], updatedCover: string) => {
    const galleryImages = updatedImages.filter(img => img !== updatedCover);
    onChange(galleryImages, updatedCover);
  };

  const uploadToSupabase = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `properties/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('assets')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file to Supabase:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsUploading(true);
      try {
        const files = Array.from(e.target.files);
        const newImages = await Promise.all(files.map(uploadToSupabase));
        
        const updatedImages = [...images, ...newImages];
        const newCover = coverImage || newImages[0];
        
        setImages(updatedImages);
        setCoverImage(newCover);
        triggerChange(updatedImages, newCover);
      } catch (err) {
        console.error("Failed to upload images:", err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeImage = (indexToRemove: number) => {
    const imgToRemove = images[indexToRemove];
    const updatedImages = images.filter((_, index) => index !== indexToRemove);
    let updatedCover = coverImage;
    
    if (imgToRemove === coverImage) {
      updatedCover = updatedImages[0] || "";
    }

    setImages(updatedImages);
    setCoverImage(updatedCover);
    triggerChange(updatedImages, updatedCover);
  };

  const setAsCover = (imgUrl: string) => {
    setCoverImage(imgUrl);
    triggerChange(images, imgUrl);
  };

  // Drag and Drop for sorting
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    // Slightly transparent while dragging
    e.currentTarget.style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedIndex(null);
    e.currentTarget.style.opacity = "1";
  };

  const handleDragOverItem = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);

    setImages(newImages);
    setDraggedIndex(index); // Update dragged index so it follows the mouse
    triggerChange(newImages, coverImage);
  };

  // Drag and Drop for uploading
  const handleDropzoneDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDropzoneDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDropzoneDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsUploading(true);
      try {
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith("image/"));
        const newImages = await Promise.all(files.map(uploadToSupabase));
        
        if (newImages.length > 0) {
          const updatedImages = [...images, ...newImages];
          const newCover = coverImage || newImages[0];
          setImages(updatedImages);
          setCoverImage(newCover);
          triggerChange(updatedImages, newCover);
        }
      } catch (err) {
        console.error("Failed to upload images via drag and drop:", err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Dropzone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-colors ${
          isUploading 
            ? "border-novian-accent/50 bg-novian-accent/5 cursor-wait"
            : isDraggingOver
            ? "border-novian-accent bg-novian-accent/10 cursor-pointer"
            : "border-novian-muted/50 hover:border-novian-accent/50 bg-novian-primary/30 cursor-pointer"
        }`}
        onDragOver={isUploading ? undefined : handleDropzoneDragOver}
        onDragLeave={isUploading ? undefined : handleDropzoneDragLeave}
        onDrop={isUploading ? undefined : handleDropzoneDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="w-8 h-8 mb-3 text-novian-accent animate-spin" />
        ) : (
          <UploadCloud className={`w-8 h-8 mb-3 ${isDraggingOver ? "text-novian-accent" : "text-novian-text/50"}`} />
        )}
        <p className="text-sm font-medium text-novian-text">
          {isUploading ? "Enviando imagens..." : "Arraste imagens aqui ou clique para fazer upload"}
        </p>
        <p className="text-xs text-novian-text/50 mt-1">
          Suporta JPG, PNG, WEBP
        </p>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>

      {/* Sortable Gallery Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img, index) => (
            <div
              key={`${img}-${index}`}
              className="relative group rounded-lg overflow-hidden border border-novian-muted/50 bg-novian-surface aspect-video cursor-move"
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOverItem(e, index)}
            >
              <img
                src={img}
                alt={`Galeria ${index + 1}`}
                className="w-full h-full object-cover pointer-events-none"
              />
              
              {/* Overlay controls */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex justify-between w-full">
                  <div className="bg-black/50 p-1.5 rounded-md backdrop-blur-sm">
                    <GripVertical className="w-4 h-4 text-white" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="bg-red-500/80 hover:bg-red-600 p-1.5 rounded-md backdrop-blur-sm transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                
                <div className="flex justify-center w-full">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAsCover(img);
                    }}
                    className={`w-full py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                      coverImage === img 
                        ? 'bg-novian-accent text-novian-primary' 
                        : 'bg-black/60 text-white hover:bg-novian-accent hover:text-novian-primary backdrop-blur-md border border-white/20'
                    }`}
                  >
                    <Star className="w-3 h-3" fill={coverImage === img ? "currentColor" : "none"} />
                    {coverImage === img ? 'Capa Principal' : 'Definir Capa'}
                  </button>
                </div>
              </div>
              
              {/* Order badge */}
              {coverImage !== img && (
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white pointer-events-none">
                  {index + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
