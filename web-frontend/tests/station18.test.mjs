import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  deriveSonarCondition,
  summarizeSonar,
  filterFindings,
  severityLabel,
  stationTools,
  SEVERITIES,
} from '../src/features/stations/station18/sonarModel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const manifestPath = path.resolve(__dirname, '../../Docs/TOOLS-MANIFEST.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

test('Station 18: manifest inventory is exactly 7 registered tools', () => {
  const snTools = manifest.filter(
    (t) => t.Category === '18-Project-Sonar' || t.ToolId.startsWith('SN')
  );
  assert.equal(snTools.length, 7);
  const ids = snTools.map((t) => t.ToolId).sort();
  assert.deepEqual(ids, ['SN01', 'SN02', 'SN03', 'SN04', 'SN05', 'SN06', 'SN07']);
});

test('Station 18: all tools are safe READ_ONLY with FULL offline capability', () => {
  const snTools = manifest.filter(
    (t) => t.Category === '18-Project-Sonar' || t.ToolId.startsWith('SN')
  );
  for (const t of snTools) {
    assert.equal(t.RiskLevel, 'READ_ONLY');
    assert.equal(t.RequiresAdmin, false);
    assert.equal(t.OfflineCapability, 'FULL');
    assert.equal(t.AnalyzeOnlySupported, true);
    assert.equal(t.WhatIfSupported, true);
  }
});

test('Station 18: deriveSonarCondition evaluates workspace condition truthfully', () => {
  assert.equal(deriveSonarCondition(null), 'unscanned');

  const healthyPreview = {
    Workspace: 'D:\\project',
    Snapshot: { FileCount: 100, Git: { Repository: true, Branch: 'main' }, Languages: ['TypeScript'], PackageName: 'test' },
    SeverityCounts: { Critical: 0, High: 0, Medium: 0, Low: 0 },
    Findings: [],
    ServicePlan: [],
    ExportFormats: ['markdown', 'pdf'],
  };
  assert.equal(deriveSonarCondition(healthyPreview), 'healthy');

  const attentionPreview = {
    ...healthyPreview,
    SeverityCounts: { Critical: 0, High: 1, Medium: 2, Low: 0 },
  };
  assert.equal(deriveSonarCondition(attentionPreview), 'attention');

  const criticalPreview = {
    ...healthyPreview,
    SeverityCounts: { Critical: 1, High: 0, Medium: 0, Low: 0 },
  };
  assert.equal(deriveSonarCondition(criticalPreview), 'critical');
});

test('Station 18: summarizeSonar normalizes metrics accurately', () => {
  const preview = {
    Workspace: 'D:\\knoux-repair',
    Snapshot: {
      FileCount: 450,
      Git: { Repository: true, Branch: 'main' },
      Languages: ['TypeScript', 'PowerShell'],
      PackageName: 'knoux-repair-nexus',
    },
    SeverityCounts: { Critical: 0, High: 2, Medium: 3, Low: 1 },
    Findings: [
      { Code: 'SN-01', Severity: 'HIGH', TitleEn: 'Missing Lockfile', TitleAr: 'ملف قفل مفقود', Evidence: 'npm', FixEn: 'Run npm install', FixAr: 'شغل npm install' },
      { Code: 'SN-02', Severity: 'MEDIUM', TitleEn: 'Large Bundle', TitleAr: 'حزمة كبيرة', Evidence: 'dist', FixEn: 'Optimize chunking', FixAr: 'حسّن التجزئة' },
    ],
    ServicePlan: [{ ToolId: 'SN04', Action: 'Run Build Audit', Changes: false }],
    ExportFormats: ['markdown', 'pdf'],
  };

  const summary = summarizeSonar(preview, 'D:\\knoux-repair');
  assert.equal(summary.workspace, 'D:\\knoux-repair');
  assert.equal(summary.fileCount, 450);
  assert.equal(summary.isGitRepo, true);
  assert.equal(summary.gitBranch, 'main');
  assert.deepEqual(summary.languages, ['TypeScript', 'PowerShell']);
  assert.equal(summary.packageName, 'knoux-repair-nexus');
  assert.equal(summary.criticalCount, 0);
  assert.equal(summary.highCount, 2);
  assert.equal(summary.mediumCount, 3);
  assert.equal(summary.lowCount, 1);
  assert.equal(summary.totalFindings, 2);
  assert.equal(summary.condition, 'attention');
});

test('Station 18: filterFindings filters by severity and text search', () => {
  const findings = [
    { Code: 'GIT-01', Severity: 'CRITICAL', TitleEn: 'Detached HEAD', TitleAr: 'رأس Git منفصل', Evidence: 'HEAD', FixEn: 'Checkout branch', FixAr: 'انتقل للفرع' },
    { Code: 'SEC-01', Severity: 'HIGH', TitleEn: 'Secret Detected', TitleAr: 'مفتاح مكشوف', Evidence: '.env', FixEn: 'Remove key', FixAr: 'احذف المفتاح' },
    { Code: 'DOC-01', Severity: 'LOW', TitleEn: 'Missing Readme', TitleAr: 'ملف توثيق مفقود', Evidence: 'README', FixEn: 'Create file', FixAr: 'أنشئ ملف' },
  ];

  assert.equal(filterFindings(findings, 'ALL').length, 3);
  assert.equal(filterFindings(findings, 'CRITICAL').length, 1);
  assert.equal(filterFindings(findings, 'HIGH').length, 1);
  assert.equal(filterFindings(findings, 'LOW').length, 1);
  assert.equal(filterFindings(findings, 'ALL', 'secret').length, 1);
  assert.equal(filterFindings(findings, 'ALL', 'مفتاح').length, 1);
});

test('Station 18: severityLabel renders English and Arabic truthfully', () => {
  for (const sev of SEVERITIES) {
    const en = severityLabel(sev, 'en');
    const ar = severityLabel(sev, 'ar');
    assert.ok(en.length > 0, `English label for ${sev} should exist`);
    assert.ok(ar.length > 0, `Arabic label for ${sev} should exist`);
    assert.notEqual(en, ar, `English and Arabic labels for ${sev} must be distinct`);
  }
});
