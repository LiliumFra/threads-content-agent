# Security policy

This repository must never contain authentication material.

Do not commit or paste into Issues:

- Threads access tokens
- Meta app secrets
- Cloudinary API secrets
- browser cookies or session IDs
- personal access tokens

All runtime credentials belong in GitHub Actions Secrets.

The publisher fails closed when credentials, public media hosting or validation are unavailable.

If a credential is exposed, revoke or rotate it at the provider. Removing it from Git history or deleting a conversation does not revoke it.
