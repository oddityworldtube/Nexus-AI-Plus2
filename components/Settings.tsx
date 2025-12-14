import React, { useState, useEffect, useMemo } from 'react';
import { PromptTemplate } from '../types';
import { 
  Database, Terminal, KeyRound, BookOpen, Save, Info, RefreshCw, 
  Wand2, ShieldCheck, Server, Settings as SettingsIcon, LayoutGrid, 
  MessageSquare, FileText, Bot, HardDrive, Share2
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAppContext } from '../contexts/AppContext';
import { PromptService } from '../services/promptService';
import { optimizeSystemPrompt } from '../services/geminiService';

// --- Sub Components Imports ---
import ChannelsSettings from './settings/ChannelsSettings';
import ApiKeysSettings from './settings/ApiKeysSettings';
import TranscriptServicesSettings from './settings/TranscriptServicesSettings';
import CopilotPromptsSettings from './settings/CopilotPromptsSettings';
import VaultBackup from './settings/VaultBackup';
import HelpGuide from './settings/HelpGuide';
import GoogleDriveSync from './settings/GoogleDriveSync';
import ModelTester from './settings/ModelTester';

// ============================================================================
// INTERNAL COMPONENT: Prompts Manager
// تم فصل هذا المكون لتقليل تعقيد المكون الرئيسي
// ============================================================================
const PromptsManager: React.FC = () => {
    const { settings } = useAppContext();
    const { addToast } = useToast();
    
    // State
    const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
    const [editedTemplate, setEditedTemplate] = useState('');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        loadPrompts();
    }, [settings]);

    const loadPrompts = async () => {
        setIsLoading(true);
        try {
            await PromptService.init();
            const all = await PromptService.getAllDefaults(); 
            const updatedList = await Promise.all(all.map(async p => await PromptService.getPrompt(p.id)));
            setPrompts(updatedList);
        } catch (error) {
            console.error("Failed to load prompts", error);
            addToast("فشل تحميل البرومبتات", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePromptSelect = (p: PromptTemplate) => {
        setSelectedPrompt(p);
        setEditedTemplate(p.template);
    };

    const handleSavePrompt = async () => {
        if (!selectedPrompt) return;
        try {
            const updated: PromptTemplate = { ...selectedPrompt, template: editedTemplate };
            await PromptService.savePrompt(updated);
            addToast("تم حفظ التعديلات بنجاح", "success");
            loadPrompts();
        } catch (e) {
            addToast("حدث خطأ أثناء الحفظ", "error");
        }
    };

    const handleResetPrompt = async () => {
        if (!selectedPrompt) return;
        if (confirm("هل أنت متأكد من العودة للنص الأصلي لهذا البرومبت؟")) {
            await PromptService.resetPrompt(selectedPrompt.id);
            await loadPrompts();
            const originalPrompt = await PromptService.getPrompt(selectedPrompt.id);
            if (originalPrompt) {
                setSelectedPrompt(originalPrompt);
                setEditedTemplate(originalPrompt.template);
                addToast("تمت استعادة النص الأصلي", "info");
            }
        }
    };

    const handleResetAllPrompts = async () => {
        if (confirm("تحذير: سيتم حذف جميع تعديلاتك والعودة للوضع الافتراضي لكل البرومبتات. هل أنت متأكد؟")) {
            await PromptService.resetAll();
            loadPrompts();
            setSelectedPrompt(null);
            addToast("تم تصفير جميع البرومبتات", "success");
        }
    };

    const handleOptimizePrompt = async () => {
        if (!selectedPrompt) return;
        if (!editedTemplate.trim()) return;
        
        setIsOptimizing(true);
        addToast("جاري استدعاء خبير البرومبتات (Gemini) للتحسين...", "info");
        
        try {
            const apiKey = settings.geminiApiKeys.length > 0 ? settings.geminiApiKeys[0] : undefined;
            const optimized = await optimizeSystemPrompt(editedTemplate, selectedPrompt.variables, apiKey);
            setEditedTemplate(optimized); 
            addToast("تم اقتراح صياغة احترافية! راجعها ثم احفظ.", "success");
        } catch (e) {
            console.error(e);
            addToast("فشل التحسين التلقائي. تأكد من إعداد مفاتيح API.", "error");
        } finally {
            setIsOptimizing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[700px]">
            {/* Sidebar: Prompt List */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 text-sm">
                        <Terminal size={16} className="text-indigo-500"/> 
                        قوالب النظام
                        <span className="bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full text-[10px]">{prompts.length}</span>
                    </h3>
                    <button 
                        onClick={handleResetAllPrompts} 
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded-lg transition-colors" 
                        title="إعادة ضبط المصنع للكل"
                    >
                        <RefreshCw size={14}/>
                    </button>
                </div>
                
                <div className="overflow-y-auto flex-1 p-3 space-y-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-gray-400"/></div>
                    ) : prompts.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => handlePromptSelect(p)}
                            className={`p-3 rounded-lg cursor-pointer transition-all border relative group ${
                                selectedPrompt?.id === p.id 
                                ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800 shadow-sm' 
                                : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:border-gray-200 dark:hover:border-slate-700'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide ${
                                    selectedPrompt?.id === p.id 
                                    ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200' 
                                    : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                    {p.category}
                                </span>
                            </div>
                            <h4 className={`text-sm font-bold mb-1 ${selectedPrompt?.id === p.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                {p.name}
                            </h4>
                            <p className="text-[11px] text-gray-400 leading-tight line-clamp-2">{p.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area: Editor */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 flex flex-col overflow-hidden h-full">
                {selectedPrompt ? (
                    <>
                        <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                             <div>
                                 <h3 className="font-bold text-gray-800 dark:text-white text-base flex items-center gap-2">
                                     <FileText size={18} className="text-gray-400"/> {selectedPrompt.name}
                                 </h3>
                                 <p className="text-xs text-gray-500 mt-1">{selectedPrompt.description}</p>
                             </div>
                             
                             <div className="flex gap-2 w-full sm:w-auto">
                                 <button 
                                    onClick={handleResetPrompt} 
                                    className="flex-1 sm:flex-none text-xs border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition font-medium"
                                 >
                                     استعادة
                                 </button>
                                 <button 
                                    onClick={handleOptimizePrompt} 
                                    disabled={isOptimizing}
                                    className="flex-1 sm:flex-none text-xs bg-gradient-to-br from-purple-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:shadow-lg hover:shadow-indigo-500/30 transition font-bold flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
                                 >
                                    {isOptimizing ? <RefreshCw size={14} className="animate-spin"/> : <Wand2 size={14}/>}
                                    <span>تحسين AI</span>
                                 </button>
                                 <button 
                                    onClick={handleSavePrompt} 
                                    className="flex-1 sm:flex-none text-xs bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-100 transition font-bold flex items-center justify-center gap-1.5 shadow-sm"
                                 >
                                     <Save size={14}/>
                                     <span>حفظ</span>
                                 </button>
                             </div>
                        </div>

                        <div className="p-4 flex-1 flex flex-col gap-4 overflow-hidden bg-gray-50/30 dark:bg-slate-950/30">
                             {/* Variables Bar */}
                             <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                 <h4 className="text-[11px] font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                                    <Info size={12}/> المتغيرات الديناميكية (اضغط للإضافة)
                                 </h4>
                                 <div className="flex flex-wrap gap-2">
                                     {selectedPrompt.variables.map(v => (
                                         <button 
                                            key={v} 
                                            onClick={() => setEditedTemplate(prev => prev + `{${v}}`)}
                                            className="text-[11px] bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2 py-1 rounded border border-blue-200 dark:border-blue-800/50 font-mono text-blue-600 dark:text-blue-300 transition-colors shadow-sm"
                                            title={`إدراج {${v}}`}
                                         >
                                             {`{${v}}`}
                                         </button>
                                     ))}
                                 </div>
                             </div>

                             {/* Text Area */}
                             <div className="flex-1 relative group">
                                 <textarea 
                                    value={editedTemplate}
                                    onChange={(e) => setEditedTemplate(e.target.value)}
                                    className="w-full h-full p-5 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-xl font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none text-gray-800 dark:text-gray-200 shadow-sm transition-all custom-scrollbar"
                                    dir="ltr"
                                    placeholder="اكتب نص البرومبت هنا..."
                                    spellCheck={false}
                                 />
                                 <div className="absolute bottom-4 right-4 text-[10px] text-gray-400 pointer-events-none bg-white/80 dark:bg-slate-900/80 px-2 py-1 rounded backdrop-blur">
                                     {editedTemplate.length} characters
                                 </div>
                             </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-50/50 dark:bg-slate-900">
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-full shadow-sm mb-4">
                            <Bot size={48} className="text-indigo-100 dark:text-slate-700" strokeWidth={1.5}/>
                        </div>
                        <h4 className="text-gray-900 dark:text-white font-bold mb-1">لم يتم اختيار برومبت</h4>
                        <p className="text-sm">اختر قالباً من القائمة الجانبية للبدء في التعديل والتحسين.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT: Settings
// ============================================================================

type SettingsTabType = 'channels' | 'keys' | 'models_test' | 'prompts' | 'transcript' | 'copilot' | 'backup';

const Settings: React.FC = () => {
  const { masterKey } = useAppContext(); 
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTabType>('channels'); 
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Configuration for Tabs
  const tabs = useMemo(() => [
      { id: 'channels', label: 'القنوات', icon: LayoutGrid },
      { id: 'keys', label: 'مفاتيح API', icon: KeyRound },
      { id: 'models_test', label: 'اختبار النماذج', icon: Server },
      { id: 'prompts', label: 'برومبتات النظام', icon: Terminal },
      { id: 'copilot', label: 'برومبتات Copilot', icon: Bot },
      { id: 'transcript', label: 'خدمات النص', icon: FileText },
      { id: 'backup', label: 'النسخ الاحتياطي', icon: HardDrive },
  ], []);

  return (
    <div className="space-y-8 animate-fade-in pb-20 min-h-screen">
      
      {showHelpGuide && <HelpGuide onClose={() => setShowHelpGuide(false)} />}

      {/* --- Page Header --- */}
      <div className="flex flex-col gap-6 border-b border-gray-200 dark:border-slate-800 pb-6">
          <div className="flex justify-between items-start">
              <div>
                  <h2 className="text-2xl font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-3">
                      <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none text-white">
                        <SettingsIcon size={24} />
                      </div>
                      إعدادات النظام
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-2 max-w-lg leading-relaxed">
                      لوحة التحكم المركزية لإدارة القنوات، مفاتيح الذكاء الاصطناعي، وتخصيص سلوك المساعد الذكي.
                  </p>
              </div>
              
              <button 
                onClick={() => setShowHelpGuide(true)}
                className="group flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition shadow-sm"
              >
                  <BookOpen size={16} className="text-indigo-500 group-hover:scale-110 transition-transform"/> 
                  <span>الدليل والروابط</span>
              </button>
          </div>
          
          {/* --- Navigation Tabs --- */}
          <div className="w-full overflow-x-auto pb-1 custom-scrollbar">
              <div className="flex gap-2 min-w-max">
                  {tabs.map((tab) => {
                      const isActive = activeSettingsTab === tab.id;
                      const Icon = tab.icon;
                      return (
                          <button 
                            key={tab.id}
                            onClick={() => setActiveSettingsTab(tab.id as SettingsTabType)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 border ${
                                isActive 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-none' 
                                : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                              <Icon size={16} className={isActive ? 'text-white' : 'text-gray-400'}/>
                              {tab.label}
                          </button>
                      );
                  })}
              </div>
          </div>
      </div>

      {/* --- Content Area --- */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeSettingsTab === 'channels' && <ChannelsSettings />}
          {activeSettingsTab === 'keys' && <ApiKeysSettings />}
          {activeSettingsTab === 'models_test' && <ModelTester />}
          {activeSettingsTab === 'transcript' && <TranscriptServicesSettings />}
          {activeSettingsTab === 'copilot' && <CopilotPromptsSettings />}
          
          {/* Internal Component Rendered Here */}
          {activeSettingsTab === 'prompts' && <PromptsManager />}

          {activeSettingsTab === 'backup' && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {masterKey ? (
                      <>
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-700 dark:text-white mb-4">
                                <HardDrive size={20} className="text-indigo-500"/> التخزين المحلي والنسخ
                            </h3>
                            <VaultBackup masterKey={masterKey} />
                        </div>
                        <div className="space-y-6">
                             <h3 className="text-lg font-bold flex items-center gap-2 text-gray-700 dark:text-white mb-4">
                                <Share2 size={20} className="text-green-500"/> المزامنة السحابية
                            </h3>
                            <GoogleDriveSync />
                        </div>
                      </>
                  ) : (
                    <div className="col-span-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-8 text-center text-amber-800 dark:text-amber-200">
                        <ShieldCheck size={48} className="mx-auto mb-4 opacity-50"/>
                        <h3 className="text-lg font-bold">المصادقة مطلوبة</h3>
                        <p>يجب عليك تسجيل الدخول باستخدام المفتاح الرئيسي (Master Key) للوصول إلى إعدادات النسخ الاحتياطي.</p>
                    </div>
                  )}
              </div>
          )}
      </div>

    </div>
  );
};

export default Settings;