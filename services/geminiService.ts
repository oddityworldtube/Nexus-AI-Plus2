
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Content, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { z } from "zod";
import { 
    ChannelStats, 
    VideoData, 
    DeepAuditResult, 
    AnalysisResult, 
    ShortsToLongResult, 
    OptimizationResult, 
    ScoredHook, 
    ScoredTitle, 
    ScoredTag, 
    CompetitorData, 
    CompetitorAnalysisResult, 
    Idea,
    ThumbnailAnalysis,
    ContentInsights,
    HookAuditResult,
    ViewerPersona,
    CommentInsight,
    RepurposedContent,
    ChatMessage,
    ScriptEvaluation
} from '../types';
import { PromptService } from './promptService';

// --- Tool Definitions for Agentic Copilot ---
const tools: FunctionDeclaration[] = [
    {
        name: "save_draft",
        description: "Save the current conversation or generated text as a draft for future use.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                title: { type: SchemaType.STRING, description: "Title of the draft" },
                content: { type: SchemaType.STRING, description: "The content to save" }
            },
            required: ["title", "content"]
        }
    },
    {
        name: "switch_tab",
        description: "Navigate the user to a specific tab in the application.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                tabId: { 
                    type: SchemaType.STRING, 
                    description: "The ID of the tab (e.g., 'dashboard', 'videos', 'optimizer', 'ideas', 'image_studio', 'competitors')" 
                }
            },
            required: ["tabId"]
        }
    },
    {
        name: "generate_image",
        description: "Generate an image based on a prompt directly.",
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                prompt: { type: SchemaType.STRING, description: "The visual description for image generation" }
            },
            required: ["prompt"]
        }
    }
];

// --- (Previous Zod Schemas and functions remain unchanged) ---
const PsychologySchema = z.object({
    curiosityScore: z.number().default(0),
    urgencyScore: z.number().default(0),
    emotionType: z.string().default('محايد'),
    powerWords: z.array(z.string()).default([]),
    analysis: z.string().default('')
});

const TitleSuggestionSchema = z.object({
    title: z.string(),
    score: z.number(),
    psychology: PsychologySchema.optional()
});

const OptimizationResultSchema = z.object({
    optimizedTitleSuggestions: z.array(TitleSuggestionSchema).default([]),
    optimizedDescription: z.string().default(''),
    scoredTags: z.array(z.object({ tag: z.string(), score: z.number() })).default([]),
    suggestedTags: z.array(z.object({ tag: z.string(), score: z.number() })).default([]),
    thumbnailPrompt: z.string().default(''),
    thumbnailHooks: z.array(z.object({ hook: z.string(), score: z.number() })).default([]),
    relatedVideos: z.array(z.object({ title: z.string(), videoId: z.string(), relevanceReason: z.string() })).default([])
});

interface ModelSettings {
    textModel: string;
    imageModel: string;
}

// Helper to get models from settings (Public Config is synced by AppContext)
const getModelSettings = (): ModelSettings => {
    let settings: ModelSettings = {
        textModel: 'models/gemini-flash-lite-latest',
        imageModel: 'pollinations.ai'
    };
    
    // 1. Try Public Config (Synced for this purpose)
    const publicConfig = localStorage.getItem('yt_analyzer_public_config');
    if (publicConfig) {
        try {
            const parsed = JSON.parse(publicConfig);
            if (parsed.selectedTextModel) settings.textModel = parsed.selectedTextModel;
            if (parsed.selectedImageModel) settings.imageModel = parsed.selectedImageModel;
            return settings;
        } catch(e) {}
    }

    // 2. Fallback to main settings if accessible/decrypted (rarely available here directly due to encryption)
    // We rely on AppContext syncing to `yt_analyzer_public_config`
    
    return settings;
};

const getGeminiKeys = (): string[] => {
    let keys: string[] = [];
    const sessionKeys = sessionStorage.getItem('GEMINI_KEYS_POOL');
    if (sessionKeys) { try { const parsed = JSON.parse(sessionKeys); if (Array.isArray(parsed)) { keys = parsed; } } catch (e) {} }
    if (keys.length === 0) { const envKey = process.env.API_KEY || process.env.VITE_API_KEY || process.env.GEMINI_API_KEY; if (envKey) { keys = [envKey]; } }
    const cleanKeys: string[] = [];
    keys.forEach(k => { if (k.includes(',')) { const splitKeys = k.split(',').map(s => s.trim()).filter(s => s.length > 0); cleanKeys.push(...splitKeys); } else { const trimmed = k.trim(); if (trimmed.length > 0) cleanKeys.push(trimmed); } });
    return cleanKeys;
};

let currentKeyIndex = 0;

