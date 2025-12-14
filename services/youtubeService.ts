
import { ChannelStats, VideoData, ChannelProfile, CompetitorData, VideoCaption } from '../types';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const ANALYTICS_URL = 'https://youtubeanalytics.googleapis.com/v2/reports';

// --- Helpers ---

const parseDuration = (duration: string | undefined | null): number => {
  if (!duration) return 0;
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return 0;
  const hours = (parseInt(match[1]) || 0);
  const minutes = (parseInt(match[2]) || 0);
  const seconds = (parseInt(match[3]) || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
};

// Helper to convert VTT/SRT time string (00:00:05.500) to seconds
const timeToSeconds = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    let seconds = 0;
    if (parts.length === 3) {
        seconds += parseFloat(parts[0]) * 3600;
        seconds += parseFloat(parts[1]) * 60;
        seconds += parseFloat(parts[2]);
    } else if (parts.length === 2) {
        seconds += parseFloat(parts[0]) * 60;
        seconds += parseFloat(parts[1]);
    }
    return seconds;
};

// Helper to parse WebVTT format content into VideoCaption objects
const parseVTT = (vttText: string): VideoCaption[] => {
    if (!vttText) return [];
    const lines = vttText.split('\n');
    const captions: VideoCaption[] = [];
    let currentStart = 0;
    let currentEnd = 0;
    let currentText = '';
    
    // Regex for VTT timestamp: 00:00:00.000 --> 00:00:00.000
    const timeRegex = /(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3})/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.includes('-->')) {
            const match = timeRegex.exec(line);
            if (match) {
                // If we have previous text accumulated, push it
                if (currentText) {
                    captions.push({
                        text: currentText.trim(),
                        start: currentStart,
                        duration: currentEnd - currentStart
                    });
                    currentText = '';
                }
                currentStart = timeToSeconds(match[1]);
                currentEnd = timeToSeconds(match[2]);
            }
        } else if (line && !line.startsWith('WEBVTT') && isNaN(Number(line))) {
            // It's text content (ignoring "WEBVTT" header and sequence numbers)
            currentText += ' ' + line;
        }
    }

    // Push last entry
    if (currentText) {
        captions.push({
            text: currentText.trim(),
            start: currentStart,
            duration: currentEnd - currentStart
        });
    }

    return captions;
};

// --- Read Operations ---

export const fetchChannelStats = async (channelId: string, apiKey: string): Promise<ChannelStats | null> => {
    try {
        let query = `id=${channelId}`;
        if (channelId.startsWith('@')) query = `forHandle=${channelId}`;
        else if (!channelId.startsWith('UC')) query = `forHandle=@${channelId}`;
        
        // Add cache busting
        const timestamp = new Date().getTime();
        const response = await fetch(`${BASE_URL}/channels?part=snippet,statistics,contentDetails&${query}&key=${apiKey}&_t=${timestamp}`);
        
        const data = await response.json();
        if (!data.items || data.items.length === 0) return null;
        const item = data.items[0];
        return {
            title: item.snippet.title,
            description: item.snippet.description,
            customUrl: item.snippet.customUrl,
            subscriberCount: item.statistics.subscriberCount,
            videoCount: item.statistics.videoCount,
            viewCount: item.statistics.viewCount,
            thumbnailUrl: item.snippet.thumbnails.default.url,
        };
    } catch (error) { return null; }
};

