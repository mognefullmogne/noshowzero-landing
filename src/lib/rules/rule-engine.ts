// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Rules engine — load active rules, evaluate context against conditions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuleCondition, RuleAction } from "@/lib/types";

interface RuleContext {
  readonly [key: string]: unknown;
}

interface EvaluationResult {
  readonly matched: boolean;
  readonly actions: readonly RuleAction[];
  readonly rulesetName: string;
  readonly version: number;
}

/**
 * Load active rules for a tenant and entity type, evaluate against context.
 */
export async function evaluateRules(
  supabase: SupabaseClient,
  tenantId: string,
  entityType: string,
  context: RuleContext
): Promise<readonly EvaluationResult[]> {
  // Load active rulesets for the entity type
  const { data: rulesets } = await supabase
    .from("rulesets")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("entity_type", entityType)
    .eq("is_active", true);

  if (!rulesets || rulesets.length === 0) return [];

  const results: EvaluationResult[] = [];

  for (const ruleset of rulesets) {
    // Get active version
    const { data: version } = await supabase
      .from("rule_versions")
      .select("version, conditions, actions")
      .eq("ruleset_id", ruleset.id)
      .eq("is_active", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!version) continue;

    const conditions = version.conditions as RuleCondition[];
    const actions = version.actions as RuleAction[];

    // All conditions must match (AND logic)
    const matched = conditions.every((cond) => evaluateCondition(cond, context));

    results.push({
      matched,
      actions: matched ? actions : [],
      rulesetName: ruleset.name,
      version: version.version,
    });
  }

  return results;
}

function evaluateCondition(condition: RuleCondition, context: RuleContext): boolean {
  const fieldValue = getNestedValue(context, condition.field);

  switch (condition.operator) {
    case "eq":
      return fieldValue === condition.value;
    case "neq":
      return fieldValue !== condition.value;
    case "gt":
      return typeof fieldValue === "number" && fieldValue > (condition.value as number);
    case "gte":
      return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
    case "lt":
      return typeof fieldValue === "number" && fieldValue < (condition.value as number);
    case "lte":
      return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    case "not_in":
      return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
    case "contains":
      return typeof fieldValue === "string" && fieldValue.includes(condition.value as string);
    default:
      return false;
  }
}

function getNestedValue(obj: RuleContext, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
