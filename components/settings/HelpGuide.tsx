
import React from 'react';
import { X, ExternalLink, Key, Youtube, BookOpen, ShieldCheck, Cpu, Hash, ArrowLeft } from 'lucide-react';

interface HelpGuideProps {
    onClose: () => void;
}

const HelpGuide: React.FC<HelpGuideProps> = ({ onClose }) => {
    
    const links = [
        {
            title: "Google AI Studio (Gemini API)",
            url: "https://aistudio.google.com/app/apikey",
            desc: "للحصول على مفتاح الذكاء الاصطناعي (مجاني).",
            icon: <Cpu size={18} className="text-purple-600"/>
        },
        {
            title: "Google Cloud Console (YouTube API)",
            url: "https://console.cloud.google.com/apis/credentials",
            desc: "للحصول على YouTube Data API Key.",
            icon: <Youtube size={18} className="text-red-600"/>
        },
        {
            title: "Maestra (Transcript)",
            url: "https://maestra.ai/ar/tools/video-to-text/youtube-transcript-generator",
            desc: "أداة خارجية لاستخراج نصوص الفيديو.",
            icon: <ExternalLink size={18} className="text-blue-600"/>
        },
        {
            title: "Pollinations.ai",
            url: "https://pollinations.ai/",
            desc: "نموذج توليد الصور المجاني المستخدم.",
            icon: <ExternalLink size={18} className="text-green-600"/>
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" dir="rtl">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-slate-800">
                
                {/* Header */}
                <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">دليل المساعدة والروابط</h2>
                            <p className="text-indigo-100 text-xs">كل ما تحتاجه لضبط إعدادات البرنامج</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition">
                        <X size={20}/>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 flex-1">
                    
                    {/* 1. Quick Links */}
                    <section>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                            <ExternalLink size={20} className="text-indigo-500"/> الروابط الهامة (Important Links)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {links.map((link, idx) => (
                                <a 
                                    key={idx} 
                                    href={link.url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 transition group"
                                >
                                    <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-full group-hover:bg-white dark:group-hover:bg-slate-600 transition">
                                        {link.icon}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                            {link.title} <ExternalLink size={12} className="opacity-50"/>
                                        </h4>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{link.desc}</p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </section>

                    {/* 2. Setup Guide */}
                    <section>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                            <Key size={20} className="text-amber-500"/> طريقة الإعداد (Setup Guide)
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-2">1. إعداد Gemini API (الذكاء الاصطناعي)</h4>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <li>اذهب إلى <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 font-bold underline">Google AI Studio</a>.</li>
                                    <li>اضغط على "Create API Key".</li>
                                    <li>انسخ المفتاح (يبدأ بـ AIzaSy...) وضعه في خانة <strong>مفاتيح Gemini API</strong> في الإعدادات.</li>
                                    <li>يفضل عمل أكثر من مفتاح (من حسابات جوجل مختلفة) لتجنب تجاوز الحد اليومي.</li>
                                </ul>
                            </div>

                            <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-2">2. إعداد YouTube Data API</h4>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <li>اذهب إلى <a href="https://console.cloud.google.com/" target="_blank" className="text-indigo-600 font-bold underline">Google Cloud Console</a> وأنشئ مشروعاً جديداً.</li>
                                    <li>ابحث عن "YouTube Data API v3" في المكتبة وقم بتفعيله (Enable).</li>
                                    <li>اذهب إلى Credentials وأنشئ <strong>API Key</strong>.</li>
                                    <li>الصق هذا المفتاح عند إضافة قناتك في التطبيق.</li>
                                </ul>
                            </div>

                            <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-2">3. الاتصال المتقدم (OAuth 2.0) - اختياري</h4>
                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <li>يتطلب ذلك ملف <code>client_secret.json</code> وملف <code>token.json</code>.</li>
                                    <li>يسمح هذا بجلب البيانات الخاصة (التحليلات الحقيقية) ورفع التحديثات لليوتيوب.</li>
                                    <li>بدون هذه الملفات، سيعمل التطبيق في وضع "القراءة فقط" والتقديرات.</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* 3. Channel ID Guide */}
                    <section className="bg-indigo-50 dark:bg-slate-800/80 p-4 rounded-xl border border-indigo-100 dark:border-slate-700">
                        <h4 className="font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                            <Hash size={18} className="text-indigo-500"/> كيفية الحصول على معرف القناة (Channel ID)
                        </h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                            <p>يدعم البرنامج طريقتين لربط القناة:</p>
                            <ul className="list-disc list-inside space-y-2">
                                <li>
                                    <strong className="text-gray-800 dark:text-gray-200">الاسم المعرف (Handle):</strong> وهو الأسهل، ويبدأ بـ @ (مثال: <code>@MrBeast</code>). يمكنك نسخه من رابط القناة أو أسفل اسم القناة.
                                </li>
                                <li>
                                    <strong className="text-gray-800 dark:text-gray-200">المعرف الثابت (Channel ID):</strong> يبدأ بـ <code>UC</code> (مثال: <code>UCX6OQ3DkcsbYNE6H8uQQuVA</code>). تجده في رابط القناة <code>youtube.com/channel/...</code>.
                                </li>
                            </ul>

                            {/* Direct Link Button */}
                            <div className="mt-4 p-3 bg-white dark:bg-slate-900 rounded-lg border border-indigo-200 dark:border-slate-600 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                    <span className="font-bold block text-indigo-700 dark:text-indigo-400 mb-1 flex items-center gap-1">
                                        <ExternalLink size={12}/> الطريقة الأسرع والأضمن:
                                    </span>
                                    اضغط على الزر للذهاب مباشرة لصفحة الإعدادات المتقدمة في يوتيوب، وانسخ <strong>"معرف القناة"</strong>.
                                </div>
                                <a 
                                    href="https://www.youtube.com/account_advanced" 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition whitespace-nowrap shadow-md hover:shadow-lg w-full md:w-auto justify-center"
                                >
                                    فتح إعدادات المعرف <ArrowLeft size={14} className="rtl:rotate-0 ltr:rotate-180"/>
                                </a>
                            </div>

                            <div className="text-xs bg-white dark:bg-slate-900 p-2 rounded border border-indigo-100 dark:border-slate-700 mt-2">
                                <strong>تلميح:</strong> إذا كنت تستخدم Handle (@) وتواجه مشاكل في الاتصال، حاول استخدام المعرف الثابت (UC...) حيث أنه يعمل دائماً مع جميع أنواع المفاتيح.
                            </div>
                        </div>
                    </section>

                    {/* 4. Security Note */}
                    <section className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-900">
                        <h4 className="font-bold text-green-800 dark:text-green-300 flex items-center gap-2 mb-2">
                            <ShieldCheck size={18}/> ملاحظة أمان هامة
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">
                            جميع مفاتيحك وبياناتك يتم تخزينها <strong>محلياً فقط</strong> (Local Storage) ومشفرة بكلمة مرور الخزنة الخاصة بك. لا يتم إرسال أي بيانات إلى سيرفرات خارجية خاصة بنا. أنت المتحكم الوحيد في بياناتك.
                        </p>
                    </section>

                </div>

                <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex justify-end">
                    <button onClick={onClose} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition">
                        فهمت، شكراً
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelpGuide;
