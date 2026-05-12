"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (jobs.length > 0) {
      handleJobChange(jobs[0].id);
    } else {
      handleJobChange("unlisted");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-[#FFFDF9] rounded-[2.5rem] w-full max-w-lg shadow-2xl border border-orange-100/80 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-6 border-b border-orange-100/70 flex justify-between items-center bg-gradient-to-r from-[#FFF6ED] to-white">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">
              Personalize Invite
            </h2>
            <p className="text-[10px] font-bold text-[#FF8A00] uppercase tracking-widest mt-1">
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
                className="w-full appearance-none cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20"
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
              <Briefcase className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            </div>

            {isUnlisted && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <input
                  type="text"
                  placeholder="Enter Unlisted Role Title (e.g. Lead Developer)"
                  value={customTitle}
                  onChange={(e) => handleCustomTitleChange(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-orange-100 bg-[#FFF6ED]/60 p-4 text-sm font-bold text-slate-900 placeholder:text-orange-300 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20"
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
              className="h-32 w-full resize-none rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold leading-relaxed text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20"
              placeholder="Write a personalized message..."
            />
          </div>

          {!isUnlisted && selectedJobId && (
            <div className="flex items-center gap-4 rounded-2xl border border-orange-100 bg-[#FFF6ED] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-100 bg-white shadow-sm">
                <Briefcase className="h-5 w-5 text-[#FF8A00]" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#FF8A00]">
                  {jobs.find((j) => j.id === selectedJobId)?.title}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                  Full description attached
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 bg-white py-4 text-[11px] font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-50 active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={handleSendInvite}
            disabled={loading || (isUnlisted && !customTitle)}
            className="flex-2 flex items-center justify-center gap-3 rounded-2xl bg-[#FF8A00] py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-orange-200 transition-all hover:bg-[#E67A00] disabled:bg-slate-200 disabled:shadow-none active:scale-95"
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

