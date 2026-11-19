"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";
import type { Photo } from "@/lib/catalog";

export type PhotoViewerHandle = { open: (index: number) => void };

type ViewerProps = {
  photos: Photo[];
  ref: Ref<PhotoViewerHandle>;
  onPhotoChange?: (index: number) => void;
};

export function PhotoViewer({ photos, ref, onPhotoChange }: ViewerProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const cursor = useRef(0);
  const [visible, setVisible] = useState(false);
  const [selected, setSelected] = useState(0);
  const photo = photos[selected];

  useImperativeHandle(ref, () => ({
    open(index) {
      const panel = dialog.current;
      if (!panel || panel.open) return;
      cursor.current = index;
      setSelected(index);
      panel.showModal();
      setVisible(true);
    },
  }), []);

  useLayoutEffect(() => {
    const strip = track.current;
    if (!visible || !strip) return;
    const position = () => strip.scrollTo({ left: strip.clientWidth * cursor.current, behavior: "instant" });
    position();
    closeButton.current?.focus({ preventScroll: true });
    const resize = new ResizeObserver(position);
    resize.observe(strip);
    return () => resize.disconnect();
  }, [visible]);

  function syncPhoto() {
    const strip = track.current;
    if (!strip?.clientWidth) return;
    const index = Math.min(photos.length - 1, Math.max(0, Math.round(strip.scrollLeft / strip.clientWidth)));
    if (index === cursor.current) return;
    cursor.current = index;
    setSelected(index);
    onPhotoChange?.(index);
  }

  function change(amount: number) {
    const strip = track.current;
    const index = Math.min(photos.length - 1, Math.max(0, cursor.current + amount));
    if (!strip || index === cursor.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left: strip.clientWidth * index, behavior: reducedMotion ? "instant" : "smooth" });
  }

  return (
    <dialog className="photo-viewer" aria-label="Фотографии на весь экран" ref={dialog}
      onClose={() => setVisible(false)} onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        change(event.key === "ArrowLeft" ? -1 : 1);
      }}>
      {visible && <>
        <header className="viewer-top">
          {photos.length > 1 && <span aria-live="polite">{selected + 1} из {photos.length}</span>}
          <button ref={closeButton} type="button" className="viewer-button" aria-label="Закрыть фотографии"
            onClick={() => dialog.current?.close()}>
            <X size={23} aria-hidden="true" />
          </button>
        </header>
        <div className="viewer-stage">
          <div className="viewer-track" ref={track} onScroll={syncPhoto}>
            {photos.map((item, index) => (
              <figure className="viewer-slide" key={item.src} aria-hidden={index !== selected}>
                <Image src={item.src} alt={item.alt} width={item.width} height={item.height}
                  loading={index === selected ? "eager" : "lazy"} draggable={false} />
              </figure>
            ))}
          </div>
          {photos.length > 1 && (
            <div className="viewer-controls" style={{ "--photo-ratio": photo.width / photo.height } as CSSProperties}>
              <button type="button" className="viewer-button" aria-label="Предыдущая фотография"
                disabled={selected === 0} onClick={() => change(-1)}>
                <ChevronLeft size={23} aria-hidden="true" />
              </button>
              <button type="button" className="viewer-button" aria-label="Следующая фотография"
                disabled={selected === photos.length - 1} onClick={() => change(1)}>
                <ChevronRight size={23} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <footer className="viewer-bottom"><p>{photo.alt}</p></footer>
      </>}
    </dialog>
  );
}

export function PhotoTrigger({ photos, index = 0, className = "", children, showExpand = true }: {
  photos: Photo[];
  index?: number;
  className?: string;
  children?: ReactNode;
  showExpand?: boolean;
}) {
  const viewer = useRef<PhotoViewerHandle>(null);
  const photo = photos[index];

  return (
    <>
      <button type="button" className={"photo-trigger " + className} aria-haspopup="dialog"
        aria-label={"Открыть фото. " + photo.alt} onClick={() => viewer.current?.open(index)}>
        {children ?? <Image src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} />}
        {showExpand && <span className="photo-expand"><Expand size={17} aria-hidden="true" /></span>}
      </button>
      <PhotoViewer photos={photos} ref={viewer} />
    </>
  );
}
