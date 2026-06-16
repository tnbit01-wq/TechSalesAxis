"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  Globe,
  Linkedin,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Target,
  User,
  Tag,
  Coins,
  Camera,
  LogOut,
  Award,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";

interface Company {
  id?: string;
  name?: string;
  website?: string;
  location?: string;
  description?: string;
  domain?: string;
  industry_category?: string;
  sales_model?: string;
  avg_deal_size_range?: string;
  hiring_focus_areas?: string[];
  profile_score?: number;
}

interface RecruiterProfile {
  full_name?: string;
  job_title?: string;
  linkedin_url?: string;
  bio?: string;
  company_id?: string;
  companies?: Company;
  identity_verified?: boolean;
  assessment_status?: string;
  completion_score?: number;
  team_role?: string;
  department?: string;
  location?: string;
  credits?: number;
  profile_photo_url?: string;
  professional_persona?: {
    focus_areas?: string[];
    years_experience?: number;
    preferred_hiring_style?: string;
    languages?: string[];
  };
}

const emptyCompany: Company = {
  name: "",
  website: "",
  location: "",
  description: "",
  domain: "",
  industry_category: "",
  sales_model: "",
  avg_deal_size_range: "",
  hiring_focus_areas: [],
};

const emptyPersona = {
  focus_areas: [] as string[],
  years_experience: 0,
  preferred_hiring_style: "",
  languages: [] as string[],
};

type ActiveTab = "identity" | "persona" | "company";

