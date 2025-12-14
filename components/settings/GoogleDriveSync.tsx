
import React, { useState } from 'react';
import { useSync } from '../../contexts/SyncContext';
import { Cloud, CloudOff, RefreshCw, Check, AlertTriangle, DownloadCloud, UploadCloud, ArrowDownCircle, ArrowUpCircle, Lock } from 'lucide-react';

const GoogleDriveSync: React.FC = () => {
    const { isAuth, status, connect, disconnect, uploadManual, restoreManual, lastSyncTime } = useSync();
    const [legacyPassword, setLegacyPassword] = useState('');

    const getStatusText = () => {
        switch(status) {
            case 'SYNCING': return 'جاري المزامنة...';
            case 'SAVED': return `آمن. آخر حفظ: ${lastSyncTime?.toLocaleTimeString() || 'الآن'}`;
            case 'ERROR': return 'خطأ في المزامنة';
            case 'UPDATE_AVAILABLE': return 'توجد نسخة أحدث على السحابة';
            case 'PASSWORD_REQUIRED': return 'مطلوب كلمة مرور فك التشفير';
            default: return 'متصل';
        }
    };

    const getStatusIcon = () => {
        switch(status) {
            case 'SYNCING': return <RefreshCw size={14} className="animate-spin text-blue-500"/>;
            case 'SAVED': return <Check size={14} className="text-green-500"/>;
            case 'ERROR': return <AlertTriangle size={14} className="text-red-500"/>;
            case 'UPDATE_AVAILABLE': return <DownloadCloud size={14} className="text-amber-500 animate-bounce"/>;
            case 'PASSWORD_REQUIRED': return <Lock size={14} className="text-amber-600"/>;
            default: return <Cloud size={14} className="text-indigo-500"/>;
        }
    };

    const handleRestore = () => {
        if (confirm("⚠️ تحذير هام:\nاستعادة النسخة من السحابة ستؤدي إلى استبدال جميع البيانات الموجودة حالياً على هذا الجهاز.\n\nهل أنت متأكد أنك تريد الاستمرار؟")) {
            restoreManual();
        }
    };

    const handleRestoreWithPassword = () => {
        if (!legacyPassword) return;
        restoreManual(legacyPassword);
    };

    const handleUpload = () => {
        if (confirm("سيتم رفع بياناتك الحالية واستبدال النسخة الموجودة على Google Drive.\n\nاستمرار؟")) {
            uploadManual();
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm mb-6 transition-all">
            
            {/* Header & Connection Status */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-800">
                <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full flex-shrink-0 transition-colors ${isAuth ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400'}`}>
                        {isAuth ? <Cloud size={28}/> : <CloudOff size={28}/>}
                    </div>
                    <div>
                        <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-1">المزامنة السحابية (Google Drive)</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-md">
                            {isAuth 
                                ? <span className="flex items-center gap-2 font-medium">{getStatusIcon()} {getStatusText()}</span>
                                : 'اربط حسابك لحفظ بياناتك مشفرة تلقائياً. لن نفقد أي شيء بعد اليوم.'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    {!isAuth ? (
                        <button onClick={connect} className="w-full md:w-auto bg-white border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-white px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-3 shadow-sm">
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G"/>
                            ربط الحساب
                        </button>
                    ) : (
                        <button 
                            onClick={disconnect} 
                            className="px-4 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition border border-gray-200 dark:border-slate-700"
                        >
                            فصل الحساب
                        </button>
                    )}
                </div>
            </div>

            {/* Password Prompt for Decryption Failure */}
            {status === 'PASSWORD_REQUIRED' && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 animate-fade-in">
                    <div className="flex items-start gap-3">
                        <Lock className="text-amber-600 mt-1 flex-shrink-0" size={20}/>
                        <div className="flex-1">
                            <h5 className="font-bold text-amber-800 dark:text-amber-200 text-sm mb-2">تشفير مختلف</h5>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3 leading-relaxed">
                                ملف النسخة الاحتياطية الموجود على Drive مشفر بكلمة مرور تختلف عن كلمة المرور الحالية. يرجى إدخال كلمة المرور القديمة لفك التشفير.
                            </p>
                            <div className="flex gap-2">
                                <input 
                                    type="password" 
                                    value={legacyPassword}
                                    onChange={(e) => setLegacyPassword(e.target.value)}
                                    placeholder="كلمة مرور الملف القديمة..."
                                    className="flex-1 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <button 
                                    onClick={handleRestoreWithPassword}
                                    disabled={!legacyPassword}
                                    className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-amber-700 transition disabled:opacity-50"
                                >
                                    فك التشفير واستعادة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Controls - Only Visible if Authenticated */}
            {isAuth && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    {/* Upload Card */}
                    <div className="bg-indigo-50 dark:bg-slate-800 p-4 rounded-xl border border-indigo-100 dark:border-slate-700 flex items-center justify-between group hover:border-indigo-300 transition">
                        <div>
                            <h5 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm mb-1 flex items-center gap-2">
                                <ArrowUpCircle size={16}/> رفع نسخة يدوياً
                            </h5>
                            <p className="text-[10px] text-indigo-700 dark:text-indigo-400">حفظ البيانات الحالية فوراً إلى الدرايف</p>
                        </div>
                        <button 
                            onClick={handleUpload}
                            disabled={status === 'SYNCING'}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {status === 'SYNCING' ? <RefreshCw className="animate-spin" size={14}/> : <UploadCloud size={14}/>}
                            رفع الآن
                        </button>
                    </div>

                    {/* Download Card */}
                    <div className="bg-amber-50 dark:bg-slate-800 p-4 rounded-xl border border-amber-100 dark:border-slate-700 flex items-center justify-between group hover:border-amber-300 transition">
                        <div>
                            <h5 className="font-bold text-amber-900 dark:text-amber-200 text-sm mb-1 flex items-center gap-2">
                                <ArrowDownCircle size={16}/> استعادة من السحابة
                            </h5>
                            <p className="text-[10px] text-amber-700 dark:text-amber-400">سحب النسخة واستبدال البيانات المحلية</p>
                        </div>
                        <button 
                            onClick={handleRestore}
                            disabled={status === 'SYNCING'}
                            className="bg-white border border-amber-200 text-amber-700 dark:bg-slate-700 dark:text-amber-400 dark:border-slate-600 px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-amber-50 dark:hover:bg-slate-600 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {status === 'SYNCING' ? <RefreshCw className="animate-spin" size={14}/> : <DownloadCloud size={14}/>}
                            سحب النسخة
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleDriveSync;
