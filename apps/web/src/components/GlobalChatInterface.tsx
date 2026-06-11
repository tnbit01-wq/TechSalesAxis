'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useChatViewStore } from '@/hooks/useChatViewStore';
import {
  Mic, Send, X, Plus, LayoutDashboard, MicOff, Brain,
  Briefcase, Users, Building2, BarChart3, ShieldCheck,
  Target, AlertCircle, User, ExternalLink, ArrowRight,
  Trash2, Clock, ChevronRight, Sparkles, FileText,
  TrendingUp, Search, CheckCircle2, Loader2, Bookmark,
  MapPin, DollarSign, Star, Award, UserCheck, UserX,
  ClipboardList, Navigation, MessageSquare, Zap, Edit2,
  Calendar, XCircle, Lock,
} from 'lucide-react';
import { awsAuth } from '@/lib/awsAuth';
import { apiClient } from '@/lib/apiClient';
import RejectionModal from '@/components/RejectionModal';
import InterviewScheduler from '@/components/InterviewScheduler';
import CandidateProfileModal from '@/components/CandidateProfileModal';
import JobInviteModal from '@/components/JobInviteModal';
import { toast } from 'sonner';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type DataType =
  | 'candidate_list'
  | 'candidate_profile'
  | 'resume_info'
  | 'job_list'
  | 'company_list'
  | 'market_data'
  | 'application_list'
  | 'career_gps'
  | 'job_draft'
  | 'application_confirm'
  | 'application_cards'
  | 'schedule_interview'
  | 'recommendations_locked'
  | 'none'
  | 'error';

interface ActionCard {
  label: string;
  url: string;
  icon: string;
  type?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  data_type?: DataType;
  data_results?: any[];
  action_cards?: ActionCard[];
  feature_prompts?: string[];
  next_steps?: string[];
  intent?: string;
  isStreaming?: boolean;
}

interface SessionSummary {
  id: string;
  session_title?: string;
  last_intent?: string;
  last_data_summary?: string;
  message_count?: number;
  updated_at?: string;
}

// ─────────────────────────────────────────────
// Role-aware placeholder hints
// ─────────────────────────────────────────────

const RECRUITER_HINTS = [
  'Find candidates with Salesforce and SaaS experience…',
  'Show me top enterprise sales candidates in Bangalore…',
  'Which roles are in high demand right now?',
  'Find all candidates, including passive talent…',
  'Show applications pending review…',
  'Search for SDR candidates with 2–4 years experience…',
];

const CANDIDATE_HINTS = [
  'Find SaaS account executive jobs in Bangalore…',
  'Show me companies hiring for enterprise sales roles…',
  'What roles are trending in the market right now?',
  'Check my Career GPS milestones…',
  'Show my recent job applications…',
  'Find remote inside sales roles with 8+ LPA…',
];

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const SESSION_KEY = 'ai_chat_session_id';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  user:        ({ className }) => <User          className={className} />,
  file:        ({ className }) => <FileText      className={className} />,
  users:       ({ className }) => <Users         className={className} />,
  briefcase:   ({ className }) => <Briefcase     className={className} />,
  send:        ({ className }) => <Send          className={className} />,
  search:      ({ className }) => <Search        className={className} />,
  building:    ({ className }) => <Building2     className={className} />,
  building2:   ({ className }) => <Building2     className={className} />,
  plus:        ({ className }) => <Plus          className={className} />,
  chart:       ({ className }) => <BarChart3     className={className} />,
  clipboard:   ({ className }) => <ClipboardList className={className} />,
  link:        ({ className }) => <ExternalLink  className={className} />,
  bookmark:    ({ className }) => <Bookmark      className={className} />,
  target:      ({ className }) => <Target        className={className} />,
};

function CardIcon({ name, className }: { name: string; className?: string }) {
  const Comp = ICON_MAP[name] || ICON_MAP['link'];
  return <Comp className={className} />;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function useRotatingPlaceholder(hints: string[], interval = 3500) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % hints.length), interval);
    return () => clearInterval(t);
  }, [hints, interval]);
  return hints[idx];
}

// ─────────────────────────────────────────────
// Candidate Card — shows verified vs passive
// ─────────────────────────────────────────────

