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
  Clock,
  AlertTriangle,
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
  recruiterJoinedAt?: string | null;
  candidateJoinedAt?: string | null;
  onSuccess: () => void;
}

export default function InterviewFeedbackModal({
  isOpen,
  onClose,
  interviewId,
  applicationId,
  candidateName,
  roundName,
  recruiterJoinedAt,
  candidateJoinedAt,
  onSuccess,
}: InterviewFeedbackModalProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [decision, setDecision] = useState<"offered" | "rejected" | "shortlisted" | "no_show" | "not_conducted" | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const recruiterAttended = !!recruiterJoinedAt;
  const candidateAttended = !!candidateJoinedAt;

  const handleSubmit = async () => {
    if (!decision) {
      setError("Please select a decision.");
      return;
    }
    
    if (decision !== "no_show" && decision !== "not_conducted" && !feedback.trim()) {
      setError("Please provide feedback.");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/40 backdrop-blur-sm">
      <div className="bg-[#FFFDF9] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-orange-100/80 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Sticky Header */}
        <div className="p-6 border-b border-orange-100/50 flex items-center justify-between bg-gradient-to-r from-orange-50/20 to-transparent shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-955 tracking-tight">
              Post-Interview Evaluation
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Mission Debrief: {candidateName} — {roundName}
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
        <div className="p-6 overflow-y-auto candidate-modal-scroll flex-1 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {!recruiterAttended && (
            <div className="p-4 bg-orange-50/40 border border-orange-100 rounded-2xl flex items-start gap-3 text-orange-955 text-xs font-bold animate-in slide-in-from-top-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#FF8A00]" />
              <div>
                <p className="font-black text-[#FF8A00] uppercase tracking-wider">Attendance Required</p>
                <p className="font-medium text-orange-900 mt-1 leading-relaxed">
                  You must attend the interview session to submit evaluation results. Select &quot;Not Conducted&quot; if you missed the session or it did not happen.
                </p>
              </div>
            </div>
          )}

          {/* Decision Selector */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1">
              Select Strategic Decision
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setDecision("offered")}
                disabled={!recruiterAttended}
                title={!recruiterAttended ? "You must attend the interview to submit this feedback" : ""}
                className={`
                  p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 group text-center
                  ${!recruiterAttended ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  ${decision === "offered" 
                    ? "border-emerald-500 bg-emerald-50/50 text-emerald-955 shadow-sm" 
                    : "border-slate-200/60 hover:border-emerald-200 bg-white text-slate-500 hover:text-slate-700"}
                `}
              >
                <CheckCircle2 className={`h-5 w-5 ${decision === "offered" ? "text-emerald-500" : "text-slate-300 group-hover:text-emerald-400"}`} />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  Make Offer
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDecision("shortlisted")}
                disabled={!recruiterAttended}
                title={!recruiterAttended ? "You must attend the interview to submit this feedback" : ""}
                className={`
                  p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 group text-center
                  ${!recruiterAttended ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  ${decision === "shortlisted" 
                    ? "border-[#FF8A00] bg-orange-50/40 text-orange-955 shadow-sm" 
                    : "border-slate-200/60 hover:border-orange-200 bg-white text-slate-500 hover:text-slate-700"}
                `}
              >
                <FastForward className={`h-5 w-5 ${decision === "shortlisted" ? "text-[#FF8A00]" : "text-slate-300 group-hover:text-[#FF8A00]"}`} />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  Next Round
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDecision("rejected")}
                disabled={!recruiterAttended}
                title={!recruiterAttended ? "You must attend the interview to submit this feedback" : ""}
                className={`
                  p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 group text-center
                  ${!recruiterAttended ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  ${decision === "rejected" 
                    ? "border-red-500 bg-red-50/50 text-red-955 shadow-sm" 
                    : "border-slate-200/60 hover:border-red-200 bg-white text-slate-500 hover:text-slate-700"}
                `}
              >
                <XCircle className={`h-5 w-5 ${decision === "rejected" ? "text-red-500" : "text-slate-300 group-hover:text-red-400"}`} />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  Reject
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDecision("no_show")}
                disabled={!recruiterAttended}
                title={!recruiterAttended ? "You must attend the interview to report candidate no-show" : ""}
                className={`
                  p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 group text-center
                  ${!recruiterAttended ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  ${decision === "no_show" 
                    ? "border-amber-500 bg-amber-50/50 text-amber-955 shadow-sm" 
                    : "border-slate-200/60 hover:border-amber-200 bg-white text-slate-500 hover:text-slate-700"}
                `}
              >
                <Clock className={`h-5 w-5 ${decision === "no_show" ? "text-amber-500" : "text-slate-300 group-hover:text-amber-400"}`} />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  No Show
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDecision("not_conducted")}
                disabled={recruiterAttended}
                title={recruiterAttended ? "Select only if you didn't attend or the meeting failed" : ""}
                className={`
                  p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 group text-center
                  ${recruiterAttended ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                  ${decision === "not_conducted" 
                    ? "border-purple-500 bg-purple-50/50 text-purple-955 shadow-sm" 
                    : "border-slate-200/60 hover:border-purple-200 bg-white text-slate-500 hover:text-slate-700"}
                `}
              >
                <AlertTriangle className={`h-5 w-5 ${decision === "not_conducted" ? "text-purple-500" : "text-slate-300 group-hover:text-purple-400"}`} />
                <span className="text-[9px] font-black uppercase tracking-wider">
                  Not Conducted
                </span>
              </button>
            </div>
          </div>

          {/* Feedback Input */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#FF8A00]" />
              Detailed Feedback / Candidate Debrief
            </h3>
            <div className="relative flex">
              <Quote className="absolute top-4 left-4 h-4 w-4 text-slate-200" />
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your evaluation after the session. This feedback is logged for candidate review and next round preparation..."
                className="w-full h-36 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 pl-11 text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:outline-none transition-all placeholder:text-slate-400 resize-none"
              />
            </div>
            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider italic text-center">
              &quot;Signals sent here will be logged for candidate verification.&quot;
            </p>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-6 border-t border-slate-100 flex gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95 shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !decision || (decision !== "no_show" && decision !== "not_conducted" && !feedback.trim())}
            className={`
              flex-[2] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg
              ${loading || !decision || (decision !== "no_show" && decision !== "not_conducted" && !feedback.trim())
                ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border-slate-200"
                : "bg-[#FF8A00] hover:bg-[#E67A00] text-white border-[#FF8A00] shadow-orange-600/10"}
            `}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Signal...
              </>
            ) : (
              "Transmit Evaluation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
