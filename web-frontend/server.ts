import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Load tools from Docs/TOOLS-MANIFEST.json if available
  let tools: any[] = [];
  const manifestPaths = [
    path.join(__dirname, '..', 'Docs', 'TOOLS-MANIFEST.json'),
    path.join(__dirname, 'Docs', 'TOOLS-MANIFEST.json'),
    path.join(process.cwd(), 'Docs', 'TOOLS-MANIFEST.json'),
    path.join(process.cwd(), '..', 'Docs', 'TOOLS-MANIFEST.json'),
  ];

  for (const p of manifestPaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        tools = JSON.parse(raw);
        console.log(`Loaded ${tools.length} tools from ${p}`);
        break;
      } catch (e) {
        console.warn(`Failed to parse manifest at ${p}:`, e);
      }
    }
  }

  // Active runs store
  const runs = new Map<string, any>();

  // --- API Routes ---
  const apiRouter = express.Router();

  apiRouter.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      bridge: 'KNOUX Nexus Core Web Bridge',
      version: '2.0.2',
      elevated: true,
      powershell: 'Active (Web Mode)',
      repoRoot: process.cwd(),
      tools: tools.length,
    });
  });

  apiRouter.get('/auth/status', (_req: Request, res: Response) => {
    res.json({
      required: false,
      authenticated: true,
      providers: {
        github: { label: 'GitHub', configured: true },
        entra: { label: 'Entra ID', configured: false },
      },
      user: {
        name: 'Nexus Administrator',
        email: 'admin@knoux.nexus',
        provider: 'local',
      },
    });
  });

  apiRouter.get('/tools', (_req: Request, res: Response) => {
    res.json({ tools });
  });

  apiRouter.get('/system', (_req: Request, res: Response) => {
    res.json({
      system: {
        Os: 'Windows 11 Pro / Cloud Nexus Hybrid',
        Version: '10.0.26100',
        Build: '26100.1742',
        Machine: 'x64-based Workstation',
        UptimeSeconds: 142800,
        TotalRamGB: 32,
        FreeRamGB: 21.6,
        CpuName: 'Intel(R) Core(TM) i9-14900K @ 3.20GHz',
        CpuLoad: 12,
        Processes: 142,
        Drives: [
          { Name: 'C:', TotalGB: 1024, FreeGB: 642 },
          { Name: 'D:', TotalGB: 2048, FreeGB: 1530 },
        ],
        Firewall: { Domain: true, Private: true, Public: true },
        DefenderRunning: true,
        DefenderRealtime: true,
        DefenderSignatures: '1.417.820.0',
      },
    });
  });

  // Tool execution simulation
  apiRouter.post('/tools/:toolId/run', (req: Request, res: Response) => {
    const { toolId } = req.params;
    const { mode = 'run' } = req.body;
    const tool = tools.find((t: any) => t.ToolId === toolId) || {
      ToolId: toolId,
      EnglishName: `Tool ${toolId}`,
      ArabicName: `أداة ${toolId}`,
    };

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const newRun = {
      id: runId,
      toolId,
      toolName: tool.EnglishName,
      mode,
      status: 'running',
      exitCode: null,
      startedAt: now,
      finishedAt: null,
      lines: [
        { t: now, s: 'out', text: `[START] Initializing ${tool.EnglishName} (${toolId})...` },
        { t: now, s: 'out', text: `[MODE] Executing in mode: ${mode.toUpperCase()}` },
        { t: now, s: 'out', text: `[SAFETY] Verified safety baseline and quarantine rules.` },
      ],
      error: null,
    };

    runs.set(runId, newRun);

    // Stream lines and finish after short delay
    setTimeout(() => {
      const r = runs.get(runId);
      if (r && r.status === 'running') {
        const t1 = new Date().toISOString();
        r.lines.push({
          t: t1,
          s: 'out',
          text: `[SCAN] Checking subsystem integrity and component definitions...`,
        });
        r.lines.push({
          t: t1,
          s: 'out',
          text: `[EVIDENCE] Health state verified. All signatures conform to policy.`,
        });
      }
    }, 1000);

    setTimeout(() => {
      const r = runs.get(runId);
      if (r && r.status === 'running') {
        const t2 = new Date().toISOString();
        r.lines.push({
          t: t2,
          s: 'out',
          text: `[PASS] Completed operation successfully. Evidence recorded in logs.`,
        });
        r.status = 'success';
        r.exitCode = 0;
        r.finishedAt = t2;
      }
    }, 2200);

    res.json({ runId });
  });

  apiRouter.get('/runs/:runId', (req: Request, res: Response) => {
    const { runId } = req.params;
    const run = runs.get(runId);
    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json({ run });
  });

  apiRouter.post('/runs/:runId/cancel', (req: Request, res: Response) => {
    const { runId } = req.params;
    const run = runs.get(runId);
    if (run) {
      run.status = 'cancelled';
      run.finishedAt = new Date().toISOString();
      run.lines.push({
        t: run.finishedAt,
        s: 'err',
        text: `[CANCEL] Operation cancelled by operator.`,
      });
    }
    res.json({ ok: true });
  });

  // Duplicate preview & quarantine mocks
  apiRouter.post('/tools/duplicate/preview', (_req: Request, res: Response) => {
    res.json({
      preview: {
        PreviewId: `dup-${Date.now()}`,
        RootFolder: 'C:\\Users\\Workspace\\Documents',
        GroupCount: 4,
        DuplicateCopies: 7,
        RecoverableBytes: 48590000,
        PreviewExpiresAt: new Date(Date.now() + 3600000).toISOString(),
        Groups: [
          {
            Id: 'grp-1',
            Hash: 'sha256-a9f34bc81',
            Copies: 3,
            DuplicateCopies: 2,
            RecoverableBytes: 24200000,
            KeepPath: 'C:\\Users\\Workspace\\Documents\\Architecture-v2.pdf',
            Files: [
              {
                Name: 'Architecture-v2.pdf',
                Path: 'C:\\Users\\Workspace\\Documents\\Architecture-v2.pdf',
                SizeBytes: 12100000,
                ModifiedTime: '2026-08-15T10:00:00Z',
              },
              {
                Name: 'Architecture-v2-copy.pdf',
                Path: 'C:\\Users\\Workspace\\Downloads\\Architecture-v2-copy.pdf',
                SizeBytes: 12100000,
                ModifiedTime: '2026-08-20T14:30:00Z',
              },
              {
                Name: 'Architecture-v2 (1).pdf',
                Path: 'C:\\Users\\Workspace\\Desktop\\Architecture-v2 (1).pdf',
                SizeBytes: 12100000,
                ModifiedTime: '2026-08-22T09:15:00Z',
              },
            ],
          },
          {
            Id: 'grp-2',
            Hash: 'sha256-b18e7c992',
            Copies: 2,
            DuplicateCopies: 1,
            RecoverableBytes: 15400000,
            KeepPath: 'C:\\Users\\Workspace\\Pictures\\App-Mockup.png',
            Files: [
              {
                Name: 'App-Mockup.png',
                Path: 'C:\\Users\\Workspace\\Pictures\\App-Mockup.png',
                SizeBytes: 15400000,
                ModifiedTime: '2026-07-10T12:00:00Z',
              },
              {
                Name: 'App-Mockup-backup.png',
                Path: 'C:\\Users\\Workspace\\Downloads\\App-Mockup-backup.png',
                SizeBytes: 15400000,
                ModifiedTime: '2026-07-11T08:20:00Z',
              },
            ],
          },
        ],
      },
    });
  });

  apiRouter.get('/tools/duplicate/quarantine', (_req: Request, res: Response) => {
    res.json({
      quarantine: {
        QuarantineDir: 'C:\\ProgramData\\KnouxRepair\\Quarantine\\Duplicates',
        Entries: [
          {
            Id: 'q-1',
            OriginalPath: 'C:\\Users\\Workspace\\Downloads\\temp-backup.zip',
            QuarantinePath: 'C:\\ProgramData\\KnouxRepair\\Quarantine\\Duplicates\\temp-backup-1.zip',
            Hash: 'sha256-c0498df3',
            SizeBytes: 34100000,
            QuarantinedAt: '2026-09-01T11:00:00Z',
          },
        ],
      },
    });
  });

  // Project Sonar mock
  apiRouter.post('/tools/sonar/preview', (_req: Request, res: Response) => {
    res.json({
      preview: {
        Workspace: '/workspace/knoux-repair',
        Snapshot: {
          FileCount: 248,
          Languages: ['TypeScript', 'PowerShell', 'HTML/CSS', 'C#'],
          PackageName: 'knoux-repair-nexus',
          Git: {
            Repository: true,
            Branch: 'main',
            Clean: true,
          },
        },
        SeverityCounts: {
          Critical: 0,
          High: 1,
          Medium: 2,
          Low: 4,
        },
        Findings: [
          {
            Severity: 'HIGH',
            Code: 'SEC-01',
            TitleEn: 'PowerShell Execution Policy Audit',
            TitleAr: 'تدقيق سياسة تنفيذ باورشيل',
            Evidence: 'ExecutionPolicy is set to RemoteSigned. Script signature requirements active.',
            FixEn: 'Ensure all automated service maintenance scripts contain valid internal signatures.',
            FixAr: 'التأكد من أن جميع سكربتات الصيانة المؤتمتة تحتوي على توقيعات داخلية صالحة.',
          },
          {
            Severity: 'MEDIUM',
            Code: 'PERF-01',
            TitleEn: 'Component Store Delta Cleanup Opportunity',
            TitleAr: 'فرصة لتنظيف متجر المكونات WinSxS',
            Evidence: 'WinSxS superseded component delta is approximately 1.4 GB.',
            FixEn: 'Run SM08 / SC06 to analyze and reclaim superseded driver and component storage.',
            FixAr: 'تشغيل أداة SM08 أو SC06 لتحليل واستعادة مساحة المكونات المستبدلة.',
          },
          {
            Severity: 'LOW',
            Code: 'NET-01',
            TitleEn: 'DNS Resolver Cache Longevity',
            TitleAr: 'صلاحية ذاكرة التخزين المؤقت لمحلل DNS',
            Evidence: '42 stale records found in local DNS cache.',
            FixEn: 'Flush DNS client resolver cache using NI03.',
            FixAr: 'تفريغ الذاكرة المؤقتة لمحلل DNS باستخدام أداة NI03.',
          },
        ],
        ServicePlan: [
          {
            ToolId: 'SM01',
            Action: 'Verify Protected System Files',
            Changes: false,
          },
          {
            ToolId: 'SC05',
            Action: 'Analyze Cleanup Potential',
            Changes: false,
          },
          {
            ToolId: 'NI03',
            Action: 'Flush DNS Cache',
            Changes: true,
          },
        ],
      },
    });
  });

  apiRouter.get('/tools/sonar/ai-status', (_req: Request, res: Response) => {
    res.json({ configured: true, model: 'gemini-1.5-flash' });
  });

  apiRouter.post('/tools/sonar/analysis', (_req: Request, res: Response) => {
    res.json({
      model: 'gemini-1.5-flash',
      analysis:
        'KNOUX Repair Workspace Audit:\n\n1. Structural Architecture: Excellent separation between diagnostic modules and presentation layer.\n2. Reliability: High resilience with non-destructive read-only preview stages preceding any repair actions.\n3. Recommendations: Run periodic component store verification and clean DNS resolver caches.',
    });
  });

  apiRouter.post('/tools/sonar/export', (_req: Request, res: Response) => {
    res.json({
      export: {
        format: 'markdown',
        downloadUrl: '/api/health',
      },
    });
  });

  // Folder listing & picker mocks
  apiRouter.get('/workspace/roots', (_req: Request, res: Response) => {
    res.json({
      roots: [
        { name: 'Root System', path: '/', kind: 'root' },
        { name: 'System Drive (C:)', path: 'C:\\', kind: 'drive' },
        { name: 'Data Drive (D:)', path: 'D:\\', kind: 'drive' },
      ],
    });
  });

  apiRouter.get('/workspace/folders', (req: Request, res: Response) => {
    const targetPath = (req.query.path as string) || '/';
    res.json({
      path: targetPath,
      parentPath: targetPath === '/' ? null : '/',
      folders: [
        { name: 'System32', path: `${targetPath}/System32` },
        { name: 'Program Files', path: `${targetPath}/Program Files` },
        { name: 'Users', path: `${targetPath}/Users` },
        { name: 'AppData', path: `${targetPath}/AppData` },
      ],
      truncated: false,
    });
  });

  // Fallback for any other API routes
  apiRouter.use((_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Serve Frontend
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: err?.message || 'Internal server error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[KNOUX NEXUS] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
