"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function NoteImages({ images }: { images: string[] }) {
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  if (!images || images.length === 0) return null;
  const count = images.length;

  const renderSingle = () => (
    <div className="mt-4 md:mt-8 flex justify-start sm:justify-center w-full">
      <div
        onClick={() => setLightbox({ images, index: 0 })}
        className="max-w-[80%] sm:max-w-[280px] overflow-hidden rounded-xl md:rounded-2xl border border-slate-200/50 dark:border-white/10 shadow-lg md:shadow-xl cursor-zoom-in group"
      >
        <img src={images[0]} alt="moment" referrerPolicy="no-referrer" className="w-full h-auto max-h-[300px] md:max-h-[400px] object-contain group-hover:scale-105 transition-transform duration-500" />
      </div>
    </div>
  );

  const renderGrid = () => {
    const columns = count === 4 ? 2 : 3;
    const maxWidth = count === 4 ? "210px" : "320px";
    return (
      <div className="w-full flex justify-start sm:justify-center mt-4 md:mt-8">
        <div className="grid gap-1.5 md:gap-2 sm:mx-auto" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, width: "100%", maxWidth }}>
          {images.slice(0, 9).map((src, idx) => {
            const isLastVisible = idx === 8 && count > 9;
            return (
              <div
                key={idx}
                onClick={() => setLightbox({ images, index: idx })}
                className="group relative aspect-square overflow-hidden rounded-lg md:rounded-xl bg-slate-200/20 dark:bg-slate-700/20 border border-slate-200/50 dark:border-white/10 cursor-zoom-in"
              >
                <img src={src} alt="moment" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                {isLastVisible && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white backdrop-blur-[2px]">
                    <span className="text-lg md:text-xl font-black">+{count - 9}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {count === 1 ? renderSingle() : renderGrid()}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/98 backdrop-blur-xl flex items-center justify-center cursor-pointer overflow-hidden"
            onClick={() => setLightbox(null)}
          >
            <motion.img
              key={lightbox.index}
              initial={{ opacity: 0, scale: 0.9, x: 50 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: -50 }}
              src={lightbox.images[lightbox.index]}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[75vh] md:max-h-[85vh] object-contain rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-white/10"
              alt="fullscreen"
            />
            <div className="absolute bottom-8 md:bottom-10 px-4 md:px-5 py-1.5 md:py-2 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-[10px] md:text-xs font-black tracking-widest border border-white/10">
              {lightbox.index + 1} / {lightbox.images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
