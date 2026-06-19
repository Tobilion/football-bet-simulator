import React from "react";
import { Team } from "../types";

interface TeamCrestProps {
  team: Pick<Team, "id" | "shortName" | "primaryColor" | "secondaryColor">;
  size?: number; // width & height, defaults to 40
  className?: string;
}

export const TeamCrest: React.FC<TeamCrestProps> = ({ team, size = 40, className = "" }) => {
  const { id, shortName, primaryColor, secondaryColor } = team;
  const numId = parseInt(id) || 1;

  // Decide on a shield style based on teamId
  const styleCode = numId % 5; 

  // Clean initials (maximum 3 characters)
  const initials = shortName.toUpperCase().slice(0, 3);

  // Determine text color based on primary color brightness
  const getContrastColor = (hex: string) => {
    const raw = hex.replace("#", "");
    const r = parseInt(raw.substring(0, 2), 16);
    const g = parseInt(raw.substring(2, 4), 16);
    const b = parseInt(raw.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 125 ? "#111111" : "#FFFFFF";
  };

  const shieldBgColor = primaryColor;
  const accentColor = secondaryColor;
  const textColor = getContrastColor(primaryColor);
  const accentTextColor = getContrastColor(secondaryColor);

  return (
    <svg
      id={`crest-${id}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`inline-block select-none drop-shadow-md ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Shield shape path clip */}
        <clipPath id={`shield-clip-${id}`}>
          <path d="M50 5 C50 5 88 12 88 45 C88 78 50 95 50 95 C50 95 12 78 12 45 C12 12 50 5 50 5 Z" />
        </clipPath>
        
        {/* Subtle inner shadow / gradient overlay */}
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Main Shield Background */}
      <path
        d="M50 5 C50 5 88 12 88 45 C88 78 50 95 50 95 C50 95 12 78 12 45 C12 12 50 5 50 5 Z"
        fill={shieldBgColor}
        stroke={accentColor}
        strokeWidth="6"
      />

      {/* Pattern Overlay inside clip-path */}
      <g clipPath={`url(#shield-clip-${id})`}>
        {styleCode === 0 && (
          // Vertical Stripes
          <>
            <rect x="25" y="0" width="12" height="100" fill={accentColor} opacity="0.85" />
            <rect x="50" y="0" width="12" height="100" fill={accentColor} opacity="0.85" />
            <rect x="75" y="0" width="12" height="100" fill={accentColor} opacity="0.85" />
          </>
        )}

        {styleCode === 1 && (
          // Diagonal Sash
          <path d="M-10 10 L110 90 L110 110 L-10 30 Z" fill={accentColor} opacity="0.85" />
        )}

        {styleCode === 2 && (
          // Halved vertical
          <rect x="50" y="0" width="50" height="100" fill={accentColor} opacity="0.85" />
        )}

        {styleCode === 3 && (
          // Quarters
          <>
            <rect x="50" y="0" width="50" height="50" fill={accentColor} opacity="0.85" />
            <rect x="0" y="50" width="50" height="50" fill={accentColor} opacity="0.85" />
          </>
        )}

        {styleCode === 4 && (
          // Hoops (Horizontal Stripes)
          <>
            <rect x="0" y="25" width="100" height="15" fill={accentColor} opacity="0.85" />
            <rect x="0" y="55" width="100" height="15" fill={accentColor} opacity="0.85" />
          </>
        )}

        {/* Center Emblem/Star depending on style */}
        {numId % 2 === 0 ? (
          // Small soccer ball overlay or crown
          <circle cx="50" cy="35" r="12" fill={accentColor} stroke={shieldBgColor} strokeWidth="2" opacity="0.9" />
        ) : (
          // Gold Star
          <polygon points="50,22 53,28 60,28 55,33 57,39 50,35 43,39 45,33 40,28 47,28" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
        )}

        {/* Gloss Gradient overlay */}
        <path
          d="M50 5 C50 5 88 12 88 45 C88 78 50 95 50 95 C50 95 12 78 12 45 C12 12 50 5 50 5 Z"
          fill={`url(#grad-${id})`}
        />
      </g>

      {/* Initials Text */}
      <text
        x="50"
        y="68"
        fontFamily="sans-serif"
        fontSize="24"
        fontWeight="bold"
        textAnchor="middle"
        fill={numId % 2 === 0 ? accentTextColor : textColor}
        stroke={numId % 2 === 0 ? shieldBgColor : accentColor}
        strokeWidth="1.5"
        paintOrder="stroke"
        className="tracking-tight select-none"
      >
        {initials}
      </text>

      {/* Decorative Outer Ring for premium look */}
      <path
        d="M50 5 C50 5 88 12 88 45 C88 78 50 95 50 95 C50 95 12 78 12 45 C12 12 50 5 50 5 Z"
        fill="none"
        stroke="#111111"
        strokeWidth="2"
        opacity="0.3"
      />
    </svg>
  );
};