export const fetchRecentVideos = async (channelId: string, apiKey: string, pageToken?: string, maxResults: number = 20): Promise<{ videos: VideoData[], nextPageToken?: string }> => {
  try {
    let query = `id=${channelId}`;
    if (channelId.startsWith('@')) query = `forHandle=${channelId}`;
    const channelRes = await fetch(`${BASE_URL}/channels?part=contentDetails&${query}&key=${apiKey}`);
    const channelData = await channelRes.json();
    if (!channelData.items || channelData.items.length === 0) return { videos: [] };
    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    let playlistUrl = `${BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`;
    if (pageToken) playlistUrl += `&pageToken=${pageToken}`;

    const playlistRes = await fetch(playlistUrl);
    const playlistData = await playlistRes.json();
    if (!playlistData.items) return { videos: [] };

    const nextPageToken = playlistData.nextPageToken;
    const videoIds = playlistData.items.map((item: any) => item.contentDetails.videoId).join(',');

    if (!videoIds) return { videos: [], nextPageToken };

    const videosRes = await fetch(`${BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`);
    const videosData = await videosRes.json();

    // Fix: Ensure items exist before mapping to prevent crashes on Quota error
    if (!videosData.items) {
        console.warn("fetchRecentVideos: No items found in video response", videosData);
        return { videos: [], nextPageToken }; 
    }

    const videos = videosData.items.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
      publishedAt: item.snippet.publishedAt,
      viewCount: item.statistics.viewCount,
      likeCount: item.statistics.likeCount,
      commentCount: item.statistics.commentCount,
      duration: item.contentDetails.duration,
      durationSeconds: parseDuration(item.contentDetails.duration),
      categoryId: item.snippet.categoryId || '22', // Default to Blog if missing
      tags: item.snippet.tags || []
    }));
    return { videos, nextPageToken };
  } catch (error) { 
      console.error("fetchRecentVideos Error:", error);
      return { videos: [] }; 
  }
};

// --- NEW: Fetch Video Comments for Analysis ---
export const fetchVideoComments = async (videoId: string, apiKey: string, maxResults: number = 20): Promise<string[]> => {
    try {
        const response = await fetch(
            `${BASE_URL}/commentThreads?part=snippet&videoId=${videoId}&maxResults=${maxResults}&order=relevance&key=${apiKey}`
        );
        const data = await response.json();
        
        if (!data.items) return [];
        
        return data.items.map((item: any) => 
            item.snippet.topLevelComment.snippet.textDisplay
        );
    } catch (e) {
        console.warn("Fetch Comments Failed", e);
        return [];
    }
};

