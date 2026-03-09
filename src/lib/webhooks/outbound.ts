// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Outbound webhook dispatcher.
 * Sends signed HTTP POST to registered webhook endpoints when events occur.
 */

import { createHmac } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

interface DispatchResult {
  readonly delivered: number;
  readonly failed: number;
}

/**
 * Dispatch an event to all matching active webhook endpoints for a tenant.
 * Signs each request with HMAC-SHA256 using the endpoint secret.
 */
export async function dispatchWebhookEvent(
  tenantId: string,
  eventType: string,
  payload: object,
): Promise<DispatchResult> {
  const supabase = await createServiceClient();

  // Find active endpoints subscribed to this event type
  const { data: endpoints, error } = await supabase
    .from("webhook_endpoints")
    .select("id, url, secret, events")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .contains("events", [eventType]);

  if (error) {
    console.error("Failed to fetch webhook endpoints:", error);
    return { delivered: 0, failed: 0 };
  }

  if (!endpoints || endpoints.length === 0) {
    return { delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;

  const deliveries = endpoints.map(async (endpoint) => {
    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const signature = createHmac("sha256", endpoint.secret)
      .update(body)
      .digest("hex");

    // Create delivery record
    const { data: delivery, error: insertError } = await supabase
      .from("webhook_deliveries")
      .insert({
        tenant_id: tenantId,
        webhook_endpoint_id: endpoint.id,
        event_type: eventType,
        payload,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !delivery) {
      console.error("Failed to create webhook delivery record:", insertError);
      failed += 1;
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseBody = await response.text().catch(() => "");
      const isSuccess = response.status >= 200 && response.status < 300;

      await supabase
        .from("webhook_deliveries")
        .update({
          status: isSuccess ? "delivered" : "failed",
          attempts: 1,
          last_attempt_at: new Date().toISOString(),
          response_status: response.status,
          response_body: responseBody.slice(0, 4096),
        })
        .eq("id", delivery.id);

      if (isSuccess) {
        delivered += 1;
      } else {
        failed += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`Webhook delivery failed for ${endpoint.url}:`, message);

      await supabase
        .from("webhook_deliveries")
        .update({
          status: "failed",
          attempts: 1,
          last_attempt_at: new Date().toISOString(),
          response_body: message.slice(0, 4096),
        })
        .eq("id", delivery.id);

      failed += 1;
    }
  });

  await Promise.allSettled(deliveries);

  return { delivered, failed };
}
