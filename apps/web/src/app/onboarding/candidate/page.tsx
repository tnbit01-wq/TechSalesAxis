"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
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

      // 1. Load chat history from localStorage if it exists
      const storageKey = `tf_onboarding_chat_${user.id}`;
      const savedChat = localStorage.getItem(storageKey);
      if (savedChat) {
        try {
          const parsed = JSON.parse(savedChat);
          // Convert string timestamps back to Date objects
          const hydrated = parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          setMessages(hydrated);
        } catch {
          localStorage.removeItem(storageKey);
        }
      }

      // 2. Fetch profile to check progress
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

        // Only add "Welcome back" if we don't have fresh history
        if (!savedChat) {
          addMessage(
            `Welcome back, ${name}! Let's pick up where we left off.`,
            "bot",
          );

          if (savedStep === "AWAITING_RESUME" || savedStep === "AWAITING_RESUME_CHOICE") {
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
        }

        setState(savedStep);
      } else if (!savedChat) {
        // Only start fresh if no history
        addMessage(
          `Welcome, ${name}! I'm here to help you build your high-trust profile.`,
          "bot",
        );
        setTimeout(() => {
          addMessage(
            "First, tell me about your experience level in IT Tech Sales. Which band do you fall into?",
            "bot",
            [
              "Fresher (0–1 years)",
              "Mid-level (1–5 years)",
              "Senior (5–10 years)",
              "Leadership (10+ years)",
            ],
          );
          setState("AWAITING_EXPERIENCE");
        }, 1000);
      }
    }
    init();
  }, [router]);

  const handleSend = async (textOverride?: string) => {
    const workingInput = textOverride || input.trim();

    // Check for logout command
    if (
      workingInput.toLowerCase() === "logout" ||
      workingInput.toLowerCase() === "exit"
    ) {
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
      if (state === "AWAITING_EXPERIENCE") {
        let band = "";
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

          addMessage(
            `Selected ${band} level. This will determine your assessment difficulty.`,
            "bot",
          );

          const nextState = "AWAITING_RESUME_CHOICE";
          await saveStep(nextState);

          setTimeout(() => {
            addMessage(
              "Next, I'll need your resume to understand your background. Would you like to upload a PDF or build it manually now?",
              "bot",
              ["Upload PDF", "Build Manually", "Skip for Now"],
            );
            setState(nextState);
          }, 1000);
        }
      } else if (state === "AWAITING_RESUME_CHOICE") {
        const lowerInput = workingInput.toLowerCase();
        if (lowerInput.includes("upload")) {
          setState("AWAITING_RESUME");
          addMessage(
            "Perfect! Please upload your resume (PDF only) using the button below.",
            "bot",
            ["Skip Resume Upload"]
          );
        } else if (lowerInput.includes("build")) {
          setState("AWAITING_MANUAL_BIO");
          addMessage(
            "Great! Let's build your resume step-by-step. First, let's start with a short Professional Summary. What would you like to say about your career so far?",
            "bot",
            ["I'm a fresh graduate eager to start", "Experienced Tech Sales person looking for growth", "Skip Summary"]
          );
        } else if (lowerInput.includes("skip")) {
          addMessage("No problem! We'll skip the resume for now. Let's move to your skills.", "bot");
          const nextState = "AWAITING_SKILLS";
          await saveStep(nextState);
          setState(nextState);
          setTimeout(() => {
            addMessage(
              "Tell me your key skills (e.g., SaaS Sales, CRM). Please separate them with commas.",
              "bot",
              ["Skip Skills"]
            );
          }, 1000);
        } else {
            addMessage(
                "Please choose an option to continue.",
                "bot",
                ["Upload PDF", "Build Manually", "Skip for Now"]
            )
        }
      } else if (state === "AWAITING_MANUAL_BIO") {
        if (workingInput.toLowerCase().includes("skip")) {
          addMessage("Skipping summary. Let's move to education.", "bot");
        } else {
          setManualResumeData(prev => ({ ...prev, bio: workingInput }));
          addMessage("Got it!", "bot");
        }
        setState("AWAITING_MANUAL_EDUCATION");
        addMessage(
            "Now, let's add your education history. Please tell me your: School/College Name, Degree, Field, Location, GPA, and Years.",
            "bot",
            ["Skip Education"]
        )
      } else if (state === "AWAITING_MANUAL_EDUCATION") {
        const lowerInput = workingInput.toLowerCase();
        if (lowerInput.includes("skip") || lowerInput.includes("next") || lowerInput.includes("proceed to experience") || lowerInput.includes("skip to experience")) {
            setState("AWAITING_MANUAL_EXPERIENCE")
            addMessage(
                "Let's move to your experience. Please describe your: Role Title, Company Name, Location, Dates, and accomplishments.",
                "bot",
                ["Skip Experience"]
            )
        } else {
            // Very simple parser for manual education
            // In a production app, we would have multiple input fields or a sub-chatbot
            // But for this exercise, we'll try to extract them briefly and prompt for one more or next
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
            addMessage(`Added ${edu.degree} from ${edu.school}. Would you like to add more education or move to Experience?`, "bot", ["Add More Education", "Proceed to Experience"])
        }
      } else if (state === "AWAITING_MANUAL_EXPERIENCE") {
        const lowerInput = workingInput.toLowerCase();
        if (lowerInput.includes("added more education") || lowerInput === "add more education") {
            setState("AWAITING_MANUAL_EDUCATION")
            addMessage("Sure! Please tell me your other School/College Name and details.", "bot")
            setIsLoading(false);
            return;
        }

        if (lowerInput.includes("skip") || lowerInput === "next" || lowerInput.includes("proceed to skills")) {
             if (manualResumeData.experience.length === 0 && (lowerInput.includes("proceed") || lowerInput.includes("skip"))) {
                 addMessage("Alright, let's input your experience. Please tell me your: Role, Company, Location, Dates, and accomplishments.", "bot", ["Skip Experience"])
                setIsLoading(false);
                return;
             }
            setState("AWAITING_MANUAL_SKILLS")
            addMessage(
                "Now, tell me your key skills (e.g., SaaS Sales, CRM, Prospecting, Negotiation, Cloud, SaaS). Please separate them with commas.",
                "bot",
                ["Skip Skills"]
            )
        } else {
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
            addMessage(`Added your experience at ${exp.company}. Would you like to add more roles or move to Skills?`, "bot", ["Add More Experience", "Proceed to Skills"])
        }
      } else if (state === "AWAITING_MANUAL_SKILLS") {
        const lowerInput = workingInput.toLowerCase();
          if (lowerInput.includes("add more experience") || lowerInput === "add more experience") {
            setState("AWAITING_MANUAL_EXPERIENCE")
            addMessage("Sure! Please tell me your other Role and details.", "bot")
            setIsLoading(false);
            return;
        }

        if (lowerInput.includes("skip") || lowerInput === "next" || lowerInput.includes("proceed to skills")) {
            setState("AWAITING_MANUAL_CONTACT")
            addMessage("Finally, tell me your contact details: Phone Number, Location, LinkedIn Profile (URL), and Portfolio (optional).", "bot")
        } else {
            const skills = workingInput.split(",").map(s => s.trim()).filter(Boolean);
            setManualResumeData(prev => ({ ...prev, skills: [...prev.skills, ...skills] }))
            addMessage(`Recorded ${skills.length} skills. Moving to contact info.`, "bot")
            setState("AWAITING_MANUAL_CONTACT")
            addMessage("Finally, tell me your contact details: Phone Number, Location, LinkedIn Profile (URL), and Portfolio (optional).", "bot")
        }
      } else if (state === "AWAITING_MANUAL_CONTACT") {
        const phone = workingInput.split(",")[0]?.trim() || workingInput;
        const location = workingInput.split(",")[1]?.trim() || "";
        const linkedin = workingInput.split(",")[2]?.trim() || "";
        const portfolio = workingInput.split(",")[3]?.trim() || "";
        
        setManualResumeData(prev => ({ ...prev, phone, location, linkedin, portfolio }));
        
        addMessage("Perfect! I have everything I need to generate your high-fidelity resume.", "bot");
        addMessage("Generating your resume PDF and syncing your profile... please wait.", "bot");
        
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
                years: `${e.start_year || ""} - ${e.end_year || ""}`
            })) : [
                {
                    school: "Self-Taught / Other",
                    degree: "None",
                    field: "None",
                    location: location,
                    gpa: "N/A",
                    years: "N/A"
                }
            ],
            timeline: manualResumeData.experience.length > 0 ? manualResumeData.experience.map(ex => ({
                role: ex.role,
                company: ex.company,
                location: ex.location,
                start: ex.start_date,
                end: ex.end_date,
                description: ex.description,
                key_achievements: ex.key_achievements
            })) : [
                {
                    role: "Aspiring Tech Sales Professional",
                    company: "Active Learner",
                    location: location,
                    start: "Current",
                    end: "Present",
                    description: "Actively building skills in IT Tech Sales.",
                    key_achievements: ["Successfully completed multiple sales training modules"]
                }
            ],
            skills: manualResumeData.skills.length > 0 ? manualResumeData.skills : ["Persistence", "Communication", "Research"]
        };

        const res = await apiClient.post("/candidate/generate-resume", payload, token);
        
        if (res.filename) {
             addMessage(`Resume generated successfully: ${res.filename}`, "bot");
             addMessage("You can download it from your profile later. Now, let's finalize your skills.", "bot");
             setSelectedSkills(manualResumeData.skills);
             
             const nextState = "AWAITING_SKILLS";
             await saveStep(nextState);
             setState(nextState);
        } else {
            throw new Error("Failed to generate resume PDF.");
        }

      } else if (state === "AWAITING_SKILLS") {
        const lowerInput = workingInput.toLowerCase();
        if (lowerInput.includes("skip")) {
          addMessage("No problem! We'll skip skills for now. Let's move to your career vision.", "bot");
          const nextState = "AWAITING_GPS_VISION";
          await saveStep(nextState);
          setState(nextState);
          setTimeout(() => {
            addMessage(
              "Before we finish, let's look at your future. What's your target role in IT Tech Sales (e.g. Enterprise AE)?",
              "bot",
              ["Skip Career Vision for Now"],
            );
          }, 1000);
          setIsLoading(false);
          return;
        }

        const skillsFromInput = workingInput
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !selectedSkills.includes(s));

        const finalSkills = [...selectedSkills, ...skillsFromInput];

        if (finalSkills.length === 0) {
          addMessage("Please select or type at least one skill.", "bot");
        } else {
          const token = awsAuth.getToken() || undefined;
          await apiClient.post(
            "/candidate/skills",
            { skills: finalSkills },
            token,
          );

          addMessage("Skills saved! Your profile is now enriched.", "bot");

          const nextState = "AWAITING_GPS_VISION";
          await saveStep(nextState);
          setState(nextState);

          setTimeout(() => {
            addMessage(
              "Before we finish, let's look at your future. What's your target role in IT Tech Sales (e.g. Enterprise AE)?",
              "bot",
              ["Skip Career Vision for Now"],
            );
          }, 1000);
        }
      } else if (state === "AWAITING_GPS_VISION") {
        if (workingInput.toLowerCase().includes("skip")) {
          addMessage(
            "No problem! You can set up your Career GPS anytime from your dashboard.",
            "bot",
          );
          const nextState = "AWAITING_ID";
          await saveStep(nextState);
          setState(nextState);
          setTimeout(() => {
            addMessage(
              "Now, for verification and security, please upload a scan or photo of your government-issued ID (DL, Passport, etc).",
              "bot",
              ["Skip ID Proof for Now"]
            );
          }, 1000);
        } else {
          // Save target_role
          try {
            const token = awsAuth.getToken();
            if (!token) {
              addMessage("Error: Authentication required. Please log in again.", "bot");
              return;
            }
            
            const result = await apiClient.patch(
              "/candidate/profile",
              { target_role: workingInput },
              token,
            );
            
            if (result) {
              addMessage(`Got it! Target Role: ${workingInput}. Saved successfully.`, "bot");
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
            addMessage(
              "Which specific categories or tech verticals interest you most (e.g. SaaS, Cloud, CyberSecurity)?",
              "bot",
              ["Skip This Step"]
            );
          }, 1000);
        }
      } else if (state === "AWAITING_GPS_INTERESTS") {
        if (workingInput.toLowerCase().includes("skip")) {
          addMessage("Skipping interests for now.", "bot");
        } else {
          try {
            const token = awsAuth.getToken();
            if (!token) {
              addMessage("Error: Authentication required. Please log in again.", "bot");
              return;
            }
            
            // Split comma-separated string into an array for the TEXT[] database column
            const interestsArray = workingInput
              .split(",")
              .map((i) => i.trim())
              .filter(Boolean);
            
            const result = await apiClient.patch(
              "/candidate/profile",
              { career_interests: interestsArray },
              token,
            );
            
            if (result) {
              addMessage(`Tech Interests recorded: ${workingInput}. Saved successfully.`, "bot");
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
          addMessage(
            "Finally, what's your ultimate career long-term goal?",
            "bot",
            ["Skip Goal Setting"]
          );
        }, 1000);
      } else if (state === "AWAITING_GPS_GOAL") {
        if (workingInput.toLowerCase().includes("skip")) {
          addMessage("Skipping long-term goal for now.", "bot");
        } else {
          try {
            const token = awsAuth.getToken();
            if (!token) {
              addMessage("Error: Authentication required. Please log in again.", "bot");
              return;
            }
            
            const result = await apiClient.patch(
              "/candidate/profile",
              { long_term_goal: workingInput },
              token,
            );
            
            if (result) {
              addMessage(
                "Career vision captured! We'll use this to build your personalized Career GPS.",
                "bot",
              );
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
          addMessage(
            "Now, for verification and security, please upload a scan or photo of your government-issued ID (DL, Passport, etc).",
            "bot",
            ["Skip ID Proof for Now"]
          );
        }, 1000);
      } else if (state === "AWAITING_ID") {
        if (workingInput.toLowerCase().includes("skip")) {
          addMessage("Skipping ID upload. Please note your profile will not be 'Verified' without this.", "bot");
          const nextState = "AWAITING_TC";
          await saveStep(nextState);
          setState(nextState);
          setTimeout(() => {
             addMessage("Lastly, please read and accept our Terms and Conditions to complete your onboarding.", "bot", ["Read Terms & Conditions", "Accept & Finish"]);
          }, 1000);
        } else {
          // Add a message if someone tries to type during ID upload step
          addMessage(
            "Please upload your ID document using the upload button below.",
            "bot",
            ["Skip ID Proof for Now"]
          );
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

        addMessage("Terms accepted! Your onboarding is now complete.", "bot");

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
      
      const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001"}${endpoint}`, {
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
        className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                msg.sender === "user"
                  ? "bg-primary text-white rounded-tr-none"
                  : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
              }`}
            >
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
            </div>
            {msg.options && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleSend(opt)}
                    disabled={isLoading}
                    className="bg-white hover:bg-primary-light text-primary border border-primary-light text-xs py-2 px-4 rounded-full transition-all shadow-sm"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="text-xs text-slate-400 animate-pulse">
            Assistant is thinking...
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {state === "AWAITING_SKILLS" && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-lg animate-in fade-in slide-in-from-bottom-4 z-10 max-h-[40vh] overflow-y-auto">
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
                  className="bg-primary text-white text-[10px] font-bold px-3 py-1.5 rounded-lg hover:bg-primary-dark disabled:bg-slate-300 transition-colors shadow-sm"
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

          <div className="flex items-center gap-3">
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
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-80"
            />
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={state === "AWAITING_RESUME" || state === "AWAITING_ID"}
              className={`p-3 rounded-xl ${isListening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-600"} disabled:opacity-50`}
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
              className="p-3 bg-primary text-white rounded-xl disabled:bg-slate-300"
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

