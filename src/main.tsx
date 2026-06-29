import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import PageWrapper from '@/components/layout/PageWrapper'
import UploadPage from '@/pages/UploadPage'
import OverviewPage from '@/pages/OverviewPage'
import SiteComparisonPage from '@/pages/SiteComparisonPage'
import InverterDrilldownPage from '@/pages/InverterDrilldownPage'
import TimeSeriesPage from '@/pages/TimeSeriesPage'
import AnomalyPage from '@/pages/AnomalyPage'
import { applyStateFromURL } from '@/lib/shareLink'
import { useDataStore } from '@/store/dataStore'
import './index.css'

const queryClient = new QueryClient()

function SharedStateBanner() {
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)
  const [hasSharedState, setHasSharedState] = useState(false)

  useEffect(() => {
    const restored = applyStateFromURL()
    if (restored) setHasSharedState(true)
  }, [])

  if (!hasSharedState || isDataLoaded) return null

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      Load data to restore this shared view
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <HashRouter>
          <SharedStateBanner />
          <Routes>
            <Route element={<PageWrapper />}>
              <Route path="/" element={<UploadPage />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/sites" element={<SiteComparisonPage />} />
              <Route path="/inverters" element={<InverterDrilldownPage />} />
              <Route path="/timeseries" element={<TimeSeriesPage />} />
              <Route path="/anomaly" element={<AnomalyPage />} />
            </Route>
          </Routes>
        </HashRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
