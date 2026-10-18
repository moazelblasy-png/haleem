# تنفيذ أمان API والمزامنة — Liverpool Gaming

## ما تغيّر في الكود
- `server/index.cjs`: رفض افتراضي إذا غابت جلسة Supabase Auth؛ التحقق من الجلسة عبر Auth API؛ التحقق من عضوية نشطة ودور محفوظ في قاعدة البيانات؛ كتابة الحالة للمالك/المشرف الإداري فقط؛ منع الكتابة فوق نسخة أحدث عبر `expectedVersion`؛ حدّ لحجم الطلبات؛ رسائل أخطاء آمنة؛ تحقق TLS.
- `POST /api/sync/receipts`: يحفظ إيصالات مزامنة بشكل ذري وقابل لإعادة المحاولة مع idempotency key.
- `src/context/AppContext.tsx`: لا يمسح بيانات الجهاز إذا كانت السحابة فارغة؛ يرسل رمز Supabase Auth فقط؛ يرسل expectedVersion ويتعامل مع تعارض النسخ؛ لا يعلن المزامنة قبل إقرار الخادم.
- `supabase/secure_api_sync.sql`: migration لإنشاء العضويات وإيصالات المزامنة وإضافة version وupdated_by إلى الحالة.

## ما تم على مشروع Supabase المتصل
تم تطبيق migration `secure_api_auth_and_sync_receipts` بنجاح، والتحقق من وجود الجداول الثلاثة مع RLS مفعّل. أضيف أيضًا فهرس `updated_by` بناءً على تنبيه الأداء.

## إعدادات ضرورية قبل تشغيل API
1. نفّذ المستخدم المالك في Supabase Authentication (لا تفعّل التسجيل العام المفتوح). بعد إنشائه، خذ UUID من Authentication ثم أضف العضوية يدويًا من SQL Editor:
   `insert into public.liverpool_app_members(user_id, role) values ('UUID_FROM_AUTH_USERS', 'owner');`
2. أضف في أسرار الاستضافة فقط `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, و`DATABASE_URL`. لا تضع كلمة مرور قاعدة البيانات أو service-role key في الواجهة.
3. **مهم:** واجهة تسجيل الدخول الحالية تعتمد PIN محليًا. هذا ليس تسجيل دخول Supabase Auth، ولذلك ستُرفض طلبات API حتى يتم استكمال شاشة تسجيل الدخول/المالك باستخدام Supabase Auth وإرسال `access_token`. تم تجهيز قراءة الجلسة إذا كانت محفوظة بمفتاح Supabase Auth القياسي، لكن لم يتم بناء تدفق تسجيل الدخول المرئي بالكامل في هذه الجولة.
4. إيصالات المزامنة ليست دفتر معاملات مالية: لا تجعل عملية بيع/مخزون/خزنة تُعتبر مطبقة لمجرد حفظ إيصال. يلزم endpoints محددة لكل أمر مالي تعمل داخل SQL transaction وتتحقق من الفرع والدور قبل اعتماد البيانات.

## التحقق وحدوده
- `node --check server/index.cjs` نجح.
- تم التحقق من تطبيق migration والجداول عبر Supabase.
- لم أستطع تشغيل build/TypeScript tests لأن الاعتماديات غير مثبتة في بيئة العمل. لم يتم ادعاء نجاح build أو اختبار end-to-end.
- لم يتم إنشاء عضوية مالك تلقائيًا؛ يلزم UUID من حساب Auth الصحيح، لتجنب منح مستخدم غير مقصود صلاحية owner.
