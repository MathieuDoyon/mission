export type MissionStatus =
  | "running"
  | "paused"
  | "completed"
  | "aborted"
  | "failed"
  | "budget_exhausted";

export interface MissionBudget {
  maxTurns: number;
  turnsUsed: number;
}

export interface MissionState {
  id: string;
  objective: string;
  status: MissionStatus;
  cursor: number;
  createdAt: string;
  updatedAt: string;
  budget: MissionBudget;
}

export const DEFAULT_MAX_TURNS = 20;

export interface SteerEvent {
  seq: number;
  at: string;
  text: string;
}

export interface AppliedEvent {
  seq: number;
  appliedAtStep: number;
  at: string;
}

export interface LogEvent {
  at: string;
  step: number;
  kind: "turn" | "tool" | "steer" | "status" | "error";
  data: unknown;
}
