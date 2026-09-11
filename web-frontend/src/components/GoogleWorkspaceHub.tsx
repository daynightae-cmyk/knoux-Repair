import { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  FileText,
  Mail,
  Table,
  Presentation,
  CheckSquare,
  ClipboardList,
  StickyNote,
  Database,
  Cloud,
  ExternalLink,
  RefreshCw,
  Send,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Shield,
  Upload,
  User,
  LogOut,
  LogIn,
  Search,
  ChevronRight,
} from 'lucide-react';
import type { Lang } from '../lib/i18n';
import {
  auth,
  isWorkspaceConfigured,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  onWorkspaceAuthChange,
  getCachedAccessToken,
} from '../lib/firebase';
import {
  listDriveFiles,
  uploadToDrive,
  sendGmailAlert,
  listRecentGmailMessages,
  createDiagnosticsSpreadsheet,
  createMaintenanceReportDoc,
  createExecutiveBriefingSlides,
  listGoogleTasks,
  createGoogleTask,
  createMaintenanceFeedbackForm,
  type DriveFileItem,
  type GmailMessageItem,
  type TaskItem,
} from '../lib/workspaceApis';

interface GoogleWorkspaceHubProps {
  lang: Lang;
  bridgeElevated: boolean;
}

type TabKey = 'overview' | 'drive' | 'gmail' | 'sheets' | 'docs' | 'slides' | 'tasks' | 'forms' | 'keep' | 'cloudsql';

