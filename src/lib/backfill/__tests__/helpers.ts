/**
 * Supabase mock factory for unit tests.
 *
 * Provides a chainable query builder that resolves to { data, error }.
 * Configure return data per table via the initialData map.
 *
 * Usage:
 *   const supabase = createMockSupabase({ appointments: [appt1, appt2] });
 *   const { data } = await supabase.from("appointments").select("*");
 */

type TableData = Record<string, unknown[]>;

interface MockQueryBuilder {
  data: unknown[] | null;
  error: null | { message: string; code: string };

  from(table: string): this;
  select(columns?: string): this;
  insert(rows: unknown): this;
  update(values: unknown): this;
  delete(): this;
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  gt(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  lt(column: string, value: unknown): this;
  lte(column: string, value: unknown): this;
  in(column: string, values: unknown[]): this;
  not(column: string, operator: string, value: unknown): this;
  is(column: string, value: unknown): this;
  limit(count: number): this;
  order(column: string, options?: { ascending?: boolean }): this;
  single(): Promise<{ data: unknown | null; error: null | { message: string; code: string } }>;
  maybeSingle(): Promise<{ data: unknown | null; error: null | { message: string; code: string } }>;
  then(
    resolve: (result: { data: unknown[] | null; error: null | { message: string; code: string } }) => void,
  ): Promise<void>;
}

export function createMockSupabase(initialData: TableData = {}): {
  from: (table: string) => MockQueryBuilder;
} {
  function createBuilder(tableData: unknown[] | null): MockQueryBuilder {
    const builder: MockQueryBuilder = {
      data: tableData,
      error: null,

      from(table: string) {
        const rows = initialData[table] ?? null;
        this.data = rows;
        return this;
      },

      select(_columns?: string) {
        return this;
      },

      insert(_rows: unknown) {
        return this;
      },

      update(_values: unknown) {
        return this;
      },

      delete() {
        return this;
      },

      eq(_column: string, _value: unknown) {
        return this;
      },

      neq(_column: string, _value: unknown) {
        return this;
      },

      gt(_column: string, _value: unknown) {
        return this;
      },

      gte(_column: string, _value: unknown) {
        return this;
      },

      lt(_column: string, _value: unknown) {
        return this;
      },

      lte(_column: string, _value: unknown) {
        return this;
      },

      in(_column: string, _values: unknown[]) {
        return this;
      },

      not(_column: string, _operator: string, _value: unknown) {
        return this;
      },

      is(_column: string, _value: unknown) {
        return this;
      },

      limit(_count: number) {
        return this;
      },

      order(_column: string, _options?: { ascending?: boolean }) {
        return this;
      },

      async single() {
        const row = Array.isArray(this.data) ? (this.data[0] ?? null) : null;
        return { data: row, error: this.error };
      },

      async maybeSingle() {
        const row = Array.isArray(this.data) ? (this.data[0] ?? null) : null;
        return { data: row, error: this.error };
      },

      async then(resolve) {
        resolve({ data: this.data, error: this.error });
      },
    };

    return builder;
  }

  const rootBuilder = createBuilder(null);

  return {
    from(table: string) {
      return rootBuilder.from(table);
    },
  };
}
