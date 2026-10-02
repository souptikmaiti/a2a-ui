import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { ClientFactory, JsonRpcTransportFactory } from "@a2a-js/sdk/client";
import { Role } from "@a2a-js/sdk";
import { POST as proxyPost } from "../src/app/api/proxy/route.ts";
import { toViewStreamEvent } from "../src/lib/a2a-v1.ts";
import { createA2AProxyFetch } from "../src/lib/api/proxy-fetch.ts";

let server;
let baseUrl;
const methods = [];

before(async () => {
  server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/.well-known/agent-card.json") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({
        name: "mock_agent",
        description: "A2A 1.0 streaming test agent",
        supportedInterfaces: [{ url: baseUrl, protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
        version: "1.0.0",
        capabilities: { streaming: true },
        defaultInputModes: ["text/plain"],
        defaultOutputModes: ["text/plain"],
        skills: [],
      }));
      return;
    }
    if (request.method !== "POST" || request.url !== "/") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    const rpc = JSON.parse(body);
    methods.push(rpc.method);
    const contextId = rpc.params.message.contextId;
    assert.equal(rpc.params.message.role, "ROLE_USER");
    assert.equal(rpc.params.message.parts[0].text, "hello");

    const emit = (result) => response.write(
      `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result })}\n\n`
    );
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    emit({ task: { id: "task-1", contextId, status: { state: "TASK_STATE_WORKING" } } });
    emit({ statusUpdate: {
      taskId: "task-1", contextId,
      status: { state: "TASK_STATE_WORKING", message: {
        messageId: "progress-1", contextId, taskId: "task-1", role: "ROLE_AGENT",
        parts: [{ text: "Searching repositories" }],
      } },
    } });
    emit({ artifactUpdate: {
      taskId: "task-1", contextId,
      artifact: { artifactId: "answer-1", name: "Answer", parts: [{ text: "Found the repository" }] },
    } });
    emit({ statusUpdate: {
      taskId: "task-1", contextId, status: { state: "TASK_STATE_COMPLETED" },
    } });
    response.end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("discovers a v1 card and renders incremental JSON-RPC A2A events", { timeout: 10000 }, async () => {
  const factory = new ClientFactory({ transports: [new JsonRpcTransportFactory()] });
  const client = await factory.createFromUrl(baseUrl);
  const card = await client.getAgentCard();
  assert.equal(card.supportedInterfaces[0].protocolVersion, "1.0");

  const events = [];
  for await (const response of client.sendMessageStream({
    tenant: "",
    configuration: undefined,
    metadata: undefined,
    message: {
      messageId: "message-1", contextId: "context-1", taskId: "",
      role: Role.ROLE_USER,
      parts: [{ content: { $case: "text", value: "hello" }, metadata: undefined, filename: "", mediaType: "text/plain" }],
      metadata: undefined, extensions: [], referenceTaskIds: [],
    },
  })) {
    events.push(toViewStreamEvent(response));
  }

  assert.deepEqual(methods, ["SendStreamingMessage"]);
  assert.deepEqual(events.map((event) => event.kind), [
    "task", "status-update", "artifact-update", "status-update",
  ]);
  assert.equal(events[1].status.message.parts[0].text, "Searching repositories");
  assert.equal(events[2].artifact.parts[0].text, "Found the repository");
  assert.equal(events[3].status.state, "completed");
});

test("the same-origin proxy forwards card discovery and SSE events", { timeout: 10000 }, async () => {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    if (input === "/api/proxy") {
      return proxyPost(new Request("http://127.0.0.1:3000/api/proxy", init));
    }
    return nativeFetch(input, init);
  };
  try {
    const proxiedFetch = createA2AProxyFetch();
    const factory = new ClientFactory({
      transports: [new JsonRpcTransportFactory({ fetchImpl: proxiedFetch })],
      cardResolver: new (await import("@a2a-js/sdk/client")).DefaultAgentCardResolver({
        fetchImpl: proxiedFetch,
      }),
    });
    const client = await factory.createFromUrl(baseUrl);
    const events = [];
    for await (const event of client.sendMessageStream({
      tenant: "", configuration: undefined, metadata: undefined,
      message: {
        messageId: "message-2", contextId: "context-2", taskId: "",
        role: Role.ROLE_USER,
        parts: [{ content: { $case: "text", value: "hello" }, metadata: undefined, filename: "", mediaType: "text/plain" }],
        metadata: undefined, extensions: [], referenceTaskIds: [],
      },
    })) {
      events.push(toViewStreamEvent(event));
    }
    assert.equal(events.length, 4);
    assert.equal(events[2].artifact.parts[0].text, "Found the repository");
    assert.equal(methods.at(-1), "SendStreamingMessage");
  } finally {
    globalThis.fetch = nativeFetch;
  }
});
