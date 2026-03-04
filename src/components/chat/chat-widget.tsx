"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderInlineMarkdown } from "@/lib/render-markdown";

interface Message {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
}

const INITIAL_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm the NoShowZero AI assistant. I can help you understand how our platform works, answer questions about pricing, integrations, and features. What would you like to know?",
};

const QUICK_QUESTIONS = [
  "How does the AI waitlist work?",
  "What integrations do you support?",
  "How much does it cost?",
  "How fast is the setup?",
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<readonly Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message ?? "Sorry, I couldn't process that. Please try again.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-teal-600 to-cyan-500 text-white shadow-xl shadow-teal-600/30 transition-shadow hover:shadow-2xl hover:shadow-teal-600/40"
            aria-label="Open chat"
          >
            <MessageCircle className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl sm:bottom-6 sm:right-6 max-sm:inset-4 max-sm:h-auto max-sm:w-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-600 to-cyan-500 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">NoShowZero AI</p>
                  <p className="text-xs text-white/70">Ask me anything</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2.5",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50">
                      <Bot className="h-4 w-4 text-teal-600" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      message.role === "user"
                        ? "bg-gradient-to-r from-teal-600 to-cyan-500 text-white"
                        : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {renderInlineMarkdown(message.content)}
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <User className="h-4 w-4 text-slate-500" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2.5">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-teal-50">
                    <Bot className="h-4 w-4 text-teal-600" />
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  </div>
                </div>
              )}

              {/* Quick questions — only shown when just the welcome message */}
              {messages.length === 1 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="rounded-full border border-teal-200/60 bg-teal-50/80 px-3 py-1.5 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-slate-100 px-4 py-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your question..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                disabled={loading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || loading}
                className="h-8 w-8 rounded-lg bg-gradient-to-r from-teal-600 to-cyan-500 text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