export default function RecruiterProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("identity");

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const data = await apiClient.get("/recruiter/profile", token);
        setProfile(data);
      } catch (error) {
        console.error("Failed to load recruiter profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const updateProfile = (patch: Partial<RecruiterProfile>) => {
    setProfile((current) => (current ? { ...current, ...patch } : current));
  };

  const updateCompany = (patch: Partial<Company>) => {
    setProfile((current) => {
      if (!current) return current;
      return {
        ...current,
        companies: {
          ...(current.companies || emptyCompany),
          ...patch,
        },
      };
    });
  };

  const updatePersona = (patch: Partial<NonNullable<RecruiterProfile["professional_persona"]>>) => {
    setProfile((current) => {
      if (!current) return current;
      return {
        ...current,
        professional_persona: {
          ...(current.professional_persona || emptyPersona),
          ...patch,
        },
      };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("No session found");

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiClient.post("/storage/upload/profile-photo", formData, token);
      const publicUrl = data.url;

      setProfile((prev) => (prev ? { ...prev, profile_photo_url: publicUrl } : null));
      await apiClient.patch("/recruiter/profile", { profile_photo_url: publicUrl }, token);
      toast.success("Profile photo updated.");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSuggestBio = async () => {
    const website = profile?.companies?.website;
    if (!website) {
      toast.error("Add a website first to generate a bio.");
      return;
    }

    setGeneratingBio(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const response = await apiClient.post("/recruiter/generate-bio", { website }, token);
      if (response.bio) {
        updateCompany({ description: response.bio });
        toast.success("Bio suggested from your website.");
      }
    } catch (error) {
      console.error("Bio generation failed:", error);
      toast.error("Failed to generate bio.");
    } finally {
      setGeneratingBio(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const token = awsAuth.getToken() || undefined;
      
      // 1. Prepare profile update body
      const profileBody = {
        full_name: profile?.full_name,
        job_title: profile?.job_title,
        linkedin_url: profile?.linkedin_url,
        bio: profile?.bio,
        team_role: profile?.team_role,
        department: profile?.department,
        location: profile?.location,
        professional_persona: profile?.professional_persona,
      };

      // 2. Prepare company update body if company exists
      const companyPromises = [];
      if (profile?.companies) {
        const companyBody = {
          name: profile.companies.name,
          website: profile.companies.website,
          location: profile.companies.location,
          description: profile.companies.description,
          industry_category: profile.companies.industry_category,
          sales_model: profile.companies.sales_model,
          avg_deal_size_range: profile.companies.avg_deal_size_range,
        };
        companyPromises.push(apiClient.patch("/recruiter/company", companyBody, token));
      }

      // 3. Execute updates concurrently
      const [profileResult] = await Promise.all([
        apiClient.patch("/recruiter/profile", profileBody, token),
        ...companyPromises
      ]);

      if (profileResult?.completion_score !== undefined) {
        setProfile((current) => (current ? { ...current, completion_score: profileResult.completion_score } : current));
      }
      
      toast.success("Profile updated successfully.");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save recruiter profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    awsAuth.logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00]" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-6 md:px-8 py-5 h-auto lg:h-[calc(100vh-64px)] flex flex-col lg:flex-row gap-6 overflow-hidden bg-[#FAFBFC]">
        
        {/* SIDEBAR */}
        <aside className="w-full lg:w-[300px] xl:w-[320px] flex-shrink-0 bg-white border border-slate-200/80 rounded-[24px] p-5.5 shadow-sm flex flex-col gap-5 h-auto lg:h-full overflow-y-auto">
          <div className="space-y-4">
            
            {/* Completion Ring Around Avatar Photo */}
            <div className="flex flex-col items-center text-center">
              <div className="relative flex flex-col items-center justify-center select-none">
                <div className="relative h-24 w-24 flex items-center justify-center">
                  {/* SVG Completion Ring */}
                  <svg className="absolute inset-0 h-full w-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      className="stroke-slate-100"
                      strokeWidth="3.5"
                      fill="transparent"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="42"
                      className="stroke-emerald-500 transition-all duration-500 ease-out"
                      strokeWidth="3.5"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 42}
                      strokeDashoffset={2 * Math.PI * 42 - ((profile?.completion_score || 0) / 100) * (2 * Math.PI * 42)}
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Avatar Container */}
                  <div 
                    className="relative h-18 w-18 rounded-full overflow-hidden border border-slate-100 bg-[#FFF6ED] flex items-center justify-center cursor-pointer shadow-sm group/avatar"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {profile?.profile_photo_url ? (
                      <img src={profile.profile_photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-8 w-8 text-[#FF8A00]" />
                    )}
                    
                    {/* Hover Upload Overlay */}
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                      <Camera className="h-4 w-4" />
                      <span className="text-[7.5px] font-bold uppercase mt-0.5">Update</span>
                    </div>

                    {uploading && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF8A00] border-t-transparent" />
                      </div>
                    )}
                  </div>

                  {/* Percentage Badge */}
                  <span className="absolute bottom-0.5 right-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 border-2 border-white shadow-sm">
                    {profile?.completion_score || 0}%
                  </span>
                </div>

                {/* Complete Now Action */}
                {(profile?.completion_score || 0) < 100 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("identity");
                      toast.info("Please fill out your identity and workspace details.");
                    }}
                    className="mt-2.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 hover:bg-[#FF8A00] hover:text-white transition-all text-[9px] font-black uppercase tracking-wider text-[#FF8A00] flex items-center justify-center gap-1.5 group/link"
                  >
                    Complete Now <ChevronRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
                  </button>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />

              <h2 className="mt-3 text-base font-black text-slate-900 leading-snug flex items-center justify-center gap-1.5">
                {profile?.full_name || "Recruiter"}
                {profile?.identity_verified ? (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/recruiter/account/settings?tab=security")}
                    className="flex shrink-0 items-center justify-center h-6 w-6 rounded-full bg-emerald-50 border border-emerald-100 hover:scale-105 active:scale-95 transition-all duration-150"
                    title="Verified Partner - Click to view verification settings"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 fill-emerald-50" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/recruiter/account/settings?tab=security")}
                    className="flex shrink-0 items-center justify-center h-6 w-6 rounded-full bg-rose-50 border border-rose-100 hover:scale-105 active:scale-95 transition-all duration-150"
                    title="Unverified Profile - Click to complete verification"
                  >
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-600 fill-rose-50" />
                  </button>
                )}
              </h2>
              <p className="text-[11.5px] text-slate-400 font-semibold">{profile?.job_title || "Talent Acquisition"}</p>
              
              {profile?.department && (
                <div className="mt-1.5 flex justify-center">
                  <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-150 px-2.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                    {profile.department}
                  </span>
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1 pt-2 border-t border-slate-100">
              <TabButton active={activeTab === "identity"} onClick={() => setActiveTab("identity")} icon={User} label="Identity & Workspace" />
              <TabButton active={activeTab === "persona"} onClick={() => setActiveTab("persona")} icon={Target} label="Professional Pitch" />
              <TabButton active={activeTab === "company"} onClick={() => setActiveTab("company")} icon={Building2} label="Company Details" />
            </nav>

          </div>
        </aside>

        {/* WORKSPACE PANEL */}
        <div className="flex-1 bg-white border border-slate-200/80 rounded-[24px] shadow-sm flex flex-col h-auto lg:h-full overflow-hidden">
          
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FF8A00]">
                {activeTab === "identity" ? "Personal Details" : activeTab === "persona" ? "Persona & Style" : "Enterprise Hub"}
              </p>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                {activeTab === "identity" ? "Identity & Workspace" : activeTab === "persona" ? "Professional Pitch" : "Company Profile"}
              </h1>
            </div>
            {activeTab === "company" && (
              <button
                type="button"
                onClick={handleSuggestBio}
                disabled={generatingBio}
                className="flex items-center gap-1.5 rounded-xl border border-orange-100 bg-[#FFF5E8] px-3.5 py-2 text-xs font-bold text-[#FF8A00] transition-all hover:bg-[#FF8A00] hover:text-white disabled:opacity-50"
              >
                {generatingBio ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#FF8A00] border-t-transparent" /> : <Sparkles className="h-3.5 w-3.5" />}
                AI Suggest Bio
              </button>
            )}
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden justify-between">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* IDENTITY TAB */}
              {activeTab === "identity" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <FormInput label="Full Name" icon={User} value={profile?.full_name || ""} onChange={(v) => updateProfile({ full_name: v })} placeholder="e.g. John Doe" />
                  <FormInput label="Job Title" icon={Briefcase} value={profile?.job_title || ""} onChange={(v) => updateProfile({ job_title: v })} placeholder="e.g. Head of Talent Acquisition" />
                  <FormInput label="Department" icon={Tag} value={profile?.department || ""} onChange={(v) => updateProfile({ department: v })} placeholder="e.g. Engineering Recruiting, Sales HR" />
                  <FormInput label="Workspace Location" icon={MapPin} value={profile?.location || ""} onChange={(v) => updateProfile({ location: v })} placeholder="e.g. London, UK (Hybrid)" />
                  <FormInput label="LinkedIn Profile" icon={Linkedin} value={profile?.linkedin_url || ""} onChange={(v) => updateProfile({ linkedin_url: v })} placeholder="linkedin.com/in/username" />
                  <FormInput label="Team Access Role" icon={ShieldCheck} value={profile?.team_role || ""} onChange={(v) => updateProfile({ team_role: v })} placeholder="Hiring manager, Admin, Coordinator" />
                </div>
              )}

              {/* PERSONA TAB */}
              {activeTab === "persona" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput label="Years Recruiting" icon={Briefcase} type="number" value={profile?.professional_persona?.years_experience || 0} onChange={(v) => updatePersona({ years_experience: parseInt(v) || 0 })} />
                    <FormSelect label="Preferred Hiring Style" icon={Target} value={profile?.professional_persona?.preferred_hiring_style || ""} onChange={(v) => updatePersona({ preferred_hiring_style: v })} options={["", "consultative", "directive", "collaborative"]} labels={["Select Style", "Consultative", "Directive", "Collaborative"]} />
                  </div>
                  <FormInput label="Focus Areas" icon={Tag} value={profile?.professional_persona?.focus_areas?.join(", ") || ""} onChange={(v) => updatePersona({ focus_areas: v.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="e.g. Sales leadership, SDRs, enterprise sellers" />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                      <FileText className="h-3.5 w-3.5" />
                      Professional Pitch
                    </label>
                    <textarea
                      rows={5}
                      value={profile?.bio || ""}
                      onChange={(e) => updateProfile({ bio: e.target.value })}
                      placeholder="Brief professional intro..."
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/30 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/10"
                    />
                  </div>
                </div>
              )}

              {/* COMPANY TAB */}
              {activeTab === "company" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="max-w-md">
                    <CircularScore score={profile?.companies?.profile_score ?? 75} label="Organization Score" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput label="Company Name" icon={Building2} value={profile?.companies?.name || ""} onChange={(v) => updateCompany({ name: v })} />
                    <FormInput label="Official Website" icon={Globe} value={profile?.companies?.website || ""} onChange={(v) => updateCompany({ website: v })} placeholder="https://company.com" />
                    <FormInput label="Headquarters" icon={MapPin} value={profile?.companies?.location || ""} onChange={(v) => updateCompany({ location: v })} placeholder="City, Country" />
                    <FormInput label="Industry / Domain" icon={Tag} value={profile?.companies?.industry_category || ""} onChange={(v) => updateCompany({ industry_category: v })} placeholder="Fintech, SaaS, HealthTech" />
                    <FormSelect label="Core Sales Model" icon={Target} value={profile?.companies?.sales_model || ""} onChange={(v) => updateCompany({ sales_model: v })} options={["", "Inbound", "Outbound", "Hybrid"]} labels={["Select Model", "Inbound Intelligence", "Outbound Strategy", "Hybrid Ecosystem"]} />
                    <FormSelect label="Avg. Deal Size" icon={DollarSign} value={profile?.companies?.avg_deal_size_range || ""} onChange={(v) => updateCompany({ avg_deal_size_range: v })} options={["", "under_10k", "10k_50k", "50k_150k", "150k_plus"]} labels={["Range Configuration", "Under $10k", "$10k - $50k", "$50k - $150k", "$150k Enterprise"]} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
                      <FileText className="h-3.5 w-3.5" />
                      Company Mission & Pitch
                    </label>
                    <textarea
                      rows={4}
                      value={profile?.companies?.description || ""}
                      onChange={(e) => updateCompany({ description: e.target.value })}
                      placeholder="What makes your company a great place for sales talent?"
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/30 px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/10"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => router.push("/dashboard/recruiter")}
                className="rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-[#FF8A00] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-all hover:bg-[#E67A00] disabled:opacity-70 active:scale-98 shadow-sm shadow-orange-100"
              >
                {saving ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>

        </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-xs transition-all ${
        active
          ? "bg-[#FF8A00] text-white shadow-md shadow-orange-100"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${active ? "translate-x-0.5" : "text-slate-300"}`} />
    </button>
  );
}

function MetricBox({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-[#FAFBFC] p-3 flex flex-col items-center justify-center text-center">
      <Icon className="h-4 w-4 text-[#FF8A00] mb-1.5" />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className="mt-1.5 text-xs font-black text-slate-800">{value}</span>
    </div>
  );
}

function FormInput({ label, icon: Icon, value, onChange, placeholder, type = "text" }: { label: string; icon: any; value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50/30 px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/10"
      />
    </div>
  );
}

function FormSelect({ label, icon: Icon, value, onChange, options, labels }: { label: string; icon: any; value: string; onChange: (v: string) => void; options: string[]; labels: string[] }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/10"
        >
          {options.map((option, index) => (
            <option key={option} value={option}>
              {labels[index]}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
      </div>
    </div>
  );
}

function CircularScore({ score, label }: { score: number; label: string }) {
  const radius = 28;
  const strokeWidth = 4.5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex items-center gap-3.5 bg-slate-50/60 border border-slate-150 rounded-2xl p-3 shadow-sm relative overflow-hidden group/score text-left select-none">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/10 to-emerald-50/20 opacity-0 group-hover/score:opacity-100 transition-opacity duration-300" />
      
      {/* SVG Ring */}
      <div className="relative h-15 w-15 flex-shrink-0 flex items-center justify-center">
        <svg className="h-full w-full transform -rotate-90">
          <circle
            cx="30"
            cy="30"
            r={radius}
            className="stroke-slate-200"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx="30"
            cy="30"
            r={radius}
            className="stroke-emerald-500 transition-all duration-500 ease-out"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[12.5px] font-black text-slate-800 leading-none">{score}</span>
          <span className="text-[7.5px] font-bold text-slate-400 uppercase mt-0.5">Score</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-[11.5px] font-bold text-slate-800 leading-snug">{label}</h4>
        <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">Based on organization verification & profile data.</p>
      </div>
    </div>
  );
}
