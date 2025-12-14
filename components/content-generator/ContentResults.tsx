
import React, { useState, useRef, useEffect } from 'react';
import { FileText, Copy, Download, ChevronUp, ChevronDown, Smartphone, CheckCircle, Type, AlignLeft, Hash, Edit3, Save, AlertTriangle, RefreshCw, Wand2, Star, Check, X, Eraser, Video, MessageCircle } from 'lucide-react';
import { ScriptEvaluation } from '../../types';
import RichTextEditor from '../ui/RichTextEditor'; // Import the new component

interface ContentResultsProps {
    generatedScript: string;
    setGeneratedScript: (val: string) => void;
    format: string;
    generatedMeta: {title: string, description: string, tags: string[]} | null;
    shortsScript: string;
    tiktokDescription: string;
    shortMetadata: { shortTitle: string, shortDescription: string, shortKeywords: string[] } | null;
    isLoading: boolean;
    handleGenerateShorts: () => void;
    handleCopy: (text: string, label: string) => void;
    handleDownload: (content: string, filename: string) => void;
    onEvaluate: () => void;
    evaluation: ScriptEvaluation | null;
    isEvaluating: boolean;
    onRewriteSelection: (selection: string, instruction: string) => Promise<string>;
    onRegenerateSection: (section: 'title' | 'description' | 'tags' | 'tiktok' | 'short_script' | 'short_meta') => void;
}

