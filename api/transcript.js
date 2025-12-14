// api/transcript.js
import { Innertube, UniversalCache } from 'youtubei.js';

export default async function handler(request, response) {
  // 1. إعدادات CORS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const { videoId } = request.query;

  if (!videoId) {
    return response.status(400).json({ error: 'Missing videoId parameter' });
  }

  try {
    // 2. تهيئة Innertube بدون كاش نهائياً (في الذاكرة فقط)
    // هذا يمنع خطأ "Read-only file system" في Vercel
    const youtube = await Innertube.create({
      cache: new UniversalCache(false), 
      generate_session_locally: true,
      retrieve_player: false // تسريع العملية بعدم جلب مشغل الفيديو الكامل
    });

    // 3. جلب المعلومات
    const info = await youtube.getInfo(videoId);

    // 4. محاولة جلب التراجم
    // ملاحظة: getTranscript قد يرمي خطأ إذا لم تتوفر ترجمة، لذا نضعه في try/catch داخلي
    let transcriptData;
    try {
        transcriptData = await info.getTranscript();
    } catch (e) {
        console.warn("Transcript fetch warning:", e.message);
        return response.status(404).json({ error: 'No transcript found for this video', details: e.message });
    }

    // 5. التحقق الآمن من البيانات (Parsing Safety)
    // نستخدم Optional Chaining (?.) لمنع الانهيار (500)
    const initialSegments = transcriptData?.transcript?.content?.body?.initial_segments;

    if (initialSegments) {
        const segments = initialSegments.map(seg => ({
            text: seg.snippet?.text || "",
            start: Number(seg.start_ms) / 1000 || 0,
            duration: (Number(seg.end_ms) - Number(seg.start_ms)) / 1000 || 0
        }));

        return response.status(200).json({ 
            success: true, 
            transcript: segments 
        });
    } else {
        // حالة نادرة: البيانات موجودة لكن الهيكل مختلف
        console.error("Structure mismatch:", JSON.stringify(transcriptData));
        return response.status(422).json({ error: "Transcript structure mismatch", raw: transcriptData });
    }

  } catch (error) {
    console.error('CRITICAL SERVER ERROR:', error);
    
    // إرسال تفاصيل الخطأ للواجهة الأمامية بدلاً من 500 غامضة
    return response.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: error.stack 
    });
  }
}