// --- NEW: Fetch Real Analytics Data ---
// Uses YouTube Analytics API. Needs `yt-analytics.readonly` scope.
export const fetchVideoRealAnalytics = async (videoId: string, publishedAt: string, token: string): Promise<Partial<VideoData> | null> => {
    try {
        const startDate = publishedAt.split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];

        // metrics: avg view %, avg duration, minutes watched, CTR
        const metrics = 'averageViewPercentage,averageViewDuration,estimatedMinutesWatched,impressionClickThroughRate';
        
        const url = `${ANALYTICS_URL}?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=${metrics}&filters=video==${videoId}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            console.warn("Analytics API fetch failed:", response.status);
            return null;
        }

        const data = await response.json();
        
        if (data.rows && data.rows.length > 0) {
            const row = data.rows[0];
            return {
                analyticsFetched: true,
                averageViewPercentage: parseFloat(row[0]),
                averageViewDuration: `${Math.floor(row[1]/60)}:${Math.floor(row[1]%60).toString().padStart(2, '0')}`,
                estimatedMinutesWatched: row[2],
                actualCTR: row[3] ? parseFloat(row[3]) : 0 
            };
        }
        
        return null;

    } catch (e) {
        console.error("Exception fetching analytics:", e);
        return null;
    }
};

// services/youtubeService.ts

// ... (تأكد من وجود Imports و parseVTT كما هي في ملفك)

export const fetchVideoCaptions = async (videoId: string, token?: string): Promise<VideoCaption[] | null> => {
    // ---------------------------------------------------------
    // 1. الطريقة الوحيدة: السيرفر المحلي (Local Proxy / Scraper)
    // هذه الطريقة لا تتطلب تسجيل دخول وتعمل مع معظم الفيديوهات
    // ---------------------------------------------------------
    try {
        console.log(`[Transcript] 🚀 Trying Local Proxy for: ${videoId}`);
        const response = await fetch(`/api/transcript?videoId=${videoId}`);
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.transcript)) {
                console.log(`[Transcript] ✅ Local Proxy Success! Found ${data.transcript.length} lines.`);
                
                return data.transcript.map((item: any) => ({
                    text: item.text,
                    // السيرفر الجديد يرسل start (ثواني)، القديم يرسل offset (مللي ثانية)
                    // هذا السطر يضمن العمل مع الحالتين
                    start: typeof item.start !== 'undefined' ? Number(item.start) : (Number(item.offset) / 1000),
                    duration: typeof item.duration !== 'undefined' ? Number(item.duration) : 0
                }));
            }
        }
    } catch (e) {
        console.warn("[Transcript] ⚠️ Local proxy failed or blocked.", e);
    }

    // تم حذف المحاولة الثانية (Official API) لتقليل الاعتماد على صلاحيات الحساب وتوفير الكوتا

    console.error("[Transcript] Local proxy failed. No transcript available.");
    return null;
};
// --- Lightweight Fetcher for Analysis ---
export const fetchVideoTitlesForAnalysis = async (handleOrId: string, apiKey: string): Promise<{title: string}[]> => {
    try {
        let query = `id=${handleOrId}`;
        if (handleOrId.startsWith('@')) query = `forHandle=${handleOrId}`;
        else if (!handleOrId.startsWith('UC')) query = `forHandle=@${handleOrId}`;

        const channelRes = await fetch(`${BASE_URL}/channels?part=contentDetails&${query}&key=${apiKey}`);
        const channelData = await channelRes.json();
        
        if (!channelData.items || channelData.items.length === 0) return [];
        const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

        const playlistRes = await fetch(`${BASE_URL}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=20&key=${apiKey}`);
        const playlistData = await playlistRes.json();
        
        if (!playlistData.items) return [];

        return playlistData.items.map((item: any) => ({
            title: item.snippet.title
        }));
    } catch (e) {
        console.error(e);
        return [];
    }
};

// --- Competitor Analysis Fetcher ---

export const fetchCompetitorData = async (identifier: string, apiKey: string): Promise<CompetitorData | null> => {
    try {
        // 1. Get Channel Basic Info
        let query = `id=${identifier}`;
        if (identifier.startsWith('@')) query = `forHandle=${identifier}`;
        else if (!identifier.startsWith('UC')) query = `forHandle=@${identifier}`;
        
        const response = await fetch(`${BASE_URL}/channels?part=snippet,statistics,contentDetails&${query}&key=${apiKey}`);
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) return null;
        const item = data.items[0];
        const uploadsId = item.contentDetails.relatedPlaylists.uploads;

        // 2. Calculate Recent Performance (Last 10 videos avg)
        let recentAvg = 0;
        let lastUpload = '';

        if (uploadsId) {
             const playlistRes = await fetch(`${BASE_URL}/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=10&key=${apiKey}`);
             const playlistData = await playlistRes.json();
             
             if (playlistData.items && playlistData.items.length > 0) {
                 const videoIds = playlistData.items.map((v:any) => v.contentDetails.videoId).join(',');
                 const statsRes = await fetch(`${BASE_URL}/videos?part=statistics,snippet&id=${videoIds}&key=${apiKey}`);
                 const statsData = await statsRes.json();
                 
                 if (statsData.items) {
                    const totalViews = statsData.items.reduce((acc: number, v: any) => acc + Number(v.statistics.viewCount), 0);
                    recentAvg = Math.round(totalViews / statsData.items.length);
                    lastUpload = statsData.items[0].snippet.publishedAt;
                 }
             }
        }

        return {
            id: Date.now().toString(), // Temporary internal ID
            channelId: item.id,
            title: item.snippet.title,
            customUrl: item.snippet.customUrl,
            subscriberCount: item.statistics.subscriberCount,
            videoCount: item.statistics.videoCount,
            viewCount: item.statistics.viewCount,
            thumbnailUrl: item.snippet.thumbnails.default.url,
            recentVideoAvgViews: recentAvg,
            lastUploadDate: lastUpload
        };

    } catch (e) {
        console.error("Competitor Fetch Error", e);
        return null;
    }
};

// --- NEW: Competitor Discovery & Top Videos ---

export const searchRelevantChannels = async (query: string, apiKey: string): Promise<CompetitorData[]> => {
    try {
        // 1. Search for channels
        const searchRes = await fetch(`${BASE_URL}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=15&relevanceLanguage=ar&key=${apiKey}`);
        const searchData = await searchRes.json();
        
        if (!searchData.items || searchData.items.length === 0) return [];

        const channelIds = searchData.items.map((item: any) => item.snippet.channelId).join(',');

        // 2. Get detailed stats for these channels
        const statsRes = await fetch(`${BASE_URL}/channels?part=snippet,statistics&id=${channelIds}&key=${apiKey}`);
        const statsData = await statsRes.json();

        if (!statsData.items) return [];

        // 3. Map and Sort by View Count
        const channels: CompetitorData[] = statsData.items.map((item: any) => ({
            id: Date.now().toString() + Math.random(),
            channelId: item.id,
            title: item.snippet.title,
            customUrl: item.snippet.customUrl || item.snippet.title,
            subscriberCount: item.statistics.subscriberCount,
            videoCount: item.statistics.videoCount,
            viewCount: item.statistics.viewCount,
            thumbnailUrl: item.snippet.thumbnails.default.url,
            recentVideoAvgViews: 0, // Placeholder
            lastUploadDate: '' // Placeholder
        }));

        // Filter out small channels (optional) and sort by views desc
        return channels
            .sort((a, b) => Number(b.viewCount) - Number(a.viewCount))
            .slice(0, 10);

    } catch (e) {
        console.error("Search Channels Error", e);
        return [];
    }
};

export const fetchTopChannelVideos = async (channelId: string, apiKey: string): Promise<VideoData[]> => {
    try {
        // Fetch most popular videos
        const res = await fetch(`${BASE_URL}/search?part=snippet&channelId=${channelId}&order=viewCount&maxResults=20&type=video&key=${apiKey}`);
        const data = await res.json();

        if (!data.items) return [];

        const videoIds = data.items.map((item: any) => item.id.videoId).join(',');
        
        // Fetch details to get real view counts
        const videosRes = await fetch(`${BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`);
        const videosData = await videosRes.json();

        if (!videosData.items) return [];

        return videosData.items.map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
            publishedAt: item.snippet.publishedAt,
            viewCount: item.statistics.viewCount,
            likeCount: item.statistics.likeCount,
            commentCount: item.statistics.commentCount,
            duration: item.contentDetails.duration,
            durationSeconds: parseDuration(item.contentDetails.duration),
            categoryId: item.snippet.categoryId,
            tags: item.snippet.tags || []
        }));

    } catch (e) {
        console.error("Fetch Top Videos Error", e);
        return [];
    }
};

// --- OAuth & Write Operations ---

export const refreshAccessToken = async (profile: ChannelProfile): Promise<string | null> => {
  if (!profile.refreshToken || !profile.clientId || !profile.clientSecret) return null;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: profile.clientId,
        client_secret: profile.clientSecret,
        refresh_token: profile.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const data = await response.json();
    if (data.error) {
        console.error("Token Refresh Error:", data);
        return null;
    }
    return data.access_token || null;
  } catch (error) { 
      console.error("Token Refresh Network Error:", error);
      return null; 
  }
};

export const validateChannelToken = async (profile: ChannelProfile): Promise<{ valid: boolean; status: 'OK' | 'QUOTA' | 'AUTH' | 'NET'; msg: string }> => {
    let token = profile.accessToken;
    // 1. Refresh first to ensure we test a valid token
    const newToken = await refreshAccessToken(profile);
    if (!newToken) {
        return { valid: false, status: 'AUTH', msg: 'فشل تجديد التوكن. صلاحيات غير صالحة.' };
    }
    token = newToken;

    try {
        // 2. Make a very cheap call (1 unit cost) - List Channels mine=true
        const response = await fetch(`${BASE_URL}/channels?part=id&mine=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            return { valid: true, status: 'OK', msg: 'الاتصال والحدود سليمة.' };
        }

        const err = await response.json();
        const reason = err.error?.errors?.[0]?.reason;

        if (reason === 'quotaExceeded') {
            return { valid: false, status: 'QUOTA', msg: 'تم تجاوز الحد اليومي (Quota Exceeded).' };
        }
        
        return { valid: false, status: 'AUTH', msg: `خطأ في الصلاحيات: ${reason || err.error?.message}` };

    } catch (e) {
        return { valid: false, status: 'NET', msg: 'خطأ في الشبكة أثناء التحقق.' };
    }
};


