
import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { KeyRound, ListPlus, Check, Trash2 } from 'lucide-react';

const ApiKeysSettings: React.FC = () => {
    const { settings, updateSettings } = useAppContext();
    const { addToast } = useToast();
    const [batchKeysInput, setBatchKeysInput] = useState('');

    const handleAddBatchKeys = () => {
        if (!batchKeysInput.trim()) return;
        // Split by comma OR newline to handle pasted lists correctly
        const newKeys = batchKeysInput.split(/[\n,]+/).map(k => k.trim()).filter(k => k.length > 5);
        
        if (newKeys.length === 0) {
            addToast("لم يتم العثور على مفاتيح صالحة في النص", "error");
            return;
        }
        const currentKeys = settings.geminiApiKeys || [];
        const mergedKeys = Array.from(new Set([...currentKeys, ...newKeys]));
        updateSettings({ geminiApiKeys: mergedKeys });
        setBatchKeysInput('');
        addToast(`تم إضافة ${newKeys.length} مفتاح جديد بنجاح`, "success");
    };

    const handleDeleteKey = (keyToDelete: string) => {
        const updated = settings.geminiApiKeys.filter(k => k !== keyToDelete);
        updateSettings({ geminiApiKeys: updated });
        addToast("تم حذف المفتاح", "info");
    };

    const handleDeleteAllKeys = () => {
        if (confirm("هل أنت متأكد من حذف جميع مفاتيح Gemini؟ سيتوقف الذكاء الاصطناعي عن العمل.")) {
            updateSettings({ geminiApiKeys: [] });
            addToast("تم حذف جميع المفاتيح", "success");
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-indigo-50 dark:bg-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                        <KeyRound size={18}/> إدارة مفاتيح Gemini (Global Pool)
                    </h3>
                    <div className="text-xs font-bold bg-indigo-100 dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full">
                        العدد الحالي: {settings.geminiApiKeys?.length || 0}
                    </div>
                </div>
                <div className="p-6">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                        إضافة مفاتيح متعددة (كل مفتاح في سطر أو مفصولة بفاصلة)
                    </label>
                    <textarea
                        value={batchKeysInput}
                        onChange={(e) => setBatchKeysInput(e.target.value)}
                        placeholder="AIzaSy... , AIzaSy... , AIzaSy..."
                        className="w-full h-32 p-4 border border-gray-300 dark:border-slate-700 rounded-xl bg-gray-50 dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm dark:text-white"
                        dir="ltr"
                    />
                    <div className="mt-4 flex justify-between items-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            يتم استخدام هذه المفاتيح بالتناوب (Rotation) تلقائياً عند فشل أحدها أو تجاوز الحد.
                        </p>
                        <button 
                            onClick={handleAddBatchKeys}
                            disabled={!batchKeysInput.trim()}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition shadow flex items-center gap-2 disabled:opacity-50"
                        >
                            <ListPlus size={18}/> إضافة الدفعة
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
                    <h4 className="font-bold text-gray-700 dark:text-gray-300">قائمة المفاتيح النشطة</h4>
                    <button onClick={handleDeleteAllKeys} className="text-xs text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-100 dark:border-red-900 hover:bg-red-100 transition">
                        حذف الكل
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                            <tr>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3">المفتاح (Masked)</th>
                                <th className="p-3">الحالة</th>
                                <th className="p-3 text-center w-24">إجراء</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                            {(!settings.geminiApiKeys || settings.geminiApiKeys.length === 0) ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400">
                                        لا توجد مفاتيح مضافة. النظام لن يعمل بدون مفتاح واحد على الأقل.
                                    </td>
                                </tr>
                            ) : (
                                settings.geminiApiKeys.map((key, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800 transition">
                                        <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="p-3 font-mono text-gray-700 dark:text-gray-300">
                                            {key.substring(0, 8)}••••••••••••••••{key.substring(key.length - 6)}
                                        </td>
                                        <td className="p-3">
                                            <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                <Check size={10}/> جاهز
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => handleDeleteKey(key)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition">
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ApiKeysSettings;
