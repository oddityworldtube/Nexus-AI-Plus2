
import { PromptTemplate } from '../types';

export const DEFAULT_PROMPTS: PromptTemplate[] = [
    {
        id: 'analyze_channel_strategy',
        name: 'تحليل استراتيجية القناة (Senior Strategist)',
        description: 'تحليل شامل لأداء القناة واقتراح استراتيجية تحسين مبنية على البيانات.',
        category: 'Analysis',
        variables: ['channelTitle', 'avgViews', 'videosJson'],
        template: `
You are a Senior YouTube Strategist & Data Scientist.
**Objective:** Analyze the provided channel data to identify patterns, weaknesses, and growth opportunities.

**Input Data:**
- Channel Name: {channelTitle}
- Average Views Baseline: {avgViews}
- Recent Videos Data (JSON): 
{videosJson}

**Analysis Protocol:**
1.  **Identify Outliers:** Find videos performing >2x above baseline. What do they have in common? (Topic, Packaging, Format).
2.  **Identify Dead Ends:** Find videos performing <0.5x below baseline. Why did they fail?
3.  **Gap Analysis:** What topics is the channel missing that are adjacent to the successful ones?

**Output Requirements:**
- Language: **ARABIC** (Professional & Analytical Tone).
- Format: Strictly valid **JSON**.

**JSON Structure:**
{
  "strategy": "Detailed strategic paragraph explaining the current channel state and the 'Pivot' required.",
  "videoSuggestions": "Bullet points of specific actionable advice for the next 5 videos.",
  "overallScore": 0-100 (Integer based on view consistency and packaging quality)
}
`
    },
    {
        id: 'analyze_channel_niches',
        name: 'استخراج وتصنيف النيتشات (Sub-Niches)',
        description: 'تحديد أفضل التخصصات الفرعية الدقيقة من عناوين الفيديوهات.',
        category: 'Analysis',
        variables: ['videoTitles'],
        template: `
You are a YouTube Niche Expert.
**Task:** Analyze these video titles to identify the specific "Micro-Niches" or "Content Pillars" this channel covers.

**Video Titles:**
{videoTitles}

**Rules:**
1. Ignore generic terms (e.g., "vlog", "update").
2. Focus on specific searchable topics (e.g., "Budget Travel", "Python Tutorials", "Keto Diet").
3. Output Language: **ARABIC**.

**Output:**
Return ONLY a valid JSON Array of strings. Example: ["نيتش 1", "نيتش 2"]
`
    },
    {
        id: 'generate_trending_niches',
        name: 'اقتراح نيتشات صاعدة (Trend Hunter)',
        description: 'اقتراح نيتشات صاعدة ومربحة بناءً على الفئة العامة.',
        category: 'Ideas',
        variables: ['category'],
        template: `
Act as a YouTube Trend Analyst.
**Category:** "{category}"

**Task:** Identify 5 EXPLODING sub-niches within this category for 2025.
Focus on topics with High Demand and Low Supply (Blue Ocean).

**Output Requirements:**
- Language: **ARABIC**.
- Format: JSON Array of objects.

**JSON Structure:**
[
  { "name": "Niche Name (Arabic)", "rating": 95 (0-100 potential score) }
]
`
    },
    {
        id: 'shorts_to_long',
        name: 'تحويل Shorts إلى فيديو طويل (Content Bridge)',
        description: 'اقتراح أفكار فيديوهات طويلة بناءً على فيديوهات قصيرة ناجحة.',
        category: 'Ideas',
        variables: ['shortsList'],
        template: `
You are a Content format expert.
**Task:** Convert these successful YouTube Shorts titles into "Deep Dive" Long-form video concepts.

**Shorts Titles:**
{shortsList}

**Strategy:**
A Short is a "Hook". A Long video is "Value/Story". Expand the premise.

**Output Requirements:**
- Language: **ARABIC**.
- Format: JSON Array.

**JSON Structure:**
[
  {
    "shortTitle": "The original short title",
    "longIdeas": [
      "Long Video Title 1 (Deep Dive)",
      "Long Video Title 2 (Case Study)",
      "Long Video Title 3 (Tutorial/Story)"
    ]
  }
]
`
    },
    {
        id: 'optimize_metadata_main',
        name: 'تحسين الميتاداتا الشامل (Viral Engineer)',
        description: 'توليد العناوين، الوصف، الكلمات الدلالية، والهوكس باستخدام علم النفس.',
        category: 'Optimization',
        variables: ['videoTitle', 'videoDesc', 'videoTags', 'channelContext', 'hookLanguage', 'tagsLanguage'],
        template: `
Act as a World-Class YouTube Strategist & Copywriter. Optimize this video for maximum CTR (Click-Through Rate) and AVD (Average View Duration).

**Input Data:**
- Draft Title: {videoTitle}
- Draft Description: {videoDesc}
- Current Tags: {videoTags}
- Channel Context: {channelContext}

**Instructions:**

1.  **Titles (The Click):** Generate 5 viral titles using cognitive biases (Curiosity, Negativity Bias, FOMO, Authority). 
    - *Constraint:* Language MUST be **ARABIC**.
    - *Psychology Analysis:* Explain WHY this title works.

2.  **Description (The SEO & Hook):** Write a description in **ARABIC**.
    - First 2 lines: SEO-heavy hook.
    - Body: Value proposition.
    - CTA: Engagement prompt.

3.  **Tags (The Search):**
    - **"scoredTags"**: Evaluate the "Current Tags" input. Return valid JSON object for EACH tag: { "tag": "EXACT_INPUT_STRING", "score": 0-100 }. *Do not change the text of input tags.*
    - **"suggestedTags"**: Suggest 15 NEW high-volume keywords in **{tagsLanguage}**.

4.  **Thumbnail Hooks (The Glance):** Generate 10 short text overlays (max 4 words) in **{hookLanguage}**.

5.  **Related Videos:** Suggest 5 videos from "Channel Context" to link in the description to increase session time.

**Output Format:**
Strictly return a valid JSON object matching this structure:
{
  "optimizedTitleSuggestions": [
    { 
      "title": "Title String", 
      "score": 95, 
      "psychology": {
        "curiosityScore": 80,
        "urgencyScore": 90,
        "emotionType": "Fear/Joy/Surprise",
        "powerWords": ["Word1", "Word2"],
        "analysis": "Why this works..."
      }
    }
  ],
  "optimizedDescription": "Full description string...",
  "scoredTags": [{ "tag": "input_tag", "score": 50 }],
  "suggestedTags": [{ "tag": "new_tag", "score": 90 }],
  "thumbnailPrompt": "English prompt for image generation...",
  "thumbnailHooks": [{ "hook": "Text Overlay", "score": 85 }],
  "relatedVideos": [{ "title": "Video Title", "videoId": "ID", "relevanceReason": "Why relevant" }]
}
`
    },
    {
        id: 'analyze_thumbnail_vision',
        name: 'تحليل الصورة المصغرة (Vision Critic)',
        description: 'نقد وتحليل الصورة المصغرة بصرياً من منظور خوارزمية الرؤية.',
        category: 'Vision',
        variables: ['videoTitle'],
        template: `
Act as a Design Critic & Vision AI Algorithm.
**Context:** Analyze the provided image which is a YouTube Thumbnail for the video: "{videoTitle}".

**Evaluation Criteria:**
1.  **Clarity:** Is the main subject obvious instantly?
2.  **Text:** Is it readable on mobile?
3.  **Contrast:** Do colors pop against YouTube's white/dark background?
4.  **Faces:** Are emotions clear?

**Output Requirements:**
- Language: **ARABIC**.
- Format: JSON.

**JSON Structure:**
{
  "score": 0-100,
  "critique": ["Point 1", "Point 2"],
  "improvements": ["Fix 1", "Fix 2"],
  "colorProfile": "e.g., Low Contrast / Vibrant",
  "faceDetected": true/false,
  "textReadability": "High/Medium/Low"
}
`
    },
    {
        id: 'analyze_transcript',
        name: 'تحليل نص الفيديو (Content Rhythm)',
        description: 'تحليل الإيقاع، النغمة، وهيكل المحتوى من النص.',
        category: 'Transcript',
        variables: [],
        template: `
Act as a Script Doctor. Analyze this video transcript.

**Analysis Goals:**
1.  **Pacing:** Is the speaker too slow/fast? Are there fluff words?
2.  **Hook:** Does the first 30 seconds grab attention?
3.  **Sentiment:** What is the overall emotional tone?

**Output Requirements:**
- Language: **ARABIC**.
- Format: JSON.

**JSON Structure:**
{
  "summary": "Brief content summary",
  "keyTopics": ["Topic 1", "Topic 2"],
  "sentiment": "Positive/Negative/Neutral",
  "pacingScore": 0-100 (100 is perfect pacing),
  "hookEffectiveness": 0-100
}
`
    },
    {
        id: 'enhanced_image_article',
        name: 'توليد قصة للصورة (Creative Brief)',
        description: 'تحويل العنوان والوصف إلى قصة قصيرة لتوليد الصورة.',
        category: 'Creative',
        variables: ['videoTitle', 'videoDesc'],
        template: `
**Role:** Creative Director.
**Task:** Write a vivid, 200-word short story/scene based on this video concept. This story will inspire a graphic designer.

**Video Title:** "{videoTitle}"
**Context:** "{videoDesc}"

**Instructions:**
- Focus on visual elements (Lighting, Setting, Action).
- Language: **ARABIC**.
`
    },
    {
        id: 'enhanced_image_visual',
        name: 'توليد برومبت بصري (Midjourney/Flux)',
        description: 'تحويل القصة إلى وصف بصري دقيق بالإنجليزية.',
        category: 'Creative',
        variables: ['generatedArticle'],
        template: `
**Role:** Prompt Engineer for AI Art Generators (Midjourney/Flux).
**Input Context:**
{generatedArticle}

**Task:** Create a SINGLE, highly detailed image generation prompt.

**Constraints:**
1.  **NO TEXT:** Strictly enforce "no text, no words, no letters".
2.  **Style:** Cinematic, Hyper-realistic, 8k, Ray Tracing.
3.  **Composition:** Rule of thirds, dynamic angle.

**Output:**
Return ONLY the English prompt string. End with: ", no text, no typography, no watermark".
`
    },
    {
        id: 'analyze_competitors',
        name: 'تحليل المنافسين (Gap Analysis)',
        description: 'مقارنة القناة مع منافس واستخراج الفجوات.',
        category: 'Analysis',
        variables: ['myStatsJson', 'compStatsJson'],
        template: `
Act as a Senior YouTube Strategist.
**My Channel:** {myStatsJson}
**Competitor:** {compStatsJson}

**Task:** Perform a SWOT analysis comparing the two channels. Find the "Content Gap" - what are they doing that I am not?

**Output Requirements:**
- Language: **ARABIC**.
- Format: JSON.

**JSON Structure:**
{
  "comparisonSummary": "Strategic overview.",
  "strengths": ["My strength 1", "My strength 2"],
  "weaknesses": ["My weakness 1", "My weakness 2"],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "actionableTips": ["Specific Tip 1", "Specific Tip 2"],
  "competitorContentIdeas": [
    { "title": "Idea Title", "explanation": "Why this works" }
  ]
}
`
    },
    {
        id: 'generate_titles_only',
        name: 'توليد عناوين فيرال (Viral Titles)',
        description: 'توليد 5 عناوين فيرال مع تحليل نفسي.',
        category: 'Optimization',
        variables: ['currentTitle'],
        template: `
**Task:** Generate 5 VIRAL YouTube titles for the topic: "{currentTitle}".
**Language:** **ARABIC**.

**Requirements:**
- High CTR.
- Use Power Words.
- Analyze the psychology of each title.

**Output:** JSON.
{
  "titles": [
    {
      "title": "Proposed Title",
      "score": 90,
      "psychology": {
        "curiosityScore": 85,
        "urgencyScore": 70,
        "emotionType": "Shock",
        "powerWords": ["Secret", "Never"],
        "analysis": "Explanation"
      }
    }
  ]
}
`
    },
    {
        id: 'generate_desc_only',
        name: 'توليد وصف SEO احترافي',
        description: 'كتابة وصف كامل محسن لمحركات البحث.',
        category: 'Optimization',
        variables: ['title', 'currentDesc'],
        template: `
Write a professional YouTube description in **ARABIC**.
**Title:** {title}
**Notes:** {currentDesc}

**Structure:**
1.  **Hook (First 2 lines):** Must contain keywords and be catchy.
2.  **Body:** Detailed summary (300 words).
3.  **Timestamps:** Placeholder list.
4.  **CTA:** Subscribe & Links.
5.  **Hashtags:** 3 relevant hashtags.

Return Plain Text.
`
    },
    {
        id: 'generate_tags_only',
        name: 'توليد وتقييم الكلمات الدلالية',
        description: 'تقييم الكلمات الحالية واقتراح كلمات جديدة.',
        category: 'Optimization',
        variables: ['title', 'currentTagsJSON', 'language'],
        template: `
**Task:** YouTube SEO Tag Optimization.
**Video:** "{title}"
**Target Language:** {language}

**Input Tags:** {currentTagsJSON}

**Output JSON:**
{
  "scoredTags": [ { "tag": "INPUT_TAG_EXACT", "score": 0-100 } ],
  "suggestedTags": [ { "tag": "NEW_TAG", "score": 0-100 } ]
}
`
    },
    {
        id: 'score_tags_manual',
        name: 'تقييم الكلمات الدلالية يدوياً',
        description: 'إعطاء درجة لكل كلمة دلالية مدخلة.',
        category: 'Optimization',
        variables: ['title', 'tagsJSON'],
        template: `
Analyze relevance and search volume for these tags regarding video: "{title}".
**Tags:** {tagsJSON}

**Output JSON Array:**
[ { "tag": "TAG_NAME", "score": 0-100 } ]
`
    },
    {
        id: 'generate_hooks_only',
        name: 'توليد نصوص الصورة (Thumbnail Hooks)',
        description: 'نصوص قصيرة جداً للصورة المصغرة.',
        category: 'Optimization',
        variables: ['title', 'language'],
        template: `
Generate 10 short, punchy text overlays for a YouTube thumbnail.
**Topic:** "{title}"
**Language:** {language}
**Constraint:** Max 3-4 words per hook. Focus on intrigue.

**Output JSON:**
[{ "hook": "Text", "score": 90 }]
`
    },
    {
        id: 'evaluate_metadata',
        name: 'تقييم جودة الميتاداتا',
        description: 'تقييم العنوان والوصف والكلمات الدلالية.',
        category: 'Analysis',
        variables: ['title', 'descLen', 'tags'],
        template: `
Evaluate this metadata quality (0-100).
**Title:** {title}
**Desc Length:** {descLen} chars
**Tags:** {tags}

**Output (ARABIC) JSON:**
{ "score": 85, "advice": "One sentence advice." }
`
    },
    {
        id: 'deep_audit_video',
        name: 'الفحص العميق للفيديو (Algorithm Inspector)',
        description: 'تحليل شامل للأداء مقارنة بمتوسط القناة.',
        category: 'Analysis',
        variables: ['videoContext', 'transcriptContext'],
        template: `
Act as the YouTube Recommendation Algorithm.
**Task:** Audit this video's performance and content alignment.

**Video Data:**
{videoContext}

**Content Sample (Transcript):**
"{transcriptContext}"

**Analysis Logic:**
1.  **Promise vs Delivery:** Does the content match the Title/Thumbnail promise?
2.  **Retention:** Identify why people might drop off based on the transcript tone.
3.  **Engagement:** Is the Call to Action clear?

**Output Requirements:**
- Language: **ARABIC**.
- Format: JSON.

**JSON Structure:**
{
    "score": 0-100,
    "level": "Elite/Healthy/Problematic/Critical",
    "verdict": "Short 3-word verdict",
    "analysis": "Deep explanation of algorithm signals.",
    "psychologicalTrigger": "Primary emotion targeted.",
    "actionPlan": ["Fix 1", "Fix 2", "Fix 3"]
}
`
    },
    {
        id: 'generate_advanced_ideas',
        name: 'توليد أفكار متقدمة (Idea Factory)',
        description: 'توليد أفكار فيديوهات بناءً على النيتش والنمط.',
        category: 'Ideas',
        variables: ['count', 'niches', 'positivePrompt', 'negativePrompt', 'style'],
        template: `
Generate {count} VIRAL YouTube video ideas.
**Niches:** "{niches}"
**Focus:** {positivePrompt}
**Avoid:** {negativePrompt}
**Style:** {style}

**Output Requirements:**
- Language: **ARABIC**.
- Format: JSON.

**JSON Structure:**
[{ "id": "1", "title": "Catchy Title", "description": "Why it works (Persuasion)", "score": 90 }]
`
    },
    {
        id: 'generate_3_distinct_ideas',
        name: 'توليد 3 مفاهيم بصرية (Thumbnail Concepts)',
        description: 'توليد 3 سيناريوهات مختلفة تماماً للصورة المصغرة.',
        category: 'Creative',
        variables: ['videoTitle', 'videoDesc'],
        template: `
Generate 3 DISTINCT visual concepts for a YouTube thumbnail for: "{videoTitle}".

1. **Direct:** Literal representation.
2. **Emotional:** Reaction/Face focus.
3. **Curiosity:** Abstract/Mystery focus.

**Constraint:** Append ", no text" to each string.
**Output:** JSON Array of strings.
`
    },
    {
        id: 'analyze_hook_retention',
        name: 'تحليل الثواني الذهبية (Hook Audit)',
        description: 'تحليل مقدمة الفيديو (أول 100 كلمة) ومقارنتها بالعنوان.',
        category: 'Advanced',
        variables: ['videoTitle', 'introTranscript'],
        template: `
**Role:** Retention Specialist.
**Task:** Analyze the first 30 seconds (Intro) of this video.

**Title:** "{videoTitle}"
**Intro Text:** "{introTranscript}"

**Questions:**
1. Is there a "Hook" in the first 5 seconds?
2. Does it verify the click (match title)?
3. Is there "Fluff" (wasted time)?

**Output Requirements:**
- Language: **ARABIC**.
- Format: JSON.

**JSON Structure:**
{
    "score": 0-100,
    "hookDetected": true/false,
    "timeToTopic": number (seconds estimated),
    "verdict": "Sharp/Boring/Misleading",
    "improvement": "Rewrite suggestion for the first sentence."
}
`
    },
    {
        id: 'analyze_viewer_personas',
        name: 'محاكاة الجمهور (Persona Simulation)',
        description: 'تقييم الفيديو من وجهة نظر 3 شخصيات مختلفة.',
        category: 'Advanced',
        variables: ['videoTitle', 'videoDesc'],
        template: `
Simulate 3 viewers deciding whether to click this video.
**Video:** "{videoTitle}"

**Personas:**
1. **The Skeptic:** Hates clickbait.
2. **The Newbie:** Needs simple info.
3. **The Pro:** Wants depth.

**Output (ARABIC) JSON Array:**
[
  { "type": "Skeptic", "reaction": "Thought process...", "score": 0-100 },
  { "type": "Newbie", "reaction": "Thought process...", "score": 0-100 },
  { "type": "Pro", "reaction": "Thought process...", "score": 0-100 }
]
`
    },
    {
        id: 'analyze_comments_gap',
        name: 'تحليل فجوة التعليقات (Community Voice)',
        description: 'استخراج طلبات الجمهور ونقاط الألم من التعليقات.',
        category: 'Advanced',
        variables: ['comments'],
        template: `
Analyze these comments to find UNANSWERED questions or CONTENT GAPS.
**Comments:**
{comments}

**Output (ARABIC) JSON Array:**
[
  { "topic": "Missing Topic", "sentiment": "Request/Complaint", "frequency": 5, "sampleComment": "Quote" }
]
`
    },
    {
        id: 'repurpose_content',
        name: 'إعادة تدوير المحتوى (Content Multiplier)',
        description: 'تحويل الفيديو إلى ثريد تويتر، منشور LinkedIn، وسكربت شورتس.',
        category: 'Advanced',
        variables: ['transcript'],
        template: `
Repurpose this video transcript into social media posts.
**Transcript:** "{transcript}"

**Requirements:**
1. **Twitter Thread:** 5 Tweets (Thread style).
2. **LinkedIn:** Professional post with bullet points.
3. **Shorts Script:** 60s script highlighting the best part.
4. **Poll:** Engaging question.

**Output (ARABIC) JSON:**
{
    "twitterThread": ["Tweet 1", ...],
    "linkedinPost": "Text...",
    "shortsScript": "Script...",
    "communityPoll": "Question..."
}
`
    },
    {
        id: "generate_full_script",
        name: "توليد سكربت فيديو كامل (Content Master)",
        description: "صياغة نص احترافي متكامل مع التحكم في الشخصية والأسلوب.",
        category: "Creative",
        variables: ["title", "wordCount", "language", "tone", "audience", "format", "persona", "style", "cta"],
        template: `
**ROLE:** You are a master scriptwriter, acting as {persona}.
**TASK:** Write a high-quality, professional {format} about the topic "{title}".

**LANGUAGE & STYLE:**
- The output language MUST be **{language}**. If the language is "Arabic", you MUST use formal Arabic (الفصحى).
- Adopt a {tone} tone, targeting an audience of {audience}.
- Follow a {style} structure.
- Vary sentence length, using a mix of short, punchy sentences and longer, more descriptive ones to create a natural, engaging rhythm for narration.

**CONTENT REQUIREMENTS:**
- Start with a powerful hook.
- Deliver value and depth on the topic.
- Conclude effectively, ending precisely with the call to action: "{cta}". Do not add any text after the CTA.
- The total length should be approximately {wordCount} words.

**CRITICAL OUTPUT RULES:**
- **DO NOT** include any visual descriptions, sound effect cues, or scene headings (e.g., "[Visual: ...]", "(Sound of...)", "Intro:", "Outro:").
- **DO NOT** use asterisks for emphasis or any other purpose. The output must not contain any text formatted like **this**.
- **DO NOT** start the response with introductory phrases like "Here is the script:" or "إليك النص".
- **DO NOT** end the response with concluding phrases or summaries.
- The output MUST be the raw, clean text of the script itself, exactly as it should be spoken. It must be immediately ready for a Text-to-Speech (TTS) engine.`
    },
    {
        id: "generate_meta_from_script",
        name: "توليد بيانات SEO من السكربت",
        description: "استخراج عنوان جذاب، ووصف، وعلامات من نص الفيديو.",
        category: "Optimization",
        variables: ["scriptContent", "language"],
        template: `
    "Act as an expert YouTube SEO strategist. Your task is to analyze the provided video script and generate highly optimized metadata to maximize discoverability, engagement, and search ranking.\n\n**Analysis Context:**\n- **Script Content:** {scriptContent}\n- **Target Language:** {language}\n\n**Core Directives:**\n\n1.  **Title Generation:**\n    -   Craft a compelling, clickable, and viral-worthy title (ideally under 60 characters).\n    -   It must be highly relevant to the script's core topic and include the primary search keyword naturally.\n    -   The title should spark curiosity or clearly state the value for the viewer.\n\n2.  **Description Generation:**\n    -   Write a detailed, keyword-rich description (minimum 2 paragraphs).\n    -   The first 1-2 sentences are critical for SEO; they must contain the primary keywords and act as a strong hook.\n    -   Provide a comprehensive summary of the video's key points. If the script structure allows, add helpful timestamps (e.g., 00:00 Intro).\n    -   Conclude the description with a set of 3 to 5 highly relevant and popular hashtags to boost visibility.\n\n3.  **Tags Generation:**\n    -   Generate a strategic list of 10-15 SEO tags.\n    -   This list must include a mix of: broad category keywords, specific long-tail keywords, and LSI (Latent Semantic Indexing) keywords that reflect the video's content and potential user searches.\n\n**CRITICAL OUTPUT FORMAT:**\nYour entire response MUST be a single, valid JSON object. Do not include any text, explanations, or markdown formatting before or after the JSON structure.\n\n**Output JSON Schema:**\n{\n  \"title\": \"A compelling, SEO-driven title here\",\n  \"description\": \"A detailed, keyword-rich description starting with a strong hook.\\n\\nTimestamps (if applicable):\\n00:00 - Key Topic 1\\n01:30 - Key Topic 2\\n\\n#relevantHashtag #seoHashtag #videoTopicHashtag\",\n  \"tags\": [\"primary keyword\", \"long-tail keyword phrase\", \"related search term\", \"video topic tag\"]\n}"tags": ["tag1", "tag2"]
    }
`
    },
    {
        id: "convert_to_shorts_script",
        name: "تحويل إلى سكربت شورتس (Shorts Converter)",
        description: "تحويل المحتوى الطويل إلى سكربت فيديو قصير سريع.",
        category: "Creative",
        variables: ["longScript", "language"],
        template: `
**TASK:** Convert the following long-form text into a powerful, fast-paced 60-second vertical video script (like YouTube Shorts/TikTok).
**INPUT TEXT:** {longScript}

**LANGUAGE & STYLE:**
- The output language MUST be **{language}**. If the language is "Arabic", you MUST use formal Arabic (الفصحى).
- The pacing must be very fast. Cut all non-essential words.
- Use varied sentence structures (short and long) to create a dynamic rhythm suitable for a voiceover.

**CONTENT REQUIREMENTS:**
- Start immediately with a powerful hook in the first 3 seconds.
- Focus on delivering ONE single, powerful key insight or story beat from the input text.
- End the script in a way that feels natural to loop back to the beginning.

**CRITICAL OUTPUT RULES:**
- **DO NOT** include any visual cues, camera directions, or sound effects (e.g., "[Visual: ...]", "[SFX: ...]").
- **DO NOT** use labels like "Intro:", "Hook:", "Outro:".
- **DO NOT** start with phrases like "Here's the script:".
- The output MUST be ONLY the clean, raw text for the voiceover, ready for a Text-to-Speech (TTS) engine.
`
    },
    {
        id: "evaluate_youtube_script",
        name: "تقييم جودة السكربت (Script Auditor)",
        description: "تحليل السكربت بناءً على معايير الاحتفاظ بالجمهور في يوتيوب.",
        category: "Analysis",
        variables: ["scriptContent"],
        template: `
        Act as a YouTube Retention Expert. Evaluate the following script for a video.
        
        **SCRIPT:**
        {scriptContent}

        **CRITERIA:**
        1. **Hook:** Is the first 10% gripping?
        2. **Pacing:** Are sentences concise?
        3. **Value:** Is there fluff?
        4. **CTA:** Is the call to action clear but not annoying?

        **OUTPUT LANGUAGE:** ARABIC. The 'critique' and 'improvements' must be in Arabic.

        **OUTPUT (JSON ONLY):**
        {
            "score": 0-100,
            "hookScore": 0-100,
            "pacing": "Fast/Slow/Good",
            "critique": ["Critical Point 1 (Arabic)", "Critical Point 2 (Arabic)"],
            "improvements": ["Fix 1 (Arabic)", "Fix 2 (Arabic)"]
        }
        `
    },
    {
        id: "rewrite_script_section",
        name: "إعادة صياغة جزئية (Smart Rewrite)",
        description: "إعادة كتابة جزء محدد من النص بناءً على تعليمات المستخدم.",
        category: "Creative",
        variables: ["selectedText", "instruction", "fullContext"],
        template: `
        **TASK:** Rewrite the specific text selection below based on the user's instruction.
        
        **CONTEXT (The full script for tone reference):**
        ...{fullContext}...

        **TEXT TO REWRITE:**
        "{selectedText}"

        **USER INSTRUCTION:**
        "{instruction}" (e.g., make it funnier, shorter, more detailed)

        **OUTPUT:**
        Return ONLY the rewritten text replacement. Do not add quotes or explanations.
        `
    },
    {
        id: "generate_tiktok_description",
        name: "وصف تيك توك (TikTok SEO)",
        description: "إنشاء وصف قصير وجذاب للتيك توك مع هاشتاجات.",
        category: "Optimization",
        variables: ["title", "language"],
        template: `
**TASK:** Write a viral TikTok description for a video about: "{title}".
**LANGUAGE:** {language}.

**REQUIREMENTS:**
1. Short and punchy (1-2 sentences).
2. Ask a question to drive engagement.
3. Include 5-8 trending/relevant hashtags.

**OUTPUT:** Return ONLY the description text with hashtags. No labels.
`
    },
    {
        id: "generate_short_metadata",
        name: "بيانات وصفية للشورتس (Shorts Meta)",
        description: "استخراج عنوان، وصف، وكلمات مفتاحية مخصصة لفيديو قصير.",
        category: "Optimization",
        variables: ["shortScript", "language"],
        template: `
**TASK:** Generate metadata for a YouTube Short based on this script:
"{shortScript}"

**LANGUAGE:** {language}

**OUTPUT (JSON ONLY):**
{
  "shortTitle": "High CTR title under 50 chars",
  "shortDescription": "Quick description + hashtags",
  "shortKeywords": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}
`
    },
    {
        id: "add_tashkeel",
        name: "إضافة التشكيل (Tashkeel Master)",
        description: "إضافة التشكيل الكامل للنصوص العربية لنطق سليم.",
        category: "Creative",
        variables: ["text"],
        template: `
        **ROLE:** Expert Arabic Linguist.
        **TASK:** Add full diacritics (Harakat/Tashkeel) to the following Arabic text to ensure perfect pronunciation by a Text-to-Speech engine.
        
        **INPUT TEXT:**
        "{text}"

        **RULES:**
        1. Maintain the exact meaning and structure.
        2. Ensure grammar (Nahw) rules are applied correctly.
        3. Output ONLY the vocalized text. Do not add any introductions or explanations.
        `
    },
    {
        id: "generate_scene_prompt",
        name: "توليد وصف مشهد (Scene Visualizer)",
        description: "تحويل جزء من النص إلى وصف مشهد بصري بالإنجليزية.",
        category: "Vision",
        variables: ["segmentText", "style"],
        template: `
        **TASK:** Create a highly detailed image generation prompt (in English) based on the following text segment from a video script.
        
        **SCRIPT SEGMENT:**
        "{segmentText}"

        **ART STYLE:**
        {style}

        **INSTRUCTIONS:**
        1. visualize the core concept or action in the text.
        2. Describe the subject, lighting, camera angle, and mood.
        3. Incorporate the specified Art Style keywords naturally.
        4. **CRITICAL:** Start the prompt with the visual description immediately.
        5. **CRITICAL:** End the prompt with: ", no text, no watermark, high quality, 8k".

        **OUTPUT:**
        Return ONLY the final prompt string.
        `
    },
    {
        id: "suggest_art_style",
        name: "اقتراح ستايل فني (Art Director)",
        description: "تحليل النص واقتراح أفضل ستايل بصري للصور.",
        category: "Vision",
        variables: ["text"],
        template: `
        **ROLE:** Professional Art Director.
        **TASK:** Analyze the following video script and select the ONE best visual art style from the provided library below that fits the mood and content.

        **SCRIPT CONTEXT:**
        "{text}"

        **STYLE LIBRARY:**
        1. hyper-detailed, 3d render, atmospheric lighting, ultra quality
        2. cinematic, dramatic lighting, epic, photo, realistic
        3. professional photography, photorealistic, 8k, sharp focus
        4. anime style, key visual, beautiful, detailed, official art
        5. watercolor painting, vibrant colors, artistic, beautiful
        6. cinematic still, ultra-realistic, shot on Arri Alexa, anamorphic lens, dramatic lighting, wide angle
        7. professional portrait photography, Canon EOS R5, 85mm f/1.2 lens, soft studio lighting, bokeh, sharp focus
        8. vintage photo, shot on Kodak Portra 400, 35mm film grain, slightly faded colors, retro aesthetic, 1980s
        9. National Geographic photography, wildlife, telephoto lens, hyper-detailed fur, natural lighting, candid shot
        10. gourmet food photography, macro shot, delicious, vibrant colors, soft light, depth of field, appetizing
        11. candid street photography, shot on Leica M11, dynamic composition, moody, black and white, high contrast
        12. aerial drone shot, top-down view, landscape photography, high altitude, 4k, vibrant colors
        13. cyberpunk style, neon-drenched city, futuristic, blade runner aesthetic, glowing lights, dark, moody
        14. 16-bit pixel art, retro video game style, vibrant color palette, detailed sprites
        15. detailed pencil sketch, hand-drawn, black and white, hatching, intricate lines, concept art
        16. isometric 3d render, cute, low poly, vibrant, diorama, blender 3d
        17. classic disney animation style, beautiful painted background, vibrant colors, detailed, official concept art
        18. stick figure illustration, black and white, flat 2D, minimalistic, symbolic, cinematic composition, emotionally powerful
        19. Historical oil painting, neoclassical style, dramatic chiaroscuro lighting, epic, moody, highly detailed, masterpiece
        20. Studio Ghibli aesthetic, 2D anime film still, beautiful painterly watercolor backgrounds, lush and vibrant scenery, soft golden hour lighting, nostalgic and whimsical atmosphere, charming character design, clean line art, masterpiece quality
        21. Dark and gritty masculine aesthetic, high-contrast monochromatic, dramatic cinematic lighting, chiaroscuro, photorealistic, ultra-detailed, 8k

        **OUTPUT:**
        Return ONLY the string of keywords for the selected style. Do not include the style number or any explanation.
        Example Output: "cinematic, dramatic lighting, epic, photo, realistic"
        ` 
    }
    {
        id: "generate_batch_scene_prompts",
        name: "توليد برومبتات دفعة (Batch Prompts)",
        description: "توليد أوصاف بصرية لمجموعة مشاهد في طلب واحد.",
        category: "Vision",
        variables: ["segmentsJson", "style"],
        template: `
        **ROLE:** AI Visual Director.
        **TASK:** Generate English image prompts for specific video scenes.

        **INPUT SEGMENTS (JSON):**
        {segmentsJson}

        **ART STYLE:**
        {style}

        **INSTRUCTIONS:**
        1. For EACH segment in the input array, create a unique, detailed image prompt.
        2. Use the specified Art Style.
        3. Ensure no text is visible in the generated scenes.
        4. Append ", no text, 8k" to each prompt.

        **OUTPUT FORMAT:**
        Return a valid JSON ARRAY of strings. Example: ["Prompt 1...", "Prompt 2..."]
        `
    },
    {
        id: "generate_visual_script_thumbnails",
        name: "توليد برومبتات الصورة المصغرة (Thumbnail Expert)",
        description: "اقتراح 3 برومبتات احترافية للصورة المصغرة بناءً على السكربت.",
        category: "Vision",
        variables: ["text", "style"],
        template: `
        **ROLE:** YouTube Thumbnail Strategist.
        **TASK:** Create 3 distinct, high-CTR image prompts for a YouTube thumbnail based on this script.

        **SCRIPT CONTEXT:**
        "{text}"

        **ART STYLE:**
        {style}

        **CONCEPTS:**
        1. **Emotional/Reaction:** Focus on a character's face expressing strong emotion.
        2. **Action/Moment:** A key dramatic moment from the script.
        3. **Curiosity/Abstract:** A mysterious visual that begs a click.

        **OUTPUT:**
        Return a valid JSON ARRAY of strings. Example: ["Prompt 1...", "Prompt 2...", "Prompt 3..."]
        `
    }
];
