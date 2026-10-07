import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hoistToolResultImages, supportsNestedToolResultImages } from "../src/payload.ts";

const image = { image: { format: "png", source: { bytes: new Uint8Array([1, 2, 3]) } } };

function payload(content: unknown[]) {
  return {
    modelId: "global.openai.gpt-5.6-sol",
    messages: [{ role: "user", content }],
  };
}

describe("supportsNestedToolResultImages", () => {
  it("recognizes Anthropic Claude and Amazon Nova IDs", () => {
    assert.equal(
      supportsNestedToolResultImages({ id: "us.anthropic.claude-sonnet-4-6-v1:0" }),
      true,
    );
    assert.equal(supportsNestedToolResultImages({ id: "amazon.nova-pro-v1:0" }), true);
  });

  it("recognizes supported families from application profile names", () => {
    assert.equal(
      supportsNestedToolResultImages({
        id: "arn:aws:bedrock:us-east-1:123:application-inference-profile/x",
        name: "Claude Sonnet",
      }),
      true,
    );
    assert.equal(
      supportsNestedToolResultImages({
        id: "arn:aws:bedrock:us-east-1:123:application-inference-profile/y",
        name: "Amazon Nova Pro",
      }),
      true,
    );
  });

  it("does not exempt other Bedrock families", () => {
    for (const id of [
      "global.openai.gpt-5.6-terra",
      "global.openai.gpt-5.6-luna",
      "global.openai.gpt-5.6-sol",
      "global.openai.gpt-6-astra",
      "moonshotai.kimi-k2.5",
    ]) {
      assert.equal(supportsNestedToolResultImages({ id }), false, id);
    }
  });
});

describe("hoistToolResultImages", () => {
  it("moves a nested image beside its tool result", () => {
    const input = payload([
      {
        toolResult: {
          toolUseId: "read-1",
          status: "success",
          content: [{ text: "image.png" }, image],
        },
      },
    ]);

    const output = hoistToolResultImages(input) as typeof input;

    assert.deepEqual(output.messages[0].content, [
      {
        toolResult: {
          toolUseId: "read-1",
          status: "success",
          content: [{ text: "image.png" }],
        },
      },
      image,
    ]);
    assert.notEqual(output, input);
    assert.deepEqual(input.messages[0].content[0], {
      toolResult: {
        toolUseId: "read-1",
        status: "success",
        content: [{ text: "image.png" }, image],
      },
    });
  });

  it("keeps image-only tool results non-empty", () => {
    const input = payload([
      { toolResult: { toolUseId: "shot-1", status: "success", content: [image] } },
    ]);

    const output = hoistToolResultImages(input) as typeof input;

    assert.deepEqual(output.messages[0].content, [
      {
        toolResult: {
          toolUseId: "shot-1",
          status: "success",
          content: [{ text: "<empty>" }],
        },
      },
      image,
    ]);
  });

  it("keeps consecutive tool results together and preserves image order", () => {
    const secondImage = {
      image: { format: "jpeg", source: { bytes: new Uint8Array([4, 5, 6]) } },
    };
    const input = payload([
      { toolResult: { toolUseId: "one", content: [{ text: "one" }, image] } },
      { toolResult: { toolUseId: "two", content: [secondImage, { text: "two" }] } },
    ]);

    const output = hoistToolResultImages(input) as typeof input;

    assert.deepEqual(output.messages[0].content, [
      { toolResult: { toolUseId: "one", content: [{ text: "one" }] } },
      { toolResult: { toolUseId: "two", content: [{ text: "two" }] } },
      image,
      secondImage,
    ]);
  });

  it("returns unrelated and malformed payloads by identity", () => {
    const inputs: unknown[] = [
      null,
      {},
      { messages: "invalid" },
      payload([{ text: "hello" }]),
      payload([{ toolResult: { content: "invalid" } }]),
    ];

    for (const input of inputs) {
      assert.equal(hoistToolResultImages(input), input);
    }
  });
});
