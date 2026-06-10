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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-955/40 backdrop-blur-sm">
      <div className="bg-[#FFFDF9] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-orange-100/80 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Sticky Header */}
        <div className="p-6 border-b border-orange-100/50 flex items-center justify-between bg-gradient-to-r from-orange-50/20 to-transparent shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-955 tracking-tight">
              Confirm Interview
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Mission Synchronization Required
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
          {loading ? (
            <div className="flex flex-col items-center py-20">
              <Loader2 className="h-10 w-10 text-[#FF8A00] animate-spin mb-4" />
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                Retrieving Time Coordinates...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-150 rounded-2xl flex items-center gap-3 text-red-650 text-xs font-bold">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-bold">{error}</p>
            </div>
          ) : interview ? (
            <>
              {/* Interview Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/50">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Round {interview.round_number}
                  </span>
                  <p className="text-xs font-black text-slate-900 leading-tight">{interview.round_name}</p>
                </div>
                <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/50">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Format
                  </span>
                  <div className="flex items-center gap-2">
                    {interview.format === "virtual" ? (
                      <Video className="h-4 w-4 text-[#FF8A00] shrink-0" />
                    ) : (
                      <MapPin className="h-4 w-4 text-[#FF8A00] shrink-0" />
                    )}
                    <p className="text-xs font-black text-slate-900 capitalize">{interview.format}</p>
                  </div>
                </div>
              </div>

              {/* Interviewers */}
              {interview.interviewer_names.length > 0 && (
                <div className="space-y-2.5">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1">
                    Meeting With
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {interview.interviewer_names.map((name) => (
                      <span key={name} className="px-3 py-1.5 bg-orange-50/40 text-[#FF8A00] rounded-xl text-[10px] font-black border border-orange-100/50 uppercase tracking-wider">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Slots Selection */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] px-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#FF8A00]" />
                  Select Preferred Slot
                </h4>
                <div className="grid grid-cols-1 gap-2.5">
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
                          p-4 rounded-2xl border text-left transition-all relative group cursor-pointer
                          ${isSelected 
                            ? "border-[#FF8A00] bg-orange-50/40 text-slate-900 shadow-sm ring-1 ring-[#FF8A00]/20" 
                            : "border-slate-200/60 hover:border-orange-100 hover:bg-slate-50/50 bg-white"}
                          ${submitting ? "opacity-50 cursor-not-allowed" : ""}
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className={`font-black uppercase tracking-tight text-xs ${isSelected ? "text-[#FF8A00]" : "text-slate-900"}`}>
                              {start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                            </p>
                            <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                              <Clock className="h-3 w-3 text-slate-350" />
                              <span>
                                {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-[#FF8A00] shrink-0 animate-in zoom-in duration-200" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Sticky Footer */}
        <div className="p-6 border-t border-slate-100 flex gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95 shadow-sm"
          >
            Postpone
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedSlotId || submitting || interview?.status === "scheduled"}
            className={`
              flex-[2] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg
              ${!selectedSlotId || submitting || interview?.status === "scheduled"
                ? "bg-slate-200 text-slate-450 cursor-not-allowed shadow-none border-slate-200"
                : "bg-[#FF8A00] hover:bg-[#E67A00] text-white border-[#FF8A00] shadow-orange-600/10"}
            `}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Finalizing...
              </>
            ) : (
              "Confirm Selection"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
