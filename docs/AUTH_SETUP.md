# Threads account authorization

The publisher uses Meta's official Threads API. A one-time OAuth authorization is required before live publication.

## What must happen once

1. Create or configure a Meta developer app with the Threads use case.
2. Configure the OAuth redirect URI required by the app.
3. Sign in and authorize the Threads account that will publish.
4. Request the scopes required by the enabled features. Publishing normally needs threads_basic and threads_content_publish. Metrics need threads_manage_insights.
5. Exchange the authorization code for a user access token.
6. Exchange it for a long-lived token and keep it refreshed before expiry.
7. Put the long-lived token only in the GitHub Actions secret THREADS_ACCESS_TOKEN.

Do not put the token, app secret or authorization code in repository files, GitHub Issues, Drive, or chat messages.

## Media authorization

Generated image posts also require the Cloudinary repository secrets documented in docs/OPERATIONS.md because Threads fetches image_url from a public server.

## Activation gate

Until OAuth is completed and live smoke tests pass, config/automation.json must remain:

enabled=false
publish_mode=dry-run

Authorization is intentionally the only unavoidable manual account step. After the long-lived token and media-host credentials are stored as GitHub secrets, normal publishing is automatic.
