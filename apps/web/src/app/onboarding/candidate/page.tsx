"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import getAIIntelligenceClient from "@/lib/aiIntelligenceClient";
import { useVoice } from "@/hooks/useVoice";
import { extractNameFromEmail } from "@/utils/emailValidation";
import { SKILLS_BY_EXPERIENCE } from "./skillsData";
import { TermsModal } from "@/components/TermsModal";

type Message = {
  id: string;
  text: string;
  sender: "bot" | "user";
  timestamp: Date;
  options?: string[];
};

type OnboardingState =
  | "INITIAL"
  | "AWAITING_EMPLOYMENT_STATUS"
  | "AWAITING_JOB_SEARCH_MODE"
  | "AWAITING_TIMELINE"
  | "AWAITING_PREFERENCES"
  | "AWAITING_RESUME"
  | "AWAITING_RESUME_CHOICE"
  | "AWAITING_MANUAL_BIO"
  | "AWAITING_MANUAL_EDUCATION"
  | "AWAITING_MANUAL_EXPERIENCE"
  | "AWAITING_MANUAL_SKILLS"
  | "AWAITING_MANUAL_CONTACT"
  | "AWAITING_EXPERIENCE"
  | "AWAITING_SKILLS"
  | "AWAITING_GPS_VISION"
  | "AWAITING_GPS_INTERESTS"
  | "AWAITING_GPS_GOAL"
  | "AWAITING_ID"
  | "AWAITING_TC"
  | "COMPLETED";

interface ManualResumeData {
  bio: string;
  education: any[];
  experience: any[];
  skills: string[];
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<OnboardingState>("INITIAL");
  const [experienceBand, setExperienceBand] = useState<string>("fresher");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [suggestedSkills, setSuggestedSkills] = useState<string[]>([]);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<"structured" | "conversational">("structured");
  const [manualResumeData, setManualResumeData] = useState<ManualResumeData>({
    bio: "",
    education: [],
    experience: [],
    skills: [],
    phone: "",
    location: "",
    linkedin: "",
    portfolio: "",
  });
  
  // Store career readiness data for context in subsequent questions
  const [careerReadinessData, setCareerReadinessData] = useState<any>(null);
  
  const userIdRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  const { isListening, transcript, startListening, stopListening } = useVoice();

  const handleLogout = () => {
    if (userIdRef.current) {
      localStorage.removeItem(`tf_onboarding_chat_${userIdRef.current}`);
    }
    awsAuth.logout();
    router.replace("/login");
  };

