// Historical narrative types for Baguio City 3D.
// Pure types only — no runtime constants.

import type { Position } from "./geo";
import type { Era } from "./geo";

export type { Era } from "./geo";

export interface HistoricalEra {
  key: Era;
  name: string;
  startYear: number;
  endYear: number | null;
  summary: string;
}

export interface HistoricalEvent {
  title: string;
  year: number;
  era: Era;
  description: string;
  coord: Position | null;
}

export interface HistoryData {
  eras: HistoricalEra[];
  events: HistoricalEvent[];
}
