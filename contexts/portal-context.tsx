import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

import adminEmblem from "@/assets/logo.png";
import redSigmaEmblem from "@/assets/portals/red-sigma.png";
import orangeNovaEmblem from "@/assets/portals/orange-nova.png";
import yellowMagnaEmblem from "@/assets/portals/yellow-magna.png";
import greenGammaEmblem from "@/assets/portals/green-gamma.png";
import blueThetaEmblem from "@/assets/portals/blue-theta.png";
import purpleDeltaEmblem from "@/assets/portals/purple-delta.png";
import blackVectraEmblem from "@/assets/portals/black-vectra.png";

export type PortalId =
  | "admin"
  | "red-sigma"
  | "orange-nova"
  | "yellow-magna"
  | "green-gamma"
  | "blue-theta"
  | "purple-delta"
  | "black-vectra";

export interface PortalConfig {
  id: PortalId;
  name: string;
  shortCode: string;
  emblem: string;
  /** Primary brand hex used for dots/badges in chips. */
  primaryHex: string;
  /** When true, no team-scope is applied (unrestricted). */
  isAdmin?: boolean;
  /** Map of CSS variable overrides applied to <html>. Empty for admin (uses :root). */
  themeVars: Record<string, string>;
}

const STORAGE_KEY = "cr-active-portal";

/**
 * Echelon-style portal themes. Values use oklch() to match this project's
 * design token format (see src/styles.css). Admin uses an empty map so the
 * base :root tokens apply unchanged.
 */
