# Agent Codex — agora-convoai-quickstart-nextjs

> Machine-readable project map. Read this before touching any file.

---

## 1. What This Project Is

A Next.js 16 (App Router) quickstart that lets a browser user speak with an Agora Conversational AI agent. The browser joins an Agora RTC channel; a server-side call tells Agora's cloud to spin up an AI agent in the same channel. The agent runs a full ASR → LLM → TTS pipeline and publishes audio back to the channel.

**Stack:** Next.js 16, React 19, TypeScript, Tailwind, pnpm, `agora-rtc-react`, `agora-rtm`, `agora-token`, Vercel AI SDK (`ai`, `@ai-sdk/openai`).

---

## 2. Directory Map

```
app/
  page.tsx                        — root page, renders <LandingPage />
  layout.tsx                      — minimal shell
  globals.css                     — global styles
  api/
    generate-agora-token/route.ts — GET  — issues RTC+RTM token for the browser user
    invite-agent/route.ts         — POST — starts the Agora ConvoAI agent
    stop-conversation/route.ts    — POST — stops the agent
    chat/completions/route.ts     — POST — custom LLM proxy (OpenAI SSE wire format)

components/
  LandingPage.tsx                 — entry UI; owns "start conversation" + AgoraRTCProvider
  ConversationComponent.tsx       — live conversation UI; owns all Agora hooks
  ConvoTextStream.tsx             — floating chat overlay that renders transcripts
  AudioVisualizer.tsx             — waveform for remote (agent) audio track
  MicrophoneButton.tsx            — mute/unmute toggle
  MicrophoneSelector.tsx          — device picker dropdown

lib/
  agora-token.ts                  — v007 token builder + buildAgoraAuthHeader()
  utils.ts                        — cn(), decodeStreamMessage(), renderMarkdownToHtml()
  message.ts                      — MessageEngine class (legacy stream-message path)
  conversational-ai-api/
    index.ts                      — ConversationalAIAPI singleton class
    type.ts                       — all enums + interfaces for the API layer
    utils/
      event.ts                    — EventHelper base class (typed on/off/emit)
      sub-render.ts               — CovSubRenderController (RTM message → transcript)
      logger.ts                   — internal logger factory
      index.ts                    — re-exports

types/
  conversation.ts                 — AgoraTokenData, ClientStartRequest, AgoraStartRequest,
                                    TTSConfig, TTSVendor, StopConversationRequest, AgentResponse,
                                    ConversationComponentProps

hooks/
  use-mobile.tsx                  — useIsMobile() — returns true when viewport < 768 px
```

---

## 3. Environment Variables

All vars live in `.env.local` (gitignored). `env.local.example` is the source of truth for the full list. Never commit `.env.local`.

| Variable | Side | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_AGORA_APP_ID` | client+server | ✅ | Agora project App ID |
| `NEXT_AGORA_APP_CERTIFICATE` | server only | ✅ | Used to sign v007 tokens |
| `NEXT_PUBLIC_AGENT_UID` | client+server | ✅ | Numeric UID Agora assigns the agent (e.g. `"123"`). Must have `NEXT_PUBLIC_` prefix — read client-side in `ConversationComponent` to detect when the agent joins. |
| `NEXT_DEEPGRAM_API_KEY` | server only | ✅ | Deepgram API key for speech-to-text |
| `NEXT_LLM_URL` | server only | ✅ | Any OpenAI-compatible endpoint, e.g. `https://api.openai.com/v1/chat/completions` |
| `NEXT_LLM_API_KEY` | server only | ✅ | Key forwarded to the LLM |
| `NEXT_ELEVENLABS_API_KEY` | server only | ✅ | ElevenLabs API key for text-to-speech |

**`NEXT_PUBLIC_` prefix** = exposed to the browser bundle. All others are server-only.

---

## 4. API Routes

### `GET /api/generate-agora-token`

