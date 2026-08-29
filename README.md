# Catechism Time

A projector-first, five-minute group ritual for first through fifth graders.

The app uses one guided flow: setup, optional review questions, Listen with a think-first answer reveal, two distinct randomized say-back repetitions, Scripture, From memory without help, and a quiet closing screen.

The leader teaches verbally while the final Scripture page remains visible, then advances directly to `FROM MEMORY`.

## Guided group recitation

Review, both Say modes, and From memory use the same clicker-led recitation.

Listen is presenter-led: the first press reveals its answer and the next press advances directly to the first Say mode.

Listen and From memory reserve the final answer layout, then reveal its words every 60-90 ms with a 2.5-second stagger cap.

Pressing again during that reveal finishes it immediately without also starting the next action.

Reduced Motion reveals the complete answer immediately while keeping the same two-press interaction.

Think-first stages first reveal the answer.

The next press starts `3, 2, 1, Together`, then highlights the exact canonical question one word at a time.

After a 500 ms question-to-answer pause, it highlights the exact canonical answer one word at a time.

Say stages start with the answer ready.

Space and Right Arrow pause or continue an active countdown or recitation.

Left Arrow cancels an active recitation and resets the current slide.

The setup pace has five persistent levels: Very slow (650 ms), Slow (550 ms), Medium (450 ms), Brisk (370 ms), and Fast (300 ms).

Punctuation adds natural pauses.

Within each pace, short connector words move about 22% faster, ordinary words stay near the selected base, and long words receive up to 20% more time.

The cadence is deterministic, capped, and never random.

As the active word changes, the prior word keeps a soft accent for 160 ms so the highlight flows without moving the text.

The selected pace is stored locally and in the `speed=1..5` URL parameter.

`timing=test` is an automated-test seam that scales timers without changing production defaults.

## Run it

```sh
npm install
npm run dev
```

Run every check with one command:

```sh
npm run verify
```

## Content trust rules

`../catechism-app/Catechism Canonical Validation.xlsx` is the private source of truth.

`content/catechism.canonical.json` is the checked-in review boundary exported from that workbook.

Run `npm run data:sync` after a workbook change.

This recreates the canonical export from the workbook, then mechanically generates app TypeScript from that export.

Changes to the canonical export must be reviewed against the workbook.

Never edit the canonical export or generated TypeScript by hand.

The generator writes `src/data/catechism.generated.ts` and `src/data/integrity.json` with workbook, canonical-export, and generated-file SHA-256 values.

`npm run data:check` always deterministically regenerates app data from the canonical export and checks both artifacts against the integrity manifest.

When the sibling workbook is available locally, it also regenerates in memory and requires normalized byte-for-byte fidelity for every question, answer, and ESV field.

CI does not contain the private sibling workbook, so it performs the manifest integrity check without weakening the local fidelity gate.

Do not edit generated content by hand.

Questions and answers use the full official booklet wording.

Scripture text comes from the official ESV API import recorded in the workbook.

Question approval, ESV verification, reference review, theological review, and teaching-note status come directly from workbook fields.

The app never translates `API Verified - Human Approval Pending` into an approval claim.

Records marked `Needs Human Decision` do not display candidate ESV text during a session.

Teaching-note fields remain in the canonical export for future reference, but the current presentation does not generate or render a teaching slide.

Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), copyright © 2001 by Crossway, a publishing ministry of Good News Publishers.

Used by permission.

All rights reserved.

See [Crossway permissions](https://www.crossway.org/permissions/) and the [ESV API](https://api.esv.org/).

## Build and deploy

`npm run build` creates `dist/`.

Vite uses a relative base path, so the build works at the GitHub Pages repository path.

The included GitHub Actions workflow builds and publishes `dist/` after a push to `main`.

In the repository settings, set Pages > Build and deployment > Source to `GitHub Actions` once.

No API key or other secret is needed at runtime.

## Icons

Room-facing mode cues use `@phosphor-icons/react` 2.1.10 under the MIT license.

Each icon is paired with one concise visible mode label.
The visible label provides the marker's single accessible name, while the SVG is decorative.

Icons are imported from individual CSR module paths so the production bundle includes only the symbols in use.

Mapping: review `ArrowCounterClockwise`, listen `Ear`, together `UsersThree`, whisper `SpeakerLow`, strong voice `Megaphone`, left/right `ArrowsLeftRight`, echo `Repeat`, missing words `Textbox`, younger/older `UsersFour`, slow then clear `Gauge`, Scripture `BookOpenText`, and from memory `Brain`.
