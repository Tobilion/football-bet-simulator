import React from "react";

interface GlowOrbProps {
  className?: string;
  size?: string; // e.g. "350px", "450px"
  color?: string; // e.g. "var(--accent)" or any color string
  style?: React.CSSProperties;
}

export const GlowOrb: React.FC<GlowOrbProps> = ({
  className = "",
  size = "400px",
  color = "var(--accent)",
  style,
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        filter: "blur(180px)",
        opacity: 0.14, // matches the 0.12 - 0.18 range
        pointerEvents: "none",
        borderRadius: "50%",
        ...style,
      }}
      className={`absolute select-none pointer-events-none z-0 ${className}`}
    />
  );
};
