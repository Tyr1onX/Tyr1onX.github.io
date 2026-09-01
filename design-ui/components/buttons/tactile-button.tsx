"use client";

import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export interface TactileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

const VERTEX_SHADER = `
attribute vec2 p;
void main() {
  gl_Position = vec4(p, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_tilt;
uniform float u_slosh;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.04 + vec2(11.3, 7.1);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / max(u_res.y, 1.0);
  float x = uv.x * aspect;
  float time = u_time;
  float amplitude = 0.014 + u_slosh * 0.052;
  float surface = 0.54
    + u_tilt * (uv.x - 0.5) * 0.30
    + amplitude * sin(x * 5.1 + time * 4.6)
    + amplitude * 0.62 * sin(x * 9.7 - time * 6.8 + 1.7)
    + amplitude * 0.38 * sin(x * 14.3 + time * 8.9 + 4.2);

  float depth = surface - uv.y;
  float inside = smoothstep(-0.012, 0.012, depth);
  vec3 shell = mix(vec3(0.015, 0.035, 0.055), vec3(0.025, 0.065, 0.10), uv.y);
  vec3 liquid = mix(vec3(0.01, 0.22, 0.42), vec3(0.0, 0.92, 1.0), clamp(depth * 2.2 + 0.2, 0.0, 1.0));
  float caustic = fbm(vec2(x * 4.2, (uv.y + time * 0.14) * 4.2));
  liquid *= 0.78 + 0.38 * caustic;

  float edge = exp(-abs(depth) * 120.0);
  vec3 color = mix(shell, liquid, inside);
  color += vec3(0.25, 0.92, 1.0) * edge * (0.22 + u_slosh * 0.22);
  color += vec3(0.02, 0.12, 0.18) * pow(max(0.0, 1.0 - abs(uv.y - 0.87) * 7.0), 2.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function TactileButton({
  children = "SURGE",
  className = "",
  onPointerMove,
  onPointerLeave,
  onClick,
  ...props
}: TactileButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionRef = useRef({ tilt: 0, targetTilt: 0, slosh: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: true });
    if (!gl) return;

    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "u_res");
    const time = gl.getUniformLocation(program, "u_time");
    const tilt = gl.getUniformLocation(program, "u_tilt");
    const slosh = gl.getUniformLocation(program, "u_slosh");

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    let frame = 0;
    let start = performance.now();

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const draw = (now: number) => {
      resize();
      const state = interactionRef.current;
      state.tilt += (state.targetTilt - state.tilt) * 0.08;
      state.slosh *= 0.94;
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, reducedMotion ? 0.4 : (now - start) / 1000);
      gl.uniform1f(tilt, state.tilt);
      gl.uniform1f(slosh, state.slosh);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reducedMotion && visible && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && !document.hidden && !frame) {
        start = performance.now();
        frame = requestAnimationFrame(draw);
      }
      if (!visible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    }, { threshold: 0.05 });

    const handleVisibility = () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!document.hidden && visible && !frame && !reducedMotion) {
        start = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };

    observer.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibility);
    resize();
    if (reducedMotion) draw(performance.now());
    else frame = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      if (frame) cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, []);

  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={`tactile-button ${className}`}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        interactionRef.current.targetTilt = ((event.clientX - rect.left) / rect.width - 0.5) * 1.3;
        interactionRef.current.slosh = Math.min(1, interactionRef.current.slosh + 0.05);
        onPointerMove?.(event);
      }}
      onPointerLeave={(event) => {
        interactionRef.current.targetTilt = 0;
        onPointerLeave?.(event);
      }}
      onClick={(event) => {
        interactionRef.current.slosh = 1;
        onClick?.(event);
      }}
    >
      <canvas ref={canvasRef} className="tactile-button__canvas" aria-hidden="true" />
      <span className="tactile-button__gloss" aria-hidden="true" />
      <span className="tactile-button__label">
        {children}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>

      <style>{`
        .tactile-button {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 250px;
          height: 70px;
          padding: 0;
          overflow: hidden;
          border: 1px solid rgba(6, 182, 212, .32);
          border-radius: 18px;
          color: #e0faff;
          background: #050b11;
          box-shadow: 0 22px 44px rgba(4,24,36,.35), 0 3px 9px rgba(5,10,15,.4), inset 0 0 0 1px rgba(255,255,255,.05);
          cursor: pointer;
          transition: transform .3s ease, box-shadow .3s ease;
        }
        .tactile-button:hover { transform: translateY(-2px); box-shadow: 0 28px 56px rgba(6,182,212,.24), 0 4px 11px rgba(5,10,15,.45); }
        .tactile-button:active { transform: translateY(1px) scale(.985); }
        .tactile-button:focus-visible { outline: 2px solid #06b6d4; outline-offset: 5px; }
        .tactile-button__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        .tactile-button__gloss { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg,rgba(255,255,255,.09),transparent 35%,rgba(0,0,0,.1)); box-shadow: inset 0 1px rgba(255,255,255,.11); }
        .tactile-button__label { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; letter-spacing: .28em; text-indent: .28em; text-shadow: 0 1px 10px rgba(0,18,25,.85); pointer-events: none; }
        .tactile-button__label svg { width: 18px; height: 18px; opacity: .82; transition: transform .25s ease; }
        .tactile-button:hover .tactile-button__label svg { transform: translateX(3px); }
        @media (prefers-reduced-motion: reduce) { .tactile-button, .tactile-button__label svg { transition: none; } }
      `}</style>
    </button>
  );
}
