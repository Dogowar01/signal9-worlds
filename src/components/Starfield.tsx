import { useEffect, useRef } from 'react';

interface Star { x: number; y: number; r: number; phase: number; speed: number; drift: number }

/** Softly twinkling stars with the odd shooting star. Static when the user prefers reduced motion. */
export function Starfield({ density = 0.00016, className = '' }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let stars: Star[] = [];
    let w = 0, h = 0, raf = 0, frame = 0;
    let color = '255,255,255';
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;

    const readColor = () => {
      const c = getComputedStyle(canvas).color.match(/\d+/g);
      if (c) color = `${c[0]},${c[1]},${c[2]}`;
    };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(w * h * density);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() ** 3 * 1.6 + 0.35,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.4,
        drift: 0.02 + Math.random() * 0.05,
      }));
      readColor();
      draw(performance.now());
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? 0.6 : 0.25 + 0.75 * Math.abs(Math.sin(t / 1000 * s.speed + s.phase));
        ctx.fillStyle = `rgba(${color},${a * (0.35 + s.r / 3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        if (!reduce) {
          s.x += s.drift;
          if (s.x > w + 2) s.x = -2;
        }
      }
      if (shoot) {
        const tail = 14;
        const g = ctx.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * tail, shoot.y - shoot.vy * tail);
        g.addColorStop(0, `rgba(${color},${Math.min(1, shoot.life)})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(shoot.x, shoot.y);
        ctx.lineTo(shoot.x - shoot.vx * tail, shoot.y - shoot.vy * tail);
        ctx.stroke();
        shoot.x += shoot.vx;
        shoot.y += shoot.vy;
        shoot.life -= 0.018;
        if (shoot.life <= 0) shoot = null;
      }
    };
    const loop = (t: number) => {
      frame++;
      if (frame % 90 === 0) readColor();
      if (!shoot && Math.random() < 0.0025) {
        shoot = { x: Math.random() * w * 0.8 + w * 0.1, y: Math.random() * h * 0.4, vx: 5 + Math.random() * 3, vy: 1.5 + Math.random() * 1.5, life: 1 };
      }
      draw(t);
      raf = requestAnimationFrame(loop);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(loop);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [density]);

  return <canvas ref={ref} className={`starfield ${className}`} aria-hidden />;
}
