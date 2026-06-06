export interface ClaudeUsageRecord {
  timestamp: string;
  version?: string;
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    model?: string;
    id?: string;
  };
  costUSD?: number;
  requestId?: string;
  isApiErrorMessage?: boolean;
  // --- Fields populated by the loader from each record's source .jsonl file ---
  // (a single .jsonl file == a single Claude Code conversation/session)
  _sessionId?: string;
  _projectName?: string;
  _projectPath?: string;
  _gitBranch?: string;
}

export interface UsageData {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
  // Cost split by token type (the four sum to totalCost).
  costBreakdown: {
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
  };
  messageCount: number;
  modelBreakdown: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    cost: number;
    count: number;
  }>;
}

export interface SessionData extends UsageData {
  sessionStart: Date;
  sessionEnd: Date;
}

// Per-conversation breakdown: one entry per Claude Code session (.jsonl file).
export interface SessionUsage {
  sessionId: string;
  projectName: string;
  projectPath: string;
  startTime: Date;
  endTime: Date;
  data: UsageData;
  // Largest context window observed in the session
  // (input + cache read + cache creation tokens of a single request).
  peakContextTokens: number;
}

// Per-project breakdown: usage aggregated across every session of a project.
export interface ProjectUsage {
  projectName: string;
  projectPath: string;
  sessionCount: number;
  firstSeen: Date;
  lastSeen: Date;
  data: UsageData;
}

// A group of projects. Projects are grouped by their enclosing git repository
// when one exists, otherwise by their top-level project folder. Projects whose
// paths differ only in case are merged into a single child.
export interface ProjectGroup {
  groupName: string;
  groupPath: string;
  isGitRepo: boolean;
  projectCount: number;
  sessionCount: number;
  firstSeen: Date;
  lastSeen: Date;
  data: UsageData;
  children: ProjectUsage[];
}

// One slice of the content-consumption analysis (a category, or a single tool).
export interface ContentSlice {
  key: string;
  estimatedTokens: number;
  charCount: number;
  count: number;
}

// Estimated breakdown of which conversation content consumes tokens. Token
// figures are estimated from character counts, so treat them as approximate —
// the relative shares are the reliable signal.
export interface ContentAnalysis {
  categories: ContentSlice[];
  toolResultBreakdown: ContentSlice[];
  totalEstimatedTokens: number;
  // Recent user prompts (last 30 days), for the AI-advice feature. Each carries
  // its working directory so advice can be scoped to a project.
  recentPrompts: { cwd: string; text: string }[];
}

export interface ExtensionConfig {
  refreshInterval: number;
  dataDirectory: string;
  language: string;
  decimalPlaces: number;
  compactNumbers: boolean;
  // IANA timezone name (e.g. "Asia/Hong_Kong") used for date display, or ''
  // to use the system timezone. Useful for users in devcontainers or
  // sandboxes whose system zone doesn't match their actual zone.
  timezone: string;
  // Fetch real 5-hour / weekly limit utilisation via Claude Code's OAuth session.
  usageLimitTracking: boolean;
  // LLM "usage advice" feature (OpenAI-compatible endpoint, e.g. DeepSeek).
  adviceApiKey: string;
  adviceApiUrl: string;
  adviceModel: string;
  // Reasoning effort for advice models that support it ('', 'high', 'max').
  adviceReasoningEffort: string;
  // Run the (CPU-heavy) content/prompt-token analysis. When false the Content
  // tab is hidden and the analysis is skipped during refresh.
  enableContentAnalysis: boolean;
  // How the Projects tab groups working directories:
  //   - 'git'    group by enclosing git repository (default; current behaviour)
  //   - 'folder' group by the heuristic top-level project folder only
  //   - 'flat'   no grouping; every working directory is its own row
  projectGroupingMode: 'git' | 'folder' | 'flat';
  // Watch log files and refresh within ~1.5s of each new message. When false
  // the extension falls back to the interval-based refresh, which is calmer
  // but lags behind real-time.
  fileWatching: boolean;
  // Skip the dashboard webview on auto-refreshes (status bar still updates).
  // Use when the constantly-reloading dashboard interferes with reading
  // numbers while an agent is actively writing.
  pauseDashboardRefresh: boolean;
  // Which plan ceiling to use for the 5-hour windows tab.
  // 'auto' infers the plan from usage patterns.
  usagePlan: 'auto' | 'pro' | 'max5x' | 'max20x' | 'team' | 'custom';
  // Token ceiling per 5-hour window when usagePlan = 'custom'.
  customTokenLimit: number;
}

