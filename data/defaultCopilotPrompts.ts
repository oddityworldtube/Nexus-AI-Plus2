
import { CopilotPrompt } from '../types';

export const DEFAULT_COPILOT_PROMPTS: CopilotPrompt[] = [
    {
        id: 'copilot_suggest_titles',
        name: 'اقتراح 10 عناوين (Viral)',
        template: "أنت خبير في عناوين يوتيوب. بناءً على أنجح الفيديوهات في هذه القناة والسياق الحالي، اقترح 10 عناوين جذابة ومبتكرة (Viral Titles) يمكن إنشاؤها في الفترة القادمة. ركز على استخدام 'الفجوة المعرفية' و'الفضول'.",
        context: ['VIDEO_LIST_ANALYSIS', 'GENERAL', 'DASHBOARD_OVERVIEW'],
        variables: []
    },
    {
        id: 'copilot_analyze_perf',
        name: 'تحليل الأداء الاستراتيجي',
        template: "قم بتحليل البيانات المعروضة حالياً كخبير بيانات. لا تسرد الأرقام فقط، بل اشرح 'لماذا' حدث ذلك. ما هي الأنماط المخفية؟ ما هي نقاط القوة والضعف؟ وما هي الخطوة التالية المقترحة للنمو؟",
        context: ['DASHBOARD_OVERVIEW', 'VIDEO_LIST_ANALYSIS'],
        variables: []
    },
    {
        id: 'copilot_generate_script',
        name: 'اكتب سكربت صوتي كامل',
        template: "مهمتك هي كتابة مقال صوتي احترافي (سكربت يوتيوب) جاهز للتسجيل. الموضوع هو: '{video_idea}'. الطول المطلوب حوالي {word_count} كلمة. اكتب النص الذي سيقرأه المعلق فقط. ابدأ بمقدمة قوية (Hook) تخطف الانتباه في أول 5 ثواني. استخدم لغة {tone}.",
        context: ['GENERAL', 'IDEA_GENERATION', 'VIDEO_OPTIMIZATION'],
        variables: [
            { name: 'video_idea', description: 'ما هي فكرة الفيديو؟' },
            { name: 'word_count', description: 'كم عدد الكلمات المطلوبة تقريباً؟', defaultValue: '1200' },
            { name: 'tone', description: 'نبرة الصوت (مثال: حماسية، هادئة، رسمية)', defaultValue: 'جذابة وسهلة الفهم' }
        ]
    },
    {
        id: 'copilot_thumbnail_ideas',
        name: 'أفكار صور مصغرة (Visual Concepts)',
        template: "اقترح 3 مفاهيم بصرية مختلفة تماماً (Visual Concepts) للصورة المصغرة لفيديو بعنوان: '{title}'. \n1. مباشر وواضح.\n2. يثير الفضول والغموض.\n3. يعتمد على المشاعر القوية.\nصف العناصر البصرية، الألوان، وتعبيرات الوجه.",
        context: ['VIDEO_OPTIMIZATION', 'IDEA_GENERATION'],
        variables: [
            { name: 'title', description: 'عنوان الفيديو' }
        ]
    },
    {
        id: 'copilot_community_post',
        name: 'كتابة منشور منتدى (Engagement)',
        template: "اكتب منشور منتدى (Community Post) جذاب للترويج لهذا الفيديو. لا تضع الرابط فقط، بل اكتب قصة قصيرة أو سؤالاً يثير الجدل ويدفع الناس لفتح الفيديو. الهدف هو زيادة التفاعل.",
        context: ['VIDEO_OPTIMIZATION', 'GENERAL'],
        variables: []
    },
    {
        id: 'copilot_competitor_deep_dive',
        name: 'كشف أسرار المنافس',
        template: "بناءً على بيانات المنافس المعروضة، قم بإجراء تحليل SWOT سريع. ما هي 'الخلطة السرية' التي يستخدمونها؟ وما هي نقطة ضعفهم التي يمكنني استغلالها للتفوق عليهم؟",
        context: ['COMPETITOR_ANALYSIS'],
        variables: []
    },
    {
        id: 'copilot_seo_tags',
        name: 'استخراج كلمات مفتاحية (SEO)',
        template: "استخرج لي قائمة بـ 20 كلمة مفتاحية (Tags) لهذا الموضوع، مرتبة حسب حجم البحث (Search Volume) والمنافسة المنخفضة. ركز على الكلمات المفتاحية الطويلة (Long-tail Keywords).",
        context: ['VIDEO_OPTIMIZATION', 'IDEA_GENERATION'],
        variables: []
    }
];