**File:** `app/api/generate-agora-token/route.ts`

Generates an Agora RTC+RTM combined v006 token (via the `agora-token` npm package, `RtcTokenBuilder.buildTokenWithRtm`).

- Query params: `?uid=<int>&channel=<string>` (both optional; generates random channel + uid=0 if omitted)
- Returns: `{ token, uid: string, channel: string }`
- Called by: `LandingPage.handleStartConversation` and `LandingPage.handleTokenWillExpire`

**Note:** This uses the npm `agora-token` package (v006 format). The REST auth in `invite-agent` and `stop-conversation` uses our custom v007 builder in `lib/agora-token.ts` — these are two different token systems for two different purposes.

---

### `POST /api/invite-agent`

**File:** `app/api/invite-agent/route.ts`

Starts an Agora ConvoAI agent. This is the most complex route.

**Input body** (`ClientStartRequest`):
```ts
{
  requester_id: string,       // browser user's UID
  channel_name: string,
  input_modalities?: string[],
  output_modalities?: string[]
}
```

**What it does:**
1. Reads and validates required env vars; throws on startup if any are missing.
2. Builds the agent with Deepgram STT, OpenAI LLM (via `NEXT_LLM_URL`), and ElevenLabs TTS.
3. Starts a session via the `agora-agent-server-sdk` — the SDK handles token generation and the Agora REST call internally.
4. Returns `AgentResponse: { agent_id, create_ts, state }`.

**Key hard-coded agent behaviour:**
- `turn_detection.type = 'agora_vad'`
- `advancedFeatures.enable_rtm = true` — enables RTM; the SDK automatically sets `parameters.data_channel: 'rtm'`
- `idleTimeout = 30` seconds
- The system prompt (Ada persona) and greeting are constants at the top of the file.

---

### `POST /api/stop-conversation`

**File:** `app/api/stop-conversation/route.ts`

**Input body:** `{ agent_id: string }`

Calls `session.stop(agent_id)` via the `agora-agent-server-sdk`.

---

### `POST /api/chat/completions`

**File:** `app/api/chat/completions/route.ts`

Optional OpenAI-compatible streaming endpoint. Point the agent at your deployed URL to intercept LLM calls and add RAG, tool calls, guardrails, etc.

**Model pinning:** Always uses the model hardcoded in the route (`'gpt-4o'`) — ignores `body.model` entirely to prevent model injection.

**Pipeline:** Uses Vercel AI SDK `streamText` + `createOpenAI`. Strips `/chat/completions` suffix from `NEXT_LLM_URL` to get a base URL for `@ai-sdk/openai`. Re-emits the stream as OpenAI SSE wire format (role chunk → content chunks → stop chunk → `[DONE]`).

**Extension point:** Insert logic between `body = await request.json()` and `streamText(...)` — prepend retrieved context to `body.messages`, call tools, run guardrails, etc.

---

## 5. Components

### `LandingPage`

**File:** `components/LandingPage.tsx`

- State: `showConversation`, `isLoading`, `error`, `agoraData`, `agentJoinError`
- On "Try it now!": calls `/api/generate-agora-token` → `/api/invite-agent` → sets `agoraData` → flips `showConversation`
- Dynamically imports `AgoraRTCProvider` and `ConversationComponent` (both `ssr: false`) to avoid SSR issues with the browser-only Agora SDK
- Creates the Agora RTC client (`AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' })`) inside the dynamic `AgoraProvider` wrapper using `useMemo`
- Token renewal: `handleTokenWillExpire(uid)` → GET `/api/generate-agora-token?channel=...&uid=...` → returns new token; passed as prop to `ConversationComponent`
- "End Conversation": POSTs to `/api/stop-conversation` with `agent_id`, then sets `showConversation = false`

---

### `ConversationComponent`

**File:** `components/ConversationComponent.tsx`

The core real-time component. Must be rendered inside `AgoraRTCProvider`.

