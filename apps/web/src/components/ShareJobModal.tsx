"use client";

import { useState, useRef, useEffect } from "react";
import { X, Linkedin, Twitter, Link2, Check, MessageCircle } from "lucide-react";

interface ShareJobModalProps {
  job: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    company_name?: string;
  };
  companyName?: string;
  onClose: () => void;
}

export default function ShareJobModal({ job, companyName, onClose }: ShareJobModalProps) {
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Build the shareable URL
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const jobUrl = `${baseUrl}/dashboard/candidate/jobs?selected=${job.id}`;
  const company = companyName || job.company_name || "Our Company";

  // Compose share text
  const shareTitle = `${job.title} at ${company}`;
  const shareText = `🚀 Exciting opportunity: ${job.title} at ${company}${job.location ? ` (${job.location})` : ""}. Check it out!`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(jobUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = jobUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, "_blank", "width=600,height=500,noopener,noreferrer");
  };

  const shareChannels = [
    {
      name: "LinkedIn",
      icon: <Linkedin className="h-4 w-4" />,
      color: "text-[#0A66C2] border-[#0A66C2]/20 hover:bg-[#0A66C2]/5 hover:border-[#0A66C2]",
      onClick: () =>
        openShareWindow(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`
        ),
    },
    {
      name: "X / Twitter",
      icon: <Twitter className="h-4 w-4" />,
      color: "text-slate-900 border-slate-200 hover:bg-slate-50 hover:border-slate-950",
      onClick: () =>
        openShareWindow(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(jobUrl)}`
        ),
    },
    {
      name: "WhatsApp",
      icon: <MessageCircle className="h-4 w-4" />,
      color: "text-[#25D366] border-[#25D366]/20 hover:bg-[#25D366]/5 hover:border-[#25D366]",
      onClick: () =>
        openShareWindow(
          `https://wa.me/?text=${encodeURIComponent(`${shareText}\n\n${jobUrl}`)}`
        ),
    },
  ];

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-[4px] animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-sm overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.15)] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)] px-6 py-4">
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.15em] text-[#FF8A00]">
              Share Job Opportunity
            </h2>
            <h3 className="mt-1 text-sm font-bold text-slate-900 line-clamp-1">
              {job.title}
            </h3>
            <p className="text-[11px] font-medium text-slate-400">
              at {company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close share modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Share Channels */}
          <div className="grid grid-cols-3 gap-2.5">
            {shareChannels.map((channel) => (
              <button
                key={channel.name}
                onClick={channel.onClick}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${channel.color}`}
              >
                {channel.icon}
                <span className="text-[9px] font-black uppercase tracking-wider">
                  {channel.name}
                </span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Copy Link
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          {/* Copy Link Input */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-1.5">
            <div className="flex-1 truncate px-2 text-xs font-semibold text-slate-500 font-mono">
              {jobUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                copied
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-100"
                  : "bg-slate-900 text-white hover:bg-[#FF8A00] shadow-md shadow-slate-100"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="h-3 w-3" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