// Unified Execution Wrapper with Model Priority
const executeWithRotation = async <T>(operation: (ai: GoogleGenerativeAI, modelName: string) => Promise<T>, apiKeyOverride?: string): Promise<T> => {
    const { textModel } = getModelSettings();
    
    // Pass channel specific key if available
    if (apiKeyOverride && apiKeyOverride.trim().length > 0) { 
        try { 
            let validOverrideKey = apiKeyOverride; 
            if (validOverrideKey.includes(',')) { validOverrideKey = validOverrideKey.split(',')[0].trim(); } 
            const ai = new GoogleGenerativeAI(validOverrideKey); 
            // Pass textModel from settings as default if operation expects it
            return await operation(ai, textModel); 
        } catch (error) { 
            console.warn("Channel specific key failed, falling back to global pool.", error); 
        } 
    }

    const keys = getGeminiKeys();
    if (keys.length === 0) throw new Error("No Gemini API Keys found. Please add them in Settings.");
    
    let attempts = 0;
    const maxAttempts = keys.length;
    let lastError: any = null;
    
    while (attempts < maxAttempts) {
        const key = keys[currentKeyIndex % keys.length];
        try { 
            const ai = new GoogleGenerativeAI(key); 
            return await operation(ai, textModel); 
        } catch (error: any) {
            lastError = error;
            const errString = String(error).toLowerCase();
            const isKeyError = errString.includes('key') || errString.includes('auth') || errString.includes('permission');
            const isRecoverable = errString.includes('429') || errString.includes('503') || errString.includes('500') || errString.includes('quota') || errString.includes('fetch failed') || (errString.includes('403')) || (errString.includes('400') && isKeyError);
            if (errString.includes('400') && !isKeyError && errString.includes('invalid argument')) { 
                // Don't throw immediately, let the caller handle logic errors (like tool fallback) if possible
                // But if it was the last key, we must throw. 
                // For now, we treat 400 as non-recoverable via key rotation, but maybe recoverable via logic change.
                throw error; 
            }
            console.warn(`Key ...${key.slice(-4)} failed. (${attempts + 1}/${maxAttempts}) Reason: ${error.message || 'Unknown'}`);
            if (isRecoverable) { currentKeyIndex++; attempts++; } else { throw error; }
        }
    }
    throw new Error(`All API keys exhausted. Last error: ${lastError?.message || "Unknown error"}`);
};

const cleanJson = (text: string) => {
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIndex = -1;
  if (firstBrace !== -1 && firstBracket !== -1) startIndex = Math.min(firstBrace, firstBracket);
  else if (firstBrace !== -1) startIndex = firstBrace;
  else if (firstBracket !== -1) startIndex = firstBracket;
  
  if (startIndex !== -1) { 
      const lastBrace = cleaned.lastIndexOf('}'); 
      const lastBracket = cleaned.lastIndexOf(']'); 
      const endIndex = Math.max(lastBrace, lastBracket); 
      if (endIndex > startIndex) cleaned = cleaned.substring(startIndex, endIndex + 1); 
  }
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return cleaned;
};

const safeParseTags = (input: any): ScoredTag[] => {
    if (!Array.isArray(input)) return [];
    return input.map(item => { if (typeof item === 'string') return { tag: item, score: 0 }; if (typeof item === 'object' && item !== null) { return { tag: String(item.tag || ""), score: Number(item.score || 0) }; } return { tag: String(item), score: 0 }; }).filter(t => t.tag.trim() !== "");
};