**Hooks used:**

| Hook | Source | Purpose |
|---|---|---|
| `useRTCClient()` | `agora-rtc-react` | Gets the RTC client from context |
| `useIsConnected()` | `agora-rtc-react` | `true` when the client is joined |
| `useRemoteUsers()` | `agora-rtc-react` | Reactive list of remote users (the agent) |
| `useLocalMicrophoneTrack(isEnabled)` | `agora-rtc-react` | Creates/destroys local mic track |
| `useJoin(config, shouldJoin)` | `agora-rtc-react` | Joins RTC channel; handles `leave()` automatically on unmount |
| `usePublish([track])` | `agora-rtc-react` | Publishes local track to channel |
| `useClientEvent(client, event, cb)` | `agora-rtc-react` | Subscribes to RTC events |

**Critical gotcha — `useJoin` owns `leave()`:**
`useJoin` automatically calls `client.leave()` during cleanup. Do NOT call `client.leave()` anywhere else (cleanup effects, `useEffect` returns, etc.). Doing so while a join is still in progress causes `AgoraRTCError WS_ABORT: LEAVE`. The cleanup effect at the bottom only closes the local microphone track.

**RTM + ConversationalAIAPI initialization:**
After `isConnected` becomes true, a `useEffect` runs:
1. Creates `AgoraRTM.RTM(appId, uid)`, logs in with the same RTC token, subscribes to the channel.
2. Calls `ConversationalAIAPI.init({ rtcEngine, rtmEngine, renderMode: TEXT, enableLog: true, enableRenderModeFallback: true })`.
3. Calls `api.subscribeMessage(channel)` — binds RTC audio-PTS and RTM message/presence/status listeners.
4. Registers `TRANSCRIPT_UPDATED` handler → maps `ITranscriptHelperItem[]` to `IMessageListItem[]` → splits into `messageList` (final) and `currentInProgressMessage` (in-progress).

**Agent connection detection:**
- `useClientEvent(client, 'user-joined', ...)` checks if `user.uid.toString() === NEXT_PUBLIC_AGENT_UID` → sets `isAgentConnected`.
- Also syncs from `remoteUsers` array on every render.
- If `NEXT_AGENT_UID` doesn't match any remote user UID, a warning is logged.

**Conversation start:**
`handleMicrophoneToggle(isOn)` → if `isOn && !isAgentConnected` → calls `handleStartConversation()` → POSTs `/api/invite-agent` → updates `agoraData.agentId` mutably.

---

### `ConvoTextStream`

**File:** `components/ConvoTextStream.tsx`

Props: `{ messageList: IMessageListItem[], currentInProgressMessage, agentUID }`

- Floating chat bubble (bottom-right). Desktop: auto-opens on first message. Mobile: stays closed, shows pulse indicator.
- Renders both final messages (`messageList`) and live streaming message (`currentInProgressMessage` when `status === IN_PROGRESS`).
- AI messages: `uid === 0` OR `uid.toString() === agentUID`.
- Text is passed through `renderMarkdownToHtml()` from `lib/utils.ts` before `dangerouslySetInnerHTML`.
- Auto-scrolls on new messages or when streaming content grows by >20 chars.

---

### `AudioVisualizer`

**File:** `components/AudioVisualizer.tsx`

Accepts `track: IRemoteAudioTrack | undefined`. Draws a waveform using Web Audio API `AnalyserNode`. Only active when `track` is present.

---

### `MicrophoneButton` / `MicrophoneSelector`

Standard mic mute toggle and device-picker dropdown. `MicrophoneSelector` lists available audio input devices and calls `localMicrophoneTrack.setDevice(deviceId)`.

---

## 6. Core Libraries

### `lib/agora-token.ts`

Two exports:

