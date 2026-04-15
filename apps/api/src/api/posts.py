from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session
from src.core.dependencies import get_current_user, get_db
from src.core.models import (
    Post, User, CandidateProfile, RecruiterProfile, Follow,
    PostLike, PostComment, UserPinnedPost
)
from src.schemas.posts import PostCreate, PostResponse, PostAuthor, FollowRequest, CommentCreate, CommentResponse
from src.services.s3_service import S3Service
from typing import List, Dict
from uuid import UUID
import uuid
import json
from datetime import datetime

router = APIRouter(tags=["posts"])

@router.post("", response_model=PostResponse)
def create_post(
    request: PostCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    
    new_post = Post(
        user_id=user_id,
        content=request.content,
        media_urls=request.media_urls,
        type=request.type
    )
    
    try:
        db.add(new_post)
        db.commit()
        db.refresh(new_post)
        return new_post
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/feed", response_model=List[PostResponse])
def get_feed(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user_id = UUID(user["sub"])
    
    try:
        # 1. Fetch main feed (most recent 50)
        posts = db.query(Post).order_by(Post.created_at.desc()).limit(50).all()
        
        # 2. Fetch all pinned signal IDs for this user
        pinned_records = db.query(UserPinnedPost).filter(UserPinnedPost.user_id == current_user_id).order_by(UserPinnedPost.pinned_at.desc()).all()
        pinned_ids = [p.post_id for p in pinned_records]
        pinned_ids_set = set(pinned_ids)
        
        # 3. Identify and fetch missing pinned posts (those older than the 50 in the feed)
        feed_ids = set([p.id for p in posts])
        missing_pinned_ids = [pid for pid in pinned_ids if pid not in feed_ids]
        
        if missing_pinned_ids:
            missing_pinned_posts = db.query(Post).filter(Post.id.in_(missing_pinned_ids[:50])).all()
            posts.extend(missing_pinned_posts)
            # Re-sort after extending
            posts.sort(key=lambda x: x.created_at or datetime.min, reverse=True)
        
        post_ids = [p.id for p in posts]
        author_ids = list(set([p.user_id for p in posts]))
        
        users_records = db.query(User).filter(User.id.in_(author_ids)).all()
        users_map = {u.id: u.role for u in users_records}
        
        candidate_ids = [uid for uid, role in users_map.items() if role == "candidate"]
        candidates_records = db.query(CandidateProfile).filter(CandidateProfile.user_id.in_(candidate_ids)).all()
        candidates_map = {c.user_id: c for c in candidates_records}
        
        recruiter_ids = [uid for uid, role in users_map.items() if role == "recruiter"]
        recruiters_records = db.query(RecruiterProfile).filter(RecruiterProfile.user_id.in_(recruiter_ids)).all()
        recruiters_map = {r.user_id: r for r in recruiters_records}
        
        followed_records = db.query(Follow).filter(Follow.follower_id == current_user_id).all()
        followed_ids = set([f.following_id for f in followed_records])
        
        likes_records = db.query(PostLike).filter(PostLike.post_id.in_(post_ids)).all()
        likes_count_map = {}
        for l in likes_records:
            pid = l.post_id
            likes_count_map[pid] = likes_count_map.get(pid, 0) + 1
            
        user_likes_records = db.query(PostLike).filter(PostLike.user_id == current_user_id, PostLike.post_id.in_(post_ids)).all()
        user_liked_ids = set([l.post_id for l in user_likes_records])
        
        comments_records = db.query(PostComment).filter(PostComment.post_id.in_(post_ids)).order_by(PostComment.created_at.asc()).all()
        comments_map = {}
        comment_user_ids = set()
        for c in comments_records:
            pid = c.post_id
            if pid not in comments_map: comments_map[pid] = []
            comments_map[pid].append({
                "id": c.id,
                "user_id": c.user_id,
                "post_id": c.post_id,
                "content": c.content,
                "created_at": c.created_at
            })
            comment_user_ids.add(c.user_id)

        comment_authors_map = {}
        s3 = S3Service()
        if comment_user_ids:
            c_users_records = db.query(User).filter(User.id.in_(list(comment_user_ids))).all()
            c_users_map = {u.id: u.role for u in c_users_records}
            
            c_candidate_ids = [uid for uid, role in c_users_map.items() if role == "candidate"]
            c_candidates_records = db.query(CandidateProfile).filter(CandidateProfile.user_id.in_(c_candidate_ids)).all()
            c_candidates_map = {c.user_id: c for c in c_candidates_records}
            
            c_recruiter_ids = [uid for uid, role in c_users_map.items() if role == "recruiter"]
            c_recruiters_records = db.query(RecruiterProfile).filter(RecruiterProfile.user_id.in_(c_recruiter_ids)).all()
            c_recruiters_map = {r.user_id: r for r in recruiters_records}
            
            for uid, role in c_users_map.items():
                author_item = {"id": uid, "role": role}
                if role == "candidate" and uid in c_candidates_map:
                    author_item["full_name"] = c_candidates_map[uid].full_name
                    # Sign candidate profile photo for comments
                    c_photo = c_candidates_map[uid].profile_photo_url
                    author_item["profile_photo_url"] = s3.get_signed_url(c_photo) if c_photo else None
                elif role == "recruiter" and uid in c_recruiters_map:
                    author_item["full_name"] = c_recruiters_map[uid].full_name
                comment_authors_map[uid] = author_item

        enriched_posts = []
        s3 = S3Service()
        for post in posts:
            author_id = post.user_id
            post_id = post.id
            role = users_map.get(author_id, "unknown")
            
            author_info = {
                "id": author_id,
                "role": role,
            }
            
            if role == "candidate" and author_id in candidates_map:
                author_info["full_name"] = candidates_map[author_id].full_name
                # Sign candidate profile photo
                photo_url = candidates_map[author_id].profile_photo_url
                if photo_url:
                    author_info["profile_photo_url"] = s3.get_signed_url(photo_url)
                else:
                    author_info["profile_photo_url"] = None
            elif role == "recruiter" and author_id in recruiters_map:
                author_info["full_name"] = recruiters_map[author_id].full_name

            # Sign media URLs
            media_urls = getattr(post, "media_urls", []) or []
            # Filter out None or empty values before signing to avoid validation errors
            valid_media_urls = [url for url in media_urls if url]
            signed_media_urls = [s3.get_signed_url(url) for url in valid_media_urls]
            
            post_dict = {
                "id": post.id,
                "user_id": post.user_id,
                "content": getattr(post, "content", ""),
                "media_urls": signed_media_urls or [],
                "type": getattr(post, "type", "post"),
                "created_at": post.created_at,
                "author": author_info,
                "is_following": author_id in followed_ids,
                "is_pinned": post_id in pinned_ids_set,
                "likes_count": likes_count_map.get(post_id, 0),
                "is_liked": post_id in user_liked_ids
            }
            
            p_comments = comments_map.get(post_id, [])
            post_dict["comments_count"] = len(p_comments)
            
            hydrated_comments = []
            for c in p_comments:
                c["author"] = comment_authors_map.get(c["user_id"])
                hydrated_comments.append(c)
            post_dict["comments"] = hydrated_comments
            
            enriched_posts.append(post_dict)
            
        return enriched_posts
    except Exception as e:
        print(f"Error fetching feed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{post_id}", response_model=PostResponse)
def update_post(
    post_id: UUID,
    request: PostCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post or post.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this post")
            
        post.content = request.content
        post.media_urls = request.media_urls
        db.commit()
        db.refresh(post)
        return post
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{post_id}")
def delete_post(
    post_id: UUID,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post or post.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this post")
            
        db.delete(post)
        db.commit()
        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{post_id}/like")
def like_post(
    post_id: UUID, 
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    try:
        from src.core.models import PostLike
        existing = db.query(PostLike).filter(PostLike.user_id == user_id, PostLike.post_id == post_id).first()
        if existing:
            return {"status": "already_liked"}
        
        new_like = PostLike(user_id=user_id, post_id=post_id)
        db.add(new_like)
        db.commit()
        return {"status": "liked"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{post_id}/unlike")
def unlike_post(
    post_id: UUID, 
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    try:
        from src.core.models import PostLike
        db.query(PostLike).filter(PostLike.user_id == user_id, PostLike.post_id == post_id).delete()
        db.commit()
        return {"status": "unliked"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{post_id}/comments", response_model=CommentResponse)
def add_comment(
    post_id: UUID,
    request: CommentCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    try:
        from src.core.models import PostComment
        new_comment = PostComment(
            post_id=post_id,
            user_id=user_id,
            content=request.content
        )
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)

        user_record = db.query(User).filter(User.id == user_id).first()
        candidate = db.query(CandidateProfile).filter(CandidateProfile.user_id == user_id).first()
        recruiter = db.query(RecruiterProfile).filter(RecruiterProfile.user_id == user_id).first()
        author = {
            "id": user_id,
            "role": user_record.role if user_record else "candidate",
            "full_name": candidate.full_name if candidate else recruiter.full_name if recruiter else "Anonymous",
            "profile_photo_url": candidate.profile_photo_url if candidate else None,
        }

        return {
            "id": new_comment.id,
            "user_id": new_comment.user_id,
            "post_id": new_comment.post_id,
            "content": new_comment.content,
            "created_at": new_comment.created_at,
            "author": author,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: UUID,
    comment_id: UUID,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    try:
        from src.core.models import PostComment
        comment = db.query(PostComment).filter(
            PostComment.id == comment_id,
            PostComment.post_id == post_id
        ).first()
        
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        if comment.user_id != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
        
        db.delete(comment)
        db.commit()
        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/follow")
def follow_user(
    request: FollowRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    follower_id = UUID(user["sub"])
    try:
        existing = db.query(Follow).filter(
            Follow.follower_id == follower_id,
            Follow.following_id == request.following_id,
        ).first()
        if existing:
            return {"status": "already_following"}
        db.add(Follow(follower_id=follower_id, following_id=request.following_id))
        db.commit()
        return {"status": "following"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/unfollow/{user_id}")
def unfollow_user(
    user_id: UUID,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    follower_id = UUID(user["sub"])
    try:
        db.query(Follow).filter(
            Follow.follower_id == follower_id,
            Follow.following_id == user_id,
        ).delete()
        db.commit()
        return {"status": "unfollowed"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{post_id}/pin")
def pin_post(
    post_id: UUID,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    try:
        existing = db.query(UserPinnedPost).filter(
            UserPinnedPost.user_id == user_id,
            UserPinnedPost.post_id == post_id,
        ).first()
        if existing:
            return {"status": "already_pinned"}
        db.add(UserPinnedPost(user_id=user_id, post_id=post_id))
        db.commit()
        return {"status": "pinned"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{post_id}/unpin")
def unpin_post(
    post_id: UUID,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = UUID(user["sub"])
    try:
        db.query(UserPinnedPost).filter(
            UserPinnedPost.user_id == user_id,
            UserPinnedPost.post_id == post_id,
        ).delete()
        db.commit()
        return {"status": "unpinned"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_post_media(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    user_id = user["sub"]
    content = await file.read()
    file_path = f"posts/{user_id}/{uuid.uuid4()}-{file.filename}"
    uploaded = S3Service.upload_file(content, file_path, file.content_type or "application/octet-stream")
    if not uploaded:
        raise HTTPException(status_code=500, detail="Failed to upload file")
    return {
        "status": "uploaded",
        "path": file_path,
        "url": S3Service.get_signed_url(file_path),
    }
