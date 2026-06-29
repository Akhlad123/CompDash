import * as duckdb from '@duckdb/duckdb-wasm'

let dbInstance: duckdb.AsyncDuckDB | null = null
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null

export async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (dbInstance) return dbInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
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

    dbInstance = db
    return db
  })()

  return initPromise
}

export async function query<T>(sql: string): Promise<T[]> {
  const db = await initDuckDB()
  const conn = await db.connect()
  try {
    const result = await conn.query(sql)
    const rows = result.toArray().map((row: Record<string, unknown>) => {
      const obj: Record<string, unknown> = {}
      for (const key of Object.keys(row)) {
        obj[key] = row[key]
      }
      return obj as T
    })
    return rows
  } finally {
    await conn.close()
  }
}

const CREATE_TELEMETRY_TABLE = `
  CREATE TABLE IF NOT EXISTS telemetry (
    serial_number   VARCHAR,
    site_id         VARCHAR,
    timestamp       TIMESTAMP,
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

export async function ingestData(
  rows: Record<string, unknown>[]
): Promise<void> {
  const db = await initDuckDB()
  const conn = await db.connect()
  try {
    await conn.query('DROP TABLE IF EXISTS telemetry')
    await conn.query(CREATE_TELEMETRY_TABLE)

    if (rows.length === 0) return

    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const values = batch
        .map((row) => {
          const v = (key: string): string => {
            const val = row[key]
            if (val === undefined || val === null || val === '') return 'NULL'
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
            if (typeof val === 'number') return String(val)
            return `'${String(val).replace(/'/g, "''")}'`
          }
          return `(${v('serial_number')}, ${v('site_id')}, ${v('timestamp')}, ${v('ac_voltage')}, ${v('ac_frequency')}, ${v('temperature_f')}, ${v('dc_current')}, ${v('dc_voltage')}, ${v('duration')}, ${v('energy_produced')}, ${v('sku_name')})`
        })
        .join(',\n')

      await conn.query(`
        INSERT INTO telemetry (
          serial_number, site_id, timestamp, ac_voltage, ac_frequency,
          temperature_f, dc_current, dc_voltage, duration, energy_produced, sku_name
        ) VALUES ${values}
      `)
    }
  } finally {
    await conn.close()
  }
}
