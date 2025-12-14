
import React, { useState } from 'react';
import { Copy, Download, Clock, FileText, CheckCircle } from 'lucide-react';

interface ScriptCardProps {
    text: string;
}

const ScriptCard: React.FC<ScriptCardProps> = ({ text }) => {
    const [copied, setCopied] = useState(false);

    // Calculate Stats
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    // Avg speaking rate ~130-150 wpm
    const readingTimeMinutes = Math.ceil(wordCount / 140);

    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `script_${Date.now()}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700 shadow-sm overflow-hidden my-2 w-full">
            <div className="bg-indigo-50 dark:bg-slate-700/50 p-3 flex justify-between items-center border-b border-indigo-100 dark:border-slate-600">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 dark:bg-slate-600 p-1.5 rounded-lg">
                        <FileText size={16} className="text-indigo-600 dark:text-indigo-300"/>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-white">سكربت مقترح</h4>
                        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                            <span>{wordCount} كلمة</span>
                            <span className="flex items-center gap-1"><Clock size={10}/> ~{readingTimeMinutes} دقيقة قراءة</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleCopy} 
                        className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-gray-500 hover:text-indigo-600 transition"
                        title="نسخ النص"
                    >
                        {copied ? <CheckCircle size={16} className="text-green-500"/> : <Copy size={16}/>}
                    </button>
                    <button 
                        onClick={handleDownload} 
                        className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-gray-500 hover:text-indigo-600 transition"
                        title="تحميل ملف .txt"
                    >
                        <Download size={16}/>
                    </button>
                </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-900/50 overflow-x-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {text}
                </pre>
            </div>
        </div>
    );
};

export default ScriptCard;
