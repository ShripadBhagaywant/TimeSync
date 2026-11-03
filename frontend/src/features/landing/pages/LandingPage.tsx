import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { UrlInputForm } from "@/features/extraction/components/UrlInputForm";
import { HeroPreviewCard } from "../components/HeroPreviewCard";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden selection:bg-blue-500 selection:text-white">
      {/* Background Decorative Gradient Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[80%] rounded-full bg-blue-400/10 blur-[120px]" />
        <div className="absolute top-[10%] right-[-10%] w-[45%] h-[70%] rounded-full bg-indigo-400/10 blur-[120px]" />
      </div>

      {/* Global Navigation */}
      <Navbar />

      {/* Hero Section */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-center">
          {/* Hero Content (Left Side - 6 cols) */}
          <div className="lg:col-span-6 space-y-5 sm:space-y-6 text-left max-w-2xl lg:max-w-none mx-auto lg:mx-0 w-full">
            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Turn YouTube videos into interactive{" "}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
                timestamped
              </span>{" "}
              notes
            </h1>

            {/* Subheading */}
            <p className="text-slate-600 text-sm sm:text-base leading-6 sm:leading-7 max-w-xl">
              Build editable notes from available video content, refine them
              when helpful, and navigate with interactive timestamps.
            </p>

            {/* URL Form Container */}
            <div className="w-full pt-0.5">
              <UrlInputForm />
            </div>
          </div>

          {/* Hero Graphic / Interactive Preview Card (Right Side - 6 cols) */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end w-full max-w-2xl lg:max-w-none mx-auto lg:mx-0">
            <div className="relative w-full">
              {/* Subtle backdrop highlight frame */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/15 to-indigo-500/15 rounded-3xl blur-lg opacity-70 transition duration-500" />

              {/* Interactive Preview Card Component */}
              <HeroPreviewCard />
            </div>
          </div>
        </div>
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
};
