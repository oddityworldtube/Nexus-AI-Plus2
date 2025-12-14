export const PERSONAS = [
    { value: 'The Expert', label: 'الخبير (The Expert)' },
    { value: 'The Friend', label: 'الصديق (The Friend)' },
    { value: 'The Storyteller', label: 'الحكواتي (The Storyteller)' }, // الخيار الموصى به
    { value: 'The Critic', label: 'الناقد (The Critic)' },
    { value: 'The Motivator', label: 'المحفز (The Motivator)' },
    { value: 'The Teacher', label: 'المعلم (The Teacher)' },
    { value: 'The Comedian', label: 'الفكاهي (The Comedian)' },
    { value: 'The Analyst', label: 'المحلل الدقيق (The Analyst)' },
    { value: 'The Minimalist', label: 'المبسط (The Minimalist)' }
];

export const TONES = [
    { value: 'Professional', label: 'احترافي (Professional)' },
    { value: 'Conversational', label: 'ودي/تخاطبي (Conversational)' }, // الخيار الموصى به
    { value: 'Urgent', label: 'ملح/عاجل (Urgent)' },
    { value: 'Humorous', label: 'مرح/فكاهي (Humorous)' },
    { value: 'Empathetic', label: 'متعاطف (Empathetic)' },
    { value: 'Controversial', label: 'مثير للجدل (Controversial)' },
    { value: 'Inspirational', label: 'ملهم (Inspirational)' },
    { value: 'Educational', label: 'تعليمي بحت (Educational)' },
    { value: 'Sarcastic', label: 'ساخر (Sarcastic)' }
];

export const STYLES = [
    { value: 'Step-by-Step Guide', label: 'خطوة بخطوة (How-To)' },
    { value: 'Listicle', label: 'قائمة (Listicle)' },
    { value: 'Storytelling', label: 'قصصي (Storytelling)' },
    { value: 'Case Study', label: 'دراسة حالة (Case Study)' },
    { value: 'Myth-Busting', label: 'كشف حقائق (Myth-Busting)' }, // الخيار الموصى به
    { value: 'Comparison/Review', label: 'مقارنة/مراجعة' },
    { value: 'Debate', label: 'نقاشي (Debate)' },
    { value: 'Q&A', label: 'سؤال وجواب (Q&A)' },
    { value: 'Reaction', label: 'ردة فعل (Reaction)' }
];

export const FORMATS = [
    { value: 'YouTube Video Script', label: 'سكربت فيديو يوتيوب' }, // الخيار الموصى به
    { value: 'Blog Article', label: 'مقال / تدوينة' },
    { value: 'Newsletter', label: 'نشرة بريدية (Newsletter)' },
    { value: 'Social Media Thread', label: 'سلسلة تغريدات (Thread)' },
    { value: 'Podcast Script', label: 'سكربت بودكاست' },
    { value: 'Shorts Script', label: 'سكربت شورتس (60ث)' },
    { value: 'Community Post', label: 'منشور منتدى' }
];

export const PREDEFINED_AUDIENCES = [
    "المبتدئين (Beginners)",
    "المحترفين (Experts)",
    "الطلاب (Students)",
    "رواد الأعمال (Entrepreneurs)",
    "محبي التقنية (Tech Enthusiasts)",
    "الآباء والأمهات (Parents)",
    "اللاعبين (Gamers)",
    "صناع المحتوى (Creators)",
    "المستثمرين (Investors)",
    "جيل Z (Gen Z)", // الخيار الموصى به
    "كبار السن (Seniors)",
    "الباحثين عن عمل (Job Seekers)",
    "المسوقين (Marketers)",
    "المبرمجين (Developers)",
    "عشاق السفر (Travelers)",
    "ربات البيوت (Homemakers)",
    "أصحاب الشركات الصغيرة (Small Business Owners)",
    "المهتمين بالصحة (Health Conscious)",
    "المصممين (Designers)",
    "المعلمين (Teachers)",
    "الأطفال (Kids)",
    "المراهقين (Teenagers)"
];

export const PREDEFINED_CTAS = [
    "الاشتراك في القناة (Subscribe)",
    "تفعيل زر الجرس",
    "كتابة تعليق (Comment)",
    "زيارة رابط في الوصف",
    "شراء منتج (Affiliate)",
    "مشاهدة فيديو آخر",
    "الاشتراك في القائمة البريدية",
    "مشاركة الفيديو (Share)",
    "الانضمام للمجتمع (Discord/Group)",
    "تحميل كتاب مجاني (Lead Magnet)",
    "حجز استشارة مجانية",
    "التسجيل في دورة تدريبية",
    "دعم القناة (Patreon/Join)",
    "متابعة حسابات السوشيال ميديا",
    "الإجابة على سؤال الحلقة", // تمت الإضافة (مهمة جداً للتفاعل)
    "تجربة الأداة (Free Trial)",
    "قراءة المقال الكامل"
];

// ------------------------------------------------------------------
// إعدادات الفيديو المقترحة (Best Practice Config)
// تم تجميع الخيارات المثالية هنا لاستخدامها مباشرة كـ Default State
// ------------------------------------------------------------------

export const BEST_YOUTUBE_CONFIG = {
    topic: 'كيف تفضح الكذاب في 5 ثوانٍ؟ (أسرار لغة الوجه)',
    persona: 'The Storyteller',      // الحكواتي: لسرد المعلومات كقصة مشوقة
    tone: 'Conversational',          // ودي: لكسر الحواجز مع المشاهد
    style: 'Myth-Busting',           // كشف حقائق: لإثارة الفضول وتصحيح المفاهيم
    format: 'YouTube Video Script',  // النوع
    audience: 'جيل Z (Gen Z)',       // لغة عصرية وسريعة ومباشرة
    cta: 'الإجابة على سؤال الحلقة',  // أفضل خيار لزيادة التعليقات (Engagement)
    wordCount: 1200,                 // الطول المثالي لفيديو 8-10 دقائق
    language: 'العربية'
};