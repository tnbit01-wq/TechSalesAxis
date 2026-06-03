"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useVoice } from "@/hooks/useVoice";
import {
  extractNameFromEmail,
  isPersonalEmail,
  isValidEmail,
} from "@/utils/emailValidation";

type Message = {
  id: string;
  text: string;
  sender: "bot" | "user";
  timestamp: Date;
};

type LoginState =
  | "INITIAL"
  | "AWAITING_EMAIL"
  | "AWAITING_PASSWORD"
  | "FORGOT_PASSWORD"
  | "COMPLETED";

function LoginForm() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<LoginState>("INITIAL");
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const { isListening, transcript, startListening, stopListening, hasSupport } =
    useVoice();

  const getSignupRoleFromEmail = (value: string) =>
    isPersonalEmail(value) ? "candidate" : "recruiter";

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const addMessage = (text: string, sender: "bot" | "user") => {
    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        text,
        sender,
        timestamp: new Date(),
      },
    ]);
  };

  useEffect(() => {
    async function checkSession(): Promise<boolean> {
      const token = awsAuth.getToken();
      if (token) {
        try {
          // Check if the user still needs to set a password
          const user = awsAuth.getUser();
          if (user?.email) {
            const checkRes = await apiClient.post("/auth/check-email", { email: user.email });
            if (!checkRes.exists) {
              // User has incomplete signup (no password set).
              // Clear the stale token so they can start fresh.
              localStorage.removeItem("tf_token");
              localStorage.removeItem("tf_user_email");
              return false; // Let normal login flow show
            }
          }

          // If already logged in, run the post-login handshake to find where they belong
          const handshake = await apiClient.post(
            "/auth/post-login",
            {},
            token,
          );
          router.replace(handshake.next_step);
          return true; // Handled — redirecting
        } catch (err) {
          console.error("Handshake failed during session check:", err);
        }
      }
      return false; // Not handled — show normal login
    }

    if (state === "INITIAL" && !initialized.current) {
      initialized.current = true;
      checkSession().then((handled) => {
        if (handled) return; // checkSession already took care of it

        // Check for error in URL (e.g. from tab-switch block)
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get("error");
        const emailParam = urlParams.get("email");
        
        if (error === "blocked") {
          addMessage("CRITICAL SECURITY ALERT: Your account has been permanently blocked for security violations. Access denied.", "bot");
          addMessage("Please contact support@techsalesaxis.ai for recovery options.", "bot");
          setState("AWAITING_EMAIL");
        } else if (emailParam) {
          // Email passed from signup (already registered) - clean URL
          window.history.replaceState({}, "", window.location.pathname);
          const decodedEmail = decodeURIComponent(emailParam);
          setEmail(decodedEmail);
          setInput(""); // Ensure input is clean
          const name = extractNameFromEmail(decodedEmail);
          addMessage(`Hi ${name}. Now please enter your password.`, "bot");
          setState("AWAITING_PASSWORD");
        } else {
          addMessage("Welcome back! Please enter your email to sign in.", "bot");
          setState("AWAITING_EMAIL");
        }
      });
    }
  }, [state, router]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const workingInput = input.trim();
    if (!workingInput || isLoading) return;

    // Mask password in chat, show other inputs normally
    if (state === "AWAITING_PASSWORD") {
      addMessage("••••••••••", "user");
    } else {
      addMessage(workingInput, "user");
    }
    setInput("");
    setIsLoading(true);

    if (workingInput.toLowerCase().includes("forgot password") || workingInput.toLowerCase() === "reset") {
      addMessage("Please enter your email to reset your password.", "bot");
      setState("FORGOT_PASSWORD");
      setIsLoading(false);
      return;
    }

    try {
      if (state === "FORGOT_PASSWORD") {
        const resetEmail = workingInput.toLowerCase();
        try {
          await apiClient.post("/auth/forgot-password", { email: resetEmail });
          addMessage("We've sent a reset link to your email. Check your inbox.", "bot");
          addMessage("Would you like to try signing in again?", "bot");
          setState("AWAITING_EMAIL");
        } catch (err: any) {
          addMessage(`We couldn't reset your password. Please try again.`, "bot");
          addMessage("Please check your email and try again.", "bot");
        }
        return;
      }

      if (state === "AWAITING_EMAIL") {
        const emailInput = workingInput.toLowerCase().trim();
        if (!isValidEmail(emailInput)) {
          addMessage("That doesn't look like a valid email address. Please enter a valid email (e.g. name@example.com).", "bot");
          setIsLoading(false);
          return;
        }

        // Check if account exists before asking for password
        try {
          const checkRes = await apiClient.post("/auth/check-email", { email: emailInput });
          if (!checkRes.exists) {
            addMessage("You don't have an account yet. Redirecting to sign up...", "bot");
            const signupRole = getSignupRoleFromEmail(emailInput);
            setTimeout(() => {
              router.replace(
                `/signup?email=${encodeURIComponent(emailInput)}&role=${signupRole}`,
              );
            }, 1500);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.error("Error checking email:", err);
          // If check fails, proceed and let the login endpoint handle it
        }

        setEmail(emailInput);
        const name = extractNameFromEmail(emailInput);
        addMessage(`Hi ${name}. Now please enter your password.`, "bot");
        setState("AWAITING_PASSWORD");
      } else if (state === "AWAITING_PASSWORD") {
        try {
          const authRes = await awsAuth.login(email, workingInput);
          addMessage(
            "Signing you in...",
            "bot",
          );

          try {
            const handshake = await apiClient.post(
              "/auth/post-login",
              {},
              authRes.access_token,
            );

            // Check if onboarding is complete based on next_step
            const isOnboardingComplete = handshake.next_step && handshake.next_step.includes("/dashboard");
            const message = isOnboardingComplete
              ? "Welcome! Taking you to your dashboard..."
              : "Welcome! Let's complete your profile...";

            addMessage(message, "bot");
            setState("COMPLETED");

            setTimeout(() => {
              router.replace(handshake.next_step);
            }, 2000);
          } catch (err: any) {
            // Enhanced blocked state handling - support both status code and message check
            const isBlocked = err.status === 403 || 
                             (err.message && (err.message.includes("blocked") || err.message.includes("security violations")));
            
            if (isBlocked) {
              addMessage(
                "Your account has been locked for security. Please contact support@techsalesaxis.ai.",
                "bot",
              );
              addMessage("If you believe this is a mistake, please contact us at support@techsalesaxis.ai.", "bot");
              awsAuth.logout();
            } else {
              const errorMessage = err instanceof Error ? err.message : "Unknown error";
              addMessage(
                `Something went wrong. Please try again or contact support.`,
                "bot",
              );
            }
          }
        } catch (err: any) {
          const errorMessage = err.message || "Login failed. Please try again.";
          if (errorMessage.includes("No account found") || errorMessage.includes("not verified") || errorMessage.includes("incomplete")) {
            addMessage("Your account setup isn't complete yet. Redirecting to sign up...", "bot");
            const signupRole = getSignupRoleFromEmail(email);
            setTimeout(() => {
              router.replace(
                `/signup?email=${encodeURIComponent(email)}&role=${signupRole}`,
              );
            }, 1500);
          } else if (errorMessage.includes("incorrect")) {
            addMessage("Password is incorrect. Please try again or type 'forgot password' to reset it.", "bot");
            // Stay in AWAITING_PASSWORD so user can retry without re-entering email
          } else {
            addMessage(errorMessage + " Please try again.", "bot");
            // Stay in AWAITING_PASSWORD to allow retry
          }
        }
      }
    } catch {
      addMessage("Something went wrong. Please try again.", "bot");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    awsAuth.logout();
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#fff9f5] via-[#fff8f0] to-[#ffe8d6]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100/30 px-6 py-4 flex items-center justify-between shadow-[0_8px_24px_rgba(255,152,0,0.08)]">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 hover:bg-orange-50 rounded-full transition-all text-orange-600 hover:text-orange-700"
            aria-label="Back to home"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-[#ff9800] to-[#ff6f00] flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-base">
              TechSales Axis
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-red-500 transition-colors"
        >
          Logout
        </button>
      </header>

      {/* 35/65 Split Layout */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[35%_65%] gap-6 overflow-hidden p-4 md:p-6">
        {/* Left Panel - Step Guide */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-sm overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Login</h2>
              <p className="text-sm text-slate-600">Secure Access to Your Account</p>
            </div>
            
            {/* Step 1 */}
            <div className={`p-4 rounded-xl transition-all ${state === "AWAITING_EMAIL" ? "bg-orange-50 border-2 border-orange-400" : state === "AWAITING_PASSWORD" || state === "COMPLETED" ? "bg-green-50 border-2 border-green-400" : "bg-slate-50 border-2 border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${state === "AWAITING_EMAIL" ? "bg-orange-400 text-white" : state === "AWAITING_PASSWORD" || state === "COMPLETED" ? "bg-green-400 text-white" : "bg-slate-300 text-slate-700"}`}>
                  {state === "AWAITING_PASSWORD" || state === "COMPLETED" ? "✓" : "1"}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-sm">Enter Email</h3>
                  <p className="text-xs text-slate-600 mt-1">Provide your registered email address</p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className={`p-4 rounded-xl transition-all ${state === "AWAITING_PASSWORD" ? "bg-orange-50 border-2 border-orange-400" : state === "COMPLETED" ? "bg-green-50 border-2 border-green-400" : "bg-slate-50 border-2 border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${state === "AWAITING_PASSWORD" ? "bg-orange-400 text-white" : state === "COMPLETED" ? "bg-green-400 text-white" : "bg-slate-300 text-slate-700"}`}>
                  {state === "COMPLETED" ? "✓" : "2"}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-sm">Enter Password</h3>
                  <p className="text-xs text-slate-600 mt-1">Verify your secure password</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className={`p-4 rounded-xl transition-all ${state === "COMPLETED" ? "bg-green-50 border-2 border-green-400" : "bg-slate-50 border-2 border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${state === "COMPLETED" ? "bg-green-400 text-white" : "bg-slate-300 text-slate-700"}`}>
                  {state === "COMPLETED" ? "✓" : "3"}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-sm">Access Dashboard</h3>
                  <p className="text-xs text-slate-600 mt-1">You're logged in and ready to go</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6 pt-6 border-t border-orange-100">
              <div className="text-xs font-semibold text-slate-600 mb-2">Progress</div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-[#ff9800] to-[#ff6f00] h-2 rounded-full transition-all duration-300"
                  style={{
                    width: state === "COMPLETED" ? "100%" : state === "AWAITING_PASSWORD" ? "66%" : "33%"
                  }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {state === "COMPLETED" ? "Complete" : state === "AWAITING_PASSWORD" ? "Step 2 of 3" : "Step 1 of 3"}
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel - Chat Interface */}
        <div className="flex flex-col bg-white/60 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-sm overflow-hidden">
          {/* Messages Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-5 scroll-smooth"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-4 shadow-sm ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-[#ff9800] to-[#ff6f00] text-white rounded-tr-none shadow-orange-500/20 font-medium"
                      : "bg-white text-slate-800 border border-orange-100/50 rounded-tl-none"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1 animate-pulse text-slate-600">...</div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white/80 border-t border-orange-100/30">
            <form
              onSubmit={handleSend}
              className="flex items-end gap-3 relative w-full"
            >
          <input
            type={state === "AWAITING_PASSWORD" && !showPassword ? "password" : "text"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={state === "AWAITING_PASSWORD" ? "Enter your password..." : "Enter your email..."}
            disabled={isLoading || state === "COMPLETED"}
            autoComplete="off"
            className="flex-1 bg-white border-2 border-orange-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed disabled:border-slate-200"
          />

          {state === "AWAITING_PASSWORD" && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="p-3 rounded-xl transition-all bg-orange-50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-4.803m5.596-3.856a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={isLoading || state === "COMPLETED" || !hasSupport}
            className={`p-3 rounded-xl transition-all ${
              isListening
                ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40"
                : "bg-orange-50 text-orange-600 hover:bg-orange-100"
            } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m8 0h-8m4-29a3 3 0 013 3v10a3 3 0 01-3 3 3 3 0 01-3-3V7a3 3 0 013-3z"
              />
            </svg>
          </button>

          <button
            type="submit"
            disabled={!input.trim() || isLoading || state === "COMPLETED"}
            className="p-3 bg-gradient-to-r from-[#ff9800] to-[#ff6f00] text-white rounded-xl hover:shadow-lg hover:shadow-orange-500/40 transition-all disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none shadow-md shadow-orange-500/30 font-semibold active:scale-95"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

