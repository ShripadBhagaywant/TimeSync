import React from "react";
import { Link } from "react-router-dom";
import { Shield, HardDrive, Zap } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-950 border-t border-slate-800 py-4 px-4 sm:px-6 text-xs text-slate-400 shrink-0 rounded-x">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
          <span className="font-semibold text-slate-200">TimeSync Notes</span>
          <span className="text-slate-700 hidden sm:inline">•</span>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Free
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-blue-400" /> Local-First
            </span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" /> Zero Auth
            </span>
          </div>
        </div>

        <nav
          className="flex items-center gap-4 text-[11px] text-slate-400"
          aria-label="Footer Navigation"
        >
          <a
            href="https://github.com/ShripadBhagaywant"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-200 transition-colors"
          >
            GitHub
          </a>
          <Link
            to="/privacy"
            className="hover:text-slate-200 transition-colors"
          >
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-slate-200 transition-colors">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
};
