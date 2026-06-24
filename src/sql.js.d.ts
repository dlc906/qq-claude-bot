declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }

  interface Database {
    run(sql: string, params?: unknown[]): Database
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  interface Statement {
    bind(params?: unknown[]): boolean
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): void
  }

  interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export default function initSqlJs(): Promise<SqlJsStatic>
  export { SqlJsStatic, Database, Statement, QueryExecResult }
}

declare module 'pdf-parse' {
  interface PdfResult {
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: unknown
    text: string
    version: string
  }
  function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PdfResult>
  export default pdfParse
}
