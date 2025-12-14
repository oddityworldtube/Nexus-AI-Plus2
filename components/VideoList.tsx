import React, { useState, useMemo, useEffect } from 'react';
import { VideoData, ChannelStats, DeepAuditResult } from '../types';
import { runDeepVideoAudit } from '../services/geminiService';
import { fetchVideoRealAnalytics, refreshAccessToken, fetchVideoCaptions } from '../services/youtubeService';
import { useAppContext } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { 
  Sparkles, SkipForward, RefreshCw, Filter, 
  ThumbsUp, MessageCircle, Eye, MousePointerClick, 
  Activity, AlertTriangle, CheckCircle2, XCircle, 
  TrendingUp, ArrowRight, Microscope, X, 
  BrainCircuit, Target, ListTodo, FileText
} from 'lucide-react';
import Skeleton from './ui/Skeleton';

interface VideoListProps {
  videos: VideoData[];
  channelStats: ChannelStats | null;
  onLoadMore: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  loading?: boolean;
  onAnalyze: (video: VideoData) => void;
  onRefresh: () => void;
}

type FilterType = 'ALL' | 'SHORTS' | 'LONG';
type SortType = 'DATE' | 'VIEWS' | 'SCORE' | 'ENGAGEMENT';

interface VideoAudit {
    score: number;
    // تم تغيير المسميات لتكون أكثر دقة حسب مصدر البيانات
    primaryMetricStrength: 'HIGH' | 'AVG' | 'LOW'; // CTR (Real) or Reach (Est)
    secondaryMetricStrength: 'HIGH' | 'AVG' | 'LOW'; // Retention (Real) or Engagement (Est)
    verdict: string;
    strengths: string[];
    weaknesses: string[];
    action: string;
    actionType: 'FIX_THUMBNAIL' | 'FIX_CONTENT' | 'REPLICATE' | 'IGNORE';
    isRealData: boolean;
}

