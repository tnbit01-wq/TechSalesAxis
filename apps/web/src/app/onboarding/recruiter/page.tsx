"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  options?: string[];
};

type OnboardingState =
  | "INITIAL"
  | "EMAIL_ANALYSIS"
  | "COMPANY_CONFIRMATION"
  | "REVIEW_DETAILS"
  | "EDITING_DETAIL"
  | "LOCATION"
  | "REGISTRATION"
  | "DETAILS"
  | "ASSESSMENT_PROMPT"
  | "ASSESSMENT_CHAT"
  | "COMPLETED";

interface AssessmentQuestion {
  text: string;
  category: string;
  question_text?: string;
}

const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  {
    text: "Why is your company expanding its team right now, and what are the three primary reasons a top-tier candidate should join your organization regardless of their specific role?",
    category: "recruiter_intent",
  },
  {
    text: "Beyond technical skills, what are the fundamental traits and 'Cultural DNA' that define every successful hire at your company?",
    category: "recruiter_icp",
  },
  {
    text: "How do you ensure a fair and consistent experience for all candidates, and how do you handle internal disagreements regarding a candidate's fit?",
    category: "recruiter_ethics",
  },
  {
    text: "What is one unique aspect of your culture or growth path that isn't in the job description, and why should a top candidate choose you over a competitor?",
    category: "recruiter_cvp",
  },
  {
    text: "Who are the key decision-makers in your hiring process, and what is your target timeline for providing final feedback to candidates?",
    category: "recruiter_ownership",
  },
];

