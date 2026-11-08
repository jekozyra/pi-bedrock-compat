# pi-bedrock-compat

A [Pi](https://pi.dev) extension that applies compatibility fixes for models accessed through Amazon Bedrock Converse.

## Overview

The extension fixes two issues:

- **Tool-result images** for models that reject images nested inside tool results.
- **Reasoning summaries** for OpenAI GPT models, which otherwise show only `[Reasoning redacted]`.

Both fixes rewrite only the outgoing request. Pi's stored session history is not modified, and unknown or malformed payloads pass through unchanged.

### Tool-result images

Pi normally places images returned by tools inside `toolResult.content`. Amazon Bedrock supports that shape for Anthropic Claude and Amazon Nova, but other image-capable models can reject it with a validation error.

For affected models, this extension moves each image beside its tool result in the outgoing user message. The request remains valid for Bedrock and vision input is preserved.

The rewrite runs only when the selected provider is `amazon-bedrock`, the API is `bedrock-converse-stream`, and the model is not identified as Claude or Nova. It supports system and application inference profiles.

### Reasoning summaries

OpenAI GPT models on Bedrock return encrypted reasoning, which Pi displays as `[Reasoning redacted]`. Bedrock also returns a readable summary when the request sets `reasoning.summary`, which Pi does not send.

When Pi has reasoning enabled for an OpenAI GPT model, the extension adds `summary: "auto"` to `additionalModelRequestFields.reasoning`. The summary streams into Pi as normal thinking, followed by the encrypted `[Reasoning redacted]` block that carries reasoning state between turns.

Bedrock rejects the summary when it is replayed in assistant history:

```text
This model doesn't support the reasoningContent.reasoningText.text field for assistant messages.
```

So the extension also removes `reasoningContent.reasoningText` blocks from outgoing assistant messages for these models and keeps the encrypted `redactedContent` blocks.

The fix applies to Bedrock Converse models whose ID or name contains `gpt-`, except `gpt-oss`. AWS documents `reasoning.summary` for its Responses API; Converse support is observed rather than documented.

## Install

After the package is published, install it from npm:

```bash
pi install npm:pi-bedrock-compat
```

Alternatively, install it directly from GitHub:

```bash
pi install git:github.com/jekozyra/pi-bedrock-compat
```

Restart Pi after installation, or run `/reload` in an active session.

## Usage

No configuration is required.

### Tool-result images

Once installed, the extension automatically changes affected Bedrock Converse requests from this shape:

```text
user: [toolResult(content: [text, image])]
```

To this shape:

```text
user: [toolResult(content: [text]), image]
```

When a tool result contains only images, the extension inserts an `<empty>` text block so Bedrock still receives a non-empty tool result.

### Reasoning summaries

Summaries are on by default. Set `PI_BEDROCK_REASONING_SUMMARY` to choose the level:

| Value                   | Effect                                                        |
| ----------------------- | ------------------------------------------------------------- |
| unset or `auto`         | Most detailed summary the model supports                      |
| `concise` or `detailed` | That summary level                                            |
| `off`                   | No summary is requested. Replayed summaries are still removed |

Keep the extension installed for sessions that already contain summaries. Without it, Pi replays the summary text and Bedrock rejects the next turn.

## Related docs

- [Pi issue #8643](https://github.com/earendil-works/pi/issues/8643)
- [AWS `ToolResultContentBlock.image` API reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolResultContentBlock.html)
- [Amazon Bedrock reasoning summaries for OpenAI models](https://aws.amazon.com/about-aws/whats-new/2026/10/amazon-bedrock-reasoning-summaries-openai/)
- [OpenAI reasoning summaries](https://developers.openai.com/api/docs/guides/reasoning#reasoning-summaries)

## Contributing

To contribute a change, install Node.js 22.19 or newer, then run the project checks locally:

```bash
npm install
npm run check
npm run smoke:package
```

## Maintainers

Maintained by [Jillian Kozyra](https://github.com/jekozyra).

## License

MIT
