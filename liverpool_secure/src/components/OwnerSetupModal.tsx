import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldCheck, UserCheck, Lock, Phone, Mail, User, Key, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { playClickSound } from '../utils/sound';

interface OwnerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OwnerSetupModal: React.FC<OwnerSetupModalProps> = ({ isOpen, onClose }) => {
  const { ownerProfile, registerOwnerAccount, loginWithSupabase } = useApp();
  const [showRegister, setShowRegister] = useState(!ownerProfile);
  const isFirstTime = showRegister;

  // Registration state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bootstrapCode, setBootstrapCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorInput, setTwoFactorInput] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleRegisterOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(''); setSuccessMessage('');
    if (!name.trim() || !phone.trim() || !email.trim() || !pin || !bootstrapCode.trim()) { setErrorMessage('أدخل الاسم والهاتف والبريد وكلمة المرور ورمز تهيئة المالك'); return; }
    if (pin.length < 8) { setErrorMessage('كلمة المرور يجب ألا تقل عن 8 أحرف'); return; }
    if (pin !== confirmPin) { setErrorMessage('كلمتا المرور غير متطابقتين'); return; }
    const result = await registerOwnerAccount({ name: name.trim(), phone: phone.trim(), email: email.trim(), password: pin, bootstrapCode: bootstrapCode.trim() });
    if (result.success) {
      playClickSound();
      setSuccessMessage(result.message);
      setShowRegister(false);
      if (result.requiresEmailConfirmation) {
        // Keep the modal open so the owner can read the confirmation instructions.
        // Avoid encouraging another signup attempt while Supabase email delivery is rate-limited.
        setLoginEmail(email.trim());
        return;
      }
      setTimeout(() => onClose(), 1000);
    } else setErrorMessage(result.message);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMessage(''); setSuccessMessage('');
    const result = await loginWithSupabase(loginEmail.trim(), loginPin);
    if (result.success) {
      playClickSound(); setSuccessMessage(result.message); setTimeout(() => onClose(), 700);
    } else setErrorMessage(result.message);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#151621] border border-[#2c2f42] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-red-900/40 via-red-800/20 to-transparent border-b border-[#25283b] flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-950/60">
            {isFirstTime ? <ShieldCheck className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              {isFirstTime ? 'تهيئة المالك الرئيسي' : 'تسجيل الدخول للنظام'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isFirstTime
                ? 'إنشاء حساب مالك مرتبط بالخادم'
                : 'تسجيل دخول آمن عبر Supabase Auth'}
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {isFirstTime ? (
            <form onSubmit={handleRegisterOwner} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  اسم المالك الكامل <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="مثال: معاذ البلاسي"
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  رقم الهاتف (اسم المستخدم) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">البريد الإلكتروني لتسجيل الدخول *</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="owner@example.com" className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">رمز تهيئة المالك من ملف الخادم *</label>
                <input type="password" required minLength={16} value={bootstrapCode} onChange={e => setBootstrapCode(e.target.value)} placeholder="رمز سري طويل من مدير النظام" className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">
                    كلمة المرور (8 أحرف على الأقل) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-gray-500 absolute right-3 top-3" />
                    <input
                      type="password"
                      minLength={8}
                      required
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      placeholder="8 أحرف على الأقل"
                      className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl pr-9 pl-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">
                    تأكيد كلمة المرور <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute right-3 top-3" />
                    <input
                      type="password"
                      required
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value)}
                      placeholder="كرر الرمز"
                      className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl pr-9 pl-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-red-950/60 cursor-pointer"
              >
                تثبيت المالك وبدء المنظومة
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {!requires2FA ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">
                      البريد الإلكتروني
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="owner@example.com"
                        className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">
                      كلمة المرور
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                      <input
                        type="password"
                        required
                        value={loginPin}
                        onChange={e => setLoginPin(e.target.value)}
                        placeholder="أدخل كلمة المرور"
                        className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl pr-10 pl-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 font-mono"
                      />
                    </div>
                  </div>

                </>
              ) : (
                <div className="space-y-3">
                  <div className="text-center">
                    <Shield className="w-10 h-10 text-red-500 mx-auto mb-2 animate-bounce" />
                    <h4 className="text-sm font-black text-white">التحقق الأمني بخطوتين (2FA)</h4>
                    <p className="text-xs text-gray-400">أدخل رمز التحقق (رمز تجريبي: 123456 أو رمز PIN للمالك)</p>
                  </div>
                  <input
                    type="text"
                    required
                    value={twoFactorInput}
                    onChange={e => setTwoFactorInput(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-[#1b1c29] border-2 border-red-500/60 rounded-xl px-4 py-2.5 text-center font-mono font-black text-white text-lg tracking-widest focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-red-950/60 cursor-pointer"
              >
                {requires2FA ? 'تأكيد رمز التحقق' : 'تسجيل الدخول'}
              </button>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-[#232537] text-center space-y-3">
            <button type="button" onClick={() => { setShowRegister(v => !v); setErrorMessage(''); setSuccessMessage(''); }} className="text-xs text-red-400 hover:text-red-300 font-bold cursor-pointer">
              {isFirstTime ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'إنشاء حساب المالك الأول'}
            </button>
            <button
              onClick={onClose}
              className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
