"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useVoice } from "@/hooks/useVoice";
import {
  isPersonalEmail,
  isValidEmail,
  extractNameFromEmail,
} from "@/utils/emailValidation";

type Message = {
  id: string;
  text: string;
  sender: "bot" | "user";
  timestamp: Date;
};

type SignupState =
  | "INITIAL"
  | "AWAITING_EMAIL"
  | "AWAITING_OTP"
  | "AWAITING_PASSWORD"
  | "COMPLETED";

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = searchParams.get("role") || "candidate";

  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<SignupState>("INITIAL");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
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
        try {
          const handshake = await apiClient.post(
            "/auth/post-login",
            {},
            token,
          );
          router.replace(handshake.next_step);
        } catch (err) {
          console.error("Handshake failed during session check:", err);
          // Don't auto-logout, allow them to continue signup or refresh
        }
      }
    }

    if (state === "INITIAL" && !initialized.current) {
      initialized.current = true;
      checkSession().then(() => {
        const greeting = `Hello! I'm your onboarding assistant. I see you want to join as a ${role}. What is your email address?`;
        addMessage(greeting, "bot");
        setState("AWAITING_EMAIL");
      });
    }
  }, [state, role, router]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const workingInput = input.trim();
    if (!workingInput || isLoading) return;

    addMessage(workingInput, "user");
    setInput("");
    setIsLoading(true);

    try {
      if (state === "AWAITING_EMAIL") {
        if (!isValidEmail(workingInput)) {
          addMessage(
            "That doesn't look like a valid email. Could you check it again?",
            "bot",
          );
        } else {
          const personal = isPersonalEmail(workingInput);
          if (role === "candidate" && !personal) {
            addMessage(
              "Candidates should use a personal email (like Gmail or Outlook). Please provide your personal email.",
              "bot",
            );
          } else if (role === "recruiter" && personal) {
            addMessage(
              "Recruiters must use a professional company email. Please provide your work email.",
              "bot",
            );
          } else {
            // Valid email logic
            try {
              await apiClient.post("/auth/validate-email", {
                email: workingInput.toLowerCase(),
                role,
              });

              const name = extractNameFromEmail(workingInput);
              setUserName(name);
              setEmail(workingInput.toLowerCase());

              addMessage(
                `Nice to meet you, ${name}! I'm sending a verification code to ${workingInput}. One moment...`,
                "bot",
              );

              try {
                await awsAuth.signup(workingInput.toLowerCase(), role);
                addMessage(
                  "Code sent! Please enter the 6-digit code from your email. (Check your spam folder if it doesn't appear in 1 minute)",
                  "bot",
                );
                setState("AWAITING_OTP");
              } catch (err: any) {
                console.error("AWS Auth Error:", err);
                addMessage(
                  `Sorry, I couldn't send the code: ${err.message}.`,
                  "bot",
                );
              }
            } catch (err) {
              const errorMessage =
                err instanceof Error ? err.message : "Email validation failed.";
              console.error("Validation Error:", err);
              addMessage(errorMessage, "bot");
            }
          }
        }
      } else if (state === "AWAITING_OTP") {
        if (workingInput.toLowerCase() === "resend") {
          setIsLoading(true);
          try {
            await awsAuth.signup(email, role);
            addMessage(
              "I've triggered a new code. Please check your inbox again.",
              "bot",
            );
          } catch (err: any) {
             addMessage(`Failed to resend: ${err.message}`, "bot");
          } finally {
            setIsLoading(false);
          }
          return;
        }

        try {
          const authRes = await awsAuth.verifyOtp(email, workingInput);
          addMessage(
            "Email verified! Your account is ready. Taking you to the next step...",
            "bot",
          );
          setState("COMPLETED");

          // Initialize profile in backend after verification
          setTimeout(async () => {
            try {
              const res = await apiClient.post(
                "/auth/initialize",
                {
                  role,
                  display_name: userName,
                },
                authRes.access_token,
              );
              router.replace(res.next_step);
            } catch (err: any) {
              console.error("Initialization Error:", err);
              router.replace("/onboarding");
            }
          }, 1500);
        } catch (err: any) {
          addMessage(
            "That code didn't work. Please try again or check your email.",
            "bot",
          );
        }
      }
    } catch {
      addMessage("Something went wrong. Let's try that again.", "bot");
    } finally {
      setIsLoading(false);
    }
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
              TechSales Axis Onboarding
            </span>
          </div>
        </div>
        <div className="text-xs font-medium text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
          {role} signup
        </div>
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
              <span className="text-[10px] opacity-50 mt-1 block text-right">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
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
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed"
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
            title={isListening ? "Stop listening" : "Start voice input"}
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
        <p className="max-w-3xl mx-auto mt-2 text-[10px] text-center text-slate-400 uppercase tracking-widest font-medium">
          Powered by TechSales Axis Trust Layer
        </p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}