const VideoList: React.FC<VideoListProps> = ({ videos: initialVideos, channelStats, onLoadMore, hasMore, loadingMore, loading, onAnalyze, onRefresh }) => {
  const { addToast } = useToast();
  const { profiles, currentProfileId } = useAppContext();
  
  // UI States
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [sortType, setSortType] = useState<SortType>('DATE');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localVideos, setLocalVideos] = useState<VideoData[]>(initialVideos);

  // Sync props to local state - CORRECTED to useEffect
  useEffect(() => {
      setLocalVideos(initialVideos);
  }, [initialVideos]);

  // Deep Audit States
  const [auditLoadingId, setAuditLoadingId] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<DeepAuditResult | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedAuditVideo, setSelectedAuditVideo] = useState<VideoData | null>(null);

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
  };

  const formatNumber = (numStr: string | number) => {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(Number(numStr));
  };

  // --- 1. Calculate Robust Benchmarks (Separated Shorts vs Long) ---
  const benchmarks = useMemo(() => {
    if (localVideos.length === 0) return { 
        long: { medianViews: 0, medianEngRate: 0 }, 
        shorts: { medianViews: 0, medianEngRate: 0 } 
    };
    
    const getMedian = (arr: number[]) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const longVideos = localVideos.filter(v => v.durationSeconds > 60);
    const shortVideos = localVideos.filter(v => v.durationSeconds <= 60);

    const calcStats = (vids: VideoData[]) => {
        const viewsList = vids.map(v => Number(v.viewCount));
        const engList = vids.map(v => (Number(v.likeCount) + Number(v.commentCount)) / (Number(v.viewCount) || 1));
        return {
            medianViews: getMedian(viewsList) || 1,
            medianEngRate: getMedian(engList) || 0.01
        };
    };

    return {
        long: calcStats(longVideos),
        shorts: calcStats(shortVideos)
    };
  }, [localVideos]);

  // --- 2. Local Analysis Engine (Quick Check) ---
  const auditVideo = (video: VideoData): VideoAudit => {
    const isShort = video.durationSeconds <= 60;
    const bench = isShort ? benchmarks.shorts : benchmarks.long;
    
    // Basic Metrics
    const views = Number(video.viewCount);
    const likes = Number(video.likeCount);
    const comments = Number(video.commentCount);
    const engagementRate = (likes + comments) / (views || 1);
    
    // Performance relative to OWN type (Shorts vs Long)
    const viewPerformance = views / (bench.medianViews || 1); 
    const engPerformance = engagementRate / (bench.medianEngRate || 1); 

    let primaryStrength: 'HIGH' | 'AVG' | 'LOW' = 'AVG';
    let secondaryStrength: 'HIGH' | 'AVG' | 'LOW' = 'AVG';
    const isRealData = !!(video.analyticsFetched && video.actualCTR !== undefined && video.actualCTR > 0);

    // --- Determine Metric Strength ---
    if (isRealData) {
        // REAL DATA LOGIC (CTR & Retention)
        // CTR
        if (video.actualCTR! >= 6) primaryStrength = 'HIGH'; // Standard good CTR
        else if (video.actualCTR! <= 2.5) primaryStrength = 'LOW';
        else primaryStrength = 'AVG';

        // Retention (AVD %)
        if (video.averageViewPercentage! > 55) secondaryStrength = 'HIGH';
        else if (video.averageViewPercentage! < 35) secondaryStrength = 'LOW';
        else secondaryStrength = 'AVG';
    } else {
        // ESTIMATED LOGIC (Reach & Engagement)
        // View Velocity (Proxy for Reach/CTR)
        if (viewPerformance > 1.5) primaryStrength = 'HIGH';
        else if (viewPerformance < 0.6) primaryStrength = 'LOW';

        // Engagement Ratio (Proxy for Retention)
        if (engPerformance > 1.4) secondaryStrength = 'HIGH';
        else if (engPerformance < 0.7) secondaryStrength = 'LOW';
    }

    // --- Scoring ---
    let score = (Math.min(viewPerformance, 2) * 40) + (Math.min(engPerformance, 2) * 60);
    if (isRealData && secondaryStrength === 'HIGH') score += 10; // Bonus for real retention
    if (isShort && views > 10000) score += 5; // Viral bonus for shorts
    score = Math.min(Math.round(score), 100); 

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    let verdict = "أداء متوسط";
    let action = "استمر في التحسين";
    let actionType: VideoAudit['actionType'] = 'IGNORE';

    if (primaryStrength === 'HIGH' && secondaryStrength === 'HIGH') {
        verdict = isRealData ? "🌟 فيديو مثالي (Viral)" : "🔥 انتشار واسع وتفاعل قوي";
        strengths.push(isRealData ? "نسبة النقر (CTR) ممتازة" : "انتشار واسع جداً");
        strengths.push("الجمهور مهتم جداً بالمحتوى");
        action = "اصنع جزء ثاني أو فيديو مشابه فوراً!";
        actionType = 'REPLICATE';
        score = Math.max(score, 95);
    } 
    else if (primaryStrength === 'LOW' && secondaryStrength === 'HIGH') {
        verdict = "💎 جوهرة مظلومة (Hidden Gem)";
        strengths.push("جودة المحتوى ممتازة");
        weaknesses.push(isRealData ? "الـ CTR منخفض (العنوان/الصورة)" : "المشاهدات قليلة رغم التفاعل");
        action = isShort ? "حسن الـ Hook في أول 3 ثواني" : "غيّر العنوان والصورة المصغرة فوراً";
        actionType = 'FIX_THUMBNAIL';
    }
    else if (primaryStrength === 'HIGH' && secondaryStrength === 'LOW') {
        verdict = "⚠️ مخادع (Clickbait Risk)";
        strengths.push("نجحت في جذب الانتباه");
        weaknesses.push(isRealData ? "الاحتفاظ بالجمهور منخفض" : "تفاعل ضعيف مقارنة بالمشاهدات");
        action = "حسن جودة المحتوى ليتطابق مع الوعود";
        actionType = 'FIX_CONTENT';
    }
    else {
        verdict = "📉 أداء ضعيف (Underperforming)";
        weaknesses.push("فشل في الجذب والاحتفاظ");
        action = "حلل المنافسين وغير الاستراتيجية";
        actionType = 'IGNORE';
        score = Math.min(score, 40);
    }

    // New Content Flag
    const daysOld = (new Date().getTime() - new Date(video.publishedAt).getTime()) / (1000 * 3600 * 24);
    if (daysOld < 2) {
        verdict = "🆕 جديد (قيد جمع البيانات)";
        strengths.length = 0; weaknesses.length = 0;
        strengths.push("الخوارزمية تختبر الفيديو...");
        score = 50; 
        action = "راقب الأداء خلال 24 ساعة";
    }

    return { 
        score, 
        primaryMetricStrength: primaryStrength, 
        secondaryMetricStrength: secondaryStrength, 
        verdict, 
        strengths, 
        weaknesses, 
        action, 
        actionType,
        isRealData
    };
  };

  // --- 3. Deep Audit Handler (Updated for Transcript) ---
  const handleDeepAudit = async (video: VideoData) => {
      setAuditLoadingId(video.id);
      let videoToAnalyze = { ...video };
      const profile = profiles.find(p => p.id === currentProfileId);
      
      if (!profile) {
          addToast("يرجى اختيار قناة لتفعيل التحليل العميق", "error");
          setAuditLoadingId(null);
          return;
      }

      // 1. Fetch REAL Analytics & Captions if possible
      if (profile.refreshToken) {
          try {
              const token = await refreshAccessToken(profile);
              if (token) {
                   // A. Analytics
                   const realMetrics = await fetchVideoRealAnalytics(video.id, video.publishedAt, token);
                   if (realMetrics) {
                       videoToAnalyze = { ...videoToAnalyze, ...realMetrics };
                       setLocalVideos(prev => prev.map(v => v.id === video.id ? { ...v, ...realMetrics } : v));
                       addToast("تم جلب إحصائيات دقيقة 📊", "success");
                   }

                   // B. Transcript (Critical for Deep Audit)
                   if (!video.captions) {
                       addToast("جاري جلب نص الفيديو لتحليل المحتوى...", "info");
                       const captions = await fetchVideoCaptions(video.id, token);
                       if (captions && captions.length > 0) {
                           videoToAnalyze.captions = captions;
                           // Save to local state so we don't fetch again
                           setLocalVideos(prev => prev.map(v => v.id === video.id ? { ...v, captions } : v));
                       }
                   }
              }
          } catch (e) {
              console.warn("Data fetch skipped", e);
          }
      } else {
          addToast("تنبيه: التحليل يعتمد على التقديرات (سجل الدخول للحصول على دقة 100%)", "warning", undefined, 4000);
      }

      // 2. Select Correct Benchmark based on Duration
      const isShort = videoToAnalyze.durationSeconds <= 60;
      const bench = isShort ? benchmarks.shorts : benchmarks.long;

      // 3. Run Gemini Audit (Wait for service update to handle captions)
      try {
          const result = await runDeepVideoAudit(
              videoToAnalyze, 
              bench.medianViews, 
              bench.medianEngRate
          );
          
          setAuditResult(result);
          setSelectedAuditVideo(videoToAnalyze);
          setShowAuditModal(true);
      } catch (e) {
          console.error(e);
          addToast("فشل في إجراء الفحص العميق.", "error");
      }
      setAuditLoadingId(null);
  };

  const filteredVideos = useMemo(() => {
    let result = [...localVideos];
    if (filterType === 'SHORTS') result = result.filter(v => v.durationSeconds <= 60); // Strict 60s
    else if (filterType === 'LONG') result = result.filter(v => v.durationSeconds > 60);
    
    if (sortType === 'VIEWS') result.sort((a, b) => Number(b.viewCount) - Number(a.viewCount));
    else if (sortType === 'ENGAGEMENT') result.sort((a, b) => {
        const engA = (Number(a.likeCount) + Number(a.commentCount)) / (Number(a.viewCount) || 1);
        const engB = (Number(b.likeCount) + Number(b.commentCount)) / (Number(b.viewCount) || 1);
        return engB - engA;
    });
    else if (sortType === 'SCORE') result.sort((a, b) => auditVideo(b).score - auditVideo(a).score);
    else result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    
    return result;
  }, [localVideos, filterType, sortType, benchmarks]);

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Header Stats (Split View for Accuracy) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Long Form Stats */}
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-indigo-500">
              <div className="flex items-center gap-2 mb-2">
                  <Activity size={18} className="text-indigo-600"/>
                  <h3 className="font-bold text-gray-800">أداء الفيديوهات الطويلة</h3>
              </div>
              <div className="flex justify-between text-sm">
                  <span className="text-gray-500">متوسط المشاهدات: <b className="text-gray-900">{formatNumber(benchmarks.long.medianViews)}</b></span>
                  <span className="text-gray-500">معدل التفاعل: <b className="text-gray-900">{(benchmarks.long.medianEngRate * 100).toFixed(1)}%</b></span>
              </div>
          </div>
          
          {/* Shorts Stats */}
          <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
              <div className="flex items-center gap-2 mb-2">
                  <ZapIcon size={18} className="text-purple-600"/>
                  <h3 className="font-bold text-gray-800">أداء Shorts</h3>
              </div>
              <div className="flex justify-between text-sm">
                  <span className="text-gray-500">متوسط المشاهدات: <b className="text-gray-900">{formatNumber(benchmarks.shorts.medianViews)}</b></span>
                  <span className="text-gray-500">معدل التفاعل: <b className="text-gray-900">{(benchmarks.shorts.medianEngRate * 100).toFixed(1)}%</b></span>
              </div>
          </div>
      </div>

      <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ListTodo size={20} className="text-gray-600"/> 
                قائمة المحتوى ({localVideos.length})
            </h2>
            <button onClick={handleManualRefresh} disabled={isRefreshing || loading} className="flex items-center gap-2 bg-white text-gray-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition border border-gray-200 shadow-sm">
                <RefreshCw size={14} className={isRefreshing || loading ? 'animate-spin' : ''} />
                تحديث البيانات
            </button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm sticky top-0 z-10">
           <div className="flex bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setFilterType('ALL')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${filterType === 'ALL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>الكل</button>
                <button onClick={() => setFilterType('LONG')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${filterType === 'LONG' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>فيديوهات طويلة</button>
                <button onClick={() => setFilterType('SHORTS')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${filterType === 'SHORTS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Shorts</button>
           </div>
           
           <div className="flex items-center gap-2 w-full md:w-auto">
               <span className="text-xs font-bold text-gray-400">ترتيب حسب:</span>
               <select value={sortType} onChange={(e) => setSortType(e.target.value as SortType)} className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-indigo-500 cursor-pointer">
                  <option value="DATE">الأحدث نشراً</option>
                  <option value="VIEWS">الأعلى مشاهدة</option>
                  <option value="ENGAGEMENT">الأعلى تفاعلاً</option>
                  <option value="SCORE">الأفضل أداءً (AI Score)</option>
               </select>
           </div>
      </div>

      {/* Videos List */}
      <div className="grid grid-cols-1 gap-4">
          {loading && localVideos.length === 0 && Array.from({length: 3}).map((_, i) => <Skeleton key={i} variant="card" className="h-40" />)}
          
          {!loading && filteredVideos.map((video) => {
              const audit = auditVideo(video);
              const isAuditing = auditLoadingId === video.id;
              
              const cardBorder = audit.actionType === 'REPLICATE' ? 'border-green-200' : 
                                 audit.actionType === 'FIX_THUMBNAIL' ? 'border-blue-200' : 
                                 audit.actionType === 'FIX_CONTENT' ? 'border-amber-200' : 'border-gray-100';
              
              const cardBg = audit.actionType === 'REPLICATE' ? 'bg-green-50/30' : 
                             audit.actionType === 'FIX_THUMBNAIL' ? 'bg-blue-50/30' : 
                             audit.actionType === 'FIX_CONTENT' ? 'bg-amber-50/30' : 'bg-white';

              return (
                  <div key={video.id} className={`relative bg-white rounded-xl p-4 border-2 transition-all hover:shadow-md flex flex-col md:flex-row gap-6 ${cardBorder} ${cardBg}`}>
                      
                      {/* Thumbnail Section */}
                      <div className="md:w-64 flex-shrink-0 flex flex-col gap-3">
                          <div className="relative group rounded-lg overflow-hidden border border-gray-200">
                              <img src={video.thumbnail} alt={video.title} className="w-full h-36 object-cover" />
                              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  {video.duration?.replace('PT', '').replace('H', ':').replace('M', ':').replace('S', '')}
                              </div>
                              <div className="absolute top-2 left-2">
                                  <span className={`px-2 py-1 rounded-md text-[10px] font-black border shadow-sm ${
                                      audit.score >= 80 ? 'bg-green-100 text-green-700 border-green-200' : 
                                      audit.score >= 50 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 
                                      'bg-red-100 text-red-700 border-red-200'
                                  }`}>
                                      SCORE: {audit.score}
                                  </span>
                              </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-gray-500 px-1">
                              <span>{new Date(video.publishedAt).toLocaleDateString('ar-EG')}</span>
                              <div className="flex gap-2">
                                  <span className="flex items-center gap-1"><Eye size={12}/> {formatNumber(video.viewCount)}</span>
                                  <span className="flex items-center gap-1"><ThumbsUp size={12}/> {formatNumber(video.likeCount)}</span>
                              </div>
                          </div>
                      </div>

                      {/* Content & Stats */}
                      <div className="flex-1 flex flex-col justify-between">
                          <div>
                              <div className="flex items-start justify-between gap-2">
                                  <h3 className="font-bold text-gray-800 text-lg leading-tight mb-3 hover:text-indigo-600">
                                      <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">{video.title}</a>
                                  </h3>
                                  {audit.isRealData ? 
                                      <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-800 px-2 py-1 rounded-full border border-green-200 font-bold whitespace-nowrap"><CheckCircle2 size={10}/> بيانات دقيقة</span> :
                                      <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-full border border-gray-200 font-medium whitespace-nowrap"><AlertTriangle size={10}/> تقديرات</span>
                                  }
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div className="bg-white/60 p-3 rounded-lg border border-gray-100">
                                      {/* Metric 1: CTR vs Reach */}
                                      <div className="flex items-center gap-2 mb-2">
                                          <MousePointerClick size={16} className={audit.primaryMetricStrength === 'HIGH' ? "text-green-500" : audit.primaryMetricStrength === 'LOW' ? "text-red-500" : "text-gray-400"} />
                                          <span className="text-xs font-bold text-gray-600">
                                              {audit.isRealData ? "نسبة النقر (CTR)" : "قوة الانتشار (Reach)"}
                                              {video.actualCTR && <span className="text-[10px] bg-green-100 text-green-800 px-1 rounded ml-1">{video.actualCTR}%</span>}
                                          </span>
                                          <span className={`text-[10px] px-1.5 rounded font-bold ${audit.primaryMetricStrength === 'HIGH' ? 'bg-green-100 text-green-700' : audit.primaryMetricStrength === 'LOW' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                              {audit.primaryMetricStrength === 'HIGH' ? 'ممتاز' : audit.primaryMetricStrength === 'LOW' ? 'ضعيف' : 'متوسط'}
                                          </span>
                                      </div>
                                      
                                      {/* Metric 2: Retention vs Engagement */}
                                      <div className="flex items-center gap-2">
                                          <Activity size={16} className={audit.secondaryMetricStrength === 'HIGH' ? "text-green-500" : audit.secondaryMetricStrength === 'LOW' ? "text-red-500" : "text-gray-400"} />
                                          <span className="text-xs font-bold text-gray-600">
                                              {audit.isRealData ? "الاحتفاظ (Retention)" : "تفاعل الجمهور"}
                                              {video.averageViewPercentage && <span className="text-[10px] bg-green-100 text-green-800 px-1 rounded ml-1">{video.averageViewPercentage}%</span>}
                                          </span>
                                          <span className={`text-[10px] px-1.5 rounded font-bold ${audit.secondaryMetricStrength === 'HIGH' ? 'bg-green-100 text-green-700' : audit.secondaryMetricStrength === 'LOW' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                              {audit.secondaryMetricStrength === 'HIGH' ? 'عالي' : audit.secondaryMetricStrength === 'LOW' ? 'منخفض' : 'متوسط'}
                                          </span>
                                      </div>
                                  </div>

                                  <div className="bg-white/80 p-3 rounded-lg border border-gray-200">
                                      <h4 className="text-xs font-bold text-gray-500 mb-1">التقييم النهائي:</h4>
                                      <p className="font-black text-gray-800 text-sm flex items-center gap-1">
                                          {audit.actionType === 'REPLICATE' && <Sparkles size={14} className="text-green-500"/>}
                                          {audit.actionType === 'FIX_THUMBNAIL' && <AlertTriangle size={14} className="text-blue-500"/>}
                                          {audit.verdict}
                                      </p>
                                      <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{audit.action}</p>
                                  </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                  {audit.strengths.map((s, i) => (
                                      <span key={i} className="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100 flex items-center gap-1">
                                          <CheckCircle2 size={10}/> {s}
                                      </span>
                                  ))}
                                  {audit.weaknesses.map((w, i) => (
                                      <span key={i} className="text-[10px] bg-red-50 text-red-700 px-2 py-1 rounded border border-red-100 flex items-center gap-1">
                                          <XCircle size={10}/> {w}
                                      </span>
                                  ))}
                              </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="mt-4 flex flex-col md:flex-row justify-end gap-2">
                                {/* Basic Action */}
                                <button 
                                    onClick={() => onAnalyze(video)} 
                                    className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition hover:scale-[1.02] flex-1 md:flex-none ${
                                        audit.actionType === 'FIX_THUMBNAIL' ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' :
                                        audit.actionType === 'FIX_CONTENT' ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' :
                                        'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                    }`}
                                >
                                    <Sparkles size={14} /> 
                                    {audit.actionType === 'FIX_THUMBNAIL' ? 'تعديل الصورة/العنوان' : 'فتح الاستوديو'}
                                </button>

                                {/* Deep Audit Action */}
                                <button 
                                    onClick={() => handleDeepAudit(video)}
                                    disabled={isAuditing}
                                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md transition hover:shadow-lg disabled:opacity-70 flex-1 md:flex-none"
                                >
                                    {isAuditing ? <RefreshCw className="animate-spin" size={14}/> : <Microscope size={14}/>}
                                    {isAuditing ? 'جاري الفحص الدقيق...' : 'فحص شامل (Deep Audit)'}
                                </button>
                          </div>
                      </div>
                  </div>
              );
          })}
      </div>
      
      {/* Footer Load More */}
      {hasMore && (
        <div className="flex justify-center mt-8">
            <button onClick={onLoadMore} disabled={loadingMore} className="bg-white border border-gray-300 text-gray-600 px-6 py-2 rounded-full font-bold hover:bg-gray-50 transition shadow-sm disabled:opacity-50 text-xs flex items-center gap-2">
                {loadingMore ? <RefreshCw className="animate-spin" size={14}/> : <SkipForward size={14}/>}
                تحميل 50 فيديو إضافي
            </button>
        </div>
      )}

      {/* --- Audit Modal --- */}
      {showAuditModal && auditResult && selectedAuditVideo && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* Modal Header */}
                  <div className="bg-slate-900 text-white p-6 flex justify-between items-start">
                      <div>
                          <div className="flex items-center gap-2 mb-2">
                              <span className="bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm">
                                  YouTube Manager Report
                              </span>
                              <span className="text-gray-400 text-xs font-mono">#{selectedAuditVideo.id.substring(0,8)}</span>
                          </div>
                          <h3 className="text-xl font-bold leading-tight">{selectedAuditVideo.title}</h3>
                          
                          {/* NEW: Analytics Badges in Header */}
                          {selectedAuditVideo.analyticsFetched ? (
                             <div className="flex gap-3 mt-3">
                                 <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded border border-green-500/30">
                                     Retention: {selectedAuditVideo.averageViewPercentage}%
                                 </span>
                                 <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                                     Duration: {selectedAuditVideo.averageViewDuration}
                                 </span>
                                 <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded border border-yellow-500/30">
                                      CTR: {selectedAuditVideo.actualCTR}%
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

                      {/* Content Check (Did we analyze text?) */}
                      {selectedAuditVideo.captions && (
                         <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-blue-800 text-xs font-medium flex items-center gap-2">
                              <FileText size={14} className="flex-shrink-0"/>
                              تم تضمين نص الفيديو (Transcript) في التحليل للحصول على نصائح دقيقة للمحتوى.
                         </div>
                      )}

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
                              {auditResult.actionPlan.map((step, i) => (
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
                      <button 
                        onClick={() => { setShowAuditModal(false); onAnalyze(selectedAuditVideo); }} 
                        className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition text-sm flex items-center gap-2 shadow-md hover:shadow-lg"
                      >
                          <Sparkles size={16}/> تنفيذ الإصلاحات الآن
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

// Simple Zap Icon component if not in Lucide (sometimes it's missing in older versions, but included here for safety)
const ZapIcon = ({ size, className }: { size: number, className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
);

export default VideoList;