**`buildAgoraToken(channelName, uid, appId, appCertificate, rtmUid?): Promise<string>`**
Generates an Agora v007 token with RTC (privileges 1–4) + RTM (privilege 1) packed, HMAC-signed with the app certificate, deflate-compressed, and base64-encoded with a `007` prefix. For general REST auth tokens, pass empty strings for `channelName` and `uid`.

**`buildAgoraAuthHeader(appId, appCertificate): Promise<string>`**
Calls `buildAgoraToken('', '', ...)` and returns `'agora token=<007token>'`. This is the `Authorization` header value for Agora REST API calls (ConvoAI join/leave endpoints). Replaces the old Basic auth scheme — no customer ID or customer secret needed.

---

### `lib/conversational-ai-api/index.ts` — `ConversationalAIAPI`

Singleton class that bridges RTC + RTM events into a clean event-emitter API.

**Lifecycle:**
```
ConversationalAIAPI.init(config)   // creates singleton, wires rtcEngine + rtmEngine
  → .subscribeMessage(channel)     // binds events, starts CovSubRenderController
  → .unsubscribe()                 // unbinds events, stops controller
  → .destroy()                     // nulls singleton, removes all listeners
```

**Events (via `EConversationalAIAPIEvents`):**
- `TRANSCRIPT_UPDATED` → `(ITranscriptHelperItem[])` — fired whenever chat history changes
- `AGENT_STATE_CHANGED` → `(agentUserId, TStateChangeEvent)` — idle/listening/thinking/speaking/silent
- `AGENT_INTERRUPTED` → `(agentUserId, { turnID, timestamp })`
- `AGENT_METRICS` → `(agentUserId, TAgentMetric)` — latency data per module
- `AGENT_ERROR` → `(agentUserId, TModuleError)` — e.g. TTS key errors
- `MESSAGE_RECEIPT_UPDATED` → `(agentUserId, TMessageReceipt)`
- `MESSAGE_ERROR` → `(agentUserId, error)`
- `DEBUG_LOG` → `(message: string)`

**Sending messages to the agent:**
- `.chat(agentUserId, IChatMessageText | IChatMessageImage)` — via RTM publish to user channel
- `.interrupt(agentUserId)` — sends `EMessageType.MSG_INTERRUPTED`

---

### `lib/conversational-ai-api/utils/sub-render.ts` — `CovSubRenderController`

Handles all incoming RTM messages and produces `chatHistory: ITranscriptHelperItem[]`.

**Render modes** (`ETranscriptHelperMode`):
- `WORD` — uses audio PTS timestamps to reveal words in sync with playback (runs a 200 ms interval)
- `TEXT` — immediate full-text replacement per turn
- `CHUNK` — character-by-character animation (100 ms interval)
- `UNKNOWN` — initial state; mode is auto-detected on the first agent message

Mode is set exactly once, when the first agent message arrives. If words are present, uses WORD mode. If not, TEXT. `enableRenderModeFallback=true` means if WORD mode receives a message without word data, it falls back to TEXT automatically.

**PTS sync:** `setPts(pts)` is fed by the `audio-pts` RTC event (enabled via `AgoraRTC.setParameter('ENABLE_AUDIO_PTS_METADATA', true)`). Words with `start_ms > pts` are withheld until playback reaches that timestamp.

---

### `lib/message.ts` — `MessageEngine`

**Legacy path** — was used when transcripts came over RTC stream-message instead of RTM. Still present but not wired up in `ConversationComponent`. `ConversationalAIAPI` + `CovSubRenderController` is the active path. Do not delete `MessageEngine` without checking for references first, but don't add new usages.

---

### `lib/utils.ts`

- `cn(...classValues)` — clsx + tailwind-merge
- `decodeStreamMessage(Uint8Array)` — TextDecoder wrapper
- `renderMarkdownToHtml(text)` — converts `**bold**`, `##`/`###` headers, numbered lists, bullet lists to HTML spans. Called in `ConvoTextStream` before `dangerouslySetInnerHTML`.

---

## 7. Type Reference

