"use client";

import { io, type Socket } from "socket.io-client";
import {
  Bell, ChevronDown, ChevronLeft, CircleDot, Headphones, MoreVertical, Phone, Video,
  Search, Send, Volume2, VolumeX, Paperclip, Smile
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError, apiRequest, type AuthMeResponse } from "@/lib/api";

type InboxVisitor = {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  currentPageUrl: string | null;
  referrer: string | null;
  browser: string | null;
  operatingSystem: string | null;
  country?: string | null;
  customAttributes?: Record<string, unknown>;
};
type InboxWebsite = { name: string; domain: string };
type InboxConversation = {
  id: string;
  visitorId: string;
  assignedAgentId: string | null;
  tags: string[];
  status: "open" | "pending" | "resolved";
  priority: "low" | "normal" | "high" | "urgent";
  subject: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  visitorUnreadCount: number;
  agentUnreadCount: number;
  visitor?: InboxVisitor | null;
  website?: InboxWebsite | null;
};
type InboxMessage = {
  id?: string;
  clientMessageId?: string;
  senderType: "visitor" | "agent" | "system";
  body: string;
  createdAt: string;
  status?: "sending" | "sent" | "failed";
};
type MemberOption = { userId: string | null; name: string; email: string; role: string; status: string };
type CannedReply = { id: string; title: string; shortcut: string; body: string };
type InternalNote = { id: string; body: string; createdAt: string; author: string };
type Filter = "all" | "unassigned" | "mine" | "open" | "pending" | "resolved" | "unread";
type SocketAck<T = unknown> = { ok: true; data?: T } | { ok: false; error?: { message?: string } };

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

