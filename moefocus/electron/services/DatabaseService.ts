import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'

export class DatabaseService
{
  private static _instance: DatabaseService
  private db: SqlJsDatabase | null = null
  private db_path: string = ''

  static get instance(): DatabaseService
  {
    if (!DatabaseService._instance)
    {
      DatabaseService._instance = new DatabaseService()
    }
    return DatabaseService._instance
  }

  get database(): SqlJsDatabase
  {
    if (!this.db)
    {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    return this.db
  }

  async initialize(): Promise<void>
  {
    const user_data_path = app.getPath('userData')
    if (!existsSync(user_data_path))
    {
      mkdirSync(user_data_path, { recursive: true })
    }

    this.db_path = join(user_data_path, 'moefocus.db')

    const SQL = await initSqlJs()

    // Try to load existing database
    if (existsSync(this.db_path))
    {
      const file_buffer = readFileSync(this.db_path)
      this.db = new SQL.Database(file_buffer)
    }
    else
    {
      this.db = new SQL.Database()
    }

    // Enable WAL and foreign keys (sql.js handles this internally)
    this.db.run('PRAGMA foreign_keys = ON')

    this.run_migrations()

    console.log('Database initialized at:', this.db_path)
  }

  private run_migrations(): void
  {
    const schema_path = join(__dirname, '../../electron/database/schema.sql')
    if (existsSync(schema_path))
    {
      const schema_sql = readFileSync(schema_path, 'utf-8')
      this.db!.run(schema_sql)
      this.save()
      console.log('Schema migrations applied.')
    }

    // Migration: add uuid column to focus_sessions (v2, Jun 2026)
    // sql.js does NOT support ALTER TABLE ADD COLUMN with UNIQUE constraint,
    // so we add a plain column then create a UNIQUE INDEX separately.
    try
    {
      const col_info = this.all("SELECT name FROM pragma_table_info('focus_sessions') WHERE name = 'uuid'")
      if (col_info.length === 0)
      {
        this.run('ALTER TABLE focus_sessions ADD COLUMN uuid TEXT')
        // Generate UUIDs for existing rows
        const null_rows = this.all('SELECT id FROM focus_sessions WHERE uuid IS NULL') as Array<{ id: number }>
        for (const row of null_rows)
        {
          this.run('UPDATE focus_sessions SET uuid = ? WHERE id = ?', [randomUUID(), row.id])
        }
        this.save()
        console.log('Migration: uuid column added to focus_sessions.')
      }

      // UNIQUE index for INSERT OR IGNORE dedup (sql.js can't add UNIQUE via ALTER TABLE)
      const idx_info = this.all("SELECT name FROM pragma_index_list('focus_sessions') WHERE name = 'idx_focus_uuid'")
      if (idx_info.length === 0)
      {
        this.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_uuid ON focus_sessions(uuid)')
        this.save()
        console.log('Migration: uuid unique index created.')
      }
    }
    catch (e)
    {
      console.log('Migration uuid:', String(e))
    }
  }

  save(): void
  {
    if (this.db)
    {
      const data = this.db.export()
      const buffer = Buffer.from(data)
      writeFileSync(this.db_path, buffer)
    }
  }

  run(sql: string, params?: unknown[]): void
  {
    if (params)
    {
      this.database.run(sql, params)
    }
    else
    {
      this.database.run(sql)
    }
    this.save()
  }

  get(sql: string, params?: unknown[]): Record<string, unknown> | undefined
  {
    const stmt = this.database.prepare(sql)
    if (params)
    {
      stmt.bind(params)
    }
    if (stmt.step())
    {
      const row = stmt.getAsObject()
      stmt.free()
      return row
    }
    stmt.free()
    return undefined
  }

  all(sql: string, params?: unknown[]): Record<string, unknown>[]
  {
    const stmt = this.database.prepare(sql)
    if (params)
    {
      stmt.bind(params)
    }
    const rows: Record<string, unknown>[] = []
    while (stmt.step())
    {
      rows.push(stmt.getAsObject())
    }
    stmt.free()
    return rows
  }

  exec(sql: string): void
  {
    this.database.run(sql)
    this.save()
  }

  close(): void
  {
    if (this.db)
    {
      this.db.close()
      this.db = null
      console.log('Database connection closed.')
    }
  }
}
