
-- 1) Corrigir o CHECK constraint do transaction_history para permitir 'referral_reward' e 'free_credits_secure'
ALTER TABLE public.transaction_history
  DROP CONSTRAINT IF EXISTS transaction_history_type_check;

ALTER TABLE public.transaction_history
  ADD CONSTRAINT transaction_history_type_check
  CHECK (
    type = ANY (
      ARRAY[
        'credit_purchase'::text,
        'sprite_purchase'::text,
        'sprite_loss'::text,
        'points_earned'::text,
        'withdraw_request'::text,
        'referral_reward'::text,
        'free_credits_secure'::text
      ]
    )
  );

-- 2) Atualizar a função get_referral_statistics para corrigir ORDER BY e marcos
CREATE OR REPLACE FUNCTION public.get_referral_statistics(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_credits_earned INTEGER := 0;
  total_referred_users INTEGER := 0;
  active_users INTEGER := 0;
  completed_milestones INTEGER := 0;
  referred_users_list jsonb;
BEGIN
  -- Total de créditos ganhos por indicações
  SELECT COALESCE(SUM(credits_earned), 0)
    INTO total_credits_earned
  FROM referral_rewards
  WHERE referrer_user_id = p_user_id;

  -- Total de usuários indicados (contar baseados em 'signup')
  SELECT COUNT(DISTINCT referred_user_id)
    INTO total_referred_users
  FROM referral_rewards
  WHERE referrer_user_id = p_user_id
    AND milestone_type = 'signup';

  -- Usuários ativos: aqueles que já cumpriram qualquer marco de saque
  SELECT COUNT(DISTINCT rr.referred_user_id)
    INTO active_users
  FROM referral_rewards rr
  WHERE rr.referrer_user_id = p_user_id
    AND rr.milestone_type IN (
      'first_withdrawal',
      'withdrawal_25',
      'withdrawal_100',
      'withdrawal_500',
      'withdrawal_1000'
    );

  -- Quantidade de marcos concluídos (exclui 'signup')
  SELECT COUNT(*)
    INTO completed_milestones
  FROM referral_rewards
  WHERE referrer_user_id = p_user_id
    AND milestone_type <> 'signup';

  -- Lista de usuários indicados com seus marcos
  SELECT jsonb_agg(
           jsonb_build_object(
             'name', COALESCE(referred_user_name, 'Usuário'),
             'milestone_type', milestone_type,
             'credits_earned', credits_earned,
             'completed_at', milestone_completed_at,
             'is_active', CASE
                            WHEN milestone_type IN (
                              'first_withdrawal',
                              'withdrawal_25',
                              'withdrawal_100',
                              'withdrawal_500',
                              'withdrawal_1000'
                            ) THEN true
                            ELSE false
                          END
           )
           ORDER BY milestone_completed_at DESC
         )
    INTO referred_users_list
  FROM referral_rewards
  WHERE referrer_user_id = p_user_id;

  RETURN jsonb_build_object(
    'total_credits_earned', total_credits_earned,
    'total_referred_users', total_referred_users,
    'active_users', active_users,
    'completed_milestones', completed_milestones,
    'referred_users', COALESCE(referred_users_list, '[]'::jsonb)
  );
END;
$function$;

-- 3) Reprocessar a recompensa de primeiro saque para o usuário indicado recém aprovado
-- user_id do indicado: 0688e828-d6c8-460a-9ae7-088e95e0de56
-- Valor do saque (R$): 2.5 (corresponde a 5 pontos)
SELECT public.process_referral_reward(
  '0688e828-d6c8-460a-9ae7-088e95e0de56'::uuid,
  'first_withdrawal',
  2.5
) AS processed;
