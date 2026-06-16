"use client";

import { useState, useEffect, useRef } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  Plus,
  Sparkles,
  Briefcase,
  Target,
  Layers,
  MapPin,
  Users,
  DollarSign,
  Zap,
  ArrowLeft,
  Globe,
  X,
  Send,
  Workflow,
  FileUp,
  Share2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Activity,
} from "lucide-react";
import LockedView from "@/components/dashboard/LockedView";

const standardSkills = [
  "CRM",
  "B2B Sales",
  "Lead Generation",
  "SaaS",
  "Negotiation",
  "Prospecting",
  "Cold Calling",
  "Account Management",
  "Sales Strategy",
  "Closing Deals",
  "Relationship Building",
  "React",
  "Node.js",
  "TypeScript",
  "Python",
  "AWS",
  "Product Demo",
  "Enterprise Sales",
  "Solution Selling",
  "Pipeline Management"
];

const assessmentTemplates = [
  { id: "tech_sales_intro", name: "Technical Sales Representative (Level 1)" },
  { id: "enterprise_sales", name: "Enterprise Account Executive (Level 2)" },
  { id: "negotiation_rubric", name: "Advanced Contract & Negotiation Assessment" },
  { id: "lead_generation", name: "Inbound/Outbound Lead Generation & Qualification" },
];

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  // Job Form Data
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: [] as string[],
    skills_required: [] as string[],
    experience_band: "mid",
    job_type: "onsite",
    location: "",
    salary_range: "",
    min_salary: "" as string | number,
    max_salary: "" as string | number,
    currency: "USD",
    salary_frequency: "yearly",
    assessment_template_id: "",
    number_of_positions: 1,
    is_ai_generated: false,
    status: "active" as "active" | "paused",
  });

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [skillsInput, setSkillsInput] = useState("");
  const [positionsInput, setPositionsInput] = useState("1");
  const [matchPotential, setMatchPotential] = useState<{ count: number; message: string } | null>(null);
  const [checkingPotential, setCheckingPotential] = useState(false);
  const [jdUploading, setJdUploading] = useState(false);
  const [jdUploadSuccess, setJdUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const jdFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if ([".pdf", ".docx", ".doc", ".txt"].includes(ext)) {
        handleJDUpload(file);
      } else {
        alert("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
      }
    }
  };

  const getExperienceBandLabel = (band: string) => {
    switch (band) {
      case "fresher":
        return "0-1 (Fresher)";
      case "mid":
        return "1-5 (Mid-level)";
      case "senior":
        return "5-10 (Senior)";
      case "leadership":
        return "10+ (Leadership)";
      default:
        return band;
    }
  };

  useEffect(() => {
    async function checkAccess() {
      try {
        const token = awsAuth.getToken();
        if (!token) return;
        const profile = await apiClient.get(
          "/recruiter/profile",
          token,
        );
        if ((profile?.companies?.profile_score ?? 0) === 0) {
          setIsLocked(true);
        }

        // Check for cloning parameter
        const searchParams = new URLSearchParams(window.location.search);
        const cloneId = searchParams.get("clone");
        if (cloneId) {
          const jobs = await apiClient.get("/recruiter/jobs", token);
          const clonedJob = jobs.find((j: any) => j.id === cloneId);
          if (clonedJob) {
            const meta = clonedJob.metadata || {};
            setFormData({
              title: clonedJob.title ? `Copy of ${clonedJob.title}` : "",
              description: clonedJob.description || "",
              requirements: clonedJob.requirements || [],
              skills_required: clonedJob.skills_required || [],
              experience_band: clonedJob.experience_band || "mid",
              job_type: clonedJob.job_type || "onsite",
              location: clonedJob.location || "",
              salary_range: clonedJob.salary_range || "",
              min_salary: meta.min_salary || "",
              max_salary: meta.max_salary || "",
              currency: meta.currency || "USD",
              salary_frequency: meta.salary_frequency || "yearly",
              assessment_template_id: meta.assessment_template_id || "",
              number_of_positions: clonedJob.number_of_positions || 1,
              is_ai_generated: clonedJob.is_ai_generated || false,
              status: "active",
            });
            setPositionsInput(String(clonedJob.number_of_positions || 1));
          }
        }
      } catch (err) {
        console.error("Lock check or cloning failed:", err);
      } finally {
        setCheckingLock(false);
      }
    }
    checkAccess();
  }, []);

  const handleCreateJob = async (status: "active" | "paused") => {
    setLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      // Add any remaining skill in input
      let finalSkills = [...formData.skills_required];
      if (skillsInput.trim()) {
        const skill = skillsInput.trim();
        if (!finalSkills.includes(skill)) {
          finalSkills = [...finalSkills, skill];
        }
      }

      // Ensure positions has a valid default value
      let finalPositions = formData.number_of_positions;
      if (!positionsInput || parseInt(positionsInput, 10) < 1) {
        finalPositions = 1;
      }

      // Format salary range dynamically if structured is filled
      let finalSalaryRange = formData.salary_range;
      if (formData.min_salary && formData.max_salary) {
        const symbol = formData.currency === "INR" ? "₹" : "$";
        const minLpa = formData.currency === "INR" ? Number(formData.min_salary)/100000 : Number(formData.min_salary)/1000;
        const maxLpa = formData.currency === "INR" ? Number(formData.max_salary)/100000 : Number(formData.max_salary)/1000;
        const suffix = formData.currency === "INR" ? " LPA" : "k";
        finalSalaryRange = `${symbol}${minLpa}${suffix} - ${symbol}${maxLpa}${suffix}`;
      }

      await apiClient.post("/recruiter/jobs", { 
        ...formData, 
        skills_required: finalSkills,
        number_of_positions: finalPositions,
        salary_range: finalSalaryRange,
        status: status,
      }, token);
      router.push("/dashboard/recruiter/hiring/jobs");
    } catch (err) {
      console.error("Failed to create job:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt) return;
    setAiLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const aiResult = await apiClient.post(
        "/recruiter/jobs/generate-ai",
        {
          prompt: aiPrompt,
          experience_band: formData.experience_band,
          location: formData.location,
        },
        token,
      );

      // Parse AI salary values into structured fields if returned
      let minVal = "";
      let maxVal = "";
      let curr = "USD";
      let freq = "yearly";

      if (aiResult.salary_range) {
        const text = aiResult.salary_range.toLowerCase();
        
        // Currency detection
        if (text.includes("₹") || text.includes("inr") || text.includes("lpa")) {
          curr = "INR";
        } else if (text.includes("€") || text.includes("eur")) {
          curr = "EUR";
        } else if (text.includes("£") || text.includes("gbp")) {
          curr = "GBP";
        } else if (text.includes("a$") || text.includes("aud")) {
          curr = "AUD";
        }

        // Frequency detection
        if (text.includes("/hr") || text.includes("hour")) {
          freq = "hourly";
        } else if (text.includes("/mo") || text.includes("month")) {
          freq = "monthly";
        }

        const cleanText = text.replace(/,/g, "");
        const numbers = cleanText.match(/\d+(?:\.\d+)?/g);
        if (numbers && numbers.length >= 2) {
          let minNum = parseFloat(numbers[0]);
          let maxNum = parseFloat(numbers[1]);
          if (cleanText.includes(numbers[0] + "k")) minNum *= 1000;
          if (cleanText.includes(numbers[1] + "k")) maxNum *= 1000;
          if (cleanText.includes("lpa") || cleanText.includes("lakh")) {
            minNum *= 100000;
            maxNum *= 100000;
          }
          minVal = String(minNum);
          maxVal = String(maxNum);
        } else if (numbers && numbers.length === 1) {
          let num = parseFloat(numbers[0]);
          if (cleanText.includes(numbers[0] + "k")) num *= 1000;
          if (cleanText.includes("lpa") || cleanText.includes("lakh")) num *= 100000;
          minVal = String(num);
          maxVal = String(num);
        }
      }

      setFormData({
        ...formData,
        ...aiResult,
        min_salary: minVal || formData.min_salary,
        max_salary: maxVal || formData.max_salary,
        currency: curr,
        salary_frequency: freq,
        is_ai_generated: true,
      });
      setShowAiAssistant(false);
    } catch (err) {
      console.error("AI Generation failed:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRecalculateSalary = async () => {
    if (!formData.title || !formData.location) return;
    setSalaryLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const aiResult = await apiClient.post(
        "/recruiter/jobs/generate-ai",
        {
          prompt: `Recalculate ONLY salary for role "${formData.title}" in location "${formData.location}" for ${formData.experience_band} level.`,
          experience_band: formData.experience_band,
          location: formData.location,
        },
        token,
      );

      if (aiResult.salary_range) {
        let minVal = "";
        let maxVal = "";
        let curr = "USD";
        let freq = "yearly";

        const text = aiResult.salary_range.toLowerCase();
        
        // Currency detection
        if (text.includes("₹") || text.includes("inr") || text.includes("lpa")) {
          curr = "INR";
        } else if (text.includes("€") || text.includes("eur")) {
          curr = "EUR";
        } else if (text.includes("£") || text.includes("gbp")) {
          curr = "GBP";
        } else if (text.includes("a$") || text.includes("aud")) {
          curr = "AUD";
        }

        // Frequency detection
        if (text.includes("/hr") || text.includes("hour")) {
          freq = "hourly";
        } else if (text.includes("/mo") || text.includes("month")) {
          freq = "monthly";
        }

        const cleanText = text.replace(/,/g, "");
        const numbers = cleanText.match(/\d+(?:\.\d+)?/g);
        if (numbers && numbers.length >= 2) {
          let minNum = parseFloat(numbers[0]);
          let maxNum = parseFloat(numbers[1]);
          if (cleanText.includes(numbers[0] + "k")) minNum *= 1000;
          if (cleanText.includes(numbers[1] + "k")) maxNum *= 1000;
          if (cleanText.includes("lpa") || cleanText.includes("lakh")) {
            minNum *= 100000;
            maxNum *= 100000;
          }
          minVal = String(minNum);
          maxVal = String(maxNum);
        } else if (numbers && numbers.length === 1) {
          let num = parseFloat(numbers[0]);
          if (cleanText.includes(numbers[0] + "k")) num *= 1000;
          if (cleanText.includes("lpa") || cleanText.includes("lakh")) num *= 100000;
          minVal = String(num);
          maxVal = String(num);
        }

        setFormData((prev) => ({
          ...prev,
          salary_range: aiResult.salary_range,
          min_salary: minVal || prev.min_salary,
          max_salary: maxVal || prev.max_salary,
          currency: curr,
          salary_frequency: freq,
        }));
      }
    } catch (err) {
      console.error("Salary recalculation failed:", err);
    } finally {
      setSalaryLoading(false);
    }
  };

  const handleCheckMatchPotential = async () => {
    if (!formData.skills_required.length && !formData.title) {
      alert("Please add at least a job title or skills before checking match potential");
      return;
    }
    setCheckingPotential(true);
    setMatchPotential(null);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const bandToYears: Record<string, number> = {
        'fresher': 0,
        'mid': 3,
        'senior': 7,
        'leadership': 12
      };

      const result = await apiClient.post(
        "/recruiter/check-job-potential",
        {
          skills: formData.skills_required,
          experience_years: bandToYears[formData.experience_band] || 2,
          location: formData.location,
          salary_range: formData.salary_range,
          title: formData.title
        },
        token
      );

      let message = "";
      if (result.count === 0) {
        message = "No candidates found yet. Consider broadening your criteria or adjusting requirements.";
      } else if (result.count === 1) {
        message = `Perfect match! Found 1 candidate with your exact requirements.`;
      } else if (result.count <= 5) {
        message = `Great talent pool! Found ${result.count} highly qualified candidates.`;
      } else if (result.count <= 10) {
        message = `Excellent response! Found ${result.count} matching candidates in talent pool.`;
      } else {
        message = `Strong talent pool! Found ${result.count}+ candidates matching your requirements.`;
      }

      setMatchPotential({
        ...result,
        message: message,
      });
    } catch (err) {
      console.error("Match potential check failed:", err);
      setMatchPotential({
        count: 0,
        message: "Unable to check match potential. Please try again."
      });
    } finally {
      setCheckingPotential(false);
    }
  };

  const handleJDUpload = async (file: File) => {
    if (!file) return;
    setJdUploading(true);
    setJdUploadSuccess(false);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const result = await apiClient.post(
        "/recruiter/jobs/parse-jd",
        formDataUpload,
        token,
      );

      if (result && result.title) {
        let minVal = "";
        let maxVal = "";
        let curr = "USD";
        let freq = "yearly";

        if (result.salary_range) {
          const text = result.salary_range.toLowerCase();
          
          // Currency detection
          if (text.includes("₹") || text.includes("inr") || text.includes("lpa")) {
            curr = "INR";
          } else if (text.includes("€") || text.includes("eur")) {
            curr = "EUR";
          } else if (text.includes("£") || text.includes("gbp")) {
            curr = "GBP";
          } else if (text.includes("a$") || text.includes("aud")) {
            curr = "AUD";
          }

          const cleanText = text.replace(/,/g, "");
          const numbers = cleanText.match(/\d+(?:\.\d+)?/g);
          if (numbers && numbers.length >= 2) {
            let minNum = parseFloat(numbers[0]);
            let maxNum = parseFloat(numbers[1]);
            if (cleanText.includes(numbers[0] + "k")) minNum *= 1000;
            if (cleanText.includes(numbers[1] + "k")) maxNum *= 1000;
            if (cleanText.includes("lpa") || cleanText.includes("lakh")) {
              minNum *= 100000;
              maxNum *= 100000;
            }
            minVal = String(minNum);
            maxVal = String(maxNum);
          }
        }

        setFormData({
          ...formData,
          title: result.title || formData.title,
          description: result.description || formData.description,
          requirements: result.requirements || formData.requirements,
          skills_required: result.skills_required || formData.skills_required,
          experience_band: result.experience_band || formData.experience_band,
          job_type: result.job_type || formData.job_type,
          location: result.location || formData.location,
          salary_range: result.salary_range || formData.salary_range,
          min_salary: minVal || formData.min_salary,
          max_salary: maxVal || formData.max_salary,
          currency: curr,
          salary_frequency: freq,
          number_of_positions: result.number_of_positions || formData.number_of_positions,
          is_ai_generated: true,
        });
        if (result.number_of_positions) {
          setPositionsInput(String(result.number_of_positions));
        }
        setJdUploadSuccess(true);
        setTimeout(() => setJdUploadSuccess(false), 4000);
      }
    } catch (err) {
      console.error("JD Upload failed:", err);
      alert("Failed to parse the uploaded file. Please try a different file.");
    } finally {
      setJdUploading(false);
      if (jdFileInputRef.current) {
        jdFileInputRef.current.value = "";
      }
    }
  };

  const insertFormatting = (tagStart: string, tagEnd: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    
    const replacement = tagStart + (selected || "Text") + tagEnd;
    
    setFormData((prev) => ({
      ...prev,
      description: text.substring(0, start) + replacement + text.substring(end)
    }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagStart.length, start + tagStart.length + (selected || "Text").length);
    }, 50);
  };

  // Filter skills taxonomy for autocomplete
  const filteredSkills = standardSkills.filter(
    (skill) =>
      skill.toLowerCase().includes(skillsInput.toLowerCase()) &&
      !formData.skills_required.includes(skill)
  );

  if (checkingLock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="p-12 min-h-screen bg-slate-50">
        <LockedView featureName="Job Creator" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.06),_transparent_40%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_56%,#FFFDF9_100%)] text-slate-900 flex flex-col">
      
      {/* Header bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/recruiter/hiring/jobs")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-orange-100 bg-[#FFF7EE] text-[#C96B00] transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
            aria-label="Back to jobs"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight">New Role Creator</h1>
            <p className="text-[10px] font-bold text-slate-400">Step {currentStep} of 4</p>
          </div>
        </div>

        {/* Wizard progress bar */}
        <div className="flex items-center gap-2 max-w-xs w-full px-4 hidden sm:flex">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step <= currentStep ? "bg-[#FF8A00]" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setShowAiAssistant(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 hover:bg-blue-100 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Assist
          </button>
          <button
            type="button"
            onClick={() => jdFileInputRef.current?.click()}
            disabled={jdUploading}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 transition-all ${
              jdUploadSuccess
                ? "border-emerald-200 bg-emerald-600 text-white shadow-sm"
                : jdUploading
                  ? "border-violet-200 bg-violet-600 text-white shadow-sm"
                  : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
            }`}
          >
            {jdUploading ? (
              <>
                <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Parsing...
              </>
            ) : jdUploadSuccess ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                JD Parsed!
              </>
            ) : (
              <>
                <FileUp className="h-3.5 w-3.5" />
                Upload JD
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1.45fr_380px] overflow-hidden">
        
        {/* Left Form Panel */}
        <div className="h-full overflow-y-auto p-6 flex flex-col justify-between job-form-scroll">
          <div className="space-y-6">
            
            {/* Step 1: Role Core */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <Section title="Role Architecture" icon={Briefcase} tone="orange">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label="Job title" icon={Target}>
                      <input
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        placeholder="Lead Software Architect"
                      />
                    </Field>
                    <Field label="Location" icon={MapPin}>
                      <input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        placeholder="City, Country"
                      />
                    </Field>
                    <Field label="Experience band" icon={Layers}>
                      <select
                        value={formData.experience_band}
                        onChange={(e) => setFormData({ ...formData, experience_band: e.target.value })}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                      >
                        <option value="fresher">0-1 (Fresher)</option>
                        <option value="mid">1-5 (Mid-level)</option>
                        <option value="senior">5-10 (Senior)</option>
                        <option value="leadership">10+ (Leadership)</option>
                      </select>
                    </Field>
                    <Field label="Work model" icon={Workflow}>
                      <select
                        value={formData.job_type}
                        onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                      >
                        <option value="onsite">On-site</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="remote">Remote</option>
                      </select>
                    </Field>
                    <Field label="Open positions" icon={Users}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={positionsInput}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            setPositionsInput("");
                          } else if (/^\d+$/.test(value)) {
                            const num = parseInt(value, 10);
                            if (num >= 1) {
                              setPositionsInput(value);
                              setFormData({
                                ...formData,
                                number_of_positions: num,
                              });
                            }
                          }
                        }}
                        onBlur={() => {
                          if (positionsInput === "" || parseInt(positionsInput, 10) < 1) {
                            setPositionsInput("1");
                            setFormData({
                              ...formData,
                              number_of_positions: 1,
                            });
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        placeholder="1"
                      />
                    </Field>
                  </div>
                </Section>
              </div>
            )}

            {/* Step 2: Mission & Details */}
            {currentStep === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <Section title="Mission & Details" icon={Zap} tone="amber">
                  <div className="space-y-4">
                    <Field label="Role description" icon={Zap} fullWidth>
                      
                      {/* Simple formatting toolbar */}
                      <div className="flex items-center gap-1 mb-1.5 border border-slate-100 rounded-lg p-1 bg-slate-50/50">
                        <button
                          type="button"
                          onClick={() => insertFormatting("<strong>", "</strong>")}
                          className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:bg-white rounded hover:text-[#FF8A00] transition"
                        >
                          Bold
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("<em>", "</em>")}
                          className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:bg-white rounded hover:text-[#FF8A00] transition"
                        >
                          Italic
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("<li>", "</li>")}
                          className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:bg-white rounded hover:text-[#FF8A00] transition"
                        >
                          List Item
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("<ul>\n  <li>", "</li>\n</ul>")}
                          className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:bg-white rounded hover:text-[#FF8A00] transition"
                        >
                          Bullet List
                        </button>
                      </div>

                      <textarea
                        ref={textareaRef}
                        required
                        rows={6}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        placeholder="Describe the mission, responsibilities, and daily impact of the role..."
                      />
                    </Field>

                    <Field label="Core requirements" icon={Target} fullWidth>
                      <textarea
                        rows={4}
                        value={formData.requirements?.join("\n") || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            requirements: e.target.value.split("\n").filter(Boolean),
                          })
                        }
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        placeholder="Define technical or professional prerequisites (one requirement per line)"
                      />
                    </Field>
                  </div>
                </Section>
              </div>
            )}

            {/* Step 3: Compensation & Assessments */}
            {currentStep === 3 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <Section title="Compensation & Assessments" icon={Sparkles} tone="blue">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Currency Selector */}
                      <Field label="Currency" icon={Globe}>
                        <select
                          value={formData.currency}
                          onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        >
                          <option value="USD">USD ($)</option>
                          <option value="INR">INR (₹)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="AUD">AUD (A$)</option>
                        </select>
                      </Field>

                      {/* Salary Frequency */}
                      <Field label="Salary Frequency" icon={Workflow}>
                        <select
                          value={formData.salary_frequency}
                          onChange={(e) => setFormData({ ...formData, salary_frequency: e.target.value })}
                          className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        >
                          <option value="yearly">Per Year (Annual)</option>
                          <option value="monthly">Per Month</option>
                          <option value="hourly">Per Hour</option>
                        </select>
                      </Field>
                      
                      {/* Min Salary */}
                      <Field label="Minimum Salary" icon={DollarSign}>
                        <input
                          type="number"
                          value={formData.min_salary}
                          onChange={(e) => setFormData({ ...formData, min_salary: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                          placeholder="e.g. 80000"
                        />
                      </Field>

                      {/* Max Salary */}
                      <Field label="Maximum Salary" icon={DollarSign}>
                        <input
                          type="number"
                          value={formData.max_salary}
                          onChange={(e) => setFormData({ ...formData, max_salary: e.target.value })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                          placeholder="e.g. 120000"
                        />
                      </Field>
                    </div>

                    {/* Auto Detect Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleRecalculateSalary}
                        disabled={salaryLoading || !formData.location || !formData.title}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Auto-detect salary range based on location, title, and experience level"
                      >
                        {salaryLoading ? (
                          <>
                            <div className="h-3 w-3 rounded-full border-2 border-blue-700 border-t-transparent animate-spin" />
                            Detecting
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Auto-Detect Market Salary
                          </>
                        )}
                      </button>
                    </div>

                    {/* Pre-Assessment Selection */}
                    <Field label="Link Pre-Assessment" icon={ClipboardList} fullWidth>
                      <select
                        value={formData.assessment_template_id}
                        onChange={(e) => setFormData({ ...formData, assessment_template_id: e.target.value })}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                      >
                        <option value="">No pre-assessment (Direct Apply)</option>
                        {assessmentTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                        Candidates will be redirected to complete this test automatically when they click apply.
                      </p>
                    </Field>
                  </div>
                </Section>
              </div>
            )}

            {/* Step 4: Preview & Publish */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <Section title="Preview & Skills" icon={Globe} tone="green">
                  <div className="space-y-4">
                    
                    {/* Technical Skills Autocomplete */}
                    <Field label="Technical skills required" icon={Zap} fullWidth>
                      <div className="space-y-3 relative">
                        <input
                          value={skillsInput}
                          onChange={(e) => {
                            setSkillsInput(e.target.value);
                            setShowSkillDropdown(true);
                          }}
                          onFocus={() => setShowSkillDropdown(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const skill = skillsInput.trim();
                              if (skill && !formData.skills_required.includes(skill)) {
                                setFormData({
                                  ...formData,
                                  skills_required: [...formData.skills_required, skill],
                                });
                                setSkillsInput("");
                                setShowSkillDropdown(false);
                              }
                            }
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                          placeholder="Type a skill, then press Enter or choose from suggestions"
                        />

                        {/* Autocomplete Dropdown list */}
                        {showSkillDropdown && skillsInput && filteredSkills.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-1.5">
                            {filteredSkills.map((skill) => (
                              <button
                                key={skill}
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    skills_required: [...formData.skills_required, skill],
                                  });
                                  setSkillsInput("");
                                  setShowSkillDropdown(false);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-700 rounded-lg hover:bg-orange-50 hover:text-[#FF8A00] transition"
                              >
                                {skill}
                              </button>
                            ))}
                          </div>
                        )}

                        {formData.skills_required.length > 0 && (
                          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                            {formData.skills_required.map((skill, index) => (
                              <div
                                key={index}
                                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700"
                              >
                                {skill}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = formData.skills_required.filter((_, i) => i !== index);
                                    setFormData({
                                      ...formData,
                                      skills_required: updated,
                                    });
                                  }}
                                  className="rounded-full p-0.5 hover:bg-blue-100 hover:text-blue-900"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Field>

                    {/* Preview Talent Action Banner */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleCheckMatchPotential}
                        disabled={checkingPotential || formData.skills_required.length === 0}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {checkingPotential ? (
                          <div className="h-3 w-3 rounded-full border-2 border-emerald-700 border-t-transparent animate-spin" />
                        ) : (
                          <Target className="h-3.5 w-3.5" />
                        )}
                        Preview matching candidates
                      </button>
                    </div>

                    {matchPotential && (
                      <div
                        className={`rounded-2xl border p-4 shadow-sm animate-in zoom-in-95 duration-200 ${
                          matchPotential.count === 0
                            ? "border-amber-200 bg-amber-50"
                            : "border-emerald-200 bg-emerald-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                              matchPotential.count === 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            <Users className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2
                              className={`text-xs font-black uppercase tracking-tight ${
                                matchPotential.count === 0 ? "text-amber-900" : "text-emerald-900"
                              }`}
                            >
                              {matchPotential.message}
                            </h2>
                            {matchPotential.count > 0 && (
                              <div className="mt-2 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                <span>{matchPotential.count} matching candidates</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const skillsParam = encodeURIComponent(formData.skills_required.join(","));
                                    const locParam = encodeURIComponent(formData.location || "");
                                    router.push(`/dashboard/recruiter/talent-pool?filter=skill_match&skills=${skillsParam}&location=${locParam}`);
                                  }}
                                  className="text-emerald-700 underline decoration-emerald-400 underline-offset-4 hover:text-emerald-800"
                                >
                                  Open talent pool
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Section>
              </div>
            )}
          </div>

          {/* Form navigation controls */}
          <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="inline-flex items-center gap-1 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="inline-flex items-center gap-1 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white bg-slate-900 hover:bg-[#FF8A00] rounded-xl transition shadow-md shadow-slate-200 hover:shadow-orange-100"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCreateJob("paused")}
                  disabled={loading || !formData.title}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 bg-white border border-slate-200 hover:border-slate-350 rounded-xl transition active:scale-95 disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateJob("active")}
                  disabled={loading || !formData.title}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white bg-[#FF8A00] hover:bg-[#E67A00] rounded-xl transition active:scale-95 shadow-md shadow-orange-100"
                >
                  Publish Role
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Preview Panel - Viewport Locked */}
        <aside className="h-full overflow-y-auto p-6 bg-slate-50/20 border-l border-slate-100 hidden lg:block job-form-scroll">
          <div className="space-y-4 sticky top-0">
            <div className="rounded-[24px] bg-[linear-gradient(135deg,#FFF7EE_0%,#FFFFFF_55%,#FFF1E3_100%)] p-5 ring-1 ring-orange-100/80 shadow-[0_8px_24px_rgba(255,138,0,0.04)]">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#C96B00]">Real-Time Card Preview</p>
              
              <h2 className="mt-2 text-base font-black tracking-tight text-slate-900 line-clamp-1">
                {formData.title || "Untitled Role"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 font-bold uppercase">
                {formData.location || "Remote"} · {formData.job_type}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Positions</p>
                  <p className="mt-0.5 text-slate-800">{formData.number_of_positions}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Experience</p>
                  <p className="mt-0.5 text-slate-800 truncate">{getExperienceBandLabel(formData.experience_band)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Skills Required</p>
                  <p className="mt-0.5 text-slate-800">{formData.skills_required.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">Salary</p>
                  <p className="mt-0.5 text-slate-800 truncate">
                    {formData.min_salary && formData.max_salary 
                      ? `${formData.currency === "INR" ? "₹" : "$"}${formData.currency === "INR" ? Number(formData.min_salary)/100000 : Number(formData.min_salary)/1000}${formData.currency === "INR" ? "L" : "k"} - ${formData.currency === "INR" ? "₹" : "$"}${formData.currency === "INR" ? Number(formData.max_salary)/100000 : Number(formData.max_salary)/1000}${formData.currency === "INR" ? "L" : "k"}`
                      : formData.salary_range || "Not specified"
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Document parser drag area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => jdFileInputRef.current?.click()}
              className={`group cursor-pointer rounded-[24px] border-2 border-dashed p-5 text-center transition-all duration-300 ${
                isDragging
                  ? "border-[#FF8A00] bg-orange-50/50 shadow-[0_10px_30px_rgba(255,138,0,0.12)] scale-[1.02]"
                  : "border-slate-200 bg-slate-50 hover:border-[#FF8A00]/50 hover:bg-white hover:shadow-[0_10px_24px_rgba(255,138,0,0.04)]"
              }`}
            >
              <div className="flex flex-col items-center gap-2.5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300 ${
                  isDragging || jdUploading
                    ? "bg-orange-100 text-[#FF8A00] animate-bounce"
                    : "bg-slate-100 text-slate-400 group-hover:bg-orange-50 group-hover:text-[#FF8A00]"
                }`}>
                  <FileUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 group-hover:text-[#FF8A00] uppercase tracking-tight">
                    {jdUploading ? "Parsing document..." : "Drag & drop JD file"}
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium text-slate-400">
                    Supports PDF, DOCX, or TXT (Max 10MB)
                  </p>
                </div>
                {!jdUploading && (
                  <span className="rounded-xl bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500 shadow-sm border border-slate-100 group-hover:border-orange-100 group-hover:text-[#FF8A00] transition-colors">
                    Browse File
                  </span>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* AI Assistant Modal */}
      {showAiAssistant && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-slate-950/25 px-4 pt-20 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-[linear-gradient(135deg,#FFF7EE_0%,#FFFFFF_100%)] p-5">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Generate Role with AI
                </h2>
                <p className="mt-1 text-[11px] font-medium text-slate-500">Describe the role and generate the first draft, then refine it in the editor.</p>
              </div>
              <button
                onClick={() => setShowAiAssistant(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2.5 block text-[10px] font-black uppercase tracking-wider text-slate-600">Your description</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Senior Frontend Engineer for our DeFi platform. Expertise in React, TypeScript, and Web3. Must have 5+ years experience..."
                  className="h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium outline-none focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAiAssistant(false)}
                  className="rounded-full bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700 transition-all hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiPrompt}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiLoading ? (
                    <>
                      <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for JD upload */}
      <input
        ref={jdFileInputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleJDUpload(file);
        }}
      />
    </div>
  );
}

// Reusable UI Components
function Section({
  title,
  icon: Icon,
  tone = "orange",
  children,
}: {
  title: string;
  icon: React.ElementType;
  tone?: "orange" | "amber" | "blue" | "green";
  children: React.ReactNode;
}) {
  const toneClasses = {
    orange: "border-orange-100 bg-[linear-gradient(180deg,#FFFDF9_0%,#FFFFFF_100%)]",
    amber: "border-amber-100 bg-[linear-gradient(180deg,#FFFDF6_0%,#FFFFFF_100%)]",
    blue: "border-blue-100 bg-[linear-gradient(180deg,#FBFDFF_0%,#FFFFFF_100%)]",
    green: "border-emerald-100 bg-[linear-gradient(180deg,#FBFFFD_0%,#FFFFFF_100%)]",
  }[tone];

  const iconClasses = {
    orange: "bg-[#FFF1E3] text-[#C96B00]",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
  }[tone];

  return (
    <div className={`rounded-[24px] border p-5 shadow-[0_8px_20px_rgba(15,23,42,0.04)] ${toneClasses}`}>
      <h2 className="mb-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">
        <div className={`rounded-2xl p-2 ${iconClasses}`}>
          <Icon className="h-4 w-4" />
        </div>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  fullWidth = false,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <label className="mb-2 flex items-center text-[10px] font-black uppercase tracking-wider text-slate-600">
        <Icon className="mr-2 h-3 w-3 text-slate-400" />
        {label}
      </label>
      {children}
    </div>
  );
}
