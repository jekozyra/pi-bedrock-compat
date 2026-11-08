import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import register, {
  rewritePayload,
  shouldRewrite,
  shouldRewriteReasoning,
  type ProviderModel,
} from "../src/index.ts";

type Handler = (event: { payload: unknown }, ctx: { model?: ProviderModel }) => unknown;

function captureHandler(): Handler {
  let handler: Handler | undefined;
  const pi = {
    on(event: string, candidate: Handler) {
      assert.equal(event, "before_provider_request");
      handler = candidate;
      return () => {};
    },
  };

  register(pi as unknown as ExtensionAPI);
  assert.ok(handler);
  return handler;
}

const bedrock = (id: string, name?: string): ProviderModel => ({
  provider: "amazon-bedrock",
  api: "bedrock-converse-stream",
  id,
  name,
});

describe("shouldRewrite", () => {
  it("selects unsupported Bedrock Converse model families", () => {
    assert.equal(shouldRewrite(bedrock("global.openai.gpt-5.6-sol")), true);
    assert.equal(shouldRewrite(bedrock("moonshotai.kimi-k2.5")), true);
  });

  it("excludes Claude, Nova, other providers, and other Bedrock APIs", () => {
    assert.equal(shouldRewrite(bedrock("us.anthropic.claude-sonnet-4-6-v1:0")), false);
    assert.equal(shouldRewrite(bedrock("amazon.nova-pro-v1:0")), false);
    assert.equal(shouldRewrite({ ...bedrock("openai.gpt-5.6-sol"), provider: "openai" }), false);
    assert.equal(
      shouldRewrite({ ...bedrock("openai.gpt-5.6-sol"), api: "openai-responses" }),
      false,
    );
    assert.equal(shouldRewrite(undefined), false);
  });
});

describe("shouldRewriteReasoning", () => {
  it("selects OpenAI GPT models on Bedrock Converse only", () => {
    assert.equal(shouldRewriteReasoning(bedrock("us.openai.gpt-6-luna")), true);
    assert.equal(shouldRewriteReasoning(bedrock("openai.gpt-oss-120b-1:0")), false);
    assert.equal(shouldRewriteReasoning(bedrock("us.anthropic.claude-sonnet-4-6-v1:0")), false);
    assert.equal(
      shouldRewriteReasoning({ ...bedrock("us.openai.gpt-6-luna"), api: "openai-responses" }),
      false,
    );
    assert.equal(shouldRewriteReasoning(undefined), false);
  });
});

describe("rewritePayload reasoning", () => {
  const redacted = { reasoningContent: { redactedContent: new Uint8Array([9]) } };
  const summaryText = { reasoningContent: { reasoningText: { text: "summary" } } };
  const payload = () => ({
    additionalModelRequestFields: { reasoning: { effort: "medium" } },
    messages: [
      { role: "user", content: [{ text: "q1" }] },
      { role: "assistant", content: [summaryText, redacted, { text: "a1" }] },
      { role: "user", content: [{ text: "q2" }] },
    ],
  });

  it("requests summaries and strips replayed summaries for GPT models", () => {
    const output = rewritePayload(payload(), bedrock("us.openai.gpt-6-luna"), {}) as ReturnType<
      typeof payload
    >;

    assert.deepEqual(output.additionalModelRequestFields, {
      reasoning: { effort: "medium", summary: "auto" },
    });
    assert.deepEqual(output.messages[1].content, [redacted, { text: "a1" }]);
  });

  it("honors the summary level and opt-out", () => {
    const model = bedrock("us.openai.gpt-6-luna");
    const detailed = rewritePayload(payload(), model, {
      PI_BEDROCK_REASONING_SUMMARY: "detailed",
    }) as ReturnType<typeof payload>;
    const off = rewritePayload(payload(), model, {
      PI_BEDROCK_REASONING_SUMMARY: "off",
    }) as ReturnType<typeof payload>;

    assert.deepEqual(detailed.additionalModelRequestFields.reasoning, {
      effort: "medium",
      summary: "detailed",
    });
    assert.deepEqual(off.additionalModelRequestFields.reasoning, { effort: "medium" });
    // Replay cleanup still runs so sessions with stored summaries keep working.
    assert.deepEqual(off.messages[1].content, [redacted, { text: "a1" }]);
  });

  it("does not touch Claude reasoning", () => {
    const input = payload();

    assert.equal(rewritePayload(input, bedrock("us.anthropic.claude-sonnet-4-6-v1:0"), {}), input);
  });
});

describe("extension", () => {
  it("rewrites affected payloads through the Pi hook", () => {
    const handler = captureHandler();
    const image = { image: { format: "png", source: { bytes: new Uint8Array([1]) } } };
    const payload = {
      messages: [
        {
          role: "user",
          content: [{ toolResult: { toolUseId: "read", content: [image] } }],
        },
      ],
    };

    const output = handler(
      { payload },
      { model: bedrock("global.openai.gpt-6-astra") },
    ) as typeof payload;

    assert.deepEqual(output.messages[0].content, [
      { toolResult: { toolUseId: "read", content: [{ text: "<empty>" }] } },
      image,
    ]);
  });

  it("returns undefined for excluded models and no-op payloads", () => {
    const handler = captureHandler();
    const plain = { messages: [{ role: "user", content: [{ text: "hello" }] }] };

    assert.equal(
      handler({ payload: plain }, { model: bedrock("amazon.nova-pro-v1:0") }),
      undefined,
    );
    assert.equal(
      handler({ payload: plain }, { model: bedrock("global.openai.gpt-5.6-sol") }),
      undefined,
    );
  });
});
