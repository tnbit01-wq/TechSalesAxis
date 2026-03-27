"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { 
  ChevronLeft, 
  Mic, 
  Send, 
  ShieldAlert, 
  Timer, 
  SkipForward, 
  Loader2,
  ArrowRight,
  MicOff,
  Square
} from "lucide-react";

type Question = {
  id?: string;
  text: string;
  category: string;
  driver: string;
  difficulty: string;
  keywords?: string[];
  action_verbs?: string[];
  connectors?: string[];
  status?: string;
};

type AssessmentSession = {
  candidate_id: string;
  current_step: number;
  total_budget: number;
  status: string;
  experience_band: string;
  warning_count?: number;
};

export default function AssessmentExam() {
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [session, setSession] = useState<AssessmentSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Tab switch detection
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden" && !showAadhaar && !isBlocked) {
        try {
          const token = awsAuth.getToken();
          if (!token) return;

          const res = await apiClient.post(
            "/assessment/tab-switch",
            {},
            token,
          );
          if (res.status === "blocked") {
            setIsBlocked(true);
          } else if (res.status === "warning") {
            setWarning(
              "FINAL WARNING: Tab switching is strictly prohibited. The next switch will permanently block your account.",
            );
          }
        } catch (err) {
          console.error("Tab switch detection error:", err);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [showAadhaar, isBlocked]);

  // Load Session & First Question
  useEffect(() => {
    async function init() {
      try {
        const user = awsAuth.getUser();
        const token = awsAuth.getToken();

        if (!user || !token) {
          router.replace("/login");
          return;
        }

        // Check if already blocked (middleware-like check)
        const profile = await apiClient.get("/candidate/profile", token);
        
        if (profile?.account_status === "Blocked") {
          setIsBlocked(true);
          setIsLoading(false);
          return;
        }

        // Check if identity is already verified (for retakes)
        const isVerified = profile?.identity_verified || false;
        setIdentityVerified(isVerified);

        const startRes = await apiClient.post(
          "/assessment/start",
          {},
          token,
        );

        if (startRes?.status === "completed") {
          if (isVerified) {
            router.replace("/dashboard/candidate");
          } else {
            setShowAadhaar(true);
          }
          setIsLoading(false);
          return;
        }

        if (startRes) {
          setSession(startRes);
        }

        const qRes = await apiClient.get(
          "/assessment/next",
          token,
        );
        if (qRes?.status === "completed") {
          if (isVerified) {
            router.replace("/dashboard/candidate");
          } else {
            setShowAadhaar(true);
          }
        } else {
          setCurrentQuestion(qRes);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [router]);

  const handleLogout = async () => {
    awsAuth.logout();
    router.replace("/login");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Microphone access denied. Please allow microphone permissions to record audio responses.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  // Recording timer
  useEffect(() => {
    if (!isRecording) return;

    const timer = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording]);

  const handleNext = useCallback(
    async (isTimeout = false) => {
      if (isLoading || isFinishing) return;
      setIsLoading(true);

      try {
        const token = awsAuth.getToken();
        if (!token) return;

        // Stop recording if still active
        if (isRecording) {
          stopRecording();
        }

        // Submit answer
        let audioBase64 = null;
        if (audioBlob) {
          const reader = new FileReader();
          audioBase64 = await new Promise((resolve) => {
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.readAsDataURL(audioBlob);
          });
        }

        const submitRes = await apiClient.post(
          "/assessment/submit",
          {
            question_id: currentQuestion?.id,
            category: currentQuestion?.category,
            answer: isTimeout ? "" : answer,
            difficulty: currentQuestion?.difficulty,
            metadata: currentQuestion,
            audio_response: audioBase64 || null,
          },
          token,
        );

        // Update session progress immediately from submit response if available
        if (submitRes?.current_step && submitRes?.total_budget) {
            setSession(prev => prev ? {
                ...prev,
                current_step: submitRes.current_step,
                total_budget: submitRes.total_budget
            } : null);
        }

        // Check if session finished from the submit call
        if (submitRes?.session_status === "completed") {
             if (identityVerified) {
                setIsFinishing(true);
                router.replace("/dashboard/candidate");
                return;
             } else {
                setShowAadhaar(true);
                return;
             }
        }

        // Get next question
        const nextQ = await apiClient.get(
          "/assessment/next",
          token,
        );

        if (nextQ.status === "completed") {
          if (identityVerified) {
            setIsFinishing(true);
            router.replace("/dashboard/candidate");
          } else {
            setShowAadhaar(true);
          }
        } else {
          // Sync session progress again just in case
          if (nextQ.current_step && nextQ.total_budget) {
            setSession(prev => prev ? {
              ...prev,
              current_step: nextQ.current_step,
              total_budget: nextQ.total_budget
            } : prev);
          } else if (session) {
            setSession({
              ...session,
              current_step: (session.current_step || 0) + 1
            });
          }
          
          setCurrentQuestion(nextQ);
          setAnswer("");
          setAudioBlob(null);
          setRecordingTime(0);
          setTimeLeft(60);
        }
      } catch (err) {
        console.error("Submission error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, isFinishing, currentQuestion, answer, audioBlob, isRecording, identityVerified, router],
  );

  // Timer logic
  useEffect(() => {
    if (showAadhaar || isBlocked || !currentQuestion || isFinishing || isLoading) return;

    if (timeLeft <= 0) {
      handleNext(true); // Auto-jump on timeout
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, currentQuestion, showAadhaar, isBlocked, isFinishing, isLoading, handleNext]);

  const handleAadhaarUpload = async () => {
    if (!aadhaarFile) return;

    // Client-side size restriction (5MB)
    if (aadhaarFile.size > 5 * 1024 * 1024) {
      alert("Aadhaar file is too large! Maximum allowed is 5MB.");
      return;
    }

    setIsUploading(true);
    try {
      const user = awsAuth.getUser();
      if (!user) {
        alert("Session expired. Please login again.");
        router.replace("/login");
        return;
      }

      const token = awsAuth.getToken();
      if (!token) throw new Error("No session found");

      const formData = new FormData();
      formData.append("file", aadhaarFile);

      const data = await apiClient.post(
        "/storage/upload/aadhaar",
        formData,
        token,
      );

      const filePath = data.path;

      setIsFinishing(true);

      // Mark identity as verified in the profile
      await apiClient.patch(
        "/candidate/profile",
        { identity_verified: true, identity_proof_path: filePath },
        token,
      );

      await apiClient
        .get("/assessment/results", token)
        .catch(() => null);

      setTimeout(() => {
        router.replace("/dashboard/candidate");
      }, 1500);
    } catch (err: unknown) {
      console.error("Upload error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111] rounded-[32px] p-10 text-center shadow-2xl border border-red-900/30">
          <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <ShieldAlert size={40} className="text-red-500" />
          </div>
          <h1 className="text-2xl font-black text-white mb-4 tracking-tight">
            Account Permanently Blocked
          </h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            A security violation (tab switching) was detected. Due to our
            high-trust policy, you are permanently disqualified from using
            TechSales Axis.
          </p>
          <div className="text-[10px] font-black tracking-widest text-red-500 bg-red-500/5 p-4 rounded-2xl border border-red-500/10 mb-8 uppercase">
            This action is irreversible.
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-4 text-gray-500 hover:text-white font-black uppercase tracking-[0.3em] text-[10px] transition-all border border-white/5 rounded-2xl hover:bg-white/5"
          >
            LOGOUT SESSION
          </button>
        </div>
      </div>
    );
  }

  if (showAadhaar) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="max-w-xl w-full bg-[#111] rounded-[40px] p-12 shadow-2xl border border-white/5 text-center">
          <div className="h-20 w-20 bg-blue-600/10 rounded-[20px] flex items-center justify-center mx-auto mb-8">
            <div className="h-10 w-10 text-blue-500">
               <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
               </svg>
            </div>
          </div>
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">
            Assessment Complete!
          </h1>
          <p className="text-gray-400 mb-10 leading-relaxed text-lg">
            Your evaluation is complete. To finalize your high-trust profile, 
            upload a clear scan of your Aadhaar card for ID verification.
          </p>

          <div className="relative group mb-10">
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setAadhaarFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div
              className={`border-2 border-dashed rounded-3xl p-12 transition-all ${aadhaarFile ? "border-blue-500 bg-blue-500/5" : "border-white/10 bg-white/5 group-hover:bg-white/10"}`}
            >
              <div className="flex flex-col items-center gap-4">
                <svg
                  className={`h-12 w-12 ${aadhaarFile ? "text-blue-500" : "text-gray-600"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-black text-white tracking-wide">
                    {aadhaarFile ? aadhaarFile.name : "Secure Document Upload"}
                  </span>
                  <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                    PDF, JPG, or PNG (MAX 5MB)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleAadhaarUpload}
            disabled={!aadhaarFile || isUploading || isFinishing}
            className={`w-full py-5 rounded-2xl font-black text-sm tracking-[0.2em] transform transition-all active:scale-[0.98] ${!aadhaarFile ? "bg-gray-800 text-gray-500" : "bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-600/20"}`}
          >
            {isUploading
              ? "ENCRYPTING..."
              : isFinishing
                ? "PROFILE FINALIZED"
                : "COMPLETE REGISTRATION"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white selection:bg-blue-500 selection:text-white flex flex-col">
      {/* Dynamic Header (Modern Chat Look) */}
      <header className="sticky top-0 z-50 bg-[#0D0D0D]/90 backdrop-blur-xl border-b border-white/5 py-5 px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.back()} 
            className="p-2 -ml-2 text-gray-500 hover:text-white transition-colors rounded-full hover:bg-white/5"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 bg-blue-600 rounded-[14px] flex items-center justify-center shadow-2xl shadow-blue-900/40">
              <div className="h-5 w-5 bg-black rounded-md transform rotate-45" />
            </div>
            <span className="text-xl font-black tracking-[0.1em] text-white">TECHSALES AXIS</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Action Cluster (Timer & Skip) moved to Header for constant visibility */}
          {!isLoading && currentQuestion && (
            <div className="flex items-center gap-3">
               <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2.5">
                  <Timer size={14} className={timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-gray-500"} />
                  <span className={`font-mono text-xs font-black tracking-widest ${timeLeft <= 10 ? "text-red-500" : "text-white"}`}>
                     {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                  </span>
               </div>
               
               <button 
                onClick={() => handleNext(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-black text-[10px] tracking-[0.2em] uppercase transition-all shadow-lg shadow-blue-900/20 active:scale-95"
              >
                skip
              </button>
            </div>
          )}

          <div className="h-8 w-[1px] bg-white/10 hidden md:block" />

          {/* Subtle Progress HUD */}
          {session && !showAadhaar && (
            <div className="hidden lg:flex flex-col items-end gap-1.5 pt-1">
              <div className="flex items-center gap-3 text-[10px] font-black text-gray-400 tracking-[0.15em] uppercase">
                <span>Progress: {session?.current_step || 1} / {session?.total_budget || "--"}</span>
              </div>
              <div className="h-1 w-32 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(37,99,235,0.8)]"
                  style={{ width: `${((session?.current_step || 0) / (session?.total_budget || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="h-8 w-[1px] bg-white/10 hidden md:block" />

          <button
            onClick={handleLogout}
            className="text-[10px] font-black tracking-[0.2em] text-gray-500 hover:text-white transition-all uppercase px-4 py-2 hover:bg-white/5 rounded-lg"
          >
            LOGOUT
          </button>
        </div>
      </header>

      {/* Main Wide-Screen Viewport */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-8 pt-10 pb-48 flex flex-col gap-10">
        
        {/* Security Warning Banner */}
        {warning && (
          <div className="w-full bg-red-950/30 border border-red-500/30 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="h-10 w-10 flex items-center justify-center bg-red-500/20 rounded-xl text-red-500 shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black text-red-400 tracking-widest uppercase mb-0.5">Assessment Alert</p>
              <p className="text-sm font-bold text-red-200/70 leading-tight">{warning}</p>
            </div>
            <button 
              onClick={() => setWarning(null)} 
              className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            >
              &times;
            </button>
          </div>
        )}

        {/* Dynamic Chat Content Area */}
        <div className="relative flex-1 flex flex-col gap-8">
          
          {/* Action Cluster removed from here as it is now in the sticky header */}

          {/* Question Hub */}
          <div className="w-full space-y-4 animate-in fade-in duration-700">
            <div className="flex flex-col gap-2">
               <div className="flex items-center gap-3">
                 <div className="h-[2px] w-6 bg-blue-600" />
                 <span className="text-[10px] font-bold text-gray-500 tracking-[0.3em] uppercase">
                    SYSTEM_ORIGIN: ASSESSMENT_DRIVERS
                 </span>
               </div>
               
               <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-white leading-snug tracking-tight max-w-4xl">
                {currentQuestion?.text || "Awaiting neural synchronization..."}
               </h1>
            </div>
          </div>
        </div>
      </main>

      {/* Styled Sticky Footer with Chat Bar */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 pb-8 bg-gradient-to-t from-black via-black to-transparent pointer-events-none z-50">
        <div className="max-w-5xl mx-auto pointer-events-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-blue-500/10 rounded-[28px] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-700" />
          
          <div className="relative bg-[#0F0F0F] border border-white/10 group-focus-within:border-blue-500/40 rounded-3xl overflow-hidden transition-all duration-300">
            <textarea
              autoFocus
              disabled={isLoading || !currentQuestion}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your strategic response..."
              className="w-full h-32 bg-transparent p-6 pr-44 text-base md:text-lg font-medium text-white placeholder:text-gray-700 focus:outline-none resize-none transition-all"
            />
            
            {/* Unified Control Bar on Right (Matching Image) */}
            <div className="absolute right-6 bottom-6 flex items-center gap-4">
              {isRecording ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/20 rounded-xl boundary border-red-500/50">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-red-400">{recordingTime}s</span>
                </div>
              ) : null}
              
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || !currentQuestion}
                className={`p-2.5 rounded-xl transition-all ${
                  isRecording
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20"
                    : "text-gray-700 hover:text-white hover:bg-white/5"
                }`}
                title={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? (
                  <Square size={20} fill="currentColor" />
                ) : (
                  <Mic size={20} />
                )}
              </button>
              
              <button
                onClick={() => handleNext(false)}
                disabled={!answer.trim() || isLoading}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-xs tracking-widest uppercase transition-all shadow-2xl ${
                  !answer.trim() || isLoading 
                    ? "bg-gray-800/10 text-gray-700" 
                    : "bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-600/20 shadow-blue-900/40"
                }`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <>
                    <span className="hidden sm:inline">Submit</span>
                    <Send size={16} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Minimal metadata footer */}
          <div className="mt-4 flex justify-between items-center px-4 pb-2 opacity-60">
             <div className="flex gap-4 text-[10px] font-bold text-gray-600 tracking-widest uppercase">
                <span className="flex items-center gap-2">
                   <div className="h-1 w-1 bg-blue-600 rounded-full animate-pulse" />
                   EVALUATION_MODE: ACTIVE
                </span>
                <span className="flex items-center gap-2">
                   <div className="h-1 w-1 bg-gray-500 rounded-full" />
                   ENCRYPTION: SHIELD-v3.0-AES-256
                </span>
             </div>
             <span className="text-[10px] font-bold text-gray-700 tracking-widest uppercase">
                &copy; 2026 TECHSALES AXIS AI
             </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
