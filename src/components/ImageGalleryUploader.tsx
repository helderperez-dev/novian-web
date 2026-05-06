"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, UploadCloud, GripVertical, Star, Loader2, Expand, FileText } from "lucide-react";
import Image from "next/image";
import PropertyLightbox from "@/components/PropertyLightbox";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

interface ImageGalleryUploaderProps {
  initialImages: string[];
  initialCover?: string;
  initialDescriptions?: Record<string, string>;
  onChange: (images: string[], coverImage: string, descriptions: Record<string, string>) => void;
}

export default function ImageGalleryUploader({
  initialImages,
  initialCover,
  initialDescriptions = {},
  onChange,
}: ImageGalleryUploaderProps) {
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
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>(initialDescriptions);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [descriptionModalImage, setDescriptionModalImage] = useState<string | null>(null);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const allImages = new Set<string>();
    if (initialCover) {
      allImages.add(initialCover);
    }
    if (initialImages && initialImages.length > 0) {
      initialImages.forEach((img) => allImages.add(img));
    }

    const nextImages = Array.from(allImages);
    setImages(nextImages);
    setCoverImage(initialCover || nextImages[0] || "");
    setDescriptions(initialDescriptions);
    setUploadErrorMessage(null);
    setPreviewImage(null);
    setDescriptionModalImage(null);
    setDescriptionDraft("");
  }, [initialImages, initialCover, initialDescriptions]);

  const getCleanDescriptions = (updatedImages: string[], nextDescriptions: Record<string, string>) => {
    return updatedImages.reduce<Record<string, string>>((acc, imageUrl) => {
      const description = nextDescriptions[imageUrl]?.trim();
      if (description) {
        acc[imageUrl] = description;
      }
      return acc;
    }, {});
  };

  const triggerChange = (updatedImages: string[], updatedCover: string, nextDescriptions: Record<string, string>) => {
    const galleryImages = updatedImages.filter(img => img !== updatedCover);
    onChange(galleryImages, updatedCover, getCleanDescriptions(updatedImages, nextDescriptions));
  };

  const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-");

  const uploadToSupabase = async (file: File): Promise<string> => {
    const supabase = createBrowserSupabaseClient();
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${sanitizeFileName(file.name)}${fileExt ? "" : ".bin"}`;
    const filePath = `properties/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading file to Supabase:", uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage.from("assets").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadErrorMessage(null);
    try {
      const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) {
        throw new Error("Selecione arquivos de imagem validos.");
      }

      const newImages = await Promise.all(files.map(uploadToSupabase));

      const updatedImages = [...images, ...newImages];
      const newCover = coverImage || newImages[0];
      const nextDescriptions = { ...descriptions };

      setImages(updatedImages);
      setCoverImage(newCover);
      setDescriptions(nextDescriptions);
      triggerChange(updatedImages, newCover, nextDescriptions);
    } catch (err) {
      console.error("Failed to upload images:", err);
      setUploadErrorMessage(err instanceof Error ? err.message : "Nao foi possivel enviar as imagens.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeImage = (indexToRemove: number) => {
    const imgToRemove = images[indexToRemove];
    const updatedImages = images.filter((_, index) => index !== indexToRemove);
    let updatedCover = coverImage;
    
    if (imgToRemove === coverImage) {
      updatedCover = updatedImages[0] || "";
    }
    const nextDescriptions = { ...descriptions };
    delete nextDescriptions[imgToRemove];
    if (descriptionModalImage === imgToRemove) {
      setDescriptionModalImage(null);
      setDescriptionDraft("");
    }
    if (previewImage === imgToRemove) {
      setPreviewImage(null);
    }

    setImages(updatedImages);
    setCoverImage(updatedCover);
    setDescriptions(nextDescriptions);
    triggerChange(updatedImages, updatedCover, nextDescriptions);
  };

  const setAsCover = (imgUrl: string) => {
    setCoverImage(imgUrl);
    triggerChange(images, imgUrl, descriptions);
  };

  const updateDescription = (imgUrl: string, value: string) => {
    const nextDescriptions = {
      ...descriptions,
      [imgUrl]: value,
    };

    if (!value.trim()) {
      delete nextDescriptions[imgUrl];
    }

    setDescriptions(nextDescriptions);
    triggerChange(images, coverImage, nextDescriptions);
  };

  const openDescriptionModal = (imgUrl: string) => {
    setDescriptionModalImage(imgUrl);
    setDescriptionDraft(descriptions[imgUrl] || "");
  };

  const closeDescriptionModal = () => {
    setDescriptionModalImage(null);
    setDescriptionDraft("");
  };

  const saveDescriptionModal = () => {
    if (!descriptionModalImage) {
      return;
    }

    updateDescription(descriptionModalImage, descriptionDraft);
    closeDescriptionModal();
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
    triggerChange(newImages, coverImage, descriptions);
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
      setUploadErrorMessage(null);
      try {
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith("image/"));
        if (files.length === 0) {
          throw new Error("Arraste apenas arquivos de imagem.");
        }
        const newImages = await Promise.all(files.map(uploadToSupabase));
        
        if (newImages.length > 0) {
          const updatedImages = [...images, ...newImages];
          const newCover = coverImage || newImages[0];
          const nextDescriptions = { ...descriptions };
          setImages(updatedImages);
          setCoverImage(newCover);
          setDescriptions(nextDescriptions);
          triggerChange(updatedImages, newCover, nextDescriptions);
        }
      } catch (err) {
        console.error("Failed to upload images via drag and drop:", err);
        setUploadErrorMessage(err instanceof Error ? err.message : "Nao foi possivel enviar as imagens.");
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

      {uploadErrorMessage ? (
        <div className="rounded-xl border border-red-300/35 bg-red-500/8 px-4 py-3 text-sm text-red-200">
          {uploadErrorMessage}
        </div>
      ) : null}

      {/* Sortable Gallery Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {images.map((img, index) => (
            <div
              key={`${img}-${index}`}
              className="rounded-xl border border-novian-muted/50 bg-novian-surface overflow-hidden"
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOverItem(e, index)}
            >
              <div
                className="relative group aspect-video cursor-pointer"
                onClick={() => setPreviewImage(img)}
              >
                <Image
                  src={img}
                  alt={descriptions[img]?.trim() || `Galeria ${index + 1}`}
                  fill
                  sizes="(max-width: 768px) 50vw, 33vw"
                  className="object-cover"
                />
              
                {/* Overlay controls */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex justify-between w-full">
                    <div className="bg-black/50 p-1.5 rounded-md backdrop-blur-sm">
                      <GripVertical className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDescriptionModal(img);
                        }}
                        className="bg-black/60 hover:bg-black/80 p-1.5 rounded-md backdrop-blur-sm transition-colors"
                      >
                        <FileText className="w-4 h-4 text-white" />
                      </button>
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
                  </div>
                
                  <div className="flex justify-center w-full gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage(img);
                      }}
                      className="bg-black/60 text-white hover:bg-black/80 backdrop-blur-md border border-white/20 rounded px-3 py-1.5 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Expand className="w-3 h-3" />
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAsCover(img);
                      }}
                      className={`flex-1 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
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

            </div>
          ))}
        </div>
      )}

      <PropertyLightbox
        key={previewImage ? `${previewImage}-${images.length}` : "uploader-lightbox-closed"}
        images={images}
        initialIndex={previewImage ? Math.max(images.indexOf(previewImage), 0) : 0}
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        captions={descriptions}
      />

      {descriptionModalImage ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={closeDescriptionModal}
        >
          <div
            className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-novian-surface/95 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDescriptionModal}
              className="absolute right-4 top-4 rounded-full bg-black/30 p-2 text-white transition hover:bg-black/50"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="space-y-4">
              <div>
                <p className="text-lg font-semibold text-novian-text">Descricao da foto</p>
                <p className="mt-1 text-sm text-novian-text/55">
                  Adicione um texto opcional para contextualizar esta imagem.
                </p>
              </div>

              <div className="relative aspect-video overflow-hidden rounded-xl border border-novian-muted/30 bg-black/30">
                <Image
                  src={descriptionModalImage}
                  alt="Imagem selecionada"
                  fill
                  sizes="(max-width: 768px) 100vw, 640px"
                  className="object-cover"
                />
              </div>

              <textarea
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                placeholder="Opcional. Ex.: Sala com pe-direito duplo e muita luz natural."
                rows={4}
                className="w-full resize-none rounded-xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none transition focus:border-novian-accent/40"
                autoFocus
              />

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDescriptionDraft("")}
                  className="rounded-full border border-novian-muted/35 px-3 py-2 text-sm font-medium text-novian-text/65 transition hover:border-novian-accent/35 hover:text-novian-text"
                >
                  Limpar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeDescriptionModal}
                    className="rounded-full border border-novian-muted/35 px-4 py-2 text-sm font-medium text-novian-text/65 transition hover:border-novian-accent/35 hover:text-novian-text"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveDescriptionModal}
                    className="rounded-full bg-novian-accent px-4 py-2 text-sm font-semibold text-novian-primary transition hover:bg-white"
                  >
                    Salvar descricao
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
