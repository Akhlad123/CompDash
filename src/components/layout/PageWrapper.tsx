import { useEffect, useState, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hasSession, loadSession } from '@/lib/sessionStore'
import { ingestData } from '@/lib/duckdb'
import { useDataStore } from '@/store/dataStore'
import AppSidebar from './AppSidebar'

function SessionRestoreBanner() {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)
  const setSites = useDataStore((s) => s.setSites)
  const setInverters = useDataStore((s) => s.setInverters)
  const setDateRange = useDataStore((s) => s.setDateRange)
  const setDataLoaded = useDataStore((s) => s.setDataLoaded)
  const navigate = useNavigate()

  const [available, setAvailable] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (!isDataLoaded) {
      hasSession().then((yes) => setAvailable(yes))
    }
  }, [isDataLoaded])

  const handleRestore = useCallback(async () => {
    setRestoring(true)
    try {
      const session = await loadSession()
      if (!session) return

      await ingestData(session.rows as unknown as Record<string, unknown>[])

      setSites(session.sites)
      setInverters(session.inverters)
      if (session.dateRange) {
        // Parse as local midnight to avoid UTC timezone shift
        const parseLocal = (s: string) => {
          const parts = s.slice(0, 10).split('-').map(Number)
          return new Date(parts[0], parts[1] - 1, parts[2])
        }
        setDateRange({
          from: parseLocal(session.dateRange.from),
          to: parseLocal(session.dateRange.to),
        })
      }
      setDataLoaded(true)
      setAvailable(false)
      navigate('/overview')
    } catch (err) {
      console.error('Session restore failed:', err)
    } finally {
      setRestoring(false)
    }
  }, [setSites, setInverters, setDateRange, setDataLoaded, navigate])

  if (!available || isDataLoaded) return null

  return (
    <div className="flex items-center justify-center gap-3 border-b border-blue-300 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200">
      {restoring ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Restoring previous session…
        </>
      ) : (
        <>
          Previous session found.
          <Button variant="outline" size="sm" onClick={handleRestore}>
            Click to restore
          </Button>
        </>
      )}
    </div>
  )
}

export default function PageWrapper() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <SessionRestoreBanner />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
