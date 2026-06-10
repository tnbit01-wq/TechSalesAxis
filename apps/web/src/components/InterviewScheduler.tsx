"use client";

import { useState } from "react";
import {
  X,
  Calendar,
  Plus,
  Trash2,
  Video,
  MapPin,
  Loader2,
  Briefcase,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { awsAuth } from "@/lib/awsAuth";

interface InterviewSchedulerProps {
  candidateName: string;
  applicationId?: string;
  jobTitle?: string;
  applications?: {
    id: string;
    job_id: string;
    status: string;
    jobs?: { title: string };
  }[];
  onClose: () => void;
  onSuccess: () => void;
  initialRoundNumber?: number;
}

export default function InterviewScheduler({
  candidateName,
  applicationId,
  jobTitle,
  applications = [],
  onClose,
  onSuccess,
  initialRoundNumber,
}: InterviewSchedulerProps) {
  const [loading, setLoading] = useState(false);
  const [roundName, setRoundName] = useState("Technical Interview");
  const [roundNumber, setRoundNumber] = useState(initialRoundNumber || 1);
  const [format, setFormat] = useState<"virtual" | "onsite">("virtual");
  const [location, setLocation] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [interviewers, setInterviewers] = useState<string[]>([]);
  const [selectedAppId, setSelectedAppId] = useState(
    applicationId || applications[0]?.id || "",
  );
  const [slots, setSlots] = useState<
    { start_time: string; end_time: string }[]
  >([{ start_time: "", end_time: "" }]);

  const addSlot = () => {
    if (slots.length < 5) {
      setSlots([...slots, { start_time: "", end_time: "" }]);
    }
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: string, value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setSlots(newSlots);
  };

  const addInterviewer = () => {
    if (interviewer.trim()) {
      setInterviewers([...interviewers, interviewer.trim()]);
      setInterviewer("");
    }
  };

  const removeInterviewer = (name: string) => {
    setInterviewers(interviewers.filter((n) => n !== name));
  };

  const handleSchedule = async () => {
    if (!selectedAppId || slots.some((s) => !s.start_time || !s.end_time)) {
      alert("Please fill in all required fields and slots.");
      return;
    }

    setLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const formattedSlots = slots.map(slot => {
        const date = new Date(slot.start_time);
        const endDate = new Date(slot.end_time);
        return {
          start_time: date.toISOString(),
          end_time: endDate.toISOString()
        };
      });

      console.log("DEBUG PROPOSE SLOTS (ISO):", formattedSlots);

      await apiClient.post(
        "/interviews/propose",
        {
          application_id: selectedAppId,
          round_name: roundName,
          round_number: roundNumber,
          format: format,
          location: format === "onsite" ? location : null,
          interviewer_names: interviewers,
          slots: formattedSlots,
        },
        token,
      );

      onSuccess();
    } catch (err) {
      console.error("Scheduling failed:", err);
      alert("Failed to propose interview.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/40 backdrop-blur-sm p-4">
      <div className="bg-[#FFFDF9] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-orange-100/80 animate-in fade-in zoom-in-95 duration-200">
        {/* Sticky Header */}
        <div className="p-6 border-b border-orange-100/50 flex justify-between items-center bg-gradient-to-r from-orange-50/20 to-transparent shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-950 tracking-tight">
              Propose Interview
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Scheduling for {candidateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-all border border-slate-200/60 bg-white"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 md:p-8 overflow-y-auto candidate-modal-scroll flex-1 space-y-6">
          {/* Job Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
              Target Role / Pipeline
            </label>
            {applications && applications.length > 1 ? (
              <div className="relative flex items-center">
                <Briefcase className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="w-full pl-11 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:outline-none transition-all appearance-none cursor-pointer"
                >
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.jobs?.title} ({app.status})
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 pointer-events-none text-slate-400 text-[10px]">▼</div>
              </div>
            ) : (
              <div className="p-4 bg-orange-50/20 border border-orange-100/50 rounded-2xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-[#FF8A00] shrink-0 border border-orange-100/30">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Target Role / Pipeline</p>
                  <p className="text-xs font-black text-slate-900">
                    {jobTitle || (applications && applications[0]?.jobs?.title) || "Target Position"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Round Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
                Round Name
              </label>
              <input
                type="text"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                placeholder="e.g. Technical Screening"
                className="w-full p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
                Round Number
              </label>
              <input
                type="number"
                value={roundNumber}
                onChange={(e) => setRoundNumber(parseInt(e.target.value))}
                className="w-full p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
              Interview Format
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormat("virtual")}
                className={`p-5 rounded-2xl border flex items-center gap-4 transition-all duration-200 text-left ${
                  format === "virtual"
                    ? "bg-orange-50/40 border-[#FF8A00] ring-2 ring-[#FF8A00]/10"
                    : "bg-white border-slate-200/60 hover:border-slate-300"
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                    format === "virtual" ? "bg-[#FF8A00] text-white" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 leading-none mb-1">
                    Virtual
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Remote / Video Call
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("onsite")}
                className={`p-5 rounded-2xl border flex items-center gap-4 transition-all duration-200 text-left ${
                  format === "onsite"
                    ? "bg-orange-50/40 border-[#FF8A00] ring-2 ring-[#FF8A00]/10"
                    : "bg-white border-slate-200/60 hover:border-slate-300"
                }`}
              >
                <div
                  className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                    format === "onsite" ? "bg-[#FF8A00] text-white" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 leading-none mb-1">
                    Face-to-Face
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    On-site / Physical
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Location Input */}
          {format === "onsite" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-3 duration-250">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
                Office Location / Address
              </label>
              <div className="relative flex items-center">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter full office address or meeting room..."
                  className="w-full pl-11 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          {/* Interviewers Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
              Interviewer(s)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={interviewer}
                onChange={(e) => setInterviewer(e.target.value)}
                placeholder="Add interviewer name or email..."
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInterviewer())}
                className="flex-1 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:outline-none transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={addInterviewer}
                className="px-5 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {interviewers.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {interviewers.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50/50 border border-orange-100 rounded-full text-[9px] font-black text-[#FF8A00] uppercase tracking-wider"
                  >
                    <span>{name}</span>
                    <button
                      type="button"
                      onClick={() => removeInterviewer(name)}
                      className="hover:text-red-500 hover:bg-white p-0.5 rounded-full transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-slate-100" />

          {/* Slot Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
                  Proposed Time Slots (Max 5)
                </label>
                <p className="text-[8px] font-bold text-[#FF8A00] uppercase tracking-widest mt-0.5">
                  Operating in {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>
              <button
                type="button"
                onClick={addSlot}
                disabled={slots.length >= 5}
                className="text-[9px] font-black text-[#FF8A00] uppercase tracking-widest hover:text-[#E67A00] disabled:opacity-30 flex items-center gap-1 px-2.5 py-1.5 bg-orange-50/50 rounded-lg transition-colors border border-orange-100"
              >
                <Plus className="w-3 h-3" /> Add Slot
              </button>
            </div>

            <div className="space-y-2.5">
              {slots.map((slot, index) => (
                <div
                  key={index}
                  className="group grid grid-cols-1 md:grid-cols-[1fr,1fr,auto] gap-3 items-end bg-slate-50/60 p-4 rounded-2xl border border-slate-200/50 transition-all hover:border-orange-100 hover:bg-slate-50"
                >
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={slot.start_time}
                      onChange={(e) =>
                        updateSlot(index, "start_time", e.target.value)
                      }
                      className="w-full bg-white p-3 border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      value={slot.end_time}
                      onChange={(e) =>
                        updateSlot(index, "end_time", e.target.value)
                      }
                      className="w-full bg-white p-3 border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:outline-none transition-all"
                    />
                  </div>
                  <div className="flex justify-end">
                    {index > 0 ? (
                      <button
                        type="button"
                        onClick={() => removeSlot(index)}
                        className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      // Placeholder block to maintain alignment on desktop grid
                      <div className="hidden md:block w-10" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-6 border-t border-slate-100 flex gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-95"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSchedule}
            disabled={
              loading || slots.some((s) => !s.start_time || !s.end_time)
            }
            className="flex-1 py-3 bg-[#FF8A00] hover:bg-[#E67A00] text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-orange-600/10"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Propose Interview
          </button>
        </div>
      </div>
    </div>
  );
}

