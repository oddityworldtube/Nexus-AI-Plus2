import React, { useState, useEffect } from 'react';
import { 
    Lock, Unlock, ArrowLeft, ShieldCheck, 
    Database, KeyRound, Eye, EyeOff, 
    AlertCircle, Layers, Fingerprint, 
    Cpu, Command, Zap, ServerOff 
} from 'lucide-react';
import { hasVault, setupVault, unlockVault } from '../services/securityService';

interface Props {
    onUnlock: (key: CryptoKey) => void;
}

const VaultScreen: React.FC<Props> = ({ onUnlock }) => {
    // --- State ---
    const [isSetup, setIsSetup] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [isHoveringHeader, setIsHoveringHeader] = useState(false);

    useEffect(() => {
        setIsSetup(!hasVault());
    }, []);

    // --- Handlers ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;

        setStatus('loading');
        setErrorMsg('');
        
        await new Promise(r => setTimeout(r, 1000)); // Simulation

        try {
            let key;
            if (isSetup) {
                if (password.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
                key = await setupVault(password);
            } else {
                key = await unlockVault(password);
            }
            
            setStatus('success');
            setTimeout(() => onUnlock(key), 800); 
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.message || "كلمة المرور غير صحيحة");
            setTimeout(() => setStatus('idle'), 2500);
        }
    };

    const handleResetVault = () => {
        if (window.confirm("⚠️ تحذير أمني:\nسيتم حذف جميع البيانات المشفرة محلياً والبدء من جديد.\nهل أنت متأكد؟")) {
            localStorage.clear();
            window.location.reload();
        }
    };

    // --- Components ---
    const InfoItem = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
        <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors duration-300">
            <div className="p-3 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                <Icon size={22} />
            </div>
            <div>
                <h4 className="text-white font-bold text-base mb-1">{title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-indigo-500/30 overflow-x-hidden relative flex flex-col items-center py-10" dir="rtl">
            
            {/* --- Background Effects --- */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] opacity-40 animate-pulse-slow"></div>
            </div>

            {/* --- 1. HERO HEADER (Fixed Top) --- */}
            <header 
                className="relative z-10 flex flex-col items-center text-center space-y-6 mb-12 animate-fade-in-down"
                onMouseEnter={() => setIsHoveringHeader(true)}
                onMouseLeave={() => setIsHoveringHeader(false)}
            >
                <div className={`relative transition-all duration-700 ${isHoveringHeader ? 'scale-110' : 'scale-100'}`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 blur-2xl opacity-30 rounded-full"></div>
                    <div className="relative w-24 h-24 bg-gradient-to-br from-[#1a1f35] to-[#0f111a] rounded-3xl border border-white/10 flex items-center justify-center shadow-2xl ring-1 ring-white/20">
                        <Layers className={`w-12 h-12 text-indigo-400 transition-transform duration-700 ${isHoveringHeader ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                <div className="space-y-1">
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-slate-500 drop-shadow-sm">
                        NEXUS <span className="text-indigo-500">AI</span>
                    </h1>
                    <p className="text-slate-400 text-sm font-medium tracking-[0.3em] uppercase opacity-70">
                        مصنع المحتوى الاحترافى الخاص بيك 
                        قم بإدارة قنواتك، توليد الأفكار، وتحليل البيانات باستخدام الذكاء الاصطناعي، مع ضمان خصوصية تامة عبر التشفير المحلي
                    </p>
                </div>
            </header>

            {/* --- 2. MAIN GRID (Two Big Cards) --- */}
            <div className="relative z-10 container max-w-6xl px-4 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 items-stretch">
                    
                    {/* === CARD 1: INFO & DATA (Right Side in RTL) === */}
                    <div className="animate-fade-in-right h-full">
                        <div className="h-full bg-[#0A0F1C]/60 backdrop-blur-xl border border-white/10 p-8 lg:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden group hover:border-white/20 transition-all duration-300 flex flex-col justify-center">
                            
                            {/* Decorative Background */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>

                            <div className="mb-8">
                                <h2 className="text-3xl font-bold mb-4">بروتوكولات الأمان</h2>
                                <p className="text-slate-400 leading-relaxed">
                                    نظام Nexus AI يعتمد على فلسفة "الخصوصية أولاً". نحن لا نستخدم خوادم سحابية لتخزين بياناتك الحساسة.
                                </p>
                            </div>

                            <div className="space-y-4 flex-1">
                                <InfoItem 
                                    icon={ShieldCheck} 
                                    title="تشفير عسكري (AES-256)" 
                                    desc="بياناتك مشفرة بقوة 256-bit قبل أن يتم حفظها على القرص الصلب." 
                                />
                                <InfoItem 
                                    icon={ServerOff} 
                                    title="بيئة محلية (Local Environment)" 
                                    desc="قاعدة البيانات تعمل بالكامل داخل متصفحك. لا يوجد طرف ثالث." 
                                />
                                <InfoItem 
                                    icon={Fingerprint} 
                                    title="Zero-Knowledge Architecture" 
                                    desc="نحن لا نملك مفاتيحك. إذا فقدت كلمة المرور، لا يمكن استرجاع البيانات." 
                                />
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-3 text-xs text-slate-500 font-mono">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                System Status: Operational & Secure
                            </div>
                        </div>
                    </div>

                    {/* === CARD 2: LOGIN / SETUP (Left Side in RTL) === */}
                    <div className="animate-fade-in-up delay-100 h-full">
                        <div className="h-full bg-[#0A0F1C]/80 backdrop-blur-xl border border-white/10 p-8 lg:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col justify-center">
                            
                            {/* Gradient Top Border */}
                            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent transition-opacity duration-500 ${status === 'loading' ? 'opacity-100' : 'opacity-20'}`}></div>

                            <div className="text-center mb-10">
                                <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 transition-all duration-500 ${
                                    status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                                    status === 'error' ? 'bg-red-500/20 text-red-400' :
                                    'bg-white/5 text-white border border-white/10'
                                }`}>
                                    {status === 'success' ? <Unlock size={32} /> : 
                                     status === 'error' ? <AlertCircle size={32} /> :
                                     isSetup ? <Zap size={32} /> : <Lock size={32} />}
                                </div>
                                <h2 className="text-2xl font-bold text-white">
                                    {isSetup ? "تهيئة الخزنة الجديدة" : "تسجيل الدخول"}
                                </h2>
                                <p className="text-slate-400 text-sm mt-2">
                                    {isSetup ? "قم بإنشاء كلمة مرور رئيسية قوية" : "أدخل مفتاح فك التشفير للمتابعة"}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-sm mx-auto">
                                <div className="relative group/input">
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within/input:text-indigo-400 transition-colors">
                                        <KeyRound size={20} />
                                    </div>
                                    <input 
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => { setPassword(e.target.value); setStatus('idle'); }}
                                        className={`w-full bg-[#050810] border-2 rounded-xl py-4 pr-12 pl-12 text-white placeholder-slate-600 outline-none transition-all duration-300 font-mono text-lg text-center tracking-widest
                                            ${status === 'error' ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-indigo-500/50'}
                                        `}
                                        placeholder="••••••"
                                        autoFocus
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>

                                <div className="h-6 flex items-center justify-center">
                                    {status === 'error' && (
                                        <span className="text-red-400 text-xs font-bold animate-fade-in">{errorMsg}</span>
                                    )}
                                    {status === 'loading' && (
                                        <span className="text-indigo-300 text-xs flex items-center gap-2 animate-pulse">
                                            <Cpu size={12} /> جاري المعالجة...
                                        </span>
                                    )}
                                </div>

                                <button 
                                    disabled={status === 'loading' || !password}
                                    className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg flex items-center justify-center gap-2 transition-all duration-300 active:scale-[0.98] ${
                                        status === 'success' ? 'bg-emerald-600' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'
                                    }`}
                                >
                                    {status === 'loading' ? (
                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : status === 'success' ? (
                                        <>تم الفتح <Unlock size={20}/></>
                                    ) : (
                                        <>
                                            {isSetup ? "بدء الاستخدام" : "فتح الخزنة"}
                                            <ArrowLeft size={20} className="rtl:rotate-0 ltr:rotate-180"/>
                                        </>
                                    )}
                                </button>
                            </form>

                            {!isSetup && (
                                <div className="mt-8 text-center">
                                    <button 
                                        onClick={handleResetVault}
                                        className="text-[11px] text-slate-500 hover:text-red-400 transition-colors flex items-center justify-center gap-2 w-full"
                                    >
                                        <Command size={12} />
                                        نسيت كلمة المرور؟ (إعادة ضبط المصنع)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default VaultScreen;