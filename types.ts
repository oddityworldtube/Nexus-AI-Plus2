
export interface ChannelProfile {
  id: string;
  name: string;
  channelId: string;
  apiKey: string; // YouTube Data API Key
  geminiApiKey?: string; // Specific Gemini Key for this channel
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  accessToken?: string; // Short-lived
}

export interface TranscriptService {
    id: string;
    name: string;
    url: string;
    isDefault?: boolean;
}

// --- NEW: Backup Categories ---
export type BackupCategory = 'profiles' | 'settings' | 'competitors' | 'ideaHistory' | 'templates' | 'prompts' | 'copilotHistory' | 'copilotPrompts' | 'userPreferences';

export interface AppSettings {
  geminiApiKeys: string[];
  customModels: string[]; // List of user-added model names
  selectedTextModel?: string; // Centralized Text Model Choice
  selectedImageModel?: string; // Centralized Image Model Choice
  theme: 'light' | 'dark';
  transcriptServices?: TranscriptService[]; // New: List of transcript services
  defaultTranscriptServiceId?: string; // New: Selected service ID
  defaultBackupCategories?: BackupCategory[]; // NEW: User preferences for backup
  defaultChannelId?: string; // NEW: Default channel to open on load
}

export interface ChannelStats {
  title: string;
  description: string;
  customUrl: string;
  subscriberCount: string;
  videoCount: string;
  viewCount: string;
  thumbnailUrl: string;
}

export type PerformanceStatus = 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'NEW';

// --- NEW: Transcript/Caption Types ---
export interface VideoCaption {
    text: string;
    start: number;
    duration: number;
}

export interface VideoData {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
  duration?: string;
  durationSeconds: number;
  tags?: string[];
  description?: string;
  categoryId?: string;
  performanceStatus?: PerformanceStatus;
  performanceRatio?: number;
  
  // New field for content analysis
  captions?: VideoCaption[];
  
  // --- New Real Analytics Fields ---
  analyticsFetched?: boolean;
  actualCTR?: number; // Click Through Rate %
  averageViewDuration?: string; // formated HH:MM:SS
  averageViewPercentage?: number; // Retention %
  estimatedMinutesWatched?: number;
}

export interface AnalysisResult {
  strategy: string;
  videoSuggestions: string;
  overallScore: number;
  // Optional expanded properties
  optimizedTitleSuggestions?: { title: string; score: number; psychology?: TitlePsychology }[];
  optimizedDescription?: string;
  scoredTags?: { tag: string; score: number }[];
  suggestedTags?: { tag: string; score: number }[];
  thumbnailPrompt?: string;
  thumbnailHooks?: { hook: string; score: number }[];
  relatedVideos?: { title: string; videoId: string; relevanceReason: string }[];
  thumbnailAnalysis?: ThumbnailAnalysis;
  contentInsights?: ContentInsights;
}

export interface SingleVideoAnalysisResult {
  verdict: string;
  reasons: string[];
  improvements: string[];
  score: number;
  titleSuggestions: { title: string; score: number; reason: string }[];
}

export interface ShortsToLongResult {
  shortTitle: string;
  longIdeas: string[];
}

// --- Advanced Idea Generator Types ---

export interface Idea {
  id: string;
  score: number;
  title: string;
  description: string;
  originalLine: string;
}

export interface NicheData {
  id: string;
  name: string;
  rating?: number;
  category: string;
}

export interface DefaultIdeaSettings {
  ideaCount: number;
  positivePrompt: string;
  negativePrompt: string;
  model: string;
  titleCaseStyle: 'sentence' | 'title' | 'allcaps';
}

export interface IdeaGeneratorSettings {
    ideaCount: number;
    positivePrompt: string;
    negativePrompt: string;
    selectedModel: string;
}

export interface IdeaSession {
    id: number | string;
    date: string;
    niches: string | string[]; 
    results?: GeneratedIdea[]; 
    ideas?: Idea[]; 
    count?: number;
    firstIdea?: string;
}

