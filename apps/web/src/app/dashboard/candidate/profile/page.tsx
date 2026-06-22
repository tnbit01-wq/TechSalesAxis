"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import Image from "next/image";
import ProfileCompletionCircle from "@/components/ProfileCompletionCircle";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  DollarSign,
  Globe,
  GraduationCap,
  Linkedin,
  MapPin,
  PlusCircle,
  Share2,
  ShieldCheck,
  Target,
  Trash2,
  Users,
  User,
  ShieldAlert,
  LogOut,
  Tag,
  Coins,
  FileText,
} from "lucide-react";

interface EducationEntry {
  degree: string;
  field: string;
  institution: string;
  start_date: string;
  end_date: string;
  gpa_score: number | null | string;
}

interface ExperienceEntry {
  role: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  descriptions: string[];
}

interface CareerGapReport {
  has_gap_exceeding_6mo?: boolean;
  has_gap_exceeding_12mo?: boolean;
  total_gap_months?: number;
  explanation?: string;
  confidence_score?: number;
}

interface ProfileData {
  full_name?: string;
  phone_number?: string;
  bio?: string;
  profile_photo_url?: string;
  current_role?: string;
  target_role?: string;
  long_term_goal?: string;
  years_of_experience?: number;
  primary_industry_focus?: string;
  current_employment_status?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  job_type?: string;
  expected_salary?: number;
  assessment_status?: string;
  completion_score?: number;
  experience?: string;
  gender?: string;
  birthdate?: string;
  referral?: string;
  location?: string;
  identity_verified?: boolean;
  education_history?: EducationEntry[];
  experience_history?: ExperienceEntry[];
  career_gap_report?: CareerGapReport;
  
  // Missing DB fields
  location_tier?: string;
  key_responsibilities?: string;
  major_achievements?: string;
  career_interests?: string[] | string;
  learning_interests?: string[] | string;
}

