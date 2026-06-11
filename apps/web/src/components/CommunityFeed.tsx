"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";
import {
  Trash2,
  Edit3,
  X,
  Video,
  Pin,
  Heart,
  MessageSquare,
  Radio,
  Camera,
} from "lucide-react";

interface Author {
  id: string;
  full_name: string;
  role: "candidate" | "recruiter";
  profile_photo_url?: string;
}

interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  author: Author;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  media_urls: string[];
  type: string;
  created_at: string;
  author: Author;
  is_following: boolean;
  is_pinned: boolean;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  comments: Comment[];
}

export default function CommunityFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pinnedPostIds, setPinnedPostIds] = useState<Set<string>>(new Set());
  const [expandingComments, setExpandingComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // Layout and view states
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"feed" | "create" | "myposts" | "pinned">("feed");
  const [showPinnedDrawer, setShowPinnedDrawer] = useState(false);

  const toggleExpandPost = (postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleLike = async (post: Post) => {
    const token = awsAuth.getToken();
    if (!token) return;

    const isLiked = post.is_liked;
    setPosts(prev => prev.map(p => {
      if (p.id === post.id) {
        return {
          ...p,
          is_liked: !isLiked,
          likes_count: isLiked ? p.likes_count - 1 : p.likes_count + 1
        };
      }
      return p;
    }));

    try {
      if (isLiked) {
        await apiClient.delete(`/posts/${post.id}/unlike`, token);
      } else {
        await apiClient.post(`/posts/${post.id}/like`, {}, token);
      }
    } catch (err) {
      console.error("Failed to sync like:", err);
      setPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          return {
            ...p,
            is_liked: isLiked,
            likes_count: isLiked ? p.likes_count + 1 : p.likes_count - 1
          };
        }
        return p;
      }));
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = commentInputs[postId];
    if (!content?.trim()) return;

    const token = awsAuth.getToken();
    if (!token) return;

    try {
      const newComment = await apiClient.post(`/posts/${postId}/comments`, { content }, token) as Comment;
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments_count: (p.comments_count || 0) + 1,
            comments: [...(p.comments || []), newComment]
          };
        }
        return p;
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: "" }));
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const token = awsAuth.getToken();
    if (!token) return;

    try {
      await apiClient.delete(`/posts/${postId}/comments/${commentId}`, token);
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            comments_count: Math.max(0, (p.comments_count || 0) - 1),
            comments: (p.comments || []).filter(c => c.id !== commentId)
          };
        }
        return p;
      }));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const toggleComments = (postId: string) => {
    setExpandingComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleFollow = async (userId: string, isCurrentlyFollowing: boolean) => {
    const token = awsAuth.getToken();
    if (!token) return;

    setPosts((prev) =>
      prev.map((p) => {
        if (p.author.id === userId) {
          return { ...p, is_following: !isCurrentlyFollowing };
        }
        return p;
      })
    );

    try {
      if (isCurrentlyFollowing) {
        await apiClient.delete(`/posts/unfollow/${userId}`, token);
        toast.success("Unfollowed user successfully.");
      } else {
        await apiClient.post("/posts/follow", { following_id: userId }, token);
        toast.success("Following user now!");
      }
    } catch (err) {
      console.error("Failed to sync connection:", err);
      toast.error("Failed to update connection.");
      setPosts((prev) =>
        prev.map((p) => {
          if (p.author.id === userId) {
            return { ...p, is_following: isCurrentlyFollowing };
          }
          return p;
        })
      );
    }
  };

  const handlePinPost = async (postId: string) => {
    const token = awsAuth.getToken();
    if (!token) return;

    const isCurrentlyPinned = pinnedPostIds.has(postId);
    setPinnedPostIds((prev) => {
      const newPins = new Set(prev);
      if (isCurrentlyPinned) newPins.delete(postId);
      else newPins.add(postId);
      return newPins;
    });

    try {
      if (isCurrentlyPinned) {
        await apiClient.delete(`/posts/${postId}/unpin`, token);
        toast.success("Post unpinned.");
      } else {
        await apiClient.post(`/posts/${postId}/pin`, {}, token);
        toast.success("Post pinned successfully!");
      }
    } catch (err) {
      console.error("Failed to synchronize cloud pin:", err);
      toast.error("Failed to update pinned state.");
      setPinnedPostIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyPinned) next.add(postId);
        else next.delete(postId);
        return next;
      });
    }
  };

  const handleShare = (postId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/posts/${postId}`);
    toast.success("Post link copied to clipboard!");
  };

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const token = awsAuth.getToken();
      if (!token) return;

      const user = awsAuth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }

      const data = await apiClient.get("/posts/feed", token);
      setPosts(Array.isArray(data) ? data : []);

      const pinned = new Set<string>();
      (Array.isArray(data) ? data : []).forEach((post: Post) => {
        if (post.is_pinned) pinned.add(post.id);
      });
      setPinnedPostIds(pinned);
    } catch (err) {
      console.error("Error fetching feed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setIsSubmitting(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const uploadedUrls: string[] = [];
      for (const file of mediaFiles) {
        const formData = new FormData();
        formData.append("file", file);
        try {
          const result = await apiClient.post("/posts/upload", formData, token) as { path?: string; url?: string };
          if (result.path) {
            uploadedUrls.push(result.path);
          } else if (result.url) {
            uploadedUrls.push(result.url);
          }
        } catch (uploadError) {
          console.error(`Upload error for ${file.name}:`, uploadError);
          toast.error(`Failed to upload ${file.name}.`);
          continue;
        }
      }

      await apiClient.post(
        "/posts",
        {
          content: newPost,
          media_urls: uploadedUrls,
        },
        token,
      );

      setNewPost("");
      setMediaFiles([]);
      setMediaPreviews([]);
      toast.success("Post published successfully!");
      fetchFeed();
    } catch (err) {
      console.error("Error creating post:", err);
      toast.error("Failed to publish post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setPinnedPostIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });

      await apiClient.delete(`/posts/${postId}`, token);
      toast.success("Post deleted.");
    } catch (err) {
      console.error("Error deleting post:", err);
      toast.error("Failed to delete post.");
      fetchFeed();
    }
  };

  const handleSaveEdit = async (postId: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.patch(
        `/posts/${postId}`,
        {
          content: editContent,
          media_urls: posts.find((p) => p.id === postId)?.media_urls || [],
        },
        token,
      );
      setEditingPost(null);
      toast.success("Post updated!");
      fetchFeed();
    } catch (err) {
      console.error("Error updating post:", err);
      toast.error("Failed to update post.");
    }
  };

  const startEditing = (post: Post) => {
    setEditingPost(post.id);
    setEditContent(post.content);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setMediaFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const formatPostDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "MMM d");
    } catch (e) {
      return "Just now";
    }
  };

  const renderPostContent = (post: Post) => {
    const isEditing = editingPost === post.id;
    if (isEditing) {
      return (
        <div className="mb-4 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg p-3 text-[14px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/30 focus:border-[#FF8A00] min-h-[100px] resize-none"
            placeholder="Edit your post..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingPost(null)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-slate-500 hover:bg-slate-200 transition-colors uppercase cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSaveEdit(post.id)}
              className="px-4 py-1.5 rounded-lg text-[12px] font-bold bg-[#FF8A00] text-white hover:bg-[#E67A00] transition-colors uppercase shadow-xs cursor-pointer"
            >
              Save
            </button>
          </div>
        </div>
      );
    }

    const content = post.content || "";
    const isLong = content.length > 280;
    const isExpanded = expandedPosts.has(post.id);
    const displayContent = isLong && !isExpanded ? `${content.substring(0, 280)}...` : content;

    return (
      <div className="mb-4">
        <p className="text-[15px] text-slate-700 leading-relaxed font-medium whitespace-pre-wrap break-words">
          {displayContent}
        </p>
        {isLong && (
          <button
            onClick={() => toggleExpandPost(post.id)}
            className="mt-1 text-[12px] font-bold text-[#FF8A00] hover:text-[#E67A00] transition-colors cursor-pointer"
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-gradient-to-br from-[#F8F9FC] via-white to-[#F0F4F8]">
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 4px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #cbd5e1;
        }
      `}</style>

      {/* Mobile/Tablet Navigation Tabs (visible only on <lg screens) */}
      <div className="lg:hidden flex border-b border-slate-200/60 bg-white/95 backdrop-blur-md px-4 py-2.5 gap-2 flex-shrink-0 sticky top-0 z-20 shadow-xs">
        <button
          onClick={() => setActiveTab("feed")}
          className={`flex-1 text-center py-2 px-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "feed"
              ? "bg-[#FF8A00] text-white shadow-[0_2px_10px_rgba(255,138,0,0.25)]"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          Feed
        </button>
        <button
          onClick={() => setActiveTab("create")}
          className={`flex-1 text-center py-2 px-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "create"
              ? "bg-[#FF8A00] text-white shadow-[0_2px_10px_rgba(255,138,0,0.25)]"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          Create
        </button>
        <button
          onClick={() => setActiveTab("myposts")}
          className={`flex-1 text-center py-2 px-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "myposts"
              ? "bg-[#FF8A00] text-white shadow-[0_2px_10px_rgba(255,138,0,0.25)]"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          My Posts
        </button>
        <button
          onClick={() => setActiveTab("pinned")}
          className={`flex-1 text-center py-2 px-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
            activeTab === "pinned"
              ? "bg-[#FF8A00] text-white shadow-[0_2px_10px_rgba(255,138,0,0.25)]"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          Pinned
        </button>
      </div>

      {/* Pinned Posts Slide-over Drawer for <xl screens */}
      {showPinnedDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end xl:hidden">
          {/* Backdrop */}
          <div 
            onClick={() => setShowPinnedDrawer(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-305" 
          />
          {/* Drawer content */}
          <div className="relative w-[340px] max-w-full h-full bg-white border-l border-slate-200 shadow-2xl p-6 flex flex-col gap-4 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00]" />
                <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-[0.14em]">Pinned Posts</h3>
                <span className="text-[11px] font-bold text-[#FF8A00] bg-[#FFF6ED] px-2.5 py-0.5 rounded-full border border-orange-100/80">
                  {posts.filter((p) => pinnedPostIds.has(p.id)).length}
                </span>
              </div>
              <button 
                onClick={() => setShowPinnedDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-3 min-h-0">
              {posts.filter((p) => pinnedPostIds.has(p.id)).length === 0 ? (
                <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[200px] p-6">
                  <div className="p-3 bg-white rounded-full mb-3 shadow-xs">
                    <Pin size={20} className="text-slate-400" />
                  </div>
                  <p className="text-[13px] font-bold text-slate-700">No pinned posts</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                    Pin posts from the community feed to view them here.
                  </p>
                </div>
              ) : (
                posts
                  .filter((p) => pinnedPostIds.has(p.id))
                  .map((post) => (
                    <div
                      key={`pinned-drawer-${post.id}`}
                      className="bg-gradient-to-br from-white to-slate-50/30 rounded-xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden group/item"
                    >
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-[#FF8A00]/5 to-transparent rounded-full -mr-6 -mt-6 group-hover/item:scale-150 transition-transform duration-700" />
                      
                      <div className="flex items-start gap-2 mb-2 relative z-10">
                        <div className="h-8 w-8 rounded-full overflow-hidden relative border border-slate-100 shrink-0 flex items-center justify-center">
                          {post.author?.profile_photo_url ? (
                            <Image 
                              src={post.author.profile_photo_url} 
                              alt="" 
                              fill 
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className={`h-full w-full flex items-center justify-center font-bold text-white text-[10px] bg-gradient-to-br ${
                              post.author?.role === "recruiter" ? "from-[#FF8A00] to-[#FF6B00]" : "from-teal-400 to-emerald-600"
                            }`}>
                              {post.author?.full_name?.[0]?.toUpperCase() || "?"}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-slate-900 truncate">
                            {post.author?.full_name || "Anonymous"}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {formatPostDate(post.created_at)}
                          </p>
                        </div>
                        <button 
                          onClick={() => handlePinPost(post.id)}
                          className="text-[#FF8A00] hover:text-orange-600 transition-colors shrink-0 p-1 rounded hover:bg-orange-50"
                        >
                          <Pin size={11} className="fill-current" />
                        </button>
                      </div>

                      <p className="text-[13px] text-slate-600 leading-relaxed font-medium line-clamp-3 mb-2 relative z-10 whitespace-pre-wrap break-words">
                        {post.content}
                      </p>

                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="rounded-lg overflow-hidden h-20 relative border border-slate-100 shadow-xs relative z-10">
                          <Image
                            src={post.media_urls[0]}
                            alt=""
                            fill
                            className="object-cover group-hover/item:scale-105 transition-transform duration-500"
                            unoptimized
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 mt-2 text-[11px] text-slate-400 relative z-10">
                        <span className="flex items-center gap-1">
                          <Heart size={11} className={post.is_liked ? "fill-rose-600 text-rose-600" : ""} />
                          {post.likes_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} />
                          {post.comments_count}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Responsive Grid Layout */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row gap-6 px-4 lg:px-6 py-4 lg:py-5">
        
        {/* LEFT COLUMN - My Posts and Posting Options */}
        <div className={`
          ${activeTab === "create" || activeTab === "myposts" ? "flex w-full" : "hidden"} 
          lg:flex lg:w-[350px] xl:w-[380px] shrink-0 min-w-0 min-h-0 flex-col gap-5
        `}>
          {/* Create Post Box */}
          <div className={`
            ${activeTab === "create" ? "block w-full" : "hidden lg:block"} 
            bg-white rounded-2xl p-5 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_8px_24px_rgba(0,0,0,0.04)] flex-shrink-0 transition-all duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]
          `}>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00] animate-pulse" />
              <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.14em]">Share an Update</h3>
            </div>
            
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="relative">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Share your thoughts, articles or hiring updates..."
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00] focus:bg-white min-h-[120px] resize-none transition-all"
                />
              </div>

              {mediaPreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                  {mediaPreviews.map((url, i) => (
                    <div
                      key={i}
                      className="relative h-16 rounded-lg overflow-hidden border border-slate-200 shadow-xs group"
                    >
                      <Image
                        src={url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 active:scale-98 px-3 py-2.5 rounded-lg transition-all group border border-slate-200/60 cursor-pointer"
                >
                  <Camera size={14} className="text-slate-500 group-hover:text-[#FF8A00] transition-colors" />
                  <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-800 transition-colors">Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 active:scale-98 px-3 py-2.5 rounded-lg transition-all group border border-slate-200/60 cursor-pointer"
                >
                  <Video size={14} className="text-slate-500 group-hover:text-[#FF8A00] transition-colors" />
                  <span className="text-[11px] font-bold text-slate-600 group-hover:text-slate-800 transition-colors">Video</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                />
              </div>

              <button
                disabled={isSubmitting || !newPost.trim()}
                type="submit"
                className="w-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00] text-white font-bold px-6 py-3 rounded-xl text-[12px] transition-all hover:shadow-[0_4px_16px_rgba(255,138,0,0.3)] hover:-translate-y-0.5 active:translate-y-0 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none uppercase tracking-wider cursor-pointer"
              >
                {isSubmitting ? "Publishing..." : "Publish"}
              </button>
            </form>
          </div>

          {/* My Posts Section */}
          <div className={`
            ${activeTab === "myposts" ? "flex w-full" : "hidden lg:flex"} 
            flex-1 min-h-0 flex-col
          `}>
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00]" />
              <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.14em]">My Posts</h3>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                {posts.filter((p) => p.user_id === currentUserId).length}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {posts.filter((p) => p.user_id === currentUserId).length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200/80 flex flex-col items-center justify-center min-h-[200px] p-6">
                  <div className="p-3 bg-slate-50 rounded-full mb-3">
                    <Radio size={20} className="text-slate-400" />
                  </div>
                  <p className="text-[13px] font-bold text-slate-700">Start the conversation</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                    Your published posts will appear here. Share your first updates with the network!
                  </p>
                </div>
              ) : (
                posts
                  .filter((p) => p.user_id === currentUserId)
                  .map((post) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-300 group cursor-pointer"
                    >
                      <div className="flex flex-col w-full mb-2">
                        {editingPost === post.id ? (
                          <div className="w-full space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[12px] font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#FF8A00] min-h-[60px] resize-none"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setEditingPost(null)}
                                className="px-2 py-1 rounded text-[10px] font-bold text-slate-500 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(post.id)}
                                className="px-3 py-1 rounded text-[10px] font-bold bg-[#FF8A00] text-white hover:bg-[#E67A00] shadow-xs"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2 w-full">
                            <p className="text-[13px] text-slate-600 line-clamp-3 font-medium leading-relaxed whitespace-pre-wrap break-words">
                              {post.content}
                            </p>
                            <button
                              onClick={() => handlePinPost(post.id)}
                              className={`shrink-0 p-1 rounded transition-all ${
                                pinnedPostIds.has(post.id)
                                  ? "text-[#FF8A00] bg-[#FFF6ED]"
                                  : "text-slate-300 hover:text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              <Pin size={12} className={pinnedPostIds.has(post.id) ? "fill-[#FF8A00]" : ""} />
                            </button>
                          </div>
                        )}
                      </div>

                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="mb-2 rounded-lg overflow-hidden h-24 relative border border-slate-100 shadow-2xs">
                          <Image
                            src={post.media_urls[0]}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 mt-2">
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Heart size={10} className={post.is_liked ? "fill-rose-600 text-rose-600" : ""} />
                          <span>{post.likes_count}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <MessageSquare size={10} />
                          <span>{post.comments_count}</span>
                        </div>
                        <div className="flex gap-1 ml-auto">
                          <button
                            onClick={() => startEditing(post)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN - Community Feed */}
        <div className={`
          ${activeTab === "feed" ? "flex" : "hidden lg:flex"} 
          flex-1 min-w-0 flex-col overflow-hidden
        `}>
          <div className="flex items-center justify-between mb-4 px-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00]" />
              <h3 className="text-[16px] font-black text-slate-900 uppercase tracking-[0.16em]">Community Feed</h3>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                {posts.length}
              </span>
            </div>
            
            {/* View Pinned Button for screens < xl (tablet/laptop view) */}
            <button
              onClick={() => setShowPinnedDrawer(true)}
              className="xl:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-[#FF8A00] bg-[#FFF6ED] border border-orange-100 hover:bg-orange-100/60 transition-all cursor-pointer"
            >
              <Pin size={12} className="fill-[#FF8A00]" />
              <span>Pinned ({posts.filter((p) => pinnedPostIds.has(p.id)).length})</span>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
            <div className="space-y-5">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <div className="h-10 w-10 border-2 border-[#FF8A00] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Loading Feed...
                  </p>
                </div>
              ) : posts.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[300px]">
                  <div className="p-4 bg-orange-50 rounded-full mb-4">
                    <Radio size={28} className="text-[#FF8A00]" />
                  </div>
                  <p className="text-slate-700 font-bold text-[15px]">No posts in feed yet</p>
                  <p className="text-slate-400 text-[12px] max-w-[280px] mt-1 leading-relaxed">
                    Be the first one to post! Share your thoughts or professional updates with the community.
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-xs hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all duration-300 group"
                  >
                    {/* Post Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-12 w-12 rounded-full overflow-hidden bg-slate-50 shrink-0 border border-slate-100 shadow-2xs">
                          {post.author?.profile_photo_url ? (
                            <Image
                              src={post.author.profile_photo_url}
                              alt=""
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className={`h-full w-full flex items-center justify-center font-bold text-white text-xs bg-gradient-to-br ${
                              post.author?.role === "recruiter" ? "from-[#FF8A00] to-[#FF6B00]" : "from-teal-400 to-emerald-600"
                            }`}>
                              {post.author?.full_name?.[0]?.toUpperCase() || "?"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-900 text-[15px] leading-snug truncate">
                            {post.author?.full_name || "Anonymous"}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            {post.author?.role === "recruiter" ? (
                              <span className="text-[10px] font-extrabold text-[#FF8A00] bg-[#FFF6ED] px-2 py-0.5 rounded-full border border-orange-100">
                                Recruiter
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">
                                Candidate
                              </span>
                            )}
                            <span>•</span>
                            <span>{formatPostDate(post.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handlePinPost(post.id)}
                        className={`shrink-0 p-1.5 rounded-lg transition-all cursor-pointer ${
                          pinnedPostIds.has(post.id)
                            ? "text-[#FF8A00] bg-[#FFF6ED] border border-orange-100"
                            : "text-slate-300 hover:text-slate-600 hover:bg-slate-50 border border-transparent"
                        }`}
                      >
                        <Pin size={14} className={pinnedPostIds.has(post.id) ? "fill-[#FF8A00]" : ""} />
                      </button>
                    </div>

                    {/* Post Content */}
                    {renderPostContent(post)}

                    {/* Media */}
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="mb-4 rounded-xl overflow-hidden h-64 relative border border-slate-100 shadow-2xs group-hover/media:shadow-md transition-shadow">
                        <Image
                          src={post.media_urls[0]}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    )}

                    {/* Interaction Bar */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-4 flex-1">
                        <button
                          onClick={() => handleLike(post)}
                          className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                            post.is_liked ? "text-rose-600" : "text-slate-500 hover:text-rose-500"
                          }`}
                        >
                          <Heart size={15} className={`transition-all duration-200 active:scale-130 ${post.is_liked ? "fill-rose-600" : ""}`} />
                          <span>{post.likes_count}</span>
                        </button>
                        <button
                          onClick={() => toggleComments(post.id)}
                          className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                            expandingComments.has(post.id) ? "text-[#FF8A00]" : "text-slate-500 hover:text-[#FF8A00]"
                          }`}
                        >
                          <MessageSquare size={15} className={expandingComments.has(post.id) ? "fill-[#FF8A00]" : ""} />
                          <span>{post.comments_count}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleShare(post.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                          title="Copy Link"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                        </button>
                        
                        {currentUserId !== post.user_id && (
                          <button
                            onClick={() => handleFollow(post.author.id, post.is_following)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              post.is_following
                                ? "bg-slate-100 text-slate-500 border border-slate-200"
                                : "bg-[#FF8A00] text-white hover:bg-[#E67A00] shadow-2xs hover:shadow-sm"
                            }`}
                          >
                            {post.is_following ? "Following" : "+ Follow"}
                          </button>
                        )}
                        {currentUserId === post.user_id && (
                          <button
                            onClick={() => startEditing(post)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                          >
                            <Edit3 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Comments Section */}
                    {expandingComments.has(post.id) && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                        <div className="space-y-3">
                          {(post.comments || []).map((comment) => (
                            <div key={comment.id} className="flex gap-2.5 group/comment">
                              <div className="h-8 w-8 rounded-full overflow-hidden relative border border-slate-100 shrink-0 flex items-center justify-center shadow-3xs">
                                {comment.author?.profile_photo_url ? (
                                  <Image
                                    src={comment.author.profile_photo_url}
                                    alt=""
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <div className={`h-full w-full flex items-center justify-center font-bold text-white text-[10px] bg-gradient-to-br ${
                                    comment.author?.role === "recruiter" ? "from-[#FF8A00] to-[#FF6B00]" : "from-teal-400 to-emerald-600"
                                  }`}>
                                    {comment.author?.full_name?.[0]?.toUpperCase() || "?"}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100 relative group-hover/comment:bg-slate-100/50 transition-colors">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-slate-900 leading-none">
                                        {comment.author?.full_name || "Anonymous"}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-400 scale-90">
                                        {comment.author?.role === "recruiter" ? "(R)" : "(C)"}
                                      </span>
                                    </div>
                                    {comment.user_id === currentUserId && (
                                      <button
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                        className="opacity-0 group-hover/comment:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200/50 text-slate-400 hover:text-rose-500 cursor-pointer"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-[12.5px] text-slate-600 leading-normal whitespace-pre-wrap break-words">
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add Comment */}
                        <div className="flex gap-2 pt-2 border-t border-slate-100 flex-shrink-0">
                          <input
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                            placeholder="Add a reply..."
                            className="flex-1 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl px-4 py-2 text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-[#FF8A00] transition-all placeholder:text-slate-400"
                          />
                          <button
                            disabled={!(commentInputs[post.id]?.trim())}
                            onClick={() => handleAddComment(post.id)}
                            className="text-[#FF8A00] font-black text-[12px] uppercase tracking-wider px-3 hover:text-orange-600 transition-colors disabled:opacity-30 disabled:hover:text-[#FF8A00] cursor-pointer"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - Pinned Posts (shown only on xl viewports) */}
        <div className={`
          ${activeTab === "pinned" ? "flex w-full" : "hidden"} 
          xl:flex xl:w-[320px] shrink-0 min-w-0 min-h-0 flex-col gap-3
        `}>
          <div className="flex items-center gap-2 px-2 flex-shrink-0">
            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00]" />
            <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.14em]">Pinned</h3>
            <span className="text-[11px] font-bold text-[#FF8A00] bg-[#FFF6ED] px-2 py-0.5 rounded-full border border-orange-100/80">
              {posts.filter((p) => pinnedPostIds.has(p.id)).length}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {posts.filter((p) => pinnedPostIds.has(p.id)).length === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200/80 flex flex-col items-center justify-center min-h-[200px] p-6">
                <div className="p-3 bg-slate-50 rounded-full mb-3">
                  <Pin size={20} className="text-slate-400" />
                </div>
                <p className="text-[13px] font-bold text-slate-700">Keep track of important posts</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                  Pin posts from the community feed to save them here for quick reference.
                </p>
              </div>
            ) : (
              posts
                .filter((p) => pinnedPostIds.has(p.id))
                .map((post) => (
                  <div
                    key={`pinned-sidebar-${post.id}`}
                    className="bg-gradient-to-br from-white to-slate-50/30 rounded-xl p-4 border border-slate-200 shadow-2xs hover:shadow-md hover:border-slate-350 transition-all duration-300 group/item relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#FF8A00]/5 to-transparent rounded-full -mr-8 -mt-8 group-hover/item:scale-150 transition-transform duration-700" />
                    
                    <div className="flex items-start gap-2 mb-2 relative z-10">
                      <div className="h-8 w-8 rounded-full overflow-hidden relative border border-slate-100 shrink-0 flex items-center justify-center">
                        {post.author?.profile_photo_url ? (
                          <Image 
                            src={post.author.profile_photo_url} 
                            alt="" 
                            fill 
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className={`h-full w-full flex items-center justify-center font-bold text-white text-[10px] bg-gradient-to-br ${
                            post.author?.role === "recruiter" ? "from-[#FF8A00] to-[#FF6B00]" : "from-teal-400 to-emerald-600"
                          }`}>
                            {post.author?.full_name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-slate-900 truncate">
                          {post.author?.full_name || "Anonymous"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatPostDate(post.created_at)}
                        </p>
                      </div>
                      <button 
                        onClick={() => handlePinPost(post.id)}
                        className="text-[#FF8A00] hover:text-orange-600 transition-colors shrink-0 p-1 rounded hover:bg-orange-50"
                      >
                        <Pin size={11} className="fill-current" />
                      </button>
                    </div>

                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium line-clamp-3 mb-3 relative z-10 whitespace-pre-wrap break-words">
                      {post.content}
                    </p>

                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="rounded-lg overflow-hidden h-24 relative border border-slate-200/50 shadow-2xs relative z-10">
                        <Image
                          src={post.media_urls[0]}
                          alt=""
                          fill
                          className="object-cover group-hover/item:scale-105 transition-transform duration-500"
                          unoptimized
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1 pt-3 border-t border-slate-100 mt-2 text-[11px] text-slate-400 relative z-10">
                      <span className="flex items-center gap-1">
                        <Heart size={11} className={post.is_liked ? "fill-rose-600 text-rose-600" : ""} />
                        {post.likes_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare size={11} />
                        {post.comments_count}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
