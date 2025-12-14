
import React, { useState, useRef } from 'react';
import { ChannelProfile, AppSettings } from '../../types';
import { useAppContext } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { Database, Plus, Edit, Trash2, ShieldCheck, ShieldAlert, Info, Lock, Download, CloudDownload, FileJson, Upload, FileText, Save, FileSpreadsheet, AlertCircle, Youtube, Cpu, MessageSquare, Image as ImageIcon, X, ArrowUp, ArrowDown, Star } from 'lucide-react';

const ChannelsSettings: React.FC = () => {
    const { profiles, currentProfileId, settings, addProfile, updateProfile, removeProfile, importProfiles, selectProfile, updateSettings, reorderProfiles } = useAppContext();
    const { addToast } = useToast();

    // --- Form State ---
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newChannelId, setNewChannelId] = useState('');
    const [newApiKey, setNewApiKey] = useState('');
    
    // Auth Files
    const [secretFileContent, setSecretFileContent] = useState('');
    const [tokenFileContent, setTokenFileContent] = useState('');
    const [formError, setFormError] = useState('');

    // Models
    const [modelInput, setModelInput] = useState('');
    const [customModels, setCustomModels] = useState<string[]>([]);
    const [selectedTextModel, setSelectedTextModel] = useState<string>('models/gemini-flash-lite-latest');
    const [selectedImageModel, setSelectedImageModel] = useState<string>('pollinations.ai');

    const secretFileRef = useRef<HTMLInputElement>(null);
    const tokenFileRef = useRef<HTMLInputElement>(null);
    const csvFileRef = useRef<HTMLInputElement>(null);
    const [showDetailsId, setShowDetailsId] = useState<string | null>(null);

    React.useEffect(() => {
        const defaults = ['models/gemini-flash-lite-latest','gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'];
        const merged = Array.from(new Set([...defaults, ...(settings.customModels || [])]));
        setCustomModels(merged);
        if (settings.selectedTextModel) setSelectedTextModel(settings.selectedTextModel);
        if (settings.selectedImageModel) setSelectedImageModel(settings.selectedImageModel);
    }, [settings]);

    // --- Helpers ---
    const extractClientCredentials = (jsonStr: string) => {
        try {
            const clean = jsonStr.trim();
            if (!clean) return {};
            const json = JSON.parse(clean);
            const data = json.installed || json.web;
            return (data && data.client_id && data.client_secret) ? { clientId: data.client_id, clientSecret: data.client_secret } : {};
        } catch (e) { return {}; }
    };

    const extractTokens = (jsonStr: string) => {
        try {
            const clean = jsonStr.trim();
            if (!clean) return {};
            const json = JSON.parse(clean);
            return json.refresh_token ? { refreshToken: json.refresh_token, accessToken: json.access_token || json.token } : {};
        } catch (e) { return {}; }
    };

    const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>, setContent: (s: string) => void) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => { if (ev.target?.result) { setContent(ev.target.result as string); addToast("تم قراءة الملف بنجاح", "success"); } };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleSaveChannel = async () => {
        setFormError('');
        if (!newName || !newChannelId || !newApiKey) { setFormError("يرجى تعبئة الحقول الأساسية."); return; }
        const creds = extractClientCredentials(secretFileContent);
        const tokens = extractTokens(tokenFileContent);
        const profileData: ChannelProfile = {
            id: editingId || Date.now().toString(),
            name: newName, channelId: newChannelId.replace(/^@/, '').trim(), apiKey: newApiKey.trim(),
            geminiApiKey: '', 
            clientId: creds.clientId || (editingId ? profiles.find(p=>p.id===editingId)?.clientId : undefined),
            clientSecret: creds.clientSecret || (editingId ? profiles.find(p=>p.id===editingId)?.clientSecret : undefined),
            refreshToken: tokens.refreshToken || (editingId ? profiles.find(p=>p.id===editingId)?.refreshToken : undefined),
            accessToken: tokens.accessToken || (editingId ? profiles.find(p=>p.id===editingId)?.accessToken : undefined)
        };
        if (editingId) { await updateProfile(profileData); addToast("تم تحديث بيانات القناة", "success"); setEditingId(null); } 
        else { await addProfile(profileData); addToast("تم إضافة القناة بنجاح", "success"); }
        clearForm();
    };

    const handleEdit = (profile: ChannelProfile) => {
        setEditingId(profile.id); setNewName(profile.name); setNewChannelId(profile.channelId); setNewApiKey(profile.apiKey);
        setSecretFileContent(profile.clientId ? JSON.stringify({ installed: { client_id: profile.clientId, client_secret: profile.clientSecret } }, null, 2) : '');
        setTokenFileContent(profile.refreshToken ? JSON.stringify({ refresh_token: profile.refreshToken, access_token: profile.accessToken }, null, 2) : '');
        document.getElementById('channelForm')?.scrollIntoView({ behavior: 'smooth' });
    };

    const clearForm = () => { setEditingId(null); setNewName(''); setNewChannelId(''); setNewApiKey(''); setSecretFileContent(''); setTokenFileContent(''); setFormError(''); };
    const isProfileComplete = (p: ChannelProfile) => !!(p.refreshToken && p.clientId && p.clientSecret);

    // CSV Logic
    const escapeCSV = (field: string | undefined) => {
        if (!field) return '';
        const stringField = String(field);
        if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) return `"${stringField.replace(/"/g, '""')}"`;
        return stringField;
    };

    const parseCSV = (text: string) => {
        // Simple CSV parser logic (reused from original)
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            if (inQuotes) {
                if (char === '"' && nextChar === '"') { currentCell += '"'; i++; }
                else if (char === '"') inQuotes = false;
                else currentCell += char;
            } else {
                if (char === '"') inQuotes = true;
                else if (char === ',') { currentRow.push(currentCell.trim()); currentCell = ''; }
                else if (char === '\n' || char === '\r') {
                    if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
                    currentRow = []; currentCell = '';
                    if (char === '\r' && nextChar === '\n') i++;
                } else currentCell += char;
            }
        }
        if (currentCell || currentRow.length > 0) { currentRow.push(currentCell.trim()); rows.push(currentRow); }
        return rows;
    };

    const handleExportCsv = () => {
        const BOM = "\uFEFF";
        // Header now includes a GLOBAL_KEYS column
        const header = "اسم القناة,معرف القناة (Channel ID),Youtube API Key,Gemini API Key,محتوى ملف السيكرت (Client Secret JSON),محتوى ملف التوكن (Token JSON),GLOBAL_GEMINI_KEYS_LIST\n";
        
        // Only put global keys in the FIRST row
        const globalKeysString = settings.geminiApiKeys.join('|');

        const rows = profiles.map((p, index) => {
            const secretObj = p.clientId ? { installed: { client_id: p.clientId, client_secret: p.clientSecret } } : {};
            const tokenObj = p.refreshToken ? { refresh_token: p.refreshToken, access_token: p.accessToken } : {};
            const globalKeysCol = index === 0 ? escapeCSV(globalKeysString) : ""; 
            
            return [
                escapeCSV(p.name), escapeCSV(p.channelId), escapeCSV(p.apiKey), escapeCSV(p.geminiApiKey), escapeCSV(JSON.stringify(secretObj)), escapeCSV(JSON.stringify(tokenObj)), globalKeysCol
            ].join(',');
        }).join('\n');
        
        const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `creator_nexus_backup.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        addToast("تم تصدير الجدول (مع المفاتيح) بنجاح", "success");
    };

    const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            if (!text) return;
            try {
                const rows = parseCSV(text);
                const batchProfiles: ChannelProfile[] = [];
                let importedGlobalKeys: string[] = [];

                for (let index = 0; index < rows.length; index++) {
                    const row = rows[index];
                    if (index === 0 && (row[0].includes("اسم القناة") || row[0].toLowerCase().includes("name"))) continue;
                    if (row.length < 3) continue;
                    
                    // Extract Global Keys from First Row (Column 6 - 0-indexed)
                    if (row.length > 6 && row[6] && importedGlobalKeys.length === 0) {
                        importedGlobalKeys = row[6].split('|').filter(k => k.trim().length > 0);
                    }

                    const name = row[0];
                    const chId = row[1]?.replace(/^@/, '').trim();
                    const ytKey = row[2]?.trim();
                    const geminiKey = row[3]?.trim() || ''; 
                    const secretJson = row.length > 4 ? row[4] : '';
                    const tokenJson = row.length > 5 ? row[5] : '';

                    if (!name || !chId || !ytKey) continue;
                    const creds = extractClientCredentials(secretJson);
                    const tokens = extractTokens(tokenJson);
                    const existing = profiles.find(p => p.channelId === chId);
                    
                    batchProfiles.push({
                        id: existing ? existing.id : `${Date.now()}_${index}_${Math.random().toString(36).substring(7)}`,
                        name, channelId: chId, apiKey: ytKey, geminiApiKey: geminiKey,
                        clientId: creds.clientId || existing?.clientId, clientSecret: creds.clientSecret || existing?.clientSecret,
                        refreshToken: tokens.refreshToken || existing?.refreshToken, accessToken: tokens.accessToken || existing?.accessToken
                    });
                }

                if (batchProfiles.length > 0) {
                    await importProfiles(batchProfiles);
                    // Update Global Keys if found
                    if (importedGlobalKeys.length > 0) {
                        const mergedKeys = Array.from(new Set([...settings.geminiApiKeys, ...importedGlobalKeys]));
                        updateSettings({ geminiApiKeys: mergedKeys });
                        addToast(`تم استيراد ${importedGlobalKeys.length} مفتاح Gemini`, "info");
                    }
                    addToast(`تمت معالجة ${batchProfiles.length} قناة بنجاح.`, "success");
                } else addToast("لم يتم العثور على بيانات صالحة.", "warning");
            } catch (err) { addToast("خطأ في قراءة ملف CSV.", "error"); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Reorder Handlers
    const moveChannel = (index: number, direction: 'up' | 'down') => {
        const newProfiles = [...profiles];
        if (direction === 'up') {
            if (index === 0) return;
            [newProfiles[index - 1], newProfiles[index]] = [newProfiles[index], newProfiles[index - 1]];
        } else {
            if (index === newProfiles.length - 1) return;
            [newProfiles[index + 1], newProfiles[index]] = [newProfiles[index], newProfiles[index + 1]];
        }
        reorderProfiles(newProfiles);
    };

    // Default Channel Handler
    const handleSetDefault = (id: string) => {
        updateSettings({ defaultChannelId: id });
        addToast("تم تعيين القناة الافتراضية بنجاح", "success");
    };

    // Model Handlers
    const handleAddModel = () => { if(modelInput && !customModels.includes(modelInput)) { const updated = [...customModels, modelInput]; setCustomModels(updated); updateSettings({ customModels: updated }); setModelInput(''); addToast("تم إضافة النموذج", "success"); } };
    const handleDeleteModel = (model: string) => { const updated = customModels.filter(m => m !== model); setCustomModels(updated); updateSettings({ customModels: updated }); };
    const handleSaveModelPreferences = async () => { await updateSettings({ selectedTextModel: selectedTextModel, selectedImageModel: selectedImageModel }); addToast("تم حفظ إعدادات النماذج الافتراضية", "success"); };

    return (
        <div className="space-y-8">
            <div className="flex justify-end mb-4 gap-2">
                <input type="file" ref={csvFileRef} className="hidden" accept=".csv" onChange={handleCsvImport} />
                <button onClick={() => csvFileRef.current?.click()} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow-md flex items-center gap-2 text-sm">
                    <FileSpreadsheet size={16}/> استيراد CSV (جماعي)
                </button>
                <button onClick={handleExportCsv} className="bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm flex items-center gap-2 text-sm">
                    <FileText size={16}/> تصدير الجدول
                </button>
            </div>

            {/* 1. Connected Channels List (Priority First) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 overflow-visible transition-colors">
                <div className="bg-gray-100 dark:bg-slate-800 p-4 border-b dark:border-slate-700">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Database size={18} className="text-blue-600"/> القنوات المتصلة</h3>
                </div>
                <div className="overflow-visible">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold border-b dark:border-slate-700">
                            <tr>
                                <th className="p-4 w-10 text-center">ترتيب</th>
                                <th className="p-4 w-10 text-center">اختيار</th>
                                <th className="p-4">اسم القناة</th>
                                <th className="p-4">Youtube Key</th>
                                <th className="p-4 text-center">الحالة</th>
                                <th className="p-4 w-32 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                            {profiles.length === 0 ? (
                                <tr><td colSpan={6} className="p-10 text-center text-gray-400">القائمة فارغة.</td></tr>
                            ) : (
                                profiles.map((profile, index) => {
                                    const isComplete = isProfileComplete(profile);
                                    const isEditing = editingId === profile.id;
                                    const isDefault = settings.defaultChannelId === profile.id;

                                    return (
                                        <tr key={profile.id} className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition group ${currentProfileId === profile.id ? 'bg-indigo-50 dark:bg-slate-800 border-l-4 border-l-indigo-600' : ''} ${isEditing ? 'bg-indigo-50/50' : ''}`}>
                                            <td className="p-4 text-center">
                                                <div className="flex flex-col items-center gap-1 opacity-50 group-hover:opacity-100 transition">
                                                    <button onClick={(e) => { e.stopPropagation(); moveChannel(index, 'up'); }} disabled={index === 0} className="p-0.5 hover:text-indigo-600 disabled:opacity-20"><ArrowUp size={12}/></button>
                                                    <button onClick={(e) => { e.stopPropagation(); moveChannel(index, 'down'); }} disabled={index === profiles.length - 1} className="p-0.5 hover:text-indigo-600 disabled:opacity-20"><ArrowDown size={12}/></button>
                                                </div>
                                            </td>
                                            <td className="p-4 text-center"><input type="radio" checked={currentProfileId === profile.id} onChange={() => selectProfile(profile.id)} className="w-4 h-4 text-indigo-600 cursor-pointer"/></td>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                    {profile.name}
                                                    {isEditing && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded">جاري التعديل</span>}
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleSetDefault(profile.id); }} 
                                                        className={`transition ${isDefault ? 'text-yellow-500' : 'text-gray-200 hover:text-yellow-400'}`}
                                                        title={isDefault ? "هذه هي القناة الافتراضية" : "تعيين كقناة افتراضية"}
                                                    >
                                                        <Star size={14} fill={isDefault ? "currentColor" : "none"} />
                                                    </button>
                                                </div>
                                                <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{profile.channelId}</div>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400">{profile.apiKey ? '••••••••' + profile.apiKey.slice(-4) : <span className="text-red-300">مفقود</span>}</td>
                                            <td className="p-4 text-center relative">
                                                <div className="flex items-center justify-center gap-2">
                                                    {isComplete ? <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-3 py-1 rounded-full text-xs font-bold border border-green-200 shadow-sm"><ShieldCheck size={14}/> متصل</span> : <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400 px-3 py-1 rounded-full text-xs font-medium border border-gray-200"><ShieldAlert size={14}/> محدود</span>}
                                                    <button onClick={() => setShowDetailsId(showDetailsId === profile.id ? null : profile.id)} className="text-gray-400 hover:text-indigo-600 transition"><Info size={16}/></button>
                                                </div>
                                                {showDetailsId === profile.id && (
                                                    <div className="absolute top-12 left-1/2 transform -translate-x-1/2 w-72 bg-gray-800 text-white p-4 rounded-xl shadow-2xl z-50 text-right animate-fade-in-up border border-gray-700">
                                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700"><h4 className="font-bold text-sm flex items-center gap-2"><Lock size={14} className="text-yellow-400"/> الأمان</h4><button onClick={() => setShowDetailsId(null)} className="text-gray-500 hover:text-white"><ShieldAlert size={14}/></button></div>
                                                        <div className="space-y-3 text-xs text-gray-300"><div><span className="block text-gray-500 mb-1">OAuth:</span><span className={isComplete ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{isComplete ? "✅ صالح" : "❌ غير موجود"}</span></div></div>
                                                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-gray-800 rotate-45 border-l border-t border-gray-700"></div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={(e) => { e.preventDefault(); handleEdit(profile); }} className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg transition"><Edit size={18} /></button>
                                                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(window.confirm('حذف؟')) removeProfile(profile.id); }} className="text-gray-400 hover:text-red-600 p-2 rounded-lg transition"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 2. Add/Edit Channel Form */}
            <div id="channelForm" className={`bg-white dark:bg-slate-900 rounded-xl shadow-md border overflow-hidden transition-colors duration-300 ${editingId ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900' : 'border-indigo-100 dark:border-slate-800'}`}>
                <div className={`p-4 border-b flex items-center justify-between flex-wrap gap-2 ${editingId ? 'bg-indigo-600 text-white' : 'bg-indigo-50/80 dark:bg-indigo-900/20 border-indigo-100 dark:border-slate-700'}`}>
                    <div className="flex items-center gap-2">
                        {editingId ? <Edit size={20} /> : <Plus className="text-indigo-600 dark:text-indigo-400" size={20} />}
                        <h3 className={`font-bold ${editingId ? 'text-white' : 'text-indigo-900 dark:text-indigo-200'}`}>{editingId ? 'تعديل بيانات القناة' : 'إضافة قناة جديدة'}</h3>
                    </div>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div><label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">اسم القناة</label><input value={newName} onChange={e => setNewName(e.target.value)} className="w-full border rounded p-2.5 text-sm outline-none focus:border-indigo-500 transition bg-gray-50 focus:bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700" /></div>
                        <div><label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">معرف القناة (ID)</label><input value={newChannelId} onChange={e => setNewChannelId(e.target.value)} className="w-full border rounded p-2.5 text-sm outline-none focus:border-indigo-500 transition bg-gray-50 focus:bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 font-mono" /></div>
                        <div><label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Youtube size={12}/> Youtube API Key</label><input value={newApiKey} onChange={e => setNewApiKey(e.target.value)} type="password" className="w-full border rounded p-2.5 text-sm outline-none focus:border-indigo-500 transition bg-gray-50 focus:bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700 font-mono" /></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-slate-800">
                        <div>
                            <div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"><FileJson size={14} className="text-amber-600"/> محتوى client_secret.json</label><button onClick={() => secretFileRef.current?.click()} className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded hover:bg-amber-100 font-bold flex items-center gap-1"><Upload size={10}/> رفع</button><input type="file" ref={secretFileRef} className="hidden" accept=".json" onChange={(e) => handleFileRead(e, setSecretFileContent)} /></div>
                            <textarea value={secretFileContent} onChange={e => setSecretFileContent(e.target.value)} className="w-full border rounded p-3 text-xs font-mono bg-amber-50/30 outline-none h-24 placeholder:text-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder='لصق محتوى الملف هنا...'></textarea>
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-2"><label className="block text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1"><FileText size={14} className="text-green-600"/> محتوى token.json</label><button onClick={() => tokenFileRef.current?.click()} className="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 font-bold flex items-center gap-1"><Upload size={10}/> رفع</button><input type="file" ref={tokenFileRef} className="hidden" accept=".json" onChange={(e) => handleFileRead(e, setTokenFileContent)} /></div>
                            <textarea value={tokenFileContent} onChange={e => setTokenFileContent(e.target.value)} className="w-full border rounded p-3 text-xs font-mono bg-green-50/30 outline-none h-24 placeholder:text-gray-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white" placeholder='لصق محتوى الملف هنا...'></textarea>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="text-sm">{formError && <span className="text-red-600 font-bold flex items-center gap-1 animate-pulse"><AlertCircle size={16}/> {formError}</span>}</div>
                        <div className="flex gap-2">
                            {editingId && <button onClick={clearForm} className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-300 transition">إلغاء</button>}
                            <button onClick={handleSaveChannel} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 shadow-md transition flex items-center gap-2">{editingId ? <Save size={18} /> : <Plus size={18} />}{editingId ? 'حفظ التعديلات' : 'إضافة للقائمة'}</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. AI Models Settings */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors mb-8">
                <div className="bg-gray-50 dark:bg-slate-800 p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Cpu size={18} className="text-purple-600"/> إعدادات نماذج الذكاء الاصطناعي (AI Models)</h3>
                    <button onClick={handleSaveModelPreferences} className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center gap-1"><Save size={14}/> حفظ الإعدادات</button>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700 pb-2">النماذج النشطة حالياً</h4>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><MessageSquare size={14}/> نموذج النصوص (Text Model)</label>
                            <select value={selectedTextModel} onChange={(e) => setSelectedTextModel(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                                {customModels.map(m => (<option key={m} value={m}>{m}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><ImageIcon size={14}/> نموذج الصور (Image Model)</label>
                            <select value={selectedImageModel} onChange={(e) => setSelectedImageModel(e.target.value)} className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-purple-500">
                                <option value="pollinations.ai">Pollinations AI</option>
                                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image</option>
                                {customModels.filter(m => m.includes('image') || m.includes('vision')).map(m => (m !== 'gemini-2.5-flash-image' && <option key={m} value={m}>{m}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-4 border-l border-gray-100 dark:border-slate-800 pl-0 md:pl-8">
                        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700 pb-2">إضافة نماذج مخصصة</h4>
                        <div className="flex gap-2">
                            <input value={modelInput} onChange={e => setModelInput(e.target.value)} placeholder="اسم النموذج (مثال: gemini-1.5-pro)" className="flex-1 border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700"/>
                            <button onClick={handleAddModel} className="bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-200 px-4 py-2 rounded text-sm font-bold hover:bg-gray-200 dark:hover:bg-slate-600">إضافة</button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {customModels.map(m => {
                                const isDefault = ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'].includes(m);
                                return (<span key={m} className={`border px-2 py-1 rounded text-xs font-mono flex items-center gap-1 ${selectedTextModel === m ? 'ring-1 ring-purple-500 bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-600 dark:bg-slate-800'}`}>{m} {isDefault ? <Lock size={10} className="opacity-50"/> : <button onClick={() => handleDeleteModel(m)} className="text-gray-400 hover:text-red-500"><X size={12}/></button>}</span>)
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChannelsSettings;