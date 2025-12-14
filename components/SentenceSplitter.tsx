
import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { addTashkeel, generateScenePrompt, suggestArtStyle } from '../../services/geminiService';
import { useAppContext } from '../../contexts/AppContext';
import { 
    Split, Wand2, Download, Image as ImageIcon, 
    Type, Settings, RefreshCw, FileText, Folder, 
    ChevronRight, ChevronDown, Check, X, Play,
    AlignRight, Sparkles
} from 'lucide-react';
import JSZip from 'jszip';

interface SentenceSplitterProps {
    initialText: string;
    profile: any;
    onBack: () => void;
}

interface Segment {
    id: string;
    text: string;
    prompt: string;
    isProcessed: boolean;
}

const SentenceSplitter: React.FC<SentenceSplitterProps> = ({ initialText, profile, onBack }) => {
    const { addToast } = useToast();
    const { setPendingImageForEditor, settings } = useAppContext();

    // --- State ---
    const [rawText, setRawText] = useState(initialText);
    const [segments, setSegments] = useState<Segment[]>([]);
    
    // Settings
    const [sentencesPerSplit, setSentencesPerSplit] = useState(2);
    const [enableTashkeel, setEnableTashkeel] = useState(false);
    const [artStyle, setArtStyle] = useState('Cinematic, Realistic, 8k');
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);

    // Selection
    const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
    
    // Loading States
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMagicStyleLoading, setIsMagicStyleLoading] = useState(false);
    const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

    // --- Splitting Logic ---
    const handleSplit = () => {
        if (!rawText.trim()) return;
        
        // Split by period, exclamation, question mark, but keep delimiters
        // Using a positive lookbehind to keep the delimiter with the sentence
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
                    prompt: '', // Empty initially
                    isProcessed: false
                });
                currentChunk = [];
            }
        });

        setSegments(newSegments);
        if (newSegments.length > 0) setSelectedSegmentId(newSegments[0].id);
        addToast(`تم تقسيم النص إلى ${newSegments.length} مشهد.`, "success");
    };

    // --- AI Processing ---
    const processSegments = async () => {
        if (segments.length === 0) return;
        
        setIsProcessing(true);
        setProcessingProgress({ current: 0, total: segments.length });

        // Clone segments to update
        let updatedSegments = [...segments];

        for (let i = 0; i < updatedSegments.length; i++) {
            const segment = updatedSegments[i];
            
            try {
                // 1. Add Tashkeel (if enabled)
                let finalText = segment.text;
                if (enableTashkeel) {
                    finalText = await addTashkeel(segment.text, settings.selectedTextModel, profile.geminiApiKey);
                }

                // 2. Generate Prompt
                const prompt = await generateScenePrompt(segment.text, artStyle, settings.selectedTextModel, profile.geminiApiKey);

                // Update Segment
                updatedSegments[i] = {
                    ...segment,
                    text: finalText,
                    prompt: prompt,
                    isProcessed: true
                };

                // Update State Incrementally (for visual feedback)
                setSegments([...updatedSegments]);
                setProcessingProgress({ current: i + 1, total: updatedSegments.length });

                // Small delay to avoid rate limits
                await new Promise(r => setTimeout(r, 500));

            } catch (e) {
                console.error("Error processing segment", i, e);
                // Continue to next
            }
        }

        setIsProcessing(false);
        addToast("تمت المعالجة بنجاح!", "success");
    };

    const handleMagicStyle = async () => {
        setIsMagicStyleLoading(true);
        try {
            const style = await suggestArtStyle(rawText, settings.selectedTextModel, profile.geminiApiKey);
            setArtStyle(style);
            addToast("تم اقتراح الستايل المناسب!", "success");
        } catch (e) {
            addToast("فشل تحليل الستايل", "error");
        }
        setIsMagicStyleLoading(false);
    };

    // --- Actions ---
    const handleUpdateSegment = (id: string, field: 'text' | 'prompt', value: string) => {
        setSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleRegeneratePrompt = async (id: string) => {
        const seg = segments.find(s => s.id === id);
        if (!seg) return;
        
        addToast("جاري إعادة توليد البرومبت...", "info");
        try {
            const newPrompt = await generateScenePrompt(seg.text, artStyle, settings.selectedTextModel, profile.geminiApiKey);
            handleUpdateSegment(id, 'prompt', newPrompt);
            addToast("تم التحديث", "success");
        } catch (e) {
            addToast("فشل التحديث", "error");
        }
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
        link.download = `Pro_Output_Prompts_${Date.now()}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast("تم التحميل بنجاح", "success");
    };

    const handleSendToImageStudio = () => {
        if (segments.length === 0) return;
        
        // Prepare prompt list string
        const promptsList = segments.map(s => s.prompt).join('\n\n');
        
        // Create a temporary text file object for batch upload simulation
        const file = new File([promptsList], "batch_prompts.txt", { type: "text/plain" });
        
        // NOTE: In a real app, we might want to pass this directly via context or event.
        // For now, let's copy to clipboard and notify user, OR check if we can push to context.
        
        // Better Approach: Copy to clipboard for now as ImageStudio supports batch via file.
        // Or better yet, we can create a "Batch" intent.
        
        // Let's create a text blob URL and prompt user to download/use it, or just copy to clipboard.
        navigator.clipboard.writeText(promptsList);
        addToast("تم نسخ جميع البرومبتات! اذهب لـ 'استوديو الصور' -> 'دفعات' وألصق النص أو ارفع ملف.", "success");
        
        // Also trigger tab switch
        const event = new CustomEvent('SWITCH_TAB', { detail: 'image_studio' });
        window.dispatchEvent(event);
    };

    const activeSegment = segments.find(s => s.id === selectedSegmentId);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-fade-in relative">
            
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 flex justify-between items-center shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition text-gray-500">
                        <ChevronRight size={20} className="rtl:rotate-180"/>
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <Split size={20} className="text-indigo-500"/> تقسيم المشاهد الذكي
                        </h2>
                        <p className="text-xs text-gray-500">تحويل المقال إلى مشاهد، تشكيل، وتوليد صور</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleSendToImageStudio}
                        disabled={segments.length === 0}
                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition disabled:opacity-50"
                    >
                        <ImageIcon size={16}/> إلى استوديو الصور
                    </button>
                    <button 
                        onClick={handleDownloadZip}
                        disabled={segments.length === 0}
                        className="bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 shadow-sm"
                    >
                        <Download size={16}/> تحميل الملفات
                    </button>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex flex-1 overflow-hidden">
                
                {/* Left Sidebar: Controls & File Explorer */}
                <div className="w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col z-10 shadow-lg">
                    
                    {/* Settings Panel */}
                    <div className="border-b border-gray-200 dark:border-slate-800">
                        <button 
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
                            className="w-full flex justify-between items-center p-4 text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 transition"
                        >
                            <span className="flex items-center gap-2"><Settings size={16}/> الإعدادات</span>
                            {isSettingsOpen ? <ChevronDown size={16}/> : <ChevronRight size={16} className="rtl:rotate-180"/>}
                        </button>
                        
                        {isSettingsOpen && (
                            <div className="p-4 space-y-4 bg-white dark:bg-slate-900 animate-in slide-in-from-top-2">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">عدد الجمل في المشهد</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            min="1" max="10" 
                                            value={sentencesPerSplit} 
                                            onChange={(e) => setSentencesPerSplit(Number(e.target.value))}
                                            className="w-16 p-1.5 border rounded text-center text-sm font-bold outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-white dark:border-slate-700"
                                        />
                                        <span className="text-xs text-gray-400">جملة/مشهد</span>
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-slate-800 p-2 rounded-lg border border-gray-100 dark:border-slate-700 hover:border-indigo-200 transition">
                                    <input 
                                        type="checkbox" 
                                        checked={enableTashkeel} 
                                        onChange={(e) => setEnableTashkeel(e.target.checked)}
                                        className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">تشكيل النص (للنطق السليم)</span>
                                </label>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-gray-500">ستايل الصور (Art Style)</label>
                                        <button 
                                            onClick={handleMagicStyle} 
                                            disabled={isMagicStyleLoading || !rawText}
                                            className="text-[10px] text-indigo-600 flex items-center gap-1 hover:underline disabled:opacity-50"
                                        >
                                            {isMagicStyleLoading ? <RefreshCw size={10} className="animate-spin"/> : <Wand2 size={10}/>} اقتراح ذكي
                                        </button>
                                    </div>
                                    <textarea 
                                        value={artStyle} 
                                        onChange={(e) => setArtStyle(e.target.value)}
                                        className="w-full h-16 p-2 text-xs border rounded resize-none outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-white dark:border-slate-700"
                                        placeholder="Cinematic, 8k..."
                                        dir="ltr"
                                    />
                                </div>

                                <button 
                                    onClick={handleSplit}
                                    className="w-full bg-gray-800 hover:bg-gray-900 text-white py-2 rounded-lg text-xs font-bold transition flex justify-center gap-2"
                                >
                                    <Split size={14}/> تقسيم النص أولاً
                                </button>

                                <button 
                                    onClick={processSegments}
                                    disabled={segments.length === 0 || isProcessing}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition flex justify-center gap-2 disabled:opacity-50"
                                >
                                    {isProcessing ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14}/>}
                                    {isProcessing ? `جاري المعالجة (${processingProgress.current}/${processingProgress.total})` : 'بدء المعالجة (AI)'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* File Explorer */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 bg-gray-50 dark:bg-slate-950">
                        <div className="text-xs font-bold text-gray-400 mb-2 px-2 uppercase tracking-wider">المستكشف</div>
                        
                        {segments.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 text-xs">
                                لا توجد ملفات.<br/>ابدأ بتقسيم النص.
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {/* Folder 1 */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 p-1.5 text-gray-600 dark:text-gray-300 font-bold text-xs select-none">
                                        <Folder size={14} className="fill-yellow-100 text-yellow-500"/> Pro Output Text To Prompts
                                    </div>
                                    <div className="pr-4 border-r border-gray-200 dark:border-slate-700 mr-1.5 space-y-0.5">
                                        {segments.map((seg, idx) => (
                                            <button 
                                                key={`txt_${seg.id}`}
                                                onClick={() => setSelectedSegmentId(seg.id)}
                                                className={`w-full text-right flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition ${selectedSegmentId === seg.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-bold' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'}`}
                                            >
                                                <FileText size={12}/> sentence_{idx+1}.txt
                                                {seg.isProcessed && <Check size={10} className="text-green-500 mr-auto"/>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Folder 2 */}
                                <div className="space-y-1 mt-2">
                                    <div className="flex items-center gap-2 p-1.5 text-gray-600 dark:text-gray-300 font-bold text-xs select-none">
                                        <Folder size={14} className="fill-blue-100 text-blue-500"/> Pro Output Prompts
                                    </div>
                                    <div className="pr-4 border-r border-gray-200 dark:border-slate-700 mr-1.5 space-y-0.5">
                                        {segments.map((seg, idx) => (
                                            <button 
                                                key={`prm_${seg.id}`}
                                                onClick={() => setSelectedSegmentId(seg.id)}
                                                className={`w-full text-right flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition ${selectedSegmentId === seg.id ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-bold' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800'}`}
                                            >
                                                <ImageIcon size={12}/> prompt_{idx+1}.txt
                                                {seg.prompt ? <Check size={10} className="text-green-500 mr-auto"/> : null}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Area: Editor */}
                <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
                    {activeSegment ? (
                        <div className="flex flex-col h-full">
                            {/* Editor Header */}
                            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900">
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                                        تحرير المشهد رقم {segments.findIndex(s => s.id === selectedSegmentId) + 1}
                                    </h3>
                                    <span className="text-[10px] text-gray-400 font-mono">{activeSegment.id}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleRegeneratePrompt(activeSegment.id)}
                                        className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded hover:bg-indigo-100 transition flex items-center gap-1 font-bold"
                                    >
                                        <RefreshCw size={12}/> إعادة توليد البرومبت
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto space-y-6">
                                {/* Text Box */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <AlignRight size={16} className="text-yellow-500"/> نص المشهد (Sentence)
                                    </label>
                                    <textarea 
                                        value={activeSegment.text}
                                        onChange={(e) => handleUpdateSegment(activeSegment.id, 'text', e.target.value)}
                                        className="w-full h-32 p-4 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg leading-relaxed bg-gray-50 dark:bg-slate-800 dark:text-white"
                                        dir="auto"
                                    />
                                    {enableTashkeel && (
                                        <p className="text-[10px] text-green-600 flex items-center gap-1"><Check size={10}/> التشكيل مفعل</p>
                                    )}
                                </div>

                                {/* Prompt Box */}
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                        <Sparkles size={16} className="text-purple-500"/> وصف الصورة (Prompt)
                                    </label>
                                    <div className="relative">
                                        <textarea 
                                            value={activeSegment.prompt}
                                            onChange={(e) => handleUpdateSegment(activeSegment.id, 'prompt', e.target.value)}
                                            className="w-full h-32 p-4 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono bg-slate-50 dark:bg-slate-950 dark:text-gray-300"
                                            dir="ltr"
                                            placeholder="سيظهر البرومبت هنا بعد المعالجة..."
                                        />
                                        <div className="absolute top-2 right-2 px-2 py-1 bg-gray-200 dark:bg-slate-800 text-[10px] rounded text-gray-500 font-mono">
                                            English
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Split size={64} className="opacity-10 mb-4"/>
                            <p>اختر مشهداً من القائمة للبدء</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SentenceSplitter;