// --- Updated Chat Service with Tools & Fallback ---
export const chatWithCopilot = async (history: ChatMessage[], newMessage: string, contextPayload: any, modelName: string, attachments: { data: string, mimeType: string }[] = [], apiKey?: string): Promise<any> => { 
    return executeWithRotation(async (ai, defaultTextModel) => { 
        // Use modelName passed from component (which comes from settings), fallback to defaultTextModel from getModelSettings
        const actualModel = modelName || defaultTextModel; 
        
        let userProfileSection = ""; 
        if (contextPayload?.userProfile) { 
            userProfileSection = `USER PREFERENCES:\n${JSON.stringify(contextPayload.userProfile, null, 2)}\nPrioritize suggestions that align with this profile.`; 
        } 
        
        // Agentic System Instruction
        const systemInstruction = `You are "CreatorNexus Copilot", an agentic AI assistant for YouTube creators.
        TONE: Professional, encouraging, analytical, and concise. Speak Arabic by default.
        CAPABILITIES: You can execute actions in the app using the provided tools. If the user asks to save something, create an image, or switch pages, USE THE TOOLS.
        ${userProfileSection}`; 
        
        // --- Helper to execute chat request ---
        const attemptChat = async (enableTools: boolean) => {
            const modelConfig: any = { 
                model: actualModel, 
                systemInstruction: systemInstruction 
            };
            
            // Only attach tools if enabled
            if (enableTools) {
                modelConfig.tools = [{ functionDeclarations: tools }];
            }

            const model = ai.getGenerativeModel(modelConfig); 
            
            const mappedHistory = history.map((msg): Content | null => { 
                const parts: any[] = []; 
                if (msg.role === 'user' && msg.attachments) { 
                    msg.attachments.forEach(att => { 
                        if (att.data && att.mimeType) { 
                            parts.push({ inlineData: { data: att.data, mimeType: att.mimeType } }); 
                        } 
                    }); 
                } 
                const textContent = (msg.content || "").trim(); 
                if (textContent.startsWith('IMAGE_RESULT::')) { 
                    parts.push({ text: "[System: Generated an image for the user]" }); 
                } else if (textContent) { 
                    parts.push({ text: textContent }); 
                } 
                if (parts.length > 0) return { role: msg.role, parts }; 
                return null; 
            }).filter((msg): msg is Content => msg !== null); 
            
            const firstUserIndex = mappedHistory.findIndex(m => m.role === 'user'); 
            const validHistory = firstUserIndex !== -1 ? mappedHistory.slice(firstUserIndex) : []; 
            const chat = model.startChat({ history: validHistory }); 
            
            const contextString = JSON.stringify(contextPayload, null, 2); 
            const finalUserMessage = `[SYSTEM: CURRENT_APP_CONTEXT]\n${contextString}\n[/SYSTEM]\n\n${newMessage}`; 
            
            const currentParts: any[] = []; 
            if (attachments && attachments.length > 0) { 
                attachments.forEach(att => { 
                    if(att.data && att.mimeType) currentParts.push({ inlineData: { data: att.data, mimeType: att.mimeType } }); 
                }); 
            } 
            if (finalUserMessage.trim()) currentParts.push({ text: finalUserMessage }); 
            if (currentParts.length === 0) return "يرجى كتابة رسالة أو إرفاق ملف."; 
            
            const result = await chat.sendMessage(currentParts); 
            const response = result.response;
            
            // Check for function calls if tools were enabled
            if (enableTools) {
                const call = response.functionCalls();
                if (call && call.length > 0) {
                    return { type: 'functionCall', calls: call };
                }
            }

            return response.text(); 
        };

        // --- Execution Logic with Fallback ---
        try {
            // 1. Check if model is "lite" - Proactively disable tools as they usually don't support them
            // This prevents the 400 error before it happens for known lite models
            if (actualModel.includes('lite') || actualModel.includes('nano')) {
                return await attemptChat(false);
            }

            // 2. Try Agentic Mode (With Tools)
            return await attemptChat(true);

        } catch (e: any) {
            // 3. Reactive Fallback: If 400/Invalid Argument occurs, retry WITHOUT tools
            const errStr = e.toString();
            if (errStr.includes('400') || errStr.includes('INVALID_ARGUMENT')) {
                console.warn(`[Copilot] Agentic mode failed for ${actualModel}. Falling back to standard text mode.`);
                return await attemptChat(false);
            }
            // Propagate other errors (like Auth or Network)
            throw e;
        }

    }, apiKey); 
};

// --- Updated Services to accept ModelName ---

export const analyzeChannel = async (stats: ChannelStats, videos: VideoData[], modelName?: string, apiKey?: string): Promise<AnalysisResult> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const totalViews = videos.reduce((acc, v) => acc + Number(v.viewCount), 0); 
        const avgViews = totalViews / (videos.length || 1); 
        const processedVideos = videos.slice(0, 30).map(v => ({ title: v.title, publishedAt: v.publishedAt, metrics: { views: Number(v.viewCount) } })); 
        const prompt = await PromptService.buildPrompt('analyze_channel_strategy', { channelTitle: stats.title, avgViews: Math.round(avgViews), videosJson: JSON.stringify(processedVideos) }); 
        const result = await model.generateContent(prompt); 
        return JSON.parse(cleanJson(result.response.text())); 
    }, apiKey); 
};

export const analyzeChannelNiches = async (videos: {title: string}[], modelName?: string, apiKey?: string): Promise<string[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const videoTitles = videos.slice(0, 40).map(v => v.title).join('\n'); 
        const prompt = await PromptService.buildPrompt('analyze_channel_niches', { videoTitles }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        if (!Array.isArray(raw) && (raw as any).niches) return (raw as any).niches; 
        return Array.isArray(raw) ? raw : []; 
    }, apiKey); 
};

export const generateTrendingNiches = async (category: string, modelName?: string, apiKey?: string): Promise<{name: string, rating: number}[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('generate_trending_niches', { category }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return Array.isArray(raw) ? raw : []; 
    }, apiKey); 
};

export const generateLongFormIdeas = async (shorts: VideoData[], modelName?: string, apiKey?: string): Promise<ShortsToLongResult[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const shortsList = shorts.map(s => s.title); 
        const prompt = await PromptService.buildPrompt('shorts_to_long', { shortsList: JSON.stringify(shortsList) }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return Array.isArray(raw) ? raw : []; 
    }, apiKey); 
};

