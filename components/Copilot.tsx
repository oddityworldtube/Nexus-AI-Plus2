import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { chatWithCopilot, generateImages } from '../services/geminiService';
import { CopilotPromptService } from '../services/copilotPromptService';
import * as db from '../services/dbService';
import { ChatMessage, CopilotSession, CopilotPrompt } from '../types';
import { X, Send, BrainCircuit, Bot, User, Paperclip, Image as ImageIcon, FileText, Trash2, History, Maximize2, Minimize2, ChevronsUp, ChevronsDown, Eraser, Sparkles, ChevronRight, PlayCircle, Download, Wand2, Zap, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ScriptCard from './copilot/ScriptCard';

interface CopilotProps {
    isOpen: boolean;
    onClose: () => void;
    contextData: any; // Dynamic context passed from the main app
}

const Copilot: React.FC<CopilotProps> = ({ isOpen, onClose, contextData }) => {
    const { profiles, currentProfileId, setPendingImageForEditor, settings, pendingContentIdea, setPendingContentIdea } = useAppContext();
    const profile = profiles.find(p => p.id === currentProfileId);
    
    const { addToast } = useToast();
    
    // --- State ---
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [sessions, setSessions] = useState<CopilotSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    
    // Initialize model from Global Settings (Default Text Model)
    const [model, setModel] = useState<string>(settings.selectedTextModel || 'models/gemini-flash-lite-latest');
    
    // UI Toggles
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isInputExpanded, setIsInputExpanded] = useState(false);
    
    // Prompts State
    const [availablePrompts, setAvailablePrompts] = useState<CopilotPrompt[]>([]);
    const [showVariableModal, setShowVariableModal] = useState(false);
    const [currentPrompt, setCurrentPrompt] = useState<CopilotPrompt | null>(null);
    const [variableValues, setVariableValues] = useState<Record<string, string>>({});
    
    const [attachments, setAttachments] = useState<{ data: string; mimeType: string; name: string; type: 'image' | 'text' }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Prepare list of all available models (Defaults + Custom from Settings)
    const availableModels = Array.from(new Set([
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
        'models/gemini-flash-lite-latest',
        'gemini-2.5-flash-image',
        ...(settings.customModels || [])
    ]));

    // Update local model state if the global setting changes (optional, but good UX for consistency)
    useEffect(() => {
        if (settings.selectedTextModel) {
            setModel(settings.selectedTextModel);
        }
    }, [settings.selectedTextModel]);

    useEffect(() => {
        loadSessions();
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadPrompts();
        }
    }, [isOpen, contextData]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && !currentSessionId && messages.length === 0) {
            startNewSession();
        }
    }, [isOpen]);

    const loadSessions = async () => {
        const loaded = await db.getCopilotSessions();
        setSessions(loaded);
    };

    const loadPrompts = async () => {
        if (!contextData) return;
        const contextType = contextData.type || 'GENERAL';
        const prompts = await CopilotPromptService.getPromptsByContext(contextType);
        setAvailablePrompts(prompts);
    };

    const startNewSession = () => {
        const newId = Date.now().toString();
        setCurrentSessionId(newId);
        setMessages([
            {
                id: 'welcome',
                role: 'model',
                content: `مرحباً! أنا مساعد قناتك الذكي (Copilot) 🧠.\n\nأقوم بتحليل البيانات التي أمامك الآن لمساعدتك في اتخاذ قرارات أفضل.\n\nكيف يمكنني مساعدتك؟`,
                timestamp: Date.now()
            }
        ]);
        setIsHistoryOpen(false);
        setInput('');
    };

    // --- AGENTIC ACTION HANDLERS ---
    const executeToolCall = async (call: any): Promise<{ output: string, clientAction?: string }> => {
        const fn = call.name;
        const args = call.args;
        
        console.log(`[Copilot Agent] Executing tool: ${fn}`, args);

        try {
            switch(fn) {
                case 'save_draft':
                    setPendingContentIdea(args.title);
                    // Trigger tab switch to full content
                    const eventDraft = new CustomEvent('SWITCH_TAB', { detail: 'full_content' });
                    window.dispatchEvent(eventDraft);
                    return { output: `Saved draft titled "${args.title}".`, clientAction: `تم حفظ المسودة: ${args.title} والانتقال للمحرر` };

                case 'switch_tab':
                    const eventSwitch = new CustomEvent('SWITCH_TAB', { detail: args.tabId });
                    window.dispatchEvent(eventSwitch);
                    onClose(); // Optional: Close copilot on navigation
                    return { output: `Switched to tab ${args.tabId}.`, clientAction: `جاري الانتقال إلى: ${args.tabId}` };

                case 'generate_image':
                    const imageModel = settings.selectedImageModel;
                    // Trigger async generation but return immediate confirmation
                    generateImages([args.prompt], "Cinematic", imageModel || 'pollinations.ai')
                        .then(res => {
                            if (res && res[0]) {
                                const imgMsg: ChatMessage = {
                                    id: Date.now().toString(),
                                    role: 'model',
                                    content: `IMAGE_RESULT::${res[0]}`,
                                    timestamp: Date.now()
                                };
                                setMessages(prev => [...prev, imgMsg]);
                            }
                        });
                    return { output: `Generating image for prompt: ${args.prompt}`, clientAction: "جاري توليد الصورة..." };

                default:
                    return { output: `Error: Unknown tool ${fn}` };
            }
        } catch (e: any) {
            console.error("Tool execution error", e);
            return { output: `Error executing tool ${fn}: ${e.message}` };
        }
    };

    const handleSendMessage = async (overrideInput?: string, promptId?: string) => {
        const textToSend = overrideInput || input;
        if ((!textToSend.trim() && attachments.length === 0) || isLoading) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: textToSend,
            timestamp: Date.now(),
            attachments: attachments.map(a => ({ data: a.data, mimeType: a.mimeType, type: a.type })),
            promptId: promptId // Track which prompt triggered this
        };

        const updatedHistoryForUI = [...messages, userMsg];
        setMessages(updatedHistoryForUI);
        setInput('');
        setAttachments([]);
        setIsLoading(true);
        // Collapse input after sending if it was expanded
        if (isInputExpanded) setIsInputExpanded(false);

        try {
            const apiKeyToUse = profile?.geminiApiKey && profile.geminiApiKey.trim().length > 0 
                ? profile.geminiApiKey 
                : undefined;

            const response = await chatWithCopilot(
                messages, 
                textToSend, 
                contextData, 
                model, 
                userMsg.attachments,
                apiKeyToUse
            );

            // Handle Agentic Response
            if (typeof response === 'object' && response.type === 'functionCall') {
                const calls = response.calls;
                let botResponseText = "";
                
                for (const call of calls) {
                    const result = await executeToolCall(call);
                    if (result.clientAction) {
                        botResponseText += `⚡ **إجراء تلقائي:** ${result.clientAction}\n`;
                    }
                }
                
                // Add system confirmation message if valid action taken
                if (botResponseText) {
                    const botMsg: ChatMessage = {
                        id: (Date.now() + 1).toString(),
                        role: 'model',
                        content: botResponseText,
                        timestamp: Date.now()
                    };
                    setMessages([...updatedHistoryForUI, botMsg]);
                } else {
                    // Fallback if tool didn't return visual feedback
                    setMessages([...updatedHistoryForUI, { id: Date.now().toString(), role: 'model', content: "تم تنفيذ الإجراء.", timestamp: Date.now() }]);
                }

            } else {
                // Standard Text Response
                const botMsg: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    role: 'model',
                    content: response,
                    timestamp: Date.now()
                };
                const finalMessages = [...updatedHistoryForUI, botMsg];
                setMessages(finalMessages);

                if (currentSessionId) {
                    const session: CopilotSession = {
                        id: currentSessionId,
                        title: userMsg.content.substring(0, 30) + (userMsg.content.length > 30 ? '...' : ''),
                        date: new Date().toLocaleString(),
                        messages: finalMessages,
                        contextType: contextData?.type || 'General'
                    };
                    await db.saveCopilotSession(session);
                    loadSessions();
                }
            }

        } catch (e: any) {
            console.error("--- DETAILED COPILOT ERROR ---", e); 
            addToast("فشل الاتصال بالنموذج، انظر للدردشة لمعرفة التفاصيل", "error");

            const errorContent = `
**⚠️ حدث خطأ فني أثناء معالجة الطلب.**

\`\`\`
${e.toString()}
\`\`\`
`;
            
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'model',
                content: errorContent,
                timestamp: Date.now()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Prompt Handling ---
    const handlePromptClick = (prompt: CopilotPrompt) => {
        if (prompt.variables && prompt.variables.length > 0) {
            setCurrentPrompt(prompt);
            // Initialize defaults
            const defaults: Record<string, string> = {};
            prompt.variables.forEach(v => {
                if(v.defaultValue) defaults[v.name] = v.defaultValue;
            });
            setVariableValues(defaults);
            setShowVariableModal(true);
        } else {
            // Direct send
            handleSendMessage(prompt.template, prompt.id);
        }
    };

    const handleVariableSubmit = () => {
        if (!currentPrompt) return;
        let text = currentPrompt.template;
        // Interpolate
        for (const [key, val] of Object.entries(variableValues)) {
            text = text.replace(new RegExp(`{${key}}`, 'g'), val);
        }
        
        setShowVariableModal(false);
        handleSendMessage(text, currentPrompt.id);
        setCurrentPrompt(null);
        setVariableValues({});
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const result = ev.target?.result as string;
            const base64 = result.split(',')[1];
            const isImage = file.type.startsWith('image/');
            const isText = file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.csv');

            if (isImage || isText) {
                setAttachments(prev => [...prev, {
                    data: base64,
                    mimeType: file.type,
                    name: file.name,
                    type: isImage ? 'image' : 'text'
                }]);
            } else {
                addToast("نوع الملف غير مدعوم (فقط صور أو نصوص)", "warning");
            }
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset input
    };

    const loadSession = (session: CopilotSession) => {
        setCurrentSessionId(session.id);
        setMessages(session.messages);
        setIsHistoryOpen(false);
    };

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm("حذف هذه المحادثة؟")) {
            await db.deleteCopilotSession(id);
            loadSessions();
            if (currentSessionId === id) startNewSession();
        }
    };

    const handleDownloadImage = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `generated_image_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendToEditor = (url: string) => {
        setPendingImageForEditor(url);
        onClose(); 
        
        // Dispatch event to switch tab in App.tsx
        const event = new CustomEvent('SWITCH_TAB', { detail: 'optimizer' });
        window.dispatchEvent(event);
        
        addToast("تم إرسال الصورة إلى المحرر. انتقل إلى تبويبة 'استوديو التحسين'", "success");
    };

    // Calculate dynamic width based on state
    const containerWidthClass = isFullScreen 
        ? 'w-full md:w-full' 
        : 'w-full md:w-[450px] lg:w-[500px]';

    return (
        <>
            {isOpen && !isFullScreen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[90] transition-opacity" onClick={onClose}></div>
            )}

            <div className={`fixed top-0 right-0 h-full ${containerWidthClass} bg-white dark:bg-slate-900 shadow-2xl z-[100] transition-all duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col border-l border-gray-200 dark:border-slate-800`}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <BrainCircuit size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-none">مساعد القناة</h2>
                            <span className="text-[10px] opacity-80 font-mono">Copilot AI • Context Aware</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Model Indicator (Locked to Settings) */}
                        <div className="bg-white/10 border border-white/20 text-xs rounded px-2 py-1 text-white font-mono hidden sm:block max-w-[120px] truncate" title="Global Model Active">
                            {model}
                        </div>
                        <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className={`p-2 rounded hover:bg-white/20 transition ${isHistoryOpen ? 'bg-white/20' : ''}`} title="السجل">
                            <History size={18}/>
                        </button>
                        <button 
                            onClick={() => setIsFullScreen(!isFullScreen)} 
                            className="p-2 rounded hover:bg-white/20 transition hidden md:block" 
                            title={isFullScreen ? "تصغير النافذة" : "ملء الشاشة"}
                        >
                            {isFullScreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
                        </button>
                        <button onClick={onClose} className="p-2 rounded hover:bg-white/20 transition" title="إغلاق">
                            <X size={18}/>
                        </button>
                    </div>
                </div>

                {/* History Overlay */}
                {isHistoryOpen && (
                    <div className="absolute top-[70px] left-0 w-full h-[calc(100%-70px)] bg-gray-50 dark:bg-slate-900 z-20 p-4 overflow-y-auto animate-fade-in">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-700 dark:text-gray-300">المحادثات السابقة</h3>
                            <button onClick={startNewSession} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 flex items-center gap-1 shadow-sm">
                                <Bot size={12}/> محادثة جديدة
                            </button>
                        </div>
                        <div className="space-y-2">
                            {sessions.length === 0 ? <p className="text-center text-gray-400 text-sm mt-10">لا يوجد سجل.</p> : sessions.map(s => (
                                <div key={s.id} onClick={() => loadSession(s)} className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm transition flex justify-between items-center group ${currentSessionId === s.id ? 'bg-indigo-50 border-indigo-200 dark:bg-slate-800 dark:border-indigo-900' : 'bg-white border-gray-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                                    <div className="truncate flex-1">
                                        <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate">{s.title || "بدون عنوان"}</p>
                                        <span className="text-[10px] text-gray-500">{s.date} • {s.contextType || "General"}</span>
                                    </div>
                                    <button onClick={(e) => handleDeleteSession(s.id, e)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Prompt Variable Modal */}
                {showVariableModal && currentPrompt && (
                    <div className="absolute inset-0 bg-black/50 z-30 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl w-full max-w-sm shadow-2xl border border-indigo-200 dark:border-indigo-900">
                            <h3 className="font-bold text-lg mb-4 text-indigo-700 dark:text-indigo-400">{currentPrompt.name}</h3>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {currentPrompt.variables?.map(v => (
                                    <div key={v.name}>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{v.description}</label>
                                        <input 
                                            value={variableValues[v.name] || ''}
                                            onChange={(e) => setVariableValues(prev => ({...prev, [v.name]: e.target.value}))}
                                            className="w-full p-2 border rounded-lg outline-none focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            placeholder={v.defaultValue}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2 mt-6">
                                <button onClick={handleVariableSubmit} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">إرسال</button>
                                <button onClick={() => { setShowVariableModal(false); setCurrentPrompt(null); }} className="px-4 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700">إلغاء</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-slate-950 custom-scrollbar">
                    {messages.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        
                        const prevMsg = idx > 0 ? messages[idx - 1] : null;
                        const isScriptResult = !isUser && prevMsg?.promptId === 'copilot_generate_script';
                        const isImageResult = !isUser && msg.content.startsWith('IMAGE_RESULT::');
                        const imageUrl = isImageResult ? msg.content.replace('IMAGE_RESULT::', '') : '';

                        return (
                            <div key={msg.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-indigo-600' : 'bg-purple-600'} text-white shadow-sm`}>
                                    {isUser ? <User size={16}/> : <Bot size={16}/>}
                                </div>
                                <div className={`max-w-[85%] space-y-2`}>
                                    <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${isUser ? 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-tr-none' : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-slate-700'}`}>
                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {msg.attachments.map((att, idx) => (
                                                    <div key={idx} className="relative group">
                                                        {att.type === 'image' ? (
                                                            <img src={`data:${att.mimeType};base64,${att.data}`} alt="attachment" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                                                        ) : (
                                                            <div className="h-20 w-20 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                                                                <FileText size={24} className="text-gray-400"/>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {isImageResult ? (
                                            <div className="relative group">
                                                <img src={imageUrl} alt="Generated image" className="rounded-lg max-w-full border dark:border-slate-700 shadow-md" />
                                                <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleDownloadImage(imageUrl)}
                                                        className="bg-white/90 text-gray-800 p-1.5 rounded-lg hover:bg-white shadow text-xs font-bold flex items-center gap-1"
                                                        title="تحميل الصورة"
                                                    >
                                                        <Download size={14}/>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleSendToEditor(imageUrl)}
                                                        className="bg-indigo-600/90 text-white p-1.5 rounded-lg hover:bg-indigo-700 shadow text-xs font-bold flex items-center gap-1"
                                                        title="إرسال إلى المحرر"
                                                    >
                                                        <Wand2 size={14}/> تعديل
                                                    </button>
                                                </div>
                                            </div>
                                        ) : isScriptResult ? (
                                            <ScriptCard text={msg.content} />
                                        ) : (
                                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-gray-400 block px-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {isLoading && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                <Bot size={16} className="text-white animate-pulse"/>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex-shrink-0 transition-all duration-300">
                    
                    {/* Prompt Bar */}
                    {availablePrompts.length > 0 && !isLoading && (
                        <div className="flex gap-2 overflow-x-auto pb-3 custom-scrollbar mb-2">
                            {availablePrompts.map(p => (
                                <button 
                                    key={p.id}
                                    onClick={() => handlePromptClick(p)}
                                    className="flex items-center gap-1 text-[10px] whitespace-nowrap bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-slate-800 dark:text-indigo-300 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full border border-indigo-100 dark:border-slate-700 transition"
                                >
                                    <Sparkles size={10} className="text-purple-500"/> {p.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Attachments Preview */}
                    {attachments.length > 0 && (
                        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                            {attachments.map((att, i) => (
                                <div key={i} className="relative inline-block">
                                    {att.type === 'image' ? (
                                        <img src={`data:${att.mimeType};base64,${att.data}`} className="h-12 w-12 object-cover rounded border" />
                                    ) : (
                                        <div className="h-12 w-12 bg-gray-100 flex items-center justify-center rounded border"><FileText size={16}/></div>
                                    )}
                                    <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm">
                                        <X size={10}/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Input Controls Bar */}
                    <div className="flex justify-between items-center mb-1 px-1">
                        <div className="flex gap-2">
                            {input.length > 0 && (
                                <button 
                                    onClick={() => setInput('')} 
                                    className="text-gray-400 hover:text-red-500 text-[10px] flex items-center gap-1"
                                    title="مسح النص"
                                >
                                    <Eraser size={12}/> مسح
                                </button>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <button 
                                onClick={startNewSession} 
                                className="text-gray-400 hover:text-indigo-600 text-[10px] flex items-center gap-1"
                                title="بدء محادثة جديدة نظيفة"
                            >
                                <Bot size={12}/> محادثة جديدة
                            </button>
                            <button 
                                onClick={() => setIsInputExpanded(!isInputExpanded)} 
                                className="text-gray-400 hover:text-indigo-600 transition"
                                title={isInputExpanded ? "تصغير المساحة" : "تكبير مساحة الكتابة"}
                            >
                                {isInputExpanded ? <ChevronsDown size={14}/> : <ChevronsUp size={14}/>}
                            </button>
                        </div>
                    </div>

                    <div className={`flex items-end gap-2 bg-gray-50 dark:bg-slate-800 p-2 rounded-xl border border-gray-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all ${isInputExpanded ? 'h-64' : 'min-h-[50px]'}`}>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileUpload} 
                            accept="image/*,text/plain,.md,.csv,.json"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition self-end"
                            title="إرفاق ملف (صورة/نص)"
                        >
                            <Paperclip size={20}/>
                        </button>
                        
                        <textarea 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}}
                            placeholder="اطلب تحليلاً، فكرة فيديو، أو مساعدة... (جرب: 'ارسم قطة')"
                            className="flex-1 bg-transparent border-none outline-none resize-none text-sm py-2 dark:text-white h-full custom-scrollbar"
                            style={{ maxHeight: isInputExpanded ? '100%' : '120px' }}
                        />
                        
                        <button 
                            onClick={() => handleSendMessage()} 
                            disabled={isLoading || (!input.trim() && attachments.length === 0)}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm self-end"
                        >
                            <Send size={18}/>
                        </button>
                    </div>
                    
                    <p className="text-[10px] text-gray-400 text-center mt-2">
                        الـ Copilot يرى ما تراه. السياق الحالي: <span className="font-bold text-indigo-500">{contextData?.type || "General"}</span>
                    </p>
                </div>
            </div>
        </>
    );
};

export default Copilot;