"use client";

import { useState } from "react";
import { X, AlertCircle } from "lucide-react";

interface RejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  count: number;
}

const ETHICAL_REASONS = [
  "Skills/Experience do not fully align with current role requirements",
  "Role has been closed or already filled by another candidate",
  "Salary or location expectations are outside of the current scope",
  "Other candidates more closely matched the specific criteria for this round",
  "Application does not meet the minimum eligibility criteria specified",
];

export default function RejectionModal({
  isOpen,
  onClose,
  onConfirm,
  count,
}: RejectionModalProps) {
  const [selectedReason, setSelectedReason] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-955/40 backdrop-blur-sm">
      <div className="bg-[#FFFDF9] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-orange-100/80 max-h-[90vh] flex flex-col">
        {/* Sticky Header */}
        <div className="px-6 py-5 border-b border-orange-100/50 flex items-center justify-between bg-gradient-to-r from-orange-50/30 to-transparent">
          <div>
            <h3 className="text-lg font-black text-slate-950 tracking-tight">
              Reject Candidate
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
          <div className="p-4 bg-orange-50/40 rounded-2xl border border-orange-100/70 flex gap-3">
            <AlertCircle className="h-5 w-5 text-[#FF8A00] shrink-0 mt-0.5" />
            <p className="text-xs text-orange-955/80 leading-relaxed font-medium">
              Providing clear, objective reasons helps maintain a positive employer
              reputation and ensures transparency for all applicants.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3">
              Select Ethical Reason
            </label>
            <div className="space-y-2">
              {ETHICAL_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 text-xs font-semibold relative ${
                      isSelected
                        ? "border-[#FF8A00] bg-orange-50/40 text-slate-900 shadow-sm ring-1 ring-[#FF8A00]/20"
                        : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 text-slate-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? "border-[#FF8A00] bg-[#FF8A00]" : "border-slate-300"
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="leading-snug">{reason}</span>
                    </div>
                  </button>
                );
              })}
            </div>
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
            disabled={!selectedReason}
            onClick={() => onConfirm(selectedReason)}
            className="flex-1 py-3 px-4 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-600/10 disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none"
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}
