# StudyNav Mobile 1.6.1 verdict

## Verdict: PASS — local closed-beta candidate

Release source `dd014fc674f56a2cf5092b5cc3e8bcd80d37f113`
passes the complete repository regression, Safari packaging/build matrix,
Safari iPhone/iPad simulator checks, Firefox 142.0 on Android 16/API 36,
all nine mobile functions, same-profile 1.6.0 to 1.6.1 migration, reliability
checks, security/privacy review, and local Apple/Mozilla release-packet review.

The Android check used live public JW.org/WOL pages and confirmed portrait and
landscape behavior, large text, offline saved data, Firefox restart, feature
teardown/restoration, note/tag editing, precise verse ranges, image
descriptions, language count, and local-only settings after migration.

One platform behavior is documented honestly: Firefox terminates extension
scripts when the whole add-on is disabled, so an already-open JW tab needs one
refresh after the add-on is enabled again. StudyNav's own `Tools` switch
performs immediate teardown and restoration.

This verdict is local readiness, not public availability. No physical iPhone or
Android device was used in this goal. Nothing was signed for distribution,
uploaded to TestFlight/App Store/AMO, submitted, or published. Those physical
device and provider actions remain separate owner gates, and public
documentation must not offer the mobile packages until they pass.