export default function GoogleWorkspaceHub({ lang, bridgeElevated }: GoogleWorkspaceHubProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [accessToken, setAccessToken] = useState<string | null>(getCachedAccessToken());
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Status feedback
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Service Data States
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveSearch, setDriveSearch] = useState('');

  const [gmailMessages, setGmailMessages] = useState<GmailMessageItem[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailRecipient, setGmailRecipient] = useState('');
  const [gmailSubject, setGmailSubject] = useState('KNOUX Repair — System Health Alert');
  const [gmailBody, setGmailBody] = useState(
    'KNOUX Repair — System Health Report\nStatus: Not verified in this session — open the Action Center assessment for live evidence.\nUptime: Not verified.'
  );

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');

  // Cloud SQL & Telemetry
  const [cloudSqlStatus, setCloudSqlStatus] = useState<{ configured: boolean; database: string; host: string } | null>(null);
  const [cloudSqlLogs, setCloudSqlLogs] = useState<any[]>([]);
  const [cloudSqlLoading, setCloudSqlLoading] = useState(false);

  // Keep Notes state (quick maintenance checklists)
  const [keepNotes, setKeepNotes] = useState<string[]>([
    'Inspect DISM and SFC integrity logs weekly',
    'Verify Windows Defender signature version from the Security station',
    'Perform duplicate file quarantine cleanup after a fresh preview',
  ]);
  const [newKeepNote, setNewKeepNote] = useState('');

  // Confirmation dialog state for destructive / external modifying actions
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // Sync auth state
  useEffect(() => {
    const unsubscribe = onWorkspaceAuthChange((user, token) => {
      setCurrentUser(user);
      setAccessToken(token);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Cloud SQL status on mount
  const fetchCloudSqlStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/cloudsql/status');
      if (res.ok) {
        const data = await res.json();
        setCloudSqlStatus(data);
      }
    } catch {
      setCloudSqlStatus({ configured: false, database: 'postgres', host: 'Offline' });
    }
  }, []);

  const fetchCloudSqlLogs = useCallback(async () => {
    if (!currentUser) return;
    setCloudSqlLoading(true);
    try {
      const res = await fetch(`/api/cloudsql/repair-logs?uid=${currentUser.uid}`);
      if (res.ok) {
        const data = await res.json();
        setCloudSqlLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Failed to load Cloud SQL logs:', e);
    } finally {
      setCloudSqlLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchCloudSqlStatus();
  }, [fetchCloudSqlStatus]);

  useEffect(() => {
    if (currentUser) {
      fetchCloudSqlLogs();
      // Sync user to Cloud SQL
      fetch('/api/cloudsql/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          email: currentUser.email || 'user@nexus.local',
          displayName: currentUser.displayName || 'Nexus User',
        }),
      }).catch((e) => console.warn('Cloud SQL user sync warning:', e));
    }
  }, [currentUser, fetchCloudSqlLogs]);

  // Auth Actions
  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithGoogleWorkspace();
      if (result) {
        setStatusMessage({
          type: 'success',
          text: lang === 'ar' ? 'تم تسجيل الدخول بنجاح وتفويض خدمات Google' : 'Signed in and authorized Google Workspace APIs',
        });
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Authentication failed');
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Sign in error',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogleWorkspace();
    setStatusMessage({
      type: 'info',
      text: lang === 'ar' ? 'تم تسجيل الخروج' : 'Signed out from Google Workspace',
    });
  };

  // 1. Google Drive Operations
  const loadDriveFiles = async () => {
    if (!accessToken) return;
    setDriveLoading(true);
    try {
      const files = await listDriveFiles(accessToken);
      setDriveFiles(files);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Drive error: ${err.message}` });
    } finally {
      setDriveLoading(false);
    }
  };

  const handleUploadReportToDrive = () => {
    if (!accessToken) return;
    setConfirmDialog({
      open: true,
      title: lang === 'ar' ? 'تأكيد الرفع إلى Google Drive' : 'Confirm Upload to Google Drive',
      description:
        lang === 'ar'
          ? 'سيتم إنشاء ملف تقرير تشخيصي جديد ورفعه مباشرة إلى مساحة Google Drive الخاصة بك.'
          : 'A new diagnostic audit report will be created and saved directly to your Google Drive account.',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const reportContent = `KNOUX Repair — Diagnostic Audit\nTimestamp: ${new Date().toISOString()}\nElevation: ${bridgeElevated ? 'Administrator' : 'Standard user'}\nCPU: Not verified in this session\nDefender Status: Not verified in this session\nFirewall: Not verified in this session\nCloud SQL: ${cloudSqlStatus?.configured ? `Configured (${cloudSqlStatus.database})` : 'Not configured'}\nNote: Open the Action Center assessment for live measured evidence.`;
          const result = await uploadToDrive(
            accessToken,
            `KNOUX_Diagnostic_Audit_${Date.now()}.txt`,
            reportContent,
            'text/plain'
          );
          setStatusMessage({
            type: 'success',
            text: lang === 'ar' ? `تم رفع التقرير بنجاح: ${result.name}` : `Successfully uploaded to Drive: ${result.name}`,
          });
          // Log to Cloud SQL
          if (currentUser) {
            fetch('/api/cloudsql/workspace-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: currentUser.uid,
                service: 'drive',
                resourceName: result.name,
                action: 'upload_report',
                resourceId: result.id,
                resourceUrl: result.webViewLink,
              }),
            }).catch(console.warn);
          }
          loadDriveFiles();
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message });
        } finally {
          setIsProcessing(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // 2. Gmail Operations
  const loadGmailMessages = async () => {
    if (!accessToken) return;
    setGmailLoading(true);
    try {
      const messages = await listRecentGmailMessages(accessToken);
      setGmailMessages(messages);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Gmail error: ${err.message}` });
    } finally {
      setGmailLoading(false);
    }
  };

  const handleSendGmail = () => {
    if (!accessToken || !gmailRecipient) {
      setStatusMessage({ type: 'error', text: 'Please provide a valid recipient email' });
      return;
    }
    setConfirmDialog({
      open: true,
      title: lang === 'ar' ? 'تأكيد إرسال البريد الإلكتروني عبر Gmail' : 'Confirm Sending Gmail Message',
      description:
        lang === 'ar'
          ? `هل أنت متأكد من إرسال تقرير الصيانة إلى ${gmailRecipient}؟`
          : `Are you sure you want to dispatch this maintenance report to ${gmailRecipient}?`,
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          await sendGmailAlert(accessToken, gmailRecipient, gmailSubject, gmailBody);
          setStatusMessage({
            type: 'success',
            text: lang === 'ar' ? `تم إرسال البريد بنجاح إلى ${gmailRecipient}` : `Email dispatched successfully to ${gmailRecipient}`,
          });
          // Log to Cloud SQL
          if (currentUser) {
            fetch('/api/cloudsql/workspace-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: currentUser.uid,
                service: 'gmail',
                resourceName: gmailSubject,
                action: 'send_alert',
                resourceId: gmailRecipient,
              }),
            }).catch(console.warn);
          }
          loadGmailMessages();
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message });
        } finally {
          setIsProcessing(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // 3. Google Sheets Operations
  const handleExportToSheets = () => {
    if (!accessToken) return;
    setConfirmDialog({
      open: true,
      title: lang === 'ar' ? 'تأكيد إنشاء جدول Google Sheets' : 'Confirm Create Google Sheet',
      description:
        lang === 'ar'
          ? 'سيتم إنشاء جدول بيانات جديد في Google Sheets يحتوي على قراءات التشخيص والعتاد وسجل الصيانة.'
          : 'A new Google Spreadsheet will be created with live workstation telemetry, disk health, and repair logs.',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const headers = ['Timestamp', 'Metric / Component', 'Status / Value', 'Health Rating', 'Action Recommended'];
          const unverified = lang === 'ar' ? 'غير متحقق — افتح مركز الإجراءات' : 'Not verified — open Action Center';
          const cloudSqlState = cloudSqlStatus?.configured ? `Configured (${cloudSqlStatus.database})` : 'Not configured';
          const rows = [
            [new Date().toLocaleTimeString(), 'CPU Core Load', unverified, '—', 'Run live assessment'],
            [new Date().toLocaleTimeString(), 'System RAM', unverified, '—', 'Run live assessment'],
            [new Date().toLocaleTimeString(), 'System Drive', unverified, '—', 'Run live assessment'],
            [new Date().toLocaleTimeString(), 'Data Drive', unverified, '—', 'Run live assessment'],
            [new Date().toLocaleTimeString(), 'Windows Defender Realtime', unverified, '—', 'Open Security station'],
            [new Date().toLocaleTimeString(), 'Cloud SQL Database', cloudSqlState, cloudSqlStatus?.configured ? 'Online' : 'Standby', 'Review Cloud SQL tab'],
          ];

          const result = await createDiagnosticsSpreadsheet(
            accessToken,
            `KNOUX Workstation Telemetry (${new Date().toLocaleDateString()})`,
            headers,
            rows
          );

          setStatusMessage({
            type: 'success',
            text: lang === 'ar' ? 'تم إنشاء جدول البيانات بنجاح في Google Sheets!' : 'Google Sheet created successfully!',
          });

          // Log to Cloud SQL
          if (currentUser) {
            fetch('/api/cloudsql/workspace-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: currentUser.uid,
                service: 'sheets',
                resourceName: `KNOUX Workstation Telemetry`,
                action: 'create_spreadsheet',
                resourceId: result.spreadsheetId,
                resourceUrl: result.spreadsheetUrl,
              }),
            }).catch(console.warn);
          }

          window.open(result.spreadsheetUrl, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message });
        } finally {
          setIsProcessing(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // 4. Google Docs Operations
  const handleGenerateDoc = () => {
    if (!accessToken) return;
    setConfirmDialog({
      open: true,
      title: lang === 'ar' ? 'تأكيد إنشاء مستند Google Docs' : 'Confirm Create Google Doc',
      description:
        lang === 'ar'
          ? 'سيتم إنشاء وثيقة تقرير فني شاملة بصيغة Google Docs تتضمن تفاصيل الصيانة والتوصيات.'
          : 'A formatted Google Doc technical report will be generated and saved to your account.',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const docTitle = `KNOUX Repair Audit — ${new Date().toLocaleDateString()}`;
          const content = `=====================================================
KNOUX REPAIR NEXUS — COMPREHENSIVE SYSTEM AUDIT REPORT
=====================================================

1. EXECUTIVE OVERVIEW
Live measurements were not taken in this session. Values below marked
"Not verified" require the Action Center assessment or the relevant station.
Cloud SQL: ${cloudSqlStatus?.configured ? `Configured (${cloudSqlStatus.database})` : 'Not configured'}.

2. STORAGE & DISK HEALTH
- Drive C: Not verified in this session — open the Cleanup station for measured targets.
- Drive D: Not verified in this session — open the Cleanup station for measured targets.
- Duplicate Candidate Scan: run a fresh preview before any optimization pass.

3. SECURITY & COMPLIANCE POSTURE
- Windows Defender: Not verified in this session — open the Security station.
- Firewall Profiles: Not verified in this session — open the Security station.
- Administrator Privileges: ${bridgeElevated ? 'Elevated (Full Access)' : 'Standard User'}.

4. RECOMMENDATIONS
- Run the Action Center assessment to collect live evidence first.
- Archive historic repair logs to Cloud SQL & Google Drive.`;

          const result = await createMaintenanceReportDoc(accessToken, docTitle, content);
          setStatusMessage({
            type: 'success',
            text: lang === 'ar' ? 'تم إنشاء مستند التقرير بنجاح في Google Docs!' : 'Google Document created successfully!',
          });

          // Log to Cloud SQL
          if (currentUser) {
            fetch('/api/cloudsql/workspace-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: currentUser.uid,
                service: 'docs',
                resourceName: docTitle,
                action: 'create_doc',
                resourceId: result.documentId,
                resourceUrl: `https://docs.google.com/document/d/${result.documentId}/edit`,
              }),
            }).catch(console.warn);
          }

          window.open(`https://docs.google.com/document/d/${result.documentId}/edit`, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message });
        } finally {
          setIsProcessing(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // 5. Google Slides Operations
  const handleGenerateSlides = () => {
    if (!accessToken) return;
    setConfirmDialog({
      open: true,
      title: lang === 'ar' ? 'تأكيد إنشاء عرض Google Slides' : 'Confirm Create Google Slides',
      description:
        lang === 'ar'
          ? 'سيتم إنشاء عرض تقديمي تنفيذي في Google Slides لعرض نتائج فحص النظام ومؤشرات الأداء.'
          : 'An executive presentation slide deck will be generated in your Google Drive with key system insights.',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const title = `KNOUX Repair Executive Briefing`;
          const subtitle = `Comprehensive Workstation Audit & Optimization Overview`;
          const bullets = [
            'System Architecture: local Windows repair workstation (live values require assessment)',
            'Health assessment: not verified in this session — run the Action Center assessment',
            'Storage: not verified in this session — open the Cleanup station for measured targets',
            'Security posture: not verified in this session — open the Security station',
            `Cloud infrastructure: ${cloudSqlStatus?.configured ? `Cloud SQL configured (${cloudSqlStatus.database})` : 'Cloud SQL not configured'}`,
          ];

          const result = await createExecutiveBriefingSlides(accessToken, title, subtitle, bullets);
          setStatusMessage({
            type: 'success',
            text: lang === 'ar' ? 'تم إنشاء عرض Google Slides بنجاح!' : 'Google Slides presentation created successfully!',
          });

          // Log to Cloud SQL
          if (currentUser) {
            fetch('/api/cloudsql/workspace-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: currentUser.uid,
                service: 'slides',
                resourceName: title,
                action: 'create_slides',
                resourceId: result.presentationId,
                resourceUrl: result.presentationUrl,
              }),
            }).catch(console.warn);
          }

          window.open(result.presentationUrl, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message });
        } finally {
          setIsProcessing(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // 6. Google Tasks Operations
  const loadTasks = async () => {
    if (!accessToken) return;
    setTasksLoading(true);
    try {
      const items = await listGoogleTasks(accessToken);
      setTasks(items);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Tasks error: ${err.message}` });
    } finally {
      setTasksLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!accessToken || !newTaskTitle.trim()) return;
    setIsProcessing(true);
    try {
      await createGoogleTask(accessToken, newTaskTitle.trim(), newTaskNotes.trim());
      setStatusMessage({
        type: 'success',
        text: lang === 'ar' ? 'تمت إضافة المهمة إلى Google Tasks بنجاح' : 'Task added to Google Tasks',
      });
      setNewTaskTitle('');
      setNewTaskNotes('');
      loadTasks();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. Google Forms Operations
  const handleCreateFeedbackForm = () => {
    if (!accessToken) return;
    setConfirmDialog({
      open: true,
      title: lang === 'ar' ? 'تأكيد إنشاء نموذج Google Forms' : 'Confirm Create Google Form',
      description:
        lang === 'ar'
          ? 'سيتم إنشاء نموذج استبيان صيانة وطلبات دعم فني في حساب Google Forms الخاص بك.'
          : 'A new maintenance feedback and IT service request form will be created in your Google account.',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const formTitle = `KNOUX Repair — Workstation Service Feedback`;
          const formDesc = `Please submit any observed workstation anomalies, repair tickets, or performance issues.`;
          const result = await createMaintenanceFeedbackForm(accessToken, formTitle, formDesc);
          setStatusMessage({
            type: 'success',
            text: lang === 'ar' ? 'تم إنشاء النموذج بنجاح!' : 'Google Form created successfully!',
          });

          // Log to Cloud SQL
          if (currentUser) {
            fetch('/api/cloudsql/workspace-events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                uid: currentUser.uid,
                service: 'forms',
                resourceName: formTitle,
                action: 'create_form',
                resourceId: result.formId,
                resourceUrl: result.responderUri,
              }),
            }).catch(console.warn);
          }

          window.open(result.responderUri, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: err.message });
        } finally {
          setIsProcessing(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // 8. Google Keep Operations (Scratchpad)
  const handleAddKeepNote = () => {
    if (!newKeepNote.trim()) return;
    setKeepNotes([...keepNotes, newKeepNote.trim()]);
    setNewKeepNote('');
    setStatusMessage({
      type: 'success',
      text: lang === 'ar' ? 'تم حفظ الملاحظة الفنية في المسودة' : 'Maintenance note saved to local scratchpad',
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto pr-1">
      {/* ── Top Header Banner ── */}
      <div className="p-4 md:p-6 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-blue-950/40 border border-blue-500/20 backdrop-blur-xl shadow-lg relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Cloud size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold font-display text-white">
                  {lang === 'ar' ? 'مركز الخدمات السحابية و Google Workspace' : 'Google Workspace & Cloud Hub'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
                {lang === 'ar'
                  ? 'تكامل متكامل مع خدمات Google (Drive، Gmail، Sheets، Docs، Slides، Tasks، Forms، Keep) وقاعدة بيانات Cloud SQL PostgreSQL و Firebase.'
                  : 'Full Google Workspace ecosystem integration (Drive, Gmail, Sheets, Docs, Slides, Tasks, Forms, Keep) with Cloud SQL PostgreSQL & Firebase.'}
              </p>
            </div>
          </div>

          {/* User Sign-In Widget */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-slate-800/80 border border-white/10">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-8 h-8 rounded-lg object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center text-blue-300">
                    <User size={16} />
                  </div>
                )}
                <div className="text-left">
                  <div className="text-xs font-semibold text-white truncate max-w-[140px]">
                    {currentUser.displayName || currentUser.email}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">Workspace Linked</div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title={lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={authLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50"
                >
                  {authLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  <span>{lang === 'ar' ? 'ربط حساب Google Workspace' : 'Connect Google Workspace'}</span>
                </button>
                {authError && <span className="text-[10px] text-rose-400 max-w-[200px] truncate">{authError}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Status Message Notification */}
        {statusMessage && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-xs flex items-center justify-between border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={14} className="shrink-0" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle size={14} className="shrink-0" />
              ) : (
                <Shield size={14} className="shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[10px] underline hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* ── Sub-Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-white/[0.08] overflow-x-auto">
        {[
          { key: 'overview', label: lang === 'ar' ? 'نظرة شاملة' : 'Overview', icon: Cloud },
          { key: 'drive', label: 'Google Drive', icon: HardDrive },
          { key: 'gmail', label: 'Gmail', icon: Mail },
          { key: 'sheets', label: 'Google Sheets', icon: Table },
          { key: 'docs', label: 'Google Docs', icon: FileText },
          { key: 'slides', label: 'Google Slides', icon: Presentation },
          { key: 'tasks', label: 'Google Tasks', icon: CheckSquare },
          { key: 'forms', label: 'Google Forms', icon: ClipboardList },
          { key: 'keep', label: 'Google Keep', icon: StickyNote },
          { key: 'cloudsql', label: 'Cloud SQL (Postgres)', icon: Database },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key as TabKey);
                if (tab.key === 'drive' && accessToken) loadDriveFiles();
                if (tab.key === 'gmail' && accessToken) loadGmailMessages();
                if (tab.key === 'tasks' && accessToken) loadTasks();
                if (tab.key === 'cloudsql') fetchCloudSqlLogs();
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── MAIN TAB CONTENTS ── */}
      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {!isWorkspaceConfigured() && (
            <div className="p-3.5 rounded-2xl bg-amber-500/[0.07] border border-amber-500/25 text-xs text-amber-200 leading-relaxed">
              {lang === 'ar'
                ? 'تكامل Google Workspace غير مهيأ: لا توجد بيئة Firebase مخصصة لـ KNOUX Repair، لذلك تبقى جميع ميزات الإصلاح المحلية تعمل عبر المحرك المحلي.'
                : 'Google Workspace integration is not configured: no dedicated KNOUX Firebase project is provisioned, so all local repair features keep working through the local bridge.'}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* Cloud SQL Status Card */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-cyan-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Database size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Cloud SQL PostgreSQL</h3>
                    <p className="text-[10px] text-slate-400">{cloudSqlStatus ? `${cloudSqlStatus.database} • ${cloudSqlStatus.configured ? 'Configured' : 'Not configured'}` : 'Status unknown'}</p>
                  </div>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${cloudSqlStatus?.configured ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              </div>
              <div className="text-[11px] text-slate-300 space-y-1 bg-black/30 p-2.5 rounded-xl font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Region:</span>
                  <span className="text-cyan-300 font-semibold">{cloudSqlStatus?.configured ? cloudSqlStatus.host : 'Not configured'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Engine:</span>
                  <span className="text-white">PostgreSQL (Drizzle ORM)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Schema:</span>
                  <span className="text-emerald-400">repair_logs, telemetry</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('cloudsql')}
                className="mt-3 w-full py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>{lang === 'ar' ? 'عرض السجلات الموثقة' : 'View Relational Logs'}</span>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Google Drive Card */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-blue-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <HardDrive size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Google Drive</h3>
                    <p className="text-[10px] text-slate-400">Cloud Storage & Backups</p>
                  </div>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${accessToken ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {lang === 'ar'
                  ? 'رفع تقارير فحص النظام ونسخ التكوينات الاحتياطية سحابياً.'
                  : 'Directly archive diagnostic scans and system restore manifests.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUploadReportToDrive}
                  disabled={!accessToken || isProcessing}
                  className="flex-1 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <Upload size={13} />
                  <span>{lang === 'ar' ? 'رفع تقرير فوري' : 'Upload Report'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('drive'); loadDriveFiles(); }}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-300"
                >
                  {lang === 'ar' ? 'تصفح' : 'Browse'}
                </button>
              </div>
            </div>

            {/* Google Sheets Card */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-emerald-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Table size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Google Sheets</h3>
                    <p className="text-[10px] text-slate-400">Telemetry & Audit Grids</p>
                  </div>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${accessToken ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {lang === 'ar'
                  ? 'تصدير جدول قياسات العتاد والأقراص وفحص الملفات المكررة بضغطة واحدة.'
                  : 'Export hardware benchmarks, drive stats, and duplicates into live Sheets.'}
              </p>
              <button
                type="button"
                onClick={handleExportToSheets}
                disabled={!accessToken || isProcessing}
                className="w-full py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <ExternalLink size={13} />
                <span>{lang === 'ar' ? 'إنشاء جدول قياسات حي' : 'Export Telemetry Sheet'}</span>
              </button>
            </div>

            {/* Google Docs Card */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-blue-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Google Docs</h3>
                    <p className="text-[10px] text-slate-400">Technical Documentation</p>
                  </div>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${accessToken ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {lang === 'ar'
                  ? 'توليد وثيقة تقرير فحص وصيانة مفصلة قابلة للطباعة والمشاركة.'
                  : 'Generate structured diagnostic and system audit documents with one click.'}
              </p>
              <button
                type="button"
                onClick={handleGenerateDoc}
                disabled={!accessToken || isProcessing}
                className="w-full py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <ExternalLink size={13} />
                <span>{lang === 'ar' ? 'توليد وثيقة التقرير الفني' : 'Generate Technical Doc'}</span>
              </button>
            </div>

            {/* Google Slides Card */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-amber-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Presentation size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Google Slides</h3>
                    <p className="text-[10px] text-slate-400">Executive Briefings</p>
                  </div>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${accessToken ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {lang === 'ar'
                  ? 'تجهيز شرائح عرض للإدارة وخدمة العملاء حول كفاءة النظام والأمان.'
                  : 'Produce executive summary presentations for IT teams and managers.'}
              </p>
              <button
                type="button"
                onClick={handleGenerateSlides}
                disabled={!accessToken || isProcessing}
                className="w-full py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <ExternalLink size={13} />
                <span>{lang === 'ar' ? 'توليد عرض تقديمي' : 'Create Slide Deck'}</span>
              </button>
            </div>

            {/* Gmail Card */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] hover:border-rose-500/30 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">Gmail</h3>
                    <p className="text-[10px] text-slate-400">Alerts & Maintenance Dispatch</p>
                  </div>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${accessToken ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              </div>
              <p className="text-xs text-slate-400 mb-3">
                {lang === 'ar'
                  ? 'إرسال تنبيهات الطوارئ وتقارير الصيانة الدورية مباشرة عبر البريد.'
                  : 'Dispatch maintenance bulletins and alert emails to system administrators.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('gmail')}
                className="w-full py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
              >
                <Send size={13} />
                <span>{lang === 'ar' ? 'فتح لوحة إرسال التنبيهات' : 'Open Gmail Dispatcher'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. GOOGLE DRIVE TAB */}
      {activeTab === 'drive' && (
        <div className="p-4 md:p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HardDrive size={18} className="text-blue-400" />
              <h2 className="text-sm font-bold text-white">Google Drive Storage Explorer</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadDriveFiles}
                disabled={!accessToken || driveLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-300"
              >
                <RefreshCw size={13} className={driveLoading ? 'animate-spin' : ''} />
                <span>{lang === 'ar' ? 'تحديث' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={handleUploadReportToDrive}
                disabled={!accessToken || isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white disabled:opacity-50"
              >
                <Upload size={13} />
                <span>{lang === 'ar' ? 'رفع تقرير تشخيصي' : 'Upload Audit Report'}</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder={lang === 'ar' ? 'ابحث في ملفات Google Drive...' : 'Search Google Drive files...'}
              value={driveSearch}
              onChange={(e) => setDriveSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {driveLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span className="text-xs">Loading Google Drive files...</span>
            </div>
          ) : driveFiles.length > 0 ? (
            <div className="divide-y divide-white/[0.06] border border-white/[0.08] rounded-xl overflow-hidden bg-black/20">
              {driveFiles
                .filter((f) => f.name.toLowerCase().includes(driveSearch.toLowerCase()))
                .map((file) => (
                  <div key={file.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <FileText size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{file.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {file.mimeType} • {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                        </div>
                      </div>
                    </div>
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white"
                        title="Open in Google Drive"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-xs">
              {accessToken ? 'No files found or click Refresh to fetch from Drive' : 'Sign in to access your Google Drive files'}
            </div>
          )}
        </div>
      )}

      {/* 3. GMAIL TAB */}
      {activeTab === 'gmail' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Dispatcher Form */}
          <div className="p-4 md:p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-3.5">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={18} className="text-rose-400" />
              <h2 className="text-sm font-bold text-white">Gmail Alert Dispatcher</h2>
            </div>
            <p className="text-xs text-slate-400">
              {lang === 'ar'
                ? 'إرسال بريد رسمي عبر خوادم Google لتوثيق عمليات الصيانة وتنبيه مسؤولي تكنولوجيا المعلومات.'
                : 'Send real automated reports and system alerts via your connected Gmail account.'}
            </p>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'البريد الإلكتروني للمستلم:' : 'Recipient Email:'}</label>
                <input
                  type="email"
                  placeholder="admin@organization.com"
                  value={gmailRecipient}
                  onChange={(e) => setGmailRecipient(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'عنوان الرسالة:' : 'Subject:'}</label>
                <input
                  type="text"
                  value={gmailSubject}
                  onChange={(e) => setGmailSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{lang === 'ar' ? 'نص التقرير:' : 'Body Text:'}</label>
                <textarea
                  rows={6}
                  value={gmailBody}
                  onChange={(e) => setGmailBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-[11px] focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendGmail}
              disabled={!accessToken || !gmailRecipient || isProcessing}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.4)] disabled:opacity-50 transition-all"
            >
              {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              <span>{lang === 'ar' ? 'إرسال التنبيه عبر Gmail' : 'Send Alert via Gmail'}</span>
            </button>
          </div>

          {/* Recent Messages */}
          <div className="p-4 md:p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-3.5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-white">Recent Maintenance Messages</h2>
              <button
                type="button"
                onClick={loadGmailMessages}
                disabled={!accessToken || gmailLoading}
                className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300"
              >
                <RefreshCw size={13} className={gmailLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            {gmailLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 size={16} className="animate-spin text-rose-400" />
                <span className="text-xs">Fetching Gmail inbox...</span>
              </div>
            ) : gmailMessages.length > 0 ? (
              <div className="space-y-2">
                {gmailMessages.map((msg) => (
                  <div key={msg.id} className="p-3 rounded-xl bg-black/30 border border-white/[0.06] text-xs">
                    <div className="flex justify-between font-semibold text-slate-200 mb-1">
                      <span className="truncate max-w-[200px]">{msg.subject}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{msg.date ? new Date(msg.date).toLocaleDateString() : ''}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-2">{msg.snippet}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                {accessToken ? 'No recent messages found or click refresh' : 'Connect Google Workspace to view recent messages'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. GOOGLE TASKS TAB */}
      {activeTab === 'tasks' && (
        <div className="p-4 md:p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckSquare size={18} className="text-purple-400" />
              <h2 className="text-sm font-bold text-white">Google Tasks Maintenance Reminders</h2>
            </div>
            <button
              type="button"
              onClick={loadTasks}
              disabled={!accessToken || tasksLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-300"
            >
              <RefreshCw size={13} className={tasksLoading ? 'animate-spin' : ''} />
              <span>{lang === 'ar' ? 'تحديث المهام' : 'Refresh Tasks'}</span>
            </button>
          </div>

          {/* Add Task Input */}
          <div className="p-3 rounded-xl bg-black/30 border border-white/[0.08] space-y-2">
            <input
              type="text"
              placeholder={lang === 'ar' ? 'عنوان مهمة الصيانة الجديدة...' : 'New maintenance task title...'}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={lang === 'ar' ? 'ملاحظات وتفاصيل إضافية...' : 'Optional notes or instructions...'}
                value={newTaskNotes}
                onChange={(e) => setNewTaskNotes(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={!accessToken || !newTaskTitle.trim() || isProcessing}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                <Plus size={14} />
                <span>{lang === 'ar' ? 'إضافة إلى Google Tasks' : 'Add Task'}</span>
              </button>
            </div>
          </div>

          {/* Tasks List */}
          {tasksLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={16} className="animate-spin text-purple-400" />
              <span className="text-xs">Loading tasks...</span>
            </div>
          ) : tasks.length > 0 ? (
            <div className="space-y-2">
              {tasks.map((task, idx) => (
                <div key={task.id || idx} className="p-3 rounded-xl bg-black/20 border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className={task.status === 'completed' ? 'text-emerald-400' : 'text-slate-500'} />
                    <div>
                      <div className={`text-xs font-semibold ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                        {task.title}
                      </div>
                      {task.notes && <div className="text-[11px] text-slate-400">{task.notes}</div>}
                    </div>
                  </div>
                  {task.due && <span className="text-[10px] text-purple-400 font-mono">{new Date(task.due).toLocaleDateString()}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-xs">
              {accessToken ? 'No tasks yet. Create your first system maintenance action item!' : 'Connect Google Workspace to view and sync tasks'}
            </div>
          )}
        </div>
      )}

      {/* 5. GOOGLE FORMS TAB */}
      {activeTab === 'forms' && (
        <div className="p-4 md:p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList size={18} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Google Forms Service Portal</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            {lang === 'ar'
              ? 'إنشاء استبيانات رضا العملاء عن الصيانة ونماذج تذاكر الدعم الفني مباشرة في Google Forms ومشاركتها مع المستخدمين أو موظفي المؤسسة.'
              : 'Instantly generate IT repair request forms and user satisfaction surveys directly in Google Forms.'}
          </p>
          <div className="p-4 rounded-xl bg-black/30 border border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white">Standard KNOUX Maintenance Feedback Template</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Pre-configured with system satisfaction ratings, issue resolution speed, and technician feedback fields.
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateFeedbackForm}
              disabled={!accessToken || isProcessing}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 transition-all"
            >
              <ExternalLink size={14} />
              <span>{lang === 'ar' ? 'إنشاء النموذج الآن' : 'Create Form via Google Forms'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. GOOGLE KEEP TAB */}
      {activeTab === 'keep' && (
        <div className="p-4 md:p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <StickyNote size={18} className="text-amber-400" />
              <h2 className="text-sm font-bold text-white">Google Keep Maintenance Scratchpad</h2>
            </div>
            <a
              href="https://keep.google.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
            >
              <ExternalLink size={13} />
              <span>{lang === 'ar' ? 'فتح Google Keep' : 'Open Google Keep'}</span>
            </a>
          </div>

          <p className="text-xs text-slate-400">
            {lang === 'ar'
              ? 'مفكرة سريعة لتسجيل قوائم التدقيق التقني وملاحظات الفنيين الميدانية ونسخها مباشرة إلى Google Keep.'
              : 'Maintenance scratchpad for technicians to track quick diagnostic checklists and sync with Google Keep.'}
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder={lang === 'ar' ? 'أضف ملاحظة فحص أو تذكير صيانة...' : 'Add technician diagnostic note or checklist item...'}
              value={newKeepNote}
              onChange={(e) => setNewKeepNote(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={handleAddKeepNote}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Plus size={14} />
              <span>{lang === 'ar' ? 'إضافة' : 'Add Note'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {keepNotes.map((note, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-amber-500/[0.06] border border-amber-500/20 text-xs text-amber-100 flex flex-col justify-between">
                <p className="font-sans leading-relaxed">{note}</p>
                <div className="mt-3 pt-2 border-t border-amber-500/20 flex justify-between items-center text-[10px] text-amber-400/70">
                  <span>Note #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(note);
                      setStatusMessage({ type: 'info', text: 'Copied note to clipboard' });
                    }}
                    className="hover:text-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. CLOUD SQL TAB */}
      {activeTab === 'cloudsql' && (
        <div className="p-4 md:p-6 rounded-2xl bg-slate-900/60 border border-white/[0.07] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-cyan-400" />
              <div>
                <h2 className="text-sm font-bold text-white">Cloud SQL PostgreSQL Replication</h2>
                <span className="text-[10px] text-slate-400 font-mono">
                  {cloudSqlStatus ? `Database: ${cloudSqlStatus.database} • Host: ${cloudSqlStatus.host} • Status: ${cloudSqlStatus.configured ? 'Active' : 'Standby'}` : 'Cloud SQL status unknown'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchCloudSqlLogs}
              disabled={cloudSqlLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-slate-300"
            >
              <RefreshCw size={13} className={cloudSqlLoading ? 'animate-spin' : ''} />
              <span>{lang === 'ar' ? 'تحديث السجلات' : 'Refresh SQL Records'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.08]">
              <div className="text-[10px] text-slate-500 font-mono">DATABASE ENGINE</div>
              <div className="text-xs font-bold text-white mt-1">PostgreSQL</div>
              <div className="text-[10px] text-emerald-400 font-mono">{cloudSqlStatus?.configured ? 'Status: Connected' : 'Status: Not configured'}</div>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.08]">
              <div className="text-[10px] text-slate-500 font-mono">INSTANCE REGION</div>
              <div className="text-xs font-bold text-white mt-1">{cloudSqlStatus?.configured ? cloudSqlStatus.host : 'Not configured'}</div>
              <div className="text-[10px] text-cyan-400 font-mono">{cloudSqlStatus?.configured ? 'Cloud SQL backend' : 'Local bridge only'}</div>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/[0.08]">
              <div className="text-[10px] text-slate-500 font-mono">ORM LAYER</div>
              <div className="text-xs font-bold text-white mt-1">Drizzle ORM</div>
              <div className="text-[10px] text-purple-400 font-mono">Schema defined locally</div>
            </div>
          </div>

          <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-black/30">
            <div className="p-3 bg-white/[0.03] border-b border-white/[0.06] text-xs font-semibold text-slate-300 flex justify-between">
              <span>{lang === 'ar' ? 'سجل عمليات الإصلاح الموثقة (Cloud SQL)' : 'Relational Audit Log (Cloud SQL)'}</span>
              <span className="text-[10px] text-slate-500">{cloudSqlLogs.length} entries</span>
            </div>
            {cloudSqlLogs.length > 0 ? (
              <div className="divide-y divide-white/[0.04] max-h-72 overflow-y-auto font-mono text-[11px]">
                {cloudSqlLogs.map((log: any) => (
                  <div key={log.id} className="p-2.5 flex items-center justify-between hover:bg-white/[0.02]">
                    <div>
                      <span className="text-cyan-300 font-semibold">{log.toolName}</span>
                      <span className="text-slate-500 ml-2">({log.toolId})</span>
                      {log.details && <div className="text-[10px] text-slate-400 mt-0.5">{log.details}</div>}
                    </div>
                    <div className="text-right">
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {log.status}
                      </span>
                      <div className="text-[9px] text-slate-600 mt-0.5">
                        {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-xs">
                {currentUser ? 'No repair actions recorded in Cloud SQL yet.' : 'Sign in to sync repair logs to Cloud SQL.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Confirmation Dialog for Workspace Actions (MANDATORY per Workspace Skill) ── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-white/20 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-cyan-400">
              <Shield size={22} />
              <h3 className="text-sm font-bold text-white">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{confirmDialog.description}</p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-slate-300"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]"
              >
                {lang === 'ar' ? 'متابعة وتنفيذ' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
