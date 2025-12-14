
import React, { useState, useEffect } from 'react';
import { CopilotPrompt } from '../../types';
import { CopilotPromptService } from '../../services/copilotPromptService';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Trash2, RefreshCw, Save, Edit3, X, Terminal, Wand2 } from 'lucide-react';

const CopilotPromptsSettings: React.FC = () => {
    const { addToast } = useToast();
    const [prompts, setPrompts] = useState<CopilotPrompt[]>([]);
    const [editingPrompt, setEditingPrompt] = useState<CopilotPrompt | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadPrompts();
    }, []);

    const loadPrompts = async () => {
        await CopilotPromptService.init();
        const all = await CopilotPromptService.getAllPrompts();
        setPrompts(all);
    };

    const handleSave = async () => {
        if (!editingPrompt) return;
        if (!editingPrompt.name || !editingPrompt.template) {
            addToast("يرجى ملء الاسم والقالب", "error");
            return;
        }
        
        await CopilotPromptService.savePrompt(editingPrompt);
        addToast("تم حفظ البرومبت", "success");
        setEditingPrompt(null);
        setIsCreating(false);
        loadPrompts();
    };

    const handleDelete = async (id: string) => {
        if(confirm("هل أنت متأكد من حذف هذا البرومبت؟")) {
            await CopilotPromptService.deletePrompt(id);
            addToast("تم الحذف", "info");
            loadPrompts();
        }
    };

    const handleResetDefaults = async () => {
        if(confirm("سيتم حذف جميع التعديلات والعودة للوضع الافتراضي. هل أنت متأكد؟")) {
            await CopilotPromptService.resetToDefaults();
            addToast("تمت استعادة الإعدادات الافتراضية", "success");
            loadPrompts();
        }
    };

    const handleCreateNew = () => {
        const newPrompt: CopilotPrompt = {
            id: `cp_${Date.now()}`,
            name: "برومبت جديد",
            template: "",
            context: ['GENERAL'],
            variables: []
        };
        setEditingPrompt(newPrompt);
        setIsCreating(true);
    };

    const handleAddVariable = () => {
        if (!editingPrompt) return;
        const newVars = [...(editingPrompt.variables || []), { name: 'new_var', description: 'وصف المتغير' }];
        setEditingPrompt({ ...editingPrompt, variables: newVars });
    };

    const handleUpdateVariable = (index: number, field: 'name' | 'description' | 'defaultValue', value: string) => {
        if (!editingPrompt || !editingPrompt.variables) return;
        const newVars = [...editingPrompt.variables];
        newVars[index] = { ...newVars[index], [field]: value };
        setEditingPrompt({ ...editingPrompt, variables: newVars });
    };

    const handleRemoveVariable = (index: number) => {
        if (!editingPrompt || !editingPrompt.variables) return;
        const newVars = editingPrompt.variables.filter((_, i) => i !== index);
        setEditingPrompt({ ...editingPrompt, variables: newVars });
    };

    const toggleContext = (ctx: string) => {
        if (!editingPrompt) return;
        const current = editingPrompt.context;
        const updated = current.includes(ctx) 
            ? current.filter(c => c !== ctx) 
            : [...current, ctx];
        setEditingPrompt({ ...editingPrompt, context: updated });
    };

    const availableContexts = [
        'GENERAL', 'DASHBOARD_OVERVIEW', 'VIDEO_LIST_ANALYSIS', 
        'VIDEO_OPTIMIZATION', 'IDEA_GENERATION', 'COMPETITOR_ANALYSIS'
    ];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[700px]">
            {/* List */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col h-full">
                <div className="p-4 border-b dark:border-slate-800 bg-gray-50 dark:bg-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <Terminal size={18}/> برومبتات Copilot
                    </h3>
                    <div className="flex gap-1">
                        <button onClick={handleCreateNew} className="text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 p-1.5 rounded" title="إنشاء جديد">
                            <Plus size={14}/>
                        </button>
                        <button onClick={handleResetDefaults} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded" title="استعادة الافتراضي">
                            <RefreshCw size={14}/>
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                    {prompts.map(p => (
                        <div 
                            key={p.id}
                            onClick={() => { setEditingPrompt(p); setIsCreating(false); }}
                            className={`p-3 rounded-lg cursor-pointer transition border text-right group ${editingPrompt?.id === p.id ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`text-sm font-bold ${editingPrompt?.id === p.id ? 'text-indigo-800 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {p.name}
                                </h4>
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                                    <Trash2 size={12}/>
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                                {p.context.slice(0, 2).map(c => (
                                    <span key={c} className="text-[9px] bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">{c}</span>
                                ))}
                                {p.context.length > 2 && <span className="text-[9px] text-gray-400">+{p.context.length - 2}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Editor */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 flex flex-col h-full overflow-hidden">
                {editingPrompt ? (
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                            <input 
                                value={editingPrompt.name} 
                                onChange={(e) => setEditingPrompt({...editingPrompt, name: e.target.value})}
                                className="bg-transparent font-bold text-gray-800 dark:text-white text-lg outline-none border-b border-transparent focus:border-indigo-500 transition w-full"
                                placeholder="اسم البرومبت"
                            />
                            <div className="flex gap-2 flex-shrink-0 ml-4">
                                <button onClick={handleSave} className="text-xs bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 font-bold flex items-center gap-1 shadow-sm">
                                    <Save size={14}/> حفظ
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                            {/* Template */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">القالب (Template)</label>
                                <textarea 
                                    value={editingPrompt.template}
                                    onChange={(e) => setEditingPrompt({...editingPrompt, template: e.target.value})}
                                    className="w-full h-40 p-4 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-gray-800 dark:text-gray-200"
                                    placeholder="اكتب البرومبت هنا. استخدم {var_name} للمتغيرات."
                                />
                            </div>

                            {/* Contexts */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">سياق الظهور (Context)</label>
                                <div className="flex flex-wrap gap-2">
                                    {availableContexts.map(ctx => (
                                        <button 
                                            key={ctx} 
                                            onClick={() => toggleContext(ctx)}
                                            className={`text-xs px-3 py-1.5 rounded-lg border transition ${editingPrompt.context.includes(ctx) ? 'bg-indigo-100 border-indigo-200 text-indigo-800 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500'}`}
                                        >
                                            {ctx}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Variables */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold text-gray-500">المتغيرات (Variables)</label>
                                    <button onClick={handleAddVariable} className="text-[10px] flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition"><Plus size={12}/> إضافة متغير</button>
                                </div>
                                <div className="space-y-2">
                                    {editingPrompt.variables?.map((v, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-800 p-2 rounded border border-gray-200 dark:border-slate-700">
                                            <input 
                                                value={v.name} 
                                                onChange={(e) => handleUpdateTextProps(i, 'name', e.target.value)}
                                                placeholder="اسم المتغير (بدون أقواس)"
                                                className="w-1/4 text-xs p-1 bg-white dark:bg-slate-900 border rounded"
                                            />
                                            <input 
                                                value={v.description} 
                                                onChange={(e) => handleUpdateTextProps(i, 'description', e.target.value)}
                                                placeholder="الوصف / السؤال للمستخدم"
                                                className="flex-1 text-xs p-1 bg-white dark:bg-slate-900 border rounded"
                                            />
                                            <input 
                                                value={v.defaultValue || ''} 
                                                onChange={(e) => handleUpdateTextProps(i, 'defaultValue', e.target.value)}
                                                placeholder="قيمة افتراضية"
                                                className="w-1/4 text-xs p-1 bg-white dark:bg-slate-900 border rounded"
                                            />
                                            <button onClick={() => handleRemoveVariable(i)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                        </div>
                                    ))}
                                    {(!editingPrompt.variables || editingPrompt.variables.length === 0) && (
                                        <p className="text-xs text-gray-400 italic text-center py-2">لا توجد متغيرات. البرومبت سيتم إرساله مباشرة.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Wand2 size={48} className="mb-4 opacity-20"/>
                        <p>اختر برومبت للتعديل أو أنشئ جديداً</p>
                    </div>
                )}
            </div>
        </div>
    );

    function handleUpdateTextProps(index: number, field: any, value: string) {
        if (!editingPrompt || !editingPrompt.variables) return;
        const newVars = [...editingPrompt.variables];
        newVars[index] = { ...newVars[index], [field]: value };
        setEditingPrompt({ ...editingPrompt, variables: newVars });
    }
};

export default CopilotPromptsSettings;
