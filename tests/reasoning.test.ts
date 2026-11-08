import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isOpenAiGptModel,
  requestReasoningSummary,
  resolveReasoningSummary,
  stripReplayedReasoningText,
} from "../src/reasoning.ts";

const redacted = { reasoningContent: { redactedContent: new Uint8Array([1, 2, 3]) } };
const summaryText = { reasoningContent: { reasoningText: { text: "**Checking** 391 = 17 x 23" } } };

describe("isOpenAiGptModel", () => {
  it("matches GPT models by ID or application-profile name", () => {
    assert.equal(isOpenAiGptModel({ id: "us.openai.gpt-6-luna" }), true);
    assert.equal(isOpenAiGptModel({ id: "global.openai.gpt-5.6-sol" }), true);
    assert.equal(
      isOpenAiGptModel({
        id: "arn:aws:bedrock:us-east-1:123:application-inference-profile/x",
        name: "OpenAI GPT-6 Luna",
      }),
      true,
    );
  });

  it("excludes gpt-oss and other families", () => {
    assert.equal(isOpenAiGptModel({ id: "openai.gpt-oss-120b-1:0" }), false);
    assert.equal(isOpenAiGptModel({ id: "us.anthropic.claude-sonnet-4-6-v1:0" }), false);
    assert.equal(isOpenAiGptModel({ id: "moonshotai.kimi-k2.5" }), false);
  });
});

describe("resolveReasoningSummary", () => {
  it("defaults to auto", () => {
    assert.equal(resolveReasoningSummary(undefined), "auto");
    assert.equal(resolveReasoningSummary(""), "auto");
    assert.equal(resolveReasoningSummary("bogus"), "auto");
  });

  it("accepts explicit levels and opt-outs", () => {
    assert.equal(resolveReasoningSummary("Detailed"), "detailed");
    assert.equal(resolveReasoningSummary("concise"), "concise");
    for (const value of ["off", "none", "false", "0"]) {
      assert.equal(resolveReasoningSummary(value), undefined, value);
    }
  });
});

describe("requestReasoningSummary", () => {
  it("adds summary beside Pi's reasoning effort without mutating input", () => {
    const input = {
      modelId: "us.openai.gpt-6-luna",
      additionalModelRequestFields: { reasoning: { effort: "high" }, other: 1 },
    };
    const snapshot = structuredClone(input);

    const output = requestReasoningSummary(input, "auto");

    assert.deepEqual(output, {
      modelId: "us.openai.gpt-6-luna",
      additionalModelRequestFields: { reasoning: { effort: "high", summary: "auto" }, other: 1 },
    });
    assert.deepEqual(input, snapshot);
  });

  it("leaves payloads without reasoning or with an explicit summary unchanged", () => {
    const off = { modelId: "x" };
    const flat = { additionalModelRequestFields: { reasoning_effort: "low" } };
    const explicit = {
      additionalModelRequestFields: { reasoning: { effort: "low", summary: "concise" } },
    };

    assert.equal(requestReasoningSummary(off, "auto"), off);
    assert.equal(requestReasoningSummary(flat, "auto"), flat);
    assert.equal(requestReasoningSummary(explicit, "auto"), explicit);
    assert.equal(requestReasoningSummary(null, "auto"), null);
  });
});

describe("stripReplayedReasoningText", () => {
  it("drops reasoning text from assistant history and keeps encrypted reasoning", () => {
    const input = {
      messages: [
        { role: "user", content: [{ text: "Is 391 prime?" }] },
        { role: "assistant", content: [summaryText, redacted, { text: "No." }] },
        { role: "user", content: [{ text: "And 397?" }] },
      ],
    };
    const snapshot = structuredClone(input);

    const output = stripReplayedReasoningText(input) as typeof input;

    assert.deepEqual(output.messages[1].content, [redacted, { text: "No." }]);
    assert.equal(output.messages[0], input.messages[0]);
    assert.deepEqual(input, snapshot);
  });

  it("returns the same payload when nothing changes", () => {
    const input = {
      messages: [
        { role: "user", content: [summaryText] },
        { role: "assistant", content: [redacted, { text: "No." }] },
      ],
    };

    assert.equal(stripReplayedReasoningText(input), input);
    const unrelated = { other: true };
    assert.equal(stripReplayedReasoningText(unrelated), unrelated);
  });

  it("drops a summary-only assistant message instead of replaying rejected reasoning", () => {
    const first = { role: "user", content: [{ text: "Is 391 prime?" }] };
    const last = { role: "user", content: [{ text: "And 397?" }] };
    const input = { messages: [first, { role: "assistant", content: [summaryText] }, last] };
    const snapshot = structuredClone(input);

    assert.deepEqual(stripReplayedReasoningText(input), { messages: [first, last] });
    assert.deepEqual(input, snapshot);
  });
});
