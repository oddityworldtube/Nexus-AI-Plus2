import React from 'react';
import { RefreshCw, Send, Sparkles, Plus, CheckCircle, X, Zap, Brain, HeartPulse, AlertCircle, Languages, Activity, TrendingUp } from 'lucide-react';
import { OptimizationResult, ScoredHook } from '../../types';

interface MetadataEditorProps {
    title: string;
    description: string;
    tags: string[];
    tagInput: string;
    tagScores: Record<string, number>;
    result: OptimizationResult | null;
    loadingStates: { title: boolean, desc: boolean, tags: boolean, hooks: boolean };
    hooks: ScoredHook[];
    hookLanguage: string;
    tagsLanguage?: string;
    savingPart: 'title' | 'desc' | 'tags' | 'thumbnail' | 'all' | null;
    quotaExceeded: boolean;
    onUpdate: (field: 'title' | 'description' | 'tagInput' | 'hookLanguage' | 'tagsLanguage', value: string) => void;
    onUpdateTags: (tags: string[]) => void;
    onRegen: (type: 'title' | 'desc' | 'tags' | 'hooks') => void;
    onPublishPart: (part: { title?: boolean, desc?: boolean, tags?: boolean }) => void;
    onAddRelated: () => void;
    onScoreCurrent?: () => void;
}

// دالة مساعدة لتحديد ستايل الكلمة بناءً على قوتها
const getTagStyles = (score: number) => {
    if (score >= 90) return {
        container: 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.15)]',
        badge: 'bg-emerald-600 text-white shadow-sm'
    }; // Elite / ممتاز
    
    if (score >= 80) return {
        container: 'bg-green-50 text-green-700 border-green-200 shadow-sm',
        badge: 'bg-green-200 text-green-800'
    }; // Good / جيد جداً
    
    if (score >= 70) return {
        container: 'bg-amber-50 text-amber-800 border-amber-200',
        badge: 'bg-amber-200 text-amber-800'
    }; // Average / متوسط
    
    return {
        container: 'bg-red-50 text-red-700 border-red-100 opacity-90',
        badge: 'bg-red-200 text-red-800'
    }; // Weak / ضعيف
};

