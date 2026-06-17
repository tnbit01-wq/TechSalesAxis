"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  ShieldCheck,
  UserPlus,
  UserMinus,
  Mail,
  X,
  Loader2,
  Crown,
  Clock,
  CheckCircle,
  MoreHorizontal,
  ChevronRight,
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
  users: { email: string };
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadTeamData = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) { router.replace("/login"); return; }
      const [profileData, teamData] = await Promise.all([
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/team", token).catch(() => []),
      ]);
      setProfile(profileData);
      setTeam(teamData || []);
    } catch (err) {
      console.error("Failed to load team:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadTeamData(); }, [loadTeamData]);

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
      loadTeamData();
    } catch (err) {
      console.error("Invite failed:", err);
      alert("Failed to send invitation. Make sure you are an admin.");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this team member? They will lose access to the company dashboard.")) return;
    setActioningId(memberId);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.delete(`/recruiter/team/${memberId}`, token);
      setTeam((prev) => prev.filter((m) => m.user_id !== memberId));
    } catch (err) {
      console.error("Remove failed:", err);
      alert("Failed to remove member.");
    } finally {
      setActioningId(null);
      setOpenMenuId(null);
    }
  };

  const handlePromote = async (member: TeamMember) => {
    const action = member.is_admin ? "demote" : "promote";
    if (!confirm(`Are you sure you want to ${action} ${member.full_name || member.users.email}?`)) return;
    setActioningId(member.user_id);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.patch(`/recruiter/team/${member.user_id}/role`, { is_admin: !member.is_admin }, token);
      setTeam((prev) => prev.map((m) => m.user_id === member.user_id ? { ...m, is_admin: !m.is_admin } : m));
    } catch (err) {
      console.error("Role change failed:", err);
      alert("Failed to change role.");
    } finally {
      setActioningId(null);
      setOpenMenuId(null);
    }
  };

  const admins = team.filter(m => m.is_admin);
  const members = team.filter(m => !m.is_admin);

  if (loading) return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00] animate-spin" />
        <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Loading team…</p>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] bg-[#F8F9FC] overflow-hidden">
      <div className="h-full p-5 flex flex-col gap-4">
        {/* ── TOP: Stats Strip ── */}
        <div className="flex gap-4 flex-shrink-0">
          {/* Company card */}
          <div className="relative overflow-hidden bg-gradient-to-r from-[#0F172A] via-[#1a2744] to-[#1E293B] rounded-2xl px-6 py-4 flex items-center gap-6 min-w-[300px] shadow-[0_4px_20px_rgba(15,23,42,0.2)]">
            <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/[0.03]" />
            <div className="absolute bottom-0 right-12 h-20 w-20 rounded-full bg-[#FF8A00]/10" />
            <div className="relative z-10 flex-1">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] mb-0.5">Your Organization</p>
              <h1 className="text-lg font-bold text-white tracking-tight">{profile?.companies?.name || "Company"}</h1>
              <p className="text-[11px] text-white/40 mt-0.5">{team.length} team member{team.length !== 1 ? "s" : ""}</p>
            </div>
            {profile?.is_admin && (
              <button onClick={() => setIsInviteModalOpen(true)} className="relative z-10 flex items-center gap-1.5 px-4 py-2 bg-[#FF8A00] hover:bg-[#e67a00] text-white rounded-xl text-[11px] font-bold transition-all active:scale-95 shadow-lg shadow-orange-900/25">
                <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} />Invite
              </button>
            )}
          </div>
          {/* KPI cards */}
          <div className="flex-1 grid grid-cols-3 gap-3">
            <StatCard icon={Users} value={team.length} label="Total Members" accent="blue" />
            <StatCard icon={Crown} value={admins.length} label="Administrators" accent="amber" />
            <StatCard icon={CheckCircle} value={team.filter(m => m.assessment_status === "completed" || m.assessment_status === "COMPLETED").length} label="Verified" accent="emerald" />
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center px-6 py-3.5 border-b border-slate-100/80 bg-slate-50/50 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member</span>
            </div>
            <div className="w-[140px] text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</span>
            </div>
            <div className="w-[120px] text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
            </div>
            <div className="w-[100px] text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Joined</span>
            </div>
            {profile?.is_admin && (
              <div className="w-[60px] text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</span>
              </div>
            )}
          </div>
          {/* Table Body */}
          <div className="flex-1 overflow-y-auto dashboard-scroll">
            {team.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50 flex items-center justify-center mb-3">
                  <Users className="h-6 w-6 text-slate-300" strokeWidth={1.5} />
                </div>
                <p className="text-[14px] font-bold text-[#0F172A]">No team members yet</p>
                <p className="text-[12px] text-slate-400 mt-1 max-w-[280px] text-center">Invite your first team member to start building your recruitment team.</p>
                {profile?.is_admin && (
                  <button onClick={() => setIsInviteModalOpen(true)} className="mt-4 px-5 py-2 bg-[#FF8A00] text-white rounded-xl text-[12px] font-semibold hover:bg-[#E67A00] transition-all shadow-sm">
                    Invite Member
                  </button>
                )}
              </div>
            ) : (
              team.map((member, i) => (
                <div key={member.user_id} className={`flex items-center px-6 py-4 hover:bg-[#FAFBFC] transition-all group ${i < team.length - 1 ? "border-b border-slate-100/70" : ""}`}>
                  {/* Member Info */}
                  <div className="flex-1 min-w-0 flex items-center gap-3.5">
                    <div className="relative flex-shrink-0">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#FF8A00]/10 to-[#FF8A00]/5 flex items-center justify-center text-[14px] font-bold text-[#FF8A00] ring-1 ring-[#FF8A00]/10">
                        {(member.full_name || member.users.email)[0].toUpperCase()}
                      </div>
                      {member.is_admin && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-amber-500 p-0.5 rounded-full ring-2 ring-white">
                          <Crown className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0F172A] truncate">{member.full_name || "Team Member"}</p>
                      <p className="text-[11px] text-slate-400 truncate">{member.users.email}</p>
                    </div>
                  </div>
                  {/* Role */}
                  <div className="w-[140px] flex justify-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg ring-1 ${
                      member.is_admin 
                        ? "bg-amber-50 text-amber-600 ring-amber-100" 
                        : "bg-slate-50 text-slate-500 ring-slate-200"
                    }`}>
                      {member.is_admin ? <><Crown className="h-2.5 w-2.5" />Admin</> : "Recruiter"}
                    </span>
                  </div>
                  {/* Status */}
                  <div className="w-[120px] flex justify-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-lg ring-1 ${
                      member.assessment_status === "completed" || member.assessment_status === "COMPLETED"
                        ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                        : "bg-orange-50 text-orange-500 ring-orange-100"
                    }`}>
                      {member.assessment_status === "completed" || member.assessment_status === "COMPLETED"
                        ? <><CheckCircle className="h-2.5 w-2.5" />Verified</>
                        : <><Clock className="h-2.5 w-2.5" />Pending</>
                      }
                    </span>
                  </div>
                  {/* Joined */}
                  <div className="w-[100px] text-center">
                    <p className="text-[11px] text-slate-400 font-medium">
                      {member.created_at ? new Date(member.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </p>
                  </div>
                  {/* Actions */}
                  {profile?.is_admin && member.user_id !== profile.user_id && (
                    <div className="w-[60px] flex justify-center relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === member.user_id ? null : member.user_id)}
                        disabled={actioningId === member.user_id}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                      >
                        {actioningId === member.user_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                      {openMenuId === member.user_id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                          <button
                            onClick={() => handlePromote(member)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                            {member.is_admin ? "Demote to Recruiter" : "Promote to Admin"}
                          </button>
                          <div className="mx-3 border-t border-slate-100" />
                          <button
                            onClick={() => handleRemove(member.user_id)}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Remove Member
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {profile?.is_admin && member.user_id === profile.user_id && (
                    <div className="w-[60px] flex justify-center">
                      <span className="text-[10px] text-slate-300 font-medium">You</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Invite Modal ── */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setIsInviteModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-slate-200/60 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-slate-100">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-[16px] font-bold text-[#0F172A] tracking-tight">Invite Team Member</h2>
                  <p className="text-[12px] text-slate-400 mt-0.5">They'll receive an email invitation to join your team</p>
                </div>
                <button onClick={() => setIsInviteModalOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-2">Professional Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-[#F8F9FC] border border-slate-200/80 rounded-xl pl-11 pr-4 py-3 text-[13px] font-medium text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00]/50 transition-all"
                  />
                </div>
              </div>

              <div className="bg-[#FFF6ED] rounded-xl p-4 border border-orange-100/80">
                <div className="flex gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-[#FF8A00] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-[#0F172A] mb-0.5">Standard Recruiter Role</p>
                    <p className="text-[10.5px] text-slate-500 leading-relaxed">
                      Invited members can post jobs, manage applications, and interview candidates. Only admins can manage team members.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="w-full py-3 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-[13px] font-bold transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send Invitation <ChevronRight className="h-3.5 w-3.5" /></>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, value, label, accent }: { icon: React.ElementType; value: number; label: string; accent: string }) {
  const c: Record<string, { bg: string; ic: string; ring: string }> = {
    blue: { bg: "bg-blue-50", ic: "text-blue-500", ring: "ring-blue-100" },
    amber: { bg: "bg-amber-50", ic: "text-amber-500", ring: "ring-amber-100" },
    emerald: { bg: "bg-emerald-50", ic: "text-emerald-500", ring: "ring-emerald-100" },
  };
  const s = c[accent] || c.blue;
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] hover:-translate-y-px transition-all duration-200 flex flex-col justify-between">
      <div className={`h-9 w-9 rounded-xl ${s.bg} ${s.ic} ring-1 ${s.ring} flex items-center justify-center mb-2`}>
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <p className="text-[24px] font-extrabold text-[#0F172A] leading-none tracking-tight">{value}</p>
      <p className="text-[11px] font-medium text-slate-400 mt-1">{label}</p>
    </div>
  );
}
