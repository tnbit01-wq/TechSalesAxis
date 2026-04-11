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
    
    // Only require feedback for normal decisions, not for no_show or not_conducted
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">
              Post-Interview <span className="text-blue-600">Evaluation</span>
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
          {!recruiterAttended && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-700 text-xs font-bold animate-in slide-in-from-top-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-black">ATTENDANCE REQUIRED</p>
                <p className="font-medium text-amber-600 mt-1">You must attend the interview to submit evaluation results. Select &quot;Not Conducted&quot; if you missed the session or it didn&apos;t happen.</p>
              </div>
            </div>
          )}
          {/* Decision Selector */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              Select Strategic Decision
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDecision("offered")}
                disabled={!recruiterAttended}
                title={!recruiterAttended ? "You must attend the interview to submit this feedback" : ""}
                className={`
                  p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group
                  ${!recruiterAttended ? "opacity-40 cursor-not-allowed" : ""}
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
                disabled={!recruiterAttended}
                title={!recruiterAttended ? "You must attend the interview to submit this feedback" : ""}
                className={`
                  p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group
                  ${!recruiterAttended ? "opacity-40 cursor-not-allowed" : ""}
                  ${decision === "shortlisted" 
                    ? "border-blue-600 bg-blue-100 shadow-lg shadow-blue-200" 
                    : "border-slate-100 hover:border-blue-100 bg-white"}
                `}
              >
                <FastForward className={`h-6 w-6 ${decision === "shortlisted" ? "text-blue-600" : "text-slate-300 group-hover:text-blue-600"}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${decision === "shortlisted" ? "text-blue-700" : "text-slate-500"}`}>
                  Next Round
                </span>
              </button>

              <button
                onClick={() => setDecision("rejected")}
                disabled={!recruiterAttended}
                title={!recruiterAttended ? "You must attend the interview to submit this feedback" : ""}
                className={`
                  p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group
                  ${!recruiterAttended ? "opacity-40 cursor-not-allowed" : ""}
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

              <button
                onClick={() => setDecision("no_show")}
                disabled={!recruiterAttended}
                title={!recruiterAttended ? "You must attend the interview to report candidate no-show" : ""}
                className={`
                  p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group
                  ${!recruiterAttended ? "opacity-40 cursor-not-allowed" : ""}
                  ${decision === "no_show" 
                    ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100" 
                    : "border-slate-100 hover:border-orange-200 bg-white"}
                `}
              >
                <Clock className={`h-6 w-6 ${decision === "no_show" ? "text-orange-500" : "text-slate-300 group-hover:text-orange-400"}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${decision === "no_show" ? "text-orange-700" : "text-slate-500"}`}>
                  No Show
                </span>
              </button>

              <button
                onClick={() => setDecision("not_conducted")}
                disabled={recruiterAttended}
                title={recruiterAttended ? "Select only if you didn't attend or the meeting failed" : ""}
                className={`
                  p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group
                  ${recruiterAttended ? "opacity-40 cursor-not-allowed" : ""}
                  ${decision === "not_conducted" 
                    ? "border-purple-500 bg-purple-50 shadow-lg shadow-purple-100" 
                    : "border-slate-100 hover:border-purple-200 bg-white"}
                `}
              >
                <AlertTriangle className={`h-6 w-6 ${decision === "not_conducted" ? "text-purple-500" : "text-slate-300 group-hover:text-purple-400"}`} />
                <span className={`text-[9px] font-black uppercase tracking-widest ${decision === "not_conducted" ? "text-purple-700" : "text-slate-500"}`}>
                  Not Conducted
                </span>
              </button>
            </div>
          </div>

          {/* Feedback Input */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-blue-600" />
              Detailed Feedback / Candidate Debrief
            </h3>
            <div className="relative">
              <Quote className="absolute top-4 left-4 h-4 w-4 text-slate-200" />
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Share your evaluation after the session. This helps the candidate understand your decision or prepares them for the next transmission."
                className="w-full h-40 bg-slate-50 border border-slate-100 rounded-3xl p-6 pl-12 text-sm font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all placeholder:text-slate-300 resize-none shadow-inner"
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
              disabled={loading || !decision || (decision !== "no_show" && decision !== "not_conducted" && !feedback.trim())}
              className={`
                flex-[2] py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl
                ${loading || !decision || (decision !== "no_show" && decision !== "not_conducted" && !feedback.trim())
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20 active:scale-[0.98]"}
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

