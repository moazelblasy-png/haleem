import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Device, DeviceStatus } from '../types';
import {
  Gamepad2,
  Tv,
  Plus,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Clock,
  Sparkles
} from 'lucide-react';
import { ConsoleIcon } from './ConsoleIcon';
import { playClickSound } from '../utils/sound';

export const DevicesView: React.FC = () => {
  const {
    devices,
    addDevice,
    updateDevice,
    deleteDevice,
    activeBranch,
    populateDefaultBranchDevices,
    currentUser
  } = useApp();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [screenNumber, setScreenNumber] = useState('');
  const [name, setName] = useState('');
  const [deviceType, setDeviceType] = useState<'PS4' | 'PS5'>('PS5');
  const [installedGamesStr, setInstalledGamesStr] = useState('FC 24, GTA V, Call of Duty: MW III, Spider-Man 2');

  const branchDevices = devices.filter(d => d.branchId === activeBranch?.id);

  const handleSaveDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenNumber.trim()) return;
    const games = installedGamesStr.split(',').map(g => g.trim()).filter(Boolean);
    if (editingDevice) {
      updateDevice(editingDevice.id, {
        screenNumber: screenNumber.trim(),
        name: name.trim() || `${deviceType} - ${screenNumber.trim()}`,
        type: deviceType,
        installedGames: games,
      });
      setEditingDevice(null);
    } else {
      addDevice({
        screenNumber: screenNumber.trim(),
        name: name.trim() || `${deviceType} - ${screenNumber.trim()}`,
        type: deviceType,
        branchId: activeBranch?.id || 'liverpool',
        installedGames: games,
      });
    }
    setShowAddModal(false);
    setScreenNumber('');
    setName('');
    playClickSound();
  };

  const handleToggleMaintenance = (device: Device) => {
    playClickSound();
    const newStatus: DeviceStatus = device.status === 'maintenance' ? 'available' : 'maintenance';
    updateDevice(device.id, { status: newStatus });
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white">إدارة الأجهزة والشاشات</h1>
            <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center">
              <Gamepad2 className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            إدارة أجهزة PS4 و PS5، تعيين الألعاب المثبتة، وأوضاع الصيانة
          </p>
        </div>

        <div className="flex items-center gap-3">
          {branchDevices.length === 0 && (
            <button
              onClick={() => {
                playClickSound();
                populateDefaultBranchDevices(activeBranch?.id || 'liverpool');
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-red-950/60"
            >
              <Sparkles className="w-4 h-4" />
              <span>تهيئة أجهزة الفرع الافتراضية (7 أجهزة / 8 لتشيلسي)</span>
            </button>
          )}

          <button
            onClick={() => {
              playClickSound();
              setEditingDevice(null);
              setScreenNumber(`شاشة ${String(branchDevices.length + 1).padStart(2, '0')}`);
              setName('');
              setShowAddModal(true);
            }}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-red-950/60 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة شاشة جديدة</span>
          </button>
        </div>
      </div>

      {/* Devices List Table */}
      <div className="bg-[#14151e] border border-[#232535] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#202232] text-gray-400 bg-[#171824]">
                <th className="py-4 px-4 font-bold">رقم الشاشة</th>
                <th className="py-4 px-4 font-bold">النوع</th>
                <th className="py-4 px-4 font-bold">اسم الجهاز</th>
                <th className="py-4 px-4 font-bold">الألعاب المثبتة</th>
                <th className="py-4 px-4 font-bold text-center">الحالة</th>
                <th className="py-4 px-4 font-bold text-center w-28">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b1c28]">
              {branchDevices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 text-xs">
                    لا توجد أجهزة مسجلة في هذا الفرع. اضغط على "تهيئة أجهزة الفرع الافتراضية" لإنشاء العدد الافتراضي فوراً.
                  </td>
                </tr>
              ) : (
                branchDevices.map(dev => (
                  <tr key={dev.id} className="hover:bg-[#181926] text-gray-200 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-white">
                      <span className="bg-[#1b1d28] border border-[#2b2d3d] px-2.5 py-1 rounded-lg">
                        {dev.screenNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-red-400">
                      <div className="flex items-center gap-2">
                        <ConsoleIcon type={dev.type} size="sm" />
                        <span>{dev.type}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">{dev.name}</td>
                    <td className="py-3.5 px-4 text-gray-400">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {dev.installedGames.map((g, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[#1b1c28] rounded text-[10px] text-gray-300">
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                          dev.status === 'available'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                            : dev.status === 'maintenance'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                            : 'bg-red-950/60 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {dev.status === 'available' ? 'متاح' : dev.status === 'maintenance' ? 'صيانة' : 'مشغول'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleToggleMaintenance(dev)}
                          title={dev.status === 'maintenance' ? 'إعادة الجهاز للخدمة' : 'تحويل الجهاز للصيانة'}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            dev.status === 'maintenance'
                              ? 'bg-amber-600 text-white'
                              : 'bg-[#1e2030] text-gray-400 hover:text-amber-400'
                          }`}
                        >
                          <Wrench className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            playClickSound();
                            setEditingDevice(dev);
                            setScreenNumber(dev.screenNumber);
                            setName(dev.name);
                            setDeviceType(dev.type);
                            setInstalledGamesStr(dev.installedGames.join(', '));
                            setShowAddModal(true);
                          }}
                          className="p-1.5 rounded-lg bg-[#1e2030] text-gray-400 hover:text-white transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {currentUser?.isOwner && (
                          <button
                            onClick={() => {
                              playClickSound();
                              deleteDevice(dev.id);
                            }}
                            className="p-1.5 rounded-lg bg-[#1e2030] text-gray-400 hover:text-red-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#151622] border border-[#2c2f44] rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-black text-white mb-4 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-red-500" />
              <span>{editingDevice ? 'تعديل بيانات الشاشة' : 'إضافة شاشة جديدة'}</span>
            </h3>
            <form onSubmit={handleSaveDevice} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">نوع الكونسول</label>
                  <select
                    value={deviceType}
                    onChange={e => setDeviceType(e.target.value as any)}
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-mono font-bold"
                  >
                    <option value="PS5">PlayStation 5</option>
                    <option value="PS4">PlayStation 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">رقم الشاشة</label>
                  <input
                    type="text"
                    required
                    value={screenNumber}
                    onChange={e => setScreenNumber(e.target.value)}
                    placeholder="شاشة 01"
                    className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">اسم تعريفي (اختياري)</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="PlayStation 5 - #1"
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  الألعاب المثبتة (مفصولة بفواصل)
                </label>
                <textarea
                  rows={3}
                  value={installedGamesStr}
                  onChange={e => setInstalledGamesStr(e.target.value)}
                  className="w-full bg-[#1b1c29] border border-[#2b2e42] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-500"
                ></textarea>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  {editingDevice ? 'تحديث الشاشة' : 'حفظ الشاشة'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-[#1f212f] text-gray-400 hover:text-white rounded-xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
