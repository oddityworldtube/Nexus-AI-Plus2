
import React, { useState, useEffect } from 'react';
import { PenTool, Save, Layers, User, Activity, Wand2, AlignLeft, Globe, Users, MessageSquare, RefreshCw, Sparkles, Download, Zap, FileDown, Brain, Scroll, Tv, Lightbulb, Check, RotateCcw, Plus, Trash2, Edit3, Settings, Star } from 'lucide-react';
import { FORMATS, PERSONAS, TONES, STYLES, PREDEFINED_AUDIENCES } from '../../data/contentOptions';
import { useToast } from '../../contexts/ToastContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useAppContext } from '../../contexts/AppContext'; // Import AppContext
import { generateAdvancedIdeas } from '../../services/geminiService'; // Import Generator Service

interface ContentInputFormProps {
    title: string; setTitle: (v: string) => void;
    format: string; setFormat: (v: string) => void;
    persona: string; setPersona: (v: string) => void;
    tone: string; setTone: (v: string) => void;
    style: string; setStyle: (v: string) => void;
    wordCount: number; setWordCount: (v: number) => void;
    language: string; setLanguage: (v: string) => void;
    audience: string; setAudience: (v: string) => void;
    cta: string; setCta: (v: string) => void;
    
    // New Props for Auto Features
    autoGenShorts: boolean; setAutoGenShorts: (v: boolean) => void;
    autoDownload: boolean; setAutoDownload: (v: boolean) => void;

    isLoading: boolean;
    step: string;
    onGenerate: () => void;
    onSaveSettings: () => void;
    onDownloadAll: () => void;
    hasContent: boolean;
}

// --- Smart Profiles Default Configuration ---
const DEFAULT_PROFILES = [
    {
        id: 'psychology',
        label: 'علم النفس',
        iconName: 'Brain',
        color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
        settings: {
            format: 'YouTube Video Script',
            persona: 'The Analyst',
            tone: 'Empathetic',
            style: 'Case Study',
            audience: 'المهتمين بالصحة النفسية وتطوير الذات',
            cta: 'شاركنا تجربتك في التعليقات، هل مررت بهذا الموقف من قبل؟',
            wordCount: 1800
        }
    },
    {
        id: 'history',
        label: 'تاريخ وحضارات',
        iconName: 'Scroll',
        color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
        settings: {
            format: 'YouTube Video Script',
            persona: 'The Storyteller',
            tone: 'Professional',
            style: 'Storytelling',
            audience: 'عشاق التاريخ والغموض والأساطير',
            cta: 'إذا كنت تحب قصص التاريخ المنسية، اشترك الآن لتصلك الحلقة القادمة.',
            wordCount: 2500
        }
    },
    {
        id: 'documentary',
        label: 'وثائقي',
        iconName: 'Tv',
        color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
        settings: {
            format: 'YouTube Video Script',
            persona: 'The Expert',
            tone: 'Educational',
            style: 'Deep Dive',
            audience: 'الباحثين عن المعرفة والثقافة العامة',
            cta: 'للمصادر والمراجع الكاملة، راجع وصف الفيديو بالأسفل.',
            wordCount: 2200
        }
    },
    {
        id: 'tech',
        label: 'تقنية وشروحات',
        iconName: 'Lightbulb',
        color: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
        settings: {
            format: 'YouTube Video Script',
            persona: 'The Teacher',
            tone: 'Conversational',
            style: 'Step-by-Step Guide',
            audience: 'المبتدئين وعشاق التقنية',
            cta: 'حمل الأداة المجانية من الرابط في أول تعليق.',
            wordCount: 1500
        }
    }
];

