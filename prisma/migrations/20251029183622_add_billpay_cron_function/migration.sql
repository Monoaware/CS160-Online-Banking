-- Create function to process billpay rule (called by pg_cron)
-- This function checks if the rule is active and executes the payment

CREATE OR REPLACE FUNCTION process_billpay_rule(rule_id_param INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rule_record RECORD;
  source_account_record RECORD;
  payee_record RECORD;
  current_time TIMESTAMP := NOW();
  idempotency_key TEXT;
  amount_decimal DECIMAL(19, 4);
BEGIN
  -- Get the billpay rule
  SELECT * INTO rule_record
  FROM billpay_rules
  WHERE id = rule_id_param;

  -- Check if rule exists
  IF rule_record IS NULL THEN
    RAISE WARNING 'Billpay rule % not found', rule_id_param;
    RETURN;
  END IF;

  -- Check if rule is within active time window
  IF current_time < rule_record.start_time THEN
    RAISE NOTICE 'Billpay rule % not yet started (start_time: %)', rule_id_param, rule_record.start_time;
    RETURN;
  END IF;

  IF rule_record.end_time IS NOT NULL AND current_time > rule_record.end_time THEN
    RAISE NOTICE 'Billpay rule % has expired (end_time: %)', rule_id_param, rule_record.end_time;
    RETURN;
  END IF;

  -- Get source account
  SELECT * INTO source_account_record
  FROM internal_accounts
  WHERE id = rule_record.source_internal_id;

  -- Check if source account exists and is active
  IF source_account_record IS NULL THEN
    RAISE WARNING 'Source account % not found for billpay rule %', rule_record.source_internal_id, rule_id_param;
    RETURN;
  END IF;

  IF NOT source_account_record.is_active THEN
    RAISE WARNING 'Source account % is inactive for billpay rule %', rule_record.source_internal_id, rule_id_param;
    RETURN;
  END IF;

  -- Get payee
  SELECT * INTO payee_record
  FROM billpay_payees
  WHERE id = rule_record.payee_id;

  -- Check if payee exists and is active
  IF payee_record IS NULL THEN
    RAISE WARNING 'Payee % not found for billpay rule %', rule_record.payee_id, rule_id_param;
    RETURN;
  END IF;

  IF NOT payee_record.is_active THEN
    RAISE WARNING 'Payee % is inactive for billpay rule %', rule_record.payee_id, rule_id_param;
    RETURN;
  END IF;

  -- Generate idempotency key
  idempotency_key := 'billpay_cron_' || rule_id_param || '_' || EXTRACT(EPOCH FROM current_time)::BIGINT;

  -- Check for existing transaction with this idempotency key (prevent duplicates)
  IF EXISTS (
    SELECT 1 FROM transactions
    WHERE idempotency_key = idempotency_key
    AND transaction_type = 'billpay'
    AND bill_pay_rule_id = rule_id_param
  ) THEN
    RAISE NOTICE 'Billpay rule % already processed (idempotency key exists)', rule_id_param;
    RETURN;
  END IF;

  amount_decimal := rule_record.amount;

  -- Check sufficient funds
  IF source_account_record.balance < amount_decimal THEN
    -- Create denied transaction
    INSERT INTO transactions (
      internal_account_id,
      amount,
      status,
      transaction_type,
      direction,
      bill_pay_rule_id,
      idempotency_key,
      external_routing_number,
      external_account_number,
      external_nickname,
      created_at
    ) VALUES (
      rule_record.source_internal_id,
      -amount_decimal,
      'denied',
      'billpay',
      'outbound',
      rule_id_param,
      idempotency_key,
      payee_record.routing_number,
      payee_record.account_number,
      payee_record.business_name,
      current_time
    );
    RAISE WARNING 'Insufficient funds for billpay rule %', rule_id_param;
    RETURN;
  END IF;

  -- Execute payment: deduct from source account and create transaction
  -- Note: This is a black hole payment - we don't validate external account exists
  UPDATE internal_accounts
  SET balance = balance - amount_decimal
  WHERE id = rule_record.source_internal_id
  AND balance >= amount_decimal;

  -- Check if update succeeded
  IF NOT FOUND THEN
    -- Create denied transaction
    INSERT INTO transactions (
      internal_account_id,
      amount,
      status,
      transaction_type,
      direction,
      bill_pay_rule_id,
      idempotency_key,
      external_routing_number,
      external_account_number,
      external_nickname,
      created_at
    ) VALUES (
      rule_record.source_internal_id,
      -amount_decimal,
      'denied',
      'billpay',
      'outbound',
      rule_id_param,
      idempotency_key,
      payee_record.routing_number,
      payee_record.account_number,
      payee_record.business_name,
      current_time
    );
    RAISE WARNING 'Failed to update account balance for billpay rule %', rule_id_param;
    RETURN;
  END IF;

  -- Create approved transaction
  INSERT INTO transactions (
    internal_account_id,
    amount,
    status,
    transaction_type,
    direction,
    bill_pay_rule_id,
    idempotency_key,
    external_routing_number,
    external_account_number,
    external_nickname,
    created_at
  ) VALUES (
    rule_record.source_internal_id,
    -amount_decimal,
    'approved',
    'billpay',
    'outbound',
    rule_id_param,
    idempotency_key,
    payee_record.routing_number,
    payee_record.account_number,
    payee_record.business_name,
    current_time
  );

  RAISE NOTICE 'Billpay rule % processed successfully', rule_id_param;
END;
$$;

-- Grant execute permission to authenticated users (or the service role)
-- Note: Adjust permissions as needed for your security model
GRANT EXECUTE ON FUNCTION process_billpay_rule(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION process_billpay_rule(INTEGER) TO service_role;


