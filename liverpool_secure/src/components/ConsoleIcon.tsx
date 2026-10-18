import React from 'react';
import { DeviceType } from '../types';

interface ConsoleIconProps {
  type: DeviceType;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Liverpool Gaming - Transparent Vector Console Graphics
 * High-definition, completely transparent SVG models of PS5 and PS4
 * No ugly square backgrounds, renders instantly with zero external dependencies.
 */
export const ConsoleIcon: React.FC<ConsoleIconProps> = ({ type, className = '', size = 'md' }) => {
  const sizeMap = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const dimClass = sizeMap[size] || sizeMap.md;

  if (type === 'PS5') {
    return (
      <div className={`relative flex items-center justify-center select-none ${dimClass} ${className}`}>
        <svg
          viewBox="0 0 100 120"
          className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,100,255,0.3)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Ambient LED Glow */}
          <ellipse cx="50" cy="55" rx="35" ry="45" fill="url(#ps5BlueGlow)" opacity="0.4" />
          {/* Central Black Glossy Core Body */}
          <path
            d="M40 18 C 42 16, 58 16, 60 18 L 62 100 C 60 103, 40 103, 38 100 Z"
            fill="url(#ps5CoreGrad)"
          />
          {/* Glowing PS5 Blue LED Accent Strip */}
          <path
            d="M43 22 Q 44 60 42 98"
            stroke="#00e5ff"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.9"
            className="animate-pulse"
          />
          <path
            d="M57 22 Q 56 60 58 98"
            stroke="#0088ff"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.9"
          />
          {/* Left Wing (Outer White Sculpted Plate) */}
          <path
            d="M40 16 C 33 22, 28 42, 30 70 C 31 84, 34 98, 38 102 C 37 100, 35 78, 36 60 C 37 36, 40 20, 40 16 Z"
            fill="url(#ps5WhitePlateLeft)"
            filter="drop-shadow(-2px 4px 6px rgba(0,0,0,0.5))"
          />
          {/* Right Wing (Outer White Sculpted Plate) */}
          <path
            d="M60 16 C 67 22, 72 42, 70 70 C 69 84, 66 98, 62 102 C 63 100, 65 78, 64 60 C 63 36, 60 20, 60 16 Z"
            fill="url(#ps5WhitePlateRight)"
            filter="drop-shadow(2px 4px 6px rgba(0,0,0,0.5))"
          />
          {/* Circular Console Stand / Base */}
          <ellipse cx="50" cy="104" rx="26" ry="6" fill="#181922" stroke="#2c2d3d" strokeWidth="1.5" />
          {/* PlayStation Symbol Subtle Watermark on Left Wing */}
          <path
            d="M34 26 L 36 24 L 38 27 L 36 29 Z"
            fill="#3b82f6"
            opacity="0.75"
          />
          {/* Gradients */}
          <defs>
            <radialGradient id="ps5BlueGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0066ff" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0066ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="ps5CoreGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0f1118" />
              <stop offset="50%" stopColor="#1e202e" />
              <stop offset="100%" stopColor="#0a0b10" />
            </linearGradient>
            <linearGradient id="ps5WhitePlateLeft" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#e4e7ee" />
              <stop offset="100%" stopColor="#b4b9c7" />
            </linearGradient>
            <linearGradient id="ps5WhitePlateRight" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f8f9fc" />
              <stop offset="60%" stopColor="#d5d8e3" />
              <stop offset="100%" stopColor="#9da3b5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // PS4 / PS4 Pro Console Vector
  return (
    <div className={`relative flex items-center justify-center select-none ${dimClass} ${className}`}>
      <svg
        viewBox="0 0 120 80"
        className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Angled Dual Tier Body - Bottom Tier */}
        <path
          d="M20 54 L 35 26 L 105 26 L 95 54 Z"
          fill="url(#ps4BottomTier)"
          stroke="#1b1c26"
          strokeWidth="1"
        />
        {/* Angled Dual Tier Body - Top Tier */}
        <path
          d="M25 44 L 38 18 L 108 18 L 98 44 Z"
          fill="url(#ps4TopTier)"
          stroke="#252736"
          strokeWidth="1"
        />
        {/* Central Recessed Slit */}
        <path
          d="M23 48 L 96 48"
          stroke="#0b0c10"
          strokeWidth="2.5"
        />
        {/* Iconic PS4 Blue Indicator Light Bar */}
        <path
          d="M37 20 L 72 20"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
          className="animate-pulse"
        />
        {/* Power / Eject Button Markers */}
        <circle cx="34" cy="48" r="1.5" fill="#585c70" />
        <circle cx="40" cy="48" r="1.5" fill="#585c70" />
        {/* Dual USB Ports */}
        <rect x="75" y="46" width="6" height="3" rx="0.5" fill="#0b0c10" stroke="#333647" strokeWidth="0.5" />
        <rect x="85" y="46" width="6" height="3" rx="0.5" fill="#0b0c10" stroke="#333647" strokeWidth="0.5" />
        {/* Sony & PS Logo Badge */}
        <text
          x="88"
          y="28"
          fill="#8e92a8"
          fontSize="7"
          fontWeight="900"
          fontFamily="sans-serif"
          opacity="0.8"
        >
          PS4
        </text>
        {/* Gradients */}
        <defs>
          <linearGradient id="ps4TopTier" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2c2e3e" />
            <stop offset="50%" stopColor="#1f202b" />
            <stop offset="100%" stopColor="#14151e" />
          </linearGradient>
          <linearGradient id="ps4BottomTier" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#222432" />
            <stop offset="50%" stopColor="#181924" />
            <stop offset="100%" stopColor="#0e0f16" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
