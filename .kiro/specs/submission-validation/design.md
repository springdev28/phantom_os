# Design

Keep the existing controller and adapter contracts. Review the cancellation token,
generation identity and disposal paths before changing production code. Extend
Playwright to delay the fixed engine asset response, cancel/replace the selection,
then release the response; assert no stale session, iframe or worker. A subsequent
explicit launch must display real MEM output and export its report. Do not expose
test backdoors in production or weaken session-state checks.

For hosted validation, add an explicit trusted base URL input to a separate
acceptance runner. Reuse `productionHeaders` rather than duplicating policy
strings. Use public fixtures and synthetic sentinels only; capture URL/method/body
and worker requests locally. Check response headers before launching. A download
of runtime code is allowed; a request derived from selected data is not.

The current source audit is deliberately non-extracting. Build synthetic tar/ZIP
members in a temporary directory to test link, duplicate/count and boundary
handling. Test failure messages and ensure nothing is extracted. Keep fixture
program licensing separate from source-archive executable rejection.

Each task ends with its concrete diff, tests and limitation report. Write a Kiro
ledger entry only from observed Kiro work. Store a sanitized transcript/screenshot
or export at an explicit evidence path; never capture auth tokens or personal data.
Public release still depends on the source rebuild review, clean checkout,
production HTTPS test and independent review of rights and event eligibility.
