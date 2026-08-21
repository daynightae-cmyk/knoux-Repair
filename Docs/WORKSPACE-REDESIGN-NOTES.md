# Workspaces Redesign Notes

## Goal
Transform the current **KNOUX REPAIR // NEXUS CORE** desktop React/Electron interface into a workspace-management dashboard inspired by the user-provided Figma reference, while retaining the application’s dark, technical identity and existing tool execution workflow.

## Visual reference

The user provided Figma file `Workspace Table (Community)`, node `1:1614`:

- https://www.figma.com/design/e5R8nPrbTeUBBQ6DUixOCY/Workspace-Table--Community-?node-id=1-1614

The direct board was loading in the browser at review time, while the supplied screenshot clearly establishes the intended hierarchy: a slim left navigation column, a main "Workspaces" title bar, a primary data table, and collapsed status groups below it.

## Required adaptation for KNOUX REPAIR

| Reference element | KNOUX adaptation |
| --- | --- |
| Workspaces page title | `مساحات العمل` / `Workspaces` |
| Add Workspace button | `مساحة عمل جديدة` creates a local workspace record |
| Organization rows | Repair workspaces or project workspaces, such as Project Sonar, System Care, Security Review, and Recovery Hub |
| Active Users metric | Tool count / available operations |
| Chargebee ID | Workspace code / selected project |
| Renewal Date | Last activity / last diagnostic run |
| Paid, Unpaid, Expired groups | Active, Pinned, and Archived workspace groups |
| Left navigation | Existing repair categories plus Workspaces, Reports, Settings, and Support |

## Existing application constraints

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS.
- Desktop wrapper: Electron.
- Tool execution and run state are served by the local bridge and must continue to use `BridgeTool`, `api.startRun`, `api.getRun`, and `api.cancelRun`.
- Language direction must remain bilingual and preserve Arabic RTL support.
- The redesign should be implemented as an additive dashboard view, not by deleting the existing category/tool-grid experience.

## Design direction

Use a dark graphite surface, restrained cyan accents, soft separators, compact data-table density, readable Arabic typography, and a responsive sidebar. Avoid copying Marriott branding, organization names, imagery, or commercial data from the reference.

## Component plan

The implementation will add an independent `WorkspaceDashboard` React component with the following contract:

| Element | Behaviour |
| --- | --- |
| Workspace search | Filters active workspace rows by bilingual name, code, and linked repair domain. |
| Sort control | Cycles rows by workspace name, available operations, or last activity. |
| Status groups | Keeps Active expanded, with Pinned and Archived as collapsible overview groups. |
| Row action | Opens the repair category already mapped to the workspace in the existing tool grid. |
| Add workspace | Adds a local workspace row for the session without touching bridge data or scripts. |
| Sidebar entry | Returns to the Workspaces dashboard while the existing category entries continue to open their live tools. |

## Interaction and accessibility decisions

All buttons will use native button semantics, visible keyboard focus, compact but readable hit targets, and `aria-expanded` on collapsible workspace groups. The dashboard will use CSS logical properties and a mirrored layout under Arabic RTL. Desktop density targets the existing Electron view, while the table converts to labelled stacked rows on narrow windows.

## Local visual-check finding

The local browser review confirmed that the new Workspaces navigation entry is rendered. It also revealed that the application’s existing offline-bridge fallback currently replaces the main content when the local bridge is unavailable. The Workspaces dashboard is a navigation and management surface and does not need a live bridge to render, so the final integration must preserve the dashboard in offline mode while limiting the offline fallback to the live tool-grid view.

## Final visual-check result

After dismissing the splash screen, the Workspaces dashboard rendered correctly in the local Electron-sized browser viewport. The left navigation includes the new active Workspaces entry, the main panel presents a dark compact workspace table, state summaries, an Add Workspace action, search/sort controls, and collapsed Pinned and Archived groups. Existing repair categories remain in the sidebar. With the local bridge offline, live tool totals correctly show zero; the dashboard itself remains available.

## Interaction and RTL-check result

The Add Workspace action was verified: it adds an active local workspace and increments the active summary count. The Arabic language toggle was also verified: sidebar labels, page copy, table headings, row data, actions, and layout direction all switch to Arabic RTL while preserving the workspace table structure.
