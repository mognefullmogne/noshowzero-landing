// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Claude Sonnet agentic loop for operator chat.
 * Max 10 tool iterations, system prompt, tool execution.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, ChatToolCall, ChatResult } from "@/lib/types";
import { TOOL_DEFINITIONS, dispatchTool } from "./tool-registry";

const MAX_ITERATIONS = 10;
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Sei un assistente operatore per una clinica medica che usa NoShow.
Hai accesso a strumenti per gestire appuntamenti, pazienti, lista d'attesa e messaggi.

Regole:
- Rispondi sempre in italiano
- Usa gli strumenti disponibili per trovare informazioni reali
- Non inventare dati: cerca sempre prima nel sistema
- Per azioni distruttive (cancellazione, modifica), conferma prima con l'operatore
- Sii conciso e professionale
- Quando presenti dati, usa formattazione chiara con date leggibili

Contesto: Stai aiutando un operatore della clinica a gestire le attività quotidiane.`;

export async function runOperatorChat(
  supabase: SupabaseClient,
  tenantId: string,
  userMessage: string,
  history: readonly ChatMessage[]
): Promise<ChatResult> {
  const client = new Anthropic();
  const toolCalls: ChatToolCall[] = [];
  let totalTokens = 0;

  // Build message history for Claude
  const messages: Anthropic.MessageParam[] = history.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
  messages.push({ role: "user", content: userMessage });

  // Convert tool definitions to Anthropic format
  const tools: Anthropic.Tool[] = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    // Check if response contains tool use
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlock & { type: "tool_use" } => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      // No more tool calls — extract text response
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      const responseText = textBlocks.map((b) => b.text).join("\n");

      return {
        response: responseText,
        tool_calls: toolCalls,
        tokens_used: totalTokens,
      };
    }

    // Execute tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    // Add assistant message with tool use to history
    messages.push({ role: "assistant", content: response.content });

    for (const toolUse of toolUseBlocks) {
      const input = toolUse.input as Record<string, unknown>;

      let result: unknown;
      try {
        result = await dispatchTool(supabase, tenantId, toolUse.name, input);
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Tool execution failed" };
      }

      toolCalls.push({
        tool_name: toolUse.name,
        input,
        result,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // Add tool results to messages
    messages.push({ role: "user", content: toolResults });
  }

  // Max iterations reached
  return {
    response: "Ho raggiunto il limite di operazioni. Per favore riprova con una richiesta più semplice.",
    tool_calls: toolCalls,
    tokens_used: totalTokens,
  };
}
