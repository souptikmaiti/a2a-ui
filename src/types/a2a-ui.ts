import type { AgentCard } from "@a2a-js/sdk";

// View models keep the existing chat components independent of the wire format.
export type TaskState =
  | "submitted"
  | "working"
  | "completed"
  | "failed"
  | "canceled"
  | "input-required"
  | "rejected"
  | "auth-required"
  | "unknown";

export type TextPart = { kind: "text"; text: string };
export type DataPart = { kind: "data"; data: unknown };
export type FilePart = { kind: "file"; name?: string; uri?: string };
export type Part = TextPart | DataPart | FilePart;

export interface Message {
  kind: "message";
  messageId: string;
  contextId: string;
  taskId?: string;
  role: "user" | "agent";
  parts: Part[];
  metadata?: Record<string, unknown>;
}

export interface Artifact {
  artifactId: string;
  name?: string;
  description?: string;
  parts: Part[];
}

export interface TaskStatus {
  state: TaskState;
  message?: Message;
  timestamp?: string;
}

export interface Task {
  kind: "task";
  id: string;
  contextId: string;
  status: TaskStatus;
  history?: Message[];
  artifacts?: Artifact[];
}

export interface TaskStatusUpdateEvent {
  kind: "status-update";
  taskId: string;
  contextId: string;
  status: TaskStatus;
}

export interface TaskArtifactUpdateEvent {
  kind: "artifact-update";
  taskId: string;
  contextId: string;
  artifact: Artifact;
  append?: boolean;
}

export type StreamEvent = Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

export const agentEndpoint = (agent: AgentCard): string =>
  agent.supportedInterfaces.find((entry) => entry.protocolBinding === "JSONRPC")?.url ??
  agent.supportedInterfaces[0]?.url ??
  "";
