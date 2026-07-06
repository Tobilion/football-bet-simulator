import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SpotlightCard } from "./ui/SpotlightCard";
import { MagneticButton } from "./ui/MagneticButton";
import { GlowOrb } from "./ui/GlowOrb";

interface OnboardingOverlayProps {
  onEnter: () => void;
}

export const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ onEnter }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleEnter = () => {
    localStorage.setItem("cubet_onboarded", "true");
    setIsVisible(false);
    setTimeout(onEnter, 400); // Allow fade-out animation to finish
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#07090e]/95 backdrop-blur-xl overflow-y-auto px-4 py-8">
      {/* Background Glow Orbs for premium ambience */}
      <GlowOrb className="-top-12 -left-12 opacity-15" size="500px" color="var(--accent)" />
      <GlowOrb className="-bottom-20 -right-20 opacity-15" size="500px" color="var(--accent-2)" />

      <div className="max-w-6xl w-full flex flex-col items-center z-10 text-center select-none">
        {/* Subtitle & Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-1"
        >
          <span className="text-[11px] font-black tracking-[0.2em] text-emerald-400 uppercase">
            Welcome to the Simulator
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="text-4xl md:text-5xl font-black text-slate-100 tracking-tight mb-4"
        >
          Elevate Your <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Football Experience</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-slate-400 text-sm md:text-base max-w-xl mb-12 leading-relaxed"
        >
          Simulate realistic league or tournament fixtures, make strategic bets, manage squads, and scale up your club empire.
        </motion.p>

        {/* 3 Skewed SpotlightCards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 w-full px-4 md:px-8 mb-14">
          {/* Card 1: Simulate Matches */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateY: -15, rotateX: 5 }}
            animate={{ opacity: 1, y: 0, rotateY: -8, rotateX: 3 }}
            whileHover={{ rotateY: 0, rotateX: 0, y: -8, scale: 1.02 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="origin-center"
          >
            <SpotlightCard
              tilt={true}
              className="p-8 h-full min-h-[300px] flex flex-col items-center justify-between text-center border-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_50px_rgba(16,185,129,0.1)] group"
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/5 flex items-center justify-center mb-6 border border-emerald-500/15 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 0M12 14.25a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm9 2.25H3M21 12H3m18-4.25H3" />
                    <circle cx="12" cy="11.25" r="9" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-3 group-hover:text-emerald-400 transition-colors">
                  Simulate Matches
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Experience full tournaments & leagues simulation with live event logic, real-time commentary, stats updates, and dynamic goal indicators.
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-500/50 uppercase mt-4">Continuous action</span>
            </SpotlightCard>
          </motion.div>

          {/* Card 2: Virtual Betting & Casino */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateY: 0, rotateX: 5 }}
            animate={{ opacity: 1, y: 0, rotateY: 0, rotateX: 3 }}
            whileHover={{ rotateY: 0, rotateX: 0, y: -8, scale: 1.02 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="origin-center"
          >
            <SpotlightCard
              tilt={true}
              className="p-8 h-full min-h-[300px] flex flex-col items-center justify-between text-center border-slate-500/10 hover:border-emerald-500/30 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_50px_rgba(16,185,129,0.1)] group"
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/5 flex items-center justify-center mb-6 border border-emerald-500/15 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182.553-.44 1.278-.659 2.003-.659.768 0 1.536.218 2.121.658m-.779.66c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C17.536 7.219 16.768 7 16 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-3 group-hover:text-emerald-400 transition-colors">
                  Bet & Play Casino
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Stake virtual funds on live fixtures, compile complex parlays in the Bet Builder, cash out early, or bet on 14 custom casino minigames.
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-500/50 uppercase mt-4">Virtual economy</span>
            </SpotlightCard>
          </motion.div>

          {/* Card 3: Build Your Club */}
          <motion.div
            initial={{ opacity: 0, y: 40, rotateY: 15, rotateX: 5 }}
            animate={{ opacity: 1, y: 0, rotateY: 8, rotateX: 3 }}
            whileHover={{ rotateY: 0, rotateX: 0, y: -8, scale: 1.02 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="origin-center"
          >
            <SpotlightCard
              tilt={true}
              className="p-8 h-full min-h-[300px] flex flex-col items-center justify-between text-center border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_50px_rgba(6,182,212,0.1)] group"
            >
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/5 flex items-center justify-center mb-6 border border-cyan-500/15 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21V9m0 12h.008M12 3a9 9 0 0 1 7.18 3.63L13.5 9H21v3h-3.75l-2.25-3-1.5 2.25M12 3a9 9 0 0 0-7.18 3.63L10.5 9H3v3h3.75l2.25-3 1.5 2.25" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mb-3 group-hover:text-cyan-400 transition-colors">
                  Build Your Club
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Acquire players, set up customized formations, claim tournament wins, and build your VIP stature to dominate as a successful owner.
                </p>
              </div>
              <span className="text-[10px] font-mono text-cyan-500/50 uppercase mt-4">Club management</span>
            </SpotlightCard>
          </motion.div>
        </div>

        {/* Enter Magnetic Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <MagneticButton
            onClick={handleEnter}
            className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-[0_8px_32px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.4)] active:scale-[0.97] transition-all cursor-pointer"
          >
            Enter CU Bet
          </MagneticButton>
        </motion.div>
      </div>
    </div>
  );
};
