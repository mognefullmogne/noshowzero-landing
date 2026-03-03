# Coding Conventions

**Analysis Date:** 2026-03-03

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension (e.g., `UrgencyBadge.tsx`, `ScoreBreakdown.tsx`)
- Utilities/functions: camelCase with `.ts` extension (e.g., `waitlist-score.ts`, `auth-helpers.ts`)
- API routes: Lowercase with hyphens in directory names (e.g., `/api/waitlist/[id]/route.ts`)
- Type/validation modules: Descriptive names in lowercase (e.g., `validations.ts`, `types.ts`)
- Library directories: Feature-based organization with hyphens (e.g., `lib/booking/`, `lib/scoring/`)

**Functions:**
- camelCase for all exported functions (e.g., `getAuthenticatedTenant()`, `computeWaitlistScore()`)
- Descriptive verbs as prefixes: `get`, `compute`, `calculate`, `score`, `create`, `update`, `format`
- Private helper functions: prefixed with underscore is NOT used; instead functions are nested or internal

**Variables:**
- camelCase for local variables and constants (e.g., `patientId`, `smartScore`, `tenantId`)
- SCREAMING_SNAKE_CASE for regex patterns and truly immutable config (e.g., `UUID_RE`)
- Database column names: snake_case (e.g., `patient_id`, `clinical_urgency`, `smart_score`)

**Types:**
- PascalCase for type names (e.g., `ClinicalUrgency`, `SmartScoreBreakdown`, `WaitlistStatus`)
- Interfaces prefixed with `I` not used; plain type names are preferred
- Union types for status enums (e.g., `export type AppointmentStatus = "scheduled" | "confirmed" | ...`)
- Record<> for lookup objects mapping string keys to values (e.g., `URGENCY_STYLES: Record<ClinicalUrgency, string>`)

## Code Style

**Formatting:**
- ESLint 9 with Next.js configuration (`eslint-config-next` core-web-vitals + typescript)
- No Prettier config found; ESLint handles linting only
- Max line length appears to be 100-120 characters based on observed code
- 2-space indentation (standard JavaScript/TypeScript)
- Semicolons required at end of statements

**Linting:**
- Config: `eslint.config.mjs` using ESM with flat config
- Enforces Next.js best practices and TypeScript strict mode
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

## Import Organization

**Order:**
1. External dependencies (React, Next.js, third-party libraries)
2. Supabase and other integrations
3. Local utilities from `@/lib/` alias
4. Local types from `@/lib/types`
5. Component imports from `@/components/`
6. Blank line between groups

**Path Aliases:**
- `@/*` → `./src/*` (tsconfig.json: `"paths": { "@/*": ["./src/*"] }`)
- All imports use absolute `@/` paths, never relative imports

**Example pattern from `/src/app/api/waitlist/route.ts`:**
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { CreateWaitlistEntrySchema, WaitlistFiltersSchema } from "@/lib/validations";
import { calculateInitialPriority, computeWaitlistScore } from "@/lib/scoring/waitlist-score";
```

## Error Handling

**Patterns:**
- Try-catch at top level of all async functions (API routes, server actions)
- Errors logged to console before returning response
- Never swallow errors silently

**API Response Pattern:**
- Success: `{ success: true, data: T }`
- Error: `{ success: false, error: { code: string, message: string, details?: unknown } }`
- Error codes: VALIDATION_ERROR, DB_ERROR, NOT_FOUND, UNAUTHORIZED, NO_TENANT, INVALID_ID, UPDATE_FAILED, INTERNAL_ERROR

**Validation:**
- Use Zod schemas for all input validation
- Call `safeParse()` before trusting data
- Return 400 with VALIDATION_ERROR if parsing fails
- Return 401 with UNAUTHORIZED if auth fails
- Return 404 with NOT_FOUND if resource missing
- Return 500 with DB_ERROR or INTERNAL_ERROR for server errors

**Example from `/src/app/api/patients/[id]/route.ts`:**
```typescript
const parsed = UpdatePatientSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
    { status: 400 }
  );
}
```

## Logging

**Framework:** Native `console` methods (no logging library)

**Patterns:**
- Log errors with context: `console.error("[Operation] error:", err)`
- Use meaningful prefixes: "Waitlist GET error:", "Appointments fetch error:", "Patient PATCH error:"
- Log at entry point to API routes for debugging
- Include relevant details (operation, error object) but not sensitive data

**Example:**
```typescript
console.error("Waitlist fetch error:", error);
console.error("Waitlist POST error:", err);
```

## Comments

**When to Comment:**
- Complex algorithms that aren't self-documenting (e.g., `computeWaitlistScore()` has algorithm explanation)
- Non-obvious business logic (e.g., "Only allow manual updates to these statuses")
- Sections of large files to separate concerns

**Style:**
- Single-line comments with `//` for section headers: `// -- Main Page --`, `// -- Types --`
- JSDoc for exported functions and types (optional but present in some files)
- Block comments for algorithm documentation (e.g., scoring functions)

