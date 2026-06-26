"use client";

import { useState, useEffect, useRef } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";
import CandidateProfileModal from "./CandidateProfileModal";
import {
  Archive,
  MessageCircle,
  Trash2,
  User,
  Paperclip,
  ClipboardList,
  RotateCcw,
  Flag,
  Send,
  Search,
  MoreVertical,
  Briefcase,
  Check,
  ArrowLeft,
} from "lucide-react";
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

interface MessagesPanelProps {
  userId: string;
  role: "candidate" | "recruiter";
}

export default function MessagesPanel({ userId, role }: MessagesPanelProps) {
  const router = useRouter();

  const getDynamicStatus = (threadId: string): { isOnline: boolean; text: string } => {
    if (!threadId) return { isOnline: false, text: "Offline" };
    let hash = 0;
    for (let i = 0; i < threadId.length; i++) {
      hash = threadId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const val = Math.abs(hash) % 100;
    if (val < 35) {
      return { isOnline: true, text: "Online" };
    } else if (val < 60) {
      const mins = (val % 45) + 5;
      return { isOnline: false, text: `Seen ${mins}m ago` };
    } else if (val < 85) {
      const hours = (val % 10) + 1;
      return { isOnline: false, text: `Seen ${hours}h ago` };
    } else {
      return { isOnline: false, text: "Offline" };
    }
  };

  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [inviteStatus, setInviteStatus] = useState<Record<string, string>>({});
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

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  useEffect(() => {
    fetchThreads();
  }, [userId, role, showArchived]);

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

  useEffect(() => {
    const fetchInviteStatuses = async () => {
      const appIds = messages
        .filter(m => m.text.startsWith("[Job Invite:JSON]"))
        .map(m => {
          try {
            const payload = JSON.parse(m.text.replace("[Job Invite:JSON]", ""));
            return payload.application_id;
          } catch {
            return null;
          }
        })
        .filter((id): id is string => !!id);

      const token = awsAuth.getToken();
      if (!token || appIds.length === 0) return;

      for (const appId of appIds) {
        if (inviteStatus[appId] !== undefined) continue;

        try {
          const endpoint = role === "candidate"
            ? `/candidate/applications/${appId}`
            : `/recruiter/applications/${appId}`;
          const appDetail = await apiClient.get(endpoint, token);
          if (appDetail && appDetail.status) {
            setInviteStatus(prev => ({ ...prev, [appId]: appDetail.status }));
          }
        } catch (err) {
          console.error(`Failed to fetch application status:`, err);
          setInviteStatus(prev => ({ ...prev, [appId]: "invited" }));
        }
      }
    };
    fetchInviteStatuses();
  }, [messages, role, inviteStatus]);

  const handleRespondInvite = async (applicationId: string | null, response: "accept" | "decline") => {
    if (!applicationId) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      const result = await apiClient.post(`/candidate/applications/${applicationId}/respond`, {
        response,
        message: response === "decline" ? "Declined by candidate via chat." : undefined
      }, token);
      
      if (result && result.new_status) {
        setInviteStatus(prev => ({ ...prev, [applicationId]: result.new_status }));
        toast.success(response === "accept" ? "Interest accepted!" : "Invitation declined.");
        const data = await apiClient.get(`/chat/messages/${activeThreadId}`, token);
        if (data) setMessages(data as Message[]);
      }
    } catch (err) {
      console.error("Failed to respond to invite:", err);
      toast.error("Failed to respond.");
    }
  };

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
        setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, last_message_at: new Date().toISOString() } : t));
      }
    } catch (err) {
      console.error("Send message error:", err);
      toast.error("Failed to send.");
    }
  };

  const handleCloseChat = async () => {
    if (!activeThreadId) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(`/chat/archive/${activeThreadId}`, {}, token);
      toast.success("Conversation archived.");
      setActiveThreadId(null);
      fetchThreads();
    } catch (err) {
      console.error("Close chat error:", err);
    }
  };

  const handleDeleteChat = async () => {
    if (!activeThreadId) return;
    if (!confirm("This will permanently delete this conversation. Proceed?")) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(`/chat/delete/${activeThreadId}`, {}, token);
      toast.success("Conversation deleted.");
      setActiveThreadId(null);
      fetchThreads();
    } catch (err) {
      console.error("Delete chat error:", err);
    }
  };

  const handleViewProfile = async () => {
    const active = threads.find(t => t.id === activeThreadId);
    if (!active) return;
    if (role === "candidate") {
      router.push("/dashboard/candidate/profile");
      return;
    }
    if (active.candidate_id) {
      try {
        const token = awsAuth.getToken();
        if (!token) return;
        const fullCandidate = await apiClient.get(`/recruiter/candidate/${active.candidate_id}`, token);
        setProfileModal({ isOpen: true, candidate: fullCandidate });
      } catch (err) {
        console.error("Fetch profile error:", err);
      }
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setShowActions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredThreads = threads.filter(t => {
    if (!searchQuery) return true;
    const name = (role === "recruiter" ? t.candidate_profiles?.full_name : t.recruiter_profiles?.full_name) || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const activeThread = threads.find(t => t.id === activeThreadId);
  const activeName = role === "recruiter"
    ? activeThread?.candidate_profiles?.full_name || "Candidate"
    : activeThread?.recruiter_profiles?.full_name || "Recruiter";

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 py-20">
        <div className="h-8 w-8 rounded-full border-2 border-[#FF8A00]/30 border-t-[#FF8A00] animate-spin" />
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Loading Chats…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/30">
      {!activeThreadId ? (
        // ── Thread List View ──
        <div className="flex flex-col h-full overflow-hidden">
          {/* Tabs header */}
          <div className="px-4 pt-3.5 pb-2 flex-shrink-0 bg-white border-b border-slate-100">
            <div className="flex items-center gap-2 mb-3 bg-slate-100/60 p-0.5 rounded-lg">
              <button
                onClick={() => {
                  setShowArchived(false);
                }}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${!showArchived ? "bg-white shadow-xs text-slate-800 border border-slate-200/20" : "text-slate-500 hover:text-slate-800"}`}
              >
                Active
              </button>
              <button
                onClick={() => {
                  setShowArchived(true);
                }}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${showArchived ? "bg-white shadow-xs text-slate-800 border border-slate-200/20" : "text-slate-500 hover:text-slate-800"}`}
              >
                Archived
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search candidates/recruiters..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/25 focus:border-[#FF8A00] transition-all"
              />
            </div>
          </div>

          {/* Threads scrolling container */}
          <div className="flex-1 overflow-y-auto dashboard-scroll p-2 space-y-1">
            {filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center mb-3">
                  <MessageCircle className="h-5 w-5 text-slate-350" />
                </div>
                <p className="text-[13px] font-bold text-slate-700">No chats found</p>
                <p className="text-[11px] text-slate-450 mt-1 max-w-[200px]">
                  {showArchived ? "No archived discussions" : "No active chats available"}
                </p>
              </div>
            ) : (
              filteredThreads.map(thread => {
                const name = role === "recruiter" ? thread.candidate_profiles?.full_name || "Candidate" : thread.recruiter_profiles?.full_name || "Recruiter";
                const photo = role === "recruiter" ? thread.candidate_profiles?.profile_photo_url : null;
                const status = getDynamicStatus(thread.id);
                return (
                  <button
                    key={thread.id}
                    onClick={() => setActiveThreadId(thread.id)}
                    className="w-full p-3 flex items-center gap-3 bg-white border border-slate-200/40 rounded-xl hover:border-slate-300/60 hover:bg-slate-50/50 hover:shadow-xs transition-all text-left"
                  >
                    <div className="h-9.5 w-9.5 rounded-full overflow-hidden shrink-0 ring-1 ring-slate-100 relative bg-gradient-to-br from-orange-50 to-orange-100/50 flex items-center justify-center">
                      {photo ? (
                        <img src={photo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[#FF8A00] font-black text-[12.5px] uppercase">{name[0]}</span>
                      )}
                      {status.isOnline && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[12.5px] font-bold text-slate-800 truncate pr-2">{name}</p>
                        <p className="text-[9.5px] text-slate-400 shrink-0 font-medium">
                          {thread.last_message_at ? format(new Date(thread.last_message_at), "MMM d") : ""}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-450 truncate mt-0.5 font-medium">
                        {thread.last_message_at ? "Click to view conversation" : "New conversation started"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        // ── Chat Detail View ──
        <div className="flex flex-col h-full overflow-hidden bg-white">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => {
                  setActiveThreadId(null);
                  setMessages([]);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h3 className="text-[13px] font-bold text-slate-800 truncate leading-snug">{activeName}</h3>
                <div className="flex items-center gap-1">
                  {(() => {
                    const status = getDynamicStatus(activeThreadId);
                    return (
                      <>
                        <span className={`h-1.5 w-1.5 rounded-full ${status.isOnline ? "bg-emerald-500" : "bg-slate-350"}`} />
                        <span className={`text-[10px] font-semibold ${status.isOnline ? "text-emerald-500" : "text-slate-400"}`}>
                          {status.text}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0" ref={actionsRef}>
              <button
                onClick={handleViewProfile}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                title={role === "recruiter" ? "View Candidate Profile" : "View My Profile"}
              >
                <User className="h-4 w-4" />
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {showActions && (
                  <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 shadow-lg rounded-xl overflow-hidden z-50">
                    {showArchived ? (
                      <button
                        onClick={async () => {
                          const token = awsAuth.getToken();
                          if (!token) return;
                          await apiClient.post(`/chat/restore/${activeThreadId}`, {}, token);
                          toast.success("Restored conversation.");
                          setActiveThreadId(null);
                          fetchThreads();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 text-left"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                        Restore Chat
                      </button>
                    ) : (
                      <button
                        onClick={handleCloseChat}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 text-left"
                      >
                        <Archive className="h-3.5 w-3.5 text-slate-400" />
                        Archive Chat
                      </button>
                    )}
                    <div className="border-t border-slate-100" />
                    <button
                      onClick={handleDeleteChat}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-red-500 hover:bg-red-50 text-left"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/45 dashboard-scroll">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">No messages yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Send a message to start the conversation.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMine = msg.sender_id === userId;
                let isInviteCard = false;
                let inviteData: { job_id: string | null; job_title: string; company_name: string; message: string; application_id: string | null } | null = null;
                if (msg.text.startsWith("[Job Invite:JSON]")) {
                  try {
                    inviteData = JSON.parse(msg.text.replace("[Job Invite:JSON]", ""));
                    isInviteCard = true;
                  } catch (e) {
                    console.error("Invite JSON parse error:", e);
                  }
                }

                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} group`}>
                    <div className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[85%]`}>
                      {isInviteCard && inviteData ? (
                        <div className={`rounded-2xl p-3.5 space-y-3 text-[11.5px] text-slate-800 border ${isMine ? "bg-white border-orange-100 shadow-sm rounded-tr-xs" : "bg-[#FFFDF9] border-orange-150 shadow-sm rounded-tl-xs"} max-w-[270px]`}>
                          <div className="flex items-start gap-2.5 border-b border-orange-50 pb-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-[#FF8A00] shrink-0 border border-orange-100">
                              <Briefcase className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[9px] font-black uppercase tracking-wider text-[#FF8A00]">Job Invite</span>
                              <h4 className="font-bold text-slate-800 truncate text-[12px] mt-0.5">{inviteData.job_title}</h4>
                              <span className="text-[9.5px] font-semibold text-slate-400 truncate uppercase mt-0.5">{inviteData.company_name}</span>
                            </div>
                          </div>
                          <p className="text-slate-600 leading-relaxed font-semibold bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                            {inviteData.message}
                          </p>
                          {(() => {
                            const appId = inviteData?.application_id || "";
                            const appStatus = inviteStatus[appId] || "invited";
                            if (role === "candidate") {
                              if (appStatus === "invited") {
                                return (
                                  <div className="flex gap-1.5 pt-1">
                                    <button
                                      onClick={() => handleRespondInvite(appId, "decline")}
                                      className="flex-1 py-1.5 rounded-lg border border-slate-200 bg-white text-[9.5px] font-black uppercase text-slate-400 hover:bg-slate-50 transition-all"
                                    >
                                      Decline
                                    </button>
                                    <button
                                      onClick={() => handleRespondInvite(appId, "accept")}
                                      className="flex-[2] py-1.5 rounded-lg bg-[#FF8A00] text-white text-[9.5px] font-black uppercase tracking-wider hover:bg-[#e67a00] transition-all text-center flex items-center justify-center gap-0.5"
                                    >
                                      Accept
                                    </button>
                                  </div>
                                );
                              } else if (appStatus === "applied") {
                                return (
                                  <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg py-1.5 font-bold text-[9px] uppercase justify-center w-full">
                                    <Check className="w-3 h-3" /> Interest Accepted
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex items-center gap-1 text-slate-400 bg-slate-50 border border-slate-200 rounded-lg py-1.5 font-bold text-[9px] uppercase justify-center w-full">
                                    Invitation Declined
                                  </div>
                                );
                              }
                            } else {
                              if (appStatus === "invited") {
                                return (
                                  <div className="text-center py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 border border-slate-100 rounded-lg bg-slate-50">
                                    Pending Response
                                  </div>
                                );
                              } else if (appStatus === "applied") {
                                return (
                                  <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg py-1.5 font-bold text-[9px] uppercase justify-center w-full">
                                    <Check className="w-3 h-3" /> Accepted & Applied
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex items-center gap-1 text-slate-400 bg-slate-50 border border-slate-200/80 rounded-lg py-1.5 font-bold text-[9px] uppercase justify-center w-full">
                                    Declined
                                  </div>
                                );
                              }
                            }
                          })()}
                        </div>
                      ) : (
                        <div className={`rounded-xl px-3.5 py-2.5 relative ${isMine ? "bg-[#FF8A00] text-white rounded-tr-none shadow-xs" : "bg-white text-slate-800 border border-slate-200/60 rounded-tl-none shadow-xs"}`}>
                          <p className="text-[12.5px] leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>
                          {!isMine && (
                            <button
                              onClick={() => setReportModal({ isOpen: true, messageId: msg.id, senderName: activeName })}
                              className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                            >
                              <Flag className="w-3 h-3 text-red-400" />
                            </button>
                          )}
                        </div>
                      )}
                      <span className="text-[9px] text-slate-400 px-1 mt-1 font-semibold uppercase">
                        {format(new Date(msg.created_at), "h:mm a")}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat input footer */}
          <div className="p-3 bg-white border-t border-slate-100 flex-shrink-0">
            <form onSubmit={sendMessage} className="flex items-center gap-1.5 mb-2">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-[12.5px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/25 focus:border-[#FF8A00] transition-all"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 rounded-xl bg-[#FF8A00] hover:bg-[#e67a00] text-white disabled:opacity-30 transition-all shadow-xs"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="flex gap-1 overflow-x-auto no-scrollbar scroll-smooth">
              {(role === "recruiter" ? RECRUITER_TEMPLATES : CANDIDATE_TEMPLATES).map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => applyTemplate(tmpl.text)}
                  className="whitespace-nowrap px-2.5 py-1 bg-orange-50 border border-orange-100 rounded-lg text-[9.5px] font-bold text-[#FF8A00] hover:bg-[#FF8A00] hover:text-white transition-all shrink-0 flex items-center gap-1"
                >
                  <ClipboardList className="w-3 h-3 opacity-60" />
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {profileModal.isOpen && profileModal.candidate && (
        <CandidateProfileModal
          isOpen={profileModal.isOpen}
          onClose={() => setProfileModal({ ...profileModal, isOpen: false })}
          candidate={profileModal.candidate}
          resumeData={profileModal.candidate.resume_data}
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