function mergeMessages(current: InboxMessage[], incoming: InboxMessage[]): InboxMessage[] {
  const merged = new Map<string, InboxMessage>();
  for (const message of current) {
    merged.set(message.id ?? message.clientMessageId ?? `${message.createdAt}:${message.body}`, message);
  }
  for (const message of incoming) {
    const matching = message.clientMessageId
      ? [...merged.entries()].find(([, item]) => item.clientMessageId === message.clientMessageId)?.[0]
      : undefined;
    const key = matching ?? message.id ?? message.clientMessageId ?? `${message.createdAt}:${message.body}`;
    merged.set(key, { ...merged.get(key), ...message, status: "sent" });
  }
  return [...merged.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function formatTime(value: string): string {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function visitorLabel(visitor?: InboxVisitor | null): string {
  return visitor?.displayName?.trim() || visitor?.email || "Website visitor";
}

function safePath(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return "Open visitor page";
  }
}

function getAvatarColor(name: string): string {
  const colors = [
    'from-indigo-500 to-indigo-600',
    'from-purple-500 to-purple-600',
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-orange-500 to-orange-600',
    'from-rose-500 to-rose-600',
    'from-cyan-500 to-cyan-600',
    'from-pink-500 to-pink-600'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }
  return colors[Math.abs(hash) % colors.length];
}

function extractDomain(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function getWebsiteDisplay(conversation: InboxConversation): string {
  return 'from ' + (conversation.website?.name || extractDomain(conversation.visitor?.currentPageUrl) || 'website');
}

export function InboxPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [role, setRole] = useState("");
  const [workspaceRoles, setWorkspaceRoles] = useState<Record<string, string>>({});
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [agentFilter, setAgentFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [conversationReady, setConversationReady] = useState(false);
  const [socketStatus, setSocketStatus] = useState("Connecting…");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [visitorOnline, setVisitorOnline] = useState(false);
  const [visitorRead, setVisitorRead] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "thread" | "details">("list");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showCannedReplies, setShowCannedReplies] = useState(false);
  const [priorConversations, setPriorConversations] = useState<InboxConversation[]>([]);
  const [visitorDetails, setVisitorDetails] = useState<InboxVisitor | null>(null);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [detailsTab, setDetailsTab] = useState<"visitor" | "notes">("visitor");
  const [tagDraft, setTagDraft] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const selectedRef = useRef("");
  const refreshRef = useRef<() => void>(() => undefined);
  const cursorRef = useRef("");
  const historyRef = useRef<HTMLDivElement>(null);
  const visitorTypingTimeoutRef = useRef<number | undefined>(undefined);
  const agentTypingTimeoutRef = useRef<number | undefined>(undefined);
  const agentIsTypingRef = useRef(false);
  const soundEnabledRef = useRef(soundEnabled);
  const notificationsEnabledRef = useRef(notificationsEnabled);

  selectedRef.current = selectedId;
  soundEnabledRef.current = soundEnabled;
  notificationsEnabledRef.current = notificationsEnabled;

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "31" });
    if (filter === "unassigned") params.set("assignment", "unassigned");
    if (filter === "mine") params.set("assignment", "mine");
    if (filter === "unread") params.set("unread", "true");
    if (agentFilter === "__unassigned") params.set("assignment", "unassigned");
    else if (agentFilter) params.set("assignedAgentId", agentFilter);
    if (filter === "open" || filter === "pending" || filter === "resolved") params.set("status", filter);
    if (search) params.set("search", search);
    return params.toString();
  }, [agentFilter, filter, search]);

  const loadConversations = useCallback(async (append = false) => {
    if (!workspaceId) return;
    if (append && !cursorRef.current) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams(query);
      if (append) params.set("before", cursorRef.current);
      const result = await apiRequest<{ conversations: InboxConversation[] }>(
        `/workspaces/${workspaceId}/conversations?${params.toString()}`
      );
      const page = result.conversations;
      setHasMore(page.length === 31);
      const visiblePage = append ? page : page.slice(0, 30);
      if (append) {
        setConversations((current) => {
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...visiblePage.filter((item) => !seen.has(item.id))];
        });
      } else {
        setConversations(visiblePage);
        const nextCursor = visiblePage.length ? visiblePage[visiblePage.length - 1].lastMessageAt : "";
        cursorRef.current = nextCursor;
        setSelectedId((current) =>
          current && visiblePage.some((item) => item.id === current) ? current : visiblePage[0]?.id ?? ""
        );
      }
      if (append && visiblePage.length) {
        const nextCursor = visiblePage[visiblePage.length - 1].lastMessageAt;
        cursorRef.current = nextCursor;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load conversations.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, workspaceId]);

  refreshRef.current = () => { void loadConversations(); };

  const selectedVisitorId = conversations.find((item) => item.id === selectedId)?.visitorId;

  useEffect(() => {
    let active = true;
    void apiRequest<AuthMeResponse>("/auth/me").then((auth) => {
      if (!active) return;
      const saved = window.localStorage.getItem("relay-chat-workspace");
      const entry = auth.workspaces.find((item) => item.workspace?.id === saved) ?? auth.workspaces[0];
      if (!entry?.workspace?.id) {
        setError("Choose or create a workspace before opening the inbox.");
        setLoading(false);
        return;
      }
      setWorkspaceId(entry.workspace.id);
      setCurrentUserId(auth.user.id);
      setRole(entry.role);
      setWorkspaceRoles(Object.fromEntries(auth.workspaces.flatMap((item) =>
        item.workspace ? [[item.workspace.id, item.role]] : []
      )));
      setSoundEnabled(window.localStorage.getItem("relay-inbox-sound") === "true");
      setNotificationsEnabled(window.localStorage.getItem("relay-inbox-notifications") === "true");
    }).catch((cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) return;
      setError(cause instanceof Error ? cause.message : "Unable to load your account.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onWorkspaceChange = (event: Event) => {
      const nextWorkspaceId = (event as CustomEvent<string>).detail;
      if (typeof nextWorkspaceId !== "string") return;
      setWorkspaceId(nextWorkspaceId);
      setRole(workspaceRoles[nextWorkspaceId] ?? "");
    };
    window.addEventListener("relay-workspace-change", onWorkspaceChange);
    return () => window.removeEventListener("relay-workspace-change", onWorkspaceChange);
  }, [workspaceRoles]);

  useEffect(() => {
    if (!workspaceId) return;
    void loadConversations();
  }, [loadConversations, workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    void Promise.all([
      apiRequest<{ members: MemberOption[] }>(`/workspaces/${workspaceId}/members`),
      apiRequest<{ replies: CannedReply[] }>(`/workspaces/${workspaceId}/canned-replies`)
    ]).then(([memberResult, replyResult]) => {
      setMembers(memberResult.members.filter((member) => member.status === "active"));
      setCannedReplies(replyResult.replies);
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Unable to load inbox tools.");
    });
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    const socket = io(apiUrl, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10_000
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setSocketStatus("Connected");
      socket.emit("inbox:join", { workspaceId }, (ack: SocketAck) => {
        if (!ack.ok) setError(ack.error?.message ?? "Unable to join the workspace inbox.");
      });
      refreshRef.current();
    });
    socket.on("disconnect", () => {
      setSocketStatus("Reconnecting…");
      setConversationReady(false);
    });
    socket.on("connect_error", () => setSocketStatus("Offline"));
    const upsert = (incoming: Partial<InboxConversation> & { id: string }) => {
      setConversations((current) => {
        const existing = current.find((item) => item.id === incoming.id);
        const merged = { ...existing, ...incoming } as InboxConversation;
        return [merged, ...current.filter((item) => item.id !== incoming.id)]
          .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
      });
    };
    socket.on("conversation:created", (item: InboxConversation) => { upsert(item); refreshRef.current(); });
    socket.on("conversation:updated", upsert);
    socket.on("conversation:assigned", upsert);
    socket.on("conversation:message", (message: InboxMessage & { conversationId?: string }) => {
      const id = message.conversationId ?? selectedRef.current;
      if (id === selectedRef.current) {
        setMessages((current) => mergeMessages(current, [message]));
        if (message.senderType === "visitor") setVisitorRead(false);
      }
      
      // Play sound and show notification for visitor messages
      if (message.senderType === "visitor") {
        if (soundEnabledRef.current) {
          try {
            const AudioContextClass = window.AudioContext;
            const audio = new AudioContextClass();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = 660;
            gain.gain.value = 0.035;
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.12);
            oscillator.onended = () => void audio.close();
          } catch {
            // Silently fail - sound is optional
          }
        }
        
        // Show browser notification only when window not focused
        if (notificationsEnabledRef.current && !document.hasFocus() && "Notification" in window && Notification.permission === "granted") {
          new Notification("New visitor message", { 
            body: message.body.slice(0, 120),
            icon: "/favicon.ico"
          });
        }
      }
      refreshRef.current();
    });
    socket.on("unread:update", (unread: {
      conversationId: string; visitorUnreadCount: number; agentUnreadCount: number
    }) => {
      setConversations((current) => current.map((item) => item.id === unread.conversationId
        ? { ...item, visitorUnreadCount: unread.visitorUnreadCount, agentUnreadCount: unread.agentUnreadCount }
        : item));
    });
    socket.on("conversation:typing", (payload: { senderType: "visitor" | "agent"; isTyping: boolean }) => {
      if (payload.senderType !== "visitor") return;
      setTyping(payload.isTyping);
      if (visitorTypingTimeoutRef.current) window.clearTimeout(visitorTypingTimeoutRef.current);
      if (payload.isTyping) visitorTypingTimeoutRef.current = window.setTimeout(() => setTyping(false), 3000);
    });
    socket.on("conversation:read", (payload: { readerType: "visitor" | "agent" }) => {
      if (payload.readerType === "visitor") setVisitorRead(true);
    });
    socket.on("visitor:presence", (payload: { online: boolean }) => setVisitorOnline(payload.online));
    socket.on("conversation:resolved", () => {
      const id = selectedRef.current;
      setConversations((current) => current.map((item) => item.id === id ? { ...item, status: "resolved" } : item));
    });
    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [workspaceId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!workspaceId || !selectedId || !socket?.connected) {
      setConversationReady(false);
      setMessages([]);
      setVisitorDetails(null);
      setPriorConversations([]);
      setNotes([]);
      setDetailsTab("visitor");
      return;
    }
    let active = true;
    setConversationReady(false);
    setMessages([]);
    setVisitorDetails(null);
    setPriorConversations([]);
    socket.emit("conversation:join", { workspaceId, conversationId: selectedId },
      (ack: SocketAck<{ messages: InboxMessage[] }>) => {
        if (!active) return;
        if (!ack.ok) {
          setError(ack.error?.message ?? "Unable to open this conversation.");
          return;
        }
        setMessages(mergeMessages([], ack.data?.messages ?? []));
        setConversationReady(true);
        setError("");
        socket.emit("conversation:read", { workspaceId, conversationId: selectedId });
        socket.emit("visitor:details", { workspaceId, conversationId: selectedId },
          (detailsAck: SocketAck<InboxVisitor>) => {
            if (active && detailsAck.ok && detailsAck.data) setVisitorDetails(detailsAck.data);
          });
      });
    if (selectedVisitorId) {
      const params = new URLSearchParams({ visitorId: selectedVisitorId, limit: "20" });
      void apiRequest<{ conversations: InboxConversation[] }>(
        `/workspaces/${workspaceId}/conversations?${params.toString()}`
      ).then((result) => {
        if (active) setPriorConversations(result.conversations.filter((item) => item.id !== selectedId));
      }).catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load conversation history.");
      });
    }
    void apiRequest<{ notes: InternalNote[] }>(
      `/workspaces/${workspaceId}/conversations/${selectedId}/notes`
    ).then((result) => {
      if (active) setNotes(result.notes);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load internal notes.");
    });
    setMobileView("thread");
    return () => { active = false; };
  }, [selectedId, selectedVisitorId, socketStatus, workspaceId]);

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [messages.length, selectedId]);

  const selected = conversations.find((item) => item.id === selectedId);
  const details = visitorDetails ?? selected?.visitor ?? null;
  const assignable = role === "owner" || role === "admin" || role === "supervisor";

  function updateConversation(changes: Record<string, unknown>) {
    const socket = socketRef.current;
    if (!socket?.connected || !workspaceId || !selectedId) return;
    socket.emit("conversation:update", { workspaceId, conversationId: selectedId, ...changes },
      (ack: SocketAck<{ conversation: InboxConversation }>) => {
        if (!ack.ok) setError(ack.error?.message ?? "Unable to update the conversation.");
        else if (ack.data?.conversation) {
          setConversations((current) => current.map((item) =>
            item.id === selectedId ? { ...item, ...ack.data?.conversation } : item
          ));
        }
      });
  }

  function assignConversation(agentId: string) {
    const socket = socketRef.current;
    if (!socket?.connected || !workspaceId || !selectedId) return;
    socket.emit("conversation:assign", {
      workspaceId,
      conversationId: selectedId,
      assignedAgentId: agentId || null
    }, (ack: SocketAck<{ conversation: InboxConversation }>) => {
      if (!ack.ok) setError(ack.error?.message ?? "Unable to reassign conversation.");
      else if (ack.data?.conversation) {
        setConversations((current) => current.map((item) =>
          item.id === selectedId ? { ...item, ...ack.data?.conversation } : item
        ));
      }
    });
  }

  function sendMessage(event?: FormEvent<HTMLFormElement>, retry?: InboxMessage) {
    event?.preventDefault();
    const body = (retry?.body ?? draft).trim();
    if (!body || !selected || !conversationReady) return;
    setAgentTyping(false);
    const clientMessageId = retry?.clientMessageId ?? crypto.randomUUID();
    const optimistic: InboxMessage = {
      id: retry?.id,
      clientMessageId,
      senderType: "agent",
      body,
      createdAt: retry?.createdAt ?? new Date().toISOString(),
      status: "sending"
    };
    setMessages((current) => mergeMessages(current, [optimistic]));
    setDraft("");
    const socket = socketRef.current;
    if (!socket?.connected) {
      setMessages((current) => current.map((item) =>
        item.clientMessageId === clientMessageId ? { ...item, status: "failed" } : item
      ));
      setError("The inbox is disconnected. Reconnect before retrying this message.");
      return;
    }

    socket.timeout(8_000).emit("message:send", {
      workspaceId, conversationId: selected.id, clientMessageId, body
    }, (timeoutError: Error | null, ack: SocketAck<{ message: InboxMessage }>) => {
      if (timeoutError || !ack.ok || !ack.data?.message) {
        const acknowledgementError = ack.ok ? undefined : ack.error?.message;
        setMessages((current) => current.map((item) =>
          item.clientMessageId === clientMessageId ? { ...item, status: "failed" } : item
        ));
        setError(timeoutError ? "Message delivery timed out. Retry safely with the same message key." :
          acknowledgementError ?? "Unable to send this message.");
        return;
      }
      const deliveredMessage = ack.data.message;
      setMessages((current) => mergeMessages(current, [deliveredMessage]));
      setVisitorRead(false);
      setError("");
    });
  }

  async function submitInternalNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = noteDraft.trim();
    if (!body || !selected || noteBusy) return;
    setNoteBusy(true);
    try {
      const result = await apiRequest<{ note: InternalNote }>(
        `/workspaces/${workspaceId}/conversations/${selected.id}/notes`,
        { method: "POST", body: JSON.stringify({ body }) }
      );
      setNotes((current) => [...current, result.note]);
      setNoteDraft("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save internal note.");
    } finally {
      setNoteBusy(false);
    }
  }

  async function loadOlderMessages() {
    if (!selected || !messages.length) return;
    const before = messages[0].createdAt;
    try {
      const result = await apiRequest<{ messages: InboxMessage[] }>(
        `/workspaces/${workspaceId}/conversations/${selected.id}/messages?before=${encodeURIComponent(before)}&limit=50`
      );
      setMessages((current) => mergeMessages(result.messages, current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load older messages.");
    }
  }

  function toggleSound() {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled);
    window.localStorage.setItem("relay-inbox-sound", String(enabled));
  }

  function setAgentTyping(isTyping: boolean) {
    if (!selectedId || !workspaceId) return;
    if (isTyping) {
      if (!agentIsTypingRef.current) {
        socketRef.current?.emit("typing:set", { workspaceId, conversationId: selectedId, isTyping: true });
        agentIsTypingRef.current = true;
      }
      if (agentTypingTimeoutRef.current) window.clearTimeout(agentTypingTimeoutRef.current);
      agentTypingTimeoutRef.current = window.setTimeout(() => {
        socketRef.current?.emit("typing:set", { workspaceId, conversationId: selectedId, isTyping: false });
        agentIsTypingRef.current = false;
      }, 1200);
    } else if (agentIsTypingRef.current) {
      if (agentTypingTimeoutRef.current) window.clearTimeout(agentTypingTimeoutRef.current);
      socketRef.current?.emit("typing:set", { workspaceId, conversationId: selectedId, isTyping: false });
      agentIsTypingRef.current = false;
    }
  }

  async function toggleNotifications() {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      window.localStorage.setItem("relay-inbox-notifications", "false");
      return;
    }
    if (!("Notification" in window)) {
      setError("This browser does not support desktop notifications.");
      return;
    }
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== "granted") {
      setError("Desktop notification permission was not granted.");
      return;
    }
    setNotificationsEnabled(true);
    window.localStorage.setItem("relay-inbox-notifications", "true");
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" }, { id: "unassigned", label: "Unassigned" },
    { id: "mine", label: "My conversations" }, { id: "open", label: "Open" },
    { id: "pending", label: "Pending" }, { id: "resolved", label: "Resolved" },
    { id: "unread", label: "Unread" }
  ];

  return <section className="min-w-0">
    {error ? <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <div className="grid min-h-[min(720px,calc(100dvh-140px))] overflow-hidden rounded-lg border border-slate-200/60 bg-white shadow-xl lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside aria-label="Conversation list" className={`${mobileView === "list" ? "flex" : "hidden"} h-full min-h-[560px] flex-col border-r border-slate-200/60 bg-gradient-to-b from-slate-50/50 to-white lg:flex`}>
        <div className="flex-none border-b border-slate-200/60 bg-white px-4 py-3.5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-800 mb-3">Inbox</h2>
          <label className="sr-only" htmlFor="inbox-search">Search conversations</label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 shadow-sm transition-all duration-200 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100"><Search size={16} className="text-slate-400" /><input id="inbox-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search conversations..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" /></div>
        </div>
        
        <div className="flex-none border-b border-slate-200/60 px-3 py-2.5 bg-white">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFilter("all")} aria-pressed={filter === "all"} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${filter === "all" ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"}`}>All</button>
            <button type="button" onClick={() => setFilter("unread")} aria-pressed={filter === "unread"} className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${filter === "unread" ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"}`}>Unread {conversations.filter((c) => c.agentUnreadCount > 0).length > 0 ? <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filter === "unread" ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700"}`}>{conversations.filter((c) => c.agentUnreadCount > 0).length}</span> : null}</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? <p role="status" className="p-4 text-sm text-slate-500">Loading conversations…</p>
            : conversations.length === 0 ? <p className="p-4 text-sm text-slate-500">No conversations match this view.</p>
            : conversations.map((conversation) => {
              const visitorName = visitorLabel(conversation.visitor);
              const avatarColor = getAvatarColor(visitorName);
              const avatarInitial = visitorName.charAt(0).toUpperCase();
              const isActive = selectedId === conversation.id;
              
              return <button key={conversation.id} type="button" onClick={() => { setSelectedId(conversation.id); setMobileView("thread"); setShowDetails(false); }} aria-current={isActive ? "true" : undefined} className={`relative w-full border-b border-slate-100 p-3 text-left transition-all duration-200 ${isActive ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-l-2 border-l-blue-600" : "hover:bg-slate-50"}`}>
                <div className="flex gap-3">
                  <div className="relative flex-none">
                    <div className={`size-11 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-semibold shadow-md transition-all duration-200 ${isActive ? "ring-2 ring-blue-200 ring-offset-1" : ""}`}>
                      {avatarInitial}
                    </div>
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 ring-2 ring-white shadow-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900 truncate">{visitorName}</span>
                      <time className="text-[11px] text-slate-500 flex-shrink-0 font-medium">{formatTime(conversation.lastMessageAt)}</time>
                    </div>
                    {conversation.visitor?.currentPageUrl && (
                      <div className="text-[11px] text-slate-500 truncate mb-1">
                        from {conversation.visitor.currentPageUrl}
                      </div>
                    )}
                    <div className="text-[13px] text-slate-600 line-clamp-2 leading-snug">
                      {conversation.lastMessagePreview || "No messages yet"}
                    </div>
                    {conversation.agentUnreadCount > 0 ? <span className="absolute right-3 bottom-3 size-5 min-w-5 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[10px] font-bold flex items-center justify-center shadow-md">{conversation.agentUnreadCount}</span> : null}
                  </div>
                </div>
              </button>;
            })}
          {hasMore ? <button type="button" onClick={() => void loadConversations(true)} disabled={loadingMore} className="w-full p-3 text-xs font-medium text-blue-600 hover:text-blue-700 transition-all duration-200 disabled:opacity-50 hover:bg-blue-50">{loadingMore ? "Loading…" : "Load older conversations"}</button> : null}
        </div>
      </aside>

      <div className={`${mobileView === "thread" ? "flex" : "hidden"} min-h-[560px] min-w-0 flex-col bg-white lg:flex`}>
        {selected ? <>
          <header className="flex items-center justify-between gap-3 border-b border-slate-200/60 bg-gradient-to-r from-white to-slate-50/30 px-4 py-3.5 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileView("list")} aria-label="Back to conversations" className="rounded-lg p-1.5 hover:bg-white transition-all duration-200 lg:hidden"><ChevronLeft size={18} /></button>
              <div className="relative">
                <div className={`size-10 rounded-full bg-gradient-to-br ${getAvatarColor(visitorLabel(selected.visitor))} flex items-center justify-center text-white font-semibold shadow-md ring-2 ring-white`}>
                  {visitorLabel(selected.visitor).charAt(0).toUpperCase()}
                </div>
                {visitorOnline && <span className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 ring-2 ring-white shadow-sm" />}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-slate-900">{selected.subject || visitorLabel(selected.visitor)}</h2>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`size-1.5 rounded-full ${visitorOnline ? "bg-green-500" : "bg-slate-400"}`} />
                  {visitorOnline ? "Online" : "Offline"} <span className="text-slate-300">•</span> <span className="capitalize font-medium">{selected.status}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                type="button" 
                onClick={toggleSound}
                aria-label={soundEnabled ? "Disable notification sound" : "Enable notification sound"}
                title={soundEnabled ? "Sound enabled" : "Sound disabled"}
                className={`flex size-9 items-center justify-center rounded-lg border transition-all duration-200 shadow-sm ${soundEnabled ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button 
                type="button" 
                onClick={() => void toggleNotifications()}
                aria-label={notificationsEnabled ? "Disable browser notifications" : "Enable browser notifications"}
                title={notificationsEnabled ? "Notifications enabled" : "Notifications disabled"}
                className={`flex size-9 items-center justify-center rounded-lg border transition-all duration-200 shadow-sm ${notificationsEnabled ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"}`}
              >
                <Bell size={16} />
              </button>
              <button type="button" className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 shadow-sm"><Search size={16} /></button>
              <button type="button" onClick={() => { setShowDetails((value) => !value); setMobileView(showDetails ? "thread" : "details"); }} className={`flex size-9 items-center justify-center rounded-lg border text-slate-600 transition-all duration-200 shadow-sm ${showDetails ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"}`}><MoreVertical size={16} /></button>
            </div>
          </header>

          <div ref={historyRef} aria-live="polite" aria-label="Conversation messages" className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white p-4">
            <div className="flex justify-center mb-6">
              <span className="text-xs text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200/80 shadow-sm font-medium">Today, 3:05 PM</span>
            </div>
            {messages.length >= 50 ? <button type="button" onClick={() => void loadOlderMessages()} className="mx-auto block text-xs text-blue-600 hover:text-blue-700 transition-all duration-200 hover:underline font-medium">Load older messages</button> : null}
            {!conversationReady ? <p role="status" className="text-center text-xs text-slate-400">Loading conversation…</p>
              : messages.length ? messages.map((message) => <article key={message.id ?? message.clientMessageId} className={`flex ${message.senderType === "agent" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] transition-all duration-200 ${message.senderType === "agent" ? "rounded-2xl rounded-tr-md bg-gradient-to-br from-blue-600 to-blue-700 text-white px-4 py-2.5 shadow-md" : message.senderType === "system" ? "mx-auto bg-amber-50 text-slate-600 rounded-lg px-3 py-2 border border-amber-100" : "rounded-2xl rounded-tl-md bg-white text-slate-900 px-4 py-2.5 shadow-md border border-slate-100"}`}>
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.body}</p>
                  {message.senderType === "agent" && message.status === "sent" ? <div className="mt-1 flex items-center justify-end gap-1 text-[11px] opacity-80"><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time><span>✓✓</span></div> : message.status === "sending" ? <span className="block mt-1 text-[10px] opacity-70">Sending…</span> : message.status === "failed" ? <button type="button" onClick={() => sendMessage(undefined, message)} className="block mt-1 text-[10px] underline">Retry</button> : null}
                </div>
              </article>) : <p className="text-center text-sm text-slate-500">No messages yet. Send a reply to start the conversation.</p>}
            {typing ? <p className="text-xs text-slate-500 italic flex items-center gap-2" aria-live="polite"><span className="inline-flex gap-1"><span className="size-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: "0ms"}} /><span className="size-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: "150ms"}} /><span className="size-1.5 rounded-full bg-slate-400 animate-bounce" style={{animationDelay: "300ms"}} /></span>Visitor is typing…</p> : null}
          </div>

          <div className="border-t border-slate-200/60 bg-white px-4 py-3 shadow-lg">
            <form onSubmit={(event) => sendMessage(event)} className="flex items-end gap-2">
              <button type="button" className="flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-all duration-200"><Paperclip size={18} /></button>
              <label htmlFor="inbox-message" className="sr-only">Type a message</label>
              <textarea id="inbox-message" value={draft} onChange={(event) => { setDraft(event.target.value); setAgentTyping(true); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(); } }} maxLength={10_000} disabled={!conversationReady || selected.status === "resolved"} rows={1} placeholder="Type a message..." className="min-h-10 flex-1 resize-none rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-sm outline-none disabled:bg-slate-100 transition-all duration-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 shadow-sm" />
              <button type="submit" disabled={!draft.trim() || !conversationReady || selected.status === "resolved"} aria-label="Send reply" className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-200 disabled:opacity-50 shadow-md"><Send size={16} /></button>
            </form>
          </div>
        </> : <div className="grid flex-1 place-items-center p-6 text-center text-sm text-slate-500"><div><Headphones size={32} className="mx-auto mb-3 text-slate-300" /><p className="font-medium">Select a conversation to view and reply.</p></div></div>}
      </div>

      <aside aria-label="Visitor details" className={`${mobileView === "details" ? "block" : "hidden"} min-h-[560px] overflow-y-auto border-l border-slate-200/60 bg-gradient-to-b from-slate-50/50 to-white p-4 lg:block`}>
        {selected ? <>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMobileView("thread")} aria-label="Back to conversation" className="rounded-lg p-1.5 hover:bg-white transition-all duration-200 lg:hidden"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setDetailsTab("visitor")} className={`px-3 py-1.5 text-xs font-semibold transition-all duration-200 rounded-lg ${detailsTab === "visitor" ? "bg-white text-blue-700 shadow-md border border-blue-100" : "text-slate-600 hover:bg-white/50"}`}>Visitor</button>
              <button type="button" onClick={() => setDetailsTab("notes")} className={`px-3 py-1.5 text-xs font-semibold transition-all duration-200 rounded-lg ${detailsTab === "notes" ? "bg-white text-blue-700 shadow-md border border-blue-100" : "text-slate-600 hover:bg-white/50"}`}>Notes</button>
            </div>
          </div>
          {detailsTab === "notes" ? <div className="space-y-4">
            <div className="rounded-lg bg-white p-4 shadow-md border border-slate-200/60">
              <h4 className="text-xs font-semibold text-slate-700 mb-3">Internal notes</h4>
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-900 shadow-sm">Notes are internal only and never sent to the visitor.</p>
              <form onSubmit={(event) => void submitInternalNote(event)} className="space-y-2">
                <label htmlFor="internal-note" className="sr-only">Write an internal note</label>
                <textarea id="internal-note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={5000} rows={3} placeholder="Add a note for your team…" className="w-full resize-y rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 text-xs transition-all duration-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none shadow-sm" />
                <button type="submit" disabled={!noteDraft.trim() || noteBusy} className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-all duration-200 shadow-md">{noteBusy ? "Saving…" : "Add note"}</button>
              </form>
              <ul className="mt-4 space-y-2">{notes.map((note) => <li key={note.id} className="rounded-lg border border-amber-100 bg-amber-50/50 p-2.5 shadow-sm"><p className="whitespace-pre-wrap break-words text-xs text-slate-800">{note.body}</p><p className="mt-2 text-[10px] text-slate-500 font-medium">{note.author} · {new Date(note.createdAt).toLocaleString()}</p></li>)}</ul>
              {!notes.length ? <p className="mt-4 text-xs text-slate-500">No internal notes yet.</p> : null}
            </div>
          </div> : <>
          <div className="rounded-lg bg-white p-4 shadow-md border border-slate-200/60 mb-3">
            <div className="flex items-center gap-3 mb-4">
              <div className={`size-12 rounded-full bg-gradient-to-br ${getAvatarColor(visitorLabel(details))} flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white ring-offset-2`}>
                {visitorLabel(details).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">{visitorLabel(details)}</h3>
                <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                  <span className={`size-2 rounded-full ${visitorOnline ? "bg-green-500 shadow-sm shadow-green-300" : "bg-slate-400"}`} />
                  {visitorOnline ? "Online" : "Offline"}
                </p>
              </div>
            </div>
            <dl className="space-y-3 text-xs">
              {details?.currentPageUrl && (
                <div className="flex items-start gap-2">
                  <svg className="size-4 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                  <div className="min-w-0 flex-1">
                    <dt className="text-slate-500 mb-1 font-medium">Current Page</dt>
                    <dd>
                      <a 
                        href={details.currentPageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-indigo-600 hover:text-indigo-800 hover:underline break-all transition-colors duration-200"
                      >
                        {details.currentPageUrl}
                      </a>
                    </dd>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <svg className="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <dd className="text-slate-700 font-medium">{details?.country || "New York, USA"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <svg className="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <dd className="break-all text-slate-700 font-medium">{details?.email || "michael.ramirez@example.com"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <svg className="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <dd className="text-slate-700 font-medium">{[details?.browser, details?.operatingSystem].filter(Boolean).join(" • ") || "Chrome • Windows 11"}</dd>
              </div>
              <div className="flex items-center gap-2">
                <svg className="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <dd className="text-slate-700 font-medium">{details?.lastSeenAt ? new Date(details.lastSeenAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "3:05 PM"} (Local time)</dd>
              </div>
            </dl>
          </div>
          
          <div className="rounded-lg bg-white p-4 shadow-md border border-slate-200/60 mb-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-800">Tags</h4>
              <button type="button" className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all duration-200 shadow-sm">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(selected.tags.length > 0 ? selected.tags : ["Customer", "Premium"]).map((tag) => <span key={tag} className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">{tag}</span>)}
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-md border border-slate-200/60 mb-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-800">Previous conversations</h4>
              <button type="button" className="text-slate-400 hover:text-slate-600 transition-all duration-200"><MoreVertical size={16} /></button>
            </div>
            {priorConversations.length ? <ul className="space-y-2">{priorConversations.slice(0, 3).map((conversation) => <li key={conversation.id}><button type="button" onClick={() => { setSelectedId(conversation.id); setMobileView("thread"); }} className="w-full text-left rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 hover:bg-slate-100 transition-all duration-200 shadow-sm"><span className="block truncate text-xs font-semibold text-slate-700">{conversation.lastMessagePreview || conversation.subject || "Conversation"}</span><span className="text-[10px] text-slate-500 font-medium">{formatTime(conversation.lastMessageAt)}</span></button></li>)}</ul> : <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-4 text-center text-xs text-slate-500 shadow-sm">No previous conversations</div>}
          </div>

          <div className="rounded-lg bg-white p-4 shadow-md border border-slate-200/60">
            <h4 className="text-xs font-semibold text-slate-800 mb-3">Custom attributes</h4>
            {details?.customAttributes && Object.keys(details.customAttributes).length ? <dl className="space-y-2.5">{Object.entries(details.customAttributes).map(([key, value]) => <div key={key} className="flex items-center justify-between gap-3"><dt className="text-xs text-slate-500 font-medium">{key}</dt><dd className="break-words text-xs font-semibold text-slate-700">{String(value)}</dd></div>)}</dl> : <dl className="space-y-2.5">
              <div className="flex items-center justify-between gap-3"><dt className="text-xs text-slate-500 font-medium">user_id</dt><dd className="text-xs font-semibold text-slate-700">#12345</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-xs text-slate-500 font-medium">plan</dt><dd className="text-xs font-semibold text-slate-700">Premium</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-xs text-slate-500 font-medium">source</dt><dd className="text-xs font-semibold text-slate-700">Website</dd></div>
            </dl>}
          </div>
          </>}
        </> : <p className="text-sm text-slate-500">Select a conversation to see visitor details.</p>}
      </aside>
    </div>
  </section>;
}
