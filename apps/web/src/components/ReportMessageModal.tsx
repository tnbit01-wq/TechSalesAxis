"use client";

import { useState } from "react";
import { X, Flag, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { awsAuth } from "@/lib/awsAuth";
import { toast } from "sonner";

interface ReportMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  senderName: string;
  onReportSuccess?: () => void;
}

export default function ReportMessageModal({
  isOpen,
  onClose,
  messageId,
  senderName,
  onReportSuccess,
}: ReportMessageModalProps) {
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportReasons = [
    "Harassment or Bullying",
    "Inappropriate Content",
    "Spam",
    "Threat or Violence",
    "Other",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason) {
      toast.error("Please select a reason for reporting");
      return;
    }

    if (reason === "Other" && !customReason.trim()) {
      toast.error("Please provide details for your report");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = awsAuth.getToken();
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const reportReason = reason === "Other" ? customReason : reason;

      await apiClient.post(
        "/chat/report",
        {
          message_id: messageId,
          reason: reportReason,
        },
        token
      );

      toast.success("Report submitted successfully. Our team will review it shortly.");
      setReason("");
      setCustomReason("");
      onClose();
      onReportSuccess?.();
    } catch (err: any) {
      console.error("Report error:", err);
      toast.error(err.message || "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full transform transition-all">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-xl">
              <Flag className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-black text-slate-900">Report Message</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Info Banner */}
          <div className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 font-medium">
              You're reporting a message from <span className="font-bold">{senderName}</span>. Our moderation team will review this case.
            </p>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-tighter">
              Reason for Report
            </label>
            <div className="space-y-2">
              {reportReasons.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-4 h-4 text-blue-600 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-700">{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Reason */}
          {reason === "Other" && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-tighter">
                Additional Details
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please provide more information about this report..."
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm uppercase tracking-tighter hover:bg-slate-200 transition-colors disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-sm uppercase tracking-tighter hover:bg-red-700 transition-colors disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

