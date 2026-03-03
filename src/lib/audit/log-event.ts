/**
 * Audit event logger — non-blocking insert using service client.
 */

import type { ActorType } from "@/lib/types";
import { createServiceClient } from "@/lib/supabase/server";

interface AuditInput {
  readonly tenantId: string;
  readonly actorType: ActorType;
  readonly actorId?: string;
  readonly entityType: string;
  readonly entityId?: string;
  readonly action: string;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string;
}

/**
 * Log an audit event. Non-blocking — errors are logged but don't throw.
 */
export function logAuditEvent(input: AuditInput): void {
  // Fire and forget
  createServiceClient()
    .then((supabase) =>
      supabase.from("audit_events").insert({
        tenant_id: input.tenantId,
        actor_type: input.actorType,
        actor_id: input.actorId ?? null,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        action: input.action,
        metadata: input.metadata ?? {},
        ip_address: input.ipAddress ?? null,
      })
    )
    .catch((err) => {
      console.error("[Audit] Failed to log event:", err);
    });
}
