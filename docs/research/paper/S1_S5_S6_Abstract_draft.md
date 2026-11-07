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

Of 18 use cases identified from the audit, the original system prevented the failure in 4. ERMA-GRC stopped it in all 18. It rejected writes while not in a session, would not allow anybody to approve their own work, stamped all the audit lines with the signed-in user rather than a claimed name, picked up an edited line, and displayed a database outage as an error. On top of the audit, it blocked 3 of 4 failures, including two approvers choosing the same record simultaneously. Stored results were retrieved from the database surrogate, never from what a system asserted. The new design was unsuccessful twice, and we report both. Client: Something stored by the client itself would be able to set any state on the server without the server right. One fundamental risk indicator indicated the right state of the screen but the calling client could change anything it wanted to store itself. And one with the audit key could have altered the trail off line, undetectable after a reboot. They also rely on one another: a separation of duties is only as reliable as the audit trail it reads, and a rule checked only in the browser is no guarantee.

**Originality/Value**

We treat the integrity of assurance evidence as something a GRC system's design can protect or destroy, rather than as an organisational outcome. This paper provides a taxonomy of failures observed in a working system, seven principles together with two testable claims towards a design theory, and a scenario protocol that others can rerun. Use the principles as a checklist by an auditor and/or buyer. The two failures defined the next set of tasks: off-system anchoring of audit trails, performing all metrics calculations on the server, and demonstrating the ideas to practitioners.

**Keywords:** Assurance integrity and GRC information systems: A design science research view on enterprise risk management implementation with tamper-evident audit trail and separation of duties.

---

## 1 Introduction

Risk registers, heatmaps, signed-off assessments and audit trails are held mainly within governance, risk and compliance (GRC) information systems. These audits are viewed by boards, auditors and regulators as evidence that risks have been managed (Power, 1997). The proof is worth only as much as the screen amounts to the paper below.

We began our research with an audit, of code and runtime behaviour, of a GRC app the documentation for which claimed it was ready for production. It displayed assurance with nothing behind it. Unrated risks were assigned scores calculated from record identifiers or default loss values. Any subsequent Save returned an approved assessment as a draft. The purported immutable audit trail was then stored in the browser where it was subject to any individual user's manipulation. Even when the database rejected a write, the user was told it succeeded. Everyday decisions had turned the system into the problem rather than a solution to it.

We did not find this issue addressed in the literature available to our search. The questions that GRC information systems research pose are why firms implement them and what do they do for them (Papazafeiropoulou & Spanaki, 2016; Racz et al., 2010). Enterprise risk management authors caution that assurance can turn to ritual (Power, 2009). Security research has appropriate mechanisms, but only in a generic sense. (Clark & Wilson, 1987; Saltzer & Schroeder, 1975) We found no evidence that any of the work we came across tested design principles directly on a real system, or indeed connected failures of the design of an application to tainted evidence for reliability, or assurance.

We therefore ask which design failures in a GRC information system compromise the integrity of its assurance evidence (RQ1); which theory-grounded design principles address them (RQ2); and to what extent an instantiation of these principles prevents the failures compared with the original system (RQ3). Our design science response is a failure taxonomy, seven principles and a new artifact, ERMA-GRC tested in time-stamped scenarios. The remaining paper transitions from previous work to method, results, implications and limitations.


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
| Abstract: Findings | 201 | 150–175 |
| Abstract: Originality | 92 | 75–100 |
| Abstract total | 522 | ≤ 500 |
| §1 Introduction | 343 | 300–400 |
| §5 Implications | 153 | 150–200 |
| §6 Conclusion | 200 | 200–250 |
