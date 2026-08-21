# KNOUX Repair v2.0.2 — Clean Installer Test and TotalFiltered Fix

## 1. اختبار المثبّت في بيئة نظيفة

يُفضّل استخدام جهاز افتراضي Windows 10/11 x64 جديد أو لقطة Snapshot نظيفة لا تحتوي على نسخة سابقة من KNOUX Repair. يجب أن تكون اللقطة قابلة للاستعادة حتى يمكن تكرار اختبار التثبيت والإزالة والترقية دون ترك آثار من الجولة السابقة.

### 1.1 التحقق من artifact قبل نقله إلى البيئة النظيفة

على جهاز البناء، تحقّق من الإصدار والحجم والبصمة:

```powershell
$setup = '.\Installer\Output\KNOUX-Repair-v2.0.2-Setup.exe'
(Get-Item $setup).Length
(Get-FileHash $setup -Algorithm SHA256).Hash
[Diagnostics.FileVersionInfo]::GetVersionInfo((Resolve-Path $setup)).ProductVersion
```

القيم الحالية للـartifact الأخير هي: **66,795,728 bytes**، الإصدار **2.0.2**، والبصمة `F8509F880B51B57041325DD9CCD7DDBBD372A14BFDBD2B64579A3A89064CA587`.

انقل ملف Setup فقط إلى البيئة النظيفة، ثم احسب SHA-256 داخلياً وقارنه بالقيمة السابقة. لا تنقل مجلد `Installer\Staging`؛ فهو ناتج نشر مؤقت يعاد توليده بواسطة سكربت البناء وليس مدخلاً مطلوباً لتثبيت المستخدم.

### 1.2 اختبار التثبيت الأولي

شغّل `KNOUX-Repair-v2.0.2-Setup.exe` من حساب إداري أو وافق على مطالبة UAC. تعريف Inno Setup يطلب صلاحية administrator، ويستخدم AppId ثابتاً، ويثبت افتراضياً في `{autopf}\KNOUX Repair`. أكمل مع إنشاء اختصار سطح المكتب فقط إذا كان ذلك مطلوباً في الجولة.

بعد انتهاء المثبّت، تحقّق من النقاط الآتية:

| الفحص | الدليل المتوقع |
|---|---|
| مسار التثبيت | وجود `KnouxRepair.exe` وملفات التطبيق والسكربتات في `C:\Program Files\KNOUX Repair` أو المسار الذي اخترته. |
| Start Menu / Desktop | الاختصارات تشير إلى النسخة المثبتة، لا إلى مجلد البناء. |
| الإصدار | خصائص الملف واسم المنتج يعرضان 2.0.2. |
| التشغيل | يظهر Splash ثم MainWindow، وتبقى النافذة الرئيسية مستجيبة بعد الانتقال. |
| Offline behavior | يعمل التطبيق دون تحميل شعار أو أصل واجهة من URL خارجي. |
| أدوات All Tools | تظهر الأدوات وعددها 100، وتعرض البطاقات أفعالاً مشتقة من العقد الحقيقي لكل أداة. |
| Evidence | تشغيل AnalyzeOnly آمن يعرض الحالة، الزمن، exit code، وstdout/stderr الفعليين. |

### 1.3 اختبار الإزالة والترقية

أعد اللقطة النظيفة أو نفّذ اختبارين منفصلين. في اختبار الإزالة، أزل التطبيق من Apps and Features أو من `unins000.exe`، ثم تحقّق من إزالة الاختصار ومجلد التطبيق وعدم بقاء نسخة تشغيلية قديمة. لا تحذف يدوياً ملفات المستخدم أو التقارير التي أنشأها التطبيق قبل حفظها كدليل.

في اختبار الترقية، ثبّت إصدار 2.0.2 السابق ذي AppId نفسه إن كان متاحاً، ثم شغّل Setup الجديد. تحقّق من أن المثبّت يحدّث النسخة في نفس المسار، وأن الاختصارات لا تتضاعف، وأن النسخة بعد الترقية تعرض 2.0.2. أعد التشغيل ثم اختبر الإزالة مرة أخرى. سجّل كل فشل UAC أو قفل ملف بدلاً من تجاهله.

