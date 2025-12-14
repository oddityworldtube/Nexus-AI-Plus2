
import React, { useState } from 'react';
import { useAppContext } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';
import { TranscriptService } from '../../types';
import { Link, Plus, Trash2, CheckCircle, Save, ExternalLink } from 'lucide-react';

const TranscriptServicesSettings: React.FC = () => {
    const { settings, updateSettings } = useAppContext();
    const { addToast } = useToast();
    
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');

    const services = settings.transcriptServices || [];
    const defaultId = settings.defaultTranscriptServiceId;

    const handleAddService = () => {
        if(!newName.trim() || !newUrl.trim()) return addToast("يرجى إدخال الاسم والرابط", "error");
        
        const newService: TranscriptService = {
            id: `ts_${Date.now()}`,
            name: newName,
            url: newUrl
        };

        const updated = [...services, newService];
        updateSettings({ transcriptServices: updated });
        setNewName('');
        setNewUrl('');
        addToast("تم إضافة الموقع بنجاح", "success");
    };

    const handleDelete = (id: string) => {
        if(confirm("هل أنت متأكد من حذف هذا الموقع؟")) {
            const updated = services.filter(s => s.id !== id);
            // If we deleted the default, reset default to first available
            let newDefault = defaultId;
            if(defaultId === id) {
                newDefault = updated.length > 0 ? updated[0].id : undefined;
            }
            updateSettings({ transcriptServices: updated, defaultTranscriptServiceId: newDefault });
            addToast("تم الحذف", "info");
        }
    };

    const handleSetDefault = (id: string) => {
        updateSettings({ defaultTranscriptServiceId: id });
        addToast("تم تعيين الموقع الافتراضي", "success");
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-md border border-gray-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 bg-indigo-50 dark:bg-slate-800 flex justify-between items-center">
                <h3 className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                    <Link size={18}/> مواقع استخراج النصوص (Transcript Services)
                </h3>
            </div>
            
            <div className="p-6 space-y-6">
                {/* Add New */}
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">إضافة موقع جديد</h4>
                    <div className="flex flex-col md:flex-row gap-3">
                        <input 
                            value={newName} 
                            onChange={e => setNewName(e.target.value)} 
                            placeholder="اسم الموقع (مثال: Free Transcriber)" 
                            className="flex-1 p-2.5 border rounded-lg text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                        />
                        <input 
                            value={newUrl} 
                            onChange={e => setNewUrl(e.target.value)} 
                            placeholder="رابط الموقع (URL)" 
                            className="flex-[2] p-2.5 border rounded-lg text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                            dir="ltr"
                        />
                        <button onClick={handleAddService} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2 text-sm shadow-sm">
                            <Plus size={16}/> إضافة
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="space-y-2">
                    {services.length === 0 ? (
                        <p className="text-center text-gray-400 py-4">لا توجد مواقع مضافة.</p>
                    ) : (
                        services.map(service => {
                            const isDefault = service.id === defaultId;
                            return (
                                <div key={service.id} className={`flex items-center justify-between p-3 rounded-xl border transition ${isDefault ? 'bg-indigo-50/50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white border-gray-100 hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDefault ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                            {isDefault ? <CheckCircle size={16}/> : <Link size={16}/>}
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                                                {service.name}
                                                {isDefault && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">الافتراضي</span>}
                                            </h5>
                                            <a href={service.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
                                                {service.url} <ExternalLink size={10}/>
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {!isDefault && (
                                            <button onClick={() => handleSetDefault(service.id)} className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
                                                تعيين كافتراضي
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(service.id)} className="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default TranscriptServicesSettings;
