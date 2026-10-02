import { TextDataPartMarkdown } from "@/components/chat/TextDataPartMarkdown";
import { DataPart, Message, TextPart } from "@/types/a2a-ui";

interface AIMessageProps {
  message: Message;
}

export const AIMessage: React.FC<AIMessageProps> = ({ message }) => {
  const textDataParts: (TextPart | DataPart)[] = message.parts.filter(
    (part) => part.kind === "text" || part.kind === "data"
  );

  return textDataParts.map((part, index) => <TextDataPartMarkdown key={index} part={part} />);
};
