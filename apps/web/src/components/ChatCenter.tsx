"use client";

import { useState, useEffect, useRef } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import CandidateProfileModal from "./CandidateProfileModal";
import { Archive, MessageCircle, MoreVertical, Trash2, User, Paperclip, ClipboardList, RotateCcw, Flag } from "lucide-react";
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
  const [profileModal, setProfileModal] = useState<{
    isOpen: boolean;
    candidate: any;
  }>({ isOpen: false, candidate: null });
  const [reportModal, setReportModal] = useState<{
    isOpen: boolean;
    messageId: string;
    senderName: string;
  }>({ isOpen: false, messageId: "", senderName: "" });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const applyTemplate = (text: string) => {
    setNewMessage(text);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast.info(`Uploading ${file.name}...`);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      
      const formData = new FormData();
      formData.append("file", file);
      
      // Assume a storage upload endpoint exists
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

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleDeleteChat = async () => {
    if (!activeThreadId) return;
    if (!confirm("CRITICAL: This will permanently delete this conversation and all its messages. This action cannot be undone. Proceed?")) return;
    
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(`/chat/delete/${activeThreadId}`, {}, token);
      
      setThreads(prev => prev.filter(t => t.id !== activeThreadId));
      setActiveThreadId(null);
      toast.success("Intelligence Wipe Complete: Conversation Deleted.");
    } catch (err) {
      console.error("Delete chat error:", err);
      toast.error("Wipe failed.");
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

    if (role === "candidate") {
      router.push("/dashboard/candidate/profile");
      return;
    }

    // Role is Recruiter - Open Modal
    if (active.candidate_id) {
      // Track profile view
      try {
        const token = awsAuth.getToken();
        if (token) {
          console.log("[TRACKING] Starting profile view tracking for:", active.candidate_id);
          await apiClient.post(
            `/analytics/profile/${active.candidate_id}/view`,
            {},
            token,
          );
          console.log("[TRACKING] ✓ Profile view tracked:", active.candidate_id);
        }
      } catch (err) {
        console.error("[TRACKING] Failed to track profile view:", err);
      }

      // Fetch and display profile
      try {
        const token = awsAuth.getToken();
        if (!token) return;

        const fullCandidate = await apiClient.get(
          `/recruiter/candidate/${active.candidate_id}`,
          token,
        );

        setProfileModal({
          isOpen: true,
          candidate: fullCandidate,
        });
      } catch (err) {
        console.error("Fetch profile error:", err);
        toast.error("Could not load candidate profile.");
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch Threads
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

  const filteredThreads = threads;

  // Fetch Messages when active thread changes
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
    
    // Polling as a fallback for Realtime until WebSocket is ready
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [activeThreadId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThreadId) return;

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const result = await apiClient.post("/chat/send", {
        thread_id: activeThreadId,
        content: newMessage.trim(),
      }, token);

      if (result) {
        setNewMessage("");
        // Refresh messages
        const data = await apiClient.get(`/chat/messages/${activeThreadId}`, token);
        if (data) setMessages(data as Message[]);
        
        // Update local thread last_message_at
        setThreads((prev) =>
          prev.map((t) =>
            t.id === activeThreadId
              ? { ...t, last_message_at: new Date().toISOString() }
              : t,
          ),
        );
      }
    } catch (err) {
      console.error("Send message error:", err);
      toast.error("Failed to send message.");
    }
  };

  if (loading)
    return (
      <div className="p-12 flex flex-col items-center justify-center h-96">
        <div className="h-12 w-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
          Loading Messages
        </p>
      </div>
    );

  return (
    <div className="flex bg-white rounded-4xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50 min-h-150 h-[calc(100vh-280px)]">
      {/* Threads Sidebar */}
      <div className="w-80 border-r border-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Messages
            </h2>
          </div>
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => { setShowArchived(false); setActiveThreadId(null); }}
              className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!showArchived ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Active
            </button>
            <button
              onClick={() => { setShowArchived(true); setActiveThreadId(null); }}
              className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${showArchived ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Archived
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredThreads.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                {showArchived ? <Archive className="h-6 w-6 text-slate-300" /> : <MessageCircle className="h-6 w-6 text-slate-300" />}
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                No {showArchived ? 'archived' : 'active'} messages
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={`w-full p-6 flex items-center gap-4 transition-all relative group border-b border-slate-50 ${
                  activeThreadId === thread.id
                    ? "bg-primary-light/50"
                    : "hover:bg-slate-50/80"
                }`}
              >
                {activeThreadId === thread.id && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-r-full shadow-[2px_0_10px_rgba(79,70,229,0.2)]" />
                )}

                <div className="h-12 w-12 rounded-full overflow-hidden shrink-0 border-2 border-slate-100 shadow-sm transition-transform group-hover:scale-105">
                  {role === "recruiter" &&
                  thread.candidate_profiles?.profile_photo_url ? (
                    <img
                      src={thread.candidate_profiles.profile_photo_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-primary-light text-primary font-black text-xs">
                      {(role === "recruiter"
                        ? thread.candidate_profiles?.full_name
                        : thread.recruiter_profiles?.full_name)?.[0] || "?"}
                    </div>
                  )}
                </div>

                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-start">
                    <p
                      className={`font-black text-sm tracking-tight truncate ${activeThreadId === thread.id ? "text-primary" : "text-slate-900"}`}
                    >
                      {role === "recruiter"
                        ? thread.candidate_profiles?.full_name ||
                          "New Candidate"
                        : thread.recruiter_profiles?.full_name ||
                          "Elite Recruiter"}
                    </p>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    {thread.last_message_at
                      ? format(
                          new Date(thread.last_message_at),
                          "MMM d, h:mm a",
                        )
                      : "New Message"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="flex-1 flex flex-col bg-slate-50/20 min-w-0">
        {activeThreadId ? (
          <>
            <div className="px-6 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-md flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-base uppercase tracking-wider truncate">
                    {role === "recruiter"
                      ? threads.find((t) => t.id === activeThreadId)
                          ?.candidate_profiles?.full_name || "Candidate"
                      : "Recruitment Lead"}
                  </h3>
                  <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] mt-0.5">
                    Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <button 
                  onClick={handleViewProfile}
                  className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-primary hover:bg-primary-light transition-all border border-slate-100"
                  title={role === "recruiter" ? "View Profile" : "My Profile"}
                >
                  <User className="w-4 h-4" />
                </button>
                
                <div className="h-6 w-px bg-slate-100 mx-1" />
                
                {showArchived ? (
                   <button 
                    onClick={async () => {
                      if (!activeThreadId) return;
                      const token = awsAuth.getToken();
                      if (!token) return;
                      await apiClient.post(`/chat/restore/${activeThreadId}`, {}, token);
                      setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, is_active: true } : t));
                      setActiveThreadId(null);
                      toast.success("Intelligence Link Restored.");
                    }}
                    className="p-2.5 bg-primary-light text-primary rounded-xl hover:bg-primary hover:text-white transition-all border border-primary-light"
                    title="Restore Chat"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    onClick={handleCloseChat}
                    className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-amber-600 hover:bg-amber-50 transition-all border border-slate-100"
                    title="Archive Chat"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                )}
                
                <button 
                  onClick={handleDeleteChat}
                  className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:text-red-600 hover:bg-red-50 transition-all border border-slate-100"
                  title="Permanent Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-10 space-y-8 custom-scrollbar">
              {messages.map((msg) => {
                const otherPartyName = role === "recruiter" 
                  ? threads.find(t => t.id === activeThreadId)?.candidate_profiles?.full_name || "Candidate"
                  : "Recruiter";
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === userId ? "justify-end" : "justify-start"} group`}
                  >
                    <div
                      className={`flex flex-col ${msg.sender_id === userId ? "items-end" : "items-start"} max-w-[85%]`}
                    >
                      <div
                        className={`rounded-3xl px-6 py-4 shadow-sm transition-all hover:shadow-md relative ${
                          msg.sender_id === userId
                            ? "bg-slate-900 text-white rounded-tr-none shadow-slate-900/10"
                            : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                        }`}
                      >
                        <p className="text-[13px] leading-relaxed font-medium">
                          {msg.text}
                        </p>
                        
                        {/* Report button - only show for other person's messages */}
                        {msg.sender_id !== userId && (
                          <button
                            onClick={() => setReportModal({
                              isOpen: true,
                              messageId: msg.id,
                              senderName: otherPartyName
                            })}
                            className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg"
                            title="Report this message"
                          >
                            <Flag className="w-4 h-4 text-red-500 hover:text-red-600" />
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter mt-2 px-1">
                        {format(new Date(msg.created_at), "h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
              <form onSubmit={sendMessage} className="relative group mb-4">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 pr-28 text-sm text-slate-900 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/50 transition-all placeholder:text-slate-400 font-medium"
                />
                <div className="absolute right-2 top-2 bottom-2">
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="h-full bg-slate-900 text-white px-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black active:scale-95 disabled:opacity-20 disabled:grayscale transition-all shadow-xl shadow-slate-900/20"
                  >
                    Send
                  </button>
                </div>
              </form>
              
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <p className="hidden sm:block text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] leading-none">
                    Security: E2EE
                  </p>
                  <div className="hidden sm:block h-4 w-px bg-slate-100" />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-primary transition-all"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    Attach
                  </button>
                </div>

                <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar pb-1 mask-fade-right">
                  {(role === "recruiter" ? RECRUITER_TEMPLATES : CANDIDATE_TEMPLATES).map((tmpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyTemplate(tmpl.text)}
                      className="whitespace-nowrap px-3 py-1.5 bg-primary-light/30 border border-primary-light/50 rounded-xl text-[8px] font-black text-primary uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center gap-1.5 shrink-0 shadow-xs"
                    >
                      <ClipboardList className="w-3 h-3 opacity-50" />
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center animate-in fade-in zoom-in duration-700">
            <div className="relative mb-10 group cursor-default">
              <div className="absolute inset-0 bg-primary/10 blur-[80px] rounded-full scale-150 group-hover:bg-primary/20 transition-all duration-700" />
              <div className="relative h-32 w-32 rounded-[3.5rem] bg-white border border-slate-100 flex items-center justify-center shadow-xl transition-all duration-700 hover:rotate-12">
                <svg
                  className="h-14 w-14 text-primary/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-4xl font-black text-slate-900 tracking-[-0.04em] mb-4 uppercase">
              Messaging Center
            </h3>
            <p className="text-slate-400 max-w-sm text-[10px] font-bold uppercase tracking-[0.25em] leading-relaxed opacity-70">
              Select a conversation to start chatting. Your messages are private
              and secure.
            </p>
            <div className="mt-12 h-1.5 w-12 bg-primary-light rounded-full" />
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
        onReportSuccess={() => {
          toast.success("Thank you for reporting. Our team will review this.");
        }}
      />
    </div>
  );
}

