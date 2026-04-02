"use client";

import React, { useState } from "react";
import Image from "next/image";
import { X, Play, Image as ImageIcon, Maximize2 } from "lucide-react";

interface CompanyCultureGalleryProps {
  urls: string[];
  companyName: string;
}

export default function CompanyCultureGallery({ urls, companyName }: CompanyCultureGalleryProps) {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);

  if (!urls || urls.length === 0) return null;

  const isVideo = (url: string) => {
    const videoExtensions = [".mp4", ".mov", ".webm", ".ogg"];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || url.includes("video");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Life at {companyName}</h3>
          <p className="text-[10px] text-slate-500 font-medium">Get a glimpse of our culture and environment</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {urls.map((url, index) => (
          <div 
            key={index}
            onClick={() => setSelectedMedia(url)}
            className={`group relative overflow-hidden rounded-2xl cursor-zoom-in bg-slate-100 border border-slate-200 transition-all hover:shadow-lg hover:shadow-primary-light ${
              index === 0 ? "col-span-2 row-span-2 aspect-square md:aspect-video" : "aspect-square"
            }`}
          >
            {isVideo(url) ? (
              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <video src={url} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                    <Play className="text-white fill-current h-5 w-5" />
                  </div>
                </div>
              </div>
            ) : (
              <Image 
                src={url} 
                alt={`${companyName} culture ${index + 1}`}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
            )}
            
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="h-8 w-8 rounded-lg bg-black/30 backdrop-blur-md flex items-center justify-center border border-white/20 text-white">
                <Maximize2 size={14} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Overlay */}
      {selectedMedia && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-xl animate-in fade-in duration-300">
          <button 
            onClick={() => setSelectedMedia(null)}
            className="absolute top-6 right-6 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-all backdrop-blur-md border border-white/10 z-[120]"
          >
            <X size={24} />
          </button>
          
          <div className="max-w-5xl w-full h-full flex items-center justify-center">
            {isVideo(selectedMedia) ? (
              <video 
                src={selectedMedia} 
                controls 
                autoPlay 
                className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl"
              />
            ) : (
              <div className="relative w-full h-[85vh]">
                <Image 
                  src={selectedMedia} 
                  alt="Culture full view"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

