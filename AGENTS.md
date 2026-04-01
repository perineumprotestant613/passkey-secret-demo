# AGENTS.md

This repository is a focused open-source demo for one specific idea:

- protecting browser-stored secrets with WebAuthn PRF / passkeys
- using a recovery passphrase as fallback
- presenting the pattern honestly, with a working demo and clear tradeoffs

This repo exists because a standalone demo + OSS reference is more useful right now than prematurely shipping an npm package. The goal is to make the security pattern easy to understand, inspect, try, and discuss.

## Primary Goal

Build a small, credible demo that shows:

1. a secret can be encrypted locally in the browser
2. passkey unlock can be used as a local unwrap mechanism
3. a recovery passphrase remains available as fallback
4. the stored data is ciphertext, not plaintext API keys in browser storage

The repo should help support:

- a blog post
- a live demo
- an OSS reference implementation

## Non-Goals

Do not turn this into:

- a full password manager
- a backend-dependent auth product
- a generic secret-sync platform
- an over-abstracted crypto library
- a marketing-heavy project that overclaims security

Do not optimize for broad package API surface first. Optimize for clarity and credibility.

## Security Positioning

Be precise and conservative in all docs and UI copy.

Allowed claims:

- protects secrets at rest better than plaintext `localStorage` / `IndexedDB`
- makes storage exfiltration harder because the stored value is encrypted
- introduces user-mediated unlock via passkey
- reduces risk from database leaks if only ciphertext is persisted remotely

Disallowed claims:

- "prevents XSS"
- "solves browser security"
- "zero trust"
- "military-grade" or similar vague language

Required framing:

- this does not make secrets immune to XSS
- a sufficiently capable same-origin XSS can still compromise live sessions or decrypted in-memory data
- this is mainly an encrypted-at-rest and user-presence improvement over plaintext browser storage

## Product / Story Constraints

The repo should support this story arc:

1. Problem: BYOK secrets in web apps are awkward to protect
2. Why obvious solutions are unsatisfying
3. The chosen design: passkey unlock + recovery passphrase
4. Live demo
5. Technical overview
6. Tradeoffs and caveats

The implementation should stay aligned with that narrative. If a feature does not help tell or validate that story, it is probably out of scope.

## Demo Requirements

The eventual demo should be simple enough that a reader understands it in under a minute.

Suggested flow:

1. Enter a fake API key
2. Encrypt locally with a recovery passphrase
3. Enable / register passkey protection
4. Refresh or simulate a locked state
5. Unlock with passkey
6. Decrypt locally
7. Inspect stored ciphertext / metadata

The UI should make visible:

- plaintext input
- encrypted blob / stored envelope
- whether a passkey is registered
- whether a session is currently unlocked
- what is stored locally

## Implementation Guidance

Prefer:

- a simple browser-first stack
- minimal dependencies
- readable code over clever abstractions
- explicit crypto/data flow
- code that is easy to lift into other projects later if needed

Avoid:

- framework-specific complexity unless it materially improves the demo
- unnecessary backend services
- hidden magic around storage or key handling

If a package-worthy module naturally emerges, keep it as an internal module first. Do not design the repo around publishing to npm yet.

## Documentation Requirements

The README should eventually include:

- what problem this solves
- what it does not solve
- a short threat model
- how the demo works
- local development instructions
- browser support caveats

Any technical explanation should distinguish:

- encrypted payload
- recovery passphrase wrap
- passkey-derived wrap
- local config / local metadata
- in-memory unlocked session state

## Working Style

When implementing later:

- keep the repo narrowly scoped
- prefer incremental, reviewable changes
- test the core flow manually and, where sensible, with lightweight automated tests
- preserve honesty in UX copy and docs over conversion polish

If tradeoffs are unclear, choose the option that is easier to explain, demo, and audit.
