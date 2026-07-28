import { CSSProperties } from "react";

// UI-suited loading indicator (ported from a styled-components snippet to plain
// CSS/React). Animated polyline "tracer" — front stroke uses the app primary
// (white), back track a translucent white, so it matches the monochrome theme.
export default function Loader({ size = 64 }: { size?: number }) {
  const style = { width: size, height: (size * 48) / 64 } as CSSProperties;
  const points = "0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24";
  return (
    <div className="pw-loading" role="status" aria-label="Loading" style={style}>
      <svg width="64px" height="48px" viewBox="0 0 64 48">
        <polyline points={points} className="pw-loading-back" />
        <polyline points={points} className="pw-loading-front" />
      </svg>
    </div>
  );
}
