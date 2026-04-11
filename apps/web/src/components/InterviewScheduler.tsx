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
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { awsAuth } from "@/lib/awsAuth";

interface InterviewSchedulerProps {
  candidateName: string;
  applicationId?: string;
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
    // Basic validation
    if (!selectedAppId || slots.some((s) => !s.start_time || !s.end_time)) {
      alert("Please fill in all required fields and slots.");
      return;
    }

    setLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      // Convert local datetime-local strings to ISO 8601 strings that include the current machine's timezone
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
              Propose Interview
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Scheduling for {candidateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Job Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Select Role / Pipeline
            </label>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.jobs?.title} ({app.status})
                </option>
              ))}
            </select>
          </div>

          {/* Round Details */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Round Name
              </label>
              <input
                type="text"
                value={roundName}
                onChange={(e) => setRoundName(e.target.value)}
                placeholder="e.g. Technical Screening"
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Round #
              </label>
              <input
                type="number"
                value={roundNumber}
                onChange={(e) => setRoundNumber(parseInt(e.target.value))}
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Interview Format
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormat("virtual")}
                className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all duration-300 ${
                  format === "virtual"
                    ? "bg-blue-50/50 border-blue-600 ring-4 ring-blue-50"
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                <div
                  className={`p-3 rounded-2xl ${format === "virtual" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}
                >
                  <Video className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p
                    className={`text-sm font-black ${format === "virtual" ? "text-blue-900" : "text-slate-600"}`}
                  >
                    Virtual
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Remote / Video Call
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat("onsite")}
                className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all duration-300 ${
                  format === "onsite"
                    ? "bg-blue-50/50 border-blue-600 ring-4 ring-blue-50"
                    : "bg-white border-slate-100 hover:border-slate-200"
                }`}
              >
                <div
                  className={`p-3 rounded-2xl ${format === "onsite" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}
                >
                  <MapPin className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p
                    className={`text-sm font-black ${format === "onsite" ? "text-blue-900" : "text-slate-600"}`}
                  >
                    Face-to-Face
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    On-site / Physical
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Location Input */}
          {format === "onsite" && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Office Location / Address
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-slate-100 rounded-lg group-focus-within:bg-blue-100 transition-colors">
                  <MapPin className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600" />
                </div>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter full office address or meeting room details..."
                  className="w-full pl-16 p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          {/* Interviewers Selection */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Interviewer(s)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={interviewer}
                onChange={(e) => setInterviewer(e.target.value)}
                placeholder="Name or Email..."
                onKeyPress={(e) => e.key === "Enter" && addInterviewer()}
                className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addInterviewer}
                className="px-6 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {interviewers.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {interviewers.map((name) => (
                  <div
                    key={name}
                    className="group flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full text-[10px] font-black text-blue-700 uppercase tracking-wider"
                  >
                    {name}
                    <button
                      onClick={() => removeInterviewer(name)}
                      className="hover:text-red-500 p-0.5 rounded-full hover:bg-white transition-all"
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
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  Proposed Time Slots (Max 5)
                </label>
                <p className="text-[8px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">
                  Operating in {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>
              <button
                type="button"
                onClick={addSlot}
                disabled={slots.length >= 5}
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 disabled:opacity-30 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Slot
              </button>
            </div>

            <div className="space-y-3">
              {slots.map((slot, index) => (
                <div
                  key={index}
                  className="group relative grid grid-cols-[1fr,1fr,auto] gap-3 items-end bg-slate-50 p-6 rounded-3xl border border-slate-100 transition-all hover:border-blue-100 hover:shadow-sm"
                >
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={slot.start_time}
                      onChange={(e) =>
                        updateSlot(index, "start_time", e.target.value)
                      }
                      className="w-full bg-white p-3.5 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block ml-1">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      value={slot.end_time}
                      onChange={(e) =>
                        updateSlot(index, "end_time", e.target.value)
                      }
                      className="w-full bg-white p-3.5 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                  {index > 0 && (
                    <button
                      onClick={() => removeSlot(index)}
                      className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all mb-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-slate-100 flex gap-4 sticky bottom-0 bg-white/80 backdrop-blur-md">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:bg-slate-100 transition-all"
          >
            Discard
          </button>
          <button
            onClick={handleSchedule}
            disabled={
              loading || slots.some((s) => !s.start_time || !s.end_time)
            }
            className="flex-1 py-4 bg-blue-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
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