export const optimizeVideoMetadata = async (video: VideoData, channelVideos: VideoData[], modelName?: string, apiKey?: string, hookLanguage: string = 'Arabic', tagsLanguage: string = 'Arabic'): Promise<OptimizationResult> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const channelContext = channelVideos.filter(v => v.id !== video.id).slice(0, 100).map(v => ({ id: v.id, title: v.title })); 
        const mainPrompt = await PromptService.buildPrompt('optimize_metadata_main', { videoTitle: video.title, videoDesc: video.description || "", videoTags: JSON.stringify(video.tags || []), channelContext: JSON.stringify(channelContext), hookLanguage: hookLanguage, tagsLanguage: tagsLanguage }); 
        const result = await model.generateContent(mainPrompt); 
        const rawMain = JSON.parse(cleanJson(result.response.text())); 
        let visionResult = null; 
        if (video.thumbnail) { try { visionResult = await analyzeThumbnailVision(video.thumbnail, video.title, targetModel, apiKey); } catch(e) { console.warn("Vision analysis skipped", e); } } 
        let transcriptResult = null; 
        if (video.captions && video.captions.length > 0) { try { const captionText = video.captions.map(c => c.text).join(" "); transcriptResult = await analyzeVideoTranscript(captionText, targetModel, apiKey); } catch(e) { console.warn("Transcript analysis skipped", e); } } 
        const parsedMain = OptimizationResultSchema.safeParse(rawMain); 
        let finalMain; if (parsedMain.success) { finalMain = parsedMain.data; } else { console.error("Zod Validation Error:", parsedMain.error); finalMain = { optimizedTitleSuggestions: Array.isArray(rawMain.optimizedTitleSuggestions) ? rawMain.optimizedTitleSuggestions : [], optimizedDescription: rawMain.optimizedDescription || "", scoredTags: safeParseTags(rawMain.scoredTags), suggestedTags: safeParseTags(rawMain.suggestedTags), thumbnailPrompt: rawMain.thumbnailPrompt || "", thumbnailHooks: Array.isArray(rawMain.thumbnailHooks) ? rawMain.thumbnailHooks : [], relatedVideos: Array.isArray(rawMain.relatedVideos) ? rawMain.relatedVideos : [], ...rawMain }; } 
        return { ...finalMain, thumbnailAnalysis: visionResult || undefined, contentInsights: transcriptResult || undefined }; 
    }, apiKey); 
};

export const analyzeThumbnailVision = async (thumbnailUrl: string, videoTitle: string, modelName?: string, apiKey?: string): Promise<ThumbnailAnalysis | null> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        // STRICTLY use the selected model. Do not fallback to 2.5-flash based on name checks.
        // If the user selected a model in settings, we trust it supports their needs.
        const targetModel = modelName || defaultModel;
        
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        try { 
            const response = await fetch(thumbnailUrl); 
            const blob = await response.blob(); 
            const base64 = await new Promise<string>((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result as string); reader.readAsDataURL(blob); }); 
            const base64Data = base64.split(',')[1]; 
            const prompt = await PromptService.buildPrompt('analyze_thumbnail_vision', { videoTitle }); 
            const result = await model.generateContent([ prompt, { inlineData: { mimeType: blob.type, data: base64Data } } ]); 
            const raw = JSON.parse(cleanJson(result.response.text())); 
            return { ...raw, critique: Array.isArray(raw.critique) ? raw.critique : [], improvements: Array.isArray(raw.improvements) ? raw.improvements : [] }; 
        } catch (e) { 
            console.warn("Vision analysis failed", e); 
            return null; 
        } 
    }, apiKey); 
};

export const analyzeVideoTranscript = async (captions: string, modelName?: string, apiKey?: string): Promise<ContentInsights | null> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const text = captions.substring(0, 50000); 
        const promptTemplate = await PromptService.buildPrompt('analyze_transcript', {}); 
        const result = await model.generateContent([promptTemplate, text]); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return { ...raw, keyTopics: Array.isArray(raw.keyTopics) ? raw.keyTopics : [] }; 
    }, apiKey); 
};

export const generateEnhancedImagePrompt = async (videoTitle: string, videoDesc: string, modelName?: string, apiKey?: string): Promise<string> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel }); 
        const articlePrompt = await PromptService.buildPrompt('enhanced_image_article', { videoTitle: videoTitle, videoDesc: videoDesc.substring(0, 300) }); 
        const articleResult = await model.generateContent(articlePrompt); 
        const generatedArticle = articleResult.response.text().trim(); 
        if (!generatedArticle) throw new Error("Article generation failed"); 
        const visualPrompt = await PromptService.buildPrompt('enhanced_image_visual', { generatedArticle }); 
        const visualResult = await model.generateContent(visualPrompt); 
        return visualResult.response.text().trim(); 
    }, apiKey); 
};

