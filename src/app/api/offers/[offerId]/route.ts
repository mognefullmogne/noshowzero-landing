/**
 * Public GET — offer status page.
 * Secured by HMAC token (passed as query param).
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyOfferToken } from "@/lib/backfill/offer-tokens";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SECURITY_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
} as const;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { offerId } = await params;

    if (!UUID_RE.test(offerId)) {
      return htmlResponse(400, "Link non valido", "Identificatore offerta non valido.");
    }

    // Require token for access (prevents unauthenticated PII disclosure)
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return htmlResponse(401, "Accesso negato", "Token di autenticazione richiesto.");
    }
    const verified = verifyOfferToken(token);
    if (!verified || verified.offerId !== offerId) {
      return htmlResponse(401, "Token non valido", "Il token non è valido o è scaduto.");
    }

    const supabase = await createServiceClient();

    const { data: offer, error } = await supabase
      .from("waitlist_offers")
      .select(`
        id, status, offered_at, expires_at, responded_at,
        original_appointment:appointments!waitlist_offers_original_appointment_id_fkey(
          service_name, provider_name, location_name, scheduled_at, duration_min
        )
      `)
      .eq("id", offerId)
      .maybeSingle();

    if (error || !offer) {
      return htmlResponse(404, "Offerta non trovata", "Questa offerta non esiste o è stata rimossa.");
    }

    const appt = offer.original_appointment as unknown as {
      service_name: string;
      provider_name: string | null;
      location_name: string | null;
      scheduled_at: string;
      duration_min: number;
    } | null;

    const statusLabels: Record<string, string> = {
      pending: "In attesa di risposta",
      accepted: "Accettata — appuntamento confermato!",
      declined: "Rifiutata",
      expired: "Scaduta",
      cancelled: "Annullata",
    };

    const statusEmoji: Record<string, string> = {
      pending: "&#x23F3;",
      accepted: "&#x2705;",
      declined: "&#x274C;",
      expired: "&#x23F0;",
      cancelled: "&#x1F6AB;",
    };

    const scheduledAt = appt ? new Date(appt.scheduled_at) : null;
    const dateStr = scheduledAt
      ? escapeHtml(scheduledAt.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))
      : "";
    const timeStr = scheduledAt
      ? escapeHtml(scheduledAt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }))
      : "";

    const body = `
      <div style="text-align:center; padding:40px 20px;">
        <h1 style="font-size:48px; margin-bottom:8px;">${statusEmoji[offer.status] ?? ""}</h1>
        <h2 style="color:#1a1a1a; margin-bottom:24px;">${escapeHtml(statusLabels[offer.status] ?? offer.status)}</h2>
        ${appt ? `
          <div style="background:#f8f9fa; padding:20px; border-radius:12px; display:inline-block; text-align:left;">
            <p><strong>Servizio:</strong> ${escapeHtml(appt.service_name)}</p>
            <p><strong>Data:</strong> ${dateStr}</p>
            <p><strong>Ora:</strong> ${timeStr}</p>
            ${appt.location_name ? `<p><strong>Sede:</strong> ${escapeHtml(appt.location_name)}</p>` : ""}
            ${appt.provider_name ? `<p><strong>Dottore:</strong> ${escapeHtml(appt.provider_name)}</p>` : ""}
          </div>
        ` : ""}
        ${offer.status === "pending" ? `
          <p style="margin-top:24px; color:#666;">
            Questa offerta scade il ${escapeHtml(new Date(offer.expires_at).toLocaleString("it-IT"))}.
          </p>
        ` : ""}
      </div>
    `;

    return htmlResponse(200, "Stato Offerta", body);
  } catch (err) {
    console.error("Offer status error:", err);
    return htmlResponse(500, "Errore", "Si è verificato un errore. Riprova più tardi.");
  }
}

function htmlResponse(status: number, title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} &mdash; NoShowZero</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #fff; color: #333; }
    p { margin: 8px 0; font-size: 16px; }
    h2 { font-size: 24px; }
  </style>
</head>
<body>${body}</body>
</html>`;

  return new NextResponse(html, { status, headers: SECURITY_HEADERS });
}
