
import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { generateImages, generateEnhancedImagePrompt, optimizeSystemPrompt } from '../services/geminiService';
import { 
    Image as ImageIcon, Sparkles, Download, Copy, Trash2, 
    RefreshCw, Layers, Sliders, Wand2, ArrowRight,
    Square, RectangleHorizontal, RectangleVertical, History,
    FileText, Upload, ToggleLeft, ToggleRight, Settings as SettingsIcon,
    Palette, Zap, X, Archive, CheckCircle, Maximize2, Loader2, Play, Save, Edit3, Bot, RotateCcw,
    Sun, Contrast, Droplet, Aperture, Shield, Globe
} from 'lucide-react';

interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    negativePrompt?: string;
    date: number;
    ratio: string;
    model: string;
    filename?: string;
    status?: 'loading' | 'success' | 'error';
}

interface BatchItem {
    id: string;
    filename: string;
    content: string;
}

interface FilterState {
    brightness: number;
    contrast: number;
    saturate: number;
    sepia: number;
    blur: number;
}

const DEFAULT_FILTERS: FilterState = { brightness: 100, contrast: 100, saturate: 100, sepia: 0, blur: 0 };

const ASPECT_RATIOS = [
    { label: '16:9 (YouTube)', value: '16:9', width: 1280, height: 720, icon: RectangleHorizontal },
    { label: '9:16 (Shorts)', value: '9:16', width: 720, height: 1280, icon: RectangleVertical },
    { label: '1:1 (Square)', value: '1:1', width: 1024, height: 1024, icon: Square },
];

const ADVANCED_STYLES = [
    { label: 'افتراضي (واقعي)', value: 'Realistic, High Quality, 4k', keywords: ['realistic', 'realism', 'photo', '4k', 'photorealistic'] },
    { label: 'سينمائي (Cinematic)', value: 'Cinematic Lighting, Dramatic, 8k, Unreal Engine 5', keywords: ['cinematic', 'dramatic', 'unreal', '8k'] },
    { label: 'أنمي (Anime)', value: 'Anime Style, Studio Ghibli, Vibrant Colors', keywords: ['anime', 'manga', 'ghibli'] },
    { label: 'كرتوني (3D Cartoon)', value: 'Pixar Style, 3D Render, Cute, Smooth', keywords: ['cartoon', 'pixar', '3d', 'render', 'disney'] },
    { label: 'رسم زيتي (Oil Painting)', value: 'Oil Painting, Texture, Artistic, Van Gogh Style', keywords: ['oil painting', 'canvas', 'van gogh'] },
    { label: 'نيون (Cyberpunk)', value: 'Cyberpunk, Neon Lights, Futuristic, Dark', keywords: ['cyberpunk', 'neon', 'futuristic'] },
    { label: 'سكيتش (Pencil Sketch)', value: 'Pencil Sketch, Charcoal, Black and White, Detailed', keywords: ['sketch', 'pencil', 'drawing'] },
    { label: 'مائي (Watercolor)', value: 'Watercolor Painting, Soft Edges, Pastel Colors, Artistic', keywords: ['watercolor', 'pastel'] },
    { label: 'بولارويد (Vintage)', value: 'Polaroid Style, Vintage Filter, Grainy, Nostalgic', keywords: ['vintage', 'retro', 'polaroid'] },
    { label: 'رقمي (Digital Art)', value: 'Digital Art, Concept Art, Trending on ArtStation, Detailed', keywords: ['digital art', 'concept art'] },
    { label: 'ماكرو (Macro)', value: 'Macro Photography, Extreme Close-up, Detailed Texture, Bokeh', keywords: ['macro', 'close-up'] },
    { label: 'فانتازيا (Fantasy)', value: 'Fantasy World, Magical Atmosphere, Dreamy, Ethereal', keywords: ['fantasy', 'magical', 'dreamy'] },
];

const DEFAULT_NEGATIVE = "text, watermark, signature, username, words, logo, low quality, blur, bad anatomy, distortion, extra fingers";

