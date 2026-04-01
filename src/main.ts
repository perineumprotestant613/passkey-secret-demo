import { base64ToBytes } from "./lib/base64.ts";
import { addPasskeyWrap, createEnvelope, unlockWithPasskey, unlockWithRecovery } from "./lib/crypto.ts";
import { evaluatePrf, registerPasskey } from "./lib/passkey.ts";
import { clearEnvelope, loadEnvelope, saveEnvelope } from "./lib/storage.ts";
import type { DemoSession, StoredEnvelope } from "./lib/types.ts";

type Role = "assistant" | "user";
type UnlockMode = "choice" | "passphrase";

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
}

interface AppState {
  envelope: StoredEnvelope | null;
  session: DemoSession | null;
  messages: ChatMessage[];
  composerValue: string;
  modalOpen: boolean;
  setupError: string | null;
  unlockModalOpen: boolean;
  unlockMode: UnlockMode;
  unlockError: string | null;
  unlockPassphrase: string;
  pendingPrompt: string | null;
  busy: boolean;
  busyLabel: string;
}

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found.");
}

const initialEnvelope = loadEnvelope();

const state: AppState = {
  envelope: initialEnvelope,
  session: null,
  messages: buildInitialMessages(initialEnvelope),
  composerValue: "",
  modalOpen: false,
  setupError: null,
  unlockModalOpen: false,
  unlockMode: "choice",
  unlockError: null,
  unlockPassphrase: "",
  pendingPrompt: null,
  busy: false,
  busyLabel: "",
};

