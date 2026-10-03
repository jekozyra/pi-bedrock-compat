# pi-bedrock-compat

A [Pi](https://pi.dev) extension for compatibility fixes needed by models accessed through Amazon Bedrock Converse.

## Tool-result images

The extension currently fixes image placement for Bedrock models that do not support images nested inside tool results.

Pi normally places images returned by tools inside `toolResult.content`. Amazon Bedrock documents that nested shape only for Anthropic Claude and Amazon Nova. Other image-capable Bedrock models can accept the same image in an ordinary user content block but reject it inside a tool result with:

```text
Validation error: This model doesn't support the image field for user messages. Remove image and try again.
```

This extension rewrites only the outgoing provider payload. It moves nested tool-result images beside the tool result in the same user message, preserving vision input without modifying session history. This also allows an already-affected session to continue.

## Install

From npm after publication:

```bash
pi install npm:pi-bedrock-compat
```

Directly from GitHub:

```bash
pi install git:github.com/jekozyra/pi-bedrock-compat
```

Restart Pi after installation, or use `/reload` in an active session.

## Scope

The tool-result image fix runs only when all of the following are true:

- the selected provider is `amazon-bedrock`
- its API is `bedrock-converse-stream`
- the model is not identified as Anthropic Claude or Amazon Nova
- at least one tool result contains an image

It supports system and application inference profiles. For an opaque application-profile ARN, Pi's model name is also checked when deciding whether the model is Claude or Nova.

## What changes

Given this Bedrock content:

```text
user: [toolResult(content: [text, image])]
```

The extension sends:

```text
user: [toolResult(content: [text]), image]
```

If a tool result contained only images, the extension leaves a `<empty>` text block so Bedrock still receives a non-empty tool result.

## Safety and limitations

- The transformation is request-local and does not edit Pi's stored transcript.
- Unknown or malformed payloads are left unchanged.
- The extension relies on Pi's `before_provider_request` hook and the current Bedrock Converse payload shape.
- AWS model behavior can differ from its documented support matrix. Hoisting is used as the conservative default outside Claude and Nova.
- OpenAI models on Bedrock return encrypted reasoning that Pi displays as `[Reasoning redacted]`. AWS does not currently expose a request option for visible OpenAI reasoning summaries, so this extension leaves that marker unchanged.

## Development

```bash
npm install
npm run check
npm run smoke:package
```

Requires Node.js 22.19 or newer.

## References

- [Pi issue #8643](https://github.com/earendil-works/pi/issues/8643)
- [AWS `ToolResultContentBlock.image` API reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolResultContentBlock.html)

## License

MIT
