import React, {useEffect, useState} from 'react';
import './styles.css';

const REPO = 'Robibiruk/PulseWatch';
const KEY = 'pw-stars';

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

function useStars() {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.t < 600000) { setStars(c.n); return; }
    } catch {}
    const ctl = new AbortController();
    fetch(`https://api.github.com/repos/${REPO}`, {signal: ctl.signal})
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.stargazers_count === 'number') {
          setStars(d.stargazers_count);
          try { sessionStorage.setItem(KEY, JSON.stringify({n: d.stargazers_count, t: Date.now()})); } catch {}
        }
      })
      .catch(() => {});
    return () => ctl.abort();
  }, []);
  return stars;
}

export default function GitHubStar({variant = 'nav'}: {variant?: 'nav' | 'hero'}) {
  const stars = useStars();
  return (
    <a className={`pw-star pw-star--${variant}`} href={`https://github.com/${REPO}`} target="_blank" rel="noopener noreferrer"
       aria-label={`Star ${REPO} on GitHub${stars != null ? `, ${stars} stars` : ''}`}>
      <span className="pw-star-l">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>
        Star
      </span>
      <span className="pw-star-r">{stars != null ? fmt(stars) : 'GitHub'}</span>
    </a>
  );
}
