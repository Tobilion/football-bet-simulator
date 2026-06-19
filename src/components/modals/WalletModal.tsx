import React, { useState } from "react";

interface WalletModalProps {
  balance: number;
  onConfirmTransaction: (amount: number, action: "DEPOSIT" | "WITHDRAW") => boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  balance,
  onConfirmTransaction,
  onClose
}) => {
  const [walletAction, setWalletAction] = useState<"DEPOSIT" | "WITHDRAW">("DEPOSIT");
  const [walletValue, setWalletValue] = useState<string>("100");
  const [walletSuccessMsg, setWalletSuccessMsg] = useState<string>("");

  const handleConfirm = () => {
    const amount = parseFloat(walletValue);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive transaction amount!");
      return;
    }
    const success = onConfirmTransaction(amount, walletAction);
    if (success) {
      setWalletSuccessMsg(
        walletAction === "DEPOSIT"
          ? `Successfully deposited $${amount.toFixed(2)} to your wallet!`
          : `Successfully withdrew $${amount.toFixed(2)} from your wallet!`
      );
      setWalletValue("");
      setTimeout(() => {
        onClose();
        setWalletSuccessMsg("");
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-55 flex items-center justify-center p-4 animate-fade-in">
      <div className="relative glass-panel-heavy border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-auto space-y-5 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white h-8 w-8 rounded-full flex items-center justify-center cursor-pointer text-xs"
        >
          ✕
        </button>

        <div className="text-center space-y-1 select-none">
          <span className="text-2xl block">🏦</span>
          <h3 className="text-sm font-black tracking-wider uppercase text-emerald-400 font-sans mt-2">
            SportSim Wallet Centre
          </h3>
          <p className="text-[9px] text-slate-400 font-mono tracking-tight">
            SECURE TRANSACTION PORTAL
          </p>
        </div>

        <div className="text-center bg-black/35 rounded-xl border border-white/5 p-3">
          <span className="text-[8px] text-slate-500 font-mono block uppercase">CURRENT BANKROLL</span>
          <span className="text-lg font-black text-emerald-450 font-mono block mt-0.5 animate-pulse">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex bg-black/30 p-1 border border-white/5 rounded-xl gap-1">
          <button
            onClick={() => setWalletAction("DEPOSIT")}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
              walletAction === "DEPOSIT"
                ? "bg-emerald-500 text-slate-950 font-extrabold shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📥 DEPOSIT
          </button>
          <button
            onClick={() => setWalletAction("WITHDRAW")}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
              walletAction === "WITHDRAW"
                ? "bg-rose-650 text-slate-100 font-extrabold shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📤 WITHDRAW
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold text-slate-400 uppercase block">
            {walletAction === "DEPOSIT" ? "ENTER DEPOSIT AMOUNT ($)" : "ENTER WITHDRAWAL AMOUNT ($)"}
          </label>
          <div className="relative bg-black/45 rounded-xl border border-white/5 flex items-center px-3.5 py-1.5">
            <span className="text-slate-500 text-xs font-bold mr-1.5">$</span>
            <input
              type="number"
              min="1"
              placeholder="Enter amount (e.g. 100)"
              value={walletValue}
              onChange={(e) => {
                setWalletValue(e.target.value);
                setWalletSuccessMsg("");
              }}
              className="w-full bg-transparent border-none text-xs text-white focus:outline-none placeholder-slate-655 font-bold font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 select-none">
          {[50, 100, 500, 1000].map(pt => (
            <button
              key={pt}
              onClick={() => {
                setWalletValue(pt.toString());
                setWalletSuccessMsg("");
              }}
              className="bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-[10px] py-1 rounded-lg border border-white/5 cursor-pointer text-center"
            >
              +${pt}
            </button>
          ))}
        </div>

        {walletSuccessMsg && (
          <div className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2 rounded-xl text-center font-bold">
            {walletSuccessMsg}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-slate-400 cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer text-center transition-all ${
              walletAction === "DEPOSIT"
                ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-md shadow-emerald-500/10"
                : "bg-rose-650 hover:bg-rose-700 text-slate-100"
            }`}
          >
            Confirm {walletAction === "DEPOSIT" ? "Deposit" : "Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
};
