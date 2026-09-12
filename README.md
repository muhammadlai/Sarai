# SARA AI Creator PRO

A production-oriented starter for a REAL talking SARA avatar. The static-photo mouth animation has been replaced by a D-ID real-time Agent embed. D-ID handles the actual avatar video, lip-sync, voice and realtime conversation over WebRTC.

## 1. Requirements
- Node.js 20+
- A D-ID Studio account and Agent
- A TikTok Developer app if you want official OAuth/API features
- HTTPS in production

## 2. D-ID setup
1. In D-ID Studio create an Agent.
2. Use `public/sara-reference.jpg` as the visual source / photo presenter where supported.
3. Configure the Agent voice and instructions so SARA behaves like a natural adult female TikTok creator.
4. In the Agent Embed settings, allow `http://localhost:3000` for development.
5. Copy the Agent ID and Client Key.
6. Put them in `.env` as `DID_AGENT_ID` and `DID_CLIENT_KEY`.
7. Start the app and click **Connect SARA**.

D-ID's official Agents Embed uses `https://agent.d-id.com/v2/index.js` and requires an Agent ID plus a client key restricted to your allowed domains.

## 3. OpenAI
Optional for the custom backend memory/chat/tools layer. Put a NEW key in `.env`. Do not commit `.env`.

## 4. TikTok
Create a TikTok Developer app, set the exact callback URL to:
`https://YOUR-DOMAIN/auth/tiktok/callback`
Then set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` and only the scopes your app is approved for.

The app implements official OAuth. It does NOT claim an undocumented TikTok LIVE comments/control API.

## 5. Run
```bash
npm install
cp .env.example .env
npm start
```
Open `http://localhost:3000`.

## 6. Production
- Put behind HTTPS/reverse proxy.
- Set D-ID allowed domain to your HTTPS origin.
- Use a strong `APP_ENCRYPTION_KEY`.
- Keep all server secrets only in environment variables.
- Use a persistent database instead of JSON for multi-user production.
- For TikTok LIVE, connect an officially supported streaming route/OBS/Live Studio workflow available to your TikTok account.
