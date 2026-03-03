# Testing Patterns

**Analysis Date:** 2026-03-03

## Test Framework

**Status:** No test framework currently configured

**Key Finding:**
- `package.json` has no test script (`npm test` not defined)
- No test runner installed (Jest, Vitest, Cypress, etc.)
- No test files found in codebase (`src/**/*.test.ts`, `src/**/*.spec.ts`)
- No test configuration files (`jest.config.*`, `vitest.config.*`)

**Current State:**
- Linting only: `npm run lint` runs ESLint
- Build verification: `npm run build` runs TypeScript type check via Next.js
- No automated test suite

## Minimum Test Coverage Requirement

**Target:** 80% coverage (per user guidelines)

**Priority areas to test when implementing test suite:**
1. **API Routes** (`src/app/api/`) — All handlers need unit tests for validation, auth, DB operations
2. **Validation Schemas** (`src/lib/validations.ts`) — Zod schema parsing edge cases
3. **Scoring Algorithms** (`src/lib/scoring/`) — Critical business logic for risk/waitlist scoring
4. **Utility Functions** (`src/lib/`) — Helper functions and calculations
5. **React Components** (`src/components/`) — User interactions, state management

## Test File Organization

**Recommended Pattern:**
- Location: Co-located next to source files
- Naming: `[filename].test.ts` or `[filename].spec.ts`
- Example structure:
```
src/
├── lib/
│   ├── scoring/
│   │   ├── waitlist-score.ts
│   │   └── waitlist-score.test.ts
│   ├── auth-helpers.ts
│   └── auth-helpers.test.ts
├── components/
│   └── waitlist/
│       ├── urgency-badge.tsx
│       └── urgency-badge.test.tsx
```

**Test directories:**
- No separate `tests/` or `__tests__/` directory observed
- Keep tests alongside implementation for maintainability

## Recommended Test Runner Setup

**Framework recommendation:** Vitest
- Fast (uses Vite transformation)
- Great TypeScript support
- Jest-compatible API (easier migration if needed)
- React Testing Library for component tests

**Configuration file to create:** `vitest.config.ts`
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Install devDependencies:**
```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8
npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom
npm install --save-dev @types/vitest
```

**Add to package.json scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## Test Structure Pattern

**Standard suite organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { computeWaitlistScore } from "@/lib/scoring/waitlist-score";

describe("computeWaitlistScore", () => {
  describe("urgency scoring", () => {
    it("should return 25 for critical urgency", () => {
      const result = computeWaitlistScore({
        clinicalUrgency: "critical",
        patientNoShows: 0,
        patientTotal: 5,
        preferredTimeSlots: [],
        createdAt: new Date(),
        distanceKm: null,
        preferredProvider: null,
        paymentCategory: null,
      });
      expect(result.urgency).toBe(25);
    });

    it("should return 0 for none urgency", () => {
      // Test setup...
    });
  });

  describe("reliability scoring", () => {
    it("should return 12 for patients with insufficient history", () => {
      // Test...
    });
  });
});
```

**Key patterns:**
- `describe()` blocks for grouping related tests
- `it()` for individual test cases (not `test()`)
- Clear test names describing behavior
- One assertion focus per test (when possible)
- Setup shared state in `beforeEach`, cleanup in `afterEach`

## API Route Testing Pattern

**Location:** `src/app/api/waitlist/route.test.ts`

**Pattern with Vitest + MSW (Mock Service Worker) for HTTP mocking:**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET, POST } from "@/app/api/waitlist/route";
import { createClient } from "@/lib/supabase/server";

// Mock Supabase
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/auth-helpers");

describe("GET /api/waitlist", () => {
  it("should return 401 if not authenticated", async () => {
    const { default: handler } = await import("@/app/api/waitlist/route");
    // Mock auth to return not ok
    // Call handler with mock request
    // Assert 401 response
  });

  it("should return paginated waitlist entries", async () => {
    // Mock successful auth
    // Mock Supabase query
    // Assert response structure: { success, data, total, page, pageSize, totalPages }
  });

  it("should filter by status when provided", async () => {
    // Test with ?status=waiting query param
    // Verify Supabase query includes eq("status", "waiting")
  });
});

describe("POST /api/waitlist", () => {
  it("should validate input with CreateWaitlistEntrySchema", async () => {
    // Test with invalid body
    // Assert 400 with VALIDATION_ERROR
  });

  it("should create waitlist entry and compute smart score", async () => {
    // Mock successful auth and patient lookup
    // POST valid data
    // Assert 201 with computed smart_score in response
  });
});
```

