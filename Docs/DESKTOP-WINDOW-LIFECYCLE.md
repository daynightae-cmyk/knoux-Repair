# Desktop window lifecycle — the reference that keeps the window alive

**Status:** VERIFIED — the shipped implementation lives in `web-frontend/desktop/main.cjs`.

## Why this note exists

An earlier working draft of the desktop runtime fix was saved as
`web-frontend/src/components/shell/shell-truthfulness.css`. That file was
never valid CSS: it carried TypeScript/Electron source inside a `.css`
extension, so it could never be imported and never affected the build.

The draft is preserved here instead of being left in the source tree, because
the *content* is the canonical description of the fix: the `BrowserWindow`
reference must be held at module scope, otherwise the garbage collector can
reclaim it and the window disappears without an error.

## The rule

> A `BrowserWindow` that is only referenced from a local scope can be
> garbage collected while it is still on screen. Hold it at module scope.

## The shipped implementation

`web-frontend/desktop/main.cjs` already implements this:

- a module-level `let mainWindow = null;` holds the strong reference,
- `createWindow()` assigns the new window to it,
- the window's `closed` handler clears it only when it is still the same
  window (`if (mainWindow === window) mainWindow = null;`).

## The preserved draft

```ts
/**
 * KNOuX Repair — Desktop Runtime
 * Shell window management and process lifecycle.
 *
 * The window management fixes address a critical bug where the
 * application window would disappear due to garbage collection
 * of the BrowserWindow reference. A module-level reference is now
 * maintained to prevent garbage collection.
 */

import { BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function createWindow(frontendOrigin: string, bridgeState: BridgeState): void {
  // ...existing window creation code...
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
```

This draft is a description of the rule, not a second implementation. The
runtime keeps exactly one implementation, in `desktop/main.cjs`.
