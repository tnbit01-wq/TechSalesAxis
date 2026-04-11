"use client";

import { useEffect, useState } from "react";
import { X, Clock, User, ArrowRight, MessageSquare } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { awsAuth } from "@/lib/awsAuth";

interface HistoryItem {
  id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  reason: string | null;
  created_at: string;
  users: {
    email: string;
  };
}

interface ApplicationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  candidateName: string;
}

export default function ApplicationHistoryModal({
  isOpen,
  onClose,
  applicationId,
  candidateName,
}: ApplicationHistoryModalProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && applicationId) {
      async function loadHistory() {
        try {
          const token = awsAuth.getToken();
          if (!token) return;

          const data = await apiClient.get(
            `/recruiter/applications/${applicationId}/history`,
            token,
          );
          setHistory(data || []);
        } catch (err) {
          console.error("Failed to load history:", err);
        } finally {
          setLoading(false);
        }
      }
      loadHistory();
    }
  }, [isOpen, applicationId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-100">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 leading-tight">
              Audit Trail
            </h3>
            <p className="text-sm text-slate-500 font-medium">
              {" "}
              Journey: {candidateName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-200"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#1a56db] border-t-transparent mb-4"></div>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                Retrieving Logs...
              </p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">
                No history found for this application.
              </p>
            </div>
          ) : (
            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-slate-100 before:via-slate-200 before:to-transparent">
              {history.map((item, idx) => (
                <div key={item.id} className="relative flex items-start group">
                  <div
                    className={`mt-1.5 h-10 w-10 rounded-full border-4 border-white flex items-center justify-center shrink-0 z-10 shadow-sm ${
                      idx === history.length - 1
                        ? "bg-[#1a56db]"
                        : "bg-slate-200"
                    }`}
                  >
                    <Clock
                      className={`h-4 w-4 ${idx === history.length - 1 ? "text-white" : "text-slate-500"}`}
                    />
                  </div>

                  <div className="ml-6 flex-1 bg-slate-50/50 p-5 rounded-2xl border border-slate-100 group-hover:bg-white group-hover:shadow-md transition-all group-hover:-translate-y-0.5">
                    <div className="flex items-center justify-between mb-2">
                      <time className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {new Date(item.created_at).toLocaleString()}
                      </time>
                      <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-600 truncate max-w-25">
                          {item.users?.email.split("@")[0]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      {item.old_status ? (
                        <>
                          <span className="text-xs font-bold text-slate-400 uppercase">
                            {item.old_status}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-300" />
                        </>
                      ) : null}
                      <span className="text-xs font-black text-[#1a56db] uppercase tracking-wide bg-blue-50 px-2 py-0.5 rounded-md border border-[#1a56db]/20">
                        {item.new_status}
                      </span>
                    </div>

                    {item.reason && (
                      <div className="flex gap-2 bg-white p-3 rounded-xl border border-slate-100/50 italic">
                        <MessageSquare className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">
                          {item.reason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-white border-2 border-slate-200 text-slate-700 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}
