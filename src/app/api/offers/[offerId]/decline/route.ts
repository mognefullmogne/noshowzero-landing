/**
 * Public GET — patient clicks Decline link from notification.
 * Secured by HMAC token verification (no session auth).
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyOfferToken } from "@/lib/backfill/offer-tokens";
import { processDecline } from "@/lib/backfill/process-response";

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

    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return htmlResponse(400, "Link non valido", "Il link non contiene un token di autenticazione.");
    }

    const verified = verifyOfferToken(token);
    if (!verified) {
      return htmlResponse(401, "Link scaduto o non valido", "Questo link è scaduto o non è più valido.");
    }

    if (verified.offerId !== offerId || verified.action !== "decline") {
      return htmlResponse(401, "Token non corrispondente", "Il token non corrisponde a questa offerta.");
    }

    const supabase = await createServiceClient();
    const result = await processDecline(supabase, offerId);

    if (!result.success) {
      return htmlResponse(409, "Offerta non disponibile", escapeHtml(result.error ?? "Questa offerta non è più disponibile."));
    }

    return htmlResponse(200, "Offerta rifiutata", `
      <div style="text-align:center;">
        <div style="font-size:64px; margin-bottom:16px;">&#x1F44B;</div>
        <p style="font-size:18px; color:#666;">Hai rifiutato l'offerta. Il posto verrà offerto al prossimo paziente in lista d'attesa.</p>
        <p style="color:#999; font-size:14px; margin-top:24px;">Puoi chiudere questa pagina.</p>
      </div>
    `);
  } catch (err) {
    console.error("Decline offer error:", err);
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
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px 20px; background: #fff; color: #333; text-align: center; }
    h1 { font-size: 28px; margin-bottom: 16px; }
    p { font-size: 16px; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body.startsWith("<") ? body : `<p>${body}</p>`}
</body>
</html>`;

  return new NextResponse(html, { status, headers: SECURITY_HEADERS });
}