export interface ImageGenOptions { prompt: string; negativePrompt?: string; style?: string; context?: { title: string; description: string; }; width?: number; height?: number; }
const formatImagePrompt = (basePrompt: string, style: string = ""): string => { const purityConstraints = "no text, no words, no letters, no logos, no watermarks, clean background"; const combined = style ? `${basePrompt}, ${style}` : basePrompt; return `${combined}, ${purityConstraints}`; };

export const generateImages = async (
    prompts: string[], 
    artStyle: string, 
    modelName: string, 
    apiKey?: string,
    dimensions: { width: number, height: number } = { width: 1280, height: 720 },
    negativePrompt?: string
): Promise<string[]> => {
    if (!prompts || prompts.length === 0) throw new Error("No prompts provided.");
    
    // Pollinations.ai Handling
    if (modelName === 'pollinations.ai') { 
        const imageUrls: string[] = []; 
        const pollinaionsModel = 'flux'; 
        for (const basePrompt of prompts) { 
            const fullPrompt = formatImagePrompt(basePrompt, artStyle); 
            const encodedPrompt = encodeURIComponent(fullPrompt); 
            let url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${dimensions.width}&height=${dimensions.height}&seed=${Math.floor(Math.random() * 100000)}&model=${pollinaionsModel}&nologo=true`;
            if (negativePrompt && negativePrompt.trim()) {
                url += `&negative=${encodeURIComponent(negativePrompt.trim())}`;
            }
            imageUrls.push(url); 
        } 
        return imageUrls; 
    }

    // Gemini / Vertex AI Handling
    return executeWithRotation(async (ai, _defaultModel) => { 
        const targetModel = (modelName && modelName !== 'pollinations.ai') ? modelName : (getModelSettings().imageModel !== 'pollinations.ai' ? getModelSettings().imageModel : 'gemini-2.0-flash');
        const model = ai.getGenerativeModel({ model: targetModel }); 
        
        const results: string[] = []; 
        for (const basePrompt of prompts) { 
            try { 
                let fullPrompt = formatImagePrompt(basePrompt, artStyle) + ` (Aspect Ratio: ${dimensions.width}:${dimensions.height})`; 
                if (negativePrompt && negativePrompt.trim()) {
                    fullPrompt += `\n[Negative Prompt (Things to avoid): ${negativePrompt.trim()}]`;
                }
                const result = await model.generateContent(fullPrompt); 
                const response = result.response; 
                const text = response.text(); 
                if (text && !text.includes('base64')) { 
                    console.warn("Model returned text instead of image:", text); 
                    continue; 
                } 
                if (text) results.push(text);
            } catch (e) { 
                console.error("Gemini Image Gen Error:", e); 
            } 
        } 
        return results; 
    }, apiKey);
};

export const generateThumbnailVariations = async (options: ImageGenOptions | string, modelName?: string, apiKey?: string): Promise<string[]> => {
    const { imageModel } = getModelSettings();
    const actualImageModel = modelName || imageModel;

    let videoTitle = ""; let videoDesc = "";
    let width = 1280; let height = 720;
    let negPrompt = "";

    if (typeof options === 'object') { 
        if (options.context) { videoTitle = options.context.title; videoDesc = options.context.description || ""; }
        if (options.width) width = options.width;
        if (options.height) height = options.height;
        if (options.negativePrompt) negPrompt = options.negativePrompt;
    } else if (typeof options === 'string') { 
        videoTitle = options; 
    }

    let distinctPrompts: string[] = [];
    try { distinctPrompts = await getThreeDistinctPrompts(videoTitle, videoDesc, undefined, apiKey); } catch (e) { distinctPrompts = [typeof options === 'string' ? options : options.prompt]; }
    if (distinctPrompts.length < 3) { const base = distinctPrompts[0] || videoTitle; distinctPrompts = [ base + ", Close up shot, highly detailed", base + ", Wide angle action shot, dynamic", base + ", Minimalist composition, clean background" ]; }
    const VARIATION_STYLES = [ "Cinematic, Photorealistic, 8k, Dramatic Lighting, Unreal Engine 5 Render", "3D Cartoon, Pixar Style, Vibrant Colors, Soft Lighting, 4k", "Comic Book Style, Bold Outlines, Pop Art, High Contrast" ];
    const promises = distinctPrompts.slice(0, 3).map((promptIdea, index) => { 
        const style = VARIATION_STYLES[index % VARIATION_STYLES.length]; 
        return generateImages([promptIdea], style, actualImageModel, apiKey, { width, height }, negPrompt); 
    });
    const results = await Promise.all(promises);
    return results.flat();
};

const getThreeDistinctPrompts = async (title: string, desc: string, modelName?: string, apiKey?: string): Promise<string[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('generate_3_distinct_ideas', { videoTitle: title, videoDesc: desc.substring(0, 300) }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return Array.isArray(raw) ? raw : [title]; 
    }, apiKey); 
};

export const analyzeCompetitors = async (myStats: ChannelStats, competitor: CompetitorData, modelName?: string, apiKey?: string): Promise<CompetitorAnalysisResult> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const myStatsJson = JSON.stringify({ title: myStats.title, subscribers: myStats.subscriberCount, views: myStats.viewCount, videos: myStats.videoCount }); 
        const compStatsJson = JSON.stringify({ title: competitor.title, subscribers: competitor.subscriberCount, views: competitor.viewCount, avgViews: competitor.recentVideoAvgViews, lastUpload: competitor.lastUploadDate }); 
        const prompt = await PromptService.buildPrompt('analyze_competitors', { myStatsJson, compStatsJson }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return { comparisonSummary: raw.comparisonSummary || '', ...raw, strengths: Array.isArray(raw.strengths) ? raw.strengths : [], weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses : [], opportunities: Array.isArray(raw.opportunities) ? raw.opportunities : [], actionableTips: Array.isArray(raw.actionableTips) ? raw.actionableTips : [], competitorContentIdeas: Array.isArray(raw.competitorContentIdeas) ? raw.competitorContentIdeas : [] }; 
    }, apiKey); 
};

export const generateTitlesOnly = async (currentTitle: string, modelName?: string, apiKey?: string): Promise<ScoredTitle[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('generate_titles_only', { currentTitle }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return Array.isArray(raw.titles) ? raw.titles : []; 
    }, apiKey); 
};

export const generateDescriptionOnly = async (title: string, currentDesc: string, modelName?: string, apiKey?: string): Promise<string> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel }); 
        const prompt = await PromptService.buildPrompt('generate_desc_only', { title, currentDesc }); 
        const result = await model.generateContent(prompt); 
        return result.response.text() || ""; 
    }, apiKey); 
};

export const generateTagsOnly = async (title: string, currentTags: string[], modelName?: string, apiKey?: string, language: string = 'Arabic'): Promise<{ scoredTags: ScoredTag[], suggestedTags: ScoredTag[] }> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('generate_tags_only', { title, currentTagsJSON: JSON.stringify(currentTags), language }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return { scoredTags: safeParseTags(raw.scoredTags), suggestedTags: safeParseTags(raw.suggestedTags) }; 
    }, apiKey); 
};

export const scoreTagsManually = async (title: string, tags: string[], modelName?: string, apiKey?: string): Promise<ScoredTag[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('score_tags_manual', { title, tagsJSON: JSON.stringify(tags) }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return safeParseTags(raw); 
    }, apiKey); 
};

export const generateThumbnailHooks = async (title: string, language: string = 'Arabic', modelName?: string, apiKey?: string): Promise<ScoredHook[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('generate_hooks_only', { title, language }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return Array.isArray(raw) ? raw : []; 
    }, apiKey); 
};

export const evaluateMetadata = async (title: string, description: string, tags: string[], modelName?: string, apiKey?: string): Promise<any> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('evaluate_metadata', { title, descLen: description.length, tags: tags.join(',') }); 
        const result = await model.generateContent(prompt); 
        return JSON.parse(cleanJson(result.response.text())); 
    }, apiKey); 
};

export const runDeepVideoAudit = async (video: VideoData, channelAvgViews: number, channelAvgEng: number, modelName?: string, apiKey?: string): Promise<DeepAuditResult> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        let transcriptContext = "Not Available"; 
        if (video.captions && video.captions.length > 0) { transcriptContext = video.captions.slice(0, 100).map(c => c.text).join(" ").substring(0, 15000); } 
        const videoContext = { title: video.title, stats: { views: video.viewCount, likes: video.likeCount, comments: video.commentCount, duration: video.duration, retention: video.averageViewPercentage ? `${video.averageViewPercentage}%` : "Estimated", ctr: video.actualCTR ? `${video.actualCTR}%` : "Estimated" }, benchmarks: { channelAverageViews: channelAvgViews, channelAverageEngagement: channelAvgEng } }; 
        const prompt = await PromptService.buildPrompt('deep_audit_video', { videoContext: JSON.stringify(videoContext), transcriptContext }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return { score: 0, level: 'Problematic', verdict: 'Error', analysis: 'Failed to analyze', psychologicalTrigger: 'None', ...raw, actionPlan: Array.isArray(raw.actionPlan) ? raw.actionPlan : [] }; 
    }, apiKey); 
};

export const analyzeHookRetention = async (videoTitle: string, fullTranscript: string, modelName?: string, apiKey?: string): Promise<HookAuditResult> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const introTranscript = fullTranscript.split(' ').slice(0, 100).join(' '); 
        const prompt = await PromptService.buildPrompt('analyze_hook_retention', { videoTitle, introTranscript }); 
        const result = await model.generateContent(prompt); 
        return JSON.parse(cleanJson(result.response.text())); 
    }, apiKey); 
};

export const analyzeViewerPersonas = async (videoTitle: string, videoDesc: string, modelName?: string, apiKey?: string): Promise<ViewerPersona[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('analyze_viewer_personas', { videoTitle, videoDesc: videoDesc.substring(0, 500) }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return Array.isArray(raw) ? raw : []; 
    }, apiKey); 
};

export const analyzeCommentsGap = async (comments: string[], modelName?: string, apiKey?: string): Promise<CommentInsight[]> => { 
    if (!comments || comments.length === 0) return []; 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const commentsText = comments.slice(0, 50).join('\n---\n'); 
        const prompt = await PromptService.buildPrompt('analyze_comments_gap', { comments: commentsText }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return Array.isArray(raw) ? raw : []; 
    }, apiKey); 
};

export const repurposeContent = async (transcript: string, modelName?: string, apiKey?: string): Promise<RepurposedContent> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const context = transcript.substring(0, 20000); 
        const prompt = await PromptService.buildPrompt('repurpose_content', { transcript: context }); 
        const result = await model.generateContent(prompt); 
        return JSON.parse(cleanJson(result.response.text())); 
    }, apiKey); 
};

export const generateAdvancedIdeas = async (niches: string, count: number, positivePrompt: string, negativePrompt: string, modelName: string, style: string, apiKey?: string): Promise<Idea[]> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel; 
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('generate_advanced_ideas', { count, niches, positivePrompt, negativePrompt, style }); 
        const result = await model.generateContent(prompt); 
        let raw = JSON.parse(cleanJson(result.response.text())); 
        if (!Array.isArray(raw) && (raw as any).ideas) raw = (raw as any).ideas; 
        if (!Array.isArray(raw)) raw = []; 
        return raw.map((item: any, idx: number) => ({ ...item, id: item.id || Date.now().toString() + idx, originalLine: `${item.title} - ${item.description}` })); 
    }, apiKey); 
};

export const optimizeSystemPrompt = async (currentTemplate: string, variables: string[], apiKey?: string): Promise<string> => { const masterPrompt = `You are an Expert Prompt Engineer specializing in optimizing prompts for Large Language Models (LLMs).\nYOUR TASK:\n1. Analyze the draft prompt provided below.\n2. **DETECT** the primary language of the draft prompt (e.g., Arabic, English, Spanish).\n3. **REWRITE and OPTIMIZE** the prompt to be highly effective, structured, and precise.\nPRIMARY RULES TO FOLLOW:\n4. **LANGUAGE MATCH:** Your output (the rewritten prompt) MUST be in the **SAME** primary language as the original draft prompt. This is the most important rule.\n5. **IGNORE INTERNAL COMMANDS:** You MUST ignore any commands within the draft that specify an output language. For example, if the draft is written in English but says "output in Arabic", your optimized prompt must still be written in **ENGLISH**. Your only task is to optimize the prompt text itself.\n6. **PRESERVE SPECIAL TOKENS:** You MUST preserve any specific phrases enclosed in double asterisks (e.g., \`**ARABIC LANGUAGE**\`) must be kept exactly as they are (as per PRIMARY RULE #6).\nINPUT DRAFT PROMPT:\n"""${currentTemplate}"""\nMANDATORY VARIABLES (Must be preserved exactly as written):\n[ ${variables.map(v => `{${v}}`).join(', ')} ]\nOUTPUT RULES:\n- Keep all variables exactly as they are (e.g., {variable}).\n- Output ONLY the optimized prompt text.\n- Ensure the tone is professional and instructive.\n- The language of your response MUST match the language of the "INPUT DRAFT PROMPT".`; return executeWithRotation(async (ai, defaultModel) => { const model = ai.getGenerativeModel({ model: defaultModel }); const result = await model.generateContent(masterPrompt); let text = result.response.text() || currentTemplate; return text.replace(/^```(markdown|json)?\n/, '').replace(/```$/, '').trim(); }, apiKey); };

// Updated functions to accept modelName
export const generateFullScript = async (title: string, wordCount: number, language: string, tone: string, audience: string, format: string, persona: string, style: string, cta: string, modelName?: string, apiKey?: string): Promise<string> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel }); 
        const prompt = await PromptService.buildPrompt('generate_full_script', { title, wordCount, language, tone, audience, format, persona, style, cta }); 
        const result = await model.generateContent(prompt); 
        return result.response.text().trim(); 
    }, apiKey); 
};

