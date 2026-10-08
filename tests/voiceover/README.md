# Hosted VoiceOver evidence

The separate VoiceOver workflow runs on GitHub-hosted macOS 26 with headed Playwright WebKit and one worker. It runs only when its workflow, config or tests change in a pull request, or when dispatched manually. It builds the standard demo with `npm run demo`. The existing browser checks remain separate.

Guidepup 0.35.0, its setup tool 0.29.1 and Playwright 1.63.0 are pinned. Web-content entry follows [Guidepup's MIT fixture](https://github.com/guidepup/guidepup/blob/d5c9d8059954f214b82689dffcb5866a9b55fe6c/examples/playwright-voiceover/voiceover-test.ts). This tests Playwright WebKit, not installed Safari.

The positive control must capture the heading, button name and role, and one live-message occurrence before any pattern journey runs. Each English and French journey records native VoiceOver keyboard actions, spoken phrases, cursor text, DOM focus and status mutations. The artifacts include per-step JSON, phrase logs, HTML, accessibility snapshots and screenshots. Journey errors are recorded without failing CI, so a green job means the control passed and evidence was collected, not that the pages passed an accessibility review.

Navigation uses Guidepup's initial capture; result actions use full capture. Initial capture can miss later phrases in a long utterance. Guidepup polls VoiceOver's last phrase and combines changed phrases; consecutive identical announcements may not appear separately. Interpret announcement counts with those limits. Installed voices and portable preferences are recorded, but phrase text cannot prove French pronunciation.

Run on a dedicated macOS desktop configured for Guidepup:

```sh
npm ci
npm run demo
VO_PHASE=control npm run test:voiceover -- --grep 'positive control'
npm run test:voiceover -- --grep-invert 'positive control'
```

Read the artifacts against each pattern's README before assigning a page verdict. A navigation error needs investigation rather than an automatic page failure.