const ContentResults: React.FC<ContentResultsProps> = ({ 
    generatedScript, setGeneratedScript, format, generatedMeta, shortsScript, 
    tiktokDescription, shortMetadata,
    isLoading, handleGenerateShorts, handleCopy, handleDownload,
    onEvaluate, evaluation, isEvaluating, onRewriteSelection, onRegenerateSection
}) => {
    const [isScriptExpanded, setIsScriptExpanded] = useState(true);
    const [isShortsExpanded, setIsShortsExpanded] = useState(true);
    const [isMetaExpanded, setIsMetaExpanded] = useState(true);
    const [isTikTokExpanded, setIsTikTokExpanded] = useState(true);
    
    // Artifact Cleaning State
    const [artifacts, setArtifacts] = useState<string[]>([]);
    const [showCleaner, setShowCleaner] = useState(false);

    // Note: RichTextEditor handles internal ref, we sync via onChange

    // Artifact Detection Logic (Simplified for HTML content)
    useEffect(() => {
        if (!generatedScript) {
            setArtifacts([]);
            return;
        }
        const found = new Set<string>();
        // Check for common artifacts in raw text (strip HTML for checking)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = generatedScript;
        const textContent = tempDiv.innerText;

        const patterns = ['**', '##', '__', '---', '===']; 
        patterns.forEach(p => {
            if (textContent.includes(p)) found.add(p);
        });
        
        const labeledSections = ['Intro:', 'Outro:', 'Hook:', 'Conclusion:', 'Scene:', 'Visual:', 'Audio:', 'المقدمة:', 'الخاتمة:'];
        labeledSections.forEach(label => {
             if (new RegExp(label, 'i').test(textContent)) found.add(label);
        });

        if (/\[(Visual|Sound|SFX|Music|Scene).*?\]/i.test(textContent)) {
             found.add('[Visual/SFX Tags]');
        }

        setArtifacts(Array.from(found));
    }, [generatedScript]);

    const handleRemoveArtifact = (artifact: string) => {
        let newScript = generatedScript;
        if (artifact === '[Visual/SFX Tags]') {
            newScript = newScript.replace(/\[(Visual|Sound|SFX|Music|Scene).*?\]/gi, ' ');
        } else {
            // Simple string replace for now, in HTML context this might need regex for safety
            // but for simple artifacts it's usually fine
            newScript = newScript.split(artifact).join(' '); 
        }
        setGeneratedScript(newScript);
    };

    // Helper to extract text for copy/download
    const getPlainText = (html: string) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.innerText;
    };

    const RegenButton = ({ onClick }: { onClick: () => void }) => (
        <button 
            onClick={onClick} 
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded transition disabled:opacity-50"
            title="إعادة التوليد"
        >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>
    );

    return (
        <>
            {/* 1. Main Content Script */}
            {generatedScript && (
                <div className="bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6 transition-all relative">
                    <div className="bg-indigo-50 dark:bg-slate-800 p-4 flex justify-between items-center border-b border-indigo-100 dark:border-slate-700">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsScriptExpanded(!isScriptExpanded)}>
                            <div className="bg-indigo-100 dark:bg-slate-700 p-2 rounded-lg text-indigo-600 dark:text-indigo-400"><FileText size={20}/></div>
                            <div>
                                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    السكربت الأساسي
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 rounded-full border border-indigo-200">Rich Text</span>
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{generatedScript.length} حرف (HTML)</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={onEvaluate} 
                                disabled={isEvaluating}
                                className="hidden md:flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-bold hover:bg-purple-200 transition"
                            >
                                {isEvaluating ? <RefreshCw className="animate-spin" size={14}/> : <Star size={14}/>} تقييم الجودة
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleCopy(getPlainText(generatedScript), 'المحتوى'); }} className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-gray-500 hover:text-indigo-600"><Copy size={18}/></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDownload(getPlainText(generatedScript), 'content.txt'); }} className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-gray-500 hover:text-indigo-600"><Download size={18}/></button>
                            {isScriptExpanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                        </div>
                    </div>

                    {isScriptExpanded && (
                        <div className="relative">
                            {evaluation && (
                                <div className="bg-purple-50 dark:bg-slate-800/50 border-b border-purple-100 dark:border-slate-700 p-4 flex flex-col md:flex-row items-center gap-4 animate-fade-in">
                                    <div className={`relative w-16 h-16 flex items-center justify-center rounded-full border-4 text-xl font-black ${evaluation.score >= 80 ? 'border-green-500 text-green-700' : evaluation.score >= 50 ? 'border-yellow-500 text-yellow-700' : 'border-red-500 text-red-700'}`}>{evaluation.score}</div>
                                    <div className="flex-1 text-sm">
                                        <div className="flex gap-4 mb-1"><span className="font-bold text-gray-700 dark:text-gray-300">قوة الخطاف: {evaluation.hookScore}%</span><span className="font-bold text-gray-700 dark:text-gray-300">الإيقاع: {evaluation.pacing}</span></div>
                                        <p className="text-red-600 text-xs mb-1">🔴 {evaluation.critique[0]}</p>
                                        <p className="text-green-600 text-xs">🟢 {evaluation.improvements[0]}</p>
                                    </div>
                                </div>
                            )}

                            {artifacts.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 p-2">
                                    {!showCleaner ? (
                                        <div className="flex justify-center items-center gap-2 text-red-600 dark:text-red-300 text-xs font-bold cursor-pointer hover:underline" onClick={() => setShowCleaner(true)}>
                                            <AlertTriangle size={14}/> <span>تنبيه: يوجد {artifacts.length} نوع من الرموز الزائدة. اضغط للتنظيف.</span>
                                        </div>
                                    ) : (
                                        <div className="animate-fade-in">
                                            <div className="flex justify-between items-center mb-2 px-2"><h4 className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-1"><Eraser size={12}/> اختر الرمز لمسحه:</h4><button onClick={() => setShowCleaner(false)} className="text-red-400 hover:text-red-600"><X size={14}/></button></div>
                                            <div className="flex flex-wrap gap-2 justify-center">{artifacts.map((art, idx) => (<button key={idx} onClick={() => handleRemoveArtifact(art)} className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-mono font-bold hover:bg-red-50 dark:hover:bg-red-900/30 hover:scale-105 transition shadow-sm">[ {art} ]</button>))}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* RICH TEXT EDITOR with AI Rewrite Capability */}
                            <div className="p-0 bg-white dark:bg-slate-950 relative group">
                                <RichTextEditor 
                                    value={generatedScript}
                                    onChange={setGeneratedScript}
                                    className="border-none rounded-none min-h-[500px]"
                                    placeholder="اكتب المحتوى هنا... (حدد نصاً للتحسين بالذكاء الاصطناعي)"
                                    onRewrite={onRewriteSelection}
                                />
                            </div>
                            
                            <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-2">
                                <button onClick={handleGenerateShorts} disabled={isLoading} className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2 rounded-full font-bold shadow hover:shadow-lg transition flex items-center gap-2 text-xs"><Smartphone size={16}/> تحويل إلى Shorts</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 2. Metadata Block */}
            {generatedMeta && (
                <div className="bg-white dark:bg-slate-900 border border-green-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6 transition-all">
                    <div className="bg-green-50 dark:bg-slate-800 p-4 flex justify-between items-center cursor-pointer border-b border-green-100 dark:border-slate-700" onClick={() => setIsMetaExpanded(!isMetaExpanded)}>
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 dark:bg-slate-700 p-2 rounded-lg text-green-600 dark:text-green-400"><CheckCircle size={20}/></div>
                            <div><h3 className="font-bold text-gray-800 dark:text-white">بيانات النشر (Metadata)</h3><p className="text-xs text-gray-500 dark:text-gray-400">SEO Optimized</p></div>
                        </div>
                        <div className="flex items-center gap-2">{isMetaExpanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}</div>
                    </div>
                    {isMetaExpanded && (
                        <div className="p-6 space-y-6 bg-white dark:bg-slate-950">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Type size={16}/> العنوان المقترح</label>
                                    <div className="flex gap-2">
                                        <RegenButton onClick={() => onRegenerateSection('title')} />
                                        <button onClick={() => handleCopy(generatedMeta.title, "العنوان")} className="text-xs text-indigo-600 hover:underline">نسخ</button>
                                    </div>
                                </div>
                                <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-200 dark:border-slate-800 font-bold text-lg text-gray-800 dark:text-white">{generatedMeta.title}</div>
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><AlignLeft size={16}/> الوصف</label>
                                    <div className="flex gap-2">
                                        <RegenButton onClick={() => onRegenerateSection('description')} />
                                        <button onClick={() => handleCopy(generatedMeta.description, "الوصف")} className="text-xs text-indigo-600 hover:underline">نسخ</button>
                                    </div>
                                </div>
                                <textarea value={generatedMeta.description} readOnly className="w-full h-40 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl outline-none resize-none text-sm text-gray-700 dark:text-gray-300"/>
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Hash size={16}/> الكلمات الدلالية</label>
                                    <div className="flex gap-2">
                                        <RegenButton onClick={() => onRegenerateSection('tags')} />
                                        <button onClick={() => handleCopy(generatedMeta.tags.join(','), "الكلمات")} className="text-xs text-indigo-600 hover:underline">نسخ CSV</button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800">{generatedMeta.tags.map((tag, i) => (<span key={i} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-1 rounded-lg text-sm text-gray-600 dark:text-gray-300 shadow-sm">{tag}</span>))}</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 3. TikTok Description Block */}
            {tiktokDescription && (
                <div className="bg-white dark:bg-slate-900 border border-black/10 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6 transition-all">
                    <div className="bg-gray-50 dark:bg-slate-800 p-4 flex justify-between items-center cursor-pointer border-b border-gray-200 dark:border-slate-700" onClick={() => setIsTikTokExpanded(!isTikTokExpanded)}>
                        <div className="flex items-center gap-3">
                            <div className="bg-black text-white p-2 rounded-lg"><MessageCircle size={20}/></div>
                            <div><h3 className="font-bold text-gray-800 dark:text-white">وصف تيك توك (TikTok)</h3><p className="text-xs text-gray-500 dark:text-gray-400">قصير مع هاشتاجات</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <RegenButton onClick={() => onRegenerateSection('tiktok')} />
                            <button onClick={(e) => { e.stopPropagation(); handleCopy(tiktokDescription, 'وصف تيك توك'); }} className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-gray-500 hover:text-black dark:hover:text-white"><Copy size={18}/></button>
                            {isTikTokExpanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                        </div>
                    </div>
                    {isTikTokExpanded && (
                        <div className="p-6 bg-white dark:bg-slate-950">
                            <textarea value={tiktokDescription} readOnly className="w-full h-24 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl outline-none resize-none text-sm text-gray-700 dark:text-gray-300"/>
                        </div>
                    )}
                </div>
            )}

            {/* 4. Shorts Script & Metadata Block */}
            {(shortsScript || shortMetadata) && (
               <div className="bg-white dark:bg-slate-900 border border-pink-100 dark:border-pink-900/30 rounded-2xl shadow-sm overflow-hidden mb-6 transition-all ring-1 ring-pink-500/20">
                   <div className="bg-pink-50 dark:bg-slate-800 p-4 flex justify-between items-center cursor-pointer border-b border-pink-100 dark:border-pink-900/30" onClick={() => setIsShortsExpanded(!isShortsExpanded)}>
                        <div className="flex items-center gap-3">
                            <div className="bg-pink-100 dark:bg-slate-700 p-2 rounded-lg text-pink-600 dark:text-pink-400"><Smartphone size={20}/></div>
                            <div><h3 className="font-bold text-gray-800 dark:text-white">حزمة الشورتس (Shorts Bundle)</h3><p className="text-xs text-gray-500 dark:text-gray-400">سكربت + بيانات وصفية</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isShortsExpanded ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                        </div>
                    </div>
                    {isShortsExpanded && (
                        <div className="p-6 bg-white dark:bg-slate-950 space-y-6">
                            {/* Script */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Video size={16}/> سكربت الفيديو القصير</label>
                                    <div className="flex gap-2">
                                        <RegenButton onClick={() => onRegenerateSection('short_script')} />
                                        <button onClick={() => handleCopy(shortsScript, "سكربت الشورتس")} className="text-xs text-pink-600 hover:underline">نسخ</button>
                                    </div>
                                </div>
                                <textarea value={shortsScript} readOnly className="w-full h-40 p-4 bg-pink-50/30 dark:bg-slate-900 border border-pink-100 dark:border-slate-800 rounded-xl outline-none resize-y text-gray-800 dark:text-gray-200 font-medium"/>
                            </div>

                            {/* Short Metadata */}
                            {shortMetadata && (
                                <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
                                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                                        <h4 className="text-xs font-bold text-gray-500 uppercase">بيانات الشورت (Meta)</h4>
                                        <RegenButton onClick={() => onRegenerateSection('short_meta')} />
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-xs font-bold">العنوان:</span><button onClick={() => handleCopy(shortMetadata.shortTitle, "عنوان الشورت")} className="text-[10px] text-indigo-500">نسخ</button></div>
                                            <div className="text-sm font-bold bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-700">{shortMetadata.shortTitle}</div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-xs font-bold">الوصف:</span><button onClick={() => handleCopy(shortMetadata.shortDescription, "وصف الشورت")} className="text-[10px] text-indigo-500">نسخ</button></div>
                                            <div className="text-xs bg-white dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-700 whitespace-pre-wrap">{shortMetadata.shortDescription}</div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1"><span className="text-xs font-bold">الكلمات:</span><button onClick={() => handleCopy(shortMetadata.shortKeywords.join(','), "كلمات الشورت")} className="text-[10px] text-indigo-500">نسخ</button></div>
                                            <div className="flex flex-wrap gap-1">{shortMetadata.shortKeywords.map((k, i) => <span key={i} className="text-[10px] bg-white border px-1.5 py-0.5 rounded">{k}</span>)}</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
               </div>
            )}
        </>
    );
};

export default ContentResults;
