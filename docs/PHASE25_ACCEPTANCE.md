# PulseChat Phase 25 internal-beta acceptance

Status: **READY FOR OWNER PLAY CONSOLE WORK — NOT ACCEPTED**

Phase 25 becomes accepted only after every required row is evidenced for one
exact signed production AAB and no release blocker remains.

## Candidate provenance

| Evidence | Required value | Observed / link |
| --- | --- | --- |
| Application ID | `com.prakashdash.pulsechat` | |
| Version | `1.0.0` / committed versionCode | |
| Source revision/package SHA-256 | Required | |
| EAS production build ID | Required | |
| AAB SHA-256 | Required | |
| Signing certificate SHA-256 | Must match accepted lineage | |
| Play Console release ID | Internal testing | |
| Tester list | Controlled adult beta | |

## Policy and listing

| Check | Expected | Result / evidence |
| --- | --- | --- |
| `npm run play:audit` | Zero failures | |
| Privacy URL | Public HTTPS, signed-out access, accurate | |
| Deletion URL | Public request path, accurate retention | |
| Support URL/email | Public and monitored | |
| Data safety | Matches deployed V1 and processors | |
| Ads | Declared none | |
| Target audience | Adults 18+ internal beta | |
| Content rating | UGC/user interaction disclosed | |
| App access | Working reviewer account/instructions | |
| Store copy | No unsupported feature/security claim | |
| Icon/feature graphic | Accepted by Console | |
| Phone screenshots | At least two authentic candidate screens | |

## Play and beta evidence

| Check | Expected | Result / evidence |
| --- | --- | --- |
| Production AAB upload | Internal track accepts artifact | |
| Automated Play checks | No blocking policy/manifest error | |
| Pre-launch crashes/ANRs | Zero unresolved blockers | |
| Compatibility | Supported Android devices launch | |
| Login/app access | Reviewer can reach V1 | |
| Direct/group messaging | Two-way realtime flow passes | |
| Images/actions/search | V1 regression passes | |
| Receipts/unread/push | Background/terminated routing passes | |
| Privacy/block/report | Server behavior passes | |
| Offline/restart/sign-out | No loss, duplicate or cross-account bleed | |
| Account deletion | In-app and public request process verified | |
| Controlled beta | 5–20 adults; blockers resolved | |

## Defects

| ID | Severity | Build/device | Reproduction | Resolution/retest |
| --- | --- | --- | --- | --- |
| | | | | |

## Sign-off

- Tester/beta owner: ______________________________
- Test window (UTC): ______________________________
- Play release/build link: ______________________________
- Result: PASS / FAIL / BLOCKED
- Owner approval: ______________________________

Any crash/ANR affecting a core route, data leak, authorization bypass, message
loss/duplication, broken account deletion, misleading policy declaration,
signing/package mismatch, or nonfunctional background push blocks acceptance.