### 1.4 اختبار ما بعد التثبيت

نفّذ في PowerShell الإداري، مع استبدال المسار إذا تغيّر:

```powershell
$install = 'C:\Program Files\KNOUX Repair'
Test-Path (Join-Path $install 'KnouxRepair.exe')
Get-ChildItem $install -Recurse -File | Measure-Object
Get-FileHash (Join-Path $install 'KnouxRepair.exe') -Algorithm SHA256
```

ثم راجع Event Viewer بعد التشغيل بحثاً عن أخطاء `.NET Runtime` أو `Application Error`. يجب ألا يظهر استثناء binding عند إنشاء `AllToolsPage`.

## 2. مشكلة TotalFiltered وحلها التقني

`AllToolsViewModel.TotalFiltered` خاصية محسوبة للقراءة فقط؛ قيمتها تُشتق من مجموعة الأدوات بعد البحث والتصفية. هي ليست حقل إدخال ولا ينبغي أن تعيد WPF كتابة قيمة فيها.

قبل الإصلاح، كان binding العداد في `AllToolsPage.xaml` هو binding افتراضي. عندما يربط WPF خاصية `Text` أو محتوى العرض بخاصية CLR للقراءة فقط دون تحديد الاتجاه، قد ينشئ binding ثنائي الاتجاه بحسب target property metadata. عند إنشاء النافذة، يحاول WPF تفعيل المسار وكتابة قيمة العداد إلى `AllToolsViewModel.TotalFiltered`. وبما أن الخاصية لا تملك setter، يرمي WPF:

```text
InvalidOperationException:
A TwoWay or OneWayToSource binding cannot work on the read-only property
'TotalFiltered' of type 'KnouxRepair.ViewModels.AllToolsViewModel'.
```

هذا الاستثناء كان يحدث على Dispatcher أثناء انتقال Splash إلى MainWindow، ولذلك ظهرت نافذة سوداء أو انتهت العملية بعد بدء التطبيق بدلاً من عرض الواجهة الرئيسية.

الحل المطبق في `Glass-GUI-Builder/src/KnouxRepair/Views/AllToolsPage.xaml` هو تحديد اتجاه القراءة صراحةً:

```xml
<TextBlock Grid.Row="2"
           VerticalAlignment="Bottom"
           HorizontalAlignment="Left"
           Margin="4,0,0,8"
           Style="{DynamicResource CaptionTextBlockStyle}">
    <Run Text="{Binding TotalFiltered, Mode=OneWay}"/>
    <Run Text=" tools"/>
</TextBlock>
```

النتيجة هي أن WPF يقرأ القيمة من ViewModel فقط، ولا ينشئ مسار `UpdateSource` إلى الخاصية. وعند تغيير البحث أو الفئة، يرسل ViewModel إشعار `PropertyChanged` للقيمة الجديدة، فيعيد WPF رسم العداد بصورة طبيعية. لم تتم إضافة setter وهمي، ولم يتم إسكات الاستثناء بمعالج عام؛ لذلك بقي عقد ViewModel صحيحاً وظل الخطأ قابلاً للاكتشاف.

### 2.1 التحقق من الإصلاح

أعيد بناء Release بعد التعديل، ثم اجتازت الحزمة اختبار الانحدار **83/83**. كما بقي فحص الأدوات المقيد **100/100 VERIFIED** لأن التعديل يخص binding للعرض ولا يغيّر سكربتات PowerShell أو محرك التنفيذ.

لإعادة التحقق محلياً:

```powershell
dotnet build .\Glass-GUI-Builder\src\KnouxRepair\KnouxRepair.csproj --no-restore -c Release -v:minimal
powershell -NoProfile -ExecutionPolicy Bypass -File .\Tests\Run-Tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\Tests\Test-ToolFunctionalVerification.ps1 -TimeoutSeconds 45
```

إذا فشل التشغيل بعد ذلك، افحص أولاً آخر سجل `.NET Runtime` وابحث عن `TotalFiltered`. لا تضف setter للخاصية ولا تغيّر binding إلى `OneWayToSource`؛ كلاهما يخالف طبيعة العداد المحسوب.
