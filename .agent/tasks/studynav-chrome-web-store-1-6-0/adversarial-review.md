# Adversarial review

## Scope

Chrome Web Store archive, listing copy, privacy disclosures, screenshots,
promotional image, and release-state claims for StudyNav 1.6.0.

## Findings resolved

1. The first Russian short description was 133 characters and risked exceeding
   the Store field limit. It was shortened to 118 characters.
2. The first promotional graphic used a mark that did not match the shipped
   toolbar icon. The final 440 x 280 asset uses the same round blue mark and two
   white bars as the extension.
3. The first archive rule retained the source-only toolbar SVG. The final
   packaging command excludes it, source maps, browser metadata, and `.DS_Store`.
4. The English privacy page said “publisher account,” which could be read as a
   claim about the Store publisher. It now accurately says that StudyNav has no
   user account.

## Residual review risks

- Store screenshots use the deterministic browser fixture rather than official
  publication content. This avoids third-party artwork and makes the extension
  controls legible, but Google may request screenshots from a live page.
- Chrome Web Store privacy questions can change wording. The release contract
  distinguishes data processed locally from data transmitted off-device, but
  the exact Dashboard wording must be read before selecting each answer.
- Upload, submission, approval, publication, and a successful public install
  are separate evidence states and must not be conflated.

## Result

PASS for repository and package readiness. Provider state remains pending until
the exact archive is uploaded and the Dashboard is read back.
