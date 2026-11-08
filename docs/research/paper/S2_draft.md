# §2 Literature Review

*Revised after the Gate 7 peer review (7 November 2026). Every source below was checked against Crossref. Studies read only at abstract level are described no further than their abstracts allow, and the text says which ones. Word count excludes headings and Table 1.*

---

## 2 Literature Review

### 2.1 Conceptual Background

Enterprise risk management (ERM) is a structured approach used by an organization for identifying, measuring, controlling and monitoring the risks of the organization, holistically. Information systems for governance, risk and compliance (GRC) bring together the efforts of ERM and maintain its documentation (Racz et al., 2010). Such documentation provides the boards, auditors and regulatory agencies with assurance: assurance that the risks are being identified, measured, controlled and monitored. Assurance integrity is the property of the GRC information system according to which every assurance item that it provides (such as ratings, approvals, exposure amounts, or audit trail entries) is either an action performed and documented by the system in which case a person responsible can be held accountable for it, or a statement that there is no such record.

### 2.2 Review of Previous Studies

Organisational research shows that ERM is enacted rather than adopted. Arena et al. (2010) trace how risk rationalities, experts and technologies combine differently across firms; Mikes (2009) identifies distinct "calculative cultures"; Mikes and Kaplan (2015) argue that a single ERM template is itself a risk; and Meidell and Kaarbøe (2017) show that a risk function's tools shape its influence. Power (1997) warns that verification rituals can yield auditability rather than assurance, and Power (2009) calls ERM at its weakest a "risk management of nothing". Technology therefore helps produce risk, so its design merits study.

GRC information systems research has defined the field (Racz et al., 2010), identified implementation success factors (Papazafeiropoulou & Spanaki, 2016), and described an adoption lifecycle and value drivers (Spanaki & Papazafeiropoulou, 2016). It asks how these systems are adopted and what value they deliver, not whether their evidence can be trusted.

The artifact's mechanisms exist in generic form: well-formed transactions, integrity verification and separation of duty (Clark & Wilson, 1987); fail-safe defaults and complete mediation (Saltzer & Schroeder, 1975); separation of duties in workflows (Botha & Eloff, 2001); and tamper-evident logs, using hash chains with evolving keys (Schneier & Kelsey, 1999) or history trees kept honest by external auditors (Crosby & Wallach, 2009). Continuous assurance monitors business-process controls through analytics (Alles et al., 2006; Vasarhelyi et al., 2004), focusing on monitored processes rather than faults in the monitoring software. Table 1 summarises the seven closest studies; five were assessed from abstracts only.

**Table 1.** Summary of Selected Literature

| Author(s) | Context | Methodology | Key Findings | Gap Identified |
|---|---|---|---|---|
| Racz et al. (2010) | Integrated GRC | Literature analysis, definition | A frame of reference for GRC research | Not its focus: artifact design and evaluation |
| Papazafeiropoulou & Spanaki (2016) | GRC IS implementation | Literature review and expert interviews | Implementation characteristics and success factors | Integrity of the evidence the systems produce |
| Spanaki & Papazafeiropoulou (2016) | GRC IS adoption | Qualitative study | Adoption lifecycle; integration, optimisation and information as value drivers | Not its focus: trustworthiness of that information |
| Arena et al. (2010) | ERM in organisations | Comparative case study | ERM varies with its rationalities, experts and technologies | Not its focus: how a technology's design distorts risk information |
| Alles et al. (2006) | Continuous control monitoring | Pilot implementation (Siemens) | Business-process controls can be monitored continuously | Not its focus: design faults in the monitoring software |
| Botha & Eloff (2001) | Workflow access control | Conceptual model | Static and dynamic separation-of-duties enforcement | Not its focus: approval semantics of risk assessments |
| Crosby & Wallach (2009) | Secure logging | Data structure and analysis | Efficient tamper-evident logs, provided auditors hold commitments | Business workflows and other failure types |

### 2.3 Research Gap

Within the web-indexed literature our search reached, with every DOI verified, no study examines how a GRC application's design can itself corrupt the assurance evidence it presents: by fabricating values, overwriting decisions, accepting unauthenticated authority or reporting failures as success. GRC research stops at adoption and value, while mechanism research does not address the evidence that risk and control self-assessment produces: ratings, approvals, appetite exposure and indicator status. The gap is therefore not a missing mechanism but missing design knowledge that maps application failures to corrupted evidence and tests principles against a real system.

### 2.4 Research Framework

The study links observed failure modes (RQ1), theory-grounded principles (RQ2), their mechanisms, and scenario outcomes testing whether the failures are prevented (RQ3). These contribute components of a design theory (Gregor & Jones, 2007): purpose and scope, constructs, principles of form and function, and testable propositions (Section 5). Each principle pairs an aim with a mechanism and a kernel-theory rationale (Gregor et al., 2020).


