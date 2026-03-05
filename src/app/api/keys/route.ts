// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";
import { z } from "zod";

const KeyNameSchema = z.string().min(1).max(100).regex(/^[\w\s\-]+$/).optional();

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const key = `nows_${raw}`;
  const hash = createHash("sha256").update(key).digest("hex");
  const prefix = `nows_${raw.slice(0, 8)}...`;
  return { key, hash, prefix };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }

    const { data: keys } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, is_active, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ keys: keys ?? [] });
  } catch (error) {
    console.error("API keys error:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = KeyNameSchema.safeParse(body.name);
    const name = parsed.success && parsed.data ? parsed.data : "Default";

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!tenant) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }

    const { key, hash, prefix } = generateApiKey();

    const { error } = await supabase.from("api_keys").insert({
      tenant_id: tenant.id,
      name,
      key_hash: hash,
      key_prefix: prefix,
    });

    if (error) {
      return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
    }

    // Return the full key only once — after this, only the prefix is shown
    return NextResponse.json({ key, prefix });
  } catch (error) {
    console.error("API key creation error:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
