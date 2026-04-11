"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import {
  Trash2,
  Edit3,
  X,
  Video,
  Pin,
  Heart,
  MessageSquare,
  Share2,
  TrendingUp,
  Radio,
  UserCheck,
  UserPlus,
  Zap,
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
  const [activeTab, setActiveTab] = useState<"global" | "personal">("global");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pinnedPostIds, setPinnedPostIds] = useState<Set<string>>(new Set());
  const [expandingComments, setExpandingComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const handleLike = async (post: Post) => {
    const token = awsAuth.getToken();
    if (!token) return;

    const isLiked = post.is_liked;

    // Optimistic UI
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
      // Rollback
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

    // Optimistic Update
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
      } else {
        await apiClient.post("/posts/follow", { following_id: userId }, token);
      }
    } catch (err) {
      console.error("Failed to sync connection:", err);
      // Rollback
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

    // Optimistic Update
    setPinnedPostIds((prev) => {
      const newPins = new Set(prev);
      if (isCurrentlyPinned) newPins.delete(postId);
      else newPins.add(postId);
      return newPins;
    });

    try {
      if (isCurrentlyPinned) {
        await apiClient.delete(`/posts/${postId}/unpin`, token);
      } else {
        await apiClient.post(`/posts/${postId}/pin`, {}, token);
      }
    } catch (err) {
      console.error("Failed to synchronize cloud pin:", err);
      // Rollback on error
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
    alert("Signal connection link copied to clipboard.");
  };

  const fetchFeed = async () => {
    try {
      setLoading(true);
      const token = awsAuth.getToken();
      if (!token) return;

      const user = awsAuth.getUser();
      if (user) {
        console.log("DEBUG: Setting Current User ID:", user.id);
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

  const filteredPosts =
    activeTab === "global"
      ? posts
      : posts.filter((p) => p.user_id === currentUserId);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    setIsSubmitting(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const uploadedUrls: string[] = [];

      // Upload media if present
      for (const file of mediaFiles) {
        const formData = new FormData();
        formData.append("file", file);

        try {
          const result = await apiClient.post("/posts/upload", formData, token);
          if (result.url) {
            uploadedUrls.push(result.url);
          }
        } catch (uploadError) {
          console.error(`Upload error for ${file.name}:`, uploadError);
          alert(`Failed to upload ${file.name}.`);
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
      fetchFeed();
    } catch (err) {
      console.error("Error creating post:", err);
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
    } catch (err) {
      console.error("Error deleting post:", err);
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
      fetchFeed();
    } catch (err) {
      console.error("Error updating post:", err);
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

  return (
    <div className="w-full p-6 sm:p-8">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("global")}
            className={`text-sm font-black uppercase tracking-[0.2em] transition-all relative pb-2 ${
              activeTab === "global"
                ? "text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Community Feed
            {activeTab === "global" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("personal")}
            className={`text-sm font-black uppercase tracking-[0.2em] transition-all relative pb-2 ${
              activeTab === "personal"
                ? "text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            My Posts
            {activeTab === "personal" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl">
          <div className="px-3 py-1.5 flex items-center gap-2">
            <TrendingUp size={14} className="text-blue-600" />
            <span className="text-3xs font-black uppercase text-slate-500 tracking-widest">
              Trending Now
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Main Feed Column - 65% width equivalent */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Create Post Box */}
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm mb-8">
            <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Start a Conversation
            </h2>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="relative">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Share what's on your mind with the community..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-100 min-h-[120px] resize-none transition-all focus:bg-white"
                />
              </div>

              {mediaPreviews.length > 0 && (
                <div className="grid grid-cols-4 gap-3 p-4 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  {mediaPreviews.map((url, i) => (
                    <div
                      key={i}
                      className="relative h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm group"
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
                        className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all group border border-slate-100"
                  >
                    <div className="p-1 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                      <Camera size={12} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Photo
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all group border border-slate-100"
                  >
                    <div className="p-1 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <Video size={12} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Video
                    </span>
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

                <div className="flex items-center gap-3">
                  <button
                    disabled={isSubmitting || !newPost.trim()}
                    type="submit"
                    className="bg-blue-600 text-white font-black px-10 py-3 rounded-xl text-[11px] uppercase tracking-[0.2em] transition-all hover:bg-slate-900 active:scale-95 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "..." : "POST"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Community Discussions */}
          <div className="space-y-6">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4">
                <div className="h-10 w-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Loading Feed...
                </p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] p-16 text-center border border-dashed border-slate-200">
                <div className="h-16 w-16 bg-slate-50 flex items-center justify-center rounded-full mx-auto mb-4 border border-slate-100 text-slate-200">
                  <Radio size={28} />
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                  No activity detected here
                </p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white rounded-[2rem] p-0 border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300"
                >
                  {/* Post Header */}
                  <div className="p-6 sm:p-8 pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4">
                        <div className="relative h-12 w-12 rounded-full overflow-hidden bg-slate-50 shrink-0 border border-slate-100">
                          {post.author?.profile_photo_url ? (
                            <Image
                              src={post.author.profile_photo_url}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center font-black text-blue-600 text-sm bg-blue-100">
                              {post.author?.full_name?.[0] || "?"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-black text-slate-900 text-sm tracking-tight truncate">
                            {post.author?.full_name || "Anonymous"}
                          </h3>
                          <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 mt-0.5">
                            <span className="uppercase tracking-widest text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md border border-blue-100">
                              {post.author?.role === "recruiter"
                                ? "Recruiter"
                                : "Candidate"}
                            </span>
                            <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                            <span>
                              {format(new Date(post.created_at), "MMM d • h:mm a")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handlePinPost(post.id)}
                          className={`p-2 rounded-lg transition-all ${pinnedPostIds.has(post.id) ? "text-blue-600 bg-blue-100" : "text-slate-300 hover:text-slate-600 hover:bg-slate-50"}`}
                        >
                          <Pin
                            size={16}
                            className={pinnedPostIds.has(post.id) ? "fill-blue-600" : ""}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="text-slate-600 text-[13px] leading-relaxed font-medium whitespace-pre-wrap">
                        {editingPost === post.id ? (
                          <div className="space-y-4 py-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-6 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 min-h-32 resize-none font-bold text-slate-900"
                            />
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => setEditingPost(null)}
                                className="text-2xs font-black uppercase text-slate-400 hover:text-slate-900 tracking-widest px-4"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(post.id)}
                                className="bg-slate-900 text-white text-2xs font-black uppercase tracking-widest px-8 py-3 rounded-xl shadow-lg shadow-slate-200"
                              >
                                Seal Update
                              </button>
                            </div>
                          </div>
                        ) : (
                          post.content
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Media Content */}
                  {post.media_urls &&
                    post.media_urls.length > 0 &&
                    !editingPost && (
                      <div className="px-6 sm:px-8 py-4">
                        <div
                          className={`grid rounded-2xl overflow-hidden border border-slate-100 shadow-sm ${post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
                        >
                          {post.media_urls.map((url, i) => (
                            <div key={i} className="relative aspect-video">
                               <Image
                                src={url}
                                alt=""
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Interaction Bar */}
                  <div className="px-6 sm:px-8 py-4 border-t border-slate-50 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleLike(post)}
                          className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                            post.is_liked ? "text-rose-600" : "text-slate-500 hover:text-rose-500"
                          }`}
                        >
                          <Heart size={16} className={post.is_liked ? "fill-rose-600" : ""} />
                          {post.likes_count > 0 ? `${post.likes_count} LIKE${post.likes_count > 1 ? "S" : ""}` : "LIKE"}
                        </button>
                        <button 
                          onClick={() => toggleComments(post.id)}
                          className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
                            expandingComments.has(post.id) ? "text-blue-600" : "text-slate-500 hover:text-blue-600"
                          }`}
                        >
                          <MessageSquare size={16} className={expandingComments.has(post.id) ? "fill-blue-600" : ""} />
                          {post.comments_count > 0 ? `${post.comments_count} COMMENT${post.comments_count > 1 ? "S" : ""}` : "COMMENT"}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                         {currentUserId !== post.user_id && (
                          <button
                            onClick={() =>
                              handleFollow(post.author.id, post.is_following)
                            }
                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              post.is_following
                                ? "bg-slate-100 text-slate-400 border border-slate-200"
                                : "bg-slate-900 text-white hover:bg-black shadow-lg"
                            }`}
                          >
                            {post.is_following ? "Following" : "Follow"}
                          </button>
                        )}
                        {currentUserId === post.user_id && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEditing(post)}
                              className="p-2 text-slate-400 hover:text-blue-600 transition-all"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="p-2 text-slate-400 hover:text-rose-500 transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Comments Section */}
                  {expandingComments.has(post.id) && (
                    <div className="px-6 sm:px-8 pb-6 bg-white border-t border-slate-50 animate-in slide-in-from-bottom-2 duration-300">
                      <div className="pt-6 space-y-6">
                        {/* New Comment Input */}
                        <div className="flex gap-4">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                             <span className="text-[10px] font-black text-slate-400">?</span>
                          </div>
                          <div className="w-full flex gap-3">
                            <input
                              value={commentInputs[post.id] || ""}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                              placeholder="Add a comment..."
                              className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-[11px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-100 placeholder:text-slate-300 placeholder:font-black placeholder:uppercase placeholder:tracking-widest"
                            />
                            <button
                              disabled={!(commentInputs[post.id]?.trim())}
                              onClick={() => handleAddComment(post.id)}
                              className="text-blue-600 font-black text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:grayscale transition-all hover:text-blue-700"
                            >
                              Post
                            </button>
                          </div>
                        </div>

                        {/* Comments List */}
                        <div className="space-y-6">
                          {(post.comments || []).map((comment) => (
                            <div key={comment.id} className="flex gap-4 group/comment">
                              <div className="h-8 w-8 rounded-full bg-slate-50 overflow-hidden relative border border-slate-100 shrink-0">
                                {comment.author?.profile_photo_url ? (
                                  <Image src={comment.author.profile_photo_url} alt="" fill className="object-cover" />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center font-black text-blue-600 text-[10px] bg-blue-100">
                                    {comment.author?.full_name?.[0] || "?"}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="bg-slate-50/50 rounded-2xl px-5 py-3 border border-slate-100 group-hover/comment:bg-white group-hover/comment:shadow-lg transition-all">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-slate-900 tracking-tight">
                                        {comment.author?.full_name || "Anonymous Member"}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-300">
                                        {format(new Date(comment.created_at), "MMM d")}
                                      </span>
                                    </div>
                                    {comment.user_id === currentUserId && (
                                      <button
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                        className="opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                        title="Delete comment"
                                      >
                                        <Trash2 size={14} className="text-slate-400 hover:text-red-500" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="col-span-12 lg:col-span-4 space-y-8 lg:sticky lg:top-24">
          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Pin size={14} className="text-blue-600" />
                Pinned Signals
              </h4>
              <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full border border-blue-100 italic">
                {posts.filter((p) => pinnedPostIds.has(p.id)).length}
              </span>
            </div>

            <div className="space-y-4">
              {posts.filter((p) => pinnedPostIds.has(p.id)).length === 0 ? (
                <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
                    No signals pinned
                  </p>
                </div>
              ) : (
                posts
                  .filter((p) => pinnedPostIds.has(p.id))
                  .map((post) => (
                    <div
                      key={`pinned-${post.id}`}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-lg transition-all cursor-pointer group/item"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="h-7 w-7 rounded-full bg-blue-100 overflow-hidden relative border border-white shrink-0 flex items-center justify-center">
                            {post.author?.profile_photo_url ? (
                              <Image 
                                src={post.author.profile_photo_url} 
                                alt="" 
                                fill 
                                className="object-cover" 
                              />
                            ) : (
                              <span className="text-[10px] font-black text-blue-600">
                                {post.author?.full_name?.[0] || "?"}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-black text-slate-900 uppercase truncate">
                            {post.author?.full_name || "Anonymous"}
                          </span>
                        </div>
                        <button 
                          onClick={() => handlePinPost(post.id)}
                          className="text-blue-600 hover:text-rose-500 transition-colors shrink-0 px-1"
                        >
                          <Pin size={12} className="fill-current" />
                        </button>
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed line-clamp-2 italic pl-1 border-l-2 border-blue-100/50">
                        &ldquo;{post.content}&rdquo;
                      </p>

                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="mt-3 rounded-xl overflow-hidden aspect-video relative border border-slate-100 shadow-sm">
                          {/\.(mp4|webm|ogg)/i.test(post.media_urls[0].split("?")[0]) || post.media_urls[0].includes("video") ? (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                              <Video size={20} className="text-white/50" />
                            </div>
                          ) : (
                            <Image
                              src={post.media_urls[0]}
                              alt=""
                              fill
                              className="object-cover group-hover/item:scale-110 transition-transform duration-700"
                              unoptimized
                            />
                          )}
                          {post.media_urls.length > 1 && (
                            <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter backdrop-blur-sm">
                              +{post.media_urls.length - 1} More
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

