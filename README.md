# pi-bedrock-compat

A [Pi](https://pi.dev) extension that applies compatibility fixes for models accessed through Amazon Bedrock Converse.

## Overview

Pi normally places images returned by tools inside `toolResult.content`. Amazon Bedrock supports that shape for Anthropic Claude and Amazon Nova, but other image-capable models can reject it with a validation error.

For affected models, this extension moves each image beside its tool result in the outgoing user message. The request remains valid for Bedrock, vision input is preserved, and Pi's stored session history is not modified.

The rewrite runs only when the selected provider is `amazon-bedrock`, the API is `bedrock-converse-stream`, and the model is not identified as Claude or Nova. It supports system and application inference profiles, and unknown or malformed payloads pass through unchanged.

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

No configuration is required. Once installed, the extension automatically changes affected Bedrock Converse requests from this shape:

```text
user: [toolResult(content: [text, image])]
```

To this shape:

```text
user: [toolResult(content: [text]), image]
```

When a tool result contains only images, the extension inserts an `<empty>` text block so Bedrock still receives a non-empty tool result. The extension does not change encrypted reasoning returned by OpenAI models on Bedrock, which Pi displays as `[Reasoning redacted]`.

## Related docs

- [Pi issue #8643](https://github.com/earendil-works/pi/issues/8643)
- [AWS `ToolResultContentBlock.image` API reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolResultContentBlock.html)

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
