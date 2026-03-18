"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  ShieldCheck,
  UserPlus,
  BadgeCheck,
  UserMinus,
  Mail,
  X,
  Loader2,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

interface TeamMember {
  user_id: string;
  full_name?: string;
  job_title?: string;
  is_admin: boolean;
  assessment_status: string;
  created_at: string;
  users: {
    email: string;
  };
}

export default function TeamManagementPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{
    user_id?: string;
    is_admin?: boolean;
    companies?: { name: string };
  } | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadTeamData = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const profileData = await apiClient.get(
        "/recruiter/profile",
        token,
      );
      setProfile(profileData);

      const teamData = await apiClient.get(
        "/recruiter/team",
        token,
      );
      setTeam(teamData || []);
    } catch (err) {
      console.error("Failed to load team:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        "/recruiter/invite",
        { email: inviteEmail },
        token,
      );
      setIsInviteModalOpen(false);
      setInviteEmail("");
      alert("Invitation sent successfully!");
    } catch (err) {
      console.error("Invite failed:", err);
      alert("Failed to send invitation. Make sure you are an admin.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (
      !confirm(
        "Are you sure you want to remove this team member? They will lose access to the company dashboard.",
      )
    )
      return;

    setActioningId(memberId);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.delete(
        `/recruiter/team/${memberId}`,
        token,
      );
      setTeam((prev) => prev.filter((m) => m.user_id !== memberId));
    } catch (err) {
      console.error("Remove failed:", err);
      alert("Failed to remove member. Make sure you are an admin.");
    } finally {
      setActioningId(null);
    }
  };

  const handlePromote = async (member: TeamMember) => {
    const action = member.is_admin ? "demote" : "promote";
    if (
      !confirm(
        `Are you sure you want to ${action} ${member.full_name || member.users.email}?`,
      )
    )
      return;

    setActioningId(member.user_id);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.patch(
        `/recruiter/team/${member.user_id}/role`,
        { is_admin: !member.is_admin },
        token,
      );
      setTeam((prev) =>
        prev.map((m) =>
          m.user_id === member.user_id ? { ...m, is_admin: !m.is_admin } : m,
        ),
      );
    } catch (err) {
      console.error("Role change failed:", err);
      alert("Failed to change role.");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <main className="p-12 overflow-y-auto">
        <header className="mb-12 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-semibold mb-2">
              <Users className="h-5 w-5" />
              <span>Organization</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Team Management
            </h1>
            <p className="text-slate-500 mt-2 text-lg">
              Manage recruiters and hiring permissions for{" "}
              {profile?.companies?.name || "your company"}.
            </p>
          </div>

          {profile?.is_admin && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-100 active:scale-95"
            >
              <UserPlus className="h-5 w-5" />
              Invite Recruiter
            </button>
          )}
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {team.map((member) => (
              <div
                key={member.user_id}
                className="group relative bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 hover:-translate-y-1"
              >
                {/* Visual Accent */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-12 bg-blue-600/10 rounded-b-full group-hover:w-20 group-hover:bg-blue-600/30 transition-all duration-500" />

                <div className="flex flex-col items-center text-center pt-4">
                  {/* Avatar Section */}
                  <div className="relative mb-4">
                    <div className="h-20 w-20 rounded-[1.8rem] bg-slate-50 flex items-center justify-center text-2xl font-black text-slate-300 border-2 border-slate-100 shadow-inner group-hover:border-blue-100 group-hover:bg-blue-50/30 transition-all duration-500">
                      {member.full_name?.charAt(0) ||
                        member.users.email.charAt(0).toUpperCase()}
                    </div>
                    {member.is_admin && (
                      <div className="absolute -top-1 -right-1 bg-white p-1.5 rounded-xl shadow-md border border-slate-50 group-hover:scale-110 transition-transform">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                      </div>
                    )}
                  </div>

                  {/* Identity */}
                  <div className="space-y-1 mb-6">
                    <h3 className="font-black text-slate-900 tracking-tight text-lg group-hover:text-blue-600 transition-colors">
                      {member.full_name || "Nexus Recruiter"}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {member.job_title || "Strategic Talent Partner"}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400 pt-1">
                      <Mail size={12} className="opacity-50" />
                      {member.users.email}
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-wrap justify-center gap-2 mb-8">
                    <span
                      className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                        member.is_admin
                          ? "bg-blue-50 text-blue-600 border-blue-100"
                          : "bg-slate-50 text-slate-500 border-slate-100"
                      }`}
                    >
                      {member.is_admin ? "Admin" : "Recruiter"}
                    </span>
                    <span
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${
                        member.assessment_status === "completed"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : "bg-amber-50 text-amber-600 border-amber-100"
                      }`}
                    >
                      <BadgeCheck size={10} />
                      {member.assessment_status?.split("_")[0] || "Pending"}
                    </span>
                  </div>

                  {/* Action Bar */}
                  {profile?.is_admin && member.user_id !== profile.user_id && (
                    <div className="w-full flex items-center justify-center gap-2 pt-6 border-t border-slate-50">
                      <button
                        onClick={() => handlePromote(member)}
                        disabled={actioningId === member.user_id}
                        className="flex-1 py-3 px-4 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-[1.2rem] text-[9px] font-black uppercase tracking-widest text-slate-500 transition-all border border-slate-100 flex items-center justify-center gap-2 group/btn"
                      >
                        <ShieldCheck
                          size={14}
                          className="group-hover/btn:scale-110 transition-transform"
                        />
                        {member.is_admin ? "Demote" : "Promote"}
                      </button>
                      <button
                        onClick={() => handleRemove(member.user_id)}
                        disabled={actioningId === member.user_id}
                        className="p-3 bg-slate-50 hover:bg-rose-500 hover:text-white rounded-[1.2rem] text-slate-400 transition-all border border-slate-100"
                      >
                        {actioningId === member.user_id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <UserMinus size={18} />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Decorative Elements */}
                <div className="absolute bottom-4 right-6 text-[8px] font-black text-slate-200 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                  ID: {member.user_id.split("-")[0]}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-4xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 fill-mode-both">
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Invite Team Member
                  </h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Send an invitation to join your company team.
                  </p>
                </div>
                <button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Professional Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                    />
                  </div>
                </div>

                <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                  <div className="flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-blue-900 mb-1">
                        Standard Recruiter Role
                      </p>
                      <p className="text-xs text-blue-700/80 leading-relaxed">
                        Invited members can post jobs, manage applications, and
                        interview candidates. Only you can manage team members.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={inviting}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {inviting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Send Invitation"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