// Convert Base64 Data URL to Blob
const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]); 
    let n = bstr.length; 
    const u8arr = new Uint8Array(n);
    // Standard for loop to avoid syntax errors with decrement operator in some environments
    for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], {type:mime});
};

export const uploadCustomThumbnail = async (videoId: string, base64Image: string, token: string): Promise<{ success: boolean; msg: string; errorReason?: string }> => {
    try {
        const blob = dataURLtoBlob(base64Image);
        
        // 1. Check size (YouTube limit is 2MB)
        if (blob.size > 2 * 1024 * 1024) {
             return { success: false, msg: "حجم الصورة أكبر من 2 ميجابايت. يرجى تقليل الجودة أو الأبعاد." };
        }

        const response = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': blob.type,
            },
            body: blob
        });
        
        if (!response.ok) {
            const err = await response.json();
            const reason = err.error?.errors?.[0]?.reason;
            let msg = `فشل رفع الصورة: ${err.error?.message || response.statusText}`;
            
            if (reason === 'quotaExceeded') msg = "⛔ تم تجاوز حد الرفع اليومي (Quota).";
            
            return { success: false, msg: msg, errorReason: reason };
        }
        return { success: true, msg: "Thumbnail updated" };
    } catch (e: any) {
        return { success: false, msg: `خطأ شبكة أثناء رفع الصورة: ${e.message}` };
    }
};

