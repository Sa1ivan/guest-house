"use client";

import Image from "next/image";
import { Expand } from "lucide-react";
import { useRef, useState } from "react";
import type { Photo } from "@/lib/catalog";
import { PhotoViewer } from "@/components/photo-viewer";
import type { PhotoViewerHandle } from "@/components/photo-viewer";

export function RoomGallery({ photos }: { photos: Photo[] }) {
  const [selected, setSelected] = useState(0);
  const viewer = useRef<PhotoViewerHandle>(null);
  const photo = photos[selected];

  function open(index: number) {
    setSelected(index);
    viewer.current?.open(index);
  }

  return (
    <section className="gallery" aria-label="Фотографии номера">
      <button type="button" className="gallery-stage" aria-haspopup="dialog"
        aria-label={"Открыть фото. " + photo.alt} onClick={() => open(selected)}>
        <Image key={photo.src} src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} fetchPriority="high" />
        <span className="photo-expand"><Expand size={20} aria-hidden="true" /></span>
      </button>
      <div className="gallery-thumbnails" aria-label="Выбрать фотографию">
        {photos.map((item, index) =>
          <button type="button" key={item.src} aria-current={index === selected ? "true" : undefined}
            aria-label={"Открыть фото. " + item.alt} aria-haspopup="dialog" onClick={() => open(index)}>
            <Image src={item.src} alt="" width={item.width} height={item.height} />
          </button>
        )}
      </div>
      <PhotoViewer photos={photos} ref={viewer} onPhotoChange={setSelected} />
    </section>
  );
}
