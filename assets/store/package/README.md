# Chrome Web Store upload package

`insightreply-extension.zip` is the built MV3 extension — the single file the
Web Store accepts. Everything else in `assets/store/` is a listing image
uploaded through dashboard form fields, not part of this zip.

`BUILD-INFO.txt` records what went into the package: version, permissions, the
backend URL baked into it, file count and a sha256. Check it before uploading —
a package built against a local backend is indistinguishable from a shippable
one until you read that file.

## Rebuilding

```bash
IR_DEFAULT_BACKEND_URL=https://insightreply-api.vercel.app \
  pnpm build:extension && pnpm package:extension
cp dist/insightreply-extension.zip dist/BUILD-INFO.txt assets/store/package/
```

The build refuses any non-HTTPS `IR_DEFAULT_BACKEND_URL` other than localhost,
so a development default cannot reach the store by accident.

Omit `IR_DEFAULT_BACKEND_URL` for a local development build; `BUILD-INFO.txt`
will then say `DO NOT UPLOAD THIS BUILD`.

See `docs/chrome-web-store-checklist.md` §1b for the deploy-then-upload order,
which matters: the published extension id does not exist until after your first
upload, and the backend's `ALLOWED_EXTENSION_ORIGIN` must include it.
