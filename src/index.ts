import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { hoistToolResultImages, supportsNestedToolResultImages } from "./payload.ts";
import {
  REASONING_SUMMARY_ENV,
  isOpenAiGptModel,
  requestReasoningSummary,
  resolveReasoningSummary,
  stripReplayedReasoningText,
} from "./reasoning.ts";

export interface ProviderModel {
  provider: string;
  api: string;
  id: string;
  name?: string;
}

function isBedrockConverse(model: ProviderModel | undefined): model is ProviderModel {
  return model?.provider === "amazon-bedrock" && model.api === "bedrock-converse-stream";
}

/** Whether tool-result images must be hoisted for this model. */
export function shouldRewrite(model: ProviderModel | undefined): boolean {
  return isBedrockConverse(model) && !supportsNestedToolResultImages(model);
}

/** Whether reasoning summaries and replay cleanup apply to this model. */
export function shouldRewriteReasoning(model: ProviderModel | undefined): boolean {
  return isBedrockConverse(model) && isOpenAiGptModel(model);
}

export function rewritePayload(
  payload: unknown,
  model: ProviderModel | undefined,
  env: NodeJS.ProcessEnv = process.env,
): unknown {
  let output = payload;

  if (shouldRewrite(model)) {
    output = hoistToolResultImages(output);
  }

  if (shouldRewriteReasoning(model)) {
    // Always strip replayed summaries: Bedrock rejects them even when summaries are now disabled.
    output = stripReplayedReasoningText(output);
    const summary = resolveReasoningSummary(env[REASONING_SUMMARY_ENV]);
    if (summary !== undefined) {
      output = requestReasoningSummary(output, summary);
    }
  }

  return output;
}

export default function bedrockCompat(pi: ExtensionAPI): void {
  pi.on("before_provider_request", (event, ctx) => {
    const rewritten = rewritePayload(event.payload, ctx.model);
    return rewritten === event.payload ? undefined : rewritten;
  });
}
