import NexusSplash from './NexusSplash';

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Compatibility wrapper for the legacy splash entry point.
 * The application mounts NexusSplash directly, but any older caller that still
 * imports SplashScreen receives the same premium boot experience instead of the
 * retired grid/scanline presentation.
 */
export default function SplashScreen({ onComplete }: SplashScreenProps) {
  return (
    <NexusSplash
      visible
      onDone={onComplete}
      lang="en"
      bridgeOnline={null}
      toolCount={0}
    />
  );
}
