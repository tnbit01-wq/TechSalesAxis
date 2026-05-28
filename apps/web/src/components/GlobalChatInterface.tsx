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
  ClipboardList, Navigation, MessageSquare, Zap,
} from 'lucide-react';
import { awsAuth } from '@/lib/awsAuth';

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

function CandidateCards({ items }: { items: any[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {items.map((c, i) => {
        const isVerified = c.is_verified || c.assessment_status === 'completed';
        const isPassive  = c.is_passive  || (!isVerified && c.assessment_status !== 'in_progress');
        return (
          <div
            key={i}
            className="group bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-blue-500/30 hover:bg-zinc-800/60 transition-all duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 flex items-center justify-center flex-shrink-0 border border-white/5 relative">
                <User className="w-5 h-5 text-blue-400" />
                {/* Verified / passive indicator dot */}
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-zinc-900 ${
                    isVerified ? 'bg-emerald-500' : isPassive ? 'bg-amber-500' : 'bg-blue-400'
                  }`}
                  title={isVerified ? 'Verified' : isPassive ? 'Passive candidate' : 'Assessment in progress'}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {c.full_name || c.name || 'Unnamed'}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {c.current_role || 'IT Sales Professional'}
                </p>
              </div>
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
              {c.current_location && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                  <MapPin className="w-3 h-3" />
                  {c.current_location}
                </span>
              )}
              {typeof c.culture_match_score === 'number' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <BarChart3 className="w-3 h-3" />
                  {Math.round(c.culture_match_score)}% match
                </span>
              )}
              {/* Verified / Passive badge */}
              {isVerified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              ) : isPassive ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <UserCheck className="w-3 h-3" />
                  Passive
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  <Loader2 className="w-3 h-3" />
                  In Progress
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Candidate Profile Card (detailed)
// ─────────────────────────────────────────────

function CandidateProfileCard({ item }: { item: any }) {
  return (
    <div className="mt-3 bg-zinc-900/70 border border-white/[0.07] rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600/25 to-violet-600/25 flex items-center justify-center flex-shrink-0 border border-white/5">
          <User className="w-7 h-7 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white">{item.full_name || 'Candidate'}</p>
          <p className="text-sm text-zinc-400 mt-0.5">{item.current_role || 'IT Sales Professional'}</p>
          <p className="text-xs text-zinc-600 mt-0.5 font-mono">{item.email}</p>
        </div>
        {item.assessment_status === 'completed' && (
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {item.years_of_experience != null && (
          <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-zinc-500 font-mono">Experience</p>
            <p className="text-sm font-semibold text-white mt-0.5">{item.years_of_experience} yrs</p>
          </div>
        )}
        {item.current_location && (
          <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-zinc-500 font-mono">Location</p>
            <p className="text-sm font-semibold text-white mt-0.5 truncate">{item.current_location}</p>
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
    </div>
  );
}

// ─────────────────────────────────────────────
// Resume Info Card
// ─────────────────────────────────────────────

function ResumeInfoCard({ item }: { item: any }) {
  return (
    <div className="mt-3 bg-zinc-900/70 border border-white/[0.07] rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 flex items-center justify-center flex-shrink-0 border border-white/5">
          <FileText className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{item.full_name}'s Resume</p>
          <p className="text-xs text-zinc-500 font-mono">{item.file_name || 'resume.pdf'}</p>
        </div>
      </div>
      {item.parsed_data && (
        <div className="mt-3 text-xs text-zinc-400 bg-zinc-800/50 rounded-xl p-3 border border-white/5 font-mono whitespace-pre-wrap line-clamp-4">
          {typeof item.parsed_data === 'string'
            ? item.parsed_data.slice(0, 300)
            : JSON.stringify(item.parsed_data).slice(0, 300)}
          {' '}…
        </div>
      )}
      <p className="mt-2 text-[10px] text-zinc-600 font-mono">
        Uploaded {item.uploaded_at ? new Date(item.uploaded_at).toLocaleDateString() : '—'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Job Cards
// ─────────────────────────────────────────────

function JobCards({ items }: { items: any[] }) {
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
              <div className="mt-2 flex flex-wrap gap-1.5">
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
              </div>
            </div>
          </div>
        </div>
      ))}
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
}: {
  msg: ChatMessage;
  onNavigate: (url: string) => void;
  onSendPrompt: (text: string) => void;
  userRole: string;
}) {
  const isUser = msg.role === 'user';

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
        {hasData && msg.data_type === 'candidate_list'    && <CandidateCards items={msg.data_results!} />}
        {hasData && msg.data_type === 'candidate_profile' && <CandidateProfileCard item={msg.data_results![0]} />}
        {hasData && msg.data_type === 'resume_info'       && <ResumeInfoCard item={msg.data_results![0]} />}
        {hasData && msg.data_type === 'job_list'          && <JobCards items={msg.data_results!} />}
        {hasData && msg.data_type === 'company_list'      && <CompanyCards items={msg.data_results!} />}
        {hasData && msg.data_type === 'market_data'       && <MarketData items={msg.data_results!} />}
        {hasData && msg.data_type === 'application_list'  && <ApplicationList items={msg.data_results!} role={userRole} />}
        {hasData && msg.data_type === 'career_gps'        && <CareerGPSCards items={msg.data_results!} />}

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
          className={`px-4 py-3 rounded-2xl ${
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
          ) : (
            <>
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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

  // ── State ──────────────────────────────────
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionId,   setSessionId]   = useState<string | null>(null);
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [greetingLoaded, setGreetingLoaded] = useState(false);

  const recognitionRef  = useRef<any>(null);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

  const userInfo = typeof window !== 'undefined' ? awsAuth.getUser() : null;
  const userRole = ((userInfo as any)?.role as string | undefined) || '';

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
  const fetchGreeting = useCallback(async (sid: string | null) => {
    if (greetingLoaded) return;
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
    setGreetingLoaded(false);
    localStorage.removeItem(SESSION_KEY);
    setMessages([{
      role: 'assistant',
      content: 'New session started. What are we focusing on today?',
      timestamp: new Date(),
      data_type: 'none',
    }]);
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
    </div>
  );
}