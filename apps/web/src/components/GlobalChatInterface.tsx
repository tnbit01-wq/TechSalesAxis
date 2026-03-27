'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChatViewStore } from '@/hooks/useChatViewStore';
import { 
  Mic, Send, MessageSquare, History, User, Settings, X, Plus, 
  LayoutDashboard, Volume2, MicOff, Sparkles, Brain, Briefcase, 
  Users, Building2, ExternalLink, BarChart3, ShieldCheck, Target 
} from 'lucide-react';
import { awsAuth } from '@/lib/awsAuth';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  data_type?: 'candidate_list' | 'job_list' | 'company_list' | 'behavioral_report' | 'market_data' | 'none';
  data_results?: any[];
  intelligence_metrics?: Record<string, number>;
}

export default function GlobalChatInterface() {
  const { isChatMode, toggleChatMode } = useChatViewStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'assistant', 
      content: "Welcome back. I'm synchronizing with your TechSales Axis workspace. What's our focus today?", 
      timestamp: new Date() 
    }
  ]);
  
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isChatMode) scrollToBottom();
  }, [messages, isChatMode]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg: ChatMessage = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = awsAuth.getToken();
      
      const response = await fetch('http://127.0.0.1:8000/ai/strategic-intent/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: input })
      });

      const result = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.text, 
        timestamp: new Date(),
        data_type: result.data_type,
        data_results: result.data_results,
        intelligence_metrics: result.intelligence_metrics
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Neural link interrupted. Please check your connection.", 
        timestamp: new Date() 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const renderResults = (msg: ChatMessage) => {
    if (!msg.data_results && !msg.intelligence_metrics) return null;

    return (
      <div className="mt-4 space-y-6 animate-in fade-in zoom-in duration-500">
        {msg.data_type === 'behavioral_report' && msg.intelligence_metrics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
             {Object.entries(msg.intelligence_metrics).map(([key, val]: [string, any]) => (
                <div key={key} className="bg-zinc-950/80 border border-white/5 p-4 rounded-3xl relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-full" />
                   <p className="text-[10px] text-zinc-500 uppercase font-mono mb-1">{key.replace('_', ' ')}</p>
                   <p className="text-xl font-bold text-white pr-2">{val}%</p>
                   <div className="mt-2 w-full h-1 bg-zinc-800 rounded-full">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${val}%` }} />
                   </div>
                </div>
             ))}
          </div>
        )}

        {msg.data_type === 'market_data' && (
           <div className="flex flex-wrap gap-3">
              {msg.data_results?.map((item: any, idx: number) => (
                <div key={idx} className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-3xl min-w-[140px] flex flex-col items-center justify-center flex-1">
                   <p className="text-[10px] text-emerald-500/60 uppercase font-mono mb-1">{item.label}</p>
                   <p className="text-2xl font-bold text-emerald-400 font-mono tracking-tighter">{item.value}</p>
                </div>
              ))}
           </div>
        )}

        {msg.data_type === 'candidate_list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {msg.data_results?.map((item: any, idx: number) => (
              <div key={idx} className="bg-zinc-900/40 border border-white/5 rounded-3xl p-5 hover:bg-zinc-800/50 transition-all group relative">
                <div className="absolute top-4 right-4 flex items-center gap-2">
                   <span className="bg-indigo-500/10 text-indigo-400 p-1 rounded-lg border border-indigo-400/20 shadow-[0_0_10px_rgba(79,70,229,0.1)]">
                     <ShieldCheck className="w-4 h-4" />
                   </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center text-indigo-400 shadow-inner">
                    <User className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-white tracking-tight">{item.full_name}</h4>
                    <p className="text-xs text-zinc-500">IT Tech Sales Specialist</p>
                    <div className="mt-3 flex items-center gap-4">
                       <div className="flex items-center gap-1">
                          <Target className="w-3 h-3 text-zinc-600" />
                          <span className="text-[10px] font-mono text-zinc-400">SCORE: {item.profile_score}%</span>
                       </div>
                       <div className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3 text-zinc-600" />
                          <span className="text-[10px] font-mono text-zinc-400">DNA_OK</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isChatMode) return null;

  return (
    <div className="fixed inset-0 z-[100] flex bg-[#09090b] text-zinc-100 overflow-hidden font-sans">
      <aside className="w-[280px] bg-zinc-950/50 backdrop-blur-3xl border-r border-white/5 flex flex-col p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.3)] group-hover:scale-110 transition-transform">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">TALENTCORE</h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Intel v4.0.2</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <button className="flex items-center gap-3 w-full p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all text-sm group">
            <Plus className="w-4 h-4 text-indigo-400 group-hover:rotate-90 transition-transform" />
            <span className="font-semibold">New Intelligence Session</span>
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto custom-scrollbar">
          <div>
            <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4 px-2 italic">Intelligence History</h3>
            <div className="space-y-1">
              {['Sourcing Audit', 'Integrity Analysis', 'Strategic DNA'].map((item) => (
                <button key={item} className="flex items-center gap-3 w-full p-2.5 text-xs text-zinc-400 hover:text-white hover:bg-indigo-500/10 rounded-xl transition-all group">
                  <History className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400" />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="pt-6 border-t border-white/5 space-y-3">
          <button 
            onClick={toggleChatMode}
            className="flex items-center gap-3 w-full p-3 text-sm font-bold text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl transition-all"
          >
            <LayoutDashboard className="w-4 h-4" />
            Return to Dashboard
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.05)_0%,transparent_50%)]">
        <header className="h-16 flex items-center px-10 justify-between">
          <div className="flex items-center gap-4">
            <div className="flex space-x-1">
              <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
              <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse delay-75" />
              <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse delay-150" />
            </div>
            <span className="text-[10px] font-mono text-zinc-500 tracking-wider">SECURE LINK ESTABLISHED / SYNC_OK</span>
          </div>
          <button onClick={toggleChatMode} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-10 md:px-24 xl:px-64 pt-6 space-y-10 custom-scrollbar pb-32">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-500`}>
              <div className={`relative max-w-[85%] ${m.role === 'user' ? 'order-2' : ''}`}>
                <div className={`p-5 rounded-3xl ${
                  m.role === 'user' 
                  ? 'bg-indigo-600 text-white shadow-[0_10px_30px_rgba(79,70,229,0.2)]' 
                  : 'bg-zinc-900/80 backdrop-blur-md border border-white/5 text-zinc-100 shadow-xl'
                }`}>
                  <p className="text-[15px] leading-relaxed font-medium">
                    {m.content}
                  </p>
                  
                  {renderResults(m)}

                  <span className="mt-3 block text-[9px] font-mono opacity-50 uppercase tracking-widest">
                    {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="absolute bottom-8 inset-x-0 px-10 md:px-24 xl:px-64">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2rem] blur opacity-10 group-focus-within:opacity-25 transition duration-1000"></div>
            <div className="relative flex items-center bg-zinc-900/90 backdrop-blur-2xl border border-white/10 rounded-[1.8rem] p-2 transition-all shadow-2xl">
              <button 
                onClick={toggleListening}
                className={`p-4 rounded-2xl transition-all ${
                  isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'text-zinc-500 hover:bg-white/5 hover:text-indigo-400'
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5 flex-shrink-0" /> : <Mic className="w-5 h-5 flex-shrink-0" />}
              </button>
              
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? "Listening..." : "Type strategic command..."}
                className="w-full bg-transparent border-none text-zinc-100 placeholder:text-zinc-600 px-4 py-3 focus:outline-none focus:ring-0 resize-none min-h-[56px] max-h-[200px] text-sm font-medium"
              />

              <button 
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-2xl transition-all shadow-lg active:scale-95"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
