export type AppPage = 'overview' | 'test-lab' | 'workflow' | 'runs' | 'details'

export interface NavItem {
  id: AppPage
  label: string
  path: string
  description: string
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '#/overview',
    description: 'System health, recent runs & operational summary',
  },
  {
    id: 'test-lab',
    label: 'Test Lab',
    path: '#/test-lab',
    description: 'Configure and launch adversarial security tests',
  },
  {
    id: 'workflow',
    label: 'Workflow',
    path: '#/workflow',
    description: 'Interactive node-based topology canvas',
  },
  {
    id: 'runs',
    label: 'Run Explorer',
    path: '#/runs',
    description: 'Browse, filter, and inspect test run history',
  },
  {
    id: 'details',
    label: 'Run Details',
    path: '#/details',
    description: 'Verdicts, evidence redactions & sandbox isolation',
  },
]
