import React from "react";
import { Link } from "react-router-dom";
import { Clock, Home,RefreshCw, AlertTriangle } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Animated Clock / Timeline Visual Element */}
        <div className="relative flex justify-center items-center">
          {/* Pulsing background ring */}
          <div className="absolute w-36 h-36 bg-blue-400/10 rounded-full animate-ping duration-1000" />

          {/* Secondary rotating radar ring */}
          <div className="absolute w-28 h-28 border-2 border-dashed border-blue-300 rounded-full animate-spin [animation-duration:12s]" />

          {/* Central Core Icon */}
          <div className="relative w-20 h-20 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/25 flex items-center justify-center text-white transform hover:scale-105 transition-transform duration-300">
            <Clock className="w-10 h-10 animate-pulse text-white stroke-[2.2]" />
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-white p-1 rounded-lg shadow-sm">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Error Code & Branding Text */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100/80 text-blue-700 rounded-full text-xs font-semibold tracking-wide uppercase">
            <RefreshCw className="w-3 h-3 animate-spin [animation-duration:4s]" />
            <span>Timeline Out of Sync</span>
          </div>

          <h1 className="text-6xl sm:text-7xl font-extrabold text-blue-900 tracking-tight">
            404
          </h1>

          <h2 className="text-xl font-bold text-slate-800">
            Page lost in the time stream
          </h2>

          <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
            The note or workspace you are looking for has either been moved,
            deleted, or never existed on this timeline.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg transition-all duration-200 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </Link>
        </div>

        {/* Subtle Footer branding hint */}
        <p className="text-xs text-slate-400 font-medium">
          TimeSync Notes • Keep your timestamps aligned.
        </p>
      </div>
    </div>
  );
};
