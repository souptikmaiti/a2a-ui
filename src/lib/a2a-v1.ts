import {
  type Artifact as WireArtifact,
  type Message as WireMessage,
  type Part as WirePart,
  Role,
  type StreamResponse,
  type Task as WireTask,
  type TaskState as WireTaskState,
  type TaskStatus as WireTaskStatus,
} from "@a2a-js/sdk";
import type {
  Artifact,
  Message,
  Part,
  StreamEvent,
  Task,
  TaskState,
  TaskStatus,
} from "@/types/a2a-ui";

const states: Record<number, TaskState> = {
  1: "submitted",
  2: "working",
  3: "completed",
  4: "failed",
  5: "canceled",
  6: "input-required",
  7: "rejected",
  8: "auth-required",
};

export const toViewState = (state: WireTaskState): TaskState => states[state] ?? "unknown";

export const toViewPart = (part: WirePart): Part => {
  switch (part.content?.$case) {
    case "text":
      return { kind: "text", text: part.content.value };
    case "data":
      return { kind: "data", data: part.content.value };
    case "url":
      return { kind: "file", name: part.filename, uri: part.content.value };
    case "raw":
      return { kind: "file", name: part.filename };
    default:
      return { kind: "text", text: "" };
  }
};

export const toViewMessage = (message: WireMessage): Message => ({
  kind: "message",
  messageId: message.messageId,
  contextId: message.contextId,
  taskId: message.taskId || undefined,
  role: message.role === Role.ROLE_USER ? "user" : "agent",
  parts: message.parts.map(toViewPart),
  metadata: message.metadata,
});

export const toViewArtifact = (artifact: WireArtifact): Artifact => ({
  artifactId: artifact.artifactId,
  name: artifact.name || undefined,
  description: artifact.description || undefined,
  parts: artifact.parts.map(toViewPart),
});

export const toViewStatus = (status: WireTaskStatus | undefined): TaskStatus => ({
  state: status ? toViewState(status.state) : "unknown",
  message: status?.message ? toViewMessage(status.message) : undefined,
  timestamp: status?.timestamp || undefined,
});

export const toViewTask = (task: WireTask): Task => ({
  kind: "task",
  id: task.id,
  contextId: task.contextId,
  status: toViewStatus(task.status),
  history: task.history.map(toViewMessage),
  artifacts: task.artifacts.map(toViewArtifact),
});

export const toViewStreamEvent = (response: StreamResponse): StreamEvent | undefined => {
  const payload = response.payload;
  switch (payload?.$case) {
    case "task":
      return toViewTask(payload.value);
    case "message":
      return toViewMessage(payload.value);
    case "statusUpdate":
      return {
        kind: "status-update",
        taskId: payload.value.taskId,
        contextId: payload.value.contextId,
        status: toViewStatus(payload.value.status),
      };
    case "artifactUpdate":
      return payload.value.artifact
        ? {
            kind: "artifact-update",
            taskId: payload.value.taskId,
            contextId: payload.value.contextId,
            artifact: toViewArtifact(payload.value.artifact),
            append: payload.value.append,
          }
        : undefined;
    default:
      return undefined;
  }
};
