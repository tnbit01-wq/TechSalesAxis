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
  Calendar, XCircle, Lock, RotateCcw,
} from 'lucide-react';
import { awsAuth } from '@/lib/awsAuth';
import { apiClient } from '@/lib/apiClient';
import RejectionModal from '@/components/RejectionModal';
import InterviewScheduler from '@/components/InterviewScheduler';
import CandidateProfileModal from '@/components/CandidateProfileModal';
import JobInviteModal from '@/components/JobInviteModal';
import { toast } from 'sonner';

// Theme Context for inline versus full-screen drawer modes
const ChatThemeContext = React.createContext<{ isInline: boolean }>({ isInline: false });

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
  const { isInline } = React.useContext(ChatThemeContext);
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
    return typeof score === 'number' && score < 70;
  });

  const renderCard = (c: any, i: number) => {
    const isVerified = c.is_verified || c.assessment_status === 'completed' || c.assessment_status === 'verified';
    const isPassive  = c.is_passive  || (!isVerified && c.assessment_status !== 'in_progress' && c.assessment_status !== 'passive_lead');
    const isLead     = c.is_shadow   || c.assessment_status === 'passive_lead';
    const candId = c.user_id || c.id;
    const displayName = getDisplayName ? getDisplayName(c.full_name || c.name || 'Unnamed', candId) : (c.full_name || c.name || 'Unnamed');
    const score = c.culture_match_score ?? c.match_score;

    // Determine HSL matching badge styles
    let scoreBadgeStyle = isInline
      ? "text-[#FF8A00] bg-orange-50 border-[#FF8A00]/20"
      : "text-orange-400 bg-orange-500/10 border-orange-500/20";
    if (typeof score === 'number') {
      if (score >= 85) {
        scoreBadgeStyle = isInline
          ? "text-emerald-650 bg-emerald-50 border-emerald-200/50"
          : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      } else if (score >= 70) {
        scoreBadgeStyle = isInline
          ? "text-amber-650 bg-amber-50 border-amber-200/50"
          : "text-amber-400 bg-amber-500/10 border-amber-500/20";
      }
    }

    return (
      <div
        key={candId || i}
        className={`group border rounded-2xl p-4 transition-all duration-200 ${
          isInline
            ? 'bg-slate-50 border-slate-200 hover:border-orange-300 hover:bg-slate-100/50'
            : 'bg-zinc-900/60 border-white/[0.06] hover:border-orange-500/35 hover:bg-zinc-800/60'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border relative ${
              isInline
                ? 'bg-orange-50 border-orange-200/55'
                : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-white/5'
            }`}>
              <User className={`w-5 h-5 ${isInline ? 'text-[#FF8A00]' : 'text-orange-400'}`} />
              {/* Verified / passive / lead indicator dot */}
              <span
                className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border ${
                  isInline ? 'border-white' : 'border-zinc-900'
                } ${
                  isVerified ? 'bg-emerald-500' : isLead ? 'bg-amber-500' : isPassive ? 'bg-amber-500' : 'bg-orange-400'
                }`}
                title={isVerified ? 'Verified' : isLead ? 'Passive Lead' : isPassive ? 'Passive candidate' : 'Assessment in progress'}
              />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>
                {displayName}
              </p>
              <p className={`text-xs truncate ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>
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
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  isInline
                    ? 'bg-orange-50/60 text-orange-600 border-orange-200/40'
                    : 'bg-orange-500/10 text-orange-300 border-orange-500/15'
                }`}
              >
                {s}
              </span>
            ))}
            {c.skills.length > 3 && (
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                isInline
                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>
                +{c.skills.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-450">
            <Target className="w-3 h-3 text-zinc-500" />
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
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          ) : isLead ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <UserCheck className="w-3 h-3" />
              Passive
            </span>
          ) : isPassive ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <UserCheck className="w-3 h-3" />
              Passive
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              isInline
                ? 'text-orange-500 bg-orange-500/5 border-orange-500/20'
                : 'text-orange-400 bg-orange-500/10 border-orange-500/20'
            }`}>
              <Loader2 className="w-3 h-3 animate-spin" />
              In Progress
            </span>
          )}
        </div>

        {/* Why this match reasoning */}
        {c.match_reasoning && (
          <div className={`mt-3 rounded-xl border p-3 text-left ${
            isInline 
              ? 'border-orange-200/50 bg-orange-50/20' 
              : 'border-orange-500/10 bg-orange-500/5'
          }`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">Why this match</p>
            <p className={`mt-1 text-xs leading-relaxed ${isInline ? 'text-slate-700' : 'text-zinc-300'}`}>{c.match_reasoning}</p>
          </div>
        )}

        {/* Recruiter Actions */}
        {role === 'recruiter' && (
          <div className={`mt-3 flex gap-2 border-t pt-3 ${isInline ? 'border-slate-100' : 'border-white/5'}`}>
            <button
              onClick={() => {
                if (onOpenProfileModal) {
                  onOpenProfileModal(c);
                } else {
                  onAction(`Show profile of ${c.full_name || c.name || ''}`);
                }
              }}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
                isInline
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                  : 'bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
              }`}
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
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
                  isInline
                    ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                    : 'bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
                } ${
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
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
                isInline
                  ? 'bg-[#FF8A00] hover:bg-[#E67A00] text-white border-transparent shadow-sm'
                  : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border-orange-500/15'
              }`}
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
            <h4 className={`text-xs font-bold ${isInline ? 'text-slate-800' : 'text-zinc-150'}`}>{title}</h4>
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
  const { isInline } = React.useContext(ChatThemeContext);
  const candId = item.user_id || item.id;
  const isUnlocked = hasAccessToPersonalInfo ? hasAccessToPersonalInfo(candId) : true;
  const displayName = getDisplayName ? getDisplayName(item.full_name || 'Candidate', candId) : (item.full_name || 'Candidate');

  return (
    <div className={`mt-3 border rounded-2xl p-5 transition-all ${
      isInline
        ? 'bg-white border-slate-200/80 text-slate-800 shadow-sm'
        : 'bg-zinc-900/70 border-white/[0.07] text-white'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
          isInline
            ? 'bg-orange-50 border-orange-200/50'
            : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-white/5'
        }`}>
          <User className={`w-7 h-7 ${isInline ? 'text-[#FF8A00]' : 'text-orange-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-base font-bold ${isInline ? 'text-slate-800' : 'text-white'}`}>{displayName}</p>
          <p className={`text-sm mt-0.5 ${isInline ? 'text-slate-500' : 'text-zinc-400'}`}>{item.current_role || 'IT Sales Professional'}</p>
          {isUnlocked ? (
            <p className={`text-xs mt-0.5 font-mono truncate ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>
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
        <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 ${
          isInline
            ? 'bg-amber-500/10 border-amber-500/20 text-slate-700'
            : 'bg-amber-500/5 border-amber-500/10 text-zinc-400'
        }`}>
          <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-normal">
            <p className={`font-semibold ${isInline ? 'text-amber-800' : 'text-amber-300'}`}>Contact Details Masked</p>
            <p className="mt-1">Candidate contact details are hidden for privacy. They will be unmasked once the candidate accepts your invitation or is shortlisted.</p>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {item.years_of_experience != null && (
          <div className={`rounded-xl p-3 border ${
            isInline ? 'bg-slate-50 border-slate-100' : 'bg-zinc-800/60 border-white/5'
          }`}>
            <p className={`text-[10px] font-mono ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Experience</p>
            <p className={`text-sm font-semibold mt-0.5 ${isInline ? 'text-slate-800' : 'text-white'}`}>{item.years_of_experience} yrs</p>
          </div>
        )}
        {item.location && (
          <div className={`rounded-xl p-3 border ${
            isInline ? 'bg-slate-50 border-slate-100' : 'bg-zinc-800/60 border-white/5'
          }`}>
            <p className={`text-[10px] font-mono ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Location</p>
            <p className={`text-sm font-semibold mt-0.5 truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>{item.location}</p>
          </div>
        )}
        {item.profile_strength && (
          <div className={`rounded-xl p-3 border ${
            isInline ? 'bg-slate-50 border-slate-100' : 'bg-zinc-800/60 border-white/5'
          }`}>
            <p className={`text-[10px] font-mono ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Profile</p>
            <p className={`text-sm font-semibold mt-0.5 ${isInline ? 'text-slate-800' : 'text-white'}`}>{item.profile_strength}</p>
          </div>
        )}
      </div>

      {Array.isArray(item.skills) && item.skills.length > 0 && (
        <div className="mt-3">
          <p className={`text-[10px] font-mono mb-2 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>SKILLS</p>
          <div className="flex flex-wrap gap-1.5">
            {item.skills.slice(0, 8).map((s: string, i: number) => (
              <span key={i} className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${
                isInline
                  ? 'bg-orange-50/60 text-orange-600 border-orange-200/40'
                  : 'bg-orange-500/10 text-orange-300 border-orange-500/15'
              }`}>
                {s}
              </span>
            ))}
            {item.skills.length > 8 && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${
                isInline
                  ? 'bg-slate-100 text-slate-500 border-slate-200'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700'
              }`}>
                +{item.skills.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recruiter Actions */}
      <div className={`mt-3 flex gap-2 border-t pt-3 ${isInline ? 'border-slate-100' : 'border-white/5'}`}>
        <button
          onClick={() => {
            if (onOpenProfileModal) {
              onOpenProfileModal(item);
            }
          }}
          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
            isInline
              ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
              : 'bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
          }`}
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
            className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
              isInline
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                : 'bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
            } ${
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
          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
            isInline
              ? 'bg-[#FF8A00] hover:bg-[#E67A00] text-white border-transparent'
              : 'bg-orange-500/10 text-orange-450 hover:bg-orange-500/20 border-orange-500/15'
          }`}
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
  const { isInline } = React.useContext(ChatThemeContext);
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'applied':
        return 'text-[#FF8A00] bg-orange-500/10 border-orange-500/20';
      case 'shortlisted':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'interview':
      case 'interview_scheduled':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
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
          <div key={i} className={`group border rounded-2xl p-4 transition-all duration-200 ${
            isInline
              ? 'bg-white border-slate-200/80 hover:border-[#FF8A00]/30 hover:bg-slate-50/50 shadow-sm text-slate-800'
              : 'bg-zinc-900/60 border-white/[0.06] hover:border-orange-555/35 hover:bg-zinc-800/60 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                isInline
                  ? 'bg-orange-50 border-orange-200/50'
                  : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-white/5'
              }`}>
                <User className={`w-5 h-5 ${isInline ? 'text-[#FF8A00]' : 'text-orange-400'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>{displayName}</p>
                <p className={`text-xs truncate ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>{app.candidate_role || 'IT Sales Professional'}</p>
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

            <div className={`mt-3 flex flex-wrap gap-1.5 border-t pt-3 ${isInline ? 'border-slate-100' : 'border-white/5'}`}>
              <button
                onClick={() => onAction(`Show profile of ${app.candidate_name}`)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-all ${
                  isInline
                    ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
                }`}
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
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold border transition-all ${
                    isInline
                      ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                      : 'bg-zinc-850 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
                  }`}
                >
                  Resume
                </button>
              )}
              {canShortlist && (
                <button
                  onClick={() => onAction(`Shortlist candidate ${app.candidate_name}`)}
                  className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] font-semibold border border-emerald-500/15 transition-all"
                >
                  Shortlist
                </button>
              )}
              {canInterview && (
                <button
                  onClick={() => onOpenInterviewModal(app.id)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border ${
                    isInline
                      ? 'bg-[#FF8A00] hover:bg-[#E67A00] text-white border-transparent'
                      : 'bg-orange-500/20 text-orange-450 hover:bg-orange-500/30 border-orange-500/20'
                  }`}
                >
                  Interview
                </button>
              )}
              {canReject && (
                <button
                  onClick={() => onOpenRejectionModal(app.id)}
                  className="px-2.5 py-1 rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] font-semibold border border-red-500/15 transition-all"
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
  const { isInline } = React.useContext(ChatThemeContext);
  return (
    <div className={`mt-3 border rounded-2xl p-4 flex flex-col gap-3 transition-all ${
      isInline
        ? 'bg-white border-slate-200/80 shadow-sm text-slate-800'
        : 'bg-zinc-900/70 border-orange-500/20 text-white'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
          isInline
            ? 'bg-orange-50 border-orange-200/50'
            : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-white/5'
        }`}>
          <Calendar className={`w-5 h-5 ${isInline ? 'text-[#FF8A00]' : 'text-orange-400'}`} />
        </div>
        <div>
          <p className={`text-sm font-semibold ${isInline ? 'text-slate-800' : 'text-white'}`}>Interview with {item.candidate_name}</p>
          <p className={`text-xs truncate ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>{item.job_title}</p>
        </div>
      </div>
      <button
        onClick={() => onOpenInterviewModal(item.id)}
        className="w-full py-2 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-transparent"
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
  const { isInline } = React.useContext(ChatThemeContext);
  const [activeTab, setActiveTab] = useState<'highlights' | 'experience' | 'education'>('highlights');

  const resumeData = item.resume_data || item.resumeData || null;

  return (
    <div className={`mt-3 border rounded-2xl p-4 flex flex-col gap-3 text-left transition-all ${
      isInline
        ? 'bg-white border-slate-200/80 text-slate-800 shadow-sm'
        : 'bg-zinc-900/70 border-white/[0.07] text-white'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
            isInline
              ? 'bg-orange-50 border-orange-200/50'
              : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-white/5'
          }`}>
            <FileText className={`w-5 h-5 ${isInline ? 'text-[#FF8A00]' : 'text-orange-450'}`} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${isInline ? 'text-slate-800' : 'text-white'}`}>{item.full_name || item.name || 'Candidate'}'s Resume</p>
            <p className={`text-[10px] font-mono flex items-center gap-1 ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>
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
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1 ${
              isInline
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-650 border-slate-200 shadow-sm'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
            }`}
          >
            <ExternalLink className="w-3 h-3" />
            Quick Preview
          </button>
        )}
      </div>

      {/* Tabs Selection (only show if resumeData is present) */}
      {resumeData ? (
        <div className={`flex border-b pb-1 gap-4 mt-2 ${isInline ? 'border-slate-150' : 'border-white/5'}`}>
          {(['highlights', 'experience', 'education'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[10px] font-bold uppercase tracking-wider pb-1 transition-all border-b-2 capitalize ${
                activeTab === tab
                  ? (isInline ? 'border-[#FF8A00] text-[#FF8A00]' : 'border-orange-500 text-orange-400')
                  : (isInline ? 'border-transparent text-slate-500 hover:text-slate-800' : 'border-transparent text-zinc-500 hover:text-zinc-300')
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      ) : (
        item.parsed_data && (
          <div className={`text-xs rounded-xl p-3 border font-mono whitespace-pre-wrap line-clamp-4 ${
            isInline ? 'bg-slate-50 border-slate-100 text-slate-700' : 'bg-zinc-800/50 border-white/5 text-zinc-400'
          }`}>
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
                <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${isInline ? 'text-slate-405' : 'text-zinc-500'}`}>Key Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {resumeData.skills && resumeData.skills.length > 0 ? (
                    resumeData.skills.map((skill: string, idx: number) => (
                      <span key={idx} className={`px-2 py-0.5 rounded-md font-mono text-[9px] border ${
                        isInline ? 'bg-orange-50 text-orange-600 border-orange-200/40' : 'bg-zinc-800 text-zinc-300 border-white/5'
                      }`}>
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
                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Key Achievements</p>
                    <ul className={`list-disc pl-4 space-y-1 text-[11px] leading-relaxed ${isInline ? 'text-slate-700' : 'text-zinc-400'}`}>
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
                  <div key={idx} className={`relative pl-4 border-l last:border-transparent ${isInline ? 'border-slate-150' : 'border-white/5'}`}>
                    <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full flex items-center justify-center border ${
                      isInline ? 'bg-orange-100 border-[#FF8A00]' : 'bg-orange-600/30 border-orange-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isInline ? 'bg-[#FF8A00]' : 'bg-orange-400'}`} />
                    </div>
                    <div className="flex justify-between items-start flex-wrap gap-1">
                      <h4 className={`font-semibold text-xs ${isInline ? 'text-slate-800' : 'text-zinc-200'}`}>{exp.role || 'Sales Executive'}</h4>
                      <span className={`text-[9px] font-mono ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>
                        {exp.start || 'N/A'} - {exp.end || 'Present'}
                      </span>
                    </div>
                    <p className={`text-[10px] font-mono mt-0.5 ${isInline ? 'text-slate-500' : 'text-zinc-400'}`}>{exp.company || 'Company'} • {exp.location || 'Remote'}</p>
                    {exp.description && (
                      <p className={`text-[10px] mt-1 leading-relaxed ${isInline ? 'text-slate-600' : 'text-zinc-500'}`}>{exp.description}</p>
                    )}
                    {exp.key_achievements && exp.key_achievements.length > 0 && (
                      <ul className={`list-disc pl-3 mt-1.5 space-y-0.5 text-[10px] leading-normal ${isInline ? 'text-slate-700' : 'text-zinc-400'}`}>
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
                  <div key={idx} className={`border rounded-xl p-3 ${
                    isInline ? 'bg-slate-50/50 border-slate-150' : 'bg-zinc-800/25 border-white/5'
                  }`}>
                    <div className="flex justify-between items-start">
                      <h4 className={`font-semibold text-xs ${isInline ? 'text-slate-800' : 'text-zinc-200'}`}>{edu.degree || 'Degree'}</h4>
                      {edu.years && (
                        <span className={`text-[9px] font-mono ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>{edu.years}</span>
                      )}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${isInline ? 'text-slate-550' : 'text-zinc-400'}`}>{edu.school || 'Institution'}</p>
                    {edu.field && (
                      <p className={`text-[10px] font-mono mt-1 ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>Field of Study: {edu.field}</p>
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
      <p className={`mt-1 text-[9px] font-mono ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>
        Uploaded {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : '—'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Job Cards
// ─────────────────────────────────────────────

function JobCards({ items, role, onAction }: { items: any[]; role: string; onAction: (text: string) => void }) {
  const { isInline } = React.useContext(ChatThemeContext);
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
        <div key={i} className={`group border rounded-2xl p-4 transition-all duration-200 ${
          isInline
            ? 'bg-white border-slate-200/80 hover:border-[#FF8A00]/30 hover:bg-slate-50/50 shadow-sm text-slate-800'
            : 'bg-zinc-900/60 border-white/[0.06] hover:border-orange-500/35 hover:bg-zinc-800/60 text-white'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
              isInline
                ? 'bg-orange-50 border-orange-200/50'
                : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-white/5'
            }`}>
              <Briefcase className={`w-4 h-4 ${isInline ? 'text-[#FF8A00]' : 'text-orange-450'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>
                {job.title || job.job_title || 'Role'}
              </p>
              <p className={`text-xs truncate ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>
                {job.company_name || 'Company'}{job.location ? ` · ${job.location}` : ''}
              </p>
              {job.salary_range && (
                <p className={`text-[11px] mt-0.5 inline-flex items-center gap-1 ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>
                  <DollarSign className="w-3 h-3" />
                  {job.salary_range}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5 items-center">
                {typeof job.match_score === 'number' && job.match_score > 0 && (
                  <span className="text-[10px] font-mono text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {Math.round(job.match_score)}% match
                  </span>
                )}
                {job.experience_band && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${isInline ? 'text-slate-500 bg-slate-100 border-slate-200' : 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                    {job.experience_band}
                  </span>
                )}
                {job.job_type && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${isInline ? 'text-slate-550 bg-slate-100/50 border-slate-200/50' : 'text-zinc-500 bg-zinc-800/50 border-zinc-700/50'}`}>
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
                  className="mt-3 w-full py-1.5 px-3 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-lg text-[10px] font-semibold shadow-md transition-all active:scale-95"
                >
                  Apply Now
                </button>
              ) : (
                <div className={`mt-3 flex flex-wrap gap-1.5 border-t pt-3 ${isInline ? 'border-slate-150' : 'border-white/5'}`}>
                  <button
                    onClick={() => onAction(`Show applications for ${job.title || job.job_title}`)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                      isInline ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border-white/10'
                    }`}
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
                            className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] font-semibold border border-emerald-500/15 transition-all"
                          >
                            Open
                          </button>
                        )}
                        {(statusNormalized === 'active' || statusNormalized === 'open') && (
                          <button
                            onClick={() => onAction(`Pause hiring for ${job.title || job.job_title}`)}
                            className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[10px] font-semibold border border-amber-500/15 transition-all"
                          >
                            Pause
                          </button>
                        )}
                        {(statusNormalized === 'active' || statusNormalized === 'open') && (
                          <button
                            onClick={() => onAction(`Close job ${job.title || job.job_title}`)}
                            className="px-2 py-1 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 text-[10px] font-semibold border border-rose-500/15 transition-all"
                          >
                            Close
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <button
                    onClick={() => onAction(`Delete job ${job.title || job.job_title}`)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ml-auto ${
                      isInline
                        ? 'bg-white hover:bg-red-50 hover:border-red-200 text-slate-400 hover:text-red-500 border-slate-200 shadow-sm'
                        : 'bg-zinc-950 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 border-white/5'
                    }`}
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

function JobDraftCard({ item, onConfirm, onCancel }: { item: any; onConfirm: (updatedData: any) => void; onCancel: () => void }) {
  const { isInline } = React.useContext(ChatThemeContext);
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
      <div className={`mt-3 border rounded-2xl p-5 space-y-4 text-left transition-all ${
        isInline ? 'bg-white border-slate-200/80 text-slate-800 shadow-sm' : 'bg-zinc-900/90 border-[#FF8A00]/30 text-white'
      }`}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-amber-505 animate-pulse text-[#FF8A00]" />
          <p className={`text-sm font-semibold ${isInline ? 'text-slate-805' : 'text-orange-350'}`}>Edit Job Draft</p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#FF8A00]/50 ${
                isInline ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
              }`}
              placeholder="e.g. Senior Business Development Manager"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#FF8A00]/50 ${
                  isInline ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
                }`}
                placeholder="e.g. Dallas, TX"
              />
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Job Type</label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#FF8A00]/50 font-medium ${
                  isInline ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
                }`}
              >
                <option value="onsite">Onsite</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Salary Range</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={salaryRange}
                  onChange={(e) => setSalaryRange(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#FF8A00]/50 ${
                    isInline ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
                  }`}
                  placeholder="e.g. $80k - $120k"
                />
                <button
                  type="button"
                  onClick={handleAutoDetectSalary}
                  disabled={salaryLoading || !location}
                  className="px-3 py-1.5 rounded-xl bg-[#FF8A00] hover:bg-[#E67A00] disabled:opacity-50 text-[10px] font-bold uppercase tracking-wider text-white transition-all whitespace-nowrap border border-transparent"
                >
                  {salaryLoading ? 'Detecting...' : 'Auto Detect'}
                </button>
              </div>
            </div>
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Experience Band</label>
              <select
                value={experienceBand}
                onChange={(e) => setExperienceBand(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#FF8A00]/50 font-medium ${
                  isInline ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
                }`}
              >
                <option value="fresher">Fresher</option>
                <option value="mid">Mid-Level</option>
                <option value="senior">Senior</option>
                <option value="leadership">Leadership</option>
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Skills (comma-separated)</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#FF8A00]/50 ${
                isInline ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
              }`}
              placeholder="e.g. SaaS, Enterprise Sales, Negotiation"
            />
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Requirements (one per line)</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={3}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#FF8A00]/50 resize-none ${
                isInline ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
              }`}
              placeholder="e.g. 5+ years of B2B sales experience&#10;Track record of quota attainment"
            />
          </div>

          <div>
            <label className={`block text-[10px] font-bold uppercase mb-1 ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#FF8A00]/50 resize-y ${
                isInline ? 'bg-white border-slate-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
              }`}
              placeholder="Provide a description of the company and role..."
            />
          </div>
        </div>

        <div className={`mt-4 flex gap-2 justify-end border-t pt-3 ${isInline ? 'border-slate-150' : 'border-white/5'}`}>
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
            className={`px-3 py-1.5 rounded-xl border transition-all text-xs font-medium ${
              isInline ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800' : 'border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 rounded-xl border transition-all text-xs font-semibold ${
              isInline ? 'bg-slate-800 border-transparent text-white hover:bg-slate-700 shadow-sm' : 'bg-zinc-800 hover:bg-zinc-700 text-white border-white/10 shadow-lg'
            }`}
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-3 border rounded-2xl p-5 text-left transition-all ${
      isInline ? 'bg-white border-slate-200/80 text-slate-800 shadow-sm' : 'bg-zinc-900/70 border-orange-500/20 text-white'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse text-[#FF8A00]" />
          <p className={`text-sm font-semibold ${isInline ? 'text-[#FF8A00]' : 'text-amber-300'}`}>Draft Job Posting</p>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className={`text-xs font-semibold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all border ${
            isInline ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200' : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border-transparent'
          }`}
        >
          Edit Draft
        </button>
      </div>
      <div className="space-y-2 text-xs">
        <p><strong className={`font-semibold ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Title:</strong> <span className={`font-medium ${isInline ? 'text-slate-800' : 'text-white'}`}>{title}</span></p>
        <p><strong className={`font-semibold ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Location:</strong> <span className={isInline ? 'text-slate-700' : 'text-zinc-300'}>{location} ({jobType})</span></p>
        <p><strong className={`font-semibold ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Salary Range:</strong> <span className={isInline ? 'text-slate-700' : 'text-zinc-300'}>{salaryRange}</span></p>
        <p><strong className={`font-semibold ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Experience Band:</strong> <span className={isInline ? 'text-slate-700' : 'text-zinc-300'}>{experienceBand}</span></p>
        {skills && (
          <p>
            <strong className={`font-semibold ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Skills Required:</strong>{' '}
            <span className="text-[#FF8A00] font-mono">{skills}</span>
          </p>
        )}
        {requirements && (
          <div className="mt-1">
            <strong className={`font-semibold ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>Requirements:</strong>
            <ul className={`list-disc list-inside pl-1 space-y-0.5 mt-0.5 ${isInline ? 'text-slate-700' : 'text-zinc-350'}`}>
              {requirements.split('\n').map((r: string, idx: number) => (
                <li key={idx} className="truncate">{r}</li>
              ))}
            </ul>
          </div>
        )}
        <p className={`border-t pt-2 mt-2 whitespace-pre-wrap text-[11px] leading-relaxed ${isInline ? 'border-slate-150 text-slate-600' : 'border-white/5 text-zinc-400'}`}>
          {description}
        </p>
      </div>

      {matchPotential && (
        <div className={`mt-4 border-t pt-4 space-y-2 rounded-xl p-3 text-left border ${
          matchPotential.count === 0 
            ? (isInline ? 'bg-amber-50/50 border-amber-200/50' : 'bg-amber-500/5 border-amber-500/10') 
            : (isInline ? 'bg-emerald-50/50 border-emerald-200/50' : 'bg-emerald-500/5 border-emerald-500/10')
        }`}>
          <div className="flex items-center justify-between">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isInline ? 'text-slate-500' : 'text-zinc-400'}`}>
              Matching Talent Preview
            </p>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${matchPotential.count === 0 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
              {matchPotential.count} candidate{matchPotential.count !== 1 ? 's' : ''}
            </span>
          </div>
          <p className={`text-[11px] leading-normal ${isInline ? 'text-slate-700' : 'text-zinc-300'}`}>{matchPotential.message}</p>
          
          {matchPotential.data && matchPotential.data.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {matchPotential.data.map((cand: any, idx: number) => (
                <div key={idx} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                  isInline ? 'bg-white border-slate-150' : 'bg-zinc-950/40 border-white/[0.03]'
                }`}>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>{cand.full_name}</p>
                    <p className={`text-[10px] truncate ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>{cand.current_role} · {cand.location}</p>
                  </div>
                  {cand.match_score !== undefined && (
                    <span className="text-[9px] font-mono text-[#FF8A00] bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
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
          className={`mr-auto px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 ${
            isInline ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700' : 'bg-zinc-900 border-white/10 hover:bg-zinc-800 text-zinc-300 hover:text-white'
          }`}
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
          className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
            isInline ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800' : 'bg-zinc-900 border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={handlePublish}
          className="px-4 py-1.5 rounded-xl bg-[#FF8A00] hover:bg-[#E67A00] text-xs font-semibold text-white shadow-lg transition-all border border-transparent"
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
  const { isInline } = React.useContext(ChatThemeContext);
  return (
    <div className={`mt-3 border rounded-2xl p-4 ${
      isInline 
        ? 'bg-slate-50 border-orange-200/50' 
        : 'bg-zinc-900/70 border border-orange-500/20'
    }`}>
      <p className={`text-xs font-medium mb-1 ${isInline ? 'text-slate-500' : 'text-zinc-400'}`}>Confirming application for:</p>
      <p className={`text-sm font-semibold ${isInline ? 'text-slate-800' : 'text-white'}`}>{item.title}</p>
      <p className="text-xs text-zinc-500 mb-3">{item.company_name} · {item.location}</p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className={`px-3 py-1.5 rounded-xl border transition-all text-xs font-medium ${
            isInline 
              ? 'border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-800' 
              : 'border-white/10 hover:bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-1.5 rounded-xl bg-[#FF8A00] hover:bg-[#E67A00] text-xs font-semibold text-white shadow-lg transition-all"
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
  const { isInline } = React.useContext(ChatThemeContext);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {items.map((co, i) => (
        <div key={i} className={`group border rounded-2xl p-4 transition-all duration-200 ${
          isInline
            ? 'bg-white border-slate-200/80 hover:border-[#FF8A00]/30 hover:bg-slate-50/50 shadow-sm text-slate-800'
            : 'bg-zinc-900/60 border-white/[0.06] hover:border-orange-500/35 hover:bg-zinc-800/60 text-white'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${
              isInline
                ? 'bg-orange-50 border-orange-200/50'
                : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-white/5'
            }`}>
              <Building2 className={`w-4 h-4 ${isInline ? 'text-[#FF8A00]' : 'text-orange-450'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>
                {co.company_name || co.name || 'Company'}
              </p>
              <p className={`text-xs truncate ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>
                {co.industry || 'Tech'}{co.location ? ` · ${co.location}` : ''}
              </p>
              {co.size_band && (
                <p className={`text-[11px] mt-0.5 ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>{co.size_band}</p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {typeof co.open_jobs === 'number' && co.open_jobs > 0 && (
                  <span className="text-[10px] font-mono text-emerald-450 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {co.open_jobs} open role{co.open_jobs !== 1 ? 's' : ''}
                  </span>
                )}
                {typeof co.match_score === 'number' && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isInline
                      ? 'text-[#FF8A00] bg-orange-50 border-[#FF8A00]/20'
                      : 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                  }`}>
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
  const { isInline } = React.useContext(ChatThemeContext);
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="mt-3 space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={`text-[11px] font-mono w-40 truncate flex-shrink-0 ${isInline ? 'text-slate-500' : 'text-zinc-400'}`}>{item.label}</span>
          <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isInline ? 'bg-slate-200' : 'bg-zinc-800'}`}>
            <div
              className="h-full bg-gradient-to-r from-[#FF8A00] to-orange-400 rounded-full transition-all duration-700"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className={`text-[11px] font-mono w-8 text-right ${isInline ? 'text-[#FF8A00] font-semibold' : 'text-orange-400'}`}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Application List
// ─────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  applied:     'text-[#FF8A00] bg-orange-500/10 border-orange-500/20',
  shortlisted: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  interview:   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  hired:       'text-teal-400 bg-teal-500/10 border-teal-500/20',
  rejected:    'text-red-400 bg-red-500/10 border-red-500/20',
  pending:     'text-amber-400 bg-amber-500/10 border-amber-500/20',
};

function ApplicationList({ items, role }: { items: any[]; role: string }) {
  const { isInline } = React.useContext(ChatThemeContext);
  return (
    <div className="mt-3 space-y-2">
      {items.map((app, i) => {
        const statusStyle = STATUS_STYLES[app.status?.toLowerCase()] || STATUS_STYLES.pending;
        return (
          <div key={i} className={`border rounded-xl p-3 flex items-center justify-between gap-3 transition-all ${
            isInline ? 'bg-white border-slate-200/80 shadow-sm text-slate-800' : 'bg-zinc-900/60 border-white/[0.06] text-white'
          }`}>
            <div className="min-w-0 flex-1">
              {role === 'recruiter' ? (
                <>
                  <p className={`text-sm font-semibold truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>{app.candidate_name || 'Candidate'}</p>
                  <p className={`text-xs truncate ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>{app.job_title || 'Role'}</p>
                </>
              ) : (
                <>
                  <p className={`text-sm font-semibold truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>{app.job_title || 'Role'}</p>
                  <p className={`text-xs truncate ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>{app.company_name || 'Company'}</p>
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
  const { isInline } = React.useContext(ChatThemeContext);
  return (
    <div className="mt-3 space-y-2">
      {items.map((m, i) => (
        <div key={i} className={`border rounded-xl p-3 flex items-center gap-3 transition-all ${
          isInline ? 'bg-white border-slate-200/80 shadow-sm text-slate-800' : 'bg-zinc-900/60 border-white/[0.06] text-white'
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
            isInline ? 'bg-orange-50 border-orange-200/50' : 'bg-gradient-to-br from-orange-500/20 to-amber-500/20 border-white/5'
          }`}>
            <Navigation className={`w-4 h-4 ${isInline ? 'text-[#FF8A00]' : 'text-orange-400'}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold truncate ${isInline ? 'text-slate-800' : 'text-white'}`}>{m.milestone_title || 'Milestone'}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            m.milestone_status === 'completed'
              ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
              : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
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
  const { isInline } = React.useContext(ChatThemeContext);
  if (!prompts || prompts.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <div className="w-full flex items-center gap-1.5 mb-1">
        <Zap className="w-3 h-3 text-[#FF8A00]" />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isInline ? 'text-slate-400' : 'text-zinc-500'}`}>
          Next actions
        </span>
      </div>
      {prompts.map((p, i) => (
        <button
          key={i}
          onClick={() => onSend(p)}
          className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs border ${
            isInline
              ? 'bg-orange-50/50 border-orange-200/50 hover:bg-orange-50 hover:border-[#FF8A00]/40 text-slate-700 hover:text-[#FF8A00]'
              : 'bg-zinc-800/60 border-orange-500/15 hover:border-orange-500/40 hover:bg-orange-500/5 text-zinc-400 hover:text-orange-300'
          }`}
        >
          <Sparkles className="w-3 h-3 text-[#FF8A00]/60 group-hover:text-[#FF8A00] flex-shrink-0" />
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
  const { isInline } = React.useContext(ChatThemeContext);
  if (!cards || cards.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {cards.map((card, i) => (
        <button
          key={i}
          onClick={() => onNavigate(card.url)}
          className={`group inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 text-xs font-medium ${
            isInline
              ? 'bg-slate-50 border-slate-200 hover:border-[#FF8A00]/40 hover:bg-orange-50/10 text-slate-700 hover:text-[#FF8A00]'
              : 'bg-zinc-800/80 border border-white/[0.07] hover:border-orange-500/40 hover:bg-orange-600/10 transition-all duration-200 text-zinc-300 hover:text-orange-355'
          }`}
        >
          <CardIcon name={card.icon} className={`w-3.5 h-3.5 transition-colors flex-shrink-0 ${
            isInline ? 'text-slate-400 group-hover:text-[#FF8A00]' : 'text-zinc-400 group-hover:text-orange-400'
          }`} />
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
  onDeleteMessage,
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
  onDeleteMessage?: (index: number) => void;
}) {
  const { isInline } = React.useContext(ChatThemeContext);
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
          <div className={`mt-3 border rounded-2xl p-5 text-left max-w-md transition-all ${
            isInline
              ? 'bg-white border-slate-200/80 text-slate-800 shadow-sm'
              : 'bg-zinc-900/70 border-amber-500/20 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className={`text-sm font-bold uppercase tracking-wider ${isInline ? 'text-slate-800' : 'text-white'}`}>Recommendations Locked</p>
                <p className={`text-xs ${isInline ? 'text-slate-500' : 'text-zinc-500'}`}>Axis Profile Evaluation Required</p>
              </div>
            </div>
            <p className={`mt-3 text-xs leading-relaxed ${isInline ? 'text-slate-600' : 'text-zinc-400'}`}>
              This feature is currently locked. To unlock Recommended Talent and other advanced recruiter tools, please complete the Axis Profile Evaluation.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onNavigate('/onboarding/recruiter')}
                className="flex-1 py-2.5 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 border border-transparent"
              >
                Complete Evaluation
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
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mr-3 mt-1 ${
          isInline 
            ? 'bg-orange-50 border border-orange-200/50' 
            : 'bg-orange-500/20 border border-orange-500/20'
        }`}>
          <Brain className="w-3.5 h-3.5 text-[#FF8A00]" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl relative ${
            isUser
              ? 'bg-[#FF8A00] text-white rounded-tr-sm shadow-md shadow-orange-500/10'
              : isInline
                ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                : 'bg-zinc-900/70 border border-white/[0.06] text-zinc-100 rounded-tl-sm backdrop-blur-sm'
          }`}
        >
          {msg.isStreaming ? (
            <div className="flex items-center gap-2">
              <span className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full animate-bounce ${isInline ? 'bg-slate-400' : 'bg-zinc-500'}`}
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
              <span className={`text-xs ${isInline ? 'text-slate-500' : 'text-zinc-400'}`}>Thinking…</span>
            </div>
          ) : isEditing ? (
            <div className="flex flex-col gap-2 min-w-[250px] sm:min-w-[350px]">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none resize-y ${
                  isInline 
                    ? 'bg-white border-slate-200 text-slate-800 focus:border-[#FF8A00]' 
                    : 'bg-zinc-950 border-white/10 text-white focus:border-[#FF8A00]'
                }`}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingIndex(null)}
                  className={`px-2 py-1 rounded text-[10px] font-semibold transition-all border ${
                    isInline 
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' 
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/5'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => onResendMessage(index, editText)}
                  className="px-2.5 py-1 rounded bg-[#FF8A00] hover:bg-[#E67A00] text-white text-[10px] font-semibold transition-all shadow-sm"
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
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setEditingIndex(index)}
                      className="p-1 hover:bg-white/10 rounded text-zinc-300 transition-all"
                      title="Edit message"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteMessage && (
                      <button
                        onClick={() => onDeleteMessage(index)}
                        className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-zinc-400 transition-all"
                        title="Delete message and follow-up"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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

export default function GlobalChatInterface({ isInline = false }: { isInline?: boolean } = {}) {
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
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

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

      // Removed message history pre-fetch to optimize thread load times drastically
    } catch (err) {
      console.error("Error fetching access control data:", err);
    }
  }, [userRole]);

  useEffect(() => {
    if ((isChatMode || isInline) && userRole === 'recruiter') {
      fetchAccessControlData();
    }
  }, [isChatMode, isInline, userRole, fetchAccessControlData]);

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

    // Check if the candidate has active chat thread (invited)
    if (thread && thread.is_active) {
      return true;
    }

    return false;
  }, [pipelineData, chatThreads]);

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: 'smooth' | 'auto' = 'smooth') => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current;
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior,
      });
    }
  }, []);

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
    if (isChatMode || isInline) {
      // Instant scroll
      scrollToBottom('auto');
      
      // Delayed smooth scroll to account for images or components rendering
      const t1 = setTimeout(() => scrollToBottom('smooth'), 50);
      const t2 = setTimeout(() => scrollToBottom('smooth'), 150);
      const t3 = setTimeout(() => scrollToBottom('smooth'), 400);
      const t4 = setTimeout(() => scrollToBottom('smooth'), 800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [messages, isChatMode, isInline, loading, sessionLoading, scrollToBottom]);

  // ── Load session history ───────────────────
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${apiBase}/ai/assistant/sessions`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch { /* silent */ }
    finally {
      setSessionsLoading(false);
    }
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
        content:   `Hey! I'm your TechSalesAxis AI. What can I help you with?`,
        timestamp: new Date(),
        data_type: 'none',
      }]);
    }
  }, [apiBase, authHeaders, getClientContext, greetingLoaded, loadSessions]);

  // ── Load past session ──────────────────────
  const loadSession = useCallback(async (sid: string) => {
    setSessionLoading(true);
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
    } finally {
      setSessionLoading(false);
    }
  }, [apiBase, authHeaders, loadSessions]);

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
        setMessages([]);
        setGreetingLoaded(false);
        fetchGreeting(null, true);
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

  // ── Send prompt (also used by feature chip / suggestion chip click) ──
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    if (isInline) {
      localStorage.setItem('pending_first_message', text);
      useChatViewStore.getState().setChatMode(true);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

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
        if (next.length > 0) {
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
        }
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
        if (next.length > 0) {
          next[next.length - 1] = {
            role:            'assistant',
            content:         'Error: ' + (err.message || 'Unable to get response.'),
            timestamp:       new Date(),
            data_type:       'error',
          };
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders, getClientContext, loading, sessionId, userRole, hasAccessToPersonalInfo, isInline]);

  useEffect(() => {
    if (!isChatMode && !isInline) return;

    // If we are in global drawer mode, check if there is a pending first message to run
    if (!isInline && isChatMode) {
      const pending = localStorage.getItem('pending_first_message');
      if (pending) {
        localStorage.removeItem('pending_first_message');
        
        // Start a new session on the frontend
        setSessionId(null);
        localStorage.removeItem(SESSION_KEY);
        setGreetingLoaded(true);
        
        // Send the message immediately
        sendMessage(pending);
        return;
      }
    }

    // For inline dashboard chat, always start a fresh greeting conversation
    if (isInline) {
      fetchGreeting(null, true);
      return;
    }

    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      loadSession(saved).then(success => {
        if (!success) fetchGreeting(null);
      });
      return;
    }
    fetchGreeting(null);
  }, [isChatMode, isInline, fetchGreeting, loadSession, sendMessage]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    sendMessage(input);
  };

  const handleDeleteMessage = useCallback(async (idx: number) => {
    const nextMessages = messages.slice(0, idx);
    setMessages(nextMessages);
    
    if (sessionId) {
      try {
        await fetch(`${apiBase}/ai/assistant/sessions/${sessionId}/messages`, {
          method: 'PUT',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: nextMessages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            intent: m.intent,
            data_type: m.data_type,
            data_results: m.data_results,
            action_cards: m.action_cards,
            feature_prompts: m.feature_prompts,
            next_steps: m.next_steps,
          })) }),
        });
      } catch (err) {
        console.error("Failed to sync deleted message history with backend:", err);
      }
    }
    
    if (nextMessages.length === 0) {
      newSession();
    }
  }, [apiBase, authHeaders, sessionId, messages]);

  const handleUndoLast = useCallback(() => {
    if (messages.length < 2) return;
    const lastUserMsg = messages[messages.length - 2];
    if (lastUserMsg && lastUserMsg.role === 'user') {
      setInput(lastUserMsg.content);
    }
    handleDeleteMessage(messages.length - 2);
  }, [messages, handleDeleteMessage]);

  const handleResendMessage = async (idx: number, newText: string) => {
    const slicedMessages = messages.slice(0, idx);
    setMessages(slicedMessages);
    setEditingIndex(null);
    
    if (sessionId) {
      try {
        await fetch(`${apiBase}/ai/assistant/sessions/${sessionId}/messages`, {
          method: 'PUT',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: slicedMessages.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            intent: m.intent,
            data_type: m.data_type,
            data_results: m.data_results,
            action_cards: m.action_cards,
            feature_prompts: m.feature_prompts,
            next_steps: m.next_steps,
          })) }),
        });
      } catch (err) {
        console.error("Failed to sync edited message history with backend:", err);
      }
    }
    
    sendMessage(newText);
  };

  if (!isInline && !isChatMode) return null;

  const showStartup = messages.length === 0 || (messages.length === 1 && !messages[0].isStreaming && !loading);
  const welcomeText = messages[0]?.content || "How can I support your sales pipeline today?";

  return (
    <ChatThemeContext.Provider value={{ isInline }}>
      <div className={isInline 
        ? "w-full h-full flex bg-[#F8FAFC] text-slate-800 overflow-hidden relative border border-slate-200/80 rounded-2xl shadow-sm" 
        : "fixed inset-0 z-[100] flex bg-[#09090b] text-zinc-100 overflow-hidden font-sans"
      }>
        
        {/* Sidebar */}
        {!isInline && (
          <aside className="w-72 flex-shrink-0 bg-zinc-950/60 border-r border-white/[0.05] flex flex-col">
            {/* Logo */}
            <div className="px-5 py-5 border-b border-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#FF8A00] rounded-xl flex items-center justify-center shadow-lg shadow-orange-950/30">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight text-white">TechSalesAxis AI</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[9.5px] text-zinc-400 font-sans font-semibold tracking-wider uppercase">AI Assistant</p>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono ${
                      userRole === 'recruiter'
                        ? 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
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
                className="flex items-center gap-2.5 w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] hover:border-orange-500/30 rounded-xl transition-all text-sm font-medium text-zinc-300 hover:text-white"
              >
                <Plus className="w-4 h-4 text-[#FF8A00]" />
                New Conversation
              </button>
            </div>

            {/* Quick Actions */}
            <div className="px-4 pt-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 px-1">
                Quick Actions
              </p>
              <div className="space-y-1">
                {userRole === 'recruiter' ? (
                  <>
                    <button
                      onClick={() => sendMessage('Show me all candidates')}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                    >
                      <Users className="w-3.5 h-3.5 text-[#FF8A00] flex-shrink-0" />
                      Browse candidates
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
                      <Search className="w-3.5 h-3.5 text-[#FF8A00] flex-shrink-0" />
                      Jobs for my skills
                    </button>
                    <button
                      onClick={() => sendMessage('Show my Career GPS milestones')}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-all"
                    >
                      <Navigation className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                      Career GPS
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
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3 px-1">
                Recent Chats
              </p>
              {sessionsLoading && sessions.length === 0 ? (
                <div className="space-y-2 px-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 w-full rounded-xl bg-white/[0.03] animate-pulse" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-zinc-600 px-1">No sessions yet.</p>
              ) : (
                sessions.map(s => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => loadSession(s.id)}
                  onKeyDown={e => e.key === 'Enter' && loadSession(s.id)}
                  className={`group w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all hover:bg-white/[0.05] cursor-pointer ${
                    sessionId === s.id
                      ? 'bg-orange-500/10 border border-orange-500/20'
                      : 'border border-transparent'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate leading-tight">
                      {s.session_title || s.last_intent || 'Session'}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                      {timeAgo(s.updated_at)}
                      {s.message_count ? ` · ${s.message_count} msgs` : ''}
                    </p>
                  </div>
                  <button
                    onClick={e => deleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-zinc-500 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
              )}
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
        )}

        {/* ── Main ──────────────────────────────── */}
        <main className={`flex-1 flex flex-col min-w-0 relative ${isInline ? 'bg-[#F8FAFC]' : ''}`}>

          {/* Header bar */}
          {isInline ? (
            <header className="h-12 flex-shrink-0 flex items-center justify-between px-4 border-b border-slate-200/50 bg-white">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                  TechSalesAxis AI
                </span>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 1 && (
                  <button
                    onClick={handleUndoLast}
                    className="px-2.5 py-1 text-[10.5px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200/60 rounded-lg transition-all flex items-center gap-1"
                    title="Undo last message and response"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Undo Last
                  </button>
                )}
                <button
                  onClick={newSession}
                  className="px-2.5 py-1 text-[10.5px] font-bold text-[#FF8A00] hover:text-[#E67A00] bg-orange-50 hover:bg-orange-100/50 rounded-lg transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Chat
                </button>
              </div>
            </header>
          ) : (
            <header className="h-14 flex-shrink-0 flex items-center justify-between px-8 border-b border-white/[0.04] bg-zinc-950/30 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse [animation-delay:200ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse [animation-delay:400ms]" />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 tracking-wider">
                  TECHSALESAXIS AI · CONNECTED · {sessionId ? 'ACTIVE' : 'NEW SESSION'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 1 && (
                  <button
                    onClick={handleUndoLast}
                    className="px-2.5 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] rounded-xl transition-all flex items-center gap-1"
                    title="Undo last message and response"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Undo Last
                  </button>
                )}
                <button
                  onClick={toggleChatMode}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>
          )}

          {/* Messages */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6 scrollbar-thin">
            {sessionLoading ? (
              <div className="w-full space-y-6 animate-pulse">
                {/* User message skeleton */}
                <div className="flex justify-end">
                  <div className={`max-w-[70%] w-48 h-10 rounded-2xl rounded-tr-sm ${
                    isInline ? 'bg-slate-200' : 'bg-zinc-800/50 border border-white/[0.04]'
                  }`} />
                </div>
                {/* AI response skeleton */}
                <div className="flex justify-start">
                  <div className={`w-7 h-7 rounded-lg mr-3 mt-1 ${
                    isInline ? 'bg-slate-200' : 'bg-zinc-800/50'
                  }`} />
                  <div className="flex-1 max-w-[80%] space-y-3">
                    <div className={`w-full h-16 rounded-2xl rounded-tl-sm ${
                      isInline ? 'bg-slate-100 border border-slate-200' : 'bg-zinc-900/50 border border-white/[0.04]'
                    }`} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={`h-32 rounded-2xl ${
                        isInline ? 'bg-slate-100/70 border border-slate-200' : 'bg-zinc-900/40 border border-white/[0.04]'
                      }`} />
                      <div className={`h-32 rounded-2xl ${
                        isInline ? 'bg-slate-100/70 border border-slate-200' : 'bg-zinc-900/40 border border-white/[0.04]'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>
            ) : showStartup ? (
              <div className="h-full flex flex-col justify-center items-center max-w-md mx-auto text-center py-6">
                <div className="w-11 h-11 bg-gradient-to-tr from-[#FF8A00] to-[#FF6B00] rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4 animate-pulse">
                  <Brain className="w-5.5 h-5.5 text-white" />
                </div>
                <h2 className={`text-xl md:text-2xl font-serif font-semibold mb-2 leading-snug ${isInline ? 'text-slate-800' : 'text-white'}`}>
                  {welcomeText}
                </h2>
                <p className={`text-xs mb-6 max-w-xs ${isInline ? 'text-slate-500' : 'text-zinc-400'}`}>
                  Ask me to search candidates, check market updates, or draft job postings.
                </p>
                <div className="w-full grid grid-cols-1 gap-2">
                  {hints.slice(0, 1).map((hint, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(hint)}
                      className={`w-full text-left p-3 border rounded-2xl text-xs transition-all duration-200 shadow-sm flex items-center justify-between group ${
                        isInline
                          ? "bg-white border-slate-200 hover:border-orange-300 text-slate-700 hover:bg-orange-50/10"
                          : "bg-zinc-900 border-white/[0.08] hover:border-orange-500/30 text-zinc-350 hover:bg-white/[0.02]"
                      }`}
                    >
                      <span className="truncate pr-2 font-medium">{hint}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#FF8A00] transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
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
                    onDeleteMessage={handleDeleteMessage}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input bar */}
          <div className={isInline 
            ? "px-4 pb-4 pt-3 bg-white border-t border-slate-100" 
            : "px-6 pb-6 pt-4 bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent"
          }>
            <div className="relative max-w-3xl mx-auto">
              <div className={`absolute -inset-px rounded-2xl opacity-0 focus-within:opacity-100 transition-opacity duration-350 blur-sm pointer-events-none ${
                isInline ? "bg-[#FF8A00]/10" : "bg-[#FF8A00]/25"
              }`} />

              <div className={`relative flex items-end gap-2 border rounded-2xl p-2.5 transition-all duration-200 shadow-sm ${
                isInline 
                  ? "bg-slate-50 border-slate-200 focus-within:border-[#FF8A00] focus-within:bg-white" 
                  : "bg-zinc-900/90 backdrop-blur-xl border-white/[0.08] focus-within:border-[#FF8A00]"
              }`}>
                {/* Mic */}
                <button
                  onClick={toggleListening}
                  className={`flex-shrink-0 w-8.5 h-8.5 flex items-center justify-center rounded-xl transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : isInline
                        ? 'text-slate-400 hover:text-slate-650 hover:bg-slate-200/50'
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
                  className={`flex-1 bg-transparent text-[13.5px] resize-none outline-none py-1.5 px-1 min-h-[36px] max-h-[120px] leading-relaxed font-sans ${
                    isInline ? 'text-slate-800 placeholder:text-slate-400' : 'text-zinc-100 placeholder:text-zinc-500'
                  }`}
                />

                {/* Send */}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="flex-shrink-0 w-8.5 h-8.5 flex items-center justify-center rounded-xl bg-[#FF8A00] hover:bg-[#E67A00] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md shadow-orange-900/10"
                >
                  {loading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send    className="w-3.5 h-3.5" />
                  }
                </button>
              </div>

              {/* Hint line */}
              <p className={`text-center text-[9px] mt-1.5 font-sans ${
                isInline ? "text-slate-400" : "text-zinc-500"
              }`}>
                Enter to send · Shift+Enter for new line
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
                  <p className="text-[10px] text-zinc-400 mt-0.5">Platform View</p>
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
    </ChatThemeContext.Provider>
  );
}