"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { StatusBadge } from "@/components/shared/status-badge";
import type { MessageThread, MessageEvent } from "@/lib/types";

export default function MessagesPage() {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<MessageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const fetchThreads = useCallback(async () => {
    const res = await fetch("/api/messages");
    const json = await res.json();
    if (json.success) setThreads(json.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 10000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  const selectThread = useCallback(async (thread: MessageThread) => {
    setSelectedThread(thread);
    setLoadingMessages(true);
    const res = await fetch(`/api/messages/${thread.id}`);
    const json = await res.json();
    if (json.success) {
      setMessages(json.data.messages);
    }
    setLoadingMessages(false);
  }, []);

  const handleSend = useCallback(async () => {
    if (!selectedThread || !replyText.trim()) return;
    setSending(true);
    const res = await fetch(`/api/messages/${selectedThread.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyText }),
    });
    const json = await res.json();
    if (json.success) {
      setMessages((prev) => [...prev, json.data]);
      setReplyText("");
    }
    setSending(false);
  }, [selectedThread, replyText]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Messages" description="Patient conversations via WhatsApp and SMS" />

      <div className="flex h-[calc(100vh-240px)] overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* Thread list */}
        <div className={`w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto ${selectedThread ? "hidden md:block" : ""}`}>
          {threads.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<MessageSquare className="h-10 w-10" />} title="No conversations yet" description="Messages will appear when patients reply" />
            </div>
          ) : (
            threads.map((thread) => {
              const patient = thread.patient as unknown as Record<string, string> | undefined;
              const latest = thread.latest_message as unknown as Record<string, string> | undefined;
              return (
                <button
                  key={thread.id}
                  onClick={() => selectThread(thread)}
                  className={`w-full border-b border-gray-100 px-4 py-3 text-left transition hover:bg-gray-50 ${
                    selectedThread?.id === thread.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {patient ? `${patient.first_name} ${patient.last_name}` : "Unknown"}
                    </span>
                    <StatusBadge status={thread.channel} />
                  </div>
                  {latest && (
                    <p className="mt-1 truncate text-xs text-gray-500">{latest.body}</p>
                  )}
                  {thread.last_message_at && (
                    <p className="mt-1 text-xs text-gray-400">
                      {new Date(thread.last_message_at).toLocaleString("it-IT", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Message panel */}
        <div className={`flex flex-1 flex-col ${!selectedThread ? "hidden md:flex" : ""}`}>
          {selectedThread ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setSelectedThread(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {(selectedThread.patient as unknown as Record<string, string> | undefined)?.first_name}{" "}
                    {(selectedThread.patient as unknown as Record<string, string> | undefined)?.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{selectedThread.channel}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMessages ? (
                  <LoadingSpinner />
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        msg.direction === "outbound"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        <p className={`mt-1 text-xs ${msg.direction === "outbound" ? "text-blue-200" : "text-gray-400"}`}>
                          {new Date(msg.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                          {msg.intent && <span className="ml-2">({msg.intent})</span>}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply input */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Type a message..."
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <Button onClick={handleSend} disabled={sending || !replyText.trim()} size="sm">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-gray-400">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
