"use client";

import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";

interface ShortlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (feedback: string) => void;
  count: number;
}

export default function ShortlistModal({
  isOpen,
  onClose,
  onConfirm,
  count,
}: ShortlistModalProps) {
  const [customFeedback, setCustomFeedback] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/40 backdrop-blur-sm">
      <div className="bg-[#FFFDF9] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-orange-100/80 max-h-[90vh] flex flex-col">
        {/* Sticky Header */}
        <div className="px-6 py-5 border-b border-orange-100/50 flex items-center justify-between bg-gradient-to-r from-orange-50/30 to-transparent">
          <div>
            <h3 className="text-lg font-black text-slate-955 tracking-tight">
              Shortlist Candidate
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Updating {count} Candidate{count > 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-all border border-slate-200/60 bg-white"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto candidate-modal-scroll flex-1 space-y-5">
          <div className="p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100/70 flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-955/80 leading-relaxed font-medium">
              Shortlisting a candidate moves them to the next stage, opens up direct chat channels, and triggers an email notification immediately.
            </p>
          </div>

          {/* Custom Shortlist Message */}
          <div className="space-y-2.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1">
              Shortlist Note / Message to Candidate (Optional)
            </label>
            <textarea
              value={customFeedback}
              onChange={(e) => setCustomFeedback(e.target.value)}
              placeholder="e.g. Congratulations! We would love to schedule a round with you..."
              className="w-full h-32 bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400 resize-none"
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-6 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(customFeedback.trim() || "Congratulations! You have been shortlisted.")}
            className="flex-1 py-3 px-4 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-600/10"
          >
            Confirm Shortlist
          </button>
        </div>
      </div>
    </div>
  );
}
