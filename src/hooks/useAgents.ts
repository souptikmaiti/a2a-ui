import { AgentCard } from "@a2a-js/sdk";
import { ClientFactory, DefaultAgentCardResolver, JsonRpcTransportFactory } from "@a2a-js/sdk/client";
import React from "react";

import { useToastContext } from "@/contexts/ToastContext";
import { createA2AProxyFetch } from "@/lib/api/proxy-fetch";
import { agentEndpoint } from "@/types/a2a-ui";

const AGENT_STORAGE_KEY = "deep-divers-a2a-ui:agent-urls:v1";

export interface UseAgentsReturn {
  agents: AgentCard[];
  activeAgent: AgentCard | null;
  addAgentByUrl: (url: string) => Promise<void>;
  setActiveAgent: (agent: AgentCard | null) => void;
}

interface UseAgentsParams {
  customHeaders?: Record<string, string>;
}

export const useAgents = (params?: UseAgentsParams): UseAgentsReturn => {
  const [agents, setAgents] = React.useState<AgentCard[]>([]);
  const [activeAgent, setActiveAgent] = React.useState<AgentCard | null>(null);

  const { showToast } = useToastContext();

  const addAgentByUrl = async (url: string, startupLoad: boolean = false): Promise<void> => {
    if (!url.trim()) {
      return;
    }

    try {
      const proxyFetch = createA2AProxyFetch(params?.customHeaders);
      const factory = new ClientFactory({
        transports: [new JsonRpcTransportFactory({ fetchImpl: proxyFetch })],
        cardResolver: new DefaultAgentCardResolver({ fetchImpl: proxyFetch }),
      });
      const cardUrl = url.trim();
      const client = await factory.createFromUrl(cardUrl, cardUrl.endsWith(".json") ? "" : undefined);
      const agentCard: AgentCard = await client.getAgentCard();

      setAgents((prev) => {
        const newAgents = [...prev];

        if (!newAgents.some((agent) => agentEndpoint(agent) === agentEndpoint(agentCard))) {
          newAgents.push(agentCard);
        }

        return newAgents;
      });

      if (!startupLoad) {
        // Set active agent and show toast when user adds agent
        setActiveAgent(agentCard);
        try {
          const stored = JSON.parse(window.localStorage.getItem(AGENT_STORAGE_KEY) || "[]") as string[];
          window.localStorage.setItem(
            AGENT_STORAGE_KEY,
            JSON.stringify(Array.from(new Set([...stored, cardUrl])))
          );
        } catch (error) {
          console.warn("Could not save agent URL", error);
        }
        showToast(`Added ${agentCard.name}`, "success");
      } else {
        setActiveAgent((current) => current ?? agentCard);
      }
    } catch (error) {
      if (startupLoad) {
        // Don't show startup load errors
        return;
      }

      console.error("Error adding agent:", error);
      const errorMessage: string =
        error instanceof Error ? error.message : "Unknown error occurred";
      showToast(`Failed to fetch agent card: ${errorMessage}`, "error");
      throw error; // Re-throw so the component can handle loading states
    }
  };

  // Load Agent Cards from URL on startup
  React.useEffect(() => {
    const agentCardsUrl: string | undefined = process.env.NEXT_PUBLIC_DEFAULT_AGENT_CARDS_URL;
    const configured = (process.env.NEXT_PUBLIC_AGENT_URLS || "")
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
    let stored: string[] = [];
    try {
      stored = JSON.parse(window.localStorage.getItem(AGENT_STORAGE_KEY) || "[]") as string[];
    } catch (error) {
      console.warn("Could not restore agent URLs", error);
    }
    const load = async (urls: string[]) => {
      for (const url of Array.from(new Set([...configured, ...stored, ...urls]))) {
        await addAgentByUrl(url, true);
      }
    };
    if (agentCardsUrl) {
      createA2AProxyFetch()(agentCardsUrl)
        .then((response) => response.json())
        .then((urls: string[]) => load(urls))
        .catch((error) => {
          console.warn("Could not load default agent cards", error);
          load([]);
        });
    } else {
      void load([]);
    }
  }, []);

  return {
    agents,
    activeAgent,
    addAgentByUrl,
    setActiveAgent,
  };
};
