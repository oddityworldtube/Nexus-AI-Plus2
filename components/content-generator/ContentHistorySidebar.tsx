
import React from 'react';
import { History, Trash2, X } from 'lucide-react';
import { ContentSession } from '../../types';

interface ContentHistorySidebarProps {
    history: ContentSession[];
    showHistory: boolean;
    setShowHistory: (show: boolean) => void;
    onLoadSession: (session: ContentSession) => void;
    onDeleteHistory: () => void;
}

const ContentHistorySidebar: React.FC<ContentHistorySidebarProps> = ({ 
    history, showHistory, setShowHistory, onLoadSession, onDeleteHistory 
}) => {
    return (
        <>
            {/* Sidebar */}
            <div className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transform transition-transform duration-300 lg:transform-none ${showHistory ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'} flex flex-col h-full`}>
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-950">
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2"><History size={18}/> السجل</h3>
                    <div className="flex gap-1">
                        <button onClick={onDeleteHistory} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-slate-800"><Trash2 size={16}/></button>
                        <button onClick={() => setShowHistory(false)} className="lg:hidden text-gray-500"><X size={18}/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {history.length === 0 ? (
                        <p className="text-center text-gray-400 text-xs py-10">لا توجد جلسات محفوظة</p>
                    ) : (
                        history.map(s => (
                            <div key={s.id} onClick={() => onLoadSession(s)} className="p-3 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer group transition">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-gray-800 dark:text-gray-200 text-xs line-clamp-1">{s.title}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-500">
                                    <span>{s.date.split(',')[0]}</span>
                                    <span className="bg-gray-100 dark:bg-slate-700 px-1.5 rounded">{s.inputs.format.split(' ')[0]}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Overlay for mobile */}
            {showHistory && <div className="fixed inset-0 bg-black/20 z-20 lg:hidden" onClick={() => setShowHistory(false)}></div>}
        </>
    );
};

export default ContentHistorySidebar;