## Mocking Strategy

**Framework:** Vitest's built-in `vi` mock utilities

**What to Mock:**
- Database calls (Supabase client)
- External API calls (Twilio, Stripe, etc.)
- Authentication (getAuthenticatedTenant)
- Environment variables
- Current time (Date.now() for scoring tests)

**What NOT to Mock:**
- Core business logic (scoring functions, validation)
- Type definitions
- Constants and configuration
- Internal utility functions (unless they're expensive)

**Mocking Supabase:**
```typescript
import { vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((table) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "123", name: "Test" },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "123" },
        error: null,
      }),
    })),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user123" } },
      }),
    },
  })),
}));
```

**Mocking authentication:**
```typescript
vi.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedTenant: vi.fn(() =>
    Promise.resolve({
      ok: true,
      data: { tenantId: "tenant123", userId: "user123" },
    })
  ),
}));
```

## Fixtures and Test Data

**Recommended location:** `src/__tests__/fixtures/` or co-located `fixtures.ts` in same directory as tests

**Example factory functions:**
```typescript
// src/__tests__/fixtures/patients.ts
export function createMockPatient(overrides = {}) {
  return {
    id: "patient-123",
    tenant_id: "tenant-123",
    first_name: "John",
    last_name: "Doe",
    email: "john@example.com",
    phone: "+1234567890",
    preferred_channel: "email" as const,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// src/__tests__/fixtures/waitlist.ts
export function createMockWaitlistEntry(overrides = {}) {
  return {
    id: "entry-123",
    tenant_id: "tenant-123",
    patient_id: "patient-123",
    service_name: "Consultation",
    clinical_urgency: "medium" as const,
    smart_score: 65,
    status: "waiting" as const,
    priority_score: 70,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
```

## Validation Testing

**Focus areas for `validations.ts`:**

```typescript
import { describe, it, expect } from "vitest";
import {
  CreatePatientSchema,
  CreateAppointmentSchema,
  CreateWaitlistEntrySchema,
} from "@/lib/validations";

describe("CreatePatientSchema", () => {
  it("should accept valid patient data", () => {
    const result = CreatePatientSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty first_name", () => {
    const result = CreatePatientSchema.safeParse({
      first_name: "",
      last_name: "Doe",
    });
    expect(result.success).toBe(false);
  });

  it("should enforce email format", () => {
    const result = CreatePatientSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
  });
});
```

## Scoring Algorithm Tests

**Location:** `src/lib/scoring/waitlist-score.test.ts`

**Test cases for `computeWaitlistScore()`:**

```typescript
describe("computeWaitlistScore", () => {
  describe("urgency component", () => {
    it("scores critical urgency at 25 points", () => { /* ... */ });
    it("scores high urgency at 22 points", () => { /* ... */ });
    it("scores none urgency at 0 points", () => { /* ... */ });
  });

  describe("reliability component", () => {
    it("returns 12 (neutral) when patient has < 2 appointments", () => { /* ... */ });
    it("calculates (1 - noShows/total) * 25 for sufficient history", () => { /* ... */ });
  });

  describe("time preference matching", () => {
    it("returns 20 when slot matches preferred time", () => { /* ... */ });
    it("returns 0 when slot doesn't match preferences", () => { /* ... */ });
    it("returns 10 (flexible) when no preferences set", () => { /* ... */ });
  });

  describe("distance component", () => {
    it("returns 10 for distances <= 5 km", () => { /* ... */ });
    it("returns 5 for distances 5-15 km", () => { /* ... */ });
    it("returns 0 for distances > 15 km", () => { /* ... */ });
    it("returns 5 (neutral) when distance unknown", () => { /* ... */ });
  });

  describe("total score calculation", () => {
    it("caps score at 100 maximum", () => { /* ... */ });
    it("calculates correct breakdown of all components", () => { /* ... */ });
  });
});
```

## Component Testing Pattern

**Location:** `src/components/waitlist/urgency-badge.test.tsx`

**With React Testing Library:**

```typescript
import { render, screen } from "@testing-library/react";
import { UrgencyBadge } from "@/components/waitlist/urgency-badge";

describe("UrgencyBadge", () => {
  it("renders badge with correct urgency level", () => {
    render(<UrgencyBadge urgency="critical" />);
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("applies correct styling for each urgency level", () => {
    const { rerender } = render(<UrgencyBadge urgency="none" />);
    let badge = screen.getByText("none");
    expect(badge).toHaveClass("bg-gray-50");

    rerender(<UrgencyBadge urgency="critical" />);
    badge = screen.getByText("critical");
    expect(badge).toHaveClass("bg-red-50");
  });

  it("renders all supported urgency levels", () => {
    const urgencies = ["none", "low", "medium", "high", "critical"] as const;
    urgencies.forEach((urgency) => {
      const { unmount } = render(<UrgencyBadge urgency={urgency} />);
      expect(screen.getByText(urgency)).toBeInTheDocument();
      unmount();
    });
  });
});
```

## Coverage Goals

**By module type:**
- **Validation schemas:** 100% (every enum, regex, constraint)
- **Scoring algorithms:** 95%+ (all branches, edge cases)
- **API routes:** 80%+ (happy path + error cases)
- **Utility functions:** 80%+
- **Components:** 80%+ (user interactions + state changes)
- **UI components (shadcn):** Not required (third-party)

**View coverage report:**
```bash
npm run test:coverage
# Coverage report generated in coverage/
```

## Test Types

**Unit Tests:**
- Scope: Individual functions in isolation
- Tools: Vitest
- Examples: Scoring functions, validation schemas, utility functions
- Target: 80%+ coverage of business logic

**Integration Tests:**
- Scope: API routes with mocked Supabase, full request/response cycle
- Tools: Vitest + MSW for HTTP mocking
- Examples: POST /api/waitlist with database interactions
- Target: Critical paths (create, update, delete operations)

**E2E Tests:**
- Scope: User flows through UI
- Tools: Playwright (recommended, not yet configured)
- Examples: User logs in → creates appointment → receives confirmation
- Target: 3-5 critical user journeys (not required initially)

## Example Test Commands

**Once framework is set up:**
```bash
# Run all tests
npm test

# Watch mode (development)
npm test -- --watch

# Run specific test file
npm test -- waitlist-score.test.ts

# Run with UI dashboard
npm run test:ui

# Generate coverage report
npm run test:coverage

# Run tests matching pattern
npm test -- --grep "urgency"
```

## Test-Driven Development (TDD) Workflow

**Mandatory process for new features:**

1. **RED** — Write failing test
   ```typescript
   it("should accept critical urgency in waitlist", () => {
     const result = CreateWaitlistEntrySchema.safeParse({
       // ...
       clinical_urgency: "critical",
     });
     expect(result.success).toBe(true);
   });
   ```

2. **GREEN** — Implement minimal code to pass test
   ```typescript
   export const CreateWaitlistEntrySchema = z.object({
     // ...
     clinical_urgency: z.enum(["none", "low", "medium", "high", "critical"]),
   });
   ```

3. **REFACTOR** — Improve code quality
   - Extract helper functions
   - Improve naming
   - Reduce duplication

4. **Verify** — Check 80%+ coverage
   ```bash
   npm run test:coverage
   ```

## Current Test Debt

**Actions needed to implement testing:**
1. Install Vitest and testing libraries (see setup above)
2. Create `vitest.config.ts` configuration
3. Add test scripts to `package.json`
4. Implement fixtures in `src/__tests__/fixtures/`
5. Start with scoring algorithms (highest business value)
6. Progress to API routes, validation, then components
7. Aim for 80% coverage across all modules

---

*Testing analysis: 2026-03-03*
