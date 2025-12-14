
import React, { useState, useEffect, useRef } from 'react';
import { VideoData, OptimizationResult, ChannelProfile, ScoredHook, TextObject, CommentInsight, RepurposedContent } from '../types';
import { optimizeVideoMetadata, generateThumbnailVariations, generateThumbnailHooks, evaluateMetadata, generateTitlesOnly, generateDescriptionOnly, generateTagsOnly, scoreTagsManually, generateEnhancedImagePrompt, analyzeHookRetention, analyzeViewerPersonas, analyzeCommentsGap, repurposeContent, runDeepVideoAudit } from '../services/geminiService';
import { updateVideoDetails, validateChannelToken, fetchVideoCaptions, fetchVideoComments, fetchVideoRealAnalytics } from '../services/youtubeService';
import { CheckCircle, AlertCircle, RefreshCw, BarChart2, Send, ThumbsUp, Eye, XCircle, Activity, AlertTriangle, Wand2, History, Trash, Play, Type, FileText, Hash, Image as ImageIcon, ScanFace, BrainCircuit, Mic, X, Target, Users, MessageSquare, Share2, Copy, ListTodo } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext'; 
import CanvasWorkspace from './optimizer/CanvasWorkspace';
import MetadataEditor from './optimizer/MetadataEditor';
import TranscriptManager from './optimizer/TranscriptManager';

interface VideoOptimizerProps {
  video: VideoData;
  profile: ChannelProfile | null;
  allVideos: VideoData[];
}

interface LogEntry {
    id: string;
    time: string;
    msg: string;
    type: 'success' | 'error' | 'info';
}

interface SavedSession {
    id: string;
    date: string;
    title: string;
    result: OptimizationResult;
    textObjects: TextObject[];
    tags: string[];
    description: string;
    manualTranscript?: string; 
}

