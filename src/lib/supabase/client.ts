import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        worker: true,
        heartbeatCallback: (status: string) => {
          if (status === "disconnected") {
            console.warn("[Realtime] Heartbeat detected disconnection — transport reconnecting");
          }
        },
      },
    },
  );
}
