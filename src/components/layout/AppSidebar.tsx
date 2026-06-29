import { NavLink } from 'react-router-dom'
import {
  Upload,
  BarChart3,
  GitCompareArrows,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Upload', icon: Upload },
  { to: '/overview', label: 'Overview', icon: BarChart3 },
  { to: '/sites', label: 'Site Comparison', icon: GitCompareArrows },
  { to: '/inverters', label: 'Inverter Drilldown', icon: Cpu },
  { to: '/timeseries', label: 'Time Series', icon: TrendingUp },
  { to: '/anomaly', label: 'Anomaly Detection', icon: AlertTriangle },
]

export default function AppSidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar-background">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-4">
        <Zap className="h-6 w-6 text-sidebar-primary" />
        <span className="text-lg font-semibold text-sidebar-foreground">
          CompDash
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => (
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
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-6 py-3">
        <p className="text-xs text-muted-foreground">
          All data stays in your browser
        </p>
      </div>
    </aside>
  )
}
