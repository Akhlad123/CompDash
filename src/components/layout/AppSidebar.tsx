import { useCallback } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Upload,
  BarChart3,
  GitCompareArrows,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Zap,
  Trash2,
  Code2,
  Rows3,
  Scissors,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { clearSession } from '@/lib/sessionStore'
import { useDataStore } from '@/store/dataStore'
import ThemeToggle from '@/components/layout/ThemeToggle'

const navItems = [
  { to: '/', label: 'Upload', icon: Upload },
  { to: '/overview', label: 'Overview', icon: BarChart3 },
  { to: '/sites', label: 'Site Comparison', icon: GitCompareArrows },
  { to: '/inverters', label: 'Inverter Drilldown', icon: Cpu },
  { to: '/timeseries', label: 'Time Series', icon: TrendingUp },
  { to: '/anomaly', label: 'Anomaly Detection', icon: AlertTriangle },
  { to: '/buckets', label: 'Bucket Analysis', icon: Rows3 },
  { to: '/clipping', label: 'Clipping Analysis', icon: Scissors },
  { to: '/developer', label: 'Developer Mode', icon: Code2 },
]

export default function AppSidebar() {
  const navigate = useNavigate()
  const isDataLoaded = useDataStore((s) => s.isDataLoaded)
  const resetData = useDataStore((s) => s.resetData)

  const handleClearSession = useCallback(async () => {
    await clearSession()
    resetData()
    navigate('/')
  }, [resetData, navigate])

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar-background">
      <div className="border-b border-sidebar-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-sidebar-primary" />
          <span className="text-lg font-semibold text-sidebar-foreground">
            CompDash
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Dashboard for analyzing Microinverter telemetry data
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => {
          const requiresData = to !== '/'
          const disabled = requiresData && !isDataLoaded
          if (disabled) {
            return (
              <span
                key={to}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
              >
                <Icon className="h-4 w-4" />
                {label}
              </span>
            )
          }
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border px-4 py-3">
        <ThemeToggle />
        {isDataLoaded && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleClearSession}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Session
          </Button>
        )}
        <p className="px-2 text-xs text-muted-foreground">
          All data stays in your browser
        </p>
      </div>
    </aside>
  )
}
