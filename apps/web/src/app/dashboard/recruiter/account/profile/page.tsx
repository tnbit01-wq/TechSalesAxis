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
  Target,
  User,
  Tag,
  Phone,
  Users,
  ShieldAlert,
  Sparkles,
  LogOut,
  Camera,
  FolderDot,
  Coins
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import ProfileCompletionCircle from "@/components/ProfileCompletionCircle";

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
  logo_url?: string | null;
  size_band?: string | null;
  registration_number?: string | null;
  target_market?: string | null;
  visibility_tier?: string;
  profile_score?: number;
}

interface RecruiterProfile {
  full_name?: string;
  job_title?: string;
  linkedin_url?: string;
  bio?: string;
  phone_number?: string;
  company_id?: string;
  companies?: Company;
  identity_verified?: boolean;
  assessment_status?: string;
  completion_score?: number;
  team_role?: string;
  professional_persona?: {
    profile_photo_url?: string;
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
  logo_url: null,
  size_band: "",
  registration_number: "",
  target_market: "",
};

const emptyPersona = {
  profile_photo_url: "",
  focus_areas: [] as string[],
  years_experience: 0,
  preferred_hiring_style: "",
  languages: [] as string[],
};

export default function RecruiterProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [activeTab, setActiveTab] = useState<"identity" | "company" | "style">("identity");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