// Keeping for backward compatibility if needed, but prefer Idea
export interface GeneratedIdea {
    title: string;
    description: string;
    score: number;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    keywords: string[];
}

// --- Optimization Types ---

export interface ScoredTag {
  tag: string;
  score: number; // 0-100
}

// --- NEW: Psychology Analysis Types ---
export interface TitlePsychology {
    curiosityScore: number; // 0-100
    urgencyScore: number; // 0-100
    emotionType: string; // e.g. "Fear", "Joy", "Surprise"
    powerWords: string[];
    analysis: string; // Short text explanation
}

export interface ScoredTitle {
  title: string;
  score: number;
  // Enhanced analysis
  psychology?: TitlePsychology;
}

export interface ScoredHook {
    hook: string;
    score: number;
}

export interface RelatedVideoSuggestion {
  title: string;
  videoId: string;
  relevanceReason: string;
}

// --- NEW: Vision/Thumbnail Analysis Types ---
export interface ThumbnailAnalysis {
    score: number;
    critique: string[]; // List of visual issues (e.g. "Text too small", "Low contrast")
    improvements: string[]; // List of actionable fixes
    colorProfile: string; // e.g. "Dark/Gloomy", "Bright/Vibrant"
    faceDetected: boolean;
    textReadability: 'High' | 'Medium' | 'Low';
}

// --- NEW: Deep Content Insights (from Transcripts) ---
export interface ContentInsights {
    summary: string;
    keyTopics: string[];
    sentiment: 'Positive' | 'Negative' | 'Neutral';
    pacingScore: number; // How fast/slow the speaker talks
    hookEffectiveness: number; // First 30s analysis
}

export interface OptimizationResult {
  optimizedTitleSuggestions: ScoredTitle[];
  optimizedDescription: string;
  scoredTags: ScoredTag[]; // Current tags rated
  suggestedTags: ScoredTag[]; // New suggestions
  thumbnailPrompt: string;
  thumbnailHooks: ScoredHook[];
  relatedVideos: RelatedVideoSuggestion[];
  
  // New Enhanced Fields
  thumbnailAnalysis?: ThumbnailAnalysis;
  contentInsights?: ContentInsights;
  
  // Phase 1 New Features
  hookAudit?: HookAuditResult;
  viewerPersonas?: ViewerPersona[];
  repurposedContent?: RepurposedContent;
}

// --- NEW: Phase 1 "Intelligent Guidance" Types ---

export interface HookAuditResult {
    score: number;
    hookDetected: boolean;
    timeToTopic: number; // estimated seconds before getting to the point
    verdict: string;
    improvement: string;
}

export interface ViewerPersona {
    type: 'Skeptic' | 'Beginner' | 'Expert' | 'Impatient';
    reaction: string;
    score: number;
}

export interface RepurposedContent {
    twitterThread: string[];
    linkedinPost: string;
    shortsScript: string;
    communityPoll: string;
}

export interface CommentInsight {
    topic: string;
    sentiment: 'Request' | 'Question' | 'Complaint' | 'Praise';
    frequency: number;
    sampleComment: string;
}

// --- Competitor Analysis ---

export interface CompetitorContentIdea {
    title: string;
    explanation: string;
}

export interface CompetitorAnalysisResult {
  comparisonSummary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  actionableTips: string[];
  competitorContentIdeas: CompetitorContentIdea[];
}

export interface SavedCompetitor {
    id: string; // internal id
    channelId: string; // youtube id
    title: string;
    thumbnailUrl: string;
    // New fields for caching analysis
    lastAnalysis?: CompetitorAnalysisResult;
    lastAnalysisDate?: string;
    stats?: CompetitorData; // Save basic stats too
}

export interface CompetitorData {
  id: string;
  channelId: string;
  title: string;
  customUrl: string;
  subscriberCount: string;
  videoCount: string;
  viewCount: string;
  thumbnailUrl: string;
  recentVideoAvgViews: number;
  lastUploadDate: string;
}