---

**Word count:** ≈ 517 (budget 500–600).

## References cited in this section (APA 7, checked against Crossref)

- Alles, M., Brennan, G., Kogan, A., & Vasarhelyi, M. A. (2006). Continuous monitoring of business process controls: A pilot implementation of a continuous auditing system at Siemens. *International Journal of Accounting Information Systems, 7*(2), 137–161. https://doi.org/10.1016/j.accinf.2005.10.004
- Arena, M., Arnaboldi, M., & Azzone, G. (2010). The organizational dynamics of enterprise risk management. *Accounting, Organizations and Society, 35*(7), 659–675. https://doi.org/10.1016/j.aos.2010.07.003
- Botha, R. A., & Eloff, J. H. P. (2001). Separation of duties for access control enforcement in workflow environments. *IBM Systems Journal, 40*(3), 666–682. https://doi.org/10.1147/sj.403.0666
- Clark, D. D., & Wilson, D. R. (1987). A comparison of commercial and military computer security policies. In *Proceedings of the 1987 IEEE Symposium on Security and Privacy* (pp. 184–194). IEEE. https://doi.org/10.1109/SP.1987.10001
- Cox, L. A., Jr. (2008). What's wrong with risk matrices? *Risk Analysis, 28*(2), 497–512. https://doi.org/10.1111/j.1539-6924.2008.01030.x
- Crosby, S. A., & Wallach, D. S. (2009). Efficient data structures for tamper-evident logging. In *Proceedings of the 18th USENIX Security Symposium* (pp. 317–334). USENIX Association. https://www.usenix.org/legacy/event/sec09/tech/full_papers/crosby.pdf
- Gregor, S., Chandra Kruse, L., & Seidel, S. (2020). Research perspectives: The anatomy of a design principle. *Journal of the Association for Information Systems, 21*(6), 1622–1652. https://doi.org/10.17705/1jais.00649
- Gregor, S., & Jones, D. (2007). The anatomy of a design theory. *Journal of the Association for Information Systems, 8*(5), 312–335. https://doi.org/10.17705/1jais.00129
- Meidell, A., & Kaarbøe, K. (2017). How the enterprise risk management function influences decision-making in the organization – A field study of a large, global oil and gas company. *The British Accounting Review, 49*(1), 39–55. https://doi.org/10.1016/j.bar.2016.10.005
- Mikes, A. (2009). Risk management and calculative cultures. *Management Accounting Research, 20*(1), 18–40. https://doi.org/10.1016/j.mar.2008.10.005
- Mikes, A., & Kaplan, R. S. (2015). When one size doesn't fit all: Evolving directions in the research and practice of enterprise risk management. *Journal of Applied Corporate Finance, 27*(1), 37–40. https://doi.org/10.1111/jacf.12102
- Papazafeiropoulou, A., & Spanaki, K. (2016). Understanding governance, risk and compliance information systems (GRC IS): The experts view. *Information Systems Frontiers, 18*(6), 1251–1263. https://doi.org/10.1007/s10796-015-9572-3
- Power, M. (1997). *The audit society: Rituals of verification*. Oxford University Press.
- Power, M. (2009). The risk management of nothing. *Accounting, Organizations and Society, 34*(6–7), 849–855. https://doi.org/10.1016/j.aos.2009.06.001
- Racz, N., Weippl, E., & Seufert, A. (2010). A frame of reference for research of integrated governance, risk and compliance (GRC). In B. De Decker & I. Schaumüller-Bichl (Eds.), *Communications and multimedia security* (Lecture Notes in Computer Science, Vol. 6109, pp. 106–117). Springer. https://doi.org/10.1007/978-3-642-13241-4_11
- Saltzer, J. H., & Schroeder, M. D. (1975). The protection of information in computer systems. *Proceedings of the IEEE, 63*(9), 1278–1308. https://doi.org/10.1109/PROC.1975.9939
- Schneier, B., & Kelsey, J. (1999). Secure audit logs to support computer forensics. *ACM Transactions on Information and System Security, 2*(2), 159–176. https://doi.org/10.1145/317087.317089
- Spanaki, K., & Papazafeiropoulou, A. (2016). The implementation of governance, risk, and compliance IS: Adoption lifecycle and enterprise value. *Information Systems Management, 33*(4), 302–315. https://doi.org/10.1080/10580530.2016.1220214
- Vasarhelyi, M. A., Alles, M. G., & Kogan, A. (2004). Principles of analytic monitoring for continuous assurance. *Journal of Emerging Technologies in Accounting, 1*(1), 1–21. https://doi.org/10.2308/jeta.2004.1.1.1

**Notes for you before approving:** the three publisher-page checks from the previous draft still apply. Clark & Wilson (1987) was added after the peer review; Crossref lists its first page only, and pages 184–194 come from the IEEE proceedings.
