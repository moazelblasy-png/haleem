import React from 'react';
import { Play, ShieldCheck, Gamepad2, Coffee, CalendarCheck2, X, Sparkles, Key, BellRing } from 'lucide-react';
import { playClickSound } from '../utils/sound';

interface QuickStartGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export const QuickStartGuideModal: React.FC<QuickStartGuideModalProps> = ({ isOpen, onClose, onNavigate }) => {
  if (!isOpen) return null;

  const steps = [
    {
      num: 1,
      title: 'إعداد حساب المالك الرئيسي والتحقق بخطوتين',
      desc: 'تعيين اسم المالك، رقم الهاتف، رمز PIN السري، وخيار التحقق الأمني 2FA لإدارة كافة الفروع.',
      icon: ShieldCheck,
      color: 'text-red-500 bg-red-600/20 border-red-500/40',
      actionText: 'إعداد المالك',
      actionView: 'owner',
    },
    {
      num: 2,
      title: 'تهيئة الأجهزة والشاشات (7 أجهزة / 8 لتشيلسي)',
      desc: 'إدراج 7 شاشات لكل فرع، و8 شاشات لفرع تشيلسي، مع تحديد PS4 أو PS5 لكل شاشة.',
      icon: Gamepad2,
      color: 'text-blue-400 bg-blue-600/20 border-blue-500/40',
      actionText: 'عرض الأجهزة',
      actionView: 'devices',
    },
    {
      num: 3,
      title: 'بدء الجلسات والمنبه الصوتي الذكي (قبل 5 دقائق وعند الانتهاء)',
      desc: 'تشغيل الجلسات (مفتوحة / بوقت / بميزانية) مع إطلاق منبه صوتي قبل 5 دقائق من انتهاء الجلسة وعند الانتهاء بالضبط.',
      icon: BellRing,
      color: 'text-amber-400 bg-amber-600/20 border-amber-500/40',
      actionText: 'لوحة التحكم',
      actionView: 'dashboard',
    },
    {
      num: 4,
      title: 'إدارة كلمات سر الموظفين والخصومات والإجازات',
      desc: 'المالك يتحكم بكلمات سر الموظفين وتطبيق الخصومات والموافقة على الإجازات، بينما الموظف يرى راتبه فقط.',
      icon: Key,
      color: 'text-purple-400 bg-purple-600/20 border-purple-500/40',
      actionText: 'شؤون الموظفين',
      actionView: 'employees',
    },
    {
      num: 5,
      title: 'استلام الشفت وترحيل الجلسات المفتوحة آلياً',
      desc: 'جرد الدرج والأجهزة وإغلاق الوردية، مع ترحيل أي جلسة مفتوحة لم تحاسب إلى الشفت التالي تلقائياً.',
      icon: CalendarCheck2,
      color: 'text-emerald-400 bg-emerald-600/20 border-emerald-500/40',
      actionText: 'تسليم الوردية',
      actionView: 'shifts',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#141520] border-2 border-red-600/60 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-red-950/60 via-red-900/30 to-[#141520] border-b border-[#242637] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white shadow-lg shadow-red-950/80">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">دليل تشغيل منظومة Liverpool Gaming</h3>
              <p className="text-xs text-red-200">الخطوات السريعة لتشغيل وإدارة مركز الألعاب باحترافية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1e2030] hover:bg-red-950/40 text-gray-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps List */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {steps.map(step => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="bg-[#171825] border border-[#25283c] rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-red-600/40 transition"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${step.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-red-500">#{step.num}</span>
                      <h4 className="text-sm font-black text-white">{step.title}</h4>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    playClickSound();
                    onClose();
                    if (step.actionView !== 'owner') {
                      onNavigate(step.actionView);
                    }
                  }}
                  className="px-4 py-2 bg-[#202234] hover:bg-red-600 text-gray-200 hover:text-white text-xs font-bold rounded-xl transition whitespace-nowrap self-end sm:self-center shrink-0 border border-[#2e3148] hover:border-red-500 cursor-pointer"
                >
                  {step.actionText}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#101118] border-t border-[#202232] text-center">
          <button
            onClick={() => {
              playClickSound();
              onClose();
            }}
            className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/60 cursor-pointer"
          >
            فهمت، ابدأ العمل الآن
          </button>
        </div>
      </div>
    </div>
  );
};