// --- Expanded Rich CTAs ---
const EXTENDED_CTAS = [
    "الاشتراك في القناة (Subscribe) وتفعيل الجرس",
    "شاركنا رأيك في التعليقات: هل تتفق أم تختلف؟",
    "شاركنا تجربتك الشخصية حول هذا الموضوع في الأسفل 👇",
    "إذا استفدت من الفيديو، لا تنسَ زر اللايك 👍",
    "اضغط على الرابط في الوصف لتحميل الملفات المرفقة 📥",
    "تابعنا على انستجرام لمشاهدة كواليس الحلقة 📸",
    "اشترك الآن لتصلك سلسلة الحلقات القادمة عن [الموضوع]",
    "للمصادر والمراجع، راجع وصف الفيديو 📚",
    "انضم لقناتنا على تليجرام للنقاشات الحصرية 💬",
    "شارك الفيديو مع صديق مهتم بهذا المجال ↗️",
    "اكتب 'تم' في التعليقات إذا وصلت لهذه الدقيقة 🔥",
    "شاهد الفيديو المقترح التالي عن [موضوع مشابه] 📺",
    "ادعم القناة عبر ميزة الانتساب (Join) للحصول على مزايا حصرية 💎",
    "احجز استشارتك المجانية عبر الرابط في الوصف 📅"
];

