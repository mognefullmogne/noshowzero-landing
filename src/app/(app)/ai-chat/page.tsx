// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useCallback, useRef, useState } from "react";
import { Bot, Send, Wrench, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import type { ChatMessage, ChatToolCall } from "@/lib/types";
import { renderInlineMarkdown } from "@/lib/render-markdown";

const SUGGESTED_PROMPTS = [
  "Mostrami gli appuntamenti di oggi",
  "Quanti pazienti sono in lista d'attesa?",
  "Qual e' il tasso di no-show di questa settimana?",
  "Cerca appuntamenti per Mario Rossi",
  "Com'e' il calendario di domani?",
];

export default function AiChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMessage: ChatMessage = { role: "user", content: text };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: messages.slice(-20), // Last 20 messages for context
          }),
        });

        const json = await res.json();
        if (json.success) {
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: json.data.response,
            tool_calls: json.data.tool_calls,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Errore: ${json.error?.message ?? "Unknown error"}` },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Errore di connessione. Riprova." },
        ]);
      }

      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    [messages, loading]
  );

  return (
    <div>
      <PageHeader title="AI Assistant" description="Chat with your AI operator to manage appointments and patients" />

      <div className="flex h-[calc(100vh-240px)] flex-col rounded-xl border border-gray-200 bg-white">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100">
                <Bot className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">AI Operator Assistant</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Ask me anything about appointments, patients, waitlist, or calendar management.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] space-y-2 ${msg.role === "user" ? "" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-50 text-gray-900 border border-gray-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{renderInlineMarkdown(msg.content)}</p>
                </div>
                {/* Tool calls */}
                {msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="space-y-1 pl-2">
                    {msg.tool_calls.map((tc: ChatToolCall, j: number) => (
                      <div key={j} className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                        <Wrench className="h-3 w-3 flex-shrink-0" />
                        <span className="font-medium">{tc.tool_name.replace(/_/g, " ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Ask the AI assistant..."
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
              disabled={loading}
            />
            <Button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