const PORTALS: Record<PortalId, PortalConfig> = {
  admin: {
    id: "admin",
    name: "Admin",
    shortCode: "ADMIN",
    emblem: adminEmblem,
    primaryHex: "#18ABBF",
    isAdmin: true,
    themeVars: {},
  },
  "red-sigma": {
    id: "red-sigma",
    name: "Red-Sigma",
    shortCode: "RED-SIG",
    emblem: redSigmaEmblem,
    primaryHex: "#A4005A",
    themeVars: {
      "--primary": "oklch(0.45 0.18 350)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.45 0.18 350)",
      "--background": "oklch(0.97 0.012 350)",
      "--accent": "oklch(0.92 0.04 350)",
      "--accent-foreground": "oklch(0.3 0.1 350)",
      "--sidebar": "oklch(0.32 0.15 350)",
      "--sidebar-foreground": "oklch(0.97 0.01 350)",
      "--sidebar-primary": "oklch(0.5 0.2 350)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
      "--sidebar-accent": "oklch(0.5 0.2 350)",
      "--sidebar-accent-foreground": "oklch(1 0 0)",
      "--sidebar-border": "oklch(0.38 0.15 350)",
      "--sidebar-ring": "oklch(0.5 0.2 350)",
      "--gradient-primary": "linear-gradient(135deg, oklch(0.45 0.18 350), oklch(0.55 0.2 5))",
      "--chart-1": "#A4005A",
      "--chart-2": "#7a0043",
      "--chart-3": "#c4446e",
      "--chart-4": "#f0a0a0",
      "--chart-5": "#E50909",
    },
  },
  "orange-nova": {
    id: "orange-nova",
    name: "Orange-Nova",
    shortCode: "ORN-NOV",
    emblem: orangeNovaEmblem,
    primaryHex: "#D03B00",
    themeVars: {
      "--primary": "oklch(0.58 0.2 38)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.58 0.2 38)",
      "--background": "oklch(0.97 0.018 38)",
      "--accent": "oklch(0.92 0.05 38)",
      "--accent-foreground": "oklch(0.35 0.12 38)",
      "--sidebar": "oklch(0.5 0.2 38)",
      "--sidebar-foreground": "oklch(0.98 0.01 38)",
      "--sidebar-primary": "oklch(0.58 0.2 38)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
      "--sidebar-accent": "oklch(0.65 0.2 45)",
      "--sidebar-accent-foreground": "oklch(1 0 0)",
      "--sidebar-border": "oklch(0.55 0.18 38)",
      "--sidebar-ring": "oklch(0.58 0.2 38)",
      "--gradient-primary": "linear-gradient(135deg, oklch(0.58 0.2 38), oklch(0.7 0.2 50))",
      "--chart-1": "#D03B00",
      "--chart-2": "#9a2c00",
      "--chart-3": "#e0654a",
      "--chart-4": "#ffb380",
      "--chart-5": "#FF7F27",
    },
  },
  "yellow-magna": {
    id: "yellow-magna",
    name: "Yellow-Magna",
    shortCode: "YEL-MAG",
    emblem: yellowMagnaEmblem,
    primaryHex: "#AC7B00",
    themeVars: {
      "--primary": "oklch(0.6 0.14 75)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.6 0.14 75)",
      "--background": "oklch(0.97 0.025 85)",
      "--accent": "oklch(0.92 0.06 85)",
      "--accent-foreground": "oklch(0.35 0.1 75)",
      "--sidebar": "oklch(0.52 0.14 75)",
      "--sidebar-foreground": "oklch(0.98 0.01 85)",
      "--sidebar-primary": "oklch(0.6 0.14 75)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
      "--sidebar-accent": "oklch(0.7 0.16 85)",
      "--sidebar-accent-foreground": "oklch(0.2 0.05 75)",
      "--sidebar-border": "oklch(0.55 0.13 75)",
      "--sidebar-ring": "oklch(0.6 0.14 75)",
      "--gradient-primary": "linear-gradient(135deg, oklch(0.6 0.14 75), oklch(0.75 0.18 85))",
      "--chart-1": "#AC7B00",
      "--chart-2": "#7a5800",
      "--chart-3": "#d4a00a",
      "--chart-4": "#fbd872",
      "--chart-5": "#F7B103",
    },
  },
  "green-gamma": {
    id: "green-gamma",
    name: "Green-Gamma",
    shortCode: "GRN-GAM",
    emblem: greenGammaEmblem,
    primaryHex: "#008266",
    themeVars: {
      "--primary": "oklch(0.5 0.12 175)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.5 0.12 175)",
      "--background": "oklch(0.97 0.015 165)",
      "--accent": "oklch(0.92 0.05 165)",
      "--accent-foreground": "oklch(0.3 0.08 175)",
      "--sidebar": "oklch(0.4 0.12 175)",
      "--sidebar-foreground": "oklch(0.98 0.01 165)",
      "--sidebar-primary": "oklch(0.5 0.12 175)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
      "--sidebar-accent": "oklch(0.65 0.17 145)",
      "--sidebar-accent-foreground": "oklch(1 0 0)",
      "--sidebar-border": "oklch(0.45 0.11 175)",
      "--sidebar-ring": "oklch(0.5 0.12 175)",
      "--gradient-primary": "linear-gradient(135deg, oklch(0.5 0.12 175), oklch(0.7 0.18 140))",
      "--chart-1": "#008266",
      "--chart-2": "#00614c",
      "--chart-3": "#3da050",
      "--chart-4": "#b0e480",
      "--chart-5": "#6DC822",
    },
  },
  "blue-theta": {
    id: "blue-theta",
    name: "Blue-Theta",
    shortCode: "BLU-THE",
    emblem: blueThetaEmblem,
    primaryHex: "#2F60C3",
    themeVars: {
      "--primary": "oklch(0.55 0.18 260)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.55 0.18 260)",
      "--background": "oklch(0.97 0.015 255)",
      "--accent": "oklch(0.92 0.05 255)",
      "--accent-foreground": "oklch(0.32 0.1 260)",
      "--sidebar": "oklch(0.42 0.16 260)",
      "--sidebar-foreground": "oklch(0.98 0.01 255)",
      "--sidebar-primary": "oklch(0.55 0.18 260)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
      "--sidebar-accent": "oklch(0.7 0.18 200)",
      "--sidebar-accent-foreground": "oklch(1 0 0)",
      "--sidebar-border": "oklch(0.48 0.16 260)",
      "--sidebar-ring": "oklch(0.55 0.18 260)",
      "--gradient-primary": "linear-gradient(135deg, oklch(0.55 0.18 260), oklch(0.72 0.17 200))",
      "--chart-1": "#2F60C3",
      "--chart-2": "#234a96",
      "--chart-3": "#4a90c8",
      "--chart-4": "#80e5e2",
      "--chart-5": "#00CDC8",
    },
  },
  "purple-delta": {
    id: "purple-delta",
    name: "Purple-Delta",
    shortCode: "PUR-DEL",
    emblem: purpleDeltaEmblem,
    primaryHex: "#5A4999",
    themeVars: {
      "--primary": "oklch(0.48 0.14 295)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.48 0.14 295)",
      "--background": "oklch(0.97 0.015 295)",
      "--accent": "oklch(0.92 0.05 295)",
      "--accent-foreground": "oklch(0.32 0.1 295)",
      "--sidebar": "oklch(0.42 0.14 295)",
      "--sidebar-foreground": "oklch(0.98 0.01 295)",
      "--sidebar-primary": "oklch(0.48 0.14 295)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
      "--sidebar-accent": "oklch(0.68 0.22 315)",
      "--sidebar-accent-foreground": "oklch(1 0 0)",
      "--sidebar-border": "oklch(0.48 0.13 295)",
      "--sidebar-ring": "oklch(0.48 0.14 295)",
      "--gradient-primary": "linear-gradient(135deg, oklch(0.48 0.14 295), oklch(0.65 0.2 315))",
      "--chart-1": "#5A4999",
      "--chart-2": "#3d3270",
      "--chart-3": "#7d6cbf",
      "--chart-4": "#b3a4e8",
      "--chart-5": "#9b5dcf",
    },
  },
  "black-vectra": {
    id: "black-vectra",
    name: "Black-Vectra",
    shortCode: "BLK-VEC",
    emblem: blackVectraEmblem,
    primaryHex: "#373155",
    themeVars: {
      "--primary": "oklch(0.32 0.06 285)",
      "--primary-foreground": "oklch(1 0 0)",
      "--ring": "oklch(0.32 0.06 285)",
      "--background": "oklch(0.96 0.008 285)",
      "--accent": "oklch(0.9 0.025 285)",
      "--accent-foreground": "oklch(0.28 0.06 285)",
      "--sidebar": "oklch(0.25 0.04 285)",
      "--sidebar-foreground": "oklch(0.96 0.008 285)",
      "--sidebar-primary": "oklch(0.32 0.06 285)",
      "--sidebar-primary-foreground": "oklch(1 0 0)",
      "--sidebar-accent": "oklch(0.5 0.12 285)",
      "--sidebar-accent-foreground": "oklch(1 0 0)",
      "--sidebar-border": "oklch(0.32 0.05 285)",
      "--sidebar-ring": "oklch(0.32 0.06 285)",
      "--gradient-primary": "linear-gradient(135deg, oklch(0.25 0.05 285), oklch(0.45 0.12 285))",
      "--chart-1": "#373155",
      "--chart-2": "#1f1c33",
      "--chart-3": "#5a4f88",
      "--chart-4": "#8e83bf",
      "--chart-5": "#473c7a",
    },
  },
};

