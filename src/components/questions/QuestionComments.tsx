"use client";

import { useEffect, useMemo, useState, useRef, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Send, Loader2, UserRound, EyeOff, Heart, MoreHorizontal, Image as ImageIcon, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { RichTextInput } from '@/components/ui/rich-text-input';

interface QuestionCommentsProps {
  questionId: string;
  commentType?: 'regular' | 'clinical-case';
}

type QComment = {
  id: string;
  content: string;
  isAnonymous?: boolean;
  createdAt: string;
  updatedAt: string;
  parentCommentId?: string | null;
  replies?: QComment[];
  user: { id: string; name?: string | null; email: string; role: string; image?: string | null };
  imageUrls?: string[];
};

export function QuestionComments({ questionId, commentType = 'regular' }: QuestionCommentsProps) {
  const { user } = useAuth();
  const ownerId = user?.id;
  const isAdmin = user?.role === 'admin' || user?.role === 'maintainer';

  const [comments, setComments] = useState<QComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [postAnonymous, setPostAnonymous] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyImages, setReplyImages] = useState<any[]>([]); // Images for replies
  const [images, setImages] = useState<string[]>([]); // base64 or hosted URLs
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [lastFocusedInput, setLastFocusedInput] = useState<'main' | 'reply' | null>(null);
  const [mainInputHasContent, setMainInputHasContent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Text direction helpers: minimal processing ---
  const stripControlChars = (val: string) => val.replace(/[\u202A-\u202E\u2066-\u2069\u200E\u200F]/g, '');
  const displayText = (val: string) => stripControlChars(val);

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

  // Auto-resize function for reply textarea
  const autoResizeReplyTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const maxHeight = 20 * 3; // 3 lines max for replies
    
    const newHeight = Math.min(scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  const canPostRoot = !!ownerId && (mainInputHasContent || images.length > 0) && !submitting;



  const handleMainInputFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    setLastFocusedInput('main');
  };  const load = useMemo(() => async () => {
    try {
      setLoading(true);
      const apiEndpoint = commentType === 'clinical-case' ? '/api/clinical-case-comments' : '/api/question-comments';
      const res = await fetch(`${apiEndpoint}?questionId=${questionId}`);
      if (!res.ok) throw new Error('Failed');
      const data: QComment[] = await res.json();
      // Sanitize any stored control chars in loaded comments
      const sanitized = (data || []).map(c => ({ ...c, content: stripControlChars(c.content || '') }));
      setComments(sanitized);
    } catch {
      // silent
    } finally { setLoading(false); }
  }, [questionId, commentType]);

  useEffect(() => { load(); }, [load]);

  // Auto-expand parent comments when replying to nested comments
  useEffect(() => {
    if (replyParentId) {
      const findParentPath = (nodes: QComment[], targetId: string, path: string[] = []): string[] | null => {
        for (const node of nodes) {
          if (node.id === targetId) {
            return path;
          }
          if (node.replies) {
            const result = findParentPath(node.replies, targetId, [...path, node.id]);
            if (result) return result;
          }
        }
        return null;
      };

      const parentPath = findParentPath(comments, replyParentId);
      if (parentPath && parentPath.length > 0) {
        setExpandedReplies(prev => {
          const newSet = new Set(prev);
          parentPath.forEach(parentId => newSet.add(parentId));
          return newSet;
        });
      }
    }
  }, [replyParentId, comments]);



  const insertReply = (nodes: QComment[], parentId: string, newNode: QComment): QComment[] =>
    nodes.map(n => n.id === parentId
      ? { ...n, replies: [newNode, ...(n.replies || [])] }
      : { ...n, replies: n.replies ? insertReply(n.replies, parentId, newNode) : n.replies });

  const updateNode = (nodes: QComment[], id: string, updater: (c: QComment) => QComment): QComment[] =>
    nodes.map(n => n.id === id ? updater(n) : { ...n, replies: n.replies ? updateNode(n.replies, id, updater) : n.replies });

  const removeNode = (nodes: QComment[], id: string): QComment[] =>
    nodes.filter(n => n.id !== id).map(n => ({ ...n, replies: n.replies ? removeNode(n.replies, id) : n.replies }));

  const add = async (parentId?: string, contentOverride?: string, imageList?: string[]) => {
    if (!ownerId) { 
      toast({ title: 'Connexion requise', description: 'Veuillez vous connecter pour commenter', variant: 'destructive' }); 
      return; 
    }
    
    const contentRaw = parentId 
      ? (contentOverride || '') 
      : (textareaRef.current?.value || '');
    const content = contentRaw.trim();
    const imgs = imageList || (parentId ? replyImages.map(img => img.url) : images);
    
    if (!content && imgs.length === 0) return;
    
    try {
      setSubmitting(true);
      const apiEndpoint = commentType === 'clinical-case' ? '/api/clinical-case-comments' : '/api/question-comments';
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          userId: ownerId,
          content,
          isAnonymous: postAnonymous,
          parentCommentId: parentId,
          imageUrls: imgs
        })
      });
      
      if (!res.ok) throw new Error('Failed');
  const created: QComment = await res.json();
  created.content = stripControlChars(created.content || '');
      
      if (parentId) {
        setComments(prev => insertReply(prev, parentId, created));
        setReplyParentId(null);
        setReplyImages([]);
        // Reply input will be cleared by the ReplyComponent itself
      } else {
        setComments(prev => [created, ...prev]);
        setImages([]);
        if (textareaRef.current) {
          textareaRef.current.value = '';
          autoResizeTextarea(textareaRef.current);
          setMainInputHasContent(false);
        }
      }
    } catch { 
      toast({ title: 'Erreur', description: 'Échec de l\'ajout du commentaire', variant: 'destructive' }); 
    } finally { 
      setSubmitting(false); 
    }
  };

  const beginEdit = (c: QComment) => {
    setEditingId(c.id);
    setEditText(displayText(c.content));
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };
  
  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    try {
      const apiEndpoint = commentType === 'clinical-case' ? '/api/clinical-case-comments' : '/api/question-comments';
      const res = await fetch(`${apiEndpoint}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editText.trim(),
          imageUrls: [] // Keep existing images, don't modify them in edit mode
        })
      });
      if (!res.ok) throw new Error('Failed');
      const updated: QComment = await res.json();
      updated.content = stripControlChars(updated.content || '');
      setComments(prev => updateNode(prev, id, () => updated));
      cancelEdit();
    } catch {
      toast({ title: 'Erreur', description: 'Échec de la mise à jour du commentaire', variant: 'destructive' });
    }
  };

  const remove = async (id: string) => {
    try {
      const apiEndpoint = commentType === 'clinical-case' ? '/api/clinical-case-comments' : '/api/question-comments';
      const res = await fetch(`${apiEndpoint}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setComments(prev => removeNode(prev, id));
    } catch {
      toast({ title: 'Erreur', description: 'Échec de la suppression du commentaire', variant: 'destructive' });
    }
  };

  const startReply = (id: string) => { 
    setReplyParentId(id); 
    setReplyImages([]);
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
  
  const cancelReply = () => { 
    setReplyParentId(null); 
    setReplyImages([]);
  };

  // Helper to get user avatar/initials
  const getUserDisplay = (comment: QComment) => {
    const displayAsAnonymous = comment.isAnonymous && !isAdmin && ownerId !== comment.user.id;
    const displayName = displayAsAnonymous ? 'Anonyme' : (comment.user?.name || comment.user?.email || 'Utilisateur');
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return { displayName, initials, displayAsAnonymous };
  };

  // Format time relative to now (Facebook style)
  const formatTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    
    return date.toLocaleDateString();
  };

  // Enhanced Reply Component with Image Support
  const ReplyComponent = ({ parentId, parentUserName }: { parentId: string; parentUserName: string }) => {
    const replyInputRef = useRef<HTMLTextAreaElement>(null);
    const [replyInputHasContent, setReplyInputHasContent] = useState(false);
    
    const canPostReply = !!ownerId && (replyInputHasContent || replyImages.length > 0) && !submitting;
    
    useEffect(() => {
      if (replyInputRef.current) {
        autoResizeReplyTextarea(replyInputRef.current);
        // Only auto-focus if the user wasn't just typing in the main input
        if (lastFocusedInput !== 'main') {
          setTimeout(() => {
            if (replyInputRef.current && document.activeElement !== textareaRef.current) {
              replyInputRef.current.focus();
            }
          }, 100);
        }
      }
    }, [lastFocusedInput]);





    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setLastFocusedInput('reply');
    };    const handleSubmitReply = () => {
      const value = replyInputRef.current?.value.trim() || '';
      if (value || replyImages.length > 0) {
        add(parentId, value);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Always stop propagation for navigation-sensitive keys
      if (['Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.stopPropagation();
      }
      
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const value = replyInputRef.current?.value.trim() || '';
        if (value || replyImages.length > 0) {
          handleSubmitReply();
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelReply();
      }
    };

    return (
      <div className="flex gap-1.5 sm:gap-2 mt-3 relative">
        {/* Threading line continuation */}
        <div className="absolute -left-6 sm:-left-8 top-0 w-2 sm:w-3 h-5 border-l-2 border-b-2 border-gray-300 dark:border-gray-600 rounded-bl-lg"></div>
        
        <div className="flex-1 space-y-2 min-w-0">
        <div className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 sm:px-4 py-2 min-h-[32px] sm:min-h-[36px] flex items-center">
          <textarea
            ref={replyInputRef}
            defaultValue=""
            onInput={(e) => {
              if (replyInputRef.current) {
                autoResizeReplyTextarea(replyInputRef.current);
                setReplyInputHasContent(replyInputRef.current.value.trim().length > 0);
              }
            }}
            onFocus={(e) => {
              e.stopPropagation(); // Prevent focus events from affecting parent navigation
              handleFocus(e);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Répondre à ${parentUserName}...`}
            className="flex-1 bg-transparent border-none outline-none resize-none text-xs sm:text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400"
            style={{ 
              minHeight: '18px', 
              maxHeight: '100px',
              direction: 'ltr',
              textAlign: 'left'
            }}
            rows={1}
            dir="ltr"
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck="false"
          />
        </div>          
          {/* Reply Image Previews */}
          {replyImages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 pl-3 sm:pl-4">
              {replyImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img 
                    src={img.url} 
                    alt="preview" 
                    className="h-10 w-10 sm:h-12 sm:w-12 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => setReplyImages(imgs => imgs.filter((_, idx) => idx !== i))}
                    className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-500 text-white rounded-full w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Reply Actions */}
          <div className="flex items-center justify-between pl-4">
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                id={`reply-upload-${parentId}`}
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  
                  const processFile = (file: File) => new Promise<any>((resolve, reject) => {
                    if (file.size > 4 * 1024 * 1024) { // 4MB limit
                      return reject(new Error('File too large (max 4MB)'));
                    }
                    const reader = new FileReader();
                    reader.onerror = () => reject(reader.error);
                    reader.onload = () => resolve({
                      id: `reply-${Date.now()}-${Math.random()}`,
                      url: reader.result as string,
                      description: file.name
                    });
                    reader.readAsDataURL(file);
                  });
                  
                  try {
                    const results = await Promise.all(files.map(processFile));
                    setReplyImages(prev => [...prev, ...results].slice(0, 4)); // Max 4 images
                  } catch (err) {
                    toast({ title: 'Erreur', description: 'Échec du traitement des images', variant: 'destructive' });
                  }
                  
                  e.target.value = '';
                }}
              />
              
              <label
                htmlFor={`reply-upload-${parentId}`}
                className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <ImageIcon className="h-3 w-3" />
                <span className="hidden xs:inline">Photo</span>
              </label>

              <button
                type="button"
                onClick={cancelReply}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-3 w-3" />
                <span className="hidden xs:inline">Annuler</span>
              </button>
            </div>
          </div>
        </div>
        
        <Button
          size="sm"
          disabled={!canPostReply}
          onClick={handleSubmitReply}
          className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:rounded-lg rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white flex-shrink-0 p-0 sm:p-2 transition-all duration-200"
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  };

  // Facebook-style Comment Component  
  const CommentComponent = memo(({ comment, depth = 0 }: { comment: QComment; depth?: number }) => {
    const { displayName, initials, displayAsAnonymous } = getUserDisplay(comment);
    const isOwner = ownerId && ownerId === comment.user.id;
    const isEditing = editingId === comment.id;
    const isReplying = replyParentId === comment.id;
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
            <div className={`${isReply ? 'w-8 h-8' : 'w-10 h-10'} rounded-full overflow-hidden ${!comment.user.image || displayAsAnonymous ? 'bg-blue-500 flex items-center justify-center text-white font-semibold text-sm' : ''}`}>
              {displayAsAnonymous ? (
                <EyeOff className="h-4 w-4" />
              ) : comment.user.image ? (
                <img 
                  src={comment.user.image} 
                  alt={displayName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to initials if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `<div class="w-full h-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">${initials}</div>`;
                  }}
                />
              ) : (
                initials
              )}
            </div>
          </div>

          {/* Comment Content */}
          <div className="flex-1 min-w-0">
            {!isEditing ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 max-w-[calc(100%-2rem)]">
                <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                  {displayName}
                  {comment.isAnonymous && isAdmin && (
                    <span title="Posté anonymement">
                      <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap" dir="ltr">
                  {displayText(comment.content)}
                </div>
                
                {/* Clickable Images */}
                {comment.imageUrls && comment.imageUrls.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {comment.imageUrls.slice(0, 4).map((url: string, idx: number) => {
                      if (url.startsWith('blob:')) return null;
                      return (
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
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Modifier votre commentaire..."
                  className="w-full bg-transparent border-none outline-none resize-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                    Annuler
                  </Button>
                  <Button size="sm" disabled={!editText.trim()} onClick={() => saveEdit(comment.id)}>
                    Sauvegarder
                  </Button>
                </div>
              </div>
            )}

            {/* Comment Actions */}
            <div className="flex items-center gap-4 mt-1 px-2">
              <span className="text-xs text-gray-500">{formatTime(comment.createdAt)}</span>
              
              <button
                onClick={() => startReply(comment.id)}
                className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Répondre
              </button>
              
              {isOwner && !isEditing && (
                <button
                  onClick={() => beginEdit(comment)}
                  className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Modifier
                </button>
              )}
              
              {canDelete && !isEditing && (
                <button
                  onClick={() => remove(comment.id)}
                  className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
                >
                  Supprimer
                </button>
              )}
              
              {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                <span className="text-xs text-gray-500 italic">modifié</span>
              )}
            </div>

            {/* Reply Input */}
            {isReplying && <ReplyComponent parentId={comment.id} parentUserName={displayName} />}

            {/* View Replies Button - Show for all comments with replies */}
            {hasReplies && (
              <div className="mt-2 ml-2">
                <button
                  onClick={() => toggleReplies(comment.id)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  <div className="w-6 h-px bg-gray-400"></div>
                  <span>
                    {isExpanded ? 'Masquer' : 'Voir'} {replyCount} {replyCount === 1 ? 'réponse' : 'réponses'}
                  </span>
                </button>
              </div>
            )}

            {/* Nested Replies - Only show when expanded */}
            {hasReplies && isExpanded && (
              <div className="mt-2">
                {(comment.replies || [])
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                  .map(reply => (
                    <CommentComponent key={reply.id} comment={reply} depth={depth + 1} />
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  });

  CommentComponent.displayName = 'CommentComponent';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm mt-4" data-question-comments>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Commentaires ({comments.length})
          </span>
        </div>
      </div>

      {/* Comments List with Scrollable Area */}
      <div className="relative">
        {/* Scrollable comments area */}
        <div 
          className="max-h-96 overflow-y-auto px-4"
          style={{ minHeight: '200px' }}
        >
          {loading && (
            <div className="space-y-4 py-4">
              {[1, 2, 3].map(i => (
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

          {!loading && comments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                Aucun commentaire pour le moment
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Soyez le premier à partager vos réflexions !
              </p>
            </div>
          )}

          {!loading && comments.length > 0 && (
            <div className="py-2">
              {comments.map(comment => (
                <CommentComponent key={comment.id} comment={comment} />
              ))}
            </div>
          )}
          
          <div ref={commentsEndRef} />
        </div>

        {/* Fixed Comment Input at Bottom */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 sm:p-4">
          {ownerId ? (
            <div className="space-y-3">
              <div className="flex gap-2 sm:gap-3">
                {/* User Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-blue-500 flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                    {user?.image ? (
                      <img 
                        src={user.image} 
                        alt={user.name || user.email}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const initials = user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
                          target.parentElement!.innerHTML = initials;
                        }}
                      />
                    ) : (
                      user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'
                    )}
                  </div>
                </div>

                {/* Input Area */}
                <div className="flex-1 min-w-0">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-full px-3 sm:px-4 py-2 min-h-[36px] sm:min-h-[40px] flex items-center">
                    <textarea
                      ref={textareaRef}
                      defaultValue=""
                      onInput={(e) => {
                        if (textareaRef.current) {
                          autoResizeTextarea(textareaRef.current);
                          setMainInputHasContent(textareaRef.current.value.trim().length > 0);
                        }
                      }}
                      onFocus={(e) => {
                        e.stopPropagation(); // Prevent focus events from affecting parent navigation
                        handleMainInputFocus(e);
                      }}
                      onKeyDown={(e) => {
                        // Always stop propagation for navigation-sensitive keys
                        if (['Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                          e.stopPropagation();
                        }
                        
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          const value = textareaRef.current?.value.trim() || '';
                          if (value || images.length > 0) {
                            add();
                          }
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          if (textareaRef.current) {
                            textareaRef.current.value = '';
                            autoResizeTextarea(textareaRef.current);
                            setMainInputHasContent(false);
                          }
                          setImages([]);
                        }
                      }}
                      placeholder="Écrire un commentaire..."
                      className="flex-1 bg-transparent border-none outline-none resize-none text-xs sm:text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400"
                      style={{ 
                        minHeight: '20px', 
                        maxHeight: '100px',
                        direction: 'ltr',
                        textAlign: 'left'
                      }}
                      rows={1}
                      dir="ltr"
                      autoCorrect="off"
                      autoCapitalize="none"
                      inputMode="text"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>

                {/* Send Button */}
                <Button
                  size="sm"
                  disabled={!canPostRoot}
                  onClick={() => add()}
                  className="h-9 w-9 sm:h-10 sm:w-auto sm:px-4 sm:rounded-lg rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white flex-shrink-0 p-0 sm:p-2 transition-all duration-200"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Image Previews */}
              {images.length > 0 && (
                <div className="ml-10 sm:ml-13 flex flex-wrap gap-2">
                  {images.map((url, i) => (
                    <div key={i} className="relative group">
                      <img 
                        src={url} 
                        alt="preview" 
                        className="h-12 w-12 sm:h-16 sm:w-16 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-2 w-2 sm:h-3 sm:w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Bar */}
              <div className="ml-10 sm:ml-13 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 sm:gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      const remaining = 6 - images.length;
                      if (remaining <= 0) {
                        toast({ title: 'Limite atteinte', description: 'Maximum 6 images autorisées', variant: 'destructive' });
                        return;
                      }
                      const slice = files.slice(0, remaining);
                      
                      const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
                        if (file.size > 150 * 1024) {
                          return reject(new Error('File too large (max 150KB)'));
                        }
                        const reader = new FileReader();
                        reader.onerror = () => reject(reader.error);
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(file);
                      });
                      
                      const results: string[] = [];
                      let skipped = 0;
                      
                      for (const f of slice) {
                        try {
                          const data = await toDataUrl(f);
                          if (data.startsWith('data:image/')) {
                            results.push(data);
                          } else {
                            skipped++;
                          }
                        } catch (err) {
                          skipped++;
                          console.warn('Failed to process image:', f.name, err);
                        }
                      }
                      
                      if (results.length) {
                        setImages(prev => [...prev, ...results].slice(0, 6));
                        toast({ 
                          title: 'Images ajoutées', 
                          description: `${results.length} image(s) processed${skipped ? `, ${skipped} skipped` : ''}` 
                        });
                      } else if (skipped) {
                        toast({ 
                          title: 'Échec du téléchargement',
                          description: `${skipped} image(s) étaient trop volumineuses ou invalides`, 
                          variant: 'destructive' 
                        });
                      }
                      
                      e.target.value = '';
                    }}
                  />
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="flex items-center gap-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">Photo</span>
                  </button>

                  <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    <Checkbox 
                      checked={postAnonymous} 
                      onCheckedChange={(v) => setPostAnonymous(!!v)} 
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4" 
                    />
                    <span className="hidden xs:inline">Anonyme</span>
                    <span className="xs:hidden">Anon</span>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-2">
              <UserRound className="h-5 w-5 text-gray-400" />
              <span className="text-gray-500 dark:text-gray-400">
                Connectez-vous pour participer à la discussion.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
