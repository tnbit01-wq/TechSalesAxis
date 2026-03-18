"use client";

import { useState } from "react";
import {
  X,
  MessageCircle,
  CheckCircle2,
  XCircle,
  FastForward,
  Loader2,
  AlertCircle,
  Quote,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { awsAuth } from "@/lib/awsAuth";

interface InterviewFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  interviewId: string;
  applicationId: string;
  candidateName: string;
  roundName: string;
  onSuccess: () => void;
}

export default function InterviewFeedbackModal({
  isOpen,
  onClose,
  interviewId,
  applicationId,
  candidateName,
  roundName,
  onSuccess,
}: InterviewFeedbackModalProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<"offered" | "rejected" | "shortlisted" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!decision || !feedback.trim()) {
      setError("Please provide feedback and select a decision.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(`/interviews/${interviewId}/feedback`, {
        feedback: feedback.trim(),
        next_status: decision
      }, token);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Feedback submission failed:", err);
      setError(err.message || "Failed to submit feedback.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
              Post-Interview <span className="text-indigo-600">Evaluation</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
              Mission Debrief: {candidateName} - {roundName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Decision Selector */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              Select Strategic Decision
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setDecision("offered")}
                className={`
                  p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group
                  ${decision === "offered" 
                    ? "border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100" 
                    : "border-slate-100 hover:border-emerald-200 bg-white"}
                `}
              >
                <CheckCircle2 className={`h-6 w-6 ${decision === "offered" ? "text-emerald-500" : "text-slate-300 group-hover:text-emerald-400"}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${decision === "offered" ? "text-emerald-700" : "text-slate-500"}`}>
                  Make Offer
                </span>
              </button>

              <button
                onClick={() => setDecision("shortlisted")}
                className={`
                  p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group
                  ${decision === "shortlisted" 
                    ? "border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-100" 
                    : "border-slate-100 hover:border-indigo-200 bg-white"}
                `}
              >
                <FastForward className={`h-6 w-6 ${decision === "shortlisted" ? "text-indigo-500" : "text-slate-300 group-hover:text-indigo-400"}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${decision === "shortlisted" ? "text-indigo-700" : "text-slate-500"}`}>
                  Next Round
                </span>
              </button>

              <button
                onClick={() => setDecision("rejected")}
                className={`
                  p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group
                  ${decision === "rejected" 
                    ? "border-red-500 bg-red-50 shadow-lg shadow-red-100" 
                    : "border-slate-100 hover:border-red-200 bg-white"}
                `}
              >
                <XCircle className={`h-6 w-6 ${decision === "rejected" ? "text-red-500" : "text-slate-300 group-hover:text-red-400"}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${decision === "rejected" ? "text-red-700" : "text-slate-500"}`}>
                  Reject
                </span>
              </button>
            </div>
          </div>

          {/* Feedback Input */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-indigo-500" />
              Detailed Feedback / Candidate Debrief
            </h3>
            <div className="relative">
              <Quote className="absolute top-4 left-4 h-4 w-4 text-slate-200" />
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your evaluation after the session. This helps the candidate understand your decision or prepares them for the next transmission."
                className="w-full h-40 bg-slate-50 border border-slate-100 rounded-3xl p-6 pl-12 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all placeholder:text-slate-300 resize-none shadow-inner"
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest italic text-center">
              &quot;Signals sent here will be logged for candidate verification.&quot;
            </p>
          </div>

          {/* Actions */}
          <div className="pt-4 flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !decision || !feedback.trim()}
              className={`
                flex-[2] py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl
                ${loading || !decision || !feedback.trim()
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20 active:scale-[0.98]"}
              `}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing Signal...
                </div>
              ) : (
                "Transmit Evaluation"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
