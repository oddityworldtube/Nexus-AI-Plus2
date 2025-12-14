import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastMessage, ToastType } from '../types';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

interface ToastContextType {
  addToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // تعديل: المدة الافتراضية أصبحت 3000 (3 ثواني)
  const addToast = useCallback((message: string, type: ToastType = 'info', title?: string, duration: number = 3000) => {
    const id = Date.now().toString() + Math.random().toString();
    const newToast: ToastMessage = { id, message, type, title, duration };
    
    // الإشعارات الجديدة تظهر في الأعلى
    setToasts((prev) => [newToast, ...prev].slice(0, 5)); 

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-500" size={20} />;
      case 'error': return <AlertCircle className="text-red-500" size={20} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={20} />;
      case 'info': return <Info className="text-blue-500" size={20} />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success': return 'border-green-500 bg-white shadow-green-100';
      case 'error': return 'border-red-500 bg-white shadow-red-100';
      case 'warning': return 'border-amber-500 bg-white shadow-amber-100';
      case 'info': return 'border-blue-500 bg-white shadow-blue-100';
    }
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      
      {/* 
          تعديل: تم تغيير المكان إلى top-4 right-4 (أعلى اليمين) 
          ليكون فوق القائمة الجانبية في التصميم العربي (RTL)
      */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 md:px-0">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            onClick={() => removeToast(toast.id)} // خاصية النقر للإغلاق السريع
            className={`pointer-events-auto flex items-start gap-3 p-3 rounded-xl shadow-lg border-r-4 transition-all duration-300 ease-in-out transform hover:scale-[1.02] cursor-pointer animate-fade-in-down ${getStyles(toast.type)}`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(toast.type)}
            </div>
            <div className="flex-1">
              {toast.title && <h4 className="font-bold text-gray-900 text-xs mb-0.5">{toast.title}</h4>}
              <p className="text-xs text-gray-700 leading-relaxed font-medium">{toast.message}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
              className="text-gray-400 hover:text-gray-600 transition p-0.5 hover:bg-gray-100 rounded"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};