app.innerHTML = `
  <main class="app-shell">
    <section class="chat-card">
      <header class="chat-header">
        <div>
          <div class="chat-title-row">
            <div class="chat-title">Passkey Secret Demo</div>
            <a
              class="chat-title-link"
              href="https://github.com/BoltAI/passkey-secret-demo"
              target="_blank"
              rel="noreferrer"
              aria-label="View source code on GitHub"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-1.96c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.18 1.77 1.18 1.03 1.76 2.7 1.25 3.36.95.1-.75.4-1.25.72-1.53-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.97 10.97 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.09 0 4.43-2.69 5.4-5.26 5.68.41.35.78 1.04.78 2.1v3.12c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
              </svg>
            </a>
          </div>
          <div class="chat-subtitle">
            100% local demo. No server or backend involved.
          </div>
        </div>
        <div class="chat-header-actions">
          <div class="chat-meta">
            <span class="status-dot" id="passkey-indicator"></span>
            <span id="status-copy"></span>
          </div>
          <button type="button" id="reset-button" class="ghost-button ghost-button-header">Reset</button>
        </div>
      </header>

      <section class="chat-thread" id="chat-thread"></section>

      <footer class="composer-shell">
        <form id="composer-form" class="composer">
          <textarea
            id="composer-input"
            rows="1"
            placeholder="Send a message"
          ></textarea>
          <div class="composer-actions">
            <button type="submit" id="send-button" class="send-button">Send</button>
          </div>
        </form>
        <div class="composer-footer">
          <div class="composer-hint" id="composer-hint"></div>
          <div class="composer-credit">
            Brought to you by
            <a href="https://boltai.com" target="_blank" rel="noreferrer">BoltAI</a>
          </div>
        </div>
      </footer>
    </section>

    <div class="modal-backdrop" id="setup-modal">
      <div class="setup-modal">
        <div class="setup-topline">
          <div class="setup-kicker">Setup</div>
          <button type="button" id="setup-dismiss" class="modal-dismiss" aria-label="Dismiss setup">Close</button>
        </div>
        <h1>Protect your API key with a passkey</h1>
        <p class="setup-copy">
          Enter a fake API key and a recovery passphrase. On submit, the secret is encrypted locally and we immediately
          register a passkey wrap so later sends can trigger Touch ID. The secret stays in this browser only.
        </p>

        <div id="setup-error" class="modal-error" hidden></div>

        <form id="setup-form" class="setup-form">
          <label class="input-group">
            <span>API key</span>
            <input id="api-key-input" type="password" placeholder="sk-..." autocomplete="off" />
          </label>

          <label class="input-group">
            <span>Recovery passphrase</span>
            <input id="recovery-input" type="password" placeholder="Used as fallback if passkey is unavailable" autocomplete="off" />
          </label>

          <div class="setup-actions">
            <button type="submit" id="setup-submit" class="send-button">Save and register passkey</button>
          </div>
        </form>
      </div>
    </div>

    <div class="modal-backdrop" id="unlock-modal" hidden>
      <div class="setup-modal unlock-modal" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
        <button type="button" id="unlock-dismiss" class="unlock-close" aria-label="Close unlock dialog">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
          </svg>
        </button>

        <section id="unlock-choice-screen" class="unlock-screen">
          <div class="unlock-hero-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M7.5 10V7.25C7.5 4.62665 9.62665 2.5 12.25 2.5C14.8734 2.5 17 4.62665 17 7.25V10"
                stroke="currentColor"
                stroke-width="1.85"
                stroke-linecap="round"
              />
              <rect x="5" y="9.5" width="14.5" height="12" rx="3.2" fill="currentColor" />
            </svg>
          </div>

          <div class="unlock-copy-stack">
            <div class="unlock-kicker">Unlock</div>
            <h1 id="unlock-title">Unlock API Key</h1>
            <p class="setup-copy unlock-copy">
              Choose how to unlock your locally stored API key for this send. Nothing leaves this browser.
            </p>
          </div>

          <div id="unlock-choice-error" class="modal-error modal-error-centered" hidden></div>

          <div class="unlock-choice">
            <button type="button" id="unlock-passkey-button" class="unlock-primary">
              <span class="unlock-button-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18.301 3.529a.49.49 0 0 1-.249-.068A11.698 11.698 0 0 0 12.016 1.875c-2.145 0-4.183.529-6.036 1.586a.49.49 0 0 1-.714-.181.581.581 0 0 1 .217-.765A13.21 13.21 0 0 1 12.016.75c2.307 0 4.323.529 6.534 1.71a.562.562 0 0 1 .227.754.53.53 0 0 1-.476.315zm-15.506 5.906a.55.55 0 0 1-.314-.102.575.575 0 0 1-.13-.787 8.911 8.911 0 0 1 4.063-3.679 12.48 12.48 0 0 1 11.171-.011 8.996 8.996 0 0 1 4.064 3.656.576.576 0 0 1-.131.787.528.528 0 0 1-.758-.135 7.817 7.817 0 0 0-3.673-3.307 11.328 11.328 0 0 0-10.186.011 7.926 7.926 0 0 0-3.685 3.33.469.469 0 0 1-.421.237zM9.569 23.016a.5.5 0 0 1-.379-.169 7.57 7.57 0 0 1-2.176-2.971 9.646 9.646 0 0 1-1.138-4.882c0-3.341 2.752-6.063 6.134-6.063s6.134 2.722 6.134 6.063a.542.542 0 1 1-1.084 0c0-2.722-2.265-4.937-5.05-4.937S6.96 12.272 6.96 14.994c0 1.62.346 3.116 1.007 4.331.693 1.293 1.17 1.844 2.002 2.722a.594.594 0 0 1 0 .799.583.583 0 0 1-.4.17zm7.77-2.081c-1.29 0-2.428-.338-3.36-1.002a6.052 6.052 0 0 1-2.578-4.939.542.542 0 1 1 1.084 0 4.888 4.888 0 0 0 2.103 4.005c.77.54 1.669.797 2.752.797.379 0 .756-.034 1.126-.113a.578.578 0 0 1 .629.461.558.558 0 0 1-.444.653 7.138 7.138 0 0 1-1.312.138zm-2.177 2.081a.61.61 0 0 1-.14-.022c-1.724-.495-2.852-1.159-4.032-2.362a8.467 8.467 0 0 1-2.35-5.87c0-1.822 1.495-3.307 3.337-3.307s3.337 1.485 3.337 3.307c0 1.203 1.007 2.182 2.253 2.182s2.253-.979 2.253-2.182c0-4.241-3.521-7.683-7.858-7.683-3.078 0-5.896 1.777-7.163 4.534-.423.911-.639 1.98-.639 3.149 0 .878.076 2.261.726 4.061a.565.565 0 0 1-.314.72.532.532 0 0 1-.694-.327A12.956 12.956 0 0 1 3 14.994c0-1.35.25-2.576.737-3.645a9.5 9.5 0 0 1 8.141-5.175c4.938 0 8.949 3.953 8.949 8.82 0 1.822-1.495 3.307-3.337 3.307s-3.337-1.485-3.337-3.307c0-1.203-1.007-2.183-2.253-2.183s-2.253.979-2.253 2.182a7.357 7.357 0 0 0 2.027 5.084c1.031 1.057 2.016 1.639 3.543 2.08a.555.555 0 0 1 .379.687.534.534 0 0 1-.51.429z"
                    stroke="currentColor"
                    stroke-width="0"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span>Unlock with passkey</span>
            </button>

            <button type="button" id="show-passphrase-button" class="unlock-link">
              Use passphrase instead
            </button>
          </div>
        </section>

        <section id="unlock-passphrase-screen" class="unlock-screen" hidden>
          <div class="unlock-hero-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M7.5 10V7.25C7.5 4.62665 9.62665 2.5 12.25 2.5C14.8734 2.5 17 4.62665 17 7.25V10"
                stroke="currentColor"
                stroke-width="1.85"
                stroke-linecap="round"
              />
              <rect x="5" y="9.5" width="14.5" height="12" rx="3.2" fill="currentColor" />
            </svg>
          </div>

          <div class="unlock-copy-stack">
            <div class="unlock-kicker">Unlock</div>
            <h1>Unlock API Key</h1>
            <p class="setup-copy unlock-copy">
              Enter your recovery passphrase to decrypt the API key stored locally in this browser.
            </p>
          </div>

          <div id="unlock-passphrase-error" class="modal-error modal-error-centered" hidden></div>

          <form id="unlock-passphrase-form" class="setup-form unlock-passphrase-form">
            <label class="input-group unlock-input-group">
              <span>Recovery passphrase</span>
              <input id="unlock-passphrase-input" type="password" placeholder="Enter your passphrase" autocomplete="off" />
            </label>

            <div class="setup-actions unlock-actions">
              <button type="submit" id="unlock-passphrase-submit" class="send-button">Unlock</button>
            </div>
          </form>

          <button type="button" id="show-passkey-button" class="unlock-link">
            Back to passkey
          </button>
        </section>
      </div>
    </div>
  </main>
`;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required UI element missing: ${selector}`);
  }

  return element;
}

const thread = requiredElement<HTMLElement>("#chat-thread");
const statusCopy = requiredElement<HTMLElement>("#status-copy");
const passkeyIndicator = requiredElement<HTMLElement>("#passkey-indicator");
const composerHint = requiredElement<HTMLElement>("#composer-hint");
const composerForm = requiredElement<HTMLFormElement>("#composer-form");
const composerInput = requiredElement<HTMLTextAreaElement>("#composer-input");
const sendButton = requiredElement<HTMLButtonElement>("#send-button");
const resetButton = requiredElement<HTMLButtonElement>("#reset-button");
const setupModal = requiredElement<HTMLElement>("#setup-modal");
const setupForm = requiredElement<HTMLFormElement>("#setup-form");
const apiKeyInput = requiredElement<HTMLInputElement>("#api-key-input");
const recoveryInput = requiredElement<HTMLInputElement>("#recovery-input");
const setupSubmit = requiredElement<HTMLButtonElement>("#setup-submit");
const setupDismiss = requiredElement<HTMLButtonElement>("#setup-dismiss");
const setupError = requiredElement<HTMLElement>("#setup-error");
const unlockModal = requiredElement<HTMLElement>("#unlock-modal");
const unlockDismiss = requiredElement<HTMLButtonElement>("#unlock-dismiss");
const unlockChoiceScreen = requiredElement<HTMLElement>("#unlock-choice-screen");
const unlockPassphraseScreen = requiredElement<HTMLElement>("#unlock-passphrase-screen");
const unlockChoiceError = requiredElement<HTMLElement>("#unlock-choice-error");
const unlockPassphraseError = requiredElement<HTMLElement>("#unlock-passphrase-error");
const unlockPasskeyButton = requiredElement<HTMLButtonElement>("#unlock-passkey-button");
const showPassphraseButton = requiredElement<HTMLButtonElement>("#show-passphrase-button");
const showPasskeyButton = requiredElement<HTMLButtonElement>("#show-passkey-button");
const unlockPassphraseForm = requiredElement<HTMLFormElement>("#unlock-passphrase-form");
const unlockPassphraseInput = requiredElement<HTMLInputElement>("#unlock-passphrase-input");
const unlockPassphraseSubmit = requiredElement<HTMLButtonElement>("#unlock-passphrase-submit");

function buildInitialMessages(envelope: StoredEnvelope | null): ChatMessage[] {
  if (!envelope?.passkeyWrap) {
    return [
      assistantMessage(
        "Send a message to begin. I’ll only ask for a local API key when you actually try to send something, and everything stays in this browser.",
      ),
    ];
  }

  return [
      assistantMessage(
        "Passkey protection is already set up on this browser. Refresh complete. Send a message and I’ll ask how you want to unlock the local secret first.",
      ),
    ];
}

function createId(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

function assistantMessage(text: string): ChatMessage {
  return {
    id: createId(),
    role: "assistant",
    text,
  };
}

function userMessage(text: string): ChatMessage {
  return {
    id: createId(),
    role: "user",
    text,
  };
}

function scrollThreadToBottom(): void {
  thread.scrollTop = thread.scrollHeight;
}

function renderMessages(): void {
  thread.innerHTML = state.messages
    .map(
      (message) => `
        <article class="bubble-row bubble-row-${message.role}">
          <div class="bubble bubble-${message.role}">${renderMessageText(message.text)}</div>
        </article>
      `,
    )
    .join("");

  scrollThreadToBottom();
}

function renderHeader(): void {
  const hasPasskey = Boolean(state.envelope?.passkeyWrap);
  const unlocked = Boolean(state.session);

  statusCopy.textContent = hasPasskey
    ? unlocked
      ? "Unlocked in memory"
      : "Passkey ready"
    : "Setup required";
  passkeyIndicator.dataset.state = hasPasskey ? (unlocked ? "unlocked" : "locked") : "empty";
}

function renderComposer(): void {
  composerInput.value = state.composerValue;
  composerInput.disabled = state.busy || state.modalOpen || state.unlockModalOpen;
  sendButton.disabled =
    state.busy || state.modalOpen || state.unlockModalOpen || state.composerValue.trim().length === 0;
  resetButton.disabled = state.busy;

  if (state.busy) {
    composerHint.textContent = state.busyLabel;
    return;
  }

  if (state.modalOpen) {
    composerHint.textContent = "Finish setup to continue.";
    return;
  }

  if (state.unlockModalOpen) {
    composerHint.textContent = "Choose how to unlock before sending.";
    return;
  }

  if (!state.envelope?.passkeyWrap) {
    composerHint.textContent = "100% local. Nothing is sent anywhere in this demo.";
    return;
  }

  if (!state.session) {
    composerHint.textContent = "Your next send will ask how to unlock the local key.";
    return;
  }

  composerHint.textContent = `Unlocked with ${state.session.unlockedWith}. Refresh or reset to lock again.`;
}

function renderModal(): void {
  setupModal.hidden = !state.modalOpen;
  setupModal.setAttribute("aria-hidden", String(!state.modalOpen));
  apiKeyInput.disabled = state.busy;
  recoveryInput.disabled = state.busy;
  setupSubmit.disabled = state.busy;
  setupDismiss.disabled = state.busy;
  setupError.hidden = !state.setupError;
  setupError.textContent = state.setupError ?? "";
}

function renderUnlockModal(): void {
  unlockModal.hidden = !state.unlockModalOpen;
  unlockModal.setAttribute("aria-hidden", String(!state.unlockModalOpen));

  const passphraseMode = state.unlockMode === "passphrase";

  unlockChoiceScreen.hidden = passphraseMode;
  unlockPassphraseScreen.hidden = !passphraseMode;
  unlockPasskeyButton.disabled = state.busy;
  showPassphraseButton.disabled = state.busy;
  showPasskeyButton.disabled = state.busy;
  unlockDismiss.disabled = state.busy;
  unlockPassphraseInput.disabled = state.busy;
  unlockPassphraseSubmit.disabled = state.busy;
  unlockPassphraseInput.value = state.unlockPassphrase;
  unlockChoiceError.hidden = passphraseMode || !state.unlockError;
  unlockChoiceError.textContent = state.unlockError ?? "";
  unlockPassphraseError.hidden = !passphraseMode || !state.unlockError;
  unlockPassphraseError.textContent = state.unlockError ?? "";
}

function render(): void {
  renderHeader();
  renderMessages();
  renderComposer();
  renderModal();
  renderUnlockModal();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMessageText(value: string): string {
  const codeBlockPattern = /```([a-z0-9_-]+)?\n?([\s\S]*?)```/gi;
  let lastIndex = 0;
  let html = "";

  for (const match of value.matchAll(codeBlockPattern)) {
    const [fullMatch, language = "", code = ""] = match;
    const start = match.index ?? 0;

    if (start > lastIndex) {
      html += renderParagraphs(value.slice(lastIndex, start));
    }

    html += `<pre class="message-code"><code class="language-${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`;
    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < value.length) {
    html += renderParagraphs(value.slice(lastIndex));
  }

  return html;
}

