# Changelog

## Unreleased

- Request reasoning summaries for OpenAI GPT models on Bedrock Converse so Pi shows readable thinking instead of only `[Reasoning redacted]`. Set `PI_BEDROCK_REASONING_SUMMARY` to `concise`, `detailed`, or `off`.
- Strip replayed reasoning summaries from outgoing assistant history, which Bedrock rejects for OpenAI models, while keeping encrypted reasoning.

## 0.1.0

- Publish the package as `pi-bedrock-compat` so future Bedrock compatibility fixes can live in the same extension.
- Hoist images out of Bedrock Converse tool results for models other than Anthropic Claude and Amazon Nova.
- Preserve tool-result text, status, ordering, and image-only results.
- Repair outgoing payloads without modifying stored Pi session history.
