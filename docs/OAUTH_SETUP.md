# OAuth setup for LFC Social Hub

Set these values as backend-only Render environment variables:
- API_PUBLIC_URL=https://lfc-social-hub-api.onrender.com
- META_APP_ID and META_APP_SECRET
- TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET
- GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

Register these callback URLs in the provider developer consoles:
- Meta Facebook/Instagram: https://lfc-social-hub-api.onrender.com/api/v1/integrations/facebook/callback
- TikTok: https://lfc-social-hub-api.onrender.com/api/v1/integrations/tiktok/callback
- Google YouTube: https://lfc-social-hub-api.onrender.com/api/v1/integrations/youtube/callback

Meta uses Page permissions and linked Instagram Professional accounts. Meta App Review/Business Verification may be needed for broader access. TikTok Content Posting requires eligible app scopes and may require app review/audit; unaudited posting is restricted. YouTube uses Google OAuth with YouTube read-only and upload scopes and requires a configured consent screen.

OAuth currently stores encrypted authorization data and account metadata. It does not yet publish posts, refresh expired tokens, or process scheduled jobs. WhatsApp Channels remains assisted publishing because a generally available public Channels publishing API is not available. Never put provider app secrets in frontend variables or GitHub source.