function renderParagraphs(value: string): string {
  return value
    .split(/\n\n+/)
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => `<p>${renderInlineText(chunk)}</p>`)
    .join("");
}

function renderInlineText(value: string): string {
  return escapeHtml(value)
    .replace("[[api-key-display]]", buildApiKeyDisplay())
    .replace(/\n/g, "<br />");
}

function buildApiKeyDisplay(): string {
  const secret = state.session?.plaintext;

  if (!secret) {
    return `<span class="secret-inline"><code>••••</code></span>`;
  }

  return `
    <span class="secret-inline">
      <code>${escapeHtml(secret)}</code>
    </span>
  `;
}

async function withBusy(
  label: string,
  action: () => Promise<void>,
  errorSurface: "chat" | "setup" | "unlock" = "chat",
): Promise<void> {
  state.busy = true;
  state.busyLabel = label;
  renderComposer();
  renderModal();

  try {
    await action();
  } catch (error) {
    const message = getDisplayErrorMessage(error);

    if (!message) {
      return;
    }

    if (errorSurface === "setup") {
      state.setupError = message;
      return;
    }

    if (errorSurface === "unlock") {
      state.unlockError = message;
      return;
    }

    if (message) {
      state.messages.push(assistantMessage(message));
    }
  } finally {
    state.busy = false;
    state.busyLabel = "";
    render();
  }
}