**`types/conversation.ts`** — all shared types:

| Type | Used in |
|---|---|
| `AgoraTokenData` | `LandingPage` state, `ConversationComponent` prop |
| `ClientStartRequest` | `LandingPage` → `/api/invite-agent` body |
| `AgoraStartRequest` | `/api/invite-agent` → Agora REST API body |
| `TTSConfig` / `TTSVendor` | `/api/invite-agent` |
| `StopConversationRequest` | `LandingPage` → `/api/stop-conversation` body |
| `AgentResponse` | `/api/invite-agent` response; stored as `agoraData.agentId` |
| `ConversationComponentProps` | `ConversationComponent` |

---

## 8. Data Flow — End to End

```
User clicks "Try it now!"
  │
  ├─ GET /api/generate-agora-token
  │   → RtcTokenBuilder.buildTokenWithRtm (agora-token pkg, v006)
  │   → returns { token, uid, channel }
  │
  ├─ POST /api/invite-agent
  │   → builds v007 auth header (lib/agora-token.ts)
  │   → POSTs AgoraStartRequest to Agora REST API
  │   → Agora cloud spins up agent in channel
  │   → returns { agent_id }
  │
  └─ LandingPage sets agoraData, renders <AgoraProvider><ConversationComponent>
        │
        ├─ useJoin → RTC client joins channel with token
        ├─ useLocalMicrophoneTrack → creates mic track
        ├─ usePublish → publishes mic to channel
        │
        ├─ isConnected=true triggers useEffect:
        │   → AgoraRTM.RTM.login + subscribe(channel)
        │   → ConversationalAIAPI.init + subscribeMessage(channel)
        │     └─ CovSubRenderController starts listening to RTM messages
        │
        ├─ Agent joins channel (user-joined event) → isAgentConnected=true
        │   Agent audio published to channel → useRemoteUsers picks it up
        │   → <RemoteUser> auto-subscribes and plays agent audio
        │   → <AudioVisualizer> draws waveform
        │
        ├─ Agent speaks → RTM receives assistant.transcription messages
        │   → CovSubRenderController processes words/PTS
        │   → TRANSCRIPT_UPDATED fires
        │   → ConversationComponent maps to IMessageListItem[]
        │   → ConvoTextStream renders chat bubbles
        │
        └─ User clicks "End Conversation"
            → POST /api/stop-conversation (agent_id)
            → setShowConversation(false)
            → ConversationComponent unmounts
            → useJoin cleanup fires client.leave()
            → localMicrophoneTrack.close()
            → RTM logout + ConversationalAIAPI.destroy()
```

---

## 9. Custom LLM Mode

Point the agent at your deployed `/api/chat/completions` URL to intercept every LLM call:

```
Agora cloud agent
  └─ POST https://<your-deployed-url>/api/chat/completions
      body: { messages: [...], model: "...", stream: true }
        │
        └─ /api/chat/completions/route.ts
            ├─ Creates openai provider via createOpenAI({ apiKey: NEXT_LLM_API_KEY, baseURL })
            ├─ streamText({ model: 'gpt-4o', messages })  ← model is hardcoded in the route
            └─ Re-emits as OpenAI SSE: role chunk → content chunks → stop → [DONE]
```

**Local dev requirement:** Agora's cloud cannot reach `localhost`. Use `ngrok http 3000` and point the agent at the ngrok HTTPS URL. In production, use the deployed domain.

**To add RAG / tools / guardrails:** Edit `/api/chat/completions/route.ts` — insert logic between `body = await request.json()` and the `streamText(...)` call.

---

## 10. Auth System

**Two separate auth patterns — do not mix them up:**

| Auth type | Used for | Implementation |
|---|---|---|
| v006 RTC+RTM token | Browser SDK join, agent SDK join | `agora-token` npm pkg, `RtcTokenBuilder.buildTokenWithRtm` |
| v007 REST token | Agora ConvoAI REST API (join/leave agent) | `lib/agora-token.ts`, `buildAgoraAuthHeader()` |