export const generateShortsScriptFromLong = async (longScript: string, language: string, modelName?: string, apiKey?: string): Promise<string> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel }); 
        const prompt = await PromptService.buildPrompt('convert_to_shorts_script', { longScript: longScript.substring(0, 30000), language }); 
        const result = await model.generateContent(prompt); 
        return result.response.text().trim(); 
    }, apiKey); 
};

export const generateMetadataFromContent = async (scriptContent: string, language: string, modelName?: string, apiKey?: string): Promise<{title: string, description: string, tags: string[]}> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const context = scriptContent.substring(0, 30000); 
        const prompt = await PromptService.buildPrompt('generate_meta_from_script', { scriptContent: context, language }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return { title: raw.title || '', description: raw.description || '', tags: Array.isArray(raw.tags) ? raw.tags : [] }; 
    }, apiKey); 
};

export const evaluateScriptQuality = async (scriptContent: string, modelName?: string, apiKey?: string): Promise<ScriptEvaluation> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('evaluate_youtube_script', { scriptContent: scriptContent.substring(0, 20000) }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return { score: raw.score || 0, hookScore: raw.hookScore || 0, pacing: raw.pacing || "Unknown", critique: Array.isArray(raw.critique) ? raw.critique : [], improvements: Array.isArray(raw.improvements) ? raw.improvements : [] }; 
    }, apiKey); 
};