function getDisplayErrorMessage(error: unknown): string | null {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "AbortError") {
      return null;
    }
  }

  if (error instanceof Error) {
    if (
      error.message.includes("The request is not allowed by the user agent or the platform in the current context")
    ) {
      return null;
    }

    return error.message;
  }

  return "Unexpected error";
}

async function unlockIfNeeded(): Promise<void> {
  if (state.session || !state.envelope?.passkeyWrap) {
    return;
  }

  const prfOutput = await evaluatePrf(
    state.envelope.passkeyWrap.credentialId,
    base64ToBytes(state.envelope.passkeyWrap.prfInput),
  );
  const { plaintext } = await unlockWithPasskey(state.envelope, prfOutput);

  state.session = {
    plaintext,
    unlockedAt: new Date().toISOString(),
    unlockedWith: "passkey",
  };
  state.messages.push(
    assistantMessage("Touch ID approved. The local secret is now unlocked in memory for this session."),
  );
}

async function processPendingPrompt(): Promise<void> {
  const prompt = state.pendingPrompt?.trim();

  if (!prompt) {
    return;
  }

  state.messages.push(userMessage(prompt));
  state.composerValue = "";
  state.pendingPrompt = null;
  state.unlockPassphrase = "";
  state.unlockModalOpen = false;
  state.unlockMode = "choice";
  render();

  state.messages.push(assistantMessage(buildAssistantReply(prompt)));
}

