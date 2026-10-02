import { AgentCard, Role, SendMessageRequest } from "@a2a-js/sdk";
import { v4 as uuidv4 } from "uuid";

import { Message, TaskState } from "@/types/a2a-ui";
import { ChatContext } from "@/types/chat";

// Terminal states that should reset tasks
export const terminalStates: TaskState[] = [
  "completed",
  "canceled",
  "failed",
  "rejected",
  "unknown",
];

export const createMessageSendParams = (
  messageText: string,
  contextId: string,
  taskId?: string
): { request: SendMessageRequest; pending: Message } => {
  const messageId = uuidv4();
  return {
    request: {
      tenant: "",
      configuration: undefined,
      metadata: undefined,
      message: {
        messageId,
        contextId,
        taskId: taskId ?? "",
        role: Role.ROLE_USER,
        parts: [{
          content: { $case: "text", value: messageText },
          metadata: undefined,
          filename: "",
          mediaType: "text/plain",
        }],
        metadata: undefined,
        extensions: [],
        referenceTaskIds: [],
      },
    },
    pending: {
      kind: "message",
      messageId,
      contextId,
      taskId,
      role: "user",
      parts: [{ kind: "text", text: messageText }],
    },
  };
};

export const createTempChatContext = (contextId: string, agent: AgentCard): ChatContext => ({
  contextId,
  agent,
  messagesAndTasks: [],
  pendingMessage: null,
  messageText: "",
  loading: true,
});
