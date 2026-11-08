type UnknownRecord = Record<string, unknown>;

export type ReasoningSummary = "auto" | "concise" | "detailed";

export interface BedrockModelReference {
  id: string;
  name?: string;
}

/** Environment variable that selects the summary level, or `off` to disable summaries. */
export const REASONING_SUMMARY_ENV = "PI_BEDROCK_REASONING_SUMMARY";

const SUMMARY_LEVELS = new Set<string>(["auto", "concise", "detailed"]);

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Whether the model is an OpenAI GPT model that takes Bedrock's nested `reasoning` field.
 * gpt-oss uses a flat `reasoning_effort` field and returns plain reasoning text, so it is excluded.
 */
export function isOpenAiGptModel(model: BedrockModelReference): boolean {
  return [model.id, model.name].some((value) => {
    if (value === undefined) {
      return false;
    }
    const normalized = value.toLowerCase();
    return normalized.includes("gpt-") && !normalized.includes("gpt-oss");
  });
}

/** Resolve the requested summary level. Unset or unrecognized values use `auto`. */
export function resolveReasoningSummary(value: string | undefined): ReasoningSummary | undefined {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "off" ||
    normalized === "none" ||
    normalized === "false" ||
    normalized === "0"
  ) {
    return undefined;
  }
  return normalized !== undefined && SUMMARY_LEVELS.has(normalized)
    ? (normalized as ReasoningSummary)
    : "auto";
}

/**
 * Ask Bedrock for a visible reasoning summary when Pi already enabled reasoning.
 * An existing `summary` value is preserved.
 */
export function requestReasoningSummary(payload: unknown, summary: ReasoningSummary): unknown {
  if (!isRecord(payload) || !isRecord(payload.additionalModelRequestFields)) {
    return payload;
  }

  const fields = payload.additionalModelRequestFields;
  if (!isRecord(fields.reasoning) || fields.reasoning.summary !== undefined) {
    return payload;
  }

  return {
    ...payload,
    additionalModelRequestFields: {
      ...fields,
      reasoning: { ...fields.reasoning, summary },
    },
  };
}

function isReasoningTextBlock(value: unknown): boolean {
  return (
    isRecord(value) &&
    isRecord(value.reasoningContent) &&
    isRecord(value.reasoningContent.reasoningText)
  );
}

/**
 * Remove replayed reasoning text from assistant messages.
 *
 * OpenAI models on Bedrock reject `reasoningContent.reasoningText.text` in assistant history.
 * The encrypted `redactedContent` block carries the reasoning state, so the summary is display-only.
 * A message that would become empty is left unchanged.
 */
export function stripReplayedReasoningText(payload: unknown): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    return payload;
  }

  let changed = false;
  const messages = payload.messages.map((message) => {
    if (!isRecord(message) || message.role !== "assistant" || !Array.isArray(message.content)) {
      return message;
    }

    const content = message.content.filter((block) => !isReasoningTextBlock(block));
    if (content.length === message.content.length || content.length === 0) {
      return message;
    }

    changed = true;
    return { ...message, content };
  });

  return changed ? { ...payload, messages } : payload;
}