function CandidateCards({
  items,
  role,
  onAction,
  hasAccessToPersonalInfo,
  getDisplayName,
  onOpenPdfPreview,
  onOpenProfileModal,
  onOpenInviteModal,
}: {
  items: any[];
  role: string;
  onAction: (text: string) => void;
  hasAccessToPersonalInfo?: (id: string) => boolean;
  getDisplayName?: (name: string, id: string) => string;
  onOpenPdfPreview?: (url: string, name: string) => void;
  onOpenProfileModal?: (c: any) => void;
  onOpenInviteModal?: (id: string, name: string) => void;
}) {
  const hasScores = items.some(c => typeof c.culture_match_score === 'number' || typeof c.match_score === 'number');

  const elite = items.filter(c => {
    const score = c.culture_match_score ?? c.match_score;
    return typeof score === 'number' && score >= 85;
  });
  
  const strong = items.filter(c => {
    const score = c.culture_match_score ?? c.match_score;
    return typeof score === 'number' && score >= 70 && score < 85;
  });

  const potential = items.filter(c => {
    const score = c.culture_match_score ?? c.match_score;
    return typeof score === 'number' && score >= 50 && score < 70;
  });

  const renderCard = (c: any, i: number) => {
    const isVerified = c.is_verified || c.assessment_status === 'completed' || c.assessment_status === 'verified';
    const isPassive  = c.is_passive  || (!isVerified && c.assessment_status !== 'in_progress' && c.assessment_status !== 'passive_lead');
    const isLead     = c.is_shadow   || c.assessment_status === 'passive_lead';
    const candId = c.user_id || c.id;
    const displayName = getDisplayName ? getDisplayName(c.full_name || c.name || 'Unnamed', candId) : (c.full_name || c.name || 'Unnamed');
    const score = c.culture_match_score ?? c.match_score;

    // Determine HSL matching badge styles
    let scoreBadgeStyle = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
    if (typeof score === 'number') {
      if (score >= 85) {
        scoreBadgeStyle = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      } else if (score >= 70) {
        scoreBadgeStyle = "text-amber-400 bg-amber-500/10 border-amber-500/20";
      }
    }

    return (
      <div
        key={candId || i}
        className="group bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-blue-500/30 hover:bg-zinc-800/60 transition-all duration-200"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 flex items-center justify-center flex-shrink-0 border border-white/5 relative">
              <User className="w-5 h-5 text-blue-400" />
              {/* Verified / passive / lead indicator dot */}
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-zinc-900 ${
                  isVerified ? 'bg-emerald-500' : isLead ? 'bg-amber-500' : isPassive ? 'bg-amber-500' : 'bg-blue-400'
                }`}
                title={isVerified ? 'Verified' : isLead ? 'Passive Lead (Shadow Profile)' : isPassive ? 'Passive candidate' : 'Assessment in progress'}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {displayName}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {c.current_role || 'IT Sales Professional'}
              </p>
            </div>
          </div>

          {/* Match Score Badge */}
          {typeof score === 'number' && (
            <div className={`flex flex-col items-end px-2.5 py-1 rounded-xl border ${scoreBadgeStyle} text-right flex-shrink-0 font-mono`}>
              <span className="text-[8px] font-black uppercase tracking-wider opacity-60">Match</span>
              <span className="text-sm font-bold tracking-tight">{score}%</span>
            </div>
          )}
        </div>

        {/* Skills */}
        {Array.isArray(c.skills) && c.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {c.skills.slice(0, 3).map((s: string, si: number) => (
              <span
                key={si}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/15"
              >
                {s}
              </span>
            ))}
            {c.skills.length > 3 && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                +{c.skills.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400">
            <Target className="w-3 h-3 text-zinc-600" />
            {c.years_of_experience || 0}y exp
          </span>
          {c.location && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500">
              <MapPin className="w-3 h-3" />
              {c.location}
            </span>
          )}
          {/* Verified / Passive / Lead badge */}
          {isVerified ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          ) : isLead ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <UserCheck className="w-3 h-3" />
              Shadow Profile
            </span>
          ) : isPassive ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <UserCheck className="w-3 h-3" />
              Passive
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
              <Loader2 className="w-3 h-3 animate-spin" />
              In Progress
            </span>
          )}
        </div>

        {/* Why this match reasoning */}
        {c.match_reasoning && (
          <div className="mt-3 rounded-xl border border-orange-500/10 bg-orange-500/5 p-3 text-left">
            <p className="text-[10px] font-black uppercase tracking-wider text-orange-400">Why this match</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">{c.match_reasoning}</p>
          </div>
        )}

        {/* Recruiter Actions */}
        {role === 'recruiter' && (
          <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
            <button
              onClick={() => {
                if (onOpenProfileModal) {
                  onOpenProfileModal(c);
                } else {
                  onAction(`Show profile of ${c.full_name || c.name || ''}`);
                }
              }}
              className="px-2.5 py-1 rounded bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold transition-all border border-white/10"
            >
              View Profile
            </button>
            {c.resume_path && (
              <button
                onClick={() => {
                  if (hasAccessToPersonalInfo && !hasAccessToPersonalInfo(candId)) {
                    alert("Resume is locked. You can view the resume once the candidate is shortlisted or has accepted your invitation.");
                    return;
                  }
                  if (onOpenPdfPreview) {
                    onOpenPdfPreview(c.resume_path, c.full_name || c.name || 'Candidate');
                  } else {
                    window.open(c.resume_path, '_blank');
                  }
                }}
                className={`px-2.5 py-1 rounded bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold transition-all border border-white/10 ${
                  hasAccessToPersonalInfo && !hasAccessToPersonalInfo(candId) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                View Resume
              </button>
            )}
            <button
              onClick={() => {
                if (onOpenInviteModal) {
                  onOpenInviteModal(candId, c.full_name || c.name || 'Candidate');
                } else {
                  onAction(`Invite candidate ${c.full_name || c.name || ''}`);
                }
              }}
              className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[10px] font-semibold transition-all border border-blue-500/15"
            >
              Invite
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderGroup = (title: string, list: any[], borderLeftColor: string) => {
    if (list.length === 0) return null;
    return (
      <div className="w-full space-y-2 mt-4">
        <div className={`flex items-center gap-2 border-l-4 ${borderLeftColor} pl-2.5 py-0.5`}>
          <div>
            <h4 className="text-xs font-bold text-zinc-100">{title}</h4>
            <p className="text-[10px] text-zinc-500">{list.length} candidate{list.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map((c, i) => renderCard(c, i))}
        </div>
      </div>
    );
  };

  if (hasScores) {
    return (
      <div className="w-full space-y-4">
        {renderGroup("Top Matches", elite, "border-emerald-500")}
        {renderGroup("Strong Matches", strong, "border-amber-500")}
        {renderGroup("Additional Matches", potential, "border-zinc-500")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {items.map((c, i) => renderCard(c, i))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Candidate Profile Card (detailed)
// ─────────────────────────────────────────────

function CandidateProfileCard({
  item,
  hasAccessToPersonalInfo,
  getDisplayName,
  onOpenProfileModal,
  onOpenPdfPreview,
  onAction,
  onOpenInviteModal,
}: {
  item: any;
  hasAccessToPersonalInfo?: (id: string) => boolean;
  getDisplayName?: (name: string, id: string) => string;
  onOpenProfileModal?: (c: any) => void;
  onOpenPdfPreview?: (url: string, name: string) => void;
  onAction?: (text: string) => void;
  onOpenInviteModal?: (id: string, name: string) => void;
}) {
  const candId = item.user_id || item.id;
  const isUnlocked = hasAccessToPersonalInfo ? hasAccessToPersonalInfo(candId) : true;
  const displayName = getDisplayName ? getDisplayName(item.full_name || 'Candidate', candId) : (item.full_name || 'Candidate');

  return (
    <div className="mt-3 bg-zinc-900/70 border border-white/[0.07] rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/25 to-violet-600/25 flex items-center justify-center flex-shrink-0 border border-white/5">
          <User className="w-7 h-7 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white">{displayName}</p>
          <p className="text-sm text-zinc-400 mt-0.5">{item.current_role || 'IT Sales Professional'}</p>
          {isUnlocked ? (
            <p className="text-xs text-zinc-600 mt-0.5 font-mono truncate">
              {item.email || 'No email'} · {item.phone || item.phone_number || 'No phone'}
            </p>
          ) : (
            <p className="text-xs text-amber-500/80 mt-0.5 font-mono flex items-center gap-1">
              <Lock className="w-3 h-3" /> Contact Details Locked
            </p>
          )}
        </div>
        {item.assessment_status === 'completed' && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified
          </span>
        )}
      </div>

      {!isUnlocked && (
        <div className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-400 leading-normal">
            <p className="font-semibold text-amber-300">Contact Details Masked</p>
            <p className="mt-1">Candidate contact details are hidden for privacy. They will be unmasked once the candidate accepts your invitation or is shortlisted.</p>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {item.years_of_experience != null && (
          <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-zinc-500 font-mono">Experience</p>
            <p className="text-sm font-semibold text-white mt-0.5">{item.years_of_experience} yrs</p>
          </div>
        )}
        {item.location && (
          <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-zinc-500 font-mono">Location</p>
            <p className="text-sm font-semibold text-white mt-0.5 truncate">{item.location}</p>
          </div>
        )}
        {item.profile_strength && (
          <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-zinc-500 font-mono">Profile</p>
            <p className="text-sm font-semibold text-white mt-0.5">{item.profile_strength}</p>
          </div>
        )}
      </div>

      {Array.isArray(item.skills) && item.skills.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] text-zinc-500 font-mono mb-2">SKILLS</p>
          <div className="flex flex-wrap gap-1.5">
            {item.skills.slice(0, 8).map((s: string, i: number) => (
              <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/15">
                {s}
              </span>
            ))}
            {item.skills.length > 8 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-500 border border-zinc-700">
                +{item.skills.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recruiter Actions */}
      <div className="mt-3 flex gap-2 border-t border-white/5 pt-3">
        <button
          onClick={() => {
            if (onOpenProfileModal) {
              onOpenProfileModal(item);
            }
          }}
          className="px-2.5 py-1 rounded bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold transition-all border border-white/10"
        >
          View Profile
        </button>
        {item.resume_path && (
          <button
            onClick={() => {
              if (hasAccessToPersonalInfo && !hasAccessToPersonalInfo(candId)) {
                alert("Resume is locked. You can view the resume once the candidate is shortlisted or has accepted your invitation.");
                return;
              }
              if (onOpenPdfPreview) {
                onOpenPdfPreview(item.resume_path, item.full_name || item.name || 'Candidate');
              } else {
                window.open(item.resume_path, '_blank');
              }
            }}
            className={`px-2.5 py-1 rounded bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold transition-all border border-white/10 ${
              hasAccessToPersonalInfo && !hasAccessToPersonalInfo(candId) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            View Resume
          </button>
        )}
        <button
          onClick={() => {
            if (onOpenInviteModal) {
              onOpenInviteModal(candId, item.full_name || item.name || 'Candidate');
            } else if (onAction) {
              onAction(`Invite candidate ${item.full_name || item.name || ''}`);
            }
          }}
          className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[10px] font-semibold transition-all border border-blue-500/15"
        >
          Invite
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Application Cards — pipeline details
// ─────────────────────────────────────────────

function ApplicationCards({
  items,
  onAction,
  onOpenRejectionModal,
  onOpenInterviewModal,
  onOpenProfileModal,
  getDisplayName,
  onOpenPdfPreview,
}: {
  items: any[];
  onAction: (text: string) => void;
  onOpenRejectionModal: (appId: string) => void;
  onOpenInterviewModal: (appId: string) => void;
  onOpenProfileModal: (app: any) => void;
  getDisplayName?: (name: string, id: string) => string;
  onOpenPdfPreview?: (url: string, name: string) => void;
}) {
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'applied':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'shortlisted':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'interview':
      case 'interview_scheduled':
        return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
      case 'rejected':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'offered':
        return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
      default:
        return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'interview_scheduled') return 'Interview Scheduled';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {items.map((app, i) => {
        const canShortlist = app.status === 'applied';
        const canInterview = app.status === 'shortlisted' || app.status === 'interview_scheduled' || app.status === 'interview';
        const canReject = app.status !== 'rejected' && app.status !== 'offered' && app.status !== 'closed';
        const candId = app.candidate_id || app.id;
        const displayName = getDisplayName ? getDisplayName(app.candidate_name || 'Candidate', candId) : (app.candidate_name || 'Candidate');

        return (
          <div key={i} className="group bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-blue-500/30 hover:bg-zinc-800/60 transition-all duration-200">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 flex items-center justify-center flex-shrink-0 border border-white/5">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                <p className="text-xs text-zinc-500 truncate">{app.candidate_role || 'IT Sales Professional'}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              {app.candidate_location && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {app.candidate_location}
                </span>
              )}
              {app.match_score != null && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <BarChart3 className="w-3.5 h-3.5" />
                  {Math.round(app.match_score)}% match
                </span>
              )}
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(app.status)}`}>
                {getStatusLabel(app.status)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
              <button
                onClick={() => onAction(`Show profile of ${app.candidate_name}`)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold border border-white/10 transition-all"
              >
                Profile
              </button>
              {app.resume_path && (
                <button
                  onClick={() => {
                    if (onOpenPdfPreview) {
                      onOpenPdfPreview(app.resume_path, app.candidate_name || 'Candidate');
                    } else {
                      window.open(app.resume_path, '_blank');
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold border border-white/10 transition-all"
                >
                  Resume
                </button>
              )}
              {canShortlist && (
                <button
                  onClick={() => onAction(`Shortlist candidate ${app.candidate_name}`)}
                  className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-semibold border border-emerald-500/15 transition-all"
                >
                  Shortlist
                </button>
              )}
              {canInterview && (
                <button
                  onClick={() => onOpenInterviewModal(app.id)}
                  className="px-2.5 py-1 rounded bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 text-[10px] font-semibold border border-violet-500/15 transition-all"
                >
                  Interview
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => onOpenRejectionModal(app.id)}
                  className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-semibold border border-red-500/15 transition-all"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Schedule Interview Card
// ─────────────────────────────────────────────

function ScheduleInterviewCard({
  item,
  onOpenInterviewModal,
}: {
  item: any;
  onOpenInterviewModal: (appId: string) => void;
}) {
  return (
    <div className="mt-3 bg-zinc-900/70 border border-violet-500/20 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center flex-shrink-0 border border-white/5">
          <Calendar className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Interview with {item.candidate_name}</p>
          <p className="text-xs text-zinc-500 truncate">{item.job_title}</p>
        </div>
      </div>
      <button
        onClick={() => onOpenInterviewModal(item.id)}
        className="w-full py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
      >
        <Calendar className="w-4 h-4" />
        Open Interview Scheduler
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Resume Info Card
// ─────────────────────────────────────────────

function ResumeInfoCard({ item, onOpenPdfPreview }: { item: any; onOpenPdfPreview?: (url: string, name: string) => void }) {
  const [activeTab, setActiveTab] = useState<'highlights' | 'experience' | 'education'>('highlights');

  const resumeData = item.resume_data || item.resumeData || null;

  return (
    <div className="mt-3 bg-zinc-900/70 border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-3 text-left">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 flex items-center justify-center flex-shrink-0 border border-white/5">
            <FileText className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{item.full_name || item.name || 'Candidate'}'s Resume</p>
            <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
              <span>{item.current_role || 'Sales Professional'}</span>
              <span>•</span>
              <span>{item.location || 'Remote'}</span>
            </p>
          </div>
        </div>

        {/* View PDF Button */}
        {item.resume_path && onOpenPdfPreview && (
          <button
            onClick={() => onOpenPdfPreview(item.resume_path, item.full_name || item.name || 'Candidate')}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold border border-white/10 transition-all flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Quick Preview
          </button>
        )}
      </div>

      {/* Tabs Selection (only show if resumeData is present) */}
      {resumeData ? (
        <div className="flex border-b border-white/5 pb-1 gap-4 mt-2">
          {(['highlights', 'experience', 'education'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[10px] font-bold uppercase tracking-wider pb-1 transition-all border-b-2 capitalize ${
                activeTab === tab
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      ) : (
        item.parsed_data && (
          <div className="text-xs text-zinc-400 bg-zinc-800/50 rounded-xl p-3 border border-white/5 font-mono whitespace-pre-wrap line-clamp-4">
            {typeof item.parsed_data === 'string'
              ? item.parsed_data.slice(0, 300)
              : JSON.stringify(item.parsed_data).slice(0, 300)}
            {' '}…
          </div>
        )
      )}

      {/* Tab Content */}
      {resumeData && (
        <div className="mt-2 text-xs">
          {activeTab === 'highlights' && (
            <div className="space-y-3">
              {/* Skills cloud */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">Key Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {resumeData.skills && resumeData.skills.length > 0 ? (
                    resumeData.skills.map((skill: string, idx: number) => (
                      <span key={idx} className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-white/5 font-mono text-[9px]">
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-zinc-500 italic">No skills listed</span>
                  )}
                </div>
              </div>

              {/* Achievements */}
              {resumeData.achievements && (() => {
                let achievementsList: string[] = [];
                if (Array.isArray(resumeData.achievements)) {
                  const isCharArray = resumeData.achievements.every(item => typeof item === 'string' && item.length <= 1);
                  if (isCharArray) {
                    achievementsList = [resumeData.achievements.join('')];
                  } else {
                    achievementsList = resumeData.achievements;
                  }
                } else if (typeof resumeData.achievements === 'string') {
                  achievementsList = [resumeData.achievements];
                }
                
                if (achievementsList.length === 0) return null;

                return (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">Key Achievements</p>
                    <ul className="list-disc pl-4 space-y-1 text-zinc-400 text-[11px] leading-relaxed">
                      {achievementsList.map((ach: string, idx: number) => (
                        <li key={idx}>{ach}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'experience' && (
            <div className="space-y-4">
              {resumeData.timeline && resumeData.timeline.length > 0 ? (
                resumeData.timeline.map((exp: any, idx: number) => (
                  <div key={idx} className="relative pl-4 border-l border-white/5 last:border-transparent">
                    <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-violet-600/30 border border-violet-500 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    </div>
                    <div className="flex justify-between items-start flex-wrap gap-1">
                      <h4 className="font-semibold text-zinc-200 text-xs">{exp.role || 'Sales Executive'}</h4>
                      <span className="text-[9px] font-mono text-zinc-500">
                        {exp.start || 'N/A'} - {exp.end || 'Present'}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{exp.company || 'Company'} • {exp.location || 'Remote'}</p>
                    {exp.description && (
                      <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{exp.description}</p>
                    )}
                    {exp.key_achievements && exp.key_achievements.length > 0 && (
                      <ul className="list-disc pl-3 mt-1.5 space-y-0.5 text-[10px] text-zinc-400 leading-normal">
                        {exp.key_achievements.map((ka: string, kIdx: number) => (
                          <li key={kIdx}>{ka}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 italic">No experience history listed</p>
              )}
            </div>
          )}

          {activeTab === 'education' && (
            <div className="space-y-3">
              {resumeData.education && resumeData.education.length > 0 ? (
                resumeData.education.map((edu: any, idx: number) => (
                  <div key={idx} className="bg-zinc-800/25 border border-white/5 rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-zinc-200 text-xs">{edu.degree || 'Degree'}</h4>
                      {edu.years && (
                        <span className="text-[9px] font-mono text-zinc-500">{edu.years}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{edu.school || 'Institution'}</p>
                    {edu.field && (
                      <p className="text-[10px] text-zinc-500 font-mono mt-1">Field of Study: {edu.field}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-zinc-500 italic">No education details listed</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer Meta */}
      <p className="mt-1 text-[9px] text-zinc-600 font-mono">
        Uploaded {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : '—'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Job Cards
// ─────────────────────────────────────────────

function JobCards({ items, role, onAction }: { items: any[]; role: string; onAction: (text: string) => void }) {
  const getJobStatusStyle = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'open':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'paused':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default:
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }
  };

  const getJobStatusLabel = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'open':
        return 'Open';
      case 'paused':
        return 'Paused';
      default:
        return 'Closed';
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {items.map((job, i) => (
        <div key={i} className="group bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-emerald-500/30 hover:bg-zinc-800/60 transition-all duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0 border border-white/5">
              <Briefcase className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {job.title || job.job_title || 'Role'}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {job.company_name || 'Company'}{job.location ? ` · ${job.location}` : ''}
              </p>
              {job.salary_range && (
                <p className="text-[11px] text-zinc-600 mt-0.5 inline-flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {job.salary_range}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                {typeof job.match_score === 'number' && job.match_score > 0 && (
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {Math.round(job.match_score)}% match
                  </span>
                )}
                {job.experience_band && (
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                    {job.experience_band}
                  </span>
                )}
                {job.job_type && (
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/50 border border-zinc-700/50 px-2 py-0.5 rounded-full">
                    {job.job_type}
                  </span>
                )}
                {role === 'recruiter' && job.status && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${getJobStatusStyle(job.status)}`}>
                    {getJobStatusLabel(job.status)}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              {role === 'candidate' ? (
                <button
                  onClick={() => onAction(`Apply for job ${job.title || job.job_title}`)}
                  className="mt-3 w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-semibold shadow-md transition-all active:scale-95"
                >
                  Apply Now
                </button>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
                  <button
                    onClick={() => onAction(`Show applications for ${job.title || job.job_title}`)}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-semibold border border-white/10 transition-all"
                    title="View Pipeline Applications"
                  >
                    Applications
                  </button>
                  {(() => {
                    const statusNormalized = job.status?.toLowerCase() || 'active';
                    return (
                      <>
                        {(statusNormalized === 'paused' || statusNormalized === 'closed') && (
                          <button
                            onClick={() => onAction(`Open job ${job.title || job.job_title}`)}
                            className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-semibold border border-emerald-500/15 transition-all"
                          >
                            Open
                          </button>
                        )}
                        {(statusNormalized === 'active' || statusNormalized === 'open') && (
                          <button
                            onClick={() => onAction(`Pause hiring for ${job.title || job.job_title}`)}
                            className="px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[10px] font-semibold border border-amber-500/15 transition-all"
                          >
                            Pause
                          </button>
                        )}
                        {(statusNormalized === 'active' || statusNormalized === 'open') && (
                          <button
                            onClick={() => onAction(`Close job ${job.title || job.job_title}`)}
                            className="px-2 py-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[10px] font-semibold border border-rose-500/15 transition-all"
                          >
                            Close
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <button
                    onClick={() => onAction(`Delete job ${job.title || job.job_title}`)}
                    className="px-2 py-1 rounded bg-zinc-950 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 text-[10px] font-semibold border border-white/5 transition-all ml-auto"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Job Draft Preview (inline creation)
// ─────────────────────────────────────────────

function JobDraftCard({ item, onConfirm, onCancel }: { item: any; onConfirm: (updatedData: any) => void; onCancel: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title || '');
  const [location, setLocation] = useState(item.location || '');
  const [jobType, setJobType] = useState(item.job_type || 'onsite');
  const [salaryRange, setSalaryRange] = useState(item.salary_range || '');
  const [experienceBand, setExperienceBand] = useState(item.experience_band || 'mid');
  const [skills, setSkills] = useState(
    Array.isArray(item.skills_required) 
      ? item.skills_required.join(', ') 
      : (item.skills_required || '')
  );
  const [requirements, setRequirements] = useState(
    Array.isArray(item.requirements) 
      ? item.requirements.join('\n') 
      : (item.requirements || '')
  );
  const [description, setDescription] = useState(item.description || '');

  const [salaryLoading, setSalaryLoading] = useState(false);
  const [checkingPotential, setCheckingPotential] = useState(false);
  const [matchPotential, setMatchPotential] = useState<any | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleAutoDetectSalary = async () => {
    if (!title || !location) {
      alert("Please specify Job Title and Location first.");
      return;
    }
    setSalaryLoading(true);
    try {
      const res = await fetch(`${apiBase}/recruiter/jobs/generate-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${awsAuth.getToken()}`,
        },
        body: JSON.stringify({
          prompt: `Recalculate ONLY salary for role "${title}" in location "${location}" for ${experienceBand} level.`,
          experience_band: experienceBand,
          location: location,
        }),
      });

      if (!res.ok) throw new Error('Salary calculation failed');
      const result = await res.json();
      if (result.salary_range) {
        setSalaryRange(result.salary_range);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to auto-detect salary.");
    } finally {
      setSalaryLoading(false);
    }
  };

  const handleCheckMatchPotential = async () => {
    setCheckingPotential(true);
    setMatchPotential(null);
    try {
      const bandToYears: Record<string, number> = {
        'fresher': 0,
        'mid': 3,
        'senior': 7,
        'leadership': 12
      };

      const skillsList = skills.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');

      const res = await fetch(`${apiBase}/recruiter/check-job-potential`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${awsAuth.getToken()}`,
        },
        body: JSON.stringify({
          skills: skillsList,
          experience_years: bandToYears[experienceBand] || 2,
          location,
          salary_range: salaryRange,
          title,
        }),
      });

      if (!res.ok) throw new Error('Failed to fetch matching talent');
      const result = await res.json();
      setMatchPotential(result);
    } catch (err) {
      console.error(err);
      setMatchPotential({
        count: 0,
        message: 'Unable to check matching talent. Please try again.',
        data: []
      });
    } finally {
      setCheckingPotential(false);
    }
  };

  const handlePublish = () => {
    const updated = {
      title,
      location,
      job_type: jobType,
      salary_range: salaryRange,
      experience_band: experienceBand,
      skills_required: skills.split(',').map((s: string) => s.trim()).filter((s: string) => s !== ''),
      requirements: requirements.split('\n').map((r: string) => r.trim()).filter((r: string) => r !== ''),
      description,
    };
    onConfirm(updated);
  };

  if (isEditing) {
    return (
      <div className="mt-3 bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-5 space-y-4 text-left">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          <p className="text-sm font-semibold text-amber-300">Edit Job Draft</p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. Senior Business Development Manager"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                placeholder="e.g. Dallas, TX"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Job Type</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 font-medium"
              >
                <option value="onsite">Onsite</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Salary Range</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={salaryRange}
                  onChange={(e) => setSalaryRange(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  placeholder="e.g. $80k - $120k"
                />
                <button
                  type="button"
                  onClick={handleAutoDetectSalary}
                  disabled={salaryLoading || !location}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[10px] font-bold uppercase tracking-wider text-white transition-all whitespace-nowrap"
                >
                  {salaryLoading ? 'Detecting...' : 'Auto Detect'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Experience Band</label>
              <select
                value={experienceBand}
                onChange={(e) => setExperienceBand(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 font-medium"
              >
                <option value="fresher">Fresher</option>
                <option value="mid">Mid-Level</option>
                <option value="senior">Senior</option>
                <option value="leadership">Leadership</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Skills (comma-separated)</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              placeholder="e.g. SaaS, Enterprise Sales, Negotiation"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Requirements (one per line)</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
              placeholder="e.g. 5+ years of B2B sales experience&#10;Track record of quota attainment"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-y"
              placeholder="Provide a description of the company and role..."
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 justify-end border-t border-white/5 pt-3">
          <button
            onClick={() => {
              setTitle(item.title || '');
              setLocation(item.location || '');
              setJobType(item.job_type || 'onsite');
              setSalaryRange(item.salary_range || '');
              setExperienceBand(item.experience_band || 'mid');
              setSkills(Array.isArray(item.skills_required) ? item.skills_required.join(', ') : (item.skills_required || ''));
              setRequirements(Array.isArray(item.requirements) ? item.requirements.join('\n') : (item.requirements || ''));
              setDescription(item.description || '');
              setIsEditing(false);
            }}
            className="px-3 py-1.5 rounded-xl border border-white/10 hover:bg-zinc-800 text-xs font-medium text-zinc-400 hover:text-white transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white border border-white/10 shadow-lg transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 bg-zinc-900/70 border border-amber-500/20 rounded-2xl p-5 text-left">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          <p className="text-sm font-semibold text-amber-300">Draft Job Posting</p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg transition-all"
        >
          Edit Draft
        </button>
      </div>
      <div className="space-y-2 text-xs">
        <p><strong className="text-zinc-400">Title:</strong> <span className="text-white font-medium">{title}</span></p>
        <p><strong className="text-zinc-400">Location:</strong> <span className="text-zinc-300">{location} ({jobType})</span></p>
        <p><strong className="text-zinc-400">Salary Range:</strong> <span className="text-zinc-300">{salaryRange}</span></p>
        <p><strong className="text-zinc-400">Experience Band:</strong> <span className="text-zinc-300">{experienceBand}</span></p>
        {skills && (
          <p>
            <strong className="text-zinc-400">Skills Required:</strong>{' '}
            <span className="text-blue-300 font-mono">{skills}</span>
          </p>
        )}
        {requirements && (
          <div className="mt-1">
            <strong className="text-zinc-400">Requirements:</strong>
            <ul className="list-disc list-inside pl-1 text-zinc-300 space-y-0.5 mt-0.5">
              {requirements.split('\n').map((r: string, idx: number) => (
                <li key={idx} className="truncate">{r}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="border-t border-white/5 pt-2 mt-2 text-zinc-400 whitespace-pre-wrap text-[11px] leading-relaxed">
          {description}
        </p>
      </div>

      {matchPotential && (
        <div className={`mt-4 border-t border-white/5 pt-4 space-y-2 rounded-xl p-3 text-left ${matchPotential.count === 0 ? 'bg-amber-500/5 border border-amber-500/10' : 'bg-emerald-500/5 border border-emerald-500/10'}`}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Matching Talent Preview
            </p>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${matchPotential.count === 0 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
              {matchPotential.count} candidate{matchPotential.count !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-normal">{matchPotential.message}</p>
          
          {matchPotential.data && matchPotential.data.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {matchPotential.data.map((cand: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/40 border border-white/[0.03] text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{cand.full_name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{cand.current_role} · {cand.location}</p>
                  </div>
                  {cand.match_score !== undefined && (
                    <span className="text-[9px] font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                      {Math.round(cand.match_score)}% match
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleCheckMatchPotential}
          disabled={checkingPotential}
          className="mr-auto px-3 py-1.5 rounded-xl border border-white/10 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
        >
          {checkingPotential ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Target className="w-3.5 h-3.5 text-zinc-400" />
          )}
          Preview Talent
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl border border-white/10 hover:bg-zinc-800 text-xs font-medium text-zinc-400 hover:text-white transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handlePublish}
          className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-semibold text-white shadow-lg transition-all"
        >
          Publish Job
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Application Confirmation (inline application)
// ─────────────────────────────────────────────

function ApplicationConfirmCard({ item, onConfirm, onCancel }: { item: any; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="mt-3 bg-zinc-900/70 border border-blue-500/20 rounded-2xl p-4">
      <p className="text-xs text-zinc-400 font-medium mb-1">Confirming application for:</p>
      <p className="text-sm font-semibold text-white">{item.title}</p>
      <p className="text-xs text-zinc-500 mb-3">{item.company_name} · {item.location}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl border border-white/10 hover:bg-zinc-800 text-xs font-medium text-zinc-400 hover:text-white transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg transition-all"
        >
          Confirm and Apply
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Company Cards
// ─────────────────────────────────────────────

function CompanyCards({ items }: { items: any[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {items.map((co, i) => (
        <div key={i} className="group bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-indigo-500/30 hover:bg-zinc-800/60 transition-all duration-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 border border-white/5">
              <Building2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {co.company_name || co.name || 'Company'}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {co.industry || 'Tech'}{co.location ? ` · ${co.location}` : ''}
              </p>
              {co.size_band && (
                <p className="text-[11px] text-zinc-600 mt-0.5">{co.size_band}</p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {typeof co.open_jobs === 'number' && co.open_jobs > 0 && (
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {co.open_jobs} open role{co.open_jobs !== 1 ? 's' : ''}
                  </span>
                )}
                {typeof co.match_score === 'number' && (
                  <span className="text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                    {Math.round(co.match_score)}% culture fit
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Market Data Chart
// ─────────────────────────────────────────────

function MarketData({ items }: { items: any[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="mt-3 space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-zinc-400 w-40 truncate flex-shrink-0">{item.label}</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-emerald-400 w-8 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Application List
// ─────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  applied:     'text-blue-400 bg-blue-500/10 border-blue-500/20',
  shortlisted: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  interview:   'text-violet-400 bg-violet-500/10 border-violet-500/20',
  hired:       'text-teal-400 bg-teal-500/10 border-teal-500/20',
  rejected:    'text-red-400 bg-red-500/10 border-red-500/20',
  pending:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

function ApplicationList({ items, role }: { items: any[]; role: string }) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((app, i) => {
        const statusStyle = STATUS_STYLES[app.status?.toLowerCase()] || STATUS_STYLES.pending;
        return (
          <div key={i} className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              {role === 'recruiter' ? (
                <>
                  <p className="text-sm font-semibold text-white truncate">{app.candidate_name || 'Candidate'}</p>
                  <p className="text-xs text-zinc-500 truncate">{app.job_title || 'Role'}</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white truncate">{app.job_title || 'Role'}</p>
                  <p className="text-xs text-zinc-500 truncate">{app.company_name || 'Company'}</p>
                </>
              )}
            </div>
            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle}`}>
              {(app.status || 'pending').charAt(0).toUpperCase() + (app.status || 'pending').slice(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Career GPS
// ─────────────────────────────────────────────

function CareerGPSCards({ items }: { items: any[] }) {
  return (
    <div className="mt-3 space-y-2">
      {items.map((m, i) => (
        <div key={i} className="bg-zinc-900/60 border border-white/[0.06] rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center flex-shrink-0 border border-white/5">
            <Navigation className="w-4 h-4 text-teal-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{m.milestone_title || 'Milestone'}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            m.milestone_status === 'completed'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
          }`}>
            {m.milestone_status || 'pending'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Feature Prompts (proactive nudge chips)
// ─────────────────────────────────────────────

function FeaturePrompts({
  prompts,
  onSend,
}: {
  prompts: string[];
  onSend: (text: string) => void;
}) {
  if (!prompts || prompts.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <div className="w-full flex items-center gap-1.5 mb-1">
        <Zap className="w-3 h-3 text-amber-500" />
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          Next actions
        </span>
      </div>
      {prompts.map((p, i) => (
        <button
          key={i}
          onClick={() => onSend(p)}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/60 border border-amber-500/15 hover:border-amber-500/40 hover:bg-amber-500/5 transition-all text-xs text-zinc-400 hover:text-amber-300"
        >
          <Sparkles className="w-3 h-3 text-amber-500/60 group-hover:text-amber-400 flex-shrink-0" />
          {p}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Action Cards (redirect buttons)
// ─────────────────────────────────────────────

function ActionCards({
  cards,
  onNavigate,
}: {
  cards: ActionCard[];
  onNavigate: (url: string) => void;
}) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {cards.map((card, i) => (
        <button
          key={i}
          onClick={() => onNavigate(card.url)}
          className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/80 border border-white/[0.07] hover:border-blue-500/40 hover:bg-blue-600/10 transition-all duration-200 text-xs font-medium text-zinc-300 hover:text-blue-300"
        >
          <CardIcon name={card.icon} className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition-colors flex-shrink-0" />
          {card.label}
          <ChevronRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────

function MessageBubble({
  msg,
  onNavigate,
  onSendPrompt,
  userRole,
  index,
  editingIndex,
  setEditingIndex,
  onResendMessage,
  onOpenRejectionModal,
  onOpenInterviewModal,
  onOpenProfileModal,
  hasAccessToPersonalInfo,
  getDisplayName,
  onOpenPdfPreview,
  onOpenInviteModal,
}: {
  msg: ChatMessage;
  onNavigate: (url: string) => void;
  onSendPrompt: (text: string) => void;
  userRole: string;
  index: number;
  editingIndex: number | null;
  setEditingIndex: (idx: number | null) => void;
  onResendMessage: (index: number, newText: string) => void;
  onOpenRejectionModal?: (appId: string) => void;
  onOpenInterviewModal?: (appId: string) => void;
  onOpenProfileModal?: (app: any) => void;
  hasAccessToPersonalInfo?: (id: string) => boolean;
  getDisplayName?: (name: string, id: string) => string;
  onOpenPdfPreview?: (url: string, name: string) => void;
  onOpenInviteModal?: (id: string, name: string) => void;
}) {
  const isUser = msg.role === 'user';
  const isEditing = index === editingIndex;
  const [editText, setEditText] = useState(msg.content);

  useEffect(() => {
    setEditText(msg.content);
  }, [msg.content]);

  const renderData = () => {
    const hasData = msg.data_results && msg.data_results.length > 0;

    return (
      <>
        {msg.data_type === 'error' && (
          <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">Connection issue. Please retry.</p>
          </div>
        )}
        {hasData && msg.data_type === 'candidate_list'    && (
          <CandidateCards
            items={msg.data_results!}
            role={userRole}
            onAction={onSendPrompt}
            hasAccessToPersonalInfo={hasAccessToPersonalInfo}
            getDisplayName={getDisplayName}
            onOpenPdfPreview={onOpenPdfPreview}
            onOpenProfileModal={onOpenProfileModal}
            onOpenInviteModal={onOpenInviteModal}
          />
        )}
        {hasData && msg.data_type === 'candidate_profile' && (
          <CandidateProfileCard
            item={msg.data_results![0]}
            hasAccessToPersonalInfo={hasAccessToPersonalInfo}
            getDisplayName={getDisplayName}
            onOpenProfileModal={onOpenProfileModal}
            onOpenPdfPreview={onOpenPdfPreview}
            onAction={onSendPrompt}
            onOpenInviteModal={onOpenInviteModal}
          />
        )}
        {hasData && msg.data_type === 'resume_info'       && <ResumeInfoCard item={msg.data_results![0]} onOpenPdfPreview={onOpenPdfPreview} />}
        {hasData && msg.data_type === 'job_list'          && <JobCards items={msg.data_results!} role={userRole} onAction={onSendPrompt} />}
        {hasData && msg.data_type === 'company_list'      && <CompanyCards items={msg.data_results!} />}
        {hasData && msg.data_type === 'market_data'       && <MarketData items={msg.data_results!} />}
        {hasData && msg.data_type === 'application_list'  && <ApplicationList items={msg.data_results!} role={userRole} />}
        {hasData && msg.data_type === 'career_gps'        && <CareerGPSCards items={msg.data_results!} />}
        {hasData && msg.data_type === 'application_cards' && onOpenRejectionModal && onOpenInterviewModal && onOpenProfileModal && (
          <ApplicationCards
            items={msg.data_results!}
            onAction={onSendPrompt}
            onOpenRejectionModal={onOpenRejectionModal}
            onOpenInterviewModal={onOpenInterviewModal}
            onOpenProfileModal={onOpenProfileModal}
            getDisplayName={getDisplayName}
            onOpenPdfPreview={onOpenPdfPreview}
          />
        )}
        {hasData && msg.data_type === 'schedule_interview' && onOpenInterviewModal && (
          <ScheduleInterviewCard
            item={msg.data_results![0]}
            onOpenInterviewModal={onOpenInterviewModal}
          />
        )}
        {msg.data_type === 'recommendations_locked' && (
          <div className="mt-3 bg-zinc-900/70 border border-amber-500/20 rounded-2xl p-5 text-left max-w-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-wider">Recommendations Locked</p>
                <p className="text-xs text-zinc-500">TechSales Axis DNA Assessment Pending</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
              This high-impact transmission channel is currently disabled. To unlock Recommended Talent and other advanced recruiter features, your company must complete the TechSales Axis DNA Assessment.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onNavigate('/onboarding/recruiter')}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                Complete Assessment
              </button>
            </div>
          </div>
        )}

        {/* Conversational workflows cards */}
        {hasData && msg.data_type === 'job_draft'         && (
          <JobDraftCard
            item={msg.data_results![0]}
            onConfirm={(updatedItem) => onSendPrompt('confirm publish_job_draft ' + JSON.stringify(updatedItem))}
            onCancel={() => onSendPrompt('cancel')}
          />
        )}
        {hasData && msg.data_type === 'application_confirm' && (
          <ApplicationConfirmCard
            item={msg.data_results![0]}
            onConfirm={() => onSendPrompt('confirm')}
            onCancel={() => onSendPrompt('cancel')}
          />
        )}

        {/* Action cards — always show if present, regardless of data */}
        {msg.action_cards && msg.action_cards.length > 0 && (
          <ActionCards cards={msg.action_cards} onNavigate={onNavigate} />
        )}

        {/* Proactive feature nudge chips */}
        {msg.feature_prompts && msg.feature_prompts.length > 0 && (
          <FeaturePrompts prompts={msg.feature_prompts} onSend={onSendPrompt} />
        )}
      </>
    );
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mr-3 mt-1">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl relative ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm shadow-lg shadow-blue-900/20'
              : 'bg-zinc-900/70 border border-white/[0.06] text-zinc-100 rounded-tl-sm backdrop-blur-sm'
          }`}
        >
          {msg.isStreaming ? (
            <div className="flex items-center gap-2">
              <span className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
              <span className="text-sm text-zinc-400">Thinking…</span>
            </div>
          ) : isEditing ? (
            <div className="flex flex-col gap-2 min-w-[250px] sm:min-w-[350px]">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 resize-y"
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingIndex(null)}
                  className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold transition-all border border-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onResendMessage(index, editText)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[10px] font-semibold transition-all shadow-md"
                >
                  Save & Submit
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap flex-1">
                  {msg.content.startsWith('confirm publish_job_draft ')
                    ? 'Confirming and publishing the edited job draft...'
                    : msg.content}
                </p>
                {isUser && !msg.content.startsWith('confirm publish_job_draft ') && (
                  <button
                    onClick={() => setEditingIndex(index)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-zinc-300 transition-all flex-shrink-0"
                    title="Edit message"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {!isUser && renderData()}
            </>
          )}
          <span className="mt-2 block text-[9px] font-mono opacity-30 uppercase tracking-widest">
            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function GlobalChatInterface() {
  const { isChatMode, toggleChatMode } = useChatViewStore();
  const pathname = usePathname();
  const router   = useRouter();

  const userInfo = typeof window !== 'undefined' ? awsAuth.getUser() : null;
  const userRole = ((userInfo as any)?.role as string | undefined) || '';

  // ── State ──────────────────────────────────
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionId,   setSessionId]   = useState<string | null>(null);
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [greetingLoaded, setGreetingLoaded] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Modals state
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [pdfModal, setPdfModal] = useState<{
    isOpen: boolean;
    url: string | null;
    candidateName: string;
  }>({ isOpen: false, url: null, candidateName: '' });
  const [profileModal, setProfileModal] = useState<{
    isOpen: boolean;
    candidate: any;
    resumeData: any;
    jobTitle?: string;
    appliedDate?: string;
    score?: number;
    status?: string;
    initialTab?: "profile" | "resume" | "interview" | "activity";
    applicationId?: string;
    interviews?: any[];
    initialFeedbackOpen?: boolean;
    isDiscovery?: boolean;
  }>({ isOpen: false, candidate: null, resumeData: null });

  // Access control state & helpers
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [chatThreads, setChatThreads] = useState<any[]>([]);
  const [threadMessages, setThreadMessages] = useState<Record<string, any[]>>({});
  const [jobs, setJobs] = useState<any[]>([]);
  const [inviteModal, setInviteModal] = useState<{
    isOpen: boolean;
    candidateId: string;
    candidateName: string;
  }>({ isOpen: false, candidateId: '', candidateName: '' });

  const fetchAccessControlData = useCallback(async () => {
    if (userRole !== 'recruiter') return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const [pipelineResponse, threadsResponse, jobsResponse] = await Promise.all([
        apiClient.get("/recruiter/applications/pipeline", token).catch(() => []),
        apiClient.get("/chat/threads", token).catch(() => []),
        apiClient.get("/recruiter/jobs", token).catch(() => []),
      ]);

      setPipelineData(pipelineResponse || []);
      setChatThreads(threadsResponse || []);
      setJobs(jobsResponse || []);

      const messagesMap: Record<string, any[]> = {};
      if (threadsResponse && threadsResponse.length > 0) {
        await Promise.all(
          threadsResponse.map(async (t: any) => {
            try {
              const msgs = await apiClient.get(`/chat/messages/${t.id}`, token);
              messagesMap[t.candidate_id] = msgs || [];
            } catch (err) {
              console.error("Failed to fetch thread messages:", err);
            }
          })
        );
      }
      setThreadMessages(messagesMap);
    } catch (err) {
      console.error("Error fetching access control data:", err);
    }
  }, [userRole]);

  useEffect(() => {
    if (isChatMode && userRole === 'recruiter') {
      fetchAccessControlData();
    }
  }, [isChatMode, userRole, fetchAccessControlData]);

  const hasAccessToPersonalInfo = useCallback((candidateId: string): boolean => {
    // Check if the candidate has rejected the invitation (thread is inactive)
    const thread = chatThreads.find(t => t.candidate_id === candidateId);
    if (thread && !thread.is_active) {
      return false;
    }

    // Check pipeline for: applied, shortlisted, or invited with reply
    const candidateApplications = pipelineData.filter(app => app.candidate_id === candidateId || app.app?.candidate_id === candidateId);
    
    const hasApplicationAccess = candidateApplications.some(app => {
      const appStatus = (app.status || app.app?.status || '').toLowerCase();
      // If application is explicitly rejected, lock the personal details
      if (appStatus === 'rejected') return false;

      const isSensitiveStatus = ['applied', 'shortlisted', 'interview_scheduled', 'offered', 'hired'].includes(appStatus);
      
      // Check if invited and has unread/replied messages
      const hasInviteReply = app.invite_message_replied || app.has_replied_to_invite || false;
      
      return isSensitiveStatus || hasInviteReply;
    });

    if (hasApplicationAccess) return true;

    // Check if the candidate has replied to a chat thread
    if (thread && thread.is_active) {
      const msgs = threadMessages[candidateId] || [];
      const hasReplied = msgs.some(m => m.sender_id === candidateId);
      if (hasReplied) return true;
    }

    return false;
  }, [pipelineData, chatThreads, threadMessages]);

  const getDisplayName = useCallback((fullName: string, candidateId: string): string => {
    if (hasAccessToPersonalInfo(candidateId)) {
      return fullName;
    }
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}**** ${parts[parts.length - 1].charAt(0)}****`;
    }
    return parts[0].charAt(0) + '****';
  }, [hasAccessToPersonalInfo]);

  const handleOpenRejectionModal = (appId: string) => {
    setActiveApplicationId(appId);
    setIsRejectionModalOpen(true);
  };

  const handleOpenInterviewModal = (appId: string) => {
    setActiveApplicationId(appId);
    setIsInterviewModalOpen(true);
  };

  const handleOpenPdfPreview = (url: string, candidateName: string) => {
    setPdfModal({
      isOpen: true,
      url,
      candidateName: candidateName || 'Candidate'
    });
  };

  const handleOpenProfileModal = (item: any) => {
    const isApp = !!item.job_title || !!item.job_id || !!item.candidate_name;
    if (isApp) {
      setProfileModal({
        isOpen: true,
        candidate: {
          id: item.candidate_id,
          full_name: item.candidate_name,
          email: item.candidate_email || "",
          phone: "",
          location: item.candidate_location || "",
          current_role: item.candidate_role || "",
          skills: item.resume_data?.skills || [],
          resume_path: item.resume_path || "",
        },
        resumeData: item.resume_data || null,
        jobTitle: item.job_title,
        appliedDate: item.created_at,
        score: item.match_score || 0,
        status: item.status,
        initialTab: "profile",
        applicationId: item.id,
        interviews: item.interviews || [],
        isDiscovery: false,
      });
    } else {
      setProfileModal({
        isOpen: true,
        candidate: {
          id: item.user_id || item.id,
          full_name: item.full_name || item.name || "Candidate",
          email: item.email || "",
          phone: item.phone_number || item.phone || "",
          location: item.location || "",
          current_role: item.current_role || "",
          skills: item.skills || [],
          resume_path: item.resume_path || "",
        },
        resumeData: item.resume_data || null,
        jobTitle: item.current_role || "Sales Role",
        appliedDate: new Date().toISOString(),
        score: item.culture_match_score || item.match_score || 0,
        status: undefined,
        initialTab: "profile",
        applicationId: undefined,
        interviews: [],
        isDiscovery: true,
      });
    }
  };

  const handleRejectionConfirm = async (reason?: string) => {
    if (!activeApplicationId) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        "/recruiter/applications/bulk-status",
        {
          application_ids: [activeApplicationId],
          status: "rejected",
          feedback: reason,
        },
        token,
      );

      setIsRejectionModalOpen(false);
      setActiveApplicationId(null);
      sendMessage("Show applications");
    } catch (err) {
      console.error("Failed to reject candidate:", err);
    }
  };

  const handleOpenInviteModal = (candidateId: string, candidateName: string) => {
    setInviteModal({
      isOpen: true,
      candidateId,
      candidateName,
    });
  };

  const handleInviteFromModal = async (jobId: string, message: string, customTitle?: string) => {
    if (!inviteModal.candidateId) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(
        `/recruiter/candidate/${inviteModal.candidateId}/invite`,
        {
          job_id: jobId,
          message: message,
          custom_role_title: customTitle,
        },
        token,
      );
      
      toast.success("Invitation sent successfully!");
      setInviteModal({ isOpen: false, candidateId: '', candidateName: '' });
      fetchAccessControlData();
    } catch (error: any) {
      console.error("Failed to send invite:", error);
      toast.error(error.message || "Failed to send invitation. Please try again.");
    }
  };

  const recognitionRef  = useRef<any>(null);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

  const hints           = userRole === 'recruiter' ? RECRUITER_HINTS : CANDIDATE_HINTS;
  const placeholder     = useRotatingPlaceholder(hints);
  const apiBase         = process.env.NEXT_PUBLIC_API_URL || '/api';

  // ── Auth helper ────────────────────────────
  const authHeaders = useCallback(() => {
    const token = awsAuth.getToken();
    if (!token) throw new Error('No authentication token');
    return {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }, []);

  const getClientContext = useCallback((source: string) => ({
    role: userRole,
    path: pathname,
    source,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    local_hour: new Date().getHours(),
  }), [pathname, userRole]);

  // ── Speech recognition ─────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous     = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    rec.onerror  = () => setIsListening(false);
    rec.onend    = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else { setIsListening(true); recognitionRef.current?.start(); }
  };

  // ── Auto-scroll ────────────────────────────
  useEffect(() => {
    if (isChatMode) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatMode]);

  // ── Load session history ───────────────────
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/ai/assistant/sessions`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch { /* silent */ }
  }, [apiBase, authHeaders]);

  // ── Fetch personalised greeting on open ───
  const fetchGreeting = useCallback(async (sid: string | null, force = false) => {
    if (greetingLoaded && !force) return;
    setGreetingLoaded(true);

    // Show shimmer placeholder
    setMessages([{
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      const res = await fetch(`${apiBase}/ai/assistant/chat`, {
        method:  'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          prompt:     '__greeting__',
          session_id: sid,
          client_context: getClientContext('global_chat_open'),
        }),
      });

      if (!res.ok) throw new Error('greeting failed');
      const result = await res.json();

      if (result.session_id) {
        setSessionId(result.session_id);
        localStorage.setItem(SESSION_KEY, result.session_id);
      }

      setMessages([{
        role:         'assistant',
        content:      result.text || `Hey there! What would you like to do today?`,
        timestamp:    new Date(),
        action_cards: result.action_cards,
        feature_prompts: result.feature_prompts,
        data_type:    'none',
      }]);

      loadSessions();
    } catch {
      setMessages([{
        role:      'assistant',
        content:   `Hey! I'm your TalentCore AI assistant. What can I help you with?`,
        timestamp: new Date(),
        data_type: 'none',
      }]);
    }
  }, [apiBase, authHeaders, getClientContext, greetingLoaded, loadSessions]);

  // ── Load past session ──────────────────────
  const loadSession = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`${apiBase}/ai/assistant/sessions/${sid}/messages`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Unable to load session');
      const data = await res.json();
      const msgs: ChatMessage[] = (data.messages || []).map((m: any) => ({
        role:           m.role,
        content:        m.content,
        timestamp:      new Date(m.timestamp || Date.now()),
        intent:         m.intent,
        data_type:      m.data_type || 'none',
        data_results:   m.data_results,
        action_cards:   m.action_cards,
        feature_prompts:m.feature_prompts,
        next_steps:     m.next_steps,
        isStreaming:    false,
      }));
      setMessages(
        msgs.length
          ? msgs
          : [{ role: 'assistant', content: 'Session loaded. What would you like to continue?', timestamp: new Date(), data_type: 'none' }]
      );
      setSessionId(sid);
      localStorage.setItem(SESSION_KEY, sid);
      setGreetingLoaded(true);
      await loadSessions();
      return true;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      setSessionId(null);
      setGreetingLoaded(false);
      return false;
    }
  }, [apiBase, authHeaders, loadSessions]);

  useEffect(() => {
    if (!isChatMode) return;
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      loadSession(saved).then(success => {
        if (!success) fetchGreeting(null);
      });
      return;
    }
    fetchGreeting(null);
  }, [isChatMode, fetchGreeting, loadSession]);

  // ── Delete session ─────────────────────────
  const deleteSession = useCallback(async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${apiBase}/ai/assistant/sessions/${sid}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      setSessions(prev => prev.filter(s => s.id !== sid));
      if (sessionId === sid) {
        setSessionId(null);
        localStorage.removeItem(SESSION_KEY);
      }
    } catch { /* silent */ }
  }, [apiBase, authHeaders, sessionId]);

  // ── New session ────────────────────────────
  const newSession = () => {
    setSessionId(null);
    localStorage.removeItem(SESSION_KEY);
    setGreetingLoaded(false);
    setMessages([{
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);
    setTimeout(() => {
      fetchGreeting(null, true);
    }, 50);
  };

  // ── Navigation ─────────────────────────────
  const handleNavigate = useCallback((url: string) => {
    toggleChatMode();
    router.push(url);
  }, [router, toggleChatMode]);

  // ── Auto-resize textarea ───────────────────
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  };

  // ── Send prompt (also used by feature prompt chips) ──
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };
    const thinkingMsg: ChatMessage = {
      role: 'assistant', content: '', timestamp: new Date(), isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, thinkingMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/ai/assistant/chat`, {
        method:  'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          prompt:     text,
          session_id: sessionId,
          client_context: getClientContext('global_chat'),
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const result = await res.json();

      if (result.session_id) {
        setSessionId(result.session_id);
        localStorage.setItem(SESSION_KEY, result.session_id);
        loadSessions();
      }

      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role:            'assistant',
          content:         result.text || 'Processing complete.',
          timestamp:       new Date(),
          data_type:       result.data_type    || 'none',
          data_results:    result.data_results,
          action_cards:    result.action_cards,
          feature_prompts: result.feature_prompts,
          next_steps:      result.next_steps,
          intent:          result.intent,
          isStreaming:     false,
        };
        return next;
      });

      if (userRole === 'recruiter') {
        await fetchAccessControlData();
      }

      if (result.data_type === 'resume_info' && result.data_results && result.data_results[0]?.resume_path) {
        const item = result.data_results[0];
        const candId = item.user_id || item.id;
        if (hasAccessToPersonalInfo(candId)) {
          handleOpenPdfPreview(item.resume_path, item.full_name || item.name || 'Candidate');
        }
      }

    } catch (err: any) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role:      'assistant',
          content:   `Connection error: ${err?.message || 'Please try again.'}`,
          timestamp: new Date(),
          data_type: 'error',
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [loading, apiBase, authHeaders, sessionId, getClientContext, loadSessions]);

  const handleResendMessage = async (index: number, newText: string) => {
    if (!newText.trim() || loading) return;

    // 1. Truncate client messages array to up to the edited user message
    const truncatedMessages = messages.slice(0, index);

    // 2. Add the edited user message and a streaming placeholder assistant message
    const editedUserMsg: ChatMessage = {
      role: 'user',
      content: newText,
      timestamp: new Date()
    };
    const thinkingMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    const newMessages = [...truncatedMessages, editedUserMsg, thinkingMsg];
    setMessages(newMessages);
    setEditingIndex(null);
    setLoading(true);

    try {
      // 3. Sync truncated messages to the backend
      const syncPayload = [...truncatedMessages].map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
        intent: m.intent,
        data_type: m.data_type,
        data_results: m.data_results,
        action_cards: m.action_cards,
        feature_prompts: m.feature_prompts,
        next_steps: m.next_steps,
      }));

      if (sessionId) {
        await fetch(`${apiBase}/ai/assistant/sessions/${sessionId}/messages`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ messages: syncPayload }),
        });
      }

      // 4. Send the new prompt to get a response
      const res = await fetch(`${apiBase}/ai/assistant/chat`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          prompt: newText,
          session_id: sessionId,
          client_context: getClientContext('global_chat_resend'),
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const result = await res.json();

      if (result.session_id) {
        setSessionId(result.session_id);
        localStorage.setItem(SESSION_KEY, result.session_id);
        loadSessions();
      }

      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: result.text || 'Processing complete.',
          timestamp: new Date(),
          data_type: result.data_type || 'none',
          data_results: result.data_results,
          action_cards: result.action_cards,
          feature_prompts: result.feature_prompts,
          next_steps: result.next_steps,
          intent: result.intent,
          isStreaming: false,
        };
        return next;
      });

      if (userRole === 'recruiter') {
        await fetchAccessControlData();
      }

      if (result.data_type === 'resume_info' && result.data_results && result.data_results[0]?.resume_path) {
        const item = result.data_results[0];
        const candId = item.user_id || item.id;
        if (hasAccessToPersonalInfo(candId)) {
          handleOpenPdfPreview(item.resume_path, item.full_name || item.name || 'Candidate');
        }
      }

    } catch (err: any) {
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          content: `Connection error: ${err?.message || 'Please try again.'}`,
          timestamp: new Date(),
          data_type: 'error',
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  if (!isChatMode) return null;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[100] flex bg-[#09090b] text-zinc-100 overflow-hidden">

      {/* ── Sidebar ─────────────────────────── */}
      <aside className="w-72 flex-shrink-0 bg-zinc-950/60 border-r border-white/[0.05] flex flex-col">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">TalentCore AI</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] text-zinc-500 font-mono tracking-widest">GLOBAL ASSISTANT</p>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono ${
                  userRole === 'recruiter'
                    ? 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
                    : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {userRole?.toUpperCase() || '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* New session */}
        <div className="px-4 pt-4">
          <button
            onClick={newSession}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-blue-500/30 rounded-xl transition-all text-sm font-medium text-zinc-300 hover:text-white"
          >
            <Plus className="w-4 h-4 text-blue-500" />
            New Session
          </button>
        </div>

        {/* Role-aware quick actions */}
        <div className="px-4 pt-4">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 px-1">
            Quick Actions
          </p>
          <div className="space-y-1">
            {userRole === 'recruiter' ? (
              <>
                <button
                  onClick={() => sendMessage('Show me all candidates including passive talent')}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                >
                  <Users className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  Browse all candidates
                </button>
                <button
                  onClick={() => sendMessage('What roles are in high demand right now?')}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  Market insights
                </button>
                <button
                  onClick={() => sendMessage('Show pending applications')}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  Pending reviews
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => sendMessage('Find jobs matching my skills')}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                >
                  <Search className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  Jobs for my skills
                </button>
                <button
                  onClick={() => sendMessage('Show my Career GPS milestones')}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                >
                  <Navigation className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                  My Career GPS
                </button>
                <button
                  onClick={() => sendMessage('What are the trending roles in the market?')}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  Market trends
                </button>
              </>
            )}
          </div>
        </div>

        {/* Session History */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-3 space-y-1">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 px-1">
            Recent Sessions
          </p>
          {sessions.length === 0 && (
            <p className="text-xs text-zinc-600 px-1">No sessions yet.</p>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              onClick={() => loadSession(s.id)}
              onKeyDown={e => e.key === 'Enter' && loadSession(s.id)}
              className={`group w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/[0.05] cursor-pointer ${
                sessionId === s.id
                  ? 'bg-blue-600/10 border border-blue-500/20'
                  : 'border border-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate leading-tight">
                  {s.session_title || s.last_intent || 'Session'}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">
                  {timeAgo(s.updated_at)}
                  {s.message_count ? ` · ${s.message_count} msgs` : ''}
                </p>
              </div>
              <button
                onClick={e => deleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-zinc-600 transition-all flex-shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Return to dashboard */}
        <div className="px-4 pb-4 border-t border-white/[0.05] pt-4">
          <button
            onClick={toggleChatMode}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all border border-transparent hover:border-white/[0.06]"
          >
            <LayoutDashboard className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 relative">

        {/* Header bar */}
        <header className="h-14 flex-shrink-0 flex items-center justify-between px-8 border-b border-white/[0.04] bg-zinc-950/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse [animation-delay:200ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse [animation-delay:400ms]" />
            </div>
            <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
              SECURE · ROLE: {userRole?.toUpperCase() || '—'} · {sessionId ? 'SESSION ACTIVE' : 'NEW SESSION'}
            </span>
          </div>
          <button
            onClick={toggleChatMode}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 md:px-16 lg:px-32 xl:px-48 pt-8 pb-40 space-y-6">
          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              msg={m}
              onNavigate={handleNavigate}
              onSendPrompt={sendMessage}
              userRole={userRole}
              index={i}
              editingIndex={editingIndex}
              setEditingIndex={setEditingIndex}
              onResendMessage={handleResendMessage}
              onOpenRejectionModal={handleOpenRejectionModal}
              onOpenInterviewModal={handleOpenInterviewModal}
              onOpenProfileModal={handleOpenProfileModal}
              hasAccessToPersonalInfo={hasAccessToPersonalInfo}
              getDisplayName={getDisplayName}
              onOpenPdfPreview={handleOpenPdfPreview}
              onOpenInviteModal={handleOpenInviteModal}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="absolute bottom-0 inset-x-0 px-6 md:px-16 lg:px-32 xl:px-48 pb-6 pt-4 bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent">
          <div className="relative">
            {/* Focus glow */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-blue-600/20 via-violet-600/10 to-blue-600/20 opacity-0 focus-within:opacity-100 transition-opacity duration-500 blur-sm pointer-events-none" />

            <div className="relative flex items-end gap-2 bg-zinc-900/90 backdrop-blur-xl border border-white/[0.08] focus-within:border-blue-500/30 rounded-2xl p-3 transition-all duration-300 shadow-2xl">

              {/* Mic */}
              <button
                onClick={toggleListening}
                className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={isListening ? 'Listening…' : placeholder}
                rows={1}
                className="flex-1 bg-transparent text-[14px] text-zinc-100 placeholder:text-zinc-600 resize-none outline-none py-1.5 px-1 min-h-[36px] max-h-[160px] leading-relaxed font-[450]"
              />

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-blue-900/30"
              >
                {loading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send    className="w-4 h-4" />
                }
              </button>
            </div>

            {/* Hint line */}
            <p className="text-center text-[10px] text-zinc-700 mt-2 font-mono">
              Enter to send · Shift+Enter for new line ·{' '}
              {userRole === 'recruiter'
                ? 'Search candidates, post jobs, view applications'
                : 'Search jobs, companies, explore Career GPS'}
            </p>
          </div>
        </div>
      </main>

      {isRejectionModalOpen && activeApplicationId && (
        <RejectionModal
          isOpen={isRejectionModalOpen}
          onClose={() => {
            setIsRejectionModalOpen(false);
            setActiveApplicationId(null);
          }}
          onConfirm={handleRejectionConfirm}
          count={1}
        />
      )}

      {isInterviewModalOpen && activeApplicationId && (
        <InterviewScheduler
          candidateName={
            messages
              .flatMap((m) => m.data_results || [])
              .find((app) => app.id === activeApplicationId)?.candidate_name || "Candidate"
          }
          applicationId={activeApplicationId}
          jobTitle={
            messages
              .flatMap((m) => m.data_results || [])
              .find((app) => app.id === activeApplicationId)?.job_title
          }
          initialRoundNumber={
            (messages
              .flatMap((m) => m.data_results || [])
              .find((app) => app.id === activeApplicationId)?.interviews?.length || 0) + 1
          }
          onClose={() => {
            setIsInterviewModalOpen(false);
            setActiveApplicationId(null);
          }}
          onSuccess={() => {
            setIsInterviewModalOpen(false);
            setActiveApplicationId(null);
            sendMessage("Show applications");
          }}
        />
      )}

      {profileModal.isOpen && profileModal.candidate && (
        <CandidateProfileModal
          isOpen={profileModal.isOpen}
          onClose={() => setProfileModal(prev => ({ ...prev, isOpen: false }))}
          candidate={profileModal.candidate}
          resumeData={profileModal.resumeData}
          jobTitle={profileModal.jobTitle}
          appliedDate={profileModal.appliedDate}
          score={profileModal.score}
          status={profileModal.status}
          initialTab={profileModal.initialTab}
          applicationId={profileModal.applicationId}
          isDiscovery={profileModal.isDiscovery}
          interviews={profileModal.interviews}
          initialFeedbackOpen={profileModal.initialFeedbackOpen}
          onRefresh={() => {
            sendMessage("Show applications");
            setProfileModal(prev => ({ ...prev, isOpen: false }));
          }}
        />
      )}

      {pdfModal.isOpen && pdfModal.url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-300 text-left">
          <div className="relative w-full max-w-5xl h-[90vh] bg-zinc-900/90 border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden glassmorphism">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-950/40">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-violet-400" />
                  {pdfModal.candidateName}'s Resume Preview
                </h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Secure Platform View</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={pdfModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-semibold border border-white/5 flex items-center gap-1.5 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in New Tab
                </a>
                <button
                  onClick={() => setPdfModal({ isOpen: false, url: null, candidateName: '' })}
                  className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-all border border-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Viewer Body */}
            <div className="flex-1 bg-zinc-950 p-4 flex items-center justify-center relative overflow-hidden">
              <iframe
                src={pdfModal.url}
                className="w-full h-full rounded-xl border border-white/5 bg-zinc-900"
                title={`${pdfModal.candidateName}'s Resume PDF`}
              />
            </div>
          </div>
        </div>
      )}

      {inviteModal.isOpen && (
        <JobInviteModal
          candidateId={inviteModal.candidateId}
          candidateName={inviteModal.candidateName}
          jobs={jobs}
          onClose={() => setInviteModal({ isOpen: false, candidateId: '', candidateName: '' })}
          onInvite={handleInviteFromModal}
        />
      )}
    </div>
  );
}