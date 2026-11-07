# Peer review: "When the Risk System Becomes the Risk" (LEAD-2027, Track 1)

## Overall assessment

The topic is relevant: whether a GRC system's own design can fabricate assurance evidence. The evaluation is unusually transparent, and every headline number matches RESULTS.md, results.json and the raw evidence. The problems lie in how the paper describes that evidence. It overstates how outcomes were measured and what "pre-registered" means. It moves deviations, and one result unfavourable to the artifact, into a replication package that reviewers cannot see. It uses the DSR frameworks loosely. Table 2 contains a factual error. Its gap claims are absolute in some places and hedged in others. None of this needs new experiments. **Recommendation: major revision**, which a short revision can complete.

## Must fix before submission

1. **Deviations are hidden (§3.3–3.4, §4.1).**
   - §3.3 says "Each outcome was coded against a criterion fixed in advance". The G4 coding rule (stricter of the UI and API paths) was not registered (RESULTS.md, deviation 4).
   - The paper defers the other deviations to "the replication package": the pilot runs, the substitute stand-in file, the S5.1 re-run, and clarifications made after registration (S2.2, S3.4, S4.2, S6.1, G1 with a different mechanism on each system, G2).
   - The S2.2 clarification chose an approver as the editor. In the unreported non-approver variant (S2.2v), ERMA-GRC returns an approved risk to SUBMITTED, which "reads as OCCURRED". This breaks the registered promise to report the artifact's failures with equal prominence.
   - *Fix:* add a 60–80-word deviations paragraph to §3.4, report S2.2v and G1v in §4.1, and note that the G4 rule is conservative.

2. **Measurement is overstated (abstract, Figure 1).**
   - The abstract says "Each outcome was read from the stored data, not from what the system reported". That is false for S1.1–S1.4 and S7.1, whose outcomes are screen text, and for S4.2, which is the system's own verification output.
   - "Run once each" leaves out the S5.1 re-run and the pilots.
   - *Fix:* "Ground truth was read from the database stand-in; display outcomes compared screen text with it."

3. **"Pre-registered" needs qualifying.**
   - The registration is an internal git commit (`fe021fe`, 17:48:40Z), authored by the AI tool nine minutes before execution began.
   - The harness was not part of it: it was committed with the results.
   - The paper does not say when the pilots ran relative to registration, yet the API pilot's outcomes "were identical to the recorded run".
   - The generalisation scenarios G1 and G2 test mechanisms that Table 2 already lists (ETag, session revocation).
   - *Fix:* write "protocol time-stamped in the project repository before execution (not a public registry)", state when the pilots ran, and acknowledge the bias in scenario selection. Use OSF for the next phase.

4. **The baseline is misdescribed (abstract, §1, §3.1).**
   - (a) The paper calls the system "deployed". AUDIT_REPORT.md calls it "a polished demo, not a working GRC system yet". It also lists four diverging backends and names `dist-deploy/backend/server.js` as the one reported live, whereas the evaluation ran `server.js`.
   - (b) "Ratings derived from row numbers" is imprecise. The parser uses the record ID (`(numId*7)%5+1`), the row index only when the ID is missing, and SLE bands otherwise. The values in S1.1 and Figure 2(a) come from a hard-coded default SLE of $40,000 (`provisioning-assessment-details.tsx:67–69`).
   - (c) Only the S1.4 contradiction is reported. Two other audit claims were not reproduced in S1.2 and S1.3: "status defaults to APPROVED" and "SLE $40,000 on every row".
   - *Fix:* describe the evaluated build precisely and list all three contradictions.

5. **Validity threats belong in the paper (§6).** Add one paragraph covering four threats:
   - (i) One AI agent took part in the audit, the build, scenario drafting, the harness, execution and coding.
   - (ii) The stand-in is ERMA-GRC's own test double (`FakeOrds`), extended by the harness (including `If-Match` normalisation). G1 and S5.x depend on how faithfully it emulates ORDS, and the Oracle 23ai install supports only schema claims.
   - (iii) The baseline's generalisation results are confounded. G1 failed through F2 (stored DRAFT) and G2 because the baseline has no server-side identity. "0/4 vs 3/4" is therefore not independent evidence; report ERMA-GRC's 3/4 alone.
   - (iv) The G4 coding rule was not part of the registration.

6. **The DSR framing is incorrect (§3.1, §2.4).**
   - The paper names "the six activities of the DSRM" but lists four, and two of those are the same activity. Map all six activities and state the entry point.
   - FEDS' Technical Risk & Efficacy strategy runs from artificial formative to naturalistic summative evaluation. This study did one artificial, summative episode within it; say so.
   - The four-step chain does not match Gregor and Jones's eight components, and the "testable propositions" in §5 are never stated.
   - The aim–mechanism–rationale form (Gregor et al., 2020) is claimed, but Table 2 gives only names. Five kernel theories are named for seven principles, and DP1, DP2, DP6 and DP7 have none. *Fix:* add a kernel-theory and rationale column.

