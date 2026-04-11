"use client";

import { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { awsAuth } from "@/lib/awsAuth";

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  is_selected: boolean;
}

interface Interview {
  id: string;
  status: string;
  round_name: string;
  round_number: number;
  format: "virtual" | "onsite";
  location?: string;
  meeting_link?: string;
  interviewer_names: string[];
  slots: Slot[];
}

interface CandidateInterviewConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  interviewId: string;
  onSuccess: () => void;
}

export default function CandidateInterviewConfirmModal({
  isOpen,
  onClose,
  interviewId,
  onSuccess,
}: CandidateInterviewConfirmModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && interviewId) {
      loadInterview();
    }
  }, [isOpen, interviewId]);

  async function loadInterview() {
    setLoading(true);
    setError(null);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      // We use the general interviews/my or a specific one? 
      // Let's just fetch all and find the one we need for simplicity or add a specific get.
      // Actually, let's use the /interviews/my endpoint and filter
      const interviews = await apiClient.get("/interviews/my", token);
      console.log("DEBUG LOAD INTERVIEW: Target ID", interviewId, "Received:", interviews);
      const target = interviews.find((i: any) => String(i.id) === String(interviewId));
      
      if (target) {
        if (target.status === "scheduled") {
          const confirmedSlot = target.slots?.find((s: any) => s.is_selected);
          if (confirmedSlot) setSelectedSlotId(confirmedSlot.id);
          setError("This interview has already been confirmed.");
        }
        setInterview(target);
      } else {
        console.error("Interview ID not found in list:", interviewId);
        setError("Interview details not found.");
      }
    } catch (err) {
      console.error("Failed to load interview:", err);
      setError("Failed to load interview details.");
    } finally {
      setLoading(false);
    }
  }

  const handleConfirm = async () => {
    if (!selectedSlotId) return;

    setSubmitting(true);
    setError(null);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post("/interviews/confirm", {
        slot_id: selectedSlotId
      }, token);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Confirmation failed:", err);
      setError(err.message || "Failed to confirm interview slot.");
    } finally {
      setSubmitting(false);
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
              Confirm <span className="text-blue-600">Interview</span>
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
              Mission Synchronization Required
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-slate-100"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex flex-col items-center py-20">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Retrieving Time Coordinates...
              </p>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 text-red-600">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <p className="font-bold text-sm">{error}</p>
            </div>
          ) : interview ? (
            <>
              {/* Interview Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Round {interview.round_number}
                  </span>
                  <p className="font-bold text-slate-900">{interview.round_name}</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Format
                  </span>
                  <div className="flex items-center gap-2">
                    {interview.format === "virtual" ? (
                      <Video className="h-4 w-4 text-blue-600" />
                    ) : (
                      <MapPin className="h-4 w-4 text-blue-600" />
                    )}
                    <p className="font-bold text-slate-900 capitalize">{interview.format}</p>
                  </div>
                </div>
              </div>

              {/* Interviewers */}
              {interview.interviewer_names.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                    Meeting With
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {interview.interviewer_names.map((name) => (
                      <span key={name} className="px-3 py-1.5 bg-blue-100 text-blue-600 rounded-xl text-xs font-bold border border-blue-100">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Slots Selection */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Select Preferred Slot
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {interview.slots.map((slot) => {
                    const start = new Date(slot.start_time);
                    const end = new Date(slot.end_time);
                    const isSelected = selectedSlotId === slot.id;

                    return (
                      <button
                        key={slot.id}
                        disabled={submitting}
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`
                          p-5 rounded-3xl border-2 text-left transition-all relative group
                          ${isSelected 
                            ? "border-blue-600 bg-blue-100/50 shadow-lg shadow-blue-200" 
                            : "border-slate-100 bg-white hover:border-blue-100"}
                          ${submitting ? "opacity-50 cursor-not-allowed" : ""}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className={`font-black uppercase tracking-tight text-sm ${isSelected ? "text-indigo-900" : "text-slate-900"}`}>
                              {start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-tighter">
                              <Clock className="h-3 w-3" />
                              {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-6 w-6 text-blue-600 animate-in zoom-in duration-300" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-colors"
                >
                  Postpone
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!selectedSlotId || submitting || interview?.status === "scheduled"}
                  className={`
                    flex-[2] py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl
                    ${!selectedSlotId || submitting || interview?.status === "scheduled"
                      ? "bg-slate-200 text-slate-700 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20 active:scale-[0.98]"}
                  `}
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Finalizing...
                    </div>
                  ) : (
                    "Confirm Selection"
                  )}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

