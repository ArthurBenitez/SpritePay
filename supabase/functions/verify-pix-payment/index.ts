import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PIX-PAYMENT] ${step}${detailsStr}`);
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

    // Create Supabase client using the service role key for database updates
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { payment_id } = await req.json();
    if (!payment_id) {
      throw new Error("Payment ID is required");
    }
    logStep("Payment ID received", { payment_id });

    // Get payment details from MercadoPago
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mercadoPagoToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.text();
      logStep("MercadoPago API error", { status: mpResponse.status, error: errorData });
      throw new Error(`MercadoPago API error: ${mpResponse.status} - ${errorData}`);
    }

    const paymentData = await mpResponse.json();
    logStep("Payment retrieved", { 
      paymentStatus: paymentData.status,
      paymentId: paymentData.id,
      metadata: paymentData.metadata 
    });

    if (paymentData.status !== "approved") {
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Payment not approved",
        status: paymentData.status
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const userId = paymentData.metadata?.user_id;
    const credits = parseInt(paymentData.metadata?.credits || "0");

    if (!userId || !credits) {
      throw new Error("Invalid payment metadata");
    }

    logStep("Processing approved payment", { userId, credits });

    // Use the secure RPC function to update credits and create records
    const { data: updateSuccess, error: rpcError } = await supabaseClient.rpc(
      'update_credits_after_payment',
      {
        p_user_id: userId,
        p_credits: credits,
        p_description: `Compra de ${credits} créditos via PIX`
      }
    );

    if (rpcError) {
      logStep("RPC Error", { error: rpcError.message, code: rpcError.code });
      throw new Error(`Failed to process payment: ${rpcError.message}`);
    }

    if (!updateSuccess) {
      logStep("Update failed", { userId, credits });
      throw new Error("Failed to update user credits - user not found");
    }

    logStep("PIX payment processed successfully", { userId, credits });

    return new Response(JSON.stringify({ 
      success: true, 
      credits: credits,
      message: "PIX payment verified and credits added"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in verify-pix-payment", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});