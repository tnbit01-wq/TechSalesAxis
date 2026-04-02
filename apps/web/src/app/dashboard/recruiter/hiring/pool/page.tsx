"use client";

import { useEffect, useState, useCallback } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  LogOut,
  ChevronRight,
  CheckCircle2,
  User,
  Users,
  MapPin,
  Briefcase,
  Star,
  Plus,
  MessageSquare,
} from "lucide-react";
import LockedView from "@/components/dashboard/LockedView";
import CandidateProfileModal from "@/components/CandidateProfileModal";
import JobInviteModal from "@/components/JobInviteModal";
import { toast } from "sonner";

interface Candidate {
  user_id: string;
  full_name: string;
  current_role: string;
  experience: "fresher" | "mid" | "senior" | "leadership";
  years_of_experience: number;
  profile_strength: string;
  identity_verified: boolean;
  trust_score: number;
  assessment_status: string;
  skills: string[];
  profile_photo_url?: string;
  resume_path?: string;
}

interface RecruiterProfile {
  assessment_status: string;
  companies: {
    profile_score: number;
  };
}

export default function CandidatePoolPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recruiterProfile, setRecruiterProfile] =
    useState<RecruiterProfile | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [filterExperience, setFilterExperience] = useState<string>("all");
  const [profileModal, setProfileModal] = useState<{
    isOpen: boolean;
    candidate: Candidate | null;
    initialTab?: string;
  }>({
    isOpen: false,
    candidate: null,
    initialTab: "resume",
  });
  const [inviteModal, setInviteModal] = useState<{
    isOpen: boolean;
    candidate: Candidate | null;
  }>({
    isOpen: false,
    candidate: null,
  });

  const handleLogout = async () => {
    await awsAuth.logout();
    router.replace("/login");
  };

  const fetchPool = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const [poolData, profileData, jobsData] = await Promise.all([
        apiClient.get("/recruiter/candidate-pool", token),
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/jobs", token),
      ]);
      setCandidates(poolData || []);
      setRecruiterProfile(profileData);
      setJobs(jobsData || []);
      setError(null);
    } catch (err: unknown) {
      console.error("Failed to fetch candidate pool:", err);
      setError("Failed to sync with TechSales Axis servers");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPool();

    const interval = setInterval(() => {
      fetchPool();
    }, 60000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchPool]);

  const handleInviteCandidate = async (
    jobId: string,
    message: string,
    customTitle?: string,
  ) => {
    if (!inviteModal.candidate) return;

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        `/recruiter/candidate/${inviteModal.candidate.user_id}/invite`,
        {
          job_id: jobId,
          message: message,
          custom_role_title: customTitle,
        },
        token,
      );

      toast.success(
        `Elite Invite sent to ${inviteModal.candidate.full_name}. You can now message them.`,
      );
      setInviteModal({ isOpen: false, candidate: null });
    } catch (err: any) {
      console.error("Failed to invite candidate:", err);
      toast.error(
        err.message || "Candidate already applied or invited to this job",
      );
    }
  };

  const handleStartChat = async (candidate: Candidate) => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        toast.error("Please login to message candidates");
        return;
      }

      const response = await apiClient.post(
        "/chat/thread",
        { candidate_id: candidate.user_id },
        token
      );

      if (response && response.id) {
        router.push(`/dashboard/recruiter/messages`);
      }
    } catch (err: any) {
      console.error("Chat creation failed:", err);
      if (err.status === 403) {
        toast.error("DNA Gate: Candidate must have Psychometric Score >= 50% for direct messaging.");
      } else {
        toast.error(err.message || "Could not initiate chat link.");
      }
    }
  };

  const trackProfileView = async (candidateId: string) => {
    try {
      console.log("[TRACKING] Starting profile view tracking for:", candidateId);
      const token = awsAuth.getToken();
      console.log("[TRACKING] Token exists:", !!token);
      if (!token) {
        console.log("[TRACKING] No token, skipping");
        return;
      }
      console.log("[TRACKING] Sending POST to /analytics/profile/" + candidateId + "/view");
      const response = await apiClient.post(
        `/analytics/profile/${candidateId}/view`,
        {},
        token,
      );
      console.log("[TRACKING] ✓ Profile view tracked:", candidateId);
      console.log("[TRACKING] Response:", response);
    } catch (err: any) {
      console.error("[TRACKING] ✗ Failed to track profile view:", candidateId);
      console.error("[TRACKING] Error details:", err);
    }
  };

  const handleViewProfile = async (
    candidate: Candidate,
    tab: string = "resume",
  ) => {
    // Track profile view
    await trackProfileView(candidate.user_id);
    
    setIsFetchingProfile(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const [fullCandidate, interviewData] = await Promise.all([
        apiClient.get(`/recruiter/candidate/${candidate.user_id}`, token),
        apiClient.get("/interviews/my", token)
      ]);

      setProfileModal({
        isOpen: true,
        candidate: { 
          ...candidate, 
          ...fullCandidate, 
          interviews: interviewData.filter((i: any) => i.candidate_id === candidate.user_id) 
        },
        initialTab: tab,
      });
    } catch (err) {
      console.error("Failed to fetch full candidate details:", err);
      toast.error("Deep Link Error: Could not hydrate profile data");
    } finally {
      setIsFetchingProfile(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      (c.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.current_role || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.skills?.some((s) =>
        (s || "").toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesFilter =
      filterExperience === "all" || c.experience === filterExperience;
    return matchesSearch && matchesFilter;
  });

  const bands = {
    leadership: filteredCandidates.filter((c) => c.experience === "leadership"),
    senior: filteredCandidates.filter((c) => c.experience === "senior"),
    mid: filteredCandidates.filter((c) => c.experience === "mid"),
    fresher: filteredCandidates.filter((c) => c.experience === "fresher"),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-xl">
            <div className="h-8 w-8 rounded-full border-4 border-slate-900 border-t-transparent animate-spin" />
          </div>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">
            Establishing Secure Link...
          </p>
        </div>
      </div>
    );
  }

  const isLocked = (recruiterProfile?.companies?.profile_score ?? 0) === 0;

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 py-12">
        {isLocked ? (
          <LockedView featureName="Candidate Pool" />
        ) : (
          <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  Talent <span className="text-primary">Pool</span>
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Browse and manage all candidates in your database
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all text-sm font-medium flex items-center gap-2 w-fit"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </header>

            {/* Search & Filters */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-8">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name, role, skills..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 pl-11 pr-4 py-2.5 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div className="flex gap-3 flex-wrap">
                  {["all", "fresher", "mid", "senior", "leadership"].map((band) => (
                    <button
                      key={band}
                      onClick={() => setFilterExperience(band)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        filterExperience === band
                          ? "bg-primary text-white shadow-md shadow-primary-light"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {band === "all" ? "All Levels" : band.charAt(0).toUpperCase() + band.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Results */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm">Loading candidates...</p>
                </div>
              </div>
            ) : filteredCandidates.length > 0 ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    Showing <span className="font-semibold text-slate-900">{filteredCandidates.length}</span> candidate{filteredCandidates.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCandidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.user_id}
                      candidate={candidate}
                      onViewProfile={() =>
                        handleViewProfile(candidate, "resume")
                      }
                      onViewResume={() =>
                        handleViewProfile(
                          candidate,
                          candidate.resume_path
                            ? "original_resume"
                            : "resume",
                        )
                      }
                      onInvite={() =>
                        setInviteModal({ isOpen: true, candidate })
                      }
                      onMessage={() => handleStartChat(candidate)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-20 bg-slate-50 rounded-3xl">
                <div className="text-center">
                  <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No candidates found</p>
                  <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              </div>
            )}
          </>
        )}

        {profileModal.isOpen && profileModal.candidate && (
          <CandidateProfileModal
            isOpen={profileModal.isOpen}
            onClose={() => setProfileModal({ ...profileModal, isOpen: false })}
            candidate={profileModal.candidate as any}
            resumeData={(profileModal.candidate as any).resume_data}
            jobTitle="TechSales Axis Ecosystem Discovery"
            appliedDate={new Date().toISOString()}
            score={profileModal.candidate.trust_score}
            status="Talent Pool"
            initialTab={profileModal.initialTab}
            isDiscovery={true}
            interviews={(profileModal.candidate as any).interviews || []}
            onRefresh={() => handleViewProfile(profileModal.candidate as any, profileModal.initialTab)}
          />
        )}

        {isFetchingProfile && (
          <div className="fixed inset-0 z-100 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-300">
            <div className="bg-white/80 p-6 rounded-4xl shadow-2xl border border-white flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary-light">
                <div className="h-6 w-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] animate-pulse">
                Hydrating Profile...
              </p>
            </div>
          </div>
        )}

        {inviteModal.isOpen && inviteModal.candidate && (
          <JobInviteModal
            onClose={() => setInviteModal({ isOpen: false, candidate: null })}
            candidateName={inviteModal.candidate.full_name}
            jobs={jobs}
            onInvite={handleInviteCandidate}
          />
        )}
      </main>
    </div>
  );
}

function CandidateCard({
  candidate,
  onViewProfile,
  onViewResume,
  onInvite,
  onMessage,
}: {
  candidate: Candidate;
  onViewProfile: () => void;
  onViewResume: () => void;
  onInvite: () => void;
  onMessage: () => void;
}) {
  return (
    <div className="bg-white rounded-4xl border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 group relative flex flex-col p-5 h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl border border-slate-50 bg-slate-100 overflow-hidden shadow-inner group-hover:border-primary-light transition-colors flex items-center justify-center">
            {candidate.profile_photo_url ? (
              <img
                src={candidate.profile_photo_url}
                alt={candidate.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-6 w-6 text-slate-300" />
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 bg-white p-0.5 rounded-full shadow-md">
            <div
              className={`h-3.5 w-3.5 rounded-full flex items-center justify-center ${candidate.identity_verified ? "bg-emerald-500" : "bg-slate-200"}`}
            >
              <CheckCircle2 className="h-2 w-2 text-white" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="px-2 py-0.5 bg-primary-light text-[7px] font-black text-primary uppercase tracking-tighter rounded-md italic shrink-0">
            Elite Talent
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1 mb-4 flex flex-col justify-center">
        <h3 className="text-base font-black text-slate-900 tracking-tight leading-none group-hover:text-primary transition-colors truncate">
          {candidate.full_name}
        </h3>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate mb-1 text-wrap">
          {candidate.current_role || "Professional Candidate"}
        </p>
      </div>

      {candidate.trust_score > 0 && (
        <div className="absolute top-1/2 right-5 -translate-y-[120%] flex flex-col items-center">
          <div className="text-[6px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Signal</div>
          <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-[10px] font-black text-orange-600 italic">
            {candidate.trust_score}%
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-2xl p-3 mb-4 border border-slate-100/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">
            Context
          </span>
          <span className="text-[8px] font-black text-primary uppercase italic tracking-tighter leading-none">
            {candidate.years_of_experience} Years In-Market
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {candidate.skills?.slice(0, 2).map((skill) => (
            <span
              key={skill}
              className="px-1.5 py-0.5 bg-white border border-slate-100 rounded-md text-[7px] font-bold text-slate-600 uppercase tracking-tighter truncate max-w-20"
            >
              {skill}
            </span>
          ))}
          {candidate.skills?.length > 2 && (
            <span className="px-1.5 py-0.5 bg-primary-light/50 text-primary rounded-md text-[7px] font-black uppercase tracking-widest">
              +{candidate.skills.length - 2}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-50">
        <button
          onClick={onViewProfile}
          className="flex-1 h-10 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-sm active:scale-95 whitespace-nowrap"
        >
          View Profile
        </button>
        <button
          onClick={onInvite}
          className="h-10 w-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-dark transition-all shadow-md active:scale-90 group/invite shrink-0"
          title="Job Invitation"
        >
          <Plus className="w-4 h-4 group-hover/invite:rotate-90 transition-transform" />
        </button>
      </div>
    </div>
  );
}

