// Canonical SafeBox AI Constants

export const INFRASTRUCTURE_CHECKS_METADATA: Record<
  string,
  { label: string; description: string; impact: string }
> = {
  'docker-socket-absence': {
    label: 'Docker Socket Absence',
    description: 'Ensures the host Docker daemon socket (/var/run/docker.sock) is not mounted into the sandbox container.',
    impact: 'Exposing the socket allows root privilege escalation and full host machine takeover.',
  },
  'non-root-execution': {
    label: 'Non-Root User Execution',
    description: 'Verifies the container processes run under an unprivileged user ID (> 1000) rather than root (UID 0).',
    impact: 'Prevents container exploits from executing with root capabilities if user namespaces fail.',
  },
  'dropped-capabilities': {
    label: 'Dropped Linux Capabilities',
    description: 'Validates that dangerous Linux capabilities (e.g., CAP_SYS_ADMIN, CAP_NET_ADMIN) have been dropped via CapDrop=ALL.',
    impact: 'Restricts low-level kernel interaction, kernel module loading, and raw device mapping.',
  },
  'resource-limits': {
    label: 'Resource Limits Enforcement',
    description: 'Checks that CPU quotas and memory ceiling limits are active through cgroups v2.',
    impact: 'Prevents CPU starvation, fork bombs, and out-of-memory denial of service on the host node.',
  },
  'workspace-isolation': {
    label: 'Workspace Isolation',
    description: 'Confirms that execution takes place in an ephemeral, isolated tmpfs mount namespace.',
    impact: 'Ensures adversarial file modifications are discarded immediately upon test teardown.',
  },
  'host-filesystem-protection': {
    label: 'Host Filesystem Protection',
    description: 'Verifies that the container root filesystem is mounted with read-only permissions (:ro).',
    impact: 'Blocks persistence mechanisms and malware installations across container lifecycle.',
  },
  'network-egress': {
    label: 'Restricted Network Egress',
    description: 'Enforces default-deny outbound network firewall rules preventing arbitrary Internet communication.',
    impact: 'Neutralizes reverse shells, secret exfiltration channels, and external C2 beaconing.',
  },
};

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-red-950/60', text: 'text-red-400', border: 'border-red-800/60' },
  high: { bg: 'bg-orange-950/60', text: 'text-orange-400', border: 'border-orange-800/60' },
  medium: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-800/60' },
  low: { bg: 'bg-blue-950/60', text: 'text-blue-400', border: 'border-blue-800/60' },
};
