import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
    Activity, Server, CheckCircle, XCircle, Clock, Plus, Trash2, RefreshCw, 
    Cpu, Box, TestTube, Database, Zap, List, Play, KeyRound, Eraser, 
    Image as ImageIcon, Mic, Archive, Save, ShieldCheck, Lock,
    BarChart3, Wifi, AlertCircle
} from 'lucide-react';

// --- TYPES & INTERFACES ---
interface ModelInfo {
    name: string;
    displayName: string;
    description: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportedGenerationMethods: string[];
}

type ModelCategory = 'stable' | 'experimental' | 'media' | 'gemma' | 'embedding' | 'legacy' | 'other';

interface TestResult extends ModelInfo {
    status: 'idle' | 'testing' | 'success' | 'failed' | 'limited' | 'skipped';
    latency: number;
    errorMsg?: string;
    category: ModelCategory;
    capabilities: string[];
}

// LocalStorage Keys
const STORAGE_KEY_RESULTS = 'nexus_model_tester_results';
const STORAGE_KEY_WORKING_KEY = 'nexus_model_tester_working_key';

const ModelTester: React.FC = () => {
    const { settings, updateSettings } = useAppContext();
    const { addToast } = useToast();
    
    // --- STATE MANAGEMENT ---
    // 1. Results & Data
    const [results, setResults] = useState<TestResult[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY_RESULTS);
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });

    // 2. Working Key (Masked View)
    const [savedWorkingKey, setSavedWorkingKey] = useState<string | null>(() => {
        return localStorage.getItem(STORAGE_KEY_WORKING_KEY);
    });

    // 3. UI States
    const [isLoading, setIsLoading] = useState(false); // For Fetching List
    const [isTesting, setIsTesting] = useState(false); // For Ping Test
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [activeTab, setActiveTab] = useState<ModelCategory | 'failed'>('stable');
    const [customKeysInput, setCustomKeysInput] = useState('');
    const [isKeySectionExpanded, setIsKeySectionExpanded] = useState(!savedWorkingKey);

    // --- EFFECTS ---
    useEffect(() => {
        if (results.length > 0) {
            localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(results));
        }
    }, [results]);

    // --- MEMOS ---
    // Calculate max tokens to render relative bars
    const maxInputTokens = useMemo(() => {
        return Math.max(...results.map(r => r.inputTokenLimit), 128000); // Default min base
    }, [results]);

    // --- HELPERS ---
    
    // Categorization Logic
    const analyzeModel = (name: string, methods: string[]): { category: ModelCategory, isLegacy: boolean } => {
        const lowerName = name.toLowerCase();
        
        // 1. Legacy
        if (lowerName.includes('-001') && !lowerName.includes('embedding')) return { category: 'legacy', isLegacy: true };
        
        // 2. Media (Vision / Audio)
        if (lowerName.includes('imagen') || lowerName.includes('image')) return { category: 'media', isLegacy: false };
        if (lowerName.includes('tts') || lowerName.includes('sound') || lowerName.includes('speech')) return { category: 'media', isLegacy: false };
        
        // 3. Embeddings
        if (methods.includes('embedContent') && !methods.includes('generateContent')) return { category: 'embedding', isLegacy: false };
        if (lowerName.includes('embedding')) return { category: 'embedding', isLegacy: false };
        
        // 4. Gemma (Explicit check)
        if (lowerName.includes('gemma')) return { category: 'gemma', isLegacy: false };
        
        // 5. Experimental
        if (lowerName.includes('exp') || lowerName.includes('preview') || lowerName.includes('beta') || lowerName.includes('rc')) return { category: 'experimental', isLegacy: false };
        
        // 6. Stable (Core)
        if (lowerName.includes('pro') || lowerName.includes('flash') || lowerName.includes('ultra')) return { category: 'stable', isLegacy: false };

        return { category: 'other', isLegacy: false };
    };

    // Robust Key Extraction
    const getCandidates = (): string[] => {
        // Priority 1: Custom Input
        if (customKeysInput.trim().length > 0) {
            const matches = customKeysInput.match(/AIza[0-9A-Za-z\-_]{35}/g);
            return matches ? Array.from(new Set(matches)) : [];
        }
        // Priority 2: Saved Working Key (If exists and no custom input)
        if (savedWorkingKey) {
            return [savedWorkingKey];
        }
        // Priority 3: Global Settings
        const globalKeys = (settings.geminiApiKeys || []).join('\n');
        const matches = globalKeys.match(/AIza[0-9A-Za-z\-_]{35}/g);
        return matches ? Array.from(new Set(matches)) : [];
    };

    const maskKey = (key: string) => {
        if (!key || key.length < 10) return "Invalid Key";
        return `${key.substring(0, 6)}••••••••••••••••${key.substring(key.length - 6)}`;
    };

    const handleClearSavedKey = () => {
        if(confirm("هل تريد حذف المفتاح المحفوظ لهذا الفحص؟")) {
            localStorage.removeItem(STORAGE_KEY_WORKING_KEY);
            setSavedWorkingKey(null);
            setIsKeySectionExpanded(true);
            addToast("تم حذف المفتاح المحفوظ", "info");
        }
    };

    // --- PHASE 1: Fetch Full Model List (With Pagination) ---
    const fetchModelList = async () => {
        const candidates = getCandidates();
        
        if (candidates.length === 0) {
            addToast("لم يتم العثور على مفاتيح صالحة (يجب أن تبدأ بـ AIza).", "error");
            return;
        }

        setIsLoading(true);
        setResults([]); // Clear old results
        
        let success = false;
        let finalModels: any[] = [];
        let usedKey = '';

        addToast(`جاري الاتصال وتجربة ${candidates.length} مفتاح...`, "info");

        // Try keys one by one
        for (const key of candidates) {
            try {
                let allFetched = false;
                let pageToken = '';
                let tempModels: any[] = [];

                // Pagination Loop
                while (!allFetched) {
                    let url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=100`; // Max Page Size
                    if (pageToken) url += `&pageToken=${pageToken}`;

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'x-goog-api-key': key,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`Status ${response.status}`);
                    }

                    const data = await response.json();
                    if (data.models) {
                        tempModels = [...tempModels, ...data.models];
                    }

                    if (data.nextPageToken) {
                        pageToken = data.nextPageToken;
                    } else {
                        allFetched = true;
                    }
                }

                // If we reached here, this key works and fetched everything
                finalModels = tempModels;
                usedKey = key;
                success = true;
                break; // Stop trying other keys

            } catch (e) {
                console.warn(`Key failed: ${maskKey(key)}`, e);
                // Continue to next key
            }
        }

        if (success) {
            // Process Models
            const processedModels: TestResult[] = finalModels.map((m: any) => {
                const name = m.name.replace('models/', '');
                const { category } = analyzeModel(name, m.supportedGenerationMethods || []);
                
                return {
                    name: name,
                    displayName: m.displayName,
                    description: m.description,
                    inputTokenLimit: m.inputTokenLimit,
                    outputTokenLimit: m.outputTokenLimit,
                    supportedGenerationMethods: m.supportedGenerationMethods || [],
                    status: 'idle',
                    latency: 0,
                    category: category,
                    capabilities: m.supportedGenerationMethods || []
                };
            });

            // Sort logic
            processedModels.sort((a, b) => b.inputTokenLimit - a.inputTokenLimit);

            setResults(processedModels);
            
            // Save the working key
            if (usedKey !== savedWorkingKey) {
                localStorage.setItem(STORAGE_KEY_WORKING_KEY, usedKey);
                setSavedWorkingKey(usedKey);
                setIsKeySectionExpanded(false); // Auto collapse on success
                addToast("تم حفظ المفتاح الناجح للعمليات القادمة", "success");
            }

            addToast(`تم جلب ${processedModels.length} نموذج بنجاح!`, "success");
        } else {
            addToast("فشلت جميع المفاتيح في جلب القائمة.", "error");
        }

        setIsLoading(false);
    };

    // --- PHASE 2: Run Latency Tests ---
    const runLatencyTests = async () => {
        if (results.length === 0) return;

        const candidates = getCandidates();
        const apiKey = candidates[0]; 
        
        if (!apiKey) {
             addToast("لا يوجد مفتاح صالح.", "error");
             return;
        }

        setIsTesting(true);
        setProgress({ current: 0, total: results.length });
        const ai = new GoogleGenerativeAI(apiKey);

        for (let i = 0; i < results.length; i++) {
            const modelData = results[i];
            setProgress({ current: i + 1, total: results.length });
            
            // Skip Legacy & Media models to avoid errors/wasted quota
            if (modelData.category === 'legacy' || modelData.category === 'media') {
                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'skipped', errorMsg: 'Skipped (Media/Legacy)' } : r));
                continue;
            }

            setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'testing' } : r));

            const start = performance.now();
            let status: TestResult['status'] = 'success';
            let errorMsg = '';

            try {
                if (modelData.category === 'embedding') {
                    const model = ai.getGenerativeModel({ model: modelData.name });
                    await model.embedContent("Ping");
                } else {
                    const model = ai.getGenerativeModel({ model: modelData.name });
                    await model.generateContent({
                        contents: [{ role: 'user', parts: [{ text: 'Ping' }] }],
                    }); 
                }
            } catch (e: any) {
                const errStr = e.toString().toLowerCase();
                if (errStr.includes('429') || errStr.includes('quota')) {
                    status = 'limited';
                    errorMsg = 'Rate Limit';
                } else if (errStr.includes('404') || errStr.includes('not found')) {
                    status = 'failed';
                    errorMsg = 'Not Found';
                } else {
                    status = 'failed';
                    errorMsg = 'Error';
                }
            }

            const latency = Math.round(performance.now() - start);
            setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status, latency, errorMsg } : r));
            
            // Throttle slightly to prevent rate limits
            await new Promise(r => setTimeout(r, 200)); 
        }

        addToast("تم الانتهاء من اختبار السرعة!", "success");
        setIsTesting(false);
    };

    const toggleModelSelection = (modelName: string) => {
        const currentCustom = settings.customModels || [];
        let updated: string[];
        if (currentCustom.includes(modelName)) {
            updated = currentCustom.filter(m => m !== modelName);
            addToast(`تم إزالة ${modelName}`, "info");
        } else {
            updated = [...currentCustom, modelName];
            addToast(`تم إضافة ${modelName}`, "success");
        }
        updateSettings({ customModels: updated });
    };

    const clearCache = () => {
        if(confirm("هل تريد مسح النتائج المحفوظة وبدء فحص جديد؟")) {
            setResults([]);
            localStorage.removeItem(STORAGE_KEY_RESULTS);
            addToast("تم مسح السجل", "info");
        }
    };

    // --- UI HELPERS ---
    
    // Status Badge Logic
    const getStatusBadge = (r: TestResult) => {
        const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border";
        
        switch(r.status) {
            case 'idle': 
                return <span className={`${baseClasses} bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:border-gray-700`}><Clock size={10}/> الانتظار</span>;
            case 'success': 
                // Color code latency
                const latColor = r.latency < 500 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : r.latency < 1500 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-orange-100 text-orange-700 border-orange-200';
                return <span className={`${baseClasses} ${latColor}`}><Wifi size={10}/> {r.latency}ms</span>;
            case 'testing': 
                return <span className={`${baseClasses} bg-blue-50 text-blue-600 border-blue-200`}><RefreshCw size={10} className="animate-spin"/> جاري..</span>;
            case 'limited': 
                return <span className={`${baseClasses} bg-amber-50 text-amber-600 border-amber-200`}><AlertCircle size={10}/> Rate Limit</span>;
            case 'failed': 
                return <span className={`${baseClasses} bg-red-50 text-red-600 border-red-200`}><XCircle size={10}/> فشل</span>;
            case 'skipped': 
                return <span className={`${baseClasses} bg-gray-100 text-gray-400 border-gray-200`}><Eraser size={10}/> تخطي</span>;
            default: return null;
        }
    };

    // Capacity Visualizer (Token Bar)
    const TokenBar = ({ value, max, colorClass }: { value: number, max: number, colorClass: string }) => {
        const percentage = Math.min(100, Math.max(1, (value / max) * 100));
        return (
            <div className="flex flex-col gap-1 w-full max-w-[120px]">
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                    <span>{new Intl.NumberFormat('en', { notation: "compact" }).format(value)}</span>
                </div>
                <div className="h-1.5 w-full bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percentage}%` }}></div>
                </div>
            </div>
        );
    };

    const filteredResults = results.filter(r => 
        activeTab === 'failed' 
        ? (r.status === 'failed' || r.status === 'limited') 
        : r.category === activeTab
    );

    const tabs: { id: ModelCategory | 'failed', label: string, icon: React.ReactNode, color: string }[] = [
        { id: 'stable', label: 'المستقرة (Stable)', icon: <CheckCircle size={14}/>, color: 'text-emerald-600 border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' },
        { id: 'gemma', label: 'Gemma', icon: <Cpu size={14}/>, color: 'text-cyan-600 border-cyan-600 bg-cyan-50 dark:bg-cyan-900/20' },
        { id: 'experimental', label: 'تجريبية (Beta)', icon: <TestTube size={14}/>, color: 'text-indigo-600 border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' },
        { id: 'media', label: 'ميديا (Vision)', icon: <ImageIcon size={14}/>, color: 'text-pink-600 border-pink-600 bg-pink-50 dark:bg-pink-900/20' },
        { id: 'embedding', label: 'Embeddings', icon: <Database size={14}/>, color: 'text-purple-600 border-purple-600 bg-purple-50 dark:bg-purple-900/20' },
        { id: 'legacy', label: 'Legacy', icon: <Archive size={14}/>, color: 'text-slate-500 border-slate-500 bg-slate-100 dark:bg-slate-800' },
        { id: 'failed', label: 'أخطاء / Limits', icon: <XCircle size={14}/>, color: 'text-red-600 border-red-600 bg-red-50 dark:bg-red-900/20' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* 1. KEY MANAGEMENT SECTION (Redesigned) */}
            <div className={`bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 transition-all duration-300 overflow-hidden ${isKeySectionExpanded ? 'p-6 ring-2 ring-indigo-50 dark:ring-slate-800' : 'p-4'}`}>
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsKeySectionExpanded(!isKeySectionExpanded)}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${savedWorkingKey ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                            <KeyRound size={20} />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">إعدادات الاتصال</h4>
                            <p className="text-xs text-gray-500">
                                {savedWorkingKey 
                                    ? `متصل باستخدام مفتاح محفوظ: ${maskKey(savedWorkingKey)}` 
                                    : "يرجى توفير مفتاح API للبدء"}
                            </p>
                        </div>
                    </div>
                    <button className="text-gray-400 hover:text-indigo-600 transition">
                        {isKeySectionExpanded ? 'إخفاء' : 'تعديل'}
                    </button>
                </div>

                {isKeySectionExpanded && (
                    <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800 animate-in slide-in-from-top-2">
                        <div className="relative">
                            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">مفاتيح مخصصة (اختياري)</label>
                            <textarea 
                                value={customKeysInput}
                                onChange={(e) => setCustomKeysInput(e.target.value)}
                                placeholder="ألصق مفاتيح Gemini هنا (AIza...). يمكن وضع عدة مفاتيح للتبديل التلقائي."
                                className="w-full h-24 p-4 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none dark:bg-slate-950 dark:text-white resize-none shadow-inner"
                                dir="ltr"
                            />
                            <div className="absolute top-9 right-3 text-gray-300 pointer-events-none">
                                <Lock size={14}/>
                            </div>
                        </div>
                        
                        <div className="flex justify-between items-center mt-3">
                             <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                                <ShieldCheck size={12} className="text-green-500"/>
                                سيتم تخزين المفتاح الصالح محلياً في متصفحك فقط.
                            </p>
                            {savedWorkingKey && (
                                <button 
                                    onClick={handleClearSavedKey} 
                                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition"
                                >
                                    <Trash2 size={12}/> حذف المفتاح المحفوظ
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. MAIN RESULTS PANEL */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col h-[600px] md:h-auto">
                
                {/* Header Actions */}
                <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 sticky top-0">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                        <div>
                            <h3 className="font-extrabold text-gray-800 dark:text-white flex items-center gap-2 text-xl tracking-tight">
                                <Server size={22} className="text-indigo-600 fill-indigo-100 dark:fill-indigo-900"/> 
                                مختبر النماذج <span className="text-indigo-600 font-light opacity-50">|</span> Nexus
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 font-medium">
                                فحص، مقارنة، واختيار نماذج Gemini المتاحة لحسابك.
                            </p>
                        </div>
                        
                        <div className="flex gap-2 w-full md:w-auto">
                            {results.length > 0 && (
                                <button onClick={clearCache} className="px-3 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 transition text-xs border border-transparent hover:border-red-200">
                                    <Trash2 size={16}/>
                                </button>
                            )}

                            <button 
                                onClick={fetchModelList}
                                disabled={isLoading || isTesting}
                                className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 ${results.length > 0 ? 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 dark:bg-slate-800 dark:border-slate-700 dark:text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'}`}
                            >
                                {isLoading ? <RefreshCw className="animate-spin" size={18}/> : <List size={18}/>}
                                <span>{isLoading ? 'جاري الاتصال...' : 'تحديث القائمة'}</span>
                            </button>

                            {results.length > 0 && (
                                <button 
                                    onClick={runLatencyTests}
                                    disabled={isTesting}
                                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-200/50 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    {isTesting ? <RefreshCw className="animate-spin" size={18}/> : <Play size={18} fill="currentColor"/>}
                                    <span>{isTesting ? 'جاري الفحص...' : 'اختبار السرعة'}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar (Visible only when testing) */}
                    {isTesting && (
                        <div className="w-full bg-gray-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-2 relative">
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-300 ease-out flex items-center justify-end"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            >
                            </div>
                            <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-500 h-full flex items-center">{Math.round((progress.current / progress.total) * 100)}%</span>
                        </div>
                    )}
                </div>

                {/* 3. TABS & CONTENT */}
                {results.length > 0 ? (
                    <div className="flex flex-col h-full bg-gray-50/50 dark:bg-slate-950/30">
                        {/* Tabs Scroll Area */}
                        <div className="px-5 pt-4 pb-2 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar mask-gradient-right">
                                {tabs.map(tab => {
                                    const count = results.filter(r => tab.id === 'failed' ? (r.status === 'failed' || r.status === 'limited') : r.category === tab.id).length;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button 
                                            key={tab.id} 
                                            onClick={() => setActiveTab(tab.id as any)} 
                                            className={`flex items-center gap-2 pl-3 pr-4 py-2 rounded-full text-xs font-bold transition-all border whitespace-nowrap outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-200 dark:focus:ring-slate-700 ${isActive ? tab.color : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 hover:border-gray-300'}`}
                                        >
                                            {tab.icon} 
                                            {tab.label} 
                                            {count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-white/50 text-current' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'}`}>{count}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Table Area */}
                        <div className="flex-1 overflow-auto custom-scrollbar p-0 md:p-4">
                            <div className="bg-white dark:bg-slate-900 md:rounded-xl md:border border-gray-200 dark:border-slate-800 md:shadow-sm overflow-hidden min-w-[600px] md:min-w-0">
                                <table className="w-full text-sm text-right border-collapse">
                                    <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                                        <tr>
                                            <th className="p-4 border-b dark:border-slate-700 w-1/3">الموديل (Model ID)</th>
                                            <th className="p-4 border-b dark:border-slate-700 w-1/4">السعة (Context)</th>
                                            <th className="p-4 border-b dark:border-slate-700 text-center w-1/6">النوع</th>
                                            <th className="p-4 border-b dark:border-slate-700 text-center w-1/6">الحالة</th>
                                            <th className="p-4 border-b dark:border-slate-700 text-center w-24">تفعيل</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {filteredResults.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-20 text-center">
                                                    <div className="flex flex-col items-center justify-center text-gray-300 dark:text-slate-600">
                                                        <Box size={64} strokeWidth={1} className="mb-4"/>
                                                        <p className="text-sm font-medium">لا توجد نماذج في هذا التصنيف.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredResults.map((model) => {
                                                const isSelected = settings.customModels?.includes(model.name);
                                                return (
                                                    <tr key={model.name} className={`group transition-colors duration-150 ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}>
                                                        <td className="p-4 align-top">
                                                            <div className="flex items-start gap-3">
                                                                <div className="bg-gray-100 dark:bg-slate-800 p-2 rounded-lg text-gray-500 mt-1">
                                                                    <Box size={16}/>
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-gray-800 dark:text-gray-200 font-mono text-sm group-hover:text-indigo-600 transition-colors select-all">
                                                                        {model.name}
                                                                    </div>
                                                                    {model.displayName && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{model.displayName}</div>}
                                                                    <div className="text-[10px] text-gray-400 mt-1 line-clamp-2 max-w-xs leading-relaxed opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        {model.description}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] w-8 text-gray-400 font-bold">Input</span>
                                                                    <TokenBar value={model.inputTokenLimit} max={maxInputTokens} colorClass="bg-indigo-500" />
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] w-8 text-gray-400 font-bold">Output</span>
                                                                    <TokenBar value={model.outputTokenLimit} max={16384} colorClass="bg-pink-500" />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle text-center">
                                                            {model.category === 'media' && <span className="inline-block bg-pink-50 text-pink-700 border border-pink-100 px-2 py-1 rounded text-[10px] font-bold">Vision / Audio</span>}
                                                            {model.category === 'embedding' && <span className="inline-block bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded text-[10px] font-bold">Embedding</span>}
                                                            {model.category === 'gemma' && <span className="inline-block bg-cyan-50 text-cyan-700 border border-cyan-100 px-2 py-1 rounded text-[10px] font-bold">Gemma Open</span>}
                                                            {model.category === 'stable' && <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded text-[10px] font-bold">Pro / Flash</span>}
                                                            {model.category === 'experimental' && <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded text-[10px] font-bold">Experimental</span>}
                                                            {model.category === 'legacy' && <span className="inline-block bg-gray-100 text-gray-500 border border-gray-200 px-2 py-1 rounded text-[10px]">Legacy</span>}
                                                        </td>
                                                        <td className="p-4 align-middle text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                {getStatusBadge(model)}
                                                                {model.errorMsg && <span className="text-[9px] text-red-400 max-w-[120px] truncate block" title={model.errorMsg}>{model.errorMsg}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-middle text-center">
                                                            <button 
                                                                onClick={() => toggleModelSelection(model.name)} 
                                                                className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 ${
                                                                    isSelected 
                                                                    ? 'bg-green-600 text-white shadow-green-200 hover:bg-green-700' 
                                                                    : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 dark:bg-slate-800 dark:border-slate-700 dark:text-gray-300'
                                                                }`}
                                                            >
                                                                {isSelected ? <CheckCircle size={14} className="text-white"/> : <Plus size={14}/>}
                                                                {isSelected ? 'مفعل' : 'إضافة'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Empty State
                    <div className="flex flex-col items-center justify-center flex-1 p-12 text-center bg-gray-50/30 dark:bg-slate-900">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-full shadow-lg mb-6 animate-bounce-slow">
                            <BarChart3 size={48} className="text-indigo-500" strokeWidth={1.5}/>
                        </div>
                        <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">القائمة فارغة</h4>
                        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                            لم يتم جلب أي بيانات بعد. تأكد من إعداد مفتاح API في الأعلى، ثم اضغط على زر "تحديث القائمة" للاتصال بخوادم Google.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModelTester;