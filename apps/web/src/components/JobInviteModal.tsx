"use client";

import { useState } from "react";
import { X, Send, Loader2, Briefcase } from "lucide-react";

interface JobInviteModalProps {
  candidateName: string;
  jobs: {
    id: string;
    title: string;
    status: string;
    location: string;
    recruiter_id: string;
  }[];
  onClose: () => void;
  onInvite: (
    jobId: string,
    message: string,
    customTitle?: string,
  ) => Promise<void>;
}

export default function JobInviteModal({
  candidateName,
  jobs,
  onClose,
  onInvite,
}: JobInviteModalProps) {
  const [selectedJobId, setSelectedJobId] = useState(jobs[0]?.id || "");
  const [customTitle, setCustomTitle] = useState("");
  const [isUnlisted, setIsUnlisted] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendInvite = async () => {
    if (!selectedJobId && !isUnlisted) return;
    if (isUnlisted && !customTitle) return;

    setLoading(true);
    try {
      await onInvite(
        isUnlisted ? "unlisted" : selectedJobId,
        message,
        isUnlisted ? customTitle : undefined,
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJobChange = (jobId: string) => {
    if (jobId === "unlisted") {
      setIsUnlisted(true);
      setSelectedJobId("");
      setMessage(
        `Hi ${candidateName},\n\nI saw your profile and was impressed by your experience. We are currently looking for talent with your specific background for an unlisted role in our team.\n\nI'd love to chat more about your career goals and how they might align with our future growth. Let me know if you're open to a brief conversation!`,
      );
    } else {
      setIsUnlisted(false);
      setSelectedJobId(jobId);
      const job = jobs.find((j) => j.id === jobId);
      if (job) {
        setMessage(
          `Hi ${candidateName},\n\nI saw your profile and was impressed by your experience. I think you'd be a great fit for our ${job.title} role. We are looking for someone with your background to join our team.\n\nYou can find the full job description attached to this invitation. Let me know if you'd be interested in discussing this further!`,
        );
      }
    }
  };

  const handleCustomTitleChange = (val: string) => {
    setCustomTitle(val);
    if (isUnlisted) {
      setMessage(
        `Hi ${candidateName},\n\nI saw your profile and was impressed by your experience. I think you'd be a great fit for a ${val || "newly created"} role at our company. We are looking for specialized talent to join our ecosystem.\n\nI'd love to discuss this potential opportunity with you. Let me know if you're interested!`,
      );
    }
  };

  useState(() => {
    if (jobs.length > 0) {
      handleJobChange(jobs[0].id);
    } else {
      handleJobChange("unlisted");
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
              Personalize Invite
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Building bridge for {candidateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Select Role
            </label>
            <div className="relative">
              <select
                value={isUnlisted ? "unlisted" : selectedJobId}
                onChange={(e) => handleJobChange(e.target.value)}
                className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-primary focus:outline-none appearance-none cursor-pointer"
              >
                {jobs
                  .filter((j) => j.status === "active")
                  .map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} ({job.location})
                    </option>
                  ))}
                <option value="unlisted">
                  + Other / Unlisted Role
                </option>
              </select>
              <Briefcase className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
            </div>

            {isUnlisted && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <input
                  type="text"
                  placeholder="Enter Unlisted Role Title (e.g. Lead Developer)"
                  value={customTitle}
                  onChange={(e) => handleCustomTitleChange(e.target.value)}
                  className="w-full p-4 bg-blue-100/30 border border-blue-100 rounded-2xl text-sm font-bold text-blue-900 placeholder:text-blue-300 focus:ring-2 focus:ring-blue-600 focus:outline-none mt-2"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              Invitation Note
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-primary focus:outline-none resize-none leading-relaxed"
              placeholder="Write a personalized message..."
            />
          </div>

          {!isUnlisted && selectedJobId && (
            <div className="p-4 bg-primary-light/50 rounded-2xl border border-primary-light/50 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-white border border-primary-light flex items-center justify-center shadow-sm">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                  {jobs.find((j) => j.id === selectedJobId)?.title}
                </span>
                <span className="text-[8px] font-bold text-indigo-300 uppercase tracking-widest">
                  Full description attached
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleSendInvite}
            disabled={loading || (isUnlisted && !customTitle)}
            className="flex-2 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-600 transition-all shadow-xl shadow-blue-200 disabled:bg-slate-200 disabled:shadow-none active:scale-95"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" /> Send Invitation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

