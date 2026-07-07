import * as duckdb from '@duckdb/duckdb-wasm'

// Store on globalThis so the instance survives Vite HMR module replacement
const g = globalThis as unknown as {
  __duckdb_instance?: duckdb.AsyncDuckDB
  __duckdb_promise?: Promise<duckdb.AsyncDuckDB>
}

export async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (g.__duckdb_instance) return g.__duckdb_instance
  if (g.__duckdb_promise) return g.__duckdb_promise

  g.__duckdb_promise = (async () => {
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker!}");`], {
        type: 'text/javascript',
      })
    )

    const worker = new Worker(workerUrl)
    const logger = new duckdb.ConsoleLogger()
    const db = new duckdb.AsyncDuckDB(logger, worker)
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
    URL.revokeObjectURL(workerUrl)

    g.__duckdb_instance = db
    return db
  })()

  return g.__duckdb_promise
}

function coerceRow(raw: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(raw)) {
    if (val === null || val === undefined) {
      obj[key] = null
    } else if (typeof val === 'bigint') {
      obj[key] = Number(val)
    } else if (val instanceof Date) {
      obj[key] = val.toISOString()
    } else if (typeof val === 'object' && val !== null && 'getTime' in val) {
      // Some polyfill Date-like objects
      obj[key] = String(val)
    } else {
      obj[key] = val
    }
  }
  return obj
}

export async function query<T>(sql: string): Promise<T[]> {
  const db = await initDuckDB()
  const conn = await db.connect()
  try {
    const result = await conn.query(sql)
    const numRows = Number(result.numRows)
    if (numRows === 0) return []

    const rows: T[] = new Array(numRows)
    const arrowRows = result.toArray()

    for (let i = 0; i < numRows; i++) {
      const arrow = arrowRows[i]
      // toJSON() converts Arrow StructRow to a plain JS object
      let plain: Record<string, unknown>
      if (typeof arrow.toJSON === 'function') {
        plain = arrow.toJSON() as Record<string, unknown>
      } else {
        // Fallback: manually extract using schema field names
        const colNames = result.schema.fields.map((f) => f.name)
        plain = {} as Record<string, unknown>
        for (const col of colNames) {
          try { plain[col] = arrow[col] } catch { plain[col] = null }
        }
      }
      rows[i] = coerceRow(plain) as T

      if (i === 0) {
        console.log('[DuckDB query] sample row:', JSON.stringify(rows[0]))
      }
    }
    return rows
  } catch (err) {
    const msg = err instanceof Error ? (err.message || err.stack || String(err)) : JSON.stringify(err)
    // If table doesn't exist yet, return empty — data hasn't been uploaded
    if (msg.includes('does not exist')) {
      console.warn('[DuckDB] Table not found — data not yet loaded. Returning empty.')
      return []
    }
    console.error('[DuckDB query error]', sql.slice(0, 200), '|', msg, '| Full SQL:', sql)
    throw new Error(`DuckDB query failed: ${msg}`)
  } finally {
    await conn.close()
  }
}

const CREATE_TELEMETRY_TABLE = `
  CREATE TABLE IF NOT EXISTS telemetry (
    serial_number   VARCHAR,
    site_id         VARCHAR,
    timestamp       TIMESTAMP,
    local_date      VARCHAR,
    ac_voltage      DOUBLE,
    ac_frequency    DOUBLE,
    temperature_f   DOUBLE,
    dc_current      DOUBLE,
    dc_voltage      DOUBLE,
    duration        DOUBLE,
    energy_produced DOUBLE,
    sku_name        VARCHAR
  )
`

function sanitize(val: unknown): string {
  if (val === undefined || val === null || val === '') return 'NULL'
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 'NULL'
    return String(val)
  }
  if (typeof val === 'string') {
    const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "''")
    return `'${escaped}'`
  }
  return 'NULL'
}

export async function ingestData(
  rows: Record<string, unknown>[]
): Promise<void> {
  console.log(`[ingestData] Starting ingest of ${rows.length} rows`)
  const db = await initDuckDB()
  const conn = await db.connect()
  try {
    await conn.query('DROP TABLE IF EXISTS telemetry')
    await conn.query(CREATE_TELEMETRY_TABLE)

    if (rows.length === 0) return

    const COLS = [
      'serial_number', 'site_id', 'timestamp', 'local_date', 'ac_voltage', 'ac_frequency',
      'temperature_f', 'dc_current', 'dc_voltage', 'duration', 'energy_produced', 'sku_name',
    ] as const

    const batchSize = 500
    let skippedRows = 0
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const values = batch
        .map((row) => `(${COLS.map((c) => sanitize(row[c])).join(', ')})`)
        .join(',\n')

      try {
        await conn.query(`INSERT INTO telemetry (${COLS.join(', ')}) VALUES ${values}`)
      } catch {
        // Batch failed — try inserting rows individually to salvage good ones
        for (const row of batch) {
          const singleValue = `(${COLS.map((c) => sanitize(row[c])).join(', ')})`
          try {
            await conn.query(`INSERT INTO telemetry (${COLS.join(', ')}) VALUES ${singleValue}`)
          } catch {
            skippedRows++
          }
        }
      }

      if (i % 10000 === 0 && i > 0) {
        console.log(`[ingestData] Inserted ${i} / ${rows.length} rows`)
      }
    }
    if (skippedRows > 0) {
      console.warn(`[ingestData] Skipped ${skippedRows} malformed rows`)
    }
    // Deduplicate: keep one row per (serial_number, timestamp)
    const beforeCount = await conn.query('SELECT COUNT(*) AS cnt FROM telemetry')
    const beforeRows = Number(beforeCount.toArray()[0]?.cnt ?? 0)

    await conn.query(`
      CREATE TABLE telemetry_dedup AS
      SELECT * FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY serial_number, timestamp ORDER BY energy_produced DESC) AS rn
        FROM telemetry
      ) WHERE rn = 1
    `)
    await conn.query('DROP TABLE telemetry')
    await conn.query('ALTER TABLE telemetry_dedup RENAME TO telemetry')
    // Drop the helper column
    await conn.query('ALTER TABLE telemetry DROP COLUMN rn')

    const afterCount = await conn.query('SELECT COUNT(*) AS cnt FROM telemetry')
    const afterRows = Number(afterCount.toArray()[0]?.cnt ?? 0)
    const removed = beforeRows - afterRows
    if (removed > 0) {
      console.warn(`[ingestData] Deduplication removed ${removed} duplicate rows (${beforeRows} → ${afterRows})`)
    }

    console.log(`[ingestData] Complete: ${afterRows} rows in table`)
  } catch (err) {
    console.error('[ingestData] Fatal error:', err)
    throw err
  } finally {
    await conn.close()
  }
}
