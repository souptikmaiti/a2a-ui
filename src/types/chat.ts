import { AgentCard } from "@a2a-js/sdk";
import { Message, Task } from "@/types/a2a-ui";

export interface ChatContext {
  contextId: string;
  agent: AgentCard;
  messagesAndTasks: (Message | Task)[];
  loading: boolean;
  messageText: string;
  pendingMessage: Message | null;
}