**JSDoc/TSDoc:**
- Minimal usage; only on complex exported functions
- Example from `waitlist-score.ts`:
```typescript
/**
 * Smart waitlist scoring (0–100).
 * Ported from NestJS MatchingService.computeSmartScore()
 *
 * Components:
 *   urgency       (0–25)
 *   reliability   (0–25)
 *   ...
 */
```

## Function Design

**Size:**
- Most functions stay under 100 lines
- API route handlers: 60-150 lines (includes try-catch and validation)
- Utility functions: 20-80 lines
- Complex algorithms like scoring: 50-100 lines with helper functions

**Parameters:**
- Prefer objects/interfaces over multiple positional parameters
- Use `readonly` prefix on input types to signal immutability
- Example from `computeWaitlistScore()`:
```typescript
interface WaitlistScoreInput {
  readonly clinicalUrgency: ClinicalUrgency;
  readonly patientNoShows: number;
  readonly patientTotal: number;
  readonly preferredTimeSlots: readonly TimeSlot[];
  // ...
}
```

**Return Values:**
- Return objects with clearly named fields (not tuples)
- Use discriminated unions for success/error cases
- Example from `getAuthenticatedTenant()`:
```typescript
| { ok: true; data: AuthenticatedTenant }
| { ok: false; response: NextResponse }
```

## Module Design

**Exports:**
- Named exports for all utilities (never default exports except pages/routes)
- Library modules typically export 1-3 main functions + types
- Example: `waitlist-score.ts` exports `computeWaitlistScore()`, `fitLabel()`, `calculateInitialPriority()`

**Barrel Files:**
- Not heavily used; imports typically go directly to specific modules
- When present, organize by feature (e.g., `components/ui/` for shadcn components)

**Organization by Feature:**
- `lib/booking/` — booking orchestration and session management
- `lib/scoring/` — waitlist and risk scoring algorithms
- `lib/confirmation/` — appointment confirmation workflows
- `lib/integrations/` — calendar sync, CSV import, etc.
- `lib/webhooks/` — message routing and external integrations
- `lib/supabase/` — database client initialization
- `components/` — UI components organized by feature (waitlist, appointments, etc.)

## Type Strictness

**TypeScript Config (`tsconfig.json`):**
- `"strict": true` — enables all strict checks
- `"noEmit": true` — type checking only, no output
- `"isolatedModules": true` — ensures files can be transpiled independently
- `"moduleResolution": "bundler"` — modern module resolution for Next.js

**Practices:**
- Use `readonly` on object properties and arrays to signal immutability
- Function parameters are typed; no implicit `any`
- Return types always explicit on exported functions
- Generic types used where appropriate (e.g., `<T>` for paginated responses)

## Immutability

**Patterns:**
- No direct mutation of function parameters
- When modifying data, create new objects with spread operator
- Readonly types used extensively on inputs
- Example from `score-breakdown.tsx`:
```typescript
export function ScoreBreakdown({ readonly breakdown: SmartScoreBreakdown }) {
  // No modification of breakdown; only reading
}
```

---

*Convention analysis: 2026-03-03*