  const saveStep = async (step: OnboardingState) => {
    try {
      const token = awsAuth.getToken() || undefined;
      if (token) {
        await apiClient.post("/candidate/step", { step }, token);
      }
    } catch (err) {
      console.error("Failed to save onboarding step:", err);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  };

  const fetchSuggestedSkills = async (band: string) => {
    try {
      const res = await apiClient.get(`/candidate/suggested-skills?band=${band}`);
      if (res.skills && res.skills.length > 0) {
        setSuggestedSkills(res.skills);
      } else {
        // Local Fallback if DB is empty
        setSuggestedSkills(SKILLS_BY_EXPERIENCE[band] || []);
      }
    } catch (err) {
      console.error("Failed to fetch skills:", err);
      setSuggestedSkills(SKILLS_BY_EXPERIENCE[band] || []);
    }
  };

  // Generate contextual message based on career readiness data
  const generateContextualMessage = async (crData: any): Promise<string> => {
    try {
      // Build a contextual message based on their career readiness answers
      const mode = crData.job_search_mode || "opportunities";
      const status = crData.employment_status || "role transition";
      const market = crData.target_market_segment || "your target market";
      const relocate = crData.willing_to_relocate ? "and you're open to relocation" : "";
      
      // Generate intelligent message
      return `Excellent! Based on your interest in ${mode} and your current status of ${status}, I'll help you build a profile that stands out in ${market}${relocate ? " " + relocate : ""}. Let's continue with your experience.`;
      
    } catch (error) {
      console.error("[AI ERROR] Error generating contextual message:", error);
      // Ultimate fallback
      return `Great! Now that I understand your career direction, let's learn more about your experience.`;
    }
  };


  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const addMessage = (
    text: string,
    sender: "bot" | "user",
    options?: string[],
  ) => {
    setMessages((prev) => {
      const newMsgs = [
        ...prev,
        {
          id: Math.random().toString(36).substr(2, 9),
          text,
          sender,
          timestamp: new Date(),
          options,
        },
      ];
      // Store in localStorage for refresh persistence
      if (typeof window !== "undefined" && userIdRef.current) {
        localStorage.setItem(
          `tf_onboarding_chat_${userIdRef.current}`,
          JSON.stringify(newMsgs.slice(-20)),
        ); // Keep last 20
      }
      return newMsgs;
    });
  };

  useEffect(() => {
    async function init() {
      if (initialized.current) return;
      initialized.current = true;

      const user = awsAuth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      userIdRef.current = user.id;
      const name = extractNameFromEmail(user.email || "");

      // Check for forced target from URL (e.g. from Dashboard "Check Points")
      const targetParam = searchParams.get("target") as OnboardingState | null;

      // Note: We intentionally do NOT load old chat history from localStorage.
      // Users should start fresh on each login and resume from their saved step.
      // Clear the stored chat to start fresh
      const storageKey = `tf_onboarding_chat_${user.id}`;
      localStorage.removeItem(storageKey);

      // Fetch profile to check progress
      const token = awsAuth.getToken() || undefined;
      if (!token) return;

      const profile = await apiClient.get(
        "/candidate/profile",
        token,
      );

      // REDIRECT IF ALREADY COMPLETED: 
      // If the profile is fully completed and they have terms accepted, send to dashboard.
      if (profile && profile.onboarding_step === "COMPLETED" && profile.terms_accepted) {
        router.replace("/dashboard/candidate");
        return;
      }

      if (targetParam) {
        setState(targetParam);
        addMessage(
          `Welcome back! Let's jump straight to: ${targetParam.replace("AWAITING_", "").replace("_", " ")}`,
          "bot",
        );
        return;
      }

      if (
        profile &&
        profile.onboarding_step &&
        profile.onboarding_step !== "INITIAL" &&
        profile.onboarding_step !== "COMPLETED"
      ) {
        const savedStep = profile.onboarding_step as OnboardingState;
        setExperienceBand(profile.experience || "fresher");
        setSelectedSkills(profile.skills || []);

        if (profile.experience) {
          fetchSuggestedSkills(profile.experience);
        }

        // Add context message about resuming from saved step
        if (savedStep !== "AWAITING_EMPLOYMENT_STATUS") {
          addMessage(
            `Welcome back, ${name}! Let's pick up where we left off.`,
            "bot",
          );
        }

        if (savedStep === "AWAITING_EMPLOYMENT_STATUS") {
          // Career readiness - ask employment status
          addMessage(
            "Let's start by understanding your career situation. What's your current employment status?",
            "bot",
            [
              "I'm currently employed",
              "I'm between roles",
              "I'm a student",
              "I'm not working",
            ]
          );
        } else if (savedStep === "AWAITING_JOB_SEARCH_MODE") {
          addMessage(
            "Great! What brings you to search for opportunities right now?",
            "bot",
            [
              "Active job search",
              "Explore opportunities",
              "Career transition",
              "Learning & growth",
            ]
          );
        } else if (savedStep === "AWAITING_TIMELINE") {
          addMessage(
            "What's your timeline for this transition?",
            "bot",
            [
              "Immediately available",
              "Within 1 month",
              "2-3 months",
              "Flexible timeline",
            ]
          );
        } else if (savedStep === "AWAITING_PREFERENCES") {
          addMessage(
            "Any preferences for location or work arrangement?",
            "bot",
            [
              "Remote only",
              "On-site",
              "Hybrid",
              "Open to all",
            ]
          );
        } else if (savedStep === "AWAITING_RESUME" || savedStep === "AWAITING_RESUME_CHOICE") {
            addMessage(
              "I'm waiting for your resume. You can either upload a PDF or build it manually here.",
              "bot",
              ["Upload PDF", "Build Manually"],
            );
          } else if (
            savedStep === "AWAITING_MANUAL_BIO" ||
            savedStep === "AWAITING_MANUAL_EDUCATION" ||
            savedStep === "AWAITING_MANUAL_EXPERIENCE" ||
            savedStep === "AWAITING_MANUAL_SKILLS" ||
            savedStep === "AWAITING_MANUAL_CONTACT"
          ) {
            addMessage(
                "We were building your resume manually! Let's continue.",
                "bot",
                ["Continue Building"]
            )
          } else if (savedStep === "AWAITING_SKILLS") {
            addMessage(
              "We were just finalizing your skills. Feel free to refine them below.",
              "bot",
            );
          } else if (
            savedStep === "AWAITING_GPS_VISION" ||
            savedStep === "AWAITING_GPS_INTERESTS" ||
            savedStep === "AWAITING_GPS_GOAL"
          ) {
            addMessage(
              "We were just talking about your career vision. What's your next big target?",
              "bot",
            );
          } else if (savedStep === "AWAITING_ID") {
            addMessage(
              "I just need to verify your identity. Please upload any government-issued ID (DL, Passport, or any ID proof).",
              "bot",
            );
          } else if (savedStep === "AWAITING_TC") {
            addMessage(
              "Almost done! Please review and accept our Terms and Conditions to complete your onboarding.",
              "bot",
              ["Read Terms & Policy", "Accept Terms & Conditions"],
            );
          }

        setState(savedStep);
      } else {
        // Fresh start - automatically start with Guided Questions
        const userName = extractNameFromEmail(user.email || "");
        addMessage(
          `Hi ${userName}! 👋 Welcome to TechSales Axis onboarding!`,
          "bot"
        );
        
        // Show first question after brief delay
        setTimeout(() => {
          addMessage(
            "Let's start by understanding your career situation. What's your current employment status?",
            "bot",
            [
              "I'm currently employed",
              "I'm between roles",
              "I'm a student",
              "I'm not working",
            ]
          );
          setState("AWAITING_EMPLOYMENT_STATUS");
        }, 500);
      }
    }
    init();
  }, [router]);

  // Helper: Convert messages to conversation history for AI context
  const buildConversationHistory = () => {
    const history: Array<{ user: string; assistant: string }> = [];
    
    for (let i = 0; i < messages.length; i += 2) {
      const userMsg = messages[i];
      const botMsg = messages[i + 1];
      
      if (userMsg?.sender === "user" && botMsg?.sender === "bot") {
        history.push({
          user: userMsg.text,
          assistant: botMsg.text
        });
      }
    }
    
    return history;
  };

  // CLIENT-SIDE EXTRACTION: Extract key data from narrative input
  const extractKeyDataFromNarrative = (narrative: string) => {
    const lower = narrative.toLowerCase();
    const extracted: any = {};

    // Employment Status Extraction
    if (lower.match(/(?:currently\s+)?working|employed|active/) && !lower.match(/not\s+working|unemployed|inactive/)) {
      extracted.employment_status = "employed";
    } else if (lower.match(/unemployed|not\s+working|looking\s+for|just\s+graduated|fresher|new\s+grad|entry-level/)) {
      extracted.employment_status = "unemployed";
    } else if (lower.match(/transition|switching|changing|career\s+change|switching\s+careers/)) {
      extracted.employment_status = "active_transition";
    }

    // Years of Experience Extraction
    const yearsMatch = narrative.match(/(\d+)\s*(?:\+)?\s*(?:year|yr)s?\b/i);
    if (yearsMatch) {
      extracted.years_experience = parseInt(yearsMatch[1]);
      
      // Map to band
      const years = extracted.years_experience;
      if (years <= 1) extracted.experience_band = "fresher";
      else if (years <= 5) extracted.experience_band = "mid";
      else if (years <= 10) extracted.experience_band = "senior";
      else extracted.experience_band = "leadership";
    }

    // Job Search Mode Extraction
    if (lower.match(/active(?:ly)?\s+looking|actively\s+seeking|open\s+to\s+opportunities|looking\s+for/)) {
      extracted.job_search_mode = "actively_looking";
    } else if (lower.match(/open\s+(?:to\s+)?(?:hearing|listen|discuss|talk|opportunities|offers)/)) {
      extracted.job_search_mode = "open_to_offers";
    } else if (lower.match(/not\s+looking|employed|happy|satisfied|content|stay/)) {
      extracted.job_search_mode = "not_looking";
    }

    // Timeline Extraction
    if (lower.match(/(?:immediate|right\s+now|asap|immediately|this\s+month|this\s+week)/)) {
      extracted.timeline = "immediate";
    } else if (lower.match(/(?:1.*month|next\s+month|month|short\s+term)/)) {
      extracted.timeline = "within_1_month";
    } else if (lower.match(/(?:2|3|quarter|next|upcoming|few\s+months)/)) {
      extracted.timeline = "within_3_months";
    } else if (lower.match(/(?:half\s+year|6\s+months|long\s+term|flexible|whenever)/)) {
      extracted.timeline = "flexible";
    }

    // Location/Relocation Extraction
    if (lower.match(/remote|work\s+from\s+home|wfh/)) {
      extracted.work_location_preference = "remote";
    } else if (lower.match(/office|on[\s-]?site|on\s+site/)) {
      extracted.work_location_preference = "onsite";
    } else if (lower.match(/hybrid|flexible/)) {
      extracted.work_location_preference = "hybrid";
    } else if (lower.match(/open\s+to\s+all|any|all|doesn?t\s+matter/)) {
      extracted.work_location_preference = "any";
    }

    if (lower.match(/willing\s+to|open\s+to|happy\s+to|can\s+relocate|relocate|move/)) {
      extracted.willing_to_relocate = true;
    } else if (lower.match(/not\s+willing|won't\s+relocate|prefer.*same|stay\s+put/)) {
      extracted.willing_to_relocate = false;
    }

    // Skills Extraction (look for technical terms)
    const skillPatterns = [
      /(?:skill(?:set|s)?|expertise|proficient|experienced|skilled)\s+(?:in|with):\s*([^.!?]+)/gi,
      /(?:proficient|skilled|expert|experienced)\s+(?:in|with)\s+([^,;.!?]+)/gi,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:proficiency|expertise|skills?)/gi
    ];
    
    const extractedSkills = new Set<string>();
    skillPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(narrative)) !== null) {
        const skillText = match[1] || match[0];
        skillText
          .split(/[,;/]/)
          .map((s) => s.trim())
          .filter((s) => s.length > 2)
          .forEach((skill) => extractedSkills.add(skill));
      }
    });
    
    if (extractedSkills.size > 0) {
      extracted.mentioned_skills = Array.from(extractedSkills).slice(0, 15);
    }

    // Target Role/Goal Extraction
    const roleMatch = narrative.match(/(?:aim.*for|target.*role|want.*to|goal.*to|focus.*on|interested.*in)\s+(?:a|an)?\s*([^.!?]+?)(?:\.|!|\?|,)/i);
    if (roleMatch) {
      extracted.target_role = roleMatch[1].trim().slice(0, 100);
    }

    // Learning Goals Extraction
    if (lower.match(/learn|upskill|develop|improve|gain\s+expertise|master|ability/)) {
      extracted.has_learning_goals = true;
    }

    return extracted;
  };

  // Save career readiness data to localStorage
  const saveCRDataToStorage = (data: any) => {
    if (typeof window !== "undefined" && userIdRef.current) {
      const storageKey = `tf_crdata_${userIdRef.current}`;
      const current = localStorage.getItem(storageKey);
      const merged = { ...JSON.parse(current || "{}"), ...data, last_updated: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify(merged));
    }
  };

  // Sync career readiness data to backend
  const syncCRDataToBackend = async (data: any) => {
    try {
      const token = awsAuth.getToken() || undefined;
      if (!token) return false;
      
      await apiClient.patch("/candidate/career-readiness", data, token);
      return true;
    } catch (err) {
      console.error("[SYNC ERROR]", err);
      return false;
    }
  };

  const handleSend = async (textOverride?: string) => {
    const workingInput = textOverride || input.trim();

    // Check for logout command
    if (
      workingInput.toLowerCase() === "logout" ||
      workingInput.toLowerCase() === "exit"
    ) {
      // Save current step before logout
      const token = awsAuth.getToken();
      if (token && userIdRef.current) {
        try {
          await apiClient.post("/candidate/step", { step: state }, token);
        } catch (err) {
          console.error("Failed to save step on logout:", err);
        }
      }
      addMessage("Saving your progress and logging out...", "bot");
      setTimeout(handleLogout, 1500);
      return;
    }

    // In AWAITING_SKILLS, we can proceed even if input is empty if pills are selected
    if (!workingInput && state !== "AWAITING_SKILLS" && !isLoading) return;
    if (isLoading) return;

    if (workingInput) {
      addMessage(workingInput, "user");
    } else if (state === "AWAITING_SKILLS" && selectedSkills.length > 0) {
      addMessage(`Confirmed ${selectedSkills.length} skills`, "user");
    }

    setInput("");
    setIsLoading(true);

    try {
      // ========== CAREER READINESS STATES ==========
      
      if (state === "AWAITING_EMPLOYMENT_STATUS") {
        // CONVERSATIONAL MODE - Use AI to extract employment status
        if (onboardingMode === "conversational") {
          const aiClient = getAIIntelligenceClient();
          const token = awsAuth.getToken() || undefined;
          
          try {
            // Use AI intelligence to extract employment status from natural language
            const history = buildConversationHistory();
            const analysisResponse = await aiClient.processConversationalOnboarding(
              workingInput,
              history,
              token
            );

            if (analysisResponse?.extracted_info?.employment_status) {
              const status = analysisResponse.extracted_info.employment_status;
              setCareerReadinessData(prev => ({ ...prev, employment_status: status }));
              
              // Acknowledge understanding and move forward
              addMessage(
                `I understand - ${status.replace('_', ' ')}. That's helpful context!`,
                "bot"
              );

              setTimeout(() => {
                addMessage(
                  "What brings you to explore opportunities right now?",
                  "bot"
                );
                setState("AWAITING_JOB_SEARCH_MODE");
              }, 800);
            } else {
              // AI couldn't extract, ask for clarification
              addMessage(
                "I want to make sure I understand correctly. Are you currently employed, between roles, a student, or not working?",
                "bot",
                [
                  "I'm currently employed",
                  "I'm between roles",
                  "I'm a student",
                  "I'm not working",
                ]
              );
            }
          } catch (error) {
            console.error("[AI] Failed to analyze input:", error);
            // Fallback to rule-based parsing
            let status = "";
            const lower = workingInput.toLowerCase();
            if (lower.includes("employed")) status = "employed";
            else if (lower.includes("between") || lower.includes("transition")) status = "between_roles";
            else if (lower.includes("student")) status = "student";
            else if (lower.includes("not")) status = "not_working";

            if (status) {
              setCareerReadinessData(prev => ({ ...prev, employment_status: status }));
              addMessage(`Got it! You're ${status.replace('_', ' ')}.`, "bot");

              setTimeout(() => {
                addMessage(
                  "What brings you to explore opportunities right now?",
                  "bot"
                );
                setState("AWAITING_JOB_SEARCH_MODE");
              }, 800);
            } else {
              addMessage(
                "I want to make sure I understand. Are you currently employed, between roles, a student, or not working?",
                "bot",
                [
                  "I'm currently employed",
                  "I'm between roles",
                  "I'm a student",
                  "I'm not working",
                ]
              );
            }
          }
          setIsLoading(false);
          return;
        }
        
        // STRUCTURED MODE - Use predefined options
        let status = "";
        const lower = workingInput.toLowerCase();
        if (lower.includes("employed")) status = "employed";
        else if (lower.includes("between") || lower.includes("transition")) status = "between_roles";
        else if (lower.includes("student")) status = "student";
        else if (lower.includes("not")) status = "not_working";

        if (!status) {
          addMessage(
            "I didn't catch that. Please select your employment status:",
            "bot",
            [
              "I'm currently employed",
              "I'm between roles",
              "I'm a student",
              "I'm not working",
            ],
          );
          setIsLoading(false);
          return;
        }

        setCareerReadinessData(prev => ({ ...prev, employment_status: status }));
        addMessage(`Got it! You're ${status.replace('_', ' ')}.`, "bot");

        setTimeout(() => {
          addMessage(
            "What brings you to explore opportunities right now?",
            "bot",
            [
              "Active job search",
              "Explore opportunities",
              "Career transition",
              "Learning & growth",
            ]
          );
          setState("AWAITING_JOB_SEARCH_MODE");
        }, 800);
        setIsLoading(false);
        return;
      }

      if (state === "AWAITING_JOB_SEARCH_MODE") {
        // CONVERSATIONAL MODE - Use AI
        if (onboardingMode === "conversational") {
          const aiClient = getAIIntelligenceClient();
          const token = awsAuth.getToken() || undefined;
          
          try {
            const analysisResponse = await aiClient.processConversationalOnboarding(
              workingInput,
              [],
              token
            );

            if (analysisResponse?.extracted_info?.job_search_mode) {
              const mode = analysisResponse.extracted_info.job_search_mode;
              setCareerReadinessData(prev => ({ ...prev, job_search_mode: mode }));
              addMessage(
                `Great! So you're looking to ${mode.replace('_', ' ')}. I understand your motivation.`,
                "bot"
              );

              setTimeout(() => {
                addMessage("What's your timeline for this transition?", "bot");
                setState("AWAITING_TIMELINE");
              }, 800);
            } else {
              addMessage(
                "Are you looking for an active job search, exploring opportunities, a career transition, or learning & growth?",
                "bot",
                [
                  "Active job search",
                  "Explore opportunities",
                  "Career transition",
                  "Learning & growth",
                ]
              );
            }
          } catch (error) {
            let mode = "";
            const lower = workingInput.toLowerCase();
            if (lower.includes("active")) mode = "active_search";
            else if (lower.includes("explore")) mode = "exploring";
            else if (lower.includes("transition")) mode = "career_transition";
            else if (lower.includes("learning") || lower.includes("growth")) mode = "growth";

            if (mode) {
              setCareerReadinessData(prev => ({ ...prev, job_search_mode: mode }));
              addMessage(`Perfect! ${mode.replace('_', ' ')} is a great approach.`, "bot");
              setTimeout(() => {
                addMessage("What's your timeline?", "bot");
                setState("AWAITING_TIMELINE");
              }, 800);
            } else {
              addMessage(
                "I want to understand your motivation better. Are you actively searching, exploring, transitioning careers, or looking for growth?",
                "bot",
                [
                  "Active job search",
                  "Explore opportunities",
                  "Career transition",
                  "Learning & growth",
                ]
              );
            }
          }
          setIsLoading(false);
          return;
        }
        
        // STRUCTURED MODE
        let mode = "";
        const lower = workingInput.toLowerCase();
        if (lower.includes("active")) mode = "active_search";
        else if (lower.includes("explore")) mode = "exploring";
        else if (lower.includes("transition")) mode = "career_transition";
        else if (lower.includes("learning") || lower.includes("growth")) mode = "growth";

        if (!mode) {
          addMessage(
            "Please select your job search mode:",
            "bot",
            [
              "Active job search",
              "Explore opportunities",
              "Career transition",
              "Learning & growth",
            ],
          );
          setIsLoading(false);
          return;
        }

        setCareerReadinessData(prev => ({ ...prev, job_search_mode: mode }));
        addMessage(`Perfect! ${mode.replace('_', ' ')} is a great approach.`, "bot");

        setTimeout(() => {
          addMessage(
            "What's your timeline?",
            "bot",
            [
              "Immediately available",
              "Within 1 month",
              "2-3 months",
              "Flexible timeline",
            ]
          );
          setState("AWAITING_TIMELINE");
        }, 800);
        setIsLoading(false);
        return;
      }

      if (state === "AWAITING_TIMELINE") {
        // CONVERSATIONAL MODE - Use AI
        if (onboardingMode === "conversational") {
          const aiClient = getAIIntelligenceClient();
          const token = awsAuth.getToken() || undefined;
          
          try {
            const analysisResponse = await aiClient.processConversationalOnboarding(
              workingInput,
              [],
              token
            );

            const timeline = analysisResponse?.extracted_info?.notice_period_days !== undefined
              ? (analysisResponse.extracted_info.notice_period_days <= 30 ? "within_30_days" : "flexible")
              : null;

            if (timeline) {
              setCareerReadinessData(prev => ({ ...prev, timeline }));
              addMessage(
                `Got it! ${timeline.replace('_', ' ')} works perfectly.`,
                "bot"
              );

              setTimeout(() => {
                addMessage("Any preference for work location or arrangement?", "bot");
                setState("AWAITING_PREFERENCES");
              }, 800);
            } else {
              addMessage(
                "When are you looking to make this transition? Immediately, within a month, 2-3 months, or flexible?",
                "bot",
                [
                  "Immediately available",
                  "Within 1 month",
                  "2-3 months",
                  "Flexible timeline",
                ]
              );
            }
          } catch (error) {
            let timeline = "";
            const lower = workingInput.toLowerCase();
            if (lower.includes("immediately")) timeline = "immediate";
            else if (lower.includes("week") || lower.includes("1 month")) timeline = "one_month";
            else if (lower.includes("2") || lower.includes("3")) timeline = "two_to_three_months";
            else if (lower.includes("flexible")) timeline = "flexible";

            if (timeline) {
              setCareerReadinessData(prev => ({ ...prev, timeline }));
              addMessage(`Noted! That's very realistic.`, "bot");
              setTimeout(() => {
                addMessage("Any work location preferences?", "bot");
                setState("AWAITING_PREFERENCES");
              }, 800);
            } else {
              addMessage(
                "Please let me know your timeline - immediately, within a month, 2-3 months, or flexible?",
                "bot",
                [
                  "Immediately available",
                  "Within 1 month",
                  "2-3 months",
                  "Flexible timeline",
                ]
              );
            }
          }
          setIsLoading(false);
          return;
        }
        
        // STRUCTURED MODE
        let timeline = "";
        const lower = workingInput.toLowerCase();
        if (lower.includes("immediately")) timeline = "immediate";
        else if (lower.includes("week") || lower.includes("1 month")) timeline = "one_month";
        else if (lower.includes("2") || lower.includes("3")) timeline = "two_to_three_months";
        else if (lower.includes("flexible")) timeline = "flexible";

        if (!timeline) {
          addMessage(
            "Please select your timeline:",
            "bot",
            [
              "Immediately available",
              "Within 1 month",
              "2-3 months",
              "Flexible timeline",
            ],
          );
          setIsLoading(false);
          return;
        }

        setCareerReadinessData(prev => ({ ...prev, timeline }));
        addMessage(`Noted! That's very realistic.`, "bot");

        setTimeout(() => {
          addMessage(
            "Any work location or arrangement preferences?",
            "bot",
            [
              "Remote only",
              "On-site/Office",
              "Hybrid",
              "Open to all",
            ]
          );
          setState("AWAITING_PREFERENCES");
        }, 800);
        setIsLoading(false);
        return;
      }

      if (state === "AWAITING_PREFERENCES") {
        // CONVERSATIONAL MODE - Use AI
        if (onboardingMode === "conversational") {
          const aiClient = getAIIntelligenceClient();
          const token = awsAuth.getToken() || undefined;
          const history = buildConversationHistory();
          
          try {
            const analysisResponse = await aiClient.processConversationalOnboarding(
              workingInput,
              history,
              token
            );

            const preferences = workingInput.toLowerCase().includes("remote") ? "remote" :
                               workingInput.toLowerCase().includes("office") ? "office" :
                               workingInput.toLowerCase().includes("hybrid") ? "hybrid" : "flexible";
            
            if (preferences) {
              setCareerReadinessData(prev => ({ ...prev, work_location_preference: preferences }));
              addMessage(
                `Perfect! ${preferences} works great. Now I have a clear picture of your career goals.`,
                "bot"
              );

              setTimeout(() => {
                addMessage(
                  "Which experience band best describes your current level?",
                  "bot",
                  [
                    "Fresher (0–1 years)",
                    "Mid-level (1–5 years)",
                    "Senior (5–10 years)",
                    "Leadership (10+ years)",
                  ]
                );
                setState("AWAITING_EXPERIENCE");
              }, 800);
            } else {
              addMessage(
                "Do you prefer remote, on-site, hybrid, or are open to all arrangements?",
                "bot",
                [
                  "Remote only",
                  "On-site/Office",
                  "Hybrid",
                  "Open to all",
                ]
              );
            }
          } catch (error) {
            let preferences = "";
            const lower = workingInput.toLowerCase();
            if (lower.includes("remote")) preferences = "remote";
            else if (lower.includes("on-site") || lower.includes("office")) preferences = "onsite";
            else if (lower.includes("hybrid")) preferences = "hybrid";
            else if (lower.includes("open") || lower.includes("all")) preferences = "any";

            if (preferences) {
              setCareerReadinessData(prev => ({ ...prev, work_location_preference: preferences }));
              addMessage(`Great! Now I understand your full preferences.`, "bot");
              setTimeout(() => {
                addMessage("Which experience band describes your level?", "bot", [
                  "Fresher (0–1 years)",
                  "Mid-level (1–5 years)",
                  "Senior (5–10 years)",
                  "Leadership (10+ years)",
                ]);
                setState("AWAITING_EXPERIENCE");
              }, 800);
            } else {
              addMessage(
                "Please share your location preference - remote, on-site, hybrid, or flexible?",
                "bot",
                [
                  "Remote only",
                  "On-site/Office",
                  "Hybrid",
                  "Open to all",
                ]
              );
            }
          }
          setIsLoading(false);
          return;
        }
        
        // STRUCTURED MODE
        let preferences = "";
        const lower = workingInput.toLowerCase();
        if (lower.includes("remote")) preferences = "remote";
        else if (lower.includes("on-site") || lower.includes("office")) preferences = "onsite";
        else if (lower.includes("hybrid")) preferences = "hybrid";
        else if (lower.includes("open") || lower.includes("all")) preferences = "any";

        if (!preferences) {
          addMessage(
            "Please select your preference:",
            "bot",
            [
              "Remote only",
              "On-site/Office",
              "Hybrid",
              "Open to all",
            ],
          );
          setIsLoading(false);
          return;
        }

        setCareerReadinessData(prev => ({ ...prev, work_location_preference: preferences }));
        addMessage(`Great! Now I have a clear picture of your career goals.`, "bot");

        setTimeout(() => {
          addMessage(
            "Which experience band best describes your current level?",
            "bot",
            [
              "Fresher (0–1 years)",
              "Mid-level (1–5 years)",
              "Senior (5–10 years)",
              "Leadership (10+ years)",
            ]
          );
          setState("AWAITING_EXPERIENCE");
        }, 800);
        setIsLoading(false);
        return;
      }

      // ========== END CAREER READINESS STATES ==========

      if (state === "AWAITING_EXPERIENCE") {
        let band = "";
        
        if (onboardingMode === "conversational") {
          // CONVERSATIONAL MODE: AI-powered experience band extraction
          setIsLoading(true);
          addMessage("Analyzing your experience level...", "bot");
          
          try {
            const aiClient = getAIIntelligenceClient();
            const token = awsAuth.getToken() || undefined;
            const history = buildConversationHistory();
            
            const analysisResponse = await aiClient.processConversationalOnboarding(
              workingInput,
              history,
              token
            );
            
            if (analysisResponse?.extracted_info?.years_experience) {
              const years = analysisResponse.extracted_info.years_experience;
              if (years <= 1) band = "fresher";
              else if (years <= 5) band = "mid";
              else if (years <= 10) band = "senior";
              else band = "leadership";
            }
          } catch (error) {
            console.error("[AI] Experience band extraction failed, falling back to rules:", error);
            // FALLBACK: Rule-based parsing
            const lower = workingInput.toLowerCase();
            if (lower.includes("fresher") || lower.includes("graduate") || lower.includes("0-1") || lower.includes("entry")) band = "fresher";
            else if (lower.includes("mid") || lower.includes("1-5") || lower.includes("5 years")) band = "mid";
            else if (lower.includes("senior") || lower.includes("5-10") || lower.includes("10 years")) band = "senior";
            else if (lower.includes("leadership") || lower.includes("enterprise") || lower.includes("10+") || lower.includes("manager")) band = "leadership";
          }
          
          if (!band) {
            setIsLoading(false);
            addMessage(
              "Tell me more about your experience level. Are you a fresher, mid-level, senior, or in a leadership role?",
              "bot"
            );
          } else {
            // Successfully extracted experience band
            setExperienceBand(band);
            const token = awsAuth.getToken() || undefined;
            await apiClient.post(
              "/candidate/experience",
              { experience: band },
              token,
            );

            // Fetch dynamic skill suggestions for the new band
            fetchSuggestedSkills(band);

            // Natural acknowledgment in conversational mode
            const bandLabels: Record<string, string> = {
              fresher: "fresh start",
              mid: "mid-level progression",
              senior: "senior expertise",
              leadership: "leadership experience"
            };
            
            let ackMessage = `Great! I can see you have ${bandLabels[band] || band} in your background.`;
            if (careerReadinessData?.target_market_segment) {
              ackMessage += ` This experience aligns well with ${careerReadinessData.target_market_segment} opportunities.`;
            }
            
            addMessage(ackMessage, "bot");
            setIsLoading(false);

            const nextState = "AWAITING_RESUME_CHOICE";
            await saveStep(nextState);

            // Generate contextualized resume prompt
            setTimeout(() => {
              let resumePrompt = "Now, I'd like to understand your full background. Do you have a resume to upload, or would you like to build one with me step-by-step?";
              
              addMessage(
                resumePrompt,
                "bot",
                ["Upload PDF", "Build Manually", "Skip for Now"],
              );
              setState(nextState);
            }, 1000);
          }
        } else {
          // STRUCTURED MODE: Rule-based parsing with button options
          const lower = workingInput.toLowerCase();
          if (lower.includes("fresher")) band = "fresher";
          else if (lower.includes("mid")) band = "mid";
          else if (lower.includes("senior")) band = "senior";
          else if (lower.includes("leadership") || lower.includes("enterprise"))
            band = "leadership";

          if (!band) {
            addMessage(
              "I didn't quite catch that. Please select one of the options below.",
              "bot",
              [
                "Fresher (0–1 years)",
                "Mid-level (1–5 years)",
                "Senior (5–10 years)",
                "Leadership (10+ years)",
              ],
            );
          } else {
            setExperienceBand(band);
            const token = awsAuth.getToken() || undefined;
            await apiClient.post(
              "/candidate/experience",
              { experience: band },
              token,
            );

            // Evolutionary Skill Library: Fetch dynamic suggestions for the new band
            fetchSuggestedSkills(band);

            // Generate intelligent acknowledgment based on career readiness data
            let ackMessage = `Selected ${band} level.`;
            if (careerReadinessData) {
              const mode = careerReadinessData.job_search_mode || "opportunities";
              ackMessage += ` For your ${mode} journey, this experience level helps me tailor the right opportunities.`;
            }
            
            addMessage(ackMessage, "bot");

            const nextState = "AWAITING_RESUME_CHOICE";
            await saveStep(nextState);

            // Generate contextualized resume prompt
            setTimeout(() => {
              let resumePrompt = "Next, I'll need your resume to understand your background.";
              if (careerReadinessData?.target_market_segment) {
                resumePrompt += ` This will help me align your experience with ${careerReadinessData.target_market_segment} roles.`;
              }
              resumePrompt += " Would you like to upload a PDF or build it manually now?";
              
              addMessage(
                resumePrompt,
                "bot",
                ["Upload PDF", "Build Manually", "Skip for Now"],
              );
              setState(nextState);
            }, 1000);
          }
        }
      } else if (state === "AWAITING_RESUME_CHOICE") {
        const lowerInput = workingInput.toLowerCase();
        if (lowerInput.includes("upload")) {
          const nextState = "AWAITING_RESUME";
          await saveStep(nextState);
          setState(nextState);
          
          let uploadMsg = "Perfect! Please upload your resume (PDF only) using the button below.";
          if (onboardingMode === "conversational") {
            uploadMsg = "Excellent choice! Go ahead and upload your resume as a PDF file. This will help me quickly understand your background and experience.";
          }
          
          addMessage(uploadMsg, "bot", ["Skip Resume Upload"]);
        } else if (lowerInput.includes("build")) {
          const nextState = "AWAITING_MANUAL_BIO";
          await saveStep(nextState);
          setState(nextState);
          
          let buildMsg = "Great! Let's build your resume step-by-step. First, let's start with a short Professional Summary. What would you like to say about your career so far?";
          if (onboardingMode === "conversational") {
            buildMsg = "Perfect! I'll guide you through building your resume. Let's start with your professional summary—just tell me in your own words what your career journey looks like so far. What's your story?";
          }
          
          addMessage(buildMsg, "bot", [
            "I'm a fresh graduate eager to start",
            "Experienced Tech Sales person looking for growth",
            "Skip Summary"
          ]);
        } else if (lowerInput.includes("skip")) {
          let skipMsg = "No problem! We'll skip the resume for now. Let's move to your skills.";
          if (onboardingMode === "conversational") {
            skipMsg = "No worries! We can dive into your skills now and come back to your resume later if needed.";
          }
          
          addMessage(skipMsg, "bot");
          const nextState = "AWAITING_SKILLS";
          await saveStep(nextState);
          setState(nextState);
          
          setTimeout(() => {
            // Intelligent skills prompt
            let skillsMsg = "Tell me your key skills.";
            if (careerReadinessData?.target_market_segment) {
              skillsMsg += ` For ${careerReadinessData.target_market_segment} roles,`;
            } else {
              skillsMsg += " For your profile,";
            }
            skillsMsg += " think about: SaaS Sales, CRM, Prospecting, Negotiation, etc. Please separate them with commas.";
            
            if (onboardingMode === "conversational") {
              skillsMsg = "Now, tell me about your key skills and expertise. What are you really good at?";
              if (careerReadinessData?.target_market_segment) {
                skillsMsg += ` Think about skills that matter in ${careerReadinessData.target_market_segment} roles.`;
              }
            }
            
            addMessage(skillsMsg, "bot", ["Skip Skills"]);
          }, 1000);
        } else {
          let promptMsg = "Please choose an option to continue.";
          if (onboardingMode === "conversational") {
            promptMsg = "I didn't quite understand that. Would you like to upload a resume, build one with me, or skip for now?";
          }
          
          addMessage(promptMsg, "bot", ["Upload PDF", "Build Manually", "Skip for Now"]);
        }
      } else if (state === "AWAITING_MANUAL_BIO") {
        if (workingInput.toLowerCase().includes("skip")) {
          let skipMsg = "Skipping summary. Let's move to education.";
          if (onboardingMode === "conversational") {
            skipMsg = "Got it! Let's skip to your education details.";
          }
          addMessage(skipMsg, "bot");
        } else {
          setManualResumeData(prev => ({ ...prev, bio: workingInput }));
          
          // STRUCTURED MODE: Just accept bio and move on
          // CONVERSATIONAL MODE: AI-powered skill extraction
          if (onboardingMode === "conversational") {
            // AI-POWERED: Extract skills from bio with career readiness context
            console.log("[AI] Extracting skills from bio with career context...");
            
            // Generate intelligent contextual analysis message
            let analysisMsg = "Analyzing your background";
            if (careerReadinessData?.target_market_segment) {
              analysisMsg += ` for ${careerReadinessData.target_market_segment} roles`;
            }
            if (careerReadinessData?.job_search_mode) {
              analysisMsg += ` and your ${careerReadinessData.job_search_mode} objectives`;
            }
            analysisMsg += " to extract your key skills...";
            analysisMsg = "Love your story! Let me analyze what you've shared to identify your key strengths...";
            
            addMessage(analysisMsg, "bot");
            setIsLoading(true);
            
            try {
              const aiClient = getAIIntelligenceClient();
              const token = awsAuth.getToken() || undefined;
              
              const skillsResponse = await aiClient.extractSkillsFromBio(
                workingInput,
                experienceBand,
                token
              );
              
              if (skillsResponse && skillsResponse.status === "success") {
                const { primary_skills, suggested_skills, analysis, recommendations } = skillsResponse.data;
                
                console.log("[AI EXTRACT] Primary skills:", primary_skills);
                console.log("[AI EXTRACT] Suggested skills:", suggested_skills);
                console.log("[AI EXTRACT] Analysis:", analysis);
                
                // Smart acknowledgment referencing career data
                let ackMsg = `Excellent! I can see you have strong skills in: ${primary_skills.join(", ")}`;
                
                addMessage(ackMsg, "bot");
                
                // Contextual suggestion message
                let suggestionMsg = "Here are some skills I'd recommend developing: ";
                suggestionMsg += suggested_skills.join(", ");
                
                addMessage(suggestionMsg, "bot");
                
                // Development focus with reasoning
                if (recommendations && recommendations.length > 0) {
                  let recMsg = `Areas to focus on: ${recommendations.join(", ")}`;
                  addMessage(recMsg, "bot");
                }
                
                setSelectedSkills(primary_skills);
              }
            } catch (error) {
              console.error("[AI ERROR] Skill extraction failed:", error);
              // Continue without AI extraction
            }
            
            setIsLoading(false);
            
            let closingMsg = "Great! Now I have a solid understanding of your background.";
            addMessage(closingMsg, "bot");
          } else {
            // Structured mode: Simple acknowledgment without AI
            let confirmMsg = "Great! I've saved your professional summary.";
            addMessage(confirmMsg, "bot");
          }
        }
        
        const nextState = "AWAITING_MANUAL_EDUCATION";
        await saveStep(nextState);
        setState(nextState);
        
        // Generate intelligent education question based on experience level
        let educationPrompt = "Now, let's add your education history.";
        if (experienceBand) {
          educationPrompt += ` As a ${experienceBand} professional,`;
        }
        educationPrompt += " please tell me your: School/College Name, Degree, Field, Location, GPA, and Years.";
        
        if (onboardingMode === "conversational") {
          educationPrompt = "Now let's talk about your education. Tell me about your school, degree, and field of study.";
        }
        
        addMessage(
            educationPrompt,
            "bot",
            ["Skip Education"]
        )
      } else if (state === "AWAITING_MANUAL_EDUCATION") {
        const lowerInput = workingInput.toLowerCase();
        
        // Handle button clicks first (before trying to parse as education data)
        if (lowerInput.includes("skip") || lowerInput.includes("next") || lowerInput.includes("proceed to experience") || lowerInput.includes("skip to experience")) {
            const nextState = "AWAITING_MANUAL_EXPERIENCE";
            await saveStep(nextState);
            setState(nextState);
            
            // Generate intelligent experience question based on career readiness
            let expPrompt = "Let's move to your experience.";
            if (careerReadinessData?.job_search_mode) {
              expPrompt += ` Based on your focus on ${careerReadinessData.job_search_mode},`;
            }
            expPrompt += " please describe your: Role Title, Company Name, Location, Dates, and accomplishments.";
            
            if (onboardingMode === "conversational") {
              expPrompt = "Now let's talk about your work experience. Tell me about your roles, companies, and what you accomplished.";
            }
            
            addMessage(
                expPrompt,
                "bot",
                ["Skip Experience"]
            )
        } else if (lowerInput.includes("continue building")) {
            // Button click: "Continue Building" - just ask for education details
            let msg = "Please tell me your education details: School/College Name, Degree, Field, Location, GPA, and Years.";
            if (onboardingMode === "conversational") {
              msg = "Tell me about your education—where did you study and what did you graduate in?";
            }
            addMessage(msg, "bot");
        } else if (lowerInput.includes("add more education")) {
            // Button click: "Add More Education" - ask for next education entry
            let msg = "Sure! Please tell me your next School/College Name, Degree, Field, Location, GPA, and Years.";
            if (onboardingMode === "conversational") {
              msg = "Got it! Tell me about your next education.";
            }
            addMessage(msg, "bot");
        } else {
            // Parse as actual education input: School, Degree, Field, Location, GPA
            const edu = {
                school: workingInput.split(",")[0]?.trim() || "Institute",
                degree: workingInput.split(",")[1]?.trim() || "Degree",
                field: workingInput.split(",")[2]?.trim() || "Field",
                location: workingInput.split(",")[3]?.trim() || "Location",
                gpa: workingInput.split(",")[4]?.trim() || "0.0",
                start_year: "N/A",
                end_year: "N/A"
            }
            setManualResumeData(prev => ({ ...prev, education: [...prev.education, edu] }))
            
            // Intelligent confirmation with context
            let eduMsg = `Great! Recorded your ${edu.degree} from ${edu.school}`;
            if (careerReadinessData?.target_market_segment) {
              eduMsg += ` - this is valuable for ${careerReadinessData.target_market_segment} roles`;
            }
            eduMsg += ".";
            
            if (onboardingMode === "conversational") {
              eduMsg = `Perfect! I've got your education details: ${edu.degree} in ${edu.field} from ${edu.school}.`;
            }
            
            addMessage(eduMsg, "bot", ["Add More Education", "Proceed to Experience"])
        }
        setIsLoading(false);
      } else if (state === "AWAITING_MANUAL_EXPERIENCE") {
        const lowerInput = workingInput.toLowerCase();
        
        // Handle button clicks first (before trying to parse as experience data)
        if (lowerInput.includes("added more education") || lowerInput.includes("add more education")) {
            const nextState = "AWAITING_MANUAL_EDUCATION";
            await saveStep(nextState);
            setState(nextState);
            
            let msg = "Sure! Please tell me your other School/College Name and details.";
            if (onboardingMode === "conversational") {
              msg = "Got it! Tell me about your next education.";
            }
            
            addMessage(msg, "bot")
            setIsLoading(false);
            return;
        }

        if (lowerInput.includes("skip") || lowerInput.includes("next") || lowerInput.includes("proceed to skills")) {
             if (manualResumeData.experience.length === 0 && (lowerInput.includes("proceed") || lowerInput.includes("skip"))) {
                 // No experience added yet - re-ask for experience
                 let expMsg = "Alright, let's input your experience.";
                 if (experienceBand) {
                   expMsg += ` As a ${experienceBand}-level professional,`;
                 }
                 expMsg += " please tell me your: Role, Company, Location, Dates, and accomplishments.";
                 
                 if (onboardingMode === "conversational") {
                   expMsg = "No worries! Tell me about your work experience—what roles have you held and where?";
                 }
                 
                 addMessage(expMsg, "bot", ["Skip Experience"])
                setIsLoading(false);
                return;
             }
            // Move to skills
            const nextState = "AWAITING_MANUAL_SKILLS";
            await saveStep(nextState);
            setState(nextState);
            
            // Intelligent skills prompt based on career readiness and experience
            let skillsMsg = "Now, tell me your key skills.";
            if (experienceBand || careerReadinessData?.target_market_segment) {
              skillsMsg += ` Based on your ${experienceBand || "profile"} experience`;
              if (careerReadinessData?.target_market_segment) {
                skillsMsg += ` in ${careerReadinessData.target_market_segment}`;
              }
              skillsMsg += ",";
            }
            skillsMsg += " list: SaaS Sales, CRM, Prospecting, Negotiation, Cloud, etc. Separate with commas.";
            
            if (onboardingMode === "conversational") {
              skillsMsg = "Great! Now tell me about your key skills. What are you really good at?";
              if (careerReadinessData?.target_market_segment) {
                skillsMsg += ` Think about skills that matter in ${careerReadinessData.target_market_segment}.`;
              }
            }
            
            addMessage(
                skillsMsg,
                "bot",
                ["Skip Skills"]
            )
        } else if (lowerInput.includes("add more experience")) {
            // Button click: "Add More Experience" - just ask for more
            let msg = "Sure! Please tell me your next Role, Company, Location, and accomplishments.";
            if (onboardingMode === "conversational") {
              msg = "Absolutely! Tell me about your next role.";
            }
            
            addMessage(msg, "bot");
        } else {
            // Parse as actual experience input: Role, Company, Location, Dates, Description
            const exp = {
                role: workingInput.split(",")[0]?.trim() || "Role",
                company: workingInput.split(",")[1]?.trim() || "Company",
                location: workingInput.split(",")[2]?.trim() || "Location",
                start_date: "N/A",
                end_date: "N/A",
                description: workingInput,
                key_achievements: []
            }
            setManualResumeData(prev => ({ ...prev, experience: [...prev.experience, exp] }))
            
            // Intelligent experience confirmation with context
            let expMsg = `Excellent! Recorded your role at ${exp.company}`;
            if (experienceBand) {
              expMsg += ` as ${experienceBand}-level experience`;
            }
            if (careerReadinessData?.target_market_segment) {
              expMsg += ` - valuable for your ${careerReadinessData.target_market_segment} goals`;
            }
            expMsg += ".";
            
            if (onboardingMode === "conversational") {
              expMsg = `Perfect! Got your experience at ${exp.company} as ${exp.role}.`;
            }
            
            addMessage(expMsg, "bot", ["Add More Experience", "Proceed to Skills"])
        }
        setIsLoading(false);
      } else if (state === "AWAITING_MANUAL_SKILLS") {
        const lowerInput = workingInput.toLowerCase();
        
        // Handle button clicks first (before trying to parse as skills)
        if (lowerInput.includes("add more experience")) {
            const nextState = "AWAITING_MANUAL_EXPERIENCE";
            await saveStep(nextState);
            setState(nextState);
            
            let msg = "Sure! Please tell me your other Role and details.";
            if (onboardingMode === "conversational") {
              msg = "Absolutely! Tell me about your next role.";
            }
            
            addMessage(msg, "bot")
            setIsLoading(false);
            return;
        }

        if (lowerInput.includes("skip") || lowerInput.includes("next") || lowerInput.includes("proceed")) {
            const nextState = "AWAITING_MANUAL_CONTACT";
            await saveStep(nextState);
            setState(nextState);
            
            // Intelligent contact prompt
            let contactMsg = "Finally, let me get your contact details.";
            if (careerReadinessData?.job_search_mode) {
              contactMsg += ` So we can connect with you about ${careerReadinessData.job_search_mode} opportunities,`;
            }
            contactMsg += " please provide: Phone Number, Location, LinkedIn Profile (URL), and Portfolio (optional).";
            
            if (onboardingMode === "conversational") {
              contactMsg = "Great! To wrap up, I need a couple of final details: your phone number, location, and LinkedIn profile.";
            }
            
            addMessage(contactMsg, "bot")
            setIsLoading(false);
            return;
        }
        
        // Parse as actual skill input
        const skills = workingInput.split(",").map(s => s.trim()).filter(Boolean);
        
        if (skills.length === 0) {
            // No skills entered
            let msg = "Please enter at least one skill. Examples: CRM, SaaS Sales, Negotiation, Lead Generation.";
            if (onboardingMode === "conversational") {
              msg = "I didn't catch any skills there. What would you say are your key competencies?";
            }
            addMessage(msg, "bot");
            setIsLoading(false);
            return;
        }
        
        setManualResumeData(prev => ({ ...prev, skills: [...prev.skills, ...skills] }))
        
        // Intelligent confirmation message
        let confirmMsg = `Recorded ${skills.length} key skill`;
        confirmMsg += skills.length !== 1 ? "s" : "";
        if (careerReadinessData?.target_market_segment) {
          confirmMsg += ` for ${careerReadinessData.target_market_segment}`;
        }
        confirmMsg += ".";
        
        if (onboardingMode === "conversational") {
          confirmMsg = `Perfect! I've noted your skills: ${skills.join(", ")}.`;
        }
        
        addMessage(confirmMsg, "bot")
        
        const nextState = "AWAITING_MANUAL_CONTACT";
        await saveStep(nextState);
            setState(nextState);
            
            // Intelligent contact prompt
            let contactMsg = "Finally, let me get your contact details.";
            if (careerReadinessData?.job_search_mode) {
              contactMsg += ` So we can connect with you about ${careerReadinessData.job_search_mode} opportunities,`;
            }
            contactMsg += " please provide: Phone Number, Location, LinkedIn Profile (URL), and Portfolio (optional).";
            
            if (onboardingMode === "conversational") {
              contactMsg = "Alright! Last step—I need your contact information: phone number, location, and LinkedIn profile.";
            }
            
            addMessage(contactMsg, "bot")
            setIsLoading(false);
      } else if (state === "AWAITING_MANUAL_CONTACT") {
        const lowerInput = workingInput.toLowerCase();
        
        // Handle button clicks (skip or go back to skills)
        if (lowerInput.includes("skip contact") || lowerInput.includes("skip")) {
            // Skip contact details - they're optional
            let msg = "Skipping contact details. But having a phone number and location helps us match you better!";
            if (onboardingMode === "conversational") {
              msg = "All right, let's proceed without additional contact info. But know that adding them helps with better matches.";
            }
            addMessage(msg, "bot");
            
            // Still need phone and location for resume generation
            const defaultPhone = manualResumeData.phone || "";
            const defaultLocation = manualResumeData.location || "Remote";
            
            if (!defaultPhone || !defaultLocation) {
              let errorMsg = "Actually, we do need at least your phone number and location to generate the resume.";
              if (onboardingMode === "conversational") {
                errorMsg = "Hmm, I really do need your phone number and location to generate your resume properly.";
              }
              addMessage(errorMsg, "bot");
              setIsLoading(false);
              return;
            }
        } else if (lowerInput.includes("back") || lowerInput.includes("previous")) {
            // Go back to skills
            const nextState = "AWAITING_MANUAL_SKILLS";
            await saveStep(nextState);
            setState(nextState);
            
            let msg = "Sure! Let's add more skills. Tell me any additional skills you have.";
            if (onboardingMode === "conversational") {
              msg = "No problem! What other skills would you like to add?";
            }
            addMessage(msg, "bot");
            setIsLoading(false);
            return;
        }
        
        // Parse contact details: Phone, Location, LinkedIn, Portfolio
        const phone = workingInput.split(",")[0]?.trim() || manualResumeData.phone || "";
        const location = workingInput.split(",")[1]?.trim() || manualResumeData.location || "";
        const linkedin = workingInput.split(",")[2]?.trim() || manualResumeData.linkedin || "";
        const portfolio = workingInput.split(",")[3]?.trim() || manualResumeData.portfolio || "";
        
        // Validate required fields
        if (!phone || !location) {
            let errorMsg = "I need at least your phone number and location to generate the resume. Please provide both.";
            if (onboardingMode === "conversational") {
              errorMsg = "I need your phone number and location to create your resume. Can you share both?";
            }
            addMessage(errorMsg, "bot");
            setIsLoading(false);
            return;
        }
        
        setManualResumeData(prev => ({ ...prev, phone, location, linkedin, portfolio }));
        
        let completeMsg = "Perfect! I have everything I need to generate your high-fidelity resume.";
        let generatingMsg = "Generating your resume PDF and syncing your profile... please wait.";
        
        if (onboardingMode === "conversational") {
          completeMsg = "Awesome! I've got everything. Let me create your professional resume now.";
          generatingMsg = "Building your resume and syncing your profile... just a moment.";
        }
        
        addMessage(completeMsg, "bot");
        addMessage(generatingMsg, "bot");
        
        const user = awsAuth.getUser();
        const token = awsAuth.getToken() || undefined;
        
        // Generate via API
        const payload = {
            full_name: extractNameFromEmail(user?.email || ""),
            phone: phone,
            email: user?.email || "",
            location: location || "Remote",
            linkedin: linkedin,
            portfolio: portfolio,
            bio: manualResumeData.bio,
            education: manualResumeData.education.length > 0 ? manualResumeData.education.map(e => ({
                school: e.school,
                degree: e.degree,
                field: e.field,
                location: e.location,
                gpa: e.gpa,
                years: `${e.start_year || ""} - ${e.end_year || ""}`.trim()
            })) : [],
            timeline: manualResumeData.experience.length > 0 ? manualResumeData.experience.map(ex => ({
                role: ex.role,
                company: ex.company,
                location: ex.location,
                start: ex.start_date,
                end: ex.end_date,
                description: ex.description,
                key_achievements: ex.key_achievements || []
            })) : [],
            skills: manualResumeData.skills.length > 0 ? manualResumeData.skills : []
        };

        try {
          const res = await apiClient.post("/candidate/generate-resume", payload, token);
          
          if (res.status === "resume_generated" || res.path) {
               addMessage(`Resume generated successfully!`, "bot");
               addMessage("You can download it from your profile later. Now, let's finalize your skills.", "bot");
               setSelectedSkills(manualResumeData.skills);
               
               const nextState = "AWAITING_SKILLS";
               await saveStep(nextState);
               setState(nextState);
          } else {
              throw new Error("Failed to generate resume PDF. Response: " + JSON.stringify(res));
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to generate resume";
          console.error("[RESUME_GEN_ERROR]", errorMsg);
          addMessage(`Error: ${errorMsg}. Please try again or skip to continue.`, "bot");
        }
        setIsLoading(false);

      } else if (state === "AWAITING_SKILLS") {
        const lowerInput = workingInput.toLowerCase();
        if (lowerInput.includes("skip")) {
          let skipMsg = "No problem! We'll skip skills for now. Let's move to your career vision.";
          if (onboardingMode === "conversational") {
            skipMsg = "Got it! Let's move on to your career goals.";
          }
          
          addMessage(skipMsg, "bot");
          const nextState = "AWAITING_GPS_VISION";
          await saveStep(nextState);
          setState(nextState);
          
          setTimeout(() => {
            let visionMsg = "Before we finish, let's look at your future. What's your target role in IT Tech Sales (e.g. Enterprise AE)?";
            if (onboardingMode === "conversational") {
              visionMsg = "What's your ideal next role or career goal? Paint me a picture of where you want to be.";
            }
            
            addMessage(visionMsg, "bot", ["Skip Career Vision for Now"]);
          }, 1000);
          setIsLoading(false);
          return;
        }

        let finalSkills = [...selectedSkills];

        if (onboardingMode === "conversational") {
          // CONVERSATIONAL MODE: AI-powered skills extraction
          setIsLoading(true);
          addMessage("Analyzing your skills...", "bot");
          
          try {
            const aiClient = getAIIntelligenceClient();
            const token = awsAuth.getToken() || undefined;
            const history = buildConversationHistory();
            
            const analysisResponse = await aiClient.processConversationalOnboarding(
              workingInput,
              history,
              token
            );
            
            if (analysisResponse?.extracted_keywords && Array.isArray(analysisResponse.extracted_keywords)) {
              const extractedSkills = analysisResponse.extracted_keywords
                .filter((s: string) => s.length > 0 && !selectedSkills.includes(s))
                .slice(0, 10); // Limit to 10 extracted skills
              
              finalSkills = [...selectedSkills, ...extractedSkills];
            }
          } catch (error) {
            console.error("[AI] Skills extraction failed, falling back to manual:", error);
            // FALLBACK: Simple comma-separated parsing
            const skillsFromInput = workingInput
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0 && !selectedSkills.includes(s));
            finalSkills = [...selectedSkills, ...skillsFromInput];
          }
          
          setIsLoading(false);
        } else {
          // STRUCTURED MODE: Manual parsing or pill selection
          const skillsFromInput = workingInput
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0 && !selectedSkills.includes(s));

          finalSkills = [...selectedSkills, ...skillsFromInput];
        }

        if (finalSkills.length === 0) {
          let emptyMsg = "Please select or type at least one skill.";
          if (onboardingMode === "conversational") {
            emptyMsg = "I didn't catch any skills there. Tell me about what you're good at.";
          }
          
          addMessage(emptyMsg, "bot");
        } else {
          const token = awsAuth.getToken() || undefined;
          await apiClient.post(
            "/candidate/skills",
            { skills: finalSkills },
            token,
          );

          let confirmMsg = "Skills saved! Your profile is now enriched.";
          if (onboardingMode === "conversational") {
            confirmMsg = `Great! I've recorded your skills: ${finalSkills.slice(0, 5).join(", ")}${finalSkills.length > 5 ? " and more" : ""}.`;
          }

          addMessage(confirmMsg, "bot");

          // 🎯 NEW: Calculate Career Fit Score using AI
          try {
            if (token) {
              let fitMsg = "🔍 Analyzing your career fit...";
              if (onboardingMode === "conversational") {
                fitMsg = "Let me analyze how well your profile matches your career goals...";
              }
              
              addMessage(fitMsg, "bot");
              
              const aiClient = getAIIntelligenceClient();
              
              // Get personalized target role from careerReadinessData
              const targetRoleForFit = careerReadinessData?.target_role || "";
              
              const careerFitResponse = await aiClient.calculateCareerFit(
                targetRoleForFit, // PERSONALIZED: Pass actual target_role extracted from conversation
                true, // includeFullAnalysis
                token
              );
              
              if (careerFitResponse.status === "success") {
                const fitData = careerFitResponse.data;
                
                // Display career fit score to user
                let fitMessage: string;
                if (onboardingMode === "conversational") {
                  fitMessage = 
                    `\n💪 **Your Career Fit Score: ${fitData.overall_fit_score}%**` +
                    `\n\nBased on your target role: **${targetRoleForFit || "Sales Professional"}**` +
                    `\n\n${fitData.strengths.slice(0, 3).map(s => `✓ ${s}`).join("\n")}` +
                    `\n\n🎯 To strengthen your fit:\n${fitData.skill_gaps.slice(0, 2).map((g: any) => `• ${g.skill}`).join("\n")}`;
                } else {
                  fitMessage = 
                    `\n📊 **Your Career Fit Score: ${fitData.overall_fit_score}%**` +
                    `\n\nfor: **${targetRoleForFit || "Sales Professional"}**` +
                    `\n\n✨ Your Strengths:\n${fitData.strengths.slice(0, 3).map(s => `  • ${s}`).join("\n")}` +
                    `\n\n🎯 Focus Areas:\n${fitData.skill_gaps.slice(0, 2).map((g: any) => `  • ${g.skill} (${g.importance})`).join("\n")}` +
                    `\n\n⏱️ Ready in: ${fitData.timeline_to_ready}`;
                }
                
                addMessage(fitMessage, "bot");
                
                console.log("[CAREER FIT] Score calculated for role:", targetRoleForFit, "Score:", fitData.overall_fit_score);
              } else {
                console.warn("[CAREER FIT] Scoring failed, continuing without it");
              }
            }
          } catch (fitError) {
            console.error("[CAREER FIT ERROR]", fitError);
            // Don't block onboarding if fit scoring fails
          }

          const nextState = "AWAITING_GPS_VISION";
          await saveStep(nextState);
          setState(nextState);

          setTimeout(() => {
            let visionMsg = "Before we finish, let's look at your future. What's your target role in IT Tech Sales (e.g. Enterprise AE)?";
            if (onboardingMode === "conversational") {
              visionMsg = "Now, let's talk about your vision. Where do you see yourself in the next few years?";
            }
            
            addMessage(visionMsg, "bot", ["Skip Career Vision for Now"]);
          }, 1000);
        }
      } else if (state === "AWAITING_GPS_VISION") {
        if (workingInput.toLowerCase().includes("skip")) {
          let skipMsg = "No problem! You can set up your Career GPS anytime from your dashboard.";
          if (onboardingMode === "conversational") {
            skipMsg = "Got it! We can skip this for now. Let's wrap up with one final step.";
          }
          
          addMessage(skipMsg, "bot");
          const nextState = "AWAITING_ID";
          await saveStep(nextState);
          setState(nextState);
          
          setTimeout(() => {
            let idMsg = "Now, for verification and security, please upload a scan or photo of your government-issued ID (DL, Passport, etc).";
            if (onboardingMode === "conversational") {
              idMsg = "Almost done! For verification and security, I'll need a photo of your government-issued ID—driver's license or passport works.";
            }
            
            addMessage(idMsg, "bot", ["Skip ID Proof for Now"]);
          }, 1000);
        } else {
          // EXTRACT TARGET ROLE WITH AI (CONVERSATIONAL) OR RULES (STRUCTURED)
          let targetRole = workingInput;
          
          if (onboardingMode === "conversational") {
            // AI-powered target role extraction
            setIsLoading(true);
            try {
              const aiClient = getAIIntelligenceClient();
              const token = awsAuth.getToken() || undefined;
              const history = buildConversationHistory();
              
              // Use AI to extract/refine target role
              const roleResponse = await aiClient.processConversationalOnboarding(
                workingInput,
                history,
                token
              );
              
              if (roleResponse?.extracted_info?.target_role) {
                targetRole = roleResponse.extracted_info.target_role;
              }
            } catch (error) {
              console.error("[AI] Target role extraction failed, using input directly:", error);
              // Fallback: Use the client-side extraction
              const extracted = extractKeyDataFromNarrative(workingInput);
              if (extracted.target_role) {
                targetRole = extracted.target_role;
              }
            } finally {
              setIsLoading(false);
            }
          } else {
            // Structured mode: Use client-side extraction as well
            const extracted = extractKeyDataFromNarrative(workingInput);
            if (extracted.target_role) {
              targetRole = extracted.target_role;
            }
          }
          
          // Save target_role
          try {
            const token = awsAuth.getToken();
            if (!token) {
              addMessage("Error: Authentication required. Please log in again.", "bot");
              return;
            }
            
            const result = await apiClient.patch(
              "/candidate/profile",
              { target_role: targetRole },
              token,
            );
            
            if (result) {
              let confirmMsg = `Got it! Target Role: ${targetRole}. This will help guide your Career GPS.`;
              if (onboardingMode === "conversational") {
                confirmMsg = `Perfect! I can see you're aiming for a **${targetRole}** role. That's a great direction!`;
              }
              
              addMessage(confirmMsg, "bot");
              
              // Save to career readiness data
              setCareerReadinessData(prev => ({ ...prev, target_role: targetRole }));
              saveCRDataToStorage({ target_role: targetRole });
            }
          } catch (err) {
            console.error("Error saving target_role:", err);
            addMessage(`Error saving target role: ${err instanceof Error ? err.message : "Unknown error"}`, "bot");
            return;
          }

          const nextState = "AWAITING_GPS_INTERESTS";
          await saveStep(nextState);
          setState(nextState);
          
          setTimeout(() => {
            let interestMsg = "Which specific categories or tech verticals interest you most (e.g. SaaS, Cloud, CyberSecurity)?";
            if (onboardingMode === "conversational") {
              interestMsg = "What industries or technology areas excite you the most? Tell me about the sectors that energize you.";
            }
            
            addMessage(interestMsg, "bot", ["Skip This Step"]);
          }, 1000);
        }
      } else if (state === "AWAITING_GPS_INTERESTS") {
        if (workingInput.toLowerCase().includes("skip")) {
          let skipMsg = "Skipping interests for now.";
          if (onboardingMode === "conversational") {
            skipMsg = "No problem! Let's move on.";
          }
          
          addMessage(skipMsg, "bot");
        } else {
          // EXTRACT INTERESTS WITH AI (CONVERSATIONAL) OR RULES (STRUCTURED)
          let interestsArray: string[] = [];
          
          if (onboardingMode === "conversational") {
            // AI-powered interests extraction
            setIsLoading(true);
            try {
              const aiClient = getAIIntelligenceClient();
              const token = awsAuth.getToken() || undefined;
              const history = buildConversationHistory();
              
              // Use AI to extract and categorize interests
              const interestResponse = await aiClient.processConversationalOnboarding(
                workingInput,
                history,
                token
              );
              
              if (interestResponse?.extracted_keywords && Array.isArray(interestResponse.extracted_keywords)) {
                interestsArray = interestResponse.extracted_keywords
                  .filter((s: string) => s.length > 0)
                  .slice(0, 10);
              }
            } catch (error) {
              console.error("[AI] Interests extraction failed, falling back to rules:", error);
              // Fallback: Client-side extraction of tech verticals
              const techVerticals = [
                "SaaS", "Cloud", "CyberSecurity", "AI", "ML", "DevOps",
                "Blockchain", "IoT", "Data Science", "Enterprise", "Startup"
              ];
              const lower = workingInput.toLowerCase();
              interestsArray = techVerticals.filter(tech => lower.includes(tech.toLowerCase()));
            } finally {
              setIsLoading(false);
            }
          } else {
            // Structured mode: Simple comma split
            interestsArray = workingInput
              .split(",")
              .map((i) => i.trim())
              .filter(Boolean);
          }
          
          if (interestsArray.length === 0) {
            // Fallback: Try regex-based extraction
            const lower = workingInput.toLowerCase();
            const verticalKeywords: Record<string, string[]> = {
              "SaaS": ["saas", "software as a service", "cloud software"],
              "Cloud": ["cloud", "aws", "azure", "gcp"],
              "Security": ["security", "cybersecurity", "infosec"],
              "AI/ML": ["ai", "ml", "artificial intelligence", "machine learning", "deep learning"],
              "Data": ["data science", "analytics", "big data"],
              "Enterprise": ["enterprise", "large organizations", "fortune 500"],
            };
            
            Object.entries(verticalKeywords).forEach(([vertical, keywords]) => {
              if (keywords.some(kw => lower.includes(kw))) {
                interestsArray.push(vertical);
              }
            });
          }
          
          if (interestsArray.length === 0) {
            // If still empty, use the input as-is
            interestsArray = [workingInput];
          }
          
          try {
            const token = awsAuth.getToken();
            if (!token) {
              addMessage("Error: Authentication required. Please log in again.", "bot");
              return;
            }
            
            const result = await apiClient.patch(
              "/candidate/profile",
              { career_interests: interestsArray },
              token,
            );
            
            if (result) {
              let confirmMsg = `Tech Interests recorded: ${interestsArray.join(", ")}`;
              if (onboardingMode === "conversational") {
                confirmMsg = `Awesome! I've noted your interests in: ${interestsArray.join(", ")}.`;
              }
              
              addMessage(confirmMsg, "bot");
              
              // Save to career readiness data
              setCareerReadinessData(prev => ({ ...prev, career_interests: interestsArray }));
              saveCRDataToStorage({ career_interests: interestsArray });
            }
          } catch (err) {
            console.error("Error saving career_interests:", err);
            addMessage(`Error saving interests: ${err instanceof Error ? err.message : "Unknown error"}`, "bot");
            return;
          }
        }
        
        const nextState = "AWAITING_GPS_GOAL";
        await saveStep(nextState);
        setState(nextState);
        
        setTimeout(() => {
          let goalMsg = "Finally, what's your ultimate career long-term goal?";
          if (onboardingMode === "conversational") {
            goalMsg = "Looking further ahead, what's your biggest career dream? What would success look like for you?";
          }
          
          addMessage(goalMsg, "bot", ["Skip Goal Setting"]);
        }, 1000);
      } else if (state === "AWAITING_GPS_GOAL") {
        if (workingInput.toLowerCase().includes("skip")) {
          let skipMsg = "Skipping long-term goal for now.";
          if (onboardingMode === "conversational") {
            skipMsg = "No problem! You can update this later.";
          }
          
          addMessage(skipMsg, "bot");
        } else {
          // EXTRACT LONG-TERM GOAL WITH AI (CONVERSATIONAL) OR RULES (STRUCTURED)
          let longTermGoal = workingInput;
          
          if (onboardingMode === "conversational") {
            // AI-powered goal extraction and clarification
            setIsLoading(true);
            try {
              const aiClient = getAIIntelligenceClient();
              const token = awsAuth.getToken() || undefined;
              const history = buildConversationHistory();
              
              // Use AI to extract and refine long-term goal
              const goalResponse = await aiClient.processConversationalOnboarding(
                workingInput,
                history,
                token
              );
              
              // API response will acknowledge the goal; use input as recorded goal
              // This allows natural conversation while preserving user's exact wording
            } catch (error) {
              console.error("[AI] Goal extraction failed, using input directly:", error);
              // Fallback: Use the input as-is
              longTermGoal = workingInput;
            } finally {
              setIsLoading(false);
            }
          }
          
          try {
            const token = awsAuth.getToken();
            if (!token) {
              addMessage("Error: Authentication required. Please log in again.", "bot");
              return;
            }
            
            const result = await apiClient.patch(
              "/candidate/profile",
              { long_term_goal: longTermGoal },
              token,
            );
            
            if (result) {
              let confirmMsg = "Career vision captured! We'll use this to build your personalized Career GPS.";
              if (onboardingMode === "conversational") {
                confirmMsg = `That's an inspiring goal! I'll use this to help guide your career path towards achieving that vision.`;
              }
              
              addMessage(confirmMsg, "bot");
              
              // Save to career readiness data
              setCareerReadinessData(prev => ({ ...prev, long_term_goal: longTermGoal }));
              saveCRDataToStorage({ long_term_goal: longTermGoal });
            }
          } catch (err) {
            console.error("Error saving long_term_goal:", err);
            addMessage(`Error saving goal: ${err instanceof Error ? err.message : "Unknown error"}`, "bot");
            return;
          }
        }
        
        const nextState = "AWAITING_ID";
        await saveStep(nextState);
        setState(nextState);
        
        setTimeout(() => {
          let idMsg = "Now, for verification and security, please upload a scan or photo of your government-issued ID (DL, Passport, etc).";
          if (onboardingMode === "conversational") {
            idMsg = "Last step! I'll need a photo of your government-issued ID—driver's license or passport—for verification.";
          }
          
          addMessage(idMsg, "bot", ["Skip ID Proof for Now"]);
        }, 1000);
      } else if (state === "AWAITING_ID") {
        if (workingInput.toLowerCase().includes("skip")) {
          let skipMsg = "Skipping ID upload. Please note your profile will not be 'Verified' without this.";
          if (onboardingMode === "conversational") {
            skipMsg = "Got it! We can skip this for now, but adding ID verification later will help build trust.";
          }
          
          addMessage(skipMsg, "bot");
          const nextState = "AWAITING_TC";
          await saveStep(nextState);
          setState(nextState);
          
          setTimeout(() => {
            let tcMsg = "Lastly, please read and accept our Terms and Conditions to complete your onboarding.";
            if (onboardingMode === "conversational") {
              tcMsg = "Almost there! Let's finish by reviewing and accepting our Terms and Conditions.";
            }
            
            addMessage(tcMsg, "bot", ["Read Terms & Conditions", "Accept & Finish"]);
          }, 1000);
        } else {
          // Add a message if someone tries to type during ID upload step
          let uploadMsg = "Please upload your ID document using the upload button below.";
          if (onboardingMode === "conversational") {
            uploadMsg = "Ready when you are! Use the upload button to submit your ID.";
          }
          
          addMessage(uploadMsg, "bot", ["Skip ID Proof for Now"]);
        }
      } else if (state === "AWAITING_TC") {
        if (workingInput.toLowerCase().includes("read")) {
          setIsTermsModalOpen(true);
          setIsLoading(false);
          return;
        }

        const token = awsAuth.getToken() || undefined;

        // Call backend to mark TC accepted
        await apiClient.post("/candidate/accept-tc", {}, token);

        let completeMsg = "Terms accepted! Your onboarding is now complete.";
        let roadmapMsg = "🚀 Generating your personalized roadmap...";
        
        if (onboardingMode === "conversational") {
          completeMsg = "Perfect! You're all set! Let me create your personalized career roadmap.";
          roadmapMsg = "Building your personalized career strategy...";
        }

        addMessage(completeMsg, "bot");

        // 🎯 NEW: Get Personalized Recommendations
        try {
          if (token) {
            addMessage(roadmapMsg, "bot");
            
            const aiClient = getAIIntelligenceClient();
            
            // PERSONALIZED: Map experience band to career stage
            const experienceStageMap: Record<string, string> = {
              fresher: "fresher",         // 0-1 years
              mid: "mid_level",           // 1-5 years
              senior: "senior",           // 5-10 years
              leadership: "leadership"    // 10+ years
            };
            
            const careerStageForRecs = experienceStageMap[experienceBand] || "mid_level";
            
            const recommendationsResponse = await aiClient.getPersonalizedRecommendations(
              careerStageForRecs, // PERSONALIZED: Pass user's actual experience band instead of hardcoded "early_career"
              true, // includeTimeline
              token
            );
            
            if (recommendationsResponse.status === "success") {
              const recs = recommendationsResponse.data;
              
              // Build personalized context strings
              const targetRoleContext = careerReadinessData?.target_role ? ` for ${careerReadinessData.target_role}` : "";
              const experienceLevelLabel = experienceStageMap[experienceBand] || "your career stage";
              const skillsContext = selectedSkills.length > 0 ? ` with your skills in ${selectedSkills.slice(0, 2).join(", ")}` : "";
              
              // Display personalized recommendations
              let recsMessage: string;
              if (onboardingMode === "conversational") {
                recsMessage = 
                  `\n🎯 **Here's your game plan**${targetRoleContext}` +
                  `\n\nBased on your **${experienceLevelLabel}** experience${skillsContext}:` +
                  `\n\n**This week's actions:**` +
                  `\n${recs.immediate_actions.slice(0, 3).map((a: string) => `✓ ${a}`).join("\n")}` +
                  `\n\n📚 **Focus on these skills:**` +
                  `\n${Object.keys(recs.skill_development).slice(0, 2).map((skill: string) => `• ${skill}`).join("\n")}` +
                  `\n\n💬 **Pro interview tips:**` +
                  `\n${recs.interview_prep_suggestions.slice(0, 2).map((tip: string) => `• ${tip}`).join("\n")}` +
                  `\n\nLet's get started! 🚀`;
              } else {
                recsMessage = 
                  `\n🎯 **Your Next Steps**${targetRoleContext}` +
                  `\n\nPersonalized for **${experienceLevelLabel}** career stage:` +
                  `\n\n${recs.immediate_actions.slice(0, 3).map((a: string) => `  ✓ ${a}`).join("\n")}` +
                  `\n\n📚 **Skills to Focus On:**` +
                  `\n${Object.keys(recs.skill_development).slice(0, 2).map((skill: string) => `  • ${skill}`).join("\n")}` +
                  `\n\n💡 **Interview Tips:**` +
                  `\n${recs.interview_prep_suggestions.slice(0, 2).map((tip: string) => `  • ${tip}`).join("\n")}` +
                  `\n\n📅 **Timeline:** ${recs.timeline_milestones ? recs.timeline_milestones[0] : "Start immediately"}`;
              }
              
              addMessage(recsMessage, "bot");
              
              console.log("[RECOMMENDATIONS] Generated for stage:", careerStageForRecs);
            } else {
              console.warn("[RECOMMENDATIONS] Generation failed, continuing without it");
            }
          }
        } catch (recsError) {
          console.error("[RECOMMENDATIONS ERROR]", recsError);
          // Don't block onboarding if recommendations fail
        }

        const nextState = "COMPLETED";
        await saveStep(nextState);
        setState(nextState);

        setTimeout(() => {
          addMessage(
            "Welcome aboard! You are now eligible to apply for jobs. However, to get a 'Verified' badge and attract premium recruiters, you should take the assessment. Ready?",
            "bot",
            ["Start Assessment", "I'll do it later"],
          );
        }, 1500);
      } else if (state === "COMPLETED") {
        const lowerInput = workingInput.toLowerCase();
        if (lowerInput.includes("later") || lowerInput.includes("skip") || lowerInput.includes("do it later")) {
          addMessage("No problem! You can start your assessment anytime from the dashboard. Redirecting you to your profile...", "bot");
          setTimeout(() => {
            router.replace("/dashboard/candidate");
          }, 1500);
          return;
        } else if (lowerInput.includes("start") || lowerInput.includes("assessment") || lowerInput.includes("ready")) {
          addMessage("Redirecting you to the assessment suite...", "bot");
          setTimeout(() => {
            router.replace("/assessment/candidate");
          }, 1500);
          return;
        } else {
          // Fallback guidance if they type something else
          addMessage("Would you like to start the assessment now or do it later?", "bot", ["Start Assessment", "I'll do it later"]);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      addMessage(`Error: ${errorMsg}`, "bot");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLoading) return;

    // Client-side size restriction (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large! Maximum allowed is 5MB.");
      return;
    }

    setIsLoading(true);
    addMessage(`Uploading ${file.name}...`, "user");

    try {
      const user = awsAuth.getUser();
      const token = awsAuth.getToken();
      if (!user || !token) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const bucket = state === "AWAITING_RESUME" ? "resumes" : "id-proofs";
      const endpoint = state === "AWAITING_RESUME" ? "/storage/upload/resume" : "/storage/upload/aadhaar";
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Upload via backend API which handles S3
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "/api"}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.detail || "Upload failed");
      }
      
      const uploadPayload = await uploadRes.json();
      console.log("DEBUG: S3 Upload Response Payload:", uploadPayload);
      
      const file_url = uploadPayload.url || uploadPayload.file_url || uploadPayload.path;

      if (state === "AWAITING_RESUME") {
        console.log("DEBUG: Sending to /candidate/resume payload:", { resume_path: file_url });
        const res = await apiClient.post(
          "/candidate/resume",
          { resume_path: file_url },
          token,
        );

        if (res.status === "processing" || res.parsed) {
          addMessage(
            "Resume uploaded! I am analyzing your profile now. This will only take a moment...",
            "bot",
          );

          // Poll for skills if they weren't returned immediately
          if (!res.data?.skills || res.data.skills.length === 0) {
            let attempts = 0;
            const pollInterval = setInterval(async () => {
              attempts++;
              if (attempts > 10) {
                clearInterval(pollInterval);
                return;
              }

              try {
                const profileRes = await apiClient.get("/candidate/profile", token);
                if (profileRes && profileRes.skills && profileRes.skills.length > 0) {
                  setSelectedSkills(profileRes.skills);
                  addMessage(`I've identified these key skills from your profile: ${profileRes.skills.join(", ")}`, "bot");
                  clearInterval(pollInterval);
                }
              } catch (e) {
                console.error("Polling error:", e);
              }
            }, 3000);
          } else {
            const skills: string[] = res.data.skills || [];
            setSelectedSkills(skills);
            addMessage(`I've identified these key skills from your profile: ${skills.join(", ")}`, "bot");
          }
        } else {
          addMessage(
            "Resume uploaded! However, I couldn't automatically scan it because the AI keys are not set up yet.",
            "bot",
          );
        }

        setTimeout(async () => {
          addMessage(
            "Are there any other top 3 tech sales skills (e.g., SaaS, Lead Gen, Negotiation) you'd like to add?",
            "bot",
          );
          const nextState = "AWAITING_SKILLS";
          await saveStep(nextState);
          setState(nextState);
        }, 1000);
      } else if (state === "AWAITING_ID") {
        await apiClient.post(
          "/candidate/verify-id",
          { id_url: file_url },
          token,
        );

        addMessage("ID document uploaded and received!", "bot");

        setTimeout(async () => {
          addMessage(
            "Last step: Please accept our Terms and Conditions to finalize your profile.",
            "bot",
            ["Read Terms & Policy", "Accept Terms & Conditions"],
          );
          const nextState = "AWAITING_TC";
          await saveStep(nextState);
          setState(nextState);
        }, 1000);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      addMessage(`Upload failed: ${errorMsg}`, "bot");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
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
            <span className="font-bold text-slate-900">
              TechSales Axis Onboarding
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Logout
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-4 scroll-smooth max-w-5xl mx-auto w-full"
      >
        {/* Mode Selection Screen - Appears first */}
        {state === "INITIAL" && !onboardingMode && (
          <div className="flex flex-col gap-6 justify-center items-center h-full">
            <div className="text-center max-w-2xl">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                How would you like to onboard? 🎯
              </h2>
              <p className="text-slate-600 text-lg mb-8">
                Choose your preferred communication style. You can always answer with text or voice.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
              {/* Structured Mode */}
              <button
                onClick={() => {
                  setOnboardingMode("structured");
                  // Show first career readiness question
                  setTimeout(() => {
                    addMessage(
                      "What's your current employment situation?",
                      "bot",
                      [
                        "I'm currently employed",
                        "I'm between roles",
                        "I'm a student",
                        "I'm not working",
                      ]
                    );
                    setState("AWAITING_EMPLOYMENT_STATUS");
                  }, 500);
                }}
                className="p-8 border-2 border-slate-200 rounded-2xl hover:border-primary hover:bg-primary-light transition-all text-left hover:shadow-lg"
              >
                <div className="text-4xl mb-4">📋</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Guided Questions
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Answer organized questions with suggested options. Quick, straightforward, and efficient.
                </p>
              </button>

              {/* Conversational Mode */}
              <button
                onClick={() => {
                  setOnboardingMode("conversational");
                  // Show conversational intro
                  setTimeout(() => {
                    addMessage(
                      `I'm here to understand your career goals in IT Tech Sales. Tell me about yourself - your current situation, experience, skills, what you're looking for, anything relevant! Feel free to share naturally, and I'll intelligently extract the information we need.`,
                      "bot"
                    );
                    setState("AWAITING_EMPLOYMENT_STATUS");
                  }, 500);
                }}
                className="p-8 border-2 border-slate-200 rounded-2xl hover:border-primary hover:bg-primary-light transition-all text-left hover:shadow-lg"
              >
                <div className="text-4xl mb-4">🧠</div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  AI Chat Mode
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Have a natural conversation. Our AI intelligently understands and extracts information from what you share.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Unified Onboarding Messages - All States */}
        {onboardingMode && messages.map((msg) => (
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
                  color: "#374151",  // Explicit dark gray fallback
                  backgroundColor: "#f8fafc"  // Explicit light gray fallback
                } : msg.sender === "user" ? {
                  color: "#374151"  // Explicit white for user messages
                } : {}}
              >
                {msg.text}
              </div>
              {msg.options && (
                <div className="flex flex-wrap gap-2.5 mt-4">
                  {msg.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSend(opt)}
                      disabled={isLoading}
                      className="px-5 py-2.5 bg-white hover:bg-primary-light border border-slate-200 hover:border-primary-light rounded-full text-sm font-semibold text-slate-800 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      style={{
                        color: "#1f2937",  // Explicit dark gray text
                        backgroundColor: "#ffffff",  // Explicit white background
                        borderColor: "#e2e8f0"  // Explicit light border
                      }}
                    >
                      {opt}
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

      {/* Input Area */}
      <div className="px-6 py-6 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto relative flex flex-col gap-3">
          {state === "AWAITING_SKILLS" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-lg z-10 max-h-[40vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b border-slate-50">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Select key skills for {experienceBand} level
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Pick from suggestions or add your own below
                  </span>
                </div>
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || selectedSkills.length === 0}
                  className="bg-primary hover:bg-primary-dark text-white text-[10px] font-bold px-4 py-2.5 rounded-full transition-all shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isLoading ? "Saving..." : "CONFIRM SKILLS"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {suggestedSkills?.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedSkills.includes(skill)
                        ? "bg-primary text-white shadow-md shadow-primary-light"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>

              {selectedSkills.filter(
                (s) => !suggestedSkills?.includes(s),
              ).length > 0 && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                      Custom / Extracted Skills
                    </span>
                    <span className="text-[10px] text-primary font-medium bg-primary-light px-2 py-0.5 rounded-full">
                      {
                        selectedSkills.filter(
                          (s) =>
                            !suggestedSkills?.includes(s),
                        ).length
                      }{" "}
                      Total
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSkills
                      .filter(
                        (s) =>
                          !suggestedSkills?.includes(s),
                      )
                      .map((skill) => (
                        <div
                          key={skill}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100 group"
                        >
                          {skill}
                          <button
                            onClick={() => toggleSkill(skill)}
                            className="text-emerald-300 hover:text-emerald-700 transition-colors"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2 / 5}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {(state === "AWAITING_RESUME" || state === "AWAITING_ID") && (
            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
              <input
                type="file"
                accept={state === "AWAITING_RESUME" ? ".pdf" : "image/*,.pdf"}
                onChange={handleFileUpload}
                disabled={isLoading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-sm font-medium">
                  {state === "AWAITING_RESUME"
                    ? "Click to upload Resume (PDF)"
                    : "Click to upload Govt ID Proof (Image/PDF)"}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-light transition-all px-2 py-2 rounded-2xl">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                state === "AWAITING_RESUME" || state === "AWAITING_ID"
                  ? "Please use the upload box above"
                  : state === "AWAITING_SKILLS"
                    ? "Add custom skills (comma separated)..."
                    : state.startsWith("AWAITING_MANUAL")
                      ? "Type your details here..."
                      : "Type your response..."
              }
              disabled={
                isLoading ||
                state === "AWAITING_RESUME" ||
                state === "AWAITING_ID"
              }
              className="flex-1 bg-transparent px-4 py-2 text-slate-700 placeholder:text-slate-500 focus:outline-none text-sm font-medium"
            />
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={state === "AWAITING_RESUME" || state === "AWAITING_ID"}
              className={`p-2.5 rounded-xl transition-all ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-slate-400 hover:text-primary hover:bg-white border border-transparent hover:border-slate-100"
              } disabled:opacity-50`}
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
              onClick={() => handleSend()}
              disabled={
                isLoading ||
                state === "AWAITING_RESUME" ||
                (!input.trim() && state !== "AWAITING_SKILLS") ||
                (state === "AWAITING_SKILLS" &&
                  !input.trim() &&
                  selectedSkills.length === 0)
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

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />
    </div>
  );
}

export default function CandidateOnboarding() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}