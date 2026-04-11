// CONVERSATIONAL_CAREERNESS_FLOW.tsx
// This replaces the button-based flow with a true AI-conversational interface
// Users can type freely, AI understands and extracts career info from natural language

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
  isTyping?: boolean;
};

export function ConversationalCareerReadinessFlow() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [conversationData, setConversationData] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const conversationHistoryRef = useRef<Array<{user: string, assistant: string}>>([]);
  
  // Voice input integration
  const { isListening, transcript, interimTranscript, startListening, stopListening } = useVoice();

  // Update input when transcript changes (voice input)
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const addMessage = (text: string, sender: "bot" | "user") => {
    const messageId = Math.random().toString(36).substr(2, 9);
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        text,
        sender,
        timestamp: new Date(),
        isTyping: false,
      },
    ]);
    return messageId;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const init = async () => {
      if (initialized.current) return;
      initialized.current = true;

      const user = awsAuth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      // Welcome message with properly extracted name
      const userName = extractNameFromEmail(user.email || "");
      const welcomeMsg = `Hi ${userName}! 👋

I'm here to understand your career goals in IT Tech Sales. Tell me about yourself - your current situation, experience, skills, what you're looking for, anything relevant!

Feel free to type naturally. I'll understand what you share and help guide you to the right opportunities.`;
      
      addMessage(welcomeMsg, "bot");
    };

    init();
  }, [router]);

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage || isLoading) return;

    // Add user message
    addMessage(userMessage, "user");
    setInput("");
    setIsLoading(true);

    try {
      const token = awsAuth.getToken() || undefined;
      const aiClient = getAIIntelligenceClient();

      // Call AI to process conversational input
      console.log("[AI] Processing conversational input...", userMessage);
      
      const apiResponse = await aiClient.processConversationalOnboarding(
        userMessage,
        conversationHistoryRef.current,
        token
      );

      console.log("[AI] Response:", apiResponse);

      if (apiResponse?.status === "analyzed") {
        const {
          extracted_info,
          completeness_score,
          missing_critical_fields,
          next_question,
          confidence,
          extracted_keywords,
          user_sentiment,
        } = apiResponse;

        // Store extracted data
        setConversationData({
          ...conversationData,
          ...extracted_info,
          completeness_score,
        });

        // Add to conversation history
        conversationHistoryRef.current.push({
          user: userMessage,
          assistant: next_question,
        });

        // Show analysis to user (optional - verbose mode)
        if (completeness_score < 1.0 && missing_critical_fields.length > 0) {
          console.log(`[PROGRESS] Profile ${Math.round(completeness_score * 100)}% complete`);
          console.log(`[NEEDS] Missing: ${missing_critical_fields.join(", ")}`);
        }

        // Check if we have enough info to move forward
        if (completeness_score >= 0.85) {
          // Enough info gathered - show summary and move to next step
          const summaryMsg = `Great! I've gathered the following about your career:

📊 **Your Profile:**
- Status: ${extracted_info.employment_status || "Not specified"}
- Job Search Mode: ${extracted_info.job_search_mode || "Not specified"}
- Notice Period: ${extracted_info.notice_period_days || "N/A"} days
- Years Experience: ${extracted_info.years_experience || "Not specified"}
- Willing to Relocate: ${extracted_info.willing_to_relocate ? "Yes" : "No"}

Confidence: ${Math.round(confidence * 100)}%

Ready to move forward? I can now show you personalized role recommendations!`;

          addMessage(summaryMsg, "bot");

          setTimeout(() => {
            addMessage("Would you like me to suggest the best IT Tech Sales roles for you, or do you have more to share?", "bot");
          }, 1000);

          // Mark as ready for completion
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("careerReadinessComplete", {
                detail: {
                  ...extracted_info,
                  ...conversationData,
                  completeness_score,
                },
              })
            );
          }, 2000);
        } else {
          // More info needed
          addMessage(next_question, "bot");
        }
      } else {
        // Fallback response
        addMessage(
          "I'm having trouble understanding. Could you tell me more about your current employment situation or career goals?",
          "bot"
        );
      }
    } catch (error) {
      console.error("[ERROR] Conversational processing failed:", error);
      addMessage(
        "Something went wrong processing your input. Please try again.",
        "bot"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Messages Container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-4 scroll-smooth max-w-5xl mx-auto w-full"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full ${
              msg.sender === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
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

      {/* Input Area - Matches Main Onboarding Flow */}
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
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Share your career background, experience, goals... (natural language welcome!)"
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
              onClick={handleSend}
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
    </div>
  );
}

export default ConversationalCareerReadinessFlow;
