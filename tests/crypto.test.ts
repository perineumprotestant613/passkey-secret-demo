import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { addPasskeyWrap, createEnvelope, unlockWithPasskey, unlockWithRecovery } from "../src/lib/crypto.ts";

describe("crypto envelope helpers", () => {
  it("encrypts a secret and unlocks it with the recovery passphrase", async () => {
    const secret = "sk-demo-openai-1234-example-only";
    const envelope = await createEnvelope(secret, "correct horse battery staple");

    assert.doesNotMatch(JSON.stringify(envelope), new RegExp(secret));

    const unlocked = await unlockWithRecovery(envelope, "correct horse battery staple");

    assert.equal(unlocked.plaintext, secret);
  });

  it("adds a passkey wrap and unlocks with the PRF output", async () => {
    const secret = "sk-demo-openai-1234-example-only";
    const envelope = await createEnvelope(secret, "recovery phrase");
    const { dek } = await unlockWithRecovery(envelope, "recovery phrase");

    const prfInput = crypto.getRandomValues(new Uint8Array(32));
    const prfOutput = crypto.getRandomValues(new Uint8Array(32));

    const updated = await addPasskeyWrap(envelope, dek, "demo-credential-id", prfInput, prfOutput);
    const unlocked = await unlockWithPasskey(updated, prfOutput);

    assert.equal(updated.passkeyWrap?.credentialId, "demo-credential-id");
    assert.equal(unlocked.plaintext, secret);
  });

  it("rejects an incorrect recovery passphrase", async () => {
    const envelope = await createEnvelope("secret", "expected phrase");

    await assert.rejects(
      unlockWithRecovery(envelope, "wrong phrase"),
      /Recovery passphrase could not unwrap the stored key/,
    );
  });
});
