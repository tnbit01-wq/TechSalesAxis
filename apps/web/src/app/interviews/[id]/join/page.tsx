"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/apiClient";
import { Video, Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export default function JoinMeetingTransitionPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = params.id as string;
  const role = searchParams.get("role") || "candidate";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  useEffect(() => {
    if (!id) {
      setStatus("error");
      setErrorMsg("Invalid interview reference code.");
      return;
    }

    const logAttendanceAndJoin = async () => {
      try {
        // Log attendance and retrieve the meeting URL via JSON endpoint
        const response = await apiClient.get(
          `/interviews/${id}/join-email?role=${role}&json=true`
        );

        if (response && response.meeting_link) {
          setMeetingLink(response.meeting_link);
          setStatus("success");
          
          // Auto redirect after 1.5 seconds
          const timer = setTimeout(() => {
            window.location.href = response.meeting_link;
          }, 1500);
          return () => clearTimeout(timer);
        } else {
          throw new Error("Could not retrieve meeting room link.");
        }
      } catch (err: any) {
        console.error("Attendance logging failed:", err);
        setStatus("error");
        setErrorMsg(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while preparing the meeting room."
        );
      }
    };

    // Run after a short aesthetic delay to let the loading animation shine
    const delayTimer = setTimeout(logAttendanceAndJoin, 800);
    return () => clearTimeout(delayTimer);
  }, [id, role]);

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_45%),linear-gradient(180deg,#FFFDFB 0%,#FFFFFF 100%)] px-4 py-8 font-sans">
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-[32px] border border-orange-100/80 shadow-[0_20px_50px_rgba(255,138,0,0.05)] p-8 text-center flex flex-col items-center">
        
        {/* Logo/Branding Header */}
        <div className="mb-8 select-none">
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
            TechSales<span className="text-[#FF8A00]">Axis</span>
          </h1>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 block">
            Virtual Interview Portal
          </span>
        </div>

        {status === "loading" && (
          <div className="space-y-6 w-full animate-in fade-in duration-300">
            <div className="relative flex items-center justify-center">
              {/* Pulsing Outer Radars */}
              <div className="absolute w-24 h-24 rounded-full bg-orange-100/30 animate-ping duration-1000" />
              <div className="absolute w-16 h-16 rounded-full bg-orange-100/50 animate-pulse duration-1000" />
              
              <div className="relative w-14 h-14 bg-gradient-to-tr from-[#FF8A00] to-[#FFB054] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-600/20 text-white">
                <Video className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Entering Meeting Room...
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                We are logging your attendance for verification and preparing the secure Jitsi session.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2 text-[#FF8A00]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-wider">
                Verifying Credentials
              </span>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-6 w-full animate-in zoom-in-95 duration-350">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Attendance Confirmed
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                Your check-in timestamp has been successfully recorded in the database.
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-100/80 rounded-2xl p-4 text-emerald-800 text-xs font-semibold leading-relaxed">
              Redirecting you to the secure call. If not redirected automatically, please click below.
            </div>

            <a
              href={meetingLink}
              className="w-full py-4 bg-slate-900 hover:bg-[#FF8A00] text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md"
            >
              Join Secure Call
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-6 w-full animate-in zoom-in-95 duration-350">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20 text-white">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-black text-slate-900 tracking-tight text-rose-600">
                Connection Protocol Error
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-xs mx-auto">
                We could not log you in or the meeting link has expired.
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-100/80 rounded-2xl p-4 text-rose-800 text-xs font-semibold leading-relaxed break-words text-left">
              <strong>Error Details:</strong> {errorMsg}
            </div>

            <button
              onClick={() => {
                window.close();
                // Fallback if closing window isn't allowed
                setTimeout(() => {
                  window.location.href = "https://www.techsalesaxis.com";
                }, 100);
              }}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all active:scale-[0.98]"
            >
              Close Window
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
