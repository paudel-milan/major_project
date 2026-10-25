// ─── Shared Types ───

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  files?: string[];        // Files affected by this message
  isError?: boolean;
  type?: 'message' | 'status' | 'plan';  // Status updates shown inline
}

export interface WSEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface BuildStatus {
  status: 'idle' | 'building' | 'ready' | 'error';
  error?: string;
  projectId?: string;
  duration?: number;
}

export interface ProviderInfo {
  name: string;
  displayName: string;
  configured: boolean;
  healthy: boolean;
  isDefault: boolean;
}

export interface ContextMetrics {
  messageTokens: number;
  summaryTokens: number;
  totalTokens: number;
  maxTokens: number;
  utilization: string;
  isOverLimit: boolean;
  previousTokens?: number;
  wasCompressed?: boolean;
  strategy?: string;
  contextHit?: boolean;
  thresholdHit?: boolean;
  summaryContent?: string;
  turnCount?: number;
  // Per-category token breakdown (estimated where exact attribution unavailable)
  categoryBreakdown?: {
    systemPrompt?: number;
    conversationHistory?: number;
    summaryMemory?: number;
    userPrompt?: number;
    codeContext?: number;
    toolDefinitions?: number;
    other?: number;
  };
  // Provider-reported vs estimated
  providerReported?: boolean;
  estimatedTokens?: number;
}

export interface AgentResponse {
  success: boolean;
  sessionId: string;
  projectId?: string;
  description?: string;
  updatedFiles?: string[];
  provider?: string;
  buildSuccess?: boolean;
  duration?: number;
  error?: string;
  contextMetrics?: ContextMetrics;
}

export interface StatusResponse {
  status: string;
  uptime: number;
  providers: ProviderInfo[];
  contextStrategy: string;
  metrics: {
    totalRequests: number;
    totalTokensEstimated: number;
    totalBuildTime: number;
    totalLLMTime: number;
    summarizations: number;
  };
}

// ─── Agent Progress Types ───

export type AgentStepName = 'understanding' | 'context' | 'planning' | 'generating' | 'validating' | 'building' | 'complete';
export type AgentStepStatus = 'pending' | 'active' | 'complete' | 'done' | 'error';

export interface AgentStep {
  id?: string;
  name: AgentStepName;
  label: string;
  status: AgentStepStatus;
  detail?: string;
  timestamp?: number;
}

export interface AgentProgressState {
  isActive: boolean;
  steps: AgentStep[];
  contextMetrics?: ContextMetrics;
}

// ─── Config Types ───

export interface ConfigInfo {
  provider: string;
  displayName: string;
  strategy: string;
  availableStrategies: string[];
  availableProviders?: ProviderInfo[];
}

