import React, {useEffect, useRef, useState, type ReactNode} from 'react';
import {useLocation} from '@docusaurus/router';
import PulseLoader from '@site/src/components/PulseLoader';

export default function Root({children}: {children: ReactNode}) {
  const {pathname} = useLocation();
  const [boot, setBoot] = useState<'show' | 'done' | 'gone'>('show');
  const bar = useRef<HTMLDivElement>(null);

  /* First visit per session: show the loader briefly. A head script sets
     html[data-booted] before paint on repeat visits / reduced motion. */
  useEffect(() => {
    if (document.documentElement.hasAttribute('data-booted')) { setBoot('gone'); return; }
    const a = setTimeout(() => setBoot('done'), 1200);
    const b = setTimeout(() => {
      setBoot('gone');
      try { sessionStorage.setItem('pw-booted', '1'); } catch {}
    }, 1800);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  /* Reading progress */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = 0;
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, h.scrollTop / max) : 0})`;
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', on, {passive: true});
    on();
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [pathname]);

  /* Scroll reveal for [data-reveal] */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((e) => e.classList.add('pw-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('pw-in'); io.unobserve(e.target); } });
    }, {threshold: 0.12, rootMargin: '0px 0px -8% 0px'});
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [pathname]);

  return (
    <>
      <div className="pw-progress" aria-hidden="true"><div ref={bar} /></div>
      {boot !== 'gone' && (
        <div className={`pw-boot ${boot === 'done' ? 'done' : ''}`} aria-hidden={boot === 'done'}>
          <PulseLoader />
          <span className="pw-boot-word">PulseWatch docs</span>
        </div>
      )}
      {children}
    </>
  );
}
