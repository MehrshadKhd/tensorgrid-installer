'use strict';

(function initializeI18n() {
    const SUPPORTED_LOCALES = ['en', 'fa', 'ar'];
    const RTL_LOCALES = new Set(['fa', 'ar']);
    const STORAGE_KEY = 'tg.installer.locale';
    const dictionaries = {
        en: {
            'brand.eyebrow': 'TENSORGRID',
            'brand.title': 'Codex Setup',
            'brand.subtitle': 'Securely connect Codex and ChatGPT Desktop to the TensorGrid provider.',
            'actions.refresh': 'Refresh status',
            'actions.close': 'Close',
            'actions.show': 'Show',
            'actions.hide': 'Hide',
            'actions.loadModels': 'Validate token and load models',
            'actions.refreshModels': 'Refresh models',
            'actions.apply': 'Apply settings',
            'actions.changeModel': 'Change model',
            'actions.revert': 'Return to ChatGPT',
            'actions.reverting': 'Restoring…',
            'actions.applying': 'Saving…',
            'actions.checking': 'Checking…',
            'actions.loading': 'Loading…',
            'language.label': 'Language',
            'language.en': 'English',
            'language.fa': 'فارسی',
            'language.ar': 'العربية',
            'theme.label': 'Theme',
            'theme.system': 'System',
            'theme.light': 'Light',
            'theme.dark': 'Dark',
            'status.kicker': 'Active Codex route',
            'status.checking': 'Checking…',
            'status.checkingDescription': 'Provider and ChatGPT Desktop status are being checked.',
            'status.model': 'Current model: {{value}}',
            'status.modelDefault': 'Current model: default',
            'status.home': 'Codex Home: {{value}}',
            'status.checked': 'Last checked: {{value}}',
            'status.chatgpt.kicker': 'Active Codex route',
            'status.chatgpt.title': 'ChatGPT / OpenAI is active',
            'status.chatgpt.description': 'Codex is using the default ChatGPT provider.',
            'status.tensorgrid.kicker': 'Verified connection',
            'status.tensorgrid.title': 'TensorGrid is connected and active',
            'status.tensorgrid.description': '{{count}} authorized models verified with GET /v1/models.',
            'status.tensorgrid.descriptionNoCount': 'The active TensorGrid provider was verified successfully.',
            'status.tensorgridConfigured.kicker': 'TensorGrid settings found',
            'status.tensorgridConfigured.title': 'TensorGrid connection is not verified',
            'status.custom.kicker': 'Custom provider',
            'status.custom.title': 'Another provider is active',
            'status.custom.description': 'Apply to make TensorGrid the default provider.',
            'status.invalid.kicker': 'Configuration error',
            'status.invalid.title': 'config.toml is invalid',
            'status.invalid.description': 'The current file will not be overwritten for safety.',
            'status.locked.kicker': 'Changes temporarily locked',
            'status.locked.title': 'ChatGPT Desktop is open',
            'status.locked.description': 'Quit ChatGPT completely from the system tray to change settings.',
            'status.unknown.kicker': 'Security check failed',
            'status.unknown.title': 'ChatGPT status cannot be verified',
            'status.unknown.description': 'All operations are locked until the process check succeeds.',
            'lock.running.title': 'ChatGPT Desktop must be fully closed',
            'lock.running.description': 'Quit it from the system tray. This page will check again automatically.',
            'lock.unknown.title': 'Process check did not complete',
            'lock.unknown.description': 'No file or setting will be changed until ChatGPT status can be verified.',
            'connection.label': 'Current connection',
            'connection.tensorgrid': 'TensorGrid',
            'connection.active': 'Active',
            'connection.help': 'The stored token is used only by the main process for a read-only check and will not be requested again.',
            'connection.revertHelp': 'Use this action to restore the provider that was active before TensorGrid.',
            'connection.snapshotMissing': 'No restorable snapshot was found. Repair the connection with a valid token first.',
            'connection.drift': 'Codex files changed after activation. Revert is locked to prevent overwriting external changes.',
            'setup.label': 'Setup',
            'setup.title': 'Connect to TensorGrid',
            'setup.repairTitle': 'Repair or update connection',
            'setup.help': 'The token is requested only when needed. Validation uses GET requests only; no inference or POST request is sent.',
            'setup.tokenLabel': 'TensorGrid token',
            'setup.tokenPlaceholder': 'Enter your API token',
            'setup.modelLabel': 'Available model',
            'setup.modelLabelSection': 'Model',
            'setup.modelTitle': 'Choose a Responses model',
            'setup.changeModelTitle': 'Choose a new model',
            'setup.modelHelp': 'Models come from the public TensorGrid catalog and are matched against models authorized for this token.',
            'setup.modelsFound': '{{count}} Responses models found.',
            'setup.preview': 'Change preview',
            'setup.preview.provider': 'Default provider',
            'setup.preview.model': 'Model',
            'setup.preview.baseUrl': 'Base URL',
            'setup.preview.envKey': 'Environment key',
            'setup.preview.files': 'Files',
            'footer.windows': 'Windows native · No telemetry',
            'footer.auth': 'auth.json is never changed',
            'result.apply': 'TensorGrid settings were saved successfully. Fully quit and reopen ChatGPT Desktop and Codex to load them.',
            'result.revert': 'The previous ChatGPT settings were restored successfully. Fully quit and reopen ChatGPT Desktop.',
            'confirm.revert': 'Restore the settings from before TensorGrid? auth.json will not be changed.',
            'error.generic': 'Something went wrong. Please try again.',
            'error.TOKEN_UNAUTHORIZED': 'The token is invalid or has been revoked.',
            'error.NETWORK_TIMEOUT': 'The connection check timed out.',
            'error.NO_RESPONSES_MODELS': 'The token is valid, but no Responses models are available.',
            'error.CONNECTION_FAILED': 'The TensorGrid connection could not be verified.',
            'error.PROCESS_CHECK_FAILED': 'ChatGPT Desktop status could not be verified; changes are locked for safety.',
            'error.CHATGPT_RUNNING': 'ChatGPT Desktop is open. Fully quit it from the system tray and try again.',
            'error.TOKEN_REQUIRED': 'Enter your TensorGrid token.',
            'error.MODEL_REQUIRED': 'Choose a Responses model.',
            'error.MODEL_NOT_AUTHORIZED': 'The selected model is no longer authorized. Refresh the model list.',
            'error.CONFIG_DRIFT': 'Codex files changed after activation. Review them before attempting a restore.',
            'error.REVERT_UNAVAILABLE': 'No previous Codex settings snapshot was found.',
            'error.VERIFY_FAILED': 'The saved settings could not be verified.',
            'error.REQUEST_INVALID': 'The setup request is invalid.',
            'error.WRITE_PERMISSION': 'Codex Home cannot be written. Check folder permissions.',
            'error.FILE_IN_USE': 'A Codex file is in use. Fully quit ChatGPT Desktop and Codex, then try again.',
            'error.WRITE_FAILED': 'Codex files were not saved; all changes were rolled back.',
            'error.UNSUPPORTED_PLATFORM': 'This installer supports Windows native only.',
            'error.UNKNOWN_ERROR': 'Setup could not be completed. Please try again.'
        },
        fa: {
            'brand.eyebrow': 'TENSORGRID',
            'brand.title': 'راه‌اندازی Codex',
            'brand.subtitle': 'اتصال امن Codex و ChatGPT Desktop به provider اختصاصی TensorGrid.',
            'actions.refresh': 'بازخوانی وضعیت',
            'actions.close': 'بستن',
            'actions.show': 'نمایش',
            'actions.hide': 'مخفی‌کردن',
            'actions.loadModels': 'اعتبارسنجی token و دریافت مدل‌ها',
            'actions.refreshModels': 'بازخوانی مدل‌ها',
            'actions.apply': 'اعمال تنظیمات',
            'actions.changeModel': 'تغییر مدل',
            'actions.revert': 'بازگشت به ChatGPT',
            'actions.reverting': 'در حال بازگردانی…',
            'actions.applying': 'در حال ذخیره…',
            'actions.checking': 'در حال بررسی…',
            'actions.loading': 'در حال دریافت…',
            'language.label': 'زبان',
            'language.en': 'English',
            'language.fa': 'فارسی',
            'language.ar': 'العربية',
            'theme.label': 'پوسته',
            'theme.system': 'سیستم',
            'theme.light': 'روشن',
            'theme.dark': 'تیره',
            'status.kicker': 'مسیر فعال Codex',
            'status.checking': 'در حال بررسی…',
            'status.checkingDescription': 'وضعیت provider و ChatGPT Desktop در حال بررسی است.',
            'status.model': 'مدل فعلی: {{value}}',
            'status.modelDefault': 'مدل فعلی: پیش‌فرض',
            'status.home': 'Codex Home: {{value}}',
            'status.checked': 'آخرین بررسی: {{value}}',
            'status.chatgpt.kicker': 'مسیر فعال Codex',
            'status.chatgpt.title': 'ChatGPT / OpenAI فعال است',
            'status.chatgpt.description': 'Codex از provider اصلی ChatGPT استفاده می‌کند.',
            'status.tensorgrid.kicker': 'اتصال تأییدشده',
            'status.tensorgrid.title': 'TensorGrid متصل و فعال است',
            'status.tensorgrid.description': '{{count}} مدل مجاز با GET /v1/models تأیید شد.',
            'status.tensorgrid.descriptionNoCount': 'provider فعال TensorGrid با موفقیت تأیید شد.',
            'status.tensorgridConfigured.kicker': 'تنظیمات TensorGrid پیدا شد',
            'status.tensorgridConfigured.title': 'اتصال TensorGrid تأیید نشد',
            'status.custom.kicker': 'Provider سفارشی',
            'status.custom.title': 'یک provider دیگر فعال است',
            'status.custom.description': 'با Apply می‌توانید TensorGrid را به‌عنوان provider پیش‌فرض فعال کنید.',
            'status.invalid.kicker': 'خطای پیکربندی',
            'status.invalid.title': 'config.toml معتبر نیست',
            'status.invalid.description': 'برای جلوگیری از آسیب، فایل فعلی overwrite نمی‌شود.',
            'status.locked.kicker': 'تغییرات موقتاً قفل است',
            'status.locked.title': 'ChatGPT Desktop باز است',
            'status.locked.description': 'ChatGPT را از System Tray کاملاً Quit کنید.',
            'status.unknown.kicker': 'بررسی امنیتی ناموفق بود',
            'status.unknown.title': 'وضعیت ChatGPT قابل بررسی نیست',
            'status.unknown.description': 'تمام عملیات تا موفق‌شدن بررسی process قفل شده‌اند.',
            'lock.running.title': 'ChatGPT Desktop باید کاملاً بسته باشد',
            'lock.running.description': 'آن را از System Tray با گزینه Quit ببندید؛ این صفحه خودکار دوباره بررسی می‌کند.',
            'lock.unknown.title': 'بررسی process کامل نشد',
            'lock.unknown.description': 'تا زمانی که وضعیت ChatGPT قابل تأیید نباشد، هیچ فایل یا تنظیمی تغییر نمی‌کند.',
            'connection.label': 'اتصال فعلی',
            'connection.tensorgrid': 'TensorGrid',
            'connection.active': 'فعال',
            'connection.help': 'توکن ذخیره‌شده فقط در process اصلی برای بررسی read-only استفاده می‌شود و دوباره از شما درخواست نمی‌شود.',
            'connection.revertHelp': 'برای بازگرداندن provider قبل از TensorGrid از این دکمه استفاده کنید.',
            'connection.snapshotMissing': 'snapshot قابل بازگردانی پیدا نشد؛ ابتدا اتصال را با token معتبر تعمیر کنید.',
            'connection.drift': 'فایل‌های Codex بعد از فعال‌سازی تغییر کرده‌اند؛ برای جلوگیری از overwrite، revert قفل است.',
            'setup.label': 'راه‌اندازی',
            'setup.title': 'اتصال به TensorGrid',
            'setup.repairTitle': 'تعمیر یا به‌روزرسانی اتصال',
            'setup.help': 'توکن فقط در صورت نیاز دریافت می‌شود. اعتبارسنجی فقط با GET انجام می‌شود و هیچ inference یا درخواست POST ارسال نمی‌شود.',
            'setup.tokenLabel': 'توکن TensorGrid',
            'setup.tokenPlaceholder': 'توکن API را وارد کنید',
            'setup.modelLabel': 'مدل قابل استفاده',
            'setup.modelLabelSection': 'مدل',
            'setup.modelTitle': 'انتخاب مدل Responses',
            'setup.changeModelTitle': 'انتخاب مدل جدید',
            'setup.modelHelp': 'مدل‌ها از catalog عمومی TensorGrid گرفته و با مدل‌های مجاز token تطبیق داده می‌شوند.',
            'setup.modelsFound': '{{count}} مدل Responses پیدا شد.',
            'setup.preview': 'پیش‌نمایش تغییرات',
            'setup.preview.provider': 'Provider پیش‌فرض',
            'setup.preview.model': 'Model',
            'setup.preview.baseUrl': 'Base URL',
            'setup.preview.envKey': 'Environment key',
            'setup.preview.files': 'فایل‌ها',
            'footer.windows': 'Windows native · بدون telemetry',
            'footer.auth': 'auth.json بدون تغییر',
            'result.apply': 'تنظیمات TensorGrid با موفقیت ذخیره شد. برای بارگذاری، ChatGPT Desktop و Codex را کاملاً Quit و دوباره باز کنید.',
            'result.revert': 'تنظیمات قبلی ChatGPT با موفقیت بازگردانده شد. ChatGPT Desktop را کاملاً Quit و دوباره باز کنید.',
            'confirm.revert': 'تنظیمات قبل از TensorGrid برگردانده شود؟ auth.json تغییر نخواهد کرد.',
            'error.generic': 'خطایی رخ داد. دوباره تلاش کنید.',
            'error.TOKEN_UNAUTHORIZED': 'توکن معتبر نیست یا revoke شده است.',
            'error.NETWORK_TIMEOUT': 'بررسی اتصال بیش از حد طول کشید.',
            'error.NO_RESPONSES_MODELS': 'توکن معتبر است، اما مدل Responses در دسترس نیست.',
            'error.CONNECTION_FAILED': 'اتصال TensorGrid تأیید نشد.',
            'error.PROCESS_CHECK_FAILED': 'وضعیت ChatGPT Desktop قابل بررسی نیست؛ برای امنیت تغییرات قفل شد.',
            'error.CHATGPT_RUNNING': 'ChatGPT Desktop باز است؛ آن را از System Tray کاملاً Quit کنید.',
            'error.TOKEN_REQUIRED': 'توکن TensorGrid را وارد کنید.',
            'error.MODEL_REQUIRED': 'یک مدل Responses انتخاب کنید.',
            'error.MODEL_NOT_AUTHORIZED': 'مدل انتخاب‌شده دیگر مجاز نیست؛ فهرست مدل‌ها را refresh کنید.',
            'error.CONFIG_DRIFT': 'فایل‌های Codex بعد از فعال‌سازی تغییر کرده‌اند؛ قبل از بازگردانی آن‌ها را بررسی کنید.',
            'error.REVERT_UNAVAILABLE': 'snapshot قبلی تنظیمات Codex پیدا نشد.',
            'error.VERIFY_FAILED': 'تنظیمات ذخیره‌شده قابل تأیید نیست.',
            'error.REQUEST_INVALID': 'درخواست راه‌اندازی معتبر نیست.',
            'error.WRITE_PERMISSION': 'امکان نوشتن در Codex Home وجود ندارد؛ دسترسی پوشه را بررسی کنید.',
            'error.FILE_IN_USE': 'یکی از فایل‌های Codex در حال استفاده است؛ ChatGPT Desktop و Codex را ببندید.',
            'error.WRITE_FAILED': 'فایل‌های Codex ذخیره نشدند و تغییرات rollback شد.',
            'error.UNSUPPORTED_PLATFORM': 'این installer فقط برای Windows native است.',
            'error.UNKNOWN_ERROR': 'راه‌اندازی انجام نشد. دوباره تلاش کنید.'
        },
        ar: {
            'brand.eyebrow': 'TENSORGRID',
            'brand.title': 'إعداد Codex',
            'brand.subtitle': 'اربط Codex وChatGPT Desktop بأمان بموفر TensorGrid.',
            'actions.refresh': 'تحديث الحالة',
            'actions.close': 'إغلاق',
            'actions.show': 'إظهار',
            'actions.hide': 'إخفاء',
            'actions.loadModels': 'التحقق من الرمز وتحميل النماذج',
            'actions.refreshModels': 'تحديث النماذج',
            'actions.apply': 'تطبيق الإعدادات',
            'actions.changeModel': 'تغيير النموذج',
            'actions.revert': 'العودة إلى ChatGPT',
            'actions.reverting': 'جارٍ الاستعادة…',
            'actions.applying': 'جارٍ الحفظ…',
            'actions.checking': 'جارٍ التحقق…',
            'actions.loading': 'جارٍ التحميل…',
            'language.label': 'اللغة',
            'language.en': 'English',
            'language.fa': 'فارسی',
            'language.ar': 'العربية',
            'theme.label': 'المظهر',
            'theme.system': 'النظام',
            'theme.light': 'فاتح',
            'theme.dark': 'داكن',
            'status.kicker': 'مسار Codex النشط',
            'status.checking': 'جارٍ التحقق…',
            'status.checkingDescription': 'جارٍ التحقق من حالة الموفر وChatGPT Desktop.',
            'status.model': 'النموذج الحالي: {{value}}',
            'status.modelDefault': 'النموذج الحالي: الافتراضي',
            'status.home': 'Codex Home: {{value}}',
            'status.checked': 'آخر تحقق: {{value}}',
            'status.chatgpt.kicker': 'مسار Codex النشط',
            'status.chatgpt.title': 'ChatGPT / OpenAI نشط',
            'status.chatgpt.description': 'يستخدم Codex موفر ChatGPT الافتراضي.',
            'status.tensorgrid.kicker': 'اتصال تم التحقق منه',
            'status.tensorgrid.title': 'TensorGrid متصل ونشط',
            'status.tensorgrid.description': 'تم التحقق من {{count}} نموذجاً مصرحاً عبر GET /v1/models.',
            'status.tensorgrid.descriptionNoCount': 'تم التحقق من موفر TensorGrid النشط بنجاح.',
            'status.tensorgridConfigured.kicker': 'تم العثور على إعدادات TensorGrid',
            'status.tensorgridConfigured.title': 'لم يتم التحقق من اتصال TensorGrid',
            'status.custom.kicker': 'موفر مخصص',
            'status.custom.title': 'موفر آخر نشط',
            'status.custom.description': 'اضغط Apply لجعل TensorGrid الموفر الافتراضي.',
            'status.invalid.kicker': 'خطأ في الإعداد',
            'status.invalid.title': 'config.toml غير صالح',
            'status.invalid.description': 'لن يتم استبدال الملف الحالي حفاظاً على الأمان.',
            'status.locked.kicker': 'التغييرات مقفلة مؤقتاً',
            'status.locked.title': 'ChatGPT Desktop مفتوح',
            'status.locked.description': 'أغلق ChatGPT تماماً من علبة النظام لتغيير الإعدادات.',
            'status.unknown.kicker': 'فشل فحص الأمان',
            'status.unknown.title': 'تعذر التحقق من حالة ChatGPT',
            'status.unknown.description': 'كل العمليات مقفلة حتى ينجح فحص العملية.',
            'lock.running.title': 'يجب إغلاق ChatGPT Desktop تماماً',
            'lock.running.description': 'أغلقه من علبة النظام. ستعيد هذه الصفحة الفحص تلقائياً.',
            'lock.unknown.title': 'لم يكتمل فحص العملية',
            'lock.unknown.description': 'لن يتم تغيير أي ملف أو إعداد حتى يمكن التحقق من حالة ChatGPT.',
            'connection.label': 'الاتصال الحالي',
            'connection.tensorgrid': 'TensorGrid',
            'connection.active': 'نشط',
            'connection.help': 'يُستخدم الرمز المخزن فقط من العملية الرئيسية لفحص للقراءة فقط ولن يُطلب مرة أخرى.',
            'connection.revertHelp': 'استخدم هذا الإجراء لاستعادة الموفر الذي كان نشطاً قبل TensorGrid.',
            'connection.snapshotMissing': 'لم يتم العثور على نسخة احتياطية قابلة للاستعادة. أصلح الاتصال برمز صالح أولاً.',
            'connection.drift': 'تم تغيير ملفات Codex بعد التفعيل. تم قفل الاستعادة لمنع الكتابة فوق التغييرات الخارجية.',
            'setup.label': 'الإعداد',
            'setup.title': 'الاتصال بـ TensorGrid',
            'setup.repairTitle': 'إصلاح أو تحديث الاتصال',
            'setup.help': 'يُطلب الرمز عند الحاجة فقط. يستخدم التحقق طلبات GET فقط؛ لا يتم إرسال inference أو POST.',
            'setup.tokenLabel': 'رمز TensorGrid',
            'setup.tokenPlaceholder': 'أدخل رمز API',
            'setup.modelLabel': 'النموذج المتاح',
            'setup.modelLabelSection': 'النموذج',
            'setup.modelTitle': 'اختر نموذج Responses',
            'setup.changeModelTitle': 'اختر نموذجاً جديداً',
            'setup.modelHelp': 'تأتي النماذج من كتالوج TensorGrid العام وتُطابق مع النماذج المصرح بها لهذا الرمز.',
            'setup.modelsFound': 'تم العثور على {{count}} من نماذج Responses.',
            'setup.preview': 'معاينة التغييرات',
            'setup.preview.provider': 'الموفر الافتراضي',
            'setup.preview.model': 'النموذج',
            'setup.preview.baseUrl': 'Base URL',
            'setup.preview.envKey': 'Environment key',
            'setup.preview.files': 'الملفات',
            'footer.windows': 'Windows native · بدون telemetry',
            'footer.auth': 'لا يتم تغيير auth.json',
            'result.apply': 'تم حفظ إعدادات TensorGrid بنجاح. أغلق ChatGPT Desktop وCodex تماماً ثم أعد فتحهما.',
            'result.revert': 'تمت استعادة إعدادات ChatGPT السابقة بنجاح. أغلق ChatGPT Desktop تماماً ثم أعد فتحه.',
            'confirm.revert': 'هل تريد استعادة الإعدادات السابقة لـ TensorGrid؟ لن يتم تغيير auth.json.',
            'error.generic': 'حدث خطأ. حاول مرة أخرى.',
            'error.TOKEN_UNAUTHORIZED': 'الرمز غير صالح أو تم إلغاؤه.',
            'error.NETWORK_TIMEOUT': 'انتهت مهلة فحص الاتصال.',
            'error.NO_RESPONSES_MODELS': 'الرمز صالح، ولكن لا توجد نماذج Responses متاحة.',
            'error.CONNECTION_FAILED': 'تعذر التحقق من اتصال TensorGrid.',
            'error.PROCESS_CHECK_FAILED': 'تعذر التحقق من ChatGPT Desktop؛ تم قفل التغييرات للأمان.',
            'error.CHATGPT_RUNNING': 'ChatGPT Desktop مفتوح. أغلقه تماماً من علبة النظام ثم حاول مرة أخرى.',
            'error.TOKEN_REQUIRED': 'أدخل رمز TensorGrid.',
            'error.MODEL_REQUIRED': 'اختر نموذج Responses.',
            'error.MODEL_NOT_AUTHORIZED': 'لم يعد النموذج المحدد مصرحاً به. حدّث قائمة النماذج.',
            'error.CONFIG_DRIFT': 'تم تغيير ملفات Codex بعد التفعيل. راجعها قبل الاستعادة.',
            'error.REVERT_UNAVAILABLE': 'لم يتم العثور على نسخة سابقة من إعدادات Codex.',
            'error.VERIFY_FAILED': 'تعذر التحقق من الإعدادات المحفوظة.',
            'error.REQUEST_INVALID': 'طلب الإعداد غير صالح.',
            'error.WRITE_PERMISSION': 'لا يمكن الكتابة في Codex Home. تحقق من صلاحيات المجلد.',
            'error.FILE_IN_USE': 'أحد ملفات Codex قيد الاستخدام. أغلق ChatGPT Desktop وCodex تماماً ثم حاول.',
            'error.WRITE_FAILED': 'لم يتم حفظ ملفات Codex؛ تم التراجع عن كل التغييرات.',
            'error.UNSUPPORTED_PLATFORM': 'هذا المثبت يدعم Windows native فقط.',
            'error.UNKNOWN_ERROR': 'تعذر إكمال الإعداد. حاول مرة أخرى.'
        }
    };

    let activeLocale = readStoredLocale() || 'en';
    const listeners = new Set();

    function readStoredLocale() {
        try {
            const value = window.localStorage.getItem(STORAGE_KEY);
            return SUPPORTED_LOCALES.includes(value) ? value : null;
        } catch (_error) {
            return null;
        }
    }

    function getLocale() {
        return activeLocale;
    }

    function formatValue(value) {
        return value === undefined || value === null ? '' : String(value);
    }

    function translate(key, params = {}) {
        const value = dictionaries[activeLocale][key] || dictionaries.en[key] || key;
        return value.replace(/\{\{(\w+)\}\}/g, (_match, name) => formatValue(params[name]));
    }

    function formatNumber(value) {
        return new Intl.NumberFormat(activeLocale).format(value);
    }

    function formatDateTime(value) {
        return new Intl.DateTimeFormat(activeLocale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(new Date(value));
    }

    function applyStaticTranslations() {
        document.documentElement.lang = activeLocale;
        document.documentElement.dir = RTL_LOCALES.has(activeLocale) ? 'rtl' : 'ltr';
        document.querySelectorAll('[data-i18n]').forEach(element => {
            element.textContent = translate(element.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            element.placeholder = translate(element.dataset.i18nPlaceholder);
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
            element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel));
        });
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            element.title = translate(element.dataset.i18nTitle);
        });
    }

    function setLocale(locale) {
        if (!SUPPORTED_LOCALES.includes(locale) || locale === activeLocale) {
            applyStaticTranslations();
            return;
        }
        activeLocale = locale;
        try {
            window.localStorage.setItem(STORAGE_KEY, locale);
        } catch (_error) {
            // Keep the choice in memory if storage is unavailable.
        }
        applyStaticTranslations();
        listeners.forEach(listener => listener(activeLocale));
        document.dispatchEvent(new CustomEvent('tg:locale-changed', { detail: activeLocale }));
    }

    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    function getTranslationKeys(locale = activeLocale) {
        return Object.keys(dictionaries[locale] || {});
    }

    window.tensorgridI18n = {
        SUPPORTED_LOCALES,
        getLocale,
        setLocale,
        translate,
        formatNumber,
        formatDateTime,
        getTranslationKeys,
        onChange,
        applyStaticTranslations
    };
})();