7. **Table 2 contains errors.**
   - The final row, "(F1) | DP7", is ambiguous.
   - DP6, "All modules persisted in the database", is false. Users are stored in `DATA_DIR/users.json` and the audit chain in `audit.jsonl`, with only a "best effort" mirror to Oracle (`api/src/audit/log.ts`). The §3.1 claim that the "server mediates every read and write to an Oracle database" has the same problem. A mirror that can fail silently also sits uneasily with DP5.

8. **Gap claims and sources (abstract, §1, §2, §4.2).**
   - The abstract ("It has not asked…") and §1 ("The literature does not address this problem") are absolute, while §2.3 is hedged. Hedge both, and describe the search in one sentence.
   - GATE2 shows that Racz et al., Arena et al., Spanaki and Papazafeiropoulou, Botha and Eloff, and Alles et al. were read at abstract level only. Yet Table 1 assigns each a specific gap. "Takes the monitoring system's own integrity for granted" is the riskiest of these, because the continuous-auditing literature discusses the reliability of the monitoring system.
   - Clark and Wilson (1987) is missing: their model of well-formed transactions, integrity verification, separation of duty and logging is the obvious kernel theory. Its absence undermines §4.2's claim that "DP1, DP2 and DP7 have no direct counterpart in generic security guidance". Cite it and narrow the claim.

## Should fix

1. **Length.** The body runs to about 2,320 words without tables and captions (§1 352, §2 about 597, §3 412 including the AI disclosure, so over its 400-word budget, §4 545, §5 183, §6 223), plus a 449-word abstract and about 420 words of tables. Trim about 300 words.
2. **Bullet lists.** §2.2 is written entirely in bullets, and §3.1, §3.4, §4.1, §5 and §6 rely on them heavily. Convert them to prose.
3. **Abbreviations and terms.**
   - SLE (first used in the Figure 2 caption) and KRI (in the body) are never defined.
   - DSR, DSRM and FEDS are never expanded.
   - HMAC-SHA256, ETag, "201" and "path traversal" need a short gloss.
   - The text says "separation of duties" but the keyword is "segregation of duties"; §2.1 writes "artefact" where the rest of the paper writes "artifact". Pick one form of each.
4. **"The baseline met four criteria"** is followed by three bullets. Map them to S1.2, S1.3, S1.4 and S4.3. "Empty statuses faithfully" is inaccurate: both systems display a null status as "Draft". Under the paper's own definition of assurance integrity (§2.1), that is a default value, not an explicit "no record", and this applies to ERMA-GRC as well.
5. **S1 has no positive control.** The seed data contain no rated risks (ERMA-GRC shows "0 of 37 rated"), so a system that never displayed a rating would pass. The baseline also shows 43 risks against ERMA-GRC's 37 on supposedly "identical" data. Explain both.
6. **Figure 2** was re-captured after the evaluation, from later code (`a58562b`, `07f817b`), with columns hidden by injected CSS. Label it illustrative and cite the matching evidence files.
7. **The AI disclosure (§3.4)** is correctly placed under COPE but incomplete. Add that the AI executed the runs, coded the outcomes and produced the figures. Align the §6 bullet, which lists three of the five uses. Confirm that "the authors… defined the… scenarios" and "the authors revised" are true: git shows the AI committing SCENARIOS.md, and the submission README still asks the authors to rewrite the text.
8. **The replication package** needs an anonymised link. Before sharing it, remove "Pericope", the live domain named in the audit, and the author email in `figures/README.md`.
9. **L1.** Schneier and Kelsey's scheme relies on forward-secure key evolution. ERMA-GRC uses a static key, optionally derived from the JWT secret (`api/src/config.ts:77`). State this departure from the cited kernel theory.
10. **APA 7.**
    - Mikes (2009) must come before Mikes and Kaplan (2015).
    - Order in-text citations alphabetically: (Alles et al., 2006; Vasarhelyi et al., 2004).
    - Add a URL for Crosby and Wallach (2009).
    - Put the Racz et al. book title in sentence case.
11. **Font.** The PDF embeds Liberation Serif, not Times New Roman. Re-export it with Times New Roman available.

## Could improve

1. Ground the definitions in COSO ERM (2017) or ISO 31000. Consider citing information quality (Wang & Strong, 1996), data provenance (relevant to DP1), IS accountability (Vance et al.), and Racz et al.'s 2011 study of GRC software.
2. State the authors' relationship to the baseline; this answers the "strawman" objection.
3. Replace "forensic audit" with "code and runtime audit".
4. Mention the misleading S5.1 error message, a small DP5 nuance.
5. Link the §5 checklist to IT general controls and auditing standards for accounting readers.

## Verified correct

