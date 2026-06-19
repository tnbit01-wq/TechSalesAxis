"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { 
  Save, 
  User, 
  Shield, 
  Bell, 
  Mail,
  Globe, 
  Eye, 
  EyeOff,
  Lock,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ChevronRight
} from "lucide-react";
import Image from "next/image";

interface ProfileData {
  full_name: string;
  phone_number: string;
  bio: string;
  linkedin_url: string;
  location: string;
  identity_verified: boolean;
  profile_photo_url?: string;
}

interface SettingsData {
  email_notifications: boolean;
  web_notifications: boolean;
  mobile_notifications: boolean;
  is_public: boolean;
  language: string;
  timezone: string;
  job_alert_frequency: string;
}

export default function CandidateSettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications" | "privacy">("profile");

  useEffect(() => {
    async function fetchData() {
      try {
        const token = awsAuth.getToken();
        if (!token) return;

        const [profileData, settingsData] = await Promise.all([
          apiClient.get("/candidate/profile", token),
          apiClient.get("/candidate/settings", token)
        ]);

        setProfile({
          full_name: profileData.full_name || "",
          phone_number: profileData.phone_number || "",
          bio: profileData.bio || "",
          linkedin_url: profileData.linkedin_url || "",
          location: profileData.location || "",
          identity_verified: profileData.identity_verified || false,
          profile_photo_url: profileData.profile_photo_url
        });

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
    await syncData("/candidate/profile", profile, "Profile Identity Updated");
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
    if (!confirm("Are you absolutely sure? This will permanently erase your entire profile, applications, and account access. This cannot be undone.")) return;
    
    setSaving(true);
    try {
      const token = awsAuth.getToken();
      if (token) {
        await apiClient.delete("/delete-account", token);
        awsAuth.logout();
        window.location.href = "/";
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete account" });
      setSaving(false);
    }
  };

  const handleSettingsSave = async (newData: any) => {
    setSettings(prev => (prev ? { ...prev, ...newData } : null));
    await syncData("/candidate/settings", newData, "Protocol Preferences Synced");
  };

  const handleUploadID = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("Not authenticated");

      // Verify ID using the automated extraction endpoint which uses Gemini Vision
      const formData = new FormData();
      formData.append("file", file);

      // Using the generic upload helper logic
      const response = await apiClient.post("/candidate/verify-id", formData, token ?? undefined);

      if (response.verified) {
        setProfile(prev => prev ? { ...prev, identity_verified: true } : null);
        setMessage({ type: "success", text: "Identity Verified. Professional Badge Active." });
      } else {
        setMessage({ type: "error", text: response.reason || "Validation failed. Ensure clear ID document." });
      }
    } catch (err: any) {
      console.error("ID verification error:", err);
      setMessage({ type: "error", text: "Verification process interrupted. Try again." });
    } finally {
      setSaving(false);
      // Reset the file input
      if (e.target) e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50/50">
      <div className="mx-auto flex h-[calc(100vh-5rem)] max-w-7xl flex-col px-4 py-6">
        {message && (
          <div className={`mb-6 p-4 rounded-2xl border shadow-sm transition-all animate-in fade-in slide-in-from-top-4 flex items-center gap-3 ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-rose-50 border-rose-100 text-rose-800"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {/* Main Layout: Sidebar + Content */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-orange-100/80 shadow-[0_8px_24px_rgba(255,138,0,0.04)] p-4 sticky top-24">
              <nav className="space-y-2">
                {[
                  { id: "profile", label: "Profile", icon: User },
                  { id: "security", label: "Security", icon: Shield },
                  { id: "notifications", label: "Notifications", icon: Bell },
                  { id: "privacy", label: "Privacy", icon: Eye }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all font-medium text-sm ${
                        isActive
                          ? "bg-[#FF8A00] text-white shadow-[0_4px_12px_rgba(255,138,0,0.3)]"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </div>
                      {isActive && <ChevronRight className="h-4 w-4" />}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* PROFILE SECTION */}
            {activeTab === "profile" && (
              <div className="bg-white rounded-3xl border border-orange-100/80 shadow-[0_8px_24px_rgba(255,138,0,0.06)] p-8 space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Your Profile</h2>
                  <p className="text-slate-500 text-sm">Update your information visible to recruiters.</p>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-6">
                  <InputGroup label="Full Name" value={profile?.full_name} onChange={(val) => setProfile(p => p ? {...p, full_name: val} : null)} />
                  <InputGroup label="Phone Number" value={profile?.phone_number} onChange={(val) => setProfile(p => p ? {...p, phone_number: val} : null)} />
                  <InputGroup label="Professional Summary" isTextArea value={profile?.bio} onChange={(val) => setProfile(p => p ? {...p, bio: val} : null)} />
                  <InputGroup label="LinkedIn URL" value={profile?.linkedin_url} onChange={(val) => setProfile(p => p ? {...p, linkedin_url: val} : null)} />
                  <InputGroup label="Location" value={profile?.location} onChange={(val) => setProfile(p => p ? {...p, location: val} : null)} />
                  
                  <div className="pt-4 flex gap-3">
                    <button type="submit" disabled={saving} className="bg-[#FF8A00] hover:bg-[#E67A00] text-white px-6 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50">
                      {saving ? "Saving..." : "Save Changes"}
                      <Save size={16} />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SECURITY SECTION */}
            {activeTab === "security" && (
              <div className="space-y-6">
                {/* Password Management */}
                <div className="bg-white rounded-3xl border border-orange-100/80 shadow-[0_8px_24px_rgba(255,138,0,0.06)] p-8 space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Change Password</h2>
                    <p className="text-slate-500 text-sm">Keep your account secure with a strong password.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <InputGroup label="Current Password" value={oldPassword} onChange={setOldPassword} isPassword={!showOldPassword} />
                      <button 
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-4 top-10 text-slate-400 hover:text-[#FF8A00] transition-colors"
                      >
                        {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    
                    <div className="relative">
                      <InputGroup label="New Password" value={newPassword} onChange={setNewPassword} isPassword={!showNewPassword} />
                      <button 
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-10 text-slate-400 hover:text-[#FF8A00] transition-colors"
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <InputGroup label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} isPassword={!showNewPassword} />
                    
                    <div className="flex items-center gap-3 pt-4">
                      <button 
                        onClick={handleUpdatePassword}
                        disabled={saving || !newPassword || !oldPassword || !confirmPassword || newPassword !== confirmPassword}
                        className="bg-[#FF8A00] hover:bg-[#E67A00] text-white px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
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
                <div className="bg-white rounded-3xl border border-orange-100/80 shadow-[0_8px_24px_rgba(255,138,0,0.06)] p-8">
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">Verification</h2>
                  <div className="bg-gradient-to-br from-[#FF8A00]/10 to-[#FFB366]/5 p-6 rounded-2xl border border-orange-100/80 flex flex-col md:flex-row items-center gap-6">
                    <div className="h-16 w-16 rounded-xl bg-[#FF8A00]/20 flex items-center justify-center flex-shrink-0">
                      <Shield className="text-[#FF8A00]" size={32} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1">Verify Your Identity</h3>
                      <p className="text-sm text-slate-500">Upload your ID to get verified. Verified profiles get 3x more recruiter views.</p>
                    </div>
                    <label className={`px-6 py-3 rounded-xl text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${profile?.identity_verified ? "bg-emerald-50 text-emerald-600 border border-emerald-100 pointer-events-none" : "bg-[#FF8A00] text-white hover:bg-[#E67A00] border border-[#FF8A00]"}`}>
                      {profile?.identity_verified ? "✓ Verified" : "Upload ID"}
                      {!profile?.identity_verified && (
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          className="hidden" 
                          onChange={handleUploadID} 
                          disabled={saving}
                        />
                      )}
                    </label>
                  </div>
                </div>

                {/* Delete Account */}
                <div className="bg-rose-50/50 rounded-3xl border border-rose-200 p-8">
                  <h3 className="text-xl font-bold text-rose-600 mb-2">Danger Zone</h3>
                  <p className="text-sm text-rose-500 mb-6">Permanently delete your account and all associated data. This cannot be undone.</p>
                  <button 
                    onClick={handleDeleteAccount}
                    disabled={saving}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  >
                    {saving ? "Deleting..." : "Delete Account"}
                  </button>
                </div>
              </div>
            )}

            {/* NOTIFICATIONS SECTION */}
            {activeTab === "notifications" && (
              <div className="bg-white rounded-3xl border border-orange-100/80 shadow-[0_8px_24px_rgba(255,138,0,0.06)] p-8 space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Notification Preferences</h2>
                  <p className="text-slate-500 text-sm">Choose how you receive updates and alerts.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-y border-slate-200">
                  <ToggleCard title="Email Notifications" desc="Job matches & updates" icon={<Mail />} active={settings?.email_notifications || false} onToggle={(val) => handleSettingsSave({ email_notifications: val })} />
                  <ToggleCard title="Browser Alerts" desc="Interview invites" icon={<Globe />} active={settings?.web_notifications || false} onToggle={(val) => handleSettingsSave({ web_notifications: val })} />
                  <ToggleCard title="Mobile Push" desc="Push alerts" icon={<Smartphone />} active={settings?.mobile_notifications || false} onToggle={(val) => handleSettingsSave({ mobile_notifications: val })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-bold text-slate-900 mb-2 block">Alert Frequency</label>
                    <select value={settings?.job_alert_frequency || ""} onChange={(e) => handleSettingsSave({ job_alert_frequency: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20 transition-all">
                      <option value="" disabled>Select Frequency</option>
                      <option value="instant">Instant</option>
                      <option value="daily">Daily Summary</option>
                      <option value="weekly">Weekly Summary</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-slate-900 mb-2 block">Timezone</label>
                    <select value={settings?.timezone || ""} onChange={(e) => handleSettingsSave({ timezone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20 transition-all">
                      <option value="" disabled>Select Timezone</option>
                      <option value="UTC">UTC</option>
                      <option value="IST">IST (India)</option>
                      <option value="PST">PST (Pacific)</option>
                      <option value="EST">EST (Eastern)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* PRIVACY SECTION */}
            {activeTab === "privacy" && (
              <div className="bg-white rounded-3xl border border-orange-100/80 shadow-[0_8px_24px_rgba(255,138,0,0.06)] p-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Privacy Control</h2>
                  <p className="text-slate-500 text-sm mb-8">Manage your profile visibility to recruiters.</p>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-25 rounded-2xl border border-slate-200 p-8 space-y-6">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className={`h-20 w-20 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${settings?.is_public ? "bg-[#FF8A00]" : "bg-slate-700"}`}>
                      {settings?.is_public ? <Eye className="text-white" size={40} /> : <EyeOff className="text-white" size={40} />}
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <h3 className="text-xl font-bold text-slate-900 mb-2">{settings?.is_public ? "Public Profile" : "Private Mode"}</h3>
                      <p className="text-slate-600 mb-6 text-sm">
                        {settings?.is_public 
                          ? "Your profile is visible to all recruiters. They can discover you through search and direct messages." 
                          : "Your profile is hidden from search. Recruiters can only see you if you apply to them."}
                      </p>
                      <button onClick={() => handleSettingsSave({ is_public: !settings?.is_public })} className="bg-[#FF8A00] hover:bg-[#E67A00] text-white px-6 py-3 rounded-xl text-sm font-bold transition-all">
                        {settings?.is_public ? "Enable Private Mode" : "Go Public"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
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
    <div onClick={() => onToggle(!active)} className={`p-6 rounded-2xl border-2 transition-all cursor-pointer hover:shadow-md ${active ? "bg-white border-[#FF8A00] shadow-lg" : "bg-slate-50 border-slate-200"}`}>
      <div className={`h-10 w-10 rounded-lg mb-4 flex items-center justify-center transition-all ${active ? "bg-[#FF8A00] text-white" : "bg-slate-200 text-slate-400"}`}>
        {icon}
      </div>
      <h4 className="font-bold text-slate-900 text-sm mb-1">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      <div className="mt-4 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
        <span className="text-xs font-medium text-slate-500">{active ? "Enabled" : "Disabled"}</span>
      </div>
    </div>
  );
}

