import React from 'react';
import { Wand2, ExternalLink, Copy, Edit3, Save, FileText, ChevronUp, ChevronDown, RefreshCw, CheckCircle, PenTool } from 'lucide-react';
import { useAppContext } from '../../contexts/AppContext';
import { useToast } from '../../contexts/ToastContext';

interface TranscriptManagerProps {
    videoId: string;
    transcript: string;
    onTranscriptChange: (text: string) => void;
    hasApiTranscript: boolean;
    isExpanded: boolean;
    onToggleExpand: () => void;
    isFetching: boolean; // <--- خاصية جديدة
}

const TranscriptManager: React.FC<TranscriptManagerProps> = ({ 
    videoId, transcript, onTranscriptChange, hasApiTranscript, isExpanded, onToggleExpand, isFetching 
}) => {
    const { settings } = useAppContext();
    const { addToast } = useToast();

    // Get default service or fallback to Maestra
    const defaultServiceId = settings.defaultTranscriptServiceId;
    const selectedService = settings.transcriptServices?.find(s => s.id === defaultServiceId) || 
                            settings.transcriptServices?.[0] || 
                            { name: 'Maestra', url: 'https://maestra.ai/ar/tools/video-to-text/youtube-transcript-generator' };

    const handleMagicExtract = () => {
        navigator.clipboard.writeText(`https://www.youtube.com/watch?v=${videoId}`);
        addToast("تم نسخ رابط الفيديو! جاري فتح موقع الاستخراج...", "success");
        setTimeout(() => {
            window.open(selectedService.url, '_blank');
        }, 800);
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm animate-fade-in mb-6">
            <div 
                className="bg-gray-50 p-3 flex justify-between items-center cursor-pointer border-b border-gray-200"
                onClick={onToggleExpand}
            >
                <div className="flex items-center gap-3">
                    <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        {/* تغيير لون الأيقونة حسب الحالة */}
                        <FileText size={18} className={hasApiTranscript ? "text-green-600" : transcript ? "text-blue-600" : "text-indigo-500"}/> 
                        
                        {/* تغيير العنوان حسب الحالة */}
                        {hasApiTranscript 
                            ? "نص الفيديو (تلقائي)" 
                            : transcript 
                                ? "نص الفيديو (يدوي)" 
                                : "محرر نص الفيديو (Transcript)"}
                    </h4>

                    {/* --- منطقة الحالات المعدلة --- */}
                    {isFetching ? (
                        <span className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 font-bold animate-pulse">
                            <RefreshCw size={10} className="animate-spin"/> جاري الاستخراج...
                        </span>
                    ) : hasApiTranscript ? ( 
                        // يظهر هذا فقط إذا تم الجلب أوتوماتيكياً (سواء من السيرفر أو يوتيوب)
                        <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 font-bold">
                            <CheckCircle size={10}/> استخراج تلقائي
                        </span>
                    ) : transcript ? (
                        // يظهر هذا فقط إذا كان هناك نص ولكن لم يتم تفعيل hasApiTranscript (أي لصق يدوي)
                        <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 font-bold">
                            <PenTool size={10}/> استخراج تلقائي
                        </span>
                    ) : (
                        <span className="text-[10px] text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 font-bold">
                            مفقود ⚠️
                        </span>
                    )}
                    {/* --------------------------- */}

                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
            </div>
            
            {isExpanded && (
                <div className="p-4 bg-gray-50/30">
                    {!hasApiTranscript && !isFetching && (
                        <div className="mb-4 bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex flex-col md:flex-row items-center justify-between gap-3">
                            <div className="text-xs text-indigo-800">
                                <p className="font-bold mb-1">💡 لم نتمكن من جلبه تلقائياً؟</p>
                                <p>استخدم الزر السحري لنسخ الرابط وفتح أداة {selectedService.name} الخارجية.</p>
                            </div>
                            <button 
                                onClick={handleMagicExtract}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:shadow-lg transition text-xs flex items-center gap-2 whitespace-nowrap"
                            >
                                <Wand2 size={14} className="text-yellow-300"/> استخراج خارجي
                            </button>
                        </div>
                    )}

                    <textarea 
                        value={transcript}
                        onChange={(e) => onTranscriptChange(e.target.value)}
                        className="w-full h-40 p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-y bg-white"
                        placeholder={isFetching ? "جاري البحث عن النص..." : "ألصق نص الفيديو (Transcript) هنا..."}
                        disabled={isFetching}
                    />
                    
                    <div className="flex justify-between items-center mt-2">
                        <div className="text-xs text-gray-400">
                            {transcript.length > 0 ? `${transcript.length} حرف` : ''}
                        </div>
                        <button 
                            onClick={onToggleExpand}
                            className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-300 transition flex items-center gap-1"
                        >
                            <Save size={14}/> حفظ وطي
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TranscriptManager;