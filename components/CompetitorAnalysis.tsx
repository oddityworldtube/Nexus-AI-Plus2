
import React, { useState, useEffect } from 'react';
import { ChannelStats, ChannelProfile, CompetitorData, CompetitorAnalysisResult, SavedCompetitor, VideoData } from '../types';
import { fetchCompetitorData, searchRelevantChannels, fetchTopChannelVideos, fetchRecentVideos } from '../services/youtubeService';
import { analyzeCompetitors, analyzeChannelNiches } from '../services/geminiService';
import { Search, Users, Video, Eye, TrendingUp, Zap, Target, ShieldAlert, Award, ArrowRight, Lightbulb, Copy, CheckSquare, Square, Star, Trash2, RefreshCw, History, ExternalLink, Globe, PlayCircle, Clock, BarChart } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import Skeleton from './ui/Skeleton';
import * as db from '../services/dbService';
import { useAppContext } from '../contexts/AppContext';

interface CompetitorAnalysisProps {
  myStats: ChannelStats;
  profile: ChannelProfile;
}

const CompetitorAnalysis: React.FC<CompetitorAnalysisProps> = ({ myStats, profile }) => {
  const { settings } = useAppContext();
  const [input, setInput] = useState('');
  const [competitor, setCompetitor] = useState<CompetitorData | null>(null);
  const [analysis, setAnalysis] = useState<CompetitorAnalysisResult | null>(null);
  const [selectedIdeas, setSelectedIdeas] = useState<number[]>([]);
  
  const [savedCompetitors, setSavedCompetitors] = useState<SavedCompetitor[]>([]);
  const [suggestedCompetitors, setSuggestedCompetitors] = useState<CompetitorData[]>([]);

  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [loadingTopVideos, setLoadingTopVideos] = useState(false);
  const [topVideos, setTopVideos] = useState<VideoData[]>([]);
  
  const { addToast } = useToast();

  useEffect(() => {
      loadSavedCompetitors();
  }, []);

  const loadSavedCompetitors = async () => {
      const saved = await db.getCompetitors();
      setSavedCompetitors(saved);
  };

  const saveCompetitor = async (comp: CompetitorData, analysisResult?: CompetitorAnalysisResult) => {
      const existingIndex = savedCompetitors.findIndex(c => c.channelId === comp.channelId);
      
      const newSaved: SavedCompetitor = {
          id: existingIndex >= 0 ? savedCompetitors[existingIndex].id : Date.now().toString(),
          channelId: comp.channelId,
          title: comp.title,
          thumbnailUrl: comp.thumbnailUrl,
          lastAnalysis: analysisResult,
          lastAnalysisDate: analysisResult ? new Date().toLocaleString() : (existingIndex >= 0 ? savedCompetitors[existingIndex].lastAnalysisDate : undefined),
          stats: comp
      };
      
      await db.saveCompetitor(newSaved);
      
      if (existingIndex >= 0) {
          addToast("تم تحديث بيانات المنافس المحفوظة", "success");
      } else {
          addToast("تمت إضافة المنافس لقائمة المراقبة", "success");
      }
      loadSavedCompetitors();
  };

  const removeCompetitor = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await db.deleteCompetitor(id);
      loadSavedCompetitors();
      addToast("تم حذف المنافس", "info");
      // If we are viewing this competitor, clear the view
      if (competitor && savedCompetitors.find(c => c.id === id)?.channelId === competitor.channelId) {
          setCompetitor(null);
          setAnalysis(null);
          setTopVideos([]);
      }
  };

  const loadSavedCompetitor = (saved: SavedCompetitor) => {
      // Load from cache first
      if (saved.stats) setCompetitor(saved.stats);
      else {
          // Fallback if stats weren't cached in old version, treat as basic search
          handleSearch(saved.channelId);
          return;
      }

      if (saved.lastAnalysis) {
          setAnalysis(saved.lastAnalysis);
          setTopVideos([]); // Clear previous video list
          addToast(`تم تحميل التحليل المحفوظ (${saved.lastAnalysisDate})`, "info");
      } else {
          setAnalysis(null);
          setTopVideos([]);
      }
  };

  const handleSearch = async (query?: string) => {
      const searchTerm = query || input.trim();
      if (!searchTerm) return;
      
      setLoadingSearch(true);
      setCompetitor(null);
      setAnalysis(null);
      setTopVideos([]);
      setSelectedIdeas([]);

      const data = await fetchCompetitorData(searchTerm, profile.apiKey);
      
      if (data) {
          setCompetitor(data);
          // Check if we have this saved, if so, load previous analysis
          const saved = savedCompetitors.find(c => c.channelId === data.channelId);
          if (saved && saved.lastAnalysis) {
               setAnalysis(saved.lastAnalysis);
               addToast("تم العثور على تحليل سابق لهذا المنافس", "info");
          } else {
               addToast("تم العثور على القناة المنافسة بنجاح", "success");
          }
      } else {
          addToast("لم يتم العثور على القناة. تأكد من المعرف أو الرابط.", "error");
      }
      setLoadingSearch(false);
  };

  const handleAutoDiscover = async () => {
      setLoadingDiscovery(true);
      try {
          // 1. Get recent videos to analyze niches
          const { videos } = await fetchRecentVideos(profile.channelId, profile.apiKey, undefined, 20);
          if (videos.length === 0) {
              addToast("لا توجد فيديوهات في قناتك لتحليل النيتش.", "warning");
              setLoadingDiscovery(false);
              return;
          }

          // 2. Extract Niches via Gemini
          addToast("جاري تحليل نيتشات قناتك...", "info");
          const niches = await analyzeChannelNiches(videos, settings.selectedTextModel, profile.geminiApiKey);
          
          if (niches.length === 0) {
              addToast("لم يتم تحديد نيتشات واضحة.", "warning");
              setLoadingDiscovery(false);
              return;
          }

          // 3. Search YouTube for these niches
          const primaryNiche = niches[0]; // Use the strongest niche
          addToast(`جاري البحث عن منافسين في نيتش: ${primaryNiche}...`, "info");
          
          const results = await searchRelevantChannels(primaryNiche, profile.apiKey);
          
          // Filter out my own channel
          const filtered = results.filter(c => c.channelId !== profile.channelId);
          
          setSuggestedCompetitors(filtered);
          if (filtered.length > 0) addToast(`تم العثور على ${filtered.length} منافس محتمل!`, "success");
          else addToast("لم يتم العثور على منافسين مشابهين.", "warning");

      } catch (e) {
          console.error(e);
          addToast("حدث خطأ أثناء البحث التلقائي", "error");
      }
      setLoadingDiscovery(false);
  };

  const handleFetchTopVideos = async () => {
      if (!competitor) return;
      setLoadingTopVideos(true);
      try {
          const videos = await fetchTopChannelVideos(competitor.channelId, profile.apiKey);
          setTopVideos(videos);
          addToast("تم جلب أفضل الفيديوهات أداءً", "success");
      } catch (e) {
          addToast("فشل جلب الفيديوهات", "error");
      }
      setLoadingTopVideos(false);
  };

  const handleAnalyze = async (forceRefresh: boolean = false) => {
      if (!competitor) return;
      
      setLoadingAnalysis(true);
      try {
          const result = await analyzeCompetitors(myStats, competitor, settings.selectedTextModel, profile.geminiApiKey);
          setAnalysis(result);
          
          const isSaved = savedCompetitors.some(c => c.channelId === competitor.channelId);
          if (isSaved) {
              await saveCompetitor(competitor, result);
          }
          
          addToast(forceRefresh ? "تم تحديث التحليل بنجاح" : "تم استخراج التقرير الاستراتيجي", "success");
      } catch (e) {
          addToast("حدث خطأ أثناء تحليل الذكاء الاصطناعي", "error");
      }
      setLoadingAnalysis(false);
  };

  const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      addToast("تم نسخ النص بنجاح", "success");
  };

  const handleCopySelected = () => {
      if (!analysis?.competitorContentIdeas) return;
      const textToCopy = selectedIdeas
        .map(i => `${analysis.competitorContentIdeas[i].title} : ${analysis.competitorContentIdeas[i].explanation}`)
        .join('\n');
      handleCopy(textToCopy);
  };

  const handleCopyAll = () => {
      if (!analysis?.competitorContentIdeas) return;
      const textToCopy = analysis.competitorContentIdeas
        .map(idea => `${idea.title} : ${idea.explanation}`)
        .join('\n');
      handleCopy(textToCopy);
  };

  const toggleSelection = (index: number) => {
      if (selectedIdeas.includes(index)) {
          setSelectedIdeas(prev => prev.filter(i => i !== index));
      } else {
          setSelectedIdeas(prev => [...prev, index]);
      }
  };

  const formatNum = (n: string | number) => new Intl.NumberFormat('en-US', { notation: "compact" }).format(Number(n));

  const isCurrentSaved = competitor ? savedCompetitors.some(c => c.channelId === competitor.channelId) : false;

  return (
    <div className="space-y-8 animate-fade-in pb-20">
        
        {/* Header & Dashboard */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl shadow-sm border border-indigo-50 dark:border-slate-800 transition-colors">
            
            {/* Live Watchlist Dashboard (GRID VIEW) */}
            {savedCompetitors.length > 0 && (
                <div className="mb-8">
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4 flex items-center gap-2">
                        <BarChart size={16} className="text-indigo-500"/> لوحة مراقبة المنافسين (Live Watchlist)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {savedCompetitors.map(c => {
                            const lastUploadDate = c.stats?.lastUploadDate ? new Date(c.stats.lastUploadDate) : null;
                            const isRecent = lastUploadDate && (Date.now() - lastUploadDate.getTime()) < (7 * 24 * 60 * 60 * 1000); // 1 week
                            const isActive = competitor?.channelId === c.channelId;

                            return (
                                <div 
                                    key={c.id} 
                                    onClick={() => loadSavedCompetitor(c)}
                                    className={`relative bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border transition cursor-pointer group hover:-translate-y-1 hover:shadow-md ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/50' : 'border-gray-200 dark:border-slate-700'}`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <img src={c.thumbnailUrl} className="w-10 h-10 rounded-full border border-gray-200" alt={c.title}/>
                                        {isRecent && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold animate-pulse">New Video</span>}
                                        <button 
                                            onClick={(e) => removeCompetitor(c.id, e)} 
                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                    <h4 className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate mb-1">{c.title}</h4>
                                    <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                                        <span>{formatNum(c.stats?.subscriberCount || 0)} Subs</span>
                                        <span>{formatNum(c.stats?.viewCount || 0)} Views</span>
                                    </div>
                                    {c.stats?.lastUploadDate && (
                                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-slate-700 flex items-center gap-1 text-[10px] text-gray-400">
                                            <Clock size={10}/> آخر نشر: {new Date(c.stats.lastUploadDate).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {/* Add Button */}
                        <button 
                            onClick={() => document.getElementById('search-box')?.focus()}
                            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                        >
                            <Target size={24} className="mb-2"/>
                            <span className="text-xs font-bold">إضافة منافس</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 dark:text-white mb-2 flex items-center gap-2">
                        <Target className="text-indigo-600" />
                        تحليل الفجوات الاستراتيجي
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-2xl">
                        أدخل معرف القناة المنافسة (Channel ID أو Handle) وسيقوم الذكاء الاصطناعي بمقارنة أدائك معهم واقتراح خطة للتفوق عليهم.
                    </p>
                </div>
                <button 
                    onClick={handleAutoDiscover}
                    disabled={loadingDiscovery}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:shadow-xl transition flex items-center gap-2 text-sm whitespace-nowrap"
                >
                    {loadingDiscovery ? <RefreshCw className="animate-spin" size={16}/> : <Globe size={16}/>}
                    اكتشاف منافسين تلقائياً
                </button>
            </div>

            {/* Discovery Results Area */}
            {suggestedCompetitors.length > 0 && (
                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 animate-fade-in-down">
                    <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2"><Globe size={16}/> منافسين مقترحين حسب مجالك:</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                        {suggestedCompetitors.map(sc => {
                            const isAdded = savedCompetitors.some(saved => saved.channelId === sc.channelId);
                            return (
                                <div key={sc.channelId} className="flex-shrink-0 w-48 bg-white dark:bg-slate-800 p-3 rounded-lg border border-emerald-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center gap-2">
                                    <img src={sc.thumbnailUrl} className="w-10 h-10 rounded-full" alt={sc.title}/>
                                    <div className="w-full">
                                        <p className="font-bold text-xs text-gray-800 dark:text-gray-200 truncate">{sc.title}</p>
                                        <p className="text-[10px] text-gray-500">{formatNum(sc.subscriberCount)} مشترك</p>
                                    </div>
                                    <div className="flex gap-2 w-full mt-1">
                                        <button onClick={() => handleSearch(sc.channelId)} className="flex-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 py-1 rounded text-[10px] font-bold">تحليل</button>
                                        <button 
                                            onClick={() => saveCompetitor(sc)} 
                                            disabled={isAdded}
                                            className={`p-1 rounded ${isAdded ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:text-yellow-500 bg-gray-50'}`}
                                        >
                                            <Star size={14} fill={isAdded ? "currentColor" : "none"}/>
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
                 <div className="flex gap-2 flex-1">
                    <input 
                        id="search-box"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="أدخل معرف القناة (مثال: @MrBeast أو UCy...)"
                        className="flex-1 p-3 border border-gray-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-left font-mono bg-white dark:bg-slate-800 dark:text-white transition-colors"
                        dir="ltr"
                    />
                    <button 
                        onClick={() => handleSearch()}
                        disabled={loadingSearch}
                        className="bg-indigo-600 text-white px-6 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200 dark:shadow-none whitespace-nowrap"
                    >
                        {loadingSearch ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full"></div> : <Search size={20} />}
                        بحث
                    </button>
                 </div>
            </div>
        </div>

        {loadingSearch && <Skeleton variant="card" className="h-48" />}

        {/* Comparison Section */}
        {competitor && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in-up">
                
                {/* My Stats */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors">
                    <div className="absolute top-0 right-0 w-1 h-full bg-blue-500"></div>
                    <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase mb-4">قناتك</h3>
                    <div className="flex items-center gap-4 mb-6">
                        <img src={myStats.thumbnailUrl} className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow" alt="Me"/>
                        <span className="font-bold text-lg dark:text-white">{myStats.title}</span>
                    </div>
                    <div className="space-y-4 dark:text-gray-300">
                        <div className="flex justify-between border-b border-dashed dark:border-slate-700 pb-2">
                            <span className="text-gray-500 dark:text-gray-500 text-sm flex items-center gap-2"><Users size={14}/> المشتركين</span>
                            <span className="font-mono font-bold">{formatNum(myStats.subscriberCount)}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed dark:border-slate-700 pb-2">
                            <span className="text-gray-500 dark:text-gray-500 text-sm flex items-center gap-2"><Eye size={14}/> المشاهدات</span>
                            <span className="font-mono font-bold">{formatNum(myStats.viewCount)}</span>
                        </div>
                    </div>
                </div>

                {/* VS Badge & Actions */}
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="bg-gray-900 dark:bg-white dark:text-gray-900 text-white w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-xl z-10 border-4 border-gray-100 dark:border-slate-800">
                        VS
                    </div>
                    
                    {!analysis && !loadingAnalysis && (
                        <button 
                            onClick={() => handleAnalyze(false)}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition flex items-center gap-2 text-sm whitespace-nowrap"
                        >
                            <Zap size={18}/> تحليل الفرق AI
                        </button>
                    )}

                    {analysis && !loadingAnalysis && (
                        <button 
                            onClick={() => handleAnalyze(true)}
                            className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-slate-700 px-6 py-2.5 rounded-full font-bold hover:bg-indigo-50 dark:hover:bg-slate-700 transition flex items-center gap-2 text-sm shadow-sm"
                        >
                            <RefreshCw size={16}/> إعادة التحليل
                        </button>
                    )}

                    {loadingAnalysis && (
                         <div className="flex flex-col items-center gap-2 text-indigo-600 font-bold text-sm">
                             <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div>
                             <span>جاري الدراسة...</span>
                         </div>
                    )}
                </div>

                {/* Competitor Stats */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm relative overflow-hidden transition-colors">
                     <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase text-left">المنافس</h3>
                        <div className="flex gap-2">
                             <a href={`https://youtube.com/${competitor.customUrl}`} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-red-600" title="فتح القناة"><ExternalLink size={18}/></a>
                             <button 
                                onClick={() => saveCompetitor(competitor, analysis || undefined)} 
                                className="text-gray-400 hover:text-yellow-500 transition" 
                                title={isCurrentSaved ? "تحديث الحفظ" : "حفظ للمراقبة"}
                            >
                                <Star size={18} fill={isCurrentSaved ? "currentColor" : "none"} className={isCurrentSaved ? "text-yellow-500" : ""} />
                            </button>
                        </div>
                     </div>
                    <div className="flex items-center gap-4 mb-6 flex-row-reverse">
                        <img src={competitor.thumbnailUrl} className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow" alt="Them"/>
                        <span className="font-bold text-lg dark:text-white">{competitor.title}</span>
                    </div>
                    <div className="space-y-4 dark:text-gray-300">
                        <div className="flex justify-between border-b border-dashed dark:border-slate-700 pb-2">
                            <span className="font-mono font-bold">{formatNum(competitor.subscriberCount)}</span>
                            <span className="text-gray-500 dark:text-gray-500 text-sm flex items-center gap-2 flex-row-reverse"><Users size={14}/> المشتركين</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed dark:border-slate-700 pb-2">
                            <span className="font-mono font-bold">{formatNum(competitor.viewCount)}</span>
                            <span className="text-gray-500 dark:text-gray-500 text-sm flex items-center gap-2 flex-row-reverse"><Eye size={14}/> المشاهدات</span>
                        </div>
                        <div className="flex justify-between bg-red-50 dark:bg-red-900/20 p-2 rounded cursor-pointer hover:bg-red-100 transition" onClick={handleFetchTopVideos}>
                            {loadingTopVideos ? (
                                <span className="flex items-center gap-2 text-xs font-bold text-red-600"><RefreshCw className="animate-spin" size={12}/> جاري الجلب...</span>
                            ) : (
                                <span className="text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1"><PlayCircle size={14}/> عرض أفضل فيديوهاته</span>
                            )}
                            <span className="text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-1 flex-row-reverse"><TrendingUp size={14}/> أداء المحتوى</span>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Top Videos Section */}
        {topVideos.length > 0 && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 animate-fade-in-up">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="text-red-600"/> الفيديوهات الأكثر مشاهدة (Top Performing)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {topVideos.slice(0, 8).map(v => (
                        <div key={v.id} className="group relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                            <img src={v.thumbnail} className="w-full h-32 object-cover" alt={v.title}/>
                            <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">{formatNum(v.viewCount)} view</div>
                            <div className="p-2 bg-white dark:bg-slate-800">
                                <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 line-clamp-2 mb-2" title={v.title}>{v.title}</h4>
                                <button 
                                    onClick={() => handleCopy(v.title)} 
                                    className="w-full text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 py-1 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center justify-center gap-1"
                                >
                                    <Lightbulb size={10}/> اقتباس الفكرة
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* AI Results Section */}
        {analysis && (
            <div className="space-y-6 animate-fade-in-up">
                {/* Summary Card */}
                <div className="bg-indigo-900 text-white p-8 rounded-2xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                    <div className="flex justify-between items-start relative z-10">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Award className="text-yellow-400" />
                            ملخص المقارنة الاستراتيجي
                        </h3>
                        {isCurrentSaved && (
                             <span className="text-[10px] bg-indigo-800 text-indigo-300 px-2 py-1 rounded border border-indigo-700">
                                 تم الحفظ تلقائياً
                             </span>
                        )}
                    </div>
                    <p className="text-indigo-100 leading-relaxed text-lg relative z-10 max-w-4xl">
                        {analysis.comparisonSummary}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Strengths & Weaknesses */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 transition-colors">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><ShieldAlert size={18} className="text-blue-500"/> نقاط القوة والضعف</h4>
                        <div className="space-y-4">
                            <div>
                                <h5 className="text-xs font-bold text-green-600 uppercase mb-2">نقاط قوتك (تفوقك):</h5>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-900/30">
                                    {analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h5 className="text-xs font-bold text-red-600 uppercase mb-2">نقاط ضعفك (أمامهم):</h5>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                                    {analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Opportunities & Action Plan */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 transition-colors">
                        <h4 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Zap size={18} className="text-yellow-500"/> الفرص وخطة العمل</h4>
                        
                        <div className="mb-4">
                            <h5 className="text-xs font-bold text-purple-600 uppercase mb-2">فرص المحتوى (Gaps):</h5>
                            <div className="flex flex-wrap gap-2">
                                {analysis.opportunities.map((op, i) => (
                                    <span key={i} className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-900/30 font-medium">
                                        ✨ {op}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">خطوات عملية للتفوق:</h5>
                            {analysis.actionableTips.map((tip, i) => (
                                <div key={i} className="flex items-start gap-3 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg group hover:bg-indigo-50 dark:hover:bg-slate-700 transition border border-gray-100 dark:border-slate-700">
                                    <div className="bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i+1}</div>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium group-hover:text-indigo-800 dark:group-hover:text-indigo-300">{tip}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Suggested Content Ideas from Competitor */}
                {analysis.competitorContentIdeas && analysis.competitorContentIdeas.length > 0 && (
                     <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-md border border-indigo-100 dark:border-slate-800 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100 dark:border-slate-800">
                            <div>
                                <h4 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                    <Lightbulb className="text-yellow-500 fill-yellow-500" />
                                    أفكار فيديوهات للتفوق على المنافس
                                </h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">عناوين مقترحة بناءً على تحليل استراتيجية المنافس.</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleCopyAll}
                                    className="flex items-center gap-2 bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-slate-700 transition text-sm"
                                >
                                    <Copy size={16}/> نسخ الكل
                                </button>
                                {selectedIdeas.length > 0 && (
                                    <button 
                                        onClick={handleCopySelected}
                                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition text-sm animate-fade-in"
                                    >
                                        <Copy size={16}/> نسخ المحدد ({selectedIdeas.length})
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {analysis.competitorContentIdeas.map((idea, i) => {
                                const isSelected = selectedIdeas.includes(i);
                                return (
                                    <div 
                                        key={i} 
                                        onClick={() => toggleSelection(i)}
                                        className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-4 group ${
                                            isSelected 
                                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-500' 
                                            : 'border-gray-100 bg-gray-50 dark:bg-slate-800 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="pt-1 text-indigo-600 dark:text-indigo-400">
                                            {isSelected ? <CheckSquare size={20} fill="currentColor" className="text-indigo-100 dark:text-indigo-900" /> : <Square size={20} className="text-gray-400 dark:text-gray-600" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h5 className="font-bold text-gray-900 dark:text-white text-lg mb-1">{idea.title}</h5>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleCopy(`${idea.title} : ${idea.explanation}`); }}
                                                    className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 opacity-0 group-hover:opacity-100 transition"
                                                    title="نسخ هذا العنوان"
                                                >
                                                    <Copy size={16}/>
                                                </button>
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed border-t border-dashed border-gray-200 dark:border-slate-700 pt-2 mt-1">
                                                <span className="font-bold text-gray-400 dark:text-gray-500 ml-1">الشرح:</span> 
                                                {idea.explanation}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                     </div>
                )}
            </div>
        )}
    </div>
  );
};

export default CompetitorAnalysis;
