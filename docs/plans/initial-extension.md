# Initial Bedrock tool-result image extension

## Problem

Amazon Bedrock Converse only documents nested `toolResult` images for Anthropic Claude and Amazon Nova. Other image-capable models reject Pi's nested representation, leaving sessions unable to continue after an image-producing tool runs.

## Approach

Publish a Pi package that intercepts Bedrock Converse payloads immediately before dispatch. For models other than Anthropic Claude and Amazon Nova, it will move images out of each `toolResult.content` array and place them beside the tool result in the containing user message, preserving text, status, ordering, and a non-empty tool result.

## Changes

| File | Change |
| --- | --- |
| `src/payload.ts` | Validate and immutably rewrite affected Bedrock Converse message payloads. |
| `src/index.ts` | Register the `before_provider_request` hook with provider/model guards. |
| `tests/*.test.ts` | Cover supported-family exclusions, affected models, malformed payloads, ordering, and extension integration. |
| `package.json`, `tsconfig.json` | Configure the publishable Pi package and TypeScript checks. |
| `README.md`, `CHANGELOG.md`, `LICENSE` | Document installation, behavior, limitations, provenance, and licensing. |
| `.github/workflows/ci.yml` | Run typechecking and tests on supported Node versions. |

## Verification

- Unit tests prove payload transformation and no-op behavior.
- Integration test invokes the registered hook through a small Pi API harness.
- `npm test`, `npm run typecheck`, and package-content smoke checks pass.
