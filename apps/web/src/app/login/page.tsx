"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useVoice } from "@/hooks/useVoice";
import { usePageMount } from "@/hooks/usePageLoad";
import { extractNameFromEmail, isValidEmail } from "@/utils/emailValidation";

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

  const { isListening, transcript, startListening, stopListening, hasSupport } =
    useVoice();

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

  // Initialize page only once when mounted (not on state changes)
  usePageMount(async () => {
    const token = awsAuth.getToken();
    if (token) {
      // User has a token, but check if they came here intentionally
      // Only auto-redirect if from_app param is set (comes from the app)
      const urlParams = new URLSearchParams(window.location.search);
      const fromApp = urlParams.get("from_app");
      
      if (fromApp) {
        // Came from app - redirect to next step
        try {
          const handshake = await apiClient.post(
            "/auth/post-login",
            {},
            token,
          );
          router.replace(handshake.next_step);
        } catch (err) {
          console.error("Handshake failed during session check:", err);
        }
        return;
      }
      // No from_app param - they came here intentionally, let them stay
    }

    // No token or intentional visit - proceed with login initialization
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    const emailParam = urlParams.get("email") || sessionStorage.getItem("tf_login_email_handoff");
    
    if (error === "blocked") {
      addMessage("CRITICAL SECURITY ALERT: Your account has been permanently blocked for security violations. Access denied.", "bot");
      addMessage("Please contact support@techsalesaxis.ai for recovery options.", "bot");
      setState("AWAITING_EMAIL");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (emailParam) {
      // Email passed from signup (incomplete or already registered)
      const decodedEmail = decodeURIComponent(emailParam);
      sessionStorage.removeItem("tf_login_email_handoff");
      setEmail(decodedEmail);
      const name = extractNameFromEmail(decodedEmail);
      addMessage(`Hi ${name}. Now please enter your password.`, "bot");
      setState("AWAITING_PASSWORD");
      // Clean URL after processing
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      addMessage("Welcome back! Please enter your email to sign in.", "bot");
      setState("AWAITING_EMAIL");
    }
  });

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
        
        // Validate email format for password reset
        if (!isValidEmail(resetEmail)) {
          addMessage(
            "Invalid email format. Please enter a valid email address to reset your password.",
            "bot"
          );
          setIsLoading(false);
          return;
        }
        
        try {
          await apiClient.post("/auth/forgot-password", { email: resetEmail });
          addMessage("Password reset email has been sent. Please check your inbox for further instructions.", "bot");
          addMessage("Follow the link in the email to reset your password and sign in.", "bot");
          setState("AWAITING_EMAIL");
        } catch (err: any) {
          addMessage(
            "Unable to send password reset email. Please verify the email address exists in our system.",
            "bot"
          );
          addMessage("If you don't have an account, you can sign up or try with another email address.", "bot");
          setState("AWAITING_EMAIL");
        }
        return;
      }

      if (state === "AWAITING_EMAIL") {
        const trimmedInput = workingInput.toLowerCase().trim();
        
        // Validate email format
        if (!isValidEmail(trimmedInput)) {
          addMessage(
            "Invalid email format. Please enter a valid email address.",
            "bot"
          );
          setIsLoading(false);
          return;
        }
        
        setEmail(trimmedInput);
        const name = extractNameFromEmail(trimmedInput);
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
          if (errorMessage.includes("No account found")) {
            addMessage("You don't have an account yet. Creating one...", "bot");
            // Redirect to signup with email and role params
            setTimeout(() => {
              router.replace(`/signup?email=${encodeURIComponent(email)}`);
            }, 1500);
          } else if (errorMessage.includes("incomplete")) {
            // Account exists but signup not completed - redirect to signup to set password
            addMessage(
              "Your account signup is incomplete. Let me take you to complete it and set your password.",
              "bot"
            );
            setTimeout(() => {
              router.replace(`/signup?email=${encodeURIComponent(email)}`);
            }, 2000);
          } else if (errorMessage.includes("incorrect")) {
            addMessage(
              "Incorrect password. Please try again or type 'forgot password' to reset your password.",
              "bot"
            );
            setState("AWAITING_PASSWORD");
          } else {
            addMessage(errorMessage, "bot");
            setState("AWAITING_PASSWORD");
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
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-hero-badge">TechSalesAxis Access</div>
        <div className="auth-hero-brand">
          <img src="/images/talentflow-logo.png" alt="TechSalesAxis" className="auth-hero-logo" />
          <div>
            <div className="auth-hero-kicker">Secure Sign In</div>
            <h1>Sign in securely to continue in the right workspace.</h1>
          </div>
        </div>
        <p className="auth-hero-copy">
          One sign-in serves both candidate and recruiter accounts. We read the email type, route you correctly, and keep the process simple.
        </p>
        <div className="auth-hero-points">
          <div>
            <span>01</span>
            <p><strong>Enter email</strong>Use the address linked to your account.</p>
          </div>
          <div>
            <span>02</span>
            <p><strong>Smart routing</strong>The email type tells us whether you are a recruiter or candidate.</p>
          </div>
          <div>
            <span>03</span>
            <p><strong>Continue securely</strong>After password validation, you move to onboarding or dashboard.</p>
          </div>
        </div>
      </aside>

      <div className="auth-panel">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-primary"
              aria-label="Back to home"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <div className="h-4 w-4 rounded-sm bg-white rotate-45" />
              </div>
              <span className="font-bold text-slate-900 tracking-tight">
                TechSales Axis Sign In
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

        {/* Chat Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 w-full scroll-smooth"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
                <div
                className={`max-w-[calc(100%-1rem)] rounded-[1.1rem] px-4 py-3 shadow-sm ${
                  msg.sender === "user"
                    ? "bg-gradient-to-r from-[#ff9800] to-[#ff6f00] text-white rounded-tr-[0.4rem]"
                    : "bg-gradient-to-b from-white to-[#fff8ee] text-slate-900 border border-orange-100 rounded-tl-[0.4rem]"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gradient-to-b from-white to-[#fff8ee] border border-orange-100 rounded-[1.1rem] rounded-tl-[0.4rem] px-4 py-3 shadow-sm">
                <div className="flex gap-1 animate-pulse text-slate-600">...</div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t sm:p-6 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
          <form
            onSubmit={handleSend}
            className="flex items-end gap-3 relative w-full"
          >
            <input
              type={state === "AWAITING_PASSWORD" && !showPassword ? "password" : "text"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading || state === "COMPLETED"}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
            />

            {state === "AWAITING_PASSWORD" && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
                className="p-3 rounded-xl transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
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
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              } disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed`}
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
              className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed shadow-md shadow-blue-500/30 font-semibold"
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

      <style jsx>{`
        .auth-shell {
          height: 100dvh;
          min-height: 100dvh;
          padding: 1rem;
          display: grid;
          grid-template-columns: minmax(320px, 0.4fr) minmax(0, 0.6fr);
          gap: 1.25rem;
          overflow: hidden;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 12% 18%, rgba(255, 152, 0, 0.16) 0%, transparent 28%),
            radial-gradient(circle at 88% 82%, rgba(255, 152, 0, 0.1) 0%, transparent 28%),
            linear-gradient(135deg, #fffaf5 0%, #fff4e7 100%);
        }

        .auth-hero {
          border: 1px solid rgba(255, 152, 0, 0.22);
          border-radius: 1.35rem;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(255, 248, 238, 0.95) 100%);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
          padding: 1.3rem;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 0.85rem;
          overflow: hidden;
        }

        .auth-hero-badge {
          align-self: flex-start;
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #ff9800;
        }

        .auth-hero-brand {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }

        .auth-hero-logo {
          width: 3.5rem;
          height: 3.5rem;
          object-fit: contain;
          mix-blend-mode: multiply;
        }

        .auth-hero-kicker {
          font-size: 0.8rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.35rem;
        }

        .auth-hero h1 {
          margin: 0;
          font-size: clamp(1.45rem, 2vw, 2.1rem);
          line-height: 1.08;
          color: #000;
          max-width: 15ch;
        }

        .auth-hero-copy {
          margin: 0;
          font-size: 0.82rem;
          line-height: 1.4;
          color: #334155;
          max-width: 28rem;
        }

        .auth-hero-points {
          display: grid;
          gap: 0.6rem;
        }

        .auth-hero-points div {
          display: grid;
          grid-template-columns: 2.55rem 1fr;
          gap: 0.7rem;
          align-items: start;
          padding: 0.72rem 0.85rem;
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(255, 152, 0, 0.2);
        }

        .auth-hero-points span {
          width: 2.55rem;
          height: 2.55rem;
          border-radius: 0.85rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #111 0%, #2f2f2f 100%);
          color: #ff9800;
          font-weight: 800;
          letter-spacing: 0.06em;
        }

        .auth-hero-points p {
          margin: 0;
          color: #111;
          font-size: 0.78rem;
          line-height: 1.35;
        }

        .auth-hero-points p strong {
          display: block;
          margin-bottom: 0.12rem;
          font-size: 0.82rem;
          color: #000;
        }

        .auth-panel {
          min-width: 0;
          border: 1px solid rgba(255, 152, 0, 0.18);
          border-radius: 1.35rem;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
        }

        .auth-panel header {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 248, 238, 0.98) 100%);
          border-bottom: 1px solid rgba(255, 152, 0, 0.18);
          box-shadow: none;
        }

        .auth-panel .text-xs {
          background: rgba(255, 152, 0, 0.08);
          color: #000;
        }

        .auth-panel .flex-1.overflow-y-auto {
          background: radial-gradient(circle at top right, rgba(255, 152, 0, 0.06) 0%, transparent 32%), #fff;
        }

        .auth-panel .bg-white.border-t {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(255, 248, 238, 0.99) 100%);
          border-top: 1px solid rgba(255, 152, 0, 0.18);
        }

        .auth-panel input {
          border-color: rgba(255, 152, 0, 0.22);
          background: #fff;
        }

        .auth-panel input:focus {
          box-shadow: 0 0 0 2px rgba(255, 152, 0, 0.18);
        }

        .auth-panel button[type="submit"] {
          background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
          box-shadow: 0 10px 24px rgba(255, 152, 0, 0.24);
        }

        .auth-panel button[type="submit"]:hover {
          background: linear-gradient(135deg, #ffad33 0%, #ff8a00 100%);
        }

        .auth-panel .bg-slate-100 {
          background: rgba(17, 17, 17, 0.06);
          color: #111827;
        }

        .auth-panel .hover\\:text-primary:hover,
        .auth-panel .text-primary {
          color: #ff9800;
        }

        @media (max-width: 1100px) {
          .auth-shell {
            grid-template-columns: 1fr;
            height: auto;
            min-height: 100vh;
            overflow: visible;
          }

          .auth-hero {
            padding: 1.5rem;
          }

          .auth-hero h1 {
            max-width: none;
          }
        }

        @media (max-width: 640px) {
          .auth-shell {
            padding: 0.75rem;
          }

          .auth-hero-brand {
            align-items: flex-start;
          }

          .auth-panel header {
            padding-left: 1rem;
            padding-right: 1rem;
          }
        }
      `}</style>
    </div>
  );
}

export default function Page() {
  return <LoginForm />;
}