export default function CandidateProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"identity" | "career" | "experience" | "presence">("identity");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleCompleteNow = () => {
    if (!profile?.full_name || !profile?.phone_number || !profile?.location) {
      setActiveTab("identity");
      setMessage({ type: "success", text: "Please complete your Identity details." });
    } else if (!profile?.target_role || !profile?.expected_salary || !profile?.primary_industry_focus) {
      setActiveTab("career");
      setMessage({ type: "success", text: "Please complete your Career preferences." });
    } else if (!profile?.experience_history || profile.experience_history.length === 0) {
      setActiveTab("experience");
      setMessage({ type: "success", text: "Please add your work experience." });
    } else {
      setActiveTab("presence");
      setMessage({ type: "success", text: "Please complete your presence & interests details." });
    }
  };

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }
        const data = await apiClient.get("/candidate/profile", token);
        setProfile(data);
      } catch (error) {
        console.error("Fetch profile error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let nextValue: string | number | null = value;
    if (type === "number") {
      nextValue = value === "" ? null : Number(value);
    }
    setProfile((prev) => (prev ? { ...prev, [name]: nextValue } : null));
  };

  const handleArrayInputChange = (field: "education_history" | "experience_history", index: number, name: string, value: any) => {
    setProfile((prev) => {
      if (!prev) return null;
      const history = [...(prev[field] || [])];
      history[index] = { ...history[index], [name]: value } as EducationEntry | ExperienceEntry;
      return { ...prev, [field]: history };
    });
  };

  const addHistoryItem = (field: "education_history" | "experience_history") => {
    setProfile((prev) => {
      if (!prev) return null;
      const history = [...(prev[field] || [])];
      history.push(
        field === "education_history"
          ? { degree: "", field: "", institution: "", start_date: "", end_date: "", gpa_score: null }
          : { role: "", company: "", location: "", start_date: "", end_date: "", is_current: false, descriptions: [""] },
      );
      return { ...prev, [field]: history };
    });
  };

  const removeHistoryItem = (field: "education_history" | "experience_history", index: number) => {
    setProfile((prev) => {
      if (!prev) return null;
      const history = [...(prev[field] || [])];
      history.splice(index, 1);
      return { ...prev, [field]: history };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("No session found");

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiClient.post("/storage/upload/profile-photo", formData, token);
      const publicUrl = data.url;

      setProfile((prev) => (prev ? { ...prev, profile_photo_url: publicUrl } : null));
      await apiClient.patch("/candidate/profile", { profile_photo_url: publicUrl }, token);
      setMessage({ type: "success", text: "Profile photo updated successfully." });
    } catch (error: any) {
      console.error("Upload error:", error);
      setMessage({ type: "error", text: error.message || "Failed to upload photo" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken() || undefined;
      const result = await apiClient.patch("/candidate/profile", profile, token);
      setProfile((prev) => (prev ? { ...prev, completion_score: result.completion_score } : null));
      setMessage({ type: "success", text: "Profile settings saved successfully." });
    } catch (error: any) {
      console.error("Save error:", error);
      setMessage({ type: "error", text: error.message || "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleRetakeAssessment = async () => {
    if (!confirm("Are you sure you want to reset your evaluation? This will permanently delete your scores and insights.")) return;
    try {
      const token = awsAuth.getToken() || undefined;
      await apiClient.post("/assessment/retake", {}, token);
      router.push("/assessment/candidate");
    } catch (error) {
      console.error("Retake error:", error);
      alert("Failed to reset evaluation. Please try again.");
    }
  };

  const handleLogout = () => {
    awsAuth.logout();
    router.replace("/login");
  };

  const getArrayAsString = (arr?: string[] | string) => {
    if (!arr) return "";
    if (typeof arr === "string") return arr;
    return arr.join(", ");
  };

  const handleCommaSeparatedChange = (field: "career_interests" | "learning_interests", value: string) => {
    const arr = value.split(",").map(val => val.trim()).filter(Boolean);
    setProfile(prev => prev ? { ...prev, [field]: arr } : null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#FF8A00]" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Loading Profile...</p>
        </div>
      </div>
    );
  }

  const isVerified = profile?.identity_verified || false;

  const experienceControl = profile?.assessment_status === "completed" ? (
    <LockedValue value={profile?.experience?.toUpperCase() || "NOT SET"} />
  ) : (
    <SelectInput
      name="experience"
      value={profile?.experience || "fresher"}
      onChange={handleInputChange}
      options={["fresher", "mid", "senior", "leadership"]}
      labels={["Fresher", "Mid-Level", "Senior", "Leadership"]}
    />
  );

  const yearsControl = profile?.assessment_status === "completed" ? (
    <LockedValue value={`${profile?.years_of_experience || 0} Years`} />
  ) : (
    <TextInput
      type="number"
      name="years_of_experience"
      value={profile?.years_of_experience || 0}
      onChange={handleInputChange}
    />
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50/30 overflow-hidden font-sans">
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 min-h-0">
        
        {/* Left Panel: Standalone Sidebar Card */}
        <aside className="w-full md:w-80 shrink-0 bg-white border border-slate-100 rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col items-center select-none min-h-0 overflow-y-auto">
            
            <ProfileCompletionCircle
              percentage={profile?.completion_score || 0}
              photoUrl={profile?.profile_photo_url}
              name={profile?.full_name}
              size={90}
              uploading={uploading}
              onUploadClick={() => fileInputRef.current?.click()}
              onCompleteNowClick={handleCompleteNow}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoUpload}
              className="hidden"
              accept="image/*"
            />

            <div className="mt-3.5 flex items-center justify-center gap-1.5 max-w-full">
              <h2 className="text-sm font-black text-slate-800 truncate">
                {profile?.full_name || "Candidate Profile"}
              </h2>
              <button
                type="button"
                onClick={() => router.push("/dashboard/candidate/settings?tab=security")}
                className={`transition-all duration-200 hover:scale-110 active:scale-95 shrink-0 ${
                  isVerified ? "text-emerald-500 hover:text-emerald-650" : "text-rose-500 hover:text-rose-650 animate-pulse"
                }`}
                title={isVerified ? "Verified Status Badge" : "Unverified. Click to verify."}
              >
                {isVerified ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <ShieldAlert className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-bold tracking-wide truncate max-w-full uppercase mt-0.5">
              {profile?.current_role || "Job Seeker"}
            </p>

            <div className="mt-3 w-full border-t border-slate-100 pt-3 space-y-1.5 text-[10px]">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400 font-bold">Assessment:</span>
                <span className="text-slate-700 capitalize">{profile?.assessment_status?.replace("_", " ") || "In progress"}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-400 font-bold">Experience:</span>
                <span className="text-slate-700 font-bold">{profile?.years_of_experience || 0} years</span>
              </div>
            </div>

            {/* Navigation Tabs List (Vertical) */}
            <nav className="mt-6 w-full flex-1 space-y-1">
              {[
                { id: "identity", label: "Identity", icon: User },
                { id: "career", label: "Career Alignment", icon: Target },
                { id: "experience", label: "Experience & Education", icon: Briefcase },
                { id: "presence", label: "Presence & Interests", icon: Globe },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[9px] transition-all cursor-pointer select-none active:scale-95 ${
                      isActive
                        ? "bg-gradient-to-br from-[#FF8A00] to-[#FF6B00] text-white shadow-md shadow-orange-500/10"
                        : "text-slate-600 hover:text-slate-700 hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer Buttons */}
            <div className="mt-6 pt-4 border-t border-slate-100/80 w-full flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard/candidate")}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 py-2 text-[9px] font-black uppercase tracking-wider text-slate-600 transition hover:bg-white active:scale-95"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-orange-50 border border-orange-100 hover:bg-[#FF8A00] hover:text-white text-[#FF8A00] p-2 transition active:scale-95 flex items-center justify-center"
                title="Logout"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </aside>

          {/* Right Side: Standalone Tabbed Form Card */}
          <form onSubmit={handleSubmit} className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
              
              {message && (
                <div className={`rounded-xl border p-4 shadow-sm animate-in fade-in duration-200 ${message.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${message.type === "success" ? "text-emerald-500" : "text-rose-500"}`} />
                    <p className="text-xs font-bold">{message.text}</p>
                  </div>
                </div>
              )}

              {/* IDENTITY TAB */}
              {activeTab === "identity" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Identity & Contact</h3>
                    <p className="text-xs text-slate-400">Configure your key identifying attributes and information.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Full Name" icon={User}>
                      <TextInput name="full_name" value={profile?.full_name || ""} onChange={handleInputChange} placeholder="Full Name" />
                    </Field>
                    <Field label="Phone Number" icon={Users}>
                      <TextInput type="tel" name="phone_number" value={profile?.phone_number || ""} onChange={handleInputChange} placeholder="+1 (555) 000-0000" />
                    </Field>
                    <Field label="Location" icon={MapPin}>
                      <TextInput name="location" value={profile?.location || ""} onChange={handleInputChange} placeholder="e.g. New York, USA" />
                    </Field>
                    <Field label="Birthdate" icon={Calendar}>
                      <TextInput
                        type="date"
                        name="birthdate"
                        value={profile?.birthdate ? profile.birthdate.split("T")[0] : ""}
                        onChange={handleInputChange}
                      />
                    </Field>
                    <Field label="Gender" icon={Users}>
                      <SelectInput
                        name="gender"
                        value={profile?.gender || ""}
                        onChange={handleInputChange}
                        options={["", "male", "female", "other", "prefer_not_to_say"]}
                        labels={["Select Gender", "Male", "Female", "Other", "Prefer Not to Say"]}
                      />
                    </Field>
                    <Field label="Employment Status" icon={Briefcase}>
                      <SelectInput
                        name="current_employment_status"
                        value={profile?.current_employment_status || ""}
                        onChange={handleInputChange}
                        options={["", "Employed", "Unemployed", "Student"]}
                        labels={["Select Status", "Currently Employed", "Unemployed", "Student"]}
                      />
                    </Field>
                    <Field label="Referral Source" icon={Share2}>
                      <TextInput name="referral" value={profile?.referral || ""} onChange={handleInputChange} placeholder="e.g. LinkedIn, Friend" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Professional Pitch / Biography" icon={FileText}>
                        <textarea
                          rows={4}
                          name="bio"
                          value={profile?.bio || ""}
                          onChange={handleInputChange}
                          placeholder="Briefly describe your professional journey..."
                          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:bg-white"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* CAREER TAB */}
              {activeTab === "career" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Career & Alignment</h3>
                    <p className="text-xs text-slate-400">Position your experience level, targets, and goals for recruiter discovery.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Current Role" icon={Briefcase}>
                      <TextInput name="current_role" value={profile?.current_role || ""} onChange={handleInputChange} placeholder="e.g. Senior Software Engineer" />
                    </Field>
                    <Field label="Target Role" icon={Target}>
                      <TextInput name="target_role" value={profile?.target_role || ""} onChange={handleInputChange} placeholder="e.g. Senior Product Manager" />
                    </Field>
                    <Field label="Experience level" icon={Target}>
                      {experienceControl}
                    </Field>
                    <Field label="Years of Experience" icon={Calendar}>
                      {yearsControl}
                    </Field>
                    <Field label="Job Preference" icon={Globe}>
                      <SelectInput
                        name="job_type"
                        value={profile?.job_type || "onsite"}
                        onChange={handleInputChange}
                        options={["onsite", "remote", "hybrid"]}
                        labels={["On-Site", "Remote", "Hybrid"]}
                      />
                    </Field>
                    <Field label="Expected Salary ($)" icon={Coins}>
                      <TextInput
                        type="number"
                        name="expected_salary"
                        value={profile?.expected_salary || ""}
                        onChange={handleInputChange}
                        placeholder="e.g. 100000"
                      />
                    </Field>
                    <Field label="Primary Industry Focus" icon={Tag}>
                      <TextInput name="primary_industry_focus" value={profile?.primary_industry_focus || ""} onChange={handleInputChange} placeholder="e.g. Fintech, E-commerce" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Long-term Career Goal" icon={Target}>
                        <textarea
                          rows={2}
                          name="long_term_goal"
                          value={profile?.long_term_goal || ""}
                          onChange={handleInputChange}
                          placeholder="e.g. Lead a global sales intelligence team at an enterprise level"
                          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:bg-white"
                        />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Key Responsibilities" icon={FileText}>
                        <textarea
                          rows={3}
                          name="key_responsibilities"
                          value={profile?.key_responsibilities || ""}
                          onChange={handleInputChange}
                          placeholder="Detail your primary professional responsibilities..."
                          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:bg-white"
                        />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Major Achievements" icon={CheckCircle2}>
                        <textarea
                          rows={3}
                          name="major_achievements"
                          value={profile?.major_achievements || ""}
                          onChange={handleInputChange}
                          placeholder="Highlight your top career accomplishments and milestones..."
                          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:bg-white"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* EXPERIENCE & EDUCATION TAB */}
              {activeTab === "experience" && (
                <div className="space-y-6">
                  
                  {/* AI Work Gap Report Alert */}
                  {profile?.career_gap_report && (profile.career_gap_report.has_gap_exceeding_6mo || profile.career_gap_report.has_gap_exceeding_12mo) && (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 flex gap-3 items-start animate-in fade-in duration-200">
                      <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">AI Work Gaps Audit</h4>
                        <p className="text-xs text-amber-850">
                          {profile.career_gap_report.has_gap_exceeding_12mo 
                            ? "A gap of more than 12 months was detected in your career history." 
                            : "A gap of more than 6 months was detected in your career history."} ({profile.career_gap_report.total_gap_months || 0} months total).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Experience list */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Experience History</h3>
                      <button
                        type="button"
                        onClick={() => addHistoryItem("experience_history")}
                        className="flex items-center gap-1 text-[10px] font-black uppercase text-[#FF8A00] hover:text-[#E67A00]"
                      >
                        <PlusCircle className="h-3.5 w-3.5" /> Add Experience
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {(profile?.experience_history || []).map((exp, index) => (
                        <div key={index} className="group relative rounded-2xl border border-slate-200 bg-slate-50/30 p-5 transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50">
                          <button
                            type="button"
                            onClick={() => removeHistoryItem("experience_history", index)}
                            className="absolute right-4 top-4 text-slate-350 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <Field label="Role Title" icon={User}>
                              <TextInput value={exp.role || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "role", e.target.value)} placeholder="e.g. Account Executive" />
                            </Field>
                            <Field label="Company" icon={Globe}>
                              <TextInput value={exp.company || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "company", e.target.value)} placeholder="e.g. Acme Corp" />
                            </Field>
                            <Field label="Location" icon={MapPin}>
                              <TextInput value={exp.location || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "location", e.target.value)} placeholder="City, State / Remote" />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Start Month/Year" icon={Calendar}>
                                <TextInput value={exp.start_date || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "start_date", e.target.value)} placeholder="MM/YYYY" />
                              </Field>
                              <Field label="End Month/Year" icon={Calendar}>
                                <TextInput value={exp.end_date || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "end_date", e.target.value)} placeholder="MM/YYYY or Present" />
                              </Field>
                            </div>
                          </div>

                          <div className="mt-4 border-t border-slate-100 pt-3">
                            <div className="mb-2 flex items-center justify-between">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Key Achievements</label>
                              <button
                                type="button"
                                onClick={() => handleArrayInputChange("experience_history", index, "descriptions", [...(exp.descriptions || []), ""])}
                                className="flex items-center gap-1 text-[9px] font-black uppercase text-[#FF8A00] hover:text-[#E67A00]"
                              >
                                <PlusCircle className="h-3 w-3" /> Add achievement
                              </button>
                            </div>
                            <div className="space-y-2">
                              {(exp.descriptions || []).map((desc, dIdx) => (
                                <div key={dIdx} className="group/desc relative">
                                  <textarea
                                    value={desc}
                                    onChange={(e) => {
                                      const next = [...(exp.descriptions || [])];
                                      next[dIdx] = e.target.value;
                                      handleArrayInputChange("experience_history", index, "descriptions", next);
                                    }}
                                    rows={2}
                                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-8 text-xs font-semibold text-slate-600 outline-none focus:border-[#FF8A00] focus:ring-1 focus:ring-[#FF8A00]/25"
                                    placeholder="Describe impact, quotas hit, or metrics improved..."
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = [...(exp.descriptions || [])];
                                      next.splice(dIdx, 1);
                                      handleArrayInputChange("experience_history", index, "descriptions", next);
                                    }}
                                    className="absolute right-2.5 top-2.5 opacity-0 group-hover/desc:opacity-100 hover:text-rose-500 transition-opacity text-slate-350"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Education list */}
                  <div className="space-y-4 border-t border-slate-100 pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Academic History</h3>
                      <button
                        type="button"
                        onClick={() => addHistoryItem("education_history")}
                        className="flex items-center gap-1 text-[10px] font-black uppercase text-[#FF8A00] hover:text-[#E67A00]"
                      >
                        <PlusCircle className="h-3.5 w-3.5" /> Add Education
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(profile?.education_history || []).map((edu, index) => (
                        <div key={index} className="group relative rounded-2xl border border-slate-200 bg-slate-50/30 p-5 transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50">
                          <button
                            type="button"
                            onClick={() => removeHistoryItem("education_history", index)}
                            className="absolute right-4 top-4 text-slate-350 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Institution Name" icon={Globe}>
                              <TextInput value={edu.institution || ""} onChange={(e) => handleArrayInputChange("education_history", index, "institution", e.target.value)} placeholder="e.g. Harvard University" />
                            </Field>
                            <Field label="Degree" icon={GraduationCap}>
                              <TextInput value={edu.degree || ""} onChange={(e) => handleArrayInputChange("education_history", index, "degree", e.target.value)} placeholder="e.g. Bachelor of Science" />
                            </Field>
                            <Field label="Field of Study" icon={Target}>
                              <TextInput value={edu.field || ""} onChange={(e) => handleArrayInputChange("education_history", index, "field", e.target.value)} placeholder="e.g. Computer Science" />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Start Year" icon={Calendar}>
                                <TextInput value={edu.start_date || ""} onChange={(e) => handleArrayInputChange("education_history", index, "start_date", e.target.value)} placeholder="YYYY" />
                              </Field>
                              <Field label="End Year" icon={Calendar}>
                                <TextInput value={edu.end_date || ""} onChange={(e) => handleArrayInputChange("education_history", index, "end_date", e.target.value)} placeholder="YYYY" />
                              </Field>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PRESENCE & INTERESTS TAB */}
              {activeTab === "presence" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Presence, Interests & Actions</h3>
                    <p className="text-xs text-slate-400">Configure your digital representation and manage account status.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="LinkedIn Profile URL" icon={Linkedin}>
                      <TextInput
                        type="url"
                        name="linkedin_url"
                        value={profile?.linkedin_url || ""}
                        onChange={handleInputChange}
                        placeholder="https://linkedin.com/in/username"
                      />
                    </Field>
                    <Field label="Portfolio / Personal Website" icon={Globe}>
                      <TextInput
                        type="url"
                        name="portfolio_url"
                        value={profile?.portfolio_url || ""}
                        onChange={handleInputChange}
                        placeholder="https://yourportfolio.com"
                      />
                    </Field>
                    <Field label="Location Tier / Availability Scope" icon={MapPin}>
                      <SelectInput
                        name="location_tier"
                        value={profile?.location_tier || "Tier 1"}
                        onChange={handleInputChange}
                        options={["Tier 1", "Tier 2", "Tier 3", "Remote", "International"]}
                        labels={["Tier 1 (Major Metros)", "Tier 2 (Secondary Cities)", "Tier 3 (Regional Hubs)", "Remote Only", "International Roles"]}
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Career Interests (comma separated)" icon={Tag}>
                        <TextInput
                          value={getArrayAsString(profile?.career_interests)}
                          onChange={(e) => handleCommaSeparatedChange("career_interests", e.target.value)}
                          placeholder="e.g. Enterprise Sales, Account Executive, Sales Strategy"
                        />
                      </Field>
                    </div>
                    <div className="md:col-span-2">
                      <Field label="Learning Interests (comma separated)" icon={GraduationCap}>
                        <TextInput
                          value={getArrayAsString(profile?.learning_interests)}
                          onChange={(e) => handleCommaSeparatedChange("learning_interests", e.target.value)}
                          placeholder="e.g. Negotiation Strategy, Cloud Architecture, AI applications"
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Reset Assessment Action Panel */}
                  <div className="border-t border-slate-100 pt-6 mt-6">
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-1">Reset Profile Evaluation</h4>
                        <p className="text-xs text-slate-500">Resetting will permanently delete your assessment scores, insights, and benchmarks.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRetakeAssessment}
                        className="rounded-xl border border-rose-200 bg-white hover:bg-rose-500 hover:text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600 transition"
                      >
                        Reset Evaluation
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Actions Sticky Panel */}
            <div className="border-t border-slate-150 bg-white/95 px-6 py-4 flex items-center justify-between gap-4 rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => router.push("/dashboard/candidate")}
                className="rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#FF8A00] px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#E67A00] shadow-md shadow-orange-600/10 active:scale-95 disabled:opacity-70"
              >
                {saving ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {saving ? "Saving Changes" : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex flex-col group">
      <label className="mb-2 ml-1 flex items-center text-[9px] font-black uppercase tracking-widest text-slate-400 group-focus-within:text-[#FF8A00] transition-colors">
        <Icon className="mr-1.5 h-3.5 w-3.5 opacity-60" />
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:bg-white ${className}`}
    />
  );
}

function SelectInput({
  options,
  labels,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[]; labels: string[] }) {
  return (
    <select
      {...props}
      className={`w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] ${className}`}
    >
      {options.map((option, index) => (
        <option key={option} value={option}>
          {labels[index]}
        </option>
      ))}
    </select>
  );
}

function LockedValue({ value }: { value: string }) {
  return (
    <div className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-750">
      <span>{value}</span>
      <ShieldCheck className="h-4 w-4 text-slate-450" />
    </div>
  );
}