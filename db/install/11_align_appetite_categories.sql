-- =============================================================================
-- 11  Align risk-appetite categories with the risk types (fix; run once on an existing install)
-- The demo appetite used "IT & Cyber", "Vendor" and "Reputation", but risks are typed
-- "Technology", "Third Party" and "Reputational", so those appetite rows never matched a risk
-- and showed "no rated risk of this type yet". This renames them and adds the missing
-- "Health & Safety" appetite. Safe to run twice. New installs already include the fix.
-- =============================================================================
SET DEFINE OFF
UPDATE ERM_MST_RISK_APPETITE SET CATEGORY = 'Technology'   WHERE CATEGORY = 'IT & Cyber';
UPDATE ERM_MST_RISK_APPETITE SET CATEGORY = 'Third Party'  WHERE CATEGORY = 'Vendor';
UPDATE ERM_MST_RISK_APPETITE SET CATEGORY = 'Reputational' WHERE CATEGORY = 'Reputation';
INSERT INTO ERM_MST_RISK_APPETITE (CATEGORY, STATEMENT, POSTURE, TOLERANCE_SCORE, APPROVED_BY, APPROVED_ON, REVIEW_FREQUENCY, CREATED_BY)
  SELECT 'Health & Safety', 'Zero tolerance for incidents that cause serious injury; every high-severity hazard is treated within 30 days.',
         'Averse', 6, 'COO', DATE '2026-02-01', 'Quarterly', 'demo-seed'
    FROM DUAL
   WHERE NOT EXISTS (SELECT 1 FROM ERM_MST_RISK_APPETITE WHERE CATEGORY = 'Health & Safety');
COMMIT;
