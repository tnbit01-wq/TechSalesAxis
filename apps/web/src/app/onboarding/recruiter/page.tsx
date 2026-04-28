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

  const { isListening, transcript, startListening, stopListening, hasSupport } = useVoice();

  const handleMicToggle = useCallback(() => {
    if (!hasSupport) return;
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [hasSupport, isListening, startListening, stopListening]);

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

  const leftSteps = isAssessmentActive
    ? [
        {
          step: "01",
          title: "Assessment is required",
          description: "This confirms recruiter quality before the dashboard unlocks.",
        },
        {
          step: "02",
          title: "Answer one question at a time",
          description: "Each answer is checked separately so the review stays clear and fair.",
        },
        {
          step: "03",
          title: "Stay on the page",
          description: "Switching tabs is monitored to protect the assessment process.",
        },
      ]
    : [
        {
          step: "01",
          title: "Company verification",
          description: "Enter your registration details to begin with a trusted company profile.",
        },
        {
          step: "02",
          title: "Profile completion",
          description: "Add website, location, and description to improve visibility and matching quality.",
        },
        {
          step: "03",
          title: "Recruiter assessment",
          description: "Finish the short assessment to unlock your dashboard and candidate signals.",
        },
      ];

  return (
    <div className="onboarding-shell">
      <aside className={`onboarding-hero ${isAssessmentActive ? "assessment" : "setup"}`}>
        <div className="onboarding-badge">Recruiter onboarding</div>
        <div className="onboarding-brand">
          <img src="/images/talentflow-logo.png" alt="TechSalesAxis" className="onboarding-logo" />
          <div>
            <div className="onboarding-kicker">{isAssessmentActive ? "Assessment mode" : "Company setup"}</div>
            <h1>{isAssessmentActive ? "Complete the recruiter assessment." : "Set up your hiring workspace."}</h1>
          </div>
        </div>
        <p className="onboarding-copy">
          {isAssessmentActive
            ? "Keep responses focused and concise. The assessment confirms recruiter quality and trust signals before your dashboard opens."
            : "The setup flow is short and role-specific so company verification, profile completion, and assessment feel clear and easy to finish."}
        </p>

        <div className="onboarding-cards">
          {leftSteps.map((item) => (
            <div className="onboarding-card" key={item.step}>
              <div className="onboarding-step">{item.step}</div>
              <div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {!isAssessmentActive && null}
      </aside>

      <div className="onboarding-panel">
        <header className={`onboarding-header ${isAssessmentActive ? "assessment" : "setup"}`}>
          <div className="header-left">
            {!isAssessmentActive && (
              <Link href="/" className="back-link" aria-label="Back to home">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
            )}
            <div>
              <div className="panel-kicker">TechSales Axis</div>
              <div className="panel-title">{isAssessmentActive ? "Recruiter Assessment" : "Recruiter Onboarding"}</div>
            </div>
          </div>

          <div className="header-right">
            {isAssessmentActive ? (
              <>
                <div className="metric-chip">
                  <span className="metric-label">Countdown</span>
                  <span className={`metric-value ${timeLeft < 15 ? "danger" : ""}`}>00:{timeLeft.toString().padStart(2, "0")}</span>
                </div>
                <div className="progress-chip">
                  <span className="progress-text">Signal {currentQuestionIndex + 1} / {dynamicQuestions.length}</span>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${((currentQuestionIndex + 1) / Math.max(dynamicQuestions.length || 1, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            )}
          </div>
        </header>

        <main className={`panel-body ${isAssessmentActive ? "assessment" : "setup"}`}>
          {isAssessmentActive ? (
            <div className="assessment-view">
              <div className="question-head">
                <div className="question-label">Assessment question</div>
                <h2>{dynamicQuestions[currentQuestionIndex]?.question_text || dynamicQuestions[currentQuestionIndex]?.text}</h2>
              </div>

              <div className="assessment-box">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your strategic response..."
                  className="assessment-input"
                  onCopy={(e) => e.preventDefault()}
                  onPaste={(e) => e.preventDefault()}
                />
                <div className="assessment-actions">
                  <button
                    onClick={handleMicToggle}
                    disabled={!hasSupport}
                    title={hasSupport ? (isListening ? "Stop voice input" : "Start voice input") : "Voice not supported in this browser"}
                    className={`action-icon ${isListening ? "recording" : "idle"}`}
                  >
                    <MicIcon />
                  </button>
                  <button
                    onClick={() => handleSend()}
                    disabled={isLoading || !input.trim()}
                    className="send-btn"
                  >
                    <span>Transmit Signal</span>
                    <SendIcon />
                  </button>
                </div>
              </div>

              <div className="assessment-footer">
                <span>Evaluation mode active</span>
                <span>Encryption Shield-V3.0-AES-256</span>
                <span>© 2026 TechSalesAxis.com</span>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="chat-scroll">
                {messages.map((m) => (
                  <div key={m.id} className={`message-row ${m.sender === "bot" ? "left" : "right"}`}>
                    <div className={`message-card ${m.sender === "bot" ? "bot" : "user"}`}>
                      <p>{m.text}</p>
                    </div>
                    {m.options && (
                      <div className="option-row">
                        {m.options.map((opt) => (
                          <button key={opt} onClick={() => handleSend(opt)} disabled={isLoading} className="option-pill">
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="typing-row">
                    <div className="typing-card">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>

              <div className="composer-wrap">
                <div className="composer">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSend()}
                    placeholder={isListening ? "Listening..." : "Type your response..."}
                    className="composer-input"
                    autoComplete="off"
                  />
                  <div className="composer-actions">
                    <button
                      onClick={handleMicToggle}
                      disabled={!hasSupport}
                      title={hasSupport ? (isListening ? "Stop voice input" : "Start voice input") : "Voice not supported in this browser"}
                      className={`action-icon small ${isListening ? "recording" : "idle"}`}
                    >
                      <MicIcon />
                    </button>
                    <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="send-btn small">
                      <SendIcon />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      <style jsx>{`
        .onboarding-shell {
          height: 100dvh;
          min-height: 100dvh;
          padding: 0.9rem;
          display: grid;
          grid-template-columns: minmax(280px, 0.75fr) minmax(0, 1.75fr);
          gap: 1.25rem;
          overflow: hidden;
          box-sizing: border-box;
          background:
            radial-gradient(circle at 12% 18%, rgba(255, 152, 0, 0.14) 0%, transparent 30%),
            radial-gradient(circle at 90% 85%, rgba(255, 152, 0, 0.08) 0%, transparent 30%),
            linear-gradient(135deg, #fffaf5 0%, #fff5ea 100%);
        }

        .onboarding-hero,
        .onboarding-panel {
          min-height: 0;
          border-radius: 1.4rem;
          border: 1px solid rgba(255, 152, 0, 0.2);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.08);
          overflow: hidden;
        }

        .onboarding-hero {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 248, 238, 0.95) 100%);
          padding: 1.05rem;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          overflow: hidden;
        }

        .onboarding-badge,
        .panel-kicker {
          font-size: 0.74rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #ff9800;
        }

        .onboarding-brand {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }

        .onboarding-logo {
          width: 3.5rem;
          height: 3.5rem;
          object-fit: contain;
          mix-blend-mode: multiply;
        }

        .onboarding-kicker {
          font-size: 0.8rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.35rem;
        }

        .onboarding-hero h1 {
          margin: 0;
          font-size: clamp(1.35rem, 2vw, 2.1rem);
          line-height: 1.06;
          color: #000;
          max-width: 14ch;
        }

        .onboarding-copy {
          margin: 0;
          font-size: 0.8rem;
          line-height: 1.35;
          color: #334155;
          max-width: 28rem;
        }

        .onboarding-cards {
          display: grid;
          gap: 0.55rem;
        }

        .onboarding-card {
          display: grid;
          grid-template-columns: 2.55rem 1fr;
          gap: 0.7rem;
          align-items: start;
          padding: 0.7rem 0.8rem;
          background: rgba(255, 255, 255, 0.78);
          border: 1px solid rgba(255, 152, 0, 0.18);
          border-radius: 1rem;
        }

        .onboarding-step {
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

        .onboarding-card h2 {
          margin: 0 0 0.18rem;
          font-size: 0.88rem;
          color: #000;
        }

        .onboarding-card p {
          margin: 0;
          font-size: 0.76rem;
          line-height: 1.28;
          color: #475569;
        }

        .onboarding-panel {
          min-width: 0;
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.92);
        }

        .onboarding-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(255, 152, 0, 0.16);
          backdrop-filter: blur(10px);
        }

        .onboarding-header.setup {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(255, 248, 238, 0.98) 100%);
        }

        .onboarding-header.assessment {
          background: linear-gradient(180deg, rgba(16, 16, 16, 0.98) 0%, rgba(28, 28, 28, 0.98) 100%);
          border-bottom-color: rgba(255, 255, 255, 0.08);
        }

        .header-left,
        .header-right {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
        }

        .back-link {
          width: 2.2rem;
          height: 2.2rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
          background: rgba(255, 152, 0, 0.08);
        }

        .panel-title {
          font-size: 1rem;
          font-weight: 800;
          color: inherit;
        }

        .onboarding-header.assessment .panel-title,
        .onboarding-header.assessment .panel-kicker,
        .onboarding-header.assessment .metric-label,
        .onboarding-header.assessment .progress-text {
          color: #f8fafc;
        }

        .onboarding-header.assessment .back-link {
          background: rgba(255, 255, 255, 0.06);
          color: #f8fafc;
        }

        .metric-chip,
        .progress-chip {
          display: grid;
          gap: 0.2rem;
          padding: 0.6rem 0.8rem;
          border-radius: 0.9rem;
          background: rgba(255, 152, 0, 0.08);
          border: 1px solid rgba(255, 152, 0, 0.18);
        }

        .metric-label,
        .progress-text {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
          font-weight: 800;
        }

        .metric-value {
          font-size: 0.98rem;
          font-weight: 800;
          color: #0f172a;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .metric-value.danger {
          color: #ef4444;
        }

        .progress-bar {
          width: 10rem;
          height: 0.45rem;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.14);
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
        }

        .logout-btn {
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
          background: rgba(255, 152, 0, 0.08);
          border: 1px solid rgba(255, 152, 0, 0.15);
          border-radius: 999px;
          padding: 0.6rem 0.9rem;
        }

        .panel-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .chat-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 1.25rem 1.25rem 0.75rem;
          background: radial-gradient(circle at top right, rgba(255, 152, 0, 0.05) 0%, transparent 26%), #fff;
        }

        .message-row {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          margin-bottom: 1rem;
        }

        .message-row.left {
          align-items: flex-start;
        }

        .message-row.right {
          align-items: flex-end;
        }

        .message-card {
          max-width: min(80%, 44rem);
          border-radius: 1.1rem;
          padding: 0.95rem 1rem;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
        }

        .message-card.bot {
          background: linear-gradient(180deg, #ffffff 0%, #fff8ee 100%);
          border: 1px solid rgba(255, 152, 0, 0.12);
          color: #111827;
          border-top-left-radius: 0.4rem;
        }

        .message-card.user {
          background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
          color: #fff;
          border-top-right-radius: 0.4rem;
        }

        .message-card p {
          margin: 0;
          white-space: pre-wrap;
          line-height: 1.55;
          font-size: 0.95rem;
        }

        .option-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
        }

        .option-pill {
          padding: 0.65rem 0.95rem;
          border-radius: 999px;
          background: #fff;
          border: 1px solid rgba(255, 152, 0, 0.18);
          color: #111827;
          font-size: 0.9rem;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
        }

        .typing-row {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 0.75rem;
        }

        .typing-card {
          display: inline-flex;
          gap: 0.4rem;
          padding: 0.85rem 1rem;
          border-radius: 1rem;
          background: #fff;
          border: 1px solid rgba(255, 152, 0, 0.12);
        }

        .typing-card span {
          width: 0.45rem;
          height: 0.45rem;
          border-radius: 999px;
          background: #ff9800;
          animation: bounce 0.9s infinite alternate;
        }

        .typing-card span:nth-child(2) {
          animation-delay: 0.15s;
        }

        .typing-card span:nth-child(3) {
          animation-delay: 0.3s;
        }

        .composer-wrap {
          padding: 1rem 1.25rem 1.25rem;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(255, 248, 238, 0.99) 100%);
          border-top: 1px solid rgba(255, 152, 0, 0.14);
        }

        .composer {
          max-width: 56rem;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.7rem;
          border-radius: 1.15rem;
          background: #fff;
          border: 1px solid rgba(255, 152, 0, 0.18);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.05);
        }

        .composer-input {
          flex: 1;
          min-width: 0;
          background: transparent;
          border: none;
          outline: none;
          padding: 0.45rem 0.55rem;
          font-size: 0.95rem;
          color: #111827;
        }

        .composer-input::placeholder {
          color: #64748b;
        }

        .composer-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .action-icon,
        .send-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.95rem;
          transition: all 0.2s ease;
        }

        .action-icon {
          width: 2.75rem;
          height: 2.75rem;
          background: rgba(17, 17, 17, 0.05);
          color: #6b7280;
          border: 1px solid transparent;
        }

        .action-icon.small {
          width: 2.45rem;
          height: 2.45rem;
        }

        .action-icon.recording {
          background: #ef4444;
          color: #fff;
        }

        .action-icon:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .send-btn {
          gap: 0.5rem;
          background: linear-gradient(135deg, #ff9800 0%, #ff6f00 100%);
          color: #fff;
          font-weight: 800;
          padding: 0.8rem 1rem;
          box-shadow: 0 10px 24px rgba(255, 152, 0, 0.22);
        }

        .send-btn.small {
          width: 2.85rem;
          height: 2.85rem;
          padding: 0;
        }

        .send-btn:hover,
        .option-pill:hover,
        .logout-btn:hover,
        .action-icon:hover {
          transform: translateY(-1px);
        }

        .assessment-view {
          padding: 1.4rem 1.25rem 1.1rem;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          height: 100%;
          background:
            radial-gradient(circle at top right, rgba(255, 152, 0, 0.05) 0%, transparent 28%),
            linear-gradient(180deg, #111 0%, #181818 100%);
          color: #f8fafc;
        }

        .question-head h2 {
          margin: 0;
          font-size: clamp(1.7rem, 2.6vw, 2.4rem);
          line-height: 1.2;
          max-width: 34rem;
        }

        .question-label {
          font-size: 0.74rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #ff9800;
          margin-bottom: 0.5rem;
        }

        .assessment-box {
          margin-top: auto;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          padding: 1rem;
          border-radius: 1.25rem;
          border: 1px solid rgba(255, 152, 0, 0.14);
          background: rgba(17, 17, 17, 0.58);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
        }

        .assessment-input {
          width: 100%;
          min-height: 190px;
          resize: none;
          background: transparent;
          border: none;
          outline: none;
          color: #f8fafc;
          font-size: 1rem;
          line-height: 1.65;
          padding: 0.25rem;
        }

        .assessment-input::placeholder {
          color: #64748b;
        }

        .assessment-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding-top: 0.9rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .assessment-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem 1rem;
          align-items: center;
          justify-content: space-between;
          padding: 0.4rem 0.25rem 0;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(248, 250, 252, 0.7);
        }

        .assessment-footer span:last-child {
          text-align: right;
        }

        @media (max-width: 1100px) {
          .onboarding-shell {
            height: auto;
            min-height: 100vh;
            overflow: visible;
            grid-template-columns: 1fr;
          }

          .onboarding-hero,
          .assessment-view {
            padding: 1.5rem;
          }

          .question-head h2,
          .onboarding-hero h1 {
            max-width: none;
          }
        }

        @media (max-width: 720px) {
          .onboarding-shell {
            padding: 0.75rem;
          }

          .onboarding-header,
          .composer-wrap,
          .chat-scroll {
            padding-left: 0.9rem;
            padding-right: 0.9rem;
          }

          .onboarding-brand {
            align-items: flex-start;
          }

          .header-right {
            flex-wrap: wrap;
            justify-content: flex-end;
          }

          .composer {
            flex-wrap: wrap;
          }

          .composer-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .assessment-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .assessment-footer {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @keyframes bounce {
          from {
            transform: translateY(0);
            opacity: 0.55;
          }
          to {
            transform: translateY(-4px);
            opacity: 1;
          }
        }
      `}</style>
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

