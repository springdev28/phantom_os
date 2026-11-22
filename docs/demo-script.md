# Genuine demo recording plan — target 2:55

This is a script, **not a completed submission video**. No YouTube URL is
available. An unedited local [FreeCOM evidence clip](evidence/prompt-11-local-freecom.webm)
was captured separately by `npm run record:demo`; [its record](evidence/prompt-11-recording.json)
asserts real exported bytes and cleanup. It has no narration and does not replace
the full story below. Record the actual browser and real guest framebuffer; do not place old
captures over a failed launch or edit a failure into apparent success. Use only
the two licensed fixtures and original test text. No personal documents, accounts,
API tokens, copyrighted commercial apps, stock screens or fake terminal output.

Before recording: use the release candidate that passed its exact browser/network
checks. For the ZIP picker scene select `tests/fixtures/dos/FREECOM.ZIP` from the
checkout; never imply this selection uploads bytes. Use “select/import” in
narration. Record at readable desktop size. Keep actual waits visible or mark
time cuts; never use speed changes to substantiate first-launch measurements.
Run a rehearsal, verify the exported file and retain the unedited recording.
Until hosted acceptance passes, label any local recording “local development
build”; do not display a made-up deployment address.

| Time | Actual action on screen | Concise narration |
| --- | --- | --- |
| 0:00–0:20 | Home and Open legacy software | “Old programs often come with unclear requirements and a folder of files. PHANTOM lets you inspect them, choose an entrypoint, and try a tested runtime in your browser.” |
| 0:20–0:45 | Select FREECOM.ZIP locally; Analyze file; show APP/COMMAND.COM, INPUT.TXT and BELL.TXT; explicitly choose COMMAND.COM | “This ZIP stays in the browser. The package remains intact. The MZ header is evidence of format; it doesn't guarantee that this program runs.” |
| 0:45–1:20 | View compatibility → Configure launch → Use these settings and continue → Start DOS program. Wait for real FreeCom 0.86 output; Focus program; type `TYPE APP\INPUT.TXT` and Enter | “This is FreeCOM 0.86 running in the pinned js-dos DOSBox engine. Keyboard input and the package's support file reach the real guest. This exact fixture has recorded tests; arbitrary EXEs are not promised.” |
| 1:20–1:45 | Type `ECHO HELLO FROM DOS>RESULT.TXT`; Enter; release keyboard with Ctrl+Alt+Esc; Refresh guest files; Export RESULT.TXT; open downloaded text | “DOS wrote this file. Export reads those guest bytes. Temporary changes disappear on stop unless you export or explicitly capture and save them.” |
| 1:45–2:15 | Current branch: stop session, show the Compatibility screen's disabled Windows path and reasons. Optionally show real MEM output from the second supplied DOS fixture if time allows | “Windows is still experimental and disabled. The Boxedwine engine trial did not verify a Windows app; its Wine filesystem and lawful fixture remain blockers. DOS is the only integrated execution path.” |
| 2:15–2:40 | Show unsupported-format explanation and local report export; then the **actual** retained network observation for this build/run, or live DevTools requests with the selected fixture | “The planner separates detection from execution. The recorded tests saw fixed same-origin runtime downloads, no selected file data sent, and blocked guest networking. These are observations of tested paths, not a guarantee against browser or emulator defects.” |
| 2:40–2:55 | Real app controls and concise contribution/limits; actual Kiro work only if the ledger is filled | “The contribution is bounded package intake, explicit compatibility decisions, a local runtime boundary and usable file export. Windows, disk booting and broad application compatibility remain unfinished.” Add one **evidenced** Kiro contribution sentence, shortening earlier narration if needed. |

If Windows is later verified, replace only 1:45–2:15 with actual licensed program
launch/input/clean-stop footage and name the exact engine, program and environment.
Do not take that branch based on a PE signature, engine initialization or mock UI.

Before publication: measure the rendered video's duration (strictly less than
180 seconds), play it end to end, ensure every claim matches the build, include
credits/source/license links, and publish to the participant's YouTube channel
with **Public** visibility. Verify the video while signed out. Preserve raw footage,
capture date, browser/runtime pins, final duration, SHA-256 and public URL in the
submission evidence. No soundtrack is needed. Upload/terms acceptance has not
been performed by this preparation task.
