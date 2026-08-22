# Logging without opening lapse

Two ways to record an Entry when opening the app is more ceremony than the
thing deserves. Both are off until you configure them, and lapse behaves
exactly as before if you never do.

They share one idea: the browser's session cookie is for a person, and a
second credential is for a machine. Apple's Shortcuts has no reliable way to
capture a `Set-Cookie` from a login response and replay it later, so
cookie-only auth put the API out of reach of everything except the app itself.

## The API token

```
openssl rand -hex 32
```

Put it in `.env` as `LAPSE_API_TOKEN` and restart. `/api/*` will then accept
`Authorization: Bearer <token>` anywhere it accepts the session cookie.

**Do not reuse `LAPSE_PASSWORD` for this.** The password's protection is that
it lives in an httpOnly cookie nothing can read back out. A token pasted into
a Shortcut sits there in plaintext and travels with that Shortcut every time
it is exported, shared, or synced to a new phone. Two secrets, rotated
independently — rotating either is changing the env var and restarting.

The token carries the same access the password does once presented: all of
`/api/*`, no scopes. That is ADR-0003's single-user stance held rather than
widened.

## Apple Shortcuts

Best on an iPhone with an Action Button: one press, one tap, logged.

1. Read your tracker ids once:
   ```
   curl -s -H "Authorization: Bearer $LAPSE_API_TOKEN" \
     https://lapse.mengo.dev/api/bootstrap | jq '.trackers[] | {id, name, variants}'
   ```
2. New Shortcut → **Choose from Menu**, one item per tracker you log often.
3. Under each item → **Get Contents of URL**:
   - URL `https://lapse.mengo.dev/api/entries`, Method `POST`
   - Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
   - Request Body (JSON): `{"trackerId": "<id>"}` — add `"variantId": "<id>"`
     for a Variant row.
4. Bind it: Action Button, a Home Screen icon, a Siri phrase, an NFC tag stuck
   to the thing itself, or a location automation.

The menu is a hardcoded copy of your tracker list, so it goes stale when you
rename or add one. That is the tradeoff for it being free; the Telegram bot
below reads the list live instead.

## Telegram bot

Works from anywhere Telegram works — phone, watch, laptop — and its buttons
are built from the database on every `/keyboard`, so they never go stale.

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token
   into `LAPSE_TELEGRAM_BOT_TOKEN`.
2. Message [@userinfobot](https://t.me/userinfobot) → copy your numeric id
   into `LAPSE_TELEGRAM_CHAT_ID`.
3. Restart lapse. The log says `telegram bot polling`.
4. Message your bot `/start`. Pin the chat.

| You send | It does |
|---|---|
| a button, or part of a tracker name | logs it — `logged ✓ vacuuming · was 12d ago` |
| `/status` | what's slipping, most overdue first |
| `/keyboard` | rebuilds the buttons after you add or rename a tracker |

**The chat id is the entire authorisation model.** Anyone who finds your bot's
`@name` can message it; the token in the API URL only proves lapse is the bot,
never who is on the other end. Messages from any other chat are dropped with
no reply — an "unauthorised" answer would confirm the bot is live.

Matching narrows before it widens: exact label, then the tracker's own name,
then prefix, then substring. A "run" stays reachable next to a "running
shoes". Anything ambiguous comes back as a question rather than a guess — the
wrong row silently logged is a lie about your history that you'd have no
reason to go looking for.

Transport is long polling (`getUpdates`), not a webhook. A webhook would need
lapse to know its own public URL, register it at boot, and verify a second
shared secret on an unauthenticated route. Long polling needs the bot token
and nothing else, and works the same on a laptop as behind Traefik.

### What it can't do

Backdating, durations and notes are not in the bot — that's the app's log
sheet, and folding a whole form into a chat would cost more than it saves. The
bot logs "just did this", which is the tap it's replacing.

If the VPS is down, a message gets no reply and nothing is logged. Unlike the
app, there is no offline queue — the phone's outbox only exists inside lapse
itself.
