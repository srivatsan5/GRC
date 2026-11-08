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

Out of the 18 possible scenarios that arise during the audit process, the original system would prevent the failure in 4 of them. On the other hand, ERMA-GRC prevented all the 18 failures. ERMA-GRC rejects writes that occur out of a session, disallows any users from approving their own documents, stamps the audit line with the signed-in user and not the claimed name, captures an edit entry and reports the database unavailability as an error. Outside of the audit process, it prevents 3 out of the 4 failures, including two simultaneous approvals of the same record. It gets the stored results from the database emulator and not from whatever the system claims. There were two instances where the new design failed, and we document both. While one critical risk indicator showed the appropriate state on the screen, a client connecting to the server could set any state it liked. Also, with the audit key, a person can change the audit trail offline without detection even after restarting.

**Originality/Value**

We treat the integrity of assurance evidence as something a GRC system's design can protect or destroy, rather than as an organisational outcome. This paper provides a taxonomy of failures observed in a working system, seven principles together with two testable propositions towards a design theory, and a scenario protocol that others can rerun. Buyers and auditors may apply the principles to their checklists. The two design failures define the next three: off-system anchoring of audit trails, computing all metrics on the server and validating the concepts through practitioners' testing.

**Keywords:** assurance integrity; GRC information systems; design science research; enterprise risk management; tamper-evident audit trail; separation of duties

---

## 1 Introduction

Risk registers, heat maps, signed-off assessments and audit trails reside primarily in GRC information systems. This documentation is considered by boards of directors, auditors and regulators as proof of risk management (Power, 1997). Its value is proportional to the value of the record behind the proof.

We started the research project with an audit of code and run-time behavior of GRC application that was described in its documentation as ready for deployment. The application displayed assurance without having anything to back it up. Unrated risks received the score that was computed based on the identifier of the related record or default loss value. Any further save reverted signed off assessment into the draft status. The claimed immutable audit trail was stored in the browser, and any user was able to tamper with it. When the attempt to write into the database failed, the user received a confirmation of success. Everyday design choices made the system itself a source of risk rather than a risk control.

We found no relevant literature on the topic. The research in the field of GRC information systems focuses on the questions of why and what do companies implement GRC applications (Papazafeiropoulou & Spanaki, 2016; Racz et al., 2010). Enterprise risk management authors warn that assurance can become ritual (Power, 2009). Security literature provides suitable solutions, but in a general form only (Clark & Wilson, 1987; Saltzer & Schroeder, 1975).

We therefore ask which design failures in a GRC information system compromise the integrity of its assurance evidence (RQ1); which theory-grounded design principles address them (RQ2); and to what extent an instantiation of these principles prevents the failures compared with the original system (RQ3). Our design science research approach involves a failure taxonomy, seven principles and an innovation artifact, ERMA-GRC, validated through time-stamped scenarios. The remainder of the paper will progress from literature review, through methodology, results and implications, to limitations.


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
| Abstract: Findings | 167 | 150–175 |
| Abstract: Originality | 90 | 75–100 |
| Abstract total | 486 | ≤ 500 |
| §1 Introduction | 315 | 300–400 |
| §5 Implications | 153 | 150–200 |
| §6 Conclusion | 200 | 200–250 |
