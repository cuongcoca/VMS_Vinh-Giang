-- Migration CT-1: Standardize code prefixes theo mockup wms_mockups_4.html v3.0
-- Tham chiếu: docs/REVIEW_MOCKUP_VS_CODE_2026-05-28.md (CT-1)
--
-- Đổi:
--   PNK-YYYY-SSSS  → PHN-YYYY-SSSS  (InboundRequest)        — same format
--   PTT-YYYY-SSSS  → PNT-YYYY-SSSS  (InboundTemp)           — same format (defer YYMMDD-NNN)
--   KK-YYYY-NNN    → STK-YYYY-NNNN  (StocktakeSession)      — pad 3→4
--   DCT-YYYY-NNN   → ADJ-YYYY-NNNN  (AdjustmentVoucher)     — pad 3→4
--
-- Không đổi: code_year + code_seq numeric columns (chỉ rename `code` string).
-- An toàn unique: @@unique([code_year, code_seq]) đảm bảo không có duplicate
-- (code_year, code_seq) trong cùng table → rename prefix không gây collision.

BEGIN;

-- 1. InboundRequest: PNK → PHN
UPDATE inbound_requests
SET code = 'PHN-' || SUBSTRING(code FROM 5)
WHERE code LIKE 'PNK-%';

-- 2. InboundTemp: PTT → PNT
UPDATE inbound_temps
SET code = 'PNT-' || SUBSTRING(code FROM 5)
WHERE code LIKE 'PTT-%';

-- 3. StocktakeSession: KK-YYYY-NNN → STK-YYYY-NNNN
-- `KK-2026-001` → year từ pos 4..7, seq từ pos 9; pad seq lên 4 digit
UPDATE stocktake_sessions
SET code = 'STK-'
        || SUBSTRING(code FROM 4 FOR 4)
        || '-'
        || LPAD(SUBSTRING(code FROM 9), 4, '0')
WHERE code LIKE 'KK-%';

-- 4. AdjustmentVoucher: DCT-YYYY-NNN → ADJ-YYYY-NNNN
-- `DCT-2026-001` → year từ pos 5..8, seq từ pos 10; pad seq lên 4 digit
UPDATE adjustment_vouchers
SET code = 'ADJ-'
        || SUBSTRING(code FROM 5 FOR 4)
        || '-'
        || LPAD(SUBSTRING(code FROM 10), 4, '0')
WHERE code LIKE 'DCT-%';

-- Verify: không còn prefix cũ nào
DO $$
DECLARE
  leftover INT;
BEGIN
  SELECT COUNT(*) INTO leftover FROM inbound_requests WHERE code LIKE 'PNK-%';
  IF leftover > 0 THEN RAISE EXCEPTION 'Migration failed: % rows still have PNK- prefix', leftover; END IF;

  SELECT COUNT(*) INTO leftover FROM inbound_temps WHERE code LIKE 'PTT-%';
  IF leftover > 0 THEN RAISE EXCEPTION 'Migration failed: % rows still have PTT- prefix', leftover; END IF;

  SELECT COUNT(*) INTO leftover FROM stocktake_sessions WHERE code LIKE 'KK-%';
  IF leftover > 0 THEN RAISE EXCEPTION 'Migration failed: % rows still have KK- prefix', leftover; END IF;

  SELECT COUNT(*) INTO leftover FROM adjustment_vouchers WHERE code LIKE 'DCT-%';
  IF leftover > 0 THEN RAISE EXCEPTION 'Migration failed: % rows still have DCT- prefix', leftover; END IF;
END $$;

COMMIT;
