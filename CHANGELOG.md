# Changelog

## 0.1.0

- Publish the package as `pi-bedrock-compat` so future Bedrock compatibility fixes can live in the same extension.
- Hoist images out of Bedrock Converse tool results for models other than Anthropic Claude and Amazon Nova.
- Preserve tool-result text, status, ordering, and image-only results.
- Repair outgoing payloads without modifying stored Pi session history.
