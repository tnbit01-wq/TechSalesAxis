"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Save, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      setStatus("ERROR");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      setStatus("ERROR");
      return;
    }

    setLoading(true);
    setStatus("IDLE");

    try {
      // In the new flow, we might need a token from the URL
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const email = params.get("email");

      if (!token || !email) {
        throw new Error("Invalid reset link. Please request a new one.");
      }

      await apiClient.post("/auth/reset-password", { 
        email,
        token,
        new_password: password 
      });

      setStatus("SUCCESS");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reset password. Link may be expired.");
      setStatus("ERROR");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl shadow-indigo-100/50">
        <div className="text-center mb-10">
          <div className="h-20 w-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-200 mb-6 rotate-3 hover:rotate-0 transition-transform">
            <Shield className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tight">
            Reset <span className="text-indigo-600">Access</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">
            Protocol: Credential Synchronization
          </p>
        </div>

        {status === "SUCCESS" ? (
          <div className="space-y-6 text-center animate-in fade-in zoom-in duration-500">
            <div className="h-16 w-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-500">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase">Password Synchronized</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Your credentials have been updated. Redirecting to login...
              </p>
            </div>
            <button 
              onClick={() => router.push("/login")}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2"
            >
              Go to Login <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Password</label>
              <div className="relative">
                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-4 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirm New Password</label>
              <div className="relative">
                <Shield className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input 
                  type="password"
                  required
                  placeholder="Repeat protocol password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-4 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                />
              </div>
            </div>

            {status === "ERROR" && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600 animate-shake">
                <AlertCircle size={18} />
                <span className="text-[9px] font-black uppercase tracking-widest">{errorMessage}</span>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all flex items-center justify-center gap-3"
            >
              {loading ? "Synchronizing..." : "Update Credentials"}
              <Save size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