export const PORTAL_LIST: PortalConfig[] = [
  PORTALS.admin,
  PORTALS["red-sigma"],
  PORTALS["orange-nova"],
  PORTALS["yellow-magna"],
  PORTALS["green-gamma"],
  PORTALS["blue-theta"],
  PORTALS["purple-delta"],
  PORTALS["black-vectra"],
];

export function getPortal(id: PortalId | string | null | undefined): PortalConfig {
  if (!id) return PORTALS.admin;
  return (PORTALS as Record<string, PortalConfig>)[id] ?? PORTALS.admin;
}

function readStoredPortalId(): PortalId {
  if (typeof window === "undefined") return "admin";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) as PortalId | null;
    if (stored && stored in PORTALS) return stored;
  } catch {}
  return "admin";
}

function applyThemeVars(vars: Record<string, string>) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Clear any previously-applied portal vars first.
  const prev = (root as any).__portalVarsApplied as string[] | undefined;
  if (prev) prev.forEach((k) => root.style.removeProperty(k));
  const keys = Object.keys(vars);
  keys.forEach((k) => root.style.setProperty(k, vars[k]));
  (root as any).__portalVarsApplied = keys;
}

interface PortalContextValue {
  portal: PortalConfig;
  portals: PortalConfig[];
  setPortalId: (id: PortalId) => void;
  /** Team ID matching the active portal, or null when Admin (no scope). */
  scopedTeamId: string | null;
  /** True when the portal forces a team-scope filter. */
  isScoped: boolean;
}

const PortalContext = createContext<PortalContextValue | undefined>(undefined);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [portalId, setPortalIdState] = useState<PortalId>(() => readStoredPortalId());
  const portal = PORTALS[portalId];

  useLayoutEffect(() => {
    applyThemeVars(portal.themeVars);
  }, [portal]);

  const setPortalId = useCallback((id: PortalId) => {
    setPortalIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  // Sync across tabs.
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue && e.newValue in PORTALS) {
        setPortalIdState(e.newValue as PortalId);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const value = useMemo<PortalContextValue>(
    () => ({
      portal,
      portals: PORTAL_LIST,
      setPortalId,
      scopedTeamId: portal.isAdmin ? null : portal.id,
      isScoped: !portal.isAdmin,
    }),
    [portal, setPortalId],
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used inside PortalProvider");
  return ctx;
}
