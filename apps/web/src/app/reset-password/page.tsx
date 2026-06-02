"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await apiClient.post("/auth/reset-password", {
        token,
        password,
      });

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.replace("/login");
      }, 2000);
    } catch (err: any) {
      const errorMsg =
        err.message || "Failed to reset password. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-2 group-hover:shadow-lg transition-all">
            <KeyRound size={24} className="text-white" />
          </div>
          <span className="text-2xl font-bold text-slate-900">TechSales Axis</span>
        </Link>
        <Link href="/login" className="text-orange-600 hover:text-orange-700 font-medium transition-colors">
          Back to Login
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
            {/* Gradient Top Bar */}
            <div className="h-1.5 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>

            {/* Content */}
            <div className="p-8">
              {success ? (
                <div className="space-y-6 text-center animate-in fade-in duration-500">
                  <div className="flex justify-center">
                    <div className="bg-emerald-50 rounded-full p-4 border border-emerald-100">
                      <CheckCircle size={48} className="text-emerald-600" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Password Reset Successful
                    </h2>
                    <p className="text-slate-600 text-sm">
                      Your password has been updated. Redirecting you to login...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="space-y-2">
                    <h1 className="text-3xl font-bold text-slate-900">
                      Reset Password
                    </h1>
                    <p className="text-slate-600 text-sm">
                      Enter your new password to regain access to your account.
                    </p>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3.5 top-3 text-slate-400" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-3">
                        <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-red-700 text-sm font-medium">{error}</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-3 rounded-lg transition-all shadow-md hover:shadow-lg disabled:shadow-none flex items-center justify-center gap-2 group"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Resetting...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound size={18} />
                          <span>Reset Password</span>
                        </>
                      )}
                    </button>
                  </form>

                  {/* Footer */}
                  <div className="pt-4 border-t border-slate-100 text-center">
                    <p className="text-slate-600 text-sm">
                      Remember your password?{" "}
                      <Link href="/login" className="text-orange-600 hover:text-orange-700 font-semibold transition-colors">
                        Sign in
                      </Link>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security Note */}
          <div className="mt-6 bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-xs text-slate-600 text-center">
              🔒 This link will expire in 1 hour for security. Keep your password secure and never share it.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
