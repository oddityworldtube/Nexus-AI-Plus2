
import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, ShieldCheck, AlertTriangle, Database, Lock, RefreshCw, CheckCircle, Save, CheckSquare, Square } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import * as db from '../../services/dbService';
import { encryptData, decryptData } from '../../services/securityService';
import { BackupFile, FullDatabaseDump, BackupCategory } from '../../types';

const CATEGORIES: { id: BackupCategory, label: string }[] = [
    { id: 'profiles', label: 'القنوات وملفات الربط' },
    { id: 'settings', label: 'الإعدادات العامة والمفاتيح' },
    { id: 'competitors', label: 'المنافسين المحفوظين' },
    { id: 'ideaHistory', label: 'سجل توليد الأفكار' },
    { id: 'templates', label: 'قوالب الصور المصغرة' },
    { id: 'prompts', label: 'برومبتات النظام' },
    { id: 'copilotHistory', label: 'سجل محادثات Copilot' },
    { id: 'copilotPrompts', label: 'برومبتات Copilot' },
    { id: 'userPreferences', label: 'تفضيلات المستخدم' }
];

const VaultBackup: React.FC<{ masterKey: CryptoKey }> = ({ masterKey }) => {
    const { addToast } = useToast();
    const { settings, updateSettings } = useAppContext();
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [selectedCategories, setSelectedCategories] = useState<BackupCategory[]>(
        CATEGORIES.map(c => c.id) // Default all
    );

    useEffect(() => {
        if (settings.defaultBackupCategories && settings.defaultBackupCategories.length > 0) {
            setSelectedCategories(settings.defaultBackupCategories);
        }
    }, [settings.defaultBackupCategories]);

    const toggleCategory = (id: BackupCategory) => {
        setSelectedCategories(prev => 
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedCategories.length === CATEGORIES.length) {
            setSelectedCategories([]);
        } else {
            setSelectedCategories(CATEGORIES.map(c => c.id));
        }
    };

    const handleSaveDefaults = async () => {
        await updateSettings({ defaultBackupCategories: selectedCategories });
        addToast("تم حفظ خيارات النسخ الاحتياطي الافتراضية", "success");
    };

    const handleExport = async () => {
        if (selectedCategories.length === 0) {
            addToast("يرجى تحديد عنصر واحد على الأقل للتصدير", "warning");
            return;
        }

        setIsExporting(true);
        try {
            // 1. Get filtered data from IDB
            const allData = await db.getAllData(selectedCategories);
            
            // 2. Encrypt the Payload using the Vault Key
            const encryptedPayload = await encryptData(allData, masterKey);
            
            // 3. Get Security Params from localStorage (The Lock)
            const saltRaw = localStorage.getItem('vault_salt');
            const verifierRaw = localStorage.getItem('vault_verifier');
            
            if (!saltRaw || !verifierRaw) {
                throw new Error("بيانات الخزنة الأمنية مفقودة.");
            }

            // 4. Construct Backup File
            const backupFile: BackupFile = {
                version: 1,
                timestamp: Date.now(),
                security: {
                    salt: JSON.parse(saltRaw),
                    verifier: JSON.parse(verifierRaw)
                },
                payload: encryptedPayload
            };

            // 5. Download
            const blob = new Blob([JSON.stringify(backupFile)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `CreatorNexus_Backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            addToast("تم تصدير النسخة المشفرة بنجاح", "success");

        } catch (e: any) {
            console.error(e);
            addToast("فشل التصدير: " + e.message, "error");
        }
        setIsExporting(false);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (selectedCategories.length === 0) {
            addToast("يرجى تحديد ما تريد استعادته من القائمة", "warning");
            e.target.value = '';
            return;
        }

        if(!confirm(`⚠️ تحذير: استعادة النسخة سيؤدي إلى استبدال البيانات الحالية (للفئات المحددة فقط).\n\nهل أنت متأكد من الاستمرار؟`)) {
            e.target.value = '';
            return;
        }

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const backup: BackupFile = JSON.parse(text);

                if (!backup.security || !backup.payload) {
                    throw new Error("ملف النسخة الاحتياطية غير صالح.");
                }

                // --- STRATEGY: PENDING RESTORE ---
                try {
                    localStorage.setItem('pending_restore_payload', backup.payload);
                    localStorage.setItem('pending_restore_selection', JSON.stringify(selectedCategories));
                } catch (err) {
                    throw new Error("حجم ملف النسخة الاحتياطية كبير جداً لمتصفحك الحالي.");
                }

                // Overwrite Security Vault (The Lock)
                localStorage.setItem('vault_salt', JSON.stringify(backup.security.salt));
                localStorage.setItem('vault_verifier', JSON.stringify(backup.security.verifier));

                addToast("تم تحميل النسخة. جاري إعادة التشغيل لفك التشفير...", "success");
                
                // Force Reload to Lock Screen
                setTimeout(() => {
                    window.location.reload();
                }, 2000);

            } catch (err: any) {
                console.error(err);
                addToast("فشل الاستيراد: " + err.message, "error");
                setIsImporting(false);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 opacity-5">
                <Database size={200} />
            </div>

            <div className="relative z-10">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-3">
                    <ShieldCheck className="text-emerald-400" size={28}/>
                    خزنة النسخ الاحتياطي الكامل
                </h2>
                <p className="text-slate-300 mb-6 max-w-2xl leading-relaxed">
                    قم بإنشاء نسخة كربونية مشفرة لبياناتك. الملف يعمل فقط مع كلمة المرور الأصلية.
                </p>

                {/* Selection Panel */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-xl p-4 mb-8">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                        <h4 className="text-sm font-bold text-indigo-300">حدد البيانات المراد تصديرها / استيرادها</h4>
                        <div className="flex gap-2">
                            <button onClick={toggleAll} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-gray-300 transition">
                                {selectedCategories.length === CATEGORIES.length ? 'إلغاء الكل' : 'تحديد الكل'}
                            </button>
                            <button onClick={handleSaveDefaults} className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded flex items-center gap-1 transition" title="حفظ التحديد الحالي كإعداد افتراضي">
                                <Save size={12}/> حفظ كافتراضي
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {CATEGORIES.map(cat => {
                            const isSelected = selectedCategories.includes(cat.id);
                            return (
                                <div 
                                    key={cat.id} 
                                    onClick={() => toggleCategory(cat.id)}
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition select-none ${isSelected ? 'bg-indigo-900/40 border border-indigo-500/50' : 'bg-slate-900/30 border border-transparent hover:bg-slate-700'}`}
                                >
                                    {isSelected ? <CheckSquare size={16} className="text-emerald-400"/> : <Square size={16} className="text-slate-500"/>}
                                    <span className={`text-xs ${isSelected ? 'text-white font-bold' : 'text-slate-400'}`}>{cat.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Export Card */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition group">
                        <div className="bg-indigo-600/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition">
                            <Download className="text-indigo-400" size={24}/>
                        </div>
                        <h3 className="font-bold text-lg mb-2">تصدير المحدد</h3>
                        <p className="text-xs text-slate-400 mb-6">تحميل ملف .json مشفر للعناصر المختارة.</p>
                        <button 
                            onClick={handleExport}
                            disabled={isExporting || selectedCategories.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                        >
                            {isExporting ? <RefreshCw className="animate-spin" size={18}/> : <Database size={18}/>}
                            {isExporting ? 'جاري التشفير...' : 'تصدير البيانات'}
                        </button>
                    </div>

                    {/* Import Card */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition group relative overflow-hidden">
                        {isImporting && <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-emerald-500 rounded-full border-t-transparent"></div></div>}
                        <div className="bg-emerald-600/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition">
                            <Upload className="text-emerald-400" size={24}/>
                        </div>
                        <h3 className="font-bold text-lg mb-2">استعادة المحدد</h3>
                        <p className="text-xs text-slate-400 mb-6">استيراد ملف واستبدال العناصر المختارة فقط.</p>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={selectedCategories.length === 0}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Upload size={18}/>
                            رفع واستعادة
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".json" 
                            onChange={handleImport}
                        />
                    </div>
                </div>

                <div className="mt-8 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="text-amber-500 flex-shrink-0 mt-1" size={20}/>
                    <div className="text-sm text-amber-200">
                        <span className="font-bold block text-amber-400 mb-1">كيف يعمل النقل الآمن؟</span>
                        عند الاستيراد، سيتم استبدال البيانات للفئات التي قمت بتحديدها فقط (Checkboxes). باقي البيانات ستبقى كما هي. يتطلب كلمة المرور الأصلية لفك التشفير.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VaultBackup;
