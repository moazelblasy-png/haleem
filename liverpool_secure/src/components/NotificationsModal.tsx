import React from 'react';
import { useApp } from '../context/AppContext';
import { Bell, CheckCircle2, AlertTriangle, Info, X, Trash2, BellRing } from 'lucide-react';
import { playClickSound } from '../utils/sound';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationRead, clearAllNotifications } = useApp();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-[#252839] mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">مركز الإشعارات والتنبيهات</h3>
              <p className="text-xs text-gray-400">تنبيهات انتهاء الجلسات والشفتات والمخزون</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-[#202232] text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {notifications.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-xs">
            لا توجد إشعارات جديدة حالياً
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto">
            {notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => {
                  playClickSound();
                  markNotificationRead(notif.id);
                }}
                className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                  notif.isRead
                    ? 'bg-[#181926] border-[#222436] opacity-75'
                    : 'bg-[#1e1f2f] border-red-500/40 shadow-md'
                }`}
              >
                <div className="mt-0.5">
                  {notif.type === 'alert' || notif.type === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : notif.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">{notif.title}</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {new Date(notif.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1 leading-relaxed">{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-[#232537] flex items-center justify-between gap-2">
          {notifications.length > 0 && (
            <button
              onClick={() => {
                playClickSound();
                clearAllNotifications();
              }}
              className="px-3 py-2 bg-[#202232] hover:bg-red-950/40 text-gray-400 hover:text-red-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح الكل</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#1e2030] hover:bg-[#282a3e] text-gray-300 font-bold text-xs rounded-xl cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