const VideoOptimizer: React.FC<VideoOptimizerProps> = ({ video, profile, allVideos }) => {
  const { pendingImageForEditor, setPendingImageForEditor, settings } = useAppContext();
  const [isAutoFetched, setIsAutoFetched] = useState(false); // <--- أضف هذا
  const [loading, setLoading] = useState(false);
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);

  const [result, setResult] = useState<OptimizationResult | null>(null);
  
  // -- Data State --
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagScores, setTagScores] = useState<Record<string, number>>({});
  const [hookLanguage, setHookLanguage] = useState('Arabic');
  const [tagsLanguage, setTagsLanguage] = useState('Arabic');
  const [hooks, setHooks] = useState<ScoredHook[]>([]);
  
  // -- Transcript State --
  const [manualTranscript, setManualTranscript] = useState('');
  const [showTranscriptManager, setShowTranscriptManager] = useState(false); 

  // -- UI/Loading States --
  const [evalScore, setEvalScore] = useState<{score: number, advice: string} | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState({ title: false, desc: false, tags: false, hooks: false });
  const [thumbnailMode, setThumbnailMode] = useState<'normal' | 'composite'>('normal');
  
  // Saving States
  const [savingPart, setSavingPart] = useState<'title' | 'desc' | 'tags' | 'thumbnail' | 'all' | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  
  const [actionLog, setActionLog] = useState<LogEntry[]>([]);
  const [isLogExpanded, setIsLogExpanded] = useState(false); 

  // -- History State --
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // -- Canvas State --
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  
  const [textObjects, setTextObjects] = useState<TextObject[]>([
      { id: 't1', text: "عنوان جذاب\nللفيديو", x: 640, y: 360, fontSize: 80, fontFamily: 'Cairo', color: '#ffffff', strokeColor: '#000000', strokeWidth: 4, shadowColor: 'rgba(0,0,0,0.8)', shadowBlur: 10, highlightWords: [], highlightColor: '#fbbf24', highlightScale: 1.0, lineHeight: 1.2, isDragging: false, opacity: 1, rotation: 0, align: 'center' }
  ]);
  const [selectedTextId, setSelectedTextId] = useState<string>('t1');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // -- Intelligent Tools State --
  const [activeToolTab, setActiveToolTab] = useState<'meta' | 'audit' | 'comments' | 'repurpose'>('meta');
  const [hookAuditLoading, setHookAuditLoading] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [repurposeLoading, setRepurposeLoading] = useState(false);
  const [commentInsights, setCommentInsights] = useState<CommentInsight[]>([]);
  const [repurposedContent, setRepurposedContent] = useState<RepurposedContent | null>(null);

  // -- Deep Audit Specific States --
  const [auditResult, setAuditResult] = useState<any>(null); 
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);

  const draftKey = `draft_optimizer_${video.id}`;
  const historyKey = `history_optimizer_${video.id}`;

  const addLog = (msg: string, type: 'success' | 'error' | 'info') => {
      const entry: LogEntry = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit'}),
          msg,
          type
      };
      setActionLog(prev => [entry, ...prev].slice(0, 10)); 
      if (type !== 'info') {
          setIsLogExpanded(true);
          setTimeout(() => setIsLogExpanded(false), 5000);
      }
  };
  
  useEffect(() => {
    const checkStatus = async () => {
        if (!profile) return;
        const check = await validateChannelToken(profile);
        if (check.status === 'QUOTA') {
            setQuotaExceeded(true);
            addLog(check.msg, 'error');
        } else if (check.status === 'AUTH') {
            addLog(check.msg, 'error');
        }
    };
    checkStatus();
    const savedHist = localStorage.getItem(historyKey);
    if (savedHist) setHistory(JSON.parse(savedHist));
  }, [profile?.id, video.id]);
  // ⬇️⬇️⬇️ أضف الجزء الجديد هنا (بعد الـ Effect الأول وقبل الـ Effect الخاص بالـ Draft) ⬇️⬇️⬇️

  // Effect 2: Auto-Fetch Transcript on Load
  useEffect(() => {
      const autoFetchTranscript = async () => {
          if ((!video.captions || video.captions.length === 0) && !manualTranscript) {
              setIsFetchingTranscript(true); // <--- بدأ التحميل
              addLog("جاري محاولة جلب النص تلقائياً...", "info");
              
              const captions = await fetchVideoCaptions(video.id, profile?.accessToken);
              
              if (captions && captions.length > 0) {
                  const fullText = captions.map(c => c.text).join(' ');
                  setManualTranscript(fullText);
                  setIsAutoFetched(true); // <--- أضف هذا السطر هنا (تم الجلب بنجاح)
                  addLog("✅ تم جلب نص الفيديو بنجاح!", "success");
              }
              setIsFetchingTranscript(false); // <--- انتهى التحميل
          }
      };

      if (video.id) autoFetchTranscript();
  }, [video.id]);

  // ⬆️⬆️⬆️ نهاية الجزء الجديد ⬆️⬆️⬆️
  useEffect(() => {
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
        try {
            const parsed = JSON.parse(savedDraft);
            setTitle(parsed.title || video.title);
            setDescription(parsed.description || video.description || '');
            setTags(parsed.tags || video.tags || []);
            if (parsed.textObjects) setTextObjects(parsed.textObjects);
            if (parsed.manualTranscript) setManualTranscript(parsed.manualTranscript);
            if (parsed.generatedImages) {
                setGeneratedImages(parsed.generatedImages);
                setCurrentImgIdx(0);
            }
            if (parsed.analysisResult) {
                setResult(parsed.analysisResult);
                if (parsed.analysisResult.thumbnailHooks) setHooks(parsed.analysisResult.thumbnailHooks);
            }
        } catch (e) {
            resetToDefault();
        }
    } else {
        resetToDefault();
    }
  }, [video.id]);

  useEffect(() => {
      if (pendingImageForEditor) {
          setGeneratedImages(prev => [pendingImageForEditor, ...prev]);
          setCurrentImgIdx(0); 
          addLog("تم استيراد الصورة من Copilot بنجاح 🎨", "success");
          setPendingImageForEditor(null);
          if (!result) {
               handleInitialImageGen();
          }
      }
  }, [pendingImageForEditor]);

  const resetToDefault = () => {
    setTitle(video.title);
    setDescription(video.description || '');
    setTags(video.tags || []);
    setManualTranscript('');
    setTextObjects([{ id: 't1', text: video.title.substring(0, 20) + "...", x: 640, y: 360, fontSize: 80, fontFamily: 'Cairo', color: '#ffffff', strokeColor: '#000000', strokeWidth: 4, shadowColor: 'rgba(0,0,0,0.8)', shadowBlur: 10, highlightWords: [], highlightColor: '#fbbf24', highlightScale: 1.0, lineHeight: 1.2, isDragging: false, opacity: 1, rotation: 0, align: 'center' }]);
  };

  useEffect(() => {
      const draftData = { title, description, tags, textObjects, generatedImages, analysisResult: result, manualTranscript };
      const timer = setTimeout(() => localStorage.setItem(draftKey, JSON.stringify(draftData)), 1000);
      return () => clearTimeout(timer);
  }, [title, description, tags, textObjects, generatedImages, result, manualTranscript, video.id]);
  
  const saveToHistory = (res: OptimizationResult) => {
      const newSession: SavedSession = { id: Date.now().toString(), date: new Date().toLocaleString(), title: title, result: res, textObjects, tags, description, manualTranscript };
      const updated = [newSession, ...history].slice(0, 5); 
      setHistory(updated);
      localStorage.setItem(historyKey, JSON.stringify(updated));
  };
  
  const restoreSession = (session: SavedSession) => {
      setTitle(session.title); setDescription(session.description); setTags(session.tags); setTextObjects(session.textObjects); setResult(session.result); setHooks(session.result.thumbnailHooks || []); 
      if(session.manualTranscript) setManualTranscript(session.manualTranscript);
      addLog("تم استعادة جلسة تحليل سابقة", "success"); setShowHistory(false);
  };
  
  const deleteHistory = () => { if(window.confirm('هل أنت متأكد من مسح السجل؟')) { setHistory([]); localStorage.removeItem(historyKey); } };

  const getTranscriptText = () => {
      if (manualTranscript && manualTranscript.trim().length > 0) return manualTranscript;
      if (video.captions && video.captions.length > 0) return video.captions.map(c => c.text).join(' ');
      return '';
  };

  const getBenchmarks = () => {
      if (!allVideos || allVideos.length === 0) return { medianViews: 1000, medianEngRate: 0.05 };
      const viewsList = allVideos.map(v => Number(v.viewCount));
      const engList = allVideos.map(v => (Number(v.likeCount) + Number(v.commentCount)) / (Number(v.viewCount) || 1));
      
      const getMedian = (arr: number[]) => {
          if (arr.length === 0) return 0;
          const sorted = [...arr].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };

      return {
          medianViews: getMedian(viewsList) || 1,
          medianEngRate: getMedian(engList) || 0.01
      };
  };

  const runOptimization = async () => {
        if (!profile) return addLog("يرجى اختيار قناة أولاً", "error");
        setLoading(true);
        addLog("جاري بدء التحليل الذكي الشامل...", "info");
        
        try {
            let videoWithContext = { ...video };
            
            if (manualTranscript && manualTranscript.trim().length > 0) {
                videoWithContext.captions = [{ text: manualTranscript, start: 0, duration: 0 }];
                addLog("تم استخدام النص المدخل يدوياً للتحليل.", "success");
            } 
            else if (!video.captions || video.captions.length === 0) {
                if (profile.accessToken) {
                    addLog("محاولة جلب النص التلقائي من يوتيوب...", "info");
                    try {
                        const captions = await fetchVideoCaptions(video.id, profile.accessToken);
                        if (captions && captions.length > 0) {
                            videoWithContext.captions = captions;
                            addLog("تم جلب النص التلقائي بنجاح.", "success");
                        } else {
                            addLog("لم يتم العثور على نص. سيتم التحليل بناءً على العنوان والوصف فقط.", "info");
                            setShowTranscriptManager(true);
                        }
                    } catch (e) {
                        console.warn("Caption fetch failed", e);
                    }
                }
            } else {
                addLog("تم استخدام النص التلقائي الموجود مسبقاً.", "success");
            }

            addLog("جاري تحليل المحتوى...", "info");
            const res = await optimizeVideoMetadata(videoWithContext, allVideos, settings.selectedTextModel, profile?.geminiApiKey, hookLanguage, tagsLanguage);
            
            setResult(res);
            setHooks(res.thumbnailHooks || []);
            
            const scores: Record<string, number> = {};
            res.scoredTags.forEach(t => scores[t.tag.trim().toLowerCase()] = t.score); 
            res.suggestedTags.forEach(t => scores[t.tag.trim().toLowerCase()] = t.score);

            setTagScores(scores);
            saveToHistory(res);
            addLog("تم اكتمال التحليل الشامل بنجاح 🚀", "success");

        } catch (e) { 
            console.error(e); 
            addLog("حدث خطأ أثناء التحليل", "error");
        }
        setLoading(false);
    };

  const handleDeepAudit = async () => {
      setIsAuditing(true);
      addLog("جاري بدء الفحص العميق (Deep Audit)...", "info");
      
      let videoToAnalyze = { ...video };
      const currentTranscript = getTranscriptText();
      
      if (currentTranscript && (!videoToAnalyze.captions || videoToAnalyze.captions.length === 0)) {
          videoToAnalyze.captions = [{ text: currentTranscript, start: 0, duration: 0 }];
      } else if (!currentTranscript) {
          if (profile?.accessToken) {
               addLog("محاولة أخيرة لجلب النص...", "info");
               const captions = await fetchVideoCaptions(video.id, profile.accessToken);
               if (captions) videoToAnalyze.captions = captions;
          }
      }

      if (!getTranscriptText() && (!videoToAnalyze.captions || videoToAnalyze.captions.length === 0)) {
          addLog("تحذير: التحليل سيتم بدون نص الفيديو (أقل دقة).", "info");
      }

      try {
          const benchmarks = getBenchmarks();
          if (profile?.accessToken) {
              const realMetrics = await fetchVideoRealAnalytics(video.id, video.publishedAt, profile.accessToken);
              if (realMetrics) videoToAnalyze = { ...videoToAnalyze, ...realMetrics };
          }

          const audit = await runDeepVideoAudit(videoToAnalyze, benchmarks.medianViews, benchmarks.medianEngRate, settings.selectedTextModel, profile?.geminiApiKey);
          setAuditResult(audit);
          setShowAuditModal(true);
          addLog("تم الانتهاء من الفحص العميق.", "success");
      } catch (e) {
          console.error(e);
          addLog("فشل الفحص العميق.", "error");
      }
      setIsAuditing(false);
  };

  const handleUpdateMeta = (field: 'title' | 'description' | 'tagInput' | 'hookLanguage' | 'tagsLanguage', value: string) => {
      if (field === 'title') setTitle(value);
      if (field === 'description') setDescription(value);
      if (field === 'tagInput') setTagInput(value);
      if (field === 'hookLanguage') setHookLanguage(value);
      if (field === 'tagsLanguage') setTagsLanguage(value);
  };

  const handlePublish = async (parts: { title?: boolean, desc?: boolean, tags?: boolean }, isAll: boolean = false) => {
      if (!profile) return addLog("يرجى اختيار قناة من الإعدادات.", 'error');
      if (quotaExceeded) return addLog("تجاوزت الحد اليومي، لا يمكن التحديث.", "error");
      addLog("جاري إرسال التحديثات لليوتيوب...", "info");
      if (isAll) setSavingPart('all'); else if (parts.title) setSavingPart('title'); else if (parts.desc) setSavingPart('desc'); else if (parts.tags) setSavingPart('tags');
      let thumbnailBase64 = null;
      if (isAll && canvasRef.current) thumbnailBase64 = canvasRef.current.toDataURL('image/png');
      const res = await updateVideoDetails(video, { title: parts.title ? title : (isAll ? title : video.title), description: parts.desc ? description : (isAll ? description : (video.description || "")), tags: parts.tags ? tags : (isAll ? tags : (video.tags || [])), thumbnailBase64 }, profile);
      if (res.success) addLog(res.msg, 'success'); else { addLog(res.msg, 'error'); if (res.errorReason === 'quotaExceeded') setQuotaExceeded(true); }
      setSavingPart(null);
  };
  
  const handleUploadThumbnailOnly = async () => {
      if (!profile || !canvasRef.current) return;
      if (quotaExceeded) return addLog("تجاوزت الحد اليومي.", "error");
      setSavingPart('thumbnail');
      addLog("جاري رفع الصورة المصغرة فقط...", "info");
      const b64 = canvasRef.current.toDataURL('image/png');
      const res = await updateVideoDetails(video, { title: video.title, description: video.description || "", tags: video.tags || [], thumbnailBase64: b64 }, profile);
      if (res.success) addLog("تم تحديث الصورة المصغرة بنجاح!", 'success'); else addLog(res.msg, 'error');
      setSavingPart(null);
  };

  const handleRegen = async (type: 'title' | 'desc' | 'tags' | 'hooks') => {
      if (!profile) return addLog("يرجى اختيار قناة أولاً", "error");
      setLoadingStates(prev => ({ ...prev, [type]: true }));
      if (!result) { setResult({ optimizedTitleSuggestions: [], optimizedDescription: "", scoredTags: [], suggestedTags: [], thumbnailPrompt: "", thumbnailHooks: [], relatedVideos: [] }); }
      try {
          if (type === 'title') { const res = await generateTitlesOnly(title, settings.selectedTextModel, profile?.geminiApiKey); setResult(prev => prev ? { ...prev, optimizedTitleSuggestions: res } : null); }
          else if (type === 'desc') { const res = await generateDescriptionOnly(title, description, settings.selectedTextModel, profile?.geminiApiKey); setResult(prev => prev ? { ...prev, optimizedDescription: res } : null); }
          else if (type === 'tags') { 
              const res = await generateTagsOnly(title, tags, settings.selectedTextModel, profile?.geminiApiKey, tagsLanguage); 
              setResult(prev => prev ? { ...prev, suggestedTags: res.suggestedTags } : null);
              const scores = {...tagScores};
              res.scoredTags.forEach(t => scores[t.tag.trim().toLowerCase()] = t.score);
              res.suggestedTags.forEach(t => scores[t.tag.trim().toLowerCase()] = t.score);
              setTagScores(scores);
          }
          else if (type === 'hooks') { const res = await generateThumbnailHooks(title, hookLanguage, settings.selectedTextModel, profile?.geminiApiKey); setHooks(res); }
          addLog(`تم توليد اقتراحات ${type} بنجاح`, "success");
      } catch (e) { addLog("حدث خطأ أثناء التوليد", "error"); }
      setLoadingStates(prev => ({ ...prev, [type]: false }));
  };

  const handleScoreCurrentTags = async () => {
        if (!profile) return addLog("يرجى اختيار قناة أولاً", "error");
        setLoadingStates(prev => ({ ...prev, tags: true }));
        addLog("جاري تقييم الكلمات الدلالية الحالية...", "info");
        try {
            const scored = await scoreTagsManually(title, tags, settings.selectedTextModel, profile?.geminiApiKey);
            const scores = {...tagScores};
            scored.forEach(t => scores[t.tag.trim().toLowerCase()] = t.score);
            setTagScores(scores);
            addLog("تم تقييم الكلمات الحالية بنجاح", "success");
        } catch (e) { addLog("فشل تقييم الكلمات الدلالية", "error"); }
        setLoadingStates(prev => ({ ...prev, tags: false }));
  };
  
  const handleInitialImageGen = () => {
       if (!result) { setResult({ optimizedTitleSuggestions: [], optimizedDescription: "", scoredTags: [], suggestedTags: [], thumbnailPrompt: video.title + " high quality background", thumbnailHooks: [], relatedVideos: [] }); }
       addLog("تم فتح محرر الصور. اضغط 'توليد AI' للبدء.", "info");
  };

  const handleEvaluate = async () => {
    setEvalLoading(true);
    const res = await evaluateMetadata(title, description, tags, settings.selectedTextModel, profile?.geminiApiKey);
    setEvalScore(res);
    setEvalLoading(false);
  };

  const handleGenerateImage = async (imgSettings?: {prompt: string, neg: string, style: string}) => {
    setGenLoading(true);
    let input;
    if (imgSettings) {
        input = { prompt: imgSettings.prompt, negativePrompt: imgSettings.neg, style: imgSettings.style, context: { title: video.title, description: video.description || "" } };
    } else {
        input = { prompt: video.title, context: { title: video.title, description: video.description || "" }, style: "" };
    }
    const images = await generateThumbnailVariations(input, settings.selectedImageModel, profile?.geminiApiKey);
    if(images.length > 0) { setGeneratedImages(images); setCurrentImgIdx(0); addLog(`تم توليد ${images.length} صور بأنماط مختلفة`, "success"); } else { addLog("فشل توليد الصور، يرجى المحاولة مرة أخرى", "error"); }
    setGenLoading(false);
  };

  const handleEnhancePrompt = async () => {
    try { const enhanced = await generateEnhancedImagePrompt(video.title, video.description || "", settings.selectedTextModel, profile?.geminiApiKey); return enhanced; } 
    catch (e) { addLog("فشل تحسين البرومبت تلقائياً", "error"); return ""; }
  };

  const handleHookAudit = async () => {
      const transcript = getTranscriptText();
      if(!transcript) { addLog("يجب توفر نص الفيديو (Transcript) لهذا التحليل. قم بإضافته يدوياً أعلاه.", "error"); setShowTranscriptManager(true); return; }
      setHookAuditLoading(true);
      try { const audit = await analyzeHookRetention(title, transcript, settings.selectedTextModel, profile?.geminiApiKey); setResult(prev => prev ? { ...prev, hookAudit: audit } : null); addLog("تم تحليل الثواني الذهبية بنجاح", "success"); } catch(e) { addLog("فشل تحليل المقدمة", "error"); }
      setHookAuditLoading(false);
  };

  const handlePersonas = async () => {
      setPersonaLoading(true);
      try { const personas = await analyzeViewerPersonas(title, description, settings.selectedTextModel, profile?.geminiApiKey); setResult(prev => prev ? { ...prev, viewerPersonas: personas } : null); addLog("تم توليد محاكاة الجمهور", "success"); } catch(e) { addLog("فشل تحليل الشخصيات", "error"); }
      setPersonaLoading(false);
  };

  const handleCommentGap = async () => {
      if(!profile) return;
      setCommentsLoading(true);
      addLog("جاري جلب التعليقات من يوتيوب...", "info");
      try { const comments = await fetchVideoComments(video.id, profile.apiKey); if(comments.length === 0) { addLog("لا توجد تعليقات كافية للتحليل", "error"); } else { addLog("جاري تحليل فجوة المحتوى...", "info"); const insights = await analyzeCommentsGap(comments, settings.selectedTextModel, profile.geminiApiKey); setCommentInsights(insights); addLog("تم استخراج أفكار من الجمهور!", "success"); } } catch(e) { addLog("فشل تحليل التعليقات", "error"); }
      setCommentsLoading(false);
  };

  const handleRepurpose = async () => {
      const transcript = getTranscriptText();
      if(!transcript) { addLog("يجب توفر نص الفيديو (Transcript) لإعادة التدوير. قم بإضافته يدوياً أعلاه.", "error"); setShowTranscriptManager(true); return; }
      setRepurposeLoading(true);
      try { const content = await repurposeContent(transcript, settings.selectedTextModel, profile?.geminiApiKey); setRepurposedContent(content); setResult(prev => prev ? { ...prev, repurposedContent: content } : null); addLog("تم إنشاء محتوى للمنصات الأخرى", "success"); } catch(e) { addLog("فشل إعادة تدوير المحتوى", "error"); }
      setRepurposeLoading(false);
  };

  const handleAddRelatedVideos = () => {
      let videosToAdd = result?.relatedVideos || [];
      if (videosToAdd.length === 0 && allVideos && allVideos.length > 0) {
          const candidates = allVideos.filter(v => v.id !== video.id && !v.title.toLowerCase().includes('#shorts')).sort((a, b) => Number(b.viewCount) - Number(a.viewCount));
          videosToAdd = candidates.slice(0, 5).map(v => ({ title: v.title, videoId: v.id, relevanceReason: "فيديو ناجح على القناة" }));
      }
      if (videosToAdd.length === 0) { addLog("لا توجد فيديوهات طويلة مناسبة في القناة لإضافتها", "error"); return; }
      const linksBlock = videosToAdd.map(v => `• ${v.title}\nhttps://youtu.be/${v.videoId}`).join('\n');
      const textToAdd = `\n\n📺 فيديوهات مقترحة:\n${linksBlock}`;
      setDescription(prev => prev + textToAdd);
      addLog(`تم إضافة ${videosToAdd.length} روابط (فيديوهات طويلة) إلى الوصف بنجاح ✅`, "success");
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;
    for (let i = textObjects.length - 1; i >= 0; i--) { const obj = textObjects[i]; const dist = Math.sqrt(Math.pow(mouseX - obj.x, 2) + Math.pow(mouseY - obj.y, 2)); if (dist < 200) { setSelectedTextId(obj.id); setTextObjects(prev => prev.map(t => t.id === obj.id ? { ...t, isDragging: true } : t)); setDragOffset({ x: mouseX - obj.x, y: mouseY - obj.y }); return; } }
    setSelectedTextId('');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const activeObj = textObjects.find(t => t.id === selectedTextId);
    if (!activeObj || !activeObj.isDragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    setTextObjects(prev => prev.map(t => t.id === selectedTextId ? { ...t, x: mouseX - dragOffset.x, y: mouseY - dragOffset.y } : t));
  };
  
  const handleAddTextLayer = (text: string) => { const newId = `t${Date.now()}`; const newObj: TextObject = { id: newId, text: text, x: 640, y: 360, fontSize: 100, fontFamily: 'Cairo', color: '#ffffff', strokeColor: '#000000', strokeWidth: 4, shadowColor: 'rgba(0,0,0,0.8)', shadowBlur: 10, highlightWords: [], highlightColor: '#fbbf24', highlightScale: 1.0, lineHeight: 1.2, isDragging: false, opacity: 1, rotation: 0, align: 'center' }; setTextObjects(prev => [...prev, newObj]); setSelectedTextId(newId); addLog("تمت إضافة عنوان جديد", "success"); };

  return (
    <div className="space-y-6 animate-fade-in pb-32">
        {quotaExceeded && <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 shadow-lg animate-pulse"><AlertTriangle size={48} className="text-red-600"/><div className="flex-1"><h2 className="text-xl font-black text-red-800 mb-2">⛔ تم إيقاف التعديلات مؤقتاً (Quota Exceeded)</h2><p className="text-red-700">لقد استهلكت جميع وحدات YouTube API المتاحة لهذا اليوم.</p></div></div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col xl:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-4 w-full xl:w-auto">
                 <div className="relative group rounded-lg overflow-hidden"><img src={video.thumbnail} alt={video.title} className="w-32 h-20 object-cover" /></div>
                 <div>
                     <h2 className="font-bold text-gray-900 line-clamp-1 max-w-md text-lg">{video.title}</h2>
                     <div className="flex items-center gap-4 text-xs text-gray-500 mt-2 font-medium">
                         <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"><Eye size={12}/> {Number(video.viewCount).toLocaleString()}</span>
                         <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"><ThumbsUp size={12}/> {Number(video.likeCount).toLocaleString()}</span>
                         {history.length > 0 && <div className="relative ml-2"><button onClick={() => setShowHistory(!showHistory)} className="flex items-center gap-1 text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition"><History size={12}/> سجل ({history.length})</button>{showHistory && <div className="absolute top-8 left-0 w-64 bg-white shadow-xl rounded-lg border border-gray-200 z-50 p-2"><div className="flex justify-between items-center mb-2 px-2"><span className="text-xs font-bold text-gray-500">الجلسات</span><button onClick={deleteHistory} className="text-red-400 hover:text-red-600"><Trash size={12}/></button></div>{history.map(s => <button key={s.id} onClick={() => restoreSession(s)} className="w-full text-right text-xs p-2 hover:bg-gray-50 rounded border-b border-gray-50 truncate"><span className="block font-bold text-gray-700">{s.date}</span><span className="text-gray-400">{s.title.substring(0, 20)}...</span></button>)}</div>}</div>}
                     </div>
                 </div>
             </div>
             <div className="flex items-center gap-2 w-full xl:w-auto justify-end flex-wrap">
                <button onClick={() => { localStorage.removeItem(draftKey); addLog("تم مسح المسودة", "info"); setTimeout(() => window.location.reload(), 500); }} className="text-gray-400 hover:text-red-500 p-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50" title="إعادة تعيين"><RefreshCw size={14} /></button>
                {result && <button onClick={handleEvaluate} disabled={evalLoading} className="bg-amber-100 text-amber-800 font-bold px-4 py-2 rounded-xl hover:bg-amber-200 transition flex items-center gap-2 text-xs">{evalLoading ? <RefreshCw className="animate-spin" size={14}/> : <BarChart2 size={14}/>} تقييم الجودة</button>}
                <button onClick={() => handlePublish({}, true)} disabled={savingPart === 'all' || quotaExceeded} className={`font-bold px-5 py-2 rounded-xl shadow-md transition flex items-center gap-2 text-sm ${quotaExceeded ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>{savingPart === 'all' ? <RefreshCw className="animate-spin" size={16}/> : <Send size={16} />} {savingPart === 'all' ? 'جاري النشر...' : 'نشر شامل لليوتيوب'}</button>
             </div>
        </div>

        {evalScore && <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 animate-fade-in"><div className={`text-4xl font-black ${evalScore.score > 80 ? 'text-green-600' : 'text-orange-500'}`}>{evalScore.score}</div><div><h4 className="font-bold text-gray-800 text-sm">تحليل الجودة:</h4><p className="text-sm text-gray-600 leading-tight">{evalScore.advice}</p></div></div>}

        {!result && !loading ? (
            <div className="flex flex-col items-center justify-center py-10 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
                <Wand2 size={48} className="text-indigo-200 mb-6"/>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">اختر نوع التحليل المطلوب</h3>
                <p className="text-gray-500 mb-8 max-w-md text-center">يمكنك إجراء تحليل شامل للفيديو أو اختيار أدوات محددة للسرعة.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl px-6">
                    <div className="md:col-span-2">
                        {/* Transcript Manager is now prominent here */}
                        <TranscriptManager 
                            videoId={video.id} 
                            transcript={manualTranscript} 
                            onTranscriptChange={(val) => { setManualTranscript(val); setIsAutoFetched(false); }}
                            hasApiTranscript={isAutoFetched || (!!video.captions && video.captions.length > 0)}
                            isExpanded={showTranscriptManager}
                            onToggleExpand={() => setShowTranscriptManager(!showTranscriptManager)}
                            isFetching={isFetchingTranscript} // <--- هذه هي الإضافة
                        />
                        <button onClick={runOptimization} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-[1.01] transition flex items-center justify-center gap-3 text-lg border-2 border-transparent"><BrainCircuit size={24} fill="currentColor"/> <div><span className="block">التحليل الشامل العميق (Vision + Transcript)</span><span className="text-xs opacity-80 font-normal">يتحقق من النص أولاً ثم يحلل العنوان، الوصف والصورة</span></div></button>
                    </div>
                    <button onClick={() => handleRegen('title')} className="bg-gray-50 border border-gray-200 p-4 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition text-right group"><div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm mb-3 group-hover:bg-indigo-600 group-hover:text-white transition"><Type size={20} /></div><h4 className="font-bold text-gray-800">تحليل العناوين فقط</h4><p className="text-xs text-gray-500 mt-1">5 عناوين فيرال مع تقييم</p></button>
                    <button onClick={() => handleRegen('desc')} className="bg-gray-50 border border-gray-200 p-4 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition text-right group"><div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm mb-3 group-hover:bg-indigo-600 group-hover:text-white transition"><FileText size={20} /></div><h4 className="font-bold text-gray-800">تحسين الوصف</h4><p className="text-xs text-gray-500 mt-1">وصف SEO احترافي</p></button>
                    <button onClick={() => handleRegen('tags')} className="bg-gray-50 border border-gray-200 p-4 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition text-right group"><div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm mb-3 group-hover:bg-indigo-600 group-hover:text-white transition"><Hash size={20} /></div><h4 className="font-bold text-gray-800">الكلمات الدلالية</h4><p className="text-xs text-gray-500 mt-1">تقييم الحالي + اقتراح الجديد</p></button>
                    <button onClick={handleInitialImageGen} className="bg-gray-50 border border-gray-200 p-4 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition text-right group"><div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center shadow-sm mb-3 group-hover:bg-indigo-600 group-hover:text-white transition"><ImageIcon size={20} /></div><h4 className="font-bold text-gray-800">محرر الصور المصغرة</h4><p className="text-xs text-gray-500 mt-1">توليد خلفيات وتصميم الكتابة</p></button>
                </div>
            </div>
        ) : loading ? (
             <div className="text-center py-24 bg-white rounded-2xl shadow-sm">
                 <div className="relative w-16 h-16 mx-auto mb-6">
                     <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                     <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                     <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={24}/>
                 </div>
                 <h3 className="text-xl font-bold text-gray-800 animate-pulse">جاري التحليل المعمق...</h3>
                 <p className="text-gray-500 mt-2 text-sm">يتم الآن فحص النصوص، الصور، والبيانات لتقديم أفضل الاقتراحات</p>
             </div>
        ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-6">
                    {/* Transcript Manager is always available at top */}
                    <TranscriptManager 
                        videoId={video.id} 
                        transcript={manualTranscript} 
                        onTranscriptChange={setManualTranscript} 
                        hasApiTranscript={!!video.captions && video.captions.length > 0} 
                        isExpanded={showTranscriptManager}
                        onToggleExpand={() => setShowTranscriptManager(!showTranscriptManager)}
                        isFetching={isFetchingTranscript} // <--- هذه هي الإضافة

                    />

                    {/* Tool Selector Tabs */}
                    <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setActiveToolTab('meta')} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${activeToolTab === 'meta' ? 'bg-white text-indigo-700 shadow' : 'text-gray-500 hover:bg-gray-200'}`}>الميتاداتا</button>
                        <button onClick={() => setActiveToolTab('audit')} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${activeToolTab === 'audit' ? 'bg-white text-green-700 shadow' : 'text-gray-500 hover:bg-gray-200'}`}>فحص المحتوى</button>
                        <button onClick={() => setActiveToolTab('comments')} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${activeToolTab === 'comments' ? 'bg-white text-amber-700 shadow' : 'text-gray-500 hover:bg-gray-200'}`}>الجمهور</button>
                        <button onClick={() => setActiveToolTab('repurpose')} className={`flex-1 py-2 rounded-md text-xs font-bold transition ${activeToolTab === 'repurpose' ? 'bg-white text-purple-700 shadow' : 'text-gray-500 hover:bg-gray-200'}`}>التدوير</button>
                    </div>

                    {/* Metadata Tool */}
                    {activeToolTab === 'meta' && (
                        <>
                            {result?.contentInsights && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm animate-fade-in">
                                    <h4 className="flex items-center gap-2 font-bold text-indigo-900 mb-3 border-b border-blue-200/50 pb-2"><Mic size={18} className="text-indigo-600"/> رؤى المحتوى العميق (Transcript Analysis)</h4>
                                    <div className="space-y-3"><div><span className="text-xs font-bold text-blue-500 uppercase tracking-wider">الملخص الاستراتيجي:</span><p className="text-sm text-indigo-800 leading-relaxed mt-1">{result.contentInsights.summary}</p></div><div className="grid grid-cols-2 gap-4"><div className="bg-white/60 p-2 rounded-lg"><span className="text-[10px] text-gray-500 block">النغمة (Sentiment)</span><span className={`text-sm font-bold ${result.contentInsights.sentiment === 'Positive' ? 'text-green-600' : 'text-gray-700'}`}>{result.contentInsights.sentiment}</span></div><div className="bg-white/60 p-2 rounded-lg"><span className="text-[10px] text-gray-500 block">قوة الخطاف (Hook Score)</span><div className="flex items-center gap-2"><div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{width: `${result.contentInsights.hookEffectiveness}%`}}></div></div><span className="text-xs font-bold">{result.contentInsights.hookEffectiveness}%</span></div></div></div></div>
                                </div>
                            )}
                            <MetadataEditor title={title} description={description} tags={tags} tagInput={tagInput} tagScores={tagScores} result={result} loadingStates={loadingStates} hooks={hooks} hookLanguage={hookLanguage} tagsLanguage={tagsLanguage} onUpdate={handleUpdateMeta} onUpdateTags={setTags} onRegen={handleRegen} onPublishPart={handlePublish} savingPart={savingPart} quotaExceeded={quotaExceeded} onScoreCurrent={handleScoreCurrentTags} onAddRelated={handleAddRelatedVideos} />
                        </>
                    )}

                    {/* Audit Tool */}
                    {activeToolTab === 'audit' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><Target className="text-red-500" size={20}/> تحليل "الثواني الذهبية" (Retention)</h3>
                                {!result?.hookAudit ? (
                                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                                        <p className="text-gray-500 text-sm mb-4">تحليل أول 100 كلمة لمعرفة سبب خروج المشاهدين.</p>
                                        {!getTranscriptText() && <p className="text-red-500 text-xs mb-4 font-bold bg-red-50 inline-block px-3 py-1 rounded-full">⚠️ النص مفقود - استخدم المحرر أعلاه</p>}
                                        <button onClick={handleHookAudit} disabled={hookAuditLoading || !getTranscriptText()} className="bg-red-50 text-red-600 px-6 py-2 rounded-full font-bold hover:bg-red-100 transition flex items-center gap-2 disabled:opacity-50 mx-auto">{hookAuditLoading ? <RefreshCw className="animate-spin" size={16}/> : <Play size={16} fill="currentColor"/>} بدء فحص المقدمة</button>
                                    </div>
                                ) : (
                                    <div className="space-y-4"><div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl"><div className={`relative w-16 h-16 flex items-center justify-center rounded-full border-4 text-xl font-black ${result.hookAudit.score > 80 ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'}`}>{result.hookAudit.score}</div><div><div className="font-bold text-gray-800">{result.hookAudit.verdict}</div><div className="text-sm text-gray-500">الوصول للموضوع: {result.hookAudit.timeToTopic} ثانية</div></div></div><div className="bg-red-50 p-4 rounded-xl border border-red-100"><h4 className="text-xs font-bold text-red-700 mb-1">نصيحة التحسين:</h4><p className="text-sm text-red-800">{result.hookAudit.improvement}</p></div></div>
                                )}
                            </div>
                            
                            {/* Deep Audit Button Area (Re-added here for quick access) */}
                            <div className="bg-gradient-to-r from-violet-100 to-indigo-100 border border-indigo-200 rounded-xl p-6 shadow-sm flex flex-col items-center text-center">
                                <h3 className="text-lg font-bold text-indigo-900 mb-2">الفحص العميق (Deep Audit)</h3>
                                <p className="text-sm text-indigo-700 mb-4 max-w-sm">تحليل شامل يدمج البيانات والأداء والمحتوى.</p>
                                <button 
                                    onClick={handleDeepAudit}
                                    disabled={isAuditing}
                                    className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold hover:bg-indigo-700 transition shadow-lg flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isAuditing ? <RefreshCw className="animate-spin" size={18}/> : <BrainCircuit size={18}/>}
                                    تشغيل الفحص الشامل
                                </button>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><Users className="text-blue-500" size={20}/> محاكاة الجمهور</h3>
                                {!result?.viewerPersonas ? (<div className="text-center py-8 bg-gray-50 rounded-lg"><button onClick={handlePersonas} disabled={personaLoading} className="bg-blue-50 text-blue-600 px-6 py-2 rounded-full font-bold hover:bg-blue-100 transition flex items-center gap-2 mx-auto disabled:opacity-50">{personaLoading ? <RefreshCw className="animate-spin" size={16}/> : <ScanFace size={16}/>} تشغيل المحاكاة</button></div>) : (<div className="space-y-3">{result.viewerPersonas.map((p, i) => (<div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex gap-3 items-start"><div className="bg-white p-2 rounded shadow-sm font-bold text-xs w-20 text-center flex-shrink-0">{p.type}</div><div><p className="text-sm text-gray-700">{p.reaction}</p><div className="mt-1 w-full bg-gray-200 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{width: `${p.score}%`}}></div></div></div></div>))}</div>)}
                            </div>
                        </div>
                    )}

                    {/* Comments Tool */}
                    {activeToolTab === 'comments' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-fade-in">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><MessageSquare className="text-amber-500" size={20}/> تحليل فجوة التعليقات</h3>
                            {commentInsights.length === 0 ? (<div className="text-center py-8 bg-amber-50/50 rounded-lg"><button onClick={handleCommentGap} disabled={commentsLoading} className="bg-amber-100 text-amber-700 px-6 py-2 rounded-full font-bold hover:bg-amber-200 transition flex items-center gap-2 mx-auto disabled:opacity-50">{commentsLoading ? <RefreshCw className="animate-spin" size={16}/> : <Target size={16} />} تحليل التعليقات</button></div>) : (<div className="space-y-4">{commentInsights.map((insight, i) => (<div key={i} className="bg-white border border-amber-100 p-4 rounded-xl shadow-sm hover:border-amber-300 transition"><div className="flex justify-between items-start mb-2"><span className="font-bold text-gray-800">{insight.topic}</span><span className={`text-[10px] px-2 py-1 rounded-full ${insight.sentiment === 'Request' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{insight.sentiment}</span></div><p className="text-xs text-gray-500 italic mb-2">"{insight.sampleComment}"</p><div className="flex items-center gap-2 text-[10px] text-amber-600 font-bold"><Activity size={12}/> تكررت {insight.frequency} مرات</div></div>))}</div>)}
                        </div>
                    )}

                    {/* Repurpose Tool */}
                    {activeToolTab === 'repurpose' && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm animate-fade-in">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4"><Share2 className="text-purple-500" size={20}/> إعادة تدوير المحتوى</h3>
                            {!repurposedContent ? (<div className="text-center py-8 bg-purple-50/50 rounded-lg">{!getTranscriptText() && <p className="text-red-500 text-xs mb-4 font-bold bg-red-50 inline-block px-3 py-1 rounded-full">⚠️ النص مفقود - استخدم المحرر أعلاه</p>}<button onClick={handleRepurpose} disabled={repurposeLoading || !getTranscriptText()} className="bg-purple-100 text-purple-700 px-6 py-2 rounded-full font-bold hover:bg-purple-200 transition flex items-center gap-2 disabled:opacity-50 mx-auto">{repurposeLoading ? <RefreshCw className="animate-spin" size={16}/> : <RefreshCw size={16} />} إنشاء محتوى متعدد</button></div>) : (<div className="space-y-6"><div className="bg-white border border-gray-200 rounded-xl p-4"><div className="flex justify-between mb-2"><h4 className="font-bold text-sm">Twitter Thread</h4><button onClick={() => navigator.clipboard.writeText(repurposedContent.twitterThread.join('\n\n'))} className="text-gray-400 hover:text-blue-500"><Copy size={14}/></button></div><div className="space-y-2 text-sm text-gray-600">{repurposedContent.twitterThread.map((t, i) => <div key={i} className="p-2 bg-gray-50 rounded">{t}</div>)}</div></div><div className="bg-white border border-gray-200 rounded-xl p-4"><div className="flex justify-between mb-2"><h4 className="font-bold text-sm">LinkedIn Post</h4><button onClick={() => navigator.clipboard.writeText(repurposedContent.linkedinPost)} className="text-gray-400 hover:text-blue-700"><Copy size={14}/></button></div><p className="text-sm text-gray-600 whitespace-pre-wrap">{repurposedContent.linkedinPost}</p></div><div className="bg-white border border-gray-200 rounded-xl p-4"><div className="flex justify-between mb-2"><h4 className="font-bold text-sm">Shorts Script</h4><button onClick={() => navigator.clipboard.writeText(repurposedContent.shortsScript)} className="text-gray-400 hover:text-red-500"><Copy size={14}/></button></div><p className="text-sm text-gray-600 font-mono whitespace-pre-wrap bg-gray-50 p-2 rounded">{repurposedContent.shortsScript}</p></div></div>)}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {/* Vision Analysis Card */}
                    {result?.thumbnailAnalysis && (
                        <div className="bg-gray-800 text-white rounded-xl p-5 shadow-lg border border-gray-700 animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><ScanFace size={64}/></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4"><div><h4 className="flex items-center gap-2 font-bold text-gray-200"><Eye size={18} className="text-teal-400"/> تحليل الرؤية (Vision AI)</h4><p className="text-xs text-gray-400 mt-1">تقييم الصورة المصغرة الحالية بصرياً</p></div><div className="text-center bg-gray-900/50 p-2 rounded-lg border border-gray-600"><span className="block text-2xl font-black text-teal-400">{result.thumbnailAnalysis.score}</span><span className="text-[10px] text-gray-500 uppercase">Score</span></div></div>
                                <div className="grid grid-cols-2 gap-4 mb-4 text-xs"><div className="bg-gray-700/50 p-2 rounded"><span className="text-gray-400 block mb-1">وضوح النص</span><span className={`font-bold ${result.thumbnailAnalysis.textReadability === 'High' ? 'text-green-400' : 'text-yellow-400'}`}>{result.thumbnailAnalysis.textReadability}</span></div><div className="bg-gray-700/50 p-2 rounded"><span className="text-gray-400 block mb-1">اكتشاف الوجوه</span><span className="font-bold text-white">{result.thumbnailAnalysis.faceDetected ? 'نعم ✅' : 'لا ❌'}</span></div></div>
                                <div className="space-y-3"><div><h5 className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1"><AlertCircle size={10}/> نقاط الضعف:</h5><ul className="list-disc list-inside text-xs text-gray-300 space-y-1">{result.thumbnailAnalysis.critique.map((c, i) => <li key={i}>{c}</li>)}</ul></div><div><h5 className="text-xs font-bold text-green-400 mb-1 flex items-center gap-1"><CheckCircle size={10}/> التحسينات:</h5><ul className="list-disc list-inside text-xs text-gray-300 space-y-1">{result.thumbnailAnalysis.improvements.map((im, i) => <li key={i}>{im}</li>)}</ul></div></div>
                            </div>
                        </div>
                    )}

                    <CanvasWorkspace 
                        canvasRef={canvasRef} textObjects={textObjects} setTextObjects={setTextObjects} selectedTextId={selectedTextId} 
                        generatedImage={generatedImages.length > 0 ? generatedImages[currentImgIdx] : null} genLoading={genLoading}
                        suggestedHooks={hooks} thumbnailMode={thumbnailMode} setThumbnailMode={setThumbnailMode}
                        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setTextObjects(prev => prev.map(t => ({...t, isDragging: false})))}
                        onGenerateImage={handleGenerateImage} onEnhancePrompt={handleEnhancePrompt}
                        onDownloadImage={() => { if(canvasRef.current) { const link = document.createElement('a'); link.download = `thumb-${video.id}.png`; link.href = canvasRef.current.toDataURL(); link.click(); } }}
                        onUploadImageOnly={handleUploadThumbnailOnly} isUploading={savingPart === 'thumbnail'}
                        onSelectText={setSelectedTextId}
                        onUpdateText={(k, v) => setTextObjects(prev => prev.map(t => t.id === selectedTextId ? { ...t, [k]: v } : t))}
                        onToggleHighlight={(w) => { const obj = textObjects.find(t => t.id === selectedTextId); if(obj) { const cw = w.trim().replace(/[.,!؟]/g, ''); const nh = obj.highlightWords.includes(cw) ? obj.highlightWords.filter(x => x!==cw) : [...obj.highlightWords, cw]; setTextObjects(prev => prev.map(t => t.id === selectedTextId ? { ...t, highlightWords: nh } : t)); } }}
                        onAddTextLayer={handleAddTextLayer} hookLanguage={hookLanguage} setHookLanguage={(lang) => handleUpdateMeta('hookLanguage', lang)}
                        onGenerateHooks={() => handleRegen('hooks')} hooksLoading={loadingStates.hooks}
                        imageCount={generatedImages.length} currentImageIndex={currentImgIdx}
                        onNextImage={() => setCurrentImgIdx(prev => (prev + 1) % generatedImages.length)} onPrevImage={() => setCurrentImgIdx(prev => (prev - 1 + generatedImages.length) % generatedImages.length)}
                    />
                </div>
            </div>
        )}
        
        {/* Floating Action Log */}
        <div className={`fixed bottom-4 left-4 z-50 transition-all duration-300 ${isLogExpanded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
            <div className="bg-white/95 backdrop-blur-md border border-gray-200 shadow-2xl rounded-xl w-80 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-100"><h4 className="text-xs font-bold text-gray-700 flex items-center gap-2"><Activity size={14} className="text-indigo-600"/> سجل العمليات ({actionLog.length})</h4><button onClick={() => setIsLogExpanded(false)} className="text-gray-400 hover:text-red-500 transition"><X size={14}/></button></div>
                <div className="max-h-48 overflow-y-auto p-2 space-y-1 custom-scrollbar">{actionLog.map(log => (<div key={log.id} className="flex gap-2 p-2 rounded-lg hover:bg-gray-50 text-[10px] items-start transition animate-fade-in"><span className="text-gray-400 font-mono min-w-[40px] mt-0.5">{log.time}</span><div className="flex-1">{log.type === 'success' && <span className="text-green-600 font-bold block mb-0.5">✅ نجاح</span>}{log.type === 'error' && <span className="text-red-600 font-bold block mb-0.5">❌ خطأ</span>}{log.type === 'info' && <span className="text-blue-600 font-bold block mb-0.5">ℹ️ معلومة</span>}<p className="text-gray-600 leading-tight">{log.msg}</p></div></div>))}</div>
            </div>
        </div>
        {!isLogExpanded && actionLog.length > 0 && (<button onClick={() => setIsLogExpanded(true)} className="fixed bottom-4 left-4 z-40 bg-white p-2.5 rounded-full shadow-lg border border-gray-200 text-gray-500 hover:text-indigo-600 hover:scale-110 transition-all duration-300 group" title="إظهار السجل"><div className="relative"><Activity size={20} /><span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span></div></button>)}

        {/* --- Audit Modal --- */}
      {showAuditModal && auditResult && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* Modal Header */}
                  <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
                      <div>
                          <div className="flex items-center gap-2 mb-2">
                              <span className="bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm">
                                  YouTube Manager Report
                              </span>
                              <span className="text-gray-400 text-xs font-mono">#{video.id.substring(0,8)}</span>
                          </div>
                          <h3 className="text-xl font-bold leading-tight">{video.title}</h3>
                          
                          {/* NEW: Analytics Badges in Header */}
                          {video.analyticsFetched ? (
                             <div className="flex gap-3 mt-3">
                                 <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded border border-green-500/30">
                                     Retention: {video.averageViewPercentage}%
                                 </span>
                                 <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                                     Duration: {video.averageViewDuration}
                                 </span>
                                 <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded border border-yellow-500/30">
                                      CTR: {video.actualCTR}%
                                 </span>
                             </div>
                          ) : (
                             <div className="flex gap-3 mt-3">
                                <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1">
                                    <AlertTriangle size={10}/> تحليل تقديري (Estimates)
                                </span>
                             </div>
                          )}
                      </div>
                      <button onClick={() => setShowAuditModal(false)} className="text-gray-400 hover:text-white transition bg-white/10 p-2 rounded-full hover:bg-white/20">
                          <X size={20}/>
                      </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                      
                      {/* Score & Verdict Section */}
                      <div className="flex flex-col md:flex-row gap-4">
                          <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200 flex items-center gap-4">
                              <div className={`relative w-16 h-16 flex items-center justify-center rounded-full border-4 text-xl font-black shadow-inner ${
                                  auditResult.score >= 80 ? 'border-green-500 text-green-700 bg-green-50' : 
                                  auditResult.score >= 50 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' : 
                                  'border-red-500 text-red-700 bg-red-50'
                              }`}>
                                  {auditResult.score}
                              </div>
                              <div>
                                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">تصنيف القناة</span>
                                  <h4 className={`text-lg font-bold ${
                                      auditResult.level === 'Elite' ? 'text-green-600' : 
                                      auditResult.level === 'Critical' ? 'text-red-600' : 'text-gray-800'
                                  }`}>
                                      {auditResult.level === 'Elite' ? 'محتوى نخبة (Elite)' : 
                                       auditResult.level === 'Healthy' ? 'صحي (Healthy)' : 
                                       auditResult.level === 'Problematic' ? 'به مشاكل (Problematic)' : 'حرج (Critical)'}
                                  </h4>
                              </div>
                          </div>

                          <div className="flex-1 bg-indigo-50 rounded-xl p-4 border border-indigo-100 flex flex-col justify-center">
                              <span className="text-xs font-bold text-indigo-400 uppercase flex items-center gap-1 mb-1"><Activity size={12}/> الحكم النهائي</span>
                              <p className="text-indigo-900 font-bold text-lg">{auditResult.verdict}</p>
                          </div>
                      </div>

                      {/* Deep Analysis Text */}
                      <div className="space-y-2">
                          <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                              <BrainCircuit size={16} className="text-purple-600"/>
                              تحليل الخوارزمية (الما وراء الأرقام):
                          </h4>
                          <p className="text-gray-600 text-sm leading-relaxed bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                              {auditResult.analysis}
                          </p>
                      </div>

                      {/* Psychological Trigger */}
                      <div className="space-y-2">
                           <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                              <Target size={16} className="text-red-500"/>
                              العامل النفسي (The Hook):
                          </h4>
                          <div className="bg-red-50 border border-red-100 p-3 rounded-lg text-red-800 text-sm font-medium flex items-start gap-2">
                              <Target size={14} className="mt-0.5 flex-shrink-0"/>
                              {auditResult.psychologicalTrigger}
                          </div>
                      </div>

                      {/* Action Plan */}
                      <div className="space-y-3">
                          <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                              <ListTodo size={16} className="text-green-600"/>
                              خطة العمل الفورية (3 خطوات):
                          </h4>
                          <div className="space-y-2">
                              {auditResult.actionPlan.map((step: string, i: number) => (
                                  <div key={i} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 transition group cursor-default">
                                      <div className="bg-gray-200 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                                          {i+1}
                                      </div>
                                      <p className="text-gray-700 text-sm font-medium pt-0.5">{step}</p>
                                  </div>
                              ))}
                          </div>
                      </div>

                  </div>

                  {/* Modal Footer */}
                  <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end gap-3">
                      <button onClick={() => setShowAuditModal(false)} className="px-5 py-2 rounded-lg text-gray-600 font-bold hover:bg-gray-200 transition text-sm">
                          إغلاق
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default VideoOptimizer;