export const rewriteScriptSection = async (selectedText: string, instruction: string, fullScript: string, modelName?: string, apiKey?: string): Promise<string> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel }); 
        const contextSnippet = fullScript.substring(0, 5000); 
        const prompt = await PromptService.buildPrompt('rewrite_script_section', { selectedText, instruction, fullContext: contextSnippet }); 
        const result = await model.generateContent(prompt); 
        return result.response.text().trim(); 
    }, apiKey); 
};

export const generateTikTokDescription = async (title: string, language: string, modelName?: string, apiKey?: string): Promise<string> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel }); 
        const prompt = await PromptService.buildPrompt('generate_tiktok_description', { title, language }); 
        const result = await model.generateContent(prompt); 
        return result.response.text().trim(); 
    }, apiKey); 
};

export const generateShortMetadata = async (shortScript: string, language: string, modelName?: string, apiKey?: string): Promise<{ shortTitle: string, shortDescription: string, shortKeywords: string[] }> => { 
    return executeWithRotation(async (ai, defaultModel) => { 
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } }); 
        const prompt = await PromptService.buildPrompt('generate_short_metadata', { shortScript: shortScript.substring(0, 5000), language }); 
        const result = await model.generateContent(prompt); 
        const raw = JSON.parse(cleanJson(result.response.text())); 
        return { shortTitle: raw.shortTitle || '', shortDescription: raw.shortDescription || '', shortKeywords: Array.isArray(raw.shortKeywords) ? raw.shortKeywords : [] }; 
    }, apiKey); 
};