The v007 token is set as `Authorization: agora token=007...` on REST calls. It only requires `appId` and `appCertificate`. The old Basic auth scheme (`customerId:customerSecret`) is **not used anywhere** in this codebase.

---

## 11. Known Gotchas / Constraints

### Already fixed — explains why the code looks the way it does

1. **`useJoin` owns `client.leave()` — do not add it back** — an earlier version called `client.leave()` in a `useEffect` cleanup, which caused `AgoraRTCError WS_ABORT: LEAVE` because `useJoin` was still in progress. That call was removed. `useJoin` handles `leave()` automatically on unmount. Do not add explicit `client.leave()` calls anywhere in the component.

2. **`ConversationalAIAPI` singleton cleanup is handled** — `init()` reuses an existing instance if one is alive. The `useEffect` cleanup in `ConversationComponent` always calls `.unsubscribe()` then `.destroy()` before re-initializing, which also covers React StrictMode's double-invoke in dev.

3. **Model pinning is intentional** — `/api/chat/completions` always uses the model hardcoded in the route (`'gpt-4o'`) and ignores `body.model` from the incoming request. This prevents model injection from Agora's side. Change the constant in the route file to switch models.

### Ongoing constraints

4. **`NEXT_PUBLIC_AGENT_UID` must match exactly** — the component checks `user.uid.toString() === agentUID`. If the agent joins with a different UID, `isAgentConnected` never fires. A console warning will list the actual UIDs present if there's a mismatch. The `NEXT_PUBLIC_` prefix is required — this var is read in a client component.

5. **Custom LLM proxy needs a public URL** — `/api/chat/completions` must be reachable by Agora's servers. `localhost` does not work. Use `ngrok http 3000` in dev and point the agent at the ngrok HTTPS URL.

6. **`audio-pts` must be enabled** — `ConversationComponent` calls `AgoraRTC.setParameter('ENABLE_AUDIO_PTS_METADATA', true)` after the client is ready. Without this, WORD mode transcripts won't sync to audio playback.

7. **`agora-rtc-sdk-ng` is a direct dependency** — it's a peer dep of `agora-rtc-react` but must be listed explicitly in `package.json` at version `4.23.0`. Do not remove it.

8. **Turbopack cache** — after significant dependency or config changes, clear `.next/` with `rm -rf .next` before restarting `pnpm dev`.

---

## 12. How to Make Common Changes

### Switch ASR or TTS vendor
- Replace `new DeepgramSTT(...)` or `new ElevenLabsTTS(...)` in `app/api/invite-agent/route.ts` with the new vendor class from `agora-agent-server-sdk`
- Add the vendor's API key to `.env.local` and `env.local.example`
- Non-sensitive settings (model, language, voice ID) go directly in the constructor call

### Change the agent system prompt
- Edit the `ADA_PROMPT` constant at the top of `app/api/invite-agent/route.ts`
- Update `GREETING` on the same file if needed

### Add RAG / tool calls to the custom LLM
- Edit `app/api/chat/completions/route.ts`
- Insert retrieval logic between `body = await request.json()` and `streamText(...)`
- Inject retrieved context by prepending a message to `body.messages`

### Add a new ConversationalAIAPI event handler
- The event types are in `lib/conversational-ai-api/type.ts` (`EConversationalAIAPIEvents`)
- Register with `api.on(EConversationalAIAPIEvents.YOUR_EVENT, handler)` in `ConversationComponent`'s RTM init `useEffect`
- Clean up with `api.off(...)` or let `.destroy()` handle it

### Change VAD / turn detection settings
- Edit the `turnDetection` object in `app/api/invite-agent/route.ts`
- Key params: `silence_duration_ms`, `threshold`, `interrupt_duration_ms`, `prefix_padding_ms`
