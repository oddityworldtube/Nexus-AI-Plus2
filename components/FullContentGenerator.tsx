
import React, { useState, useEffect } from 'react';
import { ChannelProfile, ContentSession, ScriptEvaluation } from '../types';
import { generateFullScript, generateMetadataFromContent, generateShortsScriptFromLong, evaluateScriptQuality, rewriteScriptSection, generateTikTokDescription, generateShortMetadata, generateTitlesOnly, generateDescriptionOnly, generateTagsOnly } from '../services/geminiService';
import { useToast } from '../contexts/ToastContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAppContext } from '../contexts/AppContext';
import { FileText, History, Split, ArrowUpRight } from 'lucide-react';
import JSZip from 'jszip';

// Import sub-components
import ContentHistorySidebar from './content-generator/ContentHistorySidebar';
import ContentInputForm from './content-generator/ContentInputForm';
import ContentResults from './content-generator/ContentResults';

interface FullContentGeneratorProps {
    profile: ChannelProfile;
}

const FullContentGenerator: React.FC<FullContentGeneratorProps> = ({ profile }) => {
    const { addToast } = useToast();
    const { pendingContentIdea, setPendingContentIdea, setPendingScriptForSplitter, settings } = useAppContext();

    // --- State: Inputs ---
    const [title, setTitle] = useState('');
    const [wordCount, setWordCount] = useLocalStorage('fc_word_count', 1500);
    const [language, setLanguage] = useLocalStorage('fc_language', 'Arabic');
    const [audience, setAudience] = useLocalStorage('fc_audience', 'المبتدئين');
    const [cta, setCta] = useLocalStorage('fc_cta', 'الاشتراك في القناة');
    
    const [format, setFormat] = useLocalStorage('fc_format', 'YouTube Video Script');
    const [persona, setPersona] = useLocalStorage('fc_persona', 'The Expert');
    const [tone, setTone] = useLocalStorage('fc_tone', 'Professional');
    const [style, setStyle] = useLocalStorage('fc_style', 'Step-by-Step Guide');

    // --- Auto Settings ---
    const [autoGenShorts, setAutoGenShorts] = useLocalStorage('fc_auto_shorts', true);
    const [autoDownload, setAutoDownload] = useLocalStorage('fc_auto_dl', false);

    // --- State: Outputs ---
    const [generatedScript, setGeneratedScript] = useState('');
    const [generatedMeta, setGeneratedMeta] = useState<{title: string, description: string, tags: string[]} | null>(null);
    const [shortsScript, setShortsScript] = useState('');
    
    // NEW Outputs
    const [tiktokDescription, setTiktokDescription] = useState('');
    const [shortMetadata, setShortMetadata] = useState<{shortTitle: string, shortDescription: string, shortKeywords: string[]} | null>(null);

    // --- State: UI Control ---
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'IDLE' | 'SCRIPT' | 'META' | 'SHORTS' | 'TIKTOK' | 'SHORT_META' | 'DONE'>('IDLE');
    
    // Evaluation State
    const [evaluation, setEvaluation] = useState<ScriptEvaluation | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);

    // History
    const [history, setHistory] = useLocalStorage<ContentSession[]>('fc_history_v2', []);
    const [showHistory, setShowHistory] = useState(false);

    // --- EFFECT: Check for Pending Idea from IdeaGenerator ---
    useEffect(() => {
        if (pendingContentIdea) {
            setTitle(pendingContentIdea);
            addToast("تم نقل فكرة الفيديو بنجاح! 🚀", "success");
            setPendingContentIdea(null); // Clear it
        }
    }, [pendingContentIdea]);

    // --- Actions ---

    const handleSaveSettings = () => {
        addToast("تم حفظ الإعدادات الافتراضية بنجاح", "success");
    };

    // --- NEW: Send to External Visual Scripting Tab ---
    const handleSendToSplitter = () => {
        if (!generatedScript) {
            addToast("يجب توليد محتوى أولاً", "warning");
            return;
        }
        
        // 1. Set Pending Data in Context
        setPendingScriptForSplitter(generatedScript);
        
        // 2. Dispatch Event to Switch Tab
        const event = new CustomEvent('SWITCH_TAB', { detail: 'visual_scripting' });
        window.dispatchEvent(event);
        
        addToast("تم نقل النص إلى السيناريو المرئي (Visual Scripting)", "success");
    };

    // --- NEW: Batch Download Function with Folders (JSZip) ---
    // Added optional data override to handle auto-download where state might be stale in same tick
    const handleDownloadAll = async (overrideData?: any) => {
        // Use override data if provided, otherwise fall back to state
        const currentScript = overrideData?.script || generatedScript;
        const currentMeta = overrideData?.meta || generatedMeta;
        const currentTiktok = overrideData?.tiktok || tiktokDescription;
        const currentShortsScript = overrideData?.shortsScript || shortsScript;
        const currentShortsMeta = overrideData?.shortMeta || shortMetadata;
        const currentTitle = title;

        if (!currentScript && !currentMeta) {
            addToast("لا يوجد محتوى لتحميله حالياً", "warning");
            return;
        }

        addToast("جاري ضغط الملفات...", "info");

        const zip = new JSZip();
        
        // 1. Create Root Folder
        const root = zip.folder("Pro Output Text");
        if (!root) return;

        // 2. Add Main Video Files
        if (currentTitle) root.file("video_title.txt", currentTitle);
        if (currentScript) root.file("cleaned_text.txt", currentScript);
        if (currentMeta?.description) root.file("video_description.txt", currentMeta.description);
        if (currentMeta?.tags) root.file("seo_keywords.txt", currentMeta.tags.join(", "));
        if (currentTiktok) root.file("Tiktok description.txt", currentTiktok);

        // 3. Create Short_1 Folder
        if (currentShortsScript || currentShortsMeta) {
            const shortFolder = root.folder("Short_1");
            if (shortFolder) {
                if (currentShortsMeta?.shortTitle) shortFolder.file("short_title.txt", currentShortsMeta.shortTitle);
                if (currentShortsScript) shortFolder.file("short_script.txt", currentShortsScript);
                if (currentShortsMeta?.shortDescription) shortFolder.file("short_description.txt", currentShortsMeta.shortDescription);
                if (currentShortsMeta?.shortKeywords) shortFolder.file("short_keywords.txt", currentShortsMeta.shortKeywords.join(", "));
            }
        }

        // 4. Generate and Download ZIP
        try {
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Pro_Output_Text_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            addToast("تم تحميل الملف المضغوط بنجاح 📦", "success");
        } catch (e) {
            console.error(e);
            addToast("فشل إنشاء الملف المضغوط", "error");
        }
    };

    const handleGenerate = async () => {
        if (!title.trim()) return addToast("يرجى إدخال عنوان أو فكرة المحتوى", "error");
        
        setIsLoading(true);
        setStep('SCRIPT');
        // Clear previous results
        setGeneratedScript(''); setGeneratedMeta(null); setShortsScript(''); setTiktokDescription(''); setShortMetadata(null); setEvaluation(null);

        try {
            // 1. Generate Script
            addToast("جاري صياغة المحتوى الاحترافي...", "info", undefined, 5000);
            const script = await generateFullScript(
                title, wordCount, language, tone, audience, 
                format, persona, style, cta,
                settings.selectedTextModel,
                profile.geminiApiKey
            );
            setGeneratedScript(script);
            addToast("تم كتابة المحتوى بنجاح!", "success");

            // 2. Generate Metadata
            setStep('META');
            addToast("جاري استخراج الميتاداتا...", "info");
            
            await new Promise(r => setTimeout(r, 800)); // UX Pause
            const meta = await generateMetadataFromContent(script, language, settings.selectedTextModel, profile.geminiApiKey);
            setGeneratedMeta(meta);

            // 3. Generate TikTok Description
            setStep('TIKTOK');
            addToast("جاري كتابة وصف تيك توك...", "info");
            const tiktok = await generateTikTokDescription(title, language, settings.selectedTextModel, profile.geminiApiKey);
            setTiktokDescription(tiktok);
            
            // Prepare data object for history and potential download
            const sessionData = { script, metadata: meta, tiktokDescription: tiktok, shortsScript: '', shortMetadata: undefined };

            // 4. AUTO GENERATE SHORTS (If Enabled)
            if (autoGenShorts) {
                setStep('SHORTS');
                addToast("⚡ التحويل التلقائي للشورتس قيد التشغيل...", "info");
                
                // Use the 'script' variable directly, not state
                const short = await generateShortsScriptFromLong(script, language, settings.selectedTextModel, profile.geminiApiKey);
                setShortsScript(short);
                
                setStep('SHORT_META');
                const shortMeta = await generateShortMetadata(short, language, settings.selectedTextModel, profile.geminiApiKey);
                setShortMetadata(shortMeta);
                
                // Update session data
                sessionData.shortsScript = short;
                // @ts-ignore
                sessionData.shortMetadata = shortMeta;
                
                addToast("تم إنتاج الشورت تلقائياً!", "success");
            }
            
            // Save to History
            updateHistory(sessionData);

            setStep('DONE');
            addToast("اكتملت العملية الرئيسية! 🚀", "success");

            // 5. AUTO DOWNLOAD (If Enabled)
            if (autoDownload) {
                addToast("⏳ جاري تحضير التنزيل التلقائي...", "info");
                // Pass the data directly because state might not have updated in this render cycle
                await handleDownloadAll({
                    script: script,
                    meta: meta,
                    tiktok: tiktok,
                    shortsScript: sessionData.shortsScript,
                    shortMeta: sessionData.shortMetadata
                });
            }

        } catch (e: any) {
            console.error(e);
            addToast("خطأ: " + e.message, "error");
            setStep('IDLE');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateShorts = async () => {
        if (!generatedScript) return;
        setIsLoading(true);
        setStep('SHORTS');
        try {
            // 1. Generate Shorts Script
            addToast("جاري تحويل المحتوى إلى فيديو قصير (Shorts)...", "info");
            const short = await generateShortsScriptFromLong(generatedScript, language, settings.selectedTextModel, profile.geminiApiKey);
            setShortsScript(short);
            
            // 2. Generate Shorts Metadata
            setStep('SHORT_META');
            addToast("جاري توليد بيانات الشورت...", "info");
            const shortMeta = await generateShortMetadata(short, language, settings.selectedTextModel, profile.geminiApiKey);
            setShortMetadata(shortMeta);

            addToast("تم تجهيز حزمة الشورت!", "success");
            
            // Update History
            updateHistory({ shortsScript: short, shortMetadata: shortMeta });

        } catch (e) {
            addToast("فشل تحويل الشورتس", "error");
        } finally {
            setIsLoading(false);
            setStep('DONE');
        }
    };

    // New: Handle Individual Regeneration
    const handleRegenerateSection = async (section: 'title' | 'description' | 'tags' | 'tiktok' | 'short_script' | 'short_meta') => {
        if (!title) return;
        setIsLoading(true);
        addToast("جاري إعادة التوليد...", "info");
        try {
            if (section === 'title') {
                const res = await generateTitlesOnly(title, profile.geminiApiKey);
                if (res.length > 0 && generatedMeta) setGeneratedMeta({ ...generatedMeta, title: res[0].title });
            } else if (section === 'description') {
                const res = await generateDescriptionOnly(title, generatedMeta?.description || '', profile.geminiApiKey);
                if (generatedMeta) setGeneratedMeta({ ...generatedMeta, description: res });
            } else if (section === 'tags') {
                const res = await generateTagsOnly(title, generatedMeta?.tags || [], profile.geminiApiKey, language);
                if (generatedMeta) setGeneratedMeta({ ...generatedMeta, tags: res.suggestedTags.map(t => t.tag) });
            } else if (section === 'tiktok') {
                const res = await generateTikTokDescription(title, language, settings.selectedTextModel, profile.geminiApiKey);
                setTiktokDescription(res);
            } else if (section === 'short_script') {
                const res = await generateShortsScriptFromLong(generatedScript, language, settings.selectedTextModel, profile.geminiApiKey);
                setShortsScript(res);
            } else if (section === 'short_meta') {
                const res = await generateShortMetadata(shortsScript, language, settings.selectedTextModel, profile.geminiApiKey);
                setShortMetadata(res);
            }
            addToast("تم التحديث!", "success");
        } catch (e) {
            addToast("فشل التحديث", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const updateHistory = (newData: Partial<ContentSession['outputs']>) => {
        setHistory(prev => {
            const copy = [...prev];
            // If the latest session matches current title, update it. Else add new.
            // Simplified: Always update/add to top if current context
            if (copy.length > 0 && copy[0].title === title) {
                copy[0].outputs = { ...copy[0].outputs, ...newData };
                return copy;
            }
            // If not found, creating new is tricky here without full context, 
            // but usually we call updateHistory after initial creation.
            return prev;
        });
    };

    const handleLoadSession = (session: ContentSession) => {
        setTitle(session.title);
        // Inputs
        setFormat(session.inputs.format);
        setWordCount(session.inputs.wordCount);
        setLanguage(session.inputs.language);
        setTone(session.inputs.tone);
        setPersona(session.inputs.persona);
        setStyle(session.inputs.style);
        setAudience(session.inputs.audience);
        setCta(session.inputs.cta);
        // Outputs
        setGeneratedScript(session.outputs.script);
        setGeneratedMeta(session.outputs.metadata || null);
        setShortsScript(session.outputs.shortsScript || '');
        setTiktokDescription(session.outputs.tiktokDescription || '');
        setShortMetadata(session.outputs.shortMetadata || null);
        setEvaluation(null); 
        
        setShowHistory(false);
        addToast("تم استعادة الجلسة السابقة", "info");
    };

    const handleDeleteHistory = () => {
        if(confirm("مسح السجل بالكامل؟")) {
            setHistory([]);
            addToast("تم مسح السجل", "success");
        }
    };

    const handleEvaluateScript = async () => {
        if (!generatedScript) return;
        setIsEvaluating(true);
        addToast("جاري تحليل جودة السكربت... 📊", "info");
        try {
            const result = await evaluateScriptQuality(generatedScript, profile.geminiApiKey);
            setEvaluation(result);
            addToast(`تم التقييم: ${result.score}/100`, "success");
        } catch (e) {
            addToast("فشل التقييم", "error");
        }
        setIsEvaluating(false);
    };

    const handleRewriteSelection = async (selection: string, instruction: string): Promise<string> => {
        if (!generatedScript) return selection;
        addToast("جاري إعادة الصياغة الذكية... ✨", "info");
        try {
            const newText = await rewriteScriptSection(selection, instruction, generatedScript, profile.geminiApiKey);
            addToast("تم التحديث!", "success");
            return newText;
        } catch (e) {
            addToast("فشل إعادة الصياغة", "error");
            throw e;
        }
    };

    const handleCopy = (text: string, label: string) => { navigator.clipboard.writeText(text); addToast(`تم نسخ ${label}`, "success"); };
    const handleDownload = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)] pb-4 animate-fade-in relative">
            
            <ContentHistorySidebar 
                history={history}
                showHistory={showHistory}
                setShowHistory={setShowHistory}
                onLoadSession={handleLoadSession}
                onDeleteHistory={handleDeleteHistory}
            />

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 px-4 md:px-0">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 md:p-8 rounded-2xl shadow-lg text-white mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><FileText size={24} className="text-white" /></div>
                                <h2 className="text-2xl md:text-3xl font-black">استوديو المحتوى المتكامل</h2>
                            </div>
                            <p className="text-indigo-100 text-sm md:text-lg opacity-90 max-w-2xl">
                                قم بصناعة مقالات، سكربتات، ومحتوى احترافي بالكامل مع التحكم في الشخصية والنبرة.
                            </p>
                        </div>
                        <button onClick={() => setShowHistory(!showHistory)} className="lg:hidden text-white bg-white/20 p-2 rounded-lg"><History size={20}/></button>
                    </div>
                    {/* Send to External Splitter Button (Fixed Header Action) */}
                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={handleSendToSplitter}
                            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition"
                            title="إرسال النص إلى تبويبة السيناريو المرئي لتقسيمه إلى مشاهد"
                        >
                            <Split size={16}/> إرسال للسيناريو المرئي (Splitter Tab) <ArrowUpRight size={14}/>
                        </button>
                    </div>
                </div>

                <ContentInputForm 
                    title={title} setTitle={setTitle}
                    format={format} setFormat={setFormat}
                    persona={persona} setPersona={setPersona}
                    tone={tone} setTone={setTone}
                    style={style} setStyle={setStyle}
                    wordCount={wordCount} setWordCount={setWordCount}
                    language={language} setLanguage={setLanguage}
                    audience={audience} setAudience={setAudience}
                    cta={cta} setCta={setCta}
                    // Auto Settings
                    autoGenShorts={autoGenShorts} setAutoGenShorts={setAutoGenShorts}
                    autoDownload={autoDownload} setAutoDownload={setAutoDownload}
                    isLoading={isLoading}
                    step={step}
                    onGenerate={handleGenerate}
                    onSaveSettings={handleSaveSettings}
                    onDownloadAll={() => handleDownloadAll()}
                    hasContent={!!generatedScript}
                />

                <ContentResults 
                    generatedScript={generatedScript}
                    setGeneratedScript={setGeneratedScript}
                    format={format}
                    generatedMeta={generatedMeta}
                    shortsScript={shortsScript}
                    tiktokDescription={tiktokDescription}
                    shortMetadata={shortMetadata}
                    isLoading={isLoading}
                    handleGenerateShorts={handleGenerateShorts}
                    handleCopy={handleCopy}
                    handleDownload={handleDownload}
                    onEvaluate={handleEvaluateScript}
                    evaluation={evaluation}
                    isEvaluating={isEvaluating}
                    onRewriteSelection={handleRewriteSelection}
                    onRegenerateSection={handleRegenerateSection}
                />

            </div>
        </div>
    );
};

export default FullContentGenerator;
