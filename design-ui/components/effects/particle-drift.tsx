"use client";

import { useEffect, useRef, type CSSProperties } from "react";

export interface ParticleDriftProps {
  className?: string;
  style?: CSSProperties;
  density?: number;
  speed?: number;
  accent?: string;
}

type DriftNode = { x: number; y: number; vy: number; char: string };
type DriftBeam = { x: number; y: number; length: number; speed: number; opacity: number };

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*()".split("");

export function ParticleDrift({
  className = "",
  style,
  density = 1,
  speed = 1,
  accent = "#60A5FA",
}: ParticleDriftProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 1;
    let height = 1;
    let nodes: DriftNode[] = [];
    let beams: DriftBeam[] = [];
    let frame = 0;
    let visible = true;
    let last = performance.now();
    const mouse = { x: -1000, y: -1000 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const parseHex = (hex: string) => {
      const value = hex.replace("#", "");
      if (!/^[0-9a-fA-F]{6}$/.test(value)) return [96, 165, 250];
      return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16),
      ];
    };
    const [r, g, b] = parseHex(accent);

    const initParticles = () => {
      const nodeCount = Math.max(12, Math.round(90 * density));
      const beamCount = Math.max(4, Math.round(25 * density));
      nodes = Array.from({ length: nodeCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vy: Math.random() * 0.4 + 0.1,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
      }));
      beams = Array.from({ length: beamCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        length: Math.random() * 100 + 50,
        speed: Math.random() * 6 + 3,
        opacity: Math.random() * 0.5 + 0.3,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const nextWidth = Math.max(1, Math.round(width * dpr));
      const nextHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        initParticles();
      }
    };

    const draw = (now: number) => {
      resize();
      const dt = Math.min((now - last) / 16.6667, 2);
      last = now;
      ctx.clearRect(0, 0, width, height);

      for (const beam of beams) {
        if (!reducedMotion) beam.y -= beam.speed * speed * dt;
        if (beam.y + beam.length < 0) {
          beam.y = height + 100;
          beam.x = Math.random() * width;
        }
        const gradient = ctx.createLinearGradient(beam.x, beam.y, beam.x, beam.y + beam.length);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${beam.opacity})`);
        gradient.addColorStop(1, "transparent");
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(beam.x, beam.y);
        ctx.lineTo(beam.x, beam.y + beam.length);
        ctx.stroke();
      }

      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 0.5;

      const linkDistance = 120;
      for (let i = 0; i < nodes.length; i += 1) {
        const first = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const second = nodes[j];
          const distance = Math.hypot(first.x - second.x, first.y - second.y);
          if (distance < linkDistance) {
            ctx.strokeStyle = `rgba(156, 163, 175, ${0.15 * (1 - distance / linkDistance)})`;
            ctx.beginPath();
            ctx.moveTo(first.x, first.y);
            ctx.lineTo(second.x, second.y);
            ctx.stroke();
          }
        }
      }

      for (const node of nodes) {
        if (!reducedMotion) node.y += node.vy * speed * dt;
        if (node.y > height + 20) {
          node.y = -20;
          node.x = Math.random() * width;
        }

        const distance = Math.hypot(mouse.x - node.x, mouse.y - node.y);
        if (distance < 180 || (!reducedMotion && Math.random() > 0.98)) {
          node.char = CHARS[Math.floor(Math.random() * CHARS.length)];
        }

        if (distance < 180) {
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.5 * (1 - distance / 180)})`;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        ctx.fillStyle = distance < 180 ? accent : "rgba(156, 163, 175, 0.45)";
        ctx.fillText(node.char, node.x, node.y);
      }

      if (!reducedMotion && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    };
    const handlePointerLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (!visible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (visible && !document.hidden && !reducedMotion && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    }, { threshold: 0.02 });

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw(performance.now());
    });

    const handleVisibility = () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!document.hidden && visible && !reducedMotion && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    document.addEventListener("visibilitychange", handleVisibility);
    observer.observe(canvas);
    resizeObserver.observe(canvas);
    resize();
    if (reducedMotion) draw(performance.now());
    else frame = requestAnimationFrame(draw);

    return () => {
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      document.removeEventListener("visibilitychange", handleVisibility);
      observer.disconnect();
      resizeObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [accent, density, speed]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", ...style }}
      aria-hidden="true"
    />
  );
}
