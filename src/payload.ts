const EMPTY_TEXT_PLACEHOLDER = "<empty>";

type UnknownRecord = Record<string, unknown>;

export interface BedrockModelReference {
  id: string;
  name?: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isImageBlock(value: unknown): value is UnknownRecord {
  return isRecord(value) && isRecord(value.image);
}

function isSupportedNestedImageFamily(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[\s_/:]+/gu, ".");

  return (
    normalized.includes("anthropic.claude") ||
    /(?:^|\.)claude(?:\.|$)/u.test(normalized) ||
    normalized.includes("amazon.nova") ||
    /(?:^|\.)nova(?:\.|$)/u.test(normalized)
  );
}

/** Whether Bedrock documents this model family as supporting images inside tool results. */
export function supportsNestedToolResultImages(model: BedrockModelReference): boolean {
  return [model.id, model.name].some(
    (value) => value !== undefined && isSupportedNestedImageFamily(value),
  );
}

function rewriteMessage(message: unknown): { message: unknown; changed: boolean } {
  if (!isRecord(message) || !Array.isArray(message.content)) {
    return { message, changed: false };
  }

  const hoistedImages: UnknownRecord[] = [];
  let changed = false;
  const content = message.content.map((block) => {
    if (!isRecord(block) || !isRecord(block.toolResult)) return block;

    const toolResult = block.toolResult;
    if (!Array.isArray(toolResult.content)) return block;

    const images = toolResult.content.filter(isImageBlock);
    if (images.length === 0) return block;

    const remaining = toolResult.content.filter((item) => !isImageBlock(item));
    hoistedImages.push(...images);
    changed = true;

    return {
      ...block,
      toolResult: {
        ...toolResult,
        content: remaining.length > 0 ? remaining : [{ text: EMPTY_TEXT_PLACEHOLDER }],
      },
    };
  });

  if (!changed) return { message, changed: false };

  return {
    message: { ...message, content: [...content, ...hoistedImages] },
    changed: true,
  };
}

/**
 * Hoist images out of Bedrock Converse tool results without mutating the input payload.
 * Malformed or unrelated payloads are returned unchanged.
 */
export function hoistToolResultImages(payload: unknown): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return payload;

  let changed = false;
  const messages = payload.messages.map((message) => {
    const rewritten = rewriteMessage(message);
    changed ||= rewritten.changed;
    return rewritten.message;
  });

  return changed ? { ...payload, messages } : payload;
}
