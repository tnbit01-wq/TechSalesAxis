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
        
        if (error === "blocked") {
          addMessage("CRITICAL SECURITY ALERT: Your account has been permanently blocked for security violations. Access denied.", "bot");
          addMessage("Please contact support@techsalesaxis.ai for recovery options.", "bot");
        } else {
          addMessage("Welcome back! Please enter your email to sign in.", "bot");
        }
        setState("AWAITING_EMAIL");
      });
    }
  }, [state, router]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const workingInput = input.trim();
    if (!workingInput || isLoading) return;

    addMessage(workingInput, "user");
    setInput("");
    setIsLoading(true);

    if (workingInput.toLowerCase().includes("forgot password") || workingInput.toLowerCase() === "reset") {
      addMessage("Protocol Recovery Initiated. Please enter your registered email to receive a reset link.", "bot");
      setState("FORGOT_PASSWORD");
      setIsLoading(false);
      return;
    }

    try {
      if (state === "FORGOT_PASSWORD") {
        const resetEmail = workingInput.toLowerCase();
        try {
          await apiClient.post("/auth/forgot-password", { email: resetEmail });
          addMessage("Recovery signal transmitted. Check your inbox for the reset link.", "bot");
          addMessage("Would you like to try logging in again? Tell me your email.", "bot");
          setState("AWAITING_EMAIL");
        } catch (err: any) {
          addMessage(`Recovery failed: ${err.message}`, "bot");
          addMessage("Please check the email and try again.", "bot");
        }
        return;
      }

      if (state === "AWAITING_EMAIL") {
        setEmail(workingInput.toLowerCase().trim());
        const name = extractNameFromEmail(workingInput);
        addMessage(`Got it, ${name}. Now, please enter your password.`, "bot");
        setState("AWAITING_PASSWORD");
      } else if (state === "AWAITING_PASSWORD") {
        try {
          const authRes = await awsAuth.login(email, workingInput);
          addMessage(
            "Success! Synchronizing with the TechSales Axis security layer...",
            "bot",
          );

          try {
            const handshake = await apiClient.post(
              "/auth/post-login",
              {},
              authRes.access_token,
            );

            addMessage(
              `Verified. Redirecting you to your ${handshake.role} dashboard...`,
              "bot",
            );
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
                "CRITICAL SECURITY ALERT: Your account has been permanently blocked for security violations. Access denied.",
                "bot",
              );
              addMessage("Please contact support@techsalesaxis.ai if you believe this is an error.", "bot");
              awsAuth.logout();
            } else {
              const errorMessage = err instanceof Error ? err.message : "Unknown error";
              addMessage(
                `Security handshake failed: ${errorMessage}. Please contact support.`,
                "bot",
              );
            }
          }
        } catch (err: any) {
          addMessage(
            `Login failed: ${err.message}. Please check your credentials and try again.`,
            "bot",
          );
          addMessage("Lost your password? Just type 'forgot password' or tell me your email again.", "bot");
          setState("AWAITING_EMAIL");
        }
      }
    } catch {
      addMessage("Something went wrong. Let's try that again.", "bot");
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
                  ? "bg-primary text-white rounded-tr-none"
                  : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
              }`}
            >
              <p className="text-sm leading-relaxed">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1 animate-pulse">...</div>
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
            type={state === "AWAITING_PASSWORD" ? "password" : "text"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading || state === "COMPLETED"}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
          />

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

