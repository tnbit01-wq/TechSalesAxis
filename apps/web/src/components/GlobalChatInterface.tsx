'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useChatViewStore } from '@/hooks/useChatViewStore';
import {
  Mic, Send, X, Plus, LayoutDashboard, MicOff, Brain,
  Briefcase, Users, Building2, BarChart3, ShieldCheck,
  Target, AlertCircle, User, ExternalLink, ArrowRight,
  Trash2, Clock, ChevronRight, Sparkles, FileText,
  TrendingUp, Search, CheckCircle2, Loader2,
} from 'lucide-react';
import { awsAuth } from '@/lib/awsAuth';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type DataType =
  | 'candidate_list'
  | 'job_list'
  | 'company_list'
  | 'market_data'
  | 'behavioral_report'
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
  intelligence_metrics?: Record<string, number>;
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
// Constants
// ─────────────────────────────────────────────

const SESSION_KEY = 'ai_chat_session_id';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  user:      ({ className }) => <User      className={className} />,
  file:      ({ className }) => <FileText  className={className} />,
  users:     ({ className }) => <Users     className={className} />,
  briefcase: ({ className }) => <Briefcase className={className} />,
  send:      ({ className }) => <Send      className={className} />,
  search:    ({ className }) => <Search    className={className} />,
  building:  ({ className }) => <Building2 className={className} />,
  building2: ({ className }) => <Building2 className={className} />,
  plus:      ({ className }) => <Plus      className={className} />,
  chart:     ({ className }) => <BarChart3 className={className} />,
  clipboard: ({ className }) => <CheckCircle2 className={className} />,
  link:      ({ className }) => <ExternalLink className={className} />,
};

