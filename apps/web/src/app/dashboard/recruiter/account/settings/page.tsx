"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { 
  User, 
  Shield, 
  Bell, 
  Mail,
  Globe, 
  Eye, 
  EyeOff,
  Lock,
  Smartphone,
  ChevronRight,
  LogOut,
  Sliders,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserPlus,
  UserMinus,
  Crown,
  Clock,
  CheckCircle,
  MoreHorizontal,
  X,
  Loader2,
  LayoutDashboard,
  Coins,
  Camera
} from "lucide-react";
import { toast } from "sonner";

interface ProfileData {
  full_name: string;
  phone_number: string;
  bio: string;
  linkedin_url: string;
  location: string;
  identity_verified: boolean;
  profile_photo_url?: string;
  team_role?: string;
  job_title?: string;
  user_id?: string;
  profile_score?: number;
  completion_score?: number;
  credits?: number;
}

interface SettingsData {
  email_notifications: boolean;
  web_notifications: boolean;
  mobile_notifications: boolean;
  profile_visibility: string; // 'public' | 'private'
  language: string;
  timezone: string;
  ghost_mode: boolean;
}

type ActiveTab = "preferences" | "notifications" | "privacy" | "security" | "team";

function RecruiterSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as ActiveTab | null;
  const idInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [editedSettings, setEditedSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("preferences");

  useEffect(() => {
    if (tabParam && ["preferences", "notifications", "privacy", "security", "team"].includes(tabParam)) {
      if (tabParam === "team" && profile && profile.team_role !== "admin") {
        setActiveTab("preferences");
      } else {
        setActiveTab(tabParam);
      }
    }
  }, [tabParam, profile]);
  
  // Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Team Management state
  const [team, setTeam] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

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
          identity_verified: profileData.identity_verified || false,
          profile_photo_url: profileData.profile_photo_url,
          team_role: profileData.team_role || "Recruiter",
          job_title: profileData.job_title || "",
          user_id: profileData.user_id || "",
          profile_score: profileData.companies?.profile_score ?? 75,
          completion_score: profileData.completion_score ?? 0,
          credits: profileData.credits ?? 0
        });

        const initialSettings = {
          email_notifications: settingsData.email_notifications ?? true,
          web_notifications: settingsData.web_notifications ?? true,
          mobile_notifications: settingsData.mobile_notifications ?? false,
          profile_visibility: settingsData.profile_visibility ?? "public",
          language: settingsData.language ?? "en",
          timezone: settingsData.timezone ?? "UTC",
          ghost_mode: settingsData.ghost_mode ?? false
        };

        setSettings(initialSettings);
        setEditedSettings(initialSettings);
      } catch (err) {
        console.error("Error fetching settings data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const loadTeamData = async () => {
    setTeamLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      const teamData = await apiClient.get("/recruiter/team", token);
      setTeam(teamData || []);
    } catch (err) {
      console.error("Failed to load team:", err);
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "team") {
      loadTeamData();
    }
  }, [activeTab]);

  const handleSettingChange = (newData: Partial<SettingsData>) => {
    setEditedSettings(prev => prev ? { ...prev, ...newData } : null);
  };

  const isDirty = settings && editedSettings && (
    settings.email_notifications !== editedSettings.email_notifications ||
    settings.web_notifications !== editedSettings.web_notifications ||
    settings.mobile_notifications !== editedSettings.mobile_notifications ||
    settings.profile_visibility !== editedSettings.profile_visibility ||
    settings.language !== editedSettings.language ||
    settings.timezone !== editedSettings.timezone ||
    settings.ghost_mode !== editedSettings.ghost_mode
  );

  const handleSaveSettings = async () => {
    if (!editedSettings || !settings) return;
    setSaving(true);
    try {
      const token = awsAuth.getToken();
      if (token) {
        const diff: Partial<SettingsData> = {};
        if (editedSettings.email_notifications !== settings.email_notifications) diff.email_notifications = editedSettings.email_notifications;
        if (editedSettings.web_notifications !== settings.web_notifications) diff.web_notifications = editedSettings.web_notifications;
        if (editedSettings.mobile_notifications !== settings.mobile_notifications) diff.mobile_notifications = editedSettings.mobile_notifications;
        if (editedSettings.profile_visibility !== settings.profile_visibility) diff.profile_visibility = editedSettings.profile_visibility;
        if (editedSettings.language !== settings.language) diff.language = editedSettings.language;
        if (editedSettings.timezone !== settings.timezone) diff.timezone = editedSettings.timezone;
        if (editedSettings.ghost_mode !== settings.ghost_mode) diff.ghost_mode = editedSettings.ghost_mode;

        await apiClient.patch("/recruiter/settings", diff, token);
        setSettings(editedSettings);
        toast.success("Settings updated successfully.");
      }
    } catch (err) {
      console.error("Settings save error:", err);
      toast.error("Failed to sync settings with server.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardSettings = () => {
    setEditedSettings(settings);
    toast.info("Changes discarded.");
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
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
        
        toast.success("Security credentials updated successfully.");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      const errorMsg = err.message || "Verification failed. Check old password.";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleIDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    toast.info("Uploading credential for verification...");

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
      const res = await apiClient.post(
        "/recruiter/verify-id",
        { id_path: filePath },
        token
      );

      if (res.id_verified) {
        setProfile(p => p ? { ...p, identity_verified: true } : null);
        toast.success("Identity Verified. Partner badge is active.");
      } else {
        toast.error(res.details?.reason || "Verification failed. Ensure a clear ID document.");
      }
    } catch (err: any) {
      const errorMsg = err.message || "Upload or verification process failed. Please try again.";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteAccount = async () => {
    const doubleConfirm = confirm(
      "Are you absolutely sure? This will permanently erase your recruiter profile, company details, job postings, applications, and account access. This CANNOT be undone."
    );
    if (!doubleConfirm) return;

    setSaving(true);
    try {
      const token = awsAuth.getToken();
      if (token) {
        await apiClient.delete("/auth/delete-account", token);
        awsAuth.logout();
        router.replace("/login");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete account");
      setSaving(false);
    }
  };

  const handleLogout = () => {
    awsAuth.logout();
    router.replace("/login");
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post("/recruiter/invite", { email: inviteEmail }, token);
      setIsInviteModalOpen(false);
      setInviteEmail("");
      toast.success(`Invitation sent successfully to ${inviteEmail}.`);
      loadTeamData();
    } catch (err) {
      console.error("Invite failed:", err);
      toast.error("Failed to send invitation. Make sure you are an admin.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName}? They will lose access to the company dashboard.`)) return;
    setActioningId(memberId);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.delete(`/recruiter/team/${memberId}`, token);
      setTeam((prev) => prev.filter((m) => m.user_id !== memberId));
      toast.success(`${memberName} has been removed from the team.`);
    } catch (err) {
      console.error("Remove failed:", err);
      toast.error("Failed to remove member.");
    } finally {
      setActioningId(null);
      setOpenMenuId(null);
    }
  };

  const handlePromote = async (member: any) => {
    const action = member.is_admin ? "demote" : "promote";
    const memberName = member.full_name || member.users?.email || "Team Member";
    if (!confirm(`Are you sure you want to ${action} ${memberName}?`)) return;
    setActioningId(member.user_id);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.patch(`/recruiter/team/${member.user_id}/role`, { is_admin: !member.is_admin }, token);
      setTeam((prev) => prev.map((m) => m.user_id === member.user_id ? { ...m, is_admin: !m.is_admin } : m));
      toast.success(`Role updated successfully for ${memberName}.`);
    } catch (err) {
      console.error("Role change failed:", err);
      toast.error("Failed to change role.");
    } finally {
      setActioningId(null);
      setOpenMenuId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00]" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-6 md:px-8 py-5 h-auto lg:h-[calc(100vh-64px)] flex flex-col lg:flex-row gap-6 overflow-hidden bg-[#FAFBFC]">
      
      {/* SIDEBAR */}
      <aside className="w-full lg:w-[300px] xl:w-[320px] flex-shrink-0 bg-white border border-slate-200/80 rounded-[24px] p-5.5 shadow-sm flex flex-col gap-5 h-auto lg:h-full overflow-y-auto">
        <div className="space-y-4">
          
          {/* Recruiter Details Card */}
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
                  onClick={() => router.push("/dashboard/recruiter/account/profile")}
                  title="Edit Profile"
                >
                  {profile?.profile_photo_url ? (
                    <img src={profile.profile_photo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-[#FF8A00]" />
                  )}
                  
                  {/* Hover Edit Overlay */}
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-200">
                    <Camera className="h-4 w-4" />
                    <span className="text-[7.5px] font-bold uppercase mt-0.5">Edit</span>
                  </div>
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
                  onClick={() => router.push("/dashboard/recruiter/account/profile")}
                  className="mt-2.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 hover:bg-[#FF8A00] hover:text-white transition-all text-[9px] font-black uppercase tracking-wider text-[#FF8A00] flex items-center justify-center gap-1.5 group/link"
                >
                  Complete Now <ChevronRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
            
            <h2 className="mt-3 text-base font-black text-slate-900 leading-snug flex items-center justify-center gap-1.5">
              {profile?.full_name || "Recruiter"}
              {profile?.identity_verified ? (
                <button
                  type="button"
                  onClick={() => setActiveTab("security")}
                  className="flex shrink-0 items-center justify-center h-6 w-6 rounded-full bg-emerald-50 border border-emerald-100 hover:scale-105 active:scale-95 transition-all duration-150"
                  title="Verified Partner - Click to view verification settings"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 fill-emerald-50" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab("security")}
                  className="flex shrink-0 items-center justify-center h-6 w-6 rounded-full bg-rose-50 border border-rose-100 hover:scale-105 active:scale-95 transition-all duration-150"
                  title="Unverified Profile - Click to complete verification"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-600 fill-rose-50" />
                </button>
              )}
            </h2>
            <p className="text-[11.5px] text-slate-400 font-semibold">{profile?.job_title || "Talent Acquisition"}</p>
            
            {profile?.team_role && (
              <div className="mt-1.5 flex justify-center">
                <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-150 px-2.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                  {profile.team_role}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="space-y-1 pt-2 border-t border-slate-100">
            <TabButton active={activeTab === "preferences"} onClick={() => setActiveTab("preferences")} icon={Sliders} label="Preferences" />
            <TabButton active={activeTab === "notifications"} onClick={() => setActiveTab("notifications")} icon={Bell} label="Notifications" />
            <TabButton active={activeTab === "privacy"} onClick={() => setActiveTab("privacy")} icon={Eye} label="Privacy & Visibility" />
            <TabButton active={activeTab === "security"} onClick={() => setActiveTab("security")} icon={Shield} label="Security & Identity" />
            {profile?.team_role === "admin" && (
              <TabButton active={activeTab === "team"} onClick={() => setActiveTab("team")} icon={Users} label="Team Management" />
            )}
          </nav>

        </div>
      </aside>

      {/* WORKSPACE PANEL */}
      <div className="flex-1 bg-white border border-slate-200/80 rounded-[24px] shadow-sm flex flex-col h-auto lg:h-full overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0 text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FF8A00]">
            {activeTab === "preferences" ? "System Controls" : activeTab === "notifications" ? "Alert Channels" : activeTab === "privacy" ? "Audience Settings" : activeTab === "security" ? "Security Lock" : "Workspace Access"}
          </p>
          <h1 className="text-xl font-black text-slate-900 mt-0.5 animate-in fade-in duration-300">
            {activeTab === "preferences" ? "Account Preferences" : activeTab === "notifications" ? "Notification Settings" : activeTab === "privacy" ? "Privacy & Visibility" : activeTab === "security" ? "Security & Verification" : "Team Management"}
          </h1>
        </div>

        {/* Tab Workspaces */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: PREFERENCES */}
          {activeTab === "preferences" && (
            <div className="bg-white border border-slate-200/60 rounded-2xl p-5 gap-6 grid grid-cols-1 md:grid-cols-2 shadow-[0_2px_8px_rgba(0,0,0,0.015)] animate-in fade-in slide-in-from-bottom-2 duration-200">
              <FormSelect 
                label="System Language" 
                icon={Globe} 
                value={editedSettings?.language || "en"} 
                onChange={(v) => handleSettingChange({ language: v })} 
                options={["en", "es", "fr", "de"]} 
                labels={["English (United States)", "Español", "Français", "Deutsch"]} 
              />
              
              <FormSelect 
                label="Local Timezone" 
                icon={Sliders} 
                value={editedSettings?.timezone || "UTC"} 
                onChange={(v) => handleSettingChange({ timezone: v })} 
                options={["UTC", "IST", "PST", "EST", "GMT", "AEST"]} 
                labels={["UTC (Universal Standard)", "IST (India Standard Time)", "PST (Pacific Standard Time)", "EST (Eastern Standard Time)", "GMT (Greenwich Mean Time)", "AEST (Australian Eastern)"]} 
              />
            </div>
          )}

          {/* TAB 2: NOTIFICATIONS */}
          {activeTab === "notifications" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1 text-left">Alert Channels</p>
              <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
                <SwitchRow 
                  title="Email Notifications" 
                  desc="Receive summaries of applications, interviews, and candidate actions in your inbox." 
                  icon={Mail} 
                  active={editedSettings?.email_notifications || false} 
                  onToggle={(val) => handleSettingChange({ email_notifications: val })} 
                />
                <SwitchRow 
                  title="Web Dashboard Alerts" 
                  desc="Real-time alert indicators directly within your dashboard header." 
                  icon={Globe} 
                  active={editedSettings?.web_notifications || false} 
                  onToggle={(val) => handleSettingChange({ web_notifications: val })} 
                />
                <SwitchRow 
                  title="Mobile Push Notifications" 
                  desc="Instant notifications pushed directly to your registered mobile device." 
                  icon={Smartphone} 
                  active={editedSettings?.mobile_notifications || false} 
                  onToggle={(val) => handleSettingChange({ mobile_notifications: val })} 
                />
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY & VISIBILITY */}
          {activeTab === "privacy" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 ml-1 text-left">Audience Settings</p>
              <div className="bg-white border border-slate-200/60 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.015)]">
                <SwitchRow 
                  title="Public Profile Visibility" 
                  desc="Control whether candidate recommendations can lookup and display your recruiter profile details." 
                  icon={User} 
                  active={editedSettings?.profile_visibility === "public"} 
                  onToggle={(val) => handleSettingChange({ profile_visibility: val ? "public" : "private" })} 
                />

                <SwitchRow 
                  title="Ghost Mode (Incognito Browsing)" 
                  desc="Browse and analyze talent profiles anonymously without leaving view records on candidate dashboards." 
                  icon={EyeOff} 
                  active={editedSettings?.ghost_mode || false} 
                  onToggle={(val) => handleSettingChange({ ghost_mode: val })} 
                />
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY & IDENTITY */}
          {activeTab === "security" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="max-w-md">
                <CircularScore score={profile?.profile_score ?? 75} label="Organization Score" />
              </div>
              
              {/* Password Change Form */}
              <form onSubmit={handleUpdatePassword} className="rounded-2xl border border-slate-200/80 bg-[#FAFBFC] p-5 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-200/60 pb-2 text-left">
                  <Lock className="h-4 w-4 text-[#FF8A00]" />
                  Change Account Password
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <FormInput label="Current Password" type={showOldPassword ? "text" : "password"} value={oldPassword} onChange={setOldPassword} />
                    <button 
                      type="button" 
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3.5 top-[2.2rem] text-slate-400 hover:text-[#FF8A00]"
                    >
                      {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="relative">
                    <FormInput label="New Password" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={setNewPassword} />
                    <button 
                      type="button" 
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-[2.2rem] text-slate-400 hover:text-[#FF8A00]"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <FormInput label="Confirm New Password" type={showNewPassword ? "text" : "password"} value={confirmPassword} onChange={setConfirmPassword} />
                  <button
                    type="submit"
                    disabled={saving || !oldPassword || !newPassword || newPassword !== confirmPassword}
                    className="bg-[#FF8A00] hover:bg-[#E67A00] text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 h-9.5 shadow-sm active:scale-[0.98]"
                  >
                    {saving ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>

              {/* Identity Verification */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 text-left">
                  <Shield className="h-4 w-4 text-[#FF8A00]" />
                  Identity Partner Verification
                </h3>
                <div className="flex flex-col md:flex-row items-center gap-4 bg-[#FAFBFC] rounded-xl p-4 border border-slate-100 text-left">
                  <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-orange-100">
                    <Shield className="h-5 w-5 text-[#FF8A00]" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h4 className="text-xs font-bold text-slate-800">Govt ID Verification Check</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-normal">Upload a passport or national ID. Verified partners enjoy full discovery tier privileges.</p>
                  </div>
                  <label className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap border ${
                    profile?.identity_verified 
                      ? "bg-emerald-50 border-emerald-100 text-emerald-600 pointer-events-none" 
                      : "bg-[#FF8A00] hover:bg-[#E67A00] text-white border-[#FF8A00]"
                  }`}>
                    {profile?.identity_verified ? "Verified ✓" : "Upload ID File"}
                    {!profile?.identity_verified && (
                      <input type="file" ref={idInputRef} onChange={handleIDUpload} className="hidden" accept="image/*,application/pdf" />
                    )}
                  </label>
                </div>
              </div>

              {/* Danger Zone Account Deletion */}
              <div className="rounded-2xl border border-rose-100 bg-rose-50/20 p-5 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)] text-left">
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-600 flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Danger Zone
                </h3>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="space-y-0.5 text-left">
                    <h4 className="text-xs font-bold text-slate-800">Permanently Delete Account</h4>
                    <p className="text-[10px] text-slate-400 leading-normal">Once deleted, your recruiter data, company profiles, and listings are gone forever.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={saving}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
                  >
                    Delete Account
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: TEAM MANAGEMENT */}
          {activeTab === "team" && profile?.team_role === "admin" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200 text-left">
              {/* Organization Glass Header */}
              <div className="relative overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] rounded-2xl p-5 border border-slate-800 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/[0.03]" />
                <div className="absolute bottom-0 right-12 h-20 w-20 rounded-full bg-[#FF8A00]/10" />
                <div className="relative z-10 flex-1">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.15em] mb-1">Your Organization</p>
                  <h3 className="text-base font-bold text-white tracking-tight">{profile?.full_name ? `${profile.full_name}'s Org` : "Company"}</h3>
                  <p className="text-[11px] text-white/40 mt-1">{team.length} team member{team.length !== 1 ? "s" : ""}</p>
                </div>
                <button 
                  onClick={() => setIsInviteModalOpen(true)} 
                  className="relative z-10 flex items-center gap-1.5 px-4.5 py-2.5 bg-[#FF8A00] hover:bg-[#e67a00] text-white rounded-xl text-xs font-bold transition-all hover:shadow-lg hover:shadow-orange-500/10 active:scale-[0.97] shrink-0"
                >
                  <UserPlus className="h-4 w-4" strokeWidth={2.2} />Invite Member
                </button>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/60 flex items-center justify-center shrink-0">
                    <Users className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-base font-black text-[#0F172A] leading-none tracking-tight">{team.length}</p>
                    <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Total Members</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-100/60 flex items-center justify-center shrink-0">
                    <Crown className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-base font-black text-[#0F172A] leading-none tracking-tight">{team.filter(m => m.is_admin).length}</p>
                    <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Administrators</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-sm flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/60 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-base font-black text-[#0F172A] leading-none tracking-tight">
                      {team.filter(m => m.assessment_status === "completed" || m.assessment_status === "COMPLETED").length}
                    </p>
                    <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">Verified</p>
                  </div>
                </div>
              </div>

              {/* Members List Box */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden">
                {/* List Header */}
                <div className="flex items-center px-4.5 py-3 border-b border-slate-100/80 bg-slate-50/50">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member</span>
                  </div>
                  <div className="w-[100px] text-center hidden sm:block">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</span>
                  </div>
                  <div className="w-[100px] text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
                  </div>
                  <div className="w-[50px] text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</span>
                  </div>
                </div>

                {/* List Body */}
                <div className="divide-y divide-slate-100">
                  {teamLoading ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-[#FF8A00]" />
                      <p className="text-xs font-semibold text-slate-455 uppercase tracking-wider">Loading team members...</p>
                    </div>
                  ) : team.length === 0 ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center">
                      <Users className="h-8 w-8 text-slate-300 mb-3" strokeWidth={1.5} />
                      <p className="text-xs font-bold text-[#0F172A]">No team members yet</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-[240px]">Invite your first recruiter member to start building your organization.</p>
                    </div>
                  ) : (
                    team.map((member) => (
                      <div key={member.user_id} className="flex items-center px-4.5 py-3.5 hover:bg-[#FAFBFC] transition-colors relative group">
                        {/* Member Details */}
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FFF3E8] to-[#FFE3BF] text-[#FF8A00] flex items-center justify-center text-[13px] font-bold border border-orange-100/30">
                              {(member.full_name || member.users?.email || "C")[0].toUpperCase()}
                            </div>
                            {member.is_admin && (
                              <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 p-0.5 rounded-full ring-2 ring-white">
                                <Crown className="h-2 w-2 text-white" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-bold text-[#0F172A] truncate leading-tight">{member.full_name || "Team Member"}</p>
                            <p className="text-[10.5px] text-slate-400 truncate mt-0.5">{member.users?.email || "Pending registration"}</p>
                          </div>
                        </div>

                        {/* Role (Desktop only) */}
                        <div className="w-[100px] flex justify-center hidden sm:flex shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider ${
                            member.is_admin ? "bg-amber-50 text-amber-600 border border-amber-100" : "bg-slate-50 text-slate-500 border border-slate-200"
                          }`}>
                            {member.is_admin ? "Admin" : "Recruiter"}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="w-[100px] flex justify-center shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9.5px] font-bold uppercase tracking-wider ${
                            member.assessment_status === "completed" || member.assessment_status === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
                              : "bg-orange-50 text-orange-500 border border-orange-100/50"
                          }`}>
                            {member.assessment_status === "completed" || member.assessment_status === "COMPLETED" ? "Verified" : "Pending"}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="w-[50px] flex justify-center shrink-0 relative">
                          {profile?.team_role === "admin" && member.user_id !== profile.user_id ? (
                            <>
                              <button
                                onClick={() => setOpenMenuId(openMenuId === member.user_id ? null : member.user_id)}
                                disabled={actioningId === member.user_id}
                                className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                              >
                                {actioningId === member.user_id ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4 text-slate-450" />
                                )}
                              </button>
                              {openMenuId === member.user_id && (
                                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                                  <button
                                    onClick={() => handlePromote(member)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-slate-650 hover:bg-slate-50 transition-colors text-left"
                                  >
                                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                                    {member.is_admin ? "Demote to Recruiter" : "Promote to Admin"}
                                  </button>
                                  <div className="mx-2 border-t border-slate-100" />
                                  <button
                                    onClick={() => handleRemove(member.user_id, member.full_name || member.users?.email || "Member")}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-semibold text-rose-500 hover:bg-rose-50 transition-colors text-left"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                    Remove Member
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-350 font-bold uppercase tracking-wider">{member.user_id === profile?.user_id ? "You" : "—"}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Floating save changes footer */}
        {isDirty && (activeTab === "preferences" || activeTab === "notifications" || activeTab === "privacy") && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between animate-in slide-in-from-bottom duration-200 flex-shrink-0">
            <span className="text-xs font-semibold text-slate-500">You have unsaved changes</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDiscardSettings}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all active:scale-95"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={saving}
                className="rounded-xl bg-[#FF8A00] hover:bg-[#E67A00] text-white px-5 py-2 text-xs font-bold transition-all disabled:opacity-50 active:scale-95 shadow-sm shadow-orange-100 flex items-center gap-1.5"
              >
                {saving && <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Save Changes
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Invite Modal Overlay ── */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setIsInviteModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200/60 overflow-hidden text-left" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-[15px] font-bold text-[#0F172A] tracking-tight">Invite Team Member</h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Send an email invitation to join your talent workspace</p>
                </div>
                <button onClick={() => setIsInviteModalOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="h-4 w-4 text-slate-450" />
                </button>
              </div>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-5">
              <div>
                <label className="block text-[10.5px] font-bold uppercase tracking-widest text-slate-455 mb-2 ml-1">Professional Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="recruiter@company.com"
                    className="w-full bg-slate-50/50 border border-slate-200/80 rounded-xl pl-11 pr-4 py-2.5 text-[13.5px] font-medium text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/10 focus:border-[#FF8A00] transition-all"
                  />
                </div>
              </div>

              <div className="bg-[#FFF6ED] rounded-xl p-4 border border-orange-100/50 flex gap-3">
                <ShieldCheck className="h-4 w-4 text-[#FF8A00] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11.5px] font-bold text-[#0F172A]">Standard Recruiter Privileges</p>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed mt-0.5">
                    Members can manage jobs, review pipeline applications, and conduct assessments. Only team administrators can manage workspace members.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="w-full py-3 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-[13px] font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send Workspace Invitation <ChevronRight className="h-3.5 w-3.5" /></>}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function RecruiterSettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00]" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Loading settings...</p>
        </div>
      </div>
    }>
      <RecruiterSettingsContent />
    </Suspense>
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

function FormInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1.5 w-full">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3.5 py-2 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/10"
      />
    </div>
  );
}

function FormSelect({ label, icon: Icon, value, onChange, options, labels }: { label: string; icon: any; value: string; onChange: (v: string) => void; options: string[]; labels: string[] }) {
  return (
    <div className="space-y-2 w-full text-left">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 ml-1">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/10"
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

function SwitchRow({ title, desc, icon: Icon, active, onToggle }: { title: string; desc: string; icon: any; active: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white hover:bg-slate-50/50 transition-all duration-200 group text-left">
      <div className="flex items-start gap-3.5 pr-4 min-w-0">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 transition-colors ${active ? "text-[#FF8A00]" : "text-slate-400 group-hover:text-slate-500"}`} />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800 leading-snug">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
        </div>
      </div>
      
      {/* Sleek switch toggle */}
      <button
        type="button"
        onClick={() => onToggle(!active)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          active ? "bg-[#FF8A00]" : "bg-slate-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            active ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
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
