"use client";

import { useState, useEffect, useRef } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import CandidateProfileModal from "./CandidateProfileModal";
import { Archive, MessageCircle, Trash2, User, Paperclip, ClipboardList, RotateCcw, Flag, Send, Search, Hash, MoreVertical } from "lucide-react";
import ReportMessageModal from "./ReportMessageModal";

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

interface Thread {
  id: string;
  candidate_id: string;
  recruiter_id: string;
  last_message_at: string;
  is_active: boolean;
  candidate_profiles?: { full_name: string; profile_photo_url: string };
  recruiter_profiles?: { full_name: string; company_id: string };
}

interface ChatCenterProps {
  userId: string;
  role: "candidate" | "recruiter";
}

export default function ChatCenter({ userId, role }: ChatCenterProps) {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showActions, setShowActions] = useState(false);
  const [profileModal, setProfileModal] = useState<{ isOpen: boolean; candidate: any }>({ isOpen: false, candidate: null });
  const [reportModal, setReportModal] = useState<{ isOpen: boolean; messageId: string; senderName: string }>({ isOpen: false, messageId: "", senderName: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  const RECRUITER_TEMPLATES = [
    { label: "Invite", text: "Hi, I've reviewed your DNA Insights and would love to discuss the next steps." },
    { label: "Availability", text: "Could you please share your availability for a brief technical screening?" },
    { label: "Shortlist", text: "We've decided to move forward with your application. Welcome to the next round!" },
    { label: "Feedback", text: "Thank you for your time. Your assessment scores were impressive." },
  ];

  const CANDIDATE_TEMPLATES = [
    { label: "Accept", text: "Thank you for the opportunity. I'm excited to learn more about the role." },
    { label: "Updated", text: "I've updated my profile with the latest certifications we discussed." },
    { label: "Confirm", text: "My availability for the interview is scheduled on the portal. Looking forward to it!" },
  ];

  const applyTemplate = (text: string) => setNewMessage(text);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.info(`Uploading ${file.name}...`);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      const formData = new FormData();
      formData.append("file", file);
      const result = await apiClient.post("/posts/upload", formData, token);
      if (result.url) {
        setNewMessage(prev => prev + ` [File: ${result.url}] `);
        toast.success("File attached.");
      }
    } catch (err) {
      console.error("File upload error:", err);
      toast.error("Upload failed.");
    }
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleDeleteChat = async () => {
    if (!activeThreadId) return;
    if (!confirm("This will permanently delete this conversation. Proceed?")) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(`/chat/delete/${activeThreadId}`, {}, token);
      setThreads(prev => prev.filter(t => t.id !== activeThreadId));
      setActiveThreadId(null);
      toast.success("Conversation deleted.");
    } catch (err) {
      console.error("Delete chat error:", err);
      toast.error("Delete failed.");
    }
  };

  const handleCloseChat = async () => {
    if (!activeThreadId) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(`/chat/archive/${activeThreadId}`, {}, token);
      setThreads(prev => prev.filter(t => t.id !== activeThreadId));
      setActiveThreadId(null);
      toast.success("Conversation archived.");
    } catch (err) {
      console.error("Close chat error:", err);
      toast.error("Failed to close conversation.");
    }
  };

  const handleViewProfile = async () => {
    const active = threads.find(t => t.id === activeThreadId);
    if (!active) return;
    if (role === "candidate") { router.push("/dashboard/candidate/profile"); return; }
    if (active.candidate_id) {
      try {
        const token = awsAuth.getToken();
        if (!token) return;
        await apiClient.post(`/analytics/profile/${active.candidate_id}/view`, {}, token).catch(() => {});
        const fullCandidate = await apiClient.get(`/recruiter/candidate/${active.candidate_id}`, token);
        setProfileModal({ isOpen: true, candidate: fullCandidate });
      } catch (err) {
        console.error("Fetch profile error:", err);
        toast.error("Could not load candidate profile.");
      }
    }
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Close actions menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchThreads = async () => {
      try {
        const token = awsAuth.getToken();
        if (!token) return;
        const data = await apiClient.get(`/chat/threads?show_archived=${showArchived}`, token);
        if (data) setThreads(data as Thread[]);
      } catch (err) {
        console.error("Fetch threads error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchThreads();
  }, [userId, role, showArchived]);

  const filteredThreads = threads.filter(t => {
    if (!searchQuery) return true;
    const name = (role === "recruiter" ? t.candidate_profiles?.full_name : t.recruiter_profiles?.full_name) || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  useEffect(() => {
    if (!activeThreadId) return;
    const fetchMessages = async () => {
      try {
        const token = awsAuth.getToken();
        if (!token) return;
        const data = await apiClient.get(`/chat/messages/${activeThreadId}`, token);
        if (data) setMessages(data as Message[]);
      } catch (err) {
        console.error("Fetch messages error:", err);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [activeThreadId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThreadId) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      const result = await apiClient.post("/chat/send", { thread_id: activeThreadId, content: newMessage.trim() }, token);
      if (result) {
        setNewMessage("");
        const data = await apiClient.get(`/chat/messages/${activeThreadId}`, token);
        if (data) setMessages(data as Message[]);
        setThreads((prev) => prev.map((t) => t.id === activeThreadId ? { ...t, last_message_at: new Date().toISOString() } : t));
      }
    } catch (err) {
      console.error("Send message error:", err);
      toast.error("Failed to send message.");
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);
  const activeName = role === "recruiter" 
    ? activeThread?.candidate_profiles?.full_name || "Candidate" 
    : activeThread?.recruiter_profiles?.full_name || "Recruiter";

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00] animate-spin" />
        <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Loading messages…</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* ── LEFT: Thread List ── */}
      <div className="w-[300px] border-r border-slate-100 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => { setShowArchived(false); setActiveThreadId(null); }}
              className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all ${!showArchived ? "bg-[#0F172A] text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}>
              Active
            </button>
            <button onClick={() => { setShowArchived(true); setActiveThreadId(null); }}
              className={`flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all ${showArchived ? "bg-[#0F172A] text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}>
              Archived
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search conversations…"
              className="w-full pl-9 pr-3 py-2 bg-[#F8F9FC] border border-slate-200/60 rounded-lg text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00]/50 transition-all" />
          </div>
        </div>
        {/* Thread List */}
        <div className="flex-1 overflow-y-auto dashboard-scroll">
          {filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center mb-3">
                {showArchived ? <Archive className="h-5 w-5 text-slate-300" /> : <MessageCircle className="h-5 w-5 text-slate-300" />}
              </div>
              <p className="text-[13px] font-semibold text-[#0F172A]">No {showArchived ? "archived" : "active"} conversations</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {showArchived ? "Archived conversations will appear here" : "Start a conversation from a candidate profile"}
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const name = role === "recruiter" ? thread.candidate_profiles?.full_name || "New Candidate" : thread.recruiter_profiles?.full_name || "Recruiter";
              const photo = role === "recruiter" ? thread.candidate_profiles?.profile_photo_url : null;
              const isActive = activeThreadId === thread.id;
              return (
                <button key={thread.id} onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 transition-all relative ${isActive ? "bg-[#FFF6ED]" : "hover:bg-slate-50/80"}`}>
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF8A00] rounded-r-full" />}
                  <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 ring-1 ring-slate-100">
                    {photo ? (
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-[#FF8A00]/10 to-[#FF8A00]/5 text-[#FF8A00] font-bold text-[13px]">
                        {name[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className={`text-[13px] font-semibold truncate ${isActive ? "text-[#FF8A00]" : "text-[#0F172A]"}`}>{name}</p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      {thread.last_message_at ? format(new Date(thread.last_message_at), "MMM d, h:mm a") : "New conversation"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Chat Window ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FAFBFC]">
        {activeThreadId ? (
          <>
            {/* Chat Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)] flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-[14px] font-bold text-[#0F172A] truncate">{activeName}</h3>
                  <p className="text-[10.5px] text-emerald-500 font-medium">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0" ref={actionsRef}>
                <button onClick={handleViewProfile} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors" title={role === "recruiter" ? "View Profile" : "My Profile"}>
                  <User className="h-4 w-4 text-slate-400" />
                </button>
                <div className="h-5 w-px bg-slate-100 mx-0.5" />
                <button onClick={() => setShowActions(!showActions)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
                  <MoreVertical className="h-4 w-4 text-slate-400" />
                </button>
                {showActions && (
                  <div className="absolute right-5 top-14 w-48 bg-white rounded-xl border border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                    {showArchived ? (
                      <button onClick={async () => {
                        const token = awsAuth.getToken(); if (!token) return;
                        await apiClient.post(`/chat/restore/${activeThreadId}`, {}, token);
                        setThreads(prev => prev.filter(t => t.id !== activeThreadId));
                        setActiveThreadId(null); setShowActions(false);
                        toast.success("Conversation restored.");
                      }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
                        <RotateCcw className="h-3.5 w-3.5 text-slate-400" />Restore Conversation
                      </button>
                    ) : (
                      <button onClick={() => { handleCloseChat(); setShowActions(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
                        <Archive className="h-3.5 w-3.5 text-slate-400" />Archive Conversation
                      </button>
                    )}
                    <div className="mx-3 border-t border-slate-100" />
                    <button onClick={() => { handleDeleteChat(); setShowActions(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] font-medium text-red-500 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />Delete Conversation
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 dashboard-scroll">
              {messages.map((msg) => {
                const isMine = msg.sender_id === userId;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} group`}>
                    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[70%]`}>
                      <div className={`rounded-2xl px-4 py-3 relative ${
                        isMine
                          ? "bg-[#FF8A00] text-white rounded-br-md"
                          : "bg-white text-[#0F172A] border border-slate-200/60 rounded-bl-md shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                      }`}>
                        <p className="text-[13px] leading-relaxed">{msg.text}</p>
                        {!isMine && (
                          <button onClick={() => setReportModal({ isOpen: true, messageId: msg.id, senderName: activeName })}
                            className="absolute -right-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 rounded-lg">
                            <Flag className="w-3 h-3 text-red-400" />
                          </button>
                        )}
                      </div>
                      <p className={`text-[10px] mt-1.5 px-1 ${isMine ? "text-slate-300" : "text-slate-400"}`}>
                        {format(new Date(msg.created_at), "h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="px-5 py-3.5 bg-white border-t border-slate-100 flex-shrink-0">
              <form onSubmit={sendMessage} className="flex items-center gap-2 mb-2.5">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
                  <Paperclip className="h-4 w-4 text-slate-400" />
                </button>
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message…"
                  className="flex-1 bg-[#F8F9FC] border border-slate-200/60 rounded-xl px-4 py-2.5 text-[13px] text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00]/50 transition-all" />
                <button type="submit" disabled={!newMessage.trim()}
                  className="h-9 w-9 flex items-center justify-center rounded-xl bg-[#FF8A00] hover:bg-[#E67A00] text-white disabled:opacity-30 transition-all active:scale-95 flex-shrink-0 shadow-sm">
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {(role === "recruiter" ? RECRUITER_TEMPLATES : CANDIDATE_TEMPLATES).map((tmpl, idx) => (
                  <button key={idx} onClick={() => applyTemplate(tmpl.text)}
                    className="whitespace-nowrap px-3 py-1.5 bg-[#FFF6ED] border border-orange-100/80 rounded-lg text-[10px] font-semibold text-[#FF8A00] hover:bg-[#FF8A00] hover:text-white transition-all flex items-center gap-1.5 shrink-0">
                    <ClipboardList className="w-3 h-3 opacity-60" />
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-[#FF8A00]/5 blur-[60px] rounded-full scale-150" />
              <div className="relative h-24 w-24 rounded-2xl bg-white border border-slate-200/60 flex items-center justify-center shadow-[0_6px_24px_rgba(0,0,0,0.06)]">
                <MessageCircle className="h-10 w-10 text-[#FF8A00]/40" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-[18px] font-bold text-[#0F172A] tracking-tight mb-2">Select a Conversation</h3>
            <p className="text-[13px] text-slate-400 max-w-[280px] leading-relaxed">
              Choose a conversation from the left to start messaging. Your messages are private and encrypted.
            </p>
          </div>
        )}
      </div>

      {profileModal.isOpen && profileModal.candidate && (
        <CandidateProfileModal
          isOpen={profileModal.isOpen}
          onClose={() => setProfileModal({ ...profileModal, isOpen: false })}
          candidate={profileModal.candidate as any}
          resumeData={(profileModal.candidate as any).resume_data}
          jobTitle="Discovery Connection"
          appliedDate={new Date().toISOString()}
          score={0}
        />
      )}

      <ReportMessageModal
        isOpen={reportModal.isOpen}
        onClose={() => setReportModal({ ...reportModal, isOpen: false })}
        messageId={reportModal.messageId}
        senderName={reportModal.senderName}
        onReportSuccess={() => toast.success("Thank you for reporting. Our team will review this.")}
      />
    </div>
  );
}
