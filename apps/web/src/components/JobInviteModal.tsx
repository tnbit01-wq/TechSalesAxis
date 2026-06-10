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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/40 backdrop-blur-sm p-4">
      <div className="bg-[#FFFDF9] rounded-3xl w-full max-w-lg shadow-2xl border border-orange-100/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Sticky Header */}
        <div className="p-6 border-b border-orange-100/50 flex justify-between items-center bg-gradient-to-r from-orange-50/20 to-transparent shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-955 tracking-tight">
              Personalize Invite
            </h2>
            <p className="text-[10px] font-bold text-[#FF8A00] uppercase tracking-widest mt-0.5">
              Building bridge for {candidateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-all border border-slate-200/60 bg-white"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto candidate-modal-scroll flex-1 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
              Select Role
            </label>
            <div className="relative flex items-center">
              <Briefcase className="pointer-events-none absolute left-4 h-4 w-4 text-slate-400" />
              <select
                value={isUnlisted ? "unlisted" : selectedJobId}
                onChange={(e) => handleJobChange(e.target.value)}
                className="w-full appearance-none cursor-pointer rounded-2xl border border-slate-250 bg-white p-4 pl-11 pr-10 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] transition-all"
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
              <span className="pointer-events-none absolute right-4 text-slate-400 text-[10px]">▼</span>
            </div>

            {isUnlisted && (
              <div className="animate-in slide-in-from-top-2 duration-250">
                <input
                  type="text"
                  placeholder="Enter Unlisted Role Title (e.g. Lead Developer)"
                  value={customTitle}
                  onChange={(e) => handleCustomTitleChange(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-orange-100 bg-[#FFF6ED]/50 p-4 text-xs font-semibold text-slate-800 placeholder:text-orange-350 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] transition-all"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block">
              Invitation Note
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-32 w-full resize-none rounded-2xl border border-slate-200/60 bg-slate-50 p-4 text-xs font-semibold leading-relaxed text-slate-650 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] transition-all"
              placeholder="Write a personalized message..."
            />
          </div>

          {!isUnlisted && selectedJobId && (
            <div className="flex items-center gap-3.5 rounded-2xl border border-orange-100 bg-orange-50/20 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-100/50 bg-white shadow-xs text-[#FF8A00] shrink-0">
                <Briefcase className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FF8A00] truncate">
                  {jobs.find((j) => j.id === selectedJobId)?.title}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                  Full job details will be attached
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="p-6 border-t border-slate-100 flex gap-4 bg-slate-50/80 backdrop-blur-sm shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 active:scale-95 shadow-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendInvite}
            disabled={loading || (isUnlisted && !customTitle)}
            className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl bg-[#FF8A00] py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/10 transition-all hover:bg-[#E67A00] disabled:opacity-50 disabled:shadow-none active:scale-95"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Send Invitation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
