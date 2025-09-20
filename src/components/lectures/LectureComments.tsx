'use client';

import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Send, Edit2, Trash2, Reply, X, Shield, EyeOff, Loader2, UserRound, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';

interface Comment {
  id: string;
  content: string;
  userId: string;
  lectureId: string;
  createdAt: string;
  updatedAt: string;
  isAnonymous?: boolean;
  parentCommentId?: string | null;
  user?: {
    name?: string;
    email?: string;
    avatar?: string | null;
    role?: string;
  };
  replies?: Comment[];
  imageUrls?: string[];
}

interface LectureCommentsProps {
  lectureId: string;
}

export function LectureComments({ lectureId }: LectureCommentsProps) {
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [postAnon, setPostAnon] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Comment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const mainTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize function for textareas
  const autoResizeTextarea = (textarea: HTMLTextAreaElement, maxLines = 3, baseLineHeight = 24) => {
    // Reset height to auto to get the natural scroll height
    textarea.style.height = 'auto';
    
    // Get the actual content height
    const scrollHeight = textarea.scrollHeight;
    
    // Calculate max height based on lines
    const maxHeight = baseLineHeight * maxLines;
    
    // Set the height - either the content height or max height
    const newHeight = Math.min(scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    
    // Show scrollbar only if content exceeds max height
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  // Initialize textarea height on component mount
  useEffect(() => {
    if (mainTextareaRef.current) {
      autoResizeTextarea(mainTextareaRef.current);
    }
  }, []);

  // Text normalization helpers (matching QuestionComments)
  const stripControlChars = (val: string) => val.replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, '');
  const normalizeLTR = (val: string) => stripControlChars(val);
  const displayText = (val: string) => stripControlChars(val);

  // Helper functions
  const getUserDisplay = (comment: Comment) => {
    const displayAsAnonymous = comment.isAnonymous && !isAdmin && user?.id !== comment.userId;
    const displayName = displayAsAnonymous ? 'Anonyme' : (comment.user?.name || comment.user?.email || 'Utilisateur');
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return { displayName, initials, displayAsAnonymous };
  };

  const formatTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString();
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };
  // Load comments for this lecture
  useEffect(() => {
    const loadComments = async () => {
      if (!lectureId) return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/comments?lectureId=${lectureId}`);
        if (response.ok) {
          const commentsData = await response.json();
          const sanitized = (commentsData || []).map((c: Comment) => ({ ...c, content: stripControlChars(c.content || '') }));
          setComments(sanitized);
        } else {
          console.error('Failed to load comments');
        }
      } catch (error) {
        console.error('Error loading comments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadComments();
  }, [lectureId]);

  const insertReply = (nodes: Comment[], parentId: string, newNode: Comment): Comment[] =>
    nodes.map(n => n.id === parentId
      ? { ...n, replies: [newNode, ...(n.replies || [])] }
      : { ...n, replies: n.replies ? insertReply(n.replies, parentId, newNode) : n.replies });

  const updateNode = (nodes: Comment[], id: string, updater: (c: Comment) => Comment): Comment[] =>
    nodes.map(n => n.id === id ? updater(n) : { ...n, replies: n.replies ? updateNode(n.replies, id, updater) : n.replies });

  const removeNode = (nodes: Comment[], id: string): Comment[] =>
    nodes.filter(n => n.id !== id).map(n => ({ ...n, replies: n.replies ? removeNode(n.replies, id) : n.replies }));

  const handleSubmitComment = async () => {
    if (!user?.id) {
      toast({ title: "Error", description: "Please sign in to comment.", variant: "destructive" });
      return;
    }

    const content = newComment.trim();
    if (!content && images.length === 0) return;

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lectureId,
          userId: user.id,
          content,
          isAnonymous: postAnon,
          imageUrls: images
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit comment');
      }

      const newCommentData: Comment = await response.json();
      newCommentData.content = stripControlChars(newCommentData.content || '');
      setComments(prev => [newCommentData, ...prev]);
      setNewComment('');
      setImages([]);
      setPostAnon(false);

      toast({ title: "Success", description: "Comment posted successfully!" });
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({ title: "Error", description: "Failed to post comment.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplySubmit = async (content: string, isAnon: boolean, replyToComment: Comment, images: string[] = []) => {
    if (!user?.id || !replyToComment) return;

    const trimmedContent = content.trim();
    if (!trimmedContent && images.length === 0) return;

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lectureId,
          userId: user.id,
          content: trimmedContent,
          isAnonymous: isAnon,
          parentCommentId: replyToComment.id,
          imageUrls: images
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit reply');
      }

      const newReply: Comment = await response.json();
      newReply.content = stripControlChars(newReply.content || '');
      setComments(prev => insertReply(prev, replyToComment.id, newReply));
      setReplyTo(null);

      toast({ title: "Success", description: "Reply posted successfully!" });
    } catch (error) {
      console.error('Error submitting reply:', error);
      toast({ title: "Error", description: "Failed to post reply.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // legacy submitReply removed; ReplyForm uses handleReplySubmit above

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editContent.trim(),
        }),
      });

      if (response.ok) {
        const updatedComment = await response.json();
        setComments(prev => prev.map(c => {
          if (c.id === commentId) return { ...c, ...updatedComment };
          return { ...c, replies: c.replies?.map(r => r.id === commentId ? { ...r, ...updatedComment } : r) };
        }));
        setEditingComment(null);
        setEditContent('');
        toast({
          title: "Comment Updated",
          description: "Your comment has been updated.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to update comment.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to update comment.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (response.ok) {
        setComments(prev => prev
          .filter(c => c.id !== commentId)
          .map(c => ({ ...c, replies: c.replies?.filter(r => r.id !== commentId) }))
        );
        toast({ title: 'Comment Deleted', description: 'The comment has been deleted successfully.' });
      } else {
        const errorData = await response.json();
        toast({ title: 'Error', description: errorData.error || 'Failed to delete comment.', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to delete comment.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleAdminDeleteComment = handleDeleteComment; // same behavior for now

  const startEditing = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };
  const cancelEditing = () => { setEditingComment(null); setEditContent(''); };

  const getUserInitials = (name?: string, email?: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email.slice(0, 2).toUpperCase();
    return 'AN';
  };

  const displayName = (c: Comment) => {
    if (c.isAnonymous) return 'Anonymous';
    return c.user?.name || c.user?.email || 'User';
  };

  // toggleLike removed

  const findRootId = (target: Comment): string => {
    if (!target.parentCommentId) return target.id;
    // recursive search
    for (const root of comments) {
      if (root.id === target.id) return root.id;
      const stack: Comment[] = [...(root.replies || [])];
      while (stack.length) {
        const current = stack.shift()!;
        if (current.id === target.id) return root.id;
        if (current.replies) stack.push(...current.replies);
      }
    }
    return target.parentCommentId; // fallback
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sign in to view comments</h3>
          <p className="text-muted-foreground">
            Join the discussion by signing in to your account.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Facebook-style Comment Component (matching QuestionComments)
  const CommentItem = memo(({ comment, depth = 0 }: { comment: Comment; depth?: number }) => {
    const { displayName, initials, displayAsAnonymous } = getUserDisplay(comment);
    const isOwner = user?.id === comment.userId;
    const isEditing = editingComment === comment.id;
    const isReplying = replyTo?.id === comment.id;
    const canDelete = !!(isAdmin || isOwner);
    const isReply = depth > 0;
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedReplies.has(comment.id);
    const replyCount = comment.replies?.length || 0;

    return (
      <div className={`${isReply ? 'relative' : 'mt-4'}`}>
        {/* Threading Line for Replies */}
        {isReply && (
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
        )}
        
        <div className={`flex gap-3 ${isReply ? 'ml-8 relative' : ''}`}>
          {/* Connection dot for replies */}
          {isReply && (
            <div className="absolute -left-8 top-5 w-3 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
          )}
          
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className={`${isReply ? 'w-8 h-8' : 'w-10 h-10'} rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm`}>
              {displayAsAnonymous ? <EyeOff className="h-4 w-4" /> : initials}
            </div>
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            {!isEditing ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 max-w-[calc(100%-2rem)]">
                <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                  {displayName}
                  {comment.user?.role === 'admin' && !comment.isAnonymous && (
                    <span className="px-1.5 py-0.5 text-[10px] tracking-wide bg-blue-500/15 text-blue-500 rounded-full">ADMIN</span>
                  )}
                  {comment.isAnonymous && isAdmin && (
                    <span title="Posted anonymously">
                      <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap" dir="ltr">
                  {comment.content}
                </div>
                
                {/* Clickable Images */}
                {comment.imageUrls && comment.imageUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comment.imageUrls.slice(0, 4).map((url: string, idx: number) => (
                      <Dialog key={idx}>
                        <DialogTrigger asChild>
                          <div className="cursor-pointer group relative flex-1 min-w-0 max-w-sm">
                            <img 
                              src={url} 
                              alt="attachment" 
                              className="w-full h-auto max-h-64 object-contain rounded-lg border group-hover:opacity-90 transition-opacity"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 rounded-full p-2">
                                <ImageIcon className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
                          <img 
                            src={url} 
                            alt="Full size image" 
                            className="w-full h-auto max-h-[90vh] object-contain"
                          />
                        </DialogContent>
                      </Dialog>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                <Textarea 
                  value={editContent} 
                  onChange={(e) => {
                    const value = e.target.value;
                    setEditContent(value);
                  }}
                  onFocus={(e) => {
                    e.target.style.direction = 'ltr';
                    e.target.style.textAlign = 'left';
                    e.target.style.unicodeBidi = 'plaintext';
                  }}
                  className="min-h-[70px] text-sm bg-transparent border-none resize-none" 
                  placeholder="Edit your comment..." 
                  style={{ direction: 'ltr' }}
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingComment(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" disabled={!editContent.trim()} onClick={() => handleEditComment(comment.id)}>
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* Comment Actions */}
            <div className="flex items-center gap-4 mt-1 px-2">
              <span className="text-xs text-gray-500">{formatTime(comment.createdAt)}</span>
              
              <button
                onClick={() => {
                  setReplyTo(comment);
                }}
                className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Reply
              </button>
              
              {isOwner && !isEditing && (
                <button
                  onClick={() => {
                    setEditingComment(comment.id);
                    setEditContent(comment.content);
                  }}
                  className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Edit
                </button>
              )}
              
              {canDelete && !isEditing && (
                <button
                  onClick={() => setDeleteTarget(comment)}
                  className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                >
                  Delete
                </button>
              )}
              
              {comment.isAnonymous && isAdmin && !isOwner && comment.user?.name && (
                <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600">
                  <Shield className="h-3 w-3" />{comment.user.name}
                </span>
              )}
            </div>

            {/* Reply Form */}
            {isReplying && (
              <ReplyForm
                key={comment.id}
                replyTo={comment}
                displayName={displayName}
                onSubmit={handleReplySubmit}
                onCancel={() => setReplyTo(null)}
                isSubmitting={isSubmitting}
              />
            )}

            {/* Show/Hide Replies */}
            {hasReplies && (
              <div className="mt-2 px-2">
                <button
                  onClick={() => toggleReplies(comment.id)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {isExpanded ? 'Hide' : 'Show'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </button>
              </div>
            )}

            {/* Replies */}
            {hasReplies && isExpanded && (
              <div className="mt-3 space-y-3">
                {comment.replies?.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map(reply => (
                  <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  });

  if (!user) {
    return (
      <div className="flex items-center gap-3 py-2">
        <UserRound className="h-5 w-5 text-gray-400" />
        <span className="text-gray-500 dark:text-gray-400">
          Sign in to join the discussion.
        </span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Comments Header */}
      <div className="flex items-center gap-2 mb-4 p-4 border-b border-gray-200 dark:border-gray-700">
        <MessageCircle className="h-5 w-5 text-blue-500" />
        <span className="font-semibold text-lg">Discussion</span>
        <span className="text-sm text-gray-500">({comments.length})</span>
      </div>

      {/* Comments List */}
      <div className="px-4">
        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl p-4 animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2" />
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Comments State */}
        {!isLoading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageCircle className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Aucun commentaire pour le moment
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Soyez le premier à partager vos réflexions !
            </p>
          </div>
        )}

        {/* Comments */}
        {!isLoading && comments.length > 0 && (
          <div className="py-2">
            {comments.map(comment => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        )}
        
        <div ref={commentsEndRef} />
      </div>

      {/* Fixed Comment Input at Bottom */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 mt-6">
        <div className="space-y-3">
          <div className="flex gap-3">
            {/* User Avatar */}
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
            </div>

            {/* Input Area */}
            <div className="flex-1">
              <div className="comments-ltr-override bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 min-h-[44px] flex items-start">
                <textarea
                  ref={mainTextareaRef}
                  value={newComment}
                  onChange={(e) => {
                    e.currentTarget.style.direction = 'ltr';
                    const value = e.currentTarget.value;
                    setNewComment(value);
                    
                    // Auto-resize immediately
                    autoResizeTextarea(e.currentTarget, 3, 24);
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.direction = 'ltr';
                    e.currentTarget.style.textAlign = 'left';
                    e.currentTarget.style.unicodeBidi = 'plaintext';
                    autoResizeTextarea(e.currentTarget, 3, 28);
                  }}
                  placeholder="Share your thoughts about this lecture..."
                  className="force-ltr flex-1 bg-transparent border-none outline-none resize-none text-base leading-6 placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-all duration-200 ease-in-out"
                  style={{
                    minHeight: '24px',
                    direction: 'ltr',
                    textAlign: 'left',
                    unicodeBidi: 'plaintext',
                    writingMode: 'horizontal-tb',
                    textOrientation: 'mixed',
                    overflowY: 'hidden'
                  }}
                  rows={1}
                  dir="ltr"
                  lang="en"
                  autoCorrect="off"
                  autoCapitalize="none"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              {/* Image Previews */}
              {images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {images.map((url, i) => (
                    <div key={i} className="relative group">
                      <img 
                        src={url} 
                        alt="preview" 
                        className="h-16 w-16 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      
                      const processFile = (file: File) => new Promise<string>((resolve, reject) => {
                        if (file.size > 150 * 1024) {
                          return reject(new Error('File too large (max 150KB)'));
                        }
                        const reader = new FileReader();
                        reader.onerror = () => reject(reader.error);
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                      });
                      
                      try {
                        const results = await Promise.all(files.map(processFile));
                        setImages(prev => [...prev, ...results].slice(0, 6)); // Max 6 images
                      } catch (err) {
                        toast({ title: 'Error', description: 'Failed to process images', variant: 'destructive' });
                      }
                      
                      e.target.value = '';
                    }}
                  />
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Photo
                  </button>

                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Checkbox 
                      checked={postAnon} 
                      onCheckedChange={(v) => setPostAnon(!!v)} 
                      className="h-4 w-4" 
                    />
                    Anonymous
                  </label>
                </div>
              </div>
            </div>

            {/* Send Button */}
            <Button
              size="sm"
              disabled={!newComment.trim() && images.length === 0}
              onClick={handleSubmitComment}
              className="h-10 px-4 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex-shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove the comment{deleteTarget?.replies && deleteTarget.replies.length > 0 ? ' and its replies' : ''}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              disabled={isDeleting} 
              onClick={() => deleteTarget && handleDeleteComment(deleteTarget.id)} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Isolated Reply Form Component to prevent cursor jumping
interface ReplyFormProps {
  replyTo: Comment;
  displayName: string;
  onSubmit: (content: string, isAnon: boolean, replyTo: Comment, images?: string[]) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function ReplyForm({ replyTo, displayName, onSubmit, onCancel, isSubmitting }: ReplyFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize function for reply textarea
  const autoResizeReplyTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 20 * 3; // 3 lines max for replies
    
    const newHeight = Math.min(scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  // Auto-focus on mount and initialize height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      autoResizeReplyTextarea(textareaRef.current);
    }
  }, []);

  const handleSubmit = () => {
    if (content.trim() || replyImages.length > 0) {
      onSubmit(content, isAnon, replyTo, replyImages);
      setContent('');
      setIsAnon(false);
      setReplyImages([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && (content.trim() || replyImages.length > 0)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
            {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
        </div>
        <div className="flex-1">
          <div className="comments-ltr-override bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 min-h-[40px] flex items-start">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.currentTarget.value);
                // Auto-resize immediately
                autoResizeReplyTextarea(e.currentTarget);
              }}
              onKeyDown={handleKeyDown}
              onFocus={(e) => {
                e.currentTarget.style.direction = 'ltr';
                e.currentTarget.style.textAlign = 'left';
                e.currentTarget.style.unicodeBidi = 'plaintext';
              }}
              placeholder={`Reply to ${displayName}...`}
              className="force-ltr flex-1 bg-transparent border-none outline-none resize-none text-sm leading-5 placeholder:text-gray-500 dark:placeholder:text-gray-400 transition-all duration-200 ease-in-out"
              style={{
                minHeight: '20px',
                direction: 'ltr',
                textAlign: 'left',
                unicodeBidi: 'plaintext',
                writingMode: 'horizontal-tb',
                textOrientation: 'mixed',
                overflowY: 'hidden'
              }}
              rows={1}
              dir="ltr"
              lang="en"
              autoCorrect="off"
              autoCapitalize="none"
              inputMode="text"
              autoComplete="off"
              spellCheck={false}
              disabled={isSubmitting}
            />
          </div>
          
          {/* Reply Image Previews */}
          {replyImages.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {replyImages.map((url, i) => (
                <div key={i} className="relative group">
                  <img 
                    src={url} 
                    alt="preview" 
                    className="h-16 w-16 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => setReplyImages(imgs => imgs.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-4">
              <input
                ref={replyFileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  
                  const processFile = (file: File) => new Promise<string>((resolve, reject) => {
                    if (file.size > 150 * 1024) {
                      return reject(new Error('File too large (max 150KB)'));
                    }
                    const reader = new FileReader();
                    reader.onerror = () => reject(reader.error);
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                  });
                  
                  try {
                    const results = await Promise.all(files.map(processFile));
                    setReplyImages(prev => [...prev, ...results].slice(0, 4)); // Max 4 images for replies
                  } catch (err) {
                    toast({ title: 'Error', description: 'Failed to process images', variant: 'destructive' });
                  }
                  
                  e.target.value = '';
                }}
              />
              
              <button
                type="button"
                onClick={() => replyFileInputRef.current?.click()}
                disabled={isSubmitting}
                className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <ImageIcon className="h-3 w-3" />
                Photo
              </button>
              
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Checkbox 
                  checked={isAnon} 
                  onCheckedChange={(v) => setIsAnon(!!v)} 
                  className="h-3 w-3" 
                  disabled={isSubmitting}
                />
                Post anonymously
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                disabled={(!content.trim() && replyImages.length === 0) || isSubmitting} 
                onClick={handleSubmit}
                className="bg-blue-500 hover:bg-blue-600"
              >
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reply'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