function buildAssistantReply(prompt: string): string {
  const encryptedStored = state.envelope ? "yes" : "no";
  const passkeyReady = state.envelope?.passkeyWrap ? "yes" : "no";
  const encryptedEnvelope = state.envelope ? JSON.stringify(state.envelope, null, 2) : "{}";
  const localOnly = "yes";

  return [
    `Message received: "${prompt}"`,
    "",
    "This demo is currently using:",
    "- API key in memory: [[api-key-display]]",
    `- encrypted data stored locally: ${encryptedStored}`,
    `- passkey wrap registered: ${passkeyReady}`,
    `- unlocked in memory for this session: yes`,
    `- server / backend involved: ${localOnly === "yes" ? "no" : "yes"}`,
    "",
    "Exact encrypted data stored locally:",
    "```json",
    encryptedEnvelope,
    "```",
    "",
    "The important part is that sending this message required a passkey-gated local unlock first.",
  ].join("\n");
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();

  state.setupError = null;

  void withBusy("Encrypting locally and registering passkey", async () => {
    const apiKey = apiKeyInput.value.trim();
    const recoveryPassphrase = recoveryInput.value;

    if (!apiKey) {
      throw new Error("Enter an API key first.");
    }

    if (!recoveryPassphrase) {
      throw new Error("Enter a recovery passphrase first.");
    }

    const envelope = await createEnvelope(apiKey, recoveryPassphrase);
    const { dek } = await unlockWithRecovery(envelope, recoveryPassphrase);
    const prfInput = crypto.getRandomValues(new Uint8Array(32));
    const registration = await registerPasskey(prfInput);
    const prfOutput = registration.prfOutput ?? (await evaluatePrf(registration.credentialId, prfInput));

    state.envelope = await addPasskeyWrap(envelope, dek, registration.credentialId, prfInput, prfOutput);
    saveEnvelope(state.envelope);
    state.session = null;
    state.modalOpen = false;
    apiKeyInput.value = "";
    recoveryInput.value = "";
    state.messages = [
      assistantMessage(
        "Setup complete. Your API key is encrypted locally and wrapped for passkey unlock.",
      ),
      assistantMessage(
        "Now refresh the page, then send any message. That send will open an unlock screen so you can use passkey or recovery passphrase.",
      ),
    ];
  }, "setup");
});

