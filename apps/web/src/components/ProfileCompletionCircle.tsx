"use client";

import React from "react";
import { Camera, User } from "lucide-react";

interface ProfileCompletionCircleProps {
  percentage: number;
  photoUrl?: string | null;
  name?: string;
  size?: number;
  uploading?: boolean;
  onUploadClick?: () => void;
  onCompleteNowClick?: () => void;
}

export default function ProfileCompletionCircle({
  percentage = 0,
  photoUrl = null,
  name = "User",
  size = 110,
  uploading = false,
  onUploadClick,
  onCompleteNowClick,
}: ProfileCompletionCircleProps) {
  // Pastel image styled widget dimensions
  const strokeWidth = 3.5;
  const gap = 8; // spacing gap between inner avatar and outer progress arc
  const outerRadius = size / 2 + gap; 
  const svgSize = size + (gap + strokeWidth) * 2;
  const center = svgSize / 2;
  const circumference = 2 * Math.PI * outerRadius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "?";

  return (
    <div className="flex flex-col items-center select-none">
      {/* Circle Container wrapping outer arc & avatar */}
      <div 
        className="relative group flex items-center justify-center"
        style={{ width: svgSize, height: svgSize }}
      >
        {/* SVG Progress Circle wrapper */}
        <svg 
          className="absolute transform -rotate-90"
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
        >
          {/* Subtle track background */}
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            className="stroke-slate-100/60 fill-transparent"
            strokeWidth={strokeWidth}
          />
          {/* Pasted Image Mint-green progress arc */}
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            className="stroke-[#00D09C] fill-transparent transition-all duration-500 ease-out"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Profile Avatar Frame */}
        <div 
          className="relative rounded-full overflow-hidden border border-slate-100 shadow-[0_4px_12px_rgba(0,0,0,0.03)] bg-slate-50 flex items-center justify-center transition-transform group-hover:scale-[0.98]"
          style={{ width: size, height: size }}
        >
          {photoUrl ? (
            <img 
              src={photoUrl} 
              alt={name} 
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FFFBF6] to-slate-100 flex items-center justify-center text-slate-400 font-black text-xl">
              {initials || <User className="h-6 w-6 text-slate-350" />}
            </div>
          )}

          {/* Upload Hover Overlay */}
          {onUploadClick && (
            <button
              type="button"
              onClick={onUploadClick}
              disabled={uploading}
              className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer text-white"
            >
              {uploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Camera className="h-4 w-4 mb-1 text-slate-200" />
                  <span className="text-[9px] font-black uppercase tracking-wider">Update</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Camera Quick-Upload Badge (Bottom Right overlaying outer ring) */}
        {onUploadClick && (
          <button
            type="button"
            onClick={onUploadClick}
            disabled={uploading}
            className="absolute bottom-2 right-2 bg-white border border-slate-200 hover:border-[#FF8A00] text-slate-550 hover:text-[#FF8A00] h-6.5 w-6.5 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer z-10"
          >
            {uploading ? (
              <div className="h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Completion info text details */}
      <div className="mt-3 text-center flex flex-col items-center">
        <span className="text-[9px] font-black text-[#00D09C] uppercase tracking-wider bg-[#00D09C]/5 px-2.5 py-0.5 rounded-full border border-[#00D09C]/10">
          {percentage}% Profile Completed
        </span>

        {percentage < 100 && onCompleteNowClick && (
          <button
            type="button"
            onClick={onCompleteNowClick}
            className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#FF8A00] hover:text-[#E67A00] transition-colors cursor-pointer flex items-center gap-1 hover:underline"
          >
            Complete Now &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
