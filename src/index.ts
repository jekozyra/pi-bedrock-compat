import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { hoistToolResultImages, supportsNestedToolResultImages } from "./payload.ts";

export interface ProviderModel {
  provider: string;
  api: string;
  id: string;
  name?: string;
}

export function shouldRewrite(model: ProviderModel | undefined): boolean {
  return (
    model?.provider === "amazon-bedrock" &&
    model.api === "bedrock-converse-stream" &&
    !supportsNestedToolResultImages(model)
  );
}

export default function bedrockCompat(pi: ExtensionAPI): void {
  pi.on("before_provider_request", (event, ctx) => {
    if (!shouldRewrite(ctx.model)) {
      return undefined;
    }

    const rewritten = hoistToolResultImages(event.payload);
    return rewritten === event.payload ? undefined : rewritten;
  });
}