setupDismiss.addEventListener("click", () => {
  if (state.busy) {
    return;
  }

  state.modalOpen = false;
  state.setupError = null;
  render();
});

setupModal.addEventListener("click", (event) => {
  if (state.busy || event.target !== setupModal) {
    return;
  }

  state.modalOpen = false;
  state.setupError = null;
  render();
});

unlockDismiss.addEventListener("click", () => {
  if (state.busy) {
    return;
  }

  state.unlockModalOpen = false;
  state.unlockError = null;
  state.pendingPrompt = null;
  state.unlockPassphrase = "";
  state.unlockMode = "choice";
  render();
});

unlockModal.addEventListener("click", (event) => {
  if (state.busy || event.target !== unlockModal) {
    return;
  }

  state.unlockModalOpen = false;
  state.unlockError = null;
  state.pendingPrompt = null;
  state.unlockPassphrase = "";
  state.unlockMode = "choice";
  render();
});

showPassphraseButton.addEventListener("click", () => {
  state.unlockError = null;
  state.unlockMode = "passphrase";
  renderUnlockModal();
  unlockPassphraseInput.focus();
});

showPasskeyButton.addEventListener("click", () => {
  state.unlockError = null;
  state.unlockMode = "choice";
  renderUnlockModal();
});

unlockPasskeyButton.addEventListener("click", () => {
  state.unlockError = null;

  void withBusy("Waiting for passkey", async () => {
    await unlockIfNeeded();
    await processPendingPrompt();
  }, "unlock");
});

unlockPassphraseInput.addEventListener("input", () => {
  state.unlockPassphrase = unlockPassphraseInput.value;
  state.unlockError = null;
});

unlockPassphraseForm.addEventListener("submit", (event) => {
  event.preventDefault();

  state.unlockError = null;

  void withBusy("Unlocking with recovery passphrase", async () => {
    if (!state.envelope) {
      throw new Error("No stored envelope found.");
    }

    if (!state.unlockPassphrase) {
      throw new Error("Enter the recovery passphrase first.");
    }

    const { plaintext } = await unlockWithRecovery(state.envelope, state.unlockPassphrase);

    state.session = {
      plaintext,
      unlockedAt: new Date().toISOString(),
      unlockedWith: "recovery",
    };
    state.messages.push(assistantMessage("Recovery passphrase approved. The local secret is now unlocked in memory."));
    await processPendingPrompt();
  }, "unlock");
});

composerInput.addEventListener("input", () => {
  state.composerValue = composerInput.value;
  renderComposer();
});

composerInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }

  if (event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  if (sendButton.disabled) {
    return;
  }

  event.preventDefault();
  composerForm.requestSubmit(sendButton);
});

composerForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const prompt = state.composerValue.trim();

  if (!prompt) {
    return;
  }

  if (!state.envelope?.passkeyWrap) {
    state.setupError = null;
    state.modalOpen = true;
    render();
    return;
  }

  if (!state.session) {
    state.pendingPrompt = prompt;
    state.unlockError = null;
    state.unlockModalOpen = true;
    state.unlockMode = "choice";
    render();
    return;
  }

  void withBusy("Sending", async () => {
    state.messages.push(userMessage(prompt));
    state.composerValue = "";
    render();

    state.messages.push(assistantMessage(buildAssistantReply(prompt)));
  });
});

resetButton.addEventListener("click", () => {
  state.session = null;
  state.composerValue = "";
  state.envelope = null;
  state.modalOpen = false;
  state.setupError = null;
  state.unlockModalOpen = false;
  state.unlockMode = "choice";
  state.unlockError = null;
  state.unlockPassphrase = "";
  state.pendingPrompt = null;
  state.messages = [
    assistantMessage(
      "Local setup cleared. Send a message whenever you want to trigger setup again.",
    ),
  ];
  clearEnvelope();
  render();
});

render();
