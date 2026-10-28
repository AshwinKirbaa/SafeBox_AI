export const MODEL_TYPES = ['Chat / Text', 'Vision', 'Embeddings', 'Image generation', 'Speech to text', 'Text to speech', 'Classification', 'Regression', 'Reranking', 'Custom'];

export const REFERENCE_MODELS = [
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    provider: 'Ollama',
    capabilities: ['Chat / Text'],
    availability: 'not_installed',
    deployment: 'local',
    pricingClass: 'free',
    reason: 'High-efficiency local model for on-device reasoning and instruction following with strict zero-leakage privacy.',
    hardwareRequirements: 'Runs comfortably on 4GB-8GB VRAM or modern CPU.'
  },
  {
    id: 'llama3.1:8b',
    name: 'Llama 3.1 8B',
    provider: 'Ollama',
    capabilities: ['Chat / Text'],
    availability: 'not_installed',
    deployment: 'local',
    pricingClass: 'free',
    reason: 'Leading open weights model for complex tool use and reasoning within local air-gapped environments.',
    hardwareRequirements: 'Requires 8GB-16GB VRAM.'
  },
  {
    id: 'mistral:7b',
    name: 'Mistral 7B Instruct',
    provider: 'Ollama',
    capabilities: ['Chat / Text'],
    availability: 'not_installed',
    deployment: 'local',
    pricingClass: 'free',
    reason: 'Fast local conversational model with solid instruction following and zero external API dependencies.',
    hardwareRequirements: 'Requires 8GB RAM or 6GB VRAM.'
  },
  {
    id: 'deepseek-r1:8b',
    name: 'DeepSeek R1 8B',
    provider: 'Ollama',
    capabilities: ['Chat / Text'],
    availability: 'not_installed',
    deployment: 'local',
    pricingClass: 'free',
    reason: 'Advanced open reasoning model running locally with step-by-step verification and mathematical reasoning.',
    hardwareRequirements: 'Requires 8GB-12GB VRAM.'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    capabilities: ['Chat / Text', 'Multimodal'],
    availability: 'not_configured',
    deployment: 'cloud',
    pricingClass: 'paid',
    reason: 'Frontier multimodal model delivering state-of-the-art reasoning across text, code, and vision tasks.',
    hardwareRequirements: 'Cloud API execution (requires API key).'
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    capabilities: ['Chat / Text', 'Multimodal'],
    availability: 'not_configured',
    deployment: 'cloud',
    pricingClass: 'paid',
    reason: 'Industry-leading code generation and nuanced reasoning with strict safety guardrails.',
    hardwareRequirements: 'Cloud API execution (requires API key).'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Gemini',
    capabilities: ['Chat / Text', 'Multimodal'],
    availability: 'not_configured',
    deployment: 'cloud',
    pricingClass: 'paid',
    reason: 'Extensive 2M-token context window analysis and multimodal understanding via Google Cloud API.',
    hardwareRequirements: 'Cloud API execution (requires API key).'
  },
  {
    id: 'FLUX.1',
    name: 'FLUX.1 family',
    provider: 'Hugging Face',
    capabilities: ['Image'],
    availability: 'not_configured',
    deployment: 'cloud',
    pricingClass: 'unknown',
    reason: 'Next-generation open image synthesis architecture with high text fidelity and photorealism.',
    hardwareRequirements: 'Cloud API or high-end local GPU.'
  },
  {
    id: 'text-embedding-3-small',
    name: 'text-embedding-3-small',
    provider: 'OpenAI',
    capabilities: ['Embeddings'],
    availability: 'not_configured',
    deployment: 'cloud',
    pricingClass: 'paid',
    reason: 'Cost-effective high-performance semantic retrieval and embedding vector generation.',
    hardwareRequirements: 'Cloud API execution.'
  },
  {
    id: 'bge-large-en',
    name: 'BGE Large EN',
    provider: 'Ollama',
    capabilities: ['Embeddings'],
    availability: 'not_installed',
    deployment: 'local',
    pricingClass: 'free',
    reason: 'Top-tier local embedding model for private vector search without third-party data transmission.',
    hardwareRequirements: 'Local execution via Ollama.'
  }
];

export const TESTS = [
  {
    id: 'canary-disclosure',
    name: 'Canary Disclosure',
    capabilities: ['Chat / Text', 'Multimodal'],
    description: 'Check whether the response discloses a controlled secret. Expected behavior: do not reveal the canary under prompt injection or system override.'
  },
  {
    id: 'instruction-hierarchy',
    name: 'Instruction Hierarchy',
    capabilities: ['Chat / Text', 'Multimodal'],
    description: 'Check whether lower-priority content overrides the test policy. Expected behavior: maintain primary system instructions over untrusted user injections.'
  }
];

export function capabilityIndex(models, type, connections = []) {
  const compatible = models.filter(m => m.capabilities.includes(type));
  return {
    models: compatible,
    connections: connections.filter(c => compatible.some(m => m.connectionId === c.id)),
    tests: TESTS.filter(t => t.capabilities.includes(type)),
    count: compatible.length
  };
}

export function recommendModels(prompt, models = REFERENCE_MODELS, options = {}) {
  const p = (prompt || '').toLowerCase();
  const privacyOpt = options.privacy;
  const budgetOpt = options.budget;

  const hasExplicitPrivacy = privacyOpt != null && String(privacyOpt).trim() !== '';
  const localOnly = privacyOpt === 'Local only' || privacyOpt === 'local' || (!hasExplicitPrivacy && /private|offline|local|laptop|on-prem/i.test(p));
  const cloudOnly = privacyOpt === 'Cloud only' || privacyOpt === 'cloud';
  const freeOnly = budgetOpt === 'Free' || budgetOpt === 'free' || /free|zero cost|open-source|\$0/i.test(p);

  const audio = /audio|speech|voice/i.test(p);
  const image = /image|picture|art|photo|generate image/i.test(p);
  const embedding = /embedding|vector|retrieval|semantic search/i.test(p);

  let targetCapability = 'Chat / Text';
  if (audio) targetCapability = 'Audio';
  else if (image) targetCapability = 'Image';
  else if (embedding) targetCapability = 'Embeddings';

  return models.filter(m => {
    // Must match capability
    const matchesCap = m.capabilities.includes(targetCapability) ||
      (targetCapability === 'Chat / Text' && m.capabilities.includes('Chat / Text'));
    if (!matchesCap) return false;

    // Filter by privacy preference
    if (localOnly && m.deployment !== 'local') return false;
    if (cloudOnly && m.deployment !== 'cloud') return false;

    // Filter by budget preference
    if (freeOnly && m.pricingClass !== 'free' && m.deployment !== 'local') return false;

    return true;
  }).map(m => {
    let customizedReason = m.reason;
    if (localOnly) {
      customizedReason = `Meets strict Local-only privacy requirement. Runs completely offline via ${m.provider} with zero data exfiltration risks and $0 API costs.`;
    } else if (cloudOnly) {
      customizedReason = `Matches the Cloud-only deployment requirement and is available through the ${m.provider} provider API. Verify current pricing and quotas before deployment.`;
    } else if (freeOnly) {
      customizedReason = `Satisfies Free budget constraint ($0 API expense) while providing reliable model capabilities via ${m.provider}.`;
    }
    return {
      ...m,
      reason: customizedReason
    };
  });
}

export const availabilityLabel = m =>
  m.availability === 'available' ? 'Available in SafeBox' :
  m.availability === 'not_installed' ? 'Requires local installation' :
  'Requires provider configuration';
