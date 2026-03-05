// Copyright © 2025 Aimone Vittorio Pitacco. NowShow™.
// Proprietary and confidential. All rights reserved.

/**
 * Supabase mock factory for unit tests.
 *
 * Provides a chainable query builder that resolves to { data, error }.
 * Configure return data per table via the initialData map.
 *
 * Each call to .from() returns a fresh builder instance so concurrent
 * queries do not share state (which mirrors the real Supabase client).
 *
 * Usage:
 *   const supabase = createMockSupabase({ appointments: [appt1, appt2] });
 *   const { data } = await supabase.from("appointments").select("*");
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type TableData = Record<string, unknown[]>;
type MockResult = { data: unknown[] | null; error: null | { message: string; code: string } };

class MockQueryBuilder implements PromiseLike<MockResult> {
  private _data: unknown[];
  private readonly _error: null | { message: string; code: string };

  constructor(data: unknown[], error: null | { message: string; code: string } = null) {
    this._data = [...data];
    this._error = error;
  }

  select(_columns?: string): this {
    return this;
  }

  insert(_rows: unknown): this {
    return this;
  }

  update(_values: unknown): this {
    return this;
  }

  delete(): this {
    return this;
  }

  eq(_column: string, _value: unknown): this {
    return this;
  }

  neq(_column: string, _value: unknown): this {
    return this;
  }

  gt(_column: string, _value: unknown): this {
    return this;
  }

  gte(_column: string, _value: unknown): this {
    return this;
  }

  lt(_column: string, _value: unknown): this {
    return this;
  }

  lte(_column: string, _value: unknown): this {
    return this;
  }

  in(_column: string, _values: unknown[]): this {
    return this;
  }

  not(_column: string, _operator: string, _value: unknown): this {
    return this;
  }

  is(_column: string, _value: unknown): this {
    return this;
  }

  limit(count: number): this {
    this._data = this._data.slice(0, count);
    return this;
  }

  order(_column: string, _options?: { ascending?: boolean }): this {
    return this;
  }

  async single(): Promise<{ data: unknown | null; error: null | { message: string; code: string } }> {
    const row = this._data[0] ?? null;
    return { data: row, error: this._error };
  }

  async maybeSingle(): Promise<{ data: unknown | null; error: null | { message: string; code: string } }> {
    const row = this._data[0] ?? null;
    return { data: row, error: this._error };
  }

  then<TResult1 = MockResult, TResult2 = never>(
    onfulfilled?: ((value: MockResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result: MockResult = { data: this._data, error: this._error };
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }
}

/**
 * Creates a minimal Supabase client mock for unit testing.
 * Each call to .from() returns a fresh, independent builder so multiple
 * awaited queries within one function call do not interfere.
 *
 * @param tableData - Map of table name to array of rows
 */
export function createMockSupabase(tableData: TableData = {}): SupabaseClient {
  const mock = {
    from(table: string): MockQueryBuilder {
      const data = tableData[table] ?? [];
      return new MockQueryBuilder(data);
    },
  };

  return mock as unknown as SupabaseClient;
}
