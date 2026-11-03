import { createBrowserRouter } from "react-router-dom";
import {
  GuideRoute,
  LandingRoute,
  NotFoundRoute,
  PrivacyPolicyRoute,
  SharedNoteRoute,
  TermsOfServiceRoute,
  WorkspaceRoute,
} from "@/app/routePages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingRoute />,
  },
  {
    path: "/workspace/video/:videoId",
    element: <WorkspaceRoute />,
  },
  {
    path: "/workspace/playlist/:playlistId",
    element: <WorkspaceRoute />,
  },
  {
    path: "/workspace/playlist/:playlistId/video/:playlistVideoId",
    element: <WorkspaceRoute />,
  },
  {
    path: "/workspace",
    element: <WorkspaceRoute />,
  },
  {
    path: "/notes/:hashId",
    element: <SharedNoteRoute />,
  },
  {
    path: "/guide",
    element: <GuideRoute />,
  },
  {
    path: "/privacy",
    element: <PrivacyPolicyRoute />,
  },
  {
    path: "/terms",
    element: <TermsOfServiceRoute />,
  },
  {
    path: "*",
    element: <NotFoundRoute />,
  },
]);
