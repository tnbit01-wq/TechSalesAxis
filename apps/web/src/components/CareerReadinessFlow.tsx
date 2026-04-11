"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import getAIIntelligenceClient from "@/lib/aiIntelligenceClient";
import { useVoice } from "@/hooks/useVoice";
import { extractNameFromEmail } from "@/utils/emailValidation";

type Message = {
  id: string;
  text: string;
  sender: "bot" | "user";
  timestamp: Date;
  options?: string[];
  isTyping?: boolean;
};

type CareerReadinessState = 
  | "INITIAL"
  | "EMPLOYMENT_STATUS"
  | "JOB_SEARCH_MODE"
  | "TIMELINE"
  | "PREFERENCES"
  | "COMPLETED";

interface CareerReadinessData {
  employment_status: string;
  job_search_mode: string;
  notice_period_days: number | null;
  willing_to_relocate: boolean;
  contract_preference: string;
  visa_sponsorship_needed: boolean;
  salary_flexibility: number;
  exploration_trigger: string | null;
  target_market_segment: string;
  current_company_name: string | null;
}

export function CareerReadinessComponent() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<CareerReadinessState>("INITIAL");
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Voice input integration
  const { isListening, transcript, interimTranscript, startListening, stopListening } = useVoice();

  // Update input from voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const [careerData, setCareerData] = useState<Partial<CareerReadinessData>>({
    contract_preference: "fulltime",
    visa_sponsorship_needed: false,
    salary_flexibility: 0.5,
    target_market_segment: "any",
    willing_to_relocate: false,
  });

  // Debug logging
  useEffect(() => {
    console.log("[STATE] CareerReadinessFlow State Update:", {
      state,
      messagesCount: messages.length,
      isLoading,
      initialized: initialized.current,
    });
  }, [state, messages.length, isLoading]);

  const addMessage = (
    text: string,
    sender: "bot" | "user",
    options?: string[],
    isTyping?: boolean
  ) => {
    const messageId = Math.random().toString(36).substr(2, 9);
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        text,
        sender,
        timestamp: new Date(),
        options,
        isTyping: isTyping || false,
      },
    ]);
    return messageId; // Return the ID so we can update it later
  };

  const removeTypingIndicator = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isTyping: false } : msg
      )
    );
  };

  const typeMessage = (
    text: string,
    sender: "bot" | "user",
    options?: string[]
  ) => {
    const messageId = addMessage(text, sender, options, false);
  };

  /**
   * AI-POWERED: Get adaptive follow-up question based on previous answers
   * Makes the flow personalized instead of generic
   * Falls back to intelligent defaults if API unavailable
   */
  const getAdaptiveFollowupQuestion = async (step: number) => {
    try {
      console.log(`[AI] Fetching adaptive question for step ${step}...`);
      const aiClient = getAIIntelligenceClient();
      const token = awsAuth.getToken() || undefined;

      const response = await aiClient.getAdaptiveFollowupQuestion(
        {
          employment_status: careerData.employment_status,
          job_search_mode: careerData.job_search_mode,
          timeline: careerData.notice_period_days?.toString(),
          salary_expectation: careerData.salary_flexibility?.toString(),
          step,
        },
        token
      );

      if (response.status === "success") {
        const { question, options, personalization_notes } = response.data;
        console.log(`[AI] ✅ Got adaptive question: ${question.substring(0, 60)}...`);
        console.log(`[AI] Personalization: ${personalization_notes}`);

        return { question, options };
      }
    } catch (error) {
      console.error("[AI] ❌ Failed to get adaptive question:", error);
    }

    // Intelligent fallback questions referencing collected data
    const statusRef = careerData.employment_status ? ` as a ${careerData.employment_status.toLowerCase()}` : "";
    
    const fallbackByStep: Record<number, { question: string; options: string[] }> = {
      2: {
        question: `Based on your current status${statusRef}, what's your job search mode?`,
        options: [
          "Just exploring (curious, no rush)",
          "Passive (open if right fit appears)",
          "Active (seriously looking right now)",
        ],
      },
      3: {
        question: `For your ${careerData.job_search_mode || "career"} transition, how soon could you realistically start?`,
        options: [
          "Immediate (less than 1 month)",
          "Soon (1-3 months)",
          "Flexible (3-6 months)",
          "Long term (6+ months)",
        ],
      },
      4: {
        question: `What matters most to you in your next opportunity?`,
        options: [
          "Career growth & learning",
          "Better compensation",
          "Work-life balance",
          "Leadership opportunity",
          "Relocation flexibility",
        ],
      },
    };

    const fallback = fallbackByStep[step];
    if (fallback) {
      console.log(`[AI] Using intelligent fallback for step ${step}`);
      return fallback;
    }

    return null;
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Check if user is still logged in, redirect to login if not
    const checkAuth = setInterval(() => {
      const user = awsAuth.getUser();
      if (!user) {
        // User logged out, stop all operations
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        setIsLoading(false);
        console.log("[AUTH] User no longer authenticated, redirecting to login");
        router.replace("/login");
      }
    }, 1000);

    // Listen for keyboard/mic input from parent form (custom event)
    const handleCareerReadinessInput = (event: Event) => {
      const customEvent = event as CustomEvent;
      const textInput = customEvent.detail?.input || "";
      if (textInput) {
        console.log("[INPUT] Received keyboard/mic input from parent:", textInput);
        handleSend(textInput);
      }
    };

    window.addEventListener("careerReadinessInput", handleCareerReadinessInput);

    return () => {
      clearInterval(checkAuth);
      window.removeEventListener("careerReadinessInput", handleCareerReadinessInput);
    };
  }, [router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const init = async () => {
      if (initialized.current) {
        console.log("[INIT] Already initialized, skipping");
        return;
      }
      initialized.current = true;

      console.log("[INIT] CareerReadinessFlow initializing...");

      const user = awsAuth.getUser();
      console.log("[USER] Current user:", user?.email);
      
      if (!user) {
        console.error("[ERROR] No user found, redirecting to login");
        router.replace("/login");
        return;
      }

      // Welcome message with typing effect - using properly extracted name
      const userName = extractNameFromEmail(user.email || "");
      const welcomeMsg = `Hi ${userName}! Let's talk about your career goals. This will help us find the best opportunities for you.`;
      console.log("[MSG] Adding welcome message");
      addMessage(welcomeMsg, "bot");

      setTimeout(() => {
        // Check if user is still authenticated before proceeding
        const currentUser = awsAuth.getUser();
        if (!currentUser) {
          console.error("[ERROR] User logged out during initialization");
          router.replace("/login");
          return;
        }

        console.log("[Q] Showing employment status question");
        typeMessage(
          "First things first: What's your current employment situation?",
          "bot",
          [
            "I'm currently employed",
            "I'm between roles",
            "I'm a student",
            "I'm not working",
          ]
        );
        setState("EMPLOYMENT_STATUS");
      }, 1200);
    };

    init();
  }, [router]);

  const handleSend = async (textOverride?: string) => {
    const workingInput = textOverride || "";
    console.log("[SEND] handleSend called:", {
      state,
      textOverride,
      isLoading,
    });

    if (!workingInput && !isLoading) {
      console.log("[WARN] No input and not loading, returning");
      return;
    }
    if (isLoading) {
      console.log("[WARN] Already loading, ignoring");
      return;
    }

    if (workingInput) {
      console.log("[INPUT] User sent:", workingInput);
      addMessage(workingInput, "user");
    }

    setIsLoading(true);

    try {
      if (state === "EMPLOYMENT_STATUS") {
        console.log("[STATE] Processing EMPLOYMENT_STATUS");
        const lower = workingInput.toLowerCase();
        let employment = "";

        if (lower.includes("employed")) employment = "Employed";
        else if (lower.includes("between") || lower.includes("unemployed") || lower.includes("role") || lower.includes("jobs")) employment = "Unemployed";
        else if (lower.includes("student")) employment = "Student";
        else if (lower.includes("not working")) employment = "Unemployed";

        if (!employment) {
          console.log("[ERROR] Invalid employment selection");
          setTimeout(() => {
            typeMessage(
              "Please select one of the options to continue.",
              "bot",
              [
                "I'm currently employed",
                "I'm between roles",
                "I'm a student",
                "I'm not working",
              ]
            );
          }, 300);
          setIsLoading(false);
          return;
        }

        console.log("[OK] Employment status:", employment);
        setCareerData((prev) => ({
          ...prev,
          employment_status: employment,
        }));

        setTimeout(() => {
          typeMessage(`Got it! You're ${employment.toLowerCase()}.`, "bot");
        }, 600);

        setTimeout(async () => {
          // AI-POWERED: Get contextual follow-up question based on employment status
          console.log("[AI] Getting adaptive question for step 2 (Job Search Mode)...");
          const adaptiveQuestion = await getAdaptiveFollowupQuestion(2);

          // ALWAYS use the question (AI response or intelligent fallback guaranteed)
          if (adaptiveQuestion?.question) {
            typeMessage(
              adaptiveQuestion.question,
              "bot",
              adaptiveQuestion.options
            );
          } else {
            // Safety fallback (should rarely happen)
            console.warn("[AI] No question returned, using absolute fallback");
            typeMessage(
              `Based on your current status as ${careerData.employment_status?.toLowerCase()}, what's your job search mode?`,
              "bot",
              [
                "Just exploring (curious, no rush)",
                "Passive (open if right fit appears)",
                "Active (seriously looking right now)",
              ]
            );
          }
          setState("JOB_SEARCH_MODE");
        }, 1400);
      } 
      else if (state === "JOB_SEARCH_MODE") {
        console.log("[STATE] Processing JOB_SEARCH_MODE");
        const lower = workingInput.toLowerCase();
        let mode = "";

        if (lower.includes("exploring") || lower.includes("curious") || lower.includes("no rush")) mode = "exploring";
        else if (lower.includes("passive") || lower.includes("open") || lower.includes("right fit")) mode = "passive";
        else if (lower.includes("active") || lower.includes("seriously") || lower.includes("looking")) mode = "active";

        if (!mode) {
          console.log("[ERROR] Invalid job search mode");
          setTimeout(() => {
            typeMessage(
              "Please select one of the options above.",
              "bot",
              [
                "Just exploring (curious, no rush)",
                "Passive (open if right fit appears)",
                "Active (seriously looking right now)",
              ]
            );
          }, 300);
          setIsLoading(false);
          return;
        }

        console.log("[OK] Job search mode:", mode);
        setCareerData((prev) => ({
          ...prev,
          job_search_mode: mode,
        }));

        const botMessages: Record<string, string> = {
          exploring:
            "Got it! We'll keep you updated with opportunities that align with your interests. No pressure!",
          passive:
            "Perfect! We'll share relevant roles that match your profile. You're on our radar!",
          active:
            "Awesome! Let's accelerate this. You're priority-ranked in our system now!",
        };

        setTimeout(() => {
          typeMessage(botMessages[mode], "bot");
        }, 600);

        setTimeout(async () => {
          // AI-POWERED: Get contextual follow-up question based on job search mode
          console.log("[AI] Getting adaptive question for step 3 (Timeline)...");
          const adaptiveQuestion = await getAdaptiveFollowupQuestion(3);

          // ALWAYS use the question (AI response or intelligent fallback guaranteed)
          if (adaptiveQuestion?.question) {
            typeMessage(
              adaptiveQuestion.question,
              "bot",
              adaptiveQuestion.options
            );
          } else {
            // Safety fallback
            console.warn("[AI] No question returned for step 3, using absolute fallback");
            typeMessage(
              `For your ${careerData.job_search_mode || "career"} transition, how soon could you realistically start?`,
              "bot",
              [
                "Immediately (ready now)",
                "1-2 weeks",
                "1 month (30 days)",
                "2-3 months (60-90 days)",
                "3+ months (planning ahead)",
              ]
            );
          }
          setState("TIMELINE");
        }, 1600);
      } 
      else if (state === "TIMELINE") {
        console.log("[STATE] Processing TIMELINE");
        const lower = workingInput.toLowerCase();
        let days = null;

        if (lower.includes("immediately") || lower.includes("ready now") || lower.includes("⚡"))
          days = 0;
        else if (lower.includes("1-2") || lower.includes("weeks"))
          days = 14;
        else if (lower.includes("1 month") || lower.includes("30"))
          days = 30;
        else if (lower.includes("2-3") || lower.includes("60") || lower.includes("90"))
          days = 60;
        else if (lower.includes("3+") || lower.includes("planning"))
          days = 180;

        if (days === null) {
          console.log("[ERROR] Invalid timeline");
          setTimeout(() => {
            typeMessage("Please select one of the timing options.", "bot", [
              "Immediately (ready now)",
              "1-2 weeks",
              "1 month (30 days)",
              "2-3 months (60-90 days)",
              "3+ months (planning ahead)",
            ]);
          }, 300);
          setIsLoading(false);
          return;
        }

        console.log("[OK] Timeline days:", days);
        setCareerData((prev) => ({
          ...prev,
          notice_period_days: days,
        }));

        const timelineMessages: Record<number, string> = {
          0: "Perfect! You're ready to jump in immediately. That's fantastic!",
          14: "Got it. You'll be available in 1-2 weeks. We can work with that!",
          30: "Noted. You need about a month to transition. Makes sense!",
          60: "Understood. You'll be ready in 2-3 months. Great planning!",
          180: "Excellent. You're thinking ahead. That's smart strategy.",
        };

        setTimeout(() => {
          typeMessage(timelineMessages[days], "bot");
        }, 600);

        setTimeout(async () => {
          // AI-POWERED: Get contextual follow-up question based on timeline
          console.log("[AI] Getting adaptive question for step 4 (Preferences)...");
          const adaptiveQuestion = await getAdaptiveFollowupQuestion(4);

          // ALWAYS use the question (AI response or intelligent fallback guaranteed)
          if (adaptiveQuestion?.question) {
            typeMessage(
              adaptiveQuestion.question,
              "bot",
              adaptiveQuestion.options
            );
          } else {
            // Safety fallback
            console.warn("[AI] No question returned for step 4, using absolute fallback");
            typeMessage(
              "What matters most to you in your next opportunity?",
              "bot",
              ["Career growth & learning", "Better compensation", "Work-life balance", "Leadership opportunity", "Relocation flexibility"]
            );
          }
          setState("PREFERENCES");
        }, 1600);
      } 
      else if (state === "PREFERENCES") {
        console.log("[STATE] Processing PREFERENCES");
        const lower = workingInput.toLowerCase();
        
        // More flexible handling for AI-generated responses
        // Try to infer yes/no from response
        const willing = lower.includes("yes") || lower.includes("open") || lower.includes("interested");

        console.log("[OK] Preference response:", { lower, willing });
        setCareerData((prev) => ({
          ...prev,
          willing_to_relocate: willing,
        }));

        const prefMessage = willing
          ? "Excellent! That broadens the horizon of opportunities for you."
          : "Understood! We'll focus on roles in your current location.";

        setTimeout(() => {
          typeMessage(prefMessage, "bot");
        }, 600);

        // Save complete career readiness
        setTimeout(async () => {
          console.log("[SAVE] Preparing to save career readiness...");
          try {
            const user = awsAuth.getUser();
            if (!user) {
              console.error("[ERROR] User not found during save");
              router.replace("/login");
              return;
            }

            const token = awsAuth.getToken();
            if (!token) {
              console.error("[ERROR] No token available");
              addMessage(
                "⚠️ Your session expired. Please log in again.",
                "bot"
              );
              setTimeout(() => {
                router.replace("/login");
              }, 2000);
              setIsLoading(false);
              return;
            }

            const completeData: CareerReadinessData = {
              employment_status: careerData.employment_status || "Unemployed",
              job_search_mode: careerData.job_search_mode || "exploring",
              notice_period_days: careerData.notice_period_days ?? 0,
              willing_to_relocate:
                careerData.willing_to_relocate !== undefined
                  ? careerData.willing_to_relocate
                  : false,
              contract_preference: careerData.contract_preference || "fulltime",
              visa_sponsorship_needed:
                careerData.visa_sponsorship_needed || false,
              salary_flexibility: careerData.salary_flexibility || 0.5,
              exploration_trigger: careerData.exploration_trigger || null,
              target_market_segment: careerData.target_market_segment || "any",
              current_company_name: careerData.current_company_name || null,
            };

            console.log("[API] Saving career readiness:", {
              endpoint: "/api/v1/candidate/career-readiness/save",
              data: completeData,
              hasToken: !!token,
            });

            const response = await apiClient.post(
              "/api/v1/candidate/career-readiness/save",
              completeData,
              token
            );

            console.log("[OK] Career readiness saved successfully:", response);

            typeMessage(
              "Perfect! Your career readiness profile is all set. We're now analyzing the best opportunities for you.",
              "bot"
            );

            setState("COMPLETED");

            setTimeout(() => {
              console.log("[EVENT] Dispatching careerReadinessComplete event");
              window.dispatchEvent(
                new CustomEvent("careerReadinessComplete", {
                  detail: completeData,
                })
              );
            }, 2000);
          } catch (err: any) {
            console.error("[ERROR] Error saving career readiness:", {
              error: err,
              message: err?.message,
              status: err?.status,
              url: err?.url,
              response: err?.response,
              stack: err?.stack,
            });

            // Handle authentication errors
            if (err?.status === 401 || err?.message?.includes("401")) {
              addMessage(
                "Your session expired. Redirecting to login...",
                "bot"
              );
              setTimeout(() => {
                router.replace("/login");
              }, 2000);
              return;
            }
            
            const errorMsg = 
              err?.status === 404 ? "Endpoint configuration issue. Backend endpoint not found. This is a server configuration error, not your fault."
              : err?.status === 500 ? "Server error. Please try again or contact support."
              : err?.message || "Something went wrong saving your preferences.";
            
            addMessage(
              `${errorMsg}`,
              "bot"
            );
            console.error("[ERROR] Full error details:", err);
            setState("PREFERENCES");
          }
        }, 1600);
      }
    } catch (err) {
      console.error("[ERROR] Error in career readiness flow:", err);
      typeMessage("Something went wrong. Let's try again.", "bot");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Messages Container - Scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-4 scroll-smooth max-w-5xl mx-auto w-full"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.sender === "user"
                    ? "bg-primary text-white rounded-tr-none shadow-primary-light font-semibold"
                    : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none font-medium"
                }`}
                style={msg.sender === "bot" ? {
                  color: "#374151",
                  backgroundColor: "#f8fafc"
                } : msg.sender === "user" ? {
                  color: "#ffffff"
                } : {}}
              >
                {msg.text}
              </div>

              {/* Options */}
              {msg.options && msg.sender === "bot" && (
                <div className="flex flex-wrap gap-2.5 mt-4">
                  {msg.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        console.log("[TAP] Button clicked:", option);
                        setInput(option);
                        setIsLoading(true);
                        handleSend(option);
                      }}
                      disabled={isLoading}
                      className="px-5 py-2.5 bg-white hover:bg-primary-light border border-slate-200 hover:border-primary-light rounded-full text-sm font-semibold text-slate-800 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      style={{
                        color: "#1f2937",
                        backgroundColor: "#ffffff",
                        borderColor: "#e2e8f0"
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100 rounded-tl-none shadow-sm">
              <div className="flex space-x-1.5 items-center h-4">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-200"></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - Matches Conversational Flow Design */}
      <div className="px-6 py-6 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto relative flex flex-col gap-3">
          {/* Live Transcript Display - Shows what AI is hearing */}
          {isListening && interimTranscript && (
            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl animate-pulse">
              <div className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wider">
                🎤 Listening...
              </div>
              <div className="text-sm text-blue-900 font-medium">
                {interimTranscript}
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-light transition-all px-2 py-2 rounded-2xl">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isLoading && input.trim()) {
                  handleSend(input);
                  setInput("");
                }
              }}
              placeholder="Or type your answer here... (you can also click buttons above)"
              disabled={isLoading}
              className="flex-1 bg-transparent px-4 py-2 text-slate-700 placeholder:text-slate-500 focus:outline-none text-sm font-medium"
            />
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              className={`p-2.5 rounded-xl transition-all ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-slate-400 hover:text-primary hover:bg-white border border-transparent hover:border-slate-100"
              } disabled:opacity-50`}
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
              onClick={() => {
                if (input.trim()) {
                  handleSend(input);
                  setInput("");
                }
              }}
              disabled={
                isLoading ||
                (!input.trim())
              }
              className="bg-primary hover:bg-primary-dark text-white p-2.5 rounded-xl transition-all shadow-md shadow-primary-light disabled:opacity-40 active:scale-95"
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
          </div>
        </div>
      </div>
    </>
  );
}

export default CareerReadinessComponent;
