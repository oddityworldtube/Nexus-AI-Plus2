
import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../contexts/ToastContext';
import { addTashkeel, generateBatchScenePrompts, suggestArtStyle, generateVisualScriptThumbnails } from '../services/geminiService';
import { useAppContext } from '../contexts/AppContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { 
    Split, Wand2, Download, Image as ImageIcon, 
    Settings, RefreshCw, FileText, Folder, 
    ChevronRight, ChevronDown, Check, Play,
    AlignRight, Sparkles, Layout, Send
} from 'lucide-react';
import JSZip from 'jszip';

interface Segment {
    id: string;
    text: string;
    prompt: string;
    isProcessed: boolean;
}

interface ThumbnailPrompt {
    id: string;
    prompt: string;
    createdAt: string;
}

const VisualScripting: React.FC = () => {
    const { addToast } = useToast();
    const { profiles, currentProfileId, setPendingBatchPrompts, settings, pendingScriptForSplitter, setPendingScriptForSplitter } = useAppContext();
    const profile = profiles.find(p => p.id === currentProfileId);

    // --- Persistent State (useLocalStorage) ---
    // This ensures data survives tab switching
    const [rawText, setRawText] = useLocalStorage<string>('vs_raw_text', '');
    const [segments, setSegments] = useLocalStorage<Segment[]>('vs_segments', []);
    const [artStyle, setArtStyle] = useLocalStorage<string>('vs_art_style', 'Cinematic, Realistic, 8k, Dramatic Lighting');
    const [thumbnailHistory, setThumbnailHistory] = useLocalStorage<ThumbnailPrompt[]>('vs_thumb_history', []);
    
    // Settings
    const [sentencesPerSplit, setSentencesPerSplit] = useState(2);
    const [enableTashkeel, setEnableTashkeel] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);

    // Selection
    const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
    
    // Loading States
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMagicStyleLoading, setIsMagicStyleLoading] = useState(false);
    const [isThumbLoading, setIsThumbLoading] = useState(false);
    const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

    // --- EFFECT: Check for Pending Script from FullContentGenerator ---
    useEffect(() => {
        if (pendingScriptForSplitter) {
            setRawText(pendingScriptForSplitter);
            setPendingScriptForSplitter(null); // Clear context
            
            // Optional: Notify user or Auto-focus?
            // Notification is handled by the sender (FullContentGenerator) usually, 
            // but we can add visual feedback here if needed.
            // If the user just arrived here, they likely want to see the text.
            setIsSettingsOpen(true);
        }
    }, [pendingScriptForSplitter]);

    // --- Logic ---

    const handleSplit = () => {
        if (!rawText.trim()) return;
        
        const sentenceRegex = /(?<=[.!?؟])\s+/;
        const allSentences = rawText.split(sentenceRegex).filter(s => s.trim().length > 0);
        
        const newSegments: Segment[] = [];
        let currentChunk: string[] = [];
        
        allSentences.forEach((sentence, index) => {
            currentChunk.push(sentence.trim());
            
            if (currentChunk.length === sentencesPerSplit || index === allSentences.length - 1) {
                newSegments.push({
                    id: `seg_${Date.now()}_${index}`,
                    text: currentChunk.join(' '),
                    prompt: '', 
                    isProcessed: false
                });
                currentChunk = [];
            }
        });

        setSegments(newSegments);
        if (newSegments.length > 0) setSelectedSegmentId(newSegments[0].id);
        addToast(`تم تقسيم النص إلى ${newSegments.length} مشهد.`, "success");
    };

    // --- BATCH PROCESSING LOGIC ---
    const handleBatchProcess = async () => {
        if (segments.length === 0 || !profile) {
            addToast("يرجى التأكد من وجود مشاهد واختيار قناة", "error");
            return;
        }
        
        setIsProcessing(true);
        const unprocessedIndices = segments.map((s, i) => s.isProcessed ? -1 : i).filter(i => i !== -1);
        
        if (unprocessedIndices.length === 0) {
            if(confirm("جميع المشاهد معالجة. هل تريد إعادة المعالجة؟")) {
                // Reprocess all
            } else {
                setIsProcessing(false);
                return;
            }
        }

        const BATCH_SIZE = 5;
        const totalBatches = Math.ceil(segments.length / BATCH_SIZE);
        
        setProcessingProgress({ current: 0, total: segments.length });

        // Iterate in chunks
        for (let i = 0; i < segments.length; i += BATCH_SIZE) {
            const chunkEnd = Math.min(i + BATCH_SIZE, segments.length);
            const currentBatchSegments = segments.slice(i, chunkEnd);
            const batchTexts = currentBatchSegments.map(s => s.text);

            try {
                // 1. Tashkeel (Sequential for chunk to avoid overwhelming)
                let processedTexts = [...batchTexts];
                if (enableTashkeel) {
                    // We can do this in parallel for the batch
                    processedTexts = await Promise.all(
                        batchTexts.map(text => addTashkeel(text, settings.selectedTextModel, profile.geminiApiKey))
                    );
                }

                // 2. Batch Prompt Generation (One API Call for 5 segments)
                const prompts = await generateBatchScenePrompts(batchTexts, artStyle, settings.selectedTextModel, profile.geminiApiKey);

                // 3. Update State Immediately
                const updatedBatch = currentBatchSegments.map((seg, idx) => ({
                    ...seg,
                    text: enableTashkeel ? processedTexts[idx] : seg.text,
                    prompt: prompts[idx] || "Failed to generate prompt",
                    isProcessed: true
                }));

                setSegments(prev => {
                    const newArr = [...prev];
                    for(let j=0; j<updatedBatch.length; j++) {
                        newArr[i+j] = updatedBatch[j];
                    }
                    return newArr;
                });

                setProcessingProgress({ current: chunkEnd, total: segments.length });
                
                // UX Delay
                await new Promise(r => setTimeout(r, 500));

            } catch (e) {
                console.error("Batch failed", e);
                addToast(`فشل في الدفعة ${Math.floor(i/BATCH_SIZE)+1}`, "error");
            }
        }

        setIsProcessing(false);
        addToast("اكتملت المعالجة بنجاح!", "success");
    };

    const handleMagicStyle = async () => {
        if (!profile) return;
        setIsMagicStyleLoading(true);
        try {
            const style = await suggestArtStyle(rawText, settings.selectedTextModel, profile.geminiApiKey);
            setArtStyle(style);
            addToast("تم تحليل المقال واقتراح الستايل الأنسب!", "success");
        } catch (e) {
            addToast("فشل تحليل الستايل", "error");
        }
        setIsMagicStyleLoading(false);
    };

    const handleGenerateThumbnails = async () => {
        if (!profile || !rawText) return;
        setIsThumbLoading(true);
        try {
            const prompts = await generateVisualScriptThumbnails(rawText, artStyle, settings.selectedTextModel, profile.geminiApiKey);
            const newEntries = prompts.map((p, i) => ({
                id: `thumb_${Date.now()}_${i}`,
                prompt: p,
                createdAt: new Date().toLocaleString()
            }));
            setThumbnailHistory(prev => [...newEntries, ...prev]); // Add to top
            addToast("تم اقتراح 3 صور مصغرة جديدة", "success");
        } catch (e) {
            addToast("فشل توليد اقتراحات الصور المصغرة", "error");
        }
        setIsThumbLoading(false);
    };

    const handleSendThumbnailsToStudio = () => {
        // Get top 3 latest (or selected, but for now take latest generated batch)
        const latest = thumbnailHistory.slice(0, 3).map(h => h.prompt);
        if (latest.length === 0) return;
        
        setPendingBatchPrompts(latest);
        
        // Switch Tab event
        const event = new CustomEvent('SWITCH_TAB', { detail: 'image_studio' });
        window.dispatchEvent(event);
        addToast("تم إرسال البرومبتات إلى استوديو الصور!", "success");
    };

    const handleUpdateSegment = (id: string, field: 'text' | 'prompt', value: string) => {
        setSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleDownloadZip = async () => {
        if (segments.length === 0) return;
        addToast("جاري ضغط الملفات...", "info");
        const zip = new JSZip();
        const root = zip.folder("Pro Output Prompts");
        const sentencesFolder = root?.folder("Pro Output Text To Prompts");
        const promptsFolder = root?.folder("Pro Output Prompts");

        segments.forEach((seg, index) => {
            const num = index + 1;
            sentencesFolder?.file(`sentence_${num}.txt`, seg.text);
            promptsFolder?.file(`prompt_${num}.txt`, seg.prompt);
        });

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Visual_Script_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast("تم التحميل بنجاح", "success");
    };

    const handleSendToImageStudio = () => {
        if (segments.length === 0) return;
        const allPrompts = segments.map(s => s.prompt);
        setPendingBatchPrompts(allPrompts);
        
        const event = new CustomEvent('SWITCH_TAB', { detail: 'image_studio' });
        window.dispatchEvent(event);
        addToast("تم نقل جميع البرومبتات للاستوديو", "success");
    };

    const activeSegment = segments.find(s => s.id === selectedSegmentId);

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 animate-fade-in relative overflow-hidden">
            
            {/* Top Bar */}
            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 flex justify-between items-center shadow-sm z-20 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Layout size={24}/>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                            السيناريو المرئي (Visual Scripting)
                        </h2>
                        <p className="text-xs text-gray-500">تقسيم المشاهد • معالجة الدفعات • استوديو المصغرات</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSendToImageStudio} disabled={segments.length === 0} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:opacity-90 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-sm">
                        <ImageIcon size={16}/> تنفيذ المشاهد (صور)
                    </button>
                    <button onClick={handleDownloadZip} disabled={segments.length === 0} className="bg-white border border-gray-300 dark:bg-slate-800 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition disabled:opacity-50">
                        <Download size={16}/> تصدير
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                
                {/* Sidebar (Settings & Explorer) */}
                <div className="w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col z-10 shadow-lg flex-shrink-0 h-full overflow-hidden">
                    
                    {/* Collapsible Settings */}
                    <div className="border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
                        <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="w-full flex justify-between items-center p-4 text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 transition">
                            <span className="flex items-center gap-2"><Settings size={16}/> إعدادات المعالجة</span>
                            {isSettingsOpen ? <ChevronDown size={16}/> : <ChevronRight size={16} className="rtl:rotate-180"/>}
                        </button>
                        
                        {isSettingsOpen && (
                            <div className="p-4 space-y-4 bg-white dark:bg-slate-900 max-h-[400px] overflow-y-auto custom-scrollbar">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500">النص الأصلي (لتقسيم جديد)</label>
                                    <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} className="w-full h-20 p-2 text-xs border rounded resize-none outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-white dark:border-slate-700 placeholder-gray-400" placeholder="ألصق المقال هنا..."/>
                                    <button onClick={handleSplit} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700 py-1.5 rounded text-xs font-bold transition flex justify-center gap-2 border border-gray-300 dark:border-slate-600">
                                        <Split size={14}/> تقسيم (Sentence Split)
                                    </button>
                                </div>

                                <div className="border-t border-gray-100 dark:border-slate-800 pt-3">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-gray-500">الستايل الفني</label>
                                        <button onClick={handleMagicStyle} disabled={isMagicStyleLoading || !rawText} className="text-[10px] text-indigo-600 flex items-center gap-1 hover:underline disabled:opacity-50 font-bold">
                                            {isMagicStyleLoading ? <RefreshCw size={10} className="animate-spin"/> : <Wand2 size={10}/>} كشف تلقائي
                                        </button>
                                    </div>
                                    <textarea value={artStyle} onChange={(e) => setArtStyle(e.target.value)} className="w-full h-16 p-2 text-xs border rounded resize-none outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-white dark:border-slate-700" placeholder="Cinematic, 8k..." dir="ltr"/>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input type="number" min="1" max="10" value={sentencesPerSplit} onChange={(e) => setSentencesPerSplit(Number(e.target.value))} className="w-12 p-1 border rounded text-center text-xs font-bold outline-none dark:bg-slate-800 dark:text-white"/>
                                    <span className="text-xs text-gray-500">جملة لكل مشهد</span>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={enableTashkeel} onChange={(e) => setEnableTashkeel(e.target.checked)} className="w-4 h-4 accent-indigo-600 cursor-pointer"/>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">تشكيل آلي</span>
                                </label>

                                <button onClick={handleBatchProcess} disabled={segments.length === 0 || isProcessing} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition flex justify-center gap-2 disabled:opacity-50">
                                    {isProcessing ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14}/>}
                                    {isProcessing ? `معالجة الدفعات (${processingProgress.current}/${processingProgress.total})` : 'بدء المعالجة (AI Batch)'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* File Explorer */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50 dark:bg-slate-950">
                        <div className="text-xs font-bold text-gray-400 mb-2 px-2 uppercase tracking-wider flex justify-between items-center">
                            <span>المشاهد ({segments.length})</span>
                            <span className="text-[10px] bg-gray-200 dark:bg-slate-800 px-1.5 rounded">{segments.filter(s=>s.isProcessed).length} جاهز</span>
                        </div>
                        
                        <div className="space-y-1">
                            {segments.map((seg, idx) => (
                                <button 
                                    key={seg.id}
                                    onClick={() => setSelectedSegmentId(seg.id)}
                                    className={`w-full text-right flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition border ${selectedSegmentId === seg.id ? 'bg-white border-indigo-500 shadow-sm dark:bg-slate-800 dark:border-indigo-500' : 'border-transparent hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-600 dark:text-gray-400'}`}
                                >
                                    {seg.isProcessed ? <Check size={12} className="text-green-500 flex-shrink-0"/> : <div className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0"></div>}
                                    <span className="truncate flex-1 font-mono">مشهد {idx + 1}</span>
                                    <span className="text-[9px] opacity-50">{seg.prompt ? 'Prompt' : 'Raw'}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content Area (Split between Editor and Thumbnails) */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-100 dark:bg-slate-900">
                    
                    {/* Top: Active Segment Editor */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        {activeSegment ? (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                            <AlignRight size={18} className="text-indigo-500"/> نص المشهد
                                        </h3>
                                        <span className="text-xs text-gray-400 font-mono">ID: {activeSegment.id}</span>
                                    </div>
                                    <textarea 
                                        value={activeSegment.text}
                                        onChange={(e) => handleUpdateSegment(activeSegment.id, 'text', e.target.value)}
                                        className="w-full h-32 p-4 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg leading-relaxed dark:text-white transition"
                                        dir="auto"
                                    />
                                </div>

                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-700 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-pink-500"></div>
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                            <Sparkles size={18} className="text-purple-500"/> وصف الصورة (Prompt)
                                        </h3>
                                        <div className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100">English AI Generated</div>
                                    </div>
                                    <textarea 
                                        value={activeSegment.prompt}
                                        onChange={(e) => handleUpdateSegment(activeSegment.id, 'prompt', e.target.value)}
                                        className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono text-gray-700 dark:text-gray-300 transition"
                                        dir="ltr"
                                        placeholder="سيظهر البرومبت هنا بعد المعالجة..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <Split size={64} className="opacity-10 mb-4"/>
                                <p>اختر مشهداً من القائمة للبدء أو قم بتقسيم النص</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom: Thumbnail Generator (Collapsible or Fixed Height) */}
                    <div className="h-64 bg-white dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 flex flex-col flex-shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                        <div className="p-3 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                                <ImageIcon size={16} className="text-green-500"/> مولد الصور المصغرة (Thumbnail Prompts)
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={handleGenerateThumbnails} disabled={isThumbLoading || !rawText} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition flex items-center gap-1 font-bold disabled:opacity-50">
                                    {isThumbLoading ? <RefreshCw className="animate-spin" size={12}/> : <Wand2 size={12}/>} اقتراح 3 برومبتات
                                </button>
                                <button onClick={handleSendThumbnailsToStudio} disabled={thumbnailHistory.length === 0} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition flex items-center gap-1 font-bold disabled:opacity-50">
                                    <Send size={12}/> إرسال للاستوديو
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50 dark:bg-slate-900">
                            {thumbnailHistory.length === 0 ? (
                                <p className="text-center text-gray-400 text-xs mt-10">اضغط "اقتراح" لتوليد أفكار للصور المصغرة</p>
                            ) : (
                                <div className="space-y-2">
                                    {thumbnailHistory.map((thumb) => (
                                        <div key={thumb.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-slate-700 flex gap-3 text-left group hover:border-indigo-300 transition">
                                            <div className="flex-shrink-0 mt-1"><Sparkles size={14} className="text-yellow-500"/></div>
                                            <div className="flex-1">
                                                <p className="text-xs text-gray-600 dark:text-gray-300 font-mono leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all">{thumb.prompt}</p>
                                                <span className="text-[9px] text-gray-400 mt-1 block text-right">{thumb.createdAt}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default VisualScripting;