- Table 3 and every count in the abstract, §4 and §6: 4/18 vs 18/18, 0/4 vs 3/4, 4/23 vs 21/23, and no N/A scenarios.
- The baseline failures in §4.1: DRAFT stored after APPROVED; 201 with no session or with `X-User-Role`; an entry under "CEO / Administrator"; 201 "shadow" during the outage; two invented risks scored 16 and 12, with delete buttons.
- ERMA-GRC's G1 (200/409), G2 (401) and G3 (400, no database request) outcomes.
- G4 and L1 as described match G4-api.json and L1.json: the re-chain was detected while the API ran, verification returned `valid: true` after restart, and the creator was rewritten, which supports the DP3→DP4 argument.
- The S1.4 contradiction with the audit is reported honestly.
- The registration commit precedes the results commit, and the figure values match the evidence.
- Anonymity: no names in the text, empty docx creator and lastModifiedBy, and no "Pericope" in any submission file or figure text.
- Format: 5 tables and figures, 6 keywords, a 449-word abstract with the four required headings, template headings, and in the docx Times New Roman 12, single spacing, 1-inch margins and bottom-centre page numbers.
- References: all 21 are cited, every citation is listed, and the bibliographic details I checked are correct.

---

# Response to the review (7 November 2026)

The review was written by an independent reviewer agent that had no part in drafting. Its factual claims were checked against the sources before any change was made.

| # | Issue | What was done |
|---|---|---|
| M1 | Deviations hidden | §3.4 now lists the pilots, the clarifications, the unregistered G4 rule and the S5.1 re-run. §4.1 reports the S2.2 variant (OCCURRED under the literal criterion) and the G1 variant. |
| M2 | Measurement overstated | The abstract now says *stored-state* outcomes were read from the database stand-in. §3.3 says display outcomes come from screen text. Figure 1 says "one recorded run each". |
| M3 | "Pre-registered" | Now "time-stamped in the project repository, not a public registry, before execution". The pilots are dated after registration. §6 acknowledges the bias from author- and AI-written scenarios. |
| M4 | Baseline misdescribed | Now "an existing GRC application, developed before this study and documented as production-ready". Ratings are described as invented "from record identifiers or default loss values" (checked in the code). The audit contradictions are reported for S1.3 and S1.4. |
| M5 | Validity threats | §6 covers the AI's part in every stage, the stand-in derived from ERMA-GRC's own test double, and the missing positive control. §4.1 states that the baseline's 0/4 on the generalisation scenarios is not independent evidence. |
| M6 | DSR framing | §3.1 maps all six DSRM activities and their entry point, and calls the evaluation one artificial, summative FEDS episode. §2.4 and §5 name the design-theory components and two testable propositions. Table 2 has a kernel-theory column. |
| M7 | Table 2 errors | The DP7 row is now labelled "F1 (metrics)". DP6 states that accounts and the audit chain sit on the API server, with the chain copied to the database. Table 2 now says the indicator status is computed "in the client", and §4.1 reports that the API stores a status declared by the client. |
| M8 | Gap and sources | Gap claims are hedged the same way in the abstract, §1 and §2.3. §2.2 says five of the seven Table 1 studies were assessed from their abstracts, and their gap cells read "Not its focus". Clark & Wilson (1987) is added and verified, and §4.2 is narrowed to say the principles "specialise" these integrity ideas. |
| S1 | Length | The body is about 2,276 words, and every section is within its budget: §3 is 400 words, the abstract 452. |
| S2 | Bullet lists | All body text is now prose. |
| S3 | Abbreviations | GRC, ERM, DSR, DSRM, FEDS, RCSA, SLE and KRI are defined at first use. "Separation of duties" is used throughout, including the keyword; "artefact" was replaced. |
| S4 | "Four criteria" with three bullets | Rewritten as four sentences mapped to S1.2, S1.3, S1.4 and S4.3, noting that both systems show "Draft" for a missing status. |
| S5 | Positive control | Stated as a limitation in §6. |
| S6 | Figure 2 | The caption now labels it an illustrative re-capture from the renamed build with unrelated columns hidden. |
| S7 | AI disclosure | Now adds that the AI ran the test scripts, proposed codings and produced the figures. **The statement that the authors "revised the text" must be made true before submission.** |
| S8 | Replication package | Not done here: the authors decide on an anonymised link. The paper says "available on request". |
| S9 | Static key | §4.2 now contrasts Schneier and Kelsey's evolving keys with ERMA-GRC's static key. |
| S10 | APA | Fixed: Mikes ordering, in-text order, the Crosby & Wallach URL (verified), and sentence case for the Racz et al. book title. |
| S11 | PDF font | Not fixable here: Times New Roman is not installed, and installing it needs the user to accept Microsoft's licence. **Submit the .docx, or export the PDF from Word.** |
| — | Template font size | Tables and captions are now 12 pt, as the template requires. |
| C1–C5 | Could improve | Not done, to stay within the word limits. They are noted for the camera-ready version. |