// --- Canvas & Text Objects ---

export interface TextObject {
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    strokeColor: string;
    strokeWidth: number;
    shadowColor: string;
    shadowBlur: number;
    highlightWords: string[];
    highlightColor: string;
    highlightScale: number;
    lineHeight: number;
    opacity: number;
    rotation: number;
    align: 'left' | 'center' | 'right';
    isDragging: boolean;
    isLocked?: boolean;
    isHidden?: boolean;
    zIndex?: number;
    highlightGradient?: string[]; // مصفوفة ألوان للتدرج (مثلاً ['#ff0000', '#0000ff'])
    highlightBgColor?: string;    // لون الخلفية المستطيلة
    highlightBgRadius?: number;   // درجة انحناء حواف الخلفية
    highlightBgPadding?: number;  // مساحة الهوامش للخلفية
    highlightShadowColor?: string; // لون ظل مخصص للكلمة المميزة
    highlightShadowBlur?: number;  // قوة تغبيش الظل للمميز
}

export interface CanvasTemplate {
    id: string;
    name: string;
    previewColor: string;
    objects: Partial<TextObject>[];
    isCustom?: boolean; // New field for user templates
}

// --- PROMPT SYSTEM ---
export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    variables: string[];
    category: 'Analysis' | 'Optimization' | 'Ideas' | 'Creative' | 'Vision' | 'Transcript' | 'Advanced';
}

// --- Toast Types ---

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  duration?: number;
}

// --- Deep Audit Results ---
export interface DeepAuditResult {
    score: number;
    level: 'Elite' | 'Healthy' | 'Problematic' | 'Critical';
    analysis: string;
    psychologicalTrigger: string;
    actionPlan: string[];
    verdict: string;
}

// --- COPILOT TYPES ---
export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp: number;
    attachments?: { type: 'image' | 'text'; data: string; mimeType: string }[];
    promptId?: string; // To track which prompt triggered this message
}

export interface CopilotSession {
    id: string;
    title: string;
    date: string;
    messages: ChatMessage[];
    contextType?: string;
}

export interface CopilotPrompt {
    id: string;
    name: string;
    template: string;
    context: string[]; // e.g. ['VIDEO_LIST_ANALYSIS', 'GENERAL']
    variables?: { name: string; description: string; defaultValue?: string; }[];
}

export interface UserPreferences {
    id: string;
    preferences: Record<string, any>;
}

// --- BACKUP & SECURITY ---
export interface BackupFile {
    version: number;
    timestamp: number;
    security: {
        salt: number[]; // Array from Uint8Array
        verifier: any; // Encrypted "VALID" string
    };
    payload: string; // Encrypted JSON of FullDatabaseDump
}

export interface FullDatabaseDump {
    profiles: ChannelProfile[];
    settings: AppSettings;
    competitors: SavedCompetitor[];
    ideaHistory: IdeaSession[];
    templates: CanvasTemplate[];
    prompts: PromptTemplate[];
    copilotHistory: CopilotSession[];
    copilotPrompts: CopilotPrompt[];
    userPreferences: UserPreferences[];
}

// --- CONTENT GENERATION TYPES ---
export interface ContentSession {
    id: string;
    date: string;
    title: string;
    inputs: {
        format: string;
        wordCount: number;
        language: string;
        tone: string;
        persona: string;
        style: string;
        audience: string;
        cta: string;
    };
    outputs: {
        script: string;
        metadata?: { title: string; description: string; tags: string[] };
        shortsScript?: string;
        tiktokDescription?: string; // NEW
        shortMetadata?: { shortTitle: string, shortDescription: string, shortKeywords: string[] }; // NEW
    };
}

export interface ScriptEvaluation {
    score: number;
    critique: string[];
    improvements: string[];
    pacing: string;
    hookScore: number;
}