export const updateVideoDetails = async (
  video: VideoData,
  details: { title: string, description: string, tags: string[], thumbnailBase64?: string | null },
  profile: ChannelProfile
): Promise<{ success: boolean; msg: string; errorReason?: string }> => {
  
  let token = profile.accessToken;
  
  // 1. Force Refresh if no token or to be safe
  const newToken = await refreshAccessToken(profile);
  if (newToken) {
      token = newToken;
  } else if (!token) {
      return { success: false, msg: "فشل تجديد رمز الدخول (Token). يرجى التحقق من ملفات التوثيق.", errorReason: 'auth_error' };
  }

  try {
    // 2. Fetch the CURRENT video details to get the REAL Category ID
    const fetchCurrentRes = await fetch(`${BASE_URL}/videos?part=snippet&id=${video.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let realCategoryId = '22'; // Default fallback
    if (fetchCurrentRes.ok) {
        const currentData = await fetchCurrentRes.json();
        if (currentData.items && currentData.items.length > 0) {
            realCategoryId = currentData.items[0].snippet.categoryId;
        }
    }

    // 3. Prepare Payload
    const resource = {
        id: video.id,
        snippet: {
          title: details.title,
          description: details.description,
          tags: details.tags ?? [],
          categoryId: realCategoryId
        }
    };

    // 4. Update Text Metadata
    const response = await fetch(`${BASE_URL}/videos?part=snippet`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resource)
    });
    
    if (!response.ok) {
        const err = await response.json();
        console.error("Youtube API Error Full:", JSON.stringify(err, null, 2));
        
        let errorMsg = err.error?.message || "خطأ غير معروف من يوتيوب";
        const reason = err.error?.errors?.[0]?.reason;

        if (reason === 'quotaExceeded') {
            errorMsg = "⛔ عذراً! تجاوزت الحد اليومي (Quota Exceeded).";
        } else if (err.error?.code === 403) {
             errorMsg = `غير مصرح (403): تأكد من صلاحيات التوكن (Scope).`;
        } else if (err.error?.code === 400) {
             errorMsg = `بيانات غير صالحة (400): قد تكون الكلمات الدلالية تحتوي على رموز ممنوعة.`;
        }
        
        return { success: false, msg: errorMsg, errorReason: reason };
    }

    // 5. Upload Thumbnail (if provided)
    if (details.thumbnailBase64) {
        await new Promise(r => setTimeout(r, 800)); // Safety delay
        const thumbRes = await uploadCustomThumbnail(video.id, details.thumbnailBase64, token!);
        if (!thumbRes.success) {
            return { success: true, msg: `تم تحديث النصوص بنجاح، ولكن فشل رفع الصورة: ${thumbRes.msg}`, errorReason: thumbRes.errorReason };
        }
    }

    return { success: true, msg: "تم نشر التحديثات على يوتيوب بنجاح! 🚀" };

  } catch (e: any) {
    console.error("FATAL EXCEPTION", e);
    return { success: false, msg: `خطأ في الاتصال: ${e.message}` };
  }
};

