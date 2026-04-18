"use client";

import { useEffect, useState, useRef } from "react";
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
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "company" | "security" | "notifications">("profile");

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
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match" });
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
        setConfirmPassword("");
      }
    } catch (err: any) {
      // Clean up the error message for the user
      const messageText = err.message || "";
      let userFriendlyMsg = "Verification failed. Check old password.";
      
      if (messageText.includes("Current password incorrect")) {
        userFriendlyMsg = "The current password you entered is incorrect.";
      } else if (messageText) {
        userFriendlyMsg = messageText;
      }
      
      setMessage({ type: "error", text: userFriendlyMsg });
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

      setMessage(null);

      const res = await apiClient.post(
        "/recruiter/verify-id",
        { id_path: filePath },
        token
      );

      if (res.id_verified) {
        setProfile(p => p ? { ...p, identity_verified: true } : null);
        setMessage({ type: "success", text: "Identity Verified. Professional Badge Active." });
      }
    } catch (err: any) {
      const errorMsg = err.message || "Credential rejection. Please upload a clear ID.";
      setMessage({ type: "error", text: `Verification Failed: ${errorMsg}` });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setMessage({ type: "success", text: "Uploading company logo..." });

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("Authentication failed");

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await apiClient.post(
        "/storage/upload/branding",
        formData,
        token
      );

      const logoUrl = uploadRes.url || uploadRes.path;

      setCompany(c => c ? { ...c, logo_url: logoUrl } : null);
      
      // Save to backend
      await syncData("/recruiter/profile", { companies: { logo_url: logoUrl } }, "Company Logo Updated");
      
      setMessage({ type: "success", text: "Company Logo Uploaded Successfully." });
    } catch (err: any) {
      const errorMsg = err.message || "Failed to upload logo.";
      setMessage({ type: "error", text: `Upload Failed: ${errorMsg}` });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Settings</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your profile, company branding, notifications, and privacy preferences.</p>
          </div>
        </header>

        {message && (
          <div className={`p-4 rounded-2xl border shadow-sm transition-all animate-in fade-in slide-in-from-top-4 mt-6 flex items-center gap-3 ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-rose-50 border-rose-100 text-rose-800"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        <div className="mt-8">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${
                activeTab === "profile"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              <User className="h-4 w-4" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab("company")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${
                activeTab === "company"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              <Building2 className="h-4 w-4" />
              Company
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${
                activeTab === "security"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              <Shield className="h-4 w-4" />
              Security
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all font-medium text-sm ${
                activeTab === "notifications"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
              }`}
            >
              <Bell className="h-4 w-4" />
              Notifications
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "profile" && (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center gap-6 mb-8">
                <div className="h-20 w-20 rounded-full bg-linear-to-br from-primary to-primary-dark flex items-center justify-center relative overflow-hidden flex-shrink-0 border-2 border-slate-200">
                  <User className="text-white" size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Profile Photo</h3>
                  <p className="text-sm text-slate-500 mt-1">This photo is displayed to candidates viewing your profile.</p>
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-6">
                <InputGroup label="Full Name" value={profile?.full_name} onChange={(val) => setProfile(p => p ? {...p, full_name: val} : null)} />
                <InputGroup label="Phone Number" value={profile?.phone_number} onChange={(val) => setProfile(p => p ? {...p, phone_number: val} : null)} />
                <InputGroup label="Professional Bio" isTextArea value={profile?.bio} onChange={(val) => setProfile(p => p ? {...p, bio: val} : null)} />
                <InputGroup label="LinkedIn URL" value={profile?.linkedin_url} onChange={(val) => setProfile(p => p ? {...p, linkedin_url: val} : null)} />
                <InputGroup label="Current Location" value={profile?.location} onChange={(val) => setProfile(p => p ? {...p, location: val} : null)} />
                
                <div className="pt-6">
                  <button type="submit" disabled={saving} className="bg-primary text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-primary-dark transition-all flex items-center gap-2 disabled:opacity-50">
                    {saving ? "Saving..." : "Save Changes"}
                    <Save size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "company" && (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center gap-6 mb-8">
                <div 
                  onClick={() => logoInputRef.current?.click()}
                  className="h-24 w-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center relative overflow-hidden flex-shrink-0 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  {company?.logo_url ? (
                    <img 
                      src={company.logo_url} 
                      alt="Company Logo" 
                      className="h-full w-full object-cover" 
                    />
                  ) : (
                    <Building2 className="text-slate-400 group-hover:text-blue-500 transition-all" size={40} />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-full transition-all flex items-center justify-center">
                    <Upload className="text-white opacity-0 group-hover:opacity-100 transition-all" size={18} />
                  </div>
                  <input 
                    ref={logoInputRef}
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleLogoUpload} 
                    disabled={saving}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Company Logo</h3>
                  <p className="text-sm text-slate-500 mt-1">Click the logo to upload. Visible on all your job postings and career pages.</p>
                </div>
              </div>

              <form onSubmit={handleCompanySave} className="space-y-6">
                <InputGroup label="Company Name" value={company?.name} onChange={(val) => setCompany(c => c ? {...c, name: val} : null)} />
                <InputGroup label="Website URL" value={company?.website} onChange={(val) => setCompany(c => c ? {...c, website: val} : null)} />

                <div className="pt-6">
                  <button type="submit" disabled={saving} className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50">
                    {saving ? "Updating..." : "Save Changes"}
                    <Save size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              {/* Password Management */}
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Change Password</h3>
                  <p className="text-sm text-slate-500">Update your password to keep your account secure.</p>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <InputGroup label="Current Password" value={oldPassword} onChange={setOldPassword} isPassword={!showOldPassword} />
                    <button 
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 top-9 text-slate-400 hover:text-primary transition-colors"
                    >
                      {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  <div className="relative">
                    <InputGroup label="New Password" value={newPassword} onChange={setNewPassword} isPassword={!showNewPassword} />
                    <button 
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-9 text-slate-400 hover:text-primary transition-colors"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <div className="relative">
                    <InputGroup label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} isPassword={!showNewPassword} />
                  </div>
                  
                  <div className="flex items-center gap-3 pt-6">
                    <button 
                      onClick={handleUpdatePassword}
                      disabled={saving || !newPassword || !oldPassword || !confirmPassword || newPassword !== confirmPassword}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:bg-slate-300"
                    >
                      {saving ? "Updating..." : "Update Password"}
                    </button>
                    {newPassword && confirmPassword && newPassword !== confirmPassword && (
                      <span className="text-xs font-bold text-rose-600 animate-pulse">Passwords do not match</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Identity Verification */}
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Identity Verification</h3>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 flex flex-col md:flex-row items-center gap-6">
                  <div className="h-16 w-16 rounded-lg bg-primary-light flex items-center justify-center flex-shrink-0">
                    <Shield className="text-primary" size={32} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 mb-1">Verify Your Identity</h4>
                    <p className="text-sm text-slate-500">Upload your government ID to get a verified badge. Verified profiles get 3x more candidate trust.</p>
                  </div>
                  <label className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${profile?.identity_verified ? "bg-emerald-50 text-emerald-600 border border-emerald-100 pointer-events-none" : "bg-primary text-white hover:bg-primary-dark border border-primary"}`}>
                    {profile?.identity_verified ? "✓ Verified" : "Upload ID"}
                    {!profile?.identity_verified && (
                      <input 
                        type="file" 
                        accept="image/*,.pdf" 
                        className="hidden" 
                        onChange={handleIDUpload} 
                        disabled={saving}
                      />
                    )}
                  </label>
                </div>
              </div>

              {/* Delete Account */}
              <div className="bg-rose-50/50 rounded-2xl p-8 border border-rose-200 shadow-sm">
                <h3 className="text-lg font-bold text-rose-600 mb-2">Danger Zone</h3>
                <p className="text-sm text-rose-500 mb-6">This action cannot be undone.</p>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  className="bg-rose-600 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-rose-700 transition-all disabled:opacity-50"
                >
                  {saving ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Notification Preferences</h3>
                <p className="text-sm text-slate-500">Choose how you'd like to be notified.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-y border-slate-200">
                <ToggleCard title="Email Alerts" desc="New candidate applications" icon={<Mail />} active={settings?.email_notifications || false} onToggle={(val) => handleSettingsSave({ email_notifications: val })} />
                <ToggleCard title="Browser Notifications" desc="Real-time job updates" icon={<Globe />} active={settings?.web_notifications || false} onToggle={(val) => handleSettingsSave({ web_notifications: val })} />
                <ToggleCard title="Mobile Push" desc="Push notifications" icon={<Smartphone />} active={settings?.mobile_notifications || false} onToggle={(val) => handleSettingsSave({ mobile_notifications: val })} />
              </div>

              <div>
                <label className="text-sm font-bold text-slate-900 mb-2 block">Timezone</label>
                <select value={settings?.timezone} onChange={(e) => handleSettingsSave({ timezone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="UTC">UTC</option>
                  <option value="IST">IST (India)</option>
                  <option value="PST">PST (Pacific)</option>
                  <option value="EST">EST (Eastern)</option>
                </select>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, isTextArea = false, isPassword = false }: { label: string, value?: string, onChange: (v: string) => void, isTextArea?: boolean, isPassword?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-900">{label}</label>
      {isTextArea ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-28 transition-all focus:bg-white" />
      ) : (
        <input type={isPassword ? "password" : "text"} value={value || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all focus:bg-white" />
      )}
    </div>
  );
}

function ToggleCard({ title, desc, icon, active, onToggle }: { title: string, desc: string, icon: React.ReactNode, active: boolean, onToggle: (v: boolean) => void }) {
  return (
    <div onClick={() => onToggle(!active)} className={`p-6 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${active ? "bg-blue-50 border-blue-600 shadow-md" : "bg-slate-50 border-slate-200"}`}>
      <div className={`h-10 w-10 rounded-lg mb-4 flex items-center justify-center transition-all ${active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"}`}>
        {icon}
      </div>
      <h4 className={`font-bold text-sm mb-1 ${active ? "text-slate-900" : "text-slate-700"}`}>{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      <div className="mt-4 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className={`text-xs font-medium ${active ? "text-blue-600 font-semibold" : "text-slate-500"}`}>{active ? "Enabled" : "Disabled"}</span>
      </div>
    </div>
  );
}