const MetadataEditor: React.FC<MetadataEditorProps> = (props) => {
    const { 
        title, description, tags, tagInput, tagScores, result, loadingStates,
        savingPart, quotaExceeded, tagsLanguage = 'Arabic',
        onUpdate, onUpdateTags, onRegen, onPublishPart, onAddRelated, onScoreCurrent
    } = props;

    const isDisabled = (part: string) => savingPart !== null || quotaExceeded;

    return (
        <div className="space-y-6">
            {/* Title Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative group hover:shadow-md transition">
                <div className="flex justify-between mb-3 items-center">
                    <label className="block font-bold text-gray-800 text-lg">العنوان النهائي</label>
                    <div className="flex gap-2">
                        <button onClick={() => onRegen('title')} disabled={loadingStates.title} className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition" title="إعادة توليد">
                            <RefreshCw size={16} className={loadingStates.title ? 'animate-spin' : ''} />
                        </button>
                        <button 
                            onClick={() => onPublishPart({title: true})} 
                            disabled={isDisabled('title')}
                            className={`text-xs px-4 py-2 rounded-lg flex items-center gap-1 font-bold transition ${isDisabled('title') ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                        >
                            {savingPart === 'title' ? <RefreshCw className="animate-spin" size={14}/> : <Send size={14}/>} تحديث
                        </button>
                    </div>
                </div>
                <input value={title} onChange={e => onUpdate('title', e.target.value)} className="w-full p-4 text-lg font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                
                {result?.optimizedTitleSuggestions && (
                    <div className="mt-5 space-y-3">
                        <p className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                            <Sparkles size={12}/> اقتراحات الذكاء الاصطناعي (مع التحليل النفسي):
                        </p>
                        <div className="grid gap-3">
                            {result.optimizedTitleSuggestions.map((item, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => onUpdate('title', item.title)} 
                                    className="group block w-full text-right bg-indigo-50/30 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded-xl p-3 transition-all relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start gap-3 relative z-10">
                                        <span className="font-bold text-gray-800 text-sm leading-relaxed">{item.title}</span>
                                        <span className={`font-black px-2 py-1 rounded-md text-xs shadow-sm whitespace-nowrap ${item.score >= 90 ? 'bg-green-100 text-green-700' : 'bg-white text-indigo-600'}`}>
                                            {item.score}
                                        </span>
                                    </div>

                                    {/* Psychology Analysis Badges */}
                                    {item.psychology && (
                                        <div className="mt-3 pt-2 border-t border-indigo-100 grid grid-cols-2 md:grid-cols-3 gap-2 relative z-10">
                                            <div className="flex items-center gap-1.5 text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                                                <Brain size={12} />
                                                <span>فضول: {item.psychology.curiosityScore}%</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded font-medium">
                                                <Zap size={12} />
                                                <span>عجلة: {item.psychology.urgencyScore}%</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium md:col-auto col-span-2">
                                                <HeartPulse size={12} />
                                                <span>الشعور: {item.psychology.emotionType}</span>
                                            </div>
                                            {item.psychology.analysis && (
                                                <div className="col-span-2 md:col-span-3 text-[10px] text-gray-500 mt-1 flex items-start gap-1">
                                                    <AlertCircle size={10} className="mt-0.5 flex-shrink-0"/>
                                                    <span className="line-clamp-1 group-hover:line-clamp-none transition-all">{item.psychology.analysis}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Description Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative group hover:shadow-md transition">
                <div className="flex justify-between mb-3 items-center">
                    <label className="block font-bold text-gray-800 text-lg">الوصف</label>
                    <div className="flex gap-2 items-center">
                        <button onClick={() => onRegen('desc')} disabled={loadingStates.desc} className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition" title="إعادة صياغة">
                            <RefreshCw size={16} className={loadingStates.desc ? 'animate-spin' : ''} />
                        </button>
                        {result?.relatedVideos && (
                            <button onClick={onAddRelated} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-100 flex items-center gap-1 font-bold transition">
                                <Plus size={14}/> إضافة روابط
                            </button>
                        )}
                        <button 
                            onClick={() => onPublishPart({desc: true})} 
                            disabled={isDisabled('desc')}
                            className={`text-xs px-4 py-2 rounded-lg flex items-center gap-1 font-bold transition ${isDisabled('desc') ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                        >
                            {savingPart === 'desc' ? <RefreshCw className="animate-spin" size={14}/> : <Send size={14}/>} تحديث
                        </button>
                    </div>
                </div>
                <textarea value={description} onChange={e => onUpdate('description', e.target.value)} rows={8} className="w-full p-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition leading-relaxed"></textarea>

                {result?.optimizedDescription && (
                    <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="text-xs font-bold text-gray-500 mb-2">نسخة محسنة مقترحة:</p>
                        <div className="text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap">{result.optimizedDescription}</div>
                        <button onClick={() => onUpdate('description', result.optimizedDescription)} className="mt-2 text-xs text-indigo-600 font-bold hover:underline">استخدام هذا الوصف</button>
                    </div>
                )}
            </div>

            {/* Tags Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 relative group hover:shadow-md transition">
                <div className="flex justify-between mb-3 items-center">
                    <label className="block font-bold text-gray-800 text-lg">الكلمات الدلالية ({tags.length})</label>
                    <div className="flex gap-2 items-center">
                        {onScoreCurrent && (
                            <button 
                                onClick={onScoreCurrent} 
                                disabled={loadingStates.tags} 
                                className="text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-lg hover:bg-amber-100 font-bold transition flex items-center gap-1"
                                title="تقييم الكلمات الحالية فقط بدون اقتراح جديد"
                            >
                                <Activity size={14} /> تحليل الحالية
                            </button>
                        )}
                        <button 
                            onClick={() => onPublishPart({tags: true})} 
                            disabled={isDisabled('tags')}
                            className={`text-xs px-4 py-2 rounded-lg flex items-center gap-1 font-bold transition ${isDisabled('tags') ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                        >
                            {savingPart === 'tags' ? <RefreshCw className="animate-spin" size={14}/> : <Send size={14}/>} تحديث
                        </button>
                    </div>
                </div>
                
                {/* --- Current Tags with Advanced Coloring --- */}
                <div className="flex flex-wrap gap-2 mb-4 bg-gray-50 p-4 rounded-xl min-h-[60px] border border-gray-100">
                    {tags.map((t, i) => {
                        const score = tagScores[t.trim().toLowerCase()] || 0;
                        const styles = score > 0 ? getTagStyles(score) : { 
                            container: 'bg-white text-gray-600 border-gray-200 hover:border-gray-300', 
                            badge: 'bg-gray-100 text-gray-500' 
                        };

                        return (
                            <div key={i} className={`group flex items-center gap-2 border pl-1.5 pr-3 py-1.5 rounded-lg text-sm transition-all duration-300 hover:scale-105 ${styles.container}`}>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded min-w-[24px] text-center ${styles.badge}`}>
                                    {score > 0 ? score : '?'}
                                </span>
                                <span className="font-bold tracking-tight">{t}</span>
                                <button onClick={() => onUpdateTags(tags.filter(tag => tag !== t))} className="opacity-40 hover:opacity-100 hover:text-red-600 p-0.5 transition ml-1">
                                    <X size={14} />
                                </button>
                            </div>
                        )
                    })}
                    {tags.length === 0 && <p className="text-gray-400 text-sm italic w-full text-center py-2">لا توجد كلمات دلالية مضافة.</p>}
                </div>
                
                <div className="relative">
                    <input 
                        value={tagInput}
                        onChange={e => onUpdate('tagInput', e.target.value)}
                        onKeyDown={e => {if(e.key === 'Enter' && tagInput.trim()){ onUpdateTags([...tags, tagInput.trim()]); onUpdate('tagInput', '') }}}
                        placeholder="أضف كلمة دلالية ثم اضغط Enter..."
                        className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
                    />
                    <Plus className="absolute right-3 top-3.5 text-gray-400" size={20} />
                </div>

                {/* Suggestions Language Control */}
                <div className="mt-6 mb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                        <TrendingUp size={14}/> كلمات مقترحة جديدة (مبنية على التحليل):
                    </p>
                    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                        <Languages size={14} className="text-gray-400"/>
                        <span className="text-[10px] font-bold text-gray-500">اللغة:</span>
                        <select 
                            value={tagsLanguage} 
                            onChange={(e) => onUpdate('tagsLanguage', e.target.value)} 
                            className="bg-white text-xs border border-gray-300 rounded px-2 py-1 outline-none focus:border-indigo-500 text-gray-700 font-bold"
                        >
                            <option value="Arabic">العربية</option>
                            <option value="English">English</option>
                            <option value="French">Français</option>
                            <option value="German">Deutsch</option>
                            <option value="Spanish">Español</option>
                        </select>
                        <button 
                            onClick={() => onRegen('tags')} 
                            disabled={loadingStates.tags} 
                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded font-bold hover:bg-indigo-100 flex items-center gap-1 transition"
                            title="توليد اقتراحات جديدة + إعادة تقييم الحالية"
                        >
                            <RefreshCw size={12} className={loadingStates.tags ? 'animate-spin' : ''}/> توليد
                        </button>
                    </div>
                </div>

                {/* --- Suggested Tags with Advanced Coloring --- */}
                {result?.suggestedTags && result.suggestedTags.length > 0 && (
                    <div className="pt-4 border-t border-dashed border-gray-200 flex flex-wrap gap-2">
                        {result.suggestedTags
                            .filter(st => !tags.includes(st.tag))
                            .slice(0, 20)
                            .map((st, i) => {
                                const styles = getTagStyles(st.score);
                                return (
                                    <button 
                                        key={i} 
                                        onClick={() => onUpdateTags([...tags, st.tag])} 
                                        className={`group flex items-center gap-2 border px-3 py-1.5 rounded-lg text-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${styles.container}`}
                                        title={`إضافة: ${st.tag}`}
                                    >
                                        <Plus size={12} className="opacity-50 group-hover:opacity-100"/> 
                                        <span className="font-bold">{st.tag}</span> 
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${styles.badge}`}>
                                            {st.score}
                                        </span>
                                    </button>
                                );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MetadataEditor;
