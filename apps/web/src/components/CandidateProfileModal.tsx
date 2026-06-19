"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  AlertCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  GraduationCap,
  User,
  Star,
  Download,
  FileText,
  ClipboardList,
  Video,
  Send,
  Building2,
  BrainCircuit,
  Zap,
  Lock,
  Unlock,
  Award
} from "lucide-react";
import { format } from "date-fns";
import { apiClient } from "@/lib/apiClient";
import { awsAuth } from "@/lib/awsAuth";
import InterviewScheduler from "./InterviewScheduler";
import InterviewFeedbackModal from "./InterviewFeedbackModal";

interface CandidateProfile {
  user_id: string;
  full_name: string;
  bio?: string;
  profile_photo_url?: string;
  phone_number?: string;
  location?: string;
  gender?: string;
  birthdate?: string;
  referral?: string;
  skills: string[];
  email?: string | null;
  resume_path?: string | null;
}

interface ExperienceEntry {
  role?: string;
  title?: string;
  company?: string;
  location?: string;
  start?: string;
  end?: string;
  description?: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: CandidateProfile;
  resumeData?: Record<string, unknown> | Record<string, unknown>[];
  jobTitle: string;
  appliedDate: string;
  score: number;
  status?: string;
  initialTab?: string;
  applicationId?: string;
  isDiscovery?: boolean;
  interviews?: any[];
  onRefresh?: () => void;
  initialFeedbackOpen?: boolean;
}

interface ParsedResume {
  education?: {
    institution?: string;
    degree?: string;
    year?: string;
  };
  location?: string;
  phone?: string;
  bio?: string;
  skills?: string[];
  [key: string]: unknown;
}

