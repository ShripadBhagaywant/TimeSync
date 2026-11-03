import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clock, Code2, Menu, X, ExternalLink, Sparkles } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "How it works", href: "/guide" },
  { label: "Workspace", href: "/workspace" },
];

const GITHUB_REPO_URL = "https://github.com";

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const isHomePage = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => {
    e.preventDefault();
    if (isHomePage && href === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate(href);
    }

    setMobileMenuOpen(false);
  };

  return (
    <header
      className={`w-full rounded-lg bg-white/95 backdrop-blur-md sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "border-b border-slate-200/80 shadow-xs"
          : "border-b border-slate-200/50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg p-1"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition-all">
            <Clock className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight group-hover:text-blue-600 transition-colors">
            TimeSync <span className="text-blue-600">Notes</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main Navigation"
          className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="px-3.5 py-2 rounded-lg hover:text-slate-900 hover:bg-slate-100/80 transition-all"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* GitHub CTA: Visible on Tablet/Desktop (lg and up, or md+) */}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-all group"
          >
            <Code2 className="w-4 h-4 text-slate-300 group-hover:text-white transition-colors" />
            <span>Star on GitHub</span>
            <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 -ml-0.5 transition-opacity" />
          </a>

          {/* Mobile Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile & Tablet Dropdown Drawer (Only visible on screens < md) */}
      {mobileMenuOpen && (
        <div className="md:hidden rounded-lg absolute top-16 left-0 w-full bg-white border-b border-slate-200 px-4 pt-4 pb-6 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-200">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="block px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-50 transition-colors"
            >
              {item.label}
            </a>
          ))}

          <div className="pt-4 mt-2 border-t border-slate-100">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between w-full px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <Code2 className="w-4 h-4 text-slate-300" />
                <span>Star on GitHub</span>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