function CardIcon({ name, className }: { name: string; className?: string }) {
  const Comp = ICON_MAP[name] || ICON_MAP['link'];
  return <Comp className={className} />;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─────────────────────────────────────────────
// Result Renderers
// ─────────────────────────────────────────────

function CandidateCards({ items }: { items: any[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
      {items.map((c, i) => (
        <div key={i} className="group bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 hover:border-blue-500/30 hover:bg-zinc-800/60 transition-all duration-200">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 flex items-center justify-center flex-shrink-0 border border-white/5">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{c.full_name || c.name || 'Unnamed'}</p>
              <p className="text-xs text-zinc-500 truncate">{c.current_role || 'Professional'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400">
              <Target className="w-3 h-3 text-zinc-600" />
              {c.years_of_experience || 0}y exp
            </span>
            {typeof c.culture_match_score === 'number' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <BarChart3 className="w-3 h-3" />
                {Math.round(c.culture_match_score)}% match
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-blue-400">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

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
              <p className="text-sm font-semibold text-white truncate">{job.title || job.job_title || 'Role'}</p>
              <p className="text-xs text-zinc-500 truncate">{job.company_name || 'Company'} · {job.location || 'Location'}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{job.salary_range || 'Competitive'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {typeof job.match_score === 'number' && (
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    {Math.round(job.match_score)}% match
                  </span>
                )}
                {job.experience_band && (
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
                    {job.experience_band}
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
              <p className="text-sm font-semibold text-white truncate">{co.company_name || co.name || 'Company'}</p>
              <p className="text-xs text-zinc-500 truncate">{co.industry || co.industry_category || 'High-growth'}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">{co.location || 'Global'} · {co.size || co.size_band || 'Growth-stage'}</p>
              {co.match_score && (
                <span className="mt-1.5 inline-flex text-[10px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  {Math.round(co.match_score)}% culture fit
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketData({ items }: { items: any[] }) {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="mt-3 space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-zinc-400 w-36 truncate flex-shrink-0">{item.label}</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-emerald-400 w-6 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Action Cards
// ─────────────────────────────────────────────

function ActionCards({ cards, onNavigate }: { cards: ActionCard[]; onNavigate: (url: string) => void }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {cards.map((card, i) => (
        <button
          key={i}
          onClick={() => onNavigate(card.url)}
          className="group inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800/80 border border-white/[0.07] hover:border-blue-500/40 hover:bg-blue-600/10 transition-all duration-200 text-xs font-medium text-zinc-300 hover:text-blue-300"
        >
          <CardIcon name={card.icon} className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
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

function MessageBubble({ msg, onNavigate }: { msg: ChatMessage; onNavigate: (url: string) => void }) {
  const isUser = msg.role === 'user';

  const renderData = () => {
    if (!msg.data_results?.length && msg.data_type === 'none') return null;

    return (
      <>
        {msg.data_type === 'error' && (
          <div className="mt-3 flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">Connection issue. Please retry.</p>
          </div>
        )}
        {msg.data_type === 'candidate_list' && msg.data_results && <CandidateCards items={msg.data_results} />}
        {msg.data_type === 'job_list'       && msg.data_results && <JobCards       items={msg.data_results} />}
        {msg.data_type === 'company_list'   && msg.data_results && <CompanyCards   items={msg.data_results} />}
        {msg.data_type === 'market_data'    && msg.data_results && <MarketData     items={msg.data_results} />}
        {msg.action_cards && <ActionCards cards={msg.action_cards} onNavigate={onNavigate} />}
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

      <div className={`max-w-[82%] ${isUser ? 'order-first' : ''}`}>
        <div className={`px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-blue-600 text-white rounded-tr-sm shadow-lg shadow-blue-900/20'
            : 'bg-zinc-900/70 border border-white/[0.06] text-zinc-100 rounded-tl-sm backdrop-blur-sm'
        }`}>
          {msg.isStreaming ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              <span className="text-sm text-zinc-400">Thinking…</span>
            </div>
          ) : (
            <>
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {renderData()}
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
  const pathname  = usePathname();
  const router    = useRouter();

  // ── State ──────────────────────────────────
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [sessionId,   setSessionId]   = useState<string | null>(null);
  const [sessions,    setSessions]    = useState<SessionSummary[]>([]);
  const [messages,    setMessages]    = useState<ChatMessage[]>([{
    role:      'assistant',
    content:   'Synchronising with your workspace…',
    timestamp: new Date(),
  }]);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);

  const userInfo = typeof window !== 'undefined' ? awsAuth.getUser() : null;
  const userRole = (userInfo as any)?.role as string | undefined;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';

  // ── Auth helper ────────────────────────────
  const authHeaders = useCallback(() => {
    const token = awsAuth.getToken();
    if (!token) throw new Error('No authentication token');
    return {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }, []);

  // ── Speech recognition ─────────────────────
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    rec.onerror  = () => setIsListening(false);
    rec.onend    = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); }
    else             { setIsListening(true); recognitionRef.current?.start(); }
  };

  // ── Scroll ─────────────────────────────────
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

  useEffect(() => {
    if (isChatMode) {
      // Restore session from localStorage
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) setSessionId(saved);
      loadSessions();
    }
  }, [isChatMode, loadSessions]);

  // ── Load a past session ────────────────────
  const loadSession = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`${apiBase}/ai/assistant/sessions/${sid}/messages`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      const msgs: ChatMessage[] = (data.messages || []).map((m: any) => ({
        role:      m.role,
        content:   m.content,
        timestamp: new Date(m.timestamp || Date.now()),
      }));
      setMessages(msgs.length ? msgs : [{
        role: 'assistant', content: 'Session loaded. What would you like to continue?', timestamp: new Date(),
      }]);
      setSessionId(sid);
      localStorage.setItem(SESSION_KEY, sid);
    } catch { /* silent */ }
  }, [apiBase, authHeaders]);

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
    setMessages([{
      role: 'assistant',
      content: 'New session started. What are we focusing on today?',
      timestamp: new Date(),
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

  // ── Send ───────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date() };
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
          prompt:     input,
          session_id: sessionId,
          client_context: {
            role:   userRole,
            path:   pathname,
            source: 'global_chat',
          },
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const result = await res.json();

      // Persist session
      if (result.session_id) {
        setSessionId(result.session_id);
        localStorage.setItem(SESSION_KEY, result.session_id);
        loadSessions();
      }

      // Replace streaming placeholder
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = {
          role:         'assistant',
          content:      result.text || 'Processing complete.',
          timestamp:    new Date(),
          data_type:    result.data_type   || 'none',
          data_results: result.data_results,
          action_cards: result.action_cards,
          isStreaming:  false,
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
  };

  if (!isChatMode) return null;

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex bg-[#09090b] text-zinc-100 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 bg-zinc-950/60 border-r border-white/[0.05] flex flex-col">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">TalentCore AI</p>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest">GLOBAL ASSISTANT</p>
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
                sessionId === s.id ? 'bg-blue-600/10 border border-blue-500/20' : 'border border-transparent'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300 truncate leading-tight">
                  {s.session_title || s.last_intent || 'Session'}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{timeAgo(s.updated_at)}</p>
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

      {/* ── Main ─────────────────────────────────── */}
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
          <button onClick={toggleChatMode} className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 md:px-16 lg:px-32 xl:px-48 pt-8 pb-40 space-y-6">
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} onNavigate={handleNavigate} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="absolute bottom-0 inset-x-0 px-6 md:px-16 lg:px-32 xl:px-48 pb-6 pt-4 bg-gradient-to-t from-[#09090b] via-[#09090b]/95 to-transparent">
          <div className="relative">
            {/* Glow */}
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
                placeholder={isListening ? 'Listening…' : 'Ask anything — find candidates, jobs, companies, market trends…'}
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

            {/* Hint */}
            <p className="text-center text-[10px] text-zinc-700 mt-2 font-mono">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}