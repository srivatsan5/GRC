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

Of the 18 scenarios taken from the audit, the original system stopped the failure in 4. ERMA-GRC stopped it in all 18. It refused writes without a session, would not let anyone approve their own work, stamped each audit entry with the signed-in user instead of a claimed name, caught an edited entry, and showed a database outage as an error. Beyond the audit, it stopped 3 of 4 failures, including two approvers deciding on one record at the same moment. Stored outcomes were read from the database stand-in, not from what a system claimed. The new design failed twice, and we report both in full. A key risk indicator showed the right status on screen, yet a client calling the server directly could store any status it chose. And anyone holding the audit key could rewrite the trail offline, unnoticed after a restart. The principles also lean on each other: separation of duties is only as sound as the audit trail it reads, and a rule checked only in the browser assures nothing.

**Originality/Value**

We treat the integrity of assurance evidence as something a GRC system's design can protect or destroy, rather than as an organisational outcome. The paper offers a taxonomy of failures seen in a working system, seven principles with two testable propositions towards a design theory, and a scenario protocol that others can rerun. Auditors and buyers can use the principles as a checklist. The two failures set the next tasks: anchoring audit trails outside the system, computing every metric on the server, and testing the principles with practitioners.

**Keywords:** assurance integrity; GRC information systems; design science; enterprise risk management; tamper-evident audit trail; separation of duties

---

## 1 Introduction

Risk registers, heatmaps, signed-off assessments and audit trails are now kept mostly in governance, risk and compliance (GRC) information systems. Boards, auditors and regulators read these records as proof that risks are under control (Power, 1997). The proof is worth something only if the screen matches the record underneath.

Our study started with an audit, of code and runtime behaviour, of a GRC application whose documentation called it production-ready. It displayed assurance with nothing behind it. Unrated risks were given ratings worked out from record identifiers or default loss values. Any later save quietly turned an approved assessment back into a draft. The so-called immutable audit trail was stored in the browser, where any user could change it. When the database refused a write, the user was told it had worked. Ordinary design choices had made the system a source of risk instead of a check on it.

We did not find this problem treated in the literature our search reached. Studies of GRC information systems ask why firms adopt them and what value they bring (Papazafeiropoulou & Spanaki, 2016; Racz et al., 2010). Writers on enterprise risk management warn that assurance can slide into ritual (Power, 2009). Security research offers the relevant mechanisms, though in generic form (Clark & Wilson, 1987; Saltzer & Schroeder, 1975). None of the work we found links an application's design failures to corrupted assurance evidence, or tests design principles on a real system.

We therefore ask which design failures in a GRC information system compromise the integrity of its assurance evidence (RQ1); which theory-grounded design principles address them (RQ2); and to what extent an instantiation of these principles prevents the failures compared with the original system (RQ3). Our design science answer is a failure taxonomy, seven principles and a new artifact, ERMA-GRC, tested in time-stamped scenarios. The rest of the paper moves from prior work to method, results, implications and limitations.


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
| Abstract: Originality | 88 | 75–100 |
| Abstract total | 491 | ≤ 500 |
| §1 Introduction | 317 | 300–400 |
| §5 Implications | 153 | 150–200 |
| §6 Conclusion | 200 | 200–250 |
