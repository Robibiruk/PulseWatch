import React from 'react';
import './styles.css';

/** Uiverse "blob triangles" loader (andrew-manzyk), as plain CSS — no styled-components. */
export default function PulseLoader({size = 1}: {size?: number}) {
  return (
    <div className="pw-loader" style={{['--size' as string]: size}} role="status" aria-label="Loading">
      <svg width={100} height={100} viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <mask id="pw-clip">
            <polygon points="0,0 100,0 100,100 0,100" fill="black" />
            <polygon points="25,25 75,25 50,75" fill="white" />
            <polygon points="50,25 75,75 25,75" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
            <polygon points="35,35 65,35 50,65" fill="white" />
          </mask>
        </defs>
      </svg>
      <div className="box" />
    </div>
  );
}
