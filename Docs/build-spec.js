const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  TableBorders, VerticalAlign, PageBreak, UnderlineType,
  LevelFormat, convertInchesToTwip, Header, Footer, PageNumber,
  NumberFormat, TabStopType, TabStopLeader, ExternalHyperlink,
  PositionalTab, PositionalTabAlignment, PositionalTabLeader
} = require(process.env.KNOUX_DOCX_MODULE || 'docx');
const fs = require('fs');
const path = require('path');

// Canonical project data is loaded at generation time. No tool, category, path,
// capability, or risk value is authored in this document generator.
function readCliValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

const projectRoot = path.resolve(readCliValue('--project-root') || process.env.KNOUX_REPAIR_ROOT || process.cwd());
const manifestPath = path.resolve(projectRoot, 'Docs', 'TOOLS-MANIFEST.json');
const outputPath = path.resolve(readCliValue('--output') || path.join(projectRoot, 'Docs', 'KNOUX-Repair-v2.0.2-MASTER-VISUAL-SPECIFICATION.docx'));

function valueText(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).replace(/\r?\n/g, ' ');
}

function loadCanonicalManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Canonical manifest not found: ${manifestPath}`);
  }

  let tools;
  try {
    tools = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`Canonical manifest is not valid JSON: ${error.message}`);
  }

  if (!Array.isArray(tools)) {
    throw new Error('Canonical manifest must be a JSON array of tool records.');
  }

  const requiredFields = [
    'ToolId', 'Category', 'ScriptPath', 'EnglishName', 'ArabicName', 'Purpose',
    'RiskLevel', 'RequiresAdmin', 'RequiresRestart', 'OfflineCapability',
    'BackupMethod', 'RollbackMethod', 'AnalyzeOnlySupported', 'WhatIfSupported', 'TestResult',
  ];
  const toolIds = new Set();
  const categories = new Set();
  const errors = [];

  tools.forEach((tool, index) => {
    const label = `manifest record ${index + 1}`;
    if (!tool || typeof tool !== 'object') {
      errors.push(`${label} is not an object.`);
      return;
    }
    requiredFields.forEach((field) => {
      if (tool[field] === null || tool[field] === undefined || tool[field] === '') {
        errors.push(`${label} is missing ${field}.`);
      }
    });
    if (tool.ToolId) {
      if (toolIds.has(tool.ToolId)) errors.push(`Duplicate ToolId: ${tool.ToolId}.`);
      toolIds.add(tool.ToolId);
    }
    if (tool.Category) categories.add(tool.Category);
    if (tool.ScriptPath && !fs.existsSync(path.resolve(projectRoot, tool.ScriptPath))) {
      errors.push(`Missing ScriptPath for ${tool.ToolId || label}: ${tool.ScriptPath}.`);
    }
  });

  if (tools.length !== 100) errors.push(`Expected 100 tools; found ${tools.length}.`);
  if (categories.size !== 10) errors.push(`Expected 10 categories; found ${categories.size}.`);
  if (errors.length) throw new Error(`Canonical manifest validation failed:\n- ${errors.join('\n- ')}`);

  return {
    tools: [...tools].sort((a, b) => a.ToolId.localeCompare(b.ToolId)),
    categories: [...categories].sort(),
  };
}

const canonicalManifest = loadCanonicalManifest();
const canonicalTools = canonicalManifest.tools;
const canonicalCategories = canonicalManifest.categories;

function categoryDisplayName(category) {
  return category.replace(/^\d{2}-/, '').replace(/-/g, ' ');
}

function canonicalToolRows() {
  return canonicalTools.map((tool) => [
    valueText(tool.ToolId),
    valueText(tool.EnglishName),
    valueText(tool.Category),
    valueText(tool.RiskLevel),
    valueText(tool.RequiresAdmin),
    valueText(tool.AnalyzeOnlySupported),
    valueText(tool.WhatIfSupported),
  ]);
}

function canonicalToolDetailBlocks() {
  return canonicalTools.flatMap((tool) => [
    heading3(`${valueText(tool.ToolId)} — ${valueText(tool.EnglishName)}`),
    buildTable(
      ['Canonical Field', 'Verified Value'],
      [
        ['ToolId', valueText(tool.ToolId)],
        ['Category', valueText(tool.Category)],
        ['ScriptPath', valueText(tool.ScriptPath)],
        ['EnglishName', valueText(tool.EnglishName)],
        ['ArabicName', valueText(tool.ArabicName)],
        ['Purpose', valueText(tool.Purpose)],
        ['RiskLevel', valueText(tool.RiskLevel)],
        ['RequiresAdmin', valueText(tool.RequiresAdmin)],
        ['RequiresRestart', valueText(tool.RequiresRestart)],
        ['OfflineCapability', valueText(tool.OfflineCapability)],
        ['BackupMethod', valueText(tool.BackupMethod)],
        ['RollbackMethod', valueText(tool.RollbackMethod)],
        ['AnalyzeOnlySupported', valueText(tool.AnalyzeOnlySupported)],
        ['WhatIfSupported', valueText(tool.WhatIfSupported)],
        ['TestResult', valueText(tool.TestResult)],
      ],
      [2200, 6800]
    ),
    ...spacer(1),
  ]);
}


// ─── PALETTE ────────────────────────────────────────────────────────────────
const C = {
  // Brand
  accentBlue:   '2C7BE5',
  accentHover:  '3D89F0',
  accentDark:   '1A6AD0',
  // Dark surfaces
  shell:        '0E0F13',
  primary:      '13151C',
  elevated:     '1A1D27',
  // Text
  textPrimary:  'F0F2F7',
  textSecondary:'B0B8CC',
  textMuted:    '6E7A94',
  textDisabled: '3E4558',
  // Status
  success:      '2DB87D',
  warning:      'FFB020',
  error:        'E54B4B',
  cancelled:    '8896B0',
  skipped:      '6E7A94',
  inconclusive: 'A855F7',
  // Risk
  readOnly:     '2DB87D',
  safeCleanup:  'FFB020',
  destructive:  'E54B4B',
  // Doc chrome
  headingBg:    '1A2340',
  rowAlt:       'F4F6FB',
  tableBorder:  'D0D5E4',
  white:        'FFFFFF',
  nearBlack:    '0D1117',
  sectionBar:   '2C7BE5',
  warnBg:       'FFF8EC',
  warnBorder:   'FFB020',
  critBg:       'FFF0F0',
  critBorder:   'E54B4B',
  infoBg:       'EEF4FF',
  infoBorder:   '2C7BE5',
  okBg:         'EEFAF5',
  okBorder:     '2DB87D',
  codeText:     '1A2340',
  codeBg:       'F0F3FA',
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.sectionBar, space: 8 } },
  });
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 120 },
  });
}

function heading3(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 80 },
  });
}

function heading4(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 200, after: 60 },
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, color: opts.color || C.nearBlack, size: opts.size || 22, bold: opts.bold, italics: opts.italic, font: opts.mono ? 'Cascadia Code' : undefined })],
    spacing: { before: opts.before || 60, after: opts.after || 60 },
    alignment: opts.align || AlignmentType.LEFT,
    indent: opts.indent ? { left: opts.indent } : undefined,
  });
}

function richPara(runs, opts = {}) {
  return new Paragraph({
    children: runs,
    spacing: { before: opts.before || 60, after: opts.after || 80 },
    alignment: opts.align || AlignmentType.LEFT,
    indent: opts.indent ? { left: opts.indent } : undefined,
  });
}

function tr(text, bold = false, color = C.nearBlack) {
  return new TextRun({ text, bold, color, size: 22, font: 'Segoe UI' });
}

function accent(text) {
  return new TextRun({ text, bold: true, color: C.accentBlue, size: 22, font: 'Segoe UI' });
}

function mono(text, color = C.codeText) {
  return new TextRun({ text, color, size: 20, font: 'Cascadia Code' });
}

function bullet(text, level = 0, bold = false) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, color: C.nearBlack, bold, font: 'Segoe UI' })],
    bullet: { level },
    spacing: { before: 40, after: 40 },
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 0 } });
}

function rule() {
  return new Paragraph({
    text: '',
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder, space: 4 } },
    spacing: { before: 160, after: 160 },
  });
}

function spacer(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({ text: '', spacing: { before: 40, after: 40 } }));
}

// ─── NOTICE BOX ─────────────────────────────────────────────────────────────
function noticeBox(label, lines, bgColor = C.infoBg, borderColor = C.infoBorder) {
  const rows = [];
  const headerRow = new TableRow({
    children: [new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color: C.white, size: 22, font: 'Segoe UI' })], alignment: AlignmentType.LEFT })],
      shading: { fill: borderColor, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    })]
  });
  rows.push(headerRow);
  lines.forEach(line => {
    rows.push(new TableRow({
      children: [new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: line, size: 21, color: C.nearBlack, font: 'Segoe UI' })], spacing: { before: 30, after: 30 } })],
        shading: { fill: bgColor, type: ShadingType.CLEAR },
        margins: { top: 40, bottom: 40, left: 120, right: 120 },
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.THICK, size: 12, color: borderColor }, right: { style: BorderStyle.NONE } },
      })]
    }));
  });
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

// ─── TABLE BUILDER ──────────────────────────────────────────────────────────
function buildTable(headers, rows, colWidths) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: C.white, size: 20, font: 'Segoe UI' })], alignment: AlignmentType.LEFT })],
      shading: { fill: C.headingBg, type: ShadingType.CLEAR },
      width: { size: colWidths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
    }))
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 20, color: C.nearBlack, font: cell.startsWith && cell.startsWith('TO BE') ? 'Segoe UI' : 'Segoe UI', italics: cell.startsWith && cell.startsWith('TO BE') })], spacing: { before: 60, after: 60 } })],
      shading: { fill: ri % 2 === 0 ? C.white : C.rowAlt, type: ShadingType.CLEAR },
      width: { size: colWidths[ci], type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
    }))
  }));
  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: totalW, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder },
      left: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder },
      right: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder },
      insideH: { style: BorderStyle.SINGLE, size: 2, color: C.tableBorder },
      insideV: { style: BorderStyle.SINGLE, size: 2, color: C.tableBorder },
    }
  });
}

// ─── CODE BLOCK ─────────────────────────────────────────────────────────────
function codeBlock(lines) {
  return new Table({
    rows: [new TableRow({ children: [new TableCell({
      children: lines.map(line => new Paragraph({ children: [new TextRun({ text: line, font: 'Cascadia Code', size: 18, color: C.codeText })], spacing: { before: 20, after: 20 } })),
      shading: { fill: C.codeBg, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      borders: { top: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder }, bottom: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder }, left: { style: BorderStyle.THICK, size: 12, color: C.accentBlue }, right: { style: BorderStyle.SINGLE, size: 4, color: C.tableBorder } },
    })] })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ─── MANIFEST TABLE PLACEHOLDER ─────────────────────────────────────────────
function manifestPlaceholderTable(extraCols = []) {
  const baseCols = ['ToolId', 'EnglishName', 'ArabicName', 'Category', 'Purpose', 'RiskLevel', 'RequiresAdmin', 'RequiresRestart'];
  const allCols = [...baseCols, ...extraCols];
  const widths = allCols.map(() => Math.floor(9000 / allCols.length));
  const placeholderRow = allCols.map(c => c === 'ToolId' ? 'TO BE POPULATED FROM Docs/TOOLS-MANIFEST.json' : '—');
  return buildTable(allCols, [placeholderRow], widths);
}

// ─── STATUS BADGE ROW ────────────────────────────────────────────────────────
function statusTable(statuses) {
  // statuses = [{label, color, bgColor, canonicalEnum, custLabel, policy}]
  const rows = statuses.map(s => [s.canonicalEnum, s.custLabel, s.policy]);
  return buildTable(['Canonical RiskLevel / Status', 'Customer-Facing Label', 'UX / Confirmation Policy'],
    rows, [2800, 2200, 4000]);
}

// ============================================================================
//  DOCUMENT SECTIONS
// ============================================================================

function coverPage() {
  return [
    ...spacer(4),
    new Paragraph({
      children: [new TextRun({ text: 'KNOUX REPAIR v2.0.2', bold: true, size: 64, color: C.accentBlue, font: 'Segoe UI' })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: 'MASTER VISUAL SPECIFICATION', bold: true, size: 40, color: C.headingBg, font: 'Segoe UI' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'Glass Nexus — Implementation-Grade', size: 28, color: C.textMuted, font: 'Segoe UI', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 240 },
    }),
    rule(),
    new Paragraph({
      children: [new TextRun({ text: 'Document Version: 1.0.0', size: 22, color: C.nearBlack, font: 'Segoe UI' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 30 },
    }),
    new Paragraph({ children: [new TextRun({ text: 'Platform: Windows Desktop · WPF · C# · .NET 8', size: 22, color: C.nearBlack, font: 'Segoe UI' })], alignment: AlignmentType.CENTER, spacing: { before: 30, after: 30 } }),
    new Paragraph({ children: [new TextRun({ text: 'Visual Direction: Glass Nexus', size: 22, color: C.nearBlack, font: 'Segoe UI' })], alignment: AlignmentType.CENTER, spacing: { before: 30, after: 30 } }),
    new Paragraph({ children: [new TextRun({ text: 'Target Audience: WPF Desktop Developer', size: 22, color: C.nearBlack, font: 'Segoe UI' })], alignment: AlignmentType.CENTER, spacing: { before: 30, after: 60 } }),
    rule(),
    ...spacer(2),
    noticeBox('DOCUMENT STATUS', [
      'STATUS: AUTHORITATIVE VISUAL / INTERACTION ARCHITECTURE SPECIFICATION',
      '',
      'DATA STATUS:',
      '  Canonical application architecture is fully specified.',
      '  Per-tool data tables are intentionally marked:',
      '  "TO BE POPULATED FROM Docs/TOOLS-MANIFEST.json"',
      '  where the complete manifest has not been loaded.',
      '',
      'THIS IS INTENTIONAL.',
      'It MUST NOT be interpreted as permission to invent data.',
      'No ToolId, EnglishName, ArabicName, ScriptPath, Purpose, or capability',
      'may be fabricated. All data must come from the actual manifest file.',
    ], C.critBg, C.critBorder),
    ...spacer(2),
    noticeBox('IMPLEMENTATION CONTRACT', [
      'This document is not a design essay. It is an implementation contract.',
      'Every measurement, color value, timing, state, and rule is a specification.',
      'Read this document once fully, then implement section by section.',
      'No guessing. No improvising.',
      'Flag every ambiguity — do not fill it.',
    ], C.infoBg, C.infoBorder),
    pageBreak(),
  ];
}

function section01() {
  return [
    heading1('SECTION 01 — PRODUCT VISUAL IDENTITY'),
    heading2('1.1 What KNOUX Repair Is'),
    para('KNOUX Repair is a professional Windows diagnostics and maintenance workstation for power users, IT professionals, and technical users who require real control over their Windows environment. It surfaces real Windows maintenance and diagnostic tools across 10 domain categories, executes them via PowerShell with real output, and reports real results.'),
    para('It is NOT a consumer PC cleaner. It is NOT a simplified wizard. It is a command center.'),

    heading2('1.2 Visual Personality'),
    buildTable(
      ['Axis', 'Position'],
      [
        ['Tone', 'Quiet authority'],
        ['Energy', 'Focused, controlled'],
        ['Warmth', 'Professional — not cold'],
        ['Complexity', 'Dense but navigable'],
        ['Modernity', 'Contemporary, not trendy'],
        ['Trustworthiness', 'Absolute'],
        ['Excitement', 'Subdued — the tools do the work'],
      ],
      [3200, 5800]
    ),
    ...spacer(1),
    heading2('1.3 Visual Inspiration References (inspiration only — do not copy)'),
    bullet('Windows 11 Settings: native discipline, clean hierarchy, system-appropriate chrome'),
    bullet('Windows Terminal: technical elegance, readable console, restrained dark surfaces'),
    bullet('Azure Portal: information density with clear hierarchy, subtle depth'),
    bullet('Fluent Design System: material layering without excess'),
    bullet('JetBrains Rider dark theme: developer tool gravity, clear states, readable typography'),

    heading2('1.4 What to Avoid'),
    bullet('Cyberpunk neon overload (no green-on-black hacker aesthetic)'),
    bullet('Gaming UI (no RGB gradients, no aggressive chrome, no oversized hit targets)'),
    bullet('Fake AI interfaces (no animated neural nets, no fake "scanning" visuals)'),
    bullet('Generic admin dashboards (no Bootstrap-style grids, no web-ported card decks)'),
    bullet('Over-decorated splash screens (no particle systems, no 3D logos)'),

    heading2('1.5 Glass Nexus Philosophy — KNOUX Specific Definition'),
    noticeBox('GLASS NEXUS DEFINITION', [
      'A precision instrument UI where structural surfaces are dark, slightly translucent, and layered,',
      'creating measurable depth without confusion. Glass effects are SURGICAL — applied only at interface',
      'intersections (panels meeting panels, cards floating above content, dialogs above shell) to communicate',
      'genuine elevation. The UI is primarily SOLID and DARK, with glass as accent material at borders and',
      'floating surfaces. The overall effect is "premium workstation software."',
    ], C.infoBg, C.infoBorder),
    ...spacer(1),
    buildTable(
      ['Glass Nexus IS', 'Glass Nexus IS NOT'],
      [
        ['Dark solid base layer (shell background)', 'Full-bleed transparency everywhere'],
        ['Slightly elevated surfaces with subtle translucency (panels, cards, sidebar)', 'Frosted glass on every element'],
        ['Accent-lit borders using glass highlight lines at top edges of elevated surfaces', 'White semi-transparent panels on dark background'],
        ['Blur applied only where depth would be meaningfully communicated', 'Glassmorphism as decoration'],
        ['High-contrast readable foreground regardless of translucency beneath', 'Decoration that sacrifices legibility'],
      ],
      [4500, 4500]
    ),

    heading2('1.6 Design Principles — Priority Ordered'),
    bullet('1. Legibility first. No text is ever sacrificed for aesthetic. Minimum 4.5:1 contrast ratio for all body text.', 0, true),
    bullet('2. Real states only. Every visual state must map to a real application state. No fake scanning, no invented progress.', 0, true),
    bullet('3. Hierarchy before decoration. User must identify: what tool, what it does, what state — in under 2 seconds.', 0, true),
    bullet('4. Restraint in motion. Transitions communicate structure. All durations under 300ms. Nothing loops unless system is active.', 0, true),
    bullet('5. Windows native first. Must feel native to Windows 11. Respect DPI, snap layouts, system-level dark/light preference.', 0, true),
    bullet('6. Arabic as first-class language. RTL is not a modification layer. Both reading directions designed simultaneously.', 0, true),

    heading2('1.7 Visual Hierarchy Model'),
    codeBlock([
      'TIER 1: SHELL STRUCTURE',
      '  Shell background, sidebar, title bar, status bar',
      '  — lowest elevation, most stable, always visible',
      '',
      'TIER 2: CONTENT SURFACES',
      '  Content area, tool grids, category panels',
      '  — mid elevation, context-dependent, scrollable',
      '',
      'TIER 3: INTERACTIVE / FLOATING',
      '  Tool detail panel, dialogs, confirmation sheets, toasts',
      '  — highest elevation, glass material, focused attention',
    ]),
    pageBreak(),
  ];
}

function section02() {
  return [
    heading1('SECTION 02 — SURFACE HIERARCHY'),

    heading2('2.1 Five Surface Types'),
    para('Every visible region of the application belongs to exactly one of these surface types.'),

    heading3('Surface Type 0 — Shell Background (deepest layer)'),
    buildTable(['Property', 'Dark Mode', 'Light Mode', 'Notes'],
      [
        ['Color', '#0E0F13', '#EEF0F5', 'Near-black with blue-grey tint; NOT pure black'],
        ['Treatment', 'Solid. No transparency. No blur.', 'Solid. No transparency. No blur.', 'This is the anchor layer.'],
        ['Allowed on', 'Window background, dead space behind sidebar/content', 'Window background, dead space', ''],
      ], [2200, 2400, 2400, 2000]),

    ...spacer(1),
    heading3('Surface Type 1 — Primary Surface'),
    buildTable(['Property', 'Dark Mode', 'Light Mode', 'Notes'],
      [
        ['Color', '#13151C', '#F5F7FC', 'Very dark blue-grey'],
        ['Treatment', 'Solid. Very slight border (#FFFFFF08).', 'Solid. Very slight border (#00000010).', ''],
        ['Allowed on', 'Main content area bg, category headers, dividers', 'Same', ''],
      ], [2200, 2400, 2400, 2000]),

    ...spacer(1),
    heading3('Surface Type 2 — Elevated Surface'),
    buildTable(['Property', 'Dark Mode', 'Light Mode', 'Notes'],
      [
        ['Color', '#1A1D27 (rgba 0.92)', '#FFFFFF + shadow', 'Dark blue-grey, 8pts above shell'],
        ['Treatment', 'Slightly translucent', '0 2px 8px rgba(0,0,0,0.08)', ''],
        ['Allowed on', 'Sidebar, tool cards, dashboard tiles, content cards', 'Same', ''],
      ], [2200, 2400, 2400, 2000]),

    ...spacer(1),
    heading3('Surface Type 3 — Glass Surface (The "Glass" in Glass Nexus)'),
    buildTable(['Property', 'Dark Mode', 'Light Mode', 'Notes'],
      [
        ['Color', 'rgba(20,22,32,0.85)', 'rgba(255,255,255,0.82)', 'Translucent'],
        ['Blur', 'BlurEffect Radius 24', 'BlurEffect Radius 20', 'WPF equivalent of backdrop-filter'],
        ['Border', '1px rgba(255,255,255,0.14)', '1px rgba(0,0,0,0.12)', 'Glass border'],
        ['Top accent', '1px rgba(255,255,255,0.22) — top edge only', '1px rgba(255,255,255,0.90) top only', 'Characteristic Glass Nexus highlight'],
        ['Allowed on', 'Tool detail panel, confirmation dialogs, toasts', 'Same', ''],
      ], [2200, 2400, 2400, 2000]),

    ...spacer(1),
    heading3('Surface Type 4 — Interactive Surface'),
    buildTable(['Property', 'Dark Mode', 'Light Mode', 'Notes'],
      [
        ['Primary color', '#2C7BE5 (accent blue)', '#1A6ED8', 'Solid primary buttons'],
        ['Secondary color', 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.05)', 'Ghost secondary with border'],
        ['Allowed on', 'Action buttons, chip filters, toggle switches, inputs', 'Same', ''],
      ], [2200, 2400, 2400, 2000]),

    heading2('2.2 Borders'),
    buildTable(['Context', 'Dark Mode', 'Light Mode'],
      [
        ['Shell divider', '1px rgba(255,255,255,0.06)', '1px rgba(0,0,0,0.08)'],
        ['Card border', '1px rgba(255,255,255,0.08)', '1px rgba(0,0,0,0.10)'],
        ['Glass border', '1px rgba(255,255,255,0.14)', '1px rgba(0,0,0,0.12)'],
        ['Glass top accent', '1px rgba(255,255,255,0.22) — TOP EDGE ONLY', '1px rgba(255,255,255,0.90) — TOP EDGE ONLY'],
        ['Input border', '1px rgba(255,255,255,0.12)', '1px rgba(0,0,0,0.18)'],
        ['Input focused', '1px #2C7BE5', '1px #1A6ED8'],
        ['Error border', '1px #E54B4B', '1px #CC3333'],
        ['Success border', '1px #2DB87D', '1px #1E9E6A'],
      ], [3000, 3000, 3000]),

    ...spacer(1),
    noticeBox('GLASS TOP ACCENT LINE — CRITICAL', [
      'Every glass surface and elevated card has a 1px highlight line at its TOP EDGE ONLY.',
      'This simulates top-down ambient light catching the surface edge.',
      'It communicates elevation without heavy shadow.',
      'Implementation: Separate Border element at top of card, OR custom ControlTemplate segment.',
      'NOT a box shadow. NOT a gradient. A real 1px Border element.',
    ], C.infoBg, C.infoBorder),

    heading2('2.3 Shadows and Elevation'),
    buildTable(['Level', 'Dark Mode', 'Light Mode'],
      [
        ['Card', '0 2px 8px rgba(0,0,0,0.40)', '0 2px 8px rgba(0,0,0,0.08)'],
        ['Elevated panel', '0 4px 16px rgba(0,0,0,0.50)', '0 4px 16px rgba(0,0,0,0.12)'],
        ['Dialog', '0 8px 32px rgba(0,0,0,0.60)', '0 8px 32px rgba(0,0,0,0.18)'],
        ['Tooltip', '0 2px 6px rgba(0,0,0,0.50)', '0 2px 6px rgba(0,0,0,0.14)'],
      ], [3000, 3000, 3000]),

    heading2('2.4 Glass Implementation in WPF'),
    heading3('Approach A — WindowChrome + AllowsTransparency (preferred for dialogs)'),
    bullet('Set AllowsTransparency="True" on dialog windows'),
    bullet('Use Window.Background with opacity'),
    bullet('Apply blur using BlurEffect on a behind-content rectangle'),
    bullet('Disable if user\'s system has GPU limitations or if Aero is disabled'),

    heading3('Approach B — Simulated Glass (fallback)'),
    bullet('Dark fallback: #1C1F2E (no transparency)'),
    bullet('Light fallback: #F8FAFF (no transparency)'),
    para('The ThemeService must expose a IsGlassEnabled boolean. When false, fall back to Approach B everywhere. Both paths must be implemented.'),

    heading2('2.5 Blur Rules'),
    para('Use BlurEffect with Radius between 16 and 28 for panel/dialog backgrounds only.'),
    noticeBox('NEVER APPLY BLUR TO:', [
      'Text elements',
      'Icons',
      'Interactive controls',
      'Navigation items',
      'Status indicators',
      'Console output',
      'Blur is exclusively a background material property.',
    ], C.critBg, C.critBorder),

    heading2('2.6 Corner Radius Reference'),
    buildTable(['Element', 'Radius'],
      [
        ['Main window', '10px (custom chrome only)'],
        ['Sidebar', '0px (flush with window edge)'],
        ['Cards / Tool cards', '8px'],
        ['Buttons (primary and ghost)', '6px'],
        ['Input fields', '6px'],
        ['Tags / chips', '4px'],
        ['Status badges', '4px'],
        ['Tooltips', '6px'],
        ['Dialogs / sheets', '12px'],
        ['Progress bars (track and fill)', '3px'],
        ['Toast notifications', '8px'],
      ], [4500, 4500]),

    heading2('2.7 Gradient Usage (Restricted)'),
    para('Gradients are used sparingly and ONLY for:'),
    bullet('Active navigation item background: subtle vertical gradient from accent color at 15% opacity to transparent'),
    bullet('Status result headers: very subtle horizontal gradient — rgba(statusColor, 0.12) to transparent from left edge'),
    bullet('Splash screen background: radial gradient — center #1A1D27 expanding to #0E0F13'),
    noticeBox('NEVER USE GRADIENTS FOR:', [
      'Diagonal rainbow gradients',
      'Neon gradient borders',
      'Animated color-shifting gradients',
      'Full-panel gradient backgrounds over content',
    ], C.critBg, C.critBorder),

    heading2('2.8 Single Light Source Rule'),
    para('Ambient top-down light only. One light source. Consequences:'),
    bullet('Highlight lines appear at TOP edges of elevated surfaces'),
    bullet('Shadows appear at BOTTOM edges of elevated surfaces'),
    bullet('No second light source'),
    bullet('No colored rim lights'),
    bullet('No colored shadows — except hover glow on accent buttons: 0 0 12px rgba(accentColor, 0.35) on exterior only'),
    pageBreak(),
  ];
}

function section03() {
  return [
    heading1('SECTION 03 — COLOR SYSTEM'),

    heading2('3.1 Dark Mode Semantic Color Tokens'),
    para('All tokens defined as SolidColorBrush or Color resources in Colors.xaml. Add missing tokens without removing existing functional ones.'),

    heading3('Backgrounds'),
    codeBlock([
      '<Color x:Key="Color.Background.Shell">#FF0E0F13</Color>       <!-- near-black, blue-grey tint -->',
      '<Color x:Key="Color.Background.Primary">#FF13151C</Color>     <!-- very dark blue-grey -->',
      '<Color x:Key="Color.Background.Elevated">#FF1A1D27</Color>    <!-- dark blue-grey, 8pts above shell -->',
      '<Color x:Key="Color.Background.Glass">#D914161E</Color>       <!-- 85% opacity -->',
      '<Color x:Key="Color.Background.Overlay">#A0000000</Color>     <!-- modal scrim -->',
    ]),

    heading3('Borders'),
    codeBlock([
      '<Color x:Key="Color.Border.Subtle">#0FFFFFFF</Color>          <!-- 6% white -->',
      '<Color x:Key="Color.Border.Default">#14FFFFFF</Color>         <!-- 8% white -->',
      '<Color x:Key="Color.Border.Glass">#24FFFFFF</Color>           <!-- 14% white -->',
      '<Color x:Key="Color.Border.GlassTop">#38FFFFFF</Color>        <!-- 22% white, top accent -->',
      '<Color x:Key="Color.Border.Focus">#FF2C7BE5</Color>           <!-- matches accent -->',
    ]),

    heading3('Text'),
    codeBlock([
      '<Color x:Key="Color.Text.Primary">#FFF0F2F7</Color>           <!-- near-white, readable -->',
      '<Color x:Key="Color.Text.Secondary">#FFB0B8CC</Color>         <!-- mid grey-blue -->',
      '<Color x:Key="Color.Text.Muted">#FF6E7A94</Color>             <!-- low emphasis -->',
      '<Color x:Key="Color.Text.Disabled">#FF3E4558</Color>          <!-- inactive -->',
      '<Color x:Key="Color.Text.OnAccent">#FFFFFFFF</Color>          <!-- text on accent bg -->',
      '<Color x:Key="Color.Text.Console">#FFD4E4B0</Color>           <!-- console output -->',
      '<Color x:Key="Color.Text.ConsoleWarning">#FFFFCC44</Color>',
      '<Color x:Key="Color.Text.ConsoleError">#FFFF6B6B</Color>',
      '<Color x:Key="Color.Text.ConsoleSuccess">#FF5DE8A0</Color>',
      '<Color x:Key="Color.Text.ConsoleMuted">#FF6E7A94</Color>      <!-- timestamps, prefixes -->',
    ]),

    heading3('Accent'),
    codeBlock([
      '<Color x:Key="Color.Accent.Primary">#FF2C7BE5</Color>         <!-- primary interactive blue -->',
      '<Color x:Key="Color.Accent.Hover">#FF3D89F0</Color>           <!-- lighter on hover -->',
      '<Color x:Key="Color.Accent.Pressed">#FF1A6AD0</Color>         <!-- darker on press -->',
      '<Color x:Key="Color.Accent.Subtle">#1A2C7BE5</Color>          <!-- 10% blue for backgrounds -->',
      '<Color x:Key="Color.Accent.Glow">#592C7BE5</Color>            <!-- 35% blue, button glow -->',
    ]),

    heading3('Status Colors — Dark Mode'),
    codeBlock([
      '<!-- SUCCESS -->',
      '<Color x:Key="Color.Status.Success">#FF2DB87D</Color>',
      '<Color x:Key="Color.Status.SuccessSubtle">#1A2DB87D</Color>',
      '<Color x:Key="Color.Status.SuccessBorder">#332DB87D</Color>',
      '',
      '<!-- WARNING -->',
      '<Color x:Key="Color.Status.Warning">#FFFFB020</Color>',
      '<Color x:Key="Color.Status.WarningSubtle">#1AFFB020</Color>',
      '<Color x:Key="Color.Status.WarningBorder">#33FFB020</Color>',
      '',
      '<!-- ERROR -->',
      '<Color x:Key="Color.Status.Error">#FFE54B4B</Color>',
      '<Color x:Key="Color.Status.ErrorSubtle">#1AE54B4B</Color>',
      '<Color x:Key="Color.Status.ErrorBorder">#33E54B4B</Color>',
      '',
      '<!-- CANCELLED -->',
      '<Color x:Key="Color.Status.Cancelled">#FF8896B0</Color>',
      '<Color x:Key="Color.Status.CancelledSubtle">#1A8896B0</Color>',
      '<Color x:Key="Color.Status.CancelledBorder">#338896B0</Color>',
      '',
      '<!-- SKIPPED -->',
      '<Color x:Key="Color.Status.Skipped">#FF6E7A94</Color>',
      '<Color x:Key="Color.Status.SkippedSubtle">#0F6E7A94</Color>',
      '<Color x:Key="Color.Status.SkippedBorder">#206E7A94</Color>',
      '',
      '<!-- INCONCLUSIVE -->',
      '<Color x:Key="Color.Status.Inconclusive">#FFA855F7</Color>',
      '<Color x:Key="Color.Status.InconclusiveSubtle">#1AA855F7</Color>',
      '<Color x:Key="Color.Status.InconclusiveBorder">#33A855F7</Color>',
    ]),

    heading3('Risk Level Colors — Dark Mode'),
    codeBlock([
      '<Color x:Key="Color.Risk.ReadOnly">#FF2DB87D</Color>          <!-- matches Status.Success -->',
      '<Color x:Key="Color.Risk.SafeCleanup">#FFFFB020</Color>       <!-- matches Status.Warning -->',
      '<Color x:Key="Color.Risk.Destructive">#FFE54B4B</Color>       <!-- matches Status.Error -->',
    ]),

    heading3('Interactive State Colors'),
    codeBlock([
      '<Color x:Key="Color.Interactive.HoverOverlay">#0AFFFFFF</Color>       <!-- 4% white -->',
      '<Color x:Key="Color.Interactive.PressOverlay">#14FFFFFF</Color>        <!-- 8% white -->',
      '<Color x:Key="Color.Interactive.SelectedBackground">#1A2C7BE5</Color>',
      '<Color x:Key="Color.Interactive.SelectedBorder">#FF2C7BE5</Color>',
    ]),

    heading2('3.2 Light Mode Semantic Color Tokens'),
    para('Defined in Light.xaml as overrides — same token keys, different values.'),
    codeBlock([
      '<!-- BACKGROUNDS — Light Mode -->',
      '<Color x:Key="Color.Background.Shell">#FFECEFF6</Color>',
      '<Color x:Key="Color.Background.Primary">#FFF5F7FC</Color>',
      '<Color x:Key="Color.Background.Elevated">#FFFFFFFF</Color>',
      '<Color x:Key="Color.Background.Glass">#D0FFFFFF</Color>',
      '<Color x:Key="Color.Background.Overlay">#60000000</Color>',
      '',
      '<!-- BORDERS — Light Mode -->',
      '<Color x:Key="Color.Border.Subtle">#0A000000</Color>',
      '<Color x:Key="Color.Border.Default">#12000000</Color>',
      '<Color x:Key="Color.Border.Glass">#20000000</Color>',
      '<Color x:Key="Color.Border.GlassTop">#CCFFFFFF</Color>',
      '<Color x:Key="Color.Border.Focus">#FF1A6ED8</Color>',
      '',
      '<!-- TEXT — Light Mode -->',
      '<Color x:Key="Color.Text.Primary">#FF0D1117</Color>',
      '<Color x:Key="Color.Text.Secondary">#FF3D4A6B</Color>',
      '<Color x:Key="Color.Text.Muted">#FF7A849C</Color>',
      '<Color x:Key="Color.Text.Disabled">#FFAAB2C4</Color>',
      '<Color x:Key="Color.Text.OnAccent">#FFFFFFFF</Color>',
      '<Color x:Key="Color.Text.Console">#FF2C3E50</Color>',
      '<Color x:Key="Color.Text.ConsoleWarning">#FF8B6914</Color>',
      '<Color x:Key="Color.Text.ConsoleError">#FF9E2626</Color>',
      '<Color x:Key="Color.Text.ConsoleSuccess">#FF1A7D54</Color>',
      '<Color x:Key="Color.Text.ConsoleMuted">#FF7A849C</Color>',
      '',
      '<!-- ACCENT — Light Mode -->',
      '<Color x:Key="Color.Accent.Primary">#FF1A6ED8</Color>',
      '<Color x:Key="Color.Accent.Hover">#FF2C7BE5</Color>',
      '<Color x:Key="Color.Accent.Pressed">#FF1558BB</Color>',
      '<Color x:Key="Color.Accent.Subtle">#1A1A6ED8</Color>',
      '<Color x:Key="Color.Accent.Glow">#401A6ED8</Color>',
      '',
      '<!-- STATUS — Light Mode -->',
      '<Color x:Key="Color.Status.Success">#FF1E9E6A</Color>',
      '<Color x:Key="Color.Status.Warning">#FFB07010</Color>',
      '<Color x:Key="Color.Status.Error">#FFCC3333</Color>',
      '<Color x:Key="Color.Status.Cancelled">#FF556070</Color>',
      '<Color x:Key="Color.Status.Skipped">#FF6A7280</Color>',
      '<Color x:Key="Color.Status.Inconclusive">#FF7C3AED</Color>',
    ]),

    heading2('3.3 Color Usage Rules — Absolute'),
    noticeBox('COLOR RULES — DO NOT VIOLATE', [
      '1. NEVER use a status color as a background fill at 100% opacity across a large area.',
      '2. ALWAYS pair status colors with their Subtle variant for backgrounds.',
      '3. NEVER use Color.Text.Muted for interactive labels — contrast failure.',
      '4. ALWAYS use Color.Text.OnAccent for text on filled accent surfaces.',
      '5. Console text uses its own palette — do NOT reuse standard text colors.',
      '6. Disabled state: Color.Text.Disabled + SkippedSubtle bg. Never reduce opacity of enabled state.',
      '7. Color.Text.Muted is informational only — never on interactive targets.',
    ], C.critBg, C.critBorder),
    pageBreak(),
  ];
}

function section04() {
  return [
    heading1('SECTION 04 — TYPOGRAPHY'),

    heading2('4.1 Font Families'),
    buildTable(['Role', 'Font', 'Fallback Chain'],
      [
        ['Primary UI', 'Segoe UI Variable', 'Segoe UI > Yu Gothic UI > Tahoma > sans-serif'],
        ['Console / Monospace', 'Cascadia Code', 'Cascadia Mono > Consolas > Courier New'],
        ['Arabic UI', 'Segoe UI Variable (includes Arabic glyphs)', 'Segoe UI (strong Arabic support)'],
      ], [2000, 2800, 4200]),

    heading2('4.2 Type Scale'),
    buildTable(
      ['Role', 'Key Name', 'Size', 'Weight', 'Line Height', 'Letter Spacing', 'Notes'],
      [
        ['App Title (splash)', 'Type.AppTitle', '32px', 'SemiBold (600)', '40px', '-0.5px', 'KNOUX Repair brand name'],
        ['Page Title', 'Type.PageTitle', '22px', 'SemiBold (600)', '28px', '-0.2px', 'Section main heading'],
        ['Section Heading', 'Type.SectionHeading', '16px', 'SemiBold (600)', '22px', '0', 'Category headings, panel headers'],
        ['Card Title', 'Type.CardTitle', '14px', 'Medium (500)', '20px', '0', 'Tool name on card (primary)'],
        ['Body', 'Type.Body', '13px', 'Regular (400)', '20px', '0', 'Descriptions, general text'],
        ['Body Small', 'Type.BodySmall', '12px', 'Regular (400)', '18px', '0', 'Supporting detail'],
        ['Caption', 'Type.Caption', '11px', 'Regular (400)', '16px', '+0.2px', 'Metadata, timestamps'],
        ['Label', 'Type.Label', '12px', 'Medium (500)', '16px', '+0.4px', 'Form labels, section labels'],
        ['Label Small', 'Type.LabelSmall', '11px', 'Medium (500)', '14px', '+0.5px', 'Status badges, tags'],
        ['ToolId', 'Type.ToolId', '11px', 'Regular (400)', '14px', '+0.3px', 'Technical ID — NEVER heading'],
        ['Console', 'Type.Console', '12px', 'Regular (400)', '18px', '0', 'Monospace, execution output'],
        ['Console Small', 'Type.ConsoleSmall', '11px', 'Regular (400)', '16px', '0', 'Timestamps in console'],
        ['Number Large', 'Type.NumberLarge', '28px', 'Light (300)', '32px', '-0.5px', 'Dashboard stats'],
        ['Navigation', 'Type.NavLabel', '13px', 'Medium (500)', '20px', '0', 'Sidebar nav labels'],
      ],
      [1600, 1800, 700, 1300, 1100, 1100, 1700]
    ),

    heading2('4.3 Permitted Font Weights Only'),
    buildTable(['Weight Value', 'Name', 'Usage'],
      [
        ['300', 'Light', 'Large dashboard numbers ONLY'],
        ['400', 'Regular', 'Body, descriptions, captions, ToolId'],
        ['500', 'Medium', 'Labels, navigation, card titles'],
        ['600', 'SemiBold', 'Headings, page titles, emphasis'],
      ], [1600, 2000, 5400]),
    noticeBox('WEIGHT RESTRICTION', [
      'Bold (700) and Black (900) are NOT used in KNOUX Repair.',
      'They are too heavy for a professional tool UI.',
      'Violating this creates visual noise inconsistent with the Glass Nexus tone.',
    ], C.warnBg, C.warnBorder),

    heading2('4.4 Text Rendering — WPF Settings'),
    codeBlock([
      '<!-- Set on root Window element — all children inherit -->',
      'TextOptions.TextFormattingMode="Ideal"       <!-- all body text -->',
      'TextOptions.TextRenderingMode="ClearType"    <!-- all body text -->',
      'RenderOptions.ClearTypeHint="Enabled"        <!-- root window -->',
      '',
      '<!-- Console output only: -->',
      'TextOptions.TextFormattingMode="Display"     <!-- crispness at small sizes -->',
    ]),

    heading2('4.5 Arabic Typography Rules'),
    bullet('Never split Arabic words with hyphens. Use TextWrapping="Wrap" and allow natural line breaks.'),
    bullet('Arabic numerals in tool metadata: keep Western (0–9) for ToolIds, counts, percentages.'),
    bullet('Mixed text (Arabic description + English term): WPF Unicode bidi algorithm handles automatically — do NOT override.'),
    bullet('Console output: always LTR (PowerShell output is English-based). Console block remains LTR in Arabic UI mode.'),
    bullet('Arabic body text may need +0.5–1px size increase vs Latin equivalent if legibility is insufficient.'),
    bullet('All text containers set FlowDirection="RightToLeft" when Arabic locale is active — set at Window level to propagate.'),
    pageBreak(),
  ];
}

function section05() {
  return [
    heading1('SECTION 05 — ICON SYSTEM'),

    heading2('5.1 Icon Family'),
    buildTable(['Option', 'Details', 'Status'],
      [
        ['Segoe Fluent Icons font', 'System-installed on Win11. FontFamily="Segoe Fluent Icons" + Unicode codepoints.', 'PREFERRED for navigation and common icons'],
        ['Fluent UI System Icons (XAML paths)', 'github.com/microsoft/fluentui-system-icons — SVG → XAML Geometry or DrawingImage', 'For custom/category icons not in Segoe Fluent set'],
      ], [2000, 5000, 2000]),

    noticeBox('ICON RULES — NEVER ACCEPTABLE', [
      'Emoji characters as icons — ever, even as fallback.',
      'Mixed icon packs (no FontAwesome, no Material Icons unless committed 100%).',
      'Bitmap/PNG icons at standard sizes (blur on high DPI).',
      'Mixing outline and filled styles without a state-based reason.',
    ], C.critBg, C.critBorder),

    heading2('5.2 Icon Sizes'),
    buildTable(['Context', 'Size', 'Notes'],
      [
        ['Navigation sidebar (with label)', '20×20px', ''],
        ['Navigation sidebar (collapsed)', '24×24px', ''],
        ['Tool card icon', '32×32px', 'Dominant visual in card'],
        ['Tool detail header icon', '48×48px', 'In tool detail panel header'],
        ['Action icons (in buttons)', '16×16px', 'Inline with text labels'],
        ['Status icons', '16×16px', 'In badges and status bars'],
        ['Status icons (large, result)', '32×32px', 'In execution result headers'],
        ['Toolbar icons', '18×18px', 'Top bar action buttons'],
        ['Small inline icons', '14×14px', 'In captions, metadata rows'],
        ['Toast icons', '20×20px', ''],
        ['Splash logo icon', '56×56px', 'Application logo mark'],
        ['Sidebar collapsed logo', '28×28px', ''],
        ['Header inline logo', '24×24px', ''],
      ], [3200, 1400, 4400]),

    heading2('5.3 Icon States'),
    buildTable(['State', 'Style', 'Color'],
      [
        ['Default', 'Outline/Regular', 'Color.Text.Secondary'],
        ['Hover', 'Outline/Regular', 'Color.Text.Primary'],
        ['Active/Selected', 'Filled variant', 'Color.Accent.Primary'],
        ['Disabled', 'Outline/Regular', 'Color.Text.Disabled — no hover effect'],
        ['Running', 'Outline/Regular', 'Color.Accent.Primary — spinner adjacent (not on icon)'],
      ], [2000, 2500, 4500]),

    heading2('5.4 Category Icon Mapping'),
    para('Icon mapping is defined by semantic purpose for each real category. Verify codepoints against Segoe Fluent Icons on developer\'s machine using charmap.exe or Fluent Icons Explorer.'),
    buildTable(
      ['#', 'Category Slug (exact)', 'English Label', 'Arabic Label', 'Fluent Icon Semantic', 'Segoe Codepoint (verify)'],
      [
        ['01', '01-System-Maintenance', 'System Maintenance', 'صيانة النظام', 'Wrench / System', 'U+E90F (verify)'],
        ['02', '02-System-Cleanup', 'System Cleanup', 'تنظيف النظام', 'Broom / Clean', 'U+E74D (verify)'],
        ['03', '03-Network-Internet', 'Network & Internet', 'الشبكة والإنترنت', 'Globe / Network', 'U+E909 (verify)'],
        ['04', '04-Programs-Applications', 'Programs & Applications', 'البرامج والتطبيقات', 'AppList / Apps', 'U+E71D (verify)'],
        ['05', '05-Duplicate-Files', 'Duplicate Files', 'الملفات المكررة', 'DocumentCopy / Duplicate', 'U+E8C8 (verify)'],
        ['06', '06-Disk-Space', 'Disk Space', 'مساحة القرص', 'HardDrive / Storage', 'U+EDA2 (verify)'],
        ['07', '07-Services-Processes', 'Services & Processes', 'الخدمات والعمليات', 'Processing / Service', 'U+E9F5 (verify)'],
        ['08', '08-Performance', 'Performance', 'الأداء', 'Gauge / Speed', 'U+E9F9 (verify)'],
        ['09', '09-Security', 'Security', 'الأمان', 'Shield', 'U+E9F5 (verify)'],
        ['10', '10-Diagnostics-Reports', 'Diagnostics & Reports', 'التشخيص والتقارير', 'Stethoscope / Report', 'U+F246 (verify)'],
      ],
      [400, 2000, 1600, 1600, 1800, 1600]
    ),
    noticeBox('ICON CODEPOINT VERIFICATION REQUIRED', [
      'All codepoints marked "(verify)" must be confirmed by the developer against the',
      'actual installed Segoe Fluent Icons glyph map before implementation.',
      'Use charmap.exe or the Microsoft Fluent Icons Explorer tool.',
      'The semantic purpose is authoritative; the codepoint is advisory.',
    ], C.warnBg, C.warnBorder),

    heading2('5.5 RTL Icon Behavior'),
    buildTable(['Icon Type', 'RTL Behavior', 'Implementation'],
      [
        ['Arrow pointing right/left', 'MUST mirror horizontally', 'ScaleTransform ScaleX="-1" bound to FlowDirection'],
        ['Back / Forward navigation arrows', 'MUST mirror horizontally', 'Same as above'],
        ['Chevrons (next step)', 'MUST mirror horizontally', 'Same as above'],
        ['List-direction indicators', 'MUST mirror horizontally', 'Same as above'],
        ['Wrench / tools', 'Must NOT mirror', 'Static — culturally neutral'],
        ['Shield / security', 'Must NOT mirror', 'Static — culturally neutral'],
        ['Hard drive / disk', 'Must NOT mirror', 'Static — culturally neutral'],
        ['Clock / time', 'Must NOT mirror', 'Static — reading direction irrelevant'],
        ['Logo mark', 'Must NOT mirror', 'Brand identity — fixed'],
      ], [2500, 2200, 4300]),

    heading2('5.6 Application Logo Mark'),
    para('The logo mark must be a custom XAML path/geometry — NOT a bitmap.'),
    bullet('Shape: Stylized geometric form with "repair" or "nexus" motif'),
    bullet('Suggested: abstract geometric mark — two overlapping rings or a stylized "K" within a hexagon'),
    bullet('Colors: Color.Accent.Primary (#2C7BE5) fill with Color.Text.Primary accent stroke'),
    bullet('Must render cleanly at all sizes: 56×56 (splash), 28×28 (sidebar collapsed), 24×24 (header inline)'),
    bullet('If a logo already exists in project assets: PRESERVE IT — this describes the target state if it does not exist'),
    bullet('Must NOT use bitmap/PNG — artifacts at high DPI'),
    bullet('Must scale without quality loss — vector only'),
    pageBreak(),
  ];
}

function section06() {
  return [
    heading1('SECTION 06 — SPLASH SCREEN'),

    heading2('6.1 Purpose and Character'),
    para('The splash screen is the user\'s first visual contact with KNOUX Repair. It must communicate trust (serious, professional application), performance (initializing quickly), and identity (KNOUX Repair is a premium tool).'),
    noticeBox('SPLASH SCREEN RULES', [
      'Must NOT fake a loading process.',
      'Must NOT show a frozen UI.',
      'Must NOT use excessive animation.',
      'Must NOT exceed 3.5 seconds before handing off to main shell (initialization permitting).',
      'There is NO Thread.Sleep() for dramatic effect.',
      'The splash runs as long as initialization takes, plus the minimum animation frames.',
    ], C.critBg, C.critBorder),

    heading2('6.2 Window Specification'),
    buildTable(['Property', 'Value'],
      [
        ['WindowStyle', 'None'],
        ['AllowsTransparency', 'True'],
        ['Background', 'Transparent'],
        ['Width', '480px'],
        ['Height', '320px'],
        ['WindowStartupLocation', 'CenterScreen'],
        ['ResizeMode', 'NoResize'],
        ['Corner radius of inner container', '16px'],
        ['Inner container background', 'Color.Background.Elevated (#1A1D27 dark)'],
        ['Shadow', '0 8px 40px rgba(0,0,0,0.70) drop shadow'],
        ['Topmost', 'True during splash only — reset to False on main window open'],
      ], [3000, 6000]),

    heading2('6.3 Splash Visual Layout — LTR (English)'),
    codeBlock([
      '┌──────────────────────────────────────────────┐  ← 480px wide',
      '│                                              │  ← 16px corner radius, dark bg',
      '│                                              │',
      '│          [Logo Mark 56×56]                   │  ← centered horizontally',
      '│                                              │  ← 16px gap below logo',
      '│          KNOUX Repair                        │  ← Type.AppTitle, Color.Text.Primary',
      '│          Professional Windows Diagnostics    │  ← Type.BodySmall, Color.Text.Secondary',
      '│                                              │',
      '│          v2.0.2                              │  ← Type.Caption, Color.Text.Muted',
      '│                                              │',
      '│  ────────────────────────────────────────    │  ← 1px separator, Color.Border.Subtle',
      '│                                              │',
      '│  [=======                           ]        │  ← Progress bar, 4px height, indeterminate',
      '│                                              │',
      '│  Initializing bridge...                      │  ← Type.Caption, Text.Muted, dynamic',
      '│                                              │  ← 32px bottom safe area',
      '└──────────────────────────────────────────────┘',
    ]),

    heading2('6.4 Splash Visual Layout — RTL (Arabic)'),
    codeBlock([
      '┌──────────────────────────────────────────────┐',
      '│          [Logo Mark 56×56]                   │  ← centered (unchanged)',
      '│          إصلاح نوكس                          │  ← right-aligned',
      '│          أداة تشخيص وصيانة ويندوز           │  ← right-aligned',
      '│          v2.0.2                              │  ← version: always LTR',
      '│  ────────────────────────────────────────    │',
      '│  [                           =======]        │  ← progress fills from RIGHT in RTL',
      '│                 ...جاري تهيئة الجسر          │  ← right-aligned',
      '└──────────────────────────────────────────────┘',
    ]),

    heading2('6.5 Splash Layout Measurements'),
    buildTable(['Element', 'Position', 'Size / Height', 'Notes'],
      [
        ['Logo mark', '52px from inner top, centered horizontally', '56×56px', ''],
        ['App name', 'Below logo, 16px gap', 'Type.AppTitle (32px)', 'Centered horizontally'],
        ['Subtitle', 'Below app name, 6px gap', 'Type.BodySmall (12px)', 'Centered horizontally'],
        ['Version', 'Below subtitle, 4px gap', 'Type.Caption (11px)', 'Centered horizontally — always LTR'],
        ['Separator', 'Below version, 20px gap', '1px height, 80% container width', 'Centered'],
        ['Progress bar', 'Below separator, 16px gap', '4px height, 80% container width', ''],
        ['Status text', 'Below progress bar, 8px gap', 'Type.Caption', 'Centered'],
        ['Bottom safe area', 'Below status text', '32px', ''],
      ], [2000, 2400, 2000, 2600]),

    heading2('6.6 Splash Animation Timeline'),
    buildTable(['Time', 'Event'],
      [
        ['T+0ms', 'Window appears with opacity 0'],
        ['T+0 → 150ms', 'Window fades in (opacity 0→1), easing: CubicEaseOut'],
        ['T+150ms', 'Background material resolves'],
        ['T+150 → 300ms', 'Logo mark reveals: scale 0.85→1.0, opacity 0→1, CubicEaseOut'],
        ['T+300 → 450ms', 'App name fades in, opacity 0→1'],
        ['T+350 → 500ms', 'Subtitle and version fade in with 50ms stagger'],
        ['T+500ms', 'Progress bar appears, begins indeterminate animation'],
        ['T+500ms', 'REAL initialization begins (see Section 09)'],
        ['T+500ms+', 'Status message updates in real-time as initialization progresses'],
        ['T+real_init', 'When init completes: progress bar completes or stops'],
        ['T+complete', '200ms pause at completed state'],
        ['T+pause+100ms', 'Splash fades out: opacity 1→0 over 200ms'],
        ['T+pause+300ms', 'Main shell fades in: opacity 0→1 over 300ms'],
      ], [2000, 7000]),

    heading2('6.7 Progress Bar Specification'),
    bullet('Indeterminate mode: WPF ProgressBar IsIndeterminate="True" during initialization'),
    bullet('Track: 4px height, Color.Border.Default, corner radius 3px'),
    bullet('Fill: Color.Accent.Primary, animated shimmer via LinearGradientBrush sliding animation'),
    bullet('Determinate mode: if real initialization emits discrete steps, bind Value to real step count'),
    noticeBox('NEVER SHOW FAKE PERCENTAGE', [
      'Never show a percentage like "Loading... 67%" if that 67% is fabricated.',
      'If progress cannot be measured: use indeterminate mode.',
      'If progress can be measured: use real step-count bound to ProgressBar.Value.',
    ], C.critBg, C.critBorder),

    heading2('6.8 Localized Status Messages'),
    buildTable(['Phase', 'English (Strings.en.xaml)', 'Arabic (Strings.ar.xaml)'],
      [
        ['Starting', '"Starting up..."', '"جاري البدء..."'],
        ['Config', '"Loading configuration..."', '"تحميل الإعدادات..."'],
        ['Manifest', '"Checking tool manifest..."', '"التحقق من قائمة الأدوات..."'],
        ['Bridge', '"Connecting to execution bridge..."', '"الاتصال بجسر التنفيذ..."'],
        ['Catalog', '"Loading tool catalog..."', '"تحميل كتالوج الأدوات..."'],
        ['Ready', '"Ready"', '"جاهز"'],
      ], [1800, 3600, 3600]),

    heading2('6.9 Error State During Splash'),
    bullet('1. Progress bar stops (becomes static, no longer animated)'),
    bullet('2. Status message changes to error text in Color.Status.Error'),
    bullet('3. "Exit" button appears below status after 500ms delay'),
    bullet('4. "Retry" button appears beside "Exit" if error is recoverable'),
    bullet('5. Application does NOT silently continue'),
    bullet('6. Application does NOT hide the error'),
    buildTable(['Error Type', 'Retryable', 'Message Tone'],
      [
        ['Bridge unavailable', 'Yes — Retry button shown', 'Warning (Color.Status.Warning)'],
        ['Corrupt manifest', 'No — Exit only', 'Error (Color.Status.Error)'],
        ['Missing manifest', 'Yes (retry file locate)', 'Error (Color.Status.Error)'],
        ['Config unreadable', 'Yes', 'Warning'],
      ], [3000, 2000, 4000]),
    pageBreak(),
  ];
}

function section07() {
  return [
    heading1('SECTION 07 — MAIN WINDOW'),

    heading2('7.1 Window Specification'),
    buildTable(['Property', 'Value'],
      [
        ['WindowStyle', 'SingleBorderWindow or None (custom chrome — see existing implementation)'],
        ['Minimum width', '960px'],
        ['Minimum height', '600px'],
        ['Default width', '1280px'],
        ['Default height', '800px'],
        ['WindowStartupLocation', 'CenterScreen'],
        ['ResizeMode', 'CanResize'],
        ['Corner radius', '10px if custom chrome, 0 if system chrome'],
      ], [3000, 6000]),
    noticeBox('DEVELOPER: INSPECT EXISTING CHROME FIRST', [
      'Before implementing window chrome, inspect the actual MainWindow.xaml and App.xaml.cs.',
      'If custom WindowChrome is already implemented: preserve it and adapt visual tokens.',
      'If system chrome is used: do NOT rebuild from scratch — apply visual tokens to existing structure.',
      'Recommendation: Use WindowChrome API (not WindowStyle=None + manual dragging).',
      'WindowChrome preserves: snap layout, resize, system menu, and accessibility.',
    ], C.warnBg, C.warnBorder),

    heading2('7.2 Main Window Layout Structure'),
    codeBlock([
      '┌─────────────────────────────────────────────────────────────────────┐',
      '│  [Title bar — system chrome or custom WindowChrome]                 │  32px',
      '├─────────┬───────────────────────────────────────────────────────────┤',
      '│         │  [Page Header — title + breadcrumb + page actions]         │  52px',
      '│         │─────────────────────────────────────────────────────────── │',
      '│ SIDEBAR │  [Content Area — scrollable, page-dependent]               │',
      '│         │                                                            │',
      '│  220px  │                                                            │',
      '│         │─────────────────────────────────────────────────────────── │',
      '│         │  [Status Bar — bridge status + system info + version]      │  28px',
      '└─────────┴───────────────────────────────────────────────────────────┘',
    ]),

    heading2('7.3 Responsive Breakpoints'),
    buildTable(['Resolution', 'Behavior'],
      [
        ['960×600 (minimum)', 'Sidebar full width. Content scrolls. No collapse.'],
        ['1280×720 (standard)', 'Sidebar 220px. All elements fit without scroll.'],
        ['1366×768', 'Standard layout. Slightly more content rows visible.'],
        ['1920×1080', 'Full layout. Tool grid expands (auto-column). Max content width 1400px.'],
        ['2560×1440', 'Max content width 1400px centered in content area. No infinite expansion.'],
      ], [2200, 6800]),

    heading2('7.4 Maximum Content Width'),
    para('Content must not stretch edge-to-edge on ultra-wide monitors.'),
    codeBlock(['MaxWidth="1400" on main content ScrollViewer or content panel.',
      'Center it within the content area using HorizontalAlignment="Center".']),

    heading2('7.5 DPI Scaling Requirements'),
    buildTable(['DPI', 'Scale', 'Required Action'],
      [
        ['96 DPI', '100%', 'Default. No special handling.'],
        ['120 DPI', '125%', 'Test text does not clip in sidebar. Icons render crisply (vector only).'],
        ['144 DPI', '150%', 'Test modal dialogs remain fully visible.'],
        ['192 DPI', '200%', 'Test all elements — icon sizes, 1px borders (min 1px physical).'],
      ], [1200, 800, 7000]),
    codeBlock([
      '<!-- Set at Window level -->',
      'TextOptions.TextRenderingMode="ClearType"',
      '',
      '<!-- All icons must be vector (Path/DrawingImage) — NOT PNG -->',
      '<!-- If PNG icons exist: provide at 1x, 1.5x, 2x and select via DpiScale converter -->',
    ]),

    heading2('7.6 Title Bar (Custom Chrome Mode)'),
    buildTable(['Element', 'Specification'],
      [
        ['Height', '32px'],
        ['Background', 'Color.Background.Shell (same as sidebar top area)'],
        ['App name in title bar', 'NOT shown in title bar — shown in sidebar'],
        ['Window title (OS level)', '"KNOUX Repair — [Current Page Name]"'],
        ['Min/Max/Close buttons', 'System buttons via WindowChrome.IsHitTestVisibleInChrome'],
        ['Drag region', 'Full title bar minus button area'],
        ['Version in title bar', 'NOT shown — shown in status bar'],
      ], [3000, 6000]),

    heading2('7.7 Status Bar'),
    buildTable(['Element', 'Content', 'Style', 'Position'],
      [
        ['Height', '28px', 'Color.Background.Shell', 'Bottom of window'],
        ['Bridge status indicator', 'Dot + "Bridge Online/Offline"', 'Type.Caption, status color', 'Left (right in RTL)'],
        ['Separator', '1px Color.Border.Subtle', '—', 'Between elements'],
        ['System info (optional)', 'OS version or session info', 'Type.Caption, Text.Muted', 'Center'],
        ['Application version', '"v2.0.2"', 'Type.Caption, Text.Muted', 'Right (left in RTL)'],
      ], [1600, 2500, 2000, 2900]),
    pageBreak(),
  ];
}

function section08() {
  return [
    heading1('SECTION 08 — SIDEBAR'),

    heading2('8.1 Sidebar Specification'),
    buildTable(['Property', 'Value'],
      [
        ['Width', '220px'],
        ['Collapsed width', 'Not supported in v2.0.2 — sidebar is always expanded'],
        ['Background', 'Color.Background.Elevated (#1A1D27 dark / #FFFFFF light)'],
        ['Right border (LTR)', '1px Color.Border.Subtle'],
        ['Left border (RTL)', '1px Color.Border.Subtle'],
        ['RTL position', 'Right side of window in Arabic mode'],
      ], [3000, 6000]),

    heading2('8.2 Sidebar Anatomy'),
    codeBlock([
      '┌───────────────────────┐  ← 220px wide',
      '│  [Logo 24×24] KNOUX   │  ← Logo area, 64px tall, centered vertically',
      '│                        │  ← 1px separator line',
      '│  [icon] Overview       │  ← Nav item (Segoe Fluent icon, 20×20)',
      '│  [icon] All Tools      │  ← Nav item',
      '│                        │',
      '│  CATEGORIES            │  ← Section label, Type.LabelSmall, Text.Muted',
      '│  [icon] System Maint.  │  ← Nav item (01-System-Maintenance)',
      '│  [icon] System Cleanup │  ← Nav item (02-System-Cleanup)',
      '│  [icon] Network        │  ← Nav item (03-Network-Internet)',
      '│  [icon] Programs       │  ← Nav item (04-Programs-Applications)',
      '│  [icon] Duplicate Files│  ← Nav item (05-Duplicate-Files)',
      '│  [icon] Disk Space     │  ← Nav item (06-Disk-Space)',
      '│  [icon] Services       │  ← Nav item (07-Services-Processes)',
      '│  [icon] Performance    │  ← Nav item (08-Performance)',
      '│  [icon] Security       │  ← Nav item (09-Security)',
      '│  [icon] Diagnostics    │  ← Nav item (10-Diagnostics-Reports)',
      '│                        │',
      '│  ─────────────────     │  ← separator',
      '│  [icon] Settings       │  ← Bottom nav item',
      '└───────────────────────┘',
    ]),

    heading2('8.3 Navigation Item States'),
    buildTable(['State', 'Background', 'Icon', 'Label', 'Border', 'Transition'],
      [
        ['Default', 'Transparent', 'Color.Text.Secondary, 20×20', 'Type.NavLabel, Text.Secondary', 'None', '—'],
        ['Hover', 'Color.Interactive.HoverOverlay', 'Color.Text.Primary', 'Color.Text.Primary', 'None', '120ms ease background'],
        ['Active / Selected', 'Color.Interactive.SelectedBackground', 'Color.Accent.Primary (Filled)', 'Color.Accent.Primary, Medium weight', '3px Accent.Primary — left edge (right in RTL)', '—'],
        ['Focused (keyboard)', 'Same as hover', 'Same as hover', 'Same as hover', '2px Color.Border.Focus offset 1px', '—'],
        ['Disabled', 'Transparent', 'Color.Text.Disabled', 'Color.Text.Disabled', 'None', 'No hover response'],
      ], [1200, 2000, 1800, 2200, 2000, 1800]),

    heading2('8.4 Navigation Item Measurements'),
    buildTable(['Property', 'Value'],
      [
        ['Height', '40px'],
        ['Padding (LTR)', '8px top/bottom, 16px right, 12px left'],
        ['Padding (RTL)', 'Mirrored: 8px top/bottom, 12px right, 16px left'],
        ['Icon-to-label gap', '8px'],
        ['Corner radius', '6px (applied to item, with 4px margin from sidebar edges)'],
        ['Active indicator width', '3px (left edge LTR, right edge RTL)'],
        ['Active indicator color', 'Color.Accent.Primary'],
      ], [3000, 6000]),

    heading2('8.5 Logo Area'),
    buildTable(['Property', 'Value'],
      [
        ['Total height', '64px'],
        ['Logo mark size', '24×24px'],
        ['App name style', '14px SemiBold, Color.Text.Primary'],
        ['Logo-to-text gap', '8px'],
        ['Bottom separator', '1px Color.Border.Subtle'],
        ['RTL layout', 'Logo on right, text on left — mirrors horizontally'],
      ], [3000, 6000]),

    heading2('8.6 Section Labels'),
    buildTable(['Property', 'Value'],
      [
        ['Text (EN)', '"CATEGORIES" (uppercase — store as uppercase string, not CSS transform)'],
        ['Text (AR)', '"الفئات"'],
        ['Style', 'Type.LabelSmall, Color.Text.Muted'],
        ['Padding', '12px top, 16px right, 4px bottom, 12px left'],
        ['Interactive', 'No — not clickable'],
      ], [3000, 6000]),

    heading2('8.7 Bridge Status Indicator (Sidebar)'),
    buildTable(['State', 'Visual', 'Color'],
      [
        ['Bridge Online', '8px filled dot + "Bridge Online"', 'Color.Status.Success'],
        ['Bridge Offline', '8px hollow dot + "Bridge Offline"', 'Color.Status.Error or Muted'],
        ['Bridge Unknown', '8px dot (grey) + "Bridge Status Unknown"', 'Color.Text.Muted'],
      ], [2000, 3500, 3500]),

    heading2('8.8 Sidebar in RTL (Arabic Mode)'),
    para('WPF FlowDirection="RightToLeft" at Window level handles most mirroring. Developer must verify:'),
    bullet('Sidebar moves to right side of window'),
    bullet('Icon is on right, label on left of nav item'),
    bullet('Active indicator is on RIGHT edge instead of left'),
    bullet('Section labels right-align'),
    bullet('Logo on right, name text on left'),
    bullet('Directional icons apply ScaleTransform ScaleX="-1" (see Section 05.5)'),
    pageBreak(),
  ];
}

function section09() {
  return [
    heading1('SECTION 09 — STARTUP FLOW'),

    heading2('9.1 Startup Sequence'),
    noticeBox('DEVELOPER INSTRUCTION', [
      'Map these startup stages to the ACTUAL App.xaml.cs / startup implementation.',
      'Do NOT invent services or interfaces not present in the codebase.',
      'Inspect existing App.xaml, App.xaml.cs, ThemeService.cs, and SettingsService',
      'before implementing any startup stage.',
      'Preserve working contracts. Change visual architecture without rewriting execution architecture.',
    ], C.warnBg, C.warnBorder),
    ...spacer(1),
    buildTable(['Step', 'Action', 'Status Message', 'Fatal if fails'],
      [
        ['1', 'App.xaml.cs OnStartup() — Load app resources (Colors.xaml, theme resources)', 'None (pre-splash)', 'Yes'],
        ['2', 'Apply initial theme (saved setting > system > default Dark)', 'None (pre-splash)', 'No — default Dark'],
        ['3', 'Apply initial language (saved > system culture > default EN)', 'None (pre-splash)', 'No — default EN'],
        ['4', 'Construct and show SplashWindow', 'Splash appears', 'No'],
        ['5', 'Begin splash animation sequence', '—', 'No'],
        ['6', 'Initialize ThemeService (via existing service class)', '"Loading configuration..."', 'No'],
        ['7', 'Initialize LocalizationService / load Strings.xaml', '"Loading configuration..."', 'No'],
        ['8', 'Load ToolManifest from Docs/TOOLS-MANIFEST.json', '"Checking tool manifest..."', 'YES — fatal'],
        ['9', 'Verify manifest: 100 tools, 10 categories, field schema', '"Checking tool manifest..."', 'YES — fatal'],
        ['10', 'Check bridge availability (actual existing bridge mechanism)', '"Connecting to execution bridge..."', 'No — limited mode'],
        ['11', 'Load tool catalog into in-memory store', '"Loading tool catalog..."', 'YES — fatal'],
        ['12', 'Initialization complete', '"Ready"', 'N/A'],
        ['13', '200ms pause at completed state', '—', 'N/A'],
        ['14', 'Begin transition: splash fade out, main shell fade in', '—', 'N/A'],
      ], [400, 3200, 2200, 1200]),

    heading2('9.2 Theme Loading Priority'),
    codeBlock([
      'Priority 1: User-saved preference in settings file',
      'Priority 2: System AppsUseLightTheme registry value',
      'Priority 3: Default — Dark mode',
      '',
      'CRITICAL: Theme must be applied BEFORE splash window is shown.',
      'Prevents visual flash on startup.',
    ]),

    heading2('9.3 Language Loading Priority'),
    codeBlock([
      'Priority 1: User-saved preference in settings file',
      'Priority 2: System.Globalization.CultureInfo.CurrentUICulture — if Arabic, apply Arabic',
      'Priority 3: Default — English',
      '',
      'Apply FlowDirection to root Window element.',
      'This propagates to all child elements automatically via WPF inheritance.',
    ]),

    heading2('9.4 Bridge Unavailable Behavior'),
    bullet('Application CONTINUES to main shell — not a fatal error'),
    bullet('Splash shows: "Bridge unavailable — continuing in limited mode" (warning color)'),
    bullet('Main shell shows persistent bridge-offline banner (see Section 17)'),
    bullet('All tool execution buttons: DISABLED (not hidden — disabled with explanation tooltip)'),
    bullet('Navigation and browsing: fully functional in offline mode'),
    bullet('BridgeState = Offline is a first-class application state, not an error condition'),

    heading2('9.5 Manifest Unavailable Behavior (Fatal)'),
    bullet('This IS a fatal error — application cannot function without the manifest'),
    bullet('Splash enters error state (Section 06.9)'),
    bullet('Retry button: retries manifest load from expected path'),
    bullet('Exit button: closes application cleanly'),
    bullet('Application does NOT continue past this failure'),
    pageBreak(),
  ];
}

function section10() {
  return [
    heading1('SECTION 10 — DASHBOARD (OVERVIEW)'),

    heading2('10.1 Dashboard Purpose'),
    para('The Dashboard is the first page shown after the splash transition. Its responsibilities:'),
    bullet('Show system and bridge readiness at a glance'),
    bullet('Orient the user to available tool categories'),
    bullet('Provide quick access to recently used tools'),
    bullet('Surface any warnings or issues requiring attention'),

    heading2('10.2 Data Sources — Real Only'),
    noticeBox('NO FABRICATED DASHBOARD DATA', [
      'Every dashboard metric must have a real, accessible data source.',
      'If a data source is unavailable: show the widget in "unavailable" / empty state.',
      'Never show fabricated system stats, fake CPU/RAM percentages, or invented tool counts.',
      '',
      'Available real data:',
      '  Bridge status: real — from bridge check in startup',
      '  Tool count: real — 100 tools, 10 categories (from loaded manifest)',
      '  Last run results: real — if persisted in settings/log file',
      '  System information: real — via Environment class or WMI',
      '  Category tool counts: real — derived from loaded manifest',
    ], C.warnBg, C.warnBorder),

    heading2('10.3 Dashboard Layout'),
    codeBlock([
      '┌─────────────────────────────────────────────────────────────┐',
      '│  Overview                                        [52px hdr] │',
      '├───────────────────┬──────────────────┬──────────────────────┤',
      '│  SYSTEM STATUS    │  BRIDGE STATUS   │  QUICK STATS         │',
      '│  ─────────────    │  ─────────────   │  ─────────────       │',
      '│  [real OS info]   │  [real bridge]   │  100 Tools Available │',
      '│  [real build]     │  [real version]  │  10 Categories       │',
      '│                   │                  │  Last run: [real ts] │',
      '├───────────────────┴──────────────────┴──────────────────────┤',
      '│  CATEGORIES                          [Section heading 16px] │',
      '│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │',
      '│  │[icon]│ │[icon]│ │[icon]│ │[icon]│ │[icon]│             │',
      '│  │Maint │ │Clean │ │ Net  │ │Progs │ │ Dupe │             │',
      '│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │',
      '│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │',
      '│  │[icon]│ │[icon]│ │[icon]│ │[icon]│ │[icon]│             │',
      '│  │ Disk │ │ Svc  │ │ Perf │ │ Sec  │ │ Diag │             │',
      '│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │',
      '│                                                             │',
      '│  RECENT ACTIVITY                                            │',
      '│  ┌──────────────────────────────────────────────────────┐  │',
      '│  │ [icon] Tool Name    [real timestamp]  [status badge] │  │',
      '│  │ [icon] Tool Name    [real timestamp]  [status badge] │  │',
      '│  └──────────────────────────────────────────────────────┘  │',
      '└─────────────────────────────────────────────────────────────┘',
    ]),

    heading2('10.4 Dashboard Card Specification'),
    buildTable(['Property', 'Value'],
      [
        ['Background', 'Color.Background.Elevated'],
        ['Border', '1px Color.Border.Default'],
        ['Glass top accent', '1px Color.Border.GlassTop at top edge only'],
        ['Corner radius', '8px'],
        ['Padding', '20px'],
        ['Card title style', 'Type.SectionHeading, Color.Text.Secondary'],
        ['Card content style', 'Type.Body, Color.Text.Primary'],
        ['Card meta style', 'Type.Caption, Color.Text.Muted'],
        ['Empty state', '"—" for unavailable data. No fake values.'],
      ], [3000, 6000]),

    heading2('10.5 Category Chip Specification'),
    buildTable(['Property', 'Value'],
      [
        ['Minimum size', '100×80px — auto-layout in WrapPanel'],
        ['Background', 'Color.Background.Elevated'],
        ['Hover overlay', 'Color.Interactive.HoverOverlay'],
        ['Icon', '32×32px, category icon color'],
        ['Label', 'Type.BodySmall, Color.Text.Primary, centered below icon'],
        ['Interaction', 'Click navigates to that category view'],
        ['Corner radius', '8px'],
        ['Empty category', 'Show chip in muted state — never hide a category that has tools in manifest'],
      ], [3000, 6000]),

    heading2('10.6 Recent Activity Row Specification'),
    buildTable(['Element', 'Specification'],
      [
        ['Row height', '44px'],
        ['Tool icon', '16×16px, Color.Text.Muted'],
        ['Tool name', 'Type.Body, Color.Text.Primary'],
        ['Timestamp', 'Type.Caption, Color.Text.Muted — real timestamp from execution log'],
        ['Status badge', 'Compact status indicator (see Section 15)'],
        ['Separator', '1px Color.Border.Subtle between rows'],
        ['Empty state', '"No recent activity" — Type.Body, Color.Text.Muted, centered'],
        ['Data source', 'Real execution history log — if no log: empty state. Never fabricated.'],
      ], [3000, 6000]),
    pageBreak(),
  ];
}

function section11() {
  return [
    heading1('SECTION 11 — ALL TOOLS PAGE'),

    heading2('11.1 Page Purpose'),
    para('Displays all tools across 10 categories in a searchable, filterable, navigable view. User can browse by category, search by name, filter by risk level and admin requirement, view in grid or list mode, and select a tool to view its detail.'),

    heading2('11.2 Page Header'),
    codeBlock([
      '┌───────────────────────────────────────────────────────────────┐',
      '│  All Tools                         [Search...]  [List] [Grid] │  ← 52px header',
      '│  [count from manifest] tools across 10 categories             │',
      '└───────────────────────────────────────────────────────────────┘',
    ]),
    buildTable(['Element', 'Specification'],
      [
        ['Page title', 'Type.PageTitle — "All Tools"'],
        ['Subtitle', '"[N] tools across 10 categories" — N from loaded manifest. Type.BodySmall, Text.Muted.'],
        ['Search field', '240px wide, right-aligned LTR / left-aligned RTL'],
        ['View toggle', 'List / Grid toggle buttons, 18×18px icons, right of search (left in RTL)'],
      ], [2500, 6500]),

    heading2('11.3 Category Filter Bar'),
    para('Horizontal scrollable chip row beneath the header:'),
    codeBlock([
      '[All ([N])] [01-System-Maintenance ([n])] [02-System-Cleanup ([n])] ...',
      '',
      'N = total tool count from manifest. n = per-category count from manifest.',
      'DO NOT hardcode counts. Bind to manifest data.',
    ]),
    buildTable(['Property', 'Value'],
      [
        ['Chip height', '32px'],
        ['Chip padding', '10px top/bottom, 14px left/right'],
        ['Inactive chip style', 'Ghost border — Color.Border.Default background transparent'],
        ['Active chip style', 'Filled accent — Color.Accent.Primary background, Text.OnAccent'],
        ['Overflow', 'Horizontal scroll with fade gradient at far edge'],
        ['RTL', 'Scroll direction reverses, chips read right to left'],
        ['Category labels', 'Use English labels LTR, Arabic labels RTL — from manifest'],
      ], [3000, 6000]),

    heading2('11.4 Tool Grid (Default View)'),
    codeBlock([
      '┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐',
      '│  [icon]  │ │  [icon]  │ │  [icon]  │ │  [icon]  │',
      '│ ToolName │ │ ToolName │ │ ToolName │ │ ToolName │',
      '│  Desc.   │ │  Desc.   │ │  Desc.   │ │  Desc.   │',
      '│[Risk][Adm│ │[Risk][Adm│ │[Risk][Adm│ │[Risk][Adm│',
      '│     TL-01│ │     TL-02│ │     TL-03│ │     TL-04│',
      '└──────────┘ └──────────┘ └──────────┘ └──────────┘',
    ]),
    buildTable(['Property', 'Value'],
      [
        ['Column sizing', 'auto-fill with min-width 220px, max-width 280px'],
        ['Column gap', '12px'],
        ['Row gap', '12px'],
        ['Container padding', '20px'],
        ['WPF control', 'ItemsControl with WrapPanel or UniformGrid'],
        ['At 1280px', 'Typically 4 columns'],
        ['At 1920px', '5–6 columns'],
        ['At 960px (minimum)', '3 columns'],
      ], [3000, 6000]),

    heading2('11.5 Tool List View'),
    codeBlock([
      '┌──────────────────────────────────────────────────────────────┐',
      '│ [icon] Tool Name         Description (1 line)   [Risk] [>]  │  56px row',
      '├──────────────────────────────────────────────────────────────┤',
      '│ [icon] Tool Name         Description (1 line)   [Risk] [>]  │',
      '└──────────────────────────────────────────────────────────────┘',
    ]),
    buildTable(['Element', 'Specification'],
      [
        ['Row height', '56px'],
        ['Tool icon', '24×24px, left-aligned (right in RTL)'],
        ['Tool name', 'Type.Body, Medium weight, Color.Text.Primary'],
        ['Description', 'Type.BodySmall, Color.Text.Secondary, truncated 1 line with ellipsis'],
        ['Risk badge', 'Right-aligned LTR / left-aligned RTL'],
        ['Execute chevron', '16×16px, rightmost LTR / leftmost RTL, appears on hover'],
      ], [2500, 6500]),

    heading2('11.6 Search Behavior'),
    bullet('Real-time — debounced 200ms after last keystroke'),
    bullet('Search fields: EnglishName, ArabicName, Purpose, ToolId — all from manifest'),
    bullet('No results state: "No tools match \'[query]\'" with clear button'),
    bullet('Search is not delayed by tool execution or bridge state'),
    bullet('Match highlighting: optional enhancement — not required for v2.0.2'),

    heading2('11.7 Filter Options'),
    buildTable(['Filter', 'Source', 'Options'],
      [
        ['Category', 'Manifest Category field', '10 real category slugs + "All"'],
        ['RiskLevel', 'Manifest RiskLevel field', 'READ_ONLY, SAFE_CLEANUP, DESTRUCTIVE — customer labels'],
        ['RequiresAdmin', 'Manifest RequiresAdmin field', 'All / Requires Admin / No Admin Required'],
        ['OfflineCapability', 'Manifest OfflineCapability field', 'All / Works Offline / Requires Bridge'],
      ], [2000, 2500, 4500]),
    pageBreak(),
  ];
}

function section12() {
  return [
    heading1('SECTION 12 — TOOL CARD'),

    heading2('12.1 Anatomy — Required Elements'),
    codeBlock([
      '┌────────────────────────────────────────────┐',
      '│  [Icon 32×32]                              │  ← top left (right in RTL)',
      '│                                            │',
      '│  Tool Name (EnglishName / ArabicName)      │  ← PRIMARY TEXT — most prominent',
      '│  ─────────────────────────────────         │',
      '│  Purpose text (max 2 lines, ellipsis)      │  ← Secondary text',
      '│                                            │',
      '│  [RiskLevel badge] [Admin badge if req.]   │  ← Metadata row',
      '│                              [ToolId]      │  ← right-aligned, muted, smallest',
      '└────────────────────────────────────────────┘',
    ]),

    heading2('12.2 Tool Card Measurements'),
    buildTable(['Property', 'Value'],
      [
        ['Width', 'Auto — fills grid column'],
        ['Min width', '200px'],
        ['Max width', '280px'],
        ['Min height', '140px'],
        ['Padding', '16px'],
        ['Corner radius', '8px'],
        ['Background', 'Color.Background.Elevated'],
        ['Border', '1px Color.Border.Default'],
        ['Top accent line', '1px Color.Border.GlassTop — TOP EDGE ONLY (separate Border element)'],
      ], [3000, 6000]),

    heading2('12.3 Tool Card Typography'),
    buildTable(['Element', 'Style Key', 'Color Token', 'Notes'],
      [
        ['Tool Name', 'Type.CardTitle (14px Medium)', 'Color.Text.Primary', 'From EnglishName or ArabicName per locale'],
        ['Purpose / Description', 'Type.BodySmall (12px Regular)', 'Color.Text.Secondary', 'Max 2 lines, ellipsis overflow'],
        ['Risk badge label', 'Type.LabelSmall (11px Medium)', 'Risk-appropriate (see Section 14)', 'Customer-facing label'],
        ['Admin badge label', 'Type.LabelSmall (11px Medium)', 'Color.Status.Warning', 'Only if RequiresAdmin = true'],
        ['ToolId', 'Type.ToolId (11px Regular)', 'Color.Text.Disabled', 'Bottom-right LTR / bottom-left RTL'],
      ], [2000, 2400, 2000, 2600]),

    noticeBox('TOOLID DISPLAY RULE — CRITICAL', [
      'The ToolId MUST NEVER be a heading.',
      'The ToolId MUST NEVER be the most visually prominent element on the card.',
      'Placement: bottom corner, Type.ToolId, Color.Text.Disabled.',
      'Not interactive. No prefix label needed.',
      'May be hidden if vertical space is insufficient — show on hover as tooltip.',
      'ToolId is a developer/technical reference — the user does not need to see it prominently.',
    ], C.critBg, C.critBorder),

    heading2('12.4 Risk Level Badge'),
    buildTable(['Canonical RiskLevel', 'Customer Label (EN)', 'Customer Label (AR)', 'Text Color', 'Background', 'Border'],
      [
        ['READ_ONLY', 'Read Only', 'قراءة فقط', 'Color.Risk.ReadOnly (#2DB87D)', 'ReadOnly at 12% opacity', 'ReadOnly at 35% opacity'],
        ['SAFE_CLEANUP', 'Safe Cleanup', 'تنظيف آمن', 'Color.Risk.SafeCleanup (#FFB020)', 'SafeCleanup at 12% opacity', 'SafeCleanup at 35% opacity'],
        ['DESTRUCTIVE', 'Destructive', 'عملية تدميرية', 'Color.Risk.Destructive (#E54B4B)', 'Destructive at 12% opacity', 'Destructive at 35% opacity'],
      ], [1500, 1300, 1400, 2000, 1800, 2000]),

    para('Badge spec: Padding 2px top/bottom, 8px left/right. Corner radius 4px.'),

    heading2('12.5 Admin Requirement Badge'),
    buildTable(['Property', 'Value'],
      [
        ['Show condition', 'RequiresAdmin = true in manifest — else do NOT show badge'],
        ['Icon', 'Shield or UAC icon, 12×12px, Color.Status.Warning'],
        ['Label (EN)', '"Admin"'],
        ['Label (AR)', '"مسؤول"'],
        ['Style', 'Same pill structure as risk badge'],
        ['Color treatment', 'Color.Status.Warning — background at 12% opacity, border at 35%'],
      ], [3000, 6000]),

    heading2('12.6 Tool Card States'),

    heading3('Default State'),
    para('As per measurements and typography above.'),

    heading3('Hover State'),
    buildTable(['Property', 'Change'],
      [
        ['Background', 'Color.Background.Elevated + Color.Interactive.HoverOverlay overlay'],
        ['Border', '1px Color.Border.Glass (slightly brighter)'],
        ['Shadow', 'Dark: 0 4px 12px rgba(0,0,0,0.5) / Light: 0 4px 12px rgba(0,0,0,0.12)'],
        ['Run affordance', 'Run/chevron icon appears top-right LTR / top-left RTL, 16×16px, Color.Text.Muted'],
        ['Transition duration', '150ms ease — background and shadow'],
      ], [2500, 6500]),

    heading3('Pressed State'),
    buildTable(['Property', 'Change'],
      [
        ['Overlay', 'Color.Interactive.PressOverlay'],
        ['Shadow', 'Reduced (card appears to press in)'],
        ['Scale', 'ScaleTransform 1.0 → 0.98, 60ms ease'],
      ], [2500, 6500]),

    heading3('Focused (Keyboard) State'),
    buildTable(['Property', 'Change'],
      [
        ['Outline', '2px Color.Border.Focus, 1px offset outside card'],
        ['Visual', 'Same as hover state'],
        ['Accessibility note', 'Outline must NOT be clipped by sidebar or container edge'],
      ], [2500, 6500]),

    heading3('Disabled State'),
    buildTable(['Property', 'Change'],
      [
        ['Opacity', '0.45 on entire card'],
        ['Background', 'No change from default'],
        ['Hover response', 'None'],
        ['Cursor', 'Default (not pointer)'],
        ['Tooltip', 'Explain why: "Bridge offline" or "Requires administrator privileges"'],
      ], [2500, 6500]),

    heading3('Running State'),
    buildTable(['Property', 'Change'],
      [
        ['Left edge accent', '3px Color.Accent.Primary vertical bar — left edge LTR / right edge RTL'],
        ['Bottom edge', 'Subtle indeterminate shimmer progress indicator'],
        ['Run button', 'Changes to "Cancel" with appropriate icon (only if tool is cancellable)'],
        ['Card interactivity', 'Card remains interactive — user can cancel'],
      ], [2500, 6500]),

    heading3('Result States — Post-Execution'),
    buildTable(['Result', 'Left Accent Color', 'Badge', 'Duration'],
      [
        ['Success', 'Color.Status.Success (3px)', 'Green check badge overlays icon top-right, 12×12px', 'Fades out after 3000ms → default state'],
        ['Warning', 'Color.Status.Warning (3px)', 'Amber warning badge on icon', 'Persists until user dismisses or re-runs'],
        ['Failed', 'Color.Status.Error (3px)', 'Red × badge on icon', 'Persists until user re-runs'],
        ['Cancelled', 'Color.Status.Cancelled (3px)', 'Grey stop badge on icon', 'Persists until re-run'],
        ['Skipped', 'Color.Status.Skipped (3px)', '0.65 opacity overlay on card content', 'Persists'],
        ['Inconclusive', 'Color.Status.Inconclusive (3px)', 'Purple ? badge on icon', 'Persists'],
      ], [1500, 2500, 3000, 2000]),
    pageBreak(),
  ];
}

function section13() {
  return [
    heading1('SECTION 13 — TOOL DETAIL PANEL'),

    heading2('13.1 Panel Purpose'),
    para('The tool detail panel is shown when a user selects a tool from the grid or list. It shows: full tool metadata, real preview information where available, all supported actions, and transitions into execution view.'),

    heading2('13.2 Panel Architecture — Glass Surface'),
    buildTable(['Property', 'Value'],
      [
        ['Surface type', 'Glass Surface (Surface Type 3)'],
        ['Width', '480px or fills right 40% of content area — developer determines based on layout'],
        ['Background', 'rgba(20,22,32,0.85) dark / rgba(255,255,255,0.82) light'],
        ['Blur', 'BlurEffect Radius 24 on background layer'],
        ['Border', '1px Color.Border.Glass'],
        ['Top accent', '1px Color.Border.GlassTop at top edge'],
        ['Corner radius', '12px (if floating) / 0 (if panel docked to content edge)'],
        ['Shadow', '0 8px 32px rgba(0,0,0,0.60) dark'],
        ['RTL position', 'Left side of content area in RTL mode'],
      ], [3000, 6000]),

    heading2('13.3 Panel Header'),
    codeBlock([
      '┌────────────────────────────────────────────────────┐',
      '│  [Icon 48×48]   Tool Name (EnglishName/ArabicName) │  ← large icon + name',
      '│                 [Category label]                   │  ← Type.Caption, Text.Muted',
      '│                 [RiskLevel badge] [Admin if req.]  │  ← badges',
      '│                                         [ToolId]   │  ← muted, small',
      '├────────────────────────────────────────────────────┤',
      '│  Purpose text (full — not truncated)               │  ← Type.Body, Text.Secondary',
      '└────────────────────────────────────────────────────┘',
    ]),

    heading2('13.4 Manifest Metadata Display'),
    para('Every field from the manifest that is relevant to the user is displayed. ToolId fields are secondary, technical references — never headings.'),
    buildTable(['Manifest Field', 'Display Label (EN)', 'Display Label (AR)', 'Display Style', 'Visibility'],
      [
        ['EnglishName', '(shown as title)', '—', 'Type.SectionHeading', 'Always'],
        ['ArabicName', '(shown as title in AR mode)', '—', 'Type.SectionHeading', 'When Arabic locale'],
        ['Purpose', 'Description', 'الوصف', 'Type.Body, Text.Secondary', 'Always'],
        ['Category', 'Category', 'الفئة', 'Type.BodySmall badge', 'Always'],
        ['RiskLevel', 'Risk Level', 'مستوى المخاطرة', 'Risk badge (see Section 14)', 'Always'],
        ['RequiresAdmin', 'Requires Administrator', 'يتطلب صلاحيات مسؤول', 'Admin badge / boolean', 'Always'],
        ['RequiresRestart', 'Requires Restart', 'يتطلب إعادة التشغيل', 'Warning badge if true', 'If true'],
        ['OfflineCapability', 'Works Offline', 'يعمل بدون اتصال', 'Green/grey indicator', 'Always'],
        ['BackupMethod', 'Backup Method', 'طريقة النسخ الاحتياطي', 'Type.BodySmall, Text.Muted', 'If not empty'],
        ['RollbackMethod', 'Rollback Method', 'طريقة التراجع', 'Type.BodySmall, Text.Muted', 'If not empty'],
        ['AnalyzeOnlySupported', 'Analyze Only', 'التحليل فقط', 'Action button shown/hidden', 'Controls button visibility'],
        ['WhatIfSupported', 'What-If Mode', 'وضع ماذا لو', 'Action button shown/hidden', 'Controls button visibility'],
        ['ToolId', 'Tool ID', 'معرف الأداة', 'Type.Caption, Text.Disabled', 'Always — muted, bottom'],
        ['TestResult', 'Test Result', 'نتيجة الاختبار', 'Internal only (may surface in diagnostics)','Developer reference'],
      ], [1800, 1600, 1600, 2000, 1200]),

    heading2('13.5 Preview Section'),
    noticeBox('PREVIEW RULE — NO INVENTED DATA', [
      'The Preview section may only show data that is REAL and ACCESSIBLE before execution.',
      'Data that cannot be known before execution must be labeled:',
      '  "Available during execution"',
      '  OR "Unavailable until runtime"',
      '',
      'Per-tool preview content must be derived from:',
      '  1. Manifest metadata (always available)',
      '  2. Actual PowerShell implementation behavior (inspect real scripts)',
      '  3. Existing WPF execution architecture (inspect real codebehind)',
      '',
      'Do NOT assume every Network tool exposes DNS.',
      'Do NOT assume every Storage tool exposes SMART.',
      'Do NOT assume every Performance tool exposes a specific metric.',
      'Do NOT assume every Security tool exposes Defender details.',
    ], C.critBg, C.critBorder),

    heading2('13.6 Action Bar'),
    para('Actions are derived exclusively from manifest capability flags. Never show an action for a capability that is not supported.'),
    buildTable(['Action', 'Condition to Show', 'Condition to Disable', 'Label (EN)', 'Label (AR)'],
      [
        ['Run / Execute', 'Always shown', 'Bridge offline OR RequiresAdmin and not admin', 'Run', 'تشغيل'],
        ['Analyze Only', 'AnalyzeOnlySupported = true', 'Bridge offline', 'Analyze', 'تحليل'],
        ['What-If', 'WhatIfSupported = true', 'Bridge offline', 'What-If', 'ماذا لو'],
        ['Cancel', 'Only during execution', 'Tool is not cancellable (per implementation)', 'Cancel', 'إلغاء'],
        ['View Report', 'Only after execution if report was generated', 'No report generated', 'View Report', 'عرض التقرير'],
        ['View Backup', 'Only after execution if backup exists (BackupMethod not empty)', 'No backup created', 'View Backup', 'عرض النسخة'],
      ], [1500, 2200, 2200, 1100, 1000]),

    noticeBox('DEAD BUTTON RULE', [
      'EVERY visible button MUST have a real handler.',
      'If a button cannot function in the current state, it must be:',
      '  1. Hidden — if the capability does not exist at all for this tool.',
      '  2. Disabled with tooltip explanation — if capability exists but not currently available.',
      'A visible, enabled button with no handler is an implementation failure.',
    ], C.critBg, C.critBorder),
    pageBreak(),
  ];
}

function section14() {
  return [
    heading1('SECTION 14 — EXECUTION SCREEN & CONSOLE'),

    heading2('14.1 Execution Screen Layout'),
    codeBlock([
      '┌─────────────────────────────────────────────────────────────┐',
      '│  [Tool Name]                              [Cancel if avail] │  ← header',
      '│  Running: [real action name] via [real script path]         │  ← status info',
      '├─────────────────────────────────────────────────────────────┤',
      '│                                                             │',
      '│  [Live Console Output]                                      │',
      '│                                                             │',
      '│  > [real PowerShell output line 1]                          │',
      '│  > [real PowerShell output line 2]                          │',
      '│    [timestamp]  [output line content]                       │',
      '│                                                             │',
      '│  ─────────────────────────────────────────────────────────  │',
      '│  [Progress indicator if applicable]                         │',
      '│  [Duration counter — real elapsed time]                     │',
      '└─────────────────────────────────────────────────────────────┘',
    ]),

    heading2('14.2 Diagnostic Console Specification'),
    noticeBox('CONSOLE RULES — STRICT', [
      'Console output must be REAL PowerShell execution output — piped directly.',
      'NEVER inject fake output lines.',
      'NEVER show simulated "scanning..." lines if not from the script.',
      'NEVER show a fake percentage counter.',
      'NEVER show "Done!" if the actual script did not emit that signal.',
      'Console output is always LTR — even in Arabic UI mode.',
      'Console uses monospace font (Cascadia Code / Consolas fallback).',
      'Console is read-only — user cannot type into it.',
      'Console is auto-scrolling — follows new output.',
      'User can pause auto-scroll by scrolling up manually.',
      'A "Scroll to Bottom" button appears when user has scrolled up.',
    ], C.critBg, C.critBorder),

    buildTable(['Property', 'Value'],
      [
        ['Font family', 'Cascadia Code, fallback Consolas, Courier New'],
        ['Font size', 'Type.Console (12px Regular)'],
        ['Background', 'Color.Background.Shell (#0E0F13 dark)'],
        ['Text color (default)', 'Color.Text.Console (#D4E4B0)'],
        ['Warning output', 'Color.Text.ConsoleWarning (#FFCC44)'],
        ['Error output', 'Color.Text.ConsoleError (#FF6B6B)'],
        ['Success output', 'Color.Text.ConsoleSuccess (#5DE8A0)'],
        ['Timestamps / prefixes', 'Color.Text.ConsoleMuted (#6E7A94) — Type.ConsoleSmall 11px'],
        ['Padding', '16px all sides'],
        ['Scrollbar', 'Thin, accent-colored, auto-hide when not hovering'],
        ['FlowDirection', 'Always LTR — even when Arabic UI is active'],
        ['TextFormattingMode', 'Display (crispness at small sizes)'],
        ['Selection', 'Allowed — user can select/copy console output'],
      ], [3000, 6000]),

    heading2('14.3 Console Line Types'),
    buildTable(['Line Type', 'Color Token', 'Prefix', 'Example'],
      [
        ['Standard output', 'Color.Text.Console', '>', 'Checking disk integrity...'],
        ['Warning output', 'Color.Text.ConsoleWarning', '!', 'Warning: 3 errors found'],
        ['Error output', 'Color.Text.ConsoleError', 'X', 'Error: Access denied to path'],
        ['Success output', 'Color.Text.ConsoleSuccess', 'V', 'Completed successfully'],
        ['Timestamp', 'Color.Text.ConsoleMuted', '[HH:mm:ss]', '[14:23:07]'],
        ['Section header', 'Color.Text.ConsoleWarning', '===', '=== Phase 2 of 3 ==='],
        ['Script path info', 'Color.Text.ConsoleMuted', '#', '# Running: Scripts/01/DF01.ps1'],
      ], [2000, 2400, 1000, 3600]),

    heading2('14.4 Execution Progress Indicator'),
    buildTable(['Scenario', 'Indicator'],
      [
        ['Steps not measurable', 'Indeterminate shimmer bar at top of console panel'],
        ['Steps measurable (script emits progress)', 'Determinate progress bar bound to real step count'],
        ['Duration', 'Real elapsed time counter "Running for Xm Xs" — wall clock'],
        ['No progress indicator', 'Never show a fake percentage'],
      ], [3500, 5500]),

    heading2('14.5 Cancellation'),
    buildTable(['Scenario', 'Behavior'],
      [
        ['Tool is cancellable (per implementation)', 'Cancel button visible and enabled during execution'],
        ['Tool is NOT cancellable', 'Cancel button hidden — never shown as disabled for non-cancellable tools'],
        ['Cancel confirmed', 'Sends cancellation signal to script, awaits graceful termination'],
        ['Cancel result', 'Shows Cancelled state (Section 15.4)'],
      ], [3500, 5500]),
    pageBreak(),
  ];
}

function section15() {
  return [
    heading1('SECTION 15 — RESULT STATES'),

    heading2('15.1 Result Screen Architecture'),
    para('Every execution produces one of the following result states. Each state has a full-screen result view with a header banner, evidence section, and available actions.'),

    heading2('15.2 Result Header Banner Specification'),
    buildTable(['State', 'Background Gradient', 'Icon Color', 'Icon', 'Title Color', 'Left Accent'],
      [
        ['Success', 'rgba(45,184,125,0.12) → transparent', 'Color.Status.Success', 'Checkmark circle 32×32', 'Color.Status.Success', '3px Color.Status.Success'],
        ['Warning', 'rgba(255,176,32,0.12) → transparent', 'Color.Status.Warning', 'Warning triangle 32×32', 'Color.Status.Warning', '3px Color.Status.Warning'],
        ['Failed', 'rgba(229,75,75,0.12) → transparent', 'Color.Status.Error', 'X circle 32×32', 'Color.Status.Error', '3px Color.Status.Error'],
        ['Cancelled', 'rgba(136,150,176,0.12) → transparent', 'Color.Status.Cancelled', 'Stop circle 32×32', 'Color.Status.Cancelled', '3px Color.Status.Cancelled'],
        ['Skipped', 'rgba(110,122,148,0.10) → transparent', 'Color.Status.Skipped', 'Skip forward 32×32', 'Color.Status.Skipped', '3px Color.Status.Skipped'],
        ['Inconclusive', 'rgba(168,85,247,0.12) → transparent', 'Color.Status.Inconclusive', '? circle 32×32', 'Color.Status.Inconclusive', '3px Color.Status.Inconclusive'],
      ], [1200, 2400, 1500, 1800, 1500, 1600]),

    heading2('15.3 Success State'),
    bullet('Header: "Completed Successfully" — Type.PageTitle, Color.Status.Success'),
    bullet('Body: Full console output remains visible and scrollable'),
    bullet('Evidence section: show real output evidence — actual results from script'),
    bullet('Report section: "Open Report" button ONLY if a real report file was generated'),
    bullet('Backup section: "View Backup" button ONLY if BackupMethod is not empty AND backup was created'),
    bullet('Rollback section: "Rollback" button ONLY if RollbackMethod is not empty AND rollback is possible'),
    bullet('Duration: real elapsed time'),
    noticeBox('SUCCESS RULE', [
      'Success MUST NOT be shown without real evidence of success from the script.',
      'If the script exits with code 0 but outputs nothing verifiable: show Inconclusive, not Success.',
      '"Open Report" must open a real file. If no report file exists, hide the button.',
    ], C.critBg, C.critBorder),

    heading2('15.4 Warning State'),
    bullet('Header: "Completed with Warnings" — Type.PageTitle, Color.Status.Warning'),
    bullet('Body: Full console output with warnings highlighted'),
    bullet('Warning list: enumerate real warnings from script output'),
    bullet('User can acknowledge and dismiss, or re-run'),

    heading2('15.5 Failed State'),
    bullet('Header: "Failed" — Type.PageTitle, Color.Status.Error'),
    bullet('Body: Full console output with error highlighted'),
    bullet('Error detail: show real error message from script output'),
    bullet('Rollback option: shown only if RollbackMethod exists and rollback is feasible'),
    bullet('"Retry" button: re-executes the same action'),
    bullet('"View Log" button: opens full execution log'),

    heading2('15.6 Cancelled State'),
    bullet('Header: "Cancelled" — Type.PageTitle, Color.Status.Cancelled'),
    bullet('Body: console output up to cancellation point'),
    bullet('Note: "Tool execution was cancelled by user"'),
    bullet('"Run Again" button to restart'),

    heading2('15.7 Skipped State'),
    bullet('Header: "Skipped" — Type.PageTitle, Color.Status.Skipped'),
    bullet('Body: reason for skip (pre-conditions not met, etc.)'),
    bullet('Explanation: must be real — from pre-flight check result'),

    heading2('15.8 Inconclusive State'),
    bullet('Header: "Inconclusive" — Type.PageTitle, Color.Status.Inconclusive'),
    bullet('Body: console output'),
    bullet('Note: "The tool completed but the result could not be determined"'),
    bullet('Available when: script exits 0 but output is ambiguous'),

    heading2('15.9 Evidence Section'),
    noticeBox('EVIDENCE RULE', [
      'If the result is displayed, it must be backed by real evidence:',
      '  Success: real script output showing success condition',
      '  Warning: real warning messages from script',
      '  Failure: real error messages from script',
      '',
      'Never show a success state without evidence.',
      'Never fabricate evidence.',
      'If evidence cannot be determined: show Inconclusive.',
    ], C.critBg, C.critBorder),
    pageBreak(),
  ];
}

function section16() {
  return [
    heading1('SECTION 16 — RISK & ADMIN UX'),

    heading2('16.1 Risk Level Presentation Layer'),
    para('The canonical RiskLevel enum from the manifest is preserved internally. A separate presentation layer translates it to customer-facing labels and UX policy.'),
    ...spacer(1),
    buildTable(['Canonical RiskLevel', 'Customer Label (EN)', 'Customer Label (AR)', 'Color Treatment', 'Confirmation Policy'],
      [
        ['READ_ONLY', 'Read Only', 'قراءة فقط', 'Color.Risk.ReadOnly (#2DB87D) — green', 'No destructive confirmation required. May proceed directly.'],
        ['SAFE_CLEANUP', 'Safe Cleanup', 'تنظيف آمن', 'Color.Risk.SafeCleanup (#FFB020) — amber', 'Explain what will be cleaned. Show reversibility if BackupMethod exists. One-click confirm.'],
        ['DESTRUCTIVE', 'Destructive', 'عملية تدميرية', 'Color.Risk.Destructive (#E54B4B) — red', 'Explicit confirmation dialog required. Explain consequences. Two-step confirm.'],
      ], [1400, 1400, 1400, 2200, 2600]),

    heading2('16.2 Confirmation Dialog — SAFE_CLEANUP'),
    codeBlock([
      '┌────────────────────────────────────────────────────────┐',
      '│  Run: [EnglishName / ArabicName]                       │',
      '│                                                        │',
      '│  This tool will perform a safe cleanup operation.      │',
      '│  [Purpose text]                                        │',
      '│                                                        │',
      '│  [BackupMethod info if available]                      │',
      '│  [RollbackMethod info if available]                    │',
      '│                                                        │',
      '│              [Cancel]       [Run — Safe Cleanup]       │',
      '└────────────────────────────────────────────────────────┘',
    ]),

    heading2('16.3 Confirmation Dialog — DESTRUCTIVE'),
    codeBlock([
      '┌────────────────────────────────────────────────────────┐',
      '│  [Warning icon 24×24]  Destructive Operation           │',
      '│                                                        │',
      '│  [EnglishName / ArabicName]                            │',
      '│  [Purpose text]                                        │',
      '│                                                        │',
      '│  This operation may be irreversible.                   │',
      '│  [Specific consequence explanation from Purpose]       │',
      '│                                                        │',
      '│  [BackupMethod if exists — "Backup will be created"]   │',
      '│  [RollbackMethod if exists — "Rollback available"]     │',
      '│                                                        │',
      '│  Type "CONFIRM" to proceed:  [_________________]      │  ← optional for highest risk',
      '│                                                        │',
      '│         [Cancel]       [I Understand — Run Tool]       │',
      '└────────────────────────────────────────────────────────┘',
    ]),
    buildTable(['Property', 'SAFE_CLEANUP dialog', 'DESTRUCTIVE dialog'],
      [
        ['Surface type', 'Glass Surface (Type 3)', 'Glass Surface (Type 3)'],
        ['Width', '420px', '480px'],
        ['Corner radius', '12px', '12px'],
        ['Header icon', 'None', 'Warning icon 24×24, Color.Status.Warning'],
        ['Confirm button label', '"Run — Safe Cleanup"', '"I Understand — Run Tool"'],
        ['Confirm button color', 'Color.Status.Warning', 'Color.Status.Error'],
        ['Type-to-confirm field', 'Not required', 'Optional for highest-stakes operations'],
        ['Cancel button', 'Left of confirm', 'Left of confirm'],
        ['Dismiss on overlay click', 'No (must explicitly cancel)', 'No (must explicitly cancel)'],
      ], [2500, 2500, 4000]),

    heading2('16.4 Admin Requirement UX'),
    buildTable(['Scenario', 'UX Response'],
      [
        ['RequiresAdmin = true, running as admin', 'Run button enabled. No warning needed.'],
        ['RequiresAdmin = true, NOT running as admin', 'Run button disabled. Tooltip: "Requires administrator privileges." UAC elevation prompt on click (if available).'],
        ['RequiresAdmin = false', 'No admin badge or indication needed.'],
        ['RequiresRestart = true', 'Show "Requires Restart" badge in detail panel. After run: show restart prompt. Never restart automatically.'],
      ], [3000, 6000]),

    heading2('16.5 Bridge Offline State'),
    noticeBox('BRIDGE OFFLINE — PERSISTENT BANNER', [
      'When bridge is offline, a persistent banner appears below the page header.',
      'It does NOT block navigation.',
      'It disables all execution buttons with tooltip explanation.',
      'Banner content:',
      '  [Warning icon] Bridge offline — tool execution unavailable',
      '  [Retry connection button]',
      '  Color.Status.WarningSubtle background, Color.Status.Warning border',
    ], C.warnBg, C.warnBorder),
    buildTable(['Element', 'Specification'],
      [
        ['Height', '40px'],
        ['Background', 'Color.Status.WarningSubtle'],
        ['Border bottom', '1px Color.Status.WarningBorder'],
        ['Icon', 'Warning icon 16×16, Color.Status.Warning'],
        ['Text', '"Bridge offline — tool execution unavailable" — Type.BodySmall, Color.Status.Warning'],
        ['Retry button', '"Retry Connection" — ghost button, right-aligned'],
        ['Dismiss', 'Not dismissible — persists until bridge reconnects'],
      ], [2000, 7000]),
    pageBreak(),
  ];
}

function section17() {
  return [
    heading1('SECTION 17 — SETTINGS PAGE'),

    heading2('17.1 Settings Architecture'),
    noticeBox('DEVELOPER: INSPECT EXISTING SETTINGS FIRST', [
      'Before implementing settings visual, inspect the actual SettingsPage.xaml and SettingsPage.xaml.cs.',
      'Preserve all existing settings categories, stored values, and working controls.',
      'Apply Glass Nexus visual tokens without rewriting settings logic.',
    ], C.warnBg, C.warnBorder),

    heading2('17.2 Settings Categories'),
    buildTable(['Category', 'Settings Covered', 'Notes'],
      [
        ['Appearance', 'Dark/Light theme toggle, Language selector (EN/AR), Glass effects toggle', 'ThemeService integration'],
        ['Execution', 'Default confirm behavior, Admin elevation preference, Console history length', 'ExecutionService integration'],
        ['Bridge', 'Bridge connection mode, retry behavior, timeout', 'BridgeService/existing service'],
        ['Localization', 'Language, RTL/LTR, Date format', 'LocalizationService'],
        ['Accessibility', 'High contrast mode, Reduced motion, Font size adjustment', 'See Section 18'],
        ['About', 'Version, licenses, diagnostics export, reset to defaults', 'Read-only / utility'],
      ], [1800, 3500, 3700]),

    heading2('17.3 Settings Control Patterns'),
    buildTable(['Control Type', 'WPF Control', 'When to Use'],
      [
        ['Toggle', 'ToggleButton or CheckBox with custom style', 'Boolean settings (enable/disable)'],
        ['Dropdown', 'ComboBox with custom style', 'Enumerated options (language, theme)'],
        ['Slider', 'Slider with custom style', 'Range values (font size, history length)'],
        ['Text input', 'TextBox with custom style', 'Bridge address, custom paths'],
        ['Button', 'Button with custom style', 'Actions (reset, export, retry)'],
        ['Read-only text', 'TextBlock', 'Version, diagnostic info'],
      ], [2000, 2500, 4500]),

    heading2('17.4 Settings Page Layout'),
    codeBlock([
      '┌─────────────────────────────────────────────────────────────┐',
      '│  Settings                                                   │  ← 52px header',
      '├───────────────────────────┬─────────────────────────────────┤',
      '│  [Appearance]             │  Theme                          │',
      '│  [Execution]              │  ────────────────────────────   │',
      '│  [Bridge]                 │  Dark Mode     [Toggle]         │',
      '│  [Localization]           │  Glass Effects [Toggle]         │',
      '│  [Accessibility]          │  Language      [EN / AR]        │',
      '│  [About]                  │                                 │',
      '│                           │  [Section divider]              │',
      '│                           │  [Next settings group...]       │',
      '└───────────────────────────┴─────────────────────────────────┘',
    ]),

    heading2('17.5 Theme Toggle Behavior'),
    bullet('Dark/Light toggle: applies immediately without restart'),
    bullet('Language toggle: applies immediately — triggers FlowDirection change at window level'),
    bullet('Glass effects toggle: applies immediately — toggles IsGlassEnabled in ThemeService'),
    bullet('All settings are persisted to user settings file immediately on change'),
    pageBreak(),
  ];
}

function section18() {
  return [
    heading1('SECTION 18 — ACCESSIBILITY'),

    heading2('18.1 Keyboard Navigation'),
    buildTable(['Shortcut / Pattern', 'Action'],
      [
        ['Tab / Shift+Tab', 'Move focus forward / backward through interactive elements'],
        ['Arrow keys', 'Navigate within sidebar list, tool grid, category filter chips'],
        ['Enter / Space', 'Activate focused button, chip, nav item, or tool card'],
        ['Escape', 'Close dialog, panel, or cancel running operation'],
        ['Ctrl+F', 'Focus search field from anywhere on All Tools page'],
        ['Alt+Left/Right', 'Navigate back/forward in page history (if applicable)'],
        ['F1', 'Open help / tool documentation (if implemented)'],
        ['Home / End', 'Scroll to top / bottom of tool grid or console output'],
      ], [3000, 6000]),

    heading2('18.2 Focus Visibility'),
    bullet('All interactive elements must have a visible keyboard focus indicator'),
    bullet('Focus indicator: 2px Color.Border.Focus (#2C7BE5) outline with 1px offset'),
    bullet('Focus indicator must NOT be clipped by container — ensure overflow: visible or padding offset'),
    bullet('Focus order must match visual reading order (LTR or RTL depending on locale)'),

    heading2('18.3 Screen Reader Support'),
    buildTable(['Element', 'AutomationProperties Requirement'],
      [
        ['Tool card', 'AutomationProperties.Name = "[ToolId] — [EnglishName] — [RiskLevel customer label]"'],
        ['Icon buttons', 'AutomationProperties.Name = descriptive label (not "Button" or "Icon")'],
        ['Status badges', 'AutomationProperties.Name = "Status: [state]"'],
        ['Console output', 'AutomationProperties.LiveSetting = Polite for new output'],
        ['Progress bar', 'AutomationProperties.Name = "Execution progress"'],
        ['Risk badge', 'AutomationProperties.Name = "Risk level: [customer label]"'],
        ['Navigation items', 'AutomationProperties.Name = "[Category name]", IsSelected state exposed'],
      ], [3000, 6000]),

    heading2('18.4 Reduced Motion'),
    buildTable(['Scenario', 'Reduced Motion Behavior'],
      [
        ['Splash animation', 'Skip scale/opacity animations — show elements immediately'],
        ['Page transitions', 'No fade — switch immediately'],
        ['Card hover transitions', 'No shadow/background animation — apply immediately'],
        ['Progress bar shimmer', 'Replace shimmer with simple fill bar'],
        ['Toast notifications', 'No slide-in animation — appear immediately'],
      ], [3500, 5500]),
    para('Detect via: SystemParameters.ClientAreaAnimation or SystemParameters.MenuAnimation. If false: disable all non-essential animations.'),

    heading2('18.5 Color Contrast Requirements'),
    buildTable(['Text Type', 'Minimum Contrast Ratio', 'Verification Tool'],
      [
        ['Body text (Type.Body and above)', '4.5:1 against background', 'Windows Colour Contrast Analyser or similar'],
        ['UI component labels', '3:1 against adjacent colors', ''],
        ['Status badge text', '4.5:1 against badge background', ''],
        ['Console output', '4.5:1 against console background', ''],
        ['Disabled text (Color.Text.Disabled)', 'Exempt from contrast requirement', 'Must be clearly visually distinct from enabled'],
      ], [3000, 2000, 4000]),

    heading2('18.6 High Contrast Mode'),
    bullet('Detect Windows High Contrast via SystemParameters.HighContrast'),
    bullet('When active: disable all transparency, blur, and glass effects automatically'),
    bullet('When active: use system colors for text and backgrounds instead of Glass Nexus tokens'),
    bullet('All borders become 2px solid, fully opaque'),
    bullet('Never fight Windows High Contrast mode'),

    heading2('18.7 DPI and Font Scaling'),
    bullet('Never use fixed pixel sizes for text — always use DIP (device-independent pixels) in WPF'),
    bullet('Test at 100%, 125%, 150%, 200% DPI'),
    bullet('Respect user\'s system font size setting where applicable'),
    bullet('Minimum interactive target size: 40×40px at 100% DPI'),
    pageBreak(),
  ];
}

function section19() {
  return [
    heading1('SECTION 19 — ARABIC & RTL IMPLEMENTATION'),

    heading2('19.1 RTL Architecture Principles'),
    noticeBox('RTL IS NOT AN AFTERTHOUGHT', [
      'Arabic/RTL is not a post-processing layer applied to a finished LTR design.',
      'Both reading directions must be designed simultaneously at the architecture level.',
      'FlowDirection="RightToLeft" at the Window level propagates to all children via WPF inheritance.',
      'The sidebar moves to the RIGHT side in Arabic mode.',
      'Active indicator moves to RIGHT edge in Arabic mode.',
      'Text alignment flips throughout.',
    ], C.warnBg, C.warnBorder),

    heading2('19.2 FlowDirection Implementation'),
    codeBlock([
      '<!-- Set on MainWindow at app start, before splash is shown -->',
      '<Window FlowDirection="{Binding CurrentFlowDirection, Source={x:Static LocalizationService.Instance}}">',
      '',
      '<!-- Or set imperatively in code: -->',
      'this.FlowDirection = isArabic ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;',
    ]),

    heading2('19.3 RTL Layout Checklist'),
    buildTable(['Element', 'LTR Behavior', 'RTL Behavior'],
      [
        ['Sidebar', 'Left side, right border', 'RIGHT side, left border'],
        ['Nav item layout', 'Icon left, label right', 'Icon right, label left'],
        ['Active indicator', 'Left edge, 3px bar', 'RIGHT edge, 3px bar'],
        ['Status bar elements', 'Bridge left, version right', 'Bridge right, version left'],
        ['Tool card icon', 'Top-left', 'Top-right'],
        ['ToolId', 'Bottom-right', 'Bottom-left'],
        ['Risk badges', 'Bottom-left area', 'Bottom-right area'],
        ['Run affordance (hover)', 'Top-right of card', 'Top-left of card'],
        ['Search field', 'Right-aligned in header', 'Left-aligned in header'],
        ['View toggle', 'Right of search', 'Left of search'],
        ['Category filter chips', 'Left to right', 'Right to left'],
        ['Console output', 'Always LTR — locked', 'Always LTR — locked'],
        ['Progress bar fill', 'Fills left to right', 'Fills RIGHT to left'],
        ['Confirmation buttons', 'Cancel left, Confirm right', 'Cancel right, Confirm left'],
      ], [2200, 2200, 4600]),

    heading2('19.4 Arabic Text Handling'),
    bullet('Never split Arabic words with hyphens — TextWrapping="Wrap" only'),
    bullet('Western numerals (0–9) used for all technical references (ToolId, counts, percentages)'),
    bullet('Mixed text: rely on WPF Unicode bidi algorithm — do not manually override bidi for mixed strings'),
    bullet('Arabic font size: consider +0.5–1px vs Latin if legibility is insufficient at same size'),
    bullet('Arabic label strings in Strings.ar.xaml are authoritative — do not hardcode Arabic strings in XAML'),

    heading2('19.5 Console in Arabic Mode'),
    codeBlock([
      'Console block: FlowDirection="LeftToRight" locked — always.',
      'Console label in Arabic: "نتيجة التنفيذ" (Execution Result) — label is RTL, content is LTR.',
      '',
      '<!-- Implementation: -->',
      '<TextBox FlowDirection="LeftToRight" ... />  <!-- override parent RTL -->',
      '',
      'The console TextBox must explicitly override parent FlowDirection to LeftToRight.',
      'It does NOT inherit RTL from the window.',
    ]),
    pageBreak(),
  ];
}

function section20() {
  return [
    heading1('SECTION 20 — ANIMATION & MICRO-INTERACTIONS'),

    heading2('20.1 Motion Principles'),
    bullet('All motion must communicate structure — not entertainment'),
    bullet('No animation exceeds 300ms duration'),
    bullet('Nothing loops unless the system is actively doing something'),
    bullet('All animations must be skipped/disabled under Reduced Motion (see Section 18.4)'),
    bullet('Animation curves: CubicEaseOut for entrances, CubicEaseIn for exits, Linear for progress'),

    heading2('20.2 Animation Catalog'),
    buildTable(['Interaction', 'Duration', 'Easing', 'Property', 'Notes'],
      [
        ['Card hover enter', '150ms', 'ease', 'Background + shadow', 'Simultaneous'],
        ['Card hover exit', '150ms', 'ease', 'Background + shadow', 'Returns to default'],
        ['Card press scale', '60ms', 'ease', 'ScaleTransform 1.0→0.98', ''],
        ['Card press release', '120ms', 'ease', 'ScaleTransform 0.98→1.0', ''],
        ['Nav item hover', '120ms', 'ease', 'Background opacity', ''],
        ['Page transition', '200ms', 'CubicEaseOut', 'Opacity 0→1', 'New page fades in'],
        ['Modal appear', '200ms', 'CubicEaseOut', 'Opacity + Y translate -8→0', ''],
        ['Modal dismiss', '150ms', 'CubicEaseIn', 'Opacity 1→0', ''],
        ['Toast appear', '200ms', 'CubicEaseOut', 'Opacity + Y slide', 'From bottom edge'],
        ['Toast dismiss', '200ms', 'CubicEaseIn', 'Opacity 1→0', 'After 4000ms auto'],
        ['Splash fade in', '150ms', 'CubicEaseOut', 'Opacity 0→1', ''],
        ['Logo reveal', '150ms', 'CubicEaseOut', 'Scale 0.85→1.0 + Opacity', ''],
        ['Splash fade out', '200ms', 'CubicEaseIn', 'Opacity 1→0', ''],
        ['Shell fade in', '300ms', 'CubicEaseOut', 'Opacity 0→1', 'After splash'],
        ['Progress indeterminate', 'Loop 1200ms', 'Linear', 'Shimmer sweep', 'Stops when complete'],
      ], [2200, 900, 1200, 1800, 2900]),

    heading2('20.3 Toast Notification Specification'),
    buildTable(['Property', 'Value'],
      [
        ['Position', 'Bottom-right corner (bottom-left in RTL), 20px margin from window edge'],
        ['Width', '320px'],
        ['Min height', '56px'],
        ['Padding', '12px 16px'],
        ['Corner radius', '8px'],
        ['Surface', 'Glass Surface (Type 3) or Simulated Glass fallback'],
        ['Icon', '20×20px, status-appropriate color'],
        ['Title', 'Type.Label, Color.Text.Primary'],
        ['Body', 'Type.BodySmall, Color.Text.Secondary'],
        ['Auto-dismiss', '4000ms for success/info. Persists for warnings/errors until dismissed.'],
        ['Dismiss button', 'X icon, top-right corner (top-left RTL), 14×14px'],
        ['Stack behavior', 'Multiple toasts stack vertically with 8px gap'],
      ], [3000, 6000]),
    pageBreak(),
  ];
}

function section21() {
  return [
    heading1('SECTION 21 — QA MATRIX & ACCEPTANCE CRITERIA'),

    heading2('21.1 QA Test Matrix'),
    buildTable(['Test Area', 'Test Cases', 'Pass Criteria'],
      [
        ['Splash screen', 'Appears, animates, transitions to main shell', 'No Thread.Sleep. Progress matches real init. No fake messages.'],
        ['Theme switching', 'Toggle Dark ↔ Light', 'Immediate, no restart, all elements update'],
        ['Language switching', 'Toggle EN ↔ AR', 'FlowDirection changes, sidebar moves, text flips, console remains LTR'],
        ['Tool grid', 'All tools displayed from manifest', 'Count matches manifest. No invented tools.'],
        ['Search', 'Search by EnglishName, ArabicName, ToolId', '200ms debounce. Results match manifest fields only.'],
        ['Category filter', 'Filter by each of 10 categories', 'Shows only tools in that category per manifest.'],
        ['Tool card states', 'All 9 states (default, hover, pressed, focused, disabled, running, success, warning, failed)', 'Each state visually distinct. No missing state.'],
        ['Execution', 'Run a READ_ONLY tool', 'Real output. No fake console. Real result state.'],
        ['Confirmation dialog', 'SAFE_CLEANUP and DESTRUCTIVE tools', 'Correct dialog type. Cancel works. Run proceeds correctly.'],
        ['Bridge offline', 'Start app with bridge unavailable', 'Banner shown. Buttons disabled. Navigation works.'],
        ['RTL layout', 'Switch to Arabic', 'Sidebar right. Icons mirror. Console LTR. All text RTL.'],
        ['DPI scaling', 'Run at 100%, 125%, 150%, 200%', 'No text clipping. No blurry icons. No truncation.'],
        ['Keyboard navigation', 'Tab through all interactive elements', 'All elements reachable. Focus indicator visible. Order correct.'],
        ['Reduced motion', 'Enable reduced motion in Windows', 'All non-essential animations disabled.'],
        ['High contrast', 'Enable Windows High Contrast', 'No glass effects. System colors used. Readable.'],
        ['Screen reader', 'Navigate with Narrator', 'All elements announced. Tool names correct. Status exposed.'],
        ['Result states', 'All 6 result states', 'Each has real evidence. No fake success. Correct buttons shown.'],
        ['Admin tools', 'Run RequiresAdmin tool without admin', 'Button disabled with tooltip. No silent failure.'],
        ['No placeholder UI', 'Full app inspection', 'No "Coming Soon", "TODO", "Placeholder", or dead buttons visible.'],
        ['Manifest accuracy', 'Compare UI to manifest', 'ToolIds match manifest. Names match manifest. No invented tools.'],
      ], [2000, 2500, 4500]),

    heading2('21.2 Implementation Failure Conditions'),
    noticeBox('IMPLEMENTATION FAILS IF ANY OF THESE ARE TRUE', [
      '1.  A service card has no real action handler.',
      '2.  A visible button has no event handler.',
      '3.  A preview panel contains invented information not from manifest or real script output.',
      '4.  A ToolId is invented (not from Docs/TOOLS-MANIFEST.json).',
      '5.  A ScriptPath is invented.',
      '6.  Fake progress is shown (fake %, fake loading animation without real progress).',
      '7.  Fake console output is injected.',
      '8.  Success result is shown without real evidence from script output.',
      '9.  Placeholder pages remain visible in production build.',
      '10. "Coming Soon" text or state exists in production build.',
      '11. Arabic/RTL layout is broken or untested.',
      '12. Light theme is broken or untested.',
      '13. Accessibility (keyboard navigation, focus indicators) is broken.',
      '14. Real execution contract is changed by visual implementation.',
      '15. Tool count in UI does not match manifest tool count.',
      '16. Category slugs in code do not match confirmed real slugs.',
      '17. A dead navigation item exists (navigates nowhere).',
      '18. A confirmation dialog is bypassed for DESTRUCTIVE tools.',
      '19. Console output block has FlowDirection RTL in Arabic mode.',
      '20. An icon uses emoji character instead of Fluent icon.',
    ], C.critBg, C.critBorder),

    heading2('21.3 Developer Handoff Checklist'),
    buildTable(['Item', 'Action Required', 'Before / After'],
      [
        ['Colors.xaml', 'Compare against Section 03 token table. Add missing tokens.', 'Before visual implementation'],
        ['Light.xaml', 'Compare against Section 03.2. Add missing light mode tokens.', 'Before visual implementation'],
        ['Themes/SKILL.md category slugs', 'Verify 10 real category slugs in code match Section 11.3', 'Before filter implementation'],
        ['Icon codepoints', 'Verify all Segoe Fluent Icons codepoints with charmap.exe', 'Before icon implementation'],
        ['Manifest load', 'Verify Docs/TOOLS-MANIFEST.json loads with all 100 tools', 'Before tool display'],
        ['ThemeService', 'Verify IsGlassEnabled property exists. Add if missing.', 'Before glass implementation'],
        ['FlowDirection toggle', 'Verify language switch triggers FlowDirection change at window level', 'Before Arabic implementation'],
        ['Console LTR lock', 'Verify console TextBox has explicit FlowDirection=LTR override', 'Before Arabic testing'],
        ['Accessibility pass', 'Run Windows Narrator against all major views', 'Before release'],
        ['Contrast check', 'Run contrast analyzer against all text/background pairs', 'Before release'],
        ['DPI test', '100%, 125%, 150%, 200% manual visual test', 'Before release'],
        ['Reduced motion test', 'Enable Windows Reduced Motion, verify all animations skip', 'Before release'],
        ['High contrast test', 'Enable Windows High Contrast, verify glass effects disabled', 'Before release'],
      ], [2500, 4000, 2500]),
    pageBreak(),
  ];
}

function section22() {
  const riskLevels = [...new Set(canonicalTools.map((tool) => valueText(tool.RiskLevel)))].sort();
  return [
    heading1('SECTION 22 — CANONICAL TOOL DATA'),
    noticeBox('CANONICAL DATA VERIFIED AT GENERATION', [
      `Project root: ${projectRoot}`,
      `Manifest: ${manifestPath}`,
      `Verified tool records: ${canonicalTools.length}`,
      `Verified category slugs: ${canonicalCategories.length}`,
      'All per-tool values in this section are read directly from Docs/TOOLS-MANIFEST.json.',
      'Generation fails if a required field, unique ToolId, declared script path, 10-category count, or 100-tool count is invalid.',
    ], C.okBg, C.okBorder),

    heading2('22.1 Category Reference — Canonical'),
    buildTable(
      ['#', 'Category Slug (Exact)', 'Display Name (Derived)'],
      canonicalCategories.map((category) => [category.slice(0, 2), category, categoryDisplayName(category)]),
      [700, 4300, 3600]
    ),

    heading2('22.2 Canonical Manifest Field Contract'),
    buildTable(['Field Name', 'Observed Type', 'Visual / Interaction Contract'],
      [
        ['ToolId', 'String', 'Unique technical identifier. Keep secondary and muted; never use as the primary card title.'],
        ['Category', 'String slug', 'Filter and navigate using only exact canonical category values.'],
        ['ScriptPath', 'Project-relative path', 'Execution service resolves this verified path; do not invent or rewrite it for visual presentation.'],
        ['EnglishName / ArabicName', 'String', 'Use the language-appropriate canonical display name for cards, detail panels, and accessibility labels.'],
        ['Purpose', 'String', 'Use as the card description and full detail-panel purpose.'],
        [`RiskLevel`, `Enum: ${riskLevels.join(' | ')}`, 'Map every observed canonical value to an explicit customer-facing risk treatment; never assume a three-value enum.'],
        ['RequiresAdmin / RequiresRestart', 'Boolean', 'Drive admin readiness, confirmation, and restart messaging from canonical flags.'],
        ['OfflineCapability', 'String enum', 'Display the canonical capability state without claiming unavailable offline support.'],
        ['BackupMethod / RollbackMethod', 'String', 'Show only the canonical recovery information available for the selected tool.'],
        ['AnalyzeOnlySupported / WhatIfSupported', 'Boolean', 'Expose the relevant action only when its canonical capability is true.'],
        ['TestResult', 'String enum', 'Use only as verified diagnostic or developer evidence; do not fabricate execution results.'],
      ], [2300, 2500, 4800]),

    heading2('22.3 Verified Tool Index — All 100 Manifest Records'),
    buildTable(
      ['ToolId', 'EnglishName', 'Category', 'RiskLevel', 'RequiresAdmin', 'AnalyzeOnly', 'WhatIf'],
      canonicalToolRows(),
      [1100, 2350, 1750, 1450, 1150, 1100, 1000]
    ),

    heading2('22.4 Canonical Per-Tool Records — All Fields'),
    ...canonicalToolDetailBlocks(),
    pageBreak(),
  ];
}

function finalSection() {
  return [
    heading1('APPENDIX A — LIGHT MODE VISUAL SUMMARY'),
    para('Light mode is NOT dark mode with white swapped in. It is a completely separate visual profile.'),
    buildTable(['Visual Aspect', 'Dark Mode', 'Light Mode'],
      [
        ['Shell background', '#0E0F13 (near-black)', '#ECEFF6 (cool blue-tinted off-white)'],
        ['Primary surface', '#13151C', '#F5F7FC'],
        ['Elevated surface', '#1A1D27', '#FFFFFF with shadow'],
        ['Elevation cue', 'Luminous highlight lines at top edges', 'Soft shadow at bottom edges'],
        ['Accent', '#2C7BE5', '#1A6ED8 (more saturated for light bg)'],
        ['Console background', '#0E0F13 (always dark)', '#0E0F13 (always dark — console never inverts)'],
        ['Shadow intensity', 'Heavy (contrast vs dark bg)', 'Subtle (surface color change provides contrast)'],
        ['Overall feel', 'Premium workstation, dark environment', 'Clean, enterprise tool — Windows 11 Settings-like'],
      ], [2500, 2800, 3700]),

    heading1('APPENDIX B — DARK MODE vs LIGHT MODE CHECKLIST'),
    bullet('ThemeService.IsGlassEnabled path works in both modes'),
    bullet('All Color.* tokens resolve correctly in both Light.xaml and Colors.xaml'),
    bullet('Sidebar background correct in both modes'),
    bullet('Console background remains dark in both modes (NEVER inverts)'),
    bullet('Shadow directions correct: luminous highlights dark, drop shadows light'),
    bullet('All status badges readable in both modes'),
    bullet('Risk badges readable in both modes'),
    bullet('Focus indicators visible in both modes'),
    bullet('All icons visible in both modes (test against both backgrounds)'),

    heading1('APPENDIX C — GLOSSARY'),
    buildTable(['Term', 'Definition'],
      [
        ['Glass Nexus', 'KNOUX Repair visual direction: dark solid base, surgical translucency at surface intersections, glass accent at floating elements'],
        ['Surface Type 0–4', 'Five elevation tiers defined in Section 02. Every visible area belongs to exactly one.'],
        ['Glass Top Accent', '1px highlight line at top edge of elevated/glass surfaces — simulates top-down ambient light'],
        ['DIP', 'Device-Independent Pixel — WPF unit. 1 DIP = 1/96 inch regardless of display DPI.'],
        ['ToolId', 'Unique technical identifier per tool from manifest. Never a heading. Always muted.'],
        ['Bridge', 'Execution mechanism that runs PowerShell scripts. State: Online or Offline.'],
        ['RiskLevel', 'Canonical manifest enum: READ_ONLY, SAFE_CLEANUP, DESTRUCTIVE. Separate from customer-facing label.'],
        ['Indeterminate progress', 'Animated progress bar with no fixed endpoint — used when step count is unknown.'],
        ['FlowDirection', 'WPF property controlling LTR/RTL layout. Set at Window level to propagate.'],
        ['IsGlassEnabled', 'ThemeService boolean. False = Simulated Glass fallback. True = real translucency.'],
      ], [2000, 7000]),
    pageBreak(),
  ];
}

// ============================================================================
//  BUILD DOCUMENT
// ============================================================================

async function build() {
  const children = [
    ...coverPage(),
    ...section01(),
    ...section02(),
    ...section03(),
    ...section04(),
    ...section05(),
    ...section06(),
    ...section07(),
    ...section08(),
    ...section09(),
    ...section10(),
    ...section11(),
    ...section12(),
    ...section13(),
    ...section14(),
    ...section15(),
    ...section16(),
    ...section17(),
    ...section18(),
    ...section19(),
    ...section20(),
    ...section21(),
    ...section22(),
    ...finalSection(),
  ];

  const doc = new Document({
    creator: 'KNOUX Specification System',
    title: 'KNOUX Repair v2.0.2 — Master Visual Specification',
    description: 'Implementation-grade Glass Nexus WPF visual specification',
    styles: {
      default: {
        document: {
          run: { font: 'Segoe UI', size: 22, color: C.nearBlack },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 36, bold: true, color: C.headingBg, font: 'Segoe UI' },
          paragraph: { spacing: { before: 480, after: 200 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 28, bold: true, color: C.accentBlue, font: 'Segoe UI' },
          paragraph: { spacing: { before: 360, after: 120 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 24, bold: true, color: C.headingBg, font: 'Segoe UI' },
          paragraph: { spacing: { before: 240, after: 80 } },
        },
        {
          id: 'Heading4',
          name: 'Heading 4',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 22, bold: true, color: C.nearBlack, font: 'Segoe UI' },
          paragraph: { spacing: { before: 200, after: 60 } },
        },
      ],
    },
    numbering: {
      config: [{
        reference: 'bullet-list',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 180 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 180 } } } },
        ],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'KNOUX Repair v2.0.2 — Master Visual Specification — Glass Nexus', size: 18, color: C.textMuted, font: 'Segoe UI' }),
            ],
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.tableBorder, space: 4 } },
            alignment: AlignmentType.LEFT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'AUTHORITATIVE — STATUS: Canonical manifest validated and embedded    |    Page ', size: 18, color: C.textMuted, font: 'Segoe UI' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.textMuted, font: 'Segoe UI' }),
              new TextRun({ text: ' of ', size: 18, color: C.textMuted, font: 'Segoe UI' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: C.textMuted, font: 'Segoe UI' }),
            ],
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: C.tableBorder, space: 4 } },
          })],
        }),
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log('Written:', outputPath, Math.round(buffer.length / 1024) + 'KB');
}

build().catch(e => { console.error(e); process.exit(1); });
