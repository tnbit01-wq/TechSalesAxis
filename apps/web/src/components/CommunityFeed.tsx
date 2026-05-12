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
      } else {
        await apiClient.post("/posts/follow", { following_id: userId }, token);
      }
    } catch (err) {
      console.error("Failed to sync connection:", err);
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
      } else {
        await apiClient.post(`/posts/${postId}/pin`, {}, token);
      }
    } catch (err) {
      console.error("Failed to synchronize cloud pin:", err);
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
    alert("Post link copied to clipboard.");
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
    <div className="w-full h-full flex flex-col overflow-hidden bg-gradient-to-br from-[#F8F9FC] via-white to-[#F0F4F8]">
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 2px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 2px;
        }
      `}</style>

      {/* Main Three Column Layout */}
      <div className="flex-1 min-h-0 overflow-hidden flex gap-6 px-6 py-5">
        {/* LEFT COLUMN - My Posts and Posting Options */}
        <div className="w-[360px] min-w-0 min-h-0 flex flex-col gap-5">
          {/* Create Post Box */}
          <div className="bg-gradient-to-br from-white to-slate-50/30 rounded-2xl p-6 border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] flex-shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00]" />
              <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.14em]">My Post</h3>
            </div>
            
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="relative">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full bg-white border border-slate-200/80 rounded-xl p-4 text-[14px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/30 focus:border-[#FF8A00]/60 min-h-[120px] resize-none transition-all"
                />
              </div>

              {mediaPreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-100/50 rounded-xl border border-slate-200/50">
                  {mediaPreviews.map((url, i) => (
                    <div
                      key={i}
                      className="relative h-16 rounded-lg overflow-hidden border border-slate-200 shadow-sm group"
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
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-2.5 rounded-lg transition-all group border border-slate-200/50"
                >
                  <Camera size={14} className="text-slate-600" />
                  <span className="text-[11px] font-bold text-slate-600">Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 px-3 py-2.5 rounded-lg transition-all group border border-slate-200/50"
                >
                  <Video size={14} className="text-slate-600" />
                  <span className="text-[11px] font-bold text-slate-600">Video</span>
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
                className="w-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00] text-white font-bold px-6 py-3 rounded-xl text-[12px] transition-all hover:shadow-lg hover:shadow-orange-200/50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
              >
                {isSubmitting ? "Publishing..." : "Publish"}
              </button>
            </form>
          </div>

          {/* My Posts Section */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00]" />
              <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.14em]">My Posts</h3>
              <span className="text-[11px] font-bold text-slate-400">
                ({posts.filter((p) => p.user_id === currentUserId).length})
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {posts
                .filter((p) => p.user_id === currentUserId)
                .length === 0 ? (
                <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  <Radio size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    No posts yet
                  </p>
                </div>
              ) : (
                posts
                  .filter((p) => p.user_id === currentUserId)
                  .map((post) => (
                    <div
                      key={post.id}
                      className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[13px] text-slate-600 line-clamp-2 font-medium leading-relaxed">
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

                      {post.media_urls && post.media_urls.length > 0 && (
                        <div className="mb-2 rounded-lg overflow-hidden h-24 relative border border-slate-100">
                          <Image
                            src={post.media_urls[0]}
                            alt=""
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100">
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
                            className="p-1 text-slate-400 hover:text-blue-600 transition-all"
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-all"
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
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-4 px-2 flex-shrink-0">
            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00]" />
            <h3 className="text-[16px] font-black text-slate-900 uppercase tracking-[0.16em]">Community Feed</h3>
            <span className="text-[11px] font-bold text-slate-400">({posts.length})</span>
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
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-200">
                  <Radio size={32} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                    No posts available
                  </p>
                </div>
              ) : (
                posts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300 group"
                  >
                    {/* Post Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-12 w-12 rounded-full overflow-hidden bg-slate-50 shrink-0 border border-slate-100">
                          {post.author?.profile_photo_url ? (
                            <Image
                              src={post.author.profile_photo_url}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center font-bold text-[#FF8A00] text-xs bg-[#FF8A00]/10">
                              {post.author?.full_name?.[0] || "?"}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-black text-slate-900 text-[16px] truncate">
                            {post.author?.full_name || "Anonymous"}
                          </h4>
                          <div className="flex items-center gap-2 text-[12px] text-slate-400">
                            <span className="uppercase font-bold text-[#FF8A00] bg-[#FFF6ED] px-2 py-0.5 rounded border border-orange-100/80">
                              {post.author?.role === "recruiter" ? "R" : "C"}
                            </span>
                            <span>{format(new Date(post.created_at), "MMM d")}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handlePinPost(post.id)}
                        className={`shrink-0 p-1 rounded transition-all ${
                          pinnedPostIds.has(post.id)
                            ? "text-[#FF8A00] bg-[#FFF6ED]"
                            : "text-slate-300 hover:text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Pin size={14} className={pinnedPostIds.has(post.id) ? "fill-[#FF8A00]" : ""} />
                      </button>
                    </div>

                    {/* Post Content */}
                    <p className="text-[15px] text-slate-700 leading-relaxed font-medium mb-4 line-clamp-4">
                      {post.content}
                    </p>

                    {/* Media */}
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="mb-4 rounded-lg overflow-hidden h-52 relative border border-slate-100 shadow-sm">
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
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => handleLike(post)}
                          className={`flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
                            post.is_liked ? "text-rose-600" : "text-slate-500 hover:text-rose-500"
                          }`}
                        >
                          <Heart size={14} className={post.is_liked ? "fill-rose-600" : ""} />
                          <span>{post.likes_count}</span>
                        </button>
                        <button
                          onClick={() => toggleComments(post.id)}
                          className={`flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
                            expandingComments.has(post.id) ? "text-[#FF8A00]" : "text-slate-500 hover:text-[#FF8A00]"
                          }`}
                        >
                          <MessageSquare size={14} className={expandingComments.has(post.id) ? "fill-[#FF8A00]" : ""} />
                          <span>{post.comments_count}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {currentUserId !== post.user_id && (
                          <button
                            onClick={() => handleFollow(post.author.id, post.is_following)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-all ${
                              post.is_following
                                ? "bg-slate-100 text-slate-500 border border-slate-200"
                                : "bg-[#FF8A00] text-white hover:bg-[#E67A00]"
                            }`}
                          >
                            {post.is_following ? "✓" : "+"}
                          </button>
                        )}
                        {currentUserId === post.user_id && (
                          <button
                            onClick={() => startEditing(post)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-all"
                          >
                            <Edit3 size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Comments Section */}
                    {expandingComments.has(post.id) && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3 max-h-56 overflow-y-auto custom-scrollbar">
                        <div className="space-y-2">
                          {(post.comments || []).map((comment) => (
                            <div key={comment.id} className="flex gap-2 group/comment">
                              <div className="h-7 w-7 rounded-full bg-slate-50 overflow-hidden relative border border-slate-100 shrink-0 flex items-center justify-center text-[9px] font-bold text-[#FF8A00] bg-[#FF8A00]/10">
                                {comment.author?.full_name?.[0] || "?"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[11px] font-bold text-slate-900">
                                      {comment.author?.full_name || "Anonymous"}
                                    </span>
                                    {comment.user_id === currentUserId && (
                                      <button
                                        onClick={() => handleDeleteComment(post.id, comment.id)}
                                        className="opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                      >
                                        <Trash2 size={10} className="text-slate-400 hover:text-red-500" />
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-[12px] text-slate-600">
                                    {comment.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Add Comment */}
                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                          <input
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                            placeholder="Reply..."
                            className="flex-1 bg-white border border-slate-100 rounded-lg px-3 py-2 text-[12px] font-medium focus:outline-none focus:ring-1 focus:ring-[#FF8A00]/30 placeholder:text-slate-300"
                          />
                          <button
                            disabled={!(commentInputs[post.id]?.trim())}
                            onClick={() => handleAddComment(post.id)}
                            className="text-[#FF8A00] font-bold text-[12px] disabled:opacity-30"
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

        {/* RIGHT COLUMN - Pinned Posts */}
        <div className="w-[320px] min-w-0 min-h-0 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-2 flex-shrink-0">
            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF6B00]" />
            <h3 className="text-[13px] font-black text-slate-900 uppercase tracking-[0.14em]">Pinned</h3>
            <span className="text-[11px] font-bold text-[#FF8A00] bg-[#FFF6ED] px-2 py-0.5 rounded-full border border-orange-100/80">
              {posts.filter((p) => pinnedPostIds.has(p.id)).length}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {posts.filter((p) => pinnedPostIds.has(p.id)).length === 0 ? (
              <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center min-h-40">
                <Pin size={24} className="text-slate-300 mb-2" />
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  No pinned posts
                </p>
              </div>
            ) : (
              posts
                .filter((p) => pinnedPostIds.has(p.id))
                .map((post) => (
                  <div
                    key={`pinned-${post.id}`}
                    className="bg-gradient-to-br from-white to-slate-50/30 rounded-xl p-4 border border-[#FF8A00]/20 shadow-sm hover:shadow-md transition-all group/item relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-[#FF8A00]/10 to-transparent rounded-full -mr-8 -mt-8 group-hover/item:scale-150 transition-transform duration-700" />
                    
                    <div className="flex items-start gap-2 mb-2 relative z-10">
                      <div className="h-8 w-8 rounded-full bg-[#FF8A00]/10 overflow-hidden relative border border-[#FF8A00]/30 shrink-0 flex items-center justify-center">
                        {post.author?.profile_photo_url ? (
                          <Image 
                            src={post.author.profile_photo_url} 
                            alt="" 
                            fill 
                            className="object-cover" 
                          />
                        ) : (
                          <span className="text-[8px] font-bold text-[#FF8A00]">
                            {post.author?.full_name?.[0] || "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-black text-slate-900 truncate">
                          {post.author?.full_name || "Anonymous"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {format(new Date(post.created_at), "MMM d")}
                        </p>
                      </div>
                      <button 
                        onClick={() => handlePinPost(post.id)}
                        className="text-[#FF8A00] hover:text-orange-600 transition-colors shrink-0"
                      >
                        <Pin size={11} className="fill-current" />
                      </button>
                    </div>

                    <p className="text-[13px] text-slate-600 leading-relaxed font-medium line-clamp-3 mb-3 relative z-10">
                      {post.content}
                    </p>

                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="rounded-lg overflow-hidden h-24 relative border border-slate-200/50 shadow-sm relative z-10">
                        <Image
                          src={post.media_urls[0]}
                          alt=""
                          fill
                          className="object-cover group-hover/item:scale-110 transition-transform duration-700"
                          unoptimized
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-1 pt-3 border-t border-slate-100/50 mt-2 text-[11px] text-slate-400 relative z-10">
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
