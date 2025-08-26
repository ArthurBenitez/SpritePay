import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PIX-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const mercadoPagoToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");
    if (!mercadoPagoToken) throw new Error("MERCADO_PAGO_ACCESS_TOKEN is not set");
    logStep("MercadoPago token verified");

    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { credits, payer_name, payer_email, payer_phone, payer_cpf } = await req.json();
    
    if (!credits || credits <= 0) {
      throw new Error("Invalid credits amount");
    }
    
    if (!payer_name || !payer_email || !payer_phone || !payer_cpf) {
      throw new Error("Missing payer information");
    }
    
    logStep("Request data validated", { credits, payer_name, payer_email });

    const pricePerCredit = 100; // R$ 1,00 por crédito (em centavos)
    const totalAmount = credits * pricePerCredit;

    // Create PIX payment with MercadoPago
    const paymentPayload = {
      additional_info: {
        items: [
          {
            id: "SPRITEPAY_CREDITS",
            title: `${credits} Créditos SpritePay`,
            description: `Compra de ${credits} créditos para a plataforma SpritePay`,
            category_id: "virtual_goods",
            quantity: 1,
            unit_price: totalAmount / 100, // Convert to reais
          }
        ],
        payer: {
          first_name: payer_name.split(' ')[0],
          last_name: payer_name.split(' ').slice(1).join(' ') || payer_name.split(' ')[0],
          phone: {
            area_code: payer_phone.substring(0, 2),
            number: payer_phone.substring(2)
          }
        }
      },
      payer: {
        entity_type: "individual",
        type: "customer",
        email: payer_email,
        identification: {
          type: "CPF",
          number: payer_cpf.replace(/\D/g, '') // Remove non-digits
        }
      },
      payment_method_id: "pix",
      transaction_amount: totalAmount / 100, // Convert to reais
      description: `Compra de ${credits} créditos SpritePay`,
      external_reference: `${user.id}_${Date.now()}`,
      notification_url: `${req.headers.get("origin")}/api/webhook/mercadopago`,
      metadata: {
        user_id: user.id,
        credits: credits.toString(),
      }
    };

    logStep("Creating MercadoPago payment", { amount: totalAmount / 100 });

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": paymentPayload.external_reference,
      },
      body: JSON.stringify(paymentPayload),
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.text();
      logStep("MercadoPago API error", { status: mpResponse.status, error: errorData });
      throw new Error(`MercadoPago API error: ${mpResponse.status} - ${errorData}`);
    }

    const paymentData = await mpResponse.json();
    logStep("Payment created successfully", { paymentId: paymentData.id });

    // Extract PIX information
    const pixData = {
      payment_id: paymentData.id,
      qr_code_base64: paymentData.point_of_interaction?.transaction_data?.qr_code_base64,
      qr_code: paymentData.point_of_interaction?.transaction_data?.qr_code,
      ticket_url: paymentData.point_of_interaction?.transaction_data?.ticket_url,
      status: paymentData.status,
      transaction_amount: paymentData.transaction_amount,
      date_created: paymentData.date_created,
      date_of_expiration: paymentData.date_of_expiration
    };

    logStep("PIX data extracted", { payment_id: pixData.payment_id, status: pixData.status });

    return new Response(JSON.stringify({ 
      success: true, 
      ...pixData 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-pix-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});