"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { 
  Save, 
  User, 
  Shield, 
  Bell, 
  Settings, 
  Globe, 
  Eye, 
  EyeOff,
  Clock,
  LogOut,
  Upload,
  Lock,
  Mail,
  Smartphone,
  Building2,
  Palette,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import Image from "next/image";

interface ProfileData {
  full_name: string;
  phone_number: string;
  bio: string;
  linkedin_url: string;
  location: string;
  identity_verified: boolean;
}

interface CompanyData {
  id: string;
  name: string;
  website: string;
  logo_url?: string;
  brand_colors?: {
    primary: string;
    secondary: string;
  };
}

interface SettingsData {
  email_notifications: boolean;
  web_notifications: boolean;
  mobile_notifications: boolean;
  ghost_mode: boolean;
  language: string;
  timezone: string;
}

export default function RecruiterSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "company" | "security" | "notifications" | "privacy">("profile");

  useEffect(() => {
    async function fetchData() {
      try {
        const token = awsAuth.getToken();
        if (!token) return;

        const [profileData, settingsData] = await Promise.all([
          apiClient.get("/recruiter/profile", token),
          apiClient.get("/recruiter/settings", token)
        ]);

        setProfile({
          full_name: profileData.full_name || "",
          phone_number: profileData.phone_number || "",
          bio: profileData.bio || "",
          linkedin_url: profileData.linkedin_url || "",
          location: profileData.location || "",
          identity_verified: profileData.identity_verified || false
        });

        if (profileData.companies) {
          setCompany({
            id: profileData.companies.id,
            name: profileData.companies.name,
            website: profileData.companies.website || "",
            logo_url: profileData.companies.logo_url,
            brand_colors: profileData.companies.brand_colors || { primary: "#4f46e5", secondary: "#6366f1" }
          });
        }

        setSettings(settingsData);
      } catch (err) {
        console.error("Error fetching sync data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const syncData = async (endpoint: string, payload: any, successMsg: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const token = awsAuth.getToken();
      if (token) {
        await apiClient.patch(endpoint, payload, token);
        setMessage({ type: "success", text: successMsg });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Signal Interrupted. Retry." });
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    await syncData("/recruiter/profile", profile, "Profile Identity Updated");
  };

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }
    setSaving(true);
    try {
      const token = awsAuth.getToken();
      if (token) {
        await apiClient.post("/auth/update-password", { 
          old_password: oldPassword, 
          new_password: newPassword 
        }, token);
        
        setMessage({ type: "success", text: "Security credentials updated." });
        setOldPassword("");
        setNewPassword("");
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Verification failed. Check old password.";
      setMessage({ type: "error", text: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you absolutely sure? This will permanently erase your recruiter profile, linked company data, and platform access. This cannot be undone.")) return;
    
    setSaving(true);
    try {
      const token = awsAuth.getToken();
      if (token) {
        await apiClient.delete("/auth/delete-account", token);
        awsAuth.logout();
        window.location.href = "/";
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete account" });
      setSaving(false);
    }
  };

  const handleCompanySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    await syncData("/recruiter/company", company, "Company Branding Synced");
  };

  const handleSettingsSave = async (newData: any) => {
    setSettings(prev => (prev ? { ...prev, ...newData } : null));
    await syncData("/recruiter/settings", newData, "Protocol Preferences Synced");
  };

  const handleIDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setMessage({ type: "success", text: "Uploading credential for verification..." });

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("Authentication failed");

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await apiClient.post(
        "/storage/upload/recruiter-id",
        formData,
        token
      );

      const filePath = uploadRes.path;

      // 2. Clear previous error/status
      setMessage(null);

      // 3. Trigger AI Verification via Proxy
      const res = await apiClient.post(
        "/recruiter/verify-id",
        { id_path: filePath },
        token
      );

      if (res.id_verified) {
        setProfile(p => p ? { ...p, identity_verified: true } : null);
        setMessage({ type: "success", text: "Identity Protocol Verified. Badge activated." });
      }
    } catch (err: any) {
      const errorMsg = err.message || "Credential rejection. Please upload a clear ID.";
      setMessage({ type: "error", text: `Verification Failed: ${errorMsg}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4" />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Synchronizing Protocol...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic mb-2">
            Account <span className="text-indigo-600 font-black">Settings</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
            <Settings className="h-3 w-3 text-indigo-500" />
            Manage your profile, company branding, and notification preferences.
          </p>
        </div>
        
        {message && (
          <div className={`px-6 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-right-4 ${
            message.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-rose-50 border-rose-100 text-rose-600"
          }`}>
            {message.text}
          </div>
        )}
      </header>

      <div className="flex flex-col lg:flex-row gap-12 items-start">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-72 shrink-0 space-y-2 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
          <TabButton active={activeTab === "profile"} onClick={() => setActiveTab("profile")} icon={<User size={16} />} label="My Profile" />
          <TabButton active={activeTab === "company"} onClick={() => setActiveTab("company")} icon={<Building2 size={16} />} label="Company Branding" />
          <TabButton active={activeTab === "security"} onClick={() => setActiveTab("security")} icon={<Shield size={16} />} label="Security" />
          <TabButton active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")} icon={<Bell size={16} />} label="Notifications" />
          <TabButton active={activeTab === "privacy"} onClick={() => setActiveTab("privacy")} icon={<Eye size={16} />} label="Privacy Mode" />
          
          <div className="pt-4 mt-4 border-t border-slate-50">
            <button 
              onClick={() => {
                awsAuth.logout();
                window.location.href = "/login";
              }}
              className="w-full text-left px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-50 transition-all flex items-center gap-3 group"
            >
              <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-black uppercase tracking-widest">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "profile" && (
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-10">
              <div className="flex items-center gap-8 mb-10">
                <div className="h-24 w-24 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group">
                  <User className="text-slate-300" size={32} />
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                    <Upload className="text-white" size={20} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase italic">Profile Photo</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">This helps candidates recognize you during interviews.</p>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputGroup label="Full Name" value={profile?.full_name} onChange={(val) => setProfile(p => p ? {...p, full_name: val} : null)} />
                <InputGroup label="Phone Number" value={profile?.phone_number} onChange={(val) => setProfile(p => p ? {...p, phone_number: val} : null)} />
                <div className="md:col-span-2">
                  <InputGroup label="Personal Bio" isTextArea value={profile?.bio} onChange={(val) => setProfile(p => p ? {...p, bio: val} : null)} />
                </div>
                <InputGroup label="LinkedIn URL" value={profile?.linkedin_url} onChange={(val) => setProfile(p => p ? {...p, linkedin_url: val} : null)} />
                <InputGroup label="Current Location" value={profile?.location} onChange={(val) => setProfile(p => p ? {...p, location: val} : null)} />
                
                <div className="md:col-span-2 pt-6">
                  <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-200 hover:bg-slate-900 transition-all flex items-center gap-3">
                    {saving ? "Saving Changes..." : "Save Profile"}
                    <Save size={14} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "company" && (
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl shadow-slate-200/50 space-y-10">
              <div className="flex items-center gap-8 mb-10">
                <div className={`h-24 w-24 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden group`}>
                   {company?.logo_url ? <Image src={company.logo_url} alt="" fill className="object-contain p-2" /> : <Building2 className="text-slate-300" size={32} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase italic">Company Logo</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Visible on all your job postings and career pages.</p>
                </div>
              </div>

              <form onSubmit={handleCompanySave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputGroup label="Company Name" value={company?.name} onChange={(val) => setCompany(c => c ? {...c, name: val} : null)} />
                <InputGroup label="Website URL" value={company?.website} onChange={(val) => setCompany(c => c ? {...c, website: val} : null)} />
                
                <div className="md:col-span-2 p-8 rounded-3xl bg-slate-50 border border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 block">Company Brand Colors</label>
                  <div className="flex gap-12">
                    <div className="space-y-3">
                      <div className="h-12 w-12 rounded-xl shadow-inner border border-white" style={{backgroundColor: company?.brand_colors?.primary}} />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Primary Color</span>
                    </div>
                    <div className="space-y-3">
                      <div className="h-12 w-12 rounded-xl shadow-inner border border-white" style={{backgroundColor: company?.brand_colors?.secondary}} />
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secondary Color</span>
                    </div>
                    <button type="button" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700">
                      <Palette size={12} />
                      Customize Colors
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 pt-6">
                  <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-200 hover:bg-slate-900 transition-all flex items-center gap-3">
                    {saving ? "Updating..." : "Save Branding"}
                    <Save size={14} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-8">
              {/* Password Management */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm space-y-8">
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase italic mb-2">Corporate Security</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Update your recruitment console credentials.</p>
                </div>

                <div className="space-y-6">
                  {/* Password Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Current Password</label>
                      <div className="relative">
                        <Shield className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input 
                          type="password" 
                          placeholder="Verify old password" 
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-4 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input 
                          type="password" 
                          placeholder="Minimum 8 characters" 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-14 pr-6 py-4 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-50">
                    <button 
                      className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-all"
                      onClick={() => {/* Forgot Password Logic Later */}}
                    >
                      Forgot Password?
                    </button>
                    <button 
                      onClick={handleUpdatePassword}
                      disabled={saving || !newPassword || !oldPassword}
                      className="bg-slate-900 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all disabled:opacity-50"
                    >
                      {saving ? "Updating..." : "Update Access"}
                    </button>
                  </div>
                </div>

                <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase">Multi-Factor Authentication</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Secure your company data with extra verification.</p>
                    </div>
                  </div>
                  <button className="px-6 py-2 rounded-xl border border-slate-200 text-[9px] font-black uppercase tracking-widest hover:border-indigo-600 transition-all">
                    Enable MFA
                  </button>
                </div>
              </div>

              {/* ID Verification */}
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 uppercase italic mb-6">Identity Verification</h3>
                <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row items-center gap-8">
                  <div className="h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Shield className="text-indigo-600" size={32} />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h4 className="font-black text-slate-900 text-sm uppercase">Verified Recruiter Badge</h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">Get 40% more applications by verifying your professional identity.</p>
                  </div>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept="image/*,application/pdf"
                      onChange={handleIDUpload}
                      disabled={saving || profile?.identity_verified}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed" 
                    />
                    <button 
                      disabled={saving || profile?.identity_verified} 
                      className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking_widest transition-all ${profile?.identity_verified ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-white text-slate-900 border border-slate-200 group-hover:border-indigo-600"}`}
                    >
                      {profile?.identity_verified ? "Verified" : (saving ? "Analyzing..." : "Verify Now")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-rose-50/30 rounded-[2.5rem] p-10 border border-rose-100 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-black text-rose-600 uppercase italic mb-1 tracking-tight">System Termination</h3>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Irreversible actions for your recruitment account.</p>
                </div>
                
                  <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-white/50 rounded-3xl border border-rose-100 gap-6">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase">Delete Account</h4>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">This will remove your recruiter profile and linked company data.</p>
                    </div>
                    <button 
                      onClick={handleDeleteAccount}
                      disabled={saving}
                      className="bg-rose-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-50"
                    >
                      {saving ? "Processing..." : "Delete Permanently"}
                    </button>
                  </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <ToggleCard title="Email Alerts" desc="Get notified when candidates apply" icon={<Mail />} active={settings?.email_notifications || false} onToggle={(val) => handleSettingsSave({ email_notifications: val })} />
                <ToggleCard title="Desktop Notifications" desc="Real-time alerts in your browser" icon={<Globe />} active={settings?.web_notifications || false} onToggle={(val) => handleSettingsSave({ web_notifications: val })} />
                <ToggleCard title="Mobile SMS" desc="Instant alerts on your phone" icon={<Smartphone />} active={settings?.mobile_notifications || false} onToggle={(val) => handleSettingsSave({ mobile_notifications: val })} />
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
               <div className="flex flex-col md:flex-row items-center gap-10">
                  <div className={`h-32 w-32 rounded-[2.5rem] flex items-center justify-center transition-all shadow-xl ${!settings?.ghost_mode ? "bg-indigo-600 shadow-indigo-200" : "bg-slate-900 shadow-slate-200"}`}>
                    {!settings?.ghost_mode ? <Eye className="text-white" size={48} /> : <EyeOff className="text-white" size={48} />}
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl font-black text-slate-900 uppercase italic">{!settings?.ghost_mode ? "Public Recruiter Mode" : "Private (Ghost) Mode"}</h3>
                    <p className="text-sm font-medium text-slate-500 mt-2 max-w-lg">
                      {!settings?.ghost_mode 
                        ? "Your profile is visible to all candidates on the platform." 
                        : "Hide your identity. You will only be visible to candidates during active interviews."}
                    </p>
                    <button onClick={() => handleSettingsSave({ ghost_mode: !settings?.ghost_mode })} className={`mt-6 px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg ${!settings?.ghost_mode ? "bg-slate-900 text-white" : "bg-indigo-600 text-white"}`}>
                      {settings?.ghost_mode ? "TURN OFF PRIVACY" : "TURN ON PRIVACY"}
                    </button>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label, disabled = false }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30"}`}>
      <div className={active ? "text-white" : "text-slate-300"}>{icon}</div>
      {label}
    </button>
  );
}

function InputGroup({ label, value, onChange, isTextArea = false, name = "" }: { label: string, value?: string, onChange: (v: string) => void, isTextArea?: boolean, name?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      {isTextArea ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 min-h-32 transition-all focus:bg-white" />
      ) : (
        <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all focus:bg-white" />
      )}
    </div>
  );
}

function ToggleCard({ title, desc, icon, active, onToggle }: { title: string, desc: string, icon: React.ReactNode, active: boolean, onToggle: (v: boolean) => void }) {
  return (
    <div onClick={() => onToggle(!active)} className={`p-8 rounded-[2rem] border-2 transition-all cursor-pointer group hover:scale-[1.02] ${active ? "bg-white border-indigo-500 shadow-xl shadow-indigo-100" : "bg-slate-50 border-slate-100 grayscale hover:grayscale-0"}`}>
      <div className={`h-12 w-12 rounded-2xl mb-6 flex items-center justify-center transition-all ${active ? "bg-indigo-600 text-white" : "bg-white text-slate-300 border border-slate-100"}`}>
        {icon}
      </div>
      <h4 className="font-black text-slate-900 text-xs uppercase mb-1">{title}</h4>
      <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">{desc}</p>
      <div className="mt-6 flex items-center gap-2">
        <div className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{active ? "Active Link" : "Disconnected"}</span>
      </div>
    </div>
  );
}
