import React, { useRef, useState } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  tilt?: boolean;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = "",
  tilt = false,
  style,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCoords({ x, y });

    if (tilt) {
      const width = rect.width;
      const height = rect.height;
      // Calculate rotation between -10 and 10 degrees
      const rotateX = -10 * ((y - height / 2) / (height / 2));
      const rotateY = 10 * ((x - width / 2) / (width / 2));
      setTiltStyle({
        transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (tilt) {
      setTiltStyle({
        transform: "perspective(800px) rotateX(0deg) rotateY(0deg)",
      });
    }
  };

  // Radial gradient with accent color at 8% opacity, transparent 80%
  const glowStyle: React.CSSProperties = isHovered
    ? {
        backgroundImage: `radial-gradient(350px circle at ${coords.x}px ${coords.y}px, rgba(16, 185, 129, 0.08), transparent 80%)`,
      }
    : {};

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        ...glowStyle,
        ...tiltStyle,
        transition: isHovered
          ? "transform 0.05s linear, background-image 0.15s ease"
          : "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), background-image 0.25s ease",
      }}
      className={`relative overflow-hidden bg-[#12151c] border border-white/5 rounded-2xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
