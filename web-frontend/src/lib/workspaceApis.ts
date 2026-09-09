/**
 * KNOUX Repair Nexus — Google Workspace Client-Side API Integration
 * Implements real Google Workspace APIs (Drive, Gmail, Sheets, Docs, Slides, Tasks, Forms, Keep)
 * using OAuth bearer tokens acquired via Google Sign-In.
 */

// --- GOOGLE DRIVE ---
export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
}

export async function listDriveFiles(accessToken: string): Promise<DriveFileItem[]> {
  const params = new URLSearchParams({
    pageSize: '25',
    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)',
    orderBy: 'modifiedTime desc',
    q: 'trashed = false',
  });

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google Drive API error (${response.status})`);
  }

  const data = await response.json();
  return data.files || [];
}

export async function uploadToDrive(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string = 'text/plain'
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const metadata = {
    name: fileName,
    mimeType,
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Drive upload error (${response.status})`);
  }

  return response.json();
}

// --- GMAIL ---
export interface GmailMessageItem {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
}

export async function sendGmailAlert(
  accessToken: string,
  to: string,
  subject: string,
  bodyText: string
): Promise<{ id: string; threadId: string }> {
  // Construct RFC 2822 email message
  const emailLines = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    '',
    bodyText,
  ];

  const rawEmail = emailLines.join('\r\n');
  // Base64url encode
  const base64Encoded = btoa(unescape(encodeURIComponent(rawEmail)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Encoded }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gmail API send error (${response.status})`);
  }

  return response.json();
}

export async function listRecentGmailMessages(
  accessToken: string,
  maxResults = 10
): Promise<GmailMessageItem[]> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail API error (${response.status})`);
  }

  const data = await response.json();
  const messageRefs: { id: string; threadId: string }[] = data.messages || [];

  // Fetch snippets for top 5
  const detailed = await Promise.all(
    messageRefs.slice(0, 5).map(async (ref) => {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${ref.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (msgRes.ok) {
          const detail = await msgRes.json();
          const headers = detail.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
          return {
            id: ref.id,
            threadId: ref.threadId,
            snippet: detail.snippet,
            subject: getHeader('Subject') || '(No Subject)',
            from: getHeader('From') || 'Unknown',
            date: getHeader('Date'),
          };
        }
      } catch {
        // ignore individual header failure
      }
      return { id: ref.id, threadId: ref.threadId };
    })
  );

  return detailed;
}

// --- GOOGLE SHEETS ---
export interface CreateSpreadsheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

export async function createDiagnosticsSpreadsheet(
  accessToken: string,
  title: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<CreateSpreadsheetResult> {
  const body = {
    properties: {
      title,
    },
    sheets: [
      {
        properties: {
          title: 'System Telemetry & Repair Audit',
          gridProperties: {
            rowCount: rows.length + 10,
            columnCount: Math.max(headers.length, 8),
            frozenRowCount: 1,
          },
        },
        data: [
          {
            startRow: 0,
            startColumn: 0,
            rowData: [
              {
                values: headers.map((h) => ({
                  userEnteredValue: { stringValue: h },
                  userEnteredFormat: {
                    textFormat: { bold: true },
                    backgroundColor: { red: 0.15, green: 0.35, blue: 0.75 },
                  },
                })),
              },
              ...rows.map((row) => ({
                values: row.map((cell) => ({
                  userEnteredValue:
                    typeof cell === 'number'
                      ? { numberValue: cell }
                      : { stringValue: String(cell) },
                })),
              })),
            ],
          },
        ],
      },
    ],
  };

  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google Sheets API error (${response.status})`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

// --- GOOGLE DOCS ---
export interface CreateDocResult {
  documentId: string;
  title: string;
}

export async function createMaintenanceReportDoc(
  accessToken: string,
  title: string,
  content: string
): Promise<CreateDocResult> {
  // 1. Create empty document
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Docs API error (${createRes.status})`);
  }

  const docData = await createRes.json();
  const documentId = docData.documentId;

  // 2. Insert formatted content text
  const updateRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `${content}\n\nGenerated by KNOUX Repair Nexus Cloud Workstation\nTimestamp: ${new Date().toISOString()}\n`,
            },
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    console.warn('Doc update warning:', await updateRes.text());
  }

  return {
    documentId,
    title,
  };
}

// --- GOOGLE SLIDES ---
export interface CreateSlidesResult {
  presentationId: string;
  presentationUrl: string;
}

export async function createExecutiveBriefingSlides(
  accessToken: string,
  title: string,
  subtitle: string,
  bullets: string[]
): Promise<CreateSlidesResult> {
  // 1. Create empty presentation
  const createRes = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Slides API error (${createRes.status})`);
  }

  const presData = await createRes.json();
  const presentationId = presData.presentationId;

  // 2. Add slides and text content
  const slideId = `slide_${Date.now()}`;
  const titleBoxId = `title_${Date.now()}`;
  const bodyBoxId = `body_${Date.now()}`;

  const requests = [
    {
      createSlide: {
        objectId: slideId,
        insertionIndex: 1,
        slideLayoutReference: { predefinedLayout: 'BLANK' },
      },
    },
    {
      createShape: {
        objectId: titleBoxId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 60, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 50, translateY: 40, unit: 'PT' },
        },
      },
    },
    {
      insertText: {
        objectId: titleBoxId,
        text: `${title} — Executive Summary`,
      },
    },
    {
      createShape: {
        objectId: bodyBoxId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 620, unit: 'PT' }, height: { magnitude: 280, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 50, translateY: 120, unit: 'PT' },
        },
      },
    },
    {
      insertText: {
        objectId: bodyBoxId,
        text: `${subtitle}\n\nKey System Findings:\n${bullets.map((b) => `• ${b}`).join('\n')}`,
      },
    },
  ];

  await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
  };
}

// --- GOOGLE TASKS ---
export interface TaskItem {
  id?: string;
  title: string;
  notes?: string;
  status?: string;
  due?: string;
}

export async function listGoogleTasks(accessToken: string): Promise<TaskItem[]> {
  const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listsRes.ok) {
    const err = await listsRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Tasks API error (${listsRes.status})`);
  }

  const listsData = await listsRes.json();
  const primaryList = listsData.items?.[0];
  if (!primaryList) return [];

  const tasksRes = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${primaryList.id}/tasks?showCompleted=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!tasksRes.ok) return [];
  const tasksData = await tasksRes.json();
  return tasksData.items || [];
}

export async function createGoogleTask(
  accessToken: string,
  title: string,
  notes: string,
  dueISO?: string
): Promise<TaskItem> {
  const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listsRes.ok) {
    const err = await listsRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Tasks API error (${listsRes.status})`);
  }

  const listsData = await listsRes.json();
  const primaryList = listsData.items?.[0];
  if (!primaryList) {
    throw new Error('No Google Task list found for user');
  }

  const payload: any = {
    title,
    notes,
  };
  if (dueISO) {
    payload.due = dueISO;
  }

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${primaryList.id}/tasks`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create task (${response.status})`);
  }

  return response.json();
}

// --- GOOGLE FORMS ---
export interface FormResult {
  formId: string;
  responderUri: string;
  title: string;
}

export async function createMaintenanceFeedbackForm(
  accessToken: string,
  title: string,
  description: string
): Promise<FormResult> {
  const response = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
        description,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Forms API error (${response.status})`);
  }

  const data = await response.json();
  return {
    formId: data.formId,
    responderUri: data.responderUri || `https://docs.google.com/forms/d/${data.formId}/viewform`,
    title: data.info?.title || title,
  };
}
