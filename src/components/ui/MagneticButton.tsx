import React, { useRef, useState } from "react";

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = "",
  style,
  ...props
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Translate toward pointer at 0.3x offset from center
    const x = (e.clientX - centerX) * 0.3;
    const y = (e.clientY - centerY) * 0.3;

    setOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <button
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform: `translate(${offset.x}px, ${offset.y}px) ${isHovered ? "scale(0.98)" : "scale(1)"}`,
        transition: isHovered
          ? "transform 0.08s ease-out"
          : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}
      className={`active:scale-[0.97] transition-all duration-150 cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
