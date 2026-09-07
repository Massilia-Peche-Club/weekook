import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { toast } from 'sonner';
import { usePageTiming } from '@/hooks/usePageTiming';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MessageUser {
  id: number;
  firstName: string;
  lastName: string;
  avatar: string | null;
  kookerProfileId?: number | null;
}

interface ServiceInfo {
  id: number;
  title: string;
  type: unknown;
  priceInCents: number;
  images: { url: string }[];
  kookerProfile?: {
    id: number;
    user: { firstName: string; lastName: string; avatar: string | null };
  };
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  read: boolean;
  kookerRecipientId: number | null;
  bookingId: number | null;
  serviceId: number | null;
  createdAt: string;
  sender: MessageUser;
  receiver: MessageUser;
  service?: ServiceInfo | null;
}

interface Conversation {
  user: MessageUser;
  lastMessage: Message;
  unreadCount: number;
  kookerRecipientId: number | null;
  service?: ServiceInfo | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(u: MessageUser) {
  return ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || '?';
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return d.toLocaleDateString('fr-FR', { weekday: 'short' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatFullTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function Avatar({ user, size = 44 }: { user: MessageUser; size?: number }) {
  return user.avatar ? (
    <img
      src={user.avatar}
      alt={user.firstName}
      style={{ width: size, height: size }}
      className="rounded-full object-cover flex-shrink-0"
    />
  ) : (
    <div
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="rounded-full bg-gradient-to-br from-[#c1a0fd] to-[#8b6fce] flex items-center justify-center text-white font-bold flex-shrink-0"
    >
      {initials(user)}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { user } = useAuth();
  const { refreshUnread } = useNotification();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Params URL
  const toUserId = searchParams.get('to') ? parseInt(searchParams.get('to')!, 10) : null;
  const serviceIdParam = searchParams.get('service')
    ? parseInt(searchParams.get('service')!, 10)
    : null;

  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  usePageTiming('Messages', !convLoading);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Confirmation suppression
  const [pendingDelete, setPendingDelete] = useState<
    { type: 'message'; id: number } | { type: 'conversation'; userId: number; serviceId?: number } | null
  >(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Prevent re-opening the same conversation every time conversations refreshes
  const autoOpenedForRef = useRef<string | null>(null);

  // ── Chargement conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get<Conversation[]>('/messages/conversations');
      if (res.success && res.data) setConversations(res.data);
    } catch {
      // silencieux
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── Ouvrir conversation automatiquement si ?to=userId&service=serviceId (une seule fois par toUserId)
  useEffect(() => {
    if (!toUserId) return;
    const autoOpenKey = `${toUserId}-${serviceIdParam ?? 'none'}`;
    if (autoOpenedForRef.current === autoOpenKey) return;

    // Chercher dans les conversations existantes
    if (conversations.length > 0) {
      const existing = conversations.find(c =>
        c.user.id === toUserId && (!serviceIdParam || c.service?.id === serviceIdParam)
      );
      if (existing) {
        autoOpenedForRef.current = autoOpenKey;
        openConversation(existing);
        return;
      }
    }

    // Pas de conversation existante et chargement terminé : créer un ghost avec données réelles
    if (!convLoading) {
      autoOpenedForRef.current = autoOpenKey;
      (async () => {
        // Charger les infos du service (qui contient aussi le kooker)
        let serviceData: ServiceInfo | null = null;
        if (serviceIdParam) {
          try {
            const svcRes = await api.get<any>(`/services/${serviceIdParam}`);
            if (svcRes.success && svcRes.data) {
              const s = svcRes.data;
              serviceData = {
                id: s.id,
                title: s.title,
                type: s.type,
                priceInCents: s.priceInCents,
                images: s.images || [],
                kookerProfile: s.kookerProfile ? {
                  id: s.kookerProfile.id,
                  user: {
                    firstName: s.kookerProfile.user?.firstName || '',
                    lastName: s.kookerProfile.user?.lastName || '',
                    avatar: s.kookerProfile.user?.avatar || null,
                  },
                } : undefined,
              };
            }
          } catch {
            // silencieux
          }
        }

        // Construire le user à partir des données du service ou avec l'id seul
        const ghostUser: MessageUser = serviceData?.kookerProfile
          ? {
              id: toUserId,
              firstName: serviceData.kookerProfile.user.firstName,
              lastName: serviceData.kookerProfile.user.lastName,
              avatar: serviceData.kookerProfile.user.avatar,
              kookerProfileId: serviceData.kookerProfile.id,
            }
          : { id: toUserId, firstName: '...', lastName: '', avatar: null };

        const ghost: Conversation = {
          user: ghostUser,
          lastMessage: {} as Message,
          unreadCount: 0,
          kookerRecipientId: null,
          service: serviceData,
        };
        setConversations(prev => {
          if (prev.some(c => c.user.id === toUserId && c.service?.id === serviceData?.id)) return prev;
          return [ghost, ...prev];
        });
        setActiveConv(ghost);
        setMessages([]);
      })();
    }
  }, [toUserId, serviceIdParam, conversations, convLoading]);

  // ── Scroll automatique vers le bas (dans le conteneur uniquement)
  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ── Polling messages actifs toutes les 3s
  useEffect(() => {
    if (!activeConv) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    const serviceFilter = activeConv.service?.id ? `?serviceId=${activeConv.service.id}` : '';
    const fetchMessages = async () => {
      try {
        const res = await api.get<Message[]>(`/messages/conversation/${activeConv.user.id}${serviceFilter}`);
        if (res.success && res.data) {
          setMessages(prev => {
            if (res.data!.length !== prev.length) {
              fetchConversations();
              refreshUnread();
            }
            return res.data!;
          });
        }
      } catch {
        // silencieux
      }
    };

    fetchMessages();
    pollingRef.current = setInterval(fetchMessages, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [activeConv?.user.id, activeConv?.service?.id]);

  // ── Ouvrir une conversation
  const openConversation = async (conv: Conversation) => {
    setActiveConv(conv);
    setMsgLoading(true);
    try {
      const serviceFilter = conv.service?.id ? `?serviceId=${conv.service.id}` : '';
      const res = await api.get<Message[]>(`/messages/conversation/${conv.user.id}${serviceFilter}`);
      if (res.success && res.data) setMessages(res.data);
      refreshUnread();
      fetchConversations();
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // ── Envoyer un message
  const sendMessage = async () => {
    if (!activeConv || !input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      // serviceId requis : soit depuis la conversation active, soit depuis le param URL
      const svcId = activeConv.service?.id ?? serviceIdParam;
      if (!svcId) {
        toast.error('Aucune prestation liée. Contactez le kooker depuis sa fiche.');
        setInput(content);
        setSending(false);
        return;
      }
      const body: Record<string, unknown> = {
        receiverId: activeConv.user.id,
        content,
        serviceId: svcId,
      };

      const res = await api.post<Message>('/messages', body);
      if (res.success && res.data) {
        setMessages(prev => [...prev, res.data!]);
        fetchConversations();
        refreshUnread();
      }
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de l\'envoi');
      setInput(content);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // ── Demander confirmation avant suppression
  const handleDeleteMessage = (messageId: number) => {
    setPendingDelete({ type: 'message', id: messageId });
  };

  const handleDeleteConversation = (partnerId: number, serviceId?: number) => {
    setPendingDelete({ type: 'conversation', userId: partnerId, serviceId });
  };

  // ── Confirmer et exécuter la suppression
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.type === 'message') {
        await api.delete(`/messages/${pendingDelete.id}`);
        setMessages(prev => prev.filter(m => m.id !== pendingDelete.id));
        fetchConversations();
      } else {
        const pd = pendingDelete as { type: 'conversation'; userId: number; serviceId?: number };
        const serviceFilter = pd.serviceId ? `?serviceId=${pd.serviceId}` : '';
        await api.delete(`/messages/conversation/${pd.userId}${serviceFilter}`);
        setConversations(prev => prev.filter(c =>
          !(c.user.id === pd.userId && c.service?.id === pd.serviceId)
        ));
        if (activeConv?.user.id === pd.userId && activeConv?.service?.id === pd.serviceId) setActiveConv(null);
        refreshUnread();
      }
    } catch (err: any) {
      toast.error(err?.error || 'Erreur lors de la suppression');
    } finally {
      setPendingDelete(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };


  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  document.title = 'Ma Messagerie — Weekook';

  // Prestation à la conversation active
  const activeService = activeConv?.service ?? (messages.length > 0 ? messages[0]?.service : null);

  // Liste affichée : inclure le ghost s'il n'est pas déjà dans conversations
  const displayedConversations = activeConv && !conversations.some(c => c.user.id === activeConv.user.id && c.service?.id === activeConv.service?.id)
    ? [activeConv, ...conversations]
    : conversations;

  return (
    <div className="min-h-screen bg-[#f2f4fc]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="px-4 md:px-8 lg:px-[96px] py-6">

        <h1 className="text-[24px] md:text-[28px] font-bold text-[#111125] mb-6 tracking-[-0.5px]">
          MA MESSAGERIE
        </h1>

        <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px]">

          {/* ════════ LISTE CONVERSATIONS ════════ */}
          <div className={`w-full lg:w-[340px] flex-shrink-0 bg-white rounded-[20px] border border-[#e0e0e0] shadow-sm flex flex-col overflow-hidden ${activeConv ? 'hidden lg:flex' : 'flex'}`}>

            {/* Titre colonne */}
            <div className="px-5 py-4 border-b border-[#e0e0e0] flex-shrink-0">
              <h3 className="text-[13px] font-semibold text-[#828294] uppercase tracking-wider">Liste de discussions</h3>
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto">
              {convLoading ? (
                <div className="flex flex-col gap-3 p-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-3 items-center animate-pulse">
                      <div className="w-11 h-11 rounded-full bg-[#e5e7eb] flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 bg-[#e5e7eb] rounded w-1/2" />
                        <div className="h-3 bg-[#e5e7eb] rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#f3ecff] flex items-center justify-center mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  <p className="text-[14px] font-semibold text-[#111125] mb-1">Aucune conversation</p>
                  <p className="text-[13px] text-[#6b7280]">Contactez un kooker depuis sa fiche pour démarrer une discussion.</p>
                </div>
              ) : (
                displayedConversations.map(conv => (
                  <div
                    key={`${conv.user.id}-${conv.service?.id ?? 'none'}`}
                    className={`conv-row relative flex items-center gap-3 px-4 py-3.5 border-b border-[#f0f0f0] last:border-0 transition-colors ${
                      activeConv?.user.id === conv.user.id && activeConv?.service?.id === conv.service?.id ? 'bg-[#f3ecff]' : 'hover:bg-[#fafafa]'
                    }`}
                  >
                    <button
                      onClick={() => openConversation(conv)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="relative flex-shrink-0">
                        <Avatar user={conv.user} size={44} />
                        {conv.unreadCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[14px] truncate ${conv.unreadCount > 0 ? 'font-bold text-[#111125]' : 'font-semibold text-[#111125]'}`}>
                            {conv.user.firstName} {conv.user.lastName}
                          </span>
                          <span className="text-[11px] text-[#9ca3af] flex-shrink-0">
                            {conv.lastMessage?.createdAt ? formatTime(conv.lastMessage.createdAt) : ''}
                          </span>
                        </div>
                        {conv.service?.title && (
                          <p className="text-[12px] text-[#c1a0fd] truncate mt-0.5">{conv.service.title}</p>
                        )}
                        <p className={`text-[13px] truncate mt-0.5 ${conv.unreadCount > 0 ? 'font-medium text-[#374151]' : 'text-[#6b7280]'}`}>
                          {conv.lastMessage?.content || ''}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="min-w-[20px] h-[20px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteConversation(conv.user.id, conv.service?.id); }}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#ef4444]"
                      title="Supprimer la conversation"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ════════ ZONE CHAT ════════ */}
          <div className={`flex-1 bg-white rounded-[20px] border border-[#e0e0e0] shadow-sm flex flex-col overflow-hidden ${activeConv ? 'flex' : 'hidden lg:flex'}`}>

            {/* Titre colonne */}
            <div className="px-5 py-4 border-b border-[#e0e0e0] flex-shrink-0">
              <h3 className="text-[13px] font-semibold text-[#828294] uppercase tracking-wider">Détail</h3>
            </div>

            {activeConv ? (
              <>
                {/* Bouton retour mobile */}
                <div className="lg:hidden px-5 py-2 border-b border-[#e0e0e0] flex-shrink-0">
                  <button
                    onClick={() => setActiveConv(null)}
                    className="flex items-center gap-2 text-[13px] text-[#c1a0fd] font-semibold"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c1a0fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 18l-6-6 6-6"/>
                    </svg>
                    Retour
                  </button>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
                  {msgLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-[#c1a0fd] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                      <div className="w-14 h-14 rounded-full bg-[#f3ecff] flex items-center justify-center mb-4">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </div>
                      <p className="text-[14px] font-semibold text-[#111125] mb-1">Démarrez la conversation</p>
                      <p className="text-[13px] text-[#6b7280]">Envoyez un premier message à {activeConv.user.firstName}</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => {
                        const isMe = msg.senderId === user?.id;
                        const showDate =
                          idx === 0 ||
                          new Date(msg.createdAt).toDateString() !==
                            new Date(messages[idx - 1].createdAt).toDateString();
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center gap-3 my-3">
                                <div className="flex-1 h-px bg-[#e5e7eb]" />
                                <span className="text-[11px] text-[#9ca3af] whitespace-nowrap">
                                  {new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                                    weekday: 'long', day: 'numeric', month: 'long',
                                  })}
                                </span>
                                <div className="flex-1 h-px bg-[#e5e7eb]" />
                              </div>
                            )}
                            <div className={`msg-row flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                              {!isMe && (
                                <div
                                  className={activeConv.user.kookerProfileId ? 'cursor-pointer flex-shrink-0' : 'flex-shrink-0'}
                                  onClick={() => activeConv.user.kookerProfileId && navigate(`/kooker/${activeConv.user.kookerProfileId}`)}
                                >
                                  <Avatar user={msg.sender} size={28} />
                                </div>
                              )}
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#fee2e2] text-[#9ca3af] hover:text-[#ef4444] mb-5"
                                title="Supprimer"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                              <div className="max-w-[70%]">
                                <div className={`px-4 py-2.5 rounded-[16px] text-[14px] leading-relaxed ${
                                  isMe
                                    ? 'bg-[#c1a0fd] text-white rounded-br-[4px]'
                                    : 'bg-[#f3f4f6] text-[#111125] rounded-bl-[4px]'
                                }`}>
                                  {msg.content}
                                </div>
                                {msg.bookingId && (
                                  <div className={`mt-1.5 ${isMe ? 'flex justify-end' : 'flex justify-start'}`}>
                                    <button
                                      onClick={() => navigate(`/reservation/${msg.bookingId}`)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#c1a0fd] text-[#c1a0fd] text-[12px] font-semibold rounded-[10px] hover:bg-[#f3ecff] transition-colors"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                      </svg>
                                      Voir la réservation
                                    </button>
                                  </div>
                                )}
                                <p className={`text-[10px] text-[#9ca3af] mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
                                  {formatFullTime(msg.createdAt)}
                                  {isMe && <span className="ml-1">{msg.read ? '✓✓' : '✓'}</span>}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Input */}
                <div className="px-5 py-4 border-t border-[#e0e0e0] flex-shrink-0">
                  <div className="flex items-end gap-3">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Écrivez un message... (Entrée pour envoyer)"
                      rows={1}
                      className="flex-1 resize-none bg-[#f3f4f6] rounded-[12px] px-4 py-3 text-[14px] text-[#111125] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c1a0fd] max-h-[120px] overflow-y-auto"
                      style={{ minHeight: '44px' }}
                      onInput={e => {
                        const t = e.target as HTMLTextAreaElement;
                        t.style.height = 'auto';
                        t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                      }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      className="w-[44px] h-[44px] bg-[#c1a0fd] hover:bg-[#b090ed] disabled:opacity-40 rounded-[12px] flex items-center justify-center transition-all flex-shrink-0"
                      aria-label="Envoyer"
                    >
                      {sending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9ca3af] mt-1.5">Shift+Entrée pour un saut de ligne</p>
                </div>
              </>
            ) : (
              /* Placeholder — aucune conversation sélectionnée */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full bg-[#f3ecff] flex items-center justify-center mb-5">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <h2 className="text-[18px] font-bold text-[#111125] mb-2">Vos messages</h2>
                <p className="text-[14px] text-[#6b7280] max-w-[300px] leading-relaxed">
                  Vos messages apparaîtront ici. Contactez un kooker depuis une prestation pour démarrer.
                </p>
                <button
                  onClick={() => navigate('/recherche')}
                  className="mt-6 px-5 py-2.5 bg-[#c1a0fd] text-white font-semibold text-[14px] rounded-[12px] hover:bg-[#b090ed] transition-all"
                >
                  Trouver un kooker
                </button>
              </div>
            )}
          </div>

          {/* ════════ PANEL PRESTATION (3ème colonne) ════════ */}
          <div className="hidden xl:flex w-[300px] flex-shrink-0 bg-white rounded-[20px] border border-[#e0e0e0] shadow-sm flex-col overflow-hidden">

            {/* Titre colonne — toujours visible */}
            <div className="px-5 py-4 border-b border-[#e0e0e0] flex-shrink-0">
              <h3 className="text-[13px] font-semibold text-[#828294] uppercase tracking-wider">Prestation</h3>
            </div>

            {activeService ? (
              <div className="p-5 flex flex-col flex-1 overflow-y-auto">

                {/* Image */}
                {activeService.images?.[0]?.url && (
                  <div
                    className="w-full h-[160px] rounded-[12px] overflow-hidden mb-4 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => activeService.kookerProfile && navigate(`/kooker/${activeService.kookerProfile.id}`)}
                  >
                    <img
                      src={activeService.images[0].url}
                      alt={activeService.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Titre + type badge */}
                <h4
                  className="text-[16px] font-semibold text-[#111125] mb-2 cursor-pointer hover:text-[#c1a0fd] transition-colors"
                  onClick={() => activeService.kookerProfile && navigate(`/kooker/${activeService.kookerProfile.id}`)}
                >{activeService.title}</h4>
                <div className="flex items-center gap-2 mb-4">
                  {(() => {
                    const typeArr = Array.isArray(activeService.type) ? activeService.type : [activeService.type];
                    const isKours = typeArr.some((t: unknown) => String(t).includes('COURS'));
                    const isKook = typeArr.some((t: unknown) => String(t).includes('KOOK'));
                    return (
                      <>
                        {isKours && <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#c1a0fd] text-white">KOURS</span>}
                        {isKook && <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#7c5cbf] text-white">KOOK</span>}
                      </>
                    );
                  })()}
                </div>

                {/* Prix */}
                <div className="flex items-center gap-2 mb-4">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="#111125" strokeWidth="1.2"/>
                    <path d="M1.5 6.5H14.5" stroke="#111125" strokeWidth="1.2"/>
                  </svg>
                  <span className="text-[16px] font-bold text-[#111125]">
                    {(activeService.priceInCents / 100).toFixed(2).replace('.', ',')} EUR
                  </span>
                </div>

                {/* Kooker info */}
                {activeService.kookerProfile && (
                  <div className="border-t border-[#e0e2ef] pt-4 mt-auto">
                    <p className="text-[12px] text-[#828294] mb-2">Kooker</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#ece2fe] flex items-center justify-center flex-shrink-0">
                        {activeService.kookerProfile.user.avatar ? (
                          <img src={activeService.kookerProfile.user.avatar} className="w-10 h-10 rounded-full object-cover" alt="" />
                        ) : (
                          <span className="text-[#c1a0fd] font-bold text-[14px]">
                            {activeService.kookerProfile.user.firstName?.[0]}{activeService.kookerProfile.user.lastName?.[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#111125]">
                          {activeService.kookerProfile.user.firstName} {activeService.kookerProfile.user.lastName}
                        </p>
                        <button
                          onClick={() => navigate(`/kooker/${activeService.kookerProfile!.id}`)}
                          className="text-[12px] text-[#c1a0fd] hover:underline"
                        >
                          Voir le profil
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <div className="w-14 h-14 rounded-full bg-[#f3ecff] flex items-center justify-center mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c1a0fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <p className="text-[13px] text-[#828294]">Sélectionnez une conversation pour voir la prestation associée</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ════════ MODAL CONFIRMATION SUPPRESSION ════════ */}
      {pendingDelete && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[20px] p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[#fee2e2] mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3 className="text-[17px] font-bold text-[#111125] text-center mb-2">
              {pendingDelete.type === 'message' ? 'Supprimer ce message ?' : 'Supprimer cette conversation ?'}
            </h3>
            <p className="text-[13px] text-[#6b7280] text-center mb-6">
              {pendingDelete.type === 'message'
                ? 'Ce message sera définitivement supprimé.'
                : 'Tous les messages de cette conversation seront définitivement supprimés.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                className="flex-1 py-2.5 rounded-[12px] border border-[#e5e7eb] text-[14px] font-semibold text-[#374151] hover:bg-[#f9fafb] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 rounded-[12px] bg-[#ef4444] text-white text-[14px] font-semibold hover:bg-[#dc2626] transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