export default function CandidateProfileModal({
  isOpen,
  onClose,
  candidate,
  resumeData,
  jobTitle,
  appliedDate,
  score,
  status,
  initialTab = "resume",
  applicationId,
  isDiscovery = false,
  interviews = [],
  onRefresh,
  initialFeedbackOpen = false,
}: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showScheduler, setShowScheduler] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(initialFeedbackOpen);

  const activeInterview = (interviews || []).find(i => 
    i.status === "scheduled" || i.status === "pending_confirmation"
  );
  const completedInterviews = (interviews || []).filter(i => 
    i.status === "completed" || i.status === "not_conducted" || i.status === "no_show"
  ).sort((a, b) => b.round_number - a.round_number);
  
  const confirmedSlot = activeInterview?.interview_slots?.find((s: any) => s.is_selected) || 
                        activeInterview?.slots?.find((s: any) => s.is_selected);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (initialFeedbackOpen) {
      setShowFeedbackModal(true);
    }
  }, [initialFeedbackOpen]);

  if (!isOpen) return null;

  const tabs = [
    {
      id: "resume",
      label: "Profile",
      icon: User,
    },
    {
      id: "application",
      label: "Application",
      icon: ClipboardList,
      hidden: isDiscovery,
    },
    {
      id: "interview",
      label: "Interviews",
      icon: Video,
      hidden: !activeInterview && completedInterviews.length === 0,
    },
    {
      id: "original_resume",
      label: "Original PDF",
      icon: FileText,
      hidden: !candidate.resume_path,
    },
  ].filter((t) => !t.hidden);

  const normalizedResume = (
    resumeData ? (Array.isArray(resumeData) ? resumeData[0] : resumeData) : 
    (candidate as any).resume_data
  ) as Record<string, unknown> | undefined;

  let parsedDetails: ParsedResume = {};
  if (
    typeof normalizedResume?.raw_text === "string" &&
    (normalizedResume.raw_text as string).trim().startsWith("{")
  ) {
    try {
      parsedDetails = JSON.parse(normalizedResume.raw_text as string);
    } catch {
      // Ignored
    }
  } else if (typeof normalizedResume?.raw_text === "object") {
    parsedDetails = normalizedResume.raw_text as unknown as ParsedResume;
  }

  const timeline: ExperienceEntry[] = Array.isArray(normalizedResume?.timeline)
    ? normalizedResume.timeline
    : [];

  const eduInstitution =
    (normalizedResume?.education as Record<string, string>)?.institution ||
    parsedDetails?.education?.institution ||
    "Not Provided";
  const eduDegree =
    (normalizedResume?.education as Record<string, string>)?.degree ||
    parsedDetails?.education?.degree ||
    "Not Provided";
  const eduYear =
    (normalizedResume?.education as Record<string, string>)?.year ||
    parsedDetails?.education?.year ||
    "N/A";

  const displayLocation =
    candidate.location || parsedDetails?.location || "Not Provided";
  const displayPhone =
    candidate.phone_number || parsedDetails?.phone || "Hidden";
  const displayBio =
    candidate.bio ||
    parsedDetails?.bio ||
    "Candidate has not provided a professional bio yet.";

  const skillsList = (() => {
    if (candidate.skills) {
      if (Array.isArray(candidate.skills)) {
        if (candidate.skills.length > 0) return candidate.skills;
      } else if (typeof candidate.skills === "string") {
        const parts = (candidate.skills as string)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "");
        if (parts.length > 0) return parts;
      }
    }
    if (normalizedResume && Array.isArray(normalizedResume.skills)) {
      if (normalizedResume.skills.length > 0) return normalizedResume.skills;
    }
    if (parsedDetails && Array.isArray(parsedDetails.skills)) {
      if (parsedDetails.skills.length > 0) return parsedDetails.skills;
    }
    return [];
  })();

  // Years of Experience calculation
  const yearsOfExp = (() => {
    if (timeline && timeline.length > 0) {
      const startDates = timeline
        .map(e => e.start ? parseInt(e.start.split('-')[0]) : null)
        .filter(Boolean) as number[];
      const endDates = timeline
        .map(e => e.end && e.end.toLowerCase() !== 'present' ? parseInt(e.end.split('-')[0]) : new Date().getFullYear())
        .filter(Boolean) as number[];
      
      if (startDates.length > 0) {
        const minStart = Math.min(...startDates);
        const maxEnd = Math.max(...endDates);
        return Math.max(0, maxEnd - minStart);
      }
    }
    return 0;
  })();

  const getExperienceLevel = (years: number) => {
    if (years < 2) return "Fresher";
    if (years < 5) return "Mid-Level";
    if (years < 10) return "Senior";
    return "Leadership";
  };

  const isUnlocked = !!(candidate.email && candidate.email.includes("@")) && status !== "rejected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/40 backdrop-blur-sm p-2 sm:p-4 overflow-hidden">
      <div className="bg-[#FFFDF9] rounded-3xl shadow-2xl w-full max-w-5xl h-[95vh] md:h-[85vh] flex flex-col overflow-hidden border border-orange-100/80 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modern Compact Header */}
        <div className="bg-gradient-to-r from-orange-50/20 via-[#FFFDF9] to-[#FFFDF9] px-5 py-4 flex items-center justify-between border-b border-orange-100/50 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              {candidate.profile_photo_url ? (
                <Image
                  src={candidate.profile_photo_url}
                  alt={candidate.full_name}
                  width={46}
                  height={46}
                  className="rounded-full object-cover ring-2 ring-orange-100"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-orange-50 flex items-center justify-center ring-2 ring-orange-100">
                  <User className="w-5 h-5 text-[#FF8A00]" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 bg-[#FFFDF9] rounded-full p-0.5 shadow-sm">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              </div>
            </div>

            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-955 leading-tight tracking-tight flex items-center gap-2">
                <span className="truncate">{candidate.full_name}</span>
                {status && (
                  <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 border ${
                    status === "rejected"
                      ? "bg-red-50 text-red-600 border-red-100"
                      : "bg-orange-50 text-[#FF8A00] border-orange-100"
                  }`}>
                    {status}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-500 font-bold uppercase tracking-widest min-w-0">
                <div className="flex flex-col shrink-0">
                  <span className="text-slate-400 text-[7px] font-black leading-none mb-0.5">Applied</span>
                  <span>{format(new Date(appliedDate), "dd MMM, yyyy")}</span>
                </div>
                <div className="flex flex-col border-l border-slate-200 pl-3 min-w-0">
                  <span className="text-slate-400 text-[7px] font-black leading-none mb-0.5">Role</span>
                  <span className="text-slate-900 truncate max-w-[150px] sm:max-w-[250px]">
                    {jobTitle}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (candidate.email) {
                  window.location.href = `mailto:${candidate.email.toLowerCase()}?subject=Regarding your application for ${jobTitle}&body=Hello ${candidate.full_name},`;
                } else {
                  alert("Candidate email not found.");
                }
              }}
              disabled={!isUnlocked}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 border ${
                isUnlocked
                  ? "bg-[#FF8A00] hover:bg-[#E67A00] text-white border-[#FF8A00] shadow-orange-600/10"
                  : "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
              }`}
              title={!isUnlocked ? "Not available for this candidate" : "Send email to candidate"}
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send Email</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-white hover:bg-slate-50 rounded-xl transition-all border border-slate-200/60 shadow-sm"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Workspace Body: Responsive Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          
          {/* Desktop Left Profile Sidebar (collapses/hides on small viewports) */}
          <div className="hidden md:flex w-76 border-r border-orange-100/50 flex-col shrink-0 bg-[#FFFDF9]/30 overflow-y-auto candidate-modal-scroll p-5 space-y-5">
            
            {/* Match Score Gauge */}
            <div className="bg-orange-50/20 rounded-2xl border border-orange-100/50 p-4 flex items-center gap-3.5">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle cx="24" cy="24" r="20" stroke="#FFEEDB" strokeWidth="4.5" fill="transparent" />
                  <circle cx="24" cy="24" r="20" stroke="#FF8A00" strokeWidth="4.5" fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - score / 100)}`}
                    strokeLinecap="round" />
                </svg>
                <span className="absolute text-[10px] font-black text-slate-900">
                  {(score / 20).toFixed(1)}
                </span>
              </div>
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  Match Score
                </h4>
                <p className="text-[11px] font-bold text-slate-700">
                  Strong Match
                </p>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50/30 rounded-2xl p-4 border border-orange-100/40 text-center">
                <p className="text-[8px] font-black text-[#FF8A00] uppercase tracking-widest mb-1.5">Experience</p>
                <p className="text-xl font-black text-slate-900 leading-none mb-1">{yearsOfExp}</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Years</p>
              </div>
              <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50 text-center">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Level</p>
                <p className="text-xs font-black text-slate-900 leading-none mb-1 truncate">{getExperienceLevel(yearsOfExp)}</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Bracket</p>
              </div>
            </div>

            {/* Location & Compensation */}
            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/50 space-y-3">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{displayLocation}</span>
                </p>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Expected Comp</p>
                <p className="text-xs font-bold text-slate-800">
                  Not Provided
                </p>
              </div>
            </div>

            {/* Privacy Status */}
            <div className={`p-4 rounded-2xl border text-center ${
              isUnlocked ? "bg-emerald-50/20 border-emerald-100/50" : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                {isUnlocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Unlocked</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Locked Info</span>
                  </>
                )}
              </div>
              <p className="text-[9px] text-slate-500 font-medium leading-relaxed">
                {isUnlocked 
                  ? "Full candidate contact details are available." 
                  : "Personal details unlock once the candidate applies or replies."}
              </p>
            </div>
          </div>

          {/* Right Area: Tabs + Inner Scrollable Body */}
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/30 p-4 sm:p-5">
            
            {/* View Switching Tab bar */}
            <div className="flex items-center gap-1 mb-4 bg-slate-200/40 p-1 rounded-2xl self-start max-w-full overflow-x-auto shrink-0 select-none no-scrollbar">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${
                      isActive
                        ? "bg-white text-[#FF8A00] shadow-sm"
                        : "text-slate-500 hover:bg-slate-200/60"
                    }`}
                  >
                    <tab.icon
                      className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-[#FF8A00]" : "text-slate-400"}`}
                    />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Display Panel (Content Area) */}
            <div className="flex-1 bg-white rounded-2xl border border-orange-100/50 shadow-xs overflow-hidden flex flex-col min-h-0">
              
              {activeTab === "resume" && (
                <div className="candidate-modal-scroll flex-1 overflow-y-auto p-5 sm:p-6 bg-[#FFFDF9]/10">
                  <div className="max-w-3xl mx-auto space-y-6">
                    
                    {/* Mobile Only: Top info block */}
                    <div className="block md:hidden space-y-4">
                      {/* Score, Exp, Location grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-orange-50/20 rounded-2xl p-3 border border-orange-100/40 text-center">
                          <p className="text-[7px] font-black text-[#FF8A00] uppercase tracking-widest mb-1">Score</p>
                          <p className="text-base font-black text-slate-900 leading-none">{(score / 20).toFixed(1)}</p>
                        </div>
                        <div className="bg-orange-50/20 rounded-2xl p-3 border border-orange-100/40 text-center">
                          <p className="text-[7px] font-black text-[#FF8A00] uppercase tracking-widest mb-1">Exp</p>
                          <p className="text-base font-black text-slate-900 leading-none">{yearsOfExp} Yr</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/50 text-center">
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</p>
                          <p className="text-[10px] font-black text-slate-900 leading-none truncate">{displayLocation.split(',')[0]}</p>
                        </div>
                      </div>

                      {/* Locked alert banner */}
                      {!isUnlocked && (
                        <div className="p-3 bg-[#FFF6ED] border border-orange-100 rounded-xl flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-[#FF8A00] shrink-0" />
                          <p className="text-[10px] text-orange-955/80 font-bold">Personal contact details are locked.</p>
                        </div>
                      )}
                    </div>

                    {/* Bio/About Section */}
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-black text-[#FF8A00] uppercase tracking-[0.18em]">
                        Professional Bio
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                        {displayBio}
                      </p>
                    </div>

                    {/* Expertise Areas - Skills */}
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-black text-[#FF8A00] uppercase tracking-[0.18em]">
                        Expertise Areas
                      </h3>
                      {skillsList.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {skillsList.map((skill: string, i: number) => (
                            <span
                              key={i}
                              className="px-3 py-1.5 bg-orange-50/40 text-[#FF8A00] text-[10px] font-bold rounded-xl border border-orange-100/50 hover:bg-[#FF8A00] hover:text-white transition-all duration-200 cursor-default"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No expertise areas specified.</p>
                      )}
                    </div>

                    {/* EXPERIENCE TIMELINE (Redesigned & Custom Rendered) */}
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-black text-[#FF8A00] uppercase tracking-[0.18em]">
                        Work Experience
                      </h3>
                      
                      {timeline.length > 0 ? (
                        <div className="relative border-l-2 border-orange-100/70 ml-2.5 pl-5 space-y-6">
                          {timeline.map((entry, idx) => (
                            <div key={idx} className="relative group">
                              {/* Timeline indicator node */}
                              <div className="absolute -left-[26px] top-1 w-2.5 h-2.5 rounded-full bg-[#FF8A00] ring-4 ring-orange-50/80 transition-transform duration-200 group-hover:scale-125" />
                              
                              <div className="bg-white rounded-2xl p-4 border border-slate-100/80 shadow-xs hover:border-orange-100/50 transition-all">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                                  <div>
                                    <h4 className="text-xs font-black text-slate-900 leading-tight">
                                      {entry.role || entry.title || "Position Title"}
                                    </h4>
                                    <p className="text-[10px] text-[#FF8A00] font-bold mt-0.5">
                                      {entry.company || "Company Name"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                    <Calendar className="w-3 h-3 text-slate-300" />
                                    <span>
                                      {entry.start || "Start"} — {entry.end || "Present"}
                                    </span>
                                  </div>
                                </div>
                                {entry.description && (
                                  <p className="text-[11px] text-slate-500 leading-relaxed mt-2 pt-2 border-t border-slate-50 font-medium">
                                    {entry.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/50 text-center text-xs text-slate-400 italic">
                          No experience timeline entries details parsed from resume.
                        </div>
                      )}
                    </div>

                    {/* Education Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Academic Institution</p>
                        <div className="flex items-start gap-2.5">
                          <GraduationCap className="w-4 h-4 text-[#FF8A00] shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-tight">{eduInstitution}</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Year: {eduYear}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Degree Attained</p>
                        <div className="flex items-start gap-2.5">
                          <Award className="w-4 h-4 text-[#FF8A00] shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-tight">{eduDegree}</p>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">Academic Grade</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Details (LOCKED/UNLOCKED styled banner) */}
                    <div className={`rounded-2xl p-5 border shadow-xs transition-all ${
                      isUnlocked
                        ? "bg-white border-orange-100/50"
                        : "bg-slate-50/70 border-slate-200"
                    }`}>
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`p-1.5 rounded-lg shrink-0 ${isUnlocked ? "bg-emerald-50" : "bg-slate-100"}`}>
                          {isUnlocked ? (
                            <Unlock className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          Candidate Contact Information
                        </h4>
                      </div>

                      {isUnlocked ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/80">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Email</span>
                            <span className="text-xs font-bold text-slate-800 break-all">{candidate.email?.toLowerCase() || "Not Provided"}</span>
                          </div>
                          <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/80">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Phone</span>
                            <span className="text-xs font-bold text-slate-800">{displayPhone}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 bg-slate-100/40 p-4 rounded-xl border border-dashed border-slate-200 text-slate-400">
                          <p className="text-xs font-semibold flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                            Email Address (Encrypted)
                          </p>
                          <p className="text-xs font-semibold flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                            Phone Number (Protected)
                          </p>
                          <p className="text-[9px] text-slate-505 font-bold uppercase tracking-wider pt-2 italic">
                            Unlocks automatically once the candidate accepts your outreach
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {activeTab === "original_resume" && candidate.resume_path && (
                <div className="flex flex-col h-full bg-slate-900">
                  <div className="bg-slate-950/80 p-3.5 flex justify-between items-center px-6 border-b border-slate-800 shrink-0">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                      Candidate Original Document
                    </span>
                    <a
                      href={candidate.resume_path || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#FF8A00] hover:bg-[#E67A00] text-white px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg active:scale-95 transition-all shadow-orange-600/10"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Original
                    </a>
                  </div>
                  <div className="flex-1 overflow-hidden relative">
                    <iframe
                      src={candidate.resume_path || ""}
                      className="w-full h-full border-none"
                      title="Original Resume PDF"
                    />
                  </div>
                </div>
              )}

              {activeTab === "application" && (
                <div className="candidate-modal-scroll flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/20">
                  <div className="max-w-2xl mx-auto space-y-6">
                    <h3 className="text-[10px] font-black text-[#FF8A00] uppercase tracking-[0.18em]">
                      Pipeline Application Details
                    </h3>
                    
                    <div className="bg-white rounded-2xl border border-orange-100/40 p-5 sm:p-6 shadow-xs space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                        <div className="flex items-center gap-3.5">
                          <div className="w-11 h-11 bg-orange-50/50 rounded-xl flex items-center justify-center shrink-0 border border-orange-100/50">
                            <ClipboardList className="w-5 h-5 text-[#FF8A00]" />
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                              Current Hiring Stage
                            </p>
                            <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                              {status || "APPLIED"}
                            </h4>
                          </div>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                            Applied On
                          </p>
                          <h4 className="text-xs font-bold text-slate-700">
                            {format(new Date(appliedDate), "MMMM dd, yyyy")}
                          </h4>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Standard Match Score
                          </span>
                          <span className="text-xs font-black text-[#FF8A00]">
                            {(score / 20).toFixed(1)} / 5.0 Rating
                          </span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                            Target Position Title
                          </span>
                          <span className="text-xs font-black text-slate-700 truncate block">
                            {jobTitle}
                          </span>
                        </div>
                      </div>

                      <div className="p-4 bg-orange-50/20 rounded-xl border border-orange-100/50">
                        <p className="text-[8px] font-black text-[#FF8A00] uppercase tracking-widest mb-1.5">Referral Source</p>
                        <p className="text-xs font-bold text-slate-800">
                          {candidate.referral || "Direct Platform Application"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "interview" && (
                <div className="candidate-modal-scroll flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/20">
                  <div className="max-w-2xl mx-auto space-y-6">
                    
                    <div className="text-center flex flex-col items-center py-4">
                      <div className="w-12 h-12 bg-orange-50/60 rounded-2xl flex items-center justify-center mb-4 border border-orange-100/50">
                        <Video className="w-5 h-5 text-[#FF8A00]" />
                      </div>
                      <h3 className="text-base font-black text-slate-900 tracking-tight mb-1">
                        Interview Assessment Details
                      </h3>
                      <p className="text-[10px] text-slate-400 font-bold max-w-sm leading-relaxed uppercase tracking-wider">
                        Configure virtual links and monitor candidates' evaluation rounds.
                      </p>
                    </div>

                    {activeInterview ? (
                      <div className="bg-white border border-orange-100/50 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                          <div>
                            <span className="text-[8px] font-black text-[#FF8A00] bg-orange-50 border border-orange-100/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {activeInterview.status === "scheduled" ? "Confirmed Round" : "Pending Confirmation"}
                            </span>
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mt-2">
                              {activeInterview.round_name} (Round #{activeInterview.round_number})
                            </h4>
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl border ${
                          activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at
                            ? "bg-emerald-50/30 border-emerald-100/50 text-emerald-800"
                            : "bg-slate-50 border-slate-100 text-slate-700"
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            {activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at ? (
                              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            )}
                            <p className="text-[9px] font-black uppercase tracking-widest">
                              {activeInterview.recruiter_joined_at && activeInterview.candidate_joined_at 
                                ? "Session in progress (Active Link)" 
                                : "Proposed Meeting Details"}
                            </p>
                          </div>
                          <p className="text-xs font-bold">
                            {confirmedSlot ? (
                              new Date(confirmedSlot.start_time).toLocaleString('en-IN', {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                                timeZone: 'Asia/Kolkata'
                              }) + " IST"
                            ) : (
                              "Candidate is currently reviewing proposed schedule slots..."
                            )}
                          </p>
                        </div>

                        <div className="space-y-3 pt-2">
                          {activeInterview.status === "scheduled" && activeInterview.meeting_link && (() => {
                            const nowInBrowser = currentTime;
                            const start = new Date(confirmedSlot?.start_time || "");
                            const end = new Date(confirmedSlot?.end_time || "");
                            
                            const allowedStart = new Date(start.getTime() - 15 * 60000);
                            const allowedEnd = end;
                            
                            const isActive = nowInBrowser >= allowedStart && nowInBrowser <= allowedEnd;

                            return (
                              <div className="space-y-3 w-full">
                                {/* Jitsi Recruiter Warning Banner */}
                                <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-100/50 text-slate-700 text-[11px] space-y-1">
                                  <p className="font-bold text-[#FF8A00] flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5 text-[#FF8A00]" />
                                    Jitsi Meet Host Instructions
                                  </p>
                                  <p className="leading-relaxed">
                                    As the host (recruiter), you may need to <strong>sign in on the Jitsi interface</strong> to start and moderate the video call. If prompted, click &quot;I am the host&quot; and sign in to open the room for the candidate.
                                  </p>
                                </div>

                                <button
                                  disabled={!isActive}
                                  onClick={async () => {
                                    try {
                                      const token = awsAuth.getToken();
                                      if (token) {
                                        apiClient.post(`/interviews/${activeInterview.id}/join-event`, { role: "recruiter" }, token);
                                      }
                                    } catch (err) {
                                      console.error("Failed to signal join:", err);
                                    }
                                    window.open(activeInterview.meeting_link, "_blank");
                                  }}
                                  className={`w-full py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all flex items-center justify-center gap-1.5 border ${
                                    isActive 
                                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-600/10" 
                                      : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                                  }`}
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  {isActive 
                                    ? activeInterview.recruiter_joined_at ? "Return to Live Session" : "Join Video Call"
                                    : nowInBrowser < allowedStart 
                                      ? `Locked: Opens ${Math.round((allowedStart.getTime() - nowInBrowser.getTime()) / 60000)}m Early` 
                                      : "Meeting Link Expired"}
                                </button>
                              </div>
                            );
                          })()}
                          
                          {activeInterview.status === "scheduled" && (
                            <button
                              onClick={() => setShowFeedbackModal(true)}
                              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                            >
                              Log Round Evaluation Feedback
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center space-y-4 shadow-xs">
                        <p className="text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
                          Invite this candidate to a scheduled live virtual video assessment or face-to-face round.
                        </p>
                        <button
                          onClick={() => setShowScheduler(true)}
                          className="bg-[#FF8A00] hover:bg-[#E67A00] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-orange-600/15 transition-all active:scale-95 border border-[#FF8A00]"
                        >
                          Schedule New Round
                        </button>
                      </div>
                    )}

                    {/* Historical Rounds Archive */}
                    {completedInterviews.length > 0 && (
                      <div className="space-y-4 pt-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <ClipboardList className="w-4 h-4 text-slate-400 shrink-0" />
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Historical Rounds Archive
                          </h4>
                        </div>
                        <div className="space-y-3">
                          {completedInterviews.map((int) => (
                            <div 
                              key={int.id}
                              className="p-4 bg-white border border-slate-200/60 rounded-xl relative overflow-hidden hover:border-orange-100/50 transition-all shadow-xs"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-black text-[#FF8A00] bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-orange-100/30">
                                    Round {int.round_number}
                                  </span>
                                  {int.status !== "completed" && (
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                      int.status === "no_show" 
                                        ? "text-amber-600 bg-amber-50 border-amber-100" 
                                        : "text-purple-600 bg-purple-50 border-purple-100"
                                    }`}>
                                      {int.status === "no_show" ? "No Show" : "Not Conducted"}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">
                                  {format(new Date(int.updated_at), "MMM dd, yyyy")}
                                </span>
                              </div>
                              <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight mb-2">
                                {int.round_name}
                              </p>
                              {int.feedback && (
                                <div className="relative mt-2 pl-3.5 border-l-2 border-slate-200 bg-slate-50/40 p-2.5 rounded-r-lg">
                                  <p className="text-[11px] text-slate-600 font-medium italic leading-relaxed">
                                    &quot;{int.feedback}&quot;
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </div>

      {showScheduler && (
        <InterviewScheduler
          candidateName={candidate.full_name}
          applicationId={applicationId}
          jobTitle={jobTitle}
          initialRoundNumber={interviews.length + 1}
          onClose={() => setShowScheduler(false)}
          onSuccess={() => {
            setShowScheduler(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {showFeedbackModal && activeInterview && applicationId && (
        <InterviewFeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          interviewId={activeInterview.id}
          applicationId={applicationId}
          candidateName={candidate.full_name}
          roundName={activeInterview.round_name}
          recruiterJoinedAt={activeInterview.recruiter_joined_at}
          candidateJoinedAt={activeInterview.candidate_joined_at}
          onSuccess={() => {
            setShowFeedbackModal(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
