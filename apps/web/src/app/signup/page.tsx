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
  | "AWAITING_OTP_TRIGGER"
  | "AWAITING_OTP"
  | "AWAITING_PASSWORD_SET"
  | "COMPLETED";

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get("email");
  const role =
    searchParams.get("role") ||
    (emailParam ? (isPersonalEmail(emailParam) ? "candidate" : "recruiter") : "candidate");

  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<SignupState>("INITIAL");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const { isListening, transcript, startListening, stopListening, hasSupport } =
    useVoice();

  // Auto-trigger signup when email is passed from login
  useEffect(() => {
    const autoSignup = async () => {
      if (state === "AWAITING_OTP_TRIGGER" && email && userName) {
        setIsLoading(true);
        try {
          await apiClient.post("/auth/validate-email", {
            email: email,
            role,
          });

          try {
            await awsAuth.signup(email, role, userName);
            addMessage(
              "We've sent a verification code to your email. Please enter the 6-digit code.",
              "bot",
            );
            setState("AWAITING_OTP");
          } catch (err: any) {
            const errorMsg = err.message || "An error occurred";
            addMessage(
              `We couldn't send the code. Please try again.`,
              "bot",
            );
            setState("AWAITING_EMAIL");
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Email validation failed.";
          addMessage(errorMessage, "bot");
          setState("AWAITING_EMAIL");
        } finally {
          setIsLoading(false);
        }
      }
    };

    autoSignup();
  }, [state, email, userName, role]);

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
              // User is verified but hasn't set a password (incomplete signup).
              // Clear the stale token so they can start fresh.
              localStorage.removeItem("tf_token");
              localStorage.removeItem("tf_user_email");
              return false; // Let normal init flow run — user will re-signup
            }
          }

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
      return false; // Not handled — run normal init
    }

    if (state === "INITIAL" && !initialized.current) {
      initialized.current = true;
      checkSession().then((handled) => {
        if (handled) return; // checkSession already took care of the state

        // Check if email was passed from login (account not found)
        if (emailParam) {
          // Auto-start signup with provided email
          window.history.replaceState({}, "", window.location.pathname + `?role=${role}`);
          const name = extractNameFromEmail(emailParam);
          setUserName(name);
          setEmail(emailParam);
          addMessage(`Welcome ${name}! Let's set up your account. Sending verification code...`, "bot");
          // Trigger signup with the email
          setState("AWAITING_OTP_TRIGGER");
        } else {
          const greeting = `Welcome! Let's get you started. Please enter your email address.`;
          addMessage(greeting, "bot");
          setState("AWAITING_EMAIL");
        }
      });
    }
  }, [state, role, router, searchParams]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const workingInput = input.trim();
    if (!workingInput || isLoading) return;

    // Mask password and OTP in chat for security - show dots instead of actual values
    if (state === "AWAITING_PASSWORD_SET") {
      addMessage("••••••••••", "user");
    } else if (state === "AWAITING_OTP" && workingInput.toLowerCase() !== "resend") {
      addMessage("••••••", "user");
    } else {
      addMessage(workingInput, "user");
    }
    setInput("");
    setIsLoading(true);

    try {
      if (state === "AWAITING_EMAIL") {
        if (!isValidEmail(workingInput)) {
          addMessage(
            "Please enter a valid email address.",
            "bot",
          );
        } else {
          const personal = isPersonalEmail(workingInput);
          if (role === "candidate" && !personal) {
            addMessage(
              "Please use your personal email (like Gmail or Outlook).",
              "bot",
            );
          } else if (role === "recruiter" && personal) {
            addMessage(
              "Please use your company email address.",
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

              try {
                await awsAuth.signup(workingInput.toLowerCase(), role, name);
                addMessage(
                  "We've sent a verification code to your email. Please enter the 6-digit code. If you don't see it soon, check your spam folder or type 'resend' for a new code.",
                  "bot",
                );
                setState("AWAITING_OTP");
              } catch (err: any) {
                const errorMsg = err.message || "An error occurred";
                
                // Don't log console errors for expected validation errors
                if (!errorMsg.includes("already registered")) {
                  console.error("AWS Auth Error:", err);
                }
                
                // Provide specific guidance based on error
                if (errorMsg.includes("already registered")) {
                  addMessage(
                    "You already have an account. Redirecting to sign in...",
                    "bot",
                  );
                  // Store email temporarily and redirect to login
                  setTimeout(() => {
                    const email = workingInput.toLowerCase();
                    router.replace(`/login?email=${encodeURIComponent(email)}`);
                  }, 1500);
                } else {
                  addMessage(
                    `We couldn't send the code. Please try again or use a different email.`,
                    "bot",
                  );
                }
              }
            } catch (err) {
              const errorMessage =
                err instanceof Error ? err.message : "We couldn't verify this email.";
              console.error("Validation Error:", err);
              addMessage(errorMessage, "bot");
            }
          }
        }
      } else if (state === "AWAITING_OTP") {
        if (workingInput.toLowerCase() === "resend") {
          setIsLoading(true);
          try {
            await awsAuth.resendOtp(email, role);
            addMessage(
              "We've sent you a new verification code. Check your email. It's valid for 2 minutes.",
              "bot",
            );
          } catch (err: any) {
            const errorMsg = err.message || "An error occurred";
            addMessage(
              `We couldn't send a new code. Please try again.`,
              "bot",
            );
          } finally {
            setIsLoading(false);
          }
          return;
        }

        try {
          const authRes = await awsAuth.verifyOtp(email, workingInput);
          addMessage(
            "Great! Your email is verified. Now please create a password (at least 8 characters).",
            "bot",
          );
          setState("AWAITING_PASSWORD_SET");
        } catch (err: any) {
          const errorMsg = err.message || "An error occurred";
          
          // Check for specific error messages and provide guidance
          if (errorMsg.includes("expired")) {
            addMessage(
              `${errorMsg}`,
              "bot",
            );
          } else if (errorMsg.includes("incorrect")) {
            addMessage(
              `${errorMsg}`,
              "bot",
            );
          } else {
            addMessage(
              "That code doesn't match. Please try again or type 'resend' for a new code.",
              "bot",
            );
          }
        }
      } else if (state === "AWAITING_PASSWORD_SET") {
        const password = workingInput.trim();
        if (password.length < 8) {
          addMessage(
            "Your password needs to be at least 8 characters. Please try again.",
            "bot",
          );
          setIsLoading(false);
          return;
        }

        try {
          // Update user's password in the backend
          const token = awsAuth.getToken();
          if (token) {
            await apiClient.post(
              "/auth/update-password",
              { new_password: password },
              token,
            );
          }

          addMessage(
            "Perfect! Your account is ready. Taking you to sign in...",
            "bot",
          );
          setState("COMPLETED");

          // After password set, redirect to login
          setTimeout(() => {
            router.replace("/login");
          }, 1500);
        } catch (err: any) {
          addMessage(
            `We couldn't create your password. Please try again.`,
            "bot",
          );
        }
      }
    } catch {
      addMessage("Something went wrong. Please try again.", "bot");
    } finally {
      setIsLoading(false);
    }
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
        <div className="text-xs font-semibold text-orange-700 uppercase tracking-widest bg-orange-100/60 px-3 py-1.5 rounded-lg">
          {role} signup
        </div>
      </header>

      {/* 35/65 Split Layout */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[35%_65%] gap-6 overflow-hidden p-4 md:p-6">
        {/* Left Panel - Step Guide */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-orange-100/50 shadow-sm overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">Signup</h2>
              <p className="text-sm text-slate-600">Create Your {role === "candidate" ? "Candidate" : "Recruiter"} Account</p>
            </div>
            
            {/* Step 1 - Email */}
            <div className={`p-4 rounded-xl transition-all ${state === "AWAITING_EMAIL" || state === "AWAITING_OTP_TRIGGER" ? "bg-orange-50 border-2 border-orange-400" : state !== "INITIAL" ? "bg-green-50 border-2 border-green-400" : "bg-slate-50 border-2 border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${state === "AWAITING_EMAIL" || state === "AWAITING_OTP_TRIGGER" ? "bg-orange-400 text-white" : state !== "INITIAL" ? "bg-green-400 text-white" : "bg-slate-300 text-slate-700"}`}>
                  {state !== "INITIAL" && state !== "AWAITING_EMAIL" && state !== "AWAITING_OTP_TRIGGER" ? "✓" : "1"}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-sm">Email Registration</h3>
                  <p className="text-xs text-slate-600 mt-1">Provide your email address</p>
                </div>
              </div>
            </div>

            {/* Step 2 - OTP */}
            <div className={`p-4 rounded-xl transition-all ${state === "AWAITING_OTP" ? "bg-orange-50 border-2 border-orange-400" : state === "AWAITING_PASSWORD_SET" || state === "COMPLETED" ? "bg-green-50 border-2 border-green-400" : "bg-slate-50 border-2 border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${state === "AWAITING_OTP" ? "bg-orange-400 text-white" : state === "AWAITING_PASSWORD_SET" || state === "COMPLETED" ? "bg-green-400 text-white" : "bg-slate-300 text-slate-700"}`}>
                  {state === "AWAITING_PASSWORD_SET" || state === "COMPLETED" ? "✓" : "2"}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-sm\">Verify OTP</h3>
                  <p className="text-xs text-slate-600 mt-1">Enter verification code</p>
                </div>
              </div>
            </div>

            {/* Step 3 - Password */}
            <div className={`p-4 rounded-xl transition-all ${state === "AWAITING_PASSWORD_SET" ? "bg-orange-50 border-2 border-orange-400" : state === "COMPLETED" ? "bg-green-50 border-2 border-green-400" : "bg-slate-50 border-2 border-slate-200"}`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${state === "AWAITING_PASSWORD_SET" ? "bg-orange-400 text-white" : state === "COMPLETED" ? "bg-green-400 text-white" : "bg-slate-300 text-slate-700"}`}>
                  {state === "COMPLETED" ? "✓" : "3"}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 text-sm">Set Password</h3>
                  <p className="text-xs text-slate-600 mt-1">Create a secure password</p>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6 pt-6 border-t border-orange-100">
              <div className="text-xs font-semibold text-slate-600 mb-2">Progress</div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-[#ff9800] to-[#ff6f00] h-2 rounded-full transition-all duration-300"
                  style={{width: state === "COMPLETED" ? "100%" : state === "AWAITING_PASSWORD_SET" ? "66%" : state === "AWAITING_OTP" ? "33%" : "16%"}}
                ></div>
              </div>
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
          <div className="p-6 bg-white/80 border-t border-orange-100/30">
        <form
          onSubmit={handleSend}
          className="max-w-3xl mx-auto flex items-center gap-3 relative"
        >
          <input
            type={(state === "AWAITING_PASSWORD_SET" && !showPassword) || (state === "AWAITING_OTP" && !showOtp) ? "password" : "text"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              state === "AWAITING_OTP" ? "Enter verification code..." :
              state === "AWAITING_PASSWORD_SET" ? "Create a password..." :
              "Enter your email..."
            }
            disabled={isLoading || state === "COMPLETED"}
            autoComplete="off"
            className="flex-1 bg-white border-2 border-orange-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition-all disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed disabled:border-slate-200"
          />

          {(state === "AWAITING_PASSWORD_SET" || state === "AWAITING_OTP") && (
            <button
              type="button"
              onClick={() => {
                if (state === "AWAITING_OTP") {
                  setShowOtp(!showOtp);
                } else {
                  setShowPassword(!showPassword);
                }
              }}
              disabled={isLoading}
              className="p-3 rounded-xl transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
              title={state === "AWAITING_OTP" ? (showOtp ? "Hide code" : "Show code") : (showPassword ? "Hide password" : "Show password")}
            >
              {(state === "AWAITING_OTP" ? showOtp : showPassword) ? (
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
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            <svg
              className="w-5 h-5"
              fill="#19005d"
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
      <SignupForm />
    </Suspense>
  );
}

