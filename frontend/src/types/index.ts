// ─── Shared Types ───

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  files?: string[];        // Files affected by this message
  isError?: boolean;
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
  contextMetrics?: {
    messageTokens: number;
    summaryTokens: number;
    totalTokens: number;
    maxTokens: number;
    utilization: string;
    isOverLimit: boolean;
  };
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
