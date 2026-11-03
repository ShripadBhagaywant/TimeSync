import { lazy, Suspense } from "react";
import { BrandLoader } from "@/components/ui/BrandLoader";

const LandingPage = lazy(() => import("@/features/landing/pages/LandingPage").then(module => ({ default: module.LandingPage })));
const WorkspacePage = lazy(() => import("@/features/workspace/pages/WorkspacePage").then(module => ({ default: module.WorkspacePage })));
const SharedNotePreviewPage = lazy(() => import("@/features/notes/pages/SharedNotePreviewPage").then(module => ({ default: module.SharedNotePreviewPage })));
const NotFoundPage = lazy(() => import("@/components/layout/NotFound").then(module => ({ default: module.NotFoundPage })));
const GuidePage = lazy(() => import("@/app/pages/GuidePage").then(module => ({ default: module.GuidePage })));
const PrivacyPolicyPage = lazy(() => import("@/components/layout/PrivacyPolicyPage").then(module => ({ default: module.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import("@/components/layout/TermsOfServicePage").then(module => ({ default: module.TermsOfServicePage })));

const RouteLoading = () => <BrandLoader variant="page" title="Opening page" message="Getting TimeSync Notes ready…" />;

export const LandingRoute = () => <Suspense fallback={<RouteLoading />}><LandingPage /></Suspense>;
export const WorkspaceRoute = () => <Suspense fallback={<RouteLoading />}><WorkspacePage /></Suspense>;
export const SharedNoteRoute = () => <Suspense fallback={<RouteLoading />}><SharedNotePreviewPage /></Suspense>;
export const NotFoundRoute = () => <Suspense fallback={<RouteLoading />}><NotFoundPage /></Suspense>;
export const GuideRoute = () => <Suspense fallback={<RouteLoading />}><GuidePage /></Suspense>;
export const PrivacyPolicyRoute = () => <Suspense fallback={<RouteLoading />}><PrivacyPolicyPage /></Suspense>;
export const TermsOfServiceRoute = () => <Suspense fallback={<RouteLoading />}><TermsOfServicePage /></Suspense>;
