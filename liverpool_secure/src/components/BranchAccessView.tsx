import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, UserCheck, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';

type MemberRole = 'admin' | 'supervisor' | 'cashier' | 'technician';

interface BranchMember {
  userId: string;
  email: string | null;
  role: MemberRole | null;
  isActive: boolean;
  branchId: string | null;
  createdAt: string;
}

function readAccessToken(): string | null {
  try {
    const ownSession = JSON.parse(localStorage.getItem('lg_supabase_session') || 'null');
    if (typeof ownSession?.access_token === 'string' && ownSession.access_token.length > 20) {
      return ownSession.access_token;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      const token = value?.access_token || value?.currentSession?.access_token || value?.session?.access_token;
      if (typeof token === 'string' && token.length > 20) return token;
    }
  } catch {
    return null;
  }
  return null;
}

export const BranchAccessView: React.FC = () => {
  const { branches, currentUser } = useApp();
  const [members, setMembers] = useState<BranchMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [role, setRole] = useState<MemberRole>('cashier');
  const [branchId, setBranchId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isOwner = Boolean(currentUser?.isOwner);
  const selected = members.find(member => member.userId === selectedUserId) || null;

  const token = readAccessToken;
  const request = useCallback(async (url: string, init: RequestInit = {}) => {
    const accessToken = token();
    if (!accessToken) throw new Error('جلسة Supabase غير موجودة. سجّل الدخول بحساب المالك عبر Supabase Auth.');
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      const message = payload?.error?.message || `فشل الطلب (${response.status})`;
      if (response.status === 401) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.');
      if (response.status === 403) throw new Error('حسابك لا يملك صلاحية إدارة عضويات الفروع.');
      throw new Error(message);
    }
    return payload;
  }, [token]);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await request('/api/admin/members');
      const list = Array.isArray(result.members) ? result.members as BranchMember[] : [];
      setMembers(list);
      setSelectedUserId(current => list.some(item => item.userId === current) ? current : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل حسابات المستخدمين.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (isOwner) void loadMembers();
  }, [isOwner, loadMembers]);

  useEffect(() => {
    if (!selected) return;
    setRole(selected.role && ['admin', 'supervisor', 'cashier', 'technician'].includes(selected.role) ? selected.role : 'cashier');
    setBranchId(selected.branchId || branches[0]?.id || 'liverpool');
    setIsActive(selected.isActive ?? true);
  }, [selected, branches]);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(member =>
      (member.email || '').toLowerCase().includes(needle) ||
      member.userId.toLowerCase().includes(needle)
    );
  }, [members, search]);

  const saveMember = async () => {
    if (!selected) return;
    if (role !== 'admin' && !branchId) {
      setError('اختار الفرع الذي يتبع له الموظف.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await request(`/api/admin/members/${encodeURIComponent(selected.userId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          role,
          branchId: role === 'admin' ? null : branchId,
          isActive,
        }),
      });
      setMembers(previous => previous.map(item => item.userId === selected.userId ? result.member as BranchMember : item));
      setNotice('تم حفظ الدور والفرع وحالة الحساب.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر حفظ صلاحيات الحساب.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-500/20 bg-[#14151e] p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-red-400" />
          <h1 className="text-xl font-black text-white">إدارة صلاحيات الفروع</h1>
          <p className="mt-2 text-sm text-gray-400">هذه الشاشة مخصصة للمالك الرئيسي فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8" dir="rtl">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black text-white">إدارة صلاحيات الفروع</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            اربط حساب Supabase Auth بدور تشغيلي وفرع محدد. الصلاحيات الفعلية يتحقق منها الخادم، وليس مجرد اختيار الفرع في الواجهة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadMembers()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2b2d42] bg-[#1b1c28] px-4 py-2.5 text-sm font-bold text-gray-200 hover:bg-[#25283b] disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث الحسابات
        </button>
      </header>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-sm leading-7 text-amber-100">
        أضف حساب الموظف أولًا من Supabase Auth، ثم اختاره هنا وحدد دوره وفرعه. لا تعيّن فرعًا بالتخمين؛ الحساب غير المربوط بفرع يظل ممنوعًا من بيانات التشغيل.
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{notice}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-[#25283b] bg-[#14151e]">
          <div className="border-b border-[#25283b] p-4">
            <h2 className="flex items-center gap-2 font-black text-white">
              <UserPlus className="h-4 w-4 text-red-400" />
              حسابات Supabase
              <span className="rounded-full bg-[#242638] px-2 py-0.5 text-xs text-gray-300">{members.length}</span>
            </h2>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="ابحث بالبريد أو معرّف الحساب"
              className="mt-3 w-full rounded-xl border border-[#2b2d42] bg-[#0d0e14] px-3 py-2.5 text-sm text-white outline-none focus:border-red-500"
            />
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
            {filteredMembers.map(member => (
              <button
                key={member.userId}
                type="button"
                onClick={() => setSelectedUserId(member.userId)}
                className={`w-full rounded-xl border p-3 text-right transition ${selectedUserId === member.userId ? 'border-red-500/60 bg-red-950/20' : 'border-[#25283b] bg-[#101117] hover:border-[#454961]'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="break-all text-sm font-bold text-white">{member.email || 'حساب بدون بريد ظاهر'}</span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${member.isActive && member.role ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                    {member.role ? (member.isActive ? 'مفعّل' : 'موقوف') : 'غير مربوط'}
                  </span>
                </div>
                <div className="mt-1 break-all font-mono text-[10px] text-gray-500">{member.userId}</div>
                {member.role && <div className="mt-2 text-xs text-gray-400">{member.role} • {member.branchId || 'كل الفروع'}</div>}
              </button>
            ))}
            {!loading && filteredMembers.length === 0 && <p className="py-10 text-center text-sm text-gray-500">لا توجد حسابات مطابقة.</p>}
            {loading && <p className="py-8 text-center text-sm text-gray-400">جارٍ تحميل الحسابات...</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-[#25283b] bg-[#14151e] p-5">
          <h2 className="mb-4 flex items-center gap-2 font-black text-white">
            <UserCheck className="h-4 w-4 text-red-400" />
            تعيين الدور والفرع
          </h2>
          {!selected ? (
            <div className="rounded-xl border border-dashed border-[#35384c] p-8 text-center text-sm text-gray-400">
              اختار حسابًا من القائمة لعرض إعداداته وتعديلها.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#0e0f15] p-3">
                <div className="text-xs text-gray-500">الحساب المحدد</div>
                <div className="mt-1 break-all text-sm font-bold text-white">{selected.email || selected.userId}</div>
                {!selected.role && <div className="mt-2 text-xs text-amber-300">الحساب موجود في Supabase ولم تُمنح له صلاحية التطبيق بعد.</div>}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-gray-300">الدور داخل النظام</span>
                <select value={role} onChange={event => setRole(event.target.value as MemberRole)} className="w-full rounded-xl border border-[#2b2d42] bg-[#0d0e14] px-3 py-3 text-sm text-white outline-none focus:border-red-500">
                  <option value="cashier">كاشير</option>
                  <option value="supervisor">مشرف</option>
                  <option value="technician">فني</option>
                  <option value="admin">إدارة عامة — كل الفروع</option>
                </select>
              </label>

              {role !== 'admin' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-gray-300">الفرع المسموح به</span>
                  <select value={branchId} onChange={event => setBranchId(event.target.value)} className="w-full rounded-xl border border-[#2b2d42] bg-[#0d0e14] px-3 py-3 text-sm text-white outline-none focus:border-red-500">
                    {branches.filter(branch => branch.isActive).map(branch => <option key={branch.id} value={branch.id}>{branch.nameAr || branch.name} ({branch.id})</option>)}
                  </select>
                </label>
              )}

              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#2b2d42] bg-[#101117] p-3">
                <span>
                  <span className="block text-sm font-bold text-white">الحساب مفعّل</span>
                  <span className="block text-xs text-gray-500">إلغاء التفعيل يمنع استدعاءات API لهذا الحساب.</span>
                </span>
                <input type="checkbox" checked={isActive} onChange={event => setIsActive(event.target.checked)} className="h-4 w-4 accent-red-600" />
              </label>

              <button
                type="button"
                onClick={() => void saveMember()}
                disabled={saving}
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'جارٍ الحفظ...' : 'حفظ صلاحيات الحساب'}
              </button>
              {role === 'admin' && <p className="text-xs leading-6 text-amber-200">الدور الإداري يمنح صلاحيات عامة عبر الفروع؛ امنحه فقط لمن يحتاجها فعلًا.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
