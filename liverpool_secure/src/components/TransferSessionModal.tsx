import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Device } from '../types';
import { ArrowRightLeft, Tv, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { playClickSound } from '../utils/sound';

interface TransferSessionModalProps {
  fromDevice: Device;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const TransferSessionModal: React.FC<TransferSessionModalProps> = ({
  fromDevice,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { devices, transferSession, activeBranch } = useApp();
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const otherDevices = devices.filter(
    d => d.branchId === activeBranch?.id && d.id !== fromDevice.id
  );

  const selectedTargetDev = otherDevices.find(d => d.id === targetDeviceId);
  const isTargetBusy = selectedTargetDev?.status === 'busy' || selectedTargetDev?.status === 'overdue';

  const handleTransfer = () => {
    if (!targetDeviceId) return;
    setErrorMsg('');
    playClickSound();
    const res = transferSession(fromDevice.id, targetDeviceId, 'نقل الجلسة للشاشة الجديدة');
    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-[#252839] mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">نقل أو تبديل الشاشة</h3>
              <p className="text-xs text-gray-400">من {fromDevice.screenNumber} ({fromDevice.type})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-[#202232] text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">
              اختر الشاشة المستهدفة (مثال: من 4 إلى 5):
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
              {otherDevices.map(d => {
                const busy = d.status === 'busy' || d.status === 'overdue';
                const isSelected = targetDeviceId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setTargetDeviceId(d.id);
                    }}
                    className={`p-2.5 rounded-xl border text-right transition flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-red-500 bg-red-950/30 ring-1 ring-red-500/40'
                        : 'border-[#26293d] bg-[#1a1b28] hover:bg-[#202234]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{d.screenNumber}</span>
                      <span className="text-[10px] text-gray-400 font-mono font-bold bg-[#13141f] px-1.5 py-0.5 rounded">
                        {d.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] mt-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          busy ? 'bg-red-500' : 'bg-emerald-500'
                        }`}
                      ></span>
                      <span className={busy ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {busy ? 'مشغولة (لا يمكن النقل)' : 'متاحة للنقل'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {isTargetBusy && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 space-y-1">
              <div className="font-bold">الشاشة المختارة مشغولة حالياً:</div>
              <p className="text-[11px] text-amber-300/80">
                لا يمكن نقل الجلسة إلى جهاز مشغول. اختر جهازاً متاحاً لتجنب تعارض الجلسات.
              </p>
            </div>
          )}

          <div className="p-3 bg-[#191a27] rounded-xl border border-[#25283a] text-[11px] text-gray-400">
            يتم حساب كل فترة بالسعر الخاص بنوع الجهاز ومدة الاستخدام، بدون إعادة احتساب الحد الأدنى عند النقل.
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTransfer}
              disabled={!targetDeviceId || isTargetBusy}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-xs rounded-xl transition shadow-lg shadow-red-950/60 cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>نقل الجلسة للشاشة</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 bg-[#202232] text-gray-400 hover:text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