export interface ModelPricing {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_creation_input_token_cost?: number;
  cache_read_input_token_cost?: number;
}

export type SupportedLanguage = 'en' | "de-DE" | 'zh-TW' | 'zh-CN' | 'ja' | 'ko';

// Per-git-branch usage aggregate.
export interface BranchUsage {
  branch: string;
  projectName: string;
  projectPath: string;
  sessionCount: number;
  lastSeen: Date;
  data: UsageData;
}

// A reconstructed 5-hour usage window ("block"), rebuilt from JSONL timestamps
// the same way ccusage does. Anthropic does not store the historical
// percentage anywhere local, so `percent` is an ESTIMATE based on
// community-measured plan ceilings (published limits are unofficial but
// well-documented from user measurements). The `percentIsLive` flag marks the
// active window when the real /usage utilisation is available to override it.
export interface FiveHourBlock {
  // Exact first-message timestamp (no hour-flooring), and its hard end
  // (start + 5h). `lastActivity` is the timestamp of the final message.
  start: Date;
  end: Date;
  lastActivity: Date;
  // True when `end` is still in the future (this is the window you are in now).
  isActive: boolean;
  data: UsageData;
  // Tokens counted toward the limit (input + output + cache create + cache read).
  limitTokens: number;
  // Plan ceiling used as 100% for this block (community-measured, unofficial).
  planLimit: number;
  // Which plan was inferred for this block.
  detectedPlan: 'pro' | 'max5x' | 'max20x' | 'team' | 'custom' | 'unknown';
  // Estimated fraction of the limit consumed (0–100). May exceed 100 if the
  // ceiling estimate is wrong for your specific account.
  percent: number;
  // True when this block's percent was set from the live OAuth utilisation.
  percentIsLive: boolean;
}

// A calendar week (Mon–Sun) containing the 5-hour blocks that started in it.
export interface WeeklyBlockGroup {
  weekStart: Date;
  weekKey: string;
  data: UsageData;
  blocks: FiveHourBlock[];
  // Peak single-block percent in the week.
  peakPercent: number;
  // Tokens counted toward the weekly (7-day) limit this week.
  weeklyTokens: number;
  // Community-measured 7-day ceiling for this week's dominant plan (unofficial).
  weeklyLimit: number;
  // Estimated fraction of the weekly limit consumed (0–100).
  weeklyPercent: number;
  // Whether weeklyPercent was set from the live /usage seven_day utilisation.
  weeklyPercentIsLive: boolean;
  // Plan used to pick weeklyLimit ('custom'/'unknown' when not inferable).
  weeklyPlan: 'pro' | 'max5x' | 'max20x' | 'team' | 'custom' | 'unknown';
}

// A detected transition from one plan to another, inferred from usage patterns.
export interface PlanTransition {
  date: Date;
  from: 'pro' | 'max5x' | 'max20x' | 'unknown';
  to: 'pro' | 'max5x' | 'max20x';
}

// OAuth credentials written by Claude Code at ~/.claude/.credentials.json.
export interface ClaudeCredentials {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

// One limit window from api.anthropic.com/api/oauth/usage.
export interface ClaudeUsageLimit {
  utilization: number; // 0-100
  resets_at: string; // ISO timestamp
}

// Response from the OAuth usage endpoint (mirrors what /usage shows).
export interface ClaudeApiUsageResponse {
  five_hour?: ClaudeUsageLimit;
  seven_day?: ClaudeUsageLimit;
  seven_day_opus?: ClaudeUsageLimit;
}