    setUploadingPhoto(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("No session found");

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiClient.post("/storage/upload/profile-photo", formData, token);
      const publicUrl = data.url || data.path;

      updatePersona({ profile_photo_url: publicUrl });
      setMessage({ type: "success", text: "Profile photo uploaded. Click Save to apply." });
    } catch (error: any) {
      console.error("Upload error:", error);
      setMessage({ type: "error", text: error.message || "Failed to upload photo" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("No session found");

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiClient.post("/storage/upload/branding?category=logo", formData, token);
      const publicUrl = data.url || data.path;

      updateCompany({ logo_url: publicUrl });
      setMessage({ type: "success", text: "Company logo uploaded. Click Save to apply." });
    } catch (error: any) {
      console.error("Upload logo error:", error);
      setMessage({ type: "error", text: error.message || "Failed to upload logo" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSuggestBio = async () => {
    const website = profile?.companies?.website;
    if (!website) {
      setMessage({ type: "error", text: "Add a website first to generate a bio." });
      return;
    }

    setGeneratingBio(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const response = await apiClient.post("/recruiter/generate-bio", { website }, token);
      if (response.bio) {
        updateCompany({ description: response.bio });
        setMessage({ type: "success", text: "Bio suggested from your website." });
      }
    } catch (error) {
      console.error("Bio generation failed:", error);
      setMessage({ type: "error", text: "Failed to generate bio." });
    } finally {
      setGeneratingBio(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken() || undefined;

      // Extract Recruiter profile fields to update
      const recruiterPayload = {
        full_name: profile?.full_name,
        phone_number: profile?.phone_number,
        job_title: profile?.job_title,
        linkedin_url: profile?.linkedin_url,
        bio: profile?.bio,
        team_role: profile?.team_role,
        professional_persona: profile?.professional_persona,
      };

      // Extract Company fields to update
      const companyPayload = {
        name: profile?.companies?.name,
        website: profile?.companies?.website,
        location: profile?.companies?.location,
        description: profile?.companies?.description,
        industry_category: profile?.companies?.industry_category,
        sales_model: profile?.companies?.sales_model,
        avg_deal_size_range: profile?.companies?.avg_deal_size_range,
        hiring_focus_areas: profile?.companies?.hiring_focus_areas || [],
        logo_url: profile?.companies?.logo_url,
        size_band: profile?.companies?.size_band,
        registration_number: profile?.companies?.registration_number,
        target_market: profile?.companies?.target_market,
        domain: profile?.companies?.domain,
      };

      // Patch both in parallel
      const [recruiterRes] = await Promise.all([
        apiClient.patch("/recruiter/profile", recruiterPayload, token),
        apiClient.patch("/recruiter/company", companyPayload, token)
      ]);

      if (recruiterRes?.completion_score !== undefined) {
        updateProfile({ completion_score: recruiterRes.completion_score });
      }

      setMessage({ type: "success", text: "Profile & company data updated successfully." });
    } catch (error: any) {
      console.error("Save error:", error);
      setMessage({ type: "error", text: error.message || "Failed to save profile details." });
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteNow = () => {
    // Premium flow: find the first missing field and set active tab / focus
    if (!profile?.full_name || !profile?.phone_number || !profile?.job_title) {
      setActiveTab("identity");
      setMessage({ type: "success", text: "Please complete your Identity information." });
    } else if (!profile?.companies?.name || !profile?.companies?.website || !profile?.companies?.location) {
      setActiveTab("company");
      setMessage({ type: "success", text: "Please complete your Company Profile details." });
    } else {
      setActiveTab("style");
      setMessage({ type: "success", text: "Please complete your Recruiting Persona info." });
    }
  };

  const handleLogout = () => {
    awsAuth.logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#FF8A00]" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  const isVerified = profile?.identity_verified || false;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50/30 overflow-hidden font-sans">
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 min-h-0">
        
        {/* Left Side: Dynamic Sidebar with Completion Widget */}
        <aside className="w-full md:w-80 shrink-0 flex flex-col gap-6">
          
          {/* Completion Widget & Name Card */}
          <div className="rounded-3xl border border-orange-100/70 bg-white p-6 shadow-[0_8px_30px_rgba(255,138,0,0.04)] flex flex-col items-center text-center">
            
            {/* Widget */}
            <ProfileCompletionCircle
              percentage={profile?.completion_score || 0}
              photoUrl={profile?.professional_persona?.profile_photo_url}
              name={profile?.full_name}
              size={110}
              uploading={uploadingPhoto}
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

            <div className="mt-4 flex items-center justify-center gap-1.5 max-w-full">
              <h2 className="text-lg font-black text-slate-800 truncate">
                {profile?.full_name || "Recruiter Profile"}
              </h2>
              <button
                type="button"
                onClick={() => router.push("/dashboard/recruiter/account/settings?tab=security")}
                className={`transition-all duration-200 hover:scale-110 active:scale-95 shrink-0 ${
                  isVerified ? "text-emerald-500 hover:text-emerald-650" : "text-rose-500 hover:text-rose-650 animate-pulse"
                }`}
                title={isVerified ? "Verified Status Badge" : "Unverified. Click to verify."}
              >
                {isVerified ? (
                  <ShieldCheck className="h-4.5 w-4.5" />
                ) : (
                  <ShieldAlert className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 font-semibold tracking-wide truncate max-w-full uppercase mt-0.5">
              {profile?.job_title || "Talent Consultant"}
            </p>

            <div className="mt-6 w-full border-t border-slate-100 pt-4 space-y-2 text-left">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400">Team Role:</span>
                <span className="text-slate-700 truncate max-w-[150px]">{profile?.team_role || "Recruiter"}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-400">Status:</span>
                <span className="text-slate-700 capitalize">{profile?.assessment_status?.replace("_", " ") || "In progress"}</span>
              </div>
            </div>

            {/* Navigation Tabs List (Vertical) */}
            <nav className="mt-6 w-full flex-1 space-y-1">
              {[
                { id: "identity", label: "Identity", icon: User },
                { id: "company", label: "Company Profile", icon: Building2 },
                { id: "style", label: "Recruiting Style", icon: Target },
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

            <div className="mt-6 flex w-full gap-2 shrink-0">
              <button
                type="button"
                onClick={() => router.push("/dashboard/recruiter")}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-white"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl bg-orange-50 border border-orange-100 hover:bg-[#FF8A00] hover:text-white text-[#FF8A00] p-2.5 transition active:scale-95 flex items-center justify-center"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Right Side: Tabbed Form Editor */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(255,138,0,0.03)] flex flex-col min-h-0">
          
          {/* Form Content Panel */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
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
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Recruiter Identity</h3>
                    <p className="text-xs text-slate-400">Configure your personal representative credentials visible to candidates.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Full Name" icon={User}>
                      <TextInput value={profile?.full_name || ""} onChange={(e) => updateProfile({ full_name: e.target.value })} placeholder="Full Name" />
                    </Field>
                    <Field label="Job Title" icon={Briefcase}>
                      <TextInput value={profile?.job_title || ""} onChange={(e) => updateProfile({ job_title: e.target.value })} placeholder="Talent Acquisition Partner" />
                    </Field>
                    <Field label="Phone Number" icon={Phone}>
                      <TextInput type="tel" value={profile?.phone_number || ""} onChange={(e) => updateProfile({ phone_number: e.target.value })} placeholder="+1 (555) 000-0000" />
                    </Field>
                    <Field label="LinkedIn Profile" icon={Linkedin}>
                      <TextInput value={profile?.linkedin_url || ""} onChange={(e) => updateProfile({ linkedin_url: e.target.value })} placeholder="linkedin.com/in/username" />
                    </Field>
                    <Field label="Team Role" icon={Users}>
                      <TextInput value={profile?.team_role || ""} onChange={(e) => updateProfile({ team_role: e.target.value })} placeholder="Hiring Manager, Recruiter" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Professional Pitch" icon={FileText}>
                        <textarea
                          rows={3}
                          value={profile?.bio || ""}
                          onChange={(e) => updateProfile({ bio: e.target.value })}
                          placeholder="Introduce yourself to candidates..."
                          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:bg-white"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "company" && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Company Profile</h3>
                        <p className="text-xs text-slate-400">Position your company branding to attract elite sales professionals.</p>
                      </div>

                      {profile?.companies?.profile_score !== undefined && (
                        <div className="flex items-center gap-2 bg-[#00D09C]/5 border border-[#00D09C]/10 rounded-2xl p-2 px-3 shrink-0">
                          <div className="relative h-8 w-8 flex items-center justify-center shrink-0">
                            <svg className="absolute transform -rotate-90" width="32" height="32" viewBox="0 0 32 32">
                              <circle cx="16" cy="16" r="13" className="stroke-slate-100 fill-transparent" strokeWidth="2.5" />
                              <circle cx="16" cy="16" r="13" className="stroke-[#00D09C] fill-transparent transition-all duration-500 ease-out" strokeWidth="2.5" strokeDasharray="81.68" strokeDashoffset={81.68 - (profile.companies.profile_score / 100) * 81.68} strokeLinecap="round" />
                            </svg>
                            <span className="text-[9px] font-black text-[#00D09C]">{profile.companies.profile_score}%</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black uppercase tracking-wider text-slate-400 block leading-none">Company Score</span>
                            <span className="text-[8px] font-black uppercase tracking-wider text-[#00D09C] block mt-0.5 leading-none">Strength</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Logo upload widget */}
                    <div className="flex items-center gap-3 bg-slate-50/60 p-2.5 rounded-2xl border border-slate-100 shrink-0">
                      <div className="relative h-12 w-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                        {profile?.companies?.logo_url ? (
                          <img src={profile.companies.logo_url} alt="Logo" className="h-full w-full object-contain" />
                        ) : (
                          <Building2 className="h-6 w-6 text-slate-300" />
                        )}
                        {uploadingLogo && (
                          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                            <div className="h-4 w-4 animate-spin rounded-full border border-[#FF8A00] border-t-transparent" />
                          </div>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="text-[9px] font-black uppercase tracking-widest text-[#FF8A00] hover:text-[#E67A00] block"
                        >
                          Upload Logo
                        </button>
                        <span className="text-[8px] text-slate-400 font-bold block mt-0.5">PNG, JPG up to 2MB</span>
                      </div>
                      <input
                        type="file"
                        ref={logoInputRef}
                        onChange={handleLogoUpload}
                        className="hidden"
                        accept="image/*"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Company Name" icon={Building2}>
                      <TextInput value={profile?.companies?.name || ""} onChange={(e) => updateCompany({ name: e.target.value })} placeholder="Acme Inc." />
                    </Field>
                    <Field label="Official Website" icon={Globe}>
                      <TextInput value={profile?.companies?.website || ""} onChange={(e) => updateCompany({ website: e.target.value })} placeholder="https://acme.com" />
                    </Field>
                    <Field label="Corporate HQ" icon={MapPin}>
                      <TextInput value={profile?.companies?.location || ""} onChange={(e) => updateCompany({ location: e.target.value })} placeholder="City, Country" />
                    </Field>
                    <Field label="Domain Name" icon={Globe}>
                      <TextInput value={profile?.companies?.domain || ""} onChange={(e) => updateCompany({ domain: e.target.value })} placeholder="acme.com" />
                    </Field>
                    <Field label="Industry / Vertical" icon={Tag}>
                      <TextInput value={profile?.companies?.industry_category || ""} onChange={(e) => updateCompany({ industry_category: e.target.value })} placeholder="Fintech, SaaS, AI" />
                    </Field>
                    <Field label="Company Size" icon={Users}>
                      <SelectInput
                        value={profile?.companies?.size_band || ""}
                        onChange={(e) => updateCompany({ size_band: e.target.value })}
                        options={["", "1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]}
                        labels={["Select Size Band", "1 - 10 Employees", "11 - 50 Employees", "51 - 200 Employees", "201 - 500 Employees", "501 - 1000 Employees", "1000+ Enterprises"]}
                      />
                    </Field>
                    <Field label="Core Sales Model" icon={Target}>
                      <SelectInput
                        value={profile?.companies?.sales_model || ""}
                        onChange={(e) => updateCompany({ sales_model: e.target.value })}
                        options={["", "Inbound", "Outbound", "Hybrid"]}
                        labels={["Select Model", "Inbound Intelligence", "Outbound Strategy", "Hybrid Ecosystem"]}
                      />
                    </Field>
                    <Field label="Avg. Deal Size" icon={Coins}>
                      <SelectInput
                        value={profile?.companies?.avg_deal_size_range || ""}
                        onChange={(e) => updateCompany({ avg_deal_size_range: e.target.value })}
                        options={["", "under_10k", "10k_50k", "50k_150k", "150k_plus"]}
                        labels={["Range Configuration", "Under $10k", "$10k - $50k", "$50k - $150k", "$150k+ Enterprise"]}
                      />
                    </Field>
                    <Field label="Registration Number" icon={ShieldCheck}>
                      <TextInput value={profile?.companies?.registration_number || ""} onChange={(e) => updateCompany({ registration_number: e.target.value })} placeholder="Reg. number / EIN" />
                    </Field>
                    <Field label="Target Market Segment" icon={Target}>
                      <TextInput value={profile?.companies?.target_market || ""} onChange={(e) => updateCompany({ target_market: e.target.value })} placeholder="SMB, Mid-Market, Enterprise" />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Company Pitch & Mission" icon={FileText}>
                        <div className="relative">
                          <textarea
                            rows={3}
                            value={profile?.companies?.description || ""}
                            onChange={(e) => updateCompany({ description: e.target.value })}
                            placeholder="Why should top sales talent join your team?"
                            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 pr-24 text-xs font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleSuggestBio}
                            disabled={generatingBio}
                            className="absolute right-3.5 top-3.5 rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-[#FF8A00] transition hover:bg-[#FF8A00] hover:text-white disabled:opacity-50"
                          >
                            {generatingBio ? "Scribbling..." : "AI Assist"}
                          </button>
                        </div>
                      </Field>
                    </div>
                  </div>
                </div>
              )}

              {/* RECRUITING STYLE TAB */}
              {activeTab === "style" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">Recruiting Persona</h3>
                    <p className="text-xs text-slate-400">Refine how you interact and find suitable candidates.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Years of Recruiting Experience" icon={Briefcase}>
                      <TextInput
                        type="number"
                        value={profile?.professional_persona?.years_experience || 0}
                        onChange={(e) => updatePersona({ years_experience: parseInt(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label="Hiring Style Focus" icon={Target}>
                      <SelectInput
                        value={profile?.professional_persona?.preferred_hiring_style || ""}
                        onChange={(e) => updatePersona({ preferred_hiring_style: e.target.value })}
                        options={["", "consultative", "directive", "collaborative"]}
                        labels={["Select Style", "Consultative Approach", "Directive Selection", "Collaborative Hiring"]}
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Focus Hiring Domains" icon={Tag}>
                        <TextInput
                          value={profile?.professional_persona?.focus_areas?.join(", ") || ""}
                          onChange={(e) => updatePersona({ focus_areas: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
                          placeholder="Sales Leaders, Account Executives, SDRs (comma separated)"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Actions Sticky Panel */}
            <div className="border-t border-slate-150 bg-white/95 px-6 py-4 flex items-center justify-between gap-4 rounded-b-3xl shrink-0">
              <button
                type="button"
                onClick={() => router.push("/dashboard/recruiter")}
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
