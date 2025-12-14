import { Innertube, UniversalCache } from 'youtubei.js';

export default async function handler(request, response) {
  // CORS Headers
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (request.method === 'OPTIONS') return response.status(200).end();

  const { videoId } = request.query;
  if (!videoId) return response.status(400).json({ error: 'Video ID is required' });

  try {
    console.log(`fetching: ${videoId}`);
    
    // 1. إعداد الجلسة
    const yt = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true
    });

    // 2. جلب المعلومات الأساسية للعثور على روابط الترجمة
    const info = await yt.getBasicInfo(videoId);
    const tracks = info.captions?.caption_tracks;

    if (!tracks || tracks.length === 0) {
      return response.status(404).json({ success: false, error: 'No captions found.' });
    }

    console.log(`Found ${tracks.length} tracks.`);

    // 3. اختيار المسار المناسب (عربي > إنجليزي > الأول)
    const selectedTrack = tracks.find(t => t.language_code.includes('ar')) || 
                          tracks.find(t => t.language_code.includes('en')) || 
                          tracks[0];

    // 4. التحميل اليدوي المباشر (تجاوز خطأ المكتبة)
    // الرابط موجود في base_url وهو ملف XML
    const transcriptUrl = selectedTrack.base_url;
    const xmlResponse = await fetch(transcriptUrl);
    const xmlText = await xmlResponse.text();

    // 5. تحويل XML إلى JSON يدوياً (سريع جداً)
    // صيغة الملف تأتي: <text start="0" dur="5">Hello</text>
    const transcript = [];
    const regex = /<text start="([\d.]+)" dur="([\d.]+)">([^<]+)<\/text>/g;
    let match;

    while ((match = regex.exec(xmlText)) !== null) {
        // تنظيف النصوص من رموز HTML مثل &#39;
        const cleanText = match[3]
            .replace(/&amp;#39;/g, "'")
            .replace(/&amp;quot;/g, '"')
            .replace(/&amp;/g, '&')
            .trim();

        transcript.push({
            start: parseFloat(match[1]),
            duration: parseFloat(match[2]),
            text: cleanText
        });
    }

    const fullText = transcript.map(t => t.text).join(' ');

    console.log(`Success! Parsed ${transcript.length} lines.`);

    return response.status(200).json({ 
      success: true, 
      fullText, 
      transcript 
    });

  } catch (error) {
    console.error("Handler Error:", error);
    return response.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}