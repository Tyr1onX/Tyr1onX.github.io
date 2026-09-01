"use client";

import React, { useEffect, useRef } from "react";

export interface OceanicCurrentsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Animation speed multiplier. */
  speed?: number;
}

const VERTEX_SHADER = `
attribute vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;

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
  mat2 rotation = mat2(0.80, 0.60, -0.60, 0.80);

  for (int i = 0; i < 6; i++) {
    value += amplitude * noise(p);
    p = rotation * p * 2.03 + vec2(11.7, 7.9);
    amplitude *= 0.5;
  }

  return value;
}

vec3 palette(float x) {
  vec3 deep = vec3(0.0118, 0.1098, 0.1490);   // #031C26
  vec3 blue = vec3(0.1059, 0.4235, 0.6588);   // #1B6CA8
  vec3 cyan = vec3(0.3529, 0.8235, 0.9569);   // #5AD2F4
  vec3 foam = vec3(0.9176, 0.9765, 1.0000);   // #EAF9FF

  vec3 color = mix(deep, blue, smoothstep(0.08, 0.48, x));
  color = mix(color, cyan, smoothstep(0.42, 0.72, x));
  color = mix(color, foam, smoothstep(0.72, 0.97, x));
  return color;
}

void main() {
  vec2 resolution = max(u_resolution, vec2(1.0));
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
  float t = u_time * 0.085;

  uv *= 1.18;
  uv.x += 0.10 * sin(uv.y * 1.35 + t * 0.75);
  uv.y += 0.06 * cos(uv.x * 1.10 - t * 0.55);

  vec2 q = vec2(
    fbm(uv + vec2(0.0, t)),
    fbm(uv + vec2(5.2, 1.3) - vec2(t * 0.58, t * 0.22))
  );

  vec2 r = vec2(
    fbm(uv + 1.65 * q + vec2(1.7, 9.2) + vec2(t * 0.34, -t * 0.52)),
    fbm(uv + 1.65 * q + vec2(8.3, 2.8) + vec2(-t * 0.46, t * 0.28))
  );

  float smoke = fbm(uv + 2.05 * r);
  float broad = fbm(uv * 0.58 + r * 0.82 + vec2(-t * 0.14, t * 0.21));
  float filament = fbm(uv * 2.1 + r * 1.45 - q * 0.75);

  float field = smoke * 0.58 + broad * 0.34 + filament * 0.08;
  field += 0.055 * sin((uv.x - uv.y) * 2.4 + t * 2.0 + smoke * 5.0);

  vec3 color = palette(clamp(field, 0.0, 1.0));

  float ridge = 1.0 - abs(filament * 2.0 - 1.0);
  ridge = smoothstep(0.72, 0.98, ridge) * smoothstep(0.46, 0.82, field);
  color += vec3(0.12, 0.32, 0.40) * ridge * 0.32;

  float vignette = 1.0 - smoothstep(0.55, 1.55, length(uv * vec2(0.82, 0.68)));
  color *= 0.80 + 0.20 * vignette;

  gl_FragColor = vec4(color, 1.0);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Oceanic Currents
 *
 * Independent zero-dependency WebGL implementation based on the public
 * description and palette of Serafim's 21st.dev Shader Builder preset:
 * https://21st.dev/@serafimcloud/components/oceanic-currents
 * Shader source from 21st's paid Code view is not copied here.
 */
export function OceanicCurrents({
  className,
  style,
  speed = 1,
  ...props
}: OceanicCurrentsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "a_position");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startedAt = performance.now();
    let animationFrame = 0;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      gl.viewport(0, 0, width, height);
    };

    const draw = (now: number) => {
      resize();
      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, ((now - startedAt) / 1000) * speed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!reduceMotion && visible) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      const wasVisible = visible;
      visible = entry?.isIntersecting ?? true;
      if (visible && !wasVisible && !reduceMotion) {
        animationFrame = requestAnimationFrame(draw);
      }
      if (!visible && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    });
    intersectionObserver.observe(canvas);

    draw(performance.now());

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [speed]);

  return (
    <div
      className={className}
      style={{ position: "relative", overflow: "hidden", ...style }}
      {...props}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}

export const ShaderBackground = OceanicCurrents;
