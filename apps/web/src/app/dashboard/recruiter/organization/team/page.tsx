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
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Team <span className="text-blue-600">Management</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage your team members and permissions
            </p>
          </div>

          {profile?.is_admin && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-all shadow-md shadow-blue-200 active:scale-95 flex items-center gap-2 w-fit"
            >
              <UserPlus className="h-4 w-4" />
              Invite Member
            </button>
          )}
        </header>

        {/* Team Members Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="text-slate-500 text-sm">Loading team...</p>
            </div>
          </div>
        ) : team.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member) => (
              <div
                key={member.user_id}
                className="group relative bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
              >
                <div className="flex flex-col items-center text-center">
                  {/* Avatar */}
                  <div className="relative mb-4">
                    <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-xl font-bold text-blue-600 shadow-sm group-hover:bg-blue-100 transition-all">
                      {member.full_name?.charAt(0) ||
                        member.users.email.charAt(0).toUpperCase()}
                    </div>
                    {member.is_admin && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-600 p-1 rounded-full shadow-md">
                        <ShieldCheck className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Name & Email */}
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      {member.full_name || "Team Member"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {member.users.email}
                    </p>
                  </div>

                  {/* Badges */}
                  <div className="flex gap-2 justify-center mb-4 flex-wrap">
                    {member.is_admin && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-md">
                        Admin
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                      member.assessment_status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {member.assessment_status === "completed" ? "Verified" : "Pending"}
                    </span>
                  </div>

                </div>

                {/* Actions - shown if admin and not self */}
                {profile?.is_admin && member.user_id !== profile.user_id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2 w-full">
                    <button
                      onClick={() => handlePromote(member)}
                      disabled={actioningId === member.user_id}
                      className="flex-1 px-3 py-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {actioningId === member.user_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ShieldCheck size={12} />
                      )}
                      {member.is_admin ? "Demote" : "Promote"}
                    </button>
                    <button
                      onClick={() => handleRemove(member.user_id)}
                      disabled={actioningId === member.user_id}
                      className="px-3 py-2 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-medium transition-all disabled:opacity-50 flex items-center justify-center"
                      title="Remove member"
                    >
                      {actioningId === member.user_id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <UserMinus size={14} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 bg-slate-50 rounded-2xl">
            <div className="text-center">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No team members yet</p>
              <p className="text-slate-400 text-sm mt-1">Invite your first team member to get started</p>
            </div>
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

