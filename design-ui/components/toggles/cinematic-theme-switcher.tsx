'use client';

import { Sun, Moon } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  id: number;
  delay: number;
  duration: number;
}

export interface CinematicThemeSwitcherProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export function CinematicThemeSwitcher({
  checked,
  defaultChecked = false,
  onCheckedChange,
}: CinematicThemeSwitcherProps) {
  const [internal, setInternal] = useState(defaultChecked);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const isDark = checked ?? internal;

  const generateParticles = () => {
    const newParticles: Particle[] = [];
    const particleCount = 3;

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        delay: i * 0.1,
        duration: 0.6 + i * 0.1,
      });
    }

    setParticles(newParticles);
    setIsAnimating(true);

    setTimeout(() => {
      setIsAnimating(false);
      setParticles([]);
    }, 1000);
  };

  const handleToggle = () => {
    generateParticles();
    const next = !isDark;
    if (checked === undefined) setInternal(next);
    onCheckedChange?.(next);
  };

  return (
    <div className="relative inline-block">
      <motion.button
        ref={toggleRef}
        onClick={handleToggle}
        className="relative flex h-[64px] w-[104px] items-center rounded-full p-[6px] transition-all duration-300 focus:outline-none"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at top left, #1e293b 0%, #0f172a 40%, #020617 100%)'
            : 'radial-gradient(ellipse at top left, #ffffff 0%, #f1f5f9 40%, #cbd5e1 100%)',
          boxShadow: isDark
            ? 'inset 5px 5px 12px rgba(0, 0, 0, 0.9), inset -5px -5px 12px rgba(71, 85, 105, 0.4), 0 8px 32px rgba(0, 0, 0, 0.6)'
            : 'inset 5px 5px 12px rgba(148, 163, 184, 0.5), inset -5px -5px 12px rgba(255, 255, 255, 1), 0 8px 32px rgba(0, 0, 0, 0.18)',
          border: isDark
            ? '2px solid rgba(51, 65, 85, 0.6)'
            : '2px solid rgba(203, 213, 225, 0.6)',
        }}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        role="switch"
        aria-checked={isDark}
        whileTap={{ scale: 0.98 }}
      >
        <div className="absolute inset-0 flex items-center justify-between px-4">
          <Sun size={20} className={isDark ? 'text-yellow-100' : 'text-amber-600'} />
          <Moon size={20} className={isDark ? 'text-yellow-100' : 'text-slate-700'} />
        </div>

        <motion.div
          className="relative z-10 flex h-[44px] w-[44px] items-center justify-center rounded-full overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(145deg, #64748b 0%, #475569 50%, #334155 100%)'
              : 'linear-gradient(145deg, #ffffff 0%, #fefefe 50%, #f8fafc 100%)',
            boxShadow: isDark
              ? 'inset 2px 2px 4px rgba(100, 116, 139, 0.4), inset -2px -2px 4px rgba(0, 0, 0, 0.8), 0 8px 32px rgba(0, 0, 0, 0.6)'
              : 'inset 2px 2px 4px rgba(203, 213, 225, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 1), 0 8px 32px rgba(0, 0, 0, 0.18)',
            border: isDark
              ? '2px solid rgba(148, 163, 184, 0.3)'
              : '2px solid rgba(255, 255, 255, 0.9)',
          }}
          animate={{ x: isDark ? 46 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {isAnimating && particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: '10px',
                  height: '10px',
                  background: isDark
                    ? 'radial-gradient(circle, rgba(147, 197, 253, 0.5) 0%, rgba(147, 197, 253, 0) 70%)'
                    : 'radial-gradient(circle, rgba(251, 191, 36, 0.7) 0%, rgba(251, 191, 36, 0) 70%)',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: isDark ? 6 : 8, opacity: [0, 1, 0] }}
                transition={{ duration: particle.duration, delay: particle.delay, ease: 'easeOut' }}
              />
            </motion.div>
          ))}

          <div className="relative z-10">
            {isDark ? (
              <Moon size={20} className="text-yellow-200" />
            ) : (
              <Sun size={20} className="text-amber-500" />
            )}
          </div>
        </motion.div>
      </motion.button>
    </div>
  );
}

export default CinematicThemeSwitcher;
