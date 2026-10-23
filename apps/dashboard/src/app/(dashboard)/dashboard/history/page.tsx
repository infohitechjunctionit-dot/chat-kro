"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, Trash2, LoaderCircle, RefreshCw } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api";

type HistoryVisitor = {
  displayName: string | null;
  email: string | null;
  currentPageUrl: string | null;
};
type HistoryWebsite = { name: string; domain: string };
type HistoryConversation = {
  id: string;
  visitorId: string;
  status: "open" | "pending" | "resolved";
  lastMessageAt: string;
  agentUnreadCount: number;
  visitor?: HistoryVisitor | null;
  website?: HistoryWebsite | null;
};

type StatusFilter = "all" | "open" | "resolved";

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

function visitorLabel(visitor?: HistoryVisitor | null): string {
  return visitor?.displayName?.trim() || visitor?.email || "Website visitor";
}

function extractDomain(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else {
    return date.toLocaleString([], { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}

export default function HistoryPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [conversations, setConversations] = useState<HistoryConversation[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = window.localStorage.getItem("relay-chat-workspace");
    if (saved) setWorkspaceId(saved);
  }, []);

  useEffect(() => {
    const onWorkspaceChange = (event: Event) => {
      const nextWorkspaceId = (event as CustomEvent<string>).detail;
      if (typeof nextWorkspaceId === "string") {
        setWorkspaceId(nextWorkspaceId);
      }
    };
    window.addEventListener("relay-workspace-change", onWorkspaceChange);
    return () => window.removeEventListener("relay-workspace-change", onWorkspaceChange);
  }, []);

  const loadConversations = useCallback(async (append = false) => {
    if (!workspaceId) return;
    if (append && !cursor) return;
    
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ limit: "21" });
      if (filter !== "all") params.set("status", filter);
      if (append && cursor) params.set("before", cursor);

      const result = await apiRequest<{ conversations: HistoryConversation[] }>(
        `/workspaces/${workspaceId}/conversations?${params.toString()}`
      );

      const page = result.conversations;
      setHasMore(page.length === 21);
      const visiblePage = page.slice(0, 20);

      if (append) {
        setConversations((current) => {
          const seen = new Set(current.map((item) => item.id));
          return [...current, ...visiblePage.filter((item) => !seen.has(item.id))];
        });
      } else {
        setConversations(visiblePage);
      }

      if (visiblePage.length > 0) {
        setCursor(visiblePage[visiblePage.length - 1].lastMessageAt);
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setError("Please sign in again.");
      } else {
        setError(cause instanceof Error ? cause.message : "Unable to load conversation history.");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [workspaceId, filter, cursor]);

  useEffect(() => {
    setCursor("");
    setConversations([]);
    if (workspaceId) {
      void loadConversations();
    }
  }, [workspaceId, filter]);

  async function deleteConversation(conversationId: string) {
    if (!workspaceId) return;
    
    const confirmed = window.confirm(
      "Are you sure you want to delete this conversation? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeletingIds((current) => new Set([...current, conversationId]));
    const backup = conversations.find((c) => c.id === conversationId);
    setConversations((current) => current.filter((item) => item.id !== conversationId));

    try {
      await apiRequest(
        `/workspaces/${workspaceId}/conversations/${conversationId}`,
        { method: "DELETE" }
      );
      setError("");
    } catch (cause) {
      // Restore the conversation on error
      if (backup) {
        setConversations((current) => {
          const restored = [...current, backup];
          return restored.sort((a, b) => 
            Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)
          );
        });
      }
      setError(cause instanceof Error ? cause.message : "Unable to delete conversation.");
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(conversationId);
        return next;
      });
    }
  }

  const statusBadgeClass = (status: string): string => {
    switch (status) {
      case "resolved":
        return "bg-green-100 text-green-700 border-green-200";
      case "open":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "pending":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock size={28} className="text-indigo-600" />
            Conversation History
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            View and manage all past conversations
          </p>
        </div>
        <button
          onClick={() => {
            setCursor("");
            setConversations([]);
            void loadConversations();
          }}
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
            filter === "all"
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("open")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
            filter === "open"
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setFilter("resolved")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
            filter === "resolved"
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          Resolved
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoaderCircle className="animate-spin text-indigo-600 mr-2" size={24} />
            <span className="text-sm text-slate-600">Loading conversations...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-12 text-center">
            <Clock size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-600">No conversation history yet</p>
            <p className="text-xs text-slate-400 mt-1">
              {filter !== "all" ? `No ${filter} conversations found` : "Start chatting with visitors to see history here"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Visitor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Full URL
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {conversations.map((conversation) => {
                  const visitorName = visitorLabel(conversation.visitor);
                  const avatarColor = getAvatarColor(visitorName);
                  const avatarInitial = visitorName.charAt(0).toUpperCase();
                  const websiteName = conversation.website?.name || extractDomain(conversation.visitor?.currentPageUrl) || conversation.website?.domain || 'Unknown';
                  const fullUrl = conversation.visitor?.currentPageUrl || `https://${conversation.website?.domain || ''}`;
                  const isDeleting = deletingIds.has(conversation.id);

                  return (
                    <tr key={conversation.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white font-semibold shadow-sm shrink-0`}>
                            {avatarInitial}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {visitorName}
                            </div>
                            {conversation.visitor?.email && (
                              <div className="text-xs text-slate-500 truncate">
                                {conversation.visitor.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-900">{websiteName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline truncate block max-w-xs"
                          title={fullUrl}
                        >
                          {fullUrl}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-600">
                          {formatDate(conversation.lastMessageAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(conversation.status)}`}>
                          {conversation.status.charAt(0).toUpperCase() + conversation.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => void deleteConversation(conversation.id)}
                          disabled={isDeleting}
                          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors border border-red-200 hover:border-red-300"
                          title="Delete conversation"
                        >
                          {isDeleting ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasMore && !loading && conversations.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => void loadConversations(true)}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loadingMore ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
