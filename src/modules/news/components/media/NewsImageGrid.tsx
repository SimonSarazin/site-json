import { useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";
import type { NewsImageItem } from "../../types";

interface NewsImageGridProps {
  images: NewsImageItem[];
}

export function NewsImageGrid({ images }: NewsImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const imageCount = images.length;

  const getGridClass = () => {
    if (imageCount === 1) return "grid-cols-1";
    if (imageCount === 2) return "grid-cols-2";
    if (imageCount === 3) return "grid-cols-3";
    if (imageCount === 4) return "grid-cols-2";
    return "grid-cols-3";
  };

  const getImageClass = (index: number) => {
    if (imageCount === 1) return "col-span-1 h-[200px] w-full";
    if (imageCount === 2) return "col-span-1 h-[200px]";
    if (imageCount === 3 && index === 0) return "col-span-3 h-[200px]";
    if (imageCount === 4) return "col-span-1 h-[200px]";
    if (imageCount === 5 && index < 2) return "col-span-1 h-[200px]";
    return "col-span-1 h-[200px]";
  };

  return (
    <>
      <div className="px-6 pb-4">
        <div className={`grid ${getGridClass()} gap-2`}>
          {images.slice(0, 6).map((img: NewsImageItem, imgIndex: number) => {
            const imagePath = img.imagePath || img.imageThumbPath;

            return (
              <div
                key={img.id || img._id?._str || imgIndex}
                className={`${getImageClass(imgIndex)} bg-muted object-center rounded-lg overflow-hidden group cursor-pointer relative`}
                onClick={() => imagePath && setSelectedImage(imagePath)}
              >
                {imagePath ? (
                  <>
                    <img
                      src={imagePath}
                      alt={img.name || `Image ${imgIndex + 1}`}
                      className="w-full h-full object-cover group-hover:scale-110 group-hover:brightness-90 transition-all duration-300"
                    />
                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                    {imgIndex === 5 && images.length > 6 && (
                      <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center backdrop-blur-sm">
                        <span className="text-white text-3xl font-bold">
                          +{images.length - 6}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                    <ImageIcon className="w-12 h-12" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <ModalContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent">
          <div className="relative">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-full p-2"
              aria-label="Fermer"
            >
              <X className="w-8 h-8" />
            </button>
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Image agrandie"
                className="max-w-full max-h-[95vh] object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}