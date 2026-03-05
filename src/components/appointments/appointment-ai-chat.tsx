// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

"use client";

import { useCallback, useRef, useState } from "react";
import { Bot, Send, Wrench, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage, ChatToolCall } from "@/lib/types";
import { renderInlineMarkdown } from "@/lib/render-markdown";

const SUGGESTED_PROMPTS = [
  "Riassumi questo appuntamento",
  "Qual e' il rischio di no-show?",
  "Manda un promemoria WhatsApp",
  "Cerca slot alternativi",
  "Mostra la storia del paziente",
];

interface AppointmentAiChatProps {
  readonly appointmentId: string;
}

export function AppointmentAiChat({ appointmentId }: AppointmentAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMessage: ChatMessage = { role: "user", content: text };
      const updated = [...messages, userMessage];
      setMessages(updated);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/ai/appointment-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: updated.slice(-20),
            context: { appointment_id: appointmentId },
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
            { role: "assistant", content: `Errore: ${json.error?.message ?? "Errore sconosciuto"}` },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Errore di connessione. Riprova." },
        ]);
      } finally {
        setLoading(false);
      }
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    [messages, loading, appointmentId]
  );

  return (
    <div className="flex h-80 flex-col rounded-xl border border-gray-200 bg-white">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 text-center">
              AI assistant for this appointment
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[85%] space-y-1">
              <div
                className={`rounded-xl px-3 py-2 text-xs ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-50 text-gray-900 border border-gray-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{renderInlineMarkdown(msg.content)}</p>
              </div>
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="space-y-0.5 pl-1">
                  {msg.tool_calls.map((tc: ChatToolCall, j: number) => (
                    <div key={j} className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                      <Wrench className="h-2.5 w-2.5 flex-shrink-0" />
                      <span className="font-medium">{tc.tool_name.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 p-2">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask about this appointment..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none"
            disabled={loading}
          />
          <Button size="sm" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
