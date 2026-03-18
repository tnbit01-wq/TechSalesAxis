"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit,
  Users,
  Search,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Zap,
  Filter,
  LogOut,
  Plus,
  ChevronRight,
  User,
  Star,
  Target,
  Trophy,
  MapPin,
  DollarSign,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import RecruiterSidebar from "@/components/RecruiterSidebar";
import LockedView from "@/components/dashboard/LockedView";
import CandidateProfileModal from "@/components/CandidateProfileModal";
import JobInviteModal from "@/components/JobInviteModal";
import { toast } from "sonner";

interface Candidate {
  user_id: string;
  full_name: string;
  email?: string;
  current_role: string;
  experience: "fresher" | "mid" | "senior" | "leadership";
  years_of_experience: number;
  culture_match_score: number;
  match_reasoning?: string;
  skills: string[];
  profile_photo_url?: string;
  resume_path?: string;
  identity_verified?: boolean;
  profile_strength?: string;
}

interface RecruiterProfile {
  assessment_status: string;
  companies: {
    profile_score: number;
  };
}

export default function RecommendationsPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>(["culture_fit"]);
  const [recruiterProfile, setRecruiterProfile] =
    useState<RecruiterProfile | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [filterExperience, setFilterExperience] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterMaxSalary, setFilterMaxSalary] = useState<string>("");
  const [currencySymbol, setCurrencySymbol] = useState<string>("$");
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterSalesModel, setFilterSalesModel] = useState<string>("");
  const [filterTargetMarket, setFilterTargetMarket] = useState<string>("");

  const toggleFilter = (mode: string) => {
    setActiveFilters([mode]);
  };

  const toggleExperienceFilter = (band: string) => {
    setFilterExperience(band);
  };

  const handleApplyFilters = () => {
    fetchRecommendations();
  };

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

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setIsSyncing(true);
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      // Handle search params for skill_match
      const params = new URLSearchParams(window.location.search);
      const initialSkills = params.get("skills");
      
      let modesStr = activeFilters.join(",");
      let url = `/recruiter/recommended-candidates?filter_type=${modesStr}`;
      
      if (activeFilters.includes("skill_match") && initialSkills) {
        url += `&skills=${initialSkills}`;
      }
      
      // Add Location & Salary & Sales DNA filters
      if (filterLocation) url += `&location=${encodeURIComponent(filterLocation)}`;
      if (filterMaxSalary) url += `&max_salary=${encodeURIComponent(filterMaxSalary)}`;
      if (filterSalesModel) url += `&sales_model=${encodeURIComponent(filterSalesModel)}`;
      if (filterTargetMarket) url += `&target_market=${encodeURIComponent(filterTargetMarket)}`;
      if (filterExperience !== "all") url += `&experience_band=${encodeURIComponent(filterExperience)}`;
      if (searchTerm) url += `&skills=${encodeURIComponent(searchTerm)}`;

      const [recData, profileData, jobsData] = await Promise.all([
        apiClient.get(url, token),
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/jobs", token),
      ]);

      setCandidates(recData || []);
      setRecruiterProfile(profileData);
      setJobs(jobsData || []);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      toast.error("Algorithmic Sync Failed: Could not load recommendations");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [router, activeFilters, filterLocation, filterMaxSalary, filterSalesModel, filterTargetMarket, searchTerm]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialFilter = params.get("filter") as any;
    if (initialFilter && (initialFilter === "skill_match" || initialFilter === "profile_matching")) {
      setActiveFilters([initialFilter]);
    }
  }, []);

  useEffect(() => {
    // Detect Currency based on Location
    const loc = filterLocation.toLowerCase();
    if (loc.includes("india") || loc.includes("mumbai") || loc.includes("bangalore") || loc.includes("delhi") || loc.includes("pune") || loc.includes("hyd")) {
      setCurrencySymbol("₹");
    } else if (loc.includes("uk") || loc.includes("london") || loc.includes("manchester")) {
      setCurrencySymbol("£");
    } else if (loc.includes("europe") || loc.includes("germany") || loc.includes("france") || loc.includes("dublin") || loc.includes("paris") || loc.includes("berlin")) {
      setCurrencySymbol("€");
    } else {
      setCurrencySymbol("$");
    }
  }, [filterLocation]);

  useEffect(() => {
    // Initial fetch
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleLogout = async () => {
    awsAuth.logout();
    router.replace("/login");
  };

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

      toast.success(`Elite Invite sent to ${inviteModal.candidate.full_name}`);
      setInviteModal({ isOpen: false, candidate: null });
    } catch (err: any) {
      console.error("Failed to invite candidate:", err);
      toast.error(err.message || "Invitation cycle failed");
    }
  };

  const handleViewProfile = async (
    candidate: Candidate,
    tab: string = "resume",
  ) => {
    setIsFetchingProfile(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const fullCandidate = await apiClient.get(
        `/recruiter/candidate/${candidate.user_id}`,
        token,
      );

      setProfileModal({
        isOpen: true,
        candidate: { ...candidate, ...fullCandidate },
        initialTab: tab,
      });
    } catch (err) {
      console.error("Failed to fetch full candidate details:", err);
      toast.error("Deep Link Error: Could not hydrate talent profile");
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

  // Group by Match Strength for a more "Recommended" feel
  const tiers = {
    elite: filteredCandidates.filter((c) => c.culture_match_score >= 85),
    strong: filteredCandidates.filter(
      (c) => c.culture_match_score >= 60 && c.culture_match_score < 85,
    ),
    potential: filteredCandidates.filter((c) => c.culture_match_score < 60),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-xl">
            <div className="h-8 w-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em]">
            Calculating Best Match...
          </p>
        </div>
      </div>
    );
  }

  const isLocked = (recruiterProfile?.companies?.profile_score ?? 0) === 0;

  return (
    <div className="max-w-7xl mx-auto pb-20">
      {isLocked ? (
        <LockedView featureName="Recommended Talent" />
      ) : (
        <>
          <header className="mb-12 flex flex-col gap-8">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 scale-110">
                    <BrainCircuit className="h-7 w-7 text-white" />
                  </div>
                  <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                    Smart<span className="text-indigo-600">Match</span>
                  </h1>
                </div>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.4em] ml-1">
                  AI-Powered Candidate Recommendations
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleLogout}
                  className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm active:scale-95"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 p-4 rounded-[2.5rem] shadow-xl shadow-slate-100/50 space-y-4">
              <div className="flex flex-wrap items-center gap-4 px-2">
                {/* Core Match Logic */}
                <div className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/30">
                  {[
                    { id: "culture_fit", label: "Culture Fit" },
                    { id: "skill_match", label: "Skills" },
                    { id: "profile_matching", label: "Expert View" }
                  ].map((f) => (
                    <button 
                      key={f.id}
                      onClick={() => toggleFilter(f.id)}
                      className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                        activeFilters.includes(f.id) ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="h-6 w-[1px] bg-slate-200 hidden lg:block" />

                {/* Compact Experience */}
                <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-200/30 overflow-x-auto no-scrollbar">
                  {[
                    { id: "all", label: "All Levels" },
                    { id: "fresher", label: "0-1 Fresher" },
                    { id: "mid", label: "1-5 Mid" },
                    { id: "senior", label: "5-10 Senior" },
                    { id: "leadership", label: "10+ Lead" }
                  ].map((band) => (
                    <button
                      key={band.id}
                      onClick={() => toggleExperienceFilter(band.id)}
                      className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        filterExperience === band.id
                          ? "bg-white text-indigo-600 shadow-sm"
                          : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                      }`}
                    >
                      {band.label}
                    </button>
                  ))}
                </div>

                <div className="flex-1" />

                {/* Primary Action */}
                <button
                  onClick={handleApplyFilters}
                  disabled={isSyncing}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95 whitespace-nowrap"
                >
                  {isSyncing ? (
                    <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Filter className="w-3.5 h-3.5" />
                  )}
                  {isSyncing ? "Searching..." : "Search Candidates"}
                </button>
              </div>

              <div className="h-px bg-slate-100 mx-2" />

              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400" />
                  <input
                    type="text"
                    placeholder="LOC..."
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-100 pl-10 pr-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                  />
                </div>

                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-400">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    placeholder="BUDGET..."
                    value={filterMaxSalary}
                    onChange={(e) => setFilterMaxSalary(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-100 pl-10 pr-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-400 transition-all"
                  />
                </div>

                <div className="relative group lg:col-span-1">
                  <select
                    value={filterSalesModel}
                    onChange={(e) => setFilterSalesModel(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-100 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 outline-none appearance-none cursor-pointer focus:bg-white focus:border-indigo-400"
                  >
                    <option value="">MODEL...</option>
                    <option value="Transactional">Transactional</option>
                    <option value="Consultative">Consultative</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="relative group">
                  <select
                    value={filterTargetMarket}
                    onChange={(e) => setFilterTargetMarket(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-100 px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 outline-none appearance-none cursor-pointer focus:bg-white focus:border-indigo-400"
                  >
                    <option value="">MARKET...</option>
                    <option value="SMB">SMB</option>
                    <option value="Mid-Market">Mid-Market</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="relative group lg:col-span-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400" />
                  <input
                    type="text"
                    placeholder="SKILLS/ROLE..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-100 pl-10 pr-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-400 transition-all"
                  />
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-20">
            {Object.entries(tiers).map(
              ([tier, list]) =>
                list.length > 0 && (
                  <div key={tier} className="space-y-10">
                    <div className="flex items-center gap-6">
                      <div
                        className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg ${
                          tier === "elite"
                            ? "bg-orange-500 shadow-orange-100"
                            : tier === "strong"
                              ? "bg-indigo-600 shadow-indigo-100"
                              : "bg-slate-400 shadow-slate-100"
                        }`}
                      >
                        {tier === "elite" ? (
                          <Trophy className="w-6 h-6 text-white" />
                        ) : tier === "strong" ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <Users className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
                          {tier === "elite"
                            ? "Best Match"
                            : tier === "strong"
                              ? "Strong Match"
                              : "Potential Match"}
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {tier === "elite"
                            ? "Top alignment with your requirements"
                            : tier === "strong"
                              ? "High compatibility with your team"
                              : "Verified candidates for consideration"}
                        </p>
                      </div>
                      <div className="h-px flex-1 bg-linear-to-r from-slate-200 to-transparent" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {list.map((candidate) => (
                        <RecommendedCard
                          key={candidate.user_id}
                          candidate={candidate}
                          onViewProfile={() =>
                            handleViewProfile(candidate, "resume")
                          }
                          onInvite={() =>
                            setInviteModal({ isOpen: true, candidate })
                          }
                          isElite={tier === "elite"}
                        />
                      ))}
                    </div>
                  </div>
                ),
            )}

            {filteredCandidates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                  <Zap className="h-10 w-10 text-slate-200" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic">
                  No Smart Matches
                </h3>
                <p className="text-slate-400 text-sm font-medium mt-2">
                  Adjust your search filters or check your company requirements.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {profileModal.isOpen && profileModal.candidate && (
        <CandidateProfileModal
          isOpen={profileModal.isOpen}
          onClose={() => setProfileModal({ ...profileModal, isOpen: false })}
          candidate={profileModal.candidate as any}
          resumeData={(profileModal.candidate as any).resume_data}
          jobTitle="Smart Match Details"
          appliedDate={new Date().toISOString()}
          score={profileModal.candidate.culture_match_score || 0}
          status="Recommended"
          initialTab={profileModal.initialTab}
          isDiscovery={true}
        />
      )}

      {isFetchingProfile && (
        <div className="fixed inset-0 z-100 bg-indigo-900/10 backdrop-blur-xs flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-indigo-100 flex flex-col items-center gap-5">
            <div className="h-16 w-16 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-200">
              <div className="h-8 w-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-black text-slate-900 uppercase tracking-[0.3em] animate-pulse">
                Analyzing Match...
              </p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Verifying profile details
              </p>
            </div>
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
    </div>
  );
}

function RecommendedCard({
  candidate,
  onViewProfile,
  onInvite,
  isElite,
}: {
  candidate: Candidate;
  onViewProfile: () => void;
  onInvite: () => void;
  isElite?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-4xl border-2 ${isElite ? "border-orange-500/20 shadow-orange-500/10" : "border-indigo-500/10 shadow-indigo-500/10"} hover:border-indigo-500/30 transition-all duration-700 group relative flex flex-col p-4 h-full backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between mb-3 relative z-10">
        <div className="relative">
          <div
            className={`h-11 w-11 rounded-xl border ${isElite ? "border-orange-100 bg-orange-50" : "border-slate-100 bg-slate-50"} overflow-hidden shadow-inner group-hover:scale-105 transition-transform flex items-center justify-center`}
          >
            {candidate.profile_photo_url ? (
              <img
                src={candidate.profile_photo_url}
                alt={candidate.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User
                className={`h-5 w-5 ${isElite ? "text-orange-300" : "text-slate-300"}`}
              />
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 bg-white p-0.5 rounded-full shadow-md">
            <div
              className={`h-3 w-3 rounded-full flex items-center justify-center ${candidate.identity_verified ? "bg-emerald-500" : "bg-slate-200"}`}
            >
              <CheckCircle2 className="h-2 w-2 text-white" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div
            className={`px-2 py-0.5 ${isElite ? "bg-orange-600 shadow-lg shadow-orange-100" : "bg-indigo-600 shadow-lg shadow-indigo-100"} text-[6px] font-black text-white uppercase tracking-widest rounded-md italic shrink-0`}
          >
            {isElite ? "Elite sync" : "High match"}
          </div>
          <button
            onClick={onViewProfile}
            className="text-[8px] font-black text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 group/btn uppercase tracking-widest shrink-0"
          >
            Profile{" "}
            <ChevronRight className="w-2.5 h-2.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-0.5 mb-3 flex flex-col justify-center relative z-10">
        <h3
          className={`text-[15px] font-black text-slate-900 tracking-tight leading-none group-hover:text-indigo-600 transition-colors truncate`}
        >
          {candidate.full_name}
        </h3>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate">
          {candidate.current_role || "Product Infrastructure"}
        </p>
        <p className="text-[8px] font-medium text-slate-300 lowercase tracking-tight truncate">
          {candidate.email || "alignment@talentflow.ai"}
        </p>
      </div>

      {candidate.match_reasoning && (
        <div className="bg-emerald-50/50 border border-emerald-100/30 rounded-xl p-3 mb-3 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
           <div className="flex items-center gap-2 mb-1">
             <Zap size={10} className="text-emerald-600 fill-emerald-600" />
             <span className="text-[7px] font-black text-emerald-600 uppercase tracking-widest">Match Logic:</span>
           </div>
           <p className="text-[9px] font-bold text-slate-700 italic leading-snug">
             "{candidate.match_reasoning}"
           </p>
        </div>
      )}

      <div
        className={`${isElite ? "bg-orange-50/50 border-orange-100/30" : "bg-slate-50 border-slate-100"} rounded-xl p-2.5 mb-3 border relative z-10`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[6px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none">
            Culture affinity
          </span>
          <span
            className={`text-[7px] font-bold ${isElite ? "text-orange-600" : "text-indigo-600"} uppercase italic tracking-tighter leading-none`}
          >
            {candidate.years_of_experience}Y Verified
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {candidate.skills?.slice(0, 2).map((skill) => (
            <span
              key={skill}
              className="px-1.5 py-0.5 bg-white border border-slate-100 rounded-md text-[7px] font-bold text-slate-500 uppercase tracking-tighter truncate max-w-17.5"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-auto relative z-10">
        <button
          onClick={onViewProfile}
          className={`flex-1 py-2.5 ${isElite ? "bg-orange-600 hover:bg-orange-700 shadow-orange-100" : "bg-slate-900 hover:bg-slate-800 shadow-slate-200"} text-white rounded-xl text-[8px] font-black uppercase tracking-[0.4em] transition-all shadow-md active:scale-95 whitespace-nowrap`}
        >
          Expert Profile
        </button>
        <button
          onClick={onInvite}
          className={`h-9 w-9 ${isElite ? "bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-600 hover:text-white" : "bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white"} border rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 group/invite shrink-0`}
          title="Direct Sync"
        >
          <Plus className="w-4 h-4 group-hover/invite:rotate-90 transition-transform" />
        </button>
        <div
          className={`h-9 w-9 rounded-xl border flex flex-col items-center justify-center shadow-sm shrink-0 ${isElite ? "bg-white border-orange-100" : "bg-white border-slate-100"}`}
        >
          <span
            className={`text-[5px] font-black leading-none scale-75 uppercase ${isElite ? "text-orange-400" : "text-indigo-400"}`}
          >
            Match
          </span>
          <span
            className={`text-[10px] font-black italic tracking-tighter leading-none ${isElite ? "text-orange-600" : "text-indigo-600"}`}
          >
            {candidate.culture_match_score}%
          </span>
        </div>
      </div>
    </div>
  );
}
