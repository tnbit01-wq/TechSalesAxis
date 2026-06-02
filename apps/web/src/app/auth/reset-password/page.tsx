"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Eye, EyeOff, Save, ArrowRight, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");

      if (!token) {
        throw new Error("Invalid reset link. Please request a new one.");
      }

      await apiClient.post("/auth/reset-password", { token, password });

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Gradient Orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl -z-10"></div>

      <div className="max-w-md w-full">
        {/* Card Container */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-1 shadow-2xl border border-orange-500/20">
          <div className="bg-slate-800 rounded-3xl p-10 backdrop-blur-xl">
            {/* Header Icon */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl blur-xl opacity-50"></div>
                <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-4 shadow-xl">
                  <KeyRound size={48} className="text-white" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            {status === "SUCCESS" ? (
              <div className="space-y-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="h-20 w-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                  <CheckCircle2 size={40} className="text-emerald-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white mb-2">Password Synchronized</h2>
                  <p className="text-sm text-slate-300">
                    Your credentials have been updated successfully.
                  </p>
                </div>
                <p className="text-xs text-slate-400">Redirecting to login...</p>
                <button
                  onClick={() => router.push("/login")}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-4 rounded-2xl text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all shadow-xl hover:shadow-2xl"
                >
                  Go to Login <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-black text-white uppercase tracking-tight mb-2">
                    Reset <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">Access</span>
                  </h1>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Create Your New Credentials
                  </p>
                </div>

                {/* New Password */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1">
                    New Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-orange-600/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-all"></div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" size={18} />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600/50 hover:border-orange-500/30 focus:border-orange-500 rounded-2xl pl-12 pr-12 py-4 text-sm font-semibold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all backdrop-blur-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-400 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-300 ml-1">
                    Confirm Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-orange-600/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-all"></div>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" size={18} />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        placeholder="Repeat new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600/50 hover:border-orange-500/30 focus:border-orange-500 rounded-2xl pl-12 pr-12 py-4 text-sm font-semibold text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all backdrop-blur-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-400 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Error Message */}
                {status === "ERROR" && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 animate-shake">
                    <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-bold uppercase tracking-widest text-red-300">{errorMessage}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-600 disabled:to-slate-700 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-2xl shadow-orange-600/30 hover:shadow-orange-600/50 transition-all flex items-center justify-center gap-3 disabled:cursor-not-allowed group"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Synchronizing...
                    </>
                  ) : (
                    <>
                      Update Credentials
                      <Save size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                {/* Security Note */}
                <div className="pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400 text-center">
                    🔒 Link expires in 1 hour • Keep your password secure
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-slate-400">
            Remember your password?{" "}
            <a href="/login" className="text-orange-400 hover:text-orange-300 font-bold transition-colors">
              Sign In
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

