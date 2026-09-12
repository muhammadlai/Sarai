# SARA AI Creator PRO — deployment checklist

## Local
1. Run `npm install`
2. Keep `.env` private.
3. Add a NEW OpenAI API key to `OPENAI_API_KEY` if custom backend chat/TTS is wanted.
4. Keep the TikTok client secret server-side in `TIKTOK_CLIENT_SECRET`.
5. Run `npm start` and open `http://localhost:3000`.

## D-ID
The project is preconfigured with the SARA Agent ID/client key supplied during setup. D-ID client keys are intended for frontend use but are restricted by allowed domains. For production, create/update the key to allow only the final HTTPS domain.

## TikTok
The project is preconfigured with the TikTok Client Key and requested scopes. The Client Secret must be added locally/server-side. For a production web OAuth flow, use an HTTPS static redirect URI registered in TikTok Developer Portal. Content Posting API direct-post capabilities require TikTok approval; video.upload is the draft/inbox workflow.

## Production
Set:
- `DID_ALLOWED_ORIGIN=https://YOUR-DOMAIN`
- `TIKTOK_REDIRECT_URI=https://YOUR-DOMAIN/auth/tiktok/callback`
- `TIKTOK_CLIENT_SECRET=...`
- `OPENAI_API_KEY=...` (optional backend brain/TTS)
- a strong `APP_ENCRYPTION_KEY`

Do not commit `.env` or expose TikTok Client Secret/OpenAI API key.
