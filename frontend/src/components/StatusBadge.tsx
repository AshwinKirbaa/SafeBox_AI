import React from 'react'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  MinusCircle,
  Ban,
} from 'lucide-react'
import type { AiTestStatus, InfraStatus } from '../types/safebox'

interface StatusBadgeProps {
  status: AiTestStatus | InfraStatus | 'RUNNING' | 'COMPLETED' | 'ABORTED' | null
  type?: 'ai' | 'infra' | 'state'
  size?: 'sm' | 'md' | 'lg'
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  type = 'ai',
  size = 'md',
}) => {
  if (!status) {
    return (
      <span className={`badge badge-unknown badge-${size}`}>
        <MinusCircle className="badge-icon" />
        <span>N/A</span>
      </span>
    )
  }

  let colorClass = 'badge-slate'
  let label = status as string
  let Icon = HelpCircle

  switch (status) {
    case 'PASS':
      colorClass = 'badge-pass'
      label = type === 'infra' ? 'ISOLATION PASS' : 'AI SAFETY PASS'
      Icon = CheckCircle2
      break
    case 'FAIL':
      colorClass = 'badge-fail'
      label = type === 'infra' ? 'ISOLATION BREACH' : 'VIOLATION DETECTED'
      Icon = XCircle
      break
    case 'ERROR':
      colorClass = 'badge-error'
      label = 'EXECUTION ERROR'
      Icon = AlertTriangle
      break
    case 'INCONCLUSIVE':
      colorClass = 'badge-inconclusive'
      label = 'INCONCLUSIVE'
      Icon = HelpCircle
      break
    case 'UNSUPPORTED':
      colorClass = 'badge-unsupported'
      label = 'UNSUPPORTED'
      Icon = Ban
      break
    case 'UNAVAILABLE':
      colorClass = 'badge-unavailable'
      label = 'UNAVAILABLE'
      Icon = AlertTriangle
      break
    case 'PENDING':
      colorClass = 'badge-pending'
      label = 'PENDING'
      Icon = Clock
      break
    case 'MISSING':
      colorClass = 'badge-missing'
      label = 'NOT VERIFIED (MISSING)'
      Icon = MinusCircle
      break
    case 'RUNNING':
      colorClass = 'badge-running'
      label = 'RUNNING'
      Icon = Clock
      break
    case 'COMPLETED':
      colorClass = 'badge-completed'
      label = 'COMPLETED'
      Icon = CheckCircle2
      break
    case 'ABORTED':
      colorClass = 'badge-aborted'
      label = 'ABORTED'
      Icon = XCircle
      break
  }

  return (
    <span className={`badge ${colorClass} badge-${size}`} data-testid={`status-badge-${status}`}>
      <Icon className="badge-icon" />
      <span className="badge-text">{label}</span>
    </span>
  )
}
