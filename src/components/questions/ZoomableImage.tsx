import * as React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type Props = {
  src: string;
  alt?: string;
  thumbnailClassName?: string;
};

export function ZoomableImage({ src, alt = 'Image', thumbnailClassName }: Props) {
  const [open, setOpen] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  const handleImageError = () => {
    console.error('Image failed to load:', src);
    setImageError(true);
  };

  if (imageError) {
    return (
      <div className="inline-block px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
        <div className="flex items-center gap-2">
          <span>❌</span>
          <div>
            <div className="font-medium">Image non trouvée: {src}</div>
            <div className="text-xs text-red-500">URL: {src}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        className="block cursor-zoom-in"
        onClick={() => setOpen(true)}
        aria-label="Agrandir l'image"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className={
            thumbnailClassName ||
            'max-h-40 w-auto rounded-md border object-cover shadow-sm'
          }
          onError={handleImageError}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl p-2 sm:p-4">
          <div className="w-full h-full flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[85vh] w-auto object-contain rounded-md"
              onError={handleImageError}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ZoomableImage;
