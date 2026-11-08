# Abstract, §1 Introduction, §5 Implications, §6 Conclusion

*Revised after the Gate 7 peer review (7 November 2026). Numbers come from `docs/research/evaluation/RESULTS.md`. The abstract contains no references, tables or equations, as both templates require.*

---

**Title:** When Software Fabricates Assurance: Seven Design Principles for Trustworthy Governance, Risk and Compliance Systems

**Name of the Track:** Track 1 – Information Systems: Theory and Practice (Digital Ethics and Policy: Regulation and Compliance)

**Type of Submission:** Ongoing research (design science research; artifact and technical evaluation completed, naturalistic evaluation pending)

## Abstract

**Purpose**

Boards, auditors and regulators rely on governance, risk and compliance (GRC) information systems for evidence that risks are identified, rated, approved and controlled. Research on these systems has examined their adoption and value. We found no study asking whether the evidence they present can itself be trusted. A code and runtime audit of an existing risk management application found that the software invented risk ratings, discarded approvals, accepted unauthenticated authority and reported failed database writes as successes. This study asks which design failures compromise the integrity of assurance evidence. It also asks which design principles prevent them, and how well an instantiation of those principles performs against the original system.

**Design/Methodology/Approach**

This is a design science study. We read the code of an existing risk management application, ran it, and recorded seven distinct ways in which it failed. Each failure was traced to theory that already explains it, from integrity models, fail-safe defaults and complete mediation to separation of duties, tamper-evident logging and the critique of audit as ritual, and a design principle was drawn from that theory. We built a new system, ERMA-GRC, on these principles. The old and new systems then faced 23 scenarios over the same stored data, under a protocol time-stamped in the project repository beforehand. Eighteen scenarios come from the audit, four go beyond it, and one was meant to fail. All deviations are reported.

**Findings**

Out of the 18 scenarios derived from the audit, the original system prevented the failure in 4 of them. On the other hand, ERMA-GRC prevented all 18 failures. It rejected writes made outside a session, stopped users from approving their own records, stamped each audit line with the signed-in user and not the claimed name, detected an edited entry and reported database unavailability as an error. Beyond the audit, it prevented 3 of the 4 failures, including two simultaneous approval decisions on the same record. Stored results were read from the database stand-in, not from whatever a system claimed. There were two instances where the new design failed, and we document both. While one key risk indicator showed the appropriate state on the screen, a client connecting directly to the server could set any state it liked. Also, a person holding the audit key could change the audit trail offline, undetected after a restart. The principles also depend on one another: separation of duties is only as reliable as the audit trail it reads.

**Originality/Value**

We treat the integrity of assurance evidence as something a GRC system's design can protect or destroy, rather than as an organisational outcome. This paper provides a taxonomy of failures observed in a working system, seven principles together with two testable propositions towards a design theory, and a scenario protocol that others can rerun. Buyers and auditors may use the principles as a checklist. The two design failures define the next three tasks: off-system anchoring of audit trails, computing all metrics on the server and testing the principles with practitioners.

**Keywords:** assurance integrity; GRC information systems; design science research; enterprise risk management; tamper-evident audit trail; separation of duties

---

## 1 Introduction

Risk registers, heat maps, signed-off assessments and audit trails reside primarily in governance, risk and compliance (GRC) information systems. Boards, auditors and regulators treat this documentation as proof of risk management (Power, 1997). That proof is only as good as the record behind it.

We started the research with an audit of the code and run-time behaviour of a GRC application documented as ready for deployment. The application displayed assurance with nothing behind it. Unrated risks received scores computed from the related record's identifier or a default loss value. Any further save reverted a signed-off assessment to draft status. The claimed immutable audit trail was stored in the browser, where any user could tamper with it. When a database write failed, the user still saw a confirmation of success. Everyday design choices made the system itself a source of risk rather than a risk control.

Within the literature our search reached, we found no work on this problem. Research on GRC information systems asks why companies implement GRC applications and what value they gain (Papazafeiropoulou & Spanaki, 2016; Racz et al., 2010). Enterprise risk management authors warn that assurance can become ritual (Power, 2009). Security literature provides suitable solutions, but in a general form only (Clark & Wilson, 1987; Saltzer & Schroeder, 1975). No study we found links an application's design failures to corrupted assurance evidence or tests design principles on a real system.

We therefore ask which design failures in a GRC information system compromise the integrity of its assurance evidence (RQ1); which theory-grounded design principles address them (RQ2); and to what extent an instantiation of these principles prevents the failures compared with the original system (RQ3). Our design science research approach yields a failure taxonomy, seven principles and a new artifact, ERMA-GRC, tested through time-stamped scenarios. The remainder moves from literature review through method, results and implications to limitations.


---

## 5 Implications

**Theoretical implications.** The study recasts assurance integrity as a design property of GRC systems and contributes components of a nascent design theory (Gregor & Jones, 2007): purpose and scope, constructs, seven principles and two testable propositions. P1: separation of duties is only as strong as the integrity of the evidence trail it reads. P2: an assurance rule enforced only in the client can be defeated by any authenticated client.

**Practical implications.** Before purchase, buyers and auditors can test whether an unrated risk is shown as unrated, whether an ordinary save can overwrite an approval, whether authority comes from a verified session, whether the audit trail is verifiable and anchored outside the vendor's control, and whether a failed write can ever appear as a success.

**Societal implications.** Regulators and the public increasingly rely on compliance claims produced by software. Systems that cannot fabricate evidence make those claims more trustworthy and accountability harder to evade.


---

## 6 Conclusion, Limitations and Future Research

This study asked how a GRC system's design can corrupt its assurance evidence, and how to prevent it. An audit yielded seven failure modes, addressed by seven theory-grounded principles. ERMA-GRC, which instantiates them, prevented every audit-derived failure; the original system prevented four of eighteen. Its two failures, a metric enforced only in the client and an audit trail its key holder can rewrite, are part of the contribution.

**Limitations.** The evidence comes from one case. The authors built the artifact and wrote the scenarios with an AI assistant involved in every stage, from audit to outcome coding; time-stamping the protocol and reporting every outcome reduce but do not remove this bias. The evaluation was artificial: both systems ran against a stand-in derived from ERMA-GRC's own test double, so concurrency and outage results depend on its fidelity, and the display scenarios lacked a rated risk as a positive control. The literature search lacked Scopus and Web of Science, and no commercial product was compared.

**Future research.** Next steps are naturalistic evaluation with practitioners, multiple-case studies across GRC products, externally anchored audit commitments, server-side computation of every assurance metric, and longitudinal study of how integrity-preserving systems change the use of risk information.


---

**Word counts (body text):**

| Section | Words | Budget |
|---|---|---|
| Abstract: Purpose | 110 | 100–125 |
| Abstract: Design | 119 | 100–125 |
| Abstract: Findings | 174 | 150–175 |
| Abstract: Originality | 90 | 75–100 |
| Abstract total | 493 | ≤ 500 |
| §1 Introduction | 311 | 300–400 |
| §5 Implications | 153 | 150–200 |
| §6 Conclusion | 200 | 200–250 |
