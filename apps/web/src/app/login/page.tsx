"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useVoice } from "@/hooks/useVoice";
import { extractNameFromEmail } from "@/utils/emailValidation";

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
    async function checkSession() {
      const token = awsAuth.getToken();
      if (token) {
        // If already logged in, run the post-login handshake to find where they belong
        try {
          const handshake = await apiClient.post(
            "/auth/post-login",
            {},
            token,
          );
          router.replace(handshake.next_step);
        } catch (err) {
          console.error("Handshake failed during session check:", err);
          // Don't auto-logout here, let the user stay on the page or try again
        }
      }
    }

    if (state === "INITIAL" && !initialized.current) {
      initialized.current = true;
      checkSession().then(() => {
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
        setEmail(workingInput.toLowerCase().trim());
        const name = extractNameFromEmail(workingInput);
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
          } else if (errorMessage.includes("incorrect")) {
            addMessage("Password is incorrect. Type 'forgot password' to reset it.", "bot");
            setState("AWAITING_EMAIL");
          } else {
            addMessage(errorMessage, "bot");
            setState("AWAITING_EMAIL");
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
    <div className="flex flex-col h-screen bg-slate-50">
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
          Logout / Clear Session
        </button>
      </header>

      {/* Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full scroll-smooth"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                msg.sender === "user"
                  ? "bg-blue-600 text-white rounded-tr-none"
                  : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"
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
      <div className="p-4 bg-white border-t sm:p-6 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
        <form
          onSubmit={handleSend}
          className="max-w-3xl mx-auto flex items-center gap-3 relative"
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
            className="p-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed shadow-md shadow-primary-light"
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
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

