# Media strategy

## Default

The default visual is an original deterministic editorial card rendered from verified job data by the repository renderer.

This is preferred over downloading random images from the web because it is reproducible, avoids copyright ambiguity, keeps visual identity consistent and does not consume ChatGPT image-generation quota.

## When to use an externally sourced image

Use a real external image only when the subject itself is visually important and a suitable official, licensed, public-domain or otherwise clearly reusable source is available.

Do not hotlink arbitrary search-result images. Do not treat search visibility as permission to reuse an image.

If an external asset is retained for future use, keep it only in the configured Google Drive Media Library, never as a binary committed into the private Git repository.

## ChatGPT-generated images

Image generation inside ChatGPT is optional, not the default automation path.

Use it for special posts where a bespoke illustration adds genuine editorial value. Store reusable generated media in the configured Drive Media Library. The automated publisher should still use a public media host accepted by Threads rather than relying on Drive share URLs.

## Drive folders

The only Drive workspace for this project is the folder configured in config/storage.json.

- Media Library: reusable/generated/licensed source media.
- Published Archive: optional long-term archive of final media.

Do not scatter project media elsewhere in Drive.

## GitHub quota protection

Do not commit PNG, JPG, WEBP, video or other heavy media to this private repository.

GitHub should store source code, small JSON jobs, small result metadata and documentation only.


## Story-specific source image

For an approved story, the system may attach one additional real image associated with that exact news event. Priority is:

1. primary-source newsroom or official product/company media;
2. official press kit;
3. licensed, public-domain or explicitly reusable reporting media.

A search-result image is never enough evidence of reuse rights. Every candidate source image must carry its source URL, original image URL, credit, retrieval timestamp and a rights classification. If rights are unclear, mark it `reference_only`: keep the reference for editorial context but do not republish it.

When `source_media.publishable=true`, the runtime may ingest the remote HTTPS image into Cloudinary and attach it after the generated editorial card. Buffer supports multi-image Threads posts, but the optional source image must be dropped first whenever the configured free-tier media ceiling would otherwise be exceeded. Never remove watermarks or bypass access controls.


## Rights-resolution workflow

Before classifying a story image as `reference_only`, the automation should make a bounded rights-resolution pass. Check, in order, the primary-source press/media terms, official press kit/download page, explicit reuse/license notices, image credit/metadata, photographer or agency terms, and the source site's usage terms.

Record any evidence in `source_media.rights_evidence_url`, `rights_evidence_type`, `rights_checked_at` and `decision_reason`. Attribution is required whenever the license/source requires it, but attribution by itself is not evidence of permission.

If the bounded search still cannot establish reuse rights, keep the image as `reference_only`, preserve its credit and source URL, and use it only as editorial reference for an original generated/card visual. The original visual may reflect factual subject matter and composition goals, but must not copy protected visual expression, logos/watermarks beyond ordinary factual branding use, or distinctive copyrighted artwork.
