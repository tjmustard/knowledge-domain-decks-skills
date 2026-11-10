/*
 * The network edge. Everything else in this package is pure and testable
 * offline; this file is the only part that needs a live endpoint.
 *
 * It speaks Ollama's native /api/chat rather than the OpenAI-compatible path,
 * because the native path is the one that documents `think` and takes
 * `options.num_ctx`, and an explicit context window is the whole point.
 */

export class EndpointError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EndpointError";
    this.details = details;
  }
}

export async function chat({
  endpoint,
  model,
  prompt,
  numCtx,
  numPredict,
  temperature = 0.2,
  seed = 7,
  schema,
  timeoutMs = 30 * 60 * 1000
}) {
  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    stream: false,
    think: false,
    options: { num_ctx: numCtx, num_predict: numPredict, temperature, seed }
  };
  if (schema) body.format = schema;

  let response;
  try {
    response = await fetch(`${endpoint.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const reason = error?.name === "TimeoutError" ? `no reply within ${Math.round(timeoutMs / 1000)}s` : error.message;
    throw new EndpointError(`${model}: request failed — ${reason}`, { model, cause: error?.name });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new EndpointError(`${model}: HTTP ${response.status} — ${text.slice(0, 300)}`, {
      model,
      status: response.status
    });
  }

  const data = await response.json();
  const message = data.message || {};
  return {
    content: message.content || "",
    thinking: message.thinking || "",
    promptTokens: data.prompt_eval_count ?? null,
    completionTokens: data.eval_count ?? null,
    finishReason: data.done_reason || null,
    totalDurationNs: data.total_duration ?? null
  };
}
