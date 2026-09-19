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