const ImageStudio: React.FC = () => {
    const { settings, profiles, currentProfileId, setPendingImageForEditor, pendingBatchPrompts, setPendingBatchPrompts } = useAppContext();
    const { addToast } = useToast();
    const profile = profiles.find(p => p.id === currentProfileId);

    // --- State: Modes & Inputs ---
    const [mode, setMode] = useState<'SINGLE' | 'BATCH'>('SINGLE');
    const [activeTab, setActiveTab] = useState<'GENERATE' | 'FILTERS'>('GENERATE'); // New Tab State
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useLocalStorage('img_neg_prompt', DEFAULT_NEGATIVE);
    
    // Batch State
    const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);
    
    // --- State: Configuration (PERSISTENT NOW) ---
    const [selectedRatio, setSelectedRatio] = useLocalStorage('img_pref_ratio', ASPECT_RATIOS[0]);
    const [selectedStyle, setSelectedStyle] = useLocalStorage('img_pref_style', ADVANCED_STYLES[0]);
    const [imageCount, setImageCount] = useLocalStorage('img_pref_count', 1);
    const [selectedModel, setSelectedModel] = useState<string>(settings.selectedImageModel || 'pollinations.ai');

    // Sync with Global Settings
    useEffect(() => { if (settings.selectedImageModel) setSelectedModel(settings.selectedImageModel); }, [settings.selectedImageModel]);
    
    // --- State: New Features ---
    const [enableAiEnhance, setEnableAiEnhance] = useLocalStorage('img_ai_enhance', false); 
    const [useProxy, setUseProxy] = useLocalStorage('img_use_proxy', true); // NEW: Vercel Proxy Mode
    const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null); 
    const [editPromptText, setEditPromptText] = useState('');

    // --- State: Filters ---
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [selectedFilterImage, setSelectedFilterImage] = useState<GeneratedImage | null>(null);

    // --- State: Toggles ---
    const [autoSave, setAutoSave] = useLocalStorage('img_auto_save', false);
    const [keepHistory, setKeepHistory] = useLocalStorage('img_keep_history', true);
    
    // --- State: UI Control ---
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [expandedImage, setExpandedImage] = useState<GeneratedImage | null>(null);
    const [lastRefresh, setLastRefresh] = useState(Date.now());
    
    // History
    const [history, setHistory] = useLocalStorage<GeneratedImage[]>('img_studio_history', []);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const galleryScrollRef = useRef<HTMLDivElement>(null); 

    // --- Watchdog ---
    useEffect(() => {
        const interval = setInterval(() => {
            const hasLoading = history.some(img => img.status === 'loading');
            if (hasLoading) {
                setLastRefresh(Date.now());
            }
        }, 10000); 
        return () => clearInterval(interval);
    }, [history]);

    // --- LISTEN FOR BATCH PROMPTS (From Visual Scripting) ---
    useEffect(() => {
        if (pendingBatchPrompts && pendingBatchPrompts.length > 0) {
            // Switch to Batch Mode
            setMode('BATCH');
            
            // Convert to BatchItems
            const newItems: BatchItem[] = pendingBatchPrompts.map((p, i) => ({
                id: `pending_${Date.now()}_${i}`,
                filename: `prompt_${i+1}`,
                content: p
            }));
            
            setBatchQueue(prev => [...prev, ...newItems]);
            addToast(`تم استقبال ${newItems.length} برومبت من السيناريو المرئي`, "success");
            
            // Clear pending
            setPendingBatchPrompts(null);
        }
    }, [pendingBatchPrompts]);

    // --- Helper Functions ---

    const cleanPromptFromStyle = (originalPrompt: string, targetStyleKeywords: string[]): string => {
        let cleaned = originalPrompt;
        const allKeywords = [...targetStyleKeywords, ...ADVANCED_STYLES.flatMap(s => s.keywords || [])];
        const uniqueKeywords = Array.from(new Set(allKeywords));

        uniqueKeywords.forEach(keyword => {
            if (keyword && keyword.length > 2) {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                cleaned = cleaned.replace(regex, '');
            }
        });
        cleaned = cleaned.replace(/,\s*,/g, ',').replace(/\s\s+/g, ' ').trim();
        if (cleaned.startsWith(',')) cleaned = cleaned.substring(1).trim();
        if (cleaned.endsWith(',')) cleaned = cleaned.substring(0, cleaned.length - 1).trim();
        return cleaned;
    };

    const transformFilename = (name: string, index: number): string => {
        if (!name) return `image_${index}`;
        let newName = name.replace(/prompt/gi, 'image');
        return newName.replace(/\s+/g, '_');
    };

    const getFilterString = () => {
        return `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) sepia(${filters.sepia}%) blur(${filters.blur}px)`;
    };

    // --- Core Actions ---

    const handleManualRefresh = () => {
        setLastRefresh(Date.now());
        addToast("تم تحديث واجهة المعرض", "info");
    };

    const handleSaveSettings = () => {
        addToast("تم حفظ إعدادات التوليد كإعدادات افتراضية", "success");
    };

    const handleBatchFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        addToast("جاري قراءة الملفات...", "info");

        const fileReaders: Promise<BatchItem>[] = Array.from(files).map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const text = ev.target?.result as string;
                    resolve({
                        id: Date.now().toString() + Math.random(),
                        filename: file.name.replace(/\.[^/.]+$/, ""), 
                        content: text.trim()
                    });
                };
                reader.readAsText(file);
            });
        });

        try {
            const newItems = await Promise.all(fileReaders);
            const validItems = newItems.filter(item => item.content.length > 0);
            
            validItems.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' }));

            if (validItems.length > 0) {
                setBatchQueue(prev => [...prev, ...validItems]);
                addToast(`تم إضافة ${validItems.length} ملفات للقائمة بنجاح`, "success");
            } else {
                addToast("الملفات فارغة أو غير صالحة", "warning");
            }
        } catch (error) {
            console.error("Error reading files:", error);
            addToast("حدث خطأ أثناء قراءة الملفات", "error");
        }
        
        e.target.value = '';
    };

    const clearBatchQueue = () => {
        setBatchQueue([]);
        addToast("تم مسح قائمة الملفات", "info");
    };

    const handleMagicEnhance = async () => {
        if (!prompt.trim()) return addToast("اكتب وصفاً بسيطاً أولاً", "warning");
        setIsEnhancing(true);
        try {
            const instruction = "You are a professional Art Director. Rewrite the following prompt to be a highly detailed, professional visual description of the scene elements, lighting, composition, and mood. CRITICAL RULE: REMOVE any art style keywords (e.g., 'photorealistic', 'cartoon', '3d', 'sketch', '8k', 'anime') from the user input. Output ONLY the clean visual description of the subject.";
            const enhanced = await generateEnhancedImagePrompt(prompt, instruction, profile?.geminiApiKey);
            setPrompt(enhanced);
            addToast("تم توحيد الستايل وتحسين الوصف احترافياً ✨", "success");
        } catch (e) {
            addToast("فشل التحسين التلقائي", "error");
        } finally {
            setIsEnhancing(false);
        }
    };

    // --- PROXY HANDLER (Vercel Integration) ---
    const fetchThroughProxy = async (originalUrl: string): Promise<string> => {
        try {
            // Using relative path for Vercel Serverless Function
            // This works automatically after deployment
            const proxyUrl = `/api/proxy_image?url=${encodeURIComponent(originalUrl)}`;
            
            const res = await fetch(proxyUrl);
            const data = await res.json();
            
            if (data.success && data.image) {
                return data.image; // Base64 string from Vercel function
            } else {
                throw new Error(data.error || "Proxy error");
            }
        } catch (e) {
            console.error("Proxy fetch failed:", e);
            throw e;
        }
    };

    const triggerDownload = async (url: string, filename: string, withFilters: boolean = false) => {
        try {
            if (withFilters) {
                // Draw to Canvas with Filters
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = url;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error("Canvas Context Failed");

                // Apply Filters
                ctx.filter = getFilterString();
                ctx.drawImage(img, 0, 0);

                // Export
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                if (!blob) throw new Error("Canvas Blob Failed");
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

            } else {
                // Direct Download
                // If it's a data URL (Base64 from proxy), download directly
                if (url.startsWith('data:')) {
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    // Try fetch blob for remote URL
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }
        } catch (e) {
            console.error("Download failed", e);
            if (!withFilters && !url.startsWith('data:')) {
                // Fallback: Open in new tab
                const link = document.createElement('a');
                link.href = url;
                link.target = '_blank';
                link.download = filename;
                link.click();
            } else {
                addToast("فشل تحميل الصورة", "error");
            }
        }
    };

    const handleDownloadAll = async () => {
        const validImages = history.filter(img => img.status === 'success');
        if (validImages.length === 0) return;
        if (!confirm(`هل تريد تحميل ${validImages.length} صورة الآن؟`)) return;

        addToast("جاري بدء التحميل الجماعي...", "info");
        
        for (let i = 0; i < validImages.length; i++) {
            const img = validImages[i];
            const name = img.filename || `image_${validImages.length - i}`;
            await triggerDownload(img.url, name);
            await new Promise(r => setTimeout(r, 500));
        }
        addToast("تم الانتهاء من التحميل", "success");
    };

    const handleGenerate = async () => {
        let tasks: { prompt: string, filename?: string }[] = [];

        if (mode === 'SINGLE') {
            if (!prompt.trim()) return addToast("يرجى إدخال وصف للصورة", "error");
            tasks = [{ prompt: prompt }];
        } else {
            if (batchQueue.length === 0) return addToast("القائمة فارغة. يرجى رفع ملفات نصية.", "error");
            tasks = batchQueue.map(item => ({ prompt: item.content, filename: item.filename }));
        }

        setIsGenerating(true);
        setProgress({ current: 0, total: tasks.length * imageCount });

        // --- 1. PRE-GENERATE PLACEHOLDERS ---
        const placeholders: GeneratedImage[] = [];
        let globalIndex = 0;

        tasks.forEach(task => {
            for (let i = 0; i < imageCount; i++) {
                const id = Date.now().toString() + "_" + globalIndex + "_" + Math.random().toString(36).substring(7);
                let finalFilename = '';
                if (task.filename) {
                    const transformed = transformFilename(task.filename, i + 1);
                    finalFilename = imageCount > 1 ? `${transformed}_${i+1}` : transformed;
                } else {
                    finalFilename = `image_${Date.now()}`;
                }

                placeholders.push({
                    id,
                    url: '',
                    prompt: task.prompt, // Store RAW prompt here
                    negativePrompt: negativePrompt,
                    date: Date.now(),
                    ratio: selectedRatio.value,
                    model: selectedModel,
                    filename: finalFilename,
                    status: 'loading' 
                });
                globalIndex++;
            }
        });

        setHistory(prev => [...placeholders, ...prev]);
        if (galleryScrollRef.current) galleryScrollRef.current.scrollTop = 0;

        // --- 2. START PROCESSING ---
        setTimeout(async () => {
            let processedCount = 0;
            const activeStyleValue = selectedStyle.value;
            const activeStyleKeywords = selectedStyle.keywords || [];
            let placeholderIndex = 0;

            try {
                for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
                    const task = tasks[tIdx];
                    setProcessingIndex(tIdx);

                    if (tIdx > 0 || processedCount > 0) {
                        await new Promise(r => setTimeout(r, 2000));
                    }

                    const cleanedContent = cleanPromptFromStyle(task.prompt, activeStyleKeywords);
                    let finalPrompt = activeStyleValue 
                        ? `${activeStyleValue}, ${cleanedContent}` 
                        : cleanedContent;

                    if (enableAiEnhance) {
                        try {
                            const enhanced = await generateEnhancedImagePrompt(cleanedContent, activeStyleValue || "High Quality", profile?.geminiApiKey);
                            if (enhanced && enhanced.length > 10) finalPrompt = enhanced;
                        } catch (e) { console.warn("Enhancement failed, using original"); }
                    }

                    for (let i = 0; i < imageCount; i++) {
                        const currentPlaceholder = placeholders[placeholderIndex];
                        let success = false;
                        let retryCount = 0;
                        const maxRetries = 3;

                        if (finalPrompt !== task.prompt) {
                             setHistory(prev => prev.map(img => img.id === currentPlaceholder.id ? { ...img, prompt: finalPrompt } : img));
                        }

                        while (!success && retryCount < maxRetries) {
                            try {
                                const resultUrls = await generateImages(
                                    [finalPrompt], 
                                    "", // Style baked
                                    selectedModel, 
                                    profile?.geminiApiKey,
                                    { width: selectedRatio.width, height: selectedRatio.height },
                                    negativePrompt
                                );

                                if (resultUrls.length > 0 && resultUrls[0]) {
                                    let finalUrl = resultUrls[0];
                                    
                                    // PROXY HANDLING FOR POLLINATIONS
                                    if (selectedModel === 'pollinations.ai' && useProxy) {
                                        try {
                                            const proxyBase64 = await fetchThroughProxy(finalUrl);
                                            finalUrl = proxyBase64;
                                        } catch(proxyErr) {
                                            console.error("Proxy failed, falling back to direct", proxyErr);
                                            // Fallback to direct URL if proxy fails, but warn
                                            addToast("فشل الاتصال عبر البروكسي، تم التحميل المباشر", "warning");
                                        }
                                    }

                                    setHistory(prev => prev.map(img => img.id === currentPlaceholder.id ? { ...img, url: finalUrl, status: 'success' } : img));
                                    if (autoSave) triggerDownload(finalUrl, currentPlaceholder.filename || 'image');
                                    success = true;
                                } else { throw new Error("Empty result"); }

                            } catch (itemError) {
                                console.error(`Generation failed (Attempt ${retryCount + 1}/${maxRetries})`, itemError);
                                retryCount++;
                                if (retryCount < maxRetries) await new Promise(r => setTimeout(r, 1500));
                                else setHistory(prev => prev.map(img => img.id === currentPlaceholder.id ? { ...img, status: 'error' } : img));
                            }
                        }
                        placeholderIndex++;
                        processedCount++;
                        setProgress({ current: processedCount, total: tasks.length * imageCount });
                    }
                }
                addToast(`تم الانتهاء! تم معالجة ${processedCount} صورة.`, "success");
                if (mode === 'BATCH') setBatchQueue([]);

            } catch (e: any) {
                addToast("حدث خطأ: " + e.message, "error");
            } finally {
                setIsGenerating(false);
                setProcessingIndex(null);
                setProgress({ current: 0, total: 0 });
            }
        }, 100);
    };

    const handleRegenerateSingle = async (id: string, newPrompt: string) => {
        setHistory(prev => prev.map(img => img.id === id ? { ...img, status: 'loading', prompt: newPrompt } : img));
        setEditingImage(null); 
        try {
            const targetImg = history.find(img => img.id === id);
            const ratio = targetImg ? ASPECT_RATIOS.find(r => r.value === targetImg.ratio) : selectedRatio;
            
            const resultUrls = await generateImages(
                [newPrompt], "", selectedModel, profile?.geminiApiKey,
                { width: ratio?.width || 1024, height: ratio?.height || 1024 },
                negativePrompt
            );

            if (resultUrls.length > 0) {
                let finalUrl = resultUrls[0];
                if (selectedModel === 'pollinations.ai' && useProxy) {
                    try { finalUrl = await fetchThroughProxy(finalUrl); } 
                    catch (e) { console.warn("Proxy regen failed"); }
                }

                setHistory(prev => prev.map(img => img.id === id ? { ...img, url: finalUrl, status: 'success' } : img));
                addToast("تم إعادة توليد الصورة بنجاح", "success");
            } else { throw new Error("Failed"); }
        } catch (e) {
            setHistory(prev => prev.map(img => img.id === id ? { ...img, status: 'error' } : img));
            addToast("فشل إعادة التوليد", "error");
        }
    };

    const openEditModal = (img: GeneratedImage) => {
        setEditingImage(img);
        setEditPromptText(img.prompt);
    };

    const openFilterMode = (img: GeneratedImage) => {
        setSelectedFilterImage(img);
        setActiveTab('FILTERS');
    };

    const handleSendToEditor = (url: string) => {
        setPendingImageForEditor(url);
        const event = new CustomEvent('SWITCH_TAB', { detail: 'optimizer' });
        window.dispatchEvent(event);
        addToast("تم إرسال الصورة إلى المحرر", "success");
    };

    const handleDeleteImage = (id: string) => {
        if(confirm("حذف هذه الصورة؟")) {
            setHistory(prev => prev.filter(img => img.id !== id));
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-85px)] animate-fade-in relative pb-6">
            
            {/* --- Prompt Edit Modal --- */}
            {editingImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-indigo-500/50 overflow-hidden">
                        <div className="p-4 border-b dark:border-slate-700 bg-indigo-600 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Edit3 size={18}/> تعديل البرومبت وإعادة التوليد</h3>
                            <button onClick={() => setEditingImage(null)}><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-2 block">البرومبت الحالي:</label>
                                <textarea 
                                    value={editPromptText} 
                                    onChange={(e) => setEditPromptText(e.target.value)}
                                    className="w-full h-32 p-3 bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => handleRegenerateSingle(editingImage.id, editPromptText)}
                                    className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <RefreshCw size={16}/> حفظ وإعادة التوليد فوراً
                                </button>
                                <button onClick={() => setEditingImage(null)} className="px-4 py-2.5 bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 transition">إلغاء</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar Controls */}
            <div className="lg:w-80 flex-shrink-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden h-full">
                
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <ImageIcon className="text-indigo-500"/> استوديو الصور
                    </h3>
                </div>

                {/* Tab Switcher */}
                <div className="flex border-b border-gray-200 dark:border-slate-700">
                    <button 
                        onClick={() => setActiveTab('GENERATE')}
                        className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-2 ${activeTab === 'GENERATE' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Sparkles size={14}/> توليد
                    </button>
                    <button 
                        onClick={() => setActiveTab('FILTERS')}
                        className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-2 ${activeTab === 'FILTERS' ? 'border-b-2 border-pink-600 text-pink-600 bg-pink-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Palette size={14}/> فلاتر وتعديل
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                    
                    {activeTab === 'GENERATE' ? (
                        <>
                            {/* Mode Switcher */}
                            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                                <button 
                                    onClick={() => setMode('SINGLE')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${mode === 'SINGLE' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-gray-500'}`}
                                >
                                    <ToggleLeft className="inline-block mr-1 w-4 h-4"/> فردي
                                </button>
                                <button 
                                    onClick={() => setMode('BATCH')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${mode === 'BATCH' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-gray-500'}`}
                                >
                                    <Layers className="inline-block mr-1 w-4 h-4"/> دفعات (ملفات)
                                </button>
                            </div>

                            {/* Inputs */}
                            {mode === 'SINGLE' ? (
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">الوصف (Prompt)</label>
                                    <div className="relative group">
                                        <textarea 
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                            placeholder="صف الصورة التي تريدها بدقة..."
                                            className="w-full p-3 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32"
                                            dir="auto"
                                        />
                                        <button 
                                            onClick={handleMagicEnhance}
                                            disabled={isEnhancing || !prompt}
                                            className="absolute bottom-2 right-2 p-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-sm hover:shadow-md transition disabled:opacity-50 group-hover:scale-105"
                                            title="توحيد الستايل وتحسين الوصف"
                                        >
                                            {isEnhancing ? <RefreshCw className="animate-spin" size={14}/> : <Wand2 size={14}/>}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">رفع ملفات النصوص (Multi-File)</label>
                                    <div className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer relative" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="mx-auto text-gray-400 mb-2" size={24}/>
                                        <p className="text-xs text-gray-500">اضغط لرفع ملف أو أكثر (.txt)<br/>سيتم حفظ الصورة بنفس اسم الملف (prompt 1 - image 1)</p>
                                        <input 
                                            type="file" 
                                            ref={fileInputRef} 
                                            className="hidden" 
                                            accept=".txt" 
                                            multiple // Enable multiple files
                                            onChange={handleBatchFileUpload}
                                        />
                                    </div>
                                    
                                    {/* Queue Display */}
                                    {batchQueue.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 max-h-40 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-slate-700">
                                            <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-200 dark:border-slate-700">
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">القائمة ({batchQueue.length})</span>
                                                <button onClick={clearBatchQueue} className="text-red-500 text-[10px] hover:underline">مسح</button>
                                            </div>
                                            <div className="space-y-1">
                                                {batchQueue.map((item, idx) => (
                                                    <div key={idx} className={`flex items-center gap-2 text-[10px] p-1.5 rounded ${idx === processingIndex ? 'bg-indigo-100 text-indigo-700 animate-pulse' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {idx === processingIndex ? <RefreshCw size={10} className="animate-spin"/> : <FileText size={10}/>}
                                                        <span className="truncate flex-1" title={item.content}>{item.filename}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Negative Prompt */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-gray-500">استبعاد (Negative Prompt)</label>
                                    <button onClick={() => setNegativePrompt(DEFAULT_NEGATIVE)} className="text-[9px] text-indigo-500 hover:underline">استعادة الافتراضي</button>
                                </div>
                                <input 
                                    value={negativePrompt} 
                                    onChange={(e) => setNegativePrompt(e.target.value)}
                                    placeholder="low quality, blur, text..." 
                                    className="w-full p-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:border-red-400 text-gray-600 dark:text-gray-300"
                                />
                            </div>

                            {/* Settings Accordion */}
                            <div className="space-y-4 border-t border-gray-100 dark:border-slate-800 pt-4">
                                
                                {/* Aspect Ratio */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-2 block">الأبعاد</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {ASPECT_RATIOS.map(ratio => (
                                            <button
                                                key={ratio.value}
                                                onClick={() => setSelectedRatio(ratio)}
                                                className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${selectedRatio.value === ratio.value ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500'}`}
                                            >
                                                <ratio.icon size={20} />
                                                <span className="text-[10px] font-bold mt-1">{ratio.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Style Selector */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-2 block">النمط الفني</label>
                                    <select 
                                        value={selectedStyle.value}
                                        onChange={(e) => setSelectedStyle(ADVANCED_STYLES.find(s => s.value === e.target.value) || ADVANCED_STYLES[0])}
                                        className="w-full p-2.5 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl text-xs outline-none"
                                    >
                                        {ADVANCED_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                    <p className="text-[9px] text-gray-400 mt-1 flex items-center gap-1">
                                        <CheckCircle size={10} className="text-green-500"/>
                                        سيتم دمج الستايل تلقائياً مع الوصف.
                                    </p>
                                </div>

                                {/* Model & Count */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">النموذج</label>
                                        <select 
                                            value={selectedModel}
                                            onChange={(e) => setSelectedModel(e.target.value)}
                                            className="w-full p-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs outline-none"
                                        >
                                            <option value="pollinations.ai">Pollinations (Free)</option>
                                            <option value="gemini-2.5-flash-image">Gemini Flash Image</option>
                                            {settings.customModels?.filter(m => m.includes('image') || m.includes('vision')).map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 mb-1 block">العدد: {imageCount}</label>
                                        <input 
                                            type="range" min="1" max="4" step="1" 
                                            value={imageCount}
                                            onChange={(e) => setImageCount(Number(e.target.value))}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                </div>

                                {/* AI Enhance Toggle */}
                                <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                    <div className="flex items-center gap-2">
                                        <Bot size={16} className="text-indigo-600 dark:text-indigo-400"/>
                                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">تحسين البرومبت بالـ AI</span>
                                    </div>
                                    <input 
                                        type="checkbox" 
                                        checked={enableAiEnhance} 
                                        onChange={(e) => setEnableAiEnhance(e.target.checked)} 
                                        className="accent-indigo-600 w-4 h-4 cursor-pointer"
                                    />
                                </div>

                                {/* Vercel Proxy Mode Toggle */}
                                {selectedModel === 'pollinations.ai' && (
                                    <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                        <div className="flex items-center gap-2">
                                            <Shield size={16} className="text-emerald-600 dark:text-emerald-400"/>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">وضع التخفي (Proxy Mode)</span>
                                                <span className="text-[9px] text-emerald-600 dark:text-emerald-400">تجاوز الحظر عبر سيرفر Vercel</span>
                                            </div>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={useProxy} 
                                            onChange={(e) => setUseProxy(e.target.checked)} 
                                            className="accent-emerald-600 w-4 h-4 cursor-pointer"
                                        />
                                    </div>
                                )}

                                {/* Toggles */}
                                <div className="flex flex-col gap-2 bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">حفظ في السجل (Keep History)</span>
                                        <input type="checkbox" checked={keepHistory} onChange={(e) => setKeepHistory(e.target.checked)} className="accent-indigo-600"/>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-600 dark:text-gray-400">حفظ تلقائي للجهاز (Auto Save)</span>
                                        <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} className="accent-indigo-600"/>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleSaveSettings}
                                    className="w-full flex items-center justify-center gap-2 text-xs bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg font-bold transition border border-gray-200 dark:border-slate-700"
                                >
                                    <Save size={14}/> حفظ الإعدادات كافتراضي
                                </button>

                            </div>
                        </>
                    ) : (
                        // --- FILTERS TAB CONTENT ---
                        <div className="space-y-6">
                            {!selectedFilterImage ? (
                                <div className="text-center py-10 text-gray-400">
                                    <Palette size={48} className="mx-auto mb-4 opacity-20"/>
                                    <p className="text-xs">اختر صورة من المعرض لتعديلها</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 shadow-sm">
                                        <img 
                                            src={selectedFilterImage.url} 
                                            className="w-full h-auto"
                                            style={{ filter: getFilterString() }}
                                            alt="Preview"
                                        />
                                        <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-2 rounded">Preview</div>
                                    </div>

                                    {/* Sliders */}
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Sun size={12}/> السطوع</label><span className="text-[10px] font-mono">{filters.brightness}%</span></div>
                                            <input type="range" min="0" max="200" value={filters.brightness} onChange={(e) => setFilters(p => ({...p, brightness: Number(e.target.value)}))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Contrast size={12}/> التباين</label><span className="text-[10px] font-mono">{filters.contrast}%</span></div>
                                            <input type="range" min="0" max="200" value={filters.contrast} onChange={(e) => setFilters(p => ({...p, contrast: Number(e.target.value)}))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Droplet size={12}/> التشبع</label><span className="text-[10px] font-mono">{filters.saturate}%</span></div>
                                            <input type="range" min="0" max="200" value={filters.saturate} onChange={(e) => setFilters(p => ({...p, saturate: Number(e.target.value)}))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Palette size={12}/> Sepia</label><span className="text-[10px] font-mono">{filters.sepia}%</span></div>
                                            <input type="range" min="0" max="100" value={filters.sepia} onChange={(e) => setFilters(p => ({...p, sepia: Number(e.target.value)}))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><label className="text-[10px] font-bold text-gray-500 flex items-center gap-1"><Aperture size={12}/> Blur (px)</label><span className="text-[10px] font-mono">{filters.blur}px</span></div>
                                            <input type="range" min="0" max="10" step="0.5" value={filters.blur} onChange={(e) => setFilters(p => ({...p, blur: Number(e.target.value)}))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => setFilters(DEFAULT_FILTERS)} className="bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition">إعادة ضبط</button>
                                        <button onClick={() => triggerDownload(selectedFilterImage.url, `edited_${selectedFilterImage.id}`, true)} className="bg-pink-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-pink-700 transition shadow-sm flex items-center justify-center gap-1"><Download size={14}/> حفظ التعديل</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'GENERATE' && (
                    <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                            {isGenerating ? `جاري المعالجة (${progress.current}/${progress.total})` : 'بدء التوليد'}
                        </button>
                    </div>
                )}
            </div>

            {/* Gallery Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Gallery Header */}
                <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Layers size={20} className="text-gray-400"/> معرض الصور ({history.length})
                    </h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleManualRefresh} 
                            className="bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm"
                            title="تحديث حالة الصور المعلقة"
                        >
                            <RefreshCw size={14}/> تحديث
                        </button>
                        {history.length > 0 && (
                            <>
                                <button 
                                    onClick={handleDownloadAll} 
                                    className="bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition shadow-sm"
                                >
                                    <Archive size={14}/> تحميل الكل
                                </button>
                                <button onClick={() => { if(confirm("مسح الكل؟")) setHistory([]); }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition" title="مسح الكل">
                                    <Trash2 size={18}/>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Grid */}
                <div ref={galleryScrollRef} className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-20">
                    {history.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl bg-gray-50/50 dark:bg-slate-900/50 min-h-[400px]">
                            <ImageIcon size={64} className="mb-4 opacity-20"/>
                            <p>لم تقم بتوليد أي صور بعد</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {history.map((img) => (
                                <div 
                                    key={img.id} 
                                    className="group relative bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-slate-800 hover:shadow-md transition cursor-pointer"
                                    onClick={() => img.status === 'success' && setExpandedImage(img)}
                                >
                                    <div className={`w-full bg-gray-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden relative ${img.ratio === '9:16' ? 'aspect-[9/16]' : img.ratio === '1:1' ? 'aspect-square' : 'aspect-video'}`}>
                                        
                                        {/* State: Loading */}
                                        {img.status === 'loading' && (
                                            <div className="absolute inset-0 z-20 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 animate-pulse">
                                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30"></div>
                                                <div className="z-10 bg-white/10 p-4 rounded-full backdrop-blur-sm animate-spin-slow mb-3 shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                                                    <Wand2 size={32} className="text-white drop-shadow-md"/>
                                                </div>
                                                <p className="z-10 text-white text-xs font-bold tracking-widest uppercase animate-pulse drop-shadow-md">
                                                    جاري التوليد...
                                                </p>
                                            </div>
                                        )}
                                        
                                        {/* Error State */}
                                        {img.status === 'error' && (
                                            <div className="absolute inset-0 z-10 w-full h-full flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/10 text-red-400">
                                                <X size={32} />
                                                <p className="text-xs mt-2 font-bold">فشل التوليد</p>
                                                <div className="flex gap-2 mt-2">
                                                    <button onClick={(e) => { e.stopPropagation(); handleRegenerateSingle(img.id, img.prompt); }} className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                        <RotateCcw size={12}/> إعادة المحاولة
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Success State */}
                                        {img.status === 'success' && (
                                            <img 
                                                src={img.url} 
                                                alt={img.prompt} 
                                                className="w-full h-full object-cover transition duration-500 group-hover:scale-105" 
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement?.classList.add('bg-red-50');
                                                }}
                                            />
                                        )}
                                    </div>
                                    
                                    {/* Overlay Actions */}
                                    {img.status === 'success' && (
                                        <div className="absolute inset-0 z-10 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                                            <button onClick={(e) => { e.stopPropagation(); triggerDownload(img.url, img.filename || `nexus_${img.id}.png`); }} className="p-2 bg-white text-gray-800 rounded-full hover:bg-gray-100 transition shadow-lg scale-90 hover:scale-100" title="تحميل"><Download size={18}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); openFilterMode(img); }} className="p-2 bg-pink-600 text-white rounded-full hover:bg-pink-700 transition shadow-lg scale-90 hover:scale-100" title="تعديل وفلاتر"><Palette size={18}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); openEditModal(img); }} className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition shadow-lg scale-90 hover:scale-100" title="تعديل البرومبت"><Edit3 size={18}/></button>
                                            <button onClick={(e) => { e.stopPropagation(); handleSendToEditor(img.url); }} className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition shadow-lg scale-90 hover:scale-100" title="تعديل الصورة (Editor)"><Wand2 size={18}/></button>
                                        </div>
                                    )}

                                    <div className="absolute top-2 right-2 z-30 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id); }} className="bg-red-500 text-white p-1.5 rounded-lg shadow hover:bg-red-600"><Trash2 size={14}/></button>
                                    </div>

                                    <div className="p-3 bg-white dark:bg-slate-900">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate max-w-[70%] ${img.status === 'loading' ? 'bg-purple-100 text-purple-700 animate-pulse' : 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'}`}>{img.filename || 'Untitled'}</span>
                                            <span className="text-[9px] text-gray-400">{new Date(img.date).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1" title={img.prompt}>{img.prompt}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageStudio;
