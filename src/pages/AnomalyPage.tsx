import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ExportToolbar from '@/components/export/ExportToolbar'

export default function AnomalyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Anomaly Detection</h1>
        <ExportToolbar
          elementId="anomaly-content"
          filename="compdash-anomaly"
        />
      </div>
      <div id="anomaly-content">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Anomalies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Coming soon — automated anomaly detection and flagging.
          </p>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
