
import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AlignRight, AlignCenter, AlignLeft, Highlighter, Type, Undo, Redo, Heading1, Heading2, Quote, Sparkles, X, Check, Loader2 } from 'lucide-react';

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    readOnly?: boolean;
    className?: string;
    onRewrite?: (selection: string, instruction: string) => Promise<string>;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, readOnly, className, onRewrite }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    
    // Rewrite Tool States
    const [toolbarPos, setToolbarPos] = useState<{top: number, left: number} | null>(null);
    const [selectedRange, setSelectedRange] = useState<Range | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [isRewriteMode, setIsRewriteMode] = useState(false);
    const [instruction, setInstruction] = useState('');
    const [isRewriting, setIsRewriting] = useState(false);

    // Initialize content & Sync with external updates
    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            // Only update if not focused OR if content is significantly different (e.g. regeneration)
            // This prevents cursor jumping when typing
            const isTyping = document.activeElement === editorRef.current;
            if (!isTyping || Math.abs(editorRef.current.innerText.length - value.length) > 10 || value === "") {
                editorRef.current.innerHTML = value;
            }
        }
    }, [value]);

    const exec = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
            onChange(editorRef.current.innerHTML);
        }
    };

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    // --- Selection & Floating Menu Logic ---
    const handleMouseUp = () => {
        if (readOnly) return;
        
        // Small delay to let selection settle
        setTimeout(() => {
            const selection = window.getSelection();
            
            // Validate selection
            if (!selection || selection.isCollapsed || !editorRef.current) {
                if (!isRewriteMode) setToolbarPos(null);
                return;
            }

            // Check if selection is within our editor
            if (!editorRef.current.contains(selection.anchorNode)) {
                if (!isRewriteMode) setToolbarPos(null);
                return;
            }

            const text = selection.toString().trim();
            if (text.length > 0) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                
                // Save selection state
                setSelectedRange(range.cloneRange());
                setSelectedText(text);
                
                // Position toolbar above selection (Fixed position relative to viewport)
                setToolbarPos({
                    top: rect.top - 50, // 50px above
                    left: rect.left + (rect.width / 2) // Center horizontally
                });
            } else {
                if (!isRewriteMode) setToolbarPos(null);
            }
        }, 10);
    };

    const executeRewrite = async () => {
        if (!onRewrite || !selectedRange || !selectedText) return;
        
        setIsRewriting(true);
        try {
            const newText = await onRewrite(selectedText, instruction || "أعد صياغة هذا النص ليكون أفضل");
            
            if (newText) {
                // Restore range and replace content
                selectedRange.deleteContents();
                const textNode = document.createTextNode(newText);
                selectedRange.insertNode(textNode);
                
                // Normalize and trigger change
                if (editorRef.current) {
                    editorRef.current.normalize(); // Merge text nodes
                    onChange(editorRef.current.innerHTML);
                }
                
                // Reset UI
                setToolbarPos(null);
                setIsRewriteMode(false);
                setInstruction('');
            }
        } catch (e) {
            console.error("Rewrite failed", e);
        } finally {
            setIsRewriting(false);
        }
    };

    const ToolbarButton = ({ icon: Icon, cmd, val, active, title }: any) => (
        <button
            onMouseDown={(e) => { e.preventDefault(); exec(cmd, val); }}
            className={`p-1.5 rounded transition ${active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}
            title={title}
            disabled={readOnly}
        >
            <Icon size={16} />
        </button>
    );

    return (
        <div className={`flex flex-col border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 transition-all relative ${isFocused ? 'ring-2 ring-indigo-500/20 border-indigo-300 dark:border-indigo-700' : ''} ${className}`}>
            
            {/* --- Floating AI Menu --- */}
            {toolbarPos && onRewrite && (
                <div 
                    className="fixed z-50 bg-white dark:bg-slate-800 shadow-xl border border-indigo-100 dark:border-slate-600 rounded-lg p-1.5 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: toolbarPos.top, left: toolbarPos.left, transform: 'translateX(-50%)' }}
                >
                    {!isRewriteMode ? (
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); setIsRewriteMode(true); }} // Prevent losing focus
                            className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 px-2 py-1 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded transition whitespace-nowrap"
                        >
                            <Sparkles size={14} className="fill-indigo-100"/> تحسين بالـ AI
                        </button>
                    ) : (
                        <div className="flex items-center gap-1">
                            <input 
                                autoFocus
                                className="text-xs border border-gray-300 dark:border-slate-600 rounded px-2 py-1 w-48 outline-none focus:border-indigo-500 bg-transparent dark:text-white"
                                placeholder="ما التعديل المطلوب؟ (مثال: اجعله مضحكاً)"
                                value={instruction}
                                onChange={e => setInstruction(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter') executeRewrite(); }}
                            />
                            <button 
                                onClick={executeRewrite} 
                                disabled={isRewriting} 
                                className="bg-indigo-600 text-white p-1 rounded hover:bg-indigo-700 disabled:opacity-50 transition shadow-sm"
                            >
                                {isRewriting ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                            </button>
                            <button 
                                onClick={() => { setIsRewriteMode(false); setToolbarPos(null); }} 
                                className="text-gray-400 hover:text-red-500 p-1 transition"
                            >
                                <X size={14}/>
                            </button>
                        </div>
                    )}
                    
                    {/* Arrow down */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 border-b border-r border-indigo-100 dark:border-slate-600 rotate-45"></div>
                </div>
            )}

            {!readOnly && (
                <div className="flex items-center gap-1 p-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 overflow-x-auto custom-scrollbar">
                    <ToolbarButton icon={Bold} cmd="bold" title="غامق (Bold)" />
                    <ToolbarButton icon={Italic} cmd="italic" title="مائل (Italic)" />
                    <ToolbarButton icon={Underline} cmd="underline" title="تسطير" />
                    <div className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                    <ToolbarButton icon={Heading1} cmd="formatBlock" val="H2" title="عنوان رئيسي" />
                    <ToolbarButton icon={Heading2} cmd="formatBlock" val="H3" title="عنوان فرعي" />
                    <div className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                    <ToolbarButton icon={ListOrdered} cmd="insertOrderedList" title="قائمة رقمية" />
                    <ToolbarButton icon={List} cmd="insertUnorderedList" title="قائمة نقطية" />
                    <ToolbarButton icon={Quote} cmd="formatBlock" val="BLOCKQUOTE" title="اقتباس" />
                    <div className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                    <ToolbarButton icon={AlignRight} cmd="justifyRight" title="يمين" />
                    <ToolbarButton icon={AlignCenter} cmd="justifyCenter" title="وسط" />
                    <ToolbarButton icon={AlignLeft} cmd="justifyLeft" title="يسار" />
                    <div className="w-px h-4 bg-gray-300 dark:bg-slate-700 mx-1"></div>
                    <ToolbarButton icon={Highlighter} cmd="hiliteColor" val="yellow" title="تظليل نص" />
                    <div className="flex-1"></div>
                    <ToolbarButton icon={Undo} cmd="undo" title="تراجع" />
                    <ToolbarButton icon={Redo} cmd="redo" title="إعادة" />
                </div>
            )}
            
            <div 
                ref={editorRef}
                contentEditable={!readOnly}
                onInput={handleInput}
                onMouseUp={handleMouseUp}
                onKeyUp={handleMouseUp} // Also check selection on key up (shift+arrow)
                onFocus={() => setIsFocused(true)}
                onBlur={() => { setIsFocused(false); /* Delay hiding toolbar handled in mouseup logic or let selection clear naturally */ }}
                className={`flex-1 p-4 outline-none overflow-y-auto custom-scrollbar min-h-[300px] prose prose-sm dark:prose-invert max-w-none 
                    prose-headings:font-bold prose-headings:text-indigo-700 dark:prose-headings:text-indigo-400
                    prose-p:leading-relaxed prose-li:marker:text-indigo-500
                    prose-blockquote:border-l-4 prose-blockquote:border-indigo-500 prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-slate-800 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
                `}
                dir="auto"
                style={{ direction: 'rtl', textAlign: 'right' }}
                dangerouslySetInnerHTML={{ __html: value }}
            />
            {(!value && !isFocused) && (
                <div className="absolute top-[60px] right-4 text-gray-400 pointer-events-none text-sm">
                    {placeholder || "ابدأ الكتابة هنا..."}
                </div>
            )}
        </div>
    );
};

export default RichTextEditor;
