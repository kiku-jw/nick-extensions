# Implementation notes

- The release reuses StudyNav 1.6.0; no feature or permission expansion is
  planned.
- The Chrome Store ZIP will be generated separately from the existing general
  download ZIP so developer-only source maps are not submitted.
- Provider submission state, certification, public availability, and actual
  installs are distinct evidence states.
- Google requires the manifest at the ZIP root, a 128 px icon, a 440 × 280
  promotional image, and at least one 1280 × 800 or 640 × 400 screenshot. The
  prepared set uses five 1280 × 800 images per supported Store locale.
- Store screenshots are derived from the deterministic browser fixture that
  runs the built extension controls. This keeps them current and legible while
  avoiding official publication text, artwork, or branding in the listing.
- The public privacy policy now describes only the supported desktop product,
  gives a permission-by-permission explanation, and includes the Chrome Web
  Store Limited Use statement.
- The experimental Edge Mobile target remains reproducible for reference, but
  Issue #8 was closed as not planned and its release contract was archived.
- Adversarial review found and corrected two listing-quality issues: the first
  Russian short summary was 133 characters, and the promo graphic did not match
  the shipped toolbar icon. The final archive also excludes the source-only icon
  SVG and `.DS_Store` in addition to maps and browser metadata.
