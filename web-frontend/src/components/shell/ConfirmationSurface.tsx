import type { BridgeTool, ExecutionMode, ToolRunConfirmation, ToolRunOptions } from '../../lib/api';
import ExecutionConfirmDialog from '../ExecutionConfirmDialog';

export interface ConfirmationSurfaceProps {
  tool: BridgeTool;
  mode: ExecutionMode;
  lang: 'en' | 'ar';
  onConfirm: (options: ToolRunOptions, confirmation: ToolRunConfirmation) => void;
  onCancel: () => void;
  initialOptions?: ToolRunOptions;
}

/**
 * The confirmation surface of the studio shell.
 *
 * The contract — typed phrase for destructive repairs, recovery
 * acknowledgement, five second safety delay for destructive runs — belongs
 * to the canonical `ExecutionConfirmDialog`. This wrapper only gives it the
 * studio's visual frame, so the product never has two confirmation
 * implementations.
 */
export default function ConfirmationSurface({
  tool,
  mode,
  lang,
  onConfirm,
  onCancel,
  initialOptions,
}: ConfirmationSurfaceProps) {
  return (
    <div className="knoux-confirmation-surface" data-role="confirmation-surface" data-tool-id={tool.ToolId}>
      <ExecutionConfirmDialog
        tool={tool}
        mode={mode}
        lang={lang}
        onConfirm={onConfirm}
        onCancel={onCancel}
        initialOptions={initialOptions}
      />
    </div>
  );
}
