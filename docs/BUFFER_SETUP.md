# Buffer setup

Buffer is the primary publishing provider for this project.

The current Buffer API is GraphQL at https://api.buffer.com. Personal API keys authenticate with a Bearer header and can access the organizations and channels connected to the Buffer account.

## 1. Connect Threads to Buffer

In Buffer, connect the Threads account that should receive automated posts.

No Meta Developer app is required on this project because Buffer owns the social-network integration.

## 2. Create a Buffer API key

In Buffer:

Settings -> API -> Create API key

Do not paste the API key into chat, Drive, job JSON, Issues, commits or source files.

Store it only in:

GitHub repository -> Settings -> Secrets and variables -> Actions -> New repository secret

Name:

BUFFER_API_KEY

## 3. Channel selection

By default the worker queries the Buffer account, finds organizations, and selects the single active channel whose service is Threads.

If exactly one active Threads channel exists, nothing else is required.

If more than one Threads channel exists, set this GitHub Actions repository variable:

BUFFER_CHANNEL_ID

Optionally set:

BUFFER_ORGANIZATION_ID

These are identifiers, not secrets.

## 4. Test without publishing

Run the manual GitHub Actions workflow:

Test Buffer connection

It calls only account/channel queries. It does not publish anything.

A successful run prints the selected provider, organization ID, channel ID and display name.

## 5. Images

Buffer does not accept binary media uploads through this API. Image assets must be available at a public URL until publication.

This project keeps Cloudinary as the public media host for generated editorial cards.

Required only for image jobs:

- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Text-only posts need only BUFFER_API_KEY.

## 6. Publishing behavior

The GitHub queue already enforces publish_at. When a job becomes due, Buffer receives it with:

- schedulingType: automatic
- mode: shareNow

This avoids maintaining a second scheduling queue.

The Buffer post ID is stored in result.provider_post_id and later used to fetch normalized metrics.

## 7. Safety

A network failure or server failure during createPost is treated as REVIEW rather than automatically retried when publication state is ambiguous. This is intentional protection against duplicate posts.

The direct Meta Threads provider remains in the codebase only as an optional fallback.