export default function RecruiterOnboarding() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<OnboardingState>("INITIAL");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyDetails, setCompanyDetails] = useState({
    name: "",
    website: "",
    location: "",
    description: "",
  });

  // Enhanced email analysis states
  const [detectedCompanyName, setDetectedCompanyName] = useState("");
  const [detectedDomain, setDetectedDomain] = useState("");
  const [editingField, setEditingField] = useState<"website" | "description" | null>(null);

  const [dynamicQuestions, setDynamicQuestions] = useState<
    AssessmentQuestion[]
  >([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isAssessmentActive, setIsAssessmentActive] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initialized = useRef(false);

  const { isListening, transcript, startListening, stopListening } = useVoice();

  const addMessage = useCallback(
    (text: string, sender: "bot" | "user", options?: string[]) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substr(2, 9),
          text,
          sender,
          timestamp: new Date(),
          options,
        },
      ]);
    },
    [],
  );

  const handleLogout = useCallback(async () => {
    localStorage.removeItem("tf_recruiter_onboarding");
    awsAuth.logout();
    router.push("/login");
  }, [router]);

  const promptNextDetail = useCallback(
    (details: Record<string, string | null>) => {
      if (!details.name || details.name === "Pending Verification") {
        addMessage("What is the full legal name of your company?", "bot");
      } else if (!details.website) {
        addMessage("What is your company's website URL?", "bot");
      } else if (!details.location) {
        addMessage("Where is your company headquartered?", "bot");
      } else if (!details.description) {
        addMessage(
          "Please provide a short description of your company.",
          "bot",
        );
      }
    },
    [addMessage],
  );

  const showAssessmentPrompt = useCallback(() => {
    addMessage(
      "Your company profile is set! Now, as part of onboarding, we require a short Recruiter Assessment.",
      "bot",
    );
    addMessage(
      "This helps us generate your Company Profile Score, which impacts candidate matching and trust signals.",
      "bot",
    );
    addMessage(
      "Rules: 5 questions, 60s per question, no retakes, one continuous attempt. Copy-paste and tab-switching are strictly monitored.",
      "bot",
      ["Start Assessment", "Do It Later"],
    );
  }, [addMessage]);

  const startAssessment = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("No token found");
      const questions = await apiClient.get(
        "/recruiter/assessment-questions",
        token,
      );

      if (questions && questions.length > 0) {
        setDynamicQuestions(questions);
        setIsAssessmentActive(true);
        setState("ASSESSMENT_CHAT");
        setCurrentQuestionIndex(0);
        setTimeLeft(60);
        addMessage(questions[0].question_text || questions[0].text, "bot");
      } else {
        // Fallback to static if API fails or returns empty
        setDynamicQuestions(ASSESSMENT_QUESTIONS);
        setIsAssessmentActive(true);
        setState("ASSESSMENT_CHAT");
        setCurrentQuestionIndex(0);
        setTimeLeft(60);
        addMessage(ASSESSMENT_QUESTIONS[0].text, "bot");
      }
    } catch (err) {
      console.error("Failed to load questions:", err);
      // Fallback
      setDynamicQuestions(ASSESSMENT_QUESTIONS);
      setIsAssessmentActive(true);
      setState("ASSESSMENT_CHAT");
      setCurrentQuestionIndex(0);
      setTimeLeft(60);
      addMessage(ASSESSMENT_QUESTIONS[0].text, "bot");
    } finally {
      setIsLoading(false);
    }
  }, [addMessage]);

  const handleSend = useCallback(
    async (textOverride?: string) => {
      const val = textOverride || input.trim();
      if (!val && !isLoading) return;
      if (isLoading) return;

      if (val.toLowerCase() === "logout" || val.toLowerCase() === "exit") {
        addMessage("Logging out...", "bot");
        setTimeout(handleLogout, 1000);
        return;
      }

      addMessage(val, "user");
      setInput("");
      setIsLoading(true);

      try {
        const token = awsAuth.getToken();

        // EMAIL_ANALYSIS state - user skips automatic detection
        if (state === "EMAIL_ANALYSIS") {
          // User asked to provide manually
          addMessage("Sure! What is your company name?", "bot");
          setState("COMPANY_CONFIRMATION");
          setIsLoading(false);
          return;
        }

        // COMPANY_CONFIRMATION state
        if (state === "COMPANY_CONFIRMATION") {
          if (val === "Yes, that's right") {
            // User confirmed the detected company
            // Now ask for registration number (this will create the company and give us company_id)
            const confirmedDetails = { ...companyDetails };
            
            if (detectedCompanyName && !confirmedDetails.name) {
              confirmedDetails.name = detectedCompanyName;
            }

            setCompanyDetails(confirmedDetails);
            
            // Move to REGISTRATION to create the company
            setState("REGISTRATION");
            addMessage(
              "Great! Now please enter your Company Registration Number (CIN or GSTIN) so I can verify the company.",
              "bot",
            );
            setIsLoading(false);
            return;
          } else if (val === "No, let me provide the name") {
            addMessage("What is your company name?", "bot");
            setIsLoading(false);
            return;
          } else {
            // User provided a company name manually
            const nextDetails = { ...companyDetails };
            nextDetails.name = val;
            setCompanyDetails(nextDetails);
            setDetectedCompanyName(val);

            // Try to find details for this company
            try {
              const detailsRes = await apiClient.post(
                "/recruiter/find-company-details",
                { company_name: val },
                token,
              );

              console.log("Found details for manually entered company:", detailsRes);

              if (detailsRes.website || detailsRes.description) {
                nextDetails.website = detailsRes.website || "";
                nextDetails.description = detailsRes.description || "";
                setCompanyDetails(nextDetails);
              }
            } catch (err) {
              console.warn("Could not find company details:", err);
            }

            // Move to REGISTRATION
            setState("REGISTRATION");
            addMessage(
              "Perfect! Now please enter your Company Registration Number (CIN or GSTIN).",
              "bot",
            );
            setIsLoading(false);
            return;
          }
        }

        // LOCATION state - asking for company headquarters
        if (state === "LOCATION") {
          const nextDetails = { ...companyDetails };
          nextDetails.location = val;
          setCompanyDetails(nextDetails);

          // Save location
          try {
            await apiClient.post(
              "/recruiter/details",
              { 
                company_id: companyId,
                ...nextDetails 
              },
              token,
            );
            console.log("Location saved");
          } catch (err) {
            console.warn("Failed to save location:", err);
          }

          // If we have all required fields, move to REGISTRATION
          if (nextDetails.name && nextDetails.website && nextDetails.location && nextDetails.description) {
            setState("REGISTRATION");
            addMessage(
              "Perfect! Now please enter your Company Registration Number (CIN or GSTIN).",
              "bot",
            );
          } else {
            // Ask for the next missing detail
            if (!nextDetails.website) {
              addMessage("What is your company's website URL?", "bot");
              setState("LOCATION");
            } else if (!nextDetails.description) {
              addMessage("Please provide a short description of your company.", "bot");
              setState("LOCATION");
            } else {
              setState("REGISTRATION");
              addMessage(
                "Perfect! Now please enter your Company Registration Number (CIN or GSTIN).",
                "bot",
              );
            }
          }
          setIsLoading(false);
          return;
        }

        // REVIEW_DETAILS state
        if (state === "REVIEW_DETAILS") {
          if (val === "Looks good! Proceed") {
            // Save the reviewed details
            try {
              console.log("Saving reviewed company details:", companyDetails);
              await apiClient.post(
                "/recruiter/details",
                { 
                  company_id: companyId,
                  ...companyDetails 
                },
                token,
              );
            } catch (err) {
              console.warn("Failed to save reviewed details:", err);
            }

            // Skip REGISTRATION if we already have company details from email analysis
            // Only ask for registration if needed by backend
            setState("REGISTRATION");
            addMessage(
              "Perfect! Now please enter your Company Registration Number (CIN or GSTIN).",
              "bot",
            );
            setIsLoading(false);
            return;
          } else if (val === "Edit website info") {
            setState("EDITING_DETAIL");
            setEditingField("website");
            addMessage(
              `Current website: ${companyDetails.website || "Not provided"}. What should it be?`,
              "bot",
            );
            setIsLoading(false);
            return;
          } else if (val === "Edit description") {
            setState("EDITING_DETAIL");
            setEditingField("description");
            addMessage(
              `Current description: ${companyDetails.description || "Not provided"}. What should it be?`,
              "bot",
            );
            setIsLoading(false);
            return;
          }
        }

        // EDITING_DETAIL state
        if (state === "EDITING_DETAIL") {
          const nextDetails = { ...companyDetails };
          if (editingField === "website") {
            nextDetails.website = val;

            // Auto-generate description from website
            addMessage("Analyzing website content for company narrative...", "bot");
            try {
              const bioRes = await apiClient.post(
                "/recruiter/generate-bio",
                { website: val },
                token,
              );
              if (bioRes.bio) {
                nextDetails.description = bioRes.bio;
                addMessage(`✨ Updated company narrative:\n${bioRes.bio}`, "bot");
              }
            } catch (err) {
              console.log("Bio generation failed, using previous or manual entry");
            }
          } else if (editingField === "description") {
            nextDetails.description = val;
            addMessage(`Description updated.`, "bot");
          }

          setCompanyDetails(nextDetails);
          
          // Save the updated details
          try {
            await apiClient.post(
              "/recruiter/details",
              { 
                company_id: companyId,
                ...nextDetails 
              },
              token,
            );
            console.log("Updated company details saved");
          } catch (err) {
            console.warn("Failed to save updated details:", err);
          }

          setState("REVIEW_DETAILS");
          addMessage(
            `Here's the updated info for **${nextDetails.name}**:`,
            "bot",
          );
          addMessage(
            `**Website:** ${nextDetails.website}\n\n**About:** ${nextDetails.description}`,
            "bot",
            ["Looks good! Proceed", "Edit website info", "Edit description"]
          );
          setEditingField(null);
          setIsLoading(false);
          return;
        }

        if (state === "REGISTRATION") {
          const gstinRegex =
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
          const cinRegex =
            /^([LUu]{1})([0-9]{5})([A-Za-z]{2})([0-9]{4})([A-Za-z]{3})([0-9]{6})$/;

          if (!gstinRegex.test(val) && !cinRegex.test(val)) {
            addMessage(
              "Invalid format. Please enter a valid CIN or GSTIN.",
              "bot",
            );
          } else {
            const res = await apiClient.post(
              "/recruiter/registration",
              { registration_number: val },
              token,
            );
            
            console.log("Registration response:", res);
            setCompanyId(res.company_id);

            // Save the detected company details now that we have company_id
            if (res.company_id && companyDetails.name) {
              try {
                console.log("Saving detected company details:", companyDetails);
                await apiClient.post(
                  "/recruiter/details",
                  { 
                    company_id: res.company_id,
                    name: companyDetails.name,
                    website: companyDetails.website || "",
                    location: companyDetails.location || "",
                    description: companyDetails.description || "",
                  },
                  token,
                );
                console.log("Detected company details saved");
              } catch (err) {
                console.warn("Failed to save detected company details:", err);
              }
            }

            if (res.onboarding_step === "COMPLETED") {
              addMessage(
                "Your company is already vetted! Fast-tracking you to the Command Center...",
                "bot",
              );
              setTimeout(() => router.push("/dashboard/recruiter"), 2000);
            } else {
              // If we have all company details from email analysis, skip to assessment
              if (companyDetails.name && companyDetails.website && companyDetails.description) {
                setState("ASSESSMENT_PROMPT");
                showAssessmentPrompt();
              } else {
                // Need to ask for missing details
                setState("DETAILS");
                addMessage("Now let's complete the company details.", "bot");
                promptNextDetail(companyDetails);
              }
            }
          }
        } else if (state === "DETAILS") {
          const nextDetails = { ...companyDetails };
          if (
            !nextDetails.name ||
            nextDetails.name === "Pending Verification"
          ) {
            nextDetails.name = val;
          } else if (!nextDetails.website) {
            nextDetails.website = val;

            // Auto-generate bio from website
            try {
              addMessage("Analyzing your website to create a company narrative...", "bot");
              console.log("Calling generate-bio with website:", val);

              const res = await apiClient.post(
                "/recruiter/generate-bio",
                { website: val },
                token,
              );

              console.log("Bio generation response:", res);

              if (res && res.bio && res.bio.trim()) {
                nextDetails.description = res.bio;
                addMessage("✨ Generated Company Narrative:\n" + res.bio, "bot");
              } else {
                console.log("No bio returned, will ask for manual entry");
                addMessage("I'll ask you to describe your company in a moment.", "bot");
              }
            } catch (err) {
              console.error("Bio generation error:", err);
              addMessage("No problem! I'll ask you to describe your company manually.", "bot");
            }
          } else if (!nextDetails.location) {
            nextDetails.location = val;
          } else if (!nextDetails.description) {
            nextDetails.description = val;
          }

          setCompanyDetails(nextDetails);

          if (
            nextDetails.name &&
            nextDetails.website &&
            nextDetails.location &&
            nextDetails.description
          ) {
            await apiClient.post(
              "/recruiter/details",
              { company_id: companyId, ...nextDetails },
              token,
            );
            setState("ASSESSMENT_PROMPT");
            showAssessmentPrompt();
          } else {
            promptNextDetail(nextDetails);
          }
        } else if (state === "ASSESSMENT_PROMPT") {
          if (val === "Start Assessment") {
            startAssessment();
          } else if (val === "Do It Later") {
            await apiClient.post("/recruiter/skip-assessment", {}, token);
            addMessage(
              "No problem! You can complete it later. Note that your dashboard features will remain locked until then.",
              "bot",
            );
            setTimeout(() => router.push("/dashboard/recruiter"), 2000);
          }
        } else if (state === "ASSESSMENT_CHAT") {
          const currentQ = dynamicQuestions[currentQuestionIndex];
          await apiClient.post(
            "/recruiter/submit-answer",
            {
              question_text: currentQ.question_text || currentQ.text,
              answer: val,
              category: currentQ.category,
            },
            token,
          );

          const nextIndex = currentQuestionIndex + 1;
          if (nextIndex < dynamicQuestions.length) {
            setCurrentQuestionIndex(nextIndex);
            setTimeLeft(60);
            addMessage(
              dynamicQuestions[nextIndex].question_text ||
                dynamicQuestions[nextIndex].text,
              "bot",
            );
          } else {
            setIsAssessmentActive(false);
            await apiClient.post("/recruiter/complete-assessment", {}, token);
            addMessage(
              "Assessment complete! Onboarding is finished. Unlocking your dashboard...",
              "bot",
            );
            setTimeout(() => router.push("/dashboard/recruiter"), 2000);
          }
        }
      } catch (err) {
        console.error(err);
        addMessage("Something went wrong. Please try again.", "bot");
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      isLoading,
      addMessage,
      handleLogout,
      state,
      router,
      companyId,
      companyDetails,
      showAssessmentPrompt,
      promptNextDetail,
      startAssessment,
      dynamicQuestions,
      currentQuestionIndex,
      detectedCompanyName,
      editingField,
    ],
  );

  useEffect(() => {
    async function init() {
      if (initialized.current) return;
      initialized.current = true;

      try {
        const user = awsAuth.getUser();
        if (!user) {
          console.log("No user found, redirecting to login");
          router.replace("/login");
          return;
        }

        const token = awsAuth.getToken();
        if (!token) {
          console.log("No token found, redirecting to login");
          router.replace("/login");
          return;
        }

        const name = extractNameFromEmail(user.email || "");
        console.log("User email:", user.email, "Name:", name);

        const profile = await apiClient.get("/recruiter/profile", token);
        console.log("Profile loaded:", profile);

        if (profile) {
          setCompanyId(profile.company_id);
          if (profile.companies) {
            setCompanyDetails({
              name: profile.companies.name || "",
              website: profile.companies.website || "",
              location: profile.companies.location || "",
              description: profile.companies.description || "",
            });
          }

          const currentStep = profile.onboarding_step as OnboardingState;
          console.log("Current onboarding step:", currentStep);

          // If user already passed EMAIL_ANALYSIS, respect that
          if (currentStep && currentStep !== "INITIAL") {
            setState(currentStep);
            if (currentStep === "REGISTRATION") {
              addMessage(
                `Welcome, ${name}! Let's set up your company profile.`,
                "bot",
              );
              addMessage(
                "First, please enter your Company Registration Number (CIN or GSTIN).",
                "bot",
              );
            } else if (currentStep === "DETAILS") {
              addMessage(
                "Let's complete the basic details for your company.",
                "bot",
              );
              promptNextDetail(profile.companies || {});
            } else if (currentStep === "ASSESSMENT_PROMPT" || currentStep === "ASSESSMENT_CHAT") {
              showAssessmentPrompt();
            } else if (currentStep === "COMPLETED") {
              if (profile.assessment_status !== "completed") {
                setState("ASSESSMENT_PROMPT");
                showAssessmentPrompt();
              } else {
                router.push("/dashboard/recruiter");
              }
            }
            return;
          }

          // User is at INITIAL - auto-detect company from email
          addMessage(`Welcome, ${name}! Let me detect your company...`, "bot");
          setState("EMAIL_ANALYSIS");

          // Analyze email to detect company
          try {
            console.log("Calling /recruiter/analyze-email with email:", user.email);
            const analysisRes = await apiClient.post(
              "/recruiter/analyze-email",
              { email: user.email },
              token,
            );

            console.log("Email analysis response:", analysisRes);

            if (analysisRes.company_name) {
              setDetectedCompanyName(analysisRes.company_name);
              setDetectedDomain(analysisRes.domain || "");

              // Try to fetch detailed company info
              try {
                console.log("Fetching details for:", analysisRes.company_name);
                const detailsRes = await apiClient.post(
                  "/recruiter/find-company-details",
                  { company_name: analysisRes.company_name },
                  token,
                );

                console.log("Company details response:", detailsRes);

                if (detailsRes.website || detailsRes.description) {
                  setCompanyDetails({
                    name: analysisRes.company_name,
                    website: detailsRes.website || "",
                    description: detailsRes.description || "",
                    location: "",
                  });
                }
              } catch (err) {
                console.warn("Could not fetch company details:", err);
                setCompanyDetails((prev) => ({
                  ...prev,
                  name: analysisRes.company_name,
                }));
              }

              // Show confirmation with company name
              setState("COMPANY_CONFIRMATION");
              addMessage(
                `I detected you're from **${analysisRes.company_name}**. Is this correct?`,
                "bot",
                ["Yes, that's right", "No, let me provide the name"],
              );
            } else {
              console.warn("No company name detected from email");
              // Fall back to manual entry
              addMessage(
                `Let's set up your company profile.`,
                "bot",
              );
              addMessage(
                "First, please enter your Company Registration Number (CIN or GSTIN).",
                "bot",
              );
              setState("REGISTRATION");
            }
          } catch (err) {
            console.error("Email analysis failed:", err);
            // Fall back to manual registration
            addMessage(
              `Let's set up your company profile.`,
              "bot",
            );
            addMessage(
              "First, please enter your Company Registration Number (CIN or GSTIN).",
              "bot",
            );
            setState("REGISTRATION");
          }
        } else {
          // No profile found - initialize
          addMessage(
            `Welcome, ${name}! Let's set up your company profile.`,
            "bot",
          );
          addMessage(
            "First, please enter your Company Registration Number (CIN or GSTIN).",
            "bot",
          );
          setState("REGISTRATION");
        }
      } catch (err) {
        console.error("Init failed:", err);
        router.replace("/login");
      }
    }
    init();
  }, [addMessage, promptNextDetail, router, showAssessmentPrompt]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Sync voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Security: Tab switch monitoring
  useEffect(() => {
    if (!isAssessmentActive) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "hidden") {
        try {
          const token = awsAuth.getToken();
          if (!token) return;

          const res = await apiClient.post(
            "/recruiter/tab-switch",
            {},
            token,
          );

          if (res.status === "blocked") {
            // Blocked state - direct logout and error
            awsAuth.logout();
            window.location.href = "/login?error=blocked";
          } else {
            // Immediate alert for the warning strike
            alert(res.message);
            // Also log in chat for persistence
            addMessage(res.message, "bot");
          }
        } catch (err) {
          console.error("Failed to report tab switch:", err);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isAssessmentActive, addMessage]);

  // Timer logic for assessment
  useEffect(() => {
    if (isAssessmentActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isAssessmentActive) {
      // Auto-timeout handling
      handleSend("No response provided (timeout)");
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAssessmentActive, timeLeft, handleSend]);

  return (
    <div className={`flex flex-col h-screen ${isAssessmentActive ? "bg-black text-white" : "bg-white text-slate-900"} font-sans transition-colors duration-700`}>
      {/* Dynamic Header */}
      <header className={`flex justify-between items-center py-4 px-6 border-b ${isAssessmentActive ? "border-zinc-800 bg-black/80" : "border-slate-100 bg-white/80"} backdrop-blur-md sticky top-0 z-50`}>
        <div className="flex items-center gap-4">
          {!isAssessmentActive && (
            <Link
              href="/"
              className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400 hover:text-primary"
              aria-label="Back to home"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
          )}
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl ${isAssessmentActive ? "bg-blue-600 shadow-blue-900/20" : "bg-primary shadow-primary-light"} flex items-center justify-center shadow-lg`}>
              <div className={`h-4 w-4 rounded ${isAssessmentActive ? "bg-black" : "bg-white"} rotate-45`} />
            </div>
            <h1 className={`text-xl font-bold tracking-tight ${isAssessmentActive ? "text-white uppercase italic" : "text-slate-800"}`}>
              TechSales Axis {isAssessmentActive ? "" : <span className="font-medium text-slate-400 ml-1">Onboarding</span>}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {isAssessmentActive ? (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Countdown</span>
                </div>
                <span className={`font-mono text-sm font-bold ${timeLeft < 15 ? "text-red-500 animate-pulse" : "text-blue-400"}`}>
                  00:{timeLeft.toString().padStart(2, "0")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-500" 
                    style={{ width: `${((currentQuestionIndex + 1) / dynamicQuestions.length) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Signal: {currentQuestionIndex + 1} / {dynamicQuestions.length}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-600 transition-colors py-2 px-3 rounded-lg hover:bg-red-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          )}
          {isAssessmentActive && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-red-500 transition-colors py-2 px-3 rounded-lg hover:bg-red-950/30"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          )}
        </div>
      </header>

      <main className={`flex-1 overflow-hidden relative flex flex-col ${isAssessmentActive ? "max-w-4xl" : "max-w-5xl"} mx-auto w-full`}>
        {isAssessmentActive ? (
          /* Assessment View (Second Image Style) */
          <div className="flex-1 flex flex-col px-6 py-12 space-y-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-500">
                <div className="h-px w-8 bg-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em]">System_Origin: Audit_Module</span>
              </div>
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-zinc-100 max-w-3xl">
                {dynamicQuestions[currentQuestionIndex]?.question_text || dynamicQuestions[currentQuestionIndex]?.text}
              </h2>
            </div>

            <div className="flex-1 flex flex-col justify-end pb-12">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-2xl blur opacity-25 group-focus-within:opacity-100 transition duration-1000"></div>
                <div className="relative flex flex-col bg-zinc-900/50 border border-zinc-800 focus-within:border-blue-500/50 transition-all rounded-2xl p-4">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your strategic response..."
                    className="w-full bg-transparent border-none focus:ring-0 text-zinc-200 placeholder:text-zinc-600 text-lg min-h-[160px] resize-none font-medium"
                    onCopy={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                  />
                  <div className="flex justify-between items-center mt-4 border-t border-zinc-800/50 pt-4">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!isListening) startListening();
                      }}
                      onMouseUp={(e) => {
                        e.preventDefault();
                        if (isListening) stopListening();
                      }}
                      className={`p-3 rounded-xl transition-all ${isListening ? "bg-red-500 text-white" : "text-zinc-500 hover:text-white"}`}
                    >
                      <MicIcon />
                    </button>
                    <button
                      onClick={() => handleSend()}
                      disabled={isLoading || !input.trim()}
                      className="flex items-center gap-3 bg-zinc-800 hover:bg-blue-600 text-white hover:text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 group"
                    >
                      <span>Transmit Signal</span>
                      <SendIcon />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center mt-6 px-2">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Evaluation_Mode: Active</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-zinc-700" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Encryption: Shield-V3.0-AES-256</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">© 2026, TechSalesAxis.com The Next Big Idea Technologies Pvt. Ltd . All rights reserved.</span>
              </div>
            </div>
          </div>
        ) : (
          /* Onboarding View (First Image Style) */
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex w-full ${m.sender === "bot" ? "justify-start" : "justify-end animate-in slide-in-from-right-4 duration-300"}`}
                >
                  <div className={`max-w-[80%] flex flex-col ${m.sender === "bot" ? "items-start" : "items-end"}`}>
                    <div
                      className={`px-5 py-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                        m.sender === "bot" 
                          ? "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none" 
                          : "bg-primary text-slate-900 border border-primary-dark rounded-tr-none shadow-primary-light font-semibold"
                      }`}
                    >
                      <p className="whitespace-pre-wrap font-medium">
                        {m.text}
                      </p>
                    </div>
                    
                    {m.options && (
                      <div className="flex flex-wrap gap-2.5 mt-4">
                        {m.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleSend(opt)}
                            disabled={isLoading}
                          className="px-5 py-2.5 bg-white hover:bg-primary-light border border-slate-200 hover:border-primary-light rounded-full text-sm font-semibold text-slate-800 hover:text-primary transition-all shadow-sm active:scale-95 disabled:opacity-50"
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
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-100"></div>
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="px-6 py-6 bg-white border-t border-slate-100">
              <div className="max-w-4xl mx-auto relative">
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary-light transition-all px-2 py-2 rounded-2xl">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSend()}
                    placeholder={isListening ? "Listening..." : "Type your response..."}
                    className="flex-1 bg-transparent px-4 py-2 text-slate-700 placeholder:text-slate-500 focus:outline-none text-sm font-medium"
                    autoComplete="off"
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (!isListening) startListening();
                      }}
                      onMouseUp={(e) => {
                        e.preventDefault();
                        if (isListening) stopListening();
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        if (!isListening) startListening();
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        if (isListening) stopListening();
                      }}
                      className={`p-2.5 rounded-xl transition-all ${
                        isListening 
                          ? "bg-red-500 text-white animate-pulse" 
                          : "text-slate-400 hover:text-primary hover:bg-white border border-transparent hover:border-slate-100"
                      }`}
                    >
                      <MicIcon />
                    </button>
                    <button
                      onClick={() => handleSend()}
                      disabled={isLoading || !input.trim()}
                      className="bg-primary hover:bg-primary-dark text-white p-2.5 rounded-xl transition-all shadow-md shadow-primary-light disabled:opacity-40 active:scale-95"
                    >
                      <SendIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" x2="11" y1="2" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

