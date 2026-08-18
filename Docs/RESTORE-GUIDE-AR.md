# دليل الاستعادة (العربية)

كيفية استرجاع أي شيء أزالته أو غيّرته أدوات knoux Repair.

## 1. قبل البدء

- شغّل الأدوات في وضع **تحليل فقط** أولاً (مفتاح `A` في القائمة، أو `-AnalyzeOnly` في سطر الأوامر).
- على الجهاز الفعلي، شغّل بحساب بصلاحيات مسؤول ووافق على إنشاء نقطة استعادة عند الطلب.

## 2. استرجاع الملفات المحجورة

أي ملف يُحذف يُنقل أولاً إلى `Quarantine\<session>-<timestamp>\` ولا يُحذف نهائيًا.

1. افتح مجلد `Quarantine\` بجوار المشروع.
2. اختر المجلد المطابق لتوقيت التشغيل.
3. استرجع عنصرًا واحدًا:
   ```powershell
   Import-Module ".\Core\KnouxRepair.Core.psm1" -Force
   Restore-KnouxQuarantinedItem -QuarantinePath "Quarantine\20260803-101500-SC01" -Name "filename.ext"
   ```
4. أو انسخ الملفات يدويًا إلى موقعها الأصلي (المسار الأصلي مكتوب في `restore-info.json`).

## 3. استعادة النظام

1. **لوحة التحكم > الاسترداد > فتح استعادة النظام**.
2. اختر نقطة الاستعادة التي أُنشئت قبل التشغيل واتبع المعالج.

## 4. مجلدات تحديث ويندوز (SM06)

SM06 يعيد تسمية (ولا يحذف) `SoftwareDistribution` و `catroot2`. لإعادة التسمية، أوقف خدمات
التحديث، أعد تسمية المجلدات إلى أسمائها الأصلية، ثم أعد تشغيل الخدمات.

## 5. إزالة مفاتيح التسجيل (SP09 وما شابه)

SP09 يُصدّر المفاتيح إلى `Backups\` قبل إزالة القيم. للاستعادة: افتح ملف `.reg` المُصدَّر
وانقر عليه نقرًا مزدوجًا (أو `reg import file.reg`) وأعد التشغيل.

## 6. إعادة تعيين تحديث ويندوز (SM06)

إذا لم يتحسن تحديث ويندوز بعد SM06:

```powershell
net stop wuauserv
net stop cryptSvc
net stop bits
ren C:\Windows\SoftwareDistribution SoftwareDistribution.old
ren C:\Windows\System32\catroot2 catroot2.old
net start wuauserv
net start cryptSvc
net start bits
```

## 7. إذا تعذّرت الاستعادة

- أعد تشغيل الأداة مع `-WhatIf` للتأكد من المطلوب قبل القبول.
- استخدم محفوظات ملفات ويندوز أو نسخة احتياطية خاصة بك لبيانات المستخدم.
- لملفات النظام: `DISM /Online /Cleanup-Image /RestoreHealth` ثم `sfc /scannow`.
