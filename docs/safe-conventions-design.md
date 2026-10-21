# SAFE conventions: reviewed reference model

The next coherent release adds an explicit post-money equity-financing reference model. Option-pool top-ups are a subsequent release. Existing scenarios retain the legacy `pre-conversion-v2` calculations and whole-share rounding; schema migration adds labels, not different economics.

## Sources and boundaries

Reviewed 21 October 2026: [YC SAFE page](https://www.ycombinator.com/safe) and [official SAFE User Guide](https://bookface-static.ycombinator.com/assets/ycdc/SAFE%20User%20Guide-a47c6588327d73aa2799e61ed7c2cae9f1a0ee9acfa9c43b62039dc06e715832.pdf), especially Q&A A/B, Appendix I, Appendix II example 1, and version-1.1 history. The current page lists US cap-only and discount-only forms separately. Combined cap-and-discount is a **custom/historical reference variant**, not a current YC standard form. The downloadable DOCX forms could not be inspected: direct public requests failed at this container's proxy with HTTP 403; the web reader does not parse DOCX. This implementation therefore describes a guide-based equity-financing subset, not complete contract compliance.

The new convention assumes every listed SAFE is outstanding before the first positive-cash priced preferred-equity round and converts automatically there. Later issuance, mixed legacy/pre-money instruments, notes, MFN, pro-rata participation, liquidity/dissolution events, preferences, and modified contractual definitions are unsupported. A later explicit conversion target is an error, not an implied right to defer conversion. Existing pool shares must be fully diluted and included; promised options must already be represented in that existing capitalization. No financing-related pool increase is modeled here.

## Joint conversion, without pool top-up

Let B be existing fully diluted shares, V the round pre-money valuation **including all SAFE conversions**, M new cash, A each SAFE purchase amount, C its positive post-money cap, and d its discount off the round price. The input d=20% corresponds to a contract Discount Rate of 80%.

For each instrument, its pre-new-money ownership weight is:

```text
cap-only:        w = max(A/C, A/V)
discount-only:   w = A / ((1-d) V)
custom combined: w = A / min(C, (1-d) V)
W = sum(w); require W < 1
D = B / (1-W)
round price = V / D
SAFE shares = w D
new-money shares = M / round price
```

This is a simultaneous closed-form solution, not sequential conversion. D includes the existing pool and every converting SAFE; it excludes new-money shares. Cap and discount candidates share that denominator. The custom combined crossover is V=C/(1-d), and the cap-only fallback is the round price when it is lower. Instrument permutation must not change holdings by identity.

New-mode conversion and new-money shares retain theoretical fractions. Actual issuance rounding is unsupported and must be disclosed in UI/export. Legacy nearest-whole-share issuance remains unchanged. With no new pool, the reference round capitalization equals V+M within floating-point tolerance; conversion marked value is already within V and must not be added to it again. Grants transfer from the included pool without changing total shares.

## Independent fixtures and integration gates

An independent financial reviewer derived these exact fixtures using rational arithmetic. Amounts below are millions, price is dollars/share; no pool increase:

| B | V | M | SAFE terms | D | Price | Conversion shares | New shares |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | 20 | 5 | 1 at cap 10 | 10 | 2 | 1 | 2.5 |
| 8.5 | 20 | 5 | 0.2 at cap 4; 0.8 at cap 8 | 10 | 2 | 0.5; 1 | 2.5 |
| 9 | 20 | 5 | 1.6 at 20% discount | 10 | 2 | 1 | 2.5 |
| 7 | 20 | 5 | 1 at cap 10; 1.6 at cap 16; 1.6 at 20% discount | 10 | 2 | 1; 1; 1 | 2.5 |
| 7 | 8 | 2 | 1 at cap 10 | 8 | 1 | 1 (round price wins) | 2 |
| 4.3 | 6 | 1.5 | custom 0.5 at cap 5 and 20% discount | 4.8 | 1.25 | 0.5 (discount wins) | 1.2 |
| 4.5 | 6.25 | 1.5625 | same custom terms | 5 | 1.25 | 0.5 (tie) | 1.25 |
| 4.5 | 8 | 2 | same custom terms | 5 | 1.6 | 0.5 (cap wins) | 1.25 |

The guide's 5%+10% cap-only cohort on 10M existing shares gives D=10M/0.85 before its separate financing pool increase. Test that portion without claiming to reproduce its full top-up example.

Pure math, engine dispatch, supported/unsupported validation, migration/backups, comparison convention differences, and workbook bridges must agree. Cases and exports must report their own calculation version. Preserve legacy numeric fixtures exactly. Add browser coverage for adopting a convention, form constraints, required pool inclusion, invalid delayed conversion, reload, comparison, and export. Independent financial/code review and full CI precede draft publication; production is unchanged.