const ContentInputForm: React.FC<ContentInputFormProps> = ({
    title, setTitle, format, setFormat, persona, setPersona, tone, setTone, style, setStyle,
    wordCount, setWordCount, language, setLanguage, audience, setAudience, cta, setCta,
    autoGenShorts, setAutoGenShorts, autoDownload, setAutoDownload,
    isLoading, step, onGenerate, onSaveSettings, onDownloadAll, hasContent
}) => {
    const { addToast } = useToast();
    const { profiles, currentProfileId } = useAppContext(); // Get context
    
    // Profiles State
    const [profilesConfig, setProfilesConfig] = useLocalStorage('content_gen_profiles_v4', DEFAULT_PROFILES);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
    const [defaultProfileId, setDefaultProfileId] = useLocalStorage('content_gen_default_profile', 'history'); 
    
    // UI State for Editing Profiles
    const [isManageMode, setIsManageMode] = useState(false);
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');
    
    // Magic Title State
    const [magicLoading, setMagicLoading] = useState(false);

    // Load Default Profile on Mount
    useEffect(() => {
        if (defaultProfileId && !activeProfileId && profilesConfig.length > 0) {
            const def = profilesConfig.find(p => p.id === defaultProfileId);
            if (def) {
                applySettings(def);
                setActiveProfileId(def.id);
            }
        }
    }, [profilesConfig]); // Added profilesConfig dependency

    // Helper to get Icon Component
    const getIcon = (name: string) => {
        switch(name) {
            case 'Brain': return Brain;
            case 'Scroll': return Scroll;
            case 'Tv': return Tv;
            case 'Lightbulb': return Lightbulb;
            default: return PenTool;
        }
    };

    const applySettings = (profile: typeof DEFAULT_PROFILES[0]) => {
        setFormat(profile.settings.format);
        setPersona(profile.settings.persona);
        setTone(profile.settings.tone);
        const styleExists = STYLES.some(s => s.value === profile.settings.style);
        setStyle(styleExists ? profile.settings.style : 'Storytelling'); 
        setAudience(profile.settings.audience);
        setCta(profile.settings.cta);
        setWordCount(profile.settings.wordCount);
    };

    const handleApplyProfile = (profile: typeof DEFAULT_PROFILES[0]) => {
        setActiveProfileId(profile.id);
        applySettings(profile);
        addToast(`تم تفعيل بروفيل: ${profile.label}`, "info");
    };

    // --- Profile Management Functions ---

    const handleCreateProfile = () => {
        const name = prompt("أدخل اسم البروفيل الجديد:");
        if (!name) return;

        const newProfile = {
            id: `custom_${Date.now()}`,
            label: name,
            iconName: 'PenTool', // Default icon
            color: 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200', // Distinct color for custom
            settings: {
                format, persona, tone, style, audience, cta, wordCount
            }
        };

        // Use functional update to ensure state is fresh
        setProfilesConfig((prev) => [...prev, newProfile]);
        
        // Select the new profile
        setActiveProfileId(newProfile.id);
        addToast("تم إنشاء البروفيل الجديد", "success");
    };

    const handleUpdateActiveProfile = () => {
        if (!activeProfileId) return;
        
        const updatedProfiles = profilesConfig.map(p => {
            if (p.id === activeProfileId) {
                return {
                    ...p,
                    settings: { format, persona, tone, style, audience, cta, wordCount }
                };
            }
            return p;
        });

        setProfilesConfig(updatedProfiles);
        addToast(`تم تحديث إعدادات بروفيل "${profilesConfig.find(p=>p.id===activeProfileId)?.label}"`, "success");
    };

    const handleDeleteProfile = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("هل أنت متأكد من حذف هذا البروفيل؟")) {
            const newProfiles = profilesConfig.filter(p => p.id !== id);
            setProfilesConfig(newProfiles);
            if (activeProfileId === id) setActiveProfileId(null);
            if (defaultProfileId === id) setDefaultProfileId(null);
            addToast("تم حذف البروفيل", "info");
        }
    };

    const handleRenameProfile = (id: string) => {
        if (!tempName.trim()) return;
        const updatedProfiles = profilesConfig.map(p => p.id === id ? { ...p, label: tempName } : p);
        setProfilesConfig(updatedProfiles);
        setEditingNameId(null);
    };

    const handleResetProfiles = () => {
        if(confirm("هل أنت متأكد من استعادة إعدادات البروفيلات الأصلية؟ سيتم حذف أي بروفيلات مخصصة أو تعديلات.")) {
            // Force a Deep Copy to ensure React sees it as a new value and breaks references
            const cleanDefaults = JSON.parse(JSON.stringify(DEFAULT_PROFILES));
            setProfilesConfig(cleanDefaults);
            setActiveProfileId(null);
            // Reset default to history as requested
            setDefaultProfileId('history');
            addToast("تمت استعادة ضبط المصنع للبروفيلات", "success");
        }
    };

    // --- Magic Title Generator ---
    const handleMagicTitle = async () => {
        const profile = profiles.find(p => p.id === currentProfileId);
        setMagicLoading(true);
        try {
            // Generate a high-potential viral topic
            // We use 'generateAdvancedIdeas' requesting just 1 idea with strong prompt engineering
            const ideas = await generateAdvancedIdeas(
                "مواضيع رائجة عالمياً وعامة", // Niche context (General fallback if not specified)
                1, // Count
                "viral, high retention, curiosity gap, storytelling, trending", // Positive Prompt
                "clickbait, boring, repetitive", // Negative Prompt
                "models/gemini-flash-lite-latest",
                "Storytelling",
                profile?.geminiApiKey
            );

            if (ideas.length > 0) {
                setTitle(ideas[0].title);
                addToast("تم اقتراح عنوان سحري! ✨", "success");
            } else {
                addToast("لم يتمكن من توليد فكرة، حاول مرة أخرى", "warning");
            }
        } catch (e) {
            console.error(e);
            addToast("فشل توليد العنوان السحري", "error");
        }
        setMagicLoading(false);
    };

    const activeProfile = profilesConfig.find(p => p.id === activeProfileId);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 relative overflow-visible mb-6 transition-all">
            {isLoading && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-loading-bar"></div>}
            
            {/* Header Actions */}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-2 border-b border-gray-100 dark:border-slate-800 pb-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><PenTool className="text-indigo-500"/> استوديو المحتوى</h3>
                <div className="flex gap-2">
                    <button 
                        onClick={onDownloadAll} 
                        disabled={!hasContent}
                        className="text-xs bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 px-3 py-2 rounded-lg flex items-center gap-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="تحميل المخرجات"
                    >
                        <Download size={14}/> ملفات
                    </button>
                    <button onClick={onSaveSettings} className="text-xs bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg flex items-center gap-1 transition">
                        <Save size={14}/> حفظ عام
                    </button>
                </div>
            </div>

            {/* --- PROFILES MANAGEMENT SECTION --- */}
            <div className="mb-8 p-5 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-200 dark:border-slate-800 relative">
                
                {/* Profiles Header */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <Layers size={16} className="text-indigo-500"/> 
                            إعدادات القناة (Smart Profiles)
                        </label>
                        {defaultProfileId && (
                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full border border-yellow-200 font-bold flex items-center gap-1">
                                <Star size={10} fill="currentColor"/> الافتراضي: {profilesConfig.find(p => p.id === defaultProfileId)?.label}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsManageMode(!isManageMode)} 
                            className={`text-[10px] px-2 py-1 rounded border transition ${isManageMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-300'}`}
                        >
                            {isManageMode ? 'إنهاء التعديل' : 'تعديل / حذف'}
                        </button>
                        <button onClick={handleResetProfiles} className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-1 px-2 hover:bg-gray-100 rounded transition" title="استعادة البروفيلات الأصلية">
                            <RotateCcw size={10}/> استعادة
                        </button>
                    </div>
                </div>

                {/* Profiles Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    {profilesConfig.map((p) => {
                        const Icon = getIcon(p.iconName);
                        const isActive = activeProfileId === p.id;
                        const isDefault = defaultProfileId === p.id;
                        
                        return (
                            <div key={p.id} className="relative group">
                                <button
                                    onClick={() => handleApplyProfile(p)}
                                    disabled={isLoading}
                                    className={`w-full relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all hover:shadow-md hover:scale-[1.02] 
                                        ${isActive ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900 ' + p.color : 'border-transparent bg-white dark:bg-slate-800 dark:border-slate-700 text-gray-600 dark:text-gray-300'}
                                    `}
                                >
                                    {isDefault && <div className="absolute top-1 left-1 text-yellow-500"><Star size={12} fill="currentColor"/></div>}
                                    {isActive && <div className="absolute top-1 right-1 text-indigo-600"><Check size={14}/></div>}
                                    
                                    <Icon size={24} className={`mb-2 ${isActive ? 'opacity-100' : 'opacity-60 grayscale group-hover:grayscale-0'}`} />
                                    
                                    {editingNameId === p.id ? (
                                        <input 
                                            value={tempName} 
                                            onChange={(e) => setTempName(e.target.value)}
                                            onBlur={() => handleRenameProfile(p.id)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRenameProfile(p.id)}
                                            autoFocus
                                            className="w-full text-xs text-center border rounded px-1"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="text-xs font-bold text-center truncate w-full">{p.label}</span>
                                    )}
                                </button>

                                {/* Management Actions Overlay */}
                                {isManageMode && (
                                    <div className="absolute -top-2 -right-2 flex gap-1 z-10">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setEditingNameId(p.id); setTempName(p.label); }}
                                            className="bg-blue-500 text-white p-1 rounded-full shadow hover:bg-blue-600"
                                        >
                                            <Edit3 size={10}/>
                                        </button>
                                        <button 
                                            onClick={(e) => handleDeleteProfile(e, p.id)}
                                            className="bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600"
                                        >
                                            <Trash2 size={10}/>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    
                    {/* Add New Profile Button */}
                    <button 
                        onClick={handleCreateProfile}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-700 text-gray-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                    >
                        <Plus size={24} className="mb-2"/>
                        <span className="text-xs font-bold">جديد</span>
                    </button>
                </div>

                {/* Active Profile Context Actions */}
                {activeProfileId && (
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-indigo-100 dark:border-slate-700 animate-fade-in">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-500">إجراءات "{activeProfile?.label}":</span>
                            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition select-none">
                                <input 
                                    type="checkbox" 
                                    checked={defaultProfileId === activeProfileId} 
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setDefaultProfileId(activeProfileId);
                                            addToast("تم تعيينه كبروفيل افتراضي", "success");
                                        } else {
                                            setDefaultProfileId(null);
                                        }
                                    }}
                                    className="accent-indigo-600 w-3 h-3"
                                />
                                جعله الافتراضي
                            </label>
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setActiveProfileId(null)} 
                                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-transparent hover:bg-gray-100 transition"
                            >
                                إلغاء التحديد
                            </button>
                            <button 
                                onClick={handleUpdateActiveProfile} 
                                className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 transition shadow-sm font-bold"
                            >
                                <Save size={12}/> حفظ التعديلات في البروفيل
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Topic */}
                <div className="col-span-1 md:col-span-2 lg:col-span-4">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">عنوان أو فكرة المحتوى (Topic)</label>
                        <button 
                            onClick={handleMagicTitle}
                            disabled={magicLoading || isLoading}
                            className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1 rounded-full flex items-center gap-1 hover:shadow-md transition disabled:opacity-50 font-bold"
                            title="توليد عنوان عشوائي بناءً على أفكار ناجحة (Viral Idea)"
                        >
                            {magicLoading ? <RefreshCw className="animate-spin" size={12}/> : <Sparkles size={12}/>}
                            عنوان سحري (Magic Idea)
                        </button>
                    </div>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isLoading} placeholder="مثال: أسرار لغة الجسد، تاريخ الأندلس، شرح React Hooks..." className="w-full p-4 text-lg bg-gray-50 dark:bg-slate-950 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-bold"/>
                </div>

                {/* Dropdowns */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Layers size={14}/> نوع المحتوى (Format)</label>
                    <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={isLoading} className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg focus:border-indigo-500 outline-none text-sm">
                        {FORMATS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><User size={14}/> الشخصية (Persona)</label>
                    <select value={persona} onChange={(e) => setPersona(e.target.value)} disabled={isLoading} className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg focus:border-indigo-500 outline-none text-sm">
                        {PERSONAS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Activity size={14}/> النبرة (Tone)</label>
                    <select value={tone} onChange={(e) => setTone(e.target.value)} disabled={isLoading} className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg focus:border-indigo-500 outline-none text-sm">
                        {TONES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Wand2 size={14}/> الأسلوب (Style)</label>
                    <select value={style} onChange={(e) => setStyle(e.target.value)} disabled={isLoading} className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg focus:border-indigo-500 outline-none text-sm">
                        {STYLES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>

                {/* Input Row 2 */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><AlignLeft size={14}/> عدد الكلمات</label>
                    <input type="number" value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))} disabled={isLoading} className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg focus:border-indigo-500 outline-none text-sm"/>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Globe size={14}/> اللغة</label>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} disabled={isLoading} className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg focus:border-indigo-500 outline-none text-sm">
                        <option value="Arabic">العربية</option>
                        <option value="English">English</option>
                        <option value="French">Français</option>
                        <option value="Spanish">Español</option>
                        <option value="German">Deutsch</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><Users size={14}/> الجمهور المستهدف</label>
                    <input list="audience-options" value={audience} onChange={(e) => setAudience(e.target.value)} disabled={isLoading} placeholder="مثال: المبتدئين" className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg focus:border-indigo-500 outline-none text-sm"/>
                    <datalist id="audience-options">
                        {PREDEFINED_AUDIENCES.map(a => <option key={a} value={a}/>)}
                    </datalist>
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><MessageSquare size={14}/> إجراء (CTA)</label>
                    <input list="cta-options" value={cta} onChange={(e) => setCta(e.target.value)} disabled={isLoading} placeholder="مثال: الاشتراك" className="w-full p-2.5 bg-white dark:bg-slate-800 border rounded-lg focus:border-indigo-500 outline-none text-sm"/>
                    <datalist id="cta-options">
                        {EXTENDED_CTAS.map(c => <option key={c} value={c}/>)}
                    </datalist>
                </div>
            </div>

            {/* Automation Toggles */}
            <div className="mt-6 p-4 bg-indigo-50 dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700">
                <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative">
                            <input type="checkbox" checked={autoGenShorts} onChange={(e) => setAutoGenShorts(e.target.checked)} className="peer sr-only"/>
                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-pink-600"></div>
                        </div>
                        <span className={`text-xs font-bold ${autoGenShorts ? 'text-pink-600 dark:text-pink-400' : 'text-gray-500'}`}>
                            <span className="flex items-center gap-1"><Zap size={14} fill={autoGenShorts ? "currentColor" : "none"}/> تحويل تلقائي للشورتس (Auto-Shorts)</span>
                        </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <div className="relative">
                            <input type="checkbox" checked={autoDownload} onChange={(e) => setAutoDownload(e.target.checked)} className="peer sr-only"/>
                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                        </div>
                        <span className={`text-xs font-bold ${autoDownload ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                            <span className="flex items-center gap-1"><FileDown size={14}/> تحميل الحزمة تلقائياً بعد الانتهاء</span>
                        </span>
                    </label>
                </div>
            </div>

            <div className="mt-6">
                <button onClick={onGenerate} disabled={isLoading || !title.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-3">
                    {isLoading ? <><RefreshCw className="animate-spin" size={24}/> {step === 'SCRIPT' ? 'جاري الكتابة...' : step === 'META' ? 'تحليل الميتاداتا...' : step === 'TIKTOK' ? 'وصف التيك توك...' : step === 'SHORTS' ? 'تحويل للشورتس...' : step === 'SHORT_META' ? 'ميتاداتا الشورت...' : 'جاري المعالجة...'}</> : <><Sparkles size={24}/> بدء الإنتاج الكامل</>}
                </button>
            </div>
        </div>
    );
};

export default ContentInputForm;