// --- New Functions for Visual Scripting ---

export const addTashkeel = async (text: string, modelName?: string, apiKey?: string): Promise<string> => {
    return executeWithRotation(async (ai, defaultModel) => {
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel });
        const prompt = await PromptService.buildPrompt('add_tashkeel', { text });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    }, apiKey);
};

export const generateScenePrompt = async (segmentText: string, style: string, modelName?: string, apiKey?: string): Promise<string> => {
    return executeWithRotation(async (ai, defaultModel) => {
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel });
        const prompt = await PromptService.buildPrompt('generate_scene_prompt', { segmentText, style });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    }, apiKey);
};

// NEW: Batch Prompt Generation
export const generateBatchScenePrompts = async (segments: string[], style: string, modelName?: string, apiKey?: string): Promise<string[]> => {
    return executeWithRotation(async (ai, defaultModel) => {
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } });
        const segmentsJson = JSON.stringify(segments);
        const prompt = await PromptService.buildPrompt('generate_batch_scene_prompts', { segmentsJson, style });
        const result = await model.generateContent(prompt);
        const raw = JSON.parse(cleanJson(result.response.text()));
        return Array.isArray(raw) ? raw : segments.map(() => ""); // Fallback
    }, apiKey);
};

// NEW: Visual Script Thumbnails
export const generateVisualScriptThumbnails = async (fullText: string, style: string, modelName?: string, apiKey?: string): Promise<string[]> => {
    return executeWithRotation(async (ai, defaultModel) => {
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel, generationConfig: { responseMimeType: "application/json" } });
        const context = fullText.substring(0, 5000);
        const prompt = await PromptService.buildPrompt('generate_visual_script_thumbnails', { text: context, style });
        const result = await model.generateContent(prompt);
        const raw = JSON.parse(cleanJson(result.response.text()));
        return Array.isArray(raw) ? raw : [];
    }, apiKey);
};

export const suggestArtStyle = async (fullText: string, modelName?: string, apiKey?: string): Promise<string> => {
    return executeWithRotation(async (ai, defaultModel) => {
        const targetModel = modelName || defaultModel;
        const model = ai.getGenerativeModel({ model: targetModel });
        const context = fullText.substring(0, 5000);
        const prompt = await PromptService.buildPrompt('suggest_art_style', { text: context });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    }, apiKey);
};
