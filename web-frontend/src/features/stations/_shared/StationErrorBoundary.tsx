import { Component, type ReactNode } from 'react';

interface StationErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: unknown) => void;
}

interface StationErrorBoundaryState {
  failed: boolean;
}

/** StationErrorBoundary — isolates a station crash from the shell. */
export default class StationErrorBoundary extends Component<StationErrorBoundaryProps, StationErrorBoundaryState> {
  state: StationErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): StationErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError?.(error);
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        this.props.fallback || (
          <div className="glass-panel rounded-xl p-6 text-center" role="alert">
            <p className="font-mono text-[11px] text-red-400 tracking-wider">STATION_UNAVAILABLE</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
