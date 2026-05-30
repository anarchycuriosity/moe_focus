declare module 'sql.js'
{
  interface QueryExecResult
  {
    columns: string[]
    values: unknown[][]
  }

  interface Statement
  {
    bind(params?: unknown[] | Record<string, unknown>): boolean
    step(): boolean
    getAsObject<T = Record<string, unknown>>(): T
    free(): boolean
    reset(): void
  }

  interface Database
  {
    run(sql: string, params?: unknown[]): Database
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
    getRowsModified(): number
  }

  interface SqlJsStatic
  {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }

  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>
  export type { Database, Statement, QueryExecResult, SqlJsStatic }
}
