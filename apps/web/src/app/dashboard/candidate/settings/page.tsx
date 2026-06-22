"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { 
  Save, 
  Shield, 
  Bell, 
  Mail,
  Globe, 
  Eye, 
  EyeOff,
  Lock,
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Coins
} from "lucide-react";
import ProfileCompletionCircle from "@/components/ProfileCompletionCircle";

interface ProfileData {
  full_name: string;
  phone_number: string;
  bio: string;
  linkedin_url: string;
  location: string;
  identity_verified: boolean;
  profile_photo_url?: string;
  completion_score?: number;
}

interface SettingsData {
  email_notifications: boolean;
  web_notifications: boolean;
  mobile_notifications: boolean;
  is_public: boolean;
  language: string;
  timezone: string;
  job_alert_frequency: string;
  minimum_salary_threshold?: number | null;
}

export default function CandidateSettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"security" | "notifications" | "privacy">("security");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["security", "notifications", "privacy"].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

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
          profile_photo_url: profileData.profile_photo_url,
          completion_score: profileData.completion_score || 0
        });

        setSettings(settingsData);
      } catch (err) {
        console.error("Error fetching sync data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleSettingsSave = async (newData: Partial<SettingsData>) => {
    setSettings(prev => (prev ? { ...prev, ...newData } : null));
    setSaving(true);
    setMessage(null);
    try {
      const token = awsAuth.getToken();
      if (token) {
        await apiClient.patch("/candidate/settings", newData, token);
        setMessage({ type: "success", text: "Protocol Preferences Synced" });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Signal Interrupted. Retry." });
    } finally {
      setSaving(false);
    }
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
      const publicUrl = data.url;

      setProfile((prev) => (prev ? { ...prev, profile_photo_url: publicUrl } : null));
      const patchResult = await apiClient.patch("/candidate/profile", { profile_photo_url: publicUrl }, token);
      if (patchResult && patchResult.completion_score !== undefined) {
        setProfile((prev) => (prev ? { ...prev, completion_score: patchResult.completion_score } : null));
      }
      setMessage({ type: "success", text: "Profile photo updated successfully." });
    } catch (error: any) {
      console.error("Upload error:", error);
      setMessage({ type: "error", text: error.message || "Failed to upload photo" });
    } finally {
      setUploadingPhoto(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleIDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post("/candidate/verify-id", formData, token);

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
      if (e.target) e.target.value = "";
    }
  };

  const handleCompleteNow = () => {
    router.push("/dashboard/candidate/profile");
  };

  const handleLogout = () => {
    awsAuth.logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#FF8A00]" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  const isVerified = profile?.identity_verified || false;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50/40 overflow-hidden font-sans">
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 min-h-0">
        
        {/* Left Side: Sidebar with Profile Completion Widget */}
        <aside className="w-full md:w-80 shrink-0 flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col items-center text-center">
            
            <ProfileCompletionCircle
              percentage={profile?.completion_score || 0}
              photoUrl={profile?.profile_photo_url}
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
              <h2 className="text-sm font-bold text-slate-800 truncate">
                {profile?.full_name || "Candidate Settings"}
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab("security")}
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
            <p className="text-[10px] text-slate-400 font-bold tracking-wider truncate max-w-full uppercase mt-1">
              {profile?.location || "No Location Specified"}
            </p>

            {/* Navigation Tabs List (Vertical) */}
            <nav className="mt-6 w-full flex-1 space-y-1">
              {[
                { id: "security", label: "Security & Trust", icon: Shield },
                { id: "notifications", label: "Notifications & Prefs", icon: Bell },
                { id: "privacy", label: "Privacy Control", icon: Eye },
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
                onClick={() => router.push("/dashboard/candidate")}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:bg-white"
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

        {/* Right Side: Tabbed Settings Card */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col min-h-0">
          
          <div className="p-6 md:p-8 flex-1 flex flex-col min-h-0">

            {/* Form Editor Body */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6">
              
              {message && (
                <div className={`rounded-xl border p-4 shadow-sm animate-in fade-in duration-200 ${message.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${message.type === "success" ? "text-emerald-500" : "text-rose-500"}`} />
                    <p className="text-xs font-bold">{message.text}</p>
                  </div>
                </div>
              )}

              {/* SECURITY TAB */}
              {activeTab === "security" && (
                <div className="space-y-6 max-w-2xl">
                  
                  {/* Password Form */}
                  <form onSubmit={handleUpdatePassword} className="space-y-5 bg-slate-50/40 rounded-2xl border border-slate-100 p-6">
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-1">Update Security Password</h4>
                      <p className="text-[10px] text-slate-400 font-medium">Secure your platform credentials with a strong password.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <Field label="Current Password" icon={Lock}>
                          <TextInput
                            type={showOldPassword ? "text" : "password"}
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="••••••••"
                          />
                        </Field>
                        <button 
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3.5 top-8 text-slate-400 hover:text-[#FF8A00]"
                        >
                          {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      <div className="relative">
                        <Field label="New Password" icon={Lock}>
                          <TextInput
                            type={showNewPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••"
                          />
                        </Field>
                        <button 
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3.5 top-8 text-slate-400 hover:text-[#FF8A00]"
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>

                      <div className="md:col-span-2">
                        <Field label="Confirm New Password" icon={Lock}>
                          <TextInput
                            type={showNewPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                      {newPassword && confirmPassword && newPassword !== confirmPassword ? (
                        <span className="text-[10px] font-black uppercase text-rose-600 animate-pulse">Passwords do not match</span>
                      ) : <div />}
                      
                      <button
                        type="submit"
                        disabled={saving || !newPassword || !oldPassword || !confirmPassword || newPassword !== confirmPassword}
                        className="flex items-center gap-2 rounded-xl bg-[#FF8A00] px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-[#E67A00] shadow-md shadow-orange-600/10 active:scale-95 disabled:opacity-75"
                      >
                        {saving ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Lock size={12} />}
                        Update Password
                      </button>
                    </div>
                  </form>

                  {/* ID Verification Panel */}
                  <div className="bg-slate-50/40 rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-[#FF8A00]/5 flex items-center justify-center shrink-0 border border-orange-100">
                        <Shield className="text-[#FF8A00]" size={22} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-1">Verify Identity Credentials</h4>
                        <p className="text-[10px] text-slate-400 font-medium">Upload candidate ID to activate verified badge status.</p>
                      </div>
                    </div>
                    
                    <label className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap shadow-sm border ${
                      isVerified 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100 pointer-events-none" 
                        : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                    }`}>
                      {isVerified ? "✓ Verified Status" : "Upload ID Document"}
                      {!isVerified && (
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

                  {/* Danger Zone */}
                  <div className="bg-rose-50/20 rounded-2xl border border-rose-100/60 p-6">
                    <h4 className="text-xs font-black uppercase text-rose-600 tracking-wider mb-1">Danger Zone</h4>
                    <p className="text-[10px] text-rose-400 font-medium mb-4">Permanently delete your profile and all application access. This action cannot be reverted.</p>
                    <button 
                      onClick={handleDeleteAccount}
                      disabled={saving}
                      className="rounded-xl border border-rose-200 bg-white hover:bg-rose-500 hover:text-white px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-rose-600 transition"
                    >
                      Delete Account Permanent
                    </button>
                  </div>
                </div>
              )}

              {/* NOTIFICATIONS TAB */}
              {activeTab === "notifications" && (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">Preferences & Notification Settings</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Customize how we contact you and who sees your platform presence.</p>
                  </div>

                  {/* iOS Style Custom Toggle Switch cards */}
                  <div className="space-y-3">
                    <ToggleRow
                      title="Email Alerts"
                      desc="Direct alerts & summary reports sent to your email"
                      icon={Mail}
                      active={settings?.email_notifications || false}
                      onToggle={(val) => handleSettingsSave({ email_notifications: val })}
                    />
                    <ToggleRow
                      title="Web Push Alerts"
                      desc="Real-time in-browser alert notifications"
                      icon={Globe}
                      active={settings?.web_notifications || false}
                      onToggle={(val) => handleSettingsSave({ web_notifications: val })}
                    />
                    <ToggleRow
                      title="Mobile Push Alerts"
                      desc="Instant push alerts on your mobile device"
                      icon={Smartphone}
                      active={settings?.mobile_notifications || false}
                      onToggle={(val) => handleSettingsSave({ mobile_notifications: val })}
                    />
                  </div>

                  {/* Settings dropdown fields form */}
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!settings) return;
                    handleSettingsSave({
                      timezone: settings.timezone,
                      language: settings.language,
                      job_alert_frequency: settings.job_alert_frequency,
                      minimum_salary_threshold: settings.minimum_salary_threshold
                    });
                  }} className="space-y-5 bg-slate-50/40 rounded-2xl border border-slate-100 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <Field label="System Timezone" icon={Globe}>
                        <SelectInput
                          value={settings?.timezone || "UTC"}
                          onChange={(e) => setSettings(prev => prev ? { ...prev, timezone: e.target.value } : null)}
                          options={["UTC", "IST", "PST", "EST", "GMT", "CET"]}
                          labels={["UTC (Coordinated Universal)", "IST (Indian Standard Time)", "PST (Pacific Standard Time)", "EST (Eastern Standard Time)", "GMT (London Mean Time)", "CET (Central European Time)"]}
                        />
                      </Field>
                      <Field label="Interface Language" icon={Globe}>
                        <SelectInput
                          value={settings?.language || "en"}
                          onChange={(e) => setSettings(prev => prev ? { ...prev, language: e.target.value } : null)}
                          options={["en", "es", "fr", "de", "zh", "ja"]}
                          labels={["English (United States)", "Español (Spain)", "Français (France)", "Deutsch (Germany)", "Chinese (Traditional)", "Japanese (Japan)"]}
                        />
                      </Field>
                      <Field label="Job Alert Frequency" icon={Bell}>
                        <SelectInput
                          value={settings?.job_alert_frequency || "daily"}
                          onChange={(e) => setSettings(prev => prev ? { ...prev, job_alert_frequency: e.target.value } : null)}
                          options={["instant", "daily", "weekly"]}
                          labels={["Instant Alerts", "Daily Summary", "Weekly Digest"]}
                        />
                      </Field>
                      <Field label="Minimum Salary Expectation" icon={Coins}>
                        <TextInput
                          type="number"
                          value={settings?.minimum_salary_threshold ?? ""}
                          onChange={(e) => setSettings(prev => prev ? { ...prev, minimum_salary_threshold: e.target.value === "" ? null : Number(e.target.value) } : null)}
                          placeholder="e.g. 80000"
                        />
                      </Field>
                    </div>

                    {/* Submit Panel */}
                    <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 rounded-xl bg-[#FF8A00] px-5 py-2.5 text-[9px] font-black uppercase tracking-widest text-white transition hover:bg-[#E67A00] shadow-md shadow-orange-600/10 active:scale-95"
                      >
                        {saving ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save size={14} />}
                        Save System Preferences
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* PRIVACY TAB */}
              {activeTab === "privacy" && (
                <div className="space-y-6 max-w-2xl">
                  <div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">Privacy Control</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Manage your profile visibility to recruiters on TechSalesAxis.</p>
                  </div>

                  <div className="bg-slate-50/40 rounded-2xl border border-slate-100 p-6 flex flex-col md:flex-row items-center gap-6">
                    <div className={`h-14 w-14 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                      settings?.is_public 
                        ? "bg-[#FF8A00]/5 border-orange-100 text-[#FF8A00]" 
                        : "bg-slate-100 border-slate-200 text-slate-400"
                    }`}>
                      {settings?.is_public ? <Eye size={22} /> : <EyeOff size={22} />}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-slate-800 mb-0.5">
                        {settings?.is_public ? "Public Profile Mode" : "Private Profile Mode"}
                      </h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                        {settings?.is_public 
                          ? "Your profile is visible to recruiters searching the database. They can view your insights and contact you." 
                          : "Your profile is hidden from direct database searches. Only recruiters of jobs you actively apply to can see your profile."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSettingsSave({ is_public: !settings?.is_public })}
                      className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-xs border ${
                        settings?.is_public 
                          ? "bg-[#FF8A00] text-white hover:bg-[#E67A00] border-transparent" 
                          : "bg-white text-slate-700 hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      {settings?.is_public ? "Go Private" : "Go Public"}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex flex-col group">
      <label className="mb-2 ml-1 flex items-center text-[9px] font-black uppercase tracking-widest text-slate-450 group-focus-within:text-[#FF8A00] transition-colors">
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
      className={`w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs font-semibold text-slate-750 outline-none transition-all focus:border-[#FF8A00] focus:bg-white focus:ring-2 focus:ring-[#FF8A00]/10 ${className}`}
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
      className={`w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-750 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/10 ${className}`}
    >
      {options.map((option, index) => (
        <option key={option} value={option}>
          {labels[index]}
        </option>
      ))}
    </select>
  );
}

function ToggleRow({ title, desc, icon: Icon, active, onToggle }: { title: string, desc: string, icon: any, active: boolean, onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50/50 transition-colors">
      <div className="flex items-center gap-3.5">
        <div className={`p-2.5 rounded-xl transition-colors ${active ? "bg-orange-50 text-[#FF8A00]" : "bg-slate-100 text-slate-400"}`}>
          <Icon size={18} />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-800">{title}</h4>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{desc}</p>
        </div>
      </div>
      <button 
        type="button"
        onClick={() => onToggle(!active)}
        className={`relative w-11 h-6 rounded-full transition-colors outline-none shrink-0 cursor-pointer ${active ? "bg-[#FF8A00]" : "bg-slate-200"}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm ${active ